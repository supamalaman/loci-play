"use strict";
// Mastery titles (W9.5 build): diplomas the world can read — and challenge.
// Level titles say how long (account.js `titles`); mastery titles say how deep
// (one per school + GATELESS above schools) and live in `schoolTitles` so the
// two never collide. Titles are worn into battle (announced!), defended on
// demand, and transfer on upset — but never grant stats (honor, not armor!)
// and never decay.
//   RULES                        → tunables (announce bonus, refusal price)
//   MASTERY                      → school → title name (8 + GATELESS)
//   confer(account, school)      → account with the school title appended (idempotent)
//   strip(account, name)         → account without that title
//   wear(account, name)          → account wearing that title (must hold it)
//   worn(account)                → the announced title (explicit pick, else latest mastery)
//   canChallenge(name)           → GATELESS cannot be challenged
//   announceBonus(crowd)         → +1 Heat with a crowd, else 0
//   resolveDefense({ title, holder, challenger, winner, doped }) → { holder, transferred, voided }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CombatTitles = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = { announceBonus: 1, refusalHeat: 8 };
  const MASTERY = { Sworn: "OATHBOUND", Tried: "ADJUDICANT", Quiet: "STILLBLADE", Tended: "GROUNDSKEEPER", Veiled: "UNREAD", Devoured: "PALEHEIR", Owing: "LEDGERBOUND", Witnessed: "HEADLINER" };
  const GATELESS = "GATELESS";
  const mine = (account) => account?.schoolTitles || [];
  const masteryOf = (account) => mine(account);
  function confer(account, school) {
    const name = school === GATELESS ? GATELESS : MASTERY[school];
    if (!name || mine(account).some((t) => t.name === name)) return account;
    return { ...account, schoolTitles: [...mine(account), school === GATELESS ? { name } : { school, name }] };
  }
  function strip(account, name) {
    const left = mine(account).filter((t) => t.name !== name);
    return { ...account, schoolTitles: left, wornSchoolTitle: account.wornSchoolTitle === name ? "" : account.wornSchoolTitle || "" };
  }
  function wear(account, name) {
    if (!mine(account).some((t) => t.name === name)) return account;   // cannot wear a title never earned
    return { ...account, wornSchoolTitle: name };
  }
  // One announced per battle — the explicit pick, else the latest mastery earned.
  function worn(account) {
    const names = mine(account).map((t) => t.name);
    if (!names.length) return null;
    return names.includes(account.wornSchoolTitle) ? account.wornSchoolTitle : names[names.length - 1];
  }
  const canChallenge = (name) => name !== GATELESS;   // the arrived are beyond headlines
  const announceBonus = (crowd) => crowd ? RULES.announceBonus : 0;
  function resolveDefense({ title, holder, challenger, winner, doped = false }) {
    if (!canChallenge(title)) return { holder, transferred: false, voided: false };
    if (doped) return { holder, transferred: false, voided: true };   // cheaters don't inherit honor
    const transferred = winner === challenger;
    return { holder: transferred ? challenger : holder, transferred, voided: false };
  }
  return { RULES, MASTERY, GATELESS, masteryOf, confer, strip, wear, worn, canChallenge, announceBonus, resolveDefense };
});
