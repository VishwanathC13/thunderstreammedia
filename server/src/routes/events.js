const express = require('express');
const prisma = require('../prismaClient');
const { getMediaUrl } = require('../integrations/storage');
const { createOrder, verifyPayment } = require('../integrations/payments');
const { generateTicketToken, generateQrDataUrl } = require('../integrations/qr');
const { sendEmail } = require('../integrations/email');
const { sendWhatsAppMessage } = require('../integrations/whatsapp');
const { checkEventGeoRestriction } = require('../middleware/geoblock');
const seatHold = require('../lib/seatHold');

// Thrown inside the seat-confirm $transaction to abort+rollback on a
// conditional-update miss, then caught outside and turned into a 409.
class SeatConflictError extends Error {}

const router = express.Router();

router.get('/', async (req, res) => {
  const events = await prisma.event.findMany({
    where: { status: 'PUBLISHED' },
    include: { ticketTiers: true },
    orderBy: { start: 'asc' },
  });
  res.json(events.map((e) => ({ ...e, coverImageUrl: getMediaUrl(e.coverImagePath) })));
});

// GET /api/events/live — is anything currently broadcasting? Mounted
// before /:slug so Express doesn't treat "live" as a slug param.
router.get('/live', async (req, res) => {
  const now = new Date();
  const event = await prisma.event.findFirst({
    where: {
      status: 'PUBLISHED',
      livestreamUrl: { not: null },
      start: { lte: now },
      end: { gte: now },
    },
    select: { slug: true, title: true },
  });
  res.json({ live: Boolean(event), event: event || null });
});

router.get('/:slug', checkEventGeoRestriction, async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: { ticketTiers: true, seatingVenue: true },
  });
  if (!event || event.status !== 'PUBLISHED') return res.status(404).json({ error: 'Event not found' });
  // req.geoBlocked is set by the geoblock middleware when this event is geo-restricted and the visitor is blocked.
  res.json({ ...event, coverImageUrl: getMediaUrl(event.coverImagePath), geoBlocked: Boolean(req.geoBlocked) });
});

// GET /api/events/:slug/seatmap — zones + seats + live status (Postgres
// AVAILABLE/BOOKED/BLOCKED merged with any live Redis hold, read-time,
// same split as the original seat-booking-system demo).
router.get('/:slug/seatmap', async (req, res) => {
  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event || !event.seatingMode || !event.seatingVenueId) return res.status(404).json({ error: 'This event has no seat map' });

  const [zones, eventSeats] = await Promise.all([
    prisma.seatZone.findMany({ where: { venueId: event.seatingVenueId }, orderBy: { sortOrder: 'asc' } }),
    prisma.eventSeat.findMany({ where: { eventId: event.id }, include: { seat: true } }),
  ]);

  const availableIds = eventSeats.filter((es) => es.status === 'AVAILABLE').map((es) => es.seatId);
  const held = await seatHold.heldSeatIds(event.id, availableIds);

  res.json({
    zones: zones.map((z) => ({ id: z.id, name: z.name, colorHex: z.colorHex })),
    seats: eventSeats.map((es) => ({
      id: es.seatId,
      row: es.seat.rowLabel,
      number: es.seat.seatNumber,
      x: es.seat.posX,
      y: es.seat.posY,
      zoneId: es.seat.zoneId,
      price: es.price,
      status: es.status === 'AVAILABLE' && held.has(es.seatId) ? 'HELD' : es.status,
    })),
  });
});

// POST /api/events/:slug/seats/hold — all-or-nothing lock on a set of seats.
router.post('/:slug/seats/hold', async (req, res) => {
  const { seatIds } = req.body;
  if (!Array.isArray(seatIds) || seatIds.length === 0) return res.status(400).json({ error: 'seatIds is required' });

  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event || !event.seatingMode) return res.status(404).json({ error: 'Event not found' });

  const eventSeats = await prisma.eventSeat.findMany({ where: { eventId: event.id, seatId: { in: seatIds } } });
  const unavailable = seatIds.filter((id) => {
    const es = eventSeats.find((row) => row.seatId === id);
    return !es || es.status !== 'AVAILABLE';
  });
  if (unavailable.length) return res.status(409).json({ error: 'One or more seats are no longer available', seatIds: unavailable });

  const result = await seatHold.createHold(event.id, seatIds);
  if (!result.ok) return res.status(409).json({ error: 'One or more seats were just taken', seatIds: result.conflictSeatIds });
  res.json(result);
});

