"use strict";
// Tutor (W6.6 build): the school pays for sharp minds. Drills run on the
// existing Teach question bank (deepen-first, no new deck); the rate locks
// to the live field rate; the faucet obeys the mint cap per battle-cycle.
//
//   RULES                          → tunables (questions, bonus, drills, cap)
//   drillPay(correct, rate)        → correct x rate + perfect bonus at 5/5
//   cycleOf(account)               → { cycle, drills, paid } (fresh when stale)
//   canDrill(account)              → null | reason (2 drills a cycle)
//   settleDrill(account, correct, rate) → { account, paid, lines }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatWorkshopTutor = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = { questions: 5, perfectBonus: 5, drillsPerCycle: 2, capTotal: 55 };

  const drillPay = (correct, rate) => correct * rate + (correct === RULES.questions ? RULES.perfectBonus : 0);
  function cycleOf(account) {
    const cycle = account?.battles || 0, tc = account?.tutorCycle;
    if (tc && tc.cycle === cycle) return { ...tc };
    return { cycle, drills: 0, paid: 0 };
  }
  function canDrill(account) {
    const tc = cycleOf(account);
    if (tc.drills >= RULES.drillsPerCycle) return "The school's budget is spent this cycle (2 drills). Battle on to refresh it.";
    if (tc.paid >= RULES.capTotal) return "The 55-Seed cap is reached this cycle.";
    return null;
  }
  function settleDrill(account, correct, rate) {
    const no = canDrill(account);
    if (no) return { ok: false, error: no, account, paid: 0, lines: [] };
    const tc = cycleOf(account);
    const earned = drillPay(correct, rate), paid = Math.min(earned, RULES.capTotal - tc.paid);
    const a = { seeds: 0, tutorCycle: { cycle: 0, drills: 0, paid: 0 }, ...account };
    return { ok: true, paid, lines: [`Drill: ${correct}/${RULES.questions} · +${paid} Seeds${paid < earned ? ` (capped at ${RULES.capTotal}/cycle)` : ""}${correct === RULES.questions ? " · perfect!" : ""}`],
      account: { ...a, seeds: a.seeds + paid, tutorCycle: { cycle: tc.cycle, drills: tc.drills + 1, paid: tc.paid + paid } } };
  }
  return { RULES, drillPay, cycleOf, canDrill, settleDrill };
});
