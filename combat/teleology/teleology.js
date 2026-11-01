"use strict";
// Teleology + Retrocausality (muse, 2026-10-26, orbit prototype): ends declared
// ahead, debts settled behind. Holders pending Mala's call (Children of the Future
// for retrocausality, Posterity for teleology). State is JSON-only. All numbers provisional.
//
// Teleology: Designate Destiny (declare a heading; straight moves cost 5 AP less),
// Borrowed Blow (8 nigredo now; owe 3 ΦF + 25 AP), Nova Sovereign Guarantee (one
// acknowledgment; one-shot ×1.5 dealt / ×1.5 healed / guard-erode servings).
// Retrocausality: What Was Owed (call in min(pool, owed) ΦF), Echo Return (release
// banked tempo −10 tax; holders don't auto-release), Causal Snapback (announced:
// rewind every unit to this round's start position + LF).
// Merge: Novikov Guarantee (announced: allies release banked tax-free, pay ΦF debts
// from pools). Paradox = outstanding owed ΦF, counted capped at round × 4.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTeleology = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const IDS = new Set(["designateDestiny", "borrowedBlow", "novaGuarantee", "whatWasOwed", "echoReturn", "causalSnapback", "novikovGuarantee"]);
  const RULES = {
    moveDiscount: 5, blowPotency: 8, blowPhi: 3, blowTempo: 25, blowRange: 4, novaRange: 6,
    serveMul: 1.5, guardErode: 1.2, echoTax: 10, paradoxCapPerRound: 4,
  };
  const TELE = { designateDestiny: "teleology", borrowedBlow: "teleology", novaGuarantee: "teleology", whatWasOwed: "retrocausality", echoReturn: "retrocausality", causalSnapback: "retrocausality", novikovGuarantee: null };
  const say = (s, H, a, text, why) => H.log(s, { kind: "teleology", actor: a.id, text, ...(why ? { why } : {}) });
  const tele = (u) => (u.teleology || (u.teleology = { heading: null, phiDebt: 0, servings: {} }));
  const pairOf = (a) => (a.embodied && !a.defeated ? [a.embodied.primary, a.embodied.secondary] : [a.primary, a.secondary]);
  const holds = (a, c) => !!a && pairOf(a).includes(c);
  const holdsTele = (a) => holds(a, "teleology");
  const holdsRetro = (a) => holds(a, "retrocausality");
  const servingsFor = (src, tid) => (src && src.teleology && src.teleology.servings && src.teleology.servings[tid]) || null;
  const collectServing = (src, tid, kind) => {
    const k = servingsFor(src, tid); if (!k || !k[kind]) return false;
    delete k[kind]; if (!k.hit && !k.heal && !k.guard) delete src.teleology.servings[tid];
    return true;
  };

  function beforeAbility(s, a, m) {
    const id = m.id || m.ability; if (!IDS.has(id)) return null;
    if (id === "novikovGuarantee") { if (!(holdsTele(a) && holdsRetro(a))) return "The Novikov Guarantee needs Teleology and Retrocausality both equipped."; return null; }
    if (!holds(a, TELE[id])) return `${TELE[id] === "teleology" ? "Teleology" : "Retrocausality"} is not equipped.`;
    if (id === "echoReturn" && !(a.bankedTempo > 0)) return "No banked tempo waits: Stall first, then Echo.";
    if (id === "whatWasOwed" && !(tele(a).phiDebt > 0)) return "No ΦF debts are outstanding: nothing to call in.";
    if (id === "causalSnapback" && !(s.teleologySnap && s.teleologySnap.round === s.round)) return "No round-start to return to.";
    return null;
  }

  function target(s, a, m, tx, ty, H) {
    const id = m.id || m.ability; if (!IDS.has(id)) return null;
    if (id !== "designateDestiny" && id !== "novaGuarantee") return null;   // the wire's generic enemy/self targeting covers the rest
    if (id === "novaGuarantee") {   // allies may acknowledge too: that is what the ×1.5 mending serves
      if (tx == null || !H.inside(s, tx, ty)) return { error: "Choose someone to acknowledge your vision." };
      if (H.dist(s, a.x, a.y, tx, ty) > RULES.novaRange) return { error: `Out of range (${RULES.novaRange}).` };
      const occ = H.actorAt(s, tx, ty);
      if (!occ || occ.defeated || occ.id === a.id) return { error: "Acknowledge one living unit other than yourself." };
      if (!H.hasSight(s, a.x, a.y, tx, ty)) return { error: "No line of sight." };
      return { ok: true, tiles: [[tx, ty]], targets: [occ.id] };
    }
    if (tx == null || !H.inside(s, tx, ty)) return { error: "Point at the step that names your heading." };
    const dx = tx - a.x, dy = ty - a.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return { error: "Designate one cardinal step: the tile beside you names the heading." };
    return { ok: true, tiles: [[tx, ty]], targets: [] };
  }

  function resolve(s, a, inst, H) {
    const id = inst.ability; if (!IDS.has(id)) return false;
    const t = inst.targets?.[0] ? H.actor(s, inst.targets[0]) : null;
    if (id === "designateDestiny") {
      const [tx, ty] = inst.tiles?.[0] || [a.x, a.y];
      const dx = tx - a.x, dy = ty - a.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) { say(s, H, a, `${a.name} points nowhere: the heading needs one cardinal step.`); return true; }
      const st = tele(a); st.heading = [dx, dy];
      a.status = a.status || {}; a.status.moveMods = (a.status.moveMods || []).filter((mm) => mm.id !== "destiny");
      a.status.moveMods.push({ id: "destiny", kind: "discount", amount: RULES.moveDiscount, if: { heading: [dx, dy] }, label: "Designate Destiny" });
      const name = dx === 1 ? "east" : dx === -1 ? "west" : dy === 1 ? "south" : "north";
      say(s, H, a, `${a.name} designates ${name}: straight ${name}ward moves cost ${RULES.moveDiscount} AP less.`, ["Only moves made entirely of that step earn it."]);
      return true;
    }
    if (id === "borrowedBlow") {
      if (!t || t.defeated) { say(s, H, a, `${a.name}'s borrowed blow finds no one.`); return true; }
      tele(a).phiDebt += RULES.blowPhi; a.tempoDebt = (a.tempoDebt || 0) + RULES.blowTempo;
      say(s, H, a, `${a.name} borrows the blow: +${RULES.blowPhi} ΦF and +${RULES.blowTempo} AP owed.`, ["The price comes due next turn."]);
      H.hit(s, a, t, { ...inst, damageType: "nigredo" }, inst.potency * (inst.mult || 1), ["A strike from tomorrow's ledger."], { label: "Borrowed Blow" });
      return true;
    }
    if (id === "novaGuarantee") {
      if (!t || t.defeated) { say(s, H, a, `${a.name}'s guarantee finds no one to acknowledge it.`); return true; }
      tele(a).servings[t.id] = { hit: true, heal: true, guard: true };
      say(s, H, a, `${t.name} acknowledges ${a.name}'s vision: one ×${RULES.serveMul} blow, one ×${RULES.serveMul} mending, one slipped guard, each spent in the serving.`);
      return true;
    }
    if (id === "whatWasOwed") {
      const st = tele(a), gain = Math.min(a.pf, st.phiDebt);
      a.pf = Math.min(a.maxPF, a.pf + gain);
      say(s, H, a, `${a.name} calls in what was owed: +${gain} ΦF (the lower of pool and debt).`, gain <= 0 ? ["An empty pool calls in nothing."] : undefined);
      return true;
    }
    if (id === "echoReturn") {
      const banked = a.bankedTempo || 0, tax = Math.min(RULES.echoTax, banked);
      a.tempo += banked - tax; a.bankedTempo = 0;
      say(s, H, a, `${a.name}'s stored turn arrives ahead of schedule: +${banked - tax} AP (−${tax} tax).`);
      return true;
    }
    if (id === "causalSnapback") {
      const snap = s.teleologySnap;
      if (!snap || snap.round !== s.round) { say(s, H, a, `${a.name} reaches back and finds no round to hold.`); return true; }
      const restored = [], rose = [], stayed = [];
      for (const [uid, rec] of Object.entries(snap.units)) {
        const u = s.actors[uid]; if (!u || !rec.arrived) continue;
        u.lf = Math.min(u.maxLF, rec.lf);
        if (u.defeated && !rec.defeated) { u.defeated = false; rose.push(u.name); }
        if (u.x !== rec.x || u.y !== rec.y) {
          const occ = H.actorAt(s, rec.x, rec.y);
          if (!occ || occ.id === u.id) { u.x = rec.x; u.y = rec.y; restored.push(u.name); }
          else stayed.push(u.name);
        }
      }
      say(s, H, a, `${a.name} sets the battle back to round ${snap.round}: ${restored.length} moved, ${rose.length ? `${rose.join(", ")} rise` : "none rise"}${stayed.length ? `, ${stayed.join(", ")} hold${stayed.length > 1 ? "" : "s"} (occupied)` : ""}.`,
        ["Positions and life rewind; statuses, fields, and objects stand."]);
      return true;
    }
    if (id === "novikovGuarantee") {
      const done = [];
      for (const u of Object.values(s.actors)) {
        if (u.side !== a.side || u.defeated) continue;
        const parts = [];
        if ((u.bankedTempo || 0) > 0) { parts.push(`+${u.bankedTempo} banked AP tax-free`); u.tempo += u.bankedTempo; u.bankedTempo = 0; }
        const st = tele(u), pay = Math.min(u.pf, st.phiDebt);
        if (pay > 0) { u.pf -= pay; st.phiDebt -= pay; parts.push(`pays ${pay} ΦF of debt${st.phiDebt ? ` (${st.phiDebt} still owed)` : ""}`); }
        else if (st.phiDebt > 0) parts.push(`${st.phiDebt} ΦF still owed (empty pool)`);
        if (parts.length) done.push(`${u.name} ${parts.join("; ")}`);
      }
      say(s, H, a, `${a.name} closes both books: ${done.length ? done.join(". ") + "." : "no banks, no debts."}`, ["The merge reconciles; it never wipes."]);
      return true;
    }
    return false;
  }

  // ── servings: one-shot multipliers, collected when they apply ──
  function servingHit(s, src, tgt) {
    if (!src || !tgt || !collectServing(src, tgt.id, "hit")) return null;
    return { mult: RULES.serveMul, note: `${tgt.name} serves ${src.name}'s vision: ×${RULES.serveMul}.` };
  }
  function servingHeal(s, healer, target) {
    if (!healer || !target || !collectServing(healer, target.id, "heal")) return null;
    return { mult: RULES.serveMul, note: `${target.name} serves ${healer.name}'s vision: the mending lands ×${RULES.serveMul}.` };
  }
  function guardErode(s, src, tgt, guardMult) {
    if (!src || !tgt || !collectServing(src, tgt.id, "guard")) return null;
    const mult = Math.min(1, guardMult * RULES.guardErode);
    return { mult, note: `${tgt.name}'s guard slips against ${src.name}'s vision: ×${guardMult} → ×${Math.round(mult * 100) / 100}.` };
  }

  // ── paradox: outstanding owed ΦF, counted capped at round × 4 ──
  function paradox(s, a) {
    const owed = (a.teleology && a.teleology.phiDebt) || 0;
    return { owed, counted: Math.min(owed, s.round * RULES.paradoxCapPerRound) };
  }

  // Turn start, after ΦF regenerates: debts are paid from the pool, then paradox counts.
  function turnStart(s, a, H) {
    if (a.defeated) return;
    const st = tele(a);
    if (st.phiDebt > 0) {
      const pay = Math.min(a.pf, st.phiDebt);
      a.pf -= pay; st.phiDebt -= pay;
      say(s, H, a, `${a.name} pays ${pay} ΦF of debt${st.phiDebt ? ` (${st.phiDebt} still owed)` : ", clear"}.`);
    }
    const p = paradox(s, a);
    if (p.owed > 0) say(s, H, a, `${a.name}'s paradox: ${p.counted} counted${p.owed > p.counted ? ` (${p.owed - p.counted} above the round-${s.round} cap, uncounted not lost)` : ""}.`);
  }

  // Round start: remember where everyone stood and how everyone bled.
  function snapshot(s) {
    if (!Object.values(s.actors).some((u) => holdsTele(u) || holdsRetro(u))) return;   // inert without a holder (Integrator review)
    const units = {};
    for (const [uid, u] of Object.entries(s.actors)) units[uid] = { x: u.x, y: u.y, lf: u.lf, defeated: !!u.defeated, arrived: !u.notArrived };
    s.teleologySnap = { round: s.round, units };
  }

  function aiValue(s, a, cand, H) {
    const id = cand.ability; if (!IDS.has(id)) return null;
    const foes = Object.values(s.actors).filter((u) => !u.defeated && u.side !== a.side);
    if (id === "designateDestiny") return foes.length ? 1.5 : 0;   // cheap setup; the walk pays it back
    if (id === "borrowedBlow") {
      const t = cand.target && H.actorAt(s, cand.target[0], cand.target[1]);
      if (!t || t.side === a.side || t.defeated) return 0;
      return RULES.blowPotency * (t.lf <= RULES.blowPotency ? 2 : 1) - 4;   // damage scale, minus the debt's sting
    }
    if (id === "novaGuarantee") {
      const t = cand.target && H.actorAt(s, cand.target[0], cand.target[1]);
      if (!t || t.defeated || t.id === a.id || servingsFor(a, t.id)) return 0;
      if (t.side !== a.side) return 4 + Math.min(6, t.maxLF / 20);   // worth more on bigger targets
      return t.lf < t.maxLF ? 2 + (t.maxLF - t.lf) / 20 : 0;   // acknowledged allies mend ×1.5
    }
    if (id === "whatWasOwed") { const st = tele(a); return st.phiDebt > 0 ? Math.min(a.pf, st.phiDebt) * 0.8 : 0; }
    if (id === "echoReturn") { const banked = a.bankedTempo || 0; return banked > RULES.echoTax ? (banked - RULES.echoTax) * 0.15 : 0; }
    if (id === "causalSnapback") {
      const snap = s.teleologySnap; if (!snap || snap.round !== s.round) return 0;
      let v = 0;
      for (const [uid, rec] of Object.entries(snap.units)) {
        const u = s.actors[uid]; if (!u || u.side !== a.side) continue;
        if (u.defeated && !rec.defeated) v += 30;
        else if (!u.defeated) v += Math.max(0, rec.lf - u.lf) * 0.3;
      }
      return v >= 8 ? v : 0;
    }
    if (id === "novikovGuarantee") {
      let v = 0;
      for (const u of Object.values(s.actors)) {
        if (u.side !== a.side || u.defeated) continue;
        v += (u.bankedTempo || 0) * 0.1 + Math.min(u.pf, (u.teleology && u.teleology.phiDebt) || 0) * 0.5;
      }
      return v >= 6 ? v : 0;
    }
    return 0;
  }

  return { IDS, RULES, holdsTele, holdsRetro, tele, paradox, snapshot, turnStart, beforeAbility, target, resolve, servingHit, servingHeal, guardErode, aiValue };
});
