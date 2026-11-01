"use strict";
// Map dressing (Mala, 2026-10-26: "what happened to using the aesthetic tilesets and unique buildings along the edges of
// maps" ... "yes that would be perfect, astral plane has its own tiles too so include that"). Presentation only: nothing
// here reaches the engine, adds movement cost, cover, collision or line of sight (docs/map-generation.md).
//
//   groundSet(arena)            → the isometric ground tile set an arena draws ("ts2", "ts1") or null
//   dressing(arena)             → [{ group, id, x, y, size }] backdrop sprites on the far ring outside the play area
//   astralFloor(x, y, seed)     → the cosmic floor texture for a tile of the astral pocket
//   astralDressing(w, h, seed)  → [{ group, id, slot, t, size }] astral architecture for the pocket's margins
//
// Ground: an arena's visual.groundTiles wins ("none" opts out); otherwise its archetype picks one. Dressing: authored
// visual.surroundings keep their own backdrop, visual.dressing: "none" opts out, interiors get none; otherwise 4–10
// pieces from the archetype's kit (an arena id can name its own kit), placed and chosen from visual.seed, so the same
// map always looks the same and two maps rarely match. Pieces stand only on the far ring (north and west of the
// board, which the camera looks past), so the board is drawn over them and they never hide a fighter.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatMapDressing = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // Archetype → ground tile set. ts2: Tileset 2 (concrete, grass, dirt, water); ts1: the Tile Set (stone, grass, dirt, water).
  const GROUND = { terrace: "ts2", wetland: "ts2", grove: "ts2", quarry: "ts1", rim: "ts1", ship: null };
  // ts1 reads the Tile Set already in the game (sprites/objects/tiles, Muse's 2026-10-15 cut); its "ice" row is open water.
  const GROUND_BY_ID = { desertDunes: null };   // sand dunes keep their sculpted ground: no grass tiles on a desert
  const TILESETS = { ts1: { folder: "tiles", families: { stone: ["tile-stone-r1-1096", "tile-stone-r1-689", "tile-stone-r1-826", "tile-stone-r1-962", "tile-stone-r2-1097", "tile-stone-r2-685", "tile-stone-r2-827", "tile-stone-r2-964"], grass: ["tile-grass-r1-1248", "tile-grass-r1-1385", "tile-grass-r1-1527", "tile-grass-r1-1667", "tile-grass-r2-1248", "tile-grass-r2-1387", "tile-grass-r2-1528", "tile-grass-r2-1670", "tile-grass-r3-1127"], dirt: ["tile-dirt-r3-106", "tile-dirt-r3-252", "tile-dirt-r3-397", "tile-dirt-r3-543", "tile-dirt-r3-693", "tile-dirt-r3-838", "tile-dirt-r3-979"], water: ["tile-ice-r1-106", "tile-ice-r1-249", "tile-ice-r1-392", "tile-ice-r1-533", "tile-ice-r2-104", "tile-ice-r2-248", "tile-ice-r2-394", "tile-ice-r2-535"] } } };
  const T = (id, size) => ({ group: "objects", id, size });
  const D = (id, size) => ({ group: "objects", id: `dressing/${id}`, size });
  const P = (id, size) => ({ group: "plants", id: `${id}-3`, size });
  const PT = (id, size) => ({ group: "objects", id: `parterre/${id}`, size });   // the Parterre sheet (Muse's cut, 2026-10-26)
  const pillars = [T("pillarAncientStone", 0.7), T("pillarAncientBroken", 0.8), T("pillarIonicMarble", 0.7), T("pillarCorinthianMarble", 0.7), T("pillarTuscanGranite", 0.7)];   // the pillar objects' own art
  const parterre = [PT("full-example-1", 2.6), PT("var-a-1", 2), PT("var-c-1", 2), PT("var-e-1", 2.1), PT("fountains-1", 1.4), PT("fountains-3", 1.3), PT("statues-2", 0.7), PT("statues-3", 0.7),
    PT("statues-4", 0.7), PT("topiary-1", 0.6), PT("topiary-2", 1), PT("topiary-3", 0.6), PT("trees-shrubs-1", 0.7), PT("trees-shrubs-3", 0.7), PT("urns-2", 0.5), PT("edges-walls-gates-1", 1.5)];
  // Kits: courts and plazas get the town, groves a shrine among trees, quarries and rims stone and ruins.
  const KITS = {
    terrace: [T("building-office", 2.1), T("building-apartment", 2.1), T("building-shop", 1.9), T("building-townhall", 2.3), T("building-warehouse", 2.1),
      T("house-manor", 2), T("house-rowhouse", 1.8), T("house-suburban", 1.8), T("park-fountain", 1.6), T("park-garden", 1.6),
      PT("fountains-1", 1.4), PT("statues-2", 0.7), PT("topiary-2", 1), PT("var-e-1", 2.1), PT("urns-2", 0.5)],
    wetland: [T("park-pond", 1.8), T("park-garden", 1.6), T("house-cottage", 1.7), T("house-suburban", 1.8), T("park-path", 1.6), T("park-fountain", 1.5), P("milo", 1.3), P("kukui", 1.4), PT("var-c-1", 2), PT("trees-shrubs-3", 0.7)],
    grove: [D("shrine", 2.6), P("banyan", 1.9), P("koa", 1.6), P("monkeypod", 1.8), P("ohia", 1.4), P("kukui", 1.5), T("pillarAncientStone", 0.7), T("park-garden", 1.5), PT("trees-shrubs-1", 0.7)],
    quarry: [...pillars, D("medieval-rubble-keep", 1.4), D("medieval-rubble-foundry", 1.4), T("pillarOrnateMarble", 0.7)],
    rim: [D("medieval-keep-intact", 2), D("medieval-palisade-intact", 1.8), T("pillarAncientBroken", 0.8), T("pillarAncientStone", 0.7), D("medieval-rubble-palisade", 1.3), P("ohia", 1.3), PT("statues-2", 0.7)],
    // Arena ids with a kit of their own.
    desertDunes: [D("khadar-villa", 2.8), T("pillarTuscanGranite", 0.7), T("pillarOrnateGilded", 0.7), T("pillarCompositePorphyry", 0.7), T("pillarAncientBroken", 0.8), D("medieval-rubble-keep", 1.3)],
    // The formal gardens: the parterre is the backdrop.
    gardenCourt: [...parterre, T("house-manor", 2)], terraceGarden: [...parterre, T("building-townhall", 2.3)],
    warfareField: [D("medieval-keep-intact", 2.1), D("medieval-palisade-intact", 1.9), D("medieval-foundry-intact", 2), D("medieval-rubble-keep", 1.4), D("medieval-rubble-palisade", 1.3), P("koa", 1.5)],
  };
  const ASTRAL = [D("astral-citadel-governance", 2.4), D("astral-observatory-research", 2), D("astral-harmony-temple-spiritual", 2.2), D("astral-gateway-transport", 2),
    D("astral-civilian-district-residential", 2), D("astral-celestial-garden-recreation", 2), D("astral-floating-island-large", 1.8), D("astral-floating-island-small", 1.3),
    D("astral-pillar-tall", 0.7), D("astral-lamp-post", 0.7)];
  const ASTRAL_FLOORS = 6;   // sprites/objects/cosmic/floor-01..06: textures cut from the Cosmic Isometric tile sheet's floors

  // A small seeded generator (mulberry32): the same seed always gives the same map.
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const dims = (arena) => [arena.landW ?? arena.w ?? arena.map?.[0]?.length ?? 0,   // landW: an astral pocket widens w; dressing stays on the land
    arena.h ?? arena.map?.length ?? 0];
  const seedOf = (arena) => (arena.visual?.seed ?? [...String(arena.id || arena.name || "")].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)) >>> 0;

  function groundSet(arena) {
    if (!arena || arena.visual?.style !== "isometric") return null;
    const own = arena.visual.groundTiles;
    if (own === "none") return null;
    if (own) return own;
    if (arena.interior) return null;
    if (arena.id in GROUND_BY_ID) return GROUND_BY_ID[arena.id];
    return GROUND[arena.archetype] ?? null;
  }

  function dressing(arena) {
    if (!arena || arena.visual?.style !== "isometric" || arena.interior || arena.visual.dressing === "none") return [];
    if ((arena.visual.surroundings || []).length) return [];   // an authored backdrop keeps its own
    const kit = KITS[arena.id] || KITS[arena.archetype]; if (!kit) return [];
    const [w, h] = dims(arena); if (!w || !h) return [];
    const r = rng(seedOf(arena) ^ 0x5eed);
    // Slots along the far ring: the north edge (y < 0) and the west edge (x < 0), plus the back corner.
    const slots = [{ x: -1.3, y: -1.3 }];
    for (let x = 0.6; x < w - 0.4; x += 2.4) slots.push({ x, y: -1.1 });
    for (let y = 0.6; y < h - 0.4; y += 2.4) slots.push({ x: -1.1, y });
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    const count = Math.max(4, Math.min(10, slots.length, Math.round((w + h) / 2.4)));
    const bag = []; const out = [];
    for (let i = 0; i < count; i++) {
      if (!bag.length) { bag.push(...kit); for (let k = bag.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [bag[k], bag[j]] = [bag[j], bag[k]]; } }
      const piece = bag.pop(), s = slots[i];
      // Jitter keeps the ring from looking ruled, but never brings a foot onto the board.
      const jx = s.y < 0 ? (r() - 0.5) * 0.8 : -r() * 0.6, jy = s.x < 0 && s.y >= 0 ? (r() - 0.5) * 0.8 : -r() * 0.6;
      // A big piece near the end of an edge is pulled in so it stands on the shelf, not past the board's corner.
      const x = s.y < 0 ? Math.min(s.x + jx, w - piece.size * 0.9) : s.x + jx, y = s.x < 0 && s.y >= 0 ? Math.min(s.y + jy, h - piece.size * 0.9) : s.y + jy;
      out.push({ group: piece.group, id: piece.id, size: piece.size, x: +x.toFixed(2), y: +y.toFixed(2) });
    }
    return out;
  }

  function astralFloor(x, y, seed = 0) {
    const k = ((x * 73856093) ^ (y * 19349663) ^ seed) >>> 0;
    // Mostly plain astral floor and starfield; the rarer ones (rune, crystal, nebula, broken) as accents.
    const n = k % 40, pick = n < 20 ? 1 : n < 34 ? 2 : n < 36 ? 3 : n < 38 ? 4 : n < 39 ? 5 : 6;
    return `cosmic/floor-${String(Math.min(pick, ASTRAL_FLOORS)).padStart(2, "0")}`;
  }

  // The pocket on the flat board has open sky above and beside it: slots are along the top margin (t = 0..1 across the
  // pocket) and down the outer side.
  function astralDressing(w, h, seed = 0) {
    const r = rng((seed ^ 0xa57a1) >>> 0), count = Math.max(4, Math.min(8, Math.round(w / 2)));
    const bag = ASTRAL.slice(); for (let k = bag.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [bag[k], bag[j]] = [bag[j], bag[k]]; }
    const out = [];
    for (let i = 0; i < count; i++) {
      const piece = bag[i % bag.length], side = i % 3 === 2;
      out.push({ group: piece.group, id: piece.id, size: piece.size, slot: side ? "side" : "top", t: +((i + 0.5 + (r() - 0.5) * 0.6) / count).toFixed(3) });
    }
    return out;
  }

  const ids = () => [...new Set([...Object.values(KITS).flat(), ...ASTRAL].map((p) => `${p.group}/${p.id}`)),
    ...Array.from({ length: ASTRAL_FLOORS }, (_, i) => `objects/cosmic/floor-${String(i + 1).padStart(2, "0")}`)];
  return { GROUND, TILESETS, KITS, ASTRAL, groundSet, dressing, astralFloor, astralDressing, ids };
});
