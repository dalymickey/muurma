/* Product card hover video: the card's second media when it is a Shopify-hosted video. Mouse (fine pointer, hover)
   only, never on touch screens or with reduced motion. The source is attached on first hover (preload none until then),
   the video plays muted, inline and looped while the pointer is over the card and pauses when it leaves; the CSS fades
   it in only once frames are playing, so the first image shows while it loads. */
if (!window.kzCardVideo) {
  window.kzCardVideo = true;
  const can = matchMedia('(hover: hover) and (pointer: fine)');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const vidOf = (t) => {
    const card = t && t.closest && t.closest('.mu-card');
    return card ? card.querySelector('video.mu-card__vid') : null;
  };
  document.addEventListener('mouseover', (e) => {
    if (!can.matches || calm.matches) return;
    const v = vidOf(e.target);
    if (!v || !v.paused) return;
    if (!v.src) {
      v.muted = true; v.playsInline = true;
      v.addEventListener('playing', () => v.classList.add('is-playing'));
      v.addEventListener('pause', () => v.classList.remove('is-playing'));
      v.preload = 'auto';
      v.src = v.dataset.src;
    }
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  });
  document.addEventListener('mouseout', (e) => {
    const v = vidOf(e.target);
    if (!v || v.paused) return;
    const card = v.closest('.mu-card');
    if (e.relatedTarget && card.contains(e.relatedTarget)) return;
    v.pause();
  });
}
