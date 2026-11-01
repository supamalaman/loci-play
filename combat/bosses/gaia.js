"use strict";
// Gaia, boss of the wild types and conditional ally (Mala, 2026-10-08). Her form follows the LANDSCAPE'S
// CONDITION: the Wounded Ground while the encounter's threatened function is damaged; the Living Accord once
// it is restored and she is understood. Renewed violations can turn her back, but she warns first.
// Pure functions; data in boss-data.js (bosses.gaia, ecology, disturbance, wildTypes, accord).
//
//   ecologyOf(arena, ctx)                          → { water, habitat, soil, canopy, mean }  each 0..1
//   init({ threatened, allySide })                 → gaia state (ledger, form, warnings)
//   recordDisturbance(g, { actor, side, kind, round, eco }) → { g, events }
//   target(g, units, { defend })                   → { target, events }   the source of disturbance; seam tell
//   majorTell(g, ability)                          → crown-contracts event for the turn before, or null
//   accordProgress(g, { eco, deck, know })         → { earned, missing, target }
//   endOfRound(g, gaiaActor, { eco, deck, know, round }) → { g, actor, events }  transition, warnings, reversal
//   summonWildTypes(g, arena, gaiaActor, eco, ctx)  → { spawns, events }
//   supportMul(eco)                                 → Living Accord support potency multiplier
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./boss-data.js"), require("./gaia-form.js"), require("../terrain/terrain-data.js"));
  else root.ConceptCombatGaia = factory(root.ConceptCombatBossData, root.ConceptCombatGaiaForm, root.ConceptCombatTerrain);
})(typeof self !== "undefined" ? self : this, function (BD, GF, TD) {
  const E = BD.ecology, A = BD.accord, GB = BD.bosses.gaia, key = (x, y) => x + "," + y;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  // ctx: { baselineTrees, dead: [[x,y]] (burnt/cleared), scars: [[x,y]] (rubble, bare ground), patches,
  //        waterFeatures (active swales/rain gardens/check dams), waterNeeded (default 2), acts: [restoration act ids] }
  function ecologyOf(arena, ctx = {}) {
    const trees = (arena.objects || []).filter((o) => !o.destroyed && o.type === "tree").length;
    const canopy = clamp01(trees / Math.max(1, ctx.baselineTrees ?? trees));
    const live = GF.livingTiles(arena, { patches: ctx.patches || [], dead: ctx.dead || [] });
    let biggest = 0; const seen = new Set();
    for (const k of live) {
      if (seen.has(k)) continue;
      let n = 0; const q = [k]; seen.add(k);
      while (q.length) { const [x, y] = q.pop().split(",").map(Number); n++; for (const [dx, dy] of N4) { const nk = key(x + dx, y + dy); if (live.has(nk) && !seen.has(nk)) { seen.add(nk); q.push(nk); } } }
      biggest = Math.max(biggest, n);
    }
    const habitat = live.size ? biggest / live.size : 0;
    const soilTiles = arena.map.join("").split("").filter((ch) => (TD.terrain[ch]?.tags || []).includes("soil")).length;
    const scars = (ctx.scars || []).length + (ctx.dead || []).length;
    const soil = clamp01(1 - scars / Math.max(4, 0.2 * soilTiles));
    const water = clamp01((ctx.waterFeatures || 0) / (ctx.waterNeeded || 2));
    const eco = { water, habitat, soil, canopy };
    for (const act of ctx.acts || []) { const f = A.restorationActs[act]; if (f) eco[f] = clamp01(eco[f] + 0.15); }
    for (const k of Object.keys(eco)) eco[k] = Math.round(eco[k] * 100) / 100;
    eco.mean = Math.round(((eco.water + eco.habitat + eco.soil + eco.canopy) / 4) * 100) / 100;
    return eco;
  }

  function init({ threatened = "habitat", allySide = "player" } = {}) {
    // This module is the 2026-10-08 restoration model (Wounded Ground first, the Accord earned by restoring the land).
    // The battle runtime follows Mala's 2026-10-14 ruling instead (Accord first; engine/land.js) and does not load it.
    return { form: "disturbed", threatened, allySide, ledger: {}, violations: 0, warned: null, alliedSince: null };
  }

  function recordDisturbance(g, { actor, side, kind, round = 0, eco = null }) {
    const w = BD.disturbance[kind] || 0, events = [];
    const next = { ...g, ledger: { ...g.ledger, [actor]: (g.ledger[actor] || 0) + w } };
    if (side === g.allySide) next.violations = g.violations + 1;
    if (g.form === "restored" && side === g.allySide && !g.warned) {
      const endangered = eco ? Object.keys(E.functions).sort((a, b) => eco[a] - eco[b])[0] : g.threatened;
      next.warned = { round, by: actor, function: endangered };
      events.push({ kind: "gaiaWarning", actor: "boss-gaia", function: endangered,
        text: `Gaia's chest landscape dims along its ${E.functions[endangered].name.toLowerCase()}. ${E.functions[endangered].damage} One round to make it right.` });
    }
    return { g: next, events };
  }

  // The Wounded Ground watches the source of disturbance, not everyone.
  function target(g, units, { defend = null } = {}) {
    if (g.form !== "disturbed") return { target: null, events: [] };
    const living = units.filter((u) => u.lf > 0 && u.side !== "wild");
    const scored = living.map((u) => ({ u, s: g.ledger[u.id] || 0, d: defend ? Math.abs(u.x - defend[0]) + Math.abs(u.y - defend[1]) : 0 }))
      .sort((a, b) => b.s - a.s || a.d - b.d);
    const t = scored[0];
    if (!t || (t.s === 0 && !defend)) return { target: null, events: [] };
    return { target: t.u.id, events: [{ kind: "gaiaTell", tell: "defend", toward: [t.u.x, t.u.y], text: GB.forms.disturbed.tells.defend }] };
  }

  function majorTell(g, ability) {
    if (g.form !== "disturbed" || !ability) return null;
    const major = ability.announce || GB.enragedUnlocks[ability.id] || ability.effect === "summon";
    return major ? { kind: "gaiaTell", tell: "major", text: GB.forms.disturbed.tells.major } : null;
  }

  function accordProgress(g, { eco, deck, know }) {
    const goal = Math.min(1, E.restoredAt + g.violations * A.violationsRaiseTheBar), missing = [];
    const have = eco?.[g.threatened] ?? 0;
    if (have < goal) missing.push(`${E.functions[g.threatened].name} restored to ${Math.round(goal * 100)}% (now ${Math.round(have * 100)}%)`);
    const hidden = (deck?.cards || []).filter((c) => !(know?.revealed || []).includes(c.id)).length;
    if (!deck || hidden > 0) missing.push(deck ? `${hidden} thing${hidden === 1 ? "" : "s"} about Gaia you don't understand yet` : "Observe Gaia");
    return { earned: missing.length === 0, missing, target: goal };
  }

  function becomeForm(actor, form) {
    const f = GB.forms[form];
    return { ...actor, gaiaForm: form, name: f.name, side: f.hostile ? "wild" : actor.allySide || "player", size: { ...f.size }, massive: f.size.w > 1,
      abilities: form === "restored" ? Object.keys(GB.supportAbilities) : Object.keys(GB.abilities).concat(actor.conditions?.enraged ? Object.keys(GB.enragedUnlocks) : []) };
  }

  function endOfRound(g, actor, { eco, deck, know, round = 0 }) {
    const events = [];
    if (g.form === "disturbed") {
      const p = accordProgress(g, { eco, deck, know });
      if (!p.earned) return { g, actor, events };
      const g2 = { ...g, form: "restored", warned: null, alliedSince: round };
      const a2 = becomeForm({ ...actor, allySide: g.allySide }, "restored");
      for (const step of GB.transition.animation) events.push({ kind: "gaiaTransition", step, text: `Gaia: ${step}.` });
      events.push({ kind: "gaiaAccord", side: g.allySide, scarsRemain: true, text: `"${GB.forms.restored.line}" Gaia joins your side. Her scars stay.` });
      return { g: g2, actor: a2, events };
    }
    // Restored: keep the conditions, keep the accord.
    if (g.warned) {
      const f = g.warned.function, fixed = (eco?.[f] ?? 0) >= E.endangeredBelow;
      if (fixed && round > g.warned.round) {
        events.push({ kind: "gaiaAccordHolds", text: "The seams brighten again. The accord holds." });
        return { g: { ...g, warned: null }, actor, events };
      }
      if (round >= g.warned.round + A.graceRounds) {
        const g2 = { ...g, form: "disturbed", warned: null, ledger: { ...g.ledger, [g.warned.by]: (g.ledger[g.warned.by] || 0) + 5 } };
        events.push({ kind: "gaiaReversal", against: g.warned.by, text: `"${GB.forms.disturbed.line}" The accord breaks. Gaia rises against whoever broke it.` });
        return { g: g2, actor: becomeForm(actor, "disturbed"), events };
      }
    }
    return { g, actor, events };
  }

  // Wounded Ground: wild types emerge from surviving habitat near her. Living Accord: they arrive through
  // an intact habitat route and fight on her side.
  function summonWildTypes(g, arena, actor, eco, ctx = {}) {
    const live = GF.livingTiles(arena, ctx), spawns = [], events = [];
    const kindAt = (x, y) => {
      const o = (arena.objects || []).find((q) => q.x === x && q.y === y && !q.destroyed);
      if (o?.type === "hedge" || o?.type === "shrub") return "understory";
      if (o?.type === "groundcover") return "sporeDrift";
      return "rootTangle";
    };
    const occupied = new Set((ctx.units || []).map((u) => key(u.x, u.y)));
    const free = [...live].map((k) => k.split(",").map(Number)).filter(([x, y]) => !occupied.has(key(x, y)) && !(TD.terrain[arena.map[y][x]] || {}).blocksMove
      && !(arena.objects || []).some((o) => o.x === x && o.y === y && !o.destroyed && o.blocksMove));
    const dist = ([x, y]) => Math.abs(x - actor.x) + Math.abs(y - actor.y);
    if (g.form === "disturbed") {
      const n = 1 + Math.floor((eco?.habitat ?? 0) * 2);      // more survives, more comes
      for (const t of free.sort((a, b) => dist(a) - dist(b) || a[0] - b[0] || a[1] - b[1]).slice(0, n)) spawns.push({ type: kindAt(...t), at: t, side: "wild" });
      if (spawns.length) events.push({ kind: "gaiaSummon", text: `${GB.forms.disturbed.summoning} ${spawns.length} come.` });
    } else {
      // The farthest tile reachable through living terrain within the route budget is where they arrive.
      const reach = free.map((t) => ({ t, r: GF.conduitRoute(arena, [actor.x, actor.y], t, ctx) })).filter((x) => x.r.ok && x.r.path.length >= 3)
        .sort((a, b) => b.r.path.length - a.r.path.length || a.t[0] - b.t[0]);
      if (reach.length) { spawns.push({ type: kindAt(...reach[0].t), at: reach[0].t, side: g.allySide, turns: 3, route: reach[0].r.path }); events.push({ kind: "gaiaSummon", text: GB.forms.restored.summoning }); }
      else events.push({ kind: "gaiaSummon", text: "No intact habitat route: nothing can reach her." });
    }
    return { spawns, events };
  }

  const supportMul = (eco) => Math.round((0.5 + 0.5 * (eco?.mean ?? 0)) * 100) / 100;

  return { ecologyOf, init, recordDisturbance, target, majorTell, accordProgress, endOfRound, summonWildTypes, supportMul, becomeForm, data: BD };
});
