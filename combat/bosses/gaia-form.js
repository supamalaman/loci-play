"use strict";
// One With Nature: the overlay form from the Orb of the Living Accord (Mala's design, 2026-10-08).
// Pure functions over actor/arena records; data in boss-data.js. Spec: ~/Documents/concept-combat-bosses.md.
//
//   livingTiles(arena, { patches, dead })                → Set "x,y" of living terrain
//   conduitRoute(arena, from, origin, { sealed, domains, patches, dead }) → { ok, path, reason }
//   livingConduit(player, ability, origin, ctx)          → { ok, origin, cost, path, notes } or { ok: false, reason }
//   lensSupports(lensId, ability) / lensValid(lensId)
//   equipLens(player, lensId, abilityId)                 → { player } or { error }   free, but slots/uniqueness apply
//   commit(player, ability, ctx)                         → lensed copy of the ability; snapshot it at commitment
//   onExpiry(effects, ownerId)                           → effects with Deep Roots' extra turn removed
//   (the Living Accord itself, the other way to earn the orb, is in gaia.js)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./boss-data.js"), require("../terrain/terrain-data.js"));
  else root.ConceptCombatGaiaForm = factory(root.ConceptCombatBossData, root.ConceptCombatTerrain);
})(typeof self !== "undefined" ? self : this, function (BD, TD) {
  const LC = BD.livingConduit, L = BD.formLenses, key = (x, y) => x + "," + y;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function livingTiles(arena, { patches = [], dead = [] } = {}) {
    const out = new Set(), gone = new Set(dead.map(([x, y]) => key(x, y)));
    arena.map.forEach((row, y) => row.split("").forEach((ch, x) => {
      const tags = (TD.terrain[ch] || {}).tags || [];
      if (tags.includes("soil") || tags.includes("plant")) out.add(key(x, y));
    }));
    for (const o of arena.objects || []) if (!o.destroyed && (o.kind === "plant" || ["tree", "hedge", "shrub", "groundcover"].includes(o.type))) out.add(key(o.x, o.y));
    for (const [x, y] of patches) out.add(key(x, y));
    for (const k of gone) out.delete(k);
    return out;
  }
  const blocksMoveAt = (arena, x, y) => (TD.terrain[arena.map[y][x]] || {}).blocksMove || (arena.objects || []).some((o) => o.x === x && o.y === y && !o.destroyed && o.blocksMove);

  // BFS through living tiles from any living tile beside (or under) the caster to the origin.
  function conduitRoute(arena, from, origin, { sealed = [], domains = [], patches = [], dead = [], maxRoute = LC.maxRoute } = {}) {
    const live = livingTiles(arena, { patches, dead }), seal = new Set(sealed.map(([x, y]) => key(x, y)));
    const inDomain = (x, y) => domains.findIndex((d) => d.tiles.some(([a, b]) => a === x && b === y));
    const ok = (x, y) => live.has(key(x, y)) && !seal.has(key(x, y));
    if (!ok(...origin)) return { ok: false, reason: live.has(key(...origin)) ? "The origin is sealed off." : "The origin isn't living terrain." };
    if (blocksMoveAt(arena, ...origin)) return { ok: false, reason: "A technique can't start inside a solid object." };
    const starts = [[0, 0], ...N4].map(([dx, dy]) => [from[0] + dx, from[1] + dy]).filter(([x, y]) => arena.map[y]?.[x] && ok(x, y));
    if (!starts.length) return { ok: false, reason: "You aren't touching living terrain." };
    const prev = new Map(), dist = new Map(), q = [];
    for (const [x, y] of starts) { dist.set(key(x, y), 1); q.push([x, y]); }
    while (q.length) {
      const [x, y] = q.shift(), d = dist.get(key(x, y));
      if (x === origin[0] && y === origin[1]) {
        const path = [[x, y]]; let k = key(x, y);
        while (prev.has(k)) { const p = prev.get(k); path.unshift(p); k = key(...p); }
        return { ok: true, path };
      }
      if (d >= maxRoute) continue;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (!arena.map[ny]?.[nx] || !ok(nx, ny) || dist.has(key(nx, ny))) continue;
        if (inDomain(x, y) !== inDomain(nx, ny)) continue;          // a Closed Domain's edge is sealed both ways
        dist.set(key(nx, ny), d + 1); prev.set(key(nx, ny), [x, y]); q.push([nx, ny]);
      }
    }
    return { ok: false, reason: `No connected living route within ${maxRoute} tiles.` };
  }

  const inForm = (p) => p?.form?.formId === "one_with_nature";
  function eligible(ability) {
    if (LC.eligible.notTiers.includes(ability.tier)) return "Ultimates can't be routed.";
    if (LC.eligible.notDeliveries.includes(ability.delivery)) return `A ${ability.delivery} technique has nowhere else to start from.`;
    return null;
  }

  function livingConduit(player, ability, origin, ctx = {}) {
    if (!inForm(player)) return { ok: false, reason: "Living Conduit is only available as One With Nature." };
    if (ctx.equipped && !ctx.equipped.includes(ability.id)) return { ok: false, reason: "Only an equipped technique can be routed." };
    const bad = eligible(ability); if (bad) return { ok: false, reason: bad };
    const r = conduitRoute(ctx.arena, [player.x, player.y], origin, ctx);
    if (!r.ok) return { ok: false, reason: r.reason };
    return { ok: true, origin: origin.slice(), path: r.path, cost: (ability.cost || 0) + LC.cost,
      notes: [`${ability.name} runs ${r.path.length} tiles through the roots and starts from (${origin.join(", ")}). Range, sight and route budget are measured from there.`] };
  }

  // ── form lenses ──
  function lensSupports(lensId, ability) {
    const lens = L[lensId]; if (!lens) return false;
    if (lens.on === "self") return !ability;
    if (!ability) return false;
    if (lens.on.area && !lens.on.area.includes(ability.area?.shape)) return false;
    if (lens.on.persistent && !(typeof ability.duration === "number" && ability.duration > 0)) return false;
    if (lens.on.notDeliveries && lens.on.notDeliveries.includes(ability.delivery)) return false;
    return ability.tier !== "form";
  }
  function lensValid(lensId) {
    const m = L[lensId]?.mods || {}, rate = BD.lensBudget;
    let v = 0;
    for (const [k, x] of Object.entries(m)) v += k === "potencyMul" ? (x - 1) * rate.potencyMul : (rate[k] || 0) * x;
    return v <= 0.02 + 1e-9;
  }
  function equipLens(player, lensId, abilityId = null, abilities = {}) {
    if (!inForm(player)) return { player, error: "Form lenses need the One With Nature form." };
    const lenses = player.form.lenses || [];
    if (!L[lensId] || !lensValid(lensId)) return { player, error: "That isn't a valid form lens." };
    if (lenses.some((l) => l.lens === lensId)) return { player, error: `${L[lensId].name} is already equipped; form lenses don't stack.` };
    if (lenses.length >= BD.formBalance.maxLenses) return { player, error: `At most ${BD.formBalance.maxLenses} form lenses at once.` };
    if (!lensSupports(lensId, abilityId ? abilities[abilityId] : null)) return { player, error: `${L[lensId].name} doesn't fit ${abilityId ? abilities[abilityId]?.name || abilityId : "that"}.` };
    // Free to equip, but no extra action or reaction comes with it.
    return { player: { ...player, form: { ...player.form, lenses: [...lenses, { lens: lensId, ability: abilityId }] } }, events: [{ kind: "lens", actor: player.id, text: `${L[lensId].name}: ${L[lensId].benefit} ${L[lensId].sacrifice}` }] };
  }
  // Snapshot at commitment: later lens changes never touch an ability already announced or delayed.
  function commit(player, ability, ctx = {}) {
    const out = { ...ability, area: ability.area ? { ...ability.area } : ability.area, lensed: [] };
    if (!inForm(player)) return out;
    for (const { lens, ability: on } of player.form.lenses || []) {
      if (on !== ability.id) continue;
      const m = L[lens].mods;
      if (m.potencyMul) out.potency = Math.round((out.potency || 0) * m.potencyMul * 100) / 100;
      if (m.radiusAdd && out.area) { if (out.area.shape === "radius") out.area.radius += m.radiusAdd; else out.area.length = (out.area.length || 1) + m.radiusAdd; }
      if (m.rangeAdd) out.range = Math.max(0, (out.range || 0) + m.rangeAdd);
      if (m.durationAdd) { out.duration += m.durationAdd; out.deepRootsAdded = m.durationAdd; }
      if (m.livingReach) out.livingReach = m.livingReach;   // engine: allow +3 only when conduitRoute reaches the target tile
      out.lensed.push(lens);
    }
    return out;
  }
  // Self lens mods (Rooted) for movement and shoves.
  function selfMods(player) {
    const m = { displacementResist: 0, moveAdd: 0 };
    if (inForm(player)) for (const { lens } of player.form.lenses || []) if (L[lens].on === "self") for (const k in m) m[k] += L[lens].mods[k] || 0;
    return m;
  }
  function onExpiry(effects, ownerId) {
    return effects.flatMap((e) => {
      if (e.owner !== ownerId || !e.deepRootsAdded) return [e];
      const left = e.turnsLeft - e.deepRootsAdded;
      return left > 0 ? [{ ...e, turnsLeft: left, deepRootsAdded: 0 }] : [];
    });
  }

  return { livingTiles, conduitRoute, livingConduit, lensSupports, lensValid, equipLens, commit, selfMods, onExpiry, inForm };
});
