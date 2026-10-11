const express = require('express');
const prisma = require('../prismaClient');
const { getMediaUrl } = require('../integrations/storage');

const router = express.Router();

router.get('/', async (req, res) => {
  const images = await prisma.galleryImage.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json(images.map((image) => ({ ...image, imageUrl: getMediaUrl(image.imagePath) })));
});

module.exports = router;