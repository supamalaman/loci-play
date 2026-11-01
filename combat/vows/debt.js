"use strict";
// Debt (W2.2 build): borrow from the future, pay with interest, or go broke
// loudly. One book per caster: borrow +40 tempo +5 ΦF (once per turn),
// the loan compounds per round, earned tempo auto-pays it, and the books
// close when the lender falls. Bankruptcy (automatic when loan+interest
// exceeds current ΦF, or voluntary) seals techniques+ults for 3 rounds of
// service + a prison turn, then the debt is void. Basics, strikes and
// movement are never sealed. Stipends pay account debts first.
//   RULES / LENDERS                → tunables + the four lenders
//   book(s, id)                      → the caster's one tracker (created owed-0)
//   borrow(s, H, id, lenderId)       → +40 tempo +5 ΦF, loan += 45, maybe a visit
//   repay(s, H, id)                  → Seeds clear the book (bank asks double)
//   settleVisit(s, H, id)            → 2 inspiration clears the creditor's visit
//   bankrupt(s, H, id, voluntary)    → seal + prison + 3 rounds of service
//   turnStart(s, a, H)               → prison skips; earned tempo auto-pays
//   roundHook(s, H)                  → interest, weakness, dismissal, default, visits
//   claimStipend(account, seeds)     → stipends pay account debts first
//   finishOwed(s)                    → battle remainder → account Seeds debt
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatDebt = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = {
    borrowTempo: 40, borrowPf: 5, principal: 45, baseRate: 0.10, bankRateMul: 2,
    defaultRounds: 3, freezeTurns: 5, visitChance: 0.10, visitRounds: 2, visitCostInspiration: 2,
    sealRounds: 3, seedsPerTempoMonster: 1, seedsPerTempoBank: 2,
  };
  const LENDERS = [
    { id: "wisdom", name: "Wisdom", rate: 0.10, cap: 200, kind: "monster", unit: false },
    { id: "bank", name: "Monster Bank", rate: 0.20, cap: 400, kind: "bank", unit: false },
    { id: "orc", name: "Orcish lender", rate: 0.10, cap: 150, kind: "monster", unit: true },
    { id: "beggars", name: "Beggars", rate: 0.05, cap: 60, kind: "monster", unit: false },
  ];
  const lenderOf = (id) => LENDERS.find((l) => l.id === id) || null;
  const r2 = (n) => Math.round(n * 100) / 100;
  const seedRate = (l) => (l.kind === "bank" ? RULES.seedsPerTempoBank : RULES.seedsPerTempoMonster);
  function book(s, id) {
    s.debtBooks ||= {};
    return (s.debtBooks[id] ||= { lender: null, owed: 0, roundsOwed: 0, frozenUntil: -1, borrowedRound: -1, serviceLeft: 0 });
  }
  const standingFoes = (s) => Object.values(s.actors || {}).filter((u) => u.side === "enemy" && !u.defeated && !u.escaped && !u.fled);

  function borrow(s, H, id, lenderId) {
    const a = s.actors[id], b = book(s, id), L = lenderOf(lenderId);
    if (!a || a.defeated) return { ok: false, error: "No one left to borrow." };
    if (!L) return { ok: false, error: "No such lender." };
    if (s.round <= b.frozenUntil) return { ok: false, error: `Credit frozen until round ${b.frozenUntil + 1}.` };
    if (b.borrowedRound === s.round) return { ok: false, error: "Once per turn: the books need a night to lie." };
    if (b.owed + RULES.principal > L.cap) return { ok: false, error: `${L.name} caps at ${L.cap} (owes ${b.owed}).` };
    let unitId = null;
    if (L.unit) {
      const muscle = standingFoes(s)[0];
      if (!muscle) return { ok: false, error: "No local muscle holds orcish notes right now." };
      unitId = muscle.id;
    }
    b.lender = lenderId; b.unitId = unitId; b.owed = r2(b.owed + RULES.principal); b.borrowedRound = s.round;
    a.tempo = (a.tempo || 0) + RULES.borrowTempo; a.tempoCapacity = Math.max(a.tempoCapacity || 0, a.tempo);
    a.pf = Math.min(a.maxPF ?? 30, (a.pf || 0) + RULES.borrowPf);
    a.status = a.status || {}; a.status.indebted = { lender: lenderId, since: s.round };
    H.log(s, { kind: "debt", actor: id, text: `${a.name} borrows from ${L.name}: +${RULES.borrowTempo} tempo, +${RULES.borrowPf} ΦF. Owes ${b.owed} at ${Math.round(L.rate * 100)}%/round${unitId ? ` (held by ${s.actors[unitId]?.name || "muscle"})` : ""}.` });
    if (H.seededChance && H.seededChance(`${s.seed}:debt:${id}:${s.round}:visit`) < RULES.visitChance) {
      (s.debtVisits ||= {})[id] = { untilRound: s.round + RULES.visitRounds };
      H.log(s, { kind: "debt", actor: id, text: "A creditor is coming to look at the books. Settle the visit (Talk) before round " + (s.round + RULES.visitRounds + 1) + "." });
    }
    return { ok: true };
  }
  function repayCost(b) {
    const L = lenderOf(b.lender);
    return L ? Math.ceil(b.owed * seedRate(L)) : 0;
  }
  function clearBook(s, id, why) {
    const b = book(s, id);
    if (b.unitId && s.actors[b.unitId]) {   // dismissal restores the lender (sim pin)
      const u = s.actors[b.unitId];
      u.pf = Math.min(u.maxPF ?? 30, (u.pf ?? 0) + b.owed);
    }
    b.lender = null; b.unitId = null; b.owed = 0; b.roundsOwed = 0; b.serviceLeft = 0;
    const a = s.actors[id];
    if (a?.status) { delete a.status.indebted; if (a.status.sealed?.by === "debt") { delete a.status.sealed; delete a.status.debtPrison; } }   // a paid or voided book lifts its own seal (audit 1.3.448)
    if (why) H_log(s, id, why);
  }
  function H_log(s, id, text) { (s.log || []).push({ kind: "debt", actor: id, text }); }
  function repay(s, H, id) {
    const a = s.actors[id], b = book(s, id);
    if (!a || a.defeated) return { ok: false, error: "No one left to pay." };
    if (!(b.owed > 0)) return { ok: false, error: "No debts to pay." };
    const cost = repayCost(b);
    if ((s.seeds ?? 0) < cost) return { ok: false, error: `The purse holds ${s.seeds ?? 0} Seeds; the note wants ${cost}.` };
    s.seeds -= cost;
    H.log(s, { kind: "debt", actor: id, text: `${a.name} pays ${cost} Seeds and the book closes (was ${b.owed}).` });
    clearBook(s, id);
    return { ok: true, cost };
  }
  function settleVisit(s, H, id) {
    const a = s.actors[id], v = s.debtVisits?.[id];
    if (!v) return { ok: false, error: "No creditor visit to settle." };
    if ((a?.inspiration || 0) < RULES.visitCostInspiration) return { ok: false, error: `Settling needs ${RULES.visitCostInspiration} inspiration.` };
    a.inspiration -= RULES.visitCostInspiration;
    delete s.debtVisits[id];
    H.log(s, { kind: "debt", actor: id, text: `${a.name} settles the visit (${RULES.visitCostInspiration} inspiration): the creditor leaves happy.` });
    return { ok: true };
  }
  function bankrupt(s, H, id, voluntary) {
    const a = s.actors[id], b = book(s, id);
    if (!a || a.defeated) return { ok: false, error: "No one left to break." };
    if (!(b.owed > 0)) return { ok: false, error: "No debts to shed." };
    a.status = a.status || {};
    a.status.sealed = { untilRound: s.round + RULES.sealRounds, by: "debt" };
    a.status.debtPrison = { round: s.round };
    b.serviceLeft = RULES.sealRounds;
    H.log(s, { kind: "debt", actor: id, text: `${a.name} goes bankrupt${voluntary ? " (voluntary filing)" : ""}: techniques and ults sealed ${RULES.sealRounds} rounds of service + a prison turn. Basics, strikes and feet stay free.` });
    return { ok: true };
  }
  function turnStart(s, a, H) {
    if (a.status?.debtPrison) {
      delete a.status.debtPrison;
      a.tempo = 0;
      H.log(s, { kind: "debt", actor: a.id, text: `${a.name} sits the prison turn: no tempo, but the debt waits.` });
      return;
    }
    const b = book(s, a.id);
    if (b.owed > 0 && a.tempo > 0) {
      const pay = Math.min(b.owed, a.tempo);
      a.tempo = r2(a.tempo - pay); b.owed = r2(b.owed - pay);
      H.log(s, { kind: "debt", actor: a.id, text: `${a.name}'s earnings pay the book: −${pay} (${b.owed} remains).` });
      if (!(b.owed > 0)) { clearBook(s, a.id); H.log(s, { kind: "debt", actor: a.id, text: `${a.name} is debt-free.` }); }
    }
  }
  function owedOut(s, unitId) {
    return Object.values(s.debtBooks || {}).filter((b) => b.unitId === unitId && b.owed > 0).reduce((n, b) => n + b.owed, 0);
  }
  function roundHook(s, H) {
    for (const [id, b] of Object.entries(s.debtBooks || {})) {
      const a = s.actors[id];
      if (!a || a.defeated || !(b.owed > 0)) continue;
      const L = lenderOf(b.lender);
      if (b.serviceLeft > 0) {   // bankruptcy service: count down, then void
        b.serviceLeft -= 1;
        if (b.serviceLeft <= 0) {
          if (a.status?.sealed?.by === "debt") delete a.status.sealed;
          H.log(s, { kind: "debt", actor: id, text: `${a.name} finishes ${RULES.sealRounds} rounds of service: the debt is void, the seal lifts.` });
          clearBook(s, id);
        }
        continue;
      }
      if (!L) continue;
      if (b.unitId) {   // the books close when the muscle falls
        const u = s.actors[b.unitId];
        if (!u || u.defeated || u.escaped || u.fled) {
          H.log(s, { kind: "debt", actor: id, text: `Down goes the lender (${u?.name || "muscle"}): the books close, ${b.owed} void.` });
          clearBook(s, id);
          continue;
        }
        u.pf = Math.min(u.pf ?? 0, Math.max(0, (u.maxPF ?? 30) - owedOut(s, b.unitId)));   // lender weakened while owed
      }
      b.owed = r2(b.owed * (1 + L.rate)); b.roundsOwed += 1;   // interest compounds (sim pin)
      if (b.owed > (a.pf ?? 0)) { bankrupt(s, H, id, false); continue; }   // exact trigger: loan+interest > ΦF (sim pin)
      if (b.roundsOwed >= RULES.defaultRounds) {   // default: repossess the purse, then prison + freeze
        const cost = repayCost(b), purse = s.seeds ?? 0, seized = Math.min(purse, cost);
        if (seized > 0) { s.seeds = purse - seized; b.owed = r2(b.owed - seized / seedRate(L)); }
        if (!(b.owed > 0)) {
          H.log(s, { kind: "debt", actor: id, text: `Default: the creditor repossesses ${seized} Seeds and the book closes.` });
          clearBook(s, id);
        } else {
          b.frozenUntil = s.round + RULES.freezeTurns;
          a.status = a.status || {}; a.status.debtPrison = { round: s.round };
          H.log(s, { kind: "debt", actor: id, text: `Default (${b.owed} past ${RULES.defaultRounds} rounds): repossessed ${seized} Seeds, prison turn, credit frozen ${RULES.freezeTurns} rounds.` });
        }
      }
    }
    for (const [id, v] of Object.entries(s.debtVisits || {})) {   // visits lapse into a freeze
      if (s.round > v.untilRound) {
        delete s.debtVisits[id];
        book(s, id).frozenUntil = s.round + RULES.freezeTurns;
        H.log(s, { kind: "debt", actor: id, text: `The creditor found closed books: credit frozen ${RULES.freezeTurns} rounds.` });
      }
    }
  }
  function finishOwed(s) {
    const out = [];
    for (const [id, b] of Object.entries(s.debtBooks || {})) {
      if (!(b.owed > 0)) continue;
      const L = lenderOf(b.lender);
      if (L) out.push({ actor: id, lender: b.lender, tempo: b.owed, seeds: Math.ceil(b.owed * seedRate(L)) });
    }
    return out;
  }
  function claimStipend(account, seeds) {
    const debt = Math.max(0, account.debt || 0);
    const paid = Math.min(debt, seeds);
    account.debt = debt - paid;
    return { paid, remainder: seeds - paid };
  }
  return { RULES, LENDERS, book, borrow, repay, repayCost, settleVisit, bankrupt, turnStart, roundHook, finishOwed, claimStipend, owedOut };
});
