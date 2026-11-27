"use strict";
// Magenta Trickster MT1. One thread per owner; Loose Wrist is trait-owned; Witnessed Opening is Playfulness + pair.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatMagenta = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const DEC = "deception", ELA = "elasticity";
  const PAIR = [DEC, ELA];
  const THREAD_MAX = 6, TENSION_CAP = 3, PALM_RANGE = 4;
  const SNAP_BASE = 8, SNAP_PER = 4, SNAP_CAP = 20;
  const RETURN_BASE = 16, RETURN_PER = 4, RETURN_CAP = 28, RETURN_PULL = 2;
  const OPEN_AP = 25, OPEN_PF = 3, PALM_AP = 35, PALM_PF = 4;
  const LOOK_LINE = "You look more interesting";
  const has = (u, t) => (u?.traits || []).some((x) => (typeof x === "string" ? x : x.id) === t);
  const live = (u) => !!u && !u.defeated && !u.notArrived && !u.escaped;
  const pair = (a) => a && a.primary === DEC && a.secondary === ELA;
  const idsOf = (u) => (typeof u === "string" ? u : u?.id);
  const def = (name, concepts, tier, range, more) => ({
    name, concepts, tier, range, cost: more.cost ?? 4, potency: more.potency ?? 0, channel: more.channel ?? null,
    delivery: more.delivery || "line", target: more.target || "enemy", area: { shape: "single" },
    effect: more.effect || "classEffect", classKind: "magenta", effectCategory: more.effectCategory || "conditional",
    mechanism: more.mechanism, targetRule: more.targetRule, prerequisites: more.prerequisites || "Deception + Elasticity equipped.",
    actionCost: more.actionCost ?? (tier === "ultimate" ? 50 : tier === "refined" ? 35 : 25),
    phiForceCost: more.cost ?? 4, potencyDefinition: more.potencyDefinition, timing: more.timing || "immediate",
    expiry: more.expiry || "Thread: owner turn N+2 start; opening: owner turn end.",
    dependencies: ["classes/magenta-trickster.js", "engine/window.js", "engine/actions.js"],
    price: more.price, counter: more.counter, teaches: more.teaches, newEffect: more.newEffect || more.mechanism,
    pairOnly: true, pairs: [PAIR], ...more
  });
  const abilities = {
    palmTheThread: def("Palm the Thread", [DEC], "refined", PALM_RANGE, {
      cost: PALM_PF, potency: 0, channel: null, effect: "classEffect",
      reveal: "Attach one thread. Stretch it by moving farther apart. Breaks beyond 6 tiles or when sight is lost.",
      mechanism: "Palm an elastic thread onto one visible hostile, or onto the unique biggest threat even if they stand with you.",
      potencyDefinition: "No damage. One owner thread at current distance; replacement on a successful new Palm.",
      targetRule: "One visible hostile, or the unique biggest-threat ally, within 4, same Dream, line of sight.",
      price: "35 AP and 4 ΦF, or 25 AP and 3 ΦF with a Witnessed Opening against that target.",
      counter: "Stay out of 4, break sight, or approach so the thread stays slack.",
      teaches: "A thread stores distance, not travel.",
      newEffect: "threadAttach"
    }),
    snapTheThread: def("Snap the Thread", [ELA], "refined", THREAD_MAX, {
      cost: 6, potency: SNAP_BASE, channel: "nigredo", damageType: "nigredo", effect: "damage",
      reveal: "Snap for 8+4t potency. Consumes the thread.",
      mechanism: "Release stored tension as a nigredo line at the linked mark.",
      potencyDefinition: "8 + 4×tension nigredo, maximum 20. Consumes the thread at paid commitment. No pull.",
      targetRule: "The owner's live linked mark within 6 and sight (hostile, or unique biggest-threat ally).",
      price: "35 AP and 6 ΦF. Invalid commands spend nothing.",
      counter: "Approach to slacken, break sight or range 6, or dodge the committed tile.",
      teaches: "Tension is current distance minus attach distance, never path length.",
      newEffect: "threadSnap", pull: 0
    }),
    theLastCardReturns: def("The Last Card Returns", [DEC, ELA], "ultimate", THREAD_MAX, {
      cost: 16, potency: RETURN_BASE, channel: "nigredo", damageType: "nigredo", effect: "damage", merge: true,
      timing: "announced", announce: "The last card comes back along the thread.",
      reveal: "The last card comes back along the thread.",
      mechanism: "Announced line at the linked mark's committed tile; ordinary pull 2 on a resolved hit.",
      potencyDefinition: "16 + 4×tension nigredo, maximum 28, ordinary announcement multiplier once, pull 2 on a resolved hit. Consumes the thread at paid commitment.",
      targetRule: "The owner's live linked mark within 6 and sight (hostile, or unique biggest-threat ally). Ordinary merge charge also applies.",
      price: "50 AP and 16 ΦF plus a full ultimate bar.",
      counter: "Dodge the committed tile, Guard, or break the thread before payment.",
      teaches: "A snapshot freezes tension; walking closer after commitment does not soften it.",
      newEffect: "threadReturn", pull: RETURN_PULL
    })
  };

  function book(s) {
    s.magentaThreads ||= { byOwner: {} };
    s.magentaOpenings ||= { byOwner: {} };
    s.magentaAwards ||= { byOwner: {} };
    s.magentaHunt ||= { byOwner: {} };
    return s;
  }
  function threadOf(s, ownerId) { return s.magentaThreads?.byOwner?.[ownerId] || null; }
  function announceHunt(s, a, t, H) {
    if (!s || s.preview || !pair(a) || !live(a) || !live(t) || t.id === a.id || !H?.log) return;
    book(s);
    if (s.magentaHunt.byOwner[a.id] === t.id) return;
    s.magentaHunt.byOwner[a.id] = t.id;
    H.log(s, {
      kind: "stateScene", actor: a.id, target: t.id, title: t.name, line: LOOK_LINE,
      text: `${a.name}: “${LOOK_LINE}.”`,
      why: [`Next mark: ${t.name}.`]
    });
  }
  function openingOf(s, ownerId) { return s.magentaOpenings?.byOwner?.[ownerId] || null; }
  function tensionOf(s, owner, th, H) {
    if (!th || !owner) return 0;
    const t = s.actors[th.targetId];
    if (!live(t) || !live(owner)) return 0;
    const d = H.dist(s, owner.x, owner.y, t.x, t.y);
    return Math.max(0, Math.min(TENSION_CAP, d - th.d0));
  }
  function hostile(s, a, b, H) {
    return live(b) && a.id !== b.id && a.side !== b.side && !["civilian", "bystander"].includes(a.side) && !["civilian", "bystander"].includes(b.side)
      && !H.Factions?.blocked(s, a, b) && !H.Factions?.blocked(s, b, a) && !H.Parley?.blocks(s, a, b) && !H.Parley?.blocks(s, b, a);
  }
  function betrayLegal(s, a, t) {
    if (!pair(a) || !live(a) || !live(t) || t.id === a.id || a.side !== t.side) return false;
    if (["civilian", "bystander"].includes(a.side) || ["civilian", "bystander"].includes(t.side)) return false;
    const bodies = Object.values(s.actors || {}).filter((u) => live(u) && !["civilian", "bystander"].includes(u.side));
    const top = Math.max(0, ...bodies.map((u) => u.lf || 0));
    return (t.lf || 0) === top && bodies.filter((u) => (u.lf || 0) === top).length === 1;
  }
  function sight(s, a, b, H) {
    return live(a) && live(b) && H.dreamSame(s, a.x, a.y, b.x, b.y) && H.hasSight(s, a.x, a.y, b.x, b.y) && !b.status?.concealed;
  }
  function linkLegal(s, a, t, H, maxRange) {
    if (!live(a) || !live(t) || !pair(a) || (!hostile(s, a, t, H) && !betrayLegal(s, a, t)) || !sight(s, a, t, H)) return false;
    return H.dist(s, a.x, a.y, t.x, t.y) <= maxRange;
  }
  function occupant(s, tx, ty) {
    return Object.values(s.actors || {}).find((u) => live(u) && u.x === tx && u.y === ty) || null;
  }
  function clearThread(s, ownerId, why, H) {
    const th = threadOf(s, ownerId);
    if (!th) return;
    delete s.magentaThreads.byOwner[ownerId];
    const a = s.actors[ownerId];
    if (a && H?.log) H.log(s, { kind: "effect", actor: ownerId, target: th.targetId, text: `${a.name}'s thread ${why}.` });
  }
  function clearOpening(s, ownerId) {
    if (s.magentaOpenings?.byOwner?.[ownerId]) delete s.magentaOpenings.byOwner[ownerId];
  }

  function applyRange(a, m) {
    if (!a || !m || m.magentaLooseWrist) return;
    if (!has(a, "looseWrist")) return;
    if (m.ability === "snapTheThread" || m.ability === "theLastCardReturns") return;
    if (m.delivery !== "line" || (m.area && m.area.shape && m.area.shape !== "single")) return;
    if ((m.target && m.target !== "enemy")) return;
    if ((m.pull || 0) <= 0) return;
    if ((m.effect && m.effect !== "damage")) return;
    const ch = m.damageType || m.channel;
    if (ch !== "nigredo") return;
    if (!(m.range > 0) || (m.tempoCost === 0 && m.cost === 0)) return;
    m.range += 1;
    m.magentaLooseWrist = true;
    (m.notes ||= []).push("Loose Wrist: single-target nigredo line techniques that pull reach 1 tile farther.");
  }

  function manifest(s, a, m, options) {
    if (!a || !m) return;
    applyRange(a, m);
    const id = m.ability;
    const aim = options?.target;
    const occ = Array.isArray(aim) ? occupant(s, aim[0], aim[1]) : null;
    if (id === "palmTheThread") {
      const op = openingOf(s, a.id);
      if (op && occ && op.targetId === occ.id && has(a, "playfulness") && pair(a) && (a.ownerTurns || 0) <= (op.expiresOwnerTurn || 0)) {
        m.tempoCost = OPEN_AP;
        m.cost = OPEN_PF;
        m.magentaOpening = true;
        (m.notes ||= []).push(`Opening: Palm costs ${OPEN_AP} AP / ${OPEN_PF} PF against ${occ.name} this turn.`);
      }
    }
    if (id === "snapTheThread" || id === "theLastCardReturns") {
      const th = threadOf(s, a.id);
      const ten = th ? tensionOf(s, a, th, { dist: (st, x1, y1, x2, y2) => Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)) }) : 0;
      const base = id === "snapTheThread" ? SNAP_BASE : RETURN_BASE;
      const cap = id === "snapTheThread" ? SNAP_CAP : RETURN_CAP;
      m.potency = Math.min(cap, base + SNAP_PER * ten);
      m.magentaTension = ten;
      (m.notes ||= []).push(`Tension ${ten}/3 · snapshotted potency ${m.potency}.`);
      if (id === "theLastCardReturns") (m.notes ||= []).push("Snapshot freezes on commit; dodge its tile or defend.");
    }
  }

  function price(s, a, abilityId, m, options) {
    if (!m.ability) m.ability = abilityId;
    manifest(s, a, m, options || {});
  }

  function beforeAbility(s, a, m) {
    const id = m.id || m.ability;
    if (!abilities[id] && id !== "palmTheThread" && id !== "snapTheThread" && id !== "theLastCardReturns") return null;
    if (abilities[id] && !pair(a)) return "Equip Deception and Elasticity for this technique.";
    if ((id === "snapTheThread" || id === "theLastCardReturns") && !threadOf(s, a.id)) return "No live thread to spend.";
    if (id === "theLastCardReturns" && !pair(a)) return "The last card needs both concepts.";
    return null;
  }

  function gateTarget(s, a, m, tx, ty, H) {
    const id = m.ability || m.id;
    if (id !== "snapTheThread" && id !== "theLastCardReturns") return null;
    if (!pair(a)) return "Equip Deception and Elasticity for this technique.";
    const th = threadOf(s, a.id);
    if (!th) return "No live thread to spend.";
    const t = occupant(s, tx, ty);
    if (!t || t.id !== th.targetId) return "Snap only the linked body.";
    if (!linkLegal(s, a, t, H, THREAD_MAX)) return "The thread does not reach: stay within 6, keep sight, same Dream; the mark must be a hostile or the unique biggest threat.";
    return null;
  }

  function target(s, a, m, tx, ty, H) {
    const id = m.ability || m.id;
    if (id !== "palmTheThread") return null;
    if (!pair(a)) return { ok: false, error: "Equip Deception and Elasticity for this technique." };
    const t = occupant(s, tx, ty);
    if (!t) return { ok: false, error: "Palm a visible hostile, or the unique biggest threat even if they stand with you." };
    if (!hostile(s, a, t, H) && !betrayLegal(s, a, t)) return { ok: false, error: "Palm a hostile, or the unique biggest threat even if they stand with you." };
    if (!sight(s, a, t, H)) return { ok: false, error: "Need a clear view of a visible mark in the same Dream." };
    if (H.dist(s, a.x, a.y, t.x, t.y) > PALM_RANGE) return { ok: false, error: `Palm reaches ${PALM_RANGE} tiles.` };
    return { ok: true, tiles: [[tx, ty]], targets: [t.id] };
  }

  function resolve(s, a, inst, H) {
    if ((inst.ability || inst.id) !== "palmTheThread") return false;
    const t = s.actors[(inst.targets || [])[0]];
    if (!t || !linkLegal(s, a, t, H, PALM_RANGE)) {
      H.log(s, { kind: "miss", actor: a.id, text: `${a.name}'s Palm finds no legal mark; the old thread stays.` });
      return true;
    }
    book(s);
    const d0 = H.dist(s, a.x, a.y, t.x, t.y);
    s.magentaThreads.byOwner[a.id] = { targetId: t.id, d0, expiresOwnerTurn: (a.ownerTurns || 0) + 2 };
    announceHunt(s, a, t, H);
    const betray = betrayLegal(s, a, t);
    H.log(s, { kind: "effect", actor: a.id, target: t.id, tiles: [[t.x, t.y]],
      text: `${a.name} palms a thread onto ${t.name} at distance ${d0}. Stretch it by moving farther apart. Breaks beyond ${THREAD_MAX} tiles or when sight is lost.`,
      why: betray
        ? ["The biggest threat, even on his own side.", "One owner, one thread. Tension is clamp(distance − d0, 0, 3)."]
        : ["One owner, one thread. Tension is clamp(distance − d0, 0, 3)."] });
    return true;
  }

  function commit(s, a, m, H) {
    if (!a || !m || s.preview) return;
    const id = m.id || m.ability;
    book(s);
    if (id === "palmTheThread" && m.magentaOpening) {
      clearOpening(s, a.id);
      H.log?.(s, { kind: "effect", actor: a.id, text: `${a.name} spends the Witnessed Opening: Palm is 25 AP / 3 PF.` });
    }
    if (id === "snapTheThread" || id === "theLastCardReturns") {
      const th = threadOf(s, a.id);
      if (th) {
        m.magentaConsumed = { targetId: th.targetId, tension: m.magentaTension ?? 0, d0: th.d0 };
        clearThread(s, a.id, "is spent with the committed snap", H);
      }
    }
    const mark = s.actors[(m.targets || [])[0]] || s.actors[m.magentaConsumed?.targetId];
    if (mark) announceHunt(s, a, mark, H);
  }

  function onRespond(s, d, act, p, H) {
    if (!p || s.preview || act.response === "none") return;
    if ((s.pendingStack || []).length) return;
    const atk = s.actors[p.attacker];
    const inst = p.inst || {};
    if (!atk || !live(atk) || inst.ability !== "feint" || !inst.announced) return;
    if (!has(atk, "playfulness") || !pair(atk)) return;
    const designated = (inst.targets && inst.targets[0]) || (p.targetId) || occupant(s, ...(inst.aim || inst.target || []))?.id;
    if (!designated || d.id !== designated) return;
    if (act.response === "technique" && act.coverFor && act.coverFor !== designated) return;
    book(s);
    const award = s.magentaAwards.byOwner[atk.id];
    if (award && award.ownerTurn === (atk.ownerTurns || 0) && award.used) return;
    s.magentaAwards.byOwner[atk.id] = { ownerTurn: atk.ownerTurns || 0, used: true };
    s.magentaOpenings.byOwner[atk.id] = { targetId: d.id, expiresOwnerTurn: atk.ownerTurns || 0 };
    H.log?.(s, { kind: "effect", actor: atk.id, target: d.id,
      text: `Opening: Palm costs ${OPEN_AP} AP / ${OPEN_PF} PF against ${d.name} this turn.`,
      why: ["Witnessed Opening: an accepted non-none response to this owner's announced Feint, once per owner turn."] });
  }

  function reconcile(s, H) {
    if (!s) return;
    book(s);
    for (const ownerId of Object.keys(s.magentaThreads.byOwner)) {
      const a = s.actors[ownerId], th = s.magentaThreads.byOwner[ownerId], t = s.actors[th.targetId];
      if (!live(a) || !pair(a) || !live(t) || !linkLegal(s, a, t, H, THREAD_MAX)) clearThread(s, ownerId, "breaks", H);
    }
    for (const ownerId of Object.keys(s.magentaOpenings.byOwner)) {
      const a = s.actors[ownerId], op = s.magentaOpenings.byOwner[ownerId], t = s.actors[op.targetId];
      if (!live(a) || !pair(a) || !has(a, "playfulness") || !live(t) || (!hostile(s, a, t, H) && !betrayLegal(s, a, t))) clearOpening(s, ownerId);
    }
  }

  function turnStart(s, a, H) {
    if (!a) return;
    book(s);
    const th = threadOf(s, a.id);
    if (th && (a.ownerTurns || 0) >= th.expiresOwnerTurn) clearThread(s, a.id, "expires at the second following turn", H);
    const op = openingOf(s, a.id);
    if (op && (a.ownerTurns || 0) > op.expiresOwnerTurn) clearOpening(s, a.id);
    const award = s.magentaAwards.byOwner[a.id];
    if (award && award.ownerTurn !== (a.ownerTurns || 0)) delete s.magentaAwards.byOwner[a.id];
    reconcile(s, H);
  }

  function threatOf(u) { return (u.lf || 0) + (u.maxLF || 0) * 0.01; }
  function aiValue(s, a, cand, H) {
    const id = cand.ability;
    if (id !== "palmTheThread") return null;
    if (!pair(a) || !live(a)) return 0;
    const t = cand.target && occupant(s, cand.target[0], cand.target[1]);
    if (!t || !linkLegal(s, a, t, H, PALM_RANGE)) return 0;
    const foes = Object.values(s.actors).filter((u) => live(u) && hostile(s, a, u, H));
    const lethal = foes.some((u) => u.lf <= 8 && H.dist(s, a.x, a.y, u.x, u.y) <= 4);
    if (lethal) return 0;
    const existing = threadOf(s, a.id);
    if (existing && existing.targetId === t.id) return 1;
    const attachable = Object.values(s.actors).filter((u) => linkLegal(s, a, u, H, PALM_RANGE));
    const biggest = attachable.reduce((best, u) => (threatOf(u) > threatOf(best) ? u : best), attachable[0]);
    const room = 6 - H.dist(s, a.x, a.y, t.x, t.y);
    const canSnap = a.tempo >= 60 && a.pf >= 10;
    const base = canSnap && room >= 1 ? 10 + room : 4;
    const hunt = biggest && t.id === biggest.id ? 8 : 0;
    const retarget = existing && existing.targetId !== t.id && biggest && t.id === biggest.id ? 6 : 0;
    return base + hunt + retarget;
  }

  function view(s, viewer, H) {
    const out = [];
    for (const [ownerId, th] of Object.entries(s.magentaThreads?.byOwner || {})) {
      const a = s.actors[ownerId], t = s.actors[th.targetId];
      if (!live(a) || !live(t)) continue;
      const vis = (!H || !viewer) || (H.hasSight(s, viewer.x, viewer.y, a.x, a.y) && H.hasSight(s, viewer.x, viewer.y, t.x, t.y));
      if (!vis) continue;
      out.push({ ownerId, targetId: th.targetId, from: [a.x, a.y], to: [t.x, t.y], tension: tensionOf(s, a, th, H || { dist: (st, x1, y1, x2, y2) => Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)) }), expiresOwnerTurn: th.expiresOwnerTurn });
    }
    return out;
  }

  return { abilities, PAIR, THREAD_MAX, TENSION_CAP, LOOK_LINE, has, pair, threadOf, announceHunt, openingOf, tensionOf, applyRange, manifest, price, beforeAbility, gateTarget, target, resolve, commit, onRespond, reconcile, turnStart, aiValue, view, book, betrayLegal, hostile, linkLegal };
});
