"use strict";
// Salvage economy (Muse, Wave 3 custody; SPEC: muse-wave3 SALVAGE.md).
// Trash → treasure: trawl refuse for parts (generous basics, rare rares —
// the Pit provides, never apex!). Seeded + auditable: every pull carries
// provenance (source, battle), sources deplete, drift respawns slowly.
// Pure store + functions; pulled parts are data the caller routes into
// crafting at conservation (M1). Store is account-safe.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSalvage = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SALVAGE = { common: 0.70, uncommon: 0.95, driftEvery: 5 };
  const TIERS = ["common", "uncommon", "rare"];
  // mulberry32, stateful: seeded, auditable, farmable-but-fair.
  const createStore = (seed = 1) => ({ seed, rngState: seed >>> 0, sources: {}, log: [] });
  const roll = (store) => {
    let a = store.rngState | 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    store.rngState = a >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tierOf = (r) => r < SALVAGE.common ? "common" : r < SALVAGE.uncommon ? "uncommon" : "rare";
  const better = (a, b) => TIERS.indexOf(b) > TIERS.indexOf(a) ? b : a;

  // Register a source. battlefield: once (pulls 1). pile: N pulls (seeded).
  // drift: regens +1 every driftEvery battles up to max. carcass: rolls
  // twice, keeps better (hunt-to-harvest premium).
  function register(store, { id, kind, pulls, max }) {
    if (!id || store.sources[id]) return { error: !id ? "source needs an id" : `${id} already registered` };
    if (!["battlefield", "pile", "drift", "carcass"].includes(kind))
      return { error: `kind is battlefield, pile, drift, or carcass (got ${kind})` };
    store.sources[id] = { id, kind, pulls: pulls ?? 1, max: max ?? pulls ?? 1 };
    return { ok: true };
  }

  // Pull: roll the table (trashSight bumps one tier — the sight sees
  // through trash). Rare yields apex BITS, never full apex items.
  function pull(store, { source, trashSight = false, battle = 0 }) {
    const s = store.sources[source];
    if (!s) return { error: `${source} is not a source` };
    if (s.pulls <= 0) return { error: `${source} is depleted` };
    let tier = tierOf(roll(store));
    if (s.kind === "carcass") tier = better(tier, tierOf(roll(store)));
    if (trashSight) tier = TIERS[Math.min(2, TIERS.indexOf(tier) + 1)];
    const kind = tier === "common" ? (roll(store) < 0.5 ? "scrap" : "parts")
      : tier === "uncommon" ? "components" : "apex-bits";
    s.pulls -= 1;
    const item = { tier, kind, provenance: source, battle };
    store.log.push(item);
    return { ok: true, item, pullsLeft: s.pulls };
  }

  // Drift tick: slow respawn (Orbit drift — Kaiba's fireflies).
  function tick(store, { battle = 0 } = {}) {
    store.tickLog ??= [];
    // Hardening (relay-1000): one tick per battle — a re-run for the same
    // battle regens nothing. Regen ticks land in tickLog, never the item
    // log, so audit() keeps reading pulls only.
    if (battle > 0 && store.tickedAt != null && battle <= store.tickedAt)
      return { ok: true, regened: 0, guarded: true };
    let regened = 0;
    for (const s of Object.values(store.sources)) {
      if (s.kind === "drift" && battle > 0 && battle % SALVAGE.driftEvery === 0 && s.pulls < s.max) {
        s.pulls += 1; regened += 1;
      }
    }
    if (battle > 0) store.tickedAt = battle;
    store.tickLog.push({ battle, regened });
    return { ok: true, regened };
  }

  // Audit: pulls-out must never exceed pulls-in per source. Dupes flagged.
  function audit(store) {
    const out = {};
    for (const item of store.log) out[item.provenance] = (out[item.provenance] || 0) + 1;
    const violations = [];
    for (const [id, n] of Object.entries(out)) {
      const s = store.sources[id];
      const allowed = s ? (s.max + (s.kind === "drift" ? n : 0)) : 0; // drift regens: allow logged
      if (!s) violations.push(`${id}: pulls from an unregistered source`);
      else if (s.kind !== "drift" && n > s.max) violations.push(`${id}: ${n} pulls from ${s.max} (dupes!)`);
    }
    return { ok: violations.length === 0, violations };
  }

  return { SALVAGE, createStore, register, pull, tick, audit };
});
