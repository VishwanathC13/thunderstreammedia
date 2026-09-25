const express = require('express');
const prisma = require('../../prismaClient');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// One dashboard payload, shaped by role: each section mirrors who can open
// the matching admin page (spec §6), so a role never receives data it
// couldn't already reach through that module's own routes.
router.get('/', async (req, res) => {
  const role = req.user.role;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const out = {};

  if (['OWNER', 'SALES'].includes(role)) {
    const [pending, thisMonth, upcoming, clients, newClients] = await Promise.all([
      prisma.booking.count({ where: { status: 'PENDING', isBlocked: false } }),
      prisma.booking.count({ where: { isBlocked: false, status: { not: 'CANCELLED' }, date: { gte: monthStart } } }),
      prisma.booking.findMany({
        where: { isBlocked: false, status: { in: ['PENDING', 'CONFIRMED'] }, date: { gte: now } },
        include: { client: true, service: true },
        orderBy: { date: 'asc' },
        take: 5,
      }),
      prisma.client.count(),
      prisma.client.count({ where: { createdAt: { gte: monthStart } } }),
    ]);
    out.bookings = { pending, thisMonth, upcoming };
    out.clients = { total: clients, newThisMonth: newClients };

    const [events, revenue] = await Promise.all([
      prisma.event.findMany({
        where: { status: 'PUBLISHED', end: { gte: now } },
        include: { tickets: { where: { status: { not: 'CANCELLED' } }, select: { id: true } } },
        orderBy: { start: 'asc' },
        take: 4,
      }),
      prisma.payment.aggregate({ where: { status: 'CAPTURED' }, _sum: { amount: true } }),
    ]);
    out.events = {
      ticketRevenue: revenue._sum.amount || 0,
      upcoming: events.map((e) => ({ id: e.id, title: e.title, start: e.start, venue: e.venue, ticketsSold: e.tickets.length })),
    };
  }

  if (['OWNER', 'SALES', 'FINANCE'].includes(role)) {
    const [byStatus, recent] = await Promise.all([
      prisma.quote.groupBy({ by: ['status'], _count: { _all: true }, _sum: { total: true } }),
      prisma.quote.findMany({ include: { client: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);
    const stat = (s) => byStatus.find((r) => r.status === s);
    const awaiting = ['SENT', 'VIEWED'].map(stat).filter(Boolean);
    out.quotes = {
      drafts: stat('DRAFT')?._count._all || 0,
      awaitingCount: awaiting.reduce((n, r) => n + r._count._all, 0),
      awaitingValue: awaiting.reduce((n, r) => n + (r._sum.total || 0), 0),
      acceptedCount: stat('ACCEPTED')?._count._all || 0,
      acceptedValue: stat('ACCEPTED')?._sum.total || 0,
      recent: recent.map((q) => ({ id: q.id, client: q.client?.name, total: q.total, status: q.status, createdAt: q.createdAt })),
    };
  }

  if (['OWNER', 'EDITOR'].includes(role)) {
    const [published, hidden] = await Promise.all([
      prisma.workItem.count({ where: { published: true } }),
      prisma.workItem.count({ where: { published: false } }),
    ]);
    out.content = { published, hidden };
  }

  res.json(out);
});

module.exports = router;
