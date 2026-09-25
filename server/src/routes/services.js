const express = require('express');
const prisma = require('../prismaClient');

const router = express.Router();

router.get('/', async (req, res) => {
  const services = await prisma.service.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  res.json(services);
});

module.exports = router;
