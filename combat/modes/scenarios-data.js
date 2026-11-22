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
//   foes.traits: { classId: [traitId...] }              traits granted to that class when it is drawn as a foe (Spilled Pot: Kitchen Animism); a granted trait carries its passives at spawn (R-20261115-38)
//   foes.look: { classId: { name?, sprite? } }         the drawn foe's name and sprite folder for this scenario (The Vocation: the maid's Vocational form, R-20261115-63)
//   houses: "always"                                    rules.houses.chance becomes { default: 1 } for this battle
//   foes: { fixed: [], unbound: summonId, at: [[x, y]] }           a tandem's Trial (Tandem T2c): the only foe is that tandem, unbound; without `at` it arrives where a called summon would, within 2 tiles of the player; never rolled (chainOnly), begun from the Tandem wing
//   chainOnly: true                                    never drawn by the Random Encounter roll (scenarios.js candidates)
//   objective.exact: true                              the deadline is not moved by the tier; objective.hero: true (survive) loses the moment the hero is down
//   lendTenant: exileId                                 the exile lodges with the player at Guest for this battle only, borrowed: it settles nothing (Exile T0a: Aziza)
//   lend: [summonId...]                                 summons lent to the player for this battle only (Tandem T2b: the Mosaic); never an unlock
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
    smallPrint:{id:"smallPrint",name:"The Small Print",minTier:1,weight:1,arenas:"any",quiet:true,
      foes:{fixed:["auditor_goblin"],at:[[6,3]],holdTurns:0},objective:{kind:"classic"},
      text:{open:"A small goblin straightens his bow tie and opens a much larger ledger. ‘Nothing personal. Just the particulars.’ Observe him, read his posted Statute, and vary your techniques: repeated witnessed attacks give him precedent.",
        mid:{when:{round:3},text:"His Objection adds a tax and refuses push, pull, stun and seed riders. It never cancels the damage. Leave the posted delivery behind, or show him something new."},
        result:{player:"He checks the final entry, nods, and closes the satchel. ‘Quite in order. Well played.’",enemy:"The little auditor finds one last discrepancy. ‘A rematch, once the paperwork is sorted?’",none:"The watch ticks. The ledger stays open, with room for another day."}}},
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
      ford: {
        canalGarden: { crossing: [[6, 2], [7, 2], [8, 2]], spill: [[6, 1], [7, 1], [8, 1]], bypassRow: 8 },
        bioswaleCourt: { crossing: [[4, 3], [5, 3], [6, 3]], spill: [[4, 2], [5, 2], [6, 2]] },
      },
      foes: "roll", count: [2, 3],
      checkpoints: [{ id: "fordRise", round: 4, label: "Ford surge warning" }],
      force: { fordRise: { type: "terrain", effect: "water-surge" } },
      objective: { kind: "hold", deadline: 8, onDeadline: "lose" },
      hazard: { wild: [{ kind: "flashFlood" }], checkpoints: [{ id: "fordRise", round: 2, label: "Early ford surge warning" }] },   // tier 3: a flash flood front and an earlier rise
      text: {
        open: "Hold the three ford stones. Crossing shallow water costs movement. Watch the marked current and the surge warnings.",
        mid: { when: { round: 5 }, text: "Check the marked tiles before ending your turn. A current can sweep you off the ford." },
        result: { player: "The crossing is yours, and the water gives no opinion.", enemy: "The ford belongs to whoever crosses it last.",
          none: "The water takes the ford, and with it the argument." } } },

    // Slice 5 (SCENARIOS.md §9 row 5): ward kind + afterCreate civilians / Tourist. SC11 is classic with customers on the field;
    // SC12–SC14 run the ward clock. Clean-hands Seeds (SC11) and the Sasquatch photo bonus are paid by the scenario mint (scenarios.js, bonus check).
    marketDay: { id: "marketDay", name: "Market Day", minTier: 1, weight: 1,   // SC11
      arenas: ["terraceGarden", "loiTerraces", "canalGarden"],
      foes: { crews: ["street"], exclude: LAW, count: [2, 2] },
      civilians: [{ id: "customer-1", name: "Customer" }, { id: "customer-2", name: "Customer" }],
      objective: { kind: "classic" },
      bonus: { seeds: 8, cleanHands: true },   // paid by the scenario mint (scenarios.js); cleanHands: no "civilians are now hostile" faction log
      text: {
        open: "It is market day. The people here came for tomatoes and are not impressed by you.",
        mid: { when: { round: 4 }, text: "A customer steps behind a stall and does not step out." },
        result: { player: "The market closes around you like water.", enemy: "The stalls fold up. Somebody sweeps.",
          none: "The market packs up with nobody settled, and the tomatoes go home." } } },

    hostageHall: { id: "hostageHall", name: "Hostage Hall", minTier: 2, weight: 1,   // SC12
      arenas: ["gardenCourt", "oculusCourt"],
      foes: { crews: ["street", "masks"], exclude: LAW, count: [2, 3], aggressive: true },
      civilians: [{ id: "customer-1", name: "Customer", middle: true }, { id: "customer-2", name: "Customer", middle: true }],
      objective: { kind: "ward", deadline: 12, onDeadline: "win", civilians: ["customer-1", "customer-2"] },
      bonus: { seeds: 10 },
      text: {
        open: "Two people are standing in the middle of the hall who did not come to fight. The people who did have noticed.",
        mid: { when: { round: 6 }, text: "Someone says the quiet part loudly: nobody gets hurt if you do not move." },
        result: { player: "The hall empties out slowly, and everyone is counted twice.", enemy: "A name goes on the report, and it is a bystander's.",
          none: "The hall empties on the clock with nobody claiming it." } } },

    photoSafari: { id: "photoSafari", name: "Photo Safari", minTier: 1, weight: 1,   // SC13
      arenas: ["banyanGrove", "punchbowlRim", "canalGarden"],
      foes: "roll", count: [1, 1],
      tourist: true,
      wildPick: [[{ kind: "wolf", count: 2 }], [{ kind: "feralPig" }, { kind: "nettleCaterpillar" }]],
      objective: { kind: "ward", deadline: 10, onDeadline: "win", wardId: "tourist" },
      bonus: { seeds: 6 },
      text: {
        open: "A man with a camera has wandered into the bad part of the park. He thinks the wolves are a good composition.",
        mid: { when: { round: 5 }, text: "He photographs the wolf. The wolf is polite about it, for exactly one round." },
        result: { player: "He gets his picture, and you get his thanks.", enemy: "The camera is found later, and not the man.",
          none: "The park keeps its picture, and so does he, somewhere." } } },

    sasquatchSighting: { id: "sasquatchSighting", name: "Sasquatch Sighting", minTier: 3, weight: 1,   // SC14
      arenas: ["banyanGrove"],
      foes: "roll", count: [1, 1],
      tourist: true,
      wild: [{ kind: "sasquatch", far: true }],
      objective: { kind: "ward", deadline: 12, onDeadline: "win", wardId: "tourist" },
      bonus: { seeds: 10, sasquatchPhoto: true },   // mint (S7) pays when tourist.photos names a sasquatch
      text: {
        open: "He has waited his whole life to be here. The thing in the trees has waited longer.",
        mid: { when: { round: 6 }, text: "He stops walking. So does the forest." },
        result: { player: "The shot is taken. Nobody tells him what it cost.", enemy: "The forest keeps the picture, and so does he, somewhere.",
          none: "The forest keeps its quiet, and the clock runs out." } } },

    linerOnTheShoal: { id: "linerOnTheShoal", name: "The Liner on the Shoal", minTier: 1, weight: 1,
      arenas: ["canalGarden"], wreckLesson: true, quiet: true,
      foes: { fixed: ["student"], holdTurns: 2 },
      objective: { kind: "classic" },
      text: {
        open: "The Cruise Ship Wreck still has a soul. Study it from Observe, then stand beside any tile and Wake it from Rituals. The Archivist is with you.",
        mid: { when: { round: 3 }, text: "An awakened wreck walks on three tiles. Leave room for the whole hull." },
        result: { player: "The canal quiets around the old liner.", enemy: "The canal closes over the lesson.", none: "The liner outlasts the fight." },
      },
    },

    // ── Slice 4: break and salvage (SCENARIOS.md section 9 row 4; modes/objectives.js) ──
    breakTheSluice: { id: "breakTheSluice", name: "Break the Sluice", minTier: 2, weight: 1,   // SC16
      arenas: ["canalGarden"],
      foes: "roll", count: [2, 3],
      object: { id: "scenario-sluice", type: "hatch", name: "Sluice gate", hp: 60, maxHp: 60, blocksMove: true, cover: 0.5, material: "stone", kind: "object", role: "scenario-objective" },   // drawn as hatch (verdict.js precedent); ground-targeting hits it (structures.js)
      checkpoints: [{ id: "sluice3", round: 3, label: "The water presses" }, { id: "sluice6", round: 6, label: "The banks take water" }, { id: "sluice9", round: 9, label: "The camp is wet" }],
      force: { sluice3: { type: "terrain", effect: "shallow-flood" }, sluice6: { type: "terrain", effect: "shallow-flood" }, sluice9: { type: "terrain", effect: "shallow-flood" } },
      objective: { kind: "break", deadline: 10, onDeadline: "lose", objectId: "scenario-sluice" },
      bonus: { seeds: 10 },
      text: {
        open: "Someone upstream closed the gate to starve the field of water. The field has other ideas.",
        mid: { when: { round: 5 }, text: "The gate groans. The people guarding it look up at it, and then at you." },
        result: { player: "The gate gives, and the field remembers what a river is.", enemy: "The water arrives on a schedule that is not yours.",
          none: "The gate holds, the water waits, and nobody gets what they came for." } } },

    salvageRun: { id: "salvageRun", name: "Salvage Run", minTier: 1, weight: 1,   // SC17
      arenas: ["quarryLedge", "terraceGarden"],
      foes: "roll", count: [1, 2],
      salvage: { minPickups: 5 },   // guarantee at least n+2 contested items (n ≤ 3); placePickups in E.create still appends
      objective: { kind: "salvage", deadline: 10, onDeadline: "lose" },
      bonus: { seeds: 6 },
      text: {
        open: "A truck went over the ledge last week. Everyone is there for what fell out of it.",
        mid: { when: { round: 5 }, text: "Someone else is also counting crates." },
        result: { player: "You walk out heavy, and nobody asks what is in the bag.", enemy: "The scrap is gone before you got to it.",
          none: "The scrap is still there when the round limit comes, and nobody claims it." } } },

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

    // ── Slice 7: Chain-only notice-board scenarios (SCENARIOS.md section 4) ──
    bountyHunt: { id: "bountyHunt", name: "Bounty Hunt", minTier: 1, weight: 1,   // SC18
      arenas: "any",
      chainOnly: true,
      foes: "roll", count: [2, 3],
      objective: { kind: "bounty", deadline: 12, onDeadline: "lose" },
      text: {
        open: "Your name is not on this warrant. Somebody else's is, and they are in this room.",
        mid: { when: { round: 3 }, text: "The mark knows now that the warrant has their name on it." },
        result: { player: "The mark is down, and the posting takes it from there.", enemy: "The mark is gone, and so is the posting's patience.",
          none: "The warrant expires with the mark still on their feet." } } },

    backDoor: { id: "backDoor", name: "Back Door", minTier: 1, weight: 1,   // SC19
      arenas: "any",
      chainOnly: true,
      foes: "roll", count: [2, 3],
      objective: { kind: "exit", deadline: 12, onDeadline: "lose" },
      text: {
        open: "The front door is watched. The back door is also watched, but it is farther from the people who watch it.",
        mid: { when: { round: 3 }, text: "Someone has noticed which door you are walking toward." },
        result: { player: "You are through, and the door closes behind you on a battle that is no longer yours.", enemy: "The door was never going to open for you.",
          none: "The back door is shut tight before you reach it." } } },

    // ── Slice 8: Polish and Hired Hands (SCENARIOS.md section 4 SC20) ──
    hiredHands: { id: "hiredHands", name: "Hired Hands", minTier: 2, weight: 1,   // SC20
      arenas: "any",
      foes: { crews: ["court", "street"], exclude: LAW, count: [3, 3] },
      gift: ["safeConduct"],
      objective: { kind: "classic" },
      text: {
        open: "You came with a letter. The people across from you have not decided whether to read it.",
        mid: { when: { round: 3 }, text: "One of them lowers a weapon, and the others look at him." },
        result: { player: "Nobody has to be carried off.", enemy: "Nobody read the letter.",
          none: "Nobody gives way, and the letter is forgotten." } } },

    // Teaching scenario for ingredient totems (Mala's 2026-11-02 rule: every major change ships one; spec claude-ingredient-totems-spec T2).
    // A Hot Pot Berserker who has learned Kitchen Animism leads a street crew: every landed blow on him spills an ingredient beside him (Spilled
    // Pot), and he wakes what spills into a totem. A cook who sees it learns it (+1 Inspiration and Kitchen Animism, kept on the account).
    // Pond Patrol (Wild Food Web W1, claude-wild-food-web-spec section 8; teaching scenario): the food web in one garden. A nettle
    // caterpillar on its host plant, a feral flock on the water beside it: the ducks go for the caterpillar before anyone else.
    pondPatrol: { id: "pondPatrol", name: "Pond Patrol", minTier: 1, weight: 1,
      arenas: ["canalGarden"],   // Canal Garden only: on Rill Garden the shore nearest a host plant can be 6 tiles off, past the ducks' reach of 4
      foes: "roll", count: [1, 2],
      wild: [{ kind: "nettleCaterpillar", near: "host", reason: "it was on the garden's leaves all along" }, { kind: "ducks", near: "water", closeTo: "nettleCaterpillar", reason: "a feral flock comes up from the water" }],
      objective: { kind: "classic" },
      text: {
        open: "A nettle caterpillar on the garden's leaves, a feral flock on the water beside it. Leave the caterpillar alone and watch what the ducks do with it.",
        mid: { when: { round: 3 }, text: "The wild has its own appetites: whatever eats is busy with its meal, and whatever is eaten runs." },
        result: { player: "The garden is yours, and so is the pond.", enemy: "You give up the garden. The ducks stay.",
          none: "Nobody gives way. The flock settles back on the water." } } },

    // Tall Grass (Wild Food Web W3, claude-wild-food-web-spec section 8; teaching scenario; tier 2, R-20261111-06): a tiger lies in the
    // grass three tiles from a feral pig. The telegraph names only "something" in the grass; the tiger springs on the pig, ×1.5 from cover.
    tallGrass: { id: "tallGrass", name: "Tall Grass", minTier: 2, weight: 1,
      arenas: ["banyanGrove", "banyanEdgeGlade"],
      foes: "roll", count: [1, 2],
      wild: [{ kind: "tiger", near: "cover", reason: "it was lying in the grass all along" }, { kind: "feralPig", near: "cover", closeTo: "tiger", gap: 3, reason: "wanders in from the brush" }],
      objective: { kind: "classic" },
      text: {
        open: "Something moves in the grass, and a feral pig roots nearby. Watch the grass before you walk into it.",
        mid: { when: { round: 3 }, text: "An ambusher is strongest from cover: its first leap out of the grass hits half again as hard. In the open you can see it coming." },
        result: { player: "The field is yours. The grass goes still.", enemy: "You give up the field to whatever was waiting in it.",
          none: "Nobody gives way. Something in the grass keeps watching." } } },
    // Read the Room (AI Sight I2, claude-ai-sight-spec section 4 "I2"; teaching scenario, Mala's 2026-11-02 rule): three foes who
    // fight as one on the Canal Garden. Once you have studied them, an act their Focus decided says so in the log (one study),
    // and an act their cover decided says so too (two studies). You, and the ally the random battle rolls when it rolls one, against the three (R-20261116-07:
    // not a true three-on-three, no new allies field; event arrivals still come, as in any random battle). Tier 2, as Tall Grass: the lesson reads Observe, which a first battle teaches.
    readTheRoom: { id: "readTheRoom", name: "Read the Room", minTier: 2, weight: 1,
      arenas: ["canalGarden"],
      foes: { fixed: ["soldier", "mason", "knight"] },
      objective: { kind: "classic" },
      text: {
        open: "Three of them, and they move as one. Observe them: once you have read their side, the log tells you when their shared target is what moved one of them.",
        mid: { when: { round: 3 }, text: "While two or more of them stand, they pick a target together and cover one of their own. Study them a second time and the log also says when that cover moved one of them." },
        result: { player: "The garden is yours.", enemy: "You give up the garden.",
          none: "Nobody gives way. The garden stays contested." } } },

    meetMeThere: { id: "meetMeThere", name: "Meet Me There", minTier: 1, weight: 1,   // teaching scenario for Cooperative Principle P1: three allies, one marked tile, a short clock
      arenas: "any",
      foes: "roll", count: [1, 1],
      objective: { kind: "hold", deadline: 6, onDeadline: "lose" },
      text: {
        open: "The ground between you is three tiles wide. Hold it. The cheaper first step toward a named destination is the lesson.",
        mid: { when: { round: 3 }, text: "The ones still walking toward the ground are the ones who heard you." },
        result: { player: "The ground is yours.", enemy: "You were pushed off the ground.",
          none: "Nobody holds the ground when the clock stops." } } },

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
        result: { player: "You stood through whatever they set. The crater keeps no secrets now.", enemy: "They held the crater. Next time, study them first.",
          none: "Nobody springs anything, and the round limit comes. The face-down card goes back to the dark with its holder." } } },

    theOpenDoor: { id: "theOpenDoor", name: "The Open Door", minTier: 1, weight: 1,   // SH4 teaching: her table is already full; striking guests loses the race
      arenas: ["punchbowlRim"],
      foes: { fixed: ["shaman"], at: [[5, 2]] },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "Her table is already full. Striking the guests loses the race. Reach her and the door closes.",
        mid: { when: { round: 4 }, text: "The guests are still between you. She is the one holding the door." },
        result: { player: "You reached her. The guests leave with the host.", enemy: "The table held, and you never reached the door.",
          none: "The round limit comes with the door still open." } } },

    buriedBar: { id: "buriedBar", name: "The Buried Bar", minTier: 1, weight: 1,   // SC23, teaching Mystery S2: a fixed arantxa holds its post six tiles out behind a pillar; a full bar goes face-down at turn start and fires on schedule, or waits when the radius is empty
      arenas: ["punchbowlRim"],
      foes: { fixed: ["arantxa"], at: [[5, 4]], holdTurns: 2 },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "Arantxa fights for the bar — once it is full it goes face-down. Keep your distance and it waits; step close and it fires when their turn starts.",
        mid: { when: { foeHolds: "on-turn-start" }, text: "The bar just went face-down. It fires when their turn starts with you close — or waits if there is nothing to hit." },
        result: { player: "Arantxa is down, and the crater is yours.", enemy: "Arantxa held the crater. Next time, watch the bar before you close in.",
          none: "The bar stays buried, the rounds run out, and nothing is decided." } } },

    setTable: { id: "setTable", name: "The Set Table", minTier: 2, weight: 1,   // teaching scenario for Investigate I4b (face-down reads); uncatalogued: no SC number (R-20261109-11 (4)); pooled from tier 2 like SC22/SC23
      arenas: "any",
      foes: "roll", count: [1, 2],
      objective: { kind: "classic" },
      text: {
        open: "This table loves a face-down game. What anyone sets here stays hidden until it fires, unless someone reads it first. Observe rips a set card into the open and sets it off; Investigate reads it quietly.",
        mid: { when: { round: 5 }, text: "Set your own, too: pay now, pick when it fires, and let the table wonder." },
        result: { player: "You leave the table standing, and its secrets with it.", enemy: "The table keeps its secrets, and you leave with none of them.",
          none: "Nobody reads anything. The face-down plans fade with the light, unspent and unknown." } } },
    standIn: { id: "standIn", name: "Stand-In", minTier: 2, weight: 1,   // teaching Substitution (five concepts S1); tier 2 so the pinned tier-1 lists stay as they are
      arenas: ["punchbowlRim"],
      foes: { fixed: ["ranger"], at: [[5, 2]], holdTurns: 1 },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "An archer holds the rim. Link to a sturdy ally with Stand In before the volley, or take the hit yourself. Name the Peril if you already know the channel.",
        mid: { when: { round: 3 }, text: "The link is public. A Feint trips it; an area shot walks past it." },
        result: { player: "The surrogate took what was meant for you. The rim is quiet.", enemy: "The volley found you before anyone stood in.",
          none: "Nobody linked, and the rounds ran out." } } },

    roomToRise: { id: "roomToRise", name: "Room to Rise", minTier: 2, weight: 1,   // SC24 (tier 2: MAX needs a revealed summon and a full bar, a few wins in; the tier-1 pool stays as it is), teaching MAX (MX1 Max Mitsuko + MX2 Max Genghis Khan, loop 1a1c6359d54): an open field, one foe apart from a pair, so a revealed summon has the room and a reason to rise
      arenas: ["warfareField"],
      foes: { fixed: ["student", "student", "arantxa"], at: [[11, 1], [12, 2], [12, 7]], holdTurns: 2 },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "Open ground, and one of them stands apart. Call a summon from your palace and open your Dream Space to show what it really is. With a full ultimate bar, Channel MAX: the dream pours into it for good.",
        mid: { when: { round: 3 }, text: "A revealed summon can rise further. Mitsuko wards whoever is weakest. The Khan's winged rhino needs a clear tile beside him, then rides down whoever stands alone." },
        result: { player: "The field is yours, and the dream went into something that stayed.", enemy: "The dream closed before anything rose from it. Reveal first, then pour.",
          none: "The rounds run out on open ground. Nothing rose, and nothing was decided." } } },
    quietField: { id: "quietField", name: "The Quiet Field", minTier: 2, weight: 1,   // teaching Ma (claude-five-concepts-spec M1, its "Quiet Room": no hall arena exists, so the long Warfare Field); uncatalogued, no SC number; tier 2 like SC24, so the pinned tier-1 lists stay as they are. Two kickboxers hold the far end for two turns: time to bank, then one heavy Strike
      arenas: ["warfareField"],
      foes: { fixed: ["kickboxer", "kickboxer"], at: [[13, 3], [13, 5]], holdTurns: 2 },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "A long, quiet field, and two kickboxers holding the far end. If you carry Ma, rest on purpose: Leave Space banks Stillness, and for two turns Held Breath banks each turn you end without moving.",
        mid: { when: { round: 3 }, text: "They are coming. Your next Strike spends every point of Stillness you banked, +1 a point. A shove or a spread breaks the stance." },
        result: { player: "The quiet paid. Two fighters down, and the field is still again.", enemy: "They closed before the stillness was worth anything. Bank earlier, strike once.",
          none: "The rounds run out, and the quiet holds. Nobody struck hard enough to end it." } } },
    runningTab: { id: "runningTab", name: "Running a Tab", minTier: 2, weight: 1,   // teaching Credit (claude-five-concepts-spec K1; R-20261112-13 c: the player fronts themselves; the ally version waits for the Headwaiter); uncatalogued, no SC number; tier 2 like SC24, so the pinned tier-1 lists stay as they are
      arenas: ["punchbowlRim"],
      foes: { fixed: ["soldier"], at: [[5, 3]], holdTurns: 1 },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "One soldier on the rim, and a long fight ahead of you. If you carry Credit, Fronted Tempo lends you time now, and a bigger bill comes due at your turn start after next. Spend it to win before the bill lands.",
        mid: { when: { round: 3 }, text: "The tab is open. Settle it from the menu, or finish this before the bill comes in." },
        result: { player: "You won on borrowed time.", enemy: "The bill came due before the win did.",
          none: "The rounds run out with the tab still open." } } },
    theVocation: { id: "theVocation", name: "The Vocation", minTier: 3, weight: 1,   // the maid's Vocational form, a foe-only boss (R-20261115-61, R-20261115-63); uncatalogued, no SC number; tier 3: a boss
      arenas: ["gardenCourt"],
      foes: { fixed: ["maid"], traits: { maid: ["vocational"] }, look: { maid: { name: "The Maid, Vocational Form" } } },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "The maid has found her vocation, and her foes are the waste. Her cleaning tools now strike, and every number is past what a person should carry: she takes far more to fall, every blow lands half again as hard, her techniques fill her ultimate faster and her focus runs deeper.",
        mid: { when: { round: 3 }, text: "To her you are the mess. Her sorting, clearing, removing and sweeping all land on you now. Spread out: her sweep hits every foe within 2 of one spot." },
        result: { player: "The Vocational maid is down.", enemy: "The Vocational maid wins. You were swept up with the rest of the mess.",
          none: "The rounds run out with the Vocational maid still standing." } } },
    theBlur: { id: "theBlur", name: "The Blur", minTier: 2, weight: 1,   // teaching True Super Speed (claude-true-super-speed-spec SS1); uncatalogued, no SC number; tier 2 like the other concept lessons
      arenas: ["canalGarden"],
      foes: { fixed: ["super_villain"], traits: { super_villain: ["superSpeed"] } },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "A canal runs between you and one Super Villain with Super Speed. Its steps cost half and water does not slow it, so the canal that slows anyone else does not slow it. Do not count on the water.",
        mid: { when: { round: 3 }, text: "Friction takes the speed away. Slow it, stagger it, tangle it, hurt a leg or grab it, and the blur is gone until that ends." },
        result: { player: "The Super Villain is down, speed and all.", enemy: "The Super Villain wins. Next time take the legs first: Friction is the counter.",
          none: "The rounds run out, and nobody finished it." } } },
    madeOfWhatItStrikes: { id: "madeOfWhatItStrikes", name: "Made of What It Strikes", minTier: 2, weight: 1,   // teaching the first tandem (Tandem T2b, muse-tandem-spirit-spec; R-20261115-03, R-20261115-15): the Mosaic is lent for this one battle (lend; summons.js familiarSet), never unlocked by it. Three different foes, so its tiles can fill; uncatalogued, no SC number; tier 2 like SC24, so the pinned tier-1 lists stay as they are; last in the list, so the termination files' index-mod-3 split moves no other scenario
      arenas: ["punchbowlRim"],
      foes: { fixed: ["soldier", "kickboxer", "student"], at: [[6, 2], [6, 4], [7, 3]] },
      lend: ["mosaic"],
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "The Tandem wing lends you the Mosaic for this battle: call it from your summons. It stays within 2 tiles of you, and part of every blow that hurts it echoes back to you. Each different foe it wounds lends it a tile and a harder hit. Observe it to learn the rest.",
        mid: { when: { round: 3 }, text: "Spread its blows: a foe it has already wounded lends nothing new. Keep it close; pulled past its leash, it strains and every tile falls away." },
        result: { player: "Three foes down. The pattern held, and the lend ends with the battle.", enemy: "The pieces scattered before the pattern was whole. Keep it close and spread its blows.",
          none: "The rounds run out with the pattern unfinished." } } },
    foolsGold: { id: "foolsGold", name: "Fool's Gold", minTier: 2, weight: 1,   // teaching the Treasure Hunter (TH1c, cursor-treasure-hunter-spec "Teaching scenario"; R-20261115-26): he is the one foe on an open map with at least 4 pickups (the terrace's own). Gold: engine/states.js relicClaim (x0.25 taken until a blow lands, states.relicGold), dropTreasure (the cracking blow drops it beside him); Finder's Keepers: engine/factions.js, his first Inspiration from a foe taking his drop. Uncatalogued, no SC number; tier 2 like the other concept lessons
      arenas: ["terraceGarden"],
      foes: { fixed: ["treasure_hunter"] },
      quiet: true,
      // No `salvage` guarantee: E.create's own placePickups runs its item, food and jar passes on a terrace (pickups.js rules; the test pins >= 4), and stacking
      // the SC17 guarantee on top duplicates ids and tiles (placePickups restarts both; loop filed by Thwartship BD, 2026-11-15).
      objective: { kind: "classic" },
      text: {
        open: "One Treasure Hunter, and treasure all over the terraces. When he steps onto an item he seizes it and turns gold: he takes a quarter of the damage until a blow hurts him, and that blow cracks the gold.",
        mid: { when: { round: 3 }, text: "Crack the gold first: any blow that hurts him, even a little, breaks it. Then hit him for real. The treasure he drops is anyone's, but the first time one of you takes it, he gains an Inspiration." },
        result: { player: "The Treasure Hunter is down, gold and all.", enemy: "The Treasure Hunter wins the terraces. Next time crack the gold first: any blow that hurts him breaks it.",
          none: "The rounds run out with the treasure still in play." } } },
    theMosaicsOrdeal: { id: "theMosaicsOrdeal", name: "The Mosaic's Ordeal", minTier: 1, weight: 1, chainOnly: true,   // the Mosaic's Trial (Tandem T2c, muse-tandem-spirit-spec section 3; R-20261115-03, R-20261115-42): never rolled, begun from the Tandem wing (summons/tandem-wing.js); the numbers are the row's (summons-data.js mosaic.tandem.trial; a test pins that they agree)
      arenas: ["punchbowlRim"],
      foes: { fixed: [], unbound: "mosaic" },   // fixed: [] = no rolled or drawn foe; the tandem is the only one
      quiet: true,
      objective: { kind: "survive", deadline: 5, onDeadline: "win", exact: true, hero: true },
      text: {
        open: "The Mosaic stands unbound within 2 tiles of you: no user, no leash, no strain, and no blow can finish it. Stay on your feet for 5 rounds and it takes a room in your palace, with its first call free. Fall first and the Trial takes 10 of your life at the start of your next battle, though never your last point.",
        mid: { when: { round: 3 }, text: "Round three. You cannot bring it down, only outlast it: guard, give ground, and count." },
        result: { player: "Five rounds, and you are still standing. The Mosaic takes its room in your palace, and its first call is free.", enemy: "You fell before the count ran out. The Trial takes 10 of your life at the start of your next battle, though never your last point, and opens again after that battle.",
          none: "The count ends with nothing settled." } } },
    waysBetweenLesson: { id: "waysBetweenLesson", name: "The Road Only She Remembers", minTier: 2, weight: 1,   // teaching the first tenant (Exile T0a, claude-anime-exile-spec): the One Who Knows the Ways lodges with the player at Guest for this one battle (lendTenant), never housed by it
      arenas: ["punchbowlRim"],
      foes: { fixed: ["soldier", "kickboxer"], at: [[6, 3], [7, 3]] },
      lendTenant: "aziza",
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "The One Who Knows the Ways lodges with you for this battle, at Guest, and lends you her road: step up to 4 tiles to any open tile, whatever the ground costs, twice. It provokes nothing. Her keep is your first Guard of the battle: it is paid, and no guard forms.",
        mid: { when: { round: 3 }, text: "A step past a blade's reach is a step nobody swings at; walking the same way would have been. A taken or walled tile stays closed." },
        result: { player: "Both foes down. She was lent for this battle only: nothing here changes her Coherence.", enemy: "The road did not save you. Step out of reach, not just across the map: she lends it only twice a battle.",
          none: "The rounds run out, and nobody finished it." } } },
    thinIce: { id: "thinIce", name: "Thin Ice", minTier: 2, weight: 1,   // teaching breakable floors (DT2, cursor-destructive-map-tiles-spec "Teaching scenario"): one soldier on Ice Court ice; a placed or area blow cracks then drops that tile to rubble (structures.js hitBreakableFloor, terrain-data.js i). Uncatalogued, no SC number; last in the list so the termination files' index-mod-3 split moves no other scenario; tier 2 so the pinned tier-1 lists stay as they are
      arenas: ["iceCourt"],
      foes: { fixed: ["soldier"], at: [[7, 3]], holdTurns: 2 },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "One soldier stands on a sheet of ice. Hit that ice with a placed or area attack. A light blow only cracks it; a harder one drops the floor, and they fall with it. Untagged paving and turf will not break.",
        mid: { when: { round: 3 }, text: "Hit the ice they stand on. A light blow only cracks it; a harder one drops the floor. The paving under your feet stays whole." },
        result: { player: "The soldier is down.", enemy: "The soldier held the court. Next time hit the ice they stand on.",
          none: "The rounds run out." } } },
    theExchange: { id: "theExchange", name: "The Exchange", minTier: 2, weight: 1,   // SC25 (R-20261110-52): teaching Mystery S3 held card + RIK R1 exchange together; tier 2 so the pinned tier-1 lists stay as they are; loop 1a1c7e9e5e6
      arenas: ["punchbowlRim"],
      foes: { fixed: ["student"], at: [[5, 4]], holdTurns: 2 },
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "A student holds the crater, and they set face-down cards. A card that only wounds you can still be the first half of a kill: they reveal it, then finish with a cheap blow, and the bar stays unspent.",
        mid: { when: { foeHolds: "manual" }, text: "A face-down card is waiting. If it only wounds you, the rest of the kill is a cheap blow, not the bar." },
        result: { player: "The setter is down.", enemy: "They held the crater.",
          none: "The rounds run out." } } },
    declaredOrders: { id: "declaredOrders", name: "Declared Orders", minTier: 2, weight: 1,   // teaching the first far tandem (Tandem T3 rev 1, muse-tandem-spirit-spec section 4; R-20261119-01): the Homunculus is lent for this one battle (lend; never an unlock), as T2b lends the Mosaic. Appended last so the termination sixths keep their members (C11).
      arenas: ["punchbowlRim"],
      foes: { fixed: ["soldier", "student", "wizard"], at: [[6, 2], [6, 4], [7, 3]] },
      lend: ["homunculus"],
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "The Tandem wing lends you the Homunculus for this battle: call it from your summons. It ranges up to 8 tiles from you, and no blow that hurts it echoes back to you. It runs one declared program, written on its card for everyone to read, and it arrives running Harry the Weakest.",
        mid: { when: { round: 3 }, text: "Its program is public: the foe it hunts can see it coming. At the start of your turn, before you move or act, you can rewrite it once, from Rituals, to another of its three programs." },
        result: { player: "The three are down. The orders held, and the lend ends with the battle.", enemy: "Your foes read the orders and answered them. Next time rewrite the program at the start of your turn, before you move.",
          none: "The rounds run out." } } },
    successiveSkins: { id: "successiveSkins", name: "Successive Skins", minTier: 2, weight: 1,   // teaching the first molting tandem (Tandem T4 rework, muse-tandem-spirit-spec section 5A; R-20261121-27): the Instar is lent for this one battle (lend; never an unlock, so no form is kept). Appended last so the termination sixths keep their members (C11).
      arenas: ["punchbowlRim"],
      foes: { fixed: ["soldier", "student", "wizard"], at: [[6, 2], [6, 4], [7, 3]] },
      lend: ["instar"],
      quiet: true,
      objective: { kind: "classic" },
      text: {
        open: "The Tandem wing lends you the Instar for this battle: call it from your summons. It arrives as a Larva and keeps within 3 tiles of you. It grows by need, not by a meter: if one of your allies falls while it is out, it molts into its Pupa.",
        mid: { when: { round: 3 }, text: "As a Pupa its carapace takes 4 off every hit, and half of what it loses, at most 3 a hit, echoes to you. Fall below a quarter of your health and it molts into its Imago, which flies. A molt never goes back." },
        result: { player: "The three are down. The lend ends with the battle, and the Instar keeps no form it reached.", enemy: "Your foes broke you before it could grow. Next time call another ally beside it: an ally falling while it is out is what makes it molt.",
          none: "The rounds run out." } } },
  };

  return { SCENARIOS, LAW };
});
