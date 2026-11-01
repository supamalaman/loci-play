"use strict";
// Doping (W9.4 build): priced enhancement + the testers. Power you RENT
// from your future body — Red Ink (+2 potency/hit, 10 LF burn after),
// Stillwater Draught (ignore one stagger/knockback, −1 Inspiration),
// Chorus Salt (open at Heat 8, the crowd owns your headline). Every price
// is UNAVOIDABLE, paid even in a loss; the 2nd dose in a saga doubles ALL
// blowback (×4 at three — the body keeps accounts!). Winners test at
// ranked, promoter and title bouts; positives void the purse and mark the
// ledger (and the mark WEIGHS — sin-deaths contact).
//   RULES                                    → tunables (substances, stacking, test odds, venues)
//   dose(account, substance, { masked, depth, saga }) → { account, lines }
//   blowbackFor(dosesInSaga)                 → stacking multiplier (1/2/4×)
//   testDose({ masked, depth }, roll01)      → { positive } (peek-parity ladder provisional — peek rules unbuilt)
//   settleWin(account, { venue, dose, roll01, purse, seed }) → { account, tested, positive, voidPurse, lines }
// Doped wins count for NOTHING except the purse: account.dopedBouts names
// them so the seals-writer (W8.4, unbuilt) can exclude them from diplomas.
// Substances-as-ante-lots and trial-form verdicts are follow-ups.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CombatDoping = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = {
    substances: { redInk: { potency: 2, burn: 10 }, stillwater: { staggerIgnore: 1, inspirationDebt: 1 }, chorusSalt: { heat: 8, headlineOwned: true } },
    blowbackMult: [1, 2, 4], testCatch: 0.9, maskStep: 0.25, venues: ["ranked", "promoter", "title"], mark: "doped-bout" };
  const blowbackFor = (dosesInSaga) => RULES.blowbackMult[Math.min(dosesInSaga, 2)];
  function dose(account, substance, { masked = false, depth = 0, saga = "saga-0" } = {}) {
    const sub = RULES.substances[substance];
    if (!sub) return { account, lines: ["No such substance in the apparatus."] };
    const prior = (account?.doses || []).filter((d) => (d.saga || "saga-0") === saga).length;
    const mult = blowbackFor(prior);
    const lines = [`Dosed ${substance}${masked ? ` (veiled, depth ${depth})` : ""}: the loan office opens its glass books.`];
    let out = { ...account, doses: [...(account?.doses || []), { substance, masked, depth, saga, mult }] };
    if (sub.burn) { out = { ...out, burn: (out.burn || 0) + sub.burn * mult }; lines.push(`Blowback: ${sub.burn * mult} LF burn after the bout (×${mult} stacking).`); }
    if (sub.inspirationDebt) { const debt = sub.inspirationDebt * mult; out = { ...out, inspiration: Math.max(0, (out.inspiration || 0) - debt) }; lines.push(`Blowback: −${debt} Inspiration (borrowed calm, ×${mult}).`); }
    if (sub.headlineOwned) { out = { ...out, headlineOwned: true }; lines.push("Blowback: the crowd owns your headline — the NO gets dear!"); }
    return { account: out, lines };
  }
  function testDose({ masked = false, depth = 0 } = {}, roll01 = 0.5) {
    const threshold = masked ? Math.max(0.05, RULES.testCatch - depth * RULES.maskStep) : RULES.testCatch;
    return { positive: roll01 < threshold, threshold };
  }
  function settleWin(account, { venue = "exhibition", dose: doseRec = null, roll01 = 0.5, purse = 0, seed = null } = {}) {
    if (!RULES.venues.includes(venue)) return { account, tested: false, positive: false, voidPurse: 0, lines: ["Untested bout: no testers at this door."] };
    if (!doseRec) return { account, tested: true, positive: false, voidPurse: 0, lines: ["The winner tests clean."] };
    const { positive } = testDose(doseRec, roll01);
    const dopedBouts = [...(account?.dopedBouts || []), { seed, venue, positive }];
    if (!positive) return { account: { ...account, dopedBouts }, tested: true, positive: false, voidPurse: 0,
      lines: ["The winner tests clean — the veil held... this time."] };
    return { account: { ...account, dopedBouts, marks: [...(account?.marks || []), RULES.mark].slice(-50) },
      tested: true, positive: true, voidPurse: purse,
      lines: [`POSITIVE: the purse (${purse} Seeds) is voided, the honor line struck, and the ledger marks ${RULES.mark}.`,
        "A doped win counts for nothing but the purse — the seals will not hear of it."] };
  }
  return { RULES, blowbackFor, dose, testDose, settleWin };
});
