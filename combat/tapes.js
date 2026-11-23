"use strict";
// Fight Tapes FT1 (gemini-fight-tapes-coach-spec, Mala 2026-11-18 R-20261118-02, decisions R-20261118-03): every finished
// battle seals one Match Tape: the build it was fought on, the entering stat cards of every fighter (captured once, right
// after the battle is created), the ordered committed actions, what each side knew at the end, the AI's lessons, a box
// score with each fighter's unused kit, and the full R<round> log text. The tapes live in a ring of at most 20 and at most
// 900 KB under loci:combat:tapes:v1, travel in an exported save (save-file.js), and open in the Tapes drawer (tapes-drawer.js).
// Pure: no storage, no DOM. ui.js passes the engine, the state and the store; Node tests and tools call the same functions.
//
//   captureEntering(E, s)                       -> [card]   one stat card per actor present at the start
//   noteAction(rec, s, act)                     -> rec      appends { seq, round, actor, act } (rec = { actions: [] })
//   telemetry(s, cards, actions)                -> { byActor, unusedKit }
//   sealTape({ E, s, cards, actions, text, practice, scenario, build, now }) -> tape (v: 1)
//   addTape(list, tape, limits?)                -> new list, newest last: oldest dropped past 20 tapes or 900 KB
//   isTapeList(v) / isTape(v)                   -> the shape save-file.js and load() accept
//   load(store) / save(store, list)             -> read and write loci:combat:tapes:v1 (a failed write returns false)
//   formatTapeText(tape) / header(tape)         -> the readable tape: header, entering cards, box score, unused kit, log
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTapes = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const KEY = "loci:combat:tapes:v1";
  const LIMITS = { max: 20, maxBytes: 900000, maxTextBytes: 400000 };   // D1 (R-20261118-03): 20 tapes, 900 KB in all; one tape's text never takes half the ring
  const COPY = {
    empty: "No saved fight tapes yet — finish a battle to archive one.",
    button: "Tapes",
    open: "Open Tape",
  };
  const bytes = (v) => { const t = typeof v === "string" ? v : JSON.stringify(v); return typeof Buffer !== "undefined" && Buffer.byteLength ? Buffer.byteLength(t, "utf8") : new TextEncoder().encode(t).length; };
  const list = (v) => (Array.isArray(v) ? v.slice() : []);
  const plain = (v) => { try { return JSON.parse(JSON.stringify(v ?? null)); } catch { return null; } };

  function card(E, s, a) {
    let kit = [];
    try {
      kit = (E.availableAbilities(s, a.id) || []).map((x) => ({ id: x.id, name: x.m?.name || x.id, tier: x.m?.tier || null,
        cost: x.m?.cost ?? 0, tempoCost: x.m?.tempoCost ?? 0, range: x.m?.range ?? 0, delivery: x.m?.delivery || null, concept: x.m?.concept || null }));
    } catch { kit = []; }
    return {
      id: a.id, name: a.name || a.id, character: a.character || null, side: a.side || null, crew: a.crew || null,
      isSummon: !!(a.summon || a.summoned), isBoss: !!a.boss, notArrived: !!a.notArrived, spawn: [a.x, a.y],
      stats: { lf: a.lf, maxLF: a.maxLF, pf: a.pf, maxPF: a.maxPF, tempoCapacity: a.tempoCapacity, reaction: a.reaction ?? null, armor: a.armor ?? null },
      concepts: { primary: a.primary || null, secondary: a.secondary || null, reserve: plain(a.reserve) || [], lens: plain(a.lens) },
      traits: (a.traits || []).map((t) => (t && t.id) || t),
      kit,
      items: plain(a.inventory) || [],
      cards: { hand: a.hand?.length || 0, deck: a.deck?.length || 0 },
      vows: (a.vows || []).map((v) => v.id || v.name || null),
      injuries: plain(a.injuries) || null,
      tenant: a.tenant ? { id: a.tenant.id || null, coherence: a.tenant.coherence ?? null } : null,
      tandem: a.tandem ? { id: a.tandem.id || null, program: a.tandem.activeProgram || null } : null,
    };
  }
  function captureEntering(E, s) {
    return Object.values(s?.actors || {}).map((a) => card(E, s, a));
  }
  function noteAction(rec, s, act) {
    const r = rec && Array.isArray(rec.actions) ? rec : { actions: [] };
    r.actions.push({ seq: r.actions.length + 1, round: s?.round ?? null, actor: act?.actor ?? null, act: plain(act) });
    return r;
  }
  // The box score from the log (the same counts tools/telemetry.mjs extract keeps, the ones a tape reader asks first),
  // plus each fighter's unused kit: entering abilities it never committed.
  function telemetry(s, cards, actions) {
    const byActor = {};
    const of = (id) => (byActor[id] ||= { dealt: 0, taken: 0, kills: 0, deaths: 0, ults: 0, observes: 0, moves: 0 });
    const last = {};
    for (const e of s?.log || []) {
      const amt = typeof e.amount === "number" ? e.amount : 0;
      if (e.kind === "damage") { if (e.actor) of(e.actor).dealt += amt; if (e.target) { of(e.target).taken += amt; if (e.actor) last[e.target] = e.actor; } }
      else if (e.kind === "defeat" && e.target) { of(e.target).deaths += 1; if (last[e.target]) of(last[e.target]).kills += 1; }
      else if ((e.kind === "ultimate" || e.tier === "ultimate") && e.actor) of(e.actor).ults += 1;
      else if (e.kind === "observe" && e.actor) of(e.actor).observes += 1;
      else if (e.kind === "move" && e.actor && !e.forced) of(e.actor).moves += 1;
    }
    const used = {};
    for (const x of actions || []) { const a = x.act || x; if (!a?.actor) continue; const set = (used[a.actor] ||= new Set());
      if (a.type === "ability" && a.ability) set.add(a.ability); else if (a.type) set.add(a.type); }
    const unusedKit = {};
    for (const c of cards || []) { const u = used[c.id] || new Set(); const left = (c.kit || []).filter((k) => !u.has(k.id)).map((k) => k.id); if ((c.kit || []).length) unusedKit[c.id] = left; }
    return { byActor, unusedKit };
  }
  function clipText(text, max) {
    const t = String(text || "");
    if (bytes(t) <= max) return t;
    const lines = t.split("\n"), head = lines[0];
    let tail = [], size = bytes(head) + 64;
    for (let i = lines.length - 1; i > 0; i--) { const n = bytes(lines[i]) + 1; if (size + n > max) break; tail.unshift(lines[i]); size += n; }
    return [head, `… (${lines.length - 1 - tail.length} earlier lines cut to keep the tape under ${Math.round(max / 1000)} KB)`, ...tail].join("\n");
  }
  function sealTape({ E, s, cards, actions, text, practice = false, scenario = null, build = null, now = Date.now() } = {}) {
    const lessons = {};
    for (const id of Object.keys(s?.actors || {})) { try { lessons[id] = plain(E?.aiLessons?.(s, id)) || []; } catch { lessons[id] = []; } }
    const acts = (actions || []).map((x, i) => (x && x.act ? x : { seq: i + 1, round: null, actor: x?.actor ?? null, act: plain(x) }));
    return {
      v: 1,
      id: `${s?.seed ?? "x"}-${now}`,
      build: (s?.build && s.build !== "dev" ? s.build : build || s?.build) || "unknown",   // the page's engine says "dev"; version.js (ConceptCombatVersion, passed by ui.js) is the shipped build
      at: new Date(now).toISOString(),
      seed: s?.seed ?? null,
      mode: s?.mode || null,
      encounter: s?.encounter || null,
      scenario: scenario || null,
      arena: { id: s?.arena?.id || null, name: s?.arena?.name || null, biome: s?.arena?.biome || null },
      rounds: s?.round ?? null,
      outcome: plain(s?.outcome),
      practice: !!practice,
      cards: plain(cards) || [],
      actions: acts,
      knowledgeAtEnd: plain(s?.insight?.knowledge) || {},
      lessonsAtEnd: lessons,
      telemetry: telemetry(s, cards, acts),
      text: clipText(text, LIMITS.maxTextBytes),
    };
  }
  const arr = (x) => x === undefined || Array.isArray(x);
  const isCard = (c) => !!c && typeof c === "object" && !Array.isArray(c) && arr(c.kit) && arr(c.traits) && arr(c.items) && arr(c.vows) && (c.kit || []).every((k) => !!k && typeof k === "object");
  function isTape(v) {
    return !!v && typeof v === "object" && !Array.isArray(v) && v.v === 1 && typeof v.id === "string" && typeof v.build === "string"
      && Array.isArray(v.cards) && v.cards.every(isCard) && Array.isArray(v.actions) && typeof v.text === "string";
  }
  function isTapeList(v) {
    return Array.isArray(v) && v.length <= LIMITS.max && v.every(isTape) && bytes(v) <= LIMITS.maxBytes;
  }
  function addTape(prior, tape, limits = LIMITS) {
    const out = list(prior).filter(isTape);
    if (!isTape(tape)) return out;
    out.push(tape);
    while (out.length > limits.max) out.shift();
    while (out.length > 1 && bytes(out) > limits.maxBytes) out.shift();
    return out;
  }
  function load(store) {
    try { const v = store?.get?.(KEY); return Array.isArray(v) ? v.filter(isTape) : []; } catch { return []; }
  }
  function save(store, tapes) {
    try { return store.set(KEY, tapes) !== false; } catch { return false; }
  }
  // A draw is winner null with draw true (Heart Court, engine/living-map.js) or winner "none" (the round limit).
  const winnerOf = (t) => { const o = t.outcome; if (!o) return "none"; if (typeof o === "string") return o; return o.draw || o.winner == null ? "draw" : String(o.winner); };
  function header(t) {
    const where = t.scenario || t.encounter || t.mode || "battle";
    return `Tape: v${t.build} · ${where} · ${winnerOf(t)} (R${t.rounds ?? "?"})${t.practice ? " · Practice" : ""}`;
  }
  function formatTapeText(t) {
    const out = [header(t), `Seed ${t.seed ?? "?"} · ${t.arena?.name || "?"} · ${t.at}`, "", "Entering stat cards:"];
    for (const c of t.cards || []) {
      const st = c.stats || {};
      out.push(`- ${c.name} (${c.character || "?"}, ${c.side || "?"}${c.isSummon ? ", summon" : ""}${c.isBoss ? ", boss" : ""}${c.notArrived ? ", arrives later" : ""}): LF ${st.lf}/${st.maxLF}, ΦF ${st.pf}/${st.maxPF}, AP ${st.tempoCapacity}`);
      out.push(`    concepts ${c.concepts?.primary || "-"} + ${c.concepts?.secondary || "-"}${(c.traits || []).length ? ` · traits ${c.traits.join(", ")}` : ""}`);
      if ((c.kit || []).length) out.push(`    kit ${c.kit.map((k) => `${k.name} (${k.cost} ΦF, ${k.tempoCost} AP, range ${k.range})`).join("; ")}`);
      if ((c.items || []).length) out.push(`    items ${c.items.map((i) => (i && (i.name || i.id)) || i).join(", ")}`);
    }
    out.push("", "Box score:");
    for (const [id, b] of Object.entries(t.telemetry?.byActor || {})) out.push(`- ${id}: dealt ${b.dealt}, taken ${b.taken}, kills ${b.kills}, deaths ${b.deaths}`);
    out.push("", "Unused kit:");
    for (const [id, left] of Object.entries(t.telemetry?.unusedKit || {})) out.push(`- ${id}: ${left.length ? left.join(", ") : "used everything"}`);
    out.push("", t.text || "");
    return out.join("\n");
  }
  return { KEY, LIMITS, COPY, winnerOf, captureEntering, noteAction, telemetry, sealTape, addTape, isTape, isTapeList, load, save, header, formatTapeText };
});
