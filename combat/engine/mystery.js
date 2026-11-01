"use strict";
// Mystery layer, battle side (Muse W2.5 build): face-down set intents.
// Pay a technique's cost NOW, pick a trigger; on trigger it reveals and fires
// through the normal ability dispatch (response windows apply), announcing T1+.
// State: s.mystery = { player: [], enemy: [] }; a card is
// { unitId, side, ability, trigger, target, setRound, age }.
// Budget 3 per side per battle; expiry after 2 rounds unrevealed, no refund.
// Opponent view is COUNT ONLY (seeFoe) — no leaks, ever. The AI never reads
// contents (it has no mystery code path; audited at integration, docs/mystery.md).
// Concealed stakes ride s.stakes.faceDown (engine/ante.js + account/ante.js).
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).mystery = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { log, manifest, spendTempo, abilitiesOf, hasTrait, ab } = H;
    const RULES = (s) => s.rules.mystery || { budget: 3, expiry: 2, triggers: ["on-attacked", "on-turn-start", "manual"] };
    const lists = (s) => (s.mystery ||= { player: [], enemy: [] });
    const TRIGGERS = ["on-attacked", "on-turn-start", "manual"];

    // Set a face-down intent. Pays tempo + ΦF now (no overclock, no Inspiration
    // path on set; GDP star-tax does not apply — set happens before targeting).
    // Silent: names nothing (T0-compatible). Returns an error string or null.
    function mysterySet(s, a, ability, trigger, target) {
      if (!TRIGGERS.includes(trigger)) return `Trigger is on-attacked, on-turn-start, or manual (got ${trigger}).`;
      if (!(abilitiesOf(a) || []).includes(ability)) return "That ability isn't available with this loadout.";
      const mine = lists(s)[a.side] || (lists(s)[a.side] = []);
      const spent = (s.mysterySpent ||= { player: 0, enemy: 0 });
      if ((spent[a.side] || 0) >= RULES(s).budget) return `Face-down budget spent (${RULES(s).budget} per side).`;
      const m = manifest(s, a, ability, {});
      if (m.tier !== "ultimate" && m.effect !== "damage") return `${m.name} can't be set face-down: only ultimates and attacks can be announced on reveal.`;   // MCR-03: eligibility before charging
      const mastered = !!s.rules.mastery && (a.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === s.rules.mastery.trait);
      if (m.tier === "ultimate" && !mastered && (a.ultimateCharge || 0) < s.rules.ultimateChargeMax) return `Setting ${m.name} needs a full ultimate bar (have ${a.ultimateCharge || 0}).`;   // MCR-04: the bar is validated (and paid) at set
      const detailTax = hasTrait(a, "attentionToDetail") && m.effect === "barrier" ? 5 : 0;
      if (a.tempo < m.tempoCost + detailTax) return `${m.name} needs ${m.tempoCost + detailTax} action points to set (have ${a.tempo}).`;
      if (a.pf < m.cost) return `Needs ${m.cost} ΦF to set (have ${a.pf}).`;
      const n0 = s.log.length;
      const spend = spendTempo(s, a, m.tempoCost + detailTax, "Set face-down");
      if (spend) return spend;
      for (const e of s.log.slice(n0)) if (e.kind === "tempo") e.text = `${a.name} spends action points on Set face-down.`;   // MCR-05: the set's spend prints no cost or remainder (redacted here; engine.js is at its size cap)
      a.pf -= m.cost;
      if (m.tier === "ultimate" && !mastered) a.ultimateCharge -= s.rules.ultimateChargeMax;   // MCR-04: bar paid at set, silently (the count-only set line covers it); reveal spends nothing further
      spent[a.side] = (spent[a.side] || 0) + 1;
      mine.push({ unitId: a.id, side: a.side, ability, trigger, target: target ?? null, setRound: s.round || 1, age: 0 });
      log(s, { kind: "mystery", actor: a.id, text: `${a.name} sets a face-down card (${mine.length} down).`, why: ["Paid now, triggers later. The table sees a count, never contents."] });
      return null;
    }

    // Fire one card through the normal ability dispatch (prepaid rides the internal
    // 4th arg; announce forced T1+). Holds (stays down) when the fire path
    // refuses. Returns an error string or null (fired).
    function fireCard(s, card, targetOverride, why) {
      const a = s.actors[card.unitId];
      const mine = lists(s)[card.side] || [];
      const i = mine.indexOf(card);
      if (!a || a.defeated) return "The setter is gone.";
      if (i < 0) return "No such face-down card.";
      mine.splice(i, 1);
      const outer = s.phase === "response" && s.pending ? s.pending : null;
      if (outer) (s.pendingStack ||= []).push(outer);
      const unstack = () => { if (outer && s.pendingStack?.at(-1) === outer) s.pendingStack.pop(); };
      const act = { type: "ability", actor: a.id, ability: card.ability, target: targetOverride ?? card.target ?? undefined, announce: true, revelation: 1 };
      const err = H.handlers.ability(s, a, act, { prepaid: true });
      if (err) { unstack(); mine.splice(Math.min(i, mine.length), 0, card); return err; }   // hold: reveal did not complete
      if (s.pending === outer) unstack();   // no inner window opened: the live pending was never displaced
      log(s, { kind: "mystery", actor: a.id, ability: card.ability, text: `${a.name} reveals ${ab(card.ability)?.name || card.ability} face-up! (${why})`, why: ["Revealing announces at T1: the show begins."] });
      return null;
    }

    // Conversion transfers the setter's cards to the new side (spent budget stays spent: it is expenditure history). Count-only log.
    function mysteryMigrate(s, u) {
      if (!u) return;
      const moved = [];
      for (const side of ["player", "enemy"]) {
        const list = lists(s)[side] || [];
        for (let i = list.length - 1; i >= 0; i--) if (list[i].unitId === u.id) moved.push(...list.splice(i, 1));
      }
      if (!moved.length) return;
      for (const c of moved) c.side = u.side;
      (lists(s)[u.side] ||= []).push(...moved);
      log(s, { kind: "mystery", actor: u.id, text: `${u.name}'s face-down plans change sides (${moved.length} down).`, why: ["Conversion transfers set plans with their setter; the spent budget stays spent."] });
    }

    const oldest = (s, side, unitId, trigger) => {
      const hit = (lists(s)[side] || []).find((c) => (!unitId || c.unitId === unitId) && (!trigger || c.trigger === trigger)) || null;
      if (hit || !unitId || !["player", "enemy"].includes(side)) return hit;
      const other = side === "player" ? "enemy" : "player";   // MCR-06: owner-bound fallback — a setter converted outside the eager path heals on read
      if ((lists(s)[other] || []).some((c) => c.unitId === unitId)) { mysteryMigrate(s, s.actors[unitId]); return (lists(s)[side] || []).find((c) => c.unitId === unitId && (!trigger || c.trigger === trigger)) || null; }
      return null;
    };

    // Manual reveal + fire (Techniques ▸ Reveal): the setter's oldest manual card.
    function mysteryReveal(s, a, target) {
      const card = oldest(s, a.side, a.id, "manual");
      if (!card) return "No manual face-down card to reveal.";
      const err = fireCard(s, card, target, "revealed by hand");
      if (err) { log(s, { kind: "mystery", actor: a.id, text: `${a.name}'s set card holds.`, why: ["The table sees a count, never contents — the setter reads why privately."] }); return `The card holds: ${err}`; }
      return null;
    }

    // Forced reveal + fire (Observe rips, on-attacked, on-turn-start). Silent hold otherwise.
    function mysteryForce(s, unitId, targetOverride, why) {
      const u = s.actors[unitId];
      if (!u) return null;
      const card = oldest(s, u.side, unitId, null);
      if (!card) return null;
      return fireCard(s, card, targetOverride, why);
    }

    // Round start: age all cards; expiry drops them unrevealed, no refund, unnamed.
    function mysteryTick(s) {
      for (const side of ["player", "enemy"]) {
        const mine = lists(s)[side] || [];
        for (const c of mine) c.age += 1;
        const kept = mine.filter((c) => c.age <= RULES(s).expiry);
        if (kept.length !== mine.length) log(s, { kind: "mystery", text: `A stale set plan fades (${mine.length - kept.length}).`, why: ["Expiry eats them: the price of secrecy, unrefunded."] });
        lists(s)[side] = kept;
      }
    }

    // Turn start: the turn unit's oldest on-turn-start card fires (stored target).
    function mysteryTurnStart(s, a) {
      if (!a || a.defeated) return;
      const card = oldest(s, a.side, a.id, "on-turn-start");
      if (card) fireCard(s, card, undefined, "the turn begins");
    }

    // After a hit lands: the victim's oldest on-attacked card fires back at the attacker.
    function mysteryAttacked(s, victim, attacker) {
      if (!victim || victim.defeated || !attacker) return;
      const card = oldest(s, victim.side, victim.id, "on-attacked");
      if (card) fireCard(s, card, [attacker.x, attacker.y], "sprung by the attack");
    }

    return { mysterySet, mysteryReveal, mysteryForce, mysteryTick, mysteryTurnStart, mysteryAttacked, mysteryMigrate };
  })();
});
