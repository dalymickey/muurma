/* Custom surf-spot template: debounce the greyscale map as they type, and refuse add to cart
   when "Surf spot" is empty. mu-product.js calls MuSpot.ok() on the product form submit,
   including the sticky add bar, which uses requestSubmit. */
(function () {
  const DELAY = 550;

  const srcFor = (q, zoom) =>
    'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=' + zoom + '&output=embed';

  const bind = (root) => {
    if (root.dataset.spotReady) return;
    const input = root.querySelector('[data-spot-input]');
    const frame = root.querySelector('[data-spot-map]');
    if (!input || !frame) return;
    root.dataset.spotReady = 'true';
    const fallback = (root.dataset.spotDefault || 'North Narrabeen, Sydney').trim();
    const zoom = root.dataset.spotZoom || '14';
    let timer = 0;
    let last = (input.value.trim() || fallback);
    const apply = () => {
      const q = input.value.trim() || fallback;
      if (q === last) return;
      last = q;
      frame.src = srcFor(q, zoom);
      frame.title = 'Map of ' + q;
    };
    input.addEventListener('input', () => {
      clearErr(root, input);
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, DELAY);
    });
  };

  const clearErr = (root, input) => {
    input.removeAttribute('aria-invalid');
    const err = root && root.querySelector('[data-spot-err]');
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
  };

  window.MuSpot = {
    ok: function (form, msg) {
      if (!form) return true;
      const input = form.elements['properties[Surf spot]'];
      if (!input) return true;
      const note = form.elements['properties[Local knowledge]'];
      const value = (input.value || '').trim();
      const root = input.closest('[data-spot]');
      if (value) {
        input.value = value;
        if (note) note.disabled = !(note.value || '').trim();
        clearErr(root, input);
        return true;
      }
      if (note) note.disabled = false;
      const message = input.getAttribute('data-spot-missing') || 'Enter your surf spot to add this to your bag.';
      input.setAttribute('aria-invalid', 'true');
      const err = root && root.querySelector('[data-spot-err]');
      if (err) {
        err.hidden = false;
        err.textContent = message;
      }
      if (msg) msg.textContent = message;
      input.focus({ preventScroll: true });
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
  };

  const start = () => document.querySelectorAll('[data-spot]').forEach(bind);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  document.addEventListener('shopify:section:load', start);
})();
