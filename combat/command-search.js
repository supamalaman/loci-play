"use strict";
// Command search and the quick bar (Mala, 2026-10-26; docs/command-menu.md). Pure: ui.js builds the index of every
// command (label, path, help, off) and asks this module to rank a query against it and to toggle pins.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatCommandSearch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const PINS_MAX = 6;
  const norm = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ʻ' ]+/g, " ").replace(/\s+/g, " ").trim();
  const words = (t) => norm(t).split(" ").filter(Boolean);

  // How well `query` names `entry` ({ label, path, help }); 0 = no match. Every query word must land somewhere.
  // A label that starts with the query beats a label word that starts with a query word, which beats a substring,
  // which beats a hit in the path (its drawer), which beats a hit in the help text. Shorter labels win ties.
  function score(query, entry) {
    const q = norm(query); if (!q) return 0;
    const label = norm(entry.label), lw = words(entry.label), path = norm(entry.path), help = norm(entry.help);
    let total = label.startsWith(q) ? 100 : 0;
    for (const w of words(query)) {
      const s = lw.some((x) => x.startsWith(w)) ? 60 : label.includes(w) ? 40 : path.includes(w) ? 20 : help.includes(w) ? 10 : 0;
      if (!s) return 0;
      total += s;
    }
    return total - Math.min(20, label.length / 4);
  }
  // Ranked results: usable first, then by score. Never more than `limit`.
  function search(entries, query, limit = 12) {
    return entries.map((e) => ({ e, s: score(query, e) })).filter((r) => r.s > 0)
      .sort((a, b) => Number(!!a.e.off) - Number(!!b.e.off) || b.s - a.s).slice(0, limit).map((r) => r.e);
  }
  // Pin or unpin `key`. Pins keep their order and never move by themselves; a full bar refuses a new pin.
  function togglePin(pins, key, max = PINS_MAX) {
    const list = Array.isArray(pins) ? pins.slice() : [];
    const at = list.indexOf(key);
    if (at >= 0) { list.splice(at, 1); return { pins: list, pinned: false }; }
    if (list.length >= max) return { pins: list, pinned: false, error: `The quick bar holds ${max}: unpin one first.` };
    list.push(key); return { pins: list, pinned: true };
  }
  return { PINS_MAX, norm, score, search, togglePin };
});
