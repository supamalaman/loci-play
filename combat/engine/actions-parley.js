"use strict";
// Actions, the parley family: declineOrder, blessing, terms, tallySettle, tallyTerms, stakes, setIntent, revealIntent, myol, stakeSeeds, doubleDown, answerTerms, mediate, order, parley, invokeTrial, trialPlay, trialDefend.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsParley = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { Bonds, Courtroom, MindDuel, Parley, classH, log, spendTempo } = H;
    const { Orders, talkCost, talkedTooFast } = K;
    const family = {
      declineOrder(s,a) {
        const order=a.pendingOrder;if(!order)return "There is no Executive Direction to decline.";
        a.pendingOrder=null;const issuer=s.actors[order.by];if(issuer&&!issuer.defeated)issuer.pf=Math.min(issuer.maxPF,issuer.pf+5);
        log(s,{kind:"order",actor:a.id,target:order.by,text:`${a.name} declines Executive Direction; the President's ΦF cost is refunded.`});
      },
      blessing(s, a, act) { return Bonds ? Bonds.bless(s, a, act, classH()) || undefined : "Bonds are unavailable."; },   // Bonds: Blessing of Malnote (free)
      terms(s, a, act) {   // Parley: come to terms with someone standing down
        if (!Parley) return "Parley is unavailable.";
        const t = s.actors[act.target], why = Parley.canTerms(s, a, t); if (why) return why;
        const spend = spendTempo(s, a, Parley.rules.termsCost, "Come to terms"); if (spend) return spend;
        Parley.comeToTerms(s, a, t, { log });
      },
      tallySettle(s, a) {   // the ledger boss: pay AP now against the account (engine/tally.js)
        if (!H.Tally) return "There is no account to settle.";
        return H.Tally.settle(s, a) || undefined;
      },
      tallyTerms(s, a, act) {   // the ledger boss's offer: accept or decline (no AP; engine/tally.js)
        if (!H.Tally) return "There are no terms on the table.";
        return H.Tally.answer(s, a, act.target, !!act.accept) || undefined;
      },
      stakes(s, a, act) {   // Ante (W1.5): propose your lot to the enemy leader, round 1, pre-blood. No AP: refusing is free, and so is asking.
        if (!H.antePropose) return "No one holds stakes here.";
        if (a.id !== "player" && !act.fromAi) return "Only the player proposes stakes; the AI answers.";
        if (!Array.isArray(act.lot) || !act.lot.length) return "Stake something.";
        return H.antePropose(s, a, act.lot, H, !!act.conceal) || undefined;
      },
      setIntent(s, a, act) {   // Mystery (Muse W2.5): Techniques ▸ Set — pay now, trigger later. Silent: no announce, no knowledge leak.
        if (!H.mysterySet) return "No mystery here.";
        return H.mysterySet(s, a, act.ability, act.trigger, act.target) || undefined;
      },
      revealIntent(s, a, act) {   // Mystery (Muse W2.5): reveal + fire the oldest manual card (T1+ announce). Free: prepaid at set.
        if (!H.mysteryReveal) return "No mystery here.";
        const why = ["for the kill", "before it fades", "seizes the exchange"].includes(act.why) ? act.why : undefined;   // RIK R1: the AI's three reasons; the UI sends none, so a player reveal reads "revealed by hand"
        return H.mysteryReveal(s, a, act.target, why, why === "seizes the exchange" ? act.exchange : null) || undefined;
      },
      myol(s, a, act) {   // MYOL (W5.3): buy the failed trick back after seeing the roll. No AP; Seeds leave the account in the UI.
        if (!H.myolApply) return "No luck to make here.";
        if (a.id !== "player" && !act.fromAi) return "Only the player buys luck.";   // W5.1: the AI buys through fromAi (stakes precedent)
        const purse = s.seeds ?? 0, cost = H.myolCost(s.myolUses?.[a.id] || 0);   // the battle's own purse when it has one: the UI copies s.seeds to the account after every act
        const no = H.myolEligible(s, a, purse);
        if (no) return no;
        const r = H.myolApply(s, a, H);
        if (r.fizzled) return "The moment passed: nothing left to buy.";
        if (s.seeds != null) s.seeds = Math.max(0, s.seeds - cost);
        return undefined;
      },
      stakeSeeds(s, a, act) {   // Hyper-staking (W5.3): post Seeds on your next trick (imitate/tame). No AP; UI escrows.
        if (!H.stakeBonus) return "No bookmaker here.";
        if (a.id !== "player") return "Only the player stakes.";
        const seeds = Math.floor(act.seeds || 0);
        if (!(seeds >= 5)) return "Stake at least 5 Seeds.";
        if (s.staked) return "A stake already rides your next trick.";
        if (s.seeds != null && s.seeds < seeds) return `You hold ${s.seeds} Seeds.`;
        if (s.seeds != null) s.seeds -= seeds;   // escrowed from the battle's purse (settleStake pays it back on a win)
        s.staked = { actor: a.id, seeds };
        log(s, { kind: "stake", actor: a.id, text: `${a.name} sweats ${seeds} Seeds on the next trick.`, why: ["Win the trick: stake back plus half again (55 mint cap a battle). Lose it: the stake burns."] });
        return undefined;
      },
      doubleDown(s, a) {   // Rhythm of madness (W5.3): cash heat in for charge. Free, heat 2+, once a battle.
        if (!H.gamblerOf || !H.gamblerOf(s, a)) return "Only a gambler doubles down.";
        if (a.id !== "player") return "Only the player doubles down.";
        if (s.doubledDown) return "Doubled down already this battle.";
        const heat = H.heatOf(s, a.id);
        if (heat < 2) return "Build heat first: end turns holding 40+ AP.";
        const gain = heat * H.hyperRules.heat.doubleChargePer;
        a.ultimateCharge = Math.min(s.rules.ultimateChargeMax, (a.ultimateCharge || 0) + gain);
        s.heat[a.id] = 0; s.doubledDown = true;
        log(s, { kind: "double", actor: a.id, text: `${a.name} DOUBLES DOWN: heat ${heat} becomes +${gain} charge.`, why: ["Escalating stakes, cashed at the peak: the heat is spent, not kept."] });
        return undefined;
      },
      answerTerms(s, a, act) {   // Parley: accept or decline a talkative NPC's terms (no AP)
        if (!Parley) return "Parley is unavailable.";
        return Parley.answerOffer(s, a, s.actors[act.target], !!act.accept, { log }) || undefined;
      },
      mediate(s, a, act) {   // a hired mediator asks one enemy for a truce (engine/hires.js)
        return H.Hires.mediate(s, a, act) || undefined;
      },
      order(s, a, act) {   // Talk orders (SPIRIT-ORDER half 2): 10 AP (Speed-Talker halves it) to give an ally a role to weigh for 3 rounds. Refused orders cost only the AP.
        const O = Orders(); if (!O) return "No orders today.";
        const t = s.actors[act.target];
        const spend = spendTempo(s, a, talkCost(a, "talk", s.rules.orders?.ap ?? 10), "Talk"); if (spend) return spend;
        const r = O.issue(s, a, t, act.role, act.focus, H);
        if (!r.ok) { a.tempo += talkCost(a, "talk", s.rules.orders?.ap ?? 10); return r.error; }   // invalid orders refund; refused ones don't
        return;
      },
      parley(s, a, act) {   // Parley: a talkative NPC talks at someone
        if (!Parley) return "Parley is unavailable.";
        if (a.awakened) return "A woken structure does not talk.";
        const t = s.actors[act.target];
        if (!t || t.defeated || H.Instinct.hidden(a, t)) return "There's no one to talk to.";
        const spend = spendTempo(s, a, talkCost(a, "talk", Parley.rules.npcTalkCost), "Talk"); if (spend) return spend;
        if (talkedTooFast(s, a, t, "talk")) { log(s, { kind: "parley", actor: a.id, target: t.id, fizzled: true, text: `${a.name} talks too fast and it goes past ${t.name}.`, why: ["Speed-Talker: half the action points, and it lands 85% as often."] }); return; }
        const out = Parley.npcTalk(s, a, t, { log, MindDuel });
        H.spreadByTalk?.(s, a, t);   // contagious ideas: a carrier's talk is a vector (faith)
        if (out === "talk" && MindDuel) { const opened = MindDuel.openDuel(s, a.id, t.id, { log, Parley }); if (opened) return opened; }
      },
      invokeTrial(s, a, act) {   // W1.3: Rituals ▸ mock-trial rite — 1 banked rite step + presented evidence + real counts
        if (!Courtroom) return "No court today.";
        if (a.id !== "player") return "Only the player invokes (driven-only).";
        const no = Courtroom.canInvoke(s, H, a.id, act.target);
        if (no) return no;
        if ((a.tempo || 0) < Courtroom.RULES.invokeTempo) return `Mock-trial needs ${Courtroom.RULES.invokeTempo} tempo.`;
        a.tempo -= Courtroom.RULES.invokeTempo;
        const r = Courtroom.invoke(s, H, a.id, act.target);
        if (!r.ok) return r.error;
      },
      trialPlay(s, a, act) {   // W1.3: Talk ▸ trial rows — the invoker queues prosecution plays
        if (!Courtroom) return "No court today.";
        if (a.id !== "player" || !s.trial || s.trial.over) return "No trial in session.";
        if ((a.tempo || 0) < Courtroom.RULES.playTempo) return `Trial plays need ${Courtroom.RULES.playTempo} tempo.`;
        const no = Courtroom.queuePlay(s, act.move);
        if (no) return no;
        a.tempo -= Courtroom.RULES.playTempo;
        log(s, { kind: "trial", actor: a.id, text: `${a.name} queues the prosecution's ${act.move}.` });
      },
      trialDefend(s, a, act) {   // arrest-trial: the accused (player) queues their own defense
        if (!Courtroom) return "No court today.";
        if (a.id !== "player" || !s.trial || s.trial.over) return "No trial in session.";
        if (s.trial.accusedId !== "player") return "Only the accused directs the defense.";
        if ((a.tempo || 0) < Courtroom.RULES.playTempo) return `Trial plays need ${Courtroom.RULES.playTempo} tempo.`;
        const no = Courtroom.queueDefense(s, act.move);
        if (no) return no;
        a.tempo -= Courtroom.RULES.playTempo;
        log(s, { kind: "trial", actor: a.id, text: `${a.name} prepares the defense's ${act.move}.` });
      },
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-parley.js)`);
    Object.assign(K.handlers, family);
  })();
});
