"use strict";
// Keeper line tables: plain rows { id, face, when, text } (decision D10: plain tables, not Tracery, so every line is auditable).
// Source: ~/loci-orbit/ready-to-review/claude-npc-faces-spec/specs/NPC_LINES.md. Slice S0 carries Rama only; each later slice adds its keepers.
// Rules (spec section 12; tests/npc-lines.test.mjs lints them): no digits and no number words; tokens only from the whitelist
// `name seeds price item n owed level wins fame slots slotsMax scenario tier cycle`, filled at render time or the line is skipped;
// at most 110 characters and two sentences; no living person; a line may state only what the window does.
//   face: neutral | happy | angry | sad | surprised
//   when: first | return | loss | win | streak | owing | big | idle | buy | refuse | err | mile | leave | fold:<id>
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatKeeperLines = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const row = (keeper, n, face, when, text) => ({ id: `${keeper}.${when}.${n}`, face, when, text });
  const rama = [
    ["neutral", "first", "Choose your ground, Warden. A good fight starts with a good choice."],
    ["neutral", "return", "You are back. Which ground tonight?"],
    ["neutral", "idle", "I do not hurry a decision. I do not wait forever for one either."],
    ["happy", "win", "Well fought. {wins} won so far, and you earned each one."],
    ["happy", "streak", "A fair run. Do not let it make you careless."],
    ["sad", "loss", "You lost that ground. Study it, then take it back."],
    ["sad", "refuse", "That ground is closed to you for now."],
    ["angry", "err", "The gate would not open, and nothing was spent. Try again."],
    ["surprised", "mile", "Level {level} already. The hall takes note."],
    ["neutral", "fold:scenarios", "Every scenario here teaches one thing. Pick the lesson you need."],
  ].map(([face, when, text], i) => row("rama", i, face, when, text));
  return { LINES: { rama } };
});
