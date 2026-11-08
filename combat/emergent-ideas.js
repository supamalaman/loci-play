"use strict";
// Emergent Ideas are derived from what one living actor currently holds. They are not
// learned traits, extra concept slots, or cached bonuses that survive a loadout change.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./content.js"));
  else root.ConceptCombatEmergentIdeas = factory(root.ConceptCombatContent);
})(typeof self !== "undefined" ? self : this, function (C) {
  const rules = C.rules.emergentIdeas;
  const ideas = {
    proficientSummoner: {
      name: "Proficient Summoner", requires: { concepts: ["imagination"], traits: ["fullBeliever"] },
      text: "Imagination + Full Believer: half the AP per call, two active summons, and a fresh 5-point ward on each summon’s turn. Calls remain separate actions.",
      effects: rules.proficientSummoner,
    },
    // Mala, 2026-10-12: Genius + Imagination. A technique a Genius picks up by watching is a Breakthrough, and a
    // Breakthrough is worth Inspiration. Spending Inspiration waits for its own design; today it is awarded and counted.
    breakthrough: {
      name: "Breakthrough", requires: { concepts: ["imagination"], traits: ["genius"] },
      text: "Genius + Imagination: every technique learned by watching is a Breakthrough, worth a point of Inspiration (3 at most).",
      effects: rules.breakthrough,
    },
    fulcrumThrow: {
      name: "Fulcrum Throw", requires: { concepts: ["timing", "leverage"] },
      text: "Timing + Leverage: lift a unit or a loose object beside you and throw it. The thrown opponent is hurt, more if it was held, and so is whoever it lands on.",
      effects: rules.fulcrumThrow,
    },
  };
  const traitId = (t) => typeof t === "string" ? t : t?.id;
  function active(actor, catalog = ideas) {
    if (!actor || actor.defeated || actor.notArrived || actor.lf <= 0) return [];
    const concepts = new Set(actor.embodied ? [actor.primary, actor.embodied.primary, actor.embodied.secondary] : [actor.primary, actor.secondary]), traits = new Set((actor.traits || []).map(traitId));
    if (traits.has("imaginative")) concepts.add("imagination");   // the Imaginative trait counts as holding Imagination (Mala, 2026-10-12)
    return Object.entries(catalog).filter(([, idea]) =>
      (idea.requires.concepts || []).every(id => concepts.has(id)) &&
      (idea.requires.traits || []).every(id => traits.has(id)))
      .map(([id, idea]) => ({ id, ...idea }));
  }
  function summonProfile(actor, base, maxActive = 1) {
    const idea = active(actor).find(x => x.id === "proficientSummoner"), effect = idea?.effects;
    return { ...base, apCost: Math.max(1, Math.ceil(base.apCost * (effect?.apMul ?? 1))),
      maxActive: effect?.maxActive ?? maxActive, wardProtection: effect?.wardProtection ?? 0,
      emergentIdea: idea?.id || null };
  }
  // One ward slot. A stronger external ward is retained; protection is never added
  // to it. Once this ward is depleted it stays depleted until the summon's own turn.
  const summonerOf = actor => actor?.summon?.owner || actor?.summonBinding?.owner || (actor?.companion?.card ? actor.companion.owner : null) || null;   // a card familiar (Battle Cards C3) holds its owner's summon slot
  function summonPresent(actor) {
    if (!actor || actor.notArrived || actor.summonBinding?.expired) return false;
    return (!actor.defeated && actor.lf > 0) || !!(actor.summonBinding && actor.passive === "reassemble" &&
      actor.defeated && !actor.scattered && !actor.reassembled);
  }
  function refreshSummonWard(state, summon) {
    const ownerId = summonerOf(summon);
    if (!ownerId || summon.defeated || summon.lf <= 0 || summon.summonBinding?.expired) return false;
    const owner = state.actors[ownerId], idea = active(owner).find(x => x.id === "proficientSummoner");
    if (!idea || owner.side !== summon.side) return false;
    const protection = idea.effects.wardProtection;
    const old = summon.status.ward;
    const expired = old && old.expiresAt <= state.actors[old.owner]?.ownerTurns;
    if (old && !expired && old.protection > protection) return false;
    summon.status.ward = { label: "Proficient Summoner ward", owner: summon.id, protection,
      expiresAt: summon.ownerTurns + 1, emergentIdea: idea.id, summoner: owner.id };
    return true;
  }
  function syncSummonWards(state) {
    for (const summon of Object.values(state.actors)) {
      const ward = summon.status?.ward;
      if (ward?.emergentIdea !== "proficientSummoner") continue;
      const owner = state.actors[ward.summoner];
      if (summon.defeated || summon.lf <= 0 || summon.summonBinding?.expired || summonerOf(summon) !== ward.summoner ||
        !active(owner).some(x => x.id === ward.emergentIdea) || owner.side !== summon.side)
        summon.status.ward = null;
    }
  }
  function rehearsalHints(actor) {
    const r = actor?.status?.imaginedRehearsal;
    return r && r.expiresAt > actor.ownerTurns ? r.hints : 0;
  }
  return { rules, ideas, active, summonProfile, summonerOf, summonPresent, refreshSummonWard, syncSummonWards, rehearsalHints };
});
