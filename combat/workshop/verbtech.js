"use strict";
// Verb techniques, batch 1 (verb:NODES heal/care/scrap): MEND heals the living,
// TEND raises the downed (once each), SALVAGE strips adjacent corpses for Seeds.
// Default dials only (dial tuning is a later build — loop:1a17ce1c47e); verbs are universal —
// everyone can try one, no ownership (NODES.md names no ownership rule).
// Costs are charged by the action handlers; these fns validate + execute.
//
// When the vessel economy lands, SALVAGE haul converts from Seeds to salvage
// parts (one settle line + RULES — loop:1a17ce1c4d1, not built).
//
//   BODIED                → verbs with executable techniques (the rest mint, but have no body yet — loop:1a17cfb2680)
//   RULES                 → costs + yields (all provisional; Mala tunes)
//   mend(s, a, t)         → { ok, healed, text } | { ok: false, error }
//   tend(s, a, t)         → { ok, text } | { ok: false, error }
//   salvage(s, a, id)     → { ok, corpse, seeds, text } | { ok: false, error }
//   finishHaul(s)         → Seeds salvaged this battle (settle pays them)
//   settleHaul(s, pv)     → haul paid into pv.seeds (+ line); the settle path calls this
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatVerbTech = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const BODIED = new Set([9, 10, 14]);   // TEND, MEND, SALVAGE: the only executable verbs (loop:1a17cfb2680 batches the rest)
  const RULES = {
    mendAp: 25, mendPhi: 4, mendHeal: 8,       // MEND (verb 10): contact care for the living
    tendAp: 40, tendPhi: 8,                    // TEND (verb 9): raise a downed ally at 1 LF, once each
    salvageAp: 30, salvageSeeds: 6,            // SALVAGE (verb 14): strip an adjacent corpse (Seeds until parts land)
  };
  const beside = (s, a, x, y) => Math.max(Math.abs(x - a.x), Math.abs(y - a.y)) <= 1;
  function mend(s, a, t, skipWhole = false) {
    if (!t || t.defeated) return { ok: false, error: "MEND needs a standing ally (the downed need TEND)." };
    if (t.side !== a.side && t.id !== a.id) return { ok: false, error: "MEND is care, not war: allies and self only." };
    if (t.id !== a.id && !beside(s, a, t.x, t.y)) return { ok: false, error: `${t.name} is too far to reach.` };
    const whole = (t.lf ?? 0) >= (t.maxLF ?? 0);
    if (whole && !skipWhole) return { ok: false, error: `${t.name} is already whole.` };
    const healed = whole ? 0 : Math.min(RULES.mendHeal, t.maxLF - t.lf);
    t.lf += healed;
    return whole
      ? { ok: true, healed, text: `${a.name} works over ${t.id === a.id ? "their own wounds" : t.name} (already at full LF).` }
      : { ok: true, healed, text: `${a.name} mends ${t.id === a.id ? "their own wounds" : t.name}: +${healed} LF.` };
  }
  function tend(s, a, t) {
    if (!t || !t.defeated) return { ok: false, error: "TEND needs a downed ally (the standing need MEND)." };
    if (t.escaped || t.notArrived || t.knockedOut || t.summon || t.summonBinding || t.clone || t.dream || t.companion || t.communed) return { ok: false, error: `${t.name} is gone, not down — there is nothing left to tend.` };   // the no-corpse family (conditions.js corpseSweep): never dead, never raised
    if (t.side !== a.side || t.id === a.id) return { ok: false, error: "TEND raises allies — the fallen beside you, not foes." };
    if (!beside(s, a, t.x, t.y)) return { ok: false, error: `${t.name} is too far to reach.` };
    if (t.sacrifice) return { ok: false, error: `${t.name} gave their life on purpose: TEND does not take it back.` };   // a sacrifice stays given (1.3.455 audit)
    if (s.corpseMade?.[t.id] && !(s.corpses || []).some((c) => c.of === t.id)) return { ok: false, error: `${t.name}'s body is gone (salvaged or buried): there is nothing left to tend.` };   // one body pays once (merge check, 1.3.455)
    s.tendRaised ||= {};
    if (s.tendRaised[t.id]) return { ok: false, error: `${t.name} has been raised once already — death keeps the receipt.` };
    s.tendRaised[t.id] = 1;
    t.defeated = false; t.spent = false; t.lf = 1;
    s.corpses = (s.corpses || []).filter((c) => c.of !== t.id);   // raised: no body left to bury or salvage (conversion.js revive)
    return { ok: true, text: `${a.name} tends ${t.name}, who sits back up at 1 LF. No body left behind. Once is mercy; twice is bookkeeping.` };
  }
  function salvage(s, a, id) {
    const corpses = s.corpses || [];
    const c = id ? corpses.find((x) => x.id === id) : [...corpses].sort((p, q) => (p.id < q.id ? -1 : 1)).find((x) => beside(s, a, x.x, x.y));
    if (!c) return { ok: false, error: "SALVAGE needs a body beside you." };
    if (!beside(s, a, c.x, c.y)) return { ok: false, error: "That body is too far to reach." };
    s.corpses = corpses.filter((x) => x.id !== c.id);   // stripped: no burial after (the rite yields to the ledger)
    s.salvageHaul = (s.salvageHaul || 0) + RULES.salvageSeeds;
    return { ok: true, corpse: c.id, seeds: RULES.salvageSeeds, text: `${a.name} salvages ${c.name || "the fallen"}: +${RULES.salvageSeeds} Seeds of usable remains. The body is spent.` };
  }
  function finishHaul(s) { return s.salvageHaul || 0; }
  function settleHaul(s, pv) { const haul = finishHaul(s); if (haul > 0) { pv.seeds += haul; pv.lines.push(`SALVAGE haul: +${haul} Seeds of usable remains.`); } return haul; }
  return { BODIED, RULES, mend, tend, salvage, finishHaul, settleHaul };
});
