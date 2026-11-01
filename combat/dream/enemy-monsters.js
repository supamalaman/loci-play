"use strict";
// Rules for the classic monsters an enemy's Dream Space calls. One concept, one passive, one ability, one drawback.
// Pure functions over actor records; data in enemy-dreams-data.js. Sunlight comes from climate.js (weather + microclimate).
//
//   makeMonster(key, { at, summoner, side, round })  → actor
//   sunlit(x, y, { weather, micro })                 → bool  (sun in the sky and the tile not in shade)
//   hit(m, { amount, channel, effect, field }, ctx)  → { m, amount, healed, notes }   passives + drawbacks on incoming damage
//   drain(vampire, target)                           → amount (diffusion: only down the health gradient)
//   startOfTurn(m, ctx) / endOfTurn(m, ctx)          → { m, events }   werewolf form, regen, fire panic; sun burns the vampire
//   startOfRound(m, ctx)                             → { m, events }   the skeleton reassembles
//   canEndAt(m, tile, ctx)                           → { ok, why }      shade-only, haunt, fire-shy, plus the zombie has no sides
//   targetFor(m, units)                              → unit id          mindless zombie: the nearest, any side
//   resists(m, status)                               → bool
//   infectionTick(unit) / heal(unit, n)              → infection from Infectious Bite
//   released(m, { fullyObserved })                   → bool  a fully understood ghost departs
//   abilityId(m)                                     → the content.js ability id of its one named attack (`mon_<id>`)
//   infectNote(unit, lfBefore) / stripOne(unit)      → infection cured by a heal (LF higher than at the last mark); Strip Bare
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./enemy-dreams-data.js"));
  else root.ConceptCombatEnemyMonsters = factory(root.ConceptCombatEnemyDreams);
})(typeof self !== "undefined" ? self : this, function (ED) {
  const D = ED.monsters, dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  function makeMonster(key, { at = [0, 0], summoner = null, side = "enemy", round = 0 } = {}) {
    const d = D[key];
    return { id: `dream-${key}`, kind: "dreamMonster", monster: key, name: d.name, side, summoner, concept: d.concept,
      lf: d.lf, maxLF: d.lf, move: d.move, x: at[0], y: at[1], origin: at.slice(), appeared: round,
      passive: d.passive.id, ability: d.ability.id, drawback: d.drawback.id, status: {}, form: key === "werewolf" ? "wolf" : null, reassembled: false };
  }

  const sunlit = (x, y, { weather, micro } = {}) => !!(weather?.sun && !micro?.at(x, y)?.shade);

  function hit(m, { amount, channel, effect = "", field = false }, ctx = {}) {
    const notes = []; let a = amount, healed = 0, next = { ...m };
    if (m.passive === "incorporeal" && !field && (channel === "nigredo" || channel === "albedo")) return { m, amount: 0, healed: 0, notes: ["It passes straight through the ghost."] };
    if (m.passive === "galvanized" && channel === "rubedo") {
      healed = Math.min(10, a, m.maxLF - m.lf);
      return { m: { ...m, lf: m.lf + healed }, amount: 0, healed, notes: [`Galvanized: the current feeds it (+${healed}).`] };
    }
    if (m.drawback === "brittle" && channel === "nigredo") { a *= 2; notes.push("Brittle: impact ×2."); }
    const fire = String(effect).split("+").some((e) => e.startsWith("ignite") || e === "fire");
    if (m.drawback === "tinderDry" && fire) { a *= 3; next.status = { ...next.status, burning: 6 }; notes.push("Tinder-dry: fire ×3, and it catches."); }
    let lf = m.lf - a;
    if (lf <= 0 && m.passive === "immortal" && !sunlit(m.x, m.y, ctx)) { lf = 1; notes.push("Immortal: out of the sun, it can't be finished."); }
    next.lf = Math.max(0, lf);
    if (next.lf === 0) {
      next.defeated = true;
      if (m.passive === "reassemble") next.scattered = m.drawback === "brittle" && channel === "nigredo";
    }
    return { m: next, amount: a, healed, notes };
  }

  // Diffusion: flux runs down the gradient. Healthier target → more; a weaker one gives nothing.
  function drain(v, target) {
    const A = D.vampire.ability, grad = target.lf / target.maxLF - v.lf / v.maxLF;
    return Math.max(0, Math.min(A.cap, Math.round(grad * A.gradient), target.lf));
  }

  function startOfTurn(m, ctx = {}) {
    const events = []; let next = { ...m };
    if (m.drawback === "moonBound") {
      const covered = !ctx.weather?.sun;
      if (!covered && m.form === "wolf") { next = { ...next, form: "human", lf: Math.min(next.lf, D.werewolf.humanLF), fleeing: true }; events.push({ kind: "monster", actor: m.id, text: "Under clear sun the wolf falls away: a frightened human runs for the edge." }); }
      else if (covered && m.form === "human") { next = { ...next, form: "wolf", fleeing: false }; events.push({ kind: "monster", actor: m.id, text: "The sky closes over and the wolf comes back." }); }
      if (next.form === "wolf") { const g = Math.min(6, next.maxLF - next.lf); next.lf += g; if (g) events.push({ kind: "monster", actor: m.id, text: `Feral Regeneration +${g}.` }); }
    }
    if (m.drawback === "fearOfFire" && (ctx.fires || []).some(([x, y]) => Math.abs(x - m.x) + Math.abs(y - m.y) <= 2)) {
      next.mustRetreat = true; events.push({ kind: "monster", actor: m.id, text: "Fire! It spends the turn backing away." });
    } else next.mustRetreat = false;
    if (m.status?.burning && ctx.micro?.at(m.x, m.y)?.wet) {   // Tinder-dry: "until it's dead or wet"
      next.status = { ...next.status }; delete next.status.burning; events.push({ kind: "monster", actor: m.id, text: "The linen is wet: the fire goes out." });
    } else if (m.status?.burning) { next.lf = Math.max(0, next.lf - m.status.burning); events.push({ kind: "monster", actor: m.id, text: `Burning: −${m.status.burning}.` }); if (!next.lf) next.defeated = true; }
    return { m: next, events };
  }

  function endOfTurn(m, ctx = {}) {
    if (m.drawback === "sunWeakness" && sunlit(m.x, m.y, ctx))
      return { m: { ...m, lf: 0, defeated: true, dust: true }, events: [{ kind: "monster", actor: m.id, text: "Caught in the sun, the vampire burns to dust." }] };
    return { m, events: [] };
  }

  function startOfRound(m) {
    if (m.passive !== "reassemble" || !m.defeated || m.scattered || m.reassembled) return { m, events: [] };
    return { m: { ...m, defeated: false, lf: Math.ceil(m.maxLF / 2), reassembled: true },
      events: [{ kind: "monster", actor: m.id, text: "The bones pull back together (once). Impact would have scattered them." }] };
  }

  // Where may it end its move? The drawbacks shape its pathing.
  function canEndAt(m, [x, y], ctx = {}) {
    if (m.drawback === "sunWeakness" && sunlit(x, y, ctx)) return { ok: false, why: "sunlit" };
    if (m.drawback === "boundToHaunt" && Math.abs(x - m.origin[0]) + Math.abs(y - m.origin[1]) > D.ghost.drawback.haunt) return { ok: false, why: "outside its haunt" };
    if (m.drawback === "fearOfFire" && (ctx.fires || []).some(([fx, fy]) => Math.abs(fx - x) + Math.abs(fy - y) <= 1)) return { ok: false, why: "next to fire" };
    return { ok: true };
  }

  function targetFor(m, units) {
    const alive = units.filter((u) => u.lf > 0 && u.id !== m.id && u.id !== m.summoner);
    const pool = m.drawback === "mindless" ? alive : alive.filter((u) => u.side !== m.side);   // mindless: no sides
    return pool.sort((a, b) => dist(m, a) - dist(m, b) || a.id.localeCompare(b.id))[0]?.id ?? null;
  }

  const RESIST = { preserved: ["displace", "stun", "fear"], relentless: ["taunt", "fear", "standDown", "talk"] };
  const resists = (m, status) => (RESIST[m.passive] || []).includes(status);

  const infect = (unit) => ({ ...unit, infectLF: unit.lf, status: { ...(unit.status || {}), infected: 3 } });
  function infectionTick(unit) {
    const n = unit.status?.infected; if (!n) return { unit, loss: 0 };
    const status = { ...unit.status }; if (n > 1) status.infected = n - 1; else delete status.infected;
    const lf = Math.max(0, unit.lf - 3);
    return { unit: { ...unit, lf, infectLF: lf, status }, loss: 3 };
  }
  // "Any heal cures it": there is no single heal function, so a heal is read as Life Force above the lowest mark
  // seen since the bite. `infectLF` is that mark; call this with the LF before a hit lands, at turn edges, and after.
  function infectNote(unit, lfBefore = unit.lf) {
    if (!unit.status?.infected) return { unit, cured: false };
    if (lfBefore > (unit.infectLF ?? Infinity)) { const status = { ...unit.status }; delete status.infected; const u = { ...unit, status }; delete u.infectLF; return { unit: u, cured: true }; }
    return { unit: { ...unit, infectLF: Math.min(unit.infectLF ?? Infinity, unit.lf) }, cured: false };
  }
  // Strip Bare: one defensive status (guard, ward or brace) is pruned. Returns the status key removed, or null.
  const STRIPPABLE = ["guard", "ward", "immovable", "anchor"];
  const stripOne = (unit) => STRIPPABLE.find((k) => unit.status?.[k]) || null;
  const abilityId = (m) => `mon_${m.ability}`;
  function heal(unit, n) { const status = { ...(unit.status || {}) }; delete status.infected; const u = { ...unit, lf: Math.min(unit.maxLF, unit.lf + n), status }; delete u.infectLF; return u; }

  const released = (m, { fullyObserved = false } = {}) => m.drawback === "boundToHaunt" && fullyObserved;

  return { makeMonster, sunlit, hit, drain, startOfTurn, endOfTurn, startOfRound, canEndAt, targetFor, resists, infect, infectionTick, infectNote, stripOne, abilityId, heal, released, data: ED };
});
