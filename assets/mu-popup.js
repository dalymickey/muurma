/* Popups (sections/mu-popup). A popup is a native modal <dialog>: focus stays inside, Esc and the
   backdrop close it. Opening by itself waits for its delay (counted from the first scroll, tap or key press) and respects its frequency (per visit, week or ever,
   counted from when it is closed); its tag opens it at any time. The discount pill copies
   with the Clipboard API and falls back to a selected text field + execCommand for older WebKit. Loaded once by
   layout/theme.liquid when a popup is on the page; the guard below still keeps a second copy to a rescan.
   Tags (a popup's Show tag): moved to the end of <body> so fixed and page positions measure from the viewport and
   the document, never a section box. Each shows when its popup is closed and, for "After the popup is closed once",
   once that popup has been closed on this device; a newsletter tag goes for good after a sign-up (this popup's success
   or Shopify's ?customer_posted=true). Placement runs on scroll and resize, one frame at a time: top tags clear the
   header, bottom tags lift over a visible back to top button or add bar that shares their side, and tags sharing a
   position stack. In the theme editor tags always show while their popup is closed. */
(() => {
  if (window.kzPopup) { window.kzPopup.scan(); return; }
  const design = !!(window.Shopify && window.Shopify.designMode);
  const KEY = 'mu-popup:';
  const WEEK = 7 * 24 * 3600 * 1000;
  const find = (type) => document.querySelector(`dialog[data-mu-popup="${type}"]`);
  const store = (freq) => { try { return freq === 'session' ? sessionStorage : localStorage; } catch (e) { return null; } };
  let opener = null;
  const SIGNED = KEY + 'signed';
  const CLOSED = KEY + 'closed:';
  const getL = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const setL = (k) => { try { localStorage.setItem(k, String(Date.now())); } catch (e) { /* private mode */ } };
  if (!design && /[?&]customer_posted=true/.test(location.search)) setL(SIGNED);

  const muted = (d) => {
    const st = store(d.dataset.freq);
    if (!st) return false;
    let v = null;
    try { v = st.getItem(KEY + d.dataset.section); } catch (e) { return false; }
    if (!v) return false;
    return d.dataset.freq === 'week' ? Date.now() - Number(v) < WEEK : true;
  };
  const remember = (d) => {
    const st = store(d.dataset.freq);
    try { st && st.setItem(KEY + d.dataset.section, String(Date.now())); } catch (e) { /* private mode */ }
  };

  const open = (d, from) => {
    if (!d || d.open) return;
    const other = document.querySelector('dialog[open]:not([data-mu-cookie])');
    if (other && other !== d) other.close();
    opener = from || null;
    d.showModal();
    tags.update();
  };

  const setup = (d) => {
    if (d.kzPop) return;
    d.kzPop = true;
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-mu-popup-close]')) d.close();
      const copy = e.target.closest('[data-mu-popup-copy]');
      if (copy) copyCode(d, copy);
    });
    if (!design && d.dataset.signed !== undefined) setL(SIGNED);
    d.addEventListener('close', () => {
      if (!design) { remember(d); setL(CLOSED + d.dataset.section); }
      tags.update();
      const live = d.querySelector('[data-mu-popup-live]');
      if (live) live.textContent = '';
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      opener = null;
    });
    if (design) return;
    if (d.dataset.openNow && location.hash === '#' + d.dataset.openNow) { open(d); return; }
    const delay = Number(d.dataset.auto);
    if (delay < 0 || muted(d)) return;
    // One overlay at a time: age verification, then the cookie banner, then this (it waits for the shopper's choice).
    const go = () => { if (!document.querySelector('dialog[open]') && !muted(d)) open(d); };
    const timed = () => {
      if (window.kzConsentWait) document.addEventListener('ks:consent-done', () => setTimeout(go, 800), { once: true });
      else go();
    };
    // The delay counts from the shopper's first scroll, tap, click or key press, so a page nobody has touched yet
    // (a background tab, a speed test) never opens a popup over the first paint.
    const evs = ['scroll', 'pointerdown', 'keydown', 'touchstart'];
    const start = () => { evs.forEach((e) => window.removeEventListener(e, start)); setTimeout(timed, delay * 1000); };
    evs.forEach((e) => window.addEventListener(e, start, { passive: true }));
  };

  // ---------- Tags ----------
  const tags = (() => {
    const list = new Set();
    let lastY = window.scrollY, anchor = lastY, raf = 0;
    const dlg = (t) => document.getElementById('MuPopup-' + t.dataset.kzPopupTag);
    const wanted = (t) => {
      const d = dlg(t);
      if (!d || d.open) return false;
      if (design) return true;
      if (t.dataset.kind === 'newsletter' && getL(SIGNED)) return false;
      if (t.dataset.when === 'closed' && !getL(CLOSED + t.dataset.kzPopupTag)) return false;
      return true;
    };
    const shown = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return null;
      const r = el.getBoundingClientRect();
      return r.height ? r : null;
    };
    // Phones (under 750px) can move a tag to a bottom-center tab or hide it (On mobile).
    const phone = matchMedia('(max-width: 749px)');
    const posOf = (t) => (phone.matches && t.dataset.mobile === 'center' ? 'bottom_center' : t.dataset.pos);
    // A transparent header (overlay over a hero, before it turns solid) leaves top corners floating: they become a
    // half-round tab a little below it, and tuck under as a quarter circle once the header is solid or stuck.
    const clear = () => {
      const h = document.querySelector('.mu-header');
      if (!h || !h.matches('.mu-header--over:not(.is-solid, .is-sdrop-open)')) return false;
      if (h.querySelector('.mu-header__bar details[open]')) return false;
      return !!document.querySelector('.mu-main > .shopify-section:first-child > [data-mu-over]');
    };
    const place = () => {
      raf = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const hdr = document.querySelector('.mu-header-section');
      const hr = hdr ? hdr.getBoundingClientRect() : null;
      const see = clear();
      const obstacles = [shown(document.querySelector('[data-totop]')), document.body.classList.contains('mu-bar-on') ? shown(document.querySelector('.mu-pp-bar')) : null].filter(Boolean);
      const stacks = {};
      list.forEach((t) => {
        if (t.hidden) return;
        const pos = posOf(t);
        const [v, side] = pos.split('_');
        const page = t.dataset.scroll === 'page';
        const round = v === 'top' && see;
        // Top tags start below the header: where it ends on screen (sticky or not), or in the document when scrolling away.
        if (v === 'top') t.style.setProperty('--ptag-top', Math.max(0, (hr ? (page ? hr.bottom + y : hr.bottom) : 0) + (round ? 12 : 0)) + 'px');
        // Bottom tags lift over anything fixed in their bottom corner that shares their side.
        let lift = 0;
        if (v === 'bottom' && !page) {
          const tr = t.getBoundingClientRect();
          obstacles.forEach((o) => {
            let same = o.left < tr.right + 8 && o.right > tr.left - 8;
            if (side === 'left') same = o.left < tr.right + 40;
            if (side === 'right') same = o.right > tr.left - 40;
            if (same) lift = Math.max(lift, vh - o.top + 10);
          });
        }
        t.style.setProperty('--ptag-lift', lift + 'px');
        // Tags sharing a position stack beside the first.
        const st = stacks[pos] || (stacks[pos] = { shift: 0, prev: 0, n: 0 });
        const h = t.offsetHeight;
        if (st.n) st.shift += v === 'middle' ? st.prev / 2 + 8 + h / 2 : st.prev + 8;
        st.prev = h; st.n += 1;
        t.style.setProperty('--ptag-shift', st.shift + 'px');
        t.classList.toggle('is-free', lift > 0 || st.shift > 0 || (side !== 'center' && round));
        if (!t.classList.contains('is-set')) requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('is-set')));
      });
      lastY = y;
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(place); };
    const onScroll = () => {
      // Direction from an anchor that only moves once 8px pile up, so slow or smooth scrolling still counts.
      const y = window.scrollY, dy = y - anchor;
      const down = dy > 8, up = dy < -8;
      if (down || up) anchor = y;
      list.forEach((t) => {
        if (t.dataset.scroll !== 'hide') return;
        if (down && y > 120) t.classList.add('is-away');
        else if (up || y <= 120) t.classList.remove('is-away');
      });
      queue();
    };
    const update = () => {
      list.forEach((t) => {
        if (!t.isConnected) { list.delete(t); return; }
        const on = wanted(t);
        if (on && t.hidden) {
          t.hidden = false;
          t.classList.remove('is-ping');
          void t.offsetWidth;
          t.classList.add('is-ping');
        } else if (!on) t.hidden = true;
      });
      queue();
    };
    const add = (t) => {
      if (t.kzTag) return;
      t.kzTag = true;
      document.body.appendChild(t);
      list.add(t);
      t.addEventListener('animationend', () => t.classList.remove('is-ping'));
      t.addEventListener('click', () => open(dlg(t), t));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', queue);
    phone.addEventListener('change', queue);
    // The back to top button and add bar change state as the page scrolls; follow their class changes too.
    const mo = new MutationObserver(queue);
    const watch = () => {
      const tt = document.querySelector('[data-totop]');
      if (tt && !tt.kzTagWatch) { tt.kzTagWatch = true; mo.observe(tt, { attributes: true, attributeFilter: ['class'] }); tt.addEventListener('transitionend', queue); }
      // The add bar slides in after its class flips; measure again once it has landed.
      const bar = document.querySelector('.mu-pp-bar');
      if (bar && !bar.kzTagWatch) { bar.kzTagWatch = true; bar.addEventListener('transitionend', queue); }
    };
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // The header turns solid, sticks or opens its search in its own scroll handler; follow its classes.
    const hd = document.querySelector('.mu-header');
    if (hd) mo.observe(hd, { attributes: true, attributeFilter: ['class'] });
    const remove = (id) => list.forEach((t) => { if (t.dataset.kzPopupTag === id) { t.remove(); list.delete(t); } });
    return { add, update, watch, remove };
  })();

  const strings = (d) => { try { return JSON.parse(d.querySelector('[data-strings]').textContent); } catch (e) { return {}; } };
  const copyCode = async (d, btn) => {
    const code = btn.dataset.kzPopupCopy;
    const live = d.querySelector('[data-mu-popup-live]');
    const t = strings(d);
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(code); ok = true; }
    } catch (e) { ok = false; }
    if (!ok) {
      // Older WebKit: copy from a selected, read-only field inside the dialog (the page behind it is inert).
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;';
      d.appendChild(ta);
      ta.focus({ preventScroll: true });
      ta.select();
      ta.setSelectionRange(0, code.length);
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      btn.focus({ preventScroll: true });
    }
    if (ok) {
      btn.classList.add('is-copied');
      if (live) { live.textContent = ''; setTimeout(() => { live.textContent = t.copied || ''; }, 50); }
      clearTimeout(btn.kzT);
      btn.kzT = setTimeout(() => { btn.classList.remove('is-copied'); }, 2400);
    } else {
      // Couldn't copy: select the code so the shopper can copy it themselves.
      const txt = btn.querySelector('.mu-pop__code-text');
      const r = document.createRange();
      r.selectNodeContents(txt);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(r);
      if (live) live.textContent = t.failed || '';
    }
  };

  const scan = () => {
    document.querySelectorAll('dialog[data-mu-popup]').forEach(setup);
    document.querySelectorAll('[data-mu-popup-tag]').forEach(tags.add);
    tags.watch();
    tags.update();
  };

  if (design) {
    document.addEventListener('shopify:section:unload', (e) => tags.remove(e.detail.sectionId));
    document.addEventListener('shopify:section:load', scan);
    document.addEventListener('shopify:section:select', (e) => {
      const d = document.querySelector(`dialog[data-mu-popup][data-section="${e.detail.sectionId}"]`);
      if (d) open(d);
    });
    document.addEventListener('shopify:section:deselect', (e) => {
      const d = document.querySelector(`dialog[data-mu-popup][data-section="${e.detail.sectionId}"]`);
      if (d && d.open) d.close();
    });
  }

  window.kzPopup = { scan, open: (type, from) => open(find(type), from) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();
