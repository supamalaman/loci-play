"use strict";
// Sin-deaths (W9.3 build): the engine that weighs ends. HOW you die writes
// WHERE you land — the ledger reads your marks at the moment of death and
// prices the passage. Automatic: no roll, the marks are the verdict.
//   RULES                              → tunables (tithe share, burn rate, trial threshold, sin-mark names)
//   weigh(marks, { redemptive, victims, estate }) → { clean, sins, burned, remaining, tithe, appeal, restTo, lines }
// Live sin-marks today: "oath-unkept" (broken vows, W4.4) and
// "self-rewritten" (edits leave flips — a Mala-overrulable call). "tomatoed"
// is crowd shame, not stain, and is NOT weighed. Desecrate-salvage,
// edit-flip and caught-lying sources are unbuilt; their names are pinned in
// RULES.sinMarks so the weighing recognizes them the day they land.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CombatSinDeaths = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = { titheShare: 1 / 3, burnRate: 2, trialThreshold: 3,
    sinMarks: ["oath-unkept", "self-rewritten", "doped-bout", "desecrated", "edit-flip", "caught-lying"] };
  function weigh(marks = [], { redemptive = false, victims = [], estate = 0 } = {}) {
    const sins = marks.filter((m) => RULES.sinMarks.includes(m)).length;
    const burned = redemptive ? Math.min(sins, RULES.burnRate) : 0;   // dying forward burns two marks at full price
    const remaining = sins - burned;
    const clean = remaining === 0;
    const tithe = clean ? 0 : estate * RULES.titheShare;
    const appeal = remaining >= RULES.trialThreshold;   // The Last Appeal: the dead may still be tried
    const restTo = clean ? [] : victims.length ? victims.slice() : ["Tended Water"];   // unclaimed restitution waters the garden
    const lines = [];
    if (clean) lines.push(burned > 0
      ? `A redemptive death: ${burned} sin-mark${burned === 1 ? " burns" : "s burn"} at the end, and the end rewrites the middle. The bequest pays in full.`
      : "A clean death: the bequest pays in full to the heirs, and the ledger writes a line of honor.");
    else {
      lines.push(`A sin-death: ${remaining} stain${remaining === 1 ? "" : "s"} weighed. A third of the estate tithes to ${restTo.join(", ")} — the stain pays its victims first.`);
      lines.push("The stain sits on the death, not the heir: guilt doesn't inherit, only the reduced estate does.");
      if (appeal) lines.push("Three stains or more: The Last Appeal opens — the dead may still be tried, and the heirs may defend the estate in court.");
    }
    return { clean, sins, burned, remaining, tithe, appeal, restTo, lines };
  }
  return { RULES, weigh };
});
