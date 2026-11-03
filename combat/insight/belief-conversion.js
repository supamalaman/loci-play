"use strict";
// Event-based conversion: skepticism changes only after a character directly witnesses
// distinct supernatural events. Extraordinary events count more, and a deterministic
// response can rationalize, tentatively accept, or fully believe what was witnessed.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatBeliefConversion = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SUPERNATURAL = new Set(["dreamSpace", "fieldOpen", "dreamAppear", "summon", "summonOrder", "summonUltimate",
    "monsterSummon", "gaiaSummon", "mythicReveal", "bossAppear", "dragonAppear", "cardPlay", "handShown",
    "holySmite", "holyHymn", "holyHands"]);   // holy power (docs/holy.md): a Smite seen, a Hymn sung, a hand laid on someone   // Battle Cards (CARDS.md 18.3): a card play, and showing a hand, are events a skeptic can witness
  const MYTHIC_NAMES = /dragon|kaiju|oni|gaia|vampire|mummy|skeleton|frankenstein|werewolf|ghost|zombie|hydra|griffin|phoenix|unicorn|titan|demon|angel|chimera|basilisk|fae/i;
  const WITNESSES_REQUIRED = 2;
  const OUTCOME_WEIGHTS = { rationalize: 0.4, devout: 0.4, full: 0.2 };

  function seededRoll(seed, label) {
    let h = 2166136261;
    for (const c of `${seed}:${label}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function outcomeFor(actor, seed = 0) {
    const roll = seededRoll(seed, `${actor?.id || actor?.character || "skeptic"}:belief-outcome:${actor?.beliefAttempts || 0}`);
    if (roll < OUTCOME_WEIGHTS.rationalize) return "rationalize";
    if (roll < OUTCOME_WEIGHTS.rationalize + OUTCOME_WEIGHTS.devout) return "devout";
    return "full";
  }
  function evidenceWeight(event) {
    return event?.kind === "mythicReveal" || ["dreamSpace", "fieldOpen", "bossAppear", "dragonAppear", "handShown"].includes(event?.kind) ? 2 : 1;
  }

  function isSupernaturalEvent(event) {
    if (!event) return false;
    if (event.kind === "sermon") return true;   // contagious ideas: faith spread by talk (engine/conditions.js spreadIdea)
    if (event.kind === "dreamSpace") return /opens? a Dream Space/i.test(event.text || "");
    if (event.kind === "wildAppear") return /belief calls|summon|dream space|mythic|dragon/i.test(`${event.text || ""} ${event.monster || ""}`);
    if (SUPERNATURAL.has(event.kind)) return true;
    const emergence = /appear|spawn|reveal|transform|summon|open/i.test(event.kind || "");
    const identity = `${event.name || ""} ${event.monster || ""} ${event.boss || ""} ${event.text || ""}`;
    return emergence && MYTHIC_NAMES.test(identity);
  }
  function isMythicEntity(entity) {
    return MYTHIC_NAMES.test(`${entity?.boss || ""} ${entity?.character || ""} ${entity?.name || ""}`);
  }

  function isSkeptic(actor) {
    const traits = actor?.traits || actor?.selfTraits || [];
    return !actor?.convertedByExperience && (actor?.character === "scientist"
      || traits.some(t => (typeof t === "string" ? t : t?.id) === "nonBeliever"));
  }
  // Neither a believer of any strength nor a skeptic: a sermon (event.heard) can move them too (contagious ideas, faith).
  function isNeutral(actor) {
    const traits = (actor?.traits || actor?.selfTraits || []).map(t => typeof t === "string" ? t : t?.id);
    return !actor?.convertedByExperience && actor?.character !== "scientist"
      && !traits.some(id => ["nonBeliever", "believer", "devoutBeliever", "fullBeliever", "convertedDevout", "convertedBeliever"].includes(id));
  }
  function evidenceKey(event) {
    if (event.kind === "cardPlay" || event.kind === "handShown") return `${event.round ?? "?"}:${event.kind}`;   // one point per witness per round, whoever plays (CARDS.md 18.3)
    return event.evidenceId || event.id || `${event.kind}:${event.round ?? "?"}:${event.actor || ""}:${event.target || event.monster || ""}`;
  }
  function witness(actor, event, { seed = 0, spiritOdds = 0 } = {}) {
    // A neutral is moved by a sermon (event.heard), and once one has landed (points > 0) by what they witness after it.
    if (!(isSkeptic(actor) || ((event?.heard || (actor?.beliefEvidencePoints || 0) > 0) && isNeutral(actor))) || !isSupernaturalEvent(event)) return { actor, converted: false, progress: actor?.beliefEvidencePoints || 0 };
    const witnesses = event.witnesses || event.visibleTo;
    if (event.visible === false || (Array.isArray(witnesses) && !witnesses.includes(actor.id)))
      return { actor, converted: false, progress: actor.beliefEvidencePoints || 0 };
    const key = evidenceKey(event), evidence = actor.beliefEvidence || [];
    if (evidence.includes(key)) return { actor, converted: false, progress: actor.beliefEvidencePoints || 0 };
    const nextEvidence = [...evidence, key];
    const points = (actor.beliefEvidencePoints || 0) + evidenceWeight(event);
    const nextThreshold = WITNESSES_REQUIRED * ((actor.beliefAttempts || 0) + 1);
    if (points < nextThreshold) {
      const next = { ...actor, beliefEvidence: nextEvidence, beliefEvidencePoints: points };
      return { actor: next, converted: false, progress: points, text: `${actor.name || "The skeptic"} has seen something they cannot readily explain.` };
    }
    const outcome = outcomeFor(actor, seed);
    if (outcome === "rationalize") {
      const traits = (actor.traits || actor.selfTraits || []).map(t => typeof t === "string" ? t : t?.id).filter(Boolean);
      if (!traits.includes("unexplainedEvent")) traits.push("unexplainedEvent");
      const next = { ...actor, traits, selfTraits: traits, beliefEvidence: nextEvidence, beliefEvidencePoints: points,
        beliefAttempts: (actor.beliefAttempts || 0) + 1 };
      return { actor: next, converted: false, rationalized: true, progress: points, outcome,
        text: `${actor.name || "The skeptic"} decides the evidence must be a trick or an unfamiliar science. They remain skeptical, but the explanation no longer feels certain.` };
    }
    const strength = outcome === "full" ? 3 : 2;
    const traitId = outcome === "full" ? "convertedBeliever" : "convertedDevout";
    const traits = (actor.traits || actor.selfTraits || []).map(t => typeof t === "string" ? t : t?.id).filter(Boolean)
      .filter(id => !["nonBeliever", "believer", "devoutBeliever", "fullBeliever", "unexplainedEvent"].includes(id));
    traits.push(traitId);
    // A full conversion re-rolls astral presence silently (Mala, 2026-10-24): no text, no deck card —
    // it is seen only on the astral plane, and only if it triggers. Odds ride the call (engine.js).
    if (outcome === "full" && !traits.includes("astralPresence") && spiritOdds > 0
      && seededRoll(seed, `${actor?.id || "skeptic"}:astral-presence`) < spiritOdds) traits.push("astralPresence");
    const passives = { ...(actor.passives || {}) };
    delete passives.summonDamageDealtMul;
    delete passives.summonDamageTakenMul;
    passives.rareMonsterSummon = true;
    passives.beliefStrength = strength;
    passives.abilityDamageMul = Math.min(1.2, (passives.abilityDamageMul || 1) * (strength === 3 ? 1.12 : 1.08));
    passives.ultimateChargeMul = Math.min(1.3, (passives.ultimateChargeMul || 1) * (strength === 3 ? 1.25 : 1.15));
    passives.uncontrolledDreamSummons = true;
    const next = { ...actor, traits, selfTraits: traits, convertedByExperience: true, beliefEvidence: nextEvidence,
      beliefEvidencePoints: points, beliefStrength: strength, convertedBelief: outcome, passives };
    return { actor: next, converted: true, progress: points, outcome, traitId, beliefStrength: strength,
      text: outcome === "full"
        ? `${actor.name || "The skeptic"} accepts the supernatural without reservation. Their power surges; creatures called from Dream Space may not obey.`
        : `${actor.name || "The skeptic"} accepts that something beyond known science is real, though questions remain. Their new belief lends power; creatures called from Dream Space may not obey.` };
  }
  function summonsAreUncontrolled(actor) { return !!(actor?.convertedByExperience || actor?.passives?.uncontrolledDreamSummons); }
  return { SUPERNATURAL: [...SUPERNATURAL], WITNESSES_REQUIRED, OUTCOME_WEIGHTS, outcomeFor, evidenceWeight,
    isSupernaturalEvent, isMythicEntity, isSkeptic, isNeutral, witness, summonsAreUncontrolled };
});
