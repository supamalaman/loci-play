// Talk orders + Admiration (Group Spirit Half 2; SPEC codex-spirit-order).
// Stacks on Half 1 (spirit.js assessment/stance/signals): an order
// is a role (and a target) the ally weighs into its own choices for 3 rounds, never a write to the spirit's signals; compliance weighs bond × fit ×
// sense; deeds feed respect; trust remembers. Pure where it can be:
// battle state in s.trust / s.deeds / s.respectSeed, account carry in
// carryOpts / settleOrders. Lazy-loads like spirit.js (no engine install).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatOrders = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const Spirit = () => { try { if (typeof module === "object" && module.exports) return require("./spirit.js"); } catch {} return (typeof self !== "undefined" ? self.ConceptCombatSpirit : null); };
  const ROLES = ["strike", "screen", "scout", "admin", "focus"];
  const R = (s) => s.rules?.orders || {};
  const clamp5 = (n) => Math.max(-5, Math.min(5, n));
  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const beside = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
  const living = (u) => !!u && !u.defeated && !u.notArrived;
  const pairKey = (s, doerId, watcherId) => `${s.actors?.[doerId]?.character || doerId}>${s.actors?.[watcherId]?.character || watcherId}`;
  const active = (order, round) => !!order && round <= order.until;

  // The living witness, in-group only (SPEC: the fallen and the late see nothing).
  function watchers(s, side, excludeIds = []) {
    return Object.values(s.actors || {}).filter((u) => u.side === side && living(u) && !excludeIds.includes(u.id)).map((u) => u.id);
  }
  function deed(s, doerId, watcherId, n) {
    const d = s.actors?.[doerId], w = s.actors?.[watcherId];
    if (!d || !w || d.side !== w.side || !living(w)) return;   // in-group, living witnesses only
    const k = pairKey(s, doerId, watcherId);
    s.deeds = s.deeds || {};
    s.deeds[k] = clamp5((s.deeds[k] || 0) + n);
  }
  // Respect: the carried seed plus this battle's deeds, clamped ±5.
  function respectOf(s, doerId, watcherId) {
    const d = s.actors?.[doerId], w = s.actors?.[watcherId];
    if (!d || !w || d.side !== w.side) return 0;
    return clamp5(((s.respectSeed || {})[pairKey(s, doerId, watcherId)] || 0) + ((s.deeds || {})[pairKey(s, doerId, watcherId)] || 0));
  }

  // Trust: per ordered pair on effective bond. Decays 1 per battle without
  // orders toward zero from above; negatives stand until new orders move them.
  const trustKey = (s, byId, toId) => pairKey(s, byId, toId);
  function trustOf(s, byChar, toChar) {
    if (!byChar || !toChar) return 0;   // an uncharacterised unit (no stable id across battles) has no trust record, never an "undefined>undefined" one
    const rec = s.trust?.[`${byChar}>${toChar}`];
    if (!rec) return 0;
    const v = rec.v || 0;
    if (v <= 0) return clamp5(v);
    return Math.max(0, v - Math.max(0, (s.orderBattles || 0) - (rec.last || 0)));
  }
  function bumpTrust(s, byChar, toChar, d) {
    if (!byChar || !toChar) return;
    s.trust = s.trust || {};
    const k = `${byChar}>${toChar}`;
    s.trust[k] = { v: clamp5(trustOf(s, byChar, toChar) + d), last: s.orderBattles || 0 };   // bumps land on the effective (decayed) value
  }

  // Fit: the SAME assessment Half 1 uses (LF, range, kit), read per role.
  // Strike/focus fit everyone; screen wants a standing body; scout wants
  // light feet; admin wants a back line. All Mala-tunable via RULES.orders.
  function fitOf(s, to, role) {
    const lfFrac = (to.lf ?? 0) / Math.max(1, to.maxLF || 100);
    if (role === "strike" || role === "focus") return 1;
    if (role === "screen") return clamp01((to.maxLF || 100) / 100) * clamp01(lfFrac * 1.5);
    if (role === "scout") return clamp01(1.2 - (to.maxLF || 100) / 120) * (0.5 + 0.5 * clamp01(lfFrac));
    if (role === "admin") {
      const crowded = Object.values(s.actors || {}).some((u) => u.side !== to.side && living(u) && beside(to, u));
      return crowded ? 0.3 : 1;
    }
    return 0;
  }
  // Sense: the order against the stance. Nonsense reads instantly.
  const SENSE = {
    attack: { hidden: 0.25, outnumbered: 0.5, even: 1, winning: 1.2 },
    screen: { hidden: 0.8, outnumbered: 1.2, even: 1, winning: 0.8 },
    scout: { hidden: 1.2, outnumbered: 1, even: 0.8, winning: 0.6 },
    admin: { hidden: 1, outnumbered: 0.3, even: 1, winning: 1.2 },
  };
  function senseOf(s, to, role) {
    const kind = role === "strike" || role === "focus" ? "attack" : role;
    const stance = s.spirit?.[to.side]?.stance || "even";
    return (SENSE[kind] || {})[stance] ?? 1;
  }
  // Compliance: bond mirrors the advice constants (threshold/weight/max);
  // effective bond is valence + respect + trust. Weight = bond × fit × sense.
  function compliance(s, by, to, role, H) {
    const r = R(s), th = r.threshold ?? 2, wt = r.weight ?? 3, mx = r.max ?? 6;
    const raw = (H.Factions?.valence(s, to, by) ?? 0) + respectOf(s, by.id, to.id) + trustOf(s, by.character, to.character);
    const bond = (to.traits || []).some((t) => (t?.id || t) === "stubborn") || raw < th ? 0 : Math.min(mx, wt * (raw - th + 1));
    const fit = fitOf(s, to, role), sense = senseOf(s, to, role);
    const w = bond * fit * sense, bar = r.complyBar ?? 3, near = r.nearMiss ?? 1.5;
    const verdict = w >= bar ? "obey" : w >= bar - near ? "partial" : "refuse";
    const weak = bond === 0 ? "bond" : fit < 0.5 ? "fit" : "sense";
    return { w, bond, fit, sense, verdict, weak };
  }
  const REFUSALS = {
    bond: (t, role) => `${t} doesn't take orders from strangers — not that one, not today.`,
    fit: (t, role) => `${t} shakes their head: ${role === "screen" ? "this body won't hold a line" : role === "scout" ? "these feet won't run it" : "not built for that work"}.`,
    sense: (t, role) => `${t} looks at the field and won't: ${role === "admin" ? "no one tends gear while the side bleeds" : "that order dies here"}.`,
  };
  const refusalLine = (to, weak, role) => (REFUSALS[weak] || REFUSALS.bond)(to.name || "They", role);
  const ORDER_LINES = { strike: "Strike", screen: "Screen the line", scout: "Scout ahead", admin: "Tend the works", focus: "Focus" };

  function issue(s, by, to, role, focus, H) {
    if (!ROLES.includes(role)) return { ok: false, error: `No such order: ${role}. (Strike, Screen, Scout, Admin, Focus Target.)` };
    if (!to || to.defeated || to.side !== by.side || to.id === by.id) return { ok: false, error: "Orders go to a living ally." };
    if (role === "focus") {
      const f = s.actors?.[focus];
      if (!f || f.defeated || f.side === by.side) return { ok: false, error: "Focus Target needs a living foe." };
    }
    const c = compliance(s, by, to, role, H);
    if (c.verdict === "refuse") {
      const line = refusalLine(to, c.weak, role);
      H.log(s, { kind: "order", actor: by.id, target: to.id, refused: true, text: line });
      return { ok: true, refused: true, line };
    }
    to.order = { role, focus: role === "focus" || role === "strike" ? focus || null : null, by: by.id, until: s.round + ((s.rules?.orders?.rounds ?? 3) - 1), ...(c.verdict === "partial" ? { partial: true } : {}) };
    if (c.fit >= 0.6) bumpTrust(s, by.character, to.character, 1);   // obeyed-and-fitting banks +1
    const line = c.verdict === "partial"
      ? `${to.name} half-nods: a probe, not a charge. (${ORDER_LINES[role]}${to.order.focus ? ` ▸ ${s.actors[to.order.focus]?.name}` : ""}, partial.)`
      : `${by.name}: "${ORDER_LINES[role]}${to.order.focus ? ` ▸ ${s.actors[to.order.focus]?.name}` : ""}." ${to.name} nods.`;
    H.log(s, { kind: "order", actor: by.id, target: to.id, text: line });
    return { ok: true, partial: c.verdict === "partial", line };
  }

  // OR-02: targets resolve through the same seam the normal scorer uses (Half 1's
  // targetId): an ID stays an ID, [x, y] reads whoever stands on the aim tile.
  function targetId(s, cand, H) {
    if (!cand) return null;
    if (typeof cand.target === "string") return cand.target;
    if (Array.isArray(cand.target) && H?.actorAt) { const u = H.actorAt(s, cand.target[0], cand.target[1]); return u ? u.id : null; }
    return null;
  }
  // The order's weight at decision time (ai.js score term): the state steers
  // only while the weight clears — a shifted field quietly unmakes an order.
  function orderValue(s, a, cand, def, H) {
    if (!active(a.order, s.round)) return 0;
    const r = R(s), by = s.actors?.[a.order.by];
    if (!by || by.defeated) return 0;
    const c = compliance(s, by, a, a.order.role, H);
    if (c.w < (r.complyBar ?? 3) - (r.nearMiss ?? 1.5)) return 0;
    const mult = (c.w >= (r.complyBar ?? 3) ? 1 : 0.5) * (a.order.partial ? 0.5 : 1) * (r.roleBonus ?? 4);
    const tid = targetId(s, cand, H), t = tid ? s.actors?.[tid] : null;
    const hitsFoe = t && t.side !== a.side && (cand.type === "strike" || cand.type === "ability");
    switch (a.order.role) {
      case "strike":
      case "focus": return a.order.focus ? (tid === a.order.focus && hitsFoe ? mult : 0) : (hitsFoe ? mult * 0.5 : 0);
      case "screen": {
        const guarding = cand.type === "guard";
        const pid = s.spirit?.[a.side]?.signals?.protect, p = pid ? s.actors?.[pid] : null;
        const threat = hitsFoe && p && !p.defeated && Math.abs(p.x - t.x) + Math.abs(p.y - t.y) <= 2;
        return guarding || threat ? mult : 0;
      }
      case "scout": {
        const looking = cand.type === "observe" || cand.type === "observeSelf" || String(cand.type || "").startsWith("journal");
        const finish = hitsFoe && t && (t.lf ?? 0) < (t.maxLF || 100) * 0.25;
        return looking || finish ? mult : 0;
      }
      case "admin": return ["meditate", "cook", "salvageVerb", "items"].includes(cand.type) ? mult : 0;
      default: return 0;
    }
  }

  // ── Deeds (Admiration) ──
  function onHit(s, src, tgt, dmg, H) {
    if (!src || !tgt || src.side == null || dmg < (tgt.maxLF || 100) * 0.25) return;   // a big shot: one hit ≥ 25% of the victim
    for (const w of watchers(s, src.side, [src.id])) deed(s, src.id, w, 2);
  }
  function onMove(s, a, from, H) {
    const formed = (u) => u.side !== a.side && living(u) && !u.routed;   // first of the side to close with a formed enemy
    if (!Object.values(s.actors || {}).some((u) => formed(u) && beside(a, u))) return;
    if (Object.values(s.actors || {}).some((u) => u.side === a.side && u.id !== a.id && living(u) &&
      Object.values(s.actors || {}).some((v) => v.side !== a.side && living(v) && beside(u, v)))) return;
    for (const w of watchers(s, a.side, [a.id])) deed(s, a.id, w, 1);
  }
  function onProtect(s, protectorId, H) {
    const p = s.actors?.[protectorId]; if (!p) return;
    for (const w of watchers(s, p.side, [protectorId])) deed(s, protectorId, w, 1);
  }
  function onSave(s, saviorId, H) {
    const p = s.actors?.[saviorId]; if (!p) return;
    for (const w of watchers(s, p.side, [saviorId])) deed(s, saviorId, w, 2);
  }
  function onDeath(s, u, H) {
    if (!u || u.side == null) return;
    const allies = watchers(s, u.side, [u.id]);
    s.deedDrops = s.deedDrops || {};
    if (!s.deedDrops[u.side] && allies.length) {   // dropped first: the side's first fall
      s.deedDrops[u.side] = true;
      for (const w of allies) deed(s, u.id, w, -1);
    }
    for (const a of allies) {   // ally lost adjacent: survivors beside the fall answer for it to the rest
      if (!beside(s.actors[a], u)) continue;
      for (const w of allies) if (w !== a) deed(s, a, w, -1);
    }
    if (u.order?.by && s.actors?.[u.order.by]) bumpTrust(s, s.actors[u.order.by].character, u.character, -2);   // obeyed-but-disastrous: the ordered fall costs two
  }
  function roundHook(s, H) {
    s.routDeeded = s.routDeeded || {};
    for (const u of Object.values(s.actors || {})) {   // rout while watched, with allies still fighting
      if (!u.routed || s.routDeeded[u.id]) continue;
      s.routDeeded[u.id] = true;
      for (const w of watchers(s, u.side, [u.id])) deed(s, u.id, w, -2);
    }
    const SP = Spirit();
    s.shotsCalled = s.shotsCalled || {};
    for (const side of new Set(Object.values(s.actors || {}).map((u) => u.side))) {
      if (side === "player" || s.shotsCalled[side]) continue;   // the player conducts their own; each leader calls it once a battle
      const cache = SP?.cached(s, side, H);
      const leader = Object.values(s.actors || {}).find((u) => u.side === side && living(u) && SP?.cached(s, side)?.roles?.[u.id] === "leader");
      const focus = cache?.signals?.focus;
      if (!leader || !focus || !s.actors?.[focus] || s.actors[focus].defeated) continue;
      let issued = false;
      for (const id of watchers(s, side, [leader.id])) {
        const ally = s.actors[id];
        const c = compliance(s, leader, ally, "focus", H);
        if (c.verdict === "refuse") continue;   // AI orders use the same weighing, silently
        ally.order = { role: "focus", focus, by: leader.id, until: s.round + ((s.rules?.orders?.rounds ?? 3) - 1), ...(c.verdict === "partial" ? { partial: true } : {}) };
        issued = true;
      }
      if (issued) { s.shotsCalled[side] = true; H.log(s, { kind: "order", actor: leader.id, text: `${leader.name} is calling the shots: all eyes on ${s.actors[focus].name}.` }); }
    }
  }

  // AI Sight I3: the first study of an enemy side is its intentions and the unit's role.
  // The second is the structure, the leader and who they cover. A later study repeats the current read.
  const TEAM_ROLE = {
    screen: (name) => `${name} holds the line for them.`,
    striker: (name) => `${name} is their blade.`,
    scout: (name) => `${name} ranges ahead.`,
    admin: (name) => `${name} minds the takings.`,
  };
  const ROLE_ORDER = ["leader", "screen", "scout", "admin", "striker"];
  const COUNT_WORD = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const countWord = (n) => COUNT_WORD[n] || String(n);
  const capWord = (w) => w ? w[0].toUpperCase() + w.slice(1) : w;
  function sideLiving(s, side) {
    return Object.values(s.actors || {}).filter((u) => u.side === side && living(u) && !u.husk);
  }
  function concealed(u) {
    return !!u && !u.defeated && !!u.status?.concealed && (u.status.concealed.until == null || u.status.concealed.until >= u.ownerTurns);
  }
  function visible(s, id) {
    const u = id ? s.actors?.[id] : null;
    if (!u || u.defeated || concealed(u)) return null;
    return u;
  }
  function rolePhrase(role, n) {
    if (n === 1) return `${role === "admin" ? "an" : "a"} ${role}`;
    return `${countWord(n)} ${role}s`;
  }
  function structureLine(roles, us) {
    const counts = {};
    for (const u of us) {
      const role = roles?.[u.id];
      if (role !== "leader" && !TEAM_ROLE[role]) continue;
      counts[role] = (counts[role] || 0) + 1;
    }
    const parts = ROLE_ORDER.filter((role) => counts[role]).map((role) => rolePhrase(role, counts[role]));
    if (!parts.length) return null;
    const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
    const n = Object.values(counts).reduce((sum, c) => sum + c, 0);
    return `${capWord(countWord(n))} fight as one: ${list}.`;
  }
  function unled(s, side, us) {
    if (side === "bystander" || us.length < 2) return false;
    // u.gaia is already unconducted. A joined Gaia sets boss, which conducted() does not read.
    if (us.some((u) => u.boss === "gaia")) return true;
    const SP = Spirit();
    return !!(SP?.conducted && !SP.conducted(s, side));
  }
  function observeNotes(s, a, t) {
    const out = [];
    if (t.side === a.side) {
      const r = respectOf(s, a.id, t.id);
      if (r >= 3) out.push(`${t.name} looks up to you.`);
      else if (r <= -2) out.push(`${t.name} has stopped listening.`);
      return out;
    }
    const SP = Spirit();
    const us = sideLiving(s, t.side);
    const cache = SP?.cached?.(s, t.side) || null;
    const focusLine = () => {
      const focus = visible(s, cache?.signals?.focus);
      if (focus) out.push(`Their eyes are all on ${focus.name}.`);
    };
    if (us.length < 2) {
      focusLine();
      return out;
    }
    if (unled(s, t.side, us)) {
      out.push("They fight as strangers. No one leads.");
      return out;
    }
    s.spiritRead = s.spiritRead || {};
    const step = (s.spiritRead[t.side] || 0) + 1;
    s.spiritRead[t.side] = step;
    if (step === 1 || step >= 3) {
      const sentence = cache?.stance && SP?.TELEGRAPH?.[cache.stance];
      if (sentence) out.push(sentence);
      focusLine();
      const role = cache?.roles?.[t.id];
      if (role && TEAM_ROLE[role] && !concealed(t)) out.push(TEAM_ROLE[role](t.name));
    }
    if (step >= 2 && cache) {
      const structure = structureLine(cache.roles, us);
      if (structure) out.push(structure);
      const leader = visible(s, Object.keys(cache.roles || {}).find((id) => cache.roles[id] === "leader"));
      if (leader) out.push(`${leader.name} leads them.`);
      const cover = visible(s, cache.signals?.protect);
      if (cover) out.push(`They are covering ${cover.name}.`);
    }
    return out;
  }

  // Account carry: trust rides whole; respect halves between battles.
  const halve = (n) => (n > 0 ? Math.floor(n / 2) : n < 0 ? Math.ceil(n / 2) : 0);
  function carryOpts(account) {
    const trust = JSON.parse(JSON.stringify(account?.trust || {}));
    const respect = {};
    for (const [k, v] of Object.entries(account?.respect || {})) { const h = halve(v); if (h) respect[k] = h; }
    return { trust, respect, battles: account?.battles || 0 };
  }
  function settleOrders(account, s) {
    const lines = [], respect = {};
    for (const k of new Set([...Object.keys(s.respectSeed || {}), ...Object.keys(s.deeds || {})])) {
      const v = clamp5(((s.respectSeed || {})[k] || 0) + ((s.deeds || {})[k] || 0));
      if (v) respect[k] = v;
    }
    if (Object.keys(respect).length) lines.push(`Respect settles: ${Object.entries(respect).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(", ")}.`);
    return { account: { ...account, trust: JSON.parse(JSON.stringify(s.trust || {})), respect }, lines };
  }

  return { ROLES, active, watchers, deed, respectOf, trustOf, bumpTrust, fitOf, senseOf, compliance, refusalLine, issue, orderValue, onHit, onMove, onProtect, onSave, onDeath, roundHook, observeNotes, carryOpts, settleOrders };
});