const express = require('express');
const { z } = require('zod');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { EventStatus } = require('../../lib/enums');
const { getMediaUrl } = require('../../integrations/storage');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER', 'SALES'));

router.get('/', async (req, res) => {
  const events = await prisma.event.findMany({
    include: { ticketTiers: true, tickets: true },
    orderBy: { start: 'desc' },
  });
  res.json(events.map((e) => ({ ...e, coverImageUrl: getMediaUrl(e.coverImagePath) })));
});

const eventSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  coverImagePath: z.string().optional().nullable(),
  start: z.string(),
  end: z.string(),
  venue: z.string().optional().nullable(),
  capacity: z.number().int().optional().nullable(),
  status: z.enum(EventStatus).optional(),
  geoRestricted: z.boolean().optional(),
  livestreamUrl: z.string().optional().nullable(),
  ticketTiers: z.array(z.object({ name: z.string(), price: z.number().nonnegative(), quantityTotal: z.number().int().positive() })).optional(),
  seatingMode: z.boolean().optional(),
  seatingVenueId: z.number().int().optional().nullable(),
});

// Assigned seating gives every Seat in the chosen venue an EventSeat row
// for this event (price defaulted from the seat's zone, editable per-event
// afterward). Safe to call again on update — createMany + skipDuplicates
// means already-synced (or already-booked) seats are left untouched.
async function syncEventSeats(eventId, venueId) {
  const seats = await prisma.seat.findMany({ where: { venueId }, include: { zone: true } });
  if (!seats.length) return;
  await prisma.eventSeat.createMany({
    data: seats.map((s) => ({ eventId, seatId: s.id, price: s.zone.basePrice })),
    skipDuplicates: true,
  });
}

router.post('/', async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { ticketTiers, ...eventData } = parsed.data;
  const event = await prisma.event.create({
    data: {
      ...eventData,
      start: new Date(eventData.start),
      end: new Date(eventData.end),
      ticketTiers: ticketTiers ? { create: ticketTiers } : undefined,
    },
    include: { ticketTiers: true },
  });
  if (event.seatingMode && event.seatingVenueId) await syncEventSeats(event.id, event.seatingVenueId);
  res.status(201).json(event);
});

router.patch('/:id', async (req, res) => {
  const parsed = eventSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { ticketTiers, ...eventData } = parsed.data;
  const data = { ...eventData };
  if (data.start) data.start = new Date(data.start);
  if (data.end) data.end = new Date(data.end);
  const event = await prisma.event.update({ where: { id: Number(req.params.id) }, data });
  if (event.seatingMode && event.seatingVenueId) await syncEventSeats(event.id, event.seatingVenueId);
  res.json(event);
});

router.delete('/:id', async (req, res) => {
  await prisma.event.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

router.post('/:id/tiers', async (req, res) => {
  const schema = z.object({ name: z.string(), price: z.number().nonnegative(), quantityTotal: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const tier = await prisma.ticketTier.create({ data: { ...parsed.data, eventId: Number(req.params.id) } });
  res.status(201).json(tier);
});

router.get('/:id/attendees', async (req, res) => {
  const tickets = await prisma.ticket.findMany({
    where: { eventId: Number(req.params.id) },
    include: { buyerClient: true, ticketTier: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(tickets);
});

const checkinSchema = z.object({ qrToken: z.string().min(1) });

router.post('/checkin', async (req, res) => {
  const parsed = checkinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const ticket = await prisma.ticket.findUnique({ where: { qrToken: parsed.data.qrToken }, include: { buyerClient: true, event: true, ticketTier: true } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status === 'CANCELLED') return res.status(409).json({ error: 'Ticket cancelled' });
  if (ticket.status === 'CHECKED_IN') return res.status(409).json({ error: 'Already checked in', ticket });

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'CHECKED_IN', checkedInAt: new Date() },
    include: { buyerClient: true, event: true, ticketTier: true },
  });
  res.json({ ok: true, ticket: updated });
});

module.exports = router;
