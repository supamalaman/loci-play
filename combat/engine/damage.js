"use strict";
// Damage and interactions: hit() and what it triggers.
// A part of the Concept Combat engine, split out of engine.js on 2026-10-11 (tools/split-engine.mjs). It is not a
// module in its own right: engine.js installs it with the host object H (everything the engine closure has in
// scope) and it hands back the functions it defines. Function bodies are exactly as they were in engine.js.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).damage = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { Auras, EmergentIdeas, Bonds, C, ClassRuntime, Climate, DIRS, EM, GraphLive, Parley, Performers, Postures, ab, activeTerrainEffect, actorAt, addStun,
      applyPoison, auraH, barrierAt, bossRules, chanted, chargeUltimate, checkOutcome, classH, compositionEdge, conceptName, dreamCanReach, accountItems, pickupRules,
      dreamSpaceRules, eatMushroom, edgeUsed, endRitual, endRite, fearCheck, footprint, heightAt, heroFell, inside, isMonster, key, log, monsterCtx,
      presidentContext, presidentRules, presidentUnits, recordMirrorEvent, refreshDrowning, saveWildWorld, springTraps, structures, summonRules,
      syncPickup, tileAt, tryDeathDoor, vegetation, wildRules, wildSnapshot } = H;
    // Holy (docs/holy.md): the fell are dream creatures, summons, the undead and demons by name (Mala 2026-11-02: Ravana and his Lanka court count, Mandodari too; his summoned horde already does) (a short anchored list, not the belief module's loose mythic regex).
    const OG = () => (typeof module === "object" && module.exports ? (() => { try { return require("../orgonite/orgonite.js"); } catch { return null; } })() : globalThis.ConceptCombatOrgonite) || null;
    const FELL = /\b(vampire|mummy|skeleton|ghost|zombie|demon|wraith|lich|revenant|wight|ghoul|rakshasa|ravana|kumbhakarna|indrajit|surpanakha|mandodari)s?\b/i;
    const isFell = (t) => !!(t.dream || t.summoned || t.summon || t.ai === "dream" || t.ai === "summon" || FELL.test(`${t.character || ""} ${t.name || ""} ${t.monster || ""}`));
    // defined by parts installed after this one: reached through H when called
    const moduleArena = (...args) => H.moduleArena(...args);
    const preview = (...args) => H.preview(...args);
    const target = (...args) => H.target(...args);

    // Soul (provisional). A hidden bar beside life force. Full soul changes nothing. Below full, the fraction
    // scales outgoing potency here, and fresh AP, ΦF regen, move budget and strike range at their own sites.
    function soulFrac(a) {
      if (!a || a.maxSoul == null || a.maxSoul <= 0 || a.soul == null || a.soul >= a.maxSoul) return 1;
      return Math.max(0, a.soul) / a.maxSoul;
    }
    // SF table (astral SPEC §0): kind base + best belief delta. Pure: safe to call at every spawn site.
    function soulMaxFor(rules, soulKind, character, traits) {
      const t = rules?.soul;
      if (!t) return null;
      const kind = soulKind || (character && t.byCharacter?.[character]) || "default";
      const base = t.kinds?.[kind] ?? t.max ?? 30;
      let best = 0;
      for (const tr of traits || []) {
        const id = typeof tr === "string" ? tr : tr?.id;
        if (id && t.belief?.[id] != null) best = Math.max(best, t.belief[id]);
      }
      return base + best;
    }
    function ensureSoul(s, a) {
      if (!a || a.maxSoul != null || !s.rules.soul) return;
      a.maxSoul = soulMaxFor(s.rules, a.soulKind, a.character, a.traits);
      if (a.soul == null) a.soul = a.maxSoul;
    }
    // Spiritual damage. A strike at a projection calls this instead of hit(), so the body keeps its life force.
    function woundSoul(s, src, tgt, potency) {
      ensureSoul(s, src); ensureSoul(s, tgt);
      if (!tgt || tgt.maxSoul == null) return 0;
      let dealt = potency;
      const frac = soulFrac(src);
      if (frac < 1) dealt *= frac;
      dealt = Math.max(0, roundFn(s)(dealt));
      const before = tgt.soul;
      tgt.soul = Math.max(0, before - dealt);
      const lost = before - tgt.soul;
      log(s, { kind: "ritual", actor: src?.id || null, target: tgt.id, tiles: [[tgt.x, tgt.y]], spiritual: true, amount: lost, text: `${src?.name || "The blow"} strikes ${tgt.name} on the soul for ${lost} soul (${tgt.soul}/${tgt.maxSoul}).`, why: ["Spiritual damage wounds the soul, not the body. As the soul thins, potency, action points, phi-energy, movement and reach all weaken."] });
      if (tgt.soul <= 0 && !tgt.husk) {
        tgt.husk = true; tgt.tempo = 0;
        log(s, { kind: "ritual", actor: tgt.id, text: `${tgt.name} is an empty husk. The body remains, and nothing is left to fight with.`, why: ["Soul at 0. Not a kill: the body still has its life force, and it does not hold the battle open."] });
        checkOutcome(s);
      }
      return lost;
    }
    // ── damage + interactions ──────────────────────────────────────────────
    // Concentration (Mala, 2026-10-17). Any LF lost makes a focused unit (ritual, held tones, dream) roll to hold, one roll per blow: enemy hits,
    // friendly fire, falls, terrain hazards, traps, poison ticks, Shared Burden splits. Hold chance K / (K + LF lost)
    // (content.js rules.concentration). A ritual channeler rolls at any LF; a dreamer only at or below the dream's
    // collapse line. A failed ritual roll breaks the chant; a failed dream roll marks the dream, and checkDreamCollapse
    // closes it after the action. A fully warded hit loses no LF and does not roll; LF paid as a cost is not a blow.
    // Loot v1 (Mala, 2026-10-18): fallen fighters and dream monsters drop battle consumables. Tables are tunables, not canon.
    const LOOT_TABLES = {
      fighter: { chance: 0.35, items: ["bandage", "electrolytes", "trailMix", "smokeCandle", "surveyFlag", "sandbag"] },
      dream: { chance: 0.35, items: ["electrolytes", "trailMix", "bandage", "surveyFlag"] },
      tofu: { chance: 1.0, items: ["tofu"] },   // builder's pick: the guaranteed drop and its 1.0 rate (a "Should drop Tofu" direction is in no record a reviewer can read; Mala has not confirmed it)
    };
    function lootDrop(s, src, tgt) {
      if (!tgt.character || tgt.knockedOut || tgt.boss || tgt.summon || tgt.beast || tgt.communed || tgt.companion) return;
      if (tgt.side !== "player" && tgt.side !== "enemy") return;
      const table = LOOT_TABLES[C.characters[tgt.character]?.lootTable] || (tgt.dream ? LOOT_TABLES.dream : LOOT_TABLES.fighter);
      s.lootN = (s.lootN || 0) + 1;
      if (H.seededChance(`${s.seed}:loot:${s.lootN}`) >= table.chance) return;
      const item = table.items[Math.floor(H.seededChance(`${s.seed}:loot-item:${s.lootN}`) * table.items.length)];
      const name = pickupRules?.sources?.[item]?.name || accountItems?.consumables?.[item]?.name || item;
      const killer = src && !src.defeated && Array.isArray(src.inventory) ? src : null;
      if (killer && killer.inventory.length < (killer.inventoryCapacity ?? 2)) {
        killer.inventory.push(item);
        log(s, { kind: "loot", actor: killer.id, target: tgt.id, item, tiles: [[tgt.x, tgt.y]], text: `${killer.name} takes ${name} from ${tgt.name}.` });
      } else {
        (s.arena.pickups ||= []).push({ id: `loot${++s.seq}`, item, x: tgt.x, y: tgt.y });
        log(s, { kind: "loot", actor: src?.id || null, target: tgt.id, item, tiles: [[tgt.x, tgt.y]], text: `${name} spills from ${tgt.name} at (${tgt.x},${tgt.y}).` });
      }
    }
    // Gold fragments (SPEC muse-fragments, locked decisions 13-14): the pool bleeds one charm
    // per round at 25+ pool damage, 3 per battle, strict d6 table. The s.fragments ledger rides the
    // battle result into finishBattle (auto-loot: no pickup action, the gold comes home).
    function shedFragment(s, tgt, absorbed) {
      const D = bossRules?.data?.integratedSelf?.drops;
      if (!D || !(absorbed > 0) || s.preview) return;
      const f = tgt.form; if (!f?.golden) return;
      if (f.fragRound !== s.round) { f.fragRound = s.round; f.fragTaken = 0; }
      f.fragTaken += absorbed;
      if (f.fragTaken < (D.perRoundTaken ?? 25) || f.fragDroppedRound === s.round || (f.fragDrops || 0) >= (D.perBattle ?? 3)) return;
      const n = (f.fragDrops || 0) + 1; f.fragDrops = n; f.fragDroppedRound = s.round;
      const id = D.table[Math.floor(H.seededChance(`${s.seed}:frag:${s.round}:${n}`) * D.table.length)];
      (s.fragments ||= []).push(id);
      const nm = accountItems?.equipment?.[id]?.name || id;
      log(s, { kind: "loot", actor: tgt.id, item: id, tiles: [[tgt.x, tgt.y]], text: `${tgt.name}'s gold sheds a fragment: ${nm}.` });
    }
    // Pure mechanics query: no rolls, counters, logging, or mutation. AI supplies only known traits.
    function concentrationProfile(s, tgt, lost, opts = {}) {
      const traits = opts.traits ?? tgt?.traits ?? [];
      const ids = traits.map(t => typeof t === "string" ? t : t?.id);
      const kMul = ids.reduce((m, id) => m * (H.insightRules?.data?.traits?.[id]?.kMul ?? 1), 1);
      const K = (s.rules.concentration?.k ?? 10) * kMul;
      const lf = opts.afterLF ?? tgt?.lf ?? 0, channels = [];
      if (tgt?.contractActive?.contract.active.concentration) channels.push("contract");
      if (tgt?.ritual) channels.push("ritual");
      if (tgt?.rite) channels.push("rite");
      if (tgt?.status?.heldTones) channels.push("tones");
      if ((tgt?.soulOf || tgt?.soulId) && (opts.afterLF ?? tgt?.lf ?? 0) > 0) channels.push("astral");
      const field = s.dreamSpace;
      if (field?.owner === tgt?.id && !field.concentrationBroken && lf > 0 && lf <=
        (ids.includes("perfectConcentration") ? s.rules.concentration?.perfect?.dreamLine ?? 0.25 : dreamSpaceRules?.rules.collapseIfCasterBelow ?? 0.5) * (tgt.maxLF || 100)) channels.push("dream");
      return { K, kMul, holdChance: lost > 0 ? K / (K + lost) : 1, breakChance: lost > 0 ? lost / (K + lost) : 0, channels };
    }
    function concentrationCheck(s, tgt, lost) {
      if (!tgt || !(lost > 0) || s.preview) return;
      const profile = concentrationProfile(s, tgt, lost);
      const { K, kMul, holdChance: p } = profile;
      const roll = (what) => {
        s.concentrationN = (s.concentrationN || 0) + 1;
        return { p, hold: H.seededChance(`${s.seed}:concentrate:${what}:${tgt.id}:${s.round}:${s.concentrationN}`) < p };
      };
      const why = () => [`Concentration holds ${Math.round(p * 100)}% of the time against a ${lost} LF hit (${+K.toFixed(2)} / (${+K.toFixed(2)} + ${lost}))${kMul !== 1 ? `; traits scale focus ×${+kMul.toFixed(2)}` : ""}.`];
      if(tgt.contractActive?.contract.active.concentration){const r=roll("contract");if(!r.hold)H.Contracts.end(s,tgt,"concentration broken by damage");}
      if (tgt.ritual) {
        const visitor = !!tgt.ritual.visitor, r = roll("ritual");
        if (r.hold) log(s, { kind: "ritual", actor: tgt.id, tiles: [[tgt.x, tgt.y]], text: `${tgt.name} keeps the ${visitor ? "retrieval chant" : "capture ritual"} going through the blow (concentration).`, why: why() });
        else endRitual(s, tgt, "broken");
      }
      if (tgt.rite && !tgt.rite.steady) {   // Rites (Muse-2): banked steps roll concentration like a chant; a failed roll loses them all. A steady rite (a self-sacrifice) does not roll: the lover already paid the holding.
        const r = roll("rite");
        if (r.hold) log(s, { kind: "ritual", actor: tgt.id, tiles: [[tgt.x, tgt.y]], text: `${tgt.name} keeps the rite going through the blow (concentration).`, why: why() });
        else endRite(s, tgt, "broken");
      }
      if (tgt.status?.heldTones) {   // Solfeggio: held tones roll like a chant (Mala, 2026-10-17); a failed roll loses every verse
        const r = roll("tones");
        if (r.hold) log(s, { kind: "effect", actor: tgt.id, target: tgt.id, text: `${tgt.name} keeps the held tones through the blow (concentration).`, why: why() });
        else { tgt.status.heldTones = null; log(s, { kind: "effect", actor: tgt.id, target: tgt.id, text: `${tgt.name}'s held tones break under the blow.`, why: ["The verses are lost; Hold the Tone starts the bank again.", ...why()] }); }
      }
      // Astral form requires concentration (Mala, 2026-10-24): a non-lethal hit on the soul, or any
      // LF hit on the body it left behind, rolls the soul's focus. Fail → forced snap-back. Lethal hits skip
      // the roll (soul at 0 is the death-link, not a lapse). Fully warded hits never reach this function.
      if (tgt.lf > 0 && (tgt.soulOf || tgt.soulId)) {
        const soul = tgt.soulOf ? tgt : s.actors[tgt.soulId];
        if (soul && !soul.defeated) {
          const sp = concentrationProfile(s, soul, lost);
          s.concentrationN = (s.concentrationN || 0) + 1;
          const hold = H.seededChance(`${s.seed}:concentrate:astral:${soul.id}:${s.round}:${s.concentrationN}`) < sp.holdChance;
          const swhy = [`Concentration holds ${Math.round(sp.holdChance * 100)}% of the time against a ${lost} LF hit (${+sp.K.toFixed(2)} / (${+sp.K.toFixed(2)} + ${lost})).`];
          if (hold) log(s, { kind: "astral", actor: soul.id, tiles: [[soul.x, soul.y]], text: `${soul.name} holds its form through the blow (concentration).`, why: swhy });
          else H.returnSoul(s, soul, "snap");
        }
      }
      const field = s.dreamSpace;
      if (profile.channels.includes("dream")) {
        const r = roll("dream");
        if (r.hold) log(s, { kind: "dreamSpace", actor: tgt.id, text: `${tgt.name} holds the dream together through the blow (concentration).`, why: why() });
        else { s.dreamSpace = { ...field, concentrationBroken: true }; log(s, { kind: "dreamSpace", actor: tgt.id, text: `The blow breaks ${tgt.name}'s concentration.`, why: why() }); }
      }
    }
    // Firing from cover (Mala's loop 1a1459c53e0, 2026-10-17): the partial cover a shooter stands directly behind, on the
    // first tile toward (tx, ty): a berm, rubble, a hedge, a folded panel facing the target. 0 when there is none, when
    // the target is adjacent, or when the cover is whole (a whole wall stops the shot anyway).
    function shooterCover(s, a, tx, ty) {
      if (!a || (Math.abs(a.x - tx) <= 1 && Math.abs(a.y - ty) <= 1)) return 0;
      const step = H.line(a.x, a.y, tx, ty)[1]; if (!step) return 0;
      const [x, y] = step, b = barrierAt(s, x, y), o = s.arena.objects?.find((u) => u.x === x && u.y === y);
      if (actorAt(s, x, y)) return 0;
      const faced = !b?.foldFacing || (Math.sign(tx - x) === b.foldFacing[0] && Math.sign(ty - y) === b.foldFacing[1]);
      const f = Math.max(o ? o.cover || 0 : tileAt(s, x, y).cover || 0, faced ? b?.coverFraction || 0 : 0);
      return f > 0 && f < 1 ? f : 0;
    }
    const roundFn = (s) => (s.rules.rounding === "floor" ? Math.floor : s.rules.rounding === "ceil" ? Math.ceil : Math.round);
    const shieldCovers = (tgt, src) => {
      const face = tgt?.status?.shieldFace;
      if (!face || !src || (face.until != null && face.until < tgt.ownerTurns)) return false;
      const [dx, dy] = face.dir || [];
      return (dx && Math.sign(src.x - tgt.x) === dx) || (dy && Math.sign(src.y - tgt.y) === dy);
    };
    // Step Between as a reaction (Mala, 2026-10-13; it was always written as one, kits-data.js timing "reaction", but was
    // wired as a turn action). A unit that holds Step Between, with its reaction left and above a quarter of its Life
    // Force, takes a hit meant for an ally standing next to it. Fields and blasts (radius, plus, cone, the whole board)
    // have no route to step into. Spends the reaction (one a round); nothing else. Escort Screen is still the free one.
    function stepBetweenReaction(s, src, tgt, inst) {
      if (!src || !tgt || !inst || src.side === tgt.side || tgt.wild) return tgt;
      if (inst.delivery === "field" || ["radius", "plus", "board", "cone"].includes(inst.area?.shape)) return tgt;   // a shot down a line is one hit on one body; a blast is not
      for (const g of Object.values(s.actors)) {
        if (!g || g.defeated || g.notArrived || g.routed || g.id === tgt.id || g.id === src.id || g.side !== tgt.side) continue;
        if ((g.reaction || 0) < 1 || (s.rules.rangeMetric === "chebyshev" ? Math.max(Math.abs(g.x - tgt.x), Math.abs(g.y - tgt.y)) : Math.abs(g.x - tgt.x) + Math.abs(g.y - tgt.y)) !== 1 ||   // adjacent, by the battle's own metric
        g.lf <= g.maxLF * 0.25) continue;
        if (!(g.kit || []).includes("stepBetween") && !ClassRuntime?.builds?.[g.character]?.kit?.includes("stepBetween")) continue;
        g.reaction -= 1;
        log(s, { kind: "effect", actor: g.id, target: tgt.id, reaction: "stepBetween", text: `${g.name} steps between: the hit meant for ${tgt.name} lands on ${g.name}.`, why: ["Step Between is a reaction: an ally next to you, one hit a round.", "Redirecting a consequence doesn't erase it."] });
        return g;
      }
      return tgt;
    }
    // AGI Takeoff Clock (spec ~/loci/docs/agi-takeoff-spec.md). Parts can't share code without
    // engine.js, so the tiny ledger helpers are duplicated in actions.js (witness), turns.js
    // (transcendence tick) and hover.js (ledger display): keep them in sync.
    const isTakeoffUnit = (u) => !!u && u.character === "agi";
    const takeoffOf = (u) => (u.takeoff ||= { exp: {}, immune: [], sightings: 0, transcended: 0, completed: 0, taught: 0, paced: false });
    const takeoffMult = (exp, key) => exp >= 5 ? (key === "strike" ? 0.2 : 0) : exp === 0 ? (key === "deception" ? 1.5 : 1) : exp <= 2 ? 0.6 : 0.35;
    const takeoffBonus = (u) => (u.ownerTurns || 0) * (u.takeoff?.completed ? 2 : 1);
    const takeoffConceptOf = (inst) => {
      const id = inst?.ability;
      if (id && id !== "strike") { const c = C.abilities?.[id]?.concepts?.[0]; if (typeof c === "string") return c.toLowerCase(); }
      if (typeof inst?.concept === "string") return inst.concept.toLowerCase();
      return "strike";
    };
    function findOpp(source, target, type, delivery, opKind) {
      return C.opposition.find((e) => e.status === "known" && e.source === source && (e.target === target || e.target === "*") && e.type === type
        && (!delivery || e.conditions.some((c) => c.includes(delivery))) && (!opKind || e.op.kind === opKind)) || null;
    }
    // Summon pacts: the one leave-path helper. Every defeat site calls it for the fallen: a pact summon going
    // down ends the call (downed, no standing); the caller going down sends a live call home first (callerDown).
    // Safe to call for any unit: it no-ops without an active call, and each end pushes exactly one code.
    function pactLeave(s, u) {
      const call = s.pactActive;
      if (!call || !u) return;
      if (u.summon?.pact && call.line === u.summon.pact.line) {
        s.pactActive = null;
        (s.pactCodes ||= []).push({ type: "pactEnded", line: call.line, how: "downed" });
      } else if (call.owner === u.id) {
        const ps = s.actors[call.summonId];
        s.pactActive = null;
        if (ps && !ps.defeated) { ps.defeated = true; log(s, { kind: "summon", actor: ps.id, text: `${ps.name} goes home: its caller fell.` }); }
        (s.pactCodes ||= []).push({ type: "pactEnded", line: call.line, how: "callerDown" });
      }
    }
    // Final per-target resolution: multiply once, round once, then ward absorbs, then LF.
    // Gentle Hand (hotbuilds W1a): the first lethal blow a carrier lands on each foe leaves that foe at
    // 1 LF, once per foe per battle. Runs before beforeDefeat/transmigrate: mercy preempts survival drama.
    function gentleSpare(s, src, tgt) {
      if (!src || src.id === tgt.id || src.side === tgt.side || !H.hasTrait(src, "gentleHand") || tgt.gentled) return false;
      tgt.lf = 1; tgt.gentled = true;
      log(s, { kind: "spare", actor: src.id, target: tgt.id, text: `${src.name} stays his hand: ${tgt.name} is left at 1 LF.` });
      return true;
    }
    // The Look needs no trigger here: actor.js afterHit already rolls it for every theLook carrier
    // (10% per damaging move, once per enemy per turn, reaction eaten outright). A second roll here
    // would double the rate for the Actor (triage 2026-11-04); the Hypnotist gets the Look by holding
    // the trait, and the tests pin the shared trigger, not a new one.
    function hit(s, src, tgt, inst, potency, why, opts = {}) {
      if (tgt && inst?.answeredBy?.includes(tgt.id)) { log(s, { kind: "negate", actor: src?.id, target: tgt.id, answered: true, text: `${inst.name} meets ${tgt.name}'s answer and is gone.` }); return 0; }   // My Answer Has Changed (window.js castAnswer)
      if(src&&inst&&H.Contracts&&!H.Contracts.allowed(s,src,inst))return 0;
      potency=H.Contracts?.specialize(s,src,tgt,inst,potency)??potency;
      if (src?.redInk && potency > 0) { potency += 2; why = (why || []).concat(["Red Ink burns in the blood: +2 potency."]); }   // W9.4: the rented strength hits first
      // A bleed-out skips the who-may-hit gates: the wound was dealt when the bleed was applied, this only finishes it.
      if (!opts.bleedOut && H.Tourist?.is(src) && src.id !== tgt?.id) return 0;
      if (!opts.bleedOut && (H.PostHuman.blocked(s, src, tgt) || H.Civilian.blocked(s, src, tgt) || H.Visitors?.blocked(s, src, tgt) || H.Factions.blocked(s, src, tgt))) return 0;   // Post-Humanity, civilians, visitors — and heroes, who only fight villains
      if (!opts.bleedOut) {   // a bleed-out (stealth.js) only finishes the drain: no new attack, no standoff reset
        H.PostHuman.attacked(s, src, tgt);
        H.Civilian.attacked(s, src, tgt);
        H.Factions.attacked(s, src, tgt);
        H.Visitors?.attacked(s, src, tgt, { log });
        if (src && tgt && s.actors[src.id] && src.side !== tgt.side) s.lastClashRound = s.round;
      }   // rules.standoff: an attack between opposing units
      if(!opts.bleedOut && ((src?.permanentAlly && tgt.side==="player") || (tgt.permanentAlly && src?.side==="player")))return 0;
      if (!opts.revealField && !opts.bleedOut && src?.x != null && !dreamCanReach(s,src,inst,tgt.x,tgt.y)) {
        log(s,{kind:"dreamSpace",actor:src.id,target:tgt.id,text:`The sealed dream stops ${inst?.name || "the attack"} from reaching ${tgt.name}.`}); return 0;
      }
      if (Parley && potency > 0 && src && s.actors[src.id] === src) { const no = Parley.blocks(s, src, tgt); if (no) { log(s, { kind: "parley", actor: src.id, target: tgt.id, text: `${src.name} holds back from ${tgt.name}.`, why: [no] }); return 0; } }   // Parley
      if (tgt?.character === "kaiba") {   // the cat cannot be harmed (the civilians noticed anyway, above)
        s.kaibaSwats = (s.kaibaSwats || 0) + 1;
        const lines = ["bats the blow aside without looking up.", "is somewhere else when it lands. Was he ever there?", "yawns through it."];
        log(s, { kind: "kaiba", actor: src?.id || null, target: tgt.id, text: `Kaiba ${lines[s.kaibaSwats % lines.length]}`, why: ["Kaiba cannot be harmed."] });
        // Mala, 2026-10-14: "attacking kaiba should be a terrible decision, AOE restraint highly advised because the police
        // will descend on you and you will be locked out of petting him for the remainder of combat." Any hit counts,
        // an area attack that catches him included.
        if (src?.id && s.actors[src.id] && !tgt.kaiba?.shunned?.[src.id]) {
          ((tgt.kaiba ||= {}).shunned ||= {})[src.id] = true;
          log(s, { kind: "kaiba", actor: tgt.id, target: src.id, shunned: true, text: `Kaiba won't let ${src.name} near him again this battle.`, why: ["Hit the cat, even by catching him in an area, and he is done with you: no petting for the rest of the battle."] });
        }
        return 0;
      }
      if (src && potency > 0) {
        const frac = soulFrac(src);
        if (frac < 1) { potency *= frac; why = (why || []).concat([`A thinning soul weakens the blow (×${frac.toFixed(2)}).`]); }
      }
      const possession = src?.status?.onePossession;
      if (possession?.expiresAt > src.ownerTurns && (!possession.targetId || possession.targetId === tgt.id)) { potency *= possession.multiplier || 1; why = why.concat([`One Possession focuses this target: ×${possession.multiplier}.`]); }
      if (src?.status?.catharsis && src.status.catharsis.expiresAt > src.ownerTurns) {
        potency *= src.status.catharsis.potencyMul || 1;
        why = why.concat([`Catharsis strengthens the technique ×${src.status.catharsis.potencyMul || 1}.`]);
      }
      if (src && potency > 0 && isTakeoffUnit(src)) {
        const tb = takeoffBonus(src);
        if (tb > 0) { potency += tb; why = why.concat([`Takeoff +${tb} damage${src.takeoff?.completed ? " (complete: doubled)" : ""}.`]); }
      }
        if (chanted(s, tgt.id)) {   // C18 stasis: a wild monster or a dream creature held in a capture chant
          log(s, { kind: "ritual", actor: src?.id || null, target: tgt.id, tiles: [[tgt.x, tgt.y]], text: `${tgt.name || "The monster"} hangs suspended in the chant; the blow cannot land.` }); return 0;
        }
        if (tgt.wild) {
        const summonMul = tgt.summoned ? (src?.passives?.summonDamageDealtMul || 1) : 1;
        const amount = Math.max(0, roundFn(s)(potency * summonMul));
        const causes = summonMul !== 1 ? [...why, `Non-believer deals ×${summonMul} damage to a summoned creature.`] : why;
        const r = wildRules.hurtMonster(wildSnapshot(s), tgt.id, amount, src && s.actors[src.id] === src ? src.id : null);
        saveWildWorld(s, r.world);
        // Touching a spined thing: a strike or a contact technique against it poisons the one who touched it.
        const spined = wildRules.data.monsters[tgt.kind]?.poison;
        if (spined && src && s.actors[src.id] === src && !src.defeated && potency > 0 && (!inst || inst.delivery === "contact" || inst.ability === "strike" || inst.effect === "strike")) applyPoison(s, src, wildRules.data.monsters[tgt.kind], tgt.id, "touched");
        for (const ev of r.events) log(s, { kind: ev.kind, actor: src?.id || null, target: tgt.id, amount: ev.amount, text: ev.text, why: causes });
        const actual=s.wild.find(u=>u.id===tgt.id);if(actual)Performers?.afterHit(s,src,actual,amount,classH());
        ClassRuntime?.spendTrophyEye?.(s, src, amount);   // Trophy Eye: this branch returns before ClassRuntime.afterHit
        checkOutcome(s); return amount;
      }
      const aimed = tgt;
      if (ClassRuntime && src && inst) { const r = ClassRuntime.redirect(s, src, tgt, inst, classH()); if (r === null) return 0; tgt = r; }   // ClassRuntime: intercepts, departures
      if (tgt === aimed) tgt = stepBetweenReaction(s, src, aimed, inst);   // Step Between, the reaction: only if nothing already took the hit
      const tookFor = tgt !== aimed && tgt.side === aimed.side ? tgt.id : null;   // admiration: an intercept stepped in (deed fires below, only if the hit lands)
      if (potency > 0 && H.prepaidEscape?.(s, src, tgt, inst) === "miss") return 0;   // prepaid escape (machine P4): the designated displacement fires before the hit lands
      if (H.monsterOf(inst)) potency = H.monsterPotency(src, tgt, inst, potency);   // Life Drain: what the gradient allows
      let mult = H.Observation?.damageBonus(s,src,tgt,inst) || 1; const notes = why.slice();
      if(mult>1)notes.push(`Discernment: ${H.Observation.discoveries(s,src,tgt.id)} discoveries, damage ×${mult.toFixed(2)}.`);
      const flatFr = potency > 0 && tgt.boss && s.bossRush && bossRules?.flatResist ? bossRules.flatResist(tgt) : null, flatPierced = !!flatFr && (!!inst?.piercing || (inst?.damageType || opts.damageType) === "albedo"), flatHolds = !!flatFr && !flatPierced;   // a flat hide (the Oni) is x0.1 whatever else the boss wears: the enraged mass does not stack on it (Mala, 2026-10-31: "oni should be flat")
      if (tgt.boss && bossRules && !flatHolds) { const bossMul = bossRules.damageTakenMul(tgt); if (bossMul !== 1) { mult *= bossMul; notes.push(`${tgt.name}'s enraged mass resists damage ×${bossMul}.`); } }
      if (flatFr) { if (flatPierced) notes.push(`Piercing: ${tgt.name}'s hide cannot turn it.`); else { mult *= flatFr.mul; notes.push(`${tgt.name}: ${flatFr.text}`); } }
      if (s.sealedFight && tgt.boss === "sealednext" && s.sealedFight.takenMul && s.sealedFight.takenMul !== 1) { mult *= s.sealedFight.takenMul; notes.push(`The turn after the water leaves, blows against ${tgt.name} are ×${s.sealedFight.takenMul}.`); }
      const damageType = inst?.damageType || opts.damageType || "nigredo";
      if (tgt.awakened && potency > 0) {   // Tsukumogami: it is still a structure — destructive doubles; its material drinks or shatters by channel
        if (inst?.destructive) { mult *= 2; notes.push(`${tgt.name} is still a structure: a destructive blow does double.`); }
        const mat = (vegetation?.data?.rules?.materials || {})[tgt.awakened.material] || {};
        if (mat[damageType]) { mult *= mat[damageType]; notes.push(`${tgt.name}'s ${tgt.awakened.material} body takes ×${mat[damageType]} ${damageType} damage.`); }
        if (H.hasTrait(tgt, "rigid")) { mult *= 0.85; notes.push(`${tgt.name}'s rigid frame takes ×0.85 damage.`); }
        if (H.hasTrait(tgt, "brittle")) { mult *= 1.5; notes.push(`${tgt.name}'s brittle body takes ×1.5 damage.`); }
      }
      if (isMonster(tgt) && potency > 0) {
        const field = inst?.delivery === "field" || !!opts.field;
        const fire = /ignite|fire|burn/i.test(`${inst?.effect || ""} ${inst?.ability || ""} ${opts.label || ""} ${src?.name || ""}`);
        if (tgt.passive === "incorporeal" && !field && (damageType === "nigredo" || damageType === "albedo")) {
          log(s, { kind: "monsterRule", actor: src?.id || null, target: tgt.id, tiles: [[tgt.x, tgt.y]], text: `${inst?.name || "The blow"} passes straight through ${tgt.name}.`, why: ["Incorporeal: impact and piercing do nothing unless they are a field."] }); return 0;
        }
        if (tgt.passive === "galvanized" && damageType === "rubedo") {
          const healed = Math.max(0, Math.min(10, Math.round(potency), tgt.maxLF - tgt.lf)); tgt.lf += healed;
          log(s, { kind: "monsterRule", actor: src?.id || null, target: tgt.id, tiles: [[tgt.x, tgt.y]], text: `Galvanized: the current feeds ${tgt.name} (+${healed} LF).`, why: ["Resonance heals it instead of harming it."] }); return 0;
        }
        if (tgt.drawback === "brittle" && damageType === "nigredo") { mult *= 2; notes.push("Brittle: impact ×2."); }
        if (tgt.drawback === "tinderDry" && fire) { mult *= 3; tgt.status.burning = 6; notes.push("Tinder-dry: fire ×3, and it catches (6 a turn)."); }
      }
      if (Climate && s.weatherState && inst && src) {
        const sky = Climate.sky(s), micro = Climate.microclimate(moduleArena(s.arena), sky);
        const climateAbility = { ...(C.abilities[inst.ability] || {}), ...inst, concept: inst.concept };
        const climate = Climate.modifier(climateAbility, { from: [src.x, src.y], to: [tgt.x, tgt.y], state: sky, micro, channel: damageType });
        if (climate.mul !== 1) { mult *= climate.mul; notes.push(...climate.notes); }
      }
      if ((src?.summoned || src?.summon || src?.dream?.source === "belief") && tgt.passives?.summonDamageTakenMul && tgt.passives.summonDamageTakenMul !== 1) {
        mult *= tgt.passives.summonDamageTakenMul;
        notes.push(`Non-believer takes ×${tgt.passives.summonDamageTakenMul} damage from a summon.`);
      }
      if (tgt.dream?.source === "belief" && src?.passives?.summonDamageDealtMul && src.passives.summonDamageDealtMul !== 1) {
        mult *= src.passives.summonDamageDealtMul;
        notes.push(`Non-believer deals ×${src.passives.summonDamageDealtMul} damage to a summoned creature.`);
      }
      if (src?.form?.golden && potency > 0 && inst?.ability === "strike") { mult *= 1.25; notes.push("Whole: the Integrated Self strikes as one — ×1.25 potency."); }   // techniques already carry Whole in their manifest (engine.js: cost -1, potency x1.25); a strike has no manifest
      if(tgt.outlaw&&src&&presidentRules){const office=Object.values(s.actors).map(h=>presidentUnits(s).find(u=>u.id===h.id)).find(h=>h&&h.side===src.side&&presidentRules.officeValid(h)&&presidentRules.inJurisdiction(h,presidentUnits(s).find(u=>u.id===tgt.id),presidentContext(s)));if(office&&presidentRules.recognizers(office,presidentUnits(s),presidentContext(s)).includes(src.id)){mult*=presidentRules.outlawMul(src.id,presidentUnits(s).find(u=>u.id===tgt.id),[src.id]);notes.push("A recognized ally's attack on an outlaw gains ×1.25 under Due Process.");}}
      if (s.mirror && !opts.bleedOut && !s.mirror.channelsUsed.includes(damageType)) s.mirror.channelsUsed.push(damageType);
      // The relationship graph acts here: dampening, compositions, status stripping, attunement bypass (graph/live.js).
      const gl = GraphLive && potency > 0 && !s.rules.graphLiveOff ? GraphLive.damageMods({ s, src, tgt, inst, damageType }) : null;
      if (gl) { mult *= gl.mult; notes.push(...gl.notes); for (const id of gl.used) edgeUsed(s, id); }
      const cr = ClassRuntime && potency > 0 ? ClassRuntime.damageMods(s, src, tgt, inst, damageType, classH()) : null;   // ClassRuntime
      if (cr) { mult *= cr.mult; notes.push(...cr.notes); }
      { const stm = potency > 0 ? H.States?.damageMods(s, src, tgt, inst, damageType) : null; if (stm) { mult *= stm.mult; notes.push(...stm.notes); } }   // States: modifiers on dealt and taken
      { const CY = s.rules.cybernetic; if (CY && potency > 0 && H.hasTrait(tgt, CY.trait)) { mult *= CY.damageMul; notes.push(`Cybernetic ×${CY.damageMul}.`); } }
      // Established Guard: the shield already halved this side. One extra ×0.8, then the flag is spent.
      { const guard = tgt.status?.establishedGuard;
        if (guard?.ready && potency > 0 && shieldCovers(tgt, src)) {
          const mul = guard.mul ?? 0.8;
          mult *= mul; notes.push(`Established Guard: the next directional defense ×${mul}.`);
          tgt.status.establishedGuard = null;
        } }
      const au = Auras && potency > 0 ? Auras.damageMods(s, src, tgt, inst, auraH()) : null;   // Auras: rings on the field
      if (au) { mult *= au.mult; notes.push(...au.notes); }
      const bd = Bonds && potency > 0 ? Bonds.damageMul(s, tgt, src, classH()) : null;   // Bonds: Blessing of Malnote, Chain of Command
      if (bd && bd.mul !== 1) { mult *= bd.mul; notes.push(bd.note); }
      { const gw = potency > 0 ? H.graveWard?.(s, tgt) : 0;   // ritual burial: a tended grave wards its side's units beside it
        if (gw) { potency = Math.max(0, potency - gw); notes.push(`${tgt.name} stands by a tended grave (−${gw}).`); } }
      if (potency > 0 && H.hasTrait(tgt, "hardy") && inst && (inst.delivery === "field" || inst.terrain === true)) {   // Seedkeeper: Hardy grounds out field/terrain damage
        potency = Math.max(0, potency - 10); notes.push(`${tgt.name} is Hardy: field damage −10.`); }
      { // Settlement: a Palisade or Keep shelters adjacent allies of its side (Mala, 2026-10-19).
        const shelter = potency > 0 && (s.arena.objects || []).find((o) => (o.type === "palisade" || o.type === "keep") && (o.hp ?? 0) > 0 && o.side === tgt.side && Math.max(Math.abs(o.x - tgt.x), Math.abs(o.y - tgt.y)) <= 1);
        if (shelter) { mult *= 0.5; notes.push(`${tgt.name} shelters beside the ${shelter.name} (×0.5).`); } }
      const hasAdaptation = tgt.primary === "adaptation" || tgt.secondary === "adaptation";
      const countKey = `${tgt.id}:${damageType}`;
      const hitCount = (s.turnDamageCounts[countKey] || 0) + (potency > 0 ? 1 : 0);
      if (potency > 0) s.turnDamageCounts[countKey] = hitCount;
      const autoRules = C.rules.adaptationAutoAttune || { secondHitMultiplier: 0.75, laterHitMultiplier: 0.5, stackingFloor: 0.4 };
      const autoMultiplier = isTakeoffUnit(tgt) ? 1 : hasAdaptation && hitCount >= 3 ? autoRules.laterHitMultiplier : hasAdaptation && hitCount === 2 ? autoRules.secondHitMultiplier : 1;
      let braceMultiplier = 1, physicallyBlocked = false;
      if (inst?.directHit && tgt.status.guard) notes.push(`Direct hit: ${tgt.name}'s guard cannot answer the unpredictable blow.`);
      if (inst?.bypassGuard && tgt.status.guard) notes.push(`Stored energy isn't the original hit: ${tgt.name}'s guard can't answer the release.`);
      if (tgt.status.guard && !inst?.directHit && !inst?.bypassGuard) {
        const guard = tgt.status.guard;
        if (guard.damageType) {
          if (damageType === guard.damageType && gl?.skipBrace) {
            notes.push(`Adaptive Brace is attuned to ${C.damageTypes[damageType]?.name || damageType}, but this hit slips past it.`);
          } else if (damageType === guard.damageType) {
            braceMultiplier = guard.multiplier || s.rules.guardMultiplier;
            notes.push(`Adaptive Brace resists ${C.damageTypes[damageType]?.name || damageType}: ×${braceMultiplier}.`);
            if (!hasAdaptation) mult *= braceMultiplier;
          } else notes.push(`Adaptive Brace is tuned to ${C.damageTypes[guard.damageType]?.name || guard.damageType}; this ${C.damageTypes[damageType]?.name || damageType} hit is unaffected.`);
        } else {
          let guardMultiplier = guard.multiplier ?? s.rules.guardMultiplier;
          { const er = ClassRuntime?.Teleology?.guardErode(s, src, tgt, guardMultiplier); if (er) { guardMultiplier = er.mult; notes.push(er.note); } }   // Nova Sovereign Guarantee: the guard slips, once
          physicallyBlocked = !!(src && src.side !== tgt.side && (inst || s.actors[src.id] || s.wild?.some(u => u.id === src.id)) && potency > 0 && mult > 0 &&
            roundFn(s)(potency * mult) > roundFn(s)(potency * mult * guardMultiplier));
          mult *= guardMultiplier; notes.push(`${tgt.name} is guarding: ×${guardMultiplier}.`);
        }
      }
      if (autoMultiplier < 1) notes.push(`Adaptation auto-attunes to repeated ${C.damageTypes[damageType]?.name || damageType} hits this turn (hit ${hitCount}): ×${autoMultiplier}.`);
      // Craftsmanship [opp-adaptation-reads-the-habit]: what is done the same way every time is the easiest thing to prepare
      // for. Against a target that has adapted to this channel, practice counts as bluntedCap stacks.
      { const K = C.concepts.craftsmanship?.craft, st = src?.practice && inst?.ability && src.practice.ability === inst.ability ? src.practice.stacks : 0;
        if (K && st > K.bluntedCap && hasAdaptation && (autoMultiplier < 1 || braceMultiplier < 1)) { mult *= (1 + K.perStack * K.bluntedCap) / (1 + K.perStack * st); notes.push(`Adaptation reads the habit: ${st} practice counts as ${K.bluntedCap} [opp-adaptation-reads-the-habit].`); } }
      if (hasAdaptation && (autoMultiplier < 1 || braceMultiplier < 1)) {
        // Adaptation can combine passive learning with an active Brace, but never
        // reduces a hit below 40% before unrelated modifiers such as cover.
        mult *= Math.max(autoRules.stackingFloor, autoMultiplier * braceMultiplier);
        if (autoMultiplier < 1 && braceMultiplier < 1) notes.push("Adaptation + Adaptive Brace stacking is capped at ×0.4 damage.");
      }
      // Coup de grace: a strike-class hit on a fleeing dread-marked unit lands ×2 and
      // consumes the dread (one-shot; the visage must gaze again). Visage in conditions.js.
      if (tgt.routed && tgt.status?.dread && potency > 0 && (!inst?.ability || inst.ability === "strike")) {
        mult *= 2; delete tgt.status.dread;
        notes.push(`Coup de grace: ${tgt.name} flees in dread — the strike lands ×2.`);
      }
      // AGI Takeoff ledger: replaces generic autoAttune for this unit. The mult comes from
      // exposures BEFORE this hit; the hit then records (deception counts double and teaches
      // every other seen track faster).
      if (isTakeoffUnit(tgt) && potency > 0) {
        const tk = takeoffOf(tgt), tkey = takeoffConceptOf(inst), tname = C.concepts?.[tkey]?.name || (tkey === "strike" ? "strikes" : tkey);
        const lm = takeoffMult(tk.exp[tkey] || 0, tkey);
        if (lm !== 1) { mult *= lm; notes.push(lm === 0 ? `${tgt.name} is immune to ${tname}: no damage.` : `Adaptation ledger learns ${tname} (seen ${tk.exp[tkey] || 0}×): ×${lm}.`); }
        if (!tk.paced) { tk.paced = true; const gain = tgt.maxLF; tgt.maxLF = gain * 2; tgt.lf = Math.min(tgt.maxLF, tgt.lf + gain); notes.push(`${tgt.name}'s takeoff chassis doubles its LF to ${tgt.maxLF} (boss pacing).`); }
        tk.exp[tkey] = (tk.exp[tkey] || 0) + (tkey === "deception" ? 2 : 1);
        if (tkey === "deception") for (const k of Object.keys(tk.exp)) if (k !== tkey) tk.exp[k] += 1;
        if (tk.exp[tkey] >= 5 && !tk.immune.includes(tkey)) {
          tk.immune.push(tkey);
          log(s, { kind: "adapt", actor: tgt.id, concept: tkey, text: `${tgt.name} understands ${tname} now — immune.`, why: [`Adaptation ledger: ${tkey} completed at 5 exposures.`] });
          if (tkey === "deception" && !tk.taught) { tk.taught = s.round; tgt.learned ||= []; if (!tgt.learned.includes("feint")) tgt.learned.push("feint"); }
        }
        if (!tk.transcended && (tk.immune.length >= 2 || takeoffBonus(tgt) >= 6)) { tk.transcended = s.round; log(s, { kind: "transcend", actor: tgt.id, text: `${tgt.name} transcends: every opponent now fears it most.`, why: ["2 immunities or takeoff +6: fear aggro."] }); H.PostHuman.join(s, tgt); }
        if (tk.transcended && !tk.completed && tk.immune.length >= 4 && takeoffBonus(tgt) >= 10) { tk.completed = s.round; log(s, { kind: "effect", actor: tgt.id, text: `${tgt.name} completes its takeoff: the bonus doubles. Run.`, why: ["4 immunities and takeoff +10: the runaway bad end."] }); }
      }
      if (src && tgt.exploited?.by === src.id && tgt.exploited.damageType === damageType) { mult *= tgt.exploited.multiplier; notes.push(`Observed weakness exploited: ${C.damageTypes[damageType]?.name || damageType} damage ×${tgt.exploited.multiplier}.`); tgt.exploited = null; }
      if (src && tgt.status.tauntProtection?.source === src.id) { mult *= tgt.status.tauntProtection.multiplier; notes.push(`Taunt braces against this source: damage ×${tgt.status.tauntProtection.multiplier}.`); }
      if(tgt.status.exposed&&src?.id!==tgt.status.exposed.owner){mult*=1.25;notes.push(tgt.status.exposed.why||"Long View leaves its caster exposed: incoming damage ×1.25 until their next turn.");}
      if(tgt.status.attention&&src?.id!==tgt.status.attention.target){mult*=1.25;notes.push("Inattentional blindness: an attacker outside the attended target deals ×1.25 damage.");}
      if(tgt.status.immovable&&damageType==="nigredo"){mult*=0.8;notes.push("Immovable blunts impact damage ×0.8.");}
      // Dense Muscle (Mala, 2026-10-19): ×0.8 to everything but piercing — the Albedo channel ("· piercing")
      // and piercing-quality blows (rite-sealed) punch through. Ward absorbs first (external), muscle after.
      if (potency > 0 && H.hasTrait(tgt, "denseMuscle")) {
        if (damageType === "albedo" || inst?.piercing) notes.push("Piercing: dense muscle cannot turn it.");
        else { mult *= 0.8; notes.push("Dense Muscle turns most of the blow ×0.8."); }
      }
      { const fm = potency > 0 ? H.fruitTakenMul?.(s, tgt, inst, damageType) : null; if (fm) { mult *= fm.mul; notes.push(...fm.notes); } }   // Sinkerfruit: Drained, Coil's give (engine/fruit.js)
      const dealtMul = src?.passives?.channelDealtMul?.[damageType] || 1;   // MJ items: attacker-side channel boost (channelDamageMul is read on the TARGET, so >1 there would hurt the wearer)
      if (dealtMul !== 1 && potency > 0) { mult *= dealtMul; notes.push(`${src.name}'s gear lends ${C.damageTypes[damageType]?.name || damageType} damage ×${+dealtMul.toFixed(2)}.`); }
      const channelMul = tgt.passives?.channelDamageMul?.[damageType] || 1;
      if (channelMul !== 1) { mult *= channelMul; notes.push(channelMul < 1 ? `Protection reduces ${C.damageTypes[damageType]?.name || damageType} damage ×${+channelMul.toFixed(2)}.` : `A critical weakness to ${C.damageTypes[damageType]?.name || damageType}: ×${+channelMul.toFixed(2)}.`); }
      if (tgt.status.lawsProtection?.expiresAt > tgt.ownerTurns) { mult *= tgt.status.lawsProtection.multiplier; notes.push(`The King's Law reduces damage ×${tgt.status.lawsProtection.multiplier}.`); }
      if (tgt.status.rememberedThreats?.expiresAt > tgt.ownerTurns && s.mirror?.channelsUsed?.includes(damageType)) { mult *= tgt.status.rememberedThreats.multiplier; notes.push(`Remembered Threats resists a previously seen channel ×${tgt.status.rememberedThreats.multiplier}.`); }
      if (opts.damageMul && opts.damageMul !== 1) { mult *= opts.damageMul; notes.push(`Equipment changes this hit ×${opts.damageMul}.`); }
      if (inst?.holy && s.rules.holy && isFell(tgt)) { mult *= s.rules.holy.fellMul; notes.push(`Holy power: ${tgt.name} is a dream creature, a summon or one of the fell ×${s.rules.holy.fellMul}.`); }   // docs/holy.md
      const dreamMods = dreamSpaceRules?.modsFor(tgt, s.dreamSpace, s.arena.objects) || {};
      { const ogMul = tgt.dream ? (OG()?.dreamDamageMul?.(src, tgt, s.arena.objects) || 1) : 1; if (ogMul !== 1) { mult *= ogMul; notes.push(`Orgonite grounds the dream: damage ×${ogMul}.`); } }
      if (dreamMods.damageTakenMul && dreamMods.damageTakenMul !== 1) { mult *= dreamMods.damageTakenMul; notes.push(`Dream Space shields its summon: damage ×${dreamMods.damageTakenMul}.`); }
      if (tgt.form?.golden) { const gm = bossRules?.data?.integratedSelf?.damageTakenMul ?? 0.75; mult *= gm; notes.push(`The Integrated Self takes ×${gm} damage.`); }
      let formFlat = 0;
      { const gd = potency > 0 ? ClassRuntime?.homology?.guard(s, src, tgt, inst) : 0; if (gd) { formFlat -= gd; notes.push(`Ancestral Guard: ${gd} off the damage to ${tgt.name} (a guarded technique).`); } }   // Homology H5: the first cast of a guarded technique, once
      if (bossRules?.formDamage && (tgt.form?.learned || src?.form?.learned)) { const fd = bossRules.formDamage(src, tgt, inst, damageType, potency); mult *= fd.mul; formFlat += fd.flat; notes.push(...fd.notes); }   // learned forms
      // Ceaseless Adaptation (the Cyborg form, docs/brain-chip.md): the count lives on the form, one number per damage
      // type, for as long as the form lasts. Never an immunity. Adaptation's own auto-attune takes its place if he has it.
      if (tgt.form?.adaptation && potency > 0) {
        const K = tgt.form.adaptation, seen = (tgt.form.hits ||= {}), n = (seen[damageType] || 0) + 1; seen[damageType] = n;
        if (n >= K.fromHit && !hasAdaptation && H.hasTrait(tgt, "ceaselessAdaptation")) { mult *= K.mul; notes.push(`Ceaseless Adaptation: ${C.damageTypes[damageType]?.name || damageType} hit ${n} of this form, ×${K.mul}.`); }
      }
      if (inst?.concept === "diffusion" && vegetation?.shadesDiffusion?.(s.arena, tgt.x, tgt.y)) {
        mult *= 0.5;
        notes.push("Kou canopy shade halves Diffusion damage at this tile.");
      }
      // Godly Agility (biology): a rolled 25-100% of every attack and technique slides off him — unless it lands direct.
      if (potency > 0 && src && H.hasTrait(tgt, "godlyAgility")) {
        if (inst?.directHit) notes.push("Direct hit: not even godly agility finds an angle on it.");
        else { s.godlyN = (s.godlyN || 0) + 1;
          const slip = 0.25 + H.seededChance(`${s.seed}:godly:${tgt.id}:${s.godlyN}`) * 0.75;
          mult *= (1 - slip); notes.push(`Godly agility: ${Math.round(slip * 100)}% of the blow never touches him.`); }
      }
      let dmg = Math.max(flatHolds ? 1 : 0, roundFn(s)(potency * mult) + (potency > 0 ? formFlat : 0)), warded = 0, wardBroke = false, wardHide = false;
      EmergentIdeas?.syncSummonWards(s);
      if (dmg > 0 && src && src.id !== tgt.id && !opts.bleedOut) H.mysteryBeforeHit?.(s, tgt, src);   // Battle Cards C2: a "before" set card (a ward) springs ahead of the ward check below
      if (inst?.directHit && tgt.status.ward && dmg > 0) notes.push(`Direct hit: the ward cannot catch what it cannot read (${tgt.status.ward.protection} protection untouched).`);
      if (inst?.piercing && tgt.status.ward && dmg > 0) notes.push(`Piercing: the strike passes through the ward (${tgt.status.ward.protection} protection untouched).`);
      const willThroughHide = !!(inst?.carriesWill && tgt.status.ward?.hide && dmg > 0);   // Mala 2026-11-02: Steel will goes through a borrowed hide (Hidefruit counter)
      if (willThroughHide) notes.push(`Steel will: the blow goes through the borrowed hide (${tgt.status.ward.protection} protection untouched).`);
      if (tgt.status.ward && dmg > 0 && !inst?.directHit && !inst?.piercing && !willThroughHide) {
        const w = tgt.status.ward; const absorbed = Math.min(w.protection, dmg); warded = absorbed; wardHide = !!w.hide; wardBroke = w.protection - absorbed <= 0;
        w.protection -= absorbed; dmg -= absorbed;
        notes.push(`${w.label || "Fortress ward"} absorbs ${absorbed} (${w.protection} left).`);
        if (w.protection <= 0) { tgt.status.ward = null; notes.push("The ward breaks."); }
        else if (w.gazeCover) { tgt.status.ward = null; notes.push("The projected gaze spends itself on the one shot."); }   // W1c cover: a projection stops one shot even when it has protection to spare
      }
      const collageWard=activeTerrainEffect(s,"pastedFragment",tgt.x,tgt.y);
      if(collageWard?.fragment?.kind==="wallProtection10"&&dmg>0){const absorbed=Math.min(collageWard.fragment.value?.protection||10,dmg);dmg-=absorbed;collageWard.fragment.value.protection=(collageWard.fragment.value.protection||10)-absorbed;notes.push(`Pasted wall fragment absorbs ${absorbed} damage (${collageWard.fragment.value.protection} protection remains).`);if(collageWard.fragment.value.protection<=0)s.terrainEffects=s.terrainEffects.filter(e=>e!==collageWard);}
      if (dmg >= 6 && (tgt.passives?.wobble || tgt.character === "tofu_yokai") && s.wobbleUsed?.[tgt.id] !== s.round) {   // Wobble: soft curd absorbs the first hard hit each round (kaiba-shaped grant: no brief-passive path for enemies yet)
        (s.wobbleUsed ||= {})[tgt.id] = s.round;
        dmg = Math.max(0, dmg - 2);
        notes.push(`${tgt.name} wobbles: soft curd absorbs 2 of the blow (first hard hit this round).`);
      }
      { const napa = dmg > 0 && H.Communion?.totemAura?.(s, tgt, "hitLess", H.dist);   // Napa Totem (ingredient totems T2): its leaves take 2 off every hit on an ally within 2, never below 1
        if (napa && dmg > napa.def.hitFloor) { const cut = Math.min(napa.def.hitLess, dmg - napa.def.hitFloor); dmg -= cut; notes.push(`${napa.totem.name}: −${cut} (its leaves layer over ${tgt.name}).`); } }
      let parachute = false;
      if (dmg > 0 && tgt.form?.learned && bossRules?.formBeforeApply) { const pb = bossRules.formBeforeApply(tgt, dmg); if (pb.release) { dmg = pb.dmg; parachute = true; tgt.parachuteUsed = true; notes.push("Golden Parachute: the form gives out before the founder does."); } }
      if (dmg > 0 && dmg >= tgt.lf && tgt.passives?.surviveLethalOnce && !tgt.bristleconeUsed) {
        dmg = Math.max(0, tgt.lf - 1); tgt.bristleconeUsed = true;
        notes.push("Bristlecone ring strips bark to survive this lethal hit once, leaving 1 LF.");
      }
      if (dmg > 0 && dmg >= tgt.lf && tgt.sagaWard && !tgt.sagaEndingRefused) {   // J6 Refuse the Ending: a warded saga refuses its ending, once
        dmg = Math.max(0, tgt.lf - 1); tgt.sagaEndingRefused = true; tgt.sagaWard = false;
        notes.push(`${tgt.name}'s saga refuses to end: death turned aside at 1 LF.`);
      }
      { const ll = dmg > 0 && dmg >= tgt.lf && tgt.lf > 0 && H.Communion?.totemAura?.(s, tgt, "longLife", H.dist);   // Noodle Totem, Long Life (T2): after the unit's own survive-at-1 effects above, once per totem
        if (ll) { dmg = Math.max(0, tgt.lf - 1); ll.host.totem = null; notes.push(`Long Life: the ${ll.totem.name} keeps ${tgt.name} standing at 1 LF, then goes back to sleep.`); } }
      let sharedVictims = [];
      const burden = tgt.status.sharedBurden;
      if (dmg > 0 && burden?.expiresAt > tgt.ownerTurns) {
        const members = Object.values(s.actors).filter(u => !u.defeated && u.side === tgt.side && u.status.sharedBurden?.group === burden.group && u.status.sharedBurden.expiresAt > u.ownerTurns);
        if (members.length > 1) {
          const total = dmg, each = Math.floor(total / members.length), extra = total % members.length;
          const shareOf = new Map(members.map((u, i) => [u.id, each + (i < extra ? 1 : 0)]));
          // Mitsuko MAX (MX1): a carried link sends its most-hurt member's share to the carrier (never the other way).
          const carrier = burden.carrier && members.find(u => u.id === burden.carrier);
          const weakest = carrier && members.filter(u => u !== carrier).sort((a, b) => a.lf / (a.maxLF || 1) - b.lf / (b.maxLF || 1) || (a.id < b.id ? -1 : 1))[0];
          const carried = !!(weakest && shareOf.get(weakest.id) > 0);
          if (carried) {
            shareOf.set(carrier.id, shareOf.get(carrier.id) + shareOf.get(weakest.id)); shareOf.set(weakest.id, 0);
            notes.push(`${carrier.name} carries ${weakest.name}'s share of the link.`);
          }
          sharedVictims = members.filter(u => u !== tgt && !(carried && u === weakest));   // as before, every other member takes its share (even 0); only the carried member is skipped
          dmg = shareOf.get(tgt.id);
          sharedVictims.forEach((u, i) => {
            const share = shareOf.get(u.id), beforeShare = u.lf;
            u.lf = Math.max(0, u.lf - share); u.lastDamageType = damageType; concentrationCheck(s, u, beforeShare - u.lf); H.Instinct.painCheck(s, u, beforeShare - u.lf);
            if (src?.id && src.id !== u.id && beforeShare > u.lf) u.lastHit = { by: src.id, round: s.round };   // C6 retaliation: remember who hurt you
            if (potency > 0 && beforeShare > u.lf) u.ego = Math.min(1, Math.max(0, (u.ego ?? 0.5) - (mult >= 0.99 ? 0.12 : 0.03)));   // C7 ego
            if(beforeShare>u.lf) u.pain={v:Math.min(1,(u.pain?.v||0)*Math.pow(0.5,Math.max(0,s.round-(u.pain?.round||s.round)))+(beforeShare-u.lf)/(u.maxLF||30)),round:s.round};
            log(s, { kind: "damage", actor: src?.id || null, target: u.id, at: [u.x,u.y], amount: beforeShare-u.lf, damageType,
              text: carried && u === carrier ? `${u.name} carries ${beforeShare-u.lf} LF of the blow through the link, ${weakest.name}'s share included.` : `${u.name} shares ${beforeShare-u.lf} LF of the blow through ${summonRules?.data?.summons?.mitsuko?.name || "Mitsuko"}'s link.`,
              why: [`${total} post-mitigation LF was split among ${members.length} linked allies${carried ? `; ${carrier.name} took ${weakest.name}'s share` : ""}.`] });
          });
          notes.push(`Shared Burden distributes ${total} damage across ${members.length} linked allies.`);
        }
      }
      const before = tgt.lf;
      if (tgt.form?.golden && bossRules) {
        const formHit = bossRules.damageForm(tgt, dmg); Object.assign(tgt, formHit.player); dmg = formHit.absorbed;
        for (const ev of formHit.events) log(s, ev);
        shedFragment(s, tgt, formHit.absorbed);
      } else if (isMonster(tgt)) {
        let left = tgt.lf - dmg;
        if (left <= 0 && tgt.passive === "immortal" && !EM.sunlit(tgt.x, tgt.y, monsterCtx(s))) { left = 1; notes.push("Immortal: out of the sun, it cannot be finished."); }
        tgt.lf = Math.max(0, left);
        if (tgt.lf === 0 && tgt.passive === "reassemble") tgt.scattered = tgt.drawback === "brittle" && damageType === "nigredo";   // bones scattered by impact stay down
      } else tgt.lf = Math.max(0, tgt.lf - dmg);
      if (s.sealedFight && tgt.boss === "sealednext") {
        s.sealedFight.lf = tgt.lf;
        if (tgt.lf <= 0) {
          const SN = typeof module === "object" && module.exports ? require("../sealed-next.js") : globalThis.ConceptCombatSealedNext;
          SN?.ownerDown?.(s.sealedFight);
        }
      }
      if (tgt.lf === 0 && tgt.status?.submission && src && s.actors[tgt.status.submission.by]?.side === src.side) { tgt.lf = 1; notes.push("Pressed for a submission: the hunt is for surrender, not a kill."); }
      if (dmg > 0) H.Tourist?.hurt(s,tgt,dmg,H.touristH());
      if(before>tgt.lf) tgt.pain={v:Math.min(1,(tgt.pain?.v||0)*Math.pow(0.5,Math.max(0,s.round-(tgt.pain?.round||s.round)))+(before-tgt.lf)/(tgt.maxLF||30)),round:s.round};
      // (pocket model: snap-back is a concentration roll now — the soul channel in concentrationCheck below.)
      tgt.lastDamageType = damageType;
      const riteRider = inst?.riteBleed ?? (src?.riteAugment?.checked?.[inst?.ability] ? src.riteAugment.bleedRider : 0);
      const knife = !(riteRider > 0) && inst?.ability === "strike" ? src?.passives?.strikeBleed : null;   // Chef Knives: a landed Strike opens the same wound (drain 2, 2 turns), same replace rule
      if ((riteRider > 0 || knife?.drain > 0) && before > tgt.lf && !tgt.defeated) {   // Rites (Muse-2): blood-sealed techniques open the victim — gated on dealt, per the ward ruling
        const rider = riteRider > 0 ? riteRider : knife.drain, turns = riteRider > 0 ? 2 : (knife.turns ?? 2), cur = tgt.status.bleed;
        if (!cur || (cur.drain ?? 0) < rider) {
          tgt.status.bleed = { drain: rider, until: tgt.ownerTurns + turns, owner: src.id };
          log(s, { kind: "bleed", actor: tgt.id, text: riteRider > 0 ? `${tgt.name} bleeds from the rite-sealed wound (${rider} LF a turn, 2 turns).` : `${tgt.name} bleeds from the knife wound (${rider} LF a turn, ${turns} turns).` });
        }
      }
      if (src?.id && src.id !== tgt.id && before > tgt.lf) tgt.lastHit = { by: src.id, round: s.round };   // C6 retaliation: remember who hurt you
      // C7 ego / self-respect (muse sandbox batch 6). Landing an attack lifts the attacker; a whiff costs more than a hit
      // gives. Being hit clean costs the defender; a mitigated hit (guard, adaptation, edges, climate: mult < 1) costs little.
      // Gated on potency so builders and healers do not bleed ego. Read by ai/workflow.js: bold >= 0.7, cowed <= 0.3.
      if (src?.id && src.id !== tgt.id && potency > 0) {
        const landed = before > tgt.lf || sharedVictims.some(u => u.lastHit?.by === src.id && u.lastHit.round === s.round);
        src.ego = Math.min(1, Math.max(0, (src.ego ?? 0.5) + (landed ? 0.08 : -0.15)));
      }
      if (potency > 0 && before > tgt.lf) tgt.ego = Math.min(1, Math.max(0, (tgt.ego ?? 0.5) - (mult >= 0.99 ? 0.12 : 0.03)));
      // The Perimeter Guardian's true form (summons-data.js trueForm.adapt): a type that wounds it is resisted a step more from then on.
      const adapt = tgt.trueFormTraits?.includes("whatHuntedMe") && tgt.lf > 0 && before > tgt.lf ? summonRules?.data.summons[tgt.summon?.key]?.trueForm?.adapt : null;
      if (adapt) {
        const now = tgt.passives?.channelDamageMul?.[damageType] ?? 1, next = Math.max(adapt.floor, +(now * adapt.perHit).toFixed(4));
        if (next < now) {
          tgt.passives = { ...(tgt.passives || {}), channelDamageMul: { ...(tgt.passives?.channelDamageMul || {}), [damageType]: next } };
          log(s, { kind: "adapt", actor: tgt.id, text: `${tgt.name} learns the shape of that: ${C.damageTypes[damageType]?.name || damageType} damage to it is now ×${+next.toFixed(2)}.` });
        }
      }
      if (potency > 0 && before > tgt.lf && mult >= 0.99) fearCheck(s, tgt, src);   // C8: a clean hit on someone already cowed may rout them
      if (tgt.boss && bossRules && tgt.lf > 0) {
        const enraged = bossRules.afterDamage(tgt, { bossRush: !!s.bossRush }); Object.assign(tgt, enraged.actor);
        for (const id of enraged.events.flatMap(ev => ev.unlocked || []).map(k => `boss_${tgt.boss}_${k}`)) if (!tgt.bossAbilityIds.includes(id)) tgt.bossAbilityIds.push(id);
        for (const ev of enraged.events) log(s, ev);
        if (tgt.boss === "gaia" && tgt.conditions?.enraged && tgt.gaiaForm === "restored") H.setGaiaForm(s, tgt, "disturbed", "Enraged: she drops the accord.");
        if (H.Tally?.is(tgt)) H.Tally.afterHit(s, tgt, before - tgt.lf, src);   // the books burn once (engine/tally.js)
      }
      // Synthetic basic-tier hits (for example an aura pulse) are not copyable techniques.
      if(inst?.tier==="basic"&&ab(inst.ability)?.tier==="basic"&&dmg>0&&tgt!==src)tgt.lastBasicHit={ability:inst.ability,source:src?.id,atOwnerTurn:tgt.ownerTurns};
      if (parachute && tgt.form?.learned) { const r = bossRules.releaseForm(tgt, { reason: "parachute" }); const hs = "sprite" in r.player; Object.assign(tgt, r.player); if (!hs) delete tgt.sprite; tgt.form = null; for (const ev of r.events) log(s, ev);
        const ctx = H.formCtx(s, tgt), away = src ? [Math.sign(tgt.x - src.x), Math.sign(tgt.y - src.y)] : [0, 0];   // Golden Parachute: a free 2-tile exit, away from the hit
        for (let n = 0, x = tgt.x, y = tgt.y; n < bossRules.data.learnedForms.traits.parachuteMove && (away[0] || away[1]); n++) { x += away[0]; y += away[1]; if (!ctx.free(x, y)) break; tgt.x = x; tgt.y = y; }
        log(s, { kind: "effect", actor: tgt.id, tiles: [[tgt.x, tgt.y]], text: `${tgt.name} glides clear to (${tgt.x},${tgt.y}).` }); }
      if (bossRules?.wantsLarva && dmg > 0 && !tgt.defeated && bossRules.wantsLarva(tgt, dmg, Object.values(s.actors).filter((u) => !u.defeated && u.companion?.key === "brood_larva" && u.companion.owner === tgt.id).length)) H.spawnFormLarva(s, tgt);   // Broodmind
      const applied = dmg, remaining = tgt.form?.golden ? `${tgt.form.lf}/${tgt.form.maxLF} gold LF` : `${tgt.lf}/${tgt.maxLF}`;
      // warded: what a ward took off this hit (structured, so the map and the duel scene can show it; Muse 2026-10-10).
      log(s, { kind: "damage", actor: src ? src.id : null, target: tgt.id, at:[tgt.x,tgt.y], amount: applied, lfLost: Math.max(0, before - tgt.lf), ability: inst && inst.ability, ...(warded ? { warded, wardBroke } : {}),
        damageType, text: `${opts.label || (inst ? inst.name : "Hit")} → ${tgt.name}: ${applied} LF (${remaining}) · ${C.damageTypes[damageType]?.name || damageType}.`, why: notes, edge: opts.edge });
      ClassRuntime?.Martial?.onDamage(s, src, tgt, Math.max(0, before - tgt.lf), classH());   // Martial Artist: fight counters, charge/feast spill
      if (src && dmg > 0 && !s.preview) { const OD = typeof module === "object" && module.exports ? require("../spirit/orders.js") : globalThis.ConceptCombatOrders; OD?.onHit(s, src, tgt, dmg, H); }   // admiration: a big shot writes the ledger
      if (inst?.holy && src && tgt !== src && dmg > 0 && !s.preview && s.rules.holy) {   // docs/holy.md: holy power struck in plain sight, so skeptics may start to believe and the strikers' side may be inspired
        const hp = ClassRuntime?.holyOf?.(src, s.rules.holy.maxStep) || { step: 0, live: true };
        // Everyone with sight of the target but the striker and the target: a skeptic who is himself struck, or who strikes, must not witness this blow (the witness step swaps that actor's object in s.actors mid-resolution, and hit() keeps writing to the old one).
        const seers = Object.values(s.actors).filter((u) => u.id !== src.id && u.id !== tgt.id && !u.defeated && H.hasSight(s, u.x, u.y, tgt.x, tgt.y)).map((u) => u.id);
        log(s, { kind: "holySmite", actor: src.id, target: tgt.id, tiles: [[tgt.x, tgt.y]], visibleTo: seers, text: `${src.name}'s ${inst.name || "blow"} strikes with holy power, and it is seen.` });
        if (hp.live) H.Inspiration?.witness(s, src, "seesSmite", src.id, { side: src.side, chance: (s.rules.inspiration?.chance?.seesSmite ?? 0.1) + s.rules.holy.holyStep * hp.step, tier: hp.step });
      }
      if (tookFor && dmg > 0 && !s.preview) { const OD = typeof module === "object" && module.exports ? require("../spirit/orders.js") : globalThis.ConceptCombatOrders; OD?.onProtect(s, tookFor, H); }   // admiration: the intercept ate it for a friend
      if (physicallyBlocked) H.Support.grant(s, tgt, "block", "physically blocking an incoming attack");
      if (before > tgt.lf) { concentrationCheck(s, tgt, before - tgt.lf); H.Instinct.painCheck(s, tgt, before - tgt.lf); }   // after the damage line: a hit that gets through tests focus (a fully warded one does not)
      if (src && tgt.summon?.pact && src.id === tgt.summon.pact.owner && src.id !== tgt.id && tgt.lf < before && !tgt.defeated && s.pactActive?.line === tgt.summon.pact.line) {
        const pl = tgt.summon.pact.line; s.pactActive = null; tgt.defeated = true; tgt.defeatedBy = src.id;
        (s.pactCodes ||= []).push({ type: "pactBreach", line: pl, kind: "friendly-fire" });
        log(s, { kind: "summon", actor: tgt.id, text: `${tgt.name} storms home: struck by its own caller. The pact is BROKEN.` });
      }
      if (dmg > 0 || warded > 0) H.fruitAfterHit?.(s, src, tgt, damageType, inst, { dmg, warded, wardHide });   // Sinkerfruit (respec S2a, S1b): Ripe Coilfruit answers an impact hit; the hide and the borrowed move earn feats
      if (tgt.lf <= 0 && !tgt.defeated && !gentleSpare(s, src, tgt) && !H.States?.beforeDefeat(s, tgt, classH()) && !H.transmigrate?.(s, tgt)) {   // the Tamer wakes in his vessel   // Bonds: The Retinue Rises   // Martial Artist: zenkai survival (Mala, 2026-10-22)
        tgt.defeated = true; delete tgt.status.playingDead; tgt.defeatedBy = src && src.id !== tgt.id ? src.id : null; for (const e of (H.Sealing?.onSealerDown?.(s, tgt) || [])) log(s, { kind: "seal", actor: e.foe, text: e.text });   // the killer, for the corpse (ritual burial; revenge later)   // W2.3: a dead sealer's binds drop
        H.pactLeave(s, tgt);   // a pact summon falls: downed, no standing; kill the caller: the call ends
        { const Spirit = (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null; Spirit?.onDeath?.(s, tgt, src && src.id !== tgt.id ? src.id : null, H); }   // group spirit: a fallen leader shocks now (SPIRIT-ORDER SPEC)
        { const OD = typeof module === "object" && module.exports ? require("../spirit/orders.js") : globalThis.ConceptCombatOrders; OD?.onDeath(s, tgt, H); }   // admiration: first falls, adjacent losses, ordered falls
        if (tgt.form?.golden) { delete tgt.form.golden; log(s, { kind: "form", target: tgt.id, text: `${tgt.name}'s gold falls away: defeat strips the form.`, why: ["EM1: gold is a form you visit — the knocked-out renders base."] }); }   // EM1 defeat-revert
        if (tgt.possessedByCourt) H.courtVesselFell?.(s, tgt);   // the body dies as itself; the court steps out
        ClassRuntime?.Martial?.onDefeat(s, tgt, classH());   // Martial Artist: an ally's fall in her sight is rage
        if (tgt.boss === "worldGoddess") H.courtGoddessFell?.(s);
        { const tamer = tgt.beast?.owner && s.actors[tgt.beast.owner]; if (tamer?.vessel === tgt.id) { tamer.vessel = null;   // the Tamer's mark fizzles (engine/tamer.js)
          log(s, { kind: "vessel", actor: tamer.id, target: tgt.id, fizzled: true, text: `${tamer.name}'s vessel falls: the mark fizzles, and his fear comes back.`, why: ["Unmarked, his next fall is his last, unless he tames and marks another."] }); } }
        // A sin against Gaia (engine/land.js), unless a communed plant did it: two of her own fighting is siblings
        // scrapping, so the best answer to a communer is to commune in defense (Mala, 2026-10-14).
        if (tgt.communed && src && src.side !== tgt.side && !src.communed) H.landWound(s, src, "communedKilled", 1, [[tgt.x, tgt.y]]);
        if (tgt.side === "player" && tgt.id === (s.modeSetup?.hero || "player")) heroFell(s, tgt);   // allies may lose heart
        if (tgt.id === (s.modeSetup?.hero || "player")) (s.dreamRecent ||= {}).heroFell = true;   // ambient dreams hear the hero fall
        if (Parley && Parley.isImmortal(tgt)) tgt.knockedOut = true;   // Immortal (Mala, 2026-10-08): knocked out, never killed
        if (H.Dispatch) H.Dispatch.onDefeat(s, H, tgt);
        log(s, { kind: "defeat", target: tgt.id, text: tgt.knockedOut ? `${tgt.name} is knocked out. Immortal: down, not dead.` : `${tgt.name} is defeated.` });
        H.broodBeadDrop(s, tgt, src);                                               // a Brood Mite felled after its mother: a 5% bead
        H.riseOnDeath(s, tgt);                                                      // rules.risesOnDeath: a Pharaoh's Mummy
        tryDeathDoor(s, tgt);                                                       // summons: an unbidden defender may arrive
        if (tgt.boss && s.vignette && bossRules?.dropOrb) { s.vignette.bossOrb = bossRules.dropOrb(tgt); log(s,{kind:"bossReward",actor:tgt.id,text:`${bossRules.data.orbs[s.vignette.bossOrb]?.name || "A boss orb"} falls from ${tgt.name}.`}); }
        // The Brain Chip (docs/brain-chip.md): one falls from an AGI defeated after it transcended; a climbing one drops nothing.
        if (tgt.character === "agi" && tgt.takeoff?.transcended) { s.brainChips = (s.brainChips || 0) + 1; log(s, { kind: "brainChip", actor: tgt.id, tiles: [[tgt.x, tgt.y]], text: `The Brain Chip falls from ${tgt.name}.`, why: ["It transcended before it fell. The chip is kept if this battle is won."] }); }
        lootDrop(s, src, tgt);   // loot v1: the fallen may drop consumables (killer's hands or the ground)
        if (tgt.summon?.order) { tgt.summon.order = null; tgt.summon.holdPosition = false; log(s, { kind: "summonOrder", actor: tgt.id, text: `${tgt.name}'s committed ultimate is cancelled because the summon fell before its next turn.` }); }
        if (tgt.dream?.key) recordMirrorEvent(s, { kind: "dream", monster: tgt.dream.key, via: "defeat" });
        s.barriers = s.barriers.filter((b) => b.owner !== tgt.id);
        for (const t of Object.values(s.actors)) for (const k of Object.keys(t.status)) if (t.status[k] && t.status[k].owner === tgt.id) t.status[k] = null;
        for (const ev of s.scheduled.filter((e) => e.owner === tgt.id)) log(s, { kind: "cancel", text: `${tgt.name}'s pending ${ev.inst.name} is cancelled (its owner fell).` });
        s.scheduled = s.scheduled.filter((e) => e.owner !== tgt.id);
        checkOutcome(s);
      }
      if (tgt.defeated && src) H.fruitKilled?.(s, src, tgt, inst);   // Sinkerfruit (respec S1b): a kill the engine let stand, with the borrowed move
      if (src && tgt && src.id !== tgt.id && s.actors[src.id]) H.mysteryAttacked?.(s, tgt, src, before - tgt.lf);   // MCR-02: springs only after the damage/survival/defeat decision is final (defeated victims don't spring)
      for (const u of sharedVictims) if (u.lf <= 0 && !u.defeated) {
        u.defeated = true; H.pactLeave(s, u); delete u.status.playingDead; if (Parley && Parley.isImmortal(u)) u.knockedOut = true; log(s, { kind: "defeat", target: u.id, text: `${u.name} is ${u.knockedOut ? "knocked out" : "defeated"} through Shared Burden.` });
        { const Spirit = (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null; Spirit?.onDeath?.(s, u, null, H); }   // group spirit: killerless death still shocks a leaderless side
        { const OD = typeof module === "object" && module.exports ? require("../spirit/orders.js") : globalThis.ConceptCombatOrders; OD?.onDeath(s, u, H); }
        lootDrop(s, null, u);   // killerless death: ground delivery only
        s.barriers = s.barriers.filter(b => b.owner !== u.id);
        for (const t of Object.values(s.actors)) for (const statusKey of Object.keys(t.status)) if (t.status[statusKey]?.owner === u.id) t.status[statusKey] = null;
      }
      // Exposed detonates a mark early at half strength (Muse-2 interactions): the opening spends the threshold before it matures.
      const exposedMark = tgt.status.exposed && src?.id !== tgt.status.exposed.owner, crossedHalf = before >= tgt.maxLF * 0.5 && tgt.lf < tgt.maxLF * 0.5;
      if(tgt.status.tippingPoint&&!tgt.defeated&&(crossedHalf||inst?.concept==="resonance"||exposedMark)){
        const mark=tgt.status.tippingPoint;tgt.status.tippingPoint=null;
        const half = exposedMark && !crossedHalf && inst?.concept !== "resonance", potency = half ? Math.max(1, Math.ceil(mark.potency / 2)) : mark.potency;
        log(s,{kind:"trigger",actor:mark.owner,target:tgt.id,text:`Tipping Point crosses on ${tgt.name}; the conditional strike resolves now${half ? " at half strength" : ""}.`,why:[crossedHalf?"LF crossed below half after this hit.":inst?.concept==="resonance"?"Resonance deliberately triggers the armed condition before the target falls below half.":"Exposed: the opening spends the mark early, before it matures."]});
        hit(s,s.actors[mark.owner],tgt,{ability:"tippingPoint",name:"Tipping Point",concept:"threshold",delivery:"routed",damageType:"albedo",tier:"refined"},potency,["The visible threshold mark triggered."]);
      }
      if (gl?.strip.length) for (const k of gl.strip) tgt.status[k] = null;
      if (H.monsterOf(inst) || tgt.status?.infected) H.monsterRider(s, src, tgt, inst, before);   // the classic monsters' named attacks and infection
      if (ClassRuntime) ClassRuntime.afterHit(s, src, tgt, inst, before - tgt.lf, classH());   // ClassRuntime
      H.States?.afterHit(s, src, tgt, inst, before - tgt.lf, damageType);   // States: triggers, hurt breakers, hit clocks
      H.Exposure.hit(s, src, tgt, inst, before - tgt.lf);   // Exposure: repeated shots on one body
      { const edge = tgt.maxLF * (s.rules.inspiration?.nearDeathBelow ?? 0); if (tgt.lf > 0 && tgt.lf <= edge && before > edge) H.Inspiration.roll(s, tgt, "nearDeath"); }   // Inspiration: on the verge of death
      if (tgt.boss === "gaia" && !s.gaiaRescueRolled && tgt.lf > 0 && before > tgt.maxLF * 0.5 && tgt.lf <= tgt.maxLF * 0.5) H.Longtermism?.gaiaRescue(s, tgt);   // the rescue: one roll as she crosses half life
      if (Auras) Auras.afterHit(s, src, tgt, before - tgt.lf, auraH(), inst);   // Auras: Release loads
      if(tgt.status.attention&&inst&&["deception","resonance"].includes(inst.concept)){tgt.status.attention=null;edgeUsed(s,inst.concept==="deception"?"opp-feint-breaks-focus":"opp-resonance-breaks-focus");log(s,{kind:"effect",actor:src?.id,target:tgt.id,text:`${src?.name||"The hit"} breaks ${tgt.name}'s Focus with ${inst.concept==="deception"?"a Feint":"a resonance pulse"}.`});}
      const dealtLf = before - tgt.lf; H.Presence?.noteLf(s, H, src?.id, dealtLf); { const brk = H.Sealing?.smashHook?.(s, tgt, dealtLf); if (brk) log(s, { kind: "seal", actor: brk.foe, text: brk.text }); }   // W2.1: the presenter's hands stay clean or the path shatters   // W2.3: smashing a sealed foe breaks it out (it eats the vessel)
      if (inst?.aimZone && !s.preview) H.Injury?.wound(s, src, tgt, inst.aimZone, "called");   // a called shot that lands wounds its zone, whatever the damage (negations exit above)
      if (!s.preview) H.Injury?.overflow(s, src, tgt, dealtLf);
      return dealtLf;
    }
    function applyFall(s, source, target, fromHeight, toHeight, half = false, cause = "shoved") {
      if (target.form?.golden) { log(s, { kind: "resist", actor: source?.id || null, target: target.id, text: `${target.name} hovers beyond the fall.`, why: ["The Integrated Self ignores falls and terrain height."] }); return; }
      const drop = fromHeight - toHeight;
      if (drop <= 0) return;
      if (drop === 1) { log(s, { kind: "fall", actor: target.id, text: `${target.name} stumbles down one level.`, why: ["A one-level drop causes no fall damage."] }); return; }
      if ((target.passives?.humbleGift || 0) > (target.humbleFallsNegated || 0)) {   // J5 Breakfall: the humble soul catches its bearer, gift-many falls a battle
        target.humbleFallsNegated = (target.humbleFallsNegated || 0) + 1;
        log(s, { kind: "fall", actor: target.id, text: `${target.name} falls ${drop} levels and lands on their feet, unhurt.`, why: [`Breakfall ${target.humbleFallsNegated} of ${target.passives.humbleGift}: a humble soul breaks its bearer's fall.`] });
        return;
      }
      const full = (drop - 1) * s.rules.fallDamagePerLevel;
      const fallMul = (target.passives?.fallDamageMul || 1) * (H.ClassRuntime?.aeroForce?.(target) === "weight" ? 0 : 1) * (H.hasTrait(target, "atlasBones") ? 0 : 1), baseDamage = half ? full / 2 : full, damage = baseDamage * fallMul;   // Four Forces Weight: near weightless, no fall damage; Atlas Bones: travel never costs blood (anime batch — the stagger still lands)
      log(s, { kind: "fall", actor: target.id, text: `${target.name} falls ${drop} levels${half ? " in a controlled jump" : " after being " + cause}; ${roundFn(s)(damage)} LF${!half ? " and staggered" : ""}.`, why: [`Drop ${drop}: ${baseDamage} LF${half ? " halved by the Jump action" : ""}${fallMul !== 1 ? `, then ×${fallMul} from equipped gear` : ""}. Fall damage is Nigredo · impact.`] });
      hit(s, source || target, target, null, damage, [`${half ? "Controlled jump" : "Forced fall"} from height ${fromHeight} to ${toHeight}.`], { label: "Fall", damageType: "nigredo" });
      if (!half && !target.defeated && !H.eatShock(s, target, "stagger")) target.status.stagger = { label: "Stagger", owner: target.id, expiresAt: target.ownerTurns + H.staggerTurns(target) };
      if (!half && !target.defeated && target.id === (s.modeSetup?.hero || "player")) (s.dreamRecent ||= {}).heroStaggered = true;   // ambient dreams hear the hero stagger
    }
    function applyEntryEffects(s, source, target, x, y, cause = "enters") {
      H.Contracts?.moved(s,target,x,y);
      // A step breaks a chant whatever carries the unit (a flyer's or a golden form's early return below used to keep it).
      if (target.ritual) {   // C18: the channeler must hold still; Perfect Concentration may shift one tile a turn on its own feet
        const steps = H.hasTrait(target, "perfectConcentration") && source === target && cause === "enters" ? s.rules.concentration?.perfect?.ritualSteps || 0 : 0;
        if (target.ritual.stepTurn !== target.ownerTurns) { target.ritual.stepTurn = target.ownerTurns; target.ritual.steps = 0; }
        if (steps && target.ritual.steps < steps) {
          target.ritual.steps += 1;
          log(s, { kind: "ritual", actor: target.id, tiles: [[x, y]], text: `${target.name} shifts a step and the chant does not waver (Perfect Concentration).` });
        } else endRitual(s, target, "moved");
      }
      eatMushroom(s, target, x, y);                                            // true forms: Zherm's Sporefall
      if (target.form?.golden) return;
      if (ClassRuntime && ClassRuntime.onEntry(s, target, x, y, cause, H.waterAt(s, x, y), classH())) return;   // ClassRuntime: flyers pass over hazards; knocked into water = grounded
      springTraps(s, source, target, x, y); if (target.defeated) return;
      const terrain = tileAt(s, x, y);
      const fold = H.foldAt ? H.foldAt(s, x, y) : null;   // Folding: paper muffles the hazard, and feet wear the paper
      if (fold && !target.defeated) { fold.protection -= 2;
        if (fold.protection <= 0) { s.barriers = s.barriers.filter((b) => b !== fold); log(s, { kind: "effect", actor: target.id, tiles: [[x, y]], text: `${target.name} ${cause} the paper crossing at (${x},${y}): it tears underfoot.`, why: ["Every crossing wears the paper; this one wore through."] }); }
        else log(s, { kind: "effect", actor: target.id, tiles: [[x, y]], text: `${target.name} ${cause} the paper crossing at (${x},${y}): the hazard is muffled (${fold.protection} paper left).`, why: ["Paper over rough ground muffles entry hazards and costs 1 move point a tile."] });
      }
      if (terrain.hazard > 0 && !target.defeated && !fold) {
        if((s.treeBraces||[]).some(b=>b.x===x&&b.y===y&&s.actors[b.owner]?.ownerTurns<b.expiresAt)){
          log(s,{kind:"posture",actor:source?.id||target.id,target:target.id,tiles:[[x,y]],text:`${terrain.name} hazard is suppressed by the Arborist's tree brace.`,why:["The brace affects the shared tree edge only and lasts only as long as its Shield Wall."]});syncPickup(s,target);return;
        }
        if (target.passives?.hazardImmune) {
          log(s, { kind: "resist", actor: target.id, target: target.id, tiles: [[x, y]], text: `${target.name} is immune to the ${terrain.name} entry hazard.`, why: ["Hazard immunity prevents this terrain-entry hit."] });
          syncPickup(s, target); return;
        }
        log(s, { kind: "terrain", actor: source?.id || target.id, target: target.id, tiles: [[x, y]], text: `${target.name} ${cause} ${terrain.name} at (${x},${y}): ${terrain.hazard} LF hazard.`, why: [`Entry hazard is a ${terrain.hazard} LF Nigredo · impact event.`] });
        hit(s, source || target, target, null, terrain.hazard, [`${terrain.name} entry hazard.`], { label: terrain.name + " hazard", damageType: "nigredo" });
      }
      const growthIndex=(s.growthMarks||[]).findIndex(m=>m.x===x&&m.y===y&&m.side===target.side&&m.owner!==target.id&&!target.defeated);
      if(growthIndex>=0){
        const mark=s.growthMarks.splice(growthIndex,1)[0],before=target.lf;
        target.lf=Math.min(target.maxLF,target.lf+mark.heal);
        log(s,{kind:"posture",actor:mark.owner,target:target.id,tiles:[[x,y]],text:`${target.name} gathers the Gardener’s growth mark and restores ${target.lf-before} LF.`,why:[`The mark restores up to ${mark.heal} LF to the first ally other than the Gardener who enters this adjacent soil.`]});
      }
      const thorn = (s.terrainEffects || []).find(e => e.kind === "thorn" && e.tiles?.some(([tx, ty]) => tx === x && ty === y) && s.actors[e.owner]?.ownerTurns < e.expiresAt && s.actors[e.owner]?.side !== target.side && !target.defeated);
      if (thorn) {
        const label = thorn.label || "Thorn growth", noun = label === "Thorn growth" ? "Thorns" : label;
        log(s, { kind: "terrain", actor: thorn.owner, target: target.id, tiles: [[x, y]], text: `${target.name} ${cause} ${label.charAt(0).toLowerCase() + label.slice(1)} at (${x},${y}): ${thorn.dmg} LF hazard.`, why: [`${noun} wound enemies that enter.`, ...(thorn.slow ? ["Snared: half movement until it clears."] : [])] });
        hit(s, s.actors[thorn.owner] || null, target, { name: label, concept: "thorn", delivery: "placed", damageType: "nigredo", ability: "thornEntry" }, thorn.dmg, [`${target.name} is caught by ${label.charAt(0).toLowerCase() + label.slice(1)}.`], { label });
        if (thorn.slow && !target.defeated) target.status.slowStart = { label: "Thorn-snared", owner: thorn.owner, expiresAt: target.ownerTurns + 1 };
      }
      if(source?.id === target.id && H.waterAt(s,x,y)){target.waterContact=H.key(x,y);target.waterDepth=H.surfaceAt(s,x,y)==="~"?"deep":"shallow";}
      refreshDrowning(s, target, `steps into water at (${x},${y})`, source?.id !== target.id);
      syncPickup(s, target);
    }

    // A line delivery travelling from src to the tiles in `pts` (excluding src tile). Returns the index where it stopped, or -1.
    function lineStop(s, src, pts) {
      for (let i = 1; i < pts.length; i++) {
        const [gx,gy]=pts[i],garden=(s.terrainEffects||[]).find(e=>e.kind==="rainGarden"&&e.tiles.includes(key(gx,gy))&&(e.remaining?.[key(gx,gy)]||0)>0&&s.actors[e.owner]?.side!==src.side&&s.actors[e.owner]?.ownerTurns<e.expiresAt);
        if(garden){garden.remaining[key(gx,gy)]--;log(s,{kind:"terrain",actor:garden.owner,tiles:[[gx,gy]],text:`Rain Garden at (${gx},${gy}) absorbs this line delivery and spends its tile's charge.`,why:["The planted basin absorbs one opposing line per tile; it does not stop field deliveries."]});return i;}
        const pasted=(s.terrainEffects||[]).find(e=>e.kind==="pastedFragment"&&e.fragment?.kind==="absorbOneLine"&&e.tiles?.some(t=>t[0]===gx&&t[1]===gy)&&s.actors[e.owner]?.side!==src.side&&s.actors[e.owner]?.ownerTurns<e.expiresAt);
        if(pasted){s.terrainEffects=s.terrainEffects.filter(e=>e!==pasted);log(s,{kind:"negate",actor:src.id,tiles:[[gx,gy]],text:`${src.name}'s line is absorbed by the pasted basin at (${gx},${gy}); the fragment is spent.`,why:["The Collage fragment carries exactly one line-absorption charge."]});return i;}
        const b = barrierAt(s, pts[i][0], pts[i][1]);
        if (b?.linePassable || b?.coverFraction > 0 || b?.rushed) continue;   // a rushed wall slows the line, it does not stop it (resolve.js)
        if (b && (s.rules.barriersBlockOwnSide || s.actors[b.owner].side !== src.side)) return i;
      }
      return -1;
    }
    function negateAtBarrier(s, src, inst, b, potency) {
      const owner = s.actors[b.owner]; const edge = findOpp("barrier", inst.concept, "negates", "line");
      if (b.absorbsLine) {
        const swaleEdge = findOpp("swale", inst.concept, "negates", "line");
        s.barriers = s.barriers.filter((x) => x !== b);
        if (swaleEdge) edgeUsed(s, swaleEdge.id);
        log(s, { kind: "negate", actor: src.id, text: `${inst.name} is absorbed by ${owner.name}'s Bioswale at (${b.x},${b.y}); the basin is spent.`, why: [`The swale absorbs exactly one opposing line delivery crossing its tile${swaleEdge ? ` [${swaleEdge.id}]` : ""}; it does not stop movement or routed delivery.`], edge: swaleEdge?.id });
        if (b.returnFraction > 0 && !src.defeated) hit(s, owner, src, null, potency * b.returnFraction,
          [`Overflow Channel redirects ${Math.round(b.returnFraction * 100)}% of the absorbed delivery back to its source.`], { label: "Overflow Return", damageType: inst.damageType });
        const preview = Postures?.resolve({ character: owner.character, concept: "swale", ability: "bioswale", event: "swaleAbsorbed",
          eligible: DIRS.map(([dx,dy]) => ({x:b.x+dx,y:b.y+dy,value:inside(s,b.x+dx,b.y+dy)?s.arena.map[b.y+dy][b.x+dx]:null,
            soil:inside(s,b.x+dx,b.y+dy)&&(C.tiles[s.arena.map[b.y+dy][b.x+dx]]?.tags||[]).includes("soil"),
            empty:inside(s,b.x+dx,b.y+dy)&&!actorAt(s,b.x+dx,b.y+dy)&&!barrierAt(s,b.x+dx,b.y+dy)&&!s.arena.objects?.some(o=>o.x===b.x+dx&&o.y===b.y+dy)})) });
        if(preview){s.barriers.push({id:"m"+(++s.seq),owner:owner.id,x:preview.tile[0],y:preview.tile[1],duration:2,expiresAt:owner.ownerTurns+2,concept:"mulch",passiveGround:true});
          log(s,{kind:"posture",actor:owner.id,tiles:[preview.tile],text:preview.log,why:["This is a movement-cost change only; it adds no damage or ΦF."]});}
        return;
      }
      edgeUsed(s, edge.id);
      const why = [`Barrier negates line deliveries that cross its tile [${edge.id}].`];
      b.protection -= potency;
      if (b.protection <= 0) { why.push(`The impact (${roundFn(s)(potency)}) exceeds its protection: the wall breaks, but the delivery is still stopped.`); s.barriers = s.barriers.filter((x) => x !== b); }
      else why.push(`Wall protection ${roundFn(s)(b.protection + potency)} → ${roundFn(s)(b.protection)}.`);
      log(s, { kind: "negate", actor: src.id, cause: "barrier", at: [b.x, b.y], ability: inst.ability || null, delivery: inst.delivery, barrierOwner: owner.id, text: `${inst.name} stops at ${owner.name}'s Shield Wall (${b.x},${b.y}).`, why, edge: edge.id });
      const comp = compositionEdge(owner);
      const compDeflect = comp?.op.kind === "enableEdge" ? C.opposition.find((e) => e.id === comp.op.edge) : null;
      const compositionFraction = compDeflect?.op.fraction || 0;
      const counterFraction = Math.max(compositionFraction, b.counterFraction || 0);
      if (counterFraction > 0 && !owner.defeated) {
        if (comp?.op.kind === "enableEdge") {
        chargeUltimate(s, owner, owner.primary, `The ${conceptName(owner.primary)} + ${conceptName(owner.secondary)} composition deflects a line delivery.`, s.rules.ultimateChargePairBonus);
          const d = C.opposition.find((e) => e.id === comp.op.edge); edgeUsed(s, d.id); edgeUsed(s, comp.id);
        }
        const source = comp?.op.kind === "enableEdge" ? `${conceptName(owner.primary)} + ${conceptName(owner.secondary)} composition [${comp.id}]` : "Thorned Wall lens";
        const behind = shooterCover(s, src, owner.x, owner.y);   // return fire meets the shooter's own cover
        hit(s, owner, src, null, potency * counterFraction * (1 - behind), [`${source} returns ${Math.round(counterFraction * 100)}% of the stopped delivery to its source.`, ...(behind ? [`${src.name}'s cover takes ${Math.round(behind * 100)}% of it.`] : [])],
          { label: `Deflected ${inst.name}`, edge: comp?.op.kind === "enableEdge" ? comp.op.edge : undefined, damageType: inst.damageType });
      } else if (comp && comp.op.kind === "storeImpact" && !owner.defeated) {
        chargeUltimate(s, owner, owner.primary, `The ${conceptName(owner.primary)} + ${conceptName(owner.secondary)} composition stores an intercepted impact.`, s.rules.ultimateChargePairBonus);
        edgeUsed(s, comp.id);
        schedule(s, { owner: owner.id, trigger: { type: "turnStart", actor: src.id },
          inst: { name: "Stored Impact", ability: null, concept: "elasticity", delivery: "release", potency: potency * comp.op.fraction, targets: [src.id], edge: comp.id } });
        log(s, { kind: "schedule", actor: owner.id, text: `${owner.name}'s wall stores the impact: ${Math.round(comp.op.fraction * 100)}% will release onto ${src.name} at the start of ${src.name}'s next turn.`,
          why: [`${conceptName(owner.primary)} primary + ${conceptName(owner.secondary)} secondary [${comp.id}]: stores instead of deflecting (the reversed pair behaves differently).`], edge: comp.id });
      }
    }
    // Per-target opposition checks: membrane and parry. Returns { potency, why, stop }.
    function targetInteractions(s, src, tgt, inst, potency) {
      const why = [];
      const mem = tgt.status.membrane;
      if (mem) {
        if (inst.directHit) why.push("Direct hit: too unpredictable for Membrane to filter; it holds.");
        else if (inst.delivery === "line") {
          const e = findOpp("selectivity", inst.concept, "negates", "line");
          if (e && mem.rushed) { edgeUsed(s, e.id); potency *= 1 - mem.rushed; why.push(`${tgt.name}'s rushed Membrane filters ${Math.round(mem.rushed * 100)}% of this ${conceptName(inst.concept)} line [${e.id}].`); }
          else if (e) { edgeUsed(s, e.id); return { stop: true, why: [`${tgt.name}'s Membrane filters out line deliveries of ${conceptName(inst.concept)} [${e.id}].`], edge: e.id }; }
          why.push(`Membrane has no authored edge against ${conceptName(inst.concept)}: unknown, so no effect.`);
        } else if (!inst.directHit && inst.delivery === "field") {
          const e = findOpp("selectivity", inst.concept, "enhances", "field");
          if (e) { edgeUsed(s, e.id); potency *= e.op.factor; tgt.status.membrane = null; why.push(`Membrane carries the wave inward ×${e.op.factor} and ruptures [${e.id}].`); }
        }
      }
      const p = tgt.status.parry;
      if (p) {
        const attentionLocked = ((tgt.lastTechniqueConcept === "focus" || tgt.focus?.earned) && tgt.focus && tgt.focus.target !== src?.id)||(tgt.status.attention&&tgt.status.attention.target!==src?.id);
        if(inst.ignoreParry){why.push("Undivided Attention reads through Rebound; parry is bypassed.");return {potency,why,stop:false};}
        if(inst.directHit){why.push("Direct hit: too unpredictable to catch; Rebound cannot trigger.");return {potency,why,stop:false};}
        if (inst.quickened) { why.push(`Quickened (${inst.quickened}) leaves no reaction window; Rebound cannot trigger.`); return { potency, why, stop: false }; }
        const caught = p.catches.includes(inst.delivery);
        const disrupt = inst.concept && findOpp(inst.concept, "barrier", "disrupts", inst.delivery);
        const bypass = inst.concept && findOpp(inst.concept, "barrier", "bypasses", inst.delivery, "ignoreParry");
        if (disrupt && caught) {
          edgeUsed(s, disrupt.id); tgt.status.parry = null;
          why.push(`${conceptName(inst.concept)} disrupts Rebound [${disrupt.id}]: the parry is spent and the hit lands in full.`);
        } else if (!caught) {
          if (bypass) { edgeUsed(s, bypass.id); why.push(`Rebound is armed but ${inst.delivery} delivery bypasses it [${bypass.id}]; the parry stays armed.`); }
          else why.push(`Rebound only catches ${p.catches.join("/")} hits; this is ${inst.delivery}.`);
        } else if (attentionLocked) {
          why.push(`Focus keeps ${tgt.name}'s reaction on ${s.actors[tgt.focus.target]?.name || "the attended target"}; this attack comes from someone else.`);
        } else if (tgt.reaction <= 0 && !p.reacted) {
          why.push("Rebound is armed, but this round's reaction is already spent.");
        } else {
          if (!p.reacted) tgt.reaction -= 1; tgt.status.parry = null;   // armed as a reaction: that reaction already paid
          if (p.rushed) {   // a rushed Rebound catches its share; the rest lands
            log(s, { kind: "parry", actor: tgt.id, target: tgt.id, attacker: src?.id || null, ability: inst.ability || null, delivery: inst.delivery, at: [tgt.x, tgt.y], rushed: true, text: `${tgt.name}'s rushed Rebound catches ${Math.round(p.rushed * 100)}% of ${inst.name}.` });
            hit(s, tgt, src, null, potency * p.rushed * p.reflectFraction * (1 - shooterCover(s, src, tgt.x, tgt.y)), [`Rebound reflects ${p.reflectFraction * 100}% of the ${Math.round(p.rushed * 100)}% it caught.`], { label: "Rebound", damageType: inst.damageType });
            return { potency: potency * (1 - p.rushed), why: [`A rushed Rebound caught ${Math.round(p.rushed * 100)}%; the rest lands.`], stop: false };
          }
          log(s, { kind: "parry", actor: tgt.id, target:tgt.id, attacker: src?.id || null, ability: inst.ability || null, delivery: inst.delivery, at:[tgt.x,tgt.y], text: `${tgt.name}'s Rebound catches ${inst.name} (reaction spent).`, why: [`Parry: ${inst.delivery} hits are caught in full; ${p.reflectFraction * 100}% is pushed back.`] });
          { const behind = shooterCover(s, src, tgt.x, tgt.y);   // return fire meets the shooter's own cover
            hit(s, tgt, src, null, potency * p.reflectFraction * (1 - behind), [`Rebound reflects ${p.reflectFraction * 100}% of the caught potency.`, ...(behind ? [`${src?.name}'s cover takes ${Math.round(behind * 100)}% of it.`] : [])], { label: "Rebound", damageType: inst.damageType }); }
          if (p.perfect && s.rules.reactiveDefense?.perfect?.inspiration) H.Inspiration?.gain(s, tgt, s.rules.reactiveDefense.perfect.inspiration, `${tgt.name}'s perfect parry turns ${inst.name || "the blow"} back.`);   // Mala, 2026-10-17
          return { stop: true, why: [] };
        }
      }
      return { potency, why, stop: false };
    }
    function strikeTarget(s, src, tgt, inst, potency, baseWhy) {
      if (tgt.defeated || !dreamCanReach(s,src,inst,tgt.x,tgt.y)) return 0;
      if (inst?.answeredBy?.includes(tgt.id)) return hit(s, src, tgt, inst, potency, baseWhy);   // answered (window.js castAnswer): straight to hit(), which cancels it; his Rebound/Membrane are not spent
      if (ClassRuntime?.beforeStrike) { const cs = ClassRuntime.beforeStrike(s, src, tgt, inst, potency, classH()); if (cs) { potency = cs.potency; inst = cs.inst; baseWhy = baseWhy.concat(cs.why); } }   // Ranger: mark, ambush, arrow cover
      if(src.status.attention?.target===tgt.id){potency*=1.5;inst={...inst,ignoreCover:true,ignoreParry:true};baseWhy=baseWhy.concat(["Undivided Attention sharpens attacks on its one target ×1.5 and bypasses cover and parries."]);}
      const r = targetInteractions(s, src, tgt, inst, potency);
      if (r.stop) { if (r.why.length) log(s, { kind: "negate", actor: src.id, target: tgt.id, text: `${inst.name} doesn't reach ${tgt.name}.`, why: r.why, edge: r.edge }); return 0; }
      let finalPotency = r.potency; const why = baseWhy.concat(r.why);
      if (inst && ["line", "placed"].includes(inst.delivery)) {
        const dh = Math.max(-2, Math.min(2, (inst.sourceHeight ?? heightAt(s, src.x, src.y)) - heightAt(s, tgt.x, tgt.y)));
        if (dh) { const factor = 1 + dh * 0.1; finalPotency *= factor; why.push(`Elevation ${dh > 0 ? "advantage" : "disadvantage"} (${dh > 0 ? "+" : ""}${dh}): potency ×${factor.toFixed(1)}.`); }
      }
      const dealt = hit(s, src, tgt, inst, finalPotency, why);
      if (dealt > 0 && inst?.stunTempo && !tgt.defeated) {
        addStun(s, src, tgt, inst.stunTempo);
        // Cut-free (Muse-2 interactions): a staggered, exposed fighter stumbles into their own freeze — the bleed opens free.
        if (tgt.status.stagger?.expiresAt > tgt.ownerTurns && tgt.status.exposed && src?.id !== tgt.status.exposed.owner && !tgt.status.bleed) {
          tgt.status.bleed = { drain: 2, until: tgt.ownerTurns + 2, owner: src.id };
          if (src && !src.defeated) src.status.bloodyHands = { label: "Bloody Hands", owner: src.id, expiresAt: src.ownerTurns + (s.rules.rite?.bloodyHandsTurns ?? 2) };   // Rites (Muse-2): drawing blood opens the blood step
          log(s, { kind: "bleed", actor: tgt.id, text: `${tgt.name} stumbles exposed into the freeze: a cut opens free (2 LF a turn, 2 turns).`, why: ["Stagger + Exposed + Stun: the openings compound."] });
        }
      }
      return dealt;
    }
    function schedule(s, ev) { s.seq += 1; s.scheduled.push({ id: "ev" + s.seq, seq: s.seq, ...ev }); }
    // Empty attacks charge nothing (Mala, 2026-10-17): the commit site stashes inst.deferredCharge instead of
    // charging; every damage-resolution path settles it here. Zero actors struck: no charge (the tempo stays
    // spent). Clearing first keeps this idempotent if a path ever resolves twice.
    // Borrowed-but-paid techniques charge ULT (Mala, 2026-10-19): genius-learned, Contains Multitudes
    // embodied kit, orb-form kit, and pair-gated techniques authored off the pair are the fighter's real
    // actions that turn. Only the held Freestyle verse stays excluded — Freestyle charged on use and the
    // verse delivery is free (manifest marks it m.verse, which survives techniqueCommitted consuming it).
    function borrowedCharges(a, m) {
      if (!m || m.verse || !m.ability) return false;
      if ((a.learned || []).includes(m.ability)) return true;
      if ((a.form?.techniques || []).includes(m.ability)) return true;
      const M = a.embodied && !a.defeated ? a.embodied : null;
      if (M && [...(C.concepts[M.primary]?.abilities || []), ...(C.concepts[M.secondary]?.abilities || [])].includes(m.ability)) return true;
      return (ab(m.ability)?.pairs || []).some(([p, sec]) => (p === a.primary && sec === a.secondary) || (M && p === M.primary && sec === M.secondary));
    }
    function settleDeferredCharge(s, a, inst, struck) {
      const dc = inst.deferredCharge; if (!dc) return;
      inst.deferredCharge = null;
      if (struck > 0) { chargeUltimate(s, a, ...dc); return; }
      log(s, { kind: "charge", actor: a.id, text: `${inst.name} hits nothing: no ultimate charge.`, why: ["An attack that lands on no one builds nothing. The tempo stays spent."] });
    }
    function resolveScheduled(s, ev) {
      const src = s.actors[ev.owner]; const inst = ev.inst;
      log(s, { kind: "delayed", actor: ev.owner, text: `Turn-start trigger: ${src.name}'s ${inst.name} resolves at the start of ${s.actors[ev.trigger.actor].name}'s turn.`, edge: inst.edge });
      if (inst.delivery === "release") { hit(s, src, s.actors[inst.targets[0]], null, inst.potency, [`Impact stored by the wall is released [${inst.edge}].`], { label: "Stored Impact", edge: inst.edge }); return; }
      resolveDelayed(s, ev.owner, inst);
    }
    function resolveDelayed(s, owner, inst) {
      const src = s.actors[owner];
      if (inst.decoy) return log(s, { kind: "exposure", exposure: "decoy", landed: true, actor: owner, tiles: inst.tiles, text: `${src.name}'s first mark was a decoy. Nothing lands.`, why: ["Whatever was spent answering it is spent.", "The real mark is on the person, not the tile."] });
      const why = [inst.follow ? "The real mark was on the person: it lands where they stand now." : `Committed earlier with lens ${inst.lensName}; tiles snapshotted at commit.`];
      const targets = opponentsOn(s, src, inst.tiles, true);
      if (!targets.length) log(s, { kind: "miss", actor: owner, cause: "dodged", ability: inst.ability || null, aimedAt: inst.follow || inst.target || null, text: `${inst.name} lands on empty tiles.`, why: ["Whoever it was meant for stepped out: a committed attack can be dodged by anyone with a reaction, the AP and room to move. The AI now saves these for a target that cannot (grappled, attention fixed elsewhere, stunned short of AP, or boxed in)."] });
      settleDeferredCharge(s, src, inst, targets.length);   // decoys exit above, so only the real strike settles
      for (const t of targets) strikeTarget(s, src, t, inst, inst.potency * inst.mult, why);
    }
    const opponentsOn = (s, src, tiles, includeWild = false) => {
      const set = new Set(tiles.map((t) => key(t[0], t[1])));
      const actors = Object.values(s.actors).filter((a) => !a.defeated && a.side !== src.side && footprint(a).some(([x,y]) => set.has(key(x,y))));
      if (includeWild) actors.push(...s.wild.filter((m) => m.form === "unit" && set.has(key(m.x, m.y))).map((m) => ({ ...m, wild: true, side: "wild", maxLF: m.maxLF, status: {} })));
      return actors;
    };
    const unitsOn = (s, tiles, includeWild = false) => {
      const set = new Set(tiles.map((t) => key(t[0], t[1])));
      const actors = Object.values(s.actors).filter((a) => !a.defeated && footprint(a).some(([x,y]) => set.has(key(x,y))));
      if (includeWild) actors.push(...s.wild.filter((m) => m.form === "unit" && set.has(key(m.x, m.y))).map((m) => ({ ...m, wild: true, side: "wild", maxLF: m.maxLF, status: {} })));
      return actors;
    };
    function terrainDamagingArea(inst) {
      const d = ab(inst.ability) || inst;
      if (structures?.isGroundTargeting) return structures.isGroundTargeting(d);
      if (d.groundTargeting != null) return !!d.groundTargeting;
      return d.effect === "damage" && (d.delivery === "placed" || !!d.area && d.area.shape !== "single");
    }
    function areaRecipients(s, src, inst, tiles, includeWild = true) {
      if (src && isMonster(src) && src.drawback === "mindless") return { targets: unitsOn(s, tiles, includeWild).filter(t => t.id !== src.id && t.id !== src.summoner), why: ["Mindless: it cannot tell sides."] };   // the Zombie
      if (!terrainDamagingArea(inst)) return { targets: opponentsOn(s, src, tiles, includeWild), why: [] };
      const targets = unitsOn(s, tiles, includeWild);
      const friendlyFire = targets.some(t => t.side === src.side);
      return { targets, why: friendlyFire ? ["This area damages terrain, so every unit in its footprint is vulnerable regardless of side."] : [] };
    }

    // Clearable fields (wild/monsters.js): any normal attack clears one, a Strike aimed at a field tile or a damaging
    // technique whose footprint covers one (Mala, 2026-10-11). Kind defaults to creeper, the only clearable field today.
    // Returns how many tiles were cleared.
    const fieldAt = (s, x, y, kind = "creeper") => (s.wild || []).some((m) => m.kind === kind && m.tiles && `${x},${y}` in m.tiles);
    function clearField(s, a, tiles, kind = "creeper") {
      const on = (tiles || []).filter(([x, y]) => fieldAt(s, x, y, kind)); if (!on.length || !wildRules?.clearTiles) return 0;
      const row = ((wildRules.data.fields || {})[kind] || {}).clear || {};
      const clearedBy = row.clearedBy ?? wildRules.data.monsters[kind].clearedBy;
      const r = wildRules.clearTiles(wildSnapshot(s), on, clearedBy, kind); saveWildWorld(s, r.world);
      for (const ev of r.events) log(s, { kind: ev.kind, actor: a?.id || null, tiles: ev.at ? [ev.at] : [], text: ev.text });
      return on.length;
    }
    return { shooterCover, fieldAt, clearField, roundFn, findOpp, hit, soulFrac, soulMaxFor, woundSoul, concentrationProfile, concentrationCheck, applyFall, applyEntryEffects, lineStop, negateAtBarrier, targetInteractions, strikeTarget, schedule, pactLeave,
      resolveScheduled, resolveDelayed, opponentsOn, unitsOn, terrainDamagingArea, areaRecipients, settleDeferredCharge, borrowedCharges };
  })();
});
