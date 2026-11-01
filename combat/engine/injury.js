"use strict";
// Body-part injuries, head/arms/legs slice (Mala, 2026-10-27; spec INJURY, sim 21/21).
// Overflow violence (one hit ≥25% maxLF) and aimed Strikes wound zones; wounds change
// options, not just numbers. Grades: wounded (effect + bleed 1) → maimed (bigger + bleed 2).
// MEND downgrades one grade, TEND stabilizes (stops bleed, keeps effects), rest heals the
// merely wounded at battle end; maimed needs MEND twice. Injuries persist past the battle.
// A part of the Concept Combat engine: engine.js installs it with the host object H.
// The pure half (no log, no rolls that matter) also ships standalone as
// ConceptCombatInjury (browser) / require().pure (node), because engine.js is
// under a hard char cap and cannot host the settle/load call sites:
//
//   fresh(saved)            → clean record, or a validated load from a saved one
//   begin(a, ch, opts)      → create-time seed (enemies always fresh)
//   gradeOf(a, zone)        → 0|1|2 (missing record reads all-zero: summons, clones, wilds)
//   woundedZones(a)         → zones holding an injury
//   maimedCount(a)          → zones at grade 2
//   bleedOf(s, a)           → LF the wounds drip at turn start (0 when stabilized)
//   settle(s)               → battle-end rest + per-character records for the account
//   moveBudget(s, a, base, flies) → legs through the move floor (wounded −1 to min 0; maimed 0; a flier ignores it; the installed half passes flies itself)
//   observeNotes(s, a, t)   → free wound details, newly-changed only
// Installed half (needs H): wound, overflow, bleedTick, downgrade, stabilize.
(function (root) {
  const ZONES = ["head", "arms", "legs"];
  const NAMES = { head: "head", arms: "arms", legs: "legs" };
  const R = (s) => s.rules.injury || {};
  const FRESH = () => ({ head: { g: 0, s: false, c: 0 }, arms: { g: 0, s: false, c: 0 }, legs: { g: 0, s: false, c: 0 } });
  function fresh(saved) {
    const f = FRESH();
    if (saved) for (const z of ZONES) if (saved[z] && typeof saved[z].g === "number" && saved[z].g > 0)
      f[z] = { g: Math.max(1, Math.min(2, saved[z].g)), s: !!saved[z].s, c: saved[z].c || 0 };
    return f;
  }
  const begin = (a, ch, opts) => fresh((a.side || ch.side) === "player" ? (opts.injuries || {})[a.character] : null);
  const gradeOf = (a, zone) => a?.injuries?.[zone]?.g || 0;
  const woundedZones = (a) => ZONES.filter((z) => gradeOf(a, z) > 0);
  const maimedCount = (a) => ZONES.filter((z) => gradeOf(a, z) === 2).length;
  function bleedOf(s, a) {
    const r = R(s);
    return ZONES.reduce((n, z) => { const w = a?.injuries?.[z]; if (!w || !w.g || w.s) return n; return n + (w.g === 2 ? (r.bleedMaimed ?? 2) : (r.bleedWounded ?? 1)); }, 0);
  }
  function restOne(w) {
    if (w.g === 1 && w.s) return { g: 0, s: false, c: 0 };   // stabilized wounded heals
    if (w.g === 1 && !w.s) return w.c >= 1 ? { g: 0, s: false, c: 0 } : { g: 1, s: false, c: w.c + 1 };   // flesh knits a battle later
    return w;   // maimed never heals by rest
  }
  function settle(s, prior = {}) {
    const records = JSON.parse(JSON.stringify(prior));   // return fix 2026-10-30: merge, never overwrite — the absent keep their wounds
    const fought = {}, seen = new Set();
    for (const a of Object.values(s.actors)) {
      if (!(a.character && a.side === "player" && !a.summon && !a.communed && !a.notArrived)) continue;
      seen.add(a.character);
      if (!woundedZones(a).length) continue;
      for (const z of ZONES) a.injuries[z] = restOne(a.injuries[z]);
      if (!woundedZones(a).length) continue;
      const rec = (fought[a.character] ||= FRESH());
      for (const z of ZONES) if (gradeOf(a, z) > (rec[z].g || 0)) rec[z] = { ...a.injuries[z] };   // same-character allies merge worst-first
    }
    for (const c of seen) { if (fought[c]) records[c] = fought[c]; else delete records[c]; }   // the fought rewrite their record (a healed zone leaves it); the absent are untouched
    return records;
  }
  function moveBudget(s, a, base, flies = false) {
    if (flies) return base;   // anything that flies ignores leg wounds (Mala, 2026-10-31)
    const g = gradeOf(a, "legs");
    if (g === 2) return 0;
    if (g === 1) return Math.max(0, base - (R(s).legsWoundedMove ?? 1));
    return base;
  }
  const SIGNS = { head: ["dazed, slow to answer", "badly dazed, barely answering"], arms: ["one-armed guard", "badly mauled guard"], legs: ["limping", "badly limping"] };
  function observeNotes(s, a, t) {
    const zones = woundedZones(t);
    if (!zones.length) return [];
    const sig = zones.map((z) => `${z}${gradeOf(t, z)}`).join(",");
    s.injuryNoticed ||= {};
    const seen = (s.injuryNoticed[a.id] ||= {});
    if (seen[t.id] === sig) return [];
    seen[t.id] = sig;
    return zones.map((z) => `${t.name} is ${SIGNS[z][gradeOf(t, z) - 1]}.`);
  }
  const pure = { ZONES, fresh, begin, gradeOf, woundedZones, maimedCount, bleedOf, settle, moveBudget, observeNotes };
  function install(H) {
    return (function () {
      const ensure = (a) => (a.injuries || (a.injuries = FRESH()));
      const gradeName = (g) => (g === 2 ? "maimed" : "wounded");
      function wound(s, src, tgt, zone, cause) {
        if (!tgt || tgt.defeated || !s.actors[tgt.id] || tgt.wild || tgt.awakened) return null;   // a woken structure has no body to wound (tsukumogami contact)
        const w = ensure(tgt)[zone];
        if (!w) return null;
        if (w.g >= 2) { H.log(s, { kind: "injury", actor: src?.id || null, target: tgt.id, text: `${src?.name || "The blow"} finds ${tgt.name}'s ${NAMES[zone]} already ruined: nothing new to break.`, why: ["A maimed zone holds no worse injury."] }); return null; }
        w.g += 1; w.s = false; w.c = 0;
        if (zone === "head" && tgt.focus) { tgt.focus = null; H.log(s, { kind: "injury", actor: src?.id || null, target: tgt.id, text: `${tgt.name}'s concentration shatters with the blow to the head: held Focus drops.` }); }
        H.log(s, { kind: "injury", actor: src?.id || null, target: tgt.id, text: `${src?.name || "The blow"} ${w.g === 2 ? "maims" : "wounds"} ${tgt.name}'s ${NAMES[zone]} (${cause === "called" ? "a called shot" : "overflow violence"}): ${gradeName(w.g)}.`, why: [`${tgt.name}'s ${NAMES[zone]} is ${gradeName(w.g)}${w.g === 2 ? " — the options there are gone" : ""}. MEND downgrades, TEND steadies the bleeding.`] });
        return w.g;
      }
      function overflow(s, src, tgt, dealt) {
        if (!tgt || tgt.defeated || dealt <= 0 || !s.actors[tgt.id] || tgt.wild || tgt.awakened) return null;
        const share = R(s).overflowShare ?? 0.25;
        if (dealt < (tgt.maxLF || 1) * share) return null;
        s.injuryN = (s.injuryN || 0) + 1;
        const zone = ZONES[Math.floor(H.seededChance(`${s.seed}:injury:${tgt.id}:${s.injuryN}`) * 3)];
        return wound(s, src, tgt, zone, "overflow");
      }
      function bleedTick(s, a) {
        const n = bleedOf(s, a);
        if (!n || !a || a.defeated) return false;
        a.lf = Math.max(0, a.lf - n);
        H.log(s, { kind: "bleed", actor: a.id, amount: n, tiles: [[a.x, a.y]], text: `${a.name} bleeds from their wounds (−${n} LF).` });
        H.concentrationCheck?.(s, a, n);
        if (a.lf <= 0) { a.defeated = true; H.log(s, { kind: "defeat", target: a.id, text: `${a.name} bleeds out from their wounds.` }); H.checkOutcome(s); return true; }
        return false;
      }
      const TIEBREAK = { legs: 0, arms: 1, head: 2 };
      function downgrade(s, a, t, zone) {
        const zones = woundedZones(t);
        if (!zones.length) return null;
        const pick = (zone && zones.includes(zone)) ? zone : zones.slice().sort((p, q) => gradeOf(t, q) - gradeOf(t, p) || TIEBREAK[p] - TIEBREAK[q])[0];
        const w = ensure(t)[pick];
        w.g -= 1;
        if (w.g <= 0) { t.injuries[pick] = { g: 0, s: false, c: 0 }; H.log(s, { kind: "heal", actor: a.id, target: t.id, text: `${t.name}'s ${NAMES[pick]} knits whole under ${a.name}'s care.` }); return { zone: pick, grade: 0 }; }
        H.log(s, { kind: "heal", actor: a.id, target: t.id, text: `${a.name} works over ${t.name}'s ${NAMES[pick]}: maimed → wounded.` });
        return { zone: pick, grade: w.g };
      }
      function stabilize(s, a, t) {
        const zones = woundedZones(t).filter((z) => !t.injuries[z].s);
        if (!zones.length) return null;
        for (const z of zones) t.injuries[z].s = true;
        s.tendRaised ||= {}; s.tendRaised[t.id] = 1;   // the stabilized flag shares TEND's once-each clock
        H.log(s, { kind: "verb", verb: 9, actor: a.id, target: t.id, text: `${a.name} steadies ${t.name}: the bleeding stops, the wounds stay. (${zones.map((z) => NAMES[z]).join(", ")})` });
        return zones;
      }
      // Legs and the dodge (Mala, 2026-10-31): wounded legs shorten the dodge step by the same 1; maimed legs leave a one-tile dodge at
      // double cost (the middle ground between no dodge and a full one). Fliers ignore it all.
      const flier = (a) => !!H.ClassRuntime?.flies?.(a);
      const legsMove = (s, a, base) => pure.moveBudget(s, a, base, flier(a));
      function dodgeReach(s, d) {
        const base = s.rules.repositionTiles;
        if (flier(d) || gradeOf(d, "legs") === 0) return base;
        return gradeOf(d, "legs") === 2 ? Math.min(base, R(s).legsMaimedDodgeTiles ?? 1) : Math.max(0, base - (R(s).legsWoundedMove ?? 1));
      }
      const dodgeCost = (s, d, cost) => (!flier(d) && gradeOf(d, "legs") === 2 ? cost * (R(s).legsMaimedDodgeMult ?? 2) : cost);
      return { Injury: { ...pure, moveBudget: legsMove, dodgeReach, dodgeCost, wound, overflow, bleedTick, downgrade, stabilize } };
    })();
  }
  if (typeof module === "object" && module.exports) { module.exports = install; module.exports.pure = pure; }
  else { (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).injury = install; root.ConceptCombatInjury = pure; }
})(typeof self !== "undefined" ? self : this);
