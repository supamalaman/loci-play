"use strict";
// Actions, the turn family: end, stall, kneel, meditate, recoverWater, guard, overwatch, cower, recover.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsTurn = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { Bonds, MED, Vows, classH, endTurn, hasTrait, log, spendTempo } = H;
    const { handlers, hermitCharge, stallPreview } = K;
    const family = {
      // Mala, 2026-10-11: ending a turn banks what is left, exactly as Stall does. Throwing the points away was never
      // the better choice, so it is no longer a choice.
      // `discard: true` ends without banking; nothing in play sends it (tests and scripted scenes that need a clean budget).
      end(s, a, act) {
        if (H.Instinct.lying(a)) return H.Instinct.restTurn(s, a);   // a lying unit ends its turn without banking
        if (a.tempo > 0 && !act?.discard) return handlers.stall(s, a);
        a.tempo = 0;
        log(s, { kind: "tempo", actor: a.id, text: `${a.name} ends the turn.` });
        endTurn(s);
      },
      stall(s, a) {
        if (H.Instinct.lying(a)) return H.Instinct.restTurn(s, a);   // no Cat Nap and no bank while lying
        if (a.tempo <= 0) return "There are no action points left to bank.";
        const nap=stallPreview(s,a.id),banked=nap.banked;
        if(nap.healed){a.lf+=nap.healed;log(s,{kind:"catNap",actor:a.id,amount:nap.healed,text:`${a.name} takes a Cat Nap: spends ${nap.spent} AP to restore ${nap.healed} LF (${a.lf}/${a.maxLF}); ${banked} AP remain to bank.`,why:["5 bankable AP per LF; at most 8 LF per nap. Spent AP cannot also be banked."]});}
        { const M = s.rules.mastery, heal = M && (a.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === M.trait) ? Math.min(M.stallHeal, a.maxLF - a.lf) : 0;   // Mastery: rest is recovery
          if (heal > 0) { a.lf += heal; log(s, { kind: "effect", actor: a.id, amount: heal, text: `${a.name} stalls with a master's ease: +${heal} LF (${a.lf}/${a.maxLF}).`, why: [`Mastery: Stall also restores ${M.stallHeal} Life Force.`] }); } }
        a.bankedTempo = banked; a._heldAtEnd = banked; a.lastStallRound = s.round;   // W5.3: heat reads what the gambler held
        log(s, { kind: "stall", actor: a.id, text: `${a.name} stalls, banking ${banked} action points for a later turn${nap.overflow ? ` (the ${nap.overflow} point overflow is lost)` : ""}.`, why: [`Bank cap: ${s.rules.maxBankedActionPoints} points; unused tempo is carried only by choosing Stall.`] });
        a.tempo = 0; endTurn(s);
      },
      kneel(s, a) {
        if (a.status?.kneeling) return `${a.name} is already kneeling.`;
        const spend = spendTempo(s, a, (H.Dispatch?.RULES.kneelAp) ?? 10, "Kneel"); if (spend) return spend;
        H.Dispatch.kneel(s, H, a.id);
      },
      meditate(s, a) {   // C15: 40 AP for ultimate charge. Once per turn, any number of turns running, and no Guard in the same turn.
        if (a.ultimateCharge >= s.rules.ultimateChargeMax) return "Ultimate charge is already full.";
        if (a.lastMeditateTurn === a.ownerTurns) return "Already meditated this turn.";
        if (a.guardUsedThisTurn) return "You cannot Meditate in a turn you have Guarded.";
        const spendError = spendTempo(s, a, MED.ap, "Meditate"); if (spendError) return spendError;
        a.lastMeditateTurn = a.ownerTurns; a.meditateNoGuard = a.ownerTurns;
        const contemplative = hasTrait(a, "contemplative"), restless = hasTrait(a, "restless"), before = a.ultimateCharge;
        const PC = hasTrait(a, "perfectConcentration") ? s.rules.concentration?.perfect : null;   // Perfect Concentration meditates deeply
        a.ultimateCharge = Math.min(s.rules.ultimateChargeMax, before + (PC ? (contemplative ? PC.withContemplative : PC.meditateGain) : contemplative ? MED.contemplativeGain : restless ? MED.restlessGain : MED.gain));
        (s.meditateLog ||= []).push({ actor: a.id, round: s.round, gain: a.ultimateCharge - before, contemplative, restless });
        log(s, { kind: "charge", actor: a.id, meditate: true, text: `${a.name} meditates: +${a.ultimateCharge - before} ultimate charge (${a.ultimateCharge}/${s.rules.ultimateChargeMax}).`,
          why: ["No Guard in a turn spent meditating; every turn may hold one stillness.", ...(contemplative ? ["Contemplative: a deeper stillness (+35)."] : restless ? ["Restless: cannot settle (+15)."] : [])] });
        hermitCharge(s, a, "meditate");   // Sleep Plenty: bonus on top of the normal gain
      },
      recoverWater(s,a) {
        const option=H.waterRecovery(s,a);
        if(!option?.allowed)return "You must reach dry ground to stop drowning here.";
        const error=spendTempo(s,a,option.cost,option.label);if(error)return error;
        a.status.drowning=null;a.waterContact=H.key(a.x,a.y);a.waterSafeAt=a.waterContact;
        H.log(s,{kind:"drowning",actor:a.id,target:a.id,text:`${a.name}: ${option.label.toLowerCase()}; drowning stops.`,why:[`${option.cost} AP paid on their own turn.`]});
      },
      guard(s, a) {
        if (a.guardUsedThisTurn) return "Guard is already set for this turn.";
        if (a.meditateNoGuard === a.ownerTurns) return "You cannot Guard in a turn spent meditating.";
        if (Vows) { const no = Vows.refuses(s, a, "guard"); if (no) return no; }   // Vows: Open Guard
        const cost = s.rules.actionCosts.guard, before = a.tempo;
        const spendError = spendTempo(s, a, cost, "Guard"); if (spendError) return spendError;
        const fraction = before / Math.max(1, a.tempoCapacity);
        const reduction = Math.max(s.rules.guardReduction.min, Math.min(s.rules.guardReduction.max, s.rules.guardReduction.min + (s.rules.guardReduction.max - s.rules.guardReduction.min) * fraction));
        const multiplier = 1 - reduction; a.guardUsedThisTurn = true;
        a.status.guard = { label: "Guard", owner: a.id, expiresAt: a.ownerTurns + 1, multiplier };
        if (a.status.overwatch) { a.status.overwatch = null; log(s, { kind: "effect", actor: a.id, text: `${a.name} drops the watch to guard.` }); }   // Overwatch (Muse-2): guarding ends the watch
        log(s, { kind: "act", actor: a.id, text: `${a.name} guards: ${Math.round(reduction * 100)}% incoming LF reduction (×${multiplier.toFixed(2)}), scaling with tempo remaining, until their next turn start.` });
        if (Bonds) Bonds.afterGuard(s, a, classH());   // Bonds: Always by Your Side
        hermitCharge(s, a, "guard");   // Blocking
      },
      overwatch(s, a) {   // Overwatch (Muse-2): spend the reaction on your turn; the first foe to enter range before your next turn eats a snapshot. No Guard or dodge while watching.
        if ((a.reaction ?? 0) <= 0) return `${a.name} has no reaction left to spend on Overwatch.`;
        if (a.status.overwatch?.expiresAt > a.ownerTurns) return `${a.name} is already watching.`;
        const OW = s.rules.overwatch ?? { ap: 10, range: 4, potency: 8, owed: 25 };
        const spendError = spendTempo(s, a, OW.ap, "Overwatch"); if (spendError) return spendError;
        a.reaction -= 1;
        if (a.status.guard) { a.status.guard = null; log(s, { kind: "effect", actor: a.id, text: `${a.name} drops the guard to watch.` }); }
        a.status.overwatch = { label: "Overwatch", owner: a.id, range: OW.range, potency: OW.potency, owed: OW.owed, expiresAt: a.ownerTurns + 1 };
        log(s, { kind: "act", actor: a.id, text: `${a.name} takes Overwatch (range ${OW.range}): the first foe to step inside before their next turn eats a snapshot. No Guard or dodge while watching.` });
      },
      cower(s, a) {   // interactions (Muse-2): a cornered routed unit guards instead of ending the turn bare
        if (!a.routed) return `${a.name} is not routed.`;
        if (a.guardUsedThisTurn) return "Guard is already set for this turn.";
        const spendError = spendTempo(s, a, s.rules.actionCosts.guard, "Cower"); if (spendError) return spendError;
        a.guardUsedThisTurn = true;
        a.status.guard = { label: "Cower", owner: a.id, expiresAt: a.ownerTurns + 1 };
        log(s, { kind: "act", actor: a.id, text: `${a.name} cowers: nowhere left to run, so they cover up (Guard until their next turn start).` });
      },
      recover(s, a) {
        if (a.tempo < s.rules.actionCosts.utility) return `Recover needs ${s.rules.actionCosts.utility} action points.`;
        if (a.lastRecoverTurn >= a.ownerTurns - s.rules.recover.cooldownTurns) return "Recover can't be used on consecutive turns.";
        if (a.pf >= a.maxPF) return "ΦF is already full.";
        spendTempo(s, a, s.rules.actionCosts.utility, "Recover"); a.lastRecoverTurn = a.ownerTurns;
        const before = a.pf; a.pf = Math.min(a.maxPF, a.pf + s.rules.recover.amount);
        log(s, { kind: "act", actor: a.id, text: `${a.name} recovers ${a.pf - before} ΦF (${a.pf}/${a.maxPF}). Not again next turn.` });
      },
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-turn.js)`);
    Object.assign(K.handlers, family);
  })();
});
