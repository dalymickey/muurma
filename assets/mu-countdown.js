/* Countdown (sections/mu-countdown and the countdown in the header's announcement bar). Counts down to data-end (an
   ISO date-time with its offset), writes the end date in the shopper's language and time zone, and updates a polite
   live region at most once a minute; the tiles and the compact bar timer are aria-hidden. Ticks every second when
   seconds show, otherwise every 15 seconds, and only while the page is visible. At the end the section hides itself
   or swaps in its end card in the timer's place; the bar timer just takes itself away.
   Guarded: the section and the header can both load this file on one page. */
if (!customElements.get('mu-countdown')) {
  customElements.define('mu-countdown', class extends HTMLElement {
    connectedCallback() {
      this.end = Date.parse(this.dataset.end);
      if (Number.isNaN(this.end) || this.timer) return;
      const json = this.querySelector('[data-strings]');
      this.t = json ? JSON.parse(json.textContent) : {};
      this.u = {};
      this.querySelectorAll('[data-unit]').forEach((el) => { this.u[el.dataset.unit] = el; });
      this.out = this.querySelector('[data-out]');
      this.live = this.querySelector('[data-live]');
      this.text = this.querySelector('[data-live-text]');
      this.secs = Boolean(this.u.s || this.out);
      this.said = '';
      if (this.text && this.t.ends && !this.classList.contains('is-ended')) {
        try {
          this.text.textContent = this.t.ends.replace('__DATE__', this.formatEnd());
        } catch (_) { /* keep the server-written date */ }
      }
      this.tick();
      this.timer = setInterval(() => { if (!document.hidden) this.tick(); }, this.secs ? 1000 : 15000);
      this.onVis = () => { if (!document.hidden) this.tick(); };
      document.addEventListener('visibilitychange', this.onVis);
    }
    formatEnd() {
      const tz = this.dataset.timezone || 'Australia/Sydney';
      const lang = this.dataset.locale || document.documentElement.lang || 'en-AU';
      const parts = new Intl.DateTimeFormat(lang, {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZone: tz, timeZoneName: 'short'
      }).formatToParts(new Date(this.end));
      const g = (t) => (parts.find((p) => p.type === t) || {}).value || '';
      const weekday = g('weekday').replace(/\.$/, '');
      const period = (g('dayPeriod') || '').replace(/\s+/g, '').toLowerCase();
      return `${weekday} ${g('day')} ${g('month')}, ${g('hour')}:${g('minute')}${period} ${g('timeZoneName')}`.replace(/\s+/g, ' ').trim();
    }
    disconnectedCallback() {
      clearInterval(this.timer);
      this.timer = null;
      document.removeEventListener('visibilitychange', this.onVis);
    }
    tick() {
      const left = Math.max(0, this.end - Date.now());
      if (left === 0) { this.finish(); return; }
      const secs = Math.floor(left / 1000);
      const mins = Math.floor(secs / 60);
      const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60, s = secs % 60;
      const pad = (n) => String(n).padStart(2, '0');
      const put = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
      put(this.u.d, pad(d)); put(this.u.h, pad(h)); put(this.u.m, pad(m)); put(this.u.s, pad(s));
      if (this.out) {
        const tpl = d > 0 ? this.t.short_days : this.t.short;
        if (tpl) put(this.out, tpl.replace('__D__', d).replace('__H__', pad(h)).replace('__M__', pad(m)).replace('__S__', pad(s)));
      }
      if (this.live && this.t.left) {
        const said = this.t.left.replace('__D__', d).replace('__H__', h).replace('__M__', m);
        // The first reading isn't announced (the page just loaded); after that, once each minute.
        if (said !== this.said && this.said) this.live.textContent = said;
        this.said = said;
      }
    }
    finish() {
      clearInterval(this.timer);
      if (window.Shopify && Shopify.designMode) return;
      if (this.out) { this.remove(); return; }
      if (this.dataset.after === 'hide') { const sec = this.closest('.shopify-section'); if (sec) sec.hidden = true; return; }
      this.classList.add('is-ended');
      this.querySelector('[data-cd-timer]')?.remove();
      this.querySelectorAll('[data-cd-live-only]').forEach((el) => el.remove());
      const card = this.querySelector('[data-end-card]');
      if (card) card.hidden = false;
      if (this.live && this.t.ended) this.live.textContent = this.t.ended;
    }
  });
}