"use strict";
// The Tallyman's fight (Mala, 2026-10-17; the agents' first Secret Warrior, revealed 2026-10-20). Design notes:
// ~/loci-orbit/secret-warrior/BUILD.md. The encounter id stays "secretWarrior" so saved runs keep working. One fight on the Warfare Field, the Warden plus one optional ally (the Boss Rush list).
// Pure functions: the UI starts the battle from battleOptions().
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../bosses/boss-data.js"));
  else root.ConceptCombatSecretWarrior = factory(root.ConceptCombatBossData);
})(typeof self !== "undefined" ? self : this, function (BD) {
  const ENCOUNTER = "secretWarrior", ARENA = "warfareField", BOSS = "tallyman";
  const AT = { player: [1, 4], ally: [1, 5], boss: [11, 3] };
  const label = "The Tallyman";
  const note = "The agents' first Secret Warrior: a smiling creditor who pays you to stand still. He waits on the Warfare Field. Bring one ally if you like; read his terms before you sign.";

  function battleOptions({ seed = 0, ally = null } = {}) {
    const b = BD.bosses[BOSS];
    return { encounter: ENCOUNTER, mode: "classic", seed: seed >>> 0, startingActor: "player", title: label,
      participants: [{ id: "player", character: "warden", side: "player", at: AT.player.slice() },
        ...(ally ? [{ id: "companion", character: ally, side: "player", at: AT.ally.slice() }] : []),
        { id: `boss-${BOSS}`, character: `boss-${BOSS}`, boss: BOSS, side: "enemy", at: AT.boss.slice(), size: { ...b.size }, maxLF: b.lf, startingLF: b.lf }] };
  }
  // A win keeps the Tallyman's orb, as a boss-rush win over him does (Mala, 2026-10-24: the Secret Warrior win gave no orb).
  // Nothing on a loss, nothing when he was not beaten, nothing in another encounter.
  function orbWon(state) {
    if (state?.encounter !== ENCOUNTER || state.outcome?.winner !== "player") return null;
    const beaten = Object.values(state.actors || {}).some((u) => u.boss === BOSS && u.defeated);
    return beaten ? BD.bosses[BOSS]?.orb || null : null;
  }
  return { ENCOUNTER, ARENA, BOSS, label, note, battleOptions, orbWon };
});
