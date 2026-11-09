"use strict";
// The Animal Tamer (Mala, 2026-10-14/15; Muse's ~/loci-orbit/muse/tamer-kit/TAMER_KIT.md and TAMER_DESIRES.md). Numbers:
// content.js rules.tamer. A part of the Concept Combat engine: engine.js installs it with the host object H.
//
//   tameBeast(s, a, act)      → tame an adjacent wild unit: it joins his side for the battle (Gaia never)
//   markVessel(s, a, act)     → mark one of his tamed beasts as his vessel (his spare life)
//   transmigrate(s, a)        → at defeat, with a living vessel: he takes its body (wounds and all) and fights on
//   stateTraits(s, a)         → fearOfDeath while unmarked, immortalDelusion while marked (read by the trait motives)
//   tamerOptions(s, a)        → AI candidates; tamerValue(s, a, cand) their scores
//   friendRound(s)            → a remembered friend (a once-tamed Sasquatch, s.wildFriends) may arrive to help this round
//
// Taming is the beast's communion (Mala: "commune is so tuned that we'll have to make beast taming pretty strong").
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).tamer = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const spiritGone = (s, u) => { const Spirit = (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null; Spirit?.onExit?.(s, u, H); };   // SP-05: every exit refreshes the roster
    const R = (s) => s.rules?.tamer || null;
    const isTamer = (s, a) => !!R(s) && !!a && H.hasTrait(a, R(s).trait) && !a.summon && !a.beast && !a.communed;
    const tamedBy = (s, a) => Object.values(s.actors).filter((u) => u.beast?.owner === a.id && u.beast.tamed && !u.defeated);
    const holds = (a, c) => a.primary === c || a.secondary === c;   // Transmigration in his loadout: the technique marks, the crossing bursts
    // A vessel is one of his tamed beasts (an actor) or his effigy (an object, Transmigration's Effigy).
    const effigyOf = (s, id) => (s.arena.objects || []).find((o) => o.id === id && o.effigy && (o.hp ?? 0) > 0) || null;
    const vesselOf = (s, a) => { if (!a.vessel) return null; const v = s.actors[a.vessel]; if (v) return !v.defeated && v.beast?.owner === a.id ? v : null; return effigyOf(s, a.vessel); };
    // The Long Migration: any of his beasts or his effigy will take him, nearest first.
    const anyVessel = (s, a) => [...Object.values(s.actors).filter((u) => u.beast?.owner === a.id && u.beast.tamed && !u.defeated), ...(s.arena.objects || []).filter((o) => o.effigy?.owner === a.id && (o.hp ?? 0) > 0)]
      .sort((p, q) => Math.max(Math.abs(p.x - a.x), Math.abs(p.y - a.y)) - Math.max(Math.abs(q.x - a.x), Math.abs(q.y - a.y)) || (p.id < q.id ? -1 : 1));
    const longOn = (s, a) => a.longMigration && a.longMigration.until >= s.round;
    const adjacent = (a, u) => Math.max(Math.abs(a.x - u.x), Math.abs(a.y - u.y)) === 1;
    const wildUnit = (s, id) => (s.wild || []).find((m) => m.id === id && m.form === "unit" && m.lf > 0);

    // The chance a beast answers: easier the more it is hurt; harder if it is coming for him.
    function tameChance(s, a, m) {
      const r = R(s), c = r.chance, hurt = 1 - Math.max(0, m.lf) / Math.max(1, m.maxLF);
      const hostile = m.target === a.id || (m.telegraph?.unit === a.id);
      return Math.max(0, Math.min(0.95, (c.base + c.hurtBonus * hurt) * (hostile ? c.hostileMul : 1) * (c.kind?.[m.kind] ?? 1)));
    }

    function tameBeast(s, a, act) {
      const r = R(s); if (!isTamer(s, a)) return "Only a beast tamer can tame.";
      const m = wildUnit(s, act.target); if (!m) return "Choose a wild animal beside you.";
      if (r.never.includes(m.kind)) return `Nobody tames ${m.name || m.kind}.`;
      if (!adjacent(a, m)) return "Stand beside the animal.";
      if (tamedBy(s, a).length >= r.maxTamed) return `He keeps ${r.maxTamed} beasts at most.`;
      const heat = H.heatBonus ? H.heatBonus(s, a) : 0, staked = H.stakeBonus ? H.stakeBonus(s, a) : 0;   // W5.3
      const luck = H.luckBonus ? H.luckBonus(s, a) : 0;   // W5.1 rhythm
      let chance = Math.min(1, tameChance(s, a, m) + luck);
      if (luck) chance = Math.min(0.95, Math.max(0.05, chance));   // rhythm clamps 5–95; heat/staked ride on top
      chance = Math.min(1, chance + heat + staked);
      const spend = H.spendTempo(s, a, r.tameAp, `Tame the ${m.name || m.kind}`); if (spend) return spend;
      s.tameN = (s.tameN || 0) + 1;
      const roll = H.seededChance(`${s.seed}:tame:${s.tameN}:${m.id}`), ok = roll < chance;
      if (H.noteLuck) H.noteLuck(s, a, ok);
      if (H.settleStake) H.settleStake(s, ok);
      if (!ok) {
        const def = H.wildRules?.data?.monsters?.[m.kind] || {};
        if (def.tameFail === "provoked") {   // the Sasquatch gamble (Mala, 2026-10-19): miss, and it rounds on him for the battle
          m.target = a.id; m.provoked = true;
          H.log(s, { kind: "tame", actor: m.id, target: a.id, tiles: [[m.x, m.y]], text: `The ${(m.name || m.kind).toLowerCase()} will not be collared. It turns on ${a.name}, and it will not forget it this battle.`,
            why: ["A failed tame provokes it onto the tamer; a beast coming for him is harder to tame again."] });
        }
        if (H.recordRoll) H.recordRoll(s, { kind: "tame", actor: a.id, target: m.id, p: chance, roll });
        H.log(s, { kind: "tame", actor: a.id, target: m.id, tiles: [[m.x, m.y]], ok: false, text: `${a.name} reaches for the ${(m.name || m.kind).toLowerCase()}; it will not have him (${Math.round(chance * 100)}% chance).`,
          why: ["Hurt animals answer more readily; one coming for him answers less."] });
        return;
      }
      tameComplete(s, a, m, chance);
    }

    function tameComplete(s, a, m, chance) {   // extracted for MYOL replays (same bond either road in)
      s.wild = s.wild.filter((w) => w.id !== m.id);
      const beast = H.beadBeast(s, a, { kind: m.kind, name: m.name, maxLF: m.maxLF }, [m.x, m.y]);
      beast.lf = Math.max(1, m.lf); beast.maxLF = m.maxLF; beast.beast.tamed = true; beast.beast.turnsLeft = null; beast.tamed = { owner: a.id, round: s.round };
      if ((m.traits || []).length) beast.traits = m.traits.slice();   // its nature follows it into the bond (the Sasquatch stays a genius)
      if ((m.learned || []).length) beast.learned = m.learned.slice();   // and it keeps what it watched you do
      if (a.side === "player" && H.wildRules?.data?.monsters?.[m.kind]?.friend) s.friendsMade = [...new Set([...(s.friendsMade || []), m.kind])];   // the account remembers (ui.js)
      if (a.side === "player") beast.permanentAlly = true;
      H.log(s, { kind: "tame", actor: a.id, target: beast.id, tiles: [[beast.x, beast.y]], ok: true, text: `The ${(m.name || m.kind).toLowerCase()} answers ${a.name}: ${H.wildRules?.data?.monsters?.[m.kind]?.loyal ? "it is his for life" : "it fights at his side for the rest of the battle"} (${beast.lf} LF).`,
        why: [`${Math.round(chance * 100)}% chance. A tamed beast can be marked as his vessel.`] });
    }

    function markVessel(s, a, act) {
      const r = R(s); if (!isTamer(s, a)) return "Only a beast tamer can mark a vessel.";
      const v = s.actors[act.target];
      if (!v || v.defeated || v.beast?.owner !== a.id || !v.beast.tamed) return "Mark one of your own tamed beasts.";
      if (H.dist(s, a.x, a.y, v.x, v.y) > r.markRange) return `The mark reaches ${r.markRange} tiles.`;
      if (vesselOf(s, a)?.id === v.id) return "It is already your vessel.";
      const spend = H.spendTempo(s, a, Math.max(0, r.markAp - (H.hasTrait(a, "looseFit") ? 10 : 0)), "Mark a vessel"); if (spend) return spend;   // anime batch: Loose Fit slips vessels on cheap
      a.vessel = v.id;
      H.log(s, { kind: "vessel", actor: a.id, target: v.id, tiles: [[v.x, v.y]], text: `${a.name} marks the ${v.name.toLowerCase()} as his vessel. He believes he cannot die now.`,
        why: ["If he falls while it lives, he wakes in its body, wounds and all, and fights on.", "Kill the beast first, then let him be brave."] });
    }

    // Defeat hook (damage.js): returns true when he does not die because he moved.
    function transmigrate(s, a) {
      const r = R(s); if (!isTamer(s, a)) return false;
      const v = vesselOf(s, a) || (longOn(s, a) ? anyVessel(s, a)[0] : null); if (!v) return false;
      const from = [a.x, a.y], effigy = !!v.effigy, burst = longOn(s, a) ? r.burst * 2 : r.burst;
      // The crossing (Transmigration): 8 Nigredo against the enemies beside the body he leaves (class build crossing_burst).
      if (holds(a, "transmigration")) for (const e of Object.values(s.actors)) if (!e.defeated && e.side !== a.side && e.side !== "civilian" && e.side !== "bystander" && Math.max(Math.abs(e.x - from[0]), Math.abs(e.y - from[1])) === 1)
        H.hit(s, a, e, { ability: "crossingBurst", name: "The crossing", concept: "transmigration", delivery: "self", damageType: "nigredo", tier: "basic" }, burst, ["The soul bursts out of the body it leaves."], { label: "The crossing" });
      if (effigy) {   // an effigy: a 20 LF body, rooted for a turn; the effigy is gone
        s.arena.objects = s.arena.objects.filter((o) => o.id !== v.id);
        a.x = v.x; a.y = v.y; a.lf = Math.min(a.maxLF, 20); a.possessing = { kind: "effigy", name: "the effigy", round: s.round };
        a.status.entangled = { lostMove: 99, expiresAt: a.ownerTurns + 1 }; a.vessel = null;
      } else {
      a.x = v.x; a.y = v.y; a.lf = Math.max(1, v.lf); a.maxLF = v.maxLF; a.possessing = { kind: v.beast.kind, name: v.name, sprite: v.sprite, round: s.round };
      a.sprite = v.sprite; a.vessel = null;
      }
      const attuned = !effigy && a.primary === "resonance" && holds(a, "transmigration") && v.beast?.tamed;   // comp-resonance-transmigration: a tamed vessel takes him in tune
      a.status.ward = { label: attuned ? "Animal vigor, in tune" : "Animal vigor", owner: a.id, protection: r.vigor.ward * (attuned ? 2 : 1) };
      a.bankedTempo = Math.min(s.rules.maxBankedActionPoints ?? 100, (a.bankedTempo || 0) + r.vigor.ap);
      if (!effigy) { v.defeated = true; v.escaped = true; v.leaveReason = "taken as a vessel"; v.tempo = 0; spiritGone(s, v);
        const at = s.order.indexOf(v.id); s.order = s.order.filter((id) => id !== v.id);
        if (at >= 0 && at < s.turnIndex) s.turnIndex -= 1;   // the vessel's slot is gone: keep the pointer on the same actor (seed 50005 crashed past the end)
        s.turnIndex = Math.min(s.turnIndex, s.order.length - 1); }
      if (longOn(s, a)) { const next = anyVessel(s, a)[0]; if (next) a.vessel = next.id; }   // the long migration re-marks at once
      H.log(s, { kind: "transmigrate", actor: a.id, target: v.id, tiles: [from, [a.x, a.y]], text: `${a.name} falls, and wakes in ${effigy ? "his effigy" : `the ${v.name.toLowerCase()}`}: ${a.lf} LF, every technique still his.`,
        why: [`Animal vigor: ward ${r.vigor.ward} and ${r.vigor.ap} action points on his next turn.`, "Unmarked again: tame and mark another, or the next fall is the last."] });
      return true;
    }

    // Call the Pack (his ultimate; Muse's TAMER_KIT.md; Mala 2026-10-15: "summoned beasts stay"): a full bar calls two
    // wild animals onto open ground beside him, tamed and his for the rest of the battle (no clock, outside the cap).
    function packPool(s) {
      const M = H.wildRules?.data?.monsters || {}, r = R(s);
      return Object.keys(M).filter((k) => M[k].form === "unit" && M[k].ready !== false && M[k].pack !== false && !r.never.includes(k)).sort();
    }
    function callPack(s, a) {
      const r = R(s); if (!isTamer(s, a)) return "Only a beast tamer can call the pack.";
      if ((a.ultimateCharge || 0) < s.rules.ultimateChargeMax) return `Call the Pack needs a full bar (${a.ultimateCharge || 0}/${s.rules.ultimateChargeMax}).`;
      const pool = packPool(s); if (!pool.length) return "There are no wild animals to call.";
      const open = []; for (let rr = 1; rr <= 3 && open.length < r.pack.count; rr++) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
        const x = a.x + dx, y = a.y + dy; if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr || !H.inside(s, x, y) || H.tileAt(s, x, y).blocksMove || H.actorAt(s, x, y)) continue;
        if ((s.wild || []).some((m) => m.form === "unit" && m.x === x && m.y === y) || (s.arena.objects || []).some((o) => o.x === x && o.y === y && o.blocksMove) || open.some(([p, q]) => p === x && q === y)) continue;
        if (open.length < r.pack.count) open.push([x, y]); }
      if (!open.length) return "There is no open ground beside him.";
      const spend = H.spendTempo(s, a, r.pack.ap, "Call the Pack"); if (spend) return spend;
      a.ultimateCharge = 0; summonPack(s, a, open, pool);
    }
    // The pack itself (the action above, and the merge technique Call the Pack, which the engine has already paid for).
    function summonPack(s, a, open = null, pool = null) {
      const r = R(s); if (!r) return; pool ||= packPool(s); if (!pool.length) return;
      if (!open) { open = []; for (let rr = 1; rr <= 3 && open.length < r.pack.count; rr++) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
        const x = a.x + dx, y = a.y + dy; if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr || !H.inside(s, x, y) || H.tileAt(s, x, y).blocksMove || H.actorAt(s, x, y)) continue;
        if ((s.wild || []).some((m) => m.form === "unit" && m.x === x && m.y === y) || (s.arena.objects || []).some((o) => o.x === x && o.y === y && o.blocksMove) || open.some(([p, q]) => p === x && q === y)) continue;
        if (open.length < r.pack.count) open.push([x, y]); } }
      s.packN = (s.packN || 0) + 1;
      const called = open.map((at, i) => {
        const kind = pool[Math.floor(H.seededChance(`${s.seed}:pack:${s.packN}:${i}`) * pool.length)], def = H.wildRules.data.monsters[kind];
        const b = H.beadBeast(s, a, { kind, name: def.name, maxLF: def.lf }, at);
        b.lf = def.lf; b.maxLF = def.lf; b.beast.tamed = true; b.beast.turnsLeft = null; b.beast.called = true; b.tamed = { owner: a.id, round: s.round };
        if (a.side === "player") b.permanentAlly = true;
        return b;
      });
      H.log(s, { kind: "callPack", actor: a.id, tiles: called.map((b) => [b.x, b.y]), text: `${a.name} calls the pack: ${called.map((b) => b.name.toLowerCase()).join(" and ")} answer${called.length === 1 ? "s" : ""}, his for the rest of the battle.`,
        why: ["His ultimate: the whole bar. Called beasts stay until they fall, and any of them can be marked as his vessel."] });
    }

    function stateTraits(s, a) {
      if (!isTamer(s, a)) return [];
      return vesselOf(s, a) ? ["immortalDelusion"] : ["fearOfDeath"];
    }

    function tamerOptions(s, a) {
      const r = R(s); if (!isTamer(s, a)) return [];
      const out = [];
      if (a.tempo >= r.tameAp && tamedBy(s, a).length < r.maxTamed)
        for (const m of s.wild || []) if (m.form === "unit" && m.lf > 0 && !r.never.includes(m.kind) && adjacent(a, m)) out.push({ type: "tameBeast", actor: a.id, target: m.id });
      if (!holds(a, "transmigration") && (a.ultimateCharge || 0) >= s.rules.ultimateChargeMax && a.tempo >= r.pack.ap && packPool(s).length) out.push({ type: "callPack", actor: a.id });   // with Transmigration it is the merge technique
      if (a.tempo >= Math.max(0, r.markAp - (H.hasTrait(a, "looseFit") ? 10 : 0)) && !vesselOf(s, a) && !holds(a, "transmigration"))   // with Transmigration, Mark the Vessel is a technique
        for (const v of tamedBy(s, a)) if (H.dist(s, a.x, a.y, v.x, v.y) <= r.markRange) out.push({ type: "markVessel", actor: a.id, target: v.id });
      return out;
    }
    // Muse's desire table (TAMER_DESIRES.md): securing a spare life comes first; taming is worth its odds.
    function tamerValue(s, a, cand) {
      const r = R(s);
      if (cand.type === "markVessel") return r.ai.mark;
      if (cand.type === "callPack") return tamedBy(s, a).length < 2 ? r.ai.packLow : r.ai.pack;   // restock vessels first (TAMER_DESIRES.md)
      if (cand.type === "tameBeast") { const m = wildUnit(s, cand.target); return m ? r.ai.tame * tameChance(s, a, m) : 0; }
      return 0;
    }

    // A remembered friend (Mala, 2026-10-19): a beast once tamed (account.wildFriends, passed in as s.wildFriends) may come
    // back. One seeded roll per kind per battle at the first round change; on a hit it arrives in a seeded round in
    // [fromRound, toRound] at the open edge tile nearest the hero, tamed and on the hero's side for the battle. A wild one
    // of the same kind can still turn up on its own.
    function friendRound(s) {
      const M = H.wildRules?.data?.monsters || {};
      if (!s.friendPlan) { s.friendPlan = [];
        for (const kind of s.wildFriends || []) { const f = M[kind]?.friend; if (!f) continue;
          if (H.seededChance(`${s.seed}:friend:${kind}`) >= f.chance) continue;
          s.friendPlan.push({ kind, round: f.fromRound + Math.floor(H.seededChance(`${s.seed}:friend:${kind}:when`) * (f.toRound - f.fromRound + 1)) }); } }
      for (const plan of s.friendPlan) {
        if (plan.done || plan.round !== s.round) continue;
        plan.done = true;
        const hero = s.actors[s.modeSetup?.hero || "player"]; if (!hero || hero.defeated || hero.side !== "player") continue;
        const free = (x, y) => H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove && !H.actorAt(s, x, y) && !(s.wild || []).some((w) => w.x === x && w.y === y && w.lf > 0);
        const edge = [];
        for (let x = 0; x < s.arena.w; x++) for (const y of [0, s.arena.h - 1]) if (free(x, y)) edge.push([x, y]);
        for (let y = 1; y < s.arena.h - 1; y++) for (const x of [0, s.arena.w - 1]) if (free(x, y)) edge.push([x, y]);
        edge.sort((p, q) => Math.max(Math.abs(p[0] - hero.x), Math.abs(p[1] - hero.y)) - Math.max(Math.abs(q[0] - hero.x), Math.abs(q[1] - hero.y)) || p[0] - q[0] || p[1] - q[1]);
        if (!edge.length) continue;
        const def = M[plan.kind];
        const beast = H.beadBeast(s, hero, { kind: plan.kind, name: def.name, maxLF: def.lf }, edge[0]);
        beast.lf = def.lf; beast.maxLF = def.lf; beast.beast.tamed = true; beast.beast.turnsLeft = null; beast.beast.friend = true;
        beast.tamed = { owner: hero.id, round: s.round, friend: true }; beast.permanentAlly = true;
        if ((def.traits || []).length) beast.traits = def.traits.slice();
        H.log(s, { kind: "tame", actor: beast.id, target: hero.id, tiles: [edge[0]], ok: true, text: `The trees split: a ${def.name} you once won over crashes onto the field at ${hero.name}'s side. It fights for you this battle.`,
          why: [`A remembered friend: ${Math.round(def.friend.chance * 100)}% a battle once you have tamed one.`] });
      }
    }

    return { friendRound, tameBeast, markVessel, callPack, summonPack, transmigrate, stateTraits, tamerOptions, tamerValue, tameChance, isTamer, vesselOf, tameComplete };
  })();
});
