const express = require('express');
const { z } = require('zod');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER'));

router.get('/', async (req, res) => {
  const config = await prisma.studioConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  res.json(config);
});

const updateSchema = z.object({
  maxBookingsPerDay: z.number().int().min(1).max(50),
});

router.patch('/', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const config = await prisma.studioConfig.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: { id: 1, ...parsed.data },
  });
  res.json(config);
});

module.exports = router;
