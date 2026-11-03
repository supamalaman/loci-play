"use strict";
// Scenario objectives (random scenarios, slice 3; SCENARIOS.md section 3.2; Mala, 2026-10-30: "the random battles could use more scenarios").
// Pure functions: `outcome(setup, snap, rules)` is called by modes.js for the `scenario` mode, after the generic preface (the player's side gone is
// the enemy's win, decided there), and `text(setup, snap, rules)` is the HUD chip. The scenario rides in `rules.scenario.objective`
// ({ kind, deadline, onDeadline, ...params }); `setup.zone` is the hold zone, laid once at setup from the arena.
//
// THE CLOCK (termination, docs/termination-audit.md): every objective has a deadline of at most 14 rounds (below maxRounds 40). When
// `snap.round > deadline` the battle ends with `onDeadline` ("win" or "lose"), so a side that never understands the objective still ends the fight.
//
//   survive   win at the clock; early when `clear` is set and no enemy-side unit and no rift-spawned dream monster stands
//   hold      win at the clock if a player unit stands in the zone and no enemy does; or at any time when no enemy stands; lose at the clock
//             when the zone is not held ("pushed off": a loss at the clock, nobody has to be dead; the outcome carries no nonLethal flag)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatObjectives = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const KINDS = ["survive", "hold"];
  const MAX_DEADLINE = 14;
  const alive = (u) => u && !u.defeated && (u.lf == null || u.lf > 0);
  const objectiveOf = (rules) => rules?.scenario?.objective || null;
  const inZone = (zone, u) => (zone || []).some(([x, y]) => u.x === x && u.y === y);
  const enemyStanding = (snap) => snap.units.some((u) => u.side === "enemy" && alive(u) && !u.notArrived && !u.persuaded);
  const riftStanding = (snap) => snap.units.some((u) => u.dream?.source === "randomEvent" && alive(u) && u.side !== "player");
  const lose = (reason) => ({ winner: "enemy", reason });
  const win = (reason) => ({ winner: "player", reason });

  function outcome(setup, snap, rules) {
    const o = objectiveOf(rules); if (!o || !KINDS.includes(o.kind)) return null;
    const deadline = Math.min(MAX_DEADLINE, Number(o.deadline) || MAX_DEADLINE), over = snap.round > deadline;
    if (o.kind === "survive") {
      if (o.clear && !enemyStanding(snap) && !riftStanding(snap)) return win("Nothing is left to wait out.");
      if (over) return o.onDeadline === "lose" ? lose(`Not clear by round ${deadline}.`) : win(`Survived to round ${deadline}.`);
      return null;
    }
    if (o.kind === "hold") {
      const mine = snap.units.some((u) => u.side === "player" && alive(u) && inZone(setup.zone, u)), theirs = snap.units.some((u) => u.side === "enemy" && alive(u) && inZone(setup.zone, u));
      if (!enemyStanding(snap)) return win("No one is left to take the ground.");
      if (over) return mine && !theirs ? win(`Held the ground to round ${deadline}.`) : lose("Pushed off the ground at the clock.");
      return null;
    }
    return null;
  }

  function text(setup, snap, rules) {
    const o = objectiveOf(rules); if (!o) return "";
    const deadline = Math.min(MAX_DEADLINE, Number(o.deadline) || MAX_DEADLINE), left = Math.max(0, deadline - snap.round + 1);
    if (o.kind === "survive") return `${rules.scenario.name || "Survive"}: ${left} round${left === 1 ? "" : "s"} left${o.clear ? " (or clear the field)" : ""}`;
    if (o.kind === "hold") {
      const mine = snap.units.some((u) => u.side === "player" && alive(u) && inZone(setup.zone, u)), theirs = snap.units.some((u) => u.side === "enemy" && alive(u) && inZone(setup.zone, u));
      return `${rules.scenario.name || "Hold"}: ${left} round${left === 1 ? "" : "s"} left · ground ${mine && !theirs ? "yours" : theirs ? "contested" : "empty"}`;
    }
    return "";
  }

  return { KINDS, MAX_DEADLINE, outcome, text };
});
