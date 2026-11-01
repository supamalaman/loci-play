"use strict";
// Trait x PV affinity (W4.5 build): not every soul dreams the same size.
// Scores live concept text (name + mechanism + scope + limits — the NAMED
// commitment rule) with the sim's keyword tables, tuned to live .425 text:
//   RULES                        → tunables (tables, overrides, bands)
//   concept(C, id)               → -1..2 (0 unknown/unplayable — neutral craft)
//   unit(C, actor)               → null when mindless, else loudest concept pull
//   band(s)                      → prone | open | averse | soulless
//   line(C, actor)               → the scout-visible sentence (or null)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatAffinity = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = {
    commit: ["vow", "contract", "promise", "commitment", "oath", "statute", "warrant"],
    discipline: ["convert", "suffer", "flesh", "stance", "discipline", "repetition", "cost to keep"],
    averse: ["deceiv", "false tell", "false-range tell", "theft", "steal"],
    averseWord: /\blies?\b/,
    overrides: { stealth: 0 },   // the thefts are the paired concept's doing — spec's explicit pick
  };
  const stripNeg = (t) => t.replace(/\b(no|never|without|n't) [^;,.]+/g, "");
  function concept(C, id) {
    if (RULES.overrides[id] !== undefined) return RULES.overrides[id];
    const c = C?.concepts?.[id];
    if (!c) return 0;
    const text = stripNeg(`${id} ${(c.mechanism || "")} ${(c.scope || "")} ${(c.limits || "")}`.toLowerCase());
    if (RULES.averse.some((k) => text.includes(k)) || RULES.averseWord.test(text)) return -1;
    if (RULES.commit.some((k) => text.includes(k))) return 2;
    if (RULES.discipline.some((k) => text.includes(k))) return 1;
    return 0;
  }
  const mindless = (a) => !!(a && (a.beast || a.monster));
  function unit(C, a) {
    if (!a || mindless(a)) return null;
    return Math.max(concept(C, a.primary), concept(C, a.secondary));
  }
  const band = (s) => (s === null || s === undefined ? "soulless" : s >= 2 ? "prone" : s >= 0 ? "open" : "averse");
  function line(C, a) {
    const b = band(unit(C, a));
    if (b === "soulless") return `${a.name} has no soul to swear with: no vows.`;
    if (b === "prone") return `${a.name} dreams out loud: vow-prone, volunteers oaths.`;
    if (b === "averse") return `${a.name} wears a mask: vow-averse, swears late if at all.`;
    return null;   // open souls show nothing — vows possible, never volunteered
  }
  return { RULES, concept, unit, band, line, mindless };
});
