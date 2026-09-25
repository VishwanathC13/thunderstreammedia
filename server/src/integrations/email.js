// Transactional email (spec 3.7 quote delivery, 3.5 ticket delivery, 3.4
// meeting confirmations). Real branch uses SendGrid; mock branch logs and
// returns the same response shape.
async function sendEmail({ to, subject, html, attachments }) {
  if (!(process.env.EMAIL_ENABLED === 'true' && process.env.SENDGRID_API_KEY)) {
    console.log(`[MOCK:email] would send "${subject}" to ${to}${attachments?.length ? ` with ${attachments.length} attachment(s)` : ''}`);
    return { mocked: true, id: `mock-email-${Date.now()}` };
  }

  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const [res] = await sgMail.send({
    to,
    from: process.env.SENDGRID_FROM_EMAIL || 'no-reply@thunderstreammedia.com',
    subject,
    html,
    attachments: (attachments || []).map((a) => ({
      content: a.content, // base64
      filename: a.filename,
      type: a.type || 'application/pdf',
      disposition: 'attachment',
    })),
  });
  return { mocked: false, id: res.headers['x-message-id'] };
}

module.exports = { sendEmail };
