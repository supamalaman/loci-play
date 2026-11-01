"use strict";
// Exchange engine (W1.6 build): nothing from nothing. The axiom the
// cooking/alchemy bench obeys — every craft names its costs, taboos take
// tolls, refusal is free, stones defer with interest, conservation audits.
//   RULES                                    → tunables (holding values, toll order)
//   value({ seeds, parts, phi })             → seeds + parts×2 + phi×3
//   preview(recipe)                          → { costs, taboo, warnings } (warnings, never refusals)
//   craft(purse, recipe, acceptToll)         → { ok, purse, got, toll, reason } (pure: the purse is copied)
//   ledgerToll(account, toll, reason)        → account with the toll registry appended
//   audit(paid, recipe)                      → { ok, reason } (conservation checked per craft)
//   defer(account, cost, { note })           → { account, lines } (stone-deferral: debt + interest for U1)
// Input TO the cooking lane, never a competitor: the bench calls preview/
// craft/audit when its recipes carry costs (they don't yet — tag-only
// recipes), so this module has no live caller — exports pinned + tested.
// "parts" is not a live resource (purse accepts it at 0); refusal leaves
// the purse byte-identical; the toll takes the highest-value holding first
// (phi > parts > seeds — Truth reads your sheet!).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CombatExchange = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = { values: { seeds: 1, parts: 2, phi: 3 }, tollOrder: ["phi", "parts", "seeds"], debtInterest: 0.5 };
  const value = (lot = {}) => (lot.seeds || 0) * RULES.values.seeds + (lot.parts || 0) * RULES.values.parts + (lot.phi || 0) * RULES.values.phi;
  function preview(recipe = {}) {
    const costs = { seeds: 0, parts: 0, phi: 0, ...(recipe.in || {}) }, warnings = [];
    if (recipe.taboo) warnings.push(`Taboo: ${recipe.taboo}. Truth will take its toll from what you MOST value.`);
    if (value(costs) > 0) warnings.push(`Named costs up front: ${costs.seeds} Seeds, ${costs.parts} parts, ${costs.phi} ΦF.`);
    return { costs, taboo: !!recipe.taboo, warnings };
  }
  function craft(purse = {}, recipe = {}, acceptToll = false) {
    const p = { seeds: 0, parts: 0, phi: 0, ...purse }, cost = { seeds: 0, parts: 0, phi: 0, ...(recipe.in || {}) };
    if (recipe.taboo && !acceptToll) return { ok: false, purse: { ...purse }, reason: "taboo-unpaid" };   // decline: no craft, costs untouched
    if (p.seeds < cost.seeds || p.parts < cost.parts || p.phi < cost.phi) return { ok: false, purse: { ...purse }, reason: "cant-pay" };
    let toll = null;
    if (recipe.taboo) {
      const holding = RULES.tollOrder.find((k) => p[k] > 0);   // highest-value holding first — personally priced
      if (holding) { p[holding] -= 1; p[holding + "Toll"] = (p[holding + "Toll"] || 0) + 1; toll = { holding }; }
    }
    p.seeds -= cost.seeds; p.parts -= cost.parts; p.phi -= cost.phi;
    return { ok: true, purse: p, got: recipe.out, toll };
  }
  function ledgerToll(account, toll, reason = "") {
    if (!toll) return account;
    return { ...account, tolls: [...(account?.tolls || []), { holding: toll.holding, reason }] };
  }
  function audit(paid = {}, recipe = {}) {
    const cost = { seeds: 0, parts: 0, phi: 0, ...(recipe.in || {}) };
    for (const k of ["seeds", "parts", "phi"]) if ((paid[k] || 0) < cost[k]) return { ok: false, reason: `Conservation broken: short ${cost[k] - (paid[k] || 0)} ${k}. Cheaters flagged!` };
    return { ok: true };
  }
  function defer(account, cost = {}, { note = "" } = {}) {
    const owed = value(cost);
    if (!owed) return { account, lines: [] };
    const debt = { owed, interest: RULES.debtInterest, note };
    return { account: { ...account, debts: [...(account?.debts || []), debt] },
      lines: [`Soul-fuel defers ${owed} value — stones defer, never break. The toll accrues (+${RULES.debtInterest * 100}%). U1 collects.`] };
  }
  return { RULES, value, preview, craft, ledgerToll, audit, defer };
});
