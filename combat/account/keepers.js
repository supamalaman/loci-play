"use strict";
// Keeper memory (NPC faces S0; spec section 6): what a keeper knows about the player, read from the account and one small record.
// `account.keepers = { [keeperId]: { n, visits, lastAt, spent, level, lastLoss? } }`, normalized on read so old saves load.
//   visits   window entries           lastAt  account.battles at the last entry (the clock the game already uses for cycles)
//   n        transactions through that keeper (S0: none yet)       spent  Seeds spent there on the last visit (feeds `big`)
//   level    account.level at the last entry (feeds `mile`)
//   Rama only (a keeper with a `rematch` list): lastLoss  the encounter lost last, until it is won; fought  account.battles when the last
//   eligible battle ended; result  "win" or "loss" of that battle; run  eligible wins in a row. `account.history` records no encounter, so
//   her win, loss and streak lines read these, never the history: a secret, random or test battle can never speak through her.
// Rapport tier is derived from `n` and never stored. Nothing here draws from a random source: `pick` is a pure seeded choice.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../npc/keepers.js"));
  else root.ConceptCombatKeeperMemory = factory(root.ConceptCombatKeepers);
})(typeof self !== "undefined" ? self : this, function (K) {
  const nat = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  function cleanRecord(id, r) {
    r = r && typeof r === "object" ? r : {};
    const out = { n: nat(r.n), visits: nat(r.visits), lastAt: nat(r.lastAt), spent: nat(r.spent), level: nat(r.level) };
    if (typeof r.lastLoss === "string" && (K.KEEPERS[id]?.rematch || []).includes(r.lastLoss)) out.lastLoss = r.lastLoss;
    if (K.KEEPERS[id]?.rematch) { out.fought = nat(r.fought); out.run = nat(r.run); if (r.result === "win" || r.result === "loss") out.result = r.result; }
    return out;
  }
  // Old saves have no `keepers`; a damaged one is rebuilt from what is sound. Unknown keeper ids are dropped.
  function normalize(keepers) {
    const src = keepers && typeof keepers === "object" && !Array.isArray(keepers) ? keepers : {};
    return Object.fromEntries(Object.keys(src).filter((id) => K.KEEPERS[id]).map((id) => [id, cleanRecord(id, src[id])]));
  }
  const recordOf = (account, id) => cleanRecord(id, (account && account.keepers || {})[id]);
  const withRecord = (account, id, rec) => ({ ...account, keepers: { ...normalize(account && account.keepers), [id]: rec } });
  // 0 stranger, 1 for n of 1 to 4, 2 for 5 to 14, 3 for 15 or more. Never drops: only a count of transactions moves it.
  const tierOf = (rec) => { const n = nat(rec && rec.n); return n >= 15 ? 3 : n >= 5 ? 2 : n >= 1 ? 1 : 0; };

  // The context of an entry, first match wins: first, owing (opts.owed > 0, ledger keepers), big, mile, loss, streak, win, return.
  function contextFor(account, id, opts = {}) {
    const rec = recordOf(account, id), battles = nat(account.battles), history = Array.isArray(account.history) ? account.history : [];
    if (!rec.visits) return "first";
    if (nat(opts.owed) > 0) return "owing";
    if (rec.spent >= K.BIG_SPEND) return "big";
    if (nat(account.level) > rec.level) return "mile";
    if (K.KEEPERS[id]?.rematch) {   // the same rule as the rematch record: only eligible battles count (see noteBattle)
      if (rec.fought > rec.lastAt && rec.result === "loss") return "loss";
      if (rec.fought > rec.lastAt && rec.result === "win") return rec.run >= K.STREAK_WINS ? "streak" : "win";
    } else if (battles > rec.lastAt && history.length) {   // a battle was fought since the last entry: the newest one decides
      const last = history[history.length - 1];
      if (last && last.winner === "enemy") return "loss";
      if (last && last.winner === "player") {
        const run = history.slice(-K.STREAK_WINS);
        return run.length === K.STREAK_WINS && run.every((h) => h && h.winner === "player") ? "streak" : "win";
      }
    }
    return "return";
  }
  // Entering a window: the context (computed from the old record), then the record is updated. `spent` is per visit, so it resets.
  function enter(account, id, opts = {}) {
    const ctx = contextFor(account, id, opts), rec = recordOf(account, id);
    return { ctx, account: withRecord(account, id, { ...rec, visits: rec.visits + 1, lastAt: nat(account.battles), spent: 0, level: nat(account.level) }) };
  }
  // A finished battle: Rama remembers the Town Hall encounter you lost, and forgets it when you win that one.
  function noteBattle(account, { encounter, winner } = {}) {
    const rec = recordOf(account, "rama");
    if (!K.KEEPERS.rama.rematch.includes(encounter)) return account;
    const fought = nat(account.battles);
    if (winner === "enemy") return withRecord(account, "rama", { ...rec, lastLoss: encounter, fought, result: "loss", run: 0 });
    if (winner === "player") { const { lastLoss, ...rest } = rec; return withRecord(account, "rama", { ...(lastLoss === encounter ? rest : rec), fought, result: "win", run: rec.run + 1 }); }
    return account;   // a stopped or drawn battle ("none") leaves the mark and the memory as they were
  }

  function hash(str) {
    let h = 2166136261;
    for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  // `{token}` filled from `tokens`; a token with no value skips the line (never printed with a hole).
  function fill(text, tokens) {
    let ok = true;
    const out = String(text).replace(/\{(\w+)\}/g, (m, k) => { const v = tokens && tokens[k]; if (v === undefined || v === null || v === "") { ok = false; return m; } return String(v); });
    return ok ? out : null;
  }
  // Deterministic, never random: a seeded choice from (account.created, keeper, event, battles, visits), avoiding the lines in `ring`
  // (the last few ids seen this session). `fallback` maps an event with no line to the one to try next. Returns { id, face, text } or null.
  const FALLBACK = { owing: "return", big: "return", mile: "return", streak: "win", win: "return", loss: "return", first: "return", err: "idle", refuse: "idle", buy: "return", leave: "idle" };
  function pick(rows, event, { account = {}, keeper = "", tokens = {}, ring = [], visits = 0 } = {}) {
    for (let ev = event, hops = 0; ev && hops < 5; ev = FALLBACK[ev], hops++) {
      const live = rows.filter((r) => (Array.isArray(ev) ? ev.includes(r.when) : r.when === ev)).map((r) => ({ r, text: fill(r.text, tokens) })).filter((c) => c.text !== null);
      if (!live.length) { if (Array.isArray(ev)) return null; continue; }
      const fresh = live.filter((c) => !ring.includes(c.r.id)), pool = fresh.length ? fresh : live;
      const c = pool[hash(`${account.created || ""}|${keeper}|${Array.isArray(ev) ? ev.join("+") : ev}|${nat(account.battles)}|${visits}`) % pool.length];
      return { id: c.r.id, face: c.r.face, text: c.text };
    }
    return null;
  }

  return { normalize, recordOf, tierOf, contextFor, enter, noteBattle, pick };
});
