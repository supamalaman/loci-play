"use strict";
// Bonds B1 (claude-bonds-spec 1.1 to 1.3 and 1.13, R-20261122-11): the Bonds window (`bondLedger` in npc/keepers.js WINDOWS).
// It opens from the Bonds button on a keeper's strip (npc/keeper-ui.js) for a keeper with an authored route (Jatayu in B1),
// inside the strip, so the window that hosts the strip keeps its own back button and no ui.js line is needed (R-20261122-11, 1).
// It shows the rank, the open beat's choices, the ask for the next rank, and every remembered line. Every write goes through
// bonds/ledger.js and is saved by the strip's onAccount (the same save the keeper greeting uses).
// Bonds B2a (R-20261122-46): the type choice at Close, the promises he holds you to (with "Own the break" on a broken one),
// and his last no with the reason he gave. A refusal is saved like any write (it is recorded on the record).
// Bonds B2b (R-20261122-69, R-20261122-70): the pact in words once sworn ("Pact: sworn with Jatayu ...", no halves shown: the call
// and the vouch arrive with B4 and B6), the "Swear the pact" button while the pact talk is remembered and no pact stands, and
// Allied and Full Bond on the same ask button. The rank shows on the keeper chip (ledger.js chipText); no new chip.
//   mount(strip, { keeperId, getAccount(), setAccount(a), say(line), playerChar() }) → the panel, or null when the keeper has no route
//   (playerChar: the player's main class id, for his trust read; Bonds B2a)
//   toggle(strip, opts) opens or closes it; the open state is kept per keeper so a strip re-mount redraws it open.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ledger.js"));
  else root.ConceptCombatBondLedgerUI = factory(root.ConceptCombatBondLedger);
})(typeof self !== "undefined" ? self : this, function (BL) {
  const open = new Set();
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const button = (text, onclick) => { const b = el("button", "", text); b.type = "button"; b.onclick = onclick; return b; };

  // The title a remembered line is filed under: the beat's own title, or what the battle memory was.
  function memoryTitle(route, id, m) {
    const beat = route.beats.find((b) => `${id}:${b.id}` === m.id);
    if (beat) return beat.kind === "promise" ? `${beat.title}: kept` : beat.title;
    const pb = route.beats.find((b) => m.id.startsWith(`${id}:${b.id}:`));
    if (pb) return `${pb.title}: ${{ broken: "broken", owned: "you owned the break", repaired: "mended" }[m.id.slice(`${id}:${pb.id}:`.length)] || m.kind}`;
    if (m.kind === "battle") return route.battleTitle || "Fought beside you";
    return m.kind;
  }

  function render(panel, o) {
    const id = o.keeperId, route = BL.routeOf(id), account = o.getAccount(), rec = BL.recordOf(account, id);
    panel.replaceChildren();
    const rank = rec ? rec.rank : 0;
    panel.append(el("h3", "cc-bond-head", `Bonds · ${route.name} · ${BL.rankName(rank)}`));
    const act = (r) => { if (!r.ok && !r.refused) return; o.setAccount(r.account); if (r.line) o.say(r.line); render(panel, o); };
    if (rank < 1) {
      panel.append(el("p", "cc-muted", `You have not been introduced to ${route.name}.`));
      panel.append(button(route.intro.label, () => act(BL.introduce(o.getAccount(), id))));
      return panel;
    }
    const beat = BL.openBeat(account, id);
    if (beat) {
      const box = el("div", "cc-bond-beat");
      box.append(el("h4", "", beat.title), el("p", "", beat.prompt));
      const row = el("div", "cc-bond-choices");
      for (const c of beat.choices) { const b = button(c.label, () => act(BL.answer(o.getAccount(), id, beat.id, c.id, { playerChar: o.playerChar && o.playerChar() }))); b.dataset.choice = c.id; row.append(b); }
      box.append(row); panel.append(box);
    }
    if (rank >= 3 && route.types) {
      const box = el("div", "cc-bond-type");
      box.append(el("h4", "", rec.type ? `You are ${rec.type === "mentorship" ? "his student" : "friends"}` : route.typePrompt));
      const row = el("div", "cc-bond-choices");
      for (const t of route.types) { const b = button(t.label, () => act(BL.chooseType(o.getAccount(), id, t.id, { playerChar: o.playerChar && o.playerChar() }))); b.dataset.type = t.id; b.disabled = rec.type === t.id; row.append(b); }
      box.append(row); panel.append(box);
    }
    if (rec.pact) panel.append(el("p", "cc-bond-pact", `Pact: sworn with ${route.name}, in his own hand in the register.`));
    else if (BL.pactState(account, id).can) { const b = button(route.pact.label, () => act(BL.offerPact(o.getAccount(), id, { playerChar: o.playerChar && o.playerChar() }))); b.className = "cc-bond-swear"; panel.append(b); }
    if (rec.promises.length) {
      const list = el("ul", "cc-bond-promises");
      for (const p of rec.promises) {
        const li = el("li"); li.dataset.promise = p.id; li.dataset.state = p.state;
        li.append(el("b", "", { open: "Promised", kept: "Kept", broken: "Broken", repaired: "Mended" }[p.state] + ": "), el("span", "", p.text));
        if (p.state === "broken" && !p.owned) { const b = button("Own the break", () => act(BL.ownBreak(o.getAccount(), id, p.id))); b.className = "cc-bond-own"; li.append(" ", b); }
        else if (p.state === "broken") li.append(el("span", "cc-muted", " You owned it. Win a battle to mend it."));
        list.append(li);
      }
      panel.append(el("h4", "", "Promises"), list);
    }
    const st = BL.askState(account, id);
    if (st.can) { const b = button(`Ask to know ${route.name} better`, () => act(BL.ask(o.getAccount(), id, { playerChar: o.playerChar && o.playerChar() }))); b.className = "cc-bond-ask"; panel.append(b); }
    else if (st.why) panel.append(el("p", "cc-muted cc-bond-why", st.why));
    if (rec.refused) panel.append(el("p", "cc-bond-refused", `${route.name} said no: "${rec.refused.why}"`));
    const list = el("ol", "cc-bond-memories");
    for (const m of rec.memories) { const li = el("li"); li.dataset.memory = m.id; li.append(el("b", "", memoryTitle(route, id, m)), el("span", "", ` "${m.line}"`)); list.append(li); }
    panel.append(el("h4", "", "Remembered"));
    if (rec.memories.length) panel.append(list); else panel.append(el("p", "cc-muted", "Nothing yet."));
    return panel;
  }

  function mount(strip, o) {
    if (!strip || !BL || !BL.routeOf(o.keeperId)) return null;
    for (const old of strip.querySelectorAll(".cc-bond")) old.remove();
    if (!open.has(o.keeperId)) return null;
    const panel = el("section", "cc-bond"); panel.setAttribute("aria-label", `Bonds with ${BL.routeOf(o.keeperId).name}`);
    strip.append(panel);
    return render(panel, o);
  }
  function toggle(strip, o) {
    if (open.has(o.keeperId)) open.delete(o.keeperId); else open.add(o.keeperId);
    return mount(strip, o);
  }
  const isOpen = (id) => open.has(id);

  return { mount, toggle, isOpen };
});
