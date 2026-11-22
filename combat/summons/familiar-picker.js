"use strict";
// The same account roster and dialog for Rituals, Field Kit and Random Battle.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../account/account.js"), require("../dream/enemy-dreams-data.js"));
  else root.ConceptCombatFamiliarPicker = factory(root.ConceptCombatAccount, root.ConceptCombatEnemyDreams);
})(typeof self !== "undefined" ? self : this, function (Account, Dreams) {
  const dreamPrefix = "enemyDream:";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const title = (id) => String(id || "").replace(/[-_]/g, " ").replace(/^\w/, (char) => char.toUpperCase());

  function offer(account, id, gate) {
    if (!account.familiars) return { state: "token", label: "Familiar tokens unavailable on this save" };
    if (account.level < gate) return { state: "level", label: `Opens at level ${gate}` };
    const { error } = Account.buyFamiliar(account, id);
    return error
      ? { state: "token", label: account.familiars.tokens ? error : "Need a familiar token" }
      : { state: "choose", label: "Choose · 1 token" };
  }

  function roster(account, data) {
    if (!account) return [];
    const owned = new Set(account.unlocked);
    const scheduled = new Map(Account.benefitOrder.map((row) => [row.id, row]));
    const legacyLevels = new Map(account.order.map((id, index) => [id, Account.rules.unlockLevels[index]]));
    const ids = new Set(["raven", ...scheduled.keys(), ...owned]);
    return [...ids].flatMap((id) => {
      const def = data.summons[id];
      if (!def) return [];
      const met = owned.has(id), entry = scheduled.get(id);
      const gate = account.familiars ? Account.familiarGates[id] : legacyLevels.get(id);
      if (!met && gate == null) return [];
      const rating = def.rating ?? (entry?.starter ? 1 : 1 + Number(!!def.trueForm) + Number(!!def.maxForm));
      const details = { id, def, rating, role: data.attitudes[def.attitude]?.label, why: entry?.why || def.identity };
      if (met) return [{ ...details, state: "met", label: entry?.starter ? "Met · free starter" : "Met" }];
      if (!account.familiars) return [{ ...details, state: "level", label: `Opens at level ${gate}` }];
      return [{ ...details, ...offer(account, id, gate) }];
    });
  }

  function dreamRoster(account) {
    if (!account) return [];
    const owned = new Set(account.unlocked);
    return Object.entries(Account.dreamGates).sort((a, b) => a[1] - b[1]).flatMap(([key, gate]) => {
      const def = Dreams.monsters[key];
      if (def?.status !== "ready" || def.broodOnly) return [];
      const id = `${dreamPrefix}${key}`;
      const state = owned.has(id) ? { state: "met", label: "Met" } : offer(account, id, gate);
      return [{ id, def, gate, ...state }];
    });
  }

  function summary(account, data) {
    if (!account) return "";
    const met = [...roster(account, data), ...dreamRoster(account)].filter((row) => row.state === "met").length;
    const next = Account.nextUnlock(account);
    const tokens = account.familiars?.tokens;
    const milestone = next?.token ? `Next familiar token at level ${next.level}`
      : next ? `Meet ${data.summons[next.id]?.name || "your next familiar"} at level ${next.level}` : "";
    return [
      `${met} ${met === 1 ? "familiar" : "familiars"} met`,
      tokens == null ? "" : `${tokens} familiar ${tokens === 1 ? "token" : "tokens"}`,
      milestone,
    ].filter(Boolean).join(" · ");
  }

  function open({ getAccount, data, portrait, conceptName, save, readOnly = "", trigger = document.activeElement }) {
    const dialog = document.createElement("dialog");
    dialog.className = "cc-familiar-picker";
    dialog.setAttribute("aria-label", "Familiars");
    dialog.innerHTML = `<header><h2>Familiars</h2><button type="button" data-familiar-close autofocus>Done</button></header>
      <p data-familiar-progress></p><p data-familiar-status role="status"></p>
      <div data-familiar-undo></div><div data-familiar-grid></div>
      <section data-familiar-dreams aria-labelledby="cc-familiar-dreams-heading" hidden>
        <h3 id="cc-familiar-dreams-heading">Dreams</h3><div data-familiar-grid></div>
      </section>`;
    const close = dialog.querySelector("[data-familiar-close]");
    const status = dialog.querySelector("[data-familiar-status]");
    const grid = dialog.querySelector("[data-familiar-grid]");
    const undo = dialog.querySelector("[data-familiar-undo]");
    const dreams = dialog.querySelector("[data-familiar-dreams]");
    const dreamGrid = dreams.querySelector("[data-familiar-grid]");

    function render(message = "") {
      const account = getAccount(), rows = roster(account, data), dreamRows = dreamRoster(account);
      const last = account?.familiars?.lastPick;
      const lastRow = [...rows, ...dreamRows].find((row) => row.id === last?.id && row.state === "met");
      const canReturn = lastRow && !readOnly && !Account.returnLastPick(account).error;
      dialog.querySelector("[data-familiar-progress]").textContent = summary(account, data);
      status.textContent = message || readOnly || (account ? "" : "Your save could not be read.");
      function card({ id, def, rating, role, why, gate, state, label }) {
        const isDream = gate != null;
        const image = isDream ? `${def.sprite}/idle.png` : portrait(def.sprite || id);
        const names = isDream ? [def.concept] : [def.standIn?.primary, def.standIn?.secondary];
        const concepts = names.filter(Boolean).map(conceptName).join(" + ");
        const kind = isDream ? `Dream · tier ${def.beliefTier}` : [role, `Rating ${rating}`].filter(Boolean).join(" · ");
        const context = isDream ? (state === "level" ? "" : `Level ${gate}`) : title(def.room);
        return `<article class="cc-familiar-card" data-state="${state}" data-familiar="${esc(id)}">
          <div class="cc-familiar-art">${image ? `<img src="${esc(image)}" alt="">` : ""}</div>
          <h3>${esc(def.name)}</h3><p class="cc-familiar-role">${esc(kind)}</p>
          ${isDream ? `<p class="cc-familiar-drawback"><b>${esc(def.drawback.name)}</b> · ${esc(def.drawback.text)}</p>` : why ? `<p>${esc(why)}</p>` : ""}
          <p class="cc-familiar-tags">${esc([concepts, context].filter(Boolean).join(" · "))}</p>
          ${state === "choose" && !readOnly ? `<button type="button" data-familiar-buy="${esc(id)}" aria-label="Choose ${esc(def.name)} · 1 token">${label}</button>`
            : `<strong>${esc(state === "choose" ? "Choose between battles" : label)}</strong>`}
        </article>`;
      }
      grid.innerHTML = rows.map(card).join("");
      dreams.hidden = dreamRows.length === 0;
      dreamGrid.innerHTML = dreamRows.map(card).join("");
      undo.innerHTML = canReturn
        ? `<button type="button" data-familiar-return>Take back ${esc(lastRow.def.name)} and recover 1 token</button><p>Available until you fight another battle.</p>`
        : "";
    }

    dialog.addEventListener("click", (event) => {
      const { familiarBuy, familiarReturn } = event.target.dataset;
      if (readOnly || (!familiarBuy && familiarReturn == null)) return;
      const account = getAccount();
      if (!account) return render("Your save could not be read.");
      const result = familiarBuy ? Account.buyFamiliar(account, familiarBuy) : Account.returnLastPick(account);
      if (result.error || save(result.account) === false) {
        render(result.error || "Your choice could not be saved.");
        close.focus();
        return;
      }
      const chosenName = familiarBuy
        ? (data.summons[familiarBuy] || Dreams.monsters[familiarBuy.slice(dreamPrefix.length)]).name
        : null;
      const returnedId = account.familiars.lastPick?.id;
      render(chosenName ? `${chosenName} joins your familiars.` : "Familiar token returned.");
      const returnedButton = [...dialog.querySelectorAll("[data-familiar-buy]")].find((button) => button.dataset.familiarBuy === returnedId);
      (undo.querySelector("button") || returnedButton || close).focus();
    });
    dialog.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [...dialog.querySelectorAll("button:not([disabled])")];
      const edge = event.shiftKey ? controls[0] : controls.at(-1);
      if (document.activeElement !== edge) return;
      event.preventDefault();
      (event.shiftKey ? controls.at(-1) : controls[0]).focus();
    });
    function dismiss() {
      dialog.close();
      dialog.remove();
      if (trigger?.isConnected) trigger.focus();
    }
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dismiss();
    });
    close.onclick = dismiss;
    render();
    document.body.append(dialog);
    dialog.showModal();
  }

  return { roster, dreamRoster, summary, open };
});
