// Real (not mocked) QR generation — no external account needed.
const QRCode = require('qrcode');
const crypto = require('crypto');

function generateTicketToken() {
  return crypto.randomBytes(16).toString('hex');
}

async function generateQrDataUrl(token) {
  return QRCode.toDataURL(token, { margin: 1, width: 320 });
}

module.exports = { generateTicketToken, generateQrDataUrl };
