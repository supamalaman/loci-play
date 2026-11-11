"use strict";
// Forum S2: the surface screen (spec cursor-forum-spec, FORUM.md sections 3 to 5). A face-to-face panel over the real
// battle: the two sides' art, plates, one distance line and a short menu read from the S1 kernel (surface.js). It applies
// nothing itself: every pick is an ordinary action handed to the battle screen's act(), so the log, the close-ups, the
// responses and the finish are the map's own. Open the map is one way for the rest of the battle (R-20261110-15).
// The battle screen (ui.js) mounts it with one call and asks it to draw on every render (CONVENTIONS C10).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./surface.js"));
  else root.ConceptCombatSurfaceUI = factory(root.ConceptCombatSurface);
})(typeof self !== "undefined" ? self : this, function (SF) {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ── the Redux test's field (Decision 2, R-20261110-17): open ground, one foe, no weather, wild creatures or objects ──
  // All turf: no water (ducks, porgy, kraken), no objects (termites, caterpillars, plants), no rubble (creeper) and no
  // archetype (every biome rule: pig, dog, moa, sasquatch, chicken). No event schedule, so no weather roll (engine create).
  const FIELD_ROWS = 5, FIELD_COLS = 9;
  function openGround() {
    return { name: "Open ground", map: Array.from({ length: FIELD_ROWS }, () => ",".repeat(FIELD_COLS)), objects: [], note: "Forum: open ground, nothing else on the field" };
  }
  // Forum S3, "Open the Plane" (R-20261111-03): a save's first Forum fight. The same turf with a wall line across the middle
  // and a gap on the bottom row, so the fight can always be finished. From the far sides every unit ability reads Out of range or
  // Needs the map, and Advance stops at the wall: the surface cannot show the way round; the map can.
  const PLANE_WALL_X = 5;
  function planeField() {
    return { name: "Open the Plane", objects: [], note: "Forum S3: a wall line with a gap on the bottom row",
      map: Array.from({ length: FIELD_ROWS }, (_, y) => (y === FIELD_ROWS - 1 ? ",".repeat(FIELD_COLS) : ",".repeat(PLANE_WALL_X) + "#" + ",".repeat(FIELD_COLS - PLANE_WALL_X - 1))) };
  }
  const TEACH_HINT = "The surface hides the ground. When nothing reads In range, open the map to see the wall and the way round.";
  // The foes a random encounter draws from (engine.js randomEncounterOptions' roster, same filter), minus the player's class.
  function foeRoster(C, mainCharacter) {
    return Object.entries(C.characters).filter(([id, ch]) => id !== "warden" && id !== "police_officer" && id !== mainCharacter
      && !ch.permanentAlly && !ch.randomEventOnly && Array.isArray(ch.configs)).map(([id]) => id).sort();
  }
  // The battle options a Forum start lays over the screen's own (ui.js start merges them last).
  function forumSetup(C, seed, mainCharacter, { teach = false } = {}) {
    const roster = foeRoster(C, mainCharacter), foe = roster[(seed >>> 0) % roster.length];
    const at = teach ? [[1, 1], [FIELD_COLS - 1, 1]] : [[1, 2], [7, 2]];
    return {
      title: teach ? "Forum · Open the Plane" : "Forum", seed: seed >>> 0, startingActor: "player", randomizeNPCs: true, mode: "classic",
      participants: [{ id: "player", character: "warden", side: "player", at: at[0] }, { id: "forum-foe", character: foe, side: "enemy", at: at[1] }],
      arenaData: teach ? planeField() : openGround(), initialWild: [], randomEventSchedule: [],
      tourist: false, kaiba: false,   // randomizeNPCs would let a Tourist (one seed in five) or Kaiba (15%) walk on (engine create)
      pickups: false,   // no field pickups: the surface never shows them (R-20261111-04)
    };
  }

  const distanceLine = (d) => (d <= 1 ? "side by side" : `${d} tiles apart`);
  const OPEN_ASK = "Open the map? You can't come back to this view in this battle.";
  // While a scene, a narration or the foe holds the fight: the foe's name when it is the foe deciding, else a plain wait.
  const busyLine = (s, d, id) => (s.outcome ? "" : d && d.actor !== id && s.actors[d.actor] ? `${s.actors[d.actor].name} is acting…` : "…");

  // What the screen shows, as data (the DOM is drawn from this alone, so Node tests read the same words the player does).
  function viewFor(E, s, id, { busy = false } = {}) {
    const me = s.actors[id], d = E.decider(s);
    const foes = Object.values(s.actors).filter((u) => u.side !== me.side && u.side !== "bystander" && !u.defeated && !u.notArrived);
    const allies = Object.values(s.actors).filter((u) => u.id !== id && u.side === me.side && !u.defeated && !u.notArrived);   // a summon or ally on the player's side gets its plate too (FORUM.md section 3)
    const plate = (u) => ({ id: u.id, name: u.name, side: u.side, lf: u.lf, maxLF: u.maxLF, pf: u.pf, maxPF: u.maxPF, ap: d && d.kind === "turn" && d.actor === u.id ? u.tempo : null, apMax: d && d.kind === "turn" && d.actor === u.id ? u.tempoCapacity : null,   // AP shows on the plate of the unit whose turn it is (off its turn it read "AP 0/100": tempoCapacity is not reset; Ratline AD note on S2)
     
      statuses: Object.keys(u.status || {}).filter((k) => u.status[k]), defeated: !!u.defeated });
    const surface = !s.outcome && !busy && d && d.actor === id ? (d.kind === "mind" ? { kind: "mind" } : SF.surfaceFor(E, s, id)) : null;
    const near = surface?.kind === "turn" && surface.foe ? surface.distance : foes.length ? Math.min(...foes.map((f) => E.geometry.dist(s, me.x, me.y, f.x, f.y))) : 0;
    const distance = foes.length ? distanceLine(near) : "";
    return {
      mine: plate(me), allies: allies.map(plate), foes: foes.map(plate), distance,
      whose: s.outcome ? "" : surface ? (surface.kind === "response" ? "Respond" : surface.kind === "mind" ? "An argument" : "Your turn") : busyLine(s, d, id),
      surface, ask: OPEN_ASK,
    };
  }

  // ── the panel ──
  // deps: { E, state(), controlledId(s), act(action), openMap(), busy(), sprite(unit) -> html, flip(key, facingRight) -> bool, teach }
  function mount(main, deps) {
    const cc = main.closest(".cc") || main;
    const el = document.createElement("section");
    el.className = "cc-surface"; el.id = "ccSurface"; el.setAttribute("aria-label", "Forum: face to face");
    main.insertBefore(el, main.querySelector(".cc-arena"));
    cc.classList.add("cc-surface-on");
    let picking = null, asking = false, shown = true;

    const apText = (n) => (n == null ? "" : `<small>${n} AP</small>`);
    const plateHtml = (p) => `<div class="cc-surface-plate${p.defeated ? " is-down" : ""}" data-plate="${esc(p.id)}"><b>${esc(p.name)}</b>
      <span class="cc-surface-bar"><i style="width:${Math.max(0, Math.min(100, Math.round(100 * p.lf / (p.maxLF || 1))))}%"></i></span>
      <span class="cc-surface-stats"><span>LF <b data-lf>${p.lf}</b>/${p.maxLF}</span><span>ΦF ${p.pf}/${p.maxPF}</span>${p.ap != null ? `<span>AP ${p.ap}/${p.apMax}</span>` : ""}</span>
      ${p.statuses.length ? `<span class="cc-surface-status">${p.statuses.map(esc).join(" · ")}</span>` : ""}</div>`;
    const figure = (u, right) => `<div class="cc-surface-figure ${right ? "is-mine" : "is-foe"}">${deps.sprite(u)}<i class="cc-surface-shadow"></i></div>`;
    const btn = (attrs, label, extra = "", disabled = false) => `<button type="button" ${attrs}${disabled ? " disabled" : ""}>${label}${extra}</button>`;

    function menuHtml(v) {
      const m = v.surface;
      if (asking) return `<div class="cc-surface-ask" role="alertdialog" aria-label="Open the map"><p>${esc(v.ask)}</p>
        ${btn('data-surface="open-yes" class="is-go"', "Open the map")}${btn('data-surface="open-no"', "Stay here")}</div>`;
      if (!m) return `<p class="cc-surface-wait">${esc(v.whose)}</p>`;
      const open = btn('data-surface="open" class="cc-surface-open"', "Open the map", "<small>full control, one way</small>");
      if (m.kind === "mind") return `<p class="cc-surface-wait">An argument: answer it in its own window.</p>${open}`;
      if (m.kind === "response") return `<div class="cc-surface-list">
        ${m.guard ? btn('data-surface="r-guard"', "Guard") : ""}${m.dodge ? btn('data-surface="r-dodge"', "Dodge", apText(m.dodge.apCost)) : ""}
        ${btn('data-surface="r-take"', "Take it")}</div>${open}`;
      if (picking) {
        const a = m.abilities.find((x) => x.id === picking);
        if (a) return `<div class="cc-surface-list"><p class="cc-surface-wait">${esc(a.name)}: on whom?</p>
          ${a.targets.map((t, i) => btn(`data-surface="target" data-i="${i}"`, esc(t.name))).join("")}${btn('data-surface="back"', "Back")}</div>`;
        picking = null;
      }
      const ability = (a) => {
        const usable = a.targets.length > 0, map = a.signifier === "Needs the map";
        return btn(`data-surface="ability" data-ability="${esc(a.id)}" data-signifier="${esc(a.signifier)}"`, esc(a.name),
          `<small class="cc-surface-sig is-${esc(a.signifier.toLowerCase().replace(/[^a-z]+/g, "-"))}">${esc(a.signifier)}</small>${apText(a.apCost)}`, !usable && !map);
      };
      return `<div class="cc-surface-list">${m.abilities.map(ability).join("")}</div>
        <div class="cc-surface-list cc-surface-moves">
        ${m.advance ? btn('data-surface="advance"', "Advance", apText(m.advance.apCost)) : ""}${m.withdraw ? btn('data-surface="withdraw"', "Withdraw", apText(m.withdraw.apCost)) : ""}
        ${m.guard ? btn('data-surface="guard"', "Guard", apText(m.guard.apCost)) : ""}${btn('data-surface="end"', "End turn")}</div>${open}`;
    }

    function render() {
      if (!shown) return;
      const s = deps.state(); if (!s) return;
      const id = deps.controlledId(s), me = s.actors[id];
      if (!me) return;
      const v = viewFor(deps.E, s, id, { busy: deps.busy() });
      if (!v.surface) { picking = null; asking = false; }
      const foe = v.foes[0] ? s.actors[v.foes[0].id] : null;
      el.innerHTML = `<div class="cc-surface-stage">
          <div class="cc-surface-side">${plateHtml(v.mine)}${v.allies.map(plateHtml).join("")}${figure(me, true)}</div>
          <div class="cc-surface-gap"><span class="cc-surface-kicker">Forum</span><b data-distance>${esc(v.distance)}</b></div>
          <div class="cc-surface-side is-foe">${v.foes.map(plateHtml).join("")}${foe ? figure(foe, false) : ""}</div>
        </div>
        <div class="cc-surface-menu">${deps.teach ? `<p class="cc-surface-hint" data-hint>${esc(TEACH_HINT)}</p>` : ""}<div class="cc-surface-whose" data-whose>${esc(v.whose)}</div>${menuHtml(v)}</div>`;
      el.querySelectorAll(".cc-surface-figure img[data-key]").forEach((img) => {
        const right = !!img.closest(".is-mine"); img.style.transform = `scaleX(${deps.flip(img.dataset.key, right) ? -1 : 1})`;
      });
      el.querySelectorAll("[data-surface]").forEach((b) => { b.onclick = () => pick(b, v); });
    }

    function pick(b, v) {
      if (deps.busy()) return render();   // the fight is held (a scene, or the opening narration drawn over a surface painted just before it): nothing acts, the menu redraws as a wait
      const m = v.surface, what = b.dataset.surface;
      if (what === "open" || (what === "ability" && b.dataset.signifier === "Needs the map")) { asking = true; return render(); }
      if (what === "open-no") { asking = false; return render(); }
      if (what === "open-yes") { asking = false; close(); return deps.openMap(); }
      if (what === "back") { picking = null; return render(); }
      if (!m) return;
      let action = null;
      if (what === "ability") {
        const a = m.abilities.find((x) => x.id === b.dataset.ability);
        if (!a || !a.targets.length) return;
        if (a.targets.length > 1) { picking = a.id; return render(); }
        action = a.targets[0].action;
      } else if (what === "target") action = m.abilities.find((x) => x.id === picking)?.targets[+b.dataset.i]?.action;
      else if (what === "advance") action = m.advance?.action;
      else if (what === "withdraw") action = m.withdraw?.action;
      else if (what === "guard") action = m.guard?.action;
      else if (what === "end") action = m.end?.action;
      else if (what === "r-guard") action = m.guard?.action;
      else if (what === "r-dodge") action = m.dodge?.action;
      else if (what === "r-take") action = m.takeIt?.action;
      picking = null;
      if (action) deps.act(action);
    }

    function close() {
      if (!shown) return;
      shown = false; cc.classList.remove("cc-surface-on"); el.remove();
    }
    return { render, close, get shown() { return shown; } };
  }

  return { mount, viewFor, forumSetup, foeRoster, distanceLine, TEACH_HINT };
});
