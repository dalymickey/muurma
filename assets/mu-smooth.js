/* Smooth scroll (Theme settings > Animations): eases the window toward a wheel-driven target with window.scrollTo,
   so sticky, fixed, scroll timelines and observers behave as usual. Mouse and trackpad only; native scrolling is
   kept for touch, reduced motion, the theme editor, zoom, sideways wheels, locked pages and scrollable insides. */
(() => {
  if (window.Shopify?.designMode) return;
  const k = +document.currentScript?.dataset.ease || 0.1;
  const mq = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const h = document.documentElement;
  let y = scrollY, t = y, set = -1, last = 0, raf = 0;
  const max = () => h.scrollHeight - innerHeight;
  const locked = () => {
    if (h.classList.contains('mu-locked') || h.classList.contains('mu-lock')) return true;
    try { if (document.querySelector('dialog:modal')) return true; } catch (e) { if (document.querySelector('dialog[open]')) return true; }
    return getComputedStyle(h).overflowY === 'hidden' || getComputedStyle(document.body).overflowY === 'hidden';
  };
  const inner = (el, d) => {
    for (; el && el !== document.body && el !== h; el = el.parentElement) {
      if (el.matches('select, textarea, iframe, [data-native-scroll]')) return true;
      const o = getComputedStyle(el).overflowY;
      if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        if (d < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
      }
    }
    return false;
  };
  // Time-based easing: the same feel at 30, 60 or 120 frames per second.
  const step = (now) => {
    y += (t - y) * (1 - Math.pow(1 - k, Math.min(4, (now - (last || now - 16.7)) / 16.7)));
    last = now;
    if (Math.abs(t - y) < 0.5) y = t;
    scrollTo({ top: y, behavior: 'instant' });
    set = Math.round(y);
    raf = y === t ? 0 : requestAnimationFrame(step);
  };
  const stop = () => { cancelAnimationFrame(raf); raf = last = 0; y = t = scrollY; };
  addEventListener('wheel', (e) => {
    if (!mq.matches || e.ctrlKey || e.defaultPrevented || e.shiftKey) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || !e.deltaY) return;
    if (locked() || inner(e.target, e.deltaY)) { if (raf) stop(); return; }
    e.preventDefault();
    if (!raf) { y = t = scrollY; last = 0; }
    const d = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1);
    t = Math.max(0, Math.min(max(), t + d));
    raf ||= requestAnimationFrame(step);
  }, { passive: false });
  // Keyboard, scrollbar, find-in-page and anchor jumps move the page natively; follow them.
  addEventListener('scroll', () => { if (Math.abs(scrollY - set) > 2) stop(); }, { passive: true });
})();
