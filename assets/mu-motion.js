/* Section motion: Theme settings > Animations, and each section's Animate on scroll. Loaded once, from the layout.
   Reveal: a section root carries data-mu-anim="<items>" (empty: the root itself). Items still below the first screen
   start lowered and clear (mu-ai, CSS in mu-base.css; in a sideways rail the cards only fade and the rail rises) and play once as they enter, staggered with the others entering
   at the same time; afterwards the classes come off, so nothing keeps a transform. Items already on screen, headings
   with a title effect (mu-fx) and everything in the theme editor or with reduced motion are never hidden.
   Scroll progress: elements matched by data-mu-p get --mu-p, 0 as their top meets the bottom of the screen to 1 as
   their bottom leaves the top, while near the screen. One rAF per frame; the CSS uses scale/translate only. */
(() => {
  if (window.kzMotion) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const edit = !!(window.Shopify && Shopify.designMode);
  const seen = new WeakSet();
  const pos = (e) => e.boundingClientRect;
  const io = new IntersectionObserver((es) => {
    let n = 0;
    es.filter((e) => e.isIntersecting).sort((a, b) => pos(a).top - pos(b).top || pos(a).left - pos(b).left).forEach((e) => {
      const el = e.target;
      io.unobserve(el);
      el.style.setProperty('--i', Math.min(n++, 6));
      el.classList.add('is-in');
      setTimeout(() => { el.classList.remove('mu-ai', 'is-in'); el.style.removeProperty('--i'); }, 1900);
      const rail = el.parentElement;
      if (rail.classList.contains('mu-air') && !rail.classList.contains('is-in')) {
        rail.classList.add('is-in');
        setTimeout(() => rail.classList.remove('mu-air', 'is-in'), 1900);
      }
      // In a swipe rail, the cards past the edge show at once, so swiping never finds a gap.
      if (rail.scrollWidth > rail.clientWidth + 1) {
        const box = rail.getBoundingClientRect();
        [...rail.children].forEach((x) => {
          if (!x.classList.contains('mu-ai') || x.classList.contains('is-in')) return;
          const r = x.getBoundingClientRect();
          if (r.left >= Math.min(box.right, innerWidth) - 1 || r.right <= Math.max(box.left, 0) + 1) { io.unobserve(x); x.classList.remove('mu-ai'); }
        });
      }
    });
  }, { rootMargin: '0px 0px -6% 0px' });
  const live = new Set();
  let raf = 0;
  const paint = () => {
    raf = 0;
    const vh = innerHeight;
    live.forEach((el) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mu-p', Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))).toFixed(3));
    });
  };
  const tick = () => { if (!raf && live.size) raf = requestAnimationFrame(paint); };
  const near = new IntersectionObserver((es) => {
    es.forEach((e) => (e.isIntersecting ? live.add(e.target) : live.delete(e.target)));
    tick();
  }, { rootMargin: '120px 0px' });
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick, { passive: true });
  const scan = (root = document) => {
    if (calm.matches) return;
    root.querySelectorAll('[data-mu-p]').forEach((s) => {
      (s.dataset.kzP ? s.querySelectorAll(s.dataset.kzP) : [s]).forEach((el) => near.observe(el));
    });
    if (edit) return;
    // Read every position first, then hide, so the page lays out once rather than once per item.
    const vh = innerHeight, list = [];
    root.querySelectorAll('[data-mu-anim]').forEach((s) => {
      (s.dataset.kzAnim ? s.querySelectorAll(s.dataset.kzAnim) : [s]).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (!el.closest('[data-mu-fx]')) list.push(el);
      });
    });
    // Cards in a sideways scroller only fade, and the scroller rises as one: any transform on a snapped card moves its
    // snap point, and the browser re-snaps the row sideways as the card settles.
    const rails = new Map();
    const inRail = (p) => {
      if (!rails.has(p)) rails.set(p, p.scrollWidth > p.clientWidth + 1 || /auto|scroll/.test(getComputedStyle(p).overflowX));
      return rails.get(p);
    };
    list.filter((el) => { const r = el.getBoundingClientRect(); return r.top >= vh && r.height; })
      .map((el) => [el, inRail(el.parentElement)])
      .forEach(([el, rail]) => {
        el.classList.add('mu-ai');
        if (rail) { el.classList.add('mu-ai--rail'); el.parentElement.classList.add('mu-air'); }
        io.observe(el);
      });
  };
  window.kzMotion = scan;
  // The first scan waits for the first paint, so it never forces the page's first layout. Only items below the first
  // screen are hidden, so nothing visible changes.
  const first = () => requestAnimationFrame(() => setTimeout(scan, 0));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', first); else first();
  document.addEventListener('shopify:section:load', (e) => scan(e.target));
})();
