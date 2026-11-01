"use strict";
// Terrain data for Concept Combat arenas: the terrain table, authored map parts grouped by
// archetype, and the hand-designed arenas. Plain data only (no functions), like content.js.
// Design source: ~/Documents/concept-combat-terrain-plan.md. Every number is PROVISIONAL.
//
// Map format: `map` = terrain characters, `height` = digits 0–3, both 7 rows.
// Side parts are 4 wide (x=0 is the outer edge, x=3 the seam); center parts are 3 wide.
// Seam contract: on rows 2–4 every seam-column tile is walkable and at height ≤ 1, so any
// two parts can be stitched without sealing the map. Tests enforce this.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./authored-arenas.js"));
  else root.ConceptCombatTerrain = factory(root.ConceptCombatAuthoredArenas);
})(typeof self !== "undefined" ? self : this, function (authored) {

  // ── terrain table (plan §5) ─────────────────────────────────────────────
  // sightHeight: an obstacle blocks a sight line only when it is at least as tall as the
  // higher endpoint's height + 1 (plan §3.2). 0 = never blocks.
  const terrain = {
    ".": { name: "paving",      moveCost: 1, blocksMove: false, sightHeight: 0, cover: 0,    hazard: 0, tags: ["hard"] },
    ",": { name: "turf",        moveCost: 1, blocksMove: false, sightHeight: 0, cover: 0,    hazard: 0, tags: ["soil"] },
    "m": { name: "mulch",       moveCost: 2, blocksMove: false, sightHeight: 0, cover: 0,    hazard: 0, tags: ["soil", "tpz"] },
    "w": { name: "shallow water", moveCost: 2, blocksMove: false, sightHeight: 0, cover: 0,  hazard: 0, tags: ["water"] },
    "~": { name: "pool",        moveCost: 0, blocksMove: true,  sightHeight: 0, cover: 0,    hazard: 0, tags: ["water"] },
    "h": { name: "hedge",       moveCost: 2, blocksMove: false, sightHeight: 1, cover: 0.25, hazard: 0, tags: ["plant"] },
    "T": { name: "tree",        moveCost: 0, blocksMove: true,  sightHeight: 3, cover: 1,    hazard: 0, tags: ["plant"] },
    "#": { name: "pillar",      moveCost: 0, blocksMove: true,  sightHeight: 3, cover: 1,    hazard: 0, tags: ["hard"] },
    "/": { name: "ramp",        moveCost: 1, blocksMove: false, sightHeight: 0, cover: 0,    hazard: 0, tags: ["hard", "ramp"] },
    "=": { name: "wall top",    moveCost: 1, blocksMove: false, sightHeight: 0, cover: 0,    hazard: 0, tags: ["hard", "edge"] },
    "b": { name: "wooden bridge", moveCost: 1, blocksMove: false, sightHeight: 0, cover: 0,   hazard: 0, tags: ["hard", "bridge", "wood"] },
    "*": { name: "thorn rubble", moveCost: 2, blocksMove: false, sightHeight: 0, cover: 0,   hazard: 3, tags: ["hazard"] },
    "^": { name: "thorn mat", moveCost: 2, blocksMove: false, sightHeight: 0, cover: 0, hazard: 3, tags: ["plant", "hazard", "soil"] },
  };

  // How the current flat engine (Loci ≤1.3.x, tiles . ~ #) should read these maps until P1.
  const legacyChar = { "~": "~", "T": "#", "#": "#" };   // everything else → "."

  const rules = {
    width: 11, heightRows: 7, sideWidth: 4, centerWidth: 3,
    seamRows: [2, 3, 4],
    climbSurcharge: 1,          // +1 move to step up 1 level, unless either tile is a ramp
    ledgeDelta: 2,              // |Δh| ≥ 2 = ledge: Climb (main action) up, Jump/fall down
    fall: { 2: 8, 3: 16 },      // LF by drop (plan §4); drop 1 = 0
    fairness: { maxCostGap: 2, maxSpawnHeightGap: 1 },
    attempts: 24,
    // Destructible terrain (structures.js). Solid ground never breaks; cliff faces and
    // bridges do. Only ground-targeting attacks (placed, or area damage) hit terrain.
    ground: {
      targetingDeliveries: ["placed", "field"],          // plus any damage ability with an area shape other than "single"
      cliff: { integrityPerLevel: 15, integrityBase: 10, masonryMul: 1.25, weakenNeighbours: 0.5,
               materials: { nigredo: 1, rubedo: 1.25, citrinitas: 0.75, albedo: 0.5 } },
      rockslide: { damagePerLevel: 8, damageBase: 6, objectMul: 2, stagger: true, channel: "nigredo" },
      bridge: { hp: 20, materials: { nigredo: 1.25, citrinitas: 1, rubedo: 1, albedo: 0.75 }, collapseDamage: 6, stagger: true },
    },
  };

  // ── archetypes and how they blend (weights) ──────────────────────────────
  // A map is primary-archetype led; parts may be borrowed from listed neighbours.
  const archetypes = {
    terrace: { name: "Terrace", blend: { terrace: 3, rim: 1, grove: 1 } },
    wetland: { name: "Wetland", blend: { wetland: 3, grove: 1, terrace: 1 } },
    grove:   { name: "Grove",   blend: { grove: 3, wetland: 1, terrace: 1 } },
    quarry:  { name: "Quarry",  blend: { quarry: 3, terrace: 1, rim: 1 } },
    rim:     { name: "Rim",     blend: { rim: 3, quarry: 1, terrace: 1 } },
    // An interior: authored only (the Visitor Ship). It has no parts, so the generator never picks it (generated: false).
    ship:    { name: "Ship",    blend: { ship: 1 }, generated: false },
  };
  // layout: mirror = east side is the west part mirrored (fair by construction);
  //         pair   = east side is a different part (must pass the fairness check).
  const layouts = { mirror: 3, pair: 2 };

  // ── parts ────────────────────────────────────────────────────────────────
  const parts = [
    // terrace
    { id: "terrace-shelf", name: "Retained shelf", archetype: "terrace", slot: "side",
      map:    [",=,,", ",=h,", ",./,", ",./,", ",=h,", ",=,,", ",=,,"],
      height: ["2200", "2200", "2210", "2210", "2200", "2200", "2200"],
      spawns: [[0, 3], [0, 1], [0, 5]],
      note: "High back terrace behind a 2-level wall; the ramp is the only walk up." },
    { id: "terrace-steps", name: "Hedged steps", archetype: "terrace", slot: "side",
      map:    ["T,h,", ",,h,", ",,./", ".,,,", ",,./", ",,h,", "T,h,"],
      height: ["1110", "1110", "1110", "1100", "1110", "1110", "1110"],
      spawns: [[0, 3], [1, 1], [1, 5]],
      note: "One-level steps behind hedges; ramps skip the climb surcharge." },
    { id: "terrace-ziggurat", name: "Ziggurat", archetype: "terrace", slot: "center",
      map:    [",,,", ",/,", "/=/", ".=.", "/=/", ",/,", ",,,"],
      height: ["000", "010", "121", "121", "121", "010", "000"],
      note: "Central high ground at height 2, ringed by ramps." },
    { id: "terrace-sunken", name: "Sunken lane", archetype: "terrace", slot: "center",
      map:    [",,,", ",,,", "h/h", "...", "h/h", ",,,", ",,,"],
      height: ["111", "111", "101", "000", "101", "111", "111"],
      note: "A low lane between raised, hedge-lined banks." },

    // wetland
    { id: "wetland-bank", name: "Reed bank", archetype: "wetland", slot: "side",
      map:    ["T,ww", ",,w~", ",,.w", ".,..", ",,.w", ",,w~", "T,ww"],
      height: ["1100", "1100", "1100", "1110", "1100", "1100", "1100"],
      spawns: [[0, 3], [0, 1], [0, 5]],
      note: "A dry bank stepping down into shallow water." },
    { id: "wetland-raingarden", name: "Rain garden", archetype: "wetland", slot: "side",
      map:    [",m,,", "mwm,", ",m,,", ",,,,", ",,m,", ",mwm", ",,m,"],
      height: ["0000", "0000", "0000", "0000", "0000", "0000", "0000"],
      spawns: [[0, 3], [0, 0], [0, 6]],
      note: "Flat; mulch-ringed wet pockets slow movement." },
    { id: "wetland-swale", name: "Bioswale", archetype: "wetland", slot: "center",
      map:    [",w,", ",w,", ".w.", ".b.", ".w.", ",w,", ",~,"],
      height: ["101", "101", "101", "111", "101", "101", "101"],
      structures: [{ kind: "bridge", tiles: [{ x: 1, y: 3, under: "w", underH: 0 }] }],
      note: "A low wet channel with one wooden footbridge." },
    { id: "wetland-pond", name: "Pond", archetype: "wetland", slot: "center",
      map:    [",,,", ",~,", "w~w", "wbw", "w~w", ",~,", ",,,"],
      height: ["000", "000", "000", "000", "000", "000", "000"],
      structures: [{ kind: "bridge", tiles: [{ x: 1, y: 3, under: "~", underH: 0 }] }],
      note: "Deep water splits the middle, crossed by one plank bridge; wade the margins or go around." },

    // grove
    { id: "grove-banyan", name: "Banyan edge", archetype: "grove", slot: "side",
      map:    ["mmm,", "mTm,", "mmm,", ",,,,", ",mmm", ",mTm", ",mmm"],
      height: ["0000", "0000", "0000", "0000", "0000", "0000", "0000"],
      spawns: [[0, 3], [0, 1], [0, 5]],
      note: "Two trees with mulch protection-zone rings." },
    { id: "grove-hedgerow", name: "Hedgerow knoll", archetype: "grove", slot: "side",
      map:    [",,h,", ",,h,", ",,,,", ",h,,", ",,,,", ",,h,", ",,h,"],
      height: ["0000", "0000", "1000", "1000", "1000", "0000", "0000"],
      spawns: [[0, 3], [0, 1], [0, 5]],
      note: "A small knoll behind broken hedgerows." },
    { id: "grove-greattree", name: "Great tree", archetype: "grove", slot: "center",
      map:    [",,,", ",m,", "mmm", "mTm", "mmm", ",m,", ",,,"],
      height: ["000", "000", "000", "000", "000", "000", "000"],
      note: "One tree blocks the centre; its mulch ring slows the approach." },
    { id: "grove-glade", name: "Glade", archetype: "grove", slot: "center",
      map:    ["T,T", ",,,", ",h,", ",,,", ",h,", ",,,", "T,T"],
      height: ["000", "000", "000", "010", "000", "000", "000"],
      note: "An open glade with a one-tile knoll between hedges." },

    // quarry
    { id: "quarry-shelf", name: "Quarry shelf", archetype: "quarry", slot: "side",
      map:    ["T.=*", "..=*", "..//", "..=*", "..=*", "..=*", "T.=*"],
      height: ["3330", "3330", "3321", "3330", "3330", "3330", "3330"],
      spawns: [[0, 2], [0, 0], [0, 4]],
      note: "A height-3 shelf over a 3-drop onto thorn rubble; one ramp down." },
    { id: "quarry-spoil", name: "Spoil heaps", archetype: "quarry", slot: "side",
      map:    ["T*,,", "**,,", ",,,,", ",,*,", ",,,,", "**,,", "T*,,"],
      height: ["0100", "1100", "0000", "0010", "0000", "1100", "0100"],
      spawns: [[0, 3], [0, 2], [0, 4]],
      note: "Low rubble heaps; raised thorn tiles hurt to be shoved into." },
    { id: "quarry-cutface", name: "Cut face", archetype: "quarry", slot: "center",
      map:    [".=.", "*/*", "*/*", "...", "*/*", "*/*", ".=."],
      height: ["333", "020", "010", "000", "010", "020", "333"],
      note: "Ramps climb to height-3 lookouts north and south, flanked by thorns." },
    { id: "quarry-slab", name: "Slab", archetype: "quarry", slot: "center",
      map:    [",,,", "#,#", ",,,", ",=,", ",,,", "#,#", ",,,"],
      height: ["000", "000", "000", "020", "000", "000", "000"],
      note: "A lone height-2 slab: reachable only by a Climb action." },

    // rim
    { id: "rim-crest", name: "Rim crest", archetype: "rim", slot: "side",
      map:    ["T,,,", ",,=.", ",,=.", ",,/.", ",,=.", ",,=.", "T,,,"],
      height: ["2221", "2220", "2220", "2210", "2220", "2220", "2221"],
      spawns: [[0, 3], [0, 1], [0, 5]],
      note: "High rim with a 2-drop inner edge; one ramp down to the floor." },
    { id: "rim-collapsed", name: "Collapsed rim", archetype: "rim", slot: "side",
      map:    [",,,,", ",*,,", ",,,.", ",,..", ",,,.", ",*,,", ",,,,"],
      height: ["1110", "1110", "1100", "1100", "1100", "1110", "1110"],
      spawns: [[0, 3], [0, 0], [0, 6]],
      note: "A lower, broken rim with rubble." },
    { id: "rim-floor", name: "Crater floor", archetype: "rim", slot: "center",
      map:    [",,,", ",.,", "...", ".~.", "...", ",.,", ",,,"],
      height: ["000", "000", "000", "000", "000", "000", "000"],
      note: "Open floor around a central pool." },
    { id: "rim-memorial", name: "Memorial walk", archetype: "rim", slot: "center",
      map:    [",.,", "#.#", "...", ".=.", "...", "#.#", ",.,"],
      height: ["000", "000", "000", "010", "000", "000", "000"],
      note: "Paved walk between monuments with a low plinth." },
  ];

  // ── designed arenas ──────────────────────────────────────────────────────
  const warfareGrid = Array.from({ length: 9 }, () => Array(15).fill(","));
  for (const [x, y, ch] of [[0,0,"T"],[14,0,"T"],[0,8,"T"],[14,8,"T"],[5,1,"h"],[9,1,"h"],[3,2,"#"],[10,2,"T"],[2,4,"h"],[6,4,"#"],[10,4,"h"],[5,6,"T"],[11,6,"h"],[5,7,"h"],[9,7,"h"]]) warfareGrid[y][x] = ch;
  const arenas = {
    warfareField: {
      name: "Warfare Field", archetype: "grove",
      map: warfareGrid.map(row => row.join("")),
      height: Array(9).fill("000000000000000"),
      spawns: { player: [[1, 4]], enemy: [[13, 2], [13, 6]], wild: [[7, 4], [7, 5]] },
      note: "A 15×9 three-front arena for player, enemy, and wild factions; cover and open lanes let them collide from several directions.",
    },
    terraceGarden: {
      name: "Terrace Garden", archetype: "terrace",
      map: [
        ",,,,,.,,,,,",
        "hhh,h/h,hhh",
        ",,,,,.,,,,,",
        "hh,hh/hh,hh",
        ",,,,,.,,,,,",
        ",,,,,,,,,,,",
        ",,,,,,,,,,,",
      ],
      height: [
        "22222222222",
        "22222222222",
        "11111111111",
        "11111111111",
        "00000000000",
        "00000000000",
        "00000000000",
      ],
      spawns: { player: [[1, 5]], enemy: [[9, 5], [9, 4], [9, 6]] },
      note: "Three terraces (0/1/2). The central ramps cost 1 per level; hedge gaps cost a climb surcharge plus hedge.",
    },
    punchbowlRim: {
      name: "Punchbowl Rim", archetype: "rim",
      map: [
        ",T,,,,,,,T,",
        ",=.......=,",
        "=..#...#..=",
        "./...~.../.",
        "=..#...#..=",
        ",=.......=,",
        ",T,,,,,,,T,",
      ],
      height: [
        "22222222222",
        "22000000022",
        "20000000002",
        "21000000012",
        "20000000002",
        "22000000022",
        "22222222222",
      ],
      spawns: { player: [[0, 3]], enemy: [[10, 3], [10, 1], [10, 5]] },
      note: "A crater: rim at height 2, floor at 0, a 2-drop inner edge, and two ramps. Named for the Punchbowl site.",
    },
    bioswaleCourt: {
      name: "Bioswale Court", archetype: "wetland",
      map: [
        "....,w,....",
        ".h..,w,..h.",
        "....mwm....",
        "....bbb....",
        "....mwm....",
        ".h..,w,..h.",
        "....,~,....",
      ],
      height: [
        "11110001111",
        "11110001111",
        "11110001111",
        "11111111111",
        "11110001111",
        "11110001111",
        "11110001111",
      ],
      spawns: { player: [[1, 3]], enemy: [[9, 3], [9, 2], [9, 4]] },
      structures: [{ kind: "bridge", tiles: [{ x: 4, y: 3, under: ",", underH: 0 }, { x: 5, y: 3, under: "w", underH: 0 }, { x: 6, y: 3, under: ",", underH: 0 }] }],
      note: "A wet channel between raised paving banks; shoves funnel toward the swale.",
    },
    banyanGrove: {
      name: "Banyan Grove", archetype: "grove",
      map: [
        ",mmm,,,mmm,",
        ",mTm,h,mTm,",
        ",mmmmmmmmm,",
        ",h,,mTm,,h,",
        ",mmmmmmmmm,",
        ",mTm,h,mTm,",
        ",mmm,,,mmm,",
      ],
      height: [
        "00000100000",
        "00000000000",
        "00000000000",
        "00000000000",
        "00000000000",
        "00000000000",
        "00000100000",
      ],
      spawns: { player: [[0, 3]], enemy: [[10, 3], [10, 1], [10, 5]] },
      note: "Five trees with mulch protection rings. Heavy sight blocking: cover and routed delivery matter.",
    },
    quarryLedge: {
      name: "Quarry Ledge", archetype: "quarry",
      map: [
        "..#.....#..",
        ".=========.",
        "/**,***,**/",
        "/,,,,,,,,,/",
        ",,,#,,,#,,,",
        ",,,,,,,,,,,",
        ",,T,,,,,T,,",
      ],
      height: [
        "33333333333",
        "33333333333",
        "20000000002",
        "10000000001",
        "00000000000",
        "00000000000",
        "00000000000",
      ],
      spawns: { player: [[1, 5]], enemy: [[9, 5], [9, 4], [9, 6]] },
      note: "A height-3 shelf over a 3-drop onto thorn rubble; ramps at both ends. The fall showcase.",
    },
    gardenCourt: {
      name: "Garden Court", archetype: "terrace", ground: "continuous",
      map: [
        ",T,hh,hh,T,",
        ",ww,,~,,ww,",
        "...././....",
        "...........",
        "...........",
        ",,,,,,,,,,,",
        ",,,,,,,,,,,",
      ],
      height: [
        "11111111111",
        "11111111111",
        "00000000000",
        "00000000000",
        "00000000000",
        "00000000000",
        "00000000000",
      ],
      spawns: { player: [[1, 6]], enemy: [[9, 6], [9, 5], [9, 4]] },
      note: "A stone court in front of a retained lawn. One step up, two ramps, a pool in the gate, and basins in front of the trees.",
    },
    // Heart Court is a set piece beside Garden Court, not a rewrite of it. Living turf, one supertree.
    // setPiece keeps it out of random encounters. Archetype terrace, placed after gardenCourt, so a
    // failed terrace generate still falls back to Garden Court. The heart is not a building.
    heartCourt: {
      name: "Heart Court", archetype: "terrace", ground: "continuous", setPiece: true,
      map: Array.from({ length: 11 }, () => ",".repeat(15)),
      height: Array.from({ length: 11 }, () => "0".repeat(15)),
      spawns: { player: [[1, 5]], enemy: [[13, 5], [13, 4], [13, 6]] },
      objects: [{
        id: "heart", kind: "heart", type: "heart", name: "Heart of the Court",
        x: 7, y: 5, hp: 48, maxHp: 48, blocksMove: false, cover: 0.25,
        sprite: "gardens-by-the-bay/gbb-supertree-large", tags: ["living"], status: {},
      }],
      note: "An open living court. The supertree at the centre is the heart. Protect it, or break it.",
    },
    shipInterior: {
      name: "Visitor Ship Interior", archetype: "ship", interior: true,
      map: [
        "###########",
        "....#......",
        "....#.##...",
        "...........",
        "....#.##...",
        "....#......",
        "###########",
      ],
      height: [
        "00000000000",
        "00000000000",
        "00000000000",
        "00000000000",
        "00000000000",
        "00000000000",
        "00000000000",
      ],
      spawns: { player: [[1, 3]], enemy: [[8, 1], [8, 5], [9, 3]] },
      note: "Brig west, airlock east. A bulkhead with one gap (5,3); equipment blocks north and south. No vegetation: V.populate is skipped for the escape (ui.js).",
    },
  };

  // An authored (sculpted) arena replaces the hand-written one, but keeps its flat-board ground painter: Garden Court's
  // continuous ground still draws when the isometric view is off (Lantern, landing its iso view 2026-10-18).
  // It also keeps `interior` (the ship), which keeps it out of the random-encounter pool (engine.js).
  for (const [id, a] of Object.entries(authored || {})) {
    const base = arenas[id] || {}, keep = { ...(base.ground && !a.ground ? { ground: base.ground } : {}), ...(base.interior && a.interior == null ? { interior: base.interior } : {}) };
    arenas[id] = Object.keys(keep).length ? { ...a, ...keep } : a;   // the catalog's own object when there is nothing to carry over
  }
  // Isometric palettes for generated maps (Muse's generated-iso SPEC, built by Lantern 2026-10-19), one per generatable
  // archetype, borrowed from the designed arena of the same archetype. A blended map uses its primary archetype's.
  const isoPalettes = {
    terrace: { stone: "#b9a88c", soil: "#7a5638", turf: "#719a4c", water: "#4f93a3", wall: "#7b6a55", ramp: "#a8936f" },   // Terrace Garden
    wetland: { stone: "#a9a39a", soil: "#6b4f36", turf: "#628f4c", water: "#4b8fa0", wall: "#6e6a64", ramp: "#9c948a" },   // Bioswale Court
    grove:   { stone: "#8c8270", soil: "#5e4430", turf: "#557f3f", water: "#477f8c", wall: "#5b5145", ramp: "#857660" },   // Banyan Grove
    quarry:  { stone: "#a39e95", soil: "#7a6550", turf: "#7f9150", water: "#56909c", wall: "#6f6a62", ramp: "#a0968a" },   // Quarry Ledge
    rim:     { stone: "#7d6f62", soil: "#7a4a32", turf: "#7c9a4a", water: "#4c8c9e", wall: "#5a4b40", ramp: "#8f7a62" },   // Punchbowl Rim
  };
  return { terrain, legacyChar, rules, archetypes, layouts, parts, arenas, isoPalettes };
});
