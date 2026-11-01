"use strict";
// Mint (W4.1 build): every Seed traced to its faucet, every new faucet
// capped. Battles are the only tap (Hall is battles-adjacent); single
// player means every Seed is minted, none move — so each new source pays
// under the mint cap and the mint has a work ethic (no pay for idling).
//   SOURCES                        → the six verified live faucets + new-faucet slots
//   PER_SOURCE                     → per-source per-battle cap (55: each ≤ battle pace)
//   NEW_COMBINED_MUL               → all new faucets combined ≤ 2× battle pace
//   pace(seedRules)                → typical battle income (victory + 2 enemies)
//   capped(source, amount)         → amount held under the cap (unknown sources: 0 + flag)
//   audit(seedRules, minted)       → { pace, newTotal, ok, flags } over one battle's mint
//   legendaryPace(seedRules)        → battles for a 400-Seed legendary at typical income
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatMint = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // The six verified live faucets (SEEDS.md §ALL sources): uncapped —
  // they ARE the baseline everything new is priced under.
  const SOURCES = ["battlePay", "bossBonus", "conversions", "manualSell", "hall", "royalTribute"];
  // New-faucet slots: capped each and combined. Reserved names mint nothing
  // until their wave lands (unknown sources pay 0 — the mint has a work ethic).
  const NEW_SOURCES = ["board", "bingo", "ante", "ladder", "busking", "tutor", "stall"];   // stall: vessel/catch/order income (ruling 8)
  const PER_SOURCE = 55;
  const NEW_COMBINED_MUL = 2;
  function pace(seedRules) {
    return seedRules.victory + 2 * seedRules.perEnemy;   // a typical win: the victory purse + two enemies
  }
  function capped(source, amount) {
    if (!NEW_SOURCES.includes(source)) return { seeds: 0, flag: `unknown faucet ${source}: pays nothing` };
    if (!(amount > 0)) return { seeds: 0, flag: null };
    if (amount > PER_SOURCE) return { seeds: PER_SOURCE, flag: `${source} ${amount} over the ${PER_SOURCE} mint cap` };
    return { seeds: amount, flag: null };
  }
  function audit(seedRules, minted) {
    const p = pace(seedRules), flags = [];
    let newTotal = 0;
    for (const [source, amount] of Object.entries(minted || {})) {
      if (SOURCES.includes(source)) continue;   // the baseline audits itself (sim reproduces the formula)
      const r = capped(source, amount);
      newTotal += r.seeds;
      if (r.flag) flags.push(r.flag);
    }
    if (newTotal > NEW_COMBINED_MUL * p) flags.push(`new faucets ${newTotal} over ${NEW_COMBINED_MUL}× battle pace (${p})`);
    return { pace: p, newTotal, ok: !flags.length, flags };
  }
  function legendaryPace(seedRules) {
    return 400 / pace(seedRules);   // a 400-Seed legendary at typical income (the grind is REAL but finite)
  }
  return { SOURCES, NEW_SOURCES, PER_SOURCE, NEW_COMBINED_MUL, pace, capped, audit, legendaryPace };
});
