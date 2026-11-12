"use strict";
// Dream monster rules. Pure functions over an engine snapshot.
//
//   checkAppear(snap)            → null | { monster, config, at, reason }   (run once per round, end of round)
//   makeDreamActor(key, { at, configIndex })  → wild-side actor for the engine (fights with its config's concepts)
//   wakeQuestion(key, seed)      → { prompt, choices (seed-shuffled), answer }
//   nameIt(actor, choiceText)    → { actor, correct, event }   correct: fades at round end; wrong: fear feeds it
//   endOfRound(actor, round)     → { actor, fades, reason }
//   damageMul(attacker, target, objects)  orgonite field ×1.25 when OG.dreamDamageMul says so; live Guardian ×1.25 is unused by hit()
//
// snap = { seed, round, mode, arena (terrain-module shape), units: [{ id, side, x, y, lf, maxLF, defeated, status }],
//          heroId, wild: [ ... ], recent: { bridgeCollapse, heroFell, heroStaggered, announcements, tells,
//          plantsDestroyed, flood, cisternBurst } }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dream-data.js"), (() => { try { return require("../orgonite/orgonite.js"); } catch { return null; } })());
  else root.ConceptCombatDream = factory(root.ConceptCombatDreamData, root.ConceptCombatOrgonite);
})(typeof self !== "undefined" ? self : this, function (DD, OG) {
  const R = DD.rules;
  function roll(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const live = (u) => u && !u.defeated && (u.lf ?? 1) > 0;

  // Board facts each trigger reads.
  function facts(snap) {
    const map = snap.arena?.map || [], height = snap.arena?.height || [], objects = snap.arena?.objects || [];
    const chars = map.join("");
    let ledge = false;
    for (let y = 0; y < height.length && !ledge; y++) for (let x = 0; x < (height[y] || "").length; x++) {
      const h = +height[y][x];
      if ((x + 1 < height[y].length && Math.abs(h - +height[y][x + 1]) >= 2) || (y + 1 < height.length && Math.abs(h - +height[y + 1][x]) >= 2)) { ledge = true; break; }
    }
    const hero = snap.units.find((u) => u.id === (snap.heroId || "player"));
    const hostilesNearHero = hero ? snap.units.filter((u) => live(u) && u.side !== hero.side && man(u, hero) <= 2).length : 0;
    return {
      ledgeOrBridge: ledge || (snap.arena?.structures || []).some((s) => !s.collapsed),
      hostilesNearHero,
      hedges: objects.filter((o) => o.form === "hedge" || o.form === "shrub").length,
      water: (chars.match(/[w~]/g) || []).length,
      pillars: (chars.match(/#/g) || []).length + objects.filter((o) => o.blocksMove && o.material === "stone").length,
    };
  }

  function triggered(key, rule, snap, f) {
    const R2 = snap.recent || {};
    if (rule.fromRound && snap.round < rule.fromRound) return false;
    switch (rule.when) {
      case "bridgeCollapse": return !!R2.bridgeCollapse;
      case "heroFellOrStaggered": return (R2.heroFell || R2.heroStaggered) && f.ledgeOrBridge;
      case "heroPursued": return f.hostilesNearHero >= rule.atLeast;
      case "plantsDestroyed": return (R2.plantsDestroyed || 0) >= rule.atLeast;
      case "manyFlowers": return f.hedges >= rule.hedgesAtLeast;
      case "announcementOrTell": return (R2.announcements || 0) + (R2.tells || 0) > 0;
      case "floodOrBurst": return !!(R2.flood || R2.cisternBurst);
      case "wetMap": return f.water >= rule.waterTilesAtLeast;
      case "enclosedLongFight": return rule.modes.includes(snap.mode) && f.pillars >= rule.pillarsAtLeast;
    }
    return false;
  }

  function spawnTile(snap) {
    const hero = snap.units.find((u) => u.id === (snap.heroId || "player"));
    const map = snap.arena.map, occupied = new Set(snap.units.filter(live).map((u) => `${u.x},${u.y}`));
    let best = null;
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[0].length; x++) {
      if (/[#~T]/.test(map[y][x]) || occupied.has(`${x},${y}`)) continue;
      if ((snap.arena.objects || []).some((o) => o.x === x && o.y === y && o.blocksMove)) continue;
      if (OG && OG.inField(snap.arena.objects, x, y)) continue;
      const d = hero ? Math.abs(hero.x - x) + Math.abs(hero.y - y) : 0;
      if (d < 3) continue;                                         // it surfaces at the edge of attention, not on top of you
      const score = -Math.abs(d - 4) + roll(snap.seed, `tile:${x},${y}`) * 0.5;
      if (!best || score > best.score) best = { score, at: [x, y] };
    }
    return best && best.at;
  }

  function checkAppear(snap) {
    if (snap.round < R.noAppearBeforeRound) return null;
    if ((snap.wild || []).filter((m) => m.dream).length >= R.maxActive) return null;
    const f = facts(snap);
    // Every dream whose condition holds rolls its own chance; if several succeed, a seeded pick decides,
    // so no dream wins just by being earlier in the list.
    const hits = [];
    for (const [key, m] of Object.entries(DD.monsters)) {
      if ((snap.wild || []).some((w) => w.dream?.key === key)) continue;
      const rule = m.appear.find((r) => triggered(key, r, snap, f) && roll(snap.seed, `${snap.round}:${key}:${r.when}`) < r.chance);
      if (rule) hits.push({ key, m, rule });
    }
    if (!hits.length) return null;
    const { key, m, rule } = hits[Math.floor(roll(snap.seed, `${snap.round}:pick`) * hits.length)];
    const at = spawnTile(snap); if (!at) return null;
    const configIndex = Math.floor(roll(snap.seed, `${snap.round}:${key}:config`) * m.configs.length);
    return { monster: key, config: m.configs[configIndex].id, configIndex, at, reason: rule.when, candidates: hits.map((h) => h.key),
      event: { kind: "dreamAppear", monster: key, at, text: `${m.name} surfaces from a dream.` } };
  }

  function makeDreamActor(key, { at, configIndex = 0, round = 0 } = {}) {
    const m = DD.monsters[key], c = m.configs[configIndex];
    return {
      id: `dream-${key}`, name: m.name, side: R.side, controller: "ai", character: key,
      dream: { key, config: c.id, born: round, named: false, potencyMul: 1, nameRetryRound: 0 },
      primary: c.primary, secondary: c.secondary, maxLF: R.lf, lf: R.lf, x: at[0], y: at[1],
    };
  }

  function wakeQuestion(key, seed = 0) {
    const w = DD.monsters[key].wake;
    const order = w.choices.map((c, i) => ({ c, i, r: roll(seed, `${key}:wake:${i}`) })).sort((a, b) => a.r - b.r);
    return { prompt: w.question, choices: order.map((o) => o.c), answer: order.findIndex((o) => o.i === w.answer), teaches: DD.monsters[key].teaches };
  }

  // The player spends an action naming the dream. Answers are compared as text, so shuffling can't break scoring.
  function nameIt(actor, choiceText, round = 0, ctx = {}) {
    const m = DD.monsters[actor.dream.key];
    if (actor.dream.named) return { actor, correct: true, event: null, reason: "Already named." };
    if (round < actor.dream.nameRetryRound) return { actor, correct: false, event: null, reason: `You can try naming it again in round ${actor.dream.nameRetryRound}.` };
    const correct = choiceText === m.wake.choices[m.wake.answer];
    if (correct) return { actor: { ...actor, dream: { ...actor.dream, named: true } }, correct,
      event: { kind: "dreamNamed", actor: actor.id, correct: true, text: `You name ${m.name}: "${m.teaches}" It begins to fade.` } };
    const W = R.nameIt.wrong;
    const blocked = !!ctx.namer?.passives?.dreamNameFearBlocked;
    const potencyMul = blocked ? actor.dream.potencyMul : actor.dream.potencyMul * W.potencyMul;
    return { actor: { ...actor, dream: { ...actor.dream, potencyMul, nameRetryRound: round + W.retryAfterRounds } }, correct,
      event: { kind: "dreamNamed", actor: actor.id, correct: false, text: `That isn't it. ${m.name} holds on.` } };
  }

  function endOfRound(actor, round) {
    if (actor.dream.named) return { actor, fades: true, reason: "named", event: { kind: "dreamFade", actor: actor.id, reason: "named", text: `${actor.name} fades: you woke from it.` } };
    if (round - actor.dream.born >= R.dawnRounds) return { actor, fades: true, reason: "dawn", event: { kind: "dreamFade", actor: actor.id, reason: "dawn", text: `Dawn: ${actor.name} fades.` } };
    if (actor.lf <= R.dissolveAt * actor.maxLF) return { actor, fades: true, reason: "dissolved", event: { kind: "dreamFade", actor: actor.id, reason: "dissolved", text: `${actor.name} comes apart.` } };
    return { actor, fades: false };
  }

  function damageMul(attacker, target, objects) {
    let m = 1;
    if (target?.dream) {
      if (OG && OG.dreamDamageMul) m *= OG.dreamDamageMul(attacker, target, objects);
      else if (attacker?.summon?.key === "perimeter_guardian") m *= R.perimeterGuardianDamageMul;
    }
    if (attacker?.dream) { const pm = attacker.dream.potencyMul || 1; m *= attacker.dream.potencyCap ? Math.min(attacker.dream.potencyCap, pm) : pm; }
    if (attacker?.dream && OG && OG.charmDamageMul) m *= OG.charmDamageMul(target);
    return m;
  }

  return { checkAppear, makeDreamActor, wakeQuestion, nameIt, endOfRound, damageMul, spawnTile, facts, data: DD };
});
