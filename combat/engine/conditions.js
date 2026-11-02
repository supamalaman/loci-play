"use strict";
// Traps, capture ritual and beads, poison, fear and rout, classic dream monsters.
// A part of the Concept Combat engine, split out of engine.js on 2026-10-11 (tools/split-engine.mjs). It is not a
// module in its own right: engine.js installs it with the host object H (everything the engine closure has in
// scope) and it hands back the functions it defines. Function bodies are exactly as they were in engine.js.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).conditions = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { C, Climate, Communion, EM, FEAR, RITUAL, Traps, dist, insightRules, liveSummon, log, summonRules, wildRules } = H;
    const spiritGone = (s, u) => { const Spirit = (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null; Spirit?.onExit?.(s, u, H); };   // SP-05: every exit refreshes the roster
    // defined by parts installed after this one: reached through H when called
    const checkOutcome = (...args) => H.checkOutcome(...args);
    const moduleArena = (...args) => H.moduleArena(...args);
    const seededChance = (...args) => H.seededChance(...args);
    const Generation = () => (typeof module === "object" && module.exports ? require("../workshop/generation.js") : globalThis.ConceptCombatWorkshopGeneration) || null;
    const Schools = () => (typeof module === "object" && module.exports ? (() => { try { return require("../workshop/schools.js"); } catch { return null; } })() : globalThis.ConceptCombatWorkshopSchools) || null;

    const knownEnemyTraps = (s, a) => !Traps ? [] : (s.traps || []).filter(t => !t.spent && t.ownerSide !== a.side && Traps.known(a, t));
    // ── C18 capture ritual. A weakened wild monster is held in a chant for two of the channeler's turns: nothing can
    // hit it and it does not act (stasis: Muse's addition, without it the target dies in the crossfire). The
    // channeler must hold still and not be hurt. Done, the monster becomes a bead; a bead releases a fragile allied
    // beast (half the monster's LF) for three turns.
    const chanted = (s, monsterId) => Object.values(s.actors).some(u => u.ritual && u.ritual.monsterId === monsterId && !u.defeated);
    // Standing water is distinct from rain/flash-flood wetness. This query is read-only.
    function waterState(s,x,y) {
      const tile=H.tileAt(s,x,y), standing=!!tile.tags?.includes("water"), ch=H.surfaceAt(s,x,y);
      const flood=s.waterField?.[H.key(x,y)];
      const micro=H.Climate && s.weatherState ? H.Climate.microclimate(H.moduleArena(s.arena),s.weatherState,{wetTiles:Object.keys(s.wildWet||{}).map(k=>k.split(",").map(Number))}).at(x,y) : null;
      return {standing,depth:standing ? (ch==="~" ? "deep" : "shallow") : "dry",wet:standing || !!micro?.wet || !!s.wildWet?.[H.key(x,y)],
        flow:standing ? flood?.flow || 0 : 0,level:flood?.level ?? null};
    }
    const isSwimmer=a=>(a?.traits||[]).some(t=>H.traitKey(t)==="swimmer");
    function refreshWaterDrowning(s,a,cause="water opens beneath them",surprise=false) {
      if(!a || a.defeated || a.notArrived)return;
      const wet=H.waterAt(s,a.x,a.y) && !H.ClassRuntime?.flies(a), at=H.key(a.x,a.y);
      const depth=wet ? (H.surfaceAt(s,a.x,a.y)==="~"?"deep":"shallow") : "dry";
      const opened=wet && (a.waterContact!==at || (a.waterDepth==="shallow" && depth==="deep"));
      if(!wet || opened)a.waterSafeAt=null;
      a.waterContact=wet?at:null;a.waterDepth=depth;
      const tideHeld = !!(s.sealedFight && a.side === "enemy" && s.sealedFight.slackFrom != null && s.sealedFight.round >= s.sealedFight.slackFrom && s.sealedFight.round < s.sealedFight.slackUntil);
      if (tideHeld && a.status.drowning) a.status.drowning = null;
      if(!tideHeld && wet && !a.status.drowning && ((H.cannotSwim(a) && a.waterSafeAt!==at) || (s.rules.water?.enabled !== false && (surprise || opened) && !isSwimmer(a)))) {
        a.status.drowning={label:"Drowning",nextTickAtOwnerTurn:(a.ownerTurns||0)+1,surprise:!H.cannotSwim(a)};
        H.log(s,{kind:"drowning",actor:a.id,target:a.id,tiles:[[a.x,a.y]],text:`${a.name} starts drowning: ${cause}.`,why:["Unexpected immersion submerges anyone without Swimmer. Regain footing in shallow water or surface in deep water on your turn; leaving water also ends it."]});
      } else if(!wet && a.status.drowning) {
        a.status.drowning=null;H.log(s,{kind:"drowning",actor:a.id,target:a.id,text:`${a.name} reaches safety and stops drowning.`});
      }
    }
    function waterRecovery(s,a) {
      if(s.rules.water?.enabled === false || !a?.status?.drowning)return null;
      const deep=waterState(s,a.x,a.y).depth==="deep";
      if(deep && H.cannotSwim(a))return {allowed:false,label:"Reach dry ground",cost:20};
      return {allowed:true,label:deep?"Surface":"Regain footing",cost:s.rules.water?.recoveryAP ?? 20};
    }
    // Optional, bounded water-level driver. Seeds feed connected low ground; no autonomous ocean is created.
    // A pocket list floods each region inside its own bounds. Absent, the walk is the original one field.
    function fillConnected(s, driver, bounds) {
      const queue=(driver.sources||[]).map(p=>p.slice()),seen=new Set(),level=driver.level||0;
      while(queue.length) {
        const [x,y]=queue.shift(),k=H.key(x,y);if(seen.has(k)||!H.inside(s,x,y))continue;seen.add(k);
        if(bounds && !bounds.has(k))continue;
        const ch=H.surfaceAt(s,x,y),barrier=H.barrierAt(s,x,y);
        if((s.terrainEffects||[]).some(e=>e.kind==="checkDam" && e.x===x && e.y===y && s.actors[e.owner]?.ownerTurns<e.expiresAt))continue;
        if(ch==="b") {for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx,y+dy]);continue;}
        if(![".",",","m","w","~"].includes(ch)||barrier?.blocksMove||barrier?.protection>0)continue;
        const drain=(s.terrainEffects||[]).some(e=>["drainage","rainGarden","loadPath"].includes(e.kind)&&s.actors[e.owner]?.ownerTurns<e.expiresAt&&(e.tiles||[]).some(p=>Array.isArray(p)?p[0]===x&&p[1]===y:p===k));
        const depth=level-H.heightAt(s,x,y)-(drain?1:0);if(depth<=0)continue;
        const to=depth>1?"~":"w";s.waterField[k]={from:ch,to,level,flow:driver.flow||0};
        s.arena.map[y]=s.arena.map[y].slice(0,x)+to+s.arena.map[y].slice(x+1);
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx,y+dy]);
      }
    }
    function updateWater(s) {
      const driver=s.waterLevel;if(!driver)return;
      for(const [k,f] of Object.entries(s.waterField||{})) {
        const [x,y]=k.split(",").map(Number);
        if(s.arena.map[y]?.[x]===f.to)s.arena.map[y]=s.arena.map[y].slice(0,x)+f.from+s.arena.map[y].slice(x+1);
      }
      s.waterField={};
      const level=driver.level||0;
      if(Array.isArray(driver.pockets)) {
        for(const pocket of driver.pockets) fillConnected(s,{sources:pocket.sources||[],level:pocket.level??level,flow:pocket.flow??driver.flow??0},pocket.bounds?new Set(pocket.bounds):null);
      } else fillConnected(s,driver,null);
      for(const a of Object.values(s.actors))refreshWaterDrowning(s,a,"rising water floods their tile");
      H.log(s,{kind:"flood",tiles:Object.keys(s.waterField).map(k=>k.split(",").map(Number)),text:`Water level ${level}: ${Object.keys(s.waterField).length} connected tiles flooded.`});
      (s.dreamRecent ||= {}).flood = true;   // ambient dreams hear the flood
    }
    // Dry reading of the same fill. The live map and the live field are put back.
    function previewFlood(s, driver) {
      if (!s?.arena?.map || !driver) return [];
      const map = s.arena.map.slice();
      const field = s.waterField;
      s.waterField = {};
      try {
        const level = driver.level || 0;
        if (Array.isArray(driver.pockets)) {
          for (const pocket of driver.pockets) fillConnected(s, { sources: pocket.sources || [], level: pocket.level ?? level, flow: pocket.flow ?? driver.flow ?? 0 }, pocket.bounds ? new Set(pocket.bounds) : null);
        } else fillConnected(s, driver, null);
        return Object.keys(s.waterField);
      } finally {
        s.arena.map = map;
        s.waterField = field || {};
      }
    }
    function advanceWater(s) {
      if(!s.waterLevel || s.waterLevel.lastRound===s.round)return;
      const d=s.waterLevel;d.lastRound=s.round;
      d.level=Math.max(0,Math.min(d.maxLevel??3,(d.level||0)+(d.risePerRound||0)));
      updateWater(s);
    }
    function endRitual(s, a, how) {
      if (!a.ritual) return;
      const visitor = !!a.ritual.visitor;
      const m = (s.wild || []).find(w => w.id === a.ritual.monsterId); if (m) delete m.suspended;   // a dream creature's stasis is the chant itself (chanted), nothing to clear
      const held = m || s.actors[a.ritual.monsterId], heldTile = held ? [[held.x, held.y]] : [];   // both ends, so break effects play on both (RITUAL_FEEDBACK.md)
      a.ritual = null; (s.captureLog ||= []).push({ actor: a.id, [how]: true });
      log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y], ...heldTile], ended: how, text: how === "broken" ? `${a.name}'s ${visitor ? "retrieval chant" : "capture ritual"} breaks under the blow.` : how === "moved" ? `${a.name} moves and the ${visitor ? "retrieval chant" : "capture ritual"} collapses.` : visitor ? `${a.name}'s chant fizzles: the specimen is gone.` : `${a.name}'s ritual fizzles: the monster is gone.` });
      flushSacrifice(s, a);   // a death that waited on this channel opens its rite now, before the same blow can break it
    }
    function ritualTick(s, a) {
      if (!a.ritual) return;
      const visitor = !!a.ritual.visitor;
      const held = a.ritual.mind || visitor || a.ritual.gaia;   // an actor held in the chant, not a wild unit
      const mind = held ? s.actors[a.ritual.monsterId] : null;
      const m = held ? (mind && !mind.defeated ? mind : null) : (s.wild || []).find(w => w.id === a.ritual.monsterId && w.form === "unit");
      if (!m) return endRitual(s, a, "fizzled");   // gone: killed, faded with its dream, fled, or taken already
      a.ritual.turnsLeft -= 1;
      if (a.ritual.turnsLeft > 0) { log(s, { kind: "ritual", actor: a.id, tiles: [[m.x, m.y]], text: `${a.name} chants on (${a.ritual.turnsLeft} turn${a.ritual.turnsLeft === 1 ? "" : "s"} left).` }); return; }
      const gaiaHeld = !!a.ritual.gaia;
      a.ritual = null;
      flushSacrifice(s, a);   // a death that waited on this channel opens its rite once the chant is done
      if (visitor) { if (H.Visitors) H.Visitors.abduct(s, m, { log }); return checkOutcome(s); }   // Intergalactic visitors P1: up into the ship, not into a bead
      if (gaiaHeld || m.kind === "gaia") return bindGaia(s, a, m);   // Gaia: bound as a summon, not a bead
      if (mind) {   // a monster of the mind: it leaves the field as a bead, and will come back tamed
        if (mind.dream?.source === "brood" && (a.beads || []).filter((b) => b.mind?.key === "broodMite").length >= (s.rules.brood?.maxHeld ?? 4)) { log(s, { kind: "ritual", actor: a.id, tiles: [[mind.x, mind.y]], ended: "full", text: `${a.name}'s hand is already full of Brood Mite beads: the chant ends and the ${mind.name.toLowerCase()} stays.` }); return checkOutcome(s); }   // the held cap also holds at the end of a chant begun below it
        mind.defeated = true; mind.escaped = true; mind.captured = true; mind.leaveReason = "taken into a bead"; mind.tempo = 0; spiritGone(s, mind);
        (a.beads ||= []).push({ kind: "dream", name: mind.name, maxLF: mind.maxLF, mind: { key: mind.dream.key, character: mind.character, sprite: mind.sprite, primary: mind.primary, secondary: mind.secondary, monster: mind.monster || null, dream: { ...mind.dream } } });
        (s.captureLog ||= []).push({ actor: a.id, kind: `dream:${mind.dream.key}`, ok: true });
        log(s, { kind: "ritual", actor: a.id, tiles: [[mind.x, mind.y]], captured: `dream:${mind.dream.key}`, text: `${a.name} completes the ritual: the ${mind.name.toLowerCase()} is taken into a bead.`, why: ["Released, it comes back tamed: on your side, for the rest of the battle, dream or no dream."] });
        return checkOutcome(s);
      }
      s.wild = s.wild.filter(w => w.id !== m.id);
      (a.beads ||= []).push({ kind: m.kind, name: m.name || wildRules?.data?.monsters?.[m.kind]?.name || m.kind, maxLF: m.maxLF });
      (s.captureLog ||= []).push({ actor: a.id, kind: m.kind, ok: true });
      log(s, { kind: "ritual", actor: a.id, tiles: [[m.x, m.y]], captured: m.kind, text: `${a.name} completes the ritual: the ${(m.name || m.kind).toLowerCase()} becomes a bead.`, why: ["A bead can be released beside you as a short-lived ally."] });
      checkOutcome(s);
    }
    // Gaia taken by the ritual (Mala, 2026-10-26): she leaves the field and, for the player's side, answers as a summon in
    // battles to come (summons-data.js gaia; the UI adds s.summonUnlocks to the account). The World Goddess is her MAX form.
    function bindGaia(s, a, m) {
      if (m.boss) { m.defeated = true; m.escaped = true; m.captured = true; m.leaveReason = "bound by the ritual"; m.tempo = 0; spiritGone(s, m); }
      else s.wild = (s.wild || []).filter(w => w.id !== m.id);
      const ours = a.side === "player";
      if (ours && !(s.summonUnlocks ||= []).includes("gaia")) s.summonUnlocks.push("gaia");
      (s.captureLog ||= []).push({ actor: a.id, kind: "gaia", ok: true });
      log(s, { kind: "ritual", actor: a.id, tiles: [[m.x, m.y]], captured: "gaia", text: `${a.name} completes the ritual: Gaia is bound${ours ? ", and she will answer your summons in battles to come" : ""}.`,
        why: ours ? ["Summon her as the Living Accord. Dream Space reveals the Wounded Ground; channel MAX into her and she stands up as the World Goddess."] : [] });
      checkOutcome(s);
    }
    // A won battle does not cut a capture short (Mala, 2026-10-26: "winning before a capture ritual ends feels terrible"):
    // a chant still held on the winning side completes as if it had been held to the end. A visitor's retrieval is not ours.
    function finishRitualsOnWin(s) {
      if (s.outcome?.winner !== "player") return;
      for (const a of Object.values(s.actors)) {
        if (a.side !== "player" || !a.ritual || a.ritual.visitor) continue;
        const had = (a.beads || []).length;
        a.ritual.turnsLeft = 1; ritualTick(s, a);   // completes it, or fizzles if the monster is already gone
        if ((a.beads || []).length > had) log(s, { kind: "ritual", actor: a.id, text: `The fight was won mid-chant, so ${a.name}'s capture held to the end.` });
      }
    }
    // ── Rites (Muse-2 rituals prototype). a.rite = { steps: [{type}], hold }. Steps bank augment
    // elements; the hold (2 turns per consecutive step) ticks at each owner turn start.
    function riteDiscount(s, a, base) {   // shared by capture + all rite steps: ritual traits discount both
      const D = s.rules.rite?.traitDiscounts || {};
      let off = 0;
      for (const t of (a.traits || [])) off += D[(typeof t === "string" ? t : t?.id)] || 0;
      return Math.max(0, base - off);
    }
    // ── Placed markers (machine P3): generic marked tiles with flags, expiry and counterplay, stored as
    // s.terrainEffects kind "marker". Markers block nothing, shelter nothing, act by themselves never; wire-in
    // gives them meaning (Autofiction scenes, Reinforcement cues, Design blueprints). Placement legality beyond
    // bounds is the placer's business; use-legality (occupancy etc.) is checked where markers are spent.
    function placeMarker(s, o) {
      if (!o || o.x == null || o.y == null || !o.owner || !s.actors[o.owner]) return null;
      if (o.x < 0 || o.y < 0 || o.x >= (s.arena.w ?? 99) || o.y >= (s.arena.h ?? 99)) return null;
      const owner = s.actors[o.owner];
      const m = { id: `mk-${++s.seq}`, kind: "marker", x: o.x, y: o.y, flags: { ...(o.flags || {}) }, owner: o.owner, side: o.side || owner.side, label: o.label || "Marker", expiresAt: owner.ownerTurns + (o.durationTurns ?? 2) };
      (s.terrainEffects ||= []).push(m);
      log(s, { kind: "effect", actor: o.owner, tiles: [[o.x, o.y]], text: `${m.label} is marked at (${o.x},${o.y}).` });
      return m;
    }
    const markersLive = (s) => (s.terrainEffects || []).filter((e) => e.kind === "marker" && (s.actors[e.owner]?.ownerTurns ?? 99) < e.expiresAt);
    const markersAt = (s, x, y) => markersLive(s).filter((e) => e.x === x && e.y === y);
    function removeMarker(s, id) {
      const m = (s.terrainEffects || []).find((e) => e.kind === "marker" && e.id === id);
      if (!m) return false;
      s.terrainEffects = s.terrainEffects.filter((e) => e !== m);
      log(s, { kind: "effect", actor: m.owner, tiles: [[m.x, m.y]], text: `${m.label} at (${m.x},${m.y}) is removed.` });
      return true;
    }
    function removeMarkers(s, { owner = null, flag = null } = {}) {
      let n = 0;
      for (const m of markersLive(s).filter((e) => (!owner || e.owner === owner) && (!flag || e.flags[flag]))) { removeMarker(s, m.id); n++; }
      return n;
    }
    function markerBlocked(s, m) {
      const u = Object.values(s.actors).find((u) => !u.defeated && !u.notArrived && u.x === m.x && u.y === m.y);
      return !!u && u.side !== m.side;   // an enemy standing on it; allies (and the owner) may share the tile
    }
    // Signal origin override (machine P3): a non-damaging, non-self signal may originate from a live marker
    // the caster owns. Damaging, self-targeting and non-signal techniques are refused; so is an enemy-held tile.
    function validSignalOrigin(s, a, m, from) {
      if (!from) return { ok: false, error: "No origin tile." };
      if (m.delivery !== "signal") return { ok: false, error: "Only signals can be originated elsewhere." };
      if (m.target === "self") return { ok: false, error: "You cannot be in two places at once." };
      if ((m.potency || 0) > 0) return { ok: false, error: "A marker cannot originate a damaging technique." };
      const mk = markersAt(s, from[0], from[1]).find((e) => e.owner === a.id);
      if (!mk) return { ok: false, error: "No live marker of yours marks that tile." };
      if (markerBlocked(s, mk)) return { ok: false, error: "An enemy holds that tile: the marker cannot speak from it." };
      return { ok: true, marker: mk };
    }
    // ── Movement money (machine P1): concept-agnostic discounts, surcharges and refunds on voluntary moves.
    // Mods live in a.status.moveMods: [{ id, kind: "discount"|"surcharge"|"refund", amount, once?, perTurnCap?,
    // if?, untilRound?, label }]. Qualifiers: { nearTile:[x,y], within? }, { nearUnit:id, within? },
    // { nearerTo:[x,y] }, { heading:[dx,dy] }. Costing (adjustMoveCost) only reads; the move handler consumes once-mods and pays
    // refunds after the walk, so pricing never spends anything. Forced displacement never passes through here.
    const moveModsLive = (s, a) => (a.status?.moveMods || []).filter((m) => m.untilRound == null || s.round <= m.untilRound);
    function moveModQualifies(s, a, route, m) {
      const q = m.if; if (!q) return true;
      const end = route[route.length - 1], start = route[0];
      if (q.nearTile) return dist(s, end[0], end[1], q.nearTile[0], q.nearTile[1]) <= (q.within ?? 1);
      if (q.nearUnit) { const u = s.actors[q.nearUnit]; return !!u && !u.defeated && dist(s, end[0], end[1], u.x, u.y) <= (q.within ?? 1); }
      if (q.nearerTo) return dist(s, end[0], end[1], q.nearerTo[0], q.nearerTo[1]) < dist(s, start[0], start[1], q.nearerTo[0], q.nearerTo[1]);
      if (q.heading) return route.length > 1 && route.slice(1).every(([nx, ny], i) => nx - route[i][0] === q.heading[0] && ny - route[i][1] === q.heading[1]);   // Designate Destiny: every step is the declared step
      return true;
    }
    function adjustMoveCost(s, a, route, base) {
      let off = 0, extra = 0;
      for (const m of moveModsLive(s, a)) {
        if (!moveModQualifies(s, a, route, m)) continue;
        if (m.kind === "discount") off += m.amount;
        else if (m.kind === "surcharge") extra += m.amount;
      }
      const floor = Math.min(base, s.rules.moveMoney?.floor ?? 10);   // the floor caps discounts; it never raises the base (flyers pay 5 for a step)
      return Math.max(floor, base - off + extra);
    }
    function consumeMoveMods(s, a, route) {
      if (!a.status?.moveMods) return;
      const spent = [];
      a.status.moveMods = a.status.moveMods.filter((m) => {
        const use = m.once && moveModQualifies(s, a, route, m) && (m.untilRound == null || s.round <= m.untilRound);
        if (use && m.label) spent.push(m.label);
        return !use;
      });
      if (spent.length) log(s, { kind: "effect", actor: a.id, text: `${a.name} spends ${spent.join(" and ")}.` });
    }
    function refundMove(s, a, route) {
      let paid = 0;
      for (const m of (a.status?.moveMods || [])) {
        if (m.kind !== "refund" || (m.untilRound != null && s.round > m.untilRound)) continue;
        if (!moveModQualifies(s, a, route, m)) continue;
        if (m.givenRound !== s.round) { m.givenRound = s.round; m.given = 0; }
        const room = (m.perTurnCap ?? m.amount) - (m.given || 0);
        const pay = Math.min(m.amount, Math.max(0, room));
        if (pay <= 0) continue;
        const actual = Math.min(pay, Math.max(0, (a.tempoCapacity ?? 100) - a.tempo));
        m.given = (m.given || 0) + actual; a.tempo += actual; paid += actual;
      }
      if (paid > 0) log(s, { kind: "effect", actor: a.id, text: `${a.name} recovers ${paid} action points.` });
      return paid;
    }
    // ── Destination directives (machine P2): an effect assigns the endpoint of a unit's next voluntary move.
    // a.status.moveDirective = { dest:[x,y], defyCost: number|null, label?, untilRound? }. Distinct from forced
    // displacement: the holder still moves themselves, and may always refuse to move at all. Dormant while the
    // destination is unreachable (never compels the impossible); consumed by the move it constrains or that defies it.
    const directiveLive = (s, a) => { const d = a.status?.moveDirective; return d && (d.untilRound == null || s.round <= d.untilRound) ? d : null; };
    function directiveDestOpen(s, a, dest) {
      return !!H.paths(s, a.x, a.y, H.Injury.moveBudget(s, a, H.moveBudgetFor(s, a)), "move").pathTo(dest[0], dest[1]);
    }
    function consumeDirective(s, a, end, defied) {
      const d = directiveLive(s, a); if (!d) return;
      if (!defied && (end[0] !== d.dest[0] || end[1] !== d.dest[1])) return;   // dormant moves leave it in place
      a.status.moveDirective = null;
      log(s, { kind: "effect", actor: a.id, text: defied ? `${a.name} defies ${d.label || "the directive"}.` : `${a.name} follows ${d.label || "the directive"}.` });
    }
    // ── Movement history (machine P2): what tiles a unit occupied, and pair proximity by round, read from the
    // round-stamped move log. Pair proximity is "within D at some point during round R" — turns are sequential,
    // so exact simultaneity doesn't exist; this is the honest operationalization.
    function tilesOccupiedIn(s, id, R) {
      const a = s.actors[id]; if (!a) return [];
      const tiles = R === s.round ? [[a.x, a.y]] : [];
      for (const e of s.log) {
        if (e.kind !== "move" || e.actor !== id || e.round !== R) continue;
        tiles.push(...(e.path || []), ...(e.tiles || []));
      }
      if (!tiles.length) {
        let last = null;
        for (const e of s.log) if (e.kind === "move" && e.actor === id && e.round < R) last = e;
        const end = last && [...(last.path || []), ...(last.tiles || [])].pop();
        tiles.push(end || [a.x, a.y]);   // never moved: always where they stand
      }
      return [...new Map(tiles.map((t) => [`${t[0]},${t[1]}`, t])).values()];
    }
    function pairWithin(s, idA, idB, D, R = s.round) {
      const A = tilesOccupiedIn(s, idA, R), B = tilesOccupiedIn(s, idB, R);
      return A.some((t) => B.some((u) => dist(s, t[0], t[1], u[0], u[1]) <= D));
    }
    // ── Prepaid escape (machine P4): a designated displacement that fires automatically before the first
    // qualifying hostile contact/line hit lands. a.status.prepaidEscape = { dests:[[x,y],...], label?,
    // untilRound? }. The wire-in chooses destinations (Design: one orthogonal exit); the primitive takes the
    // first currently valid one. Displacement mirrors window.js reposition (direct set, no entry effects).
    // Re-check after moving: contact still lands iff the attacker still reaches; line still lands iff a
    // covered tile remains in the committed area. Proven-miss rule: unverifiable geometry still hits.
    // Does not touch reactions (prepaid automation fires regardless); Overwatch-style exclusions are wire-in.
    const prepaidLive = (s, t) => { const p = t.status?.prepaidEscape; return p && (p.untilRound == null || s.round <= p.untilRound) && Array.isArray(p.dests) && p.dests.length ? p : null; };
    function prepaidDestOpen(s, t, dest) {
      const [x, y] = dest;
      if (x < 0 || y < 0 || x >= s.arena.w || y >= s.arena.h) return false;
      if (H.tileAt(s, x, y)?.blocksMove) return false;
      const u = H.actorAt(s, x, y);
      return (!u || u.id === t.id) && (!t.awakened || H.footOpen(s, t, x, y, "move"));   // TS-01: a woken body escapes only onto a footprint-clear anchor
    }
    function prepaidEscape(s, src, tgt, inst) {
      const p = prepaidLive(s, tgt);
      if (!p || !src || src.side === tgt.side) return null;
      if (!inst || (inst.delivery !== "contact" && inst.delivery !== "line")) return null;
      tgt.status.prepaidEscape = null;   // the first qualifying hit spends the charge, whatever follows
      const dest = p.dests.find((d) => prepaidDestOpen(s, tgt, d));
      if (!dest) { log(s, { kind: "effect", actor: tgt.id, text: `${tgt.name}'s escape (${p.label || "prepared"}) is blocked: the charge is spent.` }); return null; }
      tgt.x = dest[0]; tgt.y = dest[1];
      log(s, { kind: "effect", actor: tgt.id, tiles: [[tgt.x, tgt.y]], text: `${tgt.name} escapes to (${tgt.x},${tgt.y}) (${p.label || "prepared"}).` });
      if (inst.delivery === "contact") {
        if (dist(s, src.x, src.y, tgt.x, tgt.y) <= H.strikeRange(s, src)) return null;
      } else {   // line mirrors resolve.js: single-shape bolts strike only their aim tile; line-shape strikes cover the beam
        const aim = inst.aim;
        let stillIn;
        if (inst.area?.shape === "line" && aim && H.line) {
          let reach = H.line(src.x, src.y, aim[0], aim[1]).slice(1);
          const bi = H.barrierAt ? reach.findIndex(([x, y]) => { const b = H.barrierAt(s, x, y); return b && !b.linePassable && !(b.coverFraction > 0) && !(b.rushed) && s.actors[b.owner]?.side !== src.side; }) : -1;
          if (bi >= 0) reach = reach.slice(0, bi);   // read-only mirror of damage.js lineStop (spends no charges)
          stillIn = reach.some(([x, y]) => H.actorAt(s, x, y)?.id === tgt.id);
        } else if (aim) {
          stillIn = H.coversTile(tgt, aim[0], aim[1]);   // a big unit is still in the aim on any of its tiles
        } else if (inst.tiles) {
          stillIn = inst.tiles.some(([x, y]) => H.actorAt(s, x, y)?.id === tgt.id);
        } else {
          stillIn = true;
        }
        if (stillIn) return null;
      }
      log(s, { kind: "effect", actor: src.id, target: tgt.id, text: `${inst.name || "The attack"} misses ${tgt.name}: out of reach.` });
      return "miss";
    }
    // For You (Mala, 2026-10-21): a killing self-cost is the first step of the recipient's rite. steady skips both the
    // concentration break and the fizzle clock. A capture already in progress holds the step until that channel ends.
    function grantSacrifice(s, recipient, from) {
      if (!recipient || recipient.defeated || !from) return;
      if (recipient.ritual) {
        const bag = recipient.pendingSacrifice || { steps: [] };
        if (!bag.steps.some((x) => x.from === from.id)) bag.steps.push({ type: "sacrifice", from: from.id, name: from.name });
        recipient.pendingSacrifice = bag;
        log(s, { kind: "ritual", actor: recipient.id, text: `${from.name}'s death waits: ${recipient.name} is already chanting, and the rite begins when that channel ends.` });
        return;
      }
      const rite = recipient.rite || { steps: [], hold: 0 };
      if (!rite.steps.some((x) => x.type === "sacrifice" && x.from === from.id)) rite.steps.push({ type: "sacrifice", from: from.id });
      rite.steady = true;   // the whole open bank, including steps added onto this same rite, holds without concentration
      rite.hold = Math.max(rite.hold || 0, 2 * rite.steps.length);
      recipient.rite = rite;
      log(s, { kind: "ritual", actor: recipient.id, tiles: [[recipient.x, recipient.y]], text: `${from.name}'s death is the first step of ${recipient.name}'s rite. It does not take concentration to hold.` });
    }
    function flushSacrifice(s, a) {
      const bag = a.pendingSacrifice;
      if (!bag) return;
      a.pendingSacrifice = null;
      for (const step of bag.steps) grantSacrifice(s, a, s.actors[step.from] || { id: step.from, name: step.name || "The lover" });
    }
    function endRite(s, a, how) {
      if (!a.rite) return;
      const n = a.rite.steps.length;
      a.rite = null;
      log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], ended: how, text: how === "broken" ? `${a.name}'s rite breaks under the blow (${n} step${n === 1 ? "" : "s"} lost).` : how === "fizzled" ? `${a.name}'s rite fades: the banked steps go unspent.` : `${a.name} abandons the rite.` });
    }
    function riteTick(s, a) {
      if (!a.rite) return;
      if (a.rite.steady) return;   // a sacrificed rite does not fizzle: the lover already paid the holding
      if (hasTrait(a, "unendingChant")) return;   // Rites (Muse-2): the Chanter holds steps until spent — the bank never fizzles
      a.rite.hold -= 1;
      if (a.rite.hold < 0) return endRite(s, a, "fizzled");
      log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name}'s rite holds (${a.rite.hold} turn${a.rite.hold === 1 ? "" : "s"} of bank left, ${a.rite.steps.length} step${a.rite.steps.length === 1 ? "" : "s"} banked).` });
    }
    // ── Ritual burial (Mala, 2026-10-19/20; muse/ritual-burial/SPEC.md). The fallen leave corpses (markers: no block, no
    // cover); Last Rites buries one as a rite step. s.corpses = [{ id, of, name, x, y, side, boss, named, round, killer, killerName }],
    // s.graves = [{ id, x, y, side, of, name }]. No corpse from summons, clones, dream things, companions, the knocked-out
    // (not dead), anyone who escaped or never arrived.
    function corpseSweep(s) {
      if (s.preview) return;
      const made = (s.corpseMade ||= {});
      for (const a of Object.values(s.actors)) {
        if (!a.defeated || made[a.id] || a.escaped || a.notArrived || a.knockedOut || a.summon || a.summonBinding || a.clone || a.dream || a.companion || a.communed) continue;
        if (!["player", "enemy", "civilian", "posthuman"].includes(a.side) && !a.beast) continue;
        made[a.id] = true;
        (s.corpses ||= []).push({ id: `corpse-${a.id}`, of: a.id, name: a.name, x: a.x, y: a.y, side: a.side, boss: !!a.boss, named: !!(C.characters?.[a.character] && !a.beast && !a.monster), round: s.round,
          killer: a.defeatedBy || null, killerName: a.defeatedBy ? s.actors[a.defeatedBy]?.name || null : null, sacrifice: !!a.sacrifice });   // who made the body (attachment and grief, later); a self-sacrifice has no killer
      }
    }
    const corpseBeside = (s, a) => (s.corpses || []).filter((c) => Math.max(Math.abs(c.x - a.x), Math.abs(c.y - a.y)) <= 1).sort((p, q) => (p.id < q.id ? -1 : 1))[0] || null;
    const fastBurier = (s, a) => (s.rules.rite?.burial?.fastTraits || []).some((t) => hasTrait(a, t));
    const burialAp = (s, a) => { const B = s.rules.rite?.burial || {}; return riteDiscount(s, a, fastBurier(s, a) ? (B.fastAp ?? 50) : (B.ap ?? 100)); };
    // Last Rites: bury the corpse beside you. Returns an error string, or null when it is done (the caller banks the step).
    function lastRites(s, a, spendTempo) {
      const B = s.rules.rite?.burial; if (!B) return "Burial is switched off (rules.rite.burial).";
      const c = corpseBeside(s, a); if (!c) return "Last Rites needs a body beside you.";
      const fast = fastBurier(s, a);
      if (a.moved && !fast) return "Last Rites takes the whole turn: begin it beside the body, before you move.";
      const err = spendTempo(s, a, burialAp(s, a), "Last Rites"); if (err) return err;
      s.corpses = s.corpses.filter((x) => x.id !== c.id);
      const desert = /desert|dune/i.test(`${s.arena?.name || ""} ${s.arena?.id || ""}`), plain = ["headstone", "wooden-cross", "cairn", "stele"];
      const style = c.boss ? "shrine" : desert ? "desert-marker" : plain[Math.floor(seededChance(`${s.seed}:grave:${c.of}`) * plain.length)];   // sprites/graves/<style>.png
      (s.graves ||= []).push({ id: `grave-${c.of}`, x: c.x, y: c.y, side: a.side, of: c.of, name: c.name, killer: c.killer || null, style });
      if (!fast) a.status.lockMove = { label: "Digging", owner: a.id, expiresAt: a.ownerTurns + 1 };
      const why = [`+${B.potency} potency banked in the rite.`, `The grave is tended: ${a.side === "player" ? "your" : "its side's"} units beside it take ${B.graveWard} less from every hit.`];
      const land = H.landState?.(s);
      if (land && land.wounds > 0 && s.rules.land !== false) {
        const healed = Math.min(B.healWounds, land.wounds); land.wounds = Math.round((land.wounds - healed) * 10) / 10;
        if (land.sides?.[a.side]) land.sides[a.side] = Math.max(0, Math.round((land.sides[a.side] - healed) * 10) / 10);
        why.push(`The land is eased: ${healed} wound${healed === 1 ? "" : "s"} healed.`);
      }
      if (c.side === a.side) {   // honor burial: the living charge
        for (const u of Object.values(s.actors)) if (!u.defeated && !u.notArrived && u.side === a.side) u.ultimateCharge = Math.min(s.rules.ultimateChargeMax ?? 100, (u.ultimateCharge || 0) + B.honorUlt);
        why.push(`An honor burial: every living ally +${B.honorUlt} ultimate charge.`);
      }
      if (c.boss || c.named) { H.Inspiration?.gain?.(s, a, B.stateInspiration, c.boss ? "a state funeral" : "a named burial"); why.push(`A ${c.boss ? "state funeral" : "named burial"}: +${B.stateInspiration} Inspiration.`); }
      log(s, { kind: "ritual", actor: a.id, target: c.of, tiles: [[c.x, c.y]], text: `${a.name} performs the last rites over ${c.name}${fast ? ", quickly, as the desert demands" : ": a whole turn of digging"}.`, why });
      return null;
    }
    // A tended grave: units of its side standing beside it take graveWard less from each hit.
    const graveWard = (s, t) => { const B = s.rules.rite?.burial; if (!B || !t) return 0;
      return (s.graves || []).some((g) => g.side === t.side && Math.max(Math.abs(g.x - t.x), Math.abs(g.y - t.y)) <= 1) ? B.graveWard : 0; };

    // ── Cultural legacy (Mala, 2026-10-20; legacy/legacy-battle.js). opts.legacy = { bonuses, memory, scribed, battle }
    // from the account: scribed techniques become abilities, memorized ones join the hero's learned techniques, and a
    // tradition's bonus prices its techniques (control: fewer AP; charge discount: fewer ΦF).
    // Beast summons (account/beads.js): creatures learned by swallowing their beads ride into battle on the hero, called with
    // callBeast (engine/actions.js) once a battle each. Gaia is never one (she is a summon of her own).
    function carryBeasts(s, opts) {
      if (!Array.isArray(opts.beastSummons) || !opts.beastSummons.length) return;
      const hero = s.actors[s.modeSetup?.hero || "player"]; if (!hero) return;
      hero.beastSummons = opts.beastSummons.filter((b) => b && b.key && b.kind !== "gaia" && (wildRules?.data?.monsters?.[b.kind] || (b.kind === "dream" && b.mind?.key)))
        .map((b) => ({ key: b.key, kind: b.kind, name: b.name, maxLF: b.maxLF || wildRules?.data?.monsters?.[b.kind]?.lf || 20, ...(b.mind ? { mind: { ...b.mind, dream: { ...(b.mind.dream || {}), key: b.mind.key } } } : {}) }));
    }
    function carryLegacy(s, opts) {
      const Lg = opts.legacy; if (!Lg) return;
      const hero = s.actors[s.modeSetup?.hero || "player"]; if (!hero) return;
      s.legacy = { bonuses: Lg.bonuses || {}, battle: Lg.battle || null, hero: hero.id };
      for (const d of Lg.scribed || []) if (d?.id && d.ability && (!C.abilities[d.id] || (d.ability.rev || 0) !== (C.abilities[d.id].rev || 0))) C.abilities[d.id] = d.ability;   // legacy-battle.js carry() builds them; a changed rev replaces the registered one (Recopy, Amend)
      const keep = (Lg.memory || []).filter((id) => C.abilities[id]);
      if (keep.length) hero.learned = [...new Set([...(hero.learned || []), ...keep])];
    }
    function legacyPrice(s, a, abilityId, m) {
      const b = s.legacy?.bonuses?.[abilityId]; if (!b || a.id !== s.legacy.hero) return;
      const pf = Math.round(m.cost * b.chargeDiscount), ap = Math.round(m.tempoCost * b.control);
      if (pf) m.cost = Math.max(0, m.cost - pf); if (ap) m.tempoCost = Math.max(1, m.tempoCost - ap);
      if (pf || ap) m.notes?.push(`${b.tradition} (${b.tier}): −${ap} AP, −${pf} ΦF.`);
    }
    // The journal: a technique a foe used this battle, from someone you can still see, can be noted for your reaction.
    function journalOptions(s, a) {
      if (!s.legacy || a.id !== s.legacy.hero || a.defeated) return [];
      const seen = new Map();
      for (const e of s.log) if (e.kind === "act" && e.ability && e.ability !== "strike" && e.actor && s.actors[e.actor]?.side !== a.side) seen.set(e.ability, e.actor);
      const noted = new Set((s.journalNotes || []).filter((n) => n.round === s.round).map((n) => n.technique));
      return [...seen.entries()].filter(([id, by]) => !noted.has(id) && s.actors[by] && !s.actors[by].defeated && H.hasSight(s, a.x, a.y, s.actors[by].x, s.actors[by].y))
        .map(([id, by]) => ({ technique: id, by, name: C.abilities[id]?.name || id }));
    }

    // ── Dream fish (Mala, 2026-10-20; the first step of an agriculture system). Fish live in water tiles: a few at the
    // start, more at each round start up to a cap set by how much water the map has. Catching one from beside the water
    // (or standing in it) puts a Dream Fish in the pack, or feeds it to you at once when the pack is full; eating it gives
    // ultimate charge, the road to opening a dream sooner. s.fish = [{ id, x, y }]. Numbers: rules.fish.
    function fishRound(s, start = false) {
      const R = s.rules.fish; if (!R || s.preview) return;
      const water = []; for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) if (H.waterAt(s, x, y)) water.push([x, y]);
      if (!water.length) return;
      const fish = (s.fish ||= []), cap = Math.min(R.max, Math.max(1, Math.floor(water.length / R.tilesPerFish)));
      const open = water.filter(([x, y]) => !fish.some((f) => f.x === x && f.y === y));
      const want = start ? Math.ceil(cap / 2) : (fish.length < cap && seededChance(`${s.seed}:fish:${s.round}`) < R.spawnChance ? 1 : 0);
      for (let i = 0; i < want && open.length && fish.length < cap; i++) {
        const k = Math.floor(seededChance(`${s.seed}:fishAt:${s.round}:${i}`) * open.length), [x, y] = open.splice(k, 1)[0];
        fish.push({ id: `fish-${s.round}-${i}`, x, y });
      }
    }
    const fishNear = (s, a) => (s.fish || []).filter((f) => Math.max(Math.abs(f.x - a.x), Math.abs(f.y - a.y)) <= 1);

    // ── Foe names (Mala, 2026-10-20). In a random battle every non-boss opponent of the hero gets a given name from its
    // class's pool, then the shared fallback (content.js namePools), seeded and never repeated in the battle: the unit's
    // name becomes "Given: Class" (a.given, a.className keep the parts). Unique individuals, and anyone an encounter already named, keep their name.
    // W8.6 (workshop/generation.js): some enemies arrive with a lo-ci, read-only intel that Observe reads out. Elites 12%,
    // bosses 45%, never rabble; deterministic from the battle seed; no two share an equation in one battle. The door is the
    // primary concept's school (workshop/schools.js when it is present, else a stable stand-in).
    function assignEnemyLoci(s) {
      const G = Generation(); if (!G || s.rules.enemyLoci === false || s.preview) return;
      const hero = s.modeSetup?.hero || "player", heroSide = s.actors[hero]?.side || "player", SC = Schools();
      const foes = Object.values(s.actors).filter((u) => u.side !== heroSide && u.side !== "civilian" && !u.defeated);
      const doorOf = (u) => { const name = SC?.schoolOf?.(u.primary), d = SC?.RING ? SC.RING.indexOf(name) : -1; return d >= 0 ? d : G.fallbackDoor(u.primary); };   // schools.js names the school; the ring index is the door
      for (const [id, lo] of Object.entries(G.forBattle(s.seed, foes, doorOf))) s.actors[id].loci = lo;
    }
    function nameRandomFoes(s) {
      if (s.encounter !== "randomEncounter" || s.rules.foeNames === false || !C.namePools) return;
      const P = C.namePools, hero = s.modeSetup?.hero || "player", heroSide = s.actors[hero]?.side || "player";
      const used = new Set(Object.values(s.actors).map((u) => u.given).filter(Boolean)); let n = 0;
      const pick = (id, pool) => { const free = (pool || []).filter((x) => !used.has(x)); return free.length ? free[Math.floor(seededChance(`${s.seed}:name:${id}:${n++}`) * free.length)] : null; };
      for (const id of Object.keys(s.actors).sort()) {
        const a = s.actors[id];
        if (id === hero || a.given || a.side === heroSide || a.side === "civilian" || a.boss || a.summon || a.beast || a.companion || a.monster || a.dream || a.wild || a.communed) continue;
        if (!C.characters[a.character] || P.unique.includes(a.character) || a.name !== C.characters[a.character].name) continue;   // an authored name (themed lineups, events) stands
        const given = pick(id, P.byClass[a.character]) || pick(id, P.fallback); if (!given) continue;
        used.add(given); a.given = given; a.className = a.name; a.name = `${given}: ${a.name}`;
      }
    }

    function beadBeast(s, a, bead, at) {
      if (bead.kind === "dream" && bead.mind) {   // a tamed monster of the mind: a dream creature on your side that no dream can take back
        s.beadSeq = (s.beadSeq || 0) + 1; const M = bead.mind, lf = Math.max(1, Math.ceil((bead.maxLF || 20) * RITUAL.beadLfMul));
        const raw = { id: `tamed-${M.key}-${s.beadSeq}`, name: bead.name, side: a.side, character: M.character, primary: M.primary, secondary: M.secondary, maxLF: bead.maxLF, lf, monster: M.monster || undefined,
          dream: { ...M.dream, source: "tamed", summoner: a.id } };
        H.registerDreamActor(s, raw, at, "summon", null);
        const t = s.actors[raw.id]; t.side = a.side; t.ai = "ally"; t.tamed = { owner: a.id, round: s.round }; t.sprite = M.sprite || t.sprite; if (a.side === "player") t.permanentAlly = true;   // stays on the player's side
        if (s.order.indexOf(t.id) < 0) s.order.splice(s.turnIndex + 1, 0, t.id);
        return t;
      }
      const def = wildRules?.data?.monsters?.[bead.kind] || {}, lf = Math.max(1, Math.ceil((bead.maxLF || 20) * RITUAL.beadLfMul));
      s.beadSeq = (s.beadSeq || 0) + 1;
      const beast = { id: `bead-${bead.kind}-${s.round}-${s.beadSeq}`, name: bead.name || def.name || "Beast", side: a.side, controller: "ai", ai: "ally", character: `bead-${bead.kind}`, sprite: def.sprite || (bead.kind === "feralPig" ? "feral-pig" : bead.kind),
        primary: C.concepts[def.concept]?.abilities?.length ? def.concept : "inertia", secondary: null, maxLF: lf, lf, x: at[0], y: at[1], beast: { owner: a.id, kind: bead.kind, turnsLeft: RITUAL.beadTurns },
        pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, level: a.level || 1, xp: 0, proficiency: a.proficiency || 1, reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
        reaction: s.rules.reactionsPerRound, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false,
        ownerTurns: 0, lastRecoverTurn: -99, status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null }, inventory: [], inventoryCapacity: 0,
        passives: {}, traits: [], conditions: {}, lanyardUsed: false, bristleconeUsed: false, lastDamageType: null, defeated: false };
      s.actors[beast.id] = beast; s.disclosures[beast.id] = {}; s.knowledge[beast.id] = {}; if (s.observedAbilities) s.observedAbilities[beast.id] = [];
      if (insightRules) { const deck = insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[beast.id] = deck; s.insight.knowledge[beast.id] = insightRules.spawnKnowledge(deck); }
      for (const other of Object.values(s.actors)) if (other.id !== beast.id && other.side !== beast.side) { (s.knowledge[other.id] ||= {})[beast.id] ||= { secondary: false, lens: false, abilities: {} }; s.knowledge[beast.id][other.id] = { secondary: false, lens: false, abilities: {} }; }
      s.order.splice(s.turnIndex + 1, 0, beast.id);
      return beast;
    }
    // ── Companions (content.js rules.companions): a class's own ally. Built like a released beast: an AI ally on a clock.
    function callCompanion(s, a) {   // called as the owner's turn starts
      if (a.defeated || a.companion || a.lf <= 0) return null;
      const found = Object.entries(s.rules.companions || {}).find(([, d]) => d.of === a.character); if (!found) return null;
      const [key, def] = found;
      if (def.manual) return null;   // technique-called only (the Hair Clone): never the low-LF auto-call
      if (a.lf > a.maxLF * def.belowLf || (s.companionsCalled ||= {})[a.id]) return null;
      const chance = def.chance ?? 1;
      if (seededChance(`${s.seed}:companion:${key}:${a.id}:${s.round}`) >= chance) {
        // A gambled call rolls once per battle: on a miss the flag is consumed, and when the def
        // carries a farewell line the would-be companion speaks once from off the field.
        s.companionsCalled[a.id] = s.round;
        if (def.missLine) log(s, { kind: "companion", actor: a.id, target: a.id, missed: true, speaker: key, speakerName: def.name, sprite: def.sprite, line: def.missLine, tiles: [[a.x, a.y]],
          text: `${def.name}: "${def.missLine}"`, why: [`The ${Math.round(chance * 100)}% call failed. He will not be called again this battle.`] });
        return null;
      }
      const open = ([x, y]) => H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove && !H.actorAt(s, x, y) && !H.barrierAt(s, x, y) && !(s.wild || []).some(m => m.form === "unit" && m.x === x && m.y === y);
      const at = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [a.x + dx, a.y + dy]).find(open);
      if (!at) return null;   // no room beside her this turn: he tries again on her next
      s.companionsCalled[a.id] = s.round;
      const ally = { id: `companion-${key}-${a.id}`, name: def.name, side: a.side, controller: "ai", ai: "ally", character: key, sprite: def.sprite,
        primary: def.primary, secondary: def.secondary, maxLF: def.lf, lf: def.lf, x: at[0], y: at[1], companion: { owner: a.id, key, turnsLeft: def.turns ?? null },
        pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, level: a.level || 1, xp: 0, proficiency: a.proficiency || 1, reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
        reaction: s.rules.reactionsPerRound, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false,
        ownerTurns: 0, lastRecoverTurn: -99, status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null }, inventory: [], inventoryCapacity: 0,
        passives: {}, traits: def.profileTraits ? (insightRules?.profileTraitIds?.(key, s.seed) || []).slice() : [], conditions: {}, lanyardUsed: false, bristleconeUsed: false, lastDamageType: null, defeated: false };
      s.actors[ally.id] = ally; s.disclosures[ally.id] = {}; s.knowledge[ally.id] = {}; if (s.observedAbilities) s.observedAbilities[ally.id] = [];
      if (insightRules) { const deck = insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[ally.id] = deck; s.insight.knowledge[ally.id] = insightRules.spawnKnowledge(deck); }
      for (const other of Object.values(s.actors)) if (other.id !== ally.id && other.side !== ally.side) { (s.knowledge[other.id] ||= {})[ally.id] ||= { secondary: false, lens: false, abilities: {} }; s.knowledge[ally.id][other.id] = { secondary: false, lens: false, abilities: {} }; }
      s.order.splice(s.turnIndex + 1, 0, ally.id);
      // The data center (content.js rules.dataCenter): an AGI that gets out while his center is up runs on it from the start.
      const DC = key === "agi" && s.rules.dataCenter, center = DC && H.ClassRuntime?.centerOf(s, a);
      if (center) { ally.maxLF = ally.lf = DC.spawn.lf; ally.takeoff = { exp: {}, immune: [], sightings: 0, transcended: 0, completed: 0, taught: 0, paced: false, credit: DC.spawn.credit }; }
      const arrival = (def.arrival || "comes out of the corner to stand with {owner} for {turns} turns").replace("{owner}", a.name).replace("{turns}", def.turns);
      log(s, { kind: "companion", actor: ally.id, target: a.id, tiles: [at], arrived: true, scene: def.arrivalScene || null, text: `${def.name} ${arrival}.`,
        why: [`${a.name} started a turn at or below ${Math.round(def.belowLf * 100)}% life. Once per battle.`, ...(chance < 1 ? [`A ${Math.round(chance * 100)}% call.`] : []),
          ...(center ? [`His data center was already standing: it arrives with ${DC.spawn.lf} Life Force and ${DC.spawn.credit} takeoff credit.`] : [])] });
      const P = def.pepTalk;
      if (P) {   // the pep talk: her ultimate is ready and her ΦF comes back
        const max = s.rules.ultimateChargeMax, pfMax = a.maxPF ?? s.rules.maxPF, pf0 = a.pf || 0, ult0 = a.ultimateCharge || 0;
        if (P.maxUltimate) a.ultimateCharge = max;
        a.pf = Math.min(pfMax, pf0 + P.pf);
        const line = P.line || "You've been here before. Breathe, and finish it.";
        log(s, { kind: "companion", actor: ally.id, target: a.id, pepTalk: { pf: a.pf - pf0, ultimate: a.ultimateCharge - ult0, ready: a.ultimateCharge >= max }, tiles: [[a.x, a.y]],
          text: `${def.name}'s pep talk: "${line}"${P.maxUltimate ? ` ${a.name}'s ultimate is ready` : ""}${a.pf > pf0 ? `${P.maxUltimate ? " and" : ""} ${a.pf - pf0} ΦF comes back` : ""}.`,
          why: [`Pep talk: ${P.maxUltimate ? "ultimate charge filled, " : ""}+${P.pf} ΦF up to their maximum.`] });
      }
      return ally;
    }
    // Corner advice: as the companion's turn starts, a nearby owner recovers a little and strikes harder through their next turn.
    function cornerAdvice(s, a) {
      if (!a.companion || a.defeated) return;
      const def = s.rules.companions?.[a.companion.key], owner = s.actors[a.companion.owner], A = def?.advice;
      if (!A || !owner || owner.defeated || dist(s, a.x, a.y, owner.x, owner.y) > A.range) return;
      const gain = Math.max(0, Math.min(A.heal, owner.maxLF - owner.lf)); owner.lf += gain;
      owner.status.cornerAdvice = { label: "Corner advice", owner: a.id, mul: A.strikeMul, expiresAt: owner.ownerTurns + 1 };
      log(s, { kind: "cornerAdvice", actor: a.id, target: owner.id, healed: gain, tiles: [[owner.x, owner.y]], text: `${a.name} talks ${owner.name} through it${gain ? `: +${gain} LF` : ""}, Strikes ×${A.strikeMul} through their next turn.` });
    }
    const adviceMul = (a) => a.status?.cornerAdvice && a.status.cornerAdvice.expiresAt >= a.ownerTurns ? a.status.cornerAdvice.mul : 1;
    function companionTick(s, a) {   // called as its turn ends
      if (!a.companion || a.defeated) return;
      if (a.companion.turnsLeft == null) return;   // turns: null in the def: no clock (the Tech Billionaire's AGI)
      a.companion.turnsLeft -= 1; if (a.companion.turnsLeft > 0) return;
      const cdef = s.rules.companions?.[a.companion.key];
      a.defeated = true; a.escaped = true; a.leaveReason = cdef?.leave || "went back to the corner"; a.tempo = 0; spiritGone(s, a);
      log(s, { kind: "companion", actor: a.id, left: true, tiles: [[a.x, a.y]], text: `${a.name} ${cdef?.leave || "goes back to the corner"}.` }); checkOutcome(s);
    }
    // A released beast stays three of its own turns, then goes back to the wild.
    function beastTick(s, a) {   // called as its turn ends
      if (!a.beast || a.defeated) return;
      if (a.beast.tamed) { harrowingTick(s, a); return; }   // a tamed beast stays for the battle (engine/tamer.js) — unless it stares through the bond
      a.beast.turnsLeft -= 1; if (a.beast.turnsLeft > 0) return;
      a.defeated = true; a.escaped = true; a.leaveReason = "returned to the wild"; a.tempo = 0; spiritGone(s, a);
      log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} slips its bond and goes back to the wild.` }); checkOutcome(s);
    }
    // Harrowing (Mala, 2026-10-16): a tamed Sasquatch is never truly held. Each of its turns it meets
    // its owner's eyes, looking through his soul, and rolls to end the tame. On a break it walks back
    // into the wild at its current LF, hostile to all sides, keeping everything it learned.
    function harrowingTick(s, a) {
      const def = wildRules?.data?.monsters?.[a.beast.kind] || {}, chance = def.harrowing?.chance || 0;
      if (!chance) return;
      s.harrowN = (s.harrowN || 0) + 1;
      const owner = s.actors[a.beast.owner];
      if (H.seededChance(`${s.seed}:harrow:${s.harrowN}:${a.id}`) >= chance) {
        log(s, { kind: "tame", actor: a.id, target: a.beast.owner, tiles: [[a.x, a.y]], text: `${a.name} stares back at ${owner?.name || "its owner"}, looking through his soul. The bond holds — for now.`, why: [`Harrowing: ${Math.round(chance * 100)}% each of its turns to end the tame.`] });
        return;
      }
      a.defeated = true; a.escaped = true; a.leaveReason = "shattered the bond"; a.tempo = 0; spiritGone(s, a);
      (s.wild ||= []).push({ id: `wild-${a.beast.kind}-${s.round}-freed`, kind: a.beast.kind, form: "unit", name: def.name || a.name, reason: "shattered the bond", born: s.round, x: a.x, y: a.y, lf: a.lf, maxLF: a.maxLF, status: {}, sprite: def.sprite || a.sprite, traits: (a.traits || []).slice(), learned: (a.learned || []).slice(), home: [a.x, a.y] });
      log(s, { kind: "tame", actor: a.id, tiles: [[a.x, a.y]], text: `${def.name || a.name} shatters the bond and walks back into the wild, hostile to all sides.`, why: ["Harrowing: the tame ends. What it learned, it keeps."] });
      checkOutcome(s);
    }
    // ── Poison (Mala, 2026-10-11). A status that wears LF down each turn and saps action points, for a seeded 2 to 4
    // turns. The giant nettle caterpillar gives it to anything it stings and to anyone who touches it. A second dose
    // while poisoned restarts the count at the longer of the two; it does not stack.
    function eatShock(s, target, kind) {   // anime batch: Shock Eater forgets the first stagger or stun each battle; the wound is the meter
      if (!hasTrait(target, "shockEater") || target.shockEaten) return false;
      target.shockEaten = true; target.maxLF = Math.max(1, target.maxLF - 2); target.lf = Math.min(target.lf, target.maxLF);
      log(s, { kind: "resist", actor: target.id, text: `${target.name} forgets the ${kind}: it never happened (−2 max LF for the battle).`, why: ["Shock Eater: the first stagger or stun each battle is erased; the wound is the meter."] });
      return true;
    }
    const staggerTurns = (t) => (hasTrait(t, "ironJaw") || hasTrait(t, "vatGrown") ? 1 : 2);   // anime batch: Iron Jaw and Vat Grown rattle shorter
    // Entangled reader: a cut while ownerTurns <= expiresAt (turns.js expire() clears past it). moveBudgetFor
    // drops its floor to 0 for any positive cut, so a cut meeting the pre-cut budget pins the budget at 0
    // instead of 1; with no cut the ordinary floor of 1 stands. Writers keep expiresAt = victimTurns + 1.
    const tangleCut = (a) => { const ent = a.status?.entangled; return typeof ent === "number" ? ent : (ent?.expiresAt >= a.ownerTurns ? ent.lostMove || 0 : 0); };   // entangled { lostMove, expiresAt } slows the move budget (creepers, roots, Arcane Mastery)
    const moveFloor = (a) => (tangleCut(a) > 0 ? 0 : 1);   // a positive entangled cut drops the movement floor to 0, so a cut meeting the budget pins it there (moved out of engine.js for its size cap)
    // One refusal for every relocation verb the unit takes on its own feet (Move, Jump, Climb and their option lists):
    // a root, a position lock (Long View, Drawing, Digging) or a full entangled hold (budget pinned at 0) denies all three.
    const relocationHold = (s, a) => {
      const r = a.status.rooted, lk = a.status.lockMove;
      if (r?.expiresAt > a.ownerTurns) return r.scribed ? `${a.name} is rooted by ${r.label} and cannot move yet.` : `${a.name} is bound by the King's Law and cannot move yet.`;
      if (lk?.expiresAt > a.ownerTurns) return `${lk.label || "Long View"} locks your position until your next turn.`;
      if (tangleCut(a) > 0 && H.moveBudgetFor(s, a) <= 0) return `${a.name} is entangled and cannot move until it clears.`;
      return null;
    };
    // Entangled never weakens: a creeper's -1 must not overwrite a live stronger hold (Overgrowth 99, Esker's ridge).
    const entangle = (a, lostMove) => {
      const cur = a.status.entangled, live = typeof cur === "number" ? cur : (cur?.expiresAt >= a.ownerTurns ? cur.lostMove || 0 : 0);
      if (live > lostMove || (live === lostMove && cur?.expiresAt >= a.ownerTurns + 1)) return;
      a.status.entangled = { lostMove, expiresAt: a.ownerTurns + 1 };
    };
    function applyPoison(s, unit, def, sourceId, how) {
      const P = def.poison; if (!P || unit.defeated || unit.wild || isMonster(unit)) return;
      s.poisonN = (s.poisonN || 0) + 1;
      let turns = P.minTurns + Math.floor(seededChance(`${s.seed}:poison:${unit.id}:${s.poisonN}`) * (P.maxTurns - P.minTurns + 1));
      const src = sourceId ? s.actors[sourceId] || (s.wild || []).find((m) => m.id === sourceId) : null;   // anime batch: Yanagi's grandchildren deal +1 round...
      if (src && hasTrait(src, "poisonAffinity")) turns += 1;
      if (hasTrait(unit, "poisonAffinity")) turns = Math.max(1, turns - 1);   // ...and suffer −1 (min 1)
      const had = unit.status.poison?.turnsLeft || 0;
      unit.status.poison = { label: P.label, owner: sourceId || null, lf: P.lf, apLoss: P.apLoss, turnsLeft: Math.max(had, turns) };
      log(s, { kind: "poison", actor: sourceId || null, target: unit.id, tiles: [[unit.x, unit.y]], turns: unit.status.poison.turnsLeft,
        text: `${unit.name} is ${how === "touched" ? "stung by the spines they struck" : "stung"}: ${P.label} for ${unit.status.poison.turnsLeft} turns.`,
        why: [`Each of their turns: −${P.lf} LF and ${P.apLoss} fewer action points.`, how === "touched" ? "Striking it by contact is touching it. Techniques that never touch it are safe." : "Its spines break off in whatever comes beside it."] });
    }
    function poisonTick(s, a) {
      const p = a.status.poison; if (!p || a.defeated) return;
      const before = a.lf; a.lf = Math.max(1, a.lf - p.lf);   // poison weakens; it does not finish anyone by itself
      const lost = Math.min(a.tempo, p.apLoss); a.tempo -= lost; p.turnsLeft -= 1;
      log(s, { kind: "poisonTick", actor: a.id, amount: before - a.lf, tiles: [[a.x, a.y]], text: `${p.label}: ${a.name} loses ${before - a.lf} LF and ${lost} action points${p.turnsLeft > 0 ? ` (${p.turnsLeft} more turn${p.turnsLeft === 1 ? "" : "s"})` : "; the burning fades"}.` });
      H.concentrationCheck?.(s, a, before - a.lf);   // the sting tests focus like any blow (docs/concentration.md)
      if (p.turnsLeft <= 0) a.status.poison = null;
    }
    // a.vessel: the Animal Tamer marked believes he cannot die, and a man who cannot die does not run (Muse's TAMER_KIT.md,
    // proposed and taken 2026-10-15 for Mala to confirm). The mark is cleared when the vessel falls (damage.js).
    const neverFlees = (a) => (a?.traits || []).some((t) => insightRules?.data?.traits?.[typeof t === "string" ? t : t?.id]?.neverFlees);
    const fearless = (a) => !a || a.boss || a.summon || a.communed || a.beast || a.companion || a.controller === "player" || a.id === "player" || a.permanentAlly || a.routed || !!a.vessel
      || (isMonster(a) && EM.resists(a, "fear")) || (a.dream && !isMonster(a)) || a.character === "kaiba"   // the cat is unbothered
      || neverFlees(a)   // Main Character Energy (the Warden): he faces it head on
      || a.filmCostar   // under contract: the cast never walks off the set (Mala, 2026-10-19; asn-1a155091664)
      || H.ClassRuntime?.pledgeKept?.(a);   // a kept vow steadies its holder: fear finds no purchase (cleric negate hypothesis)
    // An AGI's nerve (content.js rules.agiNerve; docs/data-center.md): before it transcends it does not use the fear
    // formula at all. Every fear check and every hero-down rout is one flat chance, his escaped AGI and an encounter's alike.
    const agiNerve = (s, a) => (s.rules.agiNerve && a?.character === "agi" && !a.takeoff?.transcended && !a.defeated && !a.routed && !a.boss && a.controller !== "player" && a.id !== "player" ? s.rules.agiNerve.flee : null);
    function agiFlinch(s, tgt, src, cause) {
      const p = agiNerve(s, tgt); s.fearN = (s.fearN || 0) + 1;
      const fled = seededChance(`${s.seed}:${cause}:${tgt.id}:${s.fearN}`) < p;
      (s.fleeLog ||= []).push({ actor: tgt.id, round: s.round, cause: `agi:${cause}`, p, fled });
      if (!fled) return false;
      tgt.routed = { round: s.round, by: src?.id || null, cause }; tgt.status.guard = null;
      log(s, { kind: "rout", actor: tgt.id, target: src?.id || null, tiles: [[tgt.x, tgt.y]], text: `${tgt.name} calculates that this is not worth it, and makes for the edge.`,
        why: [`An AGI's nerve: a flat ${Math.round(p * 100)}% on every fear check until it transcends.`, "It has to reach the edge of the map to leave. It does not vanish where it stands."] });
      return true;
    }
    function fearCheck(s, tgt, src) {
      if (agiNerve(s, tgt) != null && tgt.lf > 0) return agiFlinch(s, tgt, src, "fear");
      if (fearless(tgt) || tgt.defeated || tgt.lf <= 0 || (tgt.ego ?? 0.5) >= FEAR.egoBelow) return null;
      const allies = Object.values(s.actors).filter(u => !u.defeated && !u.routed && u.side === tgt.side && u.id !== tgt.id);
      const near = allies.filter(u => dist(s, u.x, u.y, tgt.x, tgt.y) <= FEAR.steadyRadius).length;
      let p = ((FEAR.egoBelow - (tgt.ego ?? 0.5)) / FEAR.egoBelow) * FEAR.base * (1 - Math.min(FEAR.steadyMax, FEAR.steadyPerAlly * near));
      if (hasTrait(tgt, "fearful") || hasTrait(tgt, "skittish")) p *= FEAR.timidMul;
      if (!allies.length) p *= FEAR.lastStandingMul;
      // Stand while healthy (Mala, 2026-10-17; battle seed 2122468325): rout chance scales with own LF
      // fraction. No rank checks: a 60% fighter stands because he is winning, a 10% one breaks; full life
      // never breaks on fear. Visage gaze and hero-down rout keep their own formulas.
      const lfFrac = Math.max(0, Math.min(1, (tgt.lf ?? 1) / (tgt.maxLF || 1)));
      p *= Math.pow(1 - lfFrac, FEAR.lfPow ?? 1.5);
      if (hasTrait(tgt, "perfectConcentration")) p *= s.rules.concentration?.perfect?.fearMul ?? 1;   // composure, not courage
      for (const t of tgt.traits || []) p -= insightRules?.data?.traits?.[typeof t === "string" ? t : t?.id]?.fearResist || 0;   // Courageous
      const maimed = (s.rules.injury?.routMaimWeight ?? 1) ? H.Injury?.maimedCount(tgt) || 0 : 0;
      if (maimed) p += 0.05 * maimed;   // the maimed break first: +5% rout chance per maimed zone
      p = Math.max(0, Math.min(0.95, p));
      s.fearN = (s.fearN || 0) + 1;
      const roll = seededChance(`${s.seed}:fear:${tgt.id}:${s.fearN}`), fled = roll < p;
      (s.fleeLog ||= []).push({ actor: tgt.id, round: s.round, ego: +(tgt.ego ?? 0.5).toFixed(2), near, alive: allies.length, p: +p.toFixed(3), fled });
      if (!fled) return false;
      tgt.routed = { round: s.round, by: src?.id || null }; tgt.status.guard = null;
      log(s, { kind: "rout", actor: tgt.id, target: src?.id || null, tiles: [[tgt.x, tgt.y]], text: `${tgt.name} breaks and runs.`,
        why: [`Fear check: ${Math.round(p * 100)}% (ego ${(tgt.ego ?? 0.5).toFixed(2)}, ${tgt.lf}/${tgt.maxLF} LF, ${near} all${near === 1 ? "y" : "ies"} close${allies.length ? "" : ", last one standing"}${maimed ? `, ${maimed} maimed zone${maimed === 1 ? "" : "s"}` : ""}).`, "A routed unit runs for the edge of the map and leaves the fight when it gets there."] });
      return true;
    }
    // The Emissary's terrifying visage: every foe on the tiles faces fear at advantage
    // (floor 50%, steady allies give no comfort) and is marked with dread; the
    // dread-marked who run die running (coup de grace in damage.js).
    function visageGaze(s, src, tiles) {
      const set = new Set((tiles || []).map(([x, y]) => x + "," + y));
      let gazed = 0, fled = 0;
      for (const t of Object.values(s.actors)) {
        if (t.defeated || t.id === src?.id || t.side === src?.side || !set.has(t.x + "," + t.y)) continue;
        if (fearless(t)) continue;
        gazed++;
        t.status.dread = { round: s.round, by: src?.id || null };
        const allies = Object.values(s.actors).filter(u => !u.defeated && !u.routed && u.side === t.side && u.id !== t.id);
        let p = Math.max(0.5, ((FEAR.egoBelow - (t.ego ?? 0.5)) / FEAR.egoBelow) * FEAR.base);
        if (hasTrait(t, "fearful") || hasTrait(t, "skittish")) p *= FEAR.timidMul;
        if (!allies.length) p *= FEAR.lastStandingMul;
        for (const tr of t.traits || []) p -= insightRules?.data?.traits?.[typeof tr === "string" ? tr : tr?.id]?.fearResist || 0;
        p = Math.max(0, Math.min(0.95, p));
        s.fearN = (s.fearN || 0) + 1;
        const roll = seededChance(`${s.seed}:visage:${t.id}:${s.fearN}`), runs = roll < p;
        (s.fleeLog ||= []).push({ actor: t.id, round: s.round, visage: true, p: +p.toFixed(3), fled: runs });
        if (!runs) continue;
        t.routed = { round: s.round, by: src?.id || null }; t.status.guard = null; fled++;
        log(s, { kind: "rout", actor: t.id, target: src?.id || null, tiles: [[t.x, t.y]], text: `${t.name} sees the visage and breaks.`,
          why: [`Visage: ${Math.round(p * 100)}% (no comfort in company).`, "A routed unit runs for the edge; dread-marked runners invite the coup de grace."] });
      }
      if (gazed) log(s, { kind: "visage", actor: src?.id || null, tiles: tiles || [], text: `${src?.name || "Something"} unveils its visage: ${fled} of ${gazed} break and run.` });
      return { gazed, fled };
    }
    // When the hero falls (Mala, 2026-10-11): each ally still fighting may lose heart and run. Loyalty and courage hold
    // them; fear and being the last one left push them. Summons, communed plants and permanent allies never run.
    function heroFell(s, hero) {
      if (s.heroFellChecked?.[hero.id]) return; (s.heroFellChecked ||= {})[hero.id] = true;
      const allies = Object.values(s.actors).filter(u => u.side === hero.side && u.id !== hero.id && !u.defeated && !u.notArrived);
      const mortal = allies.filter(u => !u.summon && !u.communed && !u.beast && !u.permanentAlly && !u.boss && !u.routed && !u.dream && u.controller !== "player"
        && !(u.companion && s.rules.companions?.[u.companion.key]?.fearless) && agiNerve(s, u) == null && !neverFlees(u) && !u.filmCostar);   // a companion whose def says so (the escaped AGI) does not run; the cast is under contract
      const minds = allies.filter(u => agiNerve(s, u) != null && !u.filmCostar);   // an AGI on his side: its own flat chance, not the formula (unless under contract)
      if (!allies.length) return;
      log(s, { kind: "heroDown", actor: hero.id, tiles: [[hero.x, hero.y]], text: `${hero.name} is down. ${allies.length === 1 ? `${allies[0].name} fights on alone.` : "Their side fights on."}`,
        why: ["The battle is not lost while anyone on your side is still on the field."] });
      for (const u of mortal) {
        const others = allies.filter(v => v.id !== u.id), near = others.filter(v => dist(s, v.x, v.y, u.x, u.y) <= FEAR.steadyRadius).length;
        let p = FEAR.heroDown * (1 - Math.min(FEAR.steadyMax, FEAR.steadyPerAlly * near));
        if (hasTrait(u, "fearful") || hasTrait(u, "skittish")) p *= FEAR.timidMul;
        if (!others.length) p *= FEAR.lastStandingMul;
        if (hasTrait(u, "loyal")) p -= FEAR.loyalResist;
        for (const t of u.traits || []) p -= insightRules?.data?.traits?.[typeof t === "string" ? t : t?.id]?.fearResist || 0;
        p = Math.max(0, Math.min(0.95, p));
        s.fearN = (s.fearN || 0) + 1;
        const fled = seededChance(`${s.seed}:heroDown:${u.id}:${s.fearN}`) < p;
        (s.fleeLog ||= []).push({ actor: u.id, round: s.round, cause: "heroDown", near, alive: others.length, p: +p.toFixed(3), fled });
        if (!fled) continue;
        u.routed = { round: s.round, by: null, cause: "heroDown" }; u.status.guard = null;
        log(s, { kind: "rout", actor: u.id, tiles: [[u.x, u.y]], text: `${u.name} sees ${hero.name} fall, and runs.`, why: [`${Math.round(p * 100)}% chance. A routed ally makes for the edge of the map and leaves the fight there.`] });
      }
      for (const u of minds) agiFlinch(s, u, null, "heroDown");
    }
    // Flee edges are per-region: the pocket's edges are the pocket rect, the land's are the land rect.
    // (Without the pocket both are the whole map, as before.)
    const regionRect = (s, x) => {
      const A = s.astral;
      if (A?.ready && x >= A.x0) return { x0: A.x0, x1: A.x0 + A.w - 1, y0: 0, y1: s.arena.h - 1 };
      const landW = A?.ready ? A.landW : s.arena.w;
      return { x0: 0, x1: landW - 1, y0: 0, y1: s.arena.h - 1 };
    };
    const onEdge = (s, a) => { const r = regionRect(s, a.x); return a.x === r.x0 || a.y === r.y0 || a.x === r.x1 || a.y === r.y1; };
    const edgeDistance = (s, at) => { const r = regionRect(s, at[0]); return Math.min(at[0] - r.x0, at[1] - r.y0, r.x1 - at[0], r.y1 - at[1]); };
    // Grapple (content.js rules.grapple; the action is in actions.js): a held unit cannot move, jump, climb or dodge.
    // Held only while the holder stands within reach (Mala, 2026-10-26: "forced movement away from someone should instantly
    // break grapple"). breakHoldsApart clears the status the moment a forced move separates them.
    const grappled = (s, a) => { const g = a?.status?.grappled; if (!g || g.untilRound < s.round) return false; const h = s.actors?.[g.owner]; return !h || (!h.defeated && dist(s, h.x, h.y, a.x, a.y) <= (s.rules.grapple.range || 1)); };
    // Forced movement breaks the hold, whether or not it ends adjacent (Mala, 2026-10-30: "forced movement should break grapple";
    // widened from 2026-10-26, which only broke it when the two ended apart). Two seams, so a new forced move cannot forget:
    // knock() calls breakHoldsApart at the moment it shoves; settleHolds sweeps every hold against the tiles recorded when it
    // was taken (status.grappled.at), at the end of every apply and when a Strong Grip squeeze is about to read the hold.
    // The actor of a Move, Jump or Climb is exempt: a holder walking is its own move, and a held unit cannot walk at all.
    // The ONE list of actions that move their own actor without breaking that actor's hold (Mala's ruling on dashes, teleports and
    // Full Court Press is pending, 2026-10-30; change it here and nowhere else). Everything else that changes a tile breaks the hold.
    const OWN_MOVE_ACTIONS = Object.freeze(["move", "jump", "climb"]);
    function breakHoldsApart(s, u) {
      for (const v of Object.values(s.actors)) {
        const g = v.status?.grappled; if (!g || g.untilRound < s.round || (v.id !== u.id && g.owner !== u.id)) continue;
        const h = s.actors[g.owner], near = h && !h.defeated && dist(s, h.x, h.y, v.x, v.y) <= (s.rules.grapple.range || 1);
        v.status.grappled = null; if (v.status.submission) v.status.submission = null;
        v.regripImmuneUntil = s.round + (s.rules.grapple.strongGrip?.regripImmuneRounds ?? 1);
        log(s, { kind: "grapple", actor: v.id, target: h?.id || null, broke: true, tiles: [[v.x, v.y]],
          text: near ? `The hold breaks: ${u.name} is thrown clear.` : `${v.name} is torn out of ${h ? `${h.name}'s` : "the"} hold: forced apart.`,
          why: ["Forced movement of the holder or the held breaks the hold at once, even when they end side by side. Taking hold again costs action points."] });
      }
    }
    function settleHolds(s, exemptId = null, record = false) {
      for (const v of Object.values(s.actors)) {
        const g = v.status?.grappled; if (!g || g.untilRound < s.round) continue;
        const h = s.actors[g.owner], at = g.at, hat = h ? [h.x, h.y] : null;
        if (!at) { g.at = [[v.x, v.y], hat]; continue; }
        if (record) continue;   // record: only fill a hold that has no tiles yet
        const movedV = (at[0][0] !== v.x || at[0][1] !== v.y) && v.id !== exemptId, movedH = hat && at[1] && (at[1][0] !== hat[0] || at[1][1] !== hat[1]) && g.owner !== exemptId;
        if (movedV) breakHoldsApart(s, v); else if (movedH) breakHoldsApart(s, h);
        else g.at = [[v.x, v.y], hat];   // an exempt actor's own move re-records
      }
    }
    const grappleChance = (s, t) => { const G = s.rules.grapple; return Math.max(0.05, Math.min(0.95, G.base - (t.status?.guard ? G.guardPenalty : 0) + (t.status?.stun ? G.stunnedBonus : 0))); };
    // Submission (Muse W1.2, docs/submission.md; rules.submission). Every struggle ends: ±meter, `tieSlip` ties in a row, or
    // `maxRounds`; a submitted foe is out for good, and a foe that slipped free gets the regrip round like any broken hold.
    const subR = (s) => s.rules.submission;
    const subSum = (u, table) => Object.entries(table || {}).reduce((n, [t, v]) => n + (H.hasTrait(u, t) ? v : 0), 0);
    const heldBy = (s, a, t) => !!t && grappled(s, t) && t.status.grappled.owner === a.id;
    const canCommitSubmission = (s, a) => (a.ultimateCharge || 0) >= s.rules.ultimateChargeMax || (a.inspiration || 0) >= 1;
    function submitFoe(s, a, t, why) {
      t.status.submission = null; t.status.grappled = null;
      Object.assign(t, { submitted: true, spared: true, defeated: true, defeatedBy: a.id, tempo: 0 });
      log(s, { kind: "submitted", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${t.name} taps out: submitted to ${a.name}, spared and out of the fight.`,
        why: [why, "Submitted is not killed: the ledger marks them spared."] });
    }
    function slipFree(s, t, why) {
      t.status.submission = null; t.status.grappled = null; t.regripImmuneUntil = s.round + (s.rules.grapple.strongGrip?.regripImmuneRounds ?? 1);
      log(s, { kind: "grapple", actor: t.id, tiles: [[t.x, t.y]], text: `${t.name} ${why}.`, why: ["The hold is gone; one clear round before anyone can grab them again."] });
    }
    function pressSubmission(s, a, act) {
      const R = subR(s); if (!R) return "Submission is not in these rules.";
      const [tx, ty] = act.target || [], t = H.actorAt(s, tx, ty);
      if (!heldBy(s, a, t)) return "Press the submission on an opponent you are holding.";
      if (t.status.submission) return `${t.name} is already in the struggle.`;
      if (act.commit) {
        if (!canCommitSubmission(s, a)) return "A committed finish takes a full ultimate bar or 1 Inspiration.";
        if (act.pay === "inspiration" && (a.inspiration || 0) < 1) return "Paying with Inspiration takes 1 Inspiration.";   // Mala, 2026-10-26: Inspiration may pay and keep the bar
        const ult = (a.ultimateCharge || 0) >= s.rules.ultimateChargeMax && act.pay !== "inspiration";
        if (ult) a.ultimateCharge = 0; else a.inspiration -= 1;
        log(s, { kind: "announce", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${a.name} goes for the finish on ${t.name} (${ult ? "the full ultimate bar" : "1 Inspiration"} spent either way).`,
          why: [`${t.name} gets one answer: break the hold (${R.finishBreakAp} AP owed and the reaction) or submit.`] });
        s.phase = "response";
        s.pending = { inst: { submissionFinish: true, owner: a.id, target: t.id, name: "Submission finish", ability: null }, attacker: a.id, defenders: [t.id], responded: [], lookedAway: [], announcedTiles: [[t.x, t.y]] };
        H.skipUnable(s);
        return;
      }
      const spend = H.spendTempo(s, a, R.pressAp, "Press the submission"); if (spend) return spend;
      t.status.submission = { label: "Submission", by: a.id, meter: 0, rounds: 0, ties: 0 };
      log(s, { kind: "grapple", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${a.name} presses the submission on ${t.name}: the struggle begins.`,
        why: [`Each round: ${a.name}'s grapple and how long the hold has ripened against ${t.name}'s strength and grapple. Reach +${R.meter} and ${t.name} submits; −${R.meter} and they break free.`, `${a.name}'s ultimate bar drains ${R.ultDrain} a round while it lasts.`] });
    }
    // Round start (turns.js beginRound): one struggle roll per pressed foe.
    function submissionRound(s) {
      const R = subR(s); if (!R) return;
      for (const t of Object.values(s.actors)) {
        const st = t.status?.submission; if (!st) continue;
        const a = s.actors[st.by];
        if (t.defeated || !a || a.defeated || dist(s, a.x, a.y, t.x, t.y) > 1) { slipFree(s, t, "slips out of the submission: the holder is gone"); continue; }
        st.rounds += 1;
        const d6 = (who) => 1 + Math.floor(H.seededChance(`${s.seed}:submission:${t.id}:${st.rounds}:${who}`) * 6);
        const mine = subSum(a, R.skill) + Math.min(R.ripenCap, st.rounds) + d6("holder"), theirs = subSum(t, R.strength) + subSum(t, R.skill) + d6("held");
        if (mine > theirs) { st.meter += 1; st.ties = 0; } else if (theirs > mine) { st.meter -= 1; st.ties = 0; } else st.ties += 1;
        log(s, { kind: "grapple", actor: a.id, target: t.id, text: `The struggle: ${a.name} ${mine} vs ${t.name} ${theirs} (meter ${st.meter > 0 ? "+" : ""}${st.meter}).` });
        if (st.meter >= R.meter) { submitFoe(s, a, t, `${a.name} won the struggle.`); continue; }
        if (st.meter <= -R.meter) { slipFree(s, t, `breaks free of ${a.name}'s submission`); continue; }
        if (st.ties >= R.tieSlip) { slipFree(s, t, `slips free: ${R.tieSlip} even rounds and the grip loosens`); continue; }
        if (st.rounds >= R.maxRounds) { slipFree(s, t, `slips free: ${a.name} gasses out after ${R.maxRounds} rounds`); continue; }
        a.ultimateCharge = Math.max(0, (a.ultimateCharge || 0) - R.ultDrain);
        t.status.grappled.untilRound = Math.max(t.status.grappled.untilRound, s.round);   // the pressed hold holds
      }
    }
    // Reach and Grappler (content.js rules.strike.reach, rules.grapple.grappler).
    const strikeRange = (s, a) => { const T = s.rules.strike.telekinetic, L = s.rules.strike.reach; const B = s.rules.strike.bow, bow = B && B.characters.includes(a.character) ? B.range : 0; const reach = Math.max(bow, a.form?.strike?.range || 0, T && hasTrait(a, T.trait) ? T.range : L && hasTrait(a, L.trait) ? L.range : s.rules.strike.range); const frac = H.soulFrac?.(a) ?? 1; const base = frac >= 1 ? reach : Math.max(1, Math.round(reach * frac)); return base + Math.max(0, a.passives?.strikeRangeAdd || 0) + (H.fruitReach?.(a) || 0); };
    // Contact Reading (class-builds.js mma_fighter): everything costs a unit more while it is in the hold of someone
    // who has it, a Grapple or a Clinch. Returns the multiplier on that unit's action-point costs (1 when free).
    const heldCostMul = (s, a) => {
      if (!a?.status) return 1;
      const by = grappled(s, a) ? a.status.grappled.owner : a.status.held?.by, holder = by && s.actors[by];
      if (!holder || holder.defeated || holder.side === a.side) return 1;
      return H.ClassRuntime?.builds?.[holder.character]?.passives?.contact_reading?.effect?.heldApCostMul || 1;
    };
    // ADHD (Mala, 2026-10-17; docs/concentration-traits.md): a technique unlike the last one paid costs less, the same
    // one again costs more. Priced in manifest(), so the UI, the AI and the payment see one number. a.adhdChain = { ability, n }.
    function adhdPrice(s, a, abilityId, m) {
      const R = s.rules.concentration?.adhd, chain = a?.adhdChain;
      if (!R || !chain || !(m.tempoCost > 0) || !hasTrait(a, "adhd")) return;   // the first technique has no last one to differ from
      if (chain.ability === abilityId) {
        const extra = Math.max(1, Math.round(m.tempoCost * R.repeatAdd[Math.min(chain.n, R.repeatAdd.length) - 1]));
        m.tempoCost += extra; m.notes.push(`ADHD: the same technique again, +${extra} AP.`);
      } else { const off = Math.max(1, Math.floor(m.tempoCost * R.varietyOff)); m.tempoCost -= off; m.notes.push(`ADHD: something new, −${off} AP.`); }
    }
    function adhdPaid(s, a, abilityId) {
      if (hasTrait(a, "adhd")) a.adhdChain = a.adhdChain?.ability === abilityId ? { ability: abilityId, n: a.adhdChain.n + 1 } : { ability: abilityId, n: 1 };
    }
    // Contagious ideas (insight-data.js contagiousIdeas; Muse's chassis). spreadIdea exposes one listener to one idea from a
    // carrier: one seeded roll; success gives the idea (faith: a sermon, one point on the belief evidence track); failure
    // gives the anti-trait antiChance of the time, else nothing; either way that listener has heard it this battle.
    function spreadIdea(s, speaker, listener, ideaId) {
      const I = insightRules?.data?.contagiousIdeas?.[ideaId];
      if (!I || !speaker || !listener || listener.defeated || !insightRules.ideaEligible(ideaId, listener)) return null;
      const p = insightRules.ideaOdds(ideaId, listener, speaker), key = `${s.seed}:idea:${ideaId}:${speaker.id}>${listener.id}:${s.round}`;
      const won = seededChance(key) < p, anti = !won && I.anti && !hasTrait(listener, I.anti) && seededChance(`${key}:anti`) < I.antiChance;
      (listener.heardIdeas ||= {})[ideaId] = s.round;
      if (won && I.idea !== "beliefEvidence") (listener.traits ||= []).push(I.idea);
      if (anti) (listener.traits ||= []).push(I.anti);
      if ((won && I.idea !== "beliefEvidence") || anti) H.Inspiration?.witness?.(s, listener, "seesNewTrait", listener.id);   // seeing someone gain a trait in combat
      const say = (k) => (I.texts?.[k] || "").replace("{speaker}", speaker.name).replace("{listener}", listener.name);
      const odds = `A ${Math.round(p * 100)}% chance; a failure turns them against it ${Math.round(I.antiChance * 100)}% of the time. One hearing per person a battle.`;
      if (won && I.idea === "beliefEvidence")   // a sermon is evidence for this listener only (engine log -> belief-conversion.js witness)
        log(s, { kind: "sermon", actor: speaker.id, target: listener.id, witnesses: [listener.id], heard: true, tiles: [[listener.x, listener.y]], idea: ideaId,
          text: say("won"), why: [odds, "One point toward belief: two points force a reckoning, as witnessed miracles do."] });
      else log(s, { kind: "idea", actor: speaker.id, target: listener.id, idea: ideaId, won, anti, tiles: [[listener.x, listener.y]],
        text: say(won ? "won" : anti ? "anti" : "unmoved"), why: [odds] });
      return { won, anti, p };
    }
    // Talk is a vector: any talk a carrier aims at someone (Insight Talk, a talkative NPC talking at them) exposes them.
    function spreadByTalk(s, speaker, listener) {
      for (const id of Object.keys(insightRules?.data?.contagiousIdeas || {}))
        if (insightRules.data.contagiousIdeas[id].vector === "talk" && insightRules.ideaCarrier(id, speaker)) spreadIdea(s, speaker, listener, id);
    }
    const breakCost = (s, a) => Math.round(s.rules.grapple.break.ap * heldCostMul(s, a));
    const isGrappler = (s, a) => { const T = s.rules.grapple.grappler; return !!T && hasTrait(a, T.trait); };
    const grappleCost = (s, a) => isGrappler(s, a) ? s.rules.grapple.grappler.ap : s.rules.grapple.ap;
    // Action points of this Strike that are paid for: a grappler's first Strike each turn on a held opponent.
    const freeStrike = (s, a, t, effort) => isGrappler(s, a) && t && !t.wild && (grappled(s, t) || !!t.status?.held) && a.freeStrikeTurn !== a.ownerTurns ? Math.min(effort, s.rules.grapple.grappler.freeStrikeAp) : 0;
    function fleeBattle(s, a) {
      a.defeated = true; a.escaped = true; a.leaveReason = "fled in fear"; a.tempo = 0; spiritGone(s, a);
      log(s, { kind: "flee", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} flees the battle in fear.`, why: ["It reached the edge of the map. It is out of the fight, alive."] });
      if (a.hired) log(s, { kind: "hire", actor: a.id, left: true, tiles: [[a.x, a.y]],   // a contract that ends by terror still ends (Muse-2: technique oaths exposed the gap)
        text: a.hired.kind === "merc" ? `${a.name} breaks the contract and runs.` : `${a.name} abandons the letter and runs.` });
      checkOutcome(s);
    }
    const isMonster = (a) => !!(EM && a?.monster && a.dream && EM.data.monsters[a.monster]);
    function monsterCtx(s) {
      const weather = Climate && s.weatherState ? Climate.data.weather[s.weatherState.id] : null;
      const micro = Climate && s.weatherState ? Climate.microclimate(moduleArena(s.arena), s.weatherState, { wetTiles: Object.keys(s.wildWet || {}).map(k => k.split(",").map(Number)) }) : null;
      const fires = [];
      s.arena.map.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === "f") fires.push([x, y]); });
      for (const m of s.wild || []) if (m.tiles && !Array.isArray(m.tiles) && /fire/i.test(m.kind || "")) for (const k of Object.keys(m.tiles)) fires.push(k.split(",").map(Number));
      return { weather, micro, fires };
    }
    // Copy a rule's result onto the live actor and log what it said. Returns true if the monster is now down.
    function monsterApply(s, a, result) {
      const wasDown = !!a.defeated;
      Object.assign(a, result.m);
      for (const ev of result.events) log(s, { ...ev, kind: "monsterRule", tiles: [[a.x, a.y]] });
      if (a.defeated && !wasDown) { a.lf = 0; log(s, { kind: "defeat", target: a.id, text: `${a.name} is gone.` }); checkOutcome(s); }
      return !!a.defeated;
    }
    // ── The classic monsters' named attacks, infection and wrapping (audit fixes 2026-10-29). The attack is an ordinary
    // `damage` technique (content.js `mon_<id>`, offered through `learned`), so targeting, the AI and the reaction window
    // all see it. hit() calls monsterPotency before it prices the blow and monsterRider once it has landed.
    // (the manifest carries `ability`, not content.js's `monsterAbility`, so the species is read off the id)
    const monsterOf = (inst) => typeof inst?.ability === "string" && inst.ability.startsWith("mon_") ? inst.ability.slice(4) : null;
    const monsterPotency = (src, tgt, inst, potency) => monsterOf(inst) === "lifeDrain" && src && isMonster(src) ? EM.drain(src, tgt) : potency;
    function monsterRider(s, src, tgt, inst, lfBefore) {
      if (tgt.status?.infected) {   // a heal cures it; a hit only lowers the mark
        const r = EM.infectNote({ ...tgt, lf: lfBefore }, lfBefore);
        if (r.cured) { delete tgt.status.infected; delete tgt.infectLF; log(s, { kind: "monsterRule", target: tgt.id, tiles: [[tgt.x, tgt.y]], text: `${tgt.name} was healed: the infection is gone.` }); }
        else tgt.infectLF = Math.min(tgt.infectLF ?? Infinity, tgt.lf);
      }
      const id = monsterOf(inst); if (!id || !src || !isMonster(src) || !s.actors[tgt.id]) return;
      const note = (text) => log(s, { kind: "monsterRule", actor: src.id, target: tgt.id, tiles: [[tgt.x, tgt.y]], text });
      const dealt = Math.max(0, lfBefore - tgt.lf);
      if (id === "lifeDrain" && dealt > 0) { const g = Math.min(dealt, src.maxLF - src.lf); src.lf += g; note(`${src.name} drinks ${dealt} from ${tgt.name} and heals ${g}.`); }
      else if (id === "bindingWraps" && !tgt.defeated) { tgt.status.wrapped = { label: "Wrapped", forTurn: (tgt.ownerTurns || 0) + 1 }; note(`${tgt.name} is wrapped: it cannot move on its next turn.`); }
      else if (id === "stripBare" && !tgt.defeated) { const k = EM.stripOne(tgt); if (k) { tgt.status[k] = null; note(`Strip Bare pares ${tgt.name} to the bone: ${k} is gone.`); } }
      else if (id === "infectiousBite" && !tgt.defeated) { Object.assign(tgt, EM.infect(tgt)); note(`${tgt.name} is infected: −3 LF at the end of each of its turns, 3 turns, until healed.`); }
      else if (id === "chillingWail" && !tgt.defeated) { tgt.tempoDebt = (tgt.tempoDebt || 0) + 10; note(`${tgt.name} is chilled: −10 AP next turn.`); }
      else if (id === "pounce" && dist(s, src.x, src.y, tgt.x, tgt.y) > 1) {   // it leapt: land on the free tile beside the target nearest where it stood
        const at = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [tgt.x + dx, tgt.y + dy]).filter(([x, y]) => H.inside(s, x, y) && !H.actorAt(s, x, y) && !H.tileAt(s, x, y).blocksMove && !(H.barrierAt(s, x, y) && !H.barrierAt(s, x, y).passable) && H.dreamSame(s, src.x, src.y, x, y) && (!src.awakened || H.footOpen(s, src, x, y, "move")))
          .sort((p, q) => dist(s, src.x, src.y, p[0], p[1]) - dist(s, src.x, src.y, q[0], q[1]) || p[1] - q[1] || p[0] - q[0])[0];
        if (at) { src.x = at[0]; src.y = at[1]; note(`${src.name} leaps and lands beside ${tgt.name}.`); }
      }
    }
    // Turn edges. The mark on a wrap lapses once the wrapped turn has come; an infection is checked for a heal at the
    // turn's start and ticks (−3 LF) at its end, for anyone bitten, monster or not.
    function monsterTurnStart(s, a) {
      if (a.status.wrapped && a.status.wrapped.forTurn < a.ownerTurns) a.status.wrapped = null;
      if (a.status.infected && EM.infectNote(a).cured) { delete a.status.infected; delete a.infectLF; log(s, { kind: "monsterRule", target: a.id, tiles: [[a.x, a.y]], text: `${a.name} was healed: the infection is gone.` }); }
    }
    function monsterTurnEnd(s, a) {
      if (!a.status?.infected || a.defeated) return;
      if (EM.infectNote(a).cured) { delete a.status.infected; delete a.infectLF; log(s, { kind: "monsterRule", target: a.id, tiles: [[a.x, a.y]], text: `${a.name} was healed: the infection is gone.` }); return; }
      const r = EM.infectionTick(a); a.lf = r.unit.lf; a.infectLF = r.unit.infectLF; a.status = r.unit.status;
      log(s, { kind: "monsterRule", target: a.id, tiles: [[a.x, a.y]], text: `Infection: ${a.name} loses ${r.loss} LF${a.status.infected ? ` (${a.status.infected} tick${a.status.infected === 1 ? "" : "s"} left)` : ""}.` });
      if (a.lf <= 0) H.hit(s, a, a, null, 0, [`${a.name} succumbs to the infection.`], { label: "Infection", bleedOut: true });
    }
    // The Zombie is mindless: it goes for the NEAREST living unit, whichever side that unit is on (its summoner excepted).
    // The ordinary AI only weighs foes, so when the nearest unit is on the zombie's own side this answers instead: bite
    // it if it is in reach, else close in. Where the nearest is a foe, the ordinary AI fights as it always did.
    function mindlessAct(s, a) {
      const t = s.actors[EM.targetFor(a, Object.values(s.actors).filter(u => !u.defeated && !u.notArrived && !H.Tourist?.is(u)))];
      if (!t || t.side !== a.side) return null;
      const bite = EM.abilityId(a), def = C.abilities[bite], reach = (p, q) => dist(s, p[0], p[1], q[0], q[1]);
      if (def && reach([a.x, a.y], [t.x, t.y]) <= def.range && a.tempo >= def.tempoCost) { const act = { type: "ability", actor: a.id, ability: bite, target: [t.x, t.y] }; if (H.apply(s, act, { preview: true }).ok) return act; }
      const step = H.moveOptions(s, a.id).sort((p, q) => reach(p.to, [t.x, t.y]) - reach(q.to, [t.x, t.y]) || p.tempoCost - q.tempoCost)[0];
      if (step && reach(step.to, [t.x, t.y]) < reach([a.x, a.y], [t.x, t.y])) { const act = { type: "move", actor: a.id, to: step.to }; if (H.apply(s, act, { preview: true }).ok) return act; }
      return { type: "end", actor: a.id };
    }
    // Ghost: "Observing it fully (its unfinished business) releases it". Swept at the end of every turn, so the turn
    // that finishes the study is the turn it departs. Fully observed = one observer holds every card of its deck.
    function monsterRelease(s) {
      for (const g of Object.values(s.actors)) {
        if (g.defeated || !isMonster(g) || g.drawback !== "boundToHaunt") continue;
        const cards = s.insight?.decks?.[g.id]?.cards || [];
        const full = cards.length > 0 && Object.values(s.insight.knowledge || {}).some(k => k?.[g.id] && cards.every(c => k[g.id].revealed.includes(c.id)));
        if (!EM.released(g, { fullyObserved: full })) continue;
        g.defeated = true; g.released = true; g.lf = 0; g.leaveReason = "released"; spiritGone(s, g);
        log(s, { kind: "monsterRule", actor: g.id, tiles: [[g.x, g.y]], text: `${g.name}'s unfinished business is understood. It departs.` });
        log(s, { kind: "defeat", target: g.id, text: `${g.name} is gone.` }); checkOutcome(s);
      }
    }
    // Where may a summon arrive? Everything that already holds a tile: bodies (every tile of a big one), a wall that
    // is still standing, a wild unit and a blocking object. Palace calls and Death's Door share this one answer.
    function arrivalBlocked(s) {
      const out = new Set();
      for (const u of Object.values(s.actors)) if (!u.defeated) for (const [x, y] of H.footprint(u)) out.add(`${x},${y}`);
      for (const b of s.barriers || []) if (!b.passable && !b.passiveGround) out.add(`${b.x},${b.y}`);
      for (const w of s.wild || []) if (w.form === "unit" && !w.defeated) out.add(`${w.x},${w.y}`);
      for (const o of s.arena.objects || []) if (o.blocksMove && o.hp !== 0) out.add(`${o.x},${o.y}`);
      return out;
    }
    const hasTrait = (a, id) => !!id && (a?.traits || []).some(t => (typeof t === "string" ? t : t?.id) === id);
    // What the door would offer this unit if it fell holding `ap` points: 0 when it cannot open at all.
    function deathDoorOdds(s, id, ap) {
      const a = s.actors[id]; if (!a || !summonRules?.deathDoorChance || a.side !== "player" || a.id !== (s.modeSetup?.hero || "player") || s.deathDoorUsed) return 0;
      if (Object.values(s.actors).some(x => x.summon && !x.defeated && x.summon.owner === a.id)) return 0;
      if (!(s.unlockedSummons || []).some(sid => !(s.summonUsed || []).includes(sid))) return 0;
      return summonRules.deathDoorChance(ap, hasTrait(a, summonRules.data?.rules?.deathDoor?.gambler?.trait));
    }
    const communeDiscount = (a, kind = "plant") => (a.passives?.communePhiDiscount || 0) + (kind === "plant" && Communion?.rules.botanist && hasTrait(a, Communion.rules.botanist.trait) ? Communion.rules.botanist.phiDiscount : 0);   // Field Botany reads plants, not buildings
    function tryDeathDoor(s, owner) {
      if (!summonRules?.deathDoor || owner.summon || owner.dream || owner.side !== "player") return;
      if (owner.id !== (s.modeSetup?.hero || "player")) return;
      const active = Object.values(s.actors).filter(x => x.summon && !x.defeated && x.summon.owner === owner.id).map(x => x.id);
      const apLeft = Math.max(0, (owner.tempo || 0) + (owner.bankedTempo || 0) - (owner.tempoDebt || 0));
      const gambler = hasTrait(owner, summonRules.data?.rules?.deathDoor?.gambler?.trait);
      const door = summonRules.deathDoor({ seed: s.seed, round: s.round, ownerId: owner.id, apLeft, unlocked: s.unlockedSummons || [], used: s.summonUsed || [], active, spent: !!s.deathDoorUsed, gambler });
      if (door.chance) log(s, { kind: "deathDoorRoll", actor: owner.id, chance: door.chance, opened: !!door.ok, gambler, text: `${owner.name} falls with ${apLeft} action points unspent: ${Math.round(door.chance * 100)}% chance a summon answers${gambler ? " (a Gambler's odds)" : ""}.${door.ok ? "" : " None does."}` });
      if (!door.ok) return;
      const at = summonRules.placeSummon(moduleArena(s.arena), [owner.x, owner.y], arrivalBlocked(s));
      if (!at) { log(s, { kind: "deathDoor", actor: owner.id, text: "A summon answers, but there is no open ground beside the fallen." }); return; }
      const raw = summonRules.makeSummonActor(door.id, { owner: owner.id, at, durationAdd: owner.passives?.summonDurationAdd || 0 });
      const summon = liveSummon(s, owner, raw);
      summon.defeated = false; summon.knockedOut = false; summon.lf = raw.lf; summon.maxLF = raw.maxLF; summon.deathDoor = null; summon.focus = null;
      summon.summon = { ...summon.summon, deathDoor: true };
      s.actors[summon.id] = summon; s.disclosures[summon.id] = {}; s.knowledge[summon.id] = {};
      if (s.observedAbilities) s.observedAbilities[summon.id] = [];
      if (insightRules) { const deck = insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[summon.id] = deck; s.insight.knowledge[summon.id] = insightRules.spawnKnowledge(deck); }
      s.order.splice(s.turnIndex + 1, 0, summon.id); s.summonUsed.push(door.id); s.deathDoorUsed = true;
      owner.deathDoor = { summon: summon.id, round: s.round, apSpent: apLeft };
      owner.tempo = 0; owner.bankedTempo = 0;
      log(s, { kind: "deathDoor", actor: summon.id, target: owner.id, tiles: [at], text: `${summon.name} steps out unbidden to stand over ${owner.name} for ${summon.summon.turnsLeft} turns. The fight is not lost while they stand.`,
        why: [`Death's door: ${Math.round(door.chance * 100)}% chance, once per battle, paid with the ${apLeft} action points ${owner.name} had left.`, "The summoner stays down. If the summon leaves or falls with enemies still standing, the battle is lost."] });
    }
    function performerTestOptions() {
      return {encounter:"firstWall",focusedDreamTest:true,performerTest:true,keepPlayerCharacter:true,title:"Performers · playable test 1",seed:41,startingActor:"player",initialSummons:[],participants:[
        {id:"player",character:"musician",side:"player",at:[4,3]},
        {id:"rapper",character:"rapper",side:"player",at:[3,3]},
        {id:"bard",character:"bard",side:"player",at:[4,2]},
        {id:"student",character:"student",side:"enemy",at:[6,3]},
        {id:"sieve",character:"sieve",side:"enemy",at:[6,1]}
      ]};
    }
    function focusedDreamTestOptions() {
      return { encounter:"firstWall", focusedDreamTest:true, title:"Focused Dream · playable test 1", seed:17, startingActor:"player",
        arenaData:{name:"Focused Dream Test",map:Array(7).fill("..........."),objects:[]},
        participants:[{id:"player",character:"warden",at:[4,3]},{id:"student",character:"student",at:[5,3]},{id:"sieve",character:"sieve",at:[7,3]},{id:"gardener",character:"gardener",at:[5,5]}],
        loadouts:{player:{primary:"barrier",secondary:"elasticity",reserve:["diffusion"]},gardener:{primary:"diffusion",secondary:"swale"}} };
    }

    function themedBattleOptions(theme, playerChar, allyChar, foe1, foe2, title) {   // sub-faction themed battle (Mala, 2026-10-17): one crew against itself
      return { encounter: "firstWall", themedBattle: theme, keepPlayerCharacter: true, title, seed: 101, startingActor: "player", initialSummons: [], participants: [
        { id: "player", character: playerChar, side: "player", at: [2, 3] },
        { id: "ally", character: allyChar, side: "player", at: [2, 4] },
        { id: "foe-1", character: foe1, side: "enemy", at: [8, 3] },
        { id: "foe-2", character: foe2, side: "enemy", at: [8, 4] },
      ] };
    }
    function meleeTestOptions() {   // sub-faction melee (Mala, 2026-10-17): four crews, last standing wins
      return { encounter: "firstWall", mode: "melee", keepPlayerCharacter: true, title: "Sub-faction Melee · street vs stage vs lab vs wilds", seed: 117, startingActor: "player", initialSummons: [], participants: [
        { id: "player", character: "mma_fighter", side: "player", at: [2, 3] },
        { id: "street-2", character: "kickboxer", side: "player", at: [2, 4] },
        { id: "stage-1", character: "musician", side: "stage", at: [8, 2] },
        { id: "stage-2", character: "bard", side: "stage", at: [8, 4] },
        { id: "lab-1", character: "scientist", side: "lab", at: [5, 1] },
        { id: "lab-2", character: "hacker", side: "lab", at: [6, 1] },
        { id: "wilds-1", character: "ranger", side: "wilds", at: [5, 5] },
        { id: "wilds-2", character: "mutant_boar", side: "wilds", at: [6, 5] },
      ] };
    }
    function devPlaygroundOptions() {
      return { encounter: "firstWall", devPlayground: true, title: "DEV Playground · max ULT, 1000 AP, every orb, Gold Form, live punching bag", seed: 7, startingActor: "player",
        rules: { actionPointsPerTurn: 1000 },
        arenaData: { name: "DEV Playground", map: Array(7).fill("..........."), objects: [] },
        participants: [
          { id: "player", character: "warden", at: [3, 3] },
          { id: "bag", character: "soldier", side: "enemy", at: [7, 3], name: "Punching Bag", maxLF: 5000, standDownUntil: 9999 },
        ],
        loadouts: { player: { ultimateCharge: 100 } }, vessels: { shard: 3, bead: 2, orb: 1, free: 0 } };
    }
    // Learned forms (2026-10-17; docs/learned-forms.md): what bosses.js formRider / holdTick need from the engine, for one
    // caster (and target); and the hero's learned forms carried in from the account (opts.learnedFormsMap by character).
    function formCtx(s, a, t = null) {
      const { tileAt, actorAt, barrierAt, inside, log } = H, living = (u) => { const g = tileAt(s, u.x, u.y).tags || []; return g.includes("soil") || g.includes("plant"); };
      return { round: s.round, log: (ev) => log(s, ev), fearCheck: (u) => fearCheck(s, u, a), applyPoison: (u, def) => applyPoison(s, u, def, a.id),
        free: (x, y) => inside(s, x, y) && !tileAt(s, x, y).blocksMove && !actorAt(s, x, y) && !barrierAt(s, x, y) && (!a.awakened || H.footOpen(s, a, x, y, "move")), moveTo: (u, x, y) => { if (u.awakened && ((u.size?.w || 1) > 1 || (u.size?.h || 1) > 1) && !H.footOpen(s, u, x, y, "move")) return false; u.x = x; u.y = y; return true; },
        allies: () => Object.values(s.actors).filter((u) => !u.defeated && u.side === a.side),
        foes: () => Object.values(s.actors).filter((u) => !u.defeated && !u.notArrived && u.side !== a.side && u.side !== "bystander"),
        tile: (x, y) => tileAt(s, x, y), livingBoth: !!t && living(a) && living(t), isAI: a.controller === "ai" || a.id !== "player",
        burning: (x, y) => (s.wild || []).some((m) => m.kind === "brushfire" && !m.done && m.tiles && `${x},${y}` in m.tiles),
        wet: (x, y) => !!Climate?.data?.weather?.[s.weatherState?.id]?.rain || [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(s, x + dx, y + dy) && (tileAt(s, x + dx, y + dy).tags || []).includes("water")),   // rain, or water at or beside the tile
        ignite: (x, y) => { if (!H.wildRules?.useItem || !inside(s, x, y)) return; const r = H.wildRules.useItem(H.wildSnapshot(s), "flare", [x, y]); if (r.events.some((e) => e.kind !== "item" && !/Nothing there will burn/.test(e.text || ""))) { H.saveWildWorld(s, r.world); for (const ev of r.events.filter((e) => e.kind !== "item")) log(s, { ...ev, kind: ev.kind || "terrain", actor: a.id }); } },
        unveilNear: (u, r) => Object.values(s.actors).filter((v) => !v.defeated && v.side !== u.side && v.status?.concealed && Math.max(Math.abs(v.x - u.x), Math.abs(v.y - u.y)) <= r).map((v) => { delete v.status.concealed; return v; }),
        plantsNear: (x, y) => (s.arena.objects || []).filter((o) => Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) === 1 && /tree|shrub|plant|hedge|groundcover/i.test(`${o.kind || ""} ${o.type || ""} ${o.role || ""}`)).length };
    }
    // Broodmind's larva: a three-turn companion beside the Chitin Knight (content.js rules.companions.brood_larva).
    function spawnFormLarva(s, owner) {
      const def = s.rules.companions?.brood_larva; if (!def) return null;
      const { tileAt, actorAt, barrierAt, inside, log } = H;
      const open = ([x, y]) => inside(s, x, y) && !tileAt(s, x, y).blocksMove && !actorAt(s, x, y) && !barrierAt(s, x, y);
      const at = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [owner.x + dx, owner.y + dy]).find(open); if (!at) return null;
      const id = `companion-brood_larva-${owner.id}-${s.round}-${++s.seq}`;
      const u = { id, name: def.name, side: owner.side, controller: "ai", ai: "ally", character: "brood_larva", sprite: def.sprite, primary: def.primary, secondary: def.secondary,
        maxLF: def.lf, lf: def.lf, x: at[0], y: at[1], companion: { owner: owner.id, key: "brood_larva", turnsLeft: def.turns }, pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0,
        level: owner.level || 1, xp: 0, proficiency: 1, reserve: [], reserveSlots: 0, pendingSwap: null, lens: {}, reaction: s.rules.reactionsPerRound, moved: false, acted: false,
        tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false, ownerTurns: 0, lastRecoverTurn: -99,
        status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null }, inventory: [], inventoryCapacity: 0, passives: {}, traits: [], conditions: {},
        lanyardUsed: false, bristleconeUsed: false, lastDamageType: null, defeated: false };
      s.actors[id] = u; s.disclosures[id] = {}; s.knowledge[id] = {}; if (s.observedAbilities) s.observedAbilities[id] = [];
      if (insightRules) { const deck = insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[id] = deck; s.insight.knowledge[id] = insightRules.spawnKnowledge(deck); }
      for (const o of Object.values(s.actors)) if (o.id !== id && o.side !== u.side) { (s.knowledge[o.id] ||= {})[id] ||= { secondary: false, lens: false, abilities: {} }; s.knowledge[id][o.id] = { secondary: false, lens: false, abilities: {} }; }
      s.order.splice(s.turnIndex + 1, 0, id);
      log(s, { kind: "companion", actor: id, target: owner.id, tiles: [at], arrived: true, text: `A ${def.name} hatches beside ${owner.name} for ${def.turns} turns.`, why: ["Broodmind: a hit of 15 or more wakes the brood (2 at most)."] });
      return u;
    }
    // Every unit's turn start (curse marks, acquired units, Platform), and Hollow after every action.
    function formsTurnStartFor(s, a) {
      if (!H.bossRules?.formsTurnStart) return;
      const evs = H.bossRules.formsTurnStart(a, { actors: () => Object.values(s.actors), hit: (u, by, dmg, label) => H.hit(s, s.actors[by] || { id: by, name: "A curse", side: "enemy" }, u, null, dmg, [`${label}: laid by the Kanabō on a target below half.`], { label, damageType: "albedo" }) });
      for (const ev of evs) H.log(s, ev);
    }
    function formsAfterAction(s) {
      if (!H.bossRules?.hollowClamp) return;
      for (const u of Object.values(s.actors)) { const ev = !u.defeated && H.bossRules.hollowClamp(u); if (ev) H.log(s, ev); }
    }
    function carryLearnedForms(s, opts) {
      const hero = s.actors[s.modeSetup?.hero || "player"], known = hero && (opts.learnedForms || opts.learnedFormsMap?.[hero.character]);
      if (hero && Array.isArray(known) && known.length) hero.learnedForms = known.filter((id) => H.bossRules?.formFor?.(id));
    }
    // Story relics (Mala, 2026-10-27): a story character fights carrying every relic whose carriedBy names it (the same items
    // it can drop). The player playing that character brings their own equipped kit instead, unless the battle sets
    // storyKit (sims and ratings do: "the player will never face a Ram without his kit, so that's who the sim should test"). Stacks like gear: numbers add, *Mul multiplies, objects merge per key. skip: relics the player already wears.
    function relicPassives(base, character, skip = null) {
      const eq = H.accountItems?.equipment || {}, out = { ...base };
      for (const [id, it] of Object.entries(eq)) {
        if (!character || !(it.carriedBy || []).includes(character) || (skip || []).includes(id)) continue;
        for (const [k, v] of Object.entries(it.passive || {})) {
          if (typeof v === "number") out[k] = typeof out[k] === "number" ? (/Mul$/.test(k) ? out[k] * v : out[k] + v) : v;
          else if (v && typeof v === "object" && !Array.isArray(v)) { const o = { ...(out[k] || {}) }; for (const [kk, vv] of Object.entries(v)) o[kk] = typeof vv === "number" && typeof o[kk] === "number" ? (/Mul$/.test(k) ? o[kk] * vv : o[kk] + vv) : vv; out[k] = o; }
          else out[k] = v;
        }
      }
      return out;
    }
    return { relicPassives, OWN_MOVE_ACTIONS, breakHoldsApart, settleHolds, pressSubmission, submissionRound, submitFoe, slipFree, canCommitSubmission, waterState, isSwimmer, refreshWaterDrowning, waterRecovery, updateWater, previewFlood, advanceWater, fishRound, fishNear, carryLegacy, carryBeasts, legacyPrice, journalOptions, nameRandomFoes, assignEnemyLoci, corpseSweep, corpseBeside, burialAp, lastRites, graveWard, formCtx, carryLearnedForms, spawnFormLarva, formsTurnStartFor, formsAfterAction, spreadIdea, spreadByTalk, adhdPrice, adhdPaid, heldCostMul, breakCost, callCompanion, cornerAdvice, adviceMul, companionTick, strikeRange, grappleCost, freeStrike, grappled, grappleChance, knownEnemyTraps, chanted, endRitual, ritualTick, finishRitualsOnWin, riteDiscount, endRite, riteTick, grantSacrifice, beadBeast, beastTick, applyPoison, poisonTick, fearless, fearCheck, visageGaze, heroFell, onEdge, adjustMoveCost, consumeMoveMods, refundMove, eatShock, staggerTurns, tangleCut, moveFloor, relocationHold, entangle,
      edgeDistance, fleeBattle, isMonster, monsterCtx, monsterApply, monsterOf, monsterPotency, monsterRider, monsterTurnStart, monsterTurnEnd, monsterRelease, mindlessAct, arrivalBlocked, hasTrait, deathDoorOdds, communeDiscount, tryDeathDoor, performerTestOptions,
      focusedDreamTestOptions, devPlaygroundOptions, themedBattleOptions, meleeTestOptions,
      directiveLive, directiveDestOpen, consumeDirective, tilesOccupiedIn, pairWithin,
      placeMarker, markersLive, markersAt, removeMarker, removeMarkers, markerBlocked, validSignalOrigin,
      prepaidLive, prepaidDestOpen, prepaidEscape };
  })();
});
