"use strict";
// The Museum panel, slice M2 (specs/MUSEUM.md T8/T9; Mala, 2026-10-31). C10: a new screen is its own file; ui.js mounts it.
// Palace Night (docs/palace-night.md): game ground #1c1a21, gold #e9c46a; the panel uses the existing town-hall card and --pn tokens.
//
//   panel(account, opts)  the overlay html (12 plinths, Place / Take back, N of 12, Empty plinth, optional scene)
//   kitCardBits(account, id)  Field Kit badge / Enshrine button / hide-market flag for one piece
//   inBag(account, id)    stored-gear bag: owned, not worn, not enshrined
//   heirloomIds(account)  saga picker: owned equipment that is not enshrined
//   mount(host, ctx)      draw and wire; ctx = { account(), setAccount(a), flash(text), back(), mountKeeper(host, id), note, scene }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../account/loot.js"), require("../workshop/jinki-states.js"));
  else root.ConceptCombatMuseumUI = factory(root.ConceptCombatLoot, root.ConceptCombatJinkiStates);
})(typeof self !== "undefined" ? self : this, function (Loot, JStates) {
  const esc = (s) => String(s ?? "").replace(/[&<>\x22]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // M9: Mala writes the placement scene; the spec's own sentence stands until she names the rest. Decision for Mala on the shelf NOTE.
  const SCENE = "The keeper sets it down.";

  function kitCardBits(account, id) {
    const a = Loot.withBags(account), placed = Loot.enshrined(a, id), qualifies = Loot.museumQualifies(a, id);
    const cap = a.museum.plinths || Loot.MUSEUM_PLINTHS, full = (a.museum.placed || []).length >= cap;
    return {
      placed,
      badge: placed ? `<span class="cc-museum-badge">In the Museum</span>` : "",
      enshrineBtn: !placed && qualifies ? `<button type="button" data-enshrine="${esc(id)}"${full ? ` disabled title="Every plinth is taken (${cap} of ${cap})."` : ""}>Enshrine in the Museum</button>` : "",
      hideMarket: placed,
    };
  }
  const inBag = (account, id) => {
    const a = Loot.withBags(account);
    return a.gear.owned.includes(id) && !Object.values(a.gear.equipped).includes(id) && !Loot.enshrined(a, id);
  };
  const heirloomIds = (account) => {
    const a = Loot.withBags(account);
    return a.gear.owned.filter((id) => Loot.data.equipment[id] && !Loot.enshrined(a, id));
  };

  function plinth(account, id, i) {
    if (!id) return `<article class="cc-plinth is-empty" data-plinth="${i}"><p class="cc-muted">Empty plinth</p></article>`;
    const it = Loot.data.equipment[id], care = Loot.careOf(account, id);
    const max = Loot.maxDurability(id, account), now = account.gear.durability[id] ?? max;
    const icon = JStates ? JStates.iconHTML(id, it.name, now, max, care.score, it, Loot.data.rules.durability.warnAt, care.kind) : "";
    const soul = care.soul ? ` · soul ${esc(care.soul.kind)}${care.title ? ` · ${esc(care.title)}` : ""}` : (care.title ? ` · ${esc(care.title)}` : "");
    return `<article class="cc-plinth" data-plinth="${i}" data-placed="${esc(id)}">${icon}<div><b>${esc(it.name)}</b><small>${soul}</small><p class="cc-care-line">${esc(care.line)}</p></div>
      <button type="button" data-withdraw="${esc(id)}">Take back</button></article>`;
  }

  function placeList(account) {
    const a = Loot.withBags(account);
    const ids = a.gear.owned.filter((id) => Loot.museumQualifies(a, id) && !Loot.enshrined(a, id));
    if (!ids.length) return `<p class="cc-muted">Nothing qualifies yet. A piece qualifies once you have cherished it (Cherish shows on a piece that has seen some wear) or once it awakens.</p>`;
    return `<ul class="cc-museum-place">${ids.map((id) => {
      const it = Loot.data.equipment[id];
      return `<li><button type="button" data-place="${esc(id)}">${esc(it.name)}</button></li>`;
    }).join("")}</ul>`;
  }

  function panel(account, { note = "", picking = false, scene = false } = {}) {
    const a = Loot.withBags(account);
    const cap = a.museum.plinths || Loot.MUSEUM_PLINTHS;
    const placed = a.museum.placed || [];
    const n = placed.length;
    const cells = Array.from({ length: cap }, (_, i) => plinth(a, placed[i] || null, i)).join("");
    const sceneCard = scene ? `<aside class="cc-museum-scene" role="status"><p>${esc(SCENE)}</p></aside>` : "";
    const pick = picking ? `<section class="cc-museum-pick"><h3>Place an item</h3>${placeList(a)}<button type="button" id="ccMuseumPickCancel">Cancel</button></section>` : "";
    return `<div class="cc-card cc-town-hall cc-museum"><div class="cc-codex-head"><div class="cc-keeper-slot" data-keeper-slot="museumKeeper" hidden></div><h2>The Museum</h2></div>
      <p class="pn-label">the keeper</p>
      <p class="cc-muted">${n} of ${cap} plinths. A piece here is safe from sale and wear. Take it back whenever you like.</p>
      ${sceneCard}${note ? `<p class="cc-hall-note" role="status">${esc(note)}</p>` : ""}
      <div class="cc-museum-plinths">${cells}</div>
      ${pick}
      <div class="cc-row">${picking ? "" : `<button type="button" id="ccMuseumPlace" ${n >= cap ? "disabled" : ""}>Place an item</button>`}<button type="button" class="cc-primary" id="ccMuseumBack">← Back to town</button></div></div>`;
  }

  function mount(host, ctx) {
    let picking = !!ctx.picking, scene = !!ctx.scene;
    const draw = (note) => {
      host.innerHTML = panel(ctx.account(), { note: note || "", picking, scene });
      const back = host.querySelector("#ccMuseumBack");
      if (back) back.onclick = () => ctx.back();
      host.querySelector("#ccMuseumPlace")?.addEventListener("click", () => { picking = true; scene = false; draw(""); });
      host.querySelector("#ccMuseumPickCancel")?.addEventListener("click", () => { picking = false; draw(""); });
      host.querySelectorAll("[data-place]").forEach((b) => b.onclick = () => {
        const r = Loot.enshrine(ctx.account(), b.dataset.place);
        if (!r.ok) return ctx.flash(r.reason);
        ctx.setAccount(r.account);
        picking = false; scene = !!r.first;
        draw(r.first ? "" : `${Loot.data.equipment[b.dataset.place].name} rests here.`);
      });
      host.querySelectorAll("[data-withdraw]").forEach((b) => b.onclick = () => {
        const r = Loot.withdraw(ctx.account(), b.dataset.withdraw);
        if (!r.ok) return ctx.flash(r.reason);
        ctx.setAccount(r.account);
        picking = false; scene = false;
        draw(`${Loot.data.equipment[b.dataset.withdraw].name} is yours again.`);
      });
      if (ctx.mountKeeper) ctx.mountKeeper(host, "museum");
      back?.focus();
    };
    draw(ctx.note || "");
  }

  return { panel, kitCardBits, inBag, heirloomIds, mount };
});
