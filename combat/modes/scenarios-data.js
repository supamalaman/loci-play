"use strict";
// Random-battle scenarios, the data (spec ~/loci-orbit/ready-to-review/claude-random-scenarios-spec/specs/SCENARIOS.md, 3.1 and 4).
// A scenario is a premise plus an objective, laid over the options `E.randomEncounterOptions` returns (modes/scenarios.js).
// Slice 1 holds the two premise-only classic scenarios: SC03 The Open House and SC01 Night Shift at the Quarry; slice 2 adds the two authored-event ones, SC07 Brushfire Season and SC09 Something Comes Down. Both end
// the way every classic battle ends (the default branch of checkOutcome, rules.standoff, rules.maxRounds); neither adds a
// clock, because neither adds an objective. The clocked kinds (survive, hold, break, salvage, ward, bounty, exit) are later slices.
//
// Record fields (all optional unless noted):
//   id, name, minTier (1-3), weight (> 0)               required. minTier gates it by account wins (scenarios.js tierOf)
//   arenas: "any" | [designedArenaId, ...]              the map is rolled by the engine unless a list is given
//   phase: "day" | "night", weather: weatherId          forced; else the random roll stands
//   foes: "roll" | { crews: [crewId...], exclude: [classId...], count: [min, max] }   "roll" keeps the foes the engine rolled, cut to `count[1]` (top-level count)
//   force: { <checkpointId>: { type, ...fields } }      authored event at that checkpoint (random-events.js create force); wild: [{ kind: "brushfire" }]  a field form at the start
//                                                      one crew is drawn, then `count` of its classes (tier trims the count)
//   houses: "always"                                    rules.houses.chance becomes { default: 1 } for this battle
//   objective: { kind }                                 required; slice 1 has only "classic" (no deadline field)
//   text: { open, mid: { when, text }, result: { player, enemy, none } }   same beats as a theme (Arantxa narrates them); `none` is the
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
  };

  return { SCENARIOS, LAW };
});
