"use strict";
// Enemy Proficient Summoner. Independent rules; the engine supplies geometry,
// resource spending, actor registration and logging through its existing host.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./emergent-ideas.js"), require("./content.js"));
  else root.ConceptCombatEnemySummons = factory(root.ConceptCombatEmergentIdeas, root.ConceptCombatContent);
})(typeof self !== "undefined" ? self : this, function (EI, C) {
  const alive = a => !!a && !a.defeated && !a.notArrived && a.lf > 0;
  const rulesFor = s => s.rules.enemySummons || C.rules.enemySummons; // pre-integration saved battles
  // A Proficient Summoner (Imagination + Full Believer), or a carrier of a summoner trait (rules.enemySummons.traits: the
  // wizard's Arcane Mastery), calls the non-palace NPC summons: the dream monsters of its pool (the Vampire, Frankenstein's
  // Monster, ...). Only the Proficient Summoner gets the half-price calls and the second slot (its emergent idea).
  const traitSummoner = a => (C.rules.enemySummons?.traits || []).some(t => (a?.traits || []).some(x => (typeof x === "string" ? x : x?.id) === t));
  function qualifies(a) {
    return a?.side === "enemy" && !a.summon && !a.summonBinding && !a.monster && a.lf > 0 && !a.defeated &&
      (!!EI?.active(a).some(i => i.id === "proficientSummoner") || traitSummoner(a));
  }
  function profile(s, a) {
    const r = rulesFor(s);
    return { ...EI.summonProfile(a, { apCost: r.apCost, phiCost: r.phiCost }),
      turns: r.turns, active: Object.values(s.actors).filter(u => EI.summonerOf(u) === a.id && EI.summonPresent(u)).map(u => u.id) };
  }
  function group(a, H) {
    const ds = H.dreamSpaceRules, data = ds?.enemyMonsters?.data;
    if (!ds?.enemyMonsterPool) return {};
    const assigned = a.summonGroup;
    // An explicit unknown/empty group means no summons, never a fallback pool.
    if (assigned != null && !Array.isArray(assigned) &&
      (typeof assigned !== "string" || !Object.hasOwn(data?.pools || {}, assigned))) return {};
    return ds.enemyMonsterPool(3, assigned ?? a.character);
  }
  function openTile(s, a, at, H) {
    if (!Array.isArray(at) || at.length !== 2 || !at.every(Number.isInteger)) return false;
    const [x, y] = at, r = rulesFor(s);
    if (!H.inside(s, x, y)) return false;
    const d = H.dist(s, a.x, a.y, x, y), barrier = H.barrierAt(s, x, y);
    return d >= r.minRange && d <= r.maxRange && H.dreamSame(s, a.x, a.y, x, y) &&
      !H.actorAt(s, x, y) && !(s.wild || []).some(u => u.form === "unit" && !u.defeated && u.x === x && u.y === y) &&
      !H.tileAt(s, x, y).blocksMove && (!barrier || barrier.passable) &&
      !(s.arena.objects || []).some(o => o.blocksMove && o.hp !== 0 && o.x === x && o.y === y);
  }
  function readiness(s, a, H) {
    if (!qualifies(a)) return { ok: false, reason: "Enemy group calls need equipped Imagination and Full Believer on one living caller." };
    if (!H.dreamSpaceRules?.makeEnemyDreamActor) return { ok: false, reason: "Enemy dream summoning is unavailable." };
    const p = profile(s, a), used = new Set(a.enemySummonUsed || []);
    if (p.active.length >= p.maxActive) return { ok: false, reason: `All ${p.maxActive} summon slots are occupied.` };
    if (a.tempo < p.apCost) return { ok: false, reason: `Calling a creature needs ${p.apCost} action points.` };
    if (a.pf < p.phiCost) return { ok: false, reason: `Calling a creature needs ${p.phiCost} ΦF.` };
    const available = Object.keys(group(a, H)).filter(k => !used.has(k));
    if (!available.length) return { ok: false, reason: "No unused creature remains in this caller's summon group." };
    return { ok: true, ...p, available };
  }
  function candidate(s, a, H) {
    const p = readiness(s, a, H);
    if (!p.ok) return null;
    const salt = `${s.seed}:${s.round}:${a.id}:${(a.enemySummonUsed || []).length}`;
    const kinds = p.available.slice().sort((x,y) => H.seededChance(`${salt}:group:${x}`) - H.seededChance(`${salt}:group:${y}`) || x.localeCompare(y));
    const tiles = [];
    for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) if (openTile(s, a, [x,y], H)) tiles.push([x,y]);
    tiles.sort((x,y) => H.seededChance(`${salt}:tile:${x}`) - H.seededChance(`${salt}:tile:${y}`) || x[1]-y[1] || x[0]-y[0]);
    return tiles.length ? { type: "monsterSummon", actor: a.id, dreamKinds: [kinds[0]], tiles: [tiles[0]] } : null;
  }
  function call(s, a, act, H) {
    const p = readiness(s, a, H);
    if (!p.ok) return p.reason;
    if (!Array.isArray(act.dreamKinds) || act.dreamKinds.length !== 1 || !Array.isArray(act.tiles) || act.tiles.length !== 1)
      return "Call one group creature per action; the second call is a separate action.";
    const kind = act.dreamKinds[0], at = act.tiles[0];
    if (!p.available.includes(kind)) return "That creature is outside this summon group or has already been called by this owner.";
    if (!openTile(s, a, at, H)) return "Choose an open tile 2–4 spaces away, inside the caller's Dream Space region.";
    const raw = H.dreamSpaceRules.makeEnemyDreamActor(kind, { at, round: s.round, summoner: a.id,
      id: `dream-${kind}-group-${a.id}-${(a.enemySummonUsed || []).length + 1}` });
    const spend = H.spendTempo(s, a, p.apCost, `Call ${raw.name}`);
    if (spend) return spend;
    a.pf -= p.phiCost;
    (a.enemySummonUsed ||= []).push(kind);
    a.beliefSummonUsed = true; // losing the idea cannot unlock a second legacy call
    const actor = { ...raw, side: a.side, sprite: `dream-${kind}`, ai: "dream", controller: "ai", traits: [],
      pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, level: 1, xp: 0, proficiency: 1,
      reserve: [], reserveSlots: 0, pendingSwap: null, lens: {}, reaction: s.rules.reactionsPerRound,
      moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0,
      tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false, ownerTurns: 0, lastRecoverTurn: -99,
      status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null },
      inventory: [], inventoryCapacity: 0, passives: {}, lanyardUsed: false, bristleconeUsed: false,
      beliefSummonUsed: false, defeated: false,
      summonBinding: { owner: a.id, groupKey: kind, turnsLeft: p.turns, lastTickTurn: -1, expired: false } };
    s.actors[actor.id] = actor;
    s.disclosures[actor.id] = {}; s.knowledge[actor.id] = {}; s.observedAbilities[actor.id] = [];
    if (H.insightRules) {
      const deck = H.insightRules.buildDeck({ key: kind, kind: "dream" }, { seed: s.seed });
      s.insight.decks[actor.id] = deck; s.insight.knowledge[actor.id] = H.insightRules.spawnKnowledge(deck);
    }
    for (const other of Object.values(s.actors)) if (other.id !== actor.id && other.side !== actor.side) {
      (s.knowledge[other.id] ||= {})[actor.id] = { secondary: false, lens: false, abilities: {} };
      s.knowledge[actor.id][other.id] = { secondary: false, lens: false, abilities: {} };
    }
    s.order.push(actor.id);
    EI.refreshSummonWard(s, actor);
    H.log(s, { kind: "dreamAppear", actor: actor.id, target: a.id, tiles: [at], emergentIdea: "proficientSummoner",
      text: `${a.name} calls ${actor.name} from their summon group: ${p.apCost} AP, ${p.phiCost} ΦF, ${p.turns} turns and a fresh ${p.wardProtection}-point ward.`,
      why: ["Imagination + Full Believer: two owned summon slots; each group member once per caller per battle.",
        "Fights for the caller's side, retaining its monster rules and drawbacks, including the zombie's mindless targeting."] });
  }
  function afterOwnTurn(s, a, H) {
    const b = a.summonBinding;
    if (!b || !alive(a) || b.expired || b.lastTickTurn === a.ownerTurns) return;
    b.lastTickTurn = a.ownerTurns;
    b.turnsLeft = Math.max(0, b.turnsLeft - 1);
    if (b.turnsLeft) return;
    b.expired = true; a.defeated = true; a.lf = 0; a.status.ward = null;
    a.scattered = true; a.reassembled = true; // a departed skeleton must not resurrect
    H.log(s, { kind: "summon", actor: a.id, target: b.owner, text: b.solo ? `${a.name}'s summoned stay ends; it leaves the field.` : `${a.name}'s group summon ends; it leaves the field.` });
  }
  return { qualifies, profile, group, openTile, readiness, candidate, call, afterOwnTurn };
});
