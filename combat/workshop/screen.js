"use strict";
// Screen (W7.1 build): the Workshop sees its own shape. Rings lay the tree
// out by distance from home (ring 0: your pair; ring 1: their neighbors;
// outward) so the walk reads as a journey, not a list. Readings speak each
// concept's mathematics aloud (mechanism, math, lesson, scope, limits).
// Pure: the screen draws what these return.
//   rings(GD, C, starts)                 → [{ ring, ids[] }] BFS over the live graph
//   readings(C, id)                       → { mechanism, math, lesson, scope, limits } or null
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./traversal.js"));
  else root.ConceptCombatWorkshopScreen = factory(root.ConceptCombatWorkshopTraversal);
})(typeof self !== "undefined" ? self : this, function (TR) {
  function rings(GD, C, starts) {
    const live = (id) => !!(C.concepts || {})[id] && !C.concepts[id].sealed;
    const seen = new Set(), out = [];
    let frontier = [...new Set(starts || [])].filter((id) => live(id) && !seen.has(id));
    frontier.forEach((id) => seen.add(id));
    let ring = 0;
    while (frontier.length) {
      out.push({ ring, ids: [...frontier] });
      const next = [];
      for (const id of frontier)
        for (const nb of TR.neighbors(GD, id) || [])
          if (live(nb) && !seen.has(nb)) { seen.add(nb); next.push(nb); }
      frontier = next;
      ring++;
    }
    return out;
  }
  function readings(C, id) {
    const c = (C.concepts || {})[id];
    if (!c) return null;
    return { name: c.name, mechanism: c.mechanism || null, math: c.mathIdea || null,
      lesson: c.learningPrompt || null, scope: c.scope || null, limits: c.limits || null };
  }
  return { rings, readings };
});
