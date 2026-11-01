"use strict";
// Destructible terrain for Concept Combat (Mala, 2026-10-07): "terrain itself should be
// targetable by a certain category of attacks, anything that targets the ground area. Solid
// earth doesn't crumble, but cliffs can eventually turn into rockslides damaging everything in
// the direction it falls; bridges made of wood and everything standing on it."
//
//   Ground-targeting = placed damage, or damage with an area shape (radius / plus / line area).
//   Solid ground (paving, turf, mulch, water, ramps, rubble) never breaks.
//   Cliff tiles = the high side of a drop ≥ 2. Integrity accumulates across hits; on failure the
//     face collapses into a rockslide that runs `drop` tiles downhill, hurting everything there,
//     and leaves a rubble scramble (the cliff erodes into a walkable slope).
//   Bridges = shared-HP wooden structures; on collapse each deck tile reverts to what is under
//     it, and everyone on it falls (fall damage by drop) and may be swept out of deep water.
// Pure functions returning { arena, events }; the engine applies unit events. Numbers: rules.ground.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./terrain-data.js"), require("./mapgen.js"), require("./vegetation.js"));
  else root.ConceptCombatStructures = factory(root.ConceptCombatTerrain, root.ConceptCombatMapgen, root.ConceptCombatVegetationRules);
})(typeof self !== "undefined" ? self : this, function (D, G, VR) {
  const R = D.rules.ground, DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const key = (x, y) => x + "," + y;
  const inside = (a, x, y) => y >= 0 && y < a.map.length && x >= 0 && x < a.map[0].length;
  const H = (a, x, y) => +a.height[y][x];
  const Tch = (a, x, y) => a.map[y][x];

  function setTile(a, x, y, ch, h) {
    const map = ch == null ? a.map : a.map.map((r, yy) => (yy === y ? r.slice(0, x) + ch + r.slice(x + 1) : r));
    const height = h == null ? a.height : a.height.map((r, yy) => (yy === y ? r.slice(0, x) + String(h) + r.slice(x + 1) : r));
    return { ...a, map, height };
  }

  // Which abilities hit terrain. An explicit `groundTargeting` flag on the ability wins.
  function isGroundTargeting(ab) {
    if (!ab) return false;
    if (ab.groundTargeting != null) return !!ab.groundTargeting;
    if (ab.effect !== "damage") return false;
    if (ab.delivery === "placed") return true;
    return !!ab.area && ab.area.shape !== "single" && R.targetingDeliveries.concat(["line", "self"]).includes(ab.delivery);
  }

  function bridgeAt(a, x, y) {
    return (a.structures || []).find((st) => st.kind === "bridge" && !st.collapsed && st.tiles.some((t) => t.x === x && t.y === y)) || null;
  }

  // Cliff info for a tile, or null if it's not a cliff. Prefers the fall direction away from `from`.
  function cliffInfo(a, x, y, from) {
    const t = D.terrain[Tch(a, x, y)];
    if (t.blocksMove || t.tags.includes("bridge")) return null;
    const h = H(a, x, y);
    const drops = DIRS.filter(([dx, dy]) => inside(a, x + dx, y + dy))
      .map(([dx, dy]) => ({ dir: [dx, dy], drop: h - H(a, x + dx, y + dy) }))
      .filter((d) => d.drop >= D.rules.ledgeDelta);
    if (!drops.length) return null;
    const away = from ? [Math.sign(x - from[0]), Math.sign(y - from[1])] : [0, 0];
    drops.sort((p, q) => q.drop - p.drop || (q.dir[0] * away[0] + q.dir[1] * away[1]) - (p.dir[0] * away[0] + p.dir[1] * away[1]));
    const { dir, drop } = drops[0];
    const masonry = Tch(a, x, y) === "=";
    const integrity = Math.round((R.cliff.integrityBase + R.cliff.integrityPerLevel * drop) * (masonry ? R.cliff.masonryMul : 1));
    return { x, y, dir, drop, integrity, damage: (a.terrainDamage || {})[key(x, y)] || 0, masonry };
  }
  function cliffTiles(a) {
    const out = [];
    for (let y = 0; y < a.map.length; y++) for (let x = 0; x < a.map[0].length; x++) { const c = cliffInfo(a, x, y); if (c) out.push(c); }
    return out;
  }

  function damageObjectsAt(a, x, y, dmg, from, events) {
    for (const o of (a.objects || []).filter((q) => q.x === x && q.y === y)) {
      const r = VR.damageObject(a, o.id, dmg, { from, channel: R.rockslide.channel });
      a = r.arena; events.push(...r.events);
    }
    return a;
  }

  function damageBridge(a, st, potency, ctx, events) {
    const mul = (ctx.channel && R.bridge.materials[ctx.channel]) || 1;
    const maxHp = st.maxHp ?? st.hp ?? R.bridge.hp, hpNow = st.hp ?? maxHp;
    const dmg = Math.round(potency * mul), hp = Math.max(0, hpNow - dmg);
    events.push({ kind: "bridgeDamage", id: st.id, amount: dmg, text: `The wooden bridge takes ${dmg} (${hp}/${maxHp}).` });
    let next = { ...st, hp, maxHp };
    let out = { ...a, structures: a.structures.map((s) => (s.id === st.id ? next : s)) };
    if (hp > 0) return out;
    next = { ...next, collapsed: true };
    out = { ...out, structures: out.structures.map((s) => (s.id === st.id ? next : s)) };
    events.push({ kind: "bridgeCollapse", id: st.id, text: "The bridge gives way: everything on it goes down." });
    for (const t of st.tiles) {
      const deck = H(out, t.x, t.y), drop = Math.max(0, deck - t.underH);
      out = setTile(out, t.x, t.y, t.under, t.underH);
      const deep = D.terrain[t.under].blocksMove;
      events.push({ kind: "bridgeFall", at: [t.x, t.y], drop, damage: R.bridge.collapseDamage + (D.rules.fall[drop] || 0), stagger: R.bridge.stagger, channel: "nigredo",
        swept: deep, to: deep ? nearestWalkable(out, [t.x, t.y]) : null,
        text: `Anyone at (${t.x},${t.y}) falls ${drop} into ${D.terrain[t.under].name}${deep ? " and is swept to the nearest bank" : ""}.` });
      for (const o of (out.objects || []).filter((q) => q.x === t.x && q.y === t.y)) {
        out = { ...out, objects: out.objects.filter((q) => q !== o) };
        events.push({ kind: "destroyed", id: o.id, type: o.type, at: [t.x, t.y], text: `${VR.label(o)} falls with the bridge.` });
      }
    }
    return out;
  }

  function rockslide(a, c, events) {
    const { x, y, dir: [dx, dy], drop } = c, hi = H(a, x, y);
    const dmg = R.rockslide.damageBase + R.rockslide.damagePerLevel * drop;
    const path = [];
    for (let i = 1; i <= drop; i++) {
      const px = x + dx * i, py = y + dy * i;
      if (!inside(a, px, py) || Tch(a, px, py) === "#") break;      // debris piles against walls
      path.push([px, py]);
    }
    events.push({ kind: "rockslide", at: [x, y], dir: [dx, dy], drop, damage: dmg,
      text: `The cliff at (${x},${y}) gives way: a ${drop}-level rockslide runs ${path.length} tile${path.length === 1 ? "" : "s"} downhill.` });
    if (path.length) events.push({ kind: "carried", from: [x, y], to: path[path.length - 1], damage: dmg, stagger: R.rockslide.stagger, channel: R.rockslide.channel,
      text: `Anyone standing on the cliff edge rides the slide down to (${path[path.length - 1].join(",")}).` });

    // reshape: the face loses a level, the base gains a talus level, the run becomes rubble
    a = setTile(a, x, y, "*", hi - 1);
    a = damageObjectsAt(a, x, y, dmg * R.rockslide.objectMul, [x - dx, y - dy], events);
    path.forEach(([px, py], i) => {
      const st = bridgeAt(a, px, py);
      if (st) a = damageBridge(a, st, dmg, { channel: R.rockslide.channel }, events);
      const newH = i === 0 ? Math.min(hi - 1, H(a, px, py) + 1) : null;
      if (!bridgeAt(a, px, py)) a = setTile(a, px, py, "*", newH);
      events.push({ kind: "slide", at: [px, py], damage: dmg, stagger: R.rockslide.stagger, channel: R.rockslide.channel, text: `Rockslide debris hits (${px},${py}) for ${dmg}.` });
      a = damageObjectsAt(a, px, py, dmg * R.rockslide.objectMul, [x, y], events);
    });

    // the face is gone; the rest of the same ledge is weakened, not collapsed
    const td = { ...(a.terrainDamage || {}) }; delete td[key(x, y)];
    for (const [nx, ny] of [[x + dy, y + dx], [x - dy, y - dx]]) {
      if (!inside(a, nx, ny)) continue;
      const n = cliffInfo({ ...a, terrainDamage: td }, nx, ny);
      if (!n) continue;
      td[key(nx, ny)] = Math.min(n.integrity - 1, n.damage + Math.round(n.integrity * R.cliff.weakenNeighbours));
      events.push({ kind: "note", text: `The cliff at (${nx},${ny}) is cracked by the collapse (${td[key(nx, ny)]}/${n.integrity}).` });
    }
    return { ...a, terrainDamage: td };
  }

  // groundImpact(arena, tiles, potency, { channel, from }): a ground-targeting attack lands on `tiles`.
  // Each bridge is hit once per attack; each cliff tile takes damage and may slide.
  function groundImpact(arena, tiles, potency, ctx = {}) {
    let a = { ...arena, structures: arena.structures || [], terrainDamage: arena.terrainDamage || {} };
    const events = [], bridgesHit = new Set();
    let solid = 0;
    for (const [x, y] of tiles) {
      if (!inside(a, x, y)) continue;
      const st = bridgeAt(a, x, y);
      if (st) { if (!bridgesHit.has(st.id)) { bridgesHit.add(st.id); a = damageBridge(a, st, potency, ctx, events); } continue; }
      const c = cliffInfo(a, x, y, ctx.from);
      if (!c) { solid++; continue; }
      const mul = (ctx.channel && R.cliff.materials[ctx.channel]) || 1;
      const dmg = Math.round(potency * mul), total = c.damage + dmg;
      events.push({ kind: "cliffDamage", at: [x, y], amount: dmg, text: `The ${c.masonry ? "retaining wall" : "cliff face"} at (${x},${y}) cracks (${Math.min(total, c.integrity)}/${c.integrity}).` });
      if (total >= c.integrity) a = rockslide(a, c, events);
      else a = { ...a, terrainDamage: { ...a.terrainDamage, [key(x, y)]: total } };
    }
    if (solid) events.push({ kind: "note", solid, text: `Solid ground absorbs the strike on ${solid} tile${solid === 1 ? "" : "s"}.` });
    return { arena: a, events };
  }

  function nearestWalkable(a, [sx, sy]) {
    const seen = new Set([key(sx, sy)]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (!inside(a, nx, ny) || seen.has(k)) continue;
        seen.add(k);
        const blocked = D.terrain[Tch(a, nx, ny)].blocksMove || (a.objects || []).some((o) => o.x === nx && o.y === ny && o.blocksMove);
        if (!blocked) return [nx, ny];
        q.push([nx, ny]);
      }
    }
    return null;
  }

  return { isGroundTargeting, groundImpact, cliffInfo, cliffTiles, bridgeAt, nearestWalkable };
});
