"use strict";
// The Tandem wing (Tandem T2c; muse-tandem-spirit-spec SPEC.md section 3; R-20261115-42): the list of tandems and their Trials.
// Its own file (CONVENTIONS C10): ui.js calls `attach` once from the character sheet, which adds the sheet's "Tandem wing" button.
//
//   attach(ov, deps)   add the button to the open character sheet's header and wire it to mount
//   mount(ov, deps)    draw the wing in the overlay
//   html(account)      the wing's markup (pure; tests read it without a browser)
//   deps: { account: () => account, begin: (tandemId) => void, back: () => void }
//
// Every rule and number shown comes from summons/tandem-trial.js `view` (which reads the tandem's row), so the wing states the
// Trial's price before the player begins and never keeps its own copy of it. Begin starts the Trial's battle; Refuse leaves and
// writes nothing.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./tandem-trial.js"), require("./tandem.js"), require("./summons-data.js"));
  else root.ConceptCombatTandemWing = factory(root.ConceptCombatTandemTrial, root.ConceptCombatTandem, root.ConceptCombatSummonData);
})(typeof self !== "undefined" ? self : this, function (Trial, Tandem, SD) {
  const esc = (s) => String(s ?? "").replace(/[&<>\x22\x27]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\x22": "&quot;", "\x27": "&#39;" }[c]));
  const BADGE = { none: "cc-muted", passed: "cc-good", failed: "cc-bad" };

  function rowHtml(v) {
    const t = SD.summons[v.id].tandem;
    return `<section class="cc-hall-offer cc-tandem-row" data-tandem-row="${esc(v.id)}" data-status="${esc(v.status)}">
      <div class="cc-pick-stage"><img src="combat/sprites/${esc(v.id)}/idle.png" alt="${esc(v.name)}" style="max-height:96px;image-rendering:pixelated"></div>
      <div><h3>${esc(v.name)} <small class="${BADGE[v.status] || "cc-muted"}" data-tandem-status>${esc(v.label)}</small></h3>
        <p class="cc-muted">Its Trial is an ordeal of ${esc(v.quality)}.</p>
        ${Tandem.cardHtml(t, esc)}
        <p data-tandem-terms>${esc(v.terms)}</p>
        <p data-tandem-detail><b>${esc(v.detail)}</b></p>
        <div class="cc-row"><button type="button" class="cc-primary" data-tandem-begin="${esc(v.id)}" ${v.canBegin ? "" : "disabled"} title="${esc(v.canBegin ? `Begin: survive ${v.rounds} rounds` : v.reason)}">Begin the Trial</button>
          ${v.canBegin ? "" : `<small class="cc-muted" data-tandem-why>${esc(v.reason)}</small>`}</div></div>
    </section>`;
  }
  function html(account) {
    const rows = Trial.list(account);
    return `<div class="cc-card cc-tandem-wing" role="dialog" aria-label="The Tandem wing"><header><div><h2>The Tandem wing</h2>
      <p class="cc-muted">A tandem is a bonded spirit that fights beside you: one body, one rule, one price. None is bought or levelled into. Each waits behind a Trial; pass it and the tandem takes a room in your palace.</p></div></header>
      ${rows.length ? rows.map(rowHtml).join("") : `<p class="cc-muted">No tandem waits here yet.</p>`}
      <div class="cc-row"><span class="cc-muted">Refusing a Trial costs nothing and changes nothing. It waits.</span><span><button type="button" id="ccTandemRefuse">Refuse and leave</button></span></div></div>`;
  }
  function wireBegin(ov, deps) {
    ov.querySelectorAll("[data-tandem-begin]").forEach((b) => { b.onclick = () => { const v = Trial.view(deps.account(), b.dataset.tandemBegin); if (v && v.canBegin) deps.begin(v.id); }; });
  }
  function mount(ov, deps) {
    ov.hidden = false; ov.innerHTML = html(deps.account());
    wireBegin(ov, deps);
    ov.querySelector("#ccTandemRefuse").onclick = () => deps.back();
    (ov.querySelector("[data-tandem-begin]:not([disabled])") || ov.querySelector("#ccTandemRefuse")).focus();
  }
  function attach(ov, deps) {
    const header = ov.querySelector(".cc-sheet header"); if (!header || header.querySelector("#ccSheetTandems") || !Trial.ids().length) return false;
    const b = ov.ownerDocument.createElement("button"); b.type = "button"; b.id = "ccSheetTandems"; b.textContent = "Tandem wing";
    header.appendChild(b); b.onclick = () => mount(ov, deps);
    return true;
  }
  return { html, mount, attach, rowHtml, wireBegin };
});
