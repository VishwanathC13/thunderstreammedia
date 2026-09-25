// WhatsApp Business Platform API (spec 3.7 quote delivery, 3.5 ticket
// delivery). Real branch calls the Meta Graph API; mock branch logs and
// returns the same response shape so the send flow works end-to-end
// without a verified Meta Business account.
async function sendWhatsAppMessage({ to, templateName, params, mediaUrl }) {
  if (!(process.env.WHATSAPP_ENABLED === 'true' && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID)) {
    console.log(`[MOCK:whatsapp] would send template "${templateName}" to ${to}${mediaUrl ? ` with media ${mediaUrl}` : ''}`);
    return { mocked: true, id: `mock-wa-${Date.now()}` };
  }

  const res = await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [{ type: 'body', parameters: (params || []).map((p) => ({ type: 'text', text: String(p) })) }],
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `WhatsApp send failed (${res.status})`);
  return { mocked: false, id: data.messages?.[0]?.id };
}

module.exports = { sendWhatsAppMessage };
