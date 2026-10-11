const express = require('express');
const prisma = require('../prismaClient');
const { getMediaUrl } = require('../integrations/storage');
const { getYoutubeEmbedUrl, getYoutubeThumbnailUrl } = require('../lib/youtube');

const router = express.Router();

router.get('/', async (req, res) => {
  const items = await prisma.workItem.findMany({ where: { published: true }, orderBy: { sortOrder: 'asc' } });
  res.json(items.map((w) => ({
    ...w,
    videoUrl: getMediaUrl(w.videoPath),
    thumbnailUrl: getMediaUrl(w.thumbnailPath) || getYoutubeThumbnailUrl(w.youtubeUrl),
    youtubeEmbedUrl: getYoutubeEmbedUrl(w.youtubeUrl),
  })));
});

module.exports = router;
