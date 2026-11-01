"use strict";
// Personal-vow rewards (W4.4 build; re-cut by Pantry on 1.3.428 to muse-wave4/specs/PVREWARDS.md and its sim):
// pass/fail, never partial. A kept PV on a win pays a stipend (the early dreamer eats: 10 Seeds sworn in round 1,
// one less each round after, never under 2), 5 XP, and bonus discovery credits; the base credit (1 per kept vow,
// win or lose) is chain D's W6.1 grant in loot.js, so it is not paid here. A broken one pays nothing and marks the
// ledger oath-unkept.
//   RULES                        → tunables (stipend base/decay/floor, XP, wallet, mark)
//   stipend(declRound)           → max(2, 10 − turns since round 1) Seeds
//   (averse souls count +2 turns in the share math: RULES.averseTurnPenalty;
//    VOWKIT applies it when the share mechanic lands — no caller yet, so no export)
//   turn0(declRound, consent)        → the dawn bonus needs round 0 AND express consent
//   wallet({ turn0, prone, collective }) → Monomyth Credits for one completion
//   collective(declarations, actors, side) → Set of actors in a Collective Promise
//   settle(completions, brokenCount) → { seeds, xp, credits, marks, lines }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CombatPvRewards = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = {
    stipendBase: 10, stipendDecay: 1, stipendFloor: 2,   // the spec's declareTurn counts from round 1 (battles open there)
    xpEach: 5, baseCredits: 1,   // baseCredits: paid by W6.1's TR.grantFor(a, "vow"), counted here only for the ×2
    averseTurnPenalty: 2, oathMark: "oath-unkept",
  };
  const stipend = (declRound) => Math.max(RULES.stipendFloor, RULES.stipendBase - RULES.stipendDecay * Math.max(0, (declRound || 1) - 1));
  // W4.6: the dawn bonus needs the declaration's round AND its consent flag. Round 0 only: battles open at round 1, so it
  // is unreachable until Mala rules (a pre-battle declaration phase, or move the bonus to round 1; codex-vowkit NOTE).
  const turn0 = (declRound, consent) => declRound === 0 && !!consent;
  // The wallet: 1 credit, +1 for a consented turn-0 declaration, +1 for vow-prone
  // souls (TRAITPV), then doubled for a Collective Promise. settle pays the wallet less the base credit. Flag inputs — the UI certifies
  // them (consent has no UI yet, so turn0 is always false until VOWKIT lands it).
  const wallet = ({ turn0 = false, prone = false, collective = false } = {}) => {
    const n = RULES.baseCredits + (turn0 ? 1 : 0) + (prone ? 1 : 0);
    return collective ? n * 2 : n;
  };
  // Collective Promise: 2+ declarers on the identical (on, boon), unanimous across
  // the side's living vow-eligible. A lone declarer is unanimous but not collective.
  function collective(declarations, actors, side) {
    const groups = {};
    for (const d of declarations || []) { const k = d.on + "|" + d.boon; (groups[k] ||= []).push(d.actor); }
    const eligible = Object.values(actors || {})
      .filter((a) => a.side === side && !a.defeated && !a.summon && !a.notArrived).map((a) => a.id);
    const out = new Set();
    for (const ids of Object.values(groups)) {
      if (ids.length < 2) continue;
      if (eligible.length && eligible.every((id) => ids.includes(id))) for (const id of ids) out.add(id);
    }
    return out;
  }
  function settle(completions, brokenCount) {
    let seeds = 0, xp = 0, credits = 0;
    const marks = [], lines = [];
    for (const c of completions || []) {
      const pay = stipend(c.declRound), bonus = Math.max(0, wallet(c) - RULES.baseCredits);   // the base credit is W6.1's
      seeds += pay; xp += RULES.xpEach; credits += bonus;
      lines.push(`Kept vow (${c.name || "oath"}, sworn round ${c.declRound}): +${pay} Seeds, +${RULES.xpEach} XP${bonus ? `, +${bonus} more discover${bonus === 1 ? "y" : "ies"}` : ""}${c.collective ? " (Collective Promise ×2)" : ""}.`);
    }
    for (let i = 0; i < (brokenCount || 0); i++) marks.push(RULES.oathMark);
    if (brokenCount > 0) lines.push(`${brokenCount} vow${brokenCount === 1 ? " was" : "s were"} broken: the ledger marks ${RULES.oathMark} ×${brokenCount}.`);
    return { seeds, xp, credits, marks, lines };
  }
  return { RULES, stipend, turn0, wallet, collective, settle };
});
