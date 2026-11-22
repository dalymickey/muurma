/* Collection and search results: the Filter & sort tab (desktop: hides or shows the rail; phones: opens the bottom
   sheet), live filtering through the Section Rendering API, the price slider, and "Load more" (with the section's
   Load automatically setting, data-auto-load, it loads the next page when the button nears the viewport; the button
   stays as the fallback). Every control is a plain link or form underneath, so the page still works without this
   script. */
class MuResults extends HTMLElement {
  connectedCallback() {
    this.desk = window.matchMedia('(min-width: 990px)');
    this.panel = this.querySelector('[data-panel]');
    this.form = this.querySelector('[data-form]');
    this.scrim = this.querySelector('.mu-cl__scrim');
    this.syncTab();
    this.addEventListener('click', (e) => this.onClick(e));
    this.addEventListener('change', (e) => this.onChange(e));
    this.addEventListener('input', (e) => { if (e.target.matches('.mu-f__range')) this.onRange(e.target); });
    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      // Enter in a price box can submit before its change event fires (WebKit), so sync the boxes first.
      this.form.querySelectorAll('[data-price-num]').forEach((n) => this.onPriceNum(n));
      this.close();
      this.apply(this.formUrl());
    });
    this.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.classList.contains('is-open')) this.close(); });
    this.desk.addEventListener('change', () => { this.close(false); this.syncTab(); });
    this.status = this.querySelector('[data-more-status]');
    if (this.hasAttribute('data-auto-load') && 'IntersectionObserver' in window) {
      this.io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting && e.target.offsetParent) this.more(e.target, true); });
      }, { rootMargin: '0px 0px 320px 0px' });
      this.watchMore();
      // A fast fling or a jump to the page end can carry the button past the viewport between two observer checks;
      // a passed button loads too.
      this.onScroll = () => {
        if (this.scrollTick || !this.io) return;
        this.scrollTick = window.requestAnimationFrame(() => {
          this.scrollTick = 0;
          const link = [...this.querySelectorAll('[data-more]')].find((a) => a.offsetParent);
          if (link && link.getBoundingClientRect().top < window.innerHeight + 320) this.more(link, true);
        });
      };
      window.addEventListener('scroll', this.onScroll, { passive: true });
    }
  }

  disconnectedCallback() {
    this.io?.disconnect();
    if (this.onScroll) window.removeEventListener('scroll', this.onScroll);
  }

  // Load automatically: watch the visible "Load more" buttons (phones and desktop each have their own).
  watchMore() {
    if (!this.io) return;
    this.io.disconnect();
    this.querySelectorAll('[data-more]').forEach((a) => this.io.observe(a));
  }

  railShown() {
    return this.desk.matches && this.classList.contains('mu-cl--rail') && !this.classList.contains('is-collapsed');
  }

  syncTab() {
    this.querySelector('[data-tab]')?.setAttribute('aria-expanded', String(this.railShown() || this.classList.contains('is-open')));
  }

  onClick(e) {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      if (this.desk.matches && this.classList.contains('mu-cl--rail')) {
        this.classList.toggle('is-collapsed');
        this.syncTab();
      } else this.open();
      return;
    }
    if (e.target.closest('[data-close]')) { this.close(); return; }
    const more = e.target.closest('[data-more]');
    if (more) { e.preventDefault(); this.more(more); return; }
    const link = e.target.closest('a[data-ajax]');
    if (link) { e.preventDefault(); this.apply(link.href); }
  }

  onChange(e) {
    const t = e.target;
    if (t.matches('[data-price-num]')) this.onPriceNum(t);
    if (t.matches('[data-sort]')) this.querySelectorAll('[data-sort]').forEach((sel) => { sel.value = t.value; });
    if (!this.form || !(this.form.contains(t) || t.getAttribute('form') === this.form.id)) return;
    // On phones the sheet waits for "Show"; sort and the desktop rail apply straight away.
    if (this.classList.contains('is-open') && !t.matches('[data-sort]')) { this.preview(); return; }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.apply(this.formUrl()), 250);
  }

  // Phones: refresh only the panel (counts, the Show button) while the sheet is open.
  async preview() {
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      try {
        const doc = await this.fetchSection(this.formUrl());
        this.swap(doc, ['filters', 'title-count']);
      } catch (err) { /* keep the current panel */ }
    }, 250);
  }

  onRange(input) {
    const box = input.closest('[data-price-range]');
    const lo = box.querySelector('[data-min]');
    const hi = box.querySelector('[data-max-input]');
    const max = Number(box.dataset.max);
    if (Number(lo.value) > Number(hi.value)) {
      if (input === lo) lo.value = hi.value;
      else hi.value = lo.value;
    }
    box.style.setProperty('--lo', `${(lo.value / max) * 100}%`);
    box.style.setProperty('--hi', `${(hi.value / max) * 100}%`);
    const nLo = box.querySelector('[data-price-num="min"]');
    const nHi = box.querySelector('[data-price-num="max"]');
    if (nLo) nLo.value = lo.value;
    if (nHi) nHi.value = hi.value;
  }

  // Min / max boxes: clamp to the range and move the matching handle, then filter like the slider does.
  onPriceNum(input) {
    const box = input.closest('[data-price-range]');
    const max = Number(box.dataset.max);
    const lo = box.querySelector('[data-min]');
    const hi = box.querySelector('[data-max-input]');
    const isMin = input.dataset.priceNum === 'min';
    let v = Math.round(Number(input.value));
    if (input.value === '' || Number.isNaN(v)) v = isMin ? 0 : max;
    v = Math.min(max, Math.max(0, v));
    if (isMin) lo.value = String(Math.min(v, Number(hi.value)));
    else hi.value = String(Math.max(v, Number(lo.value)));
    this.onRange(isMin ? lo : hi);
  }

  formUrl() {
    const data = new FormData(this.form);
    const sort = this.querySelector('[data-sort]')?.value;
    data.delete('sort_by');
    if (sort) data.set('sort_by', sort);
    this.form.querySelectorAll('[data-price-range]').forEach((box) => {
      const lo = box.querySelector('[data-min]');
      const hi = box.querySelector('[data-max-input]');
      if (Number(lo.value) <= 0) data.delete(lo.name);
      if (Number(hi.value) >= Number(box.dataset.max)) data.delete(hi.name);
    });
    const params = new URLSearchParams(data).toString();
    return `${this.form.action}${params ? `?${params}` : ''}`;
  }

  async fetchSection(url) {
    const u = new URL(url, window.location.origin);
    u.searchParams.set('section_id', this.dataset.section);
    const res = await fetch(u);
    if (!res.ok) throw new Error(String(res.status));
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }

  swap(doc, only) {
    const focusId = document.activeElement?.id;
    doc.querySelectorAll('[data-part]').forEach((fresh) => {
      if (only && !only.includes(fresh.dataset.part)) return;
      this.querySelector(`[data-part="${fresh.dataset.part}"]`)?.replaceWith(fresh);
    });
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  }

  async apply(url) {
    this.classList.add('is-loading');
    try {
      const doc = await this.fetchSection(url);
      this.swap(doc);
      this.watchMore();
      const u = new URL(url, window.location.origin);
      u.searchParams.delete('section_id');
      window.history.replaceState({}, '', u);
    } catch (err) {
      window.location.href = url;
    } finally {
      this.classList.remove('is-loading');
    }
  }

  // auto: started by scrolling (Load automatically), so focus stays where it is and a failure leaves the button.
  async more(link, auto = false) {
    if (this.loadingMore || link.getAttribute('aria-busy') === 'true') return;
    this.loadingMore = true;
    link.setAttribute('aria-busy', 'true');
    try {
      const doc = await this.fetchSection(link.href);
      const fresh = doc.querySelector('[data-bands]');
      const chunks = this.querySelectorAll('[data-bands]');
      const prev = chunks[chunks.length - 1];
      if (!fresh || !prev) throw new Error('no results');
      // The old "Load more" buttons go, and the last bands lose the space kept for them.
      prev.querySelectorAll('.mu-band__more').forEach((el) => el.remove());
      prev.querySelectorAll('.mu-band--more').forEach((el) => el.classList.remove('mu-band--more'));
      prev.classList.remove('mu-bands--more');
      // Phones: a card held back from the last page fills the slot saved at the top of this one.
      const held = prev.querySelector('.mu-band__item--defer');
      const slot = fresh.querySelector('[data-carry]');
      if (held && slot) {
        const copy = held.cloneNode(true);
        copy.classList.remove('mu-band__item--defer');
        copy.classList.add('mu-only-p');
        copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        slot.replaceWith(copy);
        held.classList.replace('mu-band__item--defer', 'mu-only-d');
      }
      prev.after(fresh);
      const items = [...fresh.querySelectorAll('.mu-band__item')].filter((el) => el.offsetParent);
      if (!auto) items[0]?.querySelector('a[href]')?.focus({ preventScroll: true });
      this.announce(fresh);
      this.loadingMore = false;
      this.watchMore();
    } catch (err) {
      this.loadingMore = false;
      if (auto) { link.removeAttribute('aria-busy'); this.io?.disconnect(); this.io = null; return; }
      window.location.href = link.href;
    }
  }

  // Screen readers hear how many products now show, e.g. "More products loaded. Showing 48 of 120."
  announce(fresh) {
    if (!this.status || !this.status.dataset.msg) return;
    const shown = [...this.querySelectorAll('.mu-band__item')].filter((el) => el.offsetParent && !el.hasAttribute('data-carry')).length;
    const total = fresh.dataset.total || '';
    this.status.textContent = '';
    window.setTimeout(() => { this.status.textContent = this.status.dataset.msg.replace('__N__', shown).replace('__T__', total); }, 50);
  }

  open() {
    if (!this.panel) return;
    this.lastFocus = document.activeElement;
    this.classList.add('is-open');
    this.panel.setAttribute('aria-modal', 'true');
    this.scrim.hidden = false;
    document.documentElement.classList.add('mu-lock');
    this.syncTab();
    this.panel.focus();
  }

  close(restore = true) {
    if (!this.classList.contains('is-open')) return;
    this.classList.remove('is-open');
    this.panel?.setAttribute('aria-modal', 'false');
    this.scrim.hidden = true;
    document.documentElement.classList.remove('mu-lock');
    this.syncTab();
    if (restore) this.lastFocus?.focus();
  }
}
customElements.get('mu-results') || customElements.define('mu-results', MuResults);
