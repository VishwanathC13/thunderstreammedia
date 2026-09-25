const express = require('express');
const { z } = require('zod');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { GeoMode, GeoScope } = require('../../lib/enums');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER'));

router.get('/', async (req, res) => {
  res.json(await prisma.geoRule.findMany({ include: { ruleTargetEvent: true }, orderBy: { id: 'asc' } }));
});

const ruleSchema = z.object({
  mode: z.enum(GeoMode),
  countryCode: z.string().length(2),
  scope: z.enum(GeoScope).optional(),
  ruleTargetEventId: z.number().optional().nullable(),
});

router.post('/', async (req, res) => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const rule = await prisma.geoRule.create({ data: { ...parsed.data, countryCode: parsed.data.countryCode.toUpperCase() } });
  res.status(201).json(rule);
});

router.delete('/:id', async (req, res) => {
  await prisma.geoRule.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

module.exports = router;
