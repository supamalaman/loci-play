"use strict";
// Sinkerfruit in battle (OP1, Lookout BD, 2026-10-27; spec ~/loci-orbit/ready-to-review/claude-onepiece/specs/SINKERFRUIT.md;
// Mala: "yes build sinkerfruit first, refuse the second fruit"). A fruit eaten out of battle (account/fruit.js) rides in
// on the hero as opts.fruit: its technique joins the hero's kit, and the curse rides with it. The sea refuses you: you
// can't swim, you drown ×1.5, and while you are damped (standing in water, Soaked by a technique that moves water, or
// cuffed/detained) the fruit's technique and passive go quiet, ΦF stops regenerating, and you take ×1.25 (Drained).
// Steel will (a Strike variant, +10 AP) carries will through Drift and Coil's give.
//
//   RULES                                  → every tunable (provisional; Mala tunes)
//   carryFruit(s, opts)                    → the hero gets fruitOf, the curse passives (no stacking past the larger)
//   fruitOf(a)                             → { id, ripe } or null
//   fruitKitOf(a)                          → technique ids the fruit adds to abilitiesOf (Hide's borrowed move too)
//   damped(s, a)                           → why the sea holds the power ("" when it doesn't)
//   fruitBlocked(s, a, abilityId)          → refusal text for a fruit technique while damped, else null
//   fruitRegen(s, a, regen)                → 0 while damped
//   fruitTakenMul(s, tgt, inst, type)      → { mul, notes } Drained ×1.25; Coil ×0.6 on impact unless it carries will
//   fruitDrift(s, a, tgt, inst)            → true when Mist's Drift turns a Strike aside (35%, seeded)
//   fruitRelease(s, a)                     → { potency } from stored coils, consumed by this Strike
//   fruitReach(a)                          → +1 Strike reach per stored coil
//   fruitSoak(s, inst)                     → Soaks every eater the water-moving technique reaches
//   fruitResolve(s, a, inst)               → resolves Wind the Spring, Take the Shape, Fog Bank
//   withHunter(opts, enc, arena)           → a posted head draws a hunter (moved here from engine.js for the line cap)
//   hunterEntrance(s)                      → the log line when the hunter walks in
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).fruit = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { C, log, dist, key, wildRules } = H;
    const RULES = {
      kits: { coil: ["windTheSpring"], hide: ["takeTheShape"], mist: ["fogBank"] },
      drowningMul: 1.5, drainedTakenMul: 1.25,
      coil: { impactTakenMul: 0.6, potencyPerCoil: 4, reachPerCoil: 1, maxCoils: 3 },
      mist: { driftMiss: 0.35, fogRadius: 1, fogRounds: 2 },
      hide: { tempShare: 0.25, tempCap: 25, turns: 3 },
      steelWillAP: 10,
    };
    const ab = (id) => C.abilities[id];
    const active = (x, a) => !!x && (x.until == null || x.until >= a.ownerTurns);
    const fruitOf = (a) => a?.fruit && RULES.kits[a.fruit.id] ? a.fruit : null;

    function carryFruit(s, opts) {
      const f = opts.fruit; if (!f || !RULES.kits[f.id]) return;
      const hero = s.actors[s.modeSetup?.hero || "player"]; if (!hero) return;
      hero.fruit = { id: f.id, ripe: !!f.ripe };
      // The curse. sinksLikeAStone (insight-data.js) already sinks a Super ×2.5: the larger multiplier wins, never both.
      hero.passives = { ...(hero.passives || {}), cantSwim: true, drowningDamageMul: Math.max(hero.passives?.drowningDamageMul || 1, RULES.drowningMul) };
    }
    function fruitKitOf(a) {
      const f = fruitOf(a); if (!f) return [];
      const shape = a.status?.hideShape && a.status.hideShape.expiresAt > a.ownerTurns ? a.status.hideShape.move : null;
      return [...RULES.kits[f.id], ...(shape && ab(shape) ? [shape] : [])];
    }
    function damped(s, a) {
      if (!fruitOf(a) || a.defeated) return "";
      if ((H.tileAt(s, a.x, a.y)?.tags || []).includes("water")) return "The sea takes it: you stand in water.";
      if (a.status?.soaked && a.status.soaked.expiresAt > a.ownerTurns) return "The sea takes it: you are soaked.";
      if (active(a.status?.cuffed, a) || active(a.status?.detained, a)) return "The sea takes it: tide-iron cuffs hold the power.";
      return "";
    }
    // A fruit technique, or Hidefruit's borrowed move, is refused while damped; Take the Shape is greyed with nothing learned.
    function fruitBlocked(s, a, id) {
      const f = fruitOf(a); if (!f) return null;
      const own = RULES.kits[f.id].includes(id) || (a.status?.hideShape?.move === id && a.status.hideShape.expiresAt > a.ownerTurns);
      if (!own) return null;
      const why = damped(s, a); if (why) return why;
      if (id === "takeTheShape" && !(a.beastSummons || []).length) return "You know no shape yet: learn a creature by swallowing its beads.";
      return null;
    }
    const fruitRegen = (s, a, regen) => (damped(s, a) ? 0 : regen);
    function fruitTakenMul(s, tgt, inst, type) {
      const f = fruitOf(tgt); if (!f) return null;
      let mul = 1; const notes = [];
      const why = damped(s, tgt);
      if (why) { mul *= RULES.drainedTakenMul; notes.push(`Drained: the sea pulls the strength out (damage ×${RULES.drainedTakenMul}).`); }
      else if (f.id === "coil" && type === "nigredo") {
        if (inst?.carriesWill) notes.push("Steel will: the blow lands through the coil's give.");
        else { mul *= RULES.coil.impactTakenMul; notes.push(`Coilfruit gives with the blow (impact ×${RULES.coil.impactTakenMul}).`); }
      }
      return { mul, notes };
    }
    function fruitDrift(s, a, tgt, inst) {
      if (inst?.carriesWill) return false;   // Steel will lands through Drift, owned or lent
      if (fruitOf(tgt)?.id === "mist" && !damped(s, tgt)) {
        s.driftN = (s.driftN || 0) + 1;
        return H.seededChance(`${s.seed}:${s.round}:${a.id}:${tgt.id}:drift:${s.driftN}`) < RULES.mist.driftMiss;
      }
      const gift = (s.barriers || []).some((b) => b.concept === "fog" && b.x === tgt.x && b.y === tgt.y &&   // §8: ripe mist lends Drift to allies standing in its fog
        s.actors?.[b.owner]?.side === tgt.side && fruitOf(s.actors[b.owner])?.id === "mist" && s.actors[b.owner].fruit.ripe && !damped(s, s.actors[b.owner]));
      if (!gift) return false;
      s.driftN = (s.driftN || 0) + 1;
      return H.seededChance(`${s.seed}:${s.round}:${a.id}:${tgt.id}:allydrift:${s.driftN}`) < RULES.mist.driftMiss;
    }
    function fruitRelease(s, a) {
      const n = a.status?.coils?.n || 0; if (!n || fruitOf(a)?.id !== "coil") return { potency: 0, n: 0 };
      a.status.coils = null;
      if (damped(s, a)) { log(s, { kind: "effect", actor: a.id, text: `The sea takes ${a.name}'s ${n} coil${n === 1 ? "" : "s"}: nothing to let go.`, why: ["Sinkerfruit: damped, the coil's give is gone."] }); return { potency: 0, n: 0 }; }
      return { potency: n * RULES.coil.potencyPerCoil, n };
    }
    const fruitReach = (a) => (fruitOf(a)?.id === "coil" ? (a.status?.coils?.n || 0) * RULES.coil.reachPerCoil : 0);
    function soak(s, t, by) {
      if (!fruitOf(t) || t.defeated) return;
      // expire() runs before regen at turn start: +2 keeps Soaked over the next turn it is meant to damp.
      t.status.soaked = { label: "Soaked", owner: t.id, expiresAt: t.ownerTurns + 2 };
      const lost = [t.status.coils?.n ? "the stored coils" : "", t.status.hideShape || t.status.ward?.hide ? "the borrowed shape and its hide" : ""].filter(Boolean);
      t.status.coils = null; t.status.hideShape = null; if (t.status.ward?.hide) t.status.ward = null;   // merge fix (Pantry): the hide ward goes with the shape   // the counters the techniques name: water takes the coil and ends the shape
      log(s, { kind: "effect", actor: t.id, target: t.id, text: `${t.name} is soaked by ${by}: the fruit's power goes quiet.`, why: ["Sinkerfruit: water damps the power for a turn (no fruit technique, no ΦF regen, damage ×1.25).", ...(lost.length ? [`The water takes ${lost.join(" and ")}.`] : [])] });
    }
    function fruitSoak(s, inst) {
      if (!ab(inst?.ability)?.movesWater) return;
      const hit = new Set([...(inst.targets || []), ...Object.values(s.actors).filter((u) => (inst.tiles || []).some(([x, y]) => u.x === x && u.y === y)).map((u) => u.id)]);
      for (const id of hit) soak(s, s.actors[id], ab(inst.ability).name);
    }
    function fruitResolve(s, a, inst) {
      const id = inst.ability;
      if (id === "windTheSpring") {
        const n = Math.min(RULES.coil.maxCoils, (a.status.coils?.n || 0) + 1); a.status.coils = { n };
        log(s, { kind: "effect", actor: a.id, text: `${a.name} winds the spring: ${n} coil${n === 1 ? "" : "s"} stored (next Strike +${n * RULES.coil.potencyPerCoil} potency, +${n * RULES.coil.reachPerCoil} reach).`, why: ["Coilfruit: the next Strike releases every stored coil."] });
        return true;
      }
      if (id === "takeTheShape") {
        const beast = (a.beastSummons || []).slice().sort((x, y) => (y.maxLF || 0) - (x.maxLF || 0))[0];
        if (!beast) { log(s, { kind: "effect", actor: a.id, text: `${a.name} knows no shape yet.`, why: ["Hidefruit takes the shape of a creature learned by swallowing its beads."] }); return true; }
        const def = wildRules?.data?.monsters?.[beast.kind], concept = def?.concept && C.concepts[def.concept] ? def.concept : null;
        const move = concept ? (C.concepts[concept].abilities || []).filter((x) => ab(x) && ab(x).tier !== "ultimate").sort((x, y) => (ab(y).potency || 0) - (ab(x).potency || 0))[0] || null : null;
        const turns = a.fruit.ripe ? 5 : RULES.hide.turns, hide = Math.min(RULES.hide.tempCap, Math.round((beast.maxLF || 0) * RULES.hide.tempShare));
        a.status.hideShape = { kind: beast.kind, name: beast.name, move, expiresAt: a.ownerTurns + turns + 1 };
        if (!a.status.ward || a.status.ward.hide) a.status.ward = { label: `${beast.name} hide`, owner: a.id, hide: true, protection: Math.max(hide, a.status.ward?.protection || 0), expiresAt: a.ownerTurns + turns + 1 };   // hide: the soak ends it with the shape; a ward from elsewhere (a Shield Wall) is left as it is (merge fix)
        log(s, { kind: "effect", actor: a.id, text: `${a.name} takes the shape of ${beast.name}: ${hide} borrowed hide${move ? `, and its ${ab(move).name}` : ""}, for ${turns} turns.`, why: ["Hidefruit: a quarter of the creature's life as a ward (at most 25), and its strongest move."] });
        return true;
      }
      if (id === "fogBank") {
        const [tx, ty] = inst.tiles?.[0] || [a.x, a.y], r = a.fruit.ripe ? 2 : RULES.mist.fogRadius, rounds = RULES.mist.fogRounds;
        for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (H.inside(s, x, y))
          s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x, y, protection: 0, duration: rounds, expiresAt: a.ownerTurns + rounds, concept: "fog", blocksSight: true, passable: true });
        log(s, { kind: "effect", actor: a.id, tiles: [[tx, ty]], text: `${a.name} lays a fog bank on (${tx},${ty}): sight fails in a ${2 * r + 1}×${2 * r + 1} square for ${rounds} rounds.`, why: ["Mistfruit: fog blocks sightlines and doesn't block movement."] });
        return true;
      }
      return false;
    }
    // OP1 §6 (moved out of engine.js, the line cap): a posted head draws a hunter, about one battle in eight. Skips silently with no
    // free edge tile or a feuding crew ("up to"). Returns opts, with the hunter added to the participants when it fits.
    function withHunter(opts, enc, arena) {
      if (!(opts.hunter && C.characters[opts.hunter])) return opts;
      const base = opts.participants || enc.actors;
      if (base.some((p) => p.id === "hunter")) return opts;
      const crew = base.filter((p) => (p.side || C.characters[p.character]?.side) === "enemy").map((p) => p.character);
      const taken = new Set(base.map((p) => ((opts.positions || {})[p.id] || p.at || []).join(",")));
      const free = (x, y) => y >= 0 && y < arena.map.length && x >= 0 && x < arena.map[y].length && !C.tiles[arena.map[y][x]]?.blocksMove && !taken.has(`${x},${y}`);
      let at = (arena.spawns?.enemy || []).find((t) => free(t[0], t[1]));
      if (!at) outer: for (let x = arena.map[0].length - 1; x >= 0; x--) for (let y = 0; y < arena.map.length; y++) if (free(x, y)) { at = [x, y]; break outer; }
      if (at && (!H.Factions || H.Factions.fits(C.rules, opts.hunter, crew)))
        return { ...opts, participants: [...base, { id: "hunter", character: opts.hunter, side: "enemy", hunter: true, at: at.slice() }] };
      return opts;
    }
    function hunterEntrance(s) {
      if (s.actors.hunter) log(s, { kind: "hunter", actor: "hunter", text: `${s.actors.hunter.name} walks in from the edge of the fight: the Record pays for your head, and they mean to collect.`, why: ["Sinkerfruit: a posted head draws a hunter, about one battle in eight."] });
    }
    return { withHunter, hunterEntrance, fruitRules: RULES, carryFruit, fruitOf, fruitKitOf, damped, fruitBlocked, fruitRegen, fruitTakenMul, fruitDrift, fruitRelease, fruitReach, fruitSoak, fruitResolve };
  })();
});
