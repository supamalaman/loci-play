"use strict";
// Animated Body (codex-animated-body-trait-spec rev 2, slice AB1a; Mala 2026-11-22, R-20261122-44): a cartoon carrier
// takes ×0.25 from every ordinary hit and cannot die to ordinary harm: a lethal blow flattens it (it sits out its next
// turn and is back at 1 LF). Only orgonite or a dream grounds a blow (full damage, and it can kill):
//   - the attacker wears an orgonite charm or is a Posterity suit (drilled by crew, R-20261122-04; the Orgonite Drilled
//     trait is not in the game yet: when claude-orgonite-reactions-spec lands its drilled(a), this test reads it);
//   - the cartoon stands inside a live orgonite tower field;
//   - the attacker stands inside an open Dream Space (whoever opened it).
// Snap Back: once a battle per body origin, a Recover also downgrades one injury grade (native Injury.downgrade order),
// and Recover is allowed at full ΦF while that repair is owed. One predicate, canRecover, serves the handler and the AI.
// Pure: every engine-side read comes in through `deps` (hasTrait, orgonite, dreamSpace rules), so the module loads alone.
//
//   carries(a, hasTrait)                     -> true when the actor is a cartoon
//   groundedBy(s, src, tgt, deps)            -> null for an ordinary blow, or a short reason it lands in full
//   cushion(s, src, tgt, deps)               -> { mul, note } for hit(): mul 0.25 ordinary, 1 grounded or not a carrier
//   spare(s, src, tgt, dmg, deps)            -> { dmg, flattened, note }: the lethal guard (a cartoon keeps 1 LF)
//   bleedFloor(s, a, deps)                   -> 1 for a cartoon outside a tower field, else 0: the LF floor every direct LF
//                                               write that bypasses hit() applies (wound and status bleeds, traps, Shared Burden and load shares, tandem echoes)
//   origin(a) / snapBackReady(s, a, deps)    -> the battle charge, shared by a mirror and its source
//   canRecover(s, a, deps)                   -> null when Recover is legal, else the refusal text
//   snapBack(s, a, deps)                     -> after a paid Recover: repair one grade and spend the charge (or nothing)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatAnimatedBody = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ID = "animatedBody";
  const RULES = { takenMul: 0.25, aiSnapBackValue: 14 };   // 14 outbids a Strike on an adjacent foe (tests/animated-body.test.mjs); at the old 3 the AI strikes
  const COPY = {
    squash: (name) => `${name} squashes flat and stretches back: Animated Body ×${RULES.takenMul} (only orgonite or a dream lands in full).`,
    flatten: (name) => `${name} is flattened like a pancake, not finished: 1 LF, and it sits out its next turn.`,
    grounded: (name, why) => `${why}: the blow lands on ${name} in full.`,
    snap: (name) => `${name} snaps back into shape: one injury grade straightens (Snap Back, once a battle).`,
  };
  // The six Posterity suits' concept pairs (classes/posterity-suits.js PAIRS) are drilled by crew (R-20261122-04).
  // Lazy (`=> require(`): read at call time, so the page may load this file before its providers (engine-parts mind-duel walk).
  const suitsNode = () => require("../classes/posterity-suits.js"), orgoNode = () => require("../orgonite/orgonite.js");
  const suits = () => (typeof module === "object" && module.exports ? (() => { try { return suitsNode(); } catch { return null; } })() : globalThis.ConceptCombatPosteritySuits) || null;
  const orgo = () => (typeof module === "object" && module.exports ? (() => { try { return orgoNode(); } catch { return null; } })() : globalThis.ConceptCombatOrgonite) || null;
  const towerAt = (s, x, y, deps) => !!(deps.orgonite || orgo())?.inField?.(s.arena?.objects, x, y);
  const traitOf = (a, id) => (a.traits || []).some((t) => ((t && t.id) || t) === id) || !!a.tempTraits?.[id];   // the spirit.js reader, for callers with no engine host
  const carries = (a, hasTrait) => !!a && (hasTrait || traitOf)(a, ID);
  function orgoniteBy(src, hasTrait) {
    if (!src) return null;
    if (typeof src.passives?.dreamMonsterDamageMul === "number" && src.passives.dreamMonsterDamageMul < 1) return "An orgonite charm";   // the charm's passive (items-data.js orgoniteCharm), the only gear that carries it
    if (suits()?.is?.(src)) return "Orgonite drill";
    return null;
  }
  function groundedBy(s, src, tgt, deps = {}) {
    const towerHere = towerAt(s, tgt.x, tgt.y, deps);
    if (towerHere) return "The orgonite field";
    const worn = orgoniteBy(src, deps.hasTrait); if (worn) return worn;
    const field = s.dreamSpace, rules = deps.dreamSpace;
    if (src && field && rules?.contains && rules.contains(field, src.x, src.y)) return "The open dream";
    return null;
  }
  function cushion(s, src, tgt, deps = {}) {
    if (!carries(tgt, deps.hasTrait)) return { mul: 1, note: null };
    const why = groundedBy(s, src, tgt, deps);
    if (why) return { mul: 1, note: COPY.grounded(tgt.name, why) };
    return { mul: RULES.takenMul, note: COPY.squash(tgt.name) };
  }
  function spare(s, src, tgt, dmg, deps = {}) {
    if (!(dmg > 0) || dmg < tgt.lf || !carries(tgt, deps.hasTrait) || groundedBy(s, src, tgt, deps)) return { dmg, flattened: false, note: null };
    // Popped back (termination audit question 5): between sitting out and its next real turn a cartoon cannot be flattened
    // again, so one hit a round cannot lock it out of every turn. It still keeps 1 LF; turns.js clears `popped` when it acts.
    const already = !!tgt.flattened || !!tgt.popped;
    if (!s.preview && !already) tgt.flattened = true;
    return { dmg: Math.max(0, tgt.lf - 1), flattened: !already, note: already ? null : COPY.flatten(tgt.name) };
  }
  function bleedFloor(s, a, deps = {}) {
    if (!carries(a, deps.hasTrait)) return 0;
    return towerAt(s, a.x, a.y, deps) ? 0 : 1;
  }
  const origin = (a) => (a && (a.mirrorOf || a.id)) || null;
  const used = (s, a) => !!s.animatedBodies?.snapBackUsed?.[origin(a)];
  const injured = (a, deps) => (deps.injury?.woundedZones?.(a) || []).length > 0;
  function snapBackReady(s, a, deps = {}) {
    return carries(a, deps.hasTrait) && !used(s, a) && injured(a, deps);
  }
  function canRecover(s, a, deps = {}) {
    if (a.tempo < s.rules.actionCosts.utility) return `Recover needs ${s.rules.actionCosts.utility} action points.`;
    if ((a.lastRecoverTurn ?? -99) >= a.ownerTurns - s.rules.recover.cooldownTurns) return "Recover can't be used on consecutive turns.";
    if (a.pf >= a.maxPF && !snapBackReady(s, a, deps)) return "ΦF is already full.";
    return null;
  }
  function snapBack(s, a, deps = {}) {
    if (!snapBackReady(s, a, deps) || !deps.downgrade) return null;
    const r = deps.downgrade(s, a, a);
    if (!r) return null;
    ((s.animatedBodies ||= {}).snapBackUsed ||= {})[origin(a)] = true;
    return { ...r, text: COPY.snap(a.name) };
  }
  return { ID, RULES, COPY, carries, groundedBy, cushion, spare, bleedFloor, origin, snapBackReady, canRecover, snapBack };
});
