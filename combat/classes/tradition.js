"use strict";
// "The Opening and the Stand-In": an ORIGINAL fictional encounter inspired by sourced bocio interpretations
// (Surrogate Ward) and Adze motifs (Night Glimmer). Not a documented traditional matchup; provenance per claim
// is in classes-data.js boAdze.claims. Entry, substitution and possession are SEPARATE mechanisms (pack).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./classes-data.js"));
  else root.ConceptCombatTradition = factory(root.ConceptCombatClassData);
})(typeof self !== "undefined" ? self : this, function (CD) {

  // ── Surrogate Ward (proposed concept: Substitution) ──
  // ward = { protects, classes: ["impact", …], capacity, connected, routes? }
  function makeWard({ protects, classes, capacity = 20, routes = null }) {
    return { protects, classes: classes.slice(), capacity, connected: true, routes, used: 0 };
  }
  // incoming = { target, class, amount, resolved, route? }. Redirects BEFORE resolution, by declared class only;
  // nothing is erased: what the object can't hold still reaches the target.
  function redirect(ward, incoming) {
    const pass = (why) => ({ ward, toTarget: incoming.amount, toSurrogate: 0, redirected: false, why });
    if (incoming.resolved) return pass("Already established: new protection isn't retroactive.");
    if (incoming.target !== ward.protects) return pass("Not the protected actor.");
    if (!ward.classes.includes(incoming.class)) return pass(`The ward covers ${ward.classes.join(", ")}, not ${incoming.class}.`);
    if (!ward.connected) return pass("The connection to the surrogate is severed.");
    if (ward.routes && !ward.routes.includes(incoming.route)) return pass("That route isn't covered.");
    const room = ward.capacity - ward.used;
    if (room <= 0) return pass("The surrogate is spent.");
    const taken = Math.min(room, incoming.amount);
    return { ward: { ...ward, used: ward.used + taken }, toTarget: incoming.amount - taken, toSurrogate: taken, redirected: true,
      why: taken < incoming.amount ? "Partly redirected; the rest goes through." : "Redirected to the surrogate." };
  }
  const severWard = (ward) => ({ ...ward, connected: false });
  // Ultimate: many routes, ONE shared capacity.
  const manyApproaches = ({ protects, classes, capacity, routes }) => makeWard({ protects, classes, capacity, routes });

  // ── Night Glimmer (original entity inspired by Adze motifs) ──
  // entrances: [{ id, size: "small" | "large", sealed }]
  function canEnter(form, entrances) {
    const open = entrances.filter((e) => !e.sealed && (form === "small" || e.size === "large"));
    if (!open.length) return { ok: false, why: form === "small" ? "Every eligible opening is sealed. Small isn't a pass through walls." : "Embodied, it needs a full-size way in." };
    return { ok: true, via: open[0].id };
  }
  const forms = {
    small: { force: 2, smallOpenings: true, containable: false },
    embodied: { force: 8, smallOpenings: false, containable: true },
  };
  // Possession: entry, eligibility and a maintained link are separate requirements; bounded permissions; declared expiry.
  function possess({ entered, targetEligible, permissions = ["move"], rounds = 2 }) {
    if (!entered) return { ok: false, why: "No access: entry comes first." };
    if (!targetEligible) return { ok: false, why: "That target isn't eligible." };
    return { ok: true, link: { intact: true, permissions: permissions.slice(0, 2), expires: rounds, completed: [] } };
  }
  function act(link, action) {
    if (!link?.intact) return { link, ok: false, why: "The link is broken." };
    if (!link.permissions.includes(action)) return { link, ok: false, why: `Influence covers ${link.permissions.join(", ")}, not ${action}.` };
    return { link: { ...link, completed: [...link.completed, action] }, ok: true };
  }
  // Severing the necessary link ends dependent influence; already completed effects remain.
  function sever(link) { return { link: { ...link, intact: false }, ended: link.permissions.slice(), remains: link.completed.slice() }; }
  // Suspicion is not proof: no label, no penalty without qualifying evidence.
  function accuse(actor, evidence = []) {
    const qualifying = evidence.filter((e) => e.kind === "observedLink" || e.kind === "confirmedInference");
    return qualifying.length ? { label: "possessed", target: actor.id } : { label: null, target: actor.id, why: "Looking suspicious isn't evidence." };
  }

  return { makeWard, redirect, severWard, manyApproaches, canEnter, forms, possess, act, sever, accuse, data: CD.boAdze };
});
