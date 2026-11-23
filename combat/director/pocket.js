"use strict";
// The pocket: stash the outside battle, run a sealed room in its place, restore it (Chef spec section 2, slice W1).
// Extracted from director.js cast/collapse so the Director's film and the Chef's banquet share one stash and one restore.
// stash(s, keepIds, arena, extraKeys) moves every actor not in keepIds out of s.actors into saved.actors, saves the order,
// the turn index, the arena and the coordinate-keyed lists, clears those lists for the room, and installs the room arena.
// extraKeys names further top-level keys to stash and clear: an array of names (each is null inside the room) or an object
// { name: the empty value inside } for keys the engine reads without a guard (s.traps.filter, s.trueFormFields.push).
// The banquet stashes the stations and the tile hazards (their tiles are outside tiles); the Director passes none.
// restore(s, saved) puts every saved key back and returns the stashed actors to s.actors. Positions of the kept actors
// are the caller's to restore (the Director keeps the mark's, the banquet keeps every seated unit's).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatPocket = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const LISTS = ["wild", "scheduled", "terrainEffects", "barriers", "successionPatches"];
  function stash(s, keepIds, arena, extraKeys = []) {
    const keep = new Set(keepIds);
    const extra = Array.isArray(extraKeys) ? Object.fromEntries(extraKeys.map((k) => [k, null])) : extraKeys;
    const saved = { order: s.order.slice(), turnIndex: s.turnIndex, arena: s.arena, actors: {},
      wild: s.wild, scheduled: s.scheduled, terrainEffects: s.terrainEffects, barriers: s.barriers,
      successionPatches: s.successionPatches, dreamSpace: s.dreamSpace || null,
      roundEnvironmentProcessed: s.roundEnvironmentProcessed };
    for (const k of Object.keys(extra)) saved[k] = s[k] === undefined ? null : s[k];
    for (const [id, u] of Object.entries(s.actors)) if (!keep.has(id)) { saved.actors[id] = u; delete s.actors[id]; }
    for (const k of LISTS) s[k] = [];
    s.dreamSpace = null;
    for (const [k, empty] of Object.entries(extra)) s[k] = Array.isArray(empty) ? [] : empty;
    s.arena = arena;
    return saved;
  }
  function restore(s, sv) {
    for (const [id, u] of Object.entries(sv.actors)) s.actors[id] = u;
    s.order = sv.order; s.turnIndex = sv.turnIndex;
    s.arena = sv.arena; s.wild = sv.wild; s.scheduled = sv.scheduled; s.terrainEffects = sv.terrainEffects;
    s.barriers = sv.barriers; s.successionPatches = sv.successionPatches; s.dreamSpace = sv.dreamSpace;
    s.roundEnvironmentProcessed = sv.roundEnvironmentProcessed;
    for (const k of Object.keys(sv)) if (!(k in BASE)) { if (sv[k] === null) delete s[k]; else s[k] = sv[k]; }
  }
  const BASE = { order: 1, turnIndex: 1, arena: 1, actors: 1, wild: 1, scheduled: 1, terrainEffects: 1, barriers: 1,
    successionPatches: 1, dreamSpace: 1, roundEnvironmentProcessed: 1 };
  return { stash, restore };
});
