"use strict";
// Targeting, shared by validation, preview and the AI.
// A part of the Concept Combat engine, split out of engine.js on 2026-10-11 (tools/split-engine.mjs). It is not a
// module in its own right: engine.js installs it with the host object H (everything the engine closure has in
// scope) and it hands back the functions it defines. Function bodies are exactly as they were in engine.js.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).targeting = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { ClassRuntime, DIRS, MaidSystems, Parley, Performers, Stealth, ab, actorAt, barrierAt, classH, dist, dreamCanReach, gradeableSoil, hasSight, hasTrait, heightAt,
      inside, line, patchAt, paths, presidentCanRecognize, presidentEffects, presidentUnits, surfaceAt, tileAt } = H;

    // ── targeting (shared by validation, preview and AI) ───────────────────
    function areaTiles(s,a,m,tx,ty) { return rawAreaTiles(s,a,m,tx,ty).filter(([x,y])=>dreamCanReach(s,a,m,x,y)); }
    function rawAreaTiles(s, a, m, tx, ty) {
      const shp = m.area.shape;
      if (shp === "radius") {
        const out = [];
        for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) {
          const d = dist(s, a.x, a.y, x, y); if (d > 0 && d <= m.area.radius) out.push([x, y]);
        }
        return out;
      }
      if (shp === "plus") return [[tx, ty], ...DIRS.map(([dx, dy]) => [tx + dx, ty + dy])].filter(([x, y]) => inside(s, x, y) && !tileAt(s, x, y).blocksMove);
      if (shp === "line") {
        const path = line(a.x, a.y, tx, ty).slice(1, 1 + (m.area.length || 999));
        if (m.effect !== "paleStampede") return path;   // the stampede tramples the line and the ground beside it
        const out = new Map();
        for (const [x, y] of path) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(s, x + dx, y + dy)) out.set(`${x + dx},${y + dy}`, [x + dx, y + dy]);
        return [...out.values()];
      }
      if (shp === "ring") {
        const gap={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]}[m.gap||"north"]||[0,-1];
        const r=m.area.radius||1,out=[];
        for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if((dx||dy)&&!(dx===gap[0]&&dy===gap[1])&&inside(s,tx+dx,ty+dy)&&!tileAt(s,tx+dx,ty+dy).blocksMove)out.push([tx+dx,ty+dy]);
        return out;
      }
      return [[tx, ty]];
    }
    function effectiveRange(s, a, m, x, y) {
      const routeAdd = a.status.routeBudget?.expiresAt > a.ownerTurns ? a.status.routeBudget.amount : 0;
      const tide = m.delivery === "placed" && m.concept === "swale" && hasTrait?.(a, "tideReader") ? 1 : 0;   // Pearl Diver: Tide-Reader places swale effects 1 farther
      const base = (m.delivery === "routed" ? m.routeBudget + routeAdd : m.range) + tide;
      if (m.delivery !== "line" && m.delivery !== "placed") return base;
      const downhill = Math.min(2, Math.max(0, heightAt(s, a.x, a.y) - heightAt(s, x, y)));
      const exposed = actorAt(s, x, y) && heightAt(s, x, y) >= 2 ? 1 : 0;
      const buff=m.delivery==="line"&&a.status.rangeBuff?.expiresAt>a.ownerTurns?a.status.rangeBuff.amount:0;
      return base + downhill + exposed + buff;
    }
    // Returns { ok, error, tiles, route, targets } for using ability m from actor a at (tx,ty).
    function target(s, a, m, tx, ty, action = {}) {
      const entr = a && !a._entrFlip && a.status?.entranced && (a.status.entranced.until == null || a.status.entranced.until >= a.ownerTurns);
      const loosed = !entr && a && !a._entrFlip && H.States?.anySide(a);   // Cure: a loosed unit chooses with allegiance off (a side no one shares)
      const real = entr || loosed ? a.side : null;
      if (entr) a.side = real === "player" ? "enemy" : "player";   // the entranced perceive sides swapped
      else if (loosed) a.side = H.States.anySideOf(a);
      try {
        if (tx != null && (m.delivery === "line" || m.delivery === "routed")) {
          const occ = actorAt(s, tx, ty);
          if (!m.scribedEffects?.some(e=>e.key==="reveal") && occ && !occ.defeated && Stealth?.concealed(occ) && !Stealth?.markerEats(s, occ) && !ClassRuntime?.Martial?.seesHidden?.(a) && !(hasTrait?.(a, "gyoEyes") && dist(s, a.x, a.y, occ.x, occ.y) <= 3))
            return { ok: false, error: `${occ.name} cannot be seen (Concealed).` };
        }
        // Big units (Mala, 2026-10-27: "they can be targeted from any tile theyre standing on"): a single-target technique
        // aimed at any tile of a multi-tile unit aims at that unit's best tile — in reach and in sight first, then the
        // nearest, then the tile clicked — so range, sight, the line and the hit all agree on the unit, not its anchor.
        const big = tx != null && (!m.area || m.area.shape === "single") && actorAt(s, tx, ty);
        if (big && big.id !== a.id && ((big.size?.w || 1) > 1 || (big.size?.h || 1) > 1)) {
          const score = ([x, y]) => [dist(s, a.x, a.y, x, y) <= effectiveRange(s, a, m, x, y) && (m.delivery !== "line" || hasSight(s, a.x, a.y, x, y)) ? 0 : 1, dist(s, a.x, a.y, x, y), x === tx && y === ty ? 0 : 1];
          const best = H.footprint(big).map((p) => [p, score(p)]).sort((p, q) => p[1][0] - q[1][0] || p[1][1] - q[1][1] || p[1][2] - q[1][2])[0][0];
          const r = targetInner(s, a, m, best[0], best[1], action);
          return r.ok ? { ...r, aim: best } : r;
        }
        return targetInner(s, a, m, tx, ty, action);
      } finally { if (entr || loosed) a.side = real; }
    }
    function targetInner(s, a, m, tx, ty, action = {}) {
      if (tx != null && !dreamCanReach(s,a,m,tx,ty)) return {ok:false,error:"The sealed Dream Space blocks this technique. Only an applicable boundary-penetrating delivery can cross."};
      const fail = (error) => ({ ok: false, error });
      if (m.oncePerTurn && (a.onceTurns || {})[m.ability] === a.ownerTurns) return fail(`${m.name || "That technique"} can be used once per turn.`);
      if (m.oncePerBattle && (a.onceBattle || {})[m.ability]) return fail(`${m.name || "That technique"} can be used once per battle.`);   // J6: techniques are once a battle
      if (m.everyOtherTurn && (a.onceTurns || {})[m.ability] != null && a.ownerTurns - (a.onceTurns || {})[m.ability] < 2) return fail(`${m.name || "That technique"} must lapse a turn before it can be set again.`);   // J6r: stone breathes — never twice running
      if (m.effect === "architectDesign") {   // raise/lower modal: your own screen lowers, clear ground raises
        if (a.character !== "architect") return fail("Only the Architect can revise live battlefield designs.");
        if (tx == null || !inside(s, tx, ty) || dist(s, a.x, a.y, tx, ty) > m.range || !hasSight(s, a.x, a.y, tx, ty)) return fail("Choose a visible design point within reach.");
        if (s.barriers.some(b => b.x === tx && b.y === ty && b.owner === a.id && b.architectDesign)) return { ok: true, tiles: [[tx, ty]], lower: true };
        const tiles = areaTiles(s, a, m, tx, ty);
        if (!tiles.length || tiles.length > 4) return fail("A defensive screen needs one to four line segments.");
        for (const [x,y] of tiles) if (actorAt(s,x,y) || barrierAt(s,x,y) || tileAt(s,x,y).blocksMove || s.arena.objects?.some(o => o.x === x && o.y === y && o.blocksMove)) return fail(`The design line is blocked at (${x},${y}).`);
        return { ok: true, tiles };
      }
      const songError=Performers?.beforeAbility(s,a,m);if(songError)return fail(songError);
      if (ClassRuntime && m.effect === "classEffect") {
        if (m.ability === "clearTheObstruction" && MaidSystems?.canClean(s, a, tx, ty) && dist(s, a.x, a.y, tx, ty) <= 1 && hasSight(s, a.x, a.y, tx, ty))
          return { ok: true, tiles: [[tx, ty]], targets: [], maidFilth: true };
        const resolved = ClassRuntime.target(s, a, m, tx, ty, classH()) || fail("Unknown class effect.");
        return resolved;
      }   // ClassRuntime
      if (ClassRuntime && ab(m.ability)?.classNeeds) { const r = ClassRuntime.beforeAbility({ ...s, cls: s.cls || {} }, a, { ...m, id: m.ability, probe: true }, classH()); if (r) return fail(r); }
      if (["raisePalisade", "raiseFoundry", "foundCity"].includes(m.effect)) {   // Settlement: founding needs open ground in sight and range (Mala, 2026-10-19)
        if (tx == null || !inside(s, tx, ty)) return fail("Choose ground to found on.");
        if (dist(s, a.x, a.y, tx, ty) > m.range) return fail(`Out of founding reach (${m.range}).`);
        if (!hasSight(s, a.x, a.y, tx, ty)) return fail("No clear view to the founding tile.");
        if (actorAt(s, tx, ty)) return fail("Someone stands on that ground.");
        if (barrierAt(s, tx, ty)) return fail("A wall already holds that ground. [opp-barrier-denies-settlement]");
        const raised = s.arena.objects?.find((o) => o.x === tx && o.y === ty);
        if (raised) return fail(`The ${raised.name || raised.type} stands on that ground.`);
        if (tileAt(s, tx, ty).blocksMove) return fail("Foundations need passable ground.");
        return { ok: true, tiles: [[tx, ty]] };
      }
      if (["gradeCut", "gradeFill", "gradeTerrace"].includes(m.effect)) {
        if (tx == null || !inside(s, tx, ty)) return fail("Choose a terrain tile.");
        if (dist(s, a.x, a.y, tx, ty) > effectiveRange(s, a, m, tx, ty)) return fail(`Out of grading reach (${effectiveRange(s, a, m, tx, ty)}).`);
        if (!hasSight(s, a.x, a.y, tx, ty)) return fail("No clear view to the grading tile.");
        if (m.effect !== "gradeTerrace") {
          if (!gradeableSoil(s, tx, ty)) return fail("Cut and fill require open turf or mulch without occupants, objects, or structures.");
          const h = s.arena.height[ty][tx];
          if (m.effect === "gradeCut" && h < 1) return fail("This tile is already at the lowest grade.");
          if (m.effect === "gradeCut" && (a.earthStock || 0) >= 12) return fail("Earth stock is full (12 soil units); place some fill first.");
          if (m.effect === "gradeFill" && !(a.earthStock > 0)) return fail("No cut soil is banked. Excavate a tile before placing fill.");
          if (m.effect === "gradeFill" && h >= 3) return fail("This tile is already at the maximum grade.");
          return { ok: true, tiles: [[tx, ty]] };
        }
        const tiles = areaTiles(s, a, m, tx, ty).filter(([x, y]) => gradeableSoil(s, x, y));
        if (tiles.length < 2) return fail("Watershed Terrace needs at least two clear soil tiles in its catchment.");
        const levels = tiles.map(([x, y]) => s.arena.height[y][x]);
        if (Math.max(...levels) === Math.min(...levels)) return fail("These contours are already level; choose a catchment with a height difference.");
        return { ok: true, tiles };
      }
      if (presidentEffects.has(m.effect)) {
        if (m.effect === "presidentDirection") {
          const ally=inside(s,tx,ty)?actorAt(s,tx,ty):null;
          if(!ally||ally.id===a.id||ally.side!==a.side)return fail("Choose a same-side ally to direct.");
          if(dist(s,a.x,a.y,ally.x,ally.y)>3||!presidentCanRecognize(s,presidentUnits(s).find(u=>u.id===a.id),ally))return fail("That ally must recognize your valid office within your jurisdiction.");
          return {ok:true,tiles:[[tx,ty]],targets:[ally.id]};
        }
        if (tx == null) { tx=a.x; ty=a.y; }
        if (!inside(s,tx,ty)) return fail("Choose a valid target tile.");
        if(m.effect==="presidentPromise"&&dist(s,a.x,a.y,tx,ty)>m.range)return fail(`Choose a promise target within ${m.range} tiles.`);
        const promiseTarget=actorAt(s,tx,ty);
        if (m.effect === "presidentPromise" && !action.objective && promiseTarget && promiseTarget.side!==a.side)
          return {ok:true,tiles:[[a.x,a.y]],targets:[],objective:{kind:"defeat",target:promiseTarget.id}};
        if (m.effect === "presidentPromise" && !action.objective && (tx!==a.x||ty!==a.y))
          return {ok:true,tiles:[[a.x,a.y]],targets:[],objective:{kind:"hold",tile:[tx,ty]}};
        return {ok:true,tiles:areaTiles(s,a,m,a.x,a.y),targets:[],objective:action.objective||null};
      }
      if (m.effect === "anotherWayHome") {
        if (a.primary !== "strategic_commitment" || a.secondary !== "pathway") return fail("Another Way Home requires Strategic Commitment primary and Alternate Pathway secondary.");
        if (a.pathwayPromise) return fail("Another Way Home is already in progress.");
        if (tx == null || !inside(s, tx, ty) || (tx === a.x && ty === a.y)) return fail("Choose a different destination tile.");
        if (actorAt(s, tx, ty) && actorAt(s, tx, ty).side !== a.side) return fail("The destination must be open, not occupied by an opponent.");
        if (!paths(s, a.x, a.y, 99, "route-open").pathTo(tx, ty)) return fail("There is no open route to that destination.");
        return { ok: true, tiles: [[tx, ty]], targets: [] };
      }
      if (m.effect === "sectionCut") {
        if (tx == null || !inside(s, tx, ty)) return fail("Choose a row or column to cut.");
        const axis = action.sectionAxis === "column" ? "column" : "row";
        const tiles = axis === "row" ? Array.from({ length: s.arena.w }, (_, x) => [x, ty]) : Array.from({ length: s.arena.h }, (_, y) => [tx, y]);
        return { ok: true, tiles, section: { axis, index: axis === "row" ? ty : tx } };
      }
      if (m.effect === "project") {
        if (tx == null || !inside(s, tx, ty)) return fail("Choose a source tile for the projection.");
        if (dist(s, a.x, a.y, tx, ty) > m.range) return fail(`Out of projection range (${m.range}).`);
        const prop = action.projectionProperty === "surface" ? "surface" : "height";
        const axis = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] }[action.projectionAxis || "east"];
        if (m.projectFragment) {
          const held = (a.heldFragments || []).find(f => f.id === action.fragmentId);
          if (!held) return fail("Section + Collage needs a held fragment to project.");
        }
        const tiles = [];
        for (let n = 1; n <= 3; n++) {
          const x = tx + axis[0] * n, y = ty + axis[1] * n;
          if (!inside(s, x, y)) break;
          const object = s.arena.objects?.find(o => o.x === x && o.y === y);
          const berm = barrierAt(s, x, y)?.concept === "berm";
          if (actorAt(s, x, y) || object || berm || tileAt(s, x, y).blocksMove || barrierAt(s, x, y)) break;
          tiles.push([x, y]);
        }
        if (!tiles.length) return fail("The projection axis is blocked or runs off the map.");
        const nx = tx + axis[0] * (tiles.length + 1), ny = ty + axis[1] * (tiles.length + 1);
        const stoppedAt = inside(s,nx,ny) && barrierAt(s,nx,ny)?.concept === "berm" ? [nx,ny] : null;
        return { ok: true, tiles, source: [tx, ty], property: prop, axis: action.projectionAxis || "east", stoppedAt };
      }
      if (m.effect === "clip") {
        if (tx == null || !inside(s, tx, ty)) return fail("Choose a fragment source.");
        const onCut = (s.terrainEffects || []).some(e => e.kind === "sectionCut" && e.side === a.side && s.actors[e.owner]?.ownerTurns < e.expiresAt && e.tiles.some(t => t[0] === tx && t[1] === ty));
        if (dist(s, a.x, a.y, tx, ty) > m.range && !(m.clipAlongCut && onCut)) return fail(`Out of clipping range (${m.range}) and not on an active cut.`);
        const kind = action.fragment || "cover", unit = actorAt(s, tx, ty), b = barrierAt(s, tx, ty), object = s.arena.objects?.find(o => o.x === tx && o.y === ty), patch = patchAt(s, tx, ty), surface = surfaceAt(s, tx, ty);
        const eligible = {
          cover: !!(b?.coverFraction > 0 || object?.cover > 0 || tileAt(s, tx, ty).cover > 0),
          water: ["~", "w"].includes(surface),
          mulch: !!(s.barriers || []).find(q => q.x === tx && q.y === ty && q.passiveGround),
          thorns: surface === "*" || tileAt(s, tx, ty).hazard > 0 || object?.trait === "thorns" || object?.status?.hazard > 0,
          absorbOneLine: !!b?.absorbsLine,
          wallProtection10: !!(b && b.protection >= 10 && b.blocksSight !== false),
          membrane: !!unit?.status?.membrane,
          growthStage: !!(patch && patch.stage >= 2 && patch.side !== a.side),
        }[kind];
        if (!eligible) return fail(`There is no ${kind} fragment at (${tx},${ty}).`);
        return { ok: true, tiles: [[tx, ty]], fragment: { kind, at: [tx, ty] } };
      }
      if (m.effect === "paste") {
        const fragment = (a.heldFragments || []).find(f => f.id === action.fragmentId);
        if (!fragment) return fail("Choose one of your held fragments to paste.");
        if (tx == null || !inside(s, tx, ty) || dist(s, a.x, a.y, tx, ty) > m.range) return fail(`Choose a tile within ${m.range} of the pasted fragment.`);
        const unit = actorAt(s, tx, ty);
        if (["ward", "buff", "trait"].includes(fragment.kind)) {   // Cut Out's loot: onto any character, yourself included (Mala, 2026-10-18)
          if (!unit || unit.defeated) return fail("A stolen ward, buff or trait goes onto a character on the tile.");
          if (fragment.kind === "trait" && (unit.traits || []).some((t) => (t?.id || t) === fragment.value.trait)) return fail(`${unit.name} already has that trait.`);
        } else if (fragment.kind === "membrane") {
          if (!unit || unit.side !== a.side || unit.status.membrane) return fail("A membrane fragment needs an unwrapped ally on the tile.");
        } else if (fragment.kind === "growthStage") {
          if (unit || barrierAt(s, tx, ty) || tileAt(s, tx, ty).blocksMove || !tileAt(s, tx, ty).tags?.includes("soil")) return fail("A growth-stage fragment needs open soil.");
        } else if (unit || barrierAt(s, tx, ty) || tileAt(s, tx, ty).blocksMove) return fail("Paste onto an open tile.");
        return { ok: true, tiles: [[tx, ty]], fragment };
      }
      if (m.effect === "montage" && (!m.montageParts || m.montageInvalid)) return fail("Photomontage needs three witnessed, compatible non-ultimate techniques.");
      if (m.effect === "prototype" && (!m.prototypeOf || m.prototypeInvalid)) return fail("Prototype needs one witnessed damaging basic to copy.");
      if (m.effect === "recombine" && (!m.recombineParts || m.recombineInvalid)) return fail("Recombine needs two readied damaging basics that share a delivery (three on Skunkworks).");
      if (m.effect === "oldGrowth" && !(s.successionPatches || []).some(p => p.owner === a.id)) return fail("Old Growth needs at least one living patch you own.");
      if (m.effect === "oldGrowth") return { ok: true, tiles: s.successionPatches.filter(p => p.owner === a.id).map(p => [p.x, p.y]), targets: [] };
      if (m.target === "self" && m.effect !== "barrier") return { ok: true, tiles: areaTiles(s, a, m, a.x, a.y), targets: [] };
      if (tx == null || !inside(s, tx, ty)) return fail("Choose a tile.");
      const occ = actorAt(s, tx, ty) || (s.wild.find((m) => m.form === "unit" && m.x === tx && m.y === ty) ? { ...s.wild.find((m) => m.form === "unit" && m.x === tx && m.y === ty), wild: true, side: "wild", status: {} } : null);
      if(a.status.attention&&m.target==="enemy"&&occ?.id!==a.status.attention.target)return fail("Undivided Attention prevents targeting anyone but the attended opponent.");
      if (m.effect === "prune") {
        const range = effectiveRange(s, a, m, tx, ty);
        if (dist(s, a.x, a.y, tx, ty) > range) return fail(`Out of pruning range (${range}).`);
        if (!hasSight(s, a.x, a.y, tx, ty)) return fail("No clear view to that tile.");
        const blocked = line(a.x, a.y, tx, ty).slice(1).some(([x,y]) => { const b=barrierAt(s,x,y); return b && !b.passable; });
        if (blocked) return fail("A Barrier blocks Pruning; it cannot be bypassed.");
        return { ok: true, tiles: [[tx,ty]], targets: [] };
      }
      if (m.effect === "successionPatch" || m.effect === "nurseLog") {
        const range = effectiveRange(s, a, m, tx, ty);
        if (dist(s, a.x, a.y, tx, ty) > range) return fail(`Out of planting range (${range}).`);
        if (!hasSight(s, a.x, a.y, tx, ty)) return fail("No line of sight to that tile.");
        if (patchAt(s, tx, ty)) return fail("A succession patch already occupies that tile.");
        const obj = s.arena.objects?.find(o => o.x === tx && o.y === ty);
        if (m.effect === "nurseLog") {
          if ((!obj || !["log", "stump"].includes(obj.type)) && (occ || barrierAt(s, tx, ty) || tileAt(s, tx, ty).blocksMove || !tileAt(s, tx, ty).tags?.includes("soil")))
            return fail("Nurse Log needs a felled log or stump, or empty open soil to nurse weakly.");
        } else if (occ || barrierAt(s, tx, ty) || tileAt(s, tx, ty).blocksMove || !tileAt(s, tx, ty).tags?.includes("soil")) {
          return fail("Pioneer Patch needs empty, open soil.");
        }
        return { ok: true, tiles: [[tx, ty]] };
      }
      if (m.effect === "barrier" || m.effect === "berm" || m.effect === "swale") {
        if (m.range === 0) return tx === a.x && ty === a.y ? { ok: true, tiles: [[tx, ty]], self: true } : fail("This lens wards only yourself: target your own tile.");
        const range = effectiveRange(s, a, m, tx, ty);
        if (dist(s, a.x, a.y, tx, ty) > range) return fail(`Out of placement range (${range}).`);
        if ((m.effect === "barrier" && tileAt(s, tx, ty).blocksMove) || occ || barrierAt(s, tx, ty) || tileAt(s, tx, ty).blocksMove) return fail("This effect needs an empty floor tile.");
        if (!hasSight(s, a.x, a.y, tx, ty)) return fail("No line of sight to that tile: opaque terrain blocks the direct view.");
        return { ok: true, tiles: [[tx, ty]] };
      }
      if(["checkDam","rainGarden","fence","contourBerm","bermRing"].includes(m.effect)){
        const range=effectiveRange(s,a,m,tx,ty);
        if(dist(s,a.x,a.y,tx,ty)>range)return fail(`Out of placement range (${range}).`);
        if((m.effect!=="bermRing"&&occ)||tileAt(s,tx,ty).blocksMove||barrierAt(s,tx,ty))return fail("This terrain effect needs clear ground.");
        if(!hasSight(s,a.x,a.y,tx,ty))return fail("No line of sight to that tile.");
        return {ok:true,tiles:areaTiles(s,a,{...m,gap:action.gap},tx,ty)};
      }
      if (m.target === "ally") {
        if (!occ || occ.side !== a.side) return fail("Choose an ally (or yourself).");
        const range = effectiveRange(s, a, m, tx, ty);
        if (dist(s, a.x, a.y, tx, ty) > range) return fail(`Out of range (${range}).`);
        return { ok: true, tiles: [[tx, ty]], targets: [occ.id] };
      }
      if (m.effect === "fly") {   // J6 Short Flight: anything between is ignored, but the landing must be open ground (no sight needed: the soul knows the way)
        const range = effectiveRange(s, a, m, tx, ty);
        if (dist(s, a.x, a.y, tx, ty) > range || (tx === a.x && ty === a.y)) return fail(`Fly to open ground within ${range}.`);
        if (occ) return fail("Someone stands on the landing ground.");
        if (barrierAt(s, tx, ty)) return fail("A wall holds the landing ground.");
        if (tileAt(s, tx, ty).blocksMove) return fail("Short Flight needs open ground to land on.");
        return { ok: true, tiles: [[tx, ty]] };
      }
      if (m.effect === "twist") {   // J6 Plot Twist: trade places with someone you can see (anchored bodies refuse)
        if (!occ || occ.defeated || occ.id === a.id) return fail("Choose another unit you can see.");
        const range = effectiveRange(s, a, m, tx, ty);
        if (dist(s, a.x, a.y, tx, ty) > range) return fail(`Out of range (${range}).`);
        if (!hasSight(s, a.x, a.y, tx, ty)) return fail("No line of sight to that unit.");
        if (occ.status?.immovable || occ.status?.anchor) return fail(`${occ.name} is anchored: the plot cannot twist them.`);
        return { ok: true, tiles: [[tx, ty]], targets: [occ.id] };
      }
      const seen = H.Instinct.hidden(a, occ) ? null : occ;   // a lying foe reads as an empty tile to a direct hit (same refusal text)
      if (m.delivery === "routed") {
        if (!seen || seen.side === a.side) return fail("Choose an opponent.");
        if (Parley && !occ.wild) { const no = Parley.blocks(s, a, occ); if (no) return fail(no); }   // Parley: talked down refuses before payment, like Strike
        const P = paths(s, a.x, a.y, m.routeBudget, "route", [tx, ty]);
        const route = P.pathTo(tx, ty);
        if (!route) {
          const open = paths(s, a.x, a.y, 99, "route", [tx, ty]).pathTo(tx, ty);
          return fail(open ? `No route within ${m.routeBudget} (shortest open route is ${open.length - 1}).` : "No route: every path is enclosed.");
        }
        return { ok: true, tiles: areaTiles(s, a, m, tx, ty), route, targets: [occ.id] };
      }
      // line / contact
      const range = effectiveRange(s, a, m, tx, ty);
      if (dist(s, a.x, a.y, tx, ty) > range) return fail(`Out of range (${range}).`);
      if (m.target === "enemy" && (!seen || (seen.side === a.side && !(H.isMonster(a) && a.drawback === "mindless" && occ.id !== a.summoner)))) return fail("Choose an opponent.");   // the mindless Zombie bites its own side too
      if (m.target === "enemy" && occ && Parley && !occ.wild) { const no = Parley.blocks(s, a, occ); if (no) return fail(no); }   // Parley: talked down refuses before payment, like Strike
      if (tx === a.x && ty === a.y) return fail("Choose another tile.");
      if (m.delivery === "line" && !hasSight(s, a.x, a.y, tx, ty)) return fail("No line of sight: opaque terrain blocks the direct view.");
      if (m.effect === "orbitalDrop") {   // the Citadel needs open ground at the line's end
        if (actorAt(s, tx, ty)) return fail("Someone stands on the landing ground.");
        if (barrierAt(s, tx, ty)) return fail("A wall already holds the landing ground.");
        const raised = s.arena.objects?.find((o) => o.x === tx && o.y === ty);
        if (raised) return fail(`The ${raised.name || raised.type} stands on the landing ground.`);
        if (tileAt(s, tx, ty).blocksMove) return fail("The Citadel needs passable ground to land on.");
      }
      return { ok: true, tiles: areaTiles(s, a, m, tx, ty), targets: occ ? [occ.id] : [] };
    }

    return { areaTiles, rawAreaTiles, effectiveRange, target };
  })();
});
