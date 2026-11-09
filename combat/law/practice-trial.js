"use strict";
// Practice a trial (slice M0 of claude-magistrate-court-spec, MAGISTRATE-COURT.md 1.4; Mala, 2026-11-07: "the tutorial in
// the magistrates codex, that allows you to go through a hypothetical mock trial for practice"). A real courtroom-form
// trial (law/trial.js) on authored, made-up counts, run in the Magistrate's Codex. Nothing here touches the account:
// no record, Fame, Board, standing or Seeds. It teaches only what the live courtroom does (its legal plays, favor and
// sentences); later slices add their own steps (the record, the plea, accept or fight).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./trial.js"));
  else root.ConceptCombatPracticeTrial = factory(root.ConceptCombatTrial);
})(typeof self !== "undefined" ? self : this, function (TR) {
  const YOU = "you", PROSECUTOR = "prosecutor";
  const unit = (id, name, side, honest = false) => ({ id, name, side, honest, lf: 10, maxLF: 10, alive: true, arrivalRound: 0 });

  // Three cases, each teaching one idea. Counts use the trial core's own shapes (grade, severity, ledgerAct).
  const CASES = [
    { id: "gate", title: "The Gate Statute", teaches: "Grades and favor",
      blurb: "You crossed the Magistrate's toll gate without paying. A toll-keeper saw it.",
      counts: [{ id: "gate-toll", label: "crossing the toll gate unpaid", grade: "witnessed", severity: 1, ledgerAct: true }],
      units: [unit("companion", "Your companion", "ally"), unit("tollkeeper", "The toll-keeper", "neutral")],
      coach: "A witnessed count holds its grade when argued: arguing moves the room only a little. A witness who speaks for you can lower the grade itself." },
    { id: "brawl", title: "The Market Brawl", teaches: "Announced acts and thin counts",
      blurb: "You announced a strike in the market, and a rumor says you also broke a stall.",
      counts: [{ id: "brawl-strike", label: "an announced strike in the market", grade: "sworn", severity: 2, ledgerAct: true },
        { id: "brawl-stall", label: "testimony: a broken stall", grade: "unproven", severity: 1, ledgerAct: false }],
      units: [unit("cousin", "Your cousin", "ally"), unit("fishmonger", "The fishmonger (honest)", "neutral", true)],
      coach: "You cannot argue with an act you announced: a sworn count argues itself. Spend your turns where they work. An honest witness tells the truth, even when you call them." },
    { id: "coin", title: "The Ferryman's Coin", teaches: "Alleged charges, and death on the table",
      blurb: "Someone says you stole the ferryman's coin. Nobody saw it, but the charge is grave.",
      counts: [{ id: "coin-theft", label: "testimony: the ferryman's coin", grade: "unproven", severity: 3, ledgerAct: false }],
      units: [unit("friend", "A friend", "ally"), unit("ferryman", "The ferryman (honest)", "neutral", true)],
      coach: "An unproven count is thin: argue it and it can be struck from the record. When the Magistrate presides, the worst verdict is death." },
  ];
  const byId = (id) => CASES.find((c) => c.id === id) || null;

  // What a real court would do with each sentence (courtroom.js applyVerdicts). Only live sentences are named.
  const REAL = {
    confiscate: "one of your techniques would be sealed for the rest of the battle.",
    sword: "the Executioner's Sword would fall: death, unless you dodge it with a free reaction and a severed limb.",
    minor: "you would lose 25 tempo at once.",
    "guilty-trait": "you would carry the Guilty trait for the battle: later sentences bite harder.",
    harsh: "you would carry the Guilty trait for the battle: later sentences bite harder.",
    incarceration: "the police would come to cuff you.",
  };

  const MOVE = {
    defense: { argue: ["Argue", "Speak against the count. It strikes an unproven count; on a witnessed one it moves the room a little."],
      appeal: ["Appeal for leniency", "Spend goodwill to soften the room. Under the Magistrate it fails badly."],
      finalPlea: ["Final plea", "Lay everything bare, once per trial. It hurts you if sworn counts still stand."],
      end: ["Rest", "Let the count stand as graded."] },
    prosecution: { press: ["Press the count", "Push the charge. A sworn count barely needs it; an unproven one needs a witness."],
      end: ["Rest", "Let the count stand as graded."] },
  };

  const other = (side) => (side === "defense" ? "prosecution" : "defense");
  const openCount = (t) => t.counts.find((c) => c.status === "open") || null;

  // The other bench plays the live courtroom policies (courtroom.js advance): the prosecution calls a witness on an
  // unproven count when it has one and presses otherwise; the defense always argues.
  function policy(t, side) {
    const c = openCount(t); if (!c) return "end";
    if (side === "prosecution") {
      if (c.grade === "unproven") { const pool = TR.witnessPool(t, "prosecution", c); if (pool.length) return { kind: "evidence", witnessId: pool[0].id }; }
      return "press";
    }
    return "argue";
  }

  function start(caseId, opts = {}) {
    const k = byId(caseId); if (!k) return { ok: false, error: `No practice case ${caseId}.` };
    const side = opts.side === "prosecution" ? "prosecution" : "defense";
    const t = TR.openTrial({ form: "courtroom", accusedId: YOU, prosecutorId: PROSECUTOR, seed: 7, units: k.units, counts: k.counts });
    const session = { caseId: k.id, side, t, turns: 0 };
    if (side === "defense") TR.play(t, "prosecution", policy(t, "prosecution"));   // the prosecution opens each round
    return { ok: true, session };
  }

  // The player's choices: the trial core's legal plays for that bench, with one button per witness for "evidence".
  function options(session) {
    const t = session.t, side = session.side; if (t.over) return [];
    const c = openCount(t); if (!c) return [];
    const out = [];
    for (const move of TR.legalPlays(t, side)) {
      if (move === "evidence") {
        for (const w of TR.witnessPool(t, side, c)) out.push({ move: { kind: "evidence", witnessId: w.id }, label: `Call ${w.name}`, help: `${w.name} testifies for the ${side}.${w.honest ? " Honest: tells only the truth." : ""}` });
        continue;
      }
      const m = MOVE[side][move]; if (!m) continue;   // only moves this practice explains (the live courtroom's plays)
      out.push({ move, label: m[0], help: m[1] });
    }
    return out;
  }

  // One player move, then the other bench answers (if the trial is still open), the way a live round runs.
  function step(session, move) {
    const t = session.t; if (t.over) return { ok: false, error: "The trial is over." };
    const legal = options(session).some((o) => JSON.stringify(o.move) === JSON.stringify(move));
    if (!legal) return { ok: false, error: "Not a legal play right now." };
    const r = TR.play(t, session.side, move); if (r && r.ok === false) return r;
    session.turns++;
    if (!t.over) TR.play(t, other(session.side), policy(t, other(session.side)));
    return { ok: true };
  }

  // The verdict in plain words, and what a real court would have done (never applied here).
  function result(session) {
    const t = session.t; if (!t.over || !t.verdicts) return null;
    const counts = t.verdicts.counts.map((v) => ({ count: t.counts.find((c) => c.id === v.count)?.label || v.count, verdict: v.verdict, how: v.how }));
    const real = (t.verdicts.sentences || []).map((s) => REAL[s.kind]).filter(Boolean);
    const guilty = counts.some((c) => c.verdict === "guilty");
    const summary = { favor: t.favor, counts, guilty };
    summary.presided = !!t.magistrate;
    summary.real = real.length ? real.map((x) => `In a real court, ${x}`) : [guilty ? "In a real court, the verdict would stand with no further sentence." : "In a real court, you would walk free."];
    return summary;
  }

  // ── the screen (browser only) ──
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  function mount(ov, opts = {}) {
    const back = opts.back || (() => {});
    let session = null, side = "defense", note = "";
    const favorBar = (f) => {
      const pct = ((f + 12) / 24) * 100;
      return `<div class="cc-pt-favor" role="img" aria-label="Favor ${f >= 0 ? "+" : ""}${f}"><div class="cc-pt-zones"><span class="z-sword">Sword</span><span class="z-conf">Confiscate</span><span class="z-acq">Acquit</span></div><div class="cc-pt-track"><i style="left:${pct}%"></i></div><small>Favor ${f >= 0 ? "+" : ""}${f} · −2 or lower: the Sword (if the Magistrate presides) · −1 to +1: confiscate · +2 or higher: acquit</small></div>`;
    };
    const picker = () => `<div class="cc-card cc-town-hall cc-codex cc-practice"><h2>Practice a trial</h2>
      <p class="cc-muted">A made-up case, tried by the real court rules. Nothing you do here counts: no record, no Fame, no cost.</p>
      <div class="cc-row" role="group" aria-label="Your bench"><button type="button" data-pt-side="defense" aria-pressed="${side === "defense"}">Defend</button><button type="button" data-pt-side="prosecution" aria-pressed="${side === "prosecution"}">Prosecute instead</button></div>
      ${CASES.map((k) => `<div class="cc-hall-offer"><div><b>${esc(k.title)}</b> <small>${esc(k.teaches)}</small><p>${esc(k.blurb)}</p></div><button type="button" class="cc-primary" data-pt-case="${k.id}">Try it</button></div>`).join("")}
      <div class="cc-row"><button type="button" id="ccPtBack">← Back to the Codex</button></div></div>`;
    const trialView = () => {
      const t = session.t, k = byId(session.caseId), res = result(session);
      const lines = t.log.slice(-8).map((e) => `<li>${esc(e.text)}${e.lesson ? `<small class="cc-pt-lesson">${esc(e.lesson)}</small>` : ""}</li>`).join("");
      const counts = t.counts.map((c) => `<li class="cc-pt-count ${c.status}"><b>${esc(c.label)}</b> <small>${esc(c.grade)} · severity ${c.severity} · ${esc(c.status)}</small></li>`).join("");
      const opts2 = options(session).map((o, i) => `<button type="button" data-pt-move="${i}" title="${esc(o.help)}">${esc(o.label)}</button>`).join("");
      return `<div class="cc-card cc-town-hall cc-codex cc-practice"><h2>${esc(k.title)} <small>· you ${session.side === "defense" ? "defend" : "prosecute"}</small></h2>
        <p class="cc-muted">${esc(k.blurb)} ${t.magistrate ? "The Magistrate presides: death is on the table." : "A local judge sits: no death power."}</p>
        <p class="cc-pt-coach">“${esc(k.coach)}”</p>
        <ul class="cc-pt-counts">${counts}</ul>${favorBar(t.favor)}
        <ol class="cc-pt-log" aria-live="polite">${lines}</ol>
        ${note ? `<p class="cc-hall-note" role="status">${esc(note)}</p>` : ""}
        ${res ? `<div class="cc-pt-verdict"><h3>${res.guilty ? "Guilty" : "Innocent"}</h3><ul>${res.counts.map((c) => `<li>${esc(c.count)}: ${esc(c.verdict)}</li>`).join("")}</ul>${res.real.map((x) => `<p>${esc(x)}</p>`).join("")}<p class="cc-muted">This was practice. Nothing changed.</p></div>
          <div class="cc-row"><button type="button" class="cc-primary" id="ccPtAgain">Practice again</button><button type="button" id="ccPtCases">Choose another case</button><button type="button" id="ccPtBack">← Back to the Codex</button></div>`
          : `<div class="cc-row cc-pt-moves">${opts2}</div><div class="cc-row"><button type="button" id="ccPtCases">Leave this case</button><button type="button" id="ccPtBack">← Back to the Codex</button></div>`}</div>`;
    };
    const draw = () => {
      ov.innerHTML = session ? trialView() : picker();
      ov.querySelector("#ccPtBack")?.addEventListener("click", () => back());
      ov.querySelectorAll("[data-pt-side]").forEach((b) => b.onclick = () => { side = b.dataset.ptSide; draw(); });
      ov.querySelectorAll("[data-pt-case]").forEach((b) => b.onclick = () => { const r = start(b.dataset.ptCase, { side }); session = r.ok ? r.session : null; note = r.ok ? "" : r.error; draw(); });
      ov.querySelectorAll("[data-pt-move]").forEach((b) => b.onclick = () => { const o = options(session)[+b.dataset.ptMove]; const r = o ? step(session, o.move) : { ok: false, error: "That play is gone." }; note = r.ok ? "" : r.error; draw(); });
      ov.querySelector("#ccPtAgain")?.addEventListener("click", () => { const r = start(session.caseId, { side: session.side }); session = r.session; note = ""; draw(); });
      ov.querySelector("#ccPtCases")?.addEventListener("click", () => { session = null; note = ""; draw(); });
      (ov.querySelector("[data-pt-move]") || ov.querySelector("[data-pt-case]") || ov.querySelector("#ccPtAgain"))?.focus();
    };
    draw();
    return { get session() { return session; } };
  }

  return { CASES, start, options, step, result, mount, policy };
});
