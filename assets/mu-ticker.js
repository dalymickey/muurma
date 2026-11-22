// Ticker (snippets/mu-ticker). Adds aria-hidden copies of the list until the row is covered twice over, sets the loop
// time from the list width and the speed (pixels per second), and pauses while off screen. With reduced motion the
// copies stay hidden and the still row becomes a focusable scroll region when it overflows.
// In a block so the file can run more than once: every ticker on a page (announcement bar, ticker section,
// testimonials marquee) brings its own script tag.
{
class MuTicker extends HTMLElement {
  connectedCallback() {
    this.view = this.querySelector('.mu-tk__view');
    this.src = this.querySelector('.mu-tk__list');
    if (!this.view || !this.src || this.ro) return;
    this.mq = matchMedia('(prefers-reduced-motion: reduce)');
    this.fit = this.fit.bind(this);
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this);
    this.ro.observe(this.src);
    this.io = new IntersectionObserver((es) => this.classList.toggle('is-off', !es[es.length - 1].isIntersecting));
    this.io.observe(this);
    this.mq.addEventListener('change', this.fit);
    this.btn = this.querySelector('.mu-tk__btn');
    this.btn?.addEventListener('click', () => {
      const on = !this.classList.contains('is-paused');
      this.classList.toggle('is-paused', on);
      this.btn.setAttribute('aria-pressed', String(on));
    });
    this.fit();
  }
  disconnectedCallback() {
    this.ro?.disconnect(); this.io?.disconnect(); this.mq?.removeEventListener('change', this.fit);
    this.ro = this.io = null;
  }
  fit() {
    const w = this.src.getBoundingClientRect().width;
    if (!w) return;
    const still = this.mq.matches;
    const lists = this.view.querySelectorAll('.mu-tk__list');
    const need = still ? 2 : Math.max(2, Math.ceil(this.clientWidth / w) + 1);
    let changed = false;
    for (let i = lists.length; i < need; i++) {
      const copy = this.src.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.inert = true;
      copy.setAttribute('inert', '');
      this.view.append(copy);
      changed = true;
    }
    for (let i = lists.length - 1; i >= need; i--) { lists[i].remove(); changed = true; }
    const speed = Math.max(10, Number(this.dataset.speed) || 60);
    const dur = `${(w / speed).toFixed(2)}s`;
    if (this.style.getPropertyValue('--tk-dur') !== dur) this.style.setProperty('--tk-dur', dur);
    // A new copy starts at 0: restart every list together so they stay in step.
    if (changed && !still) { this.classList.add('is-reset'); void this.offsetWidth; this.classList.remove('is-reset'); }
    const scrolls = still && this.scrollWidth > this.clientWidth + 1;
    if (scrolls) {
      this.tabIndex = 0;
      this.setAttribute('role', 'region');
      this.setAttribute('aria-label', this.dataset.label || '');
    } else {
      this.removeAttribute('tabindex'); this.removeAttribute('role'); this.removeAttribute('aria-label');
    }
  }
}
customElements.get('mu-ticker') || customElements.define('mu-ticker', MuTicker);
}
