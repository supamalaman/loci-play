"use strict";
// Kiln crafting (vessel economy build): salvage parts + Seeds firing fees become vessels.
// Deterministic: no fail chance — crafting is a sink, not a gamble. Pure account ledger:
// craft() refuses (naming the shortfall) instead of driving anything negative.
//
//   RULES                     → recipes + batchMax (all provisional; Mala tunes)
//   RECIPES                   → { shard/bead/orb: { parts, fee } }
//   craftable(account, v)     → { max, short } (how many of v the ledger can fire now)
//   craft(account, vessel, n, { flux }) → { ok, account, fluxed } | { ok: false, short }   flux: 1 orgonite waives one firing's fee
//   ORGONITE / refinable(account) / refine(account, n) → orgonite: 5 common + 10 Seeds → 1 (codex-orgonite spec §10.1)
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
  // Orgonite (codex-orgonite spec, slice 1; recipe v2, Mala 2026-10-31): a pure commons outlet. 5 common + 10 Seeds → 1 puck.
  // Spent as flux (waives one firing's fee) or sold at the stall (market.js sellOrgonite). It is not a vessel: the Monster
  // Bank never quotes it and it claims no tier.
  const ORGONITE = { parts: { common: 5 }, fee: 10 };
  // Orgonite charm (ORGONITE.md §10.3): 3 pucks + 10 Seeds → one worn charm. One owned piece, never a stack.
  const CHARM = { orgonite: 3, fee: 10, id: "orgoniteCharm" };
  const partsOf = (a) => a?.parts || {};
  const vesselsOf = (a) => a?.vessels || { shard: 0, bead: 0, orb: 0 };
  function craftable(account, vessel, { flux = false } = {}) {
    const r = RECIPES[vessel];
    if (!r) return { max: 0, short: "no such recipe" };
    const p = partsOf(account), seeds = account?.seeds || 0, pucks = flux ? Math.max(0, account?.orgonite || 0) : 0;
    let max = pucks + Math.floor(seeds / r.fee);   // with Flux, each puck pays one firing's fee
    for (const [t, q] of Object.entries(r.parts)) max = Math.min(max, Math.floor((p[t] || 0) / q));
    max = Math.max(0, Math.min(RULES.batchMax, max));
    if (max > 0) return { max, short: null };
    const shortPart = Object.entries(r.parts).find(([t, q]) => (p[t] || 0) < q);
    return { max: 0, short: shortPart ? `parts:${shortPart[0]}` : "seeds" };
  }
  function craft(account, vessel, n = 1, { flux = false } = {}) {
    const r = RECIPES[vessel];
    if (!r) return { ok: false, short: "no such recipe" };
    n = Math.max(1, Math.min(RULES.batchMax, Math.floor(n) || 1));
    const fluxed = flux ? Math.min(n, Math.max(0, account?.orgonite || 0)) : 0;   // each puck waives one firing's fee, never more
    const fee = r.fee * (n - fluxed), p = partsOf(account);
    const shortPart = Object.entries(r.parts).find(([t, q]) => (p[t] || 0) < q * n);
    if (shortPart) return { ok: false, short: `parts:${shortPart[0]}` };
    if ((account?.seeds || 0) < fee) return { ok: false, short: "seeds" };
    const parts = { ...p }, vessels = { ...vesselsOf(account) };
    for (const [t, q] of Object.entries(r.parts)) parts[t] -= q * n;
    vessels[vessel] = (vessels[vessel] || 0) + n;
    const out = { ...account, seeds: account.seeds - fee, parts, vessels };
    if (fluxed) out.orgonite = (account.orgonite || 0) - fluxed;
    return { ok: true, account: out, fluxed };
  }
  function refinable(account) {
    const p = partsOf(account);
    const max = Math.max(0, Math.min(RULES.batchMax, Math.floor((p.common || 0) / ORGONITE.parts.common), Math.floor((account?.seeds || 0) / ORGONITE.fee)));
    return max > 0 ? { max, short: null } : { max: 0, short: (p.common || 0) < ORGONITE.parts.common ? "parts:common" : "seeds" };
  }
  function refine(account, n = 1) {
    n = Math.max(1, Math.min(RULES.batchMax, Math.floor(n) || 1));
    const p = partsOf(account), need = ORGONITE.parts.common * n, fee = ORGONITE.fee * n;
    if ((p.common || 0) < need) return { ok: false, short: "parts:common" };
    if ((account?.seeds || 0) < fee) return { ok: false, short: "seeds" };
    return { ok: true, n, account: { ...account, seeds: account.seeds - fee, parts: { ...p, common: p.common - need }, orgonite: (account.orgonite || 0) + n } };
  }
  function charmable(account) {
    if ((account?.gear?.owned || []).includes(CHARM.id)) return { max: 0, short: "owned" };
    if ((account?.orgonite || 0) < CHARM.orgonite) return { max: 0, short: "orgonite" };
    if ((account?.seeds || 0) < CHARM.fee) return { max: 0, short: "seeds" };
    return { max: 1, short: null };
  }
  function castCharm(account) {
    const got = charmable(account);
    if (!got.max) return { ok: false, short: got.short };
    return { ok: true, account: { ...account, seeds: account.seeds - CHARM.fee, orgonite: account.orgonite - CHARM.orgonite } };
  }
  return { RULES, RECIPES, ORGONITE, CHARM, craftable, craft, refinable, refine, charmable, castCharm };
});
