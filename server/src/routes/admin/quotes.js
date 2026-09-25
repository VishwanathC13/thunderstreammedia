const express = require('express');
const { z } = require('zod');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { QuoteStatus, SendChannel } = require('../../lib/enums');
const { generateQuotePdfBuffer } = require('../../lib/pdfGenerator');
const { sendEmail } = require('../../integrations/email');
const { sendWhatsAppMessage } = require('../../integrations/whatsapp');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER', 'SALES', 'FINANCE'));

router.get('/', async (req, res) => {
  const quotes = await prisma.quote.findMany({
    include: { client: true, lineItems: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(quotes);
});

router.get('/:id', async (req, res) => {
  const quote = await prisma.quote.findUnique({
    where: { id: Number(req.params.id) },
    include: { client: true, lineItems: true },
  });
  if (!quote) return res.status(404).json({ error: 'Quote not found' });
  res.json(quote);
});

const lineItemSchema = z.object({
  serviceId: z.number().optional().nullable(),
  label: z.string().min(1),
  qty: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),
});

const buildSchema = z.object({
  clientId: z.number(),
  lineItems: z.array(lineItemSchema).min(1),
  note: z.string().optional().nullable(),
});

// Quotation builder: admin picks a client + priced line items.
router.post('/', async (req, res) => {
  const parsed = buildSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { clientId, lineItems, note } = parsed.data;

  const items = lineItems.map((i) => ({ ...i, lineTotal: i.qty * i.unitPrice }));
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

  const quote = await prisma.quote.create({
    data: {
      clientId,
      status: 'DRAFT',
      subtotal,
      total: subtotal,
      note,
      createdByUserId: req.user.sub,
      lineItems: { create: items },
    },
    include: { lineItems: true, client: true },
  });
  res.status(201).json(quote);
});

const sendSchema = z.object({ channel: z.enum(SendChannel) });

router.post('/:id/send', async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const id = Number(req.params.id);
  const quote = await prisma.quote.findUnique({ where: { id }, include: { lineItems: true, client: true } });
  if (!quote) return res.status(404).json({ error: 'Quote not found' });

  const pdfBuffer = await generateQuotePdfBuffer(quote);

  try {
    if (parsed.data.channel === 'EMAIL') {
      await sendEmail({
        to: quote.client.contact,
        subject: `Your Thunderstream Media quote #${quote.id}`,
        html: `<p>Hi ${quote.client.name},</p><p>Please find your quotation attached — total ₹${quote.total.toLocaleString('en-IN')}.</p>`,
        attachments: [{ content: pdfBuffer.toString('base64'), filename: `quote-${quote.id}.pdf`, type: 'application/pdf' }],
      });
    } else {
      await sendWhatsAppMessage({
        to: quote.client.contact,
        templateName: 'quote_ready',
        params: [quote.client.name, `₹${quote.total.toLocaleString('en-IN')}`],
      });
    }
  } catch (err) {
    console.error(`failed to send quote #${quote.id} via ${parsed.data.channel}:`, err.message);
    return res.status(502).json({ error: `Failed to send: ${err.message}` });
  }

  const updated = await prisma.quote.update({
    where: { id },
    data: { status: 'SENT', sentVia: parsed.data.channel, sentAt: new Date() },
  });
  res.json(updated);
});

const statusSchema = z.object({ status: z.enum(QuoteStatus) });

router.patch('/:id/status', async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const id = Number(req.params.id);
  const extra = {};
  if (parsed.data.status === 'VIEWED') extra.viewedAt = new Date();
  if (parsed.data.status === 'ACCEPTED') extra.acceptedAt = new Date();

  const quote = await prisma.quote.update({ where: { id }, data: { status: parsed.data.status, ...extra } });
  res.json(quote);
});

module.exports = router;
