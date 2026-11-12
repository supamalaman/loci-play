"use strict";
// Actions, the summons family: tameBeast, markVessel, callPack, resolveSummonUltimate, pet, wakeDream, focusDream, summon, callPact, dismissPact, orderSummonUltimate, monsterSummon, dreamSpace, bead, callBeast, callDream, nameDream, treeant, maxChannel, sealBeast.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsSummons = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { Auras, C, Communion, EmergentIdeas, EnemySummons, RITUAL, Sealing, Vows, actorAt, auraH, barrierAt, beadBeast, checkOutcome, conceptName,
      dist, dreamSame, dreamSpaceRules, footprint, hasTrait, inside, insightRules, liveSummon, log, saveWildWorld, spendTempo, summonProfile,
      summonQuestions, summonReadiness, summonRules, summonSnapshot, target, tileAt, wildRules, wildSnapshot } = H;
    const { Dream, PactLib, maxRoomFor, moduleArena, openResponseWindow, score, seededChance } = K;
    const family = {
      // Houses (engine/houses.js): buy a neutral one; invest in it (the larger stake owns it and is paid).
      tameBeast: (s, a, act) => H.tameBeast(s, a, act), markVessel: (s, a, act) => H.markVessel(s, a, act), callPack: (s, a) => H.callPack(s, a),   // the Animal Tamer (engine/tamer.js)
      // A paid order belongs to the summon's turn-start, never ordinary AI planning. This also
      // resumes an action turn whose scheduler lost the turn-start continuation.
      resolveSummonUltimate(s, a) {
        if (!summonRules || !a.summon?.order || a.summon.ultimateUsed || a.defeated) return "No pending summon ultimate.";
        H.continueTurnStart(s);
      },
      pet(s,a,act) { return H.Kaiba.pet(s,a,act,{ log, dist, seededChance, spendTempo, Inspiration: H.Inspiration }); },
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
        const pf = Math.ceil((terms.call.pf || 0) * (1 - rate)) + (a.passives?.summonPhiAdd || 0), seeds = Math.ceil((terms.call.seeds || 0) * (1 - rate));
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
        const holdDrain = Math.max(1, s.dreamSpace.drain || 1);
        const holdTurns = Math.ceil((a.ultimateCharge ?? 0) / holdDrain);
        const holdWord = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][holdTurns] || String(holdTurns);
        log(s, { kind: "dreamSpace", actor: a.id, text: `The space holds for ${holdWord} of your turns. You gain ×${mods.potencyMul} potency, +${mods.pfRegenAdd} ΦF regen, and +${mods.apPerTurnAdd} AP each turn; the ultimate bar is its clock.${knowledge.placeFamiliarity ? ` Place familiarity lowers its required charge and drain (${opened.field.drain}% per turn).` : ""}` });
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
        const r = Dr.nameIt(t, act.choice, s.round, { namer: a });
        s.actors[t.id] = r.actor;
        log(s, { kind: "dreamNamed", actor: a.id, target: t.id, correct: r.correct, text: r.event.text,
          why: [r.correct ? "Named: it fades at round end." : `Wrong: it holds on; you can try again in ${Dr.data.rules.nameIt.wrong.retryAfterRounds} rounds.`] });
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
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-summons.js)`);
    Object.assign(K.handlers, family);
  })();
});
