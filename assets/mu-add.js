/* Add to bag without leaving the page, for forms marked data-mu-add (hero level picker, upsell, step either way).
   Posts the form as is to /cart/add.js, so one variant (name="id") and a whole set (items[][id]) both work, then
   tells the bag (cart:updated). Without JS the same form posts to /cart/add. */
(() => {
  if (window.kzAdd) return;
  window.kzAdd = true;
  const root = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('form[data-mu-add]');
    if (!f) return;
    e.preventDefault();
    const btn = e.submitter || f.querySelector('[type="submit"]');
    const note = f.querySelector('[data-mu-add-msg]');
    const say = (t, bad) => { if (note) { note.textContent = t; note.classList.toggle('is-error', !!bad); } };
    if (btn.getAttribute('aria-busy') === 'true') return;
    btn.setAttribute('aria-busy', 'true');
    say('');
    try {
      const res = await fetch(`${root}cart/add.js`, { method: 'POST', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: new FormData(f) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.description || data.message || f.dataset.err || '');
      const cart = await (await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } })).json();
      say(f.dataset.ok || '');
      // The form's own script can read back what the bag did (Build your box: tier savings).
      f.dispatchEvent(new CustomEvent('kz:added', { bubbles: true, detail: { cart } }));
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: { ...cart, mu_added: true } }));
      clearTimeout(f.kzT);
      f.kzT = setTimeout(() => say(''), 4000);
    } catch (err) {
      say(err.message || f.dataset.err || '', true);
    } finally {
      btn.removeAttribute('aria-busy');
    }
  });
})();
