"use strict";
// Presence path (W2.1 build): win without a blow. Declare (Rituals), break
// every standing enemy's willpower to 0 with zero LF dealt by your hands,
// take a knee (Rest) for a personal victory (ledger: overawed). The
// restriction is Glamour's law worn as a vow: deal LF and the path shatters
// (declaration void + 25 breach AP + ledger note). Commanded summons count
// as your hands; allies' damage doesn't. Talk/mind-duel openers strike
// first: while held, the declarer opens every round.
//   RULES                          → tunables (costs, breach, gates, caps)
//   beautyOf(actor)                  → glamour equipped + glamourAdd + display shine
//   pressure(att, def)               → 2 + max(0, beauty gap), willpower only
//   declare(s, H, id)                → opens s.presence { declarer, declRound }
//   noteLf(s, H, srcId, dealt)       → shatters on the declarer's LF (hands + commanded)
//   objectiveMet(s)                  → all standing enemies broken, 0 LF, unshattered
//   breakWill(s, H, foe, by)         → stand-down + inspiration tithe + log
//   roundHook(s, H)                  → the held declarer opens the round
//   kneel(s, H, id)                  → personal victory by presence (overawed)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatPresence = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = {
    declareAp: 20, displayAp: 25, displayPf: 2, deathVisionAp: 40, deathVisionPf: 6, kneeAp: 10,
    displayBase: 2, displayBeautyCap: 3, breachAp: 25,
    deathVisionBase: 5, deathVisionMaxWpGap: 4, mindlessCap: 1, bypassBeauty: 3,
  };
  const GLAMOUR = "glamour";
  function beautyOf(a) {
    if (!a) return 0;
    const worn = (a.primary === GLAMOUR || a.secondary === GLAMOUR) ? 1 : 0;
    return worn + (a.passives?.glamourAdd || 0) + Math.min(RULES.displayBeautyCap, a.status?.displayBeauty || 0);
  }
  function pressure(att, def) {
    return RULES.displayBase + Math.max(0, beautyOf(att) - beautyOf(def));
  }
  const isMindless = (t) => (t?.traits || []).some((x) => (typeof x === "string" ? x : x?.id) === "mindless" || (typeof x === "string" ? x : x?.id) === "beast");
  const state = (s) => s.presence || null;
  const standingFoes = (s, id) => Object.values(s.actors || {}).filter((u) => !u.defeated && u.side === "enemy" && u.id !== id);

  function declare(s, H, id) {
    const a = s.actors[id];
    if (!a || a.defeated) return { ok: false, error: "No one left to declare." };
    s.presence = { declarer: id, declRound: s.round, lfDealt: 0, shattered: false };
    H.log(s, { kind: "presence", actor: id, text: `${a.name} declares Presence: they will kneel. Zero blows; the will breaks or the path does.` });
    return { ok: true };
  }
  const commandedBy = (s, srcId) => s.actors[srcId]?.summon?.owner || null;
  function noteLf(s, H, srcId, dealt) {
    const p = state(s);
    if (!p || p.shattered || !(dealt > 0)) return;
    if (srcId !== p.declarer && commandedBy(s, srcId) !== p.declarer) return;   // allies' damage isn't yours; commanded hands are
    p.lfDealt += dealt;
    p.shattered = true;
    const a = s.actors[p.declarer];
    if (a && !a.defeated) a.tempo = Math.max(0, (a.tempo || 0) - RULES.breachAp);
    (s.vowsBroken ||= []).push({ actor: p.declarer, round: s.round, path: "presence" });
    H.log(s, { kind: "presence", actor: p.declarer, text: `The path shatters: ${a?.name || "the declarer"} dealt harm. The declaration is void (−${RULES.breachAp} AP).` });
  }
  function objectiveMet(s) {
    const p = state(s);
    if (!p || p.shattered || p.lfDealt > 0) return false;
    const foes = standingFoes(s, p.declarer);
    return foes.length > 0 && foes.every((u) => (u.willpower ?? 10) <= 0);
  }
  function breakWill(s, H, foe, by) {
    if (!foe || foe.defeated || foe.status?.brokenWill) return false;
    foe.status = foe.status || {};
    foe.status.brokenWill = { by, round: s.round };
    foe.standDownUntil = 9999;   // broken: out of the fight, like the mind-duel loser who stands down
    const dec = s.actors[by];
    if (dec && !dec.defeated) dec.inspiration = Math.max(dec.inspiration || 0, Math.min(s.rules?.inspiration?.cap ?? 3, (dec.inspiration || 0) + 1));   // a gain never trims a crown above the cap (J6)
    H.log(s, { kind: "presence", actor: by, target: foe.id, text: `${foe.name} breaks: willpower 0. They stand down; ${dec?.name || "the presenter"} takes +1 inspiration.` });
    return true;
  }
  function roundHook(s, H) {
    const p = state(s);
    if (!p || p.shattered) return;
    const d = s.actors[p.declarer];
    if (!d || d.defeated || !s.order.includes(p.declarer)) return;
    s.order = [p.declarer, ...s.order.filter((id) => id !== p.declarer)];
    H.log(s, { kind: "presence", actor: p.declarer, text: "Presence goes before argument: the declarer opens the round." });
  }
  function kneel(s, H, id) {
    const p = state(s);
    if (!p || p.declarer !== id) return { ok: false, error: "No held path to kneel on." };
    if (p.shattered || p.lfDealt > 0) return { ok: false, error: "The path is shattered: harm was dealt." };
    if (!objectiveMet(s)) return { ok: false, error: "Not all standing enemies are broken." };
    (s.vowsKept ||= []).push({ actor: id, round: p.declRound });
    s.presenceWon = { declRound: p.declRound, mark: "overawed" };
    s.outcome = { winner: "player", reason: "presence", text: `${s.actors[id]?.name || "The presenter"} takes a knee: every enemy broken, not a blow dealt. Victory by presence.` };
    s.phase = "over";
    H.log(s, { kind: "presence", actor: id, text: s.outcome.text });
    return { ok: true };
  }
  return { RULES, beautyOf, pressure, isMindless, declare, noteLf, objectiveMet, breakWill, roundHook, kneel };
});
