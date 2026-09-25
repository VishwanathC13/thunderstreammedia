const express = require('express');

const router = express.Router();

// Meta's one-time handshake when you save the Callback URL in the app
// dashboard: it GETs this with hub.verify_token, and expects the raw
// hub.challenge value echoed back if the token matches.
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Delivery/read status updates and inbound customer replies land here.
// Just logged for now — no inbound-message handling flow exists yet
// (e.g. auto-replies or CRM threading), so this is a visibility hook,
// not a business-logic one. Must always 200 quickly or Meta disables
// the endpoint after repeated timeouts/non-200s.
router.post('/whatsapp', (req, res) => {
  const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
  const statuses = entry?.statuses;
  const messages = entry?.messages;

  if (statuses) {
    statuses.forEach((s) => console.log(`[whatsapp webhook] status: ${s.id} -> ${s.status}`));
  }
  if (messages) {
    messages.forEach((m) => console.log(`[whatsapp webhook] inbound message from ${m.from}: ${JSON.stringify(m.text || m.type)}`));
  }

  res.sendStatus(200);
});

module.exports = router;
