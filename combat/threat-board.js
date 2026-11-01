"use strict";
// Threat leaderboard (docs/threat-ratings.md): the rated table as data, for the
// setup screen's Top-15 board and its challenge buttons. Rows mirror the doc's
// Control ladder section; tiers reuse the doc's bands. Update this file when the doc
// gains a row — never the reverse (ratings are earned by sim, not edited here).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatThreatBoard = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // Bands from tools/rate-threat.mjs BANDS (docs/threat-ratings.md): 15pp steps
  // around even odds. The bands move only by Mala's call; update all three together.
  const BANDS = { MIDDLE_MIN: 0.35, HIGH_MIN: 0.50, LEGEND_MIN: 0.65, OMEGA_MIN: 0.80 };
  function tierOf(rate) {
    if (rate >= BANDS.OMEGA_MIN) return "Omega";
    if (rate >= BANDS.LEGEND_MIN) return "Legend";
    if (rate >= BANDS.HIGH_MIN) return "High";
    if (rate >= BANDS.MIDDLE_MIN) return "Middle";
    return "Low";
  }
  // The Control ladder (Muse, 2026-10-20; docs/threat-ratings.md "Control ladder"): every fighter against the frozen
  // Control instrument, 32 duels + 32 three-a-side battles on the same seeds; wins of 64. Rows: [id, wins, battles, note?].
  // Order breaks ties. The Cyanotype Artist is out (its result was an artifact: permanentAlly, untestable as an enemy),
  // and Control's mirror is the par line, not a row.
  const ROWS = [
    ["tallyman", 63, 64, "Boss: 32/32 duels, 31/32 three-a-side"],
    ["monkey_king", 55, 64, "32/32 duels: a perfect duelist"],
    ["martial_artist", 55, 64, "31/32 duels, 24/32 in a team; ties the Monkey King"],
    ["sita", 55, 64, "Story kit; she calls Rama in. 27/32 alone, 28/32 in a team"],
    ["rama", 54, 64, "Story kit (the Kodanda bow). 32/32 duels: a perfect duelist"],
    ["paladin", 44, 64, "25/32 alone, 19/32 in a team (v1.3.502, after the re-spec)"],
    ["thief", 41, 64, "29/32 alone, 12/32 in a team"],
    ["warden", 41, 64],
    ["kickboxer", 40, 64, "Strong both ways"],
    ["sasquatch", 38, 64, "Wild: meet him in the grove, the rim or the quarry"],
    ["director", 37, 64, "Better with a team (20/32)"],
    ["starfarer", 36, 64, "Top of the new challengers"],
    ["super_heroine", 36, 64],
    ["wizard", 35, 64, "12/32 alone, 23/32 in a team; calls NPC dream monsters"],
    ["mma_fighter", 34, 64],
    ["clockwork", 33, 64, "Team climber"],
    ["knight", 29, 64],
    ["anime_protagonist", 27, 64, "9/32 alone, 18/32 in a team; brings one anime kit"],
    ["aviator_hero", 25, 64],
    ["super_hero", 25, 64],
    ["ninja", 25, 64, "18/32 alone, 7/32 in a team"],
    ["teleporter", 25, 64],
    ["student", 22, 64],
    ["barbarian", 21, 64],
    ["actor", 13, 64],
    ["shaman", 13, 64],
    ["magistrate", 13, 64, "2/32 duels: the Statute's tax doesn't bite Control"],
    ["fieldBotanist", 13, 64],
    ["pioneer", 11, 64],
    ["medusa", 9, 64],
    ["frogan", 8, 64],
    ["soldier", 7, 64],
    ["robot_mechanic", 6, 64],
    ["jiang_qing", 4, 64, "0/32 duels: the veil doesn't save her"],
    ["hedge_witch", 3, 64],
  ];
  // Rows that are not roster characters: how the board shows them and what Challenge does.
  const SPECIAL = {
    tallyman: { kind: "boss", name: "The Tallyman", sprite: "tallyman", encounter: "secretWarrior" },
    sasquatch: { kind: "wild", name: "Sasquatch", sprite: "sasquatch" },
    warden: { kind: "main", name: "Warden", sprite: "warden" },   // your own main: rated, nothing to challenge
  };
  function list() {
    return ROWS.map(([id, wins, battles, note], i) => {
      const rate = battles ? wins / battles : 0;
      return { rank: 0, order: i, id, wins, battles, rate, tier: tierOf(rate), note: note || null, ...(SPECIAL[id] || {}) };
    }).sort((a, b) => b.rate - a.rate || a.order - b.order)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }
  const top = (n = 15) => list().slice(0, n);
  return { BANDS, SPECIAL, tierOf, list, top };
});
