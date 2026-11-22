/* Size chart (snippets/mu-size-chart): the opener shows its dialog as a popup or side drawer; the close button, Esc and
   a click on the backdrop close it, and focus goes back to the opener. Without JS the opener is a link to the page. */
(() => {
  if (window.kzSizeChart) return;
  window.kzSizeChart = true;
  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-sc-open]');
    if (open) {
      const dlg = document.getElementById(open.getAttribute('aria-controls'));
      if (!dlg || typeof dlg.showModal !== 'function') return;
      e.preventDefault();
      dlg.showModal();
      dlg.querySelector('[data-sc-close]').focus();
      dlg.addEventListener('close', () => open.focus(), { once: true });
      return;
    }
    const dlg = e.target.closest('dialog.mu-sc');
    if (!dlg) return;
    if (e.target.closest('[data-sc-close]')) return dlg.close();
    // The backdrop counts as the dialog itself, so only a click outside its box closes it (not one on its padding).
    const r = dlg.getBoundingClientRect();
    const out = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (e.target === dlg && out && e.detail) dlg.close();
  });
})();
