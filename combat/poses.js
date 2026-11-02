"use strict";
// Sprite pose slots and routing (Mala's spec via Muse, 2026-10-10). Pure: no DOM, no engine state.
//
// A sprite package MUST have: idle, walk, cast, block, punch, knocked-out. It MAY also have:
//   cast-off   technique attacks, terrain effects, anything that harms others or things
//   cast-def   buffs and support moves
//   dodge      reaction movement that avoids an attack
//   ultimate   an ultimate attack
//   knockback  the flinch when a hit lands on someone who is not guarding
//   dream-open opening a Dream Space
//   knee       kneeling (deference, trial claims); falls back to idle
//   hurt       bloodied idle (under 40% LF); falls back to idle
//   infatuated charmed idle (the Love mechanic's slot); falls back to idle
//   aura       full-ult idle (max charge blazing); falls back to idle
// Any pose may also have ALTERNATES: block-2.png, block-3.png ... beside block.png. One is picked per use
// (variant()), so a character with two block drawings sometimes blocks one way and sometimes the other.
// Packages drawn with one cast pose keep working: every optional slot falls back down a chain.
//
//   route(src)             → the slot an action should show
//   chain(slot)            → [slot, ...fallbacks, "idle"]: try each file in order
//   resolve(slot, has)     → the first pose in the chain the package actually has
//   hitPose(target)        → what a unit shows when a hit lands: knocked-out, block (guarding) or knockback
//   variant(pose, n, key)  → pose, or pose-2 … pose-n, chosen by a stable hash of key
//   isHelpful(def, src)    → the Off/Def rule of thumb: helpful ⇒ Def, harmful or terrain ⇒ Off
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatPoses = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const REQUIRED = ["idle", "walk", "cast", "block", "punch", "knocked-out"];
  const OPTIONAL = ["cast-off", "cast-def", "dodge", "ultimate", "knockback", "dream-open", "knee", "hurt", "infatuated", "aura", "rest", "form-change", "clash", "stance"];
  const FALLBACK = {
    "cast-off": ["cast"],            // single-art packages: the same cast art serves both
    "cast-def": ["cast"],
    dodge: ["walk"],                 // no dodge art: the basic move sprite
    ultimate: ["cast-off", "cast"],  // no ultimate art: Cast Off, then the single cast
    "dream-open": ["cast-def", "cast"],   // no dream-opening art: the support cast (Muse, 2026-10-11)
    knockback: ["block"],            // no knockback art: the guard pose (Mala, 2026-10-10)
    enraged: [],                     // bosses only; others fall straight to idle
    knee: [], hurt: [], infatuated: [], aura: [],   // condition idles: no art, plain idle (Mala, 2026-10-27; EM1 spec said knee→KO but the ruling is newer)
    rest: [],                        // EM1: no rest art, plain idle
    "form-change": ["ultimate", "cast"],   // EM1
    clash: ["punch"],                // EM1: no beam-clash art, the punch
    stance: [],                      // EM1: no stance art, plain idle (idle-2 alternates ride variant())
  };
  const LABEL = { idle: "Idle", walk: "Walk", cast: "Cast", "cast-off": "Cast Off", "cast-def": "Cast Def", dodge: "Dodge", ultimate: "Ultimate", knockback: "Knockback", "dream-open": "Dream Open",
    block: "Block", punch: "Punch", "knocked-out": "Knocked out", enraged: "Enraged", knee: "Knee", hurt: "Hurt", infatuated: "Infatuated", aura: "Aura",
    rest: "Rest", "form-change": "Form Change", clash: "Clash", stance: "Stance" };

  function chain(slot) {
    const out = [slot, ...(FALLBACK[slot] || []), "idle"];
    return out.filter((p, i) => out.indexOf(p) === i);
  }
  // has(pose) → boolean. Required poses are assumed present when `has` is omitted.
  function resolve(slot, has = (p) => REQUIRED.includes(p)) {
    return chain(slot).find((p) => has(p)) || "idle";
  }

  // A hit landed. Someone holding a guard shows the guard (Mala confirmed, 2026-10-10); anyone else is knocked back,
  // which falls back to block art in packages without a knockback drawing.
  function hitPose(target = {}) {
    if (target.defeated) return "knocked-out";
    if (target.warded > 0 && !(target.amount > 0)) return "idle";   // a ward took all of it: the defender does not so much as flinch
    return target.guarding || target.status?.guard ? "block" : "knockback";
  }
  // Alternates. `count` is how many drawings the package has for this pose (1 = just pose.png). The same key
  // always gives the same drawing, so the map and the duel scene agree and nothing flickers between frames.
  function variant(pose, count = 1, key = "") {
    const n = Math.max(1, Math.floor(count) || 1); if (n === 1) return pose;
    let h = 2166136261; for (const ch of `${pose}|${key}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
    const i = (h >>> 0) % n;
    return i === 0 ? pose : `${pose}-${i + 1}`;
  }
  // How many drawings a package has for a pose, from its file list (["block", "block-2", "cast-off", ...]).
  function variantCount(pose, files = []) {
    let n = 1; while (files.includes(`${pose}-${n + 1}`)) n++;
    return n;
  }

  const isStrike = (src) => src.type === "strike" || src.ability === "strike" || src.effect === "strike" || /^strike$/i.test(src.name || "");
  // Helpful ⇒ Def. Harmful, or anything that changes terrain or objects ⇒ Off.
  function isHelpful(def = {}, src = {}) {
    const target = src.target || def.target || null, potency = Number(def.potency) || 0;
    if (target === "enemy") return false;
    if (target === "ally") return true;                              // heals and wards on an ally, whatever their size
    if (target === "tile" || target === "composite") return false;   // walls, earthworks, pruning, placed effects: terrain
    if (potency > 0) return false;                                   // a self-centred burst that damages
    if (["damage", "domain", "charge", "ambush"].includes(def.effect)) return false;
    return true;                                                     // self buffs, stances, reads
  }

  // src: { type, response, ability, name, effect, def }   def = the ability definition when there is one
  function route(src = {}) {
    if (src.pose) return src.pose;
    const def = src.def || {};
    if (src.type === "dreamSpace" || src.effect === "dreamSpace") return "dream-open";                                           // opening a Dream Space has its own pose
    if (src.type === "guard" || src.response === "guard" || src.effect === "guard" || def.effect === "guard") return "block";   // a guard technique blocks
    if (src.type === "respond" && src.response === "reposition" || src.dodge) return "dodge";
    if (["move", "jump", "climb"].includes(src.type) || src.effect === "move") return "walk";
    if (src.type === "grapple" || src.type === "throw") return "punch";                      // a Grapple reaches with the same arm
    if (isStrike(src)) return "punch";                               // a Strike is a punch even though its damage events carry ability: "strike"
    if (isHelpful(def, src)) return "cast-def";
    return (def.tier || src.tier) === "ultimate" ? "ultimate" : "cast-off";
  }

  // Which idle a unit shows (Mala, 2026-10-27): a charmed mind first, then a
  // bloodied body (under 40% LF), then a blazing bar (max ult), else plain.
  // Packages without the art fall back to idle through chain(), so the rule
  // is global and safe. infatuated waits on the Love mechanic's status.
  function idleFor(u = {}, ultMax = 100) {
    if (u.status?.infatuated) return "infatuated";
    if ((u.lf ?? 1) < (u.maxLF ?? 1) * 0.4) return "hurt";
    if ((u.ultimateCharge ?? 0) >= ultMax) return "aura";
    return "idle";
  }
  return { REQUIRED, OPTIONAL, FALLBACK, LABEL, ALL: ["idle", "walk", "cast", "cast-off", "cast-def", "dodge", "ultimate", "dream-open", "block", "punch", "knockback", "knocked-out", "knee", "hurt", "infatuated", "aura"], chain, resolve, route, isHelpful, isStrike, hitPose, idleFor, variant, variantCount };
});
