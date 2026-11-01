"use strict";
// Loci · Random Battle: the browser-only start page (tools/web-build). Pick a character, check your inventory, fight a
// random battle. Reuses the game as it ships: ConceptCombatUI.mount + quickBattle() for the fight, the Loot/Account
// modules and the same save keys for gear. Nothing in the game itself changes.
(() => {
  const CHAR_KEY = "loci:combat:character", ACCOUNT_KEY = "loci:combat:account:v1", PICK_KEY = "loci:web:pick";
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
    const raw = read(ACCOUNT_KEY, null);
    if (!raw) return null;
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
    $("fight").disabled = saveBroken;
    $("fight").title = saveBroken ? "Fighting now would start a new save over the one that could not be read." : "";
  }

  // ── inventory: equip the gear you have won ──
  const SLOTS = ["head", "body", "feet", "tool", "charm"];
  const GHOST = { head: "hardHat", body: "rainJacket", feet: "steelToeBoots", tool: "pruningSaw", charm: "fieldNotebook" };   // faded silhouettes in empty slots
  const ghost = (slot) => `<img class="pk-icon pk-ghost" src="combat/sprites/items/${GHOST[slot]}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
  const icon = (id) => `<img class="pk-icon" src="combat/sprites/items/${encodeURIComponent(id)}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
  function renderInventory() {
    const a = loadAccount(), E = Loot.data.equipment, Cons = Loot.data.consumables || {};
    if (!a) { $("invBody").innerHTML = `<h3>Wearing</h3><div class="pk-slots">${SLOTS.map((slot) => `<div class="pk-slot"><span class="pk-slot-name">${slot}</span>${ghost(slot)}<small>empty</small></div>`).join("")}</div><h3>Gear bag</h3><p class="pk-empty-bag">Nothing yet. Win battles to find gear, then equip it here.</p>`; return; }
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
      ${stashRows ? `<h3>Battle items · in your stash</h3>${stashRows}` : ""}`;
    const after = (sel) => { renderInventory(); ($("invBody").querySelector(sel) || $("invClose")).focus(); };
    $("invBody").querySelectorAll("[data-equip]").forEach((b) => b.onclick = () => { const id = b.dataset.equip, r = Loot.equip(loadAccount(), id); if (r.ok) saveAccount(r.account); after(`[data-unequip="${E[id].slot}"]`); });
    $("invBody").querySelectorAll("[data-unequip]").forEach((b) => b.onclick = () => { const r = Loot.unequip(loadAccount(), b.dataset.unequip); if (r.ok) saveAccount(r.account); after("[data-equip]"); });
  }
  function openInventory() { renderInventory(); $("inventory").hidden = false; $("invClose").focus(); }
  function closeInventory() { $("inventory").hidden = true; renderDetail(); $("invOpen").focus(); }

  // ── the fight: a fresh game each battle, so it reads the save as it is now ──
  function selectCharacter(id) {   // the same record the game's own character picker saves (ui.js selectMain)
    const ch = Content.characters[id], config = ch.configs?.[0] || ch;
    write(CHAR_KEY, { classId: id, primary: ch.primary || config.primary, secondary: ch.secondary ?? config.secondary ?? "", lens: { ...(ch.lens || config.lens || {}) } });
  }
  function fight() {
    loadAccount(); if (saveBroken) { renderDetail(); return; }
    selectCharacter(pick);
    if (game) { game.destroy(); game = null; }
    $("start").hidden = true; $("battle").hidden = false;
    try {
      game = UI.mount($("duelHost"), { onExit: home, town: false });
      game.quickBattle();
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
    again ? fight() : home();
  }, true);
  new MutationObserver(() => {   // say "Fighters" where the game says "Library"
    $("duelHost").querySelectorAll('button[data-cmd="exit"]').forEach((b) => { if (/Library/.test(b.textContent)) b.textContent = b.textContent.replace("Library", "Fighters"); });
  }).observe($("duelHost"), { childList: true, subtree: true });

  $("fight").onclick = fight;
  $("invOpen").onclick = openInventory;
  $("invClose").onclick = closeInventory;
  $("inventory").addEventListener("click", (ev) => { if (ev.target === $("inventory")) closeInventory(); });
  $("leave").onclick = home;
  document.addEventListener("keydown", (ev) => {
    if ($("inventory").hidden) return;
    if (ev.key === "Escape") return closeInventory();
    if (ev.key !== "Tab") return;
    const f = [...$("inventory").querySelectorAll("button:not([disabled])")]; if (!f.length) return;
    if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
    else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
  });
  if (!roster.length) { $("detail").innerHTML = `<p class="pk-error">The character list did not load.</p>`; return; }
  renderRoster(); renderDetail();
})();
