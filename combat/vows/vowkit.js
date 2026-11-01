"use strict";
// Vow x kit AI (W4.6 build): vows aren't assigned — they're RECOGNIZED. The AI
// reads its own kit, finds the dream already hiding in it, and swears it out
// loud. Score = trait affinity (W4.5) + verb overlap (kit verbs × vow-kind
// keywords). Threshold 2 declares; 0..1 considers (declares when AHEAD — the
// confident swear); averse never volunteers; soulless cannot.
//   RULES                        → tunables (threshold, windows, verbs, bridge, gain)
//   KINDS                        → recognition order (also the tie-break)
//   textOf(def)                  → the scored text of one kit ability
//   scoreKind(texts, affinity, kind) → { score, hits } (hits capped at 3)
//   recognize(AF, C, actor, texts) → best { kind, score, hits, affinity, band } (null when soulless)
//   ahead(s, side)               → own living LF-sum beats all other sides' × margin (public info only — C3)
//   declareFor(AF, C, actor, texts, { round, isAhead, live }) → { kind, boon, score, gain } | null
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CombatVowKit = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const KINDS = ["capture", "oath", "no-miss", "no-harm"];
  // A leading "=" matches whole-word (plus optional plural s): "hold" would
  // catch thresholds and overwatch ("hold the view"), "bound" would catch
  // rebounds, "freedom" would catch removefreedom tokens. Dropped as overfires
  // against the 458 live abilities: restrain (feint's restraint), contact
  // (struck touches), witness (observed), spare (spare hair), pin (leaping),
  // "no reaction" (costs none), "no damage" (all 131 utilities).
  const RULES = {
    threshold: 2, gainPerAlign: 8, aheadMargin: 1.1, hitCap: 3,
    windows: { prone: [0, 1], open: [2, 4] },   // averse never volunteers (mission-bound is W4.2's build, not this one)
    verbs: {
      capture: ["clinch", "grappl", "submission", "restrict", "binding", "=bind", "=bound", "capture", "=freedom", "snare", "leash"],
      oath: ["promise", "swear", "vow", "oath", "pledge", "covenant"],
      "no-miss": ["exact", "precis", "certain", "guarantee", "unreactable", "never miss", "cannot miss", "unerring"],
      "no-harm": ["harmless", "without harm", "mercy", "soothe", "lullaby", "non-lethal", "pacif"],
    },
    // The only dream with a live stance. Capture, oath and no-harm vows need
    // boons (and, for conduct vows, breach machinery) that don't exist yet:
    // recognized, never sworn — honest-gating, not silence.
    bridge: { "no-miss": "piercingOath" },
  };
  const textOf = (def) => def ? `${def.name || ""} ${def.mechanism || ""} ${def.newEffect || ""} ${def.potencyDefinition || ""}`.toLowerCase() : "";
  const verbHit = (joined, k) => k.startsWith("=") ? new RegExp(`\\b${k.slice(1)}s?\\b`).test(joined) : joined.includes(k);
  function scoreKind(texts, affinity, kind) {
    const joined = (texts || []).join(" ");
    const hits = Math.min(RULES.verbs[kind].filter((k) => verbHit(joined, k)).length, RULES.hitCap);
    return { score: affinity + hits, hits };
  }
  function recognize(AF, C, actor, texts) {
    const affinity = AF.unit(C, actor);
    if (affinity === null || affinity === undefined) return null;
    let best = null;
    for (const kind of KINDS) {
      const { score, hits } = scoreKind(texts, affinity, kind);
      if (!best || score > best.score) best = { kind, score, hits, affinity, band: AF.band(affinity) };
    }
    return best;
  }
  function ahead(s, side) {
    const sums = {};
    for (const a of Object.values(s.actors || {})) {
      if (!a || a.defeated || a.notArrived || a.side === "bystander") continue;
      sums[a.side] = (sums[a.side] || 0) + (a.lf ?? 0) / Math.max(1, a.maxLF || 1);
    }
    const mine = sums[side] || 0;
    const theirs = Object.entries(sums).filter(([k]) => k !== side).reduce((n, [, v]) => n + v, 0);
    return mine > theirs * RULES.aheadMargin;
  }
  function declareFor(AF, C, actor, texts, { round = 0, isAhead = false, live = false } = {}) {
    if (live) return null;   // D-ruling: one soul, one promise — the engine would refuse it anyway
    const rec = recognize(AF, C, actor, texts);
    if (!rec || rec.band === "averse" || rec.hits < 1) return null;   // averse never volunteers; no kit evidence, no swear
    const window = RULES.windows[rec.band];
    if (!window || round < window[0] || round > window[1]) return null;
    const boon = RULES.bridge[rec.kind];
    if (!boon) return null;   // recognized but unsworn
    if (rec.score < RULES.threshold && !isAhead) return null;   // considerers need the confident swear
    return { kind: rec.kind, boon, score: rec.score, gain: (rec.score + (isAhead ? 1 : 0)) * RULES.gainPerAlign };
  }
  return { RULES, KINDS, textOf, scoreKind, recognize, ahead, declareFor };
});