// POST /api/events/:slug/tickets — creates a payment order. Either
// { tierId } (general admission, existing flow) or { holdToken, seatIds }
// (assigned seating) — never both.
router.post('/:slug/tickets', async (req, res) => {
  const { tierId, holdToken, buyerName, buyerContact } = req.body;
  if (!buyerName || !buyerContact) return res.status(400).json({ error: 'buyerName and buyerContact are required' });

  const event = await prisma.event.findUnique({ where: { slug: req.params.slug }, include: { ticketTiers: true } });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  if (holdToken) {
    const hold = await seatHold.getHold(holdToken);
    if (!hold || hold.eventId !== event.id) return res.status(410).json({ error: 'Your seat hold has expired. Please select seats again.' });

    const eventSeats = await prisma.eventSeat.findMany({ where: { eventId: event.id, seatId: { in: hold.seatIds } } });
    const amount = eventSeats.reduce((sum, es) => sum + es.price, 0);

    const order = await createOrder({ amount, currency: 'INR', receipt: `event-${event.id}-hold-${holdToken}` });
    return res.json({ ...order, holdToken, eventSlug: event.slug, buyerName, buyerContact });
  }

  if (!tierId) return res.status(400).json({ error: 'tierId, buyerName, buyerContact are required' });
  const tier = event.ticketTiers.find((t) => t.id === Number(tierId));
  if (!tier) return res.status(404).json({ error: 'Ticket tier not found' });
  if (tier.quantitySold >= tier.quantityTotal) return res.status(409).json({ error: 'Sold out' });

  const order = await createOrder({ amount: tier.price, currency: 'INR', receipt: `event-${event.id}-tier-${tier.id}` });

  res.json({ ...order, tierId: tier.id, eventSlug: event.slug, buyerName, buyerContact });
});

