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
//   fruitTurnStart(s, a)                  → turns.js, a unit's turn start: a Weather Front grows or ends, and foes standing in one lose 10 AP
//   fruitDrift(s, a, tgt, inst)            → true when Mist's Drift turns a Strike aside (35%, seeded)
//   fruitRelease(s, a)                     → { potency } from stored coils, consumed by this Strike
//   fruitReach(a)                          → +1 Strike reach per stored coil
//   fruitSoak(s, inst)                     → Soaks every eater the water-moving technique reaches
//   fruitResolve(s, a, inst)               → resolves Wind the Spring, Take the Shape, Fog Bank
//   withHunter(opts, enc, arena)           → a posted head draws a hunter (moved here from engine.js for the line cap)
//   hunterEntrance(s)                      → the log line when the hunter walks in
//   refinedOf(a)                           → respec S2a: the Ripe techniques in the kit (Scent, Vapour Step), only with opts.fruit.respec and Ripe
//   fruitRecoil(s, src, tgt, type, inst)   → respec S2a: Ripe Coilfruit's reaction, called once after an impact hit lands (damage.js)
//   markFeat(s, a, id)                     → respec S1a: records a feat on s.fruitFeats (the account counts it at battle end, once per account)
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
      hide: { tempShare: 0.25, tempCap: 25, turns: 3, absorbFeat: 15 },
      // Respec S2a (refined, Ripe). Recoil is a reaction with no card: it spends the round's reaction and 4 ΦF on its own.
      refined: { hide: ["scent"], mist: ["vapourStep"] },
      // Respec S2b1: the awakened arts (Awakened stage, announced, 15 PhiF). Mainspring: the eater's pushes on a target within 2 travel +1 tile, and the first Strike each turn
      // lets its coils go without spending them, for 2 of your turns (the cast turn and the next).
      awakened: { coil: ["mainspring"], mist: ["weatherFront"], hide: ["fullShape", "dropTheShape"] },
      // Respec S2b3 Full Shape (Hide, Awakened, 15 PhiF): the shape also brings the beast's passive, for at most 4 of the eater's turns; 3 PhiF upkeep at each later turn start; a free drop.
      // The creature data has no passive field, so each swallowable kind is mapped to a live biology trait that suits it (a Decision in the NOTE).
      full: { turns: 4, upkeep: 3 },
      passives: { feralPig: "denseMuscle", wolf: "insaneReflexes", moa: "survivalInstincts", nettleCaterpillar: "poisonAffinity", sasquatch: "denseMuscle" },
      // Only a trait the engine reads DURING a battle can be lent (a trait read at battle setup, such as +1 movement, would do nothing). Ducks, porgy, termites and a dream creature have none (Aerodynamic was dropped for the moa: its straight-line cost is not wired, so it would give +2 movement on every route).
      animeBeasts: ["feralPig", "wolf", "moa", "nettleCaterpillar"],
      mainspring: { turns: 2, within: 2, push: 1 },
      // Respec S2b2 Weather Front (Mist, Awakened, 15 PhiF): a fog ring on the cast tile grows radius 1, 2, 3 over three of the eater's turns, then clears together.
      // Allies standing in it are lent Drift by the ripe-mist rule that already exists; foes standing in it lose apLoss action points as their turn starts.
      front: { turns: 3, radii: [1, 2, 3], apLoss: 10 },
      recoil: { pf: 4, push: 1 }, scent: { radius: 3 }, vapour: { radius: 4 },
      steelWillAP: 10,
    };
    const FRUIT_NAME = { coil: "Coilfruit", hide: "Hidefruit", mist: "Mistfruit" };
    const ab = (id) => C.abilities[id];
    const active = (x, a) => !!x && (x.until == null || x.until >= a.ownerTurns);
    const fruitOf = (a) => a?.fruit && RULES.kits[a.fruit.id] ? a.fruit : null;
    // Respec S1a: a feat is only a note on the battle (s.fruitFeats); account/fruit.js settleFeats decides whether it counts. Always cheap, never
    // changes a result, and only the hero's fruit marks (a rival or the protagonist earns nothing).
    // Tracking is on only for the hero whose account runs the feat model (opts.fruit.respec, set by account/fruit.js battleOpts when
    // FR.RULES.respec is on): flag off, the battle state gains no new keys at all. A preview (damage forecast) never tracks.
    const tracking = (s, a) => !s.preview && !!fruitOf(a)?.respec && a.id === (s.modeSetup?.hero || "player");
    function markFeat(s, a, id) {
      if (!tracking(s, a)) return;
      const list = (s.fruitFeats ||= []); if (!list.includes(id)) list.push(id);
    }
    const tally = (s, a, key) => { if (!tracking(s, a)) return 0; const c = (s.fruitTally ||= {}); const k = `${a.id}:${key}`; return (c[k] = (c[k] || 0) + 1); };

    // Respec S4a: a rival eater is an ordinary enemy-side unit carrying one loose fruit (opts.rival = { fruit, ripe, character }). It gets the curse and the
    // fruit's kit like the hero does, at Fresh (Ripe at tier 2). It earns no feats (tracking is hero-only).
    // Respec: a unit that eats the fruit takes the trait (the hero with the feat model on, a rival eater, the anime hero once his fruit carries respec).
    const giveTrait = (u) => { if (!H.hasTrait?.(u, "fruitbound")) u.traits = [...(u.traits || []), "fruitbound"]; };
    // The AI's side of the trait (engine/ai.js rawScore): each fruit technique scores more when the moment fits. The anime kit floor (ai.js animeKitFloor) lifts
    // whatever becomes non-negative. Contexts keep it sensible: a coil only with a foe near, Mainspring only with coils held, fog only without fog of its own.
    function fruitboundBonus(s, a, cand) {
      const R = s.rules.aiLedger?.fruitbound; if (!R?.on || cand?.type !== "ability" || !R.bonus?.[cand.ability] || !fruitOf(a) || !H.hasTrait?.(a, "fruitbound")) return 0;
      const foeNear = (r) => Object.values(s.actors).some((u) => !u.defeated && !u.notArrived && !H.Tourist?.is?.(u) && u.side !== a.side && u.side !== "bystander" && dist(s, a.x, a.y, u.x, u.y) <= r);   // the AI's own idea of a foe (ai.js foesLeft)
      const coils = a.status?.coils?.n || 0, id = cand.ability;
      if (id === "windTheSpring" && !(coils < 2 && foeNear(3))) return 0;   // one or two coils, then the Strike that lets them go
      if (id === "mainspring" && !(coils >= 2 && foeNear(2))) return 0;   // the push bonus reaches 2 tiles: only worth it with coils to throw and a foe that close
      if (id === "fogBank" && ((s.barriers || []).some((b) => b.concept === "fog" && b.owner === a.id) || !foeNear(6))) return 0;
      if (id === "weatherFront" && (frontOn(a) || !foeNear(4))) return 0;   // a front is worth calling with a foe close enough to walk into it
      if (id === "vapourStep" && !foeNear(3)) return 0;
      if ((id === "takeTheShape" || id === "fullShape") && shapeOn(a)) return 0;   // an expired shape is not worn (the status is never cleared)
      if (id === "fullShape" && !(a.beastSummons || []).length) return 0;   // Full Shape needs a learned creature; the plain shape's card is greyed without one by fruitBlocked   // an expired shape is not worn (the status is never cleared)
      return R.bonus[id];
    }
    function armRival(s, opts) {
      const r = opts.rival, u = s.actors.rival; if (!r || !u || !RULES.kits[r.fruit]) return;
      u.fruit = { id: r.fruit, ripe: !!r.ripe, respec: true, shapes: [] }; giveTrait(u);
      u.passives = { ...(u.passives || {}), cantSwim: true, drowningDamageMul: Math.max(u.passives?.drowningDamageMul || 1, RULES.drowningMul) };
      log(s, { kind: "hunter", actor: "rival", text: `${s.actors.rival.name} walks in from the edge of the fight, carrying ${FRUIT_NAME[s.actors.rival.fruit.id] || "a fruit"}: another eater, and the sea refuses them too.`, why: ["Sinkerfruit: a loose fruit can be in someone else's hands. Water and cuffs quiet it; Steel will cuts through."] });
    }
    // Respec S4c: the feat model is on for this battle (opts.fruitWorld = { held }, set by ui.js only when account/fruit.js RULES.respec is on), so the anime orbit may hand
    // the Anime Protagonist a maxed fruit and must not hand him the fruit the player holds. Flag off: no key on the battle at all.
    function armAnimeFruit(s, u, id) {
      if (!RULES.kits[id]) return false;
      u.fruit = { id, ripe: true, respec: true, awakened: true, shapes: [] };
      u.passives = { ...(u.passives || {}), cantSwim: true, drowningDamageMul: Math.max(u.passives?.drowningDamageMul || 1, RULES.drowningMul) };
      giveTrait(u);
      animeEntrance(s, u, id);
      return true;
    }
    // Mala, 2026-11-01: meeting the Anime Protagonist should feel like meeting the protagonist of an anime: he opens the battle already in his awakened form. A Hidefruit hero is
    // given one learned creature at random (seeded: a replay meets the same one) and is already in the full shape; a Coilfruit hero has the Mainspring wound; a Mistfruit hero has a
    // Weather Front out on his tile. Each runs on the ordinary clocks (4, 2 and 3 of his turns), so nothing here holds a battle open. Free: he did not pay for the entrance.
    function animeEntrance(s, u, id) {
      u.status ||= {};
      // the + 1 in each expiry: his first turn is turn 1 (ownerTurns is 0 until it starts)
      if (id === "coil") { u.status.mainspring = { expiresAt: (u.ownerTurns || 0) + 1 + RULES.mainspring.turns, usedTurn: null }; log(s, { kind: "effect", actor: u.id, text: `${u.name} enters with the mainspring already wound.`, why: ["The anime orbit: an Awakened fruit hero opens the battle in his awakened form."] }); }
      if (id === "mist") { u.status.weatherFront = { x: u.x, y: u.y, expiresAt: (u.ownerTurns || 0) + 1 + RULES.front.turns, rings: 0 }; growFront(s, u); log(s, { kind: "effect", actor: u.id, tiles: [[u.x, u.y]], text: `${u.name} enters in a weather front: the fog rolls in with him.`, why: ["The anime orbit: an Awakened fruit hero opens the battle in his awakened form."] }); }
      if (id === "hide") {
        const kinds = RULES.animeBeasts, kind = kinds[Math.floor(H.seededChance(`${s.seed}:animeBeast`) * kinds.length)], def = wildRules?.data?.monsters?.[kind];
        u.beastSummons = [{ key: kind, kind, name: def?.name || kind, maxLF: def?.lf || 20 }];
        wearShape(s, u, u.beastSummons[0], true, true);
        log(s, { kind: "effect", actor: u.id, text: `${u.name} enters in the full shape of ${u.beastSummons[0].name}.`, why: ["The anime orbit: an Awakened fruit hero opens the battle in his awakened form."] });
      }
    }
    function carryFruit(s, opts) {
      if (opts.fruitWorld) s.fruitWorld = { held: opts.fruitWorld.held || null };
      armRival(s, opts);
      const f = opts.fruit; if (!f || !RULES.kits[f.id]) return;
      const hero = s.actors[s.modeSetup?.hero || "player"]; if (!hero) return;
      hero.fruit = { id: f.id, ripe: !!f.ripe, ...(f.respec ? { respec: true, shapes: [...(f.shapes || [])], awakened: !!f.awakened } : {}) };
      if (f.respec) giveTrait(hero);
      // The curse. sinksLikeAStone (insight-data.js) already sinks a Super ×2.5: the larger multiplier wins, never both.
      hero.passives = { ...(hero.passives || {}), cantSwim: true, drowningDamageMul: Math.max(hero.passives?.drowningDamageMul || 1, RULES.drowningMul) };
    }
    const refinedOf = (a) => { const f = fruitOf(a); return f?.respec && f.ripe ? RULES.refined[f.id] || [] : []; };
    const awakenedOf = (a) => { const f = fruitOf(a); return f?.respec && f.awakened ? RULES.awakened[f.id] || [] : []; };
    const mainspringOn = (s, a) => !!a.status?.mainspring && a.status.mainspring.expiresAt > a.ownerTurns && !damped(s, a);
    function fruitKitOf(a) {
      const f = fruitOf(a); if (!f) return [];
      const shape = a.status?.hideShape && a.status.hideShape.expiresAt > a.ownerTurns ? a.status.hideShape.move : null;
      return [...RULES.kits[f.id], ...refinedOf(a), ...awakenedOf(a), ...(shape && ab(shape) ? [shape] : [])];
    }
    function damped(s, a) {
      if (!fruitOf(a) || a.defeated) return "";
      if ((H.tileAt(s, a.x, a.y)?.tags || []).includes("water")) return "The sea takes it: you stand in water.";
      if (a.status?.soaked && a.status.soaked.expiresAt > a.ownerTurns) return "The sea takes it: you are soaked.";
      if (active(a.status?.cuffed, a) || active(a.status?.detained, a)) return "The sea takes it: tide-iron cuffs hold the power.";
      return "";
    }
    // A fruit technique, or Hidefruit's borrowed move, is refused while damped; Take the Shape is greyed with nothing learned.
    function fruitBlocked(s, a, id, act) {
      const f = fruitOf(a);
      // A fruit's technique is its eater's own (the fruit is who they are: spec section 1, bound to identity). Watching it taught a Control the Fog Bank in a sim and the
      // cast then read a fruit it did not have (fruitResolve): a unit without that fruit is refused, however it came by the card.
      if (!f || !(RULES.kits[f.id].includes(id) || refinedOf(a).includes(id) || awakenedOf(a).includes(id))) {
        const theirs = [RULES.kits, RULES.refined, RULES.awakened].some((table) => Object.values(table).some((list) => list.includes(id)));
        if (theirs && !(a.status?.hideShape?.move === id)) return "That power is a fruit's, and only its eater can use it.";
        if (!f) return null;
      }
      const own = RULES.kits[f.id].includes(id) || refinedOf(a).includes(id) || awakenedOf(a).includes(id) || (a.status?.hideShape?.move === id && a.status.hideShape.expiresAt > a.ownerTurns);
      if (!own) return null;
      if (id === "dropTheShape") return shapeOn(a) ? null : "You wear no shape.";   // the way out is never refused, even in the sea
      const why = damped(s, a); if (why) return why;
      if (id === "takeTheShape" && fullOn(a)) return "You wear the full shape: drop it first.";
      if (id === "takeTheShape" && !(a.beastSummons || []).length) return "You know no shape yet: learn a creature by swallowing its beads.";
      if (id === "fullShape") {
        if (!(a.beastSummons || []).length) return "You know no shape yet: learn a creature by swallowing its beads.";
        if (fullOn(a)) return "You already wear the full shape.";
        if (a.pf < RULES.full.upkeep + ab("fullShape").cost) return "The full shape needs its cost and a turn's upkeep in ΦF.";
      }
      if (id === "scent") {
        if (!(a.status?.hideShape && a.status.hideShape.expiresAt > a.ownerTurns)) return "Scent is the beast's nose: take a shape first.";
        if (!hidden(s, a).length) return `Nothing hides within ${RULES.scent.radius} tiles.`;
      }
      if (id === "mainspring" && a.status?.mainspring && a.status.mainspring.expiresAt > a.ownerTurns) return "The spring is already wound.";
      if (id === "weatherFront" && frontOn(a)) return "The front is already out.";
      if (id === "vapourStep") {
        if (!fogAt(s, a.x, a.y)) return "Vapour Step starts in fog: stand in a fog tile.";
        const at = act?.target; if (!at) return null;   // the card greys on position alone; the chosen tile is checked when it is aimed
        if (!Array.isArray(at) || !fogAt(s, at[0], at[1])) return "Vapour Step lands in fog: choose a fog tile.";
        if (dist(s, a.x, a.y, at[0], at[1]) > RULES.vapour.radius) return `Too far: Vapour Step reaches ${RULES.vapour.radius} tiles.`;
        if (H.unitOccupied?.(s, at[0], at[1]) || H.tileAt(s, at[0], at[1])?.blocksMove) return "That fog tile is taken.";
      }
      return null;
    }
    // Weather Front (S2b2). The ring is ordinary fog barriers (concept "fog", front: true) so sight, Vapour Step and the allies' Drift all work as they do for Fog Bank; the
    // status holds the centre, the turn it ends and how many rings are out. Water, Steel will and the eater being damped end it.
    const shapeOn = (a) => !!a.status?.hideShape && a.status.hideShape.expiresAt > a.ownerTurns;
    const fullOn = (a) => shapeOn(a) && !!a.status.hideShape.full;
    // Full Shape lends one trait (the beast's passive); every way out takes it back. Only a trait the eater did not already have is recorded as granted.
    function unwear(a) { const g = a.status?.hideShape?.granted; if (g) a.traits = (a.traits || []).filter((x) => (x.id || x) !== g); }
    function endShape(s, a, why) {
      if (!a.status?.hideShape) return;
      unwear(a); a.status.hideShape = null; if (a.status.ward?.hide) a.status.ward = null;
      if (!s.preview) log(s, { kind: "effect", actor: a.id, text: `${a.name} sheds the shape: ${why}.`, why: ["Hidefruit, Awakened: the full shape ends when dropped, damped, unpaid or out of time."] });
    }
    const frontOn = (a) => !!a.status?.weatherFront && a.status.weatherFront.expiresAt > a.ownerTurns;
    function growFront(s, a) {
      const f = a.status.weatherFront, r = RULES.front.radii[Math.min(f.rings, RULES.front.radii.length - 1)]; f.rings += 1;
      for (let y = f.y - r; y <= f.y + r; y++) for (let x = f.x - r; x <= f.x + r; x++) if (H.inside(s, x, y) && !(s.barriers || []).some((b) => b.front && b.owner === a.id && b.x === x && b.y === y))
        s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x, y, protection: 0, duration: RULES.front.turns, expiresAt: f.expiresAt, concept: "fog", blocksSight: true, passable: true, front: true });
      return r;
    }
    function endFront(s, a, why) {
      if (!a.status?.weatherFront) return;
      a.status.weatherFront = null; s.barriers = (s.barriers || []).filter((b) => !(b.front && b.owner === a.id));
      if (!s.preview) log(s, { kind: "effect", actor: a.id, text: `${a.name}'s weather front ${why}.`, why: ["Mistfruit, Awakened: water, a blow carrying Steel will, or the eater's own fruit going quiet ends the front."] });
    }
    // At a unit's turn start (engine/turns.js, one line): the eater's front grows a ring (or ends if the fruit went quiet), and anyone standing in a hostile front loses AP.
    function fruitTurnStart(s, a) {
      if (s.preview || a.defeated) return;
      if (a.status?.hideShape?.full) {   // Full Shape: the clock, the sea and the upkeep, in that order; each way out takes the passive back
        if (a.status.hideShape.expiresAt <= a.ownerTurns) endShape(s, a, "the four turns are up");
        else if (damped(s, a)) endShape(s, a, "the sea has the power");
        else if (a.pf < RULES.full.upkeep) endShape(s, a, "no ΦF left to hold it");
        else { a.pf -= RULES.full.upkeep; log(s, { kind: "resource", actor: a.id, text: `${a.name} pays ${RULES.full.upkeep} ΦF to hold the full shape (${a.pf}/${a.maxPF}).` }); }
      }
      if (a.status?.weatherFront) {
        if (a.status.weatherFront.expiresAt <= a.ownerTurns) a.status.weatherFront = null;
        else if (damped(s, a)) endFront(s, a, "fades: the sea has the power");
        else if (a.status.weatherFront.rings < RULES.front.radii.length) { const r = growFront(s, a); log(s, { kind: "effect", actor: a.id, text: `${a.name}'s weather front grows to radius ${r}.`, why: ["Mistfruit, Awakened: the ring widens each of your turns, to radius 3."] }); }
      }
      if (a.side === "bystander" || a.side === "civilian" || a.civilian) return;   // a civilian (side "civilian") and a bystander are never taxed
      const front = (s.barriers || []).find((b) => b.front && b.x === a.x && b.y === a.y && s.actors[b.owner] && !s.actors[b.owner].defeated && s.actors[b.owner].side !== a.side && frontOn(s.actors[b.owner]) && !damped(s, s.actors[b.owner]));   // an eater who fled or fell taxes no one (its fog lingers, as Fog Bank's does)
      if (!front || !(a.tempo > 0)) return;
      const lost = Math.min(a.tempo, RULES.front.apLoss); a.tempo -= lost;
      log(s, { kind: "tempo", actor: a.id, text: `${a.name} starts in ${s.actors[front.owner].name}'s weather front and loses ${lost} action points (${a.tempo} remain).`, why: ["Mistfruit, Awakened: foes in the ring lose 10 AP at their turn start. Leave the ring, or soak the eater."] });
    }
    const fogAt = (s, x, y) => (s.barriers || []).some((b) => b.concept === "fog" && b.x === x && b.y === y);
    const hidden = (s, a) => Object.values(s.actors).filter((u) => !u.defeated && u.side !== a.side && u.status?.concealed && (u.status.concealed.until == null || u.status.concealed.until >= u.ownerTurns) && dist(s, a.x, a.y, u.x, u.y) <= RULES.scent.radius);
    // Ripe Coilfruit: an impact hit that lands while a coil is held stores one more (to 3) and shoves the attacker one tile. Reaction + 4 ΦF, once a round,
    // so it cannot chain: a rival's own Recoil also spends its reaction. Quiet while damped, and for a hit that did nothing.
    // Respec S1b: one call after every hit that did something (damage.js): the hide's absorbed damage, a kill with the borrowed move, then Recoil.
    function fruitAfterHit(s, src, tgt, type, inst, { dmg = 0, warded = 0, wardHide = false } = {}) {
      if (s.preview) return;
      if (warded > 0 && wardHide && fruitOf(tgt)?.id === "hide" && tracking(s, tgt)) { const c = (s.fruitTally ||= {}); c[`${tgt.id}:hideAbsorb`] = (c[`${tgt.id}:hideAbsorb`] || 0) + warded; if (c[`${tgt.id}:hideAbsorb`] >= RULES.hide.absorbFeat) markFeat(s, tgt, "hide.absorb15"); }
      if (dmg > 0) fruitRecoil(s, src, tgt, type, inst);
    }
    // Called from damage.js after the defeat block: the foe is down and nothing saved it (a revival or a transmigration would have left it standing).
    function fruitKilled(s, src, tgt, inst) {
      const move = src?.status?.hideShape?.move;
      if (move && inst?.ability === move && src.status.hideShape.expiresAt > src.ownerTurns && src.side !== tgt.side) markFeat(s, src, "hide.ko");
    }
    // After a ripe release's knockback (actions.js): the foe met a wall, an object or a body (a slam), or ended in water.
    function fruitKnocked(s, a, t, mark, from) {
      if (s.preview || !tracking(s, a)) return;
      const moved = t.x !== from[0] || t.y !== from[1];   // a refused knock (Anchor, roots, a boss) leaves the foe where it stood, in water or not
      if (s.log.slice(mark).some((e) => e.kind === "slam" && e.target === t.id && !/collides with/.test(e.text || "")) || (moved && !t.defeated && H.waterAt?.(s, t.x, t.y))) markFeat(s, a, "coil.knock");
    }
    function fruitRecoil(s, src, tgt, type, inst) {
      if (s.preview || !src || src.id === tgt.id || src.side === tgt.side || tgt.defeated || tgt.lf <= 0 || src.defeated || type !== "nigredo" || !inst || inst.carriesWill) return;   // a killing blow, a friend, a hazard and Steel will (it lands through the give) are not answered
      if (fruitOf(tgt)?.id !== "coil" || !tgt.fruit.respec || !tgt.fruit.ripe) return;   // Ripe, with the feat model on
      const n = tgt.status?.coils?.n || 0;
      if (!n || !(tgt.reaction > 0) || tgt.pf < RULES.recoil.pf || damped(s, tgt)) return;
      tgt.reaction -= 1; tgt.pf -= RULES.recoil.pf; tgt.status.coils = { n: Math.min(RULES.coil.maxCoils, n + 1) }; const at = [src.x, src.y];
      markFeat(s, tgt, "coil.recoil");
      log(s, { kind: "effect", actor: tgt.id, target: src.id, text: `${tgt.name} recoils: ${n === RULES.coil.maxCoils ? `the coils are already full (${n})` : `${tgt.status.coils.n} coil${tgt.status.coils.n === 1 ? "" : "s"} stored`}.`, why: [`Coilfruit, Ripe: an impact hit that lands on a held coil is answered for ${RULES.recoil.pf} ΦF and the round's reaction: one more coil (to ${RULES.coil.maxCoils}), and the attacker pushed ${RULES.recoil.push} tile (one more while Mainspring is wound) unless it holds its ground.`] });
      if (!src.defeated) H.knock?.(s, tgt, src, RULES.recoil.push, inst, "push");
      if (src.x !== at[0] || src.y !== at[1]) log(s, { kind: "effect", actor: tgt.id, target: src.id, tiles: [[src.x, src.y]], text: `${src.name} is shoved back to (${src.x},${src.y}).` });
    }
    function fruitRegen(s, a, regen) {
      if (tracking(s, a) && a.fruit.id === "mist" && !damped(s, a)) fogBreaksSight(s, a);
      if (!damped(s, a)) return regen;
      if (tracking(s, a)) s.fruitDrained = true;   // damped through a turn start counts for 'win a battle in which you were damped', hit or not
      return 0;
    }
    // Mist: at the start of your turn, a fog bank of yours sits on a foe's line to someone on your side within 6, and nothing but the fog stops it.
    function fogBreaksSight(s, a) {
      if (s.fruitFeats?.includes("mist.fogLos")) return;
      const mine = (s.barriers || []).filter((b) => b.concept === "fog" && b.owner === a.id), crew = Object.values(s.actors).filter((u) => !u.defeated && u.side === a.side);
      if (!mine.length) return;
      for (const f of Object.values(s.actors).filter((u) => !u.defeated && u.side !== a.side)) for (const t of crew) {
        if (dist(s, f.x, f.y, t.x, t.y) > 6 || H.hasSight(s, f.x, f.y, t.x, t.y)) continue;
        const pts = H.line(f.x, f.y, t.x, t.y).slice(1, -1);
        if (pts.some(([x, y]) => mine.some((b) => b.x === x && b.y === y)) && pts.every(([x, y]) => !H.tileAt(s, x, y)?.blocksSight && !(H.barrierAt?.(s, x, y)?.blocksSight && H.barrierAt(s, x, y).concept !== "fog"))) { markFeat(s, a, "mist.fogLos"); return; }
      }
    }
    function fruitTakenMul(s, tgt, inst, type) {
      const f = fruitOf(tgt); if (!f) return null;
      let mul = 1; const notes = [];
      const why = damped(s, tgt);
      if (why) { if (tracking(s, tgt)) s.fruitDrained = true; mul *= RULES.drainedTakenMul; notes.push(`Drained: the sea pulls the strength out (damage ×${RULES.drainedTakenMul}).`); }
      else if (f.id === "coil" && type === "nigredo") {
        if (inst?.carriesWill) {
          notes.push("Steel will: the blow lands through the coil's give.");
          if (tgt.status?.mainspring && !s.preview) { tgt.status.mainspring = null; notes.push("It snaps the wound mainspring."); log(s, { kind: "effect", actor: tgt.id, text: `${tgt.name}'s mainspring snaps: a blow carrying will lands through the give.`, why: ["Coilfruit, Awakened: Steel will is the counter to Mainspring."] }); }
        }
        else { if (tally(s, tgt, "impact") === 3) markFeat(s, tgt, "coil.take3"); mul *= RULES.coil.impactTakenMul; notes.push(`Coilfruit gives with the blow (impact ×${RULES.coil.impactTakenMul}).`); }
      }
      return { mul, notes };
    }
    function fruitDrift(s, a, tgt, inst) {
      if (inst?.carriesWill) { if (tgt.status?.weatherFront && !s.preview) endFront(s, tgt, "is parted: a blow carrying will goes straight through it"); return false; }   // Steel will lands through Drift, owned or lent, and parts a front
      if (fruitOf(tgt)?.id === "mist" && damped(s, tgt) && tracking(s, tgt)) s.fruitStruck = true;   // damped, the Drift is gone: the Strike lands
      if (fruitOf(tgt)?.id === "mist" && !damped(s, tgt)) {
        s.driftN = (s.driftN || 0) + 1;
        const missed = H.seededChance(`${s.seed}:${s.round}:${a.id}:${tgt.id}:drift:${s.driftN}`) < RULES.mist.driftMiss;
        if (missed && tally(s, tgt, "drift") === 3) markFeat(s, tgt, "mist.drift3");
        if (!missed && tracking(s, tgt)) s.fruitStruck = true;   // a will-less Strike landed on the mist eater
        return missed;
      }
      const gift = (s.barriers || []).some((b) => b.concept === "fog" && b.x === tgt.x && b.y === tgt.y &&   // §8: ripe mist lends Drift to allies standing in its fog
        s.actors?.[b.owner]?.side === tgt.side && fruitOf(s.actors[b.owner])?.id === "mist" && s.actors[b.owner].fruit.ripe && !damped(s, s.actors[b.owner]));
      if (!gift) return false;
      s.driftN = (s.driftN || 0) + 1;
      const lent = H.seededChance(`${s.seed}:${s.round}:${a.id}:${tgt.id}:allydrift:${s.driftN}`) < RULES.mist.driftMiss;
      if (lent) markFeat(s, ownerOfGift(s, tgt), "mist.allyDrift");
      return lent;
    }
    const ownerOfGift = (s, tgt) => s.actors[(s.barriers || []).find((b) => b.concept === "fog" && b.x === tgt.x && b.y === tgt.y)?.owner];
    // resolve.js knock(): Mainspring makes every push the eater causes on a target within 2 of them travel one tile further.
    function fruitPushBonus(s, a, t, n, direction) {
      if (direction !== "push" || !a || !t || t.id === a.id || !mainspringOn(s, a) || dist(s, a.x, a.y, t.x, t.y) > RULES.mainspring.within) return n;
      return n + RULES.mainspring.push;
    }
    function fruitRelease(s, a) {
      const n = a.status?.coils?.n || 0; if (!n || fruitOf(a)?.id !== "coil") return { potency: 0, n: 0 };
      const wet = damped(s, a), keep = !wet && mainspringOn(s, a) && a.status.mainspring.usedTurn !== a.ownerTurns;   // Mainspring: the first Strike each turn lets go without spending
      if (keep) a.status.mainspring.usedTurn = a.ownerTurns; else a.status.coils = null;
      if (wet) { log(s, { kind: "effect", actor: a.id, text: `The sea takes ${a.name}'s ${n} coil${n === 1 ? "" : "s"}: nothing to let go.`, why: ["Sinkerfruit: damped, the coil's give is gone."] }); return { potency: 0, n: 0 }; }
      if (n === RULES.coil.maxCoils) markFeat(s, a, "coil.release3");
      return { potency: n * RULES.coil.potencyPerCoil, n, kept: keep };
    }
    const fruitReach = (a) => (fruitOf(a)?.id === "coil" ? (a.status?.coils?.n || 0) * RULES.coil.reachPerCoil : 0);
    function soak(s, t, by) {
      if (!fruitOf(t) || t.defeated) return;
      // expire() runs before regen at turn start: +2 keeps Soaked over the next turn it is meant to damp.
      t.status.soaked = { label: "Soaked", owner: t.id, expiresAt: t.ownerTurns + 2 };
      const lost = [t.status.coils?.n ? "the stored coils" : "", t.status.mainspring ? "the wound mainspring" : "", t.status.hideShape || t.status.ward?.hide ? "the borrowed shape and its hide" : "", frontOn(t) ? "the weather front" : ""].filter(Boolean);
      if (t.status.weatherFront) { t.status.weatherFront = null; s.barriers = (s.barriers || []).filter((b) => !(b.front && b.owner === t.id)); }
      unwear(t); t.status.coils = null; t.status.mainspring = null; t.status.hideShape = null; if (t.status.ward?.hide) t.status.ward = null;   // merge fix (Pantry): the hide ward goes with the shape   // the counters the techniques name: water takes the coil and ends the shape
      log(s, { kind: "effect", actor: t.id, target: t.id, text: `${t.name} is soaked by ${by}: the fruit's power goes quiet.`, why: ["Sinkerfruit: water damps the power for a turn (no fruit technique, no ΦF regen, damage ×1.25).", ...(lost.length ? [`The water takes ${lost.join(" and ")}.`] : [])] });
    }
    function fruitSoak(s, inst) {
      if (!ab(inst?.ability)?.movesWater) return;
      const hit = new Set([...(inst.targets || []), ...Object.values(s.actors).filter((u) => (inst.tiles || []).some(([x, y]) => u.x === x && u.y === y)).map((u) => u.id)]);
      for (const id of hit) soak(s, s.actors[id], ab(inst.ability).name);
    }
    // Wear the shape of a learned creature (Take the Shape, Full Shape, and the anime hero's entrance): its hide as a ward, its strongest move, and for the full shape its passive.
    function wearShape(s, a, beast, full, early) {   // early: the entrance, worn before the hero's first turn (ownerTurns is 0 and becomes 1 as it starts), so the clocks count from 1
      const def = wildRules?.data?.monsters?.[beast.kind], concept = def?.concept && C.concepts[def.concept] ? def.concept : null;
      const move = concept ? (C.concepts[concept].abilities || []).filter((x) => ab(x) && ab(x).tier !== "ultimate").sort((x, y) => (ab(y).potency || 0) - (ab(x).potency || 0))[0] || null : null;
      const turns = full ? RULES.full.turns - 1 : a.fruit.ripe ? 5 : RULES.hide.turns, hide = Math.min(RULES.hide.tempCap, Math.round((beast.maxLF || 0) * RULES.hide.tempShare));
      const at = (a.ownerTurns || 0) + (early ? 1 : 0);
      unwear(a); a.status.hideShape = { kind: beast.kind, name: beast.name, move, expiresAt: at + turns + 1 };
      const gift = full ? RULES.passives[beast.kind] : null;
      if (full) { a.status.hideShape.full = true; if (gift && !(a.traits || []).some((x) => (x.id || x) === gift)) { a.traits = [...(a.traits || []), gift]; a.status.hideShape.granted = gift; } }
      if (!a.status.ward || a.status.ward.hide) a.status.ward = { label: `${beast.name} hide`, owner: a.id, hide: true, protection: Math.max(hide, a.status.ward?.protection || 0), expiresAt: at + turns + 1 };   // hide: the soak ends it with the shape; a ward from elsewhere (a Shield Wall) is left as it is (merge fix)
      log(s, { kind: "effect", actor: a.id, text: `${a.name} takes the ${full ? "full " : ""}shape of ${beast.name}: ${hide} borrowed hide${move ? `, and its ${ab(move).name}` : ""}${full && gift ? `, and its ${gift} passive` : ""}, for ${full ? RULES.full.turns : turns} turns${full ? ` (${RULES.full.upkeep} ΦF upkeep at each turn start)` : ""}.`, why: ["Hidefruit: a quarter of the creature's life as a ward (at most 25), and its strongest move."] });
    }
    function fruitResolve(s, a, inst) {
      const id = inst.ability;
      if (id === "windTheSpring") {
        const n = Math.min(RULES.coil.maxCoils, (a.status.coils?.n || 0) + 1); a.status.coils = { n }; if (n === RULES.coil.maxCoils) markFeat(s, a, "coil.store3");
        log(s, { kind: "effect", actor: a.id, text: `${a.name} winds the spring: ${n} coil${n === 1 ? "" : "s"} stored (next Strike +${n * RULES.coil.potencyPerCoil} potency, +${n * RULES.coil.reachPerCoil} reach).`, why: ["Coilfruit: the next Strike releases every stored coil."] });
        return true;
      }
      if (id === "dropTheShape") { endShape(s, a, "dropped, for nothing"); return true; }
      if (id === "takeTheShape" || id === "fullShape") {
        const beast = (a.beastSummons || []).slice().sort((x, y) => (y.maxLF || 0) - (x.maxLF || 0))[0];
        if (!beast) { log(s, { kind: "effect", actor: a.id, text: `${a.name} knows no shape yet.`, why: ["Hidefruit takes the shape of a creature learned by swallowing its beads."] }); return true; }
        const full = id === "fullShape";
        markFeat(s, a, "hide.shape"); if ((a.fruit.shapes || []).some((k) => k !== beast.kind)) markFeat(s, a, "hide.second"); if (tracking(s, a)) (s.fruitShapes ||= []).includes(beast.kind) || s.fruitShapes.push(beast.kind);
        wearShape(s, a, beast, full);
        return true;
      }
      if (id === "fogBank") {
        const [tx, ty] = inst.tiles?.[0] || [a.x, a.y], r = a.fruit.ripe ? 2 : RULES.mist.fogRadius, rounds = RULES.mist.fogRounds;
        markFeat(s, a, "mist.fog");
        for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (H.inside(s, x, y))
          s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x, y, protection: 0, duration: rounds, expiresAt: a.ownerTurns + rounds, concept: "fog", blocksSight: true, passable: true });
        log(s, { kind: "effect", actor: a.id, tiles: [[tx, ty]], text: `${a.name} lays a fog bank on (${tx},${ty}): sight fails in a ${2 * r + 1}×${2 * r + 1} square for ${rounds} rounds.`, why: ["Mistfruit: fog blocks sightlines and doesn't block movement."] });
        return true;
      }
      if (id === "weatherFront") {
        a.status.weatherFront = { x: a.x, y: a.y, expiresAt: a.ownerTurns + RULES.front.turns, rings: 0 };
        const r = growFront(s, a);
        log(s, { kind: "effect", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} calls a weather front on (${a.x},${a.y}): fog to radius ${r} now, wider each turn to radius ${RULES.front.radii[RULES.front.radii.length - 1]}, for ${RULES.front.turns} turns; allies in it Drift and foes in it lose ${RULES.front.apLoss} AP a turn.`, why: ["Mistfruit, Awakened: the fog is the weather; it clears all at once when the three turns are up."] });
        return true;
      }
      if (id === "mainspring") {
        a.status.mainspring = { expiresAt: a.ownerTurns + RULES.mainspring.turns, usedTurn: null };
        log(s, { kind: "effect", actor: a.id, text: `${a.name} winds the mainspring: for ${RULES.mainspring.turns} turns every push within ${RULES.mainspring.within} travels +${RULES.mainspring.push}, and the first Strike each turn lets its coils go without spending them.`, why: ["Coilfruit, Awakened: the whole body is the spring."] });
        return true;
      }
      if (id === "scent") {
        const seen = hidden(s, a); markFeat(s, a, "hide.scent");
        for (const u of seen) { delete u.status.concealed; log(s, { kind: "reveal", actor: a.id, target: u.id, tiles: [[u.x, u.y]], text: `${a.name} scents ${u.name} out at (${u.x},${u.y}): revealed.`, why: ["Hidefruit, Ripe: the borrowed nose finds anyone hiding within 3 tiles."] }); }
        return true;
      }
      if (id === "vapourStep") {
        const [tx, ty] = inst.tiles?.[0] || [a.x, a.y], from = [a.x, a.y];
        a.x = tx; a.y = ty; a.moved = true; markFeat(s, a, "mist.vapour");
        log(s, { kind: "move", actor: a.id, path: [from, [tx, ty]], text: `${a.name} steps through the fog to (${tx},${ty}).`, why: ["Mistfruit, Ripe: from fog to fog within 4 tiles, no line needed. It is a step: it provokes nothing."] });
        H.applyEntryEffects?.(s, a, a, tx, ty);
        return true;
      }
      return false;
    }
    // OP1 §6 (moved out of engine.js, the line cap): a posted head draws a hunter, about one battle in eight. Skips silently with no
    // free edge tile or a feuding crew ("up to"). Returns opts, with the hunter added to the participants when it fits.
    function withHunter(opts, enc, arena) {
      return withEdge(withEdge(opts, enc, arena, "hunter", opts.hunter), enc, arena, "rival", opts.rival?.character, !!(opts.rival?.fruit && RULES.kits[opts.rival.fruit]));
    }
    function withEdge(opts, enc, arena, id, character, allowed = true) {   // a hunter or a rival eater walks in from the edge (S4a moved the body here so both share it)
      if (!(character && allowed && C.characters[character])) return opts;
      const base = opts.participants || enc.actors;
      if (base.some((p) => p.id === id)) return opts;
      const crew = base.filter((p) => (p.side || C.characters[p.character]?.side) === "enemy").map((p) => p.character);   // (hunter) the crew he must not feud with
      const taken = new Set(base.map((p) => ((opts.positions || {})[p.id] || p.at || []).join(",")));
      const free = (x, y) => y >= 0 && y < arena.map.length && x >= 0 && x < arena.map[y].length && !C.tiles[arena.map[y][x]]?.blocksMove && !taken.has(`${x},${y}`);
      let at = (arena.spawns?.enemy || []).find((t) => free(t[0], t[1]));
      if (!at) outer: for (let x = arena.map[0].length - 1; x >= 0; x--) for (let y = 0; y < arena.map.length; y++) if (free(x, y)) { at = [x, y]; break outer; }
      if (at && (!H.Factions || H.Factions.fits(C.rules, character, crew)))
        return { ...opts, participants: [...base, { id, character, side: "enemy", [id]: true, at: at.slice() }] };
      return opts;
    }
    function hunterEntrance(s) {
      if (s.actors.hunter) log(s, { kind: "hunter", actor: "hunter", text: `${s.actors.hunter.name} walks in from the edge of the fight: the Record pays for your head, and they mean to collect.`, why: ["Sinkerfruit: a posted head draws a hunter (how often, and who, follows the bounty)."] });
    }
    return { withHunter, hunterEntrance, markFeat, refinedOf, awakenedOf, fruitboundBonus, armAnimeFruit, fruitPushBonus, fruitRecoil, fruitAfterHit, fruitKilled, fruitKnocked, fruitRules: RULES, carryFruit, fruitOf, fruitKitOf, damped, fruitBlocked, fruitRegen, fruitTakenMul, fruitDrift, fruitTurnStart, fruitRelease, fruitReach, fruitSoak, fruitResolve };
  })();
});
