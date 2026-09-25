// Razorpay (spec 3.5 ticket payments). Real branch uses the Razorpay SDK;
// mock branch fabricates a fake order that the frontend short-circuits
// past the Checkout widget for (a real popup can't complete against a
// fake order id), so the full purchase flow is demoable without keys.
const crypto = require('crypto');

function isRazorpayLive() {
  return process.env.RAZORPAY_ENABLED === 'true' && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
}

async function createOrder({ amount, currency = 'INR', receipt }) {
  if (!isRazorpayLive()) {
    const id = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    console.log(`[MOCK:razorpay] would create order for ${amount} ${currency} (receipt ${receipt})`);
    return { orderId: id, amount, currency, mocked: true, keyId: null };
  }

  const Razorpay = require('razorpay');
  const client = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  const order = await client.orders.create({ amount: Math.round(amount * 100), currency, receipt });
  return { orderId: order.id, amount, currency, mocked: false, keyId: process.env.RAZORPAY_KEY_ID };
}

function verifyPayment({ orderId, paymentId, signature }) {
  if (!isRazorpayLive()) {
    console.log(`[MOCK:razorpay] auto-verifying mock payment for order ${orderId}`);
    return { valid: true, mocked: true };
  }

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return { valid: expected === signature, mocked: false };
}

module.exports = { createOrder, verifyPayment, isRazorpayLive };
