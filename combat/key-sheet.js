"use strict";
// The key sheet, Access AC5 (claude-access-spec, AC5; R-20261114-09; Mala, 2026-11-14: "a more accessible game").
// C10: a new panel is its own file; ui.js mounts it, its onKey reads the sheet's key from here, and its `? Keys` button opens it.
// KEYS is the one list of battle keys. tests/access-ac5-key-sheet.test.mjs holds it to ui.js onKey both ways: every key the
// handler takes is in a row, and every key in a row is taken. A key the handler starts taking goes in a row in the same change.
//
//   KEYS      rows { keys: [KeyboardEvent.key values; letters lower case], label, group, does, when? }
//   GROUPS    the four groups in sheet order (menu, map, camera, windows)
//   OPEN_KEY  the key that opens and shuts the sheet ("?")
//   html()    the sheet's markup (a dialog with one table per group)
//   create(parent)  -> { el, open(), close(), toggle(), isOpen() }; Escape and ? are handled by ui.js onKey, a click outside
//             the card and the Close button here; closing returns focus to whatever had it when the sheet opened.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./command-search.js"));
  else root.ConceptCombatKeySheet = factory(root.ConceptCombatCommandSearch);
})(typeof self !== "undefined" ? self : this, function (CS) {
  const esc = (s) => String(s ?? "").replace(/[&<>\x22]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const OPEN_KEY = "?";
  const PINS = Math.max(1, Math.min(9, (CS && CS.PINS_MAX) || 6));   // ui.js takes 1 to PINS_MAX (command-search.js), never more
  const pinKeys = Array.from({ length: PINS }, (_, i) => String(i + 1));
  const GROUPS = [
    { id: "menu", title: "Command menu" },
    { id: "map", title: "Map" },
    { id: "camera", title: "Camera" },
    { id: "windows", title: "Windows" },
  ];
  const KEYS = [
    { group: "menu", keys: ["ArrowUp", "ArrowDown"], label: "↑ ↓", does: "Move through the commands", when: "in the command menu" },
    { group: "menu", keys: ["Enter", "ArrowRight"], label: "Enter or →", does: "Choose the highlighted command", when: "in the command menu" },
    { group: "menu", keys: ["ArrowLeft", "Backspace"], label: "← or Backspace", does: "Back one step", when: "in the command menu" },
    { group: "menu", keys: ["/"], label: "/", does: "Search the commands", when: "on the main page of the command menu" },
    { group: "menu", keys: pinKeys, label: `1 to ${PINS}`, does: "Use a command pinned to the quick bar", when: "in the command menu, with no battle card open" },
    { group: "menu", keys: ["Enter"], label: "Enter", does: "Start the battle", when: "on the setup screen" },
    { group: "map", keys: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"], label: "Arrows or W A S D", does: "Move the tile cursor", when: "while choosing a tile" },
    { group: "map", keys: ["Enter"], label: "Enter", does: "Confirm the tile under the cursor", when: "while choosing a tile" },
    { group: "map", keys: ["i"], label: "I", does: "Open the unit window for the tile under the cursor", when: "until the battle ends" },
    { group: "camera", keys: ["+", "="], label: "+ or =", does: "Zoom in", when: "in a battle" },
    { group: "camera", keys: ["-"], label: "−", does: "Zoom out", when: "in a battle" },
    { group: "camera", keys: ["0"], label: "0", does: "Reset the zoom", when: "in a battle" },
    { group: "camera", keys: ["c"], label: "C", does: "Centre the camera on your fighter", when: "in a battle" },
    { group: "windows", keys: ["Escape"], label: "Esc", does: "Close the open window; on your turn, go back one step" },
    { group: "windows", keys: [" ", "Enter"], label: "Space or Enter", does: "Close the attack scene", when: "while an attack scene shows" },
    { group: "windows", keys: [" "], label: "Space", does: "Skip the wait for the line on screen", when: "at Pace: Slow" },
    { group: "windows", keys: ["g"], label: "G", does: "Open or close the concept map" },
    { group: "windows", keys: [OPEN_KEY], label: "?", does: "Open or close this key sheet" },
  ];

  function html() {
    const groups = GROUPS.map((g) => {
      const rows = KEYS.filter((r) => r.group === g.id).map((r) =>
        `<tr><th scope="row"><kbd>${esc(r.label)}</kbd></th><td>${esc(r.does)}${r.when ? ` <span class="cc-keys-when">${esc(r.when)}</span>` : ""}</td></tr>`).join("");
      return `<section class="cc-keys-group" data-group="${g.id}"><h3>${esc(g.title)}</h3><table>${rows}</table></section>`;
    }).join("");
    return `<div class="cc-keys-card" role="dialog" aria-modal="true" aria-labelledby="ccKeysTitle">
      <div class="cc-keys-head"><b id="ccKeysTitle">Keys</b><span class="cc-spacer"></span><button type="button" class="cc-keys-close">Close</button></div>
      <div class="cc-keys-body">${groups}</div>
      <p class="cc-keys-foot">Press ? or Esc to close.</p></div>`;
  }

  function create(parent) {
    const el = parent.ownerDocument.createElement("div");
    el.className = "cc-keys"; el.id = "ccKeys"; el.hidden = true; el.innerHTML = html();
    parent.appendChild(el);
    let back = null;   // the element that had focus when the sheet opened
    const isOpen = () => !el.hidden;
    const open = () => { if (!el.hidden) return; back = parent.ownerDocument.activeElement; el.hidden = false; el.querySelector(".cc-keys-close").focus(); };
    const close = () => { if (el.hidden) return; el.hidden = true; if (back && back.isConnected && back.focus) back.focus(); back = null; };
    const toggle = () => (isOpen() ? close() : open());
    el.querySelector(".cc-keys-close").onclick = close;
    el.addEventListener("keydown", (ev) => { if (ev.key === "Tab") { ev.preventDefault(); el.querySelector(".cc-keys-close").focus(); } });   // aria-modal: Tab stays inside (Close is the one control)
    el.addEventListener("click", (ev) => { if (ev.target === el) close(); });   // a click outside the card (on the backdrop) shuts it
    return { el, open, close, toggle, isOpen };
  }

  return { KEYS, GROUPS, OPEN_KEY, html, create };
});
