const express = require('express');
const prisma = require('../prismaClient');
const { getMediaUrl } = require('../integrations/storage');

const router = express.Router();

router.get('/', async (req, res) => {
  const items = await prisma.workItem.findMany({ where: { published: true }, orderBy: { sortOrder: 'asc' } });
  res.json(items.map((w) => ({
    ...w,
    videoUrl: getMediaUrl(w.videoPath),
    thumbnailUrl: getMediaUrl(w.thumbnailPath),
  })));
});

module.exports = router;
