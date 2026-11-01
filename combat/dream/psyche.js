"use strict";
// Jungian-inspired psyche layer for FOCUSED Dream Space (Mala, loop 1a12351800e-cc7f; designed and built by Cursor 2026-10-09).
// "Jungian-inspired" is a game vocabulary, not a clinical claim: six patterns that a mind can lean on. Pure functions.
//
// DESIGN BOUNDARY
//   - Only a focused dream (field.region) uses this. Ordinary global Dream Space is unchanged, and enemy Dream Space keeps its
//     own pool (enemy-dreams-data.js).
//   - Occupants are units INSIDE the sealed region, alive, and not wild, not a dream creature, not a summon.
//     Units outside are never drawn on; their psyche doesn't exist for this field.
//   - Each occupant holds up to two "complexes" (archetypes), drawn once per field from the seed, leaning on traits they
//     already have. Each archetype is the source of exactly one dream monster from the player's pool (1:1), so a
//     manifestation always comes "from their own pool".
//   - Integration (0..1) is how well an occupant knows and holds that pattern. It reduces how often and how hard it manifests.
//
// INTEGRATION
//   player:   0.4 × self-traits known + 0.4 × traumas resolved (1 if none) + 0.2 × dreams met (3 for full), from the Insight/Mirror record.
//   others:   0.4 baseline, ±0.1 per steadying / unsteadying trait (net clamp −0.2…+0.25), clamp 0.1…0.9.
//   Facing a manifestation in the battle raises its owner's integration: hold its gaze +0.12, name it +0.10, break it +0.05, at most +0.30 a battle.
//   Persistent progress is the player's existing self/mirror record (Observe Self, resolving trauma, befriending dreams): this layer saves nothing new.
//
// EFFECTS (caps are explicit; nothing stacks past them)
//   - Which dream: weight = Σ over each occupant's complexes of (0.15 + (1 − integration)), the second complex at ×0.5.
//   - How often: the focused dream's ambient chance × clamp(0.75 + 0.5 × mean(1 − integration), 0.75, 1.25).
//   - How hard: manifestation potency ×clamp(0.9 + 0.35 × (1 − integration), 0.9, 1.25); a wrong Name-it can't push it above ×1.5.
//   - Where: inside the region only. Outside-turn behavior: a manifestation takes ordinary wild turns, hostile to every side,
//     confined by the same seal as everyone else; outside units never gain or lose integration from it.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatDreamPsyche = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const rules = {
    floor: 0.15, secondWeight: 0.5, wellIntegrated: 0.6, baseline: 0.4, clampIntegration: [0.1, 0.9],
    appearScale: [0.75, 1.25], potency: [0.9, 1.25], potencyCap: 1.5, gainCap: 0.3,
    gains: { holdGaze: 0.12, nameIt: 0.1, defeat: 0.05 }, traitBias: 0.4,
    steadying: ["calm", "empathic", "genius", "honest", "apologetic", "steadyUnderPressure", "collaborative", "believer"],
    unsteadying: ["impulsive", "quickTempered", "reckless", "distractible", "hesitant", "selfDoubt", "perfectionist", "needsApproval"],
  };

  // Six patterns, each the single source of one dream monster in the player's pool (dream-data.js).
  const archetypes = {
    persona: { name: "Persona", monster: "witness_vessel", text: "The face shown to others. It frays when you need to be seen as something you aren't.", leansOn: ["needsApproval", "proudSelf", "proud"] },
    shadow: { name: "Shadow", monster: "many_mouths", text: "What is disowned. It follows from every direction you aren't looking.", leansOn: ["fearOfPursuit", "impulsive", "quickTempered"] },
    anima: { name: "Anima / Animus", monster: "salt_heir", text: "The inner other: the part that holds what was left unsaid and guards what remains.", leansOn: ["fearOfScarcity", "lonely", "loyalSelf"] },
    trickster: { name: "Trickster", monster: "last_span", text: "The part that breaks a safe road to see whether you can improvise.", leansOn: ["afraidOfFalling", "restless", "curious"] },
    senex: { name: "Old King (Senex)", monster: "unfinished_customer", text: "The part that repeats what once worked, long after it stops working.", leansOn: ["stuckInRoutine", "stubborn", "cautious"] },
    child: { name: "Child", monster: "amber_host", text: "The part that looks for a way out of a crowded room.", leansOn: ["overwhelmed", "distractible", "curiousSelf"] },
  };
  const monsterOf = Object.fromEntries(Object.entries(archetypes).map(([k, a]) => [a.monster, k]));

  function roll(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const round2 = (n) => Math.round(n * 100) / 100;

  // The player's integration, from the Insight/Mirror record. All inputs are optional.
  function integrationFromRecord({ self = { traits: [] }, traumaStatus = null, dreamsBefriended = [], dreamsForFull = 3 } = {}) {
    const traits = self.traits || [];
    const known = traits.length ? traits.filter((t) => t.known).length / traits.length : 0.5;
    const tr = traumaStatus || { unknown: [], known: [], resolved: [] };
    const total = (tr.unknown || []).length + (tr.known || []).length + (tr.resolved || []).length;
    const resolved = total ? (tr.resolved || []).length / total : 1;
    const met = Math.min(1, new Set(dreamsBefriended).size / dreamsForFull);
    return round2(clamp(0.4 * known + 0.4 * resolved + 0.2 * met, ...rules.clampIntegration));
  }
  // Anyone else: a baseline nudged by the traits they were observed to have.
  function integrationFromTraits(traits = []) {
    const set = new Set((traits || []).map((t) => (typeof t === "string" ? t : t?.id)));
    const up = rules.steadying.filter((t) => set.has(t)).length, down = rules.unsteadying.filter((t) => set.has(t)).length;
    return round2(clamp(rules.baseline + clamp(0.1 * up - 0.1 * down, -0.2, 0.25), ...rules.clampIntegration));
  }

  // Which patterns an occupant leans on: seeded, nudged by traits they already carry. Well integrated: one; otherwise two.
  function draw(seed, unitId, integration, traits = []) {
    const have = new Set((traits || []).map((t) => (typeof t === "string" ? t : t?.id)));
    const scored = Object.entries(archetypes).map(([id, a]) => ({ id, score: roll(seed, `psyche:${unitId}:${id}`) + (a.leansOn.some((t) => have.has(t)) ? rules.traitBias : 0) }))
      .sort((p, q) => q.score - p.score || (p.id < q.id ? -1 : 1));
    return scored.slice(0, integration >= rules.wellIntegrated ? 1 : 2).map((x) => x.id);
  }

  // Units whose psyche counts in this field.
  function occupants(field, units, contains) {
    return (units || []).filter((u) => !u.defeated && !u.dream && !u.summon && u.side !== "wild" && contains(field, u.x, u.y));
  }

  // Make sure every occupant has a record. Returns a new psyche map (the field is not mutated).
  // ctx[unitId] = { integration?, traits? } supplied by the engine; the player's integration comes from the record.
  function ensure(field, units, seed, ctx = {}, contains) {
    const psyche = { ...(field.psyche || {}) };
    for (const u of occupants(field, units, contains)) {
      if (psyche[u.id]) continue;
      const c = ctx[u.id] || {}, traits = c.traits || u.traits || [];
      const integration = round2(clamp(c.integration ?? integrationFromTraits(traits), ...rules.clampIntegration));
      psyche[u.id] = { integration, base: integration, complexes: draw(seed, u.id, integration, traits), gained: 0 };
    }
    return psyche;
  }

  const present = (field, ids) => ids.filter((id) => field.psyche?.[id]);
  // monster key → weight, and who contributes most to it
  function weights(field, ids) {
    const w = {}, who = {};
    for (const id of present(field, ids)) {
      const p = field.psyche[id];
      p.complexes.forEach((arch, i) => {
        const key = archetypes[arch].monster, add = (rules.floor + (1 - p.integration)) * (i ? rules.secondWeight : 1);
        w[key] = (w[key] || 0) + add;
        if (!who[key] || add > who[key].add || (add === who[key].add && id < who[key].id)) who[key] = { id, add, archetype: arch };
      });
    }
    return { w, who };
  }
  const appearScale = (field, ids) => {
    const ps = present(field, ids).map((id) => field.psyche[id]);
    if (!ps.length) return 1;
    const mean = ps.reduce((n, p) => n + (1 - p.integration), 0) / ps.length;
    return round2(clamp(0.75 + 0.5 * mean, ...rules.appearScale));
  };
  const potencyFor = (integration) => round2(clamp(0.9 + 0.35 * (1 - integration), ...rules.potency));

  // Pick which monster surfaces among `options` (keys not already present), from the occupants' own pools. null: no occupant has one.
  function pick(field, ids, options, seed, tag) {
    const { w, who } = weights(field, ids);
    const pool = options.filter((k) => w[k] > 0);
    if (!pool.length) return null;
    const total = pool.reduce((n, k) => n + w[k], 0);
    let r = roll(seed, `${tag}:psyche`) * total, key = pool[pool.length - 1];
    for (const k of pool) { r -= w[k]; if (r < 0) { key = k; break; } }
    const owner = who[key], p = field.psyche[owner.id];
    return { monster: key, owner: owner.id, archetype: owner.archetype, integration: p.integration, potencyMul: potencyFor(p.integration) };
  }

  // Facing a manifestation raises its owner's integration, up to the battle cap. Returns { field, event|null }.
  function credit(field, ownerId, kind) {
    const p = field?.psyche?.[ownerId], add = rules.gains[kind];
    if (!p || !add) return { field, event: null };
    const room = Math.max(0, rules.gainCap - p.gained), gain = round2(Math.min(add, room, rules.clampIntegration[1] - p.integration));
    if (gain <= 0) return { field, event: null };
    const next = { ...p, integration: round2(p.integration + gain), gained: round2(p.gained + gain) };
    return { field: { ...field, psyche: { ...field.psyche, [ownerId]: next } }, gain, before: p.integration, after: next.integration };
  }

  return { rules, archetypes, monsterOf, integrationFromRecord, integrationFromTraits, draw, occupants, ensure, weights, appearScale, potencyFor, pick, credit };
});
