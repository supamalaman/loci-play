"use strict";
// Mechanics for the two prototype classes, small enough to test the graph's HYPOTHESIS edges as scenarios.
// MMA Fighter: fulcrum (Leverage) and holds (Constraint). Detective: evidence by provenance (Inference) and identity tests (Selectivity).
// Pure functions. Codex folds the real versions into engine.js; the scenarios in tests/classes.test.mjs stay as the contract.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../terrain/terrain-data.js"));
  else root.ConceptCombatClassPrototypes = factory(root.ConceptCombatTerrain);
})(typeof self !== "undefined" ? self : this, function (TD) {
  const key = (x, y) => x + "," + y, N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

  // ── Leverage ──
  // ctx: { berms: [[x,y]], wet: [[x,y]], walls: [[x,y]] }
  function supportAt(arena, x, y, ctx = {}) {
    if (!arena.map[y]?.[x]) return null;
    const wet = new Set((ctx.wet || []).map(([a, b]) => key(a, b)));
    const o = (arena.objects || []).find((q) => q.x === x && q.y === y && !q.destroyed);
    if (o && (o.type === "tree" || o.type === "hedge" || o.blocksMove)) return { at: [x, y], kind: o.type || "object", plant: o.kind === "plant" || ["tree", "hedge", "shrub"].includes(o.type), id: o.id };
    const t = TD.terrain[arena.map[y][x]] || {};
    if (t.blocksMove && !(t.tags || []).includes("water")) return { at: [x, y], kind: t.name };
    if ((ctx.walls || []).some(([a, b]) => a === x && b === y)) return { at: [x, y], kind: "wall" };
    if ((ctx.berms || []).some(([a, b]) => a === x && b === y)) return wet.has(key(x, y)) ? null : { at: [x, y], kind: "berm", soil: true };
    return null;
  }
  function findBase(actor, arena, ctx = {}) {
    const here = Number(arena.height?.[actor.y]?.[actor.x] ?? 0);
    for (const [dx, dy] of N4) {
      const x = actor.x + dx, y = actor.y + dy, s = supportAt(arena, x, y, ctx);
      if (s) return s;
      if (arena.map[y]?.[x] && Number(arena.height?.[y]?.[x] ?? 0) >= here + 1) return { at: [x, y], kind: "higher ground", soil: (TD.terrain[arena.map[y][x]]?.tags || []).includes("soil") };
    }
    return null;
  }
  function fulcrumValid(fulcrum, arena, ctx = {}) {
    if (!fulcrum) return false;
    const [x, y] = fulcrum.at;
    if ((ctx.wet || []).some(([a, b]) => a === x && b === y) && (fulcrum.soil || fulcrum.kind === "berm")) return false;   // swale undermines soil
    if (fulcrum.plant && (ctx.pruned || []).includes(fulcrum.id)) return false;                                         // pruning removes it
    return !!(supportAt(arena, x, y, ctx) || fulcrum.kind === "higher ground");
  }
  function contact(a, b, ctx = {}) { return adjacent(a, b) && !(ctx.wallBetween); }
  // A plain shove can't move an anchored target; Off-Balance can, with contact and a fulcrum.
  function shove(target) { return { moved: target.anchored ? 0 : 1 }; }
  function offBalance(actor, target, arena, ctx = {}) {
    if (!contact(actor, target, ctx)) return { ok: false, reason: "No contact." };
    if (!fulcrumValid(actor.fulcrum, arena, ctx)) return { ok: false, reason: "No valid fulcrum." };
    return { ok: true, moved: 1, potency: 10 };
  }

  // ── Constraint ──
  function clinch(holder, target, freedom, ctx = {}) {
    if (!contact(holder, target, ctx)) return { ok: false, reason: "No contact." };
    return { ok: true, hold: { by: holder.id, on: target.id, freedoms: [freedom], intact: true, slipped: false } };
  }
  function jointControl(hold, freedom) {
    if (!hold?.intact) return { ok: false, reason: "No hold to add to." };
    if (hold.freedoms.length >= 2) return { ok: false, reason: "Two freedoms is the most a hold can take." };
    return { ok: true, hold: { ...hold, freedoms: [...hold.freedoms, freedom] } };
  }
  const blocks = (hold, freedom) => !!(hold?.intact && hold.freedoms.includes(freedom));
  // Events that end a hold: contact broken, resonance, an elastic target's one slip, a shove on the holder (unless anchored: comp-constraint-inertia).
  function holdEvent(hold, event, { holderAnchored = false, targetElastic = false } = {}) {
    if (!hold?.intact) return { hold };
    if (event === "resonance" || event === "separated") return { hold: { ...hold, intact: false }, broke: event };
    if (event === "shoveHolder") return holderAnchored ? { hold, held: "anchored" } : { hold: { ...hold, intact: false }, broke: event };
    if (event === "targetYields" && targetElastic && !hold.slipped) return { hold: { ...hold, intact: false, slipped: true }, broke: "slipped" };
    return { hold };
  }
  function controlledDescent(actor, target, hold, arena, ctx = {}) {
    for (const [ok, why] of [[contact(actor, target, ctx), "contact"], [fulcrumValid(actor.fulcrum, arena, ctx), "a fulcrum"], [hold?.intact && hold.on === target.id, "a hold on the target"]])
      if (!ok) return { ok: false, reason: `Controlled Descent needs ${why}.` };
    return { ok: true, potency: 24 * (hold.freedoms.length >= 2 ? 1.25 : 1), prone: true };
  }

  // ── Inference ──
  // Hypotheses carry the SET of provenances that support them. Two reports with one source count once.
  function observe(ledger, claim, provenance) {
    const cur = ledger[claim] || [];
    return { ...ledger, [claim]: cur.includes(provenance) ? cur : [...cur, provenance] };
  }
  const independent = (ledger, claim) => (ledger[claim] || []).length;
  const confirmed = (ledger, claim) => independent(ledger, claim) >= 2;
  function independentCheck(ledger, claim, caster, { lineClear }) {
    if (!lineClear) return { ledger, ok: false, reason: "No clear line: no evidence." };
    return { ledger: observe(ledger, claim, `direct:${caster}`), ok: true };
  }
  // A feint's true envelope is revealed once the deception hypothesis is confirmed.
  const exposesFeint = (ledger, deceiverId) => confirmed(ledger, `feint:${deceiverId}`);

  // ── Selectivity: Authenticate ──
  const FALSE = ["mimic", "illusion", "disguise"];
  function authenticate(target) {
    const fakes = FALSE.filter((s) => target.status?.[s]);
    if (!fakes.length) return { target, removed: [], text: "Passes: what it claims is true. No effect." };
    const status = { ...target.status }; for (const s of fakes) delete status[s];
    return { target: { ...target, status }, removed: fakes, text: `Fails authentication: ${fakes.join(", ")} stripped.` };
  }

  return { findBase, fulcrumValid, contact, shove, offBalance, clinch, jointControl, blocks, holdEvent, controlledDescent, observe, independent, confirmed, independentCheck, exposesFeint, authenticate };
});
