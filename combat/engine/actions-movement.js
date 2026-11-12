"use strict";
// Actions, the movement family: fleeBattle, astralProject, astralReturn, move, jump, climb, disengage.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsMovement = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { C, ClassRuntime, DIRS, Sealing, Vows, applyEntryEffects, applyFall, barrierAt, classH, currentId, dist, endTurn, fleeBattle, footprint,
      hasSight, heightAt, hit, inside, key, log, moveBudgetFor, onEdge, paths, presidentRules, presidentUnits, settleHomeward, spendTempo,
      strikeTarget, syncPickup, tileAt, unitAt, vegetation } = H;
    const { Orders, applyTerrainEvents, climbCost, climbOptions, engineArena, footOpen, grappled, isKraken, jumpCost, moduleArena, moveCost,
      moveRefusal, movementTempoCost, provokeOpportunity, sized, waterAt } = K;
    const family = {
      fleeBattle(s, a) {   // C8: only a routed unit standing on the edge of the map
        if (!a.routed) return "Only a routed unit flees.";
        if (s.film) return "The set is enclosed: there is nowhere to run.";   // Mala, 2026-10-19: no exits but CUT, ruin, or the twelfth take
        if (!onEdge(s, a)) return "It has not reached the edge of the map.";
        if (a.soulOf) { const err = H.returnSoul(s, a, "flee"); if (err) return err; if (!s.outcome && currentId(s) === a.id) endTurn(s); return; }   // a soul that breaks does not leave the battle: it wakes in its body
        fleeBattle(s, a); for (const e of (Sealing?.onSealerDown?.(s, a) || [])) log(s, { kind: "seal", actor: e.foe, text: e.text }); if (!s.outcome && currentId(s) === a.id) endTurn(s);   // W2.3: a fled sealer's binds drop
      },
      // Astral projection (pocket model, Mala 2026-10-24): a ritual. The soul leaves the body for the
      // sealed pocket east of the world and fights there as its own fighter on its SF bar. The body lies
      // soulless; projecting ends the body's turn. Mirrors of every enemy and creature coalesce on entry.
      astralProject(s, a, act) {
        const R = s.rules.astral; if (!R) return "Astral projection is unavailable.";
        const no = H.astralProjectValidate(s, a); if (no) return no;
        const spend = spendTempo(s, a, R.ap, "Astral projection"); if (spend) return spend;
        H.projectSoul(s, a);
      },
      // The only exit anyone chooses: the soul must stand on the astral portal tile. Free.
      astralReturn(s, a, act) {
        if (!s.rules.astral) return "Astral projection is unavailable.";
        if (!a.soulOf) return "Only a projected soul returns through the portal.";
        return H.returnSoul(s, a, "portal");
      },
      move(s, a, act) {
        { const refused = moveRefusal(s, a); if (refused) return refused; }   // the reasons a unit cannot move at all, shared with Scramble
        const [tx, ty] = act.to || [];
        if (isKraken(a) && tx != null && !waterAt(s, tx, ty)) return "The kraken cannot leave the water.";
        if((a.committed?.noRetreat||a.promise?.surrender==="retreat")&&presidentRules&&!presidentRules.canMove({...presidentUnits(s).find(u=>u.id===a.id),committed:{noRetreat:true}},{x:tx,y:ty},presidentUnits(s).filter(u=>u.side!==a.side)))return "Your commitment has surrendered retreat: that move would increase your distance from the nearest enemy.";
        const baseBudget = H.Injury.moveBudget(s, a, moveBudgetFor(s, a) - (a.pathwayPromise ? 2 : 0));   // the homeward extra sits on top of the legs-adjusted base
        const budget = H.Injury.moveBudget(s, a, moveBudgetFor(s, a)), route = paths(s, a.x, a.y, budget, "move").pathTo(tx, ty);   // Injury: the move action reads the same legs budget as moveOptions (wounded −1, maimed 0)
        if (!route || route.length < 2) return `Not reachable within ${budget} move points.`;
        const from = [a.x, a.y], spent = paths(s, a.x, a.y, budget, "move").dist.get(key(tx, ty));
        if (a.pathwayPromise && spent > baseBudget && dist(s, tx, ty, a.pathwayPromise.x, a.pathwayPromise.y) >= dist(s, a.x, a.y, a.pathwayPromise.x, a.pathwayPromise.y)) return "The extra homeward movement is only available when this move reduces distance to the declared destination.";
        const dir = H.directiveLive(s, a);   // destination directives (machine P2): a live directive names the next endpoint
        const dirOpen = dir && H.directiveDestOpen(s, a, dir.dest);
        const dirObeys = dir && tx === dir.dest[0] && ty === dir.dest[1];
        if (dirOpen && !dirObeys && !act.defyDirective) return `${a.name} must move to (${dir.dest[0]},${dir.dest[1]})${dir.label ? ` (${dir.label})` : ""}.`;
        if (dirOpen && !dirObeys && dir.defyCost == null) return `${a.name} cannot defy ${dir.label || "the directive"}.`;
        const moveCost = movementTempoCost(s, a, route) + (dirOpen && !dirObeys ? dir.defyCost : 0);
        const spendError = spendTempo(s, a, moveCost, "Move"); if (spendError) return spendError;
        H.consumeMoveMods(s, a, route);   // movement money (machine P1): a paid move spends once-mods
        a.moved = true; a.walkedThisTurn = (a.walkedThisTurn || 0) + route.length - 1; const traversed = [from];
        for (const [x, y] of route.slice(1)) {
          const prev = [a.x, a.y]; a.x = x; a.y = y; traversed.push([x, y]);
          const drop = heightAt(s, prev[0], prev[1]) - heightAt(s, x, y);
          if (drop > 0) applyFall(s, a, a, heightAt(s, prev[0], prev[1]), heightAt(s, x, y), true, "walking");
          applyEntryEffects(s, a, a, x, y);
          if (a.awakened && !a.defeated) {   // Tsukumogami trample: walkable objects on newly-entered tiles take objectDamagePerTile
            const was = new Set(footprint({ ...a, x: prev[0], y: prev[1] }).map(([qx, qy]) => qx + "," + qy));
            for (const [qx, qy] of footprint(a)) {
              if (was.has(qx + "," + qy)) continue;
              const o = (s.arena.objects || []).find((q) => q.x === qx && q.y === qy);
              const per = o && !o.protected ? vegetation?.data?.rules?.collision?.objectDamagePerTile || 0 : 0;
              if (!per) continue;
              const r = vegetation.damageObject(moduleArena(s.arena), o.id, per, { from: prev, channel: "nigredo" });
              s.arena = engineArena(r.arena); applyTerrainEvents(s, a, r.events);
              log(s, { kind: "trample", actor: a.id, tiles: [[qx, qy]], text: `${a.name} tramples ${vegetation.label(o)}.` });
            }
          }
          if (!a.defeated && syncPickup) syncPickup(s, a);   // loot v1: stepping onto a pickup tile collects it (hands free)
          if (a.defeated) break;
          provokeOpportunity(s, a, prev, [x, y]);
          if (a.defeated) break;
        }
        if (a.awakened && a.awakened.size >= 3 && !a.defeated) {   // Tsukumogami: a size-3 footfall staggers every unit it ends beside, like a slam
          const tiles = footprint(a), near = new Set();
          for (const [qx, qy] of tiles) for (const [dx, dy] of DIRS) near.add((qx + dx) + "," + (qy + dy));
          for (const u of Object.values(s.actors)) {
            if (u.id === a.id || u.defeated || !footprint(u).some(([qx, qy]) => near.has(qx + "," + qy))) continue;
            if (H.eatShock(s, u, "stagger")) continue;
            u.status.stagger = { label: "Stagger", owner: u.id, expiresAt: u.ownerTurns + (H.staggerTurns?.(s, u) ?? 1) };
            if (u.id === (s.modeSetup?.hero || "player")) (s.dreamRecent ||= {}).heroStaggered = true;   // Last Span counts it, by the dream's ledge rule
            log(s, { kind: "stagger", actor: a.id, target: u.id, text: `${a.name}'s footfall staggers ${u.name}.` });
          }
        }
        if(!a.defeated)for(const hunter of Object.values(s.actors)){
          const ambush=hunter.status.ambush;
          if(!ambush||ambush.expiresAt<=hunter.ownerTurns||hunter.side===a.side||ambush.hit?.includes(a.id))continue;
          if(dist(s,from[0],from[1],hunter.x,hunter.y)>dist(s,a.x,a.y,hunter.x,hunter.y)){
            ambush.hit||=[];ambush.hit.push(a.id);
            hit(s,hunter,a,{ability:"feignedRetreat",name:"Feigned Retreat",concept:"deception",delivery:"contact",damageType:"albedo",tier:"refined"},ambush.potency,["The opponent ended a move closer during the ambush window."]);
          }
        }
        if(!a.defeated)for(const watcher of Object.values(s.actors)){   // Overwatch (Muse-2): a foe stepping from outside to inside the watched ring eats the snapshot
          const ow=watcher.status.overwatch;
          if(!ow||ow.expiresAt<=watcher.ownerTurns||watcher.defeated||watcher.side===a.side||watcher.id===a.id)continue;
          if(dist(s,from[0],from[1],watcher.x,watcher.y)<=ow.range||dist(s,a.x,a.y,watcher.x,watcher.y)>ow.range)continue;
          const conc=a.status.concealed; if(conc&&(conc.until==null||conc.until>=a.ownerTurns))continue;   // concealed: never seen entering
          if(!hasSight(s,watcher.x,watcher.y,a.x,a.y))continue;   // walls still hide the approach
          watcher.status.overwatch=null; watcher.tempoDebt=(watcher.tempoDebt||0)+ow.owed;
          log(s,{kind:"trigger",actor:watcher.id,target:a.id,text:`${watcher.name}'s Overwatch fires on ${a.name} (${ow.owed} AP owed next turn).`});
          strikeTarget(s,watcher,a,{name:"Overwatch snapshot",ability:"overwatch",concept:null,delivery:"line",damageType:"albedo",range:ow.range},ow.potency,["Overwatch: the watcher held their reaction for this shot."]);
        }
        if (ClassRuntime?.moved && !s.preview) ClassRuntime.moved(s, a, from, traversed, classH());   // Ranger: the route just walked is a readable trail
        if (a.character === "odysseus") a.walked = [...new Set([...(a.walked || []), ...traversed.map(([x,y]) => key(x,y))])];
        log(s, { kind: "move", actor: a.id, path: traversed, cost: spent, text: `${a.name} moves ${spent} move point${spent === 1 ? "" : "s"} to (${a.x},${a.y}).` });
        if (!a.defeated) H.consumeDirective(s, a, [a.x, a.y], !!(dirOpen && !dirObeys));   // directives (machine P2): obeyed or defied, the move spends it
        if (!a.defeated) H.refundMove(s, a, route);   // movement money (machine P1): a completed walk pays refunds
        if (a.status.heldTones && a.walkedThisTurn > (C.concepts.solfeggio?.tones.moveBreak ?? 2)) {   // Solfeggio: moving breaks the hold
          a.status.heldTones = null;
          log(s, { kind: "effect", actor: a.id, text: `${a.name} moves too far and the held tones break.`, why: ["The verses are lost; Hold the Tone starts the bank again."] });
        }
        settleHomeward(s, a);
        if (!s.preview && !a.defeated) Orders()?.onMove(s, a, from, H);   // admiration: first to close with a formed enemy
      },
      jump(s, a, act) {
        { const hold = H.relocationHold(s, a); if (hold) return hold; }   // root, position lock, full entangled hold: same as Move
        if ((H.Injury?.gradeOf(a, "legs") || 0) === 2) return "Maimed legs can't jump: no voluntary movement.";
        if (a.soulless) return "The body lies soulless while its soul is out.";
        if (grappled(s, a)) return `${a.name} is held and cannot move.`;
        if (Vows) { const no = Vows.refuses(s, a, "move"); if (no) return no; }   // Vows: Rooted
        const spendError = a.tempo < jumpCost(s, a) ? `Jump needs ${jumpCost(s, a)} action points (have ${a.tempo}).` : null;
        if (spendError) return spendError;
        const [tx, ty] = act.to || [];
        if (isKraken(a) && tx != null && !waterAt(s, tx, ty)) return "The kraken cannot leave the water.";
        if (!inside(s, tx, ty) || dist(s, a.x, a.y, tx, ty) !== 1) return "Jump to an adjacent tile.";
        const drop = heightAt(s, a.x, a.y) - heightAt(s, tx, ty);
        if (drop < 2) return "Jump is only needed for a drop of 2 or more levels.";
        if (tileAt(s, tx, ty).blocksMove || (barrierAt(s, tx, ty) && !barrierAt(s, tx, ty).passable) || unitAt(s, tx, ty)) return "The landing tile is blocked.";
        if (sized(a) && !footOpen(s, a, tx, ty, "move")) return "The landing has no room for the whole body.";   // TS-01: a big body must fit its footprint where it lands
        const from = [a.x, a.y], fromHeight = heightAt(s, a.x, a.y); spendTempo(s, a, jumpCost(s, a), "Jump"); a.x = tx; a.y = ty; a.moved = true; if (!s.preview) ClassRuntime?.mise?.moved(s, a, classH());
        applyFall(s, a, a, fromHeight, heightAt(s, tx, ty), true, "jumping"); applyEntryEffects(s, a, a, tx, ty);
        if (!a.defeated) provokeOpportunity(s, a, from, [tx, ty]);
        log(s, { kind: "jump", actor: a.id, path: [from, [tx, ty]], text: `${a.name} jumps down ${drop} levels to (${tx},${ty}).` });
      },
      climb(s, a, act) {
        { const hold = H.relocationHold(s, a); if (hold) return hold; }   // root, position lock, full entangled hold: same as Move
        if ((H.Injury?.gradeOf(a, "legs") || 0) === 2) return "Maimed legs can't climb: no voluntary movement.";
        if (a.soulless) return "The body lies soulless while its soul is out.";
        if (grappled(s, a)) return `${a.name} is held and cannot move.`;
        if (Vows) { const no = Vows.refuses(s, a, "move"); if (no) return no; }   // Vows: Rooted
        const [tx, ty] = act.to || [];
        if (isKraken(a) && tx != null && !waterAt(s, tx, ty)) return "The kraken cannot leave the water.";
        if (!climbOptions(s, a.id).some(o => o.to[0] === tx && o.to[1] === ty)) return "Choose an adjacent ledge you can climb.";   // TS-01: climbOptions already drops ledges the whole footprint cannot fit
        const climbCost = H.climbCost(s, a);
        const spendError = spendTempo(s, a, climbCost, "Climb"); if (spendError) return spendError;
        const from = [a.x, a.y], rise = heightAt(s, tx, ty) - heightAt(s, a.x, a.y); a.x = tx; a.y = ty; a.moved = true; if (!s.preview) ClassRuntime?.mise?.moved(s, a, classH());
        log(s, { kind: "climb", actor: a.id, path: [from, [tx, ty]], text: `${a.name} climbs ${rise} levels to (${tx},${ty}); the climb uses the main action.` });
        applyEntryEffects(s, a, a, tx, ty);
        if (!a.defeated) provokeOpportunity(s, a, from, [tx, ty]);
      },
      disengage(s, a) {   // provisional 15 AP: the rest of this turn, leaving a reach draws no opportunity attack
        if (a.disengageTurn === a.ownerTurns) return "Already disengaged this turn.";
        const cost = s.rules.opportunity?.disengageAp ?? 15;
        const spendError = spendTempo(s, a, cost, "Disengage"); if (spendError) return spendError;
        a.disengageTurn = a.ownerTurns;
        log(s, { kind: "act", actor: a.id, text: `${a.name} disengages (${cost} AP): leaving a reach this turn draws no swing.` });
      },
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-movement.js)`);
    Object.assign(K.handlers, family);
  })();
});
