"use strict";
// Summon true forms: traits, fields and unlocked techniques.
// A part of the Concept Combat engine, split out of engine.js on 2026-10-11 (tools/split-engine.mjs). It is not a
// module in its own right: engine.js installs it with the host object H (everything the engine closure has in
// scope) and it hands back the functions it defines. Function bodies are exactly as they were in engine.js.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).trueForms = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const spiritGone = (s, u) => { const Spirit = (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null; Spirit?.onExit?.(s, u, H); };   // SP-05: every exit refreshes the roster
    const { Communion, Director, Vows, actorAt, addStun, barrierAt, beginRound, bossRules, currentId, dist, dreamSpaceRules, hasTrait, inside, insightRules, log,
      mirrorRules, modeRules, presidentRules, presidentUnits, recordBattleMirrorOutcome, startTurn, summonRules, summonSnapshot, tileAt, Tsukumogami, footprint, vegetation } = H;
    // defined by parts installed after this one: reached through H when called
    const hit = (...args) => H.hit(...args);
    const apply = (...args) => H.apply(...args);
    const moveOptions = (...args) => H.moveOptions(...args);
    const availableAbilities = (...args) => H.availableAbilities(...args);
    const targeting = (...args) => H.targeting(...args);
    const fearCheck = (...args) => H.fearCheck(...args);
    const moduleArena = (...args) => H.moduleArena(...args);
    const target = (...args) => H.target(...args);

    // ── true forms: traits, fields and unlocked techniques (summons/summons-data.js trueForm) ──────────
    // s.trueFormFields = [{ id, kind: "trash"|"mushroom", x, y, owner, expiresRound, hazard?, heal? }]. Fields end by
    // ROUND, not by their owner's turns, so they still clear after the summon has returned to the palace.
    const trueFormFieldAt = (s, x, y, kind) => (s.trueFormFields || []).find(f => f.kind === kind && f.x === x && f.y === y && f.expiresRound > s.round) || null;
    function syncTrueFormFields(s) {
      if (s.trueFormFields?.length) {
        const gone = s.trueFormFields.filter(f => f.expiresRound <= s.round);
        if (gone.length) {
          s.trueFormFields = s.trueFormFields.filter(f => !gone.includes(f));
          for (const kind of ["trash", "mushroom"]) { const tiles = gone.filter(f => f.kind === kind).map(f => [f.x, f.y]); if (tiles.length) log(s, { kind: "expire", tiles, text: kind === "trash" ? `Trash clears from ${tiles.length} tile${tiles.length === 1 ? "" : "s"}.` : `${tiles.length} mushroom${tiles.length === 1 ? "" : "s"} wilt${tiles.length === 1 ? "s" : ""}.` }); }
        }
      }
      if (!summonRules?.imaginaryFriendHost) return;
      // Imaginary Friend (Inner Child): dream monsters hostile to the host's side play on it while the host is present.
      const host = summonRules.imaginaryFriendHost(Object.values(s.actors));
      for (const m of Object.values(s.actors)) {
        if (!m.dream || m.defeated) continue;
        const held = m.dream.imaginaryFriend;
        if (host && !held && m.side !== host.side) {
          m.dream.imaginaryFriend = { host: host.id, side: m.side }; m.side = host.side;
          log(s, { kind: "imaginaryFriend", actor: host.id, target: m.id, text: `${m.name} is ${host.name}'s imaginary friend now: it won't attack ${host.name} or his allies, only their enemies.`, why: ["Imaginary Friend lasts while the Inner Child stays on the field in true form."] });
        } else if (held && (!host || host.id !== held.host)) {
          m.side = held.side; delete m.dream.imaginaryFriend;
          log(s, { kind: "imaginaryFriend", actor: m.id, text: `${m.name} stops playing along: the Inner Child is gone.` });
        }
      }
    }
    function applyTrueFormReveal(s, actor) {
      const form = summonRules.data.summons[actor.summon.key]?.trueForm; if (!form) return;
      const effect = form.revealEffect;
      if (effect?.kind === "royalTribute") {
        s.royalTribute = { by: actor.summon.key, ...form.tribute };
        log(s, { kind: "royalTribute", actor: actor.id, text: `Royal Tribute: this battle now guarantees ${form.tribute.extraRolls} extra loot roll with better odds of rarer loot.`, why: ["Set once when the King's true form is revealed; it holds for the rest of the battle."] });
      }
      if (effect?.kind === "forcedMarch") {
        const allies = Object.values(s.actors).filter(u => !u.defeated && u.side === actor.side && H.astralSameRegion(s, actor.x, actor.y, u.x, u.y));
        // Everyone gets the same number of own turns: whoever is mid-turn counts this one, the rest start on their next.
        for (const ally of allies) ally.status.moveAdd = { label: "Forced March", owner: ally.id, expiresAt: ally.ownerTurns + effect.duration + (currentId(s) === ally.id ? 0 : 1), amount: effect.moveAdd };
        log(s, { kind: "forcedMarch", actor: actor.id, text: `Forced March: ${allies.length} all${allies.length === 1 ? "y gets" : "ies get"} +${effect.moveAdd} move for ${effect.duration} turns.` });
      }
      syncTrueFormFields(s);
    }
    function runTrueFormTechnique(s, a) {
      const occupied = (x, y) => !!actorAt(s, x, y) || (s.wild || []).some(u => u.form === "unit" && u.x === x && u.y === y);
      const snapshot = { ...summonSnapshot(s), seed: s.seed, playerTarget: s.playerTarget || null, fields: s.trueFormFields || [],
        isFree: (x, y) => inside(s, x, y) && !tileAt(s, x, y).blocksMove && !barrierAt(s, x, y) && !occupied(x, y) && !H.waterAt(s, x, y),
        hiddenCards: insightRules ? Object.fromEntries(Object.values(s.actors).map(u => { const deck = s.insight?.decks?.[u.id], known = s.insight?.knowledge?.[a.summon.owner]?.[u.id]?.revealed || []; return [u.id, deck ? deck.cards.filter(c => !c.open && !known.includes(c.id)).length : 0]; })) : {} };
      const result = summonRules.trueFormTechnique(snapshot, a);
      a.summon = result.summon.summon;
      if (!result.fired) return;
      log(s, result.event);
      const form = summonRules.activeForm(a);
      applyTrueFormEffects(s, a, result.effects, form.technique, a.summon.maxForm ? "MAX" : "true-form");
      checkOutcome(s);
    }
    function applyTrueFormEffects(s, summon, effects, technique, formName = "true-form") {
      s.trueFormFields ||= [];
      for (const effect of effects) {
        const target = effect.target ? s.actors[effect.target] : null;
        if (effect.target && (!target || target.defeated)) continue;
        if (effect.kind === "damage") {
          hit(s, summon, target, { name: technique.name, ability: `trueForm:${technique.id}`, delivery: "field", damageType: effect.channel || "nigredo" }, effect.potency, [`${summon.name}'s ${formName} technique.`], { label: technique.name, revealField: true });
        } else if (effect.kind === "stun") addStun(s, summon, target, effect.points);
        else if (effect.kind === "dread") {   // the Perimeter Guardian: shaken, and routed if already cowed (C8 fear check)
          addStun(s, summon, target, effect.points);
          target.ego = Math.max(0, (target.ego ?? 0.5) - effect.egoLoss);
          fearCheck(s, target, summon);
        }
        else if (effect.kind === "root") {
          target.status.rooted = { label: technique.rootLabel || "Ordered to Kneel", owner: target.id, expiresAt: target.ownerTurns + effect.turns + 1 };   // +1: it must still hold through the target's NEXT turn
          log(s, { kind: "status", actor: summon.id, target: target.id, tiles: [[target.x, target.y]], text: technique.rootText ? `${target.name} ${technique.rootText}` : `${target.name} kneels: no movement on its next turn.` });
        } else if (effect.kind === "revealCard") {
          const owner = s.actors[summon.summon.owner], deck = insightRules && s.insight?.decks?.[target.id];
          if (!owner || !deck) { log(s, { kind: "insight", actor: summon.id, target: target.id, text: `${target.name} has nothing hidden left to name.` }); continue; }
          const subjects = s.insight.knowledge[owner.id] ||= {}, know = subjects[target.id] ||= insightRules.spawnKnowledge(deck);
          const hidden = deck.cards.filter(c => !know.revealed.includes(c.id) && ["trait","desire","fear","belief","tell","state","contradiction","realization"].includes(c.kind));
          const card = hidden.find(c => c.kind === "trait") || hidden[0];
          if (card) { know.revealed.push(card.id); s.insight.cognitive = insightRules.recordNotice(s.insight.cognitive || insightRules.emptyCognitive(), target.id, card); }
          log(s, { kind: "insight", actor: summon.id, target: target.id, text: card ? `${summon.name} names what must be true of ${target.name}: ${card.text}` : `${target.name} has nothing hidden left to name.` });
        } else if (effect.kind === "trash") {
          for (const [x, y] of effect.tiles) {
            s.trueFormFields = s.trueFormFields.filter(f => !(f.kind === "trash" && f.x === x && f.y === y));
            s.trueFormFields.push({ id: "tf" + (++s.seq), kind: "trash", x, y, owner: summon.id, hazard: effect.hazard, expiresRound: s.round + effect.rounds });
          }
        } else if (effect.kind === "ward") petalWard(s, summon, target, effect.protection, effect.turns);
        else if (effect.kind === "knock") {   // MAX Khan's Charge (MX2): the shared knock, so massive, braced and golden targets resist as they always do
          if (!s.outcome) H.knock(s, summon, target, effect.tiles, { name: technique.name, ability: `trueForm:${technique.id}`, delivery: "field", damageType: technique.channel || "nigredo" }, "push");
        }
        else if (effect.kind === "mushroom") {
          const [x, y] = effect.at;
          s.trueFormFields.push({ id: "tf" + (++s.seq), kind: "mushroom", x, y, owner: summon.id, heal: effect.heal, expiresRound: s.round + effect.rounds });
        }
      }
    }
    // Mitsuko MAX (MX1): a petal ward. What she stores never protects her. It replaces only a weaker petal ward or a
    // weaker flow-state ward (the flow ward is residual and yields); armour, a hide or a cast ward is never touched.
    // Held for `turns` of the ally's own turns.
    function petalWard(s, by, target, protection, turns) {
      if (!target || target.defeated || target.id === by.id) return false;
      const held = target.status.ward;
      if (held && (!(held.petal || held.flow) || held.protection >= protection)) return false;
      target.status.ward = { label: "Petal ward", owner: target.id, protection, petal: true, by: by.id, expiresAt: target.ownerTurns + turns + (currentId(s) === target.id ? 0 : 1) };
      log(s, { kind: "status", actor: by.id, target: target.id, tiles: [[target.x, target.y]], text: `${target.name} is wrapped in a ${protection}-point petal ward.`, why: [`${by.name}'s petal ward: what she stores never protects her.`] });
      return true;
    }
    // A damaged unit that enters a mushroom tile eats it; an unhurt one leaves it for someone who needs it.
    function eatMushroom(s, unit, x, y) {
      const m = trueFormFieldAt(s, x, y, "mushroom");
      if (!m || !unit || unit.defeated || unit.lf >= unit.maxLF) return;
      const before = unit.lf; unit.lf = Math.min(unit.maxLF, unit.lf + m.heal);
      s.trueFormFields = s.trueFormFields.filter(f => f !== m);
      log(s, { kind: "heal", actor: m.owner, target: unit.id, tiles: [[x, y]], text: `${unit.name} eats a mushroom and recovers ${unit.lf - before} LF.`, why: ["Zherm's Sporefall: a mushroom heals only a damaged unit, once."] });
    }
    function fullCourtPressOptions(s,id) {
      const unit=s.actors[id];if(!unit?.fullCourtPress || unit.defeated || unit.summon?.holdPosition || unit.status.rooted?.expiresAt>unit.ownerTurns || unit.status.lockMove?.expiresAt>unit.ownerTurns || Vows?.refuses(s,unit,"move")) return [];
      const out=[];for(let y=0;y<s.arena.h;y++)for(let x=0;x<s.arena.w;x++)if(H.astralSameRegion(s,unit.x,unit.y,x,y) && !tileAt(s,x,y).blocksMove && (!(unit.committed?.noRetreat || unit.promise?.surrender==="retreat") || !presidentRules || presidentRules.canMove({...presidentUnits(s).find(u=>u.id===unit.id),committed:{noRetreat:true}},{x,y},presidentUnits(s).filter(u=>u.side!==unit.side))) && !actorAt(s,x,y) && !barrierAt(s,x,y) && !(s.wild || []).some(u=>u.form==="unit"&&u.x===x&&u.y===y))out.push({to:[x,y]});
      return out;
    }

    function closeDreamSummons(s, field = s.dreamSpace) {
      if (!dreamSpaceRules) return;
      for (const id of field?.summons || []) {
        const summon = s.actors[id]; if (!summon || summon.defeated) continue;
        Object.assign(summon, dreamSpaceRules.onCloseSummon(summon));
        log(s, { kind: "summon", actor: summon.id, text: summon.summon?.maxForm ? `${summon.name} stays: a MAX form outlives the dream.` : `${summon.name} will linger for one more turn as the Dream Space closes.` });   // MAX keeps its doubled turns (dreamspace.js onCloseSummon)
      }
    }
    function closeDreamTreeants(s, field = s.dreamSpace) {
      if (!Communion?.revertTreeant) return;
      for (const u of Object.values(s.actors)) {
        if (!u.treeant || u.defeated || (field && u.communed?.owner !== field.owner)) continue;
        Object.assign(u, Communion.revertTreeant(u));
        log(s, { kind: "treeant", actor: u.id, text: `${u.name} sinks back into its plant form as the dream closes.` });
      }
    }
    // A committed owner ultimate ends its own dream only after top-level resolution (or scheduling,
    // for a delayed move). A token prevents an echo or a later trigger closing a different dream.
    function finishDreamUltimate(s, a, inst) {
      const field = s.dreamSpace;
      if (!inst.dreamFinisher || field?.owner !== a.id || field.ultimateCommit !== inst.dreamFinisher) return;
      const closed = dreamSpaceRules.close(field, `${inst.name} spent the dream`);
      s.dreamSpace = null;
      for (const ev of closed.events) log(s, { ...ev, kind: "dreamSpace" });
      for (const id of closed.fades) if (s.actors[id]) { s.actors[id].defeated = true; spiritGone(s, s.actors[id]); }
      closeDreamSummons(s, field); closeDreamTreeants(s, field);
      if (a.aura?.imbued) a.aura = null; // consume the folded aura without another turn-start pulse
      checkOutcome(s); // called dream threats may have faded after an announced response
    }
    // The dream closes when its dreamer falls or a hit has broken their concentration (damage.js hit(), Mala 2026-10-17).
    // Being badly hurt alone no longer closes it: below collapseIfCasterBelow each enemy hit rolls instead.
    function checkDreamCollapse(s) {
      if (!dreamSpaceRules || !s.dreamSpace) return;
      const owner = s.actors[s.dreamSpace.owner];
      if (owner && !owner.defeated && !s.dreamSpace.concentrationBroken) return;
      const field = s.dreamSpace;
      const closed = dreamSpaceRules.close(field, !owner || owner.defeated ? "its dreamer fell" : "its dreamer lost concentration");
      s.dreamSpace = null;
      for (const ev of closed.events) log(s, { ...ev, kind: "dreamSpace" });
      closeDreamSummons(s, field);
      closeDreamTreeants(s, field);
    }
    // Observe teaches O2b: a dream monster the player named (the nameDream action) fades when the round closes (the same outcome as dream.js endOfRound's "named" branch, which the engine never calls), in a Dream Space or out of one (random rifts). Dreams on the player's side are never named (the action refuses them).
    function fadeNamedDreams(s) {
      for (const actor of Object.values(s.actors)) if (actor.dream?.named && !actor.defeated && actor.side !== "player") { actor.defeated = true; spiritGone(s, actor); log(s, { kind: "dreamFade", actor: actor.id, text: `${actor.name} fades: you woke from it.` }); }
    }
    function resolveDreamRound(s) {
      if (!dreamSpaceRules || !s.dreamSpace || s.outcome) { if (!s.outcome) fadeNamedDreams(s); return; }
      const units = Object.values(s.actors);
      const snapshot = { seed: s.seed, round: s.round, arena: moduleArena(s.arena), units,
        wild: [...s.wild, ...units.filter((a) => a.dream)], heroId: s.dreamSpace.owner };
      // Focused dream: occupants' psyches (dream/psyche.js). The player's integration is their Insight/Mirror record.
      if (s.dreamSpace.region && dreamSpaceRules.psyche) {
        const PS = dreamSpaceRules.psyche;
        snapshot.psyche = Object.fromEntries(units.filter((a) => !a.dream && !a.summon).map((a) => [a.id, { traits: a.traits || [],
          ...(a.id === "player" && s.self ? { integration: PS.integrationFromRecord({ self: s.self, traumaStatus: mirrorRules?.traumaStatus?.(s.self), dreamsBefriended: s.mirror?.dreamsBefriended || [],
            dreamsForFull: bossRules?.data?.integratedSelf?.requirements?.dreamsBefriended || 3 }) } : {}) }]));
        // Facing a manifestation raises its owner's integration, once each (gaze held, named, or broken).
        for (const a of units) {
          if (!a.dream?.owner || a.dream.credited || !s.dreamSpace?.psyche) continue;
          const kind = a.side !== "wild" && !a.defeated ? "holdGaze" : a.dream.named ? "nameIt" : a.defeated && a.lf <= a.maxLF * 0.25 ? "defeat" : null;
          if (!kind) continue;
          a.dream.credited = true;
          const r = dreamSpaceRules.creditManifestation(s.dreamSpace, a, kind);
          s.dreamSpace = r.field;
          if (r.event) log(s, r.event);
        }
      }
      const fieldBefore = s.dreamSpace;
      const result = dreamSpaceRules.endOfRound(fieldBefore, snapshot, { seed: s.seed });
      s.dreamSpace = result.field;
      for (const ev of result.events || []) log(s, ev);
      for (const id of result.fades || []) {
        const actor = s.actors[id]; if (!actor) continue;
        actor.defeated = true; spiritGone(s, actor);
        log(s, { kind: "dreamFade", actor: id, text: actor.name + " fades as the Dream Space closes." });
      }
      fadeNamedDreams(s);   // Observe teaches O2b (after the psyche credit above)
      if (!s.dreamSpace && result.summonLinger) closeDreamSummons(s, fieldBefore);
      if (!s.dreamSpace) closeDreamTreeants(s, fieldBefore);
      if (result.appear) {
        const raw = dreamSpaceRules.makeDreamActor(result.appear.monster, { at: result.appear.at, configIndex: result.appear.configIndex, round: s.round });
        if (result.appear.psyche) Object.assign(raw.dream, { source: "psyche", owner: result.appear.psyche.owner, archetype: result.appear.psyche.archetype, potencyMul: result.appear.psyche.potencyMul, potencyCap: dreamSpaceRules.psyche.rules.potencyCap });
        registerDreamActor(s, raw, result.appear.at, "dreamAppear", raw.name + " surfaces from Dream Space (" + raw.primary + " + " + raw.secondary + ").");
      }
    }
    // rules.risesOnDeath: a defeated Pharaoh's Mummy. Called from the defeat path before the outcome is checked, so a
    // side whose last unit was the Pharaoh is not judged empty. Once per Pharaoh.
    function riseOnDeath(s, fallen) {
      const def = s.rules.risesOnDeath?.[fallen?.character];
      if (!def || fallen.risen || fallen.knockedOut || fallen.escaped || !dreamSpaceRules?.makeEnemyDreamActor) return null;
      fallen.risen = true;
      const at = [fallen.x, fallen.y];
      const raw = dreamSpaceRules.makeEnemyDreamActor(def.monster, { at, round: s.round, summoner: fallen.id, id: `risen-${def.monster}-${fallen.id}` });
      raw.side = fallen.side; raw.dream.source = "risen";
      registerDreamActor(s, raw, at, "risen", `${raw.name} rises where ${fallen.name} fell.`);
      const risen = s.actors[raw.id]; risen.sprite = def.sprite; risen.side = fallen.side; risen.risenFrom = fallen.id;
      return risen;
    }
    // The Insect Kaiju's brood (content.js rules.brood; Mala, 2026-11-01): at most `maxAlive` Brood Mites alive and `maxTotal` in all.
    // A mite is a dream-monster actor of the boss's side (the Pharaoh's Mummy is the precedent), so the capture ritual, beads and the AI come with it.
    const broodRules = (s) => s.rules.brood || null;
    const broodMites = (s, boss) => Object.values(s.actors).filter((u) => u.dream?.source === "brood" && u.dream.summoner === boss.id);
    function broodReady(s, a) {
      const R = broodRules(s);
      if (!R || a.boss !== R.boss || a.side !== "enemy" || a.defeated || a.lf <= 0 || !dreamSpaceRules?.makeEnemyDreamActor) return { ok: false, reason: "Only the Insect Kaiju calls the brood." };
      const mites = broodMites(s, a), alive = mites.filter((u) => !u.defeated).length;
      if (alive >= R.maxAlive) return { ok: false, reason: `${R.maxAlive} Brood Mites are alive already.` };
      if ((a.broodCalled || 0) >= R.maxTotal) return { ok: false, reason: `The brood is spent: ${R.maxTotal} have been called this battle.` };
      if (a.broodRound === s.round && (a.broodThisRound || 0) >= R.perRound) return { ok: false, reason: `It calls ${R.perRound} a round at most.` };
      if (a.tempo < R.ap) return { ok: false, reason: `Calling the brood needs ${R.ap} action points.` };
      return { ok: true, ap: R.ap };
    }
    // An open tile beside the boss's footprint.
    function broodOpen(s, a, [x, y]) {
      const own = footprint(a);
      return Number.isInteger(x) && Number.isInteger(y) && inside(s, x, y) && !own.some(([ox, oy]) => ox === x && oy === y) && own.some(([ox, oy]) => Math.max(Math.abs(ox - x), Math.abs(oy - y)) === 1)
        && !actorAt(s, x, y) && !tileAt(s, x, y).blocksMove && (!barrierAt(s, x, y) || barrierAt(s, x, y).passable) && !(s.wild || []).some((w) => w.form === "unit" && !w.defeated && w.x === x && w.y === y)
        && !(s.arena.objects || []).some((o) => o.blocksMove && o.hp !== 0 && o.x === x && o.y === y);
    }
    function broodTile(s, a) {
      const tiles = [];
      for (const [fx, fy] of footprint(a)) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push([fx + dx, fy + dy]);
      return tiles.filter((t) => broodOpen(s, a, t)).sort((p, q) => p[1] - q[1] || p[0] - q[0])[0] || null;
    }
    function broodCandidate(s, a) {
      if (!broodReady(s, a).ok) return null;
      const at = broodTile(s, a);
      return at ? { type: "monsterSummon", actor: a.id, tiles: [at] } : null;
    }
    // Returns an error string (nothing spent) or undefined.
    function callBrood(s, a, act) {
      const ready = broodReady(s, a); if (!ready.ok) return ready.reason;
      const at = Array.isArray(act.tiles) && act.tiles.length === 1 && Array.isArray(act.tiles[0]) ? act.tiles[0] : null;
      if (!at || !broodOpen(s, a, at)) return "Choose an open tile beside the Kaiju.";
      const spend = H.spendTempo(s, a, ready.ap, "Call the Brood"); if (spend) return spend;
      const n = (a.broodCalled = (a.broodCalled || 0) + 1), R = broodRules(s);
      a.broodThisRound = a.broodRound === s.round ? (a.broodThisRound || 0) + 1 : 1; a.broodRound = s.round;
      const raw = dreamSpaceRules.makeEnemyDreamActor(R.kind, { at, round: s.round, summoner: a.id, id: `brood-${a.id}-${n}` });
      raw.side = a.side; raw.dream.source = "brood";
      registerDreamActor(s, raw, at, "dreamAppear", `${a.name} calls a ${raw.name} (${n} of ${R.maxTotal}).`);
      const mite = s.actors[raw.id]; mite.sprite = "brood-mite"; mite.side = a.side; mite.broodOf = a.id;
      return undefined;
    }
    // Once the mother has fallen, a mite that dies may leave a bead (content.js rules.brood.beadChance), once per mite, to the
    // unit that struck the blow if it is on the player's side; the ritual (actions.js) is the sure way to a bead.
    // Brood Mite beads one unit holds (Mala, 2026-11-01: 4 is fine).
    const broodHeld = (u) => (u.beads || []).filter((b) => b.mind?.key === "broodMite").length;
    function broodBeadDrop(s, fallen, by) {
      const R = broodRules(s);
      if (!R || fallen.dream?.source !== "brood" || fallen.captured || fallen.escaped) return null;
      const mother = s.actors[fallen.dream.summoner];
      if (!mother || !mother.defeated || !by || by.side === fallen.side) return null;
      const owner = by.summon?.owner || by.companion?.owner || by.tamed?.owner, taker = owner ? s.actors[owner] : by;
      if (!taker || taker.defeated || taker.side !== "player" || fallen.broodRolled || broodHeld(taker) >= R.maxHeld) return null;
      fallen.broodRolled = true;
      if (H.seededChance(`${s.seed}:brood-bead:${fallen.id}`) >= R.beadChance) return null;
      (taker.beads ||= []).push({ kind: "dream", name: fallen.name, maxLF: fallen.maxLF, mind: { key: fallen.dream.key, character: fallen.character, sprite: fallen.sprite, primary: fallen.primary, secondary: fallen.secondary, monster: fallen.monster || null, dream: { ...fallen.dream } } });
      (s.captureLog ||= []).push({ actor: taker.id, kind: `dream:${fallen.dream.key}`, ok: true, chance: true });
      log(s, { kind: "ritual", actor: taker.id, tiles: [[fallen.x, fallen.y]], captured: `dream:${fallen.dream.key}`, text: `${taker.name} finds a bead where the ${fallen.name.toLowerCase()} fell.`, why: [`Once the mother has fallen, a Brood Mite that dies has a ${Math.round(R.beadChance * 100)}% chance to leave a bead.`] });
      return taker;
    }
    function registerDreamActor(s, raw, at, kind = "dreamAppear", text = null) {
      const id = raw.id;
      const dreamSprite = ({ many_mouths: "dream_hound", witness_vessel: "dream_witness", amber_host: "dream_amber", salt_heir: "dream_salt", unfinished_customer: "dream_customer", last_span: "last_span" })[raw.dream?.key] || "dream";
      const actor = { ...raw, x: at[0], y: at[1], sprite: dreamSprite, ai: "dream", controller: "ai", pf: s.rules.maxPF, maxPF: s.rules.maxPF,
        ultimateCharge: 0, level: 1, xp: 0, proficiency: 1, reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
        reaction: s.rules.reactionsPerRound, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0,
        tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false, ownerTurns: 0, lastRecoverTurn: -99,
        status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null },
        inventory: [], inventoryCapacity: 0, passives: {}, lanyardUsed: false, bristleconeUsed: false, lastDamageType: null, defeated: false,
        eventActor: raw.dream?.source === "randomEvent", side: raw.dream?.source === "randomEvent" ? "wild" : raw.side };
      s.actors[id] = actor; s.disclosures[id] = {}; s.knowledge[id] = {};
      if (insightRules) { const deck = insightRules.buildDeck({ key: raw.dream?.key || id, kind: "dream" }, { seed: s.seed }); s.insight.decks[id] = deck; s.insight.knowledge[id] = insightRules.spawnKnowledge(deck); }
      for (const existing of Object.values(s.actors)) if (existing.id !== id && existing.side !== actor.side) {
        if (!s.knowledge[existing.id]) s.knowledge[existing.id] = {};
        s.knowledge[existing.id][id] = { secondary: false, lens: false, abilities: {} };
        s.knowledge[id][existing.id] = { secondary: false, lens: false, abilities: {} };
      }
      s.order.push(id);
      log(s, { kind, actor: id, tiles: [at], text: text || `${actor.name} pours through the Dream Rift; it attacks every side.` });
      return actor;
    }
    function resolveRandomDreamRift(s) {
      const rift = s.randomDreamRift;
      if (!rift || s.outcome || !dreamSpaceRules) return;
      if (s.round > rift.openedRound && rift.wavesDone >= rift.duration) { s.randomDreamRift = null; return; }
      if (rift.wavesDone >= rift.duration) return;
      const wave = rift.wavesDone + 1;
      for (let i = 0; i < rift.countPerWave; i++) {
        const spawn = dreamSpaceRules.randomEventWave({ ...summonSnapshot(s), arena: moduleArena(s.arena) }, { seed: s.seed, round: s.round, index: wave * 10 + i });
        if (spawn) registerDreamActor(s, spawn.actor, spawn.at, "dreamRift", spawn.text);
      }
      rift.wavesDone = wave;
      rift.turnsRemaining = Math.max(0, rift.duration - wave);
      log(s, { kind: "dreamRift", text: `Dream Rift wave ${wave} of ${rift.duration} spills onto the battlefield.` });
      if (wave >= rift.duration) s.randomDreamRift = null;
    }
    // Ambient appearances (reachability fix): once per round at round end, the round's
    // recent events (s.dreamRecent, consumed here) may surface one dream monster.
    function resolveDreamAppearances(s) {
      if (!dreamSpaceRules?.checkAppear || s.outcome) { s.dreamRecent = {}; return; }
      const snap = { seed: s.seed, round: s.round, mode: s.mode || "classic", arena: moduleArena(s.arena),
        units: Object.values(s.actors), wild: [...(s.wild || []), ...Object.values(s.actors).filter((a) => a.dream)],
        heroId: s.modeSetup?.hero || "player", recent: s.dreamRecent || {} };
      const hit = dreamSpaceRules.checkAppear(snap);
      s.dreamRecent = {};
      if (!hit) return;
      const raw = dreamSpaceRules.makeDreamActor(hit.monster, { at: hit.at, configIndex: hit.configIndex, round: s.round });
      registerDreamActor(s, raw, hit.at, "dreamAppear", `${raw.name} surfaces from a dream (${hit.reason}).`);
    }
    function advance(s) {
      if (s.outcome) { H.Tourist?.settle(s,H.touristH()); return; }
      for (let i = 0; i < s.order.length; i++) {
        s.turnIndex += 1;
        if (s.turnIndex >= s.order.length) {
          if (s.film && Director) {
            s.turnIndex = 0; Director.filmWrap(s, H);
            if (!s.film) { checkOutcome(s); if (s.outcome) return; continue; }   // a max-takes wrap collapsed the film: collapse restored the outside turn index, so keep advancing from there
            if (s.outcome) return;
          }
          else { s.turnIndex = 0; beginRound(s); if (s.outcome) return; if (s.round > s.rules.maxRounds) { s.outcome = { winner: "none", reason: "round limit" }; s.phase = "over"; return; } }
        }
        { const cur = s.actors[currentId(s)]; if (cur && !cur.defeated) break; }   // a missing actor (forgotten mid-turn) never holds the pointer
      }
      startTurn(s);
    }
    // Plant communion: bring a plant out of the ground as an ally of `a` (terrain/communion.js).
    // ── Horticulture Expertise (Muse C24; terrain/communion-data.js rules.horticulture) ──
    // Tend: at the holder's turn start, allied communed plants in range recover a little and their Green ward is renewed.
    function tendPlants(s, a) {
      const HX = Communion?.rules.horticulture;
      if (!HX || a.defeated || a.communed || !hasTrait(a, HX.trait)) return;
      const near = Object.values(s.actors).filter(u => u.communed && !u.defeated && u.side === a.side && dist(s, a.x, a.y, u.x, u.y) <= HX.tendRange);
      if (!near.length) return;
      let healed = 0;
      for (const u of near) {
        const gain = Math.max(0, Math.min(HX.tendHeal, u.maxLF - u.lf));
        u.lf += gain; healed += gain;
        if (!u.status.ward || u.status.ward.label === "Green ward") u.status.ward = { label: "Green ward", owner: a.id, protection: HX.wardProtection, expiresAt: u.ownerTurns + HX.wardTurns };
      }
      log(s, { kind: "tend", actor: a.id, healed, tiles: near.map(u => [u.x, u.y]), text: `${a.name} tends ${near.length === 1 ? near[0].name : `${near.length} plants`}${healed ? `: +${healed} LF` : ""}, Green ward ${HX.wardProtection}.`,
        why: [`Horticulture Expertise: communed plants within ${HX.tendRange} recover ${HX.tendHeal} LF and get a ward of ${HX.wardProtection} at the start of each of the holder's turns.`] });
    }
    // Leash: what a communed plant's AI wanted, corrected so a plant that is not fighting stays near its owner.
    // Engaged plants (an enemy within engagedRange) fight on; a plant whose owner is down acts freely.
    function leashAction(s, act) {
      const HX = Communion?.rules.horticulture, a = act && s.actors[act.actor];
      if (!HX || !a?.communed || a.defeated || act.type === "respond") return act;
      const owner = s.actors[a.communed.owner];
      if (!owner || owner.defeated || owner.routed) return act;
      const far = (x, y) => dist(s, x, y, owner.x, owner.y), leash = hasTrait(owner, HX.trait) ? HX.leash : HX.leashOther, now = far(a.x, a.y);
      const legal = (alt) => { try { return apply(s, alt, { preview: true }).ok ? alt : null; } catch { return null; } };
      // A held plant strikes the weakest enemy it can reach from where it stands, else guards, else waits.
      const strike = () => {
        const foes = Object.values(s.actors).filter(u => !u.defeated && u.side !== a.side);
        for (const x of (availableAbilities(s, a.id) || []).filter(x => x.affordable && x.m && ["damage", "field"].includes(x.m.effect))) {
          const spots = targeting(s, a.id, x.id)?.legal || []; if (!spots.length) continue;
          const foeAt = (l) => foes.find(f => f.x === l.at[0] && f.y === l.at[1]);
          const best = spots.filter(foeAt).sort((m, n) => foeAt(m).lf - foeAt(n).lf)[0];
          const alt = best && legal({ type: "ability", actor: a.id, ability: x.id, target: best.at });
          if (alt) return alt;
        }
        // Basic Strike costs AP, not Phi: defensive kits still fight when held at the leash.
        // Reuse the AI's targets so peaceful factions, truces and soothed units stay protected.
        const strikes = H.candidates(s, a.id).filter(c => c.type === "strike")
          .sort((m, n) => (actorAt(s, ...m.target)?.lf ?? Infinity) - (actorAt(s, ...n.target)?.lf ?? Infinity));
        for (const cand of strikes) { const alt = legal(cand); if (alt) return alt; }
        return null;
      };
      const hold = () => strike() || legal({ type: "guard", actor: a.id }) || { type: "stall", actor: a.id };
      const engaged = Object.values(s.actors).some(u => !u.defeated && u.side !== a.side && dist(s, a.x, a.y, u.x, u.y) <= HX.engagedRange);
      if (now > leash && !engaged) {
        if (act.type === "move" && act.to && far(act.to[0], act.to[1]) < now) return act;
        const home = (moveOptions(s, a.id) || []).filter(o => o.to && far(o.to[0], o.to[1]) < now).sort((m, n) => far(m.to[0], m.to[1]) - far(n.to[0], n.to[1]))[0];
        return home ? { type: "move", actor: a.id, to: home.to, leash: "home" } : act.type === "move" ? hold() : act;
      }
      if (act.type === "move" && act.to) { const to = far(act.to[0], act.to[1]); if (to > leash && to >= now) return { ...hold(), leash: "held" }; }
      return act;
    }
    function communeAlly(s, a, obj) {
      const raw = Communion.makeAlly(obj, { owner: a.id, side: a.side });
      const ally = { ...raw, ai: "ally", pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, level: a.level || 1, xp: 0, proficiency: a.proficiency || 1, reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
        reaction: s.rules.reactionsPerRound, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false,
        ownerTurns: 0, lastRecoverTurn: -99, status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null }, inventory: [], inventoryCapacity: 0,
        passives: {}, traits: [], conditions: {}, lanyardUsed: false, bristleconeUsed: false, lastDamageType: null, defeated: false };
      s.arena.objects = s.arena.objects.filter(o => o.id !== obj.id);
      s.actors[ally.id] = ally; s.disclosures[ally.id] = {}; s.knowledge[ally.id] = {}; s.observedAbilities[ally.id] = [];
      if (insightRules) { const deck = insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[ally.id] = deck; s.insight.knowledge[ally.id] = insightRules.spawnKnowledge(deck); }
      for (const other of Object.values(s.actors)) if (other.id !== ally.id && other.side !== ally.side) {
        s.knowledge[other.id] ||= {}; s.knowledge[other.id][ally.id] ||= { secondary: false, lens: false, abilities: {} };
        s.knowledge[ally.id][other.id] = { secondary: false, lens: false, abilities: {} };
      }
      s.order.splice(s.turnIndex + 1, 0, ally.id); if(a.side==="player")s.communion.communed++;
      const BT = Communion.rules.botanist;
      const mul = (a.passives?.communeHpMul || 1) * (BT && hasTrait(a, BT.trait) ? BT.allyHpMul : 1);   // Gaia's regard: Deep Roots; Field Botany
      if (mul !== 1) { ally.maxLF = Math.round(ally.maxLF * mul); ally.lf = ally.maxLF; }
      return ally;
    }
    // Tsukumogami: standing up needs room. Size 0-1 takes 2 tiles (horizontal first), size 2-3 takes
    // 2x2, growing from the object's tile into open tiles: inside, no blocking terrain, no unit, no
    // closed barrier. Null when it has no room to stand.
    function standFootprint(s, obj, size) {
      const open = (x, y) => inside(s, x, y) && !tileAt(s, x, y).blocksMove && !actorAt(s, x, y) && !(barrierAt(s, x, y) && !barrierAt(s, x, y).passable);
      if (size >= 2) return [[obj.x + 1, obj.y], [obj.x, obj.y + 1], [obj.x + 1, obj.y + 1]].every(([x, y]) => open(x, y)) ? { w: 2, h: 2 } : null;
      if (open(obj.x + 1, obj.y)) return { w: 2, h: 1 };
      if (open(obj.x, obj.y + 1)) return { w: 1, h: 2 };
      return null;
    }
    // Tsukumogami (Muse Berry BD): the mirror of communeAlly. A right answer stands the structure up as an
    // actor on the waker's side; the object leaves the arena (its cover and sight-block go with it).
    function awakenAlly(s, a, obj) {
      const raw = Tsukumogami.makeAlly(obj, { owner: a.id, side: a.side });
      let n = 1; while (s.actors[n === 1 ? raw.id : `${raw.id}-${n}`]) n++;   // a re-woken object stands under a fresh id; the settled rest never shares the order
      if (n > 1) raw.id = `${raw.id}-${n}`;
      const size = standFootprint(s, obj, raw.awakened.size) || { w: 1, h: 1 };   // the commune gate refused null already; the fallback never fires
      const ally = { ...raw, size, massive: raw.awakened.size >= 2, ai: "ally", pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, level: a.level || 1, xp: 0, proficiency: a.proficiency || 1, reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
        reaction: 0, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false,
        ownerTurns: 0, lastRecoverTurn: -99, status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null }, inventory: [], inventoryCapacity: 0,
        passives: {}, traits: raw.traits || [], conditions: {}, lanyardUsed: false, bristleconeUsed: false, lastDamageType: null, defeated: false };   // the material trait rides in raw
      s.arena.objects = s.arena.objects.filter(o => o.id !== obj.id);
      s.actors[ally.id] = ally; s.disclosures[ally.id] = {}; s.knowledge[ally.id] = {}; s.observedAbilities[ally.id] = [];
      if (insightRules) { const deck = insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[ally.id] = deck; s.insight.knowledge[ally.id] = insightRules.spawnKnowledge(deck); }
      for (const other of Object.values(s.actors)) if (other.id !== ally.id && other.side !== ally.side) {
        s.knowledge[other.id] ||= {}; s.knowledge[other.id][ally.id] ||= { secondary: false, lens: false, abilities: {} };
        s.knowledge[ally.id][other.id] = { secondary: false, lens: false, abilities: {} };
      }
      s.order.splice(s.turnIndex + 1, 0, ally.id); if(a.side==="player")s.tsukumogami.awakened++;
      return ally;
    }
    // Gaia's regard (account/gaia-bond.js battleOptions): boons earned by standing, applied to the hero at battle start.
    function applyGaiaBoons(s, boons) {
      const hero = s.actors[s.modeSetup?.hero || "player"]; if (!hero || !Array.isArray(boons) || !boons.length) return;
      s.gaiaBoons = [];
      for (const b of boons.slice().sort((x, y) => (x.kind === "factionAlly") - (y.kind === "factionAlly"))) {   // the ally last, so it arrives with every trait already in place
        if (b.kind === "natureTrait") {
          if (b.trait && !(hero.traits || []).some(t => (typeof t === "string" ? t : t?.id) === b.trait)) hero.traits = [...(hero.traits || []), b.trait];
          if (b.passive) hero.passives = { ...(hero.passives || {}), ...b.passive };
        } else if (b.kind === "tempBuff" && b.buff) {
          if (b.buff.maxLFAdd) { hero.maxLF += b.buff.maxLFAdd; hero.lf += b.buff.maxLFAdd; }
          if (b.buff.startingUltimateCharge) hero.ultimateCharge = Math.min(s.rules.ultimateChargeMax, (hero.ultimateCharge || 0) + b.buff.startingUltimateCharge);
        } else if (b.kind === "factionAlly" && Communion) {
          const plant = (s.arena.objects || []).filter(o => o.kind === "plant" && o.hp > 0 && Communion.profile(o.type) && !actorAt(s, o.x, o.y))
            .sort((p, q) => dist(s, hero.x, hero.y, p.x, p.y) - dist(s, hero.x, hero.y, q.x, q.y) || (p.id < q.id ? -1 : 1))[0];
          if (!plant) continue;
          const ally = communeAlly(s, hero, plant);
          log(s, { kind: "commune", actor: ally.id, target: hero.id, gift: true, tiles: [[ally.x, ally.y]], text: `${b.name}: the ${Communion.profile(plant.type).common} is already awake and stands with ${hero.name} as ${ally.name} (${ally.lf} LF).`, why: ["A boon of Gaia's regard."] });
        } else continue;
        s.gaiaBoons.push(b.id);
      }
      if (s.gaiaBoons.length) log(s, { kind: "gaiaBoon", actor: hero.id, text: `Gaia's regard: ${boons.filter(b => s.gaiaBoons.includes(b.id)).map(b => b.name).join(", ")}.` });
    }
    // Tsukumogami: four rounds up, it settles back into an object with half its remaining LF, on the
    // footprint tile nearest where it woke. It leaves like a summon whose stay ended (defeated, lingering
    // in the order to be skipped), marked settledBack so it earns no kill credit and raises no corpse.
    function settleTsukumogami(s, a) {
      const [sx, sy] = Tsukumogami.settleTile(footprint(a), a.awakened.wakeX, a.awakened.wakeY);
      const o = a.awakened.object, hp = Math.max(1, Math.floor(a.lf / 2));
      s.arena.objects = [...(s.arena.objects || []), { ...o, x: sx, y: sy, hp, status: {} }];
      a.defeated = true; a.settledBack = true; a.lf = 0;
      log(s, { kind: "settle", actor: a.id, tiles: [[sx, sy]], text: `${a.name} settles back into a ${Tsukumogami.profile(o.type).common} (${hp} HP).` });
    }
    // Tsukumogami: an awakened structure run out of LF collapses into rubble (the type's `becomes`, via
    // damageObject, so a cistern still floods). Called from checkOutcome beside rootFallenPlants.
    function collapseFallenStructures(s) {
      if (!Tsukumogami || !vegetation) return;
      for (const a of Object.values(s.actors)) {
        if (!a.awakened || !a.defeated || a.settledBack || a.awakened.collapsed) continue;
        a.awakened.collapsed = true;
        const [sx, sy] = Tsukumogami.settleTile(footprint(a), a.awakened.wakeX, a.awakened.wakeY);
        const back = { ...a.awakened.object, x: sx, y: sy, hp: 1, status: {} };
        const r = vegetation.damageObject({ ...s.arena, objects: [...(s.arena.objects || []), back] }, back.id, 9999, { from: [sx, sy] });
        s.arena = { ...s.arena, objects: r.arena.objects, map: r.arena.map };
        for (const ev of r.events) log(s, { kind: ev.kind, actor: a.id, tiles: [[sx, sy]], text: ev.text });
        log(s, { kind: "collapse", actor: a.id, tiles: [[sx, sy]], text: `${a.name} collapses into rubble.` });
      }
    }
    // Plant communion: an ally whose life has run out is dead. Its body stays as terrain (terrain/communion.js corpseObject).
    function rootFallenPlants(s) {
      if (!Communion) return;
      for (const a of Object.values(s.actors)) {
        if (!a.communed || !a.defeated || a.communed.rooted) continue;
        a.communed.rooted = true;
        const free = !(s.arena.objects || []).some(o => o.x === a.x && o.y === a.y);
        if (free) { s.arena.objects = (s.arena.objects || []).concat([Communion.corpseObject(a)]); }
        const i = s.order.indexOf(a.id); if (i >= 0 && s.order[s.turnIndex] !== a.id) { s.order.splice(i, 1); if (i < s.turnIndex) s.turnIndex--; }
        log(s, { kind: "communeEnd", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} is spent and dies${free ? " where it stands. Its body stays" : ""}.`,
          why: ["A communed plant fights until its life runs out. What is left is terrain: it blocks and shelters as the plant did, and will not answer again."] });
      }
    }
    // Does this unit hold its side of the battle open? (the default branch of checkOutcome; also Survival Instincts' "is anyone left")
    const sideKey = (u) => (u.side === "posthuman" ? "enemy" : u.side);   // a posthuman counts on the enemy side, as checkOutcome always routed it
    // Nonlethal victory (NONLETHAL.md N3): a unit incapacitated with at least one own turn still to come does not hold the battle open (a unit on a clock of 0 wakes at its next turn start).
    const subduedUnit = (a) => !!a?.states?.incapacitated && !a.defeated && !a.notArrived && (a.states.incapacitated.count ?? 0) >= 1;
    function holdsOpen(s, a) {
      if (subduedUnit(a)) return false;
      if (a.side === "enemy" && a.persuaded && !a.defeated && !a.notArrived) return false;   // Parley: standing down
      if (a.side === "enemy" && a.status?.sealedBeast && !a.defeated) return false;   // Sealing: a bound foe is out of the fight (audit 1.3.448)
      if (a.side === "civilian") return false;   // Civilians never hold the battle open, even after they shove back
      if (a.husk) return false;   // an empty husk still stands, and does not hold the battle open
      if (a.side === "posthuman") return !a.defeated && !a.notArrived && !!H.PostHuman.threatens(s, "player");   // Post-Humanity holds the battle open only against a player it is at war with
      return !a.defeated || !!a.notArrived;
    }
    function checkOutcome(s) {
      // Ingredient totems: a host that falls loses its totem at once, so a revive never brings it back (Fathom AD batch 5).
      // Here because nearly every defeat path ends in checkOutcome; totemTurnEnd still clears it on any path that does not.
      for (const u of Object.values(s.actors)) if (u.totem && u.defeated) { log(s, { kind: "totem", actor: u.id, text: `The ${u.totem.name} goes back to sleep: its host fell.` }); u.totem = null; }
      rootFallenPlants(s);
      collapseFallenStructures(s);
      H.astralDeathLink?.(s);   // the death-link resolves before the outcome is read: a fallen soul takes its body
      H.Instinct?.autoEnd(s);   // Survival Instincts: a lie ends when its side has no other standing unit; first, before any branch below can end the battle
      if (s.outcome) return;
      if (s.film) return;   // the duel resolves the film (endTurn); the outside battle waits
      if (s.copBust) {
        const winner = s.copBust.side === "player" ? "enemy" : "player";
        s.outcome = { winner, round: s.round, nonLethal: true, reason: `Busted: ${s.copBust.name} was subdued by the law.` };
        s.phase = "over";
        log(s, { kind: "outcome", text: `${s.copBust.name} is subdued. The fight is over.` });
        recordBattleMirrorOutcome(s);
        return;
      }
      const stoodDown = (a) => !!a.standDownUntil && a.standDownUntil >= s.round;
      if (modeRules && s.modeSetup) {
        const result = modeRules.outcome(s.modeSetup, { round: s.round, units: Object.values(s.actors), wild: s.wild, arena: s.arena, rules: s.rules });   // arena and rules: the scenario objective (modes/objectives.js)
        if (result && !s.outcome) { s.outcome = { ...result, round: s.round }; s.phase = "over"; log(s, { kind: "outcome", text: result.reason }); }
        recordBattleMirrorOutcome(s);
        return;
      }
      if (s.randomEventSchedule?.length) {
        const playerSide = Object.values(s.actors).filter(a => a.side === "player" && !a.defeated && !a.notArrived && !a.husk);
        const enemySide = Object.values(s.actors).filter(a => a.side === "enemy" && !a.defeated && !a.notArrived && !a.persuaded && !a.husk);   // Parley: standing down opens terms; only coming to terms takes them out. An empty husk does not hold the battle.
        const roaming = Object.values(s.actors).filter(a => a.eventActor && a.side !== "player" && a.side !== "enemy" && a.side !== "visitors" && a.side !== "hero" && !a.defeated && !a.notArrived);   // visitors and heroes never hold the battle open (civilian precedent); villains do
        const pendingHeroes = Object.values(s.actors).some(a => a.eventRole === "superhero" && a.notArrived && !a.defeated);
        const hostileDream = Object.values(s.actors).some(a => a.dream?.source === "randomEvent" && !a.defeated);
        if (!playerSide.length) {
          s.outcome = { winner: "enemy", round: s.round };
          s.phase = "over"; log(s, { kind: "outcome", text: "Defeat: the player faction falls while hostiles remain." });
          recordBattleMirrorOutcome(s); return;
        }
        // Mala, 2026-10-24: heroes come for the villain. With no villain left alive or inbound,
        // arrived heroes leave the battle (alive) instead of standing around.
        const villainy = Object.values(s.actors).some(a => a.side === "villain" && (!a.defeated || a.notArrived));
        if (!villainy) for (const hero of Object.values(s.actors).filter(a => a.eventRole === "superhero" && !a.notArrived && !a.defeated)) {
          hero.defeated = true; hero.escaped = true; hero.leaveReason = "the villain is beaten"; hero.tempo = 0; spiritGone(s, hero);
          log(s, { kind: "flee", actor: hero.id, tiles: [[hero.x, hero.y]], text: `${hero.name} leaves: no villain left to challenge.`, why: ["Heroes never hold the battle open — and with the villain beaten, they go home."] });
        }
        // Mala, 2026-10-11: the wild never holds a battle open, so an event's wild animals are not counted here.
        if (!enemySide.length && !roaming.length && !pendingHeroes && !hostileDream) {
          s.outcome = { winner: "player", round: s.round }; s.phase = "over";
          log(s, { kind: "outcome", text: "Victory: the opposing fighters and random-event threats are cleared." });
          recordBattleMirrorOutcome(s); return;
        }
        return;
      }
      if (s.vignette) {
        const boss = s.actors[`boss-${s.vignette.branch}`], allies = Object.values(s.actors).some(a => a.side === "player" && !a.defeated && !a.notArrived);
        if (!allies) { s.outcome = { winner: "enemy", round: s.round, reason: s.vignette.outcomeText.loss }; s.phase="over"; log(s,{kind:"outcome",text:s.vignette.outcomeText.loss}); recordBattleMirrorOutcome(s); return; }
        const objectiveObject = s.arena.objects.find(o => o.vignetteObjective);
        if (!boss || boss.defeated || objectiveObject?.hp <= 0) { s.outcome = { winner: "player", round: s.round, reason: s.vignette.outcomeText.win }; s.phase="over"; log(s,{kind:"outcome",text:s.vignette.outcomeText.win}); recordBattleMirrorOutcome(s); return; }
        if ((s.vignette.objectiveProgress || 0) >= s.vignette.objective.turns) { s.outcome = { winner: "enemy", round: s.round, reason: s.vignette.outcomeText.loss }; s.phase="over"; log(s,{kind:"outcome",text:s.vignette.outcomeText.loss}); recordBattleMirrorOutcome(s); return; }
        return;
      }
      if (H.courtOutcome?.(s)) { recordBattleMirrorOutcome(s); return; }   // Heart Court owns the ending while a contract or the goddess is up
      const sides = { player: 0, enemy: 0 };
      const surrendered = [];
      for (const a of Object.values(s.actors)) {
        if (a.side === "enemy" && a.persuaded && !a.defeated && !a.notArrived) surrendered.push(a);   // Parley (Mala, 2026-10-08): standing down opens "Come to terms"; only terms end it non-lethally
        if (holdsOpen(s, a)) sides[sideKey(a)] += 1;
      }
      { const playerSide = Object.values(s.actors).filter((a) => a.side === "player" && !a.defeated && !a.notArrived);   // Mind duel mirror: talked down on every side, the day is lost (never the lives)
        if (playerSide.length && playerSide.every(stoodDown) && !s.outcome) { s.outcome = { winner: "enemy", round: s.round, forcedTerms: true, nonLethal: true, reason: "Forced terms: retreat." }; s.phase = "over";
          log(s, { kind: "outcome", text: "Forced terms: every player unit has stood down. The enemy dictates the day: retreat with units kept. Talk can lose you the day and the ground. It can never flatline you." }); recordBattleMirrorOutcome(s); return; } }
      const subOn = (side) => Object.values(s.actors).some((a) => subduedUnit(a) && sideKey(a) === side);   // Nonlethal victory: is anyone on this side subdued (alive, out of the fight)?
      if (!sides.player && !sides.enemy && subOn("player") && !subOn("enemy")) sides.player = 1;   // the enemy side is gone (killed) and ours lives, subdued: that is a win, not a loss
      if (!sides.enemy || !sides.player) {
        const nonLethal = !!sides.player && !sides.enemy && surrendered.length > 0;
        const persuaded = nonLethal && surrendered.every(a => a.persuaded);   // Parley: came to terms with every enemy left standing
        const nobodyDied = !!sides.player && Object.values(s.actors).every(a => a.side !== "enemy" || !a.defeated || a.knockedOut || a.escaped || a.notArrived);   // Immortals are only knocked out
        const outSide = sides.player ? "enemy" : "player";   // the side that is out
        const subduedOut = Object.values(s.actors).filter((a) => subduedUnit(a) && a.side === outSide);
        const bothOut = !sides.player && !sides.enemy && subOn("player") && subOn("enemy");   // both sides have a subdued unit and nobody else acts: nobody wins; a side that was killed outright still loses   // every unit on both sides is down or subdued: nobody wins
        const subdueEnd = (subduedOut.length > 0 || bothOut) && !nonLethal;
        s.outcome = { winner: bothOut ? "none" : sides.player ? "player" : "enemy", round: s.round,
          ...(nonLethal ? { nonLethal: true, surrendered: surrendered.map(a => a.id), reason: persuaded ? "Enemy Persuaded." : "All opponents stand down." } : subdueEnd ? { nonLethal: true, subdued: Object.values(s.actors).filter(subduedUnit).map((a) => a.id), reason: "Subdued, not killed." } : nobodyDied && sides.player ? { nonLethal: true, reason: Object.values(s.actors).some((a) => a.side === "enemy" && !a.defeated && a.status?.sealedBeast) ? "Sealed, not killed." : "Knocked out, not killed." } : {}), ...(persuaded ? { persuaded: true } : {}) };
        s.phase = "over";
        const defeated = Object.values(s.actors).filter((a) => a.side === (sides.player ? "enemy" : "player") && !surrendered.includes(a));
        const names = defeated.map((a) => a.name);
        const standingOut = defeated.filter((a) => !a.defeated && !a.notArrived);
        const huskOnly = standingOut.length > 0 && standingOut.every((a) => a.husk) && !defeated.some((a) => a.defeated && !a.husk);
        const sealedOut = standingOut.filter((a) => a.status?.sealedBeast);   // Sealing: caught, not defeated (audit 1.3.450)
        const result = bothOut ? "Nobody is left to fight: every unit on both sides is subdued or down."
          : subdueEnd && sides.player ? (subduedOut.length === 1 ? `Non-lethal victory: ${subduedOut[0].name} is subdued.` : "Non-lethal victory: the opponents are subdued.")
          : subdueEnd ? "Defeat: your side is subdued, not killed."
          : sides.player
          ? huskOnly ? (standingOut.length === 1 ? `Victory: ${standingOut[0].name} is an empty husk.` : "Victory: the opponents are empty husks.")
            : persuaded ? "Non-lethal victory: Enemy Persuaded."
            : nonLethal ? surrendered.length === 1 ? `Non-lethal victory: ${surrendered[0].name} stands down.` : "Non-lethal victory: all remaining opponents stand down."
            : sealedOut.length && sealedOut.length === standingOut.length && defeated.every((a) => a.status?.sealedBeast || a.escaped) ? (sealedOut.length === 1 ? `Victory: ${sealedOut[0].name} is sealed in a vessel.` : "Victory: the last opponents are sealed in vessels.")
            : nobodyDied && defeated.some(a => a.knockedOut) ? (names.length === 1 ? `Non-lethal victory: ${names[0]} is knocked out.` : "Non-lethal victory: the opponents are knocked out, not killed.")
            : names.length === 1 ? `Victory: ${names[0]} is defeated.` : "Victory: all opponents are defeated."
          : huskOnly ? (standingOut.length === 1 ? `Defeat: ${standingOut[0].name} is an empty husk.` : "Defeat: the party is left as empty husks.")
            : names.length === 1 ? `Defeat: ${names[0]} falls.` : "Defeat: the whole party falls.";
        log(s, { kind: "outcome", text: result });
      }
      recordBattleMirrorOutcome(s);
    }

    return { tendPlants, leashAction, trueFormFieldAt, syncTrueFormFields, applyTrueFormReveal, runTrueFormTechnique, applyTrueFormEffects, eatMushroom, fullCourtPressOptions,
      riseOnDeath, broodReady, broodCandidate, callBrood, broodBeadDrop, broodHeld, closeDreamSummons, closeDreamTreeants, finishDreamUltimate, checkDreamCollapse, resolveDreamRound, registerDreamActor, resolveRandomDreamRift, resolveDreamAppearances, advance, communeAlly, awakenAlly, standFootprint, settleTsukumogami, applyGaiaBoons,
      rootFallenPlants, checkOutcome, holdsOpen, sideKey };
  })();
});
