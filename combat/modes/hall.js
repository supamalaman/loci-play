"use strict";
// Hall of Warriors (Mala, 2026-10-09): "when you beat the vignettes with a particular class there should be a reward or
// a badge or a hall of warriors or something and a countdown to encourage the player to beat the vignettes with every
// class".
//
// Each class that wins the vignette campaign enters the Hall: a badge, Seeds for the first win, and milestone rewards
// (titles + Seeds) as the Hall fills. The countdown is the classes still to go and the wins to the next milestone.
// Rewards wait in `pendingSeeds` until the app can pay them into the account (after the battle UI has closed).
//
//   create()                         empty hall           eligible(characters) → [{ id, name, sprite }] playable classes
//   recordWin(hall, id, info, now)   → { hall, entered, lines }   first win per class pays; repeats only count
//   progress(hall, roster)           → { done, total, left, next, nextIn, titles, entries }
//   takePending(hall)                → { hall, seeds }    (the app adds them to the account)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatHall = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const FIRST_WIN_SEEDS = 40;
  const MILESTONES = [
    { at: 1, title: "Entered the Hall", seeds: 0 },
    { at: 5, title: "Initiate of the Hall", seeds: 100 },
    { at: 10, title: "Veteran of the Quiet House", seeds: 200 },
    { at: 20, title: "Keeper of Many Verdicts", seeds: 400 },
    { at: 30, title: "Witness to Every Room", seeds: 600 },
    { at: "all", title: "Every Path Walked", seeds: 1500 },
  ];
  const SPRITE = { warden: "player" };   // the rest use the character's own sprite folder

  const create = () => ({ v: 1, entries: {}, milestones: [], pendingSeeds: 0 });
  const valid = (h) => !!h && h.v === 1 && h.entries && typeof h.entries === "object" && Array.isArray(h.milestones);

  function eligible(characters = {}) {
    return Object.entries(characters)
      .filter(([id, c]) => id === "warden" || (!c.randomEventOnly && c.configs?.length))
      .map(([id, c]) => ({ id, name: c.name || id, sprite: SPRITE[id] || c.sprite || id }))
      .sort((a, b) => (a.id === "warden" ? -1 : b.id === "warden" ? 1 : a.name.localeCompare(b.name)));
  }
  const milestoneAt = (m, total) => (m.at === "all" ? total : m.at);

  function recordWin(hall, id, info = {}, now = Date.now(), total = 40) {
    const h = valid(hall) ? structuredClone(hall) : create(), lines = [];
    const prior = h.entries[id], name = info.name || id;
    h.entries[id] = { wins: (prior?.wins || 0) + 1, first: prior?.first || now, last: now,
      recognition: info.recognition || prior?.recognition || null, branch: info.branch || prior?.branch || null };
    if (prior) return { hall: h, entered: false, lines: [`${name} wins the Quiet House again (${h.entries[id].wins} wins). The badge is already in the Hall.`] };
    h.pendingSeeds += FIRST_WIN_SEEDS;
    lines.push(`${name} enters the Hall of Warriors. Badge earned · +${FIRST_WIN_SEEDS} Seeds.`);
    const done = Object.keys(h.entries).length;
    for (const m of MILESTONES) {
      const at = milestoneAt(m, total), key = String(m.at);
      if (done >= at && !h.milestones.includes(key)) {
        h.milestones.push(key); h.pendingSeeds += m.seeds;
        lines.push(`Milestone · ${at} class${at === 1 ? "" : "es"}: “${m.title}”${m.seeds ? ` · +${m.seeds} Seeds` : ""}.`);
      }
    }
    return { hall: h, entered: true, lines };
  }

  function progress(hall, roster) {
    const h = valid(hall) ? hall : create(), total = roster.length;
    const done = roster.filter((c) => h.entries[c.id]).length;
    const next = MILESTONES.map((m) => ({ ...m, at: milestoneAt(m, total) })).find((m) => m.at > done) || null;
    return { done, total, left: total - done, next, nextIn: next ? next.at - done : 0,
      titles: MILESTONES.filter((m) => h.milestones.includes(String(m.at))).map((m) => m.title),
      entries: roster.map((c) => ({ ...c, entry: h.entries[c.id] || null })) };
  }
  function takePending(hall) {
    const h = valid(hall) ? structuredClone(hall) : create(), seeds = h.pendingSeeds || 0;
    h.pendingSeeds = 0; return { hall: h, seeds };
  }

  return { FIRST_WIN_SEEDS, MILESTONES, create, valid, eligible, recordWin, progress, takePending };
});
