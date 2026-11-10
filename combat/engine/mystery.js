"use strict";
// Mystery layer, battle side (Muse W2.5 build): face-down set intents.
// Pay a technique's cost NOW, pick a trigger; on trigger it reveals and fires
// through the normal ability dispatch (response windows apply), announcing T1+.
// State: s.mystery = { player: [], enemy: [] }; a card is
// { unitId, side, ability, trigger, target, setRound, age }.
// Budget 3 per side per battle; expiry after 2 rounds unrevealed, no refund.
// Opponent view is COUNT ONLY (seeFoe) — no leaks, ever. The AI never reads
// contents (its only readers are the counts-only mysteryUnitCount/mysteryBudgetLeft/mysteryOwnCount; sealed by tests/mystery-ai.test.mjs + tests/mystery-ai-s1.test.mjs).
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
      const freeFirst = H.freeFirstFree?.(a, m);   // W0b: the set IS the use (reveal spends nothing further), so a free first use sets free (triage 2026-11-04)
      if (!freeFirst && a.tempo < m.tempoCost + detailTax) return `${m.name} needs ${m.tempoCost + detailTax} action points to set (have ${a.tempo}).`;
      if (!freeFirst && a.pf < m.cost) return `Needs ${m.cost} ΦF to set (have ${a.pf}).`;
      const n0 = s.log.length;
      if (!freeFirst) { const spend = spendTempo(s, a, m.tempoCost + detailTax, "Set face-down"); if (spend) return spend; }
      for (const e of s.log.slice(n0)) if (e.kind === "tempo") e.text = `${a.name} spends action points on Set face-down.`;   // MCR-05: the set's spend prints no cost or remainder (redacted here; engine.js is at its size cap)
      if (!freeFirst) a.pf -= m.cost;
      if (m.tier === "ultimate" && !mastered) a.ultimateCharge -= s.rules.ultimateChargeMax;   // MCR-04: bar paid at set, silently (the count-only set line covers it); reveal spends nothing further
      if (freeFirst === "turn") (a.freeTurns ||= {})[ability] = a.ownerTurns;   // free-first stamps at set, like commit
      if (freeFirst === "battle") (a.freeBattle ||= {})[ability] = true;
      spent[a.side] = (spent[a.side] || 0) + 1;
      mine.push({ unitId: a.id, side: a.side, ability, trigger, target: target ?? null, setRound: s.round || 1, age: 0 });
      log(s, { kind: "mystery", actor: a.id, text: `${a.name} sets a face-down card (${mine.length} down).`, why: ["Paid now, triggers later. The table sees a count, never contents."] });
      return null;
    }

    // Fire one card through the normal ability dispatch (prepaid rides the internal
    // 4th arg; announce forced T1+). Holds (stays down) when the fire path
    // refuses. Returns an error string or null (fired).
    function fireCard(s, card, targetOverride, why, ctx) {
      const a = s.actors[card.unitId];
      const mine = lists(s)[card.side] || [];
      const i = mine.indexOf(card);
      if (i >= 0 && card.kind === "card" && (!a || a.defeated)) mine.splice(i, 1);   // a defeated setter's face-down CARD is discarded, not left down to be ripped or read (Battle Cards C2)
      if (!a || a.defeated) return "The setter is gone.";
      if (i < 0) return "No such face-down card.";
      mine.splice(i, 1);
      if (card.kind === "card") {   // Battle Cards C2: a set CARD resolves through Cards.resolveSet (its own log lines: the name never enters a public entry); a refusal holds it down like an ability
        const err = H.Cards.resolveSet(s, a, card, targetOverride, why, ctx);
        if (err) mine.splice(Math.min(i, mine.length), 0, card);
        return err;
      }
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

    const oldest = (s, side, unitId, trigger, phase) => {
      const hit = (lists(s)[side] || []).find((c) => (!unitId || c.unitId === unitId) && (!trigger || c.trigger === trigger) && (!phase || (c.phase || "after") === phase)) || null;
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
    // `ctx.invest` is the AP the Observe put into the study: a set CARD needs more of it the more powerful the card is (Cards.ripAp), so the rip takes the oldest plan the study can reach and a
    // stronger card stays down in silence. Without ctx.invest (the legacy Observe has no study size) every plan is in reach.
    function mysteryForce(s, unitId, targetOverride, why, ctx) {
      const u = s.actors[unitId];
      if (!u) return null;
      let card = oldest(s, u.side, unitId, null);
      if (!card) return null;
      if (ctx?.invest != null) card = (lists(s)[u.side] || []).find((c) => c.unitId === unitId && (c.kind !== "card" || ctx.invest >= H.Cards.ripAp(c))) || null;
      if (!card) return null;
      return fireCard(s, card, targetOverride, why, card.kind === "card" ? { rip: true, observer: ctx?.observer || null } : undefined);
    }

    // Round start: age all cards; expiry drops them unrevealed, no refund, unnamed.
    function mysteryTick(s) {
      for (const side of ["player", "enemy"]) {
        const mine = (lists(s)[side] || []).filter((c) => !(c.kind === "card" && s.actors?.[c.unitId]?.defeated));   // Battle Cards C2: a defeated setter's face-down CARDS are discarded here, unnamed (an ability plan keeps Mystery's own rule)
        for (const c of mine) c.age += 1;
        const kept = mine.filter((c) => c.age <= RULES(s).expiry);
        if (kept.length !== mine.length) log(s, { kind: "mystery", text: `A stale set plan fades (${mine.length - kept.length}).`, why: ["Expiry eats them: the price of secrecy, unrefunded."] });
        lists(s)[side] = kept;
      }
    }

    // Turn start: the turn unit's oldest on-turn-start card fires. A set CARD and a plan with a stored target fire as they always did.
    // A plan with no stored target (every AI set, Mystery S2) finds its target now: an aimed plan tries the foes its setter fights,
    // nearest first, through the ability handler (range, sight and line checked like a player's pick), and the first one accepted takes
    // it; a self-centred attack fires only with such a foe inside its radius; any other self-resolving plan fires outright. With no
    // valid target the plan holds for a later turn (the expiry still ends it).
    const fights = (s, a, u) => u.id !== a.id && !u.defeated && !u.notArrived && !H.Instinct.lying(u) && !H.Tourist?.is(u) && u.side !== a.side && u.side !== "bystander"
      && H.PostHuman.atWar(s, a, u) && H.Civilian.atWar(s, a, u) && (H.Visitors?.atWar(s, a, u) ?? true) && H.Factions.atWar(s, a, u)
      && !(a.truceWith === u.id && a.truceUntil >= s.round) && !(H.Parley && H.Parley.blocks(s, a, u));   // the foes this unit fights: the test the AI applies to its own foe list (ai.js candidates)
    function mysteryTurnStart(s, a) {
      if (!a || a.defeated) return;
      const card = oldest(s, a.side, a.id, "on-turn-start");
      if (!card) return;
      if (card.kind === "card" || card.target) { fireCard(s, card, undefined, "the turn begins"); return; }
      const m = manifest(s, a, card.ability, {}), far = (u) => H.dist(s, a.x, a.y, u.x, u.y);
      const foes = Object.values(s.actors).filter((u) => fights(s, a, u)).sort((p, q) => far(p) - far(q));
      if (m.target === "self") {
        if (m.effect === "damage" && !foes.some((u) => far(u) <= (m.area?.radius ?? 0))) return;
        fireCard(s, card, undefined, "the turn begins"); return;
      }
      for (const u of foes) if (fireCard(s, card, [u.x, u.y], "the turn begins") === null) return;
    }

    // The victim's on-attacked plans of one phase, oldest first. oldest() runs first only for its MCR-06 heal of a plan stranded on the other side by a conversion.
    const springers = (s, victim, phase) => { oldest(s, victim.side, victim.id, "on-attacked", phase); return (lists(s)[victim.side] || []).filter((c) => c.unitId === victim.id && c.trigger === "on-attacked" && (c.phase || "after") === phase); };

    // After a hit lands: the victim's oldest on-attacked card fires back at the attacker. `hurt` is the LF the hit took (a set CARD with phase "after" needs it above 0).
    // A set card that holds (its condition unmet, nothing hurt) leaves the next card its turn; an ability plan that holds ends the try, as before.
    function mysteryAttacked(s, victim, attacker, hurt) {
      if (!victim || victim.defeated || !attacker) return;
      for (const card of springers(s, victim, "after")) {
        if (!fireCard(s, card, [attacker.x, attacker.y], "sprung by the attack", { attacker, hurt: hurt || 0 }) || card.kind !== "card") break;
      }
    }

    // Before a hit lands (damage.js, ahead of the ward): the victim's on-attacked set CARDS with phase "before" fire (a ward that the same blow then meets). One card per hit.
    function mysteryBeforeHit(s, victim, attacker) {
      if (!victim || victim.defeated || !attacker) return;
      for (const card of springers(s, victim, "before")) {
        if (!fireCard(s, card, [attacker.x, attacker.y], "sprung by the attack", { attacker, hurt: 0 })) break;
      }
    }

    // Battle Cards C2: a set CARD enters the same face-down list, budget and expiry (the budget is shared with ability plans). Returns an error string or null.
    const mysteryRoom = (s, side) => (s.mysterySpent?.[side] || 0) < RULES(s).budget;   // a read: it never creates s.mysterySpent (Cards.options and the AI call it on every look; aiAction must not mutate the state)
    function mysteryPlace(s, a, entry) {
      if (!mysteryRoom(s, a.side)) return `Face-down budget spent (${RULES(s).budget} per side).`;
      const spent = (s.mysterySpent ||= { player: 0, enemy: 0 }); spent[a.side] = (spent[a.side] || 0) + 1;
      (lists(s)[a.side] ||= []).push(entry);
      return null;
    }
    const mysteryFoeCount = (s, side) => ({ count: (lists(s)[side] || []).filter((c) => c.kind !== "card").length });   // the foe view of Mystery: a card set counts only through Cards.viewFor (aware viewers)
    const mysteryCardCount = (s, unitId) => s.actors?.[unitId]?.defeated ? 0 : ["player", "enemy"].reduce((n, side) => n + (lists(s)[side] || []).filter((c) => c.kind === "card" && c.unitId === unitId).length, 0);   // a defeated setter's cards count for no one (they are discarded at the next fire attempt or round start)

    // The AI's only mystery reader (Muse AI-half-1): how many face-down plans one
    // setter still holds, across both lists (MCR-06: a converted setter's cards may
    // sit on the other list until they heal). A NUMBER, never contents.
    const mysteryUnitCount = (s, unitId) => ["player", "enemy"].reduce((n, side) => n + (s.mystery?.[side] || []).filter((c) => c.kind !== "card" && c.unitId === unitId).length, 0);   // a face-down CARD set is not counted: the AI reads a card only through Cards.viewFor, and only when it is aware (CARDS.md 18.3)

    // S1's two more numbers (still counts only): the side's unspent budget (shared with set CARDS through mysteryPlace), and one
    // setter's held PLANS (per trigger when asked), across both lists for MCR-06. A set card is not counted here either (C2 landed first: the AI reads a card only through Cards).
    const mysteryBudgetLeft = (s, side) => Math.max(0, (RULES(s).budget ?? 3) - (s.mysterySpent?.[side] || 0));
    const mysteryOwnCount = (s, unitId, trigger) => ["player", "enemy"].reduce((n, side) => n + (s.mystery?.[side] || []).filter((c) => c.kind !== "card" && c.unitId === unitId && (!trigger || c.trigger === trigger)).length, 0);

    return { mysterySet, mysteryReveal, mysteryForce, mysteryTick, mysteryTurnStart, mysteryAttacked, mysteryBeforeHit, mysteryRoom, mysteryPlace, mysteryCardCount, mysteryFoeCount, mysteryMigrate, mysteryUnitCount, mysteryBudgetLeft, mysteryOwnCount };
  })();
});
