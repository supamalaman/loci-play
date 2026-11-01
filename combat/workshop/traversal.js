"use strict";
// Traversal (W6.1 build): the Workshop tree. Walk anywhere free, own a path.
// Nodes are live concepts (64 in 8 families); neighbors are family + authored
// graph edges. Claims spend discovery credits from the account wallet;
// discoveries are earned by living (vows kept — hooked; Jinki/Sage — rated,
// no live surface yet, hooks open). Valence prices distance in W6.4; v1 claims
// are flat 1 whatever the distance.
//
//   RULES                        → tunables (earn rates by source)
//   neighbors(graph, id)         → [concept ids] (family + edge endpoints, undirected)
//   nodeState(account, graph, id)→ "owned" | "bonded" | "available" | null (unknown)
//   claimCost(dist)              → 1 (v1 flat; W6.4 prices distance)
//   claim(account, id, C, graph) → { ok, account } | { ok: false, error }
//   grantFor(account, source, n) → { account, lines } (spec earn rates)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatWorkshopTraversal = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = { earn: { vow: 1, jinki: 1, sage: 1 }, claim: 1 };

  const edgesOf = (graph) => [...(graph?.opposition || []), ...(graph?.composition || [])];
  function neighbors(graph, id) {
    const out = new Set();
    for (const e of edgesOf(graph)) {
      if (e.source === id && e.target) out.add(e.target);
      if (e.target === id && e.source) out.add(e.source);
    }
    const fam = graph?.nodes?.[id]?.family;
    if (fam) for (const [cid, n] of Object.entries(graph.nodes)) if (cid !== id && n?.family === fam) out.add(cid);
    out.delete(id);
    return [...out];
  }
  const known = (C, graph, id) => !!(C?.concepts?.[id] || graph?.nodes?.[id]);
  function nodeState(account, graph, id, C = null) {
    if (C && !known(C, graph, id)) return null;
    if (!C && !graph?.nodes?.[id]) return null;
    const owned = account?.ownedNodes || [];
    if (owned.includes(id)) return "owned";
    if (owned.some((o) => neighbors(graph, o).includes(id))) return "bonded";
    return "available";
  }
  const claimCost = (dist = 0) => RULES.claim;   // v1 flat; W6.4: 1 + valence(dist)

  function claim(account, id, C, graph, cost = RULES.claim) {   // W6.4: the caller prices distance (valence.claimPrice); default is the v1 flat
    if (!known(C, graph, id)) return { ok: false, error: "Nothing there to claim." };
    const a = { discoveries: 0, ownedNodes: [], ...account };
    if (a.ownedNodes.includes(id)) return { ok: false, error: "Already owned." };
    if (a.discoveries < cost) return { ok: false, error: `Claiming costs ${cost} ${cost === 1 ? "discovery" : "discoveries"}.` };
    return { ok: true, account: { ...a, discoveries: a.discoveries - cost, ownedNodes: [...a.ownedNodes, id] } };
  }
  function grantFor(account, source, n = 1) {
    const rate = RULES.earn[source] || 0, got = rate * n;
    if (!got) return { account, lines: [] };
    const a = { discoveries: 0, ownedNodes: [], ...account };
    const name = { vow: "vow kept", jinki: "Jinki awakened", sage: "Sage beaten" }[source] || source;
    return { account: { ...a, discoveries: a.discoveries + got }, lines: [`+${got} discovery (${n} ${name}${n === 1 ? "" : "s"})`] };
  }
  return { RULES, neighbors, nodeState, claimCost, claim, grantFor };
});
