/* Stores: the shopper's preferred store, shared by the header, product pickup, quick add, bag and Our stores page.
   - Preferred store: a store name in localStorage (mu-store) and a cookie (mu_store), announced with a ks:store event.
   - Store list: the mu-stores section's JSON, inline on the stores page or fetched once from Theme settings > Stores >
     Stores page and cached for six hours. Without it the header store button stays hidden; pickup still works.
   - Open now: each store's hours worked out in the shop's time zone. Distance: only after "Use my location".
   - Map: Google Maps with store pins when a key is set (custom HTML overlays, no map ID), otherwise lists and links.
   window.MuStore = { get, set, list, status, open, pickup, qaLine, refresh }. */
(() => {
  const cfgEl = document.querySelector('[data-mu-store-cfg]');
  if (!cfgEl || window.MuStore) return;
  const cfg = JSON.parse(cfgEl.textContent);
  // Liquid's t filter HTML-escapes strings; decode once so they're plain text (escape again when building HTML).
  const decode = (v) => {
    if (Array.isArray(v)) return v.map(decode);
    if (typeof v !== 'string' || v.indexOf('&') < 0) return v;
    const x = document.createElement('textarea');
    x.innerHTML = v;
    return x.value;
  };
  const t = Object.fromEntries(Object.entries(cfg.t || {}).map(([k, v]) => [k, decode(v)]));
  const fill = (s, map) => String(s).replace(/\[(\w+)\]/g, (m, k) => (k in map ? map[k] : m));
  const norm = (s) => String(s || '').trim().toLowerCase();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } return null; };
  const ICON = {
    check: '<svg class="mu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    arrow: '<svg class="mu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
    plus: '<svg class="mu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>',
    store: '<svg class="mu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 9.5l1.5-5h12l1.5 5"/><path d="M4.5 9.5a2.5 2.5 0 005 0 2.5 2.5 0 005 0 2.5 2.5 0 005 0"/><path d="M5.5 12v8h13v-8M10 20v-4.5h4V20"/></svg>',
  };

  // ---------- Preferred store ----------
  const cookie = () => { const m = document.cookie.match(/(?:^|; )mu_store=([^;]*)/); try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; } };
  const get = () => store('mu-store') || cookie();
  function set(name) {
    name = String(name || '').trim();
    store('mu-store', name || null);
    document.cookie = `mu_store=${encodeURIComponent(name)}; path=/; max-age=${name ? 31536000 : 0}; SameSite=Lax`;
    document.dispatchEvent(new CustomEvent('ks:store', { detail: { name } }));
  }

  // ---------- Store list ----------
  // The theme editor swaps sections in place (shopify:section:load), so the inline list is looked up again then.
  const design = !!(window.Shopify && Shopify.designMode);
  let inline = document.querySelector('[data-mu-stores-data]');
  let stores = null;
  let loading = null;
  const parse = (json) => {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((s) => s && s.name).map((s) => ({ ...s, lat: parseFloat(s.lat), lng: parseFloat(s.lng), hours: s.hours || [] })) : [];
  };
  const hasCoords = (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng);
  const source = () => (inline ? 'inline' : cfg.src);
  function cached() {
    try {
      const c = JSON.parse(store('mu-stores') || 'null');
      if (c && c.src === cfg.src && Date.now() - c.at < 216e5) return parse(JSON.stringify(c.list));
    } catch (e) { /* ignore */ }
    return null;
  }
  // An empty list is never cached, so a stores page filled in later shows up straight away.
  function keep(list) { if (cfg.src && list && list.length) store('mu-stores', JSON.stringify({ src: cfg.src, at: Date.now(), list })); }
  function list() {
    if (stores) return Promise.resolve(stores);
    if (inline) { stores = parse(inline.textContent); keep(stores); return Promise.resolve(stores); }
    if (!cfg.src) return Promise.resolve(null);
    const c = design ? null : cached();
    if (c) { stores = c; return Promise.resolve(c); }
    loading = loading || fetch(cfg.src, { credentials: 'same-origin' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then((html) => {
        const el = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-mu-stores-data]');
        stores = el ? parse(el.textContent) : [];
        keep(stores);
        return stores;
      })
      .finally(() => { loading = null; });
    return loading;
  }
  const find = (name) => (stores || []).find((s) => norm(s.name) === norm(name));

  // ---------- Opening hours ----------
  // "10:00–18:00", "9am - 5:30pm", "9.30 to 17.30", "11–7" (pm assumed), "18:00–02:00" (past midnight). No digits = closed.
  function range(str) {
    if (!str) return null;
    if (!/\d/.test(str)) return false;
    const m = String(str).toLowerCase().match(/(\d{1,2})(?:[:.h](\d{2}))?\s*(a|p)?\.?m?\.?\s*(?:-|–|—|to|bis|à|al|a)\s*(\d{1,2})(?:[:.h](\d{2}))?\s*(a|p)?/);
    if (!m) return null;
    const mins = (h, mm, ap) => { h = +h % 24; if (ap === 'p' && h < 12) h += 12; if (ap === 'a' && h === 12) h = 0; return h * 60 + (+mm || 0); };
    const o = mins(m[1], m[2], m[3]);
    let c = mins(m[4], m[5], m[6]);
    if (c <= o) c = !m[6] && c + 720 > o && c < 720 ? c + 720 : c + 1440;
    return [o, c];
  }
  function shopNow() {
    const m = String(cfg.tz || '+0000').match(/([+-])(\d\d):?(\d\d)/) || ['', '+', '00', '00'];
    const off = (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]);
    const d = new Date(Date.now() + off * 6e4);
    return { day: (d.getUTCDay() + 6) % 7, min: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
  function time(min) {
    min %= 1440;
    const h = Math.floor(min / 60);
    const mm = min % 60;
    const o = { hour: 'numeric', timeZone: 'UTC' };
    if (mm) o.minute = '2-digit';
    try { return new Intl.DateTimeFormat(cfg.lang, o).format(new Date(Date.UTC(2000, 0, 3, h, mm))); } catch (e) { return `${h}:${String(mm).padStart(2, '0')}`; }
  }
  function status(s) {
    const hrs = (s && s.hours) || [];
    if (!hrs.some(Boolean)) return null;
    const { day, min } = shopNow();
    const open = (close) => ({ open: true, soon: close - min <= 60, text: fill(close - min <= 60 ? t.closingSoon : t.openUntil, { time: time(close) }) });
    const y = range(hrs[(day + 6) % 7]);
    if (y && y[1] > 1440 && min < y[1] - 1440) return open(y[1] - 1440);
    const r = range(hrs[day]);
    if (r && min >= r[0] && min < r[1]) return open(r[1]);
    if (r && min < r[0]) return { open: false, text: fill(t.opensAt, { time: time(r[0]) }) };
    for (let i = 1; i <= 7; i++) {
      const n = range(hrs[(day + i) % 7]);
      if (n) return { open: false, text: fill(t.opensDay, { day: i === 1 ? t.tomorrow : t.days[(day + i) % 7], time: time(n[0]) }) };
    }
    return { open: false, text: t.closed };
  }

  // ---------- Distance ----------
  let here = null;
  try { here = JSON.parse(sessionStorage.getItem('mu-here') || 'null'); } catch (e) { here = null; }
  function km(s) {
    if (!here || !hasCoords(s)) return null;
    const r = (x) => (x * Math.PI) / 180;
    const a = Math.sin(r(s.lat - here.lat) / 2) ** 2 + Math.cos(r(here.lat)) * Math.cos(r(s.lat)) * Math.sin(r(s.lng - here.lng) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  }
  function dist(s) {
    let d = km(s);
    if (d == null) return '';
    if (cfg.unit === 'mi') d *= 0.621371;
    const n = new Intl.NumberFormat(cfg.lang, { maximumFractionDigits: d < 10 ? 1 : 0 }).format(d);
    return fill(cfg.unit === 'mi' ? t.mi : t.km, { n });
  }
  const byDistance = (arr) => (here ? [...arr].sort((a, b) => (km(a) ?? 1e9) - (km(b) ?? 1e9)) : arr);
  function setHere(p) { here = p; try { sessionStorage.setItem('mu-here', JSON.stringify(p)); } catch (e) { /* ignore */ } }
  function locate() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) { rej(new Error('none')); return; }
      navigator.geolocation.getCurrentPosition((p) => { setHere({ lat: p.coords.latitude, lng: p.coords.longitude }); res(here); }, rej, { timeout: 12000, maximumAge: 6e5 });
    });
  }

  // ---------- Pickup readiness, remembered from product pages ("Usually ready in 4 hours") ----------
  let ready = {};
  try { ready = JSON.parse(store('mu-store-ready') || '{}') || {}; } catch (e) { ready = {}; }
  function remember(name, txt) {
    if (!name || !txt || ready[norm(name)] === txt) return;
    ready[norm(name)] = txt;
    store('mu-store-ready', JSON.stringify(ready));
  }

  // ---------- Google Maps (only with a key) ----------
  let mapsP = null;
  const MAP_STYLE = [
    { stylers: [{ saturation: -100 }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ lightness: -12 }] },
  ];
  function loadMaps() {
    if (!cfg.key) return Promise.reject(new Error('no key'));
    if (window.google && window.google.maps && window.google.maps.Map) return Promise.resolve(window.google.maps);
    mapsP = mapsP || new Promise((res, rej) => {
      window.kzMapsReady = () => res(window.google.maps);
      window.gm_authFailure = () => { document.querySelectorAll('[data-st-map], [data-sl-map]').forEach((m) => { m.hidden = true; }); };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(cfg.key)}&callback=kzMapsReady&loading=async&language=${encodeURIComponent(cfg.lang || 'en')}`;
      s.async = true;
      s.onerror = () => { mapsP = null; rej(new Error('maps')); };
      document.head.append(s);
    });
    return mapsP;
  }
  async function makeMap(el, arr, onPick) {
    const pts = arr.filter(hasCoords);
    if (!pts.length) return null;
    const g = await loadMaps();
    el.hidden = false;
    const map = new g.Map(el, {
      center: { lat: pts[0].lat, lng: pts[0].lng }, zoom: 12, styles: MAP_STYLE, disableDefaultUI: true, zoomControl: true,
      clickableIcons: false, gestureHandling: 'cooperative', keyboardShortcuts: false,
    });
    const pins = new Map();
    class Pin extends g.OverlayView {
      constructor(s) {
        super();
        this.pos = new g.LatLng(s.lat, s.lng);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mu-pin';
        b.setAttribute('aria-label', s.name);
        b.innerHTML = '<svg viewBox="0 0 36 44" aria-hidden="true" focusable="false"><path class="mu-pin__body" d="M18 43s15-13.6 15-25.5A15 15 0 0 0 3 17.5C3 29.4 18 43 18 43z"/><g class="mu-pin__ic" transform="translate(8 7) scale(.83)">' + ICON.store.replace(/^<svg[^>]*>|<\/svg>$/g, '') + '</g></svg>';
        b.addEventListener('click', (e) => { e.stopPropagation(); onPick(s.name); });
        this.el = b;
        this.setMap(map);
      }
      onAdd() { this.getPanes().overlayMouseTarget.append(this.el); }
      draw() { const p = this.getProjection().fromLatLngToDivPixel(this.pos); if (p) { this.el.style.left = `${p.x}px`; this.el.style.top = `${p.y}px`; } }
      onRemove() { this.el.remove(); }
    }
    pts.forEach((s) => pins.set(norm(s.name), new Pin(s)));
    const fit = () => {
      if (pts.length < 2) { map.setCenter({ lat: pts[0].lat, lng: pts[0].lng }); map.setZoom(13); return; }
      const b = new g.LatLngBounds();
      pts.forEach((s) => b.extend({ lat: s.lat, lng: s.lng }));
      if (here) b.extend(here);
      map.fitBounds(b, 56);
    };
    fit();
    return {
      map,
      fit,
      select(name, pan) {
        pins.forEach((p, k) => { p.el.classList.toggle('is-on', k === norm(name)); p.el.setAttribute('aria-pressed', String(k === norm(name))); });
        const p = pins.get(norm(name));
        if (p && pan) { map.panTo(p.pos); if (map.getZoom() < 11) map.setZoom(13); }
      },
      geocode(q) {
        return new Promise((res, rej) => new g.Geocoder().geocode({ address: q }, (r, st) => {
          if (st === 'OK' && r[0]) res({ lat: r[0].geometry.location.lat(), lng: r[0].geometry.location.lng() }); else rej(new Error(st));
        }));
      },
    };
  }
  // Geocoding without a visible map (postcode search in the picker when the stores have no coordinates).
  async function geocode(q) {
    const g = await loadMaps();
    return new Promise((res, rej) => new g.Geocoder().geocode({ address: q }, (r, st) => {
      if (st === 'OK' && r[0]) res({ lat: r[0].geometry.location.lat(), lng: r[0].geometry.location.lng() }); else rej(new Error(st));
    }));
  }

  // ---------- Shared pieces ----------
  const dirUrl = (s) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hasCoords(s) ? `${s.lat},${s.lng}` : `${s.name}, ${(s.address || '').replace(/\n/g, ', ')}`)}`;
  function statusHtml(st) {
    if (!st) return '';
    return `<i class="mu-st__dot${st.open ? (st.soon ? ' is-soon' : ' is-on') : ''}" aria-hidden="true"></i>${esc(st.text)}`;
  }
  function hoursTable(s) {
    const { day } = shopNow();
    const rows = s.hours.map((h, i) => (h ? `<tr${i === day ? ' class="is-today"' : ''}><th scope="row">${esc(t.days[i])}</th><td>${esc(h)}</td></tr>` : '')).join('');
    return rows ? `<table class="mu-st__hours"><caption class="visually-hidden">${esc(t.hours)}</caption><tbody>${rows}</tbody></table>` : '';
  }
  function setButtons() {
    const pref = norm(get());
    document.querySelectorAll('[data-store-set]').forEach((b) => {
      const on = !!pref && norm(b.dataset.storeSet) === pref;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-on', on);
      const l = b.querySelector('[data-set-label]');
      if (l) l.textContent = on ? t.mine : t.set;
    });
  }

  // ---------- Header "My store" and the bag line ----------
  function header() {
    const btns = document.querySelectorAll('[data-store-btn]');
    if (!btns.length) return;
    if (!source()) { btns.forEach((b) => { b.hidden = true; }); return; }
    const paint = () => {
      const pref = get();
      const s = pref ? find(pref) : null;
      const st = s ? status(s) : null;
      btns.forEach((b) => {
        // In the theme editor the button previews even before a list loads, so its placement can be checked.
        b.hidden = !design && (!stores || !stores.length);
        b.querySelector('[data-store-name]').textContent = s ? s.name : t.choose;
        b.querySelector('[data-store-status]').textContent = st ? st.text : t.myStore;
        const dot = b.querySelector('[data-store-dot]');
        if (dot) { dot.hidden = !st; dot.className = `mu-st__dot${st && st.open ? (st.soon ? ' is-soon' : ' is-on') : ''}`; }
        b.setAttribute('aria-label', s ? `${t.myStore}: ${s.name}${st ? `, ${st.text}` : ''}` : `${t.myStore}: ${t.choose}`);
      });
    };
    if (stores) paint();
    else list().then(paint).catch(() => { if (design) paint(); });
  }
  // Nearest first when the shopper's location and store coordinates are known; otherwise keep the given order.
  const kmOf = (name) => { const s = find(name); return s ? km(s) : null; };
  const nearest = (names) => (here && stores ? [...names].sort((a, b) => (kmOf(a) ?? 1e9) - (kmOf(b) ?? 1e9)) : names);
  const bold = (name) => `<b>${esc(name)}</b>`;

  // Pickup stock for any variant, read from the pickup section (Liquid only lists it for the selected variant).
  const spotCache = {};
  function spotsFor(url, id) {
    const k = String(id);
    if (!spotCache[k]) {
      spotCache[k] = fetch(`${url}?variant=${id}&section_id=mu-pickup`)
        .then((r) => (r.ok ? r.text() : ''))
        .then((html) => [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.mu-pkup__row')]
          .map((r) => ({ n: r.dataset.store, on: r.dataset.on === 'true', t: r.dataset.time || '' })))
        .catch(() => { delete spotCache[k]; return []; });
    }
    return spotCache[k];
  }

  // Bag: can the preferred store hand over everything that ships? If not, name a store that can.
  function lines() {
    const pref = get();
    document.querySelectorAll('[data-store-line]').forEach(async (p) => {
      const btn = p.querySelector('[data-store-open]');
      if (btn) btn.hidden = !source();
      if (!pref) { p.hidden = true; return; }
      let lns = [];
      try { lns = JSON.parse(p.dataset.items || '[]'); } catch (e) { lns = []; }
      const text = p.querySelector('[data-store-line-text]');
      let html = fill(esc(t.cartLine), { store: bold(pref) });
      let off = 0;
      if (lns.length && lns.length <= 20) {
        const items = (await Promise.all(lns.map((l) => spotsFor(l.u, l.id)))).map((sp) => sp.filter((x) => x.on).map((x) => x.n));
        if (get() !== pref) return;
        off = items.filter((names) => !names.some((n) => norm(n) === norm(pref))).length;
        if (off) {
          html = fill(esc(t.cartOff), { store: bold(pref) });
          const all = items[0].filter((n) => items.every((names) => names.includes(n)));
          const alt = nearest(all)[0];
          if (alt) html += ` ${fill(esc(t.cartAlt), { store: bold(alt) })}`;
        }
      }
      p.classList.toggle('is-off', off > 0);
      text.innerHTML = html;
      p.hidden = false;
    });
  }

  // ---------- Product pickup block ----------
  // Order: the preferred store, then stores with the variant ready (nearest first when known), then the rest.
  function arrange(items, pref) {
    const base = [...items].sort((a, b) => a.dataset.i - b.dataset.i);
    const on = nearest(base.filter((r) => r.dataset.on === 'true').map((r) => r.dataset.store)).map((n) => base.find((r) => r.dataset.store === n));
    const list = [...on, ...base.filter((r) => r.dataset.on !== 'true')];
    const mine = pref ? list.find((r) => norm(r.dataset.store) === norm(pref)) : null;
    if (mine) { list.splice(list.indexOf(mine), 1); list.unshift(mine); }
    return { list, mine };
  }
  function pickup(root) {
    const scope = root || document;
    const pref = get();
    scope.querySelectorAll('[data-mu-pick]').forEach((el) => {
      const tt = JSON.parse(el.querySelector('[data-pick-t]').textContent);
      // Sold out online but in stock at a store: "In stock at … · Purchase in store only", no ready time.
      const only = el.hasAttribute('data-instore') && !!tt.store;
      const ul = el.querySelector('.mu-pkup__rows');
      const { list: rows, mine } = arrange(el.querySelectorAll('.mu-pkup__row'), pref);
      rows.forEach((r) => { if (r.dataset.on === 'true') remember(r.dataset.store, r.dataset.time); });
      rows.forEach((r, i) => {
        ul.append(r);
        r.hidden = i > 2;
        r.classList.toggle('is-mine', r === mine);
        r.querySelector('.mu-pkup__mine').hidden = r !== mine;
      });
      const lead = el.querySelector('[data-pick-lead]');
      const tm = el.querySelector('[data-pick-time]');
      const altEl = el.querySelector('[data-pick-alt]');
      const firstOn = rows.find((r) => r.dataset.on === 'true');
      // Lead: the preferred store (even when it doesn't stock this variant), else the first store that can, else none can.
      const top = pref ? mine : firstOn || null;
      const name = top ? top.dataset.store : pref;
      const on = !!top && top.dataset.on === 'true';
      if (name) lead.innerHTML = fill(on ? (only ? tt.store : tt.at) : tt.none, { store: bold(name) });
      else if (rows.length > 1) lead.textContent = tt.nowhere;
      else lead.innerHTML = fill(tt.none, { store: bold(rows[0].dataset.store) });
      if (tm) { tm.textContent = on && !only ? top.dataset.time : ''; tm.hidden = !on || only; }
      // Unavailable at the lead store: suggest the nearest store that has it.
      const alt = !on && firstOn && firstOn !== top ? firstOn : null;
      if (altEl) {
        altEl.hidden = !alt;
        altEl.innerHTML = alt ? `<span class="mu-pkup__dot ${only ? 'is-store' : 'is-on'}" aria-hidden="true"></span><span>${fill(only ? tt.store : tt.alt, { store: bold(alt.dataset.store) })}${alt.dataset.time && !only ? `<span class="mu-pkup__alt-time mu-muted">${esc(alt.dataset.time)}</span>` : ''}</span>` : '';
      }
      el.classList.toggle('has-mine', !!mine);
      el.classList.toggle('is-off', !on);
      el.classList.toggle('is-instore', on && only);
      const sheet = el.querySelector('.mu-pkup__list');
      if (sheet) arrange(sheet.querySelectorAll('.mu-pkup__spot'), pref).list.forEach((sp) => sheet.append(sp));
    });
    setButtons();
  }

  // ---------- Quick add line ----------
  // soldOut: the variant can't be bought online, so a store that has it reads "In stock at … · Purchase in store only".
  function qaLine(el, spots, soldOut) {
    if (!el) return;
    const pref = get();
    if (!pref || !Array.isArray(spots) || !spots.length) { el.hidden = true; return; }
    const sp = spots.find((s) => norm(s.n) === norm(pref));
    spots.forEach((s) => { if (s.on) remember(s.n, s.t); });
    const on = !!(sp && sp.on);
    const only = !!soldOut && !!t.pickStore;
    const alt = on ? null : spots.find((s) => s.on && s.n === nearest(spots.filter((x) => x.on).map((x) => x.n))[0]);
    el.hidden = false;
    el.classList.toggle('is-on', on && !only);
    el.classList.toggle('is-instore', on && only);
    let html = `<i class="mu-st__dot${on ? (only ? ' is-store' : ' is-on') : ''}" aria-hidden="true"></i><span>${fill(esc(on ? (only ? t.pickStore : t.pickOn) : t.pickOff), { store: bold(pref) })}${on && !only && sp.t ? ` <span class="mu-muted mu-nowrap">· ${esc(sp.t)}</span>` : ''}`;
    if (alt) html += `<span class="mu-qa__alt">${fill(esc(only ? t.pickStore : t.pickAlt), { store: bold(alt.n) })}${alt.t && !only ? `<span class="mu-qa__alt-time mu-muted">${esc(alt.t)}</span>` : ''}</span>`;
    el.innerHTML = `${html}</span>`;
  }

  // ---------- Picker sheet ----------
  const dlg = document.querySelector('[data-st]');
  let chosen = '';
  let pmap = null;
  let opener = null;
  const $ = (sel) => dlg.querySelector(sel);
  const pmsg = (txt) => { const m = $('[data-st-msg]'); if (m) m.textContent = txt || ''; };
  function renderPicker() {
    const ul = $('[data-st-list]');
    const pref = norm(get());
    ul.innerHTML = byDistance(stores).map((s) => {
      const st = status(s);
      const d = dist(s);
      const rd = ready[norm(s.name)];
      const sel = norm(s.name) === norm(chosen);
      const addr = (s.address || '').split('\n').map((x) => x.trim()).filter(Boolean).join(', ');
      const hrs = hoursTable(s);
      return `<li class="mu-st__item${sel ? ' is-on' : ''}" data-name="${esc(s.name)}">
        <button type="button" class="mu-st__pick" aria-pressed="${sel}">
          <span class="mu-st__box" aria-hidden="true">${ICON.check}</span>
          <span class="mu-st__body">
            <span class="mu-st__row"><span class="mu-st__name">${esc(s.name)}</span>${norm(s.name) === pref ? `<span class="mu-st__tag">${esc(t.mine)}</span>` : ''}${d ? `<span class="mu-st__dist">${esc(d)}</span>` : ''}</span>
            ${st ? `<span class="mu-st__status">${statusHtml(st)}</span>` : ''}
            ${rd ? `<span class="mu-st__ready">${ICON.store}${esc(rd)}</span>` : ''}
            ${addr ? `<span class="mu-st__addr">${esc(addr)}</span>` : ''}
          </span>
        </button>
        <div class="mu-st__more">
          ${hrs ? `<details class="mu-st__det"><summary>${ICON.plus}${esc(t.hours)}<span class="visually-hidden"> ${esc(s.name)}</span></summary>${hrs}</details>` : ''}
          <a class="mu-st__dir" href="${dirUrl(s)}" target="_blank" rel="noopener">${esc(t.directions)}<span class="visually-hidden"> ${esc(s.name)}</span>${ICON.arrow}</a>
        </div>
      </li>`;
    }).join('');
    const save = $('[data-st-save]');
    save.disabled = !chosen || norm(chosen) === pref;
    if (pmap) pmap.select(chosen, false);
  }
  function choose(name, fromMap) {
    chosen = name;
    dlg.querySelectorAll('.mu-st__item').forEach((li) => {
      const on = norm(li.dataset.name) === norm(name);
      li.classList.toggle('is-on', on);
      li.querySelector('.mu-st__pick').setAttribute('aria-pressed', String(on));
      if (on && fromMap) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    $('[data-st-save]').disabled = norm(name) === norm(get());
    if (pmap) pmap.select(name, !fromMap);
  }
  async function open(from) {
    if (!dlg || typeof dlg.showModal !== 'function') return;
    opener = from || document.activeElement;
    if (!dlg.open) dlg.showModal();
    pmsg(stores ? '' : t.loading);
    try {
      const l = await list();
      if (!l || !l.length) throw new Error('empty');
      pmsg('');
      chosen = get() && find(get()) ? find(get()).name : '';
      renderPicker();
      const loc = $('[data-st-locate]');
      if (loc) loc.hidden = !navigator.geolocation || !l.some(hasCoords);
      if (cfg.key && !pmap && l.some(hasCoords)) {
        makeMap($('[data-st-map]'), l, (n) => choose(n, true)).then((m) => { pmap = m; if (m) m.select(chosen, false); }).catch(() => { $('[data-st-map]').hidden = true; });
      }
    } catch (e) { pmsg(t.loadError); }
  }
  if (dlg) {
    dlg.addEventListener('click', async (e) => {
      if (e.target === dlg || e.target.closest('[data-st-close]')) { dlg.close(); return; }
      const pick = e.target.closest('.mu-st__pick');
      if (pick) { choose(pick.closest('.mu-st__item').dataset.name); return; }
      if (e.target.closest('[data-st-save]') && chosen) {
        set(chosen);
        pmsg(fill(t.saved, { store: chosen }));
        setTimeout(() => dlg.open && dlg.close(), 500);
        return;
      }
      if (e.target.closest('[data-st-locate]')) {
        pmsg(t.locating);
        try { await locate(); pmsg(t.sorted); renderPicker(); if (pmap) pmap.fit(); } catch (err) { pmsg(t.locError); }
      }
    });
    const form = $('[data-st-search]');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const q = form.q.value.trim();
        if (!q) return;
        pmsg(t.locating);
        try {
          setHere(pmap ? await pmap.geocode(q) : await geocode(q));
          pmsg(t.sorted);
          renderPicker();
          if (pmap) pmap.fit();
        } catch (err) { pmsg(t.searchError); }
      });
    }
    dlg.addEventListener('close', () => { if (opener && opener.isConnected) opener.focus(); });
  }

  // ---------- Our stores page ----------
  function storesPage() {
    const sl = document.querySelector('[data-sl]');
    if (!sl || !inline) return;
    const ul = sl.querySelector('[data-sl-list]');
    const cards = () => [...sl.querySelectorAll('[data-sl-store]')];
    const mapEl = sl.querySelector('[data-sl-map]');
    const embed = sl.querySelector('[data-sl-embed]');
    let smap = null;
    const paintCards = () => {
      const { day } = shopNow();
      cards().forEach((c) => {
        const s = find(c.dataset.slStore);
        if (!s) return;
        const st = status(s);
        c.querySelector('[data-st-status]').innerHTML = statusHtml(st);
        c.querySelector('[data-st-dist]').textContent = dist(s);
        c.querySelectorAll('tr[data-day]').forEach((tr) => tr.classList.toggle('is-today', +tr.dataset.day === day));
        c.classList.toggle('is-mine', norm(s.name) === norm(get()));
      });
    };
    const focus = (name, scroll) => {
      cards().forEach((c) => c.classList.toggle('is-on', norm(c.dataset.slStore) === norm(name)));
      const s = find(name);
      if (smap) smap.select(name, true);
      else if (embed && s) {
        const q = hasCoords(s) ? `${s.lat},${s.lng}` : `${s.name}, ${(s.address || '').replace(/\n/g, ', ')}`;
        embed.src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`;
      }
      if (scroll) { const c = cards().find((x) => norm(x.dataset.slStore) === norm(name)); if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    };
    list().then(() => {
      paintCards();
      const pref = get() && find(get());
      if (sl.dataset.map === 'js' && mapEl) {
        makeMap(mapEl, stores, (n) => focus(n, true)).then((m) => { smap = m; if (m && pref) focus(pref.name); }).catch(() => { mapEl.hidden = true; sl.classList.remove('mu-sl--map'); });
      } else if (pref) focus(pref.name);
    });
    sl.addEventListener('click', async (e) => {
      const f = e.target.closest('[data-sl-focus]');
      if (f) { focus(f.closest('[data-sl-store]').dataset.slStore); return; }
      const loc = e.target.closest('[data-st-locate]');
      if (loc) {
        const m = sl.querySelector('[data-st-msg]');
        m.textContent = t.locating;
        try {
          await locate();
          m.textContent = t.sorted;
          byDistance(stores).forEach((s) => { const c = cards().find((x) => norm(x.dataset.slStore) === norm(s.name)); if (c) ul.append(c); });
          paintCards();
          if (smap) smap.fit();
        } catch (err) { m.textContent = t.locError; }
      }
    });
    page = { paintCards, focus };
  }
  let page = null;
  document.addEventListener('ks:store', () => { if (!page) return; page.paintCards(); const p = get() && find(get()); if (p) page.focus(p.name); });
  document.addEventListener('shopify:block:select', (e) => { const c = page && e.target.closest && e.target.closest('[data-sl-store]'); if (c) page.focus(c.dataset.slStore); });

  // ---------- Wiring ----------
  function refresh() { header(); lines(); pickup(); }
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-store-set]');
    if (s) { set(s.dataset.storeSet); return; }
    const o = e.target.closest('[data-store-open]');
    if (o && dlg) { e.preventDefault(); open(o); }
  });
  document.addEventListener('ks:store', refresh);
  window.addEventListener('storage', (e) => { if (e.key === 'mu-store') refresh(); });
  // Keep "Open until" honest on a page left open.
  setInterval(() => { if (!document.hidden) header(); }, 6e4);
  window.MuStore = { get, set, list, status, open, pickup, qaLine, refresh, spotsFor };
  refresh();
  // With a known location, re-sort pickup suggestions nearest first once store coordinates are in.
  if (here && !stores && source()) list().then(() => { lines(); pickup(); }).catch(() => {});
  storesPage();
  // Theme editor: a re-rendered header, product or stores section comes in with its store UI reset, so paint it again.
  document.addEventListener('shopify:section:load', (e) => {
    const now = document.querySelector('[data-mu-stores-data]');
    if (now !== inline) { inline = now; stores = null; }
    if (e.target.querySelector('[data-sl]')) storesPage();
    refresh();
  });
})();
