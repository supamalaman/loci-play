"use strict";
// Random-battle scenarios, the data (spec ~/loci-orbit/ready-to-review/claude-random-scenarios-spec/specs/SCENARIOS.md, 3.1 and 4).
// A scenario is a premise plus an objective, laid over the options `E.randomEncounterOptions` returns (modes/scenarios.js).
// Slice 1 holds the two premise-only classic scenarios: SC03 The Open House and SC01 Night Shift at the Quarry. Both end
// the way every classic battle ends (the default branch of checkOutcome, rules.standoff, rules.maxRounds); neither adds a
// clock, because neither adds an objective. The clocked kinds (survive, hold, break, salvage, ward, bounty, exit) are later slices.
//
// Record fields (all optional unless noted):
//   id, name, minTier (1-3), weight (> 0)               required. minTier gates it by account wins (scenarios.js tierOf)
//   arenas: "any" | [designedArenaId, ...]              the map is rolled by the engine unless a list is given
//   phase: "day" | "night", weather: weatherId          forced; else the random roll stands
//   foes: { crews: [crewId...], exclude: [classId...], count: [min, max] }
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
  };

  return { SCENARIOS, LAW };
});
