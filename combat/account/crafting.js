"use strict";
// Kiln crafting (vessel economy build): salvage parts + Seeds firing fees become vessels.
// Deterministic: no fail chance — crafting is a sink, not a gamble. Pure account ledger:
// craft() refuses (naming the shortfall) instead of driving anything negative.
//
//   RULES                     → recipes + batchMax (all provisional; Mala tunes)
//   RECIPES                   → { shard/bead/orb: { parts, fee } }
//   craftable(account, v)     → { max, short } (how many of v the ledger can fire now)
//   craft(account, vessel, n) → { ok, account } | { ok: false, short }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatCrafting = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RECIPES = {
    shard: { parts: { common: 2 }, fee: 5 },
    bead: { parts: { common: 3, uncommon: 2 }, fee: 15 },
    orb: { parts: { uncommon: 4, rare: 2 }, fee: 50 },
  };
  const RULES = { batchMax: 5 };
  const partsOf = (a) => a?.parts || {};
  const vesselsOf = (a) => a?.vessels || { shard: 0, bead: 0, orb: 0 };
  function craftable(account, vessel) {
    const r = RECIPES[vessel];
    if (!r) return { max: 0, short: "no such recipe" };
    const p = partsOf(account), seeds = account?.seeds || 0;
    let max = Math.floor(seeds / r.fee);
    for (const [t, q] of Object.entries(r.parts)) max = Math.min(max, Math.floor((p[t] || 0) / q));
    max = Math.max(0, Math.min(RULES.batchMax, max));
    if (max > 0) return { max, short: null };
    const shortPart = Object.entries(r.parts).find(([t, q]) => (p[t] || 0) < q);
    return { max: 0, short: shortPart ? `parts:${shortPart[0]}` : "seeds" };
  }
  function craft(account, vessel, n = 1) {
    const r = RECIPES[vessel];
    if (!r) return { ok: false, short: "no such recipe" };
    n = Math.max(1, Math.min(RULES.batchMax, Math.floor(n) || 1));
    const fee = r.fee * n, p = partsOf(account);
    const shortPart = Object.entries(r.parts).find(([t, q]) => (p[t] || 0) < q * n);
    if (shortPart) return { ok: false, short: `parts:${shortPart[0]}` };
    if ((account?.seeds || 0) < fee) return { ok: false, short: "seeds" };
    const parts = { ...p }, vessels = { ...vesselsOf(account) };
    for (const [t, q] of Object.entries(r.parts)) parts[t] -= q * n;
    vessels[vessel] = (vessels[vessel] || 0) + n;
    return { ok: true, account: { ...account, seeds: account.seeds - fee, parts, vessels } };
  }
  return { RULES, RECIPES, craftable, craft };
});
