"use strict";
// Fight Tapes FT1: the Tapes drawer (D2, R-20261118-03: a "Tapes" button beside Copy log and "Open Tape" on the
// Battle over panel; the drawer pattern of the AI inspector, ui.js openDecisionInspector). Its own file (CONVENTIONS C10):
// ui.js only mounts it and passes what it needs. Newest tape first; one tape shows its entering stat cards with the
// kit it used and never used, what each side knew at the end, the box score, the full log, Copy tape and Export .json.
//
//   mount(host, { tapes, copy, download }) -> { open(id?), close(), isOpen() }
//     tapes():            the saved list (oldest first, as tapes.js keeps it)
//     copy(text):         a promise; the drawer says "Tape copied." or why it could not
//     download(name, text): saves a file (the page's own download path)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./tapes.js"));
  else root.ConceptCombatTapesDrawer = factory(root.ConceptCombatTapes);
})(typeof self !== "undefined" ? self : this, function (T) {
  const STYLE = ".cc-tapes{color:#edf3fa;font:max(var(--pn-text-floor, 13px), calc(14px * var(--pn-text-step, 1)))/1.45 system-ui}"
    + ".cc-tapes h3{margin:6px 8px}.cc-tapes .cc-tapes-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 8px}"
    + ".cc-tapes button{font:inherit;color:#edf3fa;background:#23364d;border:1px solid #8b9db3;border-radius:4px;padding:5px 8px;cursor:pointer}"
    + ".cc-tapes button[aria-current=true]{background:#2f5470;border-color:#7ee7d5}.cc-tapes :focus-visible{outline:3px solid #7ee7d5;outline-offset:2px}"
    + ".cc-tapes .cc-tape-badge{padding:1px 6px;border-radius:9px;background:#33465c}.cc-tapes .cc-tape-badge.win{background:#2e6b4a}.cc-tapes .cc-tape-badge.loss{background:#7a3340}"
    + ".cc-tapes .cc-tape-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;margin:8px}"
    + ".cc-tapes .cc-tape-card{border:1px solid #4d6178;border-radius:6px;padding:6px 8px;background:#1b2a3c}"
    + ".cc-tapes .cc-kit-used{color:#9fe8c2}.cc-tapes .cc-kit-unused{color:#f0b9a0;text-decoration:underline dotted}"
    + ".cc-tapes pre{white-space:pre-wrap;max-height:50vh;overflow:auto;margin:8px;padding:8px;background:#0f1824;border:1px solid #33465c}";
  const esc = (s) => String(s ?? "").replace(/[&<>\x22\x27]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const badge = (t) => {
    if (t.practice) return `<span class="cc-tape-badge">Practice</span>`;
    const w = T.winnerOf(t);
    return w === "player" ? `<span class="cc-tape-badge win">Win</span>` : w === "none" || w === "draw" ? `<span class="cc-tape-badge">Draw</span>` : `<span class="cc-tape-badge loss">Loss</span>`;
  };
  function knowledgeLines(t) {
    const out = [];
    for (const [side, targets] of Object.entries(t.knowledgeAtEnd || {})) {
      const n = targets && typeof targets === "object" ? Object.keys(targets).length : 0;
      if (n) out.push(`${side}: learned about ${n} ${n === 1 ? "fighter" : "fighters"}`);
    }
    return out;
  }
  function cardHtml(t, c) {
    const left = new Set((t.telemetry?.unusedKit || {})[c.id] || []);
    const st = c.stats || {}, b = (t.telemetry?.byActor || {})[c.id];
    const kit = (c.kit || []).map((k) => `<span class="${left.has(k.id) ? "cc-kit-unused" : "cc-kit-used"}" title="${left.has(k.id) ? "never used" : "used"} · ${esc(k.cost)} ΦF · ${esc(k.tempoCost)} AP · range ${esc(k.range)}">${esc(k.name)}</span>`).join(", ");
    return `<div class="cc-tape-card" data-tape-card="${esc(c.id)}"><b>${esc(c.name)}</b> <small>${esc(c.character || "")} · ${esc(c.side || "")}${c.isSummon ? " · summon" : ""}${c.isBoss ? " · boss" : ""}</small>`
      + `<div>LF ${esc(st.lf)}/${esc(st.maxLF)} · ΦF ${esc(st.pf)}/${esc(st.maxPF)} · AP ${esc(st.tempoCapacity)}</div>`
      + `<div>${esc(c.concepts?.primary || "-")} + ${esc(c.concepts?.secondary || "-")}${(c.traits || []).length ? ` · ${esc(c.traits.join(", "))}` : ""}</div>`
      + (kit ? `<div>Kit: ${kit}</div>` : "")
      + (b ? `<div><small>dealt ${b.dealt} · taken ${b.taken} · kills ${b.kills}</small></div>` : "") + `</div>`;
  }
  function mount(host, deps = {}) {
    const doc = host.ownerDocument || document;
    if (!doc.getElementById("ccTapesStyle")) { const st = doc.createElement("style"); st.id = "ccTapesStyle"; st.textContent = STYLE; doc.head.appendChild(st); }
    const panel = doc.createElement("div"); panel.className = "emissary-drawer cc-tapes"; panel.id = "ccTapesDrawer"; panel.hidden = true;
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Fight tapes");
    host.appendChild(panel);
    let current = null, opener = null;
    const tapes = () => { try { return (deps.tapes?.() || []).slice().reverse(); } catch { return []; } };
    function render() {
      const all = tapes();
      if (!all.length) { panel.innerHTML = `<div class="cc-tapes-row"><button type="button" data-tapes-close>Close tapes</button></div><p class="cc-tapes-row" data-tapes-empty>${esc(T.COPY.empty)}</p>`; bind(); return; }
      const t = all.find((x) => x.id === current) || all[0]; current = t.id;
      const list = all.map((x) => `<button type="button" data-tape="${esc(x.id)}" aria-current="${x.id === t.id}">[v${esc(x.build)}] ${esc(x.scenario || x.encounter || x.mode || "battle")} · ${esc(x.arena?.name || "?")} ${badge(x)}</button>`).join("");
      const know = knowledgeLines(t), lessons = Object.values(t.lessonsAtEnd || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
      panel.innerHTML = `<div class="cc-tapes-row"><button type="button" data-tapes-close>Close tapes</button><button type="button" data-tape-copy>Copy tape</button><button type="button" data-tape-export>Export .json</button><span data-tapes-flash aria-live="polite"></span></div>`
        + `<div class="cc-tapes-row" data-tapes-list>${list}</div>`
        + `<h3 data-tape-header>${esc(T.header(t))}</h3>`
        + `<div class="cc-tapes-row"><small>${esc(t.at)} · seed ${esc(t.seed)} · ${t.actions.length} actions${know.length ? " · " + esc(know.join("; ")) : ""}${lessons ? ` · ${lessons} AI lessons at the end` : ""}</small></div>`
        + `<div class="cc-tape-cards">${(t.cards || []).map((c) => cardHtml(t, c)).join("")}</div>`
        + `<pre data-tape-text>${esc(t.text)}</pre>`;
      bind();
    }
    const flash = (msg) => { const f = panel.querySelector("[data-tapes-flash]"); if (f) f.textContent = msg; };
    function bind() {
      panel.querySelector("[data-tapes-close]")?.addEventListener("click", close);
      panel.querySelectorAll("[data-tape]").forEach((b) => b.addEventListener("click", () => { current = b.dataset.tape; render(); [...panel.querySelectorAll("[data-tape]")].find((x) => x.dataset.tape === current)?.focus(); }));
      const t = tapes().find((x) => x.id === current);
      panel.querySelector("[data-tape-copy]")?.addEventListener("click", async () => { if (!t) return; try { await deps.copy?.(T.formatTapeText(t)); flash("Tape copied."); } catch { flash("Couldn't reach the clipboard."); } });
      panel.querySelector("[data-tape-export]")?.addEventListener("click", () => { if (!t) return; try { deps.download?.(`loci-tape-${t.id}.json`, JSON.stringify(t, null, 2)); flash("Tape exported."); } catch { flash("Couldn't save the file."); } });
    }
    function open(id) { opener = doc.activeElement; if (id) current = id; render(); panel.hidden = false; panel.querySelector("[data-tapes-close]")?.focus(); }
    function close() { panel.hidden = true; const back = opener && opener.isConnected ? opener : doc.getElementById("ccTapes"); if (back && back.focus) back.focus(); }   // a re-rendered opener falls back to the Tapes button
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    return { open, close, isOpen: () => !panel.hidden, panel };
  }
  return { mount, STYLE };
});
