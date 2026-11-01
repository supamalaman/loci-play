"use strict";
// Cultural legacy, wired (Mala, 2026-10-20: "lets wire everything in"; Muse's legacy.js + technique-parts.js). The glue
// between a battle and the account's legacy: what a battle showed (report), which traditions it performed (settle), what
// the next battle carries (carry), and the parts and scribed techniques the Magistrate's Codex works with. Pure.
//
//   legacy (account.legacy) = { ledger, journal, memory, parts: [part], scribed: [def], practice: {techId: n} }
//   report(s, heroId)                → { uses, sequences, witnesses, successionClaim }
//   settle(legacy, s, ctx)           → { legacy, lines, offers }   battle end: invoke, decay, notes, founding offers
//   found(legacy, offer, ctx)        → { ok, legacy, tradition }   the reward screen's button (the caller spends Inspiration)
//   carry(legacy)                    → { bonuses, memory, scribed, battle }   into E.create({ legacy })
//   partsOf(id, C)                   → parts | null   (boss moves: { ..., boss: true, minStrength: 6 })
//   disassemble / assemble / memorizeStudy / buyBook / donate / revive: the Codex screen's verbs
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./legacy.js"), require("./technique-parts.js"), require("../bosses/boss-data.js"));
  else root.ConceptCombatLegacyBattle = factory(root.ConceptCombatLegacy, root.ConceptCombatTechniqueParts, root.ConceptCombatBossData);
})(typeof self !== "undefined" ? self : this, function (L, TP, BD) {
  const MEMORIZE_AT = 2;          // practice to memorize: a finished study is 1, a book +1, every 3 more notes +1
  const BOSS_STRENGTH = 6;        // boss arts scribe only with a legendary tradition (6+; Mala, 2026-10-20)
  const BOOK_PRICE = { drill: 30, restricted: 60, sealed: 120 };
  // Riders a scribed technique can carry today (the rest of the vocabulary is descriptive until the engine grows them).
  const RIDERS = { knockback: { knockback: 1 }, "spread:radius": { area: { shape: "radius", radius: 1 } }, "spread:line": { area: { shape: "line", length: 3 } } };
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function fresh(legacy) {
    const l = legacy && typeof legacy === "object" ? clone(legacy) : {};
    l.ledger ||= L.createLedger(); l.journal ||= L.createJournal(); l.memory ||= L.createMemory();
    l.parts ||= []; l.scribed ||= []; l.practice ||= {}; l.findingNotebook ||= [];
    return l;
  }

  // What the hero's battle showed: techniques that landed, two-technique turns, who saw it, a boss form learned.
  function report(s, heroId = "player", { successionClaim = null } = {}) {
    const hero = s.actors?.[heroId]; const uses = {}, seq = {};
    let lastTurn = null, prev = null;
    for (const e of s.log || []) {
      if (e.kind === "damage" && e.actor === heroId && e.ability && e.ability !== "strike" && (e.amount || 0) > 0) uses[e.ability] = (uses[e.ability] || 0) + 1;
      if (e.kind === "act" && e.actor === heroId && e.ability && e.ability !== "strike") {
        const turn = `${e.round}:${e.turn}`;
        if (turn === lastTurn && prev && prev !== e.ability) { const k = `${prev}>${e.ability}`; seq[k] = (seq[k] || 0) + 1; }
        lastTurn = turn; prev = e.ability;
      }
    }
    const witnesses = Object.values(s.actors || {}).filter((u) => u.id !== heroId && hero && u.side === hero.side && !u.defeated && !u.escaped && !u.notArrived).map((u) => u.id);
    return { uses, sequences: Object.entries(seq).map(([key, wins]) => ({ key, wins })), witnesses, successionClaim };
  }

  const samePattern = (a, b) => JSON.stringify({ technique: a.technique, sequence: a.sequence, lineOf: a.lineOf }) === JSON.stringify({ technique: b.technique, sequence: b.sequence, lineOf: b.lineOf });
  function performed(t, rep) {
    const p = t.pattern || {};
    if (p.technique) return (rep.uses[p.technique] || 0) > 0;
    if (p.sequence) return rep.sequences.some((x) => x.key === p.sequence);
    if (p.lineOf) return rep.successionClaim === p.lineOf;
    return false;
  }

  // Battle end. ctx: { battle, hero, heroName, successionClaim, real }.
  function settle(legacy, s, ctx = {}) {
    const l = fresh(legacy), lines = [], battle = ctx.battle || `b${s.seed}`;
    const rep = report(s, ctx.hero || "player", { successionClaim: ctx.successionClaim || null });
    for (const t of l.ledger.traditions) if (performed(t, rep)) {
      const before = t.strength; L.invokeTradition(l.ledger, t.id, { battle, by: ctx.hero || "player", success: true });
      if (t.strength > before) lines.push(`${t.name} grows (${L.traditionBonus(t).tier}, ${t.strength}).`);
    }
    L.endBattle(l.ledger, battle);
    for(const n of s.findingNotes||[])if(!l.findingNotebook.some(f=>f.id===n.id&&f.battle===battle)) {
      l.findingNotebook.push({...clone(n),battle});
      lines.push(`Field note preserved: ${n.text}`);
    }
    for (const n of s.journalNotes || []) {
      const r = L.addNote(l.journal, n.technique, n.quality || 1);
      if (r.complete) { l.practice[n.technique] = Math.max(l.practice[n.technique] || 0, r.practice); }
      lines.push(r.complete ? `Journal: your study of ${n.name || n.technique} is complete.` : `Journal: a note on ${n.name || n.technique} (${r.notes}/${L.JOURNAL_NOTES}).`);
    }
    const offers = L.foundingOpportunities(rep).filter((o) => !l.ledger.traditions.some((t) => samePattern(t.pattern, o.pattern)))
      .map((o) => ({ ...o, name: nameFor(o, ctx.heroName || "you", ctx.C) }));
    return { legacy: l, lines, offers };
  }
  function nameFor(o, founder, C) {
    const n = (id) => C?.abilities?.[id]?.name || id;
    if (o.kind === "technique") return `The ${n(o.pattern.technique)} of ${founder}`;
    if (o.kind === "sequence") { const [a, b] = o.pattern.sequence.split(">"); return `${founder}'s Answer: ${n(a)}, then ${n(b)}`; }
    return `The Line of ${o.pattern.lineOf}`;
  }
  function found(legacy, offer, ctx = {}) {
    const l = fresh(legacy);
    const r = L.foundTradition(l.ledger, offer, { name: offer.name, founder: ctx.heroName || "you", battle: ctx.battle || null });
    return r.ok ? { ok: true, legacy: l, tradition: r.tradition } : { ok: false, error: r.error, legacy: l };
  }

  // A tradition helps its own techniques: its tier's control (fewer AP) and charge discount (fewer ΦF). A dead one
  // (decayed to 0 after it had grown) gives nothing until revived.
  const alive = (t) => t.strength > 0 || !t.invocations.some((iv) => iv.success);
  function bonuses(legacy) {
    const out = {};
    for (const t of fresh(legacy).ledger.traditions) {
      if (!alive(t)) continue;
      const b = L.traditionBonus(t), ids = t.pattern?.technique ? [t.pattern.technique] : t.pattern?.sequence ? t.pattern.sequence.split(">") : [];
      for (const id of ids) { const was = out[id]; if (!was || was.chargeDiscount < b.chargeDiscount) out[id] = { control: b.control, chargeDiscount: b.chargeDiscount, tradition: t.name, tier: b.tier }; }
    }
    return out;
  }
  function carry(legacy, { battle = null } = {}) {
    const l = fresh(legacy);
    return { bonuses: bonuses(l), memory: l.memory.held.slice(), scribed: l.scribed.filter((d) => l.memory.held.includes(d.id)).map((d) => ({ id: d.id, ability: abilityOf(d) })), battle };
  }

  // ── The Codex: parts, scribing, memory, books, donation ──
  const bossKey = (id) => { const m = /^boss_([a-z_]+?)_([A-Za-z]+)$/.exec(id || ""); return m ? { boss: m[1], key: m[2] } : null; };
  function partsOf(id, C) {
    const bk = bossKey(id), key = bk ? bk.key : id;
    const def = C?.abilities?.[id] || (bk ? bossAbility(C, bk) : null);
    const p = TP.resolveParts(def, key); if (!p) return null;
    return { ...p, source: id, sourceName: def?.name || id, ...(bk ? { boss: true, minStrength: BOSS_STRENGTH } : {}) };
  }
  // Boss data is read lazily: the pages load boss-data.js after this file.
  function bossAbility(C, bk) { const B = (BD || globalThis.ConceptCombatBossData)?.bosses?.[bk.boss] || null; return B ? (B.abilities?.[bk.key] || B.enragedUnlocks?.[bk.key] || null) : null; }
  const legendary = (l) => l.ledger.traditions.some((t) => t.strength >= BOSS_STRENGTH);
  const memorizable = (id, C) => !unmemorizableWhy(id, C);
  // Why a study can never be held (the Codex shows this instead of a dead end).
  function unmemorizableWhy(id, C) {
    if (bossKey(id)) return "boss art is never held";
    if (!C?.abilities?.[id]) return "unknown technique";
    if (C.abilities[id].formOnly) return "form-only";
    if (C.abilities[id].merge) return "merged technique";
    if (TP.PARTS[id]?.requires) return "sealed art";
    return null;
  }

  // Disassemble a memorized technique (it leaves memory: the notebook copy is consumed), or a finished study of a boss
  // move once you hold a legendary tradition.
  function disassemble(legacy, id, C) {
    const l = fresh(legacy), parts = partsOf(id, C);
    if (!parts) return { ok: false, error: "It resists analysis: no parts are known for it yet.", legacy: l };
    if (l.parts.some(p => p.source === id)) return { ok: false, error: "You already have unspent parts from this technique. Use those before taking it apart again.", legacy: l };
    if (parts.boss) {
      if (!l.journal.studies[id]?.complete) return { ok: false, error: "Finish a study of the boss's move first.", legacy: l };
      if (!legendary(l)) return { ok: false, error: `Boss arts need a legendary tradition (strength ${BOSS_STRENGTH}+).`, legacy: l };
    } else if (!l.memory.held.includes(id)) return { ok: false, error: "Only a memorized technique can be taken apart.", legacy: l };
    l.memory.held = l.memory.held.filter((x) => x !== id); l.memory.forgotten[id] = true;
    let serial = 1; while(l.parts.some(p => p.id === `part-${serial}-${id}`)) serial++;
    l.parts.push({ id: `part-${serial}-${id}`, ...parts });
    return { ok: true, legacy: l, parts };
  }
  // An engine ability for a scribed technique (registered into C.abilities by the engine at battle start).
  // The pre-workshop branch below stays for ancient scribed defs in old saves; the desk that made them is gone.
  function abilityOf(def) {
    if (def.workshop && def.workshopAbility) return clone(def.workshopAbility);
    const extra = Object.assign({}, ...(def.riders || []).map((r) => RIDERS[r] || {}));
    const self = def.delivery === "field" || def.delivery === "self";
    return { name: def.name, tier: def.tier, concepts: def.concepts.slice(), delivery: def.delivery, target: self ? "self" : "enemy",
      area: extra.area || (self ? { shape: "radius", radius: 2 } : { shape: "single" }), cost: def.cost, tempoCost: def.ap, range: self ? 0 : Math.max(1, Number(def.range) || 4),
      potency: def.potency, damageType: def.damageType || "nigredo", effect: "damage", scribed: true, ...(def.delivery === "routed" ? { routeBudget: Math.max(2, Number(def.range) || 4) } : {}), ...(extra.knockback ? { knockback: extra.knockback } : {}),
      mechanism: `Scribed from ${(def.provenance || []).join(", ") || "parts"}.`, reveal: `${def.name} is a scribed work.`, prompt: "What did you build it from?" };
  }
  function memorizeStudy(legacy, id, C) {
    const l = fresh(legacy);
    if (!memorizable(id, C)) return { ok: false, error: "That technique can't be held in memory.", legacy: l };
    const r = L.memorize(l.memory, id, l.practice[id] || 0, MEMORIZE_AT);
    return r.ok ? { ok: true, legacy: l, evicted: r.evicted } : { ok: false, error: `Needs practice ${r.need} (has ${l.practice[id] || 0}): finish a study and read a book, or study it twice.`, legacy: l };
  }
  function buyBook(legacy, book) {
    const l = fresh(legacy); l.practice[book.technique] = (l.practice[book.technique] || 0) + 1;
    return { legacy: l, price: BOOK_PRICE[book.tier] || BOOK_PRICE.drill };
  }
  function donate(legacy, id) {
    const l = fresh(legacy), st = l.journal.studies[id];
    if (!st?.complete) return { ok: false, error: "Only a finished study can be donated.", legacy: l };
    L.donateStudy(l.ledger, { technique: id, quality: 1 }); st.donated = true;
    return { ok: true, legacy: l, favor: l.ledger.favor };
  }
  function revive(legacy, id) { const l = fresh(legacy); const r = L.reviveTradition(l.ledger, id); return { ...r, legacy: l }; }
  const shop = (legacy, seed) => L.generateShop(fresh(legacy).ledger, { seed, slots: 3 }).map((b) => ({ ...b, price: BOOK_PRICE[b.tier] || BOOK_PRICE.drill }));

  return { MEMORIZE_AT, BOSS_STRENGTH, BOOK_PRICE, RIDERS, fresh, report, settle, found, bonuses, carry, partsOf, disassemble, abilityOf,
    memorizeStudy, buyBook, donate, revive, shop, alive, legendary, memorizable, unmemorizableWhy };
});
