"use strict";
// Enemies observing the player + trauma resolution. Pure and seeded.
//
//   visibleTraits(self)                          → what any observer could ever find (apparent, unresolved)
//   enemyObserve({ self, know, observer, invest, seed })  → { know, revealed, lines }   (lines respect Johari: a blind spot is
//                                                  "they noticed something about you"; a known trait is named)
//   enemyActionsFor({ know, self })              → exploits they can use now (chance halved + telegraphed if you know the trait)
//   resolveEnemyAction(traitId, { self, seed, round })  → { landed, effects, telegraph, text }
//   shouldObserve(observer, { round, knownCount, rethinking, traits }) → { observe, invest }
//   traumaStatus(self)                           → { unknown, known, resolved }
//   checkTrauma(self, event)                     → [{ trait, reward }]   event from the engine (see TRIGGERS below)
//   resolveTrauma(self, traitId)                 → { self, reward }      catharsis + the permanent strength
//
// TRIGGERS (engine events): { kind: "dream", monster, via: "holdGaze"|"nameItCorrect"|"defeat" },
//   { kind: "survivedFall", drop }, { kind: "resistedExploit", trait }, { kind: "battleEnd", won, mode, correctAnswers,
//   lfLostByRound2, carriedItems, enemies, channelsUsed }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./mirror-data.js"));
  else root.ConceptCombatMirror = factory(root.ConceptCombatMirrorData);
})(typeof self !== "undefined" ? self : this, function (MD) {
  function roll(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const isTrauma = (t) => t.kind === "fear" && !!MD.traumas[t.id];

  function visibleTraits(self) { return self.traits.filter((t) => t.apparent && !t.resolved); }

  // Enemy looks at you. Difficulty = depth (1–3), +1 for a tell you know about yourself (you hide it better).
  function enemyObserve({ self, know = { revealed: [], progress: 0 }, observer, invest, seed = 0 }) {
    const O = MD.rules.observe;
    const ap = Math.max(O.minAP, Math.min(O.maxAP, invest));
    let points = Math.floor(ap / O.apPerPoint) + know.progress;
    const hidden = visibleTraits(self).filter((t) => !know.revealed.includes(t.id))
      .map((t) => ({ t, d: t.depth + (t.known && t.kind === "tell" ? 1 : 0), r: roll(seed, `${observer.id}:${t.id}`) }))
      .sort((a, b) => a.d - b.d || a.r - b.r);
    const revealed = [];
    for (const { t, d } of hidden) { if (points < d) break; points -= d; revealed.push(t); }
    const k2 = { revealed: [...know.revealed, ...revealed.map((t) => t.id)], progress: Math.min(O.carryCap, hidden.length > revealed.length ? points : 0) };
    const name = observer.name || observer.id;
    const lines = [`${name} studies you.`];
    for (const t of revealed) lines.push(t.known ? `${name} has noticed you're ${t.name}.` : `${name} noticed something about you that you haven't.`);
    return { know: k2, revealed, lines, ap };
  }

  function enemyActionsFor({ know, self }) {
    return know.revealed.map((id) => self.traits.find((t) => t.id === id)).filter((t) => t && !t.resolved && MD.exploits[t.id]?.chance > 0)
      .map((t) => {
        const X = MD.exploits[t.id], known = !!t.known;
        return { trait: t.id, ...X, chance: Math.round(X.chance * (known ? MD.rules.knownByPlayer.chanceMul : 1) * 100) / 100, telegraph: known };
      });
  }

  function resolveEnemyAction(traitId, { self, seed = 0, round = 0 }) {
    const t = self.traits.find((x) => x.id === traitId);
    if (!t || t.resolved) return { landed: false, effects: [], telegraph: false, text: "That doesn't work on you any more." };
    const immune = resolvedPassives(self).some((p) => (p.immuneTo || []).includes(traitId));
    if (immune) return { landed: false, effects: [], telegraph: true, text: "It doesn't reach you any more." };
    const X = MD.exploits[traitId], known = !!t.known;
    const chance = X.chance * (known ? MD.rules.knownByPlayer.chanceMul : 1);
    const landed = roll(seed, `${traitId}:${round}`) < chance;
    return { landed, effects: landed ? [{ kind: "playerExploit", trait: traitId, ...X.effect }] : [], telegraph: known,
      text: known ? `${X.name}: ${landed ? X.text : "you saw it coming."}` : (landed ? `Something they did got to you. (${X.name})` : "They try something, and it misses.") };
  }

  // Should this enemy spend AP studying you this turn? (AI guidance; deterministic given its context.)
  function shouldObserve(observer, { round = 1, knownCount = 0, rethinking = false, traits = [] } = {}) {
    const bias = traits.reduce((n, t) => n + (MD.observerBias[t] || 0), 0);
    const want = (round <= 2 && knownCount < 2 ? 0.5 : 0.1) + (rethinking ? 0.4 : 0) + bias;
    const observe = roll(observer.seed ?? 0, `${observer.id}:${round}:observe`) < want;
    return { observe, invest: observe ? (bias > 0.2 ? 30 : 20) : 0 };
  }

  // ── trauma ────────────────────────────────────────────────────────────────
  function traumaStatus(self) {
    const all = self.traits.filter(isTrauma);
    return { unknown: all.filter((t) => !t.known && !t.resolved).map((t) => t.id), known: all.filter((t) => t.known && !t.resolved).map((t) => t.id), resolved: all.filter((t) => t.resolved).map((t) => t.id) };
  }
  function resolvedPassives(self) { return self.traits.filter((t) => t.resolved).map((t) => MD.traumas[t.id]?.becomes.passive || {}); }

  function matches(tr, ev) {
    if (ev.kind === "dream") return tr.dream && ev.monster === tr.dream && MD.dreamResolves.includes(ev.via);
    const o = tr.or;
    switch (o.event) {
      case "survivedFall": return ev.kind === "survivedFall" && ev.drop >= o.minDrop;
      case "resistedExploit": return ev.kind === "resistedExploit" && ev.trait === o.trait;
      case "correctAnswersInBattle": return ev.kind === "battleEnd" && (ev.correctAnswers || 0) >= o.atLeast;
      case "wonAfterEarlyLoss": return ev.kind === "battleEnd" && ev.won && (ev.lfLostByRound2 || 0) >= o.lfLost;
      case "wonMode": return ev.kind === "battleEnd" && ev.won && ev.mode === o.mode;
      case "wonWithNoItems": return ev.kind === "battleEnd" && ev.won && (ev.carriedItems || 0) === 0;
      case "wonOutnumbered": return ev.kind === "battleEnd" && ev.won && (ev.enemies || 0) >= o.enemies;
      case "usedChannelsInBattle": return ev.kind === "battleEnd" && (ev.channelsUsed || 0) >= o.atLeast;
    }
    return false;
  }

  // Only KNOWN, unresolved traumas can be resolved: you have to see it before you can work through it.
  function checkTrauma(self, ev) {
    return self.traits.filter((t) => isTrauma(t) && t.known && !t.resolved && matches(MD.traumas[t.id], ev))
      .map((t) => ({ trait: t.id, reward: reward(t.id) }));
  }
  function reward(id) {
    const b = MD.traumas[id].becomes;
    return { now: MD.catharsis, permanent: { strength: b.id, name: b.name, passive: b.passive, text: b.text } };
  }
  function resolveTrauma(self, id) {
    const t = self.traits.find((x) => x.id === id);
    if (!t || !isTrauma(t)) return { self, error: "Not a trauma." };
    if (!t.known) return { self, error: "You have to know it before you can work through it." };
    if (t.resolved) return { self, error: "Already resolved." };
    const b = MD.traumas[id].becomes;
    const s2 = { ...self, traits: self.traits.map((x) => (x.id === id ? { ...x, resolved: true, becomes: b.id } : x)) };
    return { self: s2, reward: reward(id), lines: [`You work through it. ${t.name} becomes ${b.name}: ${b.text}`, "Catharsis: full ultimate charge, +25 LF, ×1.3 potency and +20 AP for 2 turns."] };
  }

  return { visibleTraits, enemyObserve, enemyActionsFor, resolveEnemyAction, shouldObserve, traumaStatus, checkTrauma, resolveTrauma, resolvedPassives, data: MD };
});
