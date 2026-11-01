"use strict";
// Hatsu Sage casting (Muse, Wave 5 custody; SPEC: muse-wave5 SAGE.md).
// Persona + behavior overlay on the frozen Control chassis. Base Control is
// NEVER touched (see tests/control.test.mjs): this module only reads the
// chassis and narrates the journey. Coaching fires through the vow-executor
// log when the Sage declares (Teach-deck reading is not wired; the battle
// log is the contact).
//
// Usage: the Teach-gated demonstration bout, plus explicit participants
// (sims, tests, dev) — the sage roster entry carries no configs/pool,
// so no draw can leak it.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSage = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // The declaration: PV by capture + sworn vow, turns 0–1 (prone timing).
  // Later turns: the journey is underway, nothing left to declare.
  function declareJourney(ownerTurns) {
    if ((ownerTurns ?? 0) > 1) return null;
    return { pv: "capture",
      vow: "capture",
      encounter: "I take this bout by capture — watch what the vow does to my hands.",
      reveal: "I swear capture because my kit holds — what does YOURS hold?" };
  }

  // Coaching: a line for every declaration the Sage makes. Teach reads these.
  const COACH = {
    pv: "A personal victory names the bout you actually want. Name yours before turn 2 — the vow pays more for it.",
    vow: "A vow spoken aloud binds the speaker AND the witnesses. Speak yours where the crowd can hear.",
    kept: "Vow kept. The dream is demonstrated, not described — that is the whole curriculum.",
    broken: "Vow broken. The price is the lesson: vows that cost nothing teach nothing.",
  };
  function coach(event) { return COACH[event] || null; }

  // Dream ladder: Sage-vs-field, wins-BY-PV rate. Pure record over battle
  // state (s.sageDream); account persistence is the integrator's call.
  // byPV = won AND the vow held: the dream demonstrated, not described.
  function recordBattle(s, won, byPV) {
    s.sageDream ||= { battles: 0, pvWins: 0 };
    s.sageDream.battles++;
    if (won && byPV) s.sageDream.pvWins++;
    return dreamRate(s);
  }
  function dreamRate(s) {
    const d = s.sageDream || { battles: 0, pvWins: 0 };
    return d.battles ? d.pvWins / d.battles : 0;
  }
  // The ladder persists: fold one battle's dream into the account totals.
  function carryDream(account, dream) {
    const a = (account && account.sageDream) || { battles: 0, pvWins: 0 };
    const d = dream || { battles: 0, pvWins: 0 };
    return { ...account, sageDream: { battles: a.battles + d.battles, pvWins: a.pvWins + d.pvWins } };
  }

  // Live wiring (AP-01 item 1; Mala 2026-10-27: Teach-invoked practice
  // bout). The engine reads is()/decide() like any persona delegate;
  // the setup screen lists demoOptions() behind the Teach toggle.
  const is = (a) => !!a && (a.character === "sage" || a.ai === "sage");
  // Prone timing: turns 0–1, undeclared, unbound — the journey opens
  // with the vow sworn through the REAL vow path (Heavy Hands: the kit
  // holds the vow; the PV intent "capture" rides the declaration).
  function decide(s, a) {
    if (!is(a)) return null;
    if ((a.ownerTurns ?? 0) > 1 || a.sageDeclared) return null;
    if ((a.vows || []).some((v) => !v.broken)) return null;
    const d = declareJourney(a.ownerTurns ?? 0);
    if (!d) return null;
    return { type: "vow", actor: a.id, target: "technique", vow: { boon: "heavyHands", restrictions: ["singleMind"] } };
  }
  // Battle-end settle: pure over actors + outcome + kept lists; ui.js
  // calls it thin and prints the lines. Returns null when no sage fought.
  function settleDemo(actors, outcome, keptActors) {
    const sage = Object.values(actors || {}).find(is);
    if (!sage) return null;
    const won = !!outcome && outcome.winner === sage.side;
    const kept = (sage.vows || []).some((v) => !v.broken) || (keptActors || []).includes(sage.id);
    const byPV = won && kept;
    const foe = Object.values(actors || {}).find((a) => !is(a) && a.name);
    const winner = won ? (sage.name || "the Sage") : (foe ? foe.name : "the Warden");
    return { won, kept, byPV, winner, lesson: coach(byPV ? "kept" : "broken") };
  }
  // The demonstration table: the Warden vs the Sage, first wall.
  function demoOptions() {
    return { encounter: "firstWall", title: "The Sage · demonstration test",
      seed: 27, startingActor: "player", focusedDreamTest: true,
      participants: [{ id: "player", character: "warden", side: "player", at: [5, 3] },
        { id: "sage", character: "sage", side: "enemy", at: [10, 6] }] };
  }

  return { declareJourney, coach, recordBattle, dreamRate, carryDream, is, decide, settleDemo, demoOptions };
});
