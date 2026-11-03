"use strict";
// Hover card: everything the VIEWER knows about a unit on the field, and nothing they don't (Mala, 2026-10-08:
// "when I scroll over a character on the field it doesn't give me the data I know about them").
// Pure: reads engine state, never changes it. ui.js tipFor() renders html(knownCard(...)) under the tile line.
//
//   knownCard(s, targetId, { viewer, content, insight, monsters }) → { title, subtitle, sections: [{ label, items: [text] }], hidden, hint }
//   html(card, esc)                                                  → HTML string for the tooltip
//   windowHtml(card, esc)                                            → HTML for the click-to-open unit window (same knowledge,
//                                                                      laid out as a panel: bars, sections, locked rows, intent slot)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../status-presentation.js"));
  else root.ConceptCombatHover = factory(root.ConceptCombatStatus);
})(typeof self !== "undefined" ? self : this, function (Status) {
  const KIND = { trait: "Traits", tell: "Tells", weakness: "Weaknesses", state: "Right now", realization: "Realizations", teaching: "What it embodies", contradiction: "Contradictions", key: "Keys" };
  const TROW = { psychology: "Psychological", biology: "Biological", values: "Values", spiritual: "Spiritual" };


  function sideLabel(t, viewerSide, stance) {
    if (t.kind === "dreamMonster" || t.dream) return "dream";
    if (t.side === "wild") return "wild";
    if (t.side === "bystander" || t.category === "bystander") return "bystander";   // the Tourist (Mala, 2026-10-17: labelled ENEMY)
    if (stance === "ally" || stance === "enemy" || stance === "neutral") return stance;
    return t.side === viewerSide ? "ally" : "enemy";
  }
  const sideName = (side) => side === "player" ? "your side" : side === "enemy" ? "the opposing side" : `the ${side} side`;

  // A wild animal on the field (s.wild, not an actor): everything here is public (Muse, Mala asked 2026-10-15: wilds need
  // cards like people). Its numbers come from wild/monsters-data.js; its intent is the telegraph everyone can see.
  function wildCard(s, m, data, content) {
    const d = data?.[m.kind] || {}, cname = (c) => content?.concepts?.[c]?.name || c, sections = [], add = (label, items) => { items = items.filter(Boolean); if (items.length) sections.push({ label, items }); };
    const tele = (s.wildTelegraphs || []).find((x) => x.id === m.id);
    add("Condition", [m.lf != null ? `LF ${m.lf}/${m.maxLF}` : null, m.curled ? "Curled up" : null, m.fleeing ? `Leaving: ${m.fleeing}` : null]);
    add("What it is", [d.sci ? `${d.sci}` : null, d.basis || null, d.concept ? `Concept: ${cname(d.concept)}` : null]);
    add("Counter", [(d.counters || []).map(cname).join(", ") || null, d.teaches ? `Teaches: ${d.teaches}` : null]);
    return { title: m.name || d.name || m.kind, subtitle: "Wild · hostile to everyone", sections, hidden: 0, hint: "", id: m.id, statuses: [], otherConditions: [],
      vitals: { lf: m.lf ?? null, maxLF: m.maxLF ?? null, pf: null, maxPF: null, ultimate: null }, defeated: !(m.lf > 0), intent: tele?.text || null, noticed: 0, hasDeck: false, wild: true };
  }
  function knownCard(s, targetId, { viewer = "player", content = null, insight = null, monsters = null, wild = null, stance = null, hostileSides = null } = {}) {
    const t = s.actors?.[targetId];
    if (!t) { const m = (s.wild || []).find((w) => w.id === targetId && w.form === "unit"); return m ? wildCard(s, m, wild, content) : null; }
    const me = s.actors?.[viewer], sections = [], add = (label, items) => { items = items.filter(Boolean); if (items.length) sections.push({ label, items }); };
    const ab = (id) => content?.abilities?.[id];
    const cname = (c) => content?.concepts?.[c]?.name || c;

    // Public: what anyone on the field can see.
    const vitals = [`LF ${t.lf}/${t.maxLF}`];
    if (t.pf != null) vitals.push(`ΦF ${t.pf}`);
    if (t.ultimateCharge != null && t.id !== viewer) vitals.push(`ultimate ${Math.round(t.ultimateCharge)}%`);
    const conds = [];
    const statusRows = Status.rows(t, { showParry: t.side === me?.side || !!s.disclosures?.[t.id]?.rebound, showAmbush: t.side === me?.side, actors: s.actors, content });
    conds.push(...statusRows.map(r => `${r.name}${r.detail ? ` · ${r.detail}` : ""}${!r.icon && r.help ? ` (${r.help})` : ""}`));
    const otherConds = [];
    for (const k of Object.keys(t.conditions || {})) otherConds.push(k === "enraged" ? "ENRAGED (tougher, new moves)" : k);
    if (t.persuaded) otherConds.push("Came to terms (out of the fight)");   // Parley
    else if (t.standDownUntil && t.standDownUntil >= s.round) otherConds.push("Standing down (you can try to come to terms)");
    if (t.distracted && t.distracted.until >= s.round) otherConds.push(`Distracted by ${s.actors[t.distracted.by]?.name || "someone"}`);
    if (t.gaiaForm) otherConds.push(t.gaiaForm === "restored" ? "The Living Accord (ally)" : "The Wounded Ground");
    if (t.form?.name) otherConds.push(`Form: ${t.form.name}${t.form.turnsLeft ? ` (${t.form.turnsLeft} turns)` : ""}`);
    add("Condition", [vitals.join(" · "), conds.join(", "), otherConds.join(", ")]);

    // Discernment: your banked damage bonus against this target (observation.js credit()).
    const disc = s.discernment?.[viewer]?.[targetId]?.length || 0;
    if (disc) add("Discernment", [`+${disc * 5}% direct damage (${disc} ${disc === 1 ? "discovery" : "discoveries"})`]);

    // Classic monsters: their folklore is common knowledge (concept, passive, drawback).
    const md = t.monster && monsters?.monsters?.[t.monster];
    if (md) add("Folklore", [`${cname(md.concept)} · ${md.passive.name}: ${md.passive.text}`, `Drawback · ${md.drawback.name}: ${md.drawback.text}`]);

    // Concepts you've seen it use, and techniques: seen in action, and whether their workings are revealed.
    const seen = (s.observedAbilities?.[viewer] || []).filter((id) => {
      const a = ab(id); if (!a) return false;
      return (s.log || []).some((e) => e.kind === "act" && e.actor === t.id && e.ability === id) || (t.abilities || []).includes(id)
        || [t.primary, t.secondary, ...(t.reserve || [])].some((c) => a.concepts?.includes(c));
    });
    const disclosed = s.disclosures?.[t.id] || {};
    add("Techniques seen", seen.map((id) => `${ab(id).name} (${cname(ab(id).concepts?.[0])}, ${ab(id).delivery})${disclosed[id] ? " · revealed" : ""}`));
    const usedConcepts = [...new Set(seen.flatMap((id) => ab(id).concepts || []))];
    if (usedConcepts.length) add("Concepts", [usedConcepts.map(cname).join(", ")]);

    // AGI Takeoff ledger: public — the adaptation is visible on the field (tiers in damage.js).
    if (t.takeoff) {
      const tk = t.takeoff;
      const lines = Object.entries(tk.exp).map(([k, n]) => {
        const m = n >= 5 ? (k === "strike" ? 0.2 : 0) : n === 0 ? 1 : n <= 2 ? 0.6 : 0.35;
        return `${cname(k)}: seen ${n}×, resist ${Math.round((1 - m) * 100)}%`;
      });
      lines.push(`Takeoff +${(t.ownerTurns || 0) * (tk.completed ? 2 : 1)}${tk.transcended ? " · TRANSCENDED" : ""}${tk.completed ? " · COMPLETE" : ""}`);
      add("Adaptation ledger", lines);
    }

    // Insight: only revealed observations.
    const deck = s.insight?.decks?.[t.id], know = s.insight?.knowledge?.[viewer]?.[t.id];
    let hidden = 0, onlyDeep = false;   // onlyDeep: what is left unnoticed is all deep (Observe cannot reach it; Investigate can)
    // Yourself (Muse, Mala's screenshot 2026-10-15): not a stranger. What you know about yourself, and how much you do not
    // (Observe Self finds it); your own observation deck is what others can learn about you, not a list of locks for you.
    const self = t.id === viewer && s.self?.traits ? s.self.traits : null;
    const catOf = (id) => insight?.data?.traits?.[id]?.category || null;
    const traitRows = (items) => {   // Psychological / Biological / Values; anything uncategorized keeps the old Traits row
      const byCat = {};
      for (const it of items) (byCat[catOf(it.id)] ||= []).push(it.text);
      for (const [cat, label] of Object.entries(TROW)) add(label, byCat[cat] || []);
      add("Traits", (byCat.null || []).concat(Object.entries(byCat).filter(([c]) => c !== "null" && !TROW[c]).flatMap(([, v]) => v)));
    };
    // Imitated traits (Mala, 2026-10-17: "imitated traits should be in the menu as well"). Taking one on is logged in
    // the open, so anyone's card shows it; copies carried in from earlier battles are only known to yourself.
    const tname = (id) => insight?.data?.traits?.[id]?.name || id;
    const imitated = (s.imitated || []).filter((e) => e.actor === t.id)
      .map((e) => ({ id: e.trait, text: `${tname(e.trait)} (imitated from ${s.actors?.[e.from]?.name || "someone"})` }));
    if (self) for (const id of s.imitation?.carried || []) if (!imitated.some((e) => e.id === id)) imitated.push({ id, text: `${tname(id)} (imitated, carried in)` });
    if (self) {
      // Your own traits read in the same rows as anyone else's (Mala, 2026-10-17: the self card was one flat list). The
      // self catalog's own ids map to the trait list where they can (proudSelf → proud); the rest are psychology unless
      // the catalog says otherwise.
      const T = insight?.data?.traits || {}, catalog = insight?.data?.self?.catalog || [];
      const selfCat = (tr) => tr.category || catalog.find((x) => x.id === tr.id)?.category || T[tr.id]?.category || T[String(tr.id).replace(/Self$/, "")]?.category || "psychology";
      const name = (tr) => T[tr.id]?.name || tr.name || tr.id;
      const known = self.filter((tr) => tr.known).map((tr) => ({ cat: selfCat(tr), text: `${name(tr)}${tr.apparent ? "" : " (hidden from others)"}` }));
      const byCat = {};
      for (const it of [...known, ...imitated.map((e) => ({ cat: catOf(e.id) || "psychology", text: e.text }))]) (byCat[it.cat] ||= []).push(it.text);
      for (const [cat, label] of Object.entries(TROW)) add(label, byCat[cat] || []);
      add("Traits", Object.entries(byCat).filter(([c]) => !TROW[c]).flatMap(([, v]) => v));
      hidden = self.filter((tr) => !tr.known).length;
    } else if (deck) {
      const seer = insight?.seesSpirits ? insight.seesSpirits(me) : false;
      const visible = deck.cards.filter((c) => !c.spiritual || seer);
      const revealed = visible.filter((c) => know?.revealed?.includes(c.id) || (!know && c.open));
      hidden = visible.length - revealed.length;
      onlyDeep = hidden > 0 && visible.every((c) => c.deep || revealed.includes(c));
      for (const kind of Object.keys(KIND)) {
        if (kind === "trait") continue;
        add(KIND[kind], revealed.filter((c) => c.kind === kind).map((c) => {
          if (c.kind === "weakness" && c.channel) return `${c.text} (${content?.damageTypes?.[c.channel]?.name || c.channel})`;
          if (c.kind === "key") {   // Boss keys: live-or-not + lever, so the card reads as instructions
            const live = insight?.keyLive ? insight.keyLive(s, t.id, c) : true;
            return `${live ? "● LIVE" : "○ dormant"} — ${c.tell || c.text}${c.lever ? ` → ${c.lever}` : ""}`;
          }
          return c.text;
        }));
      }
      traitRows([...revealed.filter((c) => c.kind === "trait").map((c) => ({ id: c.trait, text: c.text })), ...imitated]);
      const receipts=Object.entries(s.findings?.holders?.[viewer]||{}).filter(([id,r])=>r.method==="report"&&s.findings.facts[id]?.subject===t.id);
      if(receipts.length)add("Sources",[...new Set(receipts.map(([,r])=>`Reported by ${s.actors[r.via]?.name||r.via}`))]);
      const unlocks = [...new Set(revealed.flatMap((c) => c.unlocks || []))].map((a) => insight?.data?.actions?.[a]?.name || a);
      if (unlocks.length) add("You can", unlocks);
    }
    if (t.revealedIntent) add("Likely next", [t.revealedIntent]);
    if (t.order && s && s.round <= t.order.until) add("Under orders", [`${t.order.role[0].toUpperCase() + t.order.role.slice(1)}${t.order.focus && s.actors?.[t.order.focus] ? ` ▸ ${s.actors[t.order.focus].name}` : ""} (from ${s.actors?.[t.order.by]?.name || "the field"}, ${t.order.until - s.round + 1} rounds left)`]);

    const side = me ? sideLabel(t, me.side, stance) : t.side;
    if (side === "neutral") add("Hostile toward", [(hostileSides || []).map(sideName).join(", ") || "no one"]);
    const hint = self ? (hidden > 0 ? `${hidden} thing${hidden === 1 ? "" : "s"} about yourself you don't know yet. Observe Self to learn more.` : "You know yourself.") : deck && hidden > 0 ? `${hidden} thing${hidden === 1 ? "" : "s"} you haven't noticed yet${know?.progress ? ` · ${know.progress} insight carried over` : ""}. ${onlyDeep ? "There is more here than looking will show." : "Observe to learn more."}`
      : deck ? "You've noticed everything there is to notice." : "";
    // Structured public vitals for the unit window's bars. Everything here is already public above.
    const vitalsData = { lf: t.lf, maxLF: t.maxLF, pf: t.pf ?? null, maxPF: t.maxPF ?? null,
      ultimate: t.ultimateCharge != null && t.id !== viewer && t.side !== "bystander" ? Math.round(t.ultimateCharge) : null };
    return { title: t.name, subtitle: side, sections, hidden, hint,
      id: t.id, statuses: statusRows, otherConditions: otherConds, vitals: vitalsData, defeated: !!t.defeated, intent: t.revealedIntent || (self && t.controller !== "ai" ? "Yours to decide." : null), noticed: deck ? deck.cards.length - hidden : 0, hasDeck: !!deck };
  }

  // The unit window (Mala, 2026-10-10): click a unit to keep what you know about it on screen. It shows exactly what
  // knownCard returns and nothing else: an unobserved trait is a locked row with a count, never its text. The Intent
  // row is always present so a later enemy-intent display has a home; until something reveals intent it says so.
  function windowHtml(card, esc = (x) => String(x)) {
    if (!card) return "";
    const v = card.vitals || {}, pct = (n, d) => Math.max(0, Math.min(100, d ? Math.round(100 * n / d) : 0));
    const bar = (label, cls, n, d) => d ? `<div class="cc-ui-bar"><span class="cc-ui-lbl">${label}</span><span class="cc-ui-track"><i class="${cls}" style="width:${pct(n, d)}%"></i></span><span class="cc-ui-num">${esc(n)}/${esc(d)}</span></div>` : "";
    // Public statuses have their own rows; retain forms and other conditions without repeating the bars.
    const sections = card.sections.map((sec) => sec.label === "Condition" ? { label: "Condition", items: (card.otherConditions || []) } : sec)
      .filter((sec) => sec.label !== "Likely next" && sec.items.length);
    const locked = card.hidden > 0 ? `<div class="cc-ui-sec cc-ui-locked"><span class="cc-ui-label">Not yet noticed</span><div class="cc-ui-locks">${
      Array.from({ length: Math.min(card.hidden, 6) }, () => `<span class="cc-ui-lock" aria-hidden="true">?</span>`).join("")}${
      card.hidden > 6 ? `<span class="cc-ui-more">+${card.hidden - 6}</span>` : ""}</div><div class="cc-ui-hint">${esc(card.hint)}</div></div>`
      : card.hasDeck ? `<div class="cc-ui-sec"><div class="cc-ui-hint">${esc(card.hint)}</div></div>` : "";
    return `<header class="cc-ui-head"><div><h3>${esc(card.title)}</h3><span class="cc-ui-side cc-ui-${esc(card.subtitle)}">${esc(card.subtitle)}${card.defeated ? " · defeated" : ""}</span></div>` +
      `<button type="button" class="cc-ui-close" data-unitinfo-close aria-label="Close unit window" title="Close (Esc)">×</button></header>` +
      `<div class="cc-ui-vitals">${bar("LF", "lf", v.lf, v.maxLF)}${bar("ΦF", "pf", v.pf, v.maxPF)}${v.ultimate != null ? bar("ULT", "ult", v.ultimate, 100) : ""}</div>` +
      Status.html(card.statuses, esc, card.id) +
      `<div class="cc-ui-sec cc-ui-intent"><span class="cc-ui-label">Intent</span><div>${card.intent ? esc(card.intent) : `<span class="cc-ui-unknown">Not known. Observe or read a tell to learn what it will do.</span>`}</div></div>` +
      sections.map((sec) => `<div class="cc-ui-sec"><span class="cc-ui-label">${esc(sec.label)}</span>${sec.items.map((i) => `<div>${esc(i)}</div>`).join("")}</div>`).join("") +
      locked;
  }

  function html(card, esc = (x) => String(x)) {
    if (!card) return "";
    return `<div class="cc-hovercard"><b>${esc(card.title)}</b> <span class="cc-muted">· ${esc(card.subtitle)}</span>` +
      card.sections.map((sec) => `<div class="cc-hc-sec"><span class="cc-hc-label">${esc(sec.label)}</span>${sec.items.map((i) => `<div>${esc(i)}</div>`).join("")}</div>`).join("") +
      (card.hint ? `<div class="cc-muted cc-hc-hint">${esc(card.hint)}</div>` : "") + `</div>`;
  }

  return { knownCard, html, windowHtml };
});
