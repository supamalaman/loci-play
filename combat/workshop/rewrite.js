"use strict";
// Rewrite (W6.2 build): self-authorship with roots. An owned node's name,
// tint, or lens-dial can change for 1 discovery — but every merge-equation
// downstream recomputes, and the game shows the whole cascade before you pay.
// Warnings, never refusals. Position never moves: history is geography.
//
// LIVE GROUNDING: base = the concept's content record (mechanism/scope/
// limits/abilities — the untouched core); kind = its family (origin);
// dials = { lens } (your default profile for the concept; engine reads it
// in a later seam — v1 dials move equations, not battles); trait re-score
// waits on W4.5 affinity (the warning says so out loud).
//
//   RULES                                → tunables (cost)
//   validate(styles, account, id, patch)→ null | { reason } (owned/keys/broke)
//   ripples(PA, VV, graph, C, account, id, patch) → [{ entry, oldEq, newEq, name }]
//   warning(nodeName, ripples)          → the mandatory sentence
//   apply(account, id, patch, PA, VV, graph, C) → { ok, account, lines } | { ok: false, ... }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./pairing.js"), require("./valence.js"));
  else root.ConceptCombatWorkshopRewrite = factory(root.ConceptCombatWorkshopPairing, root.ConceptCombatWorkshopValence);
})(typeof self !== "undefined" ? self : this, function (PA, VV) {
  const RULES = { cost: 1 };
  const ALLOWED = ["name", "tint", "dials"], IMMUTABLE = ["base", "kind"];

  function validate(styles, account, id, patch) {
    if (!(account?.ownedNodes || []).includes(id)) return { reason: "unowned" };
    for (const k of Object.keys(patch || {})) {
      if (IMMUTABLE.includes(k)) return { reason: "immutable" };
      if (!ALLOWED.includes(k)) return { reason: "unknown", key: k };
    }
    if ((account?.discoveries || 0) < RULES.cost) return { reason: "no-discovery" };
    return null;
  }
  const entryName = (C, account, table, eq, parents, driftN) =>
    table?.[eq] || account?.namedMerges?.[eq]?.name || null;
  function ripples(PAmod, VVmod, graph, C, account, id, patch, table = {}) {
    const styles = { ...(account?.nodeStyles || {}), [id]: { ...((account?.nodeStyles || {})[id] || {}), ...patch } };
    return (account?.mergeLedger || [])
      .filter((e) => (e.parents || []).includes(id))
      .map((entry) => {
        const dist = entry.dist ?? (VVmod && entry.parents.length === 2 ? VVmod.distance(graph, entry.parents[0], entry.parents[1]) : 0);
        const newEq = PAmod.mint(entry.parents, PAmod.dialsHash(styles, entry.parents), dist, PAmod.COMMUTE);
        const driftN = VVmod ? VVmod.drift(dist) : 0;
        const blend = entry.parents.map((p) => C?.concepts?.[p]?.name || p).join(" × ") + (driftN > 1 ? `, bent ${driftN}` : "");
        return { entry, oldEq: entry.eq, newEq, name: entryName(C, account, table, newEq, entry.parents, driftN) || blend, named: !!(table?.[newEq] || account?.namedMerges?.[newEq]) };
      });
  }
  const warning = (nodeName, rips) =>
    `Rewriting ${nodeName} alters ${rips.length} downstream artifact${rips.length === 1 ? "" : "s"} and may shift your traits (re-score pending: affinity W4.5 unbuilt). Proceed?`;
  function apply(account, id, patch, PAmod, VVmod, graph, C, table = {}) {
    const bad = validate(account?.nodeStyles, account, id, patch);
    if (bad) return { ok: false, error: bad.reason === "unowned" ? "Edit your own story, not the library's (unowned)." : bad.reason === "immutable" ? "Base and kind are frozen — identity locks, tuning doesn't." : bad.reason === "unknown" ? `Nothing called ${bad.key} rewrites.` : "Rewriting costs 1 discovery.", account, ripples: [] };
    const rips = ripples(PAmod, VVmod, graph, C, account, id, patch, table);
    const styles = { ...(account?.nodeStyles || {}), [id]: { ...((account?.nodeStyles || {})[id] || {}), ...patch } };
    const ledger = (account?.mergeLedger || []).map((e) => {
      const r = rips.find((x) => x.entry === e);
      return r ? { ...e, eq: r.newEq, prevEq: r.oldEq, name: r.named ? r.name : null } : e;
    });
    return { ok: true, ripples: rips, lines: [`Rewrote ${C?.concepts?.[id]?.name || id}: ${rips.length} downstream artifact${rips.length === 1 ? "" : "s"} recomputed.`],
      account: { ...account, discoveries: (account?.discoveries || 0) - RULES.cost, nodeStyles: styles, mergeLedger: ledger,
        marks: [...(account?.marks || []), "self-rewritten"].slice(-50),
        rewriteLog: [...(account?.rewriteLog || []), { node: id, patch, at: (account?.battles || 0) }] } };
  }
  return { RULES, validate, ripples, warning, apply };
});
