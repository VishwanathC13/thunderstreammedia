const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { Role } = require('../../lib/enums');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER'));

router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true }, orderBy: { id: 'asc' } });
  res.json(users);
});

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(Role),
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { password, ...rest } = parsed.data;
  const user = await prisma.user.create({ data: { ...rest, passwordHash: await bcrypt.hash(password, 10) } });
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(Role).optional(),
});

router.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const user = await prisma.user.update({ where: { id: Number(req.params.id) }, data: parsed.data });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

router.delete('/:id', async (req, res) => {
  if (Number(req.params.id) === req.user.sub) return res.status(400).json({ error: "Can't delete your own account" });
  await prisma.user.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

module.exports = router;
