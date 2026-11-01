"use strict";
// Bingo Book (Muse, Wave 3 custody; SPEC: muse-wave3 BINGO.md).
// The assassin's ledger: named heads, escrowed bounties, proof-of-work
// claims. Capture pays better than killing — mercy has a price list.
// Pure store + functions; Seeds move via resolution codes the caller
// applies (trial.js precedent). Store is account-safe: account.bingo.
// Fraud marks use the karmic mark shape so the astral audit reads them.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../account/mint.js"));
  else root.ConceptCombatBingo = factory(root.ConceptCombatMint);
})(typeof self !== "undefined" ? self : this, function (Mint) {
  const BOOK = { fee: 0.10, floor: 5,
    tiers: { defeated: 1.0, submitted: 1.25, captured: 1.5 },
    coldCasePer: 10, coldCaseRate: 0.05 };
  const createStore = () => ({ bounties: {}, collected: [], log: [] });

  // Post: name the head, escrow UP FRONT (no phantom bounties).
  function post(store, { head, poster, amount, battle = 0 }) {
    if (!head || !poster) return { error: "a bounty needs a head and a poster" };
    if (store.bounties[head]) return { error: `${head} is already listed` };
    if (!(amount >= BOOK.floor)) return { error: `no head worth less than ${BOOK.floor} Seeds` };
    store.bounties[head] = { head, poster, amount, postedBattle: battle };
    store.log.push(`${poster} posts ${head} for ${amount} (escrowed).`);
    return { ok: true, escrow: { from: poster, seeds: amount } };
  }

  // Claim: proof = battle record + head's mark. Tiered mercy gradient;
  // cold cases appreciate +5% per 10 battles. Collected = delisted.
  function claim(store, { head, hunter, proof, battle = 0 }) {
    const b = store.bounties[head];
    if (!b) {
      if (store.collected.some((c) => c.head === head))
        return { error: `${head} already collected — no double-claims` };
      return { error: `${head} is not listed` };
    }
    if (head === hunter) {
      const mark = { kind: "fraud", label: `self-bounty on ${head}`, round: battle };
      store.log.push(`${hunter} claimed their own head: FRAUD, marked.`);
      return { error: "self-bounty is fraud", mark };
    }
    // AP-01 (2b): proof is attested shape only — a bare string is refused,
    // the tier lookup is own-key (no constructor/toString inherit), and the
    // battle is the CALLER's (engine) context, never the claimant's.
    // Full record-attestation (battle-ledger verification) waits on wiring.
    if (typeof proof !== "object" || !proof)
      return { error: "proof must be { result } (defeated, submitted, or captured); bare strings are refused" };
    const res = proof.result;
    if (typeof res !== "string" || !Object.hasOwn(BOOK.tiers, res))
      return { error: `proof must be defeated, submitted, or captured (got ${res})` };
    const tier = BOOK.tiers[res];
    const age = Math.max(0, battle - b.postedBattle);
    const raw = Math.round(b.amount * tier * (1 + BOOK.coldCaseRate * Math.floor(age / BOOK.coldCasePer)));
    // Hardening (relay-1000): escrow returns whole — the poster's own Seeds,
    // not mint. Only the premium is new money, and it pays through the mint
    // cap. Mint dark (unwired) → the premium is HELD, never paid open.
    const prem = Math.max(0, raw - b.amount);
    const m = Mint && Mint.capped ? Mint.capped("bingo", prem) : { seeds: 0, flag: "mint dark: premium held" };
    const payout = b.amount + m.seeds;
    delete store.bounties[head];
    store.collected.push({ head, hunter, proof, payout, battle });
    store.log.push(`${hunter} collects ${head} (${res}, ${payout}).`);
    return { ok: true, payout: { to: hunter, seeds: payout }, tier: res, mintFlag: m.flag };
  }

  // Retract: poster only; unclaimed escrow returns minus the 10% book fee.
  function retract(store, { head, poster }) {
    const b = store.bounties[head];
    if (!b) return { error: `${head} is not listed` };
    if (b.poster !== poster) return { error: "only the poster retracts" };
    const refund = Math.round(b.amount * (1 - BOOK.fee));
    delete store.bounties[head];
    store.log.push(`${poster} retracts ${head} (fee ${b.amount - refund}).`);
    return { ok: true, refund: { to: poster, seeds: refund } };
  }

  // Arranged-loss collusion: the hunter forfeits the head — bounty voided,
  // escrow back to the poster minus fee — and takes a fraud mark.
  function flagFraud(store, { head, hunter, battle = 0 }) {
    const b = store.bounties[head];
    const mark = { kind: "fraud", label: `arranged loss on ${head} (${hunter})`, round: battle };
    if (b) {
      const refund = Math.round(b.amount * (1 - BOOK.fee));
      delete store.bounties[head];
      store.log.push(`${head} voided for collusion; ${hunter} marked.`);
      return { ok: true, mark, refund: { to: b.poster, seeds: refund } };
    }
    store.log.push(`${hunter} marked for collusion (no live bounty).`);
    return { ok: true, mark };
  }

  const list = (store) => Object.values(store.bounties);

  return { BOOK, createStore, post, claim, retract, flagFraud, list };
});
