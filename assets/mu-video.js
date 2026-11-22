/* Section video: plays muted on its own only when motion is allowed and the video is on screen; the pause button
   always works and is remembered for the visit. The button shows what the video is really doing (its play and pause
   events), not what was asked for: if the browser refuses to start it (an iPhone with Auto-Play Video Previews or Low
   Power Mode, say), it shows play and stays paused until the shopper taps it.
   No poster sits over the video (the first frame shows, loaded just before it scrolls into view); the poster (its
   data-poster) only shows when the video won't play: paused, reduced motion, refused, or no frame after a moment. */
/* Block scope: the script may be included by more than one section on a page. */
{
class MuVideo extends HTMLElement {
  connectedCallback() {
    this.video = this.querySelector('video');
    this.btn = this.querySelector('[data-toggle]');
    if (!this.video || !this.btn || this.ready) return;
    this.ready = true;
    const v = this.video;
    // Muted and inline before any play() call: the properties as well as the attributes (WebKit reads the property).
    v.removeAttribute('autoplay');
    v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
    v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    this.mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let stored = null;
    try { stored = sessionStorage.getItem('mu-video-paused'); } catch (e) { /* private mode */ }
    this.paused = this.mq.matches || stored === '1';
    ['play', 'playing', 'pause', 'ended', 'emptied'].forEach((ev) => v.addEventListener(ev, () => this.icon()));
    this.btn.addEventListener('click', () => {
      // Toggle what the video is doing now (a tap on a refused video plays it).
      this.paused = !(v.paused && !this.pending);
      try { sessionStorage.setItem('mu-video-paused', this.paused ? '1' : '0'); } catch (e) { /* private mode */ }
      this.sync();
    });
    v.addEventListener('loadeddata', () => clearTimeout(this.wait));
    // A poster picture over the video (rich text's mobile poster) fades out once it really plays.
    v.addEventListener('playing', () => this.setAttribute('data-played', ''), { once: true });
    v.addEventListener('error', () => this.fallback(), true);
    if (this.paused) this.fallback();
    // Loads the first frame (metadata only) just before the video scrolls into view.
    const near = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      near.disconnect();
      if (!this.paused && v.preload === 'none') v.preload = 'metadata';
    }, { rootMargin: '0px 0px 400px 0px' });
    near.observe(this);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.sync(); }, { threshold: 0.25 }).observe(this);
    // In a slider (the hero), a video on a slide that isn't showing (inert) waits; slides announce a change.
    document.addEventListener('kz:slide', () => this.sync());
    this.mq.addEventListener('change', () => { if (this.mq.matches) this.paused = true; this.sync(); });
    this.sync();
  }

  sync() {
    const v = this.video;
    if (!this.paused && this.visible && !this.closest('[inert]')) this.play();
    else if (!v.paused) v.pause();
    this.icon();
  }

  play() {
    const v = this.video;
    if (!v.paused || this.pending) return;
    // Nothing of the video loads until it first comes on screen.
    if (v.preload === 'none') v.preload = 'metadata';
    v.muted = true;
    let p;
    try { p = v.play(); } catch (e) { p = Promise.reject(e); }
    if (v.readyState < 2) { clearTimeout(this.wait); this.wait = setTimeout(() => { if (v.readyState < 2) this.fallback(); }, 2500); }
    if (!p || !p.then) return;
    this.pending = true;
    this.icon();
    p.then(() => { this.pending = false; this.icon(); }, (err) => {
      this.pending = false;
      this.icon();
      // Not loaded far enough yet: try again once it can play. Refused: the play icon shows and a tap on it plays.
      if (err && err.name === 'AbortError') v.addEventListener('canplay', () => this.sync(), { once: true });
      else { this.paused = true; this.fallback(); }
    });
  }

  // The poster, for a video that won't show itself.
  fallback() {
    clearTimeout(this.wait);
    const v = this.video;
    if (v.dataset.poster && !v.getAttribute('poster')) v.poster = v.dataset.poster;
  }

  icon() {
    const on = !this.video.paused || !!this.pending;
    this.btn.setAttribute('aria-label', on ? this.btn.dataset.pause : this.btn.dataset.play);
    this.btn.querySelector('[data-icon-pause]').toggleAttribute('hidden', !on);   // SVG has no .hidden property: set the attribute
    this.btn.querySelector('[data-icon-play]').toggleAttribute('hidden', on);
  }
}
customElements.get('mu-video') || customElements.define('mu-video', MuVideo);
}
