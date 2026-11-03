"use strict";
// Tsukumogami rules: pure and seeded. The engine owns state, costs and the log; this module answers
// "what is this structure as an ally", "may it be woken now", and "what does the answer earn".
// Mirrors plant communion (terrain/communion.js). Two spec'd divergences: waking needs the Animist
// self-trait, and a wrong answer never closes the structure — the cost is spent, it stays asleep,
// and the question is fresh each round, so brute force buys nothing.
//
//   profile(type)                         → { type, name, common, size, hp, material, difficulty, need, phi } | null
//   observe(familiarity, invest)          → new familiarity for one structure
//   canCommune({ obj, familiarity, active, ap, pf, dist, animist }) → { ok, reason, profile }
//   pickQuestion(type, seed) / scoreAnswer(questionId, choice)
//   makeAlly(obj, { owner, side })        → the ally's identity and stats (the engine adds its turn fields)
//   settleTile(tiles, x, y)               → the footprint tile nearest where it woke
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./tsukumogami-data.js"), require("./vegetation-data.js"));
  else root.ConceptCombatTsukumogami = factory(root.ConceptCombatTsukumogamiData, root.ConceptCombatVegetation);
})(typeof self !== "undefined" ? self : this, function (D, V) {
  const R = D.rules;
  function hash(str) {
    let h = 2166136261;
    for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function profile(type) {
    const o = V.objects?.[type]; if (!o || !(o.tags || []).includes("structure")) return null;
    if (!(o.hp > 0)) return null;
    const size = o.sightHeight ?? 0;
    const difficulty = D.types[type]?.difficulty ?? D.sizes[size]?.difficulty ?? 1;
    return { type, common: o.name, name: `${o.name} (awakened)`, size, sightHeight: size, hp: o.hp, material: o.material,
      difficulty, need: difficulty, phi: R.phiBase + R.phiPerDifficulty * difficulty };
  }

  function observe(familiarity = 0, invest = R.observeStep) {
    const spend = Math.max(R.observeStep, Math.min(R.observeMax, Math.floor(invest / R.observeStep) * R.observeStep));
    return { familiarity: familiarity + spend / R.observeStep, spend };
  }

  function canCommune({ obj, familiarity = 0, active = 0, ap = 0, pf = 0, dist = 0, animist = false } = {}) {
    const p = obj && obj.kind === "object" ? profile(obj.type) : null;
    const no = (reason) => ({ ok: false, reason, profile: p });
    if (!p) return no("Only a standing structure can be woken.");
    if (obj.hp <= 0) return no(`The ${p.common} is rubble. Nothing answers.`);
    if (obj.protected) return no(`The ${p.common} is warded. It will not wake.`);
    if (!animist) return no("It will answer someone who knows it has a soul — not you.");
    if (active >= R.maxActive) return no("You already have an awakened structure standing. One at a time.");
    if (familiarity < p.need) return no(`Study the ${p.common} first (${familiarity}/${p.need} familiarity).`);
    if (dist > R.range) return no("Stand beside the structure to wake it.");
    if (ap < R.communeAp) return no(`Waking it needs ${R.communeAp} action points.`);
    if (pf < p.phi) return no(`Waking the ${p.common} needs ${p.phi} ΦF.`);
    return { ok: true, reason: null, profile: p };
  }

  function pool(type) {
    const fits = (q) => !q.for || (q.for.type ? q.for.type === type : true);
    const all = D.questions.filter(fits), narrow = all.filter((q) => q.for);
    return narrow.length ? narrow.concat(all.filter((q) => !q.for)) : all;
  }
  function pickQuestion(type, seed = 0) {
    const list = pool(type); if (!list.length) return null;
    const q = list[Math.floor(hash(`${seed}:commune:${type}`) * list.length)];
    return { id: q.id, prompt: q.prompt, choices: q.choices.slice(), answer: q.answer, explain: q.explain };
  }
  // Observe teaches O2a: one question per structure per battle, the same for every asker (mirror of Communion.questionFor).
  // Derived from battle seed and object id, never stored; no round, no observer, so observing round 1 and waking round 9 agree.
  function questionFor(obj, battleSeed = 0) {
    if (!obj) return null;
    const q = pickQuestion(obj.type, `${battleSeed}:pin:${obj.id}`);
    return q && { ...q, clue: D.questions.find((x) => x.id === q.id)?.clue || null };
  }
  function scoreAnswer(questionId, choice) {
    const q = D.questions.find((x) => x.id === questionId);
    if (!q) return { correct: false, explain: "No question." };
    return { correct: choice === q.answer, explain: q.explain, answer: q.answer, skipped: choice == null };
  }

  const MATERIAL_TRAIT = { wood: "light", stone: "heavy", metal: "rigid", glass: "brittle" };
  function makeAlly(obj, { owner = "player", side = "player" } = {}) {
    const p = profile(obj.type);
    const lf = Math.max(1, (obj.hp || 0) * 2);
    const [primary, secondary] = D.concepts[obj.type] || ["barrier", "boundary"];
    return { id: `awaken-${obj.id}`, name: p.name, side, controller: "ai", character: `structure-${obj.type}`, sprite: `tsukumogami-${obj.type}`,
      primary, secondary, traits: [MATERIAL_TRAIT[p.material]].filter(Boolean),
      maxLF: lf, lf, x: obj.x, y: obj.y,
      awakened: { type: obj.type, owner, size: p.size, material: p.material, roundsLeft: R.rounds, wakeX: obj.x, wakeY: obj.y, object: { ...obj, status: { ...(obj.status || {}) } } } };
  }
  // Settling back: the footprint tile nearest where it woke. Pure: the engine passes the tiles.
  function settleTile(tiles, x, y) {
    let best = tiles[0];
    for (const t of tiles) if (Math.abs(t[0] - x) + Math.abs(t[1] - y) < Math.abs(best[0] - x) + Math.abs(best[1] - y)) best = t;
    return best;
  }

  return { rules: R, data: D, profile, observe, canCommune, pickQuestion, questionFor, scoreAnswer, makeAlly, settleTile, materialTrait: (mat) => MATERIAL_TRAIT[mat] || null };
});
