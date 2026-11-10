"use strict";
// The Hot Pot Berserker (Antifragility + Hospitality; Mala, 2026-10-25: "Hot Pot Berserker should drop ingredients when hit,
// and give Mapo Tofu dishes to his allies in combat"; docs/hot-pot-berserker.md). A walking pot: every blow that lands
// sloshes an ingredient out onto the ground (anyone can grab it), strain he chooses to take makes him hit harder, and he
// feeds his side. At the last he boils over: the beating he banked scalds the foes beside him and feeds the friends.
//
// State: a.status.hpBank = { n } (Antifragility, max RULES.bank.max); a.status.smallDoses = { until, seen: [channels] };
// s.hotPot[a.id] = { spilled, roundSpills, round, servedTurn }. Hooks are called from classes/class-runtime.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatHotPot = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = {
    spill: { perRound: 2, perBattle: 6, items: ["tofu", "chiliPepper", "bokChoy", "beefSlices", "shiitake", "veganShrimp", "napaCabbage", "noodles"] },   // + the totem T2 three (spec D5)
    bank: { max: 3, strikeAdd: 2 },
    hormesis: { heal: 4 },
    serve: { range: 2, dish: "mapoTofu" },
    family: { radius: 1, heal: 5 },
    boil: { radius: 2, base: 4, perBank: 3, healBase: 3, healPerBank: 3, spills: 3 },
  };
  const IDS = ["smallDoses", "hormesis", "serveMapoTofu", "familyStyle", "boilOver"];
  const is = (a) => !!a && (a.character === "hot_pot_berserker" || (a.primary === "antifragility" && a.secondary === "hospitality"));
  const st = (u) => (u.status ||= {});
  const live = (s) => Object.values(s.actors || {}).filter((u) => u && !u.defeated && !u.notArrived && !u.escaped);
  const bank = (a) => a?.status?.hpBank?.n || 0;
  const book = (s, a) => ((s.hotPot ||= {})[a.id] ||= { spilled: 0, roundSpills: 0, round: -1, servedTurn: -1 });   // writes: only from resolve and afterHit
  const peek = (s, a) => s.hotPot?.[a.id] || { spilled: 0, roundSpills: 0, round: -1, servedTurn: -1 };   // reads: targeting and AI stay pure
  const near = (s, a, u, r) => Math.max(Math.abs(u.x - a.x), Math.abs(u.y - a.y)) <= r;
  function addBank(s, a, k, why, H) {
    const before = bank(a), n = Math.min(RULES.bank.max, before + k); if (n === before) return 0;
    st(a).hpBank = { n };
    H.log(s, { kind: "effect", actor: a.id, text: `${a.name} banks Antifragility (${n}/${RULES.bank.max}): Strikes +${n * RULES.bank.strikeAdd}.`, why: [why] });
    return n - before;
  }
  // An ingredient sloshes out onto an open tile beside him: a pickup anyone can step on. force: the ultimate's spills skip
  // the per-round cap (the battle cap still holds).
  function spill(s, a, H, force = false) {
    const b = book(s, a); if (b.round !== s.round) { b.round = s.round; b.roundSpills = 0; }
    if (b.spilled >= RULES.spill.perBattle || (!force && b.roundSpills >= RULES.spill.perRound)) return null;
    const taken = new Set((s.arena.pickups || []).map((p) => `${p.x},${p.y}`));
    const open = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [a.x + dx, a.y + dy])
      .filter(([x, y]) => H.inside(s, x, y) && !H.actorAt(s, x, y) && !H.tileAt(s, x, y).blocksMove && !H.barrierAt(s, x, y) && !taken.has(`${x},${y}`));
    if (!open.length) return null;
    const [x, y] = open[(b.spilled + (s.seed || 0)) % open.length], item = RULES.spill.items[b.spilled % RULES.spill.items.length];
    const name = H.accountItems?.consumables?.[item]?.name || item;
    (s.arena.pickups ||= []).push({ id: `k${++s.seq}`, item, name, x, y });
    b.spilled++; b.roundSpills++;
    H.log(s, { kind: "spill", actor: a.id, tiles: [[x, y]], item, text: `${name} sloshes out of ${a.name}'s pot onto (${x},${y}).`, why: [`Spilled Pot: anyone can pick it up (${b.spilled}/${RULES.spill.perBattle} this battle).`] });
    return item;
  }
  function afterHit(s, src, tgt, inst, dealt, H) {
    if (!is(tgt) || tgt.defeated || !(dealt > 0) || s.rules?.hotPot === false) return;
    spill(s, tgt, H);
    const d = tgt.status?.smallDoses, ch = inst?.damageType || inst?.channel || H.conceptChannel?.(inst?.concept) || "strike";
    if (d && d.until >= tgt.ownerTurns && !d.seen.includes(ch)) { d.seen.push(ch); addBank(s, tgt, 1, `Small Doses: a new kind of harm (${ch}) teaches the pot.`, H); }
  }
  function beforeStrike(s, src, tgt, inst, potency) {
    if (!is(src) || inst?.ability !== "strike" || !bank(src)) return null;
    const add = bank(src) * RULES.bank.strikeAdd;
    return { potency: potency + add, why: [`Antifragility: +${add} potency (${bank(src)} banked).`] };
  }
  function target(s, a, w, tx, ty, H) {
    if (!IDS.includes(w.kind)) return null;
    const fail = (error) => ({ ok: false, error }), self = { ok: true, tiles: [[a.x, a.y]], targets: [a.id], self: true };
    if (w.kind === "serveMapoTofu") {
      const u = H.actorAt(s, tx, ty);
      if (!u || u.id === a.id || u.side !== a.side || u.defeated) return fail("Serve an ally.");
      if (!near(s, a, u, RULES.serve.range)) return fail(`Within ${RULES.serve.range} tiles.`);
      if ((u.inventory || []).length >= (u.inventoryCapacity || 0)) return fail(`${u.name}'s hands are full.`);
      if (peek(s, a).servedTurn === a.ownerTurns) return fail("One dish a turn: the next is still cooking.");
      return { ok: true, tiles: [[tx, ty]], targets: [u.id] };
    }
    if (tx !== a.x || ty !== a.y) return fail("Target yourself.");
    if (w.kind === "smallDoses" && a.status?.smallDoses?.until >= a.ownerTurns + 1) return fail("Small Doses is already open.");
    if (w.kind === "hormesis" && bank(a) >= RULES.bank.max && a.lf >= a.maxLF) return fail("The pot is full and so are you.");
    if (w.kind === "familyStyle" && !live(s).some((u) => u.side === a.side && near(s, a, u, RULES.family.radius) && u.lf < u.maxLF)) return fail("Nobody at the table is hungry.");
    return self;
  }
  function heal(s, a, u, n, why, H) {
    const k = Math.min(n, u.maxLF - u.lf); if (k <= 0) return 0; u.lf += k;
    H.log(s, { kind: "heal", actor: a.id, target: u.id, amount: k, text: `${u.name} eats: +${k} LF.`, why: [why] }); return k;
  }
  function resolve(s, a, inst, w, H) {
    if (!w || !IDS.includes(w.kind)) return false;
    const say = (text, why = []) => H.log(s, { kind: "effect", actor: a.id, text, why });
    if (w.kind === "smallDoses") { st(a).smallDoses = { until: a.ownerTurns + 1, seen: [] }; say(`${a.name} takes it in small doses: until the next turn, each new kind of harm banks Antifragility.`, ["Identical repeat hits teach nothing."]); return true; }
    if (w.kind === "hormesis") { addBank(s, a, 1, "Hormesis: a chosen dose of strain.", H); heal(s, a, a, RULES.hormesis.heal, "Hormesis: the strain that doesn't break you mends you.", H); return true; }
    if (w.kind === "serveMapoTofu") {
      const u = H.actor(s, inst.targets?.[0]); if (!u) return true;
      u.inventory = [...(u.inventory || []), RULES.serve.dish]; book(s, a).servedTurn = a.ownerTurns;
      say(`${a.name} serves ${u.name} a bowl of Mapo tofu.`, [`It goes in ${u.name}'s pack: eat it for 14 LF and 6 ΦF (a dish, 30 AP).`]);
      return true;
    }
    if (w.kind === "familyStyle") { for (const u of live(s).filter((u) => u.side === a.side && near(s, a, u, RULES.family.radius))) heal(s, a, u, RULES.family.heal, "Family style: everyone at the table eats.", H); return true; }
    if (w.kind === "boilOver") {
      const n = bank(a), R = RULES.boil;
      for (const u of live(s).filter((u) => near(s, a, u, R.radius) && u.id !== a.id)) {
        if (u.side === a.side) heal(s, a, u, R.healBase + R.healPerBank * n, `Boil Over: ${n} banked × ${R.healPerBank} + ${R.healBase}.`, H);
        else H.hit(s, a, u, { ...inst, damageType: "citrinitas" }, R.base + R.perBank * n, [`Boil Over: ${R.base} + ${R.perBank} × ${n} banked, scalding broth.`]);
      }
      heal(s, a, a, R.healBase, "Boil Over: the cook eats last.", H);
      for (let i = 0; i < R.spills; i++) spill(s, a, H, true);
      st(a).hpBank = null;
      say(`${a.name} boils over: the bank empties into the pot.`);
      return true;
    }
    return false;
  }
  // AI values. Serve the most hurt ally with room; dose up when foes are near; boil over with a bank and someone in reach.
  function aiValue(s, a, cand, w, H) {
    if (!w || !IDS.includes(w.kind) || !is(a)) return null;
    const foesNear = live(s).filter((u) => u.side !== a.side && u.side !== "bystander" && H.dist(s, a.x, a.y, u.x, u.y) <= 3).length;
    if (w.kind === "serveMapoTofu") { const u = cand.target && H.actorAt(s, cand.target[0], cand.target[1]); return u ? 4 + Math.round(10 * (1 - u.lf / u.maxLF)) : 0; }
    if (w.kind === "smallDoses") return foesNear && bank(a) < RULES.bank.max ? 3 + foesNear : 0;
    if (w.kind === "hormesis") return bank(a) < RULES.bank.max ? 4 + Math.min(4, a.maxLF - a.lf) : 0;
    if (w.kind === "familyStyle") return live(s).filter((u) => u.side === a.side && near(s, a, u, RULES.family.radius)).reduce((v, u) => v + Math.min(RULES.family.heal, u.maxLF - u.lf), 0);
    if (w.kind === "boilOver") { const foes = live(s).filter((u) => u.side !== a.side && near(s, a, u, RULES.boil.radius)).length; return foes && bank(a) >= 2 ? 10 + foes * (RULES.boil.base + RULES.boil.perBank * bank(a)) : 0; }
    return 0;
  }
  return { RULES, IDS, is, bank, spill, afterHit, beforeStrike, target, resolve, aiValue };
});
