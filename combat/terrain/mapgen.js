"use strict";
// Archetype map generator for Concept Combat. Not freeform noise: a seed picks a primary
// archetype, a layout (mirror / pair), and authored parts (west side + center + east side),
// optionally flipped, then the stitched map must pass validation (connectivity, spawns,
// fairness) or the next attempt is tried. Pure functions over terrain-data.js; no DOM.
// Plan: ~/Documents/concept-combat-terrain-plan.md §7 (Mala, 2026-10-07: "select from
// archetypes and place them together in parts").
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./terrain-data.js"));
  else root.ConceptCombatMapgen = factory(root.ConceptCombatTerrain);
})(typeof self !== "undefined" ? self : this, function (D) {
  const R = D.rules;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function weighted(rand, table) {
    const entries = Object.entries(table).filter(([, w]) => w > 0);
    let r = rand() * entries.reduce((n, [, w]) => n + w, 0);
    for (const [k, w] of entries) { if ((r -= w) < 0) return k; }
    return entries[entries.length - 1][0];
  }
  const pick = (rand, list) => list[Math.floor(rand() * list.length)];
  const rev = (s) => s.split("").reverse().join("");

  // ── part transforms ─────────────────────────────────────────────────────
  function mirrorX(p) {
    const w = p.map[0].length;
    return { ...p, map: p.map.map(rev), height: p.height.map(rev), spawns: p.spawns && p.spawns.map(([x, y]) => [w - 1 - x, y]),
      structures: moveStructures(p.structures, (t) => ({ ...t, x: w - 1 - t.x })), mirrored: !p.mirrored };
  }
  function flipY(p) {
    const h = p.map.length;
    return { ...p, map: p.map.slice().reverse(), height: p.height.slice().reverse(), spawns: p.spawns && p.spawns.map(([x, y]) => [x, h - 1 - y]),
      structures: moveStructures(p.structures, (t) => ({ ...t, y: h - 1 - t.y })), flipped: !p.flipped };
  }
  // Structures (bridges) carry per-tile coordinates; parts move them with the part.
  function moveStructures(list, f) { return list && list.map((st) => ({ ...st, tiles: st.tiles.map(f) })); }

  // ── grid helpers ────────────────────────────────────────────────────────
  // Objects (vegetation-data.js, resolved by vegetation.js populate) override the terrain's
  // occupancy props on their tile; terrain tags and hazard still come from the ground.
  const objIndex = new WeakMap();
  function objectAt(a, x, y) {
    if (!a.objects || !a.objects.length) return null;
    let idx = objIndex.get(a.objects);
    if (!idx) { idx = new Map(a.objects.map((o) => [o.x + "," + o.y, o])); objIndex.set(a.objects, idx); }
    return idx.get(x + "," + y) || null;
  }
  const T = (a, x, y) => {
    const t = D.terrain[a.map[y][x]], o = objectAt(a, x, y);
    return o ? { ...t, blocksMove: o.blocksMove, moveCost: o.moveCost, sightHeight: o.sightHeight, cover: o.cover } : t;
  };
  const H = (a, x, y) => +a.height[y][x];
  const inside = (a, x, y) => y >= 0 && y < a.map.length && x >= 0 && x < a.map[0].length;
  const walkable = (a, x, y) => inside(a, x, y) && !T(a, x, y).blocksMove;

  // Step cost from (x,y) to (nx,ny) on foot, or null if it needs Climb (up a ledge) or a
  // Jump/fall (down a ledge). Plan §3.1: up 1 = +1 move unless either tile is a ramp.
  function stepCost(a, x, y, nx, ny) {
    if (!walkable(a, nx, ny)) return null;
    const dh = H(a, nx, ny) - H(a, x, y);
    if (Math.abs(dh) >= R.ledgeDelta) return null;
    const ramp = T(a, x, y).tags.includes("ramp") || T(a, nx, ny).tags.includes("ramp");
    return T(a, nx, ny).moveCost + (dh === 1 && !ramp ? R.climbSurcharge : 0);
  }

  // Dijkstra over walking steps (small grids: a linear scan for the minimum is fine).
  function walkCosts(a, [sx, sy]) {
    const dist = new Map([[sx + "," + sy, 0]]), done = new Set();
    for (;;) {
      let best = null;
      for (const [k, d] of dist) if (!done.has(k) && (best === null || d < best[1])) best = [k, d];
      if (!best) return dist;
      done.add(best[0]);
      const [x, y] = best[0].split(",").map(Number);
      for (const [dx, dy] of DIRS) {
        const c = stepCost(a, x, y, x + dx, y + dy);
        if (c === null) continue;
        const k = (x + dx) + "," + (y + dy), nd = best[1] + c;
        if (!dist.has(k) || nd < dist.get(k)) dist.set(k, nd);
      }
    }
  }
  // Reachability when Climb and Jump are allowed (any walkable neighbour).
  function anyReach(a, [sx, sy]) {
    const seen = new Set([sx + "," + sy]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, k = nx + "," + ny;
        if (walkable(a, nx, ny) && !seen.has(k)) { seen.add(k); q.push([nx, ny]); }
      }
    }
    return seen;
  }
  function ledges(a) {
    const out = [];
    for (let y = 0; y < a.map.length; y++) for (let x = 0; x < a.map[0].length; x++)
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (!inside(a, x + dx, y + dy)) continue;
        const d = H(a, x + dx, y + dy) - H(a, x, y);
        if (Math.abs(d) >= R.ledgeDelta && walkable(a, x, y) && walkable(a, x + dx, y + dy))
          out.push(d > 0 ? { high: [x + dx, y + dy], low: [x, y], drop: d } : { high: [x, y], low: [x + dx, y + dy], drop: -d });
      }
    return out;
  }

  // ── validation ──────────────────────────────────────────────────────────
  function validate(a, opts = {}) {
    const errors = [];
    const rows = a.map.length, cols = a.map[0].length;
    if (a.height.length !== rows) errors.push("height layer row count differs from map");
    a.map.forEach((row, y) => {
      if (row.length !== cols) errors.push(`map row ${y} is ${row.length} wide, expected ${cols}`);
      if ((a.height[y] || "").length !== cols) errors.push(`height row ${y} is the wrong width`);
      for (const ch of row) if (!D.terrain[ch]) errors.push(`unknown terrain '${ch}' in row ${y}`);
      for (const ch of a.height[y] || "") if (!/[0-3]/.test(ch)) errors.push(`bad height '${ch}' in row ${y}`);
    });
    if (errors.length) return { ok: false, errors };

    const sp = a.spawns, all = [...sp.player, ...sp.enemy];
    const keys = new Set();
    for (const [x, y] of all) {
      if (!walkable(a, x, y)) errors.push(`spawn (${x},${y}) is not walkable`);
      else if (T(a, x, y).hazard) errors.push(`spawn (${x},${y}) is on a hazard`);
      if (keys.has(x + "," + y)) errors.push(`spawn (${x},${y}) is duplicated`);
      keys.add(x + "," + y);
    }
    if (errors.length) return { ok: false, errors };

    // Everyone can walk (no Climb needed) to every opponent.
    const fromPlayer = walkCosts(a, sp.player[0]);
    for (const [x, y] of sp.enemy) if (!fromPlayer.has(x + "," + y)) errors.push(`no walking route from the player to enemy spawn (${x},${y})`);
    // No sealed tiles: every walkable tile is reachable when Climb/Jump are allowed.
    const reach = anyReach(a, sp.player[0]);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
      if (walkable(a, x, y) && !reach.has(x + "," + y)) errors.push(`tile (${x},${y}) is sealed off`);

    // Fairness: cost to reach the centre column and spawn heights.
    const mid = Math.floor(cols / 2);
    const toMid = (costs) => Math.min(...[...Array(rows).keys()].map((y) => costs.get(mid + "," + y) ?? Infinity));
    const fromEnemy = walkCosts(a, sp.enemy[0]);
    const stats = {
      walkable: [...Array(rows * cols).keys()].filter((i) => walkable(a, i % cols, Math.floor(i / cols))).length,
      maxHeight: Math.max(...a.height.join("").split("").map(Number)),
      ledges: ledges(a).length,
      playerToMid: toMid(fromPlayer), enemyToMid: toMid(fromEnemy),
      spawnHeights: [H(a, ...sp.player[0]), H(a, ...sp.enemy[0])],
    };
    if (!opts.skipFairness) {
      if (Math.abs(stats.playerToMid - stats.enemyToMid) > R.fairness.maxCostGap)
        errors.push(`unfair approach: player ${stats.playerToMid} vs enemy ${stats.enemyToMid} moves to the centre`);
      if (Math.abs(stats.spawnHeights[0] - stats.spawnHeights[1]) > R.fairness.maxSpawnHeightGap)
        errors.push(`unfair spawn heights ${stats.spawnHeights.join(" vs ")}`);
    }
    return { ok: errors.length === 0, errors, stats };
  }

  // ── composition ─────────────────────────────────────────────────────────
  function compose(west, center, east) {
    const map = west.map.map((r, y) => r + center.map[y] + east.map[y]);
    const height = west.height.map((r, y) => r + center.height[y] + east.height[y]);
    const off = west.map[0].length + center.map[0].length;
    const structures = [];
    [[west, 0], [center, west.map[0].length], [east, off]].forEach(([p, dx]) =>
      (p.structures || []).forEach((st) => structures.push({ ...st, tiles: st.tiles.map((t) => ({ ...t, x: t.x + dx })) })));
    return {
      map, height,
      spawns: { player: [west.spawns[0]], enemy: east.spawns.map(([x, y]) => [x + off, y]) },
      structures: structures.map((st, i) => ({ id: "s" + (i + 1), ...st })),
    };
  }

  const byId = Object.fromEntries(D.parts.map((p) => [p.id, p]));
  function partsOf(archetype, slot) { return D.parts.filter((p) => p.archetype === archetype && p.slot === slot); }

  // generate({ seed, archetype?, layout? }) → arena { name, map, height, spawns, parts, ... }
  function generate(opts = {}) {
    const seed = (opts.seed ?? 0) >>> 0;
    const rand = mulberry32(seed);
    const archetype = opts.archetype || pick(rand, Object.keys(D.archetypes).filter((k) => D.archetypes[k].generated !== false));   // never an authored-only interior (the ship)
    const blend = D.archetypes[archetype].blend;
    let lastErrors = [];
    for (let attempt = 0; attempt < R.attempts; attempt++) {
      const layout = opts.layout || weighted(rand, D.layouts);
      const center = pick(rand, partsOf(archetype, "center"));          // the centre always shows the archetype
      let west = pick(rand, partsOf(weighted(rand, blend), "side"));
      if (rand() < 0.5) west = flipY(west);
      let east;
      if (layout === "mirror") east = mirrorX(west);
      else {
        let other = pick(rand, partsOf(weighted(rand, blend), "side"));
        if (other.id === west.id) other = pick(rand, partsOf(archetype, "side"));
        if (rand() < 0.5) other = flipY(other);
        east = mirrorX(other);
      }
      const c = rand() < 0.5 ? flipY(center) : center;
      const arena = compose(west, c, east);
      const v = validate(arena);
      if (!v.ok) { lastErrors = v.errors; continue; }
      const used = [west, c, east];
      return {
        ...arena,
        name: `${D.archetypes[archetype].name} · ${used.map((p) => p.name).join(" / ")}`,
        archetype, layout, seed, attempt,
        parts: used.map((p) => ({ id: p.id, archetype: p.archetype, mirrored: !!p.mirrored, flipped: !!p.flipped })),
        archetypesUsed: [...new Set(used.map((p) => p.archetype))],
        stats: v.stats, generated: true,
        // the isometric look, derived from the seed so the same map looks the same every battle (no catalog id, no features)
        ...(D.isoPalettes?.[archetype] ? { visual: { style: "isometric", seed: seed >>> 0, lighting: "day", palette: D.isoPalettes[archetype], features: [] } } : {}),
      };
    }
    // Every attempt failed: fall back to the designed arena of this archetype (never a broken map).
    const designed = Object.entries(D.arenas).find(([, a]) => a.archetype === archetype);
    return { ...designed[1], id: designed[0], archetype, seed, fallback: true, fallbackErrors: lastErrors, generated: false };
  }

  // Projection for the current flat engine (tiles . ~ #) until height lands in engine P1.
  function toLegacy(a) {
    return { name: a.name, map: a.map.map((r, y) => r.split("").map((ch, x) => (objectAt(a, x, y)?.blocksMove ? "#" : D.legacyChar[ch] || ".")).join("")), note: "Flat projection: heights, hedges, water and hazards are ignored until terrain P1." };
  }

  function designed(id) {
    const a = D.arenas[id];
    return { id, ...a, structures: (a.structures || []).map((st, i) => ({ id: "s" + (i + 1), ...st })) };
  }

  return {
    generate, validate, compose, mirrorX, flipY, toLegacy, designed,
    walkCosts, stepCost, ledges, objectAt, parts: D.parts, byId, archetypes: D.archetypes, arenas: D.arenas, terrain: D.terrain, rules: R,
  };
});
