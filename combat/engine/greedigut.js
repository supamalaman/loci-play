"use strict";
// Greedigut (Exile G1; spec ~/loci-orbit/ready-to-review/claude-anime-exile-spec/specs/EXILE_TENANCY.md §4). A new wild
// boss tied to a sub-full tenant. He takes no Life Force: a damaging blow becomes tempoDebt (8 AP, cap drops the rest,
// never Tally.charge / never LF collection). Hidden countdown 2–6 from `${seed}:greedigut:${hostId}`. Notice is announced
// and lands at the end of the next round. Surrender ask on spawn is a mechanical accept/decline (the player's answer card is a
// later ui.js slice: until then a player host declines, R-20261122-07). Full Coherence never arrives. Playing dead is read as a
// corpse. Drafted by Grok (grok/exile-g1, 2026-11-18, unshelved); ported onto v1.3.573 by Ripple BD. Installed by engine.js with H.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).greedigut = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { C, log, hit } = H;
    const BOSS = "greedigut";
    const live = (u) => !!u && !u.defeated && !u.escaped && !u.notArrived;
    const R = () => (C.rules.tenancy && C.rules.tenancy.greedigut) || {};
    const B = () => H.bossRules?.data?.bosses?.[BOSS] || {};
    const account = () => { try { if (typeof module === "object" && module.exports) return require("../account/tenancy.js"); } catch {} return (typeof self !== "undefined" ? self.ConceptCombatTenancy : null); };
    function hash(str) {
      let h = 2166136261;
      for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
      h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    }
    const Greedigut = {
      POOL: 60,
      is: (u) => !!u && u.boss === BOSS,
      present(s) { return Object.values(s.actors || {}).find((u) => Greedigut.is(u) && live(u)) || null; },
      hostOf(s) { const id = s.tenancy?.host || s.modeSetup?.hero || "player"; return s.actors[id] || null; },
      full(s) { const host = Greedigut.hostOf(s), acc = account(); return !!(host?.tenant && acc?.rungOf(host.tenant.coherence).full); },
      specs(event) {
        const row = B();
        return [{ character: "boss-greedigut", displayName: row.name || "Greedigut", sprite: "greedigut", side: "wild", role: "greedigut", boss: BOSS, size: row.size || { w: 1, h: 1 }, maxLF: row.lf || 200 }];
      },
      countdownOf(s, hostId) {
        const n = R(), lo = n.countdownMin || 2, hi = n.countdownMax || 6;
        return lo + Math.floor(hash(`${s.seed}:greedigut:${hostId}`) * (hi - lo + 1));
      },
      seed(s, gut, host) {
        const h = host || Greedigut.hostOf(s);
        const left = Greedigut.countdownOf(s, h?.id || "player");
        s.greedigut = { id: gut.id, hostId: h?.id || "player", spawnRound: s.round, left, countdown: left, ask: null, notice: null, won: false };
        if (h?.tenant && !Greedigut.full(s)) {
          s.greedigut.ask = { by: gut.id, hostId: h.id, round: s.round };
          log(s, { kind: "greedigut", actor: gut.id, target: h.id, ask: true, text: R().ask || "Greedigut serves a removal notice.", why: ["Accept: the main tenant is erased for this save. Decline: the countdown fight."] });
          // R-20261122-07: the player's Accept/Decline card is a later ui.js slice; until it ships the player's notice counts as declined.
          if (h.controller !== "ai") { s.greedigut.ask = null; log(s, { kind: "greedigut", actor: h.id, text: R().decline || "The notice is declined. He watches the clock.", why: ["The answer card comes in a later slice; for now the notice is declined and the countdown fight begins."] }); }
        }
        log(s, { kind: "greedigut", actor: gut.id, text: R().clock || "He is watching the clock.", why: ["The countdown is 2 to 6 rounds, rolled once, never shown as a number."] });
      },
      dress(s, u) {
        const row = B();
        Object.assign(u, { boss: BOSS, name: row.name || u.name || "Greedigut", sprite: "greedigut", side: "wild", ai: "boss", size: row.size || { w: 1, h: 1 },
          maxLF: row.lf || u.maxLF || 200, lf: row.lf || u.lf || 200, conditions: u.conditions || {}, bossAbilityIds: (H.C?.characters?.["boss-greedigut"]?.bossAbilityIds || u.bossAbilityIds || []).slice() });
        u.defeated = false; u.notArrived = false; u.escaped = false;
      },
      arrive(s, event) {
        if (Greedigut.full(s) || !Greedigut.hostOf(s)?.tenant) {
          for (const id of event.actorIds || []) {
            const u = s.actors[id]; if (!u) continue;
            u.defeated = true; u.escaped = true; u.notArrived = true; u.noXp = true; u.tempo = 0; u.leaveReason = "no vessel";
          }
          log(s, { kind: "greedigut", text: Greedigut.full(s) ? (R().fullGate || "The vessel holds: Greedigut does not arrive.") : (R().noTenant || "No tenant: Greedigut does not arrive.") });
          return null;
        }
        let gut = null;
        for (const id of event.actorIds || []) { const u = s.actors[id]; if (u) { Greedigut.dress(s, u); gut = u; } }
        if (!gut) return null;
        log(s, { kind: "randomEvent", actor: gut.id, tiles: [[gut.x, gut.y]], text: `${gut.name} arrives.` });
        Greedigut.seed(s, gut, Greedigut.hostOf(s));
        return gut.id;
      },
      leave(s, why) {
        const g = Greedigut.present(s); if (!g) { if (s.greedigut) s.greedigut.gone = true; return; }
        g.defeated = true; g.escaped = true; g.noXp = true; g.tempo = 0; g.leaveReason = why || "countdown";
        if (s.greedigut) { s.greedigut.gone = true; s.greedigut.ask = null; s.greedigut.notice = null; }
        log(s, { kind: "greedigut", actor: g.id, text: R().leave || `${g.name}'s countdown ends. He leaves.`, why: [why === "surrender" ? "The notice was accepted." : "The hidden countdown ended."] });
        if (s.rules?.scenario?.id === "greedigutLesson" && !s.outcome && why !== "exorcism") {   // his win is never the player's: an exorcism falls through to the host's own defeat
          s.outcome = { winner: "player", round: s.round, reason: "Greedigut left." }; s.phase = "over";
          log(s, { kind: "outcome", text: "He leaves. The teaching fight ends." });
        }
      },
      absorbs(s, src, tgt, dmg, notes) {
        if (!Greedigut.is(tgt) || !(dmg > 0)) return false;
        const cap = s.rules.maxTempoDebt, want = R().debt || 8, room = Math.max(0, cap - (tgt.tempoDebt || 0)), land = Math.min(room, want), drop = want - land;
        tgt.tempoDebt = (tgt.tempoDebt || 0) + land;
        const line = `${tgt.name} takes no Life Force: ${land} AP of debt${drop ? `; ${drop} AP past the ${cap} cap is dropped` : ""}.`;
        if (notes) notes.push(line);
        log(s, { kind: "greedigut", actor: src?.id, target: tgt.id, debt: land, dropped: drop, text: line, why: ["Greedigut is invulnerable; a damaging blow becomes tempo debt, never Life Force collection."] });
        return true;
      },
      onHostDown(s, tgt) {
        if (!tgt || tgt.lf > 0 || s.preview) return;
        if (!Greedigut.present(s) || tgt.id !== (s.greedigut?.hostId || Greedigut.hostOf(s)?.id)) return;
        Greedigut.win(s, tgt, "hostDown");
      },
      win(s, host, why) {
        if (s.greedigut?.won) return;
        if (s.greedigut) s.greedigut.won = true;
        if (s.tenancy) s.tenancy.exorcised = true;
        log(s, { kind: "greedigut", actor: s.greedigut?.id, target: host?.id, exorcism: true, text: R().win || "The host is at 0 Life Force while Greedigut is present: the main tenant is exorcised.", why: [why === "surrender" ? "Accepted surrender is an exorcism without the fight." : "Mala, 2026-11-05: zero LF against him is his win."] });
        Greedigut.leave(s, why === "surrender" ? "surrender" : "exorcism");
      },
      answer(s, a, accept) {
        const ask = s.greedigut?.ask; if (!ask) return "There is no removal notice on the table.";
        if (a.id !== ask.hostId) return "Only the host answers the notice.";
        s.greedigut.ask = null;
        if (accept) { Greedigut.win(s, a, "surrender"); log(s, { kind: "greedigut", actor: a.id, text: R().accept || "The notice is accepted." }); return null; }
        log(s, { kind: "greedigut", actor: a.id, text: R().decline || "The notice is declined. He watches the clock." });
        return null;
      },
      resolve(s, a, inst) {
        if (!Greedigut.is(a) || !String(inst.ability || "").endsWith("_notice")) return null;
        const host = Greedigut.hostOf(s); if (!host || !live(host)) return true;
        const tiles = inst.tiles?.length ? inst.tiles.map((t) => t.slice()) : [[host.x, host.y]];
        s.greedigut = s.greedigut || {};
        s.greedigut.notice = { tiles, hostId: host.id, landAt: s.round + 1, by: a.id };
        log(s, { kind: "announce", actor: a.id, target: host.id, tiles, text: `${a.name} marks ${host.name}. ${R().clock || "He is watching the clock."}`,
          why: ["Notice is announced now and lands at the end of the next round. An ally on the tiles can take it; the host stepping off misses; playing dead is read as a corpse."] });
        return true;
      },
      landNotice(s) {
        const n = s.greedigut?.notice, gut = Greedigut.present(s); if (!n || !gut) return;
        s.greedigut.notice = null;
        const host = s.actors[n.hostId]; if (!host || !live(host)) return;
        if (host.status?.playingDead) { log(s, { kind: "greedigut", actor: gut.id, target: host.id, text: R().skip || "He reads a corpse and skips the Notice." }); return; }
        const on = (u) => live(u) && n.tiles.some((t) => t[0] === u.x && t[1] === u.y);
        const ally = Object.values(s.actors).find((u) => u.id !== host.id && u.side === host.side && on(u));
        const tgt = ally || (on(host) ? host : null);
        if (!tgt) { log(s, { kind: "miss", actor: gut.id, text: R().miss || "Notice lands on empty tiles: the host stepped off the mark." }); return; }
        const pot = R().notice || 40;
        const dmg = tgt.id === host.id && host.lf === host.maxLF ? Math.min(pot, host.maxLF - 1) : pot;
        const why = [ally ? (R().ally || "An ally takes the Notice.") : "Notice lands.", "It cannot take a host from full Life Force to zero in one resolution."];
        hit(s, gut, tgt, { name: "Notice", ability: "boss_greedigut_notice", damageType: "albedo" }, dmg, why, { label: "Notice" });
      },
      onRound(s) {
        // Arrival lives here, not in engine.js (size cap): processRandomEvents has just brought the event actor in this round start.
        if (!s.greedigut) for (const u of Object.values(s.actors || {})) if (u.eventRole === "greedigut" && !u.notArrived && !u.defeated && !Greedigut.is(u)) Greedigut.arrive(s, { actorIds: [u.id] });
        const gut = Greedigut.present(s);
        if (gut && !s.greedigut) Greedigut.seed(s, gut, Greedigut.hostOf(s));
        if (s.greedigut?.notice && s.round > s.greedigut.notice.landAt) Greedigut.landNotice(s);
        if (!s.greedigut || s.greedigut.gone) return;
        if (s.round > s.greedigut.spawnRound) s.greedigut.left = Math.max(0, (s.greedigut.countdown || 0) - (s.round - s.greedigut.spawnRound));
        if (s.round >= s.greedigut.spawnRound + s.greedigut.countdown) Greedigut.leave(s, "countdown");
      },
      aiAction(s, a) {
        if (!Greedigut.is(a) || !live(a)) return null;
        if (s.greedigut?.ask && a.actionsThisTurn === 0) return { type: "end", actor: a.id };
        const host = Greedigut.hostOf(s);
        if (host && live(host) && !s.greedigut?.notice) {
          const id = (a.bossAbilityIds || []).find((x) => /notice$/i.test(x)) || "boss_greedigut_notice";
          const act = { type: "ability", actor: a.id, ability: id, target: [host.x, host.y] };
          if (H.apply(s, act, { preview: true }).ok) return act;
        }
        return { type: a.tempo > 0 ? "stall" : "end", actor: a.id };
      },
    };
    return { Greedigut };
  })();
});
