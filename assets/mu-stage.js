/* Stage carousel hero: scroll-snap row plus wheel, drag, keys, arrows and click-to-stage; swaps background, floats
   (the level sets, or art blocks shown on one slide) and panel for the product on stage. Sets --a per product only where CSS view timelines are missing. */
(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const SD = CSS.supports('animation-timeline: view()');
  const init = (r) => {
    if (r.dataset.ready) return;
    r.dataset.ready = 1;
    const t = r.querySelector('[data-track]');
    const items = [...t.children];
    const n = items.length;
    const q = (s) => [...r.querySelectorAll(s)];
    const layers = [items, q('.mu-stage__bg'), q('.mu-stage__info'), q('.mu-stage__bd')];
    const own = q('.mu-float[data-show]'); // art blocks set to "Show on" one slide
    const [prev, next] = q('[data-step]');
    const live = r.querySelector('[data-live]');
    let cur = 0, want = 0, raf = 0, busy = 0, drag = null, moved = 0, say = 0;
    const slot = () => items[1].offsetLeft - items[0].offsetLeft || 1;
    const pos = () => t.scrollLeft / slot();
    const clamp = (i) => Math.max(0, Math.min(n - 1, i));
    const go = (i, smooth = !RM.matches) => {
      i = clamp(i);
      busy = performance.now() + 900;
      t.scrollTo({ left: i * slot(), behavior: smooth ? 'smooth' : 'auto' });
      return (want = i);
    };
    const set = (i) => {
      if (i === cur) return;
      cur = i;
      layers.forEach((l) => l.forEach((el) => {
        const on = +el.dataset.i === i;
        el.classList.toggle('is-on', on);
        if (el.classList.contains('mu-stage__info')) el.hidden = !on;
      }));
      own.forEach((f) => f.classList.toggle('is-on', +f.dataset.show === i));
      const bg = layers[1][i];
      if (bg) {
        const fg = getComputedStyle(bg).getPropertyValue('--g-fg');
        r.style.setProperty('--fg', fg);
        // First on the page: a transparent header reads this to keep its text on the slide's color.
        if (r.hasAttribute('data-top')) document.documentElement.style.setProperty('--mu-hero-fg', fg);
      }
      prev.disabled = i === 0;
      next.disabled = i === n - 1;
      clearTimeout(say);
      say = setTimeout(() => { live.textContent = layers[3][i].dataset.say; }, 500);
    };
    const frame = () => {
      raf = 0;
      const p = pos();
      if (!SD && !RM.matches) items.forEach((el, k) => {
        el.style.setProperty('--a', Math.abs(k - p).toFixed(3));
      });
      const k = clamp(Math.round(p));
      set(k);
      // Keep the target of a programmatic glide until it lands, so a swipe mid-glide goes one further, not nowhere.
      if (!drag && Math.abs(p - k) < .03 && (k === want || performance.now() > busy)) want = k;
    };
    t.addEventListener('scroll', () => { raf ||= requestAnimationFrame(frame); }, { passive: true });

    // Wheel: a gesture is a run of wheel events less than 150 ms apart (a trackpad swipe and its inertia tail, or a
    // burst of notches). Its axis comes from the summed deltas, so slightly diagonal swipes still count; Shift+wheel is
    // always sideways. A sideways gesture turns exactly one slide; vertical ones are left alone to scroll the page.
    // A reversal, or a new swipe rising out of a faded inertia tail, starts a new gesture so quick repeats are not lost.
    let g = 0, gx = 0, gy = 0, sx = 0, fired = 0, low = 1e9, lastT = -1e9, end = 0, lastA = 0, cap = 0, cnt = 0;
    r.addEventListener('wheel', (e) => {
      if (e.ctrlKey) return;
      const m = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
      const x = (e.shiftKey ? e.deltaX || e.deltaY : e.deltaX) * m, y = e.shiftKey ? 0 : e.deltaY * m, ab = Math.abs(x);
      const now = e.timeStamp;
      if (now - lastT > 150 || (g === 1 && ab > 4 && Math.sign(x) !== sx) || (fired && low < 4 && ab > 4 * low + 10)) {
        // After a stall, a turned trackpad gesture's fading tail can resume; it stays swallowed unless it rises like a
        // new swipe. Single mouse notches never set this, so slow notches still turn one slide each.
        cap = fired && cnt > 4 && now - lastT > 150 && now - lastT < 1000 ? lastA * 1.5 + 6 : 0;
        g = gx = gy = fired = cnt = 0; low = 1e9;
      }
      lastT = now; lastA = ab; cnt++;
      if (cap && ab > cap) cap = 0;
      if (cap && ab >= Math.abs(y)) { fired = 1; e.preventDefault(); return; }
      gx += x; gy += y;
      if (!g && Math.abs(gx) + Math.abs(gy) > 6) { g = Math.abs(gx) > Math.abs(gy) * 0.7 ? 1 : 2; sx = Math.sign(gx); }
      if (g === 2 || (!g && ab <= Math.abs(y))) return;
      e.preventDefault();
      // A small sideways tick (a mouse notch can be 4px) that never reached the threshold still turns once it ends.
      clearTimeout(end);
      end = setTimeout(() => { if (!fired && g !== 2 && Math.abs(gx) >= 3) { fired = 1; go(want + Math.sign(gx)); } }, 150);
      if (fired) { low = Math.min(low, ab); return; }
      if (g === 1 && Math.abs(gx) >= 20) { fired = 1; go(want + sx); }
    }, { passive: false });

    // Mouse drag; touch and pens use native scrolling.
    t.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button) return;
      drag = { x: e.clientX, l: t.scrollLeft };
      moved = 0;
    });
    addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!moved && Math.abs(dx) > 5) { moved = 1; t.classList.add('is-drag'); }
      if (moved) t.scrollLeft = drag.l - dx;
    });
    addEventListener('pointerup', () => {
      if (!drag) return;
      drag = null;
      if (!moved) return;
      const p = pos();
      t.classList.remove('is-drag');
      t.scrollLeft = p * slot();
      go(Math.round(p));
    });
    t.addEventListener('click', (e) => {
      const li = e.target.closest('.mu-stage__item');
      if (!li) return;
      // A drag or a side product never follows the link or opens quick view (assets/mu-quick-add.js listens on the document).
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = 0; return; }
      if (+li.dataset.i !== cur) { e.preventDefault(); e.stopPropagation(); go(+li.dataset.i); }
    });
    q('[data-step]').forEach((b) => b.addEventListener('click', () => go(cur + +b.dataset.step)));
    r.addEventListener('keydown', (e) => {
      if (e.target !== t && !e.target.dataset.step) return;
      const k = { ArrowLeft: cur - 1, ArrowRight: cur + 1, Home: 0, End: n - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      go(k);
    });
    // Editor: selecting a product block, or an art block shown on one slide, brings that slide on stage.
    const sid = r.closest('.shopify-section')?.id.replace('shopify-section-', '');
    document.addEventListener('shopify:block:select', (e) => {
      if (!r.isConnected || (e.detail?.sectionId !== sid && !r.contains(e.target))) return;
      const li = r.contains(e.target) && e.target.closest?.('.mu-stage__item');
      const fl = own.find((f) => f.dataset.bid === e.detail?.blockId);
      if (li) go(+li.dataset.i, false);
      else if (fl) go(+fl.dataset.show, false);
    });
    new ResizeObserver(() => { t.scrollLeft = cur * slot(); frame(); }).observe(t);
    frame();
  };
  const all = () => document.querySelectorAll('[data-mu-stage]').forEach((r) => r.querySelector('[data-track]') && init(r));
  all();
  document.addEventListener('shopify:section:load', all);
})();
