"use strict";
// Exile tenancy, the offer card (slice T0a; spec EXILE_TENANCY.md section 8 door 1, pulled forward by R-20261115-49). Before a random battle, a seeded
// chance (account/tenancy.js offerFor) puts one card in the overlay: someone asks for a room. Accept houses her at Coherence 1; decline is free and
// she may ask again after a rest. The card is a step inside the start flow, not a window: it owns the overlay until a button is pressed, then hands the
// new account back through `done` and the caller starts the battle. All text is built from content.js rules.tenancy and the ability row, so the card
// promises exactly what the code does: she lends nothing before Guest, and her keep is the first Guard of each battle from the day she lends.
//
//   maybe({ ov, account, test, force, done }) → true when a card was shown (the caller returns and waits for `done(account, line)`), false otherwise
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTenancyUI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const need = (path, global) => { try { if (typeof module === "object" && module.exports) return require(path); } catch {} return (typeof self !== "undefined" ? self[global] : null); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LINES = { title: "Someone asks for a room", accept: "Let her stay", decline: "Not now" };

  // The card's body, from the constants: the exile's name and uses, and the ability's range.
  function body(id) {
    const C = need("../content.js", "ConceptCombatContent"), row = C.rules.tenancy.exiles[id], ab = C.abilities[row.power];
    return `${row.name} has no house left to go back to. She asks to stay with you. She learned the words for this by watching people rent rooms. If she stays, she will lend you her way of walking once you know each other: ${row.uses} steps a battle, up to ${ab.range} tiles. From the day she lends it, her keep is your first Guard of each battle.`;
  }

  function maybe({ ov, account, test = false, force = null, done }) {
    const T = need("./tenancy.js", "ConceptCombatTenancy"); if (!T || !ov || typeof done !== "function") return false;
    const id = T.offerFor(account, { test, force }); if (!id) return false;
    ov.hidden = false;
    ov.innerHTML = `<div class="cc-card cc-exile-offer" role="dialog" aria-label="${esc(LINES.title)}" data-exile="${esc(id)}">
      <h2>${esc(LINES.title)}</h2>
      <p>${esc(body(id))}</p>
      <div class="cc-row"><button type="button" class="cc-gold" id="ccExileAccept">${esc(LINES.accept)}</button><button type="button" id="ccExileDecline">${esc(LINES.decline)}</button></div>
    </div>`;
    const finish = (r) => { ov.hidden = true; ov.innerHTML = ""; done(r.account, r.line); };
    ov.querySelector("#ccExileAccept").onclick = () => finish(T.accept(account, id));
    ov.querySelector("#ccExileDecline").onclick = () => finish(T.decline(account, id));
    const first = ov.querySelector("#ccExileAccept"); if (first && first.focus) first.focus();
    return true;
  }
  return { maybe };
});
