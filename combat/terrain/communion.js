"use strict";
// Plant communion rules: pure and seeded. The engine owns state, costs and the log; this module answers
// "what is this plant as an ally", "may it be communed with now", and "what does the answer earn".
//
//   profile(type)                         → { type, name, common, form, hp, difficulty, need, phi, primary, secondary, aura } | null
//   observe(familiarity, invest, hiker)   → new familiarity for one plant
//   canCommune({ obj, familiarity, active, closed, ap, pf, dist }) → { ok, reason, profile }
//   pickQuestion(type, seed) / scoreAnswer(questionId, choice)
//   questionFor(obj, battleSeed)          → the plant's one question this battle, with its study note (`clue`)
//   makeAlly(obj, { owner, side })        → the ally's identity and stats (the engine adds its turn fields)
//   revertObject(ally)                    → the plant object it roots back into
//   promoteToTreeant(ally, concept)       → the ally risen as a Treeant (sprite, +LF, Bark ward; engine assigns it)
//   revertTreeant(ally)                   → the Treeant sunk back to its plant form (engine assigns it)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./communion-data.js"), require("./vegetation-data.js"));
  else root.ConceptCombatCommunion = factory(root.ConceptCombatCommunionData, root.ConceptCombatVegetation);
})(typeof self !== "undefined" ? self : this, function (D, V) {
  const R = D.rules;
  function hash(str) {
    let h = 2166136261;
    for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function profile(type) {
    const sp = V.species[type]; if (!sp) return null;
    const f = D.forms[sp.form]; if (!f) return null;
    const o = D.species[type] || {};
    const difficulty = Math.min(5, (o.difficulty ?? f.difficulty) + (sp.carnivorous ? R.carnivorousDifficultyAdd : 0));
    return { type, common: sp.common, name: o.name || `${sp.common} (communed)`, form: sp.form, carnivorous: !!sp.carnivorous,
      hp: o.hp ?? f.hp, difficulty, need: difficulty, phi: R.phiBase + R.phiPerDifficulty * difficulty,
      primary: o.primary || f.primary, secondary: o.secondary || f.secondary, aura: o.aura || f.aura, ...(o.signature ? { signature: o.signature } : {}) };
  }

  function observe(familiarity = 0, invest = R.observeStep, hiker = false) {
    const spend = Math.max(R.observeStep, Math.min(R.observeMax, Math.floor(invest / R.observeStep) * R.observeStep));
    // hiker: true for the hiker bonus, or a number for a combined bonus (hiker + field botany).
    return { familiarity: familiarity + spend / R.observeStep + (hiker === true ? R.hikerBonus : Number(hiker) || 0), spend };
  }

  function canCommune({ obj, familiarity = 0, active = 0, closed = false, ap = 0, pf = 0, dist = 0 } = {}) {
    const p = obj && obj.kind === "plant" ? profile(obj.type) : null;
    const no = (reason) => ({ ok: false, reason, profile: p });
    if (!p) return no("Only a living plant can be communed with.");
    if (obj.hp <= 0) return no("That plant is gone.");
    if (obj.dead) return no(`The ${p.common} is dead. Nothing answers.`);
    if (closed) return no(`The ${p.common} has closed to you for this battle.`);
    if (active >= R.maxActive) return no("You are already communing with a plant. One at a time.");
    if (familiarity < p.need) return no(`Observe the ${p.common} first (${familiarity}/${p.need} familiarity).`);
    if (dist > R.range) return no("Stand beside the plant to commune with it.");
    if (ap < R.communeAp) return no(`Communing needs ${R.communeAp} action points.`);
    if (pf < p.phi) return no(`Communing with the ${p.common} needs ${p.phi} ΦF.`);
    return { ok: true, reason: null, profile: p };
  }

  function pool(type) {
    const sp = V.species[type] || {};
    const fits = (q) => !q.for || (q.for.species ? q.for.species === type : q.for.form ? q.for.form === sp.form : q.for.carnivorous ? !!sp.carnivorous : true);
    const all = D.questions.filter(fits), narrow = all.filter((q) => q.for);
    return narrow.length ? narrow.concat(all.filter((q) => !q.for)) : all;
  }
  function pickQuestion(type, seed = 0) {
    const list = pool(type); if (!list.length) return null;
    const q = list[Math.floor(hash(`${seed}:commune:${type}`) * list.length)];
    return { id: q.id, prompt: q.prompt, choices: q.choices.slice(), answer: q.answer, explain: q.explain };
  }
  // Observe teaches (Mala, 2026-10-31): one question per plant per battle, the same for every asker (the engine, the AI
  // and the dialog), so the study note read on Observe is the question asked. The seed carries no round and no observer.
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

  function makeAlly(obj, { owner = "player", side = "player" } = {}) {
    const p = profile(obj.type);
    return { id: `commune-${obj.id}`, name: p.name, side, controller: "ai", character: `plant-${obj.type}`, sprite: `commune-${obj.type}`,
      primary: p.primary, secondary: p.secondary, maxLF: p.hp, lf: p.hp, x: obj.x, y: obj.y, learned: p.signature ? [p.signature] : [],
      communed: { type: obj.type, owner, aura: p.aura, object: { ...obj, status: { ...(obj.status || {}) } } } };
  }
  // The body a communed plant leaves where it fell: the plant it was, as terrain, and dead.
  function corpseObject(ally) {
    const o = ally.communed.object;
    return { ...o, x: ally.x, y: ally.y, hp: Math.max(1, o.hp || 1), status: {}, trait: null, dead: true, corpseOf: ally.id };
  }

  // Treeant: the poured aura becomes a big body. Pure: returns the risen ally; the engine assigns it.
  function promoteToTreeant(ally, concept) {
    const T = R.treeant;
    const own = (R.treeantSprites || {})[ally.communed?.type];   // per-type art when cut, shared treant otherwise
    return { ...ally, sprite: own || T.sprite, maxLF: ally.maxLF + T.lfAdd, lf: ally.lf + T.lfAdd,
      status: { ...(ally.status || {}), ward: { label: "Bark ward", owner: ally.communed.owner, protection: T.wardProtection, expiresAt: (ally.ownerTurns || 0) + T.wardTurns } },
      treeant: { concept, lfAdd: T.lfAdd, sprite: ally.sprite } };
  }
  // The dream closed: the Treeant sinks back to the plant form it rose from. The Bark ward stays until it expires.
  function revertTreeant(ally) {
    const t = ally.treeant; if (!t) return ally;
    return { ...ally, sprite: t.sprite || ally.sprite, maxLF: Math.max(1, ally.maxLF - t.lfAdd),
      lf: Math.min(ally.lf, Math.max(1, ally.maxLF - t.lfAdd)), treeant: null };
  }

  return { rules: R, data: D, profile, observe, canCommune, pickQuestion, questionFor, scoreAnswer, makeAlly, corpseObject, promoteToTreeant, revertTreeant };
});
