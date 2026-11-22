/* Grow on scroll (Rich text and video, centred layout). The media is laid out edge to edge across its card; while it
   rises from the bottom of the screen it is scaled down to the usual inset width (at most 960px inside the card's
   padding) and grows to full size by the time its top reaches the upper third of the screen. Transform only, one rAF
   per frame, and scroll work only while one is near the screen. Reduced motion (or no JS) leaves it at full size. */
(() => {
  if (window.kzGrow) return;
  window.kzGrow = true;
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const items = new Set();
  let raf = 0;

  const paint = () => {
    raf = 0;
    const vh = window.innerHeight;
    items.forEach((el) => {
      if (!el.isConnected) { items.delete(el); return; }
      if (mq.matches) { el.style.transform = ''; el.style.removeProperty('--k'); return; }
      const card = el.parentElement;
      const cs = getComputedStyle(card);
      const inner = card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const full = el.offsetWidth || 1;
      const k0 = Math.min(1, Math.min(960, inner) / full);
      // 0 when the media's top is at the bottom of the screen, 1 when it has risen 70% of the screen height.
      const top = el.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, (vh - top) / (vh * 0.7)));
      const e = 1 - (1 - p) * (1 - p); // ease out
      const k = k0 + (1 - k0) * e;
      el.style.transform = `scale(${k.toFixed(4)})`;
      el.style.setProperty('--k', k.toFixed(4));
    });
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      en.target.kzOn = en.isIntersecting;
      en.target.toggleAttribute('data-mu-grow-on', en.isIntersecting);
    });
    queue();
  }, { rootMargin: '10% 0px' }) : null;

  const init = (root) => {
    if (!io) return;
    root.querySelectorAll('[data-mu-grow]').forEach((el) => {
      if (items.has(el)) return;
      items.add(el);
      io.observe(el);
    });
  };

  addEventListener('scroll', () => { for (const el of items) if (el.kzOn) { queue(); return; } }, { passive: true });
  addEventListener('resize', queue);
  mq.addEventListener('change', queue);
  document.addEventListener('shopify:section:load', (e) => init(e.target));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(document));
  else init(document);
})();
