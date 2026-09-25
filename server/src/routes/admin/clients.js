const express = require('express');
const { z } = require('zod');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { ContactSource } = require('../../lib/enums');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER', 'SALES'));

const clientSchema = z.object({
  name: z.string().min(1),
  contact: z.string().min(1),
  company: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  source: z.enum(ContactSource).optional(),
});

router.get('/', async (req, res) => {
  const { q } = req.query;
  const where = q
    ? { OR: [{ name: { contains: q } }, { contact: { contains: q } }, { company: { contains: q } }] }
    : undefined;
  const clients = await prisma.client.findMany({ where, orderBy: { name: 'asc' } });
  res.json(clients);
});

router.get('/:id', async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: Number(req.params.id) },
    include: { bookings: true, quotes: true, tickets: true },
  });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

router.post('/', async (req, res) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const client = await prisma.client.create({ data: parsed.data });
  res.status(201).json(client);
});

router.patch('/:id', async (req, res) => {
  const parsed = clientSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const client = await prisma.client.update({ where: { id: Number(req.params.id) }, data: parsed.data });
  res.json(client);
});

router.delete('/:id', async (req, res) => {
  await prisma.client.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

module.exports = router;
