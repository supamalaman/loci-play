"use strict";
// Class rules for the class expansion pack. Pure functions; data in classes-data.js. Spec: ~/Documents/concept-combat-classes.md.
//
//   conceptStatus(id, { content, graph })            → "playable" | "graphed" | pack status ("admit", "fold", "proposed") | "unknown"
//   validateLoadout(loadout, { learned, reserveSlots, tradition }) → { ok, errors }
//   abilityAccess(loadout, abilities)                 → { primary, secondary, ultimates, merges }  (secondary never grants ultimates)
//   spendUltimate(state, abilityId, abilities)         → { state } or { error }   a merge uses the primary's ultimate opportunity
//   validatePipeline(steps, learned)                  → { ok, cost, reason }   Wizard: typed interfaces, learned concepts only
//   wheelHouseFor(classId, records)                   → { slots, rejected, version, errors }
//   traditionAccess(tradition, abilityId)             → bool   a tradition is a bounded repertoire
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./classes-data.js"));
  else root.ConceptCombatClasses = factory(root.ConceptCombatClassData);
})(typeof self !== "undefined" ? self : this, function (CD) {

  function conceptStatus(id, { content = null, graph = null } = {}) {
    if (content?.concepts?.[id]) return "playable";
    if (graph?.nodes?.[id]) return "graphed";
    return CD.proposedConcepts[id]?.status || "unknown";
  }

  function validateLoadout({ primary, secondary, reserve = [], tradition = null }, { learned = [], reserveSlots = CD.loadout.reserveStart } = {}) {
    const errors = [], has = new Set(learned);
    if (!primary && !tradition) errors.push("A primary concept (or a tradition) is required.");
    if (!secondary) errors.push("A secondary concept is required.");
    if (primary && primary === secondary) errors.push("Primary and secondary must differ.");
    if (reserve.length > reserveSlots) errors.push(`Only ${reserveSlots} reserve slot${reserveSlots === 1 ? "" : "s"} at this level.`);
    for (const c of [primary, secondary, ...reserve].filter(Boolean)) if (!has.has(c)) errors.push(`${c} hasn't been learned.`);
    if (tradition && primary) errors.push("A tradition occupies the primary slot; it can't sit beside a primary concept.");
    return { ok: errors.length === 0, errors };
  }

  // abilities: { id: { tier, concepts, merge } }
  function abilityAccess({ primary, secondary }, abilities) {
    const of = (c) => Object.entries(abilities).filter(([, a]) => !a.merge && a.concepts.includes(c));
    const prim = of(primary).map(([id]) => id);
    const sec = of(secondary).filter(([, a]) => a.tier !== "ultimate").map(([id]) => id);   // secondary: non-ultimate only
    const merges = Object.entries(abilities).filter(([, a]) => a.merge && a.concepts[0] === primary && a.concepts[1] === secondary).map(([id]) => id);
    const ultimates = [...of(primary).filter(([, a]) => a.tier === "ultimate").map(([id]) => id), ...merges];
    return { primary: prim, secondary: sec, merges, ultimates };
  }

  // One ultimate opportunity per full charge, shared by the primary's ultimate and the class merge.
  function spendUltimate(state, abilityId, abilities) {
    const a = abilities[abilityId];
    if (!a || a.tier !== "ultimate") return { state, error: "Not an ultimate." };
    if (state.ultimateSpent) return { state, error: "This charge's ultimate opportunity is already used (the merge shares it with the primary's)." };
    return { state: { ...state, ultimateSpent: abilityId } };
  }

  // Wizard pipeline: steps [{ op, concept, in, out, adapter? }]. Rejected BEFORE commitment, at no cost.
  function validatePipeline(steps, learned = []) {
    const has = new Set(learned);
    for (const s of steps) if (!s.adapter && !has.has(s.concept)) return { ok: false, cost: 0, reason: `${s.op} needs ${s.concept}, which you haven't learned. A pipeline can't grant a concept.` };
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1], b = steps[i];
      if (a.out !== b.in) return { ok: false, cost: 0, reason: `${a.op} outputs ${a.out} but ${b.op} takes ${b.in}: add an adapter or change the order.` };
    }
    return { ok: true, cost: steps.filter((s) => !s.adapter).length };
  }

  function wheelHouseFor(classId, records = CD.wheelHouseRecords[classId] || []) {
    const errors = [];
    for (const r of records) for (const f of CD.wheelHouse.recordFields) if (!(f in r)) errors.push(`${r.conceptId}: missing ${f}`);
    const latest = new Map();
    for (const r of records) if (!latest.has(r.conceptId) || latest.get(r.conceptId).version < r.version) latest.set(r.conceptId, r);
    const all = [...latest.values()];
    const supported = all.filter((r) => r.evaluationStatus === "supported" && r.successfulScenario && r.failureOrCounterexample);
    return { slots: supported.slice(0, CD.wheelHouse.slots).map((r) => r.conceptId), rejected: all.filter((r) => r.evaluationStatus === "rejected"),
      version: Math.max(0, ...all.map((r) => r.version)), errors,
      grants: { extraAbilities: CD.wheelHouse.grantsExtraAbilities, extraSlots: CD.wheelHouse.grantsExtraEquippedSlots, powerBonus: CD.wheelHouse.automaticPowerBonus } };
  }

  const traditionAccess = (tradition, abilityId) => (tradition?.repertoire || []).includes(abilityId);

  return { conceptStatus, validateLoadout, abilityAccess, spendUltimate, validatePipeline, wheelHouseFor, traditionAccess, data: CD };
});
