"use strict";
// Index crew wall. Membership is stamped on each character in content.js. This only groups
// them for the Index, and it leaves the benchmark instrument off the wall.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSubfactions = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const HIDDEN = new Set(["control", "sage"]);   // AP-01: SAGE.md invisibility — tagged like Control, off the wall like Control

  function subtitle(ch) {
    if (ch.randomEventOnly) return "Event only";
    const label = ch.configs && ch.configs[0] && ch.configs[0].label;
    if (label) return label;
    return [ch.primary, ch.secondary].filter(Boolean).join(" + ");
  }

  function wall(characters, subfactions) {
    const byCrew = {};
    for (const [id, ch] of Object.entries(characters || {})) {
      if (!ch || HIDDEN.has(id) || !ch.subfaction) continue;
      (byCrew[ch.subfaction] ||= []).push({
        id, name: ch.name || id, sprite: ch.sprite || "", eventOnly: !!ch.randomEventOnly, sub: subtitle(ch),
      });
    }
    for (const list of Object.values(byCrew)) list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return Object.entries(subfactions || {}).map(([id, meta]) => ({
      id, name: meta.name, blurb: meta.blurb || "", members: byCrew[id] || [],
    }));
  }

  return { wall, hidden: [...HIDDEN] };
});
