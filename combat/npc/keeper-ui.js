"use strict";
// The keeper strip (NPC faces S0; spec section 4): one component every window mounts at the END of its render. The windows rebuild
// themselves on every click, so `mount` is idempotent: the greeting plays once per window entry (module state `S`, cleared by `reset()`
// when the player walks back into town), and a re-render only redraws the line already chosen. The strip sits in the card header,
// outside every <details> fold, so folding a section never hides it.
//
//   mount(ov, windowId, { account, store, dialogueOn, onAccount(a), onDialogue(on), reducedMotion? }) → the strip element, or null
//   say(event)  an event from the window (a failed start, a purchase...) changes the face and the line in place
//   reset()     the player left the keeper's windows: the next entry greets again
// Hooks (HOOKS) are CHIPS: plain text in the window, drawn whether or not Dialogue is on, so no information lives only in speech.
// A keeper with no live face art, or the "text" setting, shows the name plate alone; a missing face file never shows another unit's face.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./keepers.js"), require("../account/keepers.js"), require("./keeper-lines.js"));
  else root.ConceptCombatKeeperUI = factory(root.ConceptCombatKeepers, root.ConceptCombatKeeperMemory, root.ConceptCombatKeeperLines);
})(typeof self !== "undefined" ? self : this, function (K, M, L) {
  const MODE_KEY = "loci:npc:keepers", MODES = { full: "Face and name", text: "Name only", off: "Off" };
  const S = { entered: new Set(), idled: new Set(), last: {}, ring: [], timer: null, cur: null };
  const seen = new Map();   // the preloaded neutral faces (one cache; the other four load on first use)

  const modeOf = (store) => { const m = store && store.get(MODE_KEY, "full"); return MODES[m] ? m : "full"; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const tokensOf = (a) => ({ name: a.name || undefined, level: a.level > 0 ? a.level : undefined, wins: Number.isFinite(a.wins) ? a.wins : undefined, seeds: Number.isFinite(a.seeds) ? a.seeds : undefined });

  // Hook chips: each returns the chip's text, from the same data and the same DOM change it describes, or null (no chip).
  const HOOKS = {
    // H02 Rama: the Town Hall encounter you lost last is marked "Rematch" and listed first in the Encounter list.
    H02({ account, ov }) {
      const enc = M.recordOf(account, "rama").lastLoss, sel = enc && ov.querySelector("#ccEncounter");
      const opt = sel && [...sel.options].find((x) => x.value === enc);
      if (!opt) return null;
      const base = opt.textContent.replace(/^Rematch · /, ""), label = base.split("·")[0].trim();   // idempotent: a remount (a setting changed) finds it already marked
      opt.textContent = `Rematch · ${base}`; sel.insertBefore(opt, sel.firstChild);
      return `Rematch: ${label}. You lost it last time, so it is marked Rematch and listed first under Encounter.`;
    },
  };

  function setFace(strip, keeperId, face) {
    strip.dataset.face = face;
    const box = strip.querySelector(".cc-keeper-portrait"), img = box && box.querySelector("img");
    if (!img) return;
    box.hidden = false;   // a new face gets its own chance after an earlier one failed
    const chain = [K.artPath(keeperId, face) || K.artPath(keeperId, "neutral"), K.idlePath(keeperId)].filter(Boolean);
    const tryNext = () => {
      const next = chain.shift();
      if (!next) { box.hidden = true; strip.dataset.art = "none"; return; }   // no face, no idle crop: the name plate alone
      strip.dataset.art = next.includes("/idle.png") ? "idle" : "face"; box.classList.toggle("is-idle", strip.dataset.art === "idle");
      img.onerror = tryNext; img.src = next;
    };
    tryNext();
  }
  function show(strip, keeperId, line, dialogueOn) {
    const speech = strip.querySelector(".cc-keeper-speech");
    if (line) { speech.textContent = line.text; strip.dataset.lineId = line.id; setFace(strip, keeperId, line.face); }
    speech.hidden = !dialogueOn || !speech.textContent; strip.querySelector(".cc-keeper-talk").hidden = !dialogueOn;
  }
  const choose = (k, event, account, ctx) => {
    const line = M.pick(L.LINES[k.lines] || [], event, { account, keeper: k.id, tokens: tokensOf(account), ring: S.ring, visits: M.recordOf(account, k.id).visits });
    if (line) { S.ring = [...S.ring, line.id].slice(-4); S.last[ctx] = line; }
    return line;
  };
  function scheduleIdle(cur) {
    clearTimeout(S.timer); S.timer = null;
    const reduced = cur.o.reducedMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reduced || cur.mode !== "full" || S.idled.has(cur.windowId)) return;
    S.timer = setTimeout(() => {   // one idle line per entry, only if this strip is still on screen
      if (S.cur !== cur || !cur.strip.isConnected || S.idled.has(cur.windowId)) return;
      S.idled.add(cur.windowId); const line = choose(cur.k, "idle", cur.o.account, cur.windowId); if (line) show(cur.strip, cur.k.id, line, cur.o.dialogueOn);
    }, K.IDLE_MS);
  }

  function mount(ov, windowId, o = {}) {
    const k = K.keeperFor(windowId);
    for (const old of ov.querySelectorAll(".cc-keeper, .cc-keeper-off")) old.remove();
    if (!k || !k.wired || !o.account) return null;
    const mode = modeOf(o.store), anchor = ov.querySelector("h2");
    const place = (node) => { if (anchor) anchor.insertAdjacentElement("afterend", node); else (ov.firstElementChild || ov).prepend(node); };
    if (mode === "off") {   // nothing mounts; one muted button keeps the setting reachable (deviation, see the NOTE)
      const row = el("p", "cc-keeper-off cc-muted"), b = el("button", "", "Show the keeper"); b.type = "button";
      b.onclick = () => { o.store.set(MODE_KEY, "full"); mount(ov, windowId, o); const sel = ov.querySelector(".cc-keeper select"); if (sel) sel.focus(); };   // mount rebuilt the strip: keep the keyboard where it was
      row.append(b); place(row); clearTimeout(S.timer); return null;
    }
    let account = o.account, line = null;
    if (!S.entered.has(windowId)) {   // the greeting: once per entry; the record updates, the context comes from the old one
      S.entered.add(windowId);
      const r = M.enter(account, k.id); account = r.account; if (o.onAccount) o.onAccount(account);
      line = choose(k, r.ctx, account, windowId);
    } else line = S.last[windowId] || null;
    const cur = S.cur = { windowId, k, o: { ...o, account }, mode, strip: null };

    const strip = el("section", "cc-keeper"); strip.dataset.keeper = k.id; strip.dataset.mode = mode; strip.setAttribute("aria-label", `${k.name}, ${k.role}`);
    if (mode === "full") { const box = el("div", "cc-keeper-portrait"), img = el("img"); img.alt = ""; img.decoding = "async"; box.append(img); strip.append(box);
      const neutral = K.artPath(k.id, "neutral"); if (neutral && !seen.has(neutral)) { const pre = new Image(); pre.src = neutral; seen.set(neutral, pre); } }
    const plate = el("div", "cc-keeper-plate"); plate.append(el("b", "", k.name), el("small", "", k.role)); strip.append(plate);
    const speech = el("p", "cc-keeper-speech"); speech.setAttribute("aria-live", "polite"); strip.append(speech);
    const bar = el("div", "cc-keeper-actions");
    const talk = el("button", "cc-keeper-talk", "Talk"); talk.type = "button";
    talk.onclick = () => { const l = choose(k, ["idle", "fold:scenarios"], cur.o.account, windowId); if (l) show(strip, k.id, l, true); };
    const dl = el("label", "cc-keeper-toggle"), dc = el("input"); dc.type = "checkbox"; dc.checked = !!o.dialogueOn; dl.append(dc, " Dialogue");
    dc.onchange = () => { cur.o.dialogueOn = dc.checked; if (o.onDialogue) o.onDialogue(dc.checked); show(strip, k.id, S.last[windowId], dc.checked); };
    const ml = el("label", "cc-keeper-toggle", "Keepers "), ms = el("select");
    for (const [v, text] of Object.entries(MODES)) { const op = el("option", "", text); op.value = v; op.selected = v === mode; ms.append(op); }
    ms.onchange = () => { o.store.set(MODE_KEY, ms.value); mount(ov, windowId, { ...cur.o }); const next = ov.querySelector(".cc-keeper select") || ov.querySelector(".cc-keeper-off button"); if (next) next.focus(); };
    ml.append(ms); bar.append(talk, dl, ml); strip.append(bar);
    const chips = el("div", "cc-keeper-chips");
    const text = HOOKS[k.hook] && HOOKS[k.hook]({ account, ov });
    if (text) { const chip = el("p", "cc-keeper-chip", text); chip.dataset.hook = k.hook; chips.append(chip); }
    strip.append(chips);
    place(strip); cur.strip = strip; show(strip, k.id, line, !!o.dialogueOn); scheduleIdle(cur);
    return strip;
  }
  function say(event) {
    const cur = S.cur; if (!cur || !cur.strip || !cur.strip.isConnected) return null;
    const line = choose(cur.k, event, cur.o.account, cur.windowId); if (line) show(cur.strip, cur.k.id, line, cur.o.dialogueOn);
    return line;
  }
  function reset() { clearTimeout(S.timer); S.timer = null; S.entered.clear(); S.idled.clear(); S.last = {}; S.ring = []; S.cur = null; }

  return { mount, say, reset };
});
