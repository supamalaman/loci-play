"use strict";
// Arantxa narrates the gap the fighters will not say.
//
// Fighter bubbles stay short and in character (see speakers.js). This window
// opens when those lines do not already carry the scene, then waits for
// Continue. She may say where you are, what the last room decided, and what a
// loss cost. She does not say Life Force, range, position, lens, or a tile.
//
//   const page = ConceptCombatNarrator.pageFor("open", { scene, state, spoken });
//   ConceptCombatNarrator.open(page, { host, onContinue });
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatNarrator = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // The canvas bubble keeps about three short lines, then cuts the rest.
  const BUBBLE_LINE_CHARS = 32;
  const BUBBLE_LINES = 3;
  const LEAK = /\b(life force|phi-force|phi force|action points|lens(?:es)?|potency|range|position)\b|\b(?:lf|ap)\b|\(\s*\d+\s*,\s*\d+\s*\)/i;

  const BEATS = {
    firstWall: {
      id: "firstWall", title: "First Wall",
      text: "This yard is only a practice wall. The student will send one straight bolt, and will not tell you what a wall across that bolt is for.",
    },
    gapCourt: {
      id: "gapCourt", title: "The Gap Court",
      text: "Two people hold this court. One goes around a stopped line. One takes a line apart. Neither of them will explain the court.",
    },
    rosterScrimmage: {
      id: "rosterScrimmage", title: "Roster Scrimmage",
      text: "You chose who stands in this room. They will speak for themselves. They will not tell you what the room is here to test.",
    },
    warfare: {
      id: "warfare", title: "Warfare",
      text: "Three sides are already on this field. They will keep going until only one side remains. None of them will stop to name the field.",
    },
    randomEncounter: {
      id: "randomEncounter", title: "An unannounced meeting",
      text: "The people in front of you were not announced. They will not tell you who else might have stood here.",
    },
    "quiet-house": {
      id: "quiet-house", title: "The Quiet House",
      text: "The owner of this house is dead in the study. The maid and the household robot each say the other changed the room. A police officer is at the door and wants the place read. They will argue the room. They will not tell you the shape of the choice.",
    },
    courtyard: {
      id: "courtyard", title: "The Courtyard Hearing",
      text: "The office has brought the house's record into a courtyard built for a hearing. A soldier stands in front of the person on the dais. The people here will argue the claim. They will not tell you what the last room already cost.",
    },
    "verdict-dragon": {
      id: "verdict-dragon", title: "The Last Verdict",
      text: "The hearing is over. A dragon has been elected president, and the decree calls every person cattle. Who stands with you follows from that decree. The people in the pen will not explain the word.",
      result: {
        player: "The election fails. The gate opens. They leave as people.",
        enemy: "The decree is posted. The pen holds. You lost the word person.",
      },
    },
    "verdict-oni": {
      id: "verdict-oni", title: "The Last Verdict",
      text: "The President still holds the office, and is trading every citizen's soul to a red oni. The fight is that contract. The people here will not read the clause aloud.",
      result: {
        player: "The contract fails. The office keeps no one it sold.",
        enemy: "The signature holds. The city is the price. You lost their souls.",
      },
    },
    "verdict-kaiju": {
      id: "verdict-kaiju", title: "The Last Verdict",
      text: "The laboratory was opened. The insect made there is loose in the wing and trying to leave. Who stands with you follows from that. They will not stop to say which door was built for the small one.",
      result: {
        player: "The wing holds. The thing they made is stopped. The record of who made it stays.",
        enemy: "The wing is open. The brood is in the street. You lost the laboratory's door.",
      },
    },
  };

  function fitsInBubble(text) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    let lines = 1, col = 0;
    for (const word of words) {
      if (word.length > BUBBLE_LINE_CHARS) return false;
      const gap = col ? 1 : 0;
      if (col && col + gap + word.length > BUBBLE_LINE_CHARS) {
        lines += 1;
        col = word.length;
        if (lines > BUBBLE_LINES) return false;
      } else col += gap + word.length;
    }
    return true;
  }

  function paragraphs(text) {
    return Array.isArray(text) ? text.filter(Boolean) : String(text || "").split(/\n+/).filter(Boolean);
  }
  function fullText(beat) { return paragraphs(beat.text).join(" "); }
  function norm(s) { return String(s || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function spokenCovers(spoken, text) {
    const need = norm(text);
    if (!need) return true;
    return (spoken || []).some((line) => {
      const raw = String(line || "").trim();
      if (!raw || /…|\.\.\.$/.test(raw)) return false;
      return norm(raw).includes(need);
    });
  }
  function sceneId(ctx) {
    const scene = ctx && ctx.scene;
    if (scene === "off" || scene === false) return null;
    if (typeof scene === "string" && scene.length) return BEATS[scene] ? scene : null;
    if (ctx && ctx.theme && ctx.theme.id) return ctx.theme.id;   // a themed battle (modes/themed-battles.js) brings its own beat
    const encounter = ctx && ctx.state && ctx.state.encounter;
    return encounter && BEATS[encounter] ? encounter : null;
  }
  function present(beat) {
    const text = fullText(beat);
    return {
      id: beat.id, name: "Arantxa", role: "Narrator", title: beat.title, text,
      paragraphs: paragraphs(beat.text), fitsInBubble: fitsInBubble(text),
    };
  }
  function page(id) {
    const beat = BEATS[id];
    return beat ? present(beat) : null;
  }
  function pageFor(phase, ctx) {
    ctx = ctx || {};
    const id = sceneId(ctx);
    if (!id) return null;
    const beat = BEATS[id] || (ctx.theme && ctx.theme.id === id ? ctx.theme : null);
    if (!beat) return null;
    if (phase === "mid") {   // a themed battle's one mid-fight beat
      if (!beat.mid || spokenCovers(ctx.spoken, beat.mid)) return null;
      return present({ id: beat.id + "-mid", title: beat.title, text: beat.mid });
    }
    if (phase === "open") {
      if (!beat.text) return null;
      const shown = present(beat);
      if (spokenCovers(ctx.spoken, shown.text)) return null;
      return shown;
    }
    if (phase === "result") {
      const winner = ctx.report && ctx.report.outcome && ctx.report.outcome.winner;
      const line = beat.result && beat.result[winner];
      if (!line) return null;
      if (spokenCovers(ctx.spoken, line)) return null;
      return present({ id: beat.id + "-result", title: beat.title, text: line });
    }
    return null;
  }
  function leaks(text) { return LEAK.test(String(text || "")); }
  function corpus() {
    const bits = [];
    for (const beat of Object.values(BEATS)) {
      if (beat.text) bits.push(fullText(beat));
      if (beat.result) bits.push(...Object.values(beat.result));
    }
    return bits;
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let current = null;
  let onKey = null;

  function close() {
    if (onKey && typeof document !== "undefined") document.removeEventListener("keydown", onKey, true);
    onKey = null;
    if (current) current.remove();
    current = null;
  }
  function open(entry, opts) {
    opts = opts || {};
    close();
    if (!entry || typeof document === "undefined") { opts.onContinue && opts.onContinue(); return; }
    const host = opts.host || document.body;
    const base = opts.base || document.baseURI;
    const src = opts.portrait || new URL("combat/sprites/arantxa/narrator.png", base).href;
    const talk = opts.talk || (opts.portrait ? "" : new URL("combat/sprites/arantxa/narrator-talk.png", base).href);
    const el = document.createElement("div");
    el.className = "cc-narrator";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "ccNarratorTitle");
    el.innerHTML = `<div class="cc-narrator-card">
      <div class="cc-narrator-portrait">
        <img src="${esc(src)}" alt="Arantxa, the narrator">
        ${talk ? `<img class="cc-narrator-talk" src="${esc(talk)}" alt="" aria-hidden="true">` : ""}
      </div>
      <div class="cc-narrator-copy">
        <p class="cc-narrator-kicker">${esc(entry.name)} · ${esc(entry.role)}</p>
        <h2 id="ccNarratorTitle">${esc(entry.title)}</h2>
        ${paragraphs(entry.paragraphs || entry.text).map((p) => `<p>${esc(p)}</p>`).join("")}
        <button type="button" class="cc-primary" id="ccNarratorContinue">Continue <kbd>Enter</kbd></button>
      </div>
    </div>`;
    host.appendChild(el);
    current = el;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      close();
      opts.onContinue && opts.onContinue();
    };
    onKey = (e) => {
      if (e.key !== "Enter" && e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      finish();
    };
    document.addEventListener("keydown", onKey, true);
    const btn = el.querySelector("#ccNarratorContinue");
    btn.addEventListener("click", finish);
    btn.focus();
  }

  return {
    beats: BEATS, page, pageFor, fitsInBubble, spokenCovers, leaks, corpus, open, close,
    bubbleLineChars: BUBBLE_LINE_CHARS, bubbleLines: BUBBLE_LINES,
  };
});
