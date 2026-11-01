"use strict";
// The ledger boss (sealed; numbers in bosses/boss-data.js `bosses.tallyman.ledger`). Everything rides the game's existing
// tempo debt: a loan is AP banked now and tempo debt that lands later; Tally Up reads what you owe; the Margin Call calls
// it all in. Valves (docs: claude/secret-warrior room): debt is capped by rules.maxTempoDebt (the rest comes out of LF),
// turn-start collection always leaves `floor` AP, and the books burn once when he is burst hard in one round.
// A part of the Concept Combat engine: engine.js installs it with the host object H.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).tally = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { C, abilitiesOf, addStun, bossRules, hit, log } = H;
    const seededChance = (...args) => H.seededChance(...args);   // late binding: queries installs before this part, but keep it call-time
    const BOSS = "tallyman", ID = (k) => `boss_${BOSS}_${k}`;
    const L = () => bossRules?.data?.bosses?.[BOSS]?.ledger;
    const MANUAL = new Set([ID("theOffer"), ID("marginCall"), ID("compoundInterest")]);   // chosen by Tally.aiAction, never by the generic scorer
    const live = (u) => !!u && !u.defeated && !u.escaped && !u.notArrived;

    const Tally = {
      is: (u) => !!u && u.boss === BOSS,
      lender(s) { return s.tallyInert ? null : Object.values(s.actors || {}).find((u) => Tally.is(u) && live(u)) || null; },   // tallyInert: the sim baseline (the same body, no ledger)
      // A debtor: anyone not on the Tallyman's side while he stands.
      binds(s, u) { const t = s && Tally.lender(s); return !!t && !!u && u.side !== t.side && !Tally.is(u); },
      book: (u) => (u.tally ||= { loans: [] }),
      pending: (u) => (u?.tally?.loans || []).reduce((n, l) => n + l.debt, 0),
      outstanding: (u) => (u?.tempoDebt || 0) + Tally.pending(u),

      // Add debt now, capped by rules.maxTempoDebt; the excess is collected from Life Force.
      charge(s, lender, u, debt, why) {
        const cap = s.rules.maxTempoDebt, room = Math.max(0, cap - (u.tempoDebt || 0)), land = Math.min(room, debt), over = debt - land;
        u.tempoDebt = (u.tempoDebt || 0) + land;
        if (over > 0) {
          const lf = Math.ceil(over * L().excessLfPerAp);
          hit(s, lender, u, { name: "Collection", ability: null, damageType: "citrinitas" }, lf, [`${over} AP past the ${cap} AP debt limit is collected from Life Force.`], { revealField: true });
        }
        return land;
      },
      lend(s, lender, u, { ap, debt, delay }, label) {
        if (!Tally.binds(s, u)) return false;
        u.bankedTempo = (u.bankedTempo || 0) + ap;
        Tally.book(u).loans.push({ debt, turns: delay, by: lender.id, label });
        log(s, { kind: "tally", actor: lender.id, target: u.id, loan: { ap, debt, delay }, text: `${lender.name} lends ${u.name} ${ap} AP for their next turn; ${debt} AP falls due the turn after (${label}).` });
        return true;
      },

      // turns.js, before the debt is paid: loans that come due this turn land as tempo debt. Returns the AP floor.
      turnStart(s, a) {
        if (Tally.is(a) && s.tally?.offers) s.tally.offers = {};   // his own turn: unanswered terms lapse
        if (Tally.is(a) && s.tally?.call?.by === a.id) { s.tally.call = null; Tally.marginCall(s, a); }   // the call he announced last turn lands now
        const loans = a.tally?.loans;
        if (loans?.length && !Tally.lender(s)) { a.tally.loans = []; log(s, { kind: "tally", actor: a.id, text: `${a.name}'s open loans die with the lender.` }); }
        else if (loans?.length) {
          const due = [];
          for (const l of loans) { l.turns -= 1; if (l.turns <= 0) due.push(l); }
          a.tally.loans = loans.filter((l) => l.turns > 0);
          for (const l of due) {
            const lender = s.actors[l.by] || { id: l.by, name: "The Tallyman", side: "enemy" };
            const land = Tally.charge(s, lender, a, l.debt);
            log(s, { kind: "tally", actor: l.by, target: a.id, text: `${a.name}'s loan falls due: ${l.debt} AP (${l.label})${land < l.debt ? `; ${l.debt - land} AP past the limit comes out of Life Force` : ""}.` });
          }
        }
        return Tally.binds(s, a) ? L().floor : 0;
      },

      // Collateral: at or above the threshold, the debtor's highest-cost technique is held until the account drops below it.
      held(s, u) {
        if (!Tally.binds(s, u) || Tally.outstanding(u) < L().collateral.threshold) return null;
        const tier = { ultimate: 3, refined: 2, basic: 1 };
        let best = null;
        for (const id of abilitiesOf(u)) {
          const m = C.abilities[id]; if (!m || (m.reactive && !m.answer) || !(m.cost > 0)) continue;   // an answer ultimate is still an ultimate the ledger can hold
          if (!best || m.cost > best.m.cost || (m.cost === best.m.cost && (tier[m.tier] || 0) > (tier[best.m.tier] || 0)) || (m.cost === best.m.cost && m.tier === best.m.tier && id < best.id)) best = { id, m };
        }
        return best?.id || null;
      },
      heldReason(s, u, abilityId) {
        if (Tally.held(s, u) !== abilityId) return null;
        return `${C.abilities[abilityId]?.name || "That technique"} is held as collateral: you owe ${Tally.outstanding(u)} AP; it returns the moment you owe less than ${L().collateral.threshold}.`;
      },

      // The Offer: terms to every debtor within range. The player answers from the menu; AI fighters decide on the spot.
      offer(s, a) {
        const O = L().offer, offers = ((s.tally ||= {}).offers ||= {});
        const near = Object.values(s.actors).filter((u) => live(u) && Tally.binds(s, u) && H.dist(s, a.x, a.y, u.x, u.y) <= O.range && !u.summon && !u.wild);
        if (!near.length) { log(s, { kind: "tally", actor: a.id, text: `${a.name} holds out his terms. Nobody is close enough to take them.` }); return; }
        for (const u of near) {
          if (u.controller === "player") {
            offers[u.id] = { by: a.id, round: s.round };
            log(s, { kind: "tally", actor: a.id, target: u.id, offer: true, text: `${a.name} offers ${u.name} terms: ${O.ap} AP on your next turn, ${O.debt} AP owed the turn after.`, why: ["Accept or decline from the menu (no AP). Ignoring it declines when his next turn starts. Read the fine print."] });
          } else {
            const take = Tally.outstanding(u) + O.debt < L().collateral.threshold && seededChance(`${s.seed}:tally:accept:${u.id}:${s.round}`) < L().aiAccept.chance;
            if (take) Tally.lend(s, a, u, O, "The Offer");
            else log(s, { kind: "tally", actor: a.id, target: u.id, text: `${u.name} declines ${a.name}'s terms.` });
          }
        }
      },
      answer(s, u, lenderId, accept) {
        const o = s.tally?.offers?.[u.id];
        if (!o || o.by !== lenderId) return "There are no terms on the table.";
        delete s.tally.offers[u.id];
        const lender = s.actors[o.by];
        if (!accept || !live(lender)) { log(s, { kind: "tally", actor: u.id, target: o.by, text: `${u.name} declines the terms.` }); return null; }
        Tally.lend(s, lender, u, L().offer, "The Offer");
        return null;
      },
      // Settle up: pay AP now against your account, loans not yet due first, then tempo debt. 1 AP clears 1 AP.
      settle(s, u) {
        if (!Tally.binds(s, u)) return "There is no account to settle.";
        const owed = Tally.outstanding(u), pay = Math.min(u.tempo || 0, owed);
        if (!owed) return "You owe him nothing.";
        if (!pay) return "Settling needs action points.";
        let left = pay;
        for (const l of Tally.book(u).loans) { const take = Math.min(l.debt, left); l.debt -= take; left -= take; }
        u.tally.loans = u.tally.loans.filter((l) => l.debt > 0);
        const fromDebt = Math.min(u.tempoDebt || 0, left); u.tempoDebt -= fromDebt; left -= fromDebt;
        u.tempo -= pay; u.tempoSpent = (u.tempoSpent || 0) + pay; u.acted = true;
        log(s, { kind: "tally", actor: u.id, settled: pay, text: `${u.name} settles ${pay} AP against the account (${Tally.outstanding(u)} AP still owed).` });
        return null;
      },
      // An AI-driven fighter holding terms (the hero in autoplay and sims) answers them by the same rule AI fighters use.
      aiAnswer(s, a) {
        const o = s.tally?.offers?.[a.id]; if (!o) return null;
        const take = Tally.outstanding(a) + L().offer.debt < L().collateral.threshold && seededChance(`${s.seed}:tally:accept:${a.id}:${s.round}`) < L().aiAccept.chance;
        return { type: "tallyTerms", actor: a.id, target: o.by, accept: take };
      },
      // An AI debtor with a call on the table spends what is left of its turn paying it down.
      aiSettle(s, a) {
        if (!s.tally?.call || !Tally.binds(s, a) || !Tally.outstanding(a) || (a.tempo || 0) < Math.min(10, Tally.outstanding(a))) return null;
        return { type: "tallySettle", actor: a.id };
      },
      debtPainMul: (s, a) => (Tally.binds(s, a) ? 2 : 1),   // the AI prices owing him at double: he collects with interest
      offersFor: (s, id) => Object.entries(s.tally?.offers || {}).filter(([to]) => to === id).map(([, o]) => ({ from: o.by, name: s.actors[o.by]?.name || "him", ...L().offer })),

      marginCall(s, a) {
        const M = L().marginCall;
        for (const u of Object.values(s.actors)) {
          if (!live(u) || !Tally.binds(s, u)) continue;
          const loans = u.tally?.loans || [];
          if (!loans.length && !(u.tempoDebt > 0)) continue;
          Tally.book(u).loans = [];
          for (const l of loans) Tally.charge(s, a, u, l.debt);
          Tally.charge(s, a, u, M.fee);
          const owed = Tally.outstanding(u), dmg = Math.min(M.cap, Math.round(M.base + M.per * owed));
          log(s, { kind: "tally", actor: a.id, target: u.id, text: `${u.name}'s account is called in: ${owed} AP owed.` });
          hit(s, a, u, { name: "The Margin Call", ability: ID("marginCall"), damageType: "citrinitas" }, dmg, [`Margin Call: ${M.base} + ${M.per} × ${owed} AP owed (at most ${M.cap}).`], { revealField: true });
        }
      },
      interest(s, a) {
        const I = L().interest;
        for (const u of Object.values(s.actors)) {
          if (!live(u) || !Tally.binds(s, u) || !(u.tempoDebt > 0)) continue;
          const add = Math.max(I.min, Math.round(u.tempoDebt * I.mul));
          Tally.charge(s, a, u, add);
          log(s, { kind: "tally", actor: a.id, target: u.id, text: `Interest compounds on ${u.name}'s account: +${add} AP.` });
        }
      },

      // resolve.js: ability effects by id (the boss adapter forces every boss effect to damage/guard). Returns true when
      // the technique is fully handled here; otherwise it may return a changed inst for the normal damage path.
      resolve(s, a, inst, why) {
        if (!Tally.is(a)) return null;
        if (inst.ability === ID("theOffer")) { Tally.offer(s, a); return true; }
        if (inst.ability === ID("marginCall")) {   // announced: it lands at the start of his next turn, so there is a turn to settle up
          (s.tally ||= {}).call = { by: a.id, round: s.round };
          log(s, { kind: "tally", actor: a.id, call: true, text: `${a.name}: "All accounts... due." The Margin Call lands at the start of his next turn.`,
            why: [`Every loan falls due, ${L().marginCall.fee} AP is added to every open account, and each debtor takes ${L().marginCall.base} + ${L().marginCall.per} × what they owe (at most ${L().marginCall.cap}). Settle your account first: owe nothing and it does nothing.`] });
          return true;
        }
        if (inst.ability === ID("compoundInterest")) { Tally.interest(s, a); return true; }
        if (inst.ability === ID("shortCount")) s.tallyMark = s.log.length;
        const t = (inst.targets || []).map((id) => s.actors[id]).find((u) => u && Tally.binds(s, u));
        if (inst.ability === ID("tallyUp") && t) {
          const T = L().tallyUp, add = Math.min(T.cap, Math.floor(Tally.outstanding(t) / 10) * T.perTen);
          if (add) why.push(`Tally Up: ${t.name} owes ${Tally.outstanding(t)} AP: +${add} potency.`);
          return { ...inst, potency: inst.potency + add };
        }
        if (inst.ability === ID("foreclosure") && t && Tally.held(s, t)) {
          why.push(`Foreclosure: ${t.name}'s technique is held as collateral: ×${L().foreclosure.collateralMul}.`);
          return { ...inst, potency: Math.round(inst.potency * L().foreclosure.collateralMul) };
        }
        return null;
      },
      // After the normal damage path: Short Count's forced loan, for whoever it actually hit.
      afterResolve(s, a, inst) {
        if (!Tally.is(a) || inst.ability !== ID("shortCount") || s.tallyMark == null) return;
        const struck = new Set(s.log.slice(s.tallyMark).filter((e) => e.kind === "damage" && e.actor === a.id && e.amount > 0).map((e) => e.target));
        s.tallyMark = null;
        for (const id of struck) { const u = s.actors[id]; if (live(u)) Tally.lend(s, a, u, L().shortCount, "Short Count"); }
      },

      // damage.js: the books burn once if he loses reserves.breakAt of his LF in one round.
      afterHit(s, t, lost, src) {
        if (!Tally.is(t) || !(lost > 0) || t.tallyBroken) return;
        const R = L().reserves, book = (t.tallyRound ||= { round: s.round, lost: 0 });
        if (book.round !== s.round) { book.round = s.round; book.lost = 0; }
        book.lost += lost;
        if (book.lost < R.breakAt * t.maxLF || t.lf <= 0) return;
        t.tallyBroken = true;
        for (const u of Object.values(s.actors)) if (Tally.binds(s, u)) { u.tempoDebt = 0; if (u.tally) u.tally.loans = []; }
        if (s.tally) s.tally.offers = {};
        log(s, { kind: "tally", actor: t.id, broken: true, text: `${t.name}'s reserves break. The books burn: every account he holds is void.`, why: [`He lost ${book.lost} LF in one round (${Math.round(R.breakAt * 100)}% of his ${t.maxLF}). It happens once.`] });
        addStun(s, src || null, t, R.stun);
      },

      // ai.js: his own choices. Margin Call when the room owes enough; The Offer to a debt-free room; otherwise the generic
      // scorer over his attacks (aiAbilities excludes the manual three).
      aiAction(s, a) {
        if (!Tally.is(a)) return null;
        if (s.tally?.call) return null;   // the call is on the table: he fights normally until it lands
        a.aiAbilities = (a.bossAbilityIds || []).filter((id) => !MANUAL.has(id));
        const foes = Object.values(s.actors).filter((u) => live(u) && Tally.binds(s, u));
        const owed = foes.reduce((n, u) => n + Tally.outstanding(u), 0);
        const ready = (id) => H.availableAbilities(s, a.id).find((x) => x.id === id && x.affordable);
        const go = (id) => { const act = { type: "ability", actor: a.id, ability: id, target: [a.x, a.y] }; return H.apply(s, act, { preview: true }).ok ? act : null; };
        if (ready(ID("marginCall")) && owed >= L().collateral.threshold) { const act = go(ID("marginCall")); if (act) return act; }
        if (ready(ID("compoundInterest")) && foes.filter((u) => u.tempoDebt > 0).length >= 1 && seededChance(`${s.seed}:tally:interest:${s.round}`) < 0.5) { const act = go(ID("compoundInterest")); if (act) return act; }
        const O = L().offer, near = foes.filter((u) => H.dist(s, a.x, a.y, u.x, u.y) <= O.range && Tally.outstanding(u) < L().collateral.threshold);
        if (a.actionsThisTurn === 0 && near.length && ready(ID("theOffer")) && seededChance(`${s.seed}:tally:offer:${s.round}`) < 0.6) { const act = go(ID("theOffer")); if (act) return act; }
        return null;
      },
      // For the UI: what the player owes him and what he holds.
      status(s, id) {
        const u = s.actors[id]; if (!Tally.binds(s, u)) return null;
        const held = Tally.held(s, u);
        return { call: !!s.tally?.call, owed: Tally.outstanding(u), debt: u.tempoDebt || 0, pending: Tally.pending(u), threshold: L().collateral.threshold, held, heldName: held ? C.abilities[held]?.name : null, offers: Tally.offersFor(s, id) };
      },
    };
    return { Tally };
  })();
});
