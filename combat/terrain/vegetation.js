"use strict";
// Vegetation + destructibles: populate an arena from biome palettes, and resolve damage to
// objects (felling, flooding, regrowth) as pure functions the combat engine can call.
// Data: vegetation-data.js. Maps: mapgen.js. Every placement is seeded and symmetric
// (x ↔ width−1−x) so a fair map stays fair; every placement is re-validated.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./vegetation-data.js"), require("./mapgen.js"), require("./terrain-data.js"));
  else root.ConceptCombatVegetationRules = factory(root.ConceptCombatVegetation, root.ConceptCombatMapgen, root.ConceptCombatTerrain);
})(typeof self !== "undefined" ? self : this, function (V, G, D) {
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
    const e = Object.entries(table).filter(([, w]) => w > 0);
    let r = rand() * e.reduce((n, [, w]) => n + w, 0);
    for (const [k, w] of e) if ((r -= w) < 0) return k;
    return e[e.length - 1][0];
  }
  const setChar = (map, x, y, ch) => map.map((row, yy) => (yy === y ? row.slice(0, x) + ch + row.slice(x + 1) : row));

  // Resolved tile-occupancy props for one object (what mapgen.validate and the engine read).
  function makeObject(type, x, y, n) {
    if (V.species[type]) {
      const sp = V.species[type], f = V.forms[sp.form];
      const hp = sp.hp ?? f.hp;
      return {
        id: "o" + n, kind: "plant", type, form: sp.form, x, y, hp, maxHp: hp, material: f.material,
        blocksMove: f.blocksMove, moveCost: sp.moveCost ?? f.moveCost, sightHeight: sp.sightHeight ?? f.sightHeight,
        cover: f.cover, canopy: sp.trait?.id === "deciduous" ? 0 : (sp.canopy ?? f.canopy),
        protected: !!sp.protected, trait: sp.trait?.id || null, status: {},
      };
    }
    const o = V.objects[type];
    return { id: "o" + n, kind: "object", type, x, y, hp: o.hp, maxHp: o.hp, material: o.material,
      blocksMove: o.blocksMove, moveCost: o.moveCost, sightHeight: o.sightHeight, cover: o.cover, canopy: 0,
      protected: !!(o.protected || o.indestructible), window: !!o.window, trait: null, status: {} };
  }

  // Which biome a column belongs to: generated maps carry per-part archetypes.
  function biomeAt(a, x) {
    if (a.biome && V.biomes[a.biome]) return a.biome;   // an authored map's own planting palette (map recipes: "biome")
    if (!a.parts) return a.archetype;
    const R = D.rules, w = a.map[0].length;
    if (x < R.sideWidth) return a.parts[0].archetype;
    if (x >= w - R.sideWidth) return a.parts[2].archetype;
    return a.parts[1].archetype;
  }

  // populate(arena, { seed }) → arena with `objects`, slot terrain converted, and `vegetation` summary.
  function populate(arena, opts = {}) {
    if (!V.biomes[biomeAt(arena, 0)] && !V.biomes[arena.archetype]) return { ...arena, map: arena.map.slice(), objects: [] };   // interiors (the ship) grow nothing
    const rand = mulberry32(((opts.seed ?? arena.seed ?? 0) ^ 0x9e3779b9) >>> 0);
    const w = arena.map[0].length, h = arena.map.length;
    let map = arena.map.slice(); const objects = []; let n = 0;
    const choice = new Map();
    const at = (x, y) => objects.find((o) => o.x === x && o.y === y);

    // 1. authored slots: T = tree, h = hedge. Mirror tiles reuse the same species when their biome matches.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = arena.map[y][x]; if (ch !== "T" && ch !== "h") continue;
      const slot = ch === "T" ? "tree" : "hedge", biome = biomeAt(arena, x);
      const key = `${Math.min(x, w - 1 - x)},${y},${slot},${biome}`;
      if (!choice.has(key)) choice.set(key, weighted(rand, V.biomes[biome][slot]));
      objects.push(makeObject(choice.get(key), x, y, ++n));
      map = setChar(map, x, y, V.rules.slotTerrain[ch]);
    }
    let out = { ...arena, map, objects };

    // 2. scatter symmetric pairs, keeping only pairs that leave the map valid.
    const spawnKeys = new Set([...arena.spawns.player, ...arena.spawns.enemy].map(([x, y]) => x + "," + y));
    const nearSpawn = (x, y) => [...spawnKeys].some((k) => { const [sx, sy] = k.split(",").map(Number); return Math.abs(sx - x) + Math.abs(sy - y) <= 1; });
    const okTile = (x, y, type) => {
      const ch = out.map[y][x];
      const wet = V.species[type]?.trait?.id === "wetTolerant";
      // Check the growing list, not only the authored slots: two scattered objects must never share a tile.
      const taken = out.objects.some((o) => o.x === x && o.y === y);
      return (V.rules.scatterOn.includes(ch) || (wet && ch === "w")) && !taken && !nearSpawn(x, y);
    };
    const biome = V.biomes[biomeAt(arena, 0)] || V.biomes[arena.archetype];
    const [lo, hi] = biome.scatterPairs;
    const want = lo + Math.floor(rand() * (hi - lo + 1));
    let placed = 0;
    for (let tries = 0; tries < 30 && placed < want; tries++) {
      const x = Math.floor(rand() * Math.floor(w / 2)), y = Math.floor(rand() * h), mx = w - 1 - x;
      const type = weighted(rand, (V.biomes[biomeAt(arena, x)] || biome).scatter);
      if (!okTile(x, y, type) || !okTile(mx, y, type)) continue;
      const pair = [makeObject(type, x, y, ++n), makeObject(type, mx, y, ++n)];
      const trial = { ...out, objects: [...out.objects, ...pair] };
      if (!G.validate(trial).ok) continue;
      out = trial; placed++;
    }
    const counts = {};
    for (const o of out.objects) counts[o.type] = (counts[o.type] || 0) + 1;
    return { ...out, vegetation: { biomes: [...new Set([0, Math.floor(w / 2), w - 1].map((x) => biomeAt(arena, x)))], counts, scatterPairs: placed } };
  }

  // ── damage and destruction ───────────────────────────────────────────────
  // Direction a felled tree falls: directly away from the source, dominant axis (like knock()).
  function fallDirection(o, from) {
    const dx = o.x - from[0], dy = o.y - from[1];
    return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy)];
  }
  // Tiles a felled trunk lands on, plus the blocking object (if any) it slams into.
  function fellPath(arena, o, from) {
    const [dx, dy] = fallDirection(o, from), tiles = [];
    let stopper = null;
    for (let i = 1; i <= V.rules.felling.length; i++) {
      const x = o.x + dx * i, y = o.y + dy * i;
      if (y < 0 || y >= arena.map.length || x < 0 || x >= arena.map[0].length) break;
      const occ = arena.objects.find((p) => p.x === x && p.y === y && p.blocksMove && p.id !== o.id);
      if (occ) { stopper = occ; break; }      // the trunk slams into it
      if (D.terrain[arena.map[y][x]].blocksMove) break;
      tiles.push([x, y]);
    }
    return { tiles, stopper };
  }
  const fellTiles = (arena, o, from) => fellPath(arena, o, from).tiles;

  // damageObject(arena, id, amount, { from:[x,y], channel, area }) → { arena, events }.
  // events are for the engine to apply/log: crush (unit damage at a tile), limbDrop, shaken, regrow, destroyed, note.
  function damageObject(arena, id, amount, ctx = {}) {
    const events = [];
    const o0 = arena.objects.find((o) => o.id === id);
    if (!o0) return { arena, events: [{ kind: "note", text: "No such object." }] };
    if (o0.protected) return { arena, events: [{ kind: "note", id, text: `${label(o0)} is protected and takes no damage.` }] };
    const o = { ...o0, status: { ...o0.status } };
    if (o.status.ward > 0) {   // a ward on an object (a data center carrying a drone tower) takes one whole hit
      o.status.ward -= 1;
      return { arena: { ...arena, objects: arena.objects.map((p) => (p.id === id ? o : p)) }, events: [{ kind: "note", id, text: `${label(o)}'s ward takes the hit.` }] };
    }
    let dmg = amount * (ctx.damageMul || 1);
    if (ctx.destructive && isStructure(o)) dmg *= 2;   // the destructive quality (Anti-Urbanism): double to structures
    if (ctx.area) dmg *= V.rules.areaDamageToObjects;
    const mat = V.rules.materials[o.material] || {};
    if (ctx.channel && mat[ctx.channel]) dmg *= mat[ctx.channel];
    if (o.trait === "woundSensitive" && o.status.wounded) dmg *= 2;
    dmg = Math.round(dmg);
    const before = o.hp;
    o.hp = Math.max(0, o.hp - dmg);
    events.push({ kind: "damage", id, amount: dmg, text: `${label(o)} takes ${dmg} (${o.hp}/${o.maxHp}).` });
    if (o.trait === "woundSensitive" && !o.status.wounded) { o.status.wounded = true; events.push({ kind: "note", id, text: "ʻŌhiʻa is wounded: it now takes double damage." }); }
    if (o.trait === "leafSpot" && !o.status.defoliated) { o.status.defoliated = true; o.cover = 0; events.push({ kind: "note", id, text: "Leaf spot defoliates the hedge: no more cover." }); }
    if (o.trait === "limbDrop" && !o.status.limbDropped && before > o.maxHp / 2 && o.hp <= o.maxHp / 2 && o.hp > 0) {
      o.status.limbDropped = true;
      const [dx, dy] = fallDirection(o, ctx.from || [o.x - 1, o.y]);
      events.push({ kind: "crush", at: [o.x + dx, o.y + dy], damage: 6, channel: "nigredo", text: "A eucalyptus limb drops." });
    }
    if (o.trait === "loosePanels" && !o.status.panelsShook && before > o.maxHp / 2 && o.hp <= o.maxHp / 2 && o.hp > 0) {
      o.status.panelsShook = true;
      events.push({ kind: "shaken", id, type: o.type, at: [o.x, o.y], text: `${label(o)} rattles: a panel shakes loose.` });
    }
    if (o.hp === 0 && o.trait === "stripBark" && !o.status.stripUsed) {
      o.hp = 1; o.status.stripUsed = true;
      events.push({ kind: "note", id, text: "Strip-bark: a living strip keeps the bristlecone standing at 1 HP." });
    }
    let objects = arena.objects.map((p) => (p.id === id ? o : p));
    let map = arena.map;
    if (o.hp > 0) return { arena: { ...arena, objects, map }, events };

    // destroyed
    objects = objects.filter((p) => p.id !== id);
    let n = Math.max(0, ...arena.objects.map((p) => +p.id.slice(1) || 0));
    events.push({ kind: "destroyed", id, type: o.type, role: o.role || null, tower: o.tower ? { ...o.tower } : undefined, evidenceId: o.evidenceId || null, stored: o.stored?.length ? o.stored : undefined,
      at: [o.x, o.y], text: `${label(o)} is destroyed.` });
    if (o.kind === "plant" && o.form === "tree") {
      const { tiles, stopper } = fellPath(arena, o, ctx.from || [o.x - 1, o.y]);
      objects.push(makeObject(o.trait === "propRoots" ? "roots" : "stump", o.x, o.y, ++n));
      for (const [x, y] of tiles) {
        const soft = objects.find((p) => p.x === x && p.y === y);
        if (soft) {                                      // hedges, shrubs, roots under the trunk are crushed flat
          if (soft.protected) continue;
          objects = objects.filter((p) => p !== soft);
          events.push({ kind: "destroyed", id: soft.id, type: soft.type, at: [x, y], text: `${label(soft)} is crushed under the trunk.` });
        }
        objects.push(makeObject("log", x, y, ++n));
        events.push({ kind: "crush", at: [x, y], damage: V.rules.felling.damage, channel: V.rules.felling.channel, stagger: V.rules.felling.stagger, text: "Timber: the trunk comes down here." });
      }
      let result = { ...arena, objects, map };
      const chain = (ctx.chain || 0) + 1;
      if (stopper && V.rules.collision.trunkHitsObjects && chain <= V.rules.collision.maxChain) {
        events.push({ kind: "note", text: `The falling trunk slams into ${label(stopper)}.` });
        const r = damageObject(result, stopper.id, V.rules.felling.damage, { from: [o.x, o.y], channel: V.rules.felling.channel, chain });
        result = r.arena; events.push(...r.events);
      } else if (!tiles.length) events.push({ kind: "note", text: "The tree falls against an obstacle; no log is left in the open." });
      return { arena: result, events };
    } else if (o.kind === "plant") {
      if (o.trait === "pioneer") events.push({ kind: "regrow", at: [o.x, o.y], type: o.type, afterRounds: 3, text: "ʻAʻaliʻi will regrow in 3 rounds." });
    } else {
      const def = V.objects[o.type] || {};
      if (def.becomes) map = setChar(map, o.x, o.y, def.becomes);
      if (def.flood) {
        for (const [dx, dy] of DIRS) {
          const x = o.x + dx, y = o.y + dy;
          if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) continue;
          if ([".", ",", "m"].includes(map[y][x]) && !objects.some((p) => p.x === x && p.y === y && p.blocksMove)) map = setChar(map, x, y, "w");
        }
        events.push({ kind: "note", text: "The cistern bursts: nearby ground floods to shallow water." });
      }
    }
    return { arena: { ...arena, objects, map }, events };
  }

  // ── how objects get hit (Mala, 2026-10-07): in the line of an attack, attacked directly,
  //    or collided into. All return { arena, events, ... } for the engine to apply and log.
  function bresenham(x0, y0, x1, y1) {          // identical to engine.js line(): tile centres, endpoints included
    const out = []; const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, x = x0, y = y0;
    for (;;) { out.push([x, y]); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } }
    return out;
  }
  const groundH = (a, x, y) => +(a.height?.[y]?.[x] || 0);
  const profile = (o) => Math.max(o.sightHeight || 0, o.blocksMove ? 1 : 0);

  // lineImpact: a line delivery from `from` to `to` damages every object it passes through.
  // Returns the potency still travelling when it reaches `to` (0 if stopped) and where it stopped.
  function lineImpact(arena, from, to, potency, ctx = {}) {
    const L = V.rules.line, top = Math.max(groundH(arena, ...from), groundH(arena, ...to));
    const original = new Set(arena.objects.map((o) => o.id));   // logs that fall mid-line are not re-hit
    let a = arena, p = potency; const events = [], hits = [];
    for (const [x, y] of bresenham(from[0], from[1], to[0], to[1]).slice(1)) {
      const o = a.objects.find((q) => q.x === x && q.y === y && original.has(q.id) && !(ctx.skipIds || []).includes(q.id));   // skipIds: works founded by this same line (Orbital Drop's Citadel)
      if (!o) continue;
      if (o.crownSuppressed) { events.push({ kind: "note", text: `Crown Raise clears the line over ${label(o)}.` }); continue; }
      const isTarget = x === to[0] && y === to[1];
      if (o.window && !isTarget) { events.push({ kind: "note", text: `The line passes through ${label(o)}.` }); continue; }
      if (!isTarget && groundH(a, x, y) + profile(o) <= top) { events.push({ kind: "note", text: `The line passes over ${label(o)}.` }); continue; }
      if (o.protected || o.maxHp === 0) {
        if (o.blocksMove || isTarget) { events.push({ kind: "note", text: `${label(o)} cannot be damaged and stops the line.` }); return { arena: a, events, potency: 0, stoppedAt: [x, y], hits }; }
        continue;
      }
      const hpBefore = o.hp;
      const r = damageObject(a, o.id, p, { ...ctx, from });
      a = r.arena; events.push(...r.events); hits.push(o.id);
      const destroyed = !a.objects.some((q) => q.id === o.id);
      if (isTarget) return { arena: a, events, potency: 0, stoppedAt: [x, y], hits };
      if (o.blocksMove) {
        const overflow = destroyed && L.overflowContinues ? p - hpBefore : 0;
        if (overflow <= 0) { events.push({ kind: "note", text: `${label(o)} stops the line.` }); return { arena: a, events, potency: 0, stoppedAt: [x, y], hits }; }
        p = overflow; events.push({ kind: "note", text: `The line breaks through ${label(o)} with ${Math.round(p)} potency left.` });
      } else {
        const ignored=ctx.ignoreCover || (ctx.ignoreCoverAt&&ctx.ignoreCoverAt[0]===x&&ctx.ignoreCoverAt[1]===y);
        if(!ignored)p = p * (1 - Math.max(L.minAbsorb, o.cover || 0));
        events.push({ kind: "note", text: ignored?`Focus attends the target; the line passes through ${label(o)} without cover attenuation (${Math.round(p)} potency continues).`:`The line tears through ${label(o)} (${Math.round(p)} potency continues).` });
      }
    }
    return { arena: a, events, potency: Math.round(p), stoppedAt: null, hits };
  }

  // attackObject: a direct hit on an object's tile (single-target, contact, placed).
  // Built, not grown: the structure tag on the object or its type (vegetation-data.js objects), and houses (engine/houses.js).
  function isStructure(o) { return !!o && (o.tags?.includes("structure") || V.objects[o.type]?.tags?.includes("structure") || o.type === "house"); }
  function attackObject(arena, id, potency, ctx = {}) { return damageObject(arena, id, potency, ctx); }

  // areaImpact: a field/radius effect damages every object in its tiles at reduced potency.
  function areaImpact(arena, tiles, potency, ctx = {}) {
    let a = arena; const events = [];
    const keys = new Set(tiles.map(([x, y]) => x + "," + y));
    for (const o of arena.objects.filter((q) => keys.has(q.x + "," + q.y))) {
      if (!a.objects.some((q) => q.id === o.id) || o.protected || o.maxHp === 0) continue;
      const r = damageObject(a, o.id, potency, { ...ctx, area: true });
      a = r.arena; events.push(...r.events);
    }
    return { arena: a, events };
  }

  // collide: a unit is shoved `force` tiles into the object on its path from `from`.
  // The object takes force × objectDamagePerTile impact; the unit takes a slam if the object
  // holds. If the object breaks (or is soft), the unit carries on into the tile.
  function collide(arena, id, force, ctx = {}) {
    const C = V.rules.collision, o = arena.objects.find((q) => q.id === id);
    if (!o) return { arena, events: [], unitMovesIn: true };
    const events = [{ kind: "note", text: `Collision with ${label(o)}.` }];
    if (o.protected || o.maxHp === 0) {
      if (!o.blocksMove) return { arena, events, unitMovesIn: true };
      events.push({ kind: "unitHit", damage: C.unitDamage, channel: "nigredo", text: `${label(o)} doesn't give: slam.` });
      return { arena, events, unitMovesIn: false };
    }
    const r = damageObject(arena, id, force * C.objectDamagePerTile, { ...ctx, channel: "nigredo" });
    events.push(...r.events);
    const destroyed = !r.arena.objects.some((q) => q.id === id);
    const stillBlocked = r.arena.objects.some((q) => q.x === o.x && q.y === o.y && q.blocksMove);
    if (!o.blocksMove) return { arena: r.arena, events, unitMovesIn: true };
    if (destroyed && C.crashThrough && !stillBlocked) {
      events.push({ kind: "note", text: `Crashes through ${label(o)}.` });
      return { arena: r.arena, events, unitMovesIn: true, crashedThrough: true };
    }
    events.push({ kind: "unitHit", damage: C.unitDamage, channel: "nigredo", text: `Slams into ${label(o)}.` });
    return { arena: r.arena, events, unitMovesIn: false };
  }

  // An object placed by a character may carry its own name, or a type the tables don't list: never throw on a label.
  function label(o) { const name = o.name || (o.kind === "plant" ? V.species[o.type]?.common : V.objects[o.type]?.name) || o.type || "object"; return o.dead ? `dead ${name}` : name; }

  // Canopy shade tiles (Manhattan radius), excluding deciduous trees (canopy 0).
  function shadeTiles(arena) {
    const out = new Set();
    for (const o of arena.objects || []) if (o.canopy > 0)
      for (let y = 0; y < arena.map.length; y++) for (let x = 0; x < arena.map[0].length; x++)
        if (Math.abs(x - o.x) + Math.abs(y - o.y) <= o.canopy && !(x === o.x && y === o.y)) out.add(x + "," + y);
    return out;
  }

  // The authored Kou shade trait counters Diffusion damage under its crown. Other tree
  // canopies still cast a visible shadow, but do not gain an un-authored combat bonus.
  function shadesDiffusion(arena, x, y) {
    return (arena.objects || []).some((o) => o.kind === "plant" && o.trait === "shadeTree"
      && Math.abs(x - o.x) + Math.abs(y - o.y) <= (o.canopy || 0));
  }

  return { isStructure, populate, damageObject, attackObject, lineImpact, areaImpact, collide, bresenham, fellPath, fellTiles, fallDirection, shadeTiles, shadesDiffusion, makeObject, label, biomeAt, data: V };
});
