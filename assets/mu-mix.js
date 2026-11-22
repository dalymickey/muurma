/* Mix and match (sections/mu-mix). Tiles are toggle buttons; a pick drops its cut-out into the next free slot of the
   tray, up to data-slots. The tray keeps hidden items[][id] inputs in pick order, so the form adds the whole mix in one
   /cart/add.js request (assets/mu-add.js). Shows the average level and the running total. With recurring purchase
   options on the products, assets/mu-subs.js adds a One-time / Subscribe switch: picks then carry their own matching
   items[][selling_plan], prices turn to the plan prices and products without that plan are set aside.
   Tier savings (data-tiers, maths in assets/mu-tier-core.js): one-time picks show the tier reached, "Add 1 more to save
   10%" and the estimated total; after adding (kz:added from mu-add.js) the bag's own discount is read back and shown.
   When the bag took nothing, the claims stay hidden for the visit. Subscribe mode shows the subscription saving only. */
(() => {
  const init = (root) => {
    if (root.kzMix) return;
    root.kzMix = true;
    const max = +root.dataset.slots || 5;
    const tiles = [...root.querySelectorAll('.mu-mix__tile[data-id]')];
    const slots = [...root.querySelectorAll('.mu-mix__slot')];
    const inputs = root.querySelector('[data-inputs]');
    const add = root.querySelector('.mu-mix__add');
    const avgOut = root.querySelector('[data-avg-out]');
    const countOut = root.querySelector('[data-count-out]');
    const totalOut = root.querySelector('[data-total-out]');
    const live = root.querySelector('[data-live]');
    const lang = document.documentElement.lang || undefined;
    // Money as Liquid renders it (theme price currency setting included), read off the 123456 sample in data-money.
    let money;
    const sample = root.dataset.money || '';
    const sm = sample.match(/1(\D?)23[45](?:(\D)56)?/);
    if (sm) {
      money = { format: (v) => {
        const [i, d] = (Math.round(v * 100) / 100).toFixed(sm[2] ? 2 : 0).split('.');
        return sample.replace(sm[0], i.replace(/\B(?=(\d{3})+(?!\d))/g, sm[1]) + (d ? sm[2] + d : ''));
      } };
    } else {
      try { money = new Intl.NumberFormat(lang, { style: 'currency', currency: root.dataset.currency || 'USD' }); } catch (e) { money = { format: (v) => v.toFixed(2) }; }
    }
    const emptyAvg = avgOut ? avgOut.textContent : '';
    const core = window.kzTierCore;
    const tiers = core && root.dataset.tiers ? core.parse(root.dataset.tiers).filter((t) => t.q <= max) : [];
    const tierBox = root.querySelector('[data-tier-box]');
    const tierOut = root.querySelector('[data-tier-out]');
    const steps = [...root.querySelectorAll('.mu-mix__tierstep')];
    let noclaim = tiers.length > 0 && core.noclaim(root.dataset.key);
    let result = '';
    let picks = [];
    const maps = new Map(tiles.map((t) => [t, window.kzSubs ? window.kzSubs.parse(t.dataset.subs) : {}]));
    const subBox = root.querySelector('[data-subp]');
    const sub = window.kzSubs && subBox ? window.kzSubs.mount(subBox, [...maps.values()], () => { picks = picks.filter((t) => !blocked(t)); render(); }) : null;
    const subOn = () => !!(sub && sub.key());
    const planOf = (t) => (subOn() ? sub.plan(maps.get(t)) : null);
    const blocked = (t) => (subOn() ? !planOf(t) : t.hasAttribute('data-rq'));
    const priceOf = (t) => { const p = planOf(t); return p ? +p[1] : +t.dataset.price; };
    tiles.forEach((t) => { const pr = t.querySelector('.mu-mix__price'); if (pr) t.dataset.priceHtml = pr.innerHTML; });
    const say = (t) => { if (live) { live.textContent = ''; requestAnimationFrame(() => { live.textContent = t; }); } };
    const render = () => {
      tiles.forEach((t) => {
        const on = picks.includes(t);
        t.setAttribute('aria-pressed', on ? 'true' : 'false');
        t.classList.toggle('is-blocked', !on && picks.length >= max);
        if (t.hasAttribute('data-out')) return;
        const no = blocked(t);
        t.disabled = no;
        t.classList.toggle('is-nosub', no);
        const pr = t.querySelector('.mu-mix__price');
        // The plain price keeps its own markup (sale price and struck compare-at price).
        if (pr) { if (no || planOf(t)) pr.textContent = no ? (subOn() ? root.dataset.nosub : root.dataset.onlysub) : money.format(priceOf(t) / 100); else pr.innerHTML = t.dataset.priceHtml; }
      });
      if (sub) {
        const pc = sub.pct();
        const out = subOn() && tiles.some((t) => !t.hasAttribute('data-out') && blocked(t));
        sub.note(subOn() ? [pc > 0 ? root.dataset.subNote.replace('[p]', pc) : '', out ? root.dataset.subSome : ''].filter(Boolean).join(' ') : '');
      }
      slots.forEach((s, k) => {
        const t = picks[k];
        s.classList.toggle('is-filled', !!t);
        s.querySelector('.mu-mix__slot-item')?.remove();
        if (!t) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `mu-mix__slot-item${t.dataset.tone ? ` ${t.dataset.tone}` : ''}`;
        if (t.dataset.toneStyle) b.style.cssText = t.dataset.toneStyle;
        b.setAttribute('aria-label', root.dataset.remove.replace('[p]', t.dataset.title));
        if (t.dataset.cut) {
          const img = new Image();
          img.src = t.dataset.cut; img.alt = ''; img.width = 120; img.height = 120; img.decoding = 'async';
          b.append(img);
        } else {
          b.textContent = t.dataset.title.slice(0, 1);
        }
        const x = document.createElement('span');
        x.className = 'mu-mix__slot-x'; x.setAttribute('aria-hidden', 'true'); x.textContent = '×';
        b.append(x);
        b.addEventListener('click', () => { toggle(t); (slots[Math.min(k, picks.length - 1)]?.querySelector('button') || t).focus(); });
        s.append(b);
      });
      inputs.replaceChildren(...picks.flatMap((t, k) => {
        const id = Object.assign(document.createElement('input'), { type: 'hidden', name: `items[${k}][id]`, value: t.dataset.id });
        const q = Object.assign(document.createElement('input'), { type: 'hidden', name: `items[${k}][quantity]`, value: '1' });
        const p = planOf(t);
        return p ? [id, q, Object.assign(document.createElement('input'), { type: 'hidden', name: `items[${k}][selling_plan]`, value: p[0] })] : [id, q];
      }));
      const lv = picks.map((t) => +t.dataset.level).filter((v) => v > 0);
      if (avgOut) avgOut.textContent = lv.length ? root.dataset.avg.replace('[l]', (Math.round((lv.reduce((a, b) => a + b, 0) / lv.length) * 10) / 10).toLocaleString(lang)) : emptyAvg;
      if (countOut) countOut.textContent = root.dataset.count.replace('[c]', picks.length);
      const sum = picks.reduce((a, t) => a + priceOf(t), 0);
      if (totalOut) totalOut.textContent = picks.length ? money.format(sum / 100) : '';
      if (tierBox) {
        const show = !subOn() && !noclaim;
        tierBox.hidden = !show && !result;
        const got = show ? core.reached(tiers, picks.length) : null;
        const nx = show ? core.next(tiers, picks.length) : null;
        steps.forEach((s) => { s.hidden = !show; s.classList.toggle('is-on', !!got && +s.dataset.q <= got.q); });
        const off = got ? core.off(picks.map(priceOf), got.pct) : 0;
        tierOut.textContent = result || [
          got ? root.dataset.tierOn.replace('[p]', got.pct).replace('[a]', money.format(off / 100)) : '',
          nx ? root.dataset.tierNext.replace('[n]', nx.q - picks.length).replace('[p]', nx.pct) : '',
        ].filter(Boolean).join(' ');
        if (totalOut && off > 0) {
          totalOut.textContent = money.format((sum - off) / 100);
          const was = document.createElement('s');
          was.className = 'mu-price__was';
          was.textContent = money.format(sum / 100);
          totalOut.append(' ', was);
        }
      }
      add.disabled = picks.length === 0;
      root.style.setProperty('--fill', picks.length / max);
    };
    const toggle = (t) => {
      result = '';
      if (picks.includes(t)) {
        picks = picks.filter((p) => p !== t);
        say(root.dataset.removed.replace('[p]', t.dataset.title));
      } else if (picks.length >= max) {
        say(root.dataset.full);
        return;
      } else {
        picks.push(t);
        say(root.dataset.added.replace('[p]', t.dataset.title));
      }
      render();
    };
    tiles.forEach((t) => t.addEventListener('click', () => toggle(t)));
    // After the box goes in: what did the bag really take off these picks?
    if (tierBox) root.querySelector('form').addEventListener('kz:added', (e) => {
      if (subOn()) return;
      const ids = new Set(picks.map((t) => +t.dataset.id));
      const took = core.took(e.detail.cart || {}, ids);
      const claimed = !noclaim && core.reached(tiers, picks.length);
      if (took > 0) {
        result = root.dataset.applied.replace('[a]', money.format(took / 100));
        noclaim = false;
        core.setNoclaim(root.dataset.key, false);
      } else if (claimed) {
        result = root.dataset.none;
        noclaim = true;
        core.setNoclaim(root.dataset.key, true);
      }
      // The tier line already says it went in, so the form's own "Added to your bag" would repeat it.
      const msg = result && root.querySelector('[data-mu-add-msg]');
      if (msg) msg.textContent = '';
      render();
    });
    render();
  };
  const scan = () => document.querySelectorAll('[data-mu-mix]').forEach(init);
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
