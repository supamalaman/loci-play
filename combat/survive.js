"use strict";
// Survive the killing blow (Mala, 2026-10-24): "keep the survive the killing blow base mechanic unified, and the additional
// effects character specific; simplicity in design will repay us later." One base rule for every mechanic where the first
// blow that would defeat a unit leaves it standing: the Martial Artist's Zenkai, the Mummy's Retinue Rises (Bonds), and any
// State Kit row with a `lethal` trigger (Lakshmana, felled not slain).
//
// A rule is data plus the character's own follow-up:
//   { id, holds(s, u, H) -> bool, chance?, roll?(s, u) -> [0, 1), then(s, u, H) }
// The base owns what they share: once a battle per unit and rule (u.survived[id] = round; a rule with a chance spends it on
// the attempt, whether or not the roll lands), the unit kept at 1 LF, and then the rule's own effects.
//
//   survive(s, u, rule, H) -> true when the unit is kept up (the engine skips the defeat)
//   first(s, u, rules, H)  -> the first rule that keeps the unit up, in order
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSurvive = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function survive(s, u, rule, H) {
    if (!u || !rule || !rule.holds(s, u, H)) return false;
    const done = (u.survived ||= {});
    if (done[rule.id] != null) return false;
    done[rule.id] = s.round ?? 0;
    if (rule.chance != null && rule.roll(s, u) >= rule.chance) return false;
    u.lf = 1;
    rule.then(s, u, H);
    return true;
  }
  const first = (s, u, rules, H) => (rules || []).some((r) => survive(s, u, r, H));
  return { survive, first };
});
