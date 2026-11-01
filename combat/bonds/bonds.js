"use strict";
// Bonds (Mala, 2026-10-08): friendship between characters. "Having max friendship with a class can create shared
// abilities that only unlock when both characters are within 4 tiles of each other."
//
// Arantxa has max friendship with the player character:
//   • Blessing of Malnote (always hers, no cost): the player moves farther and takes less damage. She renews it on her
//     turn; it lapses if she's down or too far away.
//   • Always by Your Side (shared; both within 4 tiles): when the player Guards while adjacent to an enemy, she
//     teleports behind the player and fires a blast over their shoulder: the enemy goes back 3 squares, and the
//     blast hits harder the healthier she is.
//
// Natural pairs (Mala: "some natural pairs should have max friendship by default, like Pharaoh and Mummy or President
// and General"). Their shared abilities are provisional designs (Claude), active only while both stand within 4 tiles:
//   • Pharaoh + Mummy — The Retinue Rises: the first time the Mummy falls with its Pharaoh near, it gets back up at half LF.
//     The bond runs both ways (Mala, 2026-10-11): a Pharaoh's death raises a Mummy (content.js rules.risesOnDeath). That
//     Mummy has no living Pharaoh, so when it falls it stays down, unless a second Pharaoh stands within reach.
//   • President + General — Chain of Command: the President takes ×0.8 damage with the General near, and the General's
//     hits land ×1.15 on the President's orders.
// A max friend's death is never forgiven (insight/parley.js reads maxFriends).
//
//   keyOf(u)  maxFriends(u, v)  friendsNear(s, u, H) → standing max friends within the shared radius
//   beforeDefeat(s, u, H) → true when a bond keeps them up (engine skips the defeat)
//
//   bondOf(s, ally)              → { id, bond, partner } | null   (an allied, standing bond-holder and the player)
//   blessingAction(s, a, H)      → AI action for her turn, or null       bless(s, a, act, H) → error | undefined
//   moveBudgetAdd(s, a)  damageMul(s, tgt) → { mul, note }      afterGuard(s, guarder, H)   (the shared trigger)
// H = classH() from the engine (log, hit, knock, dist, actorAt, tileAt).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatBonds = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const BONDS = {
    arantxa: {
      friendship: "max", partner: "player",
      blessing: { id: "blessingOfMalnote", name: "Blessing of Malnote", range: 6, moveAdd: 1, damageTakenMul: 0.85,
        text: "No cost. The player character moves 1 farther and takes ×0.85 damage until Arantxa's next turn, when she renews it." },
      shared: { id: "alwaysByYourSide", name: "Always by Your Side", radius: 4, knockback: 3, potency: { min: 8, max: 30 },
        text: "When you Guard adjacent to an enemy and Arantxa is within 4 tiles, she teleports behind you and fires over your shoulder: the enemy is sent back 3 squares, harder the healthier she is." },
    },
  };
  const alive = (u) => u && !u.defeated && !u.notArrived;
  const PAIRS = [
    { pair: ["pharaoh", "mummy"], friendship: "max",
      shared: { id: "retinueRises", name: "The Retinue Rises", radius: 4, reviveFraction: 0.5,
        text: "Once a battle, when the Mummy falls with its Pharaoh within 4 tiles, it gets back up at half its LF." } },
    { pair: ["president", "general"], friendship: "max",
      shared: { id: "chainOfCommand", name: "Chain of Command", radius: 4, presidentTakenMul: 0.8, generalDealtMul: 1.15,
        text: "With the General within 4 tiles, the President takes ×0.8 damage and the General's hits land ×1.15." } },
  ];
  // Character id, or the monster key for Dream Space creatures (the Mummy is dream-mummy / monster "mummy").
  const keyOf = (u) => u?.character && !String(u.character).startsWith("dream") ? u.character : (u?.monster || u?.dream?.key || u?.character || null);
  const pairOf = (u, v) => PAIRS.find((p) => p.pair.includes(keyOf(u)) && p.pair.includes(keyOf(v)) && keyOf(u) !== keyOf(v)) || null;
  const maxFriends = (u, v) => !!u && !!v && u.id !== v.id && (pairOf(u, v)?.friendship === "max"
    || (BONDS[keyOf(u)]?.partner === v.id) || (BONDS[keyOf(v)]?.partner === u.id));
  function friendsNear(s, u, H, radius = 4) {
    return Object.values(s.actors).filter((v) => alive(v) && v.side === u.side && maxFriends(u, v) && H.dist(s, u.x, u.y, v.x, v.y) <= radius);
  }
  // The Retinue Rises: a rule on the shared survive-the-killing-blow base (survive.js); only the follow-up is the Mummy's own.
  const pharaohNear = (s, u, H) => keyOf(u) === "mummy" ? friendsNear(s, u, H).find((v) => keyOf(v) === "pharaoh") || null : null;
  const survivor = { id: "retinueRises", holds: (s, u, H) => !!pharaohNear(s, u, H), then(s, u, H) {
    const ph = pharaohNear(s, u, H), S = PAIRS[0].shared;
    u.lf = Math.max(1, Math.round(u.maxLF * S.reviveFraction));
    H.log(s, { kind: "bond", actor: ph.id, target: u.id, tiles: [[u.x, u.y]], text: `${S.name}: ${u.name} falls, and gets back up for ${ph.name} (${u.lf}/${u.maxLF} LF).`,
      why: [`Max friendship: the Pharaoh stands within ${S.radius} tiles. Once a battle.`] });
  } };
  const Survive = () => (typeof module === "object" && module.exports ? require("../survive.js") : self.ConceptCombatSurvive);
  const beforeDefeat = (s, u, H) => Survive().survive(s, u, survivor, H);

  function bondOf(s, ally) {
    const bond = BONDS[ally?.character];
    if (!bond || !alive(ally) || ally.id === bond.partner) return null;
    const partner = s.actors[bond.partner];
    if (!alive(partner) || partner.side !== ally.side || partner.character === ally.character) return null;
    return { id: ally.character, bond, partner };
  }
  const blessingOn = (s, u) => {
    const st = u?.status?.malnote;
    return st && alive(s.actors[st.owner]) ? st : null;
  };

  // Her turn: renew the blessing first (it's free) when it isn't already on the partner from her this turn.
  function blessingAction(s, a, H) {
    const b = bondOf(s, a); if (!b) return null;
    if (a.blessedOnTurn === a.ownerTurns) return null;
    if (H.dist(s, a.x, a.y, b.partner.x, b.partner.y) > b.bond.blessing.range) return null;
    return { type: "blessing", actor: a.id, target: b.partner.id };
  }
  function bless(s, a, act, H) {
    const b = bondOf(s, a); if (!b) return "No one here shares that bond.";
    const B = b.bond.blessing, p = b.partner;
    if (a.blessedOnTurn === a.ownerTurns) return `${a.name} has already given the ${B.name} this turn.`;
    if (H.dist(s, a.x, a.y, p.x, p.y) > B.range) return `${p.name} is too far away for the ${B.name}.`;
    a.blessedOnTurn = a.ownerTurns;
    p.status.malnote = { label: B.name, owner: a.id, expiresAt: a.ownerTurns + 1, moveAdd: B.moveAdd, damageTakenMul: B.damageTakenMul };
    H.log(s, { kind: "bond", actor: a.id, target: p.id, tiles: [[p.x, p.y]], text: `${a.name} gives ${p.name} the ${B.name}: +${B.moveAdd} movement and ×${B.damageTakenMul} damage taken.`,
      why: ["Max friendship: Arantxa always has this, and it costs nothing.", "It lasts until her next turn, when she renews it."] });
  }
  const moveBudgetAdd = (s, a) => blessingOn(s, a)?.moveAdd || 0;
  function damageMul(s, tgt, src = null, H = null) {
    let mul = 1; const notes = [];
    const st = blessingOn(s, tgt);
    if (st) { mul *= st.damageTakenMul; notes.push(`${st.label}: ×${st.damageTakenMul}.`); }
    if (H) {
      const C = PAIRS[1].shared;
      if (keyOf(tgt) === "president" && friendsNear(s, tgt, H).some((v) => keyOf(v) === "general")) { mul *= C.presidentTakenMul; notes.push(`${C.name}: the General screens the President ×${C.presidentTakenMul}.`); }
      if (src && keyOf(src) === "general" && s.actors[src.id] === src && friendsNear(s, src, H).some((v) => keyOf(v) === "president")) { mul *= C.generalDealtMul; notes.push(`${C.name}: on the President's orders ×${C.generalDealtMul}.`); }
    }
    return { mul, note: notes.join(" ") || null };
  }

  // Shared ability trigger: the partner just Guarded.
  function afterGuard(s, g, H) {
    for (const ally of Object.values(s.actors)) {
      const b = bondOf(s, ally); if (!b || b.partner.id !== g.id) continue;
      const S = b.bond.shared;
      if (H.dist(s, ally.x, ally.y, g.x, g.y) > S.radius) continue;           // the bond only reaches within 4 tiles
      if ((s.bonds ||= { triggered: {} }).triggered[`${ally.id}:${S.id}`] === s.round) continue;   // once a round
      const foe = Object.values(s.actors).filter((u) => alive(u) && u.side !== g.side && Math.abs(u.x - g.x) + Math.abs(u.y - g.y) === 1)
        .sort((x, y) => x.lf - y.lf)[0];
      if (!foe) continue;
      s.bonds.triggered[`${ally.id}:${S.id}`] = s.round;
      // Behind the partner = one step from them, directly away from the enemy.
      const bx = g.x + (g.x - foe.x), by = g.y + (g.y - foe.y);
      const free = bx >= 0 && by >= 0 && bx < s.arena.w && by < s.arena.h && !H.tileAt(s, bx, by)?.blocksMove && !H.actorAt(s, bx, by);
      if (free) { ally.x = bx; ally.y = by; }
      const frac = ally.maxLF ? Math.max(0, ally.lf) / ally.maxLF : 1;
      const potency = Math.round(S.potency.min + (S.potency.max - S.potency.min) * frac);
      H.log(s, { kind: "bond", actor: ally.id, target: foe.id, tiles: [[ally.x, ally.y], [foe.x, foe.y]],
        text: `${S.name}: ${ally.name} ${free ? "appears behind" : "answers from beside"} ${g.name} and fires over their shoulder at ${foe.name}.`,
        why: [`${g.name} guarded next to ${foe.name} with ${ally.name} within ${S.radius} tiles (max friendship).`, `Blast potency ${potency}: it scales with her health (${Math.round(frac * 100)}% LF).`] });
      const inst = { ability: S.id, name: S.name, concept: null, delivery: "line", damageType: "rubedo", bond: true };
      H.hit(s, ally, foe, inst, potency, [`${S.name}: over the shoulder.`]);
      if (alive(foe)) H.knock(s, ally, foe, S.knockback, inst, "push");
    }
  }

  // Natural pairs never fight each other, whichever sides they're on (Arantxa's bond with the player isn't one of these:
  // an enemy Arantxa still has to be fought, or the battle couldn't end).
  const naturalPair = (u, v) => pairOf(u, v)?.friendship === "max";
  return { BONDS, PAIRS, keyOf, maxFriends, naturalPair, friendsNear, beforeDefeat, survivor, bondOf, blessingAction, bless, moveBudgetAdd, damageMul, afterGuard };
});
