"use strict";
// Battle Cards, slice C0 (specs/CARDS.md sections 2.1 and 8): the "Battle deck" group of the Field Kit. String builders over the pure rules,
// so node tests can read the screen; the DOM wiring is one small function. The group renders only when rules.enabled is true (C1 turned it on for the instant kind).
//
//   group(ctx)        the <details> html ("" while the system is dark); first read after enabling hands out the starter gift
//   drawerRows(rows, show)  C1: the battle Cards drawer's menu rows (none for an empty deck); unitLine(view)  C1: the unit panel's Cards line
//   wire(ov, ctx)     click and drag handlers for the group inside overlay `ov` (drag a collection card onto the deck, or a deck card back off it)
//   ctx = { account(), classId, className, setAccount(a), rerender(), flash(text), open, onToggle(open) }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./cards.js"), require("./cards-data.js"), require("../account/cardbook.js"));
  else root.ConceptCombatCardsUI = factory(root.ConceptCombatCards, root.ConceptCombatCardsData, root.ConceptCombatCardbook);
})(typeof self !== "undefined" ? self : this, function (Cards, D, CB) {
  const esc = (s) => String(s).replace(/[&<>\x22]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const word = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // One card face: kind and rarity are words (never colour alone), the generated rule text is the screen-reader text.
  function face(card, { attr = "", note = "", count = 0, disabled = false } = {}) {
    const k = D.kinds[card.kind], text = Cards.textOf(card);
    return `<button type="button" class="cc-card-face is-${card.kind}${disabled ? " is-off" : ""}" ${attr} ${disabled ? 'disabled aria-disabled="true"' : 'draggable="true"'} title="${esc(text)}">`
      + `<span class="cc-card-top"><span aria-hidden="true">${k.glyph}</span> <b>${esc(card.name)}</b>${count > 1 ? ` <small>×${count}</small>` : ""}</span>`
      + `<small class="cc-card-meta">${k.label} · ${word(card.rarity)} · ${card.cost} point${card.cost === 1 ? "" : "s"}</small>`
      + `<small class="cc-card-text">${esc(text)}</small>${note ? `<small class="cc-card-note">${esc(note)}</small>` : ""}</button>`;
  }
  function status(ctx, deck) {
    const a = ctx.account(), v = CB.validate(a, deck);
    if (v.ok) return { v, line: deck.length ? "This deck is legal." : "Empty deck: legal. A battle with no deck plays no cards." };
    const dropped = deck.length - v.legal.length;
    return { v, line: `${v.errors.map((e) => e.text).join(" ")} A battle would start with the first ${v.legal.length} card${v.legal.length === 1 ? "" : "s"}${dropped ? ` (${dropped} dropped)` : ""}.` };
  }
  function group(ctx) {
    if (!D.rules.enabled) return "";
    const g = CB.giftStarter(ctx.account()); if (g.changed) ctx.setAccount(g.account);
    const a = ctx.account(), deck = CB.deckFor(a, ctx.classId), st = status(ctx, deck), cap = CB.cap(a), own = CB.hasOverride(a, ctx.classId);
    const counts = {}; for (const id of deck) counts[id] = (counts[id] || 0) + 1;
    const strip = deck.map((id, i) => { const c = Cards.byId(id); return c ? face(c, { attr: `data-deck-remove="${i}"`, note: "Click to remove." }) : `<button type="button" class="cc-card-face is-off" data-deck-remove="${i}">${esc(id)} <small>not a card; click to remove</small></button>`; }).join("") || `<p class="cc-muted">No cards in this deck yet.</p>`;
    const owned = Object.entries(a.cardbook?.owned || {}).filter(([id, n]) => n > 0 && Cards.byId(id));
    const kinds = Object.keys(D.kinds).map((kind) => {
      const mine = owned.filter(([id]) => Cards.byId(id).kind === kind); if (!mine.length) return "";
      return `<details class="cc-deck-kind"><summary>${D.kinds[kind].label} <small>${mine.length}</small></summary><div class="cc-deck-grid">${mine.map(([id, n]) => {
        const c = Cards.byId(id), can = CB.canAdd(a, deck, id);
        return face(c, { attr: `data-deck-add="${esc(id)}"`, count: n, disabled: !can.ok, note: can.ok ? "Click to add." : can.reason });
      }).join("")}</div></details>`;
    }).join("") || `<p class="cc-muted">You own no cards yet.</p>`;
    return `<details class="cc-menu-section cc-deck-group" id="ccDeckGroup" ${ctx.open ? "open" : ""}><summary><span aria-hidden="true">▤</span> Battle deck <small>${deck.length} / ${D.rules.deck.maxCards} cards · ${st.v.points} / ${cap} points</small></summary><div class="cc-menu-body">`
      + `<p class="cc-muted">Deck for: <b>${own ? esc(ctx.className) : "Everyone"}</b> ${own ? `<button type="button" data-deck-scope="shared">Use the shared deck again</button>` : `<button type="button" data-deck-scope="own">Use this deck for ${esc(ctx.className)} only</button>`}</p>`
      + `<h3>Deck · ${deck.length} / ${D.rules.deck.maxCards} cards · ${st.v.points} / ${cap} points</h3><div class="cc-deck-grid" data-deck-zone="deck">${strip}</div>`
      + `<p class="cc-deck-line${st.v.ok ? "" : " is-bad"}" role="status">${esc(st.line)}</p><h3>Collection</h3><div data-deck-zone="collection">${kinds}</div>`
      + `<p class="cc-muted">Cards are played in battle for no AP and no ΦF: one card a turn, each card once a battle. The deck saves as you change it.</p></div></details>`;
  }
  // One move for a click and a drag alike: { id } onto the deck adds a card, { index } onto the collection takes one out.
  function move(ctx, p, zone) {
    const a = ctx.account(), deck = CB.deckFor(a, ctx.classId);
    if (zone === "deck" && p && typeof p.id === "string") {
      const can = CB.canAdd(a, deck, p.id);
      if (!can.ok) { ctx.flash(can.reason); return false; }
      ctx.setAccount(CB.setDeck(a, [...deck, p.id], ctx.classId)); ctx.rerender(); return true;
    }
    if (zone === "collection" && p && Number.isInteger(p.index) && p.index >= 0 && p.index < deck.length) {
      deck.splice(p.index, 1); ctx.setAccount(CB.setDeck(a, deck, ctx.classId)); ctx.rerender(); return true;
    }
    return false;
  }
  function wire(ov, ctx) {
    const root_ = ov.querySelector("#ccDeckGroup"); if (!root_) return;
    root_.ontoggle = () => ctx.onToggle(root_.open);
    root_.querySelectorAll("[data-deck-add]").forEach((b) => {
      b.onclick = () => move(ctx, { id: b.dataset.deckAdd }, "deck");
      b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ id: b.dataset.deckAdd })); e.dataTransfer.effectAllowed = "move"; });
    });
    root_.querySelectorAll("[data-deck-remove]").forEach((b) => {
      b.onclick = () => move(ctx, { index: +b.dataset.deckRemove }, "collection");
      b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ index: +b.dataset.deckRemove })); e.dataTransfer.effectAllowed = "move"; });
    });
    root_.querySelectorAll("[data-deck-zone]").forEach((z) => {
      z.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
      z.addEventListener("drop", (e) => { e.preventDefault(); let p; try { p = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (_) { return; } move(ctx, p, z.dataset.deckZone); });
    });
    root_.querySelectorAll("[data-deck-scope]").forEach((b) => b.onclick = () => {
      const a = ctx.account(); ctx.setAccount(b.dataset.deckScope === "own" ? CB.useOwnDeck(a, ctx.classId) : CB.useSharedDeck(a, ctx.classId)); ctx.rerender();
    });
  }
  // ── In battle (C1): the Cards drawer rows, the unit panel line and the log text. Pure, so node tests read them; ui.js only places them.
  // `rows` is E.cards.options(s, id) (own deck), `show` is E.cards.showOptions(s, id). Empty deck = no rows: the drawer does not exist.
  function drawerRows(rows, show) {
    if (!rows || !rows.length) return [];
    const out = rows.map((r) => ({ id: `card:${r.index}`, card: r.index, needsTarget: r.needsTarget, off: r.state !== "ready",
      label: `${r.name} · ${r.kindLabel}${r.state === "used" ? " · played" : ""}`, why: r.state === "ready" ? "" : r.reason, help: `${r.text} (${r.kindLabel}, ${word(r.rarity || "common")}, ${r.cost} deck point${r.cost === 1 ? "" : "s"}; no AP, no ΦF, one card a turn.)` }));
    if (show) out.push({ id: "card:show", off: show.state !== "ready", label: "Show your hand", why: show.state === "ready" ? "" : show.reason,
      help: "Tell the believers who can see you what is left in your deck, for a small damage edge on your cards against the believers you showed (from your next turn). A skeptic who sees it is shaken (it may wake) but is told nothing unless it converts. Once a battle; no AP." });
    return out;
  }
  // "Cards: 3 of 4 unused" for the owner (and allies); an aware observer who may know gets the numbers; an unaware observer gets "".
  function unitLine(view) {
    if (!view) return "";
    const sets = view.sets ? ` · ${view.sets} set` : "";
    if (view.full) return `Cards: ${view.unused} of ${view.deckSize} unused${sets}`;
    const base = `Cards (seen): ${view.unused} of ${view.deckSize} unused${sets}`;
    return view.unusedList ? `${base} · shown: ${view.unusedList.join(", ")}` : base;
  }
  return { group, wire, move, drawerRows, unitLine };
});
