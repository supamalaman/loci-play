"use strict";
// Keeper Seeds perks P1 to P4 (NPC faces S7; spec section 7.2 / Decision D4).
// Flag `KEEPER_PERKS` in npc/keepers.js stays false until Mala turns the numbers on. When true, a keeper that names a
// perk, at rapport tier 2 or more, with no open Seeds debt, takes 10 percent off ONE priced transaction per battle-cycle
// (account.battles), rounded down, at least 1 Seed saved, never on a graft, never on a sale, never stacked.
//
//   available(account, keeperId)           → true when the flag is on and this keeper can still give the perk this cycle
//   saveOf(price) / priceAfter(price)      → Seeds saved / price to pay (pure; no eligibility check)
//   apply(account, keeperId, price)        → { account, price, saved }  marks perkAt = battles when it fires
//
// P1 Pioneer (shop buy), P2 Smith (repairService), P3 Jambavan (hall hire), P4 Mad Scientist (removal only).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../npc/keepers.js"), require("./keepers.js"));
  else root.ConceptCombatKeeperPerks = factory(root.ConceptCombatKeepers, root.ConceptCombatKeeperMemory);
})(typeof self !== "undefined" ? self : this, function (K, M) {
  const nat = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const debtOpen = (a) => nat(a && a.debt) > 0 || (Array.isArray(a && a.debts) && a.debts.some((d) => nat(d && (d.owed != null ? d.owed : d)) > 0));
  const saveOf = (price) => { const p = Math.max(0, Math.floor(Number(price) || 0)); return p > 0 ? Math.max(1, Math.floor(p * 0.1)) : 0; };
  const priceAfter = (price) => { const p = Math.max(0, Math.floor(Number(price) || 0)); return Math.max(0, p - saveOf(p)); };

  function available(account, keeperId) {
    if (K.KEEPER_PERKS !== true) return false;
    const k = K.KEEPERS[keeperId];
    if (!k || !k.perk) return false;
    if (debtOpen(account)) return false;
    const rec = M.recordOf(account, keeperId);
    if (M.tierOf(rec) < 2) return false;
    // Used this cycle when perkAt was written and equals the current battles clock (0 before the first battle counts).
    if (rec.perkAt != null && nat(rec.perkAt) === nat(account && account.battles)) return false;
    return true;
  }

  function apply(account, keeperId, price) {
    const list = Math.max(0, Math.floor(Number(price) || 0));
    if (!available(account, keeperId) || list <= 0) return { account, price: list, saved: 0 };
    const saved = saveOf(list), next = priceAfter(list);
    const rec = M.recordOf(account, keeperId);
    return { account: M.withRecord(account, keeperId, { ...rec, perkAt: nat(account && account.battles) }), price: next, saved };
  }

  return { available, saveOf, priceAfter, apply, debtOpen };
});
