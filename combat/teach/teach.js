"use strict";
// Teach mode (Mala, 2026-10-11): while it is on, the others on the field (enemies, allies, summons) sometimes stop to say or ask something as their turn starts.
// Two kinds of small cutscene:
//   Wisdom   a unit speaks a quote from Mala's Readwise library (teach/wisdom-data.js), in one of four voices.
//   Inquiry  a unit asks a question. The bank is the Landscape Lexicon (which term fits this definition?) and the
//            botany questions; a lexicon term that has a teaching strip shows it with the answer, so the strips are
//            part of the cycle and those terms are asked more often.
// This module only decides WHAT to show and scores answers. It changes nothing in a battle: no rewards, no state in
// the engine. Choices are drawn from the battle seed, the round and the speaker, so a replay shows the same cards.
//
//   rules                                   cadence numbers (Claude's, PROVISIONAL)
//   due({ seed, round, actorId, last })     → bool    is a card shown as this unit's turn starts?
//   next({ seed, round, actor, seen })      → card | null
//   wisdomCard / inquiryCard                the two builders, exported for tests
//   answer(card, index)                     → { correct, right, explain }
//   intro(voice, name)                      → the line that leads into a quote
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./wisdom-data.js"), require("../landscape-catalog.js"), require("../terrain/communion-data.js"), require("./concept-questions.js"));
  else root.ConceptCombatTeach = factory(root.ConceptCombatWisdom, root.LandscapeConceptCatalog, root.ConceptCombatCommunionData, root.ConceptCombatConceptQuestions);
})(typeof self !== "undefined" ? self : this, function (Wisdom, Lexicon, CommunionData, ConceptQs) {
  const rules = {
    chance: 0.2,            // per speaking unit's turn start (allies speak too, so a little lower than when only enemies did), once the gap below has passed
    minRoundsBetween: 3,    // at least this many rounds from one card to the next (at 2, a three-enemy battle showed one almost every other round)
    firstRound: 2,          // nothing in the opening round
    inquiryShare: 0.4,      // of the cards shown, this share are questions
    choices: 3,
    illustratedWeight: 4,   // a lexicon term with a teaching strip is this many times as likely to be asked
    art: ["borrowed-scenery", "compression-and-release", "desire-line", "edge-effect", "negative-space-ma", "mystery", "parterre", "succession"],   // parterre: strip from Muse's Parterre cut (2026-10-26)
  };
  const INTRO = {
    poetic:       ["{name} waxes poetic:", "{name} lowers their guard a moment and recites:", "{name}, half to themselves:"],
    motivational: ["{name} calls across the field:", "{name}, between breaths:", "{name} squares up and says:"],
    history:      ["{name} regales you with history:", "{name} recalls:", "{name}, as if lecturing:"],
    reflection:   ["{name} muses:", "{name} offers a thought:", "{name} says, unprompted:"],
  };
  const ASK = ["{name} asks, mid-swing:", "{name} demands an answer:", "{name} tests you:", "{name} wants to know:"];

  // The same small hash the random-event table uses: a seed and a tag give a number in [0, 1).
  function hash(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const pick = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];
  const fill = (line, name) => line.replace("{name}", name);
  const intro = (voice, name, r = 0) => fill(pick(INTRO[voice] || INTRO.reflection, r), name);

  function due({ seed, round, actorId, last = null }) {
    if (round < rules.firstRound) return false;
    if (last != null && round - last < rules.minRoundsBetween) return false;
    return hash(seed, `teach:due:${round}:${actorId}`) < rules.chance;
  }

  const quotes = () => Wisdom?.quotes || [];
  function wisdomCard({ seed, round, actor, seen = [] }) {
    const pool = quotes().map((q, i) => ({ q, i })).filter(({ i }) => !seen.includes(`w:${i}`)); if (!pool.length) return null;
    const { q, i } = pick(pool, hash(seed, `teach:wisdom:${round}:${actor.id}`));
    return { kind: "wisdom", id: `w:${i}`, voice: q.voice, speaker: actor.id, speakerName: actor.name, sprite: actor.sprite || null,
      lead: intro(q.voice, actor.name, hash(seed, `teach:intro:${round}:${actor.id}`)), text: q.text, author: q.author, source: q.title || "" };
  }

  // The question bank. Lexicon: the definition is the prompt and the term is the answer, with distractors from the
  // same register so they are plausible. Botany: the communion questions as written.
  let bankCache = null;
  function bank() {
    if (bankCache) return bankCache;
    const out = [], terms = (Lexicon?.concepts || []).filter((t) => t.term && t.shortDefinition && t.shortDefinition.length >= 30);
    for (const t of terms) out.push({ id: `lex:${t.slug}`, source: "lexicon", term: t, weight: rules.art.includes(t.slug) ? rules.illustratedWeight : 1 });
    for (const q of CommunionData?.questions || []) if (!q.for) out.push({ id: `bot:${q.id}`, source: "botany", q, weight: 1 });
    for (const q of ConceptQs?.questions || []) out.push({ id: `con:${q.id}`, source: "concepts", q, weight: 1 });
    return (bankCache = out);
  }
  // A definition often names its own term; blank it so the question is not answered by reading it.
  const mask = (definition, term) => { const core = term.replace(/\s*\(.*\)\s*/g, "").trim(); return core.length < 3 ? definition : definition.replace(new RegExp(core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "____"); };
  function inquiryCard({ seed, round, actor, seen = [] }) {
    const pool = bank().filter((b) => !seen.includes(b.id)); if (!pool.length) return null;
    const total = pool.reduce((n, b) => n + b.weight, 0); let at = hash(seed, `teach:inquiry:${round}:${actor.id}`) * total, item = pool[pool.length - 1];
    for (const b of pool) if ((at -= b.weight) < 0) { item = b; break; }
    const lead = fill(pick(ASK, hash(seed, `teach:ask:${round}:${actor.id}`)), actor.name);
    const base = { kind: "inquiry", id: item.id, speaker: actor.id, speakerName: actor.name, sprite: actor.sprite || null, lead };
    if (item.source === "botany") return { ...base, topic: "Botany", prompt: item.q.prompt, choices: item.q.choices.slice(), answer: item.q.answer, explain: item.q.explain || "" };
    if (item.source === "concepts") return { ...base, topic: item.q.topic || "Concepts", prompt: item.q.prompt, choices: item.q.choices.slice(), answer: item.q.answer, explain: item.q.explain || "" };
    const t = item.term, all = Lexicon.concepts.filter((o) => o.slug !== t.slug && o.term);
    const near = all.filter((o) => o.register === t.register), far = all.filter((o) => o.register !== t.register);
    const order = (list) => list.slice().sort((a, b) => hash(seed, `teach:d:${round}:${actor.id}:${a.slug}`) - hash(seed, `teach:d:${round}:${actor.id}:${b.slug}`));
    const wrong = [...order(near), ...order(far)].slice(0, rules.choices - 1).map((o) => o.term);
    const slot = Math.floor(hash(seed, `teach:slot:${round}:${actor.id}`) * rules.choices), choices = wrong.slice(); choices.splice(slot, 0, t.term);
    return { ...base, topic: "Landscape Lexicon", prompt: `Which term fits? “${mask(t.shortDefinition, t.term)}”`, choices, answer: slot,
      explain: `${t.term}: ${t.shortDefinition}`, art: rules.art.includes(t.slug) ? `combat/lexicon/${t.slug}.webp` : null };
  }

  function next({ seed, round, actor, seen = [] }) {
    const wantInquiry = hash(seed, `teach:kind:${round}:${actor.id}`) < rules.inquiryShare;
    return (wantInquiry ? inquiryCard : wisdomCard)({ seed, round, actor, seen }) || (wantInquiry ? wisdomCard : inquiryCard)({ seed, round, actor, seen });
  }
  const answer = (card, index) => ({ correct: card.kind === "inquiry" && index === card.answer, right: card.choices?.[card.answer] ?? null, explain: card.explain || "" });

  return { rules, hash, intro, due, wisdomCard, inquiryCard, next, answer, bank, INTRO, ASK };
});
