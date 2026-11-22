"use strict";
// Scenario objectives (random scenarios, slice 3; SCENARIOS.md section 3.2; Mala, 2026-10-30: "the random battles could use more scenarios").
// Pure functions: `outcome(setup, snap, rules)` is called by modes.js for the `scenario` mode, after the generic preface (the player's side gone is
// the enemy's win, decided there), and `text(setup, snap, rules)` is the HUD chip. The scenario rides in `rules.scenario.objective`
// ({ kind, deadline, onDeadline, ...params }); `setup.zone` is the hold zone, laid once at setup from the arena.
//
// THE CLOCK (termination, docs/termination-audit.md): every objective has a deadline of at most 14 rounds (below maxRounds 40). When
// `snap.round > deadline` the battle ends with `onDeadline` ("win" or "lose"), so a side that never understands the objective still ends the fight.
//
//   survive   win at the clock; early when `clear` is set and no enemy-side unit and no rift-spawned dream monster stands; with `hero` set, lose the moment the hero is down
//   hold      win at the clock if a player unit stands in the zone and no enemy does; or at any time when no enemy stands; lose at the clock
//             when the zone is not held ("pushed off": a loss at the clock, nobody has to be dead; the outcome carries no nonLethal flag)
//   ward      win when the ward has escaped, or is alive at the clock, or no enemy stands; lose if the ward falls without escaping, or any named civilian falls (slice 5)
//   break     win when the named object's hp is gone, or no enemy stands; lose at the clock (slice 4, SC16)
//   salvage   win when player-side carriers have gained n items this battle (event-counted pickups in mirror.salvagePicked, n = min(3, 2 × carriers)), or no enemy stands; lose at the clock (slice 4, SC17)
//   bounty    win when the marked foe is defeated, or no enemy stands; lose if the mark escaped alive, or at the clock (slice 7, SC18)
//   exit      win when the hero reaches the exit, or no enemy stands; lose at the clock (slice 7, SC19)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatObjectives = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const KINDS = ["survive", "hold", "ward", "break", "salvage", "bounty", "exit"];
  const MAX_DEADLINE = 14;
  const alive = (u) => u && !u.defeated && (u.lf == null || u.lf > 0);
  const objectiveOf = (rules) => rules?.scenario?.objective || null;
  const inZone = (zone, u) => (zone || []).some(([x, y]) => u.x === x && u.y === y);
  const enemyStanding = (snap) => snap.units.some((u) => u.side === "enemy" && alive(u) && !u.notArrived && !u.persuaded);
  const riftStanding = (snap) => snap.units.some((u) => u.dream?.source === "randomEvent" && alive(u) && u.side !== "player");
  const wardOf = (snap, o) => (o.wardId ? snap.units.find((u) => u.id === o.wardId) : null);
  const namedCivilians = (snap, o) => (o.civilians || []).map((id) => snap.units.find((u) => u.id === id)).filter(Boolean);
  const playerStanding = (snap) => snap.units.filter((u) => u.side === "player" && alive(u));
  // Salvage n counts only carriers (inventoryCapacity > 0): summons, plants and 0-slot hires do not raise the need.
  const carriers = (snap) => playerStanding(snap).filter((u) => (u.inventoryCapacity || 0) > 0);
  const objectOf = (snap, o) => (snap.arena?.objects || []).find((q) => q.id === (o.objectId || "scenario-sluice"));
  const salvageGot = (snap) => Number(snap.mirror?.salvagePicked) || 0;   // event-counted pickups by player-side carriers (engine.js syncPickup); a packed pouch never counts, and useItem splices and carrier defeats cannot undercount it
  const salvageNeed = (snap) => Math.min(3, 2 * Math.max(1, carriers(snap).length || 1));
  const lose = (reason) => ({ winner: "enemy", reason });
  const win = (reason) => ({ winner: "player", reason });

  function outcome(setup, snap, rules) {
    const o = objectiveOf(rules); if (!o || !KINDS.includes(o.kind)) return null;
    const deadline = Math.min(MAX_DEADLINE, Number(o.deadline) || MAX_DEADLINE), over = snap.round > deadline;
    if (o.kind === "survive") {
      if (o.hero && !alive(snap.units.find((u) => u.id === (setup.hero || "player")))) return lose("You fell before the count ran out.");   // Tandem T2c, the ordeal: the hero must be the one standing (a summon holding the field is not enough)
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
    if (o.kind === "ward") {
      // A Tourist who reaches his exit is defeated+escaped; that is a win, not a fall.
      const ward = wardOf(snap, o), civs = namedCivilians(snap, o);
      if (civs.some((u) => u.defeated && !u.escaped)) return lose("A bystander fell.");
      if (ward && ward.escaped) return win("The one you were watching for got out.");
      if (ward && ward.defeated && !ward.escaped) return lose("The one you were watching for did not make it.");
      if (!enemyStanding(snap)) return win("No enemy fighter is left standing.");
      if (over) return o.onDeadline === "lose" ? lose(`Not clear by round ${deadline}.`) : win(`They made it to round ${deadline}.`);
      return null;
    }
    if (o.kind === "break") {
      if (!snap.arena) return null;   // HUD callers without arena must not read a missing object as "broken"
      const obj = objectOf(snap, o), broken = !obj || (obj.hp != null && obj.hp <= 0);
      if (broken) return win("The gate gives.");
      if (!enemyStanding(snap)) return win("No one is left to guard the gate.");
      if (over) return lose("The water takes the camp.");
      return null;
    }
    if (o.kind === "salvage") {
      const need = salvageNeed(snap), got = salvageGot(snap);
      if (got >= need) return win(`You walk out with ${got} of what fell.`);
      if (!enemyStanding(snap)) return win("No one is left to contest the scrap.");
      if (over) return lose("The scrap is gone before you got to it.");
      return null;
    }
    if (o.kind === "bounty") {
      const targetClass = o.targetClass;
      const targetUnit = snap.units.find((u) => u.side === "enemy" && (u.classId === targetClass || u.class === targetClass || u.character === targetClass || (o.targetId && u.id === o.targetId)));
      if (targetUnit && (targetUnit.escaped || targetUnit.fled || targetUnit.leaveReason)) return lose("The marked target escaped alive.");
      if ((targetUnit && targetUnit.defeated) || !enemyStanding(snap)) return win("Marked target defeated.");
      if (over) return lose(`Not defeated by round ${deadline}.`);
      return null;
    }
    if (o.kind === "exit") {
      const hero = snap.units.find((u) => u.side === "player" && (u.hero || u.id === "player"));
      const exits = setup.exits || [];
      if (hero && exits.some(([x, y]) => hero.x === x && hero.y === y)) {
        hero.escaped = true;
        hero.leaveReason = "reached the exit";
        return win("Reached the exit.");
      }
      if (!enemyStanding(snap)) return win("No enemy is left to stop the escape.");
      if (over) return lose("The clock ran out before you reached the exit.");
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
    if (o.kind === "ward") {
      const ward = wardOf(snap, o), civs = namedCivilians(snap, o);
      const wardBit = !o.wardId ? null : !ward ? "missing" : ward.escaped ? "escaped" : ward.defeated ? "lost" : "safe";
      const civBit = o.civilians?.length ? ` · civilians ${civs.filter((u) => !u.defeated || u.escaped).length}/${o.civilians.length}` : "";
      return `${rules.scenario.name || "Ward"}: ${left} round${left === 1 ? "" : "s"} left${wardBit ? ` · ward ${wardBit}` : ""}${civBit}`;
    }
    if (o.kind === "break") {
      if (!snap.arena) return `${rules.scenario.name || "Break"}: ${left} round${left === 1 ? "" : "s"} left`;
      const obj = objectOf(snap, o), hp = obj && obj.hp != null ? obj.hp : 0;
      return `${rules.scenario.name || "Break"}: ${left} round${left === 1 ? "" : "s"} left · gate ${!obj || hp <= 0 ? "broken" : `${hp} HP`}`;
    }
    if (o.kind === "salvage") {
      const need = salvageNeed(snap), got = salvageGot(snap);
      return `${rules.scenario.name || "Salvage"}: ${left} round${left === 1 ? "" : "s"} left · ${got}/${need} gained`;
    }
    if (o.kind === "bounty") {
      const targetClass = o.targetClass;
      const targetUnit = snap.units.find((u) => u.side === "enemy" && (u.classId === targetClass || u.class === targetClass || u.character === targetClass || (o.targetId && u.id === o.targetId)));
      const markState = !targetUnit ? "not on the field" : targetUnit.defeated ? "down" : "standing";   // not on the field: the target was on your side, so the bounty is won by clearing the field
      return `${rules.scenario.name || "Bounty"}: ${left} round${left === 1 ? "" : "s"} left · mark ${markState}`;
    }
    if (o.kind === "exit") {
      const goal = setup.exits?.[0] ? `reach (${setup.exits[0].join(",")})` : "no way out: clear the field";   // no reachable far-edge tile (modes.js farExit): only a cleared field wins
      return `${rules.scenario.name || "Escape"}: ${left} round${left === 1 ? "" : "s"} left · ${goal}`;
    }
    return "";
  }

  return { KINDS, MAX_DEADLINE, outcome, text, salvageNeed };
});
