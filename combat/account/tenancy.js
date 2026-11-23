"use strict";
// Exile tenancy, the account side (slice T0a, the Aziza slice; spec ~/loci-orbit/ready-to-review/claude-anime-exile-spec/specs/EXILE_TENANCY.md
// sections 1, 2 and 8; plan ~/loci-orbit/claude/exile-t0a/PLAN.md). An exile lodges with a host at a per-pair Coherence, 1 to 100. The household is
// account.exiles[id] = { status: "housed" | "pool", coherence, housedAt, declinedAt, last: { delta, reason } }. Pure functions: each takes the account
// and returns a new one; whoever owns the account saves it. Numbers and names are in content.js rules.tenancy; every player-read line is built here
// from them, so the text and the code read the same constants. The engine side is engine/tenancy.js (a battle receives opts.tenant from battleOpts).
//
//   rungOf(coherence)           → { index, id, name, label, efficacy, lends, full }   label reads "Full" at exactly 100
//   trackerLine(coherence)      → "Coherence N (Rung)"
//   housed(account)             → [id, ...] the housed exiles, longest-housed first
//   mainTenant(account)         → the id that fills the one main-tenant slot, or null
//   battleOpts(account)         → { tenant: { id, coherence } } for the main tenant, or null
//   offerFor(account, { test, force }) → an exile id to offer at the start of a random battle, or null (seeded: the same battle count gives the same answer)
//   accept(account, id)         → { account, line }   she moves in at Coherence 1
//   decline(account, id)        → { account, line }   a free rejection; she may ask again after rules.tenancy.offer.declineRest battles
//   settle(account, report)     → { account, lines, moves }   once per completed real battle, win or lose; report { won, heldBack, uses, usesMax }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTenancy = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const need = (path, global) => { try { if (typeof module === "object" && module.exports) return require(path); } catch {} return (typeof self !== "undefined" ? self[global] : null); };
  const R = () => need("../content.js", "ConceptCombatContent").rules.tenancy;   // lazy: no load-order knot, node or page
  const clamp = (n) => Math.max(1, Math.min(R().max, Math.floor(+n || 1)));
  // The same string hash the account uses for its seeded chances (account.js hash), so an offer is repeatable.
  function hash(str) {
    let h = 2166136261;
    for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const ex = (account) => (account && account.exiles && typeof account.exiles === "object" ? account.exiles : {});
  const nameOf = (id) => R().exiles[id]?.name || id;

  function rungOf(coherence) {
    const c = clamp(coherence), rungs = R().rungs;
    let index = 0; rungs.forEach((r, i) => { if (c >= r.from) index = i; });
    const r = rungs[index], full = c === R().full;
    return { index, id: r.id, name: r.name, label: full ? "Full" : r.name, efficacy: r.efficacy, lends: r.efficacy > 0, full };
  }
  const trackerLine = (coherence) => `Coherence ${clamp(coherence)} (${rungOf(coherence).label})`;

  // Housed exiles, the longest-housed first (lowest housedAt), ties by id: the first is the main tenant (spec section 2, the slot reading;
  // choosing which exile fills the slot needs rung 4 and two exiles, and is built with the household screen).
  function housed(account) {
    const e = ex(account);
    return Object.keys(e).filter((id) => e[id] && e[id].status === "housed" && R().exiles[id])
      .sort((a, b) => (e[a].housedAt || 0) - (e[b].housedAt || 0) || (a < b ? -1 : a > b ? 1 : 0));
  }
  const mainTenant = (account) => housed(account)[0] || null;
  function battleOpts(account) {
    const id = mainTenant(account); if (!id) return null;
    const last = ex(account)[id].last;
    return { tenant: { id, coherence: clamp(ex(account)[id].coherence), ...(last ? { last: { delta: last.delta || 0, reason: String(last.reason || "") } } : {}) } };
  }

  // Door 1, pulled forward from T1 (R-20261115-49): a flat chance at the start of a random battle. Never in a test or practice start, never before
  // minBattles completed battles, never for an exile already housed, never within declineRest battles of a decline. The roll is seeded from the
  // account and its battle count (no Math.random: a live test that starts a random battle must not flake), so asking twice in one battle count
  // gets the same answer. `force` (1 or 0) is for a browser test.
  function offerFor(account, { test = false, force = null } = {}) {
    if (test || !account) return null;
    const o = R().offer, e = ex(account), battles = account.battles || 0;
    const open = Object.keys(R().exiles).filter((id) => !(e[id]?.status === "housed") && !(e[id]?.declinedAt != null && battles - e[id].declinedAt < o.declineRest));
    if (!open.length || force === 0 || force === "0") return null;
    if (force === 1 || force === "1") return open[0];
    if (battles < o.minBattles) return null;
    return hash(`exile-offer:${account.created || account.name || ""}:${battles}`) < o.chance ? open[0] : null;
  }

  function accept(account, id) {
    if (!R().exiles[id]) return { account, line: "" };
    const e = { ...ex(account), [id]: { status: "housed", coherence: R().start, housedAt: account.battles || 0, last: { delta: 0, reason: "moved in" } } };
    return { account: { ...account, exiles: e }, line: `${nameOf(id)} moves in. ${trackerLine(R().start)}: she lends nothing yet.` };
  }
  function decline(account, id) {
    if (!R().exiles[id]) return { account, line: "" };
    const e = { ...ex(account), [id]: { status: "pool", declinedAt: account.battles || 0 } };
    return { account: { ...account, exiles: e }, line: "She thanks you and goes. She may ask again." };
  }

  // After a completed real battle (win or lose; an abandoned battle logs nothing): +time to every housed exile, +restraint to the main tenant on a
  // win in which her way was open and not taken (a logged hold-back and no use spent). An idle tenant, one never castable, earns only the time.
  function settle(account, report = {}) {
    if (report.exorcised) {   // Exile G1: Greedigut won (the host at 0 LF while he was present, or an accepted notice): the main tenant is erased for this save; the rest settle as usual
      const ex0 = exorcise(account), rest = housed(ex0.account).length ? settle(ex0.account, { ...report, exorcised: false, won: false }) : { account: ex0.account, lines: [], moves: [] };
      return { account: rest.account, lines: [ex0.line, ...rest.lines].filter(Boolean), moves: rest.moves, exorcised: true };
    }
    const ids = housed(account), main = ids[0], g = R().gains, lines = [], moves = [];
    let e = { ...ex(account) };
    for (const id of ids) {
      const before = e[id].coherence; let room = R().max - before;   // the cap: a line says what the number really moved, never more
      const parts = [], add = (want, why, text) => { const d = Math.min(want, room); if (d > 0) { room -= d; parts.push({ d, why, text: text(d) }); } };
      add(g.time, "housed for a battle", (d) => `+${d} Coherence: housed for a battle.`);
      if (id === main && report.won && report.heldBack && report.uses === report.usesMax) add(g.restraint, "restraint", (d) => `+${d} Coherence: you had her way open and did not take it.`);
      const delta = parts.reduce((n, p) => n + p.d, 0), after = before + delta;
      e[id] = { ...e[id], coherence: after, last: { delta, reason: parts.map((p) => p.why).join(", ") || "at Full" } };
      for (const p of parts) lines.push(p.text);
      lines.push(`${nameOf(id)}: ${trackerLine(after)}.`);
      const was = rungOf(before), now = rungOf(after);
      if (now.index > was.index) lines.push(`${nameOf(id)} is a ${now.name} now.`);
      moves.push({ id, before, after, delta: after - before });
    }
    return { account: { ...account, exiles: e }, lines, moves };
  }

  // Exile G1 T8: Greedigut's win (host at 0 LF while he is present, or an accepted surrender) erases the main tenant
  // for this save only. Crew standing and approach-halving are T2. Other housed exiles stay.
  function exorcise(account) {
    const id = mainTenant(account); if (!id) return { account, line: "" };
    const e = { ...ex(account) }; delete e[id];
    return { account: { ...account, exiles: e }, line: `${nameOf(id)} is erased from this save.` };
  }

  return { rungOf, trackerLine, housed, mainTenant, battleOpts, offerFor, accept, decline, settle, exorcise };
});
