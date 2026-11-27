"use strict";
// The Pond dive's screen, slices R1 + R2 + R3 (claude-sunken-ruins-spec, specs/SUNKEN_RUINS.md 4.1, 4.3, 4.4; R-20261124-02). C10:
// a new screen is its own file; ui.js showDive mounts it. The seabed is walked by town/town.js with the dive's layout and
// its four options (ground, sight, onMove, title). The side panel holds the breath bar, Surface, and the Dive log; E at
// the rope surfaces, E at an air bell refills breath once per dive, and E at a site opens its Read question. R3: a picked-clean
// site shows the spec line; Surface and blackout use the spec banked/forfeit texts.
//
//   mount(host, ctx)  ctx = { account(), setAccount(a), passives(account), Town, back() }
//   current()         the open dive's { town, session }, or null (the page test drives it)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dive-data.js"), require("./dive.js"));
  else root.ConceptCombatDiveUI = factory(root.ConceptCombatDiveData, root.ConceptCombatDive);
})(typeof self !== "undefined" ? self : this, function (DD, Dive) {
  const esc = (s) => String(s ?? "").replace(/[&<>\x22]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\x22": "&quot;" }[c]));
  let open = null;   // one dive at a time: a new mount closes the last one

  // The side panel's lines, from the session (every number is the session's own).
  function hud(session, account, passives) {
    const L = DD.band(session.band), pct = Math.round((100 * session.breath) / session.max);
    const turns = Math.max(0, Math.floor((passives && passives.breathTurnsAdd) || 0));
    const notes = [Dive.swims(account) ? `Swimmer: breath ×${DD.RULES.swimmerMul}` : "", turns ? `Water breathing: +${turns * DD.RULES.perBreathTurn} breath` : ""].filter(Boolean);
    return `<p class="cc-dive-band"><b>Band ${L.id} · ${esc(L.name)}</b><br><span class="cc-muted">${esc(L.depth)}, ${esc(L.age)}</span></p>
      <div class="cc-dive-breath" role="meter" aria-label="Breath" aria-valuemin="0" aria-valuemax="${session.max}" aria-valuenow="${session.breath}" style="height:10px;border-radius:5px;background:#0b2230;overflow:hidden;margin:6px 0">
        <span style="display:block;height:100%;width:${pct}%;background:${pct > 30 ? "#7fc8d8" : "#e07a5f"}"></span></div>
      <p class="cc-dive-breath-text">Breath ${session.breath} of ${session.max} · ${DD.RULES.walkCost[session.band] || 1} a tile walked</p>
      ${notes.length ? `<p class="cc-muted">${notes.map(esc).join(" · ")}</p>` : ""}`;
  }

  function logHtml(account, session) {
    const entries = Dive.diveLog(account, session.seed);
    if (!entries.length) return `<h3 style="margin:10px 0 4px;font-size:13px">Dive log</h3><p class="cc-muted">No sites read yet.</p>`;
    const items = entries.map((e) => `<li data-dive-log="${esc(e.id)}" style="margin:4px 0"><b>Band ${e.band} · ${esc(e.name)}</b><br><span class="cc-muted">${esc(e.explain)}</span></li>`).join("");
    return `<h3 style="margin:10px 0 4px;font-size:13px">Dive log (${entries.length})</h3><ul style="list-style:none;padding:0;margin:0;font-size:12px">${items}</ul>`;
  }

  function mount(host, ctx) {
    if (open) { open.town.destroy(); open = null; }
    const start = Dive.begin(ctx.account(), ctx.passives(ctx.account()));
    ctx.setAccount(start.account);
    const session = start.session, L = DD.band(session.band);
    host.innerHTML = "";
    const inner = document.createElement("div"); inner.className = "cc-dive"; inner.style.cssText = "position:absolute;inset:0"; host.appendChild(inner);
    let hudBox = null, msgBox = null, logBox = null, readModal = null, ended = false;
    const passives = () => ctx.passives(ctx.account());
    const redraw = () => {
      if (hudBox) hudBox.innerHTML = hud(session, ctx.account(), passives());
      if (logBox) logBox.innerHTML = logHtml(ctx.account(), session);
    };
    const say = (text) => { if (msgBox) msgBox.textContent = text; };
    const closeRead = () => { if (readModal) { readModal.remove(); readModal = null; } };

    function end() {
      if (ended) return; ended = true;
      closeRead();
      town.destroy(); open = null;
      const r = Dive.surface(ctx.account(), session);
      ctx.setAccount(r.account);
      const line = r.text || (r.how === "blackout" ? DD.TEXTS.blackout : DD.TEXTS.surfaced);
      host.innerHTML = `<div style="padding:14vh 16px 0"><div class="cc-card cc-town-hall cc-dive-end" style="max-width:560px;margin:0 auto"><h2>${r.how === "blackout" ? "Blacked out" : "Surfaced"}</h2><p>${esc(line)}</p>
        <button type="button" id="ccDiveBack">← Back to town</button></div></div>`;
      host.querySelector("#ccDiveBack").onclick = () => ctx.back();
    }

    function openSite(siteId) {
      if (ended) return;
      const site = DD.siteById(siteId);
      if (!site) return;
      if (Dive.isRead(ctx.account(), siteId)) {
        const st = Dive.findStatus(ctx.account(), session, siteId);
        if (st.pickedClean) { say(DD.TEXTS.pickedClean(st.k)); return; }
        if (st.offered) Dive.collect(ctx.account(), session, siteId);
        const q = Dive.questionFor(site, session.seed);
        say(`${site.name} (already read): ${q ? q.explain : ""}`);
        return;
      }
      const q = Dive.questionFor(site, session.seed);
      if (!q) return;
      closeRead();
      readModal = document.createElement("div");
      readModal.className = "cc-card cc-dive-read";
      readModal.setAttribute("data-site", site.id);
      readModal.style.cssText = "position:absolute;left:50%;top:18%;transform:translateX(-50%);z-index:20;max-width:460px;width:90%;padding:16px";
      const btns = q.choices.map((c, i) => `<button type="button" data-dive-choice="${i}" style="display:block;width:100%;text-align:left;margin:6px 0">${esc(c)}</button>`).join("");
      readModal.innerHTML = `<h3 style="margin:0 0 6px">${esc(site.name)}</h3><p class="cc-dive-q">${esc(q.q)}</p><div>${btns}</div><p class="cc-dive-clue cc-muted" aria-live="polite"></p><button type="button" id="ccDiveReadClose" style="margin-top:6px">Leave</button>`;
      inner.appendChild(readModal);
      readModal.querySelector("#ccDiveReadClose").onclick = () => closeRead();
      for (const btn of readModal.querySelectorAll("[data-dive-choice]")) {
        btn.onclick = () => {
          if (ended) return;
          const idx = Number(btn.getAttribute("data-dive-choice"));
          const r = Dive.answer(ctx.account(), session, site.id, idx);
          if (r.right) {
            ctx.setAccount(r.account);
            say(`${site.name}: ${r.text}${r.discovered ? " (+1 discovery)" : ""}`);
            closeRead();
            redraw();
          } else {
            const clueEl = readModal && readModal.querySelector(".cc-dive-clue");
            if (clueEl) clueEl.textContent = `${r.clue} (-${DD.RULES.wrongPenalty} breath)`;
            say(`${r.clue} (-${DD.RULES.wrongPenalty} breath)`);
            redraw();
            if (session.over === "blackout") end();
          }
        };
      }
    }

    function onOpen(id) {
      if (ended) return;
      if (id === "rope" || id === "surface") return end();
      if (String(id).startsWith("bell:")) { const r = Dive.bell(session, String(id).slice(5)); say(r.text); redraw(); return; }
      if (String(id).startsWith("site:")) { openSite(String(id).slice(5)); }
    }
    function onMove(pos) {
      if (ended) return;
      const before = session.breath; Dive.move(session, pos);
      if (session.breath !== before) redraw();
      if (session.over === "blackout") end();
    }

    const town = ctx.Town.create(inner, {
      town: L, nav: [{ id: "surface", label: "↑ Surface" }], onOpen, onMove, title: "The Pond",
      ground: DD.GROUND, sight: { radius: DD.RULES.lampRadius, seen: ["rope"], dark: DD.DARK },
    });
    const cv = inner.querySelector("canvas"); if (cv) cv.style.filter = "saturate(0.7) hue-rotate(-12deg)";   // the dive tint until a diver sheet arrives (R0)
    const nav = inner.querySelector(".cc-town-nav");
    if (nav) {
      hudBox = document.createElement("div"); hudBox.className = "cc-dive-hud";
      msgBox = document.createElement("p"); msgBox.className = "cc-dive-msg"; msgBox.setAttribute("aria-live", "polite");
      logBox = document.createElement("div"); logBox.className = "cc-dive-log";
      const hint = nav.querySelector("p.cc-muted");
      nav.insertBefore(hudBox, hint); nav.insertBefore(msgBox, hint); nav.insertBefore(logBox, hint);
      if (hint) hint.innerHTML = "<kbd>WASD</kbd> walk · <kbd>E</kbd> rope, bell or site";
    }
    say("The lamp reaches four tiles. Walking spends breath; standing still does not. Press E at a site to read it, or at the rope to surface.");
    redraw();
    open = { town, session, openSite };
    // Left by another screen (the app's back button, a new overlay): the walker stops and the dive is dropped, banking
    // nothing, as a quit mid-dive does (4.1 "State").
    const watch = setInterval(() => { if (ended || !inner.isConnected) { clearInterval(watch); if (!ended) { ended = true; closeRead(); town.destroy(); if (open && open.town === town) open = null; } } }, 1000);
    return open;
  }

  const current = () => open;
  return { mount, current };
});
