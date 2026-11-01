"use strict";
// Plant facts: pure and seeded (Communion cutscenes, slice S0). What a plant says when it answers a commune.
// UI-only: the engine never loads this, reads no battle state and never calls the battle's RNG, so a cutscene cannot change a battle.
//
//   pick(type, { seed, objId, heard })  → { fact, opener } | null     deterministic in its arguments; `heard` is a list of fact ids
//   markHeard(plantFacts, type, id)     → new plantFacts object         pure; the UI stores it ({ v, seen, last, cycles, heard })
//   sulk(type, { seed, objId })         → { line } | null
//   sceneMs(opener, fact)               → ms the card stays up
//   banks(type)                         → the eligible facts for a species (its own bank, else its form's), in order
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./plant-facts-data.js"), require("./communion.js"));
  else root.ConceptCombatPlantFacts = factory(root.ConceptCombatPlantFactsData, root.ConceptCombatCommunion);
})(typeof self !== "undefined" ? self : this, function (D, C) {
  const R = D.rules, retired = new Set(D.retired || []);
  // The same FNV-1a mix communion.js uses for pickQuestion (copied, not shared, so communion.js is untouched).
  function hash(str) {
    let h = 2166136261;
    for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const eligible = (f) => R.eligible.includes(f.confidence) && !retired.has(f.id);
  // A species' own bank; failing that its form's (carnivores use the carnivore bank); failing that nothing (the commune stays silent).
  function banks(type) {
    const own = (D.facts[type] || []).filter(eligible);
    if (own.length) return own;
    const p = C.profile(type); if (!p) return [];
    return (D.forms[p.carnivorous ? "carnivore" : p.form] || []).filter(eligible);
  }
  const voice = (type) => { const p = C.profile(type); return p && D.voices[p.aura] ? D.voices[p.aura] : null; };
  const at = (list, seed, key) => list[Math.min(list.length - 1, Math.floor(hash(`${seed}:${key}`) * list.length))];
  function pick(type, { seed = 0, objId = "", heard = [], last = null } = {}) {
    const bank = banks(type); if (!bank.length) return null;
    const heardSet = new Set(heard);
    let fresh = bank.filter((f) => !heardSet.has(f.id));
    if (!fresh.length) fresh = bank.length > 1 && last ? bank.filter((f) => f.id !== last) : bank;   // a full cycle starts over, never with the one just heard
    const fact = at(fresh, seed, `fact:${objId}`), v = voice(type);
    return { fact, opener: v ? at(v.opener, seed, `opener:${objId}`) : "" };
  }
  function markHeard(pf, type, id) {
    const p = pf && pf.v === 1 ? pf : { v: 1, seen: {}, last: {}, cycles: {}, heard: 0 };
    const bank = banks(type).map((f) => f.id);
    let seen = (p.seen[type] || []).filter((x) => bank.includes(x)), cycles = p.cycles[type] || 0;
    if (!seen.includes(id)) seen = [...seen, id];
    if (bank.length && bank.every((x) => seen.includes(x))) { seen = []; cycles += 1; }   // every fact heard: the list resets and the cycle counts
    return { v: 1, seen: { ...p.seen, [type]: seen }, last: { ...p.last, [type]: id }, cycles: { ...p.cycles, [type]: cycles }, heard: (p.heard || 0) + 1 };
  }
  function sulk(type, { seed = 0, objId = "" } = {}) {
    const v = voice(type); return v ? { line: at(v.sulk, seed, `sulk:${objId}`) } : null;
  }
  const sceneMs = (opener, fact) => Math.max(6000, Math.min(12000, 2200 + 30 * (String(opener || "").length + String(fact || "").length)));
  return { rules: R, data: D, banks, pick, markHeard, sulk, sceneMs };
});
