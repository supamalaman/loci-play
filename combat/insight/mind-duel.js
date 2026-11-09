"use strict";
// Mind duel (Mala, 2026-10-14; spec loci-orbit/muse/parley/PARLEY_MINIGAME.md): Talk opens a battle
// of minds instead of rolling. Simultaneous RPS-style rounds (margin damage, clash on ties, 4-round
// cap, willpower-fraction tiebreak), concede buys intel, loser stands down and concedes by severity.
// Broken will is never game-over, either side. State: s.mindDuel = { a, b, round, picks, learned,
// rounds, concede }; phase "mind" pauses the battle; the decider is whoever still has to pick.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(() => require("./mind-matrix.js"), () => require("./mind-talk.js"), () => { try { return require("../dialogue/parley-voices.js"); } catch (e) { return null; } });
  else root.ConceptCombatMindDuel = factory(() => root.ConceptCombatMindMatrix, () => root.ConceptCombatMindTalk, () => root.ConceptCombatParleyVoices);
})(typeof self !== "undefined" ? self : this, function (matrix = () => null, talkMod = () => null, voiceMod = () => null) {
  const MX = () => matrix();
  const Talk = () => talkMod();
  // What the wrapper may read: names, mind-traits, and only the traits each side has READ in the other.
  // A character's own parley lines (dialogue/parley-voices.js), found by character, boss, sprite or name.
  const voiceOf = (s, id) => { const a = s.actors[id], V = voiceMod()?.voices; if (!a || !V) return null; const k = [a.character, a.boss, a.sprite, String(a.name || "").toLowerCase().replace(/\s+/g, "_")].find((x) => x && V[x]); return k ? V[k] : null; };
  const talkCtx = (s) => { const du = s.mindDuel; return { seed: s.seed, voice: (id) => voiceOf(s, id), name: (id) => name(s.actors[id]), traits: (id) => matrixTraits(s.actors[id]), known: { [du.a]: knownTo(s, du.a, du.b), [du.b]: knownTo(s, du.b, du.a) } }; };
  const APPARENT_SHARE = 0.5;   // same pool as observeSelf: apparent traits are visible to everyone
  function roll(seed, tag) {
    let h = 2166136261 ^ (seed >>> 0);
    for (const c of String(tag)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const traitsOf = (u) => (u?.traits || []).map((t) => (typeof t === "string" ? t : t?.id)).filter(Boolean);
  const has = (u, t) => traitsOf(u).includes(t);
  const name = (u) => u?.name || u?.id || "someone";
  const wp = (u) => u?.willpower ?? MX().RULES.maxWillpower;
  const maxWp = (u) => u?.maxWillpower ?? MX().RULES.maxWillpower;
  const matrixTraits = (u) => [...new Set(traitsOf(u).filter((t) => MX().MATCHUPS[t]))].sort();
  const foeOf = (du, id) => (du.a === id ? du.b : du.a);

  // What knower knows about subject's mind-traits: apparent ones (visible), observed ones (the
  // player's revealed trait cards), and whatever this duel's concedes taught. Sorted, stable.
  function knownTo(s, knowerId, subjectId) {
    const du = s.mindDuel, sub = s.actors[subjectId], out = new Set(du?.learned?.[knowerId] || []);
    for (const t of matrixTraits(sub)) if (roll(s.seed, `apparent:${t}`) < APPARENT_SHARE) out.add(t);
    if (knowerId === "player") {
      const know = s.insight?.knowledge?.player?.[subjectId], deck = s.insight?.decks?.[subjectId];
      if (know && deck) for (const c of deck.cards) if (c.kind === "trait" && know.revealed.includes(c.id) && MX().MATCHUPS[c.trait]) out.add(c.trait);
    }
    const have = new Set(matrixTraits(sub));   // decks go stale when traits change mid-battle: only the traits they hold count
    return [...out].filter((t) => have.has(t)).sort();
  }
  // Attack value of move by atk on def, reading only knownIds of the defender's traits: a weak
  // doubles once, a strong nullifies (immune beats weak), the unknown counts neutral.
  function attack(s, atk, def, move, knownIds, opts = {}) {
    if (move === "concede") return 0;
    const M = MX(), known = new Set(knownIds);
    let power = M.MOVES[move].power;
    if (move === "debate") { power = has(atk, "speedTalker") ? M.RULES.speedTalkerDebate : power; if (atk.status?.mindVow?.type === "unyielding") power += M.RULES.vowDebateAdd; }
    const ts = matrixTraits(def).filter((t) => known.has(t));
    const mult = ts.some((t) => M.MATCHUPS[t].strong === move) ? 0 : ts.some((t) => M.MATCHUPS[t].weak === move) ? 2 : 1;
    return Math.max(0, power * mult - (opts.staggered ? M.RULES.staggerAttackMinus : 0));
  }
  const immuneTo = (def, move) => matrixTraits(def).some((t) => MX().MATCHUPS[t].strong === move);

  function openDuel(s, aId, bId, H) {
    if (s.mindDuel) return "A battle of minds is already underway.";
    const a = s.actors[aId], b = s.actors[bId];
    if (!a || !b || a.defeated || b.defeated) return "There's no one to argue with.";
    for (const u of [a, b]) { u.willpower ??= MX().RULES.maxWillpower; u.maxWillpower ??= MX().RULES.maxWillpower; }
    s.mindDuel = { a: aId, b: bId, round: 1, picks: {}, learned: {}, rounds: [], concede: null };
    s.phase = "mind";
    H.log(s, { kind: "parley", actor: aId, target: bId, text: `${name(a)} and ${name(b)} lock eyes: a battle of minds begins (willpower ${wp(a)} vs ${wp(b)}).`,
      why: ["Simultaneous arguments, margin damage, 4 rounds. The loser stands down and concedes — never more."] });
    return null;
  }
  function swearVow(s, id, vow, H) {
    const du = s.mindDuel;
    if (!du || ![du.a, du.b].includes(id)) return "No battle of minds to swear on.";
    if (du.round !== 1 || du.picks[id]) return "Vows are sworn before the first argument.";
    if (!["gentle", "unyielding"].includes(vow)) return "Unknown vow.";
    const a = s.actors[id];
    if (a.status.mindVow) return "One mind-vow at a time.";
    a.status.mindVow = { type: vow };
    H.log(s, { kind: "parley", actor: id, text: vow === "gentle" ? `${name(a)} swears the gentle tongue: never insult, and empathy steadies +1.` : `${name(a)} swears the unyielding mind: never concede, and debate hits +1.` });
    return null;
  }
  function recordPick(s, id, move, H) {
    const du = s.mindDuel;
    if (!du || s.phase !== "mind") return "No battle of minds to argue in.";
    if (du.concede) return "The argument is over: the loser must concede.";
    if (![du.a, du.b].includes(id)) return "You are not in this argument.";
    if (!MX().MOVES[move]) return "Unknown argument.";
    if (du.picks[id]) return "Already argued this round.";
    du.picks[id] = move;
    const other = foeOf(du, id);
    if (!du.picks[other]) { H.log(s, { kind: "parley", actor: id, text: `${name(s.actors[id])} chooses an argument…`, why: ["Simultaneous: both sides choose, then the arguments are revealed together."] }); return null; }
    resolveRound(s, H);
    return null;
  }
  // Teach knowerId one of subjectId's unknown mind-traits (sorted-first, stable). Returns it or null.
  function revealTrait(s, knowerId, subjectId, H) {
    const du = s.mindDuel, sub = s.actors[subjectId], known = new Set(knownTo(s, knowerId, subjectId));
    const next = matrixTraits(sub).find((t) => !known.has(t));
    if (!next) return null;
    if (knowerId === "player") {
      const deck = s.insight?.decks?.[subjectId], know = s.insight?.knowledge?.player?.[subjectId];
      const card = deck?.cards.find((c) => c.kind === "trait" && c.trait === next);
      if (know && card && !know.revealed.includes(card.id)) know.revealed.push(card.id);
      else { (du.learned[knowerId] ||= []).push(next); }
    } else (du.learned[knowerId] ||= []).push(next);
    H.log(s, { kind: "parley", actor: knowerId, target: subjectId, text: `${name(s.actors[knowerId])} learns that ${name(sub)} is ${next}.`, why: [MX().MATCHUPS[next].why] });
    return next;
  }
  function heal(s, u, n) { u.willpower = Math.min(maxWp(u), wp(u) + n); }
  function hurt(s, u, n) { u.willpower = Math.max(0, wp(u) - n); }

  function resolveRound(s, H) {
    const du = s.mindDuel, M = MX(), A = s.actors[du.a], B = s.actors[du.b];
    const mvA = du.picks[du.a], mvB = du.picks[du.b], allA = matrixTraits(A), allB = matrixTraits(B);
    // A stagger swings only the next opener: consume old ones first, so a fresh round-1 breach survives for a later duel.
    const stagA = du.round === 1 && !!A.status.mindStagger, stagB = du.round === 1 && !!B.status.mindStagger;
    if (stagA) delete A.status.mindStagger; if (stagB) delete B.status.mindStagger;
    // Vow breaches resolve before the math (a breached boon never applies to the breaching move).
    for (const [u, mv, foe] of [[A, mvA, B], [B, mvB, A]]) {
      const vow = u.status.mindVow?.type;
      if (mv === "insult" && vow === "gentle") { delete u.status.mindVow; u.status.mindStagger = true;
        H.log(s, { kind: "parley", actor: u.id, text: `${name(u)} breaks the gentle tongue with scorn: their next mind-battle opener stammers.` }); }
      if (mv === "concede" && vow === "unyielding") { delete u.status.mindVow;
        const shown = revealTrait(s, foe.id, u.id, H);
        H.log(s, { kind: "parley", actor: u.id, text: `${name(u)} breaks the unyielding mind by yielding${shown ? `: the crack shows ${shown}` : ""}.` }); }
    }
      const atkA = attack(s, A, B, mvA, allB, { staggered: stagA }), atkB = attack(s, B, A, mvB, allA, { staggered: stagB });
    const labels = [];
    const res = { kind: "win", winner: null, margin: 0, yielder: null, a: { move: mvA, heal: 0 }, b: { move: mvB, heal: 0 }, weak: { a: false, b: false }, immune: { a: false, b: false }, backfire: { a: false, b: false } };
    for (const [k, mv, def, all] of [["a", mvA, B, allB], ["b", mvB, A, allA]]) if (mv !== "concede") { const ts = matrixTraits(def).filter((t) => all.includes(t)); res.immune[k] = ts.some((t) => M.MATCHUPS[t].strong === mv); res.weak[k] = !res.immune[k] && ts.some((t) => M.MATCHUPS[t].weak === mv); }
    if (mvA === "concede" && mvB === "concede") { heal(s, A, M.MOVES.concede.yieldHeal); heal(s, B, M.MOVES.concede.yieldHeal);
      revealTrait(s, du.a, du.b, H); revealTrait(s, du.b, du.a, H); labels.push("both yield: both steadied, both learned"); res.kind = "bothYield"; }
    else if (mvA === "concede" || mvB === "concede") {
      const C = mvA === "concede" ? A : B, O = C === A ? B : A, atkO = C === A ? atkB : atkA;
      hurt(s, C, atkO); heal(s, O, M.MOVES.concede.yieldHeal); revealTrait(s, C.id, O.id, H);
      res.kind = "yield"; res.yielder = C === A ? "a" : "b"; res.winner = C === A ? "b" : "a"; res.margin = atkO;
      labels.push(`${name(C)} yields: ${name(O)}'s ${M.MOVES[mvA === "concede" ? mvB : mvA].name.toLowerCase()} lands uncontested for ${atkO}`);
    } else {
      if (atkA === atkB) { res.kind = "clash"; labels.push(`clash: ${atkA} meets ${atkB}, both cancel`); }
      else { const loser = atkA > atkB ? B : A, margin = Math.abs(atkA - atkB); hurt(s, loser, margin); res.winner = loser === B ? "a" : "b"; res.margin = margin;
        labels.push(`${name(loser === B ? A : B)} wins the exchange by ${margin} (${Math.max(atkA, atkB)} over ${Math.min(atkA, atkB)})`); }
    }
    for (const [u, mv] of [[A, mvA], [B, mvB]]) if (mv === "empathize") { const h = M.MOVES.empathize.heal + (u.status.mindVow?.type === "gentle" ? M.RULES.vowEmpathizeHealAdd : 0); const before = wp(u); heal(s, u, h); res[u === A ? "a" : "b"].heal = wp(u) - before; }
    for (const [u, mv, foe] of [[A, mvA, B], [B, mvB, A]]) if (mv === "insult" && immuneTo(foe, "insult")) { hurt(s, u, M.MOVES.insult.backfire); res.backfire[u === A ? "a" : "b"] = true; labels.push(`scorn rebounds on ${name(u)} (−${M.MOVES.insult.backfire})`); }
    const text = `Mind round ${du.round}: ${name(A)} ${mvA}s, ${name(B)} ${mvB}s — ${labels.join("; ")} (willpower ${wp(A)} vs ${wp(B)}).`;
    du.rounds.push({ round: du.round, a: mvA, b: mvB, text, res });
    H.log(s, { kind: "parley", actor: du.a, target: du.b, text });
    if (M.RULES.talk && Talk()) for (const l of Talk().talk(du, du.rounds.length - 1, talkCtx(s))) { H.log(s, { kind: "mindTalk", actor: l.speaker, text: l.text }); (du.talk ||= []).push({ round: du.round, speaker: l.speaker, text: l.text }); }
    const aOut = wp(A) <= 0, bOut = wp(B) <= 0;
    if (aOut || bOut) {
      const severity = du.round <= 1 ? "blowout" : du.round <= 3 ? "decisive" : "narrow";
      if (aOut && bOut) return endDuel(s, frac(s, A, B) > frac(s, B, A) ? { winner: du.a, loser: du.b, severity } : frac(s, B, A) > frac(s, A, B) ? { winner: du.b, loser: du.a, severity } : { tie: true }, H);
      return endDuel(s, aOut ? { winner: du.b, loser: du.a, severity } : { winner: du.a, loser: du.b, severity }, H);
    }
    if (du.round >= M.RULES.maxRounds) {
      const fa = frac(s, A, B), fb = frac(s, B, A);
      if (fa !== fb) return endDuel(s, fa > fb ? { winner: du.a, loser: du.b, severity: "narrow" } : { winner: du.b, loser: du.a, severity: "narrow" }, H);
      return endDuel(s, { tie: true }, H);
    }
    du.round += 1; du.picks = {};
    return null;
  }
  const frac = (s, u, foe) => wp(u) / Math.max(1, maxWp(u));

  function endDuel(s, result, H) {
    const du = s.mindDuel, M = MX();
    if (result.tie) {
      if (M.RULES.talk && Talk()) for (const l of Talk().closing(du, result, talkCtx(s))) H.log(s, { kind: "mindTalk", actor: l.speaker, text: l.text });
      H.Parley.lock(s, du.a, du.b);
      H.log(s, { kind: "parley", actor: du.a, target: du.b, text: `Dead even after ${M.RULES.maxRounds} rounds: no persuasion. Talk is closed between ${name(s.actors[du.a])} and ${name(s.actors[du.b])}.` });
      return closeDuel(s);
    }
    const loser = s.actors[result.loser];
    loser.standDownUntil = s.round + 2;
    loser.mindBroken = { by: result.winner, round: s.round };   // W1.4: a true break (willpower 0) can be converted, once
    H.log(s, { kind: "parley", actor: result.winner, target: result.loser,
      text: `${name(loser)}'s will breaks (${result.severity}${du.rounds.length <= M.RULES.maxRounds && wp(loser) <= 0 ? `, round ${du.round}` : ", on points"}). ${name(loser)} stands down — come to terms is open.`,
      why: ["Broken will is never game-over: one lost argument costs something, never everything."] });
    if (M.RULES.talk && Talk()) for (const l of Talk().closing(du, result, talkCtx(s))) { H.log(s, { kind: "mindTalk", actor: l.speaker, text: l.text }); (du.talk ||= []).push({ round: du.round, speaker: l.speaker, text: l.text, end: true }); }
    du.concede = { by: result.loser, severity: result.severity };
    if (result.loser === "player") return null;   // the player picks their poison
    autoConcede(s, H);
    return null;
  }
  function closeDuel(s) { delete s.mindDuel; if (s.phase === "mind") s.phase = "action"; }

  // Concessions. Availability first (a tier with nothing on the table drops one), then apply.
  function dismissible(s, loserId) {
    const loser = s.actors[loserId];
    return Object.values(s.actors).filter((u) => u.side === loser.side && u.id !== loserId && !u.defeated && !u.notArrived && !u.boss)
      .sort((p, q) => (p.lf ?? 0) - (q.lf ?? 0) || (p.id < q.id ? -1 : 1));
  }
  function heldProperty(s, loserId) {
    const side = s.actors[loserId].side;
    return (s.arena.objects || []).filter((o) => o.house && (o.house.stakes?.[side] || 0) > 0);
  }
  function concedeTier(s, loserId, severity) {
    if (severity === "blowout" && (dismissible(s, loserId).length || heldProperty(s, loserId).length)) return "blowout";
    if (severity === "blowout" || severity === "decisive") return "decisive";
    return "narrow";
  }
  function concedeOptions(s) {
    const du = s.mindDuel, loser = s.actors[du.concede.by], tier = concedeTier(s, du.concede.by, du.concede.severity);
    const opts = [];
    if (tier === "blowout") {
      const allies = dismissible(s, loser.id), props = heldProperty(s, loser.id);
      opts.push({ id: "dismissAlly", label: `Dismiss an ally${allies.length ? ` (${allies[0].name}, weakest)` : ""}`, off: !allies.length, note: "they leave the battle, kept alive" });
      opts.push({ id: "surrenderProperty", label: `Surrender property${props.length ? ` (${props.length} house${props.length === 1 ? "" : "s"})` : ""}`, off: !props.length, note: "your side's house stakes go over" });
    } else if (tier === "decisive") {
      opts.push({ id: "stall", label: "Forced stall (skip your next turn)", off: false, note: "sit the next one out" });
      opts.push({ id: "debt", label: `AP Debt (next turn opens −${MX().RULES.apDebt} AP)`, off: false, note: "borrowed time" });
    } else {
      opts.push({ id: "inspiration", label: (loser.inspiration || 0) > 0 ? "Yield the point (−1 Inspiration)" : "Yield the point (no Inspiration: AP Debt instead)", off: false, note: "a narrow loss costs a little" });
    }
    return { severity: du.concede.severity, tier, options: opts };
  }
  function applyConcession(s, loserId, choice, H) {
    const M = MX(), loser = s.actors[loserId], du = s.mindDuel;
    const winner = s.actors[foeOf(du, loserId)];
    if (choice === "dismissAlly") { const gone = dismissible(s, loserId)[0]; if (!gone) return "no ally to dismiss";
      gone.defeated = true; gone.escaped = true; gone.noXp = true; gone.leaveReason = "dismissed";
      H.log(s, { kind: "parley", actor: loserId, target: gone.id, text: `${name(loser)} concedes: ${name(gone)} is dismissed and leaves the battle alive.` }); }
    else if (choice === "surrenderProperty") { const props = heldProperty(s, loserId); if (!props.length) return "no property to surrender";
      for (const o of props) { const st = o.house.stakes; st[winner.side] = (st[winner.side] || 0) + (st[loser.side] || 0); st[loser.side] = 0;
        o.house.side = st[winner.side] >= (st[loser.side] || 0) ? winner.side : o.house.side; o.owner = winner.id; }
      H.log(s, { kind: "parley", actor: loserId, target: winner.id, text: `${name(loser)} concedes: ${props.length} house stake${props.length === 1 ? "" : "s"} go${props.length === 1 ? "es" : ""} to the ${winner.side === "player" ? "player's" : "enemy's"} side.` }); }
    else if (choice === "stall") { loser.concedeStall = true;
      H.log(s, { kind: "parley", actor: loserId, text: `${name(loser)} concedes: they sit out their next turn.` }); }
    else if (choice === "debt") { loser.tempoDebt = (loser.tempoDebt || 0) + M.RULES.apDebt;
      H.log(s, { kind: "parley", actor: loserId, text: `${name(loser)} concedes: ${M.RULES.apDebt} AP of tempo debt, paid from their next turn.` }); }
    else if (choice === "inspiration") {
      if ((loser.inspiration || 0) > 0) { loser.inspiration -= 1;
        H.log(s, { kind: "parley", actor: loserId, text: `${name(loser)} concedes the point: −1 Inspiration (${loser.inspiration} left).` }); }
      else return applyConcession(s, loserId, "debt", H);   // poverty never fizzles: down the chain
    } else return "Unknown concession.";
    return null;
  }
  function applyConcede(s, id, choice, H) {
    const du = s.mindDuel;
    if (!du?.concede) return "Nothing to concede.";
    if (du.concede.by !== id) return "It is not yours to concede.";
    const menu = concedeOptions(s), opt = menu.options.find((o) => o.id === choice);
    if (!opt || opt.off) return "That concession is not on the table.";
    const r = applyConcession(s, id, choice, H);
    if (r) return r;
    return closeDuel(s);
  }
  // The AI rolls its poison on a trait-weighted table (seeded, simulatable). Shared by the
  // instant NPC concession and by sim-driven players facing the menu.
  function pickConcede(s) {
    const du = s.mindDuel, loser = s.actors[du.concede.by], W = MX().RULES.weights;
    const menu = concedeOptions(s);
    const weight = (o) => W.base
      * (o.id === "surrenderProperty" && has(loser, "greedy") ? W.greedyProperty : 1)
      * (o.id === "dismissAlly" && has(loser, "proud") ? W.proudDismiss : 1)
      * (o.id === "stall" && has(loser, "stubborn") ? W.stubbornStall : 1)
      * (o.id === "stall" && has(loser, "impatient") ? W.impatientStall : 1)
      * (o.id === "debt" && has(loser, "impatient") ? W.impatientDebt : 1);
    const avail = menu.options.filter((o) => !o.off);
    let r = roll(s.seed, `mindconcede:${loser.id}:${s.round}:${du.round}`) * avail.reduce((n, o) => n + weight(o), 0);
    for (const o of avail) { r -= weight(o); if (r < 0) return o.id; }
    return avail[0].id;
  }
  function autoConcede(s, H) {
    const du = s.mindDuel;
    const err = applyConcession(s, du.concede.by, pickConcede(s), H);
    if (err) { applyConcession(s, du.concede.by, "stall", H); }   // stall never misses
    return closeDuel(s);
  }

  // AI in the window: max-min over the foe's plausible replies (the foe is assumed to know all of
  // its traits — paranoid, simple, legible), own attacks read only known traits. Concedes to buy
  // intel while 2+ of the foe's traits are unknown, unless the reply would knock it out.
  function aiPick(s, aiId) {
    const du = s.mindDuel, M = MX(), me = s.actors[aiId], foeId = foeOf(du, aiId), foe = s.actors[foeId];
    const known = knownTo(s, aiId, foeId), allFoe = matrixTraits(foe), allMe = matrixTraits(me);
    const stag = du.round === 1 && !!me.status.mindStagger;
    const myHeal = (m) => (m === "empathize" ? M.MOVES.empathize.heal + (me.status.mindVow?.type === "gentle" ? M.RULES.vowEmpathizeHealAdd : 0) : 0);
    const foeHeal = (m) => (m === "empathize" ? M.MOVES.empathize.heal + (foe.status.mindVow?.type === "gentle" ? M.RULES.vowEmpathizeHealAdd : 0) : 0);
    if (allFoe.length - known.length >= 2) {
      const worstFull = Math.max(0, ...["debate", "empathize", "insult"].map((fm) => attack(s, foe, me, fm, allMe, {})));
      if (worstFull < wp(me)) return "concede";
    }
    let best = "debate", bestWorst = -Infinity;
    for (const m of ["debate", "empathize", "insult"]) {
      const mine = attack(s, me, foe, m, known, { staggered: stag });
      const backMe = m === "insult" && known.some((t) => M.MATCHUPS[t].strong === "insult") ? M.MOVES.insult.backfire : 0;
      let worst = Infinity;
      for (const fm of ["debate", "empathize", "insult"]) {
        const f = attack(s, foe, me, fm, allMe, {});
        const backFoe = fm === "insult" && immuneTo(me, "insult") ? M.MOVES.insult.backfire : 0;
        const dealt = mine > f ? mine - f : 0, taken = f > mine ? f - mine : 0;
        worst = Math.min(worst, (dealt + backFoe - foeHeal(fm)) - (taken + backMe - myHeal(m)));
      }
      if (worst > bestWorst) { bestWorst = worst; best = m; }
    }
    return best;
  }

  // What the viewer knows, for the window: own panel shows all (you know yourself), the foe's
  // panel shows known traits plus "?" slots for the rest. Moves, round, vow offers, concession menu.
  // The wrapper's window data (flag on only): transcript, the faces, and a sentence under each move for the viewer.
  function talkView(s, du, viewerId, panel) {
    const T = Talk(), last = du.rounds[du.rounds.length - 1], mine = viewerId === du.a || viewerId === du.b;
    const ko = !!last && du.round <= 1 && (wp(s.actors[du.a]) <= 0 || wp(s.actors[du.b]) <= 0);
    const m = last?.res ? T.mood(last.res, ko) : null, foe = mine ? foeOf(du, viewerId) : null;
    const read = foe ? knownTo(s, viewerId, foe) : [];
    return { talk: (du.talk || []).map((l) => ({ ...l, name: name(s.actors[l.speaker]) })),
      mood: m ? { [du.a]: m.a, [du.b]: m.b } : {},
      previews: foe ? Object.fromEntries(Object.keys(MX().MOVES).map((mv) => [mv, T.preview(mv, matrixTraits(s.actors[foe]), read)])) : {} };
  }
  function intel(s, viewerId = "player") {
    const du = s.mindDuel, M = MX();
    if (!du) return null;
    const panel = (id) => {
      const u = s.actors[id], mine = id === viewerId;
      const traits = mine ? matrixTraits(u) : knownTo(s, viewerId, id);
      return { id, name: name(u), willpower: wp(u), maxWillpower: maxWp(u), isYou: mine, picked: !!du.picks[id],
        vow: u.status?.mindVow?.type || null, stagger: !!(du.round === 1 && u.status?.mindStagger),
        traits: traits.map((t) => ({ id: t, weak: M.MATCHUPS[t].weak, strong: M.MATCHUPS[t].strong, why: M.MATCHUPS[t].why })),
        unknown: mine ? 0 : matrixTraits(u).length - traits.length };
    };
    const viewer = s.actors[viewerId], inDuel = viewerId === du.a || viewerId === du.b;
    return { a: panel(du.a), b: panel(du.b), round: du.round, maxRounds: M.RULES.maxRounds,
      moves: Object.fromEntries(Object.entries(M.MOVES).map(([id, m]) => [id, { name: m.name, text: m.text }])),
      log: du.rounds.map((r) => r.text),
      ...(M.RULES.talk && Talk() ? talkView(s, du, viewerId, panel) : {}),
      vowOffer: inDuel && du.round === 1 && !du.picks[viewerId] && !viewer?.status?.mindVow,
      concede: du.concede?.by === viewerId ? concedeOptions(s) : null };
  }
  return { openDuel, recordPick, swearVow, aiPick, pickConcede, concedeOptions, applyConcede, intel, knownTo, matrixTraits, attack, resolveRound };
});
