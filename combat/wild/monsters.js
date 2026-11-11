"use strict";
// Wild monsters: pure rules over a world snapshot. Destined for ~/loci/web/combat/wild/.
//
//   world = {
//     seed, round,
//     arena: { map, height, objects, structures, archetype },     // terrain modules' arena shape
//     units: [{ id, side, x, y, lf, maxLF, defeated }],            // every non-wild combatant
//     wild:  [ monster entries (see spawn()) ],
//     wet: { "x,y": untilRound }, treated: [objectId], bait: [{ x, y, untilRound }],
//     recent: { groundStrikesOnFuel, cisternBursts: [[x,y]], bridgeCollapsesOverWater: [[x,y]] }   // this round's triggers
//   }
//
//   useItem(world, item, at)  → { world, events }   (player or AI spends an item)
//   telegraph(world)          → [{ id, kind, text, tiles }]  public intents shown at round start
//   environmentPhase(world)   → { world, events }   runs after every owner turn: act, spread, flee, appear
//
// Every roll is seeded from (seed, round, monster id, tag). Unit damage is applied to world.units
// AND returned as events ({ kind: "wildHit", target, damage, channel, push }) for the engine to
// apply and log. Wild monsters hurt every side; they never hurt each other.
// Terrain modules live in ../terrain/ once this sits in ~/loci/web/combat/wild/; while staged
// elsewhere, set LOCI_TERRAIN to that folder (with a trailing slash).
const TERRAIN = typeof module === "object" && module.exports ? (process.env.LOCI_TERRAIN || "../terrain/") : "";
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./monsters-data.js"), require(TERRAIN + "mapgen.js"), require(TERRAIN + "vegetation.js"), require(TERRAIN + "structures.js"), require(TERRAIN + "terrain-data.js"));
  else root.ConceptCombatWild = factory(root.ConceptCombatWildData, root.ConceptCombatMapgen, root.ConceptCombatVegetationRules, root.ConceptCombatStructures, root.ConceptCombatTerrain);
})(typeof self !== "undefined" ? self : this, function (W, G, VR, S, D) {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const K = (x, y) => x + "," + y, P = (k) => k.split(",").map(Number);
  const inside = (a, x, y) => y >= 0 && y < a.map.length && x >= 0 && x < a.map[0].length;
  const man = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
  const clone = (w) => JSON.parse(JSON.stringify(w));

  // FNV-1a over the key, then murmur3's fmix32 finalizer. Without the finalizer, keys that differ
  // only in their last characters (neighbouring tiles) give nearly identical rolls.
  function roll(w, id, tag) {
    let h = 2166136261;
    for (const c of `${w.seed}:${w.round}:${id}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const living = (w) => w.units.filter((u) => !u.defeated && u.lf > 0);
  const isGaia = (u) => !!u?.gaia;   // boss Gaia, tagged by wildSnapshot (Mala, 2026-10-18: wilds never attack her)
  const prey = (w) => living(w).filter((u) => !isGaia(u));   // candidate victims: Gaia is never one (bead beasts are actors, not wilds, so the bead exception is automatic)
  const biteAt = (w, x, y) => { const u = unitAt(w, x, y); return u && !isGaia(u) ? u : null; };   // strikes skip her tile; movement blocking still uses unitAt
  const unitAt = (w, x, y) => living(w).find((u) => u.x === x && u.y === y) || null;
  const wildAt = (w, x, y) => w.wild.find((m) => m.form === "unit" && m.x === x && m.y === y) || null;
  const objAt = (w, x, y) => (w.arena.objects || []).find((o) => o.x === x && o.y === y) || null;
  const walkable = (w, x, y) => inside(w.arena, x, y) && !D.terrain[w.arena.map[y][x]].blocksMove && !(objAt(w, x, y) || {}).blocksMove;

  // Cheapest walking route for a monster (terrain step costs; units and other monsters block).
  // deepWater (kraken, 2026-11-05): pools ("~") are unwalkable ground to everything else, but a deep
  // swimmer treats them as water at the shallow cost.
  function route(w, from, isGoal, budget = 99, onlyWater = false, deepWater = false) {
    const wet = (x, y) => ["w", "~"].includes(w.arena.map[y]?.[x]);
    const dist = new Map([[K(...from), 0]]), prev = new Map(), done = new Set();
    for (;;) {
      let best = null;
      for (const [k, d] of dist) if (!done.has(k) && (!best || d < best[1])) best = [k, d];
      if (!best) return null;
      const [k, d] = best; done.add(k);
      const [x, y] = P(k);
      if (k !== K(...from) && isGoal(x, y)) { const path = [[x, y]]; let c = k; while (prev.has(c)) { c = prev.get(c); path.unshift(P(c)); } return { path, cost: d }; }
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, nk = K(nx, ny);
        const goal = isGoal(nx, ny);
        if (onlyWater && !wet(nx, ny)) continue;   // the porgy never beaches: water tiles only
        if (!goal && (unitAt(w, nx, ny) || wildAt(w, nx, ny))) continue;
        const c = goal && (unitAt(w, nx, ny) || objAt(w, nx, ny)) ? 1 : deepWater && w.arena.map[ny]?.[nx] === "~" ? 2 : G.stepCost(w.arena, x, y, nx, ny);
        if (c == null || d + c > budget) continue;
        if (!dist.has(nk) || d + c < dist.get(nk)) { dist.set(nk, d + c); prev.set(nk, k); }
      }
    }
  }

  const waterTiles = (w) => { const out = []; w.arena.map.forEach((r, y) => [...r].forEach((c, x) => { if (["w", "~"].includes(c)) out.push([x, y]); })); return out; };
  function spawn(w, kind, at, reason, metadata = {}) {
    const def = W.monsters[kind]; w.spawnCounts ||= {};
    const serial = (w.spawnCounts[kind] || 0) + 1; w.spawnCounts[kind] = serial;
    const id = `wild-${kind}-${w.round}-${serial}`;
    const m = { id, kind, form: def.form, name: def.name, reason, born: w.round, ...metadata };
    if (def.form === "unit") Object.assign(m, { x: at[0], y: at[1], lf: def.lf, maxLF: def.lf, status: {}, ...(def.sprite ? { sprite: def.sprite } : {}) });
    if (kind === "gaia") { m.target = w.gaiaProvokedBy || null; w.gaiaInvoked = true; w.gaiaAwakeningPending = false; }
    if (kind === "moa") m.nest = at.slice();   // it marks its nest where it appears
    if (kind === "sasquatch") { m.home = at.slice(); m.traits = (def.traits || []).slice(); }   // its ground, and its genius
    if (kind === "kraken") m.traits = (def.traits || []).slice();   // swimmer follows it into a tame (no drowning)
    if (def.form === "front") Object.assign(m, { x: at[0], y: at[1], strength: def.strength });
    if (def.form === "field") m.tiles = { [K(...at)]: 0 };
    w.wild.push(m);
    return { kind: "wildAppear", id, monster: kind, at, text: `${def.name} appears at (${at.join(",")}): ${reason}.` };
  }
  function summonMonster(world, kind, at, { summonerId = null, reason = "called by a Believer" } = {}) {
    const w = clone(world), def = W.monsters[kind];
    if (!def || def.form !== "unit") return { world: w, events: [], error: "Only unit-form monsters can be summoned." };
    if (!canAppear(w, kind)) return { world: w, events: [], error: "That monster is already present or the wild side is full." };
    if (!Array.isArray(at) || !walkable(w, at[0], at[1]) || unitAt(w, at[0], at[1]) || wildAt(w, at[0], at[1]))
      return { world: w, events: [], error: "Choose an open, walkable tile for the monster." };
    if (def.waterOnly && !["w", "~"].includes(w.arena.map[at[1]]?.[at[0]]))
      return { world: w, events: [], error: `The ${def.name.toLowerCase()} must be called into water.` };
    const event = spawn(w, kind, at, reason, { summoned: true, summonerId, side: "wild" });
    return { world: w, events: [event] };
  }
  const active = (w, kind) => w.wild.find((m) => m.kind === kind);
  const canAppear = (w, kind) => W.monsters[kind]?.ready !== false && !active(w, kind) && w.wild.length < W.rules.maxActive;   // ready: false waits for its art

  function edgeTileNear(w, [tx, ty], salt = null) {
    // Anchored spawns (bait, Gaia's provoker: no salt) stay nearest by design.
    // Ambient spawns pass a kind salt and draw uniformly from eligible edge tiles (seeded).
    const open = [];
    const h = w.arena.map.length, wd = w.arena.landW ?? w.arena.map[0].length;   // wilds spawn on the land, never the astral pocket
    for (let y = 0; y < h; y++) for (let x = 0; x < wd; x++) {
      if (x && y && x < wd - 1 && y < h - 1) continue;
      if (!walkable(w, x, y) || unitAt(w, x, y) || wildAt(w, x, y)) continue;
      open.push([x, y]);
    }
    if (!open.length) return null;
    if (salt == null) {
      let best = null;
      for (const [x, y] of open) {
        const d = man(x, y, tx, ty);
        if (!best || d < best.d || (d === best.d && K(x, y) < K(...best.at))) best = { d, at: [x, y] };
      }
      return best && best.at;
    }
    return open[Math.floor(roll(w, salt, "edge") * open.length)];
  }
  function isFuel(w, x, y) {
    if (!inside(w.arena, x, y) || (w.wet[K(x, y)] ?? -1) >= w.round) return 0;
    if ((w.dams || []).includes(K(x, y)) || (w.gardens || []).includes(K(x, y))) return 0;
    const def = W.monsters.brushfire, o = objAt(w, x, y);
    if (o && !o.protected && def.objectFuel[o.material]) return def.objectFuel[o.material];
    return def.fuel[w.arena.map[y][x]] || 0;
  }

  // ── items ────────────────────────────────────────────────────────────────
  function useItem(world, item, at) {
    const w = clone(world), events = [{ kind: "item", item, at, text: `${W.items[item].name} used at (${(at || []).join(",")}).` }];
    if (item === "flare") {
      if (!isFuel(w, ...at)) events.push({ kind: "note", text: "Nothing there will burn." });
      else if (active(w, "brushfire")) active(w, "brushfire").tiles[K(...at)] = 0, events.push({ kind: "note", text: "The fire takes a new front." });
      else if (canAppear(w, "brushfire")) events.push(spawn(w, "brushfire", at, "a flare lands in dry fuel"));
    } else if (item === "bait") {
      w.bait.push({ x: at[0], y: at[1], untilRound: w.round + 2 });
      if (canAppear(w, "feralPig")) { const e = edgeTileNear(w, at); if (e) events.push(spawn(w, "feralPig", e, "drawn by the bait")); }
    } else if (item === "rainStick") {
      if (canAppear(w, "flashFlood")) {
        let best = null;
        w.arena.map.forEach((r, y) => [...r].forEach((_, x) => { if (x < (w.arena.landW ?? r.length) && walkable(w, x, y) && !unitAt(w, x, y)) { const hh = +w.arena.height[y][x]; if (!best || hh > best.h) best = { h: hh, at: [x, y] }; } }));
        if (best) events.push(spawn(w, "flashFlood", best.at, "a downpour gathers on the high ground"));
      }
    } else if (item === "waterCan") {
      for (const [dx, dy] of [[0, 0], ...DIRS]) {
        const x = at[0] + dx, y = at[1] + dy; if (!inside(w.arena, x, y)) continue;
        w.wet[K(x, y)] = w.round + 3;
        const f = active(w, "brushfire"); if (f && K(x, y) in f.tiles) { delete f.tiles[K(x, y)]; events.push({ kind: "fireOut", at: [x, y], text: `Fire doused at (${x},${y}).` }); }
      }
    } else if (item === "borate") {
      const o = objAt(w, ...at) || null;
      const st = S.bridgeAt(w.arena, ...at);
      if (o) w.treated.push(o.id); if (st) w.treated.push(st.id);
      for (const m of w.wild.filter((m) => m.kind === "termites" && man(m.x, m.y, ...at) <= 1)) { m.fleeing = "borate"; }
    } else if (item === "noisemaker") {
      for (const m of w.wild.filter((m) => m.form === "unit" && man(m.x, m.y, ...at) <= 4)) m.fleeing = "startled";
    }
    return { world: w, events: events.concat(fleeing(w)) };
  }

  // ── telegraph (public intent, shown at round start) ─────────────────────
  const edible = (w) => (w.arena.objects || []).filter((o) => o.kind === "plant" && o.hp > 0 && !o.dead && !o.protected);
  // ── the food web (Wild Food Web W1, claude-wild-food-web-spec; Mala R-20261108-01) ──
  // A kind with `eats` hunts the wild kinds it lists before people (D1); prey runs from what eats it (scatter); a kill
  // leaves the hunter eating for rules.hunt.fedRounds rounds (D2). Wild-on-wild damage goes through hurtIn, the same
  // body hurtMonster uses. Grudges stay with the kinds that have them (the caterpillar, the Sasquatch): neither hunts.
  const HUNT = () => W.rules.hunt || {};
  const wildLive = (w) => w.wild.filter((x) => x.form === "unit" && !x.done && !x.fleeing && x.lf > 0);
  const eating = (w, m) => !!m.fed && w.round <= m.fed.until;
  const preyName = (kind) => W.monsters[kind].name.toLowerCase();
  const strikeOf = (def) => def.bite ?? def.peck ?? def.slam ?? def.ram ?? def.kick ?? def.nip ?? def.strike ?? def.sting ?? 0;
  const threatsTo = (w, m) => { const mine = W.monsters[m.kind]; return wildLive(w).filter((h) => h !== m && !eating(w, h)
    && (W.monsters[h.kind].eats?.[m.kind] || (mine.fears || []).includes(h.kind)) && man(h.x, h.y, m.x, m.y) <= (HUNT().fearRange ?? 4)); };
  function huntFor(w, m) {
    const def = W.monsters[m.kind]; if (!def.eats || eating(w, m)) return null;
    const reach = def.seekPrey ?? def.seekUnits ?? HUNT().seekRange ?? 6,   // seekPrey (W2): a kind that hunts farther than it bothers people (the flock)
      d = (p) => man(p.x, p.y, m.x, m.y);
    const meals = wildLive(w).filter((p) => p !== m && def.eats[p.kind] && d(p) <= reach)
      .sort((a, b) => def.eats[b.kind] / d(b) - def.eats[a.kind] / d(a) || (a.id < b.id ? -1 : 1));
    for (const p of meals) {
      if (d(p) === 1) return { wild: p.id, tile: [m.x, m.y], why: `the ${preyName(p.kind)}` };
      const r = route(w, [m.x, m.y], (x, y) => man(x, y, p.x, p.y) === 1 && !unitAt(w, x, y) && !wildAt(w, x, y), 99, !!def.waterOnly, !!def.deepWater);
      if (r) return { wild: p.id, tile: r.path[r.path.length - 1], why: `the ${preyName(p.kind)}` };
    }
    return null;
  }
  function targetFor(w, m) {
    const def = W.monsters[m.kind];
    if (eating(w, m)) return null;
    { const h = huntFor(w, m); if (h) return h; }
    if (m.kind === "gaia") {
      let unit = living(w).find(u => u.id === m.target && !isGaia(u));
      if (!unit) unit = prey(w).slice().sort((a, b) => man(a.x, a.y, m.x, m.y) - man(b.x, b.y, m.x, m.y) || (a.id < b.id ? -1 : 1))[0];
      return unit ? { unit: unit.id, tile: [unit.x, unit.y], why: unit.id === m.target ? "the earthworker" : "the nearest body" } : null;
    }
    if (m.kind === "feralPig") {
      const bait = w.bait.find((b) => b.untilRound >= w.round && man(b.x, b.y, m.x, m.y) <= def.baitRange);
      if (bait) return { tile: [bait.x, bait.y], why: "the bait" };
      const r = route(w, [m.x, m.y], (x, y) => { const u = unitAt(w, x, y); return !!u && !isGaia(u); });
      return r ? { unit: unitAt(w, ...r.path[r.path.length - 1]).id, tile: r.path[r.path.length - 1], why: "the nearest body" } : null;
    }
    if (m.kind === "nettleCaterpillar") {
      if (m.curled) return null;                                         // curled up: it goes nowhere
      const foe = m.hostile && living(w).find((u) => u.id === m.hostile.target && !isGaia(u));
      if (foe) return { unit: foe.id, tile: [foe.x, foe.y], why: "whoever hurt it" };
      const walking = living(w).filter((u) => !isGaia(u) && u.plant && man(u.x, u.y, m.x, m.y) <= def.seekPlants).sort((a, b) => man(a.x, a.y, m.x, m.y) - man(b.x, b.y, m.x, m.y) || (a.id < b.id ? -1 : 1))[0];
      if (walking) return { unit: walking.id, tile: [walking.x, walking.y], why: "the plant that walks" };
      const plants = edible(w).filter((o) => man(o.x, o.y, m.x, m.y) <= def.seekPlants);
      plants.sort((a, b) => (def.hosts.includes(b.type) - def.hosts.includes(a.type)) || man(a.x, a.y, m.x, m.y) - man(b.x, b.y, m.x, m.y) || (a.id < b.id ? -1 : 1));
      return plants.length ? { object: plants[0].id, tile: [plants[0].x, plants[0].y], why: VR.label(plants[0]) } : null;
    }
    if (m.kind === "ducks") {   // the nearest body within reach, else home to the water
      const u = prey(w).filter((u) => man(u.x, u.y, m.x, m.y) <= def.seekUnits).sort((a, b) => man(a.x, a.y, m.x, m.y) - man(b.x, b.y, m.x, m.y) || (a.id < b.id ? -1 : 1))[0];
      if (u) return { unit: u.id, tile: [u.x, u.y], why: "the nearest body" };
      const water = waterTiles(w).filter(([x, y]) => man(x, y, m.x, m.y) <= def.seekWater && !(x === m.x && y === m.y)).sort((a, b) => man(a[0], a[1], m.x, m.y) - man(b[0], b[1], m.x, m.y))[0];
      return water ? { tile: water, why: "the water" } : null;
    }
    if (m.kind === "porgy") {   // the nearest body it can swim to (a water tile beside it), else drift to nearby water
      const wet = (x, y) => ["w", "~"].includes(w.arena.map[y]?.[x]);
      const open = ([x, y]) => inside(w.arena, x, y) && !unitAt(w, x, y) && !wildAt(w, x, y);
      const u = prey(w).filter((u) => man(u.x, u.y, m.x, m.y) <= def.seekUnits).sort((a, b) => man(a.x, a.y, m.x, m.y) - man(b.x, b.y, m.x, m.y) || (a.id < b.id ? -1 : 1))[0];
      if (u) {
        if (wet(u.x, u.y)) return { unit: u.id, tile: [u.x, u.y], why: "the nearest body" };
        const shore = DIRS.map(([dx, dy]) => [u.x + dx, u.y + dy]).filter(([x, y]) => wet(x, y) && open([x, y])).sort((a, b) => man(a[0], a[1], m.x, m.y) - man(b[0], b[1], m.x, m.y))[0];
        if (shore) return { unit: u.id, tile: shore, why: "the nearest body" };
      }
      const drift = waterTiles(w).filter(([x, y]) => !(x === m.x && y === m.y) && open([x, y]) && man(x, y, m.x, m.y) <= def.move * 3).sort((a, b) => man(a[0], a[1], m.x, m.y) - man(b[0], b[1], m.x, m.y))[0];
      return drift ? { tile: drift, why: "open water" } : null;
    }
    if (m.kind === "kraken") {   // the porgy's hunt at kraken scale: nearest body it can swim to, else drift the deep
      const wet = (x, y) => ["w", "~"].includes(w.arena.map[y]?.[x]);
      const open = ([x, y]) => inside(w.arena, x, y) && !unitAt(w, x, y) && !wildAt(w, x, y);
      for (const u of prey(w).filter((u) => man(u.x, u.y, m.x, m.y) <= def.seekUnits).sort((a, b) => man(a.x, a.y, m.x, m.y) - man(b.x, b.y, m.x, m.y) || (a.id < b.id ? -1 : 1))) {
        if (wet(u.x, u.y)) return { unit: u.id, tile: [u.x, u.y], why: "the nearest body" };
        const shore = DIRS.map(([dx, dy]) => [u.x + dx, u.y + dy]).filter(([x, y]) => wet(x, y) && open([x, y])).sort((a, b) => man(a[0], a[1], m.x, m.y) - man(b[0], b[1], m.x, m.y))[0];
        if (shore) return { unit: u.id, tile: shore, why: "the nearest body" };
      }
      const drift = waterTiles(w).filter(([x, y]) => !(x === m.x && y === m.y) && open([x, y]) && man(x, y, m.x, m.y) <= def.move * 3).sort((a, b) => man(a[0], a[1], m.x, m.y) - man(b[0], b[1], m.x, m.y))[0];
      return drift ? { tile: drift, why: "the deep water" } : null;
    }
    if (m.kind === "chicken") {   // W2: no pest in reach (huntFor above), it pecks at a body that comes close; else it scratches about
      const u = prey(w).filter((u) => man(u.x, u.y, m.x, m.y) <= def.seekUnits).sort((a, b) => man(a.x, a.y, m.x, m.y) - man(b.x, b.y, m.x, m.y) || (a.id < b.id ? -1 : 1))[0];
      return u ? { unit: u.id, tile: [u.x, u.y], why: "the nearest body" } : null;
    }
    if (m.kind === "wolf") {   // the straggler: fewest of its own side within 2, then nearest
      const near = (u) => living(w).filter((v) => v.id !== u.id && v.side === u.side && man(v.x, v.y, u.x, u.y) <= 2).length;
      const u = prey(w).filter((u) => man(u.x, u.y, m.x, m.y) <= def.seekUnits).sort((a, b) => near(a) - near(b) || man(a.x, a.y, m.x, m.y) - man(b.x, b.y, m.x, m.y) || (a.id < b.id ? -1 : 1))[0];
      return u ? { unit: u.id, tile: [u.x, u.y], why: "the straggler" } : null;
    }
    if (m.kind === "moa") {   // anyone inside the nest circle; else back to the nest
      const nest = m.nest || [m.x, m.y];
      const u = prey(w).filter((u) => man(u.x, u.y, nest[0], nest[1]) <= def.nestRadius).sort((a, b) => man(a.x, a.y, m.x, m.y) - man(b.x, b.y, m.x, m.y) || (a.id < b.id ? -1 : 1))[0];
      if (u) return { unit: u.id, tile: [u.x, u.y], why: "the intruder at its nest" };
      return m.x === nest[0] && m.y === nest[1] ? null : { tile: nest.slice(), why: "its nest" };
    }
    if (m.kind === "sasquatch") {   // docile until provoked: hurt, or an intruder on its home ground
      const grudge = m.provoked && living(w).find((u) => u.id === m.target);   // the one who tried to collar it, wherever they go
      if (grudge) return { unit: grudge.id, tile: [grudge.x, grudge.y], why: "the one who tried to tame it" };
      const home = m.home || [m.x, m.y], hurt = m.lf < m.maxLF;
      const near = (u) => man(u.x, u.y, m.x, m.y);
      const intruder = prey(w).filter((u) => man(u.x, u.y, home[0], home[1]) <= def.territory).sort((a, b) => near(a) - near(b) || (a.id < b.id ? -1 : 1))[0];
      if (hurt || intruder) {
        const u = intruder || prey(w).filter((v) => near(v) <= def.seekUnits).sort((a, b) => near(a) - near(b) || (a.id < b.id ? -1 : 1))[0];
        if (u) return { unit: u.id, tile: [u.x, u.y], why: intruder ? "the intruder on its ground" : "the one that hurt it" };
      }
      return m.x === home[0] && m.y === home[1] ? null : { tile: home.slice(), why: "its ground" };
    }
    if (m.kind === "termites") {
      const wood = (w.arena.objects || []).filter((o) => o.material === "wood" && !o.protected && !w.treated.includes(o.id) && man(o.x, o.y, m.x, m.y) <= def.seekWood);
      wood.sort((a, b) => man(a.x, a.y, m.x, m.y) - man(b.x, b.y, m.x, m.y) || (a.id < b.id ? -1 : 1));
      if (wood.length) return { object: wood[0].id, tile: [wood[0].x, wood[0].y], why: "wood" };
      const u = prey(w).filter((u) => man(u.x, u.y, m.x, m.y) <= def.seekUnits).sort((a, b) => man(a.x, a.y, m.x, m.y) - man(b.x, b.y, m.x, m.y) || (a.id < b.id ? -1 : 1))[0];
      return u ? { unit: u.id, tile: [u.x, u.y], why: "the nearest body" } : null;
    }
    return null;
  }
  function telegraph(w) {
    return w.wild.map((m) => {
      const def = W.monsters[m.kind];
      if (m.form === "unit" && eating(w, m)) return { id: m.id, kind: m.kind, tiles: [], text: `${def.name} is eating.` };
      if (m.form === "unit") { const t = targetFor(w, m); return { id: m.id, kind: m.kind, tiles: t ? [t.tile] : [], text: t ? `${def.name} is heading for ${t.why} at (${t.tile.join(",")}).` : `${def.name} is wandering.` }; }
      if (m.form === "front") { const path = floodPath(w, m); return { id: m.id, kind: m.kind, tiles: path, text: `${def.name} will run ${path.length} tile${path.length === 1 ? "" : "s"} downhill.` }; }
      const front = frontier(w, m); return { id: m.id, kind: m.kind, tiles: front.map((f) => f.at), text: `${def.name} can spread to ${front.length} tile${front.length === 1 ? "" : "s"}.` };
    });
  }

  // ── behaviours ───────────────────────────────────────────────────────────
  // TS-01 listed-site (wild shoves incl. flood push): a big awakened body moves whole or braces. Mirrors battle-side footOpen: anchor pre-checked by the caller, the rest of the w×h block must be walkable with no other unit or wild. (Wild space has no barriers, same as single-tile pushes today.)
  const footFits = (w, u, nx, ny) => {
    const sw = u.size?.w || 1, sh = u.size?.h || 1;
    for (let dy = 0; dy < sh; dy++) for (let dx = 0; dx < sw; dx++) {
      if (!dx && !dy) continue;
      const occ = unitAt(w, nx + dx, ny + dy);
      if (!walkable(w, nx + dx, ny + dy) || wildAt(w, nx + dx, ny + dy) || (occ && occ.id !== u.id)) return false;
    }
    return true;
  };
  function damageUnit(w, u, dmg, channel, from, events, push = 0, text = "", sourceKind = null, sourceId = null) {
    if (dmg > 0 && (u.traits || []).includes("denseMuscle") && channel !== "albedo") { dmg = Math.round(dmg * 0.8); text = `${text} Dense muscle turns some of it.`; }   // wild-side Dense Muscle (no piercing quality out here; albedo still punches through)
    u.lf = Math.max(0, u.lf - dmg); if (u.lf === 0) u.defeated = true;
    let pushTo = null;
    if (push && !u.defeated) {
      const dx = Math.sign(u.x - from[0]), dy = Math.sign(u.y - from[1]);
      const [sx, sy] = Math.abs(u.x - from[0]) >= Math.abs(u.y - from[1]) ? [dx, 0] : [0, dy];
      const nx = u.x + sx * push, ny = u.y + sy * push;
      if (walkable(w, nx, ny) && !unitAt(w, nx, ny) && !wildAt(w, nx, ny)) {
        if (u.awakened && ((u.size?.w || 1) > 1 || (u.size?.h || 1) > 1) && !footFits(w, u, nx, ny)) text = `${text} ${u.id} braces: its whole body would not fit at (${nx},${ny}).`;
        else { u.x = nx; u.y = ny; pushTo = [nx, ny]; }
      }
    }
    events.push({ kind: "wildHit", actor: sourceId, target: u.id, from: from.slice(), damage: dmg, channel, push: pushTo, sourceKind, ...(W.monsters[sourceKind] ? { monster: W.monsters[sourceKind].name } : {}), text: `${text} ${u.id} takes ${dmg}${pushTo ? ` and is pushed to (${pushTo.join(",")})` : ""}.`.trim() });
  }

  // Prey within fear range of something that eats it moves away, as far as its move allows; cornered (no step farther away), it acts as usual.
  function scatter(w, m, events) {
    const def = W.monsters[m.kind], threats = threatsTo(w, m); if (!threats.length || m.curled) return false;
    const gap = (x, y) => Math.min(...threats.map((h) => man(h.x, h.y, x, y)));
    const wet = (x, y) => ["w", "~"].includes(w.arena.map[y]?.[x]);
    const from = [m.x, m.y]; let budget = def.move, moved = false;
    for (;;) {
      const opts = DIRS.map(([dx, dy]) => [m.x + dx, m.y + dy]).filter(([x, y]) => inside(w.arena, x, y) && !unitAt(w, x, y) && !wildAt(w, x, y)
        && (def.waterOnly ? wet(x, y) : walkable(w, x, y)) && gap(x, y) > gap(m.x, m.y))
        .map(([x, y]) => ({ x, y, c: def.deepWater && w.arena.map[y]?.[x] === "~" ? 2 : G.stepCost(w.arena, m.x, m.y, x, y) }))
        .filter((o) => o.c != null && o.c <= budget).sort((a, b) => gap(b.x, b.y) - gap(a.x, a.y) || (K(a.x, a.y) < K(b.x, b.y) ? -1 : 1));
      if (!opts.length) break;
      budget -= opts[0].c; m.x = opts[0].x; m.y = opts[0].y; moved = true;
    }
    if (!moved) return false;
    const near = threats.slice().sort((a, b) => man(a.x, a.y, from[0], from[1]) - man(b.x, b.y, from[0], from[1]))[0];
    events.push({ kind: "wildMove", id: m.id, from, to: [m.x, m.y], target: null, targetTile: [m.x, m.y], text: `${def.name} moves to (${m.x},${m.y}).` },   // the walk the battle screen animates (ui.js reads wildMove from/to)
      { kind: "wildScatter", id: m.id, from, to: [m.x, m.y], threat: near.id, text: `${def.name} scatters from the ${preyName(near.kind)}.` });
    return true;
  }
  function actUnit(w, m, events) {
    if (m.fed) { if (eating(w, m)) return; delete m.fed; }   // a fed hunter rests on its kill (D2), then hunts again
    if (scatter(w, m, events)) return;
    const def = W.monsters[m.kind], t = targetFor(w, m);
    if (m.kind === "nettleCaterpillar") {
      m.curled = m.lf <= def.curlBelow * m.maxLF;
      if (m.hostile && (w.round > m.hostile.until || !living(w).some((u) => u.id === m.hostile.target))) { delete m.hostile; events.push({ kind: "wildCalm", id: m.id, text: "The caterpillar settles and goes back to feeding." }); }
      const foe = !m.curled && m.hostile && living(w).find((u) => u.id === m.hostile.target && !isGaia(u));
      if (foe && man(foe.x, foe.y, m.x, m.y) > 1 && man(foe.x, foe.y, m.x, m.y) <= def.spitRange) {   // hostile and in range: it spits instead of closing
        damageUnit(w, foe, def.spit, def.channel, [m.x, m.y], events, 0, "The caterpillar spits:", m.kind, m.id);
        events[events.length - 1].ranged = true;                        // not contact: no poison
        return;
      }
      if (!t) {   // nothing to walk to (or curled): it still stings whatever is beside it
        const near = DIRS.map(([dx, dy]) => biteAt(w, m.x + dx, m.y + dy)).filter(Boolean).sort((a, b) => (a.id < b.id ? -1 : 1));
        for (const v of m.curled ? near : near.slice(0, 1)) damageUnit(w, v, def.sting, def.channel, [m.x, m.y], events, 0, m.curled ? "Curled tight, its spines burst outward:" : "The caterpillar rears and stings:", m.kind, m.id);
        return;
      }
    }
    if (!t) return;
    const goal = (x, y) => x === t.tile[0] && y === t.tile[1];
    const r = route(w, [m.x, m.y], goal, 99, !!def.waterOnly, !!def.deepWater);
    if (r) {
      const from = [m.x, m.y];
      let budget = def.move, steps = 0;
      for (const [x, y] of r.path.slice(1)) {
        if (goal(x, y) && (unitAt(w, x, y) || objAt(w, x, y)?.blocksMove)) break;    // stop adjacent to a body or solid wood
        const c = def.deepWater && w.arena.map[y]?.[x] === "~" ? 2 : G.stepCost(w.arena, m.x, m.y, x, y) ?? 99; if (c > budget) break;
        budget -= c; m.x = x; m.y = y; steps++;
        if (m.kind === "feralPig" && def.rootsTo[w.arena.map[y][x]]) {
          const ch = def.rootsTo[w.arena.map[y][x]];
          w.arena.map = w.arena.map.map((row, yy) => (yy === y ? row.slice(0, x) + ch + row.slice(x + 1) : row));
          w.disturbed = (w.disturbed || 0) + 1;
        }
        if (goal(x, y)) break;
      }
      if (steps) events.push({ kind: "wildMove", id: m.id, from, to: [m.x, m.y], target: t.unit || t.wild || null, targetTile: t.tile.slice(), text: `${def.name} moves to (${m.x},${m.y}).` });
    }
    if (t.wild) {   // the hunt: one blow at the prey beside it (its own attack × preyMul), and a kill means a meal
      const p = w.wild.find((x) => x.id === t.wild && !x.done && x.lf > 0);
      if (p && man(p.x, p.y, m.x, m.y) === 1) {
        const amount = Math.round(strikeOf(def) * (HUNT().preyMul ?? 2));
        events.push({ kind: "wildHunt", id: m.id, target: p.id, tiles: [[p.x, p.y]], text: `${def.name} goes for the ${preyName(p.kind)}.` });
        hurtIn(w, p, amount, null, events);
        if (p.done) { m.fed = { until: w.round + (HUNT().fedRounds ?? 2), on: p.kind }; events.push({ kind: "wildFed", id: m.id, text: `${def.name} is eating.` }); }
      }
      return;
    }
    // act on whatever is in reach
    if (m.kind === "feralPig") {
      const victim = DIRS.map(([dx, dy]) => biteAt(w, m.x + dx, m.y + dy)).filter(Boolean).sort((a, b) => (a.id === t.unit ? -1 : b.id === t.unit ? 1 : a.id < b.id ? -1 : 1))[0];
      if (victim) {
        damageUnit(w, victim, def.ram, def.channel, [m.x, m.y], events, def.knockback, "The pig rams:", m.kind, m.id);
        m.rams = (m.rams || 0) + 1;
        if (roll(w, m.id, "bolt") < def.skittish) m.fleeing = "bolted after ramming";
      }
    }
    if (m.kind === "nettleCaterpillar") {
      const plant = t.object && [[0, 0], ...DIRS].map(([dx, dy]) => objAt(w, m.x + dx, m.y + dy)).find((o) => o && o.id === t.object);
      if (plant) { const r2 = VR.damageObject(w.arena, plant.id, def.eat, { from: [m.x, m.y] }); w.arena = r2.arena; events.push({ kind: "wildEat", id: m.id, object: plant.id, text: `The caterpillar strips the ${VR.label(plant)}.` }, ...r2.events); }
      // It does not hunt, but whatever is beside it meets the spines: the walking plant it came for first, else one neighbour.
      const victim = DIRS.map(([dx, dy]) => biteAt(w, m.x + dx, m.y + dy)).filter(Boolean).sort((a, b) => (a.id === t.unit ? -1 : b.id === t.unit ? 1 : a.id < b.id ? -1 : 1))[0];
      if (victim) damageUnit(w, victim, def.sting, def.channel, [m.x, m.y], events, 0, victim.id === t.unit ? "The caterpillar bites into the walking plant:" : "The caterpillar rears and stings:", m.kind, m.id);
    }
    if (m.kind === "termites") {
      const wood = [[0, 0], ...DIRS].map(([dx, dy]) => objAt(w, m.x + dx, m.y + dy)).find((o) => o && o.material === "wood" && !o.protected && !w.treated.includes(o.id));
      const bridge = [[0, 0], ...DIRS].map(([dx, dy]) => S.bridgeAt(w.arena, m.x + dx, m.y + dy)).find((b) => b && !w.treated.includes(b.id));
      if (wood) { const r2 = VR.damageObject(w.arena, wood.id, def.eat, { from: [m.x, m.y] }); w.arena = r2.arena; events.push({ kind: "wildEat", id: m.id, object: wood.id, text: `Termites eat into ${VR.label(wood)}.` }, ...r2.events); }
      else if (bridge) { const t2 = bridge.tiles[0]; const r3 = S.groundImpact(w.arena, [[t2.x, t2.y]], def.eat, {}); w.arena = r3.arena; events.push({ kind: "wildEat", id: m.id, text: "Termites eat into the bridge." }, ...r3.events); }
      else { const v = DIRS.map(([dx, dy]) => biteAt(w, m.x + dx, m.y + dy)).find(Boolean); if (v) damageUnit(w, v, def.bite, def.channel, [m.x, m.y], events, 0, "Termites bite:", m.kind, m.id); }
    }
    if (["ducks", "chicken", "wolf", "moa", "porgy"].includes(m.kind)) {   // Muse-2's wild types: one blow at whoever is beside it, its target first
      const hit = { ducks: [def.peck, "The ducks peck:"], chicken: [def.peck, "The chickens peck:"], wolf: [def.bite, "The feral dog bites:"], moa: [def.kick, "The moa kicks:"], porgy: [def.nip, "The porgy nips:"] }[m.kind];
      const victim = DIRS.map(([dx, dy]) => biteAt(w, m.x + dx, m.y + dy)).filter(Boolean).sort((a, b) => (a.id === t.unit ? -1 : b.id === t.unit ? 1 : a.id < b.id ? -1 : 1))[0];
      if (victim) { damageUnit(w, victim, hit[0], def.channel, [m.x, m.y], events, 0, hit[1], m.kind, m.id); if (def.skittish && roll(w, m.id, "bolt:" + w.round) < def.skittish) m.fleeing = "bolted after biting"; }
    }
    if (m.kind === "kraken") {
      const victim = DIRS.map(([dx, dy]) => biteAt(w, m.x + dx, m.y + dy)).filter(Boolean).sort((a, b) => (a.id === t.unit ? -1 : b.id === t.unit ? 1 : a.id < b.id ? -1 : 1))[0];
      if (victim) damageUnit(w, victim, def.slam, def.channel, [m.x, m.y], events, def.knockback, "The kraken slams:", m.kind, m.id);
    }
    if (m.kind === "gaia") {
      const victim = unitAt(w, ...t.tile);
      if (victim && man(m.x, m.y, victim.x, victim.y) === 1)
        damageUnit(w, victim, def.strike, def.channel, [m.x, m.y], events, def.knockback, "Gaia's ground-shaking strike:", m.kind, m.id);
    }
    if (m.kind === "sasquatch" && t.unit) {   // never flees (skittish 0): running afoul of it is harrowing; walking home it lets bystanders be
      const victim = DIRS.map(([dx, dy]) => biteAt(w, m.x + dx, m.y + dy)).filter(Boolean).sort((a, b) => (a.id === t.unit ? -1 : b.id === t.unit ? 1 : a.id < b.id ? -1 : 1))[0];
      const dense = (m.traits || []).includes("denseMuscle");
      if (victim) damageUnit(w, victim, def.strike * (dense ? 2 : 1), def.channel, [m.x, m.y], events, def.knockback, dense ? "The Sasquatch slams (dense muscle ×2):" : "The Sasquatch slams:", m.kind, m.id);
    }
  }

  function floodPath(w, m) {
    const def = W.monsters.flashFlood, path = []; let x = m.x, y = m.y;
    for (let i = 0; i < def.stepsPerRound; i++) {
      const h = +w.arena.height[y][x];
      const opts = DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => inside(w.arena, nx, ny) && walkable(w, nx, ny) && +w.arena.height[ny][nx] <= h && !path.some((p) => p[0] === nx && p[1] === ny) && !(nx === m.x && ny === m.y));
      if (!opts.length) break;
      opts.sort((a, b) => (+w.arena.height[a[1]][a[0]]) - (+w.arena.height[b[1]][b[0]]) || (K(...a) < K(...b) ? -1 : 1));
      [x, y] = opts[0]; path.push([x, y]);
      if ((w.gardens || []).includes(K(x,y))) break;
      if ((w.drains || []).includes(K(x,y))) break;   // graded drainage routes the front no further
    }
    return path;
  }
  function actFlood(w, m, events) {
    const def = W.monsters.flashFlood, path = floodPath(w, m);
    if (!path.length) { m.done = "nowhere lower to run"; return; }
    let prev = [m.x, m.y];
    for (const [x, y] of path) {
      const u = unitAt(w, x, y);
      if (u) damageUnit(w, u, def.damage, def.channel, prev, events, def.shove, "The flood surges:", m.kind, m.id);
      const f = active(w, "brushfire"); if (f && K(x, y) in f.tiles) { delete f.tiles[K(x, y)]; events.push({ kind: "fireOut", at: [x, y], text: `The flood puts out fire at (${x},${y}).` }); }
      w.wet[K(x, y)] = w.round + 3;
      if ((w.dams || []).includes(K(x,y))) { m.strength -= 1; events.push({kind:"wildTerrain",id:m.id,at:[x,y],text:`Check Dam at (${x},${y}) reduces flood strength by 1.`}); }
      if ((w.gardens || []).includes(K(x,y))) { m.done="absorbed by a Rain Garden"; events.push({kind:"wildTerrain",id:m.id,at:[x,y],text:`Rain Garden at (${x},${y}) absorbs the flood front.`}); }
      if ((w.drains || []).includes(K(x,y))) { m.done="routed away by graded drainage"; events.push({kind:"wildTerrain",id:m.id,at:[x,y],text:`Graded drainage at (${x},${y}) routes the flood front away.`}); }
      if (def.absorbOn.includes(w.arena.map[y][x])) m.strength -= 1;
      m.x = x; m.y = y; prev = [x, y];
      if (m.strength <= 0 || m.done) break;
    }
    events.push({ kind: "wildMove", id: m.id, to: [m.x, m.y], text: `The flash flood runs to (${m.x},${m.y}) (strength ${Math.max(0, m.strength)}).` });
    if (m.strength <= 0) m.done = "soaked into permeable ground";
  }

  // Field spread candidates: adjacent tiles with their chance.
  function frontier(w, m) {
    const def = W.monsters[m.kind], out = new Map();
    const row = (W.fields || {})[m.kind] || null, sp = (row && row.spread) || {};
    const shade = sp.shadeSkip ? VR.shadeTiles(w.arena) : new Set();
    const onto = sp.onto || [",", "m"];
    for (const k of Object.keys(m.tiles)) {
      const [x, y] = P(k);
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, nk = K(nx, ny);
        if (!inside(w.arena, nx, ny) || nk in m.tiles || out.has(nk)) continue;
        if (sp.mode === "fuel") {
          const c = isFuel(w, nx, ny) * (def.biomeMul[w.arena.archetype] ?? 1);
          if (c > 0) out.set(nk, { at: [nx, ny], chance: Math.min(1, c) });
        } else {
          const ch = w.arena.map[ny][nx];
          if (!onto.includes(ch) || shade.has(nk) || objAt(w, nx, ny)?.blocksMove) continue;
          const edge = DIRS.some(([ex, ey]) => inside(w.arena, nx + ex, ny + ey) && w.arena.map[ny + ey][nx + ex] !== ch);
          out.set(nk, { at: [nx, ny], chance: edge ? (sp.edgeChance ?? 1) : (sp.openChance ?? 0.6) });
        }
      }
    }
    return [...out.values()].sort((a, b) => (K(...a.at) < K(...b.at) ? -1 : 1));
  }
  function actFire(w, m, events) {
    const def = W.monsters.brushfire;
    // burn what's already burning
    for (const k of Object.keys(m.tiles)) {
      const [x, y] = P(k);
      if ((w.gardens || []).includes(k)) { delete m.tiles[k]; events.push({kind:"fireOut",at:[x,y],text:`Rain Garden extinguishes fire at (${x},${y}).`}); continue; }
      const u = unitAt(w, x, y); if (u) damageUnit(w, u, def.damage, def.channel, [x, y], events, 0, "Fire:", m.kind, m.id);
      const o = objAt(w, x, y);
      if (o && !o.protected && o.maxHp) { const r = VR.damageObject(w.arena, o.id, def.objectDamage, { from: [x - 1, y], channel: "citrinitas" }); w.arena = r.arena; events.push(...r.events); }
      m.tiles[k] += 1;
    }
    // spread
    for (const f of frontier(w, m)) if (roll(w, m.id, "spread:" + K(...f.at)) < f.chance) { m.tiles[K(...f.at)] = 0; events.push({ kind: "fireSpread", at: f.at, text: `Fire spreads to (${f.at.join(",")}).` }); }
    // burn out
    for (const [k, n] of Object.entries(m.tiles)) if (n >= def.burnRounds) {
      delete m.tiles[k]; const [x, y] = P(k);
      if (def.fuel[w.arena.map[y][x]]) w.arena.map = w.arena.map.map((row, yy) => (yy === y ? row.slice(0, x) + def.burntTo + row.slice(x + 1) : row));
      events.push({ kind: "fireOut", at: [x, y], text: `(${x},${y}) burns out.` });
    }
    if (!Object.keys(m.tiles).length) m.done = "no fuel left: it burns out";
  }
  function actCreeper(w, m, events) {
    const def = W.monsters.creeper;
    for (const k of Object.keys(m.tiles)) {
      const [x, y] = P(k), u = unitAt(w, x, y);
      // a stronger hold (Overgrowth 99, Esker's ridge) is never overwritten by the vine
      if (u) { u.status = u.status || {}; const held = u.status.entangled, heldCut = typeof held === "number" ? held : held?.lostMove || 0; if (heldCut < def.entangle.lostMove) u.status.entangled = def.entangle.lostMove; events.push({ kind: "entangle", target: u.id, at: [x, y], text: `${u.id} is tangled in creeper: −${def.entangle.lostMove} move next turn.` }); }
      const o = objAt(w, x, y); if (o && o.material === "plant" && !o.protected) { const r = VR.damageObject(w.arena, o.id, def.smother, {}); w.arena = r.arena; events.push(...r.events); }
    }
    const opts = frontier(w, m).filter((f) => roll(w, m.id, "grow:" + K(...f.at)) < f.chance).slice(0, def.growPerRound);
    for (const f of opts) { m.tiles[K(...f.at)] = 0; events.push({ kind: "creeperGrow", at: f.at, text: `Creeper grows onto (${f.at.join(",")}).` }); }
  }

  // Area damage clears a field kind: the engine calls this for area effects of potency ≥ clearedBy.
  function clearTiles(world, tiles, potency, kind = "creeper") {
    const w = clone(world), events = [], c = active(w, kind);
    const row = ((W.fields || {})[kind] || {}).clear || {};
    const clearedBy = row.clearedBy ?? (W.monsters[kind] || {}).clearedBy;
    const label = (((W.fields || {})[kind] || {}).label) || kind;
    const eventKind = row.eventKind || "creeperCleared";
    if (c && potency >= clearedBy) for (const [x, y] of tiles) if (K(x, y) in c.tiles) { delete c.tiles[K(x, y)]; events.push({ kind: eventKind, at: [x, y], text: `${label} cleared at (${x},${y}).` }); }
    if (c && !Object.keys(c.tiles).length) c.done = "cleared";
    return { world: w, events: events.concat(fleeing(w)) };
  }
  // Damage to a unit monster from any combatant (engine hook).
  function hurtMonster(world, id, amount, by = null) {
    const w = clone(world), m = w.wild.find((x) => x.id === id), events = [];
    if (!m || m.form !== "unit") return { world: w, events };
    hurtIn(w, m, amount, by, events);
    return { world: w, events: events.concat(fleeing(w)) };
  }
  // The body of a hurt, in place (hurtMonster clones; the hunt runs inside the environment phase's own copy).
  function hurtIn(w, m, amount, by, events) {
    const id = m.id;
    if (m.fed && amount > 0) { delete m.fed; events.push({ kind: "wildWake", id, text: `${m.name} is hurt off its meal.` }); }   // D2: a hurt wakes a feeding hunter
    if (m.kind === "nettleCaterpillar" && by && amount > 0) {            // docile until hurt: now it knows who did it
      if (!m.hostile || m.hostile.target !== by) events.push({ kind: "wildProvoked", id, target: by, text: "The caterpillar rears: it has been hurt, and it has marked who did it." });
      m.hostile = { target: by, until: w.round + W.monsters.nettleCaterpillar.hostileRounds };
    }
    if (m.kind === "nettleCaterpillar" && m.curled) amount = Math.ceil(amount * W.monsters.nettleCaterpillar.curledDamageMul);   // curled: the spines take half of it
    m.lf = Math.max(0, m.lf - amount);
    if (m.kind === "nettleCaterpillar" && m.lf > 0 && m.lf <= W.monsters.nettleCaterpillar.curlBelow * m.maxLF && !m.curled) { m.curled = true; events.push({ kind: "wildCurl", id, text: "The caterpillar curls into a ball of spines. It will not move, and blows glance off it." }); }
    events.push({ kind: "wildHurt", id, amount, text: `${m.name} takes ${amount} (${m.lf}/${m.maxLF}).` });
    if (m.lf === 0) {
      m.done = "defeated";
      // Loot v1: fallen wilds drop field items to the ground (contestable by either side). Names are local: this module has no pickups import.
      // The porgy always leaves its body: a raw salema, ready to eat.
      const WILD_LOOT = m.kind === "porgy" ? { chance: 1, items: [["fish", "Raw salema"]] }
        : { chance: 0.4, items: [["bait", "Bait"], ["flare", "Flare"], ["noisemaker", "Noisemaker"], ["waterCan", "Watering can"], ["borate", "Borate treatment"]] };
      if (roll(w, m.id, "loot") < WILD_LOOT.chance) {
        const [item, name] = WILD_LOOT.items[Math.floor(roll(w, m.id, "loot-item") * WILD_LOOT.items.length)];
        let n = 0; for (const p of w.arena.pickups || []) n = Math.max(n, +String(p.id).slice(1) || 0);
        (w.arena.pickups ||= []).push({ id: "i" + (n + 1), item, x: m.x, y: m.y });
        events.push({ kind: "loot", target: m.id, item, tiles: [[m.x, m.y]], text: `${name} spills from the fallen ${m.name} at (${m.x},${m.y}).` });
      }
    }
    else if (m.kind === "feralPig" && m.lf <= 0.4 * m.maxLF) m.fleeing = "badly hurt";
  }

  // ── flee / end ───────────────────────────────────────────────────────────
  function fleeing(w) {
    const events = [];
    for (const m of [...w.wild]) {
      const def = W.monsters[m.kind];
      if (m.kind === "termites" && !m.fleeing && !m.done) {
        const wood = (w.arena.objects || []).some((o) => o.material === "wood" && !o.protected && !w.treated.includes(o.id) && man(o.x, o.y, m.x, m.y) <= def.seekWood);
        if (!wood && !prey(w).some((u) => man(u.x, u.y, m.x, m.y) <= def.seekUnits)) m.fleeing = "nothing left to eat";
      }
      if (m.kind === "brushfire" && !Object.keys(m.tiles).length) m.done = m.done || "burned out";
      if (m.kind === "wolf" && !m.fleeing && m.lf <= m.maxLF * 0.4) m.fleeing = "hurt, it slinks off";   // the pig rule (PROTOTYPES.md)
      if (m.kind === "ducks" && !m.fleeing && !waterTiles(w).some(([x, y]) => man(x, y, m.x, m.y) <= W.monsters.ducks.seekWater) && !prey(w).some((u) => man(u.x, u.y, m.x, m.y) <= W.monsters.ducks.seekUnits)) m.fleeing = "no water near, it wanders off";
      if (m.kind === "nettleCaterpillar" && !m.fleeing && !m.done && !m.curled && !edible(w).length && !living(w).some((u) => u.plant)) m.fleeing = "nothing left to eat";
      if (m.fleeing || m.done) {
        w.wild = w.wild.filter((x) => x !== m);
        events.push({ kind: m.done ? "wildEnd" : "wildFlee", id: m.id, monster: m.kind, text: `${def.name} ${m.done ? "is gone" : "flees"}: ${m.done || m.fleeing}.` });
      }
    }
    return events;
  }

  // ── appear (seeded; only rolls while the condition holds) ───────────────
  function appearances(w) {
    const events = [], R = w.recent || {};
    if (w.gaiaAwakeningPending && !w.gaiaInvoked && canAppear(w, "gaia")) {
      const source = living(w).find(u => u.id === w.gaiaProvokedBy), at = edgeTileNear(w, source ? [source.x, source.y] : [0, Math.floor(w.arena.map.length / 2)]);
      if (at) events.push(spawn(w, "gaia", at, "six or more permanent soil levels have been cut from the landscape"));
    }
    if (w.round < W.rules.noAppearBeforeRound) return events;
    const at0 = (list) => list && list.length ? list[0] : null;
    const tryKind = (kind, cond, at, reason) => {
      if (!cond || !at || !canAppear(w, kind)) return;
      const rule = W.monsters[kind].appear.find((r) => r.when === cond);
      const follows = Object.keys(W.monsters[kind].eats || {}).some((k) => active(w, k)) ? (HUNT().followMul ?? 2) : 1;   // predators follow prey (W1)
      if (roll(w, kind, "appear:" + cond) < rule.chance * follows) events.push(spawn(w, kind, at, reason));
    };
    // brushfire: repeated ground strikes on dry fuel in a fire-prone biome
    const bf = W.monsters.brushfire.appear[1];
    if ((R.groundStrikesOnFuel || 0) >= bf.atLeast && bf.biomes.includes(w.arena.archetype)) {
      const fuel = []; w.arena.map.forEach((r, y) => [...r].forEach((_, x) => { if (isFuel(w, x, y) && !unitAt(w, x, y)) fuel.push([x, y]); }));
      tryKind("brushfire", "groundStrikesOnFuel", fuel[Math.floor(roll(w, "brushfire", "where") * fuel.length)], "sparks from repeated strikes on dry fuel");
    }
    tryKind("flashFlood", "cisternBurst", at0(R.cisternBursts), "a burst cistern empties downhill");
    tryKind("flashFlood", "bridgeCollapseOverWater", at0(R.bridgeCollapsesOverWater), "the collapse dams and releases the channel");
    const debris = (w.arena.objects || []).filter((o) => ["stump", "log"].includes(o.type) && !wildAt(w, o.x, o.y));
    if (debris.length) {
      const o = debris[Math.floor(roll(w, "termites", "where") * debris.length)];
      const spot = walkable(w, o.x, o.y) ? [o.x, o.y] : DIRS.map(([dx, dy]) => [o.x + dx, o.y + dy]).find(([x, y]) => walkable(w, x, y) && !unitAt(w, x, y));
      tryKind("termites", "woodDebris", spot, "drawn out of the woody debris");
    }
    const cat = W.monsters.nettleCaterpillar, catRule = cat.appear[0];
    if (w.round >= catRule.round) {
      const hosts = edible(w).filter((o) => cat.hosts.includes(o.type));
      if (hosts.length) {
        const o = hosts[Math.floor(roll(w, "nettleCaterpillar", "where") * hosts.length)];
        const spot = DIRS.map(([dx, dy]) => [o.x + dx, o.y + dy]).find(([x, y]) => walkable(w, x, y) && !unitAt(w, x, y) && !wildAt(w, x, y));
        tryKind("nettleCaterpillar", "hostPlants", spot, `it was on the ${VR.label(o)} all along`);
      }
    }
    const pigRule = W.monsters.feralPig.appear[1];
    if (w.round >= pigRule.round && pigRule.biomes.includes(w.arena.archetype)) tryKind("feralPig", "roundAtLeast", edgeTileNear(w, [0, Math.floor(w.arena.map.length / 2)], "pig-brush"), "wanders in from the brush");
    // Muse-2's wild types: ducks near water; dogs and the moa by biome (both wait for their art: ready false)
    { const dr = W.monsters.ducks.appear[0], water = waterTiles(w);
      if (w.round >= dr.round && water.length) { const shore = water.map(([x, y]) => DIRS.map(([dx, dy]) => [x + dx, y + dy])).flat().filter(([x, y]) => walkable(w, x, y) && !unitAt(w, x, y) && !wildAt(w, x, y));
        const spot = shore.length ? shore[Math.floor(roll(w, "ducks", "shore") * shore.length)] : null;
        tryKind("ducks", "nearWater", spot, "a feral flock comes up from the water"); } }
    { const pr = W.monsters.porgy.appear[0], open = waterTiles(w).filter(([x, y]) => !unitAt(w, x, y) && !wildAt(w, x, y));
      if (w.round >= pr.round && open.length) tryKind("porgy", "inWater", open[Math.floor(roll(w, "porgy", "where") * open.length)], "a salema rises in the shallows"); }
    { const kr = W.monsters.kraken.appear[0], open = waterTiles(w).filter(([x, y]) => !unitAt(w, x, y) && !wildAt(w, x, y));
      if (w.round >= kr.round && open.length) tryKind("kraken", "inWater", open[Math.floor(roll(w, "kraken", "where") * open.length)], "a kraken rises from the deep"); }
    for (const kind of ["wolf", "moa", "sasquatch", "chicken"]) { const r = W.monsters[kind].appear[0];
      if (w.round >= r.round && r.biomes.includes(w.arena.archetype)) tryKind(kind, "roundAtLeast", edgeTileNear(w, [w.arena.map[0].length - 1, Math.floor(w.arena.map.length / 2)], kind), kind === "wolf" ? "a howl, and a feral dog trots in" : kind === "moa" ? "a moa stalks in and settles on a nest" : kind === "chicken" ? "a rooster crows, and a feral flock struts in" : "something huge steps out of the treeline"); }
    const disturbance = w.arena.map.join("").split("").filter((c) => c === "*").length + debris.length + (w.disturbed || 0);
    if (disturbance >= W.monsters.creeper.appear[0].atLeast) {
      const soil = []; w.arena.map.forEach((r, y) => [...r].forEach((c, x) => { if ([",", "m"].includes(c) && !objAt(w, x, y) && !unitAt(w, x, y)) soil.push([x, y]); }));
      tryKind("creeper", "disturbance", soil[Math.floor(roll(w, "creeper", "where") * soil.length)], "it takes hold of the disturbed ground");
    }
    return events;
  }

  function environmentPhase(world) {
    const w = clone(world), events = [];
    w.bait = w.bait.filter((b) => b.untilRound >= w.round);
    for (const m of [...w.wild]) {
      if (!w.wild.includes(m) || m.done) continue;   // eaten earlier this phase (the food web): it does not act
      if (m.summoned && m.born >= w.round) continue; // newly called creatures begin acting next round
      if (m.suspended) continue;                     // held in a capture ritual's chant (engine.js C18)
      if (m.form === "unit") actUnit(w, m, events);
      else if (m.kind === "flashFlood") actFlood(w, m, events);
      else { const act = (((W.fields || {})[m.kind] || {}).act); if (act === "fire") actFire(w, m, events); else if (act === "creeper") actCreeper(w, m, events); }
    }
    events.push(...fleeing(w));
    if (w.allowAppearances !== false) events.push(...appearances(w));
    w.recent = {};
    return { world: w, events };
  }

  function randomEventWave(world, count = 1, seed = 0) {
    const w = clone(world), events = [];
    // wave: false keeps a kind out of the random-event wave (Muse-2's wild types come by their own rules: ducks by the
    // water, dogs and the moa by biome; it also keeps saved replays of older battles true).
    const pool = Object.keys(W.monsters).filter(id => W.monsters[id].form === "unit" && id !== "gaia" && W.monsters[id].wave !== false);
    const table = (W.waveWeights || {})[w.arena.archetype] || (W.waveWeights || {}).default || {};   // site appetite: unlisted kinds keep weight 1
    const voice = (W.arrivalVoice || {})[w.arena.archetype] || (W.arrivalVoice || {}).default || ["drawn by the sudden disturbance"];
    const center = [Math.floor(w.arena.map[0].length / 2), Math.floor(w.arena.map.length / 2)];
    for (let i = 0; i < Math.min(3, Math.max(1, count)); i++) {
      const options = pool.filter(id => canAppear(w, id));
      if (!options.length) break;
      let h = 2166136261; for (const c of `${seed}:${w.round}:random-event-monster:${i}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
      const weights = options.map(id => table[id] ?? 1), total = weights.reduce((a, b) => a + b, 0);
      let r = (h >>> 0) % total, kind = options[0];
      for (let k = 0; k < options.length; k++) { r -= weights[k]; if (r < 0) { kind = options[k]; break; } }
      const at = edgeTileNear(w, center, `${kind}-wave`); if (!at) break;
      events.push(spawn(w, kind, at, voice[(h >>> 0) % voice.length], { randomEvent: true, side: "wild" }));
    }
    return { world: w, events };
  }

  function newWorld({ seed = 0, round = 1, arena, units }) {
    return { seed, round, arena, units: units.map((u) => ({ ...u })), wild: [], wet: {}, treated: [], bait: [], recent: {}, spawnCounts: {} };
  }

  return { newWorld, useItem, telegraph, environmentPhase, appearances, summonMonster, randomEventWave, clearTiles, hurtMonster, frontier, floodPath, data: W };
});
