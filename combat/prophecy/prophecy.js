"use strict";
// Prophecy S1 (muse-prophecy-spec; specs/PROPHECY.md section 4 and specs/CLARIFY-2026-11-09-plumb.md D and E; D6-D8 R-20261109-05,
// D1-D5 R-20261108-11; Gaffrig BD, 2026-11-24). A prophet seals one vague statement with 2 or 3 readings on a foe. The readings race
// through the target's NEXT turn: the first one its own actions make true manifests (listed order breaks a tie, D6) and the others
// lapse; if its turn ends with none true, the prophecy goes unfulfilled (a miss). The prophet or the target falling first, or the two
// ending on one side, closes it as a lapse (no payoff, and not a miss). S1's carrier is the prototype card Forked Path.
//
// Readings (a closed list; cards-data.js `readings` holds their words):
//   moves  the target moves ITSELF during one of its actions: its tile changed and its own `moved` flag is set (turns.js clears the
//          flag at turn start; a push, pull or knockback never sets it, so a prophet's ally cannot shove the reading true, CLARIFY A6)
//   acts   the target makes a Strike or uses a technique (action type strike or ability), whatever it aims at (CLARIFY B)
// Payoffs are card effect rows: root (the target, for e.turns of its turns) and apGain (banked into the prophet's NEXT turn, CLARIFY A5:
// tempo gained on the target's turn would be wiped at the prophet's turn start; cap rules.maxBankedActionPoints, the Stall cap).
//
// State: s.prophecies = [{ id, prophet, target, readings: [{ on, effects }], sealedTurn, round }], plain JSON (it saves and clones).
// Pure: every engine read comes in through H (log, currentId); nothing outside `s` is written, so an AI preview resolves in its clone.
// The engine reaches this through H.Prophecy, which engine/cards.js installs (engine.js is at its size cap: no line there).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatProphecy = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ACTS = ["strike", "ability"];
  const open = (s) => s.prophecies || [];
  const openFor = (s, prophetId) => open(s).find((p) => p.prophet === prophetId) || null;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  // The public words for a reading and its payoff (D8: the readings are public). The card text (cards.js textOf) says the same.
  const PAY = { damage: (e) => `it takes ${e.potency} more ${e.type} damage`, stagger: (e) => `it is staggered ${e.ap} AP`, root: (e) => `it is rooted ${plural(e.turns, "turn")}`, apGain: (e) => `you bank ${e.n} AP for your next turn, up to the bank's limit` };
  const IF = { moves: "it moves", acts: "it makes a Strike or uses a technique" };
  const readingText = (r) => `if ${IF[r.on]}, ${r.effects.map((e) => PAY[e.key](e)).join(" and ")}`;
  const close = (s, p) => { s.prophecies = open(s).filter((q) => q !== p); };

  // Seal: the card's readings on a foe. engine/cards.js has already refused a second open prophecy (E6), so the card was not spent.
  function seal(s, prophet, card, target, H) {
    const p = { id: `pr${s.round}-${s.log.length}`, prophet: prophet.id, target: target.id, readings: card.readings.map((r) => ({ on: r.on, effects: r.effects.map((e) => ({ ...e })) })), sealedTurn: target.ownerTurns || 0, round: s.round };
    (s.prophecies ||= []).push(p);
    H.log(s, { kind: "prophecy", actor: prophet.id, target: target.id, tiles: [[target.x, target.y]], prophecy: p.id,
      text: `A prophecy settles over ${target.name}, until the end of its next turn: ${p.readings.map(readingText).join("; ")}.`.replace(/you bank/g, `${prophet.name} banks`).replace(/for your next turn/g, "for their next turn"),
      why: ["Prophecy: the readings race; the first one its own actions make true manifests, and the others lapse. If none comes true by the end of its turn, the prophecy goes unfulfilled."] });
  }
  // Lapses (lifecycle table, CLARIFY D): the prophet or the target is gone, or the two now stand on one side. No payoff, not a miss.
  function sweep(s, H) {
    for (const p of [...open(s)]) {
      const a = s.actors[p.prophet], t = s.actors[p.target];
      const why = !a || a.defeated || a.escaped ? `${a?.name || "The prophet"} has fallen` : !t || t.defeated || t.escaped ? `${t?.name || "its subject"} has fallen` : a.side === t.side ? `${a.name} and ${t.name} now stand on one side` : null;
      if (!why) continue;
      close(s, p);
      H.log(s, { kind: "prophecy", actor: p.prophet, target: p.target, prophecy: p.id, lapsed: true, text: `The prophecy lapses: ${why}.` });
    }
  }
  // The target's NEXT turn is running: its turn counter has moved past the seal, and it is the unit acting now.
  const running = (s, p, t, H) => (t.ownerTurns || 0) > p.sealedTurn && H.currentId(s) === t.id;

  // Before one of the target's actions: where it stands and whether it had moved itself yet (null when no prophecy watches it).
  function before(s, a) {
    if (!a || !open(s).some((p) => p.target === a.id)) return null;
    return { x: a.x, y: a.y };
  }
  function manifest(s, p, i, H) {
    const a = s.actors[p.prophet], t = s.actors[p.target], r = p.readings[i];
    close(s, p);
    const got = [];
    for (const e of r.effects) {
      if (e.key === "damage" && !t.defeated) { const lf = t.lf; H.hit(s, a, t, { name: null, ability: null, prophecy: true, concept: "augury", delivery: "signal", tier: "prophecy", damageType: e.type, mult: 1 }, e.potency, [], { label: "The prophecy", damageType: e.type }); got.push(`${t.name} takes ${Math.max(0, lf - t.lf)} more ${e.type} damage`); }   // S2: Double Meaning
      else if (e.key === "stagger" && !t.defeated) {   // S2: Double Meaning. The line says what the stun really did: addStun may be refused (a resist, a boss, a golden form) or capped at the AP left
        const ap0 = t.tempo, held0 = t.status?.stun?.points || 0; H.addStun(s, a, t, e.ap);
        const lost = Math.max(0, ap0 - t.tempo) + Math.max(0, (t.status?.stun?.points || 0) - held0);
        got.push(lost > 0 ? `${t.name} is staggered ${lost} AP` : `${t.name} shrugs off the stagger`);
      }
      else if (e.key === "root" && !t.defeated) { t.status.rooted = { scribed: true, label: "Rooted", owner: t.id, expiresAt: t.ownerTurns + e.turns + 1 }; got.push(`${t.name} is rooted for ${plural(e.turns, "turn")}`); }
      else if (e.key === "apGain") {
        const cap = s.rules.maxBankedActionPoints ?? 100, before = a.bankedTempo || 0;
        a.bankedTempo = Math.min(cap, before + e.n); const n = a.bankedTempo - before;
        got.push(n > 0 ? `${a.name} banks ${n} AP for their next turn` : `${a.name}'s bank is already full (${cap} AP), so nothing more is banked`);
      }
    }
    const lapsed = p.readings.length - 1;
    H.log(s, { kind: "prophecy", actor: p.prophet, target: p.target, tiles: [[t.x, t.y]], prophecy: p.id, reading: i, manifested: true,
      text: `The prophecy manifests: ${IF[r.on].replace(/^it/, t.name)}, so ${got.join(" and ") || "nothing more comes of it"}.`,
      why: [`Reading ${i + 1} of ${p.readings.length} came true first; the other ${plural(lapsed, "reading")} ${lapsed === 1 ? "lapses" : "lapse"}.`] });
  }
  // After one of the target's own actions (actions.js, beside States.afterAction): the first reading it made true, in listed order (D6).
  function after(s, a, action, pre, H) {
    sweep(s, H);
    if (!pre || !a || a.defeated) return;
    for (const p of [...open(s)]) {
      if (p.target !== a.id || !running(s, p, a, H)) continue;
      const moved = !!a.moved && (a.x !== pre.x || a.y !== pre.y);
      const i = p.readings.findIndex((r) => (r.on === "moves" ? moved : r.on === "acts" ? ACTS.includes(action.type) : false));
      if (i >= 0) manifest(s, p, i, H);
    }
  }
  // The end of a unit's turn (turns.js endTurn): a prophecy on it, with no reading true, goes unfulfilled. A card is played only on its
  // owner's turn and the target is a foe, so a prophecy is never sealed during its target's own turn: the target's first turn end after
  // the seal is always its next one, a sat-out turn included (husk, flattened, conceded: those end before turns.js counts the turn, so
  // the turn counter is not read here). True Super Speed's beat 2 is not an owner turn (turns.js turnStart): the owner turn ends at beat 1.
  function turnEnd(s, a, H) {
    sweep(s, H);
    if (!a) return;
    for (const p of [...open(s)]) {
      if (p.target !== a.id) continue;
      close(s, p);
      H.log(s, { kind: "prophecy", actor: p.prophet, target: p.target, prophecy: p.id, missed: true, text: "The prophecy goes unfulfilled.", why: [`${a.name}'s turn ended with no reading come true: a miss, and the card is spent.`] });
    }
  }
  return { ACTS, IF, PAY, readingText, openFor, seal, sweep, before, after, turnEnd };
});
