"use strict";
// The Courthouse screen (Investigate I5b; claude-investigate-spec 12.2): three collapsible sections, Laws, Open cases
// and Closed cases. Pure: panel(account) returns an HTML string; ui.js showCourthouse mounts it. Every number in the
// Laws section is read from law/law.js LAW, so the text matches the code (I5-9).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./law.js"), require("./trial.js"));
  else root.ConceptCombatCourthouseUI = factory(root.ConceptCombatLaw, root.ConceptCombatTrial);
})(typeof self !== "undefined" ? self : this, function (Law, Trial) {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const nat = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const LAW = () => (Law && Law.LAW) || {};
  // The evidence grades, firmest first (trial.js GRADES; I4c: found argues like witnessed). "struck" is a spent
  // grade, not evidence, so the Laws section does not list it.
  const grades = () => Object.entries((Trial && Trial.GRADES) || {}).filter(([g]) => g !== "struck")
    .sort((a, b) => b[1] - a[1]).map(([g]) => g);

  function lawsSection(account) {
    const L = LAW();
    if (!Law) return `<p class="cc-muted">The laws are closed.</p>`;
    const st = L.statute || {}, wa = L.warrant || {}, ju = L.judgment || {}, od = L.ordeal || {};
    const a = account || {}, cases = (a.cases && typeof a.cases === "object") ? a.cases : {};
    const nOpen = Object.keys(cases.open || {}).length, nClosed = (cases.closed || []).length, nConv = Object.keys(cases.convicted || {}).length;
    return `<p>A Statute taxes one named delivery inside its zone (radius ${nat(st.radius)}): +${nat(st.apAdd)} AP for ${nat(st.turns)} turns. `
      + `A Warrant makes one enemy an Outlaw the law follows everywhere (range ${nat(wa.range)}): +${nat(wa.apAdd)} AP for ${nat(wa.turns)} turns. `
      + `Judgment of the Gods sentences each breach: base ${nat(ju.base)}, +${nat(ju.perBreach)} a breach (cap ${nat(ju.breachCap)}).</p>`
      + `<p>Evidence comes in grades: ${grades().map(esc).join(", ")}. The Ordeal of the River tries what the court cannot: trial ${nat(od.trial)}, a false accuser pays ${nat(od.falseAccuser)}.</p>`
      + `<p>Your record: ${nOpen} open, ${nClosed} closed, ${nConv} conviction${nConv === 1 ? "" : "s"} on file.</p>`;
  }

  function openSection(account) {
    const a = account || {}, now = nat(a.battles);
    const open = (a.cases && a.cases.open) || {};
    const ids = Object.keys(open);
    if (!ids.length) return `<p class="cc-muted">No open cases. Breaches recorded in battle open one here at the battle's end.</p>`;
    return ids.map((id) => {
      const k = open[id] || {}, crimes = Array.isArray(k.crimes) ? k.crimes : [];
      const gs = [...new Set(crimes.map((c) => c.grade))].join(", ");
      const found = crimes.filter((c) => c.grade === "found").length;
      const ago = Math.max(0, now - nat(k.opened));
      return `<div class="cc-hall-offer"><div><b>${esc(k.name || id)}</b><p>${crimes.length} crime${crimes.length === 1 ? "" : "s"} (${esc(gs)}) `
        + `· opened ${ago} battle${ago === 1 ? "" : "s"} ago · awaits a verdict${found ? ` · ${found} found` : ""}.</p></div></div>`;
    }).join("");
  }

  function closedSection(account) {
    const closed = ((account || {}).cases || {}).closed || [];
    if (!closed.length) return `<p class="cc-muted">No closed cases yet. A verdict or the Ordeal closes one, newest first.</p>`;
    return closed.map((k) => `<div class="cc-hall-offer"><div><b>${esc((k && k.name) || (k && k.classId) || "?")}</b>`
      + `<p>${esc((k && k.closed && k.closed.verdict) || "?")} · battle ${nat(k && k.closed && k.closed.battle)}.</p></div></div>`).join("");
  }

  // Three collapsible sections like the Codex (spec 12.2): <details> is the codebase's other collapsible
  // (the Codex uses .cc-cx; plant field notes use <details>). Open cases start open; the rest start closed.
  function panel(account) {
    const a = account || {}, open = (a.cases && a.cases.open) || {}, closed = (a.cases && a.cases.closed) || [];
    return `<section class="cc-courthouse" aria-label="Courthouse">`
      + `<details class="cc-ch-law"><summary><b>Laws</b></summary>${lawsSection(a)}</details>`
      + `<details class="cc-ch-open" open><summary><b>Open cases</b> <small>${Object.keys(open).length} open</small></summary>${openSection(a)}</details>`
      + `<details class="cc-ch-closed"><summary><b>Closed cases</b> <small>${closed.length} closed</small></summary>${closedSection(a)}</details>`
      + `</section>`;
  }

  return { panel, lawsSection, openSection, closedSection };
});
