const express = require('express');
const { z } = require('zod');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER', 'SALES'));

router.get('/', async (req, res) => {
  const venues = await prisma.venue.findMany({
    include: { zones: true, seats: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(venues.map((v) => ({ ...v, seatCount: v.seats.length })));
});

router.get('/:id', async (req, res) => {
  const venue = await prisma.venue.findUnique({
    where: { id: Number(req.params.id) },
    include: { zones: { orderBy: { sortOrder: 'asc' } }, seats: true },
  });
  if (!venue) return res.status(404).json({ error: 'Venue not found' });
  res.json(venue);
});

const venueSchema = z.object({ name: z.string().min(1), city: z.string().optional().nullable() });

router.post('/', async (req, res) => {
  const parsed = venueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const venue = await prisma.venue.create({ data: parsed.data });
  res.status(201).json(venue);
});

router.patch('/:id', async (req, res) => {
  const parsed = venueSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const venue = await prisma.venue.update({ where: { id: Number(req.params.id) }, data: parsed.data });
  res.json(venue);
});

router.delete('/:id', async (req, res) => {
  await prisma.venue.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

// Bulk-create a whole venue (venue + zones + seats) from an uploaded
// auditorium seat map (CSV/JSON, parsed client-side into this common
// shape). Seats without a recognized category fall back to a generated
// "Unassigned" zone so the admin can drag-select and reassign them in
// the editor afterward, rather than failing the whole import.
const importSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional().nullable(),
  categories: z.array(z.object({ name: z.string().min(1), colorHex: z.string().min(1) })),
  seats: z.array(z.object({
    row: z.string().min(1),
    seatNumber: z.number().int(),
    category: z.string().optional().nullable(),
    x: z.number(),
    y: z.number(),
  })).min(1),
});

router.post('/import', async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { name, city, categories, seats } = parsed.data;

  // Keep the source seat-map's native pixel spacing (no downscale) — both
  // the public seat map and the admin editor auto-fit their own viewBox to
  // whatever coordinates the seats actually have, so compressing into a
  // fixed small canvas here only shrinks the gap between seats below the
  // fixed circle radius they're drawn with, causing them to overlap. Just
  // shift everything so it starts near a small positive margin.
  const margin = 40;
  const minX = Math.min(...seats.map((s) => s.x));
  const minY = Math.min(...seats.map((s) => s.y));

  const venueId = await prisma.$transaction(async (tx) => {
    const venue = await tx.venue.create({ data: { name, city: city || null } });

    const zoneIdByCategory = new Map();
    for (const [i, cat] of categories.entries()) {
      const zone = await tx.seatZone.create({
        data: { venueId: venue.id, name: cat.name, colorHex: cat.colorHex, basePrice: 0, sortOrder: i },
      });
      zoneIdByCategory.set(cat.name, zone.id);
    }
    const fallbackZone = await tx.seatZone.create({
      data: { venueId: venue.id, name: 'Unassigned', colorHex: '#666666', basePrice: 0, sortOrder: categories.length },
    });

    await tx.seat.createMany({
      data: seats.map((s) => ({
        venueId: venue.id,
        zoneId: (s.category && zoneIdByCategory.get(s.category)) || fallbackZone.id,
        rowLabel: s.row,
        seatNumber: s.seatNumber,
        posX: margin + (s.x - minX),
        posY: margin + (s.y - minY),
      })),
    });

    return venue.id;
  });

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { zones: { orderBy: { sortOrder: 'asc' } }, seats: true },
  });
  res.status(201).json(venue);
});

// --- Zones ---

const zoneSchema = z.object({
  name: z.string().min(1),
  colorHex: z.string().min(1),
  basePrice: z.number().nonnegative().default(0),
  sortOrder: z.number().int().default(0),
});

router.post('/:id/zones', async (req, res) => {
  const parsed = zoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const zone = await prisma.seatZone.create({ data: { ...parsed.data, venueId: Number(req.params.id) } });
  res.status(201).json(zone);
});

router.patch('/zones/:zoneId', async (req, res) => {
  const parsed = zoneSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const zone = await prisma.seatZone.update({ where: { id: Number(req.params.zoneId) }, data: parsed.data });
  res.json(zone);
});

router.delete('/zones/:zoneId', async (req, res) => {
  await prisma.seatZone.delete({ where: { id: Number(req.params.zoneId) } });
  res.status(204).end();
});

// --- Seats ---

const seatSchema = z.object({
  zoneId: z.number().int(),
  rowLabel: z.string().min(1),
  seatNumber: z.number().int(),
  posX: z.number(),
  posY: z.number(),
});

router.post('/:id/seats', async (req, res) => {
  const parsed = seatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const seat = await prisma.seat.create({ data: { ...parsed.data, venueId: Number(req.params.id) } });
  res.status(201).json(seat);
});

// Bulk placement — e.g. dropping a whole row of seats at once in the editor.
router.post('/:id/seats/bulk', async (req, res) => {
  const parsed = z.array(seatSchema).safeParse(req.body.seats);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const venueId = Number(req.params.id);
  const created = await prisma.$transaction(parsed.data.map((s) => prisma.seat.create({ data: { ...s, venueId } })));
  res.status(201).json(created);
});

router.patch('/seats/:seatId', async (req, res) => {
  const parsed = seatSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const seat = await prisma.seat.update({ where: { id: Number(req.params.seatId) }, data: parsed.data });
  res.json(seat);
});

router.delete('/seats/:seatId', async (req, res) => {
  await prisma.seat.delete({ where: { id: Number(req.params.seatId) } });
  res.status(204).end();
});

module.exports = router;
