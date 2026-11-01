"use strict";
// Ante stakes (W1.5 build): pre-battle lots, winner-takes, courts enforce. Pure math over plain
// account/battle data; no engine imports. The engine part (engine/ante.js) proposes through Talk;
// loot.js resolves at finishBattle; this module holds escrow, value, resolution and cooldowns.
//
// Lots are JSON: [{ kind: "orb", id, nth }, { kind: "bead", idx, snap }, { kind: "levels", n }].
// V1 tender is vessels + levels only: techniques need kit-seal machinery that does not exist yet,
// and souls/memories/shards do not exist as account tender (honest gating, per the spec's own rule).
//
//   lotValue(lot)                    → number (tuner table RULES.values)
//   validateStake(account, lot)      → null | error string (ownership, cooldowns, just-won freeze, floor)
//   escrowOut(account, lot)          → { account, held } (vessels leave; levels are risk, not escrow)
//   refund(account, held)            → account (vessels back)
//   resolve(stakes, winner)          → { toPlayer: [vessels], stripLevels: n }
//   applyResolution(account, stakes, winner, strip) → { account, lines } (strip = account.stripLevels)
// Cooldowns tick inside account.awardBattle (every finished battle); this module only sets them.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatAnte = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = {
    values: { orb: 3, bead: 2, level: 5 },
    cooldownBattles: 3, justWonBattles: 3,
    nerveLo: 0.8, nerveHi: 1.2,   // AI accepts when your lot >= foe lot x nerve
  };

  const lotValue = (lot) => (lot || []).reduce((n, it) =>
    n + (it.kind === "orb" ? RULES.values.orb : it.kind === "bead" ? RULES.values.bead : it.kind === "levels" ? RULES.values.level * (it.n || 0) : 0), 0);

  const orbInstances = (account, id) => (account?.orbs || []).map((o, i) => ({ id: o, i })).filter((o) => o.id === id);
  const beadUid = (snap) => `bead:${snap?.name || "?"}:${snap?.maxLF || 0}`;

  function validateStake(account, lot, pairKey) {
    if (!lot?.length) return "Stake something.";
    if ((account?.stakeCooldowns || {})[pairKey] > 0) return `Rematch cooldown: no stakes against them for ${account.stakeCooldowns[pairKey]} more battles.`;
    const orbs = account?.orbs || [], beads = account?.beads || [], justWon = account?.justWon || {};
    const seen = new Set();
    for (const it of lot) {
      if (it.kind === "orb") {
        if (orbInstances(account, it.id).length <= (it.nth || 0)) return `You don't hold that orb.`;
        if (justWon[`orb:${it.id}`] > 0) return `That orb was just won: it can't be re-staked for ${justWon[`orb:${it.id}`]} battles.`;
      } else if (it.kind === "bead") {
        const b = beads[it.idx];
        if (!b) return `You don't hold that bead.`;
        if (justWon[beadUid(b)] > 0) return `That bead was just won: it can't be re-staked for ${justWon[beadUid(b)]} battles.`;
        if (seen.has(`b${it.idx}`)) return `The same bead twice? One lot, one bead.`;
        seen.add(`b${it.idx}`);
      } else if (it.kind === "levels") {
        if (!(it.n >= 1) || it.n > (account.level || 1) - 1) return `Levels staked must sit between 1 and ${Math.max(0, (account.level || 1) - 1)} (floor 1 holds).`;
      } else return "Unknown tender.";
    }
    return null;
  }

  // Vessels leave the account into held; levels never leave (they are risk: stripped only on loss).
  function escrowOut(account, lot) {
    const orbs = (account?.orbs || []).slice(), beads = (account?.beads || []).slice(), held = { vessels: [], levels: 0 };
    const orbTakes = {}, beadTakes = [];
    for (const it of lot) {
      if (it.kind === "orb") orbTakes[it.id] = (orbTakes[it.id] || 0) + 1;
      else if (it.kind === "bead") beadTakes.push(it.idx);
      else if (it.kind === "levels") held.levels += it.n;
    }
    for (const [id, n] of Object.entries(orbTakes)) {
      let left = n;
      for (let i = orbs.length - 1; i >= 0 && left > 0; i--) if (orbs[i] === id) { held.vessels.push({ kind: "orb", id }); orbs.splice(i, 1); left--; }
    }
    for (const idx of [...beadTakes].sort((a, b) => b - a)) held.vessels.push({ kind: "bead", snap: beads.splice(idx, 1)[0] });
    return { account: { ...account, orbs, beads }, held };
  }

  function refund(account, held) {
    if (!held) return account;
    const orbs = (account?.orbs || []).slice(), beads = (account?.beads || []).slice();
    for (const v of held.vessels || []) {
      if (v.kind === "orb") orbs.push(v.id);
      else if (v.kind === "bead" && v.snap) beads.push(v.snap);
    }
    return { ...account, orbs, beads };
  }

  // Pure split: who gets what. The account application lives in applyResolution (needs stripLevels).
  function resolve(stakes, winner) {
    const mine = stakes?.held?.vessels || [], theirs = stakes?.foeLot || [], levels = stakes?.held?.levels || 0;
    if (winner === "player") return { toPlayer: [...mine, ...theirs], stripLevels: 0 };
    if (winner === "enemy") return { toPlayer: [], stripLevels: levels };
    return { toPlayer: mine, stripLevels: 0 };   // draws refund: wash-zero, no winner-takes
  }

  function applyResolution(account, stakes, winner, strip) {
    const r = resolve(stakes, winner);
    let a = { ...account };
    const orbs = (a.orbs || []).slice(), beads = (a.beads || []).slice();
    for (const v of r.toPlayer) {
      if (v.kind === "orb") orbs.push(v.id);
      else if (v.kind === "bead") beads.push(v.snap || { kind: "ante", name: "Ante", maxLF: 20 });
    }
    a = { ...a, orbs, beads };
    const lines = [];
    if (r.stripLevels > 0 && strip) {
      const s = strip(a, r.stripLevels, "ante lost");
      a = s.account;
      lines.push(`Stakes lost: ${r.stripLevels} level${r.stripLevels === 1 ? "" : "s"} stripped.`);
    }
    const foeWon = r.toPlayer.filter((v) => (stakes?.foeLot || []).includes(v));
    const justWon = { ...(a.justWon || {}) };
    for (const v of foeWon) justWon[v.kind === "orb" ? `orb:${v.id}` : beadUid(v.snap)] = RULES.justWonBattles;
    const entry = { t: new Date().toISOString(), pairKey: stakes?.pairKey || null, winner,
      playerLot: stakes?.playerLot || [], foeLot: stakes?.foeLot || [], revealed: !!stakes?.faceDown };
    if (stakes?.faceDown) {   // Mystery (Muse W2.5): concealed lots reveal at the duel's end, mandatory
      const name = (v) => v.kind === "orb" ? `orb ${v.id}` : v.kind === "bead" ? `bead ${v.snap?.name || v.snap?.kind || "bead"}` : `${v.n} levels`;
      lines.push(`Concealed lots revealed: you staked ${(stakes.playerLot || []).map(name).join(", ") || "nothing"}; they staked ${(stakes.foeLot || []).map(name).join(", ") || "nothing"}.`);
    }
    a = { ...a, justWon, stakesLedger: [...(a.stakesLedger || []), entry],
      stakeCooldowns: { ...(a.stakeCooldowns || {}), ...(entry.pairKey ? { [entry.pairKey]: RULES.cooldownBattles } : {}) } };
    if (winner === "player" && foeWon.length) lines.push(`Stakes won: ${foeWon.length} vessel${foeWon.length === 1 ? "" : "s"}.`);
    if (winner === "enemy") lines.push(`Stakes lost to ${stakes?.foeName || "the foe"}.`);
    if (winner !== "player" && winner !== "enemy") lines.push(`Stakes returned: no winner.`);
    return { account: a, lines };
  }

  return { RULES, lotValue, beadUid, validateStake, escrowOut, refund, resolve, applyResolution };
});
