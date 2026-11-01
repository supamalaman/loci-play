"use strict";
// Safe, privacy-filtered boundary between the deterministic combat engine and an external decision provider.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatLLMDecision = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const VERSION = 1;
  const PUBLIC_STATUS = ["guard", "ward", "parry", "membrane", "anchor", "stun", "entangled", "immovable", "exposed", "drowning"];
  const point = (x, y) => [x, y];
  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
    return JSON.stringify(value);
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
    return h.toString(36);
  }
  function candidate(action, summary, legalActions) {
    if (!legalActions.some(x => x.id === hash(stable(action)))) legalActions.push({ id: hash(stable(action)), action, summary });
  }
  function buildLegalActions(E, state, actorId) {
    const decision = E.decider(state);
    if (!decision || decision.actor !== actorId) return [];
    const legal = [];
    const offer = (action, summary) => {
      try { if (E.apply(state, action, { preview: true }).ok) candidate(action, summary, legal); } catch (_) { /* unsupported parameterized action: omit */ }
    };
    if (decision.kind === "response") {
      for (const response of E.responseOptions(state)) offer(
        { type: "respond", actor: actorId, response: response.kind, ...(response.to ? { to: response.to } : {}) },
        response.kind === "reposition" ? `Dodge to (${response.to.join(",")})${response.safe ? " · safe" : ""}` : response.kind === "guard" ? "Guard against the announced attack" : response.kind === "lookAway" ? "Look away" : "Accept the attack");
      if (!legal.some(x => x.action.response === "none")) offer({ type: "respond", actor: actorId, response: "none" }, "Keep position");
      return legal;
    }
    for (const option of E.moveOptions(state, actorId)) offer({ type: "move", actor: actorId, to: option.to }, `Move to (${option.to.join(",")}) · ${option.tempoCost} AP`);
    for (const option of E.jumpOptions(state, actorId)) offer({ type: "jump", actor: actorId, to: option.to }, `Jump to (${option.to.join(",")})`);
    for (const option of E.climbOptions(state, actorId)) offer({ type: "climb", actor: actorId, to: option.to }, `Climb to (${option.to.join(",")})`);
    for (const ability of E.availableAbilities(state, actorId)) {
      if (!ability.affordable) continue;
      let targetOptions;
      try { targetOptions = E.targeting(state, actorId, ability.id).legal; } catch (_) { continue; }
      for (const target of targetOptions || []) offer(
        { type: "ability", actor: actorId, ability: ability.id, target: target.at },
        `${ability.m.name} → (${target.at.join(",")}) · ${ability.m.tempoCost} AP`);
    }
    const unit = state.actors[actorId];
    if (unit?.tempo >= state.rules.actionCosts.guard && !unit.guardUsedThisTurn) offer({ type: "guard", actor: actorId }, `Guard · ${state.rules.actionCosts.guard} AP`);
    if (unit?.tempo > 0) offer({ type: "stall", actor: actorId }, `Stall and bank up to ${Math.min(unit.tempo, state.rules.maxBankedActionPoints)} AP`);
    offer({ type: "end", actor: actorId }, "End turn");
    return legal;
  }
  function publicUnit(unit, viewer) {
    const sameSide = unit.side === viewer.side;
    return {
      id: unit.id, name: unit.name, character: unit.character, side: unit.side,
      at: point(unit.x, unit.y), lf: unit.lf, maxLF: unit.maxLF,
      ...(sameSide ? { concepts: { primary: unit.primary, secondary: unit.secondary } } : {}),
      statuses: PUBLIC_STATUS.filter(key => !!unit.status?.[key]),
      defeated: !!unit.defeated,
    };
  }
  function buildStateView(E, state, actorId, { battleId = "battle" } = {}) {
    const actor = state.actors[actorId];
    const d = E.decider(state);
    if (!actor || !d || d.actor !== actorId) throw new Error("The requested actor is not the current decision-maker.");
    const canSee = (unit) => unit.id === actorId || unit.side === actor.side || E.geometry.hasSight(state, actor.x, actor.y, unit.x, unit.y);
    const units = Object.values(state.actors).filter(canSee).map(unit => publicUnit(unit, actor));
    const wild = (state.wild || []).flatMap(m => {
      // Wildlife units use x/y; fronts may use at; spreading fields use a tile dictionary. Never send
      // missing coordinates into the integer line-of-sight traversal.
      const positions = Number.isInteger(m.x) && Number.isInteger(m.y) ? [[m.x,m.y]]
        : Array.isArray(m.at) ? [m.at] : Object.keys(m.tiles || {}).map(k => k.split(",").map(Number));
      const seen = positions.filter(p => p.length === 2 && p.every(Number.isInteger)
        && E.geometry.hasSight(state, actor.x, actor.y, p[0], p[1]));
      if (!seen.length) return [];
      return [{ id: m.id, name: m.name, kind: m.kind, form: m.form, side: "wild", at: seen[0],
        ...(m.tiles ? { tiles: seen } : {}), lf: m.hp ?? m.lf, maxLF: m.maxHP ?? m.maxLF, defeated: !!m.defeated }];
    });
    const visible = [];
    for (let y = 0; y < state.arena.h; y++) for (let x = 0; x < state.arena.w; x++) {
      if (x !== actor.x || y !== actor.y) if (!E.geometry.hasSight(state, actor.x, actor.y, x, y)) continue;
      const tile = E.geometry.tileAt(state, x, y) || {};
      visible.push({ at: [x, y], name: tile.name || tile.terrain || "ground", height: E.geometry.heightAt(state, x, y),
        cover: tile.cover || 0, blocksMove: !!tile.blocksMove, water: !!(tile.water || tile.deepWater) });
    }
    const pending = state.phase === "response" ? {
      attacker: state.actors[state.pending?.attacker]?.name || "opponent",
      technique: state.pending?.inst?.name || "announced attack",
      announcedTiles: state.pending?.announcedTiles || [],
      announcement: state.log.slice().reverse().find(e => e.kind === "announce")?.text || "",
    } : null;
    const decisionId = `${battleId}:r${state.round}:${actorId}:${d.kind}:${state.seq || 0}`;
    return {
      v: VERSION, decisionId, round: state.round, phase: d.kind, encounter: state.arena.name,
      actor: { id: actor.id, name: actor.name, character: actor.character, side: actor.side, at: [actor.x, actor.y],
        lf: actor.lf, maxLF: actor.maxLF, pf: actor.pf, maxPF: actor.maxPF, ap: actor.tempo, apCapacity: actor.tempoCapacity,
        bankedAP: actor.bankedTempo, tempoDebt: actor.tempoDebt, ultimateCharge: actor.ultimateCharge,
        concepts: { primary: actor.primary, secondary: actor.secondary } },
      units, wild, visibleTiles: visible, pending,
    };
  }
  function requestFor(E, state, { battleId = "battle", seq = 1 } = {}) {
    const d = E.decider(state);
    if (!d) throw new Error("Battle has no active decision.");
    const view = buildStateView(E, state, d.actor, { battleId });
    const legalActions = buildLegalActions(E, state, d.actor);
    if (!legalActions.length) throw new Error("No legal actions are available for the current decision.");
    return { v: VERSION, type: "decision.request", seq, decisionId: view.decisionId, view, legalActions };
  }
  function resolveReply(request, reply, currentDecisionId = request.decisionId) {
    if (!reply || reply.v !== VERSION || reply.type !== "decision.reply") throw new Error("Unsupported LLM decision reply.");
    if (reply.seq !== request.seq || reply.decisionId !== request.decisionId || currentDecisionId !== request.decisionId) throw new Error("Stale LLM decision reply.");
    if (typeof reply.actionId !== "string") throw new Error("LLM reply must select a legal action ID.");
    const selected = request.legalActions.find(option => option.id === reply.actionId);
    if (!selected) throw new Error("LLM selected an action outside the legal candidate list.");
    return selected.action;
  }
  return { VERSION, buildLegalActions, buildStateView, requestFor, resolveReply };
});
