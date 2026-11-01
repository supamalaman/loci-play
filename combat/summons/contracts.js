"use strict";
// Summon contracts (Muse, Wave 3 custody; SPEC: muse-wave3 CONTRACTS.md).
// Persistent summon relationships: sign once (out of battle), pay per call,
// call mid-battle. Wraps the live summon machinery (summons/summons.js)
// with relationship state — line-agnostic: lines + terms come from the
// caller, standing + blacklist live here. Costs move via resolution codes
// the caller applies (trial.js precedent). Store is account-safe.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSummonContracts = factory();   // legacy owns ConceptCombatContracts (ui.js sheet) — never rejoin it
})(typeof self !== "undefined" ? self : this, function () {
  const PACT = { cap: 3, apologyMul: 2, rateEvery: 5, rateStep: 0.10, rateMax: 0.30 };
  const createStore = () => ({ pacts: {}, active: null, blacklist: {}, standing: {}, log: [] });
  const scale = (cost, mul) => ({ pf: Math.ceil((cost.pf || 0) * mul), seeds: Math.ceil((cost.seeds || 0) * mul) });
  const rateFor = (clean = 0) => Math.min(PACT.rateMax, PACT.rateStep * Math.floor((clean || 0) / PACT.rateEvery));   // pure: standing rate from a clean-call count (engine + UI quote the same number)

  // Sign: pact a summon line. First sign is free (a relationship!);
  // re-signing a blacklisted line costs double one call cost (apology).
  function sign(store, { line, terms, apology = false }) {
    if (!line || !terms || !terms.call) return { error: "a pact needs a line and terms" };
    if (store.pacts[line]) return { error: `already pacted to ${line}` };
    if (Object.keys(store.pacts).length >= PACT.cap)
      return { error: `3 contracts max — release one first` };
    const ban = store.blacklist[line];
    if (ban && !apology)
      return { error: `${line} blacklists you (${ban.kind}) — re-sign with apology (double)` };
    const out = { ok: true };
    if (ban && apology) {
      out.apology = { to: line, ...scale(terms.call, PACT.apologyMul) };
      delete store.blacklist[line];
      store.log.push(`${line} accepts the apology (double).`);
    }
    store.pacts[line] = { line, terms: { ...terms }, signed: true };
    store.log.push(`Pacted to ${line} (call ${terms.call.pf || 0}ΦF/${terms.call.seeds || 0}S, ${terms.duration} rounds).`);
    return out;
  }

  // Call: pay per call, one active at a time. Good callers get rates:
  // every 5 clean calls with a line, 10% off, max 30%.
  function call(store, { line }) {
    const pact = store.pacts[line];
    if (!pact) return { error: `no pact with ${line}` };
    if (store.active) return { error: `${store.active.line} already answers — one call at a time` };
    const clean = store.standing[line]?.clean || 0;
    const rate = rateFor(clean);
    store.active = { line };
    store.log.push(`${line} answers${rate ? ` (standing rate −${Math.round(rate * 100)}%)` : ""}.`);
    return { ok: true, cost: scale(pact.terms.call, 1 - rate), duration: pact.terms.duration, rate };
  }

  // Dismissal free: send home anytime, downed or caller-down likewise ends it.
  // Clean ends (dismissed) build standing; downed ends don't.
  function endCall(store, { how = "dismissed" } = {}) {
    if (!store.active) return { error: "no active call" };
    const { line } = store.active;
    store.active = null;
    if (how === "dismissed") {
      const st = store.standing[line] || (store.standing[line] = { calls: 0, clean: 0 });
      st.calls += 1; st.clean += 1;
    }
    store.log.push(`${line} goes home (${how}) — free.`);
    return { ok: true };
  }

  // How a call that is still live when the battle ends closes (Mala 2026-10-31, decision 3): a battle the caller's
  // side WINS with the pact summon still on the field is a clean close and builds standing, like a dismissal. A loss,
  // a downed summon or a missing actor builds none ("battleOver"). Abandoned battles clear later ("abandoned").
  function battleCloseHow(s) {
    const pa = s && s.pactActive, caller = pa && s.actors[pa.owner], summon = pa && s.actors[pa.summonId];
    const won = !!(caller && summon && !summon.defeated && s.outcome && s.outcome.winner === caller.side);
    return won ? "dismissed" : "battleOver";
  }

  // Release rite: break cleanly, free the slot, no penalty. Send them
  // home first — you don't break a pact mid-call (conduct!).
  function release(store, { line }) {
    if (!store.pacts[line]) return { error: `no pact with ${line}` };
    if (store.active?.line === line) return { error: "dismiss the call first — clean breaks only" };
    delete store.pacts[line];
    store.log.push(`Released ${line}, settled, no penalty.`);
    return { ok: true };
  }

  // Breach: mistreat a summon → pact BROKEN, line blacklists you, the
  // ledger remembers (broken-vow mark, karmic shape).
  function breach(store, { line, kind, battle = 0 }) {
    if (!store.pacts[line] && !store.blacklist[line]) return { error: `no pact with ${line}` };
    delete store.pacts[line];
    if (store.active?.line === line) store.active = null;
    store.blacklist[line] = { kind, battle };
    const mark = { kind: "broken-vow", label: `broke the ${line} pact (${kind})`, round: battle };
    store.log.push(`${line} BROKEN (${kind}) — blacklisted, marked.`);
    return { ok: true, mark };
  }

  return { PACT, createStore, sign, call, endCall, battleCloseHow, release, breach, rateFor, scale };
});
