"use strict";
// Live graph: makes relationships from graph-data.js act in combat (Mala: "the graph is ultimately the purpose of
// the game"). The engine calls this at ONE hook in hit(); each op kind here has a handler that checks the edge's
// real conditions against the state. Hypothesis edges never fire (they aren't facts yet).
//
//   damageMods({ s, src, tgt, inst, damageType }) → { mult, notes, used, strip, skipBrace }
//   coverage()                                    → { live, credited, documented }  which designed edges act in play
//
// "credited" = the engine already does this elsewhere; the edge id is credited there so discovery still works.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./graph-data.js"));
  else root.ConceptCombatGraphLive = factory(root.ConceptCombatGraphData);
})(typeof self !== "undefined" ? self : this, function (GD) {
  const edges = [...GD.opposition.map((e) => ({ ...e, kind: "opposition" })), ...GD.composition.map((e) => ({ ...e, kind: "composition" }))]
    .filter((e) => e.status !== "hypothesis" && e.type !== "none" && e.type !== "unknown");
  const byKind = (k) => edges.filter((e) => e.op.kind === k);

  // Is a concept "active" on this unit right now (what a defending-side edge needs)?
  const active = {
    inertia: (u) => !!(u.status?.anchor || u.status?.immovable),
    adaptation: (u, ctx) => !!(u.status?.guard?.damageType && u.status.guard.damageType === ctx.damageType),
    focus: (u) => !!u.status?.attention,
  };
  const holds = (src, e) => src && src.primary === e.source && src.secondary === e.target;   // composition equipped as primary/secondary
  // Per-edge extra conditions, written from the edge's `conditions` text.
  const extra = {
    "comp-sightline-focus": ({ src, tgt }) => src.status?.attention?.target === tgt.id,       // on your focused target
  };
  // Statuses that removeStatus can strip from a CHARACTER (terrain statuses are handled where terrain is edited).
  const unitStatus = { anchor: ["anchor", "immovable"] };
  // Already implemented in engine.js (credited there by id) so the live layer must not double-apply them.
  const credited = { "opp-adaptation-reads-the-habit": "engine: hit() counts practice as one stack against an adapted target", "opp-haste-spoils-the-work": "engine: Measure Twice is refused under tempo debt",
    "opp-craft-makes-it-keep": "engine: a Preservation ward by or on a craftsman lasts a turn longer", "opp-craft-keeps-the-tool": "class runtime: a friendly adjacent workstation gains 4 HP once at the craftsman's turn start", "comp-barrier-craftsmanship": "engine: manifest dresses Shield Wall", "comp-craftsmanship-timing": "engine: manifest takes 5 AP off at full practice",
    "opp-feint-breaks-focus": "engine: hit() breaks Focus on a Feint", "opp-resonance-breaks-focus": "engine: hit() breaks Focus on a resonance hit" };

  function damageMods({ s, src, tgt, inst, damageType }) {
    const out = { mult: 1, notes: [], used: [], strip: [], skipBrace: false };
    if (!inst || !tgt) return out;
    const c = inst.concept, ctx = { damageType };
    // dampen: the DEFENDER's active concept (source) softens an attack of the target concept.
    for (const e of byKind("dampen")) if (e.target === c && active[e.source]?.(tgt, ctx) && e.op.mul !== 1) {
      out.mult *= e.op.mul; out.used.push(e.id);
      out.notes.push(`${cap(e.source)} dampens ${cap(c)}: ×${e.op.mul} [${e.id}].`);
    }
    // bypassAttunement: an attack of the source concept slips past an attuned Adaptive Brace.
    for (const e of byKind("bypassAttunement")) if (e.source === c && active[e.target]?.(tgt, ctx)) {
      out.skipBrace = true; out.used.push(e.id);
      out.notes.push(`${cap(c)} engages what the Brace isn't watching: the attunement doesn't apply [${e.id}].`);
    }
    // removeStatus: an attack of the source concept strips the named status from the target unit.
    for (const e of byKind("removeStatus")) if (e.source === c && !credited[e.id] && unitStatus[e.op.status]) {
      const keys = unitStatus[e.op.status].filter((k) => tgt.status?.[k]);
      if (keys.length) { out.strip.push(...keys); out.used.push(e.id); out.notes.push(`${cap(c)} pries loose ${tgt.name || "the target"}'s ${e.op.status} [${e.id}].`); }
    }
    // Compositions (primary + secondary equipped, technique of the primary).
    if (src && c === src.primary) {
      for (const e of byKind("multiply")) if (holds(src, e) && (!extra[e.id] || extra[e.id]({ s, src, tgt }))) {
        out.mult *= e.op.factor; out.used.push(e.id); out.notes.push(`${cap(e.source)} + ${cap(e.target)}: ×${e.op.factor} [${e.id}].`);
      }
      for (const e of byKind("frequencyStack")) if (holds(src, e)) {
        s.graphLive ||= { stacks: {} };
        const k = `${src.id}>${tgt.id}>${e.id}`, n = s.graphLive.stacks[k] || 0;
        const bonus = Math.min(e.op.cap, e.op.perHit * n);
        if (bonus > 0) { out.mult *= 1 + bonus; out.used.push(e.id); out.notes.push(`${cap(e.source)} + ${cap(e.target)} builds on the last hit: ×${(1 + bonus).toFixed(2)} [${e.id}].`); }
        s.graphLive.stacks[k] = n + 1;
      }
    }
    return out;
  }
  const cap = (x) => String(x).charAt(0).toUpperCase() + String(x).slice(1);

  const HANDLED = new Set(["dampen", "bypassAttunement", "removeStatus", "multiply", "frequencyStack"]);
  function coverage() {
    const live = [], cred = [], documented = [];
    for (const e of edges) {
      if (credited[e.id]) cred.push(e.id);
      else if (HANDLED.has(e.op.kind) && (e.op.kind !== "removeStatus" || unitStatus[e.op.status])) live.push(e.id);
      else documented.push(e.id);
    }
    return { live, credited: cred, documented };
  }

  return { damageMods, coverage, credited, edges };
});
