"use strict";
// Practice a trial (slice M0 of claude-magistrate-court-spec, MAGISTRATE-COURT.md 1.4; Mala, 2026-11-07: "the tutorial in
// the magistrates codex, that allows you to go through a hypothetical mock trial for practice"). A real courtroom-form
// trial (law/trial.js) on authored, made-up counts, run in the Magistrate's Codex. Nothing here touches the account:
// no record, Fame, Board, standing or Seeds. It teaches only what the live courtroom does (its legal plays, favor and
// sentences); later slices add their own steps (the record, the plea, accept or fight).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./trial.js"), require("./courtroom-ui.js"));
  else root.ConceptCombatPracticeTrial = factory(root.ConceptCombatTrial, root.ConceptCombatCourtroomUI);
})(typeof self !== "undefined" ? self : this, function (TR, CourtUI) {
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
    { id: "coin", title: "The Ferryman's Coin", teaches: "Alleged charges in a Magistrate’s court",
      blurb: "Someone says you stole the ferryman's coin. Nobody saw it, but the charge is grave.",
      counts: [{ id: "coin-theft", label: "testimony: the ferryman's coin", grade: "unproven", severity: 3, ledgerAct: false }],
      units: [unit("friend", "A friend", "ally"), unit("ferryman", "The ferryman (honest)", "neutral", true)],
      coach: "An unproven count is thin: argue it and it can be struck from the record." },
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
      plead: ["Plead guilty", "End the mock trial at once: every count guilty one tier lower. No Sword on a plea."],   // M2b (1.4)
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
    const t = TR.openTrial({ form: "courtroom", accusedId: YOU, prosecutorId: PROSECUTOR, seed: 7, units: k.units, counts: k.counts, magistrate: k.counts.some((c) => c.severity >= TR.SEV.serious) });
    t.pleaOpen = true;   // M2b (1.4): the mock trial grows the plea, the judgment choice and the death warning
    const session = { caseId: k.id, side, t, turns: 0 };
    if (side === "defense") TR.play(t, "prosecution", policy(t, "prosecution"));   // the prosecution opens each round
    return { ok: true, session };
  }

  // The player's choices: the trial core's legal plays for that bench, with one button per witness for "evidence".
  function options(session) {
    const t = session.t, side = session.side;
    if (t.over) {   // M2b (1.4): a guilty mock verdict offers the same choice a real court would — answered, never applied
      if (side !== "defense" || session.judged || !t.verdicts?.counts.some((v) => v.verdict === "guilty")) return [];
      return [{ move: "accept", label: "Accept judgment", help: "In a real court, the sentences would stand, the entries would be absolved, and your standing would rise." },
        { move: "fight", label: "Fight your way out", help: "In a real court, no sentence now — but the charges would stay open, a resistedJudgment entry would follow you, and your standing would fall." }];
    }
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
    const t = session.t;
    if (t.over) {   // M2b (1.4): the mock judgment is an answer, not an application — nothing here touches the account
      if (move !== "accept" && move !== "fight") return { ok: false, error: "The trial is over." };
      if (session.side !== "defense" || session.judged) return { ok: false, error: "No judgment waits." };
      if (!t.verdicts?.counts.some((v) => v.verdict === "guilty")) return { ok: false, error: "No judgment waits." };
      session.judged = move;
      return { ok: true };
    }
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
    const picker = () => `<div class="cc-card cc-town-hall cc-codex cc-practice"><h2>Practice a trial</h2>
      <p class="cc-muted">A made-up case, tried by the real court rules. Nothing you do here counts: no record, no Fame, no cost.</p>
      <div class="cc-row" role="group" aria-label="Your bench"><button type="button" data-pt-side="defense" aria-pressed="${side === "defense"}">Defend</button><button type="button" data-pt-side="prosecution" aria-pressed="${side === "prosecution"}">Prosecute instead</button></div>
      ${CASES.map((k) => `<div class="cc-hall-offer"><div><b>${esc(k.title)}</b> <small>${esc(k.teaches)}</small><p>${esc(k.blurb)}</p></div><button type="button" class="cc-primary" data-pt-case="${k.id}">Try it</button></div>`).join("")}
      <div class="cc-row"><button type="button" id="ccPtBack">← Back to the Codex</button></div></div>`;
    const trialView = () => {
      const t = session.t, k = byId(session.caseId), res = result(session);
      const judgeNote = !session.judged ? "" : session.judged === "accept"
        ? "Accepted. In a real court, the sentences would stand, the entries would be absolved, and your standing would rise."
        : "Fought free. In a real court, no sentence now — but the charges would stay open, a resistedJudgment entry would follow you, and your standing would fall.";
      const swordPossible = t.magistrate && t.counts.some((c) => c.status !== "struck" && c.status !== "absolved" && c.status !== "restituted" && (c.severity ?? 1) >= (TR.SEV?.serious ?? 2));
      const warnNote = !t.over && swordPossible && t.pleaOpen && session.side === "defense" ? "Death is on the table. A plea takes it off." : "";   // M2b (1.4): the mock trial warns exactly as a live court does
      const judging = !!(res && options(session).length);
      const docket = CourtUI.render({ t, practice: true, playerSide: session.side, actingSide: session.side, actions: options(session), note: judgeNote || warnNote || note, judgment: judging || undefined,
        verdict: res && { counts: res.counts, sentences: session.side === "defense" ? [...res.real, "In a real battle, the record would show the court’s decision on each charge."] : res.real } });
      return `<div class="cc-card cc-town-hall cc-codex cc-practice cc-court-practice"><p class="cc-court-mode">Practice trial</p><h2>${esc(k.title)}</h2>
        <p class="cc-muted">${esc(k.blurb)}</p><p class="cc-pt-coach">“${esc(k.coach)}”</p>${docket}
        <div class="cc-row">${res ? '<button type="button" class="cc-primary" id="ccPtAgain">Practice again</button>' : ""}
          <button type="button" id="ccPtCases">${res ? "Choose another case" : "Leave this case"}</button><button type="button" id="ccPtBack">← Back to the Codex</button></div></div>`;
    };
    const draw = () => {
      ov.innerHTML = session ? trialView() : picker();
      ov.querySelector("#ccPtBack")?.addEventListener("click", () => back());
      ov.querySelectorAll("[data-pt-side]").forEach((b) => b.onclick = () => { side = b.dataset.ptSide; draw(); });
      ov.querySelectorAll("[data-pt-case]").forEach((b) => b.onclick = () => { const r = start(b.dataset.ptCase, { side }); session = r.ok ? r.session : null; note = r.ok ? "" : r.error; draw(); });
      ov.querySelectorAll("[data-pt-move]").forEach((b) => b.onclick = () => { const o = options(session)[+b.dataset.ptMove]; const r = o ? step(session, o.move) : { ok: false, error: "That play is gone." }; note = r.ok ? "" : r.error; draw(); });
      ov.querySelector("#ccPtAgain")?.addEventListener("click", () => { const r = start(session.caseId, { side: session.side }); session = r.session; note = ""; draw(); });
      ov.querySelector("#ccPtCases")?.addEventListener("click", () => { session = null; note = ""; draw(); });
      (ov.querySelector("[data-pt-move]") || ov.querySelector("[data-pt-case]") || ov.querySelector("#ccPtAgain"))?.focus({ preventScroll: true });
    };
    draw();
    return { get session() { return session; } };
  }

  return { CASES, start, options, step, result, mount, policy };
});
