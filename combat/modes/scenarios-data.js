"use strict";
// Random-battle scenarios, the data (spec ~/loci-orbit/ready-to-review/claude-random-scenarios-spec/specs/SCENARIOS.md, 3.1 and 4).
// A scenario is a premise plus an objective, laid over the options `E.randomEncounterOptions` returns (modes/scenarios.js).
// Slice 6 adds SC05 (a melee of two other crews: `mode`, `foes.groups`) and SC10 (the Warfare encounter: `encounter`). Slice 1 holds the two premise-only classic scenarios: SC03 The Open House and SC01 Night Shift at the Quarry; slice 2 adds the two authored-event ones, SC07 Brushfire Season and SC09 Something Comes Down. Both end
// the way every classic battle ends (the default branch of checkOutcome, rules.standoff, rules.maxRounds); neither adds a
// clock, because neither adds an objective. The clocked kinds (survive, hold, break, salvage, ward, bounty, exit) are later slices.
//
// Record fields (all optional unless noted):
//   id, name, minTier (1-3), weight (> 0)               required. minTier gates it by account wins (scenarios.js tierOf)
//   arenas: "any" | [designedArenaId, ...]              the map is rolled by the engine unless a list is given
//   phase: "day" | "night", weather: weatherId          forced; else the random roll stands
//   foes: "roll" | { crews: [crewId...], exclude: [classId...], count: [min, max] } | { fixed: [characterId...] }   "roll" keeps the foes the engine rolled, cut to `count[1]` (top-level count)
//   fixed: exact characters in order (teaching scenarios, SC22+); no draw, no tier trim. Exclusive with groups (groups wins if both).
//     With fixed: at: [[x, y]...] puts each fixed foe on its tile (when walkable and free), and holdTurns: n makes each keep its tile for its first n turns.
//   force: { <checkpointId>: { type, ...fields } }      authored event at that checkpoint (random-events.js create force); wild: [{ kind: "brushfire" }]  a field form at the start
//                                                      one crew is drawn, then `count` of its classes (tier trims the count)
//   foes.lead: classId                                  one fixed foe, always drawn first and counted in `count` (the crew fills the rest)
//   foes.traits: { classId: [traitId...] }              traits granted to that class when it is drawn as a foe (Spilled Pot: Kitchen Animism)
//   houses: "always"                                    rules.houses.chance becomes { default: 1 } for this battle
//   quiet: true                                        a quiet duel: no rolled ally, no event arrivals (participants or schedule); weather stands. Teaching duels (SC22+).
//   objective: { kind }                                 required; slice 1 has only "classic" (no deadline field)
//   text: { open, mid: { when, text }, result: { player, enemy, none } }   same beats as a theme (Arantxa narrates them); when: { round } | { houseOwned } | { firstFall } | { foeHolds: trigger | true }; `none` is the
//                                                      round-limit ending (winner "none"), which a theme has no line for
// Spec note: SCENARIOS.md 3.1-3.2 say every scenario carries a clock of at most 14, sections 4 and 12 say a premise-only classic one has
// none (it ends by the default branch, rules.standoff and maxRounds). Slice 1 follows 4 and 12: these two have no deadline.
//   mid.when: { round } | { houseOwned } | { firstFall }
//
// FAME HOOK (Mala, 2026-10-30): Fame is a real status, so a clean-hands win (SC11, a later slice) may pay Fame. A Fame spec
// is being written; nothing here awards Fame. When it lands, it reads `bonus.fame` on a scenario record (absent on every
// record today; tests/scenarios.test.mjs "no scenario pays Fame yet" pins that), at the same place the Seeds bonus lands.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatScenariosData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // Law enforcement is the police the engine already sends in response to harm (and the federal theme's cast), not a night crew.
  const LAW = ["policeOfficer", "police_officer", "fbi_agent", "tactical_operative"];

  const SCENARIOS = {
    openHouse: { id: "openHouse", name: "The Open House", minTier: 1, weight: 1,   // SC03
      arenas: "any",
      foes: { crews: ["money", "civic"], exclude: LAW, count: [2, 2] },
      houses: "always",
      objective: { kind: "classic" },
      text: {
        open: "There is a house nobody lives in and everybody has a claim on. The open house is open to bids.",
        mid: { when: { houseOwned: true }, text: "The deed changes hands. Nobody signed anything." },
        result: { player: "The bidding ends with your side still standing. The others leave with a story about the keys.", enemy: "The bidding ends without you, and the house is still anybody's.",
          none: "The bidding drags on until the light goes. The house stands empty, and every claim is still on the table." } } },

    nightShift: { id: "nightShift", name: "Night Shift at the Quarry", minTier: 1, weight: 1,   // SC01
      arenas: ["quarryLedge", "desertDunes"],
      phase: "night", weather: "fog",
      foes: { crews: ["civic"], exclude: LAW, count: [2, 3] },
      objective: { kind: "classic" },
      text: {
        open: "The night crew never clocked out. The stone is still warm and nobody will say who it belongs to.",
        mid: { when: { round: 5 }, text: "A work light swings over the ledge, and the shadows it throws swing with it." },
        result: { player: "The crew leaves the stone for the night, and the fog takes the work lights.", enemy: "The foreman logs you as a trespass and turns the lights back on.",
          none: "Neither side gives way until the fog lifts. The stone is still warm and still nobody's." } } },

    brushfireSeason: { id: "brushfireSeason", name: "Brushfire Season", minTier: 2, weight: 1,   // SC07
      arenas: ["desertDunes", "quarryLedge"],
      weather: "heat",                                                 // the starting sky; the climate may move it before round 5 (same as SC01's fog)
      foes: "roll", count: [1, 3],                                      // the rolled foes, trimmed to the spec's 1-3; tier 3's "at least 3" does not apply to rolled foes
      force: { midpoint: { type: "weather", weatherId: "windy" } },   // heat at the start, wind at round 5
      wild: [{ kind: "brushfire" }],                                   // one front on the windward edge of the fuel
      objective: { kind: "classic" },
      text: {
        open: "The grass is the color of paper and somebody has a match. It may be a foe, or it may be the weather.",
        mid: { when: { round: 5 }, text: "The wind turns. The fire does not need convincing." },
        result: { player: "The fire runs out of what it came for.", enemy: "You are the last thing standing in a black field.",
          none: "The wind drops before anyone does, and the fire has nothing left to say." } } },

    somethingComesDown: { id: "somethingComesDown", name: "Something Comes Down", minTier: 2, weight: 1,   // SC09
      arenas: "any",
      foes: "roll", count: [1, 2],
      force: { opening: { type: "visitors" } },   // the ship arrives at round 1; the visitors are their own side and never hold the battle open
      objective: { kind: "classic" },
      text: {
        open: "The ship does not say hello. It parks.",
        mid: { when: { round: 5 }, text: "Something small and gray takes an interest in one of you." },
        result: { player: "The ship leaves with nothing, which is how you know it took something.", enemy: "The ship keeps what it came for.",
          none: "The ship hangs there until the light changes, and then it is not there." } } },

    // ── Slice 3: the objective scenarios (SCENARIOS.md section 4; modes/objectives.js, the `scenario` mode and its clock) ──
    squallLine: { id: "squallLine", name: "Squall Line", minTier: 2, weight: 1,   // SC02
      arenas: ["terraceGarden", "gardenCourt"],
      weather: "squall",
      foes: "roll", count: [1, 3],
      checkpoints: [{ id: "squallTurn", round: 4, label: "The squall turns" }, { id: "squallWrack", round: 7, label: "The wrack comes down" }],   // authored rounds 1 / 4 / 7
      force: { opening: { type: "terrain", effect: "shallow-flood" }, squallTurn: { type: "weather" }, squallWrack: { type: "terrain", effect: "fallen-cover" } },
      objective: { kind: "survive", deadline: 9, onDeadline: "win" },
      hazard: { checkpoints: [{ id: "squallDriven", round: 3, label: "Driven in by the storm" }], force: { squallDriven: { type: "monsters" } } },   // tier 3: wild things driven in
      text: {
        open: "The front arrives early. The terraces start giving the rain back downhill.",
        mid: { when: { round: 5 }, text: "Water finds the low beds first. After that it finds you." },
        result: { player: "The squall moves on without having decided anything about you.", enemy: "The front keeps what it came for.",
          none: "The sky clears on nobody in particular." } } },

    dreamRiftPicnic: { id: "dreamRiftPicnic", name: "Dream Rift Picnic", minTier: 2, weight: 1,   // SC04
      arenas: ["gardenCourt"],
      phase: "night",
      foes: "roll", count: [1, 2],
      force: { opening: { type: "dream", duration: 3, monsters: 2 } },   // a rift of three waves of two; the clock removes the case of an unreachable rift monster holding the battle open
      objective: { kind: "survive", deadline: 12, onDeadline: "win", clear: true },
      hazard: { checkpoints: [{ id: "riftTwo", round: 5, label: "A second rift" }], force: { riftTwo: { type: "dream", duration: 2, monsters: 2 } } },   // tier 3: a second wave
      text: {
        open: "Someone laid out a blanket on the one patch of lawn the night keeps opening onto something else.",
        mid: { when: { round: 5 }, text: "The sandwiches are untouched. The things coming through the seam are not interested in sandwiches." },
        result: { player: "The seam closes, and the picnic is, strictly, still on.", enemy: "The blanket is the last thing anyone sees on the lawn.",
          none: "The seam closes on an empty blanket." } } },

    untilDawn: { id: "untilDawn", name: "Until Dawn", minTier: 2, weight: 1,   // SC08
      arenas: "any",
      phase: "night",
      foes: "roll", count: [1, 2],
      objective: { kind: "survive", deadline: 10, onDeadline: "win" },   // rules.time.nightLength (a test pins it): it ends when the sky changes
      hazard: { force: { midpoint: { type: "monsters" } } },   // tier 3: the dark brings things at the midpoint
      text: {
        open: "Dawn is a long way off. Nobody on this field has agreed to wait for it.",
        mid: { when: { round: 5 }, text: "Halfway through the dark, the field gets quiet in the way that means it is listening." },
        result: { player: "The sky changes color and everyone remembers they have somewhere to be.", enemy: "You do not see the morning.",
          none: "The light comes up on a field with no one left to ask." } } },

    wolfSeason: { id: "wolfSeason", name: "Wolf Season", minTier: 2, weight: 1,   // SC06
      arenas: ["banyanGrove", "banyanEdgeGlade"],
      foes: { crews: ["wilds"], exclude: LAW, count: [1, 2] },
      wild: [{ kind: "wolf", count: 2 }],   // two feral dogs at the edge, hostile to every side, never holding the battle open
      objective: { kind: "survive", deadline: 10, onDeadline: "win" },
      hazard: { wild: [{ kind: "brushfire" }] },   // tier 3: a fire at the grove's dry edge (only where the arena has fuel)
      text: {
        open: "The wolves came down from the ridge, and they are not particular about whom they trouble.",
        mid: { when: { round: 5 }, text: "Halfway there: the light has not changed yet, and the grove is still yours to hold." },
        result: { player: "You held the grove.", enemy: "You did not hold the grove.",
          none: "The grove goes quiet, and nobody can say who it belonged to." } } },

    holdTheFord: { id: "holdTheFord", name: "Hold the Ford", minTier: 1, weight: 1,   // SC15
      arenas: ["canalGarden", "bioswaleCourt"],
      weather: "rain",
      foes: "roll", count: [2, 3],
      force: { midpoint: { type: "terrain", effect: "shallow-flood" } },   // at round 5 the water rises
      objective: { kind: "hold", deadline: 8, onDeadline: "lose" },
      hazard: { wild: [{ kind: "flashFlood" }], checkpoints: [{ id: "fordEarly", round: 3, label: "The water comes early" }], force: { fordEarly: { type: "terrain", effect: "shallow-flood" } } },   // tier 3: a flash flood front and an earlier rise
      text: {
        open: "The bridge is gone. The ford is three stones wide and everyone needs it.",
        mid: { when: { round: 5 }, text: "The water rises one hand's width, and the ford gets harder to hold." },
        result: { player: "The crossing is yours, and the water gives no opinion.", enemy: "The ford belongs to whoever crosses it last.",
          none: "The water takes the ford, and with it the argument." } } },

    threeCrews: { id: "threeCrews", name: "Three Crews, One Alley", minTier: 2, weight: 1,   // SC05
      arenas: "any",
      mode: "melee",                                                   // last crew standing (modes.js melee); the crews hit each other, so the player picks the moment
      foes: { crews: "any", groups: 2, exclude: LAW, count: [2, 2] },   // two crews of two, never a feuding pair, each on a side of its own
      objective: { kind: "classic" },                                  // no deadline yet: the spec's clock of 12 ("most crew standing", D6) waits for the objective core (loop in the NOTE)
      text: {
        open: "Two crews and you, in one alley, and nobody has agreed on whose it is.",
        mid: { when: { firstFall: true }, text: "One crew is a person short. The others take that as an invitation." },
        result: { player: "The alley is yours until somebody tells it otherwise.", enemy: "You leave through the end of the alley the others left open.",
          none: "Nobody gives way, and the round limit comes. The alley is still nobody's, and all three crews know it." } } },

    // Teaching scenario for ingredient totems (Mala's 2026-11-02 rule: every major change ships one; spec claude-ingredient-totems-spec T2).
    // A Hot Pot Berserker who has learned Kitchen Animism leads a street crew: every landed blow on him spills an ingredient beside him (Spilled
    // Pot), and he wakes what spills into a totem. A cook who sees it learns it (+1 Inspiration and Kitchen Animism, kept on the account).
    spilledPot: { id: "spilledPot", name: "Spilled Pot", minTier: 1, weight: 1,
      arenas: "any",
      foes: { lead: "hot_pot_berserker", crews: ["street"], exclude: LAW, count: [2, 2], traits: { hot_pot_berserker: ["kitchenAnimism"] } },   // the street crew has the Chef: a cook on their side can learn it from him too
      objective: { kind: "classic" },
      text: {
        open: "A man with a hot pot on his back and a street crew behind him, and everything in the pot is listening. Watch what he does with what spills; a cook who watches can learn it.",
        mid: { when: { round: 2 }, text: "Whatever spills from his pot is still listening, and he can wake it when his crew needs it." },
        result: { player: "The pot goes quiet. The bok choy lies down, and so does he.", enemy: "He ladles out what is left of the broth and walks off with his pot, and the ingredients follow him.",
          none: "The broth goes cold before anyone gives way. The ingredients wait in a ring around the pot." } } },

    longFront: { id: "longFront", name: "The Long Front", minTier: 3, weight: 0.5,   // SC10, selection only: the Warfare encounter, offered from the random chooser
      encounter: "warfare", mode: "warfare",
      arenas: "any",                                                   // the Warfare field (apply lays it); no map draw
      foes: "roll", count: [2, 2],                                     // the encounter's own two enemies, with its scaled events and wild animals
      objective: { kind: "classic" },
      text: {
        open: "Three sides are already on this field. They will keep going until only one side remains. None of them will stop to name the field.",   // the Warfare encounter's own opener (narrator.js BEATS.warfare), reused as SCENARIOS.md SC10 asks
        mid: { when: { round: 6 }, text: "Six rounds in. Nobody on the line is fresh any more." },
        result: { player: "Your side is the last one standing on the long front.", enemy: "The front closes over you, and the line moves on.",
          none: "The front goes quiet. Nothing has been settled and everyone knows it." } } },

    heldCounter: { id: "heldCounter", name: "The Held Counter", minTier: 1, weight: 1,   // SC22, teaching Mystery S1: a fixed student holds its post six tiles out behind a pillar (in its trigger outlook, no shot), so the opening sets a counter and the player springs it
      arenas: ["punchbowlRim"],
      foes: { fixed: ["student"], at: [[5, 2]], holdTurns: 2 },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "A student holds the crater, and students set counters. Watch for the face-down card — walk in and spring it, or study them from afar.",
        mid: { when: { foeHolds: "on-attacked" }, text: "There — a counter face-down. Attack them and spring it, or take a hard look: the plan stays down, but what can fire, fires." },
        result: { player: "You sprung the counter and stood through it. The crater keeps no secrets now.", enemy: "The counter did its work. Next time, study first.",
          none: "Nobody springs anything, and the round limit comes. The face-down card goes back to the dark with its holder." } } },

    buriedBar: { id: "buriedBar", name: "The Buried Bar", minTier: 1, weight: 1,   // SC23, teaching Mystery S2: a fixed arantxa holds its post six tiles out behind a pillar; a full bar goes face-down at turn start and fires on schedule, or waits when the radius is empty
      arenas: ["punchbowlRim"],
      foes: { fixed: ["arantxa"], at: [[5, 4]], holdTurns: 2 },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "Arantxa fights for the bar — once it is full it goes face-down. Keep your distance and it waits; step close and it fires when their turn starts.",
        mid: { when: { foeHolds: "on-turn-start" }, text: "The bar just went face-down. It fires when their turn starts with you close — or waits if there is nothing to hit." },
        result: { player: "The buried bar never found you. The court is yours.", enemy: "The bar fired on schedule, and you stood too close.",
          none: "The bar stays buried, the rounds run out, and nothing is decided." } } },
  };

  return { SCENARIOS, LAW };
});
