/* Header: menu dialog (phones, or every width in the minimal style), transparent-over-hero state, sticky state, predictive search, and the live bag count (listens for the theme's cart:updated event). */
class MuHeader extends HTMLElement {
  connectedCallback() {
    this.measure();
    this.menu = this.querySelector('.mu-menu');
    this.opener = this.querySelector('[data-menu-open]');
    this.opener?.addEventListener('click', () => this.open());
    this.querySelector('[data-menu-close]')?.addEventListener('click', () => this.close());
    this.menu?.addEventListener('click', (e) => { if (e.target === this.menu) this.close(); });
    this.menu?.addEventListener('close', () => this.opener?.focus());
    // Desktop dropdowns: one open at a time, close on outside click / Esc.
    this.drops = [...this.querySelectorAll('.mu-header__drop, .mu-header__loc')];
    this.drops.forEach((d) => d.addEventListener('toggle', () => { if (d.open) this.drops.forEach((o) => o !== d && (o.open = false)); }));
    document.addEventListener('click', (e) => { if (!this.contains(e.target)) this.drops.forEach((d) => (d.open = false)); });
    this.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.drops.forEach((d) => { if (d.open) { d.open = false; d.querySelector('summary').focus(); } }); });
    // Sticky header: --sd sticks from 750px up, --sm on phones (header setting). is-stuck only where it sticks.
    const sd = this.classList.contains('mu-header--sd');
    const sm = this.classList.contains('mu-header--sm');
    if (sd || sm) {
      const lift = this.classList.contains('mu-header--ann') ? 36 : 4;
      const wide = matchMedia('(min-width: 750px)');
      const onScroll = () => this.classList.toggle('is-stuck', (wide.matches ? sd : sm) && window.scrollY > lift);
      window.addEventListener('scroll', onScroll, { passive: true });
      wide.addEventListener('change', onScroll);
      onScroll();
    }
    // Transparent over hero: solid once the hero leaves the bar, with auto contrast on the photo.
    if (this.classList.contains('mu-header--over')) this.initHeroOverlay();
    document.addEventListener('cart:updated', (e) => {
      const count = e.detail?.item_count;
      if (typeof count !== 'number') return;
      document.querySelectorAll('[data-cart-count]').forEach((b) => { b.textContent = count; b.dataset.count = count; });
      const words = this.countWords(e.detail);
      if (words) {
        document.querySelectorAll('[data-cart-label="bag"]').forEach((el) => { el.textContent = words.bag; });
        document.querySelectorAll('[data-cart-label="count"]').forEach((el) => { el.textContent = `, ${words.count}`; });
      }
      if (typeof e.detail.total_price !== 'number') return;
      document.querySelectorAll('[data-cart-total]').forEach((el) => {
        el.textContent = this.money(e.detail.total_price, el.dataset.moneySample);
        el.hidden = count === 0;
      });
    });
    this.initSearch();
    this.initSbar();
    this.initAnn();
  }

  // The bag count in words, counted like snippets/mu-cart-count.
  countWords(cart) {
    const el = document.querySelector('[data-mu-count-strings]');
    if (!el || !Array.isArray(cart.items)) return null;
    let s;
    try { s = JSON.parse(el.textContent); } catch { return null; }
    const rules = new Intl.PluralRules(document.documentElement.lang || 'en');
    const n = cart.items.reduce((sum, line) => sum + line.quantity, 0);
    const count = rules.select(n) === 'one' ? s.items.one.replace('1', n) : s.items.other.replace('7', n);
    return { count, bag: s.bag.replace('[c]', count) };
  }

  // Formats cents like the store's money format. The sample is 123456 rendered by Liquid's money filter (current
  // currency), so separators, symbol and code all match: '$1,234.56 AUD' gives ',' and '.' and two decimals;
  // '¥1,235' gives no decimals.
  money(cents, sample = '') {
    const m = sample.match(/1(\D?)23[45](?:(\D)56)?/);
    if (!m) return (cents / 100).toFixed(2);
    const [int, dec] = (cents / 100).toFixed(m[2] ? 2 : 0).split('.');
    const num = int.replace(/\B(?=(\d{3})+(?!\d))/g, m[1]) + (dec ? m[2] + dec : '');
    return sample.replace(m[0], num);
  }

  // Rotating announcements in the bar. Starts on the shopper's first move, then pauses while hovered, focused, scrolled away or the tab is hidden; with reduced motion
  // the messages still change, just without the slide. In the theme editor a selected block is shown and held. The
  // optional arrows (and the left and right arrow keys inside the bar) step through them and stop the rotation.
  initAnn() {
    const box = this.querySelector('[data-ann]');
    if (!box) return;
    const items = [...box.querySelectorAll('.mu-ann__item')];
    let i = 0;
    let held = false;
    const show = (n) => {
      i = (n + items.length) % items.length;
      items.forEach((el, k) => {
        el.classList.toggle('is-on', k === i);
        el.toggleAttribute('aria-hidden', k !== i);
        el.querySelectorAll('a').forEach((a) => (k === i ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
      });
    };
    // Arrows and arrow keys: a shopper who steps through the messages stops the rotation for good, and from then on
    // each change is announced.
    let stopped = false;
    const ann = box.querySelector('.mu-ann');
    const step = (d) => {
      stopped = true;
      if (ann) ann.setAttribute('aria-live', 'polite');
      show(i + d);
    };
    const prev = box.querySelector('[data-ann-prev]');
    const next = box.querySelector('[data-ann-next]');
    if (prev) prev.addEventListener('click', () => step(-1));
    if (next) next.addEventListener('click', () => step(1));
    if (prev || next) {
      box.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      });
    }
    // The first change waits for the shopper's first move, so a page left untouched settles straight after load.
    let woke = !!window.Shopify?.designMode;
    const wake = ['pointermove', 'pointerdown', 'scroll', 'keydown', 'touchstart'];
    const up = () => { wake.forEach((e) => window.removeEventListener(e, up)); woke = true; };
    if (!woke) wake.forEach((e) => window.addEventListener(e, up, { passive: true }));
    const paused = () => !woke || stopped || held || box.matches(':hover, :focus-within') || document.hidden || this.classList.contains('is-stuck');
    setInterval(() => { if (!paused()) show(i + 1); }, Math.max(3000, Number(box.dataset.ann) || 5000));
    document.addEventListener('shopify:block:select', (e) => {
      const n = items.indexOf(e.target);
      if (n > -1) { held = true; show(n); }
    });
    document.addEventListener('shopify:block:deselect', () => { held = false; });
  }

  // Fitting the tools into the pill, before paint so nothing flickers. Full layout first; if the pill overflows, the
  // search bar (header setting, 750px up) folds back to its icon (is-sbar-off); if it still overflows, My store drops
  // to its pin and the menu links tighten (is-tools-min, 990px up); then the menu links close up further (is-nav-tight);
  // and if the menu still doesn't fit (a long menu or long titles), it moves into the menu sheet behind the menu button
  // (is-nav-off), as on tablets. Skipped while a dropdown is open, since an open mega menu also widens the pill's overflow.
  // The steps used to read scrollWidth after every class change (four forced layouts, and again on each resize).
  // The same decision now comes from one read of the expanded row: each step saves a known amount (the values match
  // mu-header.css). Writes happen once, after that read.
  initSbar() {
    const bar = this.querySelector('.mu-header__bar');
    if (!bar || !('ResizeObserver' in window)) return;
    const sbar = this.querySelector('[data-sbar]');
    const wide = matchMedia('(min-width: 750px)');
    const desk = matchMedia('(min-width: 990px)');
    const tools = this.querySelector('.mu-header__tools');
    const nav = this.querySelector('.mu-header__nav');
    const names = ['is-sbar-off', 'is-tools-min', 'is-nav-tight', 'is-nav-off'];
    let cache = '';
    let frame = 0;
    // The tools row is capped at the pill, so its own overflow also counts (WebKit leaves the pill's end padding out of
    // its scrollWidth, which hides a few pixels of overflow there).
    const need = () => Math.max(bar.scrollWidth - bar.clientWidth, tools ? tools.scrollWidth - tools.clientWidth : 0);
    const signature = () => [bar.clientWidth, tools ? tools.scrollWidth : 0, nav ? nav.scrollWidth : 0, wide.matches, desk.matches].join('|');
    const plan = () => {
      const on = { 'is-sbar-off': false, 'is-tools-min': false, 'is-nav-tight': false, 'is-nav-off': false };
      names.forEach((n) => this.classList.remove(n));
      let left = need();
      if (sbar && left > 1) {
        on['is-sbar-off'] = true;
        const w = sbar.getBoundingClientRect().width;
        if (w > 0) left -= w + (parseFloat(getComputedStyle(sbar).marginInlineEnd) || 0) - 44;
      }
      if (left > 1) {
        on['is-tools-min'] = true;
        if (desk.matches) {
          const store = this.querySelector('.mu-header__store');
          if (store && !store.hidden && getComputedStyle(store).display !== 'none') {
            left -= store.getBoundingClientRect().width - 44 + (parseFloat(getComputedStyle(store).marginInlineEnd) || 0);
          }
          if (nav && getComputedStyle(nav).display !== 'none') {
            left -= 18 + 8 * nav.querySelectorAll(':scope > ul > li > a').length;
          }
        }
      }
      if (left > 1 && desk.matches) {
        on['is-nav-tight'] = true;
        if (nav && getComputedStyle(nav).display !== 'none') {
          const lis = nav.querySelectorAll(':scope > ul > li').length;
          const anchors = nav.querySelectorAll(':scope > ul > li > a').length;
          left -= 8 + 4 * anchors + 4 * Math.max(0, lis - 1);
        }
        const loc = this.querySelector('.mu-header__loc');
        if (loc && getComputedStyle(loc).display !== 'none') {
          const sum = loc.querySelector('summary');
          left -= (parseFloat(getComputedStyle(loc).marginInlineEnd) || 0) + Math.min(6, Math.max(0, (sum ? sum.getBoundingClientRect().width : 0) - 44));
        }
      }
      if (left > 1 && desk.matches) on['is-nav-off'] = true;
      return on;
    };
    const apply = () => {
      frame = 0;
      if (!wide.matches || this.querySelector('.mu-header__nav details[open]') || this.classList.contains('is-sdrop-open')) return;
      if (signature() === cache) return;
      const on = plan();
      names.forEach((n) => this.classList.toggle(n, on[n]));
      // The sheet only opens from the menu button there, so close it once the menu fits the pill again.
      if (desk.matches && !on['is-nav-off'] && !this.classList.contains('mu-header--min') && this.menu?.open) this.close();
      requestAnimationFrame(() => { cache = signature(); });
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(apply); };
    // Watch the pill and its contents: the bag total, web fonts or a language switch can change the fit at a fixed width.
    this.fitSbar = queue;
    const ro = new ResizeObserver(queue);
    // Each tool too: the tools row is capped at the pill, so a late arrival (My store, a wider country code) can leave
    // the row's own size unchanged.
    [bar, nav && nav.querySelector(':scope > ul'), tools, ...(tools ? tools.children : [])].forEach((el) => el && ro.observe(el));
    wide.addEventListener('change', queue);
    desk.addEventListener('change', queue);
    this.drops.forEach((d) => d.addEventListener('toggle', () => { if (!d.open) queue(); }));
    apply();
  }

  // Predictive search: the search icon opens a dialog; typing fetches /search/suggest with this theme's
  // mu-predictive-search section. Without JS the icon is a plain link to the search page.
  initSearch() {
    const dlg = this.querySelector('[data-search]');
    const opener = this.querySelector('[data-search-open]');
    if (!dlg || !opener) return;
    const input = dlg.querySelector('[data-search-input]');
    const out = dlg.querySelector('[data-search-out]');
    let timer;
    let ctrl;
    let back = opener;
    opener.addEventListener('click', (e) => { e.preventDefault(); back = opener; dlg.showModal(); input.focus(); });
    // The header search bar (if shown) gets its own results drop-down; the icon, shown when the bar folds away or on
    // phones, keeps opening this dialog.
    const field = this.querySelector('[data-sbar] input[type="search"]');
    const drop = this.querySelector('[data-sbar-out]');
    if (field && drop) this.initDrop(field, drop, dlg.dataset.url);
    dlg.querySelector('[data-search-close]')?.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => back.focus());
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = input.value.trim();
        if (!q) { out.innerHTML = ''; input.setAttribute('aria-expanded', 'false'); return; }
        ctrl?.abort();
        ctrl = new AbortController();
        const url = `${dlg.dataset.url}?q=${encodeURIComponent(q)}&section_id=mu-predictive-search&resources[limit]=6&resources[limit_scope]=each&resources[options][prefix]=last`;
        try {
          const res = await fetch(url, { signal: ctrl.signal });
          const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
          const fresh = doc.querySelector('[data-ps-results]');
          out.replaceChildren(...(fresh ? [fresh] : []));
          input.setAttribute('aria-expanded', fresh ? 'true' : 'false');
        } catch (err) { /* aborted or offline: keep the last results */ }
      }, 220);
    });
    // Arrow keys move through the results; Up from the first one returns to the field.
    dlg.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = [...out.querySelectorAll('[data-ps-item]')];
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') items[Math.min(i + 1, items.length - 1)].focus();
      else if (i <= 0) input.focus();
      else items[i - 1].focus();
    });
  }

  // Header search bar results: the same mu-predictive-search section as the dialog, dropped down under the field as
  // you type (debounced, stale requests aborted). An ARIA combobox: focus stays in the field, the arrow keys move a
  // highlight through the options (aria-activedescendant), Enter opens the highlighted one or searches, Escape, Tab or a
  // click elsewhere closes it.
  initDrop(field, drop, base) {
    const form = field.form;
    let timer;
    let ctrl;
    let active = -1;
    let last = '';
    const options = () => [...drop.querySelectorAll('[role="option"]')];
    const mark = (i, scroll = true) => {
      const list = options();
      active = Math.max(-1, Math.min(i, list.length - 1));
      list.forEach((el, n) => { el.classList.toggle('is-active', n === active); el.setAttribute('aria-selected', String(n === active)); });
      if (active < 0) { field.removeAttribute('aria-activedescendant'); return; }
      field.setAttribute('aria-activedescendant', list[active].id);
      if (scroll) list[active].scrollIntoView({ block: 'nearest' });
    };
    const show = (on) => {
      const open = on && drop.childElementCount > 0;
      if (open === !drop.hidden) return;
      drop.hidden = !open;
      field.setAttribute('aria-expanded', String(open));
      this.classList.toggle('is-sdrop-open', open);
      if (!open) { mark(-1); this.fitSbar?.(); }
    };
    this.closeDrop = () => show(false);
    // Each result link becomes an option and each list a group named by its heading.
    const adopt = (fresh) => {
      fresh.querySelectorAll('ul').forEach((ul, n) => {
        const head = ul.previousElementSibling;
        ul.setAttribute('role', 'group');
        if (head?.matches('h2')) { head.id = `${drop.id}-h${n}`; head.setAttribute('role', 'presentation'); ul.setAttribute('aria-labelledby', head.id); }
        ul.querySelectorAll('li').forEach((li) => li.setAttribute('role', 'none'));
      });
      fresh.querySelectorAll('[data-ps-item]').forEach((a, n) => {
        a.id = `${drop.id}-o${n}`;
        a.setAttribute('role', 'option');
        a.setAttribute('aria-selected', 'false');
        a.tabIndex = -1;
      });
      drop.replaceChildren(fresh);
      active = -1;
      field.removeAttribute('aria-activedescendant');
      drop.scrollTop = 0;
    };
    const run = async () => {
      const q = field.value.trim();
      ctrl?.abort();
      if (!q) { last = ''; drop.replaceChildren(); show(false); return; }
      if (q === last) { show(document.activeElement === field); return; }
      ctrl = new AbortController();
      try {
        const url = `${base}?q=${encodeURIComponent(q)}&section_id=mu-predictive-search&resources[limit]=6&resources[limit_scope]=each&resources[options][prefix]=last`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return;
        const fresh = new DOMParser().parseFromString(await res.text(), 'text/html').querySelector('[data-ps-results]');
        if (!fresh) return;
        last = q;
        adopt(fresh);
        show(document.activeElement === field);
      } catch (err) { /* aborted (a newer query is on its way) or offline: keep the last results */ }
    };
    field.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 200); });
    field.addEventListener('focus', () => { if (field.value.trim() && field.value.trim() === last) show(true); });
    field.addEventListener('keydown', (e) => {
      const open = !drop.hidden;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) { show(true); return; }
        mark(e.key === 'ArrowDown' ? Math.min(active + 1, options().length - 1) : active - 1);
      } else if (e.key === 'Enter' && open && active >= 0) {
        e.preventDefault();
        options()[active].click();
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        show(false);
      } else if (e.key === 'Tab') show(false);
    });
    // A press on the drop-down keeps the focus in the field (so the click lands on the link); anywhere else closes it.
    drop.addEventListener('mousedown', (e) => e.preventDefault());
    drop.addEventListener('mousemove', (e) => {
      const opt = e.target.closest('[role="option"]');
      if (opt && !opt.classList.contains('is-active')) mark(options().indexOf(opt), false);
    });
    document.addEventListener('pointerdown', (e) => { if (!form.contains(e.target)) show(false); });
    field.addEventListener('blur', () => { if (!drop.hidden && !form.contains(document.activeElement)) setTimeout(() => { if (document.activeElement !== field) show(false); }, 0); });
    this.drops.forEach((d) => d.addEventListener('toggle', () => { if (d.open) show(false); }));
    matchMedia('(min-width: 750px)').addEventListener('change', () => show(false));
  }

  // --mu-head-h: how far the page content starts from the top (header, announcement bar and anything else in the
  // header group). The hero uses it to end at the bottom of the first screen. Re-measured whenever those resize.
  // --mu-sticky-h: how much of the screen top the stuck header covers (0 where it doesn't stick), so sticky
  // product cards can sit just under it. Its height doesn't change when stuck, so it's safe to measure any time.
  measure() {
    const main = document.getElementById('main');
    if (!main || !('ResizeObserver' in window)) return;
    const root = document.documentElement;
    const sec = this.closest('.mu-header-section') || this;
    let frame = 0;
    // Read every geometry value first, then write the two custom properties. Writing --mu-sticky-h before
    // getBoundingClientRect used to force a second layout on load and on every header resize.
    const set = () => {
      frame = 0;
      const cs = getComputedStyle(sec);
      const sticky = cs.position === 'sticky';
      const top = parseFloat(cs.top) || 0;
      const height = sec.offsetHeight;
      const head = this.classList.contains('is-stuck') ? null : Math.round(main.getBoundingClientRect().top + window.scrollY);
      const h = sticky ? Math.max(0, Math.round(height + top)) : 0;
      const sh = `${h}px`;
      if (root.style.getPropertyValue('--mu-sticky-h') !== sh) root.style.setProperty('--mu-sticky-h', sh);
      if (head != null) {
        const hh = `${head}px`;
        if (root.style.getPropertyValue('--mu-head-h') !== hh) root.style.setProperty('--mu-head-h', hh);
      }
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(set); };
    const ro = new ResizeObserver(queue);
    document.querySelectorAll('.shopify-section-group-header-group').forEach((el) => ro.observe(el));
    ro.observe(this);
    matchMedia('(min-width: 750px)').addEventListener('change', queue);
    set();
  }
  initHeroOverlay() {
    const hero = document.querySelector('.mu-main > .shopify-section:first-child > [data-mu-over]');
    if (!hero) return;
    const apply = (kind) => {
      const color = kind === 'dark' ? '#2b2c2b' : '#d8d5cf';
      this.style.setProperty('--mu-ofg', color);
      this.classList.toggle('mu-header--ht-dark', kind === 'dark');
      this.classList.toggle('mu-header--ht-light', kind !== 'dark');
      document.documentElement.style.setProperty('--mu-hero-fg', color);
    };
    const mode = hero.dataset.headerText || 'auto';
    if (mode === 'light' || mode === 'dark') apply(mode);
    else {
      apply('light');
      this.sampleHeroContrast(hero).then(apply).catch(() => apply('light'));
    }
    const barH = () => Math.ceil(this.querySelector('.mu-header__bar')?.getBoundingClientRect().height || 72);
    let io;
    const watch = () => {
      if (io) io.disconnect();
      io = new IntersectionObserver((entries) => {
        const e = entries[0];
        if (!e) return;
        this.classList.toggle('is-solid', !e.isIntersecting);
      }, { root: null, threshold: 0, rootMargin: `-${barH()}px 0px 0px 0px` });
      io.observe(hero);
    };
    watch();
    matchMedia('(min-width: 750px)').addEventListener('change', watch);
  }

  hexLum(hex) {
    const h = String(hex || '').replace('#', '').trim();
    let r, g, b;
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16);
    } else if (h.length >= 6) {
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    } else return 0.1;
    if ([r, g, b].some((n) => Number.isNaN(n))) return 0.1;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  sampleHeroContrast(hero) {
    return new Promise((resolve, reject) => {
      const img = hero.querySelector('.mu-banner__img, .mu-banner__media img, .mu-banner__vid');
      if (!img || img.tagName === 'VIDEO') {
        reject(new Error('no image'));
        return;
      }
      const run = () => {
        const src = img.currentSrc || img.src;
        if (!src) { reject(new Error('no src')); return; }
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => {
          try {
            const header = this.querySelector('.mu-header__bar') || this;
            const media = hero.querySelector('.mu-banner__media') || hero;
            const mediaRect = media.getBoundingClientRect();
            const headRect = header.getBoundingClientRect();
            const nw = im.naturalWidth;
            const nh = im.naturalHeight;
            if (!nw || !nh || mediaRect.width < 2 || headRect.height < 2) { reject(new Error('size')); return; }
            const scale = Math.max(mediaRect.width / nw, mediaRect.height / nh);
            const dw = nw * scale;
            const dh = nh * scale;
            let posX = 0.5;
            let posY = 0.38;
            const pos = (getComputedStyle(img).objectPosition || '50% 38%').trim().split(/\s+/);
            if (pos[0] && pos[0].endsWith('%')) posX = parseFloat(pos[0]) / 100;
            if (pos[1] && pos[1].endsWith('%')) posY = parseFloat(pos[1]) / 100;
            if (Number.isNaN(posX)) posX = 0.5;
            if (Number.isNaN(posY)) posY = 0.38;
            const offX = (mediaRect.width - dw) * posX;
            const offY = (mediaRect.height - dh) * posY;
            const sx = ((headRect.left - mediaRect.left) - offX) / scale;
            const sy = ((headRect.top - mediaRect.top) - offY) / scale;
            const sw = headRect.width / scale;
            const sh = Math.max(1, headRect.height / scale);
            const canvas = document.createElement('canvas');
            const sampleW = 64;
            const sampleH = Math.max(8, Math.round(64 * (headRect.height / Math.max(1, headRect.width))));
            canvas.width = sampleW;
            canvas.height = sampleH;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(im, sx, sy, sw, sh, 0, 0, sampleW, sampleH);
            const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
            let sum = 0;
            let n = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i + 3] < 16) continue;
              sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
              n += 1;
            }
            if (!n) { reject(new Error('empty')); return; }
            const lum = sum / n / 255;
            let op = parseFloat(hero.dataset.overlayOpacity || '0');
            if (op > 1) op = op / 100;
            if (Number.isNaN(op)) op = 0;
            const veil = Math.min(1, Math.max(0, op) * 0.9);
            const blended = this.hexLum(hero.dataset.overlayColor || '#2b2c2b') * veil + lum * (1 - veil);
            resolve(blended < 0.45 ? 'light' : 'dark');
          } catch (err) { reject(err); }
        };
        im.onerror = () => reject(new Error('cors'));
        im.src = src;
      };
      if (img.complete && img.naturalWidth) run();
      else img.addEventListener('load', run, { once: true });
    });
  }

  open() { this.menu?.showModal(); }
  close() { this.menu?.close(); }
}
customElements.get('mu-header') || customElements.define('mu-header', MuHeader);