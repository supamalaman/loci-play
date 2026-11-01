"use strict";
// Imitate (Muse's trait spec section 4; sandbox batch 9 proved the within-battle half; ported 2026-10-10 as C11 with
// the cross-battle half). Once you have found a psychology or values trait on someone, you can try to take it on.
// A copy is TEMPORARY: it lasts `tempBattles` battles. Imitating a trait you already hold a copy of is practice:
// enough practice makes it permanent. Biology can never be imitated.
//
//   chance({ difficulty, counters, synergies, demonstrated })   → 0..1 for one attempt
//   of(account)                 → { temp: { trait: battlesLeft }, progress: { trait: n }, permanent: [trait] }
//   carried(account)            → trait ids to bring into the next battle
//   needed(difficulty)          → practice points that make a copy permanent
//   settle(account, imitations, difficultyOf) → { account, lines }   call once after each battle
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatImitation = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const rules = { ap: 20, tempBattles: 3, base: 0.85, perDifficulty: 0.15, perCounter: 0.15, perSynergy: 0.10, demonstratedAdd: 0.10, min: 0.15, max: 0.95,
    practice: 1, practiceDemonstrated: 2, permanentOver: 2, aiChance: 0.5 };
  const chance = ({ difficulty = 1, counters = 0, synergies = 0, demonstrated = false } = {}) =>
    Math.max(rules.min, Math.min(rules.max, rules.base - rules.perDifficulty * (difficulty - 1) - rules.perCounter * counters + rules.perSynergy * synergies + (demonstrated ? rules.demonstratedAdd : 0)));
  const needed = (difficulty = 1) => difficulty + rules.permanentOver;
  const of = (account) => { const i = account?.imitation || {}; return { temp: { ...(i.temp || {}) }, progress: { ...(i.progress || {}) }, permanent: [...(i.permanent || [])] }; };
  const carried = (account) => { const i = of(account); return [...new Set([...i.permanent, ...Object.keys(i.temp).filter((t) => i.temp[t] > 0)])]; };
  // imitations: [{ trait, demonstrated }] the player's successful attempts this battle. Copies age by one battle first.
  function settle(account, imitations = [], difficultyOf = () => 1, nameOf = (t) => t) {
    const i = of(account), lines = [];
    for (const t of Object.keys(i.temp)) { i.temp[t] -= 1; if (i.temp[t] <= 0) { delete i.temp[t]; if (!i.permanent.includes(t)) lines.push(`Your imitation of ${nameOf(t)} has faded.`); } }
    for (const { trait, demonstrated } of imitations) {
      if (i.permanent.includes(trait)) continue;
      i.progress[trait] = (i.progress[trait] || 0) + (demonstrated ? rules.practiceDemonstrated : rules.practice);
      if (i.progress[trait] >= needed(difficultyOf(trait))) { i.permanent.push(trait); delete i.temp[trait]; lines.push(`${nameOf(trait)} is yours now. It no longer fades.`); }
      else { i.temp[trait] = rules.tempBattles; lines.push(`You carry ${nameOf(trait)} for ${rules.tempBattles} more battles (practice ${i.progress[trait]}/${needed(difficultyOf(trait))}).`); }
    }
    return { account: { ...account, imitation: i }, lines };
  }
  return { rules, chance, needed, of, carried, settle };
});
