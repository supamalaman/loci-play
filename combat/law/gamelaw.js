"use strict";
// Game-law events (Muse, Wave 3 custody; SPEC: muse-wave3 FORMS.md).
// Greed/Culling port: admins post binding rule-contracts for an event,
// players legislate mid-event (100pts), sets win, breaches go to trial.
// Pure state + functions; the engine owns when (Rituals/Talk rows are
// integrator follow-ups). Rules are PUBLIC; sunset kills them with the event.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatGameLaw = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = { legislateCost: 100 };
  const createStore = () => ({ events: {}, activeForm: null });

  // Admin posts the event: rules up front, sets to win, points start at 0.
  // Rule: { id, text, kind: "ban" (tags[]), "objective" ({set, need}), "term" (match acts) }.
  function openEvent(store, { id, adminId, rules = [], sets = [] }) {
    if (!id || store.events[id]) return { error: !id ? "event needs an id" : "event already open" };
    store.events[id] = { id, adminId, rules: rules.map((r) => ({ ...r, by: adminId })),
      sets, points: {}, log: [`${adminId} posts ${rules.length} rule(s). Posted = law.`] };
    return { ok: true };
  }

  // ONE active FORM per battle/event (registry enforces one — no stacking).
  function activate(store, eventId) {
    if (!store.events[eventId]) return { error: "no such event" };
    if (store.activeForm && store.activeForm !== eventId)
      return { error: `another FORM already rules this battle (${store.activeForm})` };
    store.activeForm = eventId;
    return { ok: true };
  }

  function postRule(store, eventId, rule, by) {
    const e = store.events[eventId];
    if (!e) return { error: "no such event" };
    if (by !== e.adminId) return { error: "only the admin posts rules" };
    e.rules.push({ ...rule, by });
    e.log.push(`${by} posts: ${rule.text}`);
    return { ok: true };
  }

  // Legislation: any player spends 100 event points to ADD a rule mid-event
  // (via the referee's seat — the seat itself is integrator UI).
  function legislate(store, eventId, rule, playerId) {
    const e = store.events[eventId];
    if (!e) return { error: "no such event" };
    const have = e.points[playerId] || 0;
    if (have < RULES.legislateCost)
      return { error: `legislation costs ${RULES.legislateCost}pts (have ${have})` };
    e.points[playerId] = have - RULES.legislateCost;
    e.rules.push({ ...rule, by: playerId });
    e.log.push(`${playerId} legislates (${RULES.legislateCost}pts): ${rule.text}`);
    return { ok: true };
  }

  function awardPoints(store, eventId, playerId, n, why) {
    const e = store.events[eventId];
    if (!e) return { error: "no such event" };
    e.points[playerId] = (e.points[playerId] || 0) + n;
    e.log.push(`${playerId} +${n}pts${why ? ` (${why})` : ""}.`);
    return { ok: true };
  }

  // Breach detection: an act against the posted rules. Act shapes:
  // { kind: "technique", tags: [...] }, { kind: "theft", ... }, { kind: "custom", ruleId }.
  // Returns breach descriptors ready for trial auto-file.
  function checkBreach(store, eventId, act) {
    const e = store.events[eventId];
    if (!e) return [];
    const out = [];
    for (const r of e.rules) {
      if (r.kind === "ban" && act.kind === "technique" && (r.tags || []).some((t) => (act.tags || []).includes(t)))
        out.push({ ruleId: r.id, label: `${r.text} (banned)`, severity: 1 });
      if (r.kind === "term" && r.match === act.kind)
        out.push({ ruleId: r.id, label: `${r.text} (breach)`, severity: r.severity ?? 2 });
    }
    return out;
  }

  // Sets: collect N of a set = win (Exodia-shaped).
  function checkSet(store, eventId, collection) {
    const e = store.events[eventId];
    if (!e) return { win: false };
    const have = {};
    for (const c of collection || []) have[c] = (have[c] || 0) + 1;
    for (const s of e.sets) {
      if ((have[s.set] || 0) >= s.need) return { win: true, set: s.set };
    }
    return { win: false };
  }

  // Sunset: event rules die with the event. No lingering law.
  function closeEvent(store, eventId) {
    if (!store.events[eventId]) return { error: "no such event" };
    delete store.events[eventId];
    if (store.activeForm === eventId) store.activeForm = null;
    return { ok: true };
  }

  return { RULES, createStore, openEvent, activate, postRule, legislate, awardPoints, checkBreach, checkSet, closeEvent };
});
