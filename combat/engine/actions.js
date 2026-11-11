"use strict";
// Actions: apply() and the handler for every action type.
// A part of the Concept Combat engine, split out of engine.js on 2026-10-11 (tools/split-engine.mjs). It is not a
// module in its own right: engine.js installs it with the host object H (everything the engine closure has in
// scope) and it hands back the functions it defines. Function bodies are exactly as they were in engine.js.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actions = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const Cooking = () => (typeof module === "object" && module.exports ? require("../account/cooking.js") : globalThis.ConceptCombatCooking) || null;
    const Sage = () => (typeof module === "object" && module.exports ? require("../castings/sage.js") : globalThis.ConceptCombatSage) || null;
    const VerbTech = () => (typeof module === "object" && module.exports ? require("../workshop/verbtech.js") : globalThis.ConceptCombatVerbTech) || null;   // verb techniques, batch 1 (lazy: no engine install)
    const Spirit = () => (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null;
    const Orders = () => (typeof module === "object" && module.exports ? require("../spirit/orders.js") : globalThis.ConceptCombatOrders) || null;
    const PactLib = () => (typeof module === "object" && module.exports ? require("../summons/contracts.js") : globalThis.ConceptCombatSummonContracts) || null;   // summon pacts: standing rates only (the store lives on the account)
    const { Auras, Affinity, Conversion, Courtroom, Presence, Debt, Sealing, EmergentIdeas, EnemySummons, Bonds, C, CRAFT, CRAFT_OWN, ClassRuntime, Climate, Communion, DIRS, Director, EM, Imitation, MED, MaidSystems, MindDuel, Parley, Performers, Postures,
      REVEAL, RITUAL, Traps, Tsukumogami, UtilityAI, Vows, ab, abilitiesOf, accountItems, actorAt, advance, applyEntryEffects, applyFall, auraH, awakenAlly, barrierAt,
      beadBeast, borrowedCharges, bossRules, chanted, chargeUltimate, checkDreamCollapse, checkOutcome, classH, clone, communeAlly, communeDiscount, conceptName,
      currentId, declaredRange, dist, disturbSuccession, dreamSame, dreamSpaceRules, edgeUsed, endRite, endTurn, findOpp, fleeBattle, footprint, fullCourtPressOptions,
      hasDeception, hasSight, hasTrait, heightAt, hit, inside, insightRules, isMonster, keepDreamPositions, key, line, liveSummon, log, manifest,
      mirrorRules, moveBudgetFor, onEdge, ownerOfConcept, patchAt, paths, pickupRules, plantUnderfoot, presidentContext, presidentEffects,
      presidentRules, presidentUnits, rangeEnvelope, recordMirrorEvent, refreshDrowning, revealDreamSummons, riteDiscount, roundFn, saveWildWorld, settleHomeward,
      spendTempo, standFootprint, strikeTarget, summonQuestions, summonRules, summonProfile, summonReadiness, summonSnapshot, syncPickup, syncPresidentUnit, target, tileAt, unitAt, vegetation, wildRules,
      wildSnapshot } = H;
    const sealedNext = () => (typeof module === "object" && module.exports ? require("../sealed-next.js") : globalThis.ConceptCombatSealedNext);
    const DreamData = () => (typeof module === "object" && module.exports ? require("../dream/dream-data.js") : globalThis.ConceptCombatDreamData) || null;   // O2a: a dream monster's teaches for the observe result
    const Dream = () => (typeof module === "object" && module.exports ? require("../dream/dream.js") : globalThis.ConceptCombatDream) || null;   // O2b: naming the dream from Rituals
    const OG = () => (typeof module === "object" && module.exports ? (() => { try { return require("../orgonite/orgonite.js"); } catch { return null; } })() : globalThis.ConceptCombatOrgonite) || null;
    // defined by parts installed after this one: reached through H when called
    const aiAction = (...args) => H.aiAction(...args);
    const candidates = (...args) => H.candidates(...args);
    const applyTerrainEvents = (...args) => H.applyTerrainEvents(...args);
    const climbOptions = (...args) => H.climbOptions(...args);
    const demonstratedTraits = (...args) => H.demonstratedTraits(...args);
    const engineArena = (...args) => H.engineArena(...args);
    const moduleArena = (...args) => H.moduleArena(...args);
    const openResponseWindow = (...args) => H.openResponseWindow(...args);
    const recordShown = (...args) => H.recordShown(...args);
    const resolveAbility = (...args) => H.resolveAbility(...args);
    const respond = (...args) => H.respond(...args);
    const score = (...args) => H.score(...args);
    const seededChance = (...args) => H.seededChance(...args);
    const addStun = (...args) => H.addStun(...args);
    const strikeRange = (...args) => H.strikeRange(...args), grappleCost = (...args) => H.grappleCost(...args), freeStrike = (...args) => H.freeStrike(...args);
    const grappled = (...args) => H.grappled(...args), grappleChance = (...args) => H.grappleChance(...args);
    const targeting = (...args) => H.targeting(...args);
    // Rite-step palingenesis (muse, 2026-10-22): burn/call stay their own actions and bank a rite step
    // as a side effect. Gating mirrors riteStep; when no step can bank, the caller still lands its board
    // effect — the step is the side effect, not the price — and the log says why nothing banked.
    function bankRiteSideStep(s, a, type) {
      const R = s.rules.rite ?? {}, max = R.maxSteps ?? 3, rite = a.rite || { steps: [], hold: 0 };
      const no = a.ritual ? "chanting a capture" : rite.steps.length >= max ? "three steps banked already" : rite.stepTurn === a.ownerTurns || a.riteStepTurn === a.ownerTurns ? "one rite step per turn" : "";
      if (no) { log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name}'s rite takes no step from it (${no}).` }); return; }
      H.Rites.step(s, a, type);   // L1: the step banks through the ledger; the mirror keeps the gates' shape
      log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name}'s rite holds ${a.rite.steps.length} step${a.rite.steps.length === 1 ? "" : "s"} (bank keeps ${a.rite.hold} turns).` });
    }

    // ── actions ─────────────────────────────────────────────────────────────
    // opt.preview: stop at the end of this action (no automatic turn end), for previews and AI scoring.
    // Live board reads for learning; no synthetic terrain knowledge or account writes.
    // Recovery is explicit: rejected apply() still returns the unchanged input.
    function aiFailure(state, action) {
      if (!UtilityAI || (action?.type!=="ability" && action?.type!=="setIntent") || action.actor==="player" || !state.actors[action.actor]) return state;   // Mystery S1 (1.3.549): a refused face-down set is a failed technique too, so the refusal is recorded and the AI stops offering it for three rounds
      const s=clone(state), actor=s.actors[action.actor]; s.aiMinds ||= {}; s.aiBans ||= {};
      const mind=s.aiMinds[actor.id] ||= UtilityAI.createMind(actor,{posture:actor.posture,seed:s.seed});
      mind.reliability[action.ability]=(mind.reliability[action.ability]??1)*0.3;
      (s.aiBans[actor.id] ||= {})[action.ability]=s.round+3;
      log(s,{kind:"strategy",actor:actor.id,key:action.ability,reason:"ineffective",text:`${actor.name} changes approach after a failed technique; it will retry after three rounds.`});
      return s;
    }
    function aiSnapshot(s) {
      const countKnown = obj => !obj ? 0 : typeof obj === "object" ? Object.values(obj).reduce((n,v)=>n+countKnown(v),0) : obj === true ? 1 : 0;
      return { units: Object.values(s.actors).map(a => {
        const foes = Object.values(s.actors).filter(t=>!t.defeated && t.side!==a.side);
        const nearest = foes.length ? Math.min(...foes.map(t=>dist(s,a.x,a.y,t.x,t.y))) : 0;
        return { ...a, hero:a.id==="player", posScore:1/(1+nearest), ultimateCharge:(a.ultimateCharge||0)*100/(s.rules.ultimateChargeMax||100) };
      }), wild:s.wild||[], objectives:[], knowledge:Object.fromEntries(Object.keys(s.actors).map(id=>[id,countKnown(s.knowledge?.[id])])),
      fields:s.dreamSpace?[{type:"dreamSpace",owner:s.dreamSpace.owner}]:[] };
    }
    function aiLearnResult(before, after, action, predicted) {
      if (!UtilityAI || action.actor==="player" || !["ability","strike","move","recover","guard","useItem"].includes(action.type)) return;
      const actor=before.actors[action.actor]; if(!actor) return;
      after.aiMinds ||= {};
      const mind=before.aiMinds?.[actor.id] || UtilityAI.createMind(actor,{posture:actor.posture,seed:before.seed});
      const b=aiSnapshot(before), p=aiSnapshot(predicted), a=aiSnapshot(after);
      const f0=UtilityAI.features(b,actor.id), f1=UtilityAI.features(p,actor.id);
      const delta=Object.fromEntries(UtilityAI.FEATURES.map(k=>[k,f1[k]-f0[k]]));
      const result=UtilityAI.learn(mind,b,a,{kind:action.ability||action.type,delta});
      after.aiMinds[actor.id]=result.mind;
      for(const event of result.events) log(after,event);
      // Why it failed, in words (Mala, 2026-10-14): the cause, and what the unit will do about it. engine/ai.js lessonsOf
      // reads the same entries back when it next chooses.
      const name=(id)=>after.actors[id]?.name||id;
      for(const e of after.log.slice(before.log.length)){
        if(e.kind==="parry"&&e.attacker===actor.id) log(after,{kind:"strategy",actor:actor.id,reason:"parried",target:e.target,
          text:`${actor.name} learns why that failed: ${name(e.target)} was waiting with a Rebound for ${e.delivery} hits.`,why:[`For the next few rounds ${actor.name} avoids ${e.delivery} hits on ${name(e.target)} and looks for another way in.`]});
        else if(e.kind==="negate"&&e.cause==="barrier"&&e.actor===actor.id) log(after,{kind:"strategy",actor:actor.id,reason:"barrier",
          text:`${actor.name} learns why that failed: the Shield Wall at (${e.at.join(",")}) stops ${e.delivery} hits.`,why:[`${actor.name} will go around the wall or use something that passes barriers (a field, a routed or arcing attack).`]});
        else if(e.kind==="damage"&&e.actor===actor.id&&(e.why||[]).some(w=>/attune|Adaptive Brace/i.test(w))) log(after,{kind:"strategy",actor:actor.id,reason:"resisted",target:e.target,
          text:`${actor.name} notices ${name(e.target)} is adapting to ${C.damageTypes?.[e.damageType]?.name||e.damageType} hits.`,why:[`${actor.name} will favour other damage types on ${name(e.target)} while that lasts.`]});
      }
    }
    // Annotate an existing outcome, not a second log line: deterministic evidence for presentation.
    function markConversation(before, after, action, start) {
      const type=action.type;
      if(!["insight","parley","terms","comeToTerms","answerTerms","mediate","tallyTerms","mindPick","mindVow","mindConcede"].includes(type))return;
      const duel=before.mindDuel, other=duel && (duel.a===action.actor?duel.b:duel.a);
      const entries=after.log.slice(start).filter(e=>["insight","parley","truce","tally","resist","report"].includes(e.kind)&&e.text);
      const own=entries.filter(e=>e.actor===action.actor);
      const entry=(own.length?own:entries.filter(e=>e.actor===other || e.actor===action.target)).at(-1);
      if(!entry)return;
      const title=type==="insight" ? insightRules?.data?.actions?.[action.action]?.name || "Talk" :
        ({parley:"Talk",terms:"Come to terms",comeToTerms:"Come to terms",answerTerms:action.accept?"Terms accepted":"Terms declined",mediate:"Ask for a truce",tallyTerms:"Terms",mindPick:"Battle of minds",mindVow:"A vow spoken",mindConcede:"A concession"}[type]);
      entry.conversation={actor:action.actor,target:typeof action.target==="string"?action.target:other || entry.target || entry.targets?.[0] || null,action:action.action || type,title};
    }
    // Why a unit cannot move at all, whatever the destination (shared by `move` and Scramble so the two cannot drift).
    // ── movement costs (moved verbatim from engine.js core, tsukumogami cap K3 2026-10-29)
    // A big body that must fit its whole footprint where it moves or lands: a woken Tsukumogami, or a sized summon (MX2: the
    // two-tile Max Genghis Khan). Big bosses keep their own rules (they are neither).
    const sized = (u) => !!u && !!(u.awakened || u.summon) && ((u.size?.w || 1) > 1 || (u.size?.h || 1) > 1);
    // Where a MAX form's bigger body goes (MX2: the Khan's winged rhino, 2x1): east of him, else west; null = no room, and
    // the channel is refused before anything is spent. Open = inside, walkable, no water, no closed barrier, no unit, the
    // same dream side and astral region. Never a squeeze or an overlap. The action and the menu ask this one question.
    function maxRoomFor(s, t) {
      const open = (x, y) => inside(s, x, y) && dreamSame(s, t.x, t.y, x, y) && (!H.astralSameRegion || H.astralSameRegion(s, t.x, t.y, x, y)) && !tileAt(s, x, y).blocksMove && !waterAt(s, x, y) && !(barrierAt(s, x, y) && !barrierAt(s, x, y).passable) && !unitAt(s, x, y);
      return summonRules?.maxRoom ? summonRules.maxRoom(t, open) : [t.x, t.y];
    }
    // Tsukumogami: every non-anchor tile of a big awakened body's footprint must be open at the new anchor.
    function footOpen(s, mover, nx, ny, kind, goal) {
      const w = mover.size?.w || 1, h = mover.size?.h || 1;
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        if (!dx && !dy) continue;   // the anchor passed the standard checks
        const tx = nx + dx, ty = ny + dy;
        if (!inside(s, tx, ty) || !dreamSame(s, nx, ny, tx, ty)) return false;
        if (kind === "move" ? tileAt(s, tx, ty).blocksMove : tileAt(s, tx, ty).blocksRoute) return false;
        const ob = barrierAt(s, tx, ty);
        if (kind !== "route-open" && ob && !ob.passable) return false;
        const oc = unitAt(s, tx, ty);
        if (oc && oc.id !== mover.id && !(goal && goal[0] === tx && goal[1] === ty)) return false;
      }
      return true;
    }
    const waterAt = (s, x, y) => !!tileAt(s, x, y).tags?.includes("water");
    const isKraken = (m) => !!m && (m.kind === "kraken" || m.beast?.kind === "kraken");   // tamed krakens keep kind under beast (tamer.js)
    // Pathing entry: the mover reaches stepCost only when awakened, kraken or a Trailcraft holder — everyone else's pathing is untouched (engine.js paths calls this).
    const hasTrailcraft = (m) => !!ClassRuntime?.builds?.[m?.character]?.passives?.trailcraft;   // Trailcraft prices her reach too, not only her AP (Fathom AD batch 5)
    const moveCost = (s, x, y, nx, ny, mover, flyer) => stepCost(s, x, y, nx, ny, flyer || (mover?.awakened || isKraken(mover) || hasTrailcraft(mover) ? mover : null));
    function stepCost(s, x, y, nx, ny, mover = null) {
      if (mover && ClassRuntime && ClassRuntime.flies(mover)) return 1;   // ClassRuntime: Flight ignores terrain movement costs
      const dh = heightAt(s, nx, ny) - heightAt(s, x, y), terrain = tileAt(s, nx, ny);
      if (dh >= 2 && !terrain.ramp && !tileAt(s, x, y).ramp) return Infinity;
      if (dh <= -2) return Infinity; // drops of 2+ are explicit Jump actions
      if (isKraken(mover)) return waterAt(s, nx, ny) ? 0.5 : Infinity;   // Kraken (Mala, 2026-11-05): never leaves the water; a water step costs half a move point, so it swims twice as far per action and per AP as anything walking
      if (mover?.awakened) return 1;   // Tsukumogami: terrain-blind — every step costs one, cliffs still cliff
      if (usableRamp(s, x, y, nx, ny)) return Math.max(1, Math.abs(dh));
      if (waterAt(s, nx, ny) && terrain.blocksMove) return H.hasTrait(mover, "treeWalker") ? 1 : 2; // swimmers may wade through a deep-water tile, at a large AP surcharge; Tree Walkers pay normal (anime batch)
      const trail = (terrain.moveCost || 1) > 1 && ClassRuntime?.builds?.[mover?.character]?.passives?.trailcraft;   // Trailcraft (Big Game Hunter): rough ground costs her 1 less a step, min 1
      return (trail ? Math.max(trail.effect.min, (terrain.moveCost || 1) - trail.effect.terrainCostLess) : (terrain.moveCost || 1)) + (dh === 1 && !H.hasTrait(mover, "treeWalker") ? 1 : 0) + (MaidSystems ? MaidSystems.levelAt(s, nx, ny) : 0);   // Tree Walkers waive the uphill step (anime batch)
    }
    function movementTempoCost(s, a, route) {
      if (a.awakened) return 0;   // Tsukumogami: movement costs no tempo — the turn's price is the one action
      if (!route || route.length < 2) return 0;
      const points = route.slice(1).reduce((sum, [nx, ny], i) => sum + stepCost(s, route[i][0], route[i][1], nx, ny, a), 0);
      const waterSteps = (ClassRuntime && ClassRuntime.flies(a)) || H.hasTrait(a, "treeWalker") || isKraken(a) ? 0 : route.slice(1).reduce((sum, [nx, ny], i) => sum + (waterAt(s, route[i][0], route[i][1]) || waterAt(s, nx, ny) ? 1 : 0), 0);   // ClassRuntime: flyers skip the water surcharge; Tree Walkers too (anime batch); the kraken is native (no surcharge on its own ground)
      // Planting is slow going: a step onto a living, walkable plant costs ×1.5 AP unless the mover is a hiker (or flies).
      const PM = vegetation?.data?.rules?.plantMove, flying = !!(ClassRuntime && ClassRuntime.flies(a));
      const hiker = !PM || flying || (a.traits || []).some(t => (typeof t === "string" ? t : t?.id) === PM.exemptTrait);
      const plantPoints = hiker ? 0 : route.slice(1).reduce((sum, [nx, ny], i) => sum + (plantUnderfoot(s, nx, ny) ? stepCost(s, route[i][0], route[i][1], nx, ny, a) : 0), 0);
      const effective = points + plantPoints * ((PM?.apMul || 1) - 1);
      // Woodcraft (rules.ranger): a Ranger's step onto soil or a plant costs 1 action point less, never under 1 a step.
      const wood = s.rules.ranger && ClassRuntime?.isRanger(a) ? route.slice(1).filter(([x, y]) => plantUnderfoot(s, x, y) || (tileAt(s, x, y).tags || []).includes("soil")).length * s.rules.ranger.woodcraftAp : 0;
      return H.adjustMoveCost(s, a, route, Math.max(wood ? route.length - 1 : 1, Math.round(effective * s.rules.actionCosts.movePerPoint * (a.passives?.moveCostMul || 1) * (ClassRuntime ? ClassRuntime.moveMods(a).costMul : 1)) - wood) + waterSteps * (s.rules.waterMoveApSurcharge ?? 20) + (ClassRuntime?.turnCost ? ClassRuntime.turnCost(s, a, route) : 0));   // movement money (machine P1): discounts/surcharges; ClassRuntime: Flight halves movement AP; Aerodynamic pays to turn
    }
    function usableRamp(s, x, y, nx, ny) { return tileAt(s, x, y).ramp || tileAt(s, nx, ny).ramp; }
    function moveRefusal(s, a) {
      if (a.awakened && a.moved) return `${a.name} has already moved this turn.`;
      if (a.soulless) return "The body lies soulless while its soul is out.";
      if (a.summon?.holdPosition) return `${a.name} is holding position for its committed ultimate.`;
      if (a.status.rooted?.expiresAt > a.ownerTurns) return a.status.rooted.scribed?`${a.name} is rooted by ${a.status.rooted.label} and cannot move yet.`:`${a.name} is bound by the King's Law and cannot move yet.`;
      if (grappled(s, a)) return `${a.name} is held and cannot move.`;
      { const lock = a.status.lockMove; if (lock?.expiresAt > a.ownerTurns) return `${lock.label || "Long View"} locks your position until your next turn.`; }
      if (ClassRuntime) { const ce = ClassRuntime.beforeMove(s, a, classH()); if (ce) return ce; }   // ClassRuntime: Binding Term
      if (Vows) { const no = Vows.refuses(s, a, "move"); if (no) return no; }   // Vows: Rooted
      return null;
    }
    function apply(state, action, opt = {}) {
      if (!action || !action.type) return { ok: false, error: "No action.", state };
      if (H.Tourist?.is(state.actors?.[action.actor]) && !H.Tourist.allowed.has(action.type)) return {ok:false,error:"Bystanders cannot fight or use combat powers.",state};
      if (state.outcome && !(action.type === "resolveTrauma" && action.actor === "player")) return { ok: false, error: "The battle is over.", state };
      let prediction = null;
      if (!opt.preview && UtilityAI && action.actor!=="player" && ["ability","strike","move","recover","guard","useItem"].includes(action.type)) {
        const pv=apply(state,action,{preview:true}); if(pv.ok) prediction=pv.state;
      }
      // A look-ahead does not need its own copy of the battle's history. The log is append-only and its entries are never
      // edited, so a preview shares the entries and copies only the list; a real action still gets a full copy. On a long
      // battle the log was most of what the AI spent its time cloning.
      let s;
      if (opt.preview) { const { log: history, revealFeed, ...rest } = state; s = clone(rest); s.log = history.slice(); if (revealFeed) s.revealFeed = revealFeed; s.preview = true; }   // revealFeed is only written by real actions
      else s = clone(state);
      const start = s.log.length;
      const err = (error) => ({ ok: false, error, state });
      H.settleHolds(s, null, true);   // holds set by hand or loaded from a save get their tiles recorded before the action moves anyone
      if (s.outcome && action.type === "resolveTrauma") {
        const r = handlers.resolveTrauma(s, s.actors.player, action); if (r) return err(r);
      } else if (s.phase === "response") {
        if (action.type !== "respond" && action.type !== "revealIntent") return err("Waiting for a defensive response.");
        if (action.type === "revealIntent") {   // MY-04: the pending responder may voluntarily reveal mid-window; the pending attack waits (pendingStack) while the revealed attack runs its own window
          const p = s.pending, id = p.defenders[p.responded.length];
          if (action.actor !== id) return err(`Waiting for ${s.actors[id].name}'s response.`);
          const r = handlers.revealIntent(s, s.actors[action.actor], action); if (r) return err(r);
        } else { const r = respond(s, action); if (r) return err(r); }
      } else if (s.phase === "mind") {   // Mind duel: the battle is paused; only argue, swear, or concede
        if (!["mindPick", "mindVow", "mindConcede"].includes(action.type)) return err("A battle of minds holds the field: argue, swear a vow, or concede.");
        if (!MindDuel) return err("Mind duels are unavailable.");
        const a = s.actors[action.actor]; if (!a) return err("No one to argue with.");
        const r = action.type === "mindPick" ? MindDuel.recordPick(s, action.actor, action.move, { log, Parley })
          : action.type === "mindVow" ? MindDuel.swearVow(s, action.actor, action.vow, { log, Parley })
          : MindDuel.applyConcede(s, action.actor, action.choice, { log, Parley });
        if (r) return err(r);
        if (s.phase !== "mind") checkOutcome(s);   // while the concession menu holds the duel open, no outcome yet
      } else {
        if (action.actor !== currentId(s) && action.type !== "callCut") return err(`It is ${s.actors[currentId(s)].name}'s turn.`);
        const a = s.actors[action.actor] || (action.type === "callCut" ? s.film?.saved.actors[action.actor] : null);   // a filming Director acts from the stash
        if (!a) return err(`It is ${s.actors[currentId(s)].name}'s turn.`);
        if(a.status?.verse?.freeAp&&action.type!=="discardVerse"&&action.type!=="callCut"&&!(action.type==="ability"&&action.ability===a.status.verse.id))return err("Deliver the Freestyle line now, or discard it; its action is already paid.");
        const contractError=H.Contracts?.before(s,a,action);if(contractError)return err(contractError);
        { const stateError = H.States?.refuses(s, a, action); if (stateError) return err(stateError); }   // States: a gate holds this act (engine/states.js)
        if (H.Instinct.lying(a) && !["standUp", "stall", "end"].includes(action.type)) return err("Stand up first (10 AP).");   // Survival Instincts: a lying unit only stands, ends its turn, or waits (engine/instinct.js)
        const point = typeof action.target === "string" ? s.actors[action.target] : Array.isArray(action.target) ? {x:action.target[0],y:action.target[1]} : action.to ? {x:action.to[0],y:action.to[1]} : null;
        if (!["ability","fullCourtPress"].includes(action.type) && point && !dreamSame(s,a.x,a.y,point.x,point.y)) return err("The sealed Dream Space blocks that interaction.");
        // Distributed Intelligence: an attack he can only make from one of his towers is made from that tower; he does not move.
        const relay = ["strike", "ability"].includes(action.type) ? ClassRuntime?.relayFor?.(s, a, action, H.relayH()) : null;
        let r;
        if (relay) { const home = [a.x, a.y]; a.x = relay[0]; a.y = relay[1];
          log(s, { kind: "effect", actor: a.id, tiles: [relay], relay: true, text: `${a.name} acts through the drone tower at (${relay[0]},${relay[1]}).`, why: ["Distributed Intelligence: his range and sight run from every tower. Nothing reaches him back through one."] });
          try { r = (handlers[action.type] || (() => "Unknown action."))(s, a, action); } finally { a.x = home[0]; a.y = home[1]; } }
        else r = (handlers[action.type] || (() => "Unknown action."))(s, a, action);
        if (r && s.keepRefusal && !opt.preview) { delete s.keepRefusal; return { ok: false, error: r, state: s, kept: true }; }   // contempt of court: refused, but the favor shift and log stand
        if (r) return err(r);
        if (!s.preview && a.status?.kneeling && ["move", "strike", "ability"].includes(action.type)) { delete a.status.kneeling; log(s, { kind: "dispatch", actor: a.id, text: `${a.name} rises: the kneeling is over.` }); }
        H.States?.afterAction(s, a, action);   // States: an ability's grants, and the abilities that break a state
        // Concept-aligned actions (Mala, 2026-10-15: "anything that aligns with your concepts should progress you towards
        // your ULT"; techniques were the proxy). rules.conceptActions names the concept an action embodies; a unit that
        // holds that concept charges exactly as for a technique of it (chargeUltimate ignores concepts it does not hold).
        { const ca = s.rules.conceptActions?.[action.type]; if (ca && a && !a.defeated && !(s.rules.embodiedConcepts?.enabled && action.type === "tameBeast")) H.chargeUltimate(s, a, ca.concept, ca.why); }
        if (ClassRuntime?.sampleCircuits && s.cls?.circuits) ClassRuntime.sampleCircuits(s, classH());   // Cybernetic Ecology: every action is a reading
        if (action.shows && !s.preview) recordShown(s, a, action);   // C10
        // Any successful action can expose or move water (bridge collapse, flooding,
        // projection, pasted terrain). Check occupied tiles after the complete mutation.
        for (const unit of Object.values(s.actors)) refreshDrowning(s, unit, "water opens beneath them");
        H.formsAfterAction?.(s);   // learned forms: Hollow takes back any healing
        H.corpseSweep?.(s);   // ritual burial: the fallen leave a body (engine/conditions.js)
        checkOutcome(s);
        if (s.phase === "action" && !s.outcome && !s.preview && a.tempo <= 0 && !["end", "stall", "playCard", "showHand"].includes(action.type) && currentId(s) === a.id) endTurn(s);   // a card or a shown hand never ends the turn
      }
      H.finishRitualsOnWin?.(s);   // a win completes a capture still being chanted (conditions.js)
      H.Tourist?.settle(s,H.touristH());
      if (H.Tourist?.topologyChanged(state,s) && !H.Tourist.exitsUsable(s,H.touristH()) && H.Tourist.exitsUsable(state,H.touristH())) return err("Keep the Tourist’s assigned exit and a route to it open.");
      for(const unit of Object.values(s.actors))if(unit.permanentAlly)unit.side="player";
      keepDreamPositions(s,state,action.type==="fullCourtPress" ? [action.unit] : []);
      H.settleHolds(s, H.OWN_MOVE_ACTIONS.includes(action.type) ? action.actor : null);   // forced movement of a holder or a held breaks the hold, however it happened (Mala, 2026-10-30)
      EmergentIdeas?.syncSummonWards(s);
      revealDreamSummons(s);
      checkDreamCollapse(s);
      if (!s.outcome && s.phase === "action" && s.actors[currentId(s)].defeated) advance(s);   // e.g. felled by a deflection on their own turn
      if (!opt.preview && action.actor && action.actor !== "player") {
        const value = H.concentrationValue(state, state.actors[action.actor], action);
        if (Math.abs(value) >= 0.25) log(s, {kind:"concentrationIntent",actor:action.actor,
          text: `${state.actors[action.actor].name} weighs the risk to concentration.`,
          why:[`Expected concentration value ${value.toFixed(2)}; an estimate of interruption and protection, not a promised result.`]});
      }
      H.Contracts?.after(state,s,action,start);
      H.Support.after(state, s, action, start);
      if (!opt.preview && prediction) aiLearnResult(state,s,action,prediction);
      H.FocusPlans?.after(s,action);
      markConversation(state,s,action,start);
      if (!opt.preview) delete s.preview;
      if (!opt.preview) Spirit()?.acted(s, action, H);
      return { ok: true, state: s, events: s.log.slice(start) };
    }

    function stallPreview(s,id) {
      const a=s.actors[id], available=Math.max(0,Math.min(s.rules.maxBankedActionPoints,a?.tempo || 0));
      const nap=s.rules.catNap || {apPerLF:5,maxHeal:8};
      const healed=a && !a.defeated && a.lf>0 && a.traits?.includes("catNap") ? Math.min(nap.maxHeal,Math.max(0,a.maxLF-a.lf),Math.floor(available/nap.apPerLF)) : 0;
      const spent=healed*nap.apPerLF;
      return {banked:available-spent,spent,healed,overflow:Math.max(0,(a?.tempo || 0)-available)};
    }

    // Strong Grip (Mala, 2026-10-11; Muse's spec docs/strong-grip-spec.md; numbers in content.js rules.grapple.strongGrip):
    // a biology trait. The holder's Grapple always lands ("ignores defenses" means the roll only: huge bodies, bosses,
    // Parley and soothing still stop it), every enemy in their Grapple is squeezed at their turn start, and climbing or
    // jumping down costs them less.
    const strongGrip = (s, a) => { const g = s.rules.grapple.strongGrip; return g && a && hasTrait(a, g.trait) ? g : null; };
    const climbCost = (s, a) => Math.max(1, Math.round(s.rules.actionCosts.climb * (a.passives?.climbCostMul || 1) * (strongGrip(s, a)?.climbMul || 1) * (ClassRuntime?.aeroForce?.(a) === "lift" ? 0.02 : 1)));   // Four Forces Lift: climbs cost almost nothing
    const jumpCost = (s, a) => Math.max(1, Math.round(s.rules.actionCosts.jump * (strongGrip(s, a)?.climbMul || 1)));
    function squeeze(s, holder) {   // called as the holder's turn starts (turns.js)
      H.settleHolds(s);   // a hold whose holder or held was forced to another tile this round is already broken: no stale squeeze
      const g = strongGrip(s, holder); if (!g || holder.defeated) return;
      const crush = g.squeezeLf * (hasTrait(holder, "denseMuscle") ? 2 : 1) + (hasTrait(holder, "crushingHands") ? 2 : 0);   // Dense Muscle: the crush lands doubled; Crushing Hands: +2 (anime batch)
      for (const t of Object.values(s.actors)) {
        if (t.defeated || t.side === holder.side || !grappled(s, t) || t.status.grappled.owner !== holder.id) continue;
        log(s, { kind: "squeeze", actor: holder.id, target: t.id, tiles: [[t.x, t.y]], text: `${holder.name}'s grip crushes ${t.name}: ${crush} LF.`, why: ["Strong Grip: an enemy in the hold is hurt as the holder's turn starts."] });
        hit(s, holder, t, null, crush, ["Strong Grip squeeze."], { label: "Strong Grip", damageType: "nigredo" });
      }
    }
    // Observe and Investigate share this tail: what a look does once it has paid and produced a result (knowledge, credit,
    // Scout and Exposure, the log, Telepathy, Survival Instincts, the trial debrief). One place, so the two cannot drift apart.
    const observedFx = (s, a, t) => {
      if (!s.preview) H.States?.observed(s, a, t);   // States: Observe shows a hidden state to the observer's side
      if (ClassRuntime?.observed && !s.preview) ClassRuntime.observed(s, a, t, classH());   // Hypebeast: one look punctures the hype
    };
    const observeTail = (s, a, t, result, { bySubject, invest, free, aiText }) => {
      ClassRuntime?.law?.foundEvidence?.(s, H, a, t, result.revealed);   // I4d: the upgrade lands before recordCards, so findings keep the found text (the callout now leads the find turn's log)
      bySubject[t.id] = result.know; H.Observation.setCognitive(s,a,result.cognitive);
      H.Observation.credit(s,a,t,result.revealed,H.observationH());
      scoutNoted(s, a, t.id); H.Exposure.observed(s, a, t);
      a.observes=(a.observes||0)+1;   // spike cap: the AI stops studying a battle after three
      if(a.id==="player")for (const line of result.lines) log(s, { kind: "observe", actor: a.id, target: t.id, text: line });
      else log(s,{kind:"observe",actor:a.id,target:t.id,discoveries:result.revealed.length,text:aiText||`${a.name} studies ${t.name} and learns ${result.revealed.length} new detail${result.revealed.length===1?"":"s"}.`});
      if (a.id === "player") {   // Observe teaches O2a: an imitable trait names its use; a dream monster teaches its lesson and the interim step
        // The refusals the Imitate action makes about the observer (imitate(): "already has that trait", "already practised that this battle"; the revealed cards come from the target's own traits): the Next line promises Imitate only for a trait the player could actually take now.
        const canImitate = (id) => insightRules?.imitable?.(id) && !(hasTrait(a, id) && !a.tempTraits?.[id] && !(s.imitation?.carried || []).includes(id)) && !(s.imitated || []).some((e) => e.actor === a.id && e.trait === id);
        if ((result.revealed || []).some((c) => c.kind === "trait" && canImitate(c.trait))) log(s, { kind: "observe", actor: a.id, target: t.id, text: H.Observation.nextStep({ kind: "unit", imitable: true }).text });
        const teaches = t?.dream?.key && DreamData()?.monsters?.[t.dream.key]?.teaches;
        if (teaches) { log(s, { kind: "observe", actor: a.id, target: t.id, text: `It teaches: ${teaches}` }); if (!t.dream.named && t.side !== a.side) log(s, { kind: "observe", actor: a.id, target: t.id, text: H.Observation.nextStep({ kind: "dream", cost: DreamData().rules.nameIt.actionCost }).text }); }   // the Name path is promised only where the row offers it: not for a dream already named, nor one on your side
      }
      if (a.id === "player" && !s.preview) for (const note of H.Injury?.observeNotes(s, a, t) || []) log(s, { kind: "observe", actor: a.id, target: t.id, text: `You notice: ${note}` });
      if (a.id === "player" && Affinity && !s.preview) { const al = Affinity.line(C, t); if (al) log(s, { kind: "observe", actor: a.id, target: t.id, text: al }); }   // W4.5: the soul's vow-drive is visible
      if (a.id === "player" && !s.preview) for (const line of Orders()?.observeNotes(s, a, t) || []) log(s, { kind: "observe", actor: a.id, target: t.id, text: line });   // orders: respect + the foe's focus read free
      if (a.id === "player" && t.loci && !s.preview) log(s, { kind: "observe", actor: a.id, target: t.id, text: `${t.name} has walked the Lo-ci: ${t.loci.name}${t.loci.meaning ? `. ${t.loci.meaning}` : ""}`, why: ["A lo-ci from the same verbs and table you use (W8.6). It is intel: it changes nothing in this fight."] });   // W8.6
      if (a.id === "player" && t.boss === "sealednext" && s.sealedFight && !s.preview) {
        const SN = sealedNext();
        if (SN) log(s, { kind: "observe", actor: a.id, target: t.id, text: SN.observe(s.sealedFight) });
      }
      if (hasTrait(a, "telepathy")) {   // Telepathy: one read lays every trait bare.
        const know = bySubject[t.id], extra = [];
        for (const o of (s.insight.decks[t.id]?.cards || []).filter((o) => o.kind === "trait" && !know.revealed.includes(o.id))) { know.revealed.push(o.id); extra.push(o.name || o.id); }
        if (extra.length) log(s, { kind: "observe", actor: a.id, target: t.id, text: a.id==="player" ? `${a.name}'s telepathy lays ${t.name} bare: ${extra.join(", ")}.` : `${a.name}'s telepathy reads ${t.name}.` });
      }
      if (!free) H.Instinct.discover(s, a, t, invest);   // Survival Instincts: a paid look tests a lie on its invest; a free look (survey flag, Wizard's codex) never does
      ClassRuntime?.law?.debrief?.(s, a, t);   // truth engine: the study debriefs a trial exhibit
    };
    // Scout (insight-data.js traits.scout, actions.report; Muse's design docs/scout-trait.md). Each successful Observe
    // outward (a unit, the place, a plant) counts; after `requiresObserves` the scout may Report once to allies within
    // `radius`, who then observe every subject the scout looked at `difficultyShare` easier for the rest of the battle.
    // What the scout was shown is shared as it stands, true or not: feeding a scout lies is the counter.
    // Stand-down (Mala's no-crew rule, Muse's fix): if nobody is left to tell when the last needed observation lands, the
    // scout gives up the report for the battle, even if allies arrive later. Set here, where state is written.
    const scoutNoted = (s, a, subject) => {
      if (!hasTrait(a, "scout")) return;
      a.scoutObserves = (a.scoutObserves || 0) + 1; if (subject && !(a.scoutSubjects ||= []).includes(subject)) a.scoutSubjects.push(subject);
      const need = insightRules?.data?.actions?.report?.effect?.requiresObserves ?? 3;
      const crew = Object.values(s.actors).some((u) => u.side === a.side && u.id !== a.id && !u.defeated && !u.notArrived && u.category !== "bystander");
      if (a.scoutObserves === need && !crew && !a.scoutReported) { a.scoutStoodDown = true; log(s, { kind: "report", actor: a.id, stoodDown: true, text: `${a.name} has nobody left to report to and stands down from scouting.` }); }
    };
    function reportCheck(s, a) {
      const def = insightRules?.data?.actions?.report, R = def?.effect; if (!R) return { error: "Report is unavailable." };
      if (!hasTrait(a, "scout")) return { error: "Only a Scout reports." };
      if (a.scoutReported) return { error: `${a.name} has already reported this battle.` };
      if (a.scoutStoodDown) return { error: `${a.name} stood down from scouting: there was nobody to report to.` };
      if ((a.scoutObserves || 0) < R.requiresObserves) return { error: `Report needs ${R.requiresObserves} observations first (${a.scoutObserves || 0} so far).` };
      const crew = Object.values(s.actors).filter((u) => u.side === a.side && u.id !== a.id && !u.defeated && !u.notArrived && u.category !== "bystander" && dist(s, a.x, a.y, u.x, u.y) <= R.radius);
      if (!crew.length) return { error: `Report needs an ally within ${R.radius} tiles.` };
      if (a.tempo < def.cost) return { error: `Report needs ${def.cost} action points.` };
      return { def, R, crew };
    }
    function report(s, a) {
      const c = reportCheck(s, a); if (c.error) return c.error;
      const spend = spendTempo(s, a, c.def.cost, "Report"); if (spend) return spend;
      const subjects = a.scoutSubjects || [];
      for (const ally of c.crew) for (const key of subjects) { const book = ((s.scoutShare ||= {})[ally.id] ||= {}); book[key] = Math.max(book[key] || 0, c.R.difficultyShare); }
      const transmitted=H.Observation.share(s,a,c.crew,H);
      a.scoutReported = true;
      const names = c.crew.map((u) => u.name).join(" and "), about = subjects.map((k) => s.actors[k]?.name || "the place").filter((v, i, l) => l.indexOf(v) === i).join(", ") || "what was seen";
      log(s, { kind: "report", actor: a.id, targets: c.crew.map((u) => u.id), subjects: subjects.slice(), transmitted, text: `${a.name} reports to the crew: ${names} will read ${about} more easily now.`,
        why: [`${transmitted} new findings delivered to allies. Shared findings add no personal study practice.`, `Scout: ${a.scoutObserves} observations shared with allies within ${c.R.radius} tiles, −${c.R.difficultyShare} Observe difficulty on each subject. Once per battle.`] });
    }
    // Speed-Talker (insight-data.js traits.speedTalker.speech): half the action points for talk-based actions, and a
    // seeded chance the words go by too fast to land.
    const speedTalk = (a, action) => { const R = insightRules?.data?.traits?.speedTalker?.speech; return R && hasTrait(a, "speedTalker") && R.actions.includes(action) ? R : null; };
    // For an attack-talker (a Rapper) with the trait, every technique and the Strike are talk as well.
    const talksToAttack = (a) => { const R = insightRules?.data?.traits?.speedTalker?.speech; return R && hasTrait(a, "speedTalker") && (R.attackTalkers || []).includes(a.character) ? R : null; };
    const barsTooFast = (s, a, what) => { const R = talksToAttack(a); if (!R) return false; s.speedTalkN = (s.speedTalkN || 0) + 1; return seededChance(`${s.seed}:${s.round}:${a.id}:bars:${what}:${s.speedTalkN}`) >= R.effectMul; };
    const talkCost = (a, action, base) => { const R = speedTalk(a, action); return R ? Math.max(1, Math.round(base * R.apMul)) : base; };
    const talkedTooFast = (s, a, t, action) => { const R = speedTalk(a, action); return !!R && seededChance(`${s.seed}:${s.round}:${a.id}:${t?.id}:speedtalk:${action}`) >= R.effectMul; };
    // Opportunity attack (Mala 2026-10-22): a willing step, jump, or climb from inside an opponent's strike range to
    // outside spends that opponent's reaction on a normal strike. Forced movement, teleport, and a concealed exit do not.
    // Hermit charge (Mala 2026-10-22, turtle hermit way): Bird Mountain holders charge their ULT bar by
    // living right — Train Hard (Strike), Blocking (Guard), Eat Good (consumables), Sleep Plenty (Meditate
    // bonus), and opportunity swings. Flat provisional ticks, independent of concept-use pairing.
    function hermitCharge(s, a, pillar) {
      if (!a || a.defeated || (a.primary !== "bird_mountain" && a.secondary !== "bird_mountain" && a.styleConcept !== "bird_mountain")) return;
      const HB = s.rules.birdMountain?.hermit ?? {}, want = HB[pillar] ?? { strike: 3, guard: 3, eat: 6, meditate: 8, opportunity: 3 }[pillar] ?? 0;
      const max = s.rules.ultimateChargeMax, before = a.ultimateCharge || 0;
      if (want <= 0 || before >= max) return;
      const gain = Math.min(want, max - before);
      a.ultimateCharge = before + gain;
      log(s, { kind: "charge", actor: a.id, text: `${a.name} lives the hermit way (${pillar}): +${gain} ultimate charge (${a.ultimateCharge}/${max}).` });
    }
    function provokeOpportunity(s, mover, from, to) {
      if (!mover || mover.defeated || mover.disengageTurn === mover.ownerTurns || H.Tourist?.is(mover)) return;
      const conc = mover.status?.concealed;
      if (conc && (conc.until == null || conc.until >= mover.ownerTurns)) return;
      const reactors = Object.values(s.actors).filter((w) => {
        if (!w || w.defeated || w.id === mover.id || w.side === mover.side || (w.reaction ?? 0) < 1 || H.Tourist?.is(w) || H.Instinct.lying(w)) return false;   // a lying unit threatens no swing
        const reach = strikeRange(s, w);
        return dist(s, from[0], from[1], w.x, w.y) <= reach && dist(s, to[0], to[1], w.x, w.y) > reach;
      }).sort((p, q) => dist(s, from[0], from[1], p.x, p.y) - dist(s, from[0], from[1], q.x, q.y) || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
      const potency = s.rules.opportunity?.potency ?? 6;
      for (const w of reactors) {
        if (mover.defeated || (w.reaction ?? 0) < 1 || w.defeated) break;
        // Previews show the swing's damage (the AI prices a leaving step and skips a lethal one) but not the
        // reaction spend: a spent reaction in preview reads as bait set up, and moves are not bait (bait credit is
        // announce-only). Once per reactor per preview, matching the real single swing (integrator glue, 2026-10-22).
        if (s.preview) {
          s.previewOppSpent ||= [];
          const spentKey = w.id + ">" + mover.id;
          if (s.previewOppSpent.includes(spentKey)) continue;
          s.previewOppSpent.push(spentKey);
        } else w.reaction -= 1;
        log(s, { kind: "trigger", actor: w.id, target: mover.id, ability: "opportunity", text: `${w.name} takes an opportunity attack on ${mover.name}.` });
        strikeTarget(s, w, mover, { name: "Opportunity attack", ability: "opportunity", concept: null, delivery: "contact", damageType: "nigredo", range: strikeRange(s, w) }, potency, ["Opportunity attack: they left the reach. The swing costs the reaction, not action points."]);
        hermitCharge(s, w, "opportunity");
      }
    }
    function imitateComplete(s, a, t, trait, p, whyBase) {   // grant extracted for MYOL replays (same road either way in)
      const demonstrated = (s.insight?.decks?.[t.id]?.cards || []).some((c) => c.kind === "trait" && c.open && c.trait === trait) || demonstratedTraits(s, t.id).includes(trait);
      const practice = hasTrait(a, trait), name = insightRules.data.traits[trait]?.name || trait, difficulty = insightRules.data.imitateDifficulty(trait) || 1;
      if (!practice) a.traits = [...(a.traits || []), trait];
      (a.tempTraits ||= {})[trait] = Imitation.rules.tempBattles;
      (s.imitated ||= []).push({ actor: a.id, from: t.id, trait, demonstrated, practice });
      log(s, { kind: "imitate", actor: a.id, target: t.id, trait, ok: true, text: practice ? `${a.name} practises ${name}, watching ${t.name}.` : `${a.name} takes on ${t.name}'s ${name}. It will fade unless it is practised.`,
        why: [...(whyBase || [`${Math.round(p * 100)}% chance.`]), `A copy lasts ${Imitation.rules.tempBattles} battles. Practise it ${Imitation.needed(difficulty)} points' worth (watching them act on it counts double) and it stays.`] });
    }
    // Investigate a place, a plant or a structure (spec INVESTIGATE.md slice I3): the same price and the same ending as Investigating a character (all the AP, at
    // least the minimum, a wounded head's tax, not while held; the turn ends and the reaction is spent), the look itself is the matching Observe with `deep` set.
    const deepLook = (s, a, act) => {
      if (!H.Observation.eligible(a)) return "This unit cannot Investigate.";   // a summon may Investigate a character, but the place, plants and structures answer only what Observe lets look at them
      if (!insightRules?.investigate) return "Investigate is unavailable.";
      const V = insightRules.data.rules.investigate;
      const woundTax = (H.Injury?.gradeOf(a, "head") || 0) === 1 ? (s.rules.injury?.headWoundedObserveAp ?? 10) : 0;
      if (a.tempo < V.minAP + woundTax) return `Investigate needs at least ${V.minAP + woundTax} AP${woundTax ? ` (${woundTax} more with a wounded head)` : ""}. It spends everything you have left.`;
      if (H.heldCostMul && H.heldCostMul(s, a) !== 1) return "You can't Investigate while held: every action costs more than the AP you have left.";
      const kind = act.place ? "place" : (s.arena.objects || []).find((o) => o.id === act.object)?.kind === "plant" ? "plant" : "structure";
      const deep = { ap: a.tempo - woundTax, spent: false };
      const refused = handlers[{ place: "observePlace", plant: "observePlant", structure: "observeStructure" }[kind]](s, a, act, deep);
      if (refused) return refused;
      if (!deep.spent) return;   // a free warning (a structure answers only an Animist): nothing was paid, so the turn goes on
      a.tempo = 0; a.reaction = 0; a.absorbedRound = s.round;
      log(s, { kind: "tempo", actor: a.id, text: `${a.name} is absorbed: no reaction until next round.` });
      if (!s.outcome && currentId(s) === a.id) endTurn(s);
    };
    const handlers = {
      openGate(s, a, act) {
        const SN = sealedNext();
        const f = s.sealedFight;
        const g = f && SN && f.gates[act.gate];
        if (!g || g.destroyed || g.open) return "That gate cannot be opened.";
        const [x, y] = g.tile.split(",").map(Number);
        if (Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) > 1) return "Open it from an adjacent tile.";
        const spend = spendTempo(s, a, SN.OPEN_AP, "Open");
        if (spend) return spend;
        const before = f.ap;
        const r = SN.openGate(f, g.id, true);
        if (!r.ok) return "The gate does not open.";
        f.ap = before;
        SN.placeGates(s);
        SN.syncMarks(s, H);
        log(s, { kind: "act", actor: a.id, tiles: [[x, y]], text: `${a.name} opens a gate.` });
      },
      // Houses (engine/houses.js): buy a neutral one; invest in it (the larger stake owns it and is paid).
      tameBeast: (s, a, act) => H.tameBeast(s, a, act), markVessel: (s, a, act) => H.markVessel(s, a, act), callPack: (s, a) => H.callPack(s, a),   // the Animal Tamer (engine/tamer.js)
      heartScroll: (s, a, act) => H.castScroll?.(s, a, act), studyScroll: (s, a) => H.studyScroll?.(s, a),   // Heart Court: one cast, or a note (engine/living-map.js)
      buyHouse: (s, a, act) => H.houseAction(s, a, act, "buy"), investHouse: (s, a, act) => H.houseAction(s, a, act, "invest"), sueForRestitution: (s, a, act) => H.sueForRestitution(s, a, act),
      // A paid order belongs to the summon's turn-start, never ordinary AI planning. This also
      // resumes an action turn whose scheduler lost the turn-start continuation.
      resolveSummonUltimate(s, a) {
        if (!summonRules || !a.summon?.order || a.summon.ultimateUsed || a.defeated) return "No pending summon ultimate.";
        H.continueTurnStart(s);
      },
      touristPhoto(s,a,act) { return H.Tourist.photo(s,a,act,H.touristH()); },
      touristExit(s,a,act) { return H.Tourist.exit(s,a,act,H.touristH()); },
      touristDepart(s,a) { return H.Tourist.depart(s,a); },
      pet(s,a,act) { return H.Kaiba.pet(s,a,act,{ log, dist, seededChance, spendTempo, Inspiration: H.Inspiration }); },
      callCut(s, a) { return Director ? Director.callCut(s, a, H) : "No camera." },   // the Director's early wrap: his own out-of-turn action, always a dud
      fullCourtPress(s,a,act) {
        const unit=s.actors[act.unit];if(!unit || unit.side!==a.side || !unit.fullCourtPress)return "Choose an ally with an unused Full Court Press relocation.";
        if(!fullCourtPressOptions(s,unit.id).some(o=>o.to[0]===act.to?.[0]&&o.to[1]===act.to?.[1]))return "Choose an open tile; movement vows and position locks still apply.";
        if(ClassRuntime){const no=ClassRuntime.beforeMove(s,unit,classH());if(no)return no;}
        unit.x=act.to[0];unit.y=act.to[1];delete unit.fullCourtPress;
        log(s,{kind:"fullCourtPress",actor:unit.id,text:`${unit.name} relocates with Full Court Press for 0 AP.`});
      },
      // Wake from the dream (Mala, 2026-10-13: there was no way to end a Dream Space early; imbuing the aura was being
      // used as one). Its owner ends it on their own turn, free. The bar keeps what the clock had not yet taken, and
      // the space closes exactly as when the clock runs out: dreams fade, summons and treeants are let go.
      wakeDream(s, a) {
        const field = s.dreamSpace;
        if (!dreamSpaceRules || !field) return "There is no dream to wake from.";
        if (field.owner !== a.id) return "Only the one who opened the dream can wake from it.";
        if (a.aura?.burning) return "The folded aura is already burning the dream out: it ends on its own next turn.";
        const closed = dreamSpaceRules.close(field, `${a.name} woke`);
        s.dreamSpace = null;
        for (const ev of closed.events) log(s, { ...ev, kind: "dreamSpace" });
        H.closeDreamSummons(s, field); H.closeDreamTreeants?.(s, field);
        if (a.aura?.imbued) a.aura = null;   // the aura folded into the dream goes with it (the clock's close drops it at the next turn start)
        log(s, { kind: "dreamSpace", actor: a.id, text: `${a.name} wakes on purpose: ${a.ultimateCharge ?? 0}% of the bar is left.`, why: ["Waking is free. The bar keeps what the dream had not used."] });
      },
      focusDream(s,a,act) {
        // Was practice-only ("playable test 1", 1.3.95): the option showed in test battles and nowhere else, which read
        // as coming and going. Mala, 2026-10-13: it is a dream's owner's to use in any battle.
        if (!s.dreamSpace || s.dreamSpace.owner !== a.id) return "Only the one who opened the dream can compress it.";
        if (!dreamSpaceRules) return "Dream Space is unavailable.";
        const result = dreamSpaceRules.focus(s.dreamSpace,a,act.radius,s.arena); if(result.error) return result.error;
        if (a.tempo<20) return "Compressing a dream needs 20 AP.";
        const old = dreamSpaceRules.modsFor(a,s.dreamSpace,s.arena.objects);
        const error=spendTempo(s,a,20,"Compress Dream Space"); if(error) return error;
        s.dreamSpace=result.field;
        if (a.aura?.imbued && !a.aura.burning && s.dreamSpace.region) { a.aura.region = { ...s.dreamSpace.region }; a.aura.power = s.dreamSpace.concentration || 1; }   // folded aura tracks the compression
        const next=dreamSpaceRules.modsFor(a,s.dreamSpace,s.arena.objects), add=(next.apPerTurnAdd||0)-(old.apPerTurnAdd||0);
        a.tempo+=add; a.tempoCapacity+=add;
        log(s,{kind:"dreamSpace",actor:a.id,text:`${a.name} compresses the dream to radius ${act.radius}: ×${next.potencyMul.toFixed(2)} potency, +${next.pfRegenAdd} ΦF regen, +${next.apPerTurnAdd} AP per turn; aura efficacy ×${s.dreamSpace.concentration}. Ambient intrusion chance ${Math.round(s.dreamSpace.appearChance*100)}% per round.`,why:["The centre stays fixed. Movement, ordinary attacks and summons cannot cross; an applicable boundary-penetrating technique can attack through."]});
      },
      placeTrap(s, a, act) {   // C9: hide a trap on your own tile or an adjacent open one
        if (!Traps) return "Traps are unavailable.";
        if (!Traps.canSet(a)) return "Only a trapper sets traps: the Ninja, the Thief, the Ranger, the Surveyor, the Soldier, or anyone Tinkerer.";
        if (Vows) { const no = Vows.refuses(s, a, "placeTrap"); if (no) return no; }
        const [tx, ty] = act.at || [a.x, a.y];
        if (!inside(s, tx, ty) || dist(s, a.x, a.y, tx, ty) > 1) return "Set a trap on your own tile or one beside you.";
        if (tileAt(s, tx, ty).blocksMove) return "A trap needs ground someone can walk onto.";
        const there = actorAt(s, tx, ty); if (there && there.id !== a.id) return "Someone is standing there.";
        if (Traps.live(s.traps, tx, ty).length) return "A trap is already hidden there.";
        const spendError = spendTempo(s, a, Traps.rules.placeAp, "Set a trap"); if (spendError) return spendError;
        const seen = Object.values(s.actors).some(u => !u.defeated && u.side !== a.side && hasSight(s, u.x, u.y, tx, ty));
        const trap = Traps.make({ x: tx, y: ty, owner: a.id, ownerSide: a.side, seen });
        (s.traps ||= []).push(trap); (s.trapLog ||= []).push({ placer: a.id, x: tx, y: ty, hidden: trap.hidden });
        // Only those who could see it being set are told where it is.
        log(s, { kind: "trap", actor: a.id, tiles: seen ? [[tx, ty]] : [], placed: true, hidden: trap.hidden, text: seen ? `${a.name} sets a trap at (${tx},${ty}) in plain sight.` : `${a.name} sets a trap, unseen.`,
          why: [seen ? "An enemy could see the tile: the trap is only 30% hidden." : "No enemy could see the tile: the trap is 90% hidden."] });
      },
      disarm(s, a, act) {   // C14: 50-100 AP (overclock debt allowed), at least 50 in hand, adjacent, and spotted
        if (!Traps) return "Traps are unavailable.";
        const D = Traps.rules.disarm, [tx, ty] = act.at || [];
        if ((a.tempo ?? 0) < D.minAp) return `Disarming needs at least ${D.minAp} action points.`;
        const tp = Traps.live(s.traps, tx, ty).find(t => t.ownerSide !== a.side);
        if (!tp || !Traps.known(a, tp)) return "You have not spotted a trap there.";
        if (Math.max(Math.abs(a.x - tx), Math.abs(a.y - ty)) > 1) return "Get beside the trap to disarm it.";
        s.disarmN = (s.disarmN || 0) + 1;
        const tinkerer = hasTrait(a, D.trait), attempt = Traps.disarmAttempt(s.seed, a.id, s.disarmN, tinkerer), tempoBefore = a.tempo;
        const spendError = spendTempo(s, a, attempt.cost, "Disarm", true); if (spendError) { s.disarmN -= 1; return spendError; }
        (s.disarmLog ||= []).push({ actor: a.id, x: tx, y: ty, cost: attempt.cost, tempoBefore, debt: Math.max(0, attempt.cost - tempoBefore), tinkerer, ok: attempt.ok });
        if (attempt.ok) tp.spent = tp.disarmed = true;
        log(s, { kind: "disarm", actor: a.id, tiles: [[tx, ty]], ok: attempt.ok, text: attempt.ok ? `${a.name} disarms the trap at (${tx},${ty}).` : `${a.name} fails to disarm the trap at (${tx},${ty}); it stays armed.`,
          why: [`${Math.round(attempt.chance * 100)}% chance${tinkerer ? " (Tinkerer +30%)" : ""}; it took ${attempt.cost} action points.`] });
      },
      fleeBattle(s, a) {   // C8: only a routed unit standing on the edge of the map
        if (!a.routed) return "Only a routed unit flees.";
        if (s.film) return "The set is enclosed: there is nowhere to run.";   // Mala, 2026-10-19: no exits but CUT, ruin, or the twelfth take
        if (!onEdge(s, a)) return "It has not reached the edge of the map.";
        if (a.soulOf) { const err = H.returnSoul(s, a, "flee"); if (err) return err; if (!s.outcome && currentId(s) === a.id) endTurn(s); return; }   // a soul that breaks does not leave the battle: it wakes in its body
        fleeBattle(s, a); for (const e of (Sealing?.onSealerDown?.(s, a) || [])) log(s, { kind: "seal", actor: e.foe, text: e.text }); if (!s.outcome && currentId(s) === a.id) endTurn(s);   // W2.3: a fled sealer's binds drop
      },
      // Mala, 2026-10-11: ending a turn banks what is left, exactly as Stall does. Throwing the points away was never
      // the better choice, so it is no longer a choice.
      // `discard: true` ends without banking; nothing in play sends it (tests and scripted scenes that need a clean budget).
      end(s, a, act) {
        if (H.Instinct.lying(a)) return H.Instinct.restTurn(s, a);   // a lying unit ends its turn without banking
        if (a.tempo > 0 && !act?.discard) return handlers.stall(s, a);
        a.tempo = 0;
        log(s, { kind: "tempo", actor: a.id, text: `${a.name} ends the turn.` });
        endTurn(s);
      },
      stall(s, a) {
        if (H.Instinct.lying(a)) return H.Instinct.restTurn(s, a);   // no Cat Nap and no bank while lying
        if (a.tempo <= 0) return "There are no action points left to bank.";
        const nap=stallPreview(s,a.id),banked=nap.banked;
        if(nap.healed){a.lf+=nap.healed;log(s,{kind:"catNap",actor:a.id,amount:nap.healed,text:`${a.name} takes a Cat Nap: spends ${nap.spent} AP to restore ${nap.healed} LF (${a.lf}/${a.maxLF}); ${banked} AP remain to bank.`,why:["5 bankable AP per LF; at most 8 LF per nap. Spent AP cannot also be banked."]});}
        { const M = s.rules.mastery, heal = M && (a.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === M.trait) ? Math.min(M.stallHeal, a.maxLF - a.lf) : 0;   // Mastery: rest is recovery
          if (heal > 0) { a.lf += heal; log(s, { kind: "effect", actor: a.id, amount: heal, text: `${a.name} stalls with a master's ease: +${heal} LF (${a.lf}/${a.maxLF}).`, why: [`Mastery: Stall also restores ${M.stallHeal} Life Force.`] }); } }
        a.bankedTempo = banked; a._heldAtEnd = banked; a.lastStallRound = s.round;   // W5.3: heat reads what the gambler held
        log(s, { kind: "stall", actor: a.id, text: `${a.name} stalls, banking ${banked} action points for a later turn${nap.overflow ? ` (the ${nap.overflow} point overflow is lost)` : ""}.`, why: [`Bank cap: ${s.rules.maxBankedActionPoints} points; unused tempo is carried only by choosing Stall.`] });
        a.tempo = 0; endTurn(s);
      },
      miseRenew(s, a, act) { return ClassRuntime?.mise ? ClassRuntime.mise.renew(s, a, act, classH(), (pts, name) => spendTempo(s, a, pts, name)) : "Mise en Place is not loaded."; },   // Mise en Place: the caster renews a fading station (mise/mise.js renew)
      declineOrder(s,a) {
        const order=a.pendingOrder;if(!order)return "There is no Executive Direction to decline.";
        a.pendingOrder=null;const issuer=s.actors[order.by];if(issuer&&!issuer.defeated)issuer.pf=Math.min(issuer.maxPF,issuer.pf+5);
        log(s,{kind:"order",actor:a.id,target:order.by,text:`${a.name} declines Executive Direction; the President's ΦF cost is refunded.`});
      },
      kneel(s, a) {
        if (a.status?.kneeling) return `${a.name} is already kneeling.`;
        const spend = spendTempo(s, a, (H.Dispatch?.RULES.kneelAp) ?? 10, "Kneel"); if (spend) return spend;
        H.Dispatch.kneel(s, H, a.id);
      },
      // Palingenesis (provisional): burn one living map plant to ashes, then call that same form back once from the pile.
      // Not a concept, not a menu entry, and not a fighter. Felling, stumps, and pioneer regrow stay on the ordinary strike path.
      palingenesis(s, a, act) {
        const R = s.rules.palingenesis; if (!R) return "Palingenesis is unavailable.";
        const [x, y] = act.at || [];
        if (!inside(s, x, y)) return "Choose a tile on the map.";
        if (!dreamSame(s, a.x, a.y, x, y)) return "The sealed Dream Space blocks that.";
        if (dist(s, a.x, a.y, x, y) > R.range) return `Palingenesis reaches ${R.range} tile${R.range === 1 ? "" : "s"}.`;
        const here = (s.arena.objects || []).filter((o) => o.x === x && o.y === y);
        if (act.burn) {
          const plant = here.find((o) => o.kind === "plant" && o.hp > 0);
          // Invasive creeper (Mala, 2026-10-25: "burn plant is saying no plant is next to me even though creepers are coming up"):
          // fire clears the vine from that tile and banks the burn step, but an invasive leaves no ashes worth calling back.
          if (!plant && H.fieldAt(s, x, y)) {
            const spend = spendTempo(s, a, R.burnAp, "Burn"); if (spend) return spend;
            H.clearField(s, a, [[x, y]]);
            log(s, { kind: "ritual", actor: a.id, tiles: [[x, y]], burn: true, text: `${a.name} burns the creeper back from (${x},${y}).`, why: ["Fire clears an invasive vine. It leaves no ashes to call back: there is no form worth returning."] });
            bankRiteSideStep(s, a, "burn");
            return;
          }
          if (!plant) return "Burn a living plant (or creeper).";
          if (plant.protected) return "That plant is protected.";
          if (Object.values(s.actors).some((u) => u.communed?.object?.id === plant.id)) return "A communed plant is not residue. It is still in the fight.";
          const spend = spendTempo(s, a, R.burnAp, "Burn"); if (spend) return spend;
          const residue = {
            type: plant.type, form: plant.form, trait: plant.trait || null, maxHp: plant.maxHp ?? plant.hp,
            blocksMove: !!plant.blocksMove, material: plant.material || "plant", name: plant.name || plant.common || plant.type,
            moveCost: plant.moveCost ?? (plant.blocksMove ? 0 : 2), sightHeight: plant.sightHeight ?? 0, cover: plant.cover ?? 0,
          };
          s.arena.objects = s.arena.objects.filter((o) => o.id !== plant.id);
          const ashHp = R.ashHp;
          s.arena.objects.push({
            id: "o" + (++s.seq), kind: "ashes", type: "ashes", name: "Ashes", x, y, hp: ashHp, maxHp: ashHp, material: "plant",
            blocksMove: false, moveCost: 1, sightHeight: 0, cover: 0, protected: false, trait: null, status: {}, residue,
          });
          H.landWound?.(s, a, "plantDestroyed", 1, [[x, y]]);
          log(s, { kind: "ritual", actor: a.id, tiles: [[x, y]], burn: true, text: `${a.name} burns the ${residue.name} down to ashes. The form can be called back once.`, why: ["Scatter the ashes and there is nothing to call. A burned tree leaves no stump and no log."] });
          bankRiteSideStep(s, a, "burn");
          return;
        }
        const ash = here.find((o) => o.kind === "ashes" && o.residue);
        if (!ash) return "Call the form back from its ashes.";
        if (actorAt(s, x, y)) return "Someone is standing in the ashes.";
        const res = ash.residue;
        if (res.blocksMove && here.some((o) => o.id !== ash.id && o.blocksMove)) return "The form that returns would not fit there.";
        const spend = spendTempo(s, a, R.restoreAp, "Restore"); if (spend) return spend;
        s.arena.objects = s.arena.objects.filter((o) => o.id !== ash.id);
        const hp = Math.max(1, Math.round((res.maxHp || 1) * R.hpFrac));
        s.arena.objects.push({
          id: "o" + (++s.seq), kind: "plant", type: res.type, form: res.form, trait: res.trait, name: res.name, x, y,
          hp, maxHp: res.maxHp, material: res.material || "plant", blocksMove: !!res.blocksMove, moveCost: res.moveCost,
          sightHeight: res.sightHeight, cover: res.cover, protected: false, restored: true, status: {},
        });
        log(s, { kind: "ritual", actor: a.id, tiles: [[x, y]], restore: true, text: `${a.name} calls the ${res.name} back from the ashes (${hp} of ${res.maxHp} life).`, why: ["Once per pile. The ashes are spent. A later burn is a new pile."] });
        bankRiteSideStep(s, a, "call");
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
      strike(s, a, act) {
        const reachDist = a.awakened ? (tx, ty) => Math.min(...footprint(a).map(([x, y]) => dist(s, x, y, tx, ty))) : (tx, ty) => dist(s, a.x, a.y, tx, ty);   // a big body strikes from any tile it stands on
        const awakenedBase = a.awakened ? (Tsukumogami?.data?.rules?.strikeBySize || [])[a.awakened.size] : null;   // size sets the base; effort scales it like any Strike
        if (a.status?.miseLine) delete a.status.miseLine;   // a Chef's spent-station credit belongs to the Strike that spends it: a stale one (a Strike that fizzled) never carries over
        if (Courtroom) { const no = Courtroom.violenceGate(s, H, a); if (no) return no; }   // W1.3: no brawling in court
        if(a.status?.soothed)return "Soothed: hostile actions are unavailable this turn.";
        if(a.status?.detained&&(a.status.detained.until==null||a.status.detained.until>=a.ownerTurns))return "Detained: no actions until the hold ends.";
        if ((H.Injury?.gradeOf(a, "arms") || 0) === 2) return "Maimed arms can't strike: techniques only.";
        const flowMul = s.rules.flowState?.enabled !== false && ((a.ultimateCharge ?? 0) >= (s.rules.ultimateChargeMax || 100) || !!a.form?.golden) ? s.rules.flowState?.strikeMul || 1 : 1;   // Flow state: a pocketed ult hits harder, live off the bar; gold is flow incarnate
        const arming = (s.arena.objects || []).find((o) => (o.hp ?? 0) > 0 && o.side === a.side && ((o.type === "foundry" && dist(s, a.x, a.y, o.x, o.y) <= 2) || (o.type === "keep" && Math.max(Math.abs(o.x - a.x), Math.abs(o.y - a.y)) === 1)));
        const foundryBonus = !arming ? 0 : s.actors[arming.owner]?.character === "starfarer" ? 3 : 2;   // Settlement: the line arms its strikers; Ship's Engineer: her works arm +3 (Mala, 2026-10-19)
        const [tx, ty] = act.target || []; const t = actorAt(s, tx, ty) || (s.wild.find((m) => m.form === "unit" && m.x === tx && m.y === ty) ? { ...s.wild.find((m) => m.form === "unit" && m.x === tx && m.y === ty), wild: true, side: "wild", status: {} } : null);
        if (act.aim) {
          if (!["head", "arms", "legs"].includes(act.aim)) return "Aim at head, arms, or legs.";
          if (!t || t.wild || t.defeated) return "Called shots need a standing opponent.";
        }
        // (pocket model, 2026-10-24: souls are fighters on the plane now — a strike at a soul is a
        // strike like any other. The old same-map ghost relay is gone; cipher expose still wounds the soul bar.)
        if (!t && H.fieldAt(s, tx, ty)) {   // Mala, 2026-10-11: any normal attack clears creeper
          if (reachDist(tx, ty) > strikeRange(s, a)) return strikeRange(s, a) > 1 ? `Strike reaches ${strikeRange(s, a)} tiles.` : "Strike reaches only adjacent tiles.";
          const cut = act.effort ?? s.rules.actionCosts.strikeMin, cutError = spendTempo(s, a, cut, "Strike", true); if (cutError) return cutError;
          log(s, { kind: "act", actor: a.id, tiles: [[tx, ty]], text: `${a.name} strikes at the creeper.` });
          H.clearField(s, a, [[tx, ty]]); return;
        }
        if (!t) {   // Mala, 2026-10-13: a data center can be struck by anyone who is not on its builder's side (docs/data-center.md)
          const dc = ClassRuntime?.strikeable?.(s, a, tx, ty);   // any object: a data center, a tower anchor, a bench, a tree
          if (dc) {
            if (dc.side && dc.side === a.side) return dc.tower ? "That is your own side's drone tower." : dc.object ? `That ${dc.o.name || dc.o.type} is your own side's.` : "That is your own side's data center.";
            if (reachDist(tx, ty) > strikeRange(s, a)) return strikeRange(s, a) > 1 ? `Strike reaches ${strikeRange(s, a)} tiles.` : "Strike reaches only adjacent tiles.";
            const push = act.effort ?? s.rules.actionCosts.strike;
            if (push < s.rules.actionCosts.strikeMin || push > s.rules.actionCosts.strikeMax || push % 5) return `Strike effort must be ${s.rules.actionCosts.strikeMin}–${s.rules.actionCosts.strikeMax} in 5-point steps.`;
            const pay = spendTempo(s, a, push, "Strike", true); if (pay) return pay;
            const blade0 = a.form?.strike || null, force = (awakenedBase ?? blade0?.potency ?? s.rules.strike.potency) * push / s.rules.actionCosts.strike * (H.mindset(a)?.baseMul || 1) * flowMul + foundryBonus + (a.passives?.strikePotencyAdd || 0) + (a.awakened && hasTrait(a, "heavy") ? 2 : 0);
            const what = dc.o.name || ({ plant: dc.o.common || dc.o.type }[dc.o.kind]) || dc.o.type;
            if (dc.object) log(s, { kind: "act", actor: a.id, tiles: [[tx, ty]], text: `${a.name} strikes the ${what}, investing ${push}% of a turn for ${roundFn(s)(force)} potency.`, why: ["Anything on the map can be broken."] });
            else log(s, { kind: "act", actor: a.id, tiles: [[tx, ty]], text: dc.tower ? `${a.name} strikes the ${dc.o.name || dc.o.type} carrying ${dc.owner.name}'s drone tower, investing ${push}% of a turn for ${roundFn(s)(force)} potency.` : `${a.name} strikes ${dc.owner.name}'s data center, investing ${push}% of a turn for ${roundFn(s)(force)} potency.`,
              why: [dc.tower ? "A Strike can hit an object that carries a drone tower: break the anchor and the tower falls." : "A data center is an object a Strike can hit.", ...(dc.agi ? [`${dc.agi.name} runs on it.`] : [])] });
            H.strikeObject(s, a, dc.o, force, blade0?.damageType || "nigredo");
            if (dc.o.sealedGate) sealedNext()?.syncGates?.(s);
            s.lastClashRound = s.round; return;
          }
        }
        // Entranced (targeting.js): the entranced perceive sides swapped, so a Strike sees them the same way. The AI flips
        // a.side while it decides (_entrFlip); without this, its Strike on a former ally was refused here (qa/repeats.md #9).
        if (s.sealedFight && a.boss === "sealednext" && t) {
          const SN = sealedNext();
          if (SN && !SN.canStrike(s.sealedFight, `${a.x},${a.y}`)) return "A strike starts from the shared line.";
        }
        const entr = !a._entrFlip && a.status?.entranced && (a.status.entranced.until == null || a.status.entranced.until >= a.ownerTurns);
        const seenSide = entr ? (a.side === "player" ? "enemy" : "player") : !a._entrFlip && H.States?.anySide(a) ? null : a.side;   // Cure: a loosed unit sees no side at all
        if (!t || t.side === seenSide || H.Instinct.hidden(a, t)) return "Strike needs an adjacent opponent.";
        if (Parley && !t.wild) { const no = Parley.blocks(s, a, t); if (no) return no; }   // Parley
        if (reachDist(tx, ty) > strikeRange(s, a)) return strikeRange(s, a) > 1 ? `Strike reaches ${strikeRange(s, a)} tiles.` : "Strike reaches only adjacent tiles.";
        if (!t.wild && ClassRuntime?.bowBlocked?.(s, a, t, classH())) return "The bow needs a clear line of sight.";
        const effort = act.effort ?? s.rules.actionCosts.strike;
        if (effort < s.rules.actionCosts.strikeMin || effort > s.rules.actionCosts.strikeMax + s.rules.maxOverclockPerAction || effort % 5) return `Strike effort must be ${s.rules.actionCosts.strikeMin}–${s.rules.actionCosts.strikeMax + s.rules.maxOverclockPerAction} in 5-point steps.`;
        if(presidentRules){for(const h of Object.values(s.actors)){if(!h.law||h.law.until<s.round)continue;const hu=presidentUnits(s).find(u=>u.id===h.id),au=presidentUnits(s).find(u=>u.id===a.id),r=presidentRules.breaksLaw(hu,au,{delivery:"contact"},{...presidentContext(s),round:s.round});if(r.broke){syncPresidentUnit(s,r.actor);log(s,{kind:"law",actor:a.id,target:h.id,text:`${a.name} breaks ${h.name}'s Due Process rule (contact) and becomes an outlaw.`});}}}
        if (effort > s.rules.actionCosts.strikeMax && H.mindset(a)?.noOverclock) return "Craftsman's Mindset: no overclocked Strike.";
        const free = freeStrike(s, a, t, effort), bars = talksToAttack(a);   // a Rapper with Speed-Talker: the Strike is talk too, at half the action points
        const starTax = ClassRuntime?.actor ? ClassRuntime.actor.taxFor(s, a, [t.id]) : 1;   // GDP: enemies pay ×AP to target the star; potency stays on effort
        const steel = act.steelWill ? (H.fruitRules?.steelWillAP ?? 10) : 0;   // Steel will (engine/fruit.js): +10 AP, and the blow carries will
        const prep = ClassRuntime?.mise?.strikePrep?.(s, a, effort - free);   // Mise en Place: a prepared Strike (the Chef's): AP off the effort, never below the 10 AP floor; potency stays on the effort
        const aimAp = act.aim ? (s.rules.injury?.aimAp ?? 10) : 0;
        const spendError = spendTempo(s, a, (bars ? Math.max(0, Math.round((effort - free - (prep?.save || 0)) * bars.apMul)) : effort - free - (prep?.save || 0)) * starTax * (hasTrait(a, "fourArms") ? 1.5 : 1) + steel + aimAp, "Strike", true); if (spendError) return spendError;   // Four Arms: all four swing — ×1.5 AP (potency doubles below)
        if (prep) ClassRuntime.mise.redeem(s, a, { miseStation: prep.id, miseSaved: prep.save }, classH());
        if (act.aim) { s.aimN = (s.aimN || 0) + 1; if (seededChance(`${s.seed}:aim:${a.id}:${t.id}:${s.aimN}`) < (s.rules.injury?.aimMiss ?? 0.15)) { log(s, { kind: "miss", actor: a.id, target: t.id, cause: "aimed-wide", text: `${a.name} aims for the ${act.aim} and misses clean.` }); return; } }
        if (barsTooFast(s, a, "strike")) { log(s, { kind: "act", actor: a.id, target: t.id, fizzled: true, text: `${a.name} talks too fast and the jab goes past ${t.name}.`, why: ["Speed-Talker: his attacks are talk, at half the action points, and they land 85% as often."] }); return; }
        if (free) { a.freeStrikeTurn = a.ownerTurns; log(s, { kind: "freeStrike", actor: a.id, target: t.id, text: `${a.name} strikes from the hold: ${free} action points of it cost nothing.`, why: ["Grappler: the first Strike each turn on a held opponent is free up to a balanced strike."] }); }
        const blade = a.form?.strike || null;   // an orb form's own strike (the Cyborg's energy blade, docs/brain-chip.md)
        let potency = (awakenedBase ?? blade?.potency ?? s.rules.strike.potency) * effort / s.rules.actionCosts.strike * (a.omen ? a.omen.multiplier : 1) * H.adviceMul(a) * (H.mindset(a)?.baseMul || 1) * flowMul;   // Corner advice (companions); Craftsman's Mindset; Flow state
        if (a.awakened && hasTrait(a, "heavy")) potency += 2;   // Tsukumogami: Heavy stone lands harder
        const dense = hasTrait(a, "denseMuscle"); if (dense) potency *= 2;   // Dense Muscle: a Strike is the most physical attack there is
        const quad = hasTrait(a, "fourArms"); if (quad) potency *= 2;   // Four Arms: all four fists land (stacks with Dense Muscle — eight fists)
        const autoArm = hasTrait(a, "automailLimb") ? 3 : 0; if (autoArm) potency += autoArm;   // anime batch: Winry-grade arm (flat, after Dense Muscle like the Foundry's, so it is not doubled)
        const vesselBulk = hasTrait(a, "vesselBody") ? 1 : 0; if (vesselBulk) potency += vesselBulk;   // anime batch: built to contain
        potency += foundryBonus;   // the Foundry's flat +2 lands after Dense Muscle, so it is not doubled
        const gearBlade = a.passives?.strikePotencyAdd || 0; if (gearBlade) potency += gearBlade;   // a worn weapon, flat, after multipliers
        // Lance Charge (the Knight's passive, class-builds.js): the first Strike of a turn after walking 3 or more tiles in it.
        const lance = ClassRuntime?.builds?.[a.character]?.passives?.lance_charge, charged = lance && (a.walkedThisTurn || 0) >= 3 && a.lanceTurn !== a.ownerTurns ? lance.effect.strikePotencyAdd : 0;
        const CY = s.rules.cybernetic; if (CY && H.hasTrait(a, CY.trait)) potency += CY.strike;   // Cybernetic: a flat +3
        const AS = s.rules.ascended; if (AS && H.hasTrait(a, AS.trait)) potency += AS.strike;   // Ascended: a flat +5
        if (a.birdMountain?.red) { const g = a.birdMountain.red.gear; potency = Math.floor(potency * (g === 5 ? 3 : [1.5, 2, 2.5][g - 2])); }   // ʻUlaʻula: the red multiplies the whole Strike
        const coils = H.fruitRelease ? H.fruitRelease(s, a) : { potency: 0, n: 0 }; if (coils.n) potency += coils.potency;   // Coilfruit: the stored coils let go
        if (charged) { a.lanceTurn = a.ownerTurns; potency += charged; log(s, { kind: "effect", actor: a.id, target: t.id, text: `${a.name} strikes at the end of a ${a.walkedThisTurn}-tile run: Lance Charge, +${charged}.`, why: ["Once a turn, after walking 3 or more tiles."] }); }
        const armG = H.Injury?.gradeOf(a, "arms") || 0;
        if (armG === 1) potency *= (s.rules.injury?.armsWoundedMult ?? 0.8);
        const inst = { name: blade?.name || "Strike", ability: "strike", concept: null, delivery: "contact", damageType: blade?.damageType || "nigredo" };
        if (act.aim) { inst.aimZone = act.aim; log(s, { kind: "act", actor: a.id, target: t.id, text: `${a.name} aims the strike at the ${act.aim} (+${aimAp} AP).` }); }
        if (hasTrait(a, "drunkenMonkey")) inst.directHit = true;   // Drunken Monkey Style: every attack lands direct
        if (steel) inst.carriesWill = true;
        if (coils.n) log(s, { kind: "effect", actor: a.id, target: t.id, text: `${a.name} lets ${coils.n} coil${coils.n === 1 ? "" : "s"} go: +${coils.potency} potency.`, why: ["Coilfruit: Wind the Spring stores the blow; the next Strike releases it."] });
        if (H.fruitDrift?.(s, a, t, inst)) { log(s, { kind: "act", actor: a.id, target: t.id, fizzled: true, text: `${a.name}'s strike passes through ${t.name}: Drift.`, why: ["Mistfruit: a strike that doesn't carry will misses 35% of the time. Steel will (+10 AP) lands through it."] }); hermitCharge(s, a, "strike"); return; }
        log(s, { kind: "act", actor: a.id, text: `${a.name} strikes ${t.name} (contact, no ΦF), investing ${effort}% of a turn for ${roundFn(s)(potency)} potency.${dense ? " Dense Muscle doubles it." : ""}${quad ? " Four Arms double it (×1.5 AP)." : ""}${gearBlade ? ` The weapon adds +${gearBlade}.` : ""}${autoArm ? " The automail arm adds +3." : ""}${vesselBulk ? " The vessel body adds +1." : ""}`, ...(starTax > 1 ? { why: [`Genre-Defining Performance: ×${starTax} AP to touch the star.`] } : {}) });
        strikeTarget(s, a, t, inst, potency, [`Universal strike: no concept, no edges beyond parries. ${effort} action points invested; damage scales with tempo committed.`, ...(foundryBonus ? [`The line arms the blow: +${foundryBonus} (Foundry).`] : []), ...(autoArm ? ["Automail arm +3."] : []), ...(vesselBulk ? ["Vessel body +1."] : []), ...(armG === 1 ? ["Wounded arms: −20% potency."] : [])]);
        if (coils.n && H.fruitOf?.(a)?.ripe && !t.defeated && !s.outcome) { log(s, { kind: "effect", actor: a.id, target: t.id, text: `The ripe coils let go all at once: ${t.name} is knocked back ${H.fruitPushBonus?.(s, a, t, coils.n, "push") ?? coils.n}.`, why: ["Sinkerfruit: a ripened release knocks the target back one tile per coil."] }); { const mk = s.log.length, from = [t.x, t.y]; H.knock(s, a, t, coils.n, inst, "push"); H.fruitKnocked?.(s, a, t, mk, from); } }
        hermitCharge(s, a, "strike");   // Train Hard
        if (blade?.rider && bossRules?.formRider && !s.outcome) bossRules.formRider(a, t, blade.rider, H.formCtx(s, a, t));   // learned forms: the form Strike's effect
      },
      grapple(s, a, act) {
        if (Courtroom) { const no = Courtroom.violenceGate(s, H, a); if (no) return no; }   // W1.3: no brawling in court
        const G = s.rules.grapple;
        if (a.status?.soothed) return "Soothed: hostile actions are unavailable this turn.";
        const [tx, ty] = act.target || [], t = actorAt(s, tx, ty);
        if (!t || t.side === a.side || t.defeated || H.Instinct.hidden(a, t)) return "Grapple needs an adjacent opponent.";
        if (Parley) { const no = Parley.blocks(s, a, t); if (no) return no; }
        if ((H.Injury?.gradeOf(a, "arms") || 0) === 2) return "Maimed arms can't grapple: techniques only.";
        if (dist(s, a.x, a.y, tx, ty) > G.range) return "Grapple reaches only adjacent tiles.";
        if (t.massive || t.boss) return `${t.name} is too large to hold.`;
        if (grappled(s, t)) return `${t.name} is already held.`;
        if (t.regripImmuneUntil >= s.round) return `${t.name} is still slipping free.`;   // one clear round after breaking a hold
        const spendError = spendTempo(s, a, grappleCost(s, a), "Grapple", true); if (spendError) return spendError;
        const grip = strongGrip(s, a), denseG = hasTrait(a, "denseMuscle"), CYg = s.rules.cybernetic && H.hasTrait(a, s.rules.cybernetic.trait) ? s.rules.cybernetic.grapple : 0, luckG = (H.luckBonus && !grip?.autoSucceed) ? H.luckBonus(s, a) : 0;   // W5.1 rhythm (Strong Grip needs no luck)
        let chance = grip?.autoSucceed ? 1 : Math.min(0.95, grappleChance(s, t) * (denseG ? 2 : 1) + CYg + luckG + (hasTrait(a, "fourArms") ? 0.25 : 0));   // Cybernetic: +0.25; Dense Muscle: the hold lands twice as often; Four Arms: +0.25 (more hands, surer grip)
        const armWeak = (H.Injury?.gradeOf(a, "arms") || 0) === 1 && !grip?.autoSucceed;
        if (armWeak) chance *= (s.rules.injury?.armsWoundedMult ?? 0.8);
        if (luckG) chance = Math.min(0.95, Math.max(0.05, chance));
        s.grappleN = (s.grappleN || 0) + 1;
        const won = !!grip?.autoSucceed || seededChance(`${s.seed}:grapple:${a.id}:${t.id}:${s.grappleN}`) < chance, why = grip?.autoSucceed ? ["Strong Grip: the hold always lands, whatever the defence."] : [`Grapple: ${Math.round(chance * 100)}% (${Math.round(G.base * 100)}% base${t.status.guard ? `, −${Math.round(G.guardPenalty * 100)}% against a guard` : ""}${t.status.stun ? `, +${Math.round(G.stunnedBonus * 100)}% on a stunned target` : ""}${denseG ? ", ×2 Dense Muscle" : ""}${hasTrait(a, "fourArms") ? ", +25% Four Arms" : ""}${luckG ? `, luck ${luckG > 0 ? "+" : ""}${Math.round(luckG * 100)}%` : ""}${armWeak ? ", ×0.8 wounded arms" : ""}).`];
        if (H.noteLuck && !grip?.autoSucceed) H.noteLuck(s, a, won);   // a Strong Grip hold is not a lucky success: it never rolled
        if (!won) { log(s, { kind: "grapple", actor: a.id, target: t.id, held: false, tiles: [[tx, ty]], text: `${a.name} reaches for ${t.name} and misses the hold.`, why }); return; }
        t.status.grappled = { label: "Grappled", owner: a.id, untilRound: s.round + G.rounds, at: [[t.x, t.y], [a.x, a.y]] };   // at: where both stood, so a forced move of either breaks it (conditions.js settleHolds)
        if (a.character === "police_officer" && seededChance(`${s.seed}:copsubdue:${a.id}:${t.id}:${s.grappleN}`) < 0.10) {
          t.status.detained = { until: t.ownerTurns + 2, by: a.id };
          if (t.id === a.hunting && !t.claimTrial) s.copBust = { offender: t.id, side: t.side, name: t.name };
          log(s, { kind: "grapple", actor: a.id, target: t.id, held: true, tiles: [[tx, ty]], text: `${a.name}'s hold locks in: ${t.name} is subdued on the spot.` });
        }
        const cut = G.apCut * (denseG ? 2 : 1);   // Dense Muscle: the hold takes twice the breath
        log(s, { kind: "grapple", actor: a.id, target: t.id, held: true, tiles: [[tx, ty]], text: `${a.name} gets hold of ${t.name}: no movement or dodging until the end of round ${s.round + G.rounds}, and ${cut} action points lost.`, why });
        const book = G.byTheBook, held = t.status?.cuffed && (t.status.cuffed.until == null || t.status.cuffed.until >= t.ownerTurns);   // cuffed as police.js reads it
        if (book && held && !t.defeated && hasTrait(a, book.trait)) {   // By the Book: the hold on a cuffed mark pays the fast track now
          const before = a.ultimateCharge || 0; a.ultimateCharge = Math.min(s.rules.ultimateChargeMax, before + book.cuffedCharge);
          log(s, { kind: "grapple", actor: a.id, target: t.id, held: true, text: `${a.name} works by the book: the hold on cuffed ${t.name} pays +${a.ultimateCharge - before} ultimate charge.` });
        }
        addStun(s, a, t, cut);
      },
      // Fulcrum Throw (emergent-ideas.js; rules.emergentIdeas.fulcrumThrow): lift what is on an adjacent tile and throw it.
      throw(s, a, act) {
        if (Courtroom) { const no = Courtroom.violenceGate(s, H, a); if (no) return no; }   // W1.3: no brawling in court
        const T = EmergentIdeas?.active(a).find((x) => x.id === "fulcrumThrow")?.effects;
        if (!T) return "Fulcrum Throw needs Timing and Leverage held together.";
        if (a.status?.soothed) return "Soothed: hostile actions are unavailable this turn.";
        const [px, py] = act.pick || [], [tx, ty] = act.at || [];
        if (!(dist(s, a.x, a.y, px, py) === 1)) return "Lift something on a tile beside you.";
        const unit = H.Instinct.hidden(a, actorAt(s, px, py)) ? null : actorAt(s, px, py), obj = unit ? null : s.arena.objects.find((o) => o.x === px && o.y === py && T.liftable.includes(o.type) && (o.hp == null || o.hp > 0));
        if (!unit && !obj) return "There is nothing there to lift.";
        if (unit && (unit.massive || unit.boss)) return `${unit.name} is too large to lift.`;
        if (unit && unit.side !== a.side && Parley) { const no = Parley.blocks(s, a, unit); if (no) return no; }
        if (!inside(s, tx, ty) || dist(s, a.x, a.y, tx, ty) > T.range || (tx === a.x && ty === a.y) || (tx === px && ty === py)) return `Throw to another tile within ${T.range}.`;
        const free = (x, y) => inside(s, x, y) && !tileAt(s, x, y).blocksMove && !actorAt(s, x, y) && !barrierAt(s, x, y) && !s.arena.objects.some((o) => o !== obj && o.x === x && o.y === y && o.blocksMove);
        const struck = actorAt(s, tx, ty);
        // Onto a body it glances off to the nearest open tile beside it (fixed order, so it replays the same).
        const land = struck ? DIRS.map(([dx, dy]) => [tx + dx, ty + dy]).filter(([x, y]) => free(x, y) || (x === px && y === py)).sort((p, q) => p[1] - q[1] || p[0] - q[0])[0] : free(tx, ty) ? [tx, ty] : null;
        if (!land) return "There is nowhere for it to land there.";
        const spendError = spendTempo(s, a, T.ap, "Fulcrum Throw", true); if (spendError) return spendError;
        const inst = { name: "Fulcrum Throw", ability: "fulcrumThrow", concept: "leverage", delivery: "contact", damageType: "nigredo" };
        const held = !!unit && grappled(s, unit), thing = unit ? unit.name : `the ${obj.type}`;
        log(s, { kind: "act", actor: a.id, target: unit?.id || null, emergentIdea: "fulcrumThrow", tiles: [[px, py], land], text: `${a.name} lifts ${thing} and throws ${unit ? "them" : "it"} to (${land.join(",")})${struck ? `, into ${struck.name}` : ""}.`, why: ["Fulcrum Throw: Timing + Leverage held together."] });
        if (unit) {
          if (held) unit.status.grappled = null;
          unit.x = land[0]; unit.y = land[1]; applyEntryEffects(s, a, unit, land[0], land[1], "is thrown onto");
          if (unit.side !== a.side && !unit.defeated) hit(s, a, unit, inst, T.damage * (held ? T.heldMul : 1), [`Thrown: ${T.damage} base${held ? `, ×${T.heldMul} out of a hold` : ""}.`]);
        } else { obj.x = land[0]; obj.y = land[1]; }
        if (struck && struck.side !== a.side && !struck.defeated) hit(s, a, struck, inst, unit ? T.impact : T.objectDamage, [unit ? `Struck by a thrown body: ${T.impact}.` : `Struck by a thrown ${obj.type}: ${T.objectDamage}.`]);
      },
      // Break a hold (rules.grapple.break). Certain, and dearer than the action points the hold took.
      pressSubmission(s, a, act) { if (Courtroom) { const no = Courtroom.violenceGate(s, H, a); if (no) return no; } return H.pressSubmission(s, a, act); },   // W1.3: no brawling in court; Submission (engine/conditions.js; docs/submission.md)   // Submission (engine/conditions.js; docs/submission.md)
      breakGrapple(s, a) {
        const G = s.rules.grapple;
        if (!grappled(s, a)) return `${a.name} is not held.`;
        if (a.status.submission) return "Inside a submission the struggle is the contest: win the meter to break free.";
        const holder = s.actors[a.status.grappled.owner];
        const paid = H.breakCost(s, a);   // doubled in the hold of someone with Contact Reading (spendTempo applies it)
        const spendError = spendTempo(s, a, G.break.ap, "Break hold", true); if (spendError) return spendError;
        a.status.grappled = null;
        if (G.strongGrip?.regripImmuneRounds) a.regripImmuneUntil = s.round + G.strongGrip.regripImmuneRounds;   // nobody can Grapple it again until the round after next
        log(s, { kind: "grapple", actor: a.id, target: holder?.id || null, held: false, broke: true, text: `${a.name} breaks ${holder && !holder.defeated ? `${holder.name}'s hold` : "the hold"} and can move and dodge again.`,
          why: [`Break hold: ${paid} action points${paid !== G.break.ap ? ` (${G.break.ap} doubled by Contact Reading)` : ""}, more than the ${G.apCut} the hold took. It always works.`] });
        if (holder && !holder.defeated && G.break.holderAp) {
          log(s, { kind: "grapple", actor: holder.id, target: a.id, held: false, text: `${holder.name} is winded by the lost hold: ${G.break.holderAp} action points gone.`, why: ["Losing a hold is tiring too, less than breaking one."] });
          addStun(s, a, holder, G.break.holderAp);
        }
      },
      takeFromCart(s, a, act) {   // an ally beside the Maid takes an item out of her cart (Mala, 2026-10-14; classes/class-runtime.js cartOf)
        const maid = s.actors[act.from], cart = ClassRuntime?.cartOf?.(s, maid);
        if (!maid || maid.defeated || !cart) return "There is no Maid's cart to take from.";
        if (maid.side !== a.side || maid.id === a.id) return "Only an ally can take from her cart, and not the Maid herself (she uses Restore).";
        if (Math.max(Math.abs(maid.x - a.x), Math.abs(maid.y - a.y)) > 1) return "Stand beside her to reach the cart.";
        const at = (cart.stored || []).findIndex((x, i) => x.kind === "item" && (act.item == null || x.item === act.item) && (act.index == null || i === act.index));
        if (at < 0) return "There is no item like that in the cart.";
        if ((a.inventory || []).length >= (a.inventoryCapacity || 0)) return `Your hands are full (${a.inventoryCapacity || 0} slots).`;
        const spendError = spendTempo(s, a, s.rules.actionCosts.utility ?? 10, "Take from the cart"); if (spendError) return spendError;
        const [taken] = cart.stored.splice(at, 1); a.inventory = [...(a.inventory || []), taken.item];
        log(s, { kind: "pickup", actor: a.id, item: taken.item, from: maid.id, text: `${a.name} takes ${taken.name} from ${maid.name}'s cart.`, why: [`${cart.stored.length}/3 left in the cart.`] });
      },
      dropItem(s, a, act) {   // set down a carried item and leave it (Mala, 2026-10-18: no way to get rid of pack items mid-battle)
        const item = act.item, i = (a.inventory || []).indexOf(item);
        if (i < 0) return "You are not carrying that item.";
        const name = accountItems?.consumables?.[item]?.name || wildRules?.data?.items?.[item]?.name || pickupRules?.sources?.[item]?.name || item;
        a.inventory = [...(a.inventory || [])]; a.inventory.splice(i, 1);
        log(s, { kind: "dropItem", actor: a.id, item, text: `${a.name} drops ${name} and leaves it behind.` });
      },
      // Cook in battle (Mala, 2026-10-25; account/cooking.js): anyone makes the field recipes, cooks make every recipe. The
      // ingredients come out of the pack and the dish goes back in, so a pack never grows; the AI never cooks.
      cook(s, a, act) {
        const K = Cooking(); if (!K) return "Cooking is unavailable.";
        const held = (x) => x && (x.until == null || x.until >= a.ownerTurns);
        if (held(a.status?.cuffed) || held(a.status?.detained)) return "Cuffed hands can't cook.";
        const isCook = K.isCook(a), r = K.cook(a.inventory || [], act.recipe, { inBattle: true, cook: isCook });
        if (!r.ok) return r.reason;
        const ap = a.passives?.cookApOverride ?? K.rules.cookAp[r.recipe.field ? "field" : "full"];   // Chef Knives: cooking costs 5 AP for the wearer
        const spendError = spendTempo(s, a, ap, `Cook ${r.recipe.name}`); if (spendError) return spendError;
        const nameOf = (id) => accountItems?.consumables?.[id]?.name || id, used = r.used.map((k) => a.inventory[k]);
        a.inventory = [...r.rest, r.out];
        log(s, { kind: "cook", actor: a.id, item: r.out, used, text: `${a.name} cooks ${nameOf(r.out)} from ${used.map(nameOf).join(" and ")}.`,
          why: [`${ap} action points${isCook ? " (a cook: every recipe works mid-battle)" : " (a field recipe: anyone can make it mid-battle)"}.`, r.recipe.teach].filter(Boolean) });
      },
      // Battle Cards (engine/cards.js, specs/CARDS.md 3.2 and 18.4): one door for the player and the AI. No AP, no phi, no reaction, no window.
      playCard(s, a, act) { return H.Cards.play(s, a, act); },
      showHand(s, a) { return H.Cards.showHand(s, a); },
      useItem(s, a, act) {
        const item = act.item, at = act.target || [a.x, a.y];
        const held = (x) => x && (x.until == null || x.until >= a.ownerTurns);
        if(a.status?.scribedItemLock?.expiresAt>a.ownerTurns) return "Items are restricted by a scribed effect.";
        if (held(a.status?.cuffed) || held(a.status?.detained)) return "Cuffed hands can't use items.";
        const watched = Object.values(s.actors).some((u) => u.side !== a.side && !u.defeated && u.primary === "legitimacy" && u.secondary === "constraint" && Math.abs(u.x - a.x) + Math.abs(u.y - a.y) <= 1);
        if (watched) return "Not on my watch: an adjacent officer bars consumables.";
        if (!a.inventory.includes(item)) return "You are not carrying that item.";
        const accountItem = accountItems?.consumables?.[item];
        if (accountItem && !accountItem.effect?.wild) {
          const effect = accountItem.effect || {};
          if (effect.hire) return H.Hires.call(s, a, item, accountItem) || undefined;   // a merc contract or a letter of safe conduct (engine/hires.js)
          const range = effect.placeBarrier || effect.blockSightTiles || effect.observe ? 4 : 0;
          if (!inside(s, at[0], at[1]) || dist(s, a.x, a.y, at[0], at[1]) > range) return `Choose a tile within ${range} spaces.`;
          const hurtBeside = effect.healAdjacentAllies ? Object.values(s.actors).filter((u) => u.id !== a.id && u.side === a.side && !u.defeated && !u.notArrived && u.lf < u.maxLF && Math.max(Math.abs(u.x - a.x), Math.abs(u.y - a.y)) <= 1) : [];
          const lfFull = effect.heal && a.lf >= a.maxLF, pfFull = effect.phiForce && a.pf >= a.maxPF;
          if (lfFull && !hurtBeside.length && (!effect.phiForce || pfFull)) return "Life Force is already full.";
          if (pfFull && !effect.heal) return "ΦF is already full.";
          if (effect.ultCharge && (a.ultimateCharge || 0) >= s.rules.ultimateChargeMax) return "Your ultimate charge is already full.";
          if (effect.placeBarrier && (actorAt(s, at[0], at[1]) || barrierAt(s, at[0], at[1]) || tileAt(s, at[0], at[1]).blocksMove)) return "Choose an empty floor tile for the sandbag.";
          const useAp = Cooking()?.useCost(item, s.rules.actionCosts.utility, a) ?? s.rules.actionCosts.utility;   // better consumables cost less: food by preparation, the rest by rarity (account/cooking.js)
          const spendError = spendTempo(s, a, useAp, `Use ${accountItem.name}`); if (spendError) return spendError;
          a.inventory.splice(a.inventory.indexOf(item), 1);
          if (effect.ultCharge) { const n = Math.min(effect.ultCharge, s.rules.ultimateChargeMax - (a.ultimateCharge || 0)); a.ultimateCharge = (a.ultimateCharge || 0) + n; log(s, { kind: "item", actor: a.id, text: `${accountItem.name}: +${n} ultimate charge.` }); }
          if (effect.heal && a.lf < a.maxLF) { const n = Math.min(effect.heal, a.maxLF - a.lf); a.lf += n; log(s, { kind: "item", actor: a.id, text: `${accountItem.name} restores ${n} LF.` }); }
          if (effect.phiForce && a.pf < a.maxPF) { const n = Math.min(effect.phiForce, a.maxPF - a.pf); a.pf += n; log(s, { kind: "item", actor: a.id, text: `${accountItem.name} restores ${n} ΦF.` }); }
          for (const u of hurtBeside) { const n = Math.min(effect.healAdjacentAllies, u.maxLF - u.lf); u.lf += n; log(s, { kind: "item", actor: a.id, target: u.id, text: `${u.name} shares the ${accountItem.name}: +${n} LF.` }); }
          if (effect.actionPoints) { a.tempo += effect.actionPoints; a.tempoCapacity += effect.actionPoints; log(s, { kind: "item", actor: a.id, text: `${accountItem.name} restores ${effect.actionPoints} action points this turn.` }); }
          if (effect.observe) { s.surveyFlag = (s.surveyFlag || 0) + effect.observe; log(s, { kind: "item", actor: a.id, text: `${accountItem.name} is ready to reveal one enemy technique; choose Observe next.` }); }
          if (effect.placeBarrier) { const b = effect.placeBarrier; s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x: at[0], y: at[1], protection: b.protection, duration: b.duration, expiresAt: a.ownerTurns + b.duration, concept: "barrier" }); log(s, { kind: "item", actor: a.id, tiles: [at], text: `${accountItem.name} places a ${b.protection}-protection wall at (${at[0]},${at[1]}).` }); }
          if (effect.blockSightTiles) { const b = effect.blockSightTiles, tiles = []; for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) if (dist(s, at[0], at[1], x, y) <= b.radius) { tiles.push([x,y]); s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x, y, protection: 0, duration: b.duration, expiresAt: a.ownerTurns + b.duration, concept: "smoke", blocksSight: true }); } log(s, { kind: "item", actor: a.id, tiles, text: `${accountItem.name} releases sight-blocking smoke around (${at[0]},${at[1]}).` }); }
          if (effect.autoCorrectQuestion) { s.summonQuestionBoost += effect.autoCorrectQuestion; log(s, { kind: "item", actor: a.id, text: `${accountItem.name} guarantees your next summon question.` }); }
          hermitCharge(s, a, "eat");   // Eat Good: a consumed consumable
          return;
        }
        if (!wildRules || !pickupRules) return "Items are unavailable.";
        const itemRange = wildRules.data.items[item]?.range;
        if (itemRange == null || !inside(s, at[0], at[1]) || dist(s, a.x, a.y, at[0], at[1]) > itemRange) return `Choose a tile within ${itemRange ?? 0} spaces.`;
        const spendError = spendTempo(s, a, s.rules.actionCosts.utility, "Use item"); if (spendError) return spendError;
        a.inventory.splice(a.inventory.indexOf(item), 1);
        const result = wildRules.useItem(wildSnapshot(s), item, at); saveWildWorld(s, result.world);
        for (const ev of result.events) log(s, { kind: ev.kind, actor: a.id, tiles: ev.at ? [ev.at] : ev.tiles, text: ev.text || ev.kind });
        checkOutcome(s);
      },
      summon(s, a, act) {
        if (a.form?.golden) return "The Integrated Self has no need to summon.";
        if (!summonRules || !summonQuestions) return "Summoning is unavailable.";
        const def = summonRules.data?.summons?.[act.summon];
        if (!def) return "No such summon.";
        if (!summonRules.callsPalace(a)) return "Only the player's side calls the palace.";   // summon-owner: the player's side calls (Mala, 2026-11-05, decision b; was Warden-only 2026-10-22)
        const unlocked = (act.unlocked || []).includes(act.summon);
        if (!unlocked) return `${def.name} is not unlocked yet.`;
        const cost = summonProfile(s, a.id);
        if (Array.isArray(act.unlocked)) s.unlockedSummons = act.unlocked.slice();   // remembered for death's door
        const can = summonReadiness(s, a.id, act.summon, act.unlocked);
        if (!can.ok) return can.reason;
        const summonTax = hasTrait(a, "attentionToDetail") ? 5 : 0;   // Attention to Detail: sturdier craft costs slightly
        if (a.tempo < cost.apCost + summonTax) return `Summoning needs ${cost.apCost + summonTax} action points.`;
        if (a.pf < cost.phiCost) return `Summoning needs ${cost.phiCost} ΦF.`;
        const q = summonQuestions.pickQuestion(act.summon, `${s.seed}:${s.round}:${a.id}:${act.summon}`, { hintCount: H.summonQuestionHints(s, a.id, act.summon) });   // O2c: per-summon study hints (via H: queries installs after actions)
        if (!q || q.id !== act.questionId) return "The summon question is no longer current.";
        const score = summonQuestions.scoreAnswer(act.summon, q.id, act.answer, { choiceMap: q.choiceMap });
        const at = summonRules.placeSummon(moduleArena(s.arena), [a.x, a.y], H.arrivalBlocked(s), act.at || null);
        if (!at) return "There is no open tile nearby for the summon.";
        if (!dreamSame(s,a.x,a.y,at[0],at[1])) return "Summons cannot cross the sealed Dream Space.";
        const spend = spendTempo(s, a, cost.apCost + summonTax, `Summon ${def.name}`); if (spend) return spend;
        a.pf -= cost.phiCost;
        if (s.summonQuestionBoost > 0) { score.correct = true; score.bond = 2; score.durationBonus = 1; score.potencyMul = 1.2; s.summonQuestionBoost--; }
        if (score.correct) s.summonCorrectAnswers++;
        const raw = summonRules.makeSummonActor(act.summon, { owner: a.id, at, bond: score.bond, potencyMul: score.potencyMul, durationAdd: a.passives?.summonDurationAdd || 0 });
        const summon = liveSummon(s,a,raw);
        if (hasTrait(a, "attentionToDetail")) { summon.maxLF = summon.lf = Math.round(summon.maxLF * 1.25); log(s, { kind: "effect", actor: a.id, target: summon.id, text: `Attention to Detail: ${summon.name} arrives sturdier (${summon.maxLF} LF).` }); }
        a.status.imaginedRehearsal = null;
        s.actors[summon.id] = summon; s.disclosures[summon.id] = {}; s.knowledge[summon.id] = {};
        s.summonHintCount = 0;
        if (insightRules) { const deck = insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[summon.id] = deck; s.insight.knowledge[summon.id] = insightRules.spawnKnowledge(deck); }
        if (s.dreamSpace && dreamSpaceRules?.summonTurnTicks(s.dreamSpace) === false) s.dreamSpace.summons.push(summon.id);
        s.order.splice(s.turnIndex + 1, 0, summon.id); s.summonUsed.push(act.summon);
        log(s, { kind: "summon", actor: summon.id, text: `${summon.name} arrives at (${at[0]},${at[1]}) for ${summon.summon.turnsLeft} turns${score.correct ? ". Correct: " + score.explain : ". " + score.explain}` });
      },
      callPact(s, a, act) {
        if (a.form?.golden) return "The Integrated Self has no need to summon.";
        if (!summonRules) return "Summoning is unavailable.";
        const def = summonRules.data?.summons?.[act.line], terms = def?.pact;
        if (!def || !terms) return "No such pact line.";
        const book = s.pactBook;
        if (!book?.pacts?.[act.line]) return `${def.name} answers only a signed pact.`;
        if (s.pactActive) return `${summonRules.data.summons[s.pactActive.line]?.name || "A summon"} already answers — one call at a time.`;
        if ((s.summonUsed || []).includes(act.line)) return `${def.name} has already returned to the palace this battle.`;
        const rate = PactLib()?.rateFor?.(book.standing?.[act.line]?.clean || 0) || 0;   // standing rate off the battle-start book, never the act
        const cost = summonProfile(s, a.id);
        const pf = Math.ceil((terms.call.pf || 0) * (1 - rate)), seeds = Math.ceil((terms.call.seeds || 0) * (1 - rate));
        const summonTax = hasTrait(a, "attentionToDetail") ? 5 : 0;
        if (a.tempo < cost.apCost + summonTax) return `Calling needs ${cost.apCost + summonTax} action points.`;
        if (a.pf < pf) return `Calling needs ${pf} ΦF.`;
        if ((s.seeds || 0) < seeds) return `Calling needs ${seeds} Seeds.`;
        const at = summonRules.placeSummon(moduleArena(s.arena), [a.x, a.y], new Set(Object.values(s.actors).filter(x => !x.defeated).flatMap(x => footprint(x).map(([fx, fy]) => `${fx},${fy}`))), act.at || null);   // every tile of a big body (MX2)
        if (!at) return "There is no open tile nearby for the summon.";
        if (!dreamSame(s,a.x,a.y,at[0],at[1])) return "Summons cannot cross the sealed Dream Space.";
        const spend = spendTempo(s, a, cost.apCost + summonTax, `Call ${def.name}`); if (spend) return spend;
        a.pf -= pf; s.seeds -= seeds;   // the purse pays: act() copies s.seeds back to the account
        const raw = summonRules.makeSummonActor(act.line, { owner: a.id, at, bond: 2, potencyMul: 1.2, durationAdd: a.passives?.summonDurationAdd || 0 });
        const summon = liveSummon(s,a,raw);
        summon.summon.turnsLeft = terms.duration + (summonRules.data.rules.bondBonusDuration || 0) + (a.passives?.summonDurationAdd || 0); summon.summon.pact = { line: act.line, owner: a.id };   // full bond: the correct-answer package (potency 1.2, bond 2, duration bonus) on the pact's own terms
        if (hasTrait(a, "attentionToDetail")) { summon.maxLF = summon.lf = Math.round(summon.maxLF * 1.25); log(s, { kind: "effect", actor: a.id, target: summon.id, text: `Attention to Detail: ${summon.name} arrives sturdier (${summon.maxLF} LF).` }); }
        a.status.imaginedRehearsal = null;
        s.actors[summon.id] = summon; s.disclosures[summon.id] = {}; s.knowledge[summon.id] = {};
        s.summonHintCount = 0;
        if (insightRules) { const deck = insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[summon.id] = deck; s.insight.knowledge[summon.id] = insightRules.spawnKnowledge(deck); }
        if (s.dreamSpace && dreamSpaceRules?.summonTurnTicks(s.dreamSpace) === false) s.dreamSpace.summons.push(summon.id);
        s.order.splice(s.turnIndex + 1, 0, summon.id); s.summonUsed.push(act.line);
        s.pactActive = { line: act.line, owner: a.id, summonId: summon.id };
        (s.pactCodes ||= []).push({ type: "pactCalled", line: act.line });
        log(s, { kind: "summon", actor: summon.id, text: `${summon.name} answers the pact at (${at[0]},${at[1]}) for ${summon.summon.turnsLeft} turns${rate ? ` (standing rate −${Math.round(rate * 100)}%)` : ""}. No question: the pact is the answer, at full bond.` });
      },
      dismissPact(s, a, act) {
        const call = s.pactActive;
        if (!call) return "No pact call is active.";
        if (call.owner !== a.id) return "Only the caller dismisses the call.";
        const summon = s.actors[call.summonId];
        s.pactActive = null;
        if (summon && !summon.defeated) { summon.defeated = true; log(s, { kind: "summon", actor: summon.id, text: `${summon.name} bows and goes home — dismissed, free.` }); (s.pactCodes ||= []).push({ type: "pactEnded", line: call.line, how: "dismissed" }); }
        else (s.pactCodes ||= []).push({ type: "pactEnded", line: call.line, how: "downed" });   // already down: closes the books with no standing
      },
      orderSummonUltimate(s, a, act) {
        if (!summonRules?.orderUltimate) return "Summon ultimates are unavailable.";
        if (s.dreamSpace?.owner === a.id || dreamSpaceRules?.ultimatesBlocked(a, s.dreamSpace, s.rules)) return "Dream Space is using your ultimate charge; close it before ordering a summon ultimate.";
        const summon = s.actors[act.summon];
        const def = summon && summonRules.data.summons[summon.summon?.key];
        if (!summon || !def || summon.summon.owner !== a.id || summon.side !== a.side) return "Choose your active summon.";
        const ult = summonRules.activeUltimate(summon), play = ult.play;
        let target = null;
        if (play.centre === "playerTarget" || play.status?.lockTarget) {
          const [x,y] = act.target || [];
          target = Object.values(s.actors).find(u => !u.defeated && u.side !== a.side && H.coversTile(u, x, y))   // any tile of a big foe
            || (s.wild || []).find(u => u.form === "unit" && !u.defeated && u.x === x && u.y === y);
          if (!target) return "Choose a living opponent as the committed target.";
        }
        const snapshot = { ...summonSnapshot(s), playerTarget: target?.id || null };
        const result = summonRules.orderUltimate(a, summon, snapshot, { ultimateChargeMax: s.rules.ultimateChargeMax, announceMultiplier: s.rules.announceMultiplier });
        if (!result.ok) return result.reason;
        Object.assign(a, result.player); Object.assign(summon, result.summon);
        if (target) summon.summon.order.targetId = target.id;
        log(s, { ...result.event, tiles: result.order.tiles || undefined });
        if (result.order.announced) {
          const inst = { name: ult.name, ability: `summonUltimate:${summon.summon.key}`, owner: a.id, tier: "ultimate",
            tiles: result.order.tiles, announcedTiles: result.order.tiles, announce: ult.play.text, mult: result.order.potencyMul,
            summonUltimateOrder: true, summonId: summon.id };
          openResponseWindow(s, a, inst, { announce: ult.play.text });
        }
      },
      monsterSummon(s, a, act) {
        if (a.boss === "kaiju") return H.callBrood(s, a, act);   // the Insect Kaiju's brood: the only boss that summons (true-forms.js; content.js rules.brood)
        if (EnemySummons?.qualifies(a)) return EnemySummons.call(s, a, act, H);
        if (a.side !== "enemy" || !a.passives.rareMonsterSummon) return "Only an enemy with the Believer trait can call a wild creature.";
        if (a.beliefSummonUsed) return "This Believer has already called a monster in this battle.";
        if (!wildRules?.summonMonster) return "Wild monster summoning is unavailable.";
        const kinds = act.dreamKinds || [act.kind];
        const tiles = act.tiles || [act.at];
        const count = kinds.length;
        if (!count || count > (a.beliefStrength >= 3 ? 2 : 1) || tiles.length !== count) return "That summon does not match this Believer's strength.";
        if (a.tempo < 50 * count) return `Calling ${count} creature${count===1?"":"s"} needs ${50 * count} action points.`;
        if (a.pf < 6 * count) return `Calling ${count} creature${count===1?"":"s"} needs ${6 * count} ΦF.`;
        const dreamPool = a.beliefStrength >= 2 ? dreamSpaceRules?.enemyMonsterPool?.(a.beliefStrength) || {} : {};
        const isDreamSummon = Array.isArray(act.dreamKinds);
        if (isDreamSummon && (!dreamSpaceRules?.makeEnemyDreamActor || kinds.some(kind => !dreamPool[kind]))) return "That Dream Space creature is beyond this Believer's reach.";
        if (!isDreamSummon && (!wildRules?.data?.monsters?.[act.kind] || !["feralPig", "termites"].includes(act.kind))) return "That creature is not in the Believer's wild summon pool.";
        for (const [i, at] of tiles.entries()) {
          const [x, y] = at || [];
          if (!dreamSame(s,a.x,a.y,x,y)) return "Summons cannot cross the sealed Dream Space.";
          if (isDreamSummon) {
            if (!inside(s,x,y) || dist(s,a.x,a.y,x,y) < 2 || dist(s,a.x,a.y,x,y) > 4 || actorAt(s,x,y)
              || s.wild.some(m=>m.form==="unit"&&m.x===x&&m.y===y) || tileAt(s,x,y).blocksMove
              || (barrierAt(s,x,y) && !barrierAt(s,x,y).passable)) return "Choose open tiles 2–4 spaces from the Believer for the dream creatures.";
          } else if (dist(s,a.x,a.y,x,y)!==1) return "A wild creature must arrive on an adjacent tile.";
          if (tiles.slice(0,i).some(([px,py])=>px===x&&py===y)) return "Each creature needs its own open tile.";
        }
        if (isDreamSummon && kinds.some(kind => Object.values(s.actors).some(t=>!t.defeated&&t.dream?.key===kind))) return "That dream creature is already present.";
        const label = isDreamSummon ? kinds.map(kind=>dreamPool[kind].name).join(" and ") : wildRules.data.monsters[act.kind].name;
        const spend = spendTempo(s, a, 50 * count, `Call ${label}`); if (spend) return spend;
        a.pf -= 6 * count; a.beliefSummonUsed = true;
        if (isDreamSummon) {
          kinds.forEach((kind, i) => {
            const raw = dreamSpaceRules.makeEnemyDreamActor(kind, { at: tiles[i], round: s.round, summoner: a.id,
              id: `dream-${kind}-belief-${a.id}-${s.round}-${i+1}` });
            const actor = { ...raw, sprite: `dream-${kind}`, ai: "dream", controller: "ai", pf: s.rules.maxPF, maxPF: s.rules.maxPF,
              ultimateCharge: 0, level: 1, xp: 0, proficiency: 1, reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
              reaction: s.rules.reactionsPerRound, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0,
              tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false, ownerTurns: 0, lastRecoverTurn: -99,
              status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null },
              inventory: [], inventoryCapacity: 0, passives: {}, lanyardUsed: false, bristleconeUsed: false, beliefSummonUsed: false, defeated: false };
            s.actors[actor.id] = actor; s.disclosures[actor.id] = {}; s.knowledge[actor.id] = {};
            if (insightRules) { const deck = insightRules.buildDeck({ key: kind, kind: "dream" }, { seed: s.seed }); s.insight.decks[actor.id] = deck; s.insight.knowledge[actor.id] = insightRules.spawnKnowledge(deck); }
            for (const other of Object.values(s.actors)) if (other.id !== actor.id && other.side !== actor.side) {
              s.knowledge[other.id] ||= {}; s.knowledge[other.id][actor.id] ||= { secondary: false, lens: false, abilities: {} };
              s.knowledge[actor.id][other.id] = { secondary: false, lens: false, abilities: {} };
            }
            s.order.push(actor.id);
            log(s, { kind: "dreamAppear", actor: actor.id, target: a.id, tiles: [tiles[i]], text: `${actor.name} comes through ${a.name}'s Dream Space at (${tiles[i].join(",")}).`, why: [`Belief strength ${a.beliefStrength}/3; ${actor.name} fights with ${conceptName(actor.primary)} and is hostile to every side.`] });
          });
        } else {
          for (const at of tiles) {
            const result = wildRules.summonMonster(wildSnapshot(s), act.kind, at, { summonerId: a.id, reason: `${a.name}'s rare Believer ability` });
            if (result.error) return result.error;
            saveWildWorld(s, result.world);
            for (const ev of result.events) log(s, { kind: "wildAppear", actor: a.id, target: ev.id, tiles: [ev.at], text: `${a.name}'s rare belief calls a ${wildRules.data.monsters[ev.monster].name} into the fight at (${ev.at.join(",")}).`, why: ["Believer: a rare, once-per-battle call; the wild side can threaten any faction."] });
          }
        }
      },
      dreamSpace(s, a, act = {}) {
        if (a.form?.golden) return "The Integrated Self has no need of the dream.";
        if (!dreamSpaceRules) return "Dream Space is unavailable.";
        const knownSelf = (s.self?.traits || []).filter(t => t?.known).length, allSelf = (s.self?.traits || []).length;
        const knowledge = { placeFamiliarity: (a.id==="player"?s.placeObservation:s.placeObservations?.[a.id])?.familiarity || 0, selfKnowledge: allSelf ? knownSelf / allSelf : 0 };
        const vowNo = Vows && Vows.validate("dream", act.vow, a, s.rules.inspiration, s); if (vowNo) return vowNo;   // Vows (Inspiration may pay)
        const born = C.characters[a.character]?.dreamer || {};   // a born dreamer (Sita): less charge, fewer AP, a longer dream
        const openLess = (Vows && act.vow?.boon ? Vows.BOONS[act.vow.boon].effect.openLess || 0 : 0) + (born.openLess || 0);   // Vows: Early Dream
        const opening = H.dreamOpening(s, openLess);   // by night: less charge needed and fewer action points (rules.time)
        const check = dreamSpaceRules.canOpen(a, opening.rules, s.dreamSpace, knowledge, s.arena.objects);
        if (!check.ok) return check.reason;
        const cost = Math.round(opening.ap * (born.apMul ?? 1));
        if (a.tempo < cost) return `Opening a Dream Space needs ${cost} action points.`;
        const spend = spendTempo(s, a, cost, "Open Dream Space"); if (spend) return spend;
        const opened = dreamSpaceRules.open(a, { round: s.round, ...knowledge });
        s.dreamSpace = opened.field;
        Object.assign(a, opened.caster);
        const mods = dreamSpaceRules.modsFor(a, s.dreamSpace, s.arena.objects);
        if (mods.apPerTurnAdd) { a.tempo += mods.apPerTurnAdd; a.tempoCapacity += mods.apPerTurnAdd; }
        log(s, { ...opened.event, kind: "dream_opened" });   // cutscene kind (dreamScenes still matches it)
        H.Inspiration.roll(s, a, "opensDream");
        if (Auras && Auras.foldIn) Auras.foldIn(s, a, auraH());   // Auras: fold the primary in at once (free)
        { const PC = hasTrait(a, "perfectConcentration") ? s.rules.concentration?.perfect : null;   // Perfect Concentration: the dream drains less
          if (PC?.drainLess) s.dreamSpace.drain = Math.max(5, (s.dreamSpace.drain ?? dreamSpaceRules.rules.drainPerCasterTurn) - PC.drainLess); }
        if (born.drainLess) s.dreamSpace.drain = Math.max(5, (s.dreamSpace.drain ?? dreamSpaceRules.rules.drainPerCasterTurn) - born.drainLess);   // a born dreamer's dream holds longer
        if (Vows && act.vow?.boon) {   // Vows: Steady Dream lowers the drain (restored if the vow breaks)
          const eff = Vows.swear(s, a, "dream", act.vow, { log });
          if (eff?.drainLess) { const v = a.vows[a.vows.length - 1]; v.drainBefore = s.dreamSpace.drain; s.dreamSpace.drain = Math.max(5, (s.dreamSpace.drain || 25) - eff.drainLess); }
        }
        log(s, { kind: "dreamSpace", actor: a.id, text: `The space holds for four of your turns. You gain ×${mods.potencyMul} potency, +${mods.pfRegenAdd} ΦF regen, and +${mods.apPerTurnAdd} AP each turn; the ultimate bar is its clock.${knowledge.placeFamiliarity ? ` Place familiarity lowers its required charge and drain (${opened.field.drain}% per turn).` : ""}` });
      },
      blessing(s, a, act) { return Bonds ? Bonds.bless(s, a, act, classH()) || undefined : "Bonds are unavailable."; },   // Bonds: Blessing of Malnote (free)
      terms(s, a, act) {   // Parley: come to terms with someone standing down
        if (!Parley) return "Parley is unavailable.";
        const t = s.actors[act.target], why = Parley.canTerms(s, a, t); if (why) return why;
        const spend = spendTempo(s, a, Parley.rules.termsCost, "Come to terms"); if (spend) return spend;
        Parley.comeToTerms(s, a, t, { log });
      },
      tallySettle(s, a) {   // the ledger boss: pay AP now against the account (engine/tally.js)
        if (!H.Tally) return "There is no account to settle.";
        return H.Tally.settle(s, a) || undefined;
      },
      tallyTerms(s, a, act) {   // the ledger boss's offer: accept or decline (no AP; engine/tally.js)
        if (!H.Tally) return "There are no terms on the table.";
        return H.Tally.answer(s, a, act.target, !!act.accept) || undefined;
      },
      stakes(s, a, act) {   // Ante (W1.5): propose your lot to the enemy leader, round 1, pre-blood. No AP: refusing is free, and so is asking.
        if (!H.antePropose) return "No one holds stakes here.";
        if (a.id !== "player" && !act.fromAi) return "Only the player proposes stakes; the AI answers.";
        if (!Array.isArray(act.lot) || !act.lot.length) return "Stake something.";
        return H.antePropose(s, a, act.lot, H, !!act.conceal) || undefined;
      },
      setIntent(s, a, act) {   // Mystery (Muse W2.5): Techniques ▸ Set — pay now, trigger later. Silent: no announce, no knowledge leak.
        if (!H.mysterySet) return "No mystery here.";
        return H.mysterySet(s, a, act.ability, act.trigger, act.target) || undefined;
      },
      revealIntent(s, a, act) {   // Mystery (Muse W2.5): reveal + fire the oldest manual card (T1+ announce). Free: prepaid at set.
        if (!H.mysteryReveal) return "No mystery here.";
        const why = ["for the kill", "before it fades", "seizes the exchange"].includes(act.why) ? act.why : undefined;   // RIK R1: the AI's three reasons; the UI sends none, so a player reveal reads "revealed by hand"
        return H.mysteryReveal(s, a, act.target, why, why === "seizes the exchange" ? act.exchange : null) || undefined;
      },
      myol(s, a, act) {   // MYOL (W5.3): buy the failed trick back after seeing the roll. No AP; Seeds leave the account in the UI.
        if (!H.myolApply) return "No luck to make here.";
        if (a.id !== "player" && !act.fromAi) return "Only the player buys luck.";   // W5.1: the AI buys through fromAi (stakes precedent)
        const purse = s.seeds ?? 0, cost = H.myolCost(s.myolUses?.[a.id] || 0);   // the battle's own purse when it has one: the UI copies s.seeds to the account after every act
        const no = H.myolEligible(s, a, purse);
        if (no) return no;
        const r = H.myolApply(s, a, H);
        if (r.fizzled) return "The moment passed: nothing left to buy.";
        if (s.seeds != null) s.seeds = Math.max(0, s.seeds - cost);
        return undefined;
      },
      stakeSeeds(s, a, act) {   // Hyper-staking (W5.3): post Seeds on your next trick (imitate/tame). No AP; UI escrows.
        if (!H.stakeBonus) return "No bookmaker here.";
        if (a.id !== "player") return "Only the player stakes.";
        const seeds = Math.floor(act.seeds || 0);
        if (!(seeds >= 5)) return "Stake at least 5 Seeds.";
        if (s.staked) return "A stake already rides your next trick.";
        if (s.seeds != null && s.seeds < seeds) return `You hold ${s.seeds} Seeds.`;
        if (s.seeds != null) s.seeds -= seeds;   // escrowed from the battle's purse (settleStake pays it back on a win)
        s.staked = { actor: a.id, seeds };
        log(s, { kind: "stake", actor: a.id, text: `${a.name} sweats ${seeds} Seeds on the next trick.`, why: ["Win the trick: stake back plus half again (55 mint cap a battle). Lose it: the stake burns."] });
        return undefined;
      },
      doubleDown(s, a) {   // Rhythm of madness (W5.3): cash heat in for charge. Free, heat 2+, once a battle.
        if (!H.gamblerOf || !H.gamblerOf(s, a)) return "Only a gambler doubles down.";
        if (a.id !== "player") return "Only the player doubles down.";
        if (s.doubledDown) return "Doubled down already this battle.";
        const heat = H.heatOf(s, a.id);
        if (heat < 2) return "Build heat first: end turns holding 40+ AP.";
        const gain = heat * H.hyperRules.heat.doubleChargePer;
        a.ultimateCharge = Math.min(s.rules.ultimateChargeMax, (a.ultimateCharge || 0) + gain);
        s.heat[a.id] = 0; s.doubledDown = true;
        log(s, { kind: "double", actor: a.id, text: `${a.name} DOUBLES DOWN: heat ${heat} becomes +${gain} charge.`, why: ["Escalating stakes, cashed at the peak: the heat is spent, not kept."] });
        return undefined;
      },
      answerTerms(s, a, act) {   // Parley: accept or decline a talkative NPC's terms (no AP)
        if (!Parley) return "Parley is unavailable.";
        return Parley.answerOffer(s, a, s.actors[act.target], !!act.accept, { log }) || undefined;
      },
      mediate(s, a, act) {   // a hired mediator asks one enemy for a truce (engine/hires.js)
        return H.Hires.mediate(s, a, act) || undefined;
      },
      order(s, a, act) {   // Talk orders (SPIRIT-ORDER half 2): 10 AP (Speed-Talker halves it) to give an ally a role to weigh for 3 rounds. Refused orders cost only the AP.
        const O = Orders(); if (!O) return "No orders today.";
        const t = s.actors[act.target];
        const spend = spendTempo(s, a, talkCost(a, "talk", s.rules.orders?.ap ?? 10), "Talk"); if (spend) return spend;
        const r = O.issue(s, a, t, act.role, act.focus, H);
        if (!r.ok) { a.tempo += talkCost(a, "talk", s.rules.orders?.ap ?? 10); return r.error; }   // invalid orders refund; refused ones don't
        return;
      },
      parley(s, a, act) {   // Parley: a talkative NPC talks at someone
        if (!Parley) return "Parley is unavailable.";
        if (a.awakened) return "A woken structure does not talk.";
        const t = s.actors[act.target];
        if (!t || t.defeated || H.Instinct.hidden(a, t)) return "There's no one to talk to.";
        const spend = spendTempo(s, a, talkCost(a, "talk", Parley.rules.npcTalkCost), "Talk"); if (spend) return spend;
        if (talkedTooFast(s, a, t, "talk")) { log(s, { kind: "parley", actor: a.id, target: t.id, fizzled: true, text: `${a.name} talks too fast and it goes past ${t.name}.`, why: ["Speed-Talker: half the action points, and it lands 85% as often."] }); return; }
        const out = Parley.npcTalk(s, a, t, { log, MindDuel });
        H.spreadByTalk?.(s, a, t);   // contagious ideas: a carrier's talk is a vector (faith)
        if (out === "talk" && MindDuel) { const opened = MindDuel.openDuel(s, a.id, t.id, { log, Parley }); if (opened) return opened; }
      },
      aura(s, a, act = {}) {   // Auras: toggle the primary concept's ring (auras/auras.js)
        if (!Auras) return "Auras are unavailable.";
        if (a.aura?.burning) return "The burning dream can't be let go; it ends at your next turn.";
        if (s.dreamSpace?.owner === a.id) {   // Auras: burn the folded aura out (the dream ends next turn)
          if (act.vow?.boon || act.vow?.restrictions?.length) return "The Dream Space's opening vows are fixed. Imbuing inherits them; you cannot add or replace vows.";
          const no = Auras.canImbue(s, a); if (no) return no;
          const spend = spendTempo(s, a, Auras.rules.imbueApCost, "Imbue the Dream"); if (spend) return spend;
          Auras.imbue(s, a, auraH());
          log(s,{kind:"vow",actor:a.id,text:"The imbued aura inherits the Dream Space's opening vows; their restrictions remain in force."});
          return;
        }
        if (a.aura) { Auras.dismiss(s, a, auraH(), "let go"); return; }
        const why = Auras.canActivate(s, a) || (Vows && Vows.validate("aura", act.vow, a, s.rules.inspiration, s)); if (why) return why;
        const spend = spendTempo(s, a, Auras.rules.apCost, "Extend Aura"); if (spend) return spend;
        Auras.activate(s, a, auraH());
        if (Vows && act.vow?.boon) Auras.applyVow(s, a, Vows.swear(s, a, "aura", act.vow, { log }));   // Vows
      },
      ritual(s, a, act) {   // C18: begin a capture on a weakened wild monster within 4
        if (a.rite) return "You are already working a rite: one channel at a time.";   // Rites (Muse-2)
        const [tx, ty] = act.at || [];
        // A monster of the mind (a dream creature on the other side) can be taken too (Mala, 2026-10-14: the ritual is
        // meant to tame the monsters that plague the mind). It is an actor, not a wild unit.
        const dreamt = actorAt(s, tx, ty), mind = dreamt && dreamt.dream && !dreamt.defeated && !dreamt.boss && dreamt.side !== a.side && !dreamt.tamed ? dreamt : null;
        // Gaia (Mala, 2026-10-26): the Wounded Ground can be taken too; the ritual binds her as a summon (ritualTick), not a bead.
        const gaia = !mind && dreamt && dreamt.boss === "gaia" && !dreamt.defeated && dreamt.gaiaForm === "disturbed" && dreamt.side !== a.side ? dreamt : null;
        const m = mind || gaia || (s.wild || []).find(w => w.form === "unit" && w.x === tx && w.y === ty);
        if (!m) return dreamt?.boss === "gaia" ? "Gaia answers no chant while she keeps the accord: only the Wounded Ground can be bound." : "There is no monster there to capture.";
        if (m.dream?.source === "brood") {   // a Brood Mite: refused while its mother stands, then takeable at any LF (Mala, 2026-11-01)
          if (!s.actors[m.dream.summoner]?.defeated) return "The brood answers its mother: take one only once she has fallen.";
          if (H.broodHeld(a) >= (s.rules.brood?.maxHeld ?? 4)) return "You already hold as many Brood Mite beads as one hand can keep.";
        } else if (m.lf >= m.maxLF * RITUAL.weakBelow) return `It must be weakened below ${Math.round(RITUAL.weakBelow * 100)}% LF first.`;
        if (a.ritual) return "You are already holding a ritual.";
        if (chanted(s, m.id)) return "Someone is already chanting over it.";
        if (dist(s, a.x, a.y, tx, ty) > RITUAL.range) return `The ritual reaches ${RITUAL.range} tiles.`;
        const spendError = spendTempo(s, a, riteDiscount(s, a, RITUAL.ap), "Capture ritual"); if (spendError) return spendError;
        a.ritual = { monsterId: m.id, turnsLeft: RITUAL.turns, ...(mind ? { mind: true } : {}), ...(gaia ? { gaia: true } : {}) }; if (!mind && !gaia) m.suspended = true;
        (s.captureLog ||= []).push({ actor: a.id, kind: mind ? `dream:${m.dream.key}` : gaia ? "gaia" : m.kind, started: true });
        log(s, { kind: "ritual", actor: a.id, target: m.id, tiles: [[tx, ty]], started: true, text: `${a.name} begins a capture ritual on the ${(m.name || m.kind).toLowerCase()}.`,
          why: [`It hangs suspended: nothing can hit it and it cannot act. Hold still and take no damage for ${RITUAL.turns} of your turns and it becomes a bead.`] });
      },
      forYou(s, a, act) {   // Love, staged (Mala, 2026-10-21): the nova, then a killing self-cost opens a steady rite on the Beloved. Not a concept, and not an announced technique.
        const R = s.rules.love?.forYou;
        if (!R) return "For You is not in this battle (rules.love.forYou).";
        if (act.beloved) {
          const named = s.actors[act.beloved];
          if (!named || named.defeated || named.id === a.id || named.side !== a.side) return "Name a living ally as your Beloved.";
          if (dist(s, a.x, a.y, named.x, named.y) > (R.nameRange ?? 4)) return "Your Beloved must be within 4 tiles to be named.";
          a.bond = { beloved: named.id };
        }
        const beloved = s.actors[a.bond?.beloved];
        if (!beloved || beloved.defeated || beloved.side !== a.side || beloved.id === a.id) return "Name a Beloved first.";
        if (dist(s, a.x, a.y, beloved.x, beloved.y) > (R.bondRange ?? 6)) return "Your Beloved is too far for the bond to carry For You.";
        if (a.lf <= 0) return "You have nothing left to burn.";
        if ((a.pf || 0) < (R.pf ?? 16)) return `For You needs ${R.pf ?? 16} ΦF (have ${a.pf || 0}).`;
        const spend = spendTempo(s, a, R.ap ?? 50, "For You");
        if (spend) return spend;
        a.pf -= R.pf ?? 16;
        const cost = R.selfLf ?? 15;
        a.lf = Math.max(0, a.lf - cost);
        log(s, { kind: "act", actor: a.id, ability: "forYou", tiles: [[beloved.x, beloved.y]], text: `${a.name} burns for ${beloved.name}: ${cost} LF.`, why: ["For You is centered on the Beloved."] });
        const radius = R.radius ?? 3, dmg = R.damage ?? 20, heal = R.heal ?? 12;
        const inst = { ability: "forYou", name: "For You", delivery: "field", damageType: "rubedo", effect: "damage", potency: dmg };
        for (const u of Object.values(s.actors)) {
          if (u.defeated || u.id === a.id) continue;
          if (dist(s, beloved.x, beloved.y, u.x, u.y) > radius) continue;
          if (u.side !== a.side) hit(s, a, u, inst, dmg, ["For You, centered on the Beloved."]);
          else {
            const before = u.lf;
            u.lf = Math.min(u.maxLF, u.lf + heal);
            if (u.lf > before) log(s, { kind: "heal", actor: a.id, target: u.id, text: `${u.name} is mended for ${u.lf - before} LF by For You.` });
          }
        }
        if (a.lf > 0) return;
        if (Parley && Parley.isImmortal(a)) {
          a.defeated = true; a.knockedOut = true; a.tempo = 0; H.pactLeave(s, a); Spirit()?.onDeath?.(s, a, null, H); Orders()?.onDeath?.(s, a, H);   // SP-05: a sacrifice shocks like any death
          log(s, { kind: "defeat", target: a.id, text: `${a.name} is knocked out. Immortal: down, not dead, and no rite begins.` });
          return;
        }
        a.defeated = true; a.defeatedBy = null; a.tempo = 0; H.pactLeave(s, a); Spirit()?.onDeath?.(s, a, null, H); Orders()?.onDeath?.(s, a, H);   // SP-05: a sacrifice shocks like any death
        a.sacrifice = { for: beloved.id, ability: "forYou" };
        log(s, { kind: "defeat", target: a.id, sacrifice: true, text: `${a.name} dies for ${beloved.name}.` });
        H.grantSacrifice(s, beloved, a);
        if (!s.preview) H.Inspiration?.witness(s, a, "seesSacrifice", a.id);
        H.courtWitnessSacrifice?.(s, a);   // a death in sight of the heart steps the court back once
      },
      riteStep(s, a, act) {   // Rites (Muse-2): one section per turn — words (cheap), sigils (locks movement), blood (LF)
        const R = s.rules.rite ?? {};
        if (a.ritual) return "You are already holding a capture ritual: one channel at a time.";
        const rite = a.rite || { steps: [], hold: 0 };
        if (rite.steps.length >= (R.maxSteps ?? 3)) return "The rite is complete at three steps: apply it or abandon it.";
        if (rite.stepTurn === a.ownerTurns || a.riteStepTurn === a.ownerTurns) return "One rite step per turn.";
        const section = act.section;
        const bank = (type) => {
          H.Rites.step(s, a, type);   // L1: the step banks through the ledger; the mirror keeps the gates' shape
          log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name}'s rite holds ${a.rite.steps.length} step${a.rite.steps.length === 1 ? "" : "s"} (bank keeps ${a.rite.hold} turns).` });
        };
        if (section === "words") {
          const spendError = spendTempo(s, a, riteDiscount(s, a, R.wordsAp ?? 10), "Rite: magic words"); if (spendError) return spendError;
          log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} starts chanting: magic words for the rite.` });
          bank("words");
        } else if (section === "sigils") {
          const spendError = spendTempo(s, a, riteDiscount(s, a, R.sigilsAp ?? 25), "Rite: drawn sigils"); if (spendError) return spendError;
          const artist = C.characters?.[a.character]?.subfaction === "ink" || hasTrait(a, "artist");
          if (artist) log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} sketches sigils in a notebook and keeps moving (artist).` });
          else { a.status.lockMove = { label: "Drawing", owner: a.id, expiresAt: a.ownerTurns + 1 }; log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} kneels to draw the ritual circle: no moving for the rest of the turn.` }); }
          bank("sigils");
        } else if (section === "blood" || section === "deep") {
          const deep = section === "deep", ease = s.dreamSpace ? (R.dreamBloodEase ?? 2) : 0;   // blood runs easier in dreams (the dream seam)
          const cost = Math.max(0, (deep ? (R.deepLf ?? 8) : (R.bloodLf ?? 3)) - ease);
          const hands = a.status.bloodyHands?.expiresAt > a.ownerTurns, own = a.status.bleed && (a.status.bleed.until == null || a.status.bleed.until >= a.ownerTurns);
          if (!deep && hands) { a.status.bloodyHands = null; log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} works the enemy's blood from their hands into the rite.` }); }
          else if (!deep && own) log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} feeds their own open wound into the rite.` });
          else {
            if (a.lf <= cost) return `You need more than ${cost} LF to open a vein.`;
            a.lf -= cost;
            if (deep) a.status.bleed = { drain: 2, until: a.ownerTurns + 2 };   // Deep Cut (Mala, 2026-10-20): the wound stays open
            log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: deep ? `${a.name} cuts deep (${cost} LF): the rite drinks willing pain. The wound bleeds (2 LF a turn, 2 turns).` : `${a.name} cuts for the rite (${cost} LF).` });
          }
          bank(deep ? "deep" : "blood");
        } else if (section === "burial") {   // Last Rites (ritual burial): a whole turn beside a body, unless the desert taught you speed
          const no = H.lastRites(s, a, spendTempo); if (no) return no;
          bank("burial");
        } else return "Choose words, sigils, blood, a deep cut, or last rites.";
      },
      riteComplete(s, a, act) {   // Rites (Muse-2): seal banked steps into a shared augment pool; checkboxes pick which techniques draw
        const rite = a.rite;
        if (!rite || !rite.steps.length) return "No rite steps banked.";
        if (a.riteAugment) return "An augment is already active: spend it first.";
        const n = (t) => rite.steps.filter((x) => x.type === t).length;
        const R = s.rules.rite ?? {}, w = n("words"), g0 = n("sigils"), b = n("blood") + n("deep"), sac = n("sacrifice"), burn = n("burn"), call = n("call");
        const bleedRider = (R.bleedRiderByBlood ?? [0, 0, 2, 6])[Math.min(b, 3)] ?? 0;
        const sacPay = R.sacrifice || { potency: 16, charges: 2 };
        a.riteAugment = {
          potencyAdd: w * (R.wordsPotency ?? 2) + (w >= 3 ? (R.wordsTripleBonus ?? 4) : 0) + n("burial") * (R.burial?.potency ?? 8) + sac * (sacPay.potency ?? 16) + burn * (R.burnPotency ?? 4),
          rangeAdd: g0 * (R.sigilsRange ?? 1) + (g0 >= 3 ? (R.sigilsTripleBonus ?? 3) : 0),
          piercing: b > 0 || sac > 0, bleedRider, charges: Math.min(4, rite.steps.length + n("deep") + call * (R.callCharges ?? 1) + sac * ((sacPay.charges ?? 2) - 1)), checked: {},
        };
        const g = a.riteAugment;
        const dreamFed = s.dreamSpace ? (R.dreamSealBonus ?? 1) : 0;   // rites burn brighter in dreams (Muse-2: the dream seam)
        if (dreamFed) g.charges += dreamFed;
        let ally = false, plant = false;
        for (const u of Object.values(s.actors)) {
          if (!u || u.id === a.id || u.defeated || (u.lf ?? 0) <= 0 || dist(s, a.x, a.y, u.x, u.y) !== 1) continue;
          if (u.communed) plant = true; else if (u.side === a.side) ally = true;
        }
        const witness = ally ? (R.witnessCharge ?? 1) : 0;
        if (witness) g.charges += witness;
        const rainId = s.weatherState?.id, wet = rainId === "rain" || rainId === "squall" || !!Climate?.data?.weather?.[rainId]?.rain;
        const ground = (tileAt(s, a.x, a.y).tags || []).includes("soil") || wet;
        if (ground) g.potencyAdd += (R.groundPotency ?? 2);
        if (plant) g.plantMend = R.plantMend ?? 4;
        H.Rites.clear(s, a);   // L1: the seal empties the ledger record with the mirror
        log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} seals the rite: ${g.charges} charge${g.charges === 1 ? "" : "s"}${g.potencyAdd ? `, +${g.potencyAdd} potency` : ""}${g.rangeAdd ? `, +${g.rangeAdd} range` : ""}${g.piercing ? ", piercing" : ""}${g.bleedRider ? `, ${g.bleedRider} bleed` : ""}. Check techniques to spend them.${dreamFed ? " The dream feeds the rite." : ""}${witness ? " Someone beside them witnesses it." : ""}${ground ? " The ground feeds it." : ""}${plant ? " A communed plant leans in." : ""}` });
      },
      riteToggle(s, a, act) {   // Rites (Muse-2): checkbox — this technique draws from the augment pool or not
        const g = a.riteAugment;
        if (!g || g.charges <= 0) return "No active augment to apply.";
        if (!abilitiesOf(a).includes(act.ability)) return "Choose one of your techniques.";
        if (!H.riteDraws(ab(act.ability))) return "Striking techniques only.";
        const m = manifest(s, a, act.ability);
        g.checked[act.ability] = !g.checked[act.ability];
        log(s, { kind: "ritual", actor: a.id, text: g.checked[act.ability] ? `${m.name} will draw from the rite (${g.charges} charge${g.charges === 1 ? "" : "s"} left).` : `${m.name} no longer draws from the rite.` });
      },
      riteAbandon(s, a) {
        if (!a.rite) return "No rite in progress.";
        endRite(s, a, "abandoned");
      },
      visitorRitual(s, a, act) {   // Intergalactic visitors P1: a grey begins the retrieval chant over the specimen
        if (!H.Visitors) return "The visitors are not here.";
        const err = H.Visitors.canChant(s, a, act.target, { chanted, dist, RITUAL });
        if (err) return err;
        const spendError = spendTempo(s, a, RITUAL.ap, "Retrieval chant"); if (spendError) return spendError;
        H.Visitors.chant(s, a, act.target, { log });
      },
      bead(s, a, act) {   // C18: release a bead on an adjacent open tile
        const beads = a.beads || [], bead = beads[act.index ?? 0]; if (!bead) return "You have no bead to release.";
        const [tx, ty] = act.at || [];
        if (!inside(s, tx, ty) || Math.max(Math.abs(a.x - tx), Math.abs(a.y - ty)) > 1 || (tx === a.x && ty === a.y)) return "Release the bead on a tile beside you.";
        if (actorAt(s, tx, ty) || tileAt(s, tx, ty).blocksMove || (s.wild || []).some(w => w.form === "unit" && w.x === tx && w.y === ty)) return "That tile is not open.";
        const spendError = spendTempo(s, a, RITUAL.beadAp, "Release bead"); if (spendError) return spendError;
        beads.splice(beads.indexOf(bead), 1);
        const beast = beadBeast(s, a, bead, [tx, ty]);
        (s.captureLog ||= []).push({ actor: a.id, released: beast.id, kind: bead.kind, lf: beast.lf });
        log(s, { kind: "summon", actor: beast.id, target: a.id, tiles: [[tx, ty]], bead: true, text: beast.tamed ? `${beast.name} steps out of the bead at (${tx},${ty}) with ${beast.lf} LF, tamed: it fights for ${a.name} for the rest of the battle.` : `${beast.name} bursts from the bead at (${tx},${ty}) with ${beast.lf} LF. It stays ${RITUAL.beadTurns} turns.` });
      },
      callBeast(s, a, act) {   // a creature learned by swallowing its beads (account/beads.js): called like a released bead, once a battle each
        const learned = (a.beastSummons || []).find((b) => b.key === act.key); if (!learned) return "You have not learned that creature: swallow its beads in the Field Kit.";
        const once = `${a.id}:${learned.key}`; if ((s.beastCalled ||= {})[once]) return `${learned.name} has answered once this battle already.`;
        const [tx, ty] = act.at || [];
        if (!inside(s, tx, ty) || Math.max(Math.abs(a.x - tx), Math.abs(a.y - ty)) > 1 || (tx === a.x && ty === a.y)) return "Call it to a tile beside you.";
        if (actorAt(s, tx, ty) || tileAt(s, tx, ty).blocksMove || (s.wild || []).some(w => w.form === "unit" && w.x === tx && w.y === ty)) return "That tile is not open.";
        const cost = summonRules ? summonProfile(s, a.id) : { apCost: 80, phiCost: 8 };   // the price of any summon
        if (a.tempo < cost.apCost) return `Calling needs ${cost.apCost} action points.`;
        if (a.pf < cost.phiCost) return `Calling needs ${cost.phiCost} ΦF.`;
        const spend = spendTempo(s, a, cost.apCost, `Call ${learned.name}`); if (spend) return spend;
        a.pf -= cost.phiCost; s.beastCalled[once] = true;
        const beast = beadBeast(s, a, learned, [tx, ty]);
        log(s, { kind: "summon", actor: beast.id, target: a.id, tiles: [[tx, ty]], bead: true, text: `${a.name} calls ${beast.name}, learned from swallowed beads: it answers at (${tx},${ty}) with ${beast.lf} LF${beast.tamed ? " and fights for the rest of the battle" : ` for ${RITUAL.beadTurns} turns`}.` });
      },
      callDream(s, a, act) {   // D2: a player-side caller spends an unlocked dream (no question; the enemy 50/6/3 price)
        if (a.form?.golden) return "The Integrated Self has no need to summon.";
        if (!summonRules || !dreamSpaceRules?.makeEnemyDreamActor) return "Summoning is unavailable.";
        if (!summonRules.callsPalace(a)) return "Only the player's side calls dreams.";
        const bare = typeof act.key === "string" && act.key.startsWith("enemyDream:") ? act.key.slice(11) : null;
        const def = bare ? dreamSpaceRules.enemyMonsterPool(99, [bare])[bare] : null;
        if (!def || def.broodOnly) return "No such dream.";
        if (!(act.unlocked || []).includes(act.key)) return `${def.name} has not joined you: unlock it first.`;
        const once = `${a.id}:${bare}`; if ((s.dreamUsed ||= {})[once]) return `${def.name} has answered once this battle already.`;
        const profile = summonProfile(s, a.id);
        if (profile.active.length >= profile.maxActive) return profile.maxActive === 1 ? "Another summon is already on the field." : `Your ${profile.maxActive} summon slots are already occupied.`;
        const cost = s.rules.enemySummons;
        if (a.tempo < cost.apCost) return `Calling needs ${cost.apCost} action points.`;
        if (a.pf < cost.phiCost) return `Calling needs ${cost.phiCost} ΦF.`;
        const tileH = { inside, dist, barrierAt, dreamSame, actorAt, tileAt };
        if (act.at && !EnemySummons.openTile(s, a, act.at, tileH)) return "Choose an open tile 2–4 spaces away, inside the caller's Dream Space region.";
        let at = act.at || null;
        if (!at) for (let y = 0; y < s.arena.h && !at; y++) for (let x = 0; x < s.arena.w && !at; x++)
          if (EnemySummons.openTile(s, a, [x, y], tileH)) at = [x, y];
        if (!at) return "The veil yields no foothold.";
        const spend = spendTempo(s, a, cost.apCost, `Call ${def.name}`); if (spend) return spend;
        a.pf -= cost.phiCost; s.dreamUsed[once] = true;
        const raw = dreamSpaceRules.makeEnemyDreamActor(bare, { at, round: s.round, summoner: a.id, id: `dream-${bare}-call-${a.id}` });
        const actor = { ...raw, side: a.side, sprite: `dream-${bare}`, ai: "dream", controller: "ai", traits: [],   // uncontrolled familiars (Mala 2026-11-05): every called dream is monster-driven, never human-driven; the zombie's mindlessness is its drawback, not its controller
          pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, level: 1, xp: 0, proficiency: 1,
          reserve: [], reserveSlots: 0, pendingSwap: null, lens: {}, reaction: s.rules.reactionsPerRound,
          moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0,
          tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false, ownerTurns: 0, lastRecoverTurn: -99,
          status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null },
          inventory: [], inventoryCapacity: 0, passives: {}, lanyardUsed: false, bristleconeUsed: false,
          beliefSummonUsed: false, defeated: false,
          summonBinding: { owner: a.id, groupKey: bare, turnsLeft: cost.turns, lastTickTurn: -1, expired: false, solo: true } };
        s.actors[actor.id] = actor;
        s.disclosures[actor.id] = {}; s.knowledge[actor.id] = {}; s.observedAbilities[actor.id] = [];
        if (insightRules) {
          const deck = insightRules.buildDeck({ key: bare, kind: "dream" }, { seed: s.seed });
          s.insight.decks[actor.id] = deck; s.insight.knowledge[actor.id] = insightRules.spawnKnowledge(deck);
        }
        for (const other of Object.values(s.actors)) if (other.id !== actor.id && other.side !== actor.side) {
          (s.knowledge[other.id] ||= {})[actor.id] = { secondary: false, lens: false, abilities: {} };
          s.knowledge[actor.id][other.id] = { secondary: false, lens: false, abilities: {} };
        }
        s.order.push(actor.id);
        EmergentIdeas?.refreshSummonWard(s, actor);
        log(s, { kind: "dreamAppear", actor: actor.id, target: a.id, tiles: [at],
          text: `${a.name} calls ${actor.name} from their unlocked dreams: ${cost.apCost} AP, ${cost.phiCost} ΦF, ${cost.turns} turns.`,
          why: [`${def.name} answers once a battle.`, "Fights for the caller's side, retaining its monster rules and drawbacks, including the zombie's mindless targeting."] });
      },
      imitate(s, a, act) {   // C11: take on a psychology or values trait you have found (or, for the AI, seen demonstrated)
        if (!Imitation || !insightRules?.imitable) return "Imitation is unavailable.";
        const t = s.actors[act.target]; if (!t || t.defeated || t.id === a.id) return "There is no one there to imitate.";
        const mine = (a.controller === "player" || a.id === "player");
        const shown = demonstratedTraits(s, t.id), known = mine ? (s.insight?.knowledge?.[a.id]?.[t.id]?.revealed || []).map(id => s.insight.decks[t.id]?.cards.find(c => c.id === id)?.trait).filter(Boolean) : shown;
        const open = (s.insight?.decks?.[t.id]?.cards || []).filter(c => c.kind === "trait" && c.open).map(c => c.trait);
        const candidates = [...new Set([...known, ...(mine ? open : [])])].filter(id => insightRules.imitable(id) && hasTrait(t, id));
        const trait = act.trait || candidates.find(id => !hasTrait(a, id));
        if (!trait || !candidates.includes(trait)) return mine ? "Find a trait of theirs first (Observe); only what you have seen in them can be imitated." : "No imitable trait demonstrated yet.";
        if (!insightRules.imitable(trait)) return "That is in the body, not the mind: it cannot be imitated.";
        const temp = a.tempTraits?.[trait], carried = (s.imitation?.carried || []).includes(trait);
        if (hasTrait(a, trait) && !temp && !(a.id === "player" && carried)) return `${a.name} already has that trait.`;
        if ((s.imitated || []).some(e => e.actor === a.id && e.trait === trait)) return "You have already practised that this battle.";
        const spendError = spendTempo(s, a, Imitation.rules.ap, "Imitate"); if (spendError) return spendError;
        const dyn = insightRules.dynamicsOf(trait), difficulty = insightRules.data.imitateDifficulty(trait) || 1, demonstrated = shown.includes(trait);
        const counters = dyn.counters.filter(id => hasTrait(a, id)).length, synergies = dyn.synergies.filter(id => hasTrait(a, id)).length;
        const heat = H.heatBonus ? H.heatBonus(s, a) : 0, staked = H.stakeBonus ? H.stakeBonus(s, a) : 0;   // W5.3: heat rides free, stakes ride prepaid
        const luck = H.luckBonus ? H.luckBonus(s, a) : 0;   // W5.1 rhythm: the gambler's beat
        let p = Math.min(1, Imitation.chance({ difficulty, counters, synergies, demonstrated }) + luck);
        if (luck) p = Math.min(0.95, Math.max(0.05, p));   // rhythm clamps 5–95; heat/staked ride on top uncompressed
        p = Math.min(1, p + heat + staked);
        const name = insightRules.data.traits[trait]?.name || trait;
        s.imitateN = (s.imitateN || 0) + 1;
        const roll = seededChance(`${s.seed}:imitate:${a.id}:${trait}:${s.imitateN}`), ok = roll < p;
        if (H.noteLuck) H.noteLuck(s, a, ok);
        const why = [`${Math.round(p * 100)}% chance: difficulty ${difficulty}${counters ? `, ${counters} of your traits pull against it` : ""}${synergies ? `, ${synergies} of your traits help` : ""}${demonstrated ? ", and you have watched them act on it" : ""}${heat ? `, heat +${Math.round(heat * 100)}%` : ""}${staked ? `, staked +${Math.round(staked * 100)}%` : ""}${luck ? `, luck ${luck > 0 ? "+" : ""}${Math.round(luck * 100)}%` : ""}.`];
        if (H.settleStake) H.settleStake(s, ok);
        if (!ok) { if (H.recordRoll) H.recordRoll(s, { kind: "imitate", actor: a.id, target: t.id, trait, p, roll }); log(s, { kind: "imitate", actor: a.id, target: t.id, trait, ok: false, text: `${a.name} tries to take on ${t.name}'s ${name} and it does not fit yet.`, why }); return; }
        imitateComplete(s, a, t, trait, p, why);
      },
      meditate(s, a) {   // C15: 40 AP for ultimate charge. Once per turn, any number of turns running, and no Guard in the same turn.
        if (a.ultimateCharge >= s.rules.ultimateChargeMax) return "Ultimate charge is already full.";
        if (a.lastMeditateTurn === a.ownerTurns) return "Already meditated this turn.";
        if (a.guardUsedThisTurn) return "You cannot Meditate in a turn you have Guarded.";
        const spendError = spendTempo(s, a, MED.ap, "Meditate"); if (spendError) return spendError;
        a.lastMeditateTurn = a.ownerTurns; a.meditateNoGuard = a.ownerTurns;
        const contemplative = hasTrait(a, "contemplative"), restless = hasTrait(a, "restless"), before = a.ultimateCharge;
        const PC = hasTrait(a, "perfectConcentration") ? s.rules.concentration?.perfect : null;   // Perfect Concentration meditates deeply
        a.ultimateCharge = Math.min(s.rules.ultimateChargeMax, before + (PC ? (contemplative ? PC.withContemplative : PC.meditateGain) : contemplative ? MED.contemplativeGain : restless ? MED.restlessGain : MED.gain));
        (s.meditateLog ||= []).push({ actor: a.id, round: s.round, gain: a.ultimateCharge - before, contemplative, restless });
        log(s, { kind: "charge", actor: a.id, meditate: true, text: `${a.name} meditates: +${a.ultimateCharge - before} ultimate charge (${a.ultimateCharge}/${s.rules.ultimateChargeMax}).`,
          why: ["No Guard in a turn spent meditating; every turn may hold one stillness.", ...(contemplative ? ["Contemplative: a deeper stillness (+35)."] : restless ? ["Restless: cannot settle (+15)."] : [])] });
        hermitCharge(s, a, "meditate");   // Sleep Plenty: bonus on top of the normal gain
      },
      recoverWater(s,a) {
        const option=H.waterRecovery(s,a);
        if(!option?.allowed)return "You must reach dry ground to stop drowning here.";
        const error=spendTempo(s,a,option.cost,option.label);if(error)return error;
        a.status.drowning=null;a.waterContact=H.key(a.x,a.y);a.waterSafeAt=a.waterContact;
        H.log(s,{kind:"drowning",actor:a.id,target:a.id,text:`${a.name}: ${option.label.toLowerCase()}; drowning stops.`,why:[`${option.cost} AP paid on their own turn.`]});
      },
      guard(s, a) {
        if (a.guardUsedThisTurn) return "Guard is already set for this turn.";
        if (a.meditateNoGuard === a.ownerTurns) return "You cannot Guard in a turn spent meditating.";
        if (Vows) { const no = Vows.refuses(s, a, "guard"); if (no) return no; }   // Vows: Open Guard
        const cost = s.rules.actionCosts.guard, before = a.tempo;
        const spendError = spendTempo(s, a, cost, "Guard"); if (spendError) return spendError;
        const fraction = before / Math.max(1, a.tempoCapacity);
        const reduction = Math.max(s.rules.guardReduction.min, Math.min(s.rules.guardReduction.max, s.rules.guardReduction.min + (s.rules.guardReduction.max - s.rules.guardReduction.min) * fraction));
        const multiplier = 1 - reduction; a.guardUsedThisTurn = true;
        a.status.guard = { label: "Guard", owner: a.id, expiresAt: a.ownerTurns + 1, multiplier };
        if (a.status.overwatch) { a.status.overwatch = null; log(s, { kind: "effect", actor: a.id, text: `${a.name} drops the watch to guard.` }); }   // Overwatch (Muse-2): guarding ends the watch
        log(s, { kind: "act", actor: a.id, text: `${a.name} guards: ${Math.round(reduction * 100)}% incoming LF reduction (×${multiplier.toFixed(2)}), scaling with tempo remaining, until their next turn start.` });
        if (Bonds) Bonds.afterGuard(s, a, classH());   // Bonds: Always by Your Side
        hermitCharge(s, a, "guard");   // Blocking
      },
      overwatch(s, a) {   // Overwatch (Muse-2): spend the reaction on your turn; the first foe to enter range before your next turn eats a snapshot. No Guard or dodge while watching.
        if ((a.reaction ?? 0) <= 0) return `${a.name} has no reaction left to spend on Overwatch.`;
        if (a.status.overwatch?.expiresAt > a.ownerTurns) return `${a.name} is already watching.`;
        const OW = s.rules.overwatch ?? { ap: 10, range: 4, potency: 8, owed: 25 };
        const spendError = spendTempo(s, a, OW.ap, "Overwatch"); if (spendError) return spendError;
        a.reaction -= 1;
        if (a.status.guard) { a.status.guard = null; log(s, { kind: "effect", actor: a.id, text: `${a.name} drops the guard to watch.` }); }
        a.status.overwatch = { label: "Overwatch", owner: a.id, range: OW.range, potency: OW.potency, owed: OW.owed, expiresAt: a.ownerTurns + 1 };
        log(s, { kind: "act", actor: a.id, text: `${a.name} takes Overwatch (range ${OW.range}): the first foe to step inside before their next turn eats a snapshot. No Guard or dodge while watching.` });
      },
      disengage(s, a) {   // provisional 15 AP: the rest of this turn, leaving a reach draws no opportunity attack
        if (a.disengageTurn === a.ownerTurns) return "Already disengaged this turn.";
        const cost = s.rules.opportunity?.disengageAp ?? 15;
        const spendError = spendTempo(s, a, cost, "Disengage"); if (spendError) return spendError;
        a.disengageTurn = a.ownerTurns;
        log(s, { kind: "act", actor: a.id, text: `${a.name} disengages (${cost} AP): leaving a reach this turn draws no swing.` });
      },
      cower(s, a) {   // interactions (Muse-2): a cornered routed unit guards instead of ending the turn bare
        if (!a.routed) return `${a.name} is not routed.`;
        if (a.guardUsedThisTurn) return "Guard is already set for this turn.";
        const spendError = spendTempo(s, a, s.rules.actionCosts.guard, "Cower"); if (spendError) return spendError;
        a.guardUsedThisTurn = true;
        a.status.guard = { label: "Cower", owner: a.id, expiresAt: a.ownerTurns + 1 };
        log(s, { kind: "act", actor: a.id, text: `${a.name} cowers: nowhere left to run, so they cover up (Guard until their next turn start).` });
      },
      recover(s, a) {
        if (a.tempo < s.rules.actionCosts.utility) return `Recover needs ${s.rules.actionCosts.utility} action points.`;
        if (a.lastRecoverTurn >= a.ownerTurns - s.rules.recover.cooldownTurns) return "Recover can't be used on consecutive turns.";
        if (a.pf >= a.maxPF) return "ΦF is already full.";
        spendTempo(s, a, s.rules.actionCosts.utility, "Recover"); a.lastRecoverTurn = a.ownerTurns;
        const before = a.pf; a.pf = Math.min(a.maxPF, a.pf + s.rules.recover.amount);
        log(s, { kind: "act", actor: a.id, text: `${a.name} recovers ${a.pf - before} ΦF (${a.pf}/${a.maxPF}). Not again next turn.` });
      },
      plantOrgonite(s, a, act) {
        const O = OG(); if (!O) return "Orgonite is unavailable.";
        const at = act.at || [];
        const no = O.plantError(s, a, at); if (no) return no;
        const spend = spendTempo(s, a, O.RULES.ap, O.COPY.plant); if (spend) return spend;
        s.orgonite = s.orgonite || { player: 0, enemy: 0 };
        s.orgonite[a.side] = Math.max(0, (s.orgonite[a.side] || 0) - 1);
        s.arena.objects.push(O.makeTower(s, a, at[0], at[1]));
        log(s, { kind: "build", actor: a.id, tiles: [at], text: `${a.name} plants an ${O.RULES.name} at (${at[0]},${at[1]}) (${O.RULES.hp} HP).`, why: [O.COPY.help] });
      },
      catchFish(s, a, act) {   // dream fish (engine/conditions.js fishRound): from beside the water, or standing in it
        const R = s.rules.fish; if (!R) return "There are no fish in this battle.";
        const f = H.fishNear(s, a).find((x) => !act.at || (x.x === act.at[0] && x.y === act.at[1])); if (!f) return "Stand beside a fish in the water.";
        if (a.tempo < R.catchAp) return `Catching a fish takes ${R.catchAp} action points.`;
        spendTempo(s, a, R.catchAp, "Catch a fish"); s.fish = s.fish.filter((x) => x.id !== f.id);
        const room = (a.inventory || []).length < (a.inventoryCapacity ?? 2);
        if (room && !act.eat) { (a.inventory ||= []).push("dreamFish"); log(s, { kind: "item", actor: a.id, tiles: [[f.x, f.y]], text: `${a.name} catches a dream fish (in the pack: eat it for +${R.ultCharge} ultimate charge).` }); }
        else { const before = a.ultimateCharge || 0; a.ultimateCharge = Math.min(s.rules.ultimateChargeMax, before + R.ultCharge);
          log(s, { kind: "item", actor: a.id, tiles: [[f.x, f.y]], text: `${a.name} catches a dream fish and eats it: +${a.ultimateCharge - before} ultimate charge.` }); }
      },
      journalFinding(s,a,act) {
        const option=H.Observation.findingNoteOptions(s,a).find(f=>f.id===act.fact);
        if(!option)return "Choose a current finding you know and have not recorded this battle.";
        if(!(a.reaction>0))return "Recording a finding spends your reaction.";
        a.reaction--;
        const fact=s.findings.facts[act.fact];
        (s.findingNotes ||= []).push({...clone(fact),via:option.source.via,viaName:option.source.viaName,notedRound:s.round});
        log(s,{kind:"findingNote",actor:a.id,fact:act.fact,text:`${a.name} records: ${fact.text}`,why:["A field note preserves the finding and its source; it does not grant technique practice or mastery."]});
      },
      journalNote(s, a, act) {   // the journal (cultural legacy): a reaction spent noting a foe's technique you saw
        const opt = H.journalOptions(s, a).find((o) => o.technique === act.technique);
        if (!opt) return "Note a technique a foe used this battle, from someone still in sight (once per technique a round).";
        if (!(a.reaction > 0)) return "Taking notes spends your reaction, and it is already spent this round.";
        a.reaction -= 1; (s.journalNotes ||= []).push({ technique: opt.technique, name: opt.name, round: s.round, quality: 1 });
        log(s, { kind: "effect", actor: a.id, text: `${a.name} notes ${opt.name} in the journal.`, why: ["Three notes complete a study (the Magistrate's Codex)."] });
      },
      investigate(s, a, act) {   // Investigate (spec INVESTIGATE.md): all remaining AP on one look, deepest first; the turn ends and the reaction is spent
        if (act.place || act.object) return deepLook(s, a, act);   // I3: the place, a plant or a structure instead of a character
        if (!H.Observation.eligible(a) && !(a.summon && !a.defeated && !a.notArrived)) return "This unit cannot Investigate.";   // a summon may Investigate (Mala, 2026-10-31); the AI never picks it for one
        if (!insightRules?.investigate) return "Investigate is unavailable.";
        const V = insightRules.data.rules.investigate;
        const t = s.actors[act.target]; if (!t || t.id === a.id || t.defeated) return "Choose another living character to Investigate.";
        if (t.form?.golden || (t.form?.learned && hasTrait(t, "faceless"))) return `${t.name} has no features to read: there is nothing to Investigate.`;
        const woundTax = (H.Injury?.gradeOf(a, "head") || 0) === 1 ? (s.rules.injury?.headWoundedObserveAp ?? 10) : 0;   // a wounded head thinks slowly: Investigate pays the same tax as Observe (Mala, 2026-10-31: "you have to think to investigate")
        if (a.tempo < V.minAP + woundTax) return `Investigate needs at least ${V.minAP + woundTax} AP${woundTax ? ` (${woundTax} more with a wounded head)` : ""}. It spends everything you have left.`;
        if (H.heldCostMul && H.heldCostMul(s, a) !== 1) return "You can't Investigate while held: every action costs more than the AP you have left.";   // it spends all AP, so a cost multiplier can never be paid
        if (!hasSight(s, a.x, a.y, t.x, t.y)) return "You need a clear line of sight to Investigate.";
        const bySubject = H.Observation.knowledge(s, a, true);
        const know = bySubject[t.id] || insightRules.spawnKnowledge(s.insight.decks[t.id]);
        const spent = a.tempo, ap = spent - woundTax;   // current AP only: never tempo debt, overclock, a Survey Flag or a codex look; a wounded head loses the tax from the study, not from the spend
        const detail = a.focus?.target === t.id && (a.focus.expiresAt ?? 0) > a.ownerTurns && a.focus.detail;   // retained detail: +1 point free, as Observe
        let result = insightRules.investigate({ focusPointBonus: (hasTrait(a, "perfectConcentration") ? s.rules.concentration?.perfect?.observePoints || 0 : 0) + (detail ? 1 : 0), demonstrated: demonstratedTraits(s, t.id), demonstratedBonus: REVEAL.observeBonus, deck: s.insight.decks[t.id], know, cognitive: H.Observation.cognitive(s, a), subjectKey: t.id, ap, name: t.name, focusKind: act.focus || null, directorsVision: hasTrait(a, "directorsVision"),
          visualPointBonus: (hasTrait(a, "twentyTwentyVision") ? insightRules.data.rules.observe.twentyTwentyBonus : 0) + (hasTrait(a, "spiritSight") ? 1 : 0),
          shared: s.scoutShare?.[a.id]?.[t.id] || 0, seesSpirits: insightRules.seesSpirits(a) });
        // I4b (INVESTIGATE.md 11.2): Investigate also reads the target's face-down cards, technique and trigger, without
        // firing any, and the duel partner's concealed lot. Unread ones are something left to find, so they lift the
        // empty-deck refusal (that one only). A card or lot already read is not read again.
        const mine = s.findings?.holders?.[a.id] || {}, words = s.rules.mystery?.triggerWords || {};
        const down = (H.mysteryUnitView?.(s, t.id) || []).map((c, i) => ({ ...c, id: `facedown:${t.id}:${c.n ?? `i${i}`}:${c.kind === "card" ? `card:${c.cardId}` : c.ability}:${c.trigger}` })).filter((c) => !mine[c.id]);   // one id per card (its set number n), so twins are each read and a re-set card is a new read
        const lot = s.stakes?.faceDown && s.stakes.state === "agreed" && s.stakes.leaderId === t.id && !mine[`lot:${t.id}`] ? (s.stakes.foeLot || []) : null;
        if (result.error && !(result.empty && (down.length || lot))) return result.error;
        if (result.error) result = { know, cognitive: result.cognitive, revealed: [], unlocked: [], lines: [] };
        const spend = spendTempo(s, a, spent, "Investigate"); if (spend) return spend;
        for (const c of down) {
          const text = `${t.name} is holding ${c.name}, set to fire ${words[c.trigger] || c.trigger}.`;
          H.Observation.recordFact(s, a, { id: c.id, kind: "facedown", subject: t.id, n: c.n, ability: c.ability || null, cardId: c.cardId || null, trigger: c.trigger, text }, "investigate");
          result.lines.push(text);
        }
        if (lot) {
          const text = `${t.name}'s concealed lot: ${lot.map((it) => it.kind).join(", ") || "nothing"}.`;
          H.Observation.recordFact(s, a, { id: `lot:${t.id}`, kind: "lot", subject: t.id, text }, "investigate");
          result.lines.push(text);
        }
        observedFx(s, a, t);   // only once the look is paid for: a refused Investigate shows nothing
        if (detail) { a.focus.detail = false; log(s, { kind: "observe", actor: a.id, target: t.id, text: `${a.name}'s retained detail on ${t.name} adds +1 point to the study.` }); }
        observeTail(s, a, t, result, { bySubject, invest: ap, free: false, aiText: `${a.name} studies ${t.name} closely, and ends the turn.` });
        { const wheelNote = H.wheelhouseName?.(s, t); if (wheelNote) log(s, { kind: "observe", actor: a.id, target: t.id, text: wheelNote }); }
        a.tempo = 0; a.reaction = 0; a.absorbedRound = s.round;   // Absorbed: no reaction until the next round starts (turns.js resets it)
        log(s, { kind: "tempo", actor: a.id, text: `${a.name} is absorbed: no reaction until next round.` });
        if (!s.outcome && currentId(s) === a.id) endTurn(s);
      },
      observe(s, a, act) {
        if (!H.Observation.eligible(a)) return "This unit cannot Observe.";
        const freeSurvey = a.id === "player" && s.surveyFlag, freeCodex = (a.codexObserve || 0) > 0, free = freeSurvey || freeCodex;
        const spendFree = () => { if (freeSurvey && s.surveyFlag) s.surveyFlag--; else if (a.codexObserve > 0) { a.codexObserve--; log(s, { kind: "observe", actor: a.id, text: "The codex is open: this Observe is free." }); } };   // Wizard's codex: survey flag spends first
        const woundTax = (H.Injury?.gradeOf(a, "head") || 0) === 1 ? (s.rules.injury?.headWoundedObserveAp ?? 10) : 0;
        if (a.tempo < s.rules.actionCosts.utility + woundTax && !free) return `Observe needs ${s.rules.actionCosts.utility + woundTax} action points.`;
        const t = s.actors[act.target]; if (!t || t.id === a.id || t.defeated || (!insightRules && t.side === a.side)) return "Choose another living character to Observe.";
        if (t.form?.golden || (t.form?.learned && hasTrait(t, "faceless"))) return `${t.name} has no features to read: there is nothing to Observe.`;   // Featureless (the Integrated Self) and Faceless
        observedFx(s, a, t);
        if (insightRules) {
          const investBase = Math.max(10, Math.min(50, Math.floor((act.invest || 20) / 10) * 10));
          const invest = hasTrait(a, "directorsVision") ? Math.max(5, investBase - 5) : investBase;   // Director's Vision: studies cost 5 less
          const detail = a.focus?.target === t.id && (a.focus.expiresAt ?? 0) > a.ownerTurns && a.focus.detail;   // retained detail: +1 point free
          if (a.tempo < invest + woundTax && !free) return `Observe needs ${invest + woundTax} action points.`;
          if (!hasSight(s, a.x, a.y, t.x, t.y)) return "You need a clear line of sight to Observe.";
          const bySubject = H.Observation.knowledge(s,a,true);
          const know = bySubject[t.id] || insightRules.spawnKnowledge(s.insight.decks[t.id]);
          // Perfect Memory (the Cyborg form): what he has already Observed stays known. Looking again at a subject with
          // nothing left to learn costs nothing and adds nothing. It reveals no fact he has not observed.
          if (hasTrait(a, "perfectMemory") && bySubject[t.id] && (s.insight.decks[t.id]?.cards || []).length && s.insight.decks[t.id].cards.every((o) => o.deep || know.revealed.includes(o.id))) {
            log(s, { kind: "observe", actor: a.id, target: t.id, free: true, text: `${a.name} already holds everything there is to see in ${t.name}. Perfect Memory: no action points spent.`, why: ["A fact already Observed in this battle stays known; observing it again costs 0 AP and adds nothing."] });
            return;
          }
          const snap = { round: s.round, units: Object.values(s.actors), wild: s.wild, playerSeeds: s.seeds || 0,
            alliesOf: Object.fromEntries(Object.values(s.actors).map((u) => [u.id, Object.values(s.actors).filter((v) => v.side === u.side && v.id !== u.id && !v.defeated).map((v) => v.id)])),
            fire: s.arena.map.some((row) => row.includes("f")) };
          const result = insightRules.observe({ focusPointBonus: hasTrait(a, "perfectConcentration") ? s.rules.concentration?.perfect?.observePoints || 0 : 0, dreamerPointBonus: hasTrait(a, "trepanation") ? dreamSpaceRules?.modsFor(a, s.dreamSpace, s.arena.objects)?.dreamObservePointBonus || 0 : 0,   /* TP-02: only the hole reads the extra point; plain dreamers (casterMods also carries 1) are unchanged */ demonstrated: demonstratedTraits(s, t.id), demonstratedBonus: REVEAL.observeBonus, deck: s.insight.decks[t.id], know, cognitive: H.Observation.cognitive(s,a), subjectKey: t.id, invest: invest + (detail ? 10 : 0), inDreamSpace: !!s.dreamSpace && dreamSpaceRules.contains(s.dreamSpace,a.x,a.y), seed: s.seed + s.round,
            visualPointBonus: (hasTrait(a, "twentyTwentyVision") ? insightRules.data.rules.observe.twentyTwentyBonus : 0) + (hasTrait(a, "directorsVision") ? 2 : 0) + (hasTrait(a, "spiritSight") ? 1 : 0),   // Spirit Sight (Oni-blooded): one more
            shared: (s.scoutShare?.[a.id]?.[t.id] || 0) + (H.perfectRecall?.(a) ? 1 : 0), seesSpirits: insightRules.seesSpirits(a) });   // Perfect Recall (S6c): +1 familiarity on every Observe
          if (result.error) return result.error;
          if (free) spendFree(); else { const spend=spendTempo(s,a,invest+woundTax,"Observe");if(spend)return spend; }
          if (detail) { a.focus.detail = false; log(s, { kind: "observe", actor: a.id, target: t.id, text: `${a.name}'s retained detail on ${t.name} adds +1 point to the study.` }); }
          observeTail(s, a, t, result, { bySubject, invest: invest + (detail ? 10 : 0), free });
          { const wheelNote = H.wheelhouseName?.(s, t); if (wheelNote) log(s, { kind: "observe", actor: a.id, target: t.id, text: wheelNote }); }
          if (t.side !== a.side) H.mysteryForce?.(s, t.id, undefined, "ripped by Observe", { invest: invest + (detail ? 10 : 0), observer: a.id });
          if (t.side !== a.side) H.Cards?.glimpse(s, a, t, invest + (detail ? 10 : 0));   // Battle Cards C7: an aware Observer glimpses the unused cards of a foe that carries a deck (private; cards.js)   // Mystery: an Eye-read rips a foe's oldest set plan (a card set needs study AP by its power); allies' cards are left alone (Harbor round-2 item 7 ruling)
          return;
        }
        const k = s.knowledge[a.id][t.id];
        const hidden = abilitiesOf(t).filter((id) => !k.abilities[id]);
        if (free) { const hadSurvey = freeSurvey && s.surveyFlag; spendFree(); if (hadSurvey) log(s, { kind: "observe", actor: a.id, text: "Survey Flag: this Observe is free." }); } else {const spend=spendTempo(s,a,s.rules.actionCosts.utility+woundTax,"Observe");if(spend)return spend;} k.secondary = true; k.lens = true; a.observes=(a.observes||0)+1;
        const learned = hidden.slice(0, 2); for (const id of learned) k.abilities[id] = true;
        ClassRuntime?.law?.debrief?.(s, a, t);   // truth engine: the study debriefs a trial exhibit
        log(s, { kind: "observe", actor: a.id, text: `${a.name} observes ${t.name}: ${conceptName(t.primary)} primary, ${conceptName(t.secondary)} secondary.`,
          why: learned.length ? learned.map((id) => `Learned ${ab(id).name}: ${ab(id).reveal}`) : ["Nothing new to learn."] });
        { const wheelNote = H.wheelhouseName?.(s, t); if (wheelNote) log(s, { kind: "observe", actor: a.id, target: t.id, text: wheelNote }); }
        if (t.side !== a.side) H.mysteryForce?.(s, t.id, undefined, "ripped by Observe", { invest: 0, observer: a.id });   // Mystery: Observe rips a foe's oldest set plan; allies' cards are left alone (Harbor round-2 item 7 ruling). Battle Cards C2: this legacy Observe has no study, so a face-down card set (which needs study AP, Cards.ripAp) stays down
      },
      observePlace(s, a, act, deep = null) {
        if (!H.Observation.eligible(a)) return "This unit cannot Observe the place.";
        if (!Climate || !insightRules || !s.weatherState) return "There is no active weather to survey here.";
        // Investigate the place (I3): all the AP the caller allowed, deepest first (deepLook)
        const invest = Math.max(10, Math.min(50, Math.floor((act.invest || 20) / 10) * 10));
        if (!deep && a.tempo < s.rules.actionCosts.utility) return `Observe needs ${s.rules.actionCosts.utility} action points.`;
        if (!deep && a.tempo < invest) return `Observing the place needs ${invest} action points.`;
        const deck = s.insight.decks[(a.id==="player"?s.placeObservation:s.placeObservations?.[a.id])?.key] || Climate.placeDeck(moduleArena(s.arena), s.weatherState, { seed: s.seed });
        const bySubject = H.Observation.knowledge(s,a,true);
        const know = bySubject[deck.subject.key] || insightRules.spawnKnowledge(deck);
        const result = deep ? Climate.investigatePlace({ deck, know, cognitive: H.Observation.cognitive(s,a), ap: deep.ap, dreamField: s.dreamSpace })
          : Climate.observePlace({ deck, know, cognitive: H.Observation.cognitive(s,a), invest, dreamField: s.dreamSpace, seed: s.seed + s.round });
        if (result.error) return result.lines.join(" ");
        const spend = spendTempo(s, a, deep ? a.tempo : invest, deep ? "Investigate the place" : "Observe the place"); if (spend) return spend;
        if (deep) deep.spent = true;
        ClassRuntime?.law?.foundEvidence?.(s, H, a, { name: "the place" }, result.revealed);   // I4d: finding place evidence upgrades its breach — before recordCards, so findings keep the found text
        H.Observation.recordCards(s,a,deck.subject.key,result.revealed,"observePlace");
        bySubject[deck.subject.key] = result.know; H.Observation.setCognitive(s,a,result.cognitive);
        (s.observationTurns ||= {})[a.id]=a.ownerTurns;
        scoutNoted(s, a, deck.subject.key);
        const place={key:deck.subject.key,grants:result.grants,familiarity:H.recallFamiliarity?.(a, result.familiarity) ?? result.familiarity};   // Perfect Recall (S6c): +1 familiarity on every Observe
        if(a.id==="player")s.placeObservation=place;else(s.placeObservations ||= {})[a.id]=place;
        for (const line of result.lines) log(s, { kind: "observePlace", actor: a.id, text: line });
        const forecast = Climate.forecast(s.weatherState, moduleArena(s.arena), { seed: s.seed, round: s.round, rounds: result.grants.forecastRounds });
        if (forecast.length) log(s, { kind: "observePlace", actor: a.id, text: `Weather forecast: ${forecast.map(item => `Round ${item.round}, ${Climate.data.weather[item.weather]?.name || item.weather}`).join(" · ")}.` });
        if (result.grants.subtleMicro) {
          const micro = Climate.microclimate(moduleArena(s.arena), s.weatherState), counts = {};
          for (const tile of micro.tiles) for (const name of ["sheltered", "tunnel", "fogPool", "canopy"]) if (tile[name]) counts[name] = (counts[name] || 0) + 1;
          const terms = Object.entries(counts).map(([name, count]) => `${Climate.data.micro[name].name.toLowerCase()}: ${count} tile${count === 1 ? "" : "s"}`);
          log(s, { kind: "observePlace", actor: a.id, text: `Site survey: ${terms.length ? terms.join(" · ") : "no sheltered, tunnelled, fog-pool or canopy tiles"}. Hover tiles to inspect them.` });
        }
        {   // Site temper (Mala, 2026-10-19): rock and grass are visible to anyone who looks at the ground.
          const tp = H.siteTemper(s);
          if (!tp) { /* no land rules wired: no temper to report */ } else {
          const ground = tp.living >= 0.7 ? "living ground throughout" : tp.rock >= 0.7 ? "cold stone throughout" : tp.living >= tp.rock ? "more soil than stone" : "more stone than soil";
          const notice = tp.warnAt <= 11 ? "quick to notice" : tp.warnAt >= 20 ? "slow to anger" : "even-tempered";
          const forgive = tp.forgive >= 2 ? `quick to forgive (−${tp.forgive} wounds each round)` : tp.forgive === 1 ? "slow to forgive (−1 wound each round)" : "slow to forget (wounds never fade)";
          log(s, { kind: "observePlace", actor: a.id, text: `Site temper: ${ground} — ${notice} (Gaia warns at ${tp.warnAt} wounds), ${forgive}.` });
          if (a.id === "player") log(s, { kind: "observePlace", actor: a.id, text: H.Observation.nextStep({ kind: "place", warnAt: tp.warnAt }).text });   // O2a: the place names its next step
          }
        }
      },
      observePlant(s, a, act, deep = null) {   // Plant communion step 1: get to know one plant
        if (!Communion) return "Plant communion is unavailable.";
        if (!H.Observation.eligible(a)) return "This unit cannot study a plant.";
        const book=H.Observation.plantBook(s,a,true);
        const obj = (s.arena.objects || []).find(o => o.id === act.object && o.kind === "plant" && o.hp > 0);
        const prof = obj && Communion.profile(obj.type);
        if (!prof) return "Choose a living plant to observe.";
        if (obj.dead) return `The ${prof.common} is dead. There is nothing left to study.`;
        if (dist(s, a.x, a.y, obj.x, obj.y) > Communion.rules.observeRange) return `Move within ${Communion.rules.observeRange} tiles to observe the ${prof.common}.`;
        if (dist(s, a.x, a.y, obj.x, obj.y) > 1 && !hasSight(s, a.x, a.y, obj.x, obj.y)) return "You need a clear line of sight to observe that plant.";
        const hiker = (a.traits || []).some(t => (typeof t === "string" ? t : t?.id) === "hiker");
        const before = book.familiarity[obj.id] || 0;
        const BT = Communion.rules.botanist, botanist = !!BT && hasTrait(a, BT.trait);
        // Investigate a plant (I3): the rest of the turn buys familiarity at Observe's rate, plus the depth bonus, with no per-look cap
        if (deep && before >= prof.need) return `You already know the ${prof.common} as well as it can be known: there is nothing left to Investigate.`;
        const bonusNow = (hiker ? Communion.rules.hikerBonus : 0) + (botanist ? BT.observeBonus : 0);
        const result = deep ? { familiarity: before + Math.floor(deep.ap / Communion.rules.observeStep) + insightRules.data.rules.investigate.depthBonus + bonusNow, spend: a.tempo }
          : Communion.observe(before, act.invest || Communion.rules.observeStep, bonusNow);
        const spend = spendTempo(s, a, result.spend, deep ? "Investigate a plant" : "Observe a plant"); if (spend) return spend;
        if (deep) deep.spent = true;
        const gained = H.recallFamiliarity?.(a, result.familiarity) ?? result.familiarity;   // Perfect Recall (S6c): +1 familiarity on every Observe
        book.familiarity[obj.id] = gained; scoutNoted(s, a, null); H.Exposure.looked(s, a);
        const ready = gained >= prof.need, fam = Math.min(gained, prof.need);
        H.Observation.recordFact(s,a,{id:`plant:${obj.id}:${fam}`,kind:"plant",subject:obj.id,type:obj.type,familiarity:fam,text:`${prof.common}: familiarity ${fam}/${prof.need}.`},"observePlant");
        // Observe teaches (Mala, 2026-10-31): the observe that makes a plant ready (Field Botany: the first look) shows the
        // study note for the question it will ask, and every result names the next step. Perfect Recall also restores a note kept on the account.
        const q = (ready || botanist) ? Communion.questionFor(obj, s.seed) : null;
        const saved = H.perfectRecall?.(a) ? H.studyNoteOf?.(s, "plant", (q || Communion.questionFor(obj, s.seed))?.id) : null;   // only this battle's question
        const clue = q?.clue || (H.perfectRecall?.(a) && saved) || null;
        if (clue) { (book.clues ||= {})[obj.id] = true; H.Observation.recordFact(s,a,{id:`plant:${obj.id}:clue`,kind:"plant",subject:obj.id,type:obj.type,familiarity:fam,clue:true,text:`${prof.common}: study note: ${clue}`},"observePlant"); if (q?.clue) H.noteStudy?.(s, a, "plant", q.id, q.clue); }
        const d = dist(s, a.x, a.y, obj.x, obj.y), phi = Math.max(0, prof.phi - communeDiscount(a)), bonus = (hiker ? Communion.rules.hikerBonus : 0) + (botanist ? BT.observeBonus : 0) + (H.perfectRecall?.(a) ? 1 : 0);
        const forYou = a.id === "player";   // the next-step line addresses the player: a foe's or an ally's study must not tell you to approach and perform the ritual
        const step = forYou ? H.Observation.nextStep({ kind: "plant", ready, closed: !!book.closed?.[obj.id], need: prof.need, fam, step: Communion.rules.observeStep, bonus, dist: d, range: Communion.rules.range, deed: "perform the ritual", ritual: "Commune", ap: Communion.rules.communeAp, phi, common: prof.common }) : null;   // O2a: the one next-step vocabulary (same strings O1 printed)
        const next = step ? ` ${step.text}` : "";
        log(s, { kind: "observePlant", actor: a.id, ready, tiles: [[obj.x, obj.y]], text: `${a.name} ${deep ? "investigates" : "studies"} the ${prof.common}: familiarity ${fam}/${prof.need}.${clue ? ` Study note: ${clue}` : ""}${next}`,
          why: [`As an ally: ${prof.name}, ${prof.hp} LF, ${conceptName(prof.primary)} with ${conceptName(prof.secondary)}.`, `Communing costs ${Communion.rules.communeAp} action points and ${prof.phi} ΦF from an adjacent tile.`, ...(hiker ? ["Hiker: +1 familiarity for reading the ground."] : []), ...(botanist ? [`Field Botany: +${BT.observeBonus} familiarity for knowing what they are looking at.`] : []), ...(H.perfectRecall?.(a) ? ["Perfect Recall: +1 familiarity; study notes stay with you."] : [])] });
      },
      communeIngredient(s, a, act) {   // Ingredient totems (spec claude-ingredient-totems-spec T1): wake an ingredient from the pack or an adjacent pickup
        if (!Communion?.canCommuneIngredient) return "Ingredient communion is unavailable.";
        const IR = Communion.ingredients.rules;
        const pickup = act.pickup != null ? (s.arena.pickups || []).find((p) => p.id === act.pickup) : null;
        if (act.pickup != null && !pickup) return "That ingredient is gone.";
        const item = pickup ? pickup.item : act.item;
        if (!pickup && !(a.inventory || []).includes(item)) return "That ingredient is not in your pack.";
        const can = Communion.canCommuneIngredient({ unit: a, item, ap: a.tempo, pf: a.pf, usedThisTurn: a.totemWokeTurn === a.ownerTurns, dist: pickup ? dist(s, a.x, a.y, pickup.x, pickup.y) : 0 });
        if (!can.ok) return can.reason;
        const spend = spendTempo(s, a, IR.communeAp, `Wake the ${can.totem.name}`); if (spend) return spend;
        a.pf -= IR.phi; a.totemWokeTurn = a.ownerTurns;
        if (pickup) s.arena.pickups = s.arena.pickups.filter((p) => p !== pickup); else a.inventory.splice(a.inventory.indexOf(item), 1);
        if (a.totem) log(s, { kind: "totem", actor: a.id, text: `The ${a.totem.name} goes back to sleep.` });
        const cook = !!Cooking()?.isCook?.(a);
        a.totem = { kind: item, name: can.totem.name, sprite: can.totem.sprite, turnsLeft: cook ? IR.cookTurns : IR.turns, cleansed: [] };
        log(s, { kind: "totem", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} wakes the ${can.totem.name}.`, why: [can.totem.text, `It stays beside ${a.name} for ${a.totem.turnsLeft} of ${a.name}'s turns${cook ? " (a cook's totem lasts 3)" : ""}; it cannot attack or be attacked.`] });
        // Cooks who see it learn it (Mala, 2026-11-07): +1 Inspiration (a certain, once-a-battle roll) and Kitchen Animism, granted here so a full bar still learns.
        for (const u of Object.values(s.actors)) {
          if (u.id === a.id || u.defeated || u.notArrived || !hasSight(s, u.x, u.y, a.x, a.y)) continue;
          if (!(Cooking()?.isCook?.(u) || hasTrait(u, IR.learnFrom))) continue;
          if (Communion.canWakeIngredients(u)) continue;   // an Animist cook (or one who already learned) has nothing to learn: no Inspiration either (Fathom AD batch 5)
          H.Inspiration?.roll(s, u, "seesIngredientCommune", IR.learnInspirationChance);
          (u.traits ||= []).push(IR.learnedTrait); (s.kitchenLearned ||= []).push(u.id);
          log(s, { kind: "learn", actor: u.id, target: a.id, text: `${u.name} watches the ${can.totem.name} wake, and understands. Learned: Kitchen Animism.` });
        }
      },
      commune(s, a, act) {   // Plant communion step 2: a botany question; a right answer brings the plant out as an ally
        if (!Communion) return "Plant communion is unavailable.";
        if (!H.Observation.eligible(a)) return "This unit cannot commune with a plant.";
        const book=H.Observation.plantBook(s,a,true);
        const obj = (s.arena.objects || []).find(o => o.id === act.object);
        const active = Object.values(s.actors).filter(x => x.communed && !x.defeated && x.communed.owner === a.id).length;
        const can = Communion.canCommune({ obj, familiarity: obj ? book.familiarity[obj.id] || 0 : 0, active, closed: !!(obj && book.closed[obj.id]),
          ap: a.tempo, pf: a.pf + communeDiscount(a), dist: obj ? dist(s, a.x, a.y, obj.x, obj.y) : 99 });
        if (!can.ok) return can.reason;
        if (actorAt(s, obj.x, obj.y)) return "Someone is standing in that plant.";
        const prof = can.profile, q = Communion.questionFor(obj, s.seed);   // Observe teaches: one question per plant per battle
        if (!q || q.id !== act.questionId) return "The plant's question is no longer current.";
        const score = Communion.scoreAnswer(q.id, act.answer);
        const spend = spendTempo(s, a, Communion.rules.communeAp, `Commune with ${prof.common}`); if (spend) return spend;
        a.pf -= Math.max(0, prof.phi - communeDiscount(a));
        if (!score.correct) { H.Exposure.communed(s, a);
          book.closed[obj.id] = true;
          log(s, { kind: "communeFail", actor: a.id, tiles: [[obj.x, obj.y]], text: `The ${prof.common} does not answer ${a.name}. ${score.explain}`, why: ["A wrong answer closes that plant to you for the rest of the battle. It will not answer you again this battle."] });
          return;
        }
        const ally = communeAlly(s, a, obj); H.Exposure.communed(s, a);   // Exposure: the borrowed boons are for one commune
        log(s, { kind: "commune", actor: ally.id, target: a.id, tiles: [[obj.x, obj.y]], text: `The ${prof.common} answers ${a.name} and steps out of the ground as ${ally.name} (${ally.lf} LF). ${score.explain}`,
          why: ["It fights beside you until its life runs out. Then it dies, and its body stays where it fell."] });
      },
      nameDream(s, a, act) {   // Observe teaches O2b (D6): name a dream monster from Rituals; spends an action, right fades it, wrong feeds it
        const Dr = Dream();
        if (!Dr) return "Naming dreams is unavailable.";
        if (!H.Observation.eligible(a)) return "This unit cannot name a dream.";
        const t = s.actors[act.target];
        if (!t?.dream || t.defeated) return "Choose a living dream to name.";
        const m = Dr.data.monsters[t.dream.key];
        if (!m) return "That dream has no name to learn.";
        if (t.side === a.side) return "That dream fights beside you: there is nothing to name.";
        if (t.dream.named) return "It is already named: it fades at round end.";
        if (s.round < (t.dream.nameRetryRound || 0)) return `You can try naming it again in round ${t.dream.nameRetryRound}.`;
        if (dist(s, a.x, a.y, t.x, t.y) > 1) return "Stand beside the dream to name it.";
        if (!m.wake.choices.includes(act.choice)) return "That is not one of its answers.";
        const spend = spendTempo(s, a, Dr.data.rules.nameIt.actionCost, `Name ${t.name}`); if (spend) return spend;
        const r = Dr.nameIt(t, act.choice, s.round);
        s.actors[t.id] = r.actor;
        log(s, { kind: "dreamNamed", actor: a.id, target: t.id, correct: r.correct, text: r.event.text,
          why: [r.correct ? "Named: it fades at round end." : `Wrong: it holds on; you can try again in ${Dr.data.rules.nameIt.wrong.retryAfterRounds} rounds.`] });
      },
      observeSummon(s, a, act) {   // Observe teaches O2c (D7): study a summon's palace room: the first study each battle adds +1 hint to its calling question
        const def = summonRules?.data?.summons?.[act.summon];
        if (!def) return "No such summon.";
        if (!H.Observation.eligible(a)) return "This unit cannot study a palace room.";
        if (s.summonHints?.[a.id]?.[act.summon]) return "Already studied this battle: no new hint.";
        if (a.tempo < 20) return "Studying the room needs 20 action points.";   // fixed price for the fixed +1 (gremlin SEV-3): the effort selector must not change it; mirrors O2b nameDream
        const spend = spendTempo(s, a, 20, `Study ${def.name}'s room`); if (spend) return spend;
        ((s.summonHints ||= {})[a.id] ||= {})[act.summon] = 1;
        log(s, { kind: "observe", actor: a.id, target: act.summon, text: `You study ${def.name}'s room: one wrong choice on its calling question is struck this battle.` });
        log(s, { kind: "observe", actor: a.id, target: act.summon, text: H.Observation.nextStep({ kind: "summon" }).text });
      },
      observeStructure(s, a, act, deep = null) {   // Tsukumogami step 1: get to know one structure
        if (!Tsukumogami) return "Tsukumogami is unavailable.";
        if (!H.Observation.eligible(a)) return "This unit cannot study a structure.";
        const book = H.Observation.structureBook(s, a, true);
        const obj = (s.arena.objects || []).find(o => o.id === act.object && o.kind === "object" && o.hp > 0);
        const prof = obj && Tsukumogami.profile(obj.type);
        if (!prof) return "Choose a standing structure to study.";
        if (dist(s, a.x, a.y, obj.x, obj.y) > Tsukumogami.rules.observeRange) return `Move within ${Tsukumogami.rules.observeRange} tiles to study the ${prof.common}.`;
        if (dist(s, a.x, a.y, obj.x, obj.y) > 1 && !hasSight(s, a.x, a.y, obj.x, obj.y)) return "You need a clear line of sight to study that structure.";
        if (!hasTrait(a, "animist") && !book.warned) {   // told before they invest: the warning is free
          book.warned = true;
          log(s, { kind: "observeStructure", actor: a.id, ready: false, tiles: [[obj.x, obj.y]], text: "It will answer someone who knows it has a soul — not you.",
            why: ["Only an Animist can wake a structure. You can still study it."] });
          return;
        }
        const before = book.familiarity[obj.id] || 0;
        // Investigate a structure (I3): as a plant, after the free Animist warning
        if (deep && before >= prof.need) return `You already know the ${prof.common} as well as it can be known: there is nothing left to Investigate.`;
        const result = deep ? { familiarity: before + Math.floor(deep.ap / Tsukumogami.rules.observeStep) + insightRules.data.rules.investigate.depthBonus, spend: a.tempo }
          : Tsukumogami.observe(before, act.invest || Tsukumogami.rules.observeStep);
        const spend = spendTempo(s, a, result.spend, deep ? "Investigate a structure" : "Study a structure"); if (spend) return spend;
        if (deep) deep.spent = true;
        const gained = H.recallFamiliarity?.(a, result.familiarity) ?? result.familiarity;   // Perfect Recall (S6c): +1 familiarity on every Observe
        book.familiarity[obj.id] = gained; scoutNoted(s, a, null); H.Exposure.looked(s, a);
        const ready = gained >= prof.need, fam = Math.min(gained, prof.need);
        const matDef = insightRules?.data?.traits?.[Tsukumogami.materialTrait(prof.material)] || null;
        H.Observation.recordFact(s, a, { id: `structure:${obj.id}:${fam}`, kind: "structure", subject: obj.id, type: obj.type, familiarity: fam, text: `${prof.common}: familiarity ${fam}/${prof.need}.` }, "observeStructure");
        // Observe teaches O2a: the study that makes a structure ready shows the study note for the question it will ask, and every result names the next step. Perfect Recall also restores a note kept on the account.
        const q = ready ? Tsukumogami.questionFor(obj, s.seed) : null;
        const saved = H.perfectRecall?.(a) ? H.studyNoteOf?.(s, "structure", (q || Tsukumogami.questionFor(obj, s.seed))?.id) : null;   // only this battle's question
        const clue = q?.clue || (H.perfectRecall?.(a) && saved) || null;
        if (clue) { (book.clues ||= {})[obj.id] = true; H.Observation.recordFact(s, a, { id: `structure:${obj.id}:clue`, kind: "structure", subject: obj.id, type: obj.type, familiarity: fam, clue: true, text: `${prof.common}: study note: ${clue}` }, "observeStructure"); if (q?.clue) H.noteStudy?.(s, a, "structure", q.id, q.clue); }
        const d = dist(s, a.x, a.y, obj.x, obj.y), phi = Math.max(0, prof.phi - communeDiscount(a, "structure"));
        const forYou = a.id === "player";   // the next-step line addresses the player: a foe's or an ally's study must not tell you to approach and wake it
        const step = forYou ? H.Observation.nextStep({ kind: "structure", ready, need: prof.need, fam, step: Tsukumogami.rules.observeStep, bonus: H.perfectRecall?.(a) ? 1 : 0, dist: d, range: Tsukumogami.rules.range, deed: "wake it", ritual: "Wake", ap: Tsukumogami.rules.communeAp, phi, common: prof.common }) : null;
        const next = step ? ` ${step.text}` : "";
        log(s, { kind: "observeStructure", actor: a.id, ready, tiles: [[obj.x, obj.y]], text: `${a.name} ${deep ? "investigates" : "studies"} the ${prof.common}: familiarity ${fam}/${prof.need}${ready ? ". It will answer if you wake it." : "."}${clue ? ` Study note: ${clue}` : ""}${next}`,
          why: [`As an ally: ${prof.name}, ${Math.max(1, obj.hp * 2)} LF.`, `Waking costs ${Tsukumogami.rules.communeAp} action points and ${phi} ΦF from an adjacent tile.`, ...(matDef ? [`Material: ${matDef.text}`] : []), ...(H.perfectRecall?.(a) ? ["Perfect Recall: +1 familiarity; study notes stay with you."] : [])] });
      },
      communeStructure(s, a, act) {   // Tsukumogami step 2: answer its question; a right answer wakes it as an ally
        if (!Tsukumogami) return "Tsukumogami is unavailable.";
        if (!H.Observation.eligible(a)) return "This unit cannot wake a structure.";
        const book = H.Observation.structureBook(s, a, true);
        const obj = (s.arena.objects || []).find(o => o.id === act.object);
        const active = Object.values(s.actors).filter(x => x.awakened && !x.defeated && x.awakened.owner === a.id).length;
        const disc = communeDiscount(a, "structure");
        const can = Tsukumogami.canCommune({ obj, familiarity: obj ? book.familiarity[obj.id] || 0 : 0, active,
          ap: a.tempo, pf: a.pf + disc, dist: obj ? dist(s, a.x, a.y, obj.x, obj.y) : 99, animist: hasTrait(a, "animist") });
        if (!can.ok) return can.reason;
        if (actorAt(s, obj.x, obj.y)) return `Someone is standing in that ${can.profile.common}.`;
        if (!standFootprint(s, obj, can.profile.size)) return "It has no room to stand.";
        const prof = can.profile, q = Tsukumogami.questionFor(obj, s.seed);   // Observe teaches: one question per structure per battle
        if (!q || q.id !== act.questionId) return "The structure's question is no longer current.";
        const score = Tsukumogami.scoreAnswer(q.id, act.answer);
        const spend = spendTempo(s, a, Tsukumogami.rules.communeAp, `Wake the ${prof.common}`); if (spend) return spend;
        a.pf -= Math.max(0, prof.phi - disc);
        if (!score.correct) { H.Exposure.communed(s, a);
          log(s, { kind: "communeFail", actor: a.id, tiles: [[obj.x, obj.y]], text: `The ${prof.common} does not answer ${a.name}. ${score.explain}`, why: ["A wrong answer spends the cost. It stays asleep — but it may answer another question."] });
          return;
        }
        const ally = awakenAlly(s, a, obj); H.Exposure.communed(s, a);   // Exposure: the borrowed boons are for one commune
        log(s, { kind: "awaken", actor: ally.id, target: a.id, tiles: [[obj.x, obj.y]], text: `The ${prof.common} answers ${a.name} and stands as ${ally.name} (${ally.lf} LF). ${score.explain}`,
          why: ["It fights beside you for 4 rounds, then settles back into an object."] });
      },
      treeant(s, a, act) {   // Treeant: pour your folded dream-aura into your communed plant; it rises while the dream holds
        if (!Communion?.promoteToTreeant) return "Treeants are unavailable.";
        const t = s.actors[act.target];
        if (s.dreamSpace?.owner !== a.id) return "Open your Dream Space first; the Treeant drinks its aura.";
        if (!a.aura?.imbued || a.aura.burning) return "Your aura must be folded into the dream, not burning, to pour it into a plant.";
        if (!t || t.defeated || !t.communed || t.communed.owner !== a.id) return "Choose your own living communed plant.";
        if (t.treeant) return "It is already a Treeant.";
        const T = Communion.rules.treeant;
        const spend = spendTempo(s, a, T.ap, "Raise a Treeant"); if (spend) return spend;
        const concept = a.aura.concept;
        a.aura = null;   // the field loses your aura: it is all in the plant now
        Object.assign(t, Communion.promoteToTreeant(t, concept));
        log(s, { kind: "treeant", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${a.name} pours ${conceptName(concept)} into ${t.name}: it rises as a Treeant (+${T.lfAdd} LF, Bark ward ${T.wardProtection}) while the dream holds.`,
          why: ["Your folded aura leaves the dream's field and becomes the Treeant's body.", "When the dream closes it sinks back to its plant form. If it falls it dies like any ally."] });
      },
      maxChannel(s, a, act) {   // MAX: pour the open dream plus a full ult bar into a revealed Napoleon; he goes MAX permanently and the dream is consumed
        if (!summonRules?.revealMaxForm) return "MAX channel is unavailable.";
        const t = s.actors[act.target];
        if (s.dreamSpace?.owner !== a.id) return "Open your Dream Space first; MAX drinks the dream itself.";
        const def = t && summonRules.data.summons[t.summon?.key];
        if (!t || t.defeated || !t.summon || t.summon.owner !== a.id || t.side !== a.side) return "Choose your own living summon.";
        if (!t.summon.trueForm || !def?.maxForm) return `${t.name} has no MAX form to rise into: it takes a summon the dream has revealed.`;
        if (t.summon.maxForm) return "It is already MAX.";
        if (t.summon.order) return "Let the ordered ultimate fire first; MAX waits its turn.";
        const max = s.rules.ultimateChargeMax ?? 100;
        if ((a.ultimateCharge ?? 0) < max) return "Channeling MAX takes a full ultimate bar.";
        const at = maxRoomFor(s, t);   // a bigger MAX body needs its room before anything is paid
        if (!at) return `There is no room beside ${t.name} for the winged mount: clear a tile east or west.`;
        const MC = summonRules.data.rules.maxChannel;
        const spend = spendTempo(s, a, MC.actionCost, "Channel MAX"); if (spend) return spend;
        a.ultimateCharge = 0;
        const result = summonRules.revealMaxForm(t, at);
        Object.assign(t, result.actor);
        if (H.applyRevealEffect) H.applyRevealEffect(s, t);
        const field = s.dreamSpace, closed = dreamSpaceRules.close(field, `poured into ${t.name}`);
        s.dreamSpace = null;
        for (const ev of closed.events) log(s, { ...ev, kind: "dreamSpace" });
        H.closeDreamSummons(s, field); H.closeDreamTreeants?.(s, field);
        if (a.aura?.imbued) a.aura = null;
        log(s, { kind: "summonMaxForm", actor: a.id, target: t.id, tiles: footprint(t), text: `${a.name} channels MAX: ${result.text}`,
          why: ["The dream is consumed: it closes as if the clock ran out.", "MAX is permanent for this stay — double turns, the MAX technique, a new ultimate — and it never sinks back."] });
        checkOutcome(s);
      },
      observeSelf(s, a) {
        if (a.id !== "player" || !insightRules) return "Only the player can Observe Self.";
        const result = insightRules.observeSelf(s.self, { ap: a.tempo, chargeAllowed: true });
        if (result.error) return result.lines.join(" ");
        if (result.cost) {
          const spendError = spendTempo(s, a, result.cost, "Observe Self"); if (spendError) return spendError;
          a.ultimateCharge = Math.min(s.rules.ultimateChargeMax, a.ultimateCharge + result.charge);
        }
        s.self = result.self;
        for (const line of result.lines) log(s, { kind: "selfObserve", actor: a.id, text: line, why: [result.pane ? `Johari pane: ${result.pane}.` : "Self-knowledge persists with the player account."] });
      },
      resolveTrauma(s, a, act) {
        if (a.id !== "player" || !mirrorRules) return "Only the player can work through a trauma.";
        const id = act.trait;
        if (!s.mirror.resolvable.includes(id)) return "That trauma has not been met in this battle.";
        const result = mirrorRules.resolveTrauma(s.self, id);
        if (result.error) return result.error;
        const reward = result.reward.now;
        s.self = result.self;
        s.mirror.resolvable = s.mirror.resolvable.filter(x => x !== id);
        s.mirror.resolvedThisBattle.push(id);
        const permanent = result.reward.permanent.passive || {}, previousMaxAdd = a.passives?.maxLFAdd || 0;
        a.passives = { ...(a.passives || {}), ...permanent };
        const maxAdd = (a.passives.maxLFAdd || 0) - previousMaxAdd;
        if (maxAdd > 0) { a.maxLF += maxAdd; a.lf += maxAdd; }
        a.ultimateCharge = s.rules.ultimateChargeMax;
        a.lf = Math.min(a.maxLF, a.lf + reward.heal);
        a.status.catharsis = { label: "Catharsis", owner: a.id, expiresAt: a.ownerTurns + reward.status.duration + 1,
          potencyMul: reward.status.potencyMul, apPerTurnAdd: reward.status.apPerTurnAdd };
        for (const line of result.lines) log(s, { kind: "trauma", actor: a.id, trait: id, text: line, why: ["The trauma was known and its declared dream or behavior condition was met."] });
      },
      // Break an orb you carry (docs/brain-chip.md, docs/orbs.md). The form starts and the ultimate bar fills; the hit
      // itself waits for the ultimate. "Main action" is formBalance.activationAp action points.
      breakOrb(s, a, act) {
        if (!bossRules) return "Orbs are unavailable.";
        const O = bossRules.data.orbs[act.orb], cost = bossRules.data.formBalance.activationAp;
        if (!O) return "That isn't an orb.";
        if (a.tempo < cost) return `Breaking the ${O.name} needs ${cost} action points.`;
        const form = () => bossRules.transform(a, act.orb, { round: s.round, ultimateChargeMax: s.rules.ultimateChargeMax });
        const refused = form().error; if (refused) return refused;
        const spend = spendTempo(s, a, cost, `Break the ${O.name}`); if (spend) return spend;
        const result = form(); Object.assign(a, result.player);
        for (const event of result.events) log(s, { ...event, orb: act.orb, tiles: [[a.x, a.y]],
          why: [`${cost} action points. The form lasts ${a.form.turnsLeft} of ${a.name}'s turns.`, `Ultimate charge is full (${a.ultimateCharge}): the orb's ultimate is one press.`] });
      },
      // Learned forms (Mala, 2026-10-17; docs/learned-forms.md): hold one you beat out of an Omega boss (50 AP), or swear
      // Borrowed Form for 3 free turns (vow: true). releaseForm is free.
      enterForm(s, a, act) {
        if (!bossRules?.enterLearned) return "Forms are unavailable.";
        const vow = !!act.vow, cost = vow ? 0 : bossRules.data.learnedForms.enterAp;
        const refused = bossRules.canEnterLearned(a, act.form, { vow }); if (refused) return refused;
        if (cost) { if (a.tempo < cost) return `Taking a form needs ${cost} action points.`; const spend = spendTempo(s, a, cost, "Take a form"); if (spend) return spend; }
        const r = bossRules.enterLearned(a, act.form, { round: s.round, ultimateChargeMax: s.rules.ultimateChargeMax, vow });
        if (r.error) return r.error;
        Object.assign(a, r.player); for (const ev of r.events) log(s, { ...ev, tiles: [[a.x, a.y]] });
      },
      releaseForm(s, a) {
        if (!a.form?.learned && !a.form?.golden) return "You aren't holding a form you can let go of.";
        const r = bossRules.releaseForm(a); Object.assign(a, r.player); if (!r.player.form) a.form = null;
        for (const ev of r.events) log(s, { ...ev, tiles: [[a.x, a.y]] });
      },
      becomeGolden(s, a) {
        if (a.id !== "player" || !mirrorRules || !bossRules) return "The Integrated Self is unavailable.";
        const status = mirrorRules.traumaStatus(s.self);
        const ready = bossRules.integration(s.self, status, s.mirror);
        const result = bossRules.becomeGolden(a, { integrated: ready.integrated || !!s.devPlayground, ultimateChargeMax: s.rules.ultimateChargeMax });   // the DEV playground waives integration, not the full bar
        if (result.error) return `${result.error}${ready.missing.length ? ` Missing: ${ready.missing.join("; ")}.` : ""}`;
        Object.assign(a, result.player);
        for (const event of result.events) log(s, event);
      },
      invokeTrial(s, a, act) {   // W1.3: Rituals ▸ mock-trial rite — 1 banked rite step + presented evidence + real counts
        if (!Courtroom) return "No court today.";
        if (a.id !== "player") return "Only the player invokes (driven-only).";
        const no = Courtroom.canInvoke(s, H, a.id, act.target);
        if (no) return no;
        if ((a.tempo || 0) < Courtroom.RULES.invokeTempo) return `Mock-trial needs ${Courtroom.RULES.invokeTempo} tempo.`;
        a.tempo -= Courtroom.RULES.invokeTempo;
        const r = Courtroom.invoke(s, H, a.id, act.target);
        if (!r.ok) return r.error;
      },
      trialPlay(s, a, act) {   // W1.3: Talk ▸ trial rows — the invoker queues prosecution plays
        if (!Courtroom) return "No court today.";
        if (a.id !== "player" || !s.trial || s.trial.over) return "No trial in session.";
        if ((a.tempo || 0) < Courtroom.RULES.playTempo) return `Trial plays need ${Courtroom.RULES.playTempo} tempo.`;
        const no = Courtroom.queuePlay(s, act.move);
        if (no) return no;
        a.tempo -= Courtroom.RULES.playTempo;
        log(s, { kind: "trial", actor: a.id, text: `${a.name} queues the prosecution's ${act.move}.` });
      },
      trialDefend(s, a, act) {   // arrest-trial: the accused (player) queues their own defense
        if (!Courtroom) return "No court today.";
        if (a.id !== "player" || !s.trial || s.trial.over) return "No trial in session.";
        if (s.trial.accusedId !== "player") return "Only the accused directs the defense.";
        if ((a.tempo || 0) < Courtroom.RULES.playTempo) return `Trial plays need ${Courtroom.RULES.playTempo} tempo.`;
        const no = Courtroom.queueDefense(s, act.move);
        if (no) return no;
        a.tempo -= Courtroom.RULES.playTempo;
        log(s, { kind: "trial", actor: a.id, text: `${a.name} prepares the defense's ${act.move}.` });
      },
      declarePresence(s, a, act) {   // W2.1: Rituals ▸ Declare intent → Presence — the zero-blow path opens
        if (!Presence) return "Presence is unavailable.";
        if (a.id !== "player") return "Only the player declares (driven-only).";
        if ((a.tempo || 0) < Presence.RULES.declareAp) return `Declaring needs ${Presence.RULES.declareAp} tempo.`;
        a.tempo -= Presence.RULES.declareAp;
        const r = Presence.declare(s, H, a.id);
        if (!r.ok) { a.tempo += Presence.RULES.declareAp; return r.error; }
      },
      displayPresence(s, a, act) {   // W2.1: Talk ▸ Display — willpower pressure, zero LF, +1 shine
        if (!Presence) return "Presence is unavailable.";
        const t = s.actors[act.target];
        if (!t || t.defeated || t.side !== "enemy" || H.Instinct.hidden(a, t)) return "Display needs a standing enemy.";
        if ((a.tempo || 0) < Presence.RULES.displayAp) return `Display needs ${Presence.RULES.displayAp} tempo.`;
        if ((a.pf || 0) < Presence.RULES.displayPf) return `Display needs ${Presence.RULES.displayPf} ΦF.`;
        if (dist(s, a.x, a.y, t.x, t.y) > 6) return "Display needs them within 6.";
        a.tempo -= Presence.RULES.displayAp; a.pf -= Presence.RULES.displayPf;
        a.status = a.status || {};
        a.status.displayBeauty = Math.min(Presence.RULES.displayBeautyCap, (a.status.displayBeauty || 0) + 1);
        if (!hasSight(s, a.x, a.y, t.x, t.y)) { log(s, { kind: "presence", actor: a.id, target: t.id, text: `${a.name} shines unseen: muted. (+1 beauty still.)` }); return; }
        let p = Presence.pressure(a, t);
        if (t.status?.dread) p += 2;   // dread rider: fear makes awe land harder
        if (Presence.isMindless(t) && Presence.beautyOf(a) < Presence.RULES.bypassBeauty) p = Math.min(p, Presence.RULES.mindlessCap);
        t.willpower = Math.max(0, (t.willpower ?? 10) - p);
        log(s, { kind: "presence", actor: a.id, target: t.id, text: `${a.name} displays: ${t.name} takes ${p} willpower pressure (${t.willpower}/${t.maxWillpower ?? 10}). Zero LF.` });
        if (t.willpower <= 0) Presence.breakWill(s, H, t, a.id);
      },
      deathVision(s, a, act) {   // W2.1: Techniques ▸ Death-vision — heavy willpower + dread; the far stronger are immune
        if (!Presence) return "Presence is unavailable.";
        const t = s.actors[act.target];
        if (!t || t.defeated || t.side !== "enemy") return "Death-vision needs a standing enemy.";
        if ((t.maxWillpower ?? 10) > (a.maxWillpower ?? 10) + Presence.RULES.deathVisionMaxWpGap) return "Far too strong to awe: Death-vision finds no purchase.";
        if ((a.tempo || 0) < Presence.RULES.deathVisionAp) return `Death-vision needs ${Presence.RULES.deathVisionAp} tempo.`;
        if ((a.pf || 0) < Presence.RULES.deathVisionPf) return `Death-vision needs ${Presence.RULES.deathVisionPf} ΦF.`;
        if (dist(s, a.x, a.y, t.x, t.y) > 6) return "Death-vision needs them within 6.";
        if (!hasSight(s, a.x, a.y, t.x, t.y)) return "Unseen: no presence without eyes on you.";
        a.tempo -= Presence.RULES.deathVisionAp; a.pf -= Presence.RULES.deathVisionPf;
        const p = Presence.RULES.deathVisionBase + Math.max(0, Presence.beautyOf(a) - Presence.beautyOf(t));
        t.willpower = Math.max(0, (t.willpower ?? 10) - p);
        t.status = t.status || {}; t.status.dread = { by: a.id, untilRound: s.round + 1 };
        log(s, { kind: "presence", actor: a.id, target: t.id, text: `${a.name} shows ${t.name} death: ${p} willpower + dread (awe lands +2 while it lasts). Zero LF.` });
        if (t.willpower <= 0) Presence.breakWill(s, H, t, a.id);
      },
      takeKneePresence(s, a, act) {   // W2.1: Rest ▸ Take a knee — all broken, zero blows: victory by presence
        if (!Presence) return "Presence is unavailable.";
        if ((a.tempo || 0) < Presence.RULES.kneeAp) return `Kneeling needs ${Presence.RULES.kneeAp} tempo.`;
        a.tempo -= Presence.RULES.kneeAp;
        const r = Presence.kneel(s, H, a.id);
        if (!r.ok) { a.tempo += Presence.RULES.kneeAp; return r.error; }
      },
      borrowDebt(s, a, act) {   // W2.2: Talk ▸ lender rows — +40 tempo +5 ΦF now, the book compounds
        if (!Debt) return "No lenders today.";
        if (a.id !== "player") return "Only the player borrows (driven-only).";
        const r = Debt.borrow(s, H, a.id, act.lender);
        if (!r.ok) return r.error;
      },
      repayDebt(s, a, act) {   // W2.2: Talk ▸ Repay — Seeds close the book (banks ask double)
        if (!Debt) return "No lenders today.";
        if (a.id !== "player") return "Only the player repays (driven-only).";
        const r = Debt.repay(s, H, a.id);
        if (!r.ok) return r.error;
      },
      settleDebtVisit(s, a, act) {   // W2.2: Talk ▸ Settle the visit — 2 inspiration sends the creditor home
        if (!Debt) return "No lenders today.";
        if (a.id !== "player") return "Only the player settles (driven-only).";
        const r = Debt.settleVisit(s, H, a.id);
        if (!r.ok) return r.error;
      },
      declareBankruptcy(s, a, act) {   // W2.2: Talk ▸ Declare bankruptcy — voluntary filing: seal + prison + service
        if (!Debt) return "No lenders today.";
        if (a.id !== "player") return "Only the player files (driven-only).";
        const r = Debt.bankrupt(s, H, a.id, true);
        if (!r.ok) return r.error;
      },
      sealBeast(s, a, act) {   // W2.3: Techniques ▸ Seal — bind a gated foe into the smallest fitting vessel
        if (!Sealing) return "No vessels today.";
        if (a.id !== "player") return "Only the player seals (driven-only).";
        const t = s.actors[act.target];
        if (!t || t.defeated || t.side !== "enemy" || H.Instinct.hidden(a, t)) return "Sealing needs a standing enemy.";
        if ((a.tempo || 0) < Sealing.RULES.sealAp) return `Sealing needs ${Sealing.RULES.sealAp} tempo.`;
        a.tempo -= Sealing.RULES.sealAp;
        const r = Sealing.seal(s, a, t);
        if (!r.ok && !r.text) { a.tempo += Sealing.RULES.sealAp; return r.error; }
        log(s, { kind: "seal", actor: a.id, target: t.id, vessel: r.vessel || null, text: r.text });
        if (!r.ok) return;
        checkOutcome(s);
      },
      grantTechnique(s, a, act) {   // W2.3: Techniques ▸ Grant — an ally inherits a technique; a level is owed at battle end
        if (!Sealing) return "No inheritances today.";
        if (a.id !== "player") return "Only the player grants (driven-only).";
        const t = s.actors[act.target];
        if ((a.tempo || 0) < Sealing.RULES.grantAp) return `Granting needs ${Sealing.RULES.grantAp} tempo.`;
        a.tempo -= Sealing.RULES.grantAp;
        const r = Sealing.grant(s, a, t, act.ability);
        if (!r.ok) { a.tempo += Sealing.RULES.grantAp; return r.error; }
        log(s, { kind: "seal", actor: a.id, target: t.id, text: r.text });
      },
      declareWard(s, a, act) {   // Duy's rule: Rituals ▸ Declare — name the precious ward a death-priced seal protects
        if (!Sealing) return "No vessels today.";
        const t = s.actors[act.target];
        if ((a.tempo || 0) < Sealing.RULES.declareAp) return `Naming a ward needs ${Sealing.RULES.declareAp} tempo.`;
        a.tempo -= Sealing.RULES.declareAp;
        const r = Sealing.declare(s, a, t);
        if (!r.ok) { a.tempo += Sealing.RULES.declareAp; return r.error; }
        log(s, { kind: "declare", actor: a.id, target: t.id, text: r.text });
      },
      reaperSeal(s, a, act) {   // W2.3: Techniques ▸ Reaper's Seal — the mutual seal: caught outright, the sealer dies
        if (!Sealing) return "No vessels today.";
        if (a.id !== "player") return "Only the player ties it (driven-only).";
        const t = s.actors[act.target];
        if (!t || t.defeated || t.side !== "enemy" || H.Instinct.hidden(a, t)) return "The Reaper's seal needs a standing enemy.";
        if ((a.tempo || 0) < Sealing.RULES.reaperAp) return `The knot needs ${Sealing.RULES.reaperAp} tempo.`;
        a.tempo -= Sealing.RULES.reaperAp;
        const r = Sealing.reaper(s, a, t);
        if (!r.ok) { a.tempo += Sealing.RULES.reaperAp; return r.error; }
        log(s, { kind: "seal", actor: a.id, target: t.id, vessel: r.vessel, text: r.text });
        log(s, { kind: "defeat", target: a.id, text: `${a.name} dies with the knot tied.` });
        for (const e of Sealing.onSealerDown(s, a)) log(s, { kind: "seal", actor: e.foe, text: e.text });
        checkOutcome(s);
      },
      mendVerb(s, a, act) {   // verb 10 MEND: contact care for the living (+8 LF, downgrades one injury)
        const VT = VerbTech(); if (!VT) return "No verbs today.";
        const t = s.actors[act.target];
        if ((a.tempo || 0) < VT.RULES.mendAp || (a.pf || 0) < VT.RULES.mendPhi) return `MEND needs ${VT.RULES.mendAp} tempo + ${VT.RULES.mendPhi} ΦF.`;
        const zones = t && !t.defeated ? H.Injury?.woundedZones(t) || [] : [];
        if (act.zone && (!["head", "arms", "legs"].includes(act.zone) || !zones.includes(act.zone))) return "MEND that zone? It holds no wound.";
        a.tempo -= VT.RULES.mendAp; a.pf -= VT.RULES.mendPhi;
        const low = !!t && (t.lf ?? 0) < (t.maxLF || 100) * 0.25;
        const r = VT.mend(s, a, t, zones.length > 0);
        if (!r.ok) { a.tempo += VT.RULES.mendAp; a.pf += VT.RULES.mendPhi; return r.error; }
        log(s, { kind: "verb", verb: 10, actor: a.id, target: t.id, text: r.text });
        if (low && !s.preview) Orders()?.onSave(s, a.id, H);   // admiration: a save (MEND landing under 25%)
        if (zones.length) H.Injury?.downgrade(s, a, t, act.zone);
      },
      tendVerb(s, a, act) {   // verb 9 TEND: raise a downed ally at 1 LF, or steady a standing one's bleeding — once each
        const VT = VerbTech(); if (!VT) return "No verbs today.";
        const t = s.actors[act.target];
        if ((a.tempo || 0) < VT.RULES.tendAp || (a.pf || 0) < VT.RULES.tendPhi) return `TEND needs ${VT.RULES.tendAp} tempo + ${VT.RULES.tendPhi} ΦF.`;
        a.tempo -= VT.RULES.tendAp; a.pf -= VT.RULES.tendPhi;
        const fail = (error) => { a.tempo += VT.RULES.tendAp; a.pf += VT.RULES.tendPhi; return error; };
        const r = VT.tend(s, a, t);
        if (r.ok) { log(s, { kind: "verb", verb: 9, actor: a.id, target: t.id, text: r.text }); if (!s.preview) Orders()?.onSave(s, a.id, H); checkOutcome(s); return; }   // admiration: a raise is a save
        if (t && !t.defeated && t.side === a.side && t.id !== a.id) {   // stabilize-the-standing
          const zones = H.Injury?.woundedZones(t) || [];
          if (!zones.length) return fail(r.error);
          if ((s.tendRaised || {})[t.id]) return fail(`${t.name} has been tended once already this battle.`);
          if (Math.max(Math.abs(t.x - a.x), Math.abs(t.y - a.y)) > 1) return fail(`${t.name} is too far to reach.`);
          if (!zones.some((z) => !t.injuries[z].s)) return fail(`${t.name}'s wounds are already steady.`);
          H.Injury?.stabilize(s, a, t);
          return;
        }
        return fail(r.error);
      },
      salvageVerb(s, a, act) {   // verb 14 SALVAGE: strip an adjacent corpse (+6 Seeds; parts when the vessel economy lands — loop:1a17ce1c4d1)
        const VT = VerbTech(); if (!VT) return "No verbs today.";
        if ((a.tempo || 0) < VT.RULES.salvageAp) return `SALVAGE needs ${VT.RULES.salvageAp} tempo.`;
        a.tempo -= VT.RULES.salvageAp;
        const r = VT.salvage(s, a, act.target);
        if (!r.ok) { a.tempo += VT.RULES.salvageAp; return r.error; }
        log(s, { kind: "verb", verb: 14, actor: a.id, target: r.corpse, text: r.text });
      },
      insight(s, a, act) {
        if (act.action === "report") return report(s, a);   // Scout: not aimed at a target, open to any unit with the trait
        if (a.id !== "player") return "Only the player can use Insight for now.";
        const t = s.actors[act.target], deck = s.insight.decks[act.target], know = s.insight.knowledge.player?.[act.target];
        if (!t || t.defeated || !deck || !know) return "Observe the target first.";
        if (Parley && act.action === "talk") { const no = Parley.cannotTalk(s, a, t); if (no) return no; }   // Parley: language, closed talk, grudges
        const snapshot = { round: s.round, units: Object.values(s.actors), wild: s.wild, playerSeeds: s.seeds || 0,
          alliesOf: Object.fromEntries(Object.values(s.actors).map((u) => [u.id, Object.values(s.actors).filter((v) => v.side === u.side && v.id !== u.id && !v.defeated)])),
          fire: s.arena.map.some((row) => row.includes("f")) };
        const available = insightRules.actionsFor({ deck, know, subject: t, snapshot });
        const def = available.find((x) => x.id === act.action);
        if (!def) return "That Insight action is not unlocked for this target.";
        const price = talkCost(a, act.action, def.cost);
        if (a.tempo < price) return `${def.name} needs ${price} action points.`;
        if (act.action === "bribe" && (s.seeds || 0) < 25) return "Bribing needs 25 Seeds.";
        if (price) spendTempo(s, a, price, def.name);
        if (talkedTooFast(s, a, t, act.action)) { log(s, { kind: "insight", actor: a.id, target: t.id, action: act.action, fizzled: true, text: `${def.name}: ${a.name} talks too fast and it goes past ${t.name}.`, why: ["Speed-Talker: half the action points, and it lands 85% as often."] }); return; }
        const resisted = isMonster(t) && ({ frighten: "fear", taunt: "taunt", talk: "talk", befriend: "standDown" })[act.action];
        if (resisted && EM.resists(t, resisted)) { log(s, { kind: "resist", actor: a.id, target: t.id, text: `${def.name} does nothing to ${t.name}.`, why: [`${EM.data.monsters[t.monster].passive.name}: ${EM.data.monsters[t.monster].passive.text}`] }); return; }
        if (Parley && MindDuel && act.action === "talk") {   // Mind duel: a Talk attempt opens a battle of minds instead of rolling
          const opened = MindDuel.openDuel(s, a.id, t.id, { log, Parley });
          if (opened) return opened;
          log(s, { kind: "insight", actor: a.id, target: t.id, text: `Talk: ${a.name} sits ${t.name} down for a battle of minds.`, why: ["The argument, not the odds, decides who stands down."] });
          return;
        }
        if (act.action === "talk") H.spreadByTalk?.(s, a, t);   // contagious ideas: a carrier's talk is a vector (faith)
        const result = Parley && act.action === "talk"   // Parley: stand-down odds read persuasion, stubborn and agreeable (no MindDuel part: the old roll)
          ? Parley.resolveTalk(s, a, t, deck.cards.some((o) => o.kind === "trait" && o.trait === "guarded"))
          : insightRules.resolveAction(act.action, { subject: t, snapshot, seed: s.seed, deck, actor: a });   // actor: a Persuasive speaker lifts talk-based odds
        for (const effect of result.effects) {
          const target = s.actors[effect.target] || t;
          const immuneStatus = ({ apLoss:"fear", omen:"fear", forceTarget:"taunt", taunt:"taunt", standDown:"standDown", truce:"truce" })[effect.kind];
          if (immuneStatus === "taunt" && hasTrait(target, "perfectConcentration") && seededChance(`${s.seed}:tauntShrug:${target.id}:${s.round}:${a.id}`) < (s.rules.concentration?.perfect?.tauntShrug ?? 0)) { log(s, { kind: "resist", actor: a.id, target: target.id, text: `${target.name} lets the taunt slide off (Perfect Concentration).`, why: ["Half of taunts do not take hold of a perfectly focused mind."] }); continue; }
          if (target.boss && immuneStatus && bossRules?.statusImmune(target,immuneStatus)) { log(s,{kind:"resist",actor:a.id,target:target.id,text:`${target.name} resists ${immuneStatus} while enraged.`,why:[`The boss condition explicitly grants ${immuneStatus} immunity.`]}); continue; }
          if (effect.kind === "leaveBattle") { target.defeated = true; target.escaped = !effect.noXp; target.noXp = !!effect.noXp; target.leaveReason = effect.reason; Spirit()?.onExit?.(s, target, H); }
          else if (effect.kind === "spendSeeds") s.seeds = Math.max(0, (s.seeds || 0) - effect.amount);
          else if (effect.kind === "apLoss" && effect.potencyMul) { target.omen = { multiplier: effect.potencyMul, expiresAfterOwnerTurn: target.ownerTurns + (effect.duration || 1) }; target.omenApLoss = effect.fraction || 0; }
          else if (effect.kind === "apLoss") target.insightApLoss = effect.fraction;
          else if (effect.kind === "loseReaction") target.reaction = 0;
          else if (effect.kind === "nextActionCostAdd" || effect.kind === "makeItWait") target.nextActionCostAdd = effect.amount || 25;
          else if (effect.kind === "allegiance") {
            target.side = effect.side;
            H.mysteryMigrate?.(s, target);   // MCR-06: face-down cards follow their setter (transfer, never strand)
            if (target.dream?.key && effect.side === "player") {
              if (!s.mirror.dreamsBefriended.includes(target.dream.key)) s.mirror.dreamsBefriended.push(target.dream.key);
              recordMirrorEvent(s, { kind: "dream", monster: target.dream.key, via: "holdGaze" });
            }
          }
          else if (effect.kind === "standDown") target.standDownUntil = s.round + effect.rounds;
          else if (effect.kind === "convert" && Conversion) {   // W1.4: the flip resolves here (Talk ▸ Convert): one act, then out
            const r = Conversion.resolveFlip(s, H, a, target, effect.mode);
            if (!r.ok && r.reason) log(s, { kind: "insight", actor: a.id, target: target.id, text: r.reason });   // refused gates speak (undead, unbroken will, spent check); the Talk stays spent, like a failed roll
            else if (r.ok && !r.looped) {
              const act = Conversion.actsFor(s, target)[0];
              Conversion.executeAct(s, H, a, target, act);
              Conversion.convertedOut(s, H, a, target, effect.mode, r.marks, target.side === "player");
            }
          }
          else if (effect.kind === "truce") { target.truceUntil = s.round + effect.rounds; target.truceWith = a.id; }
          else if (effect.kind === "forceTarget" || effect.kind === "taunt") { target.forceTarget = a.id; target.forceTargetUntil = s.round + (effect.duration || 1); if (effect.guardMulVsTarget) target.status.tauntProtection = { label: "Taunt brace", owner: target.id, source: a.id, multiplier: effect.guardMulVsTarget, expiresAt: target.ownerTurns + 1 }; }
          else if (effect.kind === "mustGuardAlly" || effect.kind === "threatenAlly") { const ally = Object.values(s.actors).find(v => v.side === target.side && v.id !== target.id && !v.defeated); if (ally) target.protectAlly = ally.id; }
          else if (effect.kind === "nextChannelHitMul" || effect.kind === "exploitWeakness") { const weak = deck.cards.find(o => o.kind === "weakness" && know.revealed.includes(o.id)); if (weak) target.exploited = { by: a.id, damageType: weak.channel, multiplier: effect.multiplier || 1.5 }; }
          else if (effect.kind === "freeReactionVs" || effect.kind === "readTell") a.freeReactionVs = target.id;
          if (effect.kind === "readTell") { const dr = (s.dreamRecent ||= {}); dr.tells = (dr.tells || 0) + 1; }   // ambient dreams notice read tells
          else if (effect.kind === "omen") { target.omen = { multiplier: effect.potencyMul || 0.9, expiresAfterOwnerTurn: target.ownerTurns + (effect.duration || 1) }; target.omenApLoss = effect.apLoss || 0.5; }
          else if (effect.kind === "noDeception" || effect.kind === "pointOutContradiction") { target.reaction = 0; target.noDeceptionUntil = s.round + (effect.noDeception || 1); }
          else if (effect.kind === "revealIntent" || effect.kind === "ask") {
            target.intentRevealed = true;
            const forecast = clone(s), turn = forecast.order.indexOf(target.id);
            let intent = null;
            if (turn >= 0 && target.ai !== "none") {
              forecast.turnIndex = turn; forecast.phase = "action"; forecast.pending = null;
              forecast.actors[target.id].tempo = Math.max(forecast.actors[target.id].tempo || 0, s.rules.actionPointsPerTurn);
              intent = aiAction(forecast);
            }
            target.revealedIntent = intent ? `${intent.type}${intent.ability ? `: ${ab(intent.ability).name}` : ""}${intent.target ? ` toward (${intent.target.join(",")})` : intent.to ? ` to (${intent.to.join(",")})` : ""}` : "No hostile action is forecast from the current board";
          }
          else if (effect.kind === "nameItChoicesRemove" || effect.kind === "nameHint") s.summonHintCount = (s.summonHintCount || 0) + (effect.nameItChoicesRemove || 1);
          else if (effect.kind === "summonActsNow" || effect.kind === "coordinate") { const ally = Object.values(s.actors).find(v => v.summon?.owner === a.id && !v.defeated); if (ally) { s.order = s.order.filter(id => id !== ally.id); s.order.splice(s.turnIndex + 1, 0, ally.id); } }
        }
        const intentText = result.effects.some(e => e.kind === "ask" || e.kind === "revealIntent") ? ` Likely next action from the current board: ${t.revealedIntent}.` : "";
        log(s, { kind: "insight", actor: a.id, target: t.id, text: result.text + intentText, why: result.effects.map(e => e.kind === "ask" || e.kind === "revealIntent" ? `Intent forecast: ${t.revealedIntent}.` : `Insight applied: ${e.kind}.`) });
        return;
      },
      lens(s, a, act) {
        if (a.tempo < s.rules.actionCosts.utility) return `Changing a lens needs ${s.rules.actionCosts.utility} action points.`;
        const c = C.concepts[act.concept];
        if (!c || (act.concept !== a.primary && act.concept !== a.secondary)) return "Only equipped concepts have an active lens.";
        const p = c.lens.profiles[act.profile]; if (!p) return "Unknown lens profile.";
        if (p.proficiency > a.proficiency) return `${p.name} needs lens proficiency ${p.proficiency}.`;
        if (a.lens[act.concept] === act.profile) return "That lens is already set.";
        if (a.status?.disarmed?.kind === "lens" && a.status.disarmed.concept === act.concept && a.status.disarmed.until >= a.ownerTurns) return "Disarmed: that lens is stripped until it returns.";
        spendTempo(s, a, s.rules.actionCosts.utility, "Lens change"); a.lens[act.concept] = act.profile;
        log(s, { kind: "lens", actor: a.id, text: `${a.name} sets ${c.name} to the ${p.name} lens.`, why: [p.trade, "Effects already committed keep their snapshot."] });
      },
      swap(s, a, act) {
        if (a.tempo < s.rules.actionCosts.swap) return `Swap needs ${s.rules.actionCosts.swap} action points.`;
        if (a.pendingSwap) return "A swap is already pending.";
        const i = a.reserve.indexOf(act.concept); if (i < 0) return "That concept isn't in reserve.";
        const old = a.secondary; spendTempo(s, a, s.rules.actionCosts.swap, "Swap secondary");
        a.reserve.splice(i, 1); if (old) a.reserve.push(old);
        a.secondary = null; a.pendingSwap = act.concept;
        // dependency-bound effects of the removed secondary end now
        if (old === "barrier") {
          s.barriers = s.barriers.filter((b) => b.owner !== a.id);
          if (a.status.parry) a.status.parry = null;
          if (a.status.ward) a.status.ward = null;
        }
        log(s, { kind: "swap", actor: a.id, text: `${a.name} stows ${conceptName(old)} and equips ${conceptName(act.concept)}; it becomes usable at the start of their next turn.`,
          why: [`Effects that depended on ${conceptName(old)} end now. No secondary until then.`] });
      },
      embody(s, a, act) {   // Contains Multitudes (engine.js Multitudes): the Warden pays Inspiration to be one beaten class as well
        const no = H.Multitudes.refuses(s, a, act.classId); if (no) return no;
        H.Multitudes.embody(s, a, act.classId);
      },
      dismissEmbodiment(s, a) { const no = H.Multitudes.dismissRefuses(s, a); if (no) return no; H.Multitudes.end(s, a, "dismissed"); },
      chooseVerse(s,a,act){return Performers.choose(s,a,act.ability);},
      discardVerse(s,a,act){
        const v=a.status?.verse;if(!v)return "No verse is held.";
        if(v.kind==="freestyle"&&a.character==="rapper"&&!a.status.wordplayUsed){a.status.wordplayUsed=true;const ids=classH().borrowPool(s,a,false).filter(id=>id!==v.id);if(ids.length){v.id=Performers.draw(s,a,ids,1)[0];v.choices=[v.id];v.mustTake=true;log(s,{kind:"performance",actor:a.id,text:`Wordplay redraws ${ab(v.id).name}; the one redraw is spent.`});return;}}
        if(v.mustTake&&targeting(s,a.id,v.id).legal.some(q=>apply(s,{type:"ability",actor:a.id,ability:v.id,target:q.at},{preview:true}).ok))return "Wordplay's second draw must be delivered.";
        if(v.freeAp){a.pf=Math.min(a.maxPF,a.pf+ab("freestyle").cost*.5);log(s,{kind:"performance",actor:a.id,text:"The undelivered line returns half its ΦF; the action remains spent."});}
        delete a.status.verse;log(s,{kind:"performance",actor:a.id,text:"The held verse is discarded."});
      },
      dismissUlaula(s,a){   // R6 (Mala, 2026-10-22): the staged free dismiss. Free: no tempo spent.
        const bm = a.birdMountain;
        if (!bm?.red) return "ʻUlaʻula is not lit.";
        if (bm.vows?.neverQuench) return "Sworn: Never-Quench cannot be dismissed.";
        bm.red = null;
        log(s, { kind: "martial", actor: a.id, text: `${a.name} lets the red go out.` });
      },
      vow(s, a, act) {   // Technique stances (Muse-2): a standalone free oath; the restrictions are the price
        if (!Vows) return "Vows are unavailable.";
        if (a.beast || a.monster) return `${a.name} is soulless: mindless things can neither declare nor complete vows.`;   // W4.4: the canonical refusal
        if (a.form?.golden) return "The Self has nothing left to promise: vows can't be declared in gold.";   // locked decision 5: silence in gold; sworn vows persist
        const word = act.target === "word";   // Rama's word (docs/rama-build.md): once a battle, by a character who keeps one
        if (act.target !== "technique" && !word) return "Oaths are sworn on techniques alone; auras, dreams and roles ride their own actions.";
        if (word && !C.characters[a.character]?.swearsWord) return `${a.name} has no word to give.`;
        if (word && a.wordGiven) return `${a.name} has given his word this battle; it is not given twice.`;
        const no = Vows.validate(act.target, act.vow, a, s.rules.inspiration); if (no) return no;
        if (!act.vow?.boon) return "Name a boon to swear.";
        if (Vows.live(s, a).some((v) => v.on === act.target && v.boon === act.vow.boon)) return `The ${Vows.BOONS[act.vow.boon].name} oath already binds you.`;
        // W4.4 D-ruling (one unit one vow, concurrent reading: an unbroken vow of any kind blocks a new one; a vow that ended frees the soul again)
        if (Vows.live(s, a).some((v) => !v.broken)) return `${a.name} already bears a vow: one soul, one promise at a time.`;
        if (word) a.wordGiven = true;
        Vows.swear(s, a, act.target, act.vow, { log });
        if (Sage() && Sage().is(a) && !a.sageDeclared) {   // the lesson lands WITH the vow (SAGE.md coaching)
          const SG = Sage(), d = SG.declareJourney(a.ownerTurns ?? 0);
          if (d) {
            log(s, { kind: "declare", actor: a.id, text: d.encounter });
            log(s, { kind: "declare", actor: a.id, text: d.reveal });
            for (const e of ["pv", "vow"]) { const line = SG.coach(e); if (line) log(s, { kind: "sage", actor: a.id, text: line }); }
            a.sageDeclared = true;
          }
        }
      },
      ability(s, a, act, internal) {   // MY-02: prepaid authority rides the internal 4th arg (verified card-consumption only); a smuggled public field buys nothing
        if (typeof act.ability === "string" && act.ability.startsWith("boss_sealednext_")) {
          const SN = sealedNext();
          if (!SN) return "That technique is not in this fight.";
          const block = SN.castBlock(s, a, act.ability);
          if (block) return block;
          const before = a.pf;
          const spend = spendTempo(s, a, 30, "Technique");
          if (spend) return spend;
          const err = SN.castFromActor(s, a, act.ability);
          if (err) { a.pf = before; return err; }
          log(s, { kind: "act", actor: a.id, ability: act.ability, text: `${a.name} uses ${ab(act.ability)?.name || "a technique"}.` });
          return;
        }
        const songError=Performers?.beforeAbility(s,a,{...ab(act.ability),ability:act.ability});if(songError)return songError;
        if (Courtroom) { const no = Courtroom.violenceGate(s, H, a); if (no) return no; }   // W1.3: no brawling in court
        if ((a.sealedTechs || []).includes(act.ability)) return `${ab(act.ability)?.name || act.ability} is sealed by the court: cast nothing sealed.`
        if (a.status?.offTempo && act.ability === a.status.offTempo.banned && (a.status.offTempo.expiresAt ?? 99) > (a.ownerTurns ?? 0)) return `${ab(act.ability)?.name || act.ability} is off-tempo: Fixed Gaze forbids the last technique for a round.`;   // hotbuilds W1b: the primed answer's price
        if (a.status?.sealed && ab(act.ability)?.tier !== "basic") return `${ab(act.ability)?.name || act.ability} is sealed (${a.status.sealed.by || "debt"}): techniques and ults are closed; basics remain.`;   // W1.3: confiscation binds
        if (!abilitiesOf(a).includes(act.ability)) return "That ability isn't available with this loadout.";
        { const sea = H.fruitBlocked?.(s, a, act.ability, act); if (sea) return sea; }   // Sinkerfruit: damped by water, soaking or cuffs
        { const held = H.Tally?.heldReason(s, a, act.ability); if (held) return held; }   // collateral (engine/tally.js)
        if (Vows) { const no = Vows.refuses(s, a, "ability", ab(act.ability)); if (no) return no; }   // Vows: Single Mind, Burned Bridge
        if (Vows && act.ability === "audition") { const no = Vows.validate("role", act.vow, a, s.rules.inspiration, s); if (no) return no; }   // role vows ride the audition
        const m = manifest(s, a, act.ability, act);
        if (ab(act.ability)?.answerOnly) return `${m.name} answers; it cannot be cast.`;   // answer-only techniques (Fixed Gaze) never commit own-turn (triage 2026-11-04)
        { const cres = ab(act.ability)?.crescendo; if (cres) m.crescendo = cres; }   // the manifest is fresh: carry the def's Crescendo bend on it (engine.js is at its size cap)
        { const no = H.Inspiration.crescendoRefuses(s, a, m); if (no) return no; }   // a Crescendo technique needs its Inspiration and only one is in force (ledgers.js)
        const crescendoFree = H.Inspiration.crescendoFree(s, a, act.ability, m); if (crescendoFree) Object.assign(m, { tempoCost: 0, cost: 0, lfPrice: 0 });   // the bend: this cast is free (stamped at commit)
        const sigFrom = act.from ? H.validSignalOrigin(s, a, m, act.from) : null;
        if (act.from && !sigFrom.ok) return sigFrom.error;
        const src = sigFrom?.ok ? { ...a, x: act.from[0], y: act.from[1] } : a;   // signal origin (machine P3): geometry reads the marker tile; costs stay on the caster
        const quickened = act.quickened || null;
        if (a.quickenedSpent?.[act.ability]) return "This ultimate was spent by Last Word for the rest of the battle.";
        if (quickened && !["snap", "lastWord"].includes(quickened)) return "Unknown Quickened mode.";
        if (quickened && (act.announce || act.deception || m.timing === "delayed" || m.effect !== "damage")) return "Quickened actions must be immediate attacks without an announcement or deceptive tell.";
        if (quickened === "lastWord" && m.tier !== "ultimate") return "Last Word can only spend an ultimate.";
        if (quickened === "snap" && !["basic", "refined", "ultimate"].includes(m.tier)) return "Snap requires a damaging technique.";
        const extraTempo = Math.max(0, Math.floor(act.overclock || 0));
        const freeFirst = H.freeFirstFree?.(a, m);   // hotbuild free first use (W0b): hoisted — the early tempo gate must agree with the menu (triage 2026-11-04)
        const detailTax = !crescendoFree && hasTrait(a, "attentionToDetail") && m.effect === "barrier" ? 5 : 0;   // Attention to Detail: sturdier craft costs slightly
        if (extraTempo && H.mindset(a)?.noOverclock) return "Craftsman's Mindset: no overclocking.";
        if (extraTempo > s.rules.maxOverclockPerAction || extraTempo % 5) return `Overclock must be in 5-point steps up to ${s.rules.maxOverclockPerAction} AP.`;
        if (extraTempo && !["damage", "field"].includes(m.effect)) return "Only attacks can be overclocked.";
        if (!internal?.prepaid && !freeFirst && a.tempo < m.tempoCost + detailTax && !extraTempo) return `${m.name} needs ${m.tempoCost + detailTax} action points (have ${a.tempo}); choose overclock to borrow against a future turn.`;
        if (m.scribedEffects?.some(e=>e.requires?.includes("observedIncomingChannel")) && !a.lastDamageType) return "This effect needs an observed incoming harm channel before casting.";
        if (act.ability === "adaptiveBrace" && !a.lastDamageType) return "Adaptive Brace needs an observed incoming attack before it can attune.";
        if (act.ability === "measureTwice" && (a.tempoDebt || 0) > 0) return "Care cannot be taken in haste: pay off your tempo debt first.";
        if (act.ability === "measureTwice" && a.status?.care?.turn === a.ownerTurns) return "You are already taking care this turn.";
        if (act.ability === "honedEdge" && !a.lastTechnique) return "Use the technique you mean to practise first; Honed Edge hones the last one you used.";
        if (act.ability === "honedEdge" && a.practice?.ability === a.lastTechnique) return `You are already practising ${ab(a.lastTechnique).name}.`;
        if (act.ability === "masterwork" && !(a.practice?.stacks > 0)) return "Masterwork needs practice behind it: hone a technique and use it first.";
        if (a.promise?.surrender === act.ability) return `Your Public Promise has surrendered ${ab(act.ability).name} until it resolves.`;
        if (ClassRuntime && !s.preview) { const ce = ClassRuntime.beforeAbility(s, a, { ...m, id: act.ability }, classH()); if (ce) return ce; }
        if (!s.preview && m.tier === "ultimate") H.Inspiration.witness(s, a, "seesUltimate", a.id);   // Inspiration: seeing an ultimate   // ClassRuntime: vows, laws, silence, dependence
        if (presidentEffects.has(m.effect)) {
          if (!presidentRules) return "President rules are unavailable.";
          if (m.effect === "presidentDirection" && !presidentRules.officeValid(presidentUnits(s).find(u=>u.id===a.id))) return "Executive Direction needs a valid office.";
          if (m.effect === "presidentLaw" && !presidentRules.officeValid(presidentUnits(s).find(u=>u.id===a.id))) return "Due Process needs a valid office.";
          if (m.effect === "presidentGuarantee" && !a.promise) return "Credible Guarantee needs an active promise.";
          if (m.effect === "presidentOffice" && (a.debt || a.exposedFalseClaim)) return "Credibility Debt or an exposed false claim prevents taking office.";
          if (m.effect === "presidentAccord" && !(a.primary === "legitimacy" && a.secondary === "strategic_commitment" && presidentRules.officeValid(presidentUnits(s).find(u=>u.id===a.id)))) return "The Accord Holds needs both concepts and a valid office.";
          if (m.effect === "presidentPromise" && !act.objective && act.target && actorAt(s,...act.target)?.side===a.side && (act.target[0]!==a.x||act.target[1]!==a.y)) return "A promise target must be an opponent or an empty tile.";
        }
        if (m.effect === "grandConjunction" && !(s.terrainEffects||[]).some(e=>e.kind==="star"&&e.owner===a.id&&s.actors[e.owner]?.ownerTurns<e.expiresAt)) return "An empty sky: chart at least one star first (no cost).";
        if(act.ability==="longView"&&a.moved)return "Long View requires you to stand still for the entire turn; cast it before moving.";
        if (act.deception && !act.announce) return "A deceptive range is only a modification to an announced ultimate.";
        if (act.deception && m.tier !== "ultimate") return "Only ultimates can carry a deceptive tell.";
        if (act.deception && !hasDeception(a)) return "Equip Deception as a primary or secondary concept to make a false-range announcement.";
        if (act.deception && a.noDeceptionUntil >= s.round) return "The contradiction was exposed; this character cannot use Deception this round.";
        if (act.deception && ab(act.ability).timing === "delayed") return "Delayed abilities cannot use a false-range announcement in this prototype.";
        if (act.deception && (act.reveal || s.disclosures[a.id][act.ability] || Object.values(s.knowledge).some(k => k[a.id]?.abilities[act.ability]))) return "Your opponents already know this technique's true behavior, so its range cannot be bluffed.";
        const trueRange = declaredRange(m);
        if (act.deception && trueRange <= 1) return "A false-range announcement needs an ability with more than 1 tile of reach.";

        const mastered = !!s.rules.mastery && (a.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === s.rules.mastery.trait);   // Mastery: ultimates at will
        const sequelFilm = act.ability === "setTheScene" && Director && hasTrait(a, "awardWinningDirector") && a.ultimateCharge < s.rules.ultimateChargeMax && (a.inspiration || 0) >= Director.rules.sequelCost;   // sequels run on prestige, not budget: unannounced, 1 Inspiration, no bar needed
        if (m.tier === "ultimate" && !internal?.prepaid && !mastered && !sequelFilm && a.ultimateCharge < s.rules.ultimateChargeMax) return `Needs ${s.rules.ultimateChargeMax} ultimate charge (have ${a.ultimateCharge}).`;   // MCR-04: a prepaid reveal trusts the set-time bar payment
        if (m.tier === "ultimate" && dreamSpaceRules?.ultimatesBlocked(a, s.dreamSpace, s.rules)) return "A dream-finishing ultimate needs the owner inside their unburned dream with a full ULT bar.";
        const dreamUltimate = m.tier === "ultimate" && !!dreamSpaceRules?.canFinishUltimate(a, s.dreamSpace, s.rules);
        if (act.announce && m.tier !== "ultimate" && m.effect !== "damage") return "Only ultimates and attacks can be announced.";   // Mala 2026-10-15: announce is offered on any offensive technique
        if (act.ability === "setTheScene" && !sequelFilm && !act.announce) return "Set the Scene needs its announcement (Quiet on set): the mark gets a response unless this is a prestige sequel.";   // Mala 2026-10-15: announce is a modifier, mandatory only where the technique breaks without it
        // A self-cast needs no tile: the UI sends none (targeting() marks it selfCast), and class-runtime and Perform self
        // checks compare the tile with the caster's. Without this every self technique of theirs was refused (Mala, 2026-10-14).
        const aim = act.target || (m.target === "self" ? [a.x, a.y] : null);
        const t = target(s, src, m, aim?.[0], aim?.[1], act);
        if (!t.ok) return t.error;
        { const me = ClassRuntime?.mise?.validate(s, a, act, m, classH()); if (me) return me; }   // Mise en Place: the whole station plan, before anything is paid
        { const he = ClassRuntime?.homology?.validate(s, a, act, m, classH()); if (he) return he; }   // Homology: the two techniques compared, before anything is paid
        if (m.timing === "delayed" && !(t.targets || []).some(id=>s.actors[id] && !s.actors[id].defeated && !s.actors[id].notArrived))
          return "A delayed technique needs a living character whose next turn can trigger it; wild creatures have no character turn.";
        const inspired = H.inspiredPay?.(s, a, m);   // a full bar and 1 Inspiration pay an ultimate's whole ΦF
        if (!internal?.prepaid && !freeFirst && a.pf < m.cost && !inspired) return `Needs ${m.cost} ΦF (have ${a.pf}).`;
        const inspirationPrice = ab(act.ability)?.inspirationPrice || 0;   // a Crescendo's price (hotbuilds W1c): Inspiration, read off the def (no manifest carry)
        if (!internal?.prepaid && inspirationPrice > 0 && (a.inspiration || 0) < inspirationPrice) return `Needs ${inspirationPrice} Inspiration (have ${a.inspiration || 0}).`;
        if (!internal?.prepaid && m.lfPrice && a.lf <= m.lfPrice) return `${m.name} costs ${m.lfPrice} LF: you need more than that left (have ${a.lf}).`;   // an ability's LF price (Ajin L1; the pattern of the rite cut at ~1334): the caster must stay above 0 LF
        if(presidentRules){for(const h of Object.values(s.actors)){if(!h.law||h.law.until<s.round)continue;const hu=presidentUnits(s).find(u=>u.id===h.id),au=presidentUnits(s).find(u=>u.id===a.id),r=presidentRules.breaksLaw(hu,au,{delivery:m.delivery},{...presidentContext(s),round:s.round});if(r.broke){syncPresidentUnit(s,r.actor);log(s,{kind:"law",actor:a.id,target:h.id,text:`${a.name} breaks ${h.name}'s Due Process rule (${m.delivery}) and becomes an outlaw.`,why:["The rule applies to its maker and units in jurisdiction."]});}}}
        // committed: pay once, snapshot (spec §7)
        const starTax = ClassRuntime?.actor ? ClassRuntime.actor.taxFor(s, a, t.targets || []) : 1;   // GDP: the star's tax lands once per technique, overclock unmultiplied
        const taxedBase = (m.tempoCost + detailTax) * starTax;
        if (!internal?.prepaid && !freeFirst && a.tempo < taxedBase && !extraTempo) return `${m.name} needs ${taxedBase} action points (have ${a.tempo}): ×${starTax} to target the star; choose overclock to borrow against a future turn.`;
        if (!internal?.prepaid && !freeFirst) { const tempoError = spendTempo(s, a, taxedBase + extraTempo, m.name, true); if (tempoError) return tempoError; H.adhdPaid?.(s, a, act.ability); }   // prepaid set intents (Muse W2.5, MY-02 internal): paid at set time
        else if (!internal?.prepaid && freeFirst && extraTempo) { const tempoError = spendTempo(s, a, extraTempo, m.name, true); if (tempoError) return tempoError; }   // free-first covers the ability's own cost, never an overclock chosen on top: the debt still lands (triage 2026-11-04)
        if (Vows && act.ability === "audition" && act.vow?.boon) Vows.swear(s, a, "role", act.vow, { log });   // sworn before the part is taken, read at play
        if (barsTooFast(s, a, act.ability)) { log(s, { kind: "act", actor: a.id, fizzled: true, text: `${a.name} spits ${m.name} too fast and it goes past everyone.`, why: ["Speed-Talker: his attacks are talk, at half the action points, and they land 85% as often."] }); return; }
        if (quickened === "lastWord") { a.quickenedSpent ||= {}; a.quickenedSpent[act.ability] = true; }
        if (inspired && !internal?.prepaid) { const n = s.rules.inspiration?.ultimatePoint ?? 1; H.Inspiration.spend(s, a, n, "perform"); log(s, { kind: "inspiration", actor: a.id, spent: n, text: `${a.name} spends ${n} Inspiration: it pays ${m.name}'s ${m.cost} ΦF.`, why: [`Inspired ultimate: with a full bar, one Inspiration pays the whole ΦF cost.${mastered ? " Mastery: the bar is not spent." : " The bar and the AP are still spent."}`] }); }   // MCR-04: prepaid ΦF is never paid again with Inspiration
        else if (!internal?.prepaid && !freeFirst) a.pf -= m.cost;   // prepaid at set time
        if (inspirationPrice > 0 && !internal?.prepaid) { H.Inspiration.spend(s, a, inspirationPrice); log(s, { kind: "inspiration", actor: a.id, spent: inspirationPrice, text: `${a.name} spends ${inspirationPrice} Inspiration on ${m.name}.`, why: ["A Crescendo's price is paid on cast, beside AP and ΦF (never a perform)."] }); }
        if (m.lfPrice && !internal?.prepaid) { a.lf -= m.lfPrice; log(s, { kind: "act", actor: a.id, text: `${a.name} pays ${m.lfPrice} LF for ${m.name} (${a.lf}/${a.maxLF}).`, why: ["A technique's LF price is paid on cast, after the cast is legal and before anything resolves; it can never leave the caster below 1 LF."] }); }
        if (m.miseStation) ClassRuntime.mise.redeem(s, a, m, classH());   // Mise en Place: the prepared station is spent with the cast
        if(m.freeFocus)H.FocusPlans?.commit(s,a,act,t);
        if (m.tier === "ultimate" && mastered && !dreamUltimate) log(s, { kind: "charge", actor: a.id, text: `${a.name} needs no charge for ${m.name}: mastery.`, why: ["Mastery: ultimates cost their action points and ΦF, and nothing else."] });
        else if (m.tier === "ultimate" && sequelFilm && !internal?.prepaid) { H.Inspiration.spend(s, a, Director.rules.sequelCost, "perform"); log(s, { kind: "charge", actor: a.id, text: `${a.name} films a sequel on prestige, unannounced: ${Director.rules.sequelCost} Inspiration.` }); }
        else if (m.tier === "ultimate" && !internal?.prepaid) { a.ultimateCharge -= s.rules.ultimateChargeMax; if (a.status.ward?.flow) a.status.ward = null; a.flowOn = false; log(s, { kind: "charge", actor: a.id, text: `${a.name} spends ${s.rules.ultimateChargeMax} ultimate charge on ${m.name}.` }); }   // spending the bar ends the flow state (ward included)   // MCR-04: prepaid reveals spend no bar or Inspiration beyond the set payment
        s.stats.abilityUses[act.ability] = (s.stats.abilityUses[act.ability] || 0) + 1; H.Exposure.used(s, a, act.ability, m);
        if (crescendoFree) H.Inspiration.crescendoFreeUsed(a, act.ability);   // the free cast is spent at commit
        if (m.crescendo) H.Inspiration.crescendoArm(s, a, m);   // the Crescendo spends its Inspiration and bends the rule once the cast is committed
        if (m.oncePerTurn) (a.onceTurns ||= {})[act.ability] = a.ownerTurns;   // once-per-turn stamp at commit (previews run on a clone, so this never leaks)
        if (m.oncePerBattle) (a.onceBattle ||= {})[act.ability] = true;   // J6: once-per-battle stamp at commit
        if (freeFirst === "turn") (a.freeTurns ||= {})[act.ability] = a.ownerTurns;   // free-first stamp at commit (previews run on a clone, so this never leaks)
        if (freeFirst === "battle") (a.freeBattle ||= {})[act.ability] = true;
        if (CRAFT) {   // practice and care bookkeeping (the manifest above already read the stacks this use benefits from)
          if (a.status?.care && !CRAFT_OWN.has(act.ability)) a.status.care = null;                       // the care is spent on this technique
          if (act.ability === "masterwork") { if (a.practice) a.practice.stacks = 0; }
          else if (!CRAFT_OWN.has(act.ability)) {
            if (a.practice?.ability === act.ability) a.practice.stacks = Math.min(H.craftMax(a), a.practice.stacks + 1);
            else if (a.practice?.stacks > 0) { a.practice.stacks = Math.max(0, a.practice.stacks - CRAFT.lostOnOther); log(s, { kind: "craft", actor: a.id, text: `${a.name}'s hand drifts from ${ab(a.practice.ability).name}: practice ${a.practice.stacks}/${H.craftMax(a)}.` }); }
            if (m.tier !== "ultimate") a.lastTechnique = act.ability;
          }
        }
        const d = ab(act.ability); const why = m.notes.slice();
        if (src !== a) why.push(`Originates from the marker at (${act.from[0]},${act.from[1]}).`);
        if (starTax > 1) why.push(`Genre-Defining Performance: ×${starTax} AP to target the star (paid once for the technique).`);
        let mult = a.omen ? a.omen.multiplier : 1;
        if (mult !== 1) why.push(`Omen weakens this action ×${mult}.`);
        if (m.effect === "damage" && a.passives?.abilityDamageMul && a.passives.abilityDamageMul !== 1) {
          mult *= a.passives.abilityDamageMul;
          why.push(`Character traits adjust ability damage ×${a.passives.abilityDamageMul}.`);
        }
        if (m.delivery === "contact" && (m.effect === "damage" || m.effect === "charge") && hasTrait(a, "denseMuscle")) {   // Dense Muscle (Mala, 2026-10-19): physical blows land doubled
          mult *= 2; why.push("Dense Muscle doubles the physical blow.");
        }
        if (m.effect === "damage" && a.status?.woozy) {   // still woozy from surgery (account/surgery.js)
          mult *= a.status.woozy.damageMul || 0.9; why.push(`Woozy from surgery: ability damage ×${a.status.woozy.damageMul || 0.9}.`);
        }
        const dreamMods = dreamSpaceRules?.modsFor(a, s.dreamSpace, s.arena.objects) || {};
        if (dreamMods.potencyMul) { mult *= dreamMods.potencyMul; const hole = hasTrait(a, "trepanation") && (!s.dreamSpace || !dreamSpaceRules.contains(s.dreamSpace, a.x, a.y)); why.push(`${hole ? "Trepanation" : "Dream Space"} potency ×${dreamMods.potencyMul}.`); }
        if (a.summon?.trueFormPotencyMul) { mult*=a.summon.trueFormPotencyMul;why.push(`Summon's true form strengthens technique potency ×${a.summon.trueFormPotencyMul}.`); }
        if (a.committed?.potencyMul && a.committed.expiresAt > a.ownerTurns) { mult *= a.committed.potencyMul; why.push(`Burn the Boats commitment strengthens the technique ×${a.committed.potencyMul}.`); }
        if (act.ability && m.concept === "legitimacy" && a.mandate && presidentRules) { const used=presidentRules.useMandate(presidentUnits(s).find(u=>u.id===a.id),d); syncPresidentUnit(s,used.actor); if(used.mul>1){mult*=used.mul;why.push(`Fulfilled commitment grants Mandate: this authority technique ×${used.mul}.`);} }
        if (extraTempo) { mult *= (m.tempoCost + extraTempo) / m.tempoCost; why.push(`Overclock invests ${extraTempo} extra AP (×${((m.tempoCost + extraTempo) / m.tempoCost).toFixed(2)} potency) and creates tempo debt if the action exceeds this turn's budget.`); }
        if (quickened === "snap") { mult *= 0.6; why.push("Quickened (Snap): no reaction possible; potency ×0.6."); }
        if (quickened === "lastWord") why.push(`Quickened (Last Word): ${m.name} is spent for this battle.`);
        if(act.orderPotencyMul){mult*=act.orderPotencyMul;why.push(`Executive Direction requested this technique at ×${act.orderPotencyMul} potency using the ally's own action.`);a.pendingOrder=null;}
        mult *= Performers?.techniqueCommitted(s,a,m,classH()) || 1;
        const deception = !!act.deception;
        if (act.reveal || s.disclosures[a.id][act.ability]) {
          if (!s.disclosures[a.id][act.ability]) {
            s.disclosures[a.id][act.ability] = true;
            for (const o of Object.keys(s.knowledge)) if (s.knowledge[o][a.id]) s.knowledge[o][a.id].abilities[act.ability] = true;
            log(s, { kind: "reveal", actor: a.id, text: `${a.name} reveals ${m.name}: “${d.reveal}”`, why: [`Revealed techniques gain ×${s.rules.revealMultiplier} potency for this encounter. Repeating it adds nothing.`] });
          }
          mult *= s.rules.revealMultiplier; why.push(`Revealed ×${s.rules.revealMultiplier}.`);
        }
        if (!deception) for (const o of Object.keys(s.knowledge)) if (s.knowledge[o][a.id]) s.knowledge[o][a.id].abilities[act.ability] = true;   // ordinary use exposes the technique before any response window
        const claimedRange = deception ? Math.max(1, trueRange - 1 - (m.falseTellRangeAdd || 0)) : null;
        const announcedTiles = deception ? rangeEnvelope(s, a, claimedRange) : t.tiles;
        const inst = { ...m, gap:act.gap||"north", ignoreCover:act.ability==="longView", owner: a.id, origin:[src.x,src.y], sourceHeight: heightAt(s, src.x, src.y), mult, tiles: t.tiles, announcedTiles, deception, claimedRange, part: act.part || "foliage",
          section: t.section || null, sourceTile: t.source || null, projectionProperty: t.property || null, projectionAxis: t.axis || null, projectionStoppedAt: t.stoppedAt || null, fragment: t.fragment || null, fragmentId: act.fragmentId || null,
          route: t.route || null, targets: t.targets || [], aim: t.aim || act.target || null, maidFilth: !!t.maidFilth, objective:act.objective||t.objective||null, surrender:act.surrender||null, stake:act.stake||null, method:act.method||null, force:act.force||null, gear:act.gear||null,
          misePlan: act.stations || null, miseOrder: act.order || null, rule:act.rule||null, participants:act.participants||null, restriction:act.restriction||null, orderAbility:act.orderAbility||null, orderTarget:act.orderTarget||null,
          announced: !!act.announce, revelation: act.announce ? Math.max(1, Math.min(3, Math.round(+act.revelation || 1))) : 0, quickened, role: act.role || null, directHit: !!(hasTrait(a, "drunkenMonkey") || m.directHit) };   // direct-hit: the style grants it to every attack; techniques may carry it; role: the Actor's audition pick
        if (dreamUltimate) {
          inst.dreamFinisher = `dream-ultimate-${++s.seq}`;
          s.dreamSpace.ultimateCommit = inst.dreamFinisher;
          log(s, { kind: "dreamUltimate", actor: a.id, ability: inst.ability, text: `${a.name} commits ${inst.name} through their Dream Space. The seal holds until the technique resolves, then the dream closes.`,
            why: ["Full ULT is paid once. The dream bonus and sealed movement remain through announcement and responses. No extra aura pulse is granted."] });
        }
        a.lastTechniqueConcept = inst.concept;
        ClassRuntime?.homology?.cast(s, a, act, classH());   // Homology: the first reuse of a technique in a live Lineage Ledger is announced
        // Genius wilds (the Sasquatch) watch techniques too: it learns what it sees, and a tamed one keeps what it learned.
        const witnesses = [...Object.values(s.actors), ...(s.wild || []).filter((u) => u.form === "unit" && u.lf > 0 && ((u.traits || []).includes("genius") || (u.traits || []).includes("copyEye")))];
        for (const observer of witnesses) if (!observer.defeated && (observer.id === a.id || hasSight(s, observer.x, observer.y, a.x, a.y))) {
          const seen = s.observedAbilities[observer.id] ||= [];
          (((((s.observedAt ||= {})[observer.id] ||= {})[a.id] ||= {})[act.ability]) ||= {}).round = s.round;   // Homology H2: when this witness last saw THIS user cast it (a parallel record; the array above stays once-per-id); the Indexing flag, when set, stays until the record is rebuilt (nothing clears it today; loop 1a1a2f77a7a-ae73)
          if (!seen.includes(act.ability)) {
            seen.push(act.ability);
            // A genius may learn a technique after seeing it once (insight.js geniusLearns). A Copy Eye always does — once per battle (anime batch).
            const eyeDef = ab(act.ability);
            if (observer.id !== a.id && hasTrait(observer, "copyEye") && !observer.copied && eyeDef && eyeDef.tier !== "ultimate" && !eyeDef.pairs && !eyeDef.merge && !abilitiesOf(observer).includes(act.ability)) {
              observer.copied = act.ability; (observer.learned ||= []).push(act.ability);
              log(s, { kind: "effect", actor: observer.id, learnedTechnique: { ability: act.ability, source: a.id }, text: `${observer.name}'s eye drinks ${a.name}'s ${eyeDef.name || act.ability}: theirs for this battle.`, why: ["Copy Eye: one witnessed technique per battle, this battle only, at normal costs."] });
            } else if (observer.id !== a.id && insightRules?.geniusLearns?.({ observer, ability: act.ability, def: eyeDef, seed: s.seed, round: s.round, alreadyHas: abilitiesOf(observer) })) {
              (observer.learned ||= []).push(act.ability);
              log(s, { kind: "effect", actor: observer.id, learnedTechnique: { ability: act.ability, source: a.id }, text: `${observer.name} watches ${a.name}'s ${m.name} once and gets it: ${m.name} is now theirs for this battle.`, why: ["Genius: a small chance to learn a technique after seeing it once."] });
              if (observer.id !== a.id) ClassRuntime?.Martial?.witness?.(s, observer, (ab(act.ability) || {}).potency, H);   // Martial Artist: power witnessed is Inspiration
              const bt = H.EmergentIdeas?.active(observer).find((x) => x.id === "breakthrough")?.effects;   // Genius + Imagination
              if (bt) { log(s, { kind: "emergentIdea", actor: observer.id, text: `Breakthrough: ${observer.name} sees how ${m.name} works and what else it could be.`, why: ["Genius + Imagination: a technique learned by watching is a Breakthrough."] });
                H.Inspiration.gain(s, observer, bt.inspiration, "A Breakthrough is worth Inspiration."); }
            }
          }
        }
        // A free Fix Attention (focus-plans.js) pays no charge: free and charging, it was a charge farm that sent Bastet's
        // AI into aura upkeep instead of shooting (trio damage -14 a battle, 2026-10-15). rules.focusRenewal.charges = true restores it.
        // An announced Feint pays no charge either (Mala, 2026-10-17): 5 AP of telegraphed nothing is bait, not a blow,
        // and charging it farmed 0 to a full bar in a turn (seed 3065690639). Unannounced Feint is full price and charges normally.
        if ((!m.freeFocus || s.rules.focusRenewal?.charges) && !(act.ability === "feint" && inst.announced) && !m.samplerNoCharge && !m.noCharge) {   // Sampler's free Juxtapose charges nothing; soul arts never charge (J6r)
          // Empty attacks charge nothing (Mala, 2026-10-17; battle seed 2122468325): damage defers its charge to
          // resolution, where settleDeferredCharge grants it only if someone was hit. Utility still charges on use.
          const chargeArgs = [inst.concept, `Using ${inst.name} as ${ownerOfConcept(a, inst.concept) || "borrowed"} concept.`, inst.compositionApplied ? s.rules.ultimateChargePairBonus : 0,
            MaidSystems?.utilityChargeMultiplier(m) || 1, MaidSystems?.canRechargeAura(a, inst) || false, borrowedCharges(a, inst)];
          if (m.effect === "damage" || m.effect === "paleStampede") inst.deferredCharge = chargeArgs;   // a stampede that tramples no one charges nothing either
          else chargeUltimate(s, a, ...chargeArgs);
        }
        H.fruitCast?.(s, a, act, inst);   // Sinkerfruit (Locusfruit): a recall costs 2 more PhiF and empties its room; a palace taxes or refunds
        log(s, { kind: "act", actor: a.id, ability: act.ability, tiles: deception ? announcedTiles : t.tiles, route: deception ? null : (t.route || null),
          text: `${a.name} uses ${m.name} (${d.tier}, ${conceptName(m.concept)}, ${m.delivery}${m.area.shape !== "single" ? ", " + m.area.shape : ""}) for ${m.cost} ΦF.`, why });
        // AGI Takeoff witness rule: the third deception technique an AGI sees (anyone's but its
        // own) closes the window — deception immune immediately, Feint learned.
        if (typeof m?.concept === "string" && m.concept.toLowerCase() === "deception") {
          for (const u of Object.values(s.actors)) {
            if (u.defeated || u.id === a.id || u.character !== "agi") continue;
            const tk = u.takeoff ||= { exp: {}, immune: [], sightings: 0, transcended: 0, completed: 0, taught: 0, paced: false };
            if ((tk.exp.deception || 0) >= 5) continue;
            tk.sightings += 1;
            if (tk.sightings >= 3) {
              tk.exp.deception = 5; tk.immune.push("deception");
              log(s, { kind: "adapt", actor: u.id, concept: "deception", text: `${u.name} has seen the trick three times — Deception is understood, immune.`, why: ["Takeoff witness rule: the window is gone."] });
              if (!tk.taught) { tk.taught = s.round; u.learned ||= []; if (!u.learned.includes("feint")) u.learned.push("feint"); }
              if (!tk.transcended && (tk.immune.length >= 2 || (u.ownerTurns || 0) * (tk.completed ? 2 : 1) >= 6)) { tk.transcended = s.round; log(s, { kind: "transcend", actor: u.id, text: `${u.name} transcends: every opponent now fears it most.`, why: ["2 immunities or takeoff +6: fear aggro."] }); H.PostHuman.join(s, u); }
            }
          }
        }
        if (act.announce && !sequelFilm) {
          if (!deception && !d.flatAnnounce && act.ability !== "feint") inst.mult *= inst.revelationMul = s.rules.revelation?.mults?.[inst.revelation] ?? s.rules.announceMultiplier;   // Revelation tiers (Muse W1.1): Name ×1.4, Explain ×1.65, Show it all ×2   // an orb ultimate is a flat 100 (docs/orbs.md): a Guard leaves 50. Feint discounts instead of buffing (Mala's Feint ruling).
          return openResponseWindow(s, a, inst, d);
        }
        if (a.character === "actor" && hasDeception(a) && d.target === "enemy" && d.area.shape === "single" && d.timing !== "delayed") {
          const extras=Object.values(s.actors).filter(t=>!t.defeated&&t.side!==a.side&&t.id!==inst.targets[0]&&hasSight(s,a.x,a.y,t.x,t.y)).map(t=>({id:t.id,visible:true}));
          const audience=Postures?.resolve({character:a.character,concept:"deception",ability:act.ability,event:"techniqueResolved",eligible:extras,manyFaces:a.lens.deception==="manyFaces"});
          if(audience){inst.audienceOnly=true;inst.audienceIds=audience.recipients;inst.audienceTempo=audience.tempo;log(s,{kind:"posture",actor:a.id,target:inst.targets[0],text:audience.log,why:["The named target alone receives the actual technique; the audience receives a response window to look away."]});return openResponseWindow(s,a,inst,d);}
        }
        if (!inst.audienceOnly && H.openReactionWindow(s, a, inst, d)) return;   // reactive defense: a seen ranged attack can be answered (window.js)
        resolveAbility(s, src, inst);
        if (src !== a) for (const k of ["pf", "tempo", "tempoDebt", "ultimateCharge"]) a[k] = src[k];   // signal origin (machine P3): resolve-side costs persist on the caster
        H.finishDreamUltimate(s, a, inst);
      },
    };

    function resolvePrune(s,a,inst){
      const [x,y]=inst.tiles[0],part=inst.part||"foliage",ch=s.arena.map[y][x];
      ClassRuntime?.mise?.prune(s,a,x,y,classH());   // Mise en Place: a marker on the pruned tile comes off
      const obj=s.arena.objects?.find(o=>o.x===x&&o.y===y)||null;
      const plant=obj?.kind==="plant", tree=plant&&obj.form==="tree";
      const treeHazard=tree&&["thorns","limbDrop"].includes(obj.trait);
      const attachedHazard=!!(obj&&(obj.hazard||obj.status?.hazard));
      const groundHazard=ch==="^"||(a.character==="arborist"&&ch==="*");
      let valid=false, removed="", prunedThorn=null;
      if (patchAt(s, x, y)) { valid = true; removed = "Pioneer Patch"; }
      const thornHere=(s.terrainEffects||[]).find(e=>e.kind==="thorn"&&e.tiles?.some(([tx,ty])=>tx===x&&ty===y)&&s.actors[e.owner]?.ownerTurns<e.expiresAt);
      if(!valid&&thornHere&&(part==="hazard"||part==="foliage")){valid=true;prunedThorn=thornHere;removed=(thornHere.label||"Thorn growth").toLowerCase();const e=findOpp("pruning","thorn","clears",null,"clearThorns");if(e){edgeUsed(s,e.id);removed=`${removed} [${e.id}]`;}}
      if(!valid&&part==="foliage"){
        if(plant&&!tree&&!obj.protected&&a.character!=="arborist"){valid=true;removed=vegetation?.label?.(moduleArena(s.arena).objects.find(o=>o.id===obj.id))||obj.type;}
        else if(ch==="h"&&!obj&&a.character!=="arborist"){valid=true;removed="hedge foliage";}
        else if(a.character==="arborist"&&plant&&obj.form==="hedge"&&attachedHazard){valid=true;removed=`${obj.type} hazard`;}
      } else if(!valid&&part==="hazard"){
        if(groundHazard){valid=true;removed=ch==="^"?"plant thorn hazard":"thorn/rubble hazard";}
        else if((treeHazard||attachedHazard)&&plant){valid=true;removed=obj.trait||"attached plant hazard";}
        else if(attachedHazard){valid=true;removed="attached hazard";}
      } else if(!valid&&part==="limb"&&tree&&obj.trait==="limbDrop") {valid=true;removed="unstable limb";}
      if(!valid){log(s,{kind:"miss",actor:a.id,tiles:[[x,y]],text:`${a.name} finds no eligible ${part} to prune at (${x},${y}); the action and ΦF are spent.`,why:["Pruning names one part. Paving, pillars, character Life Force, and healthy Arborist targets are not removable parts."]});return;}
      const posture=Postures?.resolve({character:a.character,concept:"pruning",ability:inst.ability,event:"pruneResolved",eligible:[{valid,part,tile:[x,y],tree:tree&&(treeHazard||attachedHazard)}]});
      if(prunedThorn){s.terrainEffects=s.terrainEffects.filter(e=>e!==prunedThorn);}
      else if(part==="foliage"&&obj){s.arena.objects=s.arena.objects.filter(o=>o.id!==obj.id);if(ch==="h")s.arena.map[y]=s.arena.map[y].slice(0,x)+","+s.arena.map[y].slice(x+1);}
      else if(part==="foliage"&&ch==="h")s.arena.map[y]=s.arena.map[y].slice(0,x)+","+s.arena.map[y].slice(x+1);
      else if(part==="hazard"&&groundHazard)s.arena.map[y]=s.arena.map[y].slice(0,x)+","+s.arena.map[y].slice(x+1);
      else if(obj&&part==="hazard") {if(obj.status?.hazard)delete obj.status.hazard;if(["thorns","limbDrop"].includes(obj.trait))obj.trait=null;}
      else if(obj&&part==="limb")obj.trait=null;
      log(s,{kind:"prune",actor:a.id,tiles:[[x,y]],text:`${a.name} prunes ${removed} at (${x},${y}).`,why:[part==="hazard"?"The named hazard part is removed; routes and tile access now follow the resulting board state.":"One plant part is removed. Character Life Force is not a removable part.","Pruning does not affect paving or pillars and does not bypass Barrier."]});
      if (patchAt(s, x, y)) disturbSuccession(s, [[x, y]], "Pruning");
      if(part==="hazard"&&(ch==="^"||treeHazard)){const e=findOpp("pruning","swale","disrupts",null,"removePlantHazard");if(e)edgeUsed(s,e.id);}
      if(posture?.effect==="cultivate"){
        const duration=2+(inst.mulchDurationAdd||0);
        s.barriers.push({id:"m"+(++s.seq),owner:a.id,x,y,duration,expiresAt:a.ownerTurns+duration,concept:"mulch",passiveGround:true});
        const markAt=DIRS.map(([dx,dy])=>[x+dx,y+dy]).find(([mx,my])=>inside(s,mx,my)&&tileAt(s,mx,my).tags?.includes("soil")&&!actorAt(s,mx,my)&&!barrierAt(s,mx,my)&&!s.arena.objects?.some(o=>o.x===mx&&o.y===my&&o.blocksMove));
        if(markAt)s.growthMarks.push({owner:a.id,side:a.side,x:markAt[0],y:markAt[1],heal:4});
        log(s,{kind:"posture",actor:a.id,tiles:[[x,y],...(markAt?[markAt]:[])],text:posture.log,why:["Mulch occupies the cut tile for two owner turns. The growth mark restores up to 4 LF to the next ally other than the Gardener who enters the adjacent soil."]});
      }else if(posture?.effect==="structure"&&posture.tree){
        s.pruneBraces.push({owner:a.id,x,y,expiresAt:a.ownerTurns+2,used:false});
        log(s,{kind:"posture",actor:a.id,tiles:[[x,y]],text:posture.log,why:["The next line hit against a unit on an adjacent tree-edge tile is halved once; field and routed deliveries are unaffected."]});
      }
    }

    return { scoutNoted, talksToAttack, talkCost, reportCheck, strongGrip, climbCost, jumpCost, squeeze, aiFailure, aiSnapshot, aiLearnResult, apply, stallPreview, handlers, resolvePrune, imitateComplete, moveRefusal, footOpen, sized, maxRoomFor, stepCost, moveCost, movementTempoCost, usableRamp, waterAt };
  })();
});
