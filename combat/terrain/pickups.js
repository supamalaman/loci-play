"use strict";
// Items are FOUND on the map (Mala, 2026-10-07), not carried in loadouts.
//   placePickups(arena, { seed })     → arena with `pickups: [{ id, item, x, y }]`, placed in mirrored pairs
//   collect(arena, unit, inventory)   → step onto a pickup tile to take it (2 slots; full = it stays)
//   dropsFrom(arena, events, { seed }) → destroyed objects can leave an item behind (`shaken`: damaged-but-standing)
// Item effects live in the wild module (useItem). Both sides can pick items up, so pickups are contested.
// Edibles (Mala, 2026-10-23): one mirrored pair of food from items-data.js turns up in the biomes it grows in (heals, one ultimate-charge
// flower). They have their own pass, so the seeded placement of every other pickup is unchanged.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./mapgen.js"), require("./terrain-data.js"));
  else root.ConceptCombatPickups = factory(root.ConceptCombatMapgen, root.ConceptCombatTerrain);
})(typeof self !== "undefined" ? self : this, function (G, D) {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // Where each item turns up: biome weights, plus the kind of spot it is found next to.
  const sources = {
    waterCan:   { name: "Watering can",        biomes: { wetland: 3, terrace: 2, grove: 1 }, near: ["cistern", "w"], text: "Left by the irrigation crew near water." },
    bait:       { name: "Bait (fallen fruit)", biomes: { grove: 3, wetland: 2, terrace: 1 }, near: ["tree"], text: "Fruit dropped under a tree." },
    flare:      { name: "Flare",               biomes: { quarry: 3, rim: 2 }, near: ["*", "boulder"], text: "A road flare in the quarry rubble." },
    rainStick:  { name: "Rain stick",          biomes: { wetland: 1, rim: 1 }, near: ["w", "~"], text: "Rare: found by the water." },
    borate:     { name: "Borate treatment",    biomes: { terrace: 2, grove: 2, rim: 1 }, near: ["bench", "fence", "planter", "bridge"], text: "A maintenance kit by the site furniture." },
    noisemaker: { name: "Noisemaker",          biomes: { rim: 1, quarry: 1, terrace: 1, grove: 1, wetland: 1 }, near: [], text: "Rare: anywhere." },
    coolantCell: { name: "Coolant cell",       biomes: {}, near: ["dataCenter"], text: "A coolant cell shaken out of a data center." },
    upsCell:     { name: "UPS cell",           biomes: {}, near: ["dataCenter"], text: "A power cell ripped from a data center." },
    dataCore:    { name: "Data core",          biomes: {}, near: ["dataCenter"], text: "Server intel pried from a data center." },
    fish:        { name: "Raw salema",         biomes: {}, near: ["w", "~"], text: "A salema porgy, fresh from the water. Eat it for vivid dreams." },
  };
  // Food the account catalog already defines (account/items-data.js consumables). `weight` is its share of the one edible pair a
  // biome gets; the item's own effect (heal, ultCharge) is what useItem applies, so nothing is repeated here.
  const edibleSources = {
    bitterMelon:   { name: "Bitter melon",     edible: true, biomes: { grove: 3, terrace: 1 }, near: ["planter", "fence"], text: "A bitter melon left on the vine." },
    hawthornBerry: { name: "Hawthorn berries", edible: true, biomes: { grove: 3 }, near: ["tree"], text: "Hawthorn berries, fallen under the shrub." },
    blossomBranch: { name: "Blossom branch",   edible: true, biomes: { grove: 1 }, near: ["tree"], text: "A flowering hawthorn branch." },
    earOfCorn:     { name: "Ear of corn",      edible: true, biomes: { terrace: 3 }, near: ["planter", "fence", "bench"], text: "An ear of corn from the terrace beds." },
    cornKernels:   { name: "Corn kernels",     edible: true, biomes: { terrace: 1 }, near: [], text: "A handful of kernels." },
    fishFillet:    { name: "Fish fillet",      edible: true, biomes: { wetland: 3 }, near: ["w", "~"], text: "A cooked fillet, still warm." },
  };
  const named = Object.assign({}, sources, edibleSources);   // every item a pickup can be, for names and flavor text
  // Destroying some objects leaves an item: [object type or form, item, chance]
  const drops = [["cistern", "waterCan", 1], ["fruitTree", "bait", 0.5], ["fence", "borate", 0.25], ["bench", "borate", 0.25],
    ["dataCenter", "coolantCell", 0.6], ["dataCenter", "upsCell", 0.4], ["dataCenter", "dataCore", 0.25]];
  // Damaged-but-standing objects (the loosePanels trait) shake something small loose: same shape, gentler table.
  const shakenDrops = [["dataCenter", "coolantCell", 1]];
  const fruitTrees = ["milo", "kukui", "monkeypod", "kiawe", "kou"];
  const rules = { slots: 2, pairs: [1, 2], ediblePairs: 1 };

  function roll(seed, tag) {                        // FNV-1a + fmix32 (bare FNV correlates neighbouring keys)
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function weighted(r, table) {
    const e = Object.entries(table).filter(([, w]) => w > 0); let x = r * e.reduce((n, [, w]) => n + w, 0);
    for (const [k, w] of e) if ((x -= w) < 0) return k;
    return e[e.length - 1][0];
  }
  const objAt = (a, x, y) => (a.objects || []).find((o) => o.x === x && o.y === y);
  function anchorsNear(a, x, y, kinds) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 2) continue;
      const nx = x + dx, ny = y + dy; if (ny < 0 || ny >= a.map.length || nx < 0 || nx >= a.map[0].length) continue;
      const o = objAt(a, nx, ny), ch = a.map[ny][nx];
      if (kinds.includes(ch)) return true;
      if (o && (kinds.includes(o.type) || (kinds.includes("tree") && o.form === "tree"))) return true;
      if (kinds.includes("bridge") && (a.structures || []).some((st) => st.tiles.some((t) => t.x === nx && t.y === ny))) return true;
    }
    return false;
  }
  function okTile(a, x, y, taken) {
    const t = D.terrain[a.map[y][x]], o = objAt(a, x, y);
    if (t.blocksMove || t.hazard || t.tags.includes("ramp") || t.tags.includes("bridge")) return false;
    if (o && (o.blocksMove || o.form !== "groundcover")) return false;
    const spawns = [...a.spawns.player, ...a.spawns.enemy];
    if (spawns.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= 1)) return false;
    return !taken.has(x + "," + y);
  }

  // Put `item` on the best open west-half tile (near its anchor, then by a seeded order) and its mirror on the east half.
  function placePair(arena, src, item, taken, pickups, seed, tag) {
    const w = arena.map[0].length, h = arena.map.length;
    const cands = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < Math.floor(w / 2); x++) {
      const mx = w - 1 - x;
      if (!okTile(arena, x, y, taken) || !okTile(arena, mx, y, taken)) continue;
      const near = !src.near.length || anchorsNear(arena, x, y, src.near);
      cands.push({ x, y, mx, score: (near ? 1 : 0) + roll(seed, `${tag}:${x},${y}`) * 0.5 });
    }
    cands.sort((a, b) => b.score - a.score);
    const c = cands[0]; if (!c) return false;
    const n = pickups.length;
    pickups.push({ id: "i" + (n + 1), item, x: c.x, y: c.y }, { id: "i" + (n + 2), item, x: c.mx, y: c.y });
    taken.add(c.x + "," + c.y); taken.add(c.mx + "," + c.y);
    return true;
  }

  function placePickups(arena, opts = {}) {
    const seed = opts.seed ?? arena.seed ?? 0;
    const biome = arena.archetype || "terrace";
    const r0 = roll(seed, "pairs"), [lo, hi] = rules.pairs, want = lo + Math.floor(r0 * (hi - lo + 1));
    const taken = new Set(), pickups = [];
    for (let p = 0; p < want; p++) {
      const already = new Set(pickups.map((q) => q.item));        // prefer variety between pairs
      const pool = Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, (s.biomes[biome] || 0) * (already.has(k) ? 0.25 : 1)]));
      if (!Object.values(pool).some((v) => v > 0)) break;   // a setting no field item grows in (the ship's interior): none are placed (Terrain: Visitor Ship Interior crashed here)
      const item = weighted(roll(seed, "item" + p), pool), src = sources[item];
      placePair(arena, src, item, taken, pickups, seed, "c" + p);
    }
    // Food: its own pass and its own roll tags, so the pairs above are exactly what they were. A biome nothing edible grows in gets none.
    for (let e = 0; e < rules.ediblePairs; e++) {
      const pool = Object.fromEntries(Object.entries(edibleSources).map(([k, s]) => [k, (s.biomes[biome] || 0) * (pickups.some((q) => q.item === k) ? 0.25 : 1)]));
      if (!Object.values(pool).some((v) => v > 0)) break;
      const item = weighted(roll(seed, "edible" + e), pool);
      placePair(arena, edibleSources[item], item, taken, pickups, seed, "e" + e);
    }
    return { ...arena, pickups: [...(arena.pickups || []), ...pickups] };
  }

  // A unit stepping onto (or ending on) a pickup tile takes it if a slot is free.
  function collect(arena, unit, inventory = [], capacity = rules.slots) {
    const p = (arena.pickups || []).find((q) => q.x === unit.x && q.y === unit.y);
    if (!p) return { arena, inventory, event: null };
    const label = named[p.item]?.name || p.name || p.item;   // loot v1: battle consumables aren't in sources; never crash on the name
    if (capacity <= 0) return { arena, inventory, event: null };   // no hands, no announcement (Mala 2026-10-22: 0-slot units spammed pickupFull twice a move)
    if (inventory.length >= capacity) return { arena, inventory, event: { kind: "pickupFull", id: p.id, unit: unit.id, text: `${unit.name || unit.id} can't carry ${label}: all ${capacity} slots are full.` } };
    return { arena: { ...arena, pickups: arena.pickups.filter((q) => q !== p) }, inventory: [...inventory, p.item],
      event: { kind: "pickup", id: p.id, item: p.item, unit: unit.id, text: `${unit.name || unit.id} picks up ${label}.` } };
  }

  // Items left behind by destroyed objects (feed it the `destroyed` events from vegetation/structures).
  // `shaken` events (damaged-but-standing, e.g. the loosePanels trait) pay from the gentler table instead.
  function dropsFrom(arena, events, opts = {}) {
    const seed = opts.seed ?? 0, out = [], added = [];
    let n = Math.max(0, ...(arena.pickups || []).map((p) => +p.id.slice(1) || 0));
    for (const e of events.filter((x) => (x.kind === "destroyed" || x.kind === "shaken") && x.at)) {
      const type = e.type || "";
      const table = e.kind === "shaken" ? shakenDrops : drops;
      for (const [what, item, chance] of table) {
        const hit = what === "fruitTree" ? fruitTrees.includes(type) : type === what;
        const tag = e.kind === "shaken" ? `shake:${e.id}:${item}` : `drop:${e.id}:${item}`;
        if (!hit || roll(seed, tag) >= chance) continue;
        const [x, y] = e.at;
        const spot = [[x, y], ...DIRS.map(([dx, dy]) => [x + dx, y + dy])].find(([sx, sy]) =>
          sy >= 0 && sy < arena.map.length && sx >= 0 && sx < arena.map[0].length && !D.terrain[arena.map[sy][sx]].blocksMove &&
          !(objAt(arena, sx, sy) || {}).blocksMove && ![...(arena.pickups || []), ...added].some((p) => p.x === sx && p.y === sy));
        if (!spot) continue;
        const p = { id: "i" + ++n, item, x: spot[0], y: spot[1] };
        added.push(p); out.push({ kind: "drop", item, at: spot, text: `${sources[item].name} is left behind at (${spot.join(",")}).` });
        break;
      }
    }
    return { arena: { ...arena, pickups: [...(arena.pickups || []), ...added] }, events: out };
  }

  return { placePickups, collect, dropsFrom, sources: named, edibleSources, drops, shakenDrops, rules };
});
