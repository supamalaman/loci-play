"use strict";
// Longtermism (Mala, 2026-10-21): a resolved Longtermism technique may call one Children of the Future member.
// Children of the Future is a faction pool (Child of the Future, Futuristic Armored Ninja), not a battle side.
// One body; a random member answers each call, and a second success refreshes the same body.
// Strikes, moves and guards do not roll. The graph edges besides this call are hypotheses and are not wired.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).longtermism = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  const { log, inside, actorAt, tileAt, barrierAt, insightRules } = H;
  const rulesOf = (s) => s.rules?.longtermism || {};
  const tagged = (s, inst) => {
    const R = rulesOf(s);
    if (!inst) return false;
    if (inst.concept === "longtermism") return true;
    if (Array.isArray(inst.concepts) && inst.concepts.includes("longtermism")) return true;
    return Array.isArray(R.abilities) && R.abilities.includes(inst.ability);
  };
  const openBeside = (s, a) => {
    const open = ([x, y]) => inside(s, x, y) && !tileAt(s, x, y).blocksMove && !actorAt(s, x, y) && !barrierAt(s, x, y) && !(s.wild || []).some((m) => m.form === "unit" && m.x === x && m.y === y);
    return [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [a.x + dx, a.y + dy]).find(open) || null;
  };
  const poolOf = (s) => rulesOf(s).members || [rulesOf(s).key || "child_of_the_future"];
  const living = (s, ownerId) => { const pool = poolOf(s); return Object.values(s.actors).find((u) => !u.defeated && u.lf > 0 && u.companion && pool.includes(u.companion.key) && u.companion.owner === ownerId); };
  // Patient Patron lens (kits-data longtermism): the resolved lens id rides on inst.lens (engine.js manifest).
  const lensDuration = (inst) => {
    const prof = inst?.lens && H.C?.concepts?.longtermism?.lens?.profiles?.[inst.lens];
    if (prof?.durationAdd) return { add: prof.durationAdd, patient: inst.lens === "patientPatron" };
    if (inst?.lens === "patientPatron") return { add: 1, patient: true };   // data fallback: the lens id alone
    return { add: 0, patient: false };
  };

  function scheduleBequest(s, a) {
    const lf = rulesOf(s).bequestLf ?? 8;
    a.longtermismBequest = { due: (a.ownerTurns || 0) + 1, lf };
    log(s, { kind: "effect", actor: a.id, text: `${a.name} writes a bequest of ${lf} Life Force, due next turn.` });
  }
  // Stolen life is principal. It never joins the thief's own Life Force.
  function skim(s, a, tgt, amount) {
    const R = rulesOf(s);
    const cap = R.fundCap ?? 24;
    const want = amount ?? R.skimLf ?? 6;
    const far = typeof H.dist === "function" && tgt && H.dist(s, a.x, a.y, tgt.x, tgt.y) > 1;
    if (!tgt || tgt.defeated || tgt.side === a.side || far) {
      log(s, { kind: "effect", actor: a.id, text: `${a.name} reaches, and the present is not in hand.` });
      return 0;
    }
    if (tgt.status?.guard) {
      log(s, { kind: "effect", actor: a.id, target: tgt.id, text: `${tgt.name}'s guard covers the present. ${a.name} takes nothing.` });
      return 0;
    }
    const room = Math.max(0, cap - (a.longtermismFund || 0));
    const take = Math.min(want, Math.max(0, (tgt.lf || 0) - 1), room);
    if (take <= 0) {
      log(s, { kind: "effect", actor: a.id, target: tgt.id, text: room <= 0 ? `${a.name}'s fund is full (${cap}). The rest stays in the present.` : `${a.name} finds ${tgt.name} at 1 and takes nothing.` });
      return 0;
    }
    tgt.lf -= take;
    a.longtermismFund = (a.longtermismFund || 0) + take;
    log(s, { kind: "effect", actor: a.id, target: tgt.id, text: `${a.name} steals ${take} Life Force from the present. The fund holds ${a.longtermismFund}.` });
    return take;
  }
  function invest(s, a) {
    const R = rulesOf(s);
    const cap = R.investCap ?? R.fundCap ?? 24;
    const fund = a.longtermismFund || 0;
    if (fund <= 0) {
      log(s, { kind: "effect", actor: a.id, text: `${a.name} opens the fund and finds it empty.` });
      return 0;
    }
    const here = living(s, a.id);
    const held = here ? (here.longtermismBonus || 0) : (a.longtermismPending || 0);
    const add = Math.min(fund, Math.max(0, cap - held));
    if (add <= 0) {
      log(s, { kind: "effect", actor: a.id, text: `${a.name}'s future is already holding ${cap}. The fund stays at ${fund}.` });
      return 0;
    }
    a.longtermismFund = fund - add;
    if (here) {
      here.longtermismBonus = held + add;
      const base = R.lf ?? 40;
      here.maxLF = base + here.longtermismBonus;
      here.lf = here.maxLF;
      log(s, { kind: "effect", actor: a.id, target: here.id, text: `${a.name} invests ${add} in ${here.name}. They can hold ${here.maxLF}.` });
    } else {
      a.longtermismPending = held + add;
      log(s, { kind: "effect", actor: a.id, text: `${a.name} invests ${add} in a future that has not arrived. The principal waits.` });
    }
    return add;
  }
  function payPending(s, a, ally) {
    const R = rulesOf(s);
    const base = R.lf ?? 40;
    const cap = R.investCap ?? R.fundCap ?? 24;
    const pending = a.longtermismPending || 0;
    if (pending > 0) {
      ally.longtermismBonus = Math.min(cap, (ally.longtermismBonus || 0) + pending);
      a.longtermismPending = 0;
      log(s, { kind: "effect", actor: ally.id, target: a.id, text: `The investment arrives with ${ally.name}: +${ally.longtermismBonus} Life Force.` });
    }
    ally.maxLF = base + (ally.longtermismBonus || 0);
    ally.lf = ally.maxLF;
  }
  function layWard(s, a, inst) {
    const R = rulesOf(s);
    let protection = R.ward ?? 6;
    if (lensDuration(inst).patient) protection = Math.max(1, Math.round(protection * 0.9));   // Patient Patron: longer stay, thinner ward
    a.status.ward = { label: "Endowment", owner: a.id, protection, expiresAt: (a.ownerTurns || 0) + (R.wardTurns ?? 2), longtermism: true };
    log(s, { kind: "effect", actor: a.id, text: `${a.name}'s Endowment replaces the ward: ${protection} protection.` });
  }
  function arrive(s, a, turns) {
    const R = rulesOf(s);
    const pool = poolOf(s);
    const seq = (s.longtermismSeq || 0) + 1;
    const key = pool[Math.floor(H.seededChance(`${s.seed}:longtermism:member:${a.id}:${seq}`) * pool.length)] || pool[0];
    const def = s.rules.companions?.[key] || {};
    const at = openBeside(s, a);
    if (!at) {
      log(s, { kind: "companion", actor: a.id, text: `${a.name}'s call finds no open tile beside them.` });
      return null;
    }
    s.longtermismSeq = (s.longtermismSeq || 0) + 1;
    const ally = {
      id: `child-${a.id}-${s.longtermismSeq}`, name: def.name || "Child of the Future", side: a.side, controller: "ai", ai: "ally",
      character: key, sprite: def.sprite || R.sprite || "child-of-the-future", faction: R.faction || "children_of_the_future",
      primary: null, secondary: null, maxLF: R.lf ?? def.lf ?? 40, lf: R.lf ?? def.lf ?? 40, x: at[0], y: at[1],
      companion: { owner: a.id, key, manual: true, turnsLeft: turns },
      pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, level: a.level || 1, xp: 0, proficiency: a.proficiency || 1,
      reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
      reaction: s.rules.reactionsPerRound, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false,
      ownerTurns: 0, lastRecoverTurn: -99, status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null },
      inventory: [], inventoryCapacity: 0, passives: {}, traits: [], conditions: {}, lanyardUsed: false, bristleconeUsed: false, lastDamageType: null, defeated: false,
    };
    s.actors[ally.id] = ally; s.disclosures[ally.id] = {}; s.knowledge[ally.id] = {};
    if (s.observedAbilities) s.observedAbilities[ally.id] = [];
    if (insightRules) {
      const deck = insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed });
      s.insight.decks[ally.id] = deck; s.insight.knowledge[ally.id] = insightRules.spawnKnowledge(deck);
    }
    for (const other of Object.values(s.actors)) if (other.id !== ally.id && other.side !== ally.side) {
      (s.knowledge[other.id] ||= {})[ally.id] ||= { secondary: false, lens: false, abilities: {} };
      s.knowledge[ally.id][other.id] = { secondary: false, lens: false, abilities: {} };
    }
    s.order.splice(s.turnIndex + 1, 0, ally.id);
    payPending(s, a, ally);
    // quietDoor: a concealed holder brings a concealed traveler, for what is left of the holder's cover.
    const cover = a.status?.concealed;
    if (cover && (cover.until == null || cover.until >= (a.ownerTurns || 0))) {
      const left = cover.until == null ? 99 : Math.max(1, cover.until - (a.ownerTurns || 0));
      ally.status.concealed = { until: (ally.ownerTurns || 0) + left };
      log(s, { kind: "companion", actor: ally.id, target: a.id, text: `${ally.name} steps through unseen, under ${a.name}'s cover.` });
    }
    log(s, { kind: "companion", actor: ally.id, target: a.id, tiles: [at], arrived: true, text: `A ${def.name || "Child of the Future"} steps through beside ${a.name} for ${turns} of their turns.` });
    return ally;
  }
  function afterTechnique(s, a, inst) {
    if (!s || s.preview || !a || a.defeated || !tagged(s, inst)) return;
    const R = rulesOf(s);
    if (inst.ability === "bequest") scheduleBequest(s, a);
    else if (inst.ability === "endowment") layWard(s, a, inst);
    s.longtermismRolls = (s.longtermismRolls || 0) + 1;
    const certain = inst.tier === "ultimate";
    const chance = certain ? 1 : (R.chance ?? 0.20);
    const roll = certain ? 0 : H.seededChance(`${s.seed}:longtermism:${a.id}:${s.longtermismRolls}`);
    if (roll >= chance) {
      log(s, { kind: "companion", actor: a.id, missed: true, text: `${a.name} calls. Nobody steps through.` });
      return;
    }
    const turns = (certain ? (R.ultimateTurns ?? 5) : (R.turns ?? 3)) + lensDuration(inst).add;
    const here = living(s, a.id);
    if (here) {
      payPending(s, a, here);
      here.companion.turnsLeft = turns;
      log(s, { kind: "companion", actor: here.id, target: a.id, text: `${here.name} is made whole again.` });
      return;
    }
    if (!openBeside(s, a)) {
      // queuedCall: a success with nowhere to step waits one turn instead of dying.
      a.longtermismQueued = { turns, until: (a.ownerTurns || 0) + 1 };
      log(s, { kind: "companion", actor: a.id, queued: true, text: `${a.name}'s call finds no open tile beside them. The door holds until their next turn.` });
      return;
    }
    arrive(s, a, turns);
  }
  function turnStart(s, a) {
    if (!s || s.preview || !a || a.defeated) return;
    const bill = a.longtermismBequest;
    if (bill && (a.ownerTurns || 0) >= bill.due) {
      const paid = Math.min(bill.lf, Math.max(0, (a.lf || 0) - 1));
      a.lf -= paid;
      a.longtermismBequest = null;
      log(s, { kind: "effect", actor: a.id, text: paid > 0 ? `${a.name} pays the bequest: ${paid} Life Force.` : `${a.name} finds them at 1 and takes nothing.` });
    }
    const ward = a.status?.ward;
    if (ward?.longtermism && (a.ownerTurns || 0) >= ward.expiresAt) {
      a.status.ward = null;
      log(s, { kind: "effect", actor: a.id, text: `${a.name}'s Endowment fades.` });
    }
    const queued = a.longtermismQueued;
    if (queued) {
      if (openBeside(s, a) && !living(s, a.id)) {
        a.longtermismQueued = null;
        arrive(s, a, queued.turns);
      } else if ((a.ownerTurns || 0) >= queued.until) {
        a.longtermismQueued = null;
        log(s, { kind: "companion", actor: a.id, text: `${a.name}'s held call finds still no tile. The door closes.` });
      }
    }
  }
  // The rescue (Mala spec 2026-10-24, loop 1a16f3e1a6b): ONE roll when Gaia first drops to half
  // life, 10%; time travelers step through on her side to protect her. Single check per battle.
  // Who answers is the standing pool (no dedicated rescue characters exist yet); the arrival
  // cutscene is the companions' shared arrivalScene. Called from damage.js on a crossing hit.
  function gaiaRescue(s, gaia) {
    if (!s || s.preview || s.gaiaRescueRolled || !gaia || gaia.defeated || gaia.lf <= 0) return;
    s.gaiaRescueRolled = true;
    const R = rulesOf(s);
    const roll = H.seededChance(`${s.seed}:gaiaRescue`);
    if (roll >= (R.rescueChance ?? 0.10)) {
      log(s, { kind: "companion", actor: gaia.id, missed: true, text: "The future does not answer Gaia's fall." });
      return;
    }
    const turns = R.rescueTurns ?? R.turns ?? 3;
    const here = living(s, gaia.id);
    if (here) {
      here.companion.turnsLeft = turns;
      log(s, { kind: "companion", actor: here.id, target: gaia.id, text: `${here.name} turns to shield Gaia.` });
      return;
    }
    if (!openBeside(s, gaia)) {
      gaia.longtermismQueued = { turns, until: (gaia.ownerTurns || 0) + 1 };
      log(s, { kind: "companion", actor: gaia.id, queued: true, text: "The future answers, but there is nowhere beside Gaia to step. The door holds a turn." });
      return;
    }
    const ally = arrive(s, gaia, turns);
    if (ally) log(s, { kind: "companion", actor: ally.id, target: gaia.id, text: `${ally.name} turns to shield Gaia.` });
  }
  return { Longtermism: { afterTechnique, turnStart, tagged, skim, invest, gaiaRescue } };
});
