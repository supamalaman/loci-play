"use strict";
// The Pond dive, slices R1 + R2 + R3 (claude-sunken-ruins-spec, specs/SUNKEN_RUINS.md 4.1, 4.3, 4.4; R-20261124-02). The layout is
// town-shaped data, so town/town.js `step`, `collides` and `nearby` walk it unchanged: { SIZE, surfaceAt, buildings,
// npcs, start }. Here `buildings` are the rope, the air bells, and the band-1 sites (R2), and `npcs` is empty. Each one
// answers E through its `opens` string, which dive/dive-ui.js handles. The art is stand-ins until R0 (4.1, 4.6). R3 adds
// `find` on some sites and `rules.regrowDives` (3).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatDiveData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // Breath (4.1, 4.3; Decision 14, R-20261111-42): per whole tile walked, by band; a Swimmer has x1.5; each turn of water
  // breathing from gear or a Jinki gift (`breathTurnsAdd`) adds 20. Wrong Read answer spends `wrongPenalty` (5) breath.
  // The lamp shows tiles within `lampRadius` (Chebyshev).
  const RULES = { breathMax: 100, walkCost: { 1: 1, 2: 2, 3: 3 }, swimmerMul: 1.5, perBreathTurn: 20, lampRadius: 4, wrongPenalty: 5, readPays: 1, regrowDives: 3 };
  const TEXTS = {
    blackout: "You black out and are hauled up the rope. Everything you read stays read; what you carried is back where you found it.",
    surfaced: "Surfaced",
    banked: (n) => `Surfaced: banked ${n} finds`,
    pickedClean: (k) => `Picked clean: it drifts back in ${k} dives`,
  };

  // Seabed surfaces (draw only): sand, silt, rock, kelp. Colours are two shades each, as the town's GROUND.
  const GROUND = { sand: ["#5e6f6a", "#58685f"], silt: ["#41524f", "#3c4c49"], rock: ["#35403f", "#303a39"], kelp: ["#2f5141", "#2a4a3b"] };
  const DARK = "#06121a";   // the water past the lamp

  // Band 1, the Last island (4.2): about -20 m, 8,000 years ago. 20x20. A ridge of rock across the north, kelp beds on
  // the west, silt in the hollows, sand elsewhere. A pure function of the tile, so every dive draws the same coast.
  function band1Surface(x, y) {
    if (x < 0 || y < 0 || x >= 20 || y >= 20) return null;
    if (y <= 2 || (y === 3 && x % 3 !== 0)) return "rock";
    if (x <= 3 && y >= 6 && y <= 15) return "kelp";
    if ((x - 13) * (x - 13) + (y - 9) * (y - 9) <= 6) return "silt";
    return "sand";
  }

  // Band-1 sites (4.2, 4.3, section 7): 7 sites using rev-2 kinds. The first site (`b1_midden`) sits 3 tiles from the
  // rope (inside the lamp from start) with the easiest question so the first E press teaches Read.
  const BAND1_SITES = [
    { id: "b1_midden", name: "Shell midden", kind: "midden", band: 1, sprite: "objects/cairn", at: [13, 16], size: 1, opens: "site:b1_midden", verb: "Read", teaching: true, find: { pay: "parts", tier: "common" } },
    { id: "b1_canoe", name: "Dugout canoe", kind: "canoe", band: 1, sprite: "objects/log", at: [5, 13], size: 1, opens: "site:b1_canoe", verb: "Read", find: { pay: "vessels", kind: "shard" } },
    { id: "b1_hearth", name: "Drowned hearth", kind: "hearth", band: 1, sprite: "objects/campfire", at: [14, 11], size: 1, opens: "site:b1_hearth", verb: "Read", find: { pay: "parts", tier: "uncommon" } },
    { id: "b1_burrow", name: "Lobster burrow", kind: "burrow", band: 1, sprite: "objects/boulder", at: [3, 9], size: 1, opens: "site:b1_burrow", verb: "Read", find: { pay: "parts", tier: "common" } },
    { id: "b1_wall", name: "Stone drive wall", kind: "wall", band: 1, sprite: "objects/pillarAncientBroken", at: [9, 7], size: 1, opens: "site:b1_wall", verb: "Read", find: { pay: "vessels", kind: "bead" } },
    { id: "b1_story", name: "Sea Country mark", kind: "story", band: 1, sprite: "objects/monument", at: [16, 12], size: 1, opens: "site:b1_story", verb: "Read" },
    { id: "b1_wreck", name: "Liner hull", kind: "wreck", band: 1, sprite: "objects/cruiseShipWreck", at: [10, 4], size: 1, opens: "site:b1_wreck", verb: "Read", find: { pay: "parts", tier: "rare" } },
  ];

  // 10 provisional questions (4.3; flagged for Mala's overrule). Facts from Toby Lester, "The Lost World of Aquaterra"
  // (The Atlantic, Dec 2026) and Carleton InTeGrate. Questions with `for: { kind }` serve that kind; those without `for`
  // serve any site.
  const QUESTIONS = [
    {
      id: "q_midden", for: { kind: "midden" },
      q: "A heap of shells beside a hearth is a …?",
      choices: ["reef", "midden", "burial"], answer: 1,
      explain: "A shell midden marks where coastal people ate and dumped shells beside their fires for generations.",
      clue: "Look at the broken shells stacked beside the ash — this was a camp's kitchen heap, not living coral.",
    },
    {
      id: "q_hearth", for: { kind: "hearth" },
      q: "Charcoal from a drowned hearth is dated by …?",
      choices: ["tree rings", "the tide", "radiocarbon"], answer: 2,
      explain: "Radiocarbon dating measures the decay of carbon-14 left in burned wood to tell when the fire went out.",
      clue: "Charcoal is burned organic carbon; archaeologists measure its radioactive decay, not growth rings.",
    },
    {
      id: "q_wall", for: { kind: "wall" },
      q: "A wall of stones half a mile long, built across an old valley floor, was most likely …?",
      choices: ["a drive lane for hunting reindeer", "a sea wall", "a road"], answer: 0,
      explain: "Ice Age hunters built long stone drive lanes across valley floors to funnel migrating reindeer toward an ambush.",
      clue: "When those stones were laid, the valley was dry tundra far inland — think of herding game, not holding back waves.",
    },
    {
      id: "q_story", for: { kind: "story" },
      q: "How old can a story of a drowned coast be and still be right?",
      choices: ["about 500 years", "about 12,000 years", "no story lasts that long"], answer: 1,
      explain: "Oral traditions of Bass Strait and other Sea Country coasts preserve drowned shorelines from about 12,000 years ago — the edge of memory.",
      clue: "Sea Country stories describe islands and crossings that went under when Ice Age seas rose roughly twelve millennia ago.",
    },
    {
      id: "q_canoe", for: { kind: "canoe" },
      q: "Why do wooden canoes and paddles survive under cold seabed silt?",
      choices: ["salt turns wood to stone", "fish oil seals the grain", "low-oxygen silt slows decay"], answer: 2,
      explain: "Fine, oxygen-poor seabed silt seals wood away from decay organisms, preserving dugout canoes and paddles for millennia.",
      clue: "Wood rots fastest where microbes have oxygen; deep silt shuts air out.",
    },
    {
      id: "q_burrow", for: { kind: "burrow" },
      q: "How can a lobster burrow on the seabed reveal an ancient camp?",
      choices: ["digging throws buried stone tools up to the surface", "lobsters collect flint from beaches", "burrows only form on carved rock"], answer: 0,
      explain: "Burrowing lobsters and crabs excavate silt and toss buried stone flakes and tools out onto the seafloor where divers spot them.",
      clue: "Look at the fresh spoil pile outside the hole — the animal dug into the older layer beneath the sand.",
    },
    {
      id: "q_wreck", for: { kind: "wreck" },
      q: "Why can a modern liner rest in the same shallow band as an 8,000-year-old hearth?",
      choices: ["storms pull deep wrecks uphill", "modern ships only sink near middens", "ruins of every age settle on the shelf, the newest on top"], answer: 2,
      explain: "The flooded shelf collects every era in turn: a modern hull settles directly atop drowned Stone Age ground.",
      clue: "Once the sea covered the coast, newer wrecks simply sank onto the same floor.",
    },
    {
      id: "q_sea_level",
      q: "Twenty thousand years ago the sea stood about …?",
      choices: ["20 m lower", "120 m lower", "higher than today"], answer: 1,
      explain: "At the Last Glacial Maximum, water locked in ice sheets left global sea level roughly 120 metres lower, exposing vast coastal plains.",
      clue: "Ice sheets held an enormous share of Earth's ocean water — far more than twenty metres of drop.",
    },
    {
      id: "q_camps",
      q: "Why do drowned coasts hold so many old camps?",
      choices: ["people lived by the water for food and travel", "the sea carried inland camps downhill", "ice sheets pushed houses to the shore"], answer: 0,
      explain: "Shellfish, fish, freshwater springs, and easy boat travel drew human camps to the Ice Age shoreline long before the waters rose.",
      clue: "Think of where people gather in every age: shorelines offer food and travel routes.",
    },
    {
      id: "q_shelf",
      q: "What happened to the Ice Age coastal plains when the glaciers melted?",
      choices: ["they sank from earthquakes in a single year", "wind blew the soil out to sea", "rising seas flooded them into continental shelves"], answer: 2,
      explain: "Between about 14,000 and 8,000 years ago, meltwater raised the oceans by around 100 metres, turning inhabited plains into the continental shelf.",
      clue: "The land did not vanish overnight — melting ice slowly raised the sea over it.",
    },
  ];

  // at: the footprint's back corner; size: 1 tile. The rope is where the Warden came down; E there surfaces.
  const BANDS = {
    1: {
      id: 1, name: "The Last island", depth: "-20 m", age: "about 8,000 years ago", SIZE: 20, surfaceAt: band1Surface,
      buildings: [
        { id: "rope", name: "The rope", sprite: "objects/pillarAncientStone", at: [10, 16], size: 1, opens: "rope", verb: "Surface" },
        { id: "bellWest", name: "Air bell", sprite: "objects/cistern", at: [5, 5], size: 1, opens: "bell:bellWest", verb: "Breathe the trapped air" },
        { id: "bellEast", name: "Air bell", sprite: "objects/cistern", at: [15, 6], size: 1, opens: "bell:bellEast", verb: "Breathe the trapped air" },
        ...BAND1_SITES,
      ],
      npcs: [],
      start: { at: [10.5, 17.6], facing: { back: true, left: false } },   // just south of the rope, facing the seabed
    },
  };

  const band = (n) => BANDS[n] || null;
  const sites = (n) => { const L = band(n); return L ? L.buildings.filter((b) => String(b.opens || "").startsWith("site:")) : []; };
  const siteById = (id) => {
    for (const L of Object.values(BANDS)) {
      const hit = L.buildings.find((b) => b.id === id && String(b.opens || "").startsWith("site:"));
      if (hit) return hit;
    }
    return null;
  };
  return { RULES, TEXTS, GROUND, DARK, BANDS, QUESTIONS, band, sites, siteById, TILE_W: 64, TILE_H: 32 };
});
