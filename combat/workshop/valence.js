"use strict";
// Valence (W6.4 build): distance prices blends. Nothing forbidden,
// everything priced. BFS over the Workshop tree (family + authored edges,
// undirected); the curve taxes ambition; blessed pairs sing free; chits bridge
// once; drift bends the far child wild, capped.
//
//   RULES                           → tunables (curve, opposed multiple, drift cap)
//   neighbors(graph, id)            → [ids] (same tree traversal.js walks)
//   distance(graph, a, b)           → hops, or Infinity off the map
//   nearestOwned(graph, owned, id)  → 0 when owned, else fewest hops
//   blessed(a, b, table)            → the lore says they sing
//   price(d, { blessed })           → sim curve: 1/1/2/2/3/4, opposed x2 of 4
//   drift(d)                        → min(cap, d): tension empowers, capped
//   claimPrice(graph, owned, id, { table, chit }) → { cost, dist, bridged }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatWorkshopValence = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = { curve: [1, 1, 2, 2, 3, 4], opposedMul: 2, driftCap: 5 };

  function neighbors(graph, id) {
    const out = new Set();
    for (const e of [...(graph?.opposition || []), ...(graph?.composition || [])]) {
      if (e.source === id && e.target) out.add(e.target);
      if (e.target === id && e.source) out.add(e.source);
    }
    const fam = graph?.nodes?.[id]?.family;
    if (fam) for (const [cid, n] of Object.entries(graph.nodes)) if (cid !== id && n?.family === fam) out.add(cid);
    out.delete(id);
    return [...out];
  }
  function distance(graph, a, b) {
    if (a === b) return 0;
    const seen = new Set([a]), q = [[a, 0]];
    while (q.length) {
      const [id, d] = q.shift();
      for (const n of neighbors(graph, id)) {
        if (n === b) return d + 1;
        if (!seen.has(n)) { seen.add(n); q.push([n, d + 1]); }
      }
    }
    return Infinity;
  }
  function nearestOwned(graph, owned, id) {
    if ((owned || []).includes(id)) return 0;
    if (!(owned || []).length) return 0;   // first claim: home is wherever you stand
    return Math.min(...owned.map((o) => distance(graph, o, id)));
  }
  const key = (a, b) => [a, b].sort().join("x");
  const blessed = (a, b, table = []) => table.some(([x, y]) => key(x, y) === key(a, b));
  function price(d, { blessed: bl = false } = {}) {
    if (bl) return 1;
    if (!Number.isFinite(d) || d >= RULES.curve.length) return RULES.curve[RULES.curve.length - 1] * RULES.opposedMul;
    return RULES.curve[Math.max(0, d)];
  }
  const drift = (d) => Math.min(RULES.driftCap, Number.isFinite(d) ? d : RULES.driftCap);
  function claimPrice(graph, owned, id, { table = [], chit = false } = {}) {
    const dist = nearestOwned(graph, owned, id);
    if (chit && dist > 1) return { cost: 1, dist, bridged: true };
    const bl = (owned || []).some((o) => blessed(o, id, table)) || blessed(id, id, table);
    return { cost: price(dist, { blessed: bl }), dist, bridged: false };
  }
  const BLESSED = [];   // canon gate: Mala curates blessed pairs; the table starts empty, the mechanism sings
  return { RULES, BLESSED, neighbors, distance, nearestOwned, blessed, price, drift, claimPrice };
});
