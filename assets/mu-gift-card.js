/* Gift card page: draws the QR code (Shopify's vendor qrcode.js) and wires the print button. */
(() => {
  const el = document.getElementById('MuQr');
  if (el && window.QRCode) new QRCode(el, { text: el.dataset.identifier, width: 132, height: 132, correctLevel: QRCode.CorrectLevel?.M });
  document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
})();
