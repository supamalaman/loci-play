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
    const handlers = {};   // the action table: filled by the family parts installed below (ACTION_FAMILIES)

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

    // Action seams A2 (2026-11-11): the handlers live in family parts, web/combat/engine/actions-<family>.js, installed
    // here (not in engine.js's ENGINE_PARTS, which is at its size cap; R-20261111-01). K is this part's own names that
    // the handlers use. docs/action-families.md lists every action type and its file.
    const ACTION_FAMILIES = ["movement","turn","strike","items","summons","observe","parley","rites","forms","debts","field","technique"];
    const K = { Cooking, Dream, OG, Orders, PactLib, Sage, Spirit, VerbTech, addStun, aiAction, apply, applyTerrainEvents, bankRiteSideStep,
      barsTooFast, candidates, climbCost, climbOptions, deepLook, demonstratedTraits, engineArena, footOpen, freeStrike, grappleChance, grappleCost,
      grappled, handlers, hermitCharge, imitateComplete, isKraken, jumpCost, maxRoomFor, moduleArena, moveCost, moveRefusal, movementTempoCost,
      observeTail, observedFx, openResponseWindow, provokeOpportunity, report, resolveAbility, score, scoutNoted, sealedNext, seededChance, sized,
      stallPreview, strikeRange, strongGrip, talkCost, talkedTooFast, talksToAttack, targeting, waterAt };
    for (const fam of ACTION_FAMILIES) (typeof module === "object" && module.exports ? require("./actions-" + fam + ".js") : globalThis.ConceptCombatEngineParts["actions" + fam[0].toUpperCase() + fam.slice(1)])(H, K);

    return { scoutNoted, talksToAttack, talkCost, reportCheck, strongGrip, climbCost, jumpCost, squeeze, aiFailure, aiSnapshot, aiLearnResult, apply, stallPreview, handlers, resolvePrune, imitateComplete, moveRefusal, footOpen, sized, maxRoomFor, stepCost, moveCost, movementTempoCost, usableRamp, waterAt };
  })();
});