// POST /api/events/:slug/tickets/confirm — verifies payment, issues the
// ticket(s) + QR(s). Either { tierId } (one ticket) or { holdToken } (one
// ticket per held seat).
router.post('/:slug/tickets/confirm', async (req, res) => {
  const { tierId, holdToken, buyerName, buyerContact, orderId, paymentId, signature } = req.body;
  if (!buyerName || !buyerContact || !orderId) return res.status(400).json({ error: 'missing required fields' });

  const verification = verifyPayment({ orderId, paymentId, signature });
  if (!verification.valid) return res.status(400).json({ error: 'Payment verification failed' });

  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  if (holdToken) {
    const hold = await seatHold.getHold(holdToken);
    if (!hold || hold.eventId !== event.id) return res.status(410).json({ error: 'Your seat hold has expired. Please select seats again.' });

    let buyer = await prisma.client.findFirst({ where: { name: buyerName, contact: buyerContact } });
    if (!buyer) buyer = await prisma.client.create({ data: { name: buyerName, contact: buyerContact, source: 'WEBSITE' } });

    let tickets;
    try {
      tickets = await prisma.$transaction(async (tx) => {
        const eventSeats = await tx.eventSeat.findMany({ where: { eventId: event.id, seatId: { in: hold.seatIds } }, include: { seat: true } });
        const amount = eventSeats.reduce((sum, es) => sum + es.price, 0);

        const payment = await tx.payment.create({
          data: {
            provider: 'RAZORPAY',
            providerOrderId: orderId,
            providerPaymentId: paymentId || null,
            amount,
            status: 'CAPTURED',
            rawPayload: JSON.stringify({ mocked: verification.mocked }),
          },
        });

        const created = [];
        for (const es of eventSeats) {
          // Conditional update: only succeeds if this seat is still
          // AVAILABLE. If another checkout beat this one to it (should be
          // rare -- the hold is supposed to prevent exactly this -- but a
          // hold can expire mid-payment), the whole transaction throws and
          // rolls back rather than half-issuing tickets.
          const result = await tx.eventSeat.updateMany({ where: { id: es.id, status: 'AVAILABLE' }, data: { status: 'BOOKED' } });
          if (result.count === 0) throw new SeatConflictError(`Seat ${es.seat.rowLabel}${es.seat.seatNumber} was just booked by someone else`);

          const qrToken = generateTicketToken();
          const ticket = await tx.ticket.create({
            data: { eventId: event.id, eventSeatId: es.id, buyerClientId: buyer.id, qrToken, status: 'ISSUED', paymentId: payment.id },
          });
          created.push({ ticket, seat: es.seat });
        }
        return created;
      });
    } catch (err) {
      if (err instanceof SeatConflictError) return res.status(409).json({ error: err.message });
      throw err;
    }

    await seatHold.releaseHold(holdToken);

    const withQr = await Promise.all(tickets.map(async ({ ticket, seat }) => ({
      ticketId: ticket.id,
      qrToken: ticket.qrToken,
      qrDataUrl: await generateQrDataUrl(ticket.qrToken),
      seatLabel: `${seat.rowLabel}${seat.seatNumber}`,
    })));

    try {
      const qrListHtml = withQr.map((t) => `<p>${t.seatLabel} — Ticket #${t.ticketId}</p><img src="${t.qrDataUrl}" />`).join('');
      if (buyer.contact.includes('@')) {
        await sendEmail({ to: buyer.contact, subject: `Your tickets for ${event.title}`, html: `<p>Hi ${buyer.name}, your ${withQr.length} ticket(s) are confirmed.</p>${qrListHtml}` });
      } else {
        await sendWhatsAppMessage({ to: buyer.contact, templateName: 'ticket_confirmed', params: [buyer.name, event.title, String(withQr.length)] });
      }
    } catch (err) {
      console.error(`failed to send ticket confirmation to ${buyer.contact}:`, err.message);
    }

    return res.status(201).json({ tickets: withQr, event: event.title });
  }

  if (!tierId) return res.status(400).json({ error: 'missing required fields' });
  const tier = await prisma.ticketTier.findUnique({ where: { id: Number(tierId) } });
  if (!tier || tier.quantitySold >= tier.quantityTotal) return res.status(409).json({ error: 'Sold out' });

  let buyer = await prisma.client.findFirst({ where: { name: buyerName, contact: buyerContact } });
  if (!buyer) buyer = await prisma.client.create({ data: { name: buyerName, contact: buyerContact, source: 'WEBSITE' } });

  const payment = await prisma.payment.create({
    data: {
      provider: 'RAZORPAY',
      providerOrderId: orderId,
      providerPaymentId: paymentId || null,
      amount: tier.price,
      status: 'CAPTURED',
      rawPayload: JSON.stringify({ mocked: verification.mocked }),
    },
  });

  const qrToken = generateTicketToken();
  const ticket = await prisma.ticket.create({
    data: {
      eventId: event.id,
      ticketTierId: tier.id,
      buyerClientId: buyer.id,
      qrToken,
      status: 'ISSUED',
      paymentId: payment.id,
    },
  });

  await prisma.ticketTier.update({ where: { id: tier.id }, data: { quantitySold: { increment: 1 } } });

  const qrDataUrl = await generateQrDataUrl(qrToken);

  // Payment is already captured and the ticket already exists at this
  // point — a notification-delivery failure shouldn't fail the whole
  // request and strand a paying customer without their ticket. Log it
  // and let them see the QR code on screen either way.
  try {
    if (buyer.contact.includes('@')) {
      await sendEmail({
        to: buyer.contact,
        subject: `Your ticket for ${event.title}`,
        html: `<p>Hi ${buyer.name}, your ticket is confirmed.</p>
               <p><strong>Ticket ID: ${ticket.id}</strong> — keep this along with the email/phone
               you booked with. If you come back later to watch the livestream, use
               "Already have a ticket?" on the event page and enter both to get back in.</p>
               <p>Show this QR code at check-in:</p><img src="${qrDataUrl}" />`,
      });
    } else {
      await sendWhatsAppMessage({ to: buyer.contact, templateName: 'ticket_confirmed', params: [buyer.name, event.title, String(ticket.id)] });
    }
  } catch (err) {
    console.error(`failed to send ticket confirmation to ${buyer.contact}:`, err.message);
  }

  res.status(201).json({ ticketId: ticket.id, qrToken, qrDataUrl, event: event.title });
});

// POST /api/events/:slug/tickets/access — re-entry for a returning ticket
// holder: prove you hold a ticket with its numeric ID + the contact info
// used to buy it (no full account/login system for public ticket buyers,
// this is the lightweight equivalent of one).
router.post('/:slug/tickets/access', async (req, res) => {
  const { ticketId, contact } = req.body;
  if (!ticketId || !contact) return res.status(400).json({ error: 'ticketId and contact are required' });

  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const ticket = await prisma.ticket.findUnique({
    where: { id: Number(ticketId) },
    include: { buyerClient: true },
  });

  const normalizedInput = String(contact).trim().toLowerCase();
  const matches =
    ticket &&
    ticket.eventId === event.id &&
    ticket.status !== 'CANCELLED' &&
    ticket.buyerClient?.contact?.trim().toLowerCase() === normalizedInput;

  if (!matches) return res.status(404).json({ error: "We couldn't find a ticket matching those details" });

  const qrDataUrl = await generateQrDataUrl(ticket.qrToken);
  res.json({ ticketId: ticket.id, qrToken: ticket.qrToken, qrDataUrl, event: event.title });
});

module.exports = router;
