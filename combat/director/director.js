"use strict";
// The Director (Mala, 2026-10-14/15): Set the Scene films a pocket duel.
// Spec: docs/director.md + orbit muse/director/ (RECEPTION/PREDICTS/TRAITS/ENGINE).
// Rulings (Mala 2026-10-15): Filming is his ULT (Boundary + Delegation, wheel Collage);
// freeze-frame duel (the outside battle pauses; mark vs co-star trade turns on a 5x5
// pocket set until one side dies); sealed set (nothing crosses either way; the Director
// stays on the field and his death collapses the film); early CUT allowed and counts
// as a dud (35 AP debt, no premiere, streak ends); co-star any class at random;
// mark-first duel order; immediate (unannounced) cast, range 5.
//
// State: s.film = { no, owner, markId, costarId, cameoId, turn, markPos, cameoPos,
//   saved: { order, turnIndex, arena, actors, wild, scheduled, terrainEffects, barriers,
//   successionPatches, dreamSpace, roundEnvironmentProcessed } }.
// While s.film holds, s.actors/s.order/s.arena are the duel's; the outside battle is
// stashed untouched (no turns, no environment, no outcome checks) and restored on
// collapse. The Director is stashed too, so the 0-AP lock holds by construction:
// turn-start restoration cannot reach an actor with no turns.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatDirector = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const POCKET = 5;
  // Co-star pool: the NPC roster, no player pieces, no mirror films, no office-holders.
  const COSTAR_POOL = ["arborist", "surveyor", "rainkeeper", "mason", "ecologist", "planner",
    "gardener", "actor", "supermodel", "agi", "scientist", "animalTamer", "architect",
    "soldier", "policeOfficer", "yogaInstructor", "arantxa"];
  const rules = {
    range: 5, phiCost: 16, tempoCost: 50,
    reception: { dud: 0.30, good: 0.70, smash: 0.90 },   // roll under each bar; else legendary
    dudDebt: 35, goodAP: 50, smashAP: 100, smashCharge: 10, smashChargeTurns: 2,
    cameoProc: 0.35, cameoClock: 4, sequelCost: 1,
    maxTakes: 12,   // a scene that drags gets cut early (a dud): duels always end
  };
  function roll(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const hasT = (a, t) => (a.traits || []).some((x) => (typeof x === "string" ? x : x?.id) === t);
  const detailMul = (a) => hasT(a, "attentionToDetail") ? 1.25 : 1;   // sturdier craft

  function pocketArena() {
    return { name: "Pocket Set", w: POCKET, h: POCKET,
      map: Array.from({ length: POCKET }, () => ".".repeat(POCKET)),
      height: Array.from({ length: POCKET }, () => Array(POCKET).fill(0)),
      objects: [], structures: [] };
  }
  const activeFilm = (s) => s.film || null;
  const sequelReady = (s, a) => hasT(a, "awardWinningDirector") && (a.inspiration || 0) >= rules.sequelCost;

  function canCast(s, a, mark, H, { paid = false } = {}) {
    if (s.film) return { ok: false, reason: "A film is already shooting." };
    if (!mark || mark.defeated) return { ok: false, reason: "Choose an opponent." };
    if (mark.side === a.side) return { ok: false, reason: "The camera traps an opponent, not your own cast." };
    if ((H.dist ? H.dist(s, a.x, a.y, mark.x, mark.y) : 99) > rules.range) return { ok: false, reason: `Set the Scene reaches ${rules.range} tiles.` };
    if (H.hasSight && !H.hasSight(s, a.x, a.y, mark.x, mark.y)) return { ok: false, reason: "You need a clear view of your star." };
    if (!paid && a.ultimateCharge < (s.rules?.ultimateChargeMax ?? 100) && !sequelReady(s, a))
      return { ok: false, reason: "A first film needs a full ultimate bar; a sequel costs 1 Inspiration.", sequel: false };
    return { ok: true, sequel: !paid && a.ultimateCharge < (s.rules?.ultimateChargeMax ?? 100) };
  }

  function registerActor(s, u, H) {
    s.actors[u.id] = u; s.disclosures[u.id] = {}; s.knowledge[u.id] = {};
    if (s.observedAbilities) s.observedAbilities[u.id] = [];
    if (H.insightRules) {
      const deck = H.insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed });
      s.insight.decks[u.id] = deck; s.insight.knowledge[u.id] = H.insightRules.spawnKnowledge(deck);
    }
    for (const other of Object.values(s.actors)) if (other.id !== u.id && other.side !== u.side) {
      (s.knowledge[other.id] ||= {})[u.id] ||= { secondary: false, lens: false, abilities: {} };
      s.knowledge[u.id][other.id] = { secondary: false, lens: false, abilities: {} };
    }
  }
  function baseFighter(o) {
    return { ...o, controller: "ai", pf: 30, maxPF: 30, ultimateCharge: 0, lastChargeConcept: null, quickenedSpent: {},
      level: 1, xp: 0, proficiency: 1, reserve: [], reserveSlots: 0, pendingSwap: null, focus: null,
      reaction: 1, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0,
      actionsThisTurn: 0, guardUsedThisTurn: false, ownerTurns: 0, lastRecoverTurn: -99,
      status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null },
      inventory: [], inventoryCapacity: 0, passives: {}, traits: [], conditions: {}, lastDamageType: null, defeated: false };
  }
  function coStarChar(s, no) {
    return COSTAR_POOL[Math.floor(roll(s.seed, `film:${no}:costar`) * COSTAR_POOL.length)];
  }

  function cast(s, a, mark, H, opts) {
    const chk = canCast(s, a, mark, H, opts);
    if (!chk.ok) return chk;
    const C = H.C, no = (s.filmSeq || 0) + 1; s.filmSeq = no;
    const charKey = coStarChar(s, no), ch = C.characters[charKey], cfg = ch.configs[0];
    const costarLF = Math.max(1, Math.round(mark.maxLF * detailMul(a)));   // an even fight, at the mark's scale
    const costarId = `film-costar-${no}`;
    const costar = baseFighter({ id: costarId, character: charKey, name: ch.name, side: a.side, sprite: ch.sprite, ai: ch.ai || null,
      posture: "aggressive", primary: cfg.primary, secondary: cfg.secondary, selectedConfig: cfg, lens: { ...(cfg.lens || {}) },
      maxLF: costarLF, lf: costarLF, x: 3, y: 2, filmCostar: { no, owner: a.id } });
    registerActor(s, costar, H);
    // The cameo teleports in alongside the star and the co-star (two on one).
    let cameoId = null, cameoPos = null;
    const cameo = Object.values(s.actors).find((u) => u.cameo?.owner === a.id && !u.defeated);
    if (cameo) { cameoId = cameo.id; cameoPos = [cameo.x, cameo.y]; cameo.x = 3; cameo.y = 1; }
    const duel = new Set([mark.id, costarId, ...(cameoId ? [cameoId] : [])]);
    const saved = { order: s.order.slice(), turnIndex: s.turnIndex, arena: s.arena, actors: {},
      wild: s.wild, scheduled: s.scheduled, terrainEffects: s.terrainEffects, barriers: s.barriers,
      successionPatches: s.successionPatches, dreamSpace: s.dreamSpace || null,
      roundEnvironmentProcessed: s.roundEnvironmentProcessed };
    for (const [id, u] of Object.entries(s.actors)) if (!duel.has(id)) { saved.actors[id] = u; delete s.actors[id]; }
    const markPos = [mark.x, mark.y];
    mark.x = 1; mark.y = 2;
    s.wild = []; s.scheduled = []; s.terrainEffects = []; s.barriers = []; s.successionPatches = []; s.dreamSpace = null;
    s.arena = pocketArena();
    s.order = [mark.id, costarId, ...(cameoId ? [cameoId] : [])];   // the mark moves first: no alpha strike on the trapped
    s.turnIndex = 0;
    for (const id of s.order) if (s.actors[id]) s.actors[id].reaction = s.rules.reactionsPerRound;
    s.film = { no, owner: a.id, markId: mark.id, costarId, cameoId, turn: 1, markPos, cameoPos, costarChar: charKey, saved };
    for (const u of [mark, costar, cameo]) if (u) u.status.trapped = { no };   // the set is enclosed: no way off but through (Mala, 2026-10-19)
    if (H.startTurn) H.startTurn(s);   // the cameras roll now: the mark's turn starts immediately
    const ev = [`${a.name} calls ACTION! ${mark.name} is trapped on a pocket set with ${costar.name}.`,
      cameo ? `${cameo.name} teleports in: two on one.` : null,
      "The set is enclosed: no way off but through.",
      "The outside battle holds its breath. Take 1."].filter(Boolean);
    for (const text of ev) H.log(s, { kind: "film", actor: a.id, target: mark.id, text });
    return { ok: true, sequel: chk.sequel };
  }

  // The duel order wrapped: a new take, not a new round. Reactions reset; the
  // outside round, weather, wild and scheduled events stay frozen.
  function filmWrap(s, H) {
    const f = s.film; if (!f) return;
    f.turn += 1;
    for (const id of s.order) if (s.actors[id]) s.actors[id].reaction = s.rules.reactionsPerRound;
    H.log(s, { kind: "film", actor: f.owner, text: `Take ${f.turn}.` });
    if (f.turn > rules.maxTakes) {   // a scene that drags gets cut: a dud, no premiere
      H.log(s, { kind: "film", actor: f.owner, text: "The scene drags past its twelfth take. That is a wrap, and a dud." });
      collapse(s, H, "early");
    }
  }

  function duelState(s) {
    const f = s.film; if (!f) return null;
    const mark = s.actors[f.markId], costar = s.actors[f.costarId], cameo = f.cameoId ? s.actors[f.cameoId] : null;
    return { mark, costar, cameo };
  }
  // After every duel turn: CUT (the mark fell), ruin (the cast fell), or
  // nothing yet. A routed mark stays: the set is enclosed (Mala, 2026-10-19).
  function resolveCheck(s) {
    const f = s.film; if (!f) return null;
    const { mark, costar, cameo } = duelState(s);
    if (!mark || mark.defeated) return "cut";
    const castGone = !costar || costar.defeated;
    const cameoGone = !cameo || cameo.defeated;
    if (castGone && (!f.cameoId || cameoGone)) return "ruin";
    return null;
  }

  function receptionFor(v) {
    if (v < rules.reception.dud) return "dud";
    if (v < rules.reception.good) return "good";
    if (v < rules.reception.smash) return "smash";
    return "legendary";
  }
  const RECEPTION_NAME = { dud: "Dud", good: "Good", smash: "Smash hit", legendary: "Legendary" };
  function stripStreak(owner, H, s) {
    if (hasT(owner, "awardWinningDirector")) {
      owner.traits = (owner.traits || []).filter((t) => (typeof t === "string" ? t : t?.id) !== "awardWinningDirector");
      H.log(s, { kind: "film", actor: owner.id, text: "The flop ends the streak: Award Winning Director is gone." });
    }
  }
  function applyReception(s, f, outcome, owner, H) {
    const cap = s.rules.maxBankedActionPoints ?? 100;
    H.log(s, { kind: "premiere", actor: f.owner, reception: outcome,
      text: `PREMIERE: ${RECEPTION_NAME[outcome]}! The battle learns how the film was received.` });
    if (outcome === "dud") {
      owner.tempoDebt = (owner.tempoDebt || 0) + rules.dudDebt;
      H.log(s, { kind: "film", actor: f.owner, text: `A dud. ${owner.name} owes ${rules.dudDebt} AP next turn.` });
      stripStreak(owner, H, s);
    } else if (outcome === "good") {
      const room = Math.max(0, cap - (owner.bankedTempo || 0)), add = Math.min(rules.goodAP, room);
      owner.bankedTempo = (owner.bankedTempo || 0) + add;
      H.log(s, { kind: "film", actor: f.owner, text: `A good film. ${owner.name} banks ${add} AP${add < rules.goodAP ? " (the rest overflows)" : ""}.` });
    } else if (outcome === "smash") {
      const room = Math.max(0, cap - (owner.bankedTempo || 0)), add = Math.min(rules.smashAP, room);
      owner.bankedTempo = (owner.bankedTempo || 0) + add;
      owner.status.directorSmash = { turnsLeft: rules.smashChargeTurns };
      H.log(s, { kind: "film", actor: f.owner, text: `A smash hit! ${owner.name} banks ${add} AP and builds ${rules.smashCharge} charge a turn for ${rules.smashChargeTurns} turns.` });
    } else {
      if (!hasT(owner, "awardWinningDirector")) {
        owner.traits = [...(owner.traits || []), "awardWinningDirector"];
        H.log(s, { kind: "film", actor: f.owner, text: `${owner.name} is now an Award Winning Director: +1 Inspiration every turn, and 1 Inspiration films a sequel.` });
      }
    }
  }

  function forgetActor(s, id) {
    delete s.actors[id]; delete s.knowledge[id]; delete s.disclosures[id];
    if (s.observedAbilities) delete s.observedAbilities[id];
    if (s.insight?.decks) delete s.insight.decks[id];
    if (s.insight?.knowledge) delete s.insight.knowledge[id];
  }
  function collapse(s, H, kind) {
    const f = s.film; if (!f) return;
    const sv = f.saved, owner = sv.actors[f.owner];
    if (kind === "cut") {
      H.log(s, { kind: "film", actor: f.owner, text: `${owner?.name || "The Director"} yells "CUT!"` });
      const outcome = receptionFor(roll(s.seed, `film:${f.no}:reception`));
      if (owner) applyReception(s, f, outcome, owner, H);
    } else {   // ruin, or an early wrap: same bill, no premiere
      if (kind === "early") H.log(s, { kind: "film", actor: f.owner, text: "CUT! (early) That is a wrap, and a dud: no premiere." });
      else H.log(s, { kind: "film", actor: f.owner, text: `"You've ruined my film!" The cast is dead: a dud, ${rules.dudDebt} AP owed, no premiere.` });
      if (owner) { owner.tempoDebt = (owner.tempoDebt || 0) + rules.dudDebt; stripStreak(owner, H, s); }
    }
    // The mark keeps what the duel did (including death); the co-star's contract is complete.
    const mark = s.actors[f.markId];
    if (mark) { mark.x = f.markPos[0]; mark.y = f.markPos[1]; delete mark.status.trapped; }
    forgetActor(s, f.costarId);
    const cameo = f.cameoId ? s.actors[f.cameoId] : null;
    if (cameo && f.cameoPos) { cameo.x = f.cameoPos[0]; cameo.y = f.cameoPos[1]; delete cameo.status.trapped; }   // back to the field, clock resumes, no longer trapped
    for (const [id, u] of Object.entries(sv.actors)) s.actors[id] = u;
    if (owner) owner.tempo = 0;   // his turn ended when the cameras rolled; what is banked waits for his next turn
    s.order = sv.order; s.turnIndex = sv.turnIndex;   // advance() moves to the next outside actor
    s.arena = sv.arena; s.wild = sv.wild; s.scheduled = sv.scheduled; s.terrainEffects = sv.terrainEffects;
    s.barriers = sv.barriers; s.successionPatches = sv.successionPatches; s.dreamSpace = sv.dreamSpace;
    s.roundEnvironmentProcessed = sv.roundEnvironmentProcessed;
    s.film = null;
    H.log(s, { kind: "film", actor: f.owner, text: "The set strikes. The battle resumes." });
  }

  function callCut(s, a, H) {
    const f = s.film;
    if (!f || f.owner !== a.id) return "No film of yours is shooting.";
    collapse(s, H, "early");
    return null;
  }

  // Knows People: 35% at each of his turn starts, only with no live cameo.
  function directorTurnStart(s, a, H) {
    if (hasT(a, "awardWinningDirector") && H.inspire) H.inspire(s, a, 1, "Award Winning Director: the prestige keeps coming.");
    if (a.status?.directorSmash?.turnsLeft > 0) {
      const max = s.rules.ultimateChargeMax ?? 100, before = a.ultimateCharge || 0;
      a.ultimateCharge = Math.min(max, before + rules.smashCharge);
      a.status.directorSmash.turnsLeft -= 1;
      if (a.status.directorSmash.turnsLeft <= 0) delete a.status.directorSmash;
      H.log(s, { kind: "film", actor: a.id, text: `${a.name} rides the smash hit: +${a.ultimateCharge - before} charge (${a.ultimateCharge}/${max}).` });
    }
    if (!hasT(a, "knowsPeople")) return;
    if (Object.values(s.actors).some((u) => u.cameo?.owner === a.id && !u.defeated)) return;
    if (roll(s.seed, `cameo:${a.id}:${a.ownerTurns}`) >= rules.cameoProc) return;
    const C = H.C, ch = C.characters.actor, cfg = ch.configs[0];
    const open = ([x, y]) => H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove && !H.actorAt(s, x, y)
      && !(H.barrierAt && H.barrierAt(s, x, y)) && !(s.wild || []).some((m) => m.form === "unit" && m.x === x && m.y === y);
    const at = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [a.x + dx, a.y + dy]).find(open);
    if (!at) return;   // no room beside him this turn: the Actor tries again on his next
    const lf = Math.max(1, Math.round((s.rules.maxLF || 38) * detailMul(a)));
    // Costume alternation (mirror rule in engine/queries.js actorLook): opposite of any live Actor, else a seeded flip.
    const liveLook = Object.values(s.actors).find((u) => !u.defeated && (ch.variants || []).includes(u.sprite))?.sprite;
    const cameoLook = liveLook ? ch.variants.find((v) => v !== liveLook) : ch.variants?.[Math.floor(roll(s.seed, `cameo-look:${a.id}:${a.ownerTurns}`) * ch.variants.length)] || ch.sprite;
    const u = baseFighter({ id: `cameo-${a.id}`, character: "actor", name: "The Actor (cameo)", side: a.side, sprite: cameoLook, ai: ch.ai || null,
      posture: "aggressive", primary: cfg.primary, secondary: cfg.secondary, selectedConfig: cfg, lens: { ...(cfg.lens || {}) },
      maxLF: lf, lf, x: at[0], y: at[1], cameo: { owner: a.id, turnsLeft: rules.cameoClock } });
    registerActor(s, u, H);
    if (!s.order.includes(u.id)) s.order.splice(s.turnIndex + 1, 0, u.id);
    H.log(s, { kind: "film", actor: u.id, target: a.id, tiles: [at], text: `The Actor wanders onto ${a.name}'s set for ${rules.cameoClock} turns: a cameo.` });
  }
  function cameoTurnStart(s, a, H) {
    if (!a.cameo || s.film) return;   // the clock is suspended while inside a film
    a.cameo.turnsLeft -= 1;
    if (a.cameo.turnsLeft > 0) return;
    H.log(s, { kind: "film", actor: a.id, text: `${a.name} leaves to film other movies.` });
    forgetActor(s, a.id);
    s.order = s.order.filter((id) => id !== a.id);
  }
  function turnStart(s, a, H) {
    if (a.defeated) return;
    if (a.cameo) cameoTurnStart(s, a, H);
    else if (a.character === "director" || hasT(a, "knowsPeople") || hasT(a, "awardWinningDirector")) directorTurnStart(s, a, H);
  }

  // Film value = the mark's removal + reception EV (+29.5 AP) − ruin risk.
  // Film the piece that is beating you; never film from ahead by 2+ bodies.
  function aiValue(s, a, cand, H) {
    if (s.film) return 0;
    const max = s.rules.ultimateChargeMax ?? 100;
    if (a.ultimateCharge < max && !sequelReady(s, a)) return 0;
    const mark = cand.target && H.actorAt ? H.actorAt(s, cand.target[0], cand.target[1]) : null;
    if (!mark || mark.side === a.side || mark.defeated) return 0;
    const live = Object.values(s.actors).filter((u) => !u.defeated && !u.notArrived);
    const mine = live.filter((u) => u.side === a.side).length, theirs = live.filter((u) => u.side !== a.side).length;
    if (mine - theirs >= 2) return 0;   // filming while winning stalls his own win
    const threat = mark.maxLF / 12 + (mark.ultimateCharge >= max ? 2 : 0);
    const friend = Object.values(s.actors).some((u) => u.cameo?.owner === a.id && !u.defeated) ? 2 : 0;
    const easyCut = mark.lf <= mark.maxLF * 0.35 ? 1 : 0;
    return 5 + threat + friend + easyCut;
  }

  // ── class-runtime sub-module convention (target/resolve/aiValue return null/false unless ours) ──
  const IDS = new Set(["setTheScene"]);
  function target(s, a, m, tx, ty, H) {
    const id = m.id || m.ability; if (!IDS.has(id)) return null;
    const fail = (error) => ({ ok: false, error });
    if (tx == null || !H.inside(s, tx, ty)) return fail("Choose a tile.");
    const mark = H.actorAt(s, tx, ty);
    const chk = canCast(s, a, mark, H);
    if (!chk.ok) return fail(chk.reason);
    return { ok: true, tiles: [[tx, ty]], targets: [mark.id] };
  }
  function resolve(s, a, inst, H) {
    if (!IDS.has(inst.ability)) return false;
    // Announced: the trap springs on the committed tile. A mark that dodged out of frame is missed, not followed.
    const [tx, ty] = inst.tiles?.[0] || [];
    const framed = tx == null ? null : H.actorAt(s, tx, ty);
    const billed = inst.targets?.[0] ? H.actor(s, inst.targets[0]) : null;
    const mark = framed && framed.side !== a.side && !framed.defeated ? framed : null;
    if (!mark) {
      H.log(s, { kind: "act", actor: a.id, fizzled: true, text: `Set the Scene fizzles: ${billed?.name || "the mark"} slipped out of frame.` });
      return true;
    }
    const chk = canCast(s, a, mark, H, { paid: true });
    if (!chk.ok) { H.log(s, { kind: "act", actor: a.id, fizzled: true, text: `Set the Scene fizzles: ${chk.reason}` }); return true; }
    cast(s, a, mark, H, { paid: true });
    return true;
  }
  function aiValueForClass(s, a, cand, H) {
    if (cand.ability !== "setTheScene") return null;
    return aiValue(s, a, cand, H);
  }

  return { rules, COSTAR_POOL, IDS, pocketArena, activeFilm, sequelReady, canCast, cast, filmWrap,
    resolveCheck, receptionFor, collapse, callCut, turnStart, aiValue: aiValueForClass, filmValue: aiValue, target, resolve };
});
