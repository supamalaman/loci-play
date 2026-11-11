"use strict";
// Forum S1: pure reads for the surface menu. For the unit the player controls,
// answers what the menu should offer: ability entries with signifiers, Advance,
// Withdraw, Guard, End turn, and the response triple. Reads the engine's own
// answers only; applies nothing and mutates nothing it reads. Every offered
// action passes the engine's preview, so a signifier never lies.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSurface = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const liveUnitAt = (s, x, y) => Object.values(s.actors).find((u) => !u.defeated && u.x === x && u.y === y) || null;
  const foesOf = (s, id) => Object.values(s.actors).filter((u) => u.id !== id && u.side !== s.actors[id].side && u.side !== "bystander" && !u.defeated);   // a bystander is never the foe (the engine's rule: ai.js, hires.js)
  const nearestFoe = (E, s, id) => foesOf(s, id)
    .sort((p, q) => E.geometry.dist(s, s.actors[id].x, s.actors[id].y, p.x, p.y) - E.geometry.dist(s, s.actors[id].x, s.actors[id].y, q.x, q.y))[0] || null;
  const accepted = (E, s, action) => { try { return E.preview(s, action).ok; } catch (_) { return false; } };

  function abilityEntries(E, s, id) {
    const out = [];
    for (const ability of E.availableAbilities(s, id)) {
      const entry = { id: ability.id, name: ability.m.name, apCost: ability.m.tempoCost, signifier: null, targets: [] };
      if (!ability.affordable) { entry.signifier = "Can't pay"; out.push(entry); continue; }
      // Tile-target abilities need the map's tile picker; composite abilities need
      // their parts picked in the map UI (montage/prototype/recombine fail without
      // parts). Neither can complete on the surface, so neither offers an action.
      if (ability.m.target === "tile" || ability.m.target === "composite") { entry.signifier = "Needs the map"; out.push(entry); continue; }
      let targeting;
      try { targeting = E.targeting(s, id, ability.id); } catch (_) { entry.signifier = "Out of range"; out.push(entry); continue; }
      if (targeting.selfCast) {
        const action = { type: "ability", actor: id, ability: ability.id, target: [s.actors[id].x, s.actors[id].y] };
        if (accepted(E, s, action)) { entry.signifier = "Ready"; entry.targets = [{ unitId: id, name: s.actors[id].name, action }]; }
        else entry.signifier = "Out of range";
        out.push(entry);
        continue;
      }
      const seen = new Set();
      for (const t of targeting.legal || []) {
        const unit = liveUnitAt(s, t.at[0], t.at[1]);
        if (!unit || seen.has(unit.id)) continue;
        const action = { type: "ability", actor: id, ability: ability.id, target: t.at };
        if (!accepted(E, s, action)) continue;
        seen.add(unit.id);
        entry.targets.push({ unitId: unit.id, name: unit.name, action });
      }
      entry.signifier = entry.targets.length ? "In range" : "Out of range";
      out.push(entry);
    }
    return out;
  }

  function gapMove(E, s, id, foe, want) {
    if (!foe) return null;
    const here = s.actors[id];
    const d0 = E.geometry.dist(s, here.x, here.y, foe.x, foe.y);
    let best = null;
    for (const option of E.moveOptions(s, id)) {
      const d1 = E.geometry.dist(s, option.to[0], option.to[1], foe.x, foe.y);
      const better = want === "near" ? d1 < d0 : d1 > d0;
      if (!better) continue;
      const action = { type: "move", actor: id, to: option.to };
      if (!accepted(E, s, action)) continue;
      if (!best || (want === "near" ? d1 < best.d : d1 > best.d)
        || (d1 === best.d && option.tempoCost < best.apCost)) best = { action, apCost: option.tempoCost, d: d1 };
    }
    // The surface is the harder seat by design: take the plain extreme, never a
    // clever route. Cost shown is the move's AP (tempoCost), not tiles.
    return best ? { action: best.action, apCost: best.apCost } : null;
  }

  function menuFor(E, s, id) {
    const foe = nearestFoe(E, s, id);
    const here = s.actors[id];
    const guardAction = { type: "guard", actor: id };
    const endAction = { type: "end", actor: id };
    return {
      kind: "turn",
      actor: id,
      foe: foe ? foe.id : null,
      distance: foe ? E.geometry.dist(s, here.x, here.y, foe.x, foe.y) : 0,
      abilities: abilityEntries(E, s, id),
      advance: gapMove(E, s, id, foe, "near"),
      withdraw: gapMove(E, s, id, foe, "far"),
      guard: accepted(E, s, guardAction) ? { action: guardAction, apCost: s.rules.actionCosts.guard } : null,
      end: { action: endAction },
    };
  }

  function responsesFor(E, s, id) {
    const options = E.responseOptions(s);
    const guard = options.some((o) => o.kind === "guard") ? { type: "respond", actor: id, response: "guard" } : null;
    const safe = options.find((o) => o.kind === "reposition" && o.safe) || null;
    return {
      kind: "response",
      actor: id,
      guard: guard && accepted(E, s, guard) ? { action: guard } : null,
      dodge: safe && accepted(E, s, { type: "respond", actor: id, response: "reposition", to: safe.to })
        ? { action: { type: "respond", actor: id, response: "reposition", to: safe.to }, to: safe.to, apCost: safe.apCost } : null,
      takeIt: { action: { type: "respond", actor: id, response: "none" } },
    };
  }

  function surfaceFor(E, s, id) {
    const d = E.decider(s);
    if (!d || d.actor !== id) return null;
    return d.kind === "response" ? responsesFor(E, s, id) : menuFor(E, s, id);
  }

  return { menuFor, responsesFor, surfaceFor };
});
