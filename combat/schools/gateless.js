"use strict";
// GateLess (W9.2 build): the true ending — powerless and complete. The
// highest mastery is putting it DOWN: seal every owned node (kept on
// record, unusable), keep the name, endow the next saga.
//   RULES                                    → tunables (schools needed, heirlooms)
//   eligible(account, saga)                  → { ok, missing } (saga = { complete }; W9.6 passes the arc)
//   seal(account, { star, heirloom, saga })  → { account, directives, lines }
// Refusal is honored by design: nothing calls seal unless the graduate
// chooses it. The saga close (sagas.js, the Field Kit's saga card since 1.3.473) calls
// seal; battle/tutor gating on account.sealed is still follow-up wiring.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CombatGateless = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = { schoolsNeeded: 2, heirlooms: 1 };
  function eligible(account, saga = {}) {
    const missing = [];
    const grads = account?.graduations || [];
    if (grads.length < RULES.schoolsNeeded) missing.push(`graduate of ${RULES.schoolsNeeded}+ schools (holds ${grads.length})`);
    if (!saga.complete) missing.push("saga complete (endings end things)");
    if (account?.sealed) missing.push("already sealed — the arrival is the point, and it happened");
    return { ok: missing.length === 0, missing };
  }
  function seal(account, { star = "", heirloom = null, saga = "" } = {}) {
    if (account?.sealed) return { account, directives: {}, lines: ["Already sealed: regret has no door here."] };
    const lines = ["Every node laid down — kept on record, unusable. The theorem stands; the hand rests.",
      star ? `A star for the emergence table: ${star}, blessed permanent.` : "No star was named: none is recorded.",
      `An heirloom for the next saga: ${heirloom || "(nothing carried forward)"}.`,
      "The name GATELESS, worn, not spent."];
    return { account: { ...account,
        // Clarification #3 (rulings-2026-10-26.md): the seal takes the Tended key too. Tended comes from item care, so the
        // seal records each item's care sessions; only care given after the seal counts toward Tended again (schools.js).
        sealed: { nodes: [...(account?.ownedNodes || [])], saga, star,
          careSessions: Object.fromEntries(Object.entries(account?.gear?.care || {}).map(([id, r]) => [id, (r?.repairs || 0) + (r?.cherishes || 0) + (r?.dupMends || 0)])) },
        ownedNodes: [],
        stars: [...(account?.stars || []), ...(star ? [{ equation: star, saga }] : [])],   // Mala 2026-10-28: a nameless star is not recorded
        heirloom,
        gatelessCount: (account?.gatelessCount || 0) + 1 },
      directives: { conferTitle: "GATELESS" }, lines };
  }
  return { RULES, eligible, seal };
});
