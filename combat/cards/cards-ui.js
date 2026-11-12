"use strict";
// Battle Cards, slice C0 (specs/CARDS.md sections 2.1 and 8): the "Battle deck" group of the Field Kit. String builders over the pure rules,
// so node tests can read the screen; the DOM wiring is one small function. The group renders only when rules.enabled is true (C1 turned it on for the instant kind).
//
//   group(ctx)        the <details> html ("" while the system is dark); first read after enabling hands out the starter gift
//   drawerRows(rows, show)  C1: the battle Cards drawer's menu rows (none for an empty deck); unitLine(view)  C1: the unit panel's Cards line
//   wire(ov, ctx)     click and drag handlers for the group inside overlay `ov` (drag a collection card onto the deck, or a deck card back off it)
//   ctx = { account(), classId, className, setAccount(a), rerender(), flash(text), open, onToggle(open) }
//   art(card)         the card's art entry from card-art.js ({ src, w, h, baked, activated? }) or null; face() draws it (or a CSS fallback panel for a card with none)
//   inventoryTab(ctx) { html, ctx, account, gifted }: the same deck menu for the Redux Inventory (tools/web-build/play.js): the starter gift is worked out in memory FIRST, so drawing it writes nothing; ctx.setAccount is called only from a deck action
//   almanac(account?) { html, playable, total, owned?, seen? }: every card in the data by series with its art, for the Codex "Card almanac". With an account, each figure says "owned ×n" or "seen" and the lead names the shelf counts. No cost, potency or points on those lines. collection(account) is the same counts.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./cards.js"), require("./cards-data.js"), require("../account/cardbook.js"), require("./card-art.js"));
  else root.ConceptCombatCardsUI = factory(root.ConceptCombatCards, root.ConceptCombatCardsData, root.ConceptCombatCardbook, root.ConceptCombatCardArt);
})(typeof self !== "undefined" ? self : this, function (Cards, D, CB, CA) {
  const esc = (s) => String(s).replace(/[&<>\x22]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const word = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // One card face: kind and rarity are words (never colour alone), the generated rule text is the screen-reader text.
  const ART_BASE = "combat/cards/";
  const art = (card) => (CA && card?.art?.key && CA.art[card.art.key]) || null;
  // The picture: the cut art when the manifest has it, else a plain panel with the kind glyph and the kind word (every card in the data has art today; the panel is the safety net).
  // A card whose art carries its own name plate (`baked`) prints no second name; a suit or a renamed card gets a plain label over the picture (CARDS.md 18.6).
  function picture(card, A, big = false) {
    const k = D.kinds[card.kind];
    if (!A) return `<span class="cc-card-art is-fallback is-${esc(card.kind)}${big ? " is-big" : ""}" aria-hidden="true"><span class="cc-card-glyph">${esc(k.glyph)}</span><span class="cc-card-kindword">${esc(k.label)}</span></span>`;
    return `<span class="cc-card-art${big ? " is-big" : ""}" aria-hidden="true"><img src="${ART_BASE}${esc(A.src)}" width="${A.w}" height="${A.h}" alt="" draggable="false" loading="lazy" decoding="async">${A.baked ? "" : `<span class="cc-card-plate">${esc(card.name)}</span>`}</span>`;
  }
  // One card face: kind and rarity are words (never colour alone), the generated rule text is the screen-reader text.
  // The name stays in the markup as the first <b> (hidden from the eye when the picture prints it) so a reader and a test still find it.
  function face(card, { attr = "", note = "", count = 0, disabled = false } = {}) {
    const k = D.kinds[card.kind], text = Cards.textOf(card), A = art(card);
    return `<button type="button" class="cc-card-face is-${card.kind}${A ? " has-art" : ""}${disabled ? " is-off" : ""}" ${attr} ${disabled ? 'disabled aria-disabled="true"' : 'draggable="true"'} title="${esc(text)}">`
      + picture(card, A)
      + `<span class="cc-card-top"><span aria-hidden="true">${esc(k.glyph)}</span> <b${A ? ' class="cc-sr"' : ""}>${esc(card.name)}</b>${count > 1 ? ` <small>×${count}</small>` : ""}</span>`
      + `<small class="cc-card-meta">${k.label} · ${word(card.rarity)} · ${card.cost} point${card.cost === 1 ? "" : "s"}</small>`
      + `<small class="cc-card-text">${esc(text)}</small>${note ? `<small class="cc-card-note">${esc(note)}</small>` : ""}</button>`;
  }
  // Your shelf: kinds you hold, and kinds you have only seen. A key that is not a card id is not a sighting.
  function collection(account) {
    const b = CB.normalize(account || {}).cardbook;
    const ids = new Set(D.cards.map((c) => c.id));
    const ownOf = {}, seenOf = {};
    for (const [id, n] of Object.entries(b.owned)) if (ids.has(id) && n > 0) ownOf[id] = n;
    for (const [id, v] of Object.entries(b.seen)) if (ids.has(id) && v && !ownOf[id]) seenOf[id] = true;
    return { owned: Object.keys(ownOf).length, seen: Object.keys(ownOf).length + Object.keys(seenOf).length, ownOf, seenOf };
  }
  // The Codex "Card almanac": every card in the data, by series, with its art. A card that cannot be played (staged, or its kind has no battle slice yet)
  // says so in words; none of this changes what a deck may hold. Pass the account and each figure also says "owned ×n" or "seen", with no cost, potency or points.
  function almanac(account) {
    const playable = new Set(Cards.liveCards().map((c) => c.id)), series = [];
    for (const c of D.cards) { let g = series.find((x) => x.name === (c.series || "Cards")); if (!g) series.push(g = { name: c.series || "Cards", cards: [] }); g.cards.push(c); }
    const total = D.cards.length, n = [...playable].length;
    const col = account ? collection(account) : null;
    const mark = (c) => !col ? "" : col.ownOf[c.id] ? ` · owned ×${col.ownOf[c.id]}` : col.seenOf[c.id] ? " · seen" : "";
    const shelf = col ? ` Your shelf: ${col.owned} owned · ${col.seen} seen.` : "";
    const html = `<p class="cc-muted">Every card in the game, with its picture. A card marked "not playable yet" is drawn and priced but cannot go in a deck.${shelf}</p>`
      + (CA ? `<p class="cc-almanac-back"><span class="cc-card-art is-back" aria-hidden="true"><img src="${ART_BASE}${esc(CA.back)}" alt="" draggable="false" loading="lazy" decoding="async"></span><small>The back of a card: what an opponent's deck looks like face down.</small></p>` : "")
      + series.map((g) => `<details class="cc-almanac-series"><summary><b>${esc(g.name)}</b> <small>${g.cards.filter((c) => playable.has(c.id)).length} of ${g.cards.length} playable</small></summary><div class="cc-almanac-grid">`
        + g.cards.map((c) => `<figure class="cc-almanac-card${playable.has(c.id) ? "" : " is-staged"}">${picture(c, art(c), true)}<figcaption><b>${esc(c.name)}</b><small>${esc(D.kinds[c.kind].label)} · ${esc(word(c.rarity))}${playable.has(c.id) ? "" : " · not playable yet"}${mark(c)}</small></figcaption></figure>`).join("")
        + `</div></details>`).join("");
    return { html, playable: n, total, ...(col ? { owned: col.owned, seen: col.seen } : {}) };
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
    const sets = view.sets ? ` · ${view.sets} set${view.sets === 1 ? "" : "s"}` : "";
    if (view.full) return `Cards: ${view.unused} of ${view.deckSize} unused${sets}`;
    const base = `Cards (seen): ${view.unused} of ${view.deckSize} unused${sets}`;
    const knownText = view.known ? [view.known.kinds ? Object.entries(view.known.kinds).map(([k, n]) => `${n} ${k}`).join(", ") : "", view.known.names.length ? view.known.names.join(", ") : ""].filter(Boolean).join("; ") : "";
    const kn = knownText ? ` · known: ${knownText}` : "";   // nothing left to name (every glimpsed card played): no dangling "known:"
    return view.unusedList ? `${base} · shown: ${view.unusedList.join(", ")}${kn}` : base + kn;
  }
  // The Redux Inventory tab (plan ~/loci-orbit/claude/cards-art/PLAN-1b.md rev 2): group() gifts the starter cards on its first render and would call ctx.setAccount, which the page saves; so the
  // gift is worked out here first and group() is given the account that already holds it (its own gift step then finds nothing to do). The caller saves only from a deck action, and the gift
  // persists with that first save (giftedIds makes a repeat gift a no-op). `ctx` returned is the one to pass to wire().
  function inventoryTab(ctx) {
    const g = CB.giftStarter(ctx.account()), c2 = { ...ctx, account: () => g.account };
    return { html: group(c2), ctx: c2, account: g.account, gifted: g.changed };
  }
  return { group, wire, move, drawerRows, unitLine, art, face, almanac, collection, inventoryTab };
});
