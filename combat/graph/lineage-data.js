"use strict";
// Homology lineage records (Mala, 2026-10-31; spec claude-homology-spec, slice H1). A lineage record says, for ONE character of a
// technique, what it is (feature_key), where it comes from (ancestral_origin_id) and which inherited, observable structure can
// still be exploited (conserved_cue_id). verifyLineage compares two records: pure, no state, no engine. Lands dark: the concept is
// staged with no holder, so nothing in a battle reads this yet (H2 stamps the observation window, H3 casts the comparison).
//
// It is data on a technique, not a system of its own (Mala, 2026-11-01: grammar, not silo): the registries and the records live beside
// the graph data, and the comparison is one pure function; the staged abilities that read it name their payloads in the kit.
// The biology below is a first proposal for Mala to correct (HOMOLOGY-BUILDABLE.md section 7). Ancestral origins are immutable:
// every record is frozen and nothing writes one at run time (tests/homology.test.mjs scans for it).
//
//   verifyLineage(a, b)              -> "CONSERVED" | "DIVERGENT" | "ANALOGOUS" | null (null: not comparable, the feature_keys differ)
//   comparable(a, b)                 -> { ok: true } | { ok: false, reason }
//   recordsOf(abilityId)             -> the frozen records of a technique ([] when it has none)
//   compareTechniques(idA, idB, key) -> { feature_key, result } | { refused: reason }
//   observedWithin(s, observer, user, ability)  -> { ok: true, rounds } | { ok: false, reason }   the observation window (H2)
//   markIndexed(s, observer, user, ability)     -> true when a stamped observation was flagged as held in an Indexing record
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatLineage = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const OUTCOMES = Object.freeze({ CONSERVED: "CONSERVED", DIVERGENT: "DIVERGENT", ANALOGOUS: "ANALOGOUS" });

  // What is being compared: the character, not the organism.
  const features = Object.freeze({
    forelimb_scaffold: "The bone and joint plan of a forelimb: what holds the arm, wing or claw together.",
    flight_surface: "The surface a flier pushes against the air with.",
  });
  // Where one particular character comes from (not the oldest ancestor the organisms share).
  const origins = Object.freeze({
    tetrapod_forelimb: "The forelimb of a four-limbed vertebrate: one upper bone, two lower bones, a hand.",
    feathered_forelimb_wing: "A forelimb wing that carries a row of flight feathers.",
    engineered_airfoil: "A flight surface designed and built, not inherited.",
  });
  // The inherited, observable structure a counter can still exploit.
  const cues = Object.freeze({
    radius_ulna_lever: "The two lower bones of the forelimb working as a lever.",
    primary_feather_row: "The row of long feathers at the wing tip.",
    rigid_flapping_spar: "The stiff spar a built wing flaps on.",
    rotor_blade: "A spinning blade that lifts and pushes.",
  });

  const rec = (feature_key, ancestral_origin_id, conserved_cue_id) => Object.freeze({ feature_key, ancestral_origin_id, conserved_cue_id });
  // keenSight (Jatayu) has no record: it is not a body structure, so it is not eligible.
  const records = Object.freeze({
    shieldOfWings: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),
    talons: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),
    vengefulRake: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),
    takeWing: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", null)]),   // a dragon's wing membrane: the lever cue is gone
    talonDive: Object.freeze([rec("flight_surface", "feathered_forelimb_wing", "primary_feather_row")]),
    swoop: Object.freeze([rec("flight_surface", "engineered_airfoil", "rigid_flapping_spar")]),
    droneSwarm: Object.freeze([rec("flight_surface", "engineered_airfoil", "rotor_blade")]),
  });
  const ineligible = Object.freeze({ keenSight: "not a body structure" });

  const comparable = (a, b) => {
    if (!a || !b || !a.feature_key || !b.feature_key) return { ok: false, reason: "a technique has no lineage record for this feature" };
    if (a.feature_key !== b.feature_key) return { ok: false, reason: `not comparable: ${a.feature_key} and ${b.feature_key} are different features` };
    return { ok: true };
  };
  // Exactly three outcomes. Same origin and the same non-null cue: CONSERVED. Same origin, a different or missing cue: DIVERGENT.
  // Different origins, however alike they look or work: ANALOGOUS.
  const verifyLineage = (a, b) => {
    if (!comparable(a, b).ok) return null;
    if (a.ancestral_origin_id !== b.ancestral_origin_id) return OUTCOMES.ANALOGOUS;
    return a.conserved_cue_id && a.conserved_cue_id === b.conserved_cue_id ? OUTCOMES.CONSERVED : OUTCOMES.DIVERGENT;
  };
  const recordsOf = (abilityId) => records[abilityId] || [];
  const compareTechniques = (idA, idB, featureKey) => {
    const a = recordsOf(idA).find((r) => r.feature_key === featureKey), b = recordsOf(idB).find((r) => r.feature_key === featureKey);
    const c = comparable(a, b);
    return c.ok ? { feature_key: featureKey, result: verifyLineage(a, b) } : { refused: c.reason };
  };

  // The observation window (Mala's limits: "a technique must have been used within the current or previous two combat rounds and
  // witnessed by the caster"; three with an Indexing record). The stamp is written at the one place a witness sees a cast
  // (engine/actions.js): s.observedAt[observer][user][ability] = { round, indexed? }, refreshed on every use. s.observedAbilities, the
  // once-per-id array other systems read, is not touched. An Indexing record is that `indexed` flag: nothing sets it yet (H6 wires the
  // Archivist's Index moves to markIndexed), so today every window is two rounds.
  const WINDOW = Object.freeze({ rounds: 2, indexedRounds: 3 });
  const stampOf = (s, observer, user, ability) => s && s.observedAt && s.observedAt[observer] && s.observedAt[observer][user] && s.observedAt[observer][user][ability] || null;
  const observedWithin = (s, observer, user, ability) => {
    const st = stampOf(s, observer, user, ability);
    if (!st) return { ok: false, reason: "that technique was not witnessed by the caster" };
    const rounds = st.indexed ? WINDOW.indexedRounds : WINDOW.rounds;
    return s.round - st.round <= rounds ? { ok: true, rounds } : { ok: false, reason: `that technique was used ${s.round - st.round} rounds ago; the window is ${rounds}${st.indexed ? "" : " (three with an Indexing record)"}` };
  };
  const markIndexed = (s, observer, user, ability) => { const st = stampOf(s, observer, user, ability); if (!st) return false; st.indexed = true; return true; };

  // The teaching encounters (H7; the spec's "Aviary", Decision 5: guarantee one conserved pair and one plausible analogy). Two rooms, not one: Jatayu (the Ayodhya crew) and
  // Surpanakha (Lanka) are an always-at-war pair (`rules.factions.feuds`), so the engine refuses to put them on one side. Each room is a battle the engine plays on its own with
  // the foes limited to the technique the lesson needs (`aiAbilities`); a Homology player who stands in sight sees the pair arrive. `setup` is data the room applies to a fighter's
  // status before round 1 (the Ornithopter starts with perch marks, because its Swoop is only worth casting from them). Staged: nothing offers these rooms to a player until a holder exists.
  const encounters = Object.freeze({
    talonHall: Object.freeze({ name: "The Talon Hall", result: "CONSERVED", feature: "forelimb_scaffold",
      lesson: "Two fighters strike with the same inherited forelimb lever: a verified shared cue, so a counter for one is a counter for the other.",
      foes: Object.freeze([{ id: "hall-1", character: "surpanakha", at: [9, 3], aiAbilities: ["talons"] }, { id: "hall-2", character: "surpanakha", at: [9, 5], aiAbilities: ["vengefulRake"] }]),
      pair: Object.freeze([{ user: "hall-1", ability: "talons" }, { user: "hall-2", ability: "vengefulRake" }]) }),
    aviary: Object.freeze({ name: "The Aviary", result: "ANALOGOUS", feature: "flight_surface",
      lesson: "A feathered wing and a built wing both fly, but they do not share an origin: resemblance is not descent, and no counter transfers.",
      foes: Object.freeze([{ id: "aviary-jatayu", character: "jatayu", at: [9, 3], aiAbilities: ["talonDive"] }, { id: "aviary-orn", character: "ornithopter", at: [9, 5], aiAbilities: ["swoop"], setup: { perch: { tiles: [[9, 5], [8, 5]] } } }]),
      pair: Object.freeze([{ user: "aviary-jatayu", ability: "talonDive" }, { user: "aviary-orn", ability: "swoop" }]) }),
  });

  return Object.freeze({ OUTCOMES, WINDOW, encounters, observedWithin, markIndexed, features, origins, cues, records, ineligible, comparable, verifyLineage, recordsOf, compareTechniques });
});
