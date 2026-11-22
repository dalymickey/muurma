/* Float repel: hero floats ease away from the mouse and drift back (section setting "Floats react to the cursor").
   Sets --rx/--ry on each float; CSS adds them on their own property so scroll drift, bobbing and tilt keep running.
   The push fades to zero both at the edge of its reach (cosine) and at the float's centre, so it never jumps, and
   each float eases from where it is toward its target on elapsed time, so it feels the same at any frame rate.
   Any other element marked data-repel (a stage backdrop) moves too, data-repel="2" pushing twice as far; a
   negative value (a backdrop) moves toward the mouse instead, opposite to the cut-out.
   Positions come from offsets, which ignore transforms, so the push never feeds back into itself. */
(() => {
  const mq = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const F = 16, R = 280, CORE = 70;
  const init = (r) => {
    if (r.dataset.repelOn) return;
    r.dataset.repelOn = 1;
    const fl = [...r.querySelectorAll('.mu-float, [data-repel]')].map((el) => ({ el, x: 0, y: 0, k: +el.dataset.repel || 1 }));
    let mx = 0, my = 0, on = 0, raf = 0, t0 = 0;
    const frame = (now) => {
      const dt = Math.min(64, now - (t0 || now - 16.7));
      let busy = 0;
      t0 = now;
      fl.forEach((o) => {
        const el = o.el, p = el.offsetParent;
        let tx = 0, ty = 0;
        if (on && p) {
          const b = p.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
          const dx = b.left + el.offsetLeft + w / 2 - mx, dy = b.top + el.offsetTop + h / 2 - my;
          const d = Math.hypot(dx, dy) || 1, reach = R + Math.max(w, h) / 2;
          if (d < reach) {
            const m = F * o.k * (0.5 + 0.5 * Math.cos(Math.PI * d / reach)) * Math.min(1, d / CORE) / d;
            tx = dx * m; ty = dy * m;
          }
        }
        const a = 1 - Math.exp(-dt / (on ? 180 : 360));
        let sx = (tx - o.x) * a, sy = (ty - o.y) * a;
        const v = Math.hypot(sx, sy), cap = dt * 0.11 * Math.abs(o.k); // speed limit (~1.8px per 60Hz frame) so a fast sweep never jolts
        if (v > cap) { sx *= cap / v; sy *= cap / v; }
        o.x += sx; o.y += sy;
        if (Math.abs(tx - o.x) + Math.abs(ty - o.y) < 0.05) { o.x = tx; o.y = ty; } else busy = 1;
        el.style.setProperty('--rx', o.x.toFixed(2) + 'px');
        el.style.setProperty('--ry', o.y.toFixed(2) + 'px');
      });
      raf = busy ? requestAnimationFrame(frame) : (t0 = 0);
    };
    const ask = () => { raf ||= requestAnimationFrame(frame); };
    r.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !mq.matches) return;
      mx = e.clientX; my = e.clientY; on = 1; ask();
    });
    r.addEventListener('pointerleave', () => { on = 0; ask(); });
    addEventListener('scroll', () => { if (on) ask(); }, { passive: true });
  };
  const all = () => document.querySelectorAll('[data-mu-repel]').forEach(init);
  all();
  document.addEventListener('shopify:section:load', all);
})();
