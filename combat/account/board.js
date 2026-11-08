"use strict";
// Contract board (W4.2 build): the town notice-board. Three postings,
// refreshed every battle, each naming ITS victory. Take the job, fight
// THEIR fight, collect. One at a time; abandon clean; expiry rots.
// Proof is the battle record (the ledger is the witness). Payouts price
// under the W4.1 mint cap. Conditions the live game cannot verify yet
// stay registry-listed but never generate (no bait jobs!).
//   RULES                                    → tunables (size, expiry, bases, multipliers)
//   LIVE                                     → verifiable condition ids (registry order)
//   STUBS                                    → listed, ungenerated until their systems land
//   generate({ seed, battles, lastIds, roster }) → 3 postings (seeded, no immediate reposts)
//   refresh(account, { seed })               → expire + refill after a battle (accepted stays pinned)
//   accept(account, id) / abandon(account)   → one at a time; walk away clean
//   verify(mission, record)                  → { ok, reason } (proof over the record)
//   settle(mission, record)                  → payout seeds or 0
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./mint.js"));
  else root.ConceptCombatBoard = factory(root.ConceptCombatMint);
})(typeof self !== "undefined" ? self : this, function (MINT) {
  const CL = () => (typeof module === "object" && module.exports ? require("../cards/cards-loot.js") : (typeof self !== "undefined" ? self : this).ConceptCombatCardsLoot);   // lazy: board.js loads before the cards tags on the town pages
  const RULES = { postings: 3, expiryBattles: 3,
    bases: { assassinate: 18, survive: 12, escape: 14, noDamage: 20, solo: 16, turnLimit: 14, noUlts: 15, vowBound: 12, convert: 14, capture: 14, kneeVictory: 22, trialWin: 12 },   // the last four are the non-lethal jobs Fame opens (FAME.md E7; PROVISIONAL, under the mint cap)
    constraintMul: { solo: 1.5, turnLimit: 1.4, noUlts: 1.3, noDamage: 1.6 } };
  const LIVE = ["assassinate", "survive", "escape", "noDamage", "solo", "turnLimit", "noUlts", "vowBound"];
  const FAME_LIVE = ["convert", "capture", "kneeVictory", "trialWin"];   // Fame F2 (FAME.md E7): non-lethal jobs, offered from Fame 2, verified from the finished battle's Fame rows
  const FAME_MIN = 2;
  const STUBS = ["revelationFirst", "bingoBounty", "ladderRanked", "tabooBound", "kitLocked", "kneesOnly"];
  const roll = (seed, tag) => {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const pick = (seed, tag, arr) => arr[Math.floor(roll(seed, tag) * arr.length)];
  function price(condition, diff, constraints) {
    let p = (RULES.bases[condition] || 10) * diff;
    for (const c of constraints || []) p *= RULES.constraintMul[c] || 1;
    return MINT.capped("board", Math.round(p)).seeds;
  }
  function draft(seed, i, battles, roster, fame = 0, level = 1) {
    const condition = pick(seed, `board:cond:${i}`, fame >= FAME_MIN ? [...LIVE, ...FAME_LIVE] : LIVE);   // old accounts at Fame 0 or 1 draw exactly the old pool
    const m = { id: `b${battles}-${condition}-${i}`, condition, constraints: [], expiresAt: battles + RULES.expiryBattles };
    let diff = 1;
    if (condition === "assassinate") m.target = pick(seed, `board:target:${i}`, roster.length ? roster : ["student"]);
    if (condition === "survive") { m.n = 3 + Math.floor(roll(seed, `board:n:${i}`) * 4); diff = m.n / 3; }
    if (condition === "turnLimit") { m.n = 4 + Math.floor(roll(seed, `board:n:${i}`) * 5); diff = 9 / m.n; }
    const pool = ["solo", "noUlts", "turnLimit", "noDamage"].filter((c) => c !== condition && !(condition === "turnLimit" && c === "turnLimit"));
    const nCon = Math.floor(roll(seed, `board:nc:${i}`) * 3);   // 0–2 constraints
    for (let k = 0; k < nCon; k++) {
      const c = pick(seed, `board:con:${i}:${k}`, pool);
      if (!m.constraints.includes(c)) m.constraints.push(c);
    }
    if (m.constraints.includes("turnLimit") && condition !== "turnLimit") m.cn = 6 + Math.floor(roll(seed, `board:cn:${i}`) * 4);
    m.payout = price(condition, diff, m.constraints);
    if (m.constraints.length) m.card = CL()?.rollCard(null, { seed, tag: `board:card:${i}`, level }) || null;   // Battle Cards (C6a): a constrained job pays a card in kind (never legendary, never staged), its rarity rolled at the player's level like a battle drop
    return m;
  }
  function generate({ seed = 1, battles = 0, lastIds = [], roster = [], fame = 0, level = 1 } = {}) {
    const out = [];
    let guard = 0;
    while (out.length < RULES.postings && guard++ < 30) {
      const m = draft(`${seed}:${guard}`, out.length, battles, roster, fame, level);
      if (lastIds.includes(m.id) || out.some((o) => o.id === m.id)) continue;
      out.push(m);
    }
    return out;
  }
  function state(a) { return (a.board ||= { postings: [], accepted: null, lastIds: [], done: 0 }); }
  function refresh(account, { seed = 1, roster = [], fame = 0 } = {}) {
    const b = state(account), battles = account.battles || 0;
    b.lastIds = b.postings.map((p) => p.id);
    const kept = b.postings.find((p) => p.id === b.accepted && p.expiresAt > battles);
    if (b.accepted && !kept) b.accepted = null;   // the accepted job rotted off the board (no back-pay, no penalty)
    const fresh = generate({ seed: `${seed}:b${battles}`, battles, lastIds: b.lastIds, roster, fame, level: account.level || 1 })
      .filter((p) => p.id !== b.accepted).slice(0, RULES.postings - (kept ? 1 : 0));
    b.postings = [...(kept ? [kept] : []), ...fresh];
    return account;
  }
  function accept(account, id) {
    const b = state(account);
    if (b.accepted) return { ok: false, error: "One job at a time: finish or abandon before the next." };
    const m = b.postings.find((p) => p.id === id);
    if (!m) return { ok: false, error: "That posting is gone." };
    if (m.expiresAt <= (account.battles || 0)) return { ok: false, error: "That posting rotted off the board." };
    b.accepted = id;
    return { ok: true };
  }
  function abandon(account) {
    const b = state(account);
    b.accepted = null;   // walk away clean: no penalty, no pay
    return account;
  }
  // Proof over the battle record (ui.js builds it at finish from the log +
  // outcome; the ledger is the witness). record: { winner, round, beaten[],
  // vowsKept, foughtBeside[], escaped[], playerStanding, playerDamaged, playerUlts }.
  const CHECKS = {
    assassinate: (m, r) => r.beaten.includes(m.target) ? null : `${m.target} still stands.`,
    survive: (m, r) => r.round >= m.n && r.playerStanding && r.winner !== "enemy" ? null : `did not stand through round ${m.n}.`,   // audit 1.3.446: a knockout or a loss is not survival
    escape: (m, r) => r.escaped.includes("player") ? null : "you did not get out.",   // audit 1.3.446: you, not a summon or ally who left
    noDamage: (m, r) => r.winner === "player" && !r.playerDamaged ? null : "took a hit (or the win).",
    solo: (m, r) => r.winner === "player" && !r.foughtBeside.length ? null : "not alone (or not a win).",
    turnLimit: (m, r) => r.winner === "player" && r.round <= m.n ? null : `over ${m.n} rounds (or not a win).`,
    noUlts: (m, r) => r.winner === "player" && !r.playerUlts ? null : "an ult went off (or not a win).",
    vowBound: (m, r) => r.winner === "player" && r.vowsKept > 0 ? null : "no kept vow (or not a win).",
    // Fame F2: the record carries `fameRows`, the row names Fame.eventsFrom read off the finished battle (persuade, spared, knockout, sealed, tamed, presence, bonus, trial).
    convert: (m, r) => r.winner === "player" && (r.fameRows || []).includes("persuade") ? null : "no foe came to terms (or not a win).",
    capture: (m, r) => r.winner === "player" && (r.fameRows || []).some((x) => x === "sealed" || x === "tamed") ? null : "nothing was sealed or tamed (or not a win).",
    kneeVictory: (m, r) => r.winner === "player" && (r.fameRows || []).includes("presence") ? null : "no victory by presence (or not a win).",
    trialWin: (m, r) => r.winner === "player" && (r.fameRows || []).includes("trial") ? null : "no trial was won (or not a win).",
  };
  const CONSTRAINT_CHECKS = {
    solo: (m, r) => r.foughtBeside.length ? "broke solo." : null,
    noUlts: (m, r) => r.playerUlts ? "broke no-ults." : null,
    turnLimit: (m, r) => r.round > (m.cn || 8) ? `broke the ${m.cn || 8}-round leash.` : null,
    noDamage: (m, r) => r.playerDamaged ? "broke no-damage." : null,
  };
  function verify(mission, record) {
    if (!mission) return { ok: false, reason: "no mission" };
    const check = CHECKS[mission.condition];
    if (!check) return { ok: false, reason: `${mission.condition} is not verifiable yet.` };
    const fail = check(mission, record);
    if (fail) return { ok: false, reason: fail };
    for (const c of mission.constraints || []) {
      const cf = (CONSTRAINT_CHECKS[c] || (() => null))(mission, record);
      if (cf) return { ok: false, reason: cf };
    }
    return { ok: true, reason: "the ledger witnesses it." };
  }
  function settle(mission, record) {
    const v = verify(mission, record);
    return v.ok ? mission.payout : 0;
  }
  function describe(m) {
    const bits = { assassinate: `Assassinate ${m.target}`, survive: `Survive ${m.n} rounds`, escape: "Get out alive",
      noDamage: "Win untouched", solo: "Win solo", turnLimit: `Win in ${m.n} rounds`, noUlts: "Win without ults", vowBound: "Win with a kept vow",
      convert: "Win a foe over", capture: "Seal or tame a foe", kneeVictory: "Win by presence", trialWin: "Win a trial" };
    const card = m.card ? CL()?.cardName?.(m.card) || null : null;
    return `${bits[m.condition] || m.condition}${(m.constraints || []).length ? ` (${m.constraints.join(", ")})` : ""} — ${m.payout} Seeds${card ? ` + ${card}` : ""}`;
  }
  return { RULES, LIVE, FAME_LIVE, FAME_MIN, STUBS, generate, refresh, accept, abandon, verify, settle, describe };
});
