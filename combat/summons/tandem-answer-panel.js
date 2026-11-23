"use strict";
// Tandem T5b: the Answer prompt (summons/tandem-answer.js; R-20261122-14, R-20261122-59). Its own file (CONVENTIONS C10): ui.js
// draws it in the command panel while the engine's decider reads kind "answer" for the player's unit.
//
//   html(s, opts)        the prompt's markup (pure; tests read it without a browser). opts: { esc, name(id) }
//   wire(el, s, act)     bind its buttons: act({ type: "tandemAnswer", actor, need, target? })
//
// Every word about a need comes from tandem-answer.js NEEDS and options(s), so the prompt never keeps its own copy.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./tandem-answer.js"));
  else root.ConceptCombatTandemAnswerPanel = factory(root.ConceptCombatTandemAnswer);
})(typeof self !== "undefined" ? self : this, function (TA) {
  const ESC = (v) => String(v ?? "").replace(/[&<>\x22\x27]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\x22": "&quot;", "\x27": "&#39;" }[c]));
  function html(s, opts = {}) {
    const esc = opts.esc || ESC, o = s && s.answerOffer; if (!o) return "";
    const u = s.actors[o.user], t = s.actors[o.tandem], nameOf = (id) => (s.actors[id] ? s.actors[id].name : id);
    const rows = TA.options(s).map((x) => {
      const head = `<b>${esc(x.name)}</b><span class="cc-muted"> · ${esc(x.text)}</span>`;
      if (!x.target) return `<button type="button" class="cc-item" data-answer-need="${esc(x.need)}">${head}</button>`;
      if (!x.ok) return `<div class="cc-item" data-answer-need="${esc(x.need)}" data-answer-none>${head}<br><small class="cc-muted">${x.need === "end" ? "No foe is below a quarter of its LF." : "No one to name."}</small></div>`;
      return `<div class="cc-item" data-answer-need="${esc(x.need)}">${head}<div class="cc-row">${x.targets.map((id) => `<button type="button" data-answer-need="${esc(x.need)}" data-answer-target="${esc(id)}">${esc(nameOf(id))}</button>`).join("")}</div></div>`;
    }).join("");
    return `<div class="cc-tandem-answer-prompt" data-answer-prompt>
      <div class="cc-title">The Answer</div>
      <p>${esc(u ? u.name : "You")} should have fallen. ${esc(t ? t.name : "Your tandem")} holds you at 1 LF and waits. Name one need, and once it answers it is gone for good: it will never come again, and its Trial cannot be taken again.</p>
      ${rows}
      <button type="button" class="cc-item" data-answer-need="fall">Ask nothing<span class="cc-muted"> · the blow falls, and ${esc(t ? t.name : "it")} stays yours</span></button>
    </div>`;
  }
  function wire(el, s, act) {
    const o = s && s.answerOffer; if (!o || !el) return;
    el.querySelectorAll("button[data-answer-need]").forEach((b) => {
      b.onclick = () => act({ type: "tandemAnswer", actor: o.user, need: b.dataset.answerNeed, ...(b.dataset.answerTarget ? { target: b.dataset.answerTarget } : {}) });
    });
  }
  return { html, wire };
});
