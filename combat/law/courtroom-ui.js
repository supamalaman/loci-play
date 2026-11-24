"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./trial.js"));
  else root.ConceptCombatCourtroomUI = factory(root.ConceptCombatTrial);
})(typeof self !== "undefined" ? self : this, function (TR) {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const art = (file) => `combat/sprites/${file}`;
  const names = { bench: "Bench", dock: "Accused", prosecutor: "Prosecutor", witness: "Witness stand" };

  function cast(vm) {
    const { t, playerSide, actors = {}, portrait } = vm;
    const testimony = t.log.findLast((entry) => entry.speaker)?.speaker;
    const witness = !t.over && testimony?.witnessId && t.units[testimony.witnessId];
    const identity = (id, fallback, sprite) => {
      const live = actors[id];
      return { name: live?.name || t.units[id]?.name || fallback, src: (live && portrait?.(live)) || (vm.practice ? art(sprite) : null) };
    };
    const seats = [
      { role: "bench", name: t.magistrate ? "The Magistrate" : "Local judge", src: art(t.magistrate ? "magistrate/heads/neutral.png" : "archivist/idle.png") },
      { role: "dock", side: "defense", ...identity(t.accusedId, "The accused", "neo-warden/idle.png") },
      { role: "prosecutor", side: "prosecution", ...identity(t.prosecutorId, "Court prosecutor", "police-officer/idle.png") },
      { role: "witness", ...(witness ? identity(witness.id, witness.name, "student/idle.png") : { name: "Empty" }) },
    ];
    const speaking = t.over ? "bench" : witness ? "witness" :
      { defense: "dock", prosecution: "prosecutor" }[vm.actingSide || testimony?.side];
    return seats.map((seat) => ({ ...seat, player: !!seat.side && seat.side === playerSide, speaking: speaking === seat.role }));
  }

  function courtroom(vm) {
    return `<section class="cc-court-stage" aria-label="Courtroom">
      ${cast(vm).map((seat) => `<figure class="cc-court-seat" data-court-seat="${seat.role}" ${seat.speaking ? 'data-current="true"' : ""}>
        <div class="cc-court-person">${seat.src ? `<img src="${esc(seat.src)}" alt="">` : '<span class="cc-court-empty" aria-hidden="true"></span>'}</div>
        <figcaption><span>${names[seat.role]}${seat.player ? ' <b class="cc-court-you">You</b>' : ""}</span><strong>${esc(seat.name)}</strong></figcaption>
      </figure>`).join("")}
    </section>`;
  }

  function favorBar(f, magistrate) {
    const pct = ((f + 12) / 24) * 100;
    return `<div class="cc-pt-favor" aria-label="Favor ${f >= 0 ? "+" : ""}${f}"><div class="cc-pt-zones"><span class="z-sword">${magistrate ? "Sword" : "Guilty"}</span><span class="z-conf">Confiscate</span><span class="z-acq">Acquit</span></div><div class="cc-pt-track"><i style="left:${pct}%"></i></div><small>Favor ${f >= 0 ? "+" : ""}${f} · −2 or lower: ${magistrate ? "the Sword" : "guilty"} · −1 to +1: confiscate · +2 or higher: acquit</small></div>`;
  }

  function render(vm) {
    const { t, actions, practice, note, queued, verdict } = vm;
    const active = t.counts.find((count) => count.status === "open");
    const counts = t.counts.map((c) => `<li class="cc-pt-count" data-count-status="${esc(c.status)}"${c === active && !t.over ? ' aria-current="true"' : ""}><strong>${esc(c.label)}</strong><small>${esc(c.grade)} · severity ${c.severity} · ${esc(c.status)}</small></li>`).join("");
    const lines = t.log.map((e) => {
      const speaker = e.speaker;
      const label = (speaker?.witnessId && t.units[speaker.witnessId]?.name) ||
        (speaker?.side === "defense" ? "Defense" : speaker?.side === "prosecution" ? "Prosecution" : "Court");
      return `<li><b>${esc(label)}</b> ${esc(e.text)}${practice && e.lesson ? `<small class="cc-pt-lesson">${esc(e.lesson)}</small>` : ""}</li>`;
    }).join("");
    const plays = actions.map((a, i) => `<button type="button" ${practice ? "data-pt-move" : "data-court-move"}="${i}" ${a.off ? "disabled" : ""}>${esc(a.label)}<small>${esc(a.help)}</small></button>`).join("");
    return `<div class="cc-court-layout">${courtroom(vm)}
      <section class="cc-court-docket" aria-label="Docket">
        <h3>Docket</h3><ul class="cc-pt-counts">${counts}</ul>${favorBar(t.favor, t.magistrate)}
        ${note ? `<p role="status">${esc(note)}</p>` : ""}
        ${queued ? `<p class="cc-court-queued" role="status">Queued for this round · ${esc(queued)}</p>` : ""}
        ${verdict ? `<div class="cc-pt-verdict"><h3>Verdict</h3><ul>${verdict.counts.map((v) => `<li>${esc(v.count)} · <b>${esc(v.verdict)}</b></li>`).join("")}</ul>${verdict.sentences.map((line) => `<p>${esc(line)}</p>`).join("")}${practice ? "<p>This was practice. Nothing changed.</p>" : ""}</div>`
          : `<div class="cc-court-actions" aria-label="Legal plays">${plays}</div>`}
      </section>
      ${lines ? `<details class="cc-court-transcript"><summary>Trial transcript</summary><ol class="cc-pt-log">${lines}</ol></details>` : ""}
    </div>`;
  }

  const moves = {
    argue: ["Argue", "Strike a thin count or shift favor on a firm one."],
    press: ["Press the count", "Move favor toward prosecution."],
    evidence: ["Call a witness", "Call the first eligible witness for your side."],
    appeal: ["Appeal for leniency", "Ask the court for favor. Appeals fare worse under the Magistrate."],
    end: ["Rest", "Let the count stand as graded."],
    finalPlea: ["Final plea", "Move favor once per trial. Sworn counts can turn it against you."],
    vouch: ["Vouch", `Your Full Bond speaks for your character: favor +${Math.max(1, Math.round(TR.TRIAL.exhibitBase * 0.5))}, never a count's grade. Once per trial, not on a sworn count; an honest friend may refuse.`],   // Bonds B6 (law/trial.js vouch)
  };

  function liveView(s, actorId, cost, portrait) {
    const tr = s?.trial, t = tr?.t;
    if (!t || t.form !== "courtroom" || (s.phase !== "action" && !(s.phase === "over" && tr.over))) return null;
    const side = tr.accusedId === actorId ? "defense" : tr.invokerId === actorId ? "prosecution" : null;
    if (!side) return null;
    const queued = side === "defense" ? tr.queuedDefense : tr.queued;
    const active = t.counts.find((count) => count.status === "open");
    const actions = tr.over || t.over ? [] : TR.legalPlays(t, side).map((move) => {
      const [label, reason0] = moves[move] || [move, ""];
      const reason = move === "vouch" && t.vouchers?.[0]?.name ? reason0.replace("Your Full Bond", t.vouchers[0].name) : reason0;   // Bonds B6: name who would speak
      const refusal = move === "evidence" && !TR.witnessPool(t, side, active).length ? "No eligible witness for this count." :
        (s.actors[actorId]?.tempo ?? 0) < cost ? `Needs ${cost} AP.` : "";
      return { move, label: `${label} · ${cost} AP`, off: !!refusal, help: refusal || reason };
    });
    const verdict = tr.over && t.verdicts ? {
      counts: t.verdicts.counts.map((v) => ({ count: t.counts.find((c) => c.id === v.count)?.label || v.count, verdict: v.verdict })),
      sentences: (t.verdicts.sentences || []).map((sentence) => sentence.text).filter(Boolean),
    } : null;
    return { t, playerSide: side, actingSide: queued ? side : null, actors: s.actors, portrait, actions, type: side === "defense" ? "trialDefend" : "trialPlay", queued: moves[queued]?.[0], verdict };
  }

  function openLive(host, { view, play, restore }) {
    const dialog = host.ownerDocument.createElement("dialog");
    dialog.className = "cc-court-dialog";
    dialog.setAttribute("aria-label", "Courtroom trial");
    const close = () => {
      dialog.close();
      dialog.remove();
      restore();
    };
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
    const update = () => {
      if (!dialog.open) return;
      const vm = view();
      if (!vm) { close(); return; }
      const focused = dialog.querySelector(":focus");
      const index = focused?.dataset.courtMove;
      const transcript = dialog.querySelector("details")?.open;
      dialog.innerHTML = `<header class="cc-court-header"><h2>${vm.verdict ? "Trial verdict" : "Trial"}</h2><button type="button" data-court-back>${vm.verdict ? "Return" : "Back to the battlefield"}</button></header>${render(vm)}`;
      if (transcript && dialog.querySelector("details")) dialog.querySelector("details").open = true;
      const back = dialog.querySelector("[data-court-back]");
      back.onclick = close;
      const buttons = [...dialog.querySelectorAll("[data-court-move]")];
      buttons.forEach((button, i) => button.onclick = () => play(vm.type, vm.actions[i].move));
      (buttons[index]?.disabled === false ? buttons[index] : dialog.querySelector("[data-court-move]:enabled") || back).focus({ preventScroll: true });
    };
    host.append(dialog);
    dialog.showModal();
    update();
    return { update, close, get open() { return dialog.open; } };
  }

  return { render, liveView, openLive };
});
