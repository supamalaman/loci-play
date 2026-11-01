"use strict";
// Hidden traps (Muse sandbox batches 8 and 12, ported 2026-10-10 as C9 and C14). Numbers and the pure parts of the
// rules; the engine owns placement, triggering and logging (engine.js "Traps").
//
// A trap sits on a tile. How well it is hidden depends on whether any enemy could see the tile when it was set:
// unseen 0.9, in plain sight 0.3. Triggers are positional (C26): stepping on a live trap always springs it,
// aware or not, either side; knowledge only shapes movement. From beside a hidden trap a unit may spot it with
// probability (1 - hidden); a trap it knows about, or one hidden less than 0.4, is already known. The map shows
// the player their own side's traps and enemy traps they know; anything else stays hidden.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTraps = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const rules = {
    placeAp: 30, potency: 8, hiddenUnseen: 0.9, hiddenSeen: 0.3, knownBelow: 0.4,
    // Who can set one (Mala, 2026-10-14: "Traps don't seem to be a useful addition to the game. Maybe we limit their use to
    // specific classes that are able to use them more effectively."). Disarming stays open to everyone.
    setters: { classes: ["ninja", "thief", "ranger", "surveyor", "soldier"], trait: "tinkerer" },
    disarm: { minAp: 50, costMin: 50, costSpan: 50, base: 0.55, tinkererAdd: 0.3, trait: "tinkerer" },   // 50-100 AP, debt allowed
    // The AI lays and disarms traps only in open battles; the authored lessons (First Wall, Gap Court) stay as written.
    ai: { encounters: ["randomEncounter", "rosterScrimmage", "warfare"], placeChance: 0.4, foeMin: 2, foeMax: 6, spacing: 2, disarmChance: 0.4, tinkererDisarmChance: 0.7, avoidPerPotency: 2 },   // C27: known-trap routes are filtered, not priced (engine/ai.js routeCrossesKnownTrap)
  };
  const hash = (text) => { let h = 2166136261; for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
  const roll = (text) => (hash(text) % 1000) / 1000;
  const tkey = (t) => `${t.x},${t.y}:${t.ownerSide || "?"}`;
  const live = (traps, x, y) => (traps || []).filter((t) => !t.spent && t.x === x && t.y === y);
  // Does this unit already know the trap is there?
  const known = (unit, t) => !!(unit?.trapSeen && unit.trapSeen[tkey(t)]) || t.hidden < rules.knownBelow || t.ownerSide === unit?.side;
  const traitIds = (unit) => (unit?.traits || []).map((t) => (typeof t === "string" ? t : t?.id));
  const canSet = (unit) => !!unit && (rules.setters.classes.includes(unit.character) || traitIds(unit).includes(rules.setters.trait));
  const make = ({ x, y, owner, ownerSide, seen }) => ({ x, y, hidden: seen ? rules.hiddenSeen : rules.hiddenUnseen, potency: rules.potency, owner, ownerSide, trips: 0 });
  // Entering a trapped tile: does the unit notice it in time? `helpless` = thrown in or routed.
  function notices(unit, t, seed, helpless = false) {
    if (helpless) return false;
    return known(unit, t) || roll(`${seed}:${unit.id}:${tkey(t)}:${t.trips || 0}`) >= t.hidden;
  }
  function disarmAttempt(seed, unitId, n, tinkerer) {
    const D = rules.disarm;
    return { cost: D.costMin + (hash(`${seed}:${unitId}:cost:${n}`) % (D.costSpan + 1)), chance: D.base + (tinkerer ? D.tinkererAdd : 0), ok: roll(`${seed}:${unitId}:roll:${n}`) < D.base + (tinkerer ? D.tinkererAdd : 0) };
  }
  return { rules, hash, roll, tkey, live, known, canSet, make, notices, disarmAttempt };
});
