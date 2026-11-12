"use strict";
// Actions, the debts family: openGate, heartScroll, studyScroll, buyHouse, investHouse, sueForRestitution, borrowDebt, repayDebt, settleDebtVisit, declareBankruptcy, grantTechnique, declareWard, reaperSeal.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsDebts = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { Debt, Sealing, checkOutcome, log, spendTempo } = H;
    const { sealedNext } = K;
    const family = {
      openGate(s, a, act) {
        const SN = sealedNext();
        const f = s.sealedFight;
        const g = f && SN && f.gates[act.gate];
        if (!g || g.destroyed || g.open) return "That gate cannot be opened.";
        const [x, y] = g.tile.split(",").map(Number);
        if (Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) > 1) return "Open it from an adjacent tile.";
        const spend = spendTempo(s, a, SN.OPEN_AP, "Open");
        if (spend) return spend;
        const before = f.ap;
        const r = SN.openGate(f, g.id, true);
        if (!r.ok) return "The gate does not open.";
        f.ap = before;
        SN.placeGates(s);
        SN.syncMarks(s, H);
        log(s, { kind: "act", actor: a.id, tiles: [[x, y]], text: `${a.name} opens a gate.` });
      },
      heartScroll: (s, a, act) => H.castScroll?.(s, a, act), studyScroll: (s, a) => H.studyScroll?.(s, a),   // Heart Court: one cast, or a note (engine/living-map.js)
      buyHouse: (s, a, act) => H.houseAction(s, a, act, "buy"), investHouse: (s, a, act) => H.houseAction(s, a, act, "invest"), sueForRestitution: (s, a, act) => H.sueForRestitution(s, a, act),
      borrowDebt(s, a, act) {   // W2.2: Talk ▸ lender rows — +40 tempo +5 ΦF now, the book compounds
        if (!Debt) return "No lenders today.";
        if (a.id !== "player") return "Only the player borrows (driven-only).";
        const r = Debt.borrow(s, H, a.id, act.lender);
        if (!r.ok) return r.error;
      },
      repayDebt(s, a, act) {   // W2.2: Talk ▸ Repay — Seeds close the book (banks ask double)
        if (!Debt) return "No lenders today.";
        if (a.id !== "player") return "Only the player repays (driven-only).";
        const r = Debt.repay(s, H, a.id);
        if (!r.ok) return r.error;
      },
      settleDebtVisit(s, a, act) {   // W2.2: Talk ▸ Settle the visit — 2 inspiration sends the creditor home
        if (!Debt) return "No lenders today.";
        if (a.id !== "player") return "Only the player settles (driven-only).";
        const r = Debt.settleVisit(s, H, a.id);
        if (!r.ok) return r.error;
      },
      declareBankruptcy(s, a, act) {   // W2.2: Talk ▸ Declare bankruptcy — voluntary filing: seal + prison + service
        if (!Debt) return "No lenders today.";
        if (a.id !== "player") return "Only the player files (driven-only).";
        const r = Debt.bankrupt(s, H, a.id, true);
        if (!r.ok) return r.error;
      },
      grantTechnique(s, a, act) {   // W2.3: Techniques ▸ Grant — an ally inherits a technique; a level is owed at battle end
        if (!Sealing) return "No inheritances today.";
        if (a.id !== "player") return "Only the player grants (driven-only).";
        const t = s.actors[act.target];
        if ((a.tempo || 0) < Sealing.RULES.grantAp) return `Granting needs ${Sealing.RULES.grantAp} tempo.`;
        a.tempo -= Sealing.RULES.grantAp;
        const r = Sealing.grant(s, a, t, act.ability);
        if (!r.ok) { a.tempo += Sealing.RULES.grantAp; return r.error; }
        log(s, { kind: "seal", actor: a.id, target: t.id, text: r.text });
      },
      declareWard(s, a, act) {   // Duy's rule: Rituals ▸ Declare — name the precious ward a death-priced seal protects
        if (!Sealing) return "No vessels today.";
        const t = s.actors[act.target];
        if ((a.tempo || 0) < Sealing.RULES.declareAp) return `Naming a ward needs ${Sealing.RULES.declareAp} tempo.`;
        a.tempo -= Sealing.RULES.declareAp;
        const r = Sealing.declare(s, a, t);
        if (!r.ok) { a.tempo += Sealing.RULES.declareAp; return r.error; }
        log(s, { kind: "declare", actor: a.id, target: t.id, text: r.text });
      },
      reaperSeal(s, a, act) {   // W2.3: Techniques ▸ Reaper's Seal — the mutual seal: caught outright, the sealer dies
        if (!Sealing) return "No vessels today.";
        if (a.id !== "player") return "Only the player ties it (driven-only).";
        const t = s.actors[act.target];
        if (!t || t.defeated || t.side !== "enemy" || H.Instinct.hidden(a, t)) return "The Reaper's seal needs a standing enemy.";
        if ((a.tempo || 0) < Sealing.RULES.reaperAp) return `The knot needs ${Sealing.RULES.reaperAp} tempo.`;
        a.tempo -= Sealing.RULES.reaperAp;
        const r = Sealing.reaper(s, a, t);
        if (!r.ok) { a.tempo += Sealing.RULES.reaperAp; return r.error; }
        log(s, { kind: "seal", actor: a.id, target: t.id, vessel: r.vessel, text: r.text });
        log(s, { kind: "defeat", target: a.id, text: `${a.name} dies with the knot tied.` });
        for (const e of Sealing.onSealerDown(s, a)) log(s, { kind: "seal", actor: e.foe, text: e.text });
        checkOutcome(s);
      },
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-debts.js)`);
    Object.assign(K.handlers, family);
  })();
});
