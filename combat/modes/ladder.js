"use strict";
// Ranked ladder (Muse, Wave 3 custody; SPEC: muse-wave3 LADDER.md).
// Heaven's Arena port: judged bouts, public records, prize purses, rank
// perks. No one has to die for anyone to get rich and famous. Pure store
// + functions; purses move via resolution codes the caller applies
// (trial.js precedent). Records are ledger-readable (Bingo reads them).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../account/mint.js"));
  else root.ConceptCombatLadder = factory(root.ConceptCombatMint);
})(typeof self !== "undefined" ? self : this, function (Mint) {
  const LADDER = { ranks: 10, winsToClimb: 3, gates: [3, 6, 9],
    pursePer: 10, declineDecay: 3, rematchCooldown: 3, sandbagDrop: 2 };
  const createStore = () => ({ fighters: {}, pairs: {}, log: [] });
  const pairKey = (a, b) => [a, b].sort().join("~");

  function join(store, { id }) {
    if (!id) return { error: "join needs an id" };
    if (store.fighters[id]?.active) return { error: `${id} already climbs` };
    const prior = store.fighters[id];
    if (prior) {   // a returning climber keeps their record AND their declines (AP-01 3e: the walk-away was free, not a pardon)
      prior.active = true;
      store.log.push(`${id} returns to the ladder at rank ${prior.rank} (${prior.wins}W/${prior.losses}L/${prior.draws}D intact).`);
      return { ok: true, returned: true };
    }
    store.fighters[id] = { id, rank: 1, earned: 1, wins: 0, losses: 0, draws: 0,
      winsAtRank: 0, declines: 0, gatePassed: {}, active: true };
    store.log.push(`${id} joins the ladder at rank 1.`);
    return { ok: true };
  }
  function quit(store, { id }) {
    const f = store.fighters[id];
    if (!f?.active) return { error: `${id} is not climbing` };
    f.active = false;
    store.log.push(`${id} walks away free (${f.wins}W/${f.losses}L/${f.draws}D).`);
    return { ok: true };
  }

  // Challenge: up to +2 ranks, rematch cooldown 3 battles (ante precedent).
  function challenge(store, { from, to, battle = 0 }) {
    const a = store.fighters[from], b = store.fighters[to];
    if (!a?.active || !b?.active) return { error: "both fighters must be climbing" };
    if (b.rank - a.rank > 2) return { error: "no sniping the top from the floor (+2 max)" };
    const last = store.pairs[pairKey(from, to)];
    if (last !== undefined && battle - last < LADDER.rematchCooldown)
      return { error: `rematch cooldown: ${LADDER.rematchCooldown - (battle - last)} battles left` };
    return { ok: true };
  }
  // Decline: free twice; the 3rd consecutive decline decays 1 rank
  // (cowardice tax), never below the sandbag floor (earned−2).
  function decline(store, { id }) {
    const f = store.fighters[id];
    if (!f?.active) return { error: `${id} is not climbing` };
    f.declines += 1;
    if (f.declines >= LADDER.declineDecay) {
      f.declines = 0;
      const floor = Math.max(1, f.earned - LADDER.sandbagDrop);
      if (f.rank > floor) {
        f.rank -= 1; f.winsAtRank = 0;
        store.log.push(`${id} decays to rank ${f.rank} (cowardice tax).`);
        return { ok: true, decayed: f.rank };
      }
      store.log.push(`${id} holds the sandbag floor (earned−2).`);
      return { ok: true, floor: true };
    }
    return { ok: true, declines: f.declines };
  }

  // Record a judged bout. Wins climb (3 at rank, gatekeepers gate);
  // losses never demote; draws split the purse, honor intact. A thrown
  // bout (judge's call, caller-flagged) is fraud — marked.
  function record(store, { a, b, result, battle = 0, gatekeeper = false, thrown = false }) {
    const fa = store.fighters[a], fb = store.fighters[b];
    if (!fa?.active || !fb?.active) return { error: "both fighters must be climbing" };
    if (!["a", "b", "draw"].includes(result)) return { error: `result is a, b, or draw (got ${result})` };
    if (a === b) return { error: "a fighter cannot bout themselves" };
    const last = store.pairs[pairKey(a, b)];
    if (last != null && battle - last < LADDER.rematchCooldown)
      return { error: `rematch cooldown: ${LADDER.rematchCooldown - (battle - last)} battles left` };
    // Hardening (relay-1000): purses are house money — new mint — so every
    // payment routes through the mint cap. Mint dark → held, never paid open.
    const mintFlags = [];
    const capPurse = (to, rawPay) => {
      const m = Mint && Mint.capped ? Mint.capped("ladder", rawPay) : { seeds: 0, flag: "mint dark: purse held" };
      if (m.flag) mintFlags.push(m.flag);
      return { to, seeds: m.seeds };
    };
    fa.declines = 0; fb.declines = 0;
    store.pairs[pairKey(a, b)] = battle;
    if (thrown) {
      const loser = result === "a" ? b : a;
      store.log.push(`${loser} threw the bout: FRAUD, marked.`);
      return { ok: true, mark: { kind: "fraud", label: `${loser} threw a ladder bout`, round: battle } };
    }
    if (result === "draw") {
      fa.draws += 1; fb.draws += 1;
      const pa = Math.round((fa.rank * LADDER.pursePer) / 2), pb = Math.round((fb.rank * LADDER.pursePer) / 2);
      store.log.push(`${a} and ${b} draw, honor intact (${pa}/${pb}).`);
      return { ok: true, purse: [capPurse(a, pa), capPurse(b, pb)], mintFlags };
    }
    const [w, l] = result === "a" ? [fa, fb] : [fb, fa];
    w.wins += 1; l.losses += 1; w.winsAtRank += 1;
    const purse = capPurse(w.id, w.rank * LADDER.pursePer);
    if (gatekeeper) {
      w.gatePassed[w.rank + 1] = true;
      store.log.push(`${w.id} beats the rank-${w.rank + 1} gatekeeper.`);
    }
    const out = { ok: true, purse, mintFlags };
    if (w.winsAtRank >= LADDER.winsToClimb && w.rank < LADDER.ranks) {
      if (LADDER.gates.includes(w.rank + 1) && !w.gatePassed[w.rank + 1]) {
        store.log.push(`${w.id} banks the climb — the gatekeeper bars rank ${w.rank + 1}.`);
        out.gated = w.rank + 1;
      } else {
        w.rank += 1; w.earned = Math.max(w.earned, w.rank); w.winsAtRank = 0;
        store.log.push(`${w.id} climbs to rank ${w.rank}.`);
        out.climbed = w.rank;
      }
    }
    return out;
  }

  // Perks: rank 4+ private room, 7+ priority matching, 10 title.
  const perks = (rank) => ({ room: rank >= 4, priority: rank >= 7, title: rank >= 10 });

  return { LADDER, createStore, join, quit, challenge, decline, record, perks };
});
