"use strict";
// Hyper-gambling (W5.3 build): heat, MYOL, staking, jackpot meter math. The gambler's pipes:
// luck they build (heat), luck they buy (MYOL), luck they sweat (stakes), and the table's prize.
//
//   RULES                            → tunables (heat, MYOL, staking, jackpot)
//   gamblerOf(s, a)                  → gambler-trait holder, or any enemy rival at the Jackpot table
//   heatOf(s, id)                    → 0..5 consecutive turns ended holding 40+ AP
//   heatBonus(s, a)                  → heat x 5% on the gambler's imitate + tame checks
//   recordRoll(s, roll)              → remembers the last flippable check (imitate/tame only, v1)
//   myolEligible(s, a, seeds)        → null | reason (fresh fail, uses left or exhaustion price, afford)
//   myolCost(uses)                   → 5/10/20 Seeds by uses so far
//   myolApply(s, a, H)               → { flipped, exhausted } (replays the recorded check at +25)
//   stakeBonus(s, a)                 → consumes s.staked, returns bonus 0..25% and logs the sweat
//   jackpotMeter(s)                  → live prize projection: 10/round + 25/fallen rival
//   luckBonus(s, a)                  → W5.1 rhythm: +25 odd turns, −25 even, 0 for non-gamblers
//   noteLuck(s, a, ok)               → charges the JACKPOT turn (+1 per lucky success, fires at 7)
//   jackpotOf(s, id)                 → { charge, armed, firing } for the unit card meter
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).hyper = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const RULES = {
      heat: { unspentAp: 40, max: 5, bonusPer: 0.05, doubleChargePer: 8 },
      myol: { uses: 3, costs: [5, 10, 20], bonus: 0.25, exhaustedAp: 25, exhaustedRounds: 3 },
      stake: { perSeed: 0.01, maxBonus: 0.25, mintMul: 0.5, mintCap: 55 },
      jackpot: { perRound: 10, perRival: 25 },
      luck: { shift: 0.25, chargeToFire: 7 },
    };
    const hasTrait = (u, id) => (u?.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === id);
    const gamblerOf = (s, a) => !!a && !a.defeated && (hasTrait(a, "gambler") || s.themedBattle === "jackpot");   // the table makes gamblers of everyone seated at it
    const heatOf = (s, id) => Math.max(0, Math.min(RULES.heat.max, s.heat?.[id] || 0));
    const heatBonus = (s, a) => (gamblerOf(s, a) ? heatOf(s, a.id) * RULES.heat.bonusPer : 0);
    const recordRoll = (s, roll) => { s.lastRoll = { ...roll, round: s.round }; };
    // W5.1 rhythm: the gambler's own turn count sets the beat (odd lucky, even
    // unlucky — personal, so two gamblers desync). A firing JACKPOT turn counts
    // as lucky whatever the parity. Non-gamblers feel nothing.
    const jackpotState = (s, id) => { s.jackpotTurn ||= {}; return s.jackpotTurn[id] || { charge: 0, armedFor: 0 }; };
    const jackpotFiring = (s, a) => { const j = jackpotState(s, a.id); return j.armedFor > 0 && (a.ownerTurns || 0) === j.armedFor; };
    const luckBonus = (s, a) => {
      if (!gamblerOf(s, a)) return 0;
      if (jackpotFiring(s, a)) return RULES.luck.shift;
      return ((a.ownerTurns || 0) % 2 === 1) ? RULES.luck.shift : -RULES.luck.shift;
    };
    // Charge the JACKPOT turn: +1 per lucky-turn success (kindness: failures
    // hold, never drain). At 7 the next turn fires: every roll auto-lucky,
    // stakes doubled. Passing the armed turn clears the meter.
    const noteLuck = (s, a, ok) => {
      if (!gamblerOf(s, a)) return;
      s.jackpotTurn ||= {};
      const id = a.id, j = jackpotState(s, id), turn = a.ownerTurns || 0;
      if (j.armedFor > 0 && turn > j.armedFor) { s.jackpotTurn[id] = { charge: 0, armedFor: 0 }; return; }
      if (j.armedFor > 0) return;   // armed or firing: the meter waits
      if (ok && turn % 2 === 1) {
        const charge = j.charge + 1;
        if (charge >= RULES.luck.chargeToFire) s.jackpotTurn[id] = { charge, armedFor: turn + 1 };
        else s.jackpotTurn[id] = { charge, armedFor: 0 };
      }
    };
    const jackpotOf = (s, id) => { const j = jackpotState(s, id); const a = s.actors?.[id]; return { charge: j.charge, armed: j.armedFor > 0, firing: !!a && jackpotFiring(s, a) }; };
    // W5.1 AI: gamblers buy back the sting — bloodied (prone until Chain E's
    // vow-prone bands land) or an odds-on fail (p ≥ .5: the favorite falling).
    // Pure predicate so the AI and the tests share one nose.
    const aiWantsMyol = (s, a) => {
      const r = s.lastRoll;
      if (!r || r.actor !== a.id || r.round !== s.round) return false;
      if (!gamblerOf(s, a)) return false;
      if (myolEligible(s, a, s.seeds ?? 0)) return false;
      const bloodied = (a.lf ?? 100) < (a.maxLF || 100) * 0.3;
      return bloodied || (r.p ?? 0) >= 0.5;
    };
    const aiMyolValue = (s, a) => {
      const r = s.lastRoll;
      const flips = r && r.roll < (r.p ?? 0) + RULES.myol.bonus;
      if (!flips) return -1;
      return ((a.lf ?? 100) < (a.maxLF || 100) * 0.3) ? 16 : 10;
    };

    function myolCost(uses) { return RULES.myol.costs[Math.min(uses, RULES.myol.costs.length - 1)]; }
    function myolEligible(s, a, seeds) {
      const r = s.lastRoll;
      if (!r || r.actor !== a.id || r.round !== s.round) return "Make your own luck right after a failed trick, same round.";
      if ((a.status?.exhausted?.until || 0) > s.round) return "Exhausted: no more luck to make for a while.";
      const uses = s.myolUses?.[a.id] || 0;
      if ((seeds ?? 0) < myolCost(uses)) return `Making luck costs ${myolCost(uses)} Seeds.`;
      return null;   // past the limit the flip still resolves; exhaustion lands (the card warns)
    }
    // Replays the recorded check at +25. Gates can't break: an unattempted check leaves no record.
    // Past the limit the flip still resolves, but exhaustion lands (-25 AP, 3 rounds) and locks MYOL.
    function myolApply(s, a, Hh) {
      const r = s.lastRoll, uses = s.myolUses?.[a.id] || 0;
      const t = r.kind === "tame" ? (s.wild || []).find((w) => w.id === r.target) : s.actors[r.target];
      if (!t || t.defeated) return { fizzled: true };   // the moment passed: no charge, no use (UI refunds by comparing uses)
      const flipped = r.roll < r.p + RULES.myol.bonus;
      const over = uses >= RULES.myol.uses;
      if (over) a.status = { ...(a.status || {}), exhausted: { label: "Exhausted", until: s.round + RULES.myol.exhaustedRounds } };
      s.myolUses = { ...(s.myolUses || {}), [a.id]: uses + 1 };
      s.lastRoll = null;
      const log = Hh.log;
      if (!flipped) {
        log(s, { kind: "myol", actor: a.id, text: `${a.name} buys luck and it still won't come.${over ? " The effort exhausts them." : ""}`, why: [`${Math.round((r.p + RULES.myol.bonus) * 100)}% after MYOL: the roll stood.`] });
        return { flipped: false, exhausted: over };
      }
      if (r.kind === "imitate" && Hh.imitateComplete) Hh.imitateComplete(s, a, t, r.trait, r.p);
      else if (r.kind === "tame" && Hh.tameComplete) Hh.tameComplete(s, a, t, r.p);
      else return { flipped: false, exhausted: over };
      log(s, { kind: "myol", actor: a.id, text: `${a.name} makes their own luck: the ${r.kind} lands after all.${over ? " The effort exhausts them." : ""}`, why: ["MYOL adds after the roll is seen; it never makes an untried trick legal."] });
      return { flipped: true, exhausted: over };
    }
    // Staking: Seeds posted before the roll narrow it. Win: stake back + half again (mint-capped
    // per battle); fail: the stake burns. Events drain to the account in the UI after the act.
    function stakeBonus(s, a) {
      const st = s.staked;
      if (!st || st.actor !== a.id || !(st.seeds > 0)) return 0;
      s.staked = null;
      s.stakePending = { seeds: st.seeds };
      const mult = (gamblerOf(s, a) && jackpotFiring(s, a)) ? 2 : 1;   // W5.1: stakes double on the JACKPOT turn
      return Math.min(RULES.stake.maxBonus * mult, st.seeds * RULES.stake.perSeed * mult);
    }
    function settleStake(s, won) {
      const st = s.stakePending;
      s.stakePending = null;
      if (!st) return;
      const room = Math.max(0, RULES.stake.mintCap - (s.mintedSeeds || 0));
      const minted = won ? Math.min(room, Math.floor(st.seeds * RULES.stake.mintMul)) : 0;
      s.mintedSeeds = (s.mintedSeeds || 0) + minted;
      const back = won ? st.seeds + minted : 0;
      if (s.seeds != null) s.seeds += back;   // the purse is the battle's; the UI copies it to the account
      (s.stakeEvents ||= []).push({ seeds: st.seeds, won: !!won, back, minted });
    }
    function jackpotMeter(s) {
      if (s.themedBattle !== "jackpot") return 0;
      const fallen = Object.values(s.actors).filter((u) => u.side === "enemy" && u.defeated).length;
      return RULES.jackpot.perRound * s.round + RULES.jackpot.perRival * fallen;
    }
    return { hyperRules: RULES, gamblerOf, heatOf, heatBonus, recordRoll, myolCost, myolEligible, myolApply, stakeBonus, settleStake, jackpotMeter, luckBonus, noteLuck, jackpotOf, aiWantsMyol, aiMyolValue };
  })();
});
