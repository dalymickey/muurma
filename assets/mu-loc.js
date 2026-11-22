/* Country / language pickers (snippets/mu-loc). Each option is a submit button, so they work without JS; this adds the
   search field on long lists (accent-insensitive), arrow keys, Escape and closing on an outside click.
   The option lists arrive inside <noscript> (shown as is without JS), so the page doesn't carry a few hundred buttons
   per picker; they are built the first time a picker is pointed at, focused or opened. layout/theme.liquid
   loads this file once when any picker (header, menu, footer) is on the page; the guard keeps it to one setup. */
(() => {
  if (window.kzLoc) return;
  window.kzLoc = true;
  // The list markup held in a picker's <noscript>, parsed but not yet in the page.
  const parse = (dd) => {
    const ns = dd.querySelector('noscript[data-loc-src]');
    if (!ns) return null;
    const t = document.createElement('template');
    t.innerHTML = ns.textContent;
    return { ns, frag: t.content };
  };
  const fill = (dd) => {
    const p = parse(dd);
    if (p) p.ns.replaceWith(p.frag);
  };
  const norm = (v) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fine = matchMedia('(pointer: fine)');
  const visible = (dd) => [...dd.querySelectorAll('[data-loc-opt]')].filter((b) => !b.closest('[data-loc-item]').hidden);
  // Floating panels (the footer pickers) stay inside the viewport and any clipping ancestor (the footer's rounded box):
  // narrowed to fit, lined up with the trigger's right edge when they would run off the right, and flipped below the
  // trigger when there is no room above.
  const place = (dd) => {
    const panel = dd.querySelector('.mu-loc__panel');
    if (!panel || getComputedStyle(panel).position !== 'absolute') return;
    panel.style.translate = ''; panel.style.maxWidth = ''; panel.style.top = ''; panel.style.bottom = '';
    let l = 8, r = document.documentElement.clientWidth - 8, t = 8;
    for (let el = dd.parentElement; el && el !== document.body; el = el.parentElement) {
      if (getComputedStyle(el).overflowX === 'visible') continue;
      const b = el.getBoundingClientRect();
      l = Math.max(l, b.left + 12); r = Math.min(r, b.right - 12); t = Math.max(t, b.top + 12);
    }
    panel.style.maxWidth = `${Math.max(r - l, 200)}px`;
    const p = panel.getBoundingClientRect();
    const s = dd.querySelector('summary').getBoundingClientRect();
    let x = 0;
    if (p.right > r) x = Math.min(s.right, r) - p.right;
    if (p.left + x < l) x = l - p.left;
    if (x) panel.style.translate = `${Math.round(x)}px 0`;
    if (p.top < t) { panel.style.top = 'calc(100% + 8px)'; panel.style.bottom = 'auto'; }
  };
  let raf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => document.querySelectorAll('[data-loc-dd][open]').forEach(place));
  });
  document.querySelectorAll('[data-loc-dd]').forEach((dd) => {
    const input = dd.querySelector('[data-loc-search]');
    const none = dd.querySelector('[data-loc-none]');
    if (input) {
      input.closest('[data-loc-search-wrap]').hidden = false;
      input.addEventListener('input', () => {
        const q = norm(input.value.trim());
        let n = 0;
        dd.querySelectorAll('[data-loc-item]').forEach((li) => {
          const hit = !q || norm(li.querySelector('[data-loc-opt]').dataset.q).includes(q);
          li.hidden = !hit;
          if (hit) n += 1;
        });
        if (none) none.hidden = n > 0;
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); visible(dd)[0]?.click(); }
      });
    }
    const summary = dd.querySelector('summary');
    // Built just before it opens (a click on the summary comes before the toggle), or on hover / focus to be ready.
    summary.addEventListener('click', () => fill(dd));
    summary.addEventListener('focus', () => fill(dd), { once: true });
    dd.addEventListener('pointerenter', () => fill(dd), { once: true });
    dd.addEventListener('toggle', () => {
      if (!dd.open) return;
      fill(dd);
      document.querySelectorAll('[data-loc-dd][open]').forEach((o) => { if (o !== dd) o.open = false; });
      place(dd);
      const cur = dd.querySelector('[data-loc-opt][aria-current="true"]');
      const list = cur?.closest('ul');
      if (cur && list) list.scrollTop = cur.parentElement.offsetTop - list.offsetTop - 40;
      if (input && fine.matches) input.focus();
    });
    dd.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dd.open) {
        e.stopPropagation();
        dd.open = false;
        dd.querySelector('summary').focus();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (!dd.open) return;
      const opts = visible(dd);
      if (!opts.length) return;
      e.preventDefault();
      const i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') opts[i < 0 ? 0 : Math.min(i + 1, opts.length - 1)].focus();
      else if (i <= 0) (input || dd.querySelector('summary')).focus();
      else opts[i - 1].focus();
    });
  });
  document.addEventListener('click', (e) => {
    document.querySelectorAll('[data-loc-dd][open]').forEach((dd) => { if (!dd.contains(e.target)) dd.open = false; });
  });
  // Touch screens: an invisible native <select> lies over each trigger, so a tap opens the system picker (iOS wheel /
  // Android sheet) instead of the floating panel. The system picker is drawn outside the page, so nothing on it can be
  // clipped by the footer, covered by Safari's toolbars, a fixed bar or the preview bar, or moved by a viewport resize
  // mid-tap. Picking submits the same localization form the panel's buttons do.
  if (!matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  document.querySelectorAll('[data-loc-dd]').forEach((dd) => {
    const field = dd.closest('.mu-loc__field');
    // The select is filled from the list markup without putting the list itself in the page.
    const src = parse(dd);
    const opts = [...(src ? src.frag : dd).querySelectorAll('[data-loc-opt]')];
    if (!field || !opts.length || field.querySelector('.mu-loc__native')) return;
    const sel = document.createElement('select');
    sel.className = 'mu-loc__native';
    sel.setAttribute('aria-label', (dd.querySelector('summary .visually-hidden')?.textContent || '').replace(/[:\s]+$/, ''));
    opts.forEach((b) => {
      const o = new Option([b.querySelector('.mu-loc__oname'), b.querySelector('.mu-loc__ocur')].filter(Boolean).map((n) => n.textContent.trim()).join(' · '), b.value);
      if (b.lang) o.lang = b.lang;
      o.selected = b.getAttribute('aria-current') === 'true';
      sel.add(o);
    });
    sel.addEventListener('change', () => {
      const form = dd.closest('form');
      const b = opts.find((x) => x.value === sel.value);
      if (!form || !b) return;
      const hid = document.createElement('input');
      hid.type = 'hidden'; hid.name = b.name; hid.value = b.value;
      form.append(hid);
      form.submit();
    });
    dd.querySelector('summary').tabIndex = -1;
    dd.setAttribute('aria-hidden', 'true');
    field.classList.add('mu-loc__field--native');
    field.append(sel);
  });
})();
