"use strict";
// Generation (W8.6 build; Pantry-B, 2026-10-26): enemy lo-ci, familiar parts and unique wholes. Every enemy lo-ci assembles
// from the same verb nodes and emergence table the player uses (verbs.js); rarity keeps it rare. Spec:
// ready-to-review/muse-wave8/specs/GENERATION.md; numbers from its sim.
//
// Deterministic from the battle seed (its own hash stream: no battle roll is consumed). Read-only intel: a generated lo-ci
// changes nothing in combat; Observe reads it out.
//
//   RULES                          → rarity by tier, verbs per tier, door weights, dial jitter, lesson chance
//   tierOf(actor)                  → "boss" | "elite" | "rabble" (rabble never carries a lo-ci)
//   fallbackDoor(concept)          → a stable school index for a concept until workshop/schools.js (W8.1 door table) lands
//   assemble(key, door, tier)      → { door, schools, verbs, dials, name, named, meaning }
//   forBattle(seed, units, doorOf) → { [unitId]: lo-ci } (rarity rolled per unit; no two share an equation in one battle)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./verbs.js"));
  else root.ConceptCombatWorkshopGeneration = factory(root.ConceptCombatWorkshopVerbs);
})(typeof self !== "undefined" ? self : this, function (VB) {
  const RULES = { rarity: { rabble: 0, elite: 0.12, boss: 0.45 }, verbs: { elite: [1, 2], boss: [2, 3] }, doorWeights: [0.6, 0.25, 0.15], jitter: 1, rerolls: 20, lesson: 0.08 };   // lesson: chance an assembly's first two verbs come straight from one emergence-table row ('Generation lesson rule' ruling, provisional)
  function roll(key) {   // FNV-1a + avalanche, as wild/monsters.js roll(): stable per key, independent of the battle's RNG
    let h = 2166136261;
    for (const c of String(key)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const tierOf = (a) => a?.boss ? "boss" : (a?.monster || a?.beast || a?.wild || a?.summon || a?.companion || a?.dream) ? "rabble" : "elite";
  const fallbackDoor = (concept) => Math.floor(roll(`door:${concept || "none"}`) * 8);
  const byschool = (school) => Object.keys(VB.VERBS).map(Number).filter((id) => VB.VERBS[id].school === school);
  function pickSchool(key, door) {   // home 60%, a ring neighbour 25%, anywhere 15%
    const r = roll(`${key}:school`), [home, near] = RULES.doorWeights;
    if (r < home) return door;
    if (r < home + near) return (door + (roll(`${key}:side`) < 0.5 ? 1 : 7)) % 8;
    return Math.floor(roll(`${key}:anywhere`) * 8);
  }
  const title = (w) => w.charAt(0) + w.slice(1).toLowerCase();
  function assemble(key, door, tier) {
    const [lo, hi] = RULES.verbs[tier] || RULES.verbs.elite, n = lo + Math.floor(roll(`${key}:n`) * (hi - lo + 1));
    const rows = Object.keys(VB.SEEDS), lesson = n >= 2 && roll(`${key}:lesson`) < RULES.lesson   // the wilds teach the table: a taught lo-ci opens with one full row
      ? rows[Math.floor(roll(`${key}:lesson:row`) * rows.length)].split("x").map(Number) : null;
    const schools = [], verbs = [], dials = {};
    for (let i = 0; i < n; i++) {
      const taught = lesson && i < 2 ? lesson[i] : null;
      const school = taught ? VB.VERBS[taught].school : pickSchool(`${key}:${i}`, door);
      const pool = byschool(school).filter((v) => !verbs.includes(v));   // distinct verbs in one lo-ci
      if (!pool.length) continue;
      const verb = taught || pool[Math.floor(roll(`${key}:${i}:verb`) * pool.length)];
      schools.push(school); verbs.push(verb);
      dials[verb] = Object.fromEntries(VB.VERBS[verb].dials.map((d) => {   // familiar, not identical: each dial one step off default
        const step = roll(`${key}:${i}:${d.name}`) < 0.5 ? -RULES.jitter : RULES.jitter;
        return [d.name, VB.clampDial(verb, d.name, d.def + step).value];
      }));
    }
    const row = verbs.length >= 2 ? VB.seed(verbs[0], verbs[1]) : null;
    const word = verbs.map((v) => title(VB.VERBS[v].name)).join("-"), water = VB.SCHOOLS[door];
    return { door, schools, verbs, dials, named: !!row, meaning: row?.meaning || null,
      name: row ? `${row.name}, of the ${water} Water` : `${word}bound of the ${water} Water` };
  }
  function forBattle(seed, units, doorOf = (u) => fallbackDoor(u.primary)) {
    const out = {}, seen = new Set();
    for (const u of [...(units || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
      const tier = tierOf(u);
      if (!(roll(`${seed}:loci:${u.id}`) < RULES.rarity[tier])) continue;
      let lo = null;
      for (let k = 0; k < RULES.rerolls && (!lo || seen.has(lo.verbs.join("x"))); k++) lo = assemble(`${seed}:${u.id}:${k}`, doorOf(u), tier);
      if (seen.has(lo.verbs.join("x"))) continue;   // a crowded battle that cannot find a fresh lo-ci leaves this unit plain
      seen.add(lo.verbs.join("x")); out[u.id] = lo;
    }
    return out;
  }
  return { RULES, tierOf, fallbackDoor, assemble, forBattle };
});
