/* Subscribe-to-a-mix control for the tiers block (snippets/mu-pp-tiers) and the Mix and match section (sections/mu-mix).
   Each item carries its own purchase options from snippets/mu-sub-data, keyed "group id/option value", so one choice
   ("Subscribe & save, every 4 weeks") finds the matching plan on every product. mount() builds the controls from the
   union of those options into an empty [data-subp] box (its data-* attributes hold the translated words) and returns
   { key, plan(map), pct, note }. Nothing renders when no item has a recurring option. */
(() => {
  if (window.kzSubs) return;
  let n = 0;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const parse = (s) => { try { return JSON.parse(s || '{}') || {}; } catch (e) { return {}; } };

  const mount = (box, maps, onChange) => {
    const groups = new Map();
    maps.forEach((m) => Object.keys(m).forEach((k) => {
      const p = m[k];
      const gid = k.slice(0, k.indexOf('/'));
      if (!groups.has(gid)) groups.set(gid, { name: p[3], opt: p[4], keys: new Map(), pct: 0 });
      const g = groups.get(gid);
      if (!g.keys.has(k)) g.keys.set(k, { label: p[5], pct: 0 });
      g.keys.get(k).pct = Math.max(g.keys.get(k).pct, +p[2] || 0);
      g.pct = Math.max(g.pct, +p[2] || 0);
    }));
    if (!box || !groups.size) return null;
    n += 1;
    const id = `mu-subp-${n}`;
    const d = box.dataset;
    const chev = box.innerHTML;
    const save = (p) => (p > 0 ? d.save.replace('[p]', p) : '');
    let h = `<fieldset class="mu-subp__set"><legend class="mu-pp__legend">${esc(d.legend)}</legend><div class="mu-subp__modes">`;
    h += `<label class="mu-subp__mode"><input class="visually-hidden" type="radio" name="${id}" value="" checked><span>${esc(d.once)}</span></label>`;
    let gi = 0;
    groups.forEach((g, gid) => {
      gi += 1;
      h += `<label class="mu-subp__mode"><input class="visually-hidden" type="radio" name="${id}" value="${esc(gid)}"><span>${esc(g.name)}</span>`
        + `${g.pct ? `<span class="mu-save">${esc(save(g.pct))}</span>` : ''}</label>`;
    });
    h += '</div></fieldset>';
    gi = 0;
    groups.forEach((g, gid) => {
      gi += 1;
      const keys = [...g.keys.keys()];
      const one = keys.length < 2 ? ' data-one' : '';
      if (keys.length > 4) {
        const sid = `${id}-s${gi}`;
        h += `<div class="mu-fchips-set" data-subp-freq="${esc(gid)}" hidden><label class="mu-fchips__legend" for="${sid}">${esc(g.opt || d.freq)}</label>`
          + `<div class="mu-fsel"><select class="mu-select" id="${sid}">${keys.map((k) => `<option value="${esc(k)}">${esc(g.keys.get(k).label)}${g.keys.get(k).pct ? ` (${esc(save(g.keys.get(k).pct))})` : ''}</option>`).join('')}</select>${chev}</div></div>`;
      } else {
        h += `<fieldset class="mu-fchips-set" data-subp-freq="${esc(gid)}"${one} hidden><legend class="mu-fchips__legend">${esc(g.opt || d.freq)}</legend><div class="mu-fchips">`;
        keys.forEach((k, i) => {
          const o = g.keys.get(k);
          h += `<label class="mu-fchip"><input class="visually-hidden" type="radio" name="${id}-f${gi}" value="${esc(k)}"${i === 0 ? ' checked' : ''}>`
            + `<span class="mu-fchip__name">${esc(o.label)}</span><span class="mu-fchip__meta">${esc(save(o.pct))}</span></label>`;
        });
        h += '</div></fieldset>';
      }
    });
    h += '<p class="mu-subp__note" data-subp-note role="status" hidden></p>';
    box.innerHTML = h;
    box.hidden = false;

    const note = box.querySelector('[data-subp-note]');
    const gid = () => { const r = box.querySelector(`input[name="${id}"]:checked`); return r ? r.value : ''; };
    const key = () => {
      const g = gid();
      if (!g) return '';
      const f = [...box.querySelectorAll('[data-subp-freq]')].find((x) => x.dataset.subpFreq === g);
      if (!f) return '';
      const s = f.querySelector('select');
      if (s) return s.value;
      const r = f.querySelector('input:checked');
      return r ? r.value : '';
    };
    const api = {
      key,
      plan: (m) => { const k = key(); return (k && m && m[k]) || null; },
      pct: () => { const k = key(); if (!k) return 0; const g = groups.get(gid()); return g && g.keys.get(k) ? g.keys.get(k).pct : 0; },
      note: (t) => { note.textContent = t || ''; note.hidden = !t; },
    };
    box.addEventListener('change', (e) => {
      e.stopPropagation();
      box.querySelectorAll('[data-subp-freq]').forEach((f) => { f.hidden = f.dataset.subpFreq !== gid() || f.hasAttribute('data-one'); });
      onChange(api);
    });
    return api;
  };

  window.kzSubs = { parse, mount };
})();
