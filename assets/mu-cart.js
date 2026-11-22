/* Bag: quantity steppers, Remove, the order note and discount codes post to /cart/change.js and /cart/update.js and
   re-render every bag on the page (drawer and cart page) from the Section Rendering API, then announce the cart with
   the theme's cart:updated event (the header and tab bar badges listen). Without JS the steppers submit the bag form.
   Steppers carry a step (data-qty-step: -1 / 1), not a quantity: the new quantity is worked out from the live cart
   (/cart.js, never cached) at the moment of the click, so stale markup (a cached refresh, a page restored from the
   back/forward cache, a double tap) can never send 0 and empty the line. Changes run one at a time.
   The drawer: bag links ([data-cart-link]) open it where the cart type calls for a drawer; it's a modal <dialog>, so
   focus stays inside and Esc closes it, and focus goes back to the link that opened it. */
(() => {
  if (customElements.get('mu-cart')) return;
  const root = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';
  const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
  const bags = () => [...document.querySelectorAll('mu-cart')];

  // Re-render every bag from a sections map ({ id: html }).
  function paint(sections) {
    bags().forEach((bag) => {
      const html = sections && sections[bag.dataset.section];
      const fresh = html && parse(html).querySelector('[data-cart-body]');
      if (fresh) bag.swap(fresh);
    });
  }

  async function refresh() {
    const ids = bags().map((b) => b.dataset.section).join(',');
    if (!ids) return;
    const res = await fetch(`${window.location.pathname}?sections=${ids}`, { cache: 'no-store' });
    if (res.ok) paint(await res.json());
  }

  // One cart request at a time, in click order.
  let queue = Promise.resolve();
  const enqueue = (job) => (queue = queue.then(job, job));

  async function post(path, body) {
    const res = await fetch(`${root}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.assign(body, { sections: bags().map((b) => b.dataset.section), sections_url: window.location.pathname })),
    });
    const cart = await res.json();
    if (!res.ok) throw new Error(cart.description || cart.message || '');
    return cart;
  }

  // A page restored from the back/forward cache shows the bag as it was: bring it up to date.
  window.addEventListener('pageshow', (e) => { if (e.persisted) refresh().catch(() => {}); });

  class MuCart extends HTMLElement {
    connectedCallback() {
      this.addEventListener('click', (e) => this.onClick(e));
      this.addEventListener('change', (e) => {
        if (e.target.matches('[data-cart-note]')) this.saveNote(e.target.value);
        else if (e.target.matches('[data-gift-check]')) this.gift(e.target);
        else if (e.target.matches('[data-gift-msg]')) this.saveGiftMsg(e.target.value);
      });
      // Enter in the discount field applies the code (it must not submit the bag form, which goes to checkout).
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('[data-discount-input]')) { e.preventDefault(); this.discount(e.target); }
      });
      this.pairs();
    }

    get body() { return this.querySelector('[data-cart-body]'); }

    onClick(e) {
      const step = e.target.closest('[data-qty-step]');
      const rm = e.target.closest('[data-remove]');
      const apply = e.target.closest('[data-discount-apply]');
      const drop = e.target.closest('[data-discount-remove]');
      if (step) {
        e.preventDefault();
        if (!step.disabled && !step.closest('[aria-busy="true"]')) this.change(step.dataset.key, Number(step.dataset.qtyStep), step, Number(step.dataset.qtyInc) || 1, Number(step.dataset.qtyMin) || 1);
      } else if (rm) {
        e.preventDefault();
        this.change(rm.dataset.remove, null, rm);
      } else if (apply) {
        e.preventDefault();
        this.discount(apply);
      } else if (drop) {
        e.preventDefault();
        this.discount(drop, drop.dataset.discountRemove);
      }
    }

    // step: -1 / 1 for the stepper, null for Remove (quantity 0). inc and min: the variant's quantity rule, so a step
    // moves by the increment and stepping below the minimum removes the line.
    change(key, step, el, inc = 1, min = 1) {
      const line = el.closest('.mu-line');
      line?.setAttribute('aria-busy', 'true');
      line?.querySelectorAll('[data-qty-step]').forEach((b) => b.setAttribute('aria-disabled', 'true'));
      return enqueue(async () => {
        try {
          let quantity = 0;
          if (step !== null) {
            const live = await (await fetch(`${root}cart.js`, { cache: 'no-store', headers: { Accept: 'application/json' } })).json();
            const item = live.items.find((i) => i.key === key);
            if (!item) { await refresh(); return; }
            quantity = Math.max(0, item.quantity + step * inc);
            if (quantity < min) quantity = 0;
          }
          const cart = await post('cart/change.js', { id: key, quantity });
          // Focus goes back to the same control in the fresh markup (or the bag heading when the line is gone).
          const focus = step !== null ? `.mu-line[data-key="${key}"] [data-qty-step="${step}"]` : null;
          this.done(cart, focus);
        } catch (err) {
          line?.removeAttribute('aria-busy');
          line?.querySelectorAll('[data-qty-step]').forEach((b) => b.removeAttribute('aria-disabled'));
          this.say(err.message || this.dataset.error || '');
        }
      });
    }

    // Discount codes: the field adds a code to the ones already on the cart; a code's remove button drops it. A code
    // the cart can't use is taken off again and the reason shown under the field.
    discount(el, removeCode) {
      const box = el.closest('[data-discount]');
      const input = box?.querySelector('[data-discount-input]');
      const msg = box?.querySelector('[data-discount-msg]');
      const codes = [...(box?.querySelectorAll('[data-discount-remove]') || [])].map((b) => b.dataset.discountRemove);
      const code = removeCode ? '' : (input?.value || '').trim();
      if (!removeCode && !code) { input?.focus(); return; }
      if (code && codes.some((c) => c.toLowerCase() === code.toLowerCase())) { if (msg) msg.textContent = box.dataset.dupe || ''; return; }
      const next = removeCode ? codes.filter((c) => c !== removeCode) : [...codes, code];
      box.setAttribute('aria-busy', 'true');
      return enqueue(async () => {
        try {
          let cart = await post('cart/update.js', { discount: next.join(',') });
          let bad = false;
          if (code) {
            const hit = (cart.discount_codes || []).find((d) => d.code.toLowerCase() === code.toLowerCase());
            if (!hit || !hit.applicable) {
              bad = true;
              cart = await post('cart/update.js', { discount: codes.join(',') });
            }
          }
          this.done(cart, removeCode || bad ? '[data-discount-input]' : '[data-discount] summary', true);
          const fresh = this.querySelector('[data-discount]');
          if (fresh) fresh.open = true;
          if (bad && fresh) {
            const field = fresh.querySelector('[data-discount-input]');
            field.value = code;
            field.setAttribute('aria-invalid', 'true');
            fresh.querySelector('[data-discount-msg]').textContent = fresh.dataset.invalid.replace('__CODE__', code);
          }
        } catch (err) {
          box.removeAttribute('aria-busy');
          if (msg) msg.textContent = err.message || this.dataset.error || '';
        }
      });
    }

    // Gift wrap on or off: the gift wrap variant goes to quantity 1 or 0 (taking it off also clears the gift message).
    gift(box) {
      const wrap = box.closest('[data-gift]');
      wrap?.setAttribute('aria-busy', 'true');
      const on = box.checked;
      return enqueue(async () => {
        try {
          const body = { updates: { [wrap.dataset.variant]: on ? 1 : 0 } };
          if (!on) body.attributes = { 'Gift message': '' };
          this.done(await post('cart/update.js', body), '[data-gift-check]');
        } catch (err) {
          wrap?.removeAttribute('aria-busy');
          box.checked = !on;
          this.say(err.message || this.dataset.error || '');
        }
      });
    }

    saveGiftMsg(msg) {
      return enqueue(async () => {
        try {
          await fetch(`${root}cart/update.js`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attributes: { 'Gift message': msg } }) });
          bags().forEach((b) => { if (b !== this) b.querySelectorAll('[data-gift-msg]').forEach((t) => { t.value = msg; }); });
        } catch (err) { /* the message is sent with the form at checkout too */ }
      });
    }

    done(cart, focus, quiet) {
      paint(cart.sections);
      const target = (focus && this.querySelector(focus)) || this.querySelector('.mu-line [data-remove]') || this.querySelector('[data-cart-close], .mu-cart__title, .mu-cart__empty .mu-btn');
      if (target) { if (!target.hasAttribute('tabindex') && !target.matches('a, button, input, summary')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
      if (!quiet) this.say(this.dataset.updated || '');
      delete cart.sections;
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: Object.assign(cart, { mu_bag: true }) }));
      this.pairs(cart);
      // Gift wrap on its own isn't an order: when it's the last thing in the bag, take it off too.
      const gv = Number(this.querySelector('[data-gift]')?.dataset.variant);
      if (gv && cart.items?.length && cart.items.every((i) => i.variant_id === gv)) {
        enqueue(async () => { try { this.done(await post('cart/update.js', { updates: { [gv]: 0 }, attributes: { 'Gift message': '' } }), null, true); } catch (err) { /* left as is */ } });
      }
    }

    saveNote(note) {
      return enqueue(async () => {
        try {
          await fetch(`${root}cart/update.js`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) });
          // Keep the other bag (drawer or page) in step without re-rendering this one under the shopper's cursor.
          bags().forEach((b) => { if (b !== this) b.querySelectorAll('[data-cart-note]').forEach((t) => { t.value = note; }); });
        } catch (err) { /* the note is sent with the form at checkout too */ }
      });
    }

    say(msg) {
      const s = this.querySelector('[data-cart-status]');
      if (!s) return;
      s.textContent = '';
      requestAnimationFrame(() => { s.textContent = msg; });
    }

    swap(fresh) {
      // Keep the note and discount accordions as the shopper left them.
      const open = [...this.querySelectorAll('details[data-keep]')].filter((d) => d.open).map((d) => d.dataset.keep);
      this.body.replaceWith(document.importNode(fresh, true));
      open.forEach((k) => { const d = this.querySelector(`details[data-keep="${k}"]`); if (d) d.open = true; });
      this.pairs();
      if (window.MuStore) window.MuStore.refresh();
    }

    // Pairs well. Drawer: a compact row from the mu-cart-pairs section. Cart page: refresh the Pairs well band.
    async pairs(cart) {
      const slot = this.querySelector('[data-pairs="row"]');
      if (!cart && !slot) return;
      const first = cart ? cart.items[0]?.product_id : slot.dataset.product;
      const band = !this.closest('dialog') && document.querySelector('.mu-cart-pairs[data-rel]');
      if (!first) { if (band) band.replaceChildren(); return; }
      const sid = slot ? 'mu-cart-pairs' : band && cart ? band.dataset.section : null;
      if (!sid) return;
      try {
        const res = await fetch(`${root}recommendations/products?section_id=${sid}&product_id=${first}&limit=8&intent=related`);
        const doc = parse(await res.text());
        if (slot) {
          const tpl = doc.querySelector('template[data-pair-row]');
          if (!tpl) return;
          const head = document.createElement('h3');
          head.className = 'mu-pairs__title';
          head.textContent = doc.querySelector('.mu-fc__title')?.textContent || '';
          slot.replaceChildren(head, document.importNode(tpl.content, true));
          slot.hidden = false;
        } else {
          const next = doc.querySelector('[data-rel]');
          if (next) band.replaceChildren(...next.childNodes);
        }
      } catch (err) { /* no pairs this time */ }
    }
  }
  customElements.define('mu-cart', MuCart);

  class MuCartDrawer extends HTMLElement {
    connectedCallback() {
      this.dialog = this.querySelector('[data-drawer]');
      this.mq = window.matchMedia('(max-width: 989px)');
      document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-cart-link]');
        if (!link || !this.useDrawer() || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        this.open(link);
      });
      this.dialog.addEventListener('click', (e) => {
        if (e.target === this.dialog || e.target.closest('[data-cart-close]')) this.close();
        else if (e.target.closest('[data-cart-keep]')) { e.preventDefault(); this.close(); }
      });
      this.dialog.addEventListener('close', () => {
        document.documentElement.classList.remove('mu-locked');
        this.opener?.focus();
      });
      // Keep Tab inside the sheet (the modal dialog already makes the page inert; this also wraps at the ends).
      this.dialog.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const f = [...this.dialog.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, summary, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
      // A cart change from elsewhere (product page, quick add): bring the drawer up to date.
      // After an add to cart, the drawer can open itself (theme setting, only where the drawer is in use).
      document.addEventListener('cart:updated', (e) => {
        if (e.detail?.mu_bag) return;
        const show = e.detail?.mu_added && this.dataset.openOnAdd === 'true' && this.useDrawer();
        refresh().catch(() => {}).finally(() => {
          if (!show || this.dialog.open) return;
          document.querySelectorAll('dialog[open]:not([data-mu-cookie])').forEach((d) => d !== this.dialog && d.close());
          this.open(document.activeElement);
        });
      });
      // Leaving the drawer layout (rotating to desktop with "drawer on phones") closes it.
      this.mq.addEventListener?.('change', () => { if (!this.useDrawer() && this.dialog.open) this.close(); });
    }

    useDrawer() {
      return this.dataset.mode === 'drawer' || (this.dataset.mode === 'split' && this.mq.matches);
    }

    open(opener) {
      this.opener = opener;
      this.dialog.showModal();
      document.documentElement.classList.add('mu-locked');
      const target = this.dialog.querySelector('[data-cart-close]');
      target?.focus();
    }

    close() { this.dialog.close(); }
  }
  customElements.define('mu-cart-drawer', MuCartDrawer);
})();
