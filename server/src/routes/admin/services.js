const express = require('express');
const { z } = require('zod');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER', 'FINANCE'));

const serviceSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  spec: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  basePrice: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  active: z.boolean().optional(),
});

router.get('/', async (req, res) => {
  res.json(await prisma.service.findMany({ orderBy: { id: 'asc' } }));
});

router.post('/', async (req, res) => {
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  res.status(201).json(await prisma.service.create({ data: parsed.data }));
});

router.patch('/:id', async (req, res) => {
  const parsed = serviceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  res.json(await prisma.service.update({ where: { id: Number(req.params.id) }, data: parsed.data }));
});

router.delete('/:id', async (req, res) => {
  await prisma.service.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

module.exports = router;
