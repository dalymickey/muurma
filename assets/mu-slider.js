/* Desktop slider for a .mu-rail: previous / next buttons scroll by the number of whole items in view and hide at
   the ends. When everything fits, the buttons hide (data-static). Swiping and keyboard scrolling keep working.
   Several sections can load this file on one page, so the class lives in a block and is defined once. */
if (!customElements.get('mu-slider')) {
class MuSlider extends HTMLElement {
  connectedCallback() {
    this.rail = this.querySelector('[data-rail]');
    this.prev = this.querySelector('[data-prev]');
    this.next = this.querySelector('[data-next]');
    if (!this.rail || !this.prev || !this.next) return;
    this.prev.addEventListener('click', () => this.step(-1));
    this.next.addEventListener('click', () => this.step(1));
    this.update = this.update.bind(this);
    this.rail.addEventListener('scroll', this.update, { passive: true });
    this.ro = new ResizeObserver(this.update);
    this.ro.observe(this.rail);
    this.update();
  }
  disconnectedCallback() { if (this.ro) this.ro.disconnect(); }
  step(dir) {
    const r = this.rail;
    const item = r.firstElementChild;
    const gap = parseFloat(getComputedStyle(r).columnGap) || 0;
    const w = item ? item.getBoundingClientRect().width + gap : r.clientWidth;
    const n = Math.max(1, Math.floor((r.clientWidth + gap) / w));
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    r.scrollBy({ left: dir * n * w, behavior: smooth ? 'smooth' : 'auto' });
  }
  update() {
    const r = this.rail;
    const max = r.scrollWidth - r.clientWidth;
    this.toggleAttribute('data-static', max <= 2);
    // No looping: the button with nowhere to go is disabled and fades out (.is-end), out of the tab order and hidden
    // from assistive tech. If it had focus, focus moves to the other button (or the rail).
    const was = document.activeElement;
    [[this.prev, r.scrollLeft <= 2], [this.next, r.scrollLeft >= max - 2]].forEach(([b, off]) => {
      b.disabled = off;
      b.classList.toggle('is-end', off);
      if (off) b.setAttribute('aria-hidden', 'true'); else b.removeAttribute('aria-hidden');
    });
    if ((was === this.prev || was === this.next) && was.disabled) {
      const other = was === this.prev ? this.next : this.prev;
      (other.disabled ? this.rail : other).focus({ preventScroll: true });
    }
  }
}
customElements.define('mu-slider', MuSlider);
}
