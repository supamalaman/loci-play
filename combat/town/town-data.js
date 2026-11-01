"use strict";
// The town (Mala, 2026-10-17: "turn the main game menu into a town where you can walk around and interact with NPCs";
// docs/town-hub.md). A 26x26 isometric grid: grass, paved streets, and the Isometric Town Catalog's buildings, which are
// already in the game as battle props (sprites/objects). Each building's footprint is its sprite width in tiles
// (64 px a tile, so a 256 px sprite stands on 4x4). A building with `opens` is a door: walk up to any side and press E.
// Rendering and walking are in town.js; this file is only the layout.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTownData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SIZE = 26;

  // Streets: a ring road around the fountain plaza (cells 8-17), four avenues out to the edges, paving inside the ring.
  function surfaceAt(x, y) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
    const inRing = x >= 8 && x <= 17 && y >= 8 && y <= 17;
    if (inRing && (x <= 9 || x >= 16 || y <= 9 || y >= 16)) return "road";
    if (inRing) return "plaza";
    if ((x === 12 || x === 13) || (y === 12 || y === 13)) return "road";
    return "grass";
  }

  // at: the footprint's top (back) corner. size: footprint in tiles. opens: the screen this door leads to (ui.js).
  const buildings = [
    { id: "townHall", name: "Town Hall", sprite: "objects/building-townhall", at: [2, 2], size: 5, opens: "scenarios", verb: "Choose a battle" },
    { id: "archive", name: "The Archive", sprite: "objects/building-office", at: [19, 2], size: 4, opens: "index", verb: "Bestiary, trait web, character library" },
    { id: "ledger", name: "Ledger House", sprite: "objects/building-shop", at: [2, 8], size: 4, opens: "account", verb: "Account, gear and the shop" },
    { id: "lab", name: "The Mad Scientist's Lab", sprite: "objects/building-warehouse", at: [2, 19], size: 5, opens: "lab", verb: "Trait surgery" },
    { id: "home", name: "Home", sprite: "objects/house-cottage", at: [19, 19], size: 4, opens: "character", verb: "Character and loadout" },
    { id: "plaza", name: "Notice Board", sprite: "objects/park-fountain", at: [11, 11], size: 4, opens: "threat", verb: "Threat leaderboard" },
    { id: "hall", name: "The Hiring Hall", sprite: "objects/building-apartment", at: [8, 2], size: 4, opens: "hall", verb: "Merc contracts and letters of safe conduct" },
    { id: "garden", name: "Garden", sprite: "objects/park-garden", at: [14, 2], size: 4 },
    { id: "manor", name: "Manor", sprite: "objects/house-manor", at: [19, 8], size: 4 },
    { id: "rowhouses", name: "Row Houses", sprite: "objects/house-rowhouse", at: [19, 14], size: 4 },
    { id: "suburban", name: "House", sprite: "objects/house-suburban", at: [2, 14], size: 4 },
    { id: "pond", name: "Pond", sprite: "objects/park-pond", at: [8, 20], size: 4 },
    { id: "playground", name: "Playground", sprite: "objects/park-playground", at: [14, 20], size: 4 },
  ];

  // NPCs stand on a tile and block it. `opens` lets a conversation lead to a screen.
  const npcs = [
    { id: "madScientist", name: "The Mad Scientist", sprite: "town/mad-scientist", at: [7.5, 21.5], opens: "lab",
      lines: ["Ah, the Warden. Come to trade a little biology for a seed or two?", "Three slots, no more. The body has opinions.",
        "Removing a trait outright is real surgery. Expensive, and you'll wake up woozy."] },
    { id: "arantxa", name: "Arantxa", sprite: "arantxa/idle", at: [15.5, 10.5],
      lines: ["The town is quiet today. That never lasts.", "The board by the fountain keeps score of every threat that has walked in here.",
        "Town Hall sends you out. The Archive remembers what you met."] },
  ];

  const start = { at: [20.6, 23.7], facing: { back: true, left: true } };   // on Home's front lawn, facing the town

  return { SIZE, surfaceAt, buildings, npcs, start, TILE_W: 64, TILE_H: 32 };
});
