// Group spirit, Half 1 (Shears BD, 2026-10-29; codex SPEC SPIRIT-ORDER + Pantry notes, Mala go).
// Per-side per-round assessment -> stance; Focus/Protect signals cached once per round;
// every fighter's ordinary candidate scoring reads them as small capped bonuses.
// Slice 1: assessment, stance, Focus + Protect, telegraphs. Behind rules.spirit (stage 0 = off).
(function (factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else (typeof self !== "undefined" ? self : this).ConceptCombatSpirit = factory();
})(function () {
  "use strict";
  const TUNABLES = { outAt: 1.5, winAt: 1.5, lfLine: 0.6, focusBonus: 2, protectBonus: 2, spiritCap: 4,
    dangerNear: 6, dangerFoe: 0.25, spacingAlly: 2, spacingFoe: 1, tempoHold: 2,
    roleFocus: { leader: 1, striker: 1.5, screen: 0.5, scout: 1, admin: 0 },
    roleProtect: { leader: 1, striker: 0.5, screen: 1.5, scout: 1, admin: 0 } };
  const R = (s) => ({ ...TUNABLES, ...(s.rules?.spirit || {}) });
  const live = (s, side) => Object.values(s.actors).filter((u) => !u.defeated && !u.notArrived && !u.husk && u.side === side);
  const lfSum = (us) => us.reduce((n, u) => n + Math.max(0, u.lf || 0), 0);
  const lfFrac = (u) => (u.maxLf || u.maxLF || 1) > 0 ? Math.max(0, u.lf || 0) / (u.maxLf || u.maxLF || 1) : 0;
  const dist = (s, x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);

  // Feral sides are never conducted: wilds, Gaia, and anything the table flags.
  function conducted(s, side) {
    if (side === "bystander" || side === "wild") return false;
    const us = live(s, side);
    if (!us.length) return false;
    if (us.every((u) => u.wild || u.feral)) return false;
    if (us.some((u) => u.gaia)) return false;
    return true;
  }
  // The player's side assesses (telegraphs, Observe reads) but its fighters decide for themselves.
  const aiSide = (s, a) => a.side !== "player" && conducted(s, a.side);

  // SP-03: the side knows only what it can see — the established veiled rule (ai.js),
  // and only sides it is at war with. Veiled foes shrink every denominator below.
  const veiled = (u) => !!u && !u.defeated && !!u.status?.concealed && (u.status.concealed.until == null || u.status.concealed.until >= u.ownerTurns);
  function knownFoes(s, side, H) {
    const us = live(s, side), rep = us[0] || null;
    const atWar = H?.Factions?.atWar;
    return Object.values(s.actors).filter((u) => !u.defeated && !u.notArrived && !u.husk && u.side !== side && u.side !== "bystander" && u.side !== "wild" && !veiled(u) && (!atWar || atWar(s, rep, u)));
  }
  function stanceOf(s, side, H) {
    const us = live(s, side), them = knownFoes(s, side, H);
    const t = R(s);
    const hidden = us.length > 0 && us.every((u) => !!u.status?.concealed);
    if (hidden) return "hidden";
    if (them.length > us.length * t.outAt || lfSum(us) < lfSum(them) * t.lfLine) return "outnumbered";
    if (us.length > them.length * t.winAt && lfSum(us) >= lfSum(them) * t.lfLine) return "winning";
    return "even";
  }

  // SP-06: threat is level × maxLF (cheap, monotone with danger); effort is the LF left to chew through.
  // Focus ranks threat first, effort second — never wounds alone — over foes the side can actually reach.
  const threatOf = (u) => (u.level ?? 1) * (u.maxLF ?? u.maxLf ?? 1);
  const effortOf = (u) => Math.max(1, u.lf ?? 1);
  const budgetOf = (s, u, H) => H?.moveBudgetFor?.(s, u) ?? s.rules?.moveBudget ?? 3;
  function assess(s, side, H) {
    const us = live(s, side), t = R(s);
    const them = knownFoes(s, side, H);
    const stance = stanceOf(s, side, H);
    const reach = (f) => us.some((m) => dist(s, m.x, m.y, f.x, f.y) <= budgetOf(s, m, H) + maxReach(s, m, H));
    const focus = us.length > 1 ? (them.filter(reach).sort((p, q) => threatOf(q) - threatOf(p) || effortOf(p) - effortOf(q) || (p.id < q.id ? -1 : 1))[0]?.id ?? null) : null;
    const danger = (u) => (1 - lfFrac(u)) + t.dangerFoe * them.filter((f) => dist(s, f.x, f.y, u.x, u.y) <= t.dangerNear).length;
    const protect = us.length > 1 ? us.slice().sort((p, q) => danger(q) - danger(p) || (p.id < q.id ? -1 : 1))[0].id : null;
    return { round: s.round, stance, nUs: us.length, nThem: them.length, lfUs: lfSum(us), lfThem: lfSum(them), signals: { focus, protect } };
  }

  const TELEGRAPH = {
    hidden: "The field goes quiet on one side: nothing there to count.",
    outnumbered: "The few look at the many and close ranks.",
    even: "Both lines hold; neither gives ground yet.",
    winning: "The many smell it, and press.",
  };
  function enabled(s) { return (s.rules?.spirit?.stage ?? 3) > 0; }
  const valSum = (s, u, us, H) => us.reduce((n, v) => n + (H?.Factions?.valence ? H.Factions.valence(s, u, v) : 0), 0);
  const hasTrait = (u, id) => (u.traits || []).some((t) => ((t && t.id) || t) === id);
  const maxLFOf = (u) => u.maxLF ?? u.maxLf ?? 1;
  // SP-06: leader is the highest-valence-to-crew veteran (ties: LF, then level); the flex reads kit —
  // tanky screens, swift scouts, greedy tends. "Veteran" = standing crew, not a summoned ride-along.
  // Hidden-calm (recorded reading): hidden while NOT outnumbered by the known count — lurkers amid a
  // crowd scout; only a calm hidden side tends. Pairs split by kit (a tankier kit screens and no
  // one leads; matched kits keep leader + striker) and never admin.
  function assignRoles(s, side, H) {
    const us = live(s, side), t = R(s);
    if (!us.length) return {};
    if (us.length === 1) return { [us[0].id]: "striker" };
    const st = stanceOf(s, side, H);
    const them = knownFoes(s, side, H);
    const outgunned = them.length > us.length * t.outAt || lfSum(us) < lfSum(them) * t.lfLine;
    if (us.length === 2) {
      const [a, b] = us;
      if (maxLFOf(a) !== maxLFOf(b)) {   // SP-06: striker + screen by kit — the tankier holds, the other hits, no one leads
        const [screen, striker] = maxLFOf(a) > maxLFOf(b) ? [a, b] : [b, a];
        return { [screen.id]: "screen", [striker.id]: "striker" };
      }
      const crew = us.filter((u) => !u.summon), pool = crew.length ? crew : us;
      const leader = pool.slice().sort((p, q) => valSum(s, q, us, H) - valSum(s, p, us, H) || (q.lf ?? 0) - (p.lf ?? 0) || ((q.level ?? 1) - (p.level ?? 1)) || (p.id < q.id ? -1 : 1))[0];
      const roles = { [leader.id]: "leader" };
      for (const u of us) if (!(u.id in roles)) roles[u.id] = "striker";
      return roles;
    }
    const crew = us.filter((u) => !u.summon), pool = crew.length ? crew : us;
    const leader = pool.slice().sort((p, q) => valSum(s, q, us, H) - valSum(s, p, us, H) || (q.lf ?? 0) - (p.lf ?? 0) || ((q.level ?? 1) - (p.level ?? 1)) || (p.id < q.id ? -1 : 1))[0];
    const roles = { [leader.id]: "leader" };
    const rest = us.filter((u) => u.id !== leader.id);
    const kind = st === "winning" ? "admin" : st === "hidden" && !outgunned ? "admin" : st === "hidden" ? "scout" : "screen";
    const flex = kind === "admin"
      ? rest.slice().sort((p, q) => (hasTrait(q, "greedy") - hasTrait(p, "greedy")) || maxLFOf(p) - maxLFOf(q) || (p.id < q.id ? -1 : 1))[0]
      : kind === "screen"
        ? rest.slice().sort((p, q) => maxLFOf(q) - maxLFOf(p) || (p.id < q.id ? -1 : 1))[0]
        : rest.slice().sort((p, q) => budgetOf(s, q, H) - budgetOf(s, p, H) || (p.id < q.id ? -1 : 1))[0];
    roles[flex.id] = kind;
    for (const u of rest) if (!(u.id in roles)) roles[u.id] = "striker";
    return roles;
  }
  function roundHook(s, H) {
    if (!enabled(s)) return;
    s.spirit ||= {};
    for (const side of new Set(Object.values(s.actors).map((u) => u.side))) {
      if (!conducted(s, side)) continue;
      const prev = s.spirit[side], now = assess(s, side, H);
      now.roles = assignRoles(s, side, H); now.locked = false; now.acted = []; now.coherence = Math.min(3, now.nUs);
      now.memberKey = live(s, side).map((x) => x.id).sort().join(",");
      s.spirit[side] = now;
      if (prev && prev.stance !== now.stance && H?.log) H.log(s, { kind: "spirit", text: TELEGRAPH[now.stance] });
    }
  }
  // SP-05: a side of one has nobody to focus with or protect; every path that can leave one standing clears both.
  const soloClear = (c) => { if (c.nUs <= 1) { c.signals.focus = null; c.signals.protect = null; } };
  const NONACTS = ["end", "stall", "respond", "resolveTrauma", "chooseVerse", "discardVerse", "callCut", "mindPick", "mindVow", "mindConcede"];
  // A fighter acted: track it; the second distinct actor locks the round's roles.
  function acted(s, action, H) {
    if (!enabled(s) || !action || NONACTS.includes(action.type)) return;
    const u = s.actors[action.actor]; if (!u || !conducted(s, u.side)) return;
    const c = cached(s, u.side); if (!c) return;
    const ids = live(s, u.side).map((x) => x.id).sort().join(",");
    if (c.memberKey !== ids) {   // a fighter down or a new arrival unlocks; the new shape needs fresh confirmation
      c.roles = assignRoles(s, u.side, H); c.locked = false; c.memberKey = ids; c.acted = [];
      c.coherence = Math.min(3, live(s, u.side).length); c.nUs = live(s, u.side).length;
      soloClear(c);   // SP-05: solo never calls focus or protect, however it got there
    }
    if (!c.acted.includes(u.id)) c.acted.push(u.id);
    if (!c.locked && c.acted.length >= 2) c.locked = true;
  }
  // SP-05: a fighter fell. Lesser deaths keep the round's mind (roles and ladder only —
  // the spirit commits for the round). A fallen leader reassesses at once: stance, signals,
  // ladder, succession, every survivor checks rout against the killer's living body, and a
  // stance shift telegraphs like any other. SP-04: fear takes actor objects, never IDs.
  function onDeath(s, u, srcId, H) {
    if (!enabled(s) || !conducted(s, u.side)) return;
    const c = cached(s, u.side);
    if (!c) return;
    const wasLeader = c.roles?.[u.id] === "leader";
    const src = srcId ? s.actors[srcId] ?? null : null;
    if (!wasLeader) {
      c.roles = assignRoles(s, u.side, H); c.locked = false;
      c.memberKey = live(s, u.side).map((x) => x.id).sort().join(",");
      c.coherence = Math.min(3, live(s, u.side).length); c.nUs = live(s, u.side).length;
      soloClear(c);   // SP-05 (round 2): a 2->1 non-leader death leaves a solo striker with no call and no ward
      return;
    }
    const a1 = assess(s, u.side, H), prevStance = c.stance;
    c.stance = a1.stance; c.signals = a1.signals; c.nUs = a1.nUs; c.nThem = a1.nThem; c.lfUs = a1.lfUs; c.lfThem = a1.lfThem;
    c.coherence = Math.min(3, a1.nUs);
    c.roles = assignRoles(s, u.side, H); c.locked = false;
    c.memberKey = live(s, u.side).map((x) => x.id).sort().join(",");
    const next = Object.keys(c.roles).find((id) => c.roles[id] === "leader");
    if (H?.log) {
      H.log(s, { kind: "spirit", text: next ? `${u.name} falls; ${s.actors[next]?.name || "another"} takes the lead.` : `${u.name} falls; no one takes the lead.` });
      if (prevStance !== c.stance) H.log(s, { kind: "spirit", text: TELEGRAPH[c.stance] });
    }
    if (H?.fearCheck) for (const v of live(s, u.side)) H.fearCheck(s, v, src);
  }
  // SP-05: a fighter left without dying (fled, freed, expired, released). The roster and ladder
  // refresh at once, solo focus calls die, and nothing else happens: no shock, no telegraph, no word.
  function onExit(s, u, H = null) {
    if (!enabled(s) || !conducted(s, u.side)) return;
    const c = cached(s, u.side);
    if (!c) return;
    c.roles = assignRoles(s, u.side, H); c.locked = false;
    c.memberKey = live(s, u.side).map((x) => x.id).sort().join(",");
    c.coherence = Math.min(3, live(s, u.side).length); c.nUs = live(s, u.side).length;
    soloClear(c);
  }
  // Admin moves (greed, meditate) only in calm stances, and only by the side's admin.
  // SP-02: calm is Winning, or Hidden while not outnumbered by the cached count (Hidden-calm).
  function canAdmin(s, a) {
    const stage = s.rules?.spirit?.stage ?? 3;
    if (stage < 3 || !aiSide(s, a)) return true;   // the system below this stage gates nothing
    const c = cached(s, a.side);
    if (!c || c.roles?.[a.id] !== "admin") return false;
    if (c.stance === "winning") return true;
    if (c.stance !== "hidden") return false;
    const t = R(s);
    return !(c.nThem > c.nUs * t.outAt || c.lfUs < c.lfThem * t.lfLine);
  }
  // SP-02: economy/ritual bids multiply to exactly zero unless the conductor allows admin work —
  // but a side with no cache yet (pre-round-1) is unled, not disobedient: old behavior stands.
  const greedOpen = (s, a) => !cached(s, a.side) || canAdmin(s, a);
  const greedMul = (s, a) => (greedOpen(s, a) ? 1 : 0);   // SP-02 (round 2): exactly 0, so a residual bid can't beat the best.sc <= 0 fallback
  function cached(s, side) {
    const c = s.spirit?.[side];
    return c && c.round === s.round ? c : null;
  }

  const PROTECTIVE = ["guard", "ward", "heal", "cover", "barrier", "anchor", "immovable", "membrane", "aura"];
  function targetId(s, cand, H) {
    if (!cand) return null;
    if (typeof cand.target === "string") return cand.target;
    if (Array.isArray(cand.target) && H?.actorAt) { const u = H.actorAt(s, cand.target[0], cand.target[1]); return u ? u.id : null; }
    return null;
  }
  // The scoring term. Small, capped, and stage-gated; 0 for the player's own fighters.
  function value(s, a, cand, def, H) {
    const t = R(s), stage = s.rules?.spirit?.stage ?? 3;
    if (stage < 1 || !aiSide(s, a)) return 0;
    const c = cached(s, a.side);
    if (!c) return 0;   // the round hook owns the cache; the decider never writes state
    const role = c.roles?.[a.id];
    const fw = t.roleFocus?.[role] ?? 1, pw = t.roleProtect?.[role] ?? 1;
    let v = 0;
    const tid = targetId(s, cand, H);
    if (tid && tid === c.signals.focus && (cand.type === "strike" || (cand.type === "ability" && def && def.target === "enemy"))) v += t.focusBonus * fw;
    if (tid && tid === c.signals.protect && cand.type === "ability" && def && PROTECTIVE.includes(def.effect)) v += t.protectBonus * pw;
    if (tid && c.signals.protect && (cand.type === "strike" || (cand.type === "ability" && def && def.target === "enemy"))) {
      const p = s.actors[c.signals.protect], f = s.actors[tid];
      if (p && f && f.side !== a.side && dist(s, p.x, p.y, f.x, f.y) <= 2) v += t.protectBonus * pw;
    }
    if ((s.rules?.spirit?.stage ?? 3) >= 3 && cand.type === "observe" && c.roles?.[a.id] === "scout" && (c.coherence ?? 3) >= 2) v += t.focusBonus;   // the scout's eyes
    return Math.max(-t.spiritCap, Math.min(t.spiritCap, v));
  }

  const maxReach = (s, a, H) => {
    let r = 1;
    try { r = Math.max(r, H?.strikeRange?.(s, a) || 1); } catch { /* host lacks it */ }
    try { for (const id of H?.abilitiesOf?.(a) || []) r = Math.max(r, H?.C?.abilities?.[id]?.range || 0); } catch { /* host lacks it */ }
    return r;
  };
  // Spacing: no two allies adjacent at turn end (the protect it guards is exempt); ranged units dislike ending grabbed.
  function spacingValue(s, a, to, H) {
    const t = R(s), stage = s.rules?.spirit?.stage ?? 3;
    if (stage < 2 || !aiSide(s, a) || !to) return 0;
    const c = cached(s, a.side);
    let v = 0;
    for (const u of Object.values(s.actors)) {
      if (u.defeated || u.id === a.id) continue;
      if (Math.abs(u.x - to[0]) + Math.abs(u.y - to[1]) !== 1) continue;
      if (u.side === a.side && u.id !== c?.signals?.protect) v -= t.spacingAlly;
      else if ((s.rules?.spirit?.stage ?? 3) >= 3 && u.side === a.side && u.id === c?.signals?.protect && c.roles?.[a.id] === "screen" && (c.coherence ?? 3) >= 2) v += t.spacingAlly;   // the screen holds by its protect
      else if (u.side !== a.side && u.side !== "bystander" && !veiled(u) && maxReach(s, a, H) > 1) v -= t.spacingFoe;
    }
    return v;
  }
  // Tempo: while outnumbered or hidden, a weak best is worth waiting out — unless the bar is full.
  function holdThreshold(s, a) {
    const t = R(s), stage = s.rules?.spirit?.stage ?? 3;
    if (stage < 2 || !aiSide(s, a)) return 0;
    if ((a.tempo ?? 0) >= (a.tempoCapacity ?? 100)) return 0;   // a full bar always fires
    const c = cached(s, a.side);
    if (!c) return 0;
    return (c.stance === "outnumbered" || c.stance === "hidden") ? t.tempoHold : 0;
  }

  return { TUNABLES, enabled, conducted, aiSide, knownFoes, stanceOf, assess, assignRoles, roundHook, cached, acted, onDeath, onExit, canAdmin, greedOpen, greedMul, value, spacingValue, holdThreshold, TELEGRAPH, PROTECTIVE };
});
