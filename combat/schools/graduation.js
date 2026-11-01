"use strict";
// Graduation (W9.1 build): duels that confer mastery. The tree teaches; the
// duel CONFERS. A fight with a syllabus — challenge a school's master, win,
// and the ledger writes the diploma.
//   RULES                                    → tunables (challenge price, rematch, seals)
//   eligible(account, school)                → { ok, missing } (warnings name the missing seal)
//   mustAccept(account, school, cycle)       → the master declined once already: never twice
//   recordDecline(account, school, cycle)    → account with the priced NO ledgered
//   settle(account, school, outcome, { gap, cycle }) → { account, directives, lines }
// The three seals are read from wave 8 (workshop/schools.js, merged 1.3.439 by Pantry-R9): breadth = owned nodes IN this
// school (schoolOf), lineage = equations in the merge ledger, depth = one lock-in artifact. Lock-in artifacts are unbuilt,
// so depth stays OPEN (met) until they exist, the same rule wave 8 uses for pending gates (account.lockIns counts them the
// day they land). Masters, headline challenges and the exam venue are follow-ups, so this module has no live caller yet;
// settle returns directives (conferTitle) for the caller to apply. A doped win confers nothing (W9.4).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../workshop/schools.js"), require("../content.js"));
  else root.CombatGraduation = factory(root.ConceptCombatWorkshopSchools, root.ConceptCombatContent);
})(typeof self !== "undefined" ? self : this, function (SCH, C) {
  const RULES = { challengePrice: 1, rematchCycles: 1, sealsNeeded: { breadth: 6, artifacts: 1, equations: 3 } };
  // Breadth asks for 6 nodes in the school, or every node it has when the tree gives it fewer (Sworn and Devoured hold 4,
  // Quiet 5 on 1.3.438): a seal nobody could earn would lock three schools' titles away for good. Mala's call to overrule.
  const schoolSize = (school) => C?.concepts ? Object.keys(C.concepts).filter((id) => SCH?.schoolOf?.(id) === school).length : RULES.sealsNeeded.breadth;
  const breadthNeed = (school) => Math.max(1, Math.min(RULES.sealsNeeded.breadth, schoolSize(school)));
  function sealsFor(account, school) {
    const breadth = (account?.ownedNodes || []).filter((id) => SCH?.schoolOf?.(id) === school).length;
    const lockIns = Array.isArray(account?.lockIns) ? account.lockIns.length : null;   // null: the artifact system does not exist yet
    const seals = { breadth, equations: (account?.mergeLedger || []).length };
    seals.artifacts = lockIns === null ? RULES.sealsNeeded.artifacts : lockIns; seals.artifactsPending = lockIns === null;
    return seals;
  }
  function eligible(account, school) {
    const have = sealsFor(account, school), need = RULES.sealsNeeded, missing = [];
    if ((account?.graduations || []).includes(school)) return { ok: false, missing: ["already graduated — mastery after is defended, not re-earned"] };
    const nb = breadthNeed(school);
    if (have.breadth < nb) missing.push(`breadth ${have.breadth}/${nb} in ${school}`);
    if (have.artifacts < need.artifacts) missing.push(`lock-in artifact ${have.artifacts}/${need.artifacts}`);
    if (have.equations < need.equations) missing.push(`ledgered equations ${have.equations}/${need.equations}`);
    const wait = (account?.rematch || {})[school];
    if (wait != null && (account?.battles ?? 0) < wait) missing.push(`rematch opens after battle ${wait}`);
    return { ok: missing.length === 0, missing };
  }
  const mustAccept = (account, school, cycle) => (account?.declines || {})[school] === cycle;   // declined once this cycle: never twice
  function recordDecline(account, school, cycle) {
    return { ...account, declines: { ...(account?.declines || {}), [school]: cycle } };
  }
  function settle(account, school, outcome, { gap = "", cycle = 0, doped = false } = {}) {
    const grads = account?.graduations || [], lines = [], directives = {};
    if (outcome === "win" && doped) return { account, directives, lines: ["A doped win counts for nothing but the purse: no diploma, no title, no seal credit."] };   // W9.4 ruling: clean purity for diplomas
    if (outcome === "win") {
      if (grads.includes(school)) return { account, directives, lines: ["Already a graduate: the title is defended, not re-earned."] };
      lines.push(`${school} is yours to teach: title conferred, teach rights granted, Still-seal credited.`);
      return { account: { ...account, graduations: [...grads, school],
        teachRights: [...(account?.teachRights || []), school],
        stillSeals: (account?.stillSeals || 0) + 1 },
        directives: { conferTitle: school }, lines };
    }
    const open = cycle + RULES.rematchCycles;   // loss, knee and draw all wait one cycle; only the lesson differs
    const base = { ...account, rematch: { ...(account?.rematch || {}), [school]: open } };
    if (outcome === "knee") {
      lines.push("An honorable withdrawal: the knee keeps honor AND earns the lesson; only the title waits.");
      return { account: { ...base, gaps: [...(account?.gaps || []), { school, gap }] }, directives, lines };
    }
    if (outcome === "lose") {
      lines.push("Seals and nodes kept; the master names the gap, and the loss teaches.");
      return { account: { ...base, gaps: [...(account?.gaps || []), { school, gap }] }, directives, lines };
    }
    lines.push("A draw decides nothing: no title, no lesson — only the wait.");
    return { account: base, directives, lines };
  }
  return { RULES, sealsFor, breadthNeed, eligible, mustAccept, recordDecline, settle };
});
