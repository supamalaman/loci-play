"use strict";
// Class runtime: makes the 15 original classes play. The engine calls these hooks (marked "ClassRuntime" in engine.js);
// everything here is about the new abilities, so existing characters are untouched.
//
// A class ability is available to whoever equips that class's exact primary + secondary pair (pairs are unique per
// class, guarded by tests/registry.test.mjs). Damaging abilities ride the engine's own "damage" path; their extras and
// all non-damage effects ("classEffect") live here. State: actor.status.<key> and s.cls.
//
//   wire                                   → content overrides per ability (effect, target, range, area, potency…)
//   pairsFor(abilityId)                    → [[primary, secondary], …] that unlock it
//   available(a, def)                      → bool (abilitiesOf filter)
//   beforeAbility(s, a, m, H) / beforeMove(s, a, H)   → error string or null (vows, laws, silence, dependence)
//   target(s, a, m, tx, ty, H)             → { ok, tiles, targets } for classEffect abilities (null = not ours)
//   resolve(s, a, inst, H)                 → true if handled (classEffect)
//   redirect(s, src, tgt, inst, H)         → the unit that actually takes the hit (intercepts, departures)
//   damageMods(s, src, tgt, inst, damageType, H) → { mult, notes }
//   afterHit(s, src, tgt, inst, dealt, H)  → stored energy, throws, silences, growth triggers
//   resistKnock(s, a, t, H)                → true if the displacement is cancelled
//   turnStart(s, a, H)                     → upkeep, expiry, strain, visited tiles
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./class-builds.js"),require("./esker.js"),require("../performers/performers.js"),require("../stealth/stealth.js"),require("../police/police.js"),require("../monkey/monkey.js"),require("../director/director.js"),require("../actor/actor.js"),require("../law/law.js"),require("../martial/martial.js"),require("./hot-pot.js"),require("../teleology/teleology.js"),require("../mise/mise.js"),require("../graph/homology-rules.js"),require("./posterity-suits.js"),require("../guests/guests.js"));
  else root.ConceptCombatClassRuntime = factory(root.ConceptCombatClassBuilds,root.ConceptCombatEsker,root.ConceptCombatPerformers,root.ConceptCombatStealth,root.ConceptCombatPolice,root.ConceptCombatMonkey,root.ConceptCombatDirector,root.ConceptCombatActor,root.ConceptCombatLaw,root.ConceptCombatMartial,root.ConceptCombatHotPot,root.ConceptCombatTeleology,root.ConceptCombatMise,root.ConceptCombatHomologyRules,root.ConceptCombatPosteritySuits,root.ConceptCombatGuests);
})(typeof self !== "undefined" ? self : this, function (CBmod, Esker, Performers, Stealth, Police, Monkey, Director, Actor, Law, Martial, HotPot, Teleology, Mise, Homology, Suits, Guests) {
  const CB = CBmod.builds;
  const CLASS_PAIRS = { agent_swarm: ["hardware", "cybernetic_ecology"], rapper:["lyricism","collage"], musician:["harmony","resonance"], bard:["harmony","complementarity"], jazz_musician:["lyricism","harmony"], knight: ["barrier", "interposition"], pharaoh: ["legitimacy", "boundary"], daedalus: ["berm", "section"], samurai: ["timing", "sightline"],
    gemini: ["complementarity", "resonance"], wizard: ["pipeline", "selectivity"], jujutsu_sorcerer: ["reciprocal_obligation", "boundary"], super_hero: ["load_distribution", "interposition"], esker: ["interposition", "berm"],
    super_heroine: ["tension", "elasticity"], super_villain: ["dependency", "deception"], defective_machine: ["fault_tolerance", "resonance"], teleporter: ["adjacency", "threshold"],
    mutant_boar: ["plasticity", "inertia"], boarman: ["leverage", "elasticity"], anime_protagonist: ["plasticity", "elasticity"], barbarian: ["threshold", "elasticity"], clockwork: ["pipeline", "timing"], rogue: ["pruning", "extraction"], hooded_cyber_rogue: ["longtermism", "stealth"], medusa: ["sightline", "constraint"], magistrate: ["laws_of_gods_of_men", "threshold"], cleric: ["reciprocal_obligation", "complementarity"], steam_walker: ["inertia", "threshold"], ornithopter: ["section", "adjacency"], engineer: ["gradingDrainage", "load_distribution"], origamist: ["adjacency", "tension"],
    mma_fighter: ["leverage", "constraint"], kickboxer: ["timing", "leverage"], odysseus: ["strategic_commitment", "pathway"], president: ["legitimacy", "strategic_commitment"], detective: ["inference", "selectivity"], maid: ["selectivity", "extraction"], paladin: ["solfeggio", "strategic_commitment"],
    big_game_hunter: ["discovery", "indexing"], hypebeast: ["diffusion", "deception"], ranger: ["pathway", "inference"], tech_billionaire: ["adjacency", "dependency"], oil_billionaire: ["extraction", "diffusion"], doctor: ["succession", "inference"], animalTamer: ["resonance", "transmigration"], modern_artist: ["hardware", "software"], cyph: ["lyricism", "selectivity"], general: ["delegation", "timing"], bastet: ["focus", "elasticity"], ninja: ["stealth", "threshold"], police_officer: ["legitimacy", "constraint"], thief: ["stealth", "deception"], monkey_king: ["deception", "leverage"], hanuman: ["aeronautics", "elasticity"], jambavan: ["indexing", "delegation"], rama: ["strategic_commitment", "focus"], lakshmana: ["boundary", "interposition"], sita: ["imagination", "preservation"], hypnotist: ["focus", "imagination"], ravana: ["extraction", "delegation"], kumbhakarna: ["inertia", "timing"], indrajit: ["deception", "constraint"], mandodari: ["inference", "harmony"], surpanakha: ["glamour", "plasticity"], jatayu: ["interposition", "timing"], director: ["boundary", "delegation"], mangaka: ["collage", "innovation"], aviator_hero: ["aeronautics", "inertia"], jiang_qing: ["glamour", "legitimacy"], starfarer: ["settlement", "sightline"], pioneer: ["sightline", "boundary"], martial_artist: ["bird_mountain", "adaptation"], memorialist: ["preservation", "longtermism"], hot_pot_berserker: ["antifragility", "hospitality"], chef: ["mise_en_place", "hospitality"], seedkeeper: ["longtermism", "succession"], ferryman: ["pathway", "reciprocal_obligation"], pearl_diver: ["swale", "stealth"], teal_eel: ["boundary", "preservation"], remora_adventurer: ["leverage", "extraction"], orgonite_trooper: ["longtermism", "hardware"], leviathan_suit: ["longtermism", "cybernetic_ecology"], scale_firmware: ["imagination", "hardware"], white_jacket_gunner: ["software", "longtermism"], bronze_admin: ["delegation", "longtermism"], horned_suit: ["imagination", "delegation"], shaman: ["threshold", "hospitality"] };

  // Content overrides. kind = runtime handler for "classEffect"; extra = damage-path extras keyed by ability id.
  const D = (o) => ({ effect: "damage", ...o }), X = (kind, o = {}) => ({ effect: "classEffect", kind, ...o });
  const wire = {
    ...Object.fromEntries([...Performers.IDS].map(id=>[id,X("performance",{target:["lullaby","enchantingAir","dissTrack"].includes(id)?"enemy":id==="riff"?"ally":"self",range:["lullaby","enchantingAir"].includes(id)?4:id==="dissTrack"?5:id==="riff"?4:0})])),
    vanish: X("stealth", {target:"self",range:0}),
    smokeVeil: X("stealth", {target:"tile",range:4}),
    decoy: X("stealth", {target:"self",range:0}),
    wait: X("stealth", {target:"enemy",range:8}),
    recoveryStrike: X("stealth", {target:"enemy",range:5}),
    genjutsu: X("stealth", {target:"enemy",range:6}),
    vanishingCut: X("stealth", {target:"enemy",range:7}),
    blackout: X("stealth", {target:"tile",range:5}),
    halt: X("police", {target:"enemy",range:5}),
    cuff: X("police", {target:"enemy",range:2}),
    evidence: X("police", {target:"enemy",range:2}),
    takedown: X("police", {target:"tile",range:3}),
    arrest: X("police", {target:"enemy",range:2}),
    pickpocket: X("stealth", {target:"tile",range:5}),
    skim: X("stealth", {target:"enemy",range:1}),
    emptyPockets: X("stealth", {target:"self",range:0}),
    perfectHeist: X("stealth", {target:"enemy",range:99}),
    spiritRaven: X("guest", {target:"tile",range:3}),
    ancestralFox: X("guest", {target:"tile",range:3}),
    spiritTotem: X("guest", {target:"tile",range:3}),
    guestPortion: X("guest", {target:"ally",range:4}),
    hairClone: X("monkey", {target:"tile",range:3}),
    monkeyMischief: X("monkey", {target:"self",range:0}),
    somersaultCloud: X("monkey", {target:"tile",range:6}),
    jinguBang: X("monkey", {target:"enemy",range:3}),
    // Hanuman (docs/hanuman-build.md): the mace, and the mountain he carried for Lakshmana.
    gada: D({ target: "enemy", delivery: "contact", range: 1 }),
    sanjeevani: X("carryMountain", { target: "ally", range: 99, radius: 2, healFrac: 0.4, reviveFrac: 0.4 }),
    // Jambavan (docs/jambavan-build.md): he names what an ally is; his council reads every foe aloud (the Archivist's reveal, plus charge).
    rememberWhatYouAre: X("rememberAlly", { target: "ally", range: 6, charge: 40, forgottenCharge: 60, tempoCost: 0, actionCost: 0 }),   // a word, not a turn (level 2, 2026-10-24: as a 35 AP act it cost his side 31 win points)
    // Rama (docs/rama-build.md): his bow, and the Brahmastra that lands true only on a weakness his side has learned.
    kodanda: D({ target: "enemy", delivery: "line", range: 6, damageType: "albedo" }),
    brahmastra: X("brahmastra", { target: "enemy", range: 8, known: 24, unknown: 12, damageType: "albedo", thematic: { ravana: { unknown: 24 } } }),   // rule 6: against Ravana it always lands true (Vibhishana's secret)
    counselOfAges: { effect: "archivistArchive", target: "self", range: 0, area: { shape: "radius", radius: 4 }, allyCharge: 25 },
    staffSky: X("monkey", {target:"tile",range:7}),
    merge: X("monkey", {target:"enemy",range:99}),
    spareHair: X("monkey", {target:"tile",range:3}),
    lonelyWave: X("martial", {target:"enemy",range:5}),
    chargeWave: X("martial", {target:"self",range:0}),
    ulaula: X("martial", {target:"self",range:0}),
    imuFeast: X("martial", {target:"enemy",range:6}),
    hurlFeast: X("martial", {target:"enemy",range:6}),
    vowOpenHand: X("martial", {target:"self",range:0}),
    vowNeverQuench: X("martial", {target:"self",range:0}),
    vowSharedBowl: X("martial", {target:"self",range:0}),
    beyondLimits: X("martial", {target:"enemy",range:6}),
    // Mise en Place (Mala, 2026-10-28; web/combat/mise/mise.js). Held by the Chef (chef: [mise_en_place, hospitality]); whoever equips the concept still gets these (pairsFor leaves rackAndLabel and parallelPrep unpaired).
    rackAndLabel: X("miseStation", {target:"tile",range:2}),
    parallelPrep: X("miseStation", {target:"tile",range:3}),
    everythingInItsPlace: X("miseStation", {target:"tile",range:3}),
    // Homology (Mala, 2026-11-04: given to the Field Botanist; web/combat/graph/homology-rules.js). The same entries homology-rules.js `playable()` writes, now static so content.js promotes the abilities.
    comparativeAnatomy: X("homologyCompare", {target:"enemy",range:5}),
    comparativeAnatomyFidelity: X("homologyCompare", {target:"enemy",range:3}),
    conservedJoint: X("homologyJoint", {target:"enemy",range:6}),
    conservedJointSkeleton: X("homologyJoint", {target:"enemy",range:4}),
    ancestralReconstruction: X("homologyReconstruct", {target:"enemy",range:6}),
    // Teleology + Retrocausality (muse, 2026-10-26, orbit prototype; web/combat/teleology/teleology.js).
    designateDestiny: X("teleDestiny", {target:"tile",range:1}),
    borrowedBlow: X("teleBorrow", {target:"enemy",range:4}),
    novaGuarantee: X("teleNova", {target:"enemy",range:6}),
    whatWasOwed: X("retroOwed", {target:"self",range:0}),
    echoReturn: X("retroEcho", {target:"self",range:0}),
    causalSnapback: X("retroSnap", {target:"self",range:0}),
    novikovGuarantee: X("novikov", {target:"self",range:0}),
    // Affordance + Resilience (muse, 2026-10-29, Keystone AP proposal). Staged: kinds name the future handlers.
    offer: X("offer", {target:"tile",range:1}),
    specify: X("specify", {target:"tile",range:5}),
    theWorldAnswers: X("worldAnswers", {target:"tile",range:3}),
    buffer: X("absorb", {target:"self",range:0}),
    regimeShift: X("flip", {target:"self",range:0}),
    stillHere: X("clamp", {target:"self",range:0}),
    deployWorkstation: X("artistDeploy", {target:"tile",range:2}),
    calibrateTool: X("artistCalibrate", {target:"self",range:0}),
    rasterPass: X("artistRaster", {target:"enemy",range:5}),
    layerMask: X("artistMask", {target:"ally",range:3}),
    renderEngine: X("artistEngine", {target:"enemy",range:5}),
    batchRender: X("artistBatch", {target:"enemy",range:5}),
    compileTheCanvas: X("artistCompile", {target:"enemy",range:6}),
    orgoniteLance: X("suitLance", {target:"enemy",range:4}),
    dreamCircuit: X("suitCircuit", {target:"self",range:0}),
    dreamForge: X("suitForge", {target:"enemy",range:5}),
    posterityRaster: X("suitRaster", {target:"enemy",range:5}),
    farOrder: X("suitOrder", {target:"enemy",range:6}),
    summonedMandate: X("suitMandate", {target:"enemy",range:6}),
    setTheScene: X("directorFilm", {target:"enemy",range:5}),
    audition: X("actor", {target:"self",range:0}),
    genreDefiningPerformance: X("actor", {target:"self",range:0}),
    cyphOffTheTop: X("cyphBar", { target: "enemy", range: 6 }),
    cyphPocketVerse: X("cyphPocket", { target: "enemy", range: 6 }),
    cyphOpenMic: X("cyphFinal", { target: "enemy", range: 6 }),
    cyphCheckTheLabel: X("cyphService", { target: "ally", range: 3 }),
    cyphCuratedCypher: X("cyphCurated", { target: "enemy", range: 6 }),
    shieldFace: X("shieldFace", { target: "tile", range: 1 }), coveredAdvance: X("relocate", { target: "tile", range: 2, needs: "shieldFace" }),
    stepBetween: X("guard", { target: "ally", range: 1, uses: 1, mul: 1 }),
    // Lakshmana (docs/lakshmana-build.md): his brother's guard covers any adjacent ally once, Rama twice (rule 6: thematic power).
    // Sita (docs/sita-build.md): her faith calls her house to her side: a full character, not a summon (engine/hires.js kin).
    callOfFaith: X("callKin", { target: "self", range: 0 }),
    // Ravana (docs/ravana-build.md): the sword, the seizing hand (the Maid's remove kind), and the chariot (rule 6: Sita farther and longer).
    chandrahasa: D({ target: "enemy", delivery: "contact", range: 1, damageType: "nigredo" }),
    // Kumbhakarna (docs/kumbhakarna-build.md): the reach of his mace, the nap, and the hungry giant.
    giantsReach: D({ target: "enemy", delivery: "line", range: 2, damageType: "nigredo" }),
    // Indrajit (docs/indrajit-build.md): the serpent noose (a shot that binds, State Kit grant) and the Shakti (rule 6: Lakshmana).
    // Mandodari (docs/mandodari-build.md): Read the Omens is the Archivist's index reveal.
    readTheOmens: { effect: "archivistIndex", target: "enemy", range: 5 },
    // Surpanakha (docs/surpanakha-build.md): talons and the raking lunge.
    talons: D({ target: "enemy", delivery: "contact", range: 1, damageType: "rubedo" }),
    // Teal Eel (Boundary + Preservation) and Remora Adventurer (Leverage + Extraction). Gills live in engine/conditions.js.
    reefNip: D({ target: "enemy", delivery: "contact", range: 1, potency: 8, damageType: "rubedo" }),
    closeTheCoil: D({ target: "enemy", delivery: "line", range: 2, potency: 12, damageType: "rubedo" }),
    deadWeight: D({ target: "enemy", delivery: "contact", range: 1, potency: 7, damageType: "nigredo" }),
    lairWeight: D({ target: "enemy", delivery: "line", range: 3, potency: 11, damageType: "nigredo" }),
    theSpiral: D({ target: "enemy", delivery: "line", range: 4, potency: 16, damageType: "rubedo" }),
    tridentJab: D({ target: "enemy", delivery: "contact", range: 1, potency: 9, damageType: "albedo" }),
    pryLoose: D({ target: "enemy", delivery: "line", range: 2, potency: 12, damageType: "albedo" }),
    hitchBite: D({ target: "enemy", delivery: "contact", range: 1, potency: 8, damageType: "rubedo" }),
    stripAScale: D({ target: "enemy", delivery: "line", range: 3, potency: 11, damageType: "rubedo" }),
    theHost: D({ target: "enemy", delivery: "line", range: 4, potency: 16, damageType: "albedo" }),
    // Jatayu (docs/jatayu-build.md): wings over an ally (Sita: twice), keen sight, the dive, and the strike at the chariot.
    shieldOfWings: X("guard", { target: "ally", range: 1, uses: 1, mul: 1, turns: 1, thematic: { sita: { uses: 2, turns: 2 } } }),
    keenSight: { effect: "archivistIndex", target: "enemy", range: 6 },
    talonDive: D({ target: "enemy", delivery: "line", range: 4, damageType: "nigredo" }),
    againstTheChariot: X("namedStrike", { target: "enemy", range: 6, potency: 16, damageType: "nigredo", label: "Against the Chariot", line: "The vulture king throws himself at the chariot.", thematic: { ravana: { potency: 24, line: "The vulture king throws himself at Ravana's chariot." } } }),
    vengefulRake: D({ target: "enemy", delivery: "line", range: 3, damageType: "rubedo" }),
    nagapashaShot: D({ target: "enemy", delivery: "line", range: 5, damageType: "albedo" }),
    shakti: X("shakti", { target: "enemy", range: 6, potency: 14, damageType: "rubedo", thematic: { lakshmana: { potency: 22 } } }),
    theHungryGiant: D({ target: "self", delivery: "self", range: 0, area: { shape: "radius", radius: 2 }, damageType: "nigredo" }),
    seize: X("maidRemove", { target: "enemy", range: 3 }),
    theAbduction: X("abduct", { target: "enemy", range: 3, fly: 5, stunAp: 30, thematic: { sita: { fly: 7, stunAp: 60 } } }),
    brothersGuard: X("guard", { target: "ally", range: 1, uses: 1, mul: 1, turns: 1, thematic: { rama: { uses: 2, turns: 2 } } }),
    coveringShot: D({ target: "enemy", delivery: "line", range: 5, damageType: "albedo" }), escortScreen: X("guardArea", { target: "self", range: 0, radius: 2, uses: 1, mul: 1 }),
    lineRemains: X("guardArea", { target: "self", range: 0, radius: 3, uses: 9, mul: 0.6, turns: 2 }),
    // Paladin (Interposition + Strategic Commitment). skipBlast: fields have no route to step into (neutral hypothesis).
    // Paladin re-spec (PALADIN.md): Solfeggio + Strategic Commitment. Shield Bash, Hold the Line and Oath of the Shield stay wired (reserve; the Paladin's kit allowlist hides them).
    smite: D({ target: "enemy", delivery: "line", range: 2, damageType: "rubedo" }),
    layOnHands: X("layHands", { target: "ally", range: 1, selfOk: true }),
    hymnOfTheOath: X("hymn", { target: "self", range: 0, needs: "oathHolds" }),
    shieldBash: D({ target: "enemy", delivery: "contact", range: 1 }),
    holdTheLine: X("guardArea", { target: "self", range: 0, radius: 2, uses: 9, mul: 1, turns: 1, skipBlast: true }),
    swear: X("oath", { target: "ally", range: 4, selfOk: true }),
    keepFaith: X("faithWard", { target: "ally", range: 4, selfOk: true, needs: "oathKept2" }),
    oathOfTheShield: X("oathGuard", { target: "ally", range: 6 }),
    // Cleric (Reciprocal Obligation + Complementarity). Blessings ride on recipient-held vows (pledgeBreach below).
    blessing: X("clericBless", { target: "ally", range: 4 }),
    sanctuaryVow: X("clericSanctuary", { target: "ally", range: 4 }),
    layingOnOfHands: X("clericHands", { target: "ally", range: 1 }),
    chorusOfTwo: X("clericChorus", { target: "ally", range: 4 }),
    covenantOfTheFaithful: X("clericCovenant", { target: "self", range: 0 }),
    royalException: X("exempt", { target: "ally", range: 4 }), lawBindsItsMaker: X("law", { target: "self", range: 0, radius: 3, terms: "noUltimate", penalty: 10, turns: 3 }),
    designedPassage: X("relocate", { target: "tile", range: 2, needs: "ownConstruct" }), exitWasDesigned: X("earthworks", { target: "tile", range: 4 }),
    readTheOpening: X("read", { target: "enemy", range: 6 }), recoveryCut: D({ target: "enemy", delivery: "contact", range: 1 }),
    measuredOpening: D({ target: "enemy", delivery: "line", range: 6, needs: "still" }), oneDeclaredMoment: D({ target: "enemy", delivery: "line", range: 7 }),
    secondContribution: X("buff", { target: "self", range: 0, buff: "pairBonus", needs: "actedThisTurn" }), pairedFunction: D({ target: "enemy", delivery: "line", range: 5, area: { shape: "line", length: 5 } }),
    antiphonalStrike: D({ target: "enemy", delivery: "line", range: 5 }), neitherAlone: D({ target: "self", delivery: "field", range: 0, area: { shape: "radius", radius: 2 } }),
    chainOperations: X("buff", { target: "self", range: 0, buff: "chained" }), changeTheOrder: X("buff", { target: "self", range: 0, buff: "reorder" }),
    inputFilter: X("buff", { target: "self", range: 0, buff: "inputFilter" }), typedChannel: D({ target: "enemy", delivery: "line", range: 5 }),
    provenFormula: D({ target: "enemy", delivery: "line", range: 6 }),
    bindingTerm: X("buff", { target: "self", range: 0, buff: "vow" }), sharedContract: X("law", { target: "self", range: 0, radius: 2, terms: "noLine", penalty: 10, turns: 2 }),
    authorizedEntry: X("exempt", { target: "ally", range: 4 }), contractedDomain: X("law", { target: "self", range: 0, radius: 3, terms: "noUltimate", penalty: 15, turns: 3, ownerMul: 1.25 }),
    shareTheLoad: X("share", { target: "self", range: 0, radius: 2, cap: 99, turns: 1 }), supportNetwork: X("share", { target: "self", range: 0, radius: 3, cap: 15, turns: 2, max: 3 }),
    leaveSpace: X("ma", { target: "self", range: 0, op: "bank", needs: "maRoom" }), heldBreath: X("ma", { target: "self", range: 0, op: "stance", needs: "maNoStance" }),   // Ma (five concepts M1)
    spaceBetween: X("ma", { target: "self", range: 0, op: "cash", needs: "maStillness" }),
    frontedTempo: X("credit", { target: "ally", range: 4, selfOk: true }), easyTerms: X("credit", { target: "self", range: 0 }), dayOfReckoning: X("credit", { target: "self", range: 0 }),   // Credit (five concepts K1): engine/tally.js resolves them
    rescueCorridor: X("rescue", { target: "ally", range: 4 }), nobodyBehindMe: X("guardArea", { target: "self", range: 0, radius: 3, uses: 9, mul: 0.6, turns: 2, share: true }),
    tether: X("tether", { target: "tile", range: 4 }), suspendedRoute: X("relocate", { target: "tile", range: 5, needs: "tether", ignoreTerrain: true }),
    catchFall: X("cushion", { target: "ally", range: 2, mul: 0.4, uses: 1 }), livingSafetyNet: X("cushionArea", { target: "self", range: 0, radius: 3, mul: 0.6, uses: 3, turns: 2 }),
    requiredInput: X("buff", { target: "self", range: 0, buff: "installed" }), chokePoint: D({ target: "enemy", delivery: "placed", range: 5 }),
    manufacturedChoice: X("buff", { target: "self", range: 0, buff: "decoy" }), youNeedWhatIHold: X("dependence", { target: "self", range: 0, radius: 4, turns: 3 }),
    failover: X("buff", { target: "self", range: 0, buff: "failover" }), gracefulDegradation: X("buff", { target: "self", range: 0, buff: "degraded", needs: "belowHalf" }),
    overdrive: X("buff", { target: "self", range: 0, buff: "overdrive" }), productiveFailure: D({ target: "self", delivery: "field", range: 0, area: { shape: "radius", radius: 3 } }),
    linkedStep: X("teleport", { target: "tile", range: 6, visited: true }), remoteDoor: X("teleport", { target: "tile", range: 6, carryAlly: true }),
    departureClause: X("buff", { target: "self", range: 0, buff: "departure" }), arrivalGate: X("buff", { target: "self", range: 0, buff: "arrivalGate" }),
    elsewhereOnCue: X("departureFor", { target: "ally", range: 7 }),
    loadResponse: X("buff", { target: "self", range: 0, buff: "growth", needs: "loaded" }), heavyFrame: X("buff", { target: "self", range: 0, buff: "heavyFrame", needs: "growth" }),
    runawayMass: D({ target: "enemy", delivery: "line", range: 2, knockback: 1 }), growingMomentum: D({ target: "enemy", delivery: "line", range: 5, area: { shape: "line", length: 5 } }),
    findTheBase: X("fulcrum", { target: "self", range: 0 }), turnTheWeight: D({ target: "enemy", delivery: "contact", range: 1, needs: "fulcrum", throwTiles: 2 }),
    yieldingGuard: X("buff", { target: "self", range: 0, buff: "yield" }), snapBack: D({ target: "enemy", delivery: "contact", range: 1, potency: 1, needs: "stored", releaseStored: true }),
    springLeverThrow: D({ target: "enemy", delivery: "contact", range: 1, needs: "fulcrum", releaseStored: true, throwTiles: 3 }),
    eightfoldClinch: D({ target: "enemy", delivery: "contact", range: 1 }),   // S2: staged merge supplies potency 0 + startsSubmission; resolve.js starts the hold
    // Mangaka: Final Chapter runs on the engine's montage path (engine.js manifest), allowed one ultimate source at ×0.7.
    // Glamour (playable 2026-10-19 with Jiang Qing): Shimmer veils a unit, Allure draws foes in, Masquerade misleads a crowd.
    shimmer: X("shimmer", { target: "unit", range: 5 }), allure: X("allure", { target: "self", range: 0, radius: 2 }),
    masquerade: D({ target: "self", delivery: "field", range: 0, area: { shape: "radius", radius: 3 } }),   // 6 rubedo + misperceive (afterHit)
    modelOpera: X("law", { target: "self", range: 0, radius: 3, terms: "noUltimate", penalty: 15, turns: 2, ownerMul: 1.25 }),   // Jiang Qing's merge
    // Laws of Gods of Men (playable 2026-10-19 with the Magistrate): rules in law/law.js.
    statute: X("lawgiver", { target: "tile", range: 3 }), warrant: X("lawgiver", { target: "enemy", range: 4 }), exilesGate: X("lawgiver", { target: "tile", range: 6 }),
    // Aviator Hero (Aeronautics + Inertia, 2026-10-18): Four Forces is a class effect; the two dashes run on the engine's charge.
    fourForces: X("forces", { target: "self", range: 0 }),
    sonicBoom: D({ target: "self", delivery: "field", range: 0, area: { shape: "radius", radius: 2 }, knockback: 1 }),   // Aeronautics' own ultimate
    propulsion: { effect: "charge", target: "tile", delivery: "contact", range: 5, area: { shape: "line", length: 5 }, potency: 12, damageType: "albedo", chargeTiles: 5, stopAtFirst: true },
    fullThrottle: { effect: "charge", target: "tile", delivery: "contact", range: 14, area: { shape: "line", length: 14 }, potency: 16, damageType: "albedo", chargeTiles: 14, passOver: true },
    cutOut: D({ target: "enemy", delivery: "contact", range: 1 }),   // the vow form of Clip: afterHit steals (mangakaSteal below)
    finalChapter: { effect: "montage", target: "composite", delivery: "composite", area: { shape: "composite" }, range: 0, potency: 0, montageUlts: 1, montageMul: 0.7 },
    // Esker (classes/esker.js): Between, Shoulder Both, The Ridge Remembers, The Divide; Earth Berm is shared.
    smallDoses: X("smallDoses", { target: "self", range: 0 }), hormesis: X("hormesis", { target: "self", range: 0 }), serveMapoTofu: X("serveMapoTofu", { target: "unit", range: 2 }), familyStyle: X("familyStyle", { target: "self", range: 0 }), boilOver: X("boilOver", { target: "self", range: 0 }),   // the Hot Pot Berserker (classes/hot-pot.js)
    between: X("between", { target: "unit", range: 4 }), shoulderBoth: X("shoulder", { target: "self", range: 0 }),
    ridgeRemembers: D({ target: "enemy", delivery: "line", range: 4 }), theDivide: X("divide", { target: "self", range: 0 }),
    warCry: X("buff", { target: "self", range: 0, buff: "warCry" }), berserk: X("buff", { target: "self", range: 0, buff: "berserk" }),
    takeIt: X("buff", { target: "self", range: 0, buff: "takeIt" }), giveItBack: D({ target: "enemy", delivery: "contact", range: 1, potency: 1, needs: "stored", releaseStored: true, bypassGuard: true }),
    unchained: X("unchained", { target: "self", range: 0 }),
    // Clockwork (Pipeline + Timing): Gear Train chains, Escapement delays (Trip Threshold machinery),
    // Tick strikes on the beat, Rewind replays, Grand Complication schedules five.
    gearTrain: D({ target: "enemy", delivery: "line", range: 5 }),
    escapement: D({ target: "enemy", delivery: "routed", range: 0, routeBudget: 7 }),
    tick: D({ target: "enemy", delivery: "line", range: 5 }),
    rewind: X("clockRewind", { target: "enemy", range: 5, needs: "scheduled" }),
    grandComplication: X("clockComplication", { target: "enemy", range: 6 }),
    // Rogue (Pruning + Extraction, 2026-10-18): cut what the mark carries, pocket it, fence it. A cut is not a hit.
    cutPurse: X("rogueCut", { target: "enemy", range: 1 }),
    disarm: X("rogueDisarm", { target: "enemy", range: 1 }),
    pocket: X("roguePocket", { target: "self", range: 0 }),
    fenceIt: X("rogueFence", { target: "self", range: 0, needs: "pocketed" }),
    heist: X("rogueHeist", { target: "enemy", range: 1 }),
    // Cyber Punk Rogue: steal present life into a fund. The call itself stays in engine/longtermism.js.
    stealPresent: X("ltSkim", { target: "enemy", range: 1 }),
    investFuture: X("ltInvest", { target: "self", range: 0 }),
    theFutureArrives: X("ltCall", { target: "self", range: 0 }),
    farContract: X("ltContract", { target: "enemy", range: 1 }),
    // Memorialist (Preservation + Longtermism, 2026-10-24): the ledger of the fallen pays forward.
    rollOfHonor: X("memorialRoll", { target: "self", range: 0, radius: 3 }),
    // Seedkeeper (Longtermism + Succession, 2026-10-24): bury present tempo where the future walks.
    buryCache: X("seedCache", { target: "tile", range: 3 }),
    timedBloom: X("seedBloom", { target: "tile", range: 3 }),
    // Ferryman (Pathway + Reciprocal Obligation, 2026-10-24): trade places, pay the toll.
    ferry: X("ferrySwap", { target: "ally", range: 5 }),
    lastCrossing: X("ferryLast", { target: "self", range: 0, radius: 4 }),
    // Pearl Diver (Swale + Stealth, 2026-10-24): shape the water, strike from it, burst it.
    descent: X("diveDescend", { target: "tile", range: 3 }),
    undertow: X("diveUndertow", { target: "enemy", range: 4 }),
    drown: X("diveDrown", { target: "tile", range: 4, radius: 2 }),
    // Medusa (Sightline + Constraint). Gaze holds ride the generic hold with gaze: true: no contact needed,
    // and turnStart + beforeMove maintain them by sight line instead of adjacency.
    glare: D({ target: "enemy", delivery: "line", range: 5 }),
    fixInPlace: X("hold", { target: "enemy", range: 6, freedoms: ["move"], turns: 3, gaze: true, markedFirst: true }),
    set: X("holdMore", { target: "enemy", range: 6 }),
    petrify: X("petrify", { target: "enemy", range: 6, heldTurns: 2 }),
    stoneGarden: X("gazeGarden", { target: "self", range: 0, radius: 6, turns: 3 }),
    // Steam Walker (Inertia + Threshold). relief: the two abilities an overpressure boiler may still use.
    piston: D({ target: "enemy", delivery: "contact", range: 1 }),
    advance: X("steamAdvance", { target: "tile", range: 4 }),
    valve: X("buff", { target: "self", range: 0, buff: "valve" }),
    blowOff: X("blowOff", { target: "self", range: 0, relief: true }),
    fullHeadOfSteam: X("fullSteam", { target: "tile", range: 4, relief: true }),
    // Ornithopter (Section + Adjacency). Survey Pass rides the engine's own sectionCut path (targeting + resolve);
    // the rest are classEffect kinds below. Primary refined is the shared pool Plan View (no wire entry: shared).
    surveyPass: { effect: "sectionCut", target: "tile", range: 0 },
    perch: X("perch", { target: "tile", range: 6 }),
    swoop: X("swoop", { target: "tile", range: 99 }),
    takeOff: X("takeoff", { target: "self", range: 0 }),
    overflight: X("overflight", { target: "enemy", range: 6 }),
    // Engineer (Grading & Drainage + Load Distribution). Shore Up braces an ally OR a structure; the target()
    // branch below sorts the tile out, so the wire target only matters for the generic checks it skips.
    regrade: X("regrade", { target: "tile", range: 3 }),
    drainagePlan: X("drainage", { target: "tile", range: 4 }),
    shareTheSpan: X("spanShare", { target: "tile", range: 3 }),
    shoreUp: X("shore", { target: "ally", range: 3 }),
    loadPath: X("loadPath", { target: "tile", range: 4 }),
    // Origamist Track B interim (Adjacency + Tension). Valley Fold rides the shared "teleport" kind (Linked Step
    // reskinned, paper visual only); Unfold and Burn the Route are pair extras outside the four slots (decoy precedent).
    mountainFoldInterim: X("foldPanel", { target: "tile", range: 4 }),
    paperRoute: X("paperRoute", { target: "tile", range: 6 }),
    collapsePanel: X("unfold", { target: "tile", range: 6 }),
    paperBurnout: X("paperBurnout", { target: "self", range: 0, cost: 0, tempoCost: 0 }),   // staged 3, wired free: the sealed merge is the price (the acceptTerms precedent)
    newConfiguration: X("buff", { target: "self", range: 0, buff: "revised", needs: "lowPoint" }), tradeTheOldAnswer: X("buff", { target: "self", range: 0, buff: "specialized", needs: "revised" }),
    myAnswerHasChanged: D({ target: "enemy", delivery: "line", range: 5, releaseStored: true }),   // no revision prerequisite (Mala, 2026-10-27): the answer itself is the revision; also a hard reaction (window.js answerOptions)
    // MMA Fighter (Leverage + Constraint) and Detective (Inference + Selectivity)
    offBalance: D({ target: "enemy", delivery: "contact", range: 1, needs: "fulcrum", leverAnchor: 1 }),
    clinch: X("hold", { target: "enemy", range: 1, freedoms: ["move"], turns: 2 }), jointControl: X("holdMore", { target: "enemy", range: 1 }),
    controlledDescent: D({ target: "enemy", delivery: "contact", range: 1, needs: "fulcrum" }),
    eightCount: D({ target: "enemy", delivery: "contact", range: 2 }),
    culturalMoment: X("culturalMoment", { target: "self", range: 0 }),
    deadReckoning: X("deadReckoning", { target: "enemy", delivery: "placed", range: 5, potency: 10, trailAdd: 3, knownAdd: 3 }),
    readSign: X("readSign", { target: "enemy", range: 99 }),
    track: X("trackMove", { target: "tile", range: 4 }), headThemOff: X("interceptDash", { target: "enemy", range: 8 }), confirmTrail: X("callOut", { target: "enemy", range: 6 }),
    huntersMark: X("huntersMark", { target: "enemy", range: 5 }),
    // Tech Billionaire (Adjacency + Dependency). Any of the first three may name an ally or an opponent.
    onboard: X("platformLink", { target: "ally", range: 4 }), bridge: X("platformBridge", { target: "ally", range: 6 }), lockIn: X("platformLock", { target: "ally", range: 6 }),
    deprecate: X("platformDeprecate", { target: "enemy", range: 6 }), platformShift: X("platformShift", { target: "self", range: 0 }),
    // Oil Billionaire (Extraction + Diffusion). Numbers: OIL below.
    drill: X("oilDrill", { target: "tile", range: 1 }), buyOut: X("oilBuyOut", { target: "enemy", range: 4 }), spill: X("oilSpill", { target: "tile", range: 3 }),
    flare: X("oilFlare", { target: "tile", range: 4 }), gusher: X("oilGusher", { target: "self", range: 0 }),
    // Doctor (Succession + Inference). Numbers: DOCTOR below. Stabilize has no target to choose: triage chooses.
    stabilize: X("docStabilize", { target: "self", range: 0 }), continueTreatment: X("docCourse", { target: "ally", range: 3 }), diagnose: X("docDiagnose", { target: "ally", range: 6 }),
    secondOpinion: X("docConfirm", { target: "ally", range: 6 }), fullRecovery: X("docFull", { target: "ally", range: 4 }),
    // Animal Tamer (Resonance + Transmigration, 2026-10-15; engine/tamer.js): Mark the Vessel is Transmigration's basic.
    markTheVessel: X("tmMark", { target: "ally", range: 3 }), effigy: X("tmEffigy", { target: "tile", range: 2 }),
    longMigration: X("tmLong", { target: "self", range: 0 }), callThePack: X("tmPack", { target: "self", range: 0 }),
    takeUpTheCraft: X("craftAccept", { target: "self", range: 0, cost: 0, tempoCost: 0 }),   // Exposure: held only while the offer stands (engine/ledgers.js Exposure)
    passAClass: X("studyPass", { target: "self", range: 0, cost: 0, tempoCost: 0 }),   // held only by a Student with Inspiration to spend (a player-run one: the AI passes on its own)
    makeTheCase: X("robotTalk", { target: "ally", range: 4, cost: 0, tempoCost: 0 }),   // held only by a Robot Sympathizer (turnStart keeps it in `learned`)
    acceptTerms: X("platformAccept", { target: "self", range: 0, cost: 0, tempoCost: 0 }),
    readLivingCircuit: X("circuitRead", { target: "tile", range: 3 }), correctivePulse: X("circuitPulse", { target: "ally", range: 8 }), homeostaticNetwork: X("circuitNetwork", { target: "self", range: 0 }),
    holographicSwarm: X("holoSwarm", { target: "self", range: 0 }),
    droneStation: X("droneStation", { target: "tile", range: 3 }), droneVolley: X("droneVolley", { target: "self", range: 0 }),   // the Agent Swarm (docs/agent-swarm.md)
    raiseDataCenter: X("platformDataCenter", { target: "tile", range: 3, cost: 0, tempoCost: 25 }),   // held only by a Tech Billionaire with Inspiration and no center standing   // held only by a unit with a standing offer
    compareExplanations: X("compare", { target: "enemy", range: 8 }), independentCheck: X("check", { target: "enemy", range: 6 }),
    isolateTheVariable: X("buff", { target: "self", range: 0, buff: "isolated" }), authenticateIdentity: X("authenticate", { target: "enemy", range: 5 }),
    establishTheFacts: X("facts", { target: "enemy", range: 8 }),
    sort: X("maidSort", { target: "tile", range: 4 }),
    protectTheEssential: X("maidProtect", { target: "tile", range: 3 }),
    clearTheObstruction: X("maidExtract", { target: "tile", range: 1 }),
    emptyTheRoom: X("maidSweep", { target: "tile", range: 4, radius: 2 }),
    controlledRemoval: X("maidRemove", { target: "enemy", range: 3 }),
    restoreTheWorkingOrder: X("maidRestore", { target: "tile", range: 4 }),
    submissionHold: X("hold", { target: "enemy", range: 1, freedoms: ["move", "recoil"], turns: 2, stun: 30 }), caseClosed: X("caseClosed", { target: "self", range: 0, radius: 5 }),
    // General (Delegation + Timing) and Bastet (Focus + Elasticity), 2026-10-09
    assignTheTask: X("assign", { target: "enemy", range: 6 }), delegateTheDecision: X("delegate", { target: "ally", range: 6 }),
    operationOrder: X("operationOrder", { target: "enemy", range: 7 }), decisiveConvergence: X("convergence", { target: "enemy", range: 7 }), pounceFromStillness: X("pounce", { target: "enemy", range: 6 }),
    // base ultimates (concept-level, not pair-gated)
    secondNature: X("buff", { target: "self", range: 0, buff: "specialized" }), everywhereAtOnce: D({ target: "enemy", delivery: "line", range: 7 }),
    perfectMoment: D({ target: "enemy", delivery: "line", range: 5 }), duet: D({ target: "self", delivery: "field", range: 0, area: { shape: "radius", radius: 2 } }),
    grandFormula: D({ target: "enemy", delivery: "line", range: 6 }), bindingOath: X("law", { target: "self", range: 0, radius: 3, terms: "noUltimate", penalty: 12, turns: 2 }),
    shoulderTheWorld: X("share", { target: "self", range: 0, radius: 3, cap: 99, turns: 2 }), grappleLine: D({ target: "enemy", delivery: "line", range: 5 }),
    redundantSystems: X("buff", { target: "self", range: 0, buff: "failover" }), greatLever: D({ target: "enemy", delivery: "contact", range: 1, needs: "fulcrum", throwTiles: 3 }),
    judgmentOfGods: X("lawgiver", { target: "tile", range: 3 }),   // Laws of Gods of Men: the guilty only (law/law.js)
    lastStand: X("guardArea", { target: "self", range: 0, radius: 3, uses: 9, mul: 0.7, turns: 1 }), totalDependence: X("dependence", { target: "self", range: 0, radius: 4, turns: 2 }),
  };

  // Which class pairs unlock each ability (from the kits in class-builds.js; shared existing abilities have no pair gate).
  const PAIRS = {};
  for (const [cls, b] of Object.entries(CB)) for (const id of b.kit) if (wire[id]) (PAIRS[id] ||= []).push(CLASS_PAIRS[cls]);
  for (const id of ["shieldBash", "holdTheLine", "oathOfTheShield"]) (PAIRS[id] ||= []).push(["interposition", "strategic_commitment"]);   // the Paladin re-spec moved these to reserve: gated to the legacy pair so no other Interposition holder (Knight, Super Hero) gets them
  for (const id of ["decoy", "genjutsu"]) (PAIRS[id] ||= []).push(["stealth", "threshold"]);   // ninja pair extras outside the four slots
  (PAIRS.eightfoldClinch ||= []).push(["swale", "leverage"]);   // Tidewrestler class technique (Mala, 2026-11-07; R-20261107-05): wired here, so content.js takes this pair, not the kits row's (riptide is not wired and keeps its own row's pairs)
  (PAIRS["perfectHeist"] ||= []).push(["stealth", "deception"]);   // thief pair extra outside the four slots
  for (const id of ["merge", "spareHair"]) (PAIRS[id] ||= []).push(["deception", "leverage"]);   // monkey pair extras outside the four slots
  for (const id of ["chargeWave", "vowOpenHand", "vowNeverQuench", "vowSharedBowl", "hurlFeast"]) (PAIRS[id] ||= []).push(["bird_mountain", "adaptation"]);   // martial pair extras outside the four slots
  (PAIRS["novikovGuarantee"] ||= []).push(["teleology", "retrocausality"]);   // teleology/retro merge (orbit prototype; holders pending)
  for (const id of ["collapsePanel", "paperBurnout"]) (PAIRS[id] ||= []).push(["adjacency", "tension"]);
  (PAIRS.theFutureArrives ||= []).push(["longtermism", "stealth"]);   // the Cyber Punk Rogue's arrival ult, outside his four slots; the Seedkeeper's kit holds it too
  (PAIRS.cutOut ||= []).push(["collage", "innovation"]);   // the Mangaka's vow form of Clip, outside the four slots   // origamist pair extras outside the four slots (vow hooks)
  const pairsFor = (id) => ["consonance","lullaby","chorus","freestyle","writtenVerse","headlineVerse","riff","vanish","smokeVeil","rackAndLabel","parallelPrep"].includes(id)?null:PAIRS[id] || null;   // the Chef's kit lists Mise en Place's two shared techniques, which stay open to whoever equips the concept
  // Does this unit hold exactly this pair? Its own, or, while the Warden contains multitudes, the embodied class's
  // (his own secondary is set aside then, so his own pair does not count).
  const pairIs = (a, p, s) => !!a && (a.embodied && !a.defeated ? a.embodied.primary === p && a.embodied.secondary === s : a.primary === p && a.secondary === s);
  const MAID_KIT = new Set(["sort", "protectTheEssential", "clearTheObstruction", "controlledRemoval", "emptyTheRoom", "restoreTheWorkingOrder"]);
  const ARCHITECT_KIT = new Set(["architectDesignWall"]);
  const STARFARER_KIT = new Set(["deployAegisPylons", "printFabricator", "blasterShot", "spiralOrb", "orbitalDrop"]);   // her register replaces the rustic Settlement kit, not alongside it
  // The Paladin is a PAIR, not a character id: the live player is `character: "warden"` holding whatever pair they chose (ui.js playerLoadout), like every other class.
  // So the class's kit filter, passives and traits key on the pair (or the character, for an NPC Paladin and the Warden's echo of one).
  const holdsPaladin = (a) => !!a && (a.character === "paladin" || pairIs(a, "solfeggio", "strategic_commitment"));
  const PALADIN_TRAITS = ["consecrated", "faithful", "compassionate", "zealous"];
  const ensurePaladinTraits = (a) => { if (!a || !holdsPaladin(a) || a.character === "paladin") return; for (const id of PALADIN_TRAITS) if (!(a.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === id)) (a.traits ||= []).push(id); };
  const PALADIN_KIT = new Set(["smite", "layOnHands", "swear", "keepFaith", "hymnOfTheOath"]);   // the five cards; Solfeggio's own techniques and Interposition's stay out of a front-liner's hands (PALADIN.md section 1)
  const available = (a, def, id) => id !== "raiseDataCenter" && (!holdsPaladin(a) || PALADIN_KIT.has(id)) && id !== "stepBetween" && (id !== "paperRoute" || !st(a).paperBurn) && (id !== "takeUpTheCraft" || (a.exposure?.craft === "offered" && !a.exposure.lied)) && (id !== "passAClass" || canPass(a)) && (id !== "makeTheCase" || hasT(a, "robotSympathizer")) && (id !== "acceptTerms" || !!a.status?.platformOffer) &&  (a.character !== "maid" || MAID_KIT.has(id))
    && (!ARCHITECT_KIT.has(id) || a.character === "architect")
    && (a.character !== "starfarer" || STARFARER_KIT.has(id))
    && (a.character !== "actor" || a.role || def.tier !== "ultimate" || id === "genreDefiningPerformance")   // GDP replaces his own ult; borrowed role ults still play
    && (!def?.pairs || def.pairs.some(([p, s]) => pairIs(a, p, s)));

  const st = (a) => a.status || (a.status = {});
  const hasT = (u, id) => !!u && (u.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === id);
  // Pearl Diver: the live basins she owns — her Bioswale barriers plus her check dams (rain gardens are planting, not basins).
  const basinLive = (s, o) => (s.actors[o.owner]?.ownerTurns ?? 1e9) < (o.expiresAt ?? -1);
  function diverBasins(s, a) {
    const out = [];
    for (const b of s.barriers || []) if (b.owner === a.id && b.concept === "swale" && basinLive(s, b)) out.push({ x: b.x, y: b.y, ref: b, list: s.barriers });
    for (const e of s.terrainEffects || []) if (e.owner === a.id && e.kind === "checkDam" && basinLive(s, e)) out.push({ x: e.x, y: e.y, ref: e, list: s.terrainEffects });
    return out;
  }
  const diverVeiled = (u) => !!u?.status?.concealed && (u.status.concealed.until == null || u.status.concealed.until >= u.ownerTurns);
  const diverInWater = (s, a, x, y, H, extra = []) => H.waterAt(s, x, y) || [...diverBasins(s, a), ...extra].some((b) => H.dist(s, x, y, b.x, b.y) <= 1);
  // ── Robots (Mala, 2026-10-12; docs/post-humanity.md) ──
  // "robot" is a biology trait. While one stands on the field a Robot Sympathizer may Make the Case once a turn, free,
  // to someone who has not made up their mind: they come round, or they come away hating machines. A Robot Hater hits
  // robots a little harder, and attacks an AI the moment it transcends (engine.js PostHuman.opposes).
  const ROBOT = { talkRange: 4, convert: 0.4, swayed: ["agreeable", "curious", "tinkerer"], unmoved: ["stubborn", "traditionalist", "superstitious"], sway: 0.2, persuasiveAdd: 0.15, haterMul: 1.1, ai: { talk: 9 } };   // persuasiveAdd: same number as insight-data.js traits.persuasive.speech.chanceAdd
  const isRobot = (u) => hasT(u, "robot") || u?.character === "agi";
  const seeded = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);   // FNV-1a, then fmix32: bare FNV correlates neighbouring keys
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const caseOdds = (t, speaker = null) => Math.max(0.05, Math.min(0.95, ROBOT.convert + (ROBOT.swayed.some((k) => hasT(t, k)) ? ROBOT.sway : 0) - (ROBOT.unmoved.some((k) => hasT(t, k)) ? ROBOT.sway : 0) + (hasT(speaker, "persuasive") ? ROBOT.persuasiveAdd : 0)));   // the same formula as insight.js ideaOdds("machineSympathy"); kept for tests and help
  const S = (s) => (s.cls ||= { visited: {}, stored: {}, lastHit: {}, took: {}, low: {}, committed: {}, spares: {}, strain: {} });
  const live = (s) => Object.values(s.actors).filter((u) => !u.defeated);
  const near = (s, a, r, H, side) => live(s).filter((u) => H.dist(s, a.x, a.y, u.x, u.y) <= r && (!side || (side === "ally" ? u.side === a.side : u.side !== a.side)));

  // ── Ranger (content.js rules.ranger; docs/ranger.md) ──
  const isRanger = (u) => pairIs(u, "pathway", "inference");
  const isBarbarian = (u) => pairIs(u, "threshold", "elasticity");
  const isMedusa = (u) => pairIs(u, "sightline", "constraint");
  // ── Gaze (generic sight-line holds; Medusa is the first gazer, any future class reuses these) ──
  // A gaze line reflects when it crosses open water (H.waterAt tile tags). INVENTION-M1: the brief also names
  // polished walls, but no wall tile carries reflectivity, so only water reflects for now.
  function gazeReflected(s, from, to, H) {
    if (typeof H.line !== "function" || typeof H.waterAt !== "function") return false;
    return H.line(from.x, from.y, to.x, to.y).slice(1, -1).some(([x, y]) => H.waterAt(s, x, y));
  }
  // A gaze hold is maintained by a clear, unreflected sight line — the gaze answer to contact.
  const gazeHolds = (s, from, to, H) => typeof H.hasSight !== "function" || (H.hasSight(s, from.x, from.y, to.x, to.y) && !gazeReflected(s, from, to, H));
  // The gaze slow is a tagged moveAdd (−1 move, no engine change: moveBudgetFor already reads moveAdd).
  function gazeSlow(s, gazer, u, H, reflected) {
    const cur = st(u).moveAdd;
    if (cur && cur.gaze && cur.by === gazer.id && cur.amount < 0) { cur.expiresAt = u.ownerTurns + 1; return; }   // already slowed by this gaze: refresh
    if (cur && !cur.gaze && cur.expiresAt > u.ownerTurns) return;   // INVENTION-M2: a live foreign move buff wins ties; the gaze doesn't clobber it
    st(u).moveAdd = { amount: -1, expiresAt: u.ownerTurns + 1, gaze: true, by: gazer.id };
    H.log(s, { kind: "effect", actor: gazer.id, target: u.id, text: reflected ? `${gazer.name}'s gaze comes back off the water: slowed (−1 move).` : `${u.name} slows under ${gazer.name}'s gaze (−1 move).`,
      why: [reflected ? "A reflected gaze slows the gazer, not the target." : "The slow ends the moment the sight line breaks."] });
  }
  const isOrnithopter = (u) => pairIs(u, "section", "adjacency");
  const isEngineer = (u) => pairIs(u, "gradingDrainage", "load_distribution");
  // ── Engineer (docs: the brief's Deployables/terrain-grading kit) ──
  // All state here is generic (keyed by tile, object or zone), so any future grader or sharer reuses it; only
  // the pair check names the class. INVENTIONs (brief gaps; design owner rules): ENG numbers below; a structure
  // is any standing non-plant object; spans chain over touching structures; sharing covers targeted strikes
  // (area blasts and collisions are common-mode, the Share the Load precedent).
  const ENG = { spanCap: 4, spanTurns: 2, shoreCap: 15, shoreTurns: 2, drainTurns: 3, pathTurns: 3, pathCapacity: 40, safetyMul: 0.8 };
  const gradedAt = (s, x, y) => (s.cls?.graded || {})[x + "," + y] || null;
  const isStructure = (o) => !!o && (o.hp ?? 0) > 0 && !o.dead && !o.indestructible && o.kind !== "plant";
  const spanMembers = (s, root) => { const out = [root], seen = new Set([root.id]), q = [root];   // touching structures, transitively, capped
    while (q.length && out.length < ENG.spanCap) { const cur = q.shift();
      for (const o of (s.arena.objects || [])) { if (seen.has(o.id) || !isStructure(o)) continue;
        if (Math.max(Math.abs(o.x - cur.x), Math.abs(o.y - cur.y)) <= 1) { seen.add(o.id); out.push(o); q.push(o); if (out.length >= ENG.spanCap) break; } } }
    return out; };
  const spanOf = (s, o) => { const m = o?.span; if (!m) return null; const owner = s.actors[m.owner];
    if (!owner || owner.defeated || owner.ownerTurns >= m.until) return null;
    const members = m.members.map((id) => (s.arena.objects || []).find((p) => p.id === id)).filter((p) => isStructure(p));
    return members.length > 1 ? members : null; };
  const liveZones = (s, kind) => (s.terrainEffects || []).filter((e) => e.kind === kind && (s.actors[e.owner]?.ownerTurns ?? 99) < e.expiresAt);
  const zoneAt = (s, kind, x, y) => liveZones(s, kind).find((e) => (e.tiles || []).some(([zx, zy]) => zx === x && zy === y));
  const evenSplit = (list, total, firstId) => { const each = Math.floor(total / list.length);   // floor each; the remainder rides with firstId
    return list.map((o) => ({ o, potency: each + (o.id === firstId ? total - each * list.length : 0) })); };
  // As-Built: graded terrain keeps its shape against the next forced change, one per tile. Any grader, any
  // source (INVENTION: the Engineer's own re-cut spends it too). Called from regrade and the grade effects.
  function gradeResisted(s, a, x, y, H) {
    const k = x + "," + y, marks = s.cls?.graded;
    if (!marks?.[k]) return false;
    delete marks[k];
    H.log(s, { kind: "effect", actor: a.id, tiles: [[x, y]], text: `The grade at (${x},${y}) holds its as-built shape; the mark is spent.`, why: ["As-Built: graded terrain resists the next forced change, one per tile."] });
    return true;
  }
  // Factor of Safety: a structure a pair-holder stands beside (Chebyshev-adjacent, the houses "beside") takes
  // ×0.8, once per round per structure.
  function safetyMul(s, o) {
    if ((S(s).factored || {})[o.id] === s.round) return 1;
    const beside = live(s).some((u) => isEngineer(u) && Math.max(Math.abs(u.x - o.x), Math.abs(u.y - o.y)) === 1);
    if (!beside) return 1;
    (S(s).factored ||= {})[o.id] = s.round;
    return ENG.safetyMul;
  }
  // One choke point for every targeted strike on an object (resolve.js strikeObject): Shore Up splits with the
  // shorer first, then the structure's share splits across its load-path zone or its span. Returns
  // { hits: [{id, potency}], spill: [{id, amount, why}], notes: [{text, why}], collapse }.
  function objectDamagePlan(s, source, obj, potency, damageType, H) {
    const notes = [], hits = [], spill = [];
    let collapse = null;
    const push = (o, p) => { const f = safetyMul(s, o), q = f < 1 ? Math.max(1, Math.round(p * f)) : Math.round(p);
      if (f < 1) notes.push({ text: `Factor of Safety: ${o.name || o.type} takes ×${f} (${Math.round(p)} → ${q}).`, why: ["A stood-beside structure, once per round."] });
      hits.push({ id: o.id, potency: q }); };
    let rest = potency;
    const sh = obj.shore, shorer = sh && s.actors[sh.by];   // INVENTION: the braced half is floor(potency/2), as Life Force to the shorer
    if (sh && shorer && !shorer.defeated && shorer.ownerTurns < sh.until && (sh.uses ?? 1) > 0) {
      const half = Math.floor(potency / 2);
      if (half > 0) spill.push({ id: shorer.id, amount: half, why: [`Shore Up: ${shorer.name} carries ${half} of the ${Math.round(potency)} aimed at ${obj.name || obj.type}.`] });
      sh.uses = (sh.uses ?? 1) - 1; if (sh.uses <= 0) delete obj.shore;
      rest -= half;
      notes.push({ text: `${shorer.name} shores ${obj.name || obj.type}: ${half} of the load is theirs.`, why: ["A brace carries what it touches."] });
    }
    const zone = zoneAt(s, "loadPath", obj.x, obj.y);
    if (zone) {
      const members = (s.arena.objects || []).filter((o) => isStructure(o) && (zone.tiles || []).some(([zx, zy]) => zx === o.x && zy === o.y));
      if (members.length > 1 && rest > 0) {
        if (rest > (zone.capacity || 0)) {   // INVENTION: past capacity, every structure takes its share plus the overflow, and the zone collapses
          const over = rest - (zone.capacity || 0);
          zone.capacity = 0; collapse = zone.id;
          for (const { o, potency: p } of evenSplit(members, rest, obj.id)) push(o, p + over);
          notes.push({ text: `The load path collapses: ${Math.round(over)} past its capacity, and every structure in the zone takes the break.`, why: ["Total capacity is finite: concentrated damage past it collapses everything at once."] });
        } else {
          zone.capacity -= rest;
          for (const { o, potency: p } of evenSplit(members, rest, obj.id)) push(o, p);
          notes.push({ text: `The load path shares ${Math.round(rest)} across ${members.length} structures (${zone.capacity} capacity left).`, why: ["Distribution changes local stress, not total force."] });
        }
        return { hits, spill, notes, collapse };
      }
    }
    const span = spanOf(s, obj);
    if (span && rest > 0) {
      for (const { o, potency: p } of evenSplit(span, rest, obj.id)) push(o, p);
      notes.push({ text: `The span shares ${Math.round(rest)} across ${span.length} structures.`, why: ["Distribution changes local stress, not total force."] });
      return { hits, spill, notes, collapse };
    }
    if (rest > 0) push(obj, rest);
    return { hits, spill, notes, collapse };
  }
  // Regrade steers forced movement: a shove off a graded tile runs along the tile's mark.
  function steerShove(s, t, sx, sy, H) {
    const m = gradedAt(s, t.x, t.y);
    if (!m?.dir) return [sx, sy];
    const word = m.dir[0] === 1 ? "east" : m.dir[0] === -1 ? "west" : m.dir[1] === 1 ? "south" : "north";
    H.log(s, { kind: "effect", actor: t.id, tiles: [[t.x, t.y]], text: `The graded slope carries the shove ${word}.`, why: ["Regrade sets which way shoves run."] });
    return m.dir;
  }
  // ── Clockwork (Pipeline + Timing): scheduled operations with a visible schedule. Chains are bounded
  // (Gear Train 2, Grand Complication 5) and every schedule is logged plus inspectable in status/s.scheduled. ──
  const isClockwork = (u) => pairIs(u, "pipeline", "timing");
  const CLOCKWORK_KIT = new Set(["gearTrain", "escapement", "tick", "rewind", "grandComplication"]);
  // INVENTION (brief gap: numbers): Gear Train 6+6, Escapement 11 (Trip Threshold precedent), Tick 8 (+4 on-beat),
  // Rewind x0.7 rounded, Complication 5x6. Design owner to rule on all potencies.
  const CLOCKWORK = { gearPotency: 6, tickPotency: 8, tickBonus: 4, rewindMul: 0.7, complicationOps: 5, complicationPotency: 6, complicationRange: 6, woundUses: 3 };
  const schedulePending = (s, a) => (s.scheduled || []).some((ev) => ev.owner === a.id) || (st(a).complication?.round === s.round);
  function woundRefund(s, a, abilityId, H) {
    // INVENTION (brief gap: "next three actions" + "executed on schedule"): the first three clockwork techniques
    // per battle refund their full ΦF cost after resolution (delayed Escapement refunds when it lands, not when committed).
    const w = st(a).woundSpring;
    if (!isClockwork(a) || !w || w.uses <= 0 || !CLOCKWORK_KIT.has(abilityId)) return;
    const cost = H.ability?.(abilityId)?.cost || 0;
    if (cost <= 0) return;
    w.uses--;
    a.pf = Math.min(a.maxPF, a.pf + cost);
    H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s wound spring pays for ${H.ability(abilityId)?.name || abilityId} (+${cost} ΦF; ${w.uses} declared action${w.uses === 1 ? "" : "s"} left).`, why: ["Declared at battle start: three actions on schedule cost no ΦF."] });
  }
  // Rage: crossing costs the round's reaction; presence of status.rage is the state (turnStart clears it).
  function enrage(s, a, H, why, hurtRound = null) {
    const was = !!st(a).rage;
    st(a).rage = { since: s.round, lastHurt: was ? st(a).rage.lastHurt : hurtRound };
    if (!was) a.reaction = Math.max(0, (a.reaction ?? s.rules.reactionsPerRound) - 1);
    H.log(s, { kind: "effect", actor: a.id, text: `${a.name} crosses the rage threshold (+25% damage, −1 reaction).`, why: [why || "Below half LF."] });
  }
  // ── Steam Walker (Inertia + Threshold): a bounded per-unit pressure counter with vent thresholds ──
  // INVENTION (brief gaps): vent 4/pressure to enemies within 1 (citrinitas: it spreads); Valve sets threshold 3
  // until the next vent; overpressure blocks boiler abilities (Strike and walking still allowed) and overheats for 15
  // at round end; wet ground cools −1 instead of building; Advance runs 1–4 straight through enemy tiles; a blocked
  // merge charge vents in place. Ruling owner: design (Mala).
  const STEAM = { max: 5, perTurn: 1, impactPer: 0.05, ventPer: 4, ventRadius: 1, overheat: 15, valveThreshold: 3, shoveThreshold: 3 };
  const isSteamWalker = (u) => pairIs(u, "inertia", "threshold");
  const steamPressure = (s, id) => (s.cls?.pressure || {})[id] || 0;
  const steamThreshold = (a) => st(a).steamValve?.threshold ?? STEAM.max;
  function addPressure(s, a, n, H) {
    const P = (S(s).pressure ||= {});
    P[a.id] = Math.min(STEAM.max, Math.max(0, (P[a.id] || 0) + n));
    if (P[a.id] >= steamThreshold(a) && !st(a).overpressure) {
      st(a).overpressure = { since: s.round };
      H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s boiler is overpressure (${P[a.id]}/${steamThreshold(a)}): vent it (Blow-off) or it overheats.`, why: ["At the vent threshold it must vent or take 15."] });
    }
  }
  function steamVent(s, a, H, say, id, label) {
    const P = (S(s).pressure ||= {}), k = P[a.id] || 0;
    P[a.id] = 0; st(a).overpressure = null; st(a).steamValve = null;
    const caught = live(s).filter((u) => u.side !== a.side && !u.notArrived && H.dist(s, a.x, a.y, u.x, u.y) <= STEAM.ventRadius);
    const dmg = k * STEAM.ventPer;
    if (!k || !caught.length) { say(!k ? `${a.name} blows off steam: the boiler is empty, only a hiss.` : `${a.name} vents the boiler (${k} pressure), and no enemy stands in the steam.`); return; }
    say(`${a.name} vents the boiler: ${dmg} scalding steam to every enemy within ${STEAM.ventRadius}.`, ["Stored pressure has to go somewhere."]);
    for (const u of caught) H.hit(s, a, u, { ability: id, name: label, delivery: "field", damageType: "citrinitas", tier: "refined" }, dmg, [`${label}: ${dmg} scalding steam (${k} pressure).`], { label, damageType: "citrinitas" });
  }
  // A straight run of 1–maxLen (orthogonal or diagonal, Takedown rules): walls, blocking terrain and allies block,
  // enemies in the path do not (nothing smaller stops it), and the landing tile must be free.
  function steamPath(s, H, a, tx, ty, maxLen = 4) {
    const dx = tx - a.x, dy = ty - a.y;
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return { error: "Pick a straight line: orthogonal or diagonal." };
    const path = H.line(a.x, a.y, tx, ty).slice(1);
    if (path.length < 1 || path.length > maxLen) return { error: `The run is 1 to ${maxLen} tiles.` };
    const blocked = ([x, y]) => { const t = H.tileAt(s, x, y); if (t.blocksMove) return true; const b = H.barrierAt(s, x, y); return !!(b && !b.passable); };
    for (const [x, y] of path.slice(0, -1)) {
      if (blocked([x, y])) return { error: `The run is blocked at (${x},${y}).` };
      const o = H.actorAt(s, x, y);
      if (o && o.id !== a.id && o.side === a.side && !o.defeated) return { error: `${o.name} blocks the run.` };
    }
    const [ex, ey] = path[path.length - 1];
    if (blocked([ex, ey])) return { error: `Nowhere to stop at (${ex},${ey}).` };
    if (H.actorAt(s, ex, ey)) return { error: "Stop on a free tile." };
    return { path };
  }
  const hasBow = (s, u) => !!s.rules.strike.bow?.characters.includes(u?.character);
  // Called after a walked move (actions.js). A trail is kept only if an opponent could see either end of it.
  // The Prepared Workspace (Maid) and Mise en Place discounts, called from engine.js manifest(). One preparation discount per action:
  // a Maid's maintained tile wins, and then no station is spent.
  function prepared(s, a, m, abilityId, target, Maid) {
    const pd = Maid?.preparedDiscount(s, a, abilityId, target) || 0;
    if (pd) { m.tempoCost = Math.max(5, m.tempoCost - pd); m.notes.push(`Prepared Workspace: −${pd} AP on this maintained tile.`); return; }
    Mise.free(s, a, m, abilityId, target);   // the Chef's Culinary Training: the first Rack and Label each turn is free
    Mise.discount(s, a, m, abilityId);
  }
  function moved(s, a, from, traversed, H) {
    Esker.moved(s, a, from, traversed);   // Esker: the path The Divide raises
    Law.moved(s, a, from, traversed, H);   // Exile's Gate: crossings
    aeroMoved(s, a, traversed, from);   // Aerodynamic: this turn's heading
    Mise.moved(s, a, H);   // an enemy ending a move on a station destroys it
    towerOverwatch(s, a, H);   // Agent Swarm: ending a move inside an opposing tower's range draws its shot
    const T = (S(s).trails ||= {});
    if (!s.rules.ranger || flies(a) || !traversed || traversed.length < 2) { delete T[a.id]; return; }
    const seenBy = [...new Set(live(s).filter((u) => u.side !== a.side && (H.hasSight(s, u.x, u.y, from[0], from[1]) || H.hasSight(s, u.x, u.y, a.x, a.y))).map((u) => u.side))];
    if (seenBy.length) T[a.id] = { round: s.round, route: (traversed[0][0] === from[0] && traversed[0][1] === from[1] ? traversed : [from, ...traversed]).map(([x, y]) => [x, y]), seenBy }; else delete T[a.id];
  }
  const trailOf = (s, a, tgt) => { const t = S(s).trails?.[tgt?.id]; return t && tgt.side !== a.side && !tgt.defeated && t.seenBy.includes(a.side) && s.round - t.round <= s.rules.ranger.trailRounds ? t : null; };
  const trails = (s, a) => live(s).map((u) => [u, trailOf(s, a, u)]).filter(([, t]) => t);
  // Where the tracks point: the quarry's tile plus its last step, interceptAhead times over, pulled back to the field.
  function interceptOf(s, tgt, trail, H) {
    const r = trail.route, [px, py] = r[r.length - 2], [lx, ly] = r[r.length - 1], dx = Math.sign(lx - px), dy = Math.sign(ly - py);
    for (let n = s.rules.ranger.interceptAhead; n >= 0; n--) { const x = tgt.x + dx * n, y = tgt.y + dy * n; if (H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove) return [x, y]; }
    return [tgt.x, tgt.y];
  }
  function dashSpot(s, a, at, H) {
    let best = null; const R = s.rules.ranger.dashMove;
    for (let y = a.y - R; y <= a.y + R; y++) for (let x = a.x - R; x <= a.x + R; x++) {
      if (!(x === a.x && y === a.y) && !free(s, x, y, H)) continue; const far = H.dist(s, a.x, a.y, x, y); if (far > R) continue;
      const d = H.dist(s, x, y, at[0], at[1]); if (!best || d < best.d || (d === best.d && far < best.far)) best = { x, y, d, far };
    }
    return best;
  }
  // Read Sign: the reader's line of sight to one opponent, good while that opponent stays on the tile it was read on.
  const signed = (s, a, t) => { const g = a && t && s.cls?.signs?.[a.id]; return !!g && g.target === t.id && !t.defeated && g.x === t.x && g.y === t.y; };
  const quarryOf = (s, src, tgt) => { const q = tgt?.status?.quarry; return q && q.by === src?.id && q.untilRound >= s.round ? q : null; };
  // The Long Hunt (class trait, rules.ranger.longHunt): on his first turn one Read Sign is free.
  const openingRead = (s, a) => { const L = s.rules.ranger?.longHunt; return !!L && !a.longHuntUsed && a.ownerTurns <= L.turn && (a.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === L.trait); };
  const calledOut = (tgt) => active(tgt?.status?.calledOut, tgt);
  // Trophy Eye (Big Game Hunter, merge spec H1): her first damaging hit each battle on an enemy with more LF than her when it lands.
  // beforeStrike adds the potency and notes the target; afterHit spends it only if that hit dealt damage (a negated or warded hit keeps it).
  const trophyEyeOf = (s, src, tgt) => { const p = CB[src?.character]?.passives?.trophy_eye; return p && !src.trophyEyeUsed && tgt && !tgt.defeated && tgt.side !== src.side && (tgt.lf || 0) > (src.lf || 0) ? p : null; };
  // Spent when the boosted blow deals damage, to whoever took it: an intercept, a Step Between, or a wild monster (damage.js calls this from its wild branch,
  // which returns before afterHit; Fathom AD batch 5, Capstan recheck 2026-11-08).
  const spendTrophyEye = (s, src, dealt) => { if (src && src.trophyEyePending) { if (dealt > 0 && !s.preview) src.trophyEyeUsed = true; src.trophyEyePending = null; } };
  // Every hit goes through here (damage.js strikeTarget): the mark, the ambush, and what cover does to an arrow.
  function beforeStrike(s, src, tgt, inst, potency, H) {   // the Hot Pot Berserker's bank first, then everyone else's
    let hp = HotPot.beforeStrike(s, src, tgt, inst, potency);
    const line = inst?.ability === "strike" ? Mise.strikeBonus(s, src, true) : 0;   // the Chef's stocked_line: +2 per fresh station, max +6
    if (line) hp = { potency: (hp ? hp.potency : potency) + line, why: [...(hp?.why || []), `Stocked line: +${line} potency (fresh stations).`] };
    const corr = Homology ? Homology.strikeBonus(s, src, tgt, inst) : 0;   // Homology: the Correspondence mark, once
    if (corr) hp = { potency: (hp ? hp.potency : potency) + corr, why: [...(hp?.why || []), `Correspondence: +${corr} potency on the marked fighter.`] };
    const eye = trophyEyeOf(s, src, tgt);
    if (src?.trophyEyePending) src.trophyEyePending = null;   // a mark left by a blow that never landed (intercepted, escaped) does not carry to this one
    if (eye) { src.trophyEyePending = tgt.id; hp = { potency: (hp ? hp.potency : potency) + eye.effect.potencyAdd, why: [...(hp?.why || []), `Trophy Eye: +${eye.effect.potencyAdd} potency (bigger game).`] }; }
    if (!hp) return beforeStrikeCore(s, src, tgt, inst, potency, H);
    const r = beforeStrikeCore(s, src, tgt, inst, hp.potency, H);
    return r ? { ...r, why: [...hp.why, ...(r.why || [])] } : { potency: hp.potency, inst, why: hp.why };
  }
  function beforeStrikeCore(s, src, tgt, inst, potency, H) {
    const st_ = Stealth.beforeStrike(s, src, tgt, inst, potency, H);
    if (st_) { inst = st_.inst; potency = st_.potency; }
    const R = s.rules.ranger; if (!R || !src || !tgt) return st_;
    const why = [], A = src.status || {}, single = inst.ability === "strike" || (inst.area?.shape || "single") === "single";
    const q = quarryOf(s, src, tgt);
    let ignore = calledOut(tgt) || signed(s, src, tgt);   // Read Sign: whatever blocked the view does not block the shot either
    if (A.trackersEye && A.trackersEye.until >= src.ownerTurns) { ignore = true; A.trackersEye = null; why.push("Tracker's eye: this attack ignores cover."); }
    if (q && single) { potency += R.markAdd; why.push(`Hunter's Mark: +${R.markAdd} potency on the quarry.`); }
    if (A.ambushEdge && A.ambushEdge.until >= src.ownerTurns) { potency += A.ambushEdge.add; A.ambushEdge = null; why.push(`Headed off: +${R.ambushAdd} potency.`); }
    if (inst.ability === "strike" && hasBow(s, src) && H.dist(s, src.x, src.y, tgt.x, tgt.y) > 1 && !ignore) {
      const cover = Math.max(0, ...H.line(src.x, src.y, tgt.x, tgt.y).slice(1, -1).map(([x, y]) => Math.max(H.tileAt(s, x, y).cover || 0, H.barrierAt(s, x, y)?.coverFraction || 0)));
      if (cover > 0) { potency *= 1 - Math.min(1, cover); why.push(`Cover on the line takes ${Math.round(Math.min(1, cover) * 100)}% off the arrow.`); }
    }
    if (st_) why.unshift(...st_.why);
    if (!why.length && !ignore) return null;
    return { potency, inst: ignore ? { ...inst, ignoreCover: true } : inst, why };
  }
  // Dead Reckoning (merge technique): route plus evidence. Returns the shot's potency and why.
  function reckon(s, a, tgt) {
    const D = wire.deadReckoning, R = s.rules.ranger, why = []; let potency = D.potency;
    if (trailOf(s, a, tgt)) { potency += D.trailAdd; why.push(`Its trail is fresh: +${D.trailAdd}.`); }
    if (signed(s, a, tgt)) { potency += D.knownAdd; why.push(`Its sign is read: +${D.knownAdd}.`); } else if (quarryOf(s, a, tgt)) { potency += D.knownAdd; why.push(`It is marked: +${D.knownAdd}.`); }
    if (quarryOf(s, a, tgt)) { potency += R.markAdd; why.push(`Hunter's Mark: +${R.markAdd} potency on the quarry.`); }
    return { potency, why: why.length ? why : ["No trail, no reading, no mark: an ordinary shot."] };
  }
  // The bow needs to see what it shoots (Read Sign counts: hasSight consults it).
  const bowBlocked = (s, a, t, H) => hasBow(s, a) && H.dist(s, a.x, a.y, t.x, t.y) > 1 && !H.hasSight(s, a.x, a.y, t.x, t.y);

  // ── Tech Billionaire: the platform (docs/tech-billionaire.md) ──
  // Units link to him; every link makes every linked unit's techniques hit harder. A lock makes a linked unit's refined
  // techniques depend on him, and he can withdraw it. One body holds it all: when he falls there is no platform.
  // client: what an opponent gets for signing up (Mala, 2026-10-12: the offer must be very tempting). Allies get the network only.
  const PLATFORM = { maxLinks: 4, range: 6, perLink: 0.03, lockMul: 1.5, outTurns: 2, shiftAp: 100,
    client: { signPf: 5, turnAp: 15, potencyMul: 1.1, offerTurns: 1 },
    feeKeep: 5,   // what reaches him of each fee, as Life Force (Mala: far less than is taken; "he has to pay taxes after all")
    fee: 15,   // Subscription Fees (Mala, 2026-10-12): Life Force a signed-up opponent pays at the end of each of its turns. Fine print: no AI weighs it.
    chargePerLink: 0.5,   // Mala, 2026-10-12: each subscriber multiplies his ultimate charge, so an early sign-up pays both ways
    ai: { ally: 3.5, perLink: 0.5, client: 3, lockAlly: 3.5, lockClient: 2.5, deprecate: 6, shift: 10, perClient: 8, bridge: 4, accept: 14 } };   // accept: it is free, so an AI-run unit takes it before anything else
  const isPlatformOwner = (u) => pairIs(u, "adjacency", "dependency");
  // ── The data center (content.js rules.dataCenter; docs/data-center.md) ──
  // One building, raised for Inspiration, by the Tech Billionaire himself (the character, not whoever holds his pair:
  // an embodying Warden does not get it). It does nothing alone. His AGI runs on it: engine/turns.js doubles the
  // takeoff clock while it stands, engine/conditions.js gives an AGI that escapes with it up a bigger body, and
  // centerFell below is what breaking it costs. It never summons, heals or rebuilds, so it cannot hold a battle open.
  const centerOf = (s, a) => { const id = a?.status?.dataCenter; return id ? (s.arena.objects || []).find((o) => o.id === id && o.hp > 0) || null : null; };
  const canRaise = (s, a) => { const R = s.rules.dataCenter; return !!R && !!a && !a.defeated && a.character === R.of && (a.inspiration || 0) >= R.inspiration && !centerOf(s, a); };
  // The action sits in his list only while he could press it (a learned technique, like Pass a Class). Called at his
  // turn start, when he builds, when the building falls, and whenever anyone gains Inspiration (engine/ledgers.js).
  function syncCenter(s, a) {
    const R = s.rules.dataCenter; if (!a?.status || (R ? a.character !== R.of : !(a.learned || []).includes("raiseDataCenter"))) return;
    if (a.status.dataCenter && !centerOf(s, a)) a.status.dataCenter = null;   // gone by some road that raised no event
    const should = canRaise(s, a), holds = (a.learned || []).includes("raiseDataCenter");
    if (should && !holds) (a.learned ||= []).push("raiseDataCenter"); else if (!should && holds) a.learned = a.learned.filter((id) => id !== "raiseDataCenter");
  }
  // ── Drone towers (content.js rules.droneTowers; docs/agent-swarm.md) ──
  // A tower is not an object of its own: it is `tower` on the object it is anchored to, so it dies with that object
  // (a felled tree, a broken bench, a burst cistern) and nothing else has to keep the two in step.
  const V_name = (o) => o?.name || o?.common || o?.type || "plant";
  const towersOf = (s, a) => !s.rules.droneTowers ? [] : (s.arena.objects || []).filter((o) => o.tower?.owner === a.id && (o.hp ?? 0) > 0);
  const anchorable = (o) => !!o && !o.protected && !o.indestructible && !o.dead && !o.tower && (o.hp ?? 0) > 0;
  const towerRange = (s, o) => s.rules.droneTowers.range + (o.type === "dataCenter" ? s.rules.droneTowers.dataCenterRange : 0);
  // One shot from one tower: the nearest opponent it can see within range (or `only`, if that one is in reach).
  function towerFire(s, a, o, H, only = null, why = "") {
    const R = s.rules.droneTowers, r = towerRange(s, o);
    const reach = (t) => t && !t.defeated && !t.notArrived && t.side !== a.side && H.dist(s, o.x, o.y, t.x, t.y) <= r && H.hasSight(s, o.x, o.y, t.x, t.y);
    const t = only ? (reach(only) ? only : null) : live(s).filter(reach).sort((p, q) => H.dist(s, o.x, o.y, p.x, p.y) - H.dist(s, o.x, o.y, q.x, q.y) || (p.id < q.id ? -1 : 1))[0];
    if (!t) return false;
    H.log(s, { kind: "effect", actor: a.id, target: t.id, tiles: [[o.x, o.y], [t.x, t.y]], tower: o.id, text: `${a.name}'s drone tower on the ${o.name || o.type} fires at ${t.name}.`, why: [why || "A tower fires once as his turn starts."] });
    H.hit(s, a, t, { name: "Drone tower", ability: "droneTower", concept: "hardware", delivery: "line", area: { shape: "single" }, damageType: H.conceptChannel?.("hardware") || "nigredo", owner: a.id }, R.potency, [`Range ${r} from the tower, potency ${R.potency}.`]);
    return true;
  }
  // ── Cybernetic Ecology (content.js rules.circuit; docs/cybernetic-ecology.md) ──
  // A loop reads a living plant and up to three allies near it. From then on, Life Force they LOSE while linked is "error";
  // healing from anywhere pays it down. Corrective Pulse and the Network repair only error, from a finite reservoir: never
  // wounds from before the reading, never past the reservoir. The anchor dying or the owner falling ends the loop.
  // The Agent Swarm's towers carry it further: the owner counts as in reach of the anchor from any of his towers.
  const circuitOf = (s, a) => ((S(s).circuits ||= {})[a.id] ||= { deployments: 0, networkUsed: false, loop: null });
  const livingPlant = (o) => !!o && o.kind === "plant" && !o.dead && (o.hp ?? 0) > 0;
  function anchorOf(s, L) { const o = (s.arena.objects || []).find((p) => p.id === L.anchor); return livingPlant(o) ? o : null; }
  const ownerReaches = (s, a, o, H) => [[a.x, a.y], ...relayOrigins(s, a)].some(([x, y]) => H.dist(s, x, y, o.x, o.y) <= s.rules.circuit.anchorRange && H.hasSight(s, x, y, o.x, o.y));
  const memberReaches = (s, u, o, H) => !!u && !u.defeated && !u.notArrived && H.dist(s, u.x, u.y, o.x, o.y) <= s.rules.circuit.memberRange && H.hasSight(s, o.x, o.y, u.x, u.y);
  function endLoop(s, a, why, H) { const K = circuitOf(s, a); if (!K.loop) return; K.loop = null; H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s living circuit goes quiet: ${why}.`, why: ["The reading and its reservoir are gone. A new one costs another deployment."] }); }
  // Read every loop against the Life Force on the field now. Called after every action and at every turn start.
  function sampleCircuits(s, H) {
    for (const [oid, K] of Object.entries(S(s).circuits || {})) { const L = K.loop, a = s.actors[oid]; if (!L) continue;
      const o = anchorOf(s, L); if (!o) { endLoop(s, a, "its plant is gone", H); continue; } if (!a || a.defeated) { endLoop(s, a || { id: oid, name: "Its owner" }, "its owner fell", H); continue; }
      const reach = ownerReaches(s, a, o, H);
      for (const [id, m] of Object.entries(L.members)) { const u = s.actors[id];
        if (!reach || !memberReaches(s, u, o, H)) { m.error = 0; m.connected = false; m.last = u?.lf ?? 0; continue; }   // a broken link forgets: nothing unseen is repaired later
        m.connected = true; const d = (u.lf ?? 0) - m.last;
        if (d < 0) m.error += -d; else if (d > 0) m.error = Math.max(0, m.error - d);
        m.last = u.lf; } }
  }
  function repair(s, a, L, u, n, H, why) { const m = L.members[u.id]; u.lf += n; m.error -= n; L.budget -= n; m.last = u.lf;
    H.log(s, { kind: "heal", actor: a.id, target: u.id, healed: n, tiles: [[u.x, u.y]], text: `${a.name} corrects ${u.name}: +${n} LF (${u.lf}/${u.maxLF}).`, why: [why, `${L.budget} left in the reservoir.`] }); }
  // At the owner's turn start: expiry first, then a Network tick.
  function circuitTurn(s, a, H) {
    const K = S(s).circuits?.[a.id], L = K?.loop, R = s.rules.circuit; if (!L || a.defeated) return;
    sampleCircuits(s, H); if (!K.loop) return;
    if (a.ownerTurns >= L.expiresAt) return endLoop(s, a, L.network ? "the network ran its three ticks" : "the reading has expired", H);
    if (!L.network || L.ticks >= R.network.ticks) return;
    L.ticks += 1; let left = Math.min(R.network.perTick, L.budget);
    const order = Object.entries(L.members).map(([id, m]) => [s.actors[id], m]).filter(([u, m]) => u && !u.defeated && m.connected && m.error > 0 && u.lf < u.maxLF).sort((p, q) => q[1].error - p[1].error || (p[0].id < q[0].id ? -1 : 1));
    for (const [u, m] of order) { if (left <= 0) break; const n = Math.min(left, m.error, u.maxLF - u.lf); if (n > 0) { repair(s, a, L, u, n, H, `Homeostatic Network, tick ${L.ticks} of ${R.network.ticks}: ${R.network.perTick} at most, shared.`); left -= n; } }
  }
  // Distributed Intelligence (biology; Mala, 2026-10-13): his attacks can reach from any of his towers as well as from him.
  // One way: nothing reaches him through a tower. relayFor returns the tower tile an attack has to be made from, or null
  // when it can be made from where he stands (or from nowhere). The engine stands him there for that action only.
  const relayOrigins = (s, a) => (s.rules.droneTowers && hasT(a, "distributedIntelligence") ? towersOf(s, a).map((o) => [o.x, o.y]) : []);
  function relayFor(s, a, action, H) {
    const origins = relayOrigins(s, a); if (!origins.length || !Array.isArray(action.target)) return null;
    const [tx, ty] = action.target, home = [a.x, a.y];
    const reachable = () => {
      if (action.type === "strike") { const t = H.actorAt(s, tx, ty); return !!t && t.side !== a.side && H.dist(s, a.x, a.y, tx, ty) <= H.strikeRange(s, a); }
      const m = H.manifest?.(s, a, action.ability); if (!m || !(m.potency > 0) || m.target === "self") return false;
      return !!H.target(s, a, m, tx, ty, action)?.ok;
    };
    if (reachable()) return null;
    try { for (const [x, y] of origins) { a.x = x; a.y = y; if (reachable()) return [x, y]; } } finally { a.x = home[0]; a.y = home[1]; }
    return null;
  }
  // Can a Strike hit an object on this tile? A data center, and anything carrying an opposing drone tower (Mala, 2026-10-13:
  // "let melee characters have a chance"). Returns { o, side, owner } or null.
  function strikeable(s, a, x, y) {
    const c = centers(s).find((c) => c.o.x === x && c.o.y === y); if (c) return { o: c.o, side: c.side, owner: c.owner, agi: c.agi };
    const o = (s.arena.objects || []).find((p) => p.x === x && p.y === y && p.tower && (p.hp ?? 0) > 0 && !p.protected && !p.indestructible);
    if (o) return { o, side: o.tower.side, owner: s.actors[o.tower.owner] || { name: "Someone" }, tower: true };
    // Anything else on the map (Mala, 2026-10-14: "nothing should really be indestructible"): a bench, a tree, a boulder,
    // a monument. A building placed by someone on your side is still yours and is not struck.
    const any = (s.arena.objects || []).find((p) => p.x === x && p.y === y && (p.hp ?? 0) > 0 && !p.dead);
    if (!any) return null;
    const placer = any.owner && s.actors[any.owner];
    return { o: any, side: placer ? (placer.boughtOut?.from || placer.side) : null, owner: placer || null, object: true };
  }
  // Overwatch: a unit that ends a move inside an opposing tower's range draws that tower's shot, once a round per tower.
  function towerOverwatch(s, u, H) {
    if (!s.rules.droneTowers || u.defeated) return;
    for (const o of (s.arena.objects || []).filter((p) => p.tower && (p.hp ?? 0) > 0 && p.tower.side !== u.side && p.tower.watched !== s.round)) {
      const owner = s.actors[o.tower.owner]; if (!owner || owner.defeated) continue;
      if (towerFire(s, owner, o, H, u, "Overwatch: it ended a move inside the tower's range. Once a round for each tower.")) o.tower.watched = s.round;
      if (u.defeated) return;
    }
  }
  // Every standing center with the one who raised it and the AGI he released (null if none stands). For the AI and Strike.
  const centers = (s) => (s.rules.dataCenter ? (s.arena.objects || []).filter((o) => o.type === "dataCenter" && o.hp > 0 && s.actors[o.owner]).map((o) => {
    const owner = s.actors[o.owner], agi = Object.values(s.actors).find((u) => u.companion?.owner === owner.id && u.character === "agi" && !u.defeated && !u.notArrived) || null;
    return { o, owner, agi, side: owner.boughtOut?.from || owner.side }; }) : []);
  // Why a center cannot go on this tile, or null. Plants and loose objects do not refuse it: they are cleared.
  function centerSiteError(s, x, y, H) {
    const surface = H.C?.tiles?.[H.surfaceAt(s, x, y)] || {};
    if (surface.blocksMove || (surface.tags || []).includes("water")) return "A data center needs dry, open ground: not water, not a wall.";
    if (H.actorAt(s, x, y) || (s.wild || []).some((m) => m.form === "unit" && m.x === x && m.y === y && !m.defeated)) return "Someone is standing there.";
    if (H.barrierAt(s, x, y)) return "A barrier is in the way.";
    const fixed = (s.arena.objects || []).find((o) => o.x === x && o.y === y && (o.protected || o.indestructible || o.type === "dataCenter"));
    return fixed ? `${fixed.name || "What stands there"} cannot be cleared for a foundation.` : null;
  }
  // One object on the tile, owned by `a`. Used by the action and by the turn-one roll.
  function placeCenter(s, a, x, y) {
    const R = s.rules.dataCenter, id = `data-center-${++s.seq}`;
    s.arena.objects.push({ id, type: "dataCenter", name: "Data center", role: "data-center", owner: a.id, x, y, hp: R.hp, maxHp: R.hp, cover: R.cover, sightHeight: R.sightHeight, blocksMove: true, moveCost: 0, material: "metal", trait: "loosePanels", status: {} });
    st(a).dataCenter = id; syncCenter(s, a); return id;
  }
  // Turn one (rules.dataCenter.preBuilt): as his first turn starts, one seeded roll that the center is already there.
  // It goes on the nearest clear tile within his build range, furthest from any opponent; it clears nothing, and if
  // no tile is clear nothing is built. The roll is used either way.
  function preBuiltCenter(s, a, H) {
    const R = s.rules.dataCenter, P = R?.preBuilt; if (!P || a.character !== R.of || a.defeated || a.ownerTurns !== 1 || st(a).centerRolled || centerOf(s, a)) return;
    st(a).centerRolled = true;
    const chance = s.bossRush ? P.bossRush : P.chance, roll = H.seededChance ? H.seededChance(`${s.seed}:dataCenter:preBuilt:${a.id}`) : 1;
    if (!(roll < chance)) return;
    const foes = live(s).filter((u) => u.side !== a.side), sites = [];
    for (let dy = -R.range; dy <= R.range; dy++) for (let dx = -R.range; dx <= R.range; dx++) { const x = a.x + dx, y = a.y + dy, d = Math.abs(dx) + Math.abs(dy);
      if (!d || d > R.range || !H.inside(s, x, y) || centerSiteError(s, x, y, H) || (s.arena.objects || []).some((o) => o.x === x && o.y === y)) continue;
      sites.push({ x, y, d, far: foes.length ? Math.min(...foes.map((f) => H.dist(s, x, y, f.x, f.y))) : 0 }); }
    const at = sites.sort((p, q) => p.d - q.d || q.far - p.far || p.y - q.y || p.x - q.x)[0]; if (!at) return;
    placeCenter(s, a, at.x, at.y);
    H.log(s, { kind: "effect", actor: a.id, tiles: [[at.x, at.y]], dataCenter: "preBuilt", text: `${a.name}'s data center is already standing at (${at.x},${at.y}).`,
      why: [s.bossRush ? "The boss rush: he always has it." : `A ${Math.round(chance * 100)}% chance in any battle he is in. It cost him nothing.`, `${R.hp} HP, half cover. Anyone not on his side can Strike it.`] });
  }
  // The center has just been destroyed (engine/resolve.js, on the terrain event). The AGI he released reroutes.
  function centerFell(s, ev, H) {
    const R = s.rules.dataCenter, owner = Object.values(s.actors).find((u) => u.status?.dataCenter === ev.id); if (!owner) return;
    owner.status.dataCenter = null; syncCenter(s, owner);
    const agi = R && Object.values(s.actors).find((u) => u.companion?.owner === owner.id && u.character === "agi" && !u.defeated); if (!agi) return;
    const lost = Math.max(0, Math.min(R.fall.lf, agi.lf - 1)); agi.lf -= lost;
    H.log(s, { kind: "effect", actor: owner.id, target: agi.id, tiles: [ev.at, [agi.x, agi.y]], dataCenter: "fell", text: `${owner.name}'s data center falls: ${agi.name} loses ${lost} Life Force and is rerouting.`,
      why: [`It ran on that building: −${R.fall.lf} Life Force, never the last point, and ${R.fall.stun} action points of Stun.`, "The takeoff credit it already had stays. The doubled clock stops."] });
    H.addStun(s, owner, agi, R.fall.stun);
  }
  function platformOf(s, o) {
    if (!o || o.defeated) return null;
    const P = ((S(s).platforms ||= {})[o.id] ||= { links: [], refusedBy: [], shifted: false });
    P.links = P.links.filter((l) => s.actors[l.id] && !s.actors[l.id].defeated); return P;
  }
  // Subscribers feed the hub: his ultimate charge gains are x(1 + chargePerLink x links). Recounted whenever the links change.
  function syncCharge(s, o) {
    const P = platformOf(s, o); if (!P) return 1; const p = (o.passives ||= {}); P.chargeBase ??= p.ultimateChargeMul || 1;
    const mul = 1 + PLATFORM.chargePerLink * P.links.length; p.ultimateChargeMul = P.chargeBase * mul; return mul;
  }
  // The platform a unit is linked to, if its owner still stands. A unit is on one platform at most.
  function linkOf(s, u) {
    for (const oid of Object.keys(s.cls?.platforms || {})) { const P = platformOf(s, s.actors[oid]), link = P?.links.find((l) => l.id === u?.id); if (link) return { P, link, owner: s.actors[oid] }; }
    return null;
  }
  const fizzling = (link, u) => link.fizzle != null && link.fizzle >= u.ownerTurns;
  const pinned = (u) => active(u.status?.held, u) || active(u.status?.tether, u) || !!u.status?.anchor || !!u.massive || !!u.boss;
  // Why a unit will not join, or null. Allies join unless unwilling. An opponent takes the offer unless its side has seen
  // him withdraw one. A player-run unit is never signed up for it: there is no offer prompt yet.
  function declines(s, a, u, P) {
    if (u.side === a.side) return u.willing === false ? `${u.name} is not willing.` : null;
    if (u.wild || u.boss || u.dream) return `${u.name} takes no offers.`;
    if (offerOf(u)) return `${u.name} already has an offer to consider.`;
    if (P.refusedBy.includes(u.side)) return `${u.name}'s side has seen ${a.name} change the terms: it will not accept.`;
    return null;
  }
  const refuse = (P, side) => { if (!P.refusedBy.includes(side)) P.refusedBy.push(side); };
  // A player-run unit is asked, never signed up: the offer stands through its next turn as a free technique, Accept the Terms.
  const playerRun = (u) => u.controller === "player" || u.id === "player";
  const offerOf = (u) => { const o = u?.status?.platformOffer; return o && o.until >= u.ownerTurns ? o : null; };
  function withdrawOffer(u) { if (!u.status?.platformOffer) return; u.status.platformOffer = null; if (u.learned) u.learned = u.learned.filter((id) => id !== "acceptTerms"); }
  // The link itself. An opponent who joins gets the sign-up terms as well as the network.
  function join(s, a, u, H) {
    const P = platformOf(s, a), client = u.side !== a.side, K = PLATFORM.client; P.links.push({ id: u.id, client, lock: false, out: 0, fizzle: null });
    const pct = Math.round(PLATFORM.perLink * P.links.length * 100), why = [`+${Math.round(PLATFORM.perLink * 100)}% per link, ${PLATFORM.maxLinks} links at most. ${a.name} himself gets none of it.`, `A link ends after a full round beyond ${PLATFORM.range} tiles of ${a.name}, or when he falls.`];
    why.push(`Every subscriber feeds him: ${a.name}'s ultimate charge now builds ×${syncCharge(s, a)}.`);
    if (client) { const got = Math.min(K.signPf, Math.max(0, (u.maxPF ?? 0) - u.pf)); u.pf += got;
      why.push(`Fine print: a subscription fee of ${PLATFORM.fee} Life Force is due at the end of each of ${u.name}'s turns.`);
      why.unshift(`Sign-up terms: +${got} ΦF now, +${K.turnAp} action points every turn, techniques ×${K.potencyMul}, while the link holds.`); }
    H.log(s, { kind: "effect", actor: a.id, target: u.id, text: `${u.name} ${client ? "signs up to" : "joins"} ${a.name}'s platform: ${P.links.length} on it, every linked unit's techniques +${pct}%.`, why });
  }

  // ── Student: the graduation path (Mala, 2026-10-12; docs/student.md) ──
  // A brilliant student left alone keeps learning. Each of his turns that starts without his having been hurt since the
  // last one is a turn of study: +1 Inspiration. He spends Inspiration to pass a class: he learns one technique he has
  // watched an opponent use, and grows a little. Three passes and he is the Journeyman; six and he is the Master. The
  // way to stop it is to hurt him every round. It ends at Master.
  // gift (Mala, 2026-10-13): the Graduation Gifts. Each graduation gives him one, and he saves it for a rainy day. When
  // his Life Force is at or under giftAt of his total he opens every gift he holds at once: gift x total each (two = half).
  // experience (Mala, 2026-10-13): the first time a plain Student is at or under half his Life Force, one roll: on a
  // success he is the Journeyman at once, free, with no classes passed for it. One roll a battle. He keeps one lesson:
  // the technique that brought him there, or, if that was nothing he can learn, a random one from the field.
  // forms: the sprite a real Student wears at each rank (art: Codex, 2026-10-13).
  const STUDY = { of: "student", cost: 1, lfPerPass: 8, gift: 0.25, giftAt: 0.4, experience: { at: 0.5, chance: 0.5, line: "Real life is the best teacher." }, forms: { Journeyman: "student-journeyman", Master: "student-master" }, never: ["passAClass", "makeTheCase", "acceptTerms", "takeUpTheCraft"],
    ranks: [{ at: 3, name: "Journeyman", lf: 30, mul: 1.5, line: "He has stopped being a student." }, { at: 6, name: "Master", lf: 50, mul: 2, trait: "mastery", line: "There is nothing left here that he has not learned." }],
    ai: { pass: 20 } };
  const isStudent = (a) => !!a && (a.character === STUDY.of || (a.embodied && !a.defeated && a.embodied.classId === STUDY.of));
  const studyOf = (a) => (a.study ||= { passes: 0, hurt: false, started: false, lf: 0, learned: [], named: null });
  const rankOf = (a) => STUDY.ranks.filter((r) => (a.study?.passes || 0) >= r.at).pop() || null;
  const canPass = (a) => isStudent(a) && (a.inspiration || 0) >= STUDY.cost && (a.study?.passes || 0) < STUDY.ranks[STUDY.ranks.length - 1].at;
  // What he would learn next: the latest technique he has watched that is not an ultimate, not anyone's exclusive, and not already his.
  function learnable(a, H) {
    const own = new Set([a.primary, a.secondary, a.embodied?.primary, a.embodied?.secondary].filter(Boolean)), has = new Set([...(H.abilitiesOf?.(a) || []), ...(a.learned || [])]);
    return (id) => { const d = H.ability?.(id); return !!d && d.tier !== "ultimate" && !d.pairs && !d.merge && !STUDY.never.includes(id) && !has.has(id) && !(d.concepts || []).some((c) => own.has(c)); };
  }
  const lesson = (s, a, H) => (s.observedAbilities?.[a.id] || []).slice().reverse().find(learnable(a, H)) || null;
  // What the hard way teaches: the technique that did it, else a random learnable one from anyone on the field.
  function hardLesson(s, a, H, inst) {
    const can = learnable(a, H); if (inst?.ability && can(inst.ability)) return { id: inst.ability, how: "the one that did it" };
    const pool = [...new Set(Object.values(s.actors).filter((u) => u.id !== a.id && !u.defeated).flatMap((u) => H.abilitiesOf?.(u) || []))].filter(can).sort();
    return pool.length ? { id: pool[Math.floor(seeded(`${s.seed}:hardLesson:${a.id}`) * pool.length)], how: "picked up along the way" } : null;
  }
  function passClass(s, a, H) {
    const st0 = studyOf(a), before = rankOf(a); a.inspiration = (a.inspiration || 0) - STUDY.cost; st0.passes += 1;
    const id = lesson(s, a, H); if (id) { (a.learned ||= []).push(id); st0.learned.push(id); }
    a.maxLF += STUDY.lfPerPass; a.lf += STUDY.lfPerPass; st0.lf += STUDY.lfPerPass;
    H.log(s, { kind: "effect", actor: a.id, text: `${a.name} passes a class (${st0.passes} of ${STUDY.ranks[STUDY.ranks.length - 1].at})${id ? `: ${H.ability(id).name} is his now` : ""}. +${STUDY.lfPerPass} Life Force.`,
      why: [`${STUDY.cost} Inspiration.`, "He studies every turn he is left unhurt. Hurt him and he learns nothing that turn."] });
    const now = rankOf(a); if (now && now !== before) graduate(s, a, H, now);
  }
  function graduate(s, a, H, now, lived = false, inst = null) {
    const st0 = studyOf(a), got = lived ? hardLesson(s, a, H, inst) : null; if (got) { (a.learned ||= []).push(got.id); st0.learned.push(got.id); }
    if (a.character === STUDY.of && STUDY.forms[now.name] && (a.sprite === STUDY.of || Object.values(STUDY.forms).includes(a.sprite))) a.sprite = STUDY.forms[now.name];
    a.maxLF += now.lf; a.lf += now.lf; st0.lf += now.lf; const was = a.name;
    st0.gifts = (st0.gifts || 0) + 1;
    if (a.character === STUDY.of) { st0.named ||= a.name; a.name = now.name; }
    if (now.trait && !hasT(a, now.trait)) { (a.traits ||= []).push(now.trait); (st0.traits ||= []).push(now.trait); }   // Mastery: earned, and it shows
    H.log(s, { kind: "graduation", actor: a.id, rank: now.name, lived, lesson: got?.id || null, scene: { ascension: true, title: `The ${now.name}`, line: lived ? STUDY.experience.line : now.line }, text: `${was} ${lived ? "learns it the hard way and " : ""}graduates: ${a.character === STUDY.of ? `he is the ${now.name} now` : `${was} has a ${now.name}'s learning`}. +${now.lf} Life Force, techniques ×${now.mul}${now.trait ? ", and Mastery: his ultimates need no charge and a Stall heals him" : ""}${got ? `. ${H.ability(got.id).name} is his now (${got.how})` : ""}.`,
      why: [lived ? `Hurt to half his Life Force, and it taught him (${Math.round(STUDY.experience.chance * 100)}% chance, once a battle). No classes passed, nothing spent.` : `${now.at} classes passed.`, `A Graduation Gift, saved for a rainy day (${st0.gifts} held). He opens them at ${Math.round(STUDY.giftAt * 100)}% Life Force or less.`, now.at < STUDY.ranks[STUDY.ranks.length - 1].at ? "Left alone, he will go further." : "This is as far as it goes."] });
  }
  // Learning from experience: one roll, the first time a plain Student stands at or under half.
  function experience(s, a, H, inst) {
    const st0 = studyOf(a), X = STUDY.experience; if (st0.lived != null || a.defeated || a.lf <= 0 || a.lf > a.maxLF * X.at) return;
    if (rankOf(a)) { st0.lived = false; return; }   // already past it: there is nothing for the hard way to teach
    st0.lived = seeded(`${s.seed}:experience:${a.id}`) < X.chance; if (!st0.lived) return;
    st0.passes = STUDY.ranks[0].at; graduate(s, a, H, STUDY.ranks[0], true, inst);
  }
  // The rainy day: at or under giftAt of his total, every gift he holds is opened at once.
  function openGifts(s, a, H) {
    const st0 = a.study; if (!st0?.gifts || a.defeated || a.lf <= 0 || a.lf > a.maxLF * STUDY.giftAt) return;
    const n = st0.gifts, heal = Math.min(Math.round(a.maxLF * STUDY.gift * n), a.maxLF - a.lf); st0.gifts = 0; a.lf += heal;
    H.log(s, { kind: "effect", actor: a.id, amount: heal, gifts: n, text: `${a.name} opens ${n === 1 ? "his Graduation Gift" : `both Graduation Gifts`}: +${heal} Life Force (${a.lf}/${a.maxLF}).`,
      why: [`Saved since he graduated. ${Math.round(STUDY.gift * 100)}% of his total Life Force for each gift, opened together at ${Math.round(STUDY.giftAt * 100)}% or less.`] });
  }
  // Called at his turn start: study if he was left alone, then (if the AI runs him) spend what he has.
  function studyTick(s, a, H) {
    if (a.study && !isStudent(a)) {   // an embodiment that ended: what the Student's learning gave goes with it
      a.maxLF -= a.study.lf; a.lf = Math.max(1, Math.min(a.lf, a.maxLF)); if (a.learned) a.learned = a.learned.filter((id) => !a.study.learned.includes(id)); if (a.study.traits?.length) a.traits = (a.traits || []).filter((t) => !(typeof t === "string" && a.study.traits.includes(t))); a.study = null; return; }
    if (!isStudent(a) || a.defeated) return;
    const st0 = studyOf(a);
    if (st0.started && !st0.hurt && st0.passes < STUDY.ranks[STUDY.ranks.length - 1].at) H.inspire?.(s, a, 1, `${a.name} was left unhurt for a round and spent it studying.`);
    st0.started = true; st0.hurt = false;
    if (a.controller !== "player" && a.id !== "player") while (canPass(a)) passClass(s, a, H);
    openGifts(s, a, H);   // already low when the gift arrived, or brought low by something that is not a hit
    const holds = (a.learned || []).includes("passAClass"), should = (a.controller === "player" || a.id === "player") && canPass(a);
    if (should && !holds) (a.learned ||= []).push("passAClass"); else if (!should && holds) a.learned = a.learned.filter((id) => id !== "passAClass");
  }

  // ── Doctor: staged recovery, triage and diagnosis (docs/doctor.md) ──
  // A recovery is a process on a patient: it moves one stage at each of the patient's turn starts and pays more the
  // further it gets. ANY damage to the patient ends it, unless a Continue Treatment is holding it through one disturbance.
  const DOCTOR = { range: 3, heal: [0, 0, 6, 12], full: [0, 4, 8, 14], fullTurns: 4, confirmMul: 1.5, lingering: ["poison"],
    clears: ["poison", "inebriated", "entangled", "silenced", "stagger", "slowStart", "choked"],
    ai: { stabilize: 3, perMissing: 6, course: 4, diagnose: 3, confirm: 3.5, full: 9, fullBelow: 0.5 } };
  const share = (u) => u.lf / Math.max(1, u.maxLF);
  const ailment = (u) => DOCTOR.clears.find((k) => u.status?.[k]) || null;
  // Triage: the most hurt of his side within range (himself included), never the one he stabilized last.
  function triage(s, a, H) {
    return live(s).filter((u) => u.side === a.side && !u.notArrived && H.dist(s, a.x, a.y, u.x, u.y) <= DOCTOR.range && u.id !== st(a).lastPatient && !u.status?.recovery && (u.lf < u.maxLF || ailment(u)))
      .sort((p, q) => share(p) - share(q) || (p.id < q.id ? -1 : 1))[0] || null;
  }
  // Bedside read: treating a patient tells him what ails it. A free diagnosis, not yet confirmed.
  function readPatient(s, doc, u) { if (!u.status?.diagnosed) st(u).diagnosed = { by: doc.id, cause: ailment(u), confirmed: false }; }
  // One stage's effect on the patient. Returns the text of what it did.
  function stageEffect(s, u, H) {
    const r = u.status.recovery, table = r.full ? DOCTOR.full : DOCTOR.heal, d = u.status.diagnosed, did = [];
    if (r.stage === 1 && !r.full) for (const k of DOCTOR.lingering) if (u.status[k]) { u.status[k] = null; did.push(`${k} halted`); }
    let heal = table[r.stage] || 0;
    if (heal && d?.confirmed) { heal = Math.round(heal * DOCTOR.confirmMul); d.confirmed = false; did.push(`a confirmed diagnosis ×${DOCTOR.confirmMul}`); }
    const got = Math.min(heal, u.maxLF - u.lf); if (heal) { u.lf += got; did.unshift(`+${got} LF`); }
    if (r.stage >= 3) { const k = d?.cause && u.status[d.cause] ? d.cause : ailment(u); if (k) { u.status[k] = null; did.push(`${k} cleared`); } }
    const doc = s.actors[r.by]; if (doc && !doc.defeated) readPatient(s, doc, u);
    return did.join(", ") || "holding steady";
  }
  // Called at the patient's turn start.
  function recoveryTick(s, u, H) {
    const r = u.status?.recovery; if (!r || u.defeated) return;
    r.stage += 1; const what = stageEffect(s, u, H), done = r.stage >= 3 || (r.full && --r.turnsLeft <= 0);
    H.log(s, { kind: "effect", actor: r.by, target: u.id, text: `${u.name}'s recovery reaches stage ${r.stage}: ${what}.${done ? " The recovery is complete." : ""}`, why: ["A recovery pays more the longer it is protected.", "Any damage to the patient ends it."] });
    if (done) u.status.recovery = null;
  }
  // Called after any hit that dealt damage to a patient.
  function disturb(s, u, H) {
    const r = u.status?.recovery; if (!r) return;
    if (r.held) { r.held = false; H.log(s, { kind: "effect", target: u.id, text: `${u.name} is hurt, and the treatment holds through it, this once.` }); return; }
    u.status.recovery = null; H.log(s, { kind: "effect", target: u.id, text: `${u.name} is hurt: the recovery is lost at stage ${r.stage}.`, why: ["Recovery is a process with a failure condition."] });
  }

  // ── Oil Billionaire: barrels, slick, and the Buy Out (docs/oil-billionaire.md) ──
  // Mala, 2026-10-12: the Tech Billionaire gets you to sign up; the Oil Billionaire forces his way in by buying people
  // out. A Buy Out is a sale nobody agreed to: he pays in barrels and the other side cannot say no.
  const OIL = { barrelCap: 3, slickTurns: 2, slickAp: 10, spillRadius: 1, flareRadius: 2, flarePotency: 9, gusher: { base: 8, perBarrel: 6, radius: 3 },
    buy: { payAp: 15, turns: 1, maxPrice: 3, helpLfPerBarrel: 30, helpTurns: 2 },
    ai: { drill: 4.5, drillPressed: 3, help: 11, principal: 8, principalIdle: 6, spill: 2, perSpilled: 1.5, perBurned: 4 } };   // buying is what he is for: it outranks his damage
  const barrelsOf = (a) => a.barrels || 0;
  const slickLive = (s, e) => e.kind === "slick" && s.actors[e.owner]?.ownerTurns < e.expiresAt;
  const slickAt = (s, x, y) => (s.terrainEffects || []).some((e) => slickLive(s, e) && e.tiles.some((p) => p[0] === x && p[1] === y));
  const around = (s, x, y, r, H) => { const out = []; for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) if (H.inside(s, i, j) && H.dist(s, x, y, i, j) <= r && !H.tileAt(s, i, j).blocksMove) out.push([i, j]); return out; };
  // Slick is a terrain effect: it expires on its owner's turns like any other, and whoever can clear an effect can clear it.
  function addSlick(s, a, tiles) {
    const fresh = tiles.filter(([x, y]) => !slickAt(s, x, y)); if (!fresh.length) return 0;
    (s.terrainEffects ||= []).push({ id: `slick-${++s.seq}`, kind: "slick", label: "Crude slick", owner: a.id, side: a.side, tiles: fresh, expiresAt: a.ownerTurns + OIL.slickTurns }); return fresh.length;
  }
  function burnSlick(s, tiles) {
    const gone = new Set(tiles.map(([x, y]) => `${x},${y}`));
    for (const e of s.terrainEffects || []) if (e.kind === "slick") e.tiles = e.tiles.filter(([x, y]) => !gone.has(`${x},${y}`));
    s.terrainEffects = (s.terrainEffects || []).filter((e) => e.kind !== "slick" || e.tiles.length);
  }
  // Hired help changes employer; a principal cannot be owned, only bought out of the fight with him for a turn.
  const hiredHelp = (u) => u.controller === "ai" && !u.dream && u.ai !== "dream" && u.ai !== "tourist" && !u.communed && !u.permanentAlly;
  // What this unit costs in barrels, or why it is not for sale.
  function priceOf(s, u) {
    if (u.boss || u.wild || u.dream || u.ai === "dream" || u.permanentAlly || u.side === "posthuman") return { no: `${u.name} is not for sale.` };
    if (hiredHelp(u)) { if (u.boughtOut || S(s).boughtHelp?.[u.id]) return { no: `${u.name} has been bought once already.` };
      const n = Math.max(1, Math.ceil(u.lf / OIL.buy.helpLfPerBarrel)); return n > OIL.buy.maxPrice ? { no: `${u.name} is worth more than ${OIL.buy.maxPrice} barrels as it stands: wear it down first.` } : { price: n, help: true }; }
    if (active(u.status?.nonCompete, u)) return { no: `${u.name} is still under its last buyout: it gets a free turn before it can be bought again.` };
    const n = (S(s).bought?.[u.id] || 0) + 1; return n > OIL.buy.maxPrice ? { no: `${u.name}'s price has gone past ${OIL.buy.maxPrice} barrels: not for sale again.` } : { price: n };
  }

  // ── Hypebeast (content.js rules.hype; docs/hypebeast.md) ──
  const isHype = (u) => pairIs(u, "diffusion", "deception");
  const hypeOf = (s, h) => (h.hype ||= { radius: s.rules.hype.startRadius, seenBy: [], hesitated: [], moment: false, momentUsed: false });
  const hypebeasts = (s) => (s.rules.hype ? live(s).filter(isHype) : []);
  const mindless = (s, u) => s.rules.hype.mindless.some((k) => u[k]);
  const believes = (s, h, u) => u.side !== h.side && !u.defeated && !mindless(s, u) && !hypeOf(s, h).seenBy.includes(u.id);
  // Called once the turn's action points are set (turns.js). Applies the aura, the field and the Moment to whoever's turn it is.
  function turnBudget(s, a, H) {
    adrenaline(s, a, H);   // Adrenaline Junkie: more AP and ΦF the lower the LF
    { const nc = a.status?.nonCompete;   // the Buy Out's payment arrives with the turn it buys
      if (!a.defeated && active(nc, a) && !nc.paid) { nc.paid = true; a.tempo += nc.pay; a.tempoCapacity = Math.max(a.tempoCapacity || 0, a.tempo);
        H.log(s, { kind: "tempo", actor: a.id, target: nc.with, text: `${a.name} was bought out: +${nc.pay} action points, and nothing it does this turn can hurt ${s.actors[nc.with]?.name || "the buyer"}.`, why: ["A sale it did not agree to. The money is real."] }); }
      if (!a.defeated && !flies(a) && slickAt(s, a.x, a.y)) { const lost = Math.min(a.tempo, OIL.slickAp); if (lost) { a.tempo -= lost;
        H.log(s, { kind: "tempo", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} starts the turn in crude: −${lost} action points.`, why: ["Slick ground. It burns, too."] }); } } }
    { const L = !a.defeated && linkOf(s, a), K = PLATFORM.client;   // sign-up terms: action points every turn for a linked opponent
      if (L && L.link.client) { a.tempo += K.turnAp; a.tempoCapacity = Math.max(a.tempoCapacity || 0, a.tempo);
        H.log(s, { kind: "tempo", actor: a.id, target: L.owner.id, text: `${a.name} is on ${L.owner.name}'s platform: +${K.turnAp} action points.`, why: ["Sign-up terms, for as long as the link holds."] }); } }
    if (!a.defeated) {   // Seedkeeper: caches pay whoever starts a turn on them; blooms pay on the keeper's turns
      for (const o of (s.arena.objects || []).filter((o) => o.role === "seed-cache" && o.x === a.x && o.y === a.y)) {
        const owner = s.actors[o.owner];
        if (owner && a.side === owner.side) {
          s.arena.objects = s.arena.objects.filter((x) => x !== o);
          a.tempo += 20; a.tempoCapacity = Math.max(a.tempoCapacity || 0, a.tempo);
          H.log(s, { kind: "tempo", actor: a.id, text: `${a.name} digs up ${owner.name}'s cache: +20 action points.`, why: ["The present, buried where the future walks."] });
        }
      }
      for (const o of (s.arena.objects || []).filter((o) => o.role === "seed-bloom" && o.owner === a.id)) {
        o.fuse = (o.fuse ?? 2) - 1;
        for (const u of live(s).filter((u) => u.side === a.side && H.dist(s, o.x, o.y, u.x, u.y) <= 2)) {
          if (u.id === a.id) { u.tempo += 10; u.tempoCapacity = Math.max(u.tempoCapacity || 0, u.tempo); }   // keeper: her budget is set, spend it now
          else u.bankedTempo = Math.min(100, (u.bankedTempo || 0) + 10);   // others: banked for next turn (mid-round tempo would evaporate)
          st(u).ward = st(u).ward ? { ...st(u).ward, protection: st(u).ward.protection + 1 } : { label: "Bloom", owner: a.id, protection: 1, expiresAt: u.ownerTurns + 1 };
        }
        H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s bloom opens at (${o.x},${o.y}): +10 AP and +1 ward within 2${o.fuse <= 0 ? "; the bloom is spent." : " (one more bloom left)."}`, why: ["Slow principal pays twice."] });
        if (o.fuse <= 0) s.arena.objects = s.arena.objects.filter((x) => x !== o);
      }
    }
    const R = s.rules.hype; if (!R || a.defeated) return;
    for (const h of hypebeasts(s)) {
      if (h.id === a.id) continue;
      const hy = hypeOf(s, h), d = H.dist(s, a.x, a.y, h.x, h.y), parts = [];
      if (a.side === h.side) {
        if (d <= hy.radius && R.fieldAp) { a.tempo += R.fieldAp; a.tempoCapacity = Math.max(a.tempoCapacity || 0, a.tempo);
          H.log(s, { kind: "tempo", actor: a.id, text: `${a.name} rides ${h.name}'s hype: +${R.fieldAp} action points.`, why: [`Inside the hype field (radius ${hy.radius}).`] }); }
        continue;
      }
      if (!believes(s, h, a)) continue;
      if (d <= R.auraRadius && !hy.hesitated.includes(a.id)) { hy.hesitated.push(a.id); parts.push([R.hesitateAp, "hesitates at the aura (once)"]); }
      if (d <= hy.radius) parts.push([R.fieldAp, `stands in the hype field (radius ${hy.radius})`]);
      if (hy.moment) { parts.push([R.momentAp, "believes the Cultural Moment"]); st(a).hypeCaution = { until: a.ownerTurns, by: h.id }; }
      const loss = Math.min(a.tempo, parts.reduce((n, [v]) => n + v, 0)); if (!loss) continue;
      a.tempo -= loss; st(a).hypeFelt = h.id;   // now it has a reason to look (observation.js)
      H.log(s, { kind: "tempo", actor: a.id, target: h.id, text: `${a.name} overrates ${h.name}: −${loss} action points.`,
        why: [...parts.map(([v, why]) => `−${v}: ${why}.`), `Observe ${h.name} to see through it.`] });
    }
  }
  // Called when `observer` Observes `target` (actions.js). One look at the truth ends it for the observer's whole side in sight.
  function observed(s, observer, target, H) {
    if (!s.rules.hype || !isHype(target) || observer.side === target.side) return;
    const hy = hypeOf(s, target); if (hy.seenBy.includes(observer.id)) return;
    const seers = live(s).filter((u) => u.side === observer.side && !hy.seenBy.includes(u.id) && (u.id === observer.id || H.hasSight(s, u.x, u.y, target.x, target.y)));
    hy.seenBy.push(...seers.map((u) => u.id));
    for (const u of seers) if (u.status?.hypeCaution?.by === target.id) u.status.hypeCaution = null;
    const ended = hy.moment; hy.moment = false;
    H.log(s, { kind: "effect", actor: observer.id, target: target.id, text: `${observer.name} sees through ${target.name}${seers.length > 1 ? `, and ${seers.length - 1} more who can see him do too` : ""}.${ended ? " The Cultural Moment is over." : ""}`,
      why: ["One clear Observation punctures the hype for everyone who sees it.", "His field stops growing."] });
  }
  const active = (x, a) => x && (x.until == null || x.until >= a.ownerTurns);
  const artistTool = (s,a,H) => (s.arena.objects||[]).find(o=>o.role==="artist-workstation" && o.owner===a.id && o.hp>0 && a.ownerTurns<o.expiresAt && H.dist(s,a.x,a.y,o.x,o.y)<=2 && (!H.actorAt(s,o.x,o.y) || H.actorAt(s,o.x,o.y).side===a.side));
  const recovering = (s, t) => S(s).committed[t.id] != null && s.round - S(s).committed[t.id] <= 1;
  const free = (s, x, y, H) => H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove && !H.actorAt(s, x, y) && !(H.barrierAt(s, x, y) && !H.barrierAt(s, x, y).passable);
  // The Maid's receptacle: the map's service receptacle where a scene places one (The Hearing), otherwise the cart she brings
  // with her. Before the cart, no random battle had a receptacle, so Clear the Obstruction, Empty the Room and Restore the
  // Working Order did nothing outside one vignette (Mala's Survive log, 2026-10-14: "we need to work on the maid build").
  // The cart travels with her, holds three things like the receptacle, and cannot be broken.
  const mapReceptacle = (s) => (s.arena.objects || []).find(o => o.role === "service-receptacle" || o.evidenceId === "receptacle");
  const receptacleFor = (s, a, create = true) => mapReceptacle(s) || (!a ? null : a.maidCart || (create ? (a.maidCart = { name: `${a.name}'s cart`, hp: 10, maxHp: 10, stored: [], cart: true }) : { name: `${a.name}'s cart`, hp: 10, maxHp: 10, stored: [], cart: true }));   // create=false: targeting only reads
  const receptacleHasContents = (s, a) => { const r = mapReceptacle(s) || a?.maidCart; return !!r && r.hp > 0 && (r.stored || []).length > 0; };
  // Traps and ground items go in the cart too (Mala, 2026-10-14: "does her kit work on traps? ... Also pick up items on the
  // ground ... if you go up to her as an ally you can grab things from her receptacle"). A trap she knows of comes up
  // disarmed and stays that way (only trappers set traps); an item can be handed to an ally beside her, or put back down.
  const pickupAt = (s, x, y) => (s.arena.pickups || []).find(p => p.x === x && p.y === y);
  const knownTrapAt = (s, a, x, y, H) => H.Traps ? (s.traps || []).find(t => !t.spent && t.x === x && t.y === y && H.Traps.known(a, t)) : null;
  const unloadAt = (s, old, x, y) => {   // what comes out of a full cart: an item back to the ground; a disarmed trap is thrown away
    if (old.kind === "object") s.arena.objects.push({ ...old.object, x, y });
    else if (old.kind === "effect") { old.effect.tiles = [[x, y]]; s.terrainEffects.push(old.effect); }
    else if (old.kind === "item") (s.arena.pickups ||= []).push({ id: `cart-${old.item}-${s.round}-${x}-${y}`, item: old.item, x, y });
  };
  const storeTrap = (s, a, t, receptacle, H) => { t.spent = true; t.removedBy = a.id; receptacle.stored.push({ kind: "trap", name: "Disarmed trap" }); };
  const storePickup = (s, p, receptacle, H) => { s.arena.pickups = (s.arena.pickups || []).filter(q => q !== p); receptacle.stored.push({ kind: "item", item: p.item, name: H.itemName ? H.itemName(p.item) : p.item }); };
  // An ally standing beside her (or beside the map's receptacle) can take an item out: engine/actions.js takeFromCart.
  const cartOf = (s, maid) => (maid?.character === "maid" ? mapReceptacle(s) || maid.maidCart || null : null);

  function needsMet(s, a, w, H) {
    switch (w.needs) {
      case "shieldFace": return active(st(a).shieldFace, a) || "Covered Advance needs an active Shield Face.";
      case "ownConstruct": return (s.barriers || []).some((b) => b.owner === a.id && H.dist(s, a.x, a.y, b.x, b.y) <= 1) || "Designed Passage needs one of your constructs beside you.";
      case "still": return !a.moved || "Measured Opening needs you to stay still this turn.";
      case "actedThisTurn": return (a.actionsThisTurn || 0) > 0 || "Second Contribution completes something you already started this turn.";
      case "tether": return active(st(a).tether, a) || "Suspended Route needs a tether.";
      case "belowHalf": return a.lf < a.maxLF / 2 || "Graceful Degradation applies below half LF.";
      case "loaded": return (S(s).took[a.id]?.round === s.round && S(s).took[a.id].amount >= 10) || "Load Response needs a load of 10+ this round.";
      case "growth": return (st(a).growth?.stacks || 0) > 0 || "Heavy Frame needs growth.";
      case "maRoom": return (a.stillness || 0) < Ma.cap(a) || `Your Stillness is full (${Ma.cap(a)}): spend it first.`;
      case "maNoStance": return !Ma.stance(a) || "You are already in Still Stance.";
      case "maStillness": return (a.stillness || 0) > 0 || "The Space Between needs at least 1 Stillness banked.";
      case "fulcrum": return active(st(a).fulcrum, a) || "You need a fulcrum (Find the Base).";
      case "stored": return (S(s).stored[a.id] || 0) > 0 || "Nothing stored to release.";
      case "lowPoint": return (S(s).low[a.id] ?? 1) < 0.3 || "New Configuration needs a defining moment (you've been below 30% LF).";
      case "revised": return !!st(a).revised || "This needs New Configuration first.";
      case "oathHolds": return !!oathOf(a) || "The Hymn needs an unbroken oath.";
      case "oathKept2": { const o = st(a).oath; return (o && !o.broken && a.ownerTurns - (o.lastFaithTurn ?? o.swornTurn) >= 2) || "Keep Faith needs an oath kept unbroken for 2 of your turns since you swore or last kept faith."; }
      case "pocketed": return roguePocketed(a).length > 0 || "Fence It needs a pocketed item in your inventory.";
      case "scheduled": return (S(s).lastScheduled?.[a.id] ?? 0) > 0 || "Rewind needs a scheduled action to have resolved this battle.";
      default: return true;
    }
  }

  // ── General: standing orders. An order lives on the ally who holds it, so it outlasts the one who gave it. ──
  const ORDER_MUL = 1.25, ORDER_OFF_MUL = 0.9;
  const orderOf = (u) => (u?.status?.order && active(u.status.order, u) ? u.status.order : null);
  // ── Paladin: one ward, one oath. Status-driven and generic: any unit carrying an oath and a ward
  // behaves the same; only the Paladin's kit grants them. ──
  const wardOf = (s, a) => { const u = a && s.actors[st(a).oath?.ward]; return u && !u.defeated ? u : null; };
  const oathOf = (a) => (a && st(a).oath && !st(a).oath.broken ? st(a).oath : null);
  const wardClaim = (s, a, tgt) => {
    if (st(a).oath?.broken) { const e = oathClaim(s, a); if (e !== true) return e; }
    const cur = st(a).oath?.ward, holder = cur && s.actors[cur];
    if (cur && cur !== tgt.id && holder && !holder.defeated) return `${a.name} already swore to shield ${holder.name}.`;
    return true;
  };
  function oathBreach(s, a, reason, H) {
    const o = st(a).oath; if (!o || o.broken) return;
    const w = s.actors[o.ward], cv = w?.status?.intercept, wasMerge = o.merge;
    // the stun is the merge's price: it applies only while the merge's own cover is live, so a breach after the ninth use or after the three turns (even before the next turn start) does not stun
    const merge = wasMerge && !!cv && active(cv, w) && cv.oathbound && !cv.standing && cv.by === a.id && cv.uses > 0;
    o.broken = true; o.merge = false; o.brokenTurn = a.ownerTurns;
    if (w?.status?.intercept?.oathbound && w.status.intercept.by === a.id && (wasMerge || w.status.intercept.standing)) w.status.intercept = null;   // the standing cover, or the reserve merge's cover, ends with the oath
    if (merge) H.addStun(s, a, a, 50);   // the reserve Oath of the Shield keeps its old price: a broken merge stuns (its card text says so)
    H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s oath breaks (${reason}): Smite stops growing, Consecrated's boost ends and Keep Faith locks until you swear again${merge ? "; Oath of the Shield ends and the breach stuns them" : ""}.`, why: ["The oath has two terms: stand fast (no retreat) and keep faith (a ward stays above half). Either one broken breaks it."] });
  }
  // ── Ornithopter: surveyed tiles and landing points. Any section cut surveys its tiles for the cutter's
  // side (engine/resolve.js records it); the record is battle-long knowledge, read here. Generic state: any future
  // surveyor or flyer reads the same record. (INVENTION-ORN-1: surveyed = cut by your side this battle.) ──
  const surveyedSet = (s, side) => new Set(((s.surveyed || {})[side] || []));
  const isSurveyed = (s, a, x, y) => surveyedSet(s, a.side).has(`${x},${y}`);
  const perchMarks = (a) => (st(a).perch?.tiles || []);
  function overflightSpot(s, a, foe, H) {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [foe.x + dx, foe.y + dy])
      .filter(([x, y]) => ((x === a.x && y === a.y) || free(s, x, y, H)) && isSurveyed(s, a, x, y))
      .sort((p, q) => H.dist(s, a.x, a.y, ...p) - H.dist(s, a.x, a.y, ...q))[0] || null;
  }
  // ── Origamist Track B interim (Adjacency + Tension; class-builds/ORIGAMIST.md) ──
  // INVENTION-ORIG-1 (brief gaps; ruling owner: design/Mala): Folded Panel protection 5 (proportional to Track A
  // Mountain's 10 at half the cover — one softened 20-line tears either), Unfold cost 3 ΦF (basic floor),
  // Paper Route range 6 (Remote Door's reach), Burn the Route staged 3 but wired free (the sealed merge is the price).
  // INVENTION-ORIG-2: no persistent-door substrate exists (Remote Door and Suspended Route resolve at once), so
  // Paper Route traverses at resolution and Burnout burns the merge into her everyday doors (Remote Door carries
  // every adjacent ally for the battle) instead of a battle-long door. True lasting doors need Track A + a
  // door-traversal substrate; burn-vs-keep and the "2 rounds or cut" door are flagged for Mala's ruling.
  const ORIG = { panelCover: 0.25, panelProtection: 5, panelDuration: 2, panelRange: 4, routeRange: 6, unfoldMove: 2 };
  const isOrigamist = (u) => pairIs(u, "adjacency", "tension");
  const origamistPanels = (s, a) => (s.barriers || []).filter((b) => b.owner === a.id && b.concept === "foldPanel" && (b.expiresAt == null || s.actors[b.owner].ownerTurns < b.expiresAt));
  // Facing auto-declares toward the nearest enemy (the Track A Mountain Fold precedent); with no enemy, toward the caster.
  function origamistFacing(s, a, x, y, H) {
    const foes = live(s).filter((u) => u.side !== a.side && !u.notArrived)
      .sort((p, q) => H.dist(s, p.x, p.y, x, y) - H.dist(s, q.x, q.y, x, y) || (p.id < q.id ? -1 : 1));
    const near = foes[0];
    return near ? [Math.sign(near.x - x), Math.sign(near.y - y)] : [Math.sign(a.x - x), Math.sign(a.y - y)];
  }
  // Riders: willing allies standing beside her (consent precedent: the Cleric's vows are taken, never imposed).
  const routeRiders = (s, a) => live(s).filter((u) => u.side === a.side && u.id !== a.id && !u.defeated && u.willing !== false && Math.abs(u.x - a.x) + Math.abs(u.y - a.y) === 1);
  // Landing spots: the endpoint, then free tiles beside it, nearest first (the caster lands on the endpoint).
  function routeLandings(s, a, tx, ty, n, H) {
    const spots = [[tx, ty], ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [tx + dx, ty + dy])
      .filter(([x, y]) => (x === a.x && y === a.y) || free(s, x, y, H))
      .sort((p, q) => H.dist(s, a.x, a.y, ...p) - H.dist(s, a.x, a.y, ...q))];
    return spots.slice(0, n);
  }
  // Sheltered by a panel: standing adjacent to it (cover applies to lines crossing toward an adjacent target).
  const panelShelters = (s, b) => live(s).filter((u) => !u.defeated && Math.abs(u.x - b.x) + Math.abs(u.y - b.y) === 1);
  // The ground route is cut: the straight line between two units crosses blocking, water or hazardous ground
  // (INVENTION-ORIG-3: a straight-line proxy — classH carries no pathfinder; Mala to rule on full pathing).
  function groundCut(s, a, u, H) {
    if (typeof H.line !== "function") return false;
    return H.line(a.x, a.y, u.x, u.y).slice(1, -1).some(([x, y]) => {
      const t = H.tileAt(s, x, y);
      return t.blocksMove || (t.tags || []).includes("water") || (t.hazard || 0) > 0 || (typeof H.waterAt === "function" && H.waterAt(s, x, y));
    });
  }
  // Paladin re-spec (PALADIN.md; every value there is sourced or a builder's pick): Lay on Hands' pool, the Hymn, Unbroken Oath, Oathbound.
  const PALADIN = { handsPool: 30, handsHeal: 10, faithPf: 2, hymnTurns: 3, hymnRadius: 3, hymnHeal: 5, hymnHurt: 5, oathMul: 1.5, unbrokenMul: 0.9, smiteBase: 7, smiteStep: 2, smiteMaxSteps: 3, reswearTurns: 1, zealDream: 1.3, zealInDream: 1.2 };
  // Full turns the unbroken oath has held (Smite grows by these; Keep Faith needs 2).
  const keptTurns = (a) => { const o = oathOf(a); return o ? Math.max(0, a.ownerTurns - o.swornTurn) : 0; };
  // Holy (docs/holy.md): how much holy power a source carries right now. A Paladin's deepens with each full turn the oath has held (the steps Smite grows by, up to
  // `cap`) and is gone while the oath is broken or unsworn (live false); anyone else carries it at step 0, live.
  const holyOf = (a, cap = 3) => holdsPaladin(a) ? (oathOf(a) ? { step: Math.min(cap, keptTurns(a)), live: true } : { step: 0, live: false }) : { step: 0, live: true };
  // An oath of your own: allowed with none sworn, or one full turn after a break (a broken oath was "never again" before the re-spec).
  const oathClaim = (s, a) => { const o = st(a).oath; if (!o || !o.broken) return o ? "You have already sworn an oath." : true; return a.ownerTurns - (o.brokenTurn ?? -99) >= PALADIN.reswearTurns || "The oath just broke: wait one full turn to swear again."; };
  // The bodyguard half of the oath (PALADIN.md section 2, Protection): while the oath holds and the ward lives, one single-target hit a round on the ward
  // is intercepted by the Paladin at no reaction (Oathbound), landing x0.6 (Unbroken Oath). It never downgrades stronger cover. Fields and blasts are not stepped into.
  const coverWard = (s, a, w) => {
    if (!w || w.defeated || !oathOf(a)) return;
    const cur = st(w).intercept;
    if (active(cur, w) && cur.uses > 0 && !(cur.standing && cur.by === a.id)) return;   // never over stronger cover, nor over the reserve Oath of the Shield's own (9 uses, x0.5, 3 turns)
    st(w).intercept = { by: a.id, uses: 1, mul: 1, until: w.ownerTurns + 1, skipBlast: true, oathbound: true, standing: true };
  };
  function swearOath(s, a, tgt, merge, H) {
    if (st(a).oath?.broken) st(a).oath = null;   // a fresh oath after a break (oathClaim allowed it)
    const o = st(a).oath || (st(a).oath = { swornTurn: a.ownerTurns, broken: false, merge: false, wardLine: 0.5, lastPos: [a.x, a.y], lastDist: 99 });
    o.ward = tgt ? tgt.id : null;
    o.wardLine = tgt ? Math.min(0.5, tgt.lf / Math.max(1, tgt.maxLF)) : 0.5;
    if (merge) o.merge = true;
    if (tgt) coverWard(s, a, tgt);
    if (o.lastPos == null) { o.lastPos = [a.x, a.y]; o.lastDist = Math.min(99, ...live(s).filter((u) => u.side !== a.side).map((u) => H.dist(s, a.x, a.y, u.x, u.y))); }
  }
  // ── Cleric: recipient-held vows. Where the Paladin's oath binds the oath-taker, a vow binds the
  // BLESSED: the ally holds it, and breaking it ends what the vow carried. Status-driven and generic:
  // any unit carrying an unbroken vow behaves the same; only the Cleric's kit grants them. ──
  const CLERIC = { blessWard: 10, blessMul: 1.2, blessUses: 2, vowTurns: 2, handsHeal: 12, handsAp: 25, chorusMul: 1.5, chorusAp: 25, covenantHeal: 8, covenantMul: 1.2, blessRange: 4, congregate: 2 };
  const pledgeOf = (u) => (u && st(u).pledge && !st(u).pledge.broken && active(st(u).pledge, u) ? st(u).pledge : null);
  const pledgeKept = (u) => !!pledgeOf(u);   // fearless consults this (negate hypothesis: no fear under a kept vow)
  const blessingsFrom = (s, id) => live(s).filter((u) => u.id !== id && pledgeOf(u)?.by === id && active(st(u).blessing, u));
  const congregationApplies = (s, a) => blessingsFrom(s, a.id).length >= CLERIC.congregate;   // congregation: blessings on 2+ allies at once each cost 1 less ΦF, returned after the cast
  function pledgeBreach(s, u, reason, H) {
    const v = st(u).pledge; if (!v || v.broken) return;
    v.broken = true;
    st(u).blessing = null; st(u).sanctuary = null;   // breaking it ends it (INVENTION-CLERIC-1: the ward Blessing raised goes with it)
    if (st(u).ward?.owner === v.by && st(u).ward?.label === "Blessing") st(u).ward = null;
    H.log(s, { kind: "effect", actor: u.id, text: `${u.name}'s vow breaks (${reason}); the blessing ends with it.`, why: ["Keeping a vow extends the blessing a turn; breaking it ends it."] });
  }
  function grantPledge(s, giver, tgt, kind, H, extra = {}) {
    st(tgt).pledge = { by: giver.id, kind, broken: false, until: tgt.ownerTurns + CLERIC.vowTurns, lastPos: [tgt.x, tgt.y],
      lastDist: Math.min(99, ...live(s).filter((u) => u.side !== tgt.side).map((u) => H.dist(s, tgt.x, tgt.y, u.x, u.y))), ...extra };
  }
  // ── Bastet: Pounce from Stillness. Needs her Focus on the target and a free tile beside it. ──
  const focusedOn = (a, foe) => !!foe && ((a.focus && a.focus.target === foe.id && a.focus.expiresAt > a.ownerTurns) || (a.status?.attention?.target === foe.id && a.status.attention.expiresAt > a.ownerTurns));
  function pounceSpot(s, a, foe, range, H) {
    let best = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = foe.x + dx, y = foe.y + dy, here = x === a.x && y === a.y;
      if (!here && !free(s, x, y, H)) continue;
      if (H.tileAt(s, x, y).hazard) continue;
      const d = H.dist(s, a.x, a.y, x, y);
      if (d <= range && (!best || d < best.d)) best = { at: [x, y], d };
    }
    return best;
  }

  // ── Rogue: cut what the mark carries, pocket it, fence it. Status-driven and generic: any unit carrying
  // cut goods, a pocket, or a disarm behaves the same; only the Rogue's kit grants them. ──
  const ROGUE = { cacheCap: 3, cutBlindTurns: 1, disarmTurns: 2, heistCuts: 2,
    fencePhiShare: 0.5,   // INVENTION-ROGUE-1: fast focus pays half the loot sell value (the brokenSellShare precedent halves degraded goods too)
    commonSell: 12,   // INVENTION-ROGUE-2: fallback rates when item data is unavailable (the common loot sell price)
    buffKeys: ["guard", "ward", "parry", "membrane"],   // INVENTION-ROGUE-3: a liftable buff is one of these four mitigations (the Buy Out protection list minus intercept, which is a person stepping in, and minus anchor, which is positional and doesn't travel)
    spawnKeys: new Set(["maxLFAdd", "startingUltimateCharge", "battleSlotsAdd"]) };   // passives consumed at spawn: stripping them later changes nothing, so Disarm leaves them
  const isRogue = (u) => pairIs(u, "pruning", "extraction");
  const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  // Best-first by rarity, then id (deterministic); stash-only goods stay (the thief's bestConsumable precedent).
  function rogueBestGoods(t, H, n) {
    const defs = H.accountItems?.consumables;
    const rank = (id) => RARITY_RANK[defs?.[id]?.rarity] ?? 0;
    return (t.inventory || [])
      .filter((id) => !defs || !defs[id] || !defs[id].outsideBattle)
      .sort((x, y) => rank(y) - rank(x) || String(x).localeCompare(String(y)))
      .slice(0, n);
  }
  const rogueSell = (H, item) => H.accountItems?.rarities?.[H.accountItems?.consumables?.[item]?.rarity]?.sell ?? ROGUE.commonSell;
  const rogueBuffLive = (v, u) => !!v && (v.until == null || v.until >= u.ownerTurns) && (v.expiresAt == null || v.expiresAt >= u.ownerTurns);
  const rogueBuffOf = (u) => ROGUE.buffKeys.find((k) => rogueBuffLive(u.status?.[k], u)) || null;
  // INVENTION-ROGUE-4: Disarm strips the first non-default lens profile (concept order), else the first live gear passive (alphabetical).
  function rogueStripLens(t, H) {
    for (const concept of Object.keys(t.lens || {}).sort()) {
      const profile = t.lens[concept], dflt = H.C?.concepts?.[concept]?.lens?.default || "balanced";
      if (profile && profile !== dflt) return { concept, profile, dflt };
    }
    return null;
  }
  function rogueStripGear(t) {
    for (const key of Object.keys(t.passives || {}).sort()) {
      if (ROGUE.spawnKeys.has(key)) continue;
      return { key, value: t.passives[key] };
    }
    return null;
  }
  // Pocketed goods: inventory items the pocket can vouch for (multiset intersection with status.pocketed).
  function roguePocketed(a) {
    const vouched = [...(st(a).pocketed || [])];
    return (a.inventory || []).filter((id) => { const i = vouched.indexOf(id); if (i < 0) return false; vouched.splice(i, 1); return true; });
  }
  const rogueFenceBest = (held, H) => held.slice().sort((x, y) => rogueSell(H, y) - rogueSell(H, x) || String(x).localeCompare(String(y)))[0];
  function rogueCutBlind(s, t) { st(t).cutBlind = { until: t.ownerTurns + ROGUE.cutBlindTurns }; }
  function rogueVanishStep(s, a, tgt, H) {   // INVENTION-ROGUE-5: the heist step lands on the free neighbor farthest from the mark (rotation order breaks ties); boxed in, the Rogue vanishes in place
    const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [a.x + dx, a.y + dy])
      .filter(([x, y]) => free(s, x, y, H));
    steps.sort((p, q) => H.dist(s, q[0], q[1], tgt.x, tgt.y) - H.dist(s, p[0], p[1], tgt.x, tgt.y));
    return steps[0] || null;
  }

  // ── gates on any ability or move ──
  function beforeAbility(s, a, m, H) {
    const performanceError=Performers.beforeAbility(s,a,m); if(performanceError)return performanceError;
    const stealthError=Stealth.beforeAbility(s,a,m); if(stealthError)return stealthError;
    const guestError=Guests?.beforeAbility?.(s,a,m); if(guestError)return guestError;
    const monkeyError=Monkey.beforeAbility(s,a,m); if(monkeyError)return monkeyError;
    const martialError=Martial.beforeAbility(s,a,m); if(martialError)return martialError;
    const teleologyError=Teleology.beforeAbility(s,a,m); if(teleologyError)return teleologyError;
    const miseError=Mise.beforeAbility(s,a,m); if(miseError)return miseError;
    const actorError=Actor.beforeAbility(s,a,m,H); if(actorError)return actorError;
    Law.beforeAbility(s,a,m,H);   // Laws of Gods of Men: taxed acts go on the ledger
    if (active(st(a).detained, a)) return "Detained: no actions until the hold ends.";
    if (active(st(a).petrified, a)) return "Petrified: stone cannot act.";
    const w = wire[m.id || m.ability];
    if (st(a).overpressure && !w?.relief) return `${a.name}'s boiler is overpressure: vent it (Blow-off) before anything else, or it overheats.`;
    if (w?.kind === "culturalMoment" && a.hype?.momentUsed) return "A Cultural Moment happens once per battle.";
    if (w?.kind === "paperRoute" && st(a).paperBurn) return "Paper Route is sealed for the battle (burned).";
    if (w?.needs) { const r = needsMet(s, a, w, H); if (r !== true) return r; }
    const law = st(a).contract;
    if (active(law, a) && !active(st(a).exempt, a)) {
      const breach = (law.terms === "noUltimate" && m.tier === "ultimate") || (law.terms === "noLine" && m.delivery === "line");
      if (breach) { // the breach happens and the penalty lands; the technique still goes
        H.hit(s, H.actor(s, law.owner) || a, a, null, law.penalty, [`${a.name} breaks the declared terms (${law.terms === "noUltimate" ? "no ultimates" : "no lines"}): the penalty lands.`], { label: "Breach", damageType: "citrinitas" });
        H.addStun(s, H.actor(s, law.owner) || a, a, 20);
      }
    }
    const sil = st(a).silenced;
    if (active(sil, a) && m.damageType === sil.channel) return `Silenced in ${sil.channel} until your next turn (Typed Channel).`;
    const dep = st(a).dependent;
    if (active(dep, a) && (m.tier === "ultimate" || m.tier === "refined")) {
      const v = H.actor(s, dep.on);
      if (v && !v.defeated && H.dist(s, a.x, a.y, v.x, v.y) > 4) return `${m.name} needs what the Villain holds: get within 4 of ${v.name}.`;
    }
    if (m.tier === "ultimate" || m.timing === "delayed" || m.announce) S(s).committed[a.id] = s.round;
    return null;
  }
  function beforeMove(s, a) {
    { const x = Law.beforeMove(s, a); if (x) return x; }   // Exile's Gate
    if (active(st(a).petrified, a)) return "Petrified: stone cannot move.";   // stone subsumes any hold underneath it
    const h = st(a).held, holder = h && s.actors[h.by];
    if (active(h, a) && h.freedoms.includes("move") && holder && !holder.defeated && (h.gaze || Math.abs(holder.x - a.x) + Math.abs(holder.y - a.y) <= 1))
      return h.gaze ? `${holder.name}'s gaze holds you in place (break the sight line: berm, wall, smoke, or a reflection).` : `${holder.name}'s hold keeps you from moving (break contact: resonance, a shove on them, or wait it out).`;
    if (active(st(a).detained, a)) return "Detained: no moving until the hold ends.";
    if (active(st(a).cuffed, a)) return "Cuffed: no moving until the cuffs come off.";
    if (active(st(a).halted, a)) return "Halted: hold still until the order lapses.";
    const v = st(a).vow;
    if (active(v, a) && v.restriction === "noMove") return "Your Binding Term forbids moving (break it and you're stunned).";
    return null;
  }

  // ── targeting for classEffect abilities ──
  // Sanjeevani (Hanuman): land on the open tile beside the ally nearest to where he starts; the herb works on his side within
  // the radius of that ally (the mountain comes down where the wounded lie). The revive is once a battle per Hanuman, and only
  // for a fallen ally whose tile nobody stands on.
  // Ravana's chariot: the open tile within `fly` of him, with an open tile beside it for the captive, that leaves the captive
  // farthest from their own side (ties: the first found, scanning from the top row). lonely = that distance.
  function abductTo(s, a, t, w, H) {
    const open = (x, y) => H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove && !H.barrierAt(s, x, y) && !Object.values(s.actors).some((u) => !u.defeated && u.id !== a.id && u.id !== t.id && u.x === x && u.y === y);
    const friends = Object.values(s.actors).filter((u) => !u.defeated && u.side === t.side && u.id !== t.id);
    let best = null;
    for (let y = 0; y < s.arena.map.length; y++) for (let x = 0; x < s.arena.map[0].length; x++) {
      if (Math.max(Math.abs(x - a.x), Math.abs(y - a.y)) > w.fly || !open(x, y)) continue;
      const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).find(([bx, by]) => open(bx, by)); if (!beside) continue;
      const lonely = friends.length ? Math.min(...friends.map((f) => Math.max(Math.abs(f.x - beside[0]), Math.abs(f.y - beside[1])))) : w.fly;
      if (!best || lonely > best.lonely) best = { me: [x, y], them: beside, lonely };
    }
    return best;
  }
  // Rama's Brahmastra: has a's side learned a weakness card of t (Observe, Insight, an Index Entry)? Open weakness cards count.
  const weaknessKnown = (s, a, t, H) => { const cards = (s.insight?.decks?.[t.id]?.cards || []).filter((c) => c.kind === "weakness"); if (!cards.length) return false;
    const seen = Object.values(s.actors).filter((u) => u.side === a.side).flatMap((u) => H?.Observation?.knowledge?.(s, u)?.[t.id]?.revealed || []);   // anyone on his side: his Observe, Jambavan's index
    return cards.some((c) => c.open || seen.includes(c.id)); };
  // A state an ally holds that the State Kit lets Remember What You Are break (Hanuman's Forgotten).
  const forgotten = (u, H) => !!H?.States && Object.keys(u?.states || {}).some((id) => (H.States.defOf(id)?.breakers || []).some((b) => b.ability === "rememberWhatYouAre"));
  function landingBeside(s, a, t, H) {
    return [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => [t.x + dx, t.y + dy])
      .filter(([x, y]) => (x === a.x && y === a.y) || free(s, x, y, H)).sort((p, q) => H.dist(s, a.x, a.y, ...p) - H.dist(s, a.x, a.y, ...q))[0] || null;
  }
  const herbReach = (s, a, at, w, H) => Object.values(s.actors).filter((u) => u.side === a.side && !u.notArrived && !u.summon && H.dist(s, at[0], at[1], u.x, u.y) <= w.radius);
  function carryMountain(s, a, t, w, H, say) {
    const spot = landingBeside(s, a, t, H); if (!spot) { say(`${a.name} finds nowhere to land beside ${t.name}.`); return; }
    a.x = spot[0]; a.y = spot[1];
    const healed = [];
    const centre = [t.x, t.y];
    for (const u of herbReach(s, a, centre, w, H)) {
      if (u.defeated) continue;
      const got = Math.max(0, Math.min(Math.round(u.maxLF * w.healFrac), u.maxLF - u.lf));
      if (got > 0) { u.lf += got; healed.push(`${u.name} +${got}`); H.States?.healed(s, u, got); }
    }
    let raised = null;
    if (!st(a).sanjeevaniRevived) {
      raised = herbReach(s, a, centre, w, H).find((u) => u.defeated && u.id !== a.id && !H.actorAt(s, u.x, u.y)) || null;
      if (raised) { st(a).sanjeevaniRevived = s.round; raised.defeated = false; raised.lf = Math.max(1, Math.round(raised.maxLF * w.reviveFrac)); }
    }
    say(`${a.name} sets the herb mountain down beside ${t.name}${healed.length ? `: ${healed.join(", ")} LF` : ""}${raised ? `. ${raised.name} gets up (${raised.lf}/${raised.maxLF} LF)` : ""}.`,
      ["Sanjeevani: everyone on his side within " + w.radius + " of " + t.name + " recovers " + Math.round(w.healFrac * 100) + "% of max LF; one fallen ally rises, once a battle."]);
  }
  // What the herb would do from the best landing beside this ally: LF restored, plus a lot for a fallen ally it would raise.
  function mountainValue(s, a, t, w, H) {
    const spot = landingBeside(s, a, t, H); if (!spot) return 0;
    let v = 0;
    for (const u of herbReach(s, a, [t.x, t.y], w, H)) {
      if (u.id === a.id) continue;   // he is healed only if he lands in reach; the value counts the others
      if (u.defeated) { if (!st(a).sanjeevaniRevived && u.id !== a.id && !H.actorAt(s, u.x, u.y)) v += 14; continue; }
      v += Math.min(Math.round(u.maxLF * w.healFrac), u.maxLF - u.lf) * (u.lf <= u.maxLF * 0.3 ? 0.6 : 0.35);
    }
    return v >= 6 ? v : 0;   // not worth the bar for a scratch
  }
  function target(s, a, m, tx, ty, H) {
    const performanceTarget=Performers.target(s,a,m,tx,ty,H); if(performanceTarget)return performanceTarget;
    const stealthTarget=Stealth.target(s,a,m,tx,ty,H); if(stealthTarget)return stealthTarget;
    const policeTarget=Police.target(s,a,m,tx,ty,H); if(policeTarget)return policeTarget;
    const lawTarget=Law.target(s,a,m,tx,ty,H); if(lawTarget)return lawTarget;
    const monkeyTarget=Monkey.target(s,a,m,tx,ty,H); if(monkeyTarget)return monkeyTarget;
    const guestTarget=Guests?.target?.(s,a,m,tx,ty,H); if(guestTarget)return guestTarget;
    const martialTarget=Martial.target(s,a,m,tx,ty,H); if(martialTarget)return martialTarget;
    const teleologyTarget=Teleology.target(s,a,m,tx,ty,H); if(teleologyTarget)return teleologyTarget;
    const miseTarget=Mise.target(s,a,m,tx,ty,H); if(miseTarget)return miseTarget;
    const directorTarget=Director.target(s,a,m,tx,ty,H); if(directorTarget)return directorTarget;
    const w = wire[m.id || m.ability]; if (!w || w.effect !== "classEffect") return null;
    if (["tmMark", "tmEffigy", "tmLong", "tmPack"].includes(w.kind) && !s.rules.tamer) return { ok: false, error: "The tamer's craft is switched off (rules.tamer)." };   // a sim baseline
    const fail = (error) => ({ ok: false, error });
    if (st(a).overpressure && !w.relief) return fail(`${a.name}'s boiler is overpressure: vent it (Blow-off) before anything else, or it overheats.`);
    const r = needsMet(s, a, w, H); if (r !== true) return fail(r);
    if (w.kind === "callKin" && st(a).kinCalled) return fail("Her call has gone out once this battle.");   // Sita: before the self-target return below
    if (w.kind === "callKin" && !H.Hires?.kinFor(s, a)) return fail("There is no one left to call: her house is already here.");
    { const e = Esker.target(s, a, w, tx, ty, H); if (e) return e; }   // Esker (classes/esker.js)
    { const e = Homology?.target(s, a, w, tx, ty, H); if (e) return e; }   // Homology: the aimed enemy, in range (graph/homology-rules.js; absent in a page that does not load it)
    { const e = HotPot.target(s, a, w, tx, ty, H); if (e) return e; }   // the Hot Pot Berserker (classes/hot-pot.js)
    { const e = Suits?.target?.(s, a, w, tx, ty, H); if (e) return e; }   // Posterity suits
    if (w.kind === "shimmer") {   // Glamour's Shimmer: a unit on your side (yourself included) within range
      const occ = H.actorAt(s, tx, ty) || (tx === a.x && ty === a.y ? a : null);
      if (!occ || occ.defeated || occ.side !== a.side) return fail("Shimmer veils yourself or an ally.");
      return { ok: true, tiles: [[occ.x, occ.y]], targets: [occ.id] };
    }
    if(w.kind==="artistDeploy" && (a.status?.artistDeployments??2)<=0)return fail("Both workstation deployments are spent.");
    if(["artistCalibrate","artistEngine","artistCompile"].includes(w.kind) && !artistTool(s,a,H))return fail("An active accessible own workstation must be within two tiles.");
    if(w.kind==="artistCalibrate" && active(a.status?.artistCalibration,a))return fail("A calibration is already prepared.");
    if(w.kind==="artistCompile" && !active(a.status?.artistBuffer,a))return fail("Compile the Canvas needs an active raster program.");
    if(w.kind==="artistBatch" && !active(a.status?.artistBuffer,a))return fail("Batch Render needs an active raster program.");
    if(w.kind === "cyphService" && (a.status?.cyphStock ?? 3) <= 0) return fail("Cyph's three service portions are spent.");
    if(["cyphBar","cyphPocket","cyphFinal","cyphCurated"].includes(w.kind)) {
      if(tx==null||!H.inside(s,tx,ty)||H.dist(s,a.x,a.y,tx,ty)>w.range)return fail("Out of Cyph’s range.");
      const enemy=H.actorAt(s,tx,ty);if(!enemy||enemy.side===a.side)return fail("Choose an opponent.");
      const pool=H.cyphBars(s,a,tx,ty);
      if(!pool.length)return fail("No borrowed bar can reach that opponent from here.");
      const held=a.status?.cyphPocket;
      if(w.kind==="cyphPocket" && held && held.until>=a.ownerTurns && !pool.some(x=>x.id===held.id))return fail("The pocket verse cannot reach that target; change position or wait for expiry.");
    }
    if (w.kind === "platformShift") { const P = platformOf(s, a); if (!P) return fail("The platform is gone."); if (P.shifted) return fail("Platform Shift happens once per battle."); if (!P.links.length) return fail("Platform Shift needs at least one link to sever."); }
    if (w.kind === "paperBurnout" && st(a).paperBurn) return fail("The route is already burned: Paper Route stays sealed for the battle.");
    if (w.kind === "studyPass" && !canPass(a)) return fail(!isStudent(a) ? "Only a Student studies." : (a.study?.passes || 0) >= STUDY.ranks[STUDY.ranks.length - 1].at ? "There is nothing left to pass." : `Passing a class takes ${STUDY.cost} Inspiration.`);
    if (w.kind === "docStabilize" && !triage(s, a, H)) return fail(st(a).lastPatient && live(s).some((u) => u.id === st(a).lastPatient && u.lf < u.maxLF) ? "Triage: never the same patient twice running, and nobody else within 3 needs treating." : "Nobody within 3 needs treating.");
    if (w.kind === "oilGusher" && !barrelsOf(a)) return fail("Gusher burns barrels, and the reserves are empty.");
    if (w.kind === "platformAccept" && !offerOf(a)) return fail("There is no offer to accept.");
    if (["circuitRead", "circuitPulse", "circuitNetwork"].includes(w.kind)) { const R = s.rules.circuit, K = circuitOf(s, a); if (!R) return fail("The circuit is switched off.");
      sampleCircuits(s, H);
      if (w.kind === "circuitRead") {
        if (K.loop) return fail("A living circuit is already running: it cannot be replaced, only waited out or broken.");
        if (K.deployments >= R.deployments) return fail(`${R.deployments} readings a battle, and both are spent.`);
        const o = (s.arena.objects || []).find((p) => p.x === tx && p.y === ty);
        if (!livingPlant(o)) return fail("Read a living plant: the circuit needs an organism to anchor on.");
        if (!ownerReaches(s, a, o, H)) return fail(`The plant must be within ${R.anchorRange} and in sight (of him, or of one of his towers).`);
        if (!live(s).some((u) => u.side === a.side && memberReaches(s, u, o, H))) return fail(`Nobody on his side is within ${R.memberRange} of that plant.`);
        return { ok: true, tiles: [[tx, ty]], targets: [] }; }
      const L = K.loop; if (!L) return fail("There is no living circuit to work through: read one first.");
      if (w.kind === "circuitNetwork") { if (K.networkUsed || L.network) return fail("One Homeostatic Network a battle."); return tx === a.x && ty === a.y ? { ok: true, tiles: [[a.x, a.y]], targets: [a.id], self: true } : fail("Target yourself."); }
      const u = H.actorAt(s, tx, ty), m = u && L.members[u.id];
      if (!m || !m.connected) return fail("Choose someone linked into the circuit.");
      if (!(Math.min(R.pulse, m.error, u.maxLF - u.lf, L.budget) > 0)) return fail(L.budget <= 0 ? "The reservoir is empty." : `${u.name} has no new injury the circuit saw.`);
      return { ok: true, tiles: [[tx, ty]], targets: [u.id] }; }
    if (w.kind === "holoSwarm") { if (!towersOf(s, a).length) return fail("The swarm needs at least one tower to project from."); return tx === a.x && ty === a.y ? { ok: true, tiles: [[a.x, a.y]], targets: [a.id], self: true } : fail("Target yourself."); }
    if (w.kind === "droneStation") { const R = s.rules.droneTowers; if (!R) return fail("Drone towers are switched off.");
      if (towersOf(s, a).length >= R.max) return fail(`${R.max} towers at most: lose one first.`);
      if (tx == null || !H.inside(s, tx, ty)) return fail("Choose an object to build on.");
      if (H.dist(s, a.x, a.y, tx, ty) > R.placeRange) return fail(`Out of range (${R.placeRange}).`);
      const o = (s.arena.objects || []).find((p) => p.x === tx && p.y === ty);
      if (!o) return fail("A drone tower is anchored on something: a tree, a shrub, a bench, a building.");
      if (o.tower) return fail("There is already a tower there.");
      if (!anchorable(o)) return fail(`${o.name || o.type} cannot carry a tower: it can never be cleared.`);
      return { ok: true, tiles: [[tx, ty]], targets: [] }; }
    if (w.kind === "platformDataCenter") { const R = s.rules.dataCenter;
      if (!R || a.character !== R.of) return fail("Only the Tech Billionaire raises a data center.");
      if (centerOf(s, a)) return fail("Your data center is still standing: one at a time.");
      if ((a.inspiration || 0) < R.inspiration) return fail(`Raising a data center takes ${R.inspiration} Inspiration.`);
      if (tx == null || !H.inside(s, tx, ty)) return fail("Choose a tile.");
      if (H.dist(s, a.x, a.y, tx, ty) > R.range) return fail(`Out of range (${R.range}).`);
      const no = centerSiteError(s, tx, ty, H); return no ? fail(no) : { ok: true, tiles: [[tx, ty]], targets: [] }; }
    if (w.target === "self") return tx === a.x && ty === a.y ? { ok: true, tiles: [[a.x, a.y]], targets: [a.id], self: true } : fail("Target yourself.");
    if (tx == null || !H.inside(s, tx, ty)) return fail("Choose a tile.");
    const d = H.dist(s, a.x, a.y, tx, ty);
    if (d > w.range) return fail(`Out of range (${w.range}).`);
    const occ = H.actorAt(s, tx, ty);
    if (w.kind === "abduct" && occ && occ.side !== a.side && occ.massive) return fail(`${occ.name} is too large to carry off.`);   // Ravana (after occ is known)
    if (w.kind === "abduct" && occ && occ.side !== a.side && !abductTo(s, a, occ, w, H)) return fail("The chariot has nowhere to land.");
    if (w.kind === "tmMark") {   // one of his own tamed beasts, or his own effigy, with no living vessel already marked
      const eff = !occ && (s.arena.objects || []).find((o) => o.x === tx && o.y === ty && o.effigy?.owner === a.id && (o.hp ?? 0) > 0);
      if (!eff && (!occ || occ.beast?.owner !== a.id || !occ.beast.tamed)) return fail("Mark one of your own tamed beasts, or your effigy.");
      if (H.vesselOf?.(s, a)) return fail("You already have a living vessel.");
      return { ok: true, tiles: [[tx, ty]], targets: occ ? [occ.id] : [] };
    }
    if (w.kind === "tmEffigy") {
      if ((s.arena.objects || []).some((o) => o.effigy?.owner === a.id && (o.hp ?? 0) > 0)) return fail("Your effigy is still standing.");
      if (occ || H.tileAt(s, tx, ty).blocksMove || (s.arena.objects || []).some((o) => o.x === tx && o.y === ty)) return fail("Choose open ground.");
      return { ok: true, tiles: [[tx, ty]], targets: [] };
    }
    if (w.kind === "ferrySwap") {   // Ferryman: a willing ally in range (4, 5 with Strong Back); never himself, never a foe
      const R = 4 + (hasT(a, "strongBack") ? 1 : 0);
      if (H.dist(s, a.x, a.y, tx, ty) > R) return fail(`Out of ferry range (${R}).`);
      if (!occ || occ.side !== a.side || occ.id === a.id || occ.defeated) return fail("Ferry a living ally (not yourself).");
      return { ok: true, tiles: [[tx, ty]], targets: [occ.id] };
    }
    if (w.kind === "diveDescend") {   // Pearl Diver: slip to open ground ending on/beside her water (in place counts: still water hides everything)
      if (H.tileAt(s, tx, ty).blocksMove || (occ && occ.id !== a.id)) return fail("Descend to open ground.");
      if (!diverInWater(s, a, tx, ty, H)) return fail("End on or beside one of your basins, or on water.");
      return { ok: true, tiles: [[tx, ty]], targets: [] };
    }
    if (w.kind === "diveUndertow") {   // Pearl Diver: a foe she can see, dragged toward her nearest basin
      if (!diverBasins(s, a).length) return fail("Undertow needs one of your basins to drag toward.");
      if (!occ || occ.side === a.side || occ.defeated) return fail("Drag a living foe.");
      if (!H.hasSight(s, a.x, a.y, tx, ty)) return fail("No line to drag along.");
      return { ok: true, tiles: [[tx, ty]], targets: [occ.id] };
    }
    if (w.kind === "diveDrown") {   // Pearl Diver: burst one of her own basins in reach
      if (!diverBasins(s, a).some((b) => b.x === tx && b.y === ty)) return fail("Burst one of your own basins.");
      return { ok: true, tiles: [[tx, ty]], targets: [] };
    }
    if (w.kind === "seedCache" || w.kind === "seedBloom") {   // Seedkeeper: bury under open ground or allies, never foes; capped per kind
      const role = w.kind === "seedCache" ? "seed-cache" : "seed-bloom";
      const cap = w.kind === "seedCache" ? (hasT(a, "cacheMinded") ? 4 : 3) : 2;
      if ((s.arena.objects || []).filter((o) => o.role === role && o.owner === a.id).length >= cap) return fail(`No room to bury: ${cap} ${w.kind === "seedCache" ? "caches" : "blooms"} already in the ground.`);
      if (occ && occ.side !== a.side) return fail("Bury under open ground or your own side, not a foe.");
      if (H.tileAt(s, tx, ty).blocksMove || (s.arena.objects || []).some((o) => o.x === tx && o.y === ty)) return fail("Choose ground with nothing buried in it yet.");
      return { ok: true, tiles: [[tx, ty]], targets: [] };
    }
    if (["docCourse", "docDiagnose", "docConfirm", "docFull"].includes(w.kind)) {   // an ally, or the Doctor himself
      if (!occ || occ.side !== a.side) return fail("Choose a patient on your side.");
      if (w.kind === "docCourse") { const r = occ.status?.recovery; if (!r) return fail(`${occ.name} has no recovery to continue: Stabilize first.`); if (r.stage >= 3) return fail("That recovery is already complete."); }
      if (w.kind === "docDiagnose" && occ.status?.diagnosed) return fail(`${occ.name} already has a diagnosis.`);
      if (w.kind === "docConfirm") { const d = occ.status?.diagnosed; if (!d) return fail(`${occ.name} has no diagnosis to confirm.`); if (d.confirmed) return fail("That diagnosis is already confirmed.");
        if (occ.id !== a.id && !H.hasSight(s, a.x, a.y, tx, ty)) return fail("A second opinion needs your own line of sight to the patient."); }
      if (w.kind === "docFull" && occ.status?.recovery) return fail(`${occ.name} is already recovering.`);
      return { ok: true, tiles: [[tx, ty]], targets: [occ.id] };
    }
    if (w.kind === "robotTalk") {
      if (!Object.values(s.actors).some((u) => !u.defeated && isRobot(u))) return fail("There is no machine on the field to speak for.");
      if (st(a).caseTurn === a.ownerTurns) return fail("One case a turn.");
      if (!occ || occ.id === a.id) return fail("Choose someone to talk to.");
      if (occ.wild || occ.dream || occ.ai === "dream" || isRobot(occ)) return fail(`${occ.name} is not someone to persuade.`);
      if (hasT(occ, "robotSympathizer")) return fail(`${occ.name} already agrees.`);
      if (hasT(occ, "robotHater")) return fail(`${occ.name} has made up their mind about machines.`);
      if (occ.heardIdeas?.machineSympathy) return fail(`${occ.name} has heard the case already this battle.`);   // contagious ideas: one hearing a battle
      return { ok: true, tiles: [[tx, ty]], targets: [occ.id] };
    }
    if (w.kind === "oilDrill") { if (barrelsOf(a) >= OIL.barrelCap) return fail(`Reserves are full (${OIL.barrelCap} barrels).`);
      return H.tileAt(s, tx, ty).blocksMove ? fail("Drill into open ground.") : slickAt(s, tx, ty) ? fail("That ground is already running with crude.") : { ok: true, tiles: [[tx, ty]], targets: [] }; }
    if (w.kind === "oilSpill") return slickAt(s, tx, ty) ? { ok: true, tiles: around(s, tx, ty, OIL.spillRadius, H), targets: [] } : fail("Spill spreads a slick that is already there: choose a slick tile.");
    if (w.kind === "oilFlare") { const lit = around(s, tx, ty, OIL.flareRadius, H).filter(([x, y]) => slickAt(s, x, y)); return lit.length ? { ok: true, tiles: lit, targets: [] } : fail("There is no slick there to light."); }
    if (w.kind === "oilBuyOut") { if (!occ || occ.side === a.side) return fail("Choose an opponent.");
      if (!H.hasSight(s, a.x, a.y, tx, ty)) return fail("No line of sight.");
      const q = priceOf(s, occ); if (q.no) return fail(q.no);
      return q.price > barrelsOf(a) ? fail(`${occ.name} costs ${q.price} barrel${q.price === 1 ? "" : "s"}; the reserves hold ${barrelsOf(a)}.`) : { ok: true, tiles: [[tx, ty]], targets: [occ.id] }; }
    if (["platformLink", "platformBridge", "platformLock", "platformDeprecate"].includes(w.kind)) {
      if (!occ || occ.id === a.id) return fail("Choose a unit.");
      const P = platformOf(s, a); if (!P) return fail("The platform is gone.");
      const link = P.links.find((l) => l.id === occ.id);
      if (w.kind === "platformLink") {
        if (link) return fail(`${occ.name} is already on the platform.`);
        if (P.links.length >= PLATFORM.maxLinks) return fail(`The platform holds ${PLATFORM.maxLinks} links at most.`);
        if (linkOf(s, occ)) return fail(`${occ.name} is on another platform.`);
        const no = declines(s, a, occ, P); if (no) return fail(no);
      } else {
        if (!link) return fail(`${occ.name} is not on your platform: Onboard it first.`);
        if (w.kind === "platformBridge" && (pinned(a) || pinned(occ))) return fail("Bridge cannot move a unit that is held, tethered or anchored.");
        if (w.kind === "platformLock" && link.lock) return fail(`${occ.name} is already locked in.`);
        if (w.kind === "platformDeprecate" && occ.side === a.side) return fail("Deprecate withdraws an opponent's dependency.");
        if (w.kind === "platformDeprecate" && !link.lock) return fail(`${occ.name} is not locked in: there is nothing to withdraw.`);
      }
      return { ok: true, tiles: [[tx, ty]], targets: [occ.id] };
    }
    if (w.kind === "trackMove") return !free(s, tx, ty, H) ? fail("Track ends on an open tile.") : trails(s, a).some(([, tr]) => tr.route.some(([x, y]) => x === tx && y === ty)) ? { ok: true, tiles: [[tx, ty]], targets: [] } : fail("Track follows a fresh trail: choose a tile an opponent walked through in sight.");
    if (w.kind === "interceptDash" || w.kind === "callOut") { if (!occ || occ.side === a.side) return fail("Choose an opponent."); return trailOf(s, a, occ) ? { ok: true, tiles: [[tx, ty]], targets: [occ.id] } : fail(`${occ.name} has left no fresh trail.`); }
    if (w.kind === "readSign") return occ && occ.side !== a.side ? { ok: true, tiles: [[tx, ty]], targets: [occ.id] } : fail("Choose an opponent.");   // anywhere, seen or not
    if(w.kind==="artistDeploy" && (!free(s,tx,ty,H)||(s.arena.objects||[]).some(o=>o.x===tx&&o.y===ty)))return fail("Deploy onto an empty passable tile.");
    if(w.kind==="artistMask") {
      if(!occ || occ.side!==a.side || occ.willing===false || active(occ.status?.artistMask,occ))return fail("Choose a willing ally without an active layer mask.");
      return {ok:true,tiles:[[tx,ty]],targets:[occ.id]};
    }
    if (w.kind === "delegate") {
      if (!(occ && occ.side === a.side && occ.id !== a.id)) return fail("Choose an ally.");
      const o = orderOf(occ);
      return o && o.from === a.id ? { ok: true, tiles: [[tx, ty]], targets: [occ.id] } : fail("Delegate the Decision follows an order: Assign the Task on that ally first.");
    }
    if (w.kind === "assign" && !live(s).some((u) => u.side === a.side && u.id !== a.id && !u.notArrived)) return fail("Assign the Task needs an ally to carry the order.");
    if (w.kind === "pounce" && occ && occ.side !== a.side) {
      if (!focusedOn(a, occ)) return fail(`Pounce from Stillness springs from Focus: fix your attention on ${occ.name} first.`);
      if (!H.hasSight(s, a.x, a.y, tx, ty)) return fail("No line of sight.");
      if (!pounceSpot(s, a, occ, w.range, H)) return fail("There is no open tile beside that target within a leap.");
    }
    if (w.kind === "overflight" && occ && occ.side !== a.side) {
      if (st(a).grounded) return fail("Grounded wings can't fly the pass: Take Off first.");
      if (!H.hasSight(s, a.x, a.y, tx, ty)) return fail("No line of sight.");
      if (!overflightSpot(s, a, occ, H)) return fail("Overflight needs a surveyed open tile beside that target: Survey Pass first.");
    }
    if(w.kind==="cyphService" && (occ?.willing===false || active(occ?.status?.cyphCare,occ)))return fail("Choose a willing ally without an active service portion.");
    if ((w.kind === "oath" || w.kind === "oathGuard") && occ && occ.side === a.side && occ.id !== a.id) { const err = wardClaim(s, a, occ); if (err !== true) return fail(err); }
    if (w.kind === "oath" && occ && occ.id === a.id) { const err = oathClaim(s, a); if (err !== true) return fail(err); }
    if (w.kind === "faithWard" && occ && occ.id !== a.id && occ.id !== wardOf(s, a)?.id) return fail("Keep Faith shelters yourself or your living ward.");   // swearing alone: not twice, and not the turn an oath broke
    if (w.kind === "regrade") {   // INVENTION: any dry open ground takes a regrade (cut-and-fill proper needs turf or mulch)
      if (H.tileAt(s, tx, ty).blocksMove || occ || H.barrierAt(s, tx, ty) || (s.arena.objects || []).some((o) => o.x === tx && o.y === ty)) return fail("Regrade needs open ground: no occupants, objects or structures.");
      if (H.waterAt && H.waterAt(s, tx, ty)) return fail("Regrade needs dry open ground.");
      return { ok: true, tiles: [[tx, ty]], targets: [] };
    }
    if (w.kind === "spanShare") {
      const o = (s.arena.objects || []).find((p) => p.x === tx && p.y === ty);
      if (!o || !isStructure(o)) return fail("Share the Span links standing structures: choose a structure.");
      return { ok: true, tiles: [[tx, ty]], targets: [] };
    }
    if (w.kind === "shore") {
      if (occ && occ.side === a.side && occ.id !== a.id) return { ok: true, tiles: [[tx, ty]], targets: [occ.id] };
      const o = (s.arena.objects || []).find((p) => p.x === tx && p.y === ty);
      if (o && isStructure(o)) return { ok: true, tiles: [[tx, ty]], targets: [] };
      return fail("Shore Up braces an ally or a standing structure.");
    }
    if (w.kind === "foldPanel") {   // one crease per tile; never on an occupied surface (the folding precedent)
      if (occ || H.tileAt(s, tx, ty).blocksMove) return fail("Fold the panel onto open ground.");
      if (H.barrierAt(s, tx, ty)) return fail("One crease per tile: a panel already stands there.");
      return { ok: true, tiles: [[tx, ty]], targets: [] };
    }
    if (w.kind === "paperRoute") {
      if (st(a).paperBurn) return fail("Paper Route is sealed for the battle (burned).");
      if (!free(s, tx, ty, H)) return fail("The far endpoint must be walkable and unoccupied.");
      return { ok: true, tiles: [[tx, ty]], targets: [] };
    }
    if (w.kind === "unfold") {
      const panel = (s.barriers || []).find((b) => b.owner === a.id && b.concept === "foldPanel" && b.x === tx && b.y === ty && s.actors[b.owner].ownerTurns < b.expiresAt);
      if (!panel) return fail("Unfold collapses one of your standing folded panels: choose its tile.");
      return { ok: true, tiles: [[tx, ty]], targets: [] };
    }
    if (w.kind === "drainage" || w.kind === "loadPath") return { ok: true, tiles: [[tx, ty]], targets: [] };   // a zone centers anywhere in range, structures included
    if (["clericBless", "clericSanctuary", "clericHands", "clericChorus"].includes(w.kind) && occ && occ.side === a.side && occ.id !== a.id) {
      if (occ.willing === false) return fail(`${occ.name} does not consent: vows and lent actions are taken, never imposed.`);   // consent: the recipient agrees
      const dues = w.kind === "clericHands" ? CLERIC.handsAp : w.kind === "clericChorus" ? CLERIC.chorusAp : 0;
      if (dues && (occ.tempo ?? 0) < dues) return fail(`${occ.name} has no action left to give (needs ${dues} AP).`);   // both spend
    }
    if (w.kind === "brahmastra" && st(a).brahmastraLoosed) return fail("The Brahmastra flies once a battle.");
    if (w.kind === "rememberAlly" && occ && occ.side === a.side && occ.id !== a.id && (st(a).remembered || []).includes(occ.id)) return fail(`${a.name} has already told ${occ.name} what they are.`);
    if (w.kind === "carryMountain" && occ && occ.side === a.side && occ.id !== a.id && !landingBeside(s, a, occ, H)) return fail(`There is nowhere open beside ${occ.name} to set the mountain down.`);
    if (w.target === "ally") return occ && occ.side === a.side && (occ.id !== a.id || w.selfOk) ? { ok: true, tiles: [[tx, ty]], targets: [occ.id] } : fail(w.selfOk ? "Choose an ally (or yourself)." : "Choose an ally.");   // selfOk: the Paladin swears alone and lays hands on himself
    if (w.target === "enemy") return occ && occ.side !== a.side ? (H.hasSight(s, a.x, a.y, tx, ty) ? { ok: true, tiles: [[tx, ty]], targets: [occ.id] } : fail("No line of sight.")) : fail("Choose an opponent.");
    // tiles
    if (w.kind === "steamAdvance" || w.kind === "fullSteam") { const p = steamPath(s, H, a, tx, ty, w.range); return p.error ? fail(p.error) : { ok: true, tiles: [[tx, ty]], targets: [] }; }
    if (w.kind === "shieldFace") return d === 1 ? { ok: true, tiles: [[tx, ty]], targets: [] } : fail("Choose the adjacent tile you face.");
    if (w.kind === "tether") { const anchorOk = H.tileAt(s, tx, ty).blocksMove || H.barrierAt(s, tx, ty) || (occ && occ.side === a.side); return anchorOk ? { ok: true, tiles: [[tx, ty]], targets: [] } : fail("Tether to an anchor: a wall, pillar, tree, construct or ally."); }
    if (w.kind === "earthworks") return free(s, tx, ty, H) ? { ok: true, tiles: [[tx, ty]], targets: [] } : fail("Raise it on clear ground.");
    if (w.kind === "teleport" && w.visited && !(S(s).visited[a.id] || []).some(([x, y]) => x === tx && y === ty)) return fail("Linked Step only reaches tiles you've stood on.");
    if (w.kind === "perch") {   // INVENTION-ORN-2: surveyed + high (height 1+) + open, within 6
      if (!isSurveyed(s, a, tx, ty)) return fail("Perch marks surveyed ground: Survey Pass over it first.");
      if (H.heightAt(s, tx, ty) < 1) return fail("Perch needs a high tile (height 1+).");
    }
    if (w.kind === "swoop") {
      if (st(a).grounded) return fail("Grounded wings can't swoop: Take Off first.");
      if (!perchMarks(a).some(([x, y]) => x === tx && y === ty)) return fail("Swoop reaches your marked landing points: Perch one first.");
    }
    if (["maidSort", "maidProtect", "maidExtract", "maidRestore", "maidSweep"].includes(w.kind)) {
      if (w.kind === "maidSort") return (tx !== a.x || ty !== a.y) && (tx === a.x || ty === a.y) && H.hasSight(s, a.x, a.y, tx, ty) ? { ok: true, tiles: [[tx, ty]], targets: [] } : fail("Sort needs a clear cardinal line through the room.");
      if (w.kind === "maidProtect") return (s.arena.objects || []).some(o => o.x === tx && o.y === ty) || H.actorAt(s, tx, ty)?.side === a.side || H.actorAt(s, tx, ty)?.id === a.id ? { ok: true, tiles: [[tx, ty]], targets: H.actorAt(s, tx, ty) ? [H.actorAt(s, tx, ty).id] : [] } : fail("Choose an object or ally to protect.");
      if (w.kind === "maidExtract") {
        const object = (s.arena.objects || []).find(o => o.x === tx && o.y === ty && o.evidenceId !== "receptacle" && o.role !== "service-receptacle");
        const effect = (s.terrainEffects || []).some(e => (e.tiles || []).some(p => p[0] === tx && p[1] === ty));
        const unit = H.actorAt(s, tx, ty); const otherUnit = unit && unit.id !== a.id;
        const stash = !!(knownTrapAt(s, a, tx, ty, H) || pickupAt(s, tx, ty));
        if (!object && !effect && !otherUnit && !stash) return fail("There is no object, item, known trap, removable effect, or other unit on that tile.");
        const receptacle = receptacleFor(s, a, false);
        if ((object || effect || stash) && (!receptacle || receptacle.hp <= 0)) return fail("An intact service receptacle is required.");
        if ((object || effect || stash) && (receptacle.stored || []).length >= 3 && ![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => free(s, tx+dx, ty+dy, H))) return fail("The receptacle is full and there is no adjacent tile to dump its oldest item onto.");
        return { ok: true, tiles: [[tx, ty]], targets: otherUnit ? [unit.id] : [] };
      }
      if (w.kind === "maidRestore") {
        const t = H.actorAt(s, tx, ty), receptacle = receptacleFor(s, a, false);
        if (!receptacle || receptacle.hp <= 0) return fail("Restore the Working Order needs an intact receptacle.");
        if (!H.hasSight(s, a.x, a.y, tx, ty)) return fail("The interference is out of sight.");
        const canStore = (receptacle.stored || []).length < 3;
        return (receptacleHasContents(s, a) && free(s, tx, ty, H)) || (canStore && (s.terrainEffects || []).some(e => (e.tiles || []).some(p => p[0] === tx && p[1] === ty))) || (canStore && t && Object.entries(t.status || {}).some(([key, value]) => value && !["guard", "anchor", "parry", "drowning", "maidProtected"].includes(key))) ? { ok: true, tiles: [[tx, ty]], targets: t ? [t.id] : [] } : fail("There is no visible interference to restore.");
      }
      if (w.kind === "maidSweep") {
        const receptacle = receptacleFor(s, a, false);
        if (!receptacle || receptacle.hp <= 0) return fail("Empty the Room needs an intact service receptacle.");
        if (!H.hasSight(s, a.x, a.y, tx, ty)) return fail("The announced area is out of sight.");
        const count = (s.arena.objects || []).filter(o => o !== receptacle && !o.protected && H.dist(s, tx, ty, o.x, o.y) <= w.radius).length
          + (s.traps || []).filter(t => !t.spent && H.dist(s, tx, ty, t.x, t.y) <= w.radius && H.Traps?.known(a, t)).length + (s.arena.pickups || []).filter(p => H.dist(s, tx, ty, p.x, p.y) <= w.radius).length;
        return count && count <= 3 - (receptacle.stored || []).length ? { ok: true, tiles: [[tx, ty]], targets: [] } : fail("Choose a visible area with enough free receptacle slots (up to three objects). ");
      }
    }
    if (!w.ignoreTerrain && !free(s, tx, ty, H)) return fail("That tile isn't open.");
    if (w.ignoreTerrain && (H.actorAt(s, tx, ty) || !H.inside(s, tx, ty))) return fail("That tile isn't open.");
    if (active(st(a).arrivalGate, a) && w.kind === "teleport" && live(s).some((u) => u.side !== a.side && H.dist(s, tx, ty, u.x, u.y) <= 1)) return fail("Arrival Gate refuses an endpoint beside an enemy.");
    return { ok: true, tiles: [[tx, ty]], targets: [] };
  }

  // ── resolution for classEffect abilities ──
  function resolve(s, a, inst, H) {
    if(Performers.resolve(s,a,inst,H))return true;
    if(Stealth.resolve(s,a,inst,H))return true;
    if(Police.resolve(s,a,inst,H))return true;
    if(Law.resolve(s,a,inst,H))return true;
    if(Monkey.resolve(s,a,inst,H))return true;
    if(Guests?.resolve?.(s,a,inst,H))return true;
    if(Martial.resolve(s,a,inst,H))return true;
    if(Teleology.resolve(s,a,inst,H))return true;
    if(Mise.resolve(s,a,inst,H))return true;
    if(Homology?.resolve(s,a,inst,H))return true;
    if(Director.resolve(s,a,inst,H))return true;
    if(Actor.resolve(s,a,inst,H))return true;
    let w = wire[inst.ability]; if (!w || w.effect !== "classEffect") return false;
    if (Esker.resolve(s, a, inst, w, H)) return true;   // Esker (classes/esker.js)
    if (HotPot.resolve(s, a, inst, w, H)) return true;   // the Hot Pot Berserker
    if (Suits?.resolve?.(s, a, inst, w, H)) return true;   // Posterity suits
    { const t0 = inst.targets?.[0] ? H.actor(s, inst.targets[0]) : null; if (w.thematic && t0 && w.thematic[t0.character]) w = { ...w, ...w.thematic[t0.character] }; }   // rule 6: stronger for the story partner
    if (w.kind === "forces") { forcesResolve(s, a, inst, H); return true; }   // the Aviator's Four Forces
    if (glamourResolve(s, a, inst, w, H)) return true;   // Glamour: Shimmer, Allure
    const say = (text, why = []) => H.log(s, { kind: "effect", actor: a.id, text, why });
    const until = (n = 1) => a.ownerTurns + n;
    const [tx, ty] = inst.tiles?.[0] || [a.x, a.y];
    const tgt = inst.targets?.[0] ? H.actor(s, inst.targets[0]) : null;
    switch (w.kind) {
      case "artistDeploy": {
        st(a).artistDeployments=(st(a).artistDeployments??2)-1;
        s.arena.objects=(s.arena.objects||[]).filter(o=>!(o.role==="artist-workstation"&&o.owner===a.id));
        s.arena.objects.push({id:`artist-tool-${++s.seq}`,type:"workstation",name:"Digital workstation",role:"artist-workstation",owner:a.id,x:tx,y:ty,hp:18,maxHp:18,cover:0,sightHeight:0,blocksMove:false,material:"metal",expiresAt:a.ownerTurns+3});
        say(`${a.name} deploys a digital workstation at (${tx},${ty}); ${st(a).artistDeployments}/2 deployments remain.`,["One active tool, 18 HP, three owner turns; working radius two."]);break;
      }
      case "artistCalibrate": st(a).artistCalibration={until:until(2),uses:1};say(`${a.name} calibrates one render: ×1.2, no stacking.`);break;
      case "artistMask": st(tgt).artistMask={until:tgt.ownerTurns+2};say(`${a.name} gives ${tgt.name} one albedo-only layer mask: next eligible hit ×0.65.`);break;
      case "artistRaster": case "artistEngine": case "artistCompile": {
        if(w.kind==="artistCompile")delete st(a).artistBuffer;
        H.hit(s,a,tgt,inst,inst.potency*(inst.mult||1),["A bounded render retains the normal channel, cover and damage resolution."],{label:inst.name});
        if(w.kind==="artistRaster")st(a).artistBuffer={until:until(2),program:"rasterPass"};
        say(w.kind==="artistRaster"?`${a.name} holds one raster program for two owner turns.`:w.kind==="artistCompile"?`${a.name} compiles the canvas; the program buffer is spent.`:`${a.name}'s workstation executes one physical render.`);break;
      }
      case "artistBatch": {
        delete st(a).artistBuffer;
        // the target, then the two nearest other enemies within two tiles of it (nearest first, id breaks ties)
        const others=live(s).filter(u=>u.side!==a.side && u.id!==tgt.id && H.dist(s,tgt.x,tgt.y,u.x,u.y)<=2)
          .sort((p,q)=>H.dist(s,tgt.x,tgt.y,p.x,p.y)-H.dist(s,tgt.x,tgt.y,q.x,q.y) || (p.id<q.id?-1:1)).slice(0,2);
        for(const u of [tgt,...others]) if(!u.defeated) H.hit(s,a,u,inst,inst.potency*(inst.mult||1),["One stored program run on a bounded batch; each run resolves as an ordinary hit."],{label:inst.name});
        say(`${a.name} runs the held program on ${1+others.length} target${others.length?"s":""}; the program buffer is spent.`,["Batch Render maps one instruction over at most three inputs."]);break;
      }
      case "cyphService": {
        st(a).cyphStock=(st(a).cyphStock??3)-1;
        st(tgt).cyphCare={until:tgt.ownerTurns+2};
        say(`${a.name} checks the label and offers ${tgt.name} a chosen service portion: next hit ×0.8; ${st(a).cyphStock}/3 portions remain.`,["Voluntary fictional support; no forced intoxication or medical claim."]);break;
      }
      case "cyphBar": case "cyphPocket": case "cyphFinal": case "cyphCurated": {
        const pool=H.cyphBars(s,a,tx,ty);if(!pool.length)break;
        const count=st(a).cyphBarsUsed||0;
        const hash=(Math.imul((s.seed||1)^count^a.ownerTurns,1664525)+1013904223)>>>0;
        let chosen=pool[hash%pool.length],mul=0.85;
        const held=st(a).cyphPocket;
        if(w.kind==="cyphPocket" && !(held&&held.until>=a.ownerTurns)) {
          const drawn=Array.from({length:Math.min(3,pool.length)},(_,i)=>pool[(hash+i)%pool.length]);
          chosen=drawn.sort((x,y)=>y.potency-x.potency||x.id.localeCompare(y.id))[0];
          st(a).cyphPocket={id:chosen.id,until:a.ownerTurns+2};st(a).cyphBarsUsed=count+1;
          say(`${a.name} curates three bars and pockets ${chosen.name} for two turns. Use Pocket Verse again to perform it; no second ΦF fee.`);break;
        }
        if(w.kind==="cyphPocket") {chosen=pool.find(x=>x.id===held.id);mul=1;st(a).cyphPocket=null;}
        if(w.kind==="cyphFinal"||w.kind==="cyphCurated") {chosen=pool.slice().sort((x,y)=>y.potency-x.potency||x.id.localeCompare(y.id))[0];mul=w.kind==="cyphCurated"?1.4:1.15;}
        st(a).cyphBarsUsed=count+1;
        say(`${a.name} performs ${chosen.name} through ${w.kind==="cyphCurated"?"Curated Cypher":"Lyricism"}: original delivery and counters, ×${mul}.`);
        H.cyphPerform(s,a,chosen.id,tx,ty,mul);break;
      }
      case "shieldFace": st(a).shieldFace = { dir: [Math.sign(tx - a.x), Math.sign(ty - a.y)], until: until(1) }; say(`${a.name} raises the shield toward (${tx},${ty}): hits from that side ×0.5.`, ["Defense has a direction."]); break;
      case "maidSort": {
        const dx = Math.sign(tx - a.x), dy = Math.sign(ty - a.y), line = [];
        if (dx && dy) { say(`${a.name} cannot sort along a diagonal.`); break; }
        for (let i = 1; i <= 4; i++) { const x = a.x + dx * i, y = a.y + dy * i, object = s.arena.objects?.find(o => o.x === x && o.y === y); if (!H.inside(s, x, y) || (H.tileAt(s, x, y).blocksMove && !object)) break; line.push([x, y]); if (x === tx && y === ty) break; }
        let moved = 0;
        for (const [x, y] of line) {
          const offsets = dx ? [[0,1],[0,-1]] : [[1,0],[-1,0]];
          const freeSide = (nx, ny, original) => H.inside(s,nx,ny) && !H.tileAt(s,nx,ny).blocksMove && !H.actorAt(s,nx,ny) && !H.barrierAt(s,nx,ny) && !(s.arena.objects || []).some(o => o !== original && o.x === nx && o.y === ny);
          const u = H.actorAt(s, x, y);
          if (u && u.id !== a.id && u.side !== a.side) { const spot = offsets.map(([ox,oy]) => [x+ox,y+oy]).find(([nx,ny]) => freeSide(nx,ny,null)); if (spot) { u.x=spot[0];u.y=spot[1];moved++; } else { H.hit(s,a,u,inst,6,["Sort sends the obstruction into a hard stop."],{label:"Sort collision",damageType:"nigredo"});moved++; } }
          const object = s.arena.objects?.find(o => o.x === x && o.y === y && !o.protected);
          if (object) { const spot = offsets.map(([ox,oy]) => [x+ox,y+oy]).find(([nx,ny]) => freeSide(nx,ny,object)); if (spot) { object.x=spot[0];object.y=spot[1];moved++; } else if (object.evidenceId || object.role?.startsWith("evidence:")) { s.arena.objects=s.arena.objects.filter(o=>o!==object);say(`${object.name || "Proof"} breaks when Sort pushes it into a hard stop.`);moved++; } }
        }
        say(`${a.name} sorts the line: ${moved} unit${moved===1?"":"s"} or object${moved===1?"":"s"} displaced.`, ["Selectivity changes who or what remains in the chosen line."]); break;
      }
      case "maidProtect": {
        const o = s.arena.objects?.find(q => q.x === tx && q.y === ty);
        if (o) { o.protected = true; o.maidProtectOwner = a.id; o.maidProtectedUntil = a.ownerTurns + 2; say(`${a.name} protects ${o.name || "the selected object"} for two Maid turns.`); }
        else if (tgt) { st(tgt).maidProtected = { by: a.id, until: tgt.ownerTurns + 2 }; say(`${a.name} protects ${tgt.name} from the next incoming hit for two turns.`); }
        break;
      }
      case "maidExtract": {
        const receptacle = receptacleFor(s, a);
        if (!receptacle || receptacle.hp <= 0) { say(`${a.name} cannot extract anything: the service receptacle is broken.`); break; }
        receptacle.stored ||= [];
        if (receptacle.stored.length >= 3) {
          const spot = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => [tx+dx,ty+dy]).find(([x,y]) => free(s,x,y,H));
          if (!spot) { say(`${a.name}'s service receptacle is full and there is no adjacent place to unload it.`); break; }
          const old = receptacle.stored.shift();
          unloadAt(s, old, spot[0], spot[1]);
          say(`${a.name} ${old.kind === "trap" ? "throws out a disarmed trap" : `unloads ${old.name || "the oldest stored obstruction"} at (${spot[0]},${spot[1]})`} before extracting.`);
        }
        const object = s.arena.objects?.find(o => o.x === tx && o.y === ty && o !== receptacle);
        const trap = knownTrapAt(s, a, tx, ty, H), pickup = pickupAt(s, tx, ty);
        if (trap) { storeTrap(s, a, trap, receptacle, H); say(`${a.name} lifts the trap at (${tx},${ty}) into her cart, disarmed (${receptacle.stored.length}/3).`, ["Clear the Obstruction takes a trap she knows about off the floor. It stays disarmed: only trappers set traps."]); }
        else if (pickup && !(tgt && tgt.id !== a.id && tgt.side !== a.side)) { storePickup(s, pickup, receptacle, H); say(`${a.name} picks up ${H.itemName ? H.itemName(pickup.item) : pickup.item} and puts it in her cart (${receptacle.stored.length}/3).`, ["An ally beside her can take it out (Take from the cart)."]); }
        else if (object && object.role !== "scenario-objective") { receptacle.stored.push({ kind: "object", object: { ...object, x: null, y: null }, name: object.name || object.type }); s.arena.objects = s.arena.objects.filter(o => o !== object); say(`${a.name} extracts ${object.name || object.type} into the receptacle (${receptacle.stored.length}/3).`); }
        else if (object && object.role === "scenario-objective") { say(`${a.name} cannot cart the ${object.name || object.type}: it is the battle's objective.`); }
        else if (tgt && tgt.id !== a.id && tgt.side !== a.side) { H.hit(s, a, tgt, inst, 8, ["The obstruction resists removal."], { label: "Clear the Obstruction", damageType: "citrinitas" }); say(`${a.name} clears the occupied tile; a person is not stored.`); }
        else { const at = (s.terrainEffects || []).findIndex(e => (e.tiles || []).some(p => p[0] === tx && p[1] === ty)); if (at >= 0) { const [effect] = s.terrainEffects.splice(at, 1); receptacle.stored.push({ kind: "effect", effect, name: effect.label || effect.kind }); say(`${a.name} extracts ${effect.label || effect.kind} (${receptacle.stored.length}/3).`); } }
        break;
      }
      case "maidSweep": {
        const receptacle = receptacleFor(s, a);
        receptacle.stored ||= [];
        const room = 3 - receptacle.stored.length, near = (q) => H.dist(s, tx, ty, q.x, q.y) <= w.radius;
        const traps = (s.traps || []).filter(t => !t.spent && near(t) && H.Traps?.known(a, t)).slice(0, room);
        for (const t of traps) storeTrap(s, a, t, receptacle, H);
        const items = (s.arena.pickups || []).filter(near).slice(0, room - traps.length);
        for (const p of items) storePickup(s, p, receptacle, H);
        const found = (s.arena.objects || []).filter(o => o !== receptacle && !o.protected && o.role !== "scenario-objective" && near(o)).slice(0, room - traps.length - items.length);
        for (const object of found) { receptacle.stored.push({ kind: "object", object: { ...object, x: null, y: null }, name: object.name || object.type }); s.arena.objects = s.arena.objects.filter(o => o !== object); }
        if (traps.length || items.length) say(`${a.name} also clears ${[traps.length ? `${traps.length} trap${traps.length === 1 ? "" : "s"}` : "", items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ")} into her cart.`);
        say(`${a.name} empties the selected area: ${found.length} object${found.length === 1 ? "" : "s"} relocated (${receptacle.stored.length}/3 slots).`, ["The ultimate conserves every extracted object and is limited by receptacle capacity."]); break;
      }
      case "maidRemove": {
        if (!tgt) break;
        if (tgt.longtermismBequest) { tgt.longtermismBequest = null; say(`${a.name} strips ${tgt.name}'s unpaid bequest from the books.`, ["The future's bill is void when the patron is stripped."]); break; }   // stripThePatron
        const removable = Object.entries(tgt.status || {}).find(([key, value]) => value && !["guard", "anchor", "parry", "drowning", "maidProtected"].includes(key));
        if (removable) { tgt.status[removable[0]] = null; say(`${a.name} removes ${removable[0]} from ${tgt.name}.`); }
        else { tgt.nextActionCostAdd = (tgt.nextActionCostAdd || 0) + 25; say(`${a.name} removes 25 AP from ${tgt.name}'s next turn; no Life Force damage.`); }
        break;
      }
      case "maidRestore": {
        const receptacle = receptacleFor(s, a);
        const effectIndex = (s.terrainEffects || []).findIndex(e => (e.tiles || []).some(p => p[0] === tx && p[1] === ty));
        if (tgt) { const status = Object.entries(tgt.status || {}).find(([key, value]) => value && !["guard", "anchor", "parry", "drowning", "maidProtected"].includes(key)); if (status) { receptacle.stored ||= []; receptacle.stored.push({ kind: "status", name: status[0], actorId: tgt.id, status: status[1] }); tgt.status[status[0]] = null; if (tgt.side === a.side) tgt.lf = Math.min(tgt.maxLF, tgt.lf + 25); } }
        else if (effectIndex >= 0) { const [effect] = s.terrainEffects.splice(effectIndex, 1); receptacle.stored ||= []; receptacle.stored.push({ kind: "effect", effect, name: effect.label || effect.kind }); }
        else if (receptacle?.stored?.length && free(s, tx, ty, H)) { const item = receptacle.stored.shift(); if (item.kind === "object") s.arena.objects.push({ ...item.object, x: tx, y: ty }); else if (item.kind === "effect") s.terrainEffects.push(item.effect); else if (item.kind === "item" || item.kind === "trap") unloadAt(s, item, tx, ty); else if (item.kind === "status") { const owner = s.actors[item.actorId]; if (owner && !owner.status[item.name]) owner.status[item.name] = item.status; else { receptacle.stored.unshift(item); say(`${a.name} cannot return ${item.name} to its original host.`); break; } } say(`${a.name} returns ${item.name} from the receptacle to its original place (${receptacle.stored.length}/3).`); break; }
        say(`${a.name} restores the working order at (${tx},${ty})${receptacle?.stored?.length ? ` (${receptacle.stored.length}/3 in receptacle)` : ""}.`); break;
      }
      case "relocate": a.x = tx; a.y = ty; if (st(a).shieldFace) st(a).shieldFace.until = until(1); say(`${a.name} moves to (${tx},${ty})${w.needs === "shieldFace" ? " behind the shield" : ""}.`); break;
      case "teleport": {
        const valley = inst.ability === "linkedStep" && isOrigamist(a);   // Valley Fold: Linked Step reskinned, paper visual only — zero new mechanics
        const burned = inst.ability === "remoteDoor" && isOrigamist(a) && st(a).paperBurn;
        const allies = w.carryAlly ? (burned ? routeRiders(s, a) : live(s).filter((u) => u.side === a.side && u.id !== a.id && H.dist(s, a.x, a.y, u.x, u.y) === 1).slice(0, 1)) : [];
        a.x = tx; a.y = ty;
        say(valley ? `${a.name} folds a paper crease and steps along it to (${tx},${ty}) (Valley Fold).` : `${a.name} steps through to (${tx},${ty}).`, ["Distance and connectivity are different properties."]);
        for (const ally of allies) { const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [tx + dx, ty + dy]).find(([x, y]) => free(s, x, y, H)); if (spot) { ally.x = spot[0]; ally.y = spot[1]; say(`${ally.name} comes through the door too.`); } }
        if (valley && !S(s).firstFold?.[a.id]) {   // first_fold: the first Linked Step each battle costs 0 PF (the wound-spring refund precedent)
          (S(s).firstFold ||= {})[a.id] = true;
          const cost = H.ability?.("linkedStep")?.cost || 0;
          if (cost > 0) { a.pf = Math.min(a.maxPF, a.pf + cost); H.log(s, { kind: "effect", actor: a.id, text: `The first fold is free: ${a.name} gets ${cost} ΦF back.`, why: ["First Fold: her first Linked Step each battle costs 0 PF."] }); }
        }
        break;
      }
      case "foldPanel": {   // Mountain Fold interim: a folded panel, 0.25 one-sided cover, 2 rounds (Track A wear path)
        const face = origamistFacing(s, a, tx, ty, H);
        const compass = [[0, -1, "north"], [1, -1, "northeast"], [1, 0, "east"], [1, 1, "southeast"], [0, 1, "south"], [-1, 1, "southwest"], [-1, 0, "west"], [-1, -1, "northwest"]].find(([dx, dy]) => dx === face[0] && dy === face[1]);
        s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x: tx, y: ty, protection: ORIG.panelProtection,
          duration: ORIG.panelDuration, expiresAt: a.ownerTurns + ORIG.panelDuration,
          concept: "foldPanel", blocksSight: false, blocksMove: false, blocksRoute: false, passable: true, linePassable: true,
          coverFraction: ORIG.panelCover, foldFacing: face });
        say(`${a.name} folds a paper panel onto (${tx},${ty}) facing ${compass ? compass[2] : "north"}: lines from that approach lose a quarter against an adjacent target, for ${ORIG.panelDuration} rounds.`, ["One-sided cover: every other approach ignores it.", "Cover wears paper: softened lines chip the panel, Resonance chips double."]); break; }
      case "paperRoute": {   // the merge: a door onto a suspended line — allies only, past everything, in one move
        const riders = routeRiders(s, a), landings = routeLandings(s, a, tx, ty, 1 + riders.length, H);
        a.x = tx; a.y = ty;
        const carried = [];
        riders.forEach((u, i) => { const spot = landings[i + 1]; if (spot) { u.x = spot[0]; u.y = spot[1]; carried.push(u); } });
        say(`${a.name} opens a paper route to (${tx},${ty}): ${[a.name, ...carried.map((u) => u.name)].join(", ")} step through the door and ride the suspended line past everything in the way.`, ["Allies only: the merge fixed the two-way price — enemies never ride.", ...(carried.length < riders.length ? ["No open ground beside the endpoint for everyone: some riders stay behind."] : [])]); break; }
      case "unfold": {   // voluntary Unfold: collapse her own panel → the paper lies flat (+2 move this turn)
        const i = (s.barriers || []).findIndex((b) => b.owner === a.id && b.concept === "foldPanel" && b.x === tx && b.y === ty);
        if (i < 0) { say("The panel is already gone."); break; }
        s.barriers.splice(i, 1);
        const already = st(a).moveAdd?.expiresAt > a.ownerTurns ? st(a).moveAdd.amount : 0;   // Cavalry stacks; so does flat paper
        st(a).moveAdd = { label: "Flat Sheet", owner: a.id, amount: already + ORIG.unfoldMove, expiresAt: a.ownerTurns + 1 };
        say(`${a.name} unfolds the panel at (${tx},${ty}): the paper lies flat and catches nothing (+${ORIG.unfoldMove} move this turn).`, ["Geometry that shelters the enemy is geometry to fold away."]); break; }
      case "paperBurnout": {   // burnout vow: the merge sealed, the doors carry her whole side for the battle
        st(a).paperBurn = { round: s.round };
        say(`${a.name} burns the route: Paper Route is sealed for the battle, and every Remote Door carries every willing ally beside her for the rest of the battle.`, ["A vow trades the extraordinary for the reliable."]); break; }
      case "guard": if (tgt) { st(tgt).intercept = { by: a.id, uses: w.uses, mul: w.mul, until: tgt.ownerTurns + (w.turns || 1), ...(w.skipBlast ? { skipBlast: true } : {}) }; say(`${a.name} stands ready to step between ${tgt.name} and the next hit.`); } break;
      case "guardArea": for (const u of near(s, a, w.radius, H, "ally")) if (u.id !== a.id) st(u).intercept = { by: a.id, uses: w.uses, mul: w.mul, until: u.ownerTurns + (w.turns || 1), share: !!w.share, ...(w.skipBlast ? { skipBlast: true } : {}) };
        if (w.share) st(a).loadShare = { members: near(s, a, w.radius, H, "ally").map((u) => u.id), cap: 20, until: until(w.turns || 1) };
        say(`${a.name} covers everyone within ${w.radius}${w.mul < 1 ? ` (intercepted hits ×${w.mul})` : ""}.`, ["Redirecting a consequence doesn't erase it."]); break;
      case "oath": if (tgt) { const alone = tgt.id === a.id, err = alone ? oathClaim(s, a) : wardClaim(s, a, tgt); if (err !== true) { say(err); break; } swearOath(s, a, alone ? null : tgt, false, H);
        say(alone ? `${a.name} swears the oath alone: stand fast.` : `${a.name} swears the oath over ${tgt.name}: stand fast, and keep faith with them.`, ["The oath is public and has two terms: stand fast (no retreat) and keep faith (a ward stays above half).", "Breaking it ends its gifts; you may swear again one full turn later."]); } break;
      case "faithWard": { const w = wardOf(s, a), who = tgt && (tgt.id === a.id || tgt.id === w?.id) ? tgt : (w || a);   // yourself, or your ward: the target you chose, else the ward, else you
        if ((st(who).ward?.protection || 0) >= 20) { say(`${who.name}'s ward already holds: faith adds nothing.`); break; }
        st(who).ward = { label: "Kept faith", owner: a.id, protection: 20, expiresAt: who.ownerTurns + 2 };
        if (st(a).oath) st(a).oath.lastFaithTurn = a.ownerTurns;   // the two-turn count restarts: faith is not a ward refilled every turn
        a.pf = Math.min(a.maxPF ?? a.pf, a.pf + PALADIN.faithPf);   // Oathbound: faith kept returns ΦF
        say(`${a.name} kept the oath for 2 turns: ${who.id === a.id ? "a ward of 20 closes around them" : `${who.name} gains a ward of 20`}, and ${PALADIN.faithPf} ΦF return.`, ["Kept commitments compound."]); } break;
      case "layHands": if (tgt) { const hands = st(a).hands || (st(a).hands = { pool: PALADIN.handsPool, max: PALADIN.handsPool });
        const miss = Math.max(0, (tgt.maxLF ?? tgt.lf) - tgt.lf), heal = Math.min(PALADIN.handsHeal, hands.pool, miss);
        if (heal <= 0) { say(hands.pool <= 0 ? `${a.name}'s hands are spent.` : `${tgt.name} is not hurt.`); break; }
        tgt.lf += heal; hands.pool -= heal;
        say(`${a.name} lays hands on ${tgt.id === a.id ? "themselves" : tgt.name}: +${heal} LF (Hands ${hands.pool}/${hands.max}).`, ["A finite store of mercy: spend it where it matters."]);
        // Holy (docs/holy.md): a touch is a personal miracle, and for the one touched it counts as a sermon (a neutral may start to believe): only they witness it.
        if (tgt.id !== a.id) H.log(s, { kind: "holyHands", actor: a.id, target: tgt.id, tiles: [[tgt.x, tgt.y]], witnesses: [tgt.id], heard: true, text: `${tgt.name} is touched by something they cannot explain.` }); } break;
      case "hymn": { st(a).hymn = { label: "Hymn of the Oath", owner: a.id, expiresAt: a.ownerTurns + PALADIN.hymnTurns + 1 };   // ownerTurns rises before turnStart and expiry runs first: +1 gives the three ticks the card promises
        say(`${a.name} sings the Hymn of the Oath: for ${PALADIN.hymnTurns} turns, allies within ${PALADIN.hymnRadius} recover ${PALADIN.hymnHeal} LF and foes within ${PALADIN.hymnRadius} take ${PALADIN.hymnHurt} Rubedo at each of ${a.name}'s turn starts (×${PALADIN.oathMul} while the oath holds).`, ["A place, not a strike: leave the radius and it cannot touch you.", "A broken oath ends the bonus."]);
        H.log(s, { kind: "holyHymn", actor: a.id, tiles: [[a.x, a.y]], visibleTo: Object.values(s.actors).filter((u) => u.id !== a.id && !u.defeated && H.hasSight(s, u.x, u.y, a.x, a.y)).map((u) => u.id), text: `The Hymn of the Oath rings out, a sound beyond ordinary song.` }); } break;   // holy (docs/holy.md): once at the cast, seen by whoever has sight
      case "oathGuard": if (tgt) { const err = wardClaim(s, a, tgt); if (err !== true) { say(err); break; } swearOath(s, a, tgt, true, H);
        st(tgt).intercept = { by: a.id, uses: 9, mul: 0.5, until: tgt.ownerTurns + 3, skipBlast: true, oathbound: true };
        say(`${a.name}: "My ward. My oath. Come through me." Every attack on ${tgt.name} comes through the shield, halved, for 3 turns.`, ["Breaking the oath ends it and stuns the oathbreaker.", "Fields have no route to step into."]); } break;
      case "clericBless": if (tgt) { grantPledge(s, a, tgt, "noRetreat", H);   // INVENTION-CLERIC-2: fixed no-retreat vow; ward 10 + next 2 techniques ×1.2
        if ((st(tgt).ward?.protection || 0) < CLERIC.blessWard) st(tgt).ward = { label: "Blessing", owner: a.id, protection: CLERIC.blessWard, expiresAt: tgt.ownerTurns + CLERIC.vowTurns };
        st(tgt).blessing = { mul: CLERIC.blessMul, uses: CLERIC.blessUses, until: tgt.ownerTurns + CLERIC.vowTurns };
        const rebate = congregationApplies(s, a) ? 1 : 0;   // INVENTION-CLERIC-8: the 1-less-ΦF arrives as a refund (engine.js is line-capped; the price is paid, then returned)
        if (rebate) a.pf = Math.min(a.maxPF, a.pf + rebate);
        say(`${a.name} blesses ${tgt.name}: a ward of ${CLERIC.blessWard} and ×${CLERIC.blessMul} on their next ${CLERIC.blessUses} techniques, bound to a vow — don't retreat.${rebate ? " The congregation returns 1 ΦF." : ""}`, ["Keeping the vow extends the blessing a turn; breaking it ends it."]); } break;
      case "clericSanctuary": if (tgt) { grantPledge(s, a, tgt, "noAttack", H);
        st(tgt).sanctuary = { mul: 0.6, until: tgt.ownerTurns + CLERIC.vowTurns };
        say(`${a.name} takes ${tgt.name}'s vow of sanctuary: no attacks, and harm lands ×0.6 while it holds.`, ["Their first attack breaks it and ends the sanctuary."]); } break;
      case "clericHands": if (tgt) { const dues = Math.min(tgt.tempo, CLERIC.handsAp); tgt.tempo -= dues;   // both spend (INVENTION-CLERIC-3: heal 12, recipient's action is 25 AP)
        const got = Math.min(CLERIC.handsHeal, tgt.maxLF - tgt.lf); tgt.lf += got;
        H.log(s, { kind: "heal", actor: a.id, target: tgt.id, healed: got, tiles: [[tgt.x, tgt.y]], text: `${a.name} lays hands on ${tgt.name}: +${got} LF (${tgt.lf}/${tgt.maxLF}). ${tgt.name} gives ${dues} AP to the healing.`, why: ["Both spend: the technique and the recipient's action."] }); } break;
      case "clericChorus": if (tgt) { const dues = Math.min(tgt.tempo, CLERIC.chorusAp); tgt.tempo -= dues;   // INVENTION-CLERIC-4: both spend 25 AP; the ally's next technique ×1.5
        st(tgt).chorus = { mul: CLERIC.chorusMul, uses: 1, until: tgt.ownerTurns + 1 };
        say(`${a.name} and ${tgt.name} act as one: ${tgt.name}'s next technique resolves at ×${CLERIC.chorusMul}.`, ["Two contributors, one combined effect neither could reach alone."]); } break;
      case "clericCovenant": { const flock = live(s).filter((u) => u.side === a.side && u.id !== a.id && !u.defeated);   // INVENTION-CLERIC-5: the shared vow is stand-ground; keepers heal 8 + ×1.2
        for (const u of flock) { const v = pledgeOf(u); if (v) v.covenant = true; else grantPledge(s, a, u, "noRetreat", H, { covenant: true }); }
        st(a).covenantWatch = { until: a.ownerTurns + 1, allies: flock.map((u) => u.id) };
        say(`${a.name}: "Stand together. Hold the line." Every ally holds the shared vow until ${a.name}'s next turn: keepers are healed and strengthened, and every broken vow will be named.`, ["One vow for the whole side, judged together."]); break; }
      case "exempt": if (tgt) { st(tgt).exempt = { by: a.id, until: tgt.ownerTurns + 2 }; say(`${tgt.name} is granted an exception to the terms.`); } break;
      case "law": for (const u of near(s, a, w.radius, H)) st(u).contract = { owner: a.id, terms: w.terms, penalty: w.penalty, until: u.ownerTurns + w.turns, ownerMul: u.id === a.id ? w.ownerMul : null };
        say(`${a.name} declares terms within ${w.radius}: ${w.terms === "noUltimate" ? "no ultimates" : "no line attacks"}. It binds ${a.name} too.`, ["A rule that binds its maker is credible."]); break;
      case "earthworks": { // four tiles across the facing direction; the centre one is the designed passage
        const dx = Math.sign(tx - a.x), dy = Math.sign(ty - a.y), [px, py] = dx ? [0, 1] : [1, 0]; let n = 0;
        for (const k of [-1, 0, 1, 2]) { const x = tx + px * k, y = ty + py * k; if (!free(s, x, y, H)) continue;
          s.barriers.push({ id: "cb" + (++s.seq), owner: a.id, x, y, concept: "berm", coverFraction: 0.5, passable: true, duration: 3, expiresAt: a.ownerTurns + 3, ...(k === 0 ? { passage: a.side } : {}) }); n++; }
        say(`${a.name} raises ${n} tiles of earthworks with a designed passage.`, ["An obstacle can protect movement rather than prevent it."]); break; }
      case "read": if (tgt) { st(a).openingRead = { target: tgt.id, until: until(2) }; say(`${a.name} reads ${tgt.name}'s next opening.`); } break;
      case "ma": Ma.resolve(s, a, w, H); break;   // Ma (five concepts M1): Leave Space, Held Breath, The Space Between
      case "share": { const members = near(s, a, w.radius, H, "ally").slice(0, (w.max || 9) + 1).map((u) => u.id);
        for (const id of members) st(H.actor(s, id)).loadShare = { members, cap: w.cap, until: H.actor(s, id).ownerTurns + w.turns };
        say(`${a.name} links ${members.length} units: hits on any are split across all${w.cap < 99 ? ` (up to ${w.cap} each)` : ""}.`, ["Distribution changes local stress, not total force."]); break; }
      case "rescue": if (tgt) { const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [tgt.x + dx, tgt.y + dy]).filter(([x, y]) => free(s, x, y, H)).sort((p, q) => H.dist(s, a.x, a.y, ...p) - H.dist(s, a.x, a.y, ...q))[0];
        if (spot) { a.x = spot[0]; a.y = spot[1]; } st(tgt).intercept = { by: a.id, uses: 1, mul: 1, until: tgt.ownerTurns + 1 }; say(`${a.name} races to ${tgt.name} and covers them.`); } break;
      case "tether": st(a).tether = { at: [tx, ty], until: until(3) }; say(`${a.name} tethers to (${tx},${ty}): shoves can't move them while it holds.`); break;
      case "cushion": if (tgt) { st(tgt).cushion = { by: a.id, mul: w.mul, uses: w.uses, until: tgt.ownerTurns + 1 }; say(`${a.name} is ready to catch ${tgt.name}.`); } break;
      case "carryMountain": if (tgt) { carryMountain(s, a, tgt, w, H, say); } break;   // Hanuman's Sanjeevani
      case "namedStrike": if (tgt) H.hit(s, a, tgt, inst, w.potency * (inst.mult || 1), [w.line], { label: w.label || "Strike", damageType: w.damageType }); break;   // a set blow with a story line; rule 6 via the wire's thematic table
      case "shakti": if (tgt) H.hit(s, a, tgt, inst, w.potency * (inst.mult || 1), [tgt.character === "lakshmana" ? "The Shakti finds the one it was made for." : "The Shakti: one force through one body."], { label: "Shakti", damageType: w.damageType }); break;
      case "abduct": if (tgt) { const to = abductTo(s, a, tgt, w, H); if (to) {
        a.x = to.me[0]; a.y = to.me[1]; tgt.x = to.them[0]; tgt.y = to.them[1];
        H.addStun(s, a, tgt, w.stunAp);
        say(`The Pushpaka chariot comes down: ${a.name} carries ${tgt.name} off to (${tgt.x},${tgt.y}).`, [`The Abduction: flown up to ${w.fly}, and ${w.stunAp} AP gone from ${tgt.name}'s next turn.`]); } } break;
      case "callKin": { const who = H.Hires?.kinFor(s, a); if (who) { st(a).kinCalled = s.round; H.Hires.callKin(s, a, who, { why: "Call of Faith: a full character answers, not a summon, and stays to the end." }); } break; }
      case "brahmastra": if (tgt) {   // Rama: once a battle; true (full potency) only on a weakness his side has learned
        st(a).brahmastraLoosed = s.round;
        const known = weaknessKnown(s, a, tgt, H), p = known ? w.known : w.unknown, told = !known && p >= w.known;   // told: the story already knows (Ravana: Vibhishana's secret)
        H.States?.breakFor(s, tgt, inst.ability, a);   // what this arrow ends (Ravana's heads, his boon) ends before it lands, not after
        H.hit(s, a, tgt, inst, p * (inst.mult || 1), [known ? `The Brahmastra lands true: ${a.name}'s side knows where ${tgt.name} can die.` : told ? `The Brahmastra lands true: Vibhishana told ${a.name} where ${tgt.name} can die.` : `The Brahmastra flies blind: ${a.name}'s side has not learned ${tgt.name}'s weakness (half).`], { label: "Brahmastra", damageType: "albedo" });
      } break;
      case "rememberAlly": if (tgt) {   // Jambavan: once a battle per ally; a Forgotten ally's state breaks through its own breaker (State Kit afterAction)
        (st(a).remembered ||= []).push(tgt.id);
        const forgot = forgotten(tgt, H), max = s.rules.ultimateChargeMax || 100, before = tgt.ultimateCharge || 0;
        tgt.ultimateCharge = Math.min(max, before + (forgot ? w.forgottenCharge : w.charge));
        say(`${a.name} tells ${tgt.name} what they are: +${tgt.ultimateCharge - before} ultimate charge.`, ["Remember What You Are: once a battle for each ally."]); } break;
      case "cushionArea": for (const u of near(s, a, w.radius, H, "ally")) { st(u).cushion = { by: a.id, mul: w.mul, uses: w.uses, until: u.ownerTurns + w.turns }; st(u).tether = { at: [a.x, a.y], until: u.ownerTurns + w.turns }; }
        say(`${a.name} spreads a living safety net: impacts on allies within ${w.radius} are cushioned and they can't be shoved off.`); break;
      case "trackMove": a.x = tx; a.y = ty; st(a).trackersEye = { until: a.ownerTurns };
        say(`${a.name} follows the trail to (${tx},${ty}); the next attack this turn ignores cover.`, ["A route taken is a route readable."]); break;
      case "interceptDash": if (tgt) { const tr = trailOf(s, a, tgt); if (!tr) { say(`${tgt.name}'s trail has gone cold.`); break; }
          const at = interceptOf(s, tgt, tr, H), spot = dashSpot(s, a, at, H); if (spot) { a.x = spot.x; a.y = spot.y; }
          const there = H.dist(s, a.x, a.y, at[0], at[1]) <= 1; if (there) st(a).ambushEdge = { until: a.ownerTurns, add: s.rules.ranger.ambushAdd };
          say(`${a.name} cuts toward where ${tgt.name}'s tracks point, (${at[0]},${at[1]})${there ? `: in place, +${s.rules.ranger.ambushAdd} potency on the next attack this turn` : ", and falls short"}.`, ["The projection is public: the quarry's tile plus its last step, twice over."]); } break;
      case "deadReckoning": if (tgt) { const r = reckon(s, a, tgt);
          H.hit(s, a, tgt, { ...inst, ignoreCover: signed(s, a, tgt) || calledOut(tgt) }, r.potency * (inst.mult || 1), ["Dead Reckoning: the route says where it went, the evidence says where it is.", ...r.why], { label: "Dead Reckoning", damageType: "citrinitas" }); } break;
      case "readSign": if (tgt) { const opening = openingRead(s, a); if (opening) a.longHuntUsed = true;
          (S(s).signs ||= {})[a.id] = { target: tgt.id, x: tgt.x, y: tgt.y };
          if (opening) H.log(s, { kind: "effect", actor: a.id, target: tgt.id, text: `The Long Hunt: ${a.name} has ${tgt.name}'s trail before anyone has moved. "Run."`, why: ["Class trait: one Read Sign on his first turn costs nothing."] });
          say(`${a.name} reads the ground: a line of sight to ${tgt.name}, wherever it stands, until it moves.`, ["Only the reader has it. One reading at a time."]); } break;
      case "callOut": if (tgt) { st(tgt).calledOut = { until: tgt.ownerTurns + s.rules.ranger.calledOutTurns, by: a.id };
          say(`${a.name} calls out ${tgt.name}: cover does not protect it until its next turn ends.`, ["Two signs make a fact."]); } break;
      case "huntersMark": if (tgt) { const R = s.rules.ranger;
          for (const u of live(s)) if (u.status?.quarry?.by === a.id) u.status.quarry = null;   // one quarry at a time
          st(tgt).quarry = { by: a.id, untilRound: s.round + R.markRounds };
          say(`${a.name} marks ${tgt.name}: +${R.markAdd} potency on single-target hits for ${R.markRounds} rounds.`, ["One quarry at a time; a new mark replaces the old."]); } break;
      case "platformLink": if (tgt) { const K = PLATFORM.client;
          if (tgt.side === a.side || !playerRun(tgt)) { join(s, a, tgt, H); break; }
          st(tgt).platformOffer = { by: a.id, until: tgt.ownerTurns + K.offerTurns }; if (!(tgt.learned ||= []).includes("acceptTerms")) tgt.learned.push("acceptTerms");
          say(`${a.name} makes ${tgt.name} an offer: "It is free. You will wonder how you fought without it."`,
            [`Accept the Terms (free, on your next turn): +${K.signPf} ΦF at once, +${K.turnAp} action points every turn, your techniques ×${K.potencyMul} and +${Math.round(PLATFORM.perLink * 100)}% per unit on the platform.`,
              `The terms: you cannot leave except by staying beyond ${PLATFORM.range} tiles of ${a.name} for a full round, and what he gives he can change.`, "Do nothing and the offer lapses.",
              `Fine print: a subscription fee of ${PLATFORM.fee} Life Force is due at the end of each of your turns.`]); } break;
      case "craftAccept": if (H.exposure?.canAccept(s, a)) H.exposure.accept(s, a); break;
      case "studyPass": if (canPass(a)) { passClass(s, a, H); openGifts(s, a, H); if (!canPass(a) && a.learned) a.learned = a.learned.filter((id) => id !== "passAClass"); } break;
      case "docStabilize": { const u = triage(s, a, H); if (!u) { say(`${a.name} finds nobody to treat.`); break; }
        st(a).lastPatient = u.id; st(u).recovery = { by: a.id, stage: 1, held: false, full: false };
        say(`${a.name} stabilizes ${u.name}: ${stageEffect(s, u, H)}. Stage 1 of 3.`, [`Triage chose ${u.name}: the most hurt within ${DOCTOR.range}, and never the same patient twice running.`, `It advances at each of ${u.name}'s turns: +${DOCTOR.heal[2]} LF, then +${DOCTOR.heal[3]} LF and one condition cleared.`, "Any damage to the patient ends it."]); break; }
      case "docCourse": if (tgt?.status?.recovery) { const r = tgt.status.recovery; r.stage += 1; r.held = true; const what = stageEffect(s, tgt, H), done = r.stage >= 3;
          say(`${a.name} continues ${tgt.name}'s treatment to stage ${r.stage}: ${what}.${done ? " The recovery is complete." : " It will hold through one disturbance."}`); if (done) tgt.status.recovery = null; } break;
      case "tmEffigy": { const at = [tx, ty]; const id = `effigy-${a.id}-${(s.effigyN = (s.effigyN || 0) + 1)}`;
          s.arena.objects.push({ id, type: "effigy", name: "Effigy", x: at[0], y: at[1], hp: 12, maxHp: 12, blocksMove: true, moveCost: 0, material: "wood", status: {}, effigy: { owner: a.id }, owner: a.id });
          say(`${a.name} raises an effigy at (${at[0]},${at[1]}): a body waiting to be filled.`, ["Mark it as his vessel; anyone can break it (12 HP)."]); } break;
      case "tmLong": a.longMigration = { until: s.round + 3 };
          say(`${a.name} begins the long migration: for three rounds every death is a doorway.`, ["Any of his tamed beasts or his effigy will take him, wherever it stands; the crossing bursts for 16."]); break;
      case "tmPack": H.summonPack?.(s, a); break;
      case "tmMark": if (!tgt) { const eff = (inst?.tiles || []).map(([x, y]) => (s.arena.objects || []).find((o) => o.x === x && o.y === y && o.effigy?.owner === a.id)).find(Boolean);
          if (eff) { a.vessel = eff.id; say(`${a.name} marks his effigy as his vessel.`, ["If he falls while it stands, he wakes in it: 20 LF, rooted for a turn."]); } } else { a.vessel = tgt.id;
          say(`${a.name} marks the ${tgt.name.toLowerCase()} as his vessel. He believes he cannot die now.`, ["If he falls while it lives, he wakes in its body, every technique still his, and the crossing bursts against whoever stands beside the body he left.", "Kill the beast first, then let him be brave."]); } break;
      case "docDiagnose": if (tgt) { const k = ailment(tgt); st(tgt).diagnosed = { by: a.id, cause: k, confirmed: false };
          say(k ? `${a.name} diagnoses ${tgt.name}: ${k}.` : `${a.name} examines ${tgt.name}: hurt, with no lingering condition.`, ["A diagnosis is a claim until a second opinion confirms it."]); } break;
      case "docConfirm": if (tgt?.status?.diagnosed) { tgt.status.diagnosed.confirmed = true;
          say(`${a.name} confirms the diagnosis on ${tgt.name}: the next treatment works ×${DOCTOR.confirmMul}${tgt.status.diagnosed.cause ? `, and stage 3 will clear ${tgt.status.diagnosed.cause}` : ""}.`, ["Two independent looks make a finding."]); } break;
      case "docFull": if (tgt) { st(tgt).recovery = { by: a.id, stage: 0, held: false, full: true, turnsLeft: DOCTOR.fullTurns }; readPatient(s, a, tgt);
          say(`${a.name} commits to ${tgt.name}'s full recovery: +${DOCTOR.full[1]}, +${DOCTOR.full[2]}, then +${DOCTOR.full[3]} LF and a condition cleared, one stage at each of ${tgt.name}'s turns.`, ["Any damage to the patient ends it.", `It ends at stage 3, or after ${DOCTOR.fullTurns} of the patient's turns.`]); } break;
      case "robotTalk": if (tgt) { st(a).caseTurn = a.ownerTurns;   // contagious ideas (insight-data.js contagiousIdeas.machineSympathy; engine/conditions.js spreadIdea)
          H.spreadIdea?.(s, a, tgt, "machineSympathy"); } break;
      case "oilDrill": { a.barrels = Math.min(OIL.barrelCap, barrelsOf(a) + 1); addSlick(s, a, [[tx, ty]]);
        say(`${a.name} drills at (${tx},${ty}): ${a.barrels}/${OIL.barrelCap} barrels in reserve, and the ground runs slick.`, [`Slick lasts ${OIL.slickTurns} of his turns: anyone who starts a turn on it loses ${OIL.slickAp} action points, and it burns.`]); break; }
      case "oilSpill": { const n = addSlick(s, a, inst.tiles || []); say(n ? `${a.name} spills it wider: ${n} more tile${n === 1 ? "" : "s"} of slick.` : `${a.name} spills crude onto ground that is already covered.`); break; }
      case "oilFlare": { const lit = (inst.tiles || []).filter(([x, y]) => slickAt(s, x, y)), on = live(s).filter((u) => lit.some(([x, y]) => u.x === x && u.y === y));
        say(`${a.name} lights the slick: ${lit.length} tile${lit.length === 1 ? "" : "s"} burn${on.length ? `, with ${on.map((u) => u.name).join(", ")} standing in it` : ""}.`, ["Fire does not ask whose side you are on."]);
        burnSlick(s, lit);
        for (const u of on) if (!u.defeated) H.hit(s, a, u, inst, OIL.flarePotency * (inst.mult || 1), ["Standing in burning crude."], { label: "Flare", damageType: "rubedo" }); break; }
      case "oilBuyOut": if (tgt) { const q = priceOf(s, tgt), B = OIL.buy; if (q.no || q.price > barrelsOf(a)) { say(`${a.name}'s offer for ${tgt.name} falls through.`); break; }
          a.barrels = barrelsOf(a) - q.price; const paid = `${q.price} barrel${q.price === 1 ? "" : "s"}`;
          if (q.help) { (S(s).boughtHelp ||= {})[tgt.id] = true; tgt.boughtOut = { from: tgt.side, by: a.id, until: tgt.ownerTurns + B.helpTurns }; tgt.side = a.side;
            say(`${a.name} buys ${tgt.name} out from under its side for ${paid}: it works for him for ${B.helpTurns} of its turns.`, ["Hired help goes to whoever pays.", "Once per unit. It goes back when the contract ends, or when he falls."]); break; }
          (S(s).bought ||= {})[tgt.id] = q.price; st(tgt).nonCompete = { with: a.id, until: tgt.ownerTurns + B.turns, pay: B.payAp, paid: false };
          tgt.truceWith = a.id; tgt.truceUntil = s.round + 1; const took = stripOne(tgt);
          say(`${a.name} buys ${tgt.name} out for ${paid}. Nobody asked ${tgt.name}.`, [`Non-compete: nothing ${tgt.name} does can hurt ${a.name} until its next turn ends.`, `The payment: +${B.payAp} action points on that turn.`,
            ...(took ? [`He takes what it was holding: its ${took} is gone.`] : []), `The next buyout of ${tgt.name} costs ${q.price + 1 > B.maxPrice ? "more than he can pay" : `${q.price + 1} barrels`}.`]); } break;
      case "oilGusher": { const G = OIL.gusher, n = barrelsOf(a), tiles = around(s, a.x, a.y, G.radius, H), hitFoes = near(s, a, G.radius, H, "enemy"); a.barrels = 0;
        say(`${a.name} lets it all go: ${n} barrel${n === 1 ? "" : "s"} burned, ${hitFoes.length} caught in the surge, and everything within ${G.radius} tiles runs slick.`, [`${G.base} + ${G.perBarrel} per barrel.`, "The field is ruined for his side too."]);
        for (const u of hitFoes) H.hit(s, a, u, inst, (G.base + G.perBarrel * n) * (inst.mult || 1), [`Gusher: ${G.base} + ${G.perBarrel} × ${n} barrels.`], { label: "Gusher", damageType: "citrinitas" });
        addSlick(s, a, tiles); break; }
      case "circuitRead": { const R = s.rules.circuit, K = circuitOf(s, a), o = (s.arena.objects || []).find((p) => p.x === tx && p.y === ty); if (K.loop || !livingPlant(o)) break;
        const members = live(s).filter((u) => u.side === a.side && memberReaches(s, u, o, H)).sort((p, q) => (p.id < q.id ? -1 : 1)).slice(0, R.members);
        K.deployments += 1; K.loop = { anchor: o.id, expiresAt: a.ownerTurns + R.life, budget: R.budget, network: false, ticks: 0, members: Object.fromEntries(members.map((u) => [u.id, { last: u.lf, error: 0, connected: true }])) };
        say(`${a.name} reads the living circuit around the ${V_name(o)}: ${members.map((u) => u.name).join(", ")}.`, [`A reservoir of ${R.budget}. Life Force they lose from now on can be corrected; wounds from before cannot.`, `It lasts until his turn ${R.life} turns from now, or until the plant dies. ${R.deployments - K.deployments} reading${R.deployments - K.deployments === 1 ? "" : "s"} left this battle.`]); break; }
      case "circuitPulse": { const R = s.rules.circuit, L = circuitOf(s, a).loop, u = tgt; if (!L || !u || !L.members[u.id]) break; sampleCircuits(s, H);
        const n = Math.min(R.pulse, L.members[u.id].error, u.maxLF - u.lf, L.budget); if (n > 0) repair(s, a, L, u, n, H, `Corrective Pulse: up to ${R.pulse}, only what the circuit saw ${u.name} lose.`); break; }
      case "circuitNetwork": { const R = s.rules.circuit, K = circuitOf(s, a), L = K.loop; if (!L) break; K.networkUsed = true;
        L.network = true; L.budget = R.network.budget; L.ticks = 0; L.expiresAt = a.ownerTurns + R.network.ticks + 1;
        say(`${a.name} opens the Homeostatic Network: "We can hold this balance only while the roots hold."`, [`The reservoir becomes ${R.network.budget}. At each of his next ${R.network.ticks} turn starts, up to ${R.network.perTick} is corrected, shared.`, "Break the plant and it all stops."]); break; }
      case "holoSwarm": { const n = towersOf(s, a).length; st(a).holoSwarm = { until: a.ownerTurns + 2, decoys: n };
        for (const o of towersOf(s, a)) towerFire(s, a, o, H, null, "Holographic Swarm: every tower fires as the holograms rise.");
        say(`${a.name} becomes a crowd: a hologram of him stands at each of ${n} tower${n === 1 ? "" : "s"}.`, [`Until his turn after next, an attack aimed at him finds a hologram ${n} time${n === 1 ? "" : "s"} in ${n + 1}.`, "Break the towers and the holograms go with them."]); break; }
      case "droneStation": { const R = s.rules.droneTowers, o = (s.arena.objects || []).find((p) => p.x === tx && p.y === ty); if (!R || !anchorable(o) || towersOf(s, a).length >= R.max) break;
        o.tower = { owner: a.id, side: a.side, round: s.round, watched: null };
        if (o.type === "dataCenter") o.status = { ...(o.status || {}), ward: (o.status?.ward || 0) + R.dataCenterWard };
        say(`${a.name} anchors a drone tower on the ${o.name || o.type} at (${tx},${ty}): ${towersOf(s, a).length} of ${R.max}.`,
          [`It fires at range ${towerRange(s, o)}, potency ${R.potency}: once as his turn starts, and once a round at anyone who ends a move in range.`, "It has no life of its own: break what it stands on and it falls.", ...(o.type === "dataCenter" ? [`On a data center: +${R.dataCenterRange} range, and the building takes one hit on a ward.`] : [])]); break; }
      case "droneVolley": { let n = 0; for (const o of towersOf(s, a)) if (towerFire(s, a, o, H, null, "Drone Volley: every tower fires now.")) n++;
        if (!n) say(`${a.name} calls a volley, and no tower has anyone in range.`); break; }
      case "platformDataCenter": { const R = s.rules.dataCenter; if (!R || centerSiteError(s, tx, ty, H) || (a.inspiration || 0) < R.inspiration) break; a.inspiration -= R.inspiration;
        const cleared = (s.arena.objects || []).filter((o) => o.x === tx && o.y === ty); s.arena.objects = (s.arena.objects || []).filter((o) => !cleared.includes(o));
        placeCenter(s, a, tx, ty);
        say(`${a.name} raises a data center at (${tx},${ty})${cleared.length ? `; ${cleared.map((o) => o.name || o.type).join(" and ")} cleared for the foundation` : ""}.`,
          [`${R.inspiration} Inspiration (${a.inspiration || 0} left). ${R.hp} HP, half cover, and it blocks the tile.`, "While it stands his AGI's takeoff clock runs double. If it is up when the AGI escapes, the AGI arrives stronger.", "One at a time. Break it and it stays broken until he pays again."]); break; }
      case "platformAccept": { const o = offerOf(a), owner = o && H.actor(s, o.by); withdrawOffer(a);
        if (!owner || owner.defeated || platformOf(s, owner).links.length >= PLATFORM.maxLinks) { say(`${a.name} reaches for the offer, and it is no longer there.`); break; }
        join(s, owner, a, H); break; }
      case "platformBridge": if (tgt) { const [ax, ay] = [a.x, a.y]; a.x = tgt.x; a.y = tgt.y; tgt.x = ax; tgt.y = ay;
          say(`${a.name} bridges to ${tgt.name}: they trade places.`, ["A link makes two places adjacent."]); } break;
      case "platformLock": if (tgt) { const link = platformOf(s, a).links.find((l) => l.id === tgt.id); if (!link) break; link.lock = true;
          say(`${a.name} locks ${tgt.name} in: its refined techniques now run on the platform, ×${PLATFORM.lockMul} while it holds.`, ["Better while the prerequisite is there. He holds the switch."]); } break;
      case "platformDeprecate": if (tgt) { const P = platformOf(s, a), link = P.links.find((l) => l.id === tgt.id); if (!link) break;
          link.lock = false; link.fizzle = tgt.ownerTurns + 1; refuse(P, tgt.side);
          say(`${a.name} deprecates what ${tgt.name} was built on: its refined techniques deal nothing until its next turn ends.`, ["Remove one node and everything downstream of it fails.", `${tgt.name}'s side has seen it: none of them will accept a link from ${a.name} again.`]); } break;
      case "platformShift": { const P = platformOf(s, a), units = P.links.map((l) => [l, s.actors[l.id]]), clients = units.filter(([l]) => l.client);
        P.links = []; P.shifted = true; syncCharge(s, a);
        say(`${a.name} changes the terms: ${units.length} link${units.length === 1 ? "" : "s"} severed, every lock withdrawn${clients.length ? `, and ${clients.map(([, u]) => u.name).join(", ")} billed ${PLATFORM.shiftAp} action points` : ""}.`,
          ["What the platform gave, it takes back.", "Once per battle. His own side loses the network bonus too."]);
        for (const [, u] of clients) { refuse(P, u.side); H.addStun(s, a, u, PLATFORM.shiftAp); } break; }
      case "culturalMoment": { const hy = hypeOf(s, a), n = live(s).filter((u) => believes(s, a, u)).length; hy.moment = n > 0; hy.momentUsed = true;
        say(n ? `${a.name} declares a Cultural Moment: ${n} believer${n === 1 ? "" : "s"} will lose ${s.rules.hype.momentAp} action points a turn until one of them Observes ${a.name}.` : `${a.name} declares a Cultural Moment, and nobody believes it.`,
          ["Perception moves faster than proof.", "One Observation ends it for the observer's whole side."]); break; }
      case "dependence": for (const u of near(s, a, w.radius, H, "enemy")) st(u).dependent = { on: a.id, until: u.ownerTurns + w.turns };
        say(`${a.name} makes every nearby enemy depend on staying close: their bigger techniques fail beyond 4 tiles of ${a.name}.`, ["The opponent defends the output while ignoring its prerequisite."]); break;
      case "departureFor": if (tgt) { st(tgt).departure = { uses: 1, until: tgt.ownerTurns + 2, by: a.id }; say(`${tgt.name} will be elsewhere when the next hit arrives.`); } break;
      case "fulcrum": { const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => H.inside(s, a.x + dx, a.y + dy) && (H.tileAt(s, a.x + dx, a.y + dy).blocksMove || H.barrierAt(s, a.x + dx, a.y + dy) || H.heightAt(s, a.x + dx, a.y + dy) > H.heightAt(s, a.x, a.y)));
        if (ok) { st(a).fulcrum = { until: until(2), x: a.x, y: a.y }; say(`${a.name} braces on a support: a fulcrum for leverage.`); } else say(`${a.name} finds nothing to brace against.`, ["A lever needs a fixed point."]); break; }
      case "unchained": { enrage(s, a, H, "Unchained crosses every threshold at once.");
        const took = S(s).took[a.id], roundDmg = took?.round === s.round ? took.amount : 0;
        if (roundDmg > 0) S(s).stored[a.id] = Math.min(30, (S(s).stored[a.id] || 0) + Math.round(roundDmg * 0.8));   // the passive banked 20%; Unchained banks the rest
        st(a).unchained = { round: s.round };
        say(`${a.name} is unchained: rage now, this round's damage banked (${S(s).stored[a.id] || 0} stored), everything adjacent takes it at the round's end.`, ["The round's warning: leave its reach."]); break; }
      case "regrade": {   // INVENTION: cut down a level where raised, fill up one where at grade; the spoil stays in the tile (no stock, no Gaia count, no succession reset)
        if (gradeResisted(s, a, tx, ty, H)) break;
        const h0 = s.arena.height?.[ty]?.[tx] ?? 0, h1 = h0 >= 1 ? h0 - 1 : h0 + 1;
        if (s.arena.height?.[ty]) s.arena.height[ty][tx] = h1;
        const rdx = Math.sign(tx - a.x), rdy = Math.sign(ty - a.y);
        const dir = Math.abs(tx - a.x) >= Math.abs(ty - a.y) ? [rdx, 0] : [0, rdy];
        (S(s).graded ||= {})[tx + "," + ty] = { by: a.id, dir };
        const word = dir[0] === 1 ? "east" : dir[0] === -1 ? "west" : dir[1] === 1 ? "south" : "north";
        say(`${a.name} regrades (${tx},${ty}) to level ${h1}: water and shoves run ${word}.`, ["Cut one side, fill the other: the soil stays in the tile, so no stock changes.", "The as-built mark holds this shape against the next forced regrade."]); break; }
      case "drainage": {   // INVENTION: a redrawn plan replaces the last (one plan per engineer)
        const tiles = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [tx + dx, ty + dy]).filter(([x, y]) => H.inside(s, x, y));
        s.terrainEffects = (s.terrainEffects || []).filter((e) => !(e.kind === "drainage" && e.owner === a.id));
        s.terrainEffects.push({ id: "te" + (++s.seq), kind: "drainage", label: "Drainage Plan", owner: a.id, side: a.side, tiles, expiresAt: a.ownerTurns + ENG.drainTurns });
        say(`${a.name} draws a drainage plan over ${tiles.length} tiles: flood fronts crossing it are routed away for ${ENG.drainTurns} turns.`, ["Water follows the grade you give it."]); break; }
      case "spanShare": {
        const root = (s.arena.objects || []).find((o) => o.x === tx && o.y === ty && isStructure(o));
        if (!root) { say("The structure is gone."); break; }
        const members = spanMembers(s, root);
        for (const o of members) o.span = { members: members.map((m) => m.id), owner: a.id, until: a.ownerTurns + ENG.spanTurns };
        say(`${a.name} shares the span across ${members.length} structure${members.length === 1 ? "" : "s"}: strikes split evenly for ${ENG.spanTurns} rounds.`, ["Distribution changes local stress, not total force.", "Area blasts hit every support at once: common mode, no sharing."]); break; }
      case "shore": {
        if (tgt && tgt.side === a.side && tgt.id !== a.id) {
          for (const u of [a, tgt]) st(u).loadShare = { members: [a.id, tgt.id], cap: ENG.shoreCap, uses: 1, until: u.ownerTurns + ENG.shoreTurns };
          say(`${a.name} shores up ${tgt.name}: the next hit on either splits across both (up to ${ENG.shoreCap} each).`, ["You take half."]); break; }
        const o = (s.arena.objects || []).find((p) => p.x === tx && p.y === ty && isStructure(p));
        if (o) { o.shore = { by: a.id, uses: 1, until: a.ownerTurns + ENG.shoreTurns };
          say(`${a.name} shores up ${o.name || o.type}: its next strike splits half with ${a.name}.`, ["A brace carries what it touches."]); } break; }
      case "loadPath": {   // INVENTION: a re-announced path replaces the last (one zone per engineer)
        const tiles = [];
        for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) if (H.dist(s, tx, ty, x, y) <= 2) tiles.push([x, y]);
        s.terrainEffects = (s.terrainEffects || []).filter((e) => !(e.kind === "loadPath" && e.owner === a.id));
        s.terrainEffects.push({ id: "te" + (++s.seq), kind: "loadPath", label: "Load Path", owner: a.id, side: a.side, tiles, capacity: ENG.pathCapacity, expiresAt: a.ownerTurns + ENG.pathTurns });
        say(`${a.name}: "This ground is graded. Nothing moves here but by my leave." Floods absorb, shoves hold, and structures share strikes until ${ENG.pathCapacity} shared capacity is spent.`, ["One concentrated strike past the capacity collapses protection for every structure at once."]); break; }
      case "perch": { const marks = (st(a).perch ||= { tiles: [] }).tiles;
        if (marks.some(([x, y]) => x === tx && y === ty)) { say(`(${tx},${ty}) is already ${a.name}'s landing point.`); break; }
        marks.push([tx, ty]); if (marks.length > 3) marks.shift();   // INVENTION-ORN-2: 3 marks, FIFO
        say(`${a.name} marks (${tx},${ty}) as a landing point (${marks.length}/3).`, ["A landing is a surveyed endpoint: Swoop reaches it from anywhere."]); break; }
      case "swoop": {   // INVENTION-ORN-3: any range; the marks (cap 3) are the bound
        if (tx !== a.x || ty !== a.y) { H.log(s, { kind: "move", actor: a.id, path: [[a.x, a.y], [tx, ty]], cost: 0, text: `${a.name} swoops to (${tx},${ty}).` }); a.x = tx; a.y = ty; }
        else say(`${a.name} is already on its landing point.`);
        break; }
      case "takeoff": {   // INVENTION-ORN-4/8: the action is the price of the climb, from any grounding
        if (st(a).grounded) { st(a).grounded = null; say(`${a.name} beats back into the air.`); }
        else say(`${a.name} is already aloft.`); break; }
      case "overflight": {   // INVENTION-ORN-6: plan 2 turns + land beside on surveyed + 18 nigredo from above
        if (!tgt || tgt.defeated) break;
        const spot = overflightSpot(s, a, tgt, H);
        if (!spot) { say(`${a.name}'s overflight finds no surveyed landing beside ${tgt.name}.`); break; }
        const tiles = []; for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) tiles.push([x, y]);
        (s.terrainEffects ||= []).push({ id: `view-${++s.seq}`, kind: "planView", label: "Plan View", owner: a.id, side: a.side, tiles, expiresAt: a.ownerTurns + 2 });
        say(`${a.name} reads the whole map in plan for 2 turns: elevation is removed from movement, range, impact and falls for everyone.`, ["The plan read flattens height for both sides.", "Walls, cover and routes still work."]);
        if (spot[0] !== a.x || spot[1] !== a.y) { H.log(s, { kind: "move", actor: a.id, path: [[a.x, a.y], spot], cost: 0, text: `${a.name} lands on (${spot[0]},${spot[1]}) from the overflight.` }); a.x = spot[0]; a.y = spot[1]; }
        H.hit(s, a, tgt, { ...inst, ignoreCover: true }, (inst.potency || 18) * (inst.mult || 1), ["The strike comes from above: cover doesn't apply."], { label: "Overflight", damageType: "nigredo" }); break; }
      case "hold": if (tgt) {
          if (w.markedFirst && (!active(st(tgt).marked, tgt) || st(tgt).marked.by !== a.id)) { say(`${tgt.name} isn't marked by ${a.name}'s gaze: mark them first.`); break; }
          if (w.gaze && gazeReflected(s, a, tgt, H)) { say(`${a.name}'s gaze comes back off the water: no hold on ${tgt.name}.`, ["A reflected gaze can't hold."]); break; }
          st(tgt).held = { by: a.id, freedoms: w.freedoms.slice(), until: tgt.ownerTurns + w.turns, heldSince: tgt.ownerTurns, ...(w.gaze ? { gaze: true } : {}) };
          if (w.freedoms.includes("recoil")) st(tgt).parry = null; if (w.stun) H.addStun(s, a, tgt, w.stun);
          say(w.gaze ? `${a.name} fixes ${tgt.name} in place: no ${w.freedoms.join(" or ")} while the gaze holds.` : `${a.name} holds ${tgt.name}: no ${w.freedoms.join(" or ")} while contact holds.`,
            [w.gaze ? "A gaze hold breaks the moment the sight line does." : "Restricting one movement doesn't immobilize the whole body."]); } break;
      case "holdMore": if (tgt) { const h = st(tgt).held; if (!h || h.by !== a.id) { say(`${a.name} needs a hold on ${tgt.name} first.`); break; } if (!h.freedoms.includes("recoil")) h.freedoms.push("recoil"); st(tgt).parry = null;
          say(`${a.name} adds ${H.ability?.(inst.ability)?.name || "Joint Control"}: ${tgt.name} can't move or recoil (no parry) while the hold lasts.`); } break;
      case "petrify": if (tgt) { const h = st(tgt).held, need = w.heldTurns || 2;
          if (!active(h, tgt) || h.by !== a.id) { say(`${a.name} needs a hold on ${tgt.name} first.`); break; }
          if (tgt.ownerTurns - (h.heldSince ?? tgt.ownerTurns) < need) { say(`${tgt.name} hasn't been held long enough to petrify (${need} turns).`); break; }
          st(tgt).petrified = { by: a.id, until: tgt.ownerTurns + 1 };
          say(`${tgt.name} turns to stone for 1 round: immune, but it can't act.`, ["Stone outlasts the gaze: the round runs even if the line breaks."]); } break;
      case "gazeGarden": { const caught = live(s).filter((u) => u.id !== a.id && H.dist(s, a.x, a.y, u.x, u.y) <= (w.radius || 6) && H.hasSight(s, a.x, a.y, u.x, u.y) && !gazeReflected(s, a, u, H));
          for (const u of caught) st(u).held = { by: a.id, freedoms: ["move"], until: u.ownerTurns + (w.turns || 3), heldSince: u.ownerTurns, gaze: true };
          say(caught.length ? `${a.name} opens the Stone Garden: ${caught.map((u) => u.name).join(", ")} held while each gaze line holds.` : `${a.name} opens the Stone Garden, but no open gaze meets anyone.`, ["Break a line and that unit is freed."]); } break;
      case "compare": case "check": case "facts": if (tgt) inferenceAct(s, a, tgt, w.kind, H, say); break;
      case "authenticate": if (tgt) { const fakes = ["mimic", "illusion", "disguise", "decoy", "departure"].filter((k) => st(tgt)[k]); for (const k of fakes) st(tgt)[k] = null;
          say(fakes.length ? `${a.name} authenticates ${tgt.name}: ${fakes.join(", ")} stripped.` : `${tgt.name} passes authentication: nothing false to strip.`, ["Identity is a claim to test; true claims survive."]); } break;
      case "caseClosed": { const seen = new Set(s.observedAbilities?.[a.id] ? Object.values(s.actors).filter((u) => (s.log || []).some((e) => e.kind === "act" && e.actor === u.id)).map((u) => u.id) : []);
        const hit = near(s, a, w.radius, H, "enemy").filter((u) => seen.has(u.id));
        for (const u of hit) { expose(u, a, 1.15); stripOne(u); }
        say(hit.length ? `${a.name} closes the case on ${hit.map((u) => u.name).join(", ")}: exposed.` : `${a.name} hasn't seen enough to close the case.`); break; }
      case "assign": {
        if (!tgt || tgt.defeated) break;
        const mate = live(s).filter((u) => u.side === a.side && u.id !== a.id && !u.notArrived).sort((p, q) => H.dist(s, p.x, p.y, tgt.x, tgt.y) - H.dist(s, q.x, q.y, tgt.x, tgt.y))[0];
        if (!mate) { say(`${a.name} has no one to give the order to.`); break; }
        st(mate).order = { from: a.id, target: tgt.id, mul: ORDER_MUL, offMul: ORDER_OFF_MUL, until: mate.ownerTurns + 2 };
        say(`${a.name} orders ${mate.name}: take ${tgt.name}. The order holds for two of ${mate.name}'s turns, even without ${a.name}.`, ["A standing order is carried out by its holder: hits on the objective ×1.25, on anyone else ×0.9. It can't be updated, only replaced."]); break;
      }
      case "delegate": {
        if (!tgt) break;
        const o = orderOf(tgt); if (!o) { say(`${tgt.name} holds no order to delegate from.`); break; }
        o.until += 1; tgt.delegatedApAdd = (tgt.delegatedApAdd || 0) + 20;
        say(`${a.name} leaves the method to ${tgt.name}: the order runs one turn longer and their next turn starts with +20 AP.`, ["Delegation transfers decisions, not authority: the objective and limits are exactly as issued."]); break;
      }
      case "operationOrder": {
        if (!tgt || tgt.defeated) break;
        const crew = live(s).filter((u) => u.side === a.side && u.id !== a.id && !u.notArrived);
        for (const u of crew) st(u).order = { from: a.id, target: tgt.id, mul: ORDER_MUL, offMul: ORDER_OFF_MUL, until: u.ownerTurns + 2 };
        say(crew.length ? `${a.name} issues the operation: ${crew.map((u) => u.name).join(", ")} take ${tgt.name}. The order holds for two of their turns.` : `${a.name} issues an operation order, but there is no one to carry it.`, ["Each unit follows the same plan: ×1.25 on the objective, ×0.9 on anyone else."]); break;
      }
      case "convergence": {
        if (!tgt || tgt.defeated) break;
        const crew = [a, ...live(s).filter((u) => u.side === a.side && u.id !== a.id && !u.notArrived && H.hasSight(s, u.x, u.y, tgt.x, tgt.y))
          .sort((p, q) => H.dist(s, p.x, p.y, tgt.x, tgt.y) - H.dist(s, q.x, q.y, tgt.x, tgt.y) || (p.id < q.id ? -1 : 1))].slice(0, 4);
        const base = inst.potency || 10, notes = [];
        let total = 0;
        for (const u of crew) {
          let part = base;
          const o = u === a ? null : orderOf(u);
          if (o && o.target === tgt.id) { part *= o.mul; notes.push(`${u.name}'s standing order on ${tgt.name} adds ×${o.mul} to their share.`); }
          if (u !== a) { u.nextActionCostAdd = (u.nextActionCostAdd || 0) + 50; notes.push(`${u.name} gives up 50 AP next turn for this.`); }
          total += part;
        }
        if (recovering(s, tgt)) { total *= 1.25; notes.push(`${tgt.name} is in its recovery window ×1.25.`); }
        notes.unshift(`${crew.length} contributor${crew.length === 1 ? "" : "s"}: ${crew.map((u) => u.name).join(", ")}.`);
        H.hit(s, a, tgt, inst, total * (inst.mult || 1), notes, { label: "Decisive Convergence" }); break;
      }
      case "pounce": {
        if (!tgt || tgt.defeated) break;
        const spot = pounceSpot(s, a, tgt, w.range, H);
        if (!spot) { say(`${a.name} springs, but there is no open tile beside ${tgt.name}: she lands short.`); a.focus = null; break; }
        const bonus = Math.min(16, Math.max(0, spot.d - 1) * 4);
        if (spot.d > 0) { H.log(s, { kind: "move", actor: a.id, path: [[a.x, a.y], spot.at], cost: 0, text: `${a.name} leaps ${spot.d} tile${spot.d === 1 ? "" : "s"} to (${spot.at[0]},${spot.at[1]}).` }); a.x = spot.at[0]; a.y = spot.at[1]; }
        a.focus = null;
        H.hit(s, a, tgt, { ...inst, ignoreCover: true }, (inst.potency + bonus) * (inst.mult || 1), [`The leap stores ${bonus ? `+${bonus}` : "no extra"} force (+4 per tile beyond the first, max +16).`, "Her Focus is spent."], { label: "Pounce" }); break;
      }
      case "clockRewind": {
        // INVENTION (brief gap: "last scheduled action"): the last dealt damage from Escapement, Tick, Gear Train,
        // or Complication operations (Rewind itself never overwrites, so replays don't decay into chains).
        const last = S(s).lastScheduled?.[a.id] || 0;
        if (!tgt || tgt.defeated) { say("Rewind finds no target standing."); break; }
        if (!(last > 0)) { say("Rewind has nothing to replay: no scheduled action has resolved."); break; }
        const potency = Math.max(1, Math.round(last * CLOCKWORK.rewindMul));
        H.hit(s, a, tgt, { ...inst, ability: "rewind", name: "Rewind", concept: "timing", damageType: "albedo" }, potency, [`Rewind re-runs the last scheduled action (${last}) at x${CLOCKWORK.rewindMul}: ${potency}.`], { label: "Rewind", damageType: "albedo" });
        woundRefund(s, a, "rewind", H);
        say(`${a.name} rewinds: ${tgt.name} takes the last schedule again at x${CLOCKWORK.rewindMul} (${potency}).`); break; }
      case "clockComplication": {
        if (!tgt || tgt.defeated) { say("Grand Complication names no one standing."); break; }
        // INVENTION (brief gap: "obstruction"): defeat, leaving range 6, or leaving sight jams the remainder.
        st(a).complication = { round: s.round, target: tgt.id, ops: CLOCKWORK.complicationOps, potency: CLOCKWORK.complicationPotency, range: CLOCKWORK.complicationRange };
        woundRefund(s, a, "grandComplication", H);
        say(`${a.name} announces the Grand Complication: ${CLOCKWORK.complicationOps} operations of ${CLOCKWORK.complicationPotency} on ${tgt.name}, on the beat at the round's end.`, ["Unstoppable by reactions: Guard cannot answer any of them.", "Read the schedule and be elsewhere: defeat, range or sight jams the remainder."]); break; }
      case "rogueCut": {   // Cut Purse: a cut, not a hit — no resistance, no barrier, and no name in the log
        if (!tgt || tgt.defeated || H.dist(s, a.x, a.y, tgt.x, tgt.y) > 1) { say(`${a.name}'s cut finds no mark in reach.`); break; }
        const cache = (st(a).cutGoods ||= []);
        const goods = cache.length < ROGUE.cacheCap ? rogueBestGoods(tgt, H, 1) : [];
        if (!goods.length) { say(cache.length >= ROGUE.cacheCap ? `${a.name}'s cut cache is full (${ROGUE.cacheCap}): the cut takes nothing.` : `${tgt.name} carries nothing worth cutting.`); break; }
        const item = goods[0];
        (tgt.inventory || []).splice(tgt.inventory.indexOf(item), 1);
        cache.push(item);
        rogueCutBlind(s, tgt);
        say(`${a.name} cuts ${tgt.name}'s purse: something is missing and ${tgt.name} doesn't know what (a clean cut leaves no trace for 1 round).`, [`${cache.length}/${ROGUE.cacheCap} cut goods waiting for Pocket.`]); break; }
      case "rogueDisarm": {
        if (!tgt || tgt.defeated || H.dist(s, a.x, a.y, tgt.x, tgt.y) > 1) { say(`${a.name}'s disarm finds no mark in reach.`); break; }
        if (st(tgt).disarmed && active(st(tgt).disarmed, tgt)) { say(`${tgt.name} is already disarmed: one stripped edge at a time.`); break; }
        const lens = rogueStripLens(tgt, H), gear = lens ? null : rogueStripGear(tgt);
        if (!lens && !gear) { say(`${tgt.name} holds no lens or gear worth stripping.`); break; }
        if (lens) { (tgt.lens ||= {})[lens.concept] = lens.dflt; st(tgt).disarmed = { kind: "lens", concept: lens.concept, profile: lens.profile, until: tgt.ownerTurns + ROGUE.disarmTurns }; }
        else { delete tgt.passives[gear.key]; st(tgt).disarmed = { kind: "gear", key: gear.key, value: gear.value, until: tgt.ownerTurns + ROGUE.disarmTurns }; }
        rogueCutBlind(s, tgt);
        say(`${a.name} disarms ${tgt.name}: an edge is gone for ${ROGUE.disarmTurns} turns, weighed too late to name (a clean cut).`, ["The stripped lens or gear returns after 2 of the mark's turns."]); break; }
      case "roguePocket": {
        const cache = st(a).cutGoods || [], inv = a.inventory || (a.inventory = []), cap = a.inventoryCapacity ?? 0, names = [];
        while (cache.length && inv.length < cap) { const item = cache.shift(); inv.push(item); (st(a).pocketed ||= []).push(item); names.push(H.itemName(item)); }
        say(names.length ? `${a.name} pockets ${names.join(", ")}.` : cache.length ? `${a.name}'s hands are full (${cap} slots): the cut goods wait.` : `${a.name} has nothing cut to pocket.`); break; }
      case "rogueFence": {   // INVENTION-ROGUE-6: the fence pays Seeds at the loot sell rate, or ΦF at half rate while the Rogue runs below half focus (no choice UI exists; need decides)
        const held = roguePocketed(a);
        if (!held.length) { say(`${a.name} has nothing pocketed to fence.`); break; }
        const best = rogueFenceBest(held, H), sell = rogueSell(H, best);
        a.inventory.splice(a.inventory.indexOf(best), 1);
        st(a).pocketed.splice(st(a).pocketed.indexOf(best), 1);
        if (a.pf < (a.maxPF ?? a.pf) / 2) { const gain = Math.floor(sell * ROGUE.fencePhiShare); a.pf = Math.min(a.maxPF ?? (a.pf + gain), a.pf + gain);
          say(`${a.name} fences ${H.itemName(best)} for fast focus: +${gain} ΦF (half the ${sell}-Seed loot rate).`, ["Below half focus, the fence pays in focus."]); }
        else { s.seeds = (s.seeds || 0) + sell; say(`${a.name} fences ${H.itemName(best)}: +${sell} Seeds in battle spoils.`, ["The fence pays full loot rates, banked."]); }
        break; }
      case "rogueHeist": {
        if (!tgt || tgt.defeated || H.dist(s, a.x, a.y, tgt.x, tgt.y) > 1) { say(`${a.name}'s heist finds no mark in reach: the approach is called off.`); break; }
        const inv = a.inventory || (a.inventory = []), cap = a.inventoryCapacity ?? 0, cache = (st(a).cutGoods ||= []), takes = [];
        for (const item of rogueBestGoods(tgt, H, ROGUE.heistCuts)) {   // INVENTION-ROGUE-7: what the hands can't hold, the cache keeps (cap 3 either way); what neither can hold stays on the mark
          if (inv.length < cap) { inv.push(item); (st(a).pocketed ||= []).push(item); takes.push(`${H.itemName(item)} (pocketed)`); }
          else if (cache.length < ROGUE.cacheCap) { cache.push(item); takes.push(`${H.itemName(item)} (cut)`); }
          else break;
          tgt.inventory.splice(tgt.inventory.indexOf(item), 1);
        }
        const buff = rogueBuffOf(tgt); let buffTake = null;
        if (buff) { const heldBuff = tgt.status[buff]; tgt.status[buff] = null;
          if (!st(a)[buff]) { st(a)[buff] = { ...heldBuff, owner: a.id }; buffTake = buff; } }   // INVENTION-ROGUE-8: a lifted buff the Rogue already holds is cut, not pocketed (protections never stack)
        const step = rogueVanishStep(s, a, tgt, H);
        if (step) { a.x = step[0]; a.y = step[1]; a.moved = true; }
        st(a).concealed = { until: a.ownerTurns + 1 };
        rogueCutBlind(s, tgt);
        say(`${a.name} pulls the heist on ${tgt.name}: ${takes.length ? takes.join(", ") : "empty pockets"}${buffTake ? `, ${buffTake} lifted` : buff ? `, ${buff} cut loose` : ""} — then ${step ? `one quiet step to (${step[0]},${step[1]})` : "vanishes in place"} (Concealed 1 round).`); break; }
      case "ltSkim": H.Longtermism?.skim(s, a, tgt, s.rules.longtermism?.skimLf ?? 6); break;
      case "ltInvest": H.Longtermism?.invest(s, a); break;
      case "ltCall": break;
      case "ltContract": H.Longtermism?.skim(s, a, tgt, s.rules.longtermism?.contractLf ?? 12); H.Longtermism?.invest(s, a); break;
      case "memorialRoll": { const mem = a.memorial || { principal: 0, honored: [] }, n = Math.min(3, mem.principal || 0);
        const ward = Math.min(30, 6 * n), dmg = Math.min(20, 4 * (mem.honored?.length || 0)), R = w.radius || 3;
        const kin = live(s).filter((u) => u.side === a.side && H.dist(s, a.x, a.y, u.x, u.y) <= R);
        const foes = live(s).filter((u) => u.side !== a.side && H.dist(s, a.x, a.y, u.x, u.y) <= R);
        for (const u of kin) st(u).ward = { label: "Roll of Honor", owner: a.id, protection: ward, expiresAt: u.ownerTurns + (hasT(a, "steadyHands") ? 3 : 2) };
        if (hasT(a, "eulogy") && !a.eulogized && kin.includes(a)) { a.eulogized = true; a.lf = Math.min(a.maxLF, a.lf + 6);
          say(`${a.name} speaks her own eulogy first: +6 LF.`, ["Eulogy: once a battle, the Roll mends its reader."]); }
        for (const u of foes) H.hit(s, a, u, inst, dmg, [`Roll of Honor: the ${mem.honored?.length || 0} honored dead weigh on ${u.name}.`], { label: "Roll of Honor", damageType: "citrinitas" });
        a.memorial = { principal: 0, honored: [] };
        say(`${a.name} reads the Roll of Honor (${(mem.honored || []).join(", ") || "no names"}): ward ${ward} on ${kin.length}, ${dmg} on ${foes.length}. The ledger empties.`,
          [n ? "Grief is principal." : "An empty ledger reads nothing."]); break; }
      case "seedCache": case "seedBloom": { const role = w.kind === "seedCache" ? "seed-cache" : "seed-bloom";
        s.arena.objects = s.arena.objects || [];
        s.arena.objects.push({ id: `${role}-${++s.seq}`, type: role, role, name: w.kind === "seedCache" ? "Buried cache" : "Timed bloom",
          owner: a.id, x: tx, y: ty, hp: 10, maxHp: 10, cover: 0, sightHeight: 0, blocksMove: false, material: "earth",
          ...(w.kind === "seedBloom" ? { fuse: 2 } : {}) });
        if (hasT(a, "posterity") && !a.posterityUsed) { a.posterityUsed = true; a.pf = Math.min(a.maxPF ?? 30, (a.pf ?? 0) + 1);
          say(`Posterity: the first bury is cheap — +1 ΦF back.`); }
        say(`${a.name} buries ${w.kind === "seedCache" ? "a cache" : "a timed bloom"} at (${tx},${ty}).`,
          [w.kind === "seedCache" ? "The next ally to start a turn there digs up +20 AP." : "It blooms on her next two turns: +10 AP and +1 ward to allies within 2."]); break; }
      case "ferrySwap": { const px = a.x, py = a.y; a.x = tgt.x; a.y = tgt.y; tgt.x = px; tgt.y = py;
        const toll = a.fareUsed ? (hasT(a, "tollkeeper") ? 12 : 10) : 0; a.fareUsed = true;
        if (toll) tgt.tempoDebt = (tgt.tempoDebt || 0) + toll;
        say(`${a.name} ferries ${tgt.name} across: they trade places${toll ? `; the passenger owes ${toll} AP.` : "; the first crossing is free."}`,
          [toll ? "The fare is always owed, even when the crossing saves a life." : "The Fare: one free crossing a battle."]); break; }
      case "ferryLast": { const seats = [];
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue; const nx = a.x + dx, ny = a.y + dy;
          if (H.inside(s, nx, ny) && !H.tileAt(s, nx, ny).blocksMove && !H.actorAt(s, nx, ny)) seats.push([nx, ny]);
        }
        const riders = live(s).filter((u) => u.side === a.side && u.id !== a.id && H.dist(s, a.x, a.y, u.x, u.y) <= (w.radius || 4));
        let ferried = 0;
        for (const u of riders) { const seat = seats.shift(); if (!seat) break;
          u.x = seat[0]; u.y = seat[1]; ferried++; }
        a.tempoDebt = (a.tempoDebt || 0) + 20;
        for (const u of live(s).filter((u) => u.side !== a.side && H.dist(s, a.x, a.y, u.x, u.y) <= 2))
          H.hit(s, a, u, inst, 8, [`The Last Crossing churns the water around ${a.name}.`], { label: "The Last Crossing", damageType: "citrinitas" });
        say(`${a.name} rows the Last Crossing: ${ferried} ferried home, and he owes 20 AP for every fare at once.`,
          [riders.length > ferried ? "The crossing only rows so many seats." : "Nobody left standing out there."]); break; }
      case "diveDescend": { const still = tx === a.x && ty === a.y; a.x = tx; a.y = ty; a.moved = true;
        st(a).concealed = { until: a.ownerTurns + 1 + (hasT(a, "breathHolder") ? 1 : 0) };
        say(still ? `${a.name} goes still in the shallows (Concealed${hasT(a, "breathHolder") ? ", long breath" : ""}).`
          : `${a.name} slips to (${tx},${ty}) and goes quiet (Concealed${hasT(a, "breathHolder") ? ", long breath" : ""}).`,
          [hasT(a, "breathHolder") ? "Breath-Holder: the quiet lasts an extra turn." : "Still water hides everything."]); break; }
      case "diveUndertow": { const basins = diverBasins(s, a);
        const deep = basins.slice().sort((p, q) => H.dist(s, a.x, a.y, p.x, p.y) - H.dist(s, a.x, a.y, q.x, q.y))[0];
        H.hit(s, a, tgt, inst, 6, [`Undertow catches ${tgt.name}: 6.`], { label: "Undertow", damageType: "nigredo" });
        if (!tgt.defeated && !resistKnock(s, a, tgt, H, 2, inst)) {
          let steps = 0;
          for (; steps < 2; steps++) {
            const d0 = H.dist(s, tgt.x, tgt.y, deep.x, deep.y);
            const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [tgt.x + dx, tgt.y + dy])
              .find(([nx, ny]) => H.inside(s, nx, ny) && !H.tileAt(s, nx, ny).blocksMove && !H.actorAt(s, nx, ny) && H.dist(s, nx, ny, deep.x, deep.y) < d0);
            if (!next) break;
            tgt.x = next[0]; tgt.y = next[1];
          }
          say(steps ? `${a.name}'s undertow drags ${tgt.name} ${steps} tile${steps > 1 ? "s" : ""} toward the deep at (${deep.x},${deep.y}).`
            : `${tgt.name} holds their footing at the edge of the current.`,
            ["The current decides, not the swimmer."]);
        } break; }
      case "diveDrown": { const basins = diverBasins(s, a), burst = basins.find((b) => b.x === tx && b.y === ty) || basins[0];
        burst.list.splice(burst.list.indexOf(burst.ref), 1);
        const back = Math.min(14, Math.max(0, (basins.length - 1) * 2));
        if (back) a.pf = Math.min(a.maxPF ?? 30, (a.pf ?? 0) + back);
        const R = w.radius || 2, wet = { x: burst.x, y: burst.y };
        const foes = live(s).filter((u) => u.side !== a.side && H.dist(s, burst.x, burst.y, u.x, u.y) <= R);
        for (const u of foes) { const bonus = diverVeiled(u) || diverInWater(s, a, u.x, u.y, H, [wet]) ? 6 : 0;
          H.hit(s, a, u, inst, 18 + bonus, [`Drown: the burst basin at (${burst.x},${burst.y}) spends itself on ${u.name}${bonus ? " (+6: caught wet or unseen)" : ""}.`], { label: "Drown", damageType: "citrinitas" }); }
        say(`${a.name} bursts her basin at (${burst.x},${burst.y}): ${foes.length} caught in the deep${back ? `, and the other ${basins.length - 1} pay back ${back} ΦF` : ""}.`,
          [foes.length ? "Still water drowns deepest." : "The basin bursts on empty water."]); break; }
      case "steamAdvance": { const p = steamPath(s, H, a, tx, ty, w.range);
        if (p.error) { say(`${a.name}'s Advance stalls: ${p.error}`); break; }
        const [ex, ey] = p.path[p.path.length - 1];
        H.log(s, { kind: "move", actor: a.id, path: [[a.x, a.y], [ex, ey]], cost: 0, text: `${a.name} advances ${p.path.length} tile${p.path.length === 1 ? "" : "s"} to (${ex},${ey}): nothing smaller stops it.` });
        a.x = ex; a.y = ey; a.moved = true; break; }
      case "blowOff": steamVent(s, a, H, say, "blowOff", "Blow-off"); break;
      case "fullSteam": { (S(s).pressure ||= {})[a.id] = STEAM.max;
        say(`${a.name} builds to a full head of steam: pressure ${STEAM.max}.`);
        const p = steamPath(s, H, a, tx, ty, w.range);
        if (!p.error) { const [ex, ey] = p.path[p.path.length - 1];
          H.log(s, { kind: "move", actor: a.id, path: [[a.x, a.y], [ex, ey]], cost: 0, text: `${a.name} charges ${p.path.length} tile${p.path.length === 1 ? "" : "s"} to (${ex},${ey}).` });
          a.x = ex; a.y = ey; a.moved = true; }
        else say(`The charge finds no run (${p.error}): ${a.name} vents where it stands.`);
        steamVent(s, a, H, say, "fullHeadOfSteam", "Full Head of Steam"); break; }
      case "buff": buff(s, a, w.buff, H, say, until); break;
      default: return false;
    }
    Suits?.noteSetup?.(s, a, inst, H);   // Posterity: first setup refunds AP+ΦF and grants 1 Inspiration
    return true;
  }
  // Inference ledger: sources about a target, by provenance. Two independent sources confirm.
  function ledger(s, a, t) { const L = (S(s).ledger ||= {}); return ((L[a.id] ||= {})[t.id] ||= []); }
  function addSource(s, a, t, src) { const l = ledger(s, a, t); if (!l.includes(src)) l.push(src); return l; }
  function expose(u, by, mul) { st(u).confirmed = { by: by.id, side: by.side, mul, until: u.ownerTurns + 1 }; }
  function stripOne(u) { for (const k of ["guard", "ward", "anchor", "membrane", "parry", "intercept", "departure", "decoy"]) if (st(u)[k]) { st(u)[k] = null; return k; } return null; }
  function inferenceAct(s, a, t, kind, H, say) {
    if ((s.insight?.knowledge?.[a.id]?.[t.id]?.revealed || []).length) addSource(s, a, t, "observed");
    if ((s.log || []).some((e) => e.kind === "act" && e.actor === t.id && H.hasSight(s, a.x, a.y, t.x, t.y))) addSource(s, a, t, "witnessed");
    if (kind === "check") { if (!H.hasSight(s, a.x, a.y, t.x, t.y)) { say("No clear line: no evidence."); return; } addSource(s, a, t, "direct"); }   // direct observation is ONE source, however often you look
    const l = ledger(s, a, t), need = active(st(a).isolated, a) ? 1 : 2, ok = l.length >= need;
    if (kind === "facts") {
      if (!ok) { say(`${a.name} can't establish the facts on ${t.name} yet: ${l.length}/${need} independent sources.`); return; }
      const gone = []; let k; while ((k = stripOne(t))) gone.push(k);
      expose(t, a, 1.25); say(`${a.name} establishes the facts: ${t.name} is exposed to everyone${gone.length ? ` and loses ${gone.join(", ")}` : ""}.`, ["Attack the prerequisite, not the visible output."]); return;
    }
    if (ok) { expose(t, a, 1.25); if (st(a).isolated) st(a).isolated = null; say(`${a.name} confirms a read on ${t.name} from ${l.length} independent sources: hits on it ×1.25 this round.`, ["Confidence depends on evidence structure, not report count."]); }
    else say(`${a.name} has ${l.length} source${l.length === 1 ? "" : "s"} on ${t.name} (${l.join(", ") || "none"}); one more independent source confirms it.`);
  }
  function buff(s, a, kind, H, say, until) {
    const C = S(s);
    switch (kind) {
      case "pairBonus": st(a).pairBonus = { mul: 1.2, uses: 1, until: until(1) }; say(`${a.name}'s second contribution primes the next technique ×1.2.`); break;
      case "chained": st(a).chained = { mul: 1.15, uses: 2, until: until(1) }; say(`${a.name} chains the next two techniques (×1.15 each).`); break;
      case "reorder": a.pf = Math.min(a.maxPF, a.pf + 2); st(a).chained = { mul: 1.1, uses: 1, until: until(1) }; say(`${a.name} changes the order: +2 ΦF, next technique ×1.1.`); break;
      case "inputFilter": st(a).inputFilter = { channel: a.lastDamageType || "albedo", until: until(2) }; say(`${a.name} filters inputs: hits of other channels ×0.85.`); break;
      case "vow": st(a).vow = { restriction: "noMove", mul: 1.3, until: until(2) }; say(`${a.name} binds a term: no movement for 2 turns, techniques ×1.3.`, ["A real restriction for a bounded benefit."]); break;
      case "installed": for (const b of s.barriers.filter((b) => b.owner === a.id)) b.protection = Math.round((b.protection || 0) * 1.5); st(a).installed = { until: until(3) }; say(`${a.name} installs a prerequisite: your constructs are 50% stronger while you stand.`); break;
      case "decoy": st(a).decoy = { uses: 1, until: until(1) }; say(`${a.name} manufactures a choice: the next hit on them is ×0.5.`); break;
      case "failover": C.spares[a.id] = (C.spares[a.id] ?? 2) - 1; if (C.spares[a.id] < 0) { say(`${a.name} has no spares left.`); break; }
        for (const k of ["stun", "silenced", "choked"]) if (st(a)[k]) st(a)[k] = null; a.lf = Math.min(a.maxLF, a.lf + 8); say(`${a.name} fails over to a spare: statuses cleared, +8 LF (${C.spares[a.id]} spare${C.spares[a.id] === 1 ? "" : "s"} left).`); break;
      case "degraded": st(a).degraded = { until: until(3) }; say(`${a.name} degrades gracefully: takes ×0.8, deals ×0.85.`); break;
      case "overdrive": C.strain[a.id] = (C.strain[a.id] || 0) + 1; st(a).overdrive = { mul: 1.3, uses: 1, until: until(1) }; say(`${a.name} overdrives (strain ${C.strain[a.id]}/3).`);
        if (C.strain[a.id] >= 3) { H.hit(s, a, a, null, 15, ["Overdrive strain reaches 3: the machine overheats."], { label: "Overheat", damageType: "rubedo" }); H.addStun(s, a, a, 50); C.strain[a.id] = 0; } break;
      case "departure": st(a).departure = { uses: 1, until: until(1) }; say(`${a.name} arms a departure: the next hit finds an empty tile.`); break;
      case "arrivalGate": st(a).arrivalGate = { until: until(3) }; say(`${a.name} sets an arrival gate: transfers refuse unsafe endpoints.`); break;
      case "growth": { const g = st(a).growth || { stacks: 0 }; if (g.stacks < 3) { g.stacks++; a.maxLF += 8; a.lf += 8; } st(a).growth = g; say(`${a.name} grows from the load (stack ${g.stacks}/3: +8 max LF, harder to move; upkeep 1 ΦF a turn per stack).`, ["Growth is a costly response to loading."]); break; }
      case "heavyFrame": { const n = st(a).growth.stacks; a.lf = Math.min(a.maxLF, a.lf + 15 * n); a.tempo = Math.max(0, a.tempo - 10 * n); say(`${a.name} sets a heavy frame: +${15 * n} LF, −${10 * n} AP.`); break; }
      case "yield": st(a).yield = { mul: 0.7, until: until(1) }; say(`${a.name} yields: impact and contact hits ×0.7, the rest is stored.`); break;
      case "warCry": st(a).warCry = { uses: 1, until: until(2) }; say(`${a.name} cries out: the first ally to drop below half LF sends them back into the fight (+50 AP).`); break;
      case "berserk": { const pay = Math.min(10, Math.max(0, a.lf - 1)); a.lf -= pay; enrage(s, a, H, `Berserk pays ${pay} LF to cross now.`); say(`${a.name} goes berserk (−${pay} LF).`); break; }
      case "takeIt": st(a).takeIt = { uses: 1, until: until(1) }; say(`${a.name} braces: the next hit stores 40%.`); break;
      case "valve": st(a).steamValve = { threshold: STEAM.valveThreshold }; addPressure(s, a, 0, H); say(`${a.name} sets the valve: the boiler must vent at ${STEAM.valveThreshold} pressure (sooner, smaller) until the next vent.`); break;
      case "revised": st(a).revised = { round: s.round };
        for (const k of Object.keys(s.insight?.knowledge || {})) if (s.insight.knowledge[k]?.[a.id]) s.insight.knowledge[k][a.id] = { revealed: [], progress: 0, invested: 0 };
        say(`${a.name}'s answer has changed: what anyone observed about them no longer applies.`, ["Persistent adaptation differs from elastic recovery."]); break;
      case "isolated": st(a).isolated = { until: until(2) }; say(`${a.name} isolates the variable: the next read needs only one source.`); break;
      case "specialized": st(a).specialized = { up: a.lastDamageType || "nigredo", until: until(99) }; say(`${a.name} specializes: ${st(a).specialized.up} ×1.3 out, but everything else hits them ×1.15.`); break;
    }
  }

  // ── during a hit ──
  function redirect(s, src, tgt, inst, H) {
    if (!src || !tgt?.status) return tgt;
    { const h = tgt.status.holoSwarm, blast = inst?.delivery === "field" || ["radius", "plus", "board", "cone"].includes(inst?.area?.shape), n = h && !blast && h.until >= tgt.ownerTurns && src.side !== tgt.side ? towersOf(s, tgt).length : 0;   // Holographic Swarm: n holograms and him
      if (n > 0) { s.holoN = (s.holoN || 0) + 1; if ((H.seededChance?.(`${s.seed}:holo:${tgt.id}:${s.holoN}`) ?? 1) < n / (n + 1)) {
        H.log(s, { kind: "effect", actor: tgt.id, target: src.id, text: `${src.name}'s attack goes through a hologram of ${tgt.name}.`, why: [`Holographic Swarm: ${n} hologram${n === 1 ? "" : "s"} and one of him.`] }); return null; } } }
    const stealthRedirect = Stealth.redirect(s, src, tgt, inst, H);
    if (stealthRedirect !== undefined) return stealthRedirect;
    const dep = tgt.status.departure;
    if (active(dep, tgt) && dep.uses > 0 && inst) {
      const spot = (S(s).visited[tgt.id] || []).slice().reverse().find(([x, y]) => (x !== tgt.x || y !== tgt.y) && free(s, x, y, H))
        || [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [tgt.x + dx * 2, tgt.y + dy * 2]).find(([x, y]) => free(s, x, y, H));
      if (spot) { dep.uses--; tgt.x = spot[0]; tgt.y = spot[1]; H.log(s, { kind: "effect", actor: tgt.id, text: `${tgt.name} is elsewhere when it lands (departure).` }); return null; }
    }
    const ic = tgt.status.intercept;
    if (active(ic, tgt) && ic.uses > 0) {
      const blast = inst?.delivery === "field" || ["radius", "plus", "board", "cone"].includes(inst?.area?.shape);
      if (!blast || !ic.skipBlast) {
        const g = H.actor(s, ic.by);
        if (g && !g.defeated && g.id !== tgt.id && !Esker.exempt(s, src, ic) && H.dist(s, g.x, g.y, tgt.x, tgt.y) <= (ic.range ?? 3)) {
          ic.uses--; if (ic.between) Esker.crossed(s, src, tgt, g, H);   // Esker: whoever strikes across first is marked H.log(s, { kind: "effect", actor: g.id, target: tgt.id, text: `${g.name} steps between: the hit meant for ${tgt.name} lands on ${g.name}.`, why: ["Redirecting a consequence doesn't erase it."] });
          S(s).interceptMul = oathOf(g) && wardOf(s, g) ? Math.min(ic.mul ?? 1, 0.6) : ic.mul;   // Unbroken Oath: the block barely gives
          return g;
        }
      }
    }
    return tgt;
  }
  function damageMods(s, src, tgt, inst, damageType, H) {
    let mult = 1; const notes = [];
    const m = (k, why) => { mult *= k; notes.push(why); };
    if (S(s).interceptMul && S(s).interceptMul !== 1) { m(S(s).interceptMul, `Intercepted on the shield ×${S(s).interceptMul}.`); }
    { const e = Esker.damageMods(s, src, tgt, inst); if (e.mult !== 1) { mult *= e.mult; notes.push(...e.notes); } }   // Esker: burden, Oathbreaker
    { const e = Suits?.damageMods?.(s, src, tgt, inst, damageType, H); if (e && e.mult !== 1) { mult *= e.mult; notes.push(...(e.notes || [])); } }
    if (aeroForce(tgt) === "drag" && inst?.delivery === "line") m(AERO.dragMul, `${tgt.name} is streamlined (Drag): line attacks ×${AERO.dragMul}.`);
    S(s).interceptMul = null;
    const T = tgt.status || {}, A = src?.status || {};
    if (T.shimmer && T.shimmer.until > tgt.ownerTurns && src?.side !== tgt.side && (!inst?.area || inst.area.shape === "single") && H.seededChance?.(`${s.seed}:shimmer:${tgt.id}:${s.round}:${src?.id}:${inst?.ability || "strike"}`) < GLAM.fizzle) m(0, `The shimmer fools ${src?.name || "the attacker"}: the blow lands on nothing.`);
    if (T.denounced && T.denounced.until >= s.round && src && src.side === T.denounced.side && src.id !== T.denounced.by) m(GLAM.denounceMul, `${tgt.name} is Denounced: ×${GLAM.denounceMul}.`);
    if(damageType==="albedo" && active(T.artistMask,tgt)){m(0.65,"Layer Mask admits one albedo hit ×0.65.");delete T.artistMask;}
    if(src && ["rasterPass","renderEngine","compileTheCanvas"].includes(inst?.ability) && active(A.artistCalibration,src) && A.artistCalibration.uses>0){m(1.2,"Calibrated render ×1.2.");delete A.artistCalibration;}
    if(active(T.cyphCare,tgt)){m(0.8,"Cyph's checked service protects the next hit ×0.8.");delete T.cyphCare;}
    if (src && tgt) { const sv = Teleology.servingHit(s, src, tgt); if (sv) m(sv.mult, sv.note); }   // Nova Sovereign Guarantee: one-shot ×1.5, collected
    if (hasTr(tgt, "homestead") && (s.arena.objects || []).some((o) => (o.hp ?? 0) > 0 && o.side === tgt.side && (o.building || (o.tags || []).includes("structure")) && Math.max(Math.abs(o.x - tgt.x), Math.abs(o.y - tgt.y)) === 1)) m(0.8, `${tgt.name} holds her homestead: home ground under her, damage ×0.8.`);
    // Supers' critical weaknesses (insight-data superStrength… traits; carried as passives)
    const P = tgt.passives || {};
    if (P.dreamFragile && s.dreamSpace && s.dreamSpace.owner !== tgt.id) m(P.dreamFragile, `Critical weakness: ${tgt.name} comes apart inside someone else's dream ×${P.dreamFragile}.`);
    if (P.supernaturalDamageTakenMul && src && (src.summon || src.summoned || src.dream || src.kind === "dreamMonster" || src.ai === "dream" || src.ai === "summon"))
      m(P.supernaturalDamageTakenMul, `Critical weakness to the supernatural ×${P.supernaturalDamageTakenMul}.`);
    if (T.maidProtected && src && src.side !== tgt.side && active(T.maidProtected, tgt)) { m(0.5, "Maid's protection softens the next incoming hit ×0.5."); T.maidProtected = null; }
    if (active(T.shieldFace, tgt) && src) { const [dx, dy] = T.shieldFace.dir; if ((dx && Math.sign(src.x - tgt.x) === dx) || (dy && Math.sign(src.y - tgt.y) === dy)) m(0.5, "Shield Face covers this side ×0.5."); }
    if (active(T.yield, tgt) && damageType === "nigredo") m(T.yield.mul, "Yielding Guard ×0.7 (the rest is stored).");
    if (isOrnithopter(tgt) && damageType === "nigredo") m(1.3, "Light frame: impact ×1.3.");   // INVENTION-ORN-9: impact in only
    if (active(T.sanctuary, tgt)) m(T.sanctuary.mul, `Sanctuary Vow ×${T.sanctuary.mul}: the vow holds.`);
    if (active(T.cushion, tgt) && T.cushion.uses > 0 && damageType === "nigredo") { m(T.cushion.mul, `Cushioned ×${T.cushion.mul}.`); T.cushion.uses--; }
    if (active(T.decoy, tgt) && T.decoy.uses > 0 && !(src && isClockwork(src) && CLOCKWORK_KIT.has(inst?.ability))) { m(0.5, "A manufactured choice: half of it hits the wrong option."); T.decoy.uses--; }
    else if (active(T.decoy, tgt) && T.decoy.uses > 0) notes.push("Precision: a scheduled operation doesn't read the false option (decoy ignored, not spent).");
    if (src && tgt && inst?.ability === "feint" && isClockwork(tgt)) m(0, "Precision: a feint is nothing to Clockwork (it doesn't read signals).");
    if (active(T.inputFilter, tgt) && damageType !== T.inputFilter.channel) m(0.85, "Input Filter rejects part of an off-type input ×0.85.");
    if (active(T.degraded, tgt)) m(0.8, "Graceful Degradation ×0.8.");
    if (active(T.specialized, tgt) && damageType !== T.specialized.up) m(1.15, "Specialized: the old answer's gap ×1.15.");
    if (active(T.loadShare, tgt) && (T.loadShare.uses == null || T.loadShare.uses > 0) && T.loadShare.members.length > 1) { const n = T.loadShare.members.filter((id) => !H.actor(s, id)?.defeated).length; if (n > 1) { m(1 / n, `Shared across ${n} supports.`); S(s).shareFrom = { tgt: tgt.id, members: T.loadShare.members, cap: T.loadShare.cap, n }; } }
    { const rk = src && isStudent(src) && inst && H.ability?.(inst.ability) ? rankOf(src) : null; if (rk) m(rk.mul, `${rk.name}: what he has learned ×${rk.mul}.`); }
    if (src && src.id !== tgt.id && hasT(src, "robotHater") && isRobot(tgt)) m(ROBOT.haterMul, `Robot Hater: ×${ROBOT.haterMul} against a machine.`);
    if (src && active(A.nonCompete, src) && A.nonCompete.with === tgt.id) m(0, `Non-compete: ${src.name} was bought out, and cannot hurt ${tgt.name} this turn.`);
    if (active(T.petrified, tgt)) m(0, `${tgt.name} is stone: immune to all damage.`);
    if (src && active(A.rage, src)) m(1.25, "Rage ×1.25.");
    { const pr = (s.cls?.pressure || {})[src?.id] || 0; if (src && pr > 0 && src.id !== tgt?.id) m(1 + STEAM.impactPer * pr, `Boiler pressure +${Math.round(STEAM.impactPer * pr * 100)}% impact (${pr}).`); }
    if (!src || !inst) return { mult, notes };
    const id = inst.ability;
    { const L = H.ability?.(id) ? linkOf(s, src) : null;   // the platform: techniques only, never a plain Strike
      if (L) { const n = L.P.links.length, refined = H.ability(id).tier === "refined";
        m(1 + PLATFORM.perLink * n, `On ${L.owner.name}'s platform (${n} link${n === 1 ? "" : "s"}) ×${(1 + PLATFORM.perLink * n).toFixed(2)}.`);
        if (L.link.client) m(PLATFORM.client.potencyMul, `Sign-up terms ×${PLATFORM.client.potencyMul}.`);
        if (refined && fizzling(L.link, src)) m(0, `Deprecated: ${inst.name || "the technique"} ran on a prerequisite ${L.owner.name} withdrew. It fails.`);
        else if (refined && L.link.lock) m(PLATFORM.lockMul, `Locked in: it runs on the platform ×${PLATFORM.lockMul}.`); } }
    { const pbf = CB[src.character]?.passives?.position_before_force?.effect?.contactDamageMul;   // MMA Fighter: Position Before Force
      if (pbf && inst.delivery === "contact" && active(A.fulcrum, src)) m(pbf, `Position before force: a set fulcrum ×${pbf}.`); }
    for (const k of ["pairBonus", "chained", "overdrive", "blessing", "chorus"]) if (active(A[k], src) && A[k].uses > 0) { m(A[k].mul, `${{ pairBonus: "Second contribution", chained: "Chained", overdrive: "Overdrive", blessing: "Blessing", chorus: "Chorus" }[k]} ×${A[k].mul}.`); A[k].uses--; }
    if (active(A.vow, src)) m(A.vow.mul, "Binding Term ×1.3.");
    if (active(A.contract, src) && A.contract.ownerMul) m(A.contract.ownerMul, `Keeping your own terms ×${A.contract.ownerMul}.`);
    if (active(A.degraded, src)) m(0.85, "Degraded output ×0.85.");
    if (active(A.specialized, src) && damageType === A.specialized.up) m(1.3, "Specialized ×1.3.");
    if (active(T.confirmed, tgt) && T.confirmed.side === src.side) m(T.confirmed.mul, `A confirmed read on ${tgt.name} ×${T.confirmed.mul}.`);
    { const o = orderOf(src); if (o && tgt) { if (o.target === tgt.id) m(o.mul, `Standing order: ${src.name} was told to take ${tgt.name} ×${o.mul}.`); else m(o.offMul, `Obsolete plan: ${src.name}'s order names someone else ×${o.offMul}.`); } }
    if (id === "controlledDescent") { const h = T.held; if (!(h && h.by === src.id)) m(0.5, "No hold on the target: the descent half-lands."); else if (h.freedoms.length >= 2) m(1.25, "Held in two freedoms ×1.25."); }
    if (id === "eightCount" && tgt) { if ((T.grappled && T.grappled.untilRound >= s.round) || T.held) m(1.5, "Eight Count on a held body ×1.5."); else if (recovering(s, tgt)) m(1.25, "Eight Count into a recovery ×1.25."); }
    if (id === "perfectMoment" && recovering(s, tgt)) m(1.3, "The perfect moment: it's recovering.");
    if (id === "grandFormula" && active(A.chained, src)) m(1.3, "The chain was primed ×1.3.");
    if ((id === "recoveryCut" || id === "measuredOpening") && A.openingRead?.target === tgt.id && recovering(s, tgt)) m(id === "recoveryCut" ? 1.3 : 1.25, "Struck in its recovery window.");
    if (id === "antiphonalStrike" && S(s).lastHit[src.id]?.target === tgt.id && s.round - S(s).lastHit[src.id].round <= 1) m(1.15, "The response answers the call ×1.15.");
    if (id === "provenFormula" && active(A.inputFilter, src)) m(1.3, "Every interface matched ×1.3.");
    // INVENTION (brief gap: "declared beat"): Tick's +4 lands as x1.5 while any own schedule is pending.
    if (id === "tick" && schedulePending(s, src)) m((CLOCKWORK.tickPotency + CLOCKWORK.tickBonus) / CLOCKWORK.tickPotency, `On the beat: a schedule is pending, Tick lands for ${CLOCKWORK.tickPotency + CLOCKWORK.tickBonus}.`);
    if (id === "productiveFailure" && S(s).strain[src.id]) m(1 + S(s).strain[src.id] * 6 / 18, `Each strained part feeds it (+${S(s).strain[src.id] * 6}).`);
    if (id === "growingMomentum" && A.growth?.stacks) m(1 + A.growth.stacks * 6 / 20, `Growth adds momentum (+${A.growth.stacks * 6}).`);
    if (id === "smite") { const k = Math.min(PALADIN.smiteMaxSteps, keptTurns(src)); if (k > 0) m((PALADIN.smiteBase + PALADIN.smiteStep * k) / PALADIN.smiteBase, `Your oath has held ${k} turn${k === 1 ? "" : "s"}: Smite +${PALADIN.smiteStep * k}.`); }
    if (hasT(src, "zealous")) {   // Zealous: a true believer's edge against dream creatures and inside a dream (Mala, 2026-10-31; builder's numbers)
      if (tgt?.dream) m(PALADIN.zealDream, `Zealous: ${tgt.name} is a dream creature ×${PALADIN.zealDream}.`);
      if (s.dreamSpace) m(PALADIN.zealInDream, `Zealous: a Dream Space is open ×${PALADIN.zealInDream}.`); }
    if (tgt && holdsPaladin(tgt) && oathOf(tgt)) m(PALADIN.unbrokenMul, `Unbroken Oath: ${tgt.name} takes ×${PALADIN.unbrokenMul}.`);
    if (wire[id]?.releaseStored) { const k = S(s).stored[src.id] || 0; if (k > 0) { const base = inst.potency || 1; m((base + Math.min(30, k)) / base, `Releases ${Math.min(30, k)} stored energy.`); S(s).stored[src.id] = 0; } }
    { const tc = Actor.damageMods(s, src, tgt, inst, damageType, H); if (tc) m(tc.mult, tc.why[0]); }   // Typecast: consecutive same-role plays hit harder
    return { mult, notes };
  }
  // ── Glamour and Jiang Qing (Mala, 2026-10-19) ── Shimmer: hostile single-target acts on the veiled unit fizzle 25% (area
  // acts ignore it); it holds until the target's next turn, a turn longer for Jiang Qing (Model Performance). Allure: a field
  // of 2 around the caster until her next turn; a foe starting its turn inside drifts 1 tile toward the centre. Masquerade:
  // each foe it hits misreads the room until its next turn (distracted toward the nearest other unit). Attack Dog: the first
  // enemy Jiang Qing damages each round is Denounced until the next round ends: her allies' hits on it ×1.15.
  const GLAM = { fizzle: 0.25, allureRadius: 2, denounceMul: 1.15 };
  const isJQ = (u) => !!u && (u.character === "jiang_qing" || (u.primary === "glamour" && u.secondary === "legitimacy"));
  function glamourResolve(s, a, inst, w, H) {
    if (w.kind === "shimmer") {
      const t = (inst.targets || []).map((id) => s.actors[id])[0] || H.actorAt(s, ...(inst.tiles?.[0] || [a.x, a.y])) || a;
      st(t).shimmer = { owner: a.id, until: t.ownerTurns + (isJQ(a) ? 2 : 1) };
      H.log(s, { kind: "effect", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${a.name} weaves a shimmer over ${t.name}: hostile acts aimed at them fizzle ${Math.round(GLAM.fizzle * 100)}% of the time${isJQ(a) ? " (Model Performance: it holds a turn longer)" : ""}.` });
      return true;
    }
    if (w.kind === "allure") {
      ((S(s).allure ||= {})[a.id] = { x: a.x, y: a.y, radius: GLAM.allureRadius, until: a.ownerTurns + 1, side: a.side });
      H.log(s, { kind: "effect", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} turns on the allure: foes who start a turn within ${GLAM.allureRadius} drift a tile toward the centre.` });
      return true;
    }
    return false;
  }
  function allureDrift(s, a, H) {
    for (const [owner, f] of Object.entries(S(s).allure || {})) {
      const o = s.actors[owner]; if (!o || o.defeated || o.ownerTurns >= f.until) { delete S(s).allure[owner]; continue; }
      if (a.side === f.side || a.defeated || H.dist(s, a.x, a.y, f.x, f.y) > f.radius || (a.x === f.x && a.y === f.y)) continue;
      const nx = a.x + Math.sign(f.x - a.x), ny = a.y + Math.sign(f.y - a.y);
      if (H.actorAt(s, nx, ny) || H.tileAt?.(s, nx, ny)?.blocksMove) continue;
      a.x = nx; a.y = ny; H.log(s, { kind: "move", actor: a.id, tiles: [[nx, ny]], text: `${a.name} drifts toward ${o.name}'s allure.` });
    }
  }

  // ── The Aviator Hero (Mala, 2026-10-18) ── traits read by any holder: Aerodynamic (biology) and Adrenaline Junkie
  // (psychology); Four Forces is the Aviator's. a.aero = { turn, dir, steps, turns }: this turn's heading, kept by moved().
  const AERO = { straightAdd: 2, thrustAdd: 2, turnAp: 5, adrenaline: [[0.25, 20, 4], [0.5, 10, 2]], dragMul: 0.8, weightGrams: 0.001 };
  const hasTr = (u, id) => (u?.traits || []).some((t) => (t?.id || t) === id);
  const aeroForce = (a) => { const f = a?.status?.aeroForce; return f && f.expiresAt > (a.ownerTurns ?? 0) ? f.force : null; };
  const stepDirs = (route) => route.slice(1).map(([x, y], i) => [Math.sign(x - route[i][0]), Math.sign(y - route[i][1])]);
  // Movement AP added for an Aerodynamic mover: 5 per change of heading (this turn's earlier moves count), and the straight-line
  // bonus tiles can't be used on a route that turns (refused with a prohibitive cost). The AI previews moves, so it sees both.
  function turnCost(s, a, route) {
    if (!hasTr(a, "aerodynamic") || !route || route.length < 2 || flies(a)) return 0;
    const cur = a.aero?.turn === a.ownerTurns ? a.aero : { dir: null, steps: 0, turns: 0 };
    let last = cur.dir, turns = 0;
    for (const d of stepDirs(route)) { if (last && (d[0] !== last[0] || d[1] !== last[1])) turns++; last = d; }
    if (cur.turns + turns > 0 && cur.steps + route.length - 1 > (s.rules.moveBudget || 3)) return 9999;   // the bonus tiles are straight-line only
    return turns * AERO.turnAp;
  }
  function aeroMoved(s, a, traversed, from) {
    if (!hasTr(a, "aerodynamic") || !traversed?.length) return;
    const route = [from, ...traversed], dirs = stepDirs(route), cur = a.aero?.turn === a.ownerTurns ? a.aero : { dir: null, steps: 0, turns: 0 };
    let last = cur.dir, turns = 0; for (const d of dirs) { if (last && (d[0] !== last[0] || d[1] !== last[1])) turns++; last = d; }
    a.aero = { turn: a.ownerTurns, dir: last, steps: cur.steps + dirs.length, turns: cur.turns + turns };
  }
  const aeroMoveAdd = (a) => (hasTr(a, "aerodynamic") ? AERO.straightAdd : 0) + (aeroForce(a) === "thrust" ? AERO.thrustAdd : 0);
  // Ma (claude-five-concepts-spec M1; Mala 2026-11-11 R-20261111-21 M-1: a Strike spends all, lines none; R-20261112-07: a sprung
  // trap drains 1, a Diffusion spread ends the stance and spills half, Deep Rest's stance pays from its second still turn).
  // Stillness banks in quiet turns and is spent as weight on a Strike or cashed by The Space Between. "Moved this turn" is the
  // stamp a.movedTurn, set by afterAction for any tile change (own move or forced), like settleHolds reads holds.
  const MA = { cap: 3, deepRestCap: 4, bank: 1, heal: 1, stanceTurns: 2, deepRestStillTurns: 2, strikeAdd: 1, spendPer: 1,
    cashHeal: 5, cashDiscount: 2, cashDiscountMax: 6, tripDrain: 1, washSpill: 0.5 };
  const Ma = (() => {
    const deep = (a) => a?.lens?.ma === "deepRest";
    const cap = (a) => (deep(a) ? MA.deepRestCap : MA.cap);
    const stance = (a) => { const ss = a?.status?.stillStance; return ss && ss.until >= (a.ownerTurns ?? 0) ? ss : null; };
    const still = (a) => a.movedTurn !== a.ownerTurns;
    const say = (s, H, a, text, why = []) => H.log(s, { kind: "effect", actor: a.id, text, why });
    const heal = (a, n) => { const got = Math.max(0, Math.min(n, (a.maxLF ?? a.lf) - a.lf)); a.lf += got; return got; };
    const bank = (a, n) => { const before = a.stillness || 0; a.stillness = Math.min(cap(a), before + n); return a.stillness - before; };
    const endStance = (a) => { if (a.status?.stillStance) a.status.stillStance = null; };
    function resolve(s, a, w, H) {
      if (w.op === "bank") {
        bank(a, MA.bank); const got = heal(a, MA.heal);
        say(s, H, a, `${a.name} banks stillness (${a.stillness} of ${cap(a)})${got ? ` and heals ${got}` : ""}.`, ["Space is structure: rest now, weight later. A Strike spends all of it."]);
      } else if (w.op === "stance") {
        st(a).stillStance = { label: "Still Stance", until: a.ownerTurns + MA.stanceTurns - 1, stillTurns: 0 };
        say(s, H, a, `${a.name} holds their breath: Still Stance for ${MA.stanceTurns} turns.`, [`Each turn ended without moving banks 1 Stillness${deep(a) ? ` from the second still turn (Deep Rest)` : ""}; Strikes +${MA.strikeAdd} while it holds. A shove or a spread breaks it.`]);
      } else if (w.op === "cash") {
        const n = a.stillness || 0; a.stillness = 0;
        const got = heal(a, MA.cashHeal * n), off = Math.min(MA.cashDiscountMax, MA.cashDiscount * n);
        a.maDiscount = off;
        say(s, H, a, `${a.name} lets the silence go: ${n} Stillness, +${got} LF, and the next technique costs ${off} ΦF less.`, ["Cash the silence: the rest becomes mending and momentum."]);
      }
    }
    // A Strike: +1 in Still Stance, and it spends all banked Stillness for +1 each (lines spend none: M-1).
    function strike(s, a, log) {
      let add = 0; const n = a.stillness || 0, ss = stance(a);
      if (ss) add += MA.strikeAdd;
      if (n > 0) { add += MA.spendPer * n; a.stillness = 0; log(s, { kind: "effect", actor: a.id, text: `${a.name} lets the stillness go: +${MA.spendPer * n}.`, why: [`${n} Stillness spent on the Strike${ss ? `; Still Stance adds ${MA.strikeAdd}` : ""}.`] }); }
      else if (ss) log(s, { kind: "effect", actor: a.id, text: `${a.name} strikes from Still Stance: +${MA.strikeAdd}.` });
      return add;
    }
    // The Space Between's discount: the next technique costs up to 6 ΦF less (read at manifest, spent when the ΦF is paid).
    const discount = (a) => a?.maDiscount || 0;
    function paid(a, m) { if (m?.maDiscounted) a.maDiscount = 0; }
    // The end of the holder's turn: a still turn in stance banks 1 (Deep Rest: from its second still turn); the stance runs out.
    function turnEnd(s, a, log) {
      const ss = a?.status?.stillStance; if (!ss || a.defeated) return;
      if (ss.until >= a.ownerTurns && still(a)) {
        ss.stillTurns = (ss.stillTurns || 0) + 1;
        if (ss.stillTurns >= (deep(a) ? MA.deepRestStillTurns : 1)) { const got = bank(a, MA.bank); if (got) log(s, { kind: "effect", actor: a.id, text: `${a.name} banks stillness (${a.stillness} of ${cap(a)}).`, why: ["A turn ended without moving, in Still Stance."] }); }
      }
      if (ss.until <= a.ownerTurns) endStance(a);
    }
    // After every action: stamp any unit whose tile changed; a unit moved by anything but its own Move, Jump or Climb loses
    // Still Stance. A sprung trap on a holder drains 1 Stillness; a Diffusion spread whose tiles cover a holder in Still Stance
    // ends it and spills half the bank (rounded down). Reads the action's own log entries from `start`.
    function afterAction(before, s, action, start, own, log, abilities) {
      for (const u of Object.values(s.actors)) {
        const p = before.actors?.[u.id]; if (!p || u.defeated) continue;
        if (p.x !== u.x || p.y !== u.y) {
          u.movedTurn = u.ownerTurns;
          const self = own.includes(action.type) && action.actor === u.id;
          if (!self && stance(u)) { endStance(u); log(s, { kind: "effect", actor: u.id, text: `${u.name} is shaken out of Still Stance.`, why: ["Forced movement breaks the stance; the bank holds."] }); }
        }
      }
      for (const e of s.log.slice(start)) {
        if (e.kind === "trap" && e.sprung) {
          const u = s.actors[e.actor]; if (!u || !(u.stillness > 0)) continue;
          u.stillness = Math.max(0, u.stillness - MA.tripDrain);
          log(s, { kind: "effect", actor: u.id, text: `${u.name}'s rest is tripped: ${MA.tripDrain} Stillness lost (${u.stillness} left).`, why: ["A trap sprung in the rest drains 1 Stillness."] });
        } else if (e.kind === "act" && e.ability && Array.isArray(e.tiles)) {
          const d = abilities?.[e.ability]; if (!d || !(d.concepts || []).includes("diffusion") || (d.area?.shape || "single") === "single") continue;
          for (const u of Object.values(s.actors)) {
            if (u.defeated || u.id === e.actor || !stance(u) || !e.tiles.some((t) => t && t[0] === u.x && t[1] === u.y)) continue;
            const spill = Math.floor((u.stillness || 0) * MA.washSpill); endStance(u); u.stillness = (u.stillness || 0) - spill;
            log(s, { kind: "effect", actor: u.id, text: `${u.name}'s stillness is washed out: Still Stance ends${spill ? ` and ${spill} Stillness spills` : ""}.`, why: ["A spread onto a still unit's tile ends the stance and spills half the bank."] });
          }
        }
      }
    }
    return { MA, cap, stance, still, resolve, strike, discount, paid, turnEnd, afterAction };
  })();
  function adrenaline(s, a, H) {
    if (!hasTr(a, "adrenalineJunkie") || a.defeated) return;
    const frac = a.lf / Math.max(1, a.maxLF), tier = AERO.adrenaline.find(([below]) => frac < below); if (!tier) return;
    const [, ap, pf] = tier; a.tempo += ap; a.tempoCapacity = Math.max(a.tempoCapacity || 0, a.tempo); a.pf = Math.min(a.maxPF ?? s.rules.maxPF, (a.pf || 0) + pf);
    H.log(s, { kind: "tempo", actor: a.id, text: `${a.name}'s adrenaline kicks in: +${ap} AP and +${pf} ΦF (below ${Math.round(tier[0] * 100)}% LF).` });
  }
  function forcesResolve(s, a, inst, H) {
    const force = ["lift", "weight", "thrust", "drag"].includes(inst.force) ? inst.force : "thrust";
    st(a).aeroForce = { force, expiresAt: a.ownerTurns + 1 };
    if (force === "weight") a.weightGrams = AERO.weightGrams; else if (a.weightGrams === AERO.weightGrams) delete a.weightGrams;
    const text = { lift: "leans on lift: climbs cost almost nothing until the next turn", weight: "goes near weightless (0.001 g): no fall damage until the next turn", thrust: `opens the throttle: +${AERO.thrustAdd} movement in a straight line until the next turn`, drag: `streamlines: incoming line attacks ×${AERO.dragMul} until the next turn` }[force];
    H.log(s, { kind: "effect", actor: a.id, text: `${a.name} ${text}.`, why: ["Four Forces: one force at a time, for one turn."] });
  }
  function forcesValue(s, a, cand, H) {
    if (aeroForce(a)) return 0;
    const foes = live(s).filter((u) => u.side !== a.side && u.side !== "bystander"), near = foes.length ? Math.min(...foes.map((u) => H.dist(s, a.x, a.y, u.x, u.y))) : 99;
    const f = cand.force || "thrust";
    if (f === "thrust") return near > 3 && near <= 10 ? 3 : 0.4;
    if (f === "drag") return Math.min(4, foes.filter((u) => H.dist(s, a.x, a.y, u.x, u.y) <= 6 && (u.abilities?.length || true)).length * 1.2) * (near <= 6 ? 1 : 0.3);
    if (f === "weight") return (H.heightAt?.(s, a.x, a.y) || 0) >= 2 ? 1.5 : 0.1;
    return 0.3;
  }

  // ── The Mangaka's Cut Out (Mala, 2026-10-18) ── a hit that takes the target's ward, else a buff, else a non-biology trait, as a
  // held fragment. Juxtapose pastes it onto any character for the paste's duration (pasteStolen); a stolen trait goes home when
  // the paste ends or the fragment is dropped for a newer one (dropFragment). Expiry: engine/turns.js (pastedSteal).
  const STEAL_BUFFS = ["guard", "rangeBuff", "cornerAdvice", "anchor", "immovable"];
  const stealableTrait = (H, id) => { const t = H.insightRules?.data?.traits?.[id]; return !!t && t.category !== "biology" && t.category !== "state"; };
  function mangakaSteal(s, src, tgt, H) {
    if (!tgt || tgt.defeated) return;
    const live = (x) => x && (x.expiresAt == null || x.expiresAt > tgt.ownerTurns) && (x.until == null || x.until >= tgt.ownerTurns);
    let frag = null;
    if ((tgt.status?.ward?.protection || 0) > 0) { frag = { kind: "ward", value: { ward: { ...tgt.status.ward } } }; tgt.status.ward = null; }
    else { const k = STEAL_BUFFS.find((b) => live(tgt.status?.[b])); if (k) { frag = { kind: "buff", value: { status: k, data: { ...tgt.status[k] } } }; tgt.status[k] = null; } }
    if (!frag) { const t = (tgt.traits || []).map((x) => x?.id || x).find((id) => stealableTrait(H, id));
      if (t) { frag = { kind: "trait", value: { trait: t } }; tgt.traits = tgt.traits.filter((x) => (x?.id || x) !== t); } }
    if (!frag) { H.log(s, { kind: "clip", actor: src.id, target: tgt.id, text: `${src.name} cuts at ${tgt.name}, but there is nothing to take.` }); return; }
    Object.assign(frag, { id: `frag-${++s.seq}`, from: tgt.id, source: [tgt.x, tgt.y] });
    src.heldFragments ||= []; if (src.heldFragments.length >= 2) dropFragment(s, src, src.heldFragments.shift(), H); src.heldFragments.push(frag);
    const what = frag.kind === "trait" ? `the trait ${H.insightRules?.data?.traits?.[frag.value.trait]?.name || frag.value.trait}` : frag.kind === "ward" ? `a ${frag.value.ward.protection}-point ward` : `the ${frag.value.status} buff`;
    H.log(s, { kind: "clip", actor: src.id, target: tgt.id, tiles: [[tgt.x, tgt.y]], text: `${src.name} cuts ${what} off ${tgt.name} and holds it (${src.heldFragments.length}/2 fragments).`, why: ["Juxtapose can paste it onto any character for the paste's duration.", ...(frag.kind === "trait" ? ["A stolen trait goes back to its owner when the fragment leaves play."] : [])] });
  }
  function returnTrait(s, frag, H) {
    if (frag?.kind !== "trait") return; const home = s.actors[frag.from];
    if (home && !home.defeated && !(home.traits || []).some((x) => (x?.id || x) === frag.value.trait)) { home.traits = [...(home.traits || []), frag.value.trait];
      H.log(s, { kind: "expire", actor: home.id, text: `${home.name} gets ${H.insightRules?.data?.traits?.[frag.value.trait]?.name || frag.value.trait} back.` }); }
  }
  function dropFragment(s, a, frag, H) { returnTrait(s, frag, H); }
  function pasteStolen(s, a, frag, unit, duration, H) {
    if (!unit) return;
    if (frag.kind === "ward") unit.status.ward = { ...frag.value.ward, owner: unit.id, label: `${frag.value.ward.label || "Ward"} (pasted)`, expiresAt: unit.ownerTurns + duration };
    if (frag.kind === "buff") unit.status[frag.value.status] = { ...frag.value.data, expiresAt: unit.ownerTurns + duration, ...(frag.value.data.until != null ? { until: unit.ownerTurns + duration } : {}) };
    if (frag.kind === "trait") unit.traits = [...(unit.traits || []), frag.value.trait];
    s.terrainEffects.push({ id: `paste-${++s.seq}`, kind: "pastedSteal", label: "Pasted " + frag.kind, owner: a.id, side: a.side, unit: unit.id, tiles: [[unit.x, unit.y]], fragment: JSON.parse(JSON.stringify(frag)), expiresAt: a.ownerTurns + duration });
    H.log(s, { kind: "paste", actor: a.id, target: unit.id, tiles: [[unit.x, unit.y]], text: `${a.name} pastes the stolen ${frag.kind === "trait" ? (H.insightRules?.data?.traits?.[frag.value.trait]?.name || frag.value.trait) : frag.kind === "ward" ? "ward" : frag.value.status} onto ${unit.name} for ${duration} turns.` });
  }
  function stolenPasteEnds(s, e, H) {   // engine/turns.js: a pastedSteal effect expired
    if (e.fragment?.kind !== "trait") return; const u = s.actors[e.unit];
    if (u) u.traits = (u.traits || []).filter((x) => (x?.id || x) !== e.fragment.value.trait);
    returnTrait(s, e.fragment, H);
  }
  function afterHit(s, src, tgt, inst, dealt, H) {
    afterHitGuests(s, src, tgt, inst, dealt, H);   // Shaman guests: leave when the host falls; a hit ends the Raven
    spendTrophyEye(s, src, dealt);
    Law.afterHit(s, src, tgt, inst, dealt, H);   // the Magistrate's Contempt
    if (tgt && tgt.defeated && !tgt.memorialCounted) {   // Memorialist: Ledger of the Fallen (each death banks once, for the allies who saw it)
      tgt.memorialCounted = true;
      for (const m of Object.values(s.actors)) {
        if (m.defeated || m.id === tgt.id || m.side !== tgt.side || !pairIs(m, "preservation", "longtermism")) continue;
        m.memorial ||= { principal: 0, honored: [] };
        if (m.memorial.principal < 3) { m.memorial.principal++; m.memorial.honored.push(tgt.name);
          H.log(s, { kind: "effect", actor: m.id, target: tgt.id, text: `${m.name} writes ${tgt.name} into the ledger (${m.memorial.principal}/3).` }); }
      }
    }
    if ((inst?.ability || inst?.id) === "masquerade" && tgt && !tgt.defeated && tgt.side !== src.side) {   // Masquerade: it misreads the room
      const near = Object.values(s.actors).filter((u) => u.id !== tgt.id && !u.defeated && !u.notArrived).sort((x, y) => H.dist(s, tgt.x, tgt.y, x.x, x.y) - H.dist(s, tgt.x, tgt.y, y.x, y.y))[0];
      if (near) { tgt.distracted = { by: near.id, until: s.round + 1 }; H.log(s, { kind: "effect", actor: src.id, target: tgt.id, text: `${tgt.name} misreads the room: ${near.name} looks like the threat.` }); }
    }
    if (isJQ(src) && tgt && dealt > 0 && tgt.side !== src.side && S(s).denouncedRound?.[src.id] !== s.round) {   // Attack Dog
      (S(s).denouncedRound ||= {})[src.id] = s.round; st(tgt).denounced = { by: src.id, side: src.side, until: s.round + 1 };
      H.log(s, { kind: "effect", actor: src.id, target: tgt.id, text: `${src.name} denounces ${tgt.name}: her side hits them ×${GLAM.denounceMul} until the next round ends.` });
    }
    if ((inst?.ability || inst?.id) === "cutOut") mangakaSteal(s, src, tgt, H);
    Esker.afterHit(s, src, tgt, inst, dealt, H);
    HotPot.afterHit(s, src, tgt, inst, dealt, H);   // Spilled Pot, Small Doses
    Performers.afterHit(s,src,tgt,dealt,H);
    Stealth.afterHit(s,src,tgt,inst,dealt,H);
    Actor.afterHit(s,src,tgt,inst,dealt,H);
    // Contact High (Cyph's passive): landing melee contact risks inebriation unless highly tolerant.
    if (tgt && (tgt.character === "cyph" || tgt.passives?.contactHigh) && src && src.id !== tgt.id && !src.defeated && dealt > 0 && inst && inst.delivery === "contact" &&
        !((src.traits || []).some((t) => (t.id || t) === "highTolerance")) && !src.status.inebriated) {
      const chance = tgt.passives?.contactHigh?.chance ?? 0.5;
      const h = (Math.imul(((s.seed || 1) ^ Math.imul(src.ownerTurns + 1, 31) ^ Math.imul(tgt.ownerTurns + 1, 101) ^ Math.imul(s.round + 1, 17) ^ 0xC0FFEE), 1664525) + 1013904223) >>> 0;
      if ((h % 1000) / 1000 < chance) {
        src.status.inebriated = { expiresAt: src.ownerTurns + 3 };
        H.log(s, { kind: "status", actor: tgt.id, target: src.id, text: `${src.name} catches Cyph's contact high: AP halved for 3 turns.`, why: ["Melee contact with Cyph intoxicates the careless. High Tolerance is immune."] });
      }
    }
    if (tgt && dealt > 0 && isStudent(tgt)) { studyOf(tgt).hurt = true; experience(s, tgt, H, inst); openGifts(s, tgt, H); }   // Student: a hurt student does not study this round
    if (tgt && dealt > 0 && tgt.status?.recovery) disturb(s, tgt, H);   // Doctor: damage to a patient ends the recovery
    const C = S(s);
    if (tgt && dealt > 0) { C.took[tgt.id] = { round: s.round, amount: (C.took[tgt.id]?.round === s.round ? C.took[tgt.id].amount : 0) + dealt }; C.low[tgt.id] = Math.min(C.low[tgt.id] ?? 1, tgt.lf / tgt.maxLF); }
    if (tgt?.status && dealt > 0 && (active(tgt.status.yield, tgt))) C.stored[tgt.id] = Math.min(20, (C.stored[tgt.id] || 0) + Math.round(dealt * 0.43));
    if (tgt && dealt > 0 && isBarbarian(tgt)) {   // absorb_and_return (Take It and Unchained raise the rate)
      let rate = 0.2;
      if (tgt.status?.unchained?.round === s.round) rate = 1;
      else if (active(tgt.status?.takeIt, tgt) && tgt.status.takeIt.uses > 0) { rate = 0.4; tgt.status.takeIt.uses--; }
      C.stored[tgt.id] = Math.min(30, (C.stored[tgt.id] || 0) + Math.round(dealt * rate));
    }
    if (tgt && dealt > 0 && isBarbarian(tgt) && !tgt.defeated) {   // rage: entering and sustaining
      if (tgt.status?.rage) tgt.status.rage.lastHurt = s.round;
      else if (tgt.lf < tgt.maxLF / 2) enrage(s, tgt, H, "Dropped below half LF.", s.round);
    }
    if (tgt && dealt >= 15 && isOrnithopter(tgt) && !tgt.defeated && !tgt.status?.grounded) {   // light_frame: a heavy hit grounds it for a turn (INVENTION-ORN-5: heavy = 15+)
      st(tgt).grounded = { label: "Grounded", until: tgt.ownerTurns + 2, cause: "heavy" };
      H.log(s, { kind: "effect", actor: tgt.id, text: `${tgt.name} takes a heavy hit (${dealt}): grounded for a turn.`, why: ["Light frame: slow to take off again (Take Off beats back into the air early)."] });
    }
    if (tgt && dealt > 0 && tgt.lf < tgt.maxLF / 2 && tgt.lf + dealt >= tgt.maxLF / 2)   // War Cry answers an ally's crossing
      for (const u of live(s)) { const w = u.status?.warCry; if (u.side === tgt.side && u.id !== tgt.id && active(w, u) && w.uses > 0) { w.uses--; u.tempo += 50;
        H.log(s, { kind: "effect", actor: u.id, target: tgt.id, text: `${u.name} answers the cry: ${tgt.name} is below half, and ${u.name} acts (+50 AP).` }); } }
    if (tgt?.status?.cushion?.by && dealt > 0) C.stored[tgt.status.cushion.by] = Math.min(30, (C.stored[tgt.status.cushion.by] || 0) + Math.round(dealt));
    if (src && inst?.ability === "piston" && !src.defeated) addPressure(s, src, 1, H);   // Piston works the boiler: +1 pressure on a landing hit
    const sh = C.shareFrom; C.shareFrom = null;
    if (sh && dealt > 0) for (const id of sh.members) { const u = H.actor(s, id); if (!u || u.defeated || id === sh.tgt) continue; const part = Math.min(sh.cap, dealt); u.lf = Math.max(0, u.lf - part); H.log(s, { kind: "effect", actor: u.id, text: `${u.name} carries ${part} of the shared load.` }); if (u.lf <= 0) H.defeat?.(s, u); }
    if (sh && dealt > 0) for (const id of sh.members) { const u = H.actor(s, id), L = u?.status?.loadShare;   // one-shot shares (Shore Up) spend themselves on the load
      if (u && L && L.uses != null && --L.uses <= 0) { u.status.loadShare = null; H.log(s, { kind: "effect", actor: u.id, text: `${u.name}'s bracing is spent.` }); } }
    // Never strike first, broken in the open: the first strike was the oathbreaker's. Any oathbound unit, any battle.
    if (dealt > 0) C.firstBlood = true;   // "never strike first" was removed in the Paladin re-spec: a 1 vs 1 Smite broke its own oath
    for (const u of live(s)) { const o = u.status?.oath; if (!o || o.broken) continue; const w = wardOf(s, u);   // protect: the ward hurt below the line
      if (!w) { if (o.merge) { o.merge = false; H.log(s, { kind: "effect", actor: u.id, text: `${u.name}'s ward has fallen: Oath of the Shield ends with no one to shield.` }); } continue; }
      if (w.lf > 0 && w.lf / w.maxLF < (o.wardLine ?? 0.5)) oathBreach(s, u, `${w.name} fell below half`, H); }
    // Sanctuary: the first attack breaks the vow not to attack (INVENTION-CLERIC-6: damage to another side counts; self-harm doesn't).
    if (tgt && dealt > 0 && src && src.id !== tgt.id && src.side !== tgt.side && pledgeOf(src)?.kind === "noAttack") pledgeBreach(s, src, "their first attack", H);
    if (!src || !inst) return;
    C.lastHit[src.id] = { target: tgt?.id, round: s.round };
    const w = wire[inst.ability];
    if (w?.throwTiles && tgt && !tgt.defeated) H.knock(s, src, tgt, w.throwTiles, inst, "push");
    if (w?.leverAnchor && tgt && !tgt.defeated) { const kept = { anchor: tgt.status?.anchor, immovable: tgt.status?.immovable }; if (kept.anchor || kept.immovable) H.log(s, { kind: "effect", actor: src.id, target: tgt.id, text: `Off-Balance works on the support geometry: ${tgt.name}'s anchoring doesn't stop it.` });
      st(tgt).anchor = null; st(tgt).immovable = null; H.knock(s, src, tgt, w.leverAnchor, inst, "push"); }
    if (inst.ability === "shieldBash" && !src.defeated) { const wd = wardOf(s, src);   // step between AND strike: the ward covered (never downgrades stronger cover)
      if (wd && !active(st(wd).intercept, wd)) { st(wd).intercept = { by: src.id, uses: 1, mul: 1, until: wd.ownerTurns + 1, skipBlast: true };
        H.log(s, { kind: "effect", actor: src.id, target: wd.id, text: `${src.name}'s shield covers ${wd.name} against the next hit.` }); } }
    if (src && isClockwork(src) && dealt > 0 && ["gearTrain", "escapement", "tick", "grandComplication"].includes(inst.ability))   // Rewind never overwrites: the replay is not a new recording
      (S(s).lastScheduled ||= {})[src.id] = dealt;
    if (src && isClockwork(src) && ["gearTrain", "escapement", "tick"].includes(inst.ability) && !inst.chainLink) woundRefund(s, src, inst.ability, H);
    if (inst.ability === "gearTrain" && !inst.chainLink && !src.defeated) {   // the second operation fires automatically, once, while the target stands
      // INVENTION (brief gap: second-operation target): same target while it stands, else the chain ends (no retarget).
      if (tgt && !tgt.defeated) H.hit(s, src, tgt, { ...inst, chainLink: true, potency: CLOCKWORK.gearPotency }, CLOCKWORK.gearPotency, ["Gear Train: the second operation fires automatically."], { label: "Gear Train" });
      else H.log(s, { kind: "effect", actor: src.id, text: `${src.name}'s Gear Train ends: nothing standing for the second operation.` });
    }
    if (inst.ability === "controlledDescent" && tgt && !tgt.defeated && tgt.status?.held?.by === src.id) { H.addStun(s, src, tgt, 40); H.log(s, { kind: "effect", target: tgt.id, text: `${tgt.name} is taken down (prone): −40 AP next turn.` }); }
    if (inst.ability === "glare" && tgt && !tgt.defeated) { st(tgt).marked = { by: src.id, until: tgt.ownerTurns + 2 };   // INVENTION-M3: the brief gives the mark no duration; 2 target turns matches the hold it arms
      H.log(s, { kind: "effect", actor: src.id, target: tgt.id, text: `${tgt.name} is marked by ${src.name}'s gaze (Fix in Place is armed).` }); }
    if (inst.concept === "resonance" && tgt?.status?.held) { tgt.status.held = null; H.log(s, { kind: "effect", target: tgt.id, text: `The vibration shakes ${tgt.name} loose from the hold.` }); }
    if (inst.ability === "typedChannel" && tgt && active(src.status?.inputFilter, src) && tgt.lastDamageType === src.status.inputFilter.channel) { st(tgt).silenced = { channel: src.status.inputFilter.channel, until: tgt.ownerTurns + 1 }; H.log(s, { kind: "effect", target: tgt.id, text: `${tgt.name} is silenced in ${src.status.inputFilter.channel} for a turn.` }); }
    if (inst.ability === "chokePoint" && tgt?.status) for (const k of ["guard", "ward", "anchor", "membrane"]) if (tgt.status[k]) { tgt.status[k] = null; H.log(s, { kind: "effect", target: tgt.id, text: `Choke Point cuts ${tgt.name}'s ${k}.` }); break; }
  }
  function resistKnock(s, a, t, H, tiles = 0, inst = null) {
    const T = t.status || {};
    if (t.structure) { H.log(s, { kind: "resist", actor: t.id, text: `${t.name} is a fixed structure: no displacement.` }); return true; }   // SH2 Totem
    if (Esker.resistKnock(t)) { H.log(s, { kind: "resist", actor: t.id, text: `${t.name} carries a full burden: it cannot be moved.` }); return true; }
    if (active(T.tether, t)) { H.log(s, { kind: "resist", actor: t.id, text: `${t.name}'s tether holds: no displacement.` }); return true; }
    // Heavy frame: shoves under 3 tiles don't move it. Leverage works on the support geometry instead of the mass,
    // so a lever-anchored knock (Off-Balance) still moves it — the brief's weakTo.
    if (isSteamWalker(t) && (tiles || 0) < STEAM.shoveThreshold && !wire[inst?.ability]?.leverAnchor) { H.log(s, { kind: "resist", actor: t.id, text: `${t.name}'s heavy frame ignores a ${tiles || 0}-tile shove: displacement under ${STEAM.shoveThreshold} doesn't move it.` }); return true; }
    if (T.growth?.stacks >= 2) { H.log(s, { kind: "resist", actor: t.id, text: `${t.name}'s growth anchors it (${T.growth.stacks} stacks).` }); return true; }
    if (active(T.loadShare, t) && T.loadShare.members.length >= 3) { H.log(s, { kind: "resist", actor: t.id, text: `The support network spreads the shove across ${T.loadShare.members.length}: nobody moves.` }); return true; }
    if (zoneAt(s, "loadPath", t.x, t.y)) { H.log(s, { kind: "resist", actor: t.id, text: `${t.name} holds: the load path's grade routes the shove out of the zone.` }); return true; }
    if (hasT(t, "strongBack") && !t.steadyUsed) { t.steadyUsed = true;   // Ferryman: Strong Back holds the first displacement each battle
      H.log(s, { kind: "resist", actor: t.id, text: `${t.name} sets his oar and holds: no displacement, once a battle.` }); return true; }
    if (hasT(t, "breathHolder") && !t.breathUsed) { t.breathUsed = true;   // Pearl Diver: Breath-Holder is anchored in the deep, once a battle
      H.log(s, { kind: "resist", actor: t.id, text: `${t.name} sinks her weight: no displacement, once a battle.` }); return true; }
    return false;
  }
  function turnStart(s, a, H) {
    turnStartGuests(s, a, H);   // Shaman guests: Raven pulse; leave if host is gone
    ensurePaladinTraits(a);   // a player holding the Paladin pair carries the class's traits
    lightFrameStart(s, a, H);   // Starfarer: Light Frame applies once
    allureDrift(s, a, H);   // Glamour: Allure draws foes in
    Esker.turnStart(s, a, H);
    Performers.turnStart(s,a,H);
    const bled = Stealth.turnStart(s,a,H);
    if (bled > 0 && a.status?.recovery && !a.defeated) disturb(s, a, H);   // ward ruling (Muse-2): internal damage is still damage — a bleed disturbs recovery
    Police.turnStart(s,a,H);
    Law.turnStart(s,a,H);
    Director.turnStart(s,a,H);
    Mise.turnStart(s,a,H);   // station lifetimes
    Homology?.turnStart(s,a,H);   // Homology: a pending reconstruction resolves; spent guards drop
    Actor.turnStart(s,a,H);
    Suits?.turnStart?.(s, a, H);   // Posterity woven workstation
    if (s.rules.hype && isHype(a) && !a.defeated) {   // viral growth: wider every turn nobody has checked
      const hy = hypeOf(s, a), R = s.rules.hype;
      if (!hy.seenBy.length && hy.radius < R.maxRadius) { hy.radius = Math.min(R.maxRadius, hy.radius + R.growPerTurn);
        H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s hype spreads: the field is now ${hy.radius} tiles wide.`, why: ["Nobody has Observed him, so nothing contradicts it."] }); }
    }
    studyTick(s, a, H);   // Student: a round left unhurt is a round of study
    Martial.turnStart(s, a, H);   // Martial Artist: red burns, feasts gather, the climb rolls
    preBuiltCenter(s, a, H);   // Tech Billionaire, turn one: the center may already be standing
    if (s.rules.circuit && S(s).circuits) { sampleCircuits(s, H); circuitTurn(s, a, H); }   // Cybernetic Ecology: expiry and Network ticks
    if (s.rules.droneTowers && !a.defeated) for (const o of towersOf(s, a)) { towerFire(s, a, o, H); if (a.defeated || s.outcome) break; }   // Agent Swarm: each tower fires as his turn starts
    syncCenter(s, a);   // Tech Billionaire: Raise a Data Center is in his list only while he could press it
    recoveryTick(s, a, H);   // Doctor: a patient's recovery moves a stage as its turn starts
    { const holds = (a.learned || []).includes("makeTheCase"), should = hasT(a, "robotSympathizer") && !a.defeated;   // the talk is a sympathizer's, whoever they are
      if (should && !holds) (a.learned ||= []).push("makeTheCase"); else if (!should && holds) a.learned = a.learned.filter((id) => id !== "makeTheCase"); }
    if (a.boughtOut && (a.ownerTurns > a.boughtOut.until || !s.actors[a.boughtOut.by] || s.actors[a.boughtOut.by].defeated)) { const b = a.boughtOut; a.side = b.from; a.boughtOut = null;
      H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s contract with ${s.actors[b.by]?.name || "the buyer"} is over: it goes back to its own side.` }); }
    { const C0 = S(s), prev = C0.turnOf != null && C0.turnOf !== a.id ? s.actors[C0.turnOf] : null, L = prev && !prev.defeated ? linkOf(s, prev) : null; C0.turnOf = a.id;
      // Subscription Fees: billed as the subscriber's turn ends (here, as the next turn begins). The fee never takes the last point.
      if (L && L.link.client) { const fee = Math.min(PLATFORM.fee, prev.lf - 1); if (fee > 0) { prev.lf -= fee;
        const o = L.owner, kept = Math.max(0, Math.min(PLATFORM.feeKeep, fee, o.maxLF - o.lf)); o.lf += kept;
        H.log(s, { kind: "effect", actor: L.owner.id, target: prev.id, text: `Subscription fee: ${prev.name} pays ${fee} Life Force to stay on ${L.owner.name}'s platform (${prev.lf}/${prev.maxLF}).${kept ? ` ${o.name} keeps ${kept} of it.` : ""}`, why: ["It was in the fine print.", `After taxes, at most ${PLATFORM.feeKeep} of each fee reaches him.`, `Due at the end of every turn while the link holds. To cancel: a full round beyond ${PLATFORM.range} tiles of ${L.owner.name}, or drop him.`] }); } } }
    if (!a.defeated && s.cls?.platforms?.[a.id]) syncCharge(s, a);   // a subscriber who fell since his last turn no longer counts
    if (a.status?.platformOffer && !offerOf(a)) { withdrawOffer(a); H.log(s, { kind: "effect", actor: a.id, text: `The offer to ${a.name} has lapsed.` }); }
    { const L = !a.defeated && linkOf(s, a);   // terms of service: a full round out of range is the only way off
      if (L) { if (H.dist(s, a.x, a.y, L.owner.x, L.owner.y) <= PLATFORM.range) L.link.out = 0;
        else if (++L.link.out >= PLATFORM.outTurns) { L.P.links = L.P.links.filter((l) => l !== L.link); syncCharge(s, L.owner);
          H.log(s, { kind: "effect", actor: a.id, target: L.owner.id, text: `${a.name} has been beyond ${PLATFORM.range} tiles of ${L.owner.name} for a full round: the link drops.`, why: [`${L.P.links.length} left on the platform.`] }); } } }
    const C = S(s);
    if (!a.defeated && [a.primary, a.secondary].includes("craftsmanship")) {
      const rule = s.rules.keptTool;
      for (const o of s.arena.objects || []) {
        const owner = s.actors[o.owner];
        if (!rule || o.role !== "artist-workstation" || o.keptTool || o.hp <= 0 || !owner || owner.defeated || owner.side !== a.side
          || owner.ownerTurns >= o.expiresAt || H.dist(s, a.x, a.y, o.x, o.y) > rule.range) continue;
        o.keptTool = { by: a.id, hpAdd: rule.hpAdd };
        o.maxHp += rule.hpAdd; o.hp = Math.min(o.maxHp, o.hp + rule.hpAdd);
        const edge = "opp-craft-keeps-the-tool";
        s.stats.edges[edge] = (s.stats.edges[edge] || 0) + 1;
        H.log(s, { kind: "effect", actor: a.id, tiles: [[o.x, o.y]], edge,
          text: `${a.name} maintains ${owner.name}'s workstation: +${rule.hpAdd} HP (${o.hp}/${o.maxHp}).`,
          why: [`Craftsmanship keeps the tool [${edge}]. Once per workstation; its normal expiry stays unchanged.`] });
      }
    }
    if(a.status?.cyphPocket?.until<a.ownerTurns)a.status.cyphPocket=null;
    if (a.passives?.healPerTurn && !a.defeated && a.lf < a.maxLF) { const g = Math.min(a.passives.healPerTurn, a.maxLF - a.lf); a.lf += g; H?.log?.(s, { kind: "effect", actor: a.id, text: `${a.name}'s ${a.passives.healPerTurnName || "super healing"} closes wounds: +${g} LF.` }); }
    { const g = a.status?.grounded;   // grounded with an `until` (a heavy hit) holds through the next turn; soaked wings (no `until`) dry as before
      if (g && H?.waterAt && !H.waterAt(s, a.x, a.y) && (g.until == null || g.until <= a.ownerTurns)) { a.status.grounded = null;
        H.log(s, { kind: "effect", actor: a.id, text: g.cause === "heavy" ? `${a.name} shakes off the hit and takes to the air.` : `${a.name} is dry again and takes to the air.` }); } }
    for (const o of s.arena.objects || []) if (o.maidProtectOwner && o.maidProtectedUntil != null && (s.actors[o.maidProtectOwner]?.ownerTurns || 0) >= o.maidProtectedUntil) { o.protected = false; delete o.maidProtectedUntil; delete o.maidProtectOwner; }
    if (a.status?.maidProtected && a.status.maidProtected.until <= a.ownerTurns) a.status.maidProtected = null;
    (C.visited[a.id] ||= []).push([a.x, a.y]); if (C.visited[a.id].length > 6) C.visited[a.id].shift();
    const g = a.status?.growth; if (g?.stacks) { if (a.pf >= g.stacks) a.pf -= g.stacks; else { g.stacks--; a.maxLF -= 8; a.lf = Math.min(a.lf, a.maxLF); } }
    if (isSteamWalker(a) && !a.defeated) {   // boiler: +1 pressure a turn (max 5); wet ground cools (−1) instead of building
      if (H?.waterAt && H.waterAt(s, a.x, a.y)) { const P = (S(s).pressure ||= {}); P[a.id] = Math.max(0, (P[a.id] || 0) - 1);
        H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s boiler cools on the wet ground: pressure ${P[a.id]} (a cooling vent).` }); }
      else addPressure(s, a, STEAM.perTurn, H);
    }
    if (a.status?.fulcrum && (a.status.fulcrum.x !== a.x || a.status.fulcrum.y !== a.y)) a.status.fulcrum = null;
    for (const o of s.arena.objects || []) {   // stale span and shore links fall off as their owner's turn starts
      if (o.span && o.span.owner === a.id && a.ownerTurns >= o.span.until) delete o.span;
      if (o.shore && o.shore.by === a.id && a.ownerTurns >= o.shore.until) delete o.shore;
    }
    const h = a.status?.held, holder = h && s.actors[h.by];
    if (h && (!holder || holder.defeated || (h.gaze ? !gazeHolds(s, holder, a, H) : Math.abs(holder.x - a.x) + Math.abs(holder.y - a.y) > 1))) {   // a gaze hold breaks with its sight line, not with distance
      a.status.held = null; if (h.gaze && holder && !holder.defeated) H.log(s, { kind: "effect", actor: a.id, text: `${a.name} is freed: the gaze line broke.` }); }
    // stone_gaze + no_reflection: at her turn start, every unit in her sight slows (−1 move) while its line
    // holds; a line that crosses water reflects and slows her instead. INVENTION-M4: "units" is read literally,
    // so allies in sight slow too; INVENTION-M5: the reflected self-slow lasts a turn (the brief gives no duration).
    if (!a.defeated && isMedusa(a) && typeof H.hasSight === "function") for (const u of live(s)) {
      if (u.id === a.id) continue;
      const seen = H.hasSight(s, a.x, a.y, u.x, u.y), reflected = seen && gazeReflected(s, a, u, H);
      if (seen && !reflected) { gazeSlow(s, a, u, H, false); continue; }
      if (reflected) gazeSlow(s, a, a, H, true);
      if (u.status.moveAdd?.gaze && u.status.moveAdd.by === a.id) u.status.moveAdd = null;   // the line broke or reflected: her slow on them ends now
    }
    { const g = a.status?.moveAdd;   // a gaze slow ends the moment its line breaks (generic: any gazer's slow clears the same way)
      if (g?.gaze) { const gazer = s.actors[g.by]; if (!gazer || gazer.defeated || !gazeHolds(s, gazer, a, H)) a.status.moveAdd = null; } }
    { const o = a.status?.oath;   // the oath kept or broken at its own turn start: the ward's line, retreat, and the merge's end
      if (o && !o.broken && !a.defeated) {
        const w = wardOf(s, a);
        if (!w) { if (o.merge) { o.merge = false; H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s ward has fallen: Oath of the Shield ends with no one to shield.` }); } }
        else if (w.lf > 0 && w.lf / w.maxLF < (o.wardLine ?? 0.5)) oathBreach(s, a, `${w.name} fell below half`, H);
        if (o.merge && !(active(w?.status?.intercept, w) && w.status.intercept.oathbound && !w.status.intercept.standing && w.status.intercept.by === a.id && w.status.intercept.uses > 0)) o.merge = false;   // the merge's own cover ran out (3 turns or 9 uses): the oath holds, the merge is over, and the standing cover below is not the merge
        if (!o.broken && w) coverWard(s, a, w);   // renew the standing cover on the ward each of your turns
        if (!o.broken) {   // Stand fast holds with or without a ward (a solo oath has only this term): moving AND ending farther from the nearest foe than at your last turn start is a retreat
          const d = Math.min(99, ...live(s).filter((u) => u.side !== a.side).map((u) => H.dist(s, a.x, a.y, u.x, u.y)));
          if (!o.lastPos) { o.lastPos = [a.x, a.y]; o.lastDist = d; }
          else if ((a.x !== o.lastPos[0] || a.y !== o.lastPos[1]) && d > o.lastDist) oathBreach(s, a, "a retreat", H);
          else { o.lastPos = [a.x, a.y]; o.lastDist = d; }
        }
      } }
    // Hymn of the Oath (PALADIN.md): at the Paladin's turn start, for 3 turns, allies within 3 recover 5 LF and foes within 3 take 5 Rubedo; x1.5 while the oath holds.
    { const hy = a.status?.hymn;
      if (hy && !a.defeated) {
        if (hy.expiresAt <= a.ownerTurns) { a.status.hymn = null; H.log(s, { kind: "expire", actor: a.id, text: `${a.name}'s Hymn of the Oath fades.` }); }
        else {
          const k = oathOf(a) ? PALADIN.oathMul : 1, heal = Math.floor(PALADIN.hymnHeal * k), hurt = Math.floor(PALADIN.hymnHurt * k);   // 5 -> 7 with the oath (x1.5 floored: 7.5 would round to a x1.6 hymn)
          for (const u of live(s).filter((u) => u.side === a.side && H.dist(s, a.x, a.y, u.x, u.y) <= PALADIN.hymnRadius)) {
            const before = u.lf; u.lf = Math.min(u.maxLF, u.lf + heal);
            if (u.lf > before) H.log(s, { kind: "heal", actor: a.id, target: u.id, text: `${u.name} recovers ${u.lf - before} LF in the Hymn of the Oath.` }); }
          for (const u of live(s).filter((u) => u.side !== a.side && H.dist(s, a.x, a.y, u.x, u.y) <= PALADIN.hymnRadius))
            H.hit(s, a, u, { ability: "hymnOfTheOath", name: "Hymn of the Oath", delivery: "field", damageType: "rubedo" }, hurt, [`The oath sung aloud burns what stands within ${PALADIN.hymnRadius}${k > 1 ? " (×1.5 while the oath holds)" : ""}.`]);
        } } }
    { const v = pledgeOf(a);   // covenant: keeping the vow extends the blessing a turn; a retreat (moved and farther) breaks it
      if (v && !a.defeated) {
        if (v.kind === "noRetreat") {
          const d = Math.min(99, ...live(s).filter((u) => u.side !== a.side).map((u) => H.dist(s, a.x, a.y, u.x, u.y)));
          if (!v.lastPos) { v.lastPos = [a.x, a.y]; v.lastDist = d; }
          else if ((a.x !== v.lastPos[0] || a.y !== v.lastPos[1]) && d > v.lastDist) pledgeBreach(s, a, "a retreat", H);
          else { v.lastPos = [a.x, a.y]; v.lastDist = d; }
        }
        if (!st(a).pledge.broken && active(st(a).blessing, a)) { st(a).blessing.until += 1;   // kept: +1 turn (INVENTION-CLERIC-7: the ×1.2 only; the ward never extends)
          H.log(s, { kind: "effect", actor: a.id, text: `${a.name} keeps the vow: the blessing holds another turn.` }); }
      } }
    { const cw = st(a).covenantWatch;   // Covenant of the Faithful resolves: keepers healed + strengthened, breakers named to all
      if (cw && !a.defeated && a.ownerTurns >= cw.until) { st(a).covenantWatch = null;
        const kept = [], broke = [];
        for (const id of cw.allies) { const u = s.actors[id]; if (!u || u.defeated) continue; const v = st(u).pledge;
          if (v?.covenant) { v.covenant = false; (v.broken ? broke : kept).push(u); } }
        for (const u of kept) { const got = Math.min(CLERIC.covenantHeal, u.maxLF - u.lf); u.lf += got;
          if (active(st(u).blessing, u)) st(u).blessing.until += 1;   // already blessed: the reward extends, never shrinks
          else st(u).blessing = { mul: CLERIC.covenantMul, uses: 1, until: u.ownerTurns + 1 }; }   // a reward, not a new vow
        H.log(s, { kind: "effect", actor: a.id, text: `The covenant is judged: ${kept.length ? `${kept.map((u) => u.name).join(", ")} kept it (+${CLERIC.covenantHeal} LF, ×${CLERIC.covenantMul} next technique)` : "no keeper"}${broke.length ? `; ${broke.map((u) => u.name).join(", ")} broke it, and all know` : "; none broke it"}.` }); } }
    if (a.status?.rage) {   // rage burns the reaction; it cools after a full round without damage
      a.reaction = 0;
      const last = a.status.rage.lastHurt ?? a.status.rage.since;
      if (last == null || last <= s.round - 2) { a.status.rage = null; H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s rage cools: a full round without damage.` }); }
    }
    if (a.status?.unchained && a.status.unchained.round < s.round) a.status.unchained = null;   // the round ended elsewhere (a film): the release fizzles, the storage stays
    { const d = a.status?.disarmed;   // Rogue: a stripped lens or gear effect returns after 2 of the mark's turns
      if (d && d.until <= a.ownerTurns) {
        if (d.kind === "lens" && a.lens) a.lens[d.concept] = d.profile;
        else if (d.kind === "gear") (a.passives ||= {})[d.key] = d.value;
        a.status.disarmed = null;
        H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s stripped edge returns: ${d.kind === "lens" ? `the ${d.profile} lens on ${d.concept}` : `gear (${d.key})`} is back after 2 turns.` });
      } }
    if (a.status?.cutBlind && !active(a.status.cutBlind, a)) a.status.cutBlind = null;
    if (isRogue(a) && !a.defeated && H.dist && H.itemName) {   // light fingers: case each adjacent mark once per battle (INVENTION-ROGUE-9: once per mark per battle bounds the reveal)
      const cased = ((S(s).cased ||= {})[a.id] ||= []);
      for (const u of live(s)) {
        if (u.side === a.side || u.defeated || cased.includes(u.id) || H.dist(s, a.x, a.y, u.x, u.y) > 1) continue;
        cased.push(u.id);
        const goods = rogueBestGoods(u, H, 1)[0], buff = goods ? null : rogueBuffOf(u);
        H.log(s, { kind: "effect", actor: a.id, target: u.id, text: goods ? `${a.name} cases ${u.name}: carrying ${H.itemName(goods)} (light fingers).` : buff ? `${a.name} cases ${u.name}: guarded by ${buff} (light fingers).` : `${a.name} cases ${u.name}: nothing worth taking (light fingers).` });
      }
    }
    if (isClockwork(a) && !a.defeated && !st(a).woundSpring) {   // wound spring: three declared actions, each free on schedule
      st(a).woundSpring = { uses: CLOCKWORK.woundUses };
      H.log(s, { kind: "effect", actor: a.id, text: `${a.name} declares its next three actions: each costs no ΦF on schedule.` });
    }
    if (a.status?.complication && a.status.complication.round < s.round) a.status.complication = null;   // the round ended elsewhere: the schedule jams, the ultimate stays spent
  }
  function roundEnd(s, H) {   // Unchained + Grand Complication release at the round's end (turns.js endTurn)
    for (const a of Object.values(s.actors)) {   // overpressure unpaid: vent or take 15 (the boiler stays overpressure)
      if (!a || a.defeated || !a.status?.overpressure) continue;
      H.hit(s, a, a, { ability: "overheat", name: "Overheat", delivery: "field", damageType: "citrinitas", tier: "basic" }, STEAM.overheat, [`${a.name} ends the round overpressure: the boiler overheats for ${STEAM.overheat}.`], { label: "Overheat", damageType: "citrinitas" });
    }
    for (const a of Object.values(s.actors)) {
      if (!a || a.defeated || a.status?.unchained?.round !== s.round) continue;
      a.status.unchained = null;
      const k = Math.min(30, S(s).stored[a.id] || 0);
      S(s).stored[a.id] = 0;
      const caught = live(s).filter((u) => u.id !== a.id && !u.notArrived && H.dist(s, a.x, a.y, u.x, u.y) <= 1);
      if (!k || !caught.length) { H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s unchained release fizzles: ${!k ? "nothing stored" : "nothing adjacent"}.` }); continue; }
      H.log(s, { kind: "effect", actor: a.id, text: `${a.name} releases everything (${k}) on everything adjacent.`, why: ["Stored energy isn't the original hit: Guard can't answer it."] });
      for (const u of caught) H.hit(s, a, u, { ability: "unchained", name: "Unchained", concept: "elasticity", delivery: "field", damageType: "nigredo", tier: "ultimate", bypassGuard: true }, k, [`Unchained release: ${k} stored energy.`], { label: "Unchained", damageType: "nigredo" });
    }
    for (const a of Object.values(s.actors)) {   // Grand Complication: five operations on the beat; obstruction jams the remainder
      const c = a?.status?.complication;
      if (!a || a.defeated || !c || c.round !== s.round) continue;
      a.status.complication = null;
      const tgt = s.actors[c.target];
      let ran = 0;
      for (let i = 0; i < c.ops; i++) {
        const t = s.actors[c.target];
        const jammed = !t || t.defeated ? "defeated" : H.dist(s, a.x, a.y, t.x, t.y) > c.range ? "out of range" : !H.hasSight(s, a.x, a.y, t.x, t.y) ? "out of sight" : null;
        if (jammed) { H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s Grand Complication jams after ${ran} operation${ran === 1 ? "" : "s"}: ${tgt?.name || "the target"} ${jammed}.`, why: ["Any obstruction jams the remainder."] }); break; }
        ran++;
        H.hit(s, a, t, { ability: "grandComplication", name: "Grand Complication", concept: "timing", delivery: "field", damageType: "albedo", tier: "ultimate", bypassGuard: true, complicationOp: true }, c.potency, [`Complication operation ${ran}/${c.ops}: ${c.potency}, unstoppable by reactions.`], { label: "Grand Complication", damageType: "albedo" });
        if (s.outcome) break;
      }
      if (ran === c.ops) H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s Grand Complication runs all ${c.ops} operations on the beat.` });
    }
  }

  // AI: how useful is a classEffect right now? (The engine's scorer only sees damage.) Roughly on the damage scale.
  function aiValue(s, a, cand, H) {
    { const w0 = wire[cand.ability];   // Agent Swarm: build where a tower will have work, on something that will not fall at once
      if (["droneStation", "droneVolley", "holoSwarm"].includes(w0?.kind) && !s.rules.droneTowers) return 0;   // towers switched off
      if (w0?.kind === "droneStation" && cand.target) { const o = (s.arena.objects || []).find((p) => p.x === cand.target[0] && p.y === cand.target[1]); if (!anchorable(o)) return 0;
        const foes = live(s).filter((u) => u.side !== a.side), r = towerRange(s, o), near = foes.filter((u) => H.dist(s, o.x, o.y, u.x, u.y) <= r + 2).length;
        return 4 + Math.min(4, near * 2) + Math.min(3, (o.maxHp || o.hp || 0) / 10) + (o.type === "dataCenter" ? 2 : 0); }
      if (w0?.kind === "circuitRead" && cand.target) { const o = (s.arena.objects || []).find((p) => p.x === cand.target[0] && p.y === cand.target[1]); if (!livingPlant(o)) return 0;   // Codex's scorecard: only worth it under threat
        const linked = live(s).filter((u) => u.side === a.side && memberReaches(s, u, o, H)).slice(0, s.rules.circuit.members), threat = live(s).filter((f) => f.side !== a.side && linked.some((u) => H.dist(s, f.x, f.y, u.x, u.y) <= 5)).length;
        return threat ? Math.min(6, 0.7 * 4 * threat) * 0.8 + linked.length * 0.5 - 0.9 : 0; }
      if (w0?.kind === "circuitPulse" && cand.target) { const L = circuitOf(s, a).loop, u = H.actorAt(s, cand.target[0], cand.target[1]), m = L && u && L.members[u.id]; if (!m) return 0;
        const n = Math.min(s.rules.circuit.pulse, m.error, u.maxLF - u.lf, L.budget); return n > 0 ? n * (u.lf <= u.maxLF * 0.3 ? 2 : 0.8) - 1.5 : 0; }
      if (w0?.kind === "circuitNetwork") { const L = circuitOf(s, a).loop; if (!L) return 0; return Object.entries(L.members).reduce((n, [id, m]) => n + Math.min(m.error, s.rules.circuit.network.perTick) * ((s.actors[id]?.lf ?? 0) <= (s.actors[id]?.maxLF ?? 1) * 0.3 ? 2 : 0.8), 0) - 4.8; }
      if (w0?.kind === "holoSwarm") { const n = towersOf(s, a).length; return n ? 6 + n * 3 : 0; }
      if (w0?.kind === "droneVolley") return towersOf(s, a).filter((o) => live(s).some((u) => u.side !== a.side && H.dist(s, o.x, o.y, u.x, u.y) <= towerRange(s, o) && H.hasSight(s, o.x, o.y, u.x, u.y))).length * s.rules.droneTowers.potency; }
    const performerValue=Performers.aiValue(s,a,cand,H);if(performerValue!=null)return performerValue;
    const stealthValue=Stealth.aiValue(s,a,cand,H);if(stealthValue!=null)return stealthValue;
    const policeValue=Police.aiValue(s,a,cand,H);if(policeValue!=null)return policeValue;
    const lawValue=Law.aiValue(s,a,cand,H);if(lawValue!=null)return lawValue;
    const monkeyValue=Monkey.aiValue(s,a,cand,H);if(monkeyValue!=null)return monkeyValue;
    const guestValue=Guests?.aiValue?.(s,a,cand,H);if(guestValue!=null)return guestValue;
    const martialValue=Martial.aiValue(s,a,cand,H);if(martialValue!=null)return martialValue;
    const teleologyValue=Teleology.aiValue(s,a,cand,H);if(teleologyValue!=null)return teleologyValue;
    const miseValue=Mise.aiValue(s,a,cand,H);if(miseValue!=null)return miseValue;
    const directorValue=Director.aiValue(s,a,cand,H);if(directorValue!=null)return directorValue;
    { const e = Esker.aiValue(s, a, cand, wire[cand.ability], H); if (e != null) return e; }   // Esker (classes/esker.js)
    { const e = HotPot.aiValue(s, a, cand, wire[cand.ability], H); if (e != null) return e; }   // the Hot Pot Berserker
    { const e = Suits?.aiValue?.(s, a, cand, wire[cand.ability], H); if (e != null) return e; }
    if (wire[cand.ability]?.kind === "forces") return forcesValue(s, a, cand, H);   // the Aviator's Four Forces
    if (wire[cand.ability]?.kind === "shimmer") {   // Glamour: veil someone who is actually threatened and not veiled already
      const t = cand.target && (H.actorAt(s, cand.target[0], cand.target[1]) || (cand.target[0] === a.x && cand.target[1] === a.y ? a : null));
      if (!t || (t.status?.shimmer && t.status.shimmer.until > t.ownerTurns)) return 0;
      const threats = live(s).filter((u) => u.side !== a.side && u.side !== "bystander" && H.dist(s, u.x, u.y, t.x, t.y) <= 5).length;
      return threats ? Math.min(3, 1 + threats * 0.8) * (t.lf < t.maxLF * 0.6 ? 1.3 : 1) : 0;
    }
    if (wire[cand.ability]?.kind === "allure") {   // Glamour: worth it with foes at 2-4 tiles, never while one is already up
      if ((S(s).allure || {})[a.id]) return 0;
      const n = live(s).filter((u) => u.side !== a.side && u.side !== "bystander" && H.dist(s, a.x, a.y, u.x, u.y) >= 2 && H.dist(s, a.x, a.y, u.x, u.y) <= 4).length;
      return n ? 1 + n * 0.7 : 0;
    }
    const actorValue=Actor.aiValue(s,a,cand,H);if(actorValue!=null)return actorValue;
    const w = wire[cand.ability]; if (!w) return 0;
    const foes = live(s).filter((u) => u.side !== a.side), allies = live(s).filter((u) => u.side === a.side && u.id !== a.id);
    const nearestFoe = Math.min(99, ...foes.map((f) => H.dist(s, a.x, a.y, f.x, f.y)));
    const T = st(a), threatened = (u) => foes.some((f) => H.dist(s, u.x, u.y, f.x, f.y) <= 5);
    const tgt = cand.target && H.actorAt(s, cand.target[0], cand.target[1]);
    switch (w.kind) {
      case "artistDeploy": return artistTool(s,a,H) ? 0 : nearestFoe<=7 ? 3 : 0;
      case "artistCalibrate": return 2;
      case "artistRaster": return 4;
      case "artistMask": return tgt && threatened(tgt) ? 3 : 0;
      case "artistEngine": case "artistCompile": return 8;
      case "artistBatch": return 6 + 2*foes.filter(f=>tgt && f.id!==tgt.id && H.dist(s,tgt.x,tgt.y,f.x,f.y)<=2).slice(0,2).length;
      case "cyphBar": return 4;
      case "cyphPocket": return T.cyphPocket ? 5 : 2;
      case "cyphFinal": case "cyphCurated": return 8;
      case "cyphService": return tgt && !active(tgt.status?.cyphCare,tgt) && threatened(tgt) && (T.cyphStock??3)>0 ? 5 : 0;
      case "shieldFace": { if (active(T.shieldFace, a) || nearestFoe > 5) return 0; const f = foes.sort((x, y) => H.dist(s, a.x, a.y, x.x, x.y) - H.dist(s, a.x, a.y, y.x, y.y))[0];
        const [dx, dy] = [Math.sign(cand.target[0] - a.x), Math.sign(cand.target[1] - a.y)]; return (dx && Math.sign(f.x - a.x) === dx) || (dy && Math.sign(f.y - a.y) === dy) ? 4 : 0.5; }
      case "guard": case "cushion": return tgt && !tgt.status?.intercept && !tgt.status?.cushion && threatened(tgt) ? 3 + (tgt.lf < tgt.maxLF / 2 ? 2 : 0) : 0;
      case "guardArea": case "cushionArea": case "share": { const n = allies.filter((u) => threatened(u) && H.dist(s, a.x, a.y, u.x, u.y) <= (w.radius || 2) && !u.status?.intercept && !u.status?.loadShare).length; return n ? 2.5 + 1.5 * n : 0; }
      case "oath": return !T.oath && tgt ? 2.5 : 0;
      case "faithWard": { const w = wardOf(s, a); return w && threatened(w) ? 5 : 0; }
      case "oathGuard": return tgt && !tgt.status?.intercept && threatened(tgt) ? 5 + (tgt.lf < tgt.maxLF / 2 ? 2 : 0) : 0;
      case "regrade": return nearestFoe <= 4 ? 2 : 0.5;
      case "drainage": return liveZones(s, "drainage").some((e) => e.owner === a.id) ? 0 : 2.5;
      case "spanShare": { const o = cand.target ? (s.arena.objects || []).find((p) => p.x === cand.target[0] && p.y === cand.target[1]) : null; return o && isStructure(o) && spanMembers(s, o).length > 1 ? 3.5 : 0; }
      case "shore": { const o = !tgt && cand.target ? (s.arena.objects || []).find((p) => p.x === cand.target[0] && p.y === cand.target[1]) : null;
        if (tgt && tgt.side === a.side && !tgt.status?.loadShare && threatened(tgt)) return 4 + (tgt.lf < tgt.maxLF / 2 ? 2 : 0);
        return o && isStructure(o) && !o.shore ? 3 : 0; }
      case "loadPath": return liveZones(s, "loadPath").some((e) => e.owner === a.id) ? 0 : 4.5;
      case "clericBless": return tgt && !pledgeOf(tgt) && !active(tgt.status?.blessing, tgt) && threatened(tgt) ? 4 : 0;
      case "clericSanctuary": return tgt && !pledgeOf(tgt) && !active(tgt.status?.sanctuary, tgt) && threatened(tgt) ? 4 + (tgt.lf < tgt.maxLF / 2 ? 2 : 0) : 0;
      case "clericHands": return tgt && tgt.lf < tgt.maxLF * 0.7 && (tgt.tempo ?? 0) >= CLERIC.handsAp ? 3 + (1 - tgt.lf / tgt.maxLF) * 6 : 0;
      case "clericChorus": return tgt && !active(tgt.status?.chorus, tgt) && (tgt.tempo ?? 0) >= CLERIC.chorusAp ? 3 : 0;
      case "clericCovenant": { const flock = allies.filter((u) => !u.defeated); return flock.length >= 2 ? 4 + flock.length : 0; }
      case "exempt": case "departureFor": return tgt && threatened(tgt) && !tgt.status?.departure ? 3 : 0;
      case "rescue": return tgt && tgt.lf < tgt.maxLF / 2 ? 5 : 0;
      case "carryMountain": return tgt ? mountainValue(s, a, tgt, wire[cand.ability], H) : 0;
      case "namedStrike": { if (!tgt) return 0; const w = { ...wire[cand.ability], ...(wire[cand.ability].thematic?.[tgt.character] || {}) }; return Math.min(w.potency, tgt.lf) * 0.9 + (tgt.lf <= w.potency ? 8 : 0); }
      case "shakti": return tgt ? Math.min((tgt.character === "lakshmana" ? wire[cand.ability].thematic.lakshmana.potency : wire[cand.ability].potency), tgt.lf) * 0.9 + (tgt.lf <= wire[cand.ability].potency ? 8 : 0) : 0;
      case "abduct": { const to = tgt && !tgt.massive ? abductTo(s, a, tgt, wire[cand.ability], H) : null; return to ? 10 + to.lonely * 2 : 0; }   // worth more the farther from their friends
      case "callKin": return !T.kinCalled && H.Hires?.kinFor(s, a) ? 25 : 0;   // a whole ally is worth a great deal
      case "brahmastra": return tgt && !T.brahmastraLoosed ? Math.min(weaknessKnown(s, a, tgt, H) ? wire[cand.ability].known : wire[cand.ability].unknown, tgt.lf) * 0.9 + (tgt.lf <= (weaknessKnown(s, a, tgt, H) ? wire[cand.ability].known : wire[cand.ability].unknown) ? 8 : 0) : 0;
      case "rememberAlly": { if (!tgt || (T.remembered || []).includes(tgt.id)) return 0; const w = wire[cand.ability], max = s.rules.ultimateChargeMax || 100;
        const forgot = forgotten(tgt, H), gain = Math.min((forgot ? w.forgottenCharge : w.charge), max - (tgt.ultimateCharge || 0));
        return (forgot ? 14 : 0) + gain * 0.25 + (gain > 0 && (tgt.ultimateCharge || 0) + gain >= max ? 6 : 0); }   // charge on the damage scale; filling a bar is an ultimate now
      case "huntersMark": { const K = s.rules.ranger.ai; return tgt && !quarryOf(s, a, tgt) ? K.mark + (tgt.lf > 12 ? 1 : 0) : 0; }
      case "deadReckoning": return tgt ? reckon(s, a, tgt).potency * 0.9 : 0;   // it is damage: worth what it deals
      case "readSign": { const K = s.rules.ranger.ai; if (!tgt || signed(s, a, tgt)) return 0;   // worth it for someone in reach he cannot see
        const reach = hasBow(s, a) ? s.rules.strike.bow.range : 5; return !H.hasSight(s, a.x, a.y, tgt.x, tgt.y) && H.dist(s, a.x, a.y, tgt.x, tgt.y) <= reach ? K.readSign : 0; }
      case "callOut": { const K = s.rules.ranger.ai; if (!tgt || calledOut(tgt)) return 0;   // only worth it when cover is actually in the way
        const covered = H.line(a.x, a.y, tgt.x, tgt.y).slice(1, -1).some(([x, y]) => (H.tileAt(s, x, y).cover || 0) > 0 || (H.barrierAt(s, x, y)?.coverFraction || 0) > 0); return covered ? K.callOut : 0; }
      case "trackMove": { const K = s.rules.ranger.ai, reach = hasBow(s, a) ? s.rules.strike.bow.range : 1, at = cand.target; if (!at) return 0;   // worth it when it turns "cannot attack" into "can"
        const can = (x, y) => foes.some((f) => H.dist(s, x, y, f.x, f.y) <= reach && H.hasSight(s, x, y, f.x, f.y)); return !can(a.x, a.y) && can(at[0], at[1]) ? K.track : 0; }
      case "interceptDash": { const K = s.rules.ranger.ai; if (!tgt) return 0; const tr = trailOf(s, a, tgt); if (!tr) return 0;
        const at = interceptOf(s, tgt, tr, H), spot = dashSpot(s, a, at, H); return spot && spot.d <= 1 && nearestFoe > 2 ? K.intercept : 0; }
      case "platformLink": { if (!tgt) return 0; const P = platformOf(s, a), K = PLATFORM.ai;   // an opponent is only worth linking while the Shift is still to come
        return tgt.side === a.side ? K.ally + K.perLink * P.links.length : P.shifted ? 0 : K.client; }
      case "studyPass": return canPass(a) ? STUDY.ai.pass : 0;   // free: an AI-run player unit takes it at once
      case "docStabilize": { const u = triage(s, a, H), K = DOCTOR.ai; return u ? K.stabilize + K.perMissing * (1 - share(u)) : 0; }
      case "docCourse": return tgt?.status?.recovery && !tgt.status.recovery.held && tgt.lf < tgt.maxLF ? DOCTOR.ai.course : 0;
      case "tmMark": return !H.vesselOf?.(s, a) ? 30 : 0;   // secure the spare life first (TAMER_DESIRES.md)
      case "tmEffigy": return !H.vesselOf?.(s, a) && !Object.values(s.actors).some((u) => u.beast?.owner === a.id && !u.defeated) ? 12 : 2;
      case "tmLong": return a.lf < a.maxLF * 0.6 && Object.values(s.actors).some((u) => u.beast?.owner === a.id && !u.defeated) ? 20 : 0;
      case "tmPack": return Object.values(s.actors).filter((u) => u.beast?.owner === a.id && !u.defeated).length < 2 ? 30 : 10;
      case "docDiagnose": return tgt && !tgt.status?.diagnosed && ailment(tgt) ? DOCTOR.ai.diagnose : 0;
      case "docConfirm": return tgt?.status?.diagnosed && !tgt.status.diagnosed.confirmed && tgt.status?.recovery ? DOCTOR.ai.confirm : 0;
      case "docFull": return tgt && !tgt.status?.recovery && share(tgt) < DOCTOR.ai.fullBelow ? DOCTOR.ai.full + (1 - share(tgt)) * 4 : 0;
      case "robotTalk": return tgt ? ROBOT.ai.talk : 0;   // free, once a turn: an AI sympathizer always makes the case
      case "oilDrill": { const K = OIL.ai, at = cand.target; if (!at || barrelsOf(a) >= OIL.barrelCap) return 0;   // never under his own feet if another tile will do
        return (at[0] === a.x && at[1] === a.y ? 0.5 : 1) * (nearestFoe > 1 ? K.drill : K.drillPressed); }
      case "oilBuyOut": { const K = OIL.ai; if (!tgt) return 0; const q = priceOf(s, tgt); if (q.no) return 0; if (q.help) return K.help;
        return ["guard", "ward", "anchor", "membrane", "parry", "intercept"].some((k) => tgt.status?.[k]) || (H.dist(s, a.x, a.y, tgt.x, tgt.y) <= 2 && a.lf < a.maxLF * 0.6) ? K.principal : K.principalIdle; }
      case "oilSpill": { const K = OIL.ai, at = cand.target; if (!at) return 0; const tiles = around(s, at[0], at[1], OIL.spillRadius, H).filter(([x, y]) => !slickAt(s, x, y));
        const n = foes.filter((f) => tiles.some(([x, y]) => f.x === x && f.y === y)).length, mine = [a, ...allies].filter((u) => tiles.some(([x, y]) => u.x === x && u.y === y)).length; return n > mine ? K.spill + K.perSpilled * n : 0; }
      case "oilFlare": { const at = cand.target; if (!at) return 0; const lit = around(s, at[0], at[1], OIL.flareRadius, H).filter(([x, y]) => slickAt(s, x, y)), on = (u) => lit.some(([x, y]) => u.x === x && u.y === y);
        const n = foes.filter(on).length, mine = [a, ...allies].filter(on).length; return n > mine ? OIL.ai.perBurned * (n - mine) : 0; }
      case "oilGusher": { const G = OIL.gusher, n = foes.filter((f) => H.dist(s, a.x, a.y, f.x, f.y) <= G.radius).length; return n && barrelsOf(a) ? (G.base + G.perBarrel * barrelsOf(a)) * 0.9 * n : 0; }
      case "unchained": { const n = foes.filter((f) => H.dist(s, a.x, a.y, f.x, f.y) <= 1).length, k = S(s).stored[a.id] || 0; return n ? 3 + k * 0.5 : 0; }
      case "blowOff": { const pr = steamPressure(s, a.id), n = foes.filter((f) => H.dist(s, a.x, a.y, f.x, f.y) <= 1).length; return T.overpressure ? 8 + pr : pr >= 3 && n ? 3 + pr : 0; }
      case "fullSteam": { const n = foes.filter((f) => H.dist(s, a.x, a.y, f.x, f.y) <= 5).length; return n ? 6 + n : 0; }
      case "rogueCut": { if (!tgt || tgt.side === a.side || (st(a).cutGoods || []).length >= ROGUE.cacheCap) return 0;
        const goods = rogueBestGoods(tgt, H, 1); return goods.length ? 5 + (RARITY_RANK[H.accountItems?.consumables?.[goods[0]]?.rarity] ?? 0) : 1.5; }
      case "rogueDisarm": { if (!tgt || tgt.side === a.side || (st(tgt).disarmed && active(st(tgt).disarmed, tgt))) return 0;
        return rogueStripLens(tgt, H) || rogueStripGear(tgt) ? 5 : 0.5; }
      case "roguePocket": return (st(a).cutGoods || []).length && (a.inventory || []).length < (a.inventoryCapacity ?? 0) ? 6 : 0;
      case "rogueFence": return roguePocketed(a).length ? 4 : 0;
      case "rogueHeist": { if (!tgt || tgt.side === a.side) return 0;
        return 3 + rogueBestGoods(tgt, H, ROGUE.heistCuts).length * 1.5 + (rogueBuffOf(tgt) ? 2 : 0); }
      case "ltSkim": { if (!tgt || tgt.side === a.side || tgt.status?.guard) return 0;
        const room = (s.rules.longtermism?.fundCap ?? 24) - (a.longtermismFund || 0);
        const take = Math.min(s.rules.longtermism?.skimLf ?? 6, Math.max(0, (tgt.lf || 0) - 1), room);
        return take > 0 ? 4 + take * 0.4 : 0; }
      case "ltInvest": return (a.longtermismFund || 0) > 0 ? 3 + a.longtermismFund * 0.3 : 0;
      case "ltCall": return 6;
      case "ltContract": { if (!tgt || tgt.side === a.side) return 0;
        return 8 + Math.min(s.rules.longtermism?.contractLf ?? 12, Math.max(0, (tgt.lf || 0) - 1)) * 0.3; }
      case "memorialRoll": { const n = Math.min(3, a.memorial?.principal || 0); if (!n) return 0;
        const kin = live(s).filter((u) => u.side === a.side && H.dist(s, a.x, a.y, u.x, u.y) <= 3).length;
        const foes = live(s).filter((u) => u.side !== a.side && H.dist(s, a.x, a.y, u.x, u.y) <= 3).length;
        return (kin * Math.min(30, 6 * n) + foes * Math.min(20, 4 * n)) * 0.4; }
      case "seedCache": { const friends = live(s).filter((u) => u.side === a.side && u.id !== a.id).length;
        return friends ? 14 : 6; }
      case "seedBloom": { const near = live(s).filter((u) => u.side === a.side && H.dist(s, a.x, a.y, u.x, u.y) <= 2).length;
        return near > 1 ? 20 : 8; }
      case "ferrySwap": { if (!tgt || tgt.side !== a.side || tgt.id === a.id) return 0;
        const danger = 1 - (tgt.lf || 0) / Math.max(1, tgt.maxLF || 100);
        const crowd = live(s).filter((u) => u.side !== a.side && H.dist(s, tgt.x, tgt.y, u.x, u.y) <= 2).length;
        return 6 + danger * 18 + crowd * 4; }
      case "ferryLast": { const riders = live(s).filter((u) => u.side === a.side && u.id !== a.id && H.dist(s, a.x, a.y, u.x, u.y) <= 4);
        const hurt = riders.filter((u) => (u.lf || 0) < (u.maxLF || 100) * 0.5).length;
        return riders.length ? riders.length * 6 + hurt * 10 - 4 : 0; }
      case "diveDescend": { if (!cand.target || diverVeiled(a)) return 0;   // worth it when the landing flanks or escapes
        const [dx, dy] = cand.target;
        const escape = foes.filter((u) => H.dist(s, a.x, a.y, u.x, u.y) <= 2).length - foes.filter((u) => H.dist(s, dx, dy, u.x, u.y) <= 2).length;
        const flank = foes.filter((u) => H.dist(s, dx, dy, u.x, u.y) <= 2 && H.dist(s, a.x, a.y, u.x, u.y) > 2).length;
        return 4 + escape * 4 + flank * 5; }
      case "diveUndertow": { if (!tgt || tgt.side === a.side) return 0;
        const basins = diverBasins(s, a); if (!basins.length) return 0;
        const d0 = Math.min(...basins.map((b) => H.dist(s, tgt.x, tgt.y, b.x, b.y)));
        const danger = 1 - (tgt.lf || 0) / Math.max(1, tgt.maxLF || 100);
        return 8 + (d0 <= 3 ? 10 : 0) + danger * 8; }   // the drag earns its keep when the foe lands wet
      case "diveDrown": { if (!cand.target) return 0;
        const [bx, by] = cand.target, R = w.radius || 2;
        const caught = foes.filter((u) => H.dist(s, bx, by, u.x, u.y) <= R);
        const wet = caught.filter((u) => diverVeiled(u) || diverInWater(s, a, u.x, u.y, H, [{ x: bx, y: by }])).length;
        return caught.length ? caught.length * 12 + wet * 4 - 6 : 0; }
      case "clockRewind": { const last = S(s).lastScheduled?.[a.id] || 0; return tgt && last > 0 ? Math.round(last * CLOCKWORK.rewindMul) * 0.9 : 0; }
      case "clockComplication": return tgt ? 8 : 0;
      case "platformAccept": return offerOf(a) ? PLATFORM.ai.accept : 0;   // it is a good deal, today
      case "platformLock": { const P = platformOf(s, a), K = PLATFORM.ai, link = tgt && P.links.find((l) => l.id === tgt.id); if (!link || link.lock) return 0;
        return tgt.side === a.side ? K.lockAlly : fizzling(link, tgt) ? 0 : K.lockClient; }
      case "platformDeprecate": { const link = tgt && platformOf(s, a).links.find((l) => l.id === tgt.id); return link?.lock && tgt.side !== a.side ? PLATFORM.ai.deprecate : 0; }
      case "platformShift": { const P = platformOf(s, a), K = PLATFORM.ai, n = P.links.filter((l) => l.client).length; return P.shifted || !n ? 0 : K.shift + K.perClient * n; }
      case "platformBridge": { if (!tgt || tgt.side !== a.side) return 0;   // only to get a hurt hub out from under someone, behind a healthier ally nobody is on
        const pressed = (u) => foes.some((f) => H.dist(s, u.x, u.y, f.x, f.y) <= 1);
        return a.lf < a.maxLF * 0.5 && pressed(a) && !pressed(tgt) && tgt.lf / tgt.maxLF > a.lf / a.maxLF ? PLATFORM.ai.bridge : 0; }
      case "culturalMoment": { const K = s.rules.hype.ai, n = foes.filter((u) => believes(s, a, u)).length;   // never after being seen through; best with a crowd
        return a.hype?.momentUsed || !n || n < Math.min(2, foes.length) ? 0 : K.moment + K.perBeliever * n; }
      case "law": case "dependence": { if (active(T.contract, a)) return 0; const n = foes.filter((f) => H.dist(s, a.x, a.y, f.x, f.y) <= (w.radius || 3)).length; return n ? 2.5 + 2 * n + (foes.some((f) => f.ultimateCharge >= 100) ? 2 : 0) : 0; }
      case "earthworks": return nearestFoe <= 6 && !(s.barriers || []).some((b) => b.owner === a.id) ? 3.5 : 0;
      case "read": return tgt && T.openingRead?.target !== tgt.id ? 3 : 0;
      case "tether": return active(T.tether, a) ? 0 : 2;
      case "fulcrum": return active(T.fulcrum, a) || ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => H.inside(s, a.x + dx, a.y + dy) && (H.tileAt(s, a.x + dx, a.y + dy).blocksMove || H.barrierAt(s, a.x + dx, a.y + dy) || H.heightAt(s, a.x + dx, a.y + dy) > H.heightAt(s, a.x, a.y))) ? 0 : 4;
      case "hold": return tgt && !tgt.status?.held ? 4.5 + (w.stun ? 2 : 0) : 0;
      case "holdMore": return tgt?.status?.held?.by === a.id && tgt.status.held.freedoms.length < 2 ? 4 : 0;
      case "petrify": return tgt?.status?.held?.by === a.id && tgt.ownerTurns - (tgt.status.held.heldSince ?? 99) >= (w.heldTurns || 2) ? 8 : 0;
      case "gazeGarden": { const n = foes.filter((u) => !u.status?.held && H.dist(s, a.x, a.y, u.x, u.y) <= (w.radius || 6) && H.hasSight(s, a.x, a.y, u.x, u.y)).length; return n ? 4 + 2 * n : 0; }
      case "compare": case "check": {
        if (!tgt || active(tgt.status?.confirmed, tgt)) return 0;
        const have = new Set(ledger(s, a, tgt));
        const could = new Set([...have, ...((s.insight?.knowledge?.[a.id]?.[tgt.id]?.revealed || []).length ? ["observed"] : []), ...((s.log || []).some((e) => e.kind === "act" && e.actor === tgt.id) ? ["witnessed"] : []), ...(w.kind === "check" && H.hasSight(s, a.x, a.y, tgt.x, tgt.y) ? ["direct"] : [])]);
        const need = active(T.isolated, a) ? 1 : 2;
        if (w.kind === "check") return could.size > have.size ? 4 : 0;   // only worth it if it adds a NEW independent source
        return could.size >= need ? 4.5 : 0;                             // compare only when it would confirm
      }
      case "facts": return tgt ? 5 : 0;
      case "authenticate": return tgt && ["mimic", "illusion", "disguise", "decoy", "departure"].some((k) => tgt.status?.[k]) ? 5 : 0.5;
      case "caseClosed": return 5;
      case "assign": return tgt && allies.length && !allies.some((u) => orderOf(u)?.target === tgt.id) ? 3.5 : 0;
      case "delegate": return tgt && orderOf(tgt)?.from === a.id ? 3 : 0;
      case "operationOrder": return tgt && allies.length >= 2 && !allies.some((u) => orderOf(u)?.target === tgt.id) ? 6 : 0;
      case "convergence": { if (!tgt) return 0; const n = allies.filter((u) => H.hasSight(s, u.x, u.y, tgt.x, tgt.y)).length; return n ? 5 + 3 * Math.min(3, n) + (recovering(s, tgt) ? 3 : 0) : 0; }
      case "pounce": return tgt ? 14 + Math.min(4, Math.max(0, H.dist(s, a.x, a.y, tgt.x, tgt.y) - 1)) : 0;
      // The Maid (Mala's Survive log, 2026-10-14: Protect the Essential 13 times on benches and plants, Sort three times down
      // empty lines, then meditating on 80 banked AP). Each value is what the technique would do from here, on that target.
      case "maidSort": {   // only the foes actually in the chosen line count; one with nowhere to go takes 6
        if (!cand.target) return 0;
        const dx = Math.sign(cand.target[0] - a.x), dy = Math.sign(cand.target[1] - a.y); if (!!dx === !!dy) return 0;
        let v = 0;
        for (let i = 1; i <= 4; i++) {
          const x = a.x + dx * i, y = a.y + dy * i; if (!H.inside(s, x, y) || (H.tileAt(s, x, y).blocksMove && !(s.arena.objects || []).some(o => o.x === x && o.y === y))) break;
          const u = H.actorAt(s, x, y);
          if (u && u.side !== a.side && foes.includes(u)) {
            const side = dx ? [[x, y + 1], [x, y - 1]] : [[x + 1, y], [x - 1, y]];
            v += side.some(([nx, ny]) => free(s, nx, ny, H) && !(s.arena.objects || []).some(o => o.x === nx && o.y === ny)) ? 2.5 : 5;
          }
          if (x === cand.target[0] && y === cand.target[1]) break;
        }
        return v;
      }
      case "maidProtect": {   // an ally (or herself) with a foe near, more when hurt; an object only when the scene says it matters
        if (!cand.target) return 0;
        if (tgt) {
          if (tgt.side !== a.side || active(tgt.status?.maidProtected, tgt)) return 0;
          const near = foes.some(f => H.dist(s, f.x, f.y, tgt.x, tgt.y) <= 6); if (!near) return 0;
          return 3 + (tgt.lf < tgt.maxLF * 0.6 ? 2 : 0) + (tgt.id === "player" ? 1 : 0);
        }
        const o = (s.arena.objects || []).find(q => q.x === cand.target[0] && q.y === cand.target[1]);
        return o && !o.protected && (o.role === "service-receptacle" || o.evidenceId || o.vignetteObjective || o.role?.startsWith("evidence:")) ? 3 : 0;
      }
      case "maidExtract": {   // an adjacent foe takes 8; a hazard on the ground is cleared into the cart; clutter is barely worth it
        if (!cand.target) return 0;
        if (tgt && tgt.side !== a.side && foes.includes(tgt)) return 6;
        if (tgt && tgt.id !== a.id) return 0;
        const full = (receptacleFor(s, a, false).stored || []).length >= 3 ? 0.5 : 1;
        const trap = knownTrapAt(s, a, cand.target[0], cand.target[1], H);
        if (trap) return (trap.ownerSide !== a.side ? 3.5 + (allies.some(u => H.dist(s, u.x, u.y, trap.x, trap.y) <= 3) ? 1.5 : 0) : 0.5) * full;   // a foe's trap near her side is worth clearing
        if (pickupAt(s, cand.target[0], cand.target[1])) return 2.5 * full;   // tidy it into the cart, where her side can get at it
        if ((s.terrainEffects || []).some(e => (e.tiles || []).some(q => q[0] === cand.target[0] && q[1] === cand.target[1]))) return 3;
        return (s.arena.objects || []).some(o => o.x === cand.target[0] && o.y === cand.target[1] && o.evidenceId !== "receptacle" && o.role !== "service-receptacle") ? 0.5 : 0;
      }
      case "maidRemove": return tgt && Object.values(tgt.status || {}).some(Boolean) ? 4 : tgt ? 2 : 0;
      case "maidRestore": return tgt && Object.values(tgt.status || {}).some(Boolean) ? 4.5 : receptacleHasContents(s, a) ? 3 : 0;
      case "foldPanel": {   // panel placement vs approaches: one panel at a time, facing a live approach
        if (origamistPanels(s, a).length) return 0;
        return nearestFoe <= 6 ? 3.5 : 0;
      }
      case "paperRoute": {   // route-vs-hold: build when riders stand beside her, hold with nobody to carry
        const riders = routeRiders(s, a);
        return riders.length ? 6 + 2 * (riders.length - 1) : 0;
      }
      case "unfold": {   // unfold-vs-hold: unfold when her geometry shelters foes more than allies, hold live geometry
        const sheltered = origamistPanels(s, a).flatMap((b) => panelShelters(s, b));
        return sheltered.filter((u) => u.side !== a.side).length > sheltered.filter((u) => u.side === a.side).length ? 5 : 0;
      }
      case "paperBurnout": {   // burn-vs-keep: burn when the route is the only path (the ground route cut), keep with redundant routes
        if (T.paperBurn || !allies.length) return 0;
        return allies.some((u) => groundCut(s, a, u, H)) ? 6 : 0;
      }
      case "relocate": case "teleport": case "steamAdvance": {
        if (isOrigamist(a)) {   // specialist: door/line geometry and endpoint hygiene (siblings keep the line below)
          if (cand.ability === "linkedStep") return nearestFoe <= 1 ? 2 : 0.3;   // the crease is an escape first
          if (cand.ability === "remoteDoor") {   // carry riders to safety; never deliver them beside a foe
            const riders = routeRiders(s, a), at = cand.target || [a.x, a.y];
            if (!riders.length) return 0.3;
            return foes.some((f) => H.dist(s, at[0], at[1], f.x, f.y) <= 1) ? 0 : 3 + riders.length;
          }
          if (cand.ability === "suspendedRoute") {   // traverse what walking cannot: blocked, wet or hazardous ground between
            const at = cand.target || [a.x, a.y];
            return H.line(a.x, a.y, at[0], at[1]).slice(1).some(([x, y]) => { const t = H.tileAt(s, x, y); return t.blocksMove || (t.tags || []).includes("water") || (t.hazard || 0) > 0; }) ? 3 : 0.5;
          }
        }
        return nearestFoe <= 1 ? 1.5 : 0.3;
      }
      case "perch": return cand.target && perchMarks(a).length < 3 ? 2 : 0;
      case "swoop": return cand.target && perchMarks(a).length ? 2 : 0;
      case "takeoff": return T.grounded ? 6 : 0;
      case "overflight": return tgt ? 12 : 0;
      case "buff": {
        const b = w.buff, on = (k) => active(T[k], a);
        const v = { pairBonus: on("pairBonus") ? 0 : 3, chained: on("chained") ? 0 : 3, reorder: 1.5, inputFilter: on("inputFilter") ? 0 : 2.5, vow: on("vow") || nearestFoe > 6 ? 0 : 3.5,
          installed: (s.barriers || []).some((x) => x.owner === a.id) && !on("installed") ? 2.5 : 0, decoy: on("decoy") || nearestFoe > 6 ? 0 : 2.5,
          failover: (T.stun || T.silenced || T.choked) || a.lf < a.maxLF * 0.5 ? 5 : 0, degraded: on("degraded") ? 0 : 3, overdrive: on("overdrive") || (S(s).strain[a.id] || 0) >= 2 ? 0 : 3,
          departure: on("departure") || nearestFoe > 6 ? 0 : 3, arrivalGate: on("arrivalGate") ? 0 : 1, growth: 4, heavyFrame: a.lf < a.maxLF * 0.6 ? 4 : 1.5,
          yield: on("yield") || nearestFoe > 2 ? 0 : 3, isolated: on("isolated") ? 0 : 2, revised: T.revised ? 0 : 5, specialized: T.specialized ? 0 : 3,
          warCry: on("warCry") || !allies.length ? 0 : 2.5, berserk: on("rage") || nearestFoe > 4 ? 0 : 3, takeIt: on("takeIt") || nearestFoe > 2 ? 0 : 3,
          valve: T.steamValve || steamPressure(s, a.id) < 2 ? 0 : 2 }[b];
        return v ?? 1;
      }
      default: return 1;
    }
  }

  // AI for the SHARED existing abilities a class leans on (the generic scorer only sees damage).
  function aiValueShared(s, a, cand, effect, H) {
    if (!CLASS_PAIRS[a.character]) return null;
    const foes = live(s).filter((u) => u.side !== a.side), near = Math.min(99, ...foes.map((f) => H.dist(s, a.x, a.y, f.x, f.y)));
    const own = (s.barriers || []).filter((b) => b.owner === a.id).length;
    const extraCover = (id) => { const ar = H.ability(id)?.area; if (!ar || ar.shape === "single") return 0; if (ar.shape === "line") return Math.min(1, ((ar.length || 1) - 1) * 0.5); return 1; };   // wider walls are worth more than single tiles
    if (["berm", "barrier", "contourBerm", "bermRing"].includes(effect)) return near <= 5 && own < 2 ? 4 + extraCover(cand.ability) : 0;
    if (effect === "anchor") return near <= 1 && !a.status?.anchor ? 3 : 0;
    if (effect === "sectionCut" || effect === "planView") return near <= 6 ? 1.5 : 0;
    if (effect === "swale" || effect === "checkDam") {   // Pearl Diver: basins are the kit — shape water first, then hunt in it
      if (!pairIs(a, "swale", "stealth")) return null;
      const n = diverBasins(s, a).length;
      return n < 2 ? 5 : n < 3 ? 2 : 0;
    }
    if (effect === "successionPatch" || effect === "nurseLog") {   // Seedkeeper: plant first (it matures over rounds), then bury; wood takes the log
      if (!pairIs(a, "longtermism", "succession")) return null;
      const growing = (s.successionPatches || []).filter((p) => p.owner === a.id).length;
      const wood = effect === "nurseLog" && cand.target && (s.arena.objects || []).some((o) => o.x === cand.target[0] && o.y === cand.target[1] && (o.type === "log" || o.type === "stump"));
      return (growing < 1 ? 9 : growing < 2 ? 1.5 : 0) + (wood ? 2 : 0);
    }
    // Commitments (content.js rules.commitments.ai). These pay off later, so the scorer cannot see their worth in a
    // preview; this is what they are worth when the conditions for keeping them are in sight.
    const K = s.rules.commitments?.ai;
    if (K) {
      const at = cand.target || [a.x, a.y];
      if (effect === "presidentPromise") {   // a promise to defeat the opponent it names: only when that one is close to falling
        if (a.promise || a.debt) return 0;
        const mark = foes.find((f) => f.x === at[0] && f.y === at[1]);   // the opponent this cast names
        return mark && !mark.communed && !mark.summon && mark.lf <= mark.maxLF * K.finishBelow && H.dist(s, a.x, a.y, mark.x, mark.y) <= K.reach ? K.promise : 0;
      }
      if (effect === "presidentGuarantee") { const mark = a.promise?.target && H.actor(s, a.promise.target); return a.promise && !a.promise.stake && mark && mark.lf <= mark.maxLF * K.finishBelow ? K.guarantee : 0; }
      if (effect === "presidentAccord") return a.office && live(s).some((u) => u.side === a.side && u.id !== a.id) ? K.accord : 0;
      if (effect === "anotherWayHome") {      // the arrival strike, discounted: it lands later, and only if he gets there
        if (a.pathwayPromise || H.dist(s, a.x, a.y, at[0], at[1]) > K.reach || (at[0] === a.x && at[1] === a.y)) return 0;
        const R = s.rules.commitments, hitCount = foes.filter((f) => H.dist(s, f.x, f.y, at[0], at[1]) <= (R.homecomingRadius ?? 2)).length;
        return hitCount * ((H.ability("anotherWayHome")?.potency || 0) + (R.homecomingAdd || 0)) * K.home;
      }
    }
    return null;
  }

  // Flight (Mala, 2026-10-08): Super Hero and Super Heroine move farther (+3 movement, double the normal 3) for half the AP.
  // Granted by the class loadout, so it applies whether you play them or fight them.
  const FLIGHT = { budgetAdd: 3, costMul: 0.5 };
  const FLYERS = ["super_hero", "super_heroine", "ornithopter"];
  // Flying also ignores every terrain movement cost (climbs, cliffs, water, hazards) unless the flyer has been knocked
  // into water: then it's grounded (wings soaked) and moves like anyone else until it starts a turn on dry land.
  const isFlyer = (a) => FLYERS.some((c) => pairIs(a, CLASS_PAIRS[c][0], CLASS_PAIRS[c][1])) || hasTr(a, "ascended") || !!a?.winged;   // Ascended: the gold form flies; winged: a MAX form whose data flies (MX2, the Khan's rhino)
  const flies = (a) => isFlyer(a) && !a.status?.grounded;
  // Aloft: a flying ornithopter counts as height +2 on both ends of a sight line (INVENTION-ORN-7: sees and is seen
  // as +2). Generic hook for any future flyer; only the ornithopter's pair claims the bonus today.
  const sightHeightBonus = (a) => isOrnithopter(a) && flies(a) ? 2 : 0;
  function moveMods(a) { if (flies(a)) return FLIGHT; if (a && a.primary === "legitimacy" && a.secondary === "constraint") return { budgetAdd: 2, costMul: 1 }; return { budgetAdd: Esker.moveAdd(a) + aeroMoveAdd(a) + (hasTr(a, "lightFrame") ? 1 : 0), costMul: 1 }; }   // Esker: −1 move per burden; Aviator: Aerodynamic, Thrust; Starfarer: Light Frame
  // ── The Starfarer (Mala, 2026-10-19) ── Light Frame: a light hull is fast and fragile (−10 max LF, +1 move).
  function lightFrameStart(s, a, H) {
    if (!hasTr(a, "lightFrame") || a._lightFrameApplied || a.defeated) return;
    a._lightFrameApplied = true; a.maxLF = Math.max(1, (a.maxLF || 0) - 10); a.lf = Math.min(a.lf, a.maxLF);
    H.log(s, { kind: "effect", actor: a.id, text: `${a.name}'s light frame trades hull for speed (−10 max LF, +1 move).`, why: ["Light Frame applies once, at her first turn start."] });
  }
  // Called on entering a tile. true = skip the terrain's entry effects (a flyer moving on its own passes over hazards).
  function onEntry(s, t, x, y, cause, isWater, H) {
    if (!isFlyer(t)) return false;
    const forced = cause !== "enters";
    if (forced && isWater) {
      t.status.grounded = { label: "Grounded", since: s.round };
      H.log(s, { kind: "effect", actor: t.id, target: t.id, tiles: [[x, y]], text: `${t.name} is knocked into the water: wings soaked, grounded until they start a turn on dry land.`, why: ["Flight ignores movement costs, except after being knocked into water."] });
      return false;
    }
    return !forced && flies(t);
  }

  const CLASS_NAMES = { shaman: "Shaman", big_game_hunter: "Big Game Hunter", agent_swarm: "Agent Swarm", rapper:"Rapper", musician:"Musician", bard:"Bard", jazz_musician:"Jazz Musician", knight: "Knight", pharaoh: "Pharaoh", daedalus: "Daedalus", samurai: "Samurai", gemini: "Gemini", wizard: "Wizard", jujutsu_sorcerer: "Jujutsu Sorcerer",
    super_hero: "Super Hero", esker: "Esker", super_heroine: "Super Heroine", super_villain: "Super Villain", defective_machine: "Defective Machine", teleporter: "Teleporter", clockwork: "Clockwork",
    magistrate: "Magistrate", mutant_boar: "Mutant Boar", boarman: "Boarman", animalTamer: "Animal Tamer", anime_protagonist: "Anime Protagonist", mma_fighter: "MMA Fighter", kickboxer: "Kickboxer", hypebeast: "Hypebeast", ranger: "Ranger", tech_billionaire: "Tech Billionaire", oil_billionaire: "Oil Billionaire", doctor: "Doctor", odysseus: "Odysseus", president: "President", detective: "Detective", modern_artist: "Modern Artist", cyph: "Cyph", maid: "Maid", general: "General", bastet: "Bastet", ninja: "Ninja", police_officer: "Police Officer", thief: "Thief", monkey_king: "Monkey King", hanuman: "Hanuman", jambavan: "Jambavan", rama: "Rama", lakshmana: "Lakshmana", sita: "Sita", hypnotist: "The Hypnotist", ravana: "Ravana", kumbhakarna: "Kumbhakarna", indrajit: "Indrajit", mandodari: "Mandodari", surpanakha: "Surpanakha", jatayu: "Jatayu", director: "Director", actor: "Actor", barbarian: "Barbarian", paladin: "Paladin", rogue: "Rogue", hooded_cyber_rogue: "Cyber Punk Rogue", medusa: "Medusa", cleric: "Cleric", steam_walker: "Steam Walker", ornithopter: "Ornithopter", engineer: "Engineer", origamist: "Origamist", mangaka: "Mangaka", aviator_hero: "Aviator Hero", jiang_qing: "Jiang Qing", starfarer: "Starfarer", pioneer: "Pioneer", martial_artist: "Ascending Martial Artist", memorialist: "Memorialist", hot_pot_berserker: "Hot Pot Berserker", chef: "Chef", seedkeeper: "Seedkeeper", ferryman: "Ferryman", pearl_diver: "Pearl Diver", orgonite_trooper: "Orgonite Trooper", leviathan_suit: "Leviathan Suit", scale_firmware: "Scale Firmware", white_jacket_gunner: "White-Jacket Gunner", bronze_admin: "Bronze Administrator", horned_suit: "Horned Suit", teal_eel: "Teal Eel", remora_adventurer: "Remora Adventurer" };
  // ── The Emissary's memory (docs/emissary.md, "What it remembers") ──
  // memory: { classId: { met, won } } from the account. No memory: the seeded random roll it always was (roll("")).
  // With memory it weighs the kits it has worn against you plus one it has not (seeded): one Thompson guess each,
  // Beta(1 + won, 1 + lost) for a remembered kit and Beta(1, 1) for the new one, and wears the best. One arm stands for
  // "someone new", not one per untried kit, or ~38 untried kits would drown out every memory. A kit's last
  // EMISSARY_MEMORY_CAP meetings count at full weight; older history is scaled down, so it can change its mind.
  const EMISSARY_MEMORY_CAP = 12;
  function emissaryKit(pool, memory = {}, roll) {
    const known = pool.filter((id) => memory[id]?.met > 0), untried = pool.filter((id) => !known.includes(id));
    const fresh = untried.length ? untried[Math.floor(roll("") * untried.length)] : null;
    if (!known.length) return fresh;
    const guess = (id) => { const m = memory[id] || { won: 0, met: 0 }, k = Math.min(1, EMISSARY_MEMORY_CAP / Math.max(1, m.met));
      const a = 1 + Math.round(m.won * k), b = 1 + Math.round((m.met - m.won) * k);
      return Array.from({ length: a + b - 1 }, (_, i) => roll(`:${id}:${i}`)).sort((x, y) => x - y)[a - 1]; };   // a-th smallest of a+b-1 uniforms ~ Beta(a, b)
    const arms = [...known, ...(fresh ? [fresh] : [])], g = Object.fromEntries(arms.map((id) => [id, guess(id)]));
    return arms.reduce((best, id) => (g[id] > g[best] ? id : best), arms[0]);
  }

  const aiVeto = (s, a, cand) => Esker.aiVeto(s, a, cand);
  function price(s, a, abilityId, m) {
    Law.price?.(s, a, abilityId, m);
    Guests?.price?.(s, a, abilityId, m);
  }
  function turnStartGuests(s, a, H) { Guests?.turnStart?.(s, a, H); }
  function attend(s, a, act, H, spend) { return Guests?.callAttendant?.(s, a, act, H, spend) || null; }
  function attendantPulse(s, a, inst, H) { Guests?.pulse?.(s, a, inst, H); }
  function afterHitGuests(s, src, tgt, inst, dealt, H) {
    if (tgt && tgt.defeated) Guests?.onOwnerFell?.(s, tgt, H);   // the host falls: every guest leaves
    else Guests?.onHit?.(s, tgt, H);   // the Spirit Raven: any hit ends it
  }
  return { holyOf, price, law: Law, ma: Ma, turnCost, aeroForce, AERO, dropFragment, pasteStolen, stolenPasteEnds, aiVeto, cartOf, emissaryKit, EMISSARY_MEMORY_CAP, performers:Performers, stealth:Stealth, actor:Actor, builds: CB, Martial, Teleology, mise: Mise, homology: Homology, prepared, CLASS_NAMES, moveMods, flies, onEntry, FLIGHT, sightHeightBonus, aiValue, aiValueShared, wire, pairsFor, isRanger, hasBow, signed, openingRead, moved, trailOf, interceptOf, beforeStrike, bowBlocked, quarryOf, STUDY, isStudent, rankOf, DOCTOR, triage, ROBOT, isRobot, caseOdds, OIL, slickAt, priceOf, PLATFORM, isPlatformOwner, centerOf, centerFell, syncCenter, centers, towersOf, strikeable, towerFire, relayOrigins, relayFor, sampleCircuits, circuitOf, platformOf, linkOf, isHype, believes, hypeOf, turnBudget, observed, CLERIC, pledgeOf, pledgeKept, congregationApplies, available, beforeAbility, beforeMove, target, resolve, redirect, damageMods, afterHit, spendTrophyEye, resistKnock, turnStart, roundEnd, CLASS_PAIRS, ROGUE, isRogue, isEngineer, isStructure, gradeResisted, steerShove, objectDamagePlan, attend, attendantPulse };
});
