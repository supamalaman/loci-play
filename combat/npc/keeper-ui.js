"use strict";
// The keeper strip (NPC faces S0; spec section 4): one component every window mounts at the END of its render. The windows rebuild
// themselves on every click, so `mount` is idempotent: the greeting plays once per window entry (module state `S`, cleared by `reset()`
// when the player walks back into town), and a re-render only redraws the line already chosen. The strip sits in the card header,
// outside every <details> fold, so folding a section never hides it.
//
//   mount(ov, windowId, { account, store, dialogueOn, facts?, onAccount(a), onDialogue(on), reducedMotion?, counter?, event? }) → the strip element, or null
//   `counter` (S3) swaps the strip to a wired counter keeper of that window (the Field Kit's shop, kiln, stall); an unwired
//   counter falls back to the frame keeper. `event` plays one line on a re-mount that is not a first greeting (a counter visit
//   plays its `fold:` line); without it a re-mount redraws the last line.
//   say(event, extra?)  an event from the window (a failed start, a purchase...) changes the face and the line in place; extra tokens fill the line
//   reset()     the player left the keeper's windows: the next entry greets again
// Hooks (HOOKS) are CHIPS: plain text in the window, drawn whether or not Dialogue is on, so no information lives only in speech.
// A keeper with no live face art, or the "text" setting, shows the name plate alone; a missing face file never shows another unit's face.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./keepers.js"), require("../account/keepers.js"), require("./keeper-lines.js"), require("../dialogue/speakers.js"), require("../dialogue/summon-voices.js"));
  else root.ConceptCombatKeeperUI = factory(root.ConceptCombatKeepers, root.ConceptCombatKeeperMemory, root.ConceptCombatKeeperLines, root.ConceptCombatSpeakers, root.ConceptCombatSummonVoices);
})(typeof self !== "undefined" ? self : this, function (K, M, L, SP, SV) {
  const MODE_KEY = "loci:npc:keepers", MODES = { full: "Face and name", text: "Name only", off: "Off" };
  const S = { entered: new Set(), idled: new Set(), last: {}, ring: [], timer: null, cur: null };
  const seen = new Map();   // the preloaded neutral faces (one cache; the other four load on first use)

  const modeOf = (store) => { const m = store && store.get(MODE_KEY, "full"); return MODES[m] ? m : "full"; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const tokensOf = (a) => ({ name: a.name || undefined, level: a.level > 0 ? a.level : undefined, wins: Number.isFinite(a.wins) ? a.wins : undefined, seeds: Number.isFinite(a.seeds) ? a.seeds : undefined, fame: a.fame > 0 ? a.fame : undefined,
    owed: a.debt > 0 ? `${a.debt} Seeds` : undefined });   // {owed}: the account's Seeds debt (S1); {fame} reads the account (fame mile) and {price} comes from a window's say() or is skipped

  // A line that names an effect shows only while the effect is on (spec section 12): the gate "perk" follows the Seeds-perk flag in keepers.js.
  const openLines = (rows) => rows.filter((r) => !r.gate || (r.gate === "perk" && K.KEEPER_PERKS === true));
  // The Fame mile event (npc-faces hooks): "mile:fame" when this bank has a fame-milestone row and fame rose past
  // the last greeted mark, else null. Only mile:fame banks qualify, so level/discovery miles never misfire.
  const fameMileEvent = (account, rows) => (rows || []).some((l) => l.when === "mile:fame") && ((account || {}).fame || 0) > Math.max(0, (account || {}).fameMileSeen ?? 0) ? "mile:fame" : null;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
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
    // H03 Sita (S1): what is waiting at home, from the same account and pack state the window shows: unspent perk points, empty pack slots, worn-out gear.
    H03({ facts }) {
      if (!facts) return null;
      const bits = [];
      if (facts.perkPoints > 0) bits.push(`${plural(facts.perkPoints, "perk point", "perk points")} unspent`);
      if (facts.packFree > 0) bits.push(`${plural(facts.packFree, "pack slot", "pack slots")} empty of ${facts.packSlots}`);
      if (facts.worn && facts.worn.length) bits.push(`worn out: ${facts.worn.join(", ")}`);
      return bits.length ? `Before you go: ${bits.join("; ")}.` : null;
    },
    // H05 Tallyman (S1, the frame): the Seeds you owe. Marks and tolls have no account field, so the chip names the debt only; the counters speak through their own keepers (S3).
    H05({ facts }) { return facts && facts.owed > 0 ? `You owe ${facts.owed} Seeds. Seeds you earn in battle pay it down first.` : null; },
    // H10 Hermes (S2): the accepted contract and the battles it has left before it rots, from the same posting the board shows. No accepted job: no chip.
    H10({ facts }) { const j = facts && facts.accepted; return j ? `Accepted: ${j.text}. It rots off the board in ${plural(j.left, "battle", "battles")} if you do not finish it.` : null; },
    // H11 Ravana (S2): where your own main stands on the board, from the same row the board lists as "You". Not among the shown rows: no chip. The spec's "scroll to the row" is not built: the scroll pushed the keeper's strip out of view (NOTE, Decisions).
    H11({ facts }) { const rank = facts && facts.threatRank; return rank > 0 ? `You stand at rank ${rank} on the board.` : null; },
    // H17 Lakshmana (S2): the drills left this cycle, from the cycle the School itself counts. The spec's "replay your last missed lesson" has no field to read (tutor.js keeps none), so it is not built.
    H17({ facts }) { return facts && Number.isFinite(facts.drillsLeft) ? `${plural(facts.drillsLeft, "drill", "drills")} left this cycle.` : null; },
    // H18 Gambler (S2): says plainly whether glamour plus fame holds the room, the same comparison busking.js uses (below the room is a tomatoed busk); the ui asks one confirm step before a losing busk.
    H18({ facts }) {
      const e = facts && facts.busk; if (!e) return null;
      return `Your glamour and fame make ${e.power}; the room is ${e.diff}. ${e.power >= e.diff ? "You hold the room." : "The room beats you: tomatoes, and the ledger remembers."}`;
    },
    // H12 Jambavan (S1): the hire rule from the item text (one per side each battle) and the free pack slots, which a hire takes like any item.
    H12({ facts }) { return facts ? `A hire is one merc and one mediator per side each battle. ${plural(facts.packFree, "pack slot is", "pack slots are")} free of ${facts.packSlots}.` : null; },
    // H06 Pioneer (S3): the offers on the shelf today, counted from the same stock the window shows; the stock turns over after each battle.
    H06({ facts }) { const n = facts && facts.shopOffers; return Number.isFinite(n) ? `${plural(n, "offer", "offers")} on the shelf today. Stock turns over after each battle.` : null; },
    // H08 Talisman (S3): the first vessel the kiln can fire now, from the same KR.craftable calls the kiln board makes (same flux input); else the shortfall.
    H08({ facts }) { const r = facts && facts.kilnReady; if (r) return `Ready to fire: ${r}.`; const s = facts && facts.kilnShort; return s ? `Nothing fires yet: short on ${s}.` : null; },
    // H09 Kaikeyi (S3): the three vendors' standing in one row, from the same market the stall board reads. Quirks stay on the sell buttons' titles.
    H09({ facts }) { const rows = facts && facts.stall; return rows && rows.length ? `Standing: ${rows.map((v) => `${v.name} ${v.standing}`).join(" · ")}.` : null; },
    // H16 Starfarer (S4a): the nearest free concept beside the owned path, priced by the same claim rule the tree shows. No free neighbor: no chip.
    // H13 Magistrate has no chip: founding offers exist only on the battle report, nothing persists them for the Codex to read (a loop is open).
    H16({ facts }) { const f = facts && facts.free; if (!f) return null;
      return `${f.name} lies free beside your path. ${f.cost === 1 ? "1 discovery claims it" : `${f.cost} discoveries claim it`}.`; },
    // H14 Freemason (S4c): the recovered part group with the fewest pieces, from the same grouped inventory the desk
    // shows. The caller groups real parts only, so training examples are never counted. No parts: no chip (the desk
    // already says how to get some).
    H14({ facts }) {
      const parts = facts && facts.parts;
      if (!Array.isArray(parts) || !parts.length) return null;
      let low = null;
      for (const p of parts) { if (!p || !(p.quantity > 0)) continue; if (!low || p.quantity < low.quantity) low = p; }
      if (!low) return null;
      return `Shortest part: ${low.sourceName || low.source || "parts"} ×${low.quantity}. Inscription consumes the parts it uses.`;
    },
    // H01 Arantxa (S4b): the one most urgent thing: a Seeds debt, then the accepted contract's battles left,
    // then unspent perk points, then empty pack slots. Each names the door that handles it.
    H01({ facts }) {
      if (!facts) return null;
      if (facts.owed > 0) return `You owe ${facts.owed} Seeds. Seeds you earn in battle pay it down first.`;
      const j = facts.accepted;
      if (j) return `Accepted: ${j.text}. It rots off the board in ${plural(j.left, "battle", "battles")} if you do not finish it. The Contract Board holds it.`;
      if (facts.perkPoints > 0) return `${plural(facts.perkPoints, "perk point", "perk points")} unspent. The Ledger House account spends them.`;
      if (facts.packFree > 0) return `${plural(facts.packFree, "pack slot", "pack slots")} empty. The Field Kit fills them.`;
      return null;
    },
  };

  // A counter keeper for a window's named counter (S3: the Field Kit's shop, gear, kiln, stall sections), or null: an unknown
  // counter, or a counter whose keeper is not wired yet (the Smith, S5), falls back to the frame keeper at the call site.
  function counterKeeper(windowId, counter) {
    const frame = K.keeperFor(windowId), id = frame && frame.counters && frame.counters[counter];
    const k = id && K.KEEPERS[id];
    return k && k.wired ? { id, ...k } : null;
  }

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
  const choose = (k, event, account, ctx, extra) => {
    const line = M.pick(openLines(L.LINES[k.lines] || []), event, { account, keeper: k.id, tokens: { ...tokensOf(account), ...extra }, ring: S.ring, visits: M.recordOf(account, k.id).visits });
    if (line) { S.ring = [...S.ring, line.id].slice(-4); S.last[ctx] = line; }
    return line;
  };
  const reducedMotion = (o) => o.reducedMotion ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  function scheduleIdle(cur) {
    clearTimeout(S.timer); S.timer = null;
    if (reducedMotion(cur.o) || cur.mode !== "full" || S.idled.has(cur.ctx)) return;
    S.timer = setTimeout(() => {   // one idle line per entry, only if this strip is still on screen
      if (S.cur !== cur || !cur.strip.isConnected || S.idled.has(cur.ctx)) return;
      S.idled.add(cur.ctx); const line = choose(cur.k, "idle", cur.o.account, cur.ctx); if (line) show(cur.strip, cur.k.id, line, cur.o.dialogueOn);
    }, K.IDLE_MS);
  }

  function mount(ov, windowId, o = {}) {
    const swap = o.counter ? counterKeeper(windowId, o.counter) : null;
    const k = swap || K.keeperFor(windowId), ctx = (swap ? `${windowId}:${o.counter}` : windowId) + (o.entryKey ? `#${o.entryKey}` : "");   // entryKey: a window that is entered again within one town visit (the battle report) greets again, once per key   // a counter keeps its own greeting, idle and last line
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
    if (!S.entered.has(ctx)) {   // the greeting: once per entry; the record updates, the context comes from the old one
      S.entered.add(ctx);
      const r = M.enter(account, k.id, k.owes ? { owed: account.debt } : {}); account = r.account;
      // A fame rise since the last greeting speaks this keeper's fame milestone instead (the Fame mile event). The mark is kept
      // on the account root, not the keeper record, and persists with the save below.
      let ev = r.ctx;
      if (fameMileEvent(account, openLines(L.LINES[k.lines] || []))) ev = "mile:fame";
      line = choose(k, ev, account, ctx);
      if (ev === "mile:fame" && line) account = { ...account, fameMileSeen: account.fame || 0 };
      if (o.onAccount) o.onAccount(account);
    } else if (o.event && (swap || !o.counter)) line = choose(k, o.event, account, ctx);   // an unwired counter (Gear, until the Smith lands) has no fold line on the frame: it redraws the frame's last line instead of going silent; a plain re-mount redraws
    else line = S.last[ctx] || null;
    const prevKeeper = S.cur && S.cur.k.id, fade = prevKeeper && prevKeeper !== k.id && !reducedMotion(o);
    const cur = S.cur = { windowId, ctx, k, o: { ...o, account }, mode, strip: null, foldEv: swap ? `fold:${o.counter}` : "fold:scenarios" };

    const strip = el("section", "cc-keeper"); strip.dataset.keeper = k.id; strip.dataset.mode = mode; strip.setAttribute("aria-label", `${k.name}, ${k.role}`);
    if (fade) strip.classList.add("is-swap");   // the 120 ms crossfade (spec section 4); still images only, never under reduced motion
    if (mode === "full") { const box = el("div", "cc-keeper-portrait"), img = el("img"); img.alt = ""; img.decoding = "async"; box.append(img); strip.append(box);
      const neutral = K.artPath(k.id, "neutral"); if (neutral && !seen.has(neutral)) { const pre = new Image(); pre.src = neutral; seen.set(neutral, pre); } }
    const plate = el("div", "cc-keeper-plate"); plate.append(el("b", "", k.name), el("small", "", k.role)); strip.append(plate);
    const speech = el("p", "cc-keeper-speech"); speech.setAttribute("aria-live", "polite"); strip.append(speech);
    const bar = el("div", "cc-keeper-actions");
    const talk = el("button", "cc-keeper-talk", "Talk"); talk.type = "button";
    talk.onclick = () => { const l = choose(k, ["idle", cur.foldEv], cur.o.account, ctx); if (l) show(strip, k.id, l, true); };
    const dl = el("label", "cc-keeper-toggle"), dc = el("input"); dc.type = "checkbox"; dc.checked = !!o.dialogueOn; dl.append(dc, " Dialogue");
    dc.onchange = () => { cur.o.dialogueOn = dc.checked; if (o.onDialogue) o.onDialogue(dc.checked); show(strip, k.id, S.last[ctx], dc.checked); };
    const ml = el("label", "cc-keeper-toggle", "Keepers "), ms = el("select");
    for (const [v, text] of Object.entries(MODES)) { const op = el("option", "", text); op.value = v; op.selected = v === mode; ms.append(op); }
    ms.onchange = () => { o.store.set(MODE_KEY, ms.value); mount(ov, windowId, { ...cur.o, event: null }); const next = ov.querySelector(".cc-keeper select") || ov.querySelector(".cc-keeper-off button"); if (next) next.focus(); };
    ml.append(ms); bar.append(talk, dl, ml); strip.append(bar);
    const chips = el("div", "cc-keeper-chips");
    const text = HOOKS[k.hook] && HOOKS[k.hook]({ account, ov, facts: o.facts });
    if (text) { const chip = el("p", "cc-keeper-chip", text); chip.dataset.hook = k.hook; chips.append(chip); }
    strip.append(chips);
    place(strip); cur.strip = strip; show(strip, k.id, line, !!o.dialogueOn); scheduleIdle(cur);
    return strip;
  }
  // The contextual speaker strip (NPC faces S6): one portrait + one line for a battle overlay. Unlike mount it keeps
  // no memory, no greeting-once state (overlays render once per open), no chips, no idle timer and no Talk button;
  // it honors the Dialogue toggle and the Keepers mode like the keeper strip, and reuses its classes and CSS.
  //   speaker: { name, role, faces[], text } from speakerFor() in this file (the voice table lives in dialogue/speakers.js).
  function mountSpeaker(ov, windowId, o = {}) {
    const speaker = o.speaker;
    for (const old of ov.querySelectorAll(".cc-keeper, .cc-keeper-off")) old.remove();
    if (!speaker || speaker.keeper || speaker.served || !speaker.text) return null;
    const mode = modeOf(o.store), anchor = ov.querySelector("h2");
    const place = (node) => { if (anchor) anchor.insertAdjacentElement("afterend", node); else (ov.firstElementChild || ov).prepend(node); };
    if (mode === "off") {
      const row = el("p", "cc-keeper-off cc-muted"), b = el("button", "", "Show the speaker"); b.type = "button";
      b.onclick = () => { o.store.set(MODE_KEY, "full"); mountSpeaker(ov, windowId, o); };
      row.append(b); place(row); return null;
    }
    const strip = el("section", "cc-keeper"); strip.dataset.speaker = speaker.name; strip.dataset.mode = mode; strip.setAttribute("aria-label", `${speaker.name}, ${speaker.role}`);
    if (mode === "full") {
      const box = el("div", "cc-keeper-portrait"), img = el("img"); img.alt = ""; img.decoding = "async"; box.append(img); strip.append(box);
      const chain = (speaker.faces || []).slice();
      const tryNext = () => {
        const next = chain.shift();
        if (!next) { box.hidden = true; strip.dataset.art = "none"; return; }   // no face anywhere: the plate and the line alone
        strip.dataset.art = "face"; img.onerror = tryNext; img.src = next;
      };
      tryNext();
    }
    const plate = el("div", "cc-keeper-plate"); plate.append(el("b", "", speaker.name), el("small", "", speaker.role)); strip.append(plate);
    const speech = el("p", "cc-keeper-speech"); speech.setAttribute("aria-live", "polite"); speech.textContent = speaker.text;
    speech.hidden = !o.dialogueOn; strip.append(speech);
    const bar = el("div", "cc-keeper-actions");
    const dl = el("label", "cc-keeper-toggle"), dc = el("input"); dc.type = "checkbox"; dc.checked = !!o.dialogueOn; dl.append(dc, " Dialogue");
    dc.onchange = () => { const on = dc.checked; if (o.onDialogue) o.onDialogue(on); speech.hidden = !on; };
    const ml = el("label", "cc-keeper-toggle", "Keepers "), ms = el("select");
    for (const [v, text] of Object.entries(MODES)) { const op = el("option", "", text); op.value = v; op.selected = v === mode; ms.append(op); }
    ms.onchange = () => { o.store.set(MODE_KEY, ms.value); mountSpeaker(ov, windowId, o); };
    ml.append(ms); bar.append(dl, ml); strip.append(bar);
    place(strip);
    return strip;
  }
  function say(event, extra) {   // extra tokens (S3: { price } for a refused buy) fill the line's {tokens}; without them the line is skipped, never holed
    const cur = S.cur; if (!cur || !cur.strip || !cur.strip.isConnected) return null;
    if (K.BIG_BY_COUNT.has(cur.k.id) && cur.o.onSpend && !/^(err|refuse|idle|leave)$/.test(event)) cur.o.onSpend(cur.k.id, 1);   // a per-window keeper's `big` counts things done in its window (R-20261103-04)
    const line = choose(cur.k, event, cur.o.account, cur.ctx, extra); if (line) show(cur.strip, cur.k.id, line, cur.o.dialogueOn);
    return line;
  }
  function reset() { clearTimeout(S.timer); S.timer = null; S.entered.clear(); S.idled.clear(); S.last = {}; S.ring = []; S.cur = null; }

  // Contextual speakers for battle overlays (NPC faces S6; spec section 10): the overlay's speaker is the thing it is
  // about. speakerFor() resolves a window to a face chain plus one line, reading the speaker's existing speakers.js /
  // summon-voices.js event tables and never rewriting them. Only plain lines are read; #grammar# origins need the
  // Tracery pipeline the battle bubbles use, so a bank of grammar alone falls back.
  //   speakerFor(windowId, ctx) → { name, role, faces[], text } | { keeper } | { served } | null
  //   ctx: fighter {character, sprite, name} | roleId + C | type + common | tsuku + common | summon {id, name} |
  //        speakerName (teach) + account {created, battles} for the seeded pick.
  //   { keeper: "gambler" } (stakes, sweat) mounts the standard keeper strip; { served: true } (teach) means the card
  //   already shows its own portrait and nothing mounts. faces[] is tried in order; the strip falls back to the plate.
  //   The line is the speaker's own when its bank has a plain line for the event, else Arantxa's fallback for the window.
  const FALLBACK = {
    teach: "A question, and you can answer it or let it go.",
    vow: "An oath is a promise with a witness. Choose carefully.",
    commune: "The thing in front of you has something to say. Listen.",
    summon: "A call, and it will be answered. Say it well.",
    stakes: "A wager. The ledger will remember it.",
    multitudes: "Borrow the shape of someone you beat. Spend it well.",
    audition: "Villains answer. Play one, and play it well.",
  };
  const faceP = (folder, file) => `combat/sprites/${folder}/${file}`;
  const fighterFaces = (sprite) => sprite ? [faceP(sprite, "heads/neutral.png"), faceP(sprite, "face-neutral.png"), faceP(sprite, "idle.png")] : [];
  const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const plainLines = (rows) => (rows || []).filter((t) => typeof t === "string" && !t.includes("#"));
  // One deterministic line from a voice table, or null (no entry, no event, or grammar alone).
  function voiceLine(table, key, event, seed) {
    const entry = table && table[key];
    const rows = plainLines(entry && (entry.events ? entry.events[event] : entry.lines ? entry.lines[event] : null));
    return rows.length ? rows[strHash(seed) % rows.length] : null;
  }
  const SPK = (SP && SP.speakers) || {}, SUMV = (SV && (SV.voices || SV.summons)) || {};
  // Ruling 2026-11-03 (Mala, option B; NPC_FACES.md:255, NPC_LINES.md:259): when the thing an overlay is about has no plain line of its own,
  // ARANTXA speaks the fallback in her own name with her Arantxa-Leisure face, so no fighter, structure or summon is given words that are not theirs.
  const arantxaFallback = (kind) => ({ name: "Arantxa", role: "Narrator", faces: [K.artPath("arantxa", "neutral"), K.idlePath("arantxa")].filter(Boolean), text: FALLBACK[kind] });
  function ctxFighter(ctx, fallbackWhen, event, role) {
    const f = ctx.fighter || {}, key = (f.character && SPK[f.character]) ? f.character : (f.sprite && SPK[f.sprite]) ? f.sprite : null;
    const seed = `${fallbackWhen}|${key}|${event}|${ctx.account?.created}|${ctx.account?.battles}`;
    const text = key && voiceLine(SPK, key, event, seed);
    return text ? { name: f.name || "Fighter", role, faces: fighterFaces(f.sprite), text } : arantxaFallback(fallbackWhen);
  }
  function speakerFor(windowId, ctx = {}) {
    switch (windowId) {
      case "teachCard": return { served: true, name: ctx.speakerName || "Speaker" };
      case "proposeStakes":
      case "sweatIt": return { keeper: "gambler" };
      case "vowCard": return ctxFighter(ctx, "vow", "swear", "Swearing the oath");
      case "multitudes": return ctxFighter(ctx, "multitudes", "encounter", "Containing multitudes");
      case "audition": {
        const ch = ctx.C && ctx.C.characters && ctx.C.characters[ctx.roleId];
        if (!ch) return arantxaFallback("audition");
        const seed = `audition|${ctx.roleId}|encounter|${ctx.account?.created}|${ctx.account?.battles}`;
        const text = voiceLine(SPK, ctx.roleId, "encounter", seed);
        return text ? { name: ch.name || ctx.roleId, role: "Answering the call", faces: fighterFaces(ch.sprite), text } : arantxaFallback("audition");
      }
      case "communeQuestion":
        if (ctx.tsuku) return arantxaFallback("commune");   // structures have no voice table: Arantxa speaks
        {
          const key = `commune_${ctx.type}`, seed = `commune|${key}|encounter|${ctx.account?.created}|${ctx.account?.battles}`;
          const text = voiceLine(SPK, key, "encounter", seed);
          return text ? { name: ctx.common || "Commune", role: "Commune", faces: ctx.type ? [faceP(`commune-${ctx.type}`, "heads/neutral.png")] : [], text } : arantxaFallback("commune");
        }
      case "summonQuestion": {
        const s = ctx.summon || {}, seed = `summon|${s.id}|summoned|${ctx.account?.created}|${ctx.account?.battles}`;
        const text = s.id && voiceLine(SUMV, s.id, "summoned", seed);
        return text ? { name: s.name || "Summon", role: "Called", faces: s.id ? [faceP(s.id, "idle.png")] : [], text } : arantxaFallback("summon");
      }
      default: return null;
    }
  }
  return { mount, mountSpeaker, say, reset, HOOKS, openLines, counterKeeper, speakerFor, voiceLine, FALLBACK, fameMileEvent };   // HOOKS and counterKeeper are exported for the unit tests
});
