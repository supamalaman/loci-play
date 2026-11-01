"use strict";
// Boss rush (Mala, approved 2026-10-13; spec docs/boss-rush.md). Every Omega threat, one fight after another on the
// 15×9 Warfare Field. A win offers Continue fighting; a loss ends the run; clearing the list writes Boss Rush (N).
// Pure functions: the UI keeps the run between battles and saves what record() returns on the account.
//
// Omega is a flag: `omega: true` on a boss in bosses/boss-data.js or on a character in content.js. ORDER only sorts;
// a newly flagged id joins the end of the list.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../content.js"), require("../bosses/boss-data.js"));
  else root.ConceptCombatBossRush = factory(root.ConceptCombatContent, root.ConceptCombatBossData);
})(typeof self !== "undefined" ? self : this, function (C, BD) {
  const ORDER = ["dragon", "oni", "kaiju", "emissary", "gaia", "agi", "tech_billionaire"];
  const ARENA = "warfareField";
  const AT = { player: [1, 4], ally: [1, 5], boss: [11, 3], foe: [12, 4] };
  const BRAIN_CHIP = "brainChip";
  // Rush fighters that are not Omega-flagged: a character in a boss version. The Anime Protagonist with the full Soul
  // Choir (docs/anime-orbit.md §4; Mala, 2026-10-28: "add him to the boss rush"). He joins the end; he drops no orb.
  const EXTRAS = [{ id: "anime_choir", kind: "character", character: "anime_protagonist", orbit: "choir", name: "Anime Protagonist · Soul Choir" }];

  // [{ id, kind: "boss" | "character", name }] in fight order.
  function list() {
    const flagged = [
      ...Object.entries(BD.bosses).filter(([, b]) => b.omega && b.rush !== false).map(([id, b]) => ({ id, kind: "boss", name: b.forms?.[b.startForm]?.name || b.name })),
      ...Object.entries(C.characters).filter(([, c]) => c.omega).map(([id, c]) => ({ id, kind: "character", name: c.name })),
      ...EXTRAS.filter((e) => C.characters[e.character]).map((e) => ({ ...e })),
    ];
    const rank = (id) => (ORDER.includes(id) ? ORDER.indexOf(id) : EXTRAS.some((e) => e.id === id) ? ORDER.length + 1 : ORDER.length);   // extras after every Omega threat
    return flagged.sort((a, b) => rank(a.id) - rank(b.id) || (a.id < b.id ? -1 : 1));
  }
  const badge = (n) => `Boss Rush (${n})`;

  // Who can come along (Mala, 2026-10-14: "you should be able to choose one ally to bring with you through the rush"):
  // any roster fighter with configurations, except the Omega threats themselves.
  const allies = () => Object.entries(C.characters).filter(([id, c]) => id !== "warden" && c.configs && !c.randomEventOnly && !c.omega).map(([id, c]) => ({ id, name: c.name }));
  // A new run: the list is fixed when it starts, so a flag added mid-run does not change it. The ally is chosen once and
  // fights every battle of the run, fresh each time like you.
  function begin(seed = 0, { ally = null } = {}) {
    return { ids: list().map((e) => e.id), index: 0, seed: seed >>> 0, fell: [], orbs: [], ally: allies().some((a) => a.id === ally) ? ally : null };
  }
  const current = (run) => list().find((e) => e.id === run.ids[run.index]) || null;

  // The opponent for this fight. Bosses enter as the makeBoss body (2×2 unless authored smaller); Gaia enters as the
  // Living Accord, as she starts (Mala, 2026-10-14), and the player's wounds to the land or ENRAGED turn her into the
  // Wounded Ground (engine/land.js). She stays enemy-side in either form: a battle's outcome counts only the player and
  // enemy sides, so a wild-side Gaia alone on the field would end the fight in round one. The AGI and the Tech Billionaire are ordinary 1v1 fights.
  function opponent(entry) {
    if (entry.kind === "character") return { id: "opponent", character: entry.character || entry.id, side: "enemy", at: AT.foe.slice(), ...(entry.orbit ? { orbit: entry.orbit } : {}) };
    const b = BD.bosses[entry.id], form = b.forms?.[b.startForm];
    return { id: `boss-${entry.id}`, character: `boss-${entry.id}`, boss: entry.id, side: "enemy",
      at: AT.boss.slice(), size: { ...(form?.size || b.size) }, maxLF: b.lf, startingLF: b.lf,
      ...(form ? { name: form.name } : {}), ...(entry.id === "gaia" ? { sprite: "gaia-accord" } : {}) };
  }

  // E.create options for the run's current fight: fresh each time (full Life Force, no carried wounds), seed stepped by
  // one per fight, classic defeat, and bossRush so the Tech Billionaire's data center is standing on turn one.
  function battleOptions(run) {
    const entry = current(run); if (!entry) return null;
    const step = run.index + 1;
    return { encounter: "bossRush", mode: "classic", bossRush: true, seed: (run.seed + run.index) >>> 0, startingActor: "player",
      title: `Boss rush · ${step} of ${run.ids.length} · ${entry.name}`,
      participants: [{ id: "player", character: "warden", side: "player", at: AT.player.slice() },
        ...(run.ally ? [{ id: "companion", character: run.ally, side: "player", at: AT.ally.slice() }] : []), opponent(entry)] };
  }

  // What a won fight keeps: that boss's orb, or the Brain Chip for a transcended AGI. Nothing on a loss, nothing for an
  // AGI that never transcended, nothing for the Tech Billionaire. (The Brain Chip is already counted by Account.orbsWonIn,
  // which runs on every win, so the UI adds only orbFor's boss orbs; this returns both for the record and the tests.)
  function orbFor(entry, state) {
    if (!entry || state?.outcome?.winner !== "player") return null;
    if (entry.kind === "boss") return BD.bosses[entry.id].orb || null;
    if (entry.id === "agi") return (state.brainChips || 0) > 0 ? BRAIN_CHIP : null;
    return null;
  }
  const orbName = (id) => (id === BRAIN_CHIP ? "Brain Chip" : BD.orbs?.[id]?.name || id);

  // After a fight: "next" (a win with another threat left), "cleared" (the last one fell), or "over" (a loss, a draw,
  // or the round limit). The run comes back advanced; the UI shows Continue fighting only for "next".
  function afterBattle(run, state) {
    const entry = current(run), won = state?.outcome?.winner === "player", orb = orbFor(entry, state);
    const next = { ...run, fell: won ? [...run.fell, entry.id] : run.fell.slice(), orbs: orb ? [...run.orbs, orb] : run.orbs.slice() };
    if (!won) return { result: "over", run: { ...next, stoppedBy: entry?.id || null }, orb: null };
    if (run.index + 1 >= run.ids.length) return { result: "cleared", run: { ...next, index: run.index + 1 }, orb, badge: badge(run.ids.length) };
    return { result: "next", run: { ...next, index: run.index + 1 }, orb };
  }

  // The account's record: every run, and the highest clear. A loss writes no badge; an old badge never grows by itself.
  const recordOf = (account) => ({ runs: (account?.bossRush?.runs || []).slice(), best: account?.bossRush?.best || 0 });
  function record(account, run, result, at = Date.now()) {
    const was = recordOf(account), names = run.ids.map((id) => list().find((e) => e.id === id)?.name || id);
    const cleared = result === "cleared", n = run.ids.length;
    const entry = { at, cleared, n, ids: run.ids.slice(), names, fell: run.fell.slice(), stoppedBy: cleared ? null : run.stoppedBy || null,
      ally: run.ally ? { id: run.ally, name: C.characters[run.ally]?.name || run.ally } : null,
      ...(cleared ? { badge: badge(n) } : {}) };
    return { ...account, bossRush: { runs: [...was.runs, entry], best: cleared ? Math.max(was.best, n) : was.best } };
  }
  const bestBadge = (account) => (recordOf(account).best ? badge(recordOf(account).best) : null);

  return { ORDER, ARENA, AT, list, allies, badge, begin, current, opponent, battleOptions, orbFor, orbName, afterBattle, record, recordOf, bestBadge };
});
