"use strict";
// Game modes and win conditions (Mala, 2026-10-07):
//   Survive        a countdown: still standing when it ends = win.
//   Total victory  every enemy AND every monster gone.
//   Escape         reach the exit tile; enemies try to cut you off.
//   Assassinate    defeat the one or two marked enemies; the rest don't matter.
// In every mode the player loses when the hero (or the whole player side) falls.
//
//   const setup = setupMode("escape", { arena, hero: "player", enemies, seed });
//   outcome(setup, { round, units, wild })   → null | { winner: "player" | "enemy", reason }
//   guardTiles(arena, from, exits, n)       → where enemy AI should stand to block an escape
//   appearancesAllowed(setup, snapshot)     → false once Total victory has no enemies left (no endless spawns)
// Pure functions over the terrain modules' arena shape; the engine supplies snapshots.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../terrain/mapgen.js"), require("../terrain/terrain-data.js"));
  else root.ConceptCombatModes = factory(root.ConceptCombatMapgen, root.ConceptCombatTerrain);
})(typeof self !== "undefined" ? self : this, function (G, D) {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const K = (x, y) => x + "," + y;

  const modes = {
    survive:      { name: "Survive", rounds: 8, text: "Stay alive until the countdown runs out. Enemies and monsters keep coming.",
                    teaches: "Rates and time: trading space and cover for rounds." },
    // Mala, 2026-10-11: the wild never holds a battle open. A creeper, a fire or a feral pig left on the field does not
    // stand between a side and its victory, in any mode. (Total victory keeps its name and its rule that monsters stop
    // appearing once the last enemy falls; its win is now the same as Classic's.)
    totalVictory: { name: "Total victory", archived: true, text: "Defeat every enemy. Monsters stop arriving once the last one falls.",
                    teaches: "Managing the whole site: fires must burn out and creepers be cleared, not just foes beaten." },
    // archived (Mala, 2026-10-11): Escape, Assassinate and Total victory (the same win as Classic once the wild stopped
    // counting) are out of play: not offered on the setup screen and never
    // rolled by a random scenario. The rules and tests stay; campaigns may reuse them.
    escape:       { name: "Escape", archived: true, text: "Reach the exit tile, or leave no enemy standing. Your enemies will try to cut you off.",
                    teaches: "Connectivity and cuts: a route is safe only if no single blocked tile separates you from the exit." },
    assassinate:  { name: "Assassinate", archived: true, text: "Defeat the marked target. Everyone else is optional. If the target leaves the field alive (flees, escapes, is bribed away), you fail.",
                    teaches: "Priority: spend actions on what decides the outcome." },
    warfare:      { name: "Warfare", text: "Player, enemy, and wild factions clash across a larger field. Outlast the other side; the animals fight everyone but do not have to be cleared.",
                    teaches: "Three-way conflict: threats can be redirected by letting rival factions meet." },
    melee:        { name: "Melee", text: "Every sub-faction crew fights every other crew. Last crew standing wins; your crew falling is a loss whatever rivals remain.",
                    teaches: "Multi-sided conflict: rivals damage each other while you pick the moment." },
  };

  function roll(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // Walking reachability (no Climb) with some tiles treated as blocked.
  function reachable(arena, from, blocked = new Set()) {
    const seen = new Set([K(...from)]), q = [from];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, k = K(nx, ny);
        if (seen.has(k) || blocked.has(k) || G.stepCost(arena, x, y, nx, ny) == null) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return seen;
  }

  // Chokepoints between `from` and any exit: tiles whose blocking disconnects them (graph cut vertices).
  function chokepoints(arena, from, exits) {
    const base = reachable(arena, from);
    if (!exits.some((e) => base.has(K(...e)))) return [];
    const out = [];
    for (const k of base) {
      if (k === K(...from) || exits.some((e) => K(...e) === k)) continue;
      const r = reachable(arena, from, new Set([k]));
      if (!exits.some((e) => r.has(K(...e)))) out.push(k.split(",").map(Number));
    }
    return out;
  }

  // Where blockers should stand: chokepoints nearest the exit first (holding a true cut). With no
  // chokepoint, a screen of tiles 1–3 steps from the exit on the cheapest routes, at least 2 apart,
  // so guards contest the approach without welding the exit shut.
  function guardTiles(arena, from, exits, n = 3) {
    const toExit = new Map();
    for (const e of exits) for (const [k, c] of G.walkCosts(arena, e)) if (!toExit.has(k) || c < toExit.get(k)) toExit.set(k, c);
    const choke = chokepoints(arena, from, exits).sort((a, b) => (toExit.get(K(...a)) ?? 99) - (toExit.get(K(...b)) ?? 99));
    if (choke.length >= n) return { tiles: choke.slice(0, n), cut: true };
    const fromCost = G.walkCosts(arena, from), total = Math.min(...exits.map((e) => fromCost.get(K(...e)) ?? Infinity));
    const onRoute = [...fromCost.keys()].filter((k) => (fromCost.get(k) + (toExit.get(k) ?? 99)) <= total + 2 && (toExit.get(k) ?? 99) <= 3 && !exits.some((e) => K(...e) === k) && k !== K(...from));
    onRoute.sort((a, b) => (toExit.get(b) - toExit.get(a)) || (a < b ? -1 : 1));       // screen a little out from the exit
    const picked = choke.map((c) => K(...c));
    const apart = (k) => picked.every((p) => { const [ax, ay] = p.split(",").map(Number), [bx, by] = k.split(",").map(Number); return Math.abs(ax - bx) + Math.abs(ay - by) >= 2; });
    for (const k of onRoute) { if (picked.length >= n) break; if (!picked.includes(k) && apart(k)) picked.push(k); }
    return { tiles: picked.map((k) => k.split(",").map(Number)), cut: choke.length > 0 };
  }

  function setupMode(mode, { arena, hero = "player", enemies = [], seed = 0, rounds } = {}) {
    if (!modes[mode]) throw new Error(`unknown mode ${mode}`);
    const s = { mode, name: modes[mode].name, hero, seed };
    if (mode === "survive") s.rounds = rounds || modes.survive.rounds + Math.max(0, enemies.length - 1) * 2;
    if (mode === "assassinate") {
      const count = enemies.length >= 3 ? 2 : 1;
      const ranked = enemies.map((e) => ({ id: e.id, lf: e.maxLF || e.lf || 0, r: roll(seed, "mark:" + e.id) }))
        .sort((a, b) => b.lf - a.lf || a.r - b.r);
      s.targets = ranked.slice(0, count).map((e) => e.id);
    }
    if (mode === "escape") {
      const start = arena.spawns.player[0], w = arena.map[0].length;
      const farX = start[0] < w / 2 ? w - 1 : 0;
      const costs = G.walkCosts(arena, start);
      const enemySpawns = arena.spawns.enemy || [];
      const cands = [];
      for (let y = 0; y < arena.map.length; y++) {
        if (!costs.has(K(farX, y))) continue;
        if ((arena.objects || []).some((o) => o.x === farX && o.y === y && o.blocksMove)) continue;
        if (enemySpawns.some(([ex, ey]) => ex === farX && ey === y)) continue;
        // prefer an open approach (3 walkable neighbours: no corners or pockets), then the hardest to reach
        const open = DIRS.filter(([dx, dy]) => G.stepCost(arena, farX, y, farX + dx, y + dy) != null).length;
        cands.push({ at: [farX, y], open, cost: costs.get(K(farX, y)), r: roll(seed, "exit:" + y) });
      }
      if (!cands.length) throw new Error("escape: no reachable exit tile on the far edge");
      cands.sort((a, b) => b.open - a.open || b.cost - a.cost || a.r - b.r);
      s.exits = [cands[0].at];
      s.guard = guardTiles(arena, start, s.exits, Math.max(1, enemies.length));
    }
    return s;
  }

  // snapshot = { round, units: [{ id, side, x, y, defeated }], wild: [monsters] }
  function outcome(setup, snap) {
    const alive = (u) => u && !u.defeated && (u.lf == null || u.lf > 0);
    // Nonlethal victory (NONLETHAL.md N3): a unit incapacitated with at least one own turn still to come is out of the fight for a side's elimination
    // (not `standing`: engine/instinct.js already defines that name). It is read for side elimination only, never for a marked target.
    const subdued = (u) => !!u && alive(u) && (u.states?.incapacitated?.count ?? 0) >= 1;
    const unsubdued = (u) => alive(u) && !subdued(u);
    const subdueEnd = (winner, losers, reason) => ({ winner, nonLethal: true, subdued: losers.filter(subdued).map((u) => u.id), reason });
    const hero = snap.units.find((u) => u.id === setup.hero);
    const playerSide = snap.units.filter((u) => u.side === "player");
    if (setup.mode === "warfare") {
      const counts = {
        player: playerSide.filter(unsubdued).length,
        enemy: snap.units.filter((u) => u.side === "enemy" && unsubdued(u)).length,
        wild: (snap.wild || []).filter((u) => u.form === "unit" && alive(u)).length,
      };
      // The wild fights as a faction but does not hold the battle open: once only one of the two sides of units is left,
      // that side has won, whatever animals remain. The wild wins only by outlasting both.
      if (counts.player && counts.enemy) return null;
      const standing = counts.player ? ["player"] : counts.enemy ? ["enemy"] : counts.wild ? ["wild"] : [];
      if (standing.length === 1) {
        const winner = standing[0], name = { player: "Player", enemy: "Enemy", wild: "Wild" }[winner];
        const out = snap.units.filter((u) => u.side !== winner && u.side !== "civilian" && subdued(u));   // a faction that was subdued, not killed, loses non-lethally
        return out.length && winner !== "wild" ? subdueEnd(winner, out, `${name} faction is the last standing; the rest are subdued.`) : { winner, reason: `${name} faction is the last standing.` };
      }
      return { winner: "none", reason: "Every faction has fallen." };
    }
    if (setup.mode === "melee") {   // sub-faction melee (Mala, 2026-10-17): N crews, last standing wins
      const crews = {};
      for (const u of snap.units) { if (unsubdued(u) && u.side !== "civilian") crews[u.side] = (crews[u.side] || 0) + 1; }
      const standing = Object.keys(crews);
      const ownSub = playerSide.filter(subdued), othersSub = snap.units.filter((u) => u.side !== "player" && u.side !== "civilian" && subdued(u));
      if (!crews.player) return ownSub.length ? subdueEnd("enemy", ownSub, "Your crew is subdued in the melee.") : { winner: "enemy", reason: "Your crew fell in the melee." };
      if (standing.length === 1) return othersSub.length ? subdueEnd("player", othersSub, "Your crew is the last standing; the rest are subdued.") : { winner: "player", reason: "Your crew is the last standing." };
      return null;
    }
    // Death's door (summons): a downed hero whose unbidden summon still stands has not lost yet.
    const heldAtDoor = !!(hero?.deathDoor && snap.units.some((u) => u.id === hero.deathDoor.summon && alive(u)));
    // Mala, 2026-10-11: the fight is not over while anyone on the hero's side is still on the field. A fallen hero's
    // allies, summons and communed plants fight on (or flee); the loss comes when the last of them is down or gone.
    const heroDown = !alive(hero) && !heldAtDoor;
    if (!playerSide.some(unsubdued) && playerSide.some(alive)) {   // nobody on the hero's side can act, and not all of them are down: subdued (NONLETHAL.md N3)
      const foes = snap.units.filter((u) => u.side === "enemy");
      if (!foes.length || foes.some(alive))   // every enemy dead falls through to the base rules (a win); otherwise this side is subdued
        return foes.length && !foes.some(unsubdued) ? subdueEnd("none", playerSide.concat(foes), "Every unit on both sides is subdued or down.") : subdueEnd("enemy", playerSide, "Your side is subdued.");
    }
    if (!playerSide.some(alive)) return { winner: "enemy", reason: hero?.deathDoor ? "The hero has fallen, and the summon that stood over them is gone." : playerSide.length > 1 ? "The hero has fallen, and no one is left to fight on." : "The hero has fallen." };
    const enemies = snap.units.filter((u) => u.side === "enemy");
    if (heroDown && ["escape"].includes(setup.mode))   // nobody can carry the hero out; what is left is to win the field
      return !enemies.some(alive) ? { winner: "player", reason: "The hero is down, but their allies hold the field." } : null;
    switch (setup.mode) {
      case "survive":
        return snap.round > setup.rounds ? { winner: "player", reason: `Survived ${setup.rounds} rounds.` } : null;
      case "totalVictory":
        return enemies.length && !enemies.some(unsubdued) ? (enemies.some(alive) ? subdueEnd("player", enemies, "Every enemy is subdued.") : { winner: "player", reason: "Every enemy defeated." }) : null;
      case "escape":
        if (setup.exits.some(([x, y]) => hero.x === x && hero.y === y)) return { winner: "player", reason: "Reached the exit." };
        // Mala, 2026-10-11: with no enemy left standing there is nobody to cut the hero off, so the escape is won.
        // Wild monsters do not hold the battle open.
        return enemies.length && !enemies.some(unsubdued) ? (enemies.some(alive) ? subdueEnd("player", enemies, "No enemy is left to stop the escape; the rest are subdued.") : { winner: "player", reason: "No enemy is left to stop the escape." }) : null;
      case "assassinate":
        // Mala, 2026-10-08: a marked target that leaves alive is a FAILURE, however it leaves: fled in fear,
        // escaped, bribed, talked off the field. Only a target brought down counts.
        for (const id of setup.targets) {
          const u = snap.units.find((q) => q.id === id);
          if (u && (u.escaped || u.fled || u.leaveReason))   // the engine's leaveBattle always records why
            return { winner: "enemy", reason: `The marked target escaped alive (${u.leaveReason || "fled"}); the assassination failed.` };
        }
        if (!setup.targets.every((id) => !alive(snap.units.find((u) => u.id === id)))) return null;
        // Mala, 2026-10-08: an immortal is knocked out, never killed, so it can't be assassinated; downing it is a non-lethal win.
        const undying = setup.targets.map((id) => snap.units.find((u) => u.id === id)).filter((u) => u?.knockedOut);
        if (undying.length) return { winner: "player", nonLethal: true, assassinated: false,
          reason: `${undying.map((u) => u.name || u.id).join(" and ")} can't die: knocked out, not killed. A non-lethal victory, not an assassination.` };
        return { winner: "player", reason: `Marked target${setup.targets.length > 1 ? "s" : ""} defeated.` };
    }
    return null;
  }

  // Monsters keep appearing in every mode, except that Total victory stops new appearances once
  // the last enemy falls, so the board can actually be cleared.
  function appearancesAllowed(setup, snap) {
    if (setup.mode !== "totalVictory") return true;
    return snap.units.some((u) => u.side === "enemy" && !u.defeated && (u.lf == null || u.lf > 0));
  }

  // What the HUD shows.
  function objectiveText(setup, snap) {
    if (setup.mode === "warfare") {
      const p = snap.units.filter((u) => u.side === "player" && !u.defeated).length;
      const e = snap.units.filter((u) => u.side === "enemy" && !u.defeated).length;
      const w = (snap.wild || []).filter((u) => u.form === "unit" && !u.defeated).length;
      return `Warfare · Player ${p} / Enemy ${e} / Wild ${w}`;
    }
    if (setup.mode === "melee") {
      const crews = {};
      for (const u of snap.units) { if (!u.defeated && u.side !== "civilian") crews[u.side] = (crews[u.side] || 0) + 1; }
      return `Melee · ${Object.entries(crews).map(([s, n]) => `${s} ${n}`).join(" / ")}`;
    }
    if (setup.mode === "survive") return `Survive: ${Math.max(0, setup.rounds - snap.round + 1)} round${setup.rounds - snap.round + 1 === 1 ? "" : "s"} left`;
    if (setup.mode === "escape") return `Escape: reach (${setup.exits[0].join(",")})`;
    if (setup.mode === "assassinate") return `Assassinate: ${setup.targets.join(" and ")}`;
    const e = snap.units.filter((u) => u.side === "enemy" && !u.defeated).length, m = (snap.wild || []).length;
    return `Total victory: ${e} enem${e === 1 ? "y" : "ies"}, ${m} monster${m === 1 ? "" : "s"} left`;
  }

  // Modes in play: what a setup screen offers and a random scenario may roll.
  const playable = () => Object.keys(modes).filter((id) => !modes[id].archived);
  return { modes, playable, setupMode, outcome, appearancesAllowed, objectiveText, chokepoints, guardTiles, reachable };
});
