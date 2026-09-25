const express = require('express');
const prisma = require('../prismaClient');
const { generateQuotePdfBuffer } = require('../lib/pdfGenerator');

const router = express.Router();

function computeLineItems(services, catalog) {
  const keys = Array.isArray(services) ? services : [];
  return keys
    .map((key) => catalog.find((s) => s.key === key))
    .filter(Boolean)
    .map((s) => ({ serviceId: s.id, label: s.label, qty: 1, unitPrice: s.basePrice, lineTotal: s.basePrice }));
}

// POST /api/quotes — public inquiry from the website quote modal.
router.post('/', async (req, res) => {
  try {
    const { name, contact, services, note } = req.body;
    if (!name || !contact) return res.status(400).json({ error: 'name and contact are required' });

    let client = await prisma.client.findFirst({ where: { name, contact } });
    if (!client) {
      client = await prisma.client.create({ data: { name, contact, source: 'WEBSITE' } });
    }

    const catalog = await prisma.service.findMany({ where: { active: true } });
    const lineItems = computeLineItems(services, catalog);
    const subtotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);

    const quote = await prisma.quote.create({
      data: {
        clientId: client.id,
        status: 'DRAFT',
        subtotal,
        total: subtotal,
        note,
        lineItems: { create: lineItems },
      },
      include: { lineItems: true, client: true },
    });

    res.status(201).json({ id: quote.id, message: 'Quote request received — our team will follow up shortly.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create quote' });
  }
});

// GET /api/quotes/:id/pdf — regenerates the PDF on demand from stored
// line items, no disk file / write-stream race to worry about.
router.get('/:id/pdf', async (req, res) => {
  const quote = await prisma.quote.findUnique({
    where: { id: Number(req.params.id) },
    include: { lineItems: true, client: true },
  });
  if (!quote) return res.status(404).json({ error: 'Quote not found' });

  const buffer = await generateQuotePdfBuffer(quote);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="quote-${quote.id}.pdf"`);
  res.send(buffer);
});

router.get('/:id', async (req, res) => {
  const quote = await prisma.quote.findUnique({
    where: { id: Number(req.params.id) },
    include: { lineItems: true, client: true },
  });
  if (!quote) return res.status(404).json({ error: 'not found' });
  res.json(quote);
});

module.exports = router;
