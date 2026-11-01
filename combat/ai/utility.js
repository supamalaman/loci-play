"use strict";
// Goal-driven utility AI with a small online learner (Mala, 2026-10-08): enemies should be "working toward
// defeating me" and, when that isn't easily available, fight wild-faction monsters or build toward their
// ultimate to open their dream or summon. Not a neural net; a gradient-flavoured linear learner:
//
//   1. FEATURES  read the board from this NPC's point of view (harm to the hero, its own health, charge...).
//   2. UTILITY   score each candidate action by the predicted change in features, weighted by goals.
//      Goal arbitration: if no candidate can hurt the player's side, the weights shift to the fallbacks.
//   3. LEARN     after the action resolves, compare predicted vs observed progress:
//                - reliability per action kind (efficacy detection: "my attacks aren't landing");
//                - weights nudged toward features that actually moved the goal (w += lr · error · Δf), clamped.
//   4. RETHINK   when an action kind's reliability falls under the threshold, emit a strategy event (speech already maps it).
//
//   createMind(actor, { posture, personality, seed })
//   choose(mind, snap, candidates) → { choice, scored, mode }     candidates: [{ id, kind, predicted: snapshot-after }]
//   learn(mind, before, after, chosen) → { mind, events }
//   exportMemory(mind) / importMemory(mind, memory)              per-enemy-character learning that persists across battles
//   phaseFor(mind, snap) → { phase, why }                         posture phases (Mala, 2026-10-08):
//     explorer  "survey" (ignores you entirely) until it understands the terrain completely (snap.terrain[id] ≥ 1), then "hunt"
//     preparer  "prepare" (learns all it can) while the hero is farther than its range (default 4), then "engage"
//
// snap = { units: [{ id, side, lf, maxLF, defeated, ultimateCharge, hero?, posScore? }], wild: [{ id, lf, maxLF, defeated }],
//          objectives: [{ id, side, progress }], knowledge: { [actorId]: n }, fields: [{ type, owner }],
//          terrain: { [actorId]: 0..1 how completely it understands the map }, units may carry x, y for ranges }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatUtilityAI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const FEATURES = ["heroHarm", "foeHarm", "kills", "wildHarm", "selfHealth", "allyHealth", "ultCharge", "objective", "knowledge", "position", "dreamOpen"];

  // Posture presets (the observable NPC posture trait). Weights on the CHANGE in each feature.
  const postures = {
    aggressive: { heroHarm: 3.0, foeHarm: 2.0, kills: 4, wildHarm: 0.8, selfHealth: 0.8, allyHealth: 0.4, ultCharge: 0.6, objective: 0.3, knowledge: 0.2, position: 0.4, dreamOpen: 1.0 },
    defensive:  { heroHarm: 1.8, foeHarm: 1.2, kills: 3, wildHarm: 0.8, selfHealth: 2.2, allyHealth: 1.5, ultCharge: 0.8, objective: 0.5, knowledge: 0.4, position: 1.6, dreamOpen: 1.0 },
    explorer:   { heroHarm: 1.5, foeHarm: 1.0, kills: 3, wildHarm: 0.6, selfHealth: 1.2, allyHealth: 0.6, ultCharge: 0.6, objective: 2.6, knowledge: 0.8, position: 0.6, dreamOpen: 1.0 },
    preparer:   { heroHarm: 2.0, foeHarm: 1.4, kills: 3, wildHarm: 0.6, selfHealth: 1.4, allyHealth: 0.8, ultCharge: 1.4, objective: 0.8, knowledge: 1.6, position: 1.2, dreamOpen: 1.6 },
  };
  // How the goals shift when the player can't be hurt right now ("if that isn't easily available").
  const fallback = { wildHarm: 2.5, ultCharge: 2.2, objective: 1.6, position: 1.3, knowledge: 1.3, dreamOpen: 2.0 };

  // Phases: what each posture ignores until its condition is met, and what it chases meanwhile.
  const phases = {
    survey:  { ignore: ["heroHarm", "foeHarm", "kills"], boost: { objective: 2.0, knowledge: 2.5, position: 1.5 }, text: "surveying the ground; you don't matter to it yet" },
    hunt:    { boost: { heroHarm: 1.4, kills: 1.2, objective: 0.4 }, text: "it knows the ground now, and comes for you" },
    prepare: { ignore: ["heroHarm", "foeHarm", "kills"], boost: { knowledge: 2.5, ultCharge: 1.6, position: 1.3, dreamOpen: 1.3 }, text: "learning all it can while you're far away" },
    engage:  { boost: { heroHarm: 1.5, knowledge: 0.3 }, text: "you came within range; it stops studying and acts on what it learned" },
  };
  const rules = { prepRange: 4, terrainUnderstood: 1, learningRate: 0.08, weightClamp: [0.3, 3], reliabilityAlpha: 0.3, rethinkBelow: 0.6, triesBeforeRethink: 2, temperature: 0.05, harmEpsilon: 0.005 };

  function roll(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const live = (u) => u && !u.defeated && (u.lf ?? 1) > 0;
  const frac = (u) => (u.maxLF ? Math.max(0, u.lf) / u.maxLF : 1);

  function features(snap, actorId) {
    const me = snap.units.find((u) => u.id === actorId) || {};
    const foes = snap.units.filter((u) => u.side !== me.side && u.side !== "wild");
    const allies = snap.units.filter((u) => u.side === me.side && u.id !== actorId);
    const hero = foes.find((u) => u.hero) || foes[0];
    const harm = (list) => (list.length ? list.reduce((n, u) => n + (1 - frac(u)), 0) / list.length : 0);
    return {
      heroHarm: hero ? 1 - frac(hero) : 0,
      foeHarm: harm(foes),
      kills: foes.filter((u) => !live(u)).length,
      wildHarm: harm(snap.wild || []),
      selfHealth: frac(me),
      allyHealth: allies.length ? allies.reduce((n, u) => n + frac(u), 0) / allies.length : 1,
      ultCharge: (me.ultimateCharge ?? 0) / 100,
      objective: (() => { const mine = (snap.objectives || []).filter((o) => o.side === me.side); return mine.length ? mine.reduce((n, o) => n + (o.progress || 0), 0) / mine.length : 0; })(),
      knowledge: Math.min(1, (snap.knowledge?.[actorId] || 0) / 12),
      position: Math.max(0, Math.min(1, me.posScore ?? 0)),
      dreamOpen: (snap.fields || []).some((f) => f.type === "dreamSpace" && f.owner === actorId) ? 1 : 0,
    };
  }
  const delta = (a, b) => Object.fromEntries(FEATURES.map((k) => [k, (b[k] ?? 0) - (a[k] ?? 0)]));
  const dot = (w, d) => FEATURES.reduce((n, k) => n + (w[k] ?? 0) * (d[k] ?? 0), 0);
  // "Progress" the NPC actually cares about: harm to the player's side, kills, and not dying.
  const progress = (d) => 3 * d.heroHarm + 2 * d.foeHarm + 4 * d.kills - 1 * Math.max(0, -d.selfHealth)
    + 1.5 * Math.max(0, d.ultCharge || 0) + 1 * Math.max(0, d.knowledge || 0) + 0.5 * Math.max(0, d.position || 0) + 1 * Math.max(0, d.allyHealth || 0);

  // Trait audit (Mala backlog): how personality traits modulate motivation. Multipliers
  // stack across traits; temperature adds are summed and floored. Only traits with a
  // clear motivational read are mapped; the rest motivate nothing.
  const traitMotives = {
    // Strengthened and extended 2026-10-15 from Muse's TRAIT_MOTIVES.md (Part 3); live in engine/ai.js motiveTerm.
    fearful: { selfHealth: 2.0, kills: 0.7, temperatureAdd: 0.05 }, skittish: { selfHealth: 1.5, temperatureAdd: 0.05 },
    guarded: { selfHealth: 1.3 },
    // The Tamer's state traits (engine/tamer.js stateTraits): unmarked he fears death; marked he believes he cannot die.
    fearOfDeath: { selfHealth: 2.2, heroHarm: 0.6, kills: 0.6 }, immortalDelusion: { selfHealth: 0.3, heroHarm: 1.5, kills: 1.5 }, lonely: { allyHealth: 1.4 }, proud: { kills: 1.3 },
    animalLover: { wildHarm: 0.2, allyHealth: 1.3 }, animalHater: { wildHarm: 1.8 }, petFighting: { wildHarm: 1.5, kills: 1.3 },
    agreeable: { heroHarm: 0.6, kills: 0.6 }, persuasive: { heroHarm: 0.7, kills: 0.7 }, talkative: { heroHarm: 0.8 }, annoying: { heroHarm: 0.8 },
    thrifty: { ultCharge: 1.2 }, dreamer: { knowledge: 1.2 }, collector: { objective: 1.4 }, craftsmansMindset: { objective: 1.3, knowledge: 1.2 },
    ceaselessAdaptation: { knowledge: 1.4 }, perfectMemory: { knowledge: 1.4 }, telepathy: { knowledge: 1.3 }, drunkenMonkey: { selfHealth: 0.8 },
    courageous: { selfHealth: 0.6 }, loyal: { allyHealth: 1.8 }, steward: { allyHealth: 1.8 }, protective: { allyHealth: 1.8 },
    empathic: { allyHealth: 1.5 }, collaborative: { allyHealth: 1.5 },
    competitive: { heroHarm: 1.4, kills: 1.2 }, vengeful: { heroHarm: 1.4, kills: 1.2 }, rivalrous: { heroHarm: 1.4, kills: 1.2 }, reckless: { heroHarm: 1.3, kills: 1.3, selfHealth: 0.6 },
    curious: { knowledge: 2.0 }, scout: { knowledge: 1.5, position: 1.3 },
    contemplative: { knowledge: 1.4, temperatureAdd: -0.03 },
    greedy: { objective: 1.5 }, ambitious: { ultCharge: 1.5, objective: 1.3 },
    honorable: { objective: 1.4 }, dutiful: { objective: 1.4 },
    pacifist: { heroHarm: 0.3, foeHarm: 0.3, kills: 0.2 }, merciful: { heroHarm: 0.5, kills: 0.5 },
    impatient: { temperatureAdd: 0.1 }, restless: { temperatureAdd: 0.1 }, gambler: { temperatureAdd: 0.15 },
  };
  function personalityFor(traits) {
    const weightMul = {};
    let temperatureAdd = 0;
    for (const t of traits || []) {
      const m = traitMotives[typeof t === "string" ? t : t?.id];
      if (!m) continue;
      for (const [k, v] of Object.entries(m)) {
        if (k === "temperatureAdd") temperatureAdd += v;
        else weightMul[k] = (weightMul[k] ?? 1) * v;
      }
    }
    return { weightMul, temperatureAdd };
  }
  function createMind(actor, { posture = "aggressive", personality = {}, seed = 0 } = {}) {
    const base = postures[posture] || postures.aggressive;
    const mul = personality.weightMul || {};
    const based = Object.fromEntries(FEATURES.map((k) => [k, base[k] * (mul[k] ?? 1)]));
    return { id: actor.id, posture, base: based, weights: { ...based }, reliability: {}, tries: {}, seed, round: 0,
      triesBeforeRethink: personality.triesBeforeRethink ?? rules.triesBeforeRethink,
      temperature: Math.max(0.01, (personality.temperature ?? rules.temperature) + (personality.temperatureAdd || 0)),
      ...(personality.prepRange != null ? { prepRange: personality.prepRange } : {}) };
  }

  function heroDistance(snap, actorId) {
    const me = snap.units.find((u) => u.id === actorId);
    const hero = snap.units.find((u) => u.hero && live(u)) || snap.units.find((u) => u.side !== me?.side && u.side !== "wild" && live(u));
    if (snap.heroDistance?.[actorId] != null) return snap.heroDistance[actorId];
    if (!me || !hero || me.x == null || hero.x == null) return Infinity;
    return Math.abs(me.x - hero.x) + Math.abs(me.y - hero.y);
  }
  function phaseFor(mind, snap) {
    if (mind.posture === "explorer") {
      const known = snap.terrain?.[mind.id] ?? 0;
      return known >= rules.terrainUnderstood ? { phase: "hunt", why: "terrain fully understood" } : { phase: "survey", why: `terrain ${Math.round(known * 100)}% understood` };
    }
    if (mind.posture === "preparer") {
      const d = heroDistance(snap, mind.id), range = mind.prepRange ?? rules.prepRange;
      return d <= range ? { phase: "engage", why: `the hero is ${d} away (range ${range})` } : { phase: "prepare", why: `the hero is ${d === Infinity ? "out of sight" : d + " away"} (range ${range})` };
    }
    return { phase: null };
  }

  function choose(mind, snap, candidates) {
    if (!candidates.length) return { choice: null, scored: [], mode: "idle" };
    const now = features(snap, mind.id);
    const deltas = candidates.map((c) => delta(now, features(c.predicted, mind.id)));
    const { phase, why } = phaseFor(mind, snap), P = phases[phase];
    // Goal arbitration: can anything we do this turn hurt the player's side? (A surveying or preparing NPC doesn't ask.)
    const canHurt = deltas.some((d) => d.heroHarm > rules.harmEpsilon || d.foeHarm > rules.harmEpsilon || d.kills > 0);
    const mode = P?.ignore ? phase : canHurt ? "pursue" : "fallback";
    const w = { ...mind.weights };
    if (P) { for (const k of P.ignore || []) w[k] = 0; for (const [k, m] of Object.entries(P.boost || {})) w[k] = (w[k] ?? 0) * m; }
    if (mode === "fallback") for (const [k, m] of Object.entries(fallback)) w[k] = (w[k] ?? 0) * m;
    const scored = candidates.map((c, i) => {
      const rel = mind.reliability[c.kind] ?? 1;
      const u = dot(w, deltas[i]) * (deltas[i].heroHarm > 0 || deltas[i].foeHarm > 0 ? rel : 1);
      const noise = (roll(mind.seed, `${mind.round}:${c.id}`) - 0.5) * mind.temperature;   // seeded personality jitter
      return { ...c, delta: deltas[i], utility: u + noise };
    }).sort((a, b) => b.utility - a.utility || (a.id < b.id ? -1 : 1));
    return { choice: scored[0], scored, mode, phase, why: P ? `${P.text} (${why})` : undefined };
  }

  // After resolution: efficacy (reliability per kind) and a bounded gradient step on the weights.
  function learn(mind, before, after, chosen) {
    const events = [];
    const observed = delta(features(before, mind.id), features(after, mind.id));
    const predicted = chosen.delta || observed;
    const m = { ...mind, weights: { ...mind.weights }, reliability: { ...mind.reliability }, tries: { ...mind.tries }, round: mind.round + 1 };
    const expectedHarm = progress(predicted), gotHarm = progress(observed);
    if (expectedHarm > 0.01) {
      const ratio = Math.max(0, Math.min(1.5, gotHarm / expectedHarm));
      const prev = m.reliability[chosen.kind] ?? 1;
      m.reliability[chosen.kind] = prev + rules.reliabilityAlpha * (ratio - prev);
      m.tries[chosen.kind] = ratio < rules.rethinkBelow ? (m.tries[chosen.kind] || 0) + 1 : 0;   // consecutive ineffective uses
      if (m.tries[chosen.kind] >= m.triesBeforeRethink) {
        events.push({ kind: "strategy", actor: mind.id, reason: "ineffective", key: chosen.kind, ratio: +m.reliability[chosen.kind].toFixed(2),
          text: `${mind.id} notices its ${chosen.kind} isn't working and changes approach.` });
        m.tries[chosen.kind] = 0;
      }
    }
    // gradient step: raise weights on features that moved when real progress happened, lower them when they moved without it
    const error = gotHarm - expectedHarm;
    const [lo, hi] = rules.weightClamp;
    for (const k of FEATURES) {
      if (!observed[k]) continue;
      const step = rules.learningRate * error * Math.sign(observed[k]);
      m.weights[k] = Math.max(m.base[k] * lo, Math.min(m.base[k] * hi, m.weights[k] + step));
    }
    // reliability recovers slowly for kinds not used (they get re-tested later)
    for (const k of Object.keys(m.reliability)) if (k !== chosen.kind) m.reliability[k] = Math.min(1, m.reliability[k] + 0.1);
    return { mind: m, events, observed };
  }

  // What an enemy character carries into the next battle against you (bounded; posture base unchanged).
  function exportMemory(mind) {
    return { weightsRatio: Object.fromEntries(FEATURES.map((k) => [k, +(mind.weights[k] / (mind.base[k] || 1)).toFixed(3)])), reliability: { ...mind.reliability } };
  }
  function importMemory(mind, mem) {
    if (!mem) return mind;
    const [lo, hi] = rules.weightClamp;
    const w = { ...mind.weights };
    for (const k of FEATURES) if (mem.weightsRatio?.[k]) w[k] = mind.base[k] * Math.max(lo, Math.min(hi, mem.weightsRatio[k]));
    return { ...mind, weights: w, reliability: { ...(mem.reliability || {}) } };
  }

  return { FEATURES, postures, phases, fallback, rules, traitMotives, personalityFor, features, createMind, choose, phaseFor, learn, exportMemory, importMemory };
});
