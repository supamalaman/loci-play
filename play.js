"use strict";
// Loci · Random Battle: the browser-only start page (tools/web-build). Pick a character, check your inventory, fight a
// random battle. Reuses the game as it ships: ConceptCombatUI.mount + quickBattle() for the fight, the Loot/Account
// modules and the same save keys for gear. Nothing in the game itself changes.
(() => {
  const CHAR_KEY = "loci:combat:character", ACCOUNT_KEY = "loci:combat:account:v1", PICK_KEY = "loci:web:pick", PROFILE_KEY = "loci:combat:profile", DECK_OPEN_KEY = "loci:web:deck-open";
  // Who a new player can pick. Paladin first (Mala, 2026-10-31). Badge, tagline and sky are flavour only: the ability lines
  // come from the game data (classes-data.js).
  const ROSTER = [
    ["paladin", "Oathsworn", "An oath kept makes every blow burn brighter.", "day"],
    ["knight", "Guardian", "Armoured guard with a lance.", "day"],
    ["barbarian", "Brawler", "Hurt it, and it hits back harder.", "storm"],
    ["rogue", "Thief", "Cuts, steals and slips away.", "night"],
    ["wizard", "Caster", "Spells written in code.", "astral"],
    ["samurai", "Duelist", "Waits for the perfect moment.", "storm"],
    ["ranger", "Tracker", "Tracks prey and finds the path.", "day"],
    ["cleric", "Vowkeeper", "Vows and favours between allies.", "astral"],
    ["ninja", "Shadow", "Strikes from hiding.", "night"],
    ["monkey_king", "Trickster", "Trickster with a staff.", "astral"],
    ["medusa", "Gorgon", "A gaze that holds you still.", "night"],
    ["warden", "Defender", "Walls that bend and hold.", "day"],
  ];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const Content = window.ConceptCombatContent, Classes = window.ConceptCombatClassData?.classes || {};
  const Loot = window.ConceptCombatLoot, Account = window.ConceptCombatAccount, UI = window.ConceptCombatUI;
  const roster = ROSTER.filter(([id]) => Content?.characters?.[id]);
  let pick = roster.some(([id]) => id === read(PICK_KEY, "")) ? read(PICK_KEY, "") : roster[0]?.[0];
  let game = null, saveBroken = false;

  const art = (id) => { const ch = Content.characters[id]; const p = UI?.portraitSource?.({ sprite: ch?.sprite }); return p?.idle || `combat/sprites/${ch?.sprite || id}/idle.png`; };

  // ── account (the game's own save; only read here, written only when you equip) ──
  function loadAccount() {
    const bytes = localStorage.getItem(ACCOUNT_KEY);
    if (bytes === null) return null;   // no save at all: a new player, not a broken one
    let raw;   // read() cannot tell unparseable bytes from a parsed null, so this key parses here
    try { raw = JSON.parse(bytes); } catch { console.warn("Could not read the save: not valid JSON"); saveBroken = true; return null; }
    if (!raw) return null;   // valid JSON with no save in it (null, 0, false): a new player, not a broken one
    try { saveBroken = false; return Loot.withBags(Account.deserialize(raw)); } catch (e) { console.warn("Could not read the save", e); saveBroken = true; return null; }
  }
  const saveAccount = (a) => write(ACCOUNT_KEY, Account.serialize(a));

  // ── start screen ──
  const skyUrl = (sky) => `url('combat/sprites/sky/${sky}.png')`;   // single quotes: it goes inside a style="" attribute
  const entry = (id) => roster.find(([k]) => k === id);
  function renderRoster() {
    $("roster").innerHTML = roster.map(([id, , tag, sky]) => {
      const ch = Content.characters[id];
      return `<button type="button" class="pk-char${id === pick ? " is-picked" : ""}" data-pick="${id}" aria-pressed="${id === pick}" style="--sky:${skyUrl(sky)}">
        <img src="${esc(art(id))}" alt="" loading="lazy"><b>${esc(ch.name)}</b><small>${esc(tag)}</small></button>`;
    }).join("");
    $("roster").querySelectorAll("[data-pick]").forEach((b) => b.onclick = () => {
      if (b.dataset.pick === pick) return;
      pick = b.dataset.pick; write(PICK_KEY, pick); renderRoster(); renderDetail(true);
      $("roster").querySelector(`[data-pick="${pick}"]`)?.focus();
      if (window.matchMedia("(max-width: 760px)").matches) $("hero").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  function renderDetail(animate = false) {
    const ch = Content.characters[pick], cls = Classes[pick] || {}, ab = cls.abilities || {}, [, badge, tag, sky] = entry(pick);
    const concept = (id) => Content.concepts?.[id]?.name || id;
    const prim = concept(ch.primary), sec = ch.secondary ? concept(ch.secondary) : "";
    const rows = [[prim, ab.primaryBasic], [prim, ab.primaryRefined], [sec, ab.secondaryBasic], [sec, ab.secondaryRefined]].filter(([, l]) => l);
    const split = (l) => { const i = l.indexOf(":"); return i < 0 ? [l, ""] : [l.slice(0, i), l.slice(i + 1).trim()]; };
    const ult = typeof cls.merge === "string" ? split(cls.merge) : null;
    const cap = (t) => t ? t[0].toUpperCase() + t.slice(1) : t;
    $("hero").style.setProperty("--sky", skyUrl(sky));
    const img = $("heroArt"); img.src = art(pick);
    if (animate) { img.classList.remove("is-in"); void img.offsetWidth; img.classList.add("is-in"); }
    $("detail").innerHTML = `<div class="pk-name">${esc(ch.name)}<span class="pk-badge">${esc(badge)}</span></div>
      <div class="pk-concepts"><b>${esc(prim)}</b>${sec ? ` + <b>${esc(sec)}</b>` : ""}</div>
      <p class="pk-tagline">${esc(tag)}</p>
      ${rows.length ? `<ul class="pk-abilities">${rows.map(([c, l]) => { const [n, t] = split(l); return `<li><b><i>${esc(c)}</i>${esc(n)}</b>${esc(cap(t))}</li>`; }).join("")}</ul>`
        : `<p class="pk-concepts">Abilities come from ${esc(prim)}${sec ? ` and ${esc(sec)}` : ""}: open Techniques in battle to see them.</p>`}
      ${ult ? `<div class="pk-ult"><span>Ultimate</span><div><b>${esc(ult[0])}</b>${ult[1] ? `: ${esc(cap(ult[1]))}` : ""}</div></div>` : ""}`;
    const a = loadAccount();
    $("record").innerHTML = saveBroken ? "Your save could not be read" : a ? `Level <b>${a.level}</b> · ${a.wins}/${a.battles} won · ${a.seeds} Seeds` : "New player · level <b>1</b>";
    const gear = a ? new Set(a.gear.owned || []).size : 0;
    $("invCount").textContent = gear ? `${gear} piece${gear === 1 ? "" : "s"} of gear` : "win battles to find gear";
    $("fight").disabled = saveBroken; $("forum").disabled = saveBroken;
    $("fight").title = $("forum").title = saveBroken ? "Fighting now would start a new save over the one that could not be read." : "";
  }

  // ── inventory: equip the gear you have won ──
  const SLOTS = ["head", "body", "feet", "tool", "charm"];
  const GHOST = { head: "hardHat", body: "rainJacket", feet: "steelToeBoots", tool: "pruningSaw", charm: "fieldNotebook" };   // faded silhouettes in empty slots
  const ghost = (slot) => `<img class="pk-icon pk-ghost" src="combat/sprites/items/${GHOST[slot]}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
  const icon = (id) => `<img class="pk-icon" src="combat/sprites/items/${encodeURIComponent(id)}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
  function renderInventory() {
    const a = loadAccount(), E = Loot.data.equipment, Cons = Loot.data.consumables || {};
    if (!a) { $("invBody").innerHTML = `<h3>Wearing</h3><div class="pk-slots">${SLOTS.map((slot) => `<div class="pk-slot"><span class="pk-slot-name">${slot}</span>${ghost(slot)}<small>empty</small></div>`).join("")}</div><h3>Gear bag</h3><p class="pk-empty-bag">Nothing yet. Win battles to find gear, then equip it here.</p><div id="pkCards"></div>`; renderCards(); return; }
    const eq = a.gear.equipped || {}, owned = [...new Set(a.gear.owned || [])].filter((id) => E[id]);
    const worn = SLOTS.map((slot) => { const id = eq[slot], it = id && E[id];
      return it ? `<div class="pk-slot is-worn" title="${esc(it.text || "")}"><span class="pk-slot-name">${slot}</span>${icon(id)}<b class="r-${esc(it.rarity)}">${esc(it.name)}</b><button type="button" data-unequip="${slot}" aria-label="Remove ${esc(it.name)}">Remove</button></div>`
        : `<div class="pk-slot"><span class="pk-slot-name">${slot}</span>${ghost(slot)}<small>empty</small></div>`; }).join("");
    const bag = owned.filter((id) => eq[E[id].slot] !== id).sort((x, y) => E[x].slot.localeCompare(E[y].slot) || E[x].name.localeCompare(E[y].name));
    const bagRows = bag.map((id) => { const it = E[id];
      return `<div class="pk-item">${icon(id)}<div><b class="r-${esc(it.rarity)}">${esc(it.name)}</b><span class="pk-meta">${esc(it.slot)} · ${esc(it.rarity)}</span><small>${esc(it.text || "")}</small></div><button type="button" data-equip="${esc(id)}" aria-label="Equip ${esc(it.name)}">Equip</button></div>`; }).join("");
    const stash = Object.entries(a.stash || {}).filter(([id, n]) => n > 0 && Cons[id]);
    const stashRows = stash.map(([id, n]) => `<div class="pk-item">${icon(id)}<div><b>${esc(Cons[id].name)}</b><span class="pk-meta">×${n}</span><small>${esc(Cons[id].text || "")}</small></div></div>`).join("");
    $("invBody").innerHTML = `<h3>Wearing</h3><div class="pk-slots">${worn}</div>
      <h3>Gear bag</h3>${bagRows || `<p class="pk-empty-bag">No spare gear. Win battles to find more.</p>`}
      ${stashRows ? `<h3>Battle items · in your stash</h3>${stashRows}` : ""}
      <div id="pkCards"></div>`;
    renderCards();
    const after = (sel) => { renderInventory(); ($("invBody").querySelector(sel) || $("invClose")).focus(); };
    $("invBody").querySelectorAll("[data-equip]").forEach((b) => b.onclick = () => { const id = b.dataset.equip, r = Loot.equip(loadAccount(), id); if (r.ok) saveAccount(r.account); after(`[data-unequip="${E[id].slot}"]`); });
    $("invBody").querySelectorAll("[data-unequip]").forEach((b) => b.onclick = () => { const r = Loot.unequip(loadAccount(), b.dataset.unequip); if (r.ok) saveAccount(r.account); after("[data-equip]"); });
  }
  // ── Battle cards: the game's deck menu (Field Kit "Battle deck"), under the gear bag (plan ~/loci-orbit/claude/cards-art/PLAN-1b.md rev 2) ──
  // Opening this writes NOTHING: the starter gift is worked out in memory (CardsUI.inventoryTab) and the save is written only from a deck action, like equip.
  function cardsAccount() {   // the save; for a player with no save at all, the account the game itself would build (ui.js: fromLegacyProfile); null when a save exists but cannot be read
    if (localStorage.getItem(ACCOUNT_KEY) === null) { try { return Loot.withBags(Account.fromLegacyProfile(read(PROFILE_KEY, null), { name: "Warden" })); } catch (e) { console.warn("Could not build a starting account", e); return null; } }
    return loadAccount();
  }
  function renderCards() {
    const host = $("pkCards"), CUI = window.ConceptCombatCardsUI; if (!host) return;
    if (!CUI?.inventoryTab) { host.hidden = true; return; }
    const acct = cardsAccount();
    if (!acct) { host.innerHTML = `<h3>Battle cards</h3><p class="pk-empty-bag">Your save could not be read, so cards are switched off to keep it from being overwritten.</p>`; return; }
    const el = document.activeElement, kept = el && host.contains(el) ? (el.dataset.deckAdd ? `[data-deck-add="${el.dataset.deckAdd}"]` : el.dataset.deckRemove != null ? `[data-deck-remove="${el.dataset.deckRemove}"]` : "summary") : null;   // keep focus where it was after the redraw
    const tab = CUI.inventoryTab({ account: () => acct, classId: pick, className: Content.characters[pick]?.name || pick, open: read(DECK_OPEN_KEY, false) === true,
      setAccount: (next) => saveAccount(next), rerender: renderCards, flash: (t) => { const p = host.querySelector(".pk-card-flash"); if (p) p.textContent = t; },
      onToggle: (o) => write(DECK_OPEN_KEY, !!o) });
    host.innerHTML = `<h3>Battle cards</h3>${tab.html}<p class="pk-card-flash" role="status"></p>`;
    CUI.wire(host, tab.ctx);
    if (kept) { const t = host.querySelector(kept); (t && !t.disabled ? t : host.querySelector("summary"))?.focus(); }   // a card whose last copy went into the deck is disabled and cannot take focus: use the summary
  }
  function openInventory() { renderInventory(); $("inventory").hidden = false; $("invClose").focus(); }
  function closeInventory() { $("inventory").hidden = true; renderDetail(); $("invOpen").focus(); }

  // ── the fight: a fresh game each battle, so it reads the save as it is now ──
  function selectCharacter(id) {   // the same record the game's own character picker saves (ui.js selectMain)
    const ch = Content.characters[id], config = ch.configs?.[0] || ch;
    write(CHAR_KEY, { classId: id, primary: ch.primary || config.primary, secondary: ch.secondary ?? config.secondary ?? "", lens: { ...(ch.lens || config.lens || {}) } });
  }
  let lastStart = "quickBattle";   // Again replays the button that started this fight
  function fight(how = "quickBattle") {
    lastStart = how;
    loadAccount(); if (saveBroken) { renderDetail(); return; }
    selectCharacter(pick);
    if (game) { game.destroy(); game = null; }
    $("start").hidden = true; $("battle").hidden = false;
    try {
      game = UI.mount($("duelHost"), { onExit: home, town: false });
      if (how === "surfaceBattle") game.surfaceBattle(); else game.quickBattle();   // Forum (FORUM.md section 5) or Fight
    } catch (e) {
      console.error("Battle failed to start", e);
      $("duelHost").innerHTML = `<pre class="pk-error">The battle failed to start: ${esc(e?.stack || e)}</pre>`;
    }
  }
  function home() {
    if (game) { game.destroy(); game = null; }
    $("duelHost").innerHTML = "";
    $("battle").hidden = true; $("start").hidden = false;
    renderDetail();
  }
  // The game's own buttons lead to its full menus; on this page they lead back here or into the next fight.
  $("duelHost").addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    const again = b.dataset.cmd === "again", leave = b.dataset.cmd === "exit" || b.id === "ccExit";
    if (!again && !leave) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    again ? fight(lastStart) : home();
  }, true);
  new MutationObserver(() => {   // say "Fighters" where the game says "Library"
    $("duelHost").querySelectorAll('button[data-cmd="exit"]').forEach((b) => { if (/Library/.test(b.textContent)) b.textContent = b.textContent.replace("Library", "Fighters"); });
  }).observe($("duelHost"), { childList: true, subtree: true });

  $("fight").onclick = () => fight("quickBattle");
  $("forum").onclick = () => fight("surfaceBattle");
  $("invOpen").onclick = openInventory;
  $("invClose").onclick = closeInventory;
  $("inventory").addEventListener("click", (ev) => { if (ev.target === $("inventory")) closeInventory(); });
  $("leave").onclick = home;
  // On screen for the Tab trap: Chrome still reports layout boxes for what sits inside a CLOSED <details>, so a control inside one is hidden unless it is that details' own summary.
  const onScreen = (el) => !(el.matches("summary") ? el.parentElement?.parentElement : el).closest?.("details:not([open])") && el.getClientRects().length > 0;
  document.addEventListener("keydown", (ev) => {
    if ($("inventory").hidden) return;
    if (ev.key === "Escape") return closeInventory();
    if (ev.key !== "Tab") return;
    const f = [...$("inventory").querySelectorAll("button:not([disabled]), summary")].filter(onScreen); if (!f.length) return;   // only what is on screen: a closed deck menu hides its buttons
    if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
    else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
  });
  // ── the update bar (Mala, 2026-11-01): the same ticker the Mac app shows; the build's version.json says what is published ──
  function reloadForUpdate() {
    if ($("battle").hidden || window.confirm("Reload Loci? Your current battle will end.")) location.reload();
  }
  async function refreshVersion() {
    const U = self.ConceptCombatUpdate; if (!U) return;
    const v = await U.check(); if (!v.running) return;
    document.querySelectorAll("[data-version]").forEach((el) => { el.textContent = `v${v.running}`; });
    const t = $("updateTicker"); if (!t) return;
    t.hidden = !v.updateReady;
    if (v.updateReady) { t.textContent = `Update available: Loci ${v.staged} is ready (you are on ${v.running}) · Reload to install`; t.onclick = reloadForUpdate; }
  }
  refreshVersion(); setInterval(refreshVersion, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshVersion(); });
  if (!roster.length) { $("detail").innerHTML = `<p class="pk-error">The character list did not load.</p>`; return; }
  renderRoster(); renderDetail();
})();
