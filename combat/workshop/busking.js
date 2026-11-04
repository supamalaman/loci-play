"use strict";
// Busking (W6.5 build): power wants witnesses, and witnesses pay. The hat in
// the town square (glamour check, fame track, tomato marks) plus showboat
// style bonuses for crowd battles, judged at the victory ledger.
//
// INPUT HONESTY: glamourAdd reads live in parley (W4.3), but the busk check
// keeps its own provisional grounding until the input table is tuned:
// glamour worn as a concept (3/2) + dressed gear (+1 a piece) + glow hook
// (0 until Glow dishes land). The
// MECHANISM (tiers, fame slope, cap, cycle, tomato, showboat menu) is exact;
// the input table in RULES.input is tuner-provisional.
//
//   RULES                              → tunables (tiers, fame, cap, cycle, inputs)
//   glamourOf(loadout, gearCount)      → provisional glamour score
//   crowdDiff(cycle, fame)             → seeded base 2..6 + fame (no farmed rooms)
//   tiers(g)                           → 0/10/20/30/40 at 0/2/4/6/8
//   busk(account, glamour)             → { ok, paid, fameUp, mark, account, lines }
//   showboat({ nodmg, vow, knee, sub, ann }) → min(40, 10/10/15/10/5)   (ann: announced titles, W9.5)
//   crowdBattle(themedId, themes)      → stage Showdown or a crowd-flagged theme
//   judgeShowboat(s, vowsKept)         → { nodmg, vow, knee, sub, ann, total }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatWorkshopBusking = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = { perCycle: 1, famePts: 2, fameMax: 5, famePay: 5, capTotal: 55, showCap: 40,
    show: { nodmg: 10, vow: 10, knee: 15, sub: 10, ann: 5 }, kneeFrac: 0.25, annCap: 2,
    input: { glamPrimary: 3, glamSecondary: 2, perGear: 1 }, diffBase: 2, diffSpan: 5 };

  const glamourOf = (loadout = {}, gearCount = 0, glow = 0) =>
    (loadout.primary === "glamour" ? RULES.input.glamPrimary : loadout.secondary === "glamour" ? RULES.input.glamSecondary : 0)
    + gearCount * RULES.input.perGear + glow;
  // Deterministic per cycle (mulberry32): the room changes, but never farms.
  const seeded01 = (n) => { let t = (n + 0x6D2B79F5) >>> 0; for (let i = 0; i < 3; i++) t = Math.imul(t ^ (t >>> 15), t | 1); return ((t ^= t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0) / 4294967296; };
  const crowdDiff = (cycle, fame) => RULES.diffBase + Math.floor(seeded01(cycle) * RULES.diffSpan) + fame;
  const tiers = (g) => (g >= 8 ? 40 : g >= 6 ? 30 : g >= 4 ? 20 : g >= 2 ? 10 : 0);

  function busk(account, glamour) {
    const cycle = account?.battles || 0, bc = account?.buskCycle;
    if (bc && bc.cycle === cycle && bc.busked >= RULES.perCycle)
      return { ok: false, error: "The hat fills once a cycle. Battle on.", account, paid: 0, lines: [] };
    const a = { seeds: 0, fame: 0, marks: [], buskCycle: { cycle: -1, busked: 0 }, ...account };
    const fame = Math.min(RULES.fameMax, a.fame || 0);
    const diff = crowdDiff(cycle, fame), eff = glamour + fame - diff;
    const base = { ...a, buskCycle: { cycle, busked: 1 } };
    if (eff < 0) return { ok: true, paid: 0, fameUp: false, famePts: 0, mark: "tomatoed",
      lines: [`Busked to a hard room (difficulty ${diff} vs ${glamour + fame}): tomatoes. The ledger remembers.`],
      account: { ...base, marks: [...(base.marks || []), "tomatoed"].slice(-50) } };
    const paid = Math.min(RULES.capTotal, tiers(glamour) + fame * RULES.famePay);
    // Fame F0b (FAME.md section 1): the hat no longer raises the level; it returns famePts and ui.js feeds them to Fame.add.
    return { ok: true, paid, fameUp: false, famePts: RULES.famePts, mark: null,
      lines: [`Busked the square: +${paid} Seeds${fame >= RULES.fameMax ? " · legend" : ` · fame +${RULES.famePts} points`}.`],   // at the top level the hat still says legend (FAME.md section 6 item 11, a GUARD)
      account: { ...base, seeds: base.seeds + paid } };
  }
  const showboat = ({ nodmg = 0, vow = 0, knee = 0, sub = 0, ann = 0 } = {}) =>
    Math.min(RULES.showCap, nodmg * RULES.show.nodmg + vow * RULES.show.vow + knee * RULES.show.knee + sub * RULES.show.sub + ann * RULES.show.ann);
  const crowdBattle = (themedId, themes) => themedId === "stage" || !!themes?.[themedId]?.crowd;
  // Judged at the victory ledger: clean rounds, kept vows, a knee-win, spared foes.
  function judgeShowboat(s, vowsKept = 0) {
    const playerIds = new Set(Object.values(s.actors || {}).filter((a) => a.side === "player").map((a) => a.id));
    const hurtRounds = new Set((s.log || []).filter((e) => e.kind === "damage" && playerIds.has(e.target)).map((e) => e.round));
    const rounds = [];
    for (let r = 1; r <= (s.round || 1); r++) if (!hurtRounds.has(r)) rounds.push(r);
    const hero = s.actors?.player;
    const knee = hero && hero.lf <= hero.maxLF * RULES.kneeFrac ? 1 : 0;
    const sub = Object.values(s.actors || {}).filter((a) => a.side === "enemy" && a.submitted).length;
    const conds = { nodmg: rounds.length, vow: vowsKept, knee, sub, ann: Math.min(s.crowdHeat?.player || 0, RULES.annCap) };   // W9.5: announced titles warm the crowd
    return { ...conds, total: showboat(conds) };
  }
  return { RULES, glamourOf, crowdDiff, tiers, busk, showboat, crowdBattle, judgeShowboat };
});
