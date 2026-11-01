"use strict";
// Dream Space (Mala, 2026-10-08): a field condition, like a domain expansion. It strengthens the one who
// opens it, but it thins the wall between waking and dreaming, so dream monsters come through far more easily.
//
//   canOpen(caster, rules)                  → { ok, reason }            needs a FULL ultimate bar
//   open(caster, { round })                 → { caster, field, event }  the bar is now the space's clock
//   casterTurnStart(caster, field)          → { caster, field|null, events, summonLinger }   drains the bar; empty = it closes
//   close(field, reason)                    → { events, fades, summonLinger }                 (also used to end it early)
//   modsFor(actor, field)                   → stat modifiers for the caster while the space holds
//   summonCost(field) / summonTurnTicks(field) / onCloseSummon(actor)                         summons inside the space
//   endOfRound(field, snapshot, { seed })   → { field|null, appear|null, fades: [ids], events }
//
// The ultimate bar is the clock (Mala, 2026-10-08): opening needs a full bar; it drains 25 at the start of each
// of the caster's turns and gains nothing while the space is open, so a space lasts 4 of your turns. The caster
// can't fire their own ultimate or order a summon's while the bar is the clock.
// Summons come from Dream Space itself: inside it they cost half, and their turns don't run down while it holds.
// When it closes they linger 1 more turn, then return. The clock is what keeps that from being overpowered.
//
// Inside the space:
//   - the caster: ×1.2 potency, +2 ΦF regen, +10 AP each turn, and +1 insight point when observing dreams;
//   - dream monsters: a 50% chance EVERY round, whatever the board conditions, up to 2 at once, surfacing
//     2–4 tiles from the caster; they attack everyone, the caster included, unless befriended (Hold its gaze);
//   - when the space closes, every dream it called fades with it (you wake up).
// Trepanation (the hole in the skull; a trait, not a rule of the space) changes the tables for its carrier only:
//   - waking (no Dream Space, or outside the diamond, or in a Set-the-Scene pocket duel, where the space is stashed): ×0.8 potency, −10 AP each turn;
//   - inside an occupied space: ×1.4 potency, +15 AP, +3 ΦF regen, +1 insight point (the engine reads it only for a trepanned body);
//   - as the opener: each stat is the max of the plain caster table and the inside table, never the product; the
//     opening bar needs 25 less, and the space's monster chance is 0.65 of the normal rate (see open/compress).
// Opening cost (Mala approved, 2026-10-08): knowing the place and yourself makes a dream easier to open and hold.
//   bar needed = max(50, 100 − 25 × placeFamiliarity − 25 × selfKnowledge)   (both 0..1)
//   drain per caster turn = 25 − 10 × placeFamiliarity
// Enemies dream too: an enemy's Dream Space calls monsters from ITS pool (enemy-dreams-data.js), not the player's.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dream.js"), require("./enemy-dreams-data.js"), require("./enemy-monsters.js"), require("./psyche.js"));
  else root.ConceptCombatDreamSpace = factory(root.ConceptCombatDream, root.ConceptCombatEnemyDreams, root.ConceptCombatEnemyMonsters, root.ConceptCombatDreamPsyche);
})(typeof self !== "undefined" ? self : this, function (DM, ED, EM, PS) {
  const rules = {
    cost: "fullUltimateCharge", apCost: 50, drainPerCasterTurn: 25, chargeFrozen: true,
    summons: { apCost: 40, phiCost: 4, durationFrozen: true, lingerOnClose: 1, damageTakenMul: 0.8 },   // half the outside cost (80 AP since 2026-10-10)
    casterMods: { potencyMul: 1.2, pfRegenAdd: 2, apPerTurnAdd: 10, dreamObservePointBonus: 1 },
    appearChance: 0.5, maxDreams: 2, surfaceRange: [2, 4],
    collapseIfCasterBelow: 0.25,           // at or below 25% LF, every enemy hit that gets through makes the dreamer roll concentration
  };
  function roll(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  const clamp01 = (n) => Math.max(0, Math.min(1, n || 0));
  function openCost({ placeFamiliarity = 0, selfKnowledge = 0 } = {}, max = 100, trepanned = false) {
    const p = clamp01(placeFamiliarity), k = clamp01(selfKnowledge);
    return { required: Math.max(max / 2, Math.round(max - 25 * p - 25 * k - (trepanned ? 25 : 0))), drain: Math.round(25 - 10 * p) };
  }

  // knowledge = { placeFamiliarity, selfKnowledge }; omitted, it costs a full bar (as before).
  function canOpen(caster, engineRules = { ultimateChargeMax: 100 }, field = null, knowledge = {}) {
    if (field && field.type === "dreamSpace") return { ok: false, reason: "A Dream Space is already open." };
    const { required } = openCost(knowledge, engineRules.ultimateChargeMax, hasHole(caster));
    if ((caster.ultimateCharge ?? 0) < required) return { ok: false, reason: required >= engineRules.ultimateChargeMax ? "Opening a Dream Space takes a full ultimate charge." : `Opening a Dream Space here takes ${required}% charge.`, required };
    return { ok: true, required };
  }

  // pool: "player" (default) or an enemy dream pool id from enemy-dreams-data.js.
  function open(caster, { round = 0, placeFamiliarity = 0, selfKnowledge = 0, pool = "player" } = {}) {
    const { drain } = openCost({ placeFamiliarity, selfKnowledge });
    const field = { type: "dreamSpace", owner: caster.id, opened: round, called: [], summons: [], drain, pool,
      ...(hasHole(caster) ? { appearChance: 0.65 } : {}) };
    return { caster, field,
      event: { kind: "fieldOpen", field: "dreamSpace", actor: caster.id, text: `${caster.name || caster.id} opens a Dream Space: the edges of the field go soft. Stronger here, and your summons come easier, but other things are coming through. Your ultimate bar is now its clock.` } };
  }

  // Focused dreams use one fixed diamond on the existing battlefield.
  const contains = (field, x, y) => !field?.region || Math.abs(x - field.region.x) + Math.abs(y - field.region.y) <= field.region.radius;
  const sameRegion = (field, x, y, tx, ty) => !field?.region || contains(field, x, y) === contains(field, tx, ty);
  function focus(field, caster, radius, arena) {
    if (!field || field.owner !== caster.id) return { error: "Only the dreamer can compress this Dream Space." };
    if (![2, 3].includes(radius)) return { error: "Choose a dream radius of 2 or 3 tiles." };
    if (field.imbued) return { error: "Compress before imbuing the dream." };
    if (field.region && radius >= field.region.radius) return { error: "A focused dream can only shrink further." };
    // Further compression preserves the original centre; the caster must remain inside.
    const region = { x: field.region?.x ?? caster.x, y: field.region?.y ?? caster.y, radius };
    const next = { ...field, region, concentration: radius === 2 ? 1.5 : 1.25 };
    if (!contains(next, caster.x, caster.y)) return { error: "Move closer to the dream's centre before shrinking it." };
    let tiles = 0;
    for (let y=0; y<arena.map.length; y++) for (let x=0; x<arena.map[y].length; x++) if (contains(next,x,y) && !/[#~T]/.test(arena.map[y][x])) tiles++;
    const base = field.appearBase ?? field.appearChance ?? rules.appearChance;   // TP-01: the opener's base is invariant — further compression scales from it, never from an already-reduced chance
    next.appearBase = base;
    next.appearChance = base * tiles / Math.max(1, arena.map.reduce((n,row)=>n+[...row].filter(c=>!/[#~T]/.test(c)).length,0));
    return { field: next };
  }

  function close(field, reason = "the clock ran out") {
    const events = [{ kind: "fieldClose", field: "dreamSpace", actor: field.owner, reason, text: `The Dream Space closes (${reason}). You wake.` }];
    for (const id of field.called) events.push({ kind: "dreamFade", actor: id, reason: "woke", text: "A dream fades as the space closes." });
    return { events, fades: field.called.slice(), summonLinger: rules.summons.lingerOnClose };
  }

  // Start of each of the caster's turns: drain the bar; when it's empty the space closes.
  function casterTurnStart(caster, field) {
    if (!field || field.type !== "dreamSpace" || field.owner !== caster.id) return { caster, field, events: [] };
    const charge = Math.max(0, (caster.ultimateCharge ?? 0) - (field.drain ?? rules.drainPerCasterTurn));
    const c2 = { ...caster, ultimateCharge: charge };
    if (charge > 0) return { caster: c2, field, events: [{ kind: "fieldClock", actor: caster.id, charge, text: `The Dream Space holds (${charge}% left).` }] };
    const cl = close(field);
    return { caster: c2, field: null, events: cl.events, fades: cl.fades, summonLinger: cl.summonLinger };
  }
  const isDreamerSide = (actor, field) => !!field && field.type === "dreamSpace"
    && (field.owner === actor.id || actor.summon?.owner === field.owner);
  const chargeGainAllowed = (actor, field) => !(isDreamerSide(actor, field) && rules.chargeFrozen);
  // The owner may spend a full bar on a technique while inside the dream. The seal holds through
  // its response window; the engine closes it after resolution. Summon orders are a separate action.
  const canFinishUltimate = (actor, field, engineRules = { ultimateChargeMax: 100 }) => !!field && field.type === "dreamSpace"
    && field.owner === actor.id && contains(field, actor.x, actor.y) && !field.imbued && !field.ultimateCommit
    && (actor.ultimateCharge ?? 0) >= engineRules.ultimateChargeMax;
  const ultimatesBlocked = (actor, field, engineRules) => isDreamerSide(actor, field) && !canFinishUltimate(actor, field, engineRules);

  // Summons inside the space: cheaper, and their turns don't run down; when it closes they linger briefly.
  function summonCost(field, base = { apCost: 80, phiCost: 8 }) {   // matches summons-data.js rules.actionCost
    return field && field.type === "dreamSpace" ? { apCost: rules.summons.apCost, phiCost: rules.summons.phiCost } : base;
  }
  const summonTurnTicks = (field) => !(field && field.type === "dreamSpace" && rules.summons.durationFrozen);
  function onCloseSummon(actor) {
    if (!actor?.summon) return actor;
    if (actor.summon.maxForm) return actor;   // MAX outlives the dream: its doubled turns are never linger-clamped
    return { ...actor, summon: { ...actor.summon, turnsLeft: Math.min(actor.summon.turnsLeft, rules.summons.lingerOnClose) } };
  }

  // Trepanation (grok SPEC, Mala locked 2026-10-28): a hole in the skull. Waking (no field, or outside
  // the diamond) runs the waking table; inside any occupied Dream Space runs the inside table, maxed per stat
  // with the owner's own mods when the trepanned unit is the opener — never the product.
  const hasHole = (actor) => (actor?.traits || []).some((t) => ((t && t.id) || t) === "trepanation");
  const WAKING = { potencyMul: 0.8, apPerTurnAdd: -10, pfRegenAdd: 0, dreamObservePointBonus: 0 };
  const INSIDE = { potencyMul: 1.4, apPerTurnAdd: 15, pfRegenAdd: 3, dreamObservePointBonus: 1 };
  function modsFor(actor, field) {
    if (!field || field.type !== "dreamSpace") return hasHole(actor) ? { ...WAKING } : {};
    if (!contains(field, actor.x, actor.y)) return hasHole(actor) ? { ...WAKING } : {};
    if (hasHole(actor)) {
      if (actor.id !== field.owner) return { ...INSIDE };
      const c = field.concentration || 1;
      const ownerPot = 1 + (rules.casterMods.potencyMul - 1) * c, ownerPf = Math.round(rules.casterMods.pfRegenAdd * c), ownerAp = Math.round(rules.casterMods.apPerTurnAdd * c);
      return { potencyMul: Math.max(ownerPot, INSIDE.potencyMul), pfRegenAdd: Math.max(ownerPf, INSIDE.pfRegenAdd),
        apPerTurnAdd: Math.max(ownerAp, INSIDE.apPerTurnAdd), dreamObservePointBonus: Math.max(rules.casterMods.dreamObservePointBonus, INSIDE.dreamObservePointBonus) };
    }
    if (actor.id === field.owner) {
      const c = field.concentration || 1;
      return { ...rules.casterMods, potencyMul: 1 + (rules.casterMods.potencyMul - 1) * c,
        pfRegenAdd: Math.round(rules.casterMods.pfRegenAdd * c), apPerTurnAdd: Math.round(rules.casterMods.apPerTurnAdd * c) };
    }
    if (actor.summon?.owner === field.owner) return { damageTakenMul: rules.summons.damageTakenMul };
    return {};
  }

  function surfaceNear(snapshot, caster, seed, field = null) {
    const map = snapshot.arena.map, taken = new Set(snapshot.units.filter((u) => !u.defeated).map((u) => `${u.x},${u.y}`));
    const [lo, hi] = rules.surfaceRange; let best = null;
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[0].length; x++) {
      const d = Math.abs(x - caster.x) + Math.abs(y - caster.y);
      if (!contains(field, x, y) || d < (field?.region ? 1 : lo) || d > hi || taken.has(`${x},${y}`) || /[#~T]/.test(map[y][x])) continue;
      if ((snapshot.arena.objects || []).some((o) => o.x === x && o.y === y && o.blocksMove)) continue;
      const r = roll(seed, `ds:${x},${y}`);
      if (!best || r > best.r) best = { r, at: [x, y] };
    }
    return best && best.at;
  }

  function endOfRound(field, snapshot, { seed = 0 } = {}) {
    const events = [];
    if (!field || field.type !== "dreamSpace") return { field, appear: null, fades: [], events };
    const caster = snapshot.units.find((u) => u.id === field.owner);
    const gone = !caster || caster.defeated;
    if (gone) {
      const cl = close(field, "its dreamer fell");
      return { field: null, appear: null, fades: cl.fades, events: cl.events, summonLinger: cl.summonLinger };
    }
    // Focused dreams draw on their occupants' psyches (psyche.js); the global dream and enemy dreams are unchanged.
    const psychic = !!(PS && field.region && (!field.pool || field.pool === "player"));
    if (psychic) field = { ...field, psyche: PS.ensure(field, snapshot.units, seed, snapshot.psyche, contains) };
    const ids = psychic ? PS.occupants(field, snapshot.units, contains).map((u) => u.id) : [];
    const scale = psychic ? PS.appearScale(field, ids) : 1;
    const present = (snapshot.wild || []).filter((m) => m.dream && !m.defeated);
    if (present.length >= rules.maxDreams || roll(seed, `ds:${snapshot.round}:appear`) >= (field.appearChance ?? rules.appearChance) * scale) return { field, appear: null, fades: [], events };
    const pool = field.pool && field.pool !== "player" ? ED.poolFor(field.pool) : DM.data.monsters;   // enemies call their own dreams
    const options = Object.keys(pool).filter((k) => !present.some((m) => m.dream.key === k));
    if (!options.length) return { field, appear: null, fades: [], events };
    let key = null, source = null;
    if (psychic && ids.length) {
      source = PS.pick(field, ids, options, seed, `ds:${snapshot.round}:which`);
      if (!source) return { field, appear: null, fades: [], events };      // every pattern they hold is already out
      key = source.monster;
    } else key = options[Math.floor(roll(seed, `ds:${snapshot.round}:which`) * options.length)];
    const at = surfaceNear(snapshot, caster, `${seed}:${snapshot.round}`, field); if (!at) return { field, appear: null, fades: [], events };
    const configIndex = Math.floor(roll(seed, `ds:${snapshot.round}:config`) * pool[key].configs.length);
    const id = `dream-${key}`;
    const ownerName = source && (snapshot.units.find((u) => u.id === source.owner)?.name || source.owner);
    const text = source ? `${pool[key].name} rises from ${ownerName}'s ${PS.archetypes[source.archetype].name}.` : `${pool[key].name} comes through ${field.owner === "player" ? "the" : "an enemy's"} Dream Space.`;
    events.push({ kind: "dreamAppear", monster: key, actor: id, at, pool: field.pool || "player", text, ...(source ? { psyche: { owner: source.owner, archetype: source.archetype } } : {}) });
    return { field: { ...field, called: [...field.called, id] }, appear: { monster: key, configIndex, at, pool: field.pool || "player", ...(source ? { psyche: source } : {}) }, fades: [], events };
  }

  // A manifestation was faced (gaze held, named, or broken): its owner integrates a little. Pure; the engine logs it.
  function creditManifestation(field, actor, kind) {
    const owner = actor?.dream?.owner;
    if (!PS || !field?.psyche || !owner) return { field, event: null };
    const r = PS.credit(field, owner, kind);
    if (!r.gain) return { field, event: null };
    const arch = PS.archetypes[actor.dream.archetype]?.name || "pattern";
    return { field: r.field, event: { kind: "psyche", actor: owner, text: `${owner === field.owner ? "You" : owner} integrate${owner === field.owner ? "" : "s"} a little of the ${arch}: ${Math.round(r.before * 100)}% → ${Math.round(r.after * 100)}%.` }, gain: r.gain };
  }

  function randomEventWave(snapshot, { seed = 0, round = snapshot.round, index = 0 } = {}) {
    const caster = snapshot.units.find(u => u.id === "player" && !u.defeated) || snapshot.units.find(u => !u.defeated);
    if (!caster) return null;
    const keys = Object.keys(DM.data.monsters);
    if (!keys.length) return null;
    const key = keys[Math.floor(roll(seed, `rift:${round}:${index}:kind`) * keys.length)];
    const at = surfaceNear(snapshot, caster, `${seed}:rift:${round}:${index}`);
    if (!at) return null;
    const configIndex = Math.floor(roll(seed, `rift:${round}:${index}:config`) * DM.data.monsters[key].configs.length);
    const actor = DM.makeDreamActor(key, { at, configIndex, round });
    actor.id = `dream-event-${key}-${round}-${index + 1}`;
    actor.dream.source = "randomEvent";
    return { actor, at, text: `${actor.name} pours from the Dream Rift at (${at.join(",")}); it attacks every side.` };
  }

  function enemyMonsterPool(beliefStrength = 1, group = "classic") {
    const pool = Array.isArray(group) ? Object.fromEntries([...new Set(group)].filter(k => ED.monsters[k]?.status === "ready").map(k => [k, ED.monsters[k]])) : ED.poolFor(group);
    return Object.fromEntries(Object.entries(pool).filter(([, m]) => (m.beliefTier || 1) <= beliefStrength));
  }
  function makeEnemyDreamActor(key, { at, round = 0, summoner = null, id = null } = {}) {
    const def = ED.monsters[key];
    if (!def || !at) throw new Error(`Unknown enemy Dream Space creature: ${key}`);
    const model = EM.makeMonster(key, { at, summoner, side: "wild", round });
    return { ...model, id: id || model.id, character: key, primary: def.concept, secondary: null, learned: [EM.abilityId(model)],   // its one named attack (content.js mon_<id>)
      maxLF: def.lf, dream: { key, born: round, named: false, potencyMul: 1, nameRetryRound: 0, source: "belief", summoner } };
  }

  return { rules, contains, sameRegion, focus, openCost, canOpen, open, close, casterTurnStart, chargeGainAllowed, canFinishUltimate, ultimatesBlocked, modsFor, summonCost, summonTurnTicks, onCloseSummon,
    endOfRound, creditManifestation, psyche: PS, randomEventWave, enemyMonsterPool, makeEnemyDreamActor, enemyMonsters: EM, makeDreamActor: (key, opts) => DM.makeDreamActor(key, opts),
    checkAppear: (snap) => DM.checkAppear(snap) };
});
