"use strict";
// The relationship graph as one merged, queryable structure: content.js edges (with decisions and annotations)
// plus the authored graph-data edges. The graph view, the engine's edge lookups, the post-battle report and the
// question system should all read from here.
//
//   build(content)                      → { nodes, families, edges, notableNone }   (edges carry kind: "opposition" | "composition")
//   relation(graph, kind, a, b)         → { edges, none: reason|null, normal: bool }  ("what happens when A meets B?")
//   placement(graph, conceptId)         → placement card + degree + gaps   (a concept isn't playable until it's placed)
//   report(graph)                       → completeness for every concept: no unknowns, minimum degree, every edge explained
//   discover(knowledge, edgeId, how) / known(knowledge)   per-account discovery of edges ("ideas" in the cognitive inventory)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./graph-data.js"));
  else root.ConceptCombatGraph = factory(root.ConceptCombatGraphData);
})(typeof self !== "undefined" ? self : this, function (GD) {
  const MIN = { opposition: 4, compositionAsPrimary: 1, compositionAsSecondary: 1 };

  function build(content) {
    const fromContent = (list, kind) => list.map((e) => {
      const o = GD.overrides[e.id];
      if (o && o.replacedBy) return null;                                 // superseded by an authored edge
      const merged = { ...e, ...(o || {}), ...(GD.annotations[e.id] || {}), kind, origin: "content" };
      if (o && o.type) merged.status = "decided";
      return merged;
    }).filter(Boolean);
    const rawEdges = [
      ...fromContent(content.opposition || [], "opposition"), ...GD.opposition.map((e) => ({ ...e, kind: "opposition", origin: "graph" })),
      ...fromContent(content.composition || [], "composition"), ...GD.composition.map((e) => ({ ...e, kind: "composition", origin: "graph" })),
    ];
    // Implemented graph-first edges are also exposed through content for engine lookups.
    // Keep one map edge per stable ID, preferring the now-live content record.
    const byId = new Map();
    for (const e of rawEdges.filter(Boolean)) if (!byId.has(e.id) || e.origin === "content") byId.set(e.id, e);
    const edges = [...byId.values()];
    return { nodes: GD.nodes, families: GD.families, opKinds: GD.opKinds, edges, notableNone: GD.notableNone };
  }

  const isReal = (e) => e.type !== "none" && e.type !== "unknown";
  // A wildcard edge ("Barrier stops any line delivery") only applies to concepts that can actually make that
  // delivery: it's matched against the target node's deliveries via its "delivery = X" condition.
  function wildcardApplies(graph, e, b) {
    const m = (e.conditions || []).join(" ").match(/delivery = (\w+)/);
    return !m || (graph.nodes[b]?.deliveries || []).includes(m[1]);
  }
  function relation(graph, kind, a, b) {
    const real = graph.edges.filter((e) => e.kind === kind && isReal(e) && e.source === a);
    const specific = real.filter((e) => e.target === b);
    const general = real.filter((e) => e.target === "*" && wildcardApplies(graph, e, b));
    const edges = [...specific, ...general];
    const none = kind === "opposition" ? (graph.notableNone.find((n) => n.source === a && n.target === b)?.why
      || graph.edges.find((e) => e.kind === kind && e.type === "none" && e.source === a && e.target === b)?.why || null) : null;
    return { edges, specific, general, none, normal: !edges.length };
  }

  function degree(graph, c) {
    const real = graph.edges.filter(isReal);
    const opp = real.filter((e) => e.kind === "opposition" && (e.source === c || e.target === c)).length;
    return {
      opposition: opp,
      compositionAsPrimary: real.filter((e) => e.kind === "composition" && e.source === c).length,
      compositionAsSecondary: real.filter((e) => e.kind === "composition" && e.target === c).length,
      notableNone: graph.notableNone.filter((n) => n.source === c || n.target === c).length,
    };
  }

  function placement(graph, c) {
    const node = graph.nodes[c];
    if (!node) return { placed: false, gaps: [`${c} has no place in the graph yet`] };
    const d = degree(graph, c), gaps = [];
    for (const [k, min] of Object.entries(MIN)) if (d[k] < min) gaps.push(`${k}: ${d[k]} of ${min}`);
    return { placed: gaps.length === 0, concept: c, ...node, degree: d, gaps };
  }

  function report(graph, conceptIds) {
    const ids = conceptIds || Object.keys(graph.nodes);
    const problems = [];
    for (const e of graph.edges) {
      if (e.type === "unknown") problems.push(`${e.id}: still unknown`);
      if (!graph.opKinds[e.op?.kind]) problems.push(`${e.id}: op ${e.op?.kind} isn't declared`);
      if (isReal(e) && (!e.why || !e.teaches)) problems.push(`${e.id}: needs why and teaches`);
      for (const end of [e.source, e.target]) if (end !== "*" && !graph.nodes[end]) problems.push(`${e.id}: ${end} isn't a placed concept`);
    }
    const concepts = ids.map((c) => placement(graph, c));
    for (const p of concepts) if (!p.placed) problems.push(`${p.concept}: ${p.gaps.join(", ")}`);
    return { ok: problems.length === 0, problems, concepts, counts: {
      opposition: graph.edges.filter((e) => e.kind === "opposition" && isReal(e)).length,
      composition: graph.edges.filter((e) => e.kind === "composition" && isReal(e)).length,
      notableNone: graph.notableNone.length + graph.edges.filter((e) => e.type === "none").length,
      newOps: Object.entries(graph.opKinds).filter(([, o]) => o.impl === "new").length } };
  }

  // Edge discovery: the graph starts hidden; edges are discovered when they fire in battle, when a question about
  // them is answered right, or when an Observe reveals one. The graph view shows discovered edges; the rest are faint.
  function discover(knowledge = { edges: {} }, edgeId, how = "seen") {
    const cur = knowledge.edges[edgeId] || { seen: 0, answered: 0, first: how };
    const next = { ...cur, [how === "answered" ? "answered" : "seen"]: (cur[how === "answered" ? "answered" : "seen"] || 0) + 1 };
    return { ...knowledge, edges: { ...knowledge.edges, [edgeId]: next } };
  }
  const known = (knowledge) => Object.keys(knowledge?.edges || {});

  return { build, relation, placement, report, degree, discover, known, MIN, data: GD };
});
