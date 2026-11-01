"use strict";
// Ante stakes, battle side (W1.5 build): who proposes to whom, the foe's carry, the AI's answer.
// Escrow math lives in account/ante.js (required here, no engine imports there).
//
//   anteLeader(s)                  → the enemy leader (highest level, living, arrived) or null
//   anteCarry(s, leader)           → the foe's posted lot: one bead, carried not minted-from-air
//   antePreBlood(s)                → round 1 with no damage logged yet (the closest live moment to pre-battle)
//   antePropose(s, a, lot, H)      → error string, or writes s.stakes { agreed | refused }
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).ante = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const Ante = () => (typeof module === "object" && module.exports ? require("../account/ante.js") : globalThis.ConceptCombatAnte) || null;

    function anteLeader(s) {
      const foes = Object.values(s.actors).filter((u) => u.side === "enemy" && !u.defeated && !u.notArrived);
      foes.sort((a, b) => (b.level || 0) - (a.level || 0));
      return foes[0] || null;
    }
    // The foe's carry: one bead from their kit value, fixed at proposal (diverted loot, visible, seeded
    // only by the leader — no purse math, no minting at resolution; asymmetric lots are legal).
    function anteCarry(s, leader) {
      const L = leader || anteLeader(s);
      if (!L) return [];
      return [{ kind: "bead", snap: { kind: L.character || L.id, name: L.name, maxLF: 20 } }];
    }
    const antePreBlood = (s) => s.round === 1 && !(s.log || []).some((e) => e.kind === "damage");

    function antePropose(s, a, lot, Hh, conceal = false) {
      const AN = Ante(), log = Hh.log;
      if (s.stakes) return `${a.name} has already proposed stakes this battle.`;
      if (!antePreBlood(s)) return "Stakes are proposed before first blood: round 1, no damage dealt yet.";
      const leader = anteLeader(s);
      if (!leader) return "No one stands to take the wager.";
      const foeLot = anteCarry(s, leader);
      const mine = AN.lotValue(lot), theirs = AN.lotValue(foeLot);
      const nerve = AN.RULES.nerveLo + Hh.seededChance(`${s.seed}:ante:${leader.id}`) * (AN.RULES.nerveHi - AN.RULES.nerveLo);
      const pairKey = leader.character || leader.id;
      const mark = (l) => conceal ? l.map((it) => ({ ...it, faceDown: true })) : l;   // Mystery (Muse W2.5): concealed stakes, both lots
      if (mine >= theirs * nerve) {
        s.stakes = { pairKey, leaderId: leader.id, foeName: leader.name, playerLot: mark(lot), foeLot: mark(foeLot), state: "agreed", round: s.round, faceDown: !!conceal };
        log(s, conceal
          ? { kind: "ante", actor: a.id, target: leader.id, text: `${a.name} stakes ${lot.length + foeLot.length} lots face-down against ${leader.name}: the wager is on, the table is blind.`, why: ["Concealed lots reveal at the duel's end, no sooner."] }
          : { kind: "ante", actor: a.id, target: leader.id, text: `${a.name} stakes ${mine} against ${leader.name}'s ${theirs}: the wager is on.`, why: ["Winner takes both lots at the battle's end; refusal was free, and is past."] });
      } else {
        s.stakes = { pairKey, leaderId: leader.id, foeName: leader.name, playerLot: mark(lot), foeLot: mark(foeLot), state: "refused", round: s.round, faceDown: !!conceal };
        log(s, conceal
          ? { kind: "ante", actor: leader.id, target: a.id, text: `${leader.name} waves the blind wager off: the battle proceeds unstaked.` }
          : { kind: "ante", actor: leader.id, target: a.id, text: `${leader.name} waves the wager off (${mine} against ${theirs}): the battle proceeds unstaked.` });
      }
      return null;
    }

    return { anteLeader, anteCarry, antePreBlood, antePropose };
  })();
});
