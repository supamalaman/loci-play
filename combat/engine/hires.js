"use strict";
// Mercs and Mediators (Mala, 2026-10-18; docs/mercs-and-mediators.md). Help you prepare for: a Merc Contract or a Letter
// of Safe Conduct bought at the town's Hiring Hall, packed like any consumable, and used in battle (one call of each
// kind a battle). Whoever answers arrives at the start of the next round beside the caller.
//
//   Merc: a roster fighter on the caller's side for `turns` of its own turns. Paid, not loyal: it leaves when its contract
//     runs out, or the first time it ends a turn below `retreatAt` of its Life Force.
//   Kin (Sita, 2026-10-24; docs/sita-build.md): family, not hired. Called by a character's `calls` (Call of Faith) or sent
//     ahead by `heralds` (Rama on his way to Sita). No contract, no pay, no retreat: kin stay until the battle ends, even if
//     the caller falls. They arrive as themselves: their startStates (Hanuman, Forgotten) and learned techniques come too.
//   Mediator: never fights, and carries the letter: no one may make a hostile move against them (Parley.blocks). Each of
//     its turns it asks one enemy for a truce. Yes: that enemy stands down (no hostile moves) and the caller's side may not
//     attack it either, for `truceRounds` rounds; the caller may try to come to terms meanwhile. No: the enemy loses
//     `refusalTempoTax` AP listening. After `refusals` refusals, or `attempts` asks, the mediator goes home. The same enemy
//     can't be asked again until a round after its last truce ends. Omega bosses answer at `chance.boss`.
//
// Numbers: items-data.js `hires`. A part of the Concept Combat engine: engine.js installs it with the host object H.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).hires = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const spiritGone = (s, u) => { const Spirit = (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null; Spirit?.onExit?.(s, u, H); };   // SP-05: every exit refreshes the roster
    const { C, Parley, accountItems, actorAt, barrierAt, dist, inside, insightRules, log, tileAt } = H;
    const R = () => accountItems?.hires || null;
    const live = (u) => !!u && !u.defeated && !u.escaped && !u.notArrived;
    const book = (s) => (s.hires ||= { called: {}, pending: [] });
    const kindOf = (item) => accountItems?.consumables?.[item]?.effect?.hire || null;
    const traits = (u) => new Set((u?.traits || []).map((t) => (typeof t === "string" ? t : t?.id)));

    // Who answers: the first of the pool (in a seeded order) who isn't the caller's own character or already on the field.
    function answerer(s, a, kind) {
      const side = Object.values(s.actors).filter((u) => u.side === a.side && !u.defeated).map((u) => u.character);   // feud: nobody joins a side their crew is at war with
      const pool = (R()?.[kind]?.pool || []).filter((id) => C.characters[id] && id !== a.character
        && !Object.values(s.actors).some((u) => u.character === id && !u.defeated) && (!H.Factions || H.Factions.fits(s.rules, id, side)));
      if (!pool.length) return null;
      return pool[Math.floor(H.seededChance(`${s.seed}:hire:${kind}:${a.id}`) * pool.length) % pool.length];
    }

    // The useItem branch for a contract or a letter. Returns an error string, or nothing when it worked.
    function call(s, a, item, def) {
      const kind = kindOf(item), rules = R()?.[kind];
      if (!rules) return "Nobody answers that.";
      if (book(s).called[`${a.side}:${kind}`]) return `Your side has already called ${kind === "merc" ? "a merc" : "a mediator"} this battle.`;
      const who = answerer(s, a, kind); if (!who) return "Nobody is free to answer.";
      const spendError = H.spendTempo(s, a, s.rules.actionCosts.utility, `Use ${def.name}`); if (spendError) return spendError;
      a.inventory.splice(a.inventory.indexOf(item), 1);
      book(s).called[`${a.side}:${kind}`] = s.round;
      book(s).pending.push({ kind, owner: a.id, character: who, round: s.round + (rules.delay ?? 1) });
      const name = C.characters[who].name;
      log(s, { kind: "hire", actor: a.id, hire: kind, character: who, tiles: [[a.x, a.y]],
        text: kind === "merc" ? `${a.name} sends the contract. ${name} will be here next round.` : `${a.name} sends the letter of safe conduct. ${name} will come to talk next round.`,
        why: [kind === "merc" ? `A merc fights for ${rules.turns} of their turns and leaves if they end a turn below ${Math.round(rules.retreatAt * 100)}% LF.` : `A mediator never fights and no one may attack them. They ask one enemy a turn for a ${rules.truceRounds}-round truce; ${rules.refusals} refusals or ${rules.attempts} asks and they go home.`] });
    }

    // Start of a round: whoever was called last round arrives beside their caller (or waits a round if there's no room).
    function roundStart(s) {
      heralds(s);
      for (const u of Object.values(s.actors)) if (u.hired && u.hired.kind !== "kin" && live(u) && !live(s.actors[u.hired.owner])) {
        u.defeated = true; u.escaped = true; u.leaveReason = "has no one left to work for and leaves"; u.tempo = 0; spiritGone(s, u);
        log(s, { kind: "hire", actor: u.id, left: true, tiles: [[u.x, u.y]], text: `${u.name} has no one left to work for and leaves.` });
      }
      const B = s.hires; if (!B?.pending?.length) return;
      for (const p of B.pending.slice()) {
        if (p.round > s.round) continue;
        const owner = s.actors[p.owner];
        if (!live(owner)) { B.pending.splice(B.pending.indexOf(p), 1); continue; }   // the caller is down: nobody comes
        const at = openNear(s, owner); if (!at) continue;
        B.pending.splice(B.pending.indexOf(p), 1);
        spawn(s, owner, p, at);
      }
    }
    // Kin: who can still come (a character not standing on the field), and the call itself.
    const onField = (s, id) => Object.values(s.actors).some((u) => u.character === id && !u.defeated && !u.escaped);
    const pendingFor = (s, id) => (s.hires?.pending || []).some((p) => p.character === id);
    // Rule 6 (Mala, 2026-10-24: techniques work for anyone): a character with no `calls` of their own calls their own crew,
    // in roster order (a Warden holding Sita's pair calls a fellow Rogue). Sita's `calls` name her house, in her order.
    const callsOf = (a) => C.characters[a.character]?.calls || (C.characters[a.character]?.subfaction ? Object.keys(C.characters).filter((id) => C.characters[id].subfaction === C.characters[a.character].subfaction && !C.characters[id].permanentAlly && !C.characters[id].randomEventOnly && Array.isArray(C.characters[id].configs) && id !== "control") : []);   // the random roster's filters
    function kinFor(s, a) { const side = Object.values(s.actors).filter((u) => u.side === a.side && !u.defeated).map((u) => u.character);   // feud: nobody joins a side their crew is at war with
      return callsOf(a).find((id) => C.characters[id] && id !== a.character && !onField(s, id) && !pendingFor(s, id) && (!H.Factions || H.Factions.fits(s.rules, id, side))) || null; }
    function callKin(s, a, who, { delay = 1, why = null } = {}) {
      book(s).pending.push({ kind: "kin", owner: a.id, character: who, round: s.round + delay });
      log(s, { kind: "hire", actor: a.id, hire: "kin", character: who, tiles: [[a.x, a.y]], text: `${a.name} calls ${C.characters[who].name}: ${C.characters[who].name} will be here ${delay === 1 ? "next round" : `in ${delay} rounds`}.`, why: why ? [why] : [] });
    }
    // Round 1: a unit whose character heralds another (Sita heralds Rama) has them already on the way, on a seeded chance.
    function heralds(s) {
      if (s.round !== 1 || s.heraldsRolled) return;
      const who = Object.values(s.actors).filter((u) => live(u) && C.characters[u.character]?.heralds); if (!who.length) return;
      s.heraldsRolled = true;
      for (const u of who) { const h = C.characters[u.character].heralds;
        if (!C.characters[h.character] || onField(s, h.character) || pendingFor(s, h.character)) continue;
        if (H.Factions && !H.Factions.fits(s.rules, h.character, Object.values(s.actors).filter((v) => v.side === u.side && !v.defeated).map((v) => v.character))) continue;   // feud
        if (H.seededChance(`${s.seed}:herald:${u.id}`) < (h.chance ?? 1)) callKin(s, u, h.character, { delay: h.delay ?? 1, why: h.why || null }); }
    }
    function openNear(s, a) {
      const free = ([x, y]) => inside(s, x, y) && !tileAt(s, x, y).blocksMove && !actorAt(s, x, y) && !barrierAt(s, x, y) && !(s.wild || []).some((m) => m.form === "unit" && m.x === x && m.y === y);
      for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free([a.x + dx, a.y + dy])) return [a.x + dx, a.y + dy];
      return null;
    }
    function spawn(s, owner, p, at) {
      const rules = p.kind === "kin" ? {} : R()[p.kind], ch = C.characters[p.character], cfg = (ch.configs || [])[0] || {};
      const relics = p.kind === "kin" && H.relicPassives ? H.relicPassives({}, p.character) : {};   // kin who arrive mid-battle carry their story relics too (Mala's ruling; 1.3.461 audit)
      const lf = (ch.maxLF || s.rules.maxLF) + (relics.maxLFAdd || 0);
      const u = { id: p.kind === "kin" ? `kin-${p.character}-${owner.id}` : `hired-${p.kind}-${owner.id}`, learned: (ch.learned || []).slice(), name: ch.name, side: owner.side, controller: "ai", ai: "ally", character: p.character, sprite: ch.sprite,
        primary: cfg.primary || ch.primary, secondary: cfg.secondary || ch.secondary, maxLF: lf, lf, x: at[0], y: at[1],
        hired: { kind: p.kind, owner: owner.id, turnsLeft: p.kind === "merc" ? rules.turns : null, attempts: 0, refusals: 0 }, safeConduct: p.kind === "mediator",
        pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: Math.min(s.rules.ultimateChargeMax ?? 100, relics.startingUltimateCharge || 0), level: owner.level || 1, xp: 0, proficiency: owner.proficiency || 1, reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
        reaction: s.rules.reactionsPerRound, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false,
        ownerTurns: 0, lastRecoverTurn: -99, status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null }, inventory: [], inventoryCapacity: 0,
        passives: relics, traits: (ch.traits || []).slice(), conditions: {}, lanyardUsed: false, bristleconeUsed: false, lastDamageType: null, defeated: false };
      s.actors[u.id] = u; s.disclosures[u.id] = {}; s.knowledge[u.id] = {}; if (s.observedAbilities) s.observedAbilities[u.id] = [];
      if (insightRules) { const deck = insightRules.buildDeck({ key: p.character, kind: "character" }, { seed: s.seed }); s.insight.decks[u.id] = deck; s.insight.knowledge[u.id] = insightRules.spawnKnowledge(deck); }
      for (const other of Object.values(s.actors)) if (other.id !== u.id && other.side !== u.side) { (s.knowledge[other.id] ||= {})[u.id] ||= { secondary: false, lens: false, abilities: {} }; s.knowledge[u.id][other.id] = { secondary: false, lens: false, abilities: {} }; }
      s.order.push(u.id);
      if (p.kind === "kin") for (const id of ch.startStates || []) H.States?.grant(s, u, id);   // kin arrive as themselves (Hanuman: Forgotten)
      log(s, { kind: "hire", actor: u.id, target: owner.id, arrived: true, hire: p.kind, tiles: [at],
        text: p.kind === "kin" ? `${u.name} answers ${owner.name}'s call and takes the field.` : p.kind === "merc" ? `${u.name} arrives on contract to fight beside ${owner.name}.` : `${u.name} arrives under a letter of safe conduct to talk for ${owner.name}.` });
    }

    // End of a hired unit's own turn: the merc's clock and nerve, the mediator's patience.
    function turnEnd(s, a) {
      if (!a.hired || a.defeated || a.hired.kind === "kin") return;   // kin keep no contract
      const rules = R()?.[a.hired.kind]; if (!rules) return;
      let why = null;
      if (!live(s.actors[a.hired.owner])) why = "has no one left to work for and leaves";   // never hold a battle open for the caller's side
      else if (a.hired.kind === "merc") {
        a.hired.turnsLeft -= 1;
        if (a.lf < a.maxLF * rules.retreatAt) why = "takes the money and runs";
        else if (a.hired.turnsLeft <= 0) why = "has done what the contract paid for and leaves";
      } else {
        // A turn without an ask counts toward going home, unless it was only waiting out a truce it made (or its cooldown).
        const waiting = Object.values(s.actors).some((t) => live(t) && t.truce?.by === a.id && s.round <= t.truce.until + 1);
        a.hired.idle = a.hired.asked || waiting ? 0 : (a.hired.idle || 0) + 1; a.hired.asked = false;
      }
      if (why || a.hired.kind !== "mediator") { /* decided above */ }
      else if (a.hired.refusals >= rules.refusals) why = "folds the letter away: there's nothing more to say";
      else if (a.hired.attempts >= rules.attempts) why = "has done all the talking they can and goes home";
      else if ((a.hired.idle || 0) >= rules.idleTurns) why = "finds no one here who will talk and goes home";
      if (!why) return;
      a.defeated = true; a.escaped = true; a.leaveReason = why; a.tempo = 0; spiritGone(s, a);
      log(s, { kind: "hire", actor: a.id, left: true, tiles: [[a.x, a.y]], text: `${a.name} ${why}.` });
      H.checkOutcome(s);
    }

    // Can this mediator ask `t` for a truce now? null = yes, otherwise why not.
    function cannotAsk(s, m, t) {
      const rules = R().mediator;
      if (!live(t) || t.side === m.side || t.side === "bystander" || t.wild || t.persuaded) return "There's no one to ask.";
      const tongue = Parley?.language(m, t); if (tongue) return tongue;
      if (Parley?.locked(s, m.id, t.id)) return `${t.name} has refused this mediator for good.`;
      if (Parley?.willingness(s, t)?.unforgiving) return Parley.willingness(s, t).note;
      if (t.truce && t.truce.until >= s.round) return `${t.name} is already under a truce.`;
      if (t.truce && s.round <= t.truce.until + 1) return `${t.name} won't hear another truce until round ${t.truce.until + 2}.`;
      if (m.tempo < (rules.cost ?? s.rules.actionCosts.utility)) return `Asking for a truce needs ${rules.cost ?? s.rules.actionCosts.utility} action points.`;
      return null;
    }
    function truceChance(s, m, t) {
      const rules = R().mediator, tr = traits(t);
      const base = t.boss || t.massive ? rules.chance.boss : rules.chance.base;
      const lean = (tr.has("stubborn") ? -0.15 : 0) + (tr.has("agreeable") ? 0.15 : 0);
      const p = base + (Parley?.persuasion(m) || 0) + lean + Math.max(0, Parley?.willingness(s, t)?.add || 0);
      return Math.max(0.05, Math.min(t.boss || t.massive ? rules.chance.bossMax : rules.chance.max, p));   // an Omega threat never above bossMax
    }
    function mediate(s, m, act) {
      if (!m.hired || m.hired.kind !== "mediator") return "Only a mediator can ask for a truce.";
      const t = s.actors[act.target], no = cannotAsk(s, m, t); if (no) return no;
      const rules = R().mediator, spendError = H.spendTempo(s, m, rules.cost ?? s.rules.actionCosts.utility, "Ask for a truce"); if (spendError) return spendError;
      const p = truceChance(s, m, t), ok = H.seededChance(`${s.seed}:truce:${m.id}>${t.id}:${s.round}:${m.hired.attempts}`) < p;
      m.hired.attempts += 1; m.hired.asked = true;   // turnEnd: a turn with no ask counts toward going home (rules.idleTurns)
      if (ok) {
        t.standDownUntil = Math.max(t.standDownUntil || 0, s.round + rules.truceRounds - 1);
        t.truce = { side: m.side, by: m.id, until: s.round + rules.truceRounds - 1 };
        log(s, { kind: "truce", actor: m.id, target: t.id, tiles: [[t.x, t.y]], text: `${m.name} talks ${t.name} into a truce: no hostile moves either way until round ${t.truce.until + 1}.`,
          why: [`Chance ${Math.round(p * 100)}%${t.boss || t.massive ? " (an Omega threat hears it at the harshest odds)" : ""}.`, "While it holds, coming to terms is possible."] });
      } else {
        m.hired.refusals += 1;
        t.tempoDebt = (t.tempoDebt || 0) + rules.refusalTempoTax;
        log(s, { kind: "truce", actor: m.id, target: t.id, refused: true, tiles: [[t.x, t.y]], text: `${t.name} hears ${m.name} out and refuses. Listening costs them ${rules.refusalTempoTax} AP.`,
          why: [`Chance was ${Math.round(p * 100)}%. Refusals: ${m.hired.refusals}/${rules.refusals}.`] });
        if (m.hired.refusals >= rules.refusals) Parley?.lock(s, m.id, t.id);
      }
      m.acted = true;
    }

    // AI: a caller with a contract in hand uses it at once (help takes a round to come); a mediator only ever asks for a
    // truce, the strongest enemy it can ask first, and otherwise waits.
    function aiAction(s, a) {
      if (a.hired?.kind === "mediator") {
        const asks = Object.values(s.actors).filter((t) => !cannotAsk(s, a, t)).sort((x, y) => (y.boss ? 1 : 0) - (x.boss ? 1 : 0) || y.lf - x.lf);
        if (asks.length) return { type: "mediate", actor: a.id, target: asks[0].id };
        return { type: a.tempo > 0 ? "stall" : "end", actor: a.id };
      }
      for (const item of a.inventory || []) {
        const kind = kindOf(item); if (!kind || s.hires?.called?.[`${a.side}:${kind}`]) continue;
        if (!Object.values(s.actors).some((t) => live(t) && t.side !== a.side && t.side !== "bystander")) continue;
        if (a.tempo >= s.rules.actionCosts.utility) return { type: "useItem", actor: a.id, item, target: [a.x, a.y] };
      }
      return null;
    }

    return { Hires: { call, roundStart, turnEnd, mediate, aiAction, cannotAsk, truceChance, kindOf, callKin, kinFor } };
  })();
});
