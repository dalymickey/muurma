/* Product page and featured product: variant picking, the option chip tip, gallery, quantity
   stepper, purchase options, add to cart, gift card recipient, local pickup, complementary products, share, notify me, release flip and the
   phone add bar. Each piece is optional (it comes from a block). Variant data, strings and settings come from JSON blocks in the section. */
(() => {
  const root = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';

  function init(pp) {
    if (pp.dataset.ready) return;
    pp.dataset.ready = '1';
    const json = (sel) => JSON.parse(pp.querySelector(sel).textContent);
    const variants = json('[data-variants]');
    const t = json('[data-strings]');
    const cfg = json('[data-config]');
    const radios = [...pp.querySelectorAll('[data-option]')];
    const $ = (sel) => [...pp.querySelectorAll(sel)].find((n) => !n.closest('[data-tiers]')) || null;
    const idInput = $('[data-id]');
    const form = $('[data-form]');
    const add = $('[data-add]');
    const addLabel = $('[data-add-label]');
    const msg = $('[data-msg]');
    const priceWrap = $('[data-price-wrap]');
    const saleBadge = $('[data-sale-badge]');
    const saleBadgeLabel = $('[data-sale-badge-label]');
    const stock = $('[data-stock]');
    const notify = $('[data-notify]');
    const notifyTags = $('[data-notify-tags]');
    const bar = $('[data-bar]');
    const barBtn = $('[data-bar-btn]');
    const barSum = $('[data-bar-sum]');
    const barImg = $('[data-bar-img]');
    const slides = $('[data-slides]');
    const slideEls = [...pp.querySelectorAll('[data-slide]')];
    const qty = $('[data-qty]');
    const qtyRule = $('[data-qty-rule]');
    const breaksBox = $('[data-qty-breaks]');
    const breaksBody = $('[data-qty-breaks-body]');
    const dyn = $('[data-dyn]');
    const unit = $('[data-unit]');
    const termsId = $('[data-terms-id]');
    const skuWrap = $('[data-sku-wrap]');
    const sku = $('[data-sku]');
    const pickup = $('[data-pickup]');
    const planInput = $('[data-plan-input]');
    const stockLevel = $('[data-stock-level]');
    const noHistory = pp.hasAttribute('data-no-history');
    let coming = pp.hasAttribute('data-release');
    const noVariants = radios.length === 0;

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const picks = () => {
      const p = [];
      radios.forEach((r) => { if (r.checked || r.type === 'hidden') p[+r.dataset.option] = r.value; });
      return p;
    };
    const current = () => {
      if (noVariants) return variants[0];
      const p = picks();
      return variants.find((v) => v.options.every((o, i) => o === p[i]));
    };
    // Level block (snippets/mu-pp-level): when a variant carries its own level (lv), the rail, its title and name, and the
    // product page's level colours follow the picked variant; variants without one show the product's level.
    const meter = $('[data-meter]');
    const meterNames = meter ? meter.dataset.names.split('|') : [];
    const setLevel = (v) => {
      if (!meter) return;
      const n = +meter.dataset.n || 0;
      const l = Math.min(n, v && v.lv > 0 ? v.lv : +meter.dataset.base || 0);
      if (String(l) === meter.dataset.lv) return;
      meter.dataset.lv = l;
      const tag = (el) => {
        el.className = el.className.replace(/\s*\bmu-h-\d+\b/g, '');
        if (l > 0) el.classList.add(`mu-h-${l}`);
      };
      tag(meter);
      if (/\bmu-h-\d+\b/.test(pp.className) || !pp.classList.contains('mu-pp--feature')) tag(pp);
      meter.hidden = l === 0;
      if (!l) return;
      const title = meter.querySelector('[data-meter-title]');
      if (title) title.textContent = meter.dataset.title.replace('__L__', l);
      const name = meter.querySelector('[data-meter-name]');
      if (name) name.textContent = meterNames[l - 1] || '';
      meter.querySelectorAll('.mu-meter__seg').forEach((seg, k) => {
        const i = k + 1;
        seg.classList.toggle('is-past', i < l);
        seg.classList.toggle('is-now', i === l);
        seg.querySelector('b')?.remove();
        if (i === l) { const b = document.createElement('b'); b.textContent = i; seg.append(b); }
      });
    };
    const lowCount = (v) => (v && !coming && cfg.low > 0 && v.available && v.qty != null && v.qty > 0 && v.qty <= cfg.low ? v.qty : 0);

    // ---------- Gallery ----------
    const dots = [...pp.querySelectorAll('[data-goto]')];
    const countNow = $('[data-count-now]');
    const goTo = (i, smooth = true) => {
      if (!slides || !slideEls[i]) return;
      slides.scrollTo({ left: slideEls[i].offsetLeft, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
    };
    const markSlide = (i) => {
      dots.forEach((d) => (+d.dataset.goto === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
      if (countNow) countNow.textContent = i + 1;
    };
    dots.forEach((d) => d.addEventListener('click', () => goTo(+d.dataset.goto)));
    if (slides && slideEls.length > 1) {
      let raf = 0;
      slides.addEventListener('scroll', () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => markSlide(Math.round(slides.scrollLeft / slides.clientWidth)));
      }, { passive: true });
      slides.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const i = Math.round(slides.scrollLeft / slides.clientWidth) + (e.key === 'ArrowRight' ? 1 : -1);
        goTo(Math.max(0, Math.min(slideEls.length - 1, i)));
      });
    }

    // ---------- Zoom ----------
    // The magnifier (or a click on an image) opens a full-screen dialog of every image, each contained in the viewport,
    // scrolled to the one in view. A click or tap zooms an image to full resolution (its own pixel width, and at least
    // twice the fitted size), panned to the point clicked; the item then scrolls to every edge. Arrow keys and the
    // up/down buttons step between images; Esc and the close button close it. Pinch zoom is left to the browser.
    const zoomDlg = $('[data-zoom]');
    if (zoomDlg) {
      const zoomBtn = $('[data-zoom-open]');
      const items = [...zoomDlg.querySelectorAll('[data-zoom-item]')];
      const list = zoomDlg.querySelector('.mu-zoom__list');
      const steps = [...zoomDlg.querySelectorAll('[data-zoom-step]')];
      const zoomIndex = () => Math.round(list.scrollTop / Math.max(1, list.clientHeight));
      const unzoom = (f) => { f.classList.remove('is-zoomed'); f.style.removeProperty('--zw'); };
      const syncSteps = () => {
        const i = zoomIndex();
        // No looping: the button with nowhere to go is disabled and fades out (.is-end); focus it held moves to the
        // other button, or the close button.
        const was = document.activeElement;
        steps.forEach((b) => {
          const off = b.dataset.zoomStep === '-1' ? i <= 0 : i >= items.length - 1;
          b.disabled = off;
          b.classList.toggle('is-end', off);
          if (off) b.setAttribute('aria-hidden', 'true'); else b.removeAttribute('aria-hidden');
        });
        if (steps.includes(was) && was.disabled) (steps.find((b) => !b.disabled) || zoomDlg.querySelector('[data-zoom-close]'))?.focus({ preventScroll: true });
      };
      const showItem = (i, smooth) => {
        i = Math.max(0, Math.min(items.length - 1, i));
        items.forEach((f, j) => { if (j !== i && f.classList.contains('is-zoomed')) unzoom(f); });
        list.scrollTo({ top: items[i].offsetTop, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
        const img = items[i].querySelector('img');
        if (img) img.loading = 'eager';
      };
      const openZoom = (id) => {
        zoomDlg.showModal();
        const i = Math.max(0, items.findIndex((f) => f.dataset.zoomItem === String(id)));
        showItem(i, false);
        syncSteps();
      };
      const currentId = () => {
        const i = slides ? Math.round(slides.scrollLeft / Math.max(1, slides.clientWidth)) : 0;
        return slideEls[i]?.dataset.mediaId;
      };
      zoomBtn?.addEventListener('click', () => openZoom(currentId()));
      slideEls.forEach((s) => {
        const img = s.querySelector('img.mu-pp__img:not(.mu-pp__poster)');
        if (img) img.addEventListener('click', () => openZoom(s.dataset.mediaId));
      });
      zoomDlg.querySelector('[data-zoom-close]')?.addEventListener('click', () => zoomDlg.close());
      zoomDlg.addEventListener('close', () => { items.forEach(unzoom); zoomBtn?.focus(); });
      steps.forEach((b) => b.addEventListener('click', () => { showItem(zoomIndex() + Number(b.dataset.zoomStep), true); }));
      list?.addEventListener('scroll', () => requestAnimationFrame(syncSteps), { passive: true });
      zoomDlg.addEventListener('keydown', (e) => {
        if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
        const zoomed = items[zoomIndex()]?.classList.contains('is-zoomed');
        let d = 0;
        if (e.key === 'ArrowRight' || e.key === 'PageDown') d = 1;
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') d = -1;
        if (!zoomed && (e.key === 'ArrowDown')) d = 1;
        if (!zoomed && (e.key === 'ArrowUp')) d = -1;
        if (d) { e.preventDefault(); showItem(zoomIndex() + d, true); }
      });
      items.forEach((f) => f.addEventListener('click', (e) => {
        const img = f.querySelector('img');
        if (!img) return;
        if (f.classList.contains('is-zoomed')) { unzoom(f); return; }
        // Click point as a fraction of the drawn (contained) image, so the pan lands on what was clicked.
        const box = img.getBoundingClientRect();
        const ratio = (img.naturalWidth && img.naturalHeight) ? img.naturalWidth / img.naturalHeight : box.width / Math.max(1, box.height);
        let dw = box.width, dh = box.width / ratio;
        if (dh > box.height) { dh = box.height; dw = dh * ratio; }
        const left = box.left + (box.width - dw) / 2, top = box.top + (box.height - dh) / 2;
        const x = Math.max(0, Math.min(1, (e.clientX - left) / dw));
        const y = Math.max(0, Math.min(1, (e.clientY - top) / dh));
        const full = Math.min(Number(f.dataset.w) || 2400, 2400);
        const w = Math.round(Math.max(full, dw * 2));
        img.sizes = `${Math.ceil(w)}px`;
        img.loading = 'eager';
        f.style.setProperty('--zw', `${w}px`);
        f.classList.add('is-zoomed');
        f.scrollLeft = x * f.scrollWidth - f.clientWidth / 2;
        f.scrollTop = y * f.scrollHeight - f.clientHeight / 2;
      }));
    }

    // ---------- Video ----------
    // Product videos swap the native player for the theme's play/pause and sound buttons; a click on the video toggles
    // play. Videos pause when swiped away.
    const vids = [];
    slideEls.forEach((s) => {
      const vid = s.querySelector('video.mu-pp__vid');
      const ctl = s.querySelector('[data-vctl]');
      if (!vid || !ctl) return;
      vid.controls = false;
      vid.removeAttribute('controls');
      ctl.hidden = false;
      const play = ctl.querySelector('[data-v-play]');
      const mute = ctl.querySelector('[data-v-mute]');
      const sync = () => {
        const on = !vid.paused;
        play.classList.toggle('is-playing', on);
        play.setAttribute('aria-label', on ? play.dataset.pause : play.dataset.play);
        mute.classList.toggle('is-sound', !vid.muted);
        mute.setAttribute('aria-label', vid.muted ? mute.dataset.unmute : mute.dataset.mute);
      };
      const toggle = () => { if (vid.paused) vid.play().catch(() => {}); else vid.pause(); };
      play.addEventListener('click', toggle);
      vid.addEventListener('click', toggle);
      mute.addEventListener('click', () => { vid.muted = !vid.muted; sync(); });
      ['play', 'pause', 'volumechange'].forEach((ev) => vid.addEventListener(ev, sync));
      sync();
      vids.push([s, vid]);
    });
    if (vids.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) vids.forEach(([s, vid]) => { if (s === e.target && !vid.paused) vid.pause(); });
      }), { threshold: 0.5 });
      vids.forEach(([s]) => io.observe(s));
    }

    // ---------- External video and 3D models ----------
    // Each starts as a poster with the theme's button; the YouTube / Vimeo player or Shopify's model viewer is only
    // put in when asked for. A YouTube or Vimeo player swiped out of view goes back to its poster, which stops it.
    const defers = [...pp.querySelectorAll('[data-defer]')];
    const loadDefer = (box) => {
      if (box.classList.contains('is-loaded')) return;
      const node = box.querySelector('template').content.firstElementChild.cloneNode(true);
      box.appendChild(node);
      box.classList.add('is-loaded');
      if (box.dataset.defer === 'model') {
        if (!document.getElementById('MuModelViewerCss')) {
          const css = document.createElement('link');
          css.id = 'MuModelViewerCss';
          css.rel = 'stylesheet';
          css.href = '//cdn.shopify.com/shopifycloud/model-viewer-ui/assets/v1.0/model-viewer-ui.css';
          document.head.appendChild(css);
        }
        if (window.Shopify && Shopify.loadFeatures) {
          Shopify.loadFeatures([{ name: 'model-viewer-ui', version: '1.0', onLoad: (err) => {
            if (err || !window.Shopify.ModelViewerUI) return;
            const ui = new Shopify.ModelViewerUI(node);
            try { ui.play(); } catch (e) { /* the viewer stays usable by hand */ }
          } }]);
        }
      } else {
        node.focus({ preventScroll: true });
      }
    };
    defers.forEach((box) => box.querySelector('[data-defer-go]')?.addEventListener('click', () => loadDefer(box)));
    if (defers.length && 'IntersectionObserver' in window) {
      const dio = new IntersectionObserver((es) => es.forEach((e) => {
        const box = e.target;
        if (e.isIntersecting || box.dataset.defer !== 'video' || !box.classList.contains('is-loaded')) return;
        box.querySelector('iframe')?.remove();
        box.classList.remove('is-loaded');
      }), { threshold: 0.5 });
      defers.forEach((box) => dio.observe(box));
    }
    // "View in your space": Shopify XR shows the button only on phones that can place a model.
    const xrJson = $('[data-xr-models]');
    if (xrJson && window.Shopify && Shopify.loadFeatures) {
      const models = JSON.parse(xrJson.textContent);
      const setupXR = (err) => {
        if (err) return;
        if (!window.ShopifyXR) { document.addEventListener('shopify_xr_initialized', () => setupXR(), { once: true }); return; }
        window.ShopifyXR.addModels(models);
        window.ShopifyXR.setupXRElements();
      };
      Shopify.loadFeatures([{ name: 'shopify-xr', version: '1.0', onLoad: setupXR }]);
    }

    // ---------- Variant update ----------
    // Price of a variant, or of its plan when a purchase option is picked: [price, compare at price].
    const planId = () => (planInput && !planInput.disabled && planInput.value ? planInput.value : '');
    const priceOf = (v) => {
      const plan = planId() && v.plans && v.plans[planId()];
      return plan ? plan : [v.price, v.compare];
    };
    // Money in the store's format, read off a sample amount ("$12,345.67", "12.345,67 €", "¥12,346"), for the
    // add button's quantity × price total.
    const money = (cents) => {
      const m = String(cfg.fmt || '').match(/\d[\d.,'\s\u00a0\u202f]*\d/);
      if (!m) return '';
      const num = m[0];
      const dec = /[.,]\d{2}$/.test(num) ? num.charAt(num.length - 3) : '';
      const th = ((dec ? num.slice(0, -3) : num).match(/\D/) || [''])[0];
      const [i, f] = (dec ? (cents / 100).toFixed(2) : String(Math.round(cents / 100))).split('.');
      return cfg.fmt.slice(0, m.index) + i.replace(/\B(?=(\d{3})+(?!\d))/g, th) + (f ? dec + f : '') + cfg.fmt.slice(m.index + num.length);
    };
    const qtyNow = () => Math.max(1, +(qty && qty.value) || 1);
    // Volume pricing: the price break the quantity falls in ([min quantity, cents, price]), or none below the first.
    const tierOf = (v, n) => {
      let hit = null;
      (v.breaks || []).forEach((b) => { if (n >= b[0]) hit = b; });
      return hit;
    };
    // Button price: the variant (or plan) price times the quantity picked.
    const totalOf = (v) => {
      const plan = planId() && v.plans && v.plans[planId()];
      const n = qtyNow();
      const tier = plan ? null : tierOf(v, n);
      if (n === 1 && !tier) return priceOf(v)[0];
      const cents = plan ? plan[2] : tier ? tier[1] : v.cents;
      return cents == null ? priceOf(v)[0] : money(cents * n);
    };
    const priceHtml = (v) => {
      const [now, was] = priceOf(v);
      return was
        ? `<span class="mu-price mu-price--sale" data-price><span class="visually-hidden">${esc(t.salePrice)}</span><span class="mu-price__now">${esc(now)}</span><span class="visually-hidden">${esc(t.regularPrice)}</span><s class="mu-price__was">${esc(was)}</s></span>`
        : `<span class="mu-price" data-price>${esc(now)}</span>`;
    };
    const saleLabelOf = (v) => {
      const [now, was] = priceOf(v);
      if (!v || !was) return '';
      if (cfg.saleBadge === 'percent') {
        const plan = planId() && v.plans && v.plans[planId()];
        const nowC = plan ? plan[2] : v.cents;
        const wasC = v.compareCents;
        if (wasC && nowC && wasC > nowC) {
          const pctOff = Math.round((wasC - nowC) * 100 / wasC);
          if (pctOff > 0) return String(t.salePercent || '{{ amount }}% off').replace('__N__', String(pctOff)).replace('{{ amount }}', String(pctOff));
        }
      }
      return t.sale || 'Sale';
    };
    const refreshSaleBadge = (v) => {
      if (!saleBadge) return;
      const label = saleLabelOf(v);
      if (saleBadgeLabel && label) saleBadgeLabel.textContent = label;
      saleBadge.hidden = !label;
    };

    const shown = (r) => r.value;
    const barText = (v) => { barSum.textContent = v.options.join(' · '); };
    const refreshValues = () => {
      // Each value: is there an available variant with it and the other current picks?
      const p = picks();
      radios.forEach((r) => {
        if (r.type === 'hidden') return;
        const oi = +r.dataset.option;
        // A combined-listing value with no variant here belongs to a sibling product: its stock isn't known, so don't mark it out.
        const sibling = r.dataset.productUrl && !variants.some((v) => v.options[oi] === r.value);
        const ok = sibling || variants.some((v) => v.available && v.options[oi] === r.value && p.every((val, j) => j >= oi || val === undefined || v.options[j] === val));
        const label = r.closest('label');
        label.classList.toggle('is-out', !ok);
        if (ok) r.removeAttribute('aria-label');
        else r.setAttribute('aria-label', t.valueSoldOut.replace('__V__', shown(r)));
      });
    };

    // Pre-order: a picked single-delivery plan ([price, compare, cents, group name, due today or ''] — pre-order or
    // try before you buy; subscriptions have 3 entries), or a variant that's out of stock but still selling (pre). Returns [badge, note] or null.
    const preOf = (v) => {
      if (!v) return null;
      const plan = planId() && v.plans && v.plans[planId()];
      if (plan) return plan.length > 3 ? [plan[3] || t.preorder, plan[4] ? t.payToday.replace('__A__', plan[4]) : ''] : null;
      return v.pre ? [t.preorder, t.preNote] : null;
    };
    const preLine = $('[data-pre]');
    const showPre = (v) => {
      if (!preLine) return;
      const p = preOf(v);
      preLine.hidden = !p;
      preLine.querySelector('[data-pre-badge]').textContent = p ? p[0] : '';
      preLine.querySelector('[data-pre-note]').textContent = p ? p[1] : '';
    };

    // Add button and phone bar button: label, price × quantity, disabled state.
    const labels = (v) => {
      const avail = !!(v && v.available);
      const pre = avail && preOf(v);
      if (add) {
        add.disabled = !avail;
        addLabel.textContent = avail ? (pre ? t.preorder : t.add) + (cfg.priceInButton ? ` · ${totalOf(v)}` : '') : (v ? t.soldOut : t.unavailable);
      }
      if (barBtn) {
        barBtn.disabled = coming ? !notify : (!avail && !notify);
        barBtn.textContent = coming ? (notify ? t.notify : t.comingSoon) : avail ? (pre ? t.preorder : t.addShort) + (cfg.priceInButton ? ` · ${totalOf(v)}` : '') : (notify ? t.notify : t.soldOut);
      }
    };

    // Purchase option prices for the variant picked: the one-time card, each group card (with what it saves) and the
    // frequency chips or select. A plan the variant does not offer hides its chip.
    const plansBox = pp.querySelector('[data-plans]');
    const paintPlans = (v) => {
      if (!plansBox || !v) return;
      const plans = v.plans || {};
      const pct = (c) => (v.cents > 0 && c < v.cents ? Math.round(((v.cents - c) * 100) / v.cents) : 0);
      const save = (c) => (pct(c) > 0 ? (plansBox.dataset.save || '').replace('[p]', pct(c)) : '');
      const meta = (p) => (p ? [p[0], save(p[2])].filter(Boolean).join(' · ') : '');
      const once = plansBox.querySelector('[data-plan-once]');
      if (once) once.textContent = v.price;
      plansBox.querySelectorAll('[data-plan-meta]').forEach((el) => {
        const p = plans[el.dataset.planMeta];
        el.textContent = meta(p);
        el.closest('.mu-fchip').hidden = !p;
      });
      plansBox.querySelectorAll('[data-plan-group]').forEach((g) => {
        const gid = g.dataset.planGroup;
        if (!gid) return;
        const p = plans[g.value];
        const box = g.closest('.mu-plans__group');
        const price = box.querySelector('[data-plan-gprice]');
        const was = box.querySelector('[data-plan-gwas]');
        const badge = box.querySelector('[data-plan-gsave]');
        if (price) price.textContent = p ? p[0] : '';
        if (was) { was.textContent = v.price; was.hidden = !p || !pct(p[2]); }
        if (badge) { badge.textContent = p ? save(p[2]) : ''; badge.hidden = !p || !pct(p[2]); }
        const selMeta = box.querySelector('[data-plan-selmeta]');
        if (selMeta) selMeta.textContent = meta(p);
      });
    };

    const update = (fromUser) => {
      const v = current();
      paintPlans(v);
      if (!noVariants) refreshValues();
      msg && (msg.textContent = '');
      const avail = !!(v && v.available);
      const changed = v && idInput && idInput.value !== String(v.id);
      if (v) {
        if (idInput) idInput.value = v.id;
        if (priceWrap) priceWrap.innerHTML = priceHtml(v);
        refreshSaleBadge(v);
        if (notifyTags) notifyTags.value = notifyTags.value.replace(/notify-variant-\d+/, `notify-variant-${v.id}`);
        if (unit) { unit.innerHTML = v.unit || ''; unit.hidden = !v.unit; }
        if (sku) { sku.textContent = v.sku || ''; skuWrap.hidden = !v.sku; }
        if (termsId && termsId.value !== String(v.id)) {
          termsId.value = v.id;
          termsId.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (qty) setRule(v);
        if (changed && pickup) loadPickup(v.id);
      }
      showPre(v);
      labels(v);
      if (v) setLevel(v);
      if (dyn) dyn.hidden = !avail;

      // Tip on the selected value of the last option.
      pp.querySelectorAll('.mu-opt__tip').forEach((el) => el.remove());
      const n = lowCount(v);
      if (n && cfg.last !== cfg.colour) {
        const sel = radios.find((r) => r.checked && +r.dataset.option === cfg.last);
        if (sel) {
          const em = document.createElement('em');
          em.className = 'mu-opt__tip';
          em.setAttribute('aria-hidden', 'true');
          em.textContent = t.last.replace('__N__', n);
          sel.closest('label').append(em);
        }
      }
      if (stock) stock.textContent = n ? t.lowStock.replace('__N__', n) : '';

      // Stock level block: "stk" is the tracked stock capped at threshold + 1 (snippets/mu-pp-data).
      if (stockLevel) {
        const th = +stockLevel.dataset.th || 1;
        const k = v && !coming && v.stk != null && v.stk > 0 ? v.stk : 0;
        const isLow = k > 0 && k <= th;
        stockLevel.hidden = !k || (!isLow && stockLevel.dataset.show !== 'always');
        stockLevel.classList.toggle('is-low', isLow);
        const text = stockLevel.querySelector('[data-stock-text]');
        if (text) text.textContent = isLow ? stockLevel.dataset.stockMsg.split('[count]').join(k) : stockLevel.dataset.stockHigh;
        const fill = stockLevel.querySelector('[data-stock-fill]');
        if (fill) fill.style.setProperty('--fill', `${Math.min(100, Math.round((k * 100) / th))}%`);
      }

      if (notify) notify.hidden = !(coming || (cfg.notify && !avail));

      // Bar.
      if (barBtn) {
        if (barSum && v && !noVariants) barText(v);
        if (barImg && v && v.img) { barImg.removeAttribute('srcset'); barImg.src = v.img; barImg.style.objectPosition = v.imgpos || ''; }
      }

      if (fromUser && v) {
        if (!noHistory) {
          const url = new URL(window.location.href);
          url.searchParams.set('variant', v.id);
          if (planInput) {
            if (planId()) url.searchParams.set('selling_plan', planId());
            else url.searchParams.delete('selling_plan');
          }
          history.replaceState(history.state, '', url.toString());
        }
        if (v.media) {
          const i = slideEls.findIndex((s) => s.dataset.mediaId === String(v.media));
          if (i > -1) goTo(i);
        }
      }
    };
    // Combined listings: a value that belongs to another product (data-product-url, Shopify's option_value.product_url)
    // loads that product. The product page swaps its section in place (Section Rendering API) and updates the address;
    // the featured product, or a product on a template without this section, opens the product's page.
    const here = new URL(pp.dataset.url || window.location.pathname, window.location.href).pathname;
    radios.forEach((r) => r.addEventListener('change', () => {
      const to = r.dataset.productUrl;
      if (to && new URL(to, window.location.href).pathname !== here) swap(r, to);
      else update(true);
    }));
    async function swap(r, to) {
      const ids = radios.filter((x) => x.checked && x.dataset.valueId).map((x) => x.dataset.valueId).join(',');
      const target = new URL(to, window.location.href);
      if (ids) target.searchParams.set('option_values', ids);
      const host = pp.closest('.shopify-section');
      if (noHistory || !host || !pp.dataset.section) { window.location.href = target.toString(); return; }
      pp.setAttribute('aria-busy', 'true');
      try {
        const req = new URL(target);
        req.searchParams.set('section_id', pp.dataset.section);
        const res = await fetch(req);
        if (!res.ok) throw new Error(res.status);
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const fresh = doc.querySelector('[data-pp]');
        if (!fresh) throw new Error('empty');
        const wrap = fresh.closest('.shopify-section') || doc.body;
        const oldTitle = (pp.querySelector('.mu-pp__title') || {}).textContent;
        const newTitle = (fresh.querySelector('.mu-pp__title') || {}).textContent;
        const y = window.scrollY;
        host.replaceChildren(...[...wrap.childNodes].map((n) => document.importNode(n, true)));
        window.scrollTo(0, y);
        const id = (host.querySelector('[data-pp] [data-id]') || {}).value;
        const next = new URL(fresh.dataset.url || target.pathname, window.location.href);
        if (id) next.searchParams.set('variant', id);
        history.replaceState(history.state, '', next.toString());
        if (oldTitle && newTitle) document.title = document.title.replace(oldTitle.trim(), newTitle.trim());
        host.dispatchEvent(new CustomEvent('shopify:section:load', { bubbles: true, detail: { sectionId: pp.dataset.section } }));
        const back = host.querySelector(`[data-option][data-value-id="${r.dataset.valueId}"]`);
        if (back) back.focus({ preventScroll: true });
      } catch (err) {
        window.location.href = target.toString();
      }
    }

    // ---------- Quantity ----------
    function setRule(v) {
      const min = v.qmin || 1;
      const step = v.qstep || 1;
      qty.min = min;
      qty.step = step;
      if (v.qmax) qty.max = v.qmax; else qty.removeAttribute('max');
      const n = +qty.value;
      if (!n || n < min || (v.qmax && n > v.qmax) || (n - min) % step) qty.value = min;
      stepState();
      if (qtyRule) {
        const parts = [];
        if (step > 1) parts.push(t.qtyIncrement.replace('__N__', step));
        if (min > 1) parts.push(t.qtyMin.replace('__N__', min));
        if (v.qmax) parts.push(t.qtyMax.replace('__N__', v.qmax));
        qtyRule.textContent = parts.join(' ');
        qtyRule.hidden = !parts.length;
      }
      drawBreaks(v);
    }
    // Volume pricing table: tiers as "1–4", "5–9", "10+", the base price first when the first break starts above the
    // minimum. Hidden for a variant without breaks.
    function drawBreaks(v) {
      if (!breaksBox || !breaksBody) return;
      const b = v.breaks || [];
      breaksBox.hidden = !b.length;
      if (!b.length) { breaksBody.innerHTML = ''; return; }
      const min = v.qmin || 1;
      const rows = [];
      const range = (lo, next) => (next == null ? `${lo}+` : next - 1 > lo ? `${lo}–${next - 1}` : `${lo}`);
      if (b[0][0] > min) rows.push([min, b[0][0], v.price]);
      b.forEach((x, i) => rows.push([x[0], b[i + 1] ? b[i + 1][0] : null, x[2]]));
      breaksBody.innerHTML = rows.map((x) => `<tr data-from="${x[0]}"><td class="mu-num">${esc(range(x[0], x[1]))}</td><td class="mu-num">${esc(x[2])}</td></tr>`).join('');
      markTier();
    }
    function markTier() {
      if (!breaksBody) return;
      const n = qtyNow();
      const rows = [...breaksBody.querySelectorAll('tr')];
      let on = null;
      rows.forEach((tr) => { if (n >= +(tr.dataset.from || 0)) on = tr; });
      rows.forEach((tr) => tr.classList.toggle('is-on', tr === on));
    }
    function stepState() {
      markTier();
      const n = +qty.value || 0;
      pp.querySelectorAll('[data-qty-step]').forEach((b) => {
        b.disabled = +b.dataset.qtyStep < 0 ? n <= (+qty.min || 1) : (qty.max !== '' && n >= +qty.max);
      });
    }
    if (qty) {
      pp.querySelectorAll('[data-qty-step]').forEach((b) => b.addEventListener('click', () => {
        const step = +qty.step || 1;
        const min = +qty.min || 1;
        let n = (+qty.value || min) + step * +b.dataset.qtyStep;
        if (n < min) n = min;
        if (qty.max !== '' && n > +qty.max) n = +qty.max;
        qty.value = n;
        stepState();
        labels(current());
      }));
      qty.addEventListener('change', () => {
        const min = +qty.min || 1;
        if (!(+qty.value >= min)) qty.value = min;
        if (qty.max !== '' && +qty.value > +qty.max) qty.value = qty.max;
        stepState();
        labels(current());
      });
      qty.addEventListener('input', () => { if (+qty.value >= 1) { markTier(); labels(current()); } });
    }

    // ---------- Purchase options ----------
    if (planInput) {
      const groups = [...pp.querySelectorAll('[data-plan-group]')];
      // The plan picked inside a group: its checked frequency chip or its select, else the group's first plan.
      const choiceIn = (gid) => {
        const f = [...pp.querySelectorAll('[data-plan-freq]')].find((x) => x.dataset.planFreq === gid);
        if (!f) return '';
        const s = f.querySelector('select[data-plan-choice]');
        if (s) return s.value;
        const r = f.querySelector('[data-plan-choice]:checked');
        return r ? r.value : '';
      };
      const pickPlan = (e) => {
        // Picking a frequency also picks its group.
        if (e && e.target && e.target.matches('[data-plan-choice]')) {
          const f = e.target.closest('[data-plan-freq]');
          const g = f && groups.find((r) => r.dataset.planGroup === f.dataset.planFreq);
          if (g) g.checked = true;
        }
        const g = groups.find((r) => r.checked);
        pp.querySelectorAll('[data-plan-freq]').forEach((f) => { f.hidden = !g || f.dataset.planFreq !== g.dataset.planGroup; });
        const c = g && g.dataset.planGroup && choiceIn(g.dataset.planGroup);
        if (c) g.value = c;
        planInput.value = g ? g.value : '';
        planInput.disabled = !planInput.value;
        update(true);
      };
      groups.forEach((r) => r.addEventListener('change', pickPlan));
      pp.querySelectorAll('[data-plan-choice]').forEach((s) => s.addEventListener('change', pickPlan));
    }

    // ---------- Gift card recipient ----------
    const rBox = $('[data-recipient-box]');
    if (rBox) {
      const fields = $('[data-recipient-fields]');
      const offset = $('[data-recipient-offset]');
      const set = () => {
        fields.hidden = !rBox.checked;
        pp.querySelectorAll('[data-recipient-input]').forEach((i) => { i.disabled = !rBox.checked; });
        if (offset) offset.value = String(new Date().getTimezoneOffset());
      };
      rBox.addEventListener('change', set);
      set();
    }

    // ---------- Local pickup ----------
    let pickupReq = 0;
    async function loadPickup(id) {
      const n = ++pickupReq;
      try {
        // /variants/{id}?section_id= renders without the product, so ask the product URL for the variant.
        const base = pickup.dataset.url || `${root}variants/${id}`;
        const html = await (await fetch(`${base}?variant=${id}&section_id=mu-pickup`)).text();
        if (n !== pickupReq) return;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const sec = doc.querySelector('.shopify-section') || doc.body;
        pickup.innerHTML = sec.innerHTML;
        if (window.MuStore) window.MuStore.pickup(pickup);
      } catch (e) { /* keep what is there */ }
    }
    if (pickup) {
      pickup.addEventListener('click', (e) => {
        const open = e.target.closest('[data-pick-open]');
        const sheet = pickup.querySelector('[data-pick-sheet]');
        if (!sheet || typeof sheet.showModal !== 'function') return;
        if (open) {
          sheet.showModal();
          sheet.querySelector('[data-pick-close]').focus();
          sheet.addEventListener('close', () => { const o = pickup.querySelector('[data-pick-open]'); if (o) o.focus(); }, { once: true });
        } else if (e.target.closest('[data-pick-close]') || e.target === sheet) sheet.close();
      });
    }

    // ---------- Share ----------
    // Network links are plain links. The last button opens the device share sheet, or copies the link where there is none.
    const share = $('[data-share]');
    if (share && (navigator.share || navigator.clipboard)) {
      share.closest('[data-share-wrap]').hidden = false;
      const shareMsg = $('[data-share-msg]');
      if (!navigator.share) {
        share.querySelector('[data-share-label]').textContent = t.copyLink;
        share.querySelector('[data-share-icon]').hidden = true;
        share.querySelector('[data-copy-icon]').hidden = false;
      }
      share.addEventListener('click', async () => {
        const url = share.dataset.url;
        if (navigator.share) {
          try { await navigator.share({ title: share.dataset.title, url }); } catch (e) { /* closed */ }
        } else {
          try {
            await navigator.clipboard.writeText(url);
            if (shareMsg) { shareMsg.textContent = t.copied; setTimeout(() => { shareMsg.textContent = ''; }, 2500); }
          } catch (e) { /* blocked */ }
        }
      });
    }

    // ---------- Add to cart ----------
    const added = async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.description || data.message || t.error);
      const cart = await (await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } })).json();
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: { ...cart, mu_added: true }, bubbles: true }));
    };
    const post = (f) => fetch(`${root}cart/add.js`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: new FormData(f),
    });

    // ---------- Complementary products ----------
    const comp = $('[data-comp]');
    if (comp) {
      // Shown only once recommendations come back; with none, the block goes, and a below-media card it was the only
      // content of stays hidden (main-product renders that card hidden until then).
      const below = comp.closest('[data-below]');
      const none = () => { if (!(window.Shopify && Shopify.designMode)) comp.remove(); };
      // Products setting: complementary, related, or complementary falling back to related when a product has none paired.
      const intents = { complementary: ['complementary'], related: ['related'] }[comp.dataset.source] || ['complementary', 'related'];
      const get = (intent) => fetch(`${comp.dataset.url}&intent=${intent}`)
        .then((r) => (r.ok ? r.text() : ''))
        .then((html) => html && new DOMParser().parseFromString(html, 'text/html').querySelector('.mu-comp'))
        .catch(() => null);
      (async () => {
        for (const intent of intents) {
          const list = await get(intent);
          if (list) {
            comp.querySelector('[data-comp-list]').replaceChildren(list);
            comp.hidden = false;
            if (below) below.hidden = false;
            return;
          }
        }
        none();
      })();
      comp.addEventListener('submit', async (e) => {
        const f = e.target.closest('[data-comp-form]');
        if (!f) return;
        e.preventDefault();
        const btn = f.querySelector('button');
        if (btn.getAttribute('aria-busy') === 'true') return;
        btn.setAttribute('aria-busy', 'true');
        try { await added(await post(f)); } catch (err) { if (msg) msg.textContent = err.message || t.error; } finally { btn.removeAttribute('aria-busy'); }
      });
    }

    // ---------- Add to cart (main form) ----------
    form && form.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Busy flag rather than disabled, so keyboard focus stays on the button while the request runs.
      if (add.disabled || add.getAttribute('aria-busy') === 'true') return;
      if (rBox && rBox.checked && !form.reportValidity()) return;
      // Custom surf-spot template: required line-item property, wired in assets/mu-spot.js.
      if (window.MuSpot && !MuSpot.ok(form, msg)) return;
      add.setAttribute('aria-busy', 'true');
      try {
        await added(await post(form));
        msg.textContent = t.added;
      } catch (err) {
        msg.textContent = err.message || t.error;
      } finally {
        add.removeAttribute('aria-busy');
        const v = current();
        add.disabled = !(v && v.available);
      }
    });

    // ---------- Phone bar ----------
    if (bar && barBtn && form) {
      const mq = matchMedia('(max-width: 749px)');
      const target = $('[data-buy]:not([hidden])') || $('[data-soon]') || $('[data-panel]');
      const io = new IntersectionObserver(([entry]) => {
        const past = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        document.body.classList.toggle('mu-bar-on', past && mq.matches);
        bar.setAttribute('aria-hidden', String(!(past && mq.matches)));
        barBtn.tabIndex = past && mq.matches ? 0 : -1;
      });
      io.observe(target);
      barBtn.addEventListener('click', () => {
        const v = current();
        if (v && v.available && !coming) {
          form.requestSubmit ? form.requestSubmit() : add.click();
          const back = () => { document.removeEventListener('cart:updated', back); barBtn.textContent = t.added; setTimeout(() => update(false), 1600); };
          document.addEventListener('cart:updated', back);
        } else if (notify) {
          notify.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const input = notify.querySelector('input[type="email"]');
          if (input) setTimeout(() => input.focus({ preventScroll: true }), 400);
        }
      });
    }

    // ---------- Release flip ----------
    if (coming) {
      const at = +pp.dataset.release * 1000;
      const flip = () => {
        coming = false;
        const soon = $('[data-soon]');
        if (soon) soon.hidden = true;
        const buy = $('[data-buy]');
        if (buy) buy.hidden = false;
        if (pickup) pickup.hidden = false;
        update(false);
      };
      if (Date.now() >= at) flip();
      else if (at - Date.now() < 2147483647) setTimeout(flip, at - Date.now());
    }

    // Notify form posted: show the form, move it into view, and focus the confirmation or the invalid field.
    const notifyBack = notify && notify.querySelector('.mu-pp__notify-done, [aria-invalid]');
    if (notifyBack) {
      notify.hidden = false;
      if (!notifyBack.hasAttribute('tabindex')) notifyBack.tabIndex = -1;
      notify.scrollIntoView({ block: 'center' });
      notifyBack.focus({ preventScroll: true });
    }

    // ---------- Pin the shorter column (desktop) ----------
    // mu-product.css sticks both columns; this measures them so a column taller than the screen can scroll to its
    // end before it pins, and so a card under the media travels with it. Re-measured whenever either side resizes
    // (accordions, variant media, window width).
    const pinStage = pp.querySelector(':scope > .mu-pp__stage');
    const pinPanel = pp.querySelector(':scope > [data-panel]');
    const pinBelow = pp.querySelector(':scope > [data-below]');
    if (pinStage && pinPanel && 'ResizeObserver' in window) {
      const wide = matchMedia('(min-width: 990px)');
      let frame = 0;
      const pin = () => {
        frame = 0;
        const below = pinBelow && !pinBelow.hidden ? pinBelow.offsetHeight : 0;
        const gap = below ? parseFloat(getComputedStyle(pp).rowGap) || 0 : 0;
        const stageH = pinStage.offsetHeight;
        const mediaH = stageH + (below ? gap + below : 0);
        const panelH = pinPanel.offsetHeight;
        pp.style.setProperty('--pp-media-h', `${mediaH}px`);
        pp.style.setProperty('--pp-panel-h', `${panelH}px`);
        pp.style.setProperty('--pp-below-m', `${below ? below + gap : 0}px`);
        pp.style.setProperty('--pp-below-at', `${stageH + gap}px`);
        pp.classList.toggle('is-pin-media', wide.matches && below > 0 && mediaH < panelH);
      };
      const queue = () => { if (!frame) frame = requestAnimationFrame(pin); };
      const ro = new ResizeObserver(queue);
      [pinStage, pinPanel, pinBelow].forEach((el) => el && ro.observe(el));
      wide.addEventListener('change', queue);
      pin();
    }

    pp.querySelectorAll('.mu-pp__acc[data-rows="tabs"]').forEach((box, i) => tabs(box, `${pp.dataset.section || 'pp'}-${i}`));
    update(false);
  }

  /* Product page > Collapsible rows layout > Tabs: from 750px a run of collapsible rows becomes a WAI-ARIA tablist
     (automatic activation, roving tabindex, Left/Right/Home/End). Under 750px, or without JavaScript, the rows stay
     accordions. One row stays an accordion. Selecting a row's block in the theme editor shows its tab. */
  function tabs(box, base) {
    const items = [...box.children].filter((el) => el.matches('details.mu-pp__acc-item'));
    if (items.length < 2) return;
    const wide = matchMedia('(min-width: 750px)');
    const panels = items.map((d) => d.querySelector('.mu-pp__acc-body'));
    let list = null;
    let btns = [];
    let at = 0;
    const select = (i, focus) => {
      at = i;
      btns.forEach((b, j) => {
        b.setAttribute('aria-selected', String(j === i));
        b.tabIndex = j === i ? 0 : -1;
        items[j].hidden = j !== i;
      });
      if (focus) btns[i].focus();
    };
    const on = () => {
      list = document.createElement('div');
      list.className = 'mu-pp__tabs';
      list.setAttribute('role', 'tablist');
      btns = items.map((d, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mu-pp__tab';
        b.id = `mu-tab-${base}-${i}`;
        b.setAttribute('role', 'tab');
        b.textContent = d.querySelector('summary').textContent.trim();
        const p = panels[i];
        p.id = p.id || `mu-tabpanel-${base}-${i}`;
        p.setAttribute('role', 'tabpanel');
        p.setAttribute('aria-labelledby', b.id);
        p.tabIndex = 0;
        b.setAttribute('aria-controls', p.id);
        b.addEventListener('click', () => select(i));
        d.open = true;
        list.append(b);
        return b;
      });
      list.addEventListener('keydown', (e) => {
        const n = btns.length;
        const to = { ArrowRight: at + 1, ArrowLeft: at - 1 + n, Home: 0, End: n - 1 }[e.key];
        if (to == null) return;
        e.preventDefault();
        select(to % n, true);
      });
      box.prepend(list);
      box.classList.add('is-tabs');
      select(Math.min(at, items.length - 1));
    };
    const off = () => {
      if (!list) return;
      list.remove();
      list = null;
      btns = [];
      box.classList.remove('is-tabs');
      items.forEach((d, i) => {
        d.hidden = false;
        d.open = false;
        panels[i].removeAttribute('role');
        panels[i].removeAttribute('aria-labelledby');
        panels[i].removeAttribute('tabindex');
      });
    };
    const apply = () => (wide.matches ? list || on() : off());
    if (wide.matches) on();
    wide.addEventListener('change', apply);
    box.addEventListener('shopify:block:select', (e) => {
      const i = items.indexOf(e.target.closest('details'));
      if (i < 0) return;
      if (list) select(i); else items[i].open = true;
    });
  }

  const boot = () => document.querySelectorAll('[data-pp]').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('shopify:section:load', boot);
})();
