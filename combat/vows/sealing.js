"use strict";
// Sealing (SPEC wave2-sealing): bind a foe into a vessel, and inheritance (a student loan paid in LEVELS).
//
// Vessels pack from the account stash at battle start (takePack: min(stash, caps)); unspent
// vessels return at settle (returnPouch). An empty stash still yields the free apprentice shard.
// Higher tiers hold bigger foes: a shard holds a minor foe, a bead a worthy foe, an orb a boss.
// The engine picks the smallest fitting vessel the pouch still holds.
//
// Catching (sealBeast): the foe must be gated — HELD (grappled), BROKEN (willpower gone —
// Presence synergy), or WILLING (persuaded at parley). A willing foe walks in (automatic); else
// the willing roll is 5% + 2% per 10% missing LF, capped at 95%. The 10 ΦF offering is spent on
// the attempt whether it holds or not; the vessel is spent only when the seal holds.
//
// A sealed foe stands down for the rest of the fight (status.sealedBeast; AI treats standDown as
// out — same as parley). The bind DROPS if the sealer is defeated or flees (both statuses clear,
// the foe stands back up), if the sealed foe is smashed (any LF damage breaks it: the vessel is
// eaten, per the sim), or on the roundHook escape roll (5%, +5% if the sealer is bloodied).
//
// Catching pays at battle end: finishCaught lists sealed foes still bound; the UI converts each
// into +1 swallowed-bead progress toward that creature (account.beadSwallows, learned at the
// beads.js thresholds: wild 3, dream 4, big 5). A seal is a bead earned, not a duplicate track.
//
// Inheritance (grantTechnique): a standing ally may be granted one of YOUR techniques (any of
// your available abilities — pick the recipient, pick the technique). The technique rides
// ally.learned for THIS battle only: nothing writes it back to the account yet, so no level is
// charged (audit 1.3.448; loop 1a17ca7b95d restores the level price once grants persist).
// AI never grants (player ritual).
//
// Duy's rule (NQ3: declarations gate ALL death-priced kits): a death-priced seal opens ONLY to
// protect something precious. Declare the ward first (Rituals ▸, one live declaration per sealer,
// re-declaring replaces); it holds this battle while the ward lives. A dead ward, another sealer's
// declaration, or none at all: the Reaper stays shut.
//
// Reaper's Seal (reaperSeal): the mutual seal. The sealer dies; the foe is caught outright — no
// bind to drop, death-powered and permanent (counts as a catch at battle end). Requires a live
// Duy declaration plus a gate and a fitting vessel like any seal (spent), plus the 10 ΦF offering.
// AI never.
//
//   RULES                                → tuners (all provisional; Mala tunes)
//   pouch(s)                             → s.vessels (apprentice shard when absent)
//   takePack(stash)                      → pouch (packs min(stash, caps); mutates stash)
//   returnPouch(stash, pouch)            → stash (unspent vessels go home; free shard dissolves)
//   vesselFor(foe)                       → "shard" | "bead" | "orb" (smallest that holds)
//   gateOf(s, foe)                       → "held" | "broken" | "willing" | null
//   catchChance(s, foe)                  → 1 (willing) or 0.05..0.95
//   seal(s, sealer, foe)                 → { ok, vessel?, chance?, text } | { ok: false, error }
//   unseal(s, foe, why)                  → clears the bind ("bind-dropped" | "smashed" | "escaped")
//   grant(s, granter, ally, abilityId)   → { ok, text } | { ok: false, error }
//   declare(s, by, ward)                 → { ok, text } | { ok: false, error } (name the precious ward)
//   declarationOf(s, by)                 → live declaration or null (dead ward = expired)
//   reaper(s, sealer, foe)               → { ok, vessel, text } | { ok: false, error }
//   roundHook(s)                         → escape rolls for sealed foes
//   breakWill hook                       → a will-broken foe is sealable (gateOf reads willpower)
//   smashHook(s, foe, amount)            → unseals when a sealed foe takes LF damage
//   onSealerDown(s, sealer)              → drops every bind the sealer holds
//   finishCaught(s)                      → [{ key, name }] sealed foes still bound at battle end
//   finishDebt(s)                        → levels owed for inheritances (0 until grants persist)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSealing = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = {
    offeringPhi: 10,             // ΦF spent on every seal attempt (the beast eats first)
    vesselKit: { shard: 1, bead: 0, orb: 0 },   // unfitted fallback: the apprentice shard (packed pouches come from the stash via takePack)
    bigLf: 80,                   // maxLF at/above this needs a bead (matches beads.js bigLF)
    baseChance: 0.05,            // unwilling roll starts here
    missingStep: 0.10,           // ...+2% per 10% missing LF
    missingBonus: 0.02,
    capChance: 0.95,
    escapeChance: 0.05,          // ...per round, +5% while the sealer is bloodied
    escapeBloodiedBonus: 0.05,
    inheritanceLevels: 1,        // levels the granter owes per technique granted
    sealAp: 25,                  // tempo to attempt a seal (a technique's weight)
    grantAp: 20,                 // tempo to pass down a technique
    reaperAp: 50,                // tempo to tie the mutual knot
    declareAp: 20,               // tempo to name a precious ward (Duy declaration)
    pouchCaps: { shard: 3, bead: 2, orb: 1 },   // stash → pouch loadout caps (vessel economy)
  };
  const VESSELS = ["shard", "bead", "orb"];
  const VESSEL_NAME = { shard: "Binding shard", bead: "Sealing bead", orb: "Nesting orb" };
  function pouch(s) {
    if (!s.vessels) s.vessels = { ...RULES.vesselKit, free: 1 };   // no packed pouch (fixtures, direct calls): the apprentice shard only — the free 2/2/1 kit ended with the vessel economy
    return s.vessels;
  }
  function takePack(stash) {   // battle start: pack min(stash, caps); the apprentice shard appears iff the stash holds no shard (ruling 1)
    const st = stash || {}, hadShard = (st.shard || 0) > 0, pouch = { shard: 0, bead: 0, orb: 0, free: 0 };
    for (const v of VESSELS) { const n = Math.min(st[v] || 0, RULES.pouchCaps[v]); pouch[v] = n; if (st[v] != null) st[v] -= n; }
    if (!hadShard) { pouch.shard += 1; pouch.free = 1; }
    return pouch;
  }
  function returnPouch(stash, pouch) {   // battle settle: unspent vessels go home; a surviving free shard dissolves (it was never real)
    const st = stash || {}, p = pouch || {};
    for (const v of VESSELS) st[v] = Math.max(0, (st[v] || 0) + (p[v] || 0) - (v === "shard" && p.free ? 1 : 0));
    return st;
  }
  function isBoss(f) { return !!(f?.boss || f?.isBoss || f?.rank === "boss"); }
  function vesselFor(foe) {
    if (isBoss(foe)) return "orb";
    return (foe?.maxLF || 0) >= RULES.bigLf ? "bead" : "shard";
  }
  function vesselHolds(vessel, need) { return VESSELS.indexOf(vessel) >= VESSELS.indexOf(need); }
  function smallestOwned(s, need) {
    const p = pouch(s);
    return VESSELS.find((v) => vesselHolds(v, need) && (p[v] || 0) > 0) || null;
  }
  function gateOf(s, foe) {
    if (!foe || foe.defeated) return null;
    if (foe.persuaded) return "willing";
    if (foe.status?.grappled) return "held";
    if ((foe.willpower ?? foe.maxWillpower ?? 1) <= 0) return "broken";
    return null;
  }
  function catchChance(s, foe) {
    if (gateOf(s, foe) === "willing") return 1;
    const max = foe?.maxLF || 1, missing = Math.max(0, 1 - (foe?.lf ?? max) / max);
    return Math.min(RULES.capChance, RULES.baseChance + Math.floor(missing / RULES.missingStep + 1e-9) * RULES.missingBonus);
  }
  function spendOffering(s, sealer) {
    sealer.pf = Math.max(0, (sealer.pf ?? 0) - RULES.offeringPhi);
  }
  // Spend one vessel from the pouch. The apprentice shard (pouch.free) goes first when a shard is spent: its catch is
  // practice, kept for bead progress but never sold (Mala, 2026-10-27: "free shard can't be sold").
  function spendVessel(s, vessel) {
    const p = pouch(s); p[vessel] -= 1;
    if (vessel === "shard" && p.free) { p.free = 0; return true; }
    return false;
  }
  function bind(s, sealer, foe, vessel, free = false) {
    foe.standDownUntil = 9999;
    foe.status = foe.status || {};
    foe.status.sealedBeast = { label: "Sealed", by: sealer.id, vessel, round: s.round, ...(free ? { free: true } : {}) };
  }
  function unseal(s, foe, why) {
    if (!foe?.status?.sealedBeast) return null;
    const vessel = foe.status.sealedBeast.vessel;
    foe.status.sealedBeast = null;
    if (foe.standDownUntil === 9999) foe.standDownUntil = null;
    const lines = {
      "bind-dropped": `${foe.name} stands back up: the bind dropped with its sealer.`,
      smashed: `${foe.name} breaks out — and EATS the ${vessel}. Gone.`,
      escaped: `${foe.name} slips the ${vessel} and stands back up.`,
    };
    return { vessel, text: lines[why] || lines["escaped"] };
  }
  function seal(s, sealer, foe) {
    if (!foe || foe.defeated) return { ok: false, error: "There is nothing left to seal." };
    if (foe.side === sealer.side) return { ok: false, error: "Seals are for foes. Grant a technique instead." };
    if (foe.status?.sealedBeast) return { ok: false, error: `${foe.name} is sealed already.` };
    const gate = gateOf(s, foe);
    if (!gate) return { ok: false, error: `${foe.name} must be held, will-broken, or willing first.` };
    const need = vesselFor(foe), vessel = smallestOwned(s, need);
    if (!vessel) return { ok: false, error: `No vessel in the pouch can hold ${foe.name} (needs ${VESSEL_NAME[need]} or better).` };
    if ((sealer.pf ?? 0) < RULES.offeringPhi) return { ok: false, error: `The offering is ${RULES.offeringPhi} ΦF. The beast eats first.` };
    spendOffering(s, sealer);
    const chance = catchChance(s, foe);
    const roll = chance >= 1 ? true : typeof s.chance === "function" ? s.chance(chance) : Math.random() < chance;
    if (!roll) return { ok: false, kept: true, chance, text: `${foe.name} refuses the ${vessel} (${Math.round(chance * 100)}%). The vessel is unspent; the offering is eaten.` };
    bind(s, sealer, foe, vessel, spendVessel(s, vessel));
    const gateLine = gate === "willing" ? "walks in willingly" : gate === "held" ? "is bound struggling" : "is too broken to refuse";
    return { ok: true, vessel, chance, text: `${foe.name} ${gateLine}: sealed in a ${VESSEL_NAME[vessel]}. Out of the fight while the bind holds.` };
  }
  function grant(s, granter, ally, abilityId) {
    if (!ally || ally.defeated) return { ok: false, error: "Grant to a standing ally." };
    if (ally.id === granter.id) return { ok: false, error: "The grant needs a student: pick an ally, not yourself." };
    if (ally.side !== granter.side) return { ok: false, error: "Foes get seals. Allies get inheritances." };
    if (!abilityId) return { ok: false, error: "Pick the technique to pass down." };
    ally.learned = Array.isArray(ally.learned) ? ally.learned : [];
    if (ally.learned.includes(abilityId)) return { ok: false, error: `${ally.name} carries that technique already.` };
    ally.learned.push(abilityId);
    // The level price waits until a grant persists past the battle (nothing writes ally.learned back to the account yet; audit
    // 1.3.448). Until then the inheritance lasts this battle and costs nothing permanent.
    return { ok: true, text: `${ally.name} inherits ${abilityId} for this battle.` };
  }
  function declare(s, by, ward) {
    if (!ward || ward.defeated) return { ok: false, error: "Name a living ward to protect." };
    if (ward.id === by.id) return { ok: false, error: "The ward is someone precious — not yourself." };
    if (ward.side !== by.side) return { ok: false, error: "The ward stands beside you: name an ally." };
    (s.wards ||= {})[by.id] = { ward: ward.id, round: s.round };   // own field: s.declarations is the vow ledger (array)
    return { ok: true, text: `${by.name} names ${ward.name} precious: the Reaper will open for them.` };
  }
  function declarationOf(s, by) {
    const d = s.wards?.[by.id];
    if (!d) return null;
    const ward = s.actors[d.ward];
    if (!ward || ward.defeated || ward.side !== by.side) { delete s.wards[by.id]; return null; }   // the protected died or changed sides: expired
    return d;
  }
  function reaper(s, sealer, foe) {
    if (!declarationOf(s, sealer)) return { ok: false, error: "Name a precious ward first (Rituals ▸ Declare): the Reaper opens only to protect something precious." };
    if (!foe || foe.defeated) return { ok: false, error: "There is nothing left to seal." };
    if (foe.side === sealer.side) return { ok: false, error: "The Reaper's seal is for foes." };
    const gate = gateOf(s, foe);
    if (!gate && !foe.status?.sealedBeast) return { ok: false, error: `${foe.name} must be held, will-broken, or willing first.` };
    const need = vesselFor(foe), vessel = smallestOwned(s, need);
    if (!vessel) return { ok: false, error: `No vessel in the pouch can hold ${foe.name}.` };
    if ((sealer.pf ?? 0) < RULES.offeringPhi) return { ok: false, error: `The offering is ${RULES.offeringPhi} ΦF. The beast eats first.` };
    spendOffering(s, sealer);
    bind(s, sealer, foe, vessel, spendVessel(s, vessel));
    foe.caughtByReaper = true;   // death-powered: no bind to drop, caught outright at battle end
    sealer.lf = 0; sealer.defeated = true;
    return { ok: true, vessel, text: `${sealer.name} seals ${foe.name} in a ${VESSEL_NAME[vessel]} — and dies with the knot tied. No bind to drop: death-powered, permanent.` };
  }
  function roundHook(s) {
    const out = [];
    for (const id of Object.keys(s.actors || {})) {
      const f = s.actors[id];
      const mark = f?.status?.sealedBeast;
      if (!mark || f.defeated || f.caughtByReaper) continue;
      const sealer = s.actors[mark.by];
      let p = RULES.escapeChance;
      if (sealer && (sealer.lf ?? 1) < (sealer.maxLF || 1) / 2) p += RULES.escapeBloodiedBonus;
      const roll = typeof s.chance === "function" ? s.chance(p) : Math.random() < p;
      if (roll) out.push({ foe: id, ...unseal(s, f, "escaped") });
    }
    return out;
  }
  function smashHook(s, foe, amount) {
    if ((amount || 0) <= 0 || !foe?.status?.sealedBeast || foe.caughtByReaper) return null;
    return { foe: foe.id, ...unseal(s, foe, "smashed") };
  }
  function onSealerDown(s, sealer) {
    const out = [];
    for (const id of Object.keys(s.actors || {})) {
      const f = s.actors[id];
      if (f?.status?.sealedBeast?.by === sealer.id && !f.caughtByReaper && !f.defeated) {
        out.push({ foe: id, ...unseal(s, f, "bind-dropped") });
      }
    }
    return out;
  }
  function finishCaught(s) {
    const out = [];
    for (const id of Object.keys(s.actors || {})) {
      const f = s.actors[id];
      if (f?.status?.sealedBeast && !f.defeated) out.push({ key: f.character || f.id, name: f.name, maxLF: f.maxLF || 0, dream: !!f.dream, boss: isBoss(f), ...(f.status.sealedBeast.free ? { free: true } : {}) });
    }
    return out;
  }
  function finishDebt(s) { return s.inheritanceDebt || 0; }
  return { RULES, VESSELS, VESSEL_NAME, pouch, takePack, returnPouch, vesselFor, gateOf, catchChance, seal, unseal, grant, declare, declarationOf, reaper, roundHook, smashHook, onSealerDown, finishCaught, finishDebt };
});
