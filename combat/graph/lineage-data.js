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
    hindlimb_scaffold: "The bone and joint plan of a hindlimb: what holds the leg and foot together for a leap or a push.",
    biting_jaw: "The paired parts a mouth closes on food or on a foe.",
    sound_production: "The structure an animal makes a loud call or a drone with.",
    visual_organ: "The organ an animal sees with.",
    skin_outgrowth: "A hair, scale or feather that grows out of the skin.",
    plant_defense: "A sharp structure on a plant that keeps browsers and climbers off.",
    holding_structure: "A plant part that anchors, grips or climbs.",
    dispersal_fruit: "The ripened part that carries a plant's seeds away.",
    electric_discharge: "The tissue an animal shocks with.",
    respiratory_airway: "The airway a breathing animal moves air through.",
  });
  // Where one particular character comes from (not the oldest ancestor the organisms share).
  const origins = Object.freeze({
    tetrapod_forelimb: "The forelimb of a four-limbed vertebrate: one upper bone, two lower bones, a hand.",
    feathered_forelimb_wing: "A forelimb wing that carries a row of flight feathers.",
    engineered_airfoil: "A flight surface designed and built, not inherited.",
    tetrapod_hindlimb: "The hindlimb of a four-limbed vertebrate: thigh bone, two shin bones, a foot.",
    arthropod_jointed_leg: "A leg of an arthropod: a chain of hard tubes joined by hinges, worked by muscle inside the tube.",
    gnathostome_jaw: "The hinged jaw of a jawed vertebrate, grown from a gill arch.",
    arthropod_mandible: "The paired chewing blade of an arthropod, a modified limb.",
    tetrapod_larynx: "The voice box of a land vertebrate, a ring of cartilages at the top of the windpipe.",
    arthropod_cuticle_wing: "An insect wing: a thin sheet of cuticle stretched on a frame of veins.",
    vertebrate_camera_eye: "The single-lens eye of a vertebrate, with a retina behind the lens.",
    mammalian_hair: "A hair grown from a follicle in mammal skin.",
    axillary_shoot: "A branch that grows from the bud at a leaf joint; a thorn is one that has hardened to a point.",
    epidermal_outgrowth: "A sharp outgrowth of a plant's outer skin alone; a prickle, with no branch inside it.",
    root_organ: "A root: the part of a plant that anchors it and takes up water, whether it grows down from the seed or out of a branch.",
    ripened_inflorescence: "A whole cluster of flowers that ripens together into one fruit.",
    ripened_single_ovary: "The ovary of a single flower, ripened around its seed.",
    electric_muscle_tissue: "Muscle that has lost its power to contract and become a stack of cells that makes voltage.",
    tetrapod_lung_airway: "The windpipe and lungs of a land vertebrate.",
  });
  // The inherited, observable structure a counter can still exploit.
  const cues = Object.freeze({
    radius_ulna_lever: "The two lower bones of the forelimb working as a lever.",
    primary_feather_row: "The row of long feathers at the wing tip.",
    rigid_flapping_spar: "The stiff spar a built wing flaps on.",
    rotor_blade: "A spinning blade that lifts and pushes.",
    femur_tibia_lever: "The thigh bone and shin bone working as a lever that straightens the leg.",
    jointed_leg_lever: "The hinged leg tubes working as a lever, pulled by muscle inside the tube.",
    hinged_lower_jaw: "The lower jaw hinged to the skull so the mouth snaps shut.",
    paired_chewing_blades: "Two blades that close sideways against each other.",
    laryngeal_cartilages: "The ring of cartilages and the folds they hold that vibrate to make sound.",
    chitin_vein_frame: "The frame of veins that holds an insect wing taut.",
    lens_and_retina: "A lens that focuses light on a retina.",
    keratin_shaft: "A shaft of keratin growing from a follicle.",
    vascular_stem_core: "The woody core of a thorn, joined to the branch it grew from.",
    outgrowth_without_core: "A sharp point with no woody core: it snaps off clean at the skin.",
    root_cap_and_stele: "The root cap at the tip and the central cylinder of water and food pipes.",
    fleshy_fused_cluster: "Many small fruits fused into one fleshy body.",
    stony_endocarp: "The stone-hard inner wall around a single seed.",
    electrocyte_stack: "Flat cells stacked like a battery.",
    tracheal_cartilage_rings: "The stiffening rings that hold the windpipe open.",
  });

  const rec = (feature_key, ancestral_origin_id, conserved_cue_id) => Object.freeze({ feature_key, ancestral_origin_id, conserved_cue_id });
  const records = Object.freeze({
    shieldOfWings: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),
    talons: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),
    vengefulRake: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),
    takeWing: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", null)]),   // a dragon's wing membrane: the lever cue is gone
    talonDive: Object.freeze([rec("flight_surface", "feathered_forelimb_wing", "primary_feather_row")]),
    swoop: Object.freeze([rec("flight_surface", "engineered_airfoil", "rigid_flapping_spar")]),
    droneSwarm: Object.freeze([rec("flight_surface", "engineered_airfoil", "rotor_blade")]),
    // Thirty-three more (Mala, 2026-11-04: "plant homologies and vertebrate, mix it up", forty techniques for now; claude-homology-l1-build). A first proposal for Mala to correct.
    // The forelimb scaffold carries the human hand too: a grasp and a hold are the same lever as a talon.
    seize: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),
    clinch: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),
    jointControl: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),
    submissionHold: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),
    takedown: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),   // a tackle: the arms wrap and drive (judgement call, see NOTE)
    pickpocket: Object.freeze([rec("forelimb_scaffold", "tetrapod_forelimb", "radius_ulna_lever")]),   // "the run hides the hand": the hand again (judgement call, see NOTE)
    // A leap: a cat's hindlimb and a person's share the lever; the chitin knight's jointed leg leaps as well and shares none of it.
    pounceFromStillness: Object.freeze([rec("hindlimb_scaffold", "tetrapod_hindlimb", "femur_tibia_lever")]),
    mon_pounce: Object.freeze([rec("hindlimb_scaffold", "tetrapod_hindlimb", "femur_tibia_lever")]),
    leapingStrike: Object.freeze([rec("hindlimb_scaffold", "arthropod_jointed_leg", "jointed_leg_lever")]),
    mon_infectiousBite: Object.freeze([rec("biting_jaw", "gnathostome_jaw", "hinged_lower_jaw")]),
    mon_broodBite: Object.freeze([rec("biting_jaw", "arthropod_mandible", "paired_chewing_blades")]),
    // A voice: a dragon's roar, a wail and a sung line come from one voice box; an insect's drone comes from its wing.
    infernoRoar: Object.freeze([rec("sound_production", "tetrapod_larynx", "laryngeal_cartilages")]),
    mon_chillingWail: Object.freeze([rec("sound_production", "tetrapod_larynx", "laryngeal_cartilages")]),
    lullaby: Object.freeze([rec("sound_production", "tetrapod_larynx", "laryngeal_cartilages")]),
    enchantingAir: Object.freeze([rec("sound_production", "tetrapod_larynx", "laryngeal_cartilages")]),
    chitinDrone: Object.freeze([rec("sound_production", "arthropod_cuticle_wing", "chitin_vein_frame"), rec("flight_surface", "arthropod_cuticle_wing", "chitin_vein_frame")]),
    perch: Object.freeze([rec("flight_surface", "engineered_airfoil", "rigid_flapping_spar")]),
    takeOff: Object.freeze([rec("flight_surface", "engineered_airfoil", "rigid_flapping_spar")]),
    overflight: Object.freeze([rec("flight_surface", "engineered_airfoil", "rigid_flapping_spar")]),
    glare: Object.freeze([rec("visual_organ", "vertebrate_camera_eye", "lens_and_retina")]),
    fixInPlace: Object.freeze([rec("visual_organ", "vertebrate_camera_eye", "lens_and_retina")]),
    keenSight: Object.freeze([rec("visual_organ", "vertebrate_camera_eye", "lens_and_retina")]),   // a vulture's eyes (its own text): eligible once the other eyes are, one rule for sight (departs from H1/BUILDABLE section 7; Decision for Mala)
    hairClone: Object.freeze([rec("skin_outgrowth", "mammalian_hair", "keratin_shaft")]),
    spareHair: Object.freeze([rec("skin_outgrowth", "mammalian_hair", "keratin_shaft")]),
    // Plants. A bramble's prickle is only skin; a hawthorn's thorn is a hardened branch. Same job, different origin.
    lash: Object.freeze([rec("plant_defense", "epidermal_outgrowth", "outgrowth_without_core")]),
    brierRing: Object.freeze([rec("plant_defense", "axillary_shoot", "vascular_stem_core")]),
    overgrowth: Object.freeze([rec("plant_defense", "axillary_shoot", "vascular_stem_core")]),
    // A prop root hanging from a banyan branch and a bristlecone's root are both roots; a tendril is not.
    banyanSnare: Object.freeze([rec("holding_structure", "root_organ", "root_cap_and_stele")]),
    millenniumGrip: Object.freeze([rec("holding_structure", "root_organ", "root_cap_and_stele")]),
    // A breadfruit is a whole cluster of flowers ripened into one body; a kukui nut is one flower's ovary.
    uluHurl: Object.freeze([rec("dispersal_fruit", "ripened_inflorescence", "fleshy_fused_cluster")]),
    kukuiTorchNuts: Object.freeze([rec("dispersal_fruit", "ripened_single_ovary", "stony_endocarp")]),
    mon_galvanicSlam: Object.freeze([rec("electric_discharge", "electric_muscle_tissue", "electrocyte_stack")]),
    emberBreath: Object.freeze([rec("respiratory_airway", "tetrapod_lung_airway", "tracheal_cartilage_rings")]),
  });
  const ineligible = Object.freeze({
    petrify: "a held target turns to stone: the effect, not the eye that held it",
    layOnHands: "draws on a store of mercy: no structure is exploited",
    mon_bindingWraps: "a rooting rider: the part that wraps is not in the data",
    soaringStrike: "a spell of flight: no wing or body part carries it",
    shortFlight: "a spell of flight: no wing or body part carries it",
    root: "a stance (the soul sets like a stone), not the plant organ",
    scent: "worn through a borrowed shape: the effect, not the nose",
    voidGlance: "an empty face has no eye to compare",
    timedBloom: "a buried cache on a fuse, not a flower",
    broodBreach: "a swarm moving down a line: a crowd, not one body structure",
  });

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
    thornGarden: Object.freeze({ name: "The Thorn Garden", result: "ANALOGOUS", feature: "plant_defense",
      lesson: "A bramble's prickle and a hawthorn's thorn both pierce, but one is only skin and the other a hardened branch: a counter for one does not transfer to the other.",
      foes: Object.freeze([{ id: "garden-1", character: "moonflower", at: [9, 3], aiAbilities: ["lash"] }, { id: "garden-2", character: "moonflower", at: [9, 5], aiAbilities: ["brierRing"] }]),
      pair: Object.freeze([{ user: "garden-1", ability: "lash" }, { user: "garden-2", ability: "brierRing" }]) }),
  });

  return Object.freeze({ OUTCOMES, WINDOW, encounters, observedWithin, markIndexed, features, origins, cues, records, ineligible, comparable, verifyLineage, recordsOf, compareTechniques });
});
