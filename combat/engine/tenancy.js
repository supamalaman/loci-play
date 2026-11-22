"use strict";
// Exile tenancy in battle (slice T0a, the Aziza slice; spec ~/loci-orbit/ready-to-review/claude-anime-exile-spec/specs/EXILE_TENANCY.md,
// plan ~/loci-orbit/claude/exile-t0a/PLAN.md). A tenant is NOT a summon: it has no body, no turns and no turnsLeft. It lodges with a host
// and lends power. The account (account/tenancy.js) decides who is housed and at what Coherence; a battle receives it as opts.tenant
// { id, coherence } and this part puts a small block on the host, a.tenant. With no opts.tenant every function here does nothing and
// logs nothing, so a host that never tenants plays exactly the battle it played before (spec test T14).
// The block: { id, coherence, hostId, power, rung, label, efficacy, lent, uses, usesMax, rentDue, heldBack }. `hostId` is the host's own id:
// a copy of the host (a mirror, a double) carries the block under another id and so lends nothing (tenantOf, tenantKitOf, tenantBlocked).
//
//   carryTenant(s, opts)        → engine.js createState: the hero gets a.tenant and s.tenancy.host is set, with the round-1 line
//   tenantOf(s, a)              → a.tenant when `a` is the host the tenant lodges with, else null
//   tenantKitOf(a)              → technique ids the lent power adds to abilitiesOf (engine.js formKit): her power from Guest up
//   tenantBlocked(s, a, id, act)→ refusal text for her power (queries.js card, actions-technique.js cast), else null
//   tenantResolve(s, a, inst)   → resolve.js: the step itself, one use, the AP return by rung
//   tenantRent(s, a)            → actions-turn.js guard: the first Guard of the battle is her keep (true = consumed, no guard forms)
//   tenantTurnEnd(s, a)         → turns.js: a way left open and not taken is logged once (the restraint fact the account reads at a win)
// A part of the Concept Combat engine: engine.js installs it with the host object H.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).tenancy = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { C, log, dist } = H;
    const T = () => C.rules.tenancy;
    // The rung table lives in the account module (one place); it is a lazy leaf so no load order matters, node or page.
    const account = () => { try { if (typeof module === "object" && module.exports) return require("../account/tenancy.js"); } catch {} return (typeof self !== "undefined" ? self.ConceptCombatTenancy : null); };
    const nameOf = (id) => T().exiles[id]?.name || id;

    function carryTenant(s, opts) {
      const t = opts && opts.tenant; if (!t || !t.id) return;
      const row = T().exiles[t.id], acc = account(); if (!row || !acc) return;
      const hero = s.actors[s.modeSetup?.hero || "player"]; if (!hero) return;
      const coherence = Math.max(1, Math.min(T().max, Math.floor(+t.coherence || 1))), rung = acc.rungOf(coherence);
      hero.tenant = { id: t.id, coherence, hostId: hero.id, power: row.power, rung: rung.id, label: rung.label, efficacy: rung.efficacy, lent: rung.lends,
        uses: row.uses, usesMax: row.uses, rentDue: !!(rung.lends && row.rent), heldBack: false, ...(t.last ? { last: t.last } : {}), ...(t.borrowed ? { borrowed: true } : {}) };
      s.tenancy = { host: hero.id };
      log(s, { kind: "effect", actor: hero.id, text: `${nameOf(t.id)} lodges with ${hero.name}: ${acc.trackerLine(coherence)}.`, why: ["Exile tenancy: a tenant has no body and no turns; it lends its power from Guest up (Coherence 20)."] });
    }
    const tenantOf = (s, a) => (a && a.tenant && a.tenant.hostId === a.id && s.tenancy && s.tenancy.host === a.id ? a.tenant : null);
    const tenantKitOf = (a) => (a && a.tenant && a.tenant.hostId === a.id && a.tenant.lent ? [a.tenant.power] : []);

    function tenantBlocked(s, a, id, act) {
      const d = C.abilities[id]; if (!d || !d.tenantOnly) return null;
      const t = tenantOf(s, a);
      if (!t || t.power !== id) return "That way is lent to her host alone.";
      if (!t.lent) return "She lends nothing yet.";
      if (t.uses <= 0) return `No way left this battle (${t.usesMax} of ${t.usesMax} walked).`;
      const stuck = H.moveRefusal?.(s, a); if (stuck) return stuck;   // held, rooted, locked: the ways are no way out of a grip (D8)
      const at = act && act.target; if (!at) return null;   // the card greys on the unit alone; the tile is checked when it is aimed
      if (!Array.isArray(at)) return "Choose a tile.";
      if (dist(s, a.x, a.y, at[0], at[1]) > d.range) return `Too far: her way reaches ${d.range} tiles.`;
      const tile = H.tileAt(s, at[0], at[1]);
      if (!tile || tile.blocksMove || H.unitOccupied?.(s, at[0], at[1])) return "That tile is taken.";
      return null;
    }

    function tenantResolve(s, a, inst) {
      const t = tenantOf(s, a); if (!t) return;
      const [tx, ty] = inst.tiles?.[0] || [a.x, a.y], from = [a.x, a.y], price = C.abilities[t.power].tempoCost;
      a.x = tx; a.y = ty; a.moved = true; t.uses -= 1;
      const back = t.efficacy > 0 ? price - Math.round(price / t.efficacy) : 0;   // D4: efficacy multiplies the AP price only; Guest (1.0) returns nothing
      if (back > 0) a.tempo = (a.tempo || 0) + back;
      log(s, { kind: "move", actor: a.id, path: [from, [tx, ty]], text: `${a.name} walks the way ${nameOf(t.id)} lends to (${tx},${ty})${back > 0 ? `: ${back} AP come back at ${t.label}` : ""}.`,
        why: ["A tenant's lent way: a step, not a leap. It provokes nothing; what is on the tile you land on still happens."] });
      H.applyEntryEffects?.(s, a, a, tx, ty);
    }

    function tenantRent(s, a) {
      const t = tenantOf(s, a); if (!t || !t.rentDue) return false;
      t.rentDue = false;
      log(s, { kind: "act", actor: a.id, text: `${a.name} raises a guard and ${nameOf(t.id)} takes it: her keep is the first Guard of each battle. No guard forms, and the turn's Guard is used (no Meditate this turn).`,
        why: ["Exile tenancy, rent: fixed at the lease. It is charged only while she lends her power (Guest and above)."] });
      return true;
    }

    function tenantTurnEnd(s, a) {
      const t = tenantOf(s, a); if (!t || !t.lent || t.heldBack || t.uses < t.usesMax) return;
      const d = C.abilities[t.power];
      if ((a.tempo || 0) + (a.bankedTempo || 0) < d.tempoCost || (a.pf || 0) < d.cost || H.moveRefusal?.(s, a)) return;   // not castable: an idle tenant, not a held-back one
      t.heldBack = true;
      log(s, { kind: "effect", actor: a.id, text: `${a.name} had the way ${nameOf(t.id)} lends open and walked on their own feet.` });
    }

    return { carryTenant, tenantKitOf, tenantOf, tenantBlocked, tenantResolve, tenantRent, tenantTurnEnd };
  })();
});
