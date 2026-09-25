// Loads the Razorpay Checkout script on demand (not bundled — Razorpay
// requires loading it live from their CDN) and caches the promise so
// repeat ticket purchases in the same session don't re-fetch it.
let loadPromise = null;

export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Could not load Razorpay Checkout'));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}
