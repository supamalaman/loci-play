"use strict";
// RT1a: the Room is an entrance to the existing scenario and Trial runner.
// The shared rows read the same account and launch the same battle as the Tandem wing.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./tandem-trial.js"), require("./tandem-wing.js"));
  else root.ConceptCombatRoomOfTrials = factory(root.ConceptCombatTandemTrial, root.ConceptCombatTandemWing);
})(typeof self !== "undefined" ? self : this, function (Trial, Wing) {
  const title = "Room of Trials";

  function html(account) {
    const raven = (account.unlocked || []).includes("raven") ? `<section class="cc-hall-offer" data-trial-chamber="raven">
      <div class="cc-pick-stage"><img src="combat/sprites/raven/idle.png" alt="" width="48" style="image-rendering:pixelated"></div>
      <div><h3>The Raven’s Choice <small class="cc-good">Already tamed</small></h3>
      <p>The Raven is already in your Palace. Its branch choice is not yet open.</p></div>
    </section>` : "";
    return `<div class="cc-card cc-room-of-trials" role="dialog" aria-label="${title}">
      <header><h2>${title}</h2><button type="button" data-room-back>Back to character sheet</button></header>
      ${raven}
      <section data-trial-chamber="ordeals">${Trial.list(account).map(Wing.rowHtml).join("")}</section>
      <button type="button" data-room-back>Refuse Trial</button>
    </div>`;
  }

  function mount(ov, deps) {
    ov.hidden = false;
    ov.innerHTML = html(deps.account());
    Wing.wireBegin(ov, deps);
    ov.querySelectorAll("[data-room-back]").forEach((button) => { button.onclick = deps.back; });
    ov.querySelector("[data-room-back]").focus();
  }

  function attach(ov, deps) {
    const header = ov.querySelector(".cc-sheet header");
    if (!header || header.querySelector("#ccSheetTrials")) return;
    const button = ov.ownerDocument.createElement("button");
    button.type = "button";
    button.id = "ccSheetTrials";
    button.textContent = title;
    button.onclick = () => mount(ov, deps);
    header.appendChild(button);
  }

  return { html, attach };
});
