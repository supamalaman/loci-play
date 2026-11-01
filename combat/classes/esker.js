"use strict";
// Esker (Interposition + Berm; Mala's note "a good name for a character whose role is to keep two characters who are
// being shortsighted from destroying each other"; brief ~/loci-orbit/muse/concept-mine/ESKER_BRIEF.md; built 2026-10-18).
// The ridge between two plains: Esker names two wards on opposite sides and takes the hits meant for either, carries
// their troubles as burden, remembers who struck first, and at the last turns its own footpath into a ridge nobody
// may walk across.
//
// State: a.status.eskerBetween = { wards: [idA, idB], until } on Esker; each ward's status.intercept carries
// between: true; a.status.eskerBurden = { stacks } (max 3); s.eskerMarks[eskerId] = { target, round } (Oathbreaker);
// s.eskerPath[eskerId] = the last tiles Esker walked (max PATH). Hooks are called from classes/class-runtime.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatEsker = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = {
    between: { range: 4, partnerRange: 4, uses: 2, mul: 0.8, turns: 2, reach: 3 },
    burden: { max: 3, damagePer: 0.1, movePer: 1 },
    debuffs: ["stun", "entangled", "exposed", "dread", "attention"],
    carryWard: 10,
    mark: { mul: 1.2, ridgeMul: 1.5, entangleTurns: 1 },
    divide: { minPath: 3, path: 10, turns: 3 },
  };
  const PATH = RULES.divide.path;
  const is = (a) => !!a && (a.character === "esker" || (a.primary === "interposition" && a.secondary === "berm"));
  const live = (s) => Object.values(s.actors || {}).filter((u) => u && !u.defeated && !u.notArrived && !u.escaped);
  const st = (u) => (u.status ||= {});
  const active = (x, u) => !!x && (x.until == null || x.until >= (u?.ownerTurns ?? 0));
  const hostile = (s, a, b) => a.side !== b.side && a.side !== "civilian" && b.side !== "civilian";
  const burden = (a) => a?.status?.eskerBurden?.stacks || 0;
  const wardsOf = (s, a) => (active(a.status?.eskerBetween, a) ? a.status.eskerBetween.wards.map((id) => s.actors[id]).filter((u) => u && !u.defeated) : []);
  const markOf = (s, a) => { const m = s.eskerMarks?.[a.id]; return m && s.round - m.round <= 1 ? s.actors[m.target] || null : null; };
  const eskerOfWard = (s, u) => { const ic = u?.status?.intercept; return ic?.between ? s.actors[ic.by] || null : null; };

  // The second ward: the nearest unit hostile to the first, within reach of Esker.
  function partnerFor(s, a, first, H) {
    return live(s).filter((u) => u.id !== a.id && u.id !== first.id && hostile(s, first, u) && !u.wild && H.dist(s, a.x, a.y, u.x, u.y) <= RULES.between.partnerRange)
      .sort((x, y) => H.dist(s, first.x, first.y, x.x, x.y) - H.dist(s, first.x, first.y, y.x, y.y) || (x.id < y.id ? -1 : 1))[0] || null;
  }

  function target(s, a, w, tx, ty, H) {
    const fail = (error) => ({ ok: false, error });
    if (["between", "shoulder", "divide"].includes(w.kind) && s.rules?.esker === false) return fail("Esker's craft is switched off (rules.esker; a sim baseline).");
    if (w.kind === "between") {
      const occ = H.actorAt(s, tx, ty);
      if (!occ || occ.id === a.id || occ.defeated) return fail("Name a ward: anyone but yourself, on either side.");
      if (H.dist(s, a.x, a.y, tx, ty) > RULES.between.range) return fail(`A ward must be within ${RULES.between.range}.`);
      const other = partnerFor(s, a, occ, H);
      if (!other) return fail(`Between needs two sides: nobody hostile to ${occ.name} is within ${RULES.between.partnerRange} of you.`);
      return { ok: true, tiles: [[tx, ty]], targets: [occ.id, other.id] };
    }
    if (w.kind === "shoulder") {
      if (tx !== a.x || ty !== a.y) return fail("Target yourself.");
      if (!wardsOf(s, a).length) return fail("Shoulder Both carries your wards' troubles: name them with Between first.");
      return { ok: true, tiles: [[a.x, a.y]], targets: [a.id], self: true };
    }
    if (w.kind === "divide") {
      if (tx !== a.x || ty !== a.y) return fail("Target yourself.");
      const n = ridgeTiles(s, a, H).length;
      if (n < RULES.divide.minPath) return fail(`The Divide raises the ground you have walked: walk at least ${RULES.divide.minPath} tiles first (${n} so far).`);
      return { ok: true, tiles: [[a.x, a.y]], targets: [a.id], self: true };
    }
    return null;
  }

  function ridgeTiles(s, a, H) {
    const seen = new Set(), out = [];
    for (const [x, y] of (s.eskerPath?.[a.id] || []).slice().reverse()) {
      const k = x + "," + y; if (seen.has(k)) continue; seen.add(k);
      if (!H.inside(s, x, y) || H.tileAt(s, x, y).blocksMove || H.barrierAt(s, x, y) || H.actorAt(s, x, y)) continue;
      out.push([x, y]);
    }
    return out.slice(0, PATH);
  }

  function resolve(s, a, inst, w, H) {
    const say = (text, why = []) => H.log(s, { kind: "effect", actor: a.id, text, why });
    if (w.kind === "between") {
      const [first, other] = (inst.targets || []).map((id) => s.actors[id]);
      if (!first || !other) { say(`${a.name} finds no line to stand on.`); return true; }
      for (const old of wardsOf(s, a)) if (old.status?.intercept?.between && old.status.intercept.by === a.id) old.status.intercept = null;
      const B = RULES.between;
      for (const u of [first, other]) st(u).intercept = { by: a.id, uses: B.uses, mul: B.mul, until: u.ownerTurns + B.turns, between: true };
      st(a).eskerBetween = { wards: [first.id, other.id], until: a.ownerTurns + B.turns };
      say(`${a.name} stands between ${first.name} and ${other.name}: hits meant for either land on ${a.name} (×${B.mul}, ${B.uses} each) while ${a.name} is within ${B.reach}.`,
        ["A ridge belongs to neither plain.", "Whoever strikes across first is marked Oathbreaker."]);
      return true;
    }
    if (w.kind === "shoulder") {
      const notes = [];
      for (const u of wardsOf(s, a)) {
        if (H.dist(s, a.x, a.y, u.x, u.y) > RULES.between.reach) { notes.push(`${u.name} is out of reach`); continue; }
        const k = RULES.debuffs.find((d) => u.status?.[d]);
        if (k && burden(a) < RULES.burden.max) {
          u.status[k] = null; const b = (st(a).eskerBurden ||= { stacks: 0 }); b.stacks = Math.min(RULES.burden.max, b.stacks + 1);
          notes.push(`takes ${u.name}'s ${k}`);
        } else {
          if ((u.status?.ward?.protection || 0) < RULES.carryWard) st(u).ward = { label: "Carried", owner: a.id, protection: RULES.carryWard, expiresAt: u.ownerTurns + 1 };
          notes.push(`steadies ${u.name} (ward ${RULES.carryWard})`);
        }
      }
      const n = burden(a);
      say(`${a.name} shoulders both: ${notes.join("; ")}. Burden ${n}/${RULES.burden.max}${n ? ` (+${Math.round(n * RULES.burden.damagePer * 100)}% damage, −${n * RULES.burden.movePer} move${n >= RULES.burden.max ? ", cannot be moved" : ""})` : ""}.`,
        ["Carried weight is close to the earth: harder hitting, slower, and at full load immovable."]);
      return true;
    }
    if (w.kind === "divide") {
      const tiles = ridgeTiles(s, a, H), T = RULES.divide.turns;
      for (const [x, y] of tiles) s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x, y, concept: "ridge", duration: T, expiresAt: a.ownerTurns + T,
        passable: false, blocksMove: true, blocksRoute: false, blocksSight: false, linePassable: true, coverFraction: 0, protection: 0 });
      s.eskerPath[a.id] = [];
      say(`${a.name} raises the divide: the ${tiles.length} tiles ${a.name} walked become a ridge for ${T} rounds. Nobody may walk across it; lines and fields still pass over.`,
        ["Fights end at the ridge, or not at all.", "It is Esker's own path, not a wall: go around it."]);
      H.log(s, { kind: "terrain", actor: a.id, tiles, text: `A ridge rises along ${a.name}'s path.` });
      return true;
    }
    return false;
  }

  // class-runtime redirect: a ward's intercept never turns Esker's own blow back on Esker; whoever strikes across first is marked.
  function exempt(s, src, ic) { return !!ic?.between && src?.id === ic.by; }
  function crossed(s, src, ward, g, H) {
    if (!is(g) || !src || src.id === g.id || src.side === g.side) return;   // Esker's own side is answered by the line breaking, not the mark
    const marks = (s.eskerMarks ||= {}), m = marks[g.id];
    if (m && m.round === s.round) return;
    marks[g.id] = { target: src.id, round: s.round };
    H.log(s, { kind: "effect", actor: g.id, target: src.id, oathbreaker: true, text: `The ridge remembers: ${src.name} struck first across ${g.name}. ${src.name} is marked Oathbreaker.`,
      why: [`${g.name}'s hits on an Oathbreaker are ×${RULES.mark.mul}; The Ridge Remembers ×${RULES.mark.ridgeMul} and holds them.`, "One mark at a time; it fades after the next round."] });
  }

  function damageMods(s, src, tgt, inst) {
    let mult = 1; const notes = [];
    if (is(src) && burden(src)) { const k = 1 + burden(src) * RULES.burden.damagePer; mult *= k; notes.push(`Burden ${burden(src)}: ×${+k.toFixed(2)}.`); }
    if (is(src) && tgt && markOf(s, src)?.id === tgt.id) {
      const k = inst?.ability === "ridgeRemembers" ? RULES.mark.ridgeMul : RULES.mark.mul; mult *= k; notes.push(`Oathbreaker: ×${k}.`);
    }
    return { mult, notes };
  }

  function afterHit(s, src, tgt, inst, dealt, H) {
    if (!src || !tgt || !(dealt > 0)) return;
    // Striking a ward directly (the intercept spent or out of reach) also counts as striking across.
    const g = eskerOfWard(s, tgt);
    if (g && src.id !== g.id && active(g.status?.eskerBetween, g) && g.status.eskerBetween.wards.includes(tgt.id)) crossed(s, src, tgt, g, H);
    // Esker strikes one of its own wards: the line is broken.
    if (is(src) && wardsOf(s, src).some((u) => u.id === tgt.id)) {
      for (const u of wardsOf(s, src)) if (u.status?.intercept?.between && u.status.intercept.by === src.id) u.status.intercept = null;
      src.status.eskerBetween = null;
      H.log(s, { kind: "effect", actor: src.id, target: tgt.id, text: `${src.name} struck a ward: the line between them is broken.`, why: ["A mediator who takes a side is just another fighter."] });
    }
    if (is(src) && inst?.ability === "ridgeRemembers" && markOf(s, src)?.id === tgt.id && !tgt.defeated && !tgt.boss) {
      st(tgt).entangled = { label: "Held by the ridge", owner: src.id, lostMove: 99, expiresAt: tgt.ownerTurns + RULES.mark.entangleTurns };
      H.log(s, { kind: "effect", actor: src.id, target: tgt.id, text: `The ridge holds ${tgt.name} where they stand.` });
    }
  }

  function moved(s, a, from, traversed) {
    if (!is(a) || !traversed?.length) return;
    const p = ((s.eskerPath ||= {})[a.id] ||= []);
    if (!p.length || p[p.length - 1][0] !== from[0] || p[p.length - 1][1] !== from[1]) p.push([from[0], from[1]]);
    for (const [x, y] of traversed) { const l = p[p.length - 1]; if (!l || l[0] !== x || l[1] !== y) p.push([x, y]); }
    while (p.length > PATH + 1) p.shift();
  }

  function turnStart(s, a, H) {
    if (!is(a)) return;
    const b = a.status?.eskerBurden;
    if (b?.stacks) { b.stacks -= 1; if (!b.stacks) a.status.eskerBurden = null; H.log(s, { kind: "effect", actor: a.id, text: `${a.name} sets some of the weight down (burden ${b.stacks}/${RULES.burden.max}).` }); }
    if (a.status?.eskerBetween && !active(a.status.eskerBetween, a)) a.status.eskerBetween = null;
  }

  const resistKnock = (a) => is(a) && burden(a) >= RULES.burden.max;
  const moveAdd = (a) => (is(a) ? -burden(a) * RULES.burden.movePer : 0);

  function aiValue(s, a, cand, w, H) {
    if (!is(a) || !w) return null;
    const foes = live(s).filter((u) => hostile(s, a, u)), allies = live(s).filter((u) => u.side === a.side && u.id !== a.id);
    if (w.kind === "between") {
      if (wardsOf(s, a).length || !cand.target) return 0;
      const first = H.actorAt(s, cand.target[0], cand.target[1]), other = first && partnerFor(s, a, first, H);
      if (!first || !other) return 0;
      const mine = [first, other].find((u) => u.side === a.side);
      // Worth most when it shelters a hurt ally; naming two foes (a ward is a foe either way) is worth less.
      return mine ? 3.5 + (mine.lf < mine.maxLF * 0.6 ? 2.5 : 0) : 1.5;
    }
    if (w.kind === "shoulder") {
      const ws = wardsOf(s, a); if (!ws.length) return 0;
      const troubled = ws.filter((u) => RULES.debuffs.some((d) => u.status?.[d])).length;
      return troubled ? 3 + troubled : burden(a) >= RULES.burden.max ? 0 : 1.2;
    }
    if (w.kind === "divide") {
      const n = ridgeTiles(s, a, H).length, near = foes.filter((u) => H.dist(s, a.x, a.y, u.x, u.y) <= 4).length;
      return n >= 4 && near && allies.length ? 5 + Math.min(3, near) : n >= 4 && near >= 2 ? 4 : 0;
    }
    return null;
  }

  // AI: Esker and its AI allies never aim at a ward of their own side's Esker while the line holds. Esker striking a
  // ward breaks the line; an ally striking one lands the blow on its own Esker and is marked Oathbreaker. A human
  // player keeps both choices; the AI leaves striking first to the other side, which is what the mark punishes.
  function aiVeto(s, a, cand) {
    if (!a || !["ability", "strike"].includes(cand?.type) || !Array.isArray(cand.target)) return false;
    const u = live(s).find((x) => x.x === cand.target[0] && x.y === cand.target[1]); if (!u || u.side === a.side) return false;
    const g = eskerOfWard(s, u);
    return !!g && g.side === a.side && !g.defeated && active(g.status?.eskerBetween, g) && g.status.eskerBetween.wards.includes(u.id);
  }

  return { RULES, is, target, aiVeto, resolve, exempt, crossed, damageMods, afterHit, moved, turnStart, resistKnock, moveAdd, aiValue, wardsOf, markOf, burden, ridgeTiles };
});
