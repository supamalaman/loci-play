"use strict";
// Actions, the observe family: journalFinding, journalNote, investigate, observe, observePlace, observePlant, communeIngredient, commune, observeSummon, observeStructure, communeStructure, observeSelf, insight, lens.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsObserve = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { C, ClassRuntime, Climate, Communion, Conversion, EM, MindDuel, Parley, REVEAL, Tsukumogami, ab, abilitiesOf, actorAt, awakenAlly,
      bossRules, clone, communeAlly, communeDiscount, conceptName, currentId, dist, dreamSpaceRules, endTurn, hasSight, hasTrait, insightRules,
      isMonster, line, log, recordMirrorEvent, spendTempo, standFootprint, summonRules, target } = H;
    const { Cooking, Spirit, aiAction, deepLook, demonstratedTraits, moduleArena, observeTail, observedFx, report, score, scoutNoted, seededChance,
      talkCost, talkedTooFast } = K;
    const family = {
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
        if (!s.insight.decks[t.id]) return `${t.name} has no observable traits: there is nothing to Investigate.`;   // arrivals without a deck (a tourist in a random encounter): refuse cleanly instead of throwing in spawnKnowledge (A3b: previews run at render, so a throw kills the drawer)
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
          if (!s.insight.decks[t.id]) return `${t.name} has no observable traits: there is nothing to Observe.`;   // arrivals without a deck: refuse cleanly instead of throwing (A3b: previews run at render)
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
      observeSummon(s, a, act) {   // Observe teaches O2c (D7): study a summon's palace room: the first study each battle adds +1 hint to its calling question
        const def = summonRules?.data?.summons?.[act.summon];
        if (!def) return "No such summon.";
        if (!H.Observation.eligible(a)) return "This unit cannot study a palace room.";
        if (s.summonHints?.[a.id]?.[act.summon]) return "Already studied this battle: no new hint.";
        const price = s.rules.summonRoomStudyAp;   // the one writing of the price (action seams A3a); the card reads the same field
        if (a.tempo < price) return `Studying the room needs ${price} action points.`;   // fixed price for the fixed +1 (gremlin SEV-3): the effort selector must not change it; mirrors O2b nameDream
        const spend = spendTempo(s, a, price, `Study ${def.name}'s room`); if (spend) return spend;
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
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-observe.js)`);
    Object.assign(K.handlers, family);
    // Action seams A3a (2026-11-12): the action card. Each card declares one action type once: the drawer
    // where the menu shows it, and options(s, a, extra) returning one row per legal or nearly-legal choice,
    // { act, label, cost, off, why, help }. off/why come from a preview of the exact act, so the handler's
    // own refusal sentence is the why. The dialog pair (commune, communeStructure) pins the current
    // questionId in its act (R-20261112-01; the dialog would show the same pinned question), so its preview
    // agrees with the handler's pre-answer gates and no refusal sentence is copied. extra carries
    // what only the caller knows (the effort selector's invest, a focus kind); a card never reads UI state.
    // E.actionOptions (engine/queries.js) serves these per drawer. Nothing calls it yet: dark by intent.
    const judge = (s, act, extra, label, cost, help) => {
      const pv = (extra.preview || ((st, ac) => H.preview(st, ac)))(s, act);
      return { act, label, cost, off: !pv.ok, why: pv.ok ? "" : pv.error, help };
    };
    const woundTax = (s, a) => (H.Injury?.gradeOf(a, "head") || 0) === 1 ? (s.rules.injury?.headWoundedObserveAp ?? 10) : 0;
    const nearSort = (s, a, list) => list.sort((x, y) => dist(s, a.x, a.y, x.x, x.y) - dist(s, a.x, a.y, y.x, y.y)).slice(0, 6);
    const studySpend = (R, invest) => Math.max(R.observeStep, Math.min(R.observeMax, Math.floor(invest / R.observeStep) * R.observeStep));
    // Registration order is drawer order (the query serves cards in this order): it follows the menu —
    // place, plants, structures, rooms, then actors; rituals run commune, ingredient, wake, as their tab does.
    const cards = {
      observePlace: { type: "observePlace", drawer: "observe", options(s, a, extra = {}) {
        if (!Climate || !s.weatherState) return [];
        const invest = extra.invest ?? 20;
        const spend = Math.max(10, Math.min(50, Math.floor(invest / 10) * 10));
        return [judge(s, { type: "observePlace", actor: a.id, invest }, extra, `Observe the place · ${spend} AP`, spend,
          "Read the weather, forecast and microclimate here. Place familiarity makes a Dream Space easier to open and hold.")];
      } },
      observePlant: { type: "observePlant", drawer: "observe", options(s, a, extra = {}) {
        if (!Communion || !s.communion || !Communion.rules.released) return [];
        const R = Communion.rules, book = H.Observation.plantBook(s, a), spend = studySpend(R, extra.invest ?? R.observeStep);
        return nearSort(s, a, (s.arena.objects || []).filter((o) => o.kind === "plant" && o.hp > 0 && !o.dead && !book.closed?.[o.id] && Communion.profile(o.type) && dist(s, a.x, a.y, o.x, o.y) <= R.observeRange))
          .filter((o) => (book.familiarity[o.id] || 0) < Communion.profile(o.type).need).map((o) => {
            const pr = Communion.profile(o.type), fam = book.familiarity[o.id] || 0;
            const sees = dist(s, a.x, a.y, o.x, o.y) <= 1 || hasSight(s, a.x, a.y, o.x, o.y);
            return judge(s, { type: "observePlant", actor: a.id, object: o.id, invest: spend }, extra,
              `${pr.common} · plant · ${fam}/${pr.need} known · ${spend} AP${sees ? "" : " · unseen"}`, spend,
              `Know a plant well enough and it will answer you. As an ally: ${pr.name}, ${pr.hp} LF. If it dies fighting for you, Gaia will hold it against you.`);
          });
      } },
      observeStructure: { type: "observeStructure", drawer: "observe", options(s, a, extra = {}) {
        if (!Tsukumogami || !s.tsukumogami || !(a.traits || []).some((t) => (t.id || t) === "animist") || !Tsukumogami.rules.released) return [];
        const R = Tsukumogami.rules, book = H.Observation.structureBook(s, a), spend = studySpend(R, extra.invest ?? R.observeStep);
        return nearSort(s, a, (s.arena.objects || []).filter((o) => o.kind === "object" && o.hp > 0 && Tsukumogami.profile(o.type) && dist(s, a.x, a.y, o.x, o.y) <= R.observeRange))
          .filter((o) => (book.familiarity[o.id] || 0) < Tsukumogami.profile(o.type).need).map((o) => {
            const pr = Tsukumogami.profile(o.type), fam = book.familiarity[o.id] || 0;
            const sees = dist(s, a.x, a.y, o.x, o.y) <= 1 || hasSight(s, a.x, a.y, o.x, o.y);
            const matDef = insightRules?.data?.traits?.[Tsukumogami.materialTrait(pr.material)] || null;
            return judge(s, { type: "observeStructure", actor: a.id, object: o.id, invest: spend }, extra,
              `${pr.common} · structure · ${fam}/${pr.need} known · ${spend} AP${sees ? "" : " · unseen"}`, spend,
              `Know a structure well enough and it will answer you. As an ally: ${pr.name}, ${Math.max(1, o.hp * 2)} LF. It stands for 4 rounds, then settles back.${matDef ? ` Material: ${matDef.text}` : ""}`);
          });
      } },
      observeSummon: { type: "observeSummon", drawer: "observe", options(s, a, extra = {}) {
        if (!summonRules) return [];
        const price = s.rules.summonRoomStudyAp;
        // A3b order: enumerate in SM.available order (data order), as the menu does — the unlocked list's own order differs.
        return summonRules.available({ unlocked: s.unlockedSummons || [] }).filter((x) => x.unlocked && (!summonRules.callsPalace || summonRules.callsPalace(a))).map((x) => {
          const def = summonRules.data.summons[x.id], studied = !!s.summonHints?.[a.id]?.[x.id];
          return judge(s, { type: "observeSummon", actor: a.id, summon: x.id }, extra,
            `Study ${def.name}'s room · ${price} AP${studied ? " · studied" : ""}`, price,
            studied ? "Studied this battle: no new hint. Call it from Rituals ▸ Summon ally." : `Study ${def.name}'s palace room: one wrong choice on its calling question is struck this battle.`);
        });
      } },
      observe: { type: "observe", drawer: "observe", options(s, a, extra = {}) {
        const invest = extra.invest ?? 20;
        const base = Math.max(10, Math.min(50, Math.floor(invest / 10) * 10));
        const ie = hasTrait(a, "directorsVision") ? Math.max(5, base - 5) : base;
        const tax = woundTax(s, a);
        const free = (a.id === "player" && s.surveyFlag) || (a.codexObserve || 0) > 0;
        const charge = free ? 0 : ie + tax, shown = free ? ie : charge;
        return Object.values(s.actors).filter((t) => t.id !== a.id && !t.defeated).map((t) => {
          const sees = hasSight(s, a.x, a.y, t.x, t.y);
          return judge(s, { type: "observe", actor: a.id, target: t.id, invest }, extra,
            `${t.name}${t.side === a.side ? " · ally" : ""}${sees ? "" : " · unseen"}`, charge,
            sees ? `Study ${t.name}: ${shown} AP of effort, one insight point for each 10 AP.` : `${t.name} is out of your line of sight, so you cannot observe them.`);
        });
      } },
      investigate: { type: "investigate", drawer: "investigate", options(s, a, extra = {}) {
        const V = insightRules?.data?.rules?.investigate;
        if (!V) return [];
        const tax = woundTax(s, a), pts = Math.floor((a.tempo - tax) / insightRules.data.rules.observe.apPerPoint) + V.depthBonus;
        const note = `All ${a.tempo} AP and your turn ends; your reaction is spent until next round.`;
        const rows = [];
        if (Climate && s.weatherState) rows.push(judge(s, { type: "investigate", actor: a.id, place: true }, extra,
          `Investigate the place · all ${a.tempo} AP`, a.tempo,
          `Read the weather, forecast and microclimate with about ${pts} points (hardest cards first, plus any progress you carried from earlier looks). ${note}`));
        const studies = [];
        if (Communion && s.communion && Communion.rules.released) {
          const R = Communion.rules, book = H.Observation.plantBook(s, a);
          studies.push(...nearSort(s, a, (s.arena.objects || []).filter((o) => o.kind === "plant" && o.hp > 0 && !o.dead && !book.closed?.[o.id] && Communion.profile(o.type) && dist(s, a.x, a.y, o.x, o.y) <= R.observeRange))
            .filter((o) => (book.familiarity[o.id] || 0) < Communion.profile(o.type).need).map((o) => ({ o, pr: Communion.profile(o.type), fam: book.familiarity[o.id] || 0, kind: "plant" })));
        }
        if (Tsukumogami && s.tsukumogami && (a.traits || []).some((t) => (t.id || t) === "animist") && Tsukumogami.rules.released) {
          const R = Tsukumogami.rules, book = H.Observation.structureBook(s, a);
          studies.push(...nearSort(s, a, (s.arena.objects || []).filter((o) => o.kind === "object" && o.hp > 0 && Tsukumogami.profile(o.type) && dist(s, a.x, a.y, o.x, o.y) <= R.observeRange))
            .filter((o) => (book.familiarity[o.id] || 0) < Tsukumogami.profile(o.type).need).map((o) => ({ o, pr: Tsukumogami.profile(o.type), fam: book.familiarity[o.id] || 0, kind: "structure" })));
        }
        for (const { o, pr, fam, kind } of studies) {
          const sees = dist(s, a.x, a.y, o.x, o.y) <= 1 || hasSight(s, a.x, a.y, o.x, o.y);
          const label = `${pr.common} · ${kind} · ${fam}/${pr.need} known · all ${a.tempo} AP${sees ? "" : " · unseen"}`;
          const what = kind === "plant" ? `Learn about ${pts} familiarity with this plant (a hiker or a botanist learns more); it spends all your action points and ends your turn, even if less would do.`
            : `Learn about ${pts} familiarity with this structure; it spends all your action points and ends your turn, even if less would do.`;
          rows.push(judge(s, { type: "investigate", actor: a.id, object: o.id }, extra, label, a.tempo, `${what} ${note}`));
        }
        for (const t of Object.values(s.actors).filter((u) => u.id !== a.id && !u.defeated)) {
          const sees = hasSight(s, a.x, a.y, t.x, t.y);
          rows.push(judge(s, { type: "investigate", actor: a.id, target: t.id, focus: extra.focus ?? undefined }, extra,
            `${t.name}${t.side === a.side ? " · ally" : ""}${sees ? "" : " · unseen"}`, a.tempo,
            sees ? `Investigate ${t.name}: all ${a.tempo} AP, at least ${pts} points${tax ? ` (a wounded head costs ${tax} AP of the study)` : ""} (progress carried from earlier looks and some traits add more).` : `${t.name} is out of your line of sight, so you cannot investigate them.`));
        }
        return rows;
      } },
      journalFinding: { type: "journalFinding", drawer: "root", options(s, a, extra = {}) {
        return H.Observation.findingNoteOptions(s, a).map((o) => judge(s, { type: "journalFinding", actor: a.id, fact: o.id }, extra,
          `Record finding: ${o.name} · reaction`, null, "Preserve this fact and its source in your field notebook; no technique practice is granted."));
      } },
      journalNote: { type: "journalNote", drawer: "root", options(s, a, extra = {}) {
        return H.journalOptions(s, a).map((o) => judge(s, { type: "journalNote", actor: a.id, technique: o.technique }, extra,
          `Take notes: ${o.name} · reaction`, null, "Spend your reaction to note it in your journal: three notes finish a study (the Magistrate's Codex)."));
      } },
      observeSelf: { type: "observeSelf", drawer: "root", options(s, a, extra = {}) {
        if (!insightRules || !(s.self?.traits || []).some((t) => !t.known)) return [];
        const cost = insightRules.observeSelfCost(s.self);
        return [judge(s, { type: "observeSelf", actor: a.id }, extra, `Observe Self · ${cost} AP`, cost,
          `Study yourself to uncover traits you do not know you have. Costs ${cost} AP.`)];
      } },
      insight: { type: "insight", drawer: "insight", options(s, a, extra = {}) {
        if (!insightRules) return [];
        const out = [];
        for (const tid of Object.keys(s.insight?.decks || {})) {
          const t = s.actors[tid], deck = s.insight.decks[tid], know = s.insight?.knowledge?.[a.id]?.[tid];
          if (!t || t.defeated || !deck || !know) continue;
          const snapshot = { round: s.round, units: Object.values(s.actors), wild: s.wild, playerSeeds: s.seeds || 0,
            alliesOf: Object.fromEntries(Object.values(s.actors).map((u) => [u.id, Object.values(s.actors).filter((v) => v.side === u.side && v.id !== u.id && !v.defeated)])),
            fire: s.arena.map.some((row) => row.includes("f")) };
          for (const it of insightRules.actionsFor({ deck, know, subject: t, snapshot })) {
            const chance = it.id === "talk" ? null : it.chance;
            const closed = it.id === "talk" && Parley && t ? (Parley.cannotTalk(s, a, t) ? true : Parley.talkChance(s, a, t) === 0) : false;
            const helpText = it.id === "talk"
              ? "Sit them down for a battle of minds: simultaneous arguments over up to 4 rounds, margin damage, willpower on the line. Win and they stand down (Come to terms opens) plus concede by severity; lose and you stand down and pick your own poison. Read their traits first — a hidden immune rebounds."
              : it.id === "befriend" ? "Try to make a friend: a 40% chance they stop attacking you for three rounds. They may still attack your summons. Failure spends the AP without creating a truce."
              : it.id === "readTell" ? "Use an observed warning sign to prepare for their next announced or delayed attack. That response does not spend your reaction; dodging still costs its usual AP."
              : it.id === "ask" ? "Ask what they intend to do next. Reveals their likely next action from the current board; later changes can change their plan."
              : it.text;
            const price = talkCost(a, it.id, it.cost), fast = price !== it.cost;
            const blocked = a.tempo < price ? ` Needs ${price} AP; you have ${a.tempo}.` : closed ? " Conversation is unavailable with this target." : "";
            out.push(judge(s, { type: "insight", actor: a.id, target: tid, action: it.id }, extra,
              `${it.name}${it.id === "talk" ? " · mind duel" : chance != null ? ` · ${Math.round(chance * 100)}%` : ""} · ${price} AP`, price,
              `${helpText} Costs ${price} AP.${fast ? " Speed-Talker: half the action points, and it lands 85% as often." : ""}${chance != null ? ` Current success chance: ${Math.round(chance * 100)}%.` : ""}${blocked}`));
          }
        }
        return out;
      } },
      lens: { type: "lens", drawer: "lens", options(s, a, extra = {}) {
        const price = s.rules.actionCosts.utility, out = [];
        for (const c of [a.primary, a.secondary].filter(Boolean)) for (const [id, pr] of Object.entries(C.concepts[c].lens.profiles))
          out.push(judge(s, { type: "lens", actor: a.id, concept: c, profile: id }, extra, `${C.concepts[c].name}: ${pr.name}`, price, pr.trade));
        return out;
      } },
      commune: { type: "commune", drawer: "rituals", options(s, a, extra = {}) {
        if (!Communion || !s.communion || !Communion.rules.released) return [];
        const R = Communion.rules, book = H.Observation.plantBook(s, a);
        return nearSort(s, a, (s.arena.objects || []).filter((o) => o.kind === "plant" && o.hp > 0 && !o.dead && !book.closed?.[o.id] && Communion.profile(o.type) && dist(s, a.x, a.y, o.x, o.y) <= R.observeRange))
          .filter((o) => (book.familiarity[o.id] || 0) >= Communion.profile(o.type).need).map((o) => {
            const pr = Communion.profile(o.type), q = Communion.questionFor(o, s.seed);
            return judge(s, { type: "commune", actor: a.id, object: o.id, questionId: q?.id }, extra,
              `Commune with ${pr.common} ▸ ${R.communeAp} AP + ${Math.max(0, pr.phi - communeDiscount(a))} ΦF`, R.communeAp,
              `Answer its question and it fights beside you as ${pr.name} (${pr.hp} LF). It is not fodder: if it dies, its body stays and Gaia thinks less of you.`);
          });
      } },
      communeIngredient: { type: "communeIngredient", drawer: "rituals", options(s, a, extra = {}) {
        if (!Communion?.canCommuneIngredient || a.defeated || !Communion.canWakeIngredients(a)) return [];
        const IR = Communion.ingredients.rules, rows = [], seen = new Set();
        for (const item of a.inventory || []) if (Communion.totemOf(item) && !seen.has(item)) { seen.add(item); rows.push({ item, pickup: null, d: 0 }); }
        for (const pk of s.arena.pickups || []) { const d = dist(s, a.x, a.y, pk.x, pk.y); if (Communion.totemOf(pk.item) && d <= IR.pickupRange) rows.push({ item: pk.item, pickup: pk.id, d }); }
        return rows.map((r) => {
          const t = Communion.totemOf(r.item), cook = !!Cooking()?.isCook?.(a);
          return judge(s, { type: "communeIngredient", actor: a.id, item: r.item, pickup: r.pickup }, extra,
            `Wake the ${t.name}${r.pickup != null ? " (on the ground)" : ""} ▸ ${IR.communeAp} AP + ${IR.phi} ΦF`, IR.communeAp,
            `${t.text} It stays beside you for ${cook ? IR.cookTurns : IR.turns} of your turns${cook ? " (a cook's totem lasts longer)" : ""} and cannot attack or be attacked. One totem at a time.`);
        });
      } },
      communeStructure: { type: "communeStructure", drawer: "rituals", options(s, a, extra = {}) {
        if (!Tsukumogami || !s.tsukumogami || !(a.traits || []).some((t) => (t.id || t) === "animist") || !Tsukumogami.rules.released) return [];
        const R = Tsukumogami.rules, book = H.Observation.structureBook(s, a), disc = communeDiscount(a, "structure");
        return nearSort(s, a, (s.arena.objects || []).filter((o) => o.kind === "object" && o.hp > 0 && Tsukumogami.profile(o.type) && dist(s, a.x, a.y, o.x, o.y) <= R.observeRange))
          .filter((o) => (book.familiarity[o.id] || 0) >= Tsukumogami.profile(o.type).need).map((o) => {
            const pr = Tsukumogami.profile(o.type);
            return judge(s, { type: "communeStructure", actor: a.id, object: o.id, questionId: Tsukumogami.questionFor(o, s.seed)?.id }, extra,
              `Wake the ${pr.common} ▸ ${R.communeAp} AP + ${Math.max(0, pr.phi - disc)} ΦF`, R.communeAp,
              `Answer its question and it stands beside you as ${pr.name} (${Math.max(1, o.hp * 2)} LF) for 4 rounds.`);
          });
      } },
    };
    H.actionCards ||= {};
    for (const type of Object.keys(cards)) if (Object.prototype.hasOwnProperty.call(H.actionCards, type)) throw new Error(`action card ${type} is installed twice (actions-observe.js)`);
    Object.assign(H.actionCards, cards);
  })();
});
