"use strict";
// The authored AI: decisions, candidates and scoring.
// A part of the Concept Combat engine, split out of engine.js on 2026-10-11 (tools/split-engine.mjs). It is not a
// module in its own right: engine.js installs it with the host object H (everything the engine closure has in
// scope) and it hands back the functions it defines. Function bodies are exactly as they were in engine.js.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).ai = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const Sage = () => (typeof module === "object" && module.exports ? require("../castings/sage.js") : globalThis.ConceptCombatSage) || null;
    const Spirit = () => (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null;
    const Orders = () => (typeof module === "object" && module.exports ? require("../spirit/orders.js") : globalThis.ConceptCombatOrders) || null;
    const OG = () => (typeof module === "object" && module.exports ? (() => { try { return require("../orgonite/orgonite.js"); } catch { return null; } })() : globalThis.ConceptCombatOrgonite) || null;
    const { Auras, Affinity, Bonds, ClassRuntime, Climate, INTERDICT, Imitation, MED, MindDuel, Parley, REVEAL, RITUAL, Traps, Vows, VK, WX, Workflow, ab, accountItems,
      actorAt, apply, auraH, availableAbilities, beliefSummonCandidate, chanted, classH, decider, dist, edgeDistance, fullCourtPressOptions, hasTrait,
      insightRules, isMonster, knownEnemyTraps, log, manifest, moduleArena, monsterCtx, moveOptions, onEdge, paths, presidentCanRecognize, presidentRules,
      presidentUnits, preview, responseOptions, seededChance, summonQuestions, summonReadiness, dreamReadiness, summonQuestionHints, summonRules, target, targeting, tileAt, weatherTileValue } = H;

    // ── authored AI (deterministic greedy) ───────────────────────────────
    // C10 action-reveal feed (Muse sandbox batch 9). "All traits produce actions, so actions reveal traits": every AI
    // decision carries the trait that drove it (`shows`), apply() records it in s.revealFeed, and a trait shown twice
    // is DEMONSTRATED: Observe finds it more easily, and Imitate can copy it. Pure: the decider never writes to state.
    let aiLastWorkflow = null;
    // Emissary E1: bounded, opt-in diagnostics outside battle state. No extra game queries.
    let aiTrace = null, aiTraceDepth = 0;
    function traceAiEvent(kind, detail) {
      if (!aiTrace) return;
      if (aiTraceDepth > 1) { aiTrace.nestedEventsOmitted++; return; }
      aiTrace.counts[kind] = (aiTrace.counts[kind] || 0) + 1;
      if (kind === "candidate") aiTrace.currentTerms = [];
      if (kind === "scored") {
        detail = { ...detail, terms: aiTrace.currentTerms };
        aiTrace.topCandidates.push(structuredClone(detail));
        aiTrace.topCandidates.sort((a, b) => b.value - a.value);
        aiTrace.topCandidates.length = Math.min(aiTrace.topCandidates.length, 12);
      }
      if (kind === "override" || kind === "postprocess") {
        aiTrace.overrides.push(structuredClone(detail));
        if (aiTrace.overrides.length > 32) aiTrace.overrides.shift();
      }
      if (aiTrace.truncated) { aiTrace.dropped++; return; }
      const event = { kind, ...detail }, json = JSON.stringify(event, (_key, value) => typeof value === "number" && !Number.isFinite(value) ? { nonFinite: String(value) } : value);
      if (aiTrace.events.length >= aiTrace.limits.maxEvents || aiTrace.chars + json.length > aiTrace.limits.maxChars) {
        aiTrace.truncated = true; aiTrace.dropped++; return;
      }
      aiTrace.chars += json.length; aiTrace.events.push(JSON.parse(json));
    }
    function traceAiReturn(site, action) {
      if (aiTrace && aiTraceDepth === 1) aiTrace.selection = { site, action: structuredClone(action), mechanism: "executed-return-site" };
      if (aiTrace) traceAiEvent("selection", { site, action, mechanism: "executed-return-site" });
      return action;
    }
    function traceAiTerm(name, value) {
      if (aiTrace && aiTraceDepth === 1 && aiTrace.currentTerms.length < 64) aiTrace.currentTerms.push({ name, value });
      return value;
    }
    function withAiTrace(run, options = {}) {
      if (aiTrace) throw new Error("Nested inspector requests are unsupported");
      const limit = (v, d, max) => v == null ? d : Number.isInteger(v) && v >= 0 && v <= max ? v : (() => { throw new Error("Invalid trace limit"); })();
      const trace = { version: 1, visibility: "developer-private", events: [], topCandidates: [], overrides: [], currentTerms: [], counts: {}, chars: 0, dropped: 0, truncated: false, nestedEventsOmitted: 0,
        limits: { maxEvents: limit(options.maxEvents, 512, 10000), maxChars: limit(options.maxChars, 131072, 2097152) },
        coverage: { selectionSites: "aiDecide returns and final action wrappers", candidates: "main movement/action loop; generator filters partial", scoring: "raw aggregate, concentration, court, outer ordered factors; raw internals partial", responses: "executed return site; defense numeric internals uninstrumented", nestedPreviews: "omitted and counted" } };
      aiTrace = trace;
      try { const action = run(); trace.finalAction = structuredClone(action); delete trace.currentTerms; return { action, trace }; }
      finally { aiTrace = null; aiTraceDepth = 0; }
    }

    // Faithful (PALADIN.md): would this step break Stand fast? Moving, with an unbroken oath, to a tile farther from the nearest foe than at the last turn start (class-runtime.js oath turn-start check).
    function faithfulRetreat(s, a, to) {
      const o = a.status?.oath;
      if (!hasTrait(a, "faithful") || !o || o.broken || a.routed) return false;
      const foes = Object.values(s.actors).filter(u => u.side !== a.side && !u.defeated && !u.notArrived);
      if (!foes.length) return false;
      return Math.min(...foes.map(u => dist(s, to[0], to[1], u.x, u.y))) > (o.lastDist ?? Infinity);
    }

    // Faithful: a response that moves the unit (reposition, dodge throw) to a tile farther from the nearest foe would break Stand fast, so it is not offered to the AI.
    const faithfulResponses = (s, a, opts) => (hasTrait(a, "faithful") && a.status?.oath && !a.status.oath.broken ? opts.filter((o) => !(o.to && faithfulRetreat(s, a, o.to))) : opts);
    function shownTrait(s, a, act, workflow) {
      const ids = (a.traits || []).map(t => typeof t === "string" ? t : t?.id).filter(Boolean), has = (id) => ids.includes(id);
      if (act.type === "stall" && has("gambler") && a.lf / a.maxLF <= (summonRules?.data?.rules?.deathDoor?.gambler?.bankBelowLf ?? 0.35)) return { trait: "gambler", goal: "prepare" };
      if (act.type === "insight" && act.action === "report" && has("scout")) return { trait: "scout", goal: "support" };
      if ((act.type === "scramble" || act.type === "playDead") && has("survivalInstincts")) return { trait: "survivalInstincts", goal: "survive" };
      if(act.type==="observe"&&has("discernment"))return {trait:"discernment",goal:"understand"};
      if (act.type === "observe" && has("scout")) return { trait: "scout", goal: "understand" };
      if(["observePlant","commune"].includes(act.type)&&has("botanist"))return {trait:"botanist",goal:"summon"};
      if (act.type === "communeIngredient" && (has("kitchenAnimism") || has("animist"))) return { trait: has("kitchenAnimism") ? "kitchenAnimism" : "animist", goal: "support" };
      if(act.type==="observePlace"&&has("steward"))return {trait:"steward",goal:"understand"};
      if (act.type === "disarm" && has("tinkerer")) return { trait: "tinkerer", goal: "prepare" };
      if (act.type === "pet" && has("animalLover")) return { trait: "animalLover", goal: "support" };
      if (act.type === "meditate" && has("contemplative")) return { trait: "contemplative", goal: "prepare" };
      if (act.type === "placeTrap" && has("tinkerer")) return { trait: "tinkerer", goal: "prepare" };
      if (!workflow?.goal || !Workflow?.TRAITS) return null;
      let best = null, value = 0;
      for (const id of ids) { const v = (Workflow.TRAITS[id] || {})[workflow.goal] || 0; if (v > value) { value = v; best = id; } }
      return best ? { trait: best, goal: workflow.goal } : null;
    }
    // Regret probe (Muse-2 REGRET_SIMS, Mala 2026-10-17): behind rules.aiLedger.regretProbe.
    // At most twice per actor (8 a battle), when the returned technique and the best-scoring opposite
    // (damaging vs non-damaging) were a live contest (within 6), the pre-decision state is
    // snapshotted with both lines (a live contest is within 14: myopic setup-vs-damage gaps
    // run 10-13, and the replay judges, not the gap). tools/regret.mjs replays the road not taken offline and
    // scores the regret; weights come from the ledger, not from taste.
    const recordRegretPoint = (s, act) => {
      s.regretLog = s.regretLog || [];
      if (s.regretLog.length >= 8 || s.regretLog.filter((p) => p.actor === act.actor).length >= 2) return;
      const a = s.actors[act.actor];
      // Definition-based, not preview-based: a damage technique that happens to whiff from
      // here is not setup. Legality is already settled (act was picked, cands are legal).
      const damaging = (cand) => {
        if (cand.type !== "ability") return null;
        const def = ab(cand.ability);
        return def ? def.effect === "damage" : null;
      };
      const mine = damaging(act);
      if (mine == null) return;
      let alt = null;
      for (const cand of candidates(s, act.actor, false, false)) {
        if (cand.type !== "ability" || cand.ability === act.ability) continue;
        const d = damaging(cand);
        if (d == null || d === mine) continue;
        const sc = score(s, act.actor, cand);
        if (!alt || sc > alt.sc) alt = { sc, cand };
      }
      if (!alt || score(s, act.actor, act) - alt.sc > 14) return;
      const keep = s.regretLog; s.regretLog = [];
      const snap = structuredClone(s);
      s.regretLog = keep; snap.regretLog = [];
      keep.push({ round: s.round, actor: act.actor, winner: act, alt: alt.cand, state: snap });
    };
    function aiAction(s) {
      aiTraceDepth++;
      try {
      obsMemo = null;
      aiLastWorkflow = null;
      let act;
      try { act = aiDecide(s); }
      finally { for (const u of Object.values(s.actors)) if (u._entrFlip) { u.side = u._entrFlip; delete u._entrFlip; } }
      const a = act && s.actors[act.actor];
      if (s.rules.aiLedger?.regretProbe && act && act.type === "ability") recordRegretPoint(s, act);
      // Truthy read kept on purpose: uses are recorded per actor, and a side without the switch never reads the bonus (V1).
      if (s.rules.aiLedger?.curiosity && act && act.type === "ability" && act.ability) { const u = curiousUses(s, act.actor); u[act.ability] = (u[act.ability] || 0) + 1; }
      const shows = a && act.type !== "respond" && !a.routed ? shownTrait(s, a, act, aiLastWorkflow) : null;
      return shows ? { ...act, shows } : act;
      } finally { aiTraceDepth--; }
    }
    const demonstratedTraits = (s, id, min = REVEAL.demonstratedAt) => { const n = {}; for (const e of s.revealFeed || []) if (e.actor === id) n[e.trait] = (n[e.trait] || 0) + 1; return Object.keys(n).filter(t => n[t] >= min); };
    function recordShown(s, a, action) {
      const shows = action.shows; if (!shows?.trait || !hasTrait(a, shows.trait)) return;
      const before = (s.revealFeed || []).filter(e => e.actor === a.id && e.trait === shows.trait).length;
      (s.revealFeed ||= []).push({ actor: a.id, action: action.type === "ability" ? action.ability : action.type, goal: shows.goal, trait: shows.trait, round: s.round });
      if (before + 1 === REVEAL.demonstratedAt) {
        const t = insightRules?.data?.traits?.[shows.trait];
        log(s, { kind: "traitShown", actor: a.id, trait: shows.trait, tiles: [[a.x, a.y]], text: `${a.name}'s choices are starting to show a pattern.`,
          why: [`Something about ${a.name} has shown twice in how they act. Observe will find it more easily now${t && insightRules.imitable?.(shows.trait) ? ", and what is found can be imitated" : ""}.`] });
      }
    }
    // One-turn lookahead (Mala 2026-10-17): behind rules.aiLedger.lookahead. The myopic pass
    // keeps the top technique options; each is applied speculatively, answers settle as
    // no-response (the same basis myopic previews price on), and the best follow-up
    // technique/strike in the resulting state prices at half
    // value. Setup that enables a finisher now outscores damage-now; one-trick lines gain
    // nothing they didn't already have. Never recurses: score() knows nothing of this.
    // Answer model (Claude, 2026-10-17; rules.aiLedger.answerModel): previews settled every answer window as "no answer",
    // so the planner priced a shot into a ready wall like a clean hit, and could not see what beats answers (hiding the
    // delivery, shooting from cover, pressing a defender with no reaction or AP left). With the model on, the attacker
    // plays out the answer the defender would choose from what the attacker can know: answers it has seen this defender
    // use or has had revealed, plus Guard and a safe step for announced attacks (everyone has those). A defender whose
    // window opened with nothing known still holds back `prior` of the blow (it may have something). No luck is rolled.
    let seenMemo = null;
    const seenAnswers = (s, id) => {
      if (seenMemo?.log !== s.log || seenMemo.n !== s.log.length) { seenMemo = { log: s.log, n: s.log.length, by: {} }; for (const e of s.log) if (e.actor && e.ability && (e.kind === "answered" || e.kind === "respond" || e.kind === "act")) (seenMemo.by[e.actor] ||= new Set()).add(e.ability); }
      return seenMemo.by[id] || new Set();
    };
    const publicAnswer = (st, who, root) => {
      const d = st.actors[who], inst = st.pending?.inst; if (!d || !inst) return { type: "respond", actor: who, response: "none" };
      if (inst.submissionFinish) return { type: "respond", actor: who, response: responseOptions(st, d, inst).length ? "breakHold" : "none" };   // fight the finish whenever it can
      const opts = faithfulResponses(st, d, responseOptions(st, d, inst)), seen = seenAnswers(root, who);
      const known = opts.filter((o) => o.kind !== "technique" || seen.has(o.ability) || !!st.disclosures?.[who]?.[o.ability]);
      const react = reactChoice(st, d, known), asReact = react && { type: "respond", actor: who, response: "technique", ability: react.ability, target: react.target };
      if (st.pending.reactive) return asReact || { type: "respond", actor: who, response: "none" };
      { const DG = st.rules.reactiveDefense?.ai?.dodge; if (DG?.on && (!DG.sides || DG.sides.includes(d.side))) return defendChoice(st, d, known, react); }
      const step = known.find((o) => (o.kind === "dodgeThrow" || o.kind === "reposition") && o.safe);
      if (step) return { type: "respond", actor: who, response: step.kind, to: step.to };
      if (react && react.overGuard > 0) return asReact;
      return { type: "respond", actor: who, response: known.some((o) => o.kind === "guard") ? "guard" : "none" };
    };
    // Settle a preview's answer windows the way the model expects. Returns the settled state and, per defender whose window
    // opened with no known answer, the share of its loss to hold back (prior).
    const settleAnswers = (st, root, AM) => {
      const hidden = {}, answered = new Set();
      let guard = 0;
      while (st.phase === "response" && guard++ < 16) {
        const who = decider(st)?.actor;
        if (!who || !st.actors[who]) break;
        let act = { type: "respond", actor: who, response: "none" };
        if (AM) { act = publicAnswer(st, who, root);
          const d = st.actors[who];
          const techs = act.response === "none" && d.reaction > 0 ? responseOptions(st, d, st.pending.inst).filter((o) => o.kind === "technique") : [];
          if (techs.length && !techs.some((o) => seenAnswers(root, who).has(o.ability) || st.disclosures?.[who]?.[o.ability])) hidden[who] = st.pending.reactive ? (AM.prior ?? 0.15) : (AM.announcedPrior ?? 0.5); }   // known and declined: no prior. Announced (an ult, a Feint): defenders answer those most, so the old half-price guess stands
        let r = apply(st, act, { preview: true });
        if (r.ok && act.response === "technique") answered.add(who);
        if (!r.ok && act.response !== "none") r = apply(st, { type: "respond", actor: who, response: "none" }, { preview: true });
        if (!r.ok) break;
        st = r.state;
      }
      return { st, hidden, answered };
    };
    const ledgerOn = (s, a, key) => { const M = s.rules.aiLedger?.[key]; return M?.on && a && (!M.sides || M.sides.includes(a.side)) ? M : null; }, amFor = (s, a) => ledgerOn(s, a, "answerModel");   // sides: a sim arm can give the model to one side only
    // Sight arms (AI Sight H1): which system families a candidate belongs to,
    // and whether a unit's side plays it blind or keen. Fast path first: the
    // shipped table (blind [], keen {}) answers without matching, so live play
    // pays two length checks a candidate and nothing else.
    const sightTable = (s) => s.rules.aiLedger?.sight;
    const sightApplies = (s, a) => { const M = sightTable(s); return !!M && !!a && (!M.sides || M.sides.includes(a.side)); };
    const sightFamsOf = (s, cand) => { const F = sightTable(s)?.families || {}; const eff = cand.effect ?? (cand.ability ? ab(cand.ability)?.effect : undefined); return Object.keys(F).filter((f) => (F[f].types || []).includes(cand.type) || (eff && (F[f].effects || []).includes(eff)) || (F[f].prop && cand[F[f].prop])); };
    const sightBlind = (s, a, cand) => { const M = sightTable(s); if (!M || !(M.blind || []).length || !sightApplies(s, a)) return false; const fams = sightFamsOf(s, cand); return M.blind.some((f) => fams.includes(f)); };
    const sightKeen = (s, a, cand) => { const M = sightTable(s); if (!M || !sightApplies(s, a)) return 0; const entries = Object.entries(M.keen || {}); if (!entries.length) return 0; const fams = sightFamsOf(s, cand); let best = 0; for (const [f, v] of entries) if (fams.includes(f)) { const n = typeof v === "number" ? v : 6; if (n > best) best = n; } return best; };
    // A plain AI switch (lookahead, curiosity, foeMemory, wallLine): true is on for everyone, as shipped switches always were;
    // { on: true, sides: [...] } is on for those sides only, so a sim arm can ask whether it makes one side play better
    // (AI Sight V1, R-20261111-18). Shipped values are false.
    const switchOn = (s, a, key) => { const v = s.rules.aiLedger?.[key]; return v === true || (!!v?.on && !!a && (!v.sides || v.sides.includes(a.side))); };
    const applyOpen = (st, cand, on) => { if (!on) return apply(st, cand, { preview: true });
      const was = st.answerPreview; st.answerPreview = true;
      try { const r = apply(st, cand, { preview: true }); if (r.ok) delete r.state.answerPreview; return r; } finally { if (was) st.answerPreview = was; else delete st.answerPreview; } };
    const lookaheadValue = (st, a, cand) => {
      if (cand.type !== "ability") return 0;
      const AM = amFor(st, a);
      let s2 = applyOpen(st, cand, AM);
      if (!s2.ok) return 0;
      s2 = settleAnswers(s2.state, st, AM).st;
      // Terminal value: neutral units get no myopic kill premium (motiveTerm only prices the
      // deviation), so without this the lookahead prefers wound-now-finish-later over killing.
      // Ending the fight beats everything; a removal prices at the MOTIVE.kill scale.
      const liveFoes = (x) => Object.values(x.actors).filter((u) => !u.defeated && !H.Tourist?.is(u) && u.side !== a.side).length;
      const removed = liveFoes(st) - liveFoes(s2);
      const terminal = liveFoes(s2) === 0 && liveFoes(st) > 0 ? 25 : Math.max(0, removed) * 12;
      if (decider(s2)?.actor !== a.id || (s2.actors[a.id]?.tempo ?? 0) <= 0) return terminal;
      let fu = 0;
      for (const f of candidates(s2, a.id, false, false)) {
        if (f.type !== "ability" && f.type !== "strike") continue;
        fu = Math.max(fu, score(s2, a.id, f));
      }
      return terminal + Math.max(0, fu) * 0.5;
    };
    function aiDecide(s) {
      const dc = decider(s); if (!dc) return traceAiReturn("aiDecide:L204", (null));
      if (dc.kind === "mind" && MindDuel && s.mindDuel) {   // Mind duel: max-min over replies, concede to buy intel; sim-driven sides roll their poison too
        if (s.mindDuel.concede) return traceAiReturn("aiDecide:L206", ({ type: "mindConcede", actor: dc.actor, choice: MindDuel.pickConcede(s) }));
        return traceAiReturn("aiDecide:L207", ({ type: "mindPick", actor: dc.actor, move: MindDuel.aiPick(s, dc.actor) }));
      }
      const a = s.actors[dc.actor];
      if (dc.kind === "turn" && a.summon?.order && !a.summon.ultimateUsed && !a.defeated)
        return traceAiReturn("aiDecide:L211", ({ type: "resolveSummonUltimate", actor: a.id }));
      if (dc.kind === "turn" && a.status?.detained && (a.status.detained.until == null || a.status.detained.until >= a.ownerTurns)) return traceAiReturn("aiDecide:L212", ({ type: "end", actor: a.id }));   // Detained: beforeAbility, Strike and Move all refuse (previews skip those checks), but end/stall stay open — bank it and wait (end auto-stalls when tempo remains)
      if (dc.kind === "turn" && H.States?.blocksAll(s, a)) return traceAiReturn("aiDecide:states", ({ type: "end", actor: a.id }));   // States: shut out of everything but ending the turn
      // RIK R1, the exchange's promise (the RIK spec; R-20261105-04, R-20261105-05, R-20261110-31): after a reveal that "seizes the
      // exchange", the setter's next decides this turn commit to the cheap finisher, never the ultimate, ahead of every optional branch below
      // (cards, hires, the Sage), so nothing spends the tempo first. The promise lapses at the turn's end (the marker names the turn) or when no
      // finisher is left (the victim answered or fell): then the ordinary decide runs.
      if (dc.kind === "turn" && a.heldExchange?.turn === a.ownerTurns) {
        const f = exchangeFinisher(s, a, a.heldExchange.victim);
        if (f) return traceAiReturn("aiDecide:exchangeFinish", f);
      }
      if (dc.kind === "turn" && Parley && H.Cards && !a.persuaded) {   // C6b: Listening before the talk, on the same person they would talk to
        const preach = (ledgerOn(s, a, "traitActs")?.preach || []).some((t) => hasTrait(a, t));
        const talkTo = Parley.npcTalkTarget(s, a, dist, preach);
        const ear = talkTo && H.Cards.listeningPlay(s, a, talkTo);
        if (ear && apply(s, ear, { preview: true }).ok) return traceAiReturn("aiDecide:listening", ear);
      }
      if (dc.kind === "turn" && H.Cards) { const pick = H.Cards.aiPick(s, a); if (pick && apply(s, pick.act, { preview: true }).ok) { traceAiTerm("cardNecessity", pick.necessity); traceAiTerm("cardGoal", pick.goal); return traceAiReturn("aiDecide:cards", pick.act); } }   // Battle Cards (C5): one card, then the ordinary action on the next call; the one-card stamp stops a second
      if (dc.kind === "turn" && H.Instinct.lying(a)) {   // Survival Instincts: a lying unit stands once its rest is spent or it is no longer hurt; otherwise it keeps still
        const R = s.rules.survivalInstincts, st = a.status.playingDead;
        const rise = { type: "standUp", actor: a.id };
        return traceAiReturn("aiDecide:lying", (st.rested >= R.lie.restCap || !H.Instinct.wounded(s, a)) && apply(s, rise, { preview: true }).ok ? rise : { type: "end", actor: a.id });
      }
      if (H.Tourist?.is(a)) return traceAiReturn("aiDecide:L213", (H.Tourist.decide(s,a,H.touristH())));
      if (H.Kaiba?.is(a)) return traceAiReturn("aiDecide:L214", (H.Kaiba.decide(s, a, { moveOptions, apply, dist })));
      if (dc.kind === "turn" && H.Hires) { const h = H.Hires.aiAction(s, a); if (h && apply(s, h, { preview: true }).ok && !sightBlind(s, a, h)) return traceAiReturn("aiDecide:L215", (h)); if (a.hired?.kind === "mediator") return traceAiReturn("aiDecide:L215", ({ type: a.tempo > 0 ? "stall" : "end", actor: a.id })); }   // contracts in hand; a mediator never fights
      if (dc.kind !== "response" && H.Visitors?.is(a)) { const v = H.Visitors.advise(s, a, { moveOptions, apply, dist, RITUAL, chanted, log }); if (v) return traceAiReturn("aiDecide:L216", (v)); }   // visitors: mission first, war only if started (null falls through to ordinary AI)
      // The Sage declares turns 0–1 (preview-guarded; invalid falls through to ordinary AI).
      if (dc.kind === "turn" && !a.defeated && Sage()) { const sg = Sage().decide(s, a);
        if (sg && apply(s, sg, { preview: true }).ok && !sightBlind(s, a, sg)) return traceAiReturn("aiDecide:sage", (sg)); }
      if(dc.kind!=="response"&&a.status?.verse&&!a.status.verse.id)return traceAiReturn("aiDecide:L217", ({type:"chooseVerse",actor:a.id,ability:a.status.verse.choices.slice().sort((x,y)=>(ab(y).potency||0)-(ab(x).potency||0)||x.localeCompare(y))[0]}));
      if (dc.kind === "response") {
        const opts = faithfulResponses(s, a, responseOptions(s, a, s.pending.inst));
        if (aiTrace) traceAiEvent("response-options", { actor: a.id, options: opts });
        if (s.pending.inst.submissionFinish) return { type: "respond", actor: a.id, response: opts.some((o) => o.kind === "breakHold") ? "breakHold" : "none" };   // Submission: fight the finish whenever it can
        if(s.pending.inst.audienceOnly) return traceAiReturn("aiDecide:L220", (opts.some(o=>o.kind==="lookAway")?{type:"respond",actor:a.id,response:"lookAway"}:{type:"respond",actor:a.id,response:"none"}));
        if (s.pending.inst.ability === "arrest" && H.Dispatch?.wantsTrial(s, a) && opts.some((o) => o.kind === "kneel")) return traceAiReturn("aiDecide:arrestKneel", ({ type: "respond", actor: a.id, response: "kneel" }));   // cuffs coming and the docket open: kneel and claim trial
        if (switchOn(s, a, "foeMemory")) { const prefer = {}; for (const e of s.log) if (e.kind === "answered" && e.target === a.id && e.worked && e.ability) (prefer[e.attackAbility] ||= {})[e.ability] = 1.25; s.foeBrief = { for: a.id, prefer }; }   // foe-memory: earlier this battle, this answer worked against this technique
        const react = reactChoice(s, a, opts), asReact = react && { type: "respond", actor: a.id, response: "technique", ability: react.ability, target: react.target };
        if (s.pending.reactive) return traceAiReturn("aiDecide:L223", (asReact || { type: "respond", actor: a.id, response: "none" }));   // unannounced: a reactive technique or nothing
        { const DG = s.rules.reactiveDefense?.ai?.dodge; if (DG?.on && (!DG.sides || DG.sides.includes(a.side))) return traceAiReturn("aiDecide:L224", (defendChoice(s, a, opts, react))); }   // priced: a dodge has to be worth its action points
        const safe = opts.find((o) => o.kind === "reposition" && o.safe);
        const thrown = opts.find((o) => o.kind === "dodgeThrow" && o.safe);
        if (thrown) return traceAiReturn("aiDecide:L227", ({ type: "respond", actor: a.id, response: "dodgeThrow", to: thrown.to }));
        if (safe) return traceAiReturn("aiDecide:L228", ({ type: "respond", actor: a.id, response: "reposition", to: safe.to }));
        if (react && react.overGuard > 0) return traceAiReturn("aiDecide:L229", (asReact));
        return traceAiReturn("aiDecide:L230", ({ type: "respond", actor: a.id, response: opts.some((o) => o.kind === "guard") ? "guard" : "none" }));
      }
      // Learned forms (2026-10-17): take a held (or vowed) form when a big threat is near or the fight is going badly.
      if (a.learnedForms?.length && !a.form && H.bossRules?.aiFormChoice && !s.preview) {
        const foes = Object.values(s.actors).filter((u) => !u.defeated && !H.Instinct.lying(u) && !u.notArrived && u.side !== a.side && u.side !== "bystander" && dist(s, a.x, a.y, u.x, u.y) <= 10);
        const pick = H.bossRules.aiFormChoice(a, foes); if (pick) return traceAiReturn("aiDecide:L235", ({ type: "enterForm", actor: a.id, form: pick.form, vow: pick.vow }));
      }
      const entrancedNow = a.status?.entranced && (a.status.entranced.until == null || a.status.entranced.until >= a.ownerTurns);
      if (entrancedNow && !Object.values(s.actors).some((u) => u.side === a.side && !u.defeated && u.id !== a.id))
        return traceAiReturn("aiDecide:L239", ({ type: "end", actor: a.id }));   // entranced with no one to turn on: stands and stalls
      if (entrancedNow) { a._entrFlip = a.side; a.side = a.side === "player" ? "enemy" : "player"; }   // restored in aiAction; targeting sees the marker and skips its own flip
      else if (H.States?.anySide(a)) { a._entrFlip = a.side; a.side = H.States.anySideOf(a); }   // Cure: a loosed unit decides with allegiance off, restored the same way
      // A paid immediate draw must resolve before ordinary planning, even if its tactical score is zero.
      if(a.status?.verse?.id&&a.status.verse.freeAp){
        const legal=candidates(s,a.id).filter(c=>apply(s,c,{preview:true}).ok);
        legal.sort((x,y)=>score(s,a.id,y)-score(s,a.id,x));
        return traceAiReturn("aiDecide:L245", (legal[0]||{type:"discardVerse",actor:a.id}));
      }
      if(a.fullCourtPress && a.controller!=="player") {
        const enemies=Object.values(s.actors).filter(u=>!u.defeated && !H.Tourist?.is(u)&&u.side!==a.side && H.PostHuman.atWar(s, a, u) && H.Civilian.atWar(s, a, u) && (H.Visitors?.atWar(s, a, u) ?? true) && H.Factions.atWar(s, a, u));
        const tiles=fullCourtPressOptions(s,a.id);
        const score=at=>Math.min(...enemies.map(u=>Math.abs(u.x-at[0])+Math.abs(u.y-at[1])));
        tiles.sort((x,y)=>score(x.to)-score(y.to));
        if(tiles.length && score(tiles[0].to)<score([a.x,a.y]))return traceAiReturn("aiDecide:L252", ({type:"fullCourtPress",actor:a.id,unit:a.id,to:tiles[0].to}));
      }
      if (H.Dispatch?.shouldKneel(s, a)) { const kneelAct = { type: "kneel", actor: a.id }; if (apply(s, kneelAct, { preview: true }).ok) return traceAiReturn("aiDecide:dispatchKneel", kneelAct); }   // the sentenced, hurt and surrounded: kneel
      if (a.tempo <= 0) return traceAiReturn("aiDecide:L254", ({ type: "end", actor: a.id }));
      if(a.status?.drowning) {
        const recover={type:"recoverWater",actor:a.id};
        if(H.waterRecovery(s,a)?.allowed && apply(s,recover,{preview:true}).ok)return traceAiReturn("aiDecide:L257", (recover));
        const exits=moveOptions(s,a.id).filter(o=>!H.waterAt(s,...o.to)).sort((x,y)=>x.tempoCost-y.tempoCost);
        for(const exit of exits){const action={type:"move",actor:a.id,to:exit.to};if(apply(s,action,{preview:true}).ok)return traceAiReturn("aiDecide:L259", (action));}
      }
      // C18: a channeler plants their feet: guard if able, otherwise bank the turn. Never move, never strike.
      if (a.ritual) {
        if (!a.guardUsedThisTurn && a.meditateNoGuard !== a.ownerTurns && a.tempo >= s.rules.actionCosts.guard && !(Vows && Vows.refuses(s, a, "guard")) && !H.States?.refusesKind(s, a, "guard")) return traceAiReturn("aiDecide:L263", ({ type: "guard", actor: a.id }));
        return traceAiReturn("aiDecide:L264", ({ type: a.tempo > 0 ? "stall" : "end", actor: a.id }));
      }
      // Scout return (Muse's design docs/scout-trait.md): three observations in, not yet reported, crew alive: go home
      // and report. A held or routed scout never gets here, which is how you stop one.
      if (hasTrait(a, "scout") && !a.routed && !a.scoutReported && !a.scoutStoodDown && a.controller !== "player" && insightRules?.data?.actions?.report
        && (a.scoutObserves || 0) >= insightRules.data.actions.report.effect.requiresObserves) {
        const crew = Object.values(s.actors).filter(u => u.side === a.side && u.id !== a.id && !u.defeated && !u.notArrived && u.category !== "bystander");
        if (crew.length) {
          const near = at => Math.min(...crew.map(u => Math.abs(u.x - at[0]) + Math.abs(u.y - at[1])));
          const rep = { type: "insight", actor: a.id, action: "report" };
          if (near([a.x, a.y]) <= insightRules.data.actions.report.effect.radius && apply(s, rep, { preview: true }).ok && !sightBlind(s, a, rep)) return traceAiReturn("aiDecide:L274", (rep));
          const home = moveOptions(s, a.id).filter(o => near(o.to) < near([a.x, a.y])).sort((p, q) => near(p.to) - near(q.to) || p.tempoCost - q.tempoCost);
          for (const o of home.slice(0, 4)) if (apply(s, { type: "move", actor: a.id, to: o.to }, { preview: true }).ok) return traceAiReturn("aiDecide:L276", ({ type: "move", actor: a.id, to: o.to }));
        }
      }
      // The Paladin's traits (PALADIN.md section 8.2; the Scout block above is the pattern). Faithful: with no oath and a foe on the board, the first act is to Swear (alone: a unit that
      // targets itself names no ward). Compassionate: below half life, or beside an ally below half, lay hands while the pool lasts. A held or routed unit skips both, as Scout's does.
      if (!a.routed && a.controller !== "player" && (hasTrait(a, "faithful") || hasTrait(a, "compassionate")) && Object.values(s.actors).some(u => u.side !== a.side && !u.defeated && !u.notArrived)) {
        const tryAct = (act) => (apply(s, act, { preview: true }).ok ? act : null);
        if (hasTrait(a, "faithful") && !(a.status?.oath && !a.status.oath.broken)) { const sw = tryAct({ type: "ability", actor: a.id, ability: "swear", target: [a.x, a.y] }); if (sw) return traceAiReturn("aiDecide:faithful", sw); }
        if (hasTrait(a, "compassionate") && (a.status?.hands?.pool ?? 1) > 0) {
          const hurt = Object.values(s.actors).filter(u => u.side === a.side && !u.defeated && !u.notArrived && dist(s, a.x, a.y, u.x, u.y) <= 1 && u.lf < u.maxLF * 0.5).sort((p, q) => p.lf / p.maxLF - q.lf / q.maxLF)[0];
          if (hurt) { const lay = tryAct({ type: "ability", actor: a.id, ability: "layOnHands", target: [hurt.x, hurt.y] }); if (lay) return traceAiReturn("aiDecide:compassionate", lay); }
        }
      }
      // C8: a routed unit only runs. On the edge it leaves; otherwise it takes the move that gets it nearest an edge.
      // On a film set it cannot leave at all: the set is enclosed, so it cowers or ends (Mala, 2026-10-19).
      if (a.routed) {
        if (!s.film) {
          if (onEdge(s, a)) return traceAiReturn("aiDecide:L283", ({ type: "fleeBattle", actor: a.id }));
          const best = moveOptions(s, a.id).sort((p, q) => edgeDistance(s, p.to) - edgeDistance(s, q.to) || p.tempoCost - q.tempoCost)[0];
          if (best && edgeDistance(s, best.to) < edgeDistance(s, [a.x, a.y]) && apply(s, { type: "move", actor: a.id, to: best.to }, { preview: true }).ok) return traceAiReturn("aiDecide:L285", ({ type: "move", actor: a.id, to: best.to }));
        }
        // Cornered (Muse-2 interactions): nowhere nearer an edge — a foe adjacent means cower (guard) instead of ending bare.
        if (!a.guardUsedThisTurn && a.tempo >= s.rules.actionCosts.guard && Object.values(s.actors).some((u) => !u.defeated && u.side !== a.side && dist(s, a.x, a.y, u.x, u.y) <= 1)) return traceAiReturn("aiDecide:L288", ({ type: "cower", actor: a.id }));
        return traceAiReturn("aiDecide:L289", ({ type: "end", actor: a.id }));
      }
      if (isMonster(a) && a.drawback === "mindless") { const act = H.mindlessAct(s, a); if (act) return traceAiReturn("aiDecide:mindless", (act)); }   // the Zombie can't tell sides: its nearest unit may be its own
      // A monster in a panic (fire nearby) or a werewolf caught human only backs away: the tile furthest from what it fears.
      if (isMonster(a) && (a.mustRetreat || a.fleeing)) {
        const fear = a.mustRetreat ? monsterCtx(s).fires : Object.values(s.actors).filter(u => u.id !== a.id && !u.defeated && !H.Tourist?.is(u)).map(u => [u.x, u.y]);
        const far = at => fear.length ? Math.min(...fear.map(([x, y]) => Math.abs(x - at[0]) + Math.abs(y - at[1]))) : 0;
        const best = moveOptions(s, a.id).sort((p, q) => far(q.to) - far(p.to) || p.tempoCost - q.tempoCost)[0];
        if (best && far(best.to) > far([a.x, a.y]) && apply(s, { type: "move", actor: a.id, to: best.to }, { preview: true }).ok) return traceAiReturn("aiDecide:L296", ({ type: "move", actor: a.id, to: best.to }));
        return traceAiReturn("aiDecide:L297", ({ type: "end", actor: a.id }));
      }
      // C12 escape interdict (Muse sandbox batch 10). In an escape battle the enemy's job is the exit, not the chase:
      // far from its guard tiles it goes back to them; within 2 it holds and fights with the ordinary combat AI; and
      // it traps the exit it is camping. Moves are checked with a preview, so a promise that forbids one is skipped.
      if (s.modeSetup?.mode === "escape" && a.side === "enemy" && s.modeSetup.guard?.tiles?.length && !a.dream && !a.summon && a.controller !== "player") {
        const posts = s.modeSetup.guard.tiles, toPost = at => Math.min(...posts.map(([x, y]) => Math.abs(at[0] - x) + Math.abs(at[1] - y)));
        if (toPost([a.x, a.y]) > INTERDICT.holdWithin) {
          const open = posts.filter(([x, y]) => !actorAt(s, x, y)), goal = at => open.length ? Math.min(...open.map(([x, y]) => Math.abs(at[0] - x) + Math.abs(at[1] - y))) : toPost(at);
          const back = moveOptions(s, a.id).filter(o => goal(o.to) < goal([a.x, a.y])).sort((p, q) => goal(p.to) - goal(q.to) || p.tempoCost - q.tempoCost);
          for (const o of back.slice(0, 4)) if (apply(s, { type: "move", actor: a.id, to: o.to }, { preview: true }).ok) return traceAiReturn("aiDecide:L307", ({ type: "move", actor: a.id, to: o.to }));
        }
        const exits = s.modeSetup.exits || [];
        if (Traps && a.tempo >= Traps.rules.placeAp && exits.some(([x, y]) => dist(s, a.x, a.y, x, y) <= INTERDICT.trapWithin)
          && !(s.traps || []).some(t => !t.spent && t.ownerSide === a.side && exits.some(([x, y]) => Math.abs(t.x - x) + Math.abs(t.y - y) <= 1))) {
          const at = exits.find(([x, y]) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) <= 1 && !actorAt(s, x, y)) || [a.x, a.y];
          if (apply(s, { type: "placeTrap", actor: a.id, at }, { preview: true }).ok && !sightBlind(s, a, { type: "placeTrap" })) return traceAiReturn("aiDecide:L313", ({ type: "placeTrap", actor: a.id, at }));
        }
      }
      // Kaiba (docs/kaiba.md): everyone but an animal hater pats an adjacent cat before ordinary
      // planning — allies, civilians, even bosses, all opportunistic. Only enemy lovers go further
      // and cross the room for it, unless a foe is already nose-to-nose (mid-duel dignity holds).
      {
        const cat = Object.values(s.actors).find((u) => u.character === "kaiba" && !u.defeated && !u.escaped && !u.kaiba?.asleep);
        if (cat && a.id !== cat.id && !hasTrait(a, "animalHater") && !cat.kaiba?.shunned?.[a.id]) {
          if (dist(s, a.x, a.y, cat.x, cat.y) <= 1) {
            if (apply(s, { type: "pet", actor: a.id, target: cat.id }, { preview: true }).ok) return traceAiReturn("aiDecide:L323", ({ type: "pet", actor: a.id, target: cat.id }));
          } else if (hasTrait(a, "animalLover") && a.side === "enemy" && !a.boss && !Object.values(s.actors).some((u) => !u.defeated && u.id !== cat.id && u.id !== a.id && dist(s, a.x, a.y, u.x, u.y) <= 1 && H.PostHuman.atWar(s, a, u) && H.Civilian.atWar(s, a, u) && (H.Visitors?.atWar(s, a, u) ?? true) && H.Factions.atWar(s, a, u))) {
            const near = (at) => Math.abs(at[0] - cat.x) + Math.abs(at[1] - cat.y);
            const step = moveOptions(s, a.id).filter((o) => near(o.to) < near([a.x, a.y])).sort((p, q) => near(p.to) - near(q.to) || p.tempoCost - q.tempoCost);
            for (const o of step.slice(0, 4)) if (apply(s, { type: "move", actor: a.id, to: o.to }, { preview: true }).ok) return traceAiReturn("aiDecide:L327", ({ type: "move", actor: a.id, to: o.to }));
          }
        }
      }
      // C18: outnumbered with a bead in hand, release it (40%); a weakened wild monster within 4 is worth a ritual (60%).
      if (!a.dream && !a.summon && !a.communed && !a.beast && a.controller !== "player" && s.rules.ritualAi !== false) {
        if ((a.beads || []).length && a.tempo >= RITUAL.beadAp) {
          const live = Object.values(s.actors).filter(u => !u.defeated && !H.Tourist?.is(u) && !u.notArrived), foes = live.filter(u => u.side !== a.side).length, friends = live.filter(u => u.side === a.side).length;
          if (foes > friends && (sightKeen(s, a, { type: "bead" }) > 0 || seededChance(`${s.seed}:${a.id}:bead:${s.round}`) < RITUAL.aiRelease)) {
            const at = [[a.x + 1, a.y], [a.x - 1, a.y], [a.x, a.y + 1], [a.x, a.y - 1]].find(([x, y]) => apply(s, { type: "bead", actor: a.id, at: [x, y] }, { preview: true }).ok);
            if (at && !sightBlind(s, a, { type: "bead" })) return traceAiReturn("aiDecide:L337", ({ type: "bead", actor: a.id, at }));
          }
        }
        if (a.tempo >= RITUAL.ap) {
          const weak = (s.wild || []).find(m => m.form === "unit" && m.lf < m.maxLF * RITUAL.weakBelow && !chanted(s, m.id) && dist(s, a.x, a.y, m.x, m.y) <= RITUAL.range);
          const focusMul = Object.entries(ledgerOn(s, a, "traitActs")?.ritualStart || {}).reduce((m, [k, v]) => hasTrait(a, k) ? m * v : m, 1);   // trait acts: the focused chant more readily, the scattered less
          if (weak && (sightKeen(s, a, { type: "ritual" }) > 0 || seededChance(`${s.seed}:${a.id}:rit:${s.round}`) < RITUAL.aiStart * focusMul) && apply(s, { type: "ritual", actor: a.id, at: [weak.x, weak.y] }, { preview: true }).ok && !sightBlind(s, a, { type: "ritual" })) return traceAiReturn("aiDecide:L343", ({ type: "ritual", actor: a.id, at: [weak.x, weak.y] }));
        }
      }
      // C9/C14: set a trap where foes are coming (seeded, 40%); disarm a spotted one alongside (40%, Tinkerer 70%).
      if (Traps && Traps.rules.ai.encounters.includes(s.encounter) && !a.dream && !a.summon && !a.communed && a.controller !== "player") {
        const R = Traps.rules.ai;
        if (a.tempo >= Traps.rules.disarm.minAp) {
          const tp = knownEnemyTraps(s, a).find(t => Math.max(Math.abs(a.x - t.x), Math.abs(a.y - t.y)) <= 1);
          if (tp && (sightKeen(s, a, { type: "disarm" }) > 0 || seededChance(`${s.seed}:${a.id}:disarm:${s.round}:${a.actionsThisTurn}`) < (hasTrait(a, Traps.rules.disarm.trait) ? R.tinkererDisarmChance : R.disarmChance))
            && apply(s, { type: "disarm", actor: a.id, at: [tp.x, tp.y] }, { preview: true }).ok && !sightBlind(s, a, { type: "disarm" })) return traceAiReturn("aiDecide:L352", ({ type: "disarm", actor: a.id, at: [tp.x, tp.y] }));
        }
        if (Traps.canSet(a) && a.tempo >= Traps.rules.placeAp && !(s.traps || []).some(t => !t.spent && t.ownerSide === a.side && dist(s, t.x, t.y, a.x, a.y) <= R.spacing)) {
          const foes = Object.values(s.actors).filter(t => H.Instinct.standing(t) && !H.Tourist?.is(t) && t.side !== a.side && !t.notArrived), nearest = foes.length ? Math.min(...foes.map(t => dist(s, a.x, a.y, t.x, t.y))) : 99;
          // A trapper hides it: on or beside them, where no enemy can see the tile, nearest the foes' way in. One set in
          // plain sight is 30% hidden and every foe walks round it (the 2026-10-14 log: Samurai traps on his own tile).
          const unseen = ([x, y]) => !foes.some(u => H.hasSight(s, u.x, u.y, x, y));
          const spots = [[a.x, a.y], [a.x + 1, a.y], [a.x - 1, a.y], [a.x, a.y + 1], [a.x, a.y - 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < s.arena.w && y < s.arena.h).filter(unseen)
            .sort((p, q) => Math.min(...foes.map(u => dist(s, p[0], p[1], u.x, u.y))) - Math.min(...foes.map(u => dist(s, q[0], q[1], u.x, u.y))));
          const at = spots.find(at => apply(s, { type: "placeTrap", actor: a.id, at }, { preview: true }).ok);
          if (at && nearest >= R.foeMin && nearest <= R.foeMax && (sightKeen(s, a, { type: "placeTrap" }) > 0 || seededChance(`${s.seed}:${a.id}:trap:${s.round}:${a.ownerTurns || 0}`) < R.placeChance) && !sightBlind(s, a, { type: "placeTrap" })) return traceAiReturn("aiDecide:L362", ({ type: "placeTrap", actor: a.id, at }));
        }
      }
      // Gambler: badly hurt, with most of a turn in hand, they bank it instead of defending. For the hero that courts
      // death's door; for anyone it buys a double turn if they live. Not two turns running (the bank is capped).
      { const G = summonRules?.data?.rules?.deathDoor?.gambler;
        if (G && hasTrait(a, G.trait) && a.controller !== "player" && a.lf / a.maxLF <= G.bankBelowLf && !(a.bankedTempo > 0) && a.lastStallRound !== s.round - 1
          && a.tempo >= Math.min(60, a.tempoCapacity || 100) && a.actionsThisTurn === 0) return traceAiReturn("aiDecide:L369", ({ type: "stall", actor: a.id })); }
      if (Bonds) { const bl = Bonds.blessingAction(s, a, classH()); if (bl) return traceAiReturn("aiDecide:L370", (bl)); }   // Bonds: Arantxa renews the Blessing of Malnote first
      if (dc.kind === "turn" && ClassRuntime?.mise) { const mr = ClassRuntime.mise.aiRenew(s, a, classH()) || ClassRuntime.mise.aiPrepare(s, a, classH()); if (mr && apply(s, mr, { preview: true }).ok) return traceAiReturn("aiDecide:mise", (mr)); }   // Mise en Place: a holder keeps a fading station fresh, bounded (mise/mise.js aiRenew)
      if (dc.kind === "turn" && ClassRuntime?.homology) { const ha = ClassRuntime.homology.aiAct(s, a, classH()); if (ha && apply(s, ha, { preview: true }).ok) return traceAiReturn("aiDecide:homology", (ha)); }   // Homology: a fighter with the comparative trait compares what it has witnessed, then prepares an ally (graph/homology-rules.js aiAct)
      { const t = H.Tally?.aiAction(s, a) || H.Tally?.aiAnswer(s, a) || (a.actionsThisTurn > 0 && H.Tally?.aiSettle(s, a)); if (t) return traceAiReturn("aiDecide:L371", (t)); }   // the ledger boss chooses its offers and calls itself (engine/tally.js)
      if (Parley && !a.persuaded) {   // Parley: talkative NPCs still obey sealed membranes and action costs.
        const preach = (ledgerOn(s, a, "traitActs")?.preach || []).some((t) => hasTrait(a, t));   // trait acts: a believer speaks up for the faith even if not talkative
        const talkTo = Parley.npcTalkTarget(s, a, dist, preach), talk = talkTo && { type: "parley", actor: a.id, target: talkTo.id };
        if (talk && apply(s, talk, { preview: true }).ok) return traceAiReturn("aiDecide:L375", (talk));
      }
      if ((a.standDownUntil && a.standDownUntil >= s.round) || a.persuaded) {   // Parley: persuaded units are out of the fight
        if (!a.guardUsedThisTurn && a.meditateNoGuard !== a.ownerTurns && a.tempo >= s.rules.actionCosts.guard && !(Vows && Vows.refuses(s, a, "guard")) && !H.States?.refusesKind(s, a, "guard")) return traceAiReturn("aiDecide:L378", ({ type: "guard", actor: a.id }));
        return traceAiReturn("aiDecide:L379", ({ type: a.tempo > 0 ? "stall" : "end", actor: a.id }));
      }
      if(a.pendingOrder){const ord=a.pendingOrder,forced=ord.target||Object.values(s.actors).find(t=>!t.defeated && !H.Tourist?.is(t)&&t.side!==a.side);const at=Array.isArray(forced)?forced:forced?[forced.x,forced.y]:null;const available=availableAbilities(s,a.id).find(x=>x.id===ord.abilityId&&x.affordable);if(available&&at&&a.tempo>=available.m.tempoCost&&a.pf>=available.m.cost){const act={type:"ability",actor:a.id,ability:ord.abilityId,target:at,orderPotencyMul:ord.potencyMul};if(apply(s,act,{preview:true}).ok)return traceAiReturn("aiDecide:L381", (act));}return traceAiReturn("aiDecide:L381", ({type:"declineOrder",actor:a.id}));}
      if(a.character==="president"||a.character==="pharaoh"){   // ClassRuntime: the Pharaoh holds office by the same legitimacy rules
        const offers=availableAbilities(s,a.id),ready=id=>offers.find(x=>x.id===id&&x.affordable);
        if(!a.debt&&!a.exposedFalseClaim&&!presidentRules?.officeValid(presidentUnits(s).find(u=>u.id===a.id))&&ready("swornIn"))return traceAiReturn("aiDecide:L384", ({type:"ability",actor:a.id,ability:"swornIn",target:[a.x,a.y]}));
        const allies=Object.values(s.actors).filter(t=>!t.defeated && !H.Tourist?.is(t)&&t.id!==a.id&&t.side===a.side&&presidentCanRecognize(s,presidentUnits(s).find(u=>u.id===a.id),t));
        const dir=ready("executiveDirection");if(dir&&allies.length){const ally=allies.sort((x,y)=>x.lf-y.lf)[0],move=availableAbilities(s,ally.id).find(x=>x.affordable&&x.m.effect==="damage"&&x.m.tier!=="ultimate"),foe=Object.values(s.actors).filter(t=>!t.defeated && !H.Tourist?.is(t)&&t.side!==a.side).sort((x,y)=>x.lf-y.lf)[0];if(move&&foe)return traceAiReturn("aiDecide:L386", ({type:"ability",actor:a.id,ability:"executiveDirection",target:[ally.x,ally.y],orderAbility:move.id,orderTarget:[foe.x,foe.y]}));}
        // rules.commitments.ai.finishBelow: a promise is made to finish someone already hurt, never a plant or a summon.
        const promise=ready("publicPromise");if(promise&&!a.promise&&!a.debt){const foe=Object.values(s.actors).filter(t=>!t.defeated && !H.Tourist?.is(t)&&t.side!==a.side&&!t.communed&&!t.summon&&t.lf<=t.maxLF*(s.rules.commitments?.ai?.finishBelow??1)&&dist(s,a.x,a.y,t.x,t.y)<=promise.m.range).sort((x,y)=>x.lf-y.lf)[0];if(foe)return traceAiReturn("aiDecide:L388", ({type:"ability",actor:a.id,ability:"publicPromise",target:[foe.x,foe.y],surrender:"retreat"}));}
      }
      // The Long Hunt (rules.ranger.longHunt): his first-turn Read Sign is free, so he takes it before anything else,
      // on an opponent he cannot see if there is one, else the nearest.
      if (ClassRuntime?.openingRead?.(s, a)) {
        const marks = Object.values(s.actors).filter((t) => !t.defeated && !H.Tourist?.is(t) && t.side !== a.side && !t.notArrived)
          .sort((x, y) => (H.hasSight(s, a.x, a.y, x.x, x.y) ? 1 : 0) - (H.hasSight(s, a.x, a.y, y.x, y.y) ? 1 : 0) || dist(s, a.x, a.y, x.x, x.y) - dist(s, a.x, a.y, y.x, y.y));
        for (const t of marks) { const act = { type: "ability", actor: a.id, ability: "readSign", target: [t.x, t.y] }; if (apply(s, act, { preview: true }).ok) return traceAiReturn("aiDecide:L395", (act)); }
      }
      // Mystery S3, the held card (spec section 3): the reveal policy is a commitment, not a bid. A manual plan is revealed when it would fade
      // unfired at the next round start (salvage over silence) or when the reveal kills now (lethal-now), and never into nothing. The reveal is
      // free (prepaid at set) and does not end the turn, so the ordinary decide follows on the next call.
      // RIK R1, the exchange: the reveal itself is chosen with the held-card commitment below (S3 and R1).
      if (dc.kind === "turn" && s.rules.mystery?.ai && (H.mysteryOwnCount?.(s, a.id, "manual") || 0) > 0) {
        const tries = revealTries(s, a), ro = bestReveal(tries), salvage = (H.mysterySalvageCount?.(s, a.id) || 0) > 0;
        if (ro?.kill) return traceAiReturn("aiDecide:heldReveal", ({ ...ro.act, why: "for the kill" }));
        const ex = exchangeReveal(s, a, tries);
        if (ex) return traceAiReturn("aiDecide:exchange", ex);
        if (ro && salvage) return traceAiReturn("aiDecide:heldReveal", ({ ...ro.act, why: "before it fades" }));
      }
const stays = [null, ...moveOptions(s, a.id).map((o) => o.to)].filter((to) => !to || !faithfulRetreat(s, a, to));   // Faithful: while its oath holds, no step that ends farther from the nearest foe than it stood at its last turn start (the oath's retreat term)
      const LA = switchOn(s, a, "lookahead"), scored = [];
      let hitHere = 0;
      const amMove = ledgerOn(s, a, "walkCost") ? apWorth(s, a) * (s.rules.aiLedger.walkCost.weight ?? 0.5) : 0;   // walk cost: LF a step's action points are worth to this unit
      let best = null, bestStay = null, bestReal = null;   // bestReal: the best act that is not an escape (a real strike outranks both escapes)
      const liveFoes = Object.values(s.actors).filter(t => H.Instinct.standing(t) && !H.Tourist?.is(t) && t.side !== a.side);   // a lying foe is not counted as a threat
      const liveAllies = Object.values(s.actors).filter(t => !t.defeated && !H.Tourist?.is(t) && t.id !== a.id && t.side === a.side);
      const painEff = a.pain ? a.pain.v * Math.pow(0.5, Math.max(0, s.round - a.pain.round)) : 0;
      const lowAllyUnit = liveAllies.find(t => t.lf < t.maxLF * 0.45);
      const nearestFoe = liveFoes.length ? liveFoes.reduce((m, t) => dist(s, a.x, a.y, t.x, t.y) < dist(s, a.x, a.y, m.x, m.y) ? t : m) : null;
      const moverTraits = new Set((a.traits || []).map(t => typeof t === "string" ? t : t?.id));
      // C13 weather-aware AI (Muse sandbox batch 11). The AI reads the same microclimate the rules use: it will not
      // hold a sunbaked tile in heat, likes shelter in wind and shade under sun, and counts the weather's real
      // multiplier on a technique when choosing between them. Off with rules.weatherAi = false (for paired sims).
      const wxState = s.rules.weatherAi !== false && Climate && s.weatherState ? Climate.sky(s) : null;
      const wxMicro = wxState ? Climate.microclimate(moduleArena(s.arena), wxState) : null;
      const weatherAt = (to) => weatherTileValue(wxState, wxMicro?.at(to[0], to[1]));
      const weatherBonus = (st, cand, def) => {
        if (!wxMicro || cand.type !== "ability" || !def || !Array.isArray(cand.target)) return traceAiTerm("weather", 0);
        const me = st.actors[a.id], mod = Climate.modifier({ delivery: def.delivery, effect: def.effect, concepts: def.concepts, concept: def.concept, damageType: def.damageType }, { from: [me.x, me.y], to: cand.target, state: wxState, micro: wxMicro });
        return traceAiTerm("weather", (mod.mul - 1) * WX.perMultiplier + (mod.rangeAdd || 0) * WX.perRange);
      };
      // Every term is a change from where the unit stands. Weather was counted only for the tile moved to, so under sun or
      // wind any shaded or sheltered neighbour beat staying, and from there the first tile did too: units paced between two
      // tiles all turn (Mala's Survive log, 2026-10-14; tools/check-ai-pacing.mjs counts it).
      const weatherHere = weatherAt([a.x, a.y]);
      const moveValue = (to) => {
        let v = weatherAt(to) - weatherHere;
        if (ClassRuntime?.mise) v += ClassRuntime.mise.stayValue(s, a, to, classH());   // Mise en Place: do not walk off a station that is still worth something
        const fear = motivesOf(s, a).selfHealth ?? 1;   // trait motives: fear backs a hurt unit off; courage holds through pain
        if (painEff * fear > 0.4 && nearestFoe) v += (dist(s, to[0], to[1], nearestFoe.x, nearestFoe.y) - dist(s, a.x, a.y, nearestFoe.x, nearestFoe.y)) * 3 * painEff * fear;
        if (fear > 1 && nearestFoe && a.lf < a.maxLF * 0.5) v += (dist(s, to[0], to[1], nearestFoe.x, nearestFoe.y) - dist(s, a.x, a.y, nearestFoe.x, nearestFoe.y)) * 2 * (fear - 1);
        if ((moverTraits.has("empathic") || moverTraits.has("collaborative")) && lowAllyUnit) v += (dist(s, a.x, a.y, lowAllyUnit.x, lowAllyUnit.y) - dist(s, to[0], to[1], lowAllyUnit.x, lowAllyUnit.y)) * 2;
        if (moverTraits.has("protective") && liveAllies.length) { const ward = liveAllies.slice().sort((x, y) => dist(s, a.x, a.y, x.x, x.y) - dist(s, a.x, a.y, y.x, y.y))[0]; v += (dist(s, a.x, a.y, ward.x, ward.y) - dist(s, to[0], to[1], ward.x, ward.y)) * 1.5; }   // protective: drift toward the nearest ally (the tofu sisters follow their yokai)
        const HX = H.Communion?.rules?.horticulture;   // tend-keeping: gardeners drift with their plants, not away from them
        if (HX && hasTrait(a, HX.trait)) {
          const herd = liveAllies.filter((t) => t.communed && t.communed.owner === a.id && !t.defeated);
          if (herd.length) {
            const near = (x, y) => herd.some((t) => Math.abs(t.x - x) + Math.abs(t.y - y) <= HX.tendRange);
            if (near(to[0], to[1]) && !near(a.x, a.y)) v += 3;
            else if (!near(to[0], to[1]) && near(a.x, a.y)) v -= 3;
          }
        }
        // The Animal Tamer unmarked (engine/tamer.js): every move is a run for a spare life, toward a beast to tame or his
        // own tamed beast to mark (Muse's TAMER_DESIRES.md: "his flight has a shape").
        if (H.isTamer?.(s, a) && !H.vesselOf(s, a)) {
          const TR = s.rules.tamer, mine = Object.values(s.actors).filter((u) => u.beast?.owner === a.id && u.beast.tamed && !u.defeated);
          const goals = mine.length ? mine : (s.wild || []).filter((m) => m.form === "unit" && m.lf > 0 && !TR.never.includes(m.kind));
          if (goals.length) { const d = (x, y) => Math.min(...goals.map((g) => Math.max(Math.abs(g.x - x), Math.abs(g.y - y))));
            v += (d(a.x, a.y) - d(to[0], to[1])) * 1.5; }
        }
        // Houses (engine/houses.js): the center pulls. Closing on a house worth having (a neutral one, the other side's,
        // or your own with nobody of yours beside it), arriving beside it, and not walking off one your side holds.
        { const ho = H.house(s), HR = s.rules.houses?.ai;
          if (ho && HR && !a.summon && !a.communed && !a.beast && ["player", "enemy"].includes(a.side)) {
            const d = (x, y) => Math.max(Math.abs(x - ho.x), Math.abs(y - ho.y)), mine = ho.house.side === a.side;
            const manned = mine && liveAllies.some((t) => t.id !== a.id && d(t.x, t.y) === 1);
            if (!manned && d(a.x, a.y) <= HR.notice) v += (d(a.x, a.y) - d(to[0], to[1])) * HR.pull;   // a bonus: only the nearby notice it
            v += H.houseSite(s, a, to);
            if (mine && d(a.x, a.y) === 1 && d(to[0], to[1]) !== 1) v -= HR.site * 0.5;
          } }
        v += Spirit()?.spacingValue(s, a, to, H) || 0;   // group spirit: no two allies adjacent at turn end
        return v;   // C27: known-trap routing is filtered before scoring (stays loop), not priced here
      };
      const scheduled = (s.randomEventSchedule || []).filter(e => !e.resolved && e.round >= s.round).sort((x,y) => x.round-y.round)[0];
      const lowAlly = liveAllies.some(t => t.lf < t.maxLF * 0.45);
      const context = { enemies: liveFoes.length, allies: liveAllies.length, lowAlly,
        lowSelf: a.lf < a.maxLF * 0.4, escapesLeft: H.Instinct.holder(a) ? H.Instinct.escapesLeft(s, a) : null, mode: s.modeSetup?.mode || "classic",
        eventIn: scheduled ? scheduled.round - s.round : null,
        nearestFoeDist: liveFoes.length ? Math.min(...liveFoes.map(t => dist(s, a.x, a.y, t.x, t.y))) : 99,
        ultFrac: (a.ultimateCharge ?? 0) / (s.rules.ultimateChargeMax || 100),
        tempoFrac: (a.tempo ?? 0) / 100, pfFrac: (a.pf ?? 0) / (a.maxPF || 30),
        painEff: a.pain ? a.pain.v * Math.pow(0.5, Math.max(0, s.round - a.pain.round)) : 0 };
      const workflow = Workflow?.choose(a, context); aiLastWorkflow = workflow;
      // rules.standoff: nobody has attacked anybody for a few rounds.
      const SO = s.rules.standoff, standoff = !!SO && SO.modes.includes(s.mode || "classic") && s.round - (s.lastClashRound ?? 1) >= SO.rounds && a.lf > a.maxLF * SO.spareBelowLf && !a.summon && !a.communed && !a.dream;
      // A Dutiful unit keeps to his wall (Exposure); a data center's builder and his AGI keep to the building the same way,
      // but only once that AGI is out. Before then nothing aims at the building, and holding him to it from the first
      // turn cost his side 5 trio fights in 32 (sims/pieces/datacenter.mjs).
      const kept0 = guardOf(s, a), kept = kept0 && (ClassRuntime?.centers?.(s) || []).find((c) => c.o.id === kept0.id)?.agi ? kept0 : null, keepR = s.rules.dataCenter?.guard?.radius;
      const hold = H.Exposure.holds(s, a) || (kept && dist(s, a.x, a.y, kept.x, kept.y) <= keepR ? (to) => dist(s, to[0], to[1], kept.x, kept.y) <= keepR : null); let held = null;
      const stepped = steppedThisTurn(s, a), lessons = lessonsOf(s, a);
      for (const to of stays) {
        if (to && routeCrossesKnownTrap(s, a, to)) { if (aiTrace) traceAiEvent("pruned", { stage: "route", to, reason: "known-trap" }); continue; }   // C27: the scorer never routes through a known trap; the fallback crosses only with no safe path
        if (to && stepped.has(`${to[0]},${to[1]}`)) { if (aiTrace) traceAiEvent("pruned", { stage: "route", to, reason: "already-stepped-this-turn" }); continue; }   // no stepping back onto this turn's own path with nothing done since
        let st = s;
        if (to) { const r = apply(s, { type: "move", actor: a.id, to }, { preview: true }); if (!r.ok) { if (aiTrace) traceAiEvent("rejected", { stage: "move-preview", to, error: r.error }); continue; } st = r.state;
          if (!st.actors[a.id] || st.actors[a.id].defeated) { if (aiTrace) traceAiEvent("pruned", { stage: "route", to, reason: "mover-defeated" }); continue; } }   // a move that kills you is not a move to plan from (suicide previews advanced the round and crashed platform targeting)
        // Hazard-aware routing (muse, 2026-10-18, seed 3962880737): the move preview already walks the
        // route, entry hazards included — price what it costs the mover's own body, so rubble is walked
        // around, not through. Follows the C27 trap precedent: known costs shape routing, never rules.
        const moveHarm = to ? Math.max(0, (s.actors[a.id]?.lf ?? 0) - (st.actors[a.id]?.lf ?? 0)) : 0;
        // Tsukumogami (docs/tsukumogami.md §6): the awakened prefers trampling paths. The move preview already
        // walks the route, trample included — price what it gains: trampled non-plant objects are cleared path
        // (+half their lost HP), trampled plants are future allies destroyed (−full), and a size-3 footfall
        // staggers whoever it ends beside (+5 a foe, −5 an ally — provisional, flagged for Mala's overrule).
        let trampleGain = 0;
        if (to && a.awakened && !a.defeated) {
          const before = new Map((s.arena.objects || []).map((o) => [o.id, o.hp]));
          for (const o of st.arena.objects || []) {
            const lost = (before.get(o.id) ?? o.hp) - o.hp;
            if (lost > 0) trampleGain += o.kind === "plant" ? -lost : lost * 0.5;
          }
          if (a.awakened.size >= 3) for (const u of Object.values(st.actors)) {
            if (u.id !== a.id && !u.defeated && u.status?.stagger && !s.actors[u.id]?.status?.stagger)
              trampleGain += u.side === a.side ? -5 : 5;
          }
        }
        for (const cand of candidates(st, a.id, true, !to)) {
          if (to && cand.type === "setIntent") continue;   // Mystery S1: a set works from anywhere, so it must not justify a step — paired scoring would pace (ai-pacing seed 7). Stays score it; observation pairs out the same way (!to above).
          if (aiTrace) traceAiEvent("candidate", { to, action: cand });
          const predicted = apply(st, cand, { preview: true }); if (!predicted.ok) { if (aiTrace) traceAiEvent("rejected", { stage: "action-preview", to, action: cand, error: predicted.error }); continue; }
          const harm = standoff && (cand.type === "strike" || cand.type === "grapple" || Object.values(predicted.state.actors).some((t) => t.side !== a.side && st.actors[t.id] && t.lf < st.actors[t.id].lf));
      const def = cand.type === "ability" ? ab(cand.ability) : null;
          const reliability = s.aiMinds?.[a.id]?.reliability?.[cand.ability || cand.type] ?? 1;
          // rules.hype: a believer in a Cultural Moment values everything but a look at the truth a little less.
          const caution = a.status?.hypeCaution?.until >= a.ownerTurns && cand.type !== "observe" ? s.rules.hype?.momentCautionMul ?? 1 : 1;
          const tactical = traceAiTerm("baseScore", score(st, a.id, cand)) * traceAiTerm("cautionMultiplier", caution) * traceAiTerm("guardMultiplier", guardMul(st, st.actors[a.id], cand)) * traceAiTerm("lessonMultiplier", lessonMul(st, a, cand, lessons));   // a defender of a data center goes for whoever is at it; lessons: what failed this battle, and why
          // Useful preparations also advance the ultimate. Value the actual previewed gain,
          // so full bars and already-active zero-value defenses cannot farm this reward.
          const chargeGain = Math.max(0,(predicted.state.actors[a.id]?.ultimateCharge||0)-(st.actors[a.id]?.ultimateCharge||0));
          const protection = def ? threatValue(st, st.actors[a.id], cand, def) : 0;
          const buildValue = (tactical>0 || protection>0) ? Math.min(6,chargeGain*0.3)*(1-context.ultFrac) : 0;
          // A unit's temperament tilts it between things worth doing; it never makes a worthless action worth doing. (It
          // used to: a proud President cast Public Promise three times a turn on an action that scored below zero.)
          const landCost = H.landCost(st, st.actors[a.id], cand) * (H.bossRules?.data?.land?.aiWoundCost || 0);   // plant-based people spare the land they don't know yet (engine/land.js)
          const mv = motivesOf(st, a), care = (cand.type === "guard" || cand.type === "recover") ? (mv.selfHealth ?? 1) : ["observe", "observePlace", "observePlant", "insight"].includes(cand.type) ? (mv.knowledge ?? 1) : 1;
          const hits = cand.type === "strike" || cand.type === "grapple" || ["damage", "prototype", "recombine"].includes(def?.effect);   // Innovation's copies and fusions are attacks too (as window.js judges them)
          const walk = to && amMove && hits && hitHere > 0 ? Math.max(0, a.tempo - (st.actors[a.id]?.tempo ?? a.tempo)) * amMove : 0;   // walk cost (rules.aiLedger.walkCost): walking to a better attack, when one is open from here, pays for the walk. Closing in from out of range, and walking to talk, film, raise an aura or set up, are priced as before
          const sc = -traceAiTerm("walkCost", walk) + traceAiTerm("careAdjustment", tactical * care - tactical) + traceAiTerm("chargeBuild", buildValue * (mv.ultCharge ?? 1)) + traceAiTerm("reliableTactical", tactical * reliability) - traceAiTerm("landCost", landCost) - traceAiTerm("moveHarm", moveHarm * (mv.selfHealth ?? 1)) + traceAiTerm("petMatch", petMatchBonus(st, st.actors[a.id], cand)) + traceAiTerm("workflow", workflow && tactical > 0 ? Workflow.bias(workflow, a, cand, def, context) : 0) - traceAiTerm("moveTiePenalty", to ? 0.01 : 0) + traceAiTerm("position", to ? moveValue(to) : 0) + traceAiTerm("trampleGain", trampleGain) + weatherBonus(st, cand, def);
          if (aiTrace) traceAiEvent("scored", { to, action: cand, value: sc, tactical, reliability, care, chargeGain, buildValue, moveHarm });
          if (!to && hits && sc > hitHere) hitHere = sc;   // the stays come first: the best attack open without a step
          if (!best || sc > best.sc) best = { sc, to, cand, harm };
          if (cand.type !== "scramble" && cand.type !== "playDead" && (!bestReal || sc > bestReal.sc)) bestReal = { sc, to, cand, harm };
          if (!to && (!bestStay || sc > bestStay.sc)) bestStay = { sc, to, cand, harm };
          if (LA && cand.type === "ability") scored.push({ sc, to, cand, st, harm });
          if (hold && (!to || hold(to)) && (!held || sc > held.sc)) held = { sc, to, cand, harm };
        }
      }
      if (best && (best.cand.type === "scramble" || best.cand.type === "playDead") && bestReal && bestReal.sc >= 8) best = bestReal;   // Survival Instincts: nothing strong on offer, or it escapes
      if (hold && held && held.sc > 0) { if (aiTrace) traceAiEvent("override", { reason: "held-commitment", action: held.cand, to: held.to, value: held.sc }); best = held; }   // Exposure: a Dutiful unit keeps to his wall while there is something worth doing there
      if (LA && scored.length && !(hold && held && held.sc > 0)) {   // a kept hold is a vow, not a score: lookahead never breaks it
        for (const o of scored.filter((x) => x.sc > 0).sort((x, y) => y.sc - x.sc).filter((x, i, all) => all.findIndex((y) => (y.cand.ability || y.cand.type) === (x.cand.ability || x.cand.type) && JSON.stringify(y.cand.target) === JSON.stringify(x.cand.target)) === i).slice(0, 4)) {
          const la = lookaheadValue(o.st, a, o.cand);
          if (aiTrace) traceAiEvent("lookahead", { action: o.cand, to: o.to, base: o.sc, bonus: la, value: o.sc + la });
          if (la > 0 && (!best || o.sc + la > best.sc)) best = { sc: o.sc + la, to: o.to, cand: o.cand, harm: o.harm };
        }
      }
      if (best?.to && s.rules.aiLedger?.pairVerify) {   // OFF pending Mala (Lantern, 2026-10-18: it fails the aura-raise and Director film gates; Muse's NOTE "open contract decision"). Pair verification (muse, 2026-10-18, seed 3962880737): the loop scores (move,
        // action) pairs but only the move executes — the action is re-decided next. If the paired
        // action is no better after the walk than before it, and the destination isn't clearly
        // better either, the move was drift on a mirage (R10's shuffle). Drop it and decide from
        // here instead; approach/guard/stall below handle the nothing-to-do case honestly.
        const mv = apply(s, { type: "move", actor: a.id, to: best.to }, { preview: true });
        const stAfter = mv.ok ? mv.state : null;
        const vDef = best.cand.type === "ability" ? ab(best.cand.ability) : null;
        const legalHere = apply(s, best.cand, { preview: true }).ok;
        const betterAfter = stAfter && legalHere
          && (score(stAfter, a.id, best.cand) > score(s, a.id, best.cand)
            || threatValue(stAfter, stAfter.actors[a.id], best.cand, vDef) > threatValue(s, a, best.cand, vDef));
        if (!stAfter || !(legalHere ? (betterAfter || moveValue(best.to) > 1) : true)) { if (aiTrace) traceAiEvent("override", { reason: "pair-verification", previous: best.cand, to: best.to, replacement: bestStay?.cand }); best = bestStay; }
      }
      if (standoff && !best?.harm) { const press = approach(s, a); if (press) return traceAiReturn("aiDecide:L537", (press)); }   // rules.standoff: break the wait
      if (a.aggressive && (!best || best.sc < s.rules.aggressive.pressBelow)) { const press = approach(s, a); if (press) return traceAiReturn("aiDecide:L538", (press)); }   // rules.aggressive
      // Ritual burial: ritual-minded units (the Chanter, Desert Rites) bury a body beside them unless a strong attack is on
      // offer and no foe is close enough to break the rite (muse/ritual-burial/SPEC.md: valuation lands with the build).
      if (s.rules.rite?.burial && (Spirit()?.greedOpen?.(s, a) ?? true) && (hasTrait(a, "unendingChant") || (s.rules.rite.burial.fastTraits || []).some((t) => hasTrait(a, t))) && H.corpseBeside?.(s, a)
        && (!best || best.sc < 8) && !Object.values(s.actors).some((u) => !u.defeated && u.side !== a.side && u.side !== "civilian" && u.side !== "bystander" && Math.max(Math.abs(u.x - a.x), Math.abs(u.y - a.y)) <= 1)
        && apply(s, { type: "riteStep", actor: a.id, section: "burial" }, { preview: true }).ok) return traceAiReturn("aiDecide:L543", ({ type: "riteStep", actor: a.id, section: "burial" }));
      // C15: with nothing good on offer (best under 3) and charge to build, meditate: half the time, Contemplative 80%, Restless 20%.
      const canMeditate = a.tempo >= MED.ap && (a.ultimateCharge ?? 0) < s.rules.ultimateChargeMax && !a.dream && !a.summon && s.rules.meditateAi !== false;
      if (canMeditate && best && best.sc < MED.aiBelowScore
        && (Spirit()?.canAdmin(s, a) ?? true)
        && seededChance(`${s.seed}:${a.id}:med2:${s.round}:${a.actionsThisTurn || 0}`) < (hasTrait(a, "contemplative") ? MED.contemplativeGate : hasTrait(a, "restless") ? MED.restlessGate : MED.aiGate)
        && apply(s, { type: "meditate", actor: a.id }, { preview: true }).ok) return traceAiReturn("aiDecide:L548", ({ type: "meditate", actor: a.id }));
      // C11: with nothing better to do, an AI unit copies a foe's demonstrated trait (half the time).
      if (Imitation && insightRules?.imitable && (!best || best.sc <= 0) && a.tempo >= Imitation.rules.ap && !a.dream && !a.summon && !a.communed && s.rules.imitateAi !== false
        && !triedThisTurn(s, a, "imitate")   // one try a turn: the roll below is per round, so a failed copy was retried until the AP ran out
        && seededChance(`${s.seed}:${a.id}:imitate:${s.round}`) < Imitation.rules.aiChance) {
        for (const foe of Object.values(s.actors).filter(u => u.id !== a.id && !u.defeated && !H.Tourist?.is(u) && u.side !== a.side)) {
          const trait = demonstratedTraits(s, foe.id).find(id => insightRules.imitable(id) && !hasTrait(a, id));
          if (trait && apply(s, { type: "imitate", actor: a.id, target: foe.id, trait }, { preview: true }).ok) return traceAiReturn("aiDecide:L555", ({ type: "imitate", actor: a.id, target: foe.id, trait }));
        }
      }
      if (canMeditate && (!best || best.sc <= 0) && (Spirit()?.canAdmin(s, a) ?? true) && seededChance(`${s.seed}:${a.id}:med:${s.round}`) < MED.idleGate && !approach(s, a)
        && apply(s, { type: "meditate", actor: a.id }, { preview: true }).ok) return traceAiReturn("aiDecide:L559", ({ type: "meditate", actor: a.id }));
      if (!best || best.sc <= (Spirit()?.holdThreshold(s, a) || 0)) {
        const holdingExit = s.modeSetup?.mode === "escape" && a.side === "enemy" && s.modeSetup.guard?.tiles?.some(([x,y])=>Math.abs(x-a.x)+Math.abs(y-a.y)<=INTERDICT.holdWithin);   // C12: on or beside its post, it does not chase
        if (!holdingExit && s.modeSetup?.mode === "escape" && a.side === "enemy") {
          const goals=(s.modeSetup.guard?.tiles||[]).filter(([x,y])=>!actorAt(s,x,y)||actorAt(s,x,y).id===a.id);
          if(goals.length) {
            const distance=at=>Math.min(...goals.map(([x,y])=>Math.abs(at[0]-x)+Math.abs(at[1]-y)));
            const moves=moveOptions(s,a.id).filter(o=>distance(o.to)<distance([a.x,a.y])).sort((x,y)=>distance(x.to)-distance(y.to)||x.tempoCost-y.tempoCost);
            for(const move of moves) { const act={type:"move",actor:a.id,to:move.to};if(apply(s,act,{preview:true}).ok)return traceAiReturn("aiDecide:L567", (act)); }
          }
        }
        const app = !holdingExit && approach(s, a); if (app) return traceAiReturn("aiDecide:L570", (app));
        if (!a.guardUsedThisTurn && a.meditateNoGuard !== a.ownerTurns && a.tempo >= s.rules.actionCosts.guard && !(Vows && Vows.refuses(s, a, "guard")) && !H.States?.refusesKind(s, a, "guard")) return traceAiReturn("aiDecide:L571", ({ type: "guard", actor: a.id }));
        return traceAiReturn("aiDecide:L572", ({ type: a.tempo > 0 ? "stall" : "end", actor: a.id }));
      }
      if (aiTrace && aiTraceDepth === 1) aiTrace.chosenPlan = { to: best.to, action: structuredClone(best.cand), value: best.sc };
      return traceAiReturn("aiDecide:L574", (best.to ? { type: "move", actor: a.id, to: best.to } : best.cand));
    }
    // Observation options are costly to build (path searches for plant routes) and were rebuilt for every candidate that
    // was scored, which tripled sim time. The decision loop builds them once per previewed state and scores from that.
    // Only the loop sets the memo, and it is cleared when the decision is made, so outside callers always get a fresh read.
    let obsMemo = null;
    const observationOptions = (s, a, keep = false) => { const opts = H.Observation.options(s, a, H.observationH()); if (keep) obsMemo = { s, id: a.id, opts }; return opts; };
    const plainAction = (act) => { const { shows, ...rest } = act || {}; return JSON.stringify(rest); };
    // withObservation: the decision loop asks for study options from where the unit stands, not again for every tile it
    // could first walk to (each one is another cloned preview; that alone made sims three times slower).
    // ── The data center (content.js rules.dataCenter: aggro, guard; docs/data-center.md) ──
    // siegeOf: the building this unit wants down. It draws everyone at war with the AGI that runs on it, so it is only
    // a target once that AGI is out. The builder's own side never turns on it, whatever the AGI has become.
    const siegeOf = (s, a) => { if (!s.rules.dataCenter?.aggro || a.wild || a.routed) return null;
      for (const c of ClassRuntime?.centers?.(s) || []) if (c.agi && c.side !== a.side && c.agi.id !== a.id && c.agi.side !== a.side && H.PostHuman.atWar(s, a, c.agi) && H.Civilian.atWar(s, a, c.agi) && (H.Visitors?.atWar(s, a, c.agi) ?? true) && H.Factions.atWar(s, a, c.agi)) return c.o;
      return null; };
    // guardOf: the building this unit defends. Its builder, and the AGI he released for as long as it is on his side.
    const guardOf = (s, a) => { const G = s.rules.dataCenter?.guard; if (!G) return null;
      const c = (ClassRuntime?.centers?.(s) || []).find((c) => c.owner.id === a.id || (c.agi?.id === a.id && a.side === c.side)); return c ? c.o : null; };
    // How much more a defender values this action: it is aimed at an opponent standing within reach of his building.
    const guardMul = (s, a, cand) => { const o = cand.target && guardOf(s, a); if (!o) return 1; const G = s.rules.dataCenter.guard, t = actorAt(s, cand.target[0], cand.target[1]);
      return t && t.side !== a.side && dist(s, t.x, t.y, o.x, o.y) <= Math.max(G.near, H.strikeRange(s, t)) ? G.mul : 1; };
    const anchorsOf = (s, a) => !s.rules.droneTowers ? [] : (s.arena.objects || []).filter((o) => o.tower && o.tower.side !== a.side && (o.hp ?? 0) > 0 && !o.protected && !o.indestructible && s.actors[o.tower.owner] && !s.actors[o.tower.owner].defeated);
    const strikesCenter = (s, a, cand) => { if (cand.type !== "strike" || !cand.target) return null; const o = siegeOf(s, a); return o && o.x === cand.target[0] && o.y === cand.target[1] ? o : null; };
    // The Dreamer value (content.js rules.dreamer): with a full bar and no Dream Space open, opening one is on the list.
    const dreamerCan = (s, a) => { const R = s.rules.dreamer; return !!R && hasTrait(a, R.trait) && !s.dreamSpace && !a.form?.golden && !a.dream && !a.summon && !a.wild && (a.ultimateCharge ?? 0) >= s.rules.ultimateChargeMax - (H.C?.characters?.[a.character]?.dreamer?.openLess || 0); };   // a born dreamer (Sita) opens early
    // Pets: summons, communed plants, released beads, tamed dream creatures. petOf(u) is the owner's id, or null.
    const petOf = (u) => (u && (u.summon?.owner || u.communed?.owner || u.beast?.owner || u.tamed?.owner)) || null;
    // Pet Fighting: while the other side has a pet out and they have none, anything that puts a pet on the field (or works
    // toward a commune) is worth PET_MATCH more. Only what the unit can already do is offered, so "if they can" holds.
    const PET_MATCH = 60;
    function petMatchBonus(s, a, cand) {
      if (!H.hasTrait(a, "petFighting") || petOf(a)) return 0;
      const live = Object.values(s.actors).filter((u) => !u.defeated && petOf(u));
      if (live.some((u) => petOf(u) === a.id) || !live.some((u) => u.side !== a.side)) return 0;
      const def = cand.type === "ability" ? ab(cand.ability) : null;
      const pets = ["commune", "bead", "summon", "observePlant"].includes(cand.type) || (cand.type === "move" && cand.observationGoal) || /summon/i.test(def?.effect || "");
      return pets ? PET_MATCH : 0;
    }
    // Commune first (Mala, 2026-10-20): with distance (no foe within 5) or a big tree (HP 20+),
    // the cheap body comes before the palace and before closing. Cleanup still just hits.
    const COMMUNE_FIRST = 58;
    function communeFirstFor(s, a, objectId) {
      const foes = Object.values(s.actors).filter((t) => H.Instinct.standing(t) && !t.notArrived && !H.Tourist?.is(t) && t.side !== a.side && t.side !== "bystander");
      if (foes.length === 0 || foes.reduce((n, t) => n + t.lf, 0) <= 12) return false;
      if ((((s.arena.objects || []).find((o) => o.id === objectId) || {}).hp || 0) >= 20) return true;
      return !foes.some((t) => dist(s, a.x, a.y, t.x, t.y) < 5);
    }
    // Tsukumogami: same shape for waking structures — with distance or a big body (size 2+), the cheap
    // body comes before the palace and before closing. Shares COMMUNE_FIRST (one body now beats later).
    function awakenFirstFor(s, a, objectId) {
      const foes = Object.values(s.actors).filter((t) => !t.defeated && !t.notArrived && !H.Tourist?.is(t) && t.side !== a.side && t.side !== "bystander");
      if (foes.length === 0 || foes.reduce((n, t) => n + t.lf, 0) <= 12) return false;
      const found = (s.arena.objects || []).find((o) => o.id === objectId) || {};
      if ((H.Tsukumogami?.profile(found.type)?.size ?? 0) >= 2) return true;
      return !foes.some((t) => dist(s, a.x, a.y, t.x, t.y) < 5);
    }
    // Boss keys (Muse-2): known live keys adjust candidate value by their counters. A counter matches
    // when every specified field hits (type, ability id, delivery); value adds (negative deters).
    function keyBonus(s, a, cand, def) {
      const know = H.Observation.knowledge(s,a);
      if (!know || !insightRules?.keyLive) return 0;
      let bonus = 0;
      for (const [uid, rec] of Object.entries(know)) {
        const u = s.actors[uid]; if (!u || u.defeated || u.side === a.side) continue;
        const deck = s.insight.decks[uid]; if (!deck) continue;
        for (const c of deck.cards) {
          if (c.kind !== "key" || !rec.revealed?.includes(c.id)) continue;
          if (!insightRules.keyLive(s, uid, c)) continue;
          for (const k of c.counters || []) {
            const m = k.match || {};
            if (m.type && m.type !== cand.type) continue;
            if (m.ability && !(cand.type === "ability" && cand.ability === m.ability)) continue;
            if (m.delivery && (!def || def.delivery !== m.delivery)) continue;
            bonus += k.value || 0;
          }
        }
      }
      return bonus;
    }
    // Baiting (Mala 2026-10-15): the AI is reaction-aware. It announces an attack when the ×1.4 is free
    // (no defender on the committed tiles can answer), or as bait: it holds a damaging full-bar ult it can
    // still fire this turn, and a defender holds a reaction. The bait draws the reaction; the ult lands next
    // into the empty window. Announced ults otherwise keep the guard-only safety gate.
    const heldUltAim = (s, a) => {
      let best = null;
      for (const u of availableAbilities(s, a.id)) {
        if (u.m.tier !== "ultimate" || !u.affordable || !(u.m.potency > 0)) continue;
        if (!best || u.m.potency > best.potency) best = { potency: u.m.potency, tempoCost: u.m.tempoCost, cost: u.m.cost };
      }
      return best;
    };
    const aiAnnounce = (s, a, x, l, foes, heldUlt) => {
      if (x.id === "setTheScene") return true;   // the full-bar film mandates its announce; the sequel path ignores the flag
      if (x.m.tier === "ultimate") return H.FocusPlans ? H.FocusPlans.announce(s, a, x.m, l.at) : true;
      if (x.m.effect !== "damage" || x.m.timing === "delayed") return false;
      if (hasTrait(a, "drunkenMonkey")) return true;   // direct hit: no answers exist, so the mult is free
      const tiles = l.tiles || [l.at];
      // Honest announces (Mala, 2026-10-17; battle seed 2122468325): no foe or wild on the tiles, no announce.
      // Telegraphing empty dirt gains the mult on nothing, and neither does announcing friendly fire.
      const tileSet = new Set(tiles.map(([tx, ty]) => tx + "," + ty));
      if (!foes.some((f) => tileSet.has(f.x + "," + f.y)) && !(s.wild || []).some((m) => m.form === "unit" && tileSet.has(m.x + "," + m.y))) return false;
      const holders = foes.filter((f) => tiles.some(([tx, ty]) => f.x === tx && f.y === ty) && (f.reaction > 0 || f.freeReactionVs === a.id));
      if (!holders.length) return true;
      return !!(heldUlt && a.tempo - x.m.tempoCost >= heldUlt.tempoCost && a.pf - x.m.cost >= heldUlt.cost);
    };
    // Ingredient totems T2 (spec claude-ingredient-totems-spec section 6): one candidate per ingredient kind in the pack or on an adjacent tile.
    const cookingRules = () => (typeof module === "object" && module.exports ? require("../account/cooking.js") : globalThis.ConceptCombatCooking) || null;
    function totemWakes(s, a) {
      const CM = H.Communion; if (!CM?.canWakeIngredients || !a || a.defeated || !CM.canWakeIngredients(a) || a.totemWokeTurn === a.ownerTurns) return [];
      const IR = CM.ingredients.rules, out = [], seen = new Set();
      if ((a.tempo || 0) < IR.communeAp || (a.pf || 0) < IR.phi) return [];
      for (const item of a.inventory || []) if (CM.totemOf(item) && !seen.has(item)) { seen.add(item); out.push({ type: "communeIngredient", actor: a.id, item }); }
      for (const pk of s.arena?.pickups || []) if (CM.totemOf(pk.item) && !seen.has(pk.item) && dist(s, a.x, a.y, pk.x, pk.y) <= IR.pickupRange) { seen.add(pk.item); out.push({ type: "communeIngredient", actor: a.id, pickup: pk.id }); }
      return out;
    }
    function totemWakeScore(s, a, cand) {
      const CM = H.Communion, item = cand.item || (s.arena?.pickups || []).find((p) => p.id === cand.pickup)?.item;
      return CM?.wakeValue ? CM.wakeValue(s, a, item, { dist, isCook: (u) => !!cookingRules()?.isCook?.(u), reach: () => s.rules.moveBudget ?? 4 }) : 0;
    }
    function candidates(s, id, keepObservation = false, withObservation = true) {
      const a = s.actors[id]; const out = [];
      if((a.learned||[]).some(id=>ab(id)?.contract))for(const x of availableAbilities(s,id)){const c=x.contract;if(c?.next?.kind==="invoke"&&!c.spent&&a.tempo>=10)out.push({type:"contractSpeak",actor:id,ability:x.id,words:c.next.words});if(c?.canPrepare&&a.tempo>=20)out.push({type:"contractPrepare",actor:id,ability:x.id});}
      if (dreamerCan(s, a)) out.push({ type: "dreamSpace", actor: id });
      out.push(...totemWakes(s, a));   // ingredient totems T2: an Animist or Kitchen Animism holder may wake an ingredient (scored from need)
      { const o = siegeOf(s, a); if (o && !a.status?.soothed && dist(s, a.x, a.y, o.x, o.y) <= H.strikeRange(s, a) && a.tempo >= s.rules.actionCosts.strikeMin)
          out.push({ type: "strike", actor: id, target: [o.x, o.y], effort: Math.min(s.rules.actionCosts.strike, s.rules.actionCosts.strikeMax, a.tempo) }); }
      // Drone towers (docs/agent-swarm.md): an opposing tower's anchor in Strike range is something to break.
      if (!a.status?.soothed && !a.wild && a.tempo >= s.rules.actionCosts.strikeMin) for (const o of anchorsOf(s, a)) if (dist(s, a.x, a.y, o.x, o.y) <= H.strikeRange(s, a))
        out.push({ type: "strike", actor: id, target: [o.x, o.y], effort: Math.min(s.rules.actionCosts.strike, s.rules.actionCosts.strikeMax, a.tempo) });
      if(a.status?.verse?.id&&a.status.verse.freeAp){const t=targeting(s,id,a.status.verse.id);if(t.legal.length)return t.legal.map(q=>({type:"ability",actor:id,ability:a.status.verse.id,target:q.at}));return [{type:"discardVerse",actor:id}];}
      let foes = Object.values(s.actors).filter((t) => H.Instinct.standing(t) && !H.Tourist?.is(t) && t.side !== a.side && H.PostHuman.atWar(s, a, t) && H.Civilian.atWar(s, a, t) && (H.Visitors?.atWar(s, a, t) ?? true) && H.Factions.atWar(s, a, t) && !(a.truceWith === t.id && a.truceUntil >= s.round) && !(Parley && Parley.blocks(s, a, t)));
      if (a.status.onePossession?.expiresAt > a.ownerTurns && a.status.onePossession.targetId) foes = foes.filter(t => t.id === a.status.onePossession.targetId);
      if (a.forceTarget && a.forceTargetUntil >= s.round && foes.some((t) => t.id === a.forceTarget)) foes = foes.filter((t) => t.id === a.forceTarget);
      // Pet Fighting (insight-data.js): a Pet Fighter's pet goes for the other side's pets while any stand.
      if (petOf(a) && H.hasTrait(s.actors[petOf(a)], "petFighting")) { const pets = foes.filter((t) => petOf(t)); if (pets.length) foes = pets; }
      // AGI Takeoff fear aggro: a transcended AGI is every opponent's only target. Same-side
      // allies can't turn (strikes and hostile abilities forbid friendly fire engine-wide).
      const apexFoe = Object.values(s.actors).find((u) => !u.defeated && u.character === "agi" && u.takeoff?.transcended && u.id !== a.id && u.side !== a.side && H.PostHuman.atWar(s, a, u) && H.Civilian.atWar(s, a, u) && (H.Visitors?.atWar(s, a, u) ?? true) && H.Factions.atWar(s, a, u)) || null;   // Post-Humanity: only a faction at war with it fears it
      if (apexFoe && foes.some((t) => t.id === apexFoe.id)) foes = foes.filter((t) => t.id === apexFoe.id);
      out.push(...H.houseOptions(s, a));
      out.push(...(H.tamerOptions?.(s, a) || []));   // the Animal Tamer: tame, mark a vessel (engine/tamer.js)   // engine/houses.js: buy, invest (top up, or take the majority)
      if (id !== "player" && H.aiWantsMyol?.(s, a)) out.push({ type: "myol", actor: id, fromAi: true });   // W5.1: gamblers buy back the sting
      if (s.rules.fish && !a.dream && !a.summon && (a.ultimateCharge ?? 0) < s.rules.ultimateChargeMax && H.fishNear?.(s, a).length) out.push({ type: "catchFish", actor: a.id, eat: true });   // dream fish: a candidate like any other
      { const o = H.house(s);   // the other side's house in Strike reach is something to break
        if (o?.house?.side && o.house.side !== a.side && !a.summon && !a.communed && !a.status?.soothed && dist(s, a.x, a.y, o.x, o.y) <= H.strikeRange(s, a) && a.tempo >= s.rules.actionCosts.strikeMin)
          for (const effort of new Set([Math.min(s.rules.actionCosts.strike, s.rules.actionCosts.strikeMax, a.tempo), Math.min(s.rules.actionCosts.strikeMax, a.tempo)]))   // a wall is worth a full swing
            out.push({ type: "strike", actor: id, target: [o.x, o.y], effort }); }
      for (const o of (s.arena.objects || []).filter((p) => p.building && p.side !== a.side && (p.hp ?? 0) > 0))   // Settlement: the other side's works in Strike reach are something to break
        if (!a.summon && !a.communed && !a.status?.soothed && dist(s, a.x, a.y, o.x, o.y) <= H.strikeRange(s, a) && a.tempo >= s.rules.actionCosts.strikeMin)
          for (const effort of new Set([Math.min(s.rules.actionCosts.strike, s.rules.actionCosts.strikeMax, a.tempo), Math.min(s.rules.actionCosts.strikeMax, a.tempo)]))
            out.push({ type: "strike", actor: id, target: [o.x, o.y], effort });
      out.push(...(H.courtCandidates?.(s, a) || []));   // Heart Court: the heart is a strike, when the tile is empty
      const relays = ClassRuntime?.relayOrigins?.(s, a) || [];   // Distributed Intelligence: a Strike can be made from any of his towers
      for (const m of (s.wild || []).filter((w) => provokersOf(s, a).has(w.id))) if (!a.status?.soothed && dist(s, a.x, a.y, m.x, m.y) <= H.strikeRange(s, a) && a.tempo >= s.rules.actionCosts.strikeMin)
        out.push({ type: "strike", actor: id, target: [m.x, m.y], effort: Math.min(s.rules.actionCosts.strike, s.rules.actionCosts.strikeMax, a.tempo) });   // a communed plant strikes back at what hit it or its owner
      for (const f of foes) if (!a.status?.soothed && (dist(s, a.x, a.y, f.x, f.y) <= H.strikeRange(s, a) || relays.some(([x, y]) => dist(s, x, y, f.x, f.y) <= H.strikeRange(s, a))) && !ClassRuntime?.bowBlocked?.(s, a, f, classH()) && a.tempo >= s.rules.actionCosts.strikeMin) out.push({ type: "strike", actor: id, target: [f.x, f.y], effort: Math.min(s.rules.actionCosts.strike, s.rules.actionCosts.strikeMax, a.tempo) });
      // Grapple (content.js rules.grapple): an adjacent, holdable opponent that is not already held.
      { const G = s.rules.grapple; if (G && !a.status?.soothed && a.tempo >= H.grappleCost(s, a)) for (const f of foes) if (dist(s, a.x, a.y, f.x, f.y) <= G.range && !f.massive && !f.boss && !H.grappled(s, f) && !(f.regripImmuneUntil >= s.round)) out.push({ type: "grapple", actor: id, target: [f.x, f.y] }); }
      if (H.grappled(s, a) && !a.status.submission && a.tempo >= H.breakCost(s, a)) out.push({ type: "breakGrapple", actor: id });
      if (s.rules.submission) for (const t of Object.values(s.actors)) {   // Submission: press a foe it holds (docs/submission.md)
        if (t.defeated || t.side === a.side || t.status?.submission || !H.grappled(s, t) || t.status.grappled.owner !== id) continue;
        if (H.canCommitSubmission(s, a)) out.push({ type: "pressSubmission", actor: id, target: [t.x, t.y], commit: true });
        else if (a.tempo >= s.rules.submission.pressAp) out.push({ type: "pressSubmission", actor: id, target: [t.x, t.y] });
      }
      { const T = H.EmergentIdeas?.active(a).find((x) => x.id === "fulcrumThrow")?.effects;   // Fulcrum Throw: an adjacent opponent into another opponent in range
        if (T && !a.status?.soothed && a.tempo >= T.ap) for (const f of foes) if (dist(s, a.x, a.y, f.x, f.y) === 1 && !f.massive && !f.boss)
          for (const g of foes) if (g.id !== f.id && dist(s, a.x, a.y, g.x, g.y) <= T.range) out.push({ type: "throw", actor: id, pick: [f.x, f.y], at: [g.x, g.y] }); }
      const authoredAbilities = a.aiAbilities ? availableAbilities(s, id).filter((x) => a.aiAbilities.includes(x.id)) : availableAbilities(s, id);
      // Rama's word (docs/rama-build.md): once a battle, he gives it early: Dharma's Bow (+3 potency), paid with Open Guard (he
      // stands in the open) and tomorrow's tempo (never blood: level 2, 2026-10-24, the 15% LF cost his side in long fights).
      if (Vows && !a.form?.golden && H.C?.characters?.[a.character]?.swearsWord && !a.wordGiven) { const once = a.vowApTax > 0 ? null : "spentTomorrow";
        if (once) out.push({ type: "vow", actor: id, target: "word", vow: { boon: "dharmasBow", restrictions: ["openGuard", once] } }); }
      { const vg = Vows && !a.form?.golden && vowTechGains(s, a, foes, authoredAbilities);   // technique stances: one flip analysis per candidate set, gains stashed on the candidate (cand.dmg precedent) — no extra manifest walk
        if (vg) for (const boon of ["farShot", "heavyHands", "piercingOath"]) {
          if (Vows.live(s, a).some((v) => v.on === "technique" && v.boon === boon)) continue;
          const pay = vowTechPay(s, a, Vows.BOONS[boon].price);
          if (pay) out.push({ type: "vow", actor: id, target: "technique", vow: { boon, restrictions: pay }, vowGain: vg[boon] });
        } }
      { const dream = Vows && !a.form?.golden && VK && Affinity && H.C && VK.declareFor(Affinity, H.C, a, H.abilitiesOf(a).map((bid) => VK.textOf(ab(bid))),   // W4.6: the recognized dream, sworn out loud (deliberate = consented)
        { round: s.round, isAhead: VK.ahead(s, a.side), live: Vows.live(s, a).some((v) => !v.broken) });
        if (dream) { const pay = vowTechPay(s, a, Vows.BOONS[dream.boon].price);
          if (pay) { for (let i = out.length - 1; i >= 0; i--) if (out[i].type === "vow" && out[i].vow?.boon === dream.boon) out.splice(i, 1);   // the dream outranks the tactics
            out.push({ type: "vow", actor: id, target: "technique", vow: { boon: dream.boon, restrictions: pay, consent: true }, vowGain: dream.gain }); } } }
      const heldUlt = heldUltAim(s, a);   // baiting needs the held finisher's price, once per candidate set
      // A montage ultimate (Photomontage, Final Chapter) needs ΦF when the bar fills: with the bar 60% up and three techniques
      // seen, nothing else may spend below its cost (Lantern, 2026-10-18: the Mangaka spent it all on Prototype and never fired one).
      const montageCost = (a.ultimateCharge ?? 0) >= 0.6 * (s.rules.ultimateChargeMax || 100) && (s.observedAbilities?.[id] || []).length >= 3
        ? Math.min(Infinity, ...authoredAbilities.filter((y) => y.m.effect === "montage").map((y) => y.m.cost)) : Infinity;
      for (const x of authoredAbilities) {
        if (montageCost < Infinity && x.m.effect !== "montage" && x.m.cost > 0 && a.pf - x.m.cost < montageCost) continue;
        if (x.m.effect === "craftCare") continue;   // the AI does not plan a two-step turn; Measure Twice is the player's tool
        const silenced = a.status?.silenced;   // Typed Channel: apply refuses this channel until the unit's next turn (class-runtime beforeAbility), and previews skip that check
        if (silenced && (silenced.until == null || silenced.until >= a.ownerTurns) && x.m.damageType === silenced.channel) continue;
        if ((s.aiBans?.[id]?.[x.id] ?? -1) > s.round) continue;
        if (Vows && Vows.refuses(s, a, "ability", ab(x.id))) continue;   // Vows
        if (H.States?.refusesAbility(s, a, x.id)) continue;   // States: a gate holds this technique; previews skip apply's check
        // Sieve Verdict is player-only by design ("not used by the demo AI"); confirmed, not a bug. The one exception is a
        // unit with Mastery (rules.mastery): a Master casts his ultimate, or the trait would do nothing for the Student who earns it.
        if (!x.affordable || (x.id === "sieveVerdict" && !(s.rules.mastery && hasTrait(a, s.rules.mastery.trait)))) { if (aiTrace) traceAiEvent("unscored", { stage: "ability-generation", actor: id, ability: x.id, reason: !x.affordable ? "unaffordable" : "mastery-gate" }); continue; }
        const breachAp = breachPrice(s, a, x.m)?.ap || 0;   // Declared Terms (helper above): a breaching act pays its cost plus the 20-tempo stun before the commit check
        const overclock = Math.max(0, Math.ceil((x.m.tempoCost + breachAp - a.tempo) / 5) * 5);
        if (overclock && (hasTrait(a, "craftsmansMindset") || !["damage", "field"].includes(x.m.effect) || overclock > s.rules.maxOverclockPerAction
          || a.tempoDebt + x.m.tempoCost + overclock - a.tempo > s.rules.maxTempoDebt)) continue;
        if (x.m.tier === "ultimate" && s.round < (s.rules.aiUltimateFromRound || 0)) continue;   // 0: no round lock (Mala, 2026-10-15); kept as a sim lever
        // Innovation (muse, 2026-10-16): Prototype aims once per witnessed copyable source, Recombine once per
        // readied same-delivery pair/triple, and a dead basic under What If aims once per known shape. Copies score
        // through the normal preview path (the candidate carries its parts), so only What If needs an explicit value.
        const innoCopyable = (bid) => { const d = ab(bid); return d && d.tier === "basic" && (!d.timing || d.timing === "immediate") && !d.announce && d.effect === "damage" && d.target === "enemy" && d.area?.shape === "single" && Number.isFinite(d.potency); };
        const innoVariants = () => {
          if (x.id === "prototype") return (s.observedAbilities?.[id] || []).filter(innoCopyable)
            .map((src) => ({ opts: { prototypeSource: src }, tg: targeting(s, id, x.id, { prototypeSource: src }) })).filter((v) => v.tg.legal.length);
          if (x.id === "recombine") {
            const lens = H.C.concepts.innovation.lens, prof = lens.profiles[a.lens?.innovation || lens.default] || {}, need = prof.fuseNeed || 2;
            const known = [...new Set([...availableAbilities(s, id).filter((y) => y.affordable && innoCopyable(y.id)).map((y) => y.id), ...(s.observedAbilities?.[id] || []).filter(innoCopyable)])], combos = [];   // own or witnessed
            const walk = (at, acc) => { if (acc.length >= need && acc.length <= 3) combos.push(acc.slice()); if (acc.length === 3) return;
              for (let i = at; i < known.length; i++) { acc.push(known[i]); walk(i + 1, acc); acc.pop(); } };
            walk(0, []);
            return combos.filter((c) => c.every((p) => ab(p).delivery === ab(c[0]).delivery))
              .map((parts) => ({ opts: { recombineParts: parts }, tg: targeting(s, id, x.id, { recombineParts: parts }) })).filter((v) => v.tg.legal.length);
          }
          // Photomontage and Final Chapter (Lantern, 2026-10-18): the strongest legal trios of witnessed techniques (top five
          // per role by potency); Final Chapter may quote ultimates up to its montageUlts. Before this the AI never cast either.
          // Clip and Juxtapose (Lantern, 2026-10-18, for the Mangaka's Sampler): Clip aims once per fragment kind it could
          // take; Juxtapose once per held fragment. Before this the AI only ever tried Clip on cover and never pasted.
          if (x.id === "fourForces") return ["thrust", "drag", "lift", "weight"].map((force) => ({ opts: { force }, tg: targeting(s, id, x.id) })).filter((v) => v.tg.legal.length);   // the Aviator picks a force
          if (x.id === "ulaula") { const gears = a.birdMountain?.vows?.neverQuench ? [2, 3, 4, 5] : [2, 3, 4]; return gears.map((gear) => ({ opts: { gear }, tg: targeting(s, id, x.id) })).filter((v) => v.tg.legal.length); }   // ʻUlaʻula picks a gear (2026-10-22)
          if (x.id === "clip") return ["cover", "membrane", "wallProtection10", "thorns", "absorbOneLine"].map((fragment) => ({ opts: { fragment }, tg: targeting(s, id, x.id, { fragment }) })).filter((v) => v.tg.legal.length);
          if (x.id === "juxtapose") return (a.heldFragments || []).map((f) => ({ opts: { fragmentId: f.id }, tg: targeting(s, id, x.id, { fragmentId: f.id }) })).filter((v) => v.tg.legal.length);
          if (ab(x.id)?.effect === "montage") {
            const seen = [...new Set(s.observedAbilities?.[id] || [])].map((bid) => [bid, ab(bid)]).filter(([, d]) => d), ults = ab(x.id).montageUlts || 0;
            const top = (f) => seen.filter(([, d]) => f(d)).sort((p, q) => (q[1].potency || 0) - (p[1].potency || 0)).slice(0, 5).map(([bid]) => bid);
            const D0 = top((d) => ["line", "placed", "routed", "field"].includes(d.delivery)), A1 = top((d) => ["single", "line", "plus", "radius"].includes(d.area?.shape)), E2 = top((d) => d.effect === "damage" && Number.isFinite(d.potency));
            const trios = [];
            for (const p0 of D0) for (const p1 of A1) for (const p2 of E2) { const parts = [p0, p1, p2];
              if (new Set(parts).size === 3 && parts.filter((bid) => ab(bid).tier === "ultimate").length <= ults) trios.push({ parts, mean: parts.reduce((n, bid) => n + (ab(bid).potency || 0), 0) / 3 }); }
            return trios.sort((p, q) => q.mean - p.mean).slice(0, 2).map(({ parts }) => ({ opts: { montageParts: parts }, tg: targeting(s, id, x.id, { montageParts: parts }) })).filter((v) => v.tg.legal.length);
          }
          if (x.m.tier === "basic" && a.status?.whatIf?.untilRound >= s.round) {
            const base = targeting(s, id, x.id);
            if (base.legal.length) return [{ opts: {}, tg: base }];   // a live slot plays straight; the shapeshift is for dead slots
            return availableAbilities(s, id).filter((y) => y.affordable && ab(y.id)?.tier === "basic" && y.id !== x.id).map((y) => y.id)
              .map((as) => ({ opts: { whatIfAs: as }, tg: targeting(s, id, x.id, { whatIfAs: as }) })).filter((v) => v.tg.legal.length);
          }
          return [{ opts: {}, tg: targeting(s, id, x.id) }];
        };
        const hostile = ab(x.id)?.target === "enemy", ward = H.Exposure.ward(s, a);
        for (const { opts, tg } of innoVariants()) for (const l of tg.legal) {
          const vh = hostile || x.id === "prototype" || x.id === "recombine" || !!opts.montageParts || (opts.whatIfAs != null && ab(opts.whatIfAs)?.target === "enemy");   // copies resolve hostile whatever the slot says
          if (apexFoe && vh && (l.at[0] !== apexFoe.x || l.at[1] !== apexFoe.y)) continue;   // fear aggro: hostile aims only at the AGI
          if (ward && vh && (l.at[0] !== ward.x || l.at[1] !== ward.y) && tg.legal.some((q) => q.at[0] === ward.x && q.at[1] === ward.y)) continue;   // Exposure: a Steward aims at whoever hurt his plant, when this technique can reach them
          if (vh) { const occ = H.actorAt(s, l.at[0], l.at[1]); if (occ && !(H.PostHuman.atWar(s, a, occ) && H.Civilian.atWar(s, a, occ) && (H.Visitors?.atWar(s, a, occ) ?? true) && H.Factions.atWar(s, a, occ))) continue; }   // Post-Humanity and civilians: no AI starts that fight, and they start none
          out.push({ type: "ability", actor: id, ability: x.id, target: l.at, overclock, announce: aiAnnounce(s, a, x, l, foes, heldUlt), ...opts });
        }
      }
      // The Maid's cart (classes/class-runtime.js cartOf): standing beside an allied Maid, take an item out of it.
      if (ClassRuntime?.cartOf && (a.inventory || []).length < (a.inventoryCapacity || 0) && a.tempo >= (s.rules.actionCosts.utility ?? 20) && a.character !== "maid")
        for (const m of Object.values(s.actors)) { if (m.id === a.id || m.side !== a.side || m.defeated || Math.max(Math.abs(m.x - a.x), Math.abs(m.y - a.y)) > 1) continue;
          for (const it of new Set((ClassRuntime.cartOf(s, m)?.stored || []).filter(x => x.kind === "item").map(x => x.item))) out.push({ type: "takeFromCart", actor: id, from: m.id, item: it }); }
      if (accountItems?.consumables && a.inventory?.length && a.tempo >= s.rules.actionCosts.utility) {
        for (const item of a.inventory) {
          const def = accountItems.consumables[item], effect = def?.effect || {};
          if (!def || effect.wild || def.outsideBattle) continue;
          const useful = (effect.heal && (a.lf < a.maxLF * 0.55 || (H.pickupRules?.edibleSources?.[item] && a.maxLF - a.lf >= effect.heal * 0.6))) ||   // field food is eaten as soon as most of it would count
             (effect.phiForce && a.pf < a.maxPF * 0.35) || (effect.actionPoints && a.tempo <= 25) || (effect.ultCharge && (a.ultimateCharge ?? 0) < (s.rules.ultimateChargeMax || 100) * 0.5);
          if (!useful) continue;
          const act = { type: "useItem", actor: id, item, target: [a.x, a.y] };
          if (apply(s, act, { preview: true }).ok) out.push(act);
        }
      }
      // NPC Observe (insight/observation.js). Not for an aggressive unit: its job is to close, and study would outscore that.
      if (H.Observation && withObservation && !a.aggressive) out.push(...observationOptions(s, a, keepObservation).map(o=>o.action));
      const beliefSummon = beliefSummonCandidate(s, a);
      if (beliefSummon) out.push(beliefSummon);
      // Palace summons: a second body doubles action economy on later turns (Mala, 2026-10-19). The AI answers its own
      // summon question correctly, exactly as observation.js answers commune questions: the gate teaches humans, not the foe.
      // Commune first (Mala, 2026-10-20): with distance or a big tree, the cheap body comes before the palace.
      const communeFirst = out.some((c) => (c.type === "commune" && communeFirstFor(s, a, c.object)) || (c.type === "communeStructure" && awakenFirstFor(s, a, c.object)));
      if (summonQuestions && summonRules && summonRules.callsPalace(a) && !communeFirst && !a.communed && !a.dream && !a.aggressive) {   // summon-owner: the player's side calls (Mala, 2026-11-05, decision b); commune bodies, dreams and aggressive units still don't consider it
        const unlocked = s.unlockedSummons || [];
        for (const key of unlocked) {
          if (!summonReadiness || !summonReadiness(s, id, key, unlocked).ok) continue;
          const q = summonQuestions.pickQuestion(key, `${s.seed}:${s.round}:${id}:${key}`, { hintCount: summonQuestionHints ? summonQuestionHints(s, id, key) : 0 });
          if (!q) continue;
          const act = { type: "summon", actor: id, summon: key, unlocked: unlocked.slice(), questionId: q.id, answer: q.answer };
          if ((a.passives?.summonPhiAdd || 0) > 0 && OG()?.charmChoice?.(a.traits) === "refuse") continue;
          const occupied = new Set(Object.values(s.actors).filter((u) => !u.defeated).map((u) => `${u.x},${u.y}`));
          const at = summonRules.placeSummon(s.arena, [a.x, a.y], occupied);
          if (at && OG()?.inField(s.arena.objects, at[0], at[1])) continue;
          if (apply(s, act, { preview: true }).ok) out.push(act);
        }
      }
      if (summonRules && dreamReadiness && summonRules.callsPalace(a) && !communeFirst && !a.communed && !a.dream && !a.aggressive) {   // D2: unlocked dreams are considered beside palace familiars (no question; same exclusions)
        const unlocked = s.unlockedSummons || [];
        for (const key of unlocked) {
          if (!key.startsWith("enemyDream:") || !dreamReadiness(s, id, key, unlocked).ok) continue;
          const act = { type: "callDream", actor: id, key, unlocked: unlocked.slice() };
          if (apply(s, act, { preview: true }).ok) out.push(act);
        }
      }
      if(H.waterRecovery(s,a)?.allowed && apply(s,{type:"recoverWater",actor:id},{preview:true}).ok)out.push({type:"recoverWater",actor:id});   // Water (synergy merge 1.3.379: hand-placed beside recover; the palace-summon block sits between the patch's anchors)
      if (a.maxPF > 0 && a.pf < 6 && a.lastRecoverTurn < a.ownerTurns - s.rules.recover.cooldownTurns && a.tempo >= s.rules.actionCosts.utility) out.push({ type: "recover", actor: id });
      if (!a.status?.overwatch && (a.reaction ?? 0) > 0 && !a.aggressive && !a.summon && a.tempo >= (s.rules.overwatch?.ap ?? 10)) out.push({ type: "overwatch", actor: id });   // Overwatch (Muse-2)
      if (a.disengageTurn !== a.ownerTurns && a.lf <= (s.rules.opportunity?.potency ?? 6) && a.tempo >= (s.rules.opportunity?.disengageAp ?? 15)
        && Object.values(s.actors).some((w) => !w.defeated && w.side !== a.side && (w.reaction ?? 0) > 0 && !H.Tourist?.is(w) && dist(s, a.x, a.y, w.x, w.y) <= H.strikeRange(s, w))
        && apply(s, { type: "disengage", actor: id }, { preview: true }).ok) out.push({ type: "disengage", actor: id });   // only when the swing could drop them; a strike still outranks it
      if (H.Instinct.holder(a) && !H.Instinct.lying(a) && H.Instinct.wounded(s, a) && !H.Instinct.neverFlees(a)) {   // Survival Instincts: Brave and Main Character Energy never flee, so they neither run nor lie
        if (H.Instinct.threatened(s, a) && apply(s, { type: "scramble", actor: id }, { preview: true }).ok) out.push({ type: "scramble", actor: id });
        if (H.Instinct.threatened(s, a) && !H.hasTrait(a, "honorable") && apply(s, { type: "playDead", actor: id }, { preview: true }).ok) out.push({ type: "playDead", actor: id });   // deceit is not honorable
      }
      if (Auras && !a.wild && Auras.aiValue(s, a, auraH()) != null) out.push({ type: "aura", actor: id });   // Auras
      { const MR = s.rules.mystery?.ai;   // Mystery S1 + S2: face-down sets for a setter with a foe in its trigger outlook. S1, counter-first: an on-attacked attack, never an ultimate (spec section 1). S2, patient: an on-turn-start attack, ultimates included (the set call's own gate: a full bar, or Mastery). First-come side budget, one plan per setter per trigger; the decide-time preview re-validates. No coin and no jitter (R-20261103-18: sets come from traits and necessity): a full bar plus an outlook offers the patient set every decide, and the cast comparison spends the bar whenever the cast is worth more.
        if (MR && (H.mysteryBudgetLeft?.(s, a.side) || 0) > 0 && setOutlook(s, a).length)
          for (const trigger of ["on-attacked", "on-turn-start", "manual"]) {   // S3, the held card: a manual plan is the same pool held for the reveal policy (revealTries) instead of a trigger; never an ultimate (the line below: ultimates are set on-turn-start only, R-20261109-06)
            if ((H.mysteryOwnCount?.(s, a.id, trigger) || 0) >= (MR.setMaxPerTrigger ?? 1)) continue;
            for (const x of authoredAbilities) {
              if (!x.affordable || x.m.effect !== "damage" || !(x.m.potency > 0)) continue;
              if (x.m.tier === "ultimate" && trigger !== "on-turn-start") continue;
              { const d = ab(x.id); if (d?.crescendo || d?.inspirationPrice || x.m.lfPrice) continue; }   // prices the face-down path does not charge (a Crescendo's Inspiration gate and an inspirationPrice are skipped at set and prepaid at fire; the Ajin LF price likewise): the AI does not set what it could not pay to cast (tests/crescendo.test.mjs; landing 1.3.549)
              if (breachPrice(s, a, x.m)) continue;   // Declared Terms: a set fires through the ability path later (the face-down fire calls handlers.ability prepaid), so a counter that breaks the setter's own contract would land the breach penalty and stun on it at a moment it does not choose; the cast loop prices that (breachAp below), the set loop simply keeps its word (Integrator's reading under R-20261103-28, landing 1.3.549; tests/contract-breach-ai.test.mjs B1/B2)
              if ((s.aiBans?.[id]?.[x.id] ?? -1) > s.round) continue;   // a refused set (or cast) of this ability banned it for three rounds (actions.js aiFailure): the set generator honours the ban as the cast loop does (landing 1.3.549)
              if (a.tempo < x.m.tempoCost || a.pf < x.m.cost) continue;   // the set pays now, no overclock and no Inspiration path (as the set call charges)
              const act = { type: "setIntent", actor: id, ability: x.id, trigger };
              if (apply(s, act, { preview: true }).ok) out.push(act);
            }
          } }
      if (H.fruitOf) for (const c of out) if (c.type === "strike") {   // Sinkerfruit: coat a Strike in Steel will against Coil's give or Mist's Drift, when the AP allows
        const t = actorAt(s, ...(c.target || [])), f = t && H.fruitOf(t);
        if (f && (f.id === "coil" || f.id === "mist") && !H.damped(s, t) && a.tempo >= (c.effort || s.rules.actionCosts.strike) + H.fruitRules.steelWillAP) c.steelWill = true;
      }
      return out.filter((c) => !sightBlind(s, a, c));   // Sight arms (H1): a blind side never generates a family action
    }
    // Reactive defense (rules.reactiveDefense.ai): play each reactive answer out on a copy, everyone after answering
    // nothing, and price it: LF saved + LF it returns to the attacker - action points x apWeight - ΦF x pfWeight. The
    // reaction is the round's only one, so an answer must clear `keep` to be worth spending it. overGuard compares it
    // with Guard where Guard is offered (announced attacks).
    // An action point's worth to this fighter: its best damage per action point, from Strike or any attack technique it
    // holds (potency / action points). Debt is paid out of next turn's budget, so this is what owing one costs it.
    function apWorth(s, a) {
      let best = (s.rules.strike?.potency || 6) / Math.max(1, s.rules.actionCosts.strike);
      for (const x of availableAbilities(s, a.id)) if (x.m.effect === "damage" && x.m.potency > 0 && x.m.tier !== "ultimate" && x.m.tempoCost > 0) best = Math.max(best, x.m.potency / x.m.tempoCost);
      return best;
    }
    function reactChoice(s, a, opts) {
      const R = s.rules.reactiveDefense?.ai; if (!R) return null;
      const techs = opts.filter((o) => o.kind === "technique"); if (!techs.length) return null;
      const atkId = s.pending.attacker;
      const play = (resp) => { const r = apply(s, { type: "respond", actor: a.id, ...resp }, { preview: true }); if (!r.ok) return null;
        let st = r.state, n = 0; while (st.phase === "response" && n++ < 16) { const who = decider(st)?.actor; const q = apply(st, { type: "respond", actor: who, response: "none" }, { preview: true }); if (!q.ok) break; st = q.state; }
        return { lost: a.lf - (st.actors[a.id]?.lf ?? 0), returned: (s.actors[atkId]?.lf ?? 0) - (st.actors[atkId]?.lf ?? 0), st }; };
      const base = play({ response: "none" }); if (!base) return null;
      const worth = (o) => (base.lost - o.lost) + R.returnedWeight * (o.returned - base.returned);
      // Unrevealed, the defender cannot see how the answer meets this technique (the graph's edges): it judges each
      // answer by what it normally does (a wall stops a line, Rebound catches and returns half, Membrane filters a line),
      // and can be wrong. Revealed, it plays the answer out exactly. Its own failures are already out of the options.
      const known = !!s.disclosures?.[atkId]?.[s.pending.inst.ability];
      const caughtShare = s.rules.reactiveDefense?.rushed ?? 1;   // rushed: an answer catches only this share
      // His own pairing he does know: a wall of Barrier + Elasticity deflects (compositionEdge), whatever the attack is.
      const comp = H.compositionEdge(a), ownDeflect = comp?.op.kind === "enableEdge" ? (H.C.opposition.find((e) => e.id === comp.op.edge)?.op.fraction || 0) : 0;
      const guess = (t) => { const eff = ab(t.ability)?.effect, back = eff === "parry" ? (ab(t.ability).parry?.reflectFraction || 0) : eff === "barrier" ? ownDeflect : 0;
        return { lost: base.lost * (1 - caughtShare), returned: base.returned + base.lost * caughtShare * back }; };
      let best = null;
      const perAp = Math.max(R.apWeight, apWorth(s, a) * (R.debtPain ?? 1) * (H.Tally?.debtPainMul(s, a) ?? 1));   // what an action point owed costs this fighter
      for (const t of techs) {
        if (t.answer) {   // My Answer Has Changed: it cancels the whole attack, but spends the bar he could fire on his own turn (docs/beam-clash.md §4)
          const m = H.manifest(s, a, t.ability), strength = (m.potency || 0) + Math.min(30, s.cls?.stored?.[a.id] || 0), lethal = base.lost >= a.lf;
          const v = worth({ lost: 0, returned: base.returned }) - t.apCost * perAp - (t.inspired ? R.inspirationWeight ?? 3 : t.pf * R.pfWeight) - (lethal ? 0 : (R.answerBarWeight ?? 0.15) * strength);
          if (v > R.keep && (!best || v > best.value)) best = { ...t, value: v };
          continue;
        }
        const o = known ? play({ response: "technique", ability: t.ability, target: t.target }) : guess(t); if (!o) continue;
        let v = worth(o) - t.apCost * perAp - t.pf * R.pfWeight;
        if (t.coverFor && o.st && base.st) { const allyBefore = s.actors[t.coverFor]?.lf ?? 0;   // W1c cover: a revealed attack is played out, so the ally's saved LF prices exactly (unrevealed, the guess covers only self and the gaze stays home)
          v += ((allyBefore - (base.st.actors[t.coverFor]?.lf ?? 0)) - (allyBefore - (o.st.actors[t.coverFor]?.lf ?? 0))) * (R.allyWeight ?? 1); }
        { const B = switchOn(s, a, "foeMemory") && s.foeBrief?.for === a.id ? s.foeBrief?.prefer?.[s.pending.inst.ability]?.[t.ability] || 1 : 1;   // foe-memory briefing (Muse-2 FOE_MEMORY): an answer that worked against this technique opens hot (x1.25); failures are already excluded by learnedFails (window.js), so there is no guard half
          v = v >= 0 ? v * B : v / B; }
        if (v > R.keep && (!best || v > best.value)) best = { ...t, value: v }; }
      if (best && opts.some((o) => o.kind === "guard")) { const g = play({ response: "guard" }); best.overGuard = g ? best.value - worth(g) : best.value; }
      else if (best) best.overGuard = best.value;
      return best;
    }
    // Priced defence against an announced attack (Mala, 2026-10-17: "the AI would want to keep their AP to execute their
    // next turn's plan and take damage unless their life depended on dodging, but if you wait until your HP is too low to
    // dodge you're just delaying the inevitable"; rules.reactiveDefense.ai.dodge). The answer it would give anyway (Guard,
    // or a reactive technique where reactChoice says it beats Guard) and each safe step or throw are priced:
    //   LF saved x (1 + lowLf x how hurt the blow leaves you)   each LF matters more the closer you are to falling
    //            x (1 + chunk x the blow's share of a full life)  and the bigger the single blow (a big chunk puts you in
    //            reach of the next one; at full health a blow over about a fifth of your life is worth the step)
    // + lethal x a whole turn of your action points, when the blow would fell you and this answer doesn't (being alive is
    //   at least one more turn), x inevitable if you'd still be inside the attacker's next hit (it may only buy that turn)
    // + LF it returns to the attacker (a throw)
    // - action points spent or owed x what an action point is worth to you (your next turn's plan)
    // A step or throw is taken only when it beats that answer by more than `keep`.
    function defendChoice(s, a, opts, react) {
      const R = s.rules.reactiveDefense.ai, D = R.dodge, atkId = s.pending.attacker, atk = s.actors[atkId];
      const play = (resp) => { const r = apply(s, { type: "respond", actor: a.id, ...resp }, { preview: true }); if (!r.ok) return null;
        let st = r.state, n = 0; while (st.phase === "response" && n++ < 16) { const who = decider(st)?.actor; const q = apply(st, { type: "respond", actor: who, response: "none" }, { preview: true }); if (!q.ok) break; st = q.state; }
        const me = st.actors[a.id] || {};
        return { lf: Math.max(0, me.lf ?? 0), down: !!me.defeated || (me.lf ?? 0) <= 0, ap: Math.max(0, (a.tempo || 0) - (me.tempo ?? a.tempo)) + Math.max(0, (me.tempoDebt || 0) - (a.tempoDebt || 0)),
          returned: Math.max(0, (atk?.lf ?? 0) - (st.actors[atkId]?.lf ?? 0)) }; };
      const base = play({ response: "none" }); if (!base) return { type: "respond", actor: a.id, response: "none" };
      const perAp = Math.max(R.apWeight, apWorth(s, a) * (R.debtPain ?? 1) * (H.Tally?.debtPainMul(s, a) ?? 1));
      const nextHit = atk && !atk.defeated ? Math.max(s.rules.strike?.potency || 6, ...availableAbilities(s, atk.id).filter((x) => x.m.effect === "damage" && x.m.tier !== "ultimate").map((x) => x.m.potency || 0)) : 0;
      const blow = Math.max(0, (a.lf - base.lf) / Math.max(1, a.maxLF));   // the blow's share of a full life
      const danger = (1 + (D.lowLf ?? 1) * (1 - base.lf / Math.max(1, a.maxLF))) * (1 + (D.chunk ?? 5) * blow);   // Mala: eating a 22 LF ult to keep a plan is foolish; eating a Filter Bolt at full health is not
      const value = (o) => (o.lf - base.lf) * danger + (base.down && !o.down ? (D.lethal ?? 1) * (a.tempoCapacity || 100) * perAp * (o.lf <= nextHit ? (D.inevitable ?? 0.5) : 1) : 0)
        + (R.returnedWeight ?? 1) * (o.returned - base.returned) - o.ap * perAp;
      // Guard against a technique stays reactChoice's call (overGuard, tuned with half-price answers); this only decides
      // whether a step (or a throw) beats that answer by more than `keep`.
      const known = !!s.disclosures?.[atkId]?.[s.pending.inst.ability], caught = s.rules.reactiveDefense?.rushed ?? 1;
      const guessTech = (t) => { if (ab(t.ability)?.answer) return { lf: a.lf, down: false, ap: react?.apCost || 0, returned: base.returned };   // an answer cancels it all
        const lost = a.lf - base.lf, def = ab(t.ability), back = def?.effect === "parry" ? (def.parry?.reflectFraction || 0) : 0, lf = base.lf + lost * caught;
        return { lf, down: base.down && lf <= 0, ap: react?.apCost || 0, returned: base.returned + lost * caught * back }; };   // unrevealed: what the answer normally does (it may not know Selectivity breaks Rebound)
      const stay = react && react.overGuard > 0 ? { response: "technique", ability: react.ability, target: react.target } : opts.some((o) => o.kind === "guard") ? { response: "guard" } : { response: "none" };
      const so = stay.response === "technique" && !known ? guessTech(stay) : stay.response === "none" ? base : play(stay);
      const stayV = so ? value(so) - (stay.response === "technique" ? (ab(stay.ability)?.answer ? (react?.inspired ? R.inspirationWeight ?? 3 : (manifest(s, a, stay.ability).cost || 0) * R.pfWeight) + (base.down ? 0 : (R.answerBarWeight ?? 0.15) * ((manifest(s, a, stay.ability).potency || 0) + Math.min(30, s.cls?.stored?.[a.id] || 0))) : (manifest(s, a, stay.ability).cost || 0) * R.pfWeight) : 0) : 0;   // an answer also gives up its bar
      let best = null;
      for (const kind of ["reposition", "dodgeThrow"]) { const opt = opts.find((o) => o.kind === kind && o.safe); if (!opt) continue;
        const o = play({ response: kind, to: opt.to }); if (!o) continue; const v = value(o);
        if (v > stayV + (R.keep ?? 2) && (!best || v > best.v)) best = { t: { response: kind, to: opt.to }, v }; }
      return { type: "respond", actor: a.id, ...(best ? best.t : stay) };
    }
    // Least-used ledgers (rules.aiLedger): price what previews can't show. Threat first, then info.
    const liveStatus = (a, key) => { const st = a.status?.[key]; return st && (st.expiresAt == null || st.expiresAt > a.ownerTurns); };
    // Mystery S1: the trigger outlook of an on-attacked set — the foes who could spring it. The foes this unit fights (the test
    // candidates() applies to its own foe list: standing, no tourist, at war on every axis, no truce, no parley; and arrived)
    // inside the ledger's threatRangeSelf, the range the AI already prices worn protection over (threatValue below). A counter
    // is worn protection that hits back: it pays only if one of them attacks the wearer. The range is a judgement, not a proof:
    // a foe farther off may still arrive before the card expires, and the AI does not bet on it (spec section 1: no set with an
    // empty trigger outlook). Distance only, as the ledger counts worn protection: no sight test. Nearest first.
    const setFoe = (s, a, t) => H.Instinct.standing(t) && !t.notArrived && !H.Tourist?.is(t) && t.side !== a.side && t.side !== "bystander" && H.PostHuman.atWar(s, a, t) && H.Civilian.atWar(s, a, t) && (H.Visitors?.atWar(s, a, t) ?? true) && H.Factions.atWar(s, a, t) && !(a.truceWith === t.id && a.truceUntil >= s.round) && !(Parley && Parley.blocks(s, a, t));   // a foe the setter fights (S3 shares it with revealTries)
    function setOutlook(s, a) {
      const R6 = s.rules.aiLedger?.threatRangeSelf ?? 6;
      return Object.values(s.actors).filter((t) => setFoe(s, a, t) && dist(s, a.x, a.y, t.x, t.y) <= R6)
        .sort((p, q) => dist(s, a.x, a.y, p.x, p.y) - dist(s, a.x, a.y, q.x, q.y));
    }
    // Mystery S3, the reveal policy's eyes: the best reveal of the setter's oldest manual plan, observed, never read. An AI plan stores no
    // target (S2), so the reveal aims now: at each foe in the trigger outlook, nearest first, then at nothing (a self-centred blow). Each try
    // is a preview settled with every answer "none" (the way reactChoice settles answers), so a kill here is a kill if the foe does not answer.
    // A try counts only when it harms a foe the setter fights and nobody else: an ally, a civilian or a bystander losing any LF refuses it (a free
    // card is not worth a wound to the setter's own side or a crime). Null when no try qualifies (re-validation refused, nothing to hit): silence.
    // RIK R1 splits it in two so the exchange reads the same tries: revealTries (every qualifying try, with its settled state) and bestReveal.
    const settleNone = (st) => { for (let n = 0; st.phase === "response" && n < 16; n++) { const who = decider(st)?.actor; const q = who && apply(st, { type: "respond", actor: who, response: "none" }, { preview: true }); if (!q?.ok) break; st = q.state; } return st; };
    function revealTries(s, a) {
      const out = [];
      for (const target of [...setOutlook(s, a).map((t) => [t.x, t.y]), null]) {
        const act = target ? { type: "revealIntent", actor: a.id, target } : { type: "revealIntent", actor: a.id };
        const r = apply(s, act, { preview: true }); if (!r.ok) continue;
        const st = settleNone(r.state);
        let harm = 0, other = 0, kill = false, wrong = false;
        for (const t of Object.values(s.actors)) {
          const after = st.actors[t.id]; if (!after || t.defeated) continue;
          const lost = Math.max(0, t.lf - after.lf), fell = !!after.defeated, foe = setFoe(s, a, t);
          if (foe) { harm += lost; kill ||= fell; } else { other += lost; wrong ||= fell; }
        }
        if (wrong || other > 0 || harm <= 0) continue;
        out.push({ act, kill, st, sc: (kill ? 1e6 : 0) + harm });
      }
      return out;
    }
    const bestReveal = (tries) => tries.reduce((b, x) => (!b || x.sc > b.sc ? x : b), null);
    // RIK R1, the exchange's eyes. Same victim only (R-20261105-04 decision 1): the victim is the foe the reveal is aimed at (an AI plan stores
    // no target, S3 departure 2, so the aim stands in for R-20261105-05's stored tile and no fifth seal reader is needed). The aimed try must
    // wound the victim without felling it, and leave the setter to act next with tempo left; then a cheap finisher must fell that same victim.
    // Observed outcomes only, answers settled "none" (decision 3). Null: no exchange, and the S3 rules decide alone.
    function exchangeReveal(s, a, tries) {
      for (const x of tries) {
        const v = x.act.target && actorAt(s, x.act.target[0], x.act.target[1]);
        if (!v || !setFoe(s, a, v) || x.st.actors[v.id]?.defeated || !(x.st.actors[v.id]?.lf < v.lf)) continue;
        if (exchangeFinisher(x.st, a, v.id)) return { ...x.act, why: "seizes the exchange", exchange: v.id };
      }
      return null;
    }
    // The finisher: the cheapest strike or non-ultimate ability that fells the victim (fewest PhiF, then fewest AP), with nobody the setter
    // does not fight hurt. No ultimate ever finishes an exchange (R1 decision 2) and the bar stays unspent (R-20261110-31). Null when none.
    function exchangeFinisher(s, a, victimId) {
      const me = s.actors[a.id], v = s.actors[victimId];
      if (!me || !v || v.defeated || decider(s)?.actor !== a.id || !(me.tempo > 0)) return null;
      let best = null;
      for (const f of candidates(s, a.id, false, false)) {
        if (f.type !== "strike" && f.type !== "ability") continue;
        if (f.type === "ability" && manifest(s, me, f.ability)?.tier === "ultimate") continue;
        const p = apply(s, f, { preview: true }); if (!p.ok) continue;
        const st = settleNone(p.state);
        if (!st.actors[victimId]?.defeated) continue;
        if (Object.values(s.actors).some((t) => !t.defeated && !setFoe(s, me, t) && t.id !== me.id && (st.actors[t.id]?.lf ?? t.lf) < t.lf)) continue;
        const after = st.actors[a.id] || me, cost = [me.pf - (after.pf ?? me.pf), me.tempo - (after.tempo ?? me.tempo)];
        if (!best || cost[0] < best.cost[0] || (cost[0] === best.cost[0] && cost[1] < best.cost[1])) best = { f, cost };
      }
      return best?.f || null;
    }
    function threatValue(s, a, cand, def) {
      const L = s.rules.aiLedger, frac = def && L?.cover?.[def.effect];
      if (!frac) return 0;
      const foes = Object.values(s.actors).filter((t) => H.Instinct.standing(t) && !H.Tourist?.is(t) && t.side !== a.side);
      if (!foes.length) return 0;
      if (s.modeSetup?.mode === "escape" && a.side === "enemy" && (s.modeSetup.guard?.tiles || []).length   // C12: a post-holder braces on its post, not on a chase
        && !(s.modeSetup.guard.tiles.some(([x, y]) => Math.abs(x - a.x) + Math.abs(y - a.y) <= INTERDICT.holdWithin))) return 0;
      let covered, range;
      if (!Array.isArray(cand.target) || def.target === "self") {
        if (["guard", "immovable", "anchor"].includes(def.effect) && (liveStatus(a, "guard") || liveStatus(a, "immovable") || liveStatus(a, "anchor") || liveStatus(a, "ward"))) return 0;   // net-new: already braced
        covered = [a]; range = L.threatRangeSelf;   // worn protection travels with you: any threatening foe counts
      } else {
        if (a.communed) return 0;   // leashed plants hold with their owner; they don't roam to build
        if ((s.barriers || []).some((b) => b.x === cand.target[0] && b.y === cand.target[1])) return 0;   // net-new: already built there
        if (def.effect === "barrier" && switchOn(s, a, "wallLine")) return wallValue(s, a, cand, foes, L);   // off until walls also count blocking a melee path (sims/pieces/ai-walls.mjs)
        const radius = def.area && def.area.shape !== "single" ? 2 : 1;
        covered = Object.values(s.actors).filter((t) => !t.defeated && t.side === a.side && dist(s, t.x, t.y, cand.target[0], cand.target[1]) <= radius);
        if (!covered.length) return 0;
        range = L.threatRangePlaced;   // placed cover must interpose: only near foes are blocked by it
      }
      const potency = s.rules.strike?.potency || 8;
      let v = 0;
      for (const t of covered) v += foes.filter((f) => dist(s, f.x, f.y, t.x, t.y) <= range).length * potency * L.hitChance * frac * L.perThreat;
      return Math.min(v, a.lf);   // protection is worth at most the protector's remaining life
    }
    // Walls (Mala, 2026-10-15): "walls should be used to block line of sight after they've already attacked". A placed
    // barrier stops line deliveries through its tile, so it is worth something only on the line from an opponent who
    // can see an ally now to that ally; and only once this unit has attacked this turn, or has nothing to attack with.
    function attackedThisTurn(s, a) {
      for (let i = s.log.length - 1; i >= 0; i--) { const e = s.log[i]; if (e.kind === "turn" && e.actor === a.id) return false; if (e.kind === "damage" && e.actor === a.id && e.amount > 0) return true; }
      return false;
    }
    const attackMemo = new WeakMap();
    function canAttackNow(s, a) {
      const memo = attackMemo.get(s); if (memo && memo.id === a.id && memo.tempo === a.tempo) return memo.can;
      const foeOn = ([x, y]) => { const t = actorAt(s, x, y); return t && !t.defeated && t.side !== a.side && !H.Tourist?.is(t); };
      const can = (a.tempo >= s.rules.actionCosts.strike && Object.values(s.actors).some((t) => foeOn([t.x, t.y]) && dist(s, a.x, a.y, t.x, t.y) <= H.strikeRange(s, a)))
        || availableAbilities(s, a.id).some((x) => x.affordable && x.m.effect === "damage" && x.m.tier !== "ultimate" && targeting(s, a.id, x.id).legal.some((l) => foeOn(l.at)));
      attackMemo.set(s, { id: a.id, tempo: a.tempo, can }); return can;
    }
    function wallValue(s, a, cand, foes, L) {
      if (!attackedThisTurn(s, a) && canAttackNow(s, a)) return 0;   // attack first, then wall up
      const [wx, wy] = cand.target, potency = s.rules.strike?.potency || 8;
      const between = (f, t) => H.line(f.x, f.y, t.x, t.y).slice(1, -1).some(([x, y]) => x === wx && y === wy);
      let v = 0;
      for (const t of Object.values(s.actors)) if (!t.defeated && t.side === a.side && (t.id === a.id || dist(s, t.x, t.y, wx, wy) <= L.threatRangePlaced))
        v += foes.filter((f) => dist(s, f.x, f.y, t.x, t.y) <= L.threatRangeSelf && H.hasSight(s, f.x, f.y, t.x, t.y) && between(f, t)).length * potency * L.hitChance * L.cover.barrier * L.perThreat;
      return Math.min(v, a.lf);
    }
    function infoValue(s, a, cand, pv, def) {
      const L = s.rules.aiLedger; if (!L || !def) return 0;
      const t = Array.isArray(cand.target) ? actorAt(s, cand.target[0], cand.target[1]) : null;
      if (!t || t.side === a.side || t.defeated) return 0;
      const hidden = H.Observation ? H.Observation.hidden(s, a, t.id, H.observationH()) : 0;
      if (def.newEffect && /observeOnHit/.test(def.newEffect)) {
        if (!(pv.deltas || []).some((d) => d.id === t.id && d.lf > 0)) return 0;   // the rider only lands on a hit
        return Math.min(L.infoCap, hidden * L.infoPerCard);
      }
      if (def.effect === "focus") {
        if (a.focus?.target === t.id && a.focus.expiresAt > a.ownerTurns) return 0;   // already marked
        const coverNear = (s.barriers || []).some((b) => Math.abs(b.x - t.x) + Math.abs(b.y - t.y) <= 1);
        return Math.min(L.infoCap, hidden * L.infoPerCard) + (coverNear ? L.focusCoverBonus : 0) + ((def.duration || 1) - 1) * (L.focusDurationBonus ?? 1);
      }
      if (def.effect === "annotate") {
        if (t.status?.annotated) return 0;   // already written down
        if (t.status?.membrane && !t.status.membrane.rushed) return 0;   // the filter holds: don't waste ink
        return Math.min(L.infoCap, hidden * L.infoPerCard) + 2;   // the mark also arms seal + burst riders
      }
      if (def.effect === "attention") {   // Undivided Attention: worth it in a duel, ruinous in a crowd
        if (liveStatus(a, "attention")) return 0;
        const foes = Object.values(s.actors).filter((u) => H.Instinct.standing(u) && !H.Tourist?.is(u) && u.side !== a.side).length;
        return Math.max(0, (L.attentionBase ?? 6) - (L.attentionCrowdCost ?? 3) * (foes - 1));
      }
      return 0;
    }
    // First owner turn, and the nearest foe is still outside Strike range. Walls lose to the closing walk.
    function cavalryClosing(s, a) {
      if (!hasTrait(a, "cavalry") || (a.ownerTurns || 0) !== 1) return false;
      let near = 99;
      for (const f of Object.values(s.actors)) if (f && !f.defeated && !H.Tourist?.is(f) && f.side !== a.side) near = Math.min(near, dist(s, a.x, a.y, f.x, f.y));
      return near > 1;
    }
    // Playfulness (Mala, 2026-10-14): tests himself against the strong. A playful attacker prefers foes
    // who fight — recent damage (+3), a big presence (+1.5 at 80+ maxLF) — and snubs foes who never strike
    // (supports and healers: -2.5 past round 2, -2 more for a foe whose battle is mending). Preference, never
    // veto: the damage still counts, and a lone healer still gets fought.
    const playfulTarget = (s, a, cand) => {
      if (!hasTrait(a, "playfulness") || !Array.isArray(cand.target)) return 0;
      const t = actorAt(s, cand.target[0], cand.target[1]);
      if (!t || t.side === a.side || t.defeated) return 0;
      let v = 0;
      if (Object.values(s.actors).some((u) => u.lastHit?.by === t.id && s.round - (u.lastHit.round ?? -99) <= 2)) v += 3;
      if ((t.maxLF || 0) >= 80) v += 1.5;
      if (s.round > 2 && !Object.values(s.actors).some((u) => u.lastHit?.by === t.id)) v -= 2.5;
      for (let i = Math.max(0, s.log.length - 600); i < s.log.length; i++) {
        const e = s.log[i];
        if (e.actor === t.id && (e.kind === "heal" || e.kind === "cornerAdvice") && (e.healed || e.amount || 0) > 0) { v -= 2; break; }
      }
      return Math.max(-3, v);
    };
    // Trait motives (Mala, 2026-10-15: "make fearful and courageous actually represent what they mean"; Muse's
    // TRAIT_MOTIVES.md). ai/utility.js maps traits to multipliers on what a unit wants (harm to the hero and to foes,
    // kills, its own health, allies' health, beasts hurt, knowledge, charge). Only the deviation from a neutral unit is
    // added, so a unit with no mapped trait scores exactly as before. rules.traitMotives = false turns it off (a sim arm).
    const MOTIVE = { kill: 12, scale: 1 };
    const motivesOf = (s, a) => (s.rules.traitMotives === false || !H.UtilityAI ? {} : H.UtilityAI.personalityFor([...((a.traitsOff || a.states) ? (a.traits || []).filter((t) => !H.States?.traitIgnored(a, typeof t === "string" ? t : t?.id)) : (a.traits || [])), ...(H.stateTraits?.(s, a) || [])]).weightMul);   // Cure: a peeled or unmasked restraint trait motivates nothing   // + state traits (the Tamer's fear and delusion)
    function motiveTerm(s, a, pv) {
      const m = motivesOf(s, a); if (!Object.keys(m).length) return 0;
      const dev = (k) => (m[k] ?? 1) - 1;
      let hero = 0, foes = 0, kills = 0, selfHurt = 0, allyHeal = 0, wild = 0;
      for (const d of pv.deltas || []) { const t = s.actors[d.id]; if (!t) continue;
        if (t.side !== a.side) { foes += d.lf; if (t.id === "player" || t.id === s.modeSetup?.hero) hero += d.lf; if (t.lf - d.lf <= 0 && d.lf > 0) kills++; }
        else if (t.id === a.id) selfHurt += Math.max(0, d.lf);
        else allyHeal += Math.max(0, -d.lf); }
      for (const d of pv.wildDeltas || []) wild += Math.max(0, d.lf);
      return MOTIVE.scale * (dev("heroHarm") * hero + dev("foeHarm") * foes + dev("kills") * kills * MOTIVE.kill
        - dev("selfHealth") * selfHurt + dev("allyHealth") * allyHeal + dev("wildHarm") * wild);
    }
    // Episodic curiosity (Muse-2 fringe #3a, Mala 2026-10-17): this battle's per-actor tech
    // counts. Unused techniques get a small bonus so the AI stops one-tricking; the bonus
    // decays to nothing after two tries, which is also the learning-progress gate (a dud
    // gets its two auditions, then no more flailing). Ult timing is its own tuned system.
    const curiousUses = (s, id) => {
      s.aiCurious = s.aiCurious || {};
      return s.aiCurious[id] = s.aiCurious[id] || {};
    };
    const curiousBonus = (s, id, cand) => {
      if (!switchOn(s, s.actors[id], "curiosity") || cand.type !== "ability" || ab(cand.ability)?.tier === "ultimate") return 0;
      const u = (s.aiCurious?.[id]?.[cand.ability]) || 0;
      return u === 0 ? 2 : u === 1 ? 0.75 : 0;
    };
    // Answer reserve (Claude, 2026-10-17; rules.aiLedger.reserve): ΦF was priced at a flat 0.3 a point, so a unit holding a
    // reactive answer spent itself below the answer's price on a small hit and then had nothing to catch the big one with.
    // A technique that drops it below its cheapest reactive answer, while a foe that can shoot at it stands in range, pays
    // `value`; an ultimate or a killing blow pays nothing (that is what the reserve was for).
    function reserveCost(s, a, cand, cost) {
      const R = ledgerOn(s, a, "reserve"); if (!R || !(cost > 0) || cand.type !== "ability" || ab(cand.ability)?.tier === "ultimate") return 0;
      let floor = Infinity;
      for (const x of availableAbilities(s, a.id)) if (ab(x.id)?.reactive && !ab(x.id)?.answer && x.id !== cand.ability) floor = Math.min(floor, x.m.cost);
      if (!isFinite(floor) || a.pf < floor || a.pf - cost >= floor) return 0;
      const range = R.range ?? 6, shooters = Object.values(s.actors).some((t) => !t.defeated && !H.Tourist?.is(t) && t.side !== a.side && dist(s, a.x, a.y, t.x, t.y) <= range && dist(s, a.x, a.y, t.x, t.y) >= (s.rules.reactiveDefense?.minRange ?? 2));
      if (!shooters) return 0;
      const tgt = cand.target && actorAt(s, cand.target[0], cand.target[1]);
      if (tgt && tgt.side !== a.side && tgt.lf <= (manifest(s, a, cand.ability, cand).potency || 0)) return 0;   // a kill is worth the reserve
      return R.value ?? 3;
    }
    // preview() with answers settled by the answer model (same shape, plus `hidden`).
    function previewAnswered(s, cand, AM) {
      const r = applyOpen(s, cand, AM);
      if (!r.ok) return { ok: false, error: r.error };
      const announced = r.state.phase === "response", { st, hidden, answered } = settleAnswers(r.state, s, AM);
      const deltas = Object.values(st.actors).filter((t) => s.actors[t.id]).map((t) => ({ id: t.id, name: t.name, lf: s.actors[t.id].lf - t.lf, pf: s.actors[t.id].pf - t.pf })).filter((d) => d.lf || d.pf);
      const wildDeltas = (st.wild || []).map((m) => { const b = (s.wild || []).find((x) => x.id === m.id); return b ? { id: m.id, name: m.name || m.kind, lf: (b.lf || 0) - (m.lf || 0) } : null; }).filter((d) => d && d.lf);
      // An answer is not free: what the defender pays for it (ΦF, action points owed, priced as it prices them itself) is
      // the attacker's gain. Level 3 without this leaned nowhere (sims/pieces/ai-answer-model.mjs).
      const RD = s.rules.reactiveDefense?.ai || {};
      let answerCost = 0;
      for (const t of Object.values(st.actors)) { const b = s.actors[t.id]; if (!b || !answered.has(t.id)) continue;   // technique answers only: a dodge or Guard is ordinary defence, priced where it always was (mirror level 2: crediting a dodge's 50 AP debt made every poke announced)
        const pf = Math.max(0, (b.pf || 0) - (t.pf || 0)), debt = Math.max(0, (t.tempoDebt || 0) - (b.tempoDebt || 0)), ap = Math.max(0, (b.tempo || 0) - (t.tempo || 0));
        if (pf || debt || ap) answerCost += pf * (RD.pfWeight ?? 0.3) + (debt + ap) * Math.max(RD.apWeight ?? 0.1, apWorth(s, b) * (RD.debtPain ?? 1)); }
      return { ok: true, deltas, wildDeltas, events: st.log.slice(s.log.length), announced, pending: r.state.pending, hidden, answerCost };
    }
    // Technique stances (Muse-2): the AI pays once-costs only — blood while healthy, else tomorrow's tempo.
    // No Inspiration, no Burned Bridge, no while-restrictions volunteered (v1; the player may swear any price).
    // Two guards against oath-spam stalling battles: blood only near full (it stops paying for itself fast),
    // and never a second tomorrow-debt while one is already owed (vowApTax stacks in the ledger).
    function vowTechPay(s, a, price) {
      const blood = a.lf >= a.maxLF * 0.85 ? ["bloodPrice"] : [];
      const spent = a.vowApTax > 0 ? [] : ["spentTomorrow"];
      if (price <= 1) return blood.length ? blood : spent.length ? spent : null;
      return blood.length && spent.length ? [...blood, ...spent] : null;
    }
    // Causal oath valuation: an oath scores only when it flips an outcome — a foe at exactly range+1 with sight,
    // a kill that +2 potency completes, or a ward of 8+ that piercing walks through. Damage techniques with a
    // positive range for potency/piercing; Far Shot separately checks a real reach change. rules.aiVowTech tunes gain/pain for sims.
    // Gains are computed once per candidate set from the already-manifested list; score() only prices the pain.
    function vowTechGains(s, a, foes, authored) {
      const damage = (authored || []).filter((x) => x.affordable && ab(x.id)?.target === "enemy" && ab(x.id)?.effect === "damage" && x.m.potency > 0);
      const guns = damage.filter((x) => x.m.delivery !== "routed" && x.m.range > 0);   // unchanged Heavy Hands / Piercing Oath scope
      const reachGuns = damage.filter(({ m }) => m.target !== "self" && (m.delivery === "routed" ? m.routeBudget > 0
        : m.range > 0 && (m.delivery === "line" || (m.delivery === "field" && m.area?.shape === "single"))));
      const marks = (foes || []).filter((t) => !t.notArrived && t.side !== "bystander");
      if ((!guns.length && !reachGuns.length) || !marks.length) return null;
      const out = { farShot: 0, heavyHands: 0, piercingOath: 0 };
      for (const { m } of reachGuns) for (const f of marks) {
        const reach = m.delivery === "routed" ? m.routeBudget : m.range, d = dist(s, a.x, a.y, f.x, f.y);
        if (d > reach + 1 || (m.delivery !== "routed" && d <= reach)) continue;   // keep the existing printed-range horizon
        const extended = m.delivery === "routed" ? { ...m, routeBudget: m.routeBudget + 1 } : { ...m, range: m.range + 1 };
        if (target(s, a, m, f.x, f.y).ok) continue;
        const reached = target(s, a, extended, f.x, f.y);
        if (reached.ok && reached.tiles.some(([x,y]) => H.coversTile(f,x,y)))
          out.farShot = Math.max(out.farShot, Math.min(m.potency, f.lf) * 0.9 + (f.lf <= m.potency ? MOTIVE.kill : 0));
      }
      for (const x of guns) { const m = x.m;
        for (const f of marks) {
          const d = dist(s, a.x, a.y, f.x, f.y);
          if (!H.hasSight(s, a.x, a.y, f.x, f.y)) continue;
          if (d <= m.range) {
            const short = f.lf - m.potency;
            if (short > 0 && short <= 2) out.heavyHands = Math.max(out.heavyHands, MOTIVE.kill);
            const ward = f.status?.ward?.protection || 0;
            if (ward >= 8) out.piercingOath = Math.max(out.piercingOath, Math.min(ward, m.potency) * 0.9);
          }
        }
      }
      return out;
    }
    function vowTechScore(s, a, cand) {
      const R = s.rules, W = R.aiVowTech || {};
      if (!Vows || Vows.validate("technique", cand.vow, a, R.inspiration)) return -1;
      if (Vows.live(s, a).some((v) => v.on === "technique" && v.boon === cand.vow.boon)) return -1;
      const apW = R.ai?.apWeight ?? 0.1;
      const pain = (cand.vow.restrictions || []).reduce((n, id) => n + (id === "bloodPrice" ? Math.round(a.maxLF * 0.15) * (W.bloodWeight ?? 0.5)
        : id === "spentTomorrow" ? 30 * apW : 6), 0) + (cand.vow.inspiration || 0) * 6;
      return (cand.vowGain ?? 0) * (W.gainMul ?? 1) - pain * (W.painMul ?? 1);
    }
    // Kill-beats-all (Mala, 2026-10-19): a candidate that removes a foe from the fight outranks
    // anything short of another removal (+12), and a fight-ending kill outranks everything (+25):
    // the setTheScene precedent, generalized to the generic path and the class-kit gate. Victory,
    // not taste, so it stacks on top of motiveTerm and even a reluctant killer takes the winning
    // blow. Modes with an alternate path to victory narrow it: survive never ends by killing (12
    // only), assassinate pays 25 only for the last living mark. The foe set is the AI's own (the
    // line-618 filter): parley partners, truces, civilians and wilds are not foe kills, and
    // not-yet-arrived enemies still hold the 25 back. Mind-duel and parley-turn candidates deal no
    // damage, so the bonus is unreachable there by construction. dealMul prices the blow the way
    // the caller does (an answered blow halves, a hidden share holds back): the bonus is only for
    // kills the caller already believes in. Contact maneuvers (throw, grapple) and delayed arrival
    // strikes are not covered: their damage rarely kills and no preview prices it here.
    function killBeatsAll(s, a, pv, dealMul) {
      const foeOf = (t) => H.Instinct.standing(t) && !H.Tourist?.is(t) && t.side !== a.side && H.PostHuman.atWar(s, a, t) && H.Civilian.atWar(s, a, t) && (H.Visitors?.atWar(s, a, t) ?? true) && !(a.truceWith === t.id && a.truceUntil >= s.round) && !(Parley && Parley.blocks(s, a, t));
      const foes = Object.values(s.actors).filter(foeOf), foeIds = new Set(foes.map((t) => t.id));
      if (!foeIds.size) return 0;
      const dealt = new Map();
      for (const d of pv.deltas || []) { const t = s.actors[d.id]; if (!t || !foeIds.has(d.id)) continue;
        dealt.set(d.id, (dealt.get(d.id) || 0) + Math.max(0, d.lf) * (dealMul ? dealMul(d, t) : 1)); }
      const killed = [...dealt.keys()].filter((id) => s.actors[id].lf - dealt.get(id) <= 0);
      if (!killed.length) return 0;
      const aliveAfter = (id) => s.actors[id].lf - (dealt.get(id) || 0) > 0;
      const mode = s.modeSetup?.mode || "classic", marks = s.modeSetup?.targets || [];
      if (mode === "assassinate" && marks.length && killed.some((id) => marks.includes(id)) && !marks.some((id) => foeIds.has(id) && aliveAfter(id))) return 25;
      if (mode !== "assassinate" && mode !== "survive" && foes.every((t) => !aliveAfter(t.id))) return 25;
      return 12;
    }
    // Declared Terms (Tallyman's Offer): beforeAbility lands the breach penalty BEFORE the commit
    // check and previews skip that check, so the AI must price the breach itself (the silenced
    // precedent in candidates): the stun eats 20 off the active turn and the penalty LF lands on
    // the breacher. Without this a breaching act prices fine and is refused for real (freemason
    // seed 20: Runaway Mass 32 at tempo 50 → stunned to 30 → needs 32). Null when terms are kept.
    function breachPrice(s, a, m) {
      const live = (x) => x && (x.until == null || x.until >= a.ownerTurns), law = a.status?.contract;
      if (!live(law) || live(a.status?.exempt)) return null;
      const breach = (law.terms === "noUltimate" && m.tier === "ultimate") || (law.terms === "noLine" && m.delivery === "line");
      if (!breach) return null;
      return { ap: decider(s)?.actor === a.id && s.phase === "action" ? 20 : 0, lf: law.penalty || 0 };
    }
    function focusActive(s, u) {
      return u && !u.defeated && !u.notArrived && (u.ritual || u.rite || u.status?.heldTones || s.dreamSpace?.owner === u.id);
    }
    function concentrationValue(s, a, cand) {
      const W = s.rules.concentrationAI || {};
      if (W.enabled === false || !a || !Object.values(s.actors).some(u => focusActive(s, u))) return 0;
      const traitsFor = u => {
        if (u.id === a.id) return u.traits || [];
        const deck = s.insight?.decks?.[u.id], known = H.Observation.knowledge(s, a)[u.id];
        const ids = new Set((deck?.cards || []).filter(c => known?.revealed?.includes(c.id)).map(c => c.trait || c.id));
        return (u.traits || []).filter(t => { const id = typeof t === "string" ? t : t?.id;
          return H.insightRules?.data?.traits?.[id]?.open || ids.has(id) || ids.has(`trait:${id}`); });
      };
      const weight = (u, ch) => ch === "rite" ? Math.min(12, (u.rite?.steps?.length || 1) * (W.riteStep ?? 3)) : W[ch] ?? ({ritual:8,tones:6,dream:10}[ch] || 0);
      function risk(before, after, events, only) {
        let total = 0;
        for (const u of Object.values(before.actors)) {
          if (!focusActive(before, u) || (only && u.id !== only) || !after.actors[u.id] || after.actors[u.id].lf <= 0) continue;
          const survival = {}, traits = traitsFor(u); let lf = u.lf;
          for (const e of events) {
            if (e.kind !== "damage" || e.target !== u.id) continue;
            const lost = Math.max(0, e.lfLost ?? Math.min(lf, e.amount || 0)); lf -= lost;
            const p = H.concentrationProfile(before, u, lost, {traits, afterLF:lf});
            for (const ch of p.channels) survival[ch] = (survival[ch] ?? 1) * p.holdChance;
          }
          const value = Object.entries(survival).reduce((n,[ch,p]) => n + (1-p)*weight(u,ch),0);
          total += value * (u.side === a.side ? -1 : u.side === "bystander" ? 0 : 1);
        }
        return total;
      }
      function project(state,action) {
        let out=apply(state,action,{preview:true});
        for(let n=0;out.ok && out.state.phase==="response" && n<6;n++)out=apply(out.state,{type:"respond",actor:H.decider(out.state).actor,response:"none"},{preview:true});
        return out;
      }
      const out = project(s, cand); if (!out.ok || out.state.phase==="response") return 0;
      let value = risk(s,out.state,out.state.log.slice(s.log.length));
      // Compare legal immediate basic attacks, after mitigation, before/after a defensive action.
      if (["guard","move","ability"].includes(cand.type)) {
        const protectedIds=new Set(Object.values(s.actors).filter(u=>focusActive(s,u)&&focusActive(out.state,out.state.actors[u.id])).map(u=>u.id));
        function exposure(state) {
          let n = 0;
          for (const u of Object.values(state.actors)) {
            if (u.side !== a.side || !protectedIds.has(u.id) || !focusActive(state,u)) continue;
            let worst = 0;
            for (const foe of Object.values(state.actors)) {
              if (foe.side === a.side || foe.side === "bystander" || foe.defeated || foe.notArrived) continue;
              if (dist(state,foe.x,foe.y,u.x,u.y) > (H.strikeRange?.(state,foe) ?? 1)) continue;
              const probe = structuredClone(state); probe.turnIndex=probe.order.indexOf(foe.id); probe.phase="action"; probe.actors[foe.id].tempo=Math.max(foe.tempoCapacity || 0,foe.tempo || 0);
              const hit=project(probe,{type:"strike",actor:foe.id,target:[u.x,u.y]});
              if(hit.ok) worst=Math.max(worst,-risk(probe,hit.state,hit.state.log.slice(probe.log.length),u.id));
            }
            n+=worst;
          }
          return n;
        }
        value += (exposure(s)-exposure(out.state))*(W.protect ?? 0.7);
      }
      const cap=W.cap ?? 16; return Math.max(-cap,Math.min(cap,value));
    }
    function scribedComponentValue(s,a,cand,pv){
      if(cand.type!=="ability"||!ab(cand.ability)?.scribedEffects)return 0;
      let value=0;const seen=new Set();
      for(const e of pv.events||[]){if(e.kind!=="scribedEffect"||seen.has(e.target+e.component))continue;seen.add(e.target+e.component);const t=s.actors[e.target];if(!t)continue;
        if(e.component==="root"&&!(t.status.rooted?.expiresAt>t.ownerTurns))value+=8;
        if(e.component==="itemLock"&&t.inventory?.length&&!(t.status.scribedItemLock?.expiresAt>t.ownerTurns))value+=4;
        if(e.component==="reveal"&&t.status.concealed)value+=5;
        if(e.component==="ward"&&!t.status.ward)value+=5;
        if(e.component==="adaptResistance"&&!t.status.guard)value+=5;
      }return value;
    }
    function score(s, id, cand) {
      const a=s.actors[id];
      if(ClassRuntime?.aiVeto?.(s,a,cand) || (cand.type==="ability" && a.status?.overpressure && !ClassRuntime?.wire?.[cand.ability]?.relief))return 0;
      let base=rawScore(s,id,cand);
      if (base >= 0 && animeKitOption(a, cand)) { const floor = observeFloor(s, a); if (floor > base) base = traceAiTerm("animeKitFloor", floor); }   // docs/anime-orbit.md §5a: at least Observe
      return base < 0 ? traceAiTerm("negativeRawScore", base) : traceAiTerm("rawScore", base) + traceAiTerm("concentration", concentrationValue(s,s.actors[id],cand)) + traceAiTerm("court", H.courtScore?.(s, id, cand) || 0) + traceAiTerm("spirit", Spirit()?.value(s, s.actors[id], cand, cand.ability ? ab(cand.ability) : null, { actorAt }) || 0) + traceAiTerm("orders", Orders()?.orderValue(s, s.actors[id], cand, cand.ability ? ab(cand.ability) : null, H) || 0) + traceAiTerm("keen", sightKeen(s, s.actors[id], cand));
    }
    // The anime kit floor (Mala, 2026-10-27: "they should be scored pretty high, at least up there with Observe, because at
    // the end of the day, they can change the tile or the tide of battle"). Keyed to the kind of option, not the character:
    // a soul verb or art, a Sinkerfruit technique, or a Bird Mountain technique, for anyone who carries them.
    function animeKitOption(a, cand) {
      if (cand.type !== "ability" || !cand.ability || a.orbitKit?.id === "choir") return false;   // the boss's Choir scores as before (Mala, 2026-10-28: undo the floor there)
      const id = cand.ability;
      return (a.passives?.soulArtIds || []).includes(id) || (H.fruitKitOf?.(a) || []).includes(id) || (H.C.concepts.bird_mountain?.abilities || []).includes(id);
    }
    function observeFloor(s, a) {
      const R = s.rules.aiLedger?.animeKitFloor; if (R === false || R == null) return 0;   // a number: the standing floor when Observe is not on offer here
      const opts = obsMemo && obsMemo.s === s && obsMemo.id === a.id ? obsMemo.opts : H.Observation?.options(s, a, H.observationH()) || [];
      return opts.reduce((n, o) => Math.max(n, o.value || 0), R);
    }
    // The trait-drive ledger (hotbuilds W0d; generalises Fruitbound): a carrier of a listed trait scores each listed
    // technique above cost when the named context checks hold. Checks resolve at call time (parts install in any
    // order): generic ones here, per-trait ones on H from their part (fruitTraitChecks). An unknown check fails safe
    // (no bonus); the trait-drive tests pin every table name to a check.
    const foeNearHere = (s, a, r) => Object.values(s.actors).some((u) => !u.defeated && !u.notArrived && !H.Tourist?.is?.(u) && u.side !== a.side && u.side !== "bystander" && dist(s, a.x, a.y, u.x, u.y) <= r);   // the AI's own idea of a foe (ai.js foesLeft)
    // Generic drive checks (hotbuilds W1b; the Entrainer table's `when` names): no live Fixed foe; the Fixed foe
    // holds a line or ranged technique (range 2+ is what a reaction answers); no ward the damage path would read.
    const noneFixedHere = (s, a) => !H.fixedFoe?.(s, a);
    const fixedFoeRangedHere = (s, a) => {
      const f = s.actors?.[H.fixedFoe?.(s, a)];
      if (!f) return false;
      const ids = H.abilitiesOf ? H.abilitiesOf(f) : (f.learned || []);
      return (ids || []).some((id) => { const d = (H.ab || ab)?.(id); return !!d && (d.delivery === "line" || (typeof d.range === "number" && d.range >= 2)); });
    };
    const noWardHere = (s, a) => !((a.status?.ward?.protection || 0) > 0);   // mirrors damage.js: a ward reads while it has protection
    const foesInSightHere = (s, a, n) => Object.values(s.actors).filter((u) => !u.defeated && !u.notArrived && !H.Tourist?.is?.(u) && u.side !== a.side && u.side !== "bystander" && H.hasSight?.(s, a.x, a.y, u.x, u.y)).length >= (n || 2);   // W1c: Second Gaze wants two foes showing themselves
    const driveChecks = { foeNear: foeNearHere, noneFixed: noneFixedHere, fixedFoeRanged: fixedFoeRangedHere, noWard: noWardHere, foesInSight: foesInSightHere };
    function driveWhenHolds(checks, s, a, cand, when) {
      if (when === undefined || when === null) return true;
      // A bare ["name", x] with non-string x is one tuple; any other array is a list of atoms (tuple args are never bare strings).
      if (typeof when !== "string" && !Array.isArray(when)) return false;   // malformed: fail safe, never throw in the scorer
      const list = typeof when === "string" ? [when] : (when.length === 2 && typeof when[0] === "string" && (typeof when[1] !== "string" && !Array.isArray(when[1])) ? [when] : when);
      return list.every((atom) => {
        if (typeof atom === "string") return !!checks[atom]?.(s, a, undefined, cand);
        if (!Array.isArray(atom) || typeof atom[0] !== "string") return false;
        return !!checks[atom[0]]?.(s, a, atom[1], cand);
      });
    }
    function traitDriveBonus(s, a, cand) {
      const R = s.rules.aiLedger?.traitDrive; if (!R?.on || cand?.type !== "ability" || !cand.ability) return 0;
      const checks = { ...driveChecks, ...(H.fruitTraitChecks || {}) };
      let total = 0;
      for (const [trait, table] of Object.entries(R)) {
        if (trait === "on" || !table || typeof table !== "object") continue;
        if (!H.hasTrait?.(a, trait)) continue;
        if (!driveWhenHolds(checks, s, a, cand, table.when)) continue;
        const entry = table[cand.ability];
        if (!entry || typeof entry.bonus !== "number") continue;
        if (!driveWhenHolds(checks, s, a, cand, entry.when)) continue;
        total += entry.bonus;
      }
      return total;
    }
    function rawScore(s, id, cand) {
      if(cand.type==="recoverWater")return H.waterRecovery(s,s.actors[id])?.allowed ? 18 : -1;

      const a = s.actors[id];
      { const v = H.States?.aiValue(s, a, cand); if (v != null) return v; }   // States: an ability's def.states.ai (a Remind is worth a lot)
      if(cand.type==="contractSpeak"||cand.type==="contractPrepare")return apply(s,cand,{preview:true}).ok?Math.min(16,4+(ab(cand.ability).potency||ab(cand.ability).protection||0)*.3):-1;
      if (ClassRuntime?.aiVeto?.(s, a, cand)) return 0;   // Esker never aims at its own ward while the line holds (classes/esker.js)
      if (cand.type === "ability" && a.status?.overpressure && !ClassRuntime?.wire?.[cand.ability]?.relief) return 0;   // overpressure: vent (a relief wire) or nothing — Strike and moves still score, mirroring the beforeAbility guard
      if (["observe","observePlace","observePlant","observeStructure","commune","communeStructure"].includes(cand.type)||cand.observationGoal) {
        const firstFor = (t) => (t === "commune" && communeFirstFor(s, a, cand.object)) || (t === "communeStructure" && awakenFirstFor(s, a, cand.object));
        const ot = cand.type === "observe" && cand.target ? s.actors[cand.target] : null;   // Mystery half-1: Observe rips the observed unit's ONE oldest set plan, so a foe holding any face-down card is worth studying once. Counts only, never contents; allies' cards are not; only a unit already inclined to Observe (value > 0: trait or necessity) adds it
        const ripOf = (v) => (v > 0 && ot && ot.side !== a.side && (H.mysteryUnitCount?.(s, ot.id) || 0) > 0 ? (s.rules.mystery?.ai?.ripPerCard ?? 0) : 0);
        if (obsMemo && obsMemo.s === s && obsMemo.id === id) { const v = obsMemo.opts.find((o) => plainAction(o.action) === plainAction(cand))?.value ?? 0; return (firstFor(cand.type) ? Math.max(v, COMMUNE_FIRST) : v) + ripOf(v); }
        const v = H.Observation.value(s,a,cand,H.observationH());
        return (firstFor(cand.type) ? Math.max(v, COMMUNE_FIRST) : v) + ripOf(v);
      }
      if (cand.type === "setIntent") {   // Mystery S1 + S2: a delayed blow — the attack's value at the likeliest attacker (the nearest foe in the trigger outlook), discounted for the wait. On the damage scale (ΦF ×0.3), so casting now wins when it can. S2: an on-turn-start set waits longer (setPatienceMul), and a brave setter commits a full bar (braveUltSet). No watcher discount: a live rip holds the plan (Mystery.js hold), so no loss is priced.
        const MR = s.rules.mystery?.ai; if (!MR || (cand.trigger !== "on-attacked" && cand.trigger !== "on-turn-start" && cand.trigger !== "manual")) return 0;
        const m = manifest(s, a, cand.ability, {}); if (!m || m.effect !== "damage" || !(m.potency > 0)) return 0;   // manifest opts mirror the set call's
        const victim = setOutlook(s, a)[0]; if (!victim) return 0;
        const patient = cand.trigger === "on-turn-start", held = cand.trigger === "manual", pm = MR.setPatienceMul ?? 0.6;
        const wait = held ? pm * pm : patient ? pm : (MR.setWaitMul ?? 0.7);   // S3: a held plan fires at the latest one round before it fades (salvage), two round starts out, so it waits two patience ticks; that keeps it below the patient set whenever both are open
        return Math.min(m.potency, victim.lf) * wait - m.cost * 0.3 + (patient && m.tier === "ultimate" && H.hasTrait?.(a, "brave") ? (MR.braveUltSet ?? 2) : 0);   // no kill bonus, even when the blow would be lethal: the bonus is for kills the caller already believes in, and a delayed strike is not covered (kill-beats-all below, Mala 2026-10-19). A kill on the table now (a cast, or the oath that opens one) must outrank a counter that waits on the foe's choice.
      }
      { const o = cand.type === "strike" && cand.target && anchorsOf(s, a).find((p) => p.x === cand.target[0] && p.y === cand.target[1]);
        if (o) { const after = apply(s, cand, { preview: true }); if (!after.ok) return -1;   // a tower's anchor: its HP lost, and the tower if it falls
          const left = (after.state.arena.objects || []).find((p) => p.id === o.id)?.hp ?? 0; return (o.hp - left) * 0.8 + (left <= 0 ? s.rules.droneTowers.potency * 2 : 0); } }
      // The Director's Set the Scene is a one-on-one film with a full-health opponent: in his eyes it is a potential kill, so it
      // prices under the kill-beats-all rule (Mala, 2026-10-19): the last foe standing is the fight's end (25), any other a removal (12).
      if (cand.type === "ability" && cand.ability === "setTheScene") {
        const foesLeft = Object.values(s.actors).filter((t) => !t.defeated && !t.notArrived && !H.Tourist?.is(t) && t.side !== a.side && t.side !== "bystander").length;
        return (foesLeft <= 1 ? 25 : MOTIVE.kill) * MOTIVE.scale;
      }
      if (cand.type === "sueForRestitution") return H.houseValue(s, a, cand);
      if (cand.type === "buyHouse" || cand.type === "investHouse") return H.houseValue(s, a, cand) * (Spirit()?.greedMul?.(s, a) ?? 1);   // SP-02: economy bids ~zero unless the conductor allows admin work
      if (cand.type === "myol") return H.aiMyolValue ? H.aiMyolValue(s, a) : -1;   // W5.1: only buys what flips
      let foundBonus = 0;   // Orbital Drop: the landing scores here, the line through the general preview below
      if (cand.type === "ability" && ["raisePalisade", "raiseFoundry", "foundCity", "orbitalDrop"].includes(ab(cand.ability)?.effect)) {   // Settlement: found where the line holds (Mala, 2026-10-19)
        const [tx, ty] = cand.target || [];
        if (tx == null) return 0;
        const allies = Object.values(s.actors).filter((u) => !u.defeated && u.side === a.side);   // the founder shelters behind their own wall too
        const foeNear = (u, r) => Object.values(s.actors).some((e) => !e.defeated && e.side !== a.side && e.side !== "bystander" && dist(s, e.x, e.y, u.x, u.y) <= r);
        const eff = ab(cand.ability).effect;
        const atCap = (s.arena.objects || []).filter((o) => o.building && o.owner === a.id).length >= 2 ? 0.5 : 1;   // a third founding dismantles the oldest
        if (eff === "raisePalisade") {
          const guarded = allies.filter((u) => Math.max(Math.abs(u.x - tx), Math.abs(u.y - ty)) === 1 && foeNear(u, 5));
          return guarded.length ? (6 + guarded.length * 2) * atCap : 0;
        }
        if (eff === "raiseFoundry") {
          const armed = allies.filter((u) => dist(s, u.x, u.y, tx, ty) <= 2 && foeNear(u, 6));
          return armed.length ? (2 + armed.length * 3) * atCap : 0;
        }
        const held = allies.filter((u) => Math.max(Math.abs(u.x - tx), Math.abs(u.y - ty)) === 1);
        const missing = held.reduce((n, u) => n + Math.min(8, Math.max(0, u.maxLF - u.lf)), 0);
        const keepValue = ((held.length && held.some((u) => foeNear(u, 5)) ? 8 + held.length * 2 : 0) + missing * 0.5) * atCap;
        if (eff === "orbitalDrop") foundBonus = keepValue;   // no return: the burn prices with every other line
        else return keepValue;
      }
      { const foeBld = cand.target && (s.arena.objects || []).find((o) => o.building && o.side !== a.side && (o.hp ?? 0) > 0 && o.x === cand.target[0] && o.y === cand.target[1]);
        if (foeBld && (cand.type === "strike" || cand.type === "ability")) {   // break their works: what the building loses, and the aura with it
          const after = apply(s, cand, { preview: true }); if (!after.ok) return -1;
          const left = (after.state.arena.objects || []).find((p) => p.id === foeBld.id)?.hp ?? 0;
          const dmg = foeBld.hp - left; if (dmg > 0) {
            const orgoniteBonus = foeBld.type === "orgonite" && ((s.unlockedSummons || []).length || H.C?.characters?.[a.character]?.dreamer) ? 20 : 0;
            return dmg * 0.8 + (left <= 0 ? 10 : 0) + orgoniteBonus;
          } } }
      if (cand.type === "tameBeast" || cand.type === "markVessel" || cand.type === "callPack") return H.tamerValue(s, a, cand);
      if (cand.type === "communeIngredient") return totemWakeScore(s, a, cand);   // need only: 0 when no ally needs what the totem gives
      if (cand.type === "catchFish") { const R = s.rules.fish, room = s.rules.ultimateChargeMax - (a.ultimateCharge ?? 0), near = Object.values(s.actors).some((u) => !u.defeated && u.side !== a.side && u.side !== "civilian" && u.side !== "bystander" && Math.abs(u.x - a.x) + Math.abs(u.y - a.y) <= 3);
        return near ? 0 : Math.min(R.ultCharge, room) * (R.aiValuePer ?? 0.2) * (Spirit()?.greedMul?.(s, a) ?? 1); }   // 20 charge ≈ 4: worth a quiet turn, never worth turning your back on a foe; SP-02: ~zero while conducted
      if (cand.type === "vow" && cand.target === "word") return s.rules.ramaWord?.aiValue ?? 14;   // a whole battle of +3: worth more than one swing
      if (cand.type === "vow" && cand.target === "technique") return vowTechScore(s, a, cand);
      { const o = cand.type === "strike" && cand.target && H.house(s); if (o && o.x === cand.target[0] && o.y === cand.target[1]) {   // the other side's house: what it loses, and the bank with it
          const after = apply(s, cand, { preview: true }); if (!after.ok) return -1;
          const left = (after.state.arena.objects || []).find((p) => p.id === o.id && p.type === "house")?.hp ?? 0;
          return H.houseBreakValue(s, a, o, o.hp - left, left <= 0); } }
      { const o = strikesCenter(s, a, cand);   // damage to the building counts for more than the same damage to a body; the blow that fells it also costs the AGI
        if (o) { const R = s.rules.dataCenter, after = apply(s, cand, { preview: true }); if (!after.ok) return -1;
          const left = (after.state.arena.objects || []).find((p) => p.id === o.id)?.hp ?? 0; return (o.hp - left) * R.aggro + (left <= 0 ? R.fall.lf : 0); } }
      if (cand.type === "dreamSpace") {   // a Dreamer opens the dream when the ultimate has nothing worth hitting
        const R = s.rules.dreamer; if (!R || !dreamerCan(s, a)) return 0;
        const ults = candidates(s, id, false, false).filter((c) => c.type === "ability" && ab(c.ability)?.tier === "ultimate");
        const best = ults.reduce((m, c) => Math.max(m, score(s, id, c)), -Infinity);
        return best >= R.ultBelow ? 0 : R.value;
      }
      if (cand.type === "monsterSummon" && a.boss === "kaiju") return s.rules.brood?.aiScore ?? 20;   // the Kaiju's call: above a single blow, so a fallen mite is replaced while the brood lasts
      if (cand.type === "monsterSummon") return 8 + 2 * (a.beliefStrength || 1);   // a permanent ally beats preparations; stronger belief calls stronger monsters
      if (cand.type === "summon") {   // a palace summon buys whole extra turns: price above any single attack, below a cleanup (Mala, 2026-10-19)
        const foes = Object.values(s.actors).filter((t) => H.Instinct.standing(t) && !t.notArrived && !H.Tourist?.is(t) && t.side !== a.side && t.side !== "bystander");
        if (foes.length === 0 || foes.reduce((n, t) => n + t.lf, 0) <= 12) return 4;
        const friends = Object.values(s.actors).filter((t) => !t.defeated && !t.notArrived && t.side === a.side).length;
        const turns = summonRules?.data?.rules?.baseDuration ?? 3;
        return (30 + 6 * turns + (foes.length > friends ? 10 : 0)) * MOTIVE.scale;
      }
      if (cand.type === "callDream") {   // D2: a called dream buys whole extra turns too (same slot, same purpose): the summon pricing, over the dream's own duration. Kept a separate branch so the tuned palace lines above stay byte-identical.
        const foes = Object.values(s.actors).filter((t) => H.Instinct.standing(t) && !t.notArrived && !H.Tourist?.is(t) && t.side !== a.side && t.side !== "bystander");
        if (foes.length === 0 || foes.reduce((n, t) => n + t.lf, 0) <= 12) return 4;
        const friends = Object.values(s.actors).filter((t) => !t.defeated && !t.notArrived && t.side === a.side).length;
        const turns = s.rules.enemySummons?.turns ?? 3;
        return (30 + 6 * turns + (foes.length > friends ? 10 : 0)) * MOTIVE.scale;
      }
      if (cand.type === "aura") return Auras ? (Auras.aiValue(s, a, auraH()) ?? 0) * (s.rules.aiAuraMul ?? 1.8) : 0;   // Auras (rules.aiAuraMul: a sim arm, 2026-10-15)
      if (cand.type === "ability" && ab(cand.ability)?.effect === "craftHone") return a.lastTechnique && ab(a.lastTechnique).potency > 0 && !a.practice ? 5 : 0;   // Craftsmanship: worth starting once, on a technique that hits
      if (cand.type === "ability" && ab(cand.ability)?.effect === "craftCare") return 0;   // the AI does not plan two-step turns; care is left to the player
      if(cand.type==="ability" && ab(cand.ability)?.effect?.startsWith("archivist")) {
        const m=manifest(s,a,cand.ability),target=cand.target && actorAt(s,...cand.target);
        const knowledge=s.insight.knowledge[a.side==="player" ? "player" : a.id] || {};
        const hidden=u=>s.insight.decks[u.id]?.cards.some(c=>!c.open&&!knowledge[u.id]?.revealed?.includes(c.id));
        if(m.effect==="archivistIndex")return target&&hidden(target)?5:0;
        if(m.effect==="archivistArchive"){const R=ab(cand.ability)?.area?.radius??3,give=ab(cand.ability)?.allyCharge||0,max=s.rules.ultimateChargeMax||100;
          const info=Object.values(s.actors).filter(u=>!u.defeated && !H.Tourist?.is(u)&&u.side!==a.side&&dist(s,a.x,a.y,u.x,u.y)<=R&&hidden(u)).length*8;   // least-used: an ultimate's info must clear the damage bar
          const charge=give?Object.values(s.actors).filter(u=>!u.defeated&&u.side===a.side&&u.id!==a.id&&dist(s,a.x,a.y,u.x,u.y)<=R).reduce((v,u)=>{const got=Math.min(give,max-(u.ultimateCharge||0));return v+got*0.25+((u.ultimateCharge||0)+got>=max&&got>0?6:0);},0):0;   // Jambavan's council: charge handed to allies
          return info+charge;}
        if(m.effect==="archivistHeal")return target?Math.min(m.potency,target.maxLF-target.lf)*(target.lf<target.maxLF*.45 ? 2 : .8):0;
        if(m.effect==="archivistWard")return target&&!target.status.ward?4:0;
        if(m.effect==="archivistShelter")return Object.values(s.actors).filter(u=>!u.defeated && !H.Tourist?.is(u)&&u.side===a.side&&dist(s,a.x,a.y,u.x,u.y)<=3).reduce((n,u)=>n+Math.min(16,u.maxLF-u.lf)*.8+(!u.status.ward?3:0),0);
      }
      if (cand.type === "ability" && ["holdTone", "verseDamage", "chordSustain"].includes(ab(cand.ability)?.effect)) {   // Solfeggio: bank early, verse the bank, chord the siege
        const T = H.C.concepts.solfeggio.tones, held = a.status.heldTones?.count || 0;
        const near = (side) => Object.values(s.actors).filter((u) => !u.defeated && !H.Tourist?.is(u) && (side === a.side ? u.side === a.side : u.side !== a.side) && dist(s, a.x, a.y, u.x, u.y) <= 3);
        if (ab(cand.ability).effect === "holdTone") {
          if (held >= T.verseMax) return 0;
          return Math.min(6, near(a.side).reduce((n, u) => n + Math.min(T.toneHeal * 2, u.maxLF - u.lf), 0) * 0.5) + 2;   // two turns of knitting + a banked verse
        }
        if (ab(cand.ability).effect === "chordSustain")
          return near(a.side).reduce((n, u) => n + Math.min(T.chordHeal * 2, u.maxLF - u.lf) * 0.8, 0) + near("foe").length * T.chordHurt * 2 * 0.8;
        const target = cand.target && actorAt(s, cand.target[0], cand.target[1]);   // verseDamage
        if (!target) return 0;
        const dmg = 7 + Math.min(T.verseBonusMax, held * T.verseBonus);
        return Math.min(dmg, target.lf) * (target.lf <= dmg ? 2 : 0.9) + (held === 0 ? -2 : 0);   // a bankless verse is a weak refined
      }
      if (cand.type === "ability" && ["survey", "verify", "eureka"].includes(ab(cand.ability)?.effect)) {   // Discovery: survey the hidden, verify the rumor, eureka the room
        const F = H.C.concepts.discovery.finds;
        const veiled = (u) => !!u && !u.defeated && u.side !== a.side && !!u.status?.concealed && (u.status.concealed.until == null || u.status.concealed.until >= u.ownerTurns);
        const strange = (t) => !t.spent && t.ownerSide !== a.side && !(a.trapSeen?.[`${t.x},${t.y}:${t.ownerSide || "?"}`]) && t.hidden >= 0.4;
        const eff = ab(cand.ability).effect;
        if (eff === "survey") {   // one rumor at a time: verify the live one before planting another
          if ((s.rumors || []).some((r) => r.ownerSide === a.side && r.expiresRound > s.round)) return 0;
          const near = (t) => dist(s, a.x, a.y, t.x, t.y) <= 2;   // a trap at your feet is its full potency avoided, and beats a routine strike (7); a far one is suspicion that can wait
          return (s.traps || []).filter((t) => strange(t) && dist(s, a.x, a.y, t.x, t.y) <= F.surveyRange).reduce((n, t) => n + (near(t) ? (t.potency || 8) : 4), 0)
            + Object.values(s.actors).filter((u) => veiled(u) && dist(s, a.x, a.y, u.x, u.y) <= F.surveyRange).length * 5;
        }
        if (eff === "verify") {
          const [tx, ty] = cand.target || [];
          const live = (s.rumors || []).some((r) => r.ownerSide === a.side && r.expiresRound > s.round && r.tile[0] === tx && r.tile[1] === ty);
          if (!live) return 0;
          return dist(s, a.x, a.y, tx, ty) <= 2 ? 7 : 4;   // a rumor at your feet resolves before you maneuver (a true trap there is 8 avoided, side-wide); a far one can wait
        }
        return Object.values(s.actors).filter((u) => veiled(u) && dist(s, a.x, a.y, u.x, u.y) <= F.eurekaRadius).length * F.eurekaDamage * 0.8
          + (s.traps || []).filter((t) => strange(t) && dist(s, a.x, a.y, t.x, t.y) <= F.eurekaRadius).length;
      }
      if (cand.type === "ability" && ["valleyFold", "mountainFold", "worldSmallEnough"].includes(ab(cand.ability)?.effect)) {   // Folding: paper where it pays
        const [tx, ty] = cand.target || [];
        if (tx == null || (s.barriers || []).some((b) => b.x === tx && b.y === ty)) return 0;   // one crease per tile
        const F = H.C.concepts.folding.fold, eff = ab(cand.ability).effect;
        if (dist(s, a.x, a.y, tx, ty) > F.range) return 0;
        const surf = tileAt(s, tx, ty);
        const friendNear = Object.values(s.actors).some((u) => !u.defeated && u.side === a.side && dist(s, u.x, u.y, tx, ty) <= 2);
        const valleyV = !friendNear ? 0 : Math.min(8, (surf.hazard || 0) * 1.5 + Math.max(0, (surf.moveCost || 1) - 1) * 2);
        const guarded = Object.values(s.actors).filter((u) => !u.defeated && u.side === a.side && dist(s, u.x, u.y, tx, ty) === 1
          && Object.values(s.actors).some((e) => !e.defeated && e.side !== a.side && dist(s, e.x, e.y, u.x, u.y) <= 5));
        const mountainV = guarded.length ? 6 + (guarded.some((u) => u.lf <= u.maxLF / 2) ? 3 : 0) : 0;
        if (eff === "valleyFold") return valleyV;
        if (eff === "mountainFold") return mountainV;
        return valleyV + mountainV >= 8 ? valleyV + mountainV : 0;   // the compound fold wants both halves to matter
      }
      if (ClassRuntime && cand.type === "ability" && ab(cand.ability)?.effect === "classEffect") {
        // Cavalry's first turn, still out of Strike range: a wall is not how he spends the double move.
        if (cavalryClosing(s, a) && ClassRuntime.wire?.[cand.ability]?.kind === "shieldFace") return 0;
        const m0 = manifest(s, a, cand.ability);
        let kb = 0;
        if (m0.potency > 0) { const pvK = preview(s, cand);   // kill-beats-all reaches class kits too: a Monkey ult that ends the fight fires
          if (pvK.ok) kb = killBeatsAll(s, a, pvK, (d, t) => (cand.announce && (t.reaction > 0 || t.freeReactionVs === a.id || t.status?.guard) ? 0.5 : 1)); }
        return ClassRuntime.aiValue(s, a, cand, classH()) * 1.8 - m0.cost * 0.2 + playfulTarget(s, a, cand) + kb;   // ClassRuntime (values sit on the damage scale)
      }
      if (ClassRuntime && cand.type === "ability") { const v = ClassRuntime.aiValueShared(s, a, cand, ab(cand.ability)?.effect, classH()); if (v != null) {
        if (cavalryClosing(s, a) && ["berm", "barrier", "contourBerm", "bermRing"].includes(ab(cand.ability)?.effect)) return 0;
        return v * 1.8 - manifest(s, a, cand.ability).cost * 0.2; } }
      if (cand.type === "throw") {   // both bodies are hurt; on the damage scale like a Strike
        const T = s.rules.emergentIdeas.fulcrumThrow, f = actorAt(s, cand.pick[0], cand.pick[1]);
        return T.damage * (f && H.grappled(s, f) ? T.heldMul : 1) + T.impact;
      }
      if (cand.type === "pressSubmission") { const t = actorAt(s, cand.target[0], cand.target[1]); if (!cand.commit && H.freeStrike?.(s, a, t, 25)) return 1;   // a grappler takes its free strike from the hold first, then presses
        return (t?.lf || 0) * (cand.commit ? s.rules.submission.ai.finishPerLf : s.rules.submission.ai.pressPerLf); }
      if (cand.type === "breakGrapple") {   // worth it when there is nobody to hit from here, or when hurt enough to want out
        const G = s.rules.grapple, reach = H.strikeRange(s, a), inReach = Object.values(s.actors).some((t) => !t.defeated && !H.Tourist?.is(t) && t.side !== a.side && dist(s, a.x, a.y, t.x, t.y) <= reach);
        return Math.max(inReach ? 0 : G.ai.breakFree, a.lf <= a.maxLF * G.ai.breakBelowLf ? G.ai.breakHurt : 0);
      }
      if (cand.type === "grapple") {   // odds × what the hold is worth; not on a target a Strike would nearly finish
        const G = s.rules.grapple, t = actorAt(s, cand.target[0], cand.target[1]); if (!t || t.lf <= G.ai.skipBelowLf) return 0;
        const book = G.byTheBook, held = t.status?.cuffed && (t.status.cuffed.until == null || t.status.cuffed.until >= t.ownerTurns);   // cuffed as police.js reads it
        const bookWorth = (a.ultimateCharge || 0) >= (s.rules.ultimateChargeMax ?? 100) ? G.ai.value : book.aiCuffedValue;   // a full bar means the arrest is ready: finish, don't posture
        const worth = book && held && hasTrait(a, book.trait) ? bookWorth : hasTrait(a, G.grappler.trait) ? G.ai.grapplerValue : G.ai.value;
        return (H.strongGrip(s, a)?.autoSucceed ? 1 : H.grappleChance(s, t)) * worth;
      }
      if (cand.type === "recover") return 3;
      if (cand.type === "ability" && (cand.ability === "clip" || cand.ability === "juxtapose")) {   // Clip/Juxtapose value (Lantern, 2026-10-18)
        const at = cand.target, near = (u, r) => at && Math.abs(u.x - at[0]) + Math.abs(u.y - at[1]) <= r, foes = Object.values(s.actors).filter((u) => !u.defeated && u.side !== a.side && u.side !== "bystander");
        const friends = Object.values(s.actors).filter((u) => !u.defeated && u.side === a.side), free = manifest(s, a, cand.ability, cand).cost === 0 ? 1 : 0;
        if (cand.ability === "clip") {
          const k = cand.fragment || "cover";
          const v = k === "membrane" ? 3 : k === "wallProtection10" ? (foes.some((u) => near(u, 1)) ? 2.5 : 1) : k === "cover" ? (foes.some((u) => near(u, 1)) ? 2 : 0.6) : k === "thorns" ? (friends.some((u) => near(u, 2)) ? 1.5 : 0.5) : 1;
          return v + free;
        }
        const f = (a.heldFragments || []).find((q) => q.id === cand.fragmentId), u = at && actorAt(s, at[0], at[1]);
        if (!f) return 0;
        // Stolen wards and buffs weigh exactly what casting that protection weighs in normal play (Mala, 2026-10-18): the threat
        // ledger's worn-protection value for the recipient (foes within threatRangeSelf × Strike potency × hit chance × the
        // cover fraction, capped at the recipient's LF), minus 0.3 per ΦF. A plain ward has no ledger entry: it counts as Guard.
        if (f.kind === "ward" || f.kind === "buff") {
          if (!u || u.side !== a.side) return 0;
          const L = s.rules.aiLedger || {}, frac = L.cover?.[f.kind === "ward" ? "guard" : f.value.status] || 0; if (!frac) return 0;
          const threats = foes.filter((e) => dist(s, e.x, e.y, u.x, u.y) <= (L.threatRangeSelf ?? 6)).length;
          return Math.min(threats * (s.rules.strike?.potency || 8) * (L.hitChance ?? 0.7) * frac * (L.perThreat ?? 1), u.lf) - manifest(s, a, cand.ability, cand).cost * 0.3;
        }
        if (f.kind === "trait") return u && u.side === a.side ? 2.5 + free : 0;   // a stolen trait to her side
        const threatened = friends.filter((q) => near(q, 1) && foes.some((e) => Math.abs(e.x - q.x) + Math.abs(e.y - q.y) <= 5)).length;
        return (f.kind === "cover" || f.kind === "wallProtection10" ? 1 + threatened : f.kind === "thorns" ? (foes.some((e) => near(e, 1)) ? 2 : 0.4) : 1) + free;
      }
      if (cand.type === "scramble") return 2 + (H.Instinct.runWorks(s, a) ? 6 : 0);   // running scores higher when it can work   // running scores higher when it can work
      if (cand.type === "playDead") return 3 + (H.Instinct.runWorks(s, a) ? 0 : 3) + (a.primary === "deception" ? 2 : 0) + (a.secondary === "deception" ? 1 : 0);   // lying scores higher when running cannot; a better liar lies readily
      if (cand.type === "disengage") return a.lf <= (s.rules.opportunity?.potency ?? 6) ? 1 : 0;   // survival only: 1 loses to a real strike
      if (cand.type === "overwatch") {   // Overwatch (Muse-2): worth it when a foe hovers just outside the watched ring — likely to step in
        const R = s.rules.overwatch?.range ?? 4;
        let d = 99; for (const u of Object.values(s.actors)) { if (u.defeated || u.side === a.side || H.Tourist?.is(u)) continue; d = Math.min(d, dist(s, a.x, a.y, u.x, u.y)); }
        if (d <= R) return 0;   // already in range: shoot them now instead
        if (!(a.actionsThisTurn > 0) || a.moved) return 0;   // Lantern, landing (2026-10-18): only after acting from where it stands; never instead of closing in (at 4 it out-scored the approach, and two watchers could wait each other out)
        if (d > R + 4) return 0.5;   // nobody coming soon
        return s.rules.overwatch?.aiValue ?? 4;
      }
      if (cand.type === "takeFromCart") {   // a heal when hurt is worth having in hand; anything else is a small stock-up
        const e = accountItems?.consumables?.[cand.item]?.effect || {};
        return e.heal && a.lf < a.maxLF * 0.55 ? 6 : e.phiForce && a.pf < a.maxPF * 0.35 ? 4 : 1.5;
      }
      if (cand.type === "useItem") {
        const e = accountItems?.consumables?.[cand.item]?.effect || {};
        if (e.heal) return Math.min(e.heal, a.maxLF - a.lf) * (a.lf <= a.maxLF * 0.3 ? 2 : 0.8);
        if (e.phiForce) return Math.min(e.phiForce, a.maxPF - a.pf) * 0.9;
        if (e.actionPoints) return a.tempo <= 25 ? 8 : 0;
        if (e.ultCharge) { const max = s.rules.ultimateChargeMax || 100; return Math.min(e.ultCharge, max - (a.ultimateCharge ?? 0)) * 0.25; }
        return 0;
      }
      if (cand.type === "ability" && cand.ability === "membrane") {
        const t = actorAt(s, cand.target[0], cand.target[1]);
        if (!t || t.status.membrane || t.id === id) return 0;   // an empty tile: nobody to wrap (crashed the AI, sim seed 9516, 2026-10-13)
        const foe = Object.values(s.actors).find((f) => !f.defeated && !H.Tourist?.is(f) && f.side !== a.side);
        return foe && dist(s, t.x, t.y, foe.x, foe.y) <= 4 ? 4 : 1;
      }
      if (cand.type === "ability" && cand.ability === "redact") {
        const t = actorAt(s, cand.target[0], cand.target[1]);
        if (!t || t.side === a.side || t.defeated) return 0;
        if (t.status?.membrane && !t.status.membrane.rushed) return 0;
        const m = manifest(s, a, "redact");
        let v = t.status?.annotated ? m.potency * 0.6 : 0;   // spiritual weakening prices near LF damage
        if (t.maxSoul && (t.soul ?? 0) >= t.maxSoul) v += 2;   // the first wound starts the weakening
        if ((t.ultimateCharge ?? 0) > 50) v += 2;   // sealing a charged caster's verse matters more
        return v + 1;   // the seal itself always has some price
      }
      if (cand.type === "ability" && cand.ability === "brierRing") {
        const [tx, ty] = cand.target;
        const friends = Object.values(s.actors).filter((u) => !u.defeated && u.side === a.side && u.id !== id && Math.abs(u.x - tx) + Math.abs(u.y - ty) <= 2).length;
        const foesNear = Object.values(s.actors).some((u) => !u.defeated && u.side !== a.side && Math.abs(u.x - tx) + Math.abs(u.y - ty) <= 3);
        if (!foesNear) return 0;   // briers with nobody coming are gardening
        return Math.min(6, friends * 3 + 1);
      }
      if (cand.type === "ability" && cand.ability === "chartStar") {
        const [tx, ty] = cand.target;
        if ((s.terrainEffects || []).some((e) => e.kind === "star" && e.owner === id && e.tiles?.some(([x, y]) => x === tx && y === ty))) return 0;   // already charted
        const foes = Object.values(s.actors).filter((u) => H.Instinct.standing(u) && u.side !== a.side && Math.abs(u.x - tx) + Math.abs(u.y - ty) <= 2).length;
        return foes >= 2 ? 5 : foes === 1 ? 2 : 0;   // chart toward clusters: pings now, bursts later
      }
      if (cand.type === "ability" && cand.ability === "plaintext") {
        const radius = ab("plaintext")?.area?.radius ?? 2;
        const foes = Object.values(s.actors).filter((u) => H.Instinct.standing(u) && u.side !== a.side && dist(s, a.x, a.y, u.x, u.y) <= radius);
        if (!foes.length) return 0;
        return foes.reduce((v, u) => v + (u.status?.annotated ? 8 : 4), 0);
      }
      if (cand.type === "ability" && ab(cand.ability).timing === "delayed") {
        const target = cand.target && actorAt(s, cand.target[0], cand.target[1]);
        // Delayed fields can be aimed at empty tiles. They are legal commitments,
        // but without an occupant there is no target whose delayed effect can score.
        if (!target || !s.actors[target.id] || target.defeated || target.notArrived) return 0;
        if (H.Tourist?.is(target)) return 0;   // the Tourist is a bystander: a committed strike on him is never a gain (the live scorer below prices him as a cost)
        const tid = target.id;
        if (s.scheduled.some((e) => e.trigger.actor === tid)) return 0;   // don't stack delayed effects on one target
        if (!cannotDodge(s, target, a)) return 0;   // it lands at their next turn and they step out of it (Trip Threshold, 4 misses in a row, 2026-10-14)
        const m = manifest(s, a, cand.ability); return m.potency * 1.1 - m.cost * 0.3;
      }
      if (cand.type === "ability" && cand.ability === "whatIf") {   // Innovation: a pre-cast flexibility premium (the window may still hold at contact); the Mangaka's wires pay it off, not the concept level
        const known = availableAbilities(s, id).filter((x) => ab(x.id)?.tier === "basic");
        return known.length >= 2 ? 4 : 0;
      }
      // Public information only: an unrevealed parry is invisible to the AI.
      const tgt = cand.target && actorAt(s, cand.target[0], cand.target[1]);
      const AM = amFor(s, a);
      const pv = AM ? previewAnswered(s, cand, AM) : preview(s, cand); if (!pv.ok) return -1;
      // A damage finisher trades away the entire remaining dream. Greedy burst alone priced that
      // protection at zero. Keep it unless the committed hit removes a threat, allowing known Guard.
      if (cand.type === "ability" && ab(cand.ability)?.tier === "ultimate" && ab(cand.ability)?.effect === "damage"
        && H.dreamSpaceRules?.canFinishUltimate(a, s.dreamSpace, s.rules)) {
        let resolved = apply(s, cand, { preview: true }).state, replies = 0;
        while (resolved.phase === "response" && replies++ < 16) {
          const who = decider(resolved)?.actor;
          const guard = responseOptions(resolved, resolved.actors[who], resolved.pending.inst).some(o => o.kind === "guard");
          const r = apply(resolved, { type: "respond", actor: who, response: guard ? "guard" : "none" }, { preview: true });
          if (!r.ok) return 0;
          resolved = r.state;
        }
        const removed = Object.values(s.actors).some(t => !t.defeated && !t.notArrived && t.side !== a.side && !H.Tourist?.is(t)
          && resolved.actors[t.id]?.defeated && !s.dreamSpace.called?.includes(t.id));
        if (!removed) return 0;
      }
      // Kaiba (Mala, 2026-10-14): catching the cat in an attack turns the civilians and the police on you and ends your
      // petting for the battle. An attack the preview shows hitting him is a terrible idea, area attacks included.
      if ((pv.events || []).some((e) => e.kind === "kaiba" && e.actor === a.id && (e.why || []).includes("Kaiba cannot be harmed."))) return -20;
      let dmg = 0, self = 0;
      const answering = !AM && cand.announce && pv.pending ? new Set(pv.pending.defenders || []) : null;   // a preview assumes no answers; a defender holding a reaction guards or dodges, and an already-guarding one halves, so price its share at half
      const TA = ledgerOn(s, a, "traitActs"), robotMul = (t) => { let m = 1; if (TA && hasTrait(t, "robot")) for (const [k, v] of Object.entries(TA.robotHarm || {})) if (hasTrait(a, k)) m *= v; return m; };   // trait acts: a robot sympathizer pulls blows on robots, a hater leans in
      for (const d of pv.deltas) { const t = s.actors[d.id]; if (H.Tourist?.is(t)) { dmg -= Math.max(0, d.lf); continue; }   // the Tourist is a bystander: hitting him is a cost, never a gain (walk cost exposed it: a Filter Bolt through him scored as damage)
        if (t.side !== a.side) dmg += robotMul(t) * H.Factions.hate(s, a, t) * d.lf * (answering?.has(d.id) && (t.reaction > 0 || t.freeReactionVs === a.id || t.status?.guard) ? 0.5 : 1) * (1 - (pv.hidden?.[d.id] || 0)); else self += d.lf; }   // villains hate heroes (rules.factions.villainHate)
      { const prov = provokersOf(s, a); for (const d of pv.wildDeltas || []) if (prov.has(d.id)) dmg += d.lf; }   // a communed plant's provoker counts as a foe
      // Kill-beats-all (helper above): the blow priced exactly as the damage loop prices it, so the bonus is only for kills this path already believes in.
      const killBonus = killBeatsAll(s, a, pv, (d, t) => robotMul(t) * (answering?.has(d.id) && (t.reaction > 0 || t.freeReactionVs === a.id || t.status?.guard) ? 0.5 : 1) * (1 - (pv.hidden?.[d.id] || 0)));
      if (tgt && tgt.status.parry && !s.disclosures[tgt.id].rebound) {
        // the AI can't see the parry; score as if it weren't there
        const m = cand.type === "strike" ? { potency: s.rules.strike.potency } : manifest(s, a, cand.ability, cand);
        dmg = Math.max(dmg, m.potency); self = 0;
      }
      const cMan = cand.type === "ability" ? manifest(s, a, cand.ability, cand) : null, inspiredUlt = !!cMan && !!H.inspiredPay?.(s, a, cMan);
      const cost = inspiredUlt ? 0 : cMan ? cMan.cost : 0;   // cand carries announce: an announced Feint prices at its 5 AP + 1 ΦF discount; an inspired ultimate pays no ΦF (it spends 1 Inspiration, priced below)
      if (cand.type === "ability") { const bp = breachPrice(s, a, manifest(s, a, cand.ability, cand)); if (bp?.lf) self += bp.lf; }   // Declared Terms (helper above): the breach penalty LF lands on the breacher, unseen by previews
      // C6 retaliation (muse sandbox batch 5): a fresh attacker (hit me within 2 rounds) is worth extra to a grudge-holder.
      let spite = 0;
      if (tgt && a.lastHit?.by === tgt.id && s.round - (a.lastHit.round ?? -99) <= 2 && (dmg > 0 || cand.type === "strike")) {
        const ids = new Set((a.traits || []).map(t => typeof t === "string" ? t : t?.id));
        spite = ids.has("vengeful") ? 3 : ids.has("rivalrous") ? 1.5 : ids.has("competitive") ? 1 : 0;
      }
      const playful = (dmg > 0 || cand.type === "strike") ? playfulTarget(s, a, cand) : 0;
      const heed = (dmg > 0 || cand.type === "strike") ? (H.States?.holdBack?.(s, a) || 0) : 0;   // advice (states.js holdBack): a valued adviser's warning weighs on attacking
      const def = cand.type === "ability" ? ab(cand.ability) : null;
      const foeNear = Object.values(s.actors).some((t) => !t.defeated && !H.Tourist?.is(t) && t.side !== a.side && dist(s, a.x, a.y, t.x, t.y) <= (s.rules.aiLedger?.threatRangeSelf ?? 6));
      let develop = def && !a.communed && foeNear && ["nurseLog", "successionPatch"].includes(def.effect) && !(s.successionPatches || []).some((p) => p.owner === a.id)
        ? (s.rules.aiLedger?.develop || 0) : 0;   // plant once the fight is joined (a foe near), not while deploying; and plants don't garden
      if (develop && def.effect === "nurseLog") develop += s.rules.aiLedger?.developNurseEdge ?? 0.5;   // refined nursing (absorb, or longer when weak) beats pioneering when affordable
      if (develop && def.effect === "nurseLog" && Array.isArray(cand.target)   // nursing on wood absorbs the first disturbance
        && (s.arena.objects || []).some((o) => o.x === cand.target[0] && o.y === cand.target[1] && ["log", "stump"].includes(o.type))) develop += 1;
      let bait = 0;   // bait: an announced attack that draws a held reaction is worth half the held ult it sets up, when the ult can still fire this turn
      if (cand.announce && def && def.tier !== "ultimate" && def.effect === "damage" && pv.pending?.defenders?.length) {
        const drew = pv.pending.defenders.some((fid) => { const t = s.actors[fid]; return t && !t.defeated && (t.reaction > 0 || t.freeReactionVs === a.id); });
        if (drew) { const ult = heldUltAim(s, a), m = manifest(s, a, cand.ability, cand);
          if (ult && a.tempo - m.tempoCost >= ult.tempoCost && a.pf - m.cost >= ult.cost) bait = ult.potency * 0.5; }
      }
      const setupBo = s.rules.aiLedger?.setupBonus && cand.type === "ability" && ab(cand.ability)?.tier !== "ultimate" && ab(cand.ability)?.effect !== "damage" ? s.rules.aiLedger.setupBonus : 0;   // regret ledger's weight (tools/regret.mjs): priced by replay, not taste
      const rgBo = cand.type === "ability" ? (s.rules.aiLedger?.regretAbility?.[cand.ability] || 0) : 0;   // per-pattern regret prices
      // A full bar means it is time to use it (Mala, 2026-10-27; docs/inspired-ultimates.md): a damage ultimate that is ready
      // gets readyUltimate, and paying it with Inspiration costs inspirationWeight instead of its ΦF.
      const dreamFinisher = cMan?.tier === "ultimate" && !!H.dreamSpaceRules?.canFinishUltimate(a, s.dreamSpace, s.rules);   // a dream finisher has its own pricing above
      const readyUlt = (cMan?.tier === "ultimate" && cMan.effect === "damage" && !dreamFinisher && (a.ultimateCharge || 0) >= s.rules.ultimateChargeMax ? s.rules.aiLedger?.readyUltimate || 0 : 0)
        - (inspiredUlt ? s.rules.reactiveDefense?.ai?.inspirationWeight ?? 3 : 0);   // the point is priced on every inspired ultimate, damage or not
      const taste = TA && cand.type === "ability" && a.adhdChain?.ability ? Object.entries(TA.variety || {}).reduce((n, [k, v]) => hasTrait(a, k) ? n + v : n, 0) : 0;
      const variety = taste ? (a.adhdChain.ability === cand.ability ? -taste : taste) : 0;   // ADHD: something new appeals, the same again bores
      return dmg - self * 1.5 - cost * 0.3 - reserveCost(s, a, cand, cost) + variety + (pv.answerCost || 0) * (AM?.costWeight ?? 1) + (cand.announce ? 2 : 0) + spite - heed + playful + bait + curiousBonus(s, id, cand) + setupBo + rgBo + readyUlt + foundBonus
        + scribedComponentValue(s,a,cand,pv) + threatValue(s, a, cand, def) + infoValue(s, a, cand, pv, def) + develop + (H.traitDriveBonus?.(s, a, cand) || 0) + motiveTerm(s, a, pv) + keyBonus(s, a, cand, def) + killBonus;   // ledgers: threat, then info; then what this unit wants; then known boss keys; then the kill
    }
    // ── In-match lessons (Mala, 2026-10-14: "AI should learn during the match if an attack is effective or not AND
    // understand why"). What a preview already shows (a Shield Wall across a line, a resistance in the damage sum) is
    // priced before the attack. These are the things a preview cannot know, read back from this battle's log:
    //   parry     a hidden Rebound caught this delivery from me on that target   -> that delivery on that target ×0.2
    //   dodged    my committed attack landed on empty tiles                       -> delayed attacks need a target that cannot dodge
    //   barrier   a wall stopped my line                                          -> (priced by the preview; kept for the reason line)
    //   resisted  my hits of one damage type on that target were attuned against  -> that damage type on that target ×0.6
    //   answered  that target's reaction caught this kind of attack of mine       -> the same delivery and concept on that
    //             target ×0.25 if it stopped it whole, ×(1 - rushed) if it caught part, while it still has a reaction (Mala, 2026-10-15: the Warden kept shooting into the
    //             Sieve's Membrane; he should bait the reaction, or close in and use a field or contact attack instead)
    const LESSON = { parryMul: 0.2, resistMul: 0.6, answeredMul: 0.25, rounds: 3, scan: 600 };
    // A communed plant is a bodyguard: wild monsters are nobody's side, so it ignored a feral pig ramming it and its owner
    // for three turns (Mala, 2026-10-14: "maybe communal plants are more reactive to wild types and will attack them if
    // attacked"). A wild monster that hit the plant or its owner in the last two rounds is fair game for it.
    const PROVOKED = { rounds: 2 };
    const provokersOf = (s, a) => {
      if (!a.communed || !(s.wild || []).length) return new Set();
      const guard = new Set([a.id, a.communed.owner].filter(Boolean)), wild = new Set(s.wild.filter((m) => m.lf > 0 && m.form === "unit").map((m) => m.id)), out = new Set();
      for (let i = Math.max(0, s.log.length - LESSON.scan); i < s.log.length; i++) {
        const e = s.log[i];
        if (e.kind === "damage" && wild.has(e.actor) && guard.has(e.target) && s.round - (e.round ?? s.round) <= PROVOKED.rounds) out.add(e.actor);
      }
      return out;
    };
    const lessonsOf = (s, a) => {
      const out = [];
      for (let i = Math.max(0, s.log.length - LESSON.scan); i < s.log.length; i++) {
        const e = s.log[i]; if (s.round - (e.round ?? s.round) > LESSON.rounds) continue;
        if (e.kind === "parry" && e.attacker === a.id) out.push({ cause: "parry", target: e.target, delivery: e.delivery });
        else if (e.kind === "negate" && e.cause === "barrier" && e.actor === a.id) out.push({ cause: "barrier", at: e.at, delivery: e.delivery });
        else if (e.kind === "miss" && e.cause === "dodged" && e.actor === a.id) out.push({ cause: "dodged", ability: e.ability });
        else if (e.kind === "answered" && e.attacker === a.id && e.worked) out.push({ cause: "answered", target: e.target, delivery: e.delivery, concept: e.concept, whole: !!e.stopped });
        else if (e.kind === "damage" && e.actor === a.id && e.target && (e.why || []).some((w) => /attune|Adaptive Brace/i.test(w))) out.push({ cause: "resisted", target: e.target, damageType: e.damageType });
      }
      return out;
    };
    const lessonMul = (s, a, cand, lessons) => {
      if (!lessons.length || cand.type !== "ability") return 1;
      const def = ab(cand.ability); if (!def) return 1;
      const t = Array.isArray(cand.target) ? actorAt(s, cand.target[0], cand.target[1]) : null;   // self-centered fields (False Horizon) have no aimed target; the lesson still names its answerer
      let m = 1;
      if (t && lessons.some((l) => l.cause === "parry" && l.target === t.id && l.delivery === def.delivery)) m *= LESSON.parryMul;
      { const concept = manifest(s, a, cand.ability).concept;
        const ans = s.rules.reactiveDefense?.ai?.learn !== false && lessons.filter((l) => l.cause === "answered" && l.delivery === def.delivery && l.concept === concept && (!t || t.id === a.id || l.target === t.id) && (s.actors[l.target]?.reaction > 0));
        if (ans && ans.length) m *= ans.some((l) => l.whole) ? LESSON.answeredMul : 1 - (s.rules.reactiveDefense?.rushed ?? 1); }
      if (t && lessons.some((l) => l.cause === "resisted" && l.target === t.id && l.damageType === manifest(s, a, cand.ability).damageType)) m *= LESSON.resistMul;   // the runtime type (from the concept), not the definition's
      return m;
    };
    // Can this target get out of a committed attack? The response window's own rules (window.js responseOptions): a
    // reaction, attention not fixed on someone else, not held in a grapple, the AP to pay for the dodge after stun and
    // debt, and an open tile to step to. Mala, 2026-10-14: committed attacks only on a target that cannot dodge.
    const cannotDodge = (s, t, a) => {
      if (H.grappled?.(s, t)) return true;
      if (t.status?.attention && t.status.attention.target !== a.id) return true;
      if ((t.lastTechniqueConcept === "focus" || t.focus?.earned) && t.focus && t.focus.target !== a.id) return true;
      const dodgeAp = H.Injury.dodgeCost(s, t, H.dodgeCostFor(s, t));
      if ((t.tempoCapacity || 100) - (t.status?.stun?.points || 0) - (t.tempoDebt || 0) < dodgeAp) return true;
      const P = paths(s, t.x, t.y, H.Injury.dodgeReach(s, t), "move");
      for (const [, n] of P.dist) if (n > 0) return false;
      return true;
    };
    // C27: traps are very hazardous terrain. A known live trap outweighs any chase; only blind
    // panic (routed, must-retreat, fleeing) or no safe path at all crosses one.
    const desperate = (u) => !!(u.routed || u.mustRetreat || u.fleeing);
    const knownTrapOn = (st, u, x, y) => Traps ? (st.traps || []).find(t => !t.spent && t.x === x && t.y === y && Traps.known(u, t)) || null : null;
    // Tiles this unit has stood on this turn since it last did anything but move: stepping back onto one undoes a move and
    // buys nothing (Mala's Survive log, 2026-10-14). Read from the log back to the turn's start; any entry of this unit that
    // is not part of moving ends the scan, so an unknown kind only makes the rule looser, never stricter.
    const MOVE_KINDS = new Set(["move", "tempo", "traitShown", "climb", "drop", "fall", "terrain", "turn-end"]);
    const steppedThisTurn = (s, a) => {
      const out = new Set();
      for (let i = s.log.length - 1; i >= 0; i--) {
        const e = s.log[i]; if (e.actor !== a.id) continue;
        if (e.kind === "turn") break;
        if (!MOVE_KINDS.has(e.kind) || (e.kind === "tempo" && !/ on Move /.test(e.text || "") && !/action points\.$/.test(e.text || ""))) break;
        if (e.kind === "move" && !e.forced) for (const [x, y] of e.path || []) out.add(`${x},${y}`);
      }
      out.delete(`${a.x},${a.y}`); return out;
    };
    const triedThisTurn = (s, a, kind) => { for (let i = s.log.length - 1; i >= 0; i--) { const e = s.log[i]; if (e.actor !== a.id) continue; if (e.kind === "turn") return false; if (e.kind === kind) return true; } return false; };
    const routeCrossesKnownTrap = (st, u, to) => {
      if (!Traps || desperate(u)) return false;
      const route = paths(st, u.x, u.y, 99, "move").pathTo(to[0], to[1]) || [];
      return route.slice(1).some(([x, y]) => knownTrapOn(st, u, x, y));
    };
    function approach(s, a, toward = null) {
      toward ||= siegeOf(s, a);   // aggro: with nothing better to do, a unit at war with his AGI closes on the building
      const foe = toward || Object.values(s.actors).filter((f) => H.Instinct.standing(f) && !H.Tourist?.is(f) && f.side !== a.side && H.PostHuman.atWar(s, a, f) && H.Civilian.atWar(s, a, f) && (H.Visitors?.atWar(s, a, f) ?? true) && H.Factions.atWar(s, a, f) && !(a.truceWith === f.id && a.truceUntil >= s.round) && (!a.forceTarget || a.forceTargetUntil < s.round || f.id === a.forceTarget))[0]; if (!foe) return null;
      const options = [];
      for (const o of moveOptions(s, a.id)) {
        { const previewed = apply(s,{type:"move",actor:a.id,to:o.to},{preview:true}); if(!previewed.ok || previewed.state.actors[a.id]?.defeated) continue; }
        options.push(o);
      }
      const safe = options.filter(o => !routeCrossesKnownTrap(s, a, o.to));
      // Follow the walk, not the straight line: a unit behind a row of boulders has to step sideways to the gap first,
      // which a straight-line measure reads as moving away (seed 5507 sat out 33 rounds that way). The route is found
      // FROM this unit, because ground is not the same both ways: a drop the target could come down is not a way up
      // (seed 8109: a Samurai on one terrace and a Surveyor on the other waited 30 rounds). Take the reachable tile
      // furthest along that route; with no walking route at all, fall back to the straight line.
      const pool = safe.length ? safe : options;
      // Hazard-aware routing (muse, 2026-10-18, seed 3962880737): closing in bends around entry
      // hazards instead of through them. A step of progress weighs the same as 1 LF of avoided
      // bleeding (the engine's smallest harm unit); off-route sidesteps compete on closing
      // distance, so a free lateral step beats bleeding straight through. A field with no way
      // around is still crossed at its cheapest point (progress beats standing still).
      const P = paths(s, a.x, a.y, 99, "move");
      const bleed = (to) => (P.pathTo(to[0], to[1]) || []).slice(1).reduce((n, [x, y]) => n + (tileAt(s, x, y).hazard || 0), 0);
      const route = paths(s, a.x, a.y, 99, "move", [foe.x, foe.y]).pathTo(foe.x, foe.y);
      const hereD = dist(s, a.x, a.y, foe.x, foe.y);
      if (route && route.length > 1) {
        const step = new Map(route.map(([x, y], i) => [H.key(x, y), i]));
        let along = null;
        for (const o of pool) {
          const i = step.get(H.key(o.to[0], o.to[1]));
          const progress = i > 0 ? i : hereD - dist(s, o.to[0], o.to[1], foe.x, foe.y);
          const v = progress - bleed(o.to);
          if ((i > 0 || progress > 0) && (!along || v > along.v)) along = { v, to: o.to };
        }
        if (along) return { type: "move", actor: a.id, to: along.to };
      }
      let best = null;
      for (const o of pool) { const d = dist(s, o.to[0], o.to[1], foe.x, foe.y) + bleed(o.to); if (!best || d < best.d) best = { d, to: o.to }; }
      return best && best.d < hereD ? { type: "move", actor: a.id, to: best.to } : null;
    }
    function retreat(s, a) {
      if (a.lf > a.maxLF * 0.4) return { type: "end", actor: a.id };
      const foe = Object.values(s.actors).filter((f) => !f.defeated && !H.Tourist?.is(f) && f.side !== a.side)[0];
      const options = [];
      for (const o of moveOptions(s, a.id)) {
        const previewed = apply(s, { type: "move", actor: a.id, to: o.to }, { preview: true });
        if (!previewed.ok || previewed.state.actors[a.id]?.defeated) continue;
        options.push(o);
      }
      const safe = options.filter(o => !routeCrossesKnownTrap(s, a, o.to));
      let best = null;
      for (const o of (safe.length ? safe : options)) { const d = dist(s, o.to[0], o.to[1], foe.x, foe.y); if (!best || d > best.d) best = { d, to: o.to }; }
      return best && best.d > dist(s, a.x, a.y, foe.x, foe.y) ? { type: "move", actor: a.id, to: best.to } : { type: "end", actor: a.id };
    }

    return { withAiTrace, traceAiEvent, aiLastWorkflow, shownTrait, aiAction, demonstratedTraits, recordShown, aiDecide, candidates, score, concentrationValue, approach, retreat, lessonsOf, lessonMul, cannotDodge, traitDriveBonus, driveChecks };
  })();
});
