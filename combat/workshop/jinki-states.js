"use strict";
// Jinki visual states: the wardrobe tells the truth (Muse, Jinki build J2;
// SPEC: muse-jinki-states STATES.md). Binds the dmg/resto sprite pairs to
// durability + care: wear SHOWS, restoration SHOWS, love GLOWS. Pure and
// dependency-free: loot.js calls it for crossing moments, ui.js for the
// card icon + state name. Legacy single-sprite items render exactly as
// before (no flags on the item = no change).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatJinkiStates = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const THRESHOLD = 0.5;   // resto at/above half, dmg below (JS1; tunable)
  const ORDER = { broken: 0, worn: 1, restored: 2 };
  // Gleams key on the SAME milestones as awakening (JC2/J1: 10/20/50) —
  // the soul-shimmer arrives with the soul, the saga aura with legendhood.
  const GLEAMS = [[50, "saga", "Saga aura"], [20, "heirloom", "Heirloom gleam"], [10, "shimmer", "Soul-shimmer"]];
  const esc = (s) => String(s ?? "").replace(/[&<>\x22\x27]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\x22": "&quot;", "\x27": "&#39;" }[c]));   // \x22 \x27, not raw quotes: raw quotes inside a regex blind check-dead-exports (merge, 1.3.460)
  // dur/max >= 0.5 -> resto; below -> dmg; 0 -> dmg + broken tint (CSS);
  // warnAt or below always shows dmg (the warning is VISIBLE).
  function wearState(dur, max, warnAt = 1) {
    if (dur <= 0) return "broken";
    if (dur <= warnAt || dur / max < THRESHOLD) return "worn";
    return "restored";
  }
  // Mythics (single-state, no dmg forms): resto ALWAYS + dim when worn.
  // Missing dmg falls back gracefully: resto + dim, same as a mythic.
  function spriteFor(id, dur, max, item = {}, warnAt = 1) {
    if (item.mythic || !item.dual) return `${id}.png`;
    return wearState(dur, max, warnAt) === "restored" ? `${id}-resto.png` : `${id}-dmg.png`;
  }
  function gleamFor(score) {
    for (const [at, key, title] of GLEAMS) if ((score || 0) >= at) return { key, title };
    return null;
  }
  // Overlays never hide state: gleam + dmg reads as glorious-ruin.
  function iconClasses(dur, max, score, item = {}, warnAt = 1) {
    const out = [], state = wearState(dur, max, warnAt);
    if (state === "broken") out.push("cc-state-broken");
    else if (item.mythic && state === "worn") out.push("cc-state-dim");
    const g = item.fragment && (score || 0) >= 10 ? { key: "gold", title: "Gold gleam" } : gleamFor(score);   // SPEC muse-fragments: no -emp art, so awakened fragments glow gold (kind-independent)
    if (g) out.push(`cc-gleam-${g.key}`);
    return out;
  }
  function stateName(dur, max, score, item = {}, warnAt = 1) {
    const state = wearState(dur, max, warnAt);
    const base = state === "broken" ? "Broken" : state === "worn" ? "Worn" : "Restored";
    const g = item.fragment && (score || 0) >= 10 ? { key: "gold", title: "Gold gleam" } : gleamFor(score);
    return g ? `${base} · ${g.title}` : base;
  }
  // Threshold crossings are EVENTS: any upward state move is a restoration
  // moment, any downward move a decay moment (covers the 0.5 line, warnAt,
  // and breaking — every visible swap CELEBRATES).
  function crossed(before, after, max, warnAt = 1) {
    const d = ORDER[wearState(after, max, warnAt)] - ORDER[wearState(before, max, warnAt)];
    return d > 0 ? "restored" : d < 0 ? "fell" : null;
  }
  // Only gear with worn and restored art (item.dual) changes how it looks; the rest gets a line that promises nothing visible.
  function crossingLine(name, event, item = {}) {
    const looks = !!item.dual && !item.mythic;
    if (event === "restored") return looks ? `${name} is restored: the cracks close, and it shines again.` : `${name} is restored: whole again.`;
    if (event === "fell") return looks ? `${name} has fallen: its wear shows now.` : `${name} has fallen into wear: it needs care.`;
    return null;
  }
  // Mirrors ui.js itemIcon (same path, lazy) + state file, overlay
  // classes, and the state in the alt text for screen readers. Missing
  // dmg falls back gracefully: one swap to resto + dim, same as a mythic,
  // then hide (a missing pair degrades to legacy invisibility, not a
  // broken-image glyph).
  function iconHTML(id, name, dur, max, score, item = {}, warnAt = 1) {
    const cls = ["cc-item-icon", ...iconClasses(dur, max, score, item, warnAt)].join(" ");
    const src = `combat/sprites/items/${encodeURIComponent(spriteFor(id, dur, max, item, warnAt))}`;
    const state = stateName(dur, max, score, item, warnAt).split(" · ")[0].toLowerCase();
    const fail = item.dual && !item.mythic && state !== "restored"
      ? `if(!this.dataset.fb){this.dataset.fb=1;this.src='combat/sprites/items/${encodeURIComponent(id)}-resto.png';this.classList.add('cc-state-dim')}else{this.style.display='none'}`
      : `this.style.display='none'`;
    return `<img class="${cls}" src="${src}" alt="${esc(name)} (${state})" loading="lazy" onerror="${fail}">`;
  }
  return { THRESHOLD, GLEAMS, wearState, spriteFor, gleamFor, iconClasses, stateName, crossed, crossingLine, iconHTML };
});
