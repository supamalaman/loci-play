"use strict";
// President mechanics (and Strategic Commitment's shared rules, used by Odysseus too): Legitimacy (a recognized office grants bounded permissions) and Strategic Commitment
// (give up one of your own options in public to make an objective credible). Pure functions, small enough to
// test the graph's hypothesis edges as scenarios. Codex folds the real versions into engine.js; the scenarios
// in tests/president.test.mjs stay as the contract. Kit: kits/kits-data.js (staged). Brief: classes-data.js.
//
// unit: { id, side, x, y, lf, maxLF, phi, abilities: [ids], passives: [ids], office?, promise?, mandate?, debt?, outlaw?, committed? }
// ctx:  { round, opaque(a, b) → bool, domains: [{ owner, tiles: ["x,y"] }], grid: { w, h, blocked: ["x,y"] } }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatPresident = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const key = (x, y) => x + "," + y, kOf = (u) => key(u.x, u.y);
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const RULES = { radius: 3, officeTurns: 3, directionMul: 1.15, mandateMul: 1.25, outlawMul: 1.25, maxStake: 6, payoutPerStake: 2,
    commitMul: 1.3, baitMul: 1.25, trapMul: 1.25, accordHeal: 12, homewardMove: 2, homecoming: 18 };

  // ── Legitimacy: office, recognition, jurisdiction ──
  const officeValid = (h) => !!h.office && !h.exposedFalseClaim && !h.debt;

  function takeOffice(holder, ctx = {}, { territory = null } = {}) {
    return { ...holder, office: { radius: RULES.radius, until: (ctx.round || 0) + RULES.officeTurns, territory } };
  }

  // Jurisdiction: a radius, or a closed perimeter you own (Legitimacy + Boundary). A foreign closed perimeter cuts it.
  function inJurisdiction(holder, u, ctx = {}) {
    const o = holder.office; if (!o) return false;
    const inside = o.territory ? o.territory.includes(kOf(u)) : dist(holder, u) <= o.radius;
    const foreign = (ctx.domains || []).some((d) => d.owner !== holder.side && d.tiles.includes(kOf(u)) && !d.tiles.includes(kOf(holder)));
    return inside && !foreign;
  }

  // Recognition needs a valid office, jurisdiction, and a seen claim (a berm between hides it).
  function recognizers(holder, units, ctx = {}) {
    if (!officeValid(holder)) return [];
    return units.filter((u) => u.id !== holder.id && u.side === holder.side && u.lf > 0 && u.willing !== false
      && inJurisdiction(holder, u, ctx) && !ctx.opaque?.(holder, u)).map((u) => u.id);
  }

  // Authenticate an office: a false one is stripped; a true one passes with no effect.
  const authenticateOffice = (h) => officeValid(h) ? { holder: h, removed: false } : { holder: { ...h, office: null }, removed: true };

  // Inference voids a claim only with two independent sources AND an actually invalid office.
  function voidClaim(h, sources = []) {
    if (new Set(sources).size < 2 || officeValid(h) || !h.office) return { holder: h, voided: false };
    return { holder: { ...h, office: null }, voided: true };
  }

  // Executive Direction: a request, not a command. The ally acts on ITS next turn, from ITS budget. No extra actions.
  function directAlly(holder, ally, { abilityId, target }, { units = [], ctx = {}, abilities = {} } = {}) {
    const no = (reason) => ({ ok: false, reason, refund: true, ally });
    if (!recognizers(holder, units, ctx).includes(ally.id)) return no(`${ally.id} doesn't recognize the office here.`);
    if (!(ally.abilities || []).includes(abilityId)) return no(`${abilityId} isn't in ${ally.id}'s kit: you can't direct what they can't do.`);
    if ((abilities[abilityId]?.cost ?? 0) > (ally.phi ?? 0)) return no(`${ally.id} can't afford ${abilityId}; their budget pays, not yours.`);
    if (target === ally.id && abilities[abilityId]?.effect === "damage") return no("No ally can be directed to harm itself.");
    if (ally.declines?.(abilityId, target)) return no(`${ally.id} declines. Recognition isn't obedience.`);
    const order = { by: holder.id, abilityId, target, potencyMul: RULES.directionMul, paidBy: ally.id, extraActions: 0 };
    return { ok: true, order, ally: { ...ally, order } };
  }

  // Due Process: a rule for the jurisdiction. Whoever breaks it, the caster included, is an outlaw.
  const dueProcess = (holder, rule, ctx = {}) => ({ ...holder, law: { rule, until: (ctx.round || 0) + 2 } });
  function breaksLaw(holder, actor, action, ctx = {}) {
    if (!holder.law || (ctx.round || 0) > holder.law.until || action.delivery !== holder.law.rule) return { actor, broke: false };
    if (actor.id !== holder.id && !inJurisdiction(holder, actor, ctx)) return { actor, broke: false };
    return { actor: { ...actor, outlaw: true, ...(actor.id === holder.id ? { debt: true } : {}) }, broke: true };
  }
  // A false tell revealed inside jurisdiction puts the deceiver on the record (any side).
  const onTheRecord = (holder, deceiver, ctx = {}) =>
    officeValid(holder) && deceiver.revealedFalseTell && inJurisdiction(holder, deceiver, ctx) ? { ...deceiver, outlaw: true } : deceiver;
  const outlawMul = (attackerId, target, recognizerIds) => target.outlaw && recognizerIds.includes(attackerId) ? RULES.outlawMul : 1;
  // Threshold + Legitimacy (warrant): a trap passes units that recognize a valid office.
  const warrantPasses = (holder, unit, units, ctx) => recognizers(holder, units, ctx).includes(unit.id) && !unit.outlaw;

  // ── Strategic Commitment: promises ──
  // objective: { kind: "defeat", target } | { kind: "hold", tile:[x,y] } | { kind: "protect", allies:[ids] } | { kind: "reach", units:[ids], tiles:["x,y"] }
  // surrender: an ability id you give up until it resolves, or "retreat".
  // method: an optional vowed route (["x,y", ...]). A method vow breaks if you leave the route or it's closed;
  // goalOnly (Strategic Commitment + Pathway, Odysseus) ignores the method: only the destination binds.
  function promise(actor, objective, surrender, { round = 0, by = round + 2, units = [], abilities = {}, method = null, goalOnly = false } = {}) {
    const usable = surrender === "retreat" || ((actor.abilities || []).includes(surrender) && (abilities[surrender]?.cost ?? 0) <= (actor.phi ?? 0));
    const already = objectiveMet(objective, actor, units);
    const p = { ...objective, by, surrender, stake: 0, credible: usable, qualifies: !already, inOffice: officeValid(actor), rewarded: false, method, goalOnly };
    return { ...actor, promise: p };
  }

  function objectiveMet(o, actor, units) {
    const u = (id) => units.find((x) => x.id === id);
    if (o.kind === "defeat") return !!u(o.target) && u(o.target).lf <= 0;   // an unseen target is not a defeated one
    if (o.kind === "reach") return o.units.every((id) => u(id) && o.tiles.includes(kOf(u(id))));
    return false;                                       // hold / protect are met only by lasting until the deadline
  }

  function routeExists(from, to, grid) {
    if (!grid) return true;
    const blocked = new Set(grid.blocked || []), goal = key(...to), seen = new Set([kOf(from)]), q = [[from.x, from.y]];
    while (q.length) {
      const [x, y] = q.shift(); if (key(x, y) === goal) return true;
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= grid.w || ny >= grid.h || seen.has(k) || (blocked.has(k) && k !== goal)) continue;
        seen.add(k); q.push([nx, ny]); }
    }
    return false;
  }

  // → "pending" | "fulfilled" | "breached"
  function checkPromise(actor, units = [], ctx = {}) {
    const p = actor.promise, round = ctx.round || 0, u = (id) => units.find((x) => x.id === id);
    if (!p) return "pending";
    if (objectiveMet(p, actor, units)) return "fulfilled";
    if (p.method && !p.goalOnly) {                                   // a vow to a method: off the route, or the route closed, breaks it
      const blocked = new Set(ctx.grid?.blocked || []);
      if (!p.method.includes(kOf(actor)) || p.method.some((k) => blocked.has(k))) return "breached";
    }
    if (p.kind === "reach" && ctx.grid && !p.units.some((id) => u(id) && p.tiles.some((t) => routeExists(u(id), t.split(",").map(Number), ctx.grid)))) return "breached";
    if (p.kind === "hold") { if (kOf(actor) !== key(...p.tile)) { if (!routeExists(actor, p.tile, ctx.grid)) return "breached"; } else if (round > p.by) return "fulfilled"; }
    if (p.kind === "protect") { if (p.allies.some((id) => u(id) && u(id).lf / u(id).maxLF < 0.5)) return "breached"; if (round > p.by) return "fulfilled"; }
    if (p.kind === "defeat" && u(p.target) && !routeExists(actor, [u(p.target).x, u(p.target).y], ctx.grid)) return "breached";
    return round > p.by ? "breached" : "pending";
  }

  // Credible Guarantee: put Φ-Force in escrow on your active promise.
  function guarantee(actor, stake) {
    if (!actor.promise) return { actor, error: "A guarantee needs an active promise." };
    const s = Math.min(stake, RULES.maxStake);
    if (s > (actor.phi ?? 0)) return { actor, error: "You can't stake Φ-Force you don't have." };
    return { actor: { ...actor, phi: actor.phi - s, promise: { ...actor.promise, stake: actor.promise.stake + s } } };
  }

  // Strategic Commitment + Legitimacy (ratified): a promise made in office pays and costs double.
  function resolvePromise(actor, outcome, { ratified = false } = {}) {
    const p = actor.promise; if (!p || outcome === "pending") return { actor, events: [] };
    const mul = ratified && p.inOffice ? 2 : 1, hasMandate = (actor.passives || []).includes("mandate"), events = [];
    let a = { ...actor, promise: null };
    if (outcome === "fulfilled") {
      if (p.qualifies) a.kept = true;   // read once by the engine (keptWord): a kept promise feeds the ultimate
      a.phi = (a.phi ?? 0) + p.stake;
      if (p.stake) events.push({ kind: "payout", heal: p.stake * RULES.payoutPerStake * mul });
      if (p.credible && p.qualifies) {
        if (a.debt) { a.debt = false; events.push({ kind: "amends" }); }         // repairs debt instead of rewarding
        else if (hasMandate) { a.mandate = true; events.push({ kind: "mandate" }); }
      }
    } else {
      events.push({ kind: "breach", damage: p.stake * RULES.payoutPerStake * mul, lostStake: p.stake });
      if (hasMandate) { a.debt = true; a.mandate = false; }
    }
    return { actor: a, events };
  }

  // Mandate: one fulfilled commitment strengthens ONE later Legitimacy technique.
  const useMandate = (actor, ability) => actor.mandate && (ability.concepts || []).includes("legitimacy")
    ? { actor: { ...actor, mandate: false }, mul: RULES.mandateMul } : { actor, mul: 1 };

  // Inference exposes cheap talk: the surrender was never a real restriction.
  const exposeCheapTalk = (actor) => actor.promise && !actor.promise.credible ? { ...actor, promise: { ...actor.promise, exposed: true } } : actor;

  // ── Burn the Boats (Strategic Commitment ultimate): no retreat, more force ──
  function burnTheBoats(holder, units) {
    const near = (u) => u.side === holder.side && u.lf > 0 && u.willing !== false && dist(holder, u) <= RULES.radius;
    return units.map((u) => u.id === holder.id || near(u) ? { ...u, committed: { noRetreat: true, potencyMul: RULES.commitMul } } : u);
  }
  const nearestEnemyDist = (u, at, enemies) => Math.min(...enemies.filter((e) => e.lf > 0).map((e) => dist(at, e)));
  const canMove = (u, to, enemies) => !u.committed?.noRetreat || nearestEnemyDist(u, to, enemies) <= nearestEnemyDist(u, u, enemies);
  const mustAdvance = (u) => !!u.committed?.noRetreat || u.promise?.kind === "defeat";
  const deceptionBonus = (target, bonus) => target.committed?.noRetreat ? 0 : bonus;          // deterrenceFails
  const ambushMul = (target) => mustAdvance(target) ? RULES.baitMul : 1;                         // baitCommitment
  const trapMul = (tile, unit) => unit.promise?.kind === "hold" && key(...unit.promise.tile) === key(...tile) ? RULES.trapMul : 1;  // predictedPath

  // ── Another Way Home (Odysseus merge: Strategic Commitment + Pathway) ──
  // Promise a destination, not a route: any open route keeps it alive, homeward moves get +2, and arrival lands a strike.
  function anotherWayHome(actor, tile, { round = 0 } = {}) {
    const objective = { kind: "reach", units: [actor.id], tiles: [key(...tile)] };
    return { ...actor, promise: { ...objective, by: round + 3, surrender: null, stake: 0, credible: true, qualifies: true, inOffice: false, rewarded: false, method: null, goalOnly: true, homeward: true } };
  }
  const homewardMove = (actor) => actor.promise?.homeward ? RULES.homewardMove : 0;
  function homecoming(actor, units) {
    if (!actor.promise?.homeward) return [];
    const [x, y] = actor.promise.tiles[0].split(",").map(Number);
    return units.filter((u) => u.side !== actor.side && u.lf > 0 && dist(u, { x, y }) <= 2).map((u) => ({ id: u.id, damage: RULES.homecoming, channel: "citrinitas" }));
  }

  // prepared_return (Odysseus): a Detour along a route he's already walked costs 1 less, if it's still open.
  function preparedReturnCost(actor, route, base, grid) {
    const walked = new Set(actor.walked || []), blocked = new Set(grid?.blocked || []);
    return route.every((k) => walked.has(k) && !blocked.has(k)) ? Math.max(0, base - 1) : base;
  }

  // ── The Accord Holds (merge): shared objective, shared terms, the maker bound too ──
  function accord(holder, { objective, participants, restriction }, { units = [], ctx = {} } = {}) {
    if (!officeValid(holder)) return { ok: false, reason: "No valid office: an accord needs recognized authority." };
    const rec = recognizers(holder, units, ctx), out = participants.filter((id) => !rec.includes(id));
    if (out.length) return { ok: false, reason: `${out.join(", ")} don't recognize the office: participation is voluntary.` };
    const terms = { objective, participants: [...participants], restriction, bound: [holder.id, ...participants] };
    return { ok: true, holder: { ...holder, accord: terms, promise: { ...objective, by: (ctx.round || 0) + 3, surrender: restriction, stake: 0, credible: true, qualifies: !objectiveMet(objective, holder, units), inOffice: true, rewarded: false } } };
  }
  // Breaking the terms: a participant's recognition is withdrawn; the maker's breach ends the accord and costs credibility.
  function breakTerms(holder, unitId) {
    const t = holder.accord; if (!t) return { holder };
    if (unitId === holder.id) return { holder: { ...holder, accord: null, promise: null, debt: true }, ended: true };
    return { holder: { ...holder, accord: { ...t, participants: t.participants.filter((id) => id !== unitId), bound: t.bound.filter((id) => id !== unitId) } }, withdrawn: unitId };
  }
  const accordBenefit = (holder) => holder.accord ? holder.accord.bound.map((id) => ({ id, heal: RULES.accordHeal })) : [];

  return { RULES, officeValid, takeOffice, inJurisdiction, recognizers, authenticateOffice, voidClaim, directAlly, dueProcess, breaksLaw,
    onTheRecord, outlawMul, warrantPasses, promise, objectiveMet, routeExists, checkPromise, guarantee, resolvePromise, useMandate,
    exposeCheapTalk, anotherWayHome, homewardMove, homecoming, preparedReturnCost, burnTheBoats, canMove, mustAdvance, deceptionBonus, ambushMul, trapMul, accord, breakTerms, accordBenefit };
});
