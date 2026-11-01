"use strict";

// Maid maintenance rules. Filth is a small, deterministic battlefield state:
// damaged or destroyed fixtures leave residue, which increases the AP cost of
// crossing that tile until the Maid clears it into her finite service bin.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatMaidSystems = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const key = (x, y) => `${x},${y}`;
  const ensure = (s) => (s.maidMaintenance ||= { filth: {}, maintained: {} });
  const levelAt = (s, x, y) => s.maidMaintenance?.filth?.[key(x, y)] || 0;
  const serviceCycleActive = (actor) => actor?.character === "maid" && actor.aura?.classModifier === "service-cycle" && !actor.aura.imbued;

  function addFilth(s, x, y, amount = 1) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || amount <= 0) return 0;
    const state = ensure(s), k = key(x, y), before = state.filth[k] || 0;
    state.filth[k] = Math.min(3, before + amount);
    delete state.maintained[k]; // fresh residue undoes the maintained workspace
    return state.filth[k] - before;
  }

  function canClean(s, actor, x, y) {
    if (actor?.character !== "maid" || levelAt(s, x, y) <= 0) return false;
    if (serviceCycleActive(actor)) return true; // the active aura metabolizes residue instead of using bin capacity
    const bin = (s.arena?.objects || []).find(o => o.role === "service-receptacle" || o.evidenceId === "receptacle");
    return !!bin && bin.hp > 0 && (bin.stored || []).length < 3;
  }

  function clean(s, actor, x, y) {
    if (!canClean(s, actor, x, y)) return false;
    const state = ensure(s), k = key(x, y), bin = (s.arena.objects || []).find(o => o.role === "service-receptacle" || o.evidenceId === "receptacle");
    const before = state.filth[k];
    state.filth[k] = before - 1;
    if (!state.filth[k]) {
      delete state.filth[k];
      state.maintained[k] = actor.id;
    }
    const metabolized = serviceCycleActive(actor);
    if (!metabolized) { bin.stored ||= []; bin.stored.push({ kind: "filth", name: "Battle residue", amount: 1, from: [x, y] }); }
    return { before, after: before - 1, maintained: before === 1, metabolized };
  }

  function moveCostAdd(s, x, y) { return levelAt(s, x, y) * 10; }

  function invalidateMaintenance(s, x, y) { delete ensure(s).maintained[key(x, y)]; }

  function preparedDiscount(s, actor, abilityId, target) {
    if (actor?.character !== "maid" || !Array.isArray(target) || !["sort", "clearTheObstruction", "controlledRemoval"].includes(abilityId)) return 0;
    const k = key(target[0], target[1]);
    return !levelAt(s, target[0], target[1]) && s.maidMaintenance?.maintained?.[k] === actor.id ? 10 : 0;
  }

  function utilityChargeMultiplier(manifest) {
    // Offensive techniques retain the normal rate. Valid non-damaging abilities
    // earn 50% more, reflecting tactical setup and support work.
    return manifest && !["damage", "field"].includes(manifest.effect) ? 1.5 : 1;
  }

  function canRechargeAura(actor, inst) {
    return serviceCycleActive(actor)
      && inst?.ability === "clearTheObstruction" && !!inst.maidFilth;
  }

  function visibleFilth(s, actor, canSee) {
    if (actor?.character !== "maid") return [];
    return Object.entries(ensure(s).filth).filter(([k, n]) => n > 0 && canSee(...k.split(",").map(Number))).map(([k, level]) => ({ tile: k.split(",").map(Number), level }));
  }

  return { ensure, levelAt, addFilth, canClean, clean, moveCostAdd, invalidateMaintenance, preparedDiscount, utilityChargeMultiplier, canRechargeAura, serviceCycleActive, visibleFilth };
});
