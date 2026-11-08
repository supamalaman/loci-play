"use strict";
// Turn structure: rounds, turn start and end, upkeep.
// A part of the Concept Combat engine, split out of engine.js on 2026-10-11 (tools/split-engine.mjs). It is not a
// module in its own right: engine.js installs it with the host object H (everything the engine closure has in
// scope) and it hands back the functions it defines. Function bodies are exactly as they were in engine.js.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).turns = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const Spirit = () => (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null;
    const Orders = () => (typeof module === "object" && module.exports ? require("../spirit/orders.js") : globalThis.ConceptCombatOrders) || null;
    const { Auras, C, EmergentIdeas, EnemySummons, ClassRuntime, Climate, Director, EM, MaidSystems, Performers, SHADE, Stealth, Vows, actorAt, addStun, auraH, beastTick, callCompanion, companionTick, cornerAdvice, bossRules, classH, conceptName,
      currentId, dist, dreamSpaceRules, edgeUsed, hasSight, heightAt, insightRules, isMonster, key, log, monsterApply, monsterCtx, poisonTick,
      presidentContext, presidentRules, presidentUnits, processRandomEvents, progress, refreshDrowning, ritualTick, riteTick, runWildEnvironment, settleHomeward,
      summonRules, syncPresidentUnit, updateWildTelegraphs } = H;
    // defined by parts installed after this one: reached through H when called
    const advance = (...args) => H.advance(...args);
    const applyFall = (...args) => H.applyFall(...args);
    const applyTrueFormReveal = (...args) => H.applyTrueFormReveal(...args);
    const checkDreamCollapse = (...args) => H.checkDreamCollapse(...args);
    const checkOutcome = (...args) => H.checkOutcome(...args);
    const closeDreamSummons = (...args) => H.closeDreamSummons(...args);
    const closeDreamTreeants = (...args) => H.closeDreamTreeants(...args);
    const findOpp = (...args) => H.findOpp(...args);
    const visageGaze = (...args) => H.visageGaze(...args);
    const hasTrait = (...args) => H.hasTrait(...args);
    const hit = (...args) => H.hit(...args);
    const tendPlants = (...args) => H.tendPlants(...args);
    const moduleArena = (...args) => H.moduleArena(...args);
    const opponentsOn = (...args) => H.opponentsOn(...args);
    const resolveDelayed = (...args) => H.resolveDelayed(...args);
    const resolveDreamRound = (...args) => H.resolveDreamRound(...args);
    const resolveRandomDreamRift = (...args) => H.resolveRandomDreamRift(...args);
    const resolveDreamAppearances = (...args) => H.resolveDreamAppearances(...args);
    const resolveScheduled = (...args) => H.resolveScheduled(...args);
    const runTrueFormTechnique = (...args) => H.runTrueFormTechnique(...args);
    const seededChance = (...args) => H.seededChance(...args);
    const skipUnable = (...args) => H.skipUnable(...args);
    const syncTrueFormFields = (...args) => H.syncTrueFormFields(...args);
    const target = (...args) => H.target(...args);
    const traitOn = (a, id) => (a?.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === id);

    // Heavy Armor: a ward replaced each round, 10 then 9, 8, 7… to 0. Hits spend it. A broken plate
    // is not refilled until the next round, and a different ward already on him is left alone.
    function plateHeavyArmor(s) {
      const n = Math.max(0, 11 - Math.max(1, s.round || 0));
      for (const a of Object.values(s.actors)) {
        if (!a || a.defeated || a.notArrived || !traitOn(a, "heavyArmor")) continue;
        if (a.heavyArmorRound === s.round) continue;
        const existing = a.status?.ward;
        if (existing && !existing.heavyArmor) continue;
        a.heavyArmorRound = s.round;
        if (n <= 0) { if (existing?.heavyArmor) a.status.ward = null; continue; }
        a.status.ward = { label: "Heavy armor", owner: a.id, protection: n, heavyArmor: true };
        log(s, { kind: "effect", actor: a.id, text: `${a.name}: heavy armor wards ${n} this round.` });
      }
    }
    // Established Guard arms at the end of a turn he spent standing still. turnStart clears `moved`
    // before any action, so the snapshot has to be the tile he actually finishes on.
    function armEstablishedGuard(s, a) {
      const passive = ClassRuntime?.builds?.[a.character]?.passives?.established_guard;
      if (!passive || a.defeated) return;
      const tile = a.guardTile;
      if (!(tile && tile[0] === a.x && tile[1] === a.y && !a.moved)) return;
      const mul = passive.effect?.nextDirectionalDefenseMul ?? 0.8;
      a.status.establishedGuard = { ready: true, mul };
      log(s, { kind: "effect", actor: a.id, text: `${a.name} holds the ground: the next shield-side hit is ×${mul}.` });
    }

    // ── turn structure (spec §7 provisional turn-start order) ─────────────────
    function beginRound(s) {
      s.round += 1;
      H.mysteryTick?.(s);   // Mystery (Muse W2.5): set plans age; stale ones fade unrevealed
      if (s.round === 1) H.animeOrbit?.(s);   // the anime orbit (engine/anime-orbit.js): each Anime Protagonist brings one anime kit
      if (s.round === 1 && s.actors.player && !s.spawnBase) s.spawnBase = H.clone(s.actors.player);   // what spawned bodies are built from (queries.js freshBody): the player before any battle state
      if (s.sealedFight) {
        const SN = typeof module === "object" && module.exports ? require("../sealed-next.js") : globalThis.ConceptCombatSealedNext;
        const driver = SN?.onRound?.(s, H);
        if (driver) H.updateWater?.(s);
        SN?.placeGates?.(s);
        SN?.applyField?.(s);
      }
      if (ClassRuntime?.Teleology) ClassRuntime.Teleology.snapshot(s);   // Causal Snapback: remember this round's start
      s.roundEnvironmentProcessed = false;
      H.submissionRound?.(s);   // Submission: one struggle roll per pressed foe, before holds expire (engine/conditions.js)
      H.Conversion?.roundHook(s, H);   // W1.4: looped contrition rolls + served rounds end (insight/conversion.js)
      H.Courtroom?.advance(s, H);   // W1.3: the court argues one exchange per side per round (law/courtroom.js)
      H.Presence?.roundHook(s, H);   // W2.1: a held path opens the round (presence goes before argument)
      H.Debt?.roundHook(s, H);   // W2.2: interest, lender weakness, default, visits, service
      for (const e of (H.Sealing?.roundHook?.(s, H) || [])) log(s, { kind: "seal", actor: e.foe, text: e.text });   // W2.3: sealed foes may slip their vessels
      for (const a of Object.values(s.actors)) a.reaction = (a.awakened || a.status?.rage) ? 0 : s.rules.reactionsPerRound;   // rage burns the round's reaction; a woken structure has none
      for (const a of Object.values(s.actors)) if ((H.Injury?.gradeOf(a, "head") || 0) === 2 && a.reaction > 0) { a.reaction = 0; log(s, { kind: "injury", actor: a.id, text: `${a.name} is too dazed to answer anything this round (maimed head: no reactions).` }); }
      for (const a of Object.values(s.actors)) if (a.status?.grappled && a.status.grappled.untilRound < s.round) { a.status.grappled = null; log(s, { kind: "expire", actor: a.id, text: `${a.name} breaks free of the hold.` }); }
      for (const a of Object.values(s.actors)) if (a.status?.whatIf && a.status.whatIf.untilRound < s.round) { a.status.whatIf = null; log(s, { kind: "expire", actor: a.id, text: `The draft settles: ${a.name}'s kit is fixed again.` }); }
      log(s, { kind: "phase", text: `Round ${s.round}. Reactions reset (${s.rules.reactionsPerRound} each).` });
      for (const a of Object.values(s.actors)) if (isMonster(a) && a.defeated) { const r = EM.startOfRound(a); if (!r.m.defeated) { Object.assign(a, r.m); for (const ev of r.events) log(s, { ...ev, kind: "monsterRule", tiles: [[a.x, a.y]] }); } }
      for (const a of Object.values(s.actors)) if (a.notArrived && a.arrivesRound <= s.round) {
        const mark = a.arrivesFor && s.actors[a.arrivesFor];
        if (a.arrivesFor && (!mark || (mark.defeated && !mark.notArrived))) {
          delete s.actors[a.id]; s.order = s.order.filter((id) => id !== a.id);
          log(s, { kind: "arrival", actor: a.id, text: `${a.name} stands down: nothing left to challenge.` });
          continue;
        }
        a.notArrived = false; a.defeated = false;
        log(s, { kind: "arrival", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} enters the battlefield at the start of round ${s.round}.` });
      }
      H.houseRound(s);   // the house: dividend to its side's units beside it; rubble stays down (engine/houses.js)
      H.landRound(s);   // the land's wounds: Gaia may emerge (engine/land.js)
      H.courtRound?.(s);   // Heart Court: one telegraphed act (engine/living-map.js)
      H.advanceTime(s);   // day and night: phase, nightfall creatures, dawn flight (engine.js; rules.time)
      processRandomEvents(s);
      H.waterAgenda?.(s);   // Living Water W1: the agenda phase, after weather (engine/conditions.js)
      H.Hires?.roundStart(s);   // a called merc or mediator arrives (engine/hires.js)
      H.friendRound?.(s);
      H.fishRound?.(s);   // dream fish restock the water (engine/conditions.js)   // a remembered Sasquatch may come to help (engine/tamer.js)
      advanceSuccessionRound(s);
      checkOutcome(s);
      if (!s.outcome) updateWildTelegraphs(s);
      if (!s.outcome) Spirit()?.roundHook(s, H);   // group spirit: per-side assessment, cached for the round
      if (!s.outcome) Orders()?.roundHook(s, H);   // talk orders: rout deeds, then every enemy leader calls the shots
      plateHeavyArmor(s);   // before anyone acts, including the opener
    }
    function patchAt(s, x, y) { return (s.successionPatches || []).find(p => p.x === x && p.y === y); }
    function createSuccessionPatch(s, a, x, y, { nurseLog = false, stage = 1, permanent = false, name = "Pioneer Patch", duration = 4 } = {}) {
      const patch = { id: `growth-${++s.seq}`, owner: a.id, side: a.side, x, y, name, stage: 1, nurseLog, nurseLogSpent: false,
        permanent, placedRound: s.round, expiresAtRound: permanent ? null : s.round + duration, progressedRound: s.round };
      s.successionPatches.push(patch);
      if (stage > 1) setPatchStage(s, patch, stage, "Its starting conditions provide a one-stage head start.");
      log(s, { kind: "succession", actor: a.id, tiles: [[x, y]], text: `${a.name} establishes ${name} at (${x},${y})${nurseLog ? " on a nurse log" : ""}.`, why: ["Stage 1 provides partial cover; an undisturbed round advances it."] });
      return patch;
    }
    function setPatchStage(s, patch, stage, reason) {
      patch.stage = Math.max(1, Math.min(3, stage));
      patch.progressedRound = s.round;
      const barrier = s.barriers.find(b => b.id === patch.barrierId);
      if (barrier) barrier.coverFraction = patch.stage === 1 ? 0.25 : 0.4;
      if (reason) log(s, { kind: "succession", actor: patch.owner, tiles: [[patch.x, patch.y]], text: `${patch.name} reaches stage ${patch.stage}: ${["", "ground cover", "established growth", "mature healing patch"][patch.stage]}.`, why: [reason] });
    }
    function advanceSuccessionRound(s) {
      for (const patch of [...(s.successionPatches || [])]) {
        if (patch.permanent) continue;
        if (patch.expiresAtRound <= s.round) {
          s.successionPatches = s.successionPatches.filter(p => p !== patch);
          s.barriers = s.barriers.filter(b => b.id !== patch.barrierId);
          if (!(s.arena.objects || []).some(o => o.x === patch.x && o.y === patch.y)) {   // a finished patch leaves a stump: substrate for Nurse Log
            s.arena.objects.push({ id: `stump-${patch.id}`, type: "stump", name: "Patch stump", x: patch.x, y: patch.y, hp: 8, maxHp: 8, cover: 0.25, sightHeight: 0, blocksMove: false, material: "wood" });
            log(s, { kind: "expire", actor: patch.owner, tiles: [[patch.x, patch.y]], text: `${patch.name} completes its battle cycle and leaves a stump behind.` });
          } else log(s, { kind: "expire", actor: patch.owner, tiles: [[patch.x, patch.y]], text: `${patch.name} completes its battle cycle and fades.` });
        } else if (patch.stage < 3) setPatchStage(s, patch, patch.stage + 1, "One undisturbed round advances the succession state.");
      }
    }
    function disturbSuccession(s, tiles, sourceConcept) {
      for (const [x, y] of tiles || []) {
        const patch = patchAt(s, x, y);
        if (!patch) continue;
        if (patch.nurseLog && !patch.nurseLogSpent) {
          patch.nurseLogSpent = true;
          log(s, { kind: "succession", actor: patch.owner, tiles: [[x, y]], text: `The nurse log absorbs the disturbance to ${patch.name}.`, why: ["Its one-use woody substrate protects the patch from the first reset."] });
        } else {
          if (["Cut-and-fill", "Watershed Terrace"].includes(sourceConcept)) {
            const edge = findOpp("gradingDrainage", "succession", "disrupts", null, "resetGrowth"); if (edge) edgeUsed(s, edge.id);
          }
          if (patch.stage > 1) setPatchStage(s, patch, 1, `${sourceConcept || "A disturbance"} resets growth to the pioneer stage.`);
        }
      }
    }
    function startTurn(s) {
      const a = s.actors[currentId(s)];
      if (a?.concedeStall && !s.preview) { a.concedeStall = false; log(s, { kind: "parley", actor: a.id, text: `${a.name} sits out the turn (conceded in a battle of minds).` }); a.tempo = 0; ClassRuntime?.mise?.satOut?.(s, a); endTurn(s); return; }   // Mind duel: a forced stall skips the whole turn
      if (a && s.rules.soul && a.maxSoul == null) { a.maxSoul = s.rules.soul.max; if (a.soul == null) a.soul = a.maxSoul; }
      if (a?.husk) { a.tempo = 0; if (!s.preview) { log(s, { kind: "ritual", actor: a.id, text: `${a.name} is an empty husk and cannot act.` }); ClassRuntime?.mise?.satOut?.(s, a); endTurn(s); } return; }
      // Repeated-channel adaptation measures one attacker's action turn at a time.
      s.turnDamageCounts = {};
      a.ownerTurns += 1;
      H.mysteryTurnStart?.(s, a);   // Mystery (Muse W2.5): on-turn-start set plans fire
      if (a.companion?.card && !a.defeated) { H.Cards.familiarTurn(s, a); a.tempo = 0; if (!s.preview) endTurn(s); return; }   // Battle Cards C3: a card familiar strikes or wards by its card, then its turn ends (no AI, no AP)
      if (H.gamblerOf?.(s, a)) { const hot = (a._unspent ?? 0) >= (H.hyperRules?.heat.unspentAp ?? 40); s.heat = { ...(s.heat || {}), [a.id]: hot ? Math.min(H.hyperRules.heat.max, (s.heat?.[a.id] || 0) + 1) : 0 }; }   // W5.3: rhythm of madness
      H.Contracts?.turn(s,a);
      // Cavalry: +4 movement on his first owner turn only (7 instead of 3; Mala raised it from +3 on 2026-10-13). Steps still cost 10 AP.
      if (traitOn(a, "cavalry") && a.ownerTurns === 1 && !a.cavalryBurst) {
        const already = a.status.moveAdd?.expiresAt > a.ownerTurns ? a.status.moveAdd.amount : 0;
        a.status.moveAdd = { label: "Cavalry", owner: a.id, amount: already + 4, expiresAt: a.ownerTurns + 1 };
        a.cavalryBurst = true;
        log(s, { kind: "effect", actor: a.id, text: `${a.name} opens at a cavalry pace: +4 movement this turn.` });
      }
      // AGI Takeoff Clock: pure takeoff can flip it with few or no immunities (helpers in damage.js).
      if (a.character === "agi" && !a.defeated) {
        const tk = a.takeoff ||= { exp: {}, immune: [], sightings: 0, transcended: 0, completed: 0, taught: 0, paced: false };
        // Data center (content.js rules.dataCenter): while the center of the one who released it stands, each of its
        // turns is worth one more takeoff credit. Credit already banked stays when the building falls. The clock only:
        // the per-turn damage bonus (damage.js takeoffBonus) still counts turns.
        { const DC = s.rules.dataCenter, owner = DC && a.companion && s.actors[a.companion.owner];
          if (owner && !tk.transcended && ClassRuntime?.centerOf(s, owner)) tk.credit = (tk.credit || 0) + DC.creditPerTurn; }
        if (!tk.transcended && (tk.immune.length >= 2 || (a.ownerTurns + (tk.credit || 0)) * (tk.completed ? 2 : 1) >= 6)) { tk.transcended = s.round; log(s, { kind: "transcend", actor: a.id, text: `${a.name} transcends: every opponent now fears it most.`, why: ["2 immunities or takeoff +6: fear aggro."] }); H.PostHuman.join(s, a); }
        if (tk.transcended && !tk.completed && tk.immune.length >= 4 && a.ownerTurns >= 10) { tk.completed = s.round; log(s, { kind: "effect", actor: a.id, text: `${a.name} completes its takeoff: the bonus doubles. Run.`, why: ["4 immunities and takeoff +10: the runaway bad end."] }); }
      }
      EmergentIdeas?.syncSummonWards(s);
      if (EmergentIdeas?.refreshSummonWard(s, a)) log(s, { kind: "emergentIdea", actor: EmergentIdeas.summonerOf(a), target: a.id, text: `${a.name} refreshes its ${a.status.ward.protection}-point Proficient Summoner ward; protection is replaced, never added.` });
      a.moved = false; a.acted = false; a.guardUsedThisTurn = false; a.walkedThisTurn = 0;   // walkedThisTurn: Lance Charge (the Knight)
      if (!a.defeated) H.monsterTurnStart(s, a);   // a wrap lapses; a heal cures an infection
      if (isMonster(a) && !a.defeated) monsterApply(s, a, EM.startOfTurn(a, monsterCtx(s)));   // werewolf form and regeneration, fire panic, burning
      if (MaidSystems && a.character === "maid") for (const found of MaidSystems.visibleFilth(s, a, (x, y) => hasSight(s, a.x, a.y, x, y)))
        log(s, { kind: "observe", actor: a.id, tiles: [found.tile], text: `${a.name} spots battle residue at (${found.tile.join(",")})${found.level > 1 ? ` (${found.level} layers)` : ""}.`, why: ["Maintenance Eye reveals the visible residue, not its source."] });
      settleHomeward(s, a);
      tendPlants(s, a);   // Horticulture Expertise (true-forms.js)
      if (a.communed && !a.defeated && a.lf < a.maxLF) {   // Vegetative Propagation: the holder's plants regrow.
        const owner = s.actors[a.communed.owner];
        if (owner && (owner.traits || []).some((t) => (t.id || t) === "vegetativePropagation")) {
          a.lf = Math.min(a.maxLF, a.lf + 2);
          log(s, { kind: "heal", actor: a.id, text: `${a.name} regrows 2 LF (Vegetative Propagation).` });
        }
      }
      H.Instinct.restTick(s, a);   // Survival Instincts: the belt for the auto-end, the lie's knit, and its clock
      if (a.status.cornerAdvice && a.status.cornerAdvice.expiresAt < a.ownerTurns) a.status.cornerAdvice = null;
      if (a.status.overwatch && a.status.overwatch.expiresAt <= a.ownerTurns) {   // Overwatch (Muse-2): an unanswered watch expires audibly — the held reaction stays spent
        a.status.overwatch = null;
        log(s, { kind: "expire", actor: a.id, text: `${a.name}'s Overwatch goes unanswered; nobody stepped inside.` });
      }
      { const T = C.concepts.solfeggio?.tones, held = a.status.heldTones;   // Solfeggio: tones knit, the chord sings both ways
        if (held && held.expiresAt <= a.ownerTurns) { a.status.heldTones = null; log(s, { kind: "expire", actor: a.id, text: `${a.name}'s held tones fade.` }); }
        else if (held && !a.defeated) for (const u of Object.values(s.actors).filter((u) => !u.defeated && u.side === a.side && dist(s, a.x, a.y, u.x, u.y) <= 3)) {
          const before = u.lf; u.lf = Math.min(u.maxLF, u.lf + T.toneHeal);
          if (u.lf > before) log(s, { kind: "heal", actor: a.id, target: u.id, text: `${u.name} recovers ${u.lf - before} LF in the held tone.` });
        }
        const chord = a.status.fullChord;
        if (chord && chord.expiresAt <= a.ownerTurns) { a.status.fullChord = null; log(s, { kind: "expire", actor: a.id, text: `${a.name}'s Full Chord fades.` }); }
        else if (chord && !a.defeated) {
          for (const u of Object.values(s.actors).filter((u) => !u.defeated && u.side === a.side && dist(s, a.x, a.y, u.x, u.y) <= T.chordRadius)) {
            const before = u.lf; u.lf = Math.min(u.maxLF, u.lf + T.chordHeal);
            if (u.lf > before) log(s, { kind: "heal", actor: a.id, target: u.id, text: `${u.name} recovers ${u.lf - before} LF in the Full Chord.` });
          }
          for (const u of Object.values(s.actors).filter((u) => !u.defeated && u.side !== a.side && dist(s, a.x, a.y, u.x, u.y) <= T.chordRadius))
            hit(s, a, u, { ability: "fullChord", name: "Full Chord", delivery: "field", damageType: "rubedo" }, T.chordHurt, ["The siege hymn burns enemies inside its radius."]);
        } }
      if ((s.rumors || []).length) {   // Discovery: rumors fade after 2 rounds
        const live = s.rumors.filter((r) => r.expiresRound > s.round);
        if (live.length !== s.rumors.length) { s.rumors = live; log(s, { kind: "expire", actor: a.id, text: "An unverified rumor fades." }); }
      }
      cornerAdvice(s, a); callCompanion(s, a); H.Longtermism?.turnStart(s, a);   // class companions (conditions.js); Longtermism bequest and Endowment expiry
      H.sproutSeeds(s, a);   // lodged seeds (Breadfruit Hurl) sprout as the turn starts (resolve.js)
      H.squeeze(s, a);   // Strong Grip: enemies in this unit's Grapple are hurt as its turn starts (actions.js)
      // Inspiration: being inside a dream, and facing a worthy opponent (a boss), each roll once a battle.
      if (!a.defeated && s.dreamSpace && (!dreamSpaceRules?.contains || dreamSpaceRules.contains(s.dreamSpace, a.x, a.y))) H.Inspiration.roll(s, a, "insideDream");
      if (!a.defeated && Object.values(s.actors).some((u) => u.boss && !u.defeated && u.side !== a.side)) H.Inspiration.roll(s, a, "worthyOpponent");
      // Flow state (Mala, 2026-10-15): a full ult bar supercharges its holder — a small ward now, and a
      // per-turn Inspiration roll. Movement and strikes read the full bar live (engine.js, actions.js), so
      // they fall off the moment the bar is spent; the ward is residual and lasts until something eats it.
      { const F = s.rules.flowState, barFull = !a.defeated && !s.preview && F?.enabled !== false && (a.ultimateCharge ?? 0) >= (s.rules.ultimateChargeMax || 100);
        const gold = !a.defeated && !s.preview && F?.enabled !== false && !!a.form?.golden;   // SR1: gold is flow incarnate — ward only, no bar, no roll
        if (barFull) {
          if (!a.status.ward) a.status.ward = { label: "Flow state", protection: F.ward ?? 3, flow: true };
          else if (a.status.ward.flow) a.status.ward.protection = F.ward ?? 3;   // refresh our own; never touch a real ward
          const n = (a.flowTurns = (a.flowTurns || 0) + 1);
          if (!a.flowOn) { a.flowOn = true; log(s, { kind: "effect", actor: a.id, text: `${a.name} holds a full bar and settles into a flow state: +${F.ward ?? 3} ward, +${F.moveAdd ?? 1} move, harder strikes.`, why: ["Flow state: a supercharged fighter reinforces the body while the ult stays pocketed."] }); }
          if (seededChance(`${s.seed}:flow:${a.id}:${n}`) < (F.inspirationChance ?? 0.15)) H.Inspiration.gain(s, a, 1, `${a.name} holds the charge (flow state). A ${Math.round((F.inspirationChance ?? 0.15) * 100)}% chance, every full-bar turn.`);
        } else { a.flowOn = false;
          if (gold) {
            if (!a.status.ward) a.status.ward = { label: "Golden flow", protection: F.ward ?? 3, flow: true };
            else if (a.status.ward.flow) a.status.ward.protection = F.ward ?? 3;
          } } }
      H.Inspiration?.hardship(s, a);   // Never Give Up (ledgers.js): hardship inspires
      if (ClassRuntime) ClassRuntime.turnStart(s, a, classH());   // ClassRuntime: upkeep, visited tiles, fulcrum
      H.States?.turnStart(s, a);   // States: clocks, adjacency breakers, turn triggers
      if(a.office&&s.round>a.office.until){a.office=null;log(s,{kind:"expire",actor:a.id,text:`${a.name}'s office expires; its permissions end.`});}
      if(a.committed?.expiresAt<=a.ownerTurns){a.committed=null;log(s,{kind:"expire",actor:a.id,text:`${a.name}'s Burn the Boats commitment ends.`});}
      if(a.order){const ord=a.order;a.order=null;if(a.ai){a.pendingOrder=ord;log(s,{kind:"order",actor:a.id,target:ord.by,text:`${a.name} receives an optional Executive Direction for this turn.`});}else log(s,{kind:"order",actor:a.id,target:ord.by,text:`${a.name} may accept or decline ${ord.abilityId} this turn.`});}
      if (a.focus && a.focus.expiresAt <= a.ownerTurns) { log(s,{kind:"expire",actor:a.id,target:a.focus.target,text:`${a.name}'s Focus on ${s.actors[a.focus.target]?.name||"the target"} fades.`}); a.focus=null; }
      for(const k of ["immovable","exposed","attention","rangeBuff","tippingPoint","ambush","slowStart","lockMove","imaginedRehearsal"]) if(a.status[k]?.expiresAt<=a.ownerTurns){
        if(k==="tippingPoint")log(s,{kind:"expire",actor:a.id,text:`${a.name}'s Tipping Point mark expires without crossing the threshold.`});
        if(k==="attention")log(s,{kind:"expire",actor:a.id,target:a.status[k].target,text:`${a.name}'s Undivided Attention ends.`});
        if(k==="ambush")log(s,{kind:"expire",actor:a.id,text:`${a.name}'s ambush window closes.`});
        a.status[k]=null;
      }
      if (a.status.membrane?.label === "Arcane Membrane" && a.status.membrane.expiresAt <= a.ownerTurns) a.status.membrane = null;   // the rider's membrane is one turn; live membranes keep their own rules
      const expiredTerrain=(s.terrainEffects||[]).filter(e=>e.owner===a.id&&e.expiresAt<=a.ownerTurns);
      s.terrainEffects=(s.terrainEffects||[]).filter(e=>s.actors[e.owner]?.ownerTurns<e.expiresAt);
      for (const e of expiredTerrain) {
        if (e.kind === "projection" && e.property === "height") for (const [x,y] of e.tiles || []) {
          const unit = actorAt(s,x,y); if (unit && e.value > heightAt(s,x,y)) applyFall(s,a,unit,e.value,heightAt(s,x,y),false,"the projection reverts");
        }
        if (e.kind === "pastedSteal") H.ClassRuntime?.stolenPasteEnds?.(s, e, H);   // the Mangaka's pasted ward, buff or trait ends; a trait goes home
        if (e.kind === "pastedFragment" && e.owner === a.id && H.ClassRuntime?.builds?.[a.character]?.passives?.ink_reserve && (a.inkReserve || 0) < 3 && a.pf < (a.maxPF ?? s.rules.maxPF)) { a.inkReserve = (a.inkReserve || 0) + 1; a.pf += 1; log(s, { kind: "passive", actor: a.id, text: `${a.name}'s ink comes back: +1 ΦF (Ink Reserve ${a.inkReserve}/3).` }); }
        if (["projection","planView","sectionCut","pastedFragment"].includes(e.kind)) log(s,{kind:"expire",actor:a.id,tiles:e.tiles||[],text:`${a.name}'s ${e.label||({projection:"Orthographic Projection",planView:"Plan View",sectionCut:"Section Cut",pastedFragment:"pasted fragment"}[e.kind])} expires.`});
      }
      for(const o of s.arena.objects||[]) if(o.crownSuppressedUntil&&o.crownSuppressedUntil<=a.ownerTurns){delete o.crownSuppressedUntil;delete o.crownSuppressed;}
      if (a.omen && a.ownerTurns > a.omen.expiresAfterOwnerTurn) { a.omen = null; a.omenApLoss = 0; }
      if (a.status.inebriated && a.status.inebriated.expiresAt < a.ownerTurns) { a.status.inebriated = null; log(s, { kind: "expire", actor: a.id, text: `${a.name} sobers up.` }); }
      a.tempoSpent = 0; a.actionsThisTurn = 0;
      let firstBudget = (!s.openingTempoUsed[a.id] && Number.isFinite(s.openingTempo[a.id]) ? s.openingTempo[a.id] : H.Tourist?.is(a) ? 80 : s.rules.actionPointsPerTurn) + (a.perkApAdd || 0) - ((a.status?.exhausted?.until || 0) > s.round ? (H.hyperRules?.myol.exhaustedAp || 0) : 0);   // W3.6: vigor; W5.3: MYOL exhaustion
      if (a.status.inebriated) { firstBudget = Math.floor(firstBudget / 2); log(s, { kind: "tempo", actor: a.id, text: `${a.name} is inebriated: ${firstBudget} AP this turn.` }); }
      { const frac = H.soulFrac?.(a) ?? 1; if (frac < 1) { const next = Math.max(0, Math.round(firstBudget * frac)); if (next !== firstBudget) { log(s, { kind: "ritual", actor: a.id, text: `${a.name}'s thinning soul leaves ${next} action points this turn.` }); firstBudget = next; } } }
      s.openingTempoUsed[a.id] = true;
      const tallyFloor = H.Tally?.turnStart(s, a) || 0;   // the ledger boss: loans fall due, collection leaves a floor (engine/tally.js)
      const bankHeld = ClassRuntime?.Teleology?.holdsRetro(a) && (a.bankedTempo || 0) > 0;   // Echo Return: the bank waits for its release
      const banked = bankHeld ? 0 : a.bankedTempo, debtPaid = Math.min(a.tempoDebt || 0, Math.max(0, firstBudget + banked - tallyFloor));
      a.tempoDebt = Math.max(0, (a.tempoDebt || 0) - debtPaid); a.tempo = firstBudget + banked - debtPaid; a.tempoCapacity = Math.max(1, a.tempo); if (!bankHeld) a.bankedTempo = 0;
      if (a.boss && a.conditions?.enraged) { const bonus=bossRules?.data?.conditions?.enraged?.mods?.apPerTurnAdd || 0; a.tempo+=bonus; a.tempoCapacity+=bonus; if(bonus)log(s,{kind:"tempo",actor:a.id,text:`Enraged force adds ${bonus} AP to ${a.name}'s turn.`}); }
      if (ClassRuntime?.turnBudget) ClassRuntime.turnBudget(s, a, classH());   // Hypebeast: aura, hype field, Cultural Moment (rules.hype)
      if (a.status?.woozy) { const w = a.status.woozy; if (w.left > 0) { const lost = Math.min(a.tempo, w.apLoss || 25); a.tempo -= lost; w.left -= 1; log(s, { kind: "tempo", actor: a.id, text: `${a.name} is woozy from surgery: ${lost} fewer AP this turn.` }); } else a.status.woozy = null; }   // the Lab's anaesthetic (account/surgery.js)
      H.fruitTurnStart?.(s, a);   // Sinkerfruit: a Weather Front grows, and foes standing in one lose action points
      if (debtPaid) log(s, { kind: "tempo", actor: a.id, text: `${a.name} pays ${debtPaid} AP of tempo debt${a.tempoDebt ? ` (${a.tempoDebt} remains)` : ""}.` });
      H.Debt?.turnStart(s, a, H);   // W2.2: prison skips; earned tempo auto-pays the book
      H.restitutionDue?.(s, a);   // property rights: a restitution debtor pays its installment (engine/houses.js)
      if (H.chanted?.(s, a.id)) { a.tempo = 0; log(s, { kind: "ritual", actor: a.id, text: `${a.name} hangs suspended in a capture chant and cannot act.` }); }   // a dream creature being taken into a bead
      if (a.status.stun) {
        const lost = Math.min(a.tempo, a.status.stun.points);
        a.tempo -= lost; a.status.stun = null;
        log(s, { kind: "stun", actor: a.id, text: `${a.name} starts stunned and loses ${lost} action points (${a.tempo} remain).`, why: ["Stun removes a fixed portion of this turn's action budget; it does not skip the whole turn."] });
      }
      // C17 shade rest: start a turn on a shaded tile under sun or heat and the rest is worth action points. It has to
      // be here, after the refill: a gift made at the end of the last turn would be overwritten.
      if (Climate && s.weatherState && SHADE.weather.includes(s.weatherState.id) && !a.defeated && Climate.microclimate(moduleArena(s.arena), Climate.sky(s)).at(a.x, a.y)?.shade) {
        a.tempo += SHADE.ap; a.tempoCapacity += SHADE.ap; (s.shadeLog ||= []).push({ actor: a.id, round: s.round, ap: SHADE.ap });
        log(s, { kind: "climate", actor: a.id, tiles: [[a.x, a.y]], shadeRest: SHADE.ap, text: `${a.name} rested in the shade: +${SHADE.ap} action points this turn.` });
      }
      ritualTick(s, a);
      riteTick(s, a);   // Rites (Muse-2): the bank hold ticks beside the capture chant
      poisonTick(s, a);   // after the turn's action points are set, so the loss is felt this turn
      if (H.Injury?.bleedTick(s, a)) { endTurn(s); return; }   // wound-bleed is honest LF damage: a corpse yields the turn
      if (a.status.catharsis && a.status.catharsis.expiresAt <= a.ownerTurns) a.status.catharsis = null;
      if (a.status.catharsis) a.tempo += a.status.catharsis.apPerTurnAdd || 0;
      if (a.delegatedApAdd) { a.tempo += a.delegatedApAdd; log(s, { kind: "effect", actor: a.id, text: `${a.name} acts on delegated judgment: +${a.delegatedApAdd} AP this turn.` }); a.delegatedApAdd = 0; }
      if (a.dazzleApLoss) {
        const lost=Math.ceil(a.tempo*a.dazzleApLoss);a.tempo-=lost;delete a.dazzleApLoss;
        log(s,{kind:"dazzle",actor:a.id,text:`${a.name} is dazzled and loses ${lost} AP (25% of this turn’s budget).`});
      }
      if (a.insightApLoss) {
        const lost = Math.ceil(a.tempo * a.insightApLoss); a.tempo -= lost; a.insightApLoss = 0;
        log(s, { kind: "insight", actor: a.id, text: `${a.name} loses ${lost} AP from Frighten.` });
      }
      if (a.omenApLoss && a.omen) {
        const lost = Math.ceil(a.tempo * a.omenApLoss); a.tempo -= lost;
        log(s, { kind: "insight", actor: a.id, text: `${a.name} loses ${lost} AP from the omen.` });
      }
      if (a.nextActionCostAdd) { const extra = a.nextActionCostAdd, lost = Math.min(a.tempo, extra); a.tempo -= lost; a.nextActionCostAdd = 0; log(s, { kind: "insight", actor: a.id, text: `${a.name}'s first action costs ${extra} extra AP; ${lost} AP is removed from this turn.` }); }
      if (a.standDownUntil && s.round > a.standDownUntil) a.standDownUntil = 0;
      if (a.forceTargetUntil && s.round > a.forceTargetUntil) { a.forceTarget = null; a.forceTargetUntil = 0; }
      if (a.truceUntil && s.round > a.truceUntil) { a.truceWith = null; a.truceUntil = 0; }
      if (a.noDeceptionUntil && s.round >= a.noDeceptionUntil) a.noDeceptionUntil = 0;
      if (a.protectAlly) {
        const ally = s.actors[a.protectAlly]; a.protectAlly = null;
        if (ally && !ally.defeated) { ally.status.guard = { label: "Shielding an ally", owner: a.id, expiresAt: ally.ownerTurns + 1, multiplier: 0.7 };
          log(s, { kind: "insight", actor: a.id, target: ally.id, text: `${a.name} spends this turn shielding ${ally.name}; incoming damage is reduced by 30%.` }); a.tempo = 0; }
      }
      if (ClassRuntime?.builds?.[a.character]?.passives?.established_guard) a.guardTile = [a.x, a.y];
      log(s, { kind: "turn", actor: a.id, text: `${a.name}'s turn.` });
      log(s, { kind: "tempo", actor: a.id, text: `${a.name} has ${a.tempo} action points${banked ? ` including ${banked} banked` : ""}${a.tempoDebt ? `; ${a.tempoDebt} AP debt carries forward` : ""}.` });
      Performers?.turnBudget(s,a,classH());
      continueTurnStart(s);
    }
    // Split from startTurn so a turn-start response window can pause and resume it.
    function continueTurnStart(s) {
      const a = s.actors[currentId(s)];
      if (!a) return advance(s);   // the current actor vanished mid-start (an expiring cameo forgets itself): keep advancing
      if (s.pending && !s.outcome) { s.pending.resumeTurnStart = true; return; }   // MCR-01: a turn-start card window finishes first; closeInner resumes us. No open window reaches the scheduled loop below.
      // 1. scheduled turn-start events, stable creation order, defeat checked after each
      const due = s.scheduled.filter((e) => e.trigger.actor === a.id).sort((p, q) => p.seq - q.seq);
      for (const ev of due) {
        s.scheduled = s.scheduled.filter((e) => e !== ev);
        H.Exposure.arriving(s, ev);
        if (s.rules.delayedResponseWindow && ev.inst.tiles) {
          const src = s.actors[ev.owner];
          log(s, { kind: "delayed", actor: ev.owner, tiles: ev.inst.tiles, text: `Turn-start trigger: ${src.name}'s ${ev.inst.name} arrives at the start of ${a.name}'s turn.` });
          const defenders = opponentsOn(s, src, ev.inst.tiles);
          if (defenders.some((d) => d.reaction > 0)) {
            s.phase = "response";
            s.pending = { inst: ev.inst, attacker: ev.owner, defenders: defenders.map((d) => d.id), responded: [], resume: true };
            log(s, { kind: "announce", actor: ev.owner, tiles: ev.inst.tiles, text: `${ev.inst.name} is landing on the marked tiles.`,
              why: defenders.map((d) => d.reaction > 0 ? `${d.name} may spend the reaction to guard or reposition up to ${H.Injury.dodgeReach(s, d)} tiles.` : `${d.name} has no reaction left.`) });
            return skipUnable(s);
          }
          resolveDelayed(s, ev.owner, ev.inst);
        } else resolveScheduled(s, ev);
        if (s.outcome) return;
      }
      if (a.defeated) return advance(s);
      if (a.summon?.order && summonRules) {
        const result = summonRules.resolveUltimate(summonSnapshot(s), a);
        a.summon.order = null; a.summon.holdPosition = false; a.summon.ultimateUsed = true;
        log(s, result.event);
        applySummonUltimateEffects(s, a, result.effects);
        if (!s.outcome) { a.tempo = 0; endTurn(s); }
        return;
      }
      refreshDrowning(s, a);
      if (a.status.drowning && a.status.drowning.nextTickAtOwnerTurn <= a.ownerTurns) {
        a.status.drowning.nextTickAtOwnerTurn = a.ownerTurns + 1;
        const drownLF = Math.round(8 * (a.passives?.drowningDamageMul || 1));   // Supers who sink like a stone drown faster
        const lost = hit(s, { id: "drowning", name: "Drowning", side: "wild" }, a, null, drownLF, ["Water exposure."], { label: "Drowning", damageType: "rubedo" });
        log(s, { kind: "drowning", actor: a.id, target: a.id, amount: lost, tiles: [[a.x, a.y]], text: `${a.name} is drowning and loses ${lost} LF.`, why: ["Drowning threatens 8 LF at turn start (before weakness and defense modifiers) until you recover footing, surface, or leave water."] });
        if (a.defeated || s.outcome) return;
      }
      // 2. expiries whose boundary is this owner's turn start
      expire(s, a);
      syncTrueFormFields(s);                                                    // true forms: imaginary friends, field expiry
      if (a.summon?.trueForm && a.summon.technique) { runTrueFormTechnique(s, a); if (s.outcome || a.defeated) return; }
      // Dream Space uses the caster's full ultimate bar as a four-turn clock.
      if (dreamSpaceRules && s.dreamSpace?.owner === a.id) {
        const previousField = s.dreamSpace;
        const clock = dreamSpaceRules.casterTurnStart(a, s.dreamSpace);
        Object.assign(a, clock.caster); s.dreamSpace = clock.field;
        for (const ev of clock.events || []) log(s, ev);
        if (!s.dreamSpace) { closeDreamSummons(s, previousField); closeDreamTreeants(s, previousField); }
      }
      if (Auras && a.aura) { Auras.turnStart(s, a, auraH()); if (s.outcome) return; }   // Auras: drain, stage, per-turn ring effects
      if (Vows) Vows.turnStart(s, a, { log });   // Vows: Spent Tomorrow, Rooted breaches, vows ending with their source
      // 3. regenerate ΦF
      const before = a.pf, dreamMods = dreamSpaceRules?.modsFor(a, s.dreamSpace) || {}, growth = patchAt(s, a.x, a.y);
      const rawRegen = s.rules.pfRegen - (a.mirrorScar || 0) + (a.passives?.pfRegenAdd || 0) + (dreamMods.pfRegenAdd || 0) + (growth?.side === a.side && growth.stage >= 2 ? 1 : 0);
      const soulRegen = H.soulFrac?.(a) ?? 1;
      const regen0 = soulRegen >= 1 ? rawRegen : Math.max(0, Math.round(rawRegen * soulRegen)), regen = H.fruitRegen ? H.fruitRegen(s, a, regen0) : regen0;   // Sinkerfruit: no regen while damped
      a.pf = Math.min(a.maxPF, a.pf + regen);
      if (a.pf > before) log(s, { kind: "resource", actor: a.id, text: `${a.name} regenerates ${a.pf - before} ΦF (${a.pf}/${a.maxPF}).` });
      if ((a.passives?.freeObservePerTurn || 0) > 0) a.codexObserve = a.passives.freeObservePerTurn;   // Wizard's codex: the free look refills each turn
      if (ClassRuntime?.Teleology) ClassRuntime.Teleology.turnStart(s, a, { log });   // Teleology: ΦF debts pay from the pool, then paradox counts
      if (a.soulOf && !a.defeated && !H.astralUpkeep(s, a)) { endTurn(s); return; }   // the soul pays ΦF to stay out, or snaps back and loses the turn
      H.courtTend?.(s, a);   // Heart Court: living ground mends while Tended (engine/living-map.js)
      { // Settlement: the Keep heals adjacent allies at their turn starts (Mala, 2026-10-19).
        const keep = (s.arena.objects || []).find((o) => o.type === "keep" && (o.hp ?? 0) > 0 && o.side === a.side && Math.max(Math.abs(o.x - a.x), Math.abs(o.y - a.y)) === 1);
        if (keep && !a.defeated && a.lf < a.maxLF) { const healed = Math.min(4, a.maxLF - a.lf); a.lf += healed; log(s, { kind: "heal", actor: keep.owner, target: a.id, tiles: [[a.x, a.y]], text: `${a.name} recovers ${healed} LF beside the Keep.` }); } }
      H.formsTurnStartFor?.(s, a);   // learned forms: curse marks fire, acquired units go home, Platform lifts allies
      if (a.form?.learned && bossRules?.holdTick) {   // learned forms: drain ΦF, then LF; molt, takeoff, rent, dread
        const held = bossRules.holdTick(a, H.formCtx(s, a)); const hadSprite = "sprite" in held.player;
        Object.assign(a, held.player); if (!hadSprite) delete a.sprite; if (!held.player.form) a.form = null;
        for (const ev of held.events) log(s, { ...ev, tiles: [[a.x, a.y]] });
      }
      if (a.form?.golden && a.form?.held && bossRules?.goldHoldTick) {   // gold overtime: drain ΦF, then its own pool; ejection at 10%
        const held = bossRules.goldHoldTick(a, H.formCtx(s, a)); const hadSprite = "sprite" in held.player;
        Object.assign(a, held.player); if (!hadSprite) delete a.sprite; if (!held.player.form) a.form = null;
        for (const ev of held.events) log(s, { ...ev, tiles: [[a.x, a.y]] });
      }
      if (dreamMods.apPerTurnAdd) {
        a.tempo = Math.max(0, a.tempo + dreamMods.apPerTurnAdd); a.tempoCapacity += dreamMods.apPerTurnAdd;
        const hole = hasTrait(a, "trepanation") && (!s.dreamSpace || !dreamSpaceRules.contains(s.dreamSpace, a.x, a.y));
        log(s, { kind: "dreamSpace", actor: a.id, text: hole ? `Trepanation costs ${Math.abs(dreamMods.apPerTurnAdd)} action points.` : `Dream Space adds ${dreamMods.apPerTurnAdd} action points to this turn.` });
      }
      // 4. pending secondary swap activates
      if (a.pendingSwap) {
        a.secondary = a.pendingSwap; a.pendingSwap = null;
        log(s, { kind: "swap", actor: a.id, text: `${a.name}'s new secondary, ${conceptName(a.secondary)}, is now usable.` });
      }
      if (a.tempo <= 0) { log(s, { kind: "tempo", actor: a.id, text: `${a.name} has no action points after debt and turn-start effects; the turn passes.` }); endTurn(s); }
    }
    function summonSnapshot(s) { return { round: s.round, width: s.arena.w, height: s.arena.h,
      units: [...Object.values(s.actors), ...(s.wild || []).map(m => ({ ...m, wild: true }))] };
    }
    function applySummonUltimateEffects(s, summon, effects = []) {
      for (const effect of effects) {
        const target = s.actors[effect.target] || (s.wild || []).find(m => m.id === effect.target);
        if (effect.kind === "dispelTiles") {
          const tiles = new Set((effect.tiles || []).map(([x,y]) => key(x,y)));
          const removed = s.barriers.filter(b => s.actors[b.owner]?.side === effect.ownerSide && tiles.has(key(b.x,b.y)) && (b.protection || b.blocksSight || b.concept === "parry"));
          s.barriers = s.barriers.filter(b => !removed.includes(b));
          for (const ev of s.scheduled.filter(e => s.actors[e.owner]?.side === effect.ownerSide && (e.inst.tiles || []).some(([x,y]) => tiles.has(key(x,y))))) {
            s.scheduled = s.scheduled.filter(e => e !== ev);
            log(s, { kind: "cancel", actor: summon.id, text: `${ev.inst.name} is stripped from the committed area.` });
          }
          log(s, { kind: "summonUltimate", actor: summon.id, tiles: effect.tiles, text: `${summon.name}'s ultimate strips hostile barriers, wards, parries and marked delayed strikes in the announced area.` });
          continue;
        }
        if (!target || target.defeated) continue;
        target.status ||= {}; target.ownerTurns ||= 0;
        const ttl = Math.max(1, effect.status?.duration || 1), status = effect.status || {};
        if (effect.kind === "heal") {
          const before = target.lf; target.lf = Math.min(target.maxLF || target.lf, target.lf + effect.amount);
          if (effect.amount || target.lf > before) log(s, { kind: "heal", actor: summon.id, target: target.id, tiles: [[target.x,target.y]], text: `${target.name} recovers ${target.lf-before} LF from ${summon.name}'s ultimate.` });
          if (status.shareDamage) target.status.sharedBurden = { label: "Shared Burden", owner: target.id, expiresAt: target.ownerTurns + ttl, group: summon.summon.owner };
        } else if (effect.kind === "status") {
          if (status.damageTakenMul) target.status.lawsProtection = { label: "The King's Law", owner: target.id, expiresAt: target.ownerTurns + ttl, multiplier: status.damageTakenMul };
          if (status.rooted) target.status.rooted = { label: "Bound by the Law", owner: target.id, expiresAt: target.ownerTurns + ttl };
          if (status.moveAdd) target.status.moveAdd = { label: "New Rules", owner: target.id, expiresAt: target.ownerTurns + ttl, amount: status.moveAdd };
          if (status.resistSeenChannels) target.status.rememberedThreats = { label: "Remembered Threats", owner: target.id, expiresAt: target.ownerTurns + ttl, multiplier: status.resistSeenChannels };
          if (status.damageMul || status.lockTarget) target.status.onePossession = { label: "One Possession", owner: summon.id, expiresAt: summon.ownerTurns + ttl, multiplier: status.damageMul || 1, targetId: status.lockTarget ? (effect.targetId || s.playerTarget || null) : null };
          if (status.routeBudgetAdd) target.status.routeBudget = { label: "Open Horizon", owner: target.id, expiresAt: target.ownerTurns + ttl, amount: status.routeBudgetAdd };
          if (status.shareDamage) target.status.sharedBurden = { label: "Shared Burden", owner: target.id, expiresAt: target.ownerTurns + ttl, group: summon.summon.owner };
        } else if (effect.kind === "damage") {
          hit(s, summon, target, { name: summonRules.data.summons[summon.summon.key].ultimate.name, ability: `summonUltimate:${summon.summon.key}`, tier: "ultimate", damageType: effect.channel || "nigredo" }, effect.potency, ["The committed summon ultimate resolves after its announced response window."], { label: summonRules.data.summons[summon.summon.key].ultimate.name });
        } else if (effect.kind === "stun") {
          const resisted = effect.resistedByGuard && target.status.guard;
          if (!resisted) addStun(s, summon, target, effect.points);
          else log(s, { kind: "resist", actor: target.id, target: target.id, text: `${target.name} resists ${summon.name}'s command by guarding.` });
        } else if (effect.kind === "dispel") {
          for (const statusKey of ["ward", "parry", "delayedStrike"]) target.status[statusKey] = null;
        }
      }
    }
    function expire(s, a) {
      const n = a.ownerTurns;
      // Entangled runs on the victim's clock: expiresAt names the last held turn, tangleCut reads
      // ownerTurns <= expiresAt, and the clear below fires at ownerTurns > expiresAt. A wild number joins
      // that clock here: held this turn, cleared at the next start. The wild save (engine.js saveWildWorld)
      // only wraps numbers for this reason: an object there is the actor's own mark riding the snapshot,
      // and re-wrapping it nests { lostMove: {...} } and refreshes the deadline. Owner-tagged marks (Esker)
      // skip the caster sweep below and clear here instead, on the victim's counter.
      if (typeof a.status.entangled === "number") a.status.entangled = { lostMove: a.status.entangled, expiresAt: n };
      const expiring = s.barriers.filter((b) => !b.permanent && b.owner === a.id && b.expiresAt <= n);
      for (const b of expiring) {
        const label = b.passiveGround ? "Gardener mulch" : b.concept === "berm" ? "Berm" : b.concept === "swale" ? "Bioswale" : b.concept === "foldCrossing" ? "paper crossing" : b.concept === "foldPanel" ? "folded panel" : b.concept === "fog" ? "Fog" : b.concept === "smoke" ? "Smoke" : "Shield Wall";
        log(s, { kind: "expire", actor: a.id, text: (b.concept === "foldCrossing" || b.concept === "foldPanel") ? `${a.name}'s ${label} at (${b.x},${b.y}) unfolds (its ${b.duration} owner turns are up); everyone stays where they stand.` : `${a.name}'s ${label} at (${b.x},${b.y}) expires (its ${b.duration} owner turns are up).` });
      }
      s.barriers = s.barriers.filter((b) => !expiring.includes(b));
      s.treeBraces=(s.treeBraces||[]).filter(b=>b.expiresAt>n||b.owner!==a.id);
      for (const b of expiring.filter((b) => b.heightDelta)) for (const actor of Object.values(s.actors).filter((x) => !x.defeated && x.x === b.x && x.y === b.y))
        applyFall(s, actor, actor, b.heightDelta, 0, true, "the earthwork settles");
      for (const t of Object.values(s.actors)) for (const k of Object.keys(t.status)) {
        const st = t.status[k];
        if (k !== "entangled" && st && st.owner === a.id && st.expiresAt <= n) {   // entangled keeps its victim clock below even when a caster's name is on it
          t.status[k] = null;
          log(s, { kind: "expire", actor: t.id, text: `${t.name}'s ${st.label} expires at ${a.name}'s turn start.` });
        }
      }
      for (const k of ["silenced", "bleed"]) if (a.status[k]?.until != null && a.status[k].until < n) a.status[k] = null;   // `until` marks end quietly: clear the spent mark so no card or singer reads it
      if (a.status.entangled && a.status.entangled.expiresAt < n) { a.status.entangled = null; log(s, { kind: "expire", actor: a.id, text: `${a.name}'s entanglement clears.` }); }
    }
    function endTurn(s) {
      const a = s.actors[currentId(s)];
      if (s.law?.dispatch?.pending && H.Dispatch) { s.law.dispatch.autoArrived = true; H.Dispatch.arrive(s, H); }   // no UI played the call (sims, headless): the officers still come
      if (a) { a._unspent = a._heldAtEnd ?? a.tempo; a._heldAtEnd = null; }   // W5.3: heat reads banked-first (stall zeroes tempo before this runs)
      armEstablishedGuard(s, a);
      Performers?.endTurn(s,a);
      Stealth?.endTurn(s,a);
      if (isMonster(a) && !a.defeated) monsterApply(s, a, EM.endOfTurn(a, monsterCtx(s)));
      if (a) H.monsterTurnEnd(s, a);   // infection ticks, bitten monster or not
      H.monsterRelease(s);   // a fully observed ghost departs   // a vampire that ends its turn in the sun burns
      companionTick(s, a);   // a class companion (the Fighting Coach) counts down too
      H.Hires?.turnEnd(s, a);   // a merc's contract and nerve, a mediator's patience
      if (a) H.fruitTurnEnd?.(s, a);   // Sinkerfruit (Locusfruit): a Ripe eater leaves a memory mark on the tile it ends a turn on
      H.Multitudes.turnEnd(s, a); H.Exposure.turnEnd(s, a);   // Exposure: a turn ended beside his own wall   // Contains Multitudes: an embodiment ends with his last turn of it
      // Visage (biology): whoever ends their turn within 2 of the face meets its gaze. The gaze itself
      // exempts the fearless, marks dread, and may rout; the Emissary's enraged button stays an action.
      if (!a.defeated && !a.routed) for (const b of Object.values(s.actors)) {
        if (b.defeated || b.id === a.id || b.side === a.side || !hasTrait(b, "visage")) continue;
        if (dist(s, b.x, b.y, a.x, a.y) > 2) continue;
        visageGaze(s, b, [[a.x, a.y]]);
      }
      beastTick(s, a);   // C18: a released beast counts down its three turns
      log(s, { kind: "turn-end", actor: a.id, text: `${a.name} ends the turn.` });   // 6. turn-end events/upkeep: none authored in v0.1
      if(a.promise&&presidentRules&&!a.defeated){const outcome=presidentRules.checkPromise(presidentUnits(s).find(u=>u.id===a.id),presidentUnits(s),{...presidentContext(s),round:s.round});if(outcome!=="pending"){const ratified=!!a.office;const r=presidentRules.resolvePromise(presidentUnits(s).find(u=>u.id===a.id),outcome,{ratified});syncPresidentUnit(s,r.actor);for(const ev of r.events){if(ev.kind==="breach"){if(ev.damage)hit(s,a,a,null,ev.damage,["The breached promise's escrow penalty is settled."],{label:"Credibility Debt",damageType:"albedo"});log(s,{kind:"promise",actor:a.id,text:`${a.name}'s promise is breached; ${ev.lostStake} ΦF stake is lost.`});}else if(ev.kind==="payout"){for(const t of Object.values(s.actors).filter(u=>u.side===a.side&&!u.defeated&&dist(s,a.x,a.y,u.x,u.y)<=3))t.lf=Math.min(t.maxLF,t.lf+ev.heal);log(s,{kind:"promise",actor:a.id,text:`${a.name}'s promise is fulfilled; nearby allies recover up to ${ev.heal} LF.`});}else log(s,{kind:"promise",actor:a.id,text:ev.kind==="mandate"?`${a.name} earns Mandate for one later authority technique.`:`${a.name} repairs Credibility Debt through a fulfilled promise.`});}if(a.accord&&outcome==="fulfilled"){for(const b of presidentRules.accordBenefit(a))if(s.actors[b.id]&&!s.actors[b.id].defeated)s.actors[b.id].lf=Math.min(s.actors[b.id].maxLF,s.actors[b.id].lf+b.heal);a.accord=null;log(s,{kind:"accord",actor:a.id,text:"The Accord is fulfilled; each bound participant recovers 12 LF."});}}}
      if (a.id === "player" && s.round <= 2) s.mirror.lfLostByRound2 = Math.max(s.mirror.lfLostByRound2 || 0, (s.mirror.initialLF - a.lf) / Math.max(1, s.mirror.initialLF));
      if (Climate && s.weatherState && !a.defeated && !s.film) {   // the set has no weather
        const sky = Climate.sky(s), micro = Climate.microclimate(moduleArena(s.arena), sky);
        const climateEnd = Climate.endOfTurn(a, sky, micro);
        for (const ev of climateEnd.events) { log(s, ev); if (climateEnd.lfLoss) hit(s, { id: "weather", name: "Heat stress", side: "wild" }, a, null, climateEnd.lfLoss, [ev.text], { label: "Heat stress", damageType: "nigredo" }); }
      }
      if (a.form?.golden) for (const ally of Object.values(s.actors).filter(u => u.id !== a.id && u.side === a.side && !u.defeated && dist(s, a.x, a.y, u.x, u.y) <= 3)) {
        const before = ally.lf; ally.lf = Math.min(ally.maxLF, ally.lf + (bossRules?.data?.integratedSelf?.radianceHeal ?? 5));   // 5 → 10 (2026-10-17)
        if (ally.lf > before) log(s, { kind: "heal", actor: a.id, target: ally.id, text: `${ally.name} recovers ${ally.lf - before} LF in the Integrated Self's radiance.` });
        for (const status of ["stun", "entangled", "exposed", "immovable"]) if (ally.status[status]) { ally.status[status] = null; log(s, { kind: "heal", actor: a.id, target: ally.id, text: `${ally.name}'s ${status} clears in the golden radiance.` }); break; }
      }
      if (a.form && bossRules) { const form = bossRules.endOfTurnForms(a); Object.assign(a, form.player); if (!("sprite" in form.player)) delete a.sprite; if (form.player.form === null) a.form = null; for (const ev of form.events) log(s, ev); }
      for(const e of s.terrainEffects||[])if(e.kind==="rainGarden"&&e.tiles.includes(key(a.x,a.y))&&s.actors[e.owner]?.side===a.side&&s.actors[e.owner]?.ownerTurns<e.expiresAt&&!a.defeated){const before=a.lf;a.lf=Math.min(a.maxLF,a.lf+4);if(a.lf>before)log(s,{kind:"heal",actor:e.owner,target:a.id,tiles:[[a.x,a.y]],text:`${a.name} rests in the Rain Garden and recovers ${a.lf-before} LF.`});}
      for(const e of (s.terrainEffects||[]).filter(e=>e.kind==="star"&&e.owner===a.id&&s.actors[e.owner]?.ownerTurns<e.expiresAt)){const [sx,sy]=e.tiles[0];const struck=Object.values(s.actors).filter(u=>!u.defeated&&u.side!==a.side&&H.dist(s,sx,sy,u.x,u.y)<=1);for(const u of struck)hit(s,a,u,{ability:"starPing",name:"Star ping",concept:"conjunction",delivery:"field",damageType:"albedo"},2,["The charted star pings."],{label:"Star ping"});if(struck.length)log(s,{kind:"effect",actor:a.id,tiles:[[sx,sy]],text:`${a.name}'s charted star at (${sx},${sy}) pings ${struck.map(u=>u.name).join(", ")} for 2.`});}
      const maturePatch = patchAt(s, a.x, a.y);
      if (maturePatch?.stage === 3 && maturePatch.side === a.side && !a.defeated) {
        const before = a.lf; a.lf = Math.min(a.maxLF, a.lf + 5);
        if (a.lf > before) log(s, { kind: "heal", actor: maturePatch.owner, target: a.id, tiles: [[a.x, a.y]], text: `${a.name} recovers ${a.lf - before} LF in the mature Succession patch.` });
      }
      if (a.summon && summonRules) {
        if (dreamSpaceRules && !dreamSpaceRules.summonTurnTicks(dreamSpaceRules.contains(s.dreamSpace,a.x,a.y) ? s.dreamSpace : null)) log(s, { kind: "summon", actor: a.id, text: `${a.name}'s stay is suspended while the Dream Space holds.` });
        else {
          const r = summonRules.afterOwnTurn(a); Object.assign(a, r.actor);
          if (r.expired) { a.defeated = true; if (a.summon?.pact && s.pactActive?.line === a.summon.pact.line) { (s.pactCodes ||= []).push({ type: "pactEnded", line: a.summon.pact.line, how: "expired" }); s.pactActive = null; } log(s, { kind: "summon", actor: a.id, text: `${a.name} returns to the palace.` }); Spirit()?.onExit?.(s, a, H); }
        }
      }
      if (a.awakened && !a.defeated) {   // Tsukumogami: four of its own turns, then it settles back
        a.awakened.roundsLeft -= 1;
        if (a.awakened.roundsLeft <= 0) H.settleTsukumogami(s, a);
        if (a.defeated && a.settledBack) Spirit()?.onExit?.(s, a, H);   // SP-05: settling back is a quiet exit
      }
      EnemySummons?.afterOwnTurn(s, a, H);
      if (a.defeated && a.summonBinding?.expired) Spirit()?.onExit?.(s, a, H);   // SP-05: a group summon's stay ending is a quiet exit
      // The round's environment step runs after the last unit still standing in the order, not only after the last slot:
      // advance() skips defeated units, so when the unit in the last slot was down (or had not arrived yet) the step
      // never ran again and wild animals, fire and floods froze for the rest of the battle (seed 303, 2026-10-11).
      if (!s.film && !s.roundEnvironmentProcessed && !s.order.slice(s.turnIndex + 1).some((id) => s.actors[id] && !s.actors[id].defeated)) {
        s.roundEnvironmentProcessed = true;
        if (ClassRuntime?.roundEnd) ClassRuntime.roundEnd(s, classH());   // round-end releases (Unchained)
        H.States?.roundEnd(s);   // States: round clocks
        if (s.vignette && s.vignette.lastObjectiveRound < s.round) {
          s.vignette.lastObjectiveRound = s.round;
          const objective = s.vignette.objective, boss = s.actors[`boss-${s.vignette.branch}`];
          const prop = s.arena.objects.find(o => o.vignetteObjective);
          const progress = boss && !boss.defeated && (!prop || prop.hp > 0);
          if (progress) s.vignette.objectiveProgress++;
          log(s, { kind: "objective", actor: boss?.id, text: progress ? `${objective.label}: ${s.vignette.objectiveProgress}/${objective.turns} rounds.` : `${objective.label} is interrupted; its pressure does not advance.` });
        }
        runWildEnvironment(s);
        resolveDreamRound(s);
        resolveRandomDreamRift(s);
        resolveDreamAppearances(s);
      }
      checkDreamCollapse(s);
      checkOutcome(s);
      if (s.film && Director && !s.outcome) {   // the duel resolves the film; collapse restores the outside battle for a real outcome check
        const r = Director.resolveCheck(s);
        if (r) Director.collapse(s, H, r);
        checkOutcome(s);
      }
      if (s.outcome) return;
      advance(s);
    }
    function revealDreamSummons(s) {
      if(!summonRules?.revealTrueForm || !s.dreamSpace) return;
      for(const actor of Object.values(s.actors)) {
        if(!actor.summon || !dreamSpaceRules.contains(s.dreamSpace,actor.x,actor.y)) continue;
        if(!s.dreamSpace.summons.includes(actor.id)) s.dreamSpace.summons.push(actor.id);
        const result=summonRules.revealTrueForm(actor);
        if(result.changed) { Object.assign(actor,result.actor);applyRevealEffect(s,actor);applyTrueFormReveal(s,actor);log(s,{kind:"summonTrueForm",actor:actor.id,text:result.text,why:["Revealed once; remains until this summon disappears. Current LF keeps its previous percentage."]}); }
      }
    }

    function applyRevealEffect(s,actor) {
      const def=summonRules.data.summons[actor.summon.key];
      const effect=actor.summon.maxForm ? def?.maxForm?.revealEffect : def?.trueForm?.revealEffect;
      if(!effect) return;
      const enemies=Object.values(s.actors).filter(u=>!u.defeated && u.lf>0 && u.side!==actor.side && H.astralSameRegion(s,actor.x,actor.y,u.x,u.y));   // reveal fields do not cross to the astral plane (or back)
      if(effect.kind==="dazzle") for(const enemy of enemies) {
        const success=seededChance(`${s.seed}:${actor.id}:${actor.summon.owner}:${s.round}:dazzle:${enemy.id}`)<effect.chance;
        if(success) enemy.dazzleApLoss=Math.max(enemy.dazzleApLoss || 0,effect.fraction);
        log(s,{kind:"dazzle",actor:actor.id,target:enemy.id,text:success ? `${actor.name}'s beauty dazzles ${enemy.name}: −25% AP next turn.` : `${enemy.name} resists Mitsuko's Dazzle.`,why:["40% chance per enemy, once on reveal."]});
      }
      if(effect.kind==="arrows") for(const enemy of enemies) hit(s,actor,enemy,{name:"Rain of Arrows",concept:"sightline",delivery:"field",damageType:"nigredo"},effect.potency,["True-form reveal: 14 base LF damage to every enemy on the field."],{revealField:true});
      if(effect.kind==="bombardment") for(const enemy of enemies) hit(s,actor,enemy,{name:"Opening Bombardment",concept:"threshold",delivery:"field",damageType:"citrinitas"},effect.potency,[`MAX reveal: ${effect.potency} base LF damage to every enemy on the field.`],{revealField:true});
      if(effect.kind==="fullCourtPress") {
        for(const ally of Object.values(s.actors).filter(u=>!u.defeated && u.side===actor.side)) ally.fullCourtPress={source:actor.id};
        log(s,{kind:"fullCourtPress",actor:actor.id,text:"Full Court Press: every living ally receives one free relocation to any open map tile. Movement vows still apply."});
      }
      if(effect.kind==="psychology" && insightRules) {
        const owner=s.actors[actor.summon.owner];
        const subjects=s.insight.knowledge[owner.id] ||= {};
        for(const enemy of enemies) {
          const deck=s.insight.decks[enemy.id];if(!deck)continue;
          const know=subjects[enemy.id] ||= insightRules.spawnKnowledge(deck);
          const hidden=deck.cards.filter(c=>!know.revealed.includes(c.id) && ["trait","desire","fear","belief","tell","state","contradiction","realization"].includes(c.kind));
          const card=hidden.find(c=>c.kind==="trait") || hidden[0];
          if(card){know.revealed.push(card.id);s.insight.cognitive=insightRules.recordNotice(s.insight.cognitive || insightRules.emptyCognitive(),enemy.id,card);}
          log(s,{kind:"insight",actor:actor.id,target:enemy.id,text:card ? `The Guardian reveals ${enemy.name}: ${card.text}` : `${enemy.name} has no hidden psychological aspects left to reveal.`});
        }
      }
    }

    return { beginRound, patchAt, createSuccessionPatch, setPatchStage, advanceSuccessionRound, disturbSuccession, startTurn, continueTurnStart,
      summonSnapshot, applySummonUltimateEffects, expire, endTurn, revealDreamSummons, applyRevealEffect };
  })();
});
