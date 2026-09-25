const express = require('express');
const { z } = require('zod');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { getMediaUrl } = require('../../integrations/storage');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER', 'EDITOR'));

const workSchema = z.object({
  title: z.string().min(1),
  client: z.string().min(1),
  tag: z.string().min(1),
  durationLabel: z.string().min(1),
  hue: z.number().int().min(0).max(360).optional(),
  videoPath: z.string().optional().nullable(),
  thumbnailPath: z.string().optional().nullable(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

router.get('/', async (req, res) => {
  const items = await prisma.workItem.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(items.map((w) => ({ ...w, videoUrl: getMediaUrl(w.videoPath), thumbnailUrl: getMediaUrl(w.thumbnailPath) })));
});

router.post('/', async (req, res) => {
  const parsed = workSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  res.status(201).json(await prisma.workItem.create({ data: parsed.data }));
});

router.patch('/:id', async (req, res) => {
  const parsed = workSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  res.json(await prisma.workItem.update({ where: { id: Number(req.params.id) }, data: parsed.data }));
});

router.delete('/:id', async (req, res) => {
  await prisma.workItem.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

module.exports = router;
