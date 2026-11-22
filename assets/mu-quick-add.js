/* Quick view and quick buy: a [data-quick-add] button (the product card's quick view button, the bag's pairs, the video shop and
   the product page's complementary products) opens the quick view dialog for that product. The body is the
   mu-quick-add section, rendered for the product with the Section Rendering API. Adding posts to /cart/add.js and
   then announces the new cart with the theme's cart:updated event. Closing returns focus to the button. */
(() => {
  const dialog = document.querySelector('[data-qa-dialog]');
  if (!dialog) return;
  // Sections that need quick view on pages without it (Stage, Image hotspots, Image gallery) each bring the dialog and
  // this file, so it can load more than once on a page: only the first copy wires up.
  if (window.kzQA) return;
  window.kzQA = true;
  const body = dialog.querySelector('[data-qa-body]');
  const root = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';
  let opener = null;

  // Fetch quick view for a product URL and show it. option_values (combined listings) picks the starting values.
  async function load(href, optionValues) {
    // Recommendation links already carry a query string (pr_rec_id and friends), so add the section to it.
    const url = new URL(href, window.location.href);
    url.searchParams.set('section_id', 'mu-quick-add');
    if (optionValues) url.searchParams.set('option_values', optionValues);
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const form = doc.querySelector('[data-qa-form]');
    if (!form) throw new Error('empty');
    pauseAll();
    body.replaceChildren(document.importNode(form, true));
    const fresh = body.querySelector('[data-qa-form]');
    wire(fresh);
    return fresh;
  }

  // Quick buy: a card button with data-quick-buy (a product with only one variant, see snippets/mu-card) adds its variant
  // straight to the bag: the B2B minimum (data-qty) or 1. The bag drawer then opens (Cart > Open the bag after adding),
  // and the card's status line says it was added, or why it couldn't be (sold out, quantity limits).
  async function quickBuy(btn) {
    if (btn.getAttribute('aria-busy') === 'true') return;
    const note = btn.parentElement.querySelector('[data-qb-msg]');
    const say = (text, bad) => { if (note) { note.textContent = text; note.classList.toggle('is-error', !!bad); } };
    const s = { added: dialog.dataset.qbAdded, error: dialog.dataset.qbError };
    clearTimeout(btn.kzNote);
    say('');
    btn.setAttribute('aria-busy', 'true');
    try {
      const res = await fetch(`${root}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ items: [{ id: +btn.dataset.quickBuy, quantity: Math.max(1, +btn.dataset.qty || 1) }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.description || data.message || s.error || '');
      const cart = await (await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } })).json();
      say(s.added || '');
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: { ...cart, mu_added: true } }));
      btn.kzNote = setTimeout(() => say(''), 4000);
    } catch (err) {
      say(err.message || s.error || '', true);
    } finally {
      btn.removeAttribute('aria-busy');
    }
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-quick-add]');
    if (!btn) return;
    e.preventDefault();
    if (btn.dataset.quickBuy) { quickBuy(btn); return; }
    opener = btn;
    btn.setAttribute('aria-busy', 'true');
    try {
      await load(btn.dataset.quickAdd);
      // Opened with a pointer: focus the sheet itself rather than its first button, so WebKit doesn't ring the close
      // button. From the keyboard (detail 0) the sheet isn't focusable, so the first button gets focus, ring and all.
      if (e.detail) body.tabIndex = -1; else body.removeAttribute('tabindex');
      dialog.showModal();
      if (e.detail) body.focus({ preventScroll: true });
    } catch (err) {
      window.location.href = btn.dataset.quickAdd;
    } finally {
      btn.removeAttribute('aria-busy');
    }
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-qa-close]')) dialog.close();
  });
  dialog.addEventListener('close', () => {
    pauseAll();
    // Drop a playing YouTube or Vimeo player so it stops.
    body.querySelectorAll('[data-qv-defer] iframe, [data-qv-model] > .shopify-model-viewer-ui, [data-qv-model] > model-viewer').forEach((f) => f.remove());
    body.querySelectorAll('[data-qv-defer].is-on').forEach((d) => d.classList.remove('is-on'));
    if (opener) opener.focus();
  });

  // 3D models: Shopify's model viewer UI (the same loader as the product page), then the model takes focus.
  function model(node) {
    if (!node) return;
    if (!document.getElementById('MuModelViewerCss')) {
      const css = document.createElement('link');
      css.id = 'MuModelViewerCss';
      css.rel = 'stylesheet';
      css.href = '//cdn.shopify.com/shopifycloud/model-viewer-ui/assets/v1.0/model-viewer-ui.css';
      document.head.appendChild(css);
    }
    if (!(window.Shopify && Shopify.loadFeatures)) return;
    Shopify.loadFeatures([{ name: 'model-viewer-ui', version: '1.0', onLoad: (err) => {
      if (err || !window.Shopify.ModelViewerUI) return;
      const ui = new Shopify.ModelViewerUI(node);
      try { ui.play(); } catch (e) { /* the viewer stays usable by hand */ }
    } }]);
    node.focus({ preventScroll: true });
  }

  function pauseAll() {
    body.querySelectorAll('video').forEach((vid) => vid.pause());
  }

  // Slider ends: a button with nowhere to go (atEnd) is disabled and fades out (.is-end), so it is out of the tab order
  // and hidden from assistive tech. If it had focus, focus moves to the other button, or failing that to the fallback.
  function kzEnds(btns, atEnd, fallback) {
    const was = document.activeElement;
    btns.forEach((b) => {
      const off = !!atEnd(b);
      b.disabled = off;
      b.classList.toggle('is-end', off);
      if (off) b.setAttribute('aria-hidden', 'true'); else b.removeAttribute('aria-hidden');
    });
    if (btns.includes(was) && was.disabled) {
      const other = btns.find((b) => !b.disabled);
      (other || fallback)?.focus({ preventScroll: true });
    }
  }

  // Quick view gallery: a scroll-snap track (swipe on touch), previous / next buttons and thumbnails (dots on phones).
  function gallery(form) {
    const track = form.querySelector('[data-qv-track]');
    if (!track) return () => {};
    const slides = [...track.querySelectorAll('[data-qv-slide]')];
    const thumbs = [...form.querySelectorAll('[data-qv-goto]')];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = [...form.querySelectorAll('[data-qv-step]')];
    let now = 0;
    // No looping: the previous button hides on the first item and next on the last (see kzEnds).
    const ends = () => kzEnds(steps, (b) => (+b.dataset.qvStep < 0 ? now <= 0 : now >= slides.length - 1), track);
    const go = (i, smooth = true) => {
      if (!slides.length) return;
      now = Math.max(0, Math.min(slides.length - 1, i));
      ends();
      track.scrollTo({ left: slides[now].offsetLeft - track.offsetLeft, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    };
    const mark = () => {
      const w = track.clientWidth || 1;
      const i = Math.round(track.scrollLeft / w);
      if (i !== now) slides.forEach((s, k) => k !== i && s.querySelector('video') && s.querySelector('video').pause());
      now = i;
      thumbs.forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
      ends();
    };
    ends();
    let raf = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(mark); }, { passive: true });
    thumbs.forEach((b) => b.addEventListener('click', () => go(+b.dataset.qvGoto)));
    steps.forEach((b) => b.addEventListener('click', () => go(now + +b.dataset.qvStep)));
    track.addEventListener('keydown', (e) => {
      if (e.target !== track) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(now + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(now - 1); }
    });
    form.querySelectorAll('[data-qv-play]').forEach((b) => b.addEventListener('click', () => {
      const box = b.closest('[data-qv-defer]');
      box.append(box.querySelector('template').content.cloneNode(true));
      box.classList.add('is-on');
      if ('qvModel' in box.dataset) { model(box.querySelector('model-viewer')); return; }
      const frame = box.querySelector('iframe');
      if (frame) frame.focus();
    }));
    // Show the chosen variant's image.
    return (mediaId) => {
      const k = slides.findIndex((s) => s.dataset.mediaId === String(mediaId));
      if (k > -1 && k !== now) go(k);
    };
  }

  function wire(form) {
    const variants = JSON.parse(form.querySelector('[data-qa-variants]').textContent);
    const t = JSON.parse(form.querySelector('[data-qa-strings]').textContent);
    const idInput = form.querySelector('[data-qa-id]');
    const add = form.querySelector('[data-qa-add]');
    const label = form.querySelector('[data-qa-label]');
    const price = form.querySelector('[data-qa-price]');
    const msg = form.querySelector('[data-qa-msg]');
    const radios = [...form.querySelectorAll('[data-qa-option]')];
    const show = gallery(form);

    const current = () => {
      const picked = [];
      radios.forEach((r) => { if (r.checked) picked[+r.dataset.qaOption] = r.value; });
      return variants.find((v) => v.options.every((o, i) => o === picked[i]));
    };
    const update = (changed) => {
      const v = current();
      add.disabled = !v || !v.available;
      label.textContent = v && v.available ? (v.pre ? t.preorder : t.add) : t.soldOut; // pre: out of stock, still selling (Theme settings > Pre-order)
      if (v) { idInput.value = v.id; price.textContent = v.price; if (v.media && changed) show(v.media); }
      msg.textContent = '';
      // Shopify lists store stock only for the first variant here; fetch the rest from the pickup section.
      const pickEl = form.querySelector('[data-qa-pick]');
      if (window.MuStore) {
        if (v && v.pick && !v.pick.length && form.dataset.url) {
          pickEl.hidden = true;
          window.MuStore.spotsFor(form.dataset.url, v.id).then((spots) => { if (current() === v) window.MuStore.qaLine(pickEl, spots, !v.available); });
        } else window.MuStore.qaLine(pickEl, v && v.pick, !!v && !v.available);
      }
      // Grey out values in the last option that have no available variant with the other picks.
      const last = Math.max(...radios.map((r) => +r.dataset.qaOption));
      radios.filter((r) => +r.dataset.qaOption === last).forEach((r) => {
        const picks = radios.filter((x) => x.checked && +x.dataset.qaOption !== last);
        const ok = variants.some((v2) => v2.available && v2.options[last] === r.value && picks.every((p) => v2.options[+p.dataset.qaOption] === p.value));
        r.disabled = !ok;
      });
    };
    // Combined listings: a value that belongs to another product (data-product-url) loads that product's sheet.
    const here = new URL(form.dataset.url, window.location.href).pathname;
    radios.forEach((r) => r.addEventListener('change', async () => {
      const to = r.dataset.productUrl;
      if (to && new URL(to, window.location.href).pathname !== here) {
        const picked = radios.filter((x) => x.checked && x.dataset.valueId).map((x) => x.dataset.valueId);
        form.setAttribute('aria-busy', 'true');
        try {
          const fresh = await load(to, picked.join(','));
          const back = fresh.querySelector(`[data-value-id="${r.dataset.valueId}"]`) || fresh.querySelector('[data-qa-close]');
          if (back) back.focus();
        } catch (err) {
          window.location.href = to;
        }
        return;
      }
      update(true);
    }));
    if (radios.length) update();
    else if (window.MuStore) window.MuStore.qaLine(form.querySelector('[data-qa-pick]'), variants[0] && variants[0].pick, !!variants[0] && !variants[0].available);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      add.disabled = true;
      // B2B quantity rules: add the variant's minimum (qmin) rather than 1, so the add isn't refused.
      const picked = variants.find((x) => x.id === +idInput.value);
      try {
        const res = await fetch(`${root}cart/add.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items: [{ id: +idInput.value, quantity: (picked && picked.qmin) || 1 }] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.description || t.error);
        const cart = await (await fetch(`${root}cart.js`)).json();
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: { ...cart, mu_added: true } }));
        msg.textContent = t.added;
        setTimeout(() => dialog.open && dialog.close(), 1200);
      } catch (err) {
        msg.textContent = err.message || t.error;
      } finally {
        add.disabled = false;
      }
    });
  }
})();
