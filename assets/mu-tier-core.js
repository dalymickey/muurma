/* Shared tier-savings maths for the volume tiers block (assets/mu-tiers.js) and Build your box (assets/mu-mix.js).
   Tiers are { q, pct } pairs: q items or more take pct% off. Savings are estimated per line and rounded to the cent,
   as automatic discounts are; after adding, the bag (/cart.js) says what it really took off. When it took nothing,
   claims stay hidden for the rest of the visit (sessionStorage), so the page never promises more than the bag gives. */
(() => {
  if (window.kzTierCore) return;
  const store = (fn) => { try { return fn(window.sessionStorage); } catch (e) { return null; } };
  const offKey = (key) => `mu-tiers-off:${key}`;
  window.kzTierCore = {
    store,
    // Cents in the store's money format, read off the 123456 sample Liquid rendered ("$1,234.56", "1.234,56 €").
    moneyOf: (sample) => (cents) => {
      const m = sample.match(/1(\D?)23[45](?:(\D)56)?/);
      if (!m) return (cents / 100).toFixed(2);
      const [i, d] = (cents / 100).toFixed(m[2] ? 2 : 0).split('.');
      return sample.replace(m[0], i.replace(/\B(?=(\d{3})+(?!\d))/g, m[1]) + (d ? m[2] + d : ''));
    },
    // "2:5,3:10,4:15" to tiers sorted by quantity; empty and 0% tiers drop out.
    parse: (s) => String(s || '').split(',').map((x) => x.split(':').map(Number)).filter(([q, p]) => q > 0 && p > 0)
      .map(([q, pct]) => ({ q, pct })).sort((a, b) => a.q - b.q),
    // The best tier n items reach, and the next one up.
    reached: (tiers, n) => tiers.filter((t) => t.q <= n).pop() || null,
    next: (tiers, n) => tiers.find((t) => t.q > n) || null,
    // Estimated saving: pct% of each line, rounded to the cent per line.
    off: (lines, pct) => lines.reduce((a, cents) => a + Math.round((cents * pct) / 100), 0),
    // What the bag took off the given variant ids (line discounts, automatic ones included).
    took: (cart, ids) => (cart.items || []).filter((l) => ids.has(l.variant_id)).reduce((a, l) => a + (l.line_level_total_discount || 0), 0),
    noclaim: (key) => store((s) => s.getItem(offKey(key))) === '1',
    setNoclaim: (key, on) => store((s) => (on ? s.setItem(offKey(key), '1') : s.removeItem(offKey(key)))),
  };
})();
