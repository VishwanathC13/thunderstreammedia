const express = require('express');
const { z } = require('zod');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { BookingStatus } = require('../../lib/enums');
const { createMeeting } = require('../../integrations/meetings');
const { sendEmail } = require('../../integrations/email');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER', 'SALES'));

router.get('/', async (req, res) => {
  const bookings = await prisma.booking.findMany({
    include: { client: true, service: true },
    orderBy: { date: 'asc' },
  });
  res.json(bookings);
});

const blockSchema = z.object({
  date: z.string(),
  clientId: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Tier-1 manual "Block Date" flow from spec 3.6.
router.post('/block', async (req, res) => {
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { date, clientId, notes } = parsed.data;
  const booking = await prisma.booking.create({
    data: {
      date: new Date(date),
      clientId: clientId || null,
      isBlocked: true,
      status: 'CONFIRMED',
      source: 'MANUAL',
      notes,
      createdByUserId: req.user.sub,
    },
  });
  res.status(201).json(booking);
});

const updateSchema = z.object({
  status: z.enum(BookingStatus).optional(),
  notes: z.string().optional().nullable(),
});

router.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const id = Number(req.params.id);
  const existing = await prisma.booking.findUnique({ where: { id }, include: { client: true, service: true } });
  if (!existing) return res.status(404).json({ error: 'Booking not found' });

  let extra = {};
  const turningConfirmed = parsed.data.status === 'CONFIRMED' && existing.status !== 'CONFIRMED';
  if (turningConfirmed && existing.service?.key === 'corporate') {
    const meeting = await createMeeting({
      provider: 'ZOOM',
      topic: `Thunderstream Media consultation — ${existing.client?.name || 'client'}`,
      startTime: existing.date,
      durationMins: 45,
    });
    extra = { meetingProvider: meeting.provider, meetingJoinUrl: meeting.joinUrl, meetingId: meeting.meetingId };

    // The meeting is already created at this point — an email hiccup
    // shouldn't block confirming the booking; the join link is already
    // visible in the admin dashboard either way.
    if (existing.client?.contact?.includes('@')) {
      try {
        await sendEmail({
          to: existing.client.contact,
          subject: 'Your Thunderstream Media consultation is confirmed',
          html: `<p>Your corporate consultation is confirmed for ${existing.date.toDateString()}.</p><p>Join link: <a href="${meeting.joinUrl}">${meeting.joinUrl}</a></p>`,
        });
      } catch (err) {
        console.error(`failed to send consultation confirmation to ${existing.client.contact}:`, err.message);
      }
    }
  }

  const booking = await prisma.booking.update({
    where: { id },
    data: { ...parsed.data, ...extra },
  });
  res.json(booking);
});

router.patch('/:id/sync-calendar', async (req, res) => {
  const { syncBookingToCalendar } = require('../../integrations/calendarSync');
  const id = Number(req.params.id);
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const result = await syncBookingToCalendar({ booking });
  const updated = await prisma.booking.update({ where: { id }, data: { calendarSyncStatus: result.status } });
  res.json(updated);
});

module.exports = router;
