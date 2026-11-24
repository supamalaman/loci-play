"use strict";
// Bonds B1 (claude-bonds-spec sections 1.1 to 1.3, R-20261114-39, R-20261122-11): the bond ledger on the account.
//   account.bonds[characterId] = { rank, type, memories, promises, pact, rankAt, refused }   (spec 1.1; no affection number)
// Pure: every function takes an account and returns a new one; nothing here draws from a random source or touches a battle.
// B1 builds ranks 0 to 2: the introduction sets Acquainted (1) and writes no memory; Familiar (2) needs one memory and an ask.
// The credit rule: one credit per memory id, ever (spec 1.2). The pace rule: a rank rises at most once per town cycle, on the
// account.battles clock keeper memory already uses (account/keepers.js lastAt; spec 1.3, Decision 9).
// Bonds B2a (R-20261122-46, R-20261122-47): Close (rank 3) needs two memories of different kinds; at Close the bond takes a
// type (friendship or mentorship, the ones the route allows) by an explicit choice. A promise beat opens at its own rank (the
// confidence at Familiar, R-20261122-47 1) and is checked when the next battle settles (settlePromises, called by awardBattle).
// A broken promise is a memory of its own and is repaired only by its own act: own the break in a talk, then pass the same
// check. He says no (refusalOf) while a promise to him is broken and unrepaired, or while his trust toward the player's unit is
// below zero (spirit/orders.js trust, keyed `<orderer character>>id`). The player's unit is the main class in random battles
// (engine.js create: opts.mainCharacter, which ui.js passes as mainClass()) and "warden" where a mode fixes it (engine.js
// firstWall, modes/boss-rush.js), so both keys are read: "warden" and opts.playerChar (the strip passes the saved main class). A no keeps the
// rank and is recorded in `refused`. The valence source reads ranks in battle (factions.js).
// Bonds B2b (R-20261122-46, R-20261122-69, R-20261122-70): Allied (rank 4) needs three memories of two kinds and a pact both
// accept; Full Bond (rank 5) needs four memories, one of them `battle`, `promise` or `hearing`, and his yes. Beat 5, the pact,
// opens at Close and is a talk (the third memory); a choice with `pact` offers the pact in the same answer, and the pact can be
// offered again from the window while none stands (offerPact). He says no to the pact for the same reasons he says no to a
// rank (refusalOf). Beat 6, the map, is a promise beat that opens at Allied; its kept promise is the fourth memory. The pact
// stores its two halves (call, vouch); the call half waits on B4, and the window shows the pact in words only.
// Bonds B6 (claude-bonds-spec 1.9, R-20261123-06, R-20261123-07): the vouch half is read. vouchesFor lists each Full Bond whose
// pact includes it (carried into a battle by spirit/orders.js carryOpts); noteHearing writes one `hearing` memory when the
// player was tried and their bond was asked (account.js settleCourt, from the battle's trial ledger), spoke or declined.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ledger-data.js"));
  else root.ConceptCombatBondLedger = factory(root.ConceptCombatBondRoutes);
})(typeof self !== "undefined" ? self : this, function (D) {
  const RANKS = ["Unknown", "Acquainted", "Familiar", "Close", "Allied", "Full Bond"];
  const TOP = 5;   // Full Bond (B2b)
  const KINDS = ["talk", "outing", "battle", "promise", "gift", "hearing", "authored", "parting"];
  const TYPES = ["friendship", "romance", "mentorship"];
  const FLOOR = { 2: { memories: 1, kinds: 1 }, 3: { memories: 2, kinds: 2 },   // rank: what it needs (spec 1.3: Familiar "1 memory", Close "2 memories of different kinds")
    4: { memories: 3, kinds: 2, pact: true },                                     // Allied: "3 memories across at least two kinds, and a pact both accept"
    5: { memories: 4, kinds: 1, oneOf: ["battle", "promise", "hearing"] } };      // Full Bond: "4 memories, one of them battle, promise or hearing"
  const STATES = ["open", "kept", "broken", "repaired"];
  const CHECKS = { win: (result) => !!result && result.winner === "player" };   // a promise's check, read from the finished battle's result (R-20261122-47 2)
  const nat = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const str = (v) => (typeof v === "string" ? v : "");
  const routeOf = (id) => (D && D.ROUTES && Object.prototype.hasOwnProperty.call(D.ROUTES, id) ? D.ROUTES[id] : null);

  function cleanMemory(m) {
    if (!m || typeof m !== "object" || !str(m.id) || !KINDS.includes(m.kind)) return null;
    const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
    return { id: m.id, kind: m.kind, at: nat(m.at), with: ids(m.with), concepts: ids(m.concepts), line: str(m.line) };
  }
  function cleanRecord(r) {
    r = r && typeof r === "object" && !Array.isArray(r) ? r : {};
    const seen = new Set(), memories = [];
    for (const m of Array.isArray(r.memories) ? r.memories : []) { const c = cleanMemory(m); if (c && !seen.has(c.id)) { seen.add(c.id); memories.push(c); } }
    const out = { rank: Math.min(RANKS.length - 1, nat(r.rank)), type: TYPES.includes(r.type) ? r.type : null, memories,
      promises: (Array.isArray(r.promises) ? r.promises : []).filter((p) => p && typeof p === "object" && str(p.id) && STATES.includes(p.state))
        .map((p) => ({ id: p.id, text: str(p.text), check: CHECKS[p.check] ? p.check : "win", state: p.state, madeAt: nat(p.madeAt), owned: p.owned === true })),
      pact: r.pact && typeof r.pact === "object" && typeof r.pact.call === "boolean" && typeof r.pact.vouch === "boolean" ? { call: r.pact.call, vouch: r.pact.vouch, acceptedAt: nat(r.pact.acceptedAt) } : null, rankAt: nat(r.rankAt),
      refused: r.refused && typeof r.refused === "object" ? r.refused : null };
    return out;
  }
  // Old saves have no `bonds`; a damaged one keeps what is sound. A record is kept for any character id (B8 adds routes).
  function normalize(bonds) {
    const src = bonds && typeof bonds === "object" && !Array.isArray(bonds) ? bonds : {};
    return Object.fromEntries(Object.keys(src).filter((id) => src[id] && typeof src[id] === "object").map((id) => [id, cleanRecord(src[id])]));
  }
  const recordOf = (account, id) => { const b = account && account.bonds, r = b && typeof b === "object" ? b[id] : null; return r && typeof r === "object" ? cleanRecord(r) : null; };
  const withRecord = (account, id, rec) => ({ ...account, bonds: { ...normalize(account && account.bonds), [id]: rec } });
  const rankName = (rank) => RANKS[Math.max(0, Math.min(RANKS.length - 1, nat(rank)))];
  const has = (rec, memoryId) => !!rec && rec.memories.some((m) => m.id === memoryId);

  // The introduction (spec 1.3 rank 1): sets Acquainted and is not itself a memory.
  function introduce(account, id) {
    const route = routeOf(id), rec = recordOf(account, id);
    if (!route) return { account, ok: false, why: "No one here to introduce yourself to." };
    if (rec && rec.rank >= 1) return { account, ok: false, why: `${route.name} already knows you.` };
    const next = { ...cleanRecord(rec || {}), rank: 1, rankAt: nat(account && account.battles) };
    return { account: withRecord(account, id, next), ok: true, line: route.intro.line };
  }
  // One credit per memory id, ever (spec 1.2). Needs an introduction first.
  function credit(account, id, memory) {
    const rec = recordOf(account, id), m = cleanMemory({ at: nat(account && account.battles), with: [id], concepts: [], ...memory });
    if (!m) return { account, ok: false, why: "Not a memory." };
    if (!rec || rec.rank < 1) return { account, ok: false, why: "Introduce yourself first." };
    if (has(rec, m.id)) return { account, ok: false, why: "Already remembered." };
    return { account: withRecord(account, id, { ...rec, memories: [...rec.memories, m] }), ok: true, memory: m };
  }
  // A beat is done when its memory is written, or, for a promise beat, when a promise was made in it (a decline leaves it open).
  // A promise's lines: its own beat's (B2b: the map has its own), else the route's (the confidence's, B2a).
  const linesOf = (route, pid) => { const b = route.beats.find((x) => pid.slice(pid.indexOf(":") + 1) === x.id); return (b && b.promiseLines) || route.promiseLines; };
  const promiseOf = (rec, pid) => (rec ? rec.promises.find((p) => p.id === pid) || null : null);
  const beatDone = (rec, id, b) => (b.kind === "promise" ? !!promiseOf(rec, `${id}:${b.id}`) : has(rec, `${id}:${b.id}`));
  // A beat's answer (spec 1.13 beat 1): every choice writes the beat's one memory id, with the line the character answered.
  // A promise beat (spec 1.4, beat 3) writes no memory when answered: a choice with `promise` opens the beat's promise, and a
  // decline opens nothing, writes nothing and blocks nothing (T31); the memory comes when the promise is checked.
  function answer(account, id, beatId, choiceId, opts = {}) {
    const route = routeOf(id), beat = route && route.beats.find((b) => b.id === beatId), choice = beat && beat.choices.find((c) => c.id === choiceId);
    if (!choice) return { account, ok: false, why: "Not a choice here." };
    if (beat.kind !== "promise") {
      const rec = recordOf(account, id);
      if (beat.opens && (!rec || rec.rank < beat.opens)) return { account, ok: false, why: "Not yet." };
      const r = credit(account, id, { id: `${id}:${beat.id}`, kind: beat.kind, line: choice.line });
      if (!r.ok) return r;
      if (!choice.pact) return { ...r, line: choice.line };
      const o = offerPact(r.account, id, opts);   // the pact both accept (spec 1.13 beat 5): the talk is remembered whatever he answers
      return o.ok ? { ...o, memory: r.memory, line: `${choice.line} ${o.line}` } : { ...o, ok: false, memory: r.memory, line: `${choice.line} ${o.line || ""}`.trim() };
    }
    const rec = recordOf(account, id), pid = `${id}:${beat.id}`;
    if (!rec || rec.rank < (beat.opens || 1)) return { account, ok: false, why: "Not yet." };
    if (promiseOf(rec, pid)) return { account, ok: false, why: "Already promised." };
    if (!choice.promise) return { account, ok: true, declined: true, line: choice.line };
    const p = { id: pid, text: beat.promise.text, check: beat.promise.check, state: "open", madeAt: nat(account && account.battles), owned: false };
    return { account: withRecord(account, id, { ...rec, promises: [...rec.promises, p] }), ok: true, promise: p, line: choice.line };
  }
  // The open beat: the first authored beat that is open at this rank and not yet done, once introduced.
  function openBeat(account, id) {
    const route = routeOf(id), rec = recordOf(account, id);
    if (!route || !rec || rec.rank < 1) return null;
    return route.beats.find((b) => rec.rank >= (b.opens || 1) && !beatDone(rec, id, b)) || null;
  }
  // His no (spec 1.3): a promise to him broken and unrepaired, or his trust toward the player's unit below zero (a negative
  // trust never decays, spirit/orders.js trustOf, so the stored value is the live one). The line is his reason, or null.
  const orderers = (opts) => [...new Set(["warden", str(opts && opts.playerChar) || "warden"])];
  function refusalOf(account, id, opts = {}) {
    const rec = recordOf(account, id), route = routeOf(id);
    if (!rec || !route) return null;
    if (rec.promises.some((p) => p.state === "broken")) return route.refuse.broken;
    const trust = (account && account.trust) || {};
    if (orderers(opts).some((by) => { const t = trust[`${by}>${id}`]; return t && Number.isFinite(t.v) && t.v < 0; })) return route.refuse.trust;
    return null;
  }
  const refuse = (account, id, rec, what, why) => ({ account: withRecord(account, id, { ...rec, refused: { what, why, at: nat(account && account.battles) } }), ok: false, refused: true, why, line: why });
  // Asking for the next rank (spec 1.3: at the floor the player may ask; the character answers, and may say no: ask()).
  // `why` is the player's reason the ask is closed; null with can false means there is nothing to ask in this build (no
  // promise of a later rank is shown).
  function askState(account, id) {
    const rec = recordOf(account, id), route = routeOf(id);
    if (!route || !rec || rec.rank < 1 || rec.rank >= TOP) return { can: false, why: null, next: null };
    const next = rec.rank + 1, f = FLOOR[next] || { memories: 0, kinds: 0 }, kinds = new Set(rec.memories.map((m) => m.kind)).size;
    const oneOf = !f.oneOf || rec.memories.some((m) => f.oneOf.includes(m.kind));
    if (rec.memories.length < f.memories || kinds < f.kinds || !oneOf) {
      const what = f.kinds > 1 ? `${f.memories} memories of different kinds` : f.memories === 1 ? "one memory" : `${f.memories} memories`;
      return { can: false, next, why: `Share ${what}${f.oneOf ? ", one of them a fight beside him or a promise between you," : ""} with ${route.name} first: ${route.floorHints[next]}.` };
    }
    if (f.pact && !rec.pact) return { can: false, next, why: `Make a pact with ${route.name} first: ${route.floorHints[next]}.` };
    if (nat(account && account.battles) <= rec.rankAt) return { can: false, next, why: `${route.name} ${route.paceHint}. Ask again after your next battle.` };
    return { can: true, next, why: null };
  }
  function ask(account, id, opts = {}) {
    const st = askState(account, id);
    if (!st.can) return { account, ok: false, why: st.why };
    const rec = recordOf(account, id), route = routeOf(id), no = refusalOf(account, id, opts);
    if (no) return refuse(account, id, rec, `rank:${st.next}`, no);   // a no is not a loss of rank, and it does not spend the cycle
    return { account: withRecord(account, id, { ...rec, rank: st.next, rankAt: nat(account && account.battles), refused: null }), ok: true, rank: st.next, line: (route.rankUp || {})[st.next] || null };
  }
  // The type event (spec 1.5): at Close, an explicit choice both accept; it changes later the same way, never by itself.
  function chooseType(account, id, type, opts = {}) {
    const rec = recordOf(account, id), route = routeOf(id);
    if (!route || !rec || rec.rank < 3) return { account, ok: false, why: `You are not close enough to ${route ? route.name : "them"} for that yet.` };
    const t = (route.types || []).find((x) => x.id === type);
    if (!t) return { account, ok: false, why: `${route.name} will not be that to you.` };
    if (rec.type === type) return { account, ok: false, why: "That is what you are to each other already." };
    const no = refusalOf(account, id, opts);
    if (no) return refuse(account, id, rec, `type:${type}`, no);
    return { account: withRecord(account, id, { ...rec, type, refused: null }), ok: true, type, line: t.line };
  }
  // The pact (spec 1.1, 1.13 beat 5): offered after the pact talk is remembered, from Close, while none stands; he accepts unless
  // he has a reason to say no (refusalOf: the same reasons as a rank). Its halves come from the route (call: he has a combat
  // character; vouch). → the same shape as ask().
  function pactState(account, id) {
    const rec = recordOf(account, id), route = routeOf(id), P = route && route.pact;
    if (!P || !rec || rec.rank < 3 || rec.pact) return { can: false };
    return { can: has(rec, `${id}:${P.beat}`) };
  }
  function offerPact(account, id, opts = {}) {
    if (!pactState(account, id).can) return { account, ok: false, why: "There is no pact to offer here." };
    const rec = recordOf(account, id), route = routeOf(id), no = refusalOf(account, id, opts);
    if (no) return refuse(account, id, rec, "pact", no);
    const pact = { call: route.pact.call === true, vouch: route.pact.vouch === true, acceptedAt: nat(account && account.battles) };
    return { account: withRecord(account, id, { ...rec, pact, refused: null }), ok: true, pact, line: route.pact.accepted };
  }
  // Owning the break (spec 1.4): a talk encounter about a broken promise. One talk memory, once; it is the first half of the
  // repair, and nothing else stands in for it. The second half is the promise's own check passed (settlePromises).
  function ownBreak(account, id, pid) {
    const rec = recordOf(account, id), route = routeOf(id), p = promiseOf(rec, pid);
    if (!route || !p || p.state !== "broken") return { account, ok: false, why: "There is no broken promise to own." };
    if (p.owned) return { account, ok: false, why: "You have owned it already. What is left is the act." };
    const L = linesOf(route, pid), r = credit(account, id, { id: `${pid}:owned`, kind: "talk", line: L.owned });
    if (!r.ok) return r;
    const r2 = recordOf(r.account, id);
    return { account: withRecord(r.account, id, { ...r2, promises: r2.promises.map((x) => (x.id === pid ? { ...x, owned: true } : x)) }), ok: true, line: L.owned };
  }
  // The settle check (spec 1.4): every open promise made before this battle is checked against its result and marked kept or
  // broken, each a `promise` memory of its own; a broken one that was owned is repaired when the same check passes. Called by
  // awardBattle after account.battles has counted this battle, so a promise made at battles N is checked by the battle that
  // makes it N + 1. → { account, lines }
  function settlePromises(account, result) {
    let next = account; const lines = [];
    const bonds = account && account.bonds && typeof account.bonds === "object" ? account.bonds : {};
    for (const id of Object.keys(bonds)) {
      const route = routeOf(id), rec0 = recordOf(next, id);
      if (!route || !rec0) continue;
      for (const p of rec0.promises) {
        if (p.madeAt >= nat(next.battles)) continue;
        const passed = (CHECKS[p.check] || CHECKS.win)(result);
        let state = null, mem = null; const L = linesOf(route, p.id);
        if (p.state === "open") { state = passed ? "kept" : "broken"; mem = passed ? { id: p.id, line: L.kept } : { id: `${p.id}:broken`, line: L.broken }; }
        else if (p.state === "broken" && p.owned && passed) { state = "repaired"; mem = { id: `${p.id}:repaired`, line: L.repaired }; }
        if (!state) continue;
        const c = credit(next, id, { ...mem, kind: "promise" });
        if (c.ok) next = c.account;
        const rec = recordOf(next, id);
        next = withRecord(next, id, { ...rec, promises: rec.promises.map((x) => (x.id === p.id ? { ...x, state } : x)) });
        lines.push(`${route.name}: "${mem.line}"`);
      }
    }
    return { account: next, lines };
  }
  // The `battle` memory (spec 1.2): fought beside a character you have met. Called by awardBattle with the result's
  // foughtBeside list (the same real-character list account.foughtBeside reads, ui.js finish), so it travels the same path.
  function noteBattle(account, foughtBeside) {
    let next = account;
    for (const id of Array.isArray(foughtBeside) ? foughtBeside : []) {
      const route = routeOf(id);
      if (!route || !route.foughtBeside) continue;
      const r = credit(next, id, { id: `${id}:foughtBeside`, kind: "battle", line: route.foughtBeside });
      if (r.ok) next = r.account;
    }
    return next;
  }
  // Bonds B6: a Full Bond whose pact includes the vouch. `honest` is the route's (R-20261123-07: Jatayu is honest for the vouch
  // only; his battle traits do not change); `broken` is refusalOf's own test, a promise to him still broken and not repaired.
  function vouchesFor(account) {
    const out = [], bonds = account && account.bonds && typeof account.bonds === "object" ? account.bonds : {};
    for (const id of Object.keys(bonds)) {
      const route = routeOf(id), rec = recordOf(account, id);
      if (!route || !rec || rec.rank < TOP || !rec.pact || rec.pact.vouch !== true) continue;
      const h = route.hearing || {};
      out.push({ id, name: route.name, honest: route.honest === true, broken: rec.promises.some((p) => p.state === "broken"),
        lines: { vouched: str(h.vouched), broken: str(h.broken), saw: str(h.saw) } });
    }
    return out;
  }
  // Bonds B6: the `hearing` memory (spec 1.4: "they spoke for you, or declined"). One per trial a bond was asked in, keyed by the
  // battle it happened in, so a second settle of the same battle writes nothing (the credit rule). A lent vouch (a teaching
  // scenario's) writes nothing. → { account, lines }
  function noteHearing(account, dockets) {
    let next = account; const lines = [];
    for (const d of Array.isArray(dockets) ? dockets : []) {
      const v = d && d.accused === "player" && d.vouch;
      if (!v || v.lent || !str(v.id)) continue;
      const route = routeOf(v.id), h = (route && route.hearing) || {};
      if (!route) continue;
      const line = v.answer === "declined" ? str(h.declinedMemory) || "You asked, and I would not speak. The register keeps that too." : str(h.vouchedMemory) || "I spoke for you at the hearing.";
      const r = credit(next, v.id, { id: `${v.id}:hearing:${nat(next && next.battles)}`, kind: "hearing", line });
      if (r.ok) { next = r.account; lines.push(`${route.name}: "${line}"`); }
    }
    return { account: next, lines };
  }
  // The keeper chip (H04): the rank by name, once met.
  const chipText = (account, id) => { const rec = recordOf(account, id), route = routeOf(id); return route && rec && rec.rank >= 1 ? `Bond with ${route.name}: ${rankName(rec.rank)}${rec.type ? ` · ${rec.type}` : ""}` : null; };

  return { RANKS, TOP, KINDS, FLOOR, CHECKS, routeOf, normalize, recordOf, rankName, introduce, credit, answer, openBeat, refusalOf, askState, ask, chooseType, pactState, offerPact, ownBreak, settlePromises, noteBattle, chipText, vouchesFor, noteHearing };
});
