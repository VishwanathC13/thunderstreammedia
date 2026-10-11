const express = require('express');
const { z } = require('zod');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { getMediaUrl } = require('../../integrations/storage');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER', 'EDITOR'));

const gallerySchema = z.object({
  title: z.string().min(1),
  caption: z.string().optional().nullable(),
  imagePath: z.string().min(1),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const withUrl = (image) => ({ ...image, imageUrl: getMediaUrl(image.imagePath) });

router.get('/', async (req, res) => {
  const images = await prisma.galleryImage.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  res.json(images.map(withUrl));
});

router.post('/', async (req, res) => {
  const parsed = gallerySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  res.status(201).json(withUrl(await prisma.galleryImage.create({ data: parsed.data })));
});

router.patch('/:id', async (req, res) => {
  const parsed = gallerySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  res.json(withUrl(await prisma.galleryImage.update({ where: { id: Number(req.params.id) }, data: parsed.data })));
});

router.delete('/:id', async (req, res) => {
  await prisma.galleryImage.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

module.exports = router;