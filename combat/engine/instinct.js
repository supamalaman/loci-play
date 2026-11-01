"use strict";
// Survival Instincts (docs/survival-instincts.md): a hurt holder has two escapes. Scramble runs (15 AP, swing-free steps and
// +2 movement), Play Dead lies still (the turn ends, foes treat the holder as a corpse for targeting, it knits a little).
// A lie ends by itself, free, when the holder's side has no other standing unit that holds the battle open.
//
//   lying(u) / standing(u) / hidden(a, t)   → the lie, as every other part reads it
//   holder(u), wounded(s, u), canLie(s, u)  → gates
//   hasAlly(s, u)                           → another unit of u's side holds the battle open and is not lying
//   move(a)                                 → the Scramble movement bonus (read by moveBudgetFor)
//   autoEnd(s)                              → stands every lying unit whose side has no standing unit left
//   neverFlees(u)                           → Brave, Main Character Energy: neither escape is open to them
//   restTick(s, a) / painCheck(s, u, lost)  → turn-start knit, belt, clock / a hard hit ends the lie
//   discover(s, a, t, invest)               → an Observe tests the lie on the same invest
//   runWorks(s, a), escapesLeft(s, a)       → what the AI reads
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).instinct = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const R = (s) => s.rules.survivalInstincts;
    const lying = (u) => !!u && !u.defeated && !!u.status?.playingDead;
    const standing = (u) => !!u && !u.defeated && !lying(u);
    const hidden = (a, t) => !!t && !!a && t.side !== a.side && lying(t);
    const holder = (u) => H.hasTrait(u, "survivalInstincts");
    // Brave and Main Character Energy never flee (insight-data.js neverFlees): the one predicate for the engine, the AI and the menu.
    const neverFlees = (u) => (u?.traits || []).some((t) => H.insightRules?.data?.traits?.[typeof t === "string" ? t : t?.id]?.neverFlees);
    const NEVER = (u) => `${u.name} never flees: no running and no lying still.`;
    const wounded = (s, u) => u.lf < u.maxLF * R(s).woundedBelow;
    const inst = (u) => (u.instinct ||= { scrambles: 0, lies: 0 });
    const canLie = (s, u) => !(u.summon || u.summonBinding || u.clone || u.companion || u.dream || u.communed || u.beast || u.monster || u.wild || u.boss
      || u.husk || u.soulless || H.Tourist?.is(u) || u.side === "civilian" || u.side === "bystander" || u.routed || u.status?.kneeling || H.grappled(s, u));
    const hasAlly = (s, u) => Object.values(s.actors).some((v) => v.id !== u.id && H.sideKey(v) === H.sideKey(u) && H.holdsOpen(s, v) && !lying(v));
    const move = (a) => (a?.status?.scramble?.expiresAt > a.ownerTurns ? a.status.scramble.amount : 0);
    const left = (s, a) => ({ scrambles: Math.max(0, R(s).scramble.uses - inst(a).scrambles), lies: Math.max(0, R(s).lie.uses - inst(a).lies) });
    const escapesLeft = (s, a) => { const l = left(s, a); return l.scrambles + l.lies; };

    function rise(s, u, text, kind = "rise") {
      const st = u.status.playingDead;
      delete u.status.playingDead;
      u.ultimateCharge = Math.min(u.ultimateCharge ?? 0, st?.charge ?? 0);   // charge gained while lying is forfeited
      H.log(s, { kind, actor: u.id, text, why: ["Survival Instincts: the lie is over. The rest it earned is kept."] });
    }
    // A side with lying units and nothing standing that holds it open: every lying unit of that side stands, free.
    function autoEnd(s) {
      if (s.outcome || s.film) return;
      const sides = {};
      for (const u of Object.values(s.actors)) if (lying(u)) {
        const st = u.status.playingDead; u.ultimateCharge = Math.min(u.ultimateCharge ?? 0, st.charge ?? 0); st.charge = u.ultimateCharge;   // the bar is clamped on every outcome check too, not only at the tick
        (sides[H.sideKey(u)] ||= []).push(u);
      }
      for (const [side, units] of Object.entries(sides)) {
        if (Object.values(s.actors).some((v) => H.sideKey(v) === side && H.holdsOpen(s, v) && !lying(v))) continue;
        for (const u of units) rise(s, u, `${u.name} stands: nobody is left to look past them.`);
      }
    }
    function restTick(s, a) {
      if (!lying(a)) return;
      autoEnd(s);
      if (!lying(a)) return;
      const st = a.status.playingDead, L = R(s).lie;
      const room = Math.max(0, Math.min(L.restPerTurn, L.restCap - st.rested, a.maxLF - a.lf));
      a.lf += room; st.rested += room; st.turns += 1;
      a.ultimateCharge = Math.min(a.ultimateCharge ?? 0, st.charge); st.charge = a.ultimateCharge;
      if (room > 0) H.log(s, { kind: "heal", actor: a.id, amount: room, text: `${a.name} breathes shallow and knits ${room} LF (${a.lf}/${a.maxLF}; ${st.rested}/${L.restCap} this lie).` });
      if (st.turns >= L.maxTurnsDown) rise(s, a, `${a.name} cannot hold the stillness and rises.`);
    }
    function painCheck(s, u, lost) {
      if (lying(u) && lost >= R(s).lie.painShare * u.maxLF) rise(s, u, `${u.name} rises (a hard hit).`);
    }
    function discover(s, a, t, invest) {
      if (!hidden(a, t)) return;
      const L = R(s).lie, points = Math.floor(invest / 10) + (s.scoutShare?.[a.id]?.[t.id] || 0);
      const rank = t.noDeceptionUntil >= s.round ? 0 : (t.primary === "deception" ? 2 : 0) + (t.secondary === "deception" ? 1 : 0);
      if (points >= L.discoverPoints + L.discoverPerRank * rank) rise(s, t, `${t.name} rises (${a.name} sees through it).`);
    }
    // can running work: an open tile within the budget (with the Scramble bonus) outside every threatening foe's reach next turn
    function threats(s, a) {
      return Object.values(s.actors).filter((f) => standing(f) && !f.notArrived && !H.Tourist?.is(f) && f.side !== a.side && f.side !== "bystander" && f.side !== "civilian");
    }
    function runWorks(s, a) {
      const foes = threats(s, a), legs = H.Injury.moveBudget(s, a, H.moveBudgetFor(s, a)), budget = legs + (move(a) ? 0 : R(s).scramble.moveAdd);
      if (!foes.length || legs <= 0) return false;   // the handler refuses with no legs budget, so the AI must not count the scramble bonus alone
      const reach = foes.map((f) => [f, H.strikeRange(s, f) + H.Injury.moveBudget(s, f, H.moveBudgetFor(s, f))]);
      for (const [k, d] of H.paths(s, a.x, a.y, budget, "move").dist) {
        if (d > budget) continue;
        const [x, y] = k.split(",").map(Number);
        if ((x !== a.x || y !== a.y) && H.actorAt(s, x, y)) continue;
        if (reach.every(([f, r]) => H.dist(s, x, y, f.x, f.y) > r)) return true;
      }
      return false;
    }
    const threatened = (s, a) => threats(s, a).some((f) => H.dist(s, a.x, a.y, f.x, f.y) <= H.strikeRange(s, f) + H.Injury.moveBudget(s, f, H.moveBudgetFor(s, f)));

    // The lying unit's turn: no AP banked, nothing charged.
    function restTurn(s, a) {
      a.tempo = 0;
      H.log(s, { kind: "tempo", actor: a.id, text: `${a.name} lies still and ends the turn.` });
      H.endTurn(s);
    }
    const handlers = {
      scramble(s, a) {
        const C = R(s), l = left(s, a);
        if (!holder(a)) return "Scramble needs Survival Instincts.";
        if (neverFlees(a)) return NEVER(a);
        if (!wounded(s, a)) return `Not hurt enough (needs under ${Math.round(C.woundedBelow * 100)}% LF).`;
        if (!l.scrambles) return `No scrambles left (${C.scramble.uses} of ${C.scramble.uses} used)`;
        if (a.disengageTurn === a.ownerTurns) return "Already disengaged this turn.";
        if (a.routed) return "Routed units cannot scramble.";
        if (a.status?.kneeling) return "Kneeling: a surrendering unit does not run.";
        const refused = H.moveRefusal(s, a); if (refused) return refused;
        if (H.Injury.moveBudget(s, a, H.moveBudgetFor(s, a)) <= 0) return "No movement left to run with.";
        const err = H.spendTempo(s, a, C.scramble.ap, "Scramble"); if (err) return err;
        a.disengageTurn = a.ownerTurns;
        a.status.scramble = { amount: C.scramble.moveAdd, expiresAt: a.ownerTurns + 1 };
        inst(a).scrambles += 1;
        H.log(s, { kind: "act", actor: a.id, text: `${a.name} scrambles (${C.scramble.ap} AP): leaving a reach until their next turn draws no swing, and +${C.scramble.moveAdd} movement until their next turn. (${l.scrambles - 1} of ${C.scramble.uses} left)` });
      },
      playDead(s, a) {
        const C = R(s);
        if (!holder(a)) return "Play Dead needs Survival Instincts.";
        if (neverFlees(a)) return NEVER(a);
        if (lying(a)) return "Already lying still.";
        if (!wounded(s, a)) return `Not hurt enough (needs under ${Math.round(C.woundedBelow * 100)}% LF).`;
        if (inst(a).lies >= C.lie.uses) return "Already played dead this battle.";
        if (a.status?.kneeling) return "Kneeling: a surrendering unit does not play dead.";
        if (a.routed || !canLie(s, a)) return H.grappled(s, a) ? "Held: cannot lie still." : "Cannot lie still.";
        if (!hasAlly(s, a)) return "There is no one left to fool.";
        a.status.playingDead = { rested: 0, turns: 0, charge: a.ultimateCharge ?? 0 };
        a.status.guard = null; a.status.overwatch = null;
        inst(a).lies += 1;
        a.tempo = 0;
        H.log(s, { kind: "act", actor: a.id, text: `${a.name} falls and lies still.`, why: ["Survival Instincts: foes look past a body. Area effects still hit, and it still blocks its tile."] });
      },
      standUp(s, a) {
        if (!lying(a)) return "Not lying still.";
        const err = H.spendTempo(s, a, R(s).lie.standAp, "Stand up"); if (err) return err;
        rise(s, a, `${a.name} rises (standing up).`);
      },
    };
    Object.assign(H.handlers, handlers);

    return { Instinct: { lying, standing, hidden, holder, wounded, canLie, hasAlly, neverFlees, move, left, escapesLeft, autoEnd, restTick, restTurn, painCheck, discover, runWorks, threatened, rise, inst } };
  })();
});
