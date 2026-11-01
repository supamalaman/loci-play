"use strict";
// Conversion modes (W1.4 build): one flip mechanic with MODES. The converted
// don't just stand down — they ACT (one budgeted contribution), then they're
// out (spared, converted mark). Requires a broken will (lost mind-duel +
// willpower 0), a converter, and a declared mode (Talk ▸ Convert).
//   RULES                                    → tunables (base, bond/rival/truth weights, loop rounds)
//   MODES                                    → bond / truth / loop / edit
//   chanceOf({ bonds, rival, truth })        → clamped flip chance (sim-faithful)
//   canFlip(s, H, a, t, mode)                → refusal reason or null
//   resolveFlip(s, H, a, t, mode)            → { ok, marks } (seeded; sets the one-check flag)
//   actsFor(s, t)                            → available acts in priority order (revive > release > reinforce)
//   executeAct(s, H, a, t, act)              → { ok, lines } (performs the budgeted act)
//   roundHook(s, H)                          → beginRound: looped contrition + serve expiry (turns.js calls it)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatConversion = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = { base: 0.5, bondAdd: 0.2, rivalSub: 0.25, truthAdd: 0.15, loopRounds: 3, min: 0.05, max: 0.95, convertAp: 25 };
  const MODES = ["bond", "truth", "loop", "edit"];
  const chanceOf = ({ bonds = false, rival = false, truth = false } = {}) =>
    Math.max(RULES.min, Math.min(RULES.max, RULES.base + (bonds ? RULES.bondAdd : 0) - (rival ? RULES.rivalSub : 0) + (truth ? RULES.truthAdd : 0)));
  const seed01 = (seed, tag) => { let h = 2166136261; for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const bonds = (s, H, a, t) => !!H.Bonds?.maxFriends?.(a, t);
  const rival = (H, t) => H.hasTrait(t, "rivalrous");
  const truthWield = (a) => a?.primary === "truthsaying" || a?.secondary === "truthsaying";
  const UNDEAD = new Set(["vampire", "mummy", "skeleton", "zombie", "ghost"]);   // ruling 5 (2026-10-26): the unliving can't be flipped. Frankenstein stays flippable (brought to life by the current — enemy-dreams-data.js galvanized); the werewolf is living
  const isUndead = (t) => !!(t?.dream && (UNDEAD.has(t.monster) || UNDEAD.has(t.dream?.key) || UNDEAD.has(t.character)));   // makeDreamActor sets dream.key, not monster (audit 1.3.452)
  function canFlip(s, H, a, t, mode) {
    if (!t || t.defeated || t.side === a.side) return "Only a standing enemy can be converted.";
    if (isUndead(t)) return "The unliving can't be flipped: Talk can't reach the dead (the words are spent).";
    if (!MODES.includes(mode)) return "No such conversion mode.";
    if (!t.mindBroken) return "Their will isn't broken: win a mind-duel first.";
    if ((t.willpower ?? 1) > 0) return "Their will bent but held (willpower above 0): only a true break flips.";
    if (t.convertChecked === t.mindBroken.round) return "One check per break: this break has been tried.";
    if (H.Parley?.language?.(a, t)) return H.Parley.language(a, t);   // speech gates: mindless/beasts (parley precedent)
    if (mode === "bond" && !bonds(s, H, a, t) && !rival(H, t)) return "Bond-flip needs a bond — or a rival to dark-mirror.";
    return null;
  }
  function resolveFlip(s, H, a, t, mode) {
    const no = canFlip(s, H, a, t, mode);
    if (no) return { ok: false, reason: no };
    t.convertChecked = t.mindBroken.round;   // the check is spent even in failure
    if (mode === "loop") {
      t.status.looped = { left: RULES.loopRounds, converter: a.id };
      H.log(s, { kind: "insight", actor: a.id, target: t.id, text: `${a.name} folds ${t.name} into the loop: reform or endure ${RULES.loopRounds} rounds. Endurance is an answer!` });
      return { ok: true, looped: true, marks: ["converted"] };
    }
    const p = chanceOf({ bonds: bonds(s, H, a, t), rival: rival(H, t), truth: mode === "truth" && truthWield(a) });
    const ok = seed01(s.seed, `convert:${a.id}>${t.id}:${mode}:${s.round}`) < p;
    if (!ok) { H.log(s, { kind: "insight", actor: a.id, target: t.id, text: `${t.name} refuses the ${mode}-flip (needed ${Math.round(p * 100)}%): conversion CAN fail.` }); return { ok: false }; }
    const marks = mode === "edit" ? ["converted", "forgery", "cruelty"] : ["converted"];
    return { ok: true, marks };
  }
  function actsFor(s, t) {
    const acts = [];
    const fallen = Object.values(s.actors || {}).find((u) => u.side === "player" && u.defeated && !u.escaped && !u.summon);
    if (fallen) acts.push("revive");   // Nagato: a fallen ally waits
    const auraHeld = Object.values(s.actors || {}).some((u) => u.side !== "player" && !u.defeated && u.aura);
    const fxHeld = (s.terrainEffects || []).some((e) => s.actors[e.owner]?.side !== "player");
    if (auraHeld || fxHeld) acts.push("release");   // Itachi: something maintained to unmake
    acts.push("reinforce");
    return acts;
  }
  function executeAct(s, H, a, t, act) {
    if (act === "revive") {
      const fallen = Object.values(s.actors || {}).find((u) => u.side === "player" && u.defeated && !u.escaped && !u.summon);
      if (!fallen) return { ok: false };
      fallen.defeated = false; fallen.spent = false; fallen.lf = Math.max(1, Math.ceil((fallen.maxLF || 10) / 2));
      s.corpses = (s.corpses || []).filter((c) => c.of !== fallen.id);
      H.log(s, { kind: "insight", actor: t.id, target: fallen.id, text: `${t.name} spends the conversion: ${fallen.name} breathes again (${fallen.lf} LF). The converted act, then they're out.` });
      return { ok: true };
    }
    if (act === "release") {
      const held = Object.values(s.actors || {}).find((u) => u.side !== "player" && !u.defeated && u.aura);
      if (held) { const art = held.aura.art || held.aura.kind || "aura"; held.aura = null; H.log(s, { kind: "insight", actor: t.id, target: held.id, text: `${t.name} spends the conversion: ${held.name}'s ${art} gutters out.` }); return { ok: true }; }
      const fx = (s.terrainEffects || []).find((e) => s.actors[e.owner]?.side !== "player");
      if (fx) { s.terrainEffects = s.terrainEffects.filter((e) => e !== fx); H.log(s, { kind: "insight", actor: t.id, text: `${t.name} spends the conversion: the maintained working comes undone.` }); return { ok: true }; }
      return { ok: false };
    }
    // reinforce: serve one round beside the converter (side flips; roundHook submits after), or a boon if serving decides nothing
    const foes = Object.values(s.actors || {}).filter((u) => u.side !== "player" && !u.defeated && u.id !== t.id);
    if (!foes.length) {
      a.inspiration = Math.max(a.inspiration || 0, Math.min(s.rules?.inspiration?.cap ?? 3, (a.inspiration || 0) + 1));   // a gain never trims a crown above the cap (J6)
      H.log(s, { kind: "insight", actor: t.id, target: a.id, text: `${t.name} spends the conversion: no fight left to join, so a boon instead (+1 Inspiration).` });
      return { ok: true };
    }
    t.side = "player"; t.convertServeUntil = s.round + 1; t.convertedBy = { by: a.id, round: s.round };
    H.log(s, { kind: "insight", actor: t.id, text: `${t.name} turns: fights beside ${a.name} for one round, then out.` });
    return { ok: true };
  }
  function convertedOut(s, H, a, t, mode, marks, stay = false) {
    t.convertedBy = { by: a.id, mode, round: s.round };
    (s.convertLedger ||= []).push({ who: t.id, by: a.id, how: mode, round: s.round });   // conversion reads!
    if (mode === "edit") (s.convertMarks ||= []).push("forgery", "cruelty");   // C4: the game remembers (battle-end ledgers to the account)
    if (!stay) H.submitFoe(s, a, t, `${t.name} was converted (${mode}-flip) and is out.`);
  }
  function roundHook(s, H) {
    for (const u of Object.values(s.actors || {})) {
      if (u.defeated) continue;
      const loop = u.status?.looped;
      if (loop && !u.convertedBy) {
        const c = s.actors[loop.converter];
        const p = chanceOf({ bonds: c ? bonds(s, H, c, u) : false, rival: rival(H, u) });
        if (c && !c.defeated && seed01(s.seed, `contrite:${u.id}:${s.round}`) < p) {
          u.status.looped = null; u.convertedBy = { by: c.id, mode: "loop", round: s.round };
          (s.convertLedger ||= []).push({ who: u.id, by: c.id, how: "loop", round: s.round });
          const act = actsFor(s, u)[0]; executeAct(s, H, c, u, act);
          H.log(s, { kind: "insight", actor: u.id, text: `${u.name} chooses better inside the loop: converted.` });
          H.submitFoe(s, c, u, `${u.name} chose better and is out.`);
        } else if (--loop.left <= 0) {
          u.status.looped = null; u.mindBroken = null; u.willpower = Math.max(1, u.willpower || 0);
          H.log(s, { kind: "insight", actor: u.id, text: `${u.name} endures the loop to its end: free, will knit whole (1 willpower).` });
        }
      }
      if (u.convertServeUntil && s.round >= u.convertServeUntil && !u.defeated) {
        u.convertServeUntil = null;
        H.submitFoe(s, s.actors[u.convertedBy?.by] || u, u, `${u.name}'s round of service is done: out, spared.`);
      }
    }
  }
  return { RULES, MODES, UNDEAD, isUndead, chanceOf, canFlip, resolveFlip, actsFor, executeAct, convertedOut, roundHook };
});
