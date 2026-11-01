"use strict";
// Houses (Mala, 2026-10-15; docs/houses.md; Muse-2's spec ~/loci-orbit/muse/houses/SPEC.md). Numbers: content.js
// rules.houses. A part of the Concept Combat engine: engine.js installs it with the host object H; everything else in
// the engine is read as H.x at call time.
//
//   spawnHouse(s)                 → at battle start: one seeded roll against the arena's chance; the house on the open
//                                   tile nearest the center
//   house(s)                      → the standing house object, or null
//   houseAction(s, a, act, kind)  → "buy" | "invest" (adjacent); an error string or undefined
//   A house is a marketplace (Mala, 2026-10-15): buy it, out-invest the other side (the side with the larger stake is
//   the majority stakeholder and is paid), or destroy it (every stake is lost) and go back to the ordinary fight.
//   houseRound(s)                 → round start: the dividend to the owner's units beside it (rubble never rebuilds itself)
//   houseFell(s, source, ev)      → destroyed: every stake is lost; rubble for the rest of the battle
//   houseRebuild(s)               → an ability raises a fresh unowned house on the rubble (the only way back)
//   houseOptions(s, a)            → the house actions this unit could take now (AI candidates and the UI menu)
//   houseValue(s, a, cand)        → the AI's score for a house action; houseSite(s, a, to) for where it ends a move
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).houses = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const R = (s) => s.rules?.houses || null;
    const house = (s) => (s.arena.objects || []).find((o) => o.type === "house" && (o.hp ?? 0) > 0 && !o.destroyed) || null;
    const beside = (s, o, u) => !!o && !!u && !u.defeated && Math.max(Math.abs(u.x - o.x), Math.abs(u.y - o.y)) === 1;
    const FIGHTING = ["player", "enemy"];
    // A copy of the house on the battle: when it breaks, the object is gone before houseFell runs.
    const keep = (s, o) => { s.houseCopy = { x: o.x, y: o.y, sprite: o.sprite, house: { ...o.house } }; };

    function spawnHouse(s) {
      const r = R(s); if (!r || s.vignette || s.bossRush || !s.arena?.map) return null;
      // The game's arenas roll (named in the table, or the default; generated maps too); a staged arena (a test, a sim bench) has no house
      // unless it sets its own `houseChance`.
      const key = s.arena.id || Object.keys(r.chance).find((k) => k.toLowerCase() === String(s.arena.name || "").replace(/\s+/g, "").toLowerCase());
      const chance = s.arena.houseChance ?? (key || s.arena.generated ? r.chance[key] ?? r.chance.default ?? 0 : 0);   // generated maps roll the default
      if (!(H.seededChance(`${s.seed}:house`) < chance)) return null;
      const spawns = Object.values(s.arena.spawns || {}).flat().map((p) => H.key(p[0], p[1]));
      const cx = (s.arena.w - 1) / 2, cy = (s.arena.h - 1) / 2;
      const open = [];
      for (let y = 1; y < s.arena.h - 1; y++) for (let x = 1; x < s.arena.w - 1; x++) {
        if (H.tileAt(s, x, y).blocksMove || H.waterAt?.(s, x, y) || H.actorAt(s, x, y) || spawns.includes(H.key(x, y))) continue;
        if ((s.arena.objects || []).some((o) => o.x === x && o.y === y)) continue;
        // something has to be able to stand beside it
        if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !H.tileAt(s, x + dx, y + dy).blocksMove)) continue;
        open.push([x, y]);
      }
      open.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy) || p[1] - q[1] || p[0] - q[0]);
      if (!open.length) return null;
      const [x, y] = open[0], sprite = r.sprites[Math.floor(H.seededChance(`${s.seed}:house-sprite`) * r.sprites.length)];
      const o = { id: "house", type: "house", name: "House", tags: ["structure"], sprite, x, y, hp: r.hp, maxHp: r.hp, cover: r.cover, blocksMove: true, moveCost: 0,
        material: "wood", status: {}, house: { side: null, stakes: { player: 0, enemy: 0 }, since: null } };
      s.arena.objects.push(o); keep(s, o);
      H.log(s, { kind: "house", tiles: [[x, y]], text: `A house stands near the center at (${x},${y}). Stand beside it to buy it (${r.price} AP).`,
        why: ["Owned, it pays action points every round to its side's units standing beside it. Invest more to raise the payout.", "The other side can out-invest you (the larger stake owns it) or break it (every stake is lost)."] });
      return o;
    }

    // Dividend: generated, not drawn from any stake. base + growth for each round held (capped) + one per bankPer of the owner's stake.
    function dividend(s, o) {
      const r = R(s), d = r.dividend, held = Math.max(0, s.round - (o.house.since ?? s.round));
      return Math.min(d.cap, d.base + d.growth * Math.min(d.growthTurns, held) + Math.floor((o.house.stakes[o.house.side] || 0) / d.bankPer));
    }

    function houseAction(s, a, act, kind) { const r = houseActionRaw(s, a, act, kind); const o = house(s); if (o) keep(s, o); return r; }
    function houseActionRaw(s, a, act, kind) {
      const r = R(s), o = house(s);
      if (!r || !o) return "There is no house standing.";
      if (!beside(s, o, a)) return "Stand beside the house.";
      if (!FIGHTING.includes(a.side)) return "Only the two sides can own a house.";
      const h = o.house;
      const st = h.stakes, other = a.side === "player" ? "enemy" : "player";
      if (kind === "buy") {
        if (h.side) return h.side === a.side ? "Your side already owns this house." : "The other side owns it: out-invest them or break it.";
        const spend = H.spendTempo(s, a, r.price, "Buy the house"); if (spend) return spend;
        h.side = a.side; h.since = s.round; st[a.side] = r.price; o.owner = a.id;
        H.log(s, { kind: "house", actor: a.id, tiles: [[o.x, o.y]], text: `${a.name} buys the house for the ${a.side === "player" ? "player's" : "enemy's"} side (stake ${r.price}).`,
          why: [`From next round it pays ${dividend(s, o)} AP, rising each round it is held, to the side's units standing beside it.`, "The other side takes it by putting in more than you have."] });
        return;
      }
      if (kind === "invest") {
        if (!h.side) return `Nobody owns it yet: buy it (${r.price} AP).`;
        const room = r.stakeCap - st[a.side], amount = Math.min(room, Math.max(0, Math.floor(act.amount ?? a.tempo)));
        if (amount <= 0) return room <= 0 ? `Your side's stake is at the cap (${r.stakeCap}).` : "Nothing to invest.";
        const spend = H.spendTempo(s, a, amount, "Invest in the house"); if (spend) return spend;
        st[a.side] += amount;
        const flips = h.side !== a.side && st[a.side] > st[other];
        if (flips) { h.side = a.side; h.since = s.round; o.owner = a.id; }
        H.log(s, { kind: "house", actor: a.id, tiles: [[o.x, o.y]], text: flips
            ? `${a.name} invests ${amount} AP: the ${a.side === "player" ? "player's" : "enemy's"} side is now the majority stakeholder (${st[a.side]} to ${st[other]}). The payout is theirs.`
            : `${a.name} invests ${amount} AP in the house (stakes ${st[a.side]} to ${st[other]}).`,
          why: [`The larger stake owns the house and its payout; every ${r.dividend.bankPer} of the owner's stake adds 1 to it. Breaking the house loses every stake.`] });
        return;
      }
      return "Unknown house action.";
    }

    // Ability-triggered rebuild (Mala, 2026-10-19: rubble never comes back on its
    // own). Needs rubble, no standing house, and a free tile. Returns the fresh
    // unowned house, or null when there is nothing to raise.
    function houseRebuild(s) {
      const r = R(s), rub = s.houseRubble; if (!r || !rub || house(s) || H.actorAt(s, rub.x, rub.y)) return null;
      const o = (s.arena.objects || []).find((q) => q.id === "house");
      const fresh = { id: "house", type: "house", name: "House", tags: ["structure"], sprite: rub.sprite, x: rub.x, y: rub.y, hp: r.hp, maxHp: r.hp, cover: r.cover, blocksMove: true, moveCost: 0,
        material: "wood", status: {}, house: { side: null, stakes: { player: 0, enemy: 0 }, since: null } };
      s.arena.objects = (s.arena.objects || []).filter((q) => q !== o); s.arena.objects.push(fresh); s.houseRubble = null; keep(s, fresh);
      H.log(s, { kind: "house", tiles: [[rub.x, rub.y]], text: "The house is rebuilt on the rubble. Nobody owns it." });
      return fresh;
    }

    function houseRound(s) {
      const r = R(s); if (!r) return;
      const o = house(s); if (!o?.house.side || o.house.since >= s.round) return;
      const takers = Object.values(s.actors).filter((u) => u.side === o.house.side && beside(s, o, u) && !u.notArrived && !u.summon && !u.communed && !u.beast);
      if (!takers.length) return;
      const pay = dividend(s, o), each = Math.floor(pay / takers.length), cap = s.rules.maxBankedActionPoints ?? 100;
      for (const u of takers) u.bankedTempo = Math.min(cap, (u.bankedTempo || 0) + each);
      keep(s, o);
      H.log(s, { kind: "house", tiles: [[o.x, o.y]], text: `The house pays ${pay} AP: ${each} each to ${takers.map((u) => u.name).join(", ")}.`, why: ["Paid at round start to the owning side's units standing beside it, on top of their next turn."] });
    }

    // The object is already off the map when this runs (the destroyed event fires after removal), so the house's
    // place, sprite and bank come from the copy kept on the battle (s.houseCopy, refreshed by keep() after every change).
    function houseFell(s, source, ev) {
      const r = R(s), o = (s.arena.objects || []).find((q) => q.id === "house" && (q.hp ?? 0) > 0) ? null : s.houseCopy; if (!r || !o) return;
      const lost = (o.house?.stakes?.player || 0) + (o.house?.stakes?.enemy || 0);
      s.houseRubble = { x: o.x, y: o.y, sprite: o.sprite };
      s.houseCopy = { ...o, house: { side: null, stakes: { player: 0, enemy: 0 }, since: null } };
      H.log(s, { kind: "house", actor: source?.id, tiles: [[o.x, o.y]], text: `The house falls.${lost ? ` ${lost} invested AP are lost with it.` : ""}`,
        why: [`Rubble for the rest of the battle. Only an ability can raise a house on it.`] });
    }

    // ── Property rights (Mala, 2026-10-25: "buying a house gives you property rights, if your house is damaged you can open a
    // case for restitution"). When a unit of the other side damages an owned house, the owners hold a claim against it. Any unit
    // of the owning side may sue, from anywhere, for the filing cost. The truth engine's rule decides it (law/law.js truth):
    // a claim is proven only if someone on the owners' side saw the damage done (within 5, with sight); unproven claims are
    // dismissed. Proven: restitution is the damage done, with no cap (Mala, 2026-10-25: "an average normal amount, but it can
    // be theoretically infinite leaving you in great debt"). A house hit or two is a normal 15-40; a unit that keeps smashing
    // owes it all. The house is repaired by what it lost (if it still stands and is still theirs); the defendant owes the
    // award as restitution debt and pays RESTITUTION.installment of each turn's action points until it is paid, so a big debt
    // cripples without benching. Each claim is decided once. Nothing here can loop: a claim needs fresh damage, a suit spends
    // it, and paying debt never makes new claims.
    const RESTITUTION = { witnessRange: 5, claimsCap: 12, installment: 0.5 };
    const claimsOf = (s) => (s.propertyClaims ||= []);   // writes
    const claimsSeen = (s) => s.propertyClaims || [];    // reads (AI options and values stay pure)
    function houseHarmed(s, source, ev) {
      const o = (s.arena.objects || []).find((q) => q.id === ev.id) || (ev.id === "house" ? s.houseCopy : null); if (!o?.house?.side || !source || !(ev.amount > 0)) return;
      const owners = o.house.side; if (!FIGHTING.includes(source.side) || source.side === owners) return;
      const seen = Object.values(s.actors).some((u) => u.side === owners && !u.defeated && !u.notArrived && u.id !== source.id
        && Math.max(Math.abs(u.x - source.x), Math.abs(u.y - source.y)) <= RESTITUTION.witnessRange && (!H.hasSight || H.hasSight(s, u.x, u.y, source.x, source.y)));
      const list = claimsOf(s); let c = list.find((q) => q.status === "open" && q.side === owners && q.defendant === source.id);
      if (!c) { if (list.length >= RESTITUTION.claimsCap) return; c = { id: `claim${list.length + 1}`, side: owners, defendant: source.id, name: source.name, amount: 0, round: s.round, grade: "unproven", status: "open" }; list.push(c); }
      c.amount += ev.amount; if (seen) c.grade = "witnessed";
      H.log(s, { kind: "law", actor: source.id, tiles: [[o.x, o.y]], text: `${source.name} damages property: the ${owners === "player" ? "player's" : "enemy's"} side may sue for restitution (${c.amount} owed, ${c.grade}).`,
        why: ["Owning a house gives property rights.", c.grade === "witnessed" ? "Someone on the owners' side saw it: the claim can be proven." : "Nobody on the owners' side saw it (within 5, with sight): a suit would be dismissed."] });
    }
    function sue(s, a, act) {
      if (!FIGHTING.includes(a.side)) return "Only the two sides hold property.";
      const open = claimsOf(s).filter((c) => c.status === "open" && c.side === a.side);
      const c = act.claim ? open.find((q) => q.id === act.claim) : open.sort((x, y) => y.amount - x.amount)[0];
      if (!c) return "Your side has no open claim.";
      const cost = s.rules.actionCosts.utility ?? 20, spend = H.spendTempo(s, a, cost, "Sue for restitution"); if (spend) return spend;
      if (c.grade !== "witnessed") {
        c.status = "dismissed";
        H.log(s, { kind: "law", actor: a.id, target: c.defendant, text: `${a.name} sues ${c.name} for restitution. Dismissed: no witness.`, why: ["Nobody on your side saw the damage done; an unproven claim cannot stand."] });
        return;
      }
      const owed = c.amount, o = house(s), def = s.actors[c.defendant];
      c.status = "won"; c.award = owed;
      const repaired = o && o.house.side === a.side ? Math.min(owed, o.maxHp - o.hp) : 0; if (repaired) { o.hp += repaired; keep(s, o); }
      if (def && !def.defeated) def.restitutionDebt = (def.restitutionDebt || 0) + owed;
      H.log(s, { kind: "law", actor: a.id, target: c.defendant, text: `${a.name} wins restitution from ${c.name}: ${owed} owed.${repaired ? ` The house is repaired by ${repaired}.` : ""}${def && !def.defeated ? ` ${c.name} now owes ${def.restitutionDebt} AP in restitution debt.` : ""}`,
        why: [`Witnessed property damage: restitution is the ${c.amount} damage done, uncapped.`, `The debtor pays ${Math.round(RESTITUTION.installment * 100)}% of each turn's action points until it is paid.`] });
    }
    // Turn start (engine/turns.js): a restitution debtor pays its installment out of this turn's action points.
    function restitutionDue(s, a) {
      if (!(a.restitutionDebt > 0) || !(a.tempo > 0)) return;
      const paid = Math.min(a.restitutionDebt, Math.ceil(a.tempo * RESTITUTION.installment));
      a.tempo -= paid; a.restitutionDebt -= paid;
      H.log(s, { kind: "law", actor: a.id, text: `${a.name} pays ${paid} AP of restitution${a.restitutionDebt ? ` (${a.restitutionDebt} still owed)` : ": the debt is paid"}.` });
    }
    function claimOptions(s, a) {
      if (!FIGHTING.includes(a.side) || a.summon || a.communed || a.beast || a.tempo < (s.rules.actionCosts.utility ?? 20)) return [];
      return claimsSeen(s).filter((c) => c.status === "open" && c.side === a.side).map((c) => ({ type: "sueForRestitution", actor: a.id, claim: c.id }));
    }

    // The amount that takes the majority from the other side, if this unit can afford it within the cap; else null.
    function takeover(s, a, o) {
      const r = R(s), st = o.house.stakes, need = st[o.house.side] - st[a.side] + 1;
      return o.house.side && o.house.side !== a.side && need > 0 && need <= a.tempo && st[a.side] + need <= r.stakeCap ? need : null;
    }
    function houseOptions(s, a) {
      const claims = claimOptions(s, a);
      const r = R(s), o = house(s); if (!r || !o || !beside(s, o, a) || !FIGHTING.includes(a.side) || a.summon || a.communed || a.beast) return claims;
      const h = o.house, out = [];
      if (!h.side && a.tempo >= r.price) out.push({ type: "buyHouse", actor: a.id });
      if (h.side === a.side && a.tempo > 0 && h.stakes[a.side] < r.stakeCap) out.push({ type: "investHouse", actor: a.id, amount: a.tempo });
      const need = h.side ? takeover(s, a, o) : null;
      if (need) out.push({ type: "investHouse", actor: a.id, amount: need });
      return [...out, ...claims];
    }

    // AI value, in the same units as damage: action points at ai.apValue each.
    const horizonPay = (s, o, from) => { const d = R(s).dividend; let sum = 0; for (let t = 0; t < R(s).ai.horizon; t++) sum += Math.min(d.cap, from + d.growth * t); return sum; };
    function houseValue(s, a, cand) {
      if (cand.type === "sueForRestitution") { const c = claimsSeen(s).find((q) => q.id === cand.claim); return c?.grade === "witnessed" ? c.amount * 0.6 : 0; }
      const r = R(s), o = house(s); if (!r || !o) return 0;
      const v = r.ai.apValue, h = o.house, d = r.dividend;
      if (cand.type === "buyHouse") return (horizonPay(s, o, d.base + d.growth) - r.price) * v + r.ai.site;
      if (cand.type === "investHouse" && h.side === a.side) {
        // Defend the majority: topping up matters when the other side is close behind; otherwise only surplus, scored low.
        const gap = h.stakes[a.side] - h.stakes[a.side === "player" ? "enemy" : "player"];
        return gap < 30 ? 3 : a.tempo < 20 ? 0.5 : 1;
      }
      if (cand.type === "investHouse") {   // a takeover: what flips to us plus what the other side stops getting, against the cost
        const gain = horizonPay(s, o, d.base + d.growth), denied = horizonPay(s, o, dividend(s, o));
        return (gain + denied - cand.amount) * v + r.ai.site * 0.5;
      }
      return 0;
    }

    // Breaking the other side's house (the AI's reason to destroy homes, Mala 2026-10-15). Worth: the payout it would
    // still pay its owners over the horizon, plus the half of the bank that spills to us, shared out over the HP it has,
    // scaled up as it weakens (finish what was started), and a bonus for the blow that brings it down.
    function houseBreakValue(s, a, o, dmg, falls) {
      const r = R(s); if (!r || !o?.house?.side || o.house.side === a.side || dmg <= 0) return 0;
      let denied = 0; for (let t = 0; t < r.ai.horizon; t++) denied += Math.min(r.dividend.cap, dividend(s, o) + r.dividend.growth * t);
      const worth = Math.max(0, denied - (o.house.stakes[a.side] || 0) * 0.5) * r.ai.apValue * r.ai.breakMul;   // our own stake burns with it
      const hurt = 1 + (1 - o.hp / o.maxHp);
      return (dmg / o.maxHp) * worth * hurt + dmg * r.ai.strikeMul + (falls ? worth * 0.5 : 0);
    }
    // Where a move ends: beside a house this unit can use (buy, hold, invest, besiege) is worth ai.site.
    function houseSite(s, a, to) {
      const r = R(s), o = house(s); if (!r || !o || !to || !FIGHTING.includes(a.side) || a.summon || a.communed || a.beast) return 0;
      const near = Math.max(Math.abs(to[0] - o.x), Math.abs(to[1] - o.y)) === 1, now = beside(s, o, a);
      if (!near || Math.max(Math.abs(a.x - o.x), Math.abs(a.y - o.y)) > r.ai.notice) return 0;
      return now ? 0 : r.ai.site;   // getting there is the point; staying is valued by not leaving (no bonus to step away)
    }

    return { houseHarmed, sueForRestitution: sue, restitutionDue, propertyClaims: claimsOf, RESTITUTION, spawnHouse, house, houseAction, houseRound, houseFell, houseRebuild, houseOptions, houseValue, houseSite, houseBreakValue, houseDividend: dividend };
  })();
});
