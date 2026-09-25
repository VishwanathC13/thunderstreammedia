const express = require('express');
const prisma = require('../prismaClient');

const router = express.Router();

async function getCapacity() {
  const config = await prisma.studioConfig.findUnique({ where: { id: 1 } });
  return config?.maxBookingsPerDay ?? 1;
}

function dayRange(dateInput) {
  const d = new Date(dateInput);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// GET /api/bookings/availability?month=2026-10 -> per-day booking counts +
// whether the day is fully unavailable (hard-blocked, or at capacity).
// A studio can run multiple bookings on the same date up to
// StudioConfig.maxBookingsPerDay — a single booking no longer takes the
// whole day off the calendar.
router.get('/availability', async (req, res) => {
  const month = req.query.month; // "YYYY-MM"
  const [y, m] = (month || '').split('-').map(Number);
  const year = y || new Date().getFullYear();
  const monthIdx = m ? m - 1 : new Date().getMonth();

  const start = new Date(Date.UTC(year, monthIdx, 1));
  const end = new Date(Date.UTC(year, monthIdx + 1, 1));
  const capacity = await getCapacity();

  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: start, lt: end },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { date: true, source: true, isBlocked: true },
  });

  const byDay = {};
  for (const b of bookings) {
    const day = b.date.getUTCDate();
    if (!byDay[day]) byDay[day] = { day, count: 0, hardBlocked: false };
    byDay[day].count += 1;
    if (b.isBlocked) byDay[day].hardBlocked = true;
  }

  const days = Object.values(byDay).map((d) => ({
    day: d.day,
    bookedCount: d.count,
    full: d.hardBlocked || d.count >= capacity,
  }));

  res.json({ year, month: monthIdx + 1, maxBookingsPerDay: capacity, days });
});

// POST /api/bookings — public booking request: a customer picks an
// available date + one service from the website calendar.
router.post('/', async (req, res) => {
  try {
    const { name, contact, service, date, notes, source } = req.body;
    if (!name || !contact || !service || !date) {
      return res.status(400).json({ error: 'name, contact, service, and date are required' });
    }

    const serviceRecord = await prisma.service.findUnique({ where: { key: service } });
    if (!serviceRecord) return res.status(400).json({ error: 'Unknown service' });

    const requestedDate = new Date(date);
    const { start: dayStart, end: dayEnd } = dayRange(requestedDate);
    const capacity = await getCapacity();

    const existingForDay = await prisma.booking.findMany({
      where: { date: { gte: dayStart, lt: dayEnd }, status: { in: ['PENDING', 'CONFIRMED'] } },
      select: { isBlocked: true },
    });
    const hardBlocked = existingForDay.some((b) => b.isBlocked);
    if (hardBlocked || existingForDay.length >= capacity) {
      return res.status(409).json({ error: 'That date is no longer available' });
    }

    let clientRecord = await prisma.client.findFirst({ where: { name, contact } });
    if (!clientRecord) {
      clientRecord = await prisma.client.create({
        data: { name, contact, source: (source || 'website').toUpperCase() },
      });
    }

    const booking = await prisma.booking.create({
      data: {
        clientId: clientRecord.id,
        serviceId: serviceRecord.id,
        date: requestedDate,
        source: (source || 'website').toUpperCase(),
        status: 'PENDING',
        notes: notes || null,
      },
    });
    res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create booking' });
  }
});

module.exports = router;
