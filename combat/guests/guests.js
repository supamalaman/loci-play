"use strict";
// Shaman guests (SH1; claude-shaman-summoner-spec): cheap companions called by technique, outside the palace
// summon slot, capped at two seats (Spirit Table). Precedent: monkey/monkey.js hair clones.
// Guests count as summons for holy/Smite (summoned: true) and do not hold a side open.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatGuests = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const IDS = new Set(["spiritRaven", "ancestralFox", "spiritTotem"]);
  const KEY_OF = { spiritRaven: "spirit_raven", ancestralFox: "ancestral_fox", spiritTotem: "spirit_totem" };
  const SEATS = 2;
  const SEAL_ROUNDS = 2;
  const GUEST_AI = { contemplative: { open: 6.5, seated: 4.5, quiet: 1.5 } };
  const isShaman = (a) => a && (a.character === "shaman" || (a.primary === "threshold" && a.secondary === "hospitality"));
  const say = (s, H, a, text, why) => H.log(s, { kind: "guest", actor: a.id, text, ...(why ? { why } : {}) });
  const openTile = (s, H, x, y) => H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove && !H.actorAt(s, x, y) && !H.barrierAt(s, x, y);
  const guestsOf = (s, ownerId) => Object.values(s.actors).filter((u) => !u.defeated && u.companion?.guest && u.companion.owner === ownerId);
  const freeUsed = (a) => !!(a.guestFreeUsed);
  const markFree = (a) => { a.guestFreeUsed = true; };

  function dismiss(s, H, guest, why) {
    if (!guest || guest.defeated) return;
    guest.defeated = true; guest.escaped = true; guest.leaveReason = why || "returns through the door"; guest.tempo = 0;
    const cdef = s.rules.companions?.[guest.companion?.key];
    say(s, H, guest, `${guest.name} ${why || cdef?.leave || "returns through the door"}.`);
  }
  function dismissOldest(s, H, ownerId) {
    const seat = guestsOf(s, ownerId).sort((x, y) => (x.companion.seatedAt || 0) - (y.companion.seatedAt || 0));
    if (seat.length < SEATS) return null;
    const old = seat[0]; dismiss(s, H, old, "yields its seat to a new guest"); return old;
  }
  function dismissAll(s, H, ownerId, why) {
    for (const g of guestsOf(s, ownerId)) dismiss(s, H, g, why || "the host falls; every guest leaves");
  }

  function rememberKind(a, key) {
    a.guestKinds = a.guestKinds || [];
    if (!a.guestKinds.includes(key)) a.guestKinds.push(key);
  }
  function grantInspiration(s, H, guest) {
    const owner = s.actors[guest?.companion?.owner];
    if (!owner || owner.defeated || guest.lf <= 0) return;
    owner.inspiration = (owner.inspiration || 0) + 1;
    say(s, H, owner, `${owner.name} keeps ${guest.name}'s visit: Inspiration.`);
  }
  function spawnGuest(s, a, H, key, tx, ty, opts) {
    const def = (s.rules.companions || {})[key];
    if (!def) return null;
    opts = opts || {};
    const seated = guestsOf(s, a.id);
    let spent = false;
    if (!opts.pastLimit && seated.length >= SEATS && (a.inspiration || 0) > 0) {
      opts = { ...opts, pastLimit: true, clock: "round", rounds: 1 };
      spent = true;
    }
    if (!opts.pastLimit) dismissOldest(s, H, a.id);
    const id = `companion-${key}-${a.id}-${s.round}-${++s.seq}`;
    const moveAdd = (def.move ?? 3) - (s.rules.moveBudget || 3);
    const ally = {
      id, name: def.name, side: a.side, controller: "ai", ai: "ally", character: key, sprite: def.sprite,
      primary: def.primary, secondary: def.secondary, maxLF: def.lf, lf: def.lf, x: tx, y: ty,
      companion: { owner: a.id, key, turnsLeft: opts.clock === "round" ? null : def.turns, roundsLeft: opts.rounds != null ? opts.rounds : (def.rounds ?? null), guest: true, seatedAt: s.round * 1000 + (s.seq || 0) },
      summoned: true,   // Smite / holy fellMul and every "is a summon" read (spec SH1)
      ...(def.structure ? { structure: true } : {}),
      pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, level: a.level || 1, xp: 0, proficiency: a.proficiency || 1,
      reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
      reaction: s.rules.reactionsPerRound, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false,
      ownerTurns: 0, lastRecoverTurn: -99,
      status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null, ...(def.immobile ? { immobile: { owner: id, expiresAt: 99999 } } : {}) },
      inventory: [], inventoryCapacity: 0,
      passives: {
        ...(moveAdd ? { moveBudgetAdd: moveAdd } : {}),
        ...(def.noAttack ? { noStrike: true } : {}),
      },
      form: def.strikePotency != null ? { strike: { potency: def.strikePotency } } : null,
      traits: [], conditions: {}, lanyardUsed: false, bristleconeUsed: false, lastDamageType: null, defeated: false,
    };
    s.actors[ally.id] = ally; s.disclosures[ally.id] = {}; s.knowledge[ally.id] = {};
    if (s.observedAbilities) s.observedAbilities[ally.id] = [];
    if (H.insightRules) {
      const deck = H.insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed });
      s.insight.decks[ally.id] = deck; s.insight.knowledge[ally.id] = H.insightRules.spawnKnowledge(deck);
    }
    for (const other of Object.values(s.actors)) if (other.id !== ally.id && other.side !== ally.side) {
      (s.knowledge[other.id] ||= {})[ally.id] ||= { secondary: false, lens: false, abilities: {} };
      s.knowledge[ally.id][other.id] = { secondary: false, lens: false, abilities: {} };
    }
    s.order.splice(s.turnIndex + 1, 0, ally.id);
    const arrival = (def.arrival || "steps through").replace("{owner}", a.name).replace("{turns}", String(def.turns));
    say(s, H, a, `${def.name} ${arrival} at (${tx},${ty}).`, ["A guest: outside the palace slot, on a clock, no grave."]);
    if (spent) a.inspiration -= 1;
    rememberKind(a, key);
    if (key === "spirit_raven") ravenPulse(s, H, ally);
    return ally;
  }

  // Raven: on each of 8 lines of 5 tiles from itself (the 4 straight lines, then the diagonals) it reveals hidden units
  // and marks one foe it can see on those lines (the nearest) with exposed. Off the lines it sees nothing: it never
  // marks, names or reveals a unit beside it that is not on a line, and never marks a bystander or civilian.
  const concealed = (u) => { const c = u?.status?.concealed; return !!c && (c.until == null || c.until >= (u.ownerTurns || 0)); };
  const notFoe = (raven, u) => u.side === raven.side || u.side === "bystander" || u.side === "civilian" || !!u.civilian;
  function ravenPulse(s, H, raven) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const seen = [], onLine = [];
    for (const [dx, dy] of dirs) {
      for (let i = 1; i <= 5; i++) {
        const x = raven.x + dx * i, y = raven.y + dy * i;
        if (!H.inside(s, x, y)) break;
        const u = H.actorAt(s, x, y);
        if (!u || u.defeated || u.notArrived || u.side === raven.side) continue;
        if (concealed(u)) { delete u.status.concealed; seen.push(u); }
        if (!notFoe(raven, u)) onLine.push({ u, d: i });
      }
    }
    onLine.sort((p, q) => p.d - q.d);
    const best = onLine.find((o) => !concealed(o.u))?.u || null;
    if (best) {
      best.status.exposed = { owner: raven.id, expiresAt: (best.ownerTurns || 0) + 1, why: "Spirit Raven marked it on its line: incoming damage ×1.25." };
      say(s, H, raven, `${raven.name} marks ${best.name} on its line${seen.length ? ` and reveals ${seen.map((u) => u.name).join(", ")}` : ""}.`,
        ["Exposed for 1 round.", "It sees 5 tiles along each straight and diagonal line, not a room."]);
    } else if (seen.length) {
      say(s, H, raven, `${raven.name} reveals ${seen.map((u) => u.name).join(", ")} on its line.`);
    }
  }

  // Raven's counter (spec section 2): any hit ends it.
  function onHit(s, tgt, H) {
    if (!tgt?.companion?.guest || tgt.companion.key !== "spirit_raven" || tgt.defeated) return false;
    dismiss(s, H, tgt, "is struck and flies back through the door");
    return true;
  }

  function price(s, a, abilityId, m) {
    if (!IDS.has(abilityId) || !isShaman(a)) return;
    if (freeUsed(a)) return;
    // First guest call of the battle: no AP; ΦF is still paid (spec section 2).
    if (m.tempoCost > 0) {
      m.notes = m.notes || [];
      m.notes.push("Spirit Table: the first guest call this battle costs no action points (ΦF still paid).");
      m.tempoCost = 0;
      m.guestFreeAp = true;
    }
  }

  function beforeAbility(s, a, m) {
    const id = m.id || m.ability;
    if (id === "strike" && a?.companion?.guest && a.passives?.noStrike) return "Spirit Raven has no attack.";
    if (a?.companion?.echo && (IDS.has(id) || id === "ancestralMoot" || id === "echoDouble")) return "The Echo calls no guest.";
    if (id === "ancestralMoot" || id === "echoDouble") {
      if (!isShaman(a)) return "Only the Shaman opens this door.";
      if (a.companion?.guest) return "A guest cannot call a guest.";
      return null;
    }
    if (!IDS.has(id)) return null;
    if (!isShaman(a)) return "Only the Shaman seats these guests.";
    if (a.companion?.guest) return "A guest cannot call a guest.";
    if ((a.guestSeal || 0) > 0) return "Her guest calls are sealed.";
    return null;
  }

  function openTiles(s, H, a) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    return dirs.map(([dx, dy]) => [a.x + dx, a.y + dy]).filter(([x, y]) => openTile(s, H, x, y));
  }
  function target(s, a, m, tx, ty, H) {
    const id = m.id || m.ability;
    const fail = (error) => ({ ok: false, error });
    if (id === "ancestralMoot" || id === "echoDouble") {
      const gate = beforeAbility(s, a, m); if (gate) return fail(gate);
      return { ok: true, tiles: [[a.x, a.y]], targets: [] };
    }
    if (!IDS.has(id)) return null;
    const gate = beforeAbility(s, a, m); if (gate) return fail(gate);
    if (tx == null || !H.inside(s, tx, ty)) return fail("Choose an open tile within 3.");
    if (H.dist(s, a.x, a.y, tx, ty) > 3) return fail("The guest arrives within 3.");
    if (!openTile(s, H, tx, ty)) return fail("The guest needs an open tile.");
    return { ok: true, tiles: [[tx, ty]], targets: [] };
  }

  function moot(s, a, H) {
    const kinds = (a.guestKinds || []).slice(0, 3);
    const tiles = openTiles(s, H, a);
    let n = 0;
    for (const key of kinds) {
      const tile = tiles[n]; if (!tile) break;
      spawnGuest(s, a, H, key, tile[0], tile[1], { pastLimit: true, clock: "round", rounds: 1 });
      n += 1;
    }
    a.guestSeal = SEAL_ROUNDS;
    say(s, H, a, "The door stands open. Everyone she has ever hosted is coming in.", ["Every kind she has seated returns for 1 round, past the two seats.", "Her guest calls are sealed for 2 rounds."]);
    return true;
  }
  function echo(s, a, H) {
    const tile = openTiles(s, H, a)[0];
    if (!tile) { say(s, H, a, `${a.name}'s Echo finds no open tile.`); return true; }
    const [tx, ty] = tile;
    const id = `companion-echo-${a.id}-${s.round}-${++s.seq}`;
    const ally = {
      id, name: "Echo", side: a.side, controller: "ai", ai: "ally", character: "echo", sprite: a.sprite,
      primary: "threshold", secondary: "preservation", maxLF: a.maxLF, lf: a.maxLF, x: tx, y: ty,
      companion: { owner: a.id, key: "echo_double", turnsLeft: null, roundsLeft: 2, guest: false, echo: true, seatedAt: s.round * 1000 + (s.seq || 0) },
      pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, level: a.level || 1, xp: 0, proficiency: a.proficiency || 1,
      reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
      reaction: s.rules.reactionsPerRound, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false,
      ownerTurns: 0, lastRecoverTurn: -99,
      status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null },
      inventory: [], inventoryCapacity: 0, passives: {},
      form: { strike: { potency: a.form?.strike?.potency || 4 } },
      traits: [], conditions: {}, lanyardUsed: false, bristleconeUsed: false, lastDamageType: null, defeated: false,
    };
    s.actors[ally.id] = ally; s.disclosures[ally.id] = {}; s.knowledge[ally.id] = {};
    if (s.observedAbilities) s.observedAbilities[ally.id] = [];
    s.order.splice(s.turnIndex + 1, 0, ally.id);
    say(s, H, a, `An Echo of ${a.name} steps through at (${tx},${ty}) and repeats her basics for 2 rounds.`, ["It calls no guest, keeps no attendant, and cannot open the Moot.", "It leaves when she falls."]);
    return true;
  }
  function resolve(s, a, inst, H) {
    const id = inst.ability;
    if (id === "ancestralMoot") return moot(s, a, H);
    if (id === "echoDouble") return echo(s, a, H);
    if (!IDS.has(id)) return false;
    const key = KEY_OF[id];
    if (!key) return false;
    if (!isShaman(a)) { say(s, H, a, `${a.name}'s call fizzles: only the Shaman hosts these spirits.`); return true; }
    const [tx, ty] = inst.tiles[0];
    if (!openTile(s, H, tx, ty)) { say(s, H, a, `${a.name}'s call fizzles: (${tx},${ty}) is no longer open.`); return true; }
    const wasFree = !freeUsed(a);
    spawnGuest(s, a, H, key, tx, ty);
    if (wasFree) markFree(a);
    return true;
  }

  function foeNear(s, a, n, H) {
    return Object.values(s.actors).some((u) => u.side !== a.side && !u.defeated && H.dist(s, a.x, a.y, u.x, u.y) <= n);
  }
  function guestBonus(a) {
    const id = Object.keys(GUEST_AI).find((t) => (a?.traits || []).includes(t));
    return id ? GUEST_AI[id] : null;
  }
  function aiValue(s, a, cand, H) {
    const id = cand.ability; if (!IDS.has(id)) return null;
    if (a.companion?.guest || a.companion?.echo) return null;
    const table = guestBonus(a); if (!table) return null;
    if (guestsOf(s, a.id).length >= SEATS && id === "spiritRaven") return 2;
    if (foeNear(s, a, 6, H)) return guestsOf(s, a.id).length ? table.seated : table.open;
    return table.quiet;
  }

  // Attendants (SH3): a state on her, one at a time, drawn beside her. Not a guest and not a unit.
  // Numbers are the live totem and aura sizes (communion-data.js ingredients; auras.js signal 0.85, representation 1.1).
  const ATTEND = { radius: 2, ap: 20, phi: 2, turns: 3, pulses: 2, hitLess: 2, hitFloor: 1, heal: 2, phiGift: 1, muffle: 0.85, expose: 1.1 };
  const TOFU = ["bleed", "poison", "burning", "entangled", "stagger", "dread", "soaked", "woozy", "inebriated", "wrapped", "seedLodge"];
  const SPIRITS = {
    forest: { name: "Forest spirit", text: "Allies within 2 take 2 less from each hit, never below 1, for 1 round when she uses a technique, twice a turn." },
    blossom: { name: "Blossom spirit", text: "Allies within 2 heal 2 LF when she uses a technique, twice a turn." },
    water: { name: "Water spirit", text: "Allies within 2 are freed of one of these when she uses a technique, twice a turn: bleeding, poison, burning, entangled, stagger, dread, soaked, woozy, drunk, wrapped or a lodged seed. Stuns and grapples hold." },
    flower: { name: "Flower spirit", text: "Allies within 2 recover 1 ΦF when she uses a technique, twice a turn." },
    moss: { name: "Moss spirit", text: "Foes within 2 deal ×0.85 damage for 1 round when she uses a technique, twice a turn." },
    moon: { name: "Moon spirit", text: "Foes within 2 take ×1.1 damage for 1 round when she uses a technique, twice a turn." },
  };
  const nearOf = (s, a, H, pred) => Object.values(s.actors).filter((u) => u && !u.defeated && !u.notArrived && pred(u) && H.dist(s, a.x, a.y, u.x, u.y) <= ATTEND.radius);
  const allySide = (a, u) => u.side === a.side;
  const foeSide = (a, u) => u.side !== a.side && u.side !== "bystander" && u.side !== "civilian" && !u.civilian;

  function tickAttendant(s, a, H) {
    const t = a?.attendant; if (!t) return;
    if (a.defeated) { a.attendant = null; return; }
    if ((a.ownerTurns || 0) >= t.untilTurn) {
      say(s, H, a, `The ${t.name} steps back.`);
      a.attendant = null;
      return;
    }
    t.pulses = 0;
  }

  function callAttendant(s, a, act, H, spend) {
    const sp = SPIRITS[act?.kind];
    if (!sp) return "Choose a spirit.";
    if (!isShaman(a)) return "Only the Shaman calls an attendant.";
    if (a.companion?.guest) return "A guest does not keep an attendant.";
    if (a.attendantCalledTurn === a.ownerTurns) return "She calls one spirit a turn.";
    if ((a.tempo ?? 0) < ATTEND.ap) return "Calling a spirit needs 20 action points.";
    if ((a.pf ?? 0) < ATTEND.phi) return "Calling a spirit needs 2 ΦF.";
    const spent = spend?.(ATTEND.ap, `Call the ${sp.name}`);
    if (spent) return spent;
    a.pf -= ATTEND.phi;
    if (a.attendant) say(s, H, a, `The ${a.attendant.name} steps back.`);
    a.attendant = { kind: act.kind, name: sp.name, text: sp.text, untilTurn: (a.ownerTurns || 0) + 1 + ATTEND.turns, pulses: 0, cleansed: [] };   // R-20261111-25: the call turn is free; the 3-turn clock starts the turn after (as a totem skips its wake turn)
    a.attendantCalledTurn = a.ownerTurns;
    say(s, H, a, `${a.name} calls the ${sp.name}.`, [sp.text, `It stays beside her for ${ATTEND.turns} of her turns. The call spends ${ATTEND.ap} AP and ${ATTEND.phi} ΦF, and it is not a technique.`]);
    return null;
  }

  function pulse(s, a, inst, H) {
    if (!s || s.preview || !a || !inst || !H) return;
    if (inst.performanceEcho || inst.deception) return;
    const t = a.attendant;
    if (!t || !SPIRITS[t.kind] || !isShaman(a) || a.companion?.guest) return;
    if ((t.pulses || 0) >= ATTEND.pulses) return;
    t.pulses += 1;
    const allies = nearOf(s, a, H, (u) => allySide(a, u));
    const foes = nearOf(s, a, H, (u) => foeSide(a, u));
    const list = H.Communion?.ingredients?.rules?.tofuCleanses || TOFU;
    if (t.kind === "forest") {
      for (const u of allies) { u.status = u.status || {}; u.status.forestCover = { until: s.round, less: ATTEND.hitLess, floor: ATTEND.hitFloor }; }
    } else if (t.kind === "blossom") {
      for (const u of allies) {
        if (u.companion?.guest || u.lf >= u.maxLF) continue;
        const n = Math.min(ATTEND.heal, u.maxLF - u.lf); u.lf += n;
        H.log(s, { kind: "heal", actor: a.id, target: u.id, text: `The ${t.name} mends ${u.name}: +${n} LF.` });
      }
    } else if (t.kind === "water") {
      for (const u of allies) {
        if (t.cleansed.includes(u.id)) continue;
        const k = list.find((key) => u.status?.[key]);
        if (!k) continue;
        u.status[k] = null; t.cleansed.push(u.id);
        H.log(s, { kind: "effect", actor: a.id, target: u.id, text: `The ${t.name} eases ${u.name}: ${k} ends.` });
      }
    } else if (t.kind === "flower") {
      for (const u of allies) {
        if (u.pf >= u.maxPF) continue;
        const n = Math.min(ATTEND.phiGift, u.maxPF - u.pf); u.pf += n;
        H.log(s, { kind: "effect", actor: a.id, target: u.id, text: `The ${t.name} restores ${n} ΦF to ${u.name}.` });
      }
    } else if (t.kind === "moss") {
      for (const u of foes) { u.status = u.status || {}; u.status.mossMuffle = { until: s.round, mul: ATTEND.muffle }; }
    } else if (t.kind === "moon") {
      for (const u of foes) { u.status = u.status || {}; u.status.moonExpose = { until: s.round, mul: ATTEND.expose }; }
    }
    say(s, H, a, `The ${t.name} answers ${a.name}'s technique (${t.pulses}/${ATTEND.pulses} this turn).`, [SPIRITS[t.kind].text]);
  }

  function thinVeil(s, a, H) {
    if (!a || a.defeated || !(a.traits || []).includes("thinVeil")) return;
    const seen = [];
    for (const u of Object.values(s.actors)) {
      if (!u || u.defeated || u.id === a.id || !concealed(u)) continue;
      if (H.dist(s, a.x, a.y, u.x, u.y) > 2) continue;
      delete u.status.concealed;
      seen.push(u);
    }
    if (seen.length) say(s, H, a, `${a.name} sees through the veil: ${seen.map((u) => u.name).join(", ")}.`, ["Thin Veil: a hidden unit within 2 tiles, and not at 3."]);
  }
  function turnStart(s, a, H) {
    thinVeil(s, a, H);
    tickAttendant(s, a, H);
    if (a.companion?.guest && a.companion.key === "spirit_raven" && !a.defeated) ravenPulse(s, H, a);
    if (a.companion?.guest) {
      const owner = s.actors[a.companion.owner];
      if (!owner || owner.defeated) dismiss(s, H, a, "the host is gone; the guest leaves");
    }
  }

  function onOwnerFell(s, owner, H) {
    if (!owner) return;
    if (owner.attendant) { const n = owner.attendant.name; owner.attendant = null; say(s, H, owner, `The ${n} leaves with her.`); }
    dismissAll(s, H, owner.id, "the host falls; every guest leaves");
    for (const u of Object.values(s.actors)) if (!u.defeated && u.companion?.echo && u.companion.owner === owner.id) dismiss(s, H, u, "leaves when she falls");
  }

  // Totem clock (SH2; spec termination 5.1): rounds-based, ticked from beginRound — companionTick only counts its own turns.
  function roundStart(s, H) {
    for (const u of Object.values(s.actors)) if (!u.defeated && (u.guestSeal || 0) > 0) u.guestSeal -= 1;
    for (const u of Object.values(s.actors)) {
      if (u.defeated || u.companion?.roundsLeft == null) continue;
      u.companion.roundsLeft -= 1;
      if (u.companion.roundsLeft <= 0) {
        if (u.companion.guest && u.lf > 0) grantInspiration(s, H, u);
        dismiss(s, H, u, s.rules.companions?.[u.companion.key]?.leave);
      }
    }
  }
  function clockEnded(s, a, H) {
    if (!a?.companion?.guest || !a.defeated || a.lf <= 0) return;
    if (a.companion.turnsLeft == null || a.companion.turnsLeft > 0) return;
    grantInspiration(s, H, a);
  }
  function openDoor(s, H) {
    const host = Object.values(s.actors).find((u) => u.character === "shaman" && !u.defeated);
    if (!host) return;
    const tiles = openTiles(s, H, host);
    ["spirit_raven", "ancestral_fox"].forEach((key, i) => { if (tiles[i]) spawnGuest(s, host, H, key, tiles[i][0], tiles[i][1]); });
  }

  return { IDS, KEY_OF, SEATS, ATTEND, SPIRITS, GUEST_AI, isShaman, guestsOf, freeUsed, price, ravenPulse, onHit, beforeAbility, target, resolve, aiValue, guestBonus, turnStart, thinVeil, onOwnerFell, spawnGuest, dismissAll, roundStart, clockEnded, openDoor, callAttendant, pulse };
});
