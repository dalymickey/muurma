/* Volume tiers + option picker (snippets/mu-pp-tiers). Counts the mix against the picked tier, moves up a tier when
   the mix grows past it, fills the rest evenly, and adds every choice in one /cart/add.js request. Savings are
   estimated per line and rounded to the cent; after adding, /cart.js says what the bag really took off. With no
   discount there, savings lines are hidden for the rest of the visit (sessionStorage) so nothing is over-claimed.
   With recurring purchase options on the choices, assets/mu-subs.js adds a One-time / Subscribe switch: in subscribe
   mode each line goes in on its own matching plan, prices are the plan prices, choices without the plan are set
   aside, and the tier savings (one-time only) give way to the subscription saving. Money format, the per-line
   rounding, the bag read-back and the no-claim memory come from assets/mu-tier-core.js (shared with Build your box). */
(() => {
  if (window.kzTiers) return;
  window.kzTiers = true;
  const root = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';
  const core = window.kzTierCore;

  const init = (el) => {
    if (el.kzTiers) return;
    el.kzTiers = true;
    const money = core.moneyOf(el.dataset.money || '');
    const form = el.querySelector('[data-tiers-form]');
    const tiers = [...el.querySelectorAll('[data-tier]')];
    const chips = [...el.querySelectorAll('[data-chip]')].filter((c) => c.querySelector('[data-q]'));
    const status = el.querySelector('[data-status]');
    const total = el.querySelector('[data-total]');
    const full = el.querySelector('[data-full]');
    const add = el.querySelector('[data-add]');
    const msg = el.querySelector('[data-msg]');
    const fillBtn = el.querySelector('[data-fill]');
    if (core.noclaim(el.dataset.key)) el.classList.add('is-noclaim');
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const maps = new Map(chips.map((c) => [c, window.kzSubs ? window.kzSubs.parse(c.dataset.subs) : {}]));
    const subBox = el.querySelector('[data-subp]');
    const sub = window.kzSubs && subBox ? window.kzSubs.mount(subBox, [...maps.values()], () => update()) : null;
    const subOn = () => !!(sub && sub.key());
    const planOf = (c) => (subOn() ? sub.plan(maps.get(c)) : null);
    // Out of play: no matching plan in subscribe mode, or a subscription-only product in one-time mode.
    const blocked = (c) => (subOn() ? !planOf(c) : c.hasAttribute('data-rq'));
    const open = () => chips.filter((c) => !blocked(c));

    const qOf = (c) => Math.max(0, Math.min(99, parseInt(c.querySelector('[data-q]').value, 10) || 0));
    const count = () => chips.reduce((a, c) => a + qOf(c), 0);
    const tier = () => tiers.find((t) => t.checked) || tiers[0];
    const qtyOf = (t) => (t ? +t.value : 1);

    const update = () => {
      chips.forEach((c) => { if (blocked(c)) c.querySelector('[data-q]').value = 0; });
      const n = count();
      let t = tier();
      // A mix bigger than the tier moves to the best tier it now reaches.
      if (t && n > qtyOf(t)) {
        const best = tiers.filter((x) => qtyOf(x) <= n).pop();
        if (best && best !== t) { best.checked = true; t = best; }
      }
      const need = Math.max(0, qtyOf(t) - n);
      const pct = t ? +t.dataset.pct || 0 : 0;
      const on = subOn();
      el.classList.toggle('is-sub', on);
      let sum = 0;
      let off = 0;
      let reg = 0;
      let out = 0;
      chips.forEach((c) => {
        const no = blocked(c);
        const input = c.querySelector('[data-q]');
        const q = qOf(c);
        const p = planOf(c);
        input.value = q;
        input.disabled = no;
        c.querySelector('[data-less]').disabled = q === 0;
        c.querySelector('[data-more]').disabled = no;
        c.classList.toggle('is-on', q > 0);
        c.classList.toggle('is-nosub', no);
        const ns = c.querySelector('[data-nosub]');
        if (ns) ns.hidden = !(on && no);
        const os = c.querySelector('[data-onlysub]');
        if (os) os.hidden = !(!on && no);
        if (no) out += 1;
        reg += +c.dataset.price * q;
        const line = (p ? +p[1] : +c.dataset.price) * q;
        sum += line;
        if (!on) off += core.off([line], pct);
      });
      const claim = !el.classList.contains('is-noclaim');
      if (on) {
        if (total) total.textContent = n ? money(sum) : '';
        if (full) full.textContent = n && reg > sum ? money(reg) : '';
        const ref = chips.find((c) => planOf(c));
        const rp = ref && planOf(ref);
        el.querySelectorAll('[data-subeach]').forEach((x) => {
          x.innerHTML = rp ? `${esc(el.dataset.each.replace('[m]', money(rp[1])))}${+rp[1] < +ref.dataset.price ? ` <s class="mu-muted">${esc(money(+ref.dataset.price))}</s>` : ''}` : '';
        });
        const pc = sub.pct();
        sub.note([pc > 0 ? el.dataset.subNote.replace('[p]', pc) : '', out ? el.dataset.subSome : ''].filter(Boolean).join(' '));
      } else {
        if (sub) sub.note('');
        if (total) total.textContent = n ? money(claim ? sum - off : sum) : '';
        if (full) full.textContent = n && off && claim ? money(sum) : '';
      }
      if (status) status.textContent = need ? el.dataset.pick.replace('[n]', need) : el.dataset.ready.replace('[n]', n);
      if (add) {
        add.disabled = n === 0 || need > 0;
        add.textContent = el.dataset.addTpl.replace('[n]', Math.max(n, qtyOf(t)));
      }
      if (fillBtn) fillBtn.hidden = need === 0;
    };

    // Even spread: each extra goes to the in-stock choice with the fewest so far, in list order.
    const fill = () => {
      let need = Math.max(0, qtyOf(tier()) - count());
      const pool = open();
      if (!pool.length) return;
      while (need > 0) {
        const c = pool.reduce((a, x) => (qOf(x) < qOf(a) ? x : a), pool[0]);
        c.querySelector('[data-q]').value = qOf(c) + 1;
        need -= 1;
      }
      update();
    };

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-more], [data-less]');
      if (b) {
        const input = b.closest('[data-chip]').querySelector('[data-q]');
        input.value = Math.max(0, (parseInt(input.value, 10) || 0) + (b.hasAttribute('data-more') ? 1 : -1));
        update();
        return;
      }
      if (e.target.closest('[data-fill]')) fill();
    });
    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-q], [data-tier]')) update();
    });
    el.addEventListener('input', (e) => { if (e.target.matches('[data-q]')) update(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (add.getAttribute('aria-busy') === 'true') return;
      // Subscribe mode: each line on its own product's plan for the frequency picked (plan ids differ by group).
      const on = subOn();
      let est = 0;
      const items = open().filter((c) => qOf(c) > 0).map((c) => {
        const it = { id: +c.dataset.id, quantity: qOf(c) };
        const p = planOf(c);
        if (p) {
          it.selling_plan = +p[0];
          est += (+c.dataset.price - +p[1]) * it.quantity;
        }
        return it;
      });
      if (!items.length) return;
      const pct = +(tier().dataset.pct || 0);
      add.setAttribute('aria-busy', 'true');
      msg.textContent = '';
      msg.classList.remove('is-error');
      try {
        const res = await fetch(`${root}cart/add.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ items }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.description || data.message || el.dataset.err);
        const cart = await (await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } })).json();
        // Read back what the bag took off these choices (line discounts on the lines just added).
        const ids = new Set(items.map((i) => i.id));
        const lines = cart.items.filter((l) => ids.has(l.variant_id));
        const took = core.took(cart, ids);
        if (on) {
          // What the plans take off each delivery, read back from the bag's subscription lines.
          const plans = new Set(items.map((i) => i.selling_plan));
          const saved = lines
            .filter((l) => l.selling_plan_allocation && plans.has(l.selling_plan_allocation.selling_plan.id))
            .reduce((a, l) => a + Math.max(0, (l.selling_plan_allocation.compare_at_price || 0) - (l.selling_plan_allocation.price || 0)) * l.quantity, 0);
          msg.textContent = el.dataset.subAdded.replace('[a]', money(saved || est));
        } else if (took > 0) {
          msg.textContent = el.dataset.applied.replace('[a]', money(took));
        } else {
          msg.textContent = el.dataset.none;
          if (pct > 0) {
            el.classList.add('is-noclaim');
            core.setNoclaim(el.dataset.key, true);
          }
        }
        if (!on && took > 0) {
          el.classList.remove('is-noclaim');
          core.setNoclaim(el.dataset.key, false);
        }
        chips.forEach((c) => { c.querySelector('[data-q]').value = 0; });
        update();
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: { ...cart, mu_added: true } }));
      } catch (err) {
        msg.textContent = err.message || el.dataset.err;
        msg.classList.add('is-error');
      } finally {
        add.removeAttribute('aria-busy');
      }
    });
    update();
  };

  const scan = (scope) => scope.querySelectorAll('[data-tiers]').forEach(init);
  scan(document);
  document.addEventListener('shopify:section:load', (e) => scan(e.target));
})();
