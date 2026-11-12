"use strict";
// The Mad Scientist's trait laboratory (Mala, 2026-10-17/18; docs/trait-lab.md). In the town's Lab you trade Seeds for
// biology traits, grafted onto your self card for good. Three surgery slots: each graft fills one, and a full set must give
// one up first. Removing a trait (grafted or born with) is the expensive surgery. Any surgery leaves you Woozy for your next
// battle (the anaesthetic): -25 AP on your first two turns and -10% ability damage while it lasts.
// "Powerful, game-altering traits should be costly" (Mala, 2026-10-18): prices climb steeply by tier. A win pays about 50 Seeds.
//
//   catalog                     → { traitId: tier } every trait she can graft
//   price(id) / removalPrice(id)
//   stock(account)              → three offers, rolled after every battle (seeded by account.battles); a grafted slot
//                                 stays { sold: true } until the next battle
//   graft(account, id, { replace })  → { ok, account, reason }   replace: a grafted trait to take out first (full slots)
//   remove(account, id)         → { ok, account, reason }
//   slots(account)              → { used, max }
// Pure functions on the account; the battle reads the self card as it always has, and ui.js applies Woozy at the start.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../insight/insight-data.js"));
  else root.ConceptCombatSurgery = factory(root.ConceptCombatInsightData);
})(typeof self !== "undefined" ? self : this, function (ID) {
  const TIERS = {
    1: { name: "Minor", price: 80 },          // flavour and small edges: about two wins
    2: { name: "Solid", price: 220 },         // a real edge in the right fight
    3: { name: "Strong", price: 520 },        // changes how you fight
    4: { name: "Game-altering", price: 1400 }, // rewrites fights: dozens of wins
  };
  // Biology traits she can graft. Left out: weaknesses (nobody buys those), what you are rather than what you have (robot,
  // immortal, touchedByMagic, dreamTouched, visage, distributedIntelligence), and form-only traits.
  const catalog = {
    survivalInstincts: 1, keenSenses: 1, nightSighted: 1, hardy: 1, ironStomach: 1, highTolerance: 1, resonantVoice: 1, plantKin: 1, twentyTwentyVision: 1,
    fleetFooted: 2, reach: 2, cavalry: 2, vegetativePropagation: 2, stickyFingers: 2, catNap: 2, heavyArmor: 2,
    strongGrip: 3, telekinetic: 3, telepathy: 3, insaneReflexes: 3, cybernetic: 3, superSpeed: 3, superHealing: 3,
    superStrength: 4, superDurability: 4, godlyAgility: 4, theLook: 4, perfectConcentration: 4,
    // Anime theorycraft batch, 2026-10-26 (docs/anime-trait-draft.md Lab valuations). Sold only with a live half
    // (keenSenses precedent): oneBlindSpot is a weakness (below, never sold); typedSoul (aura types), soulLayers
    // (control funnel), pluggedEye (intent system), oldBlood (heritage gates), softSoles (sound detection),
    // filterLungs (air damage), and openVessel (heal funnel) wait unhooked — relist as their systems ship.
    ironJaw: 1, heavyBones: 1, looseFit: 1, deepWells: 1, atlasBones: 1,
    poisonAffinity: 2, crushingHands: 2, gyoEyes: 2, treeWalker: 2, vesselBody: 2, vatGrown: 2, shockEater: 2, redSliver: 2, automailLimb: 2,
    copyEye: 3,
    packMule: 2,   // feats batch, 2026-10-27: carrying, not killing (reach/stickyFingers precedent)
    fourArms: 3,   // feats batch, 2026-10-27: doubles strikes — changes how you fight (strongGrip precedent)
    trepanation: 4,   // grok SPEC, Mala locked 2026-10-28: two-state plus a thinner wall rewrites fights (godlyAgility precedent)
    // gills is not sold. Reference Strong 520 (insight-data.js). Born on the Teal Eel and the Remora Adventurer. Grafting it onto other bodies waits on Mala.
  };
  const WEAKNESSES = new Set(["weakToNigredo", "weakToAlbedo", "weakToCitrinitas", "weakToRubedo", "sinksLikeAStone", "dreamFragile", "supernaturalWeakness", "frail", "oneBlindSpot"]);
  const UNREMOVABLE = new Set(["robot", "immortal", "distributedIntelligence", "visage"]);   // what you are, not a part she can take out
  const rules = { slots: 3, offers: 3, weaknessRemoval: 450, removalMul: 2, minRemoval: 180, woozy: { turns: 2, apLoss: 25, damageMul: 0.9 } };

  const isBiology = (id) => ID.traitCategories.biology.includes(id);
  const price = (id) => TIERS[catalog[id]]?.price ?? null;
  const tierOf = (id) => catalog[id] || null;
  const removalPrice = (id) => WEAKNESSES.has(id) ? rules.weaknessRemoval : Math.max(rules.minRemoval, (price(id) || TIERS[2].price) * rules.removalMul);
  const traitsOf = (a) => a?.self?.traits || [];
  const has = (a, id) => traitsOf(a).some((t) => (t?.id || t) === id);
  const slots = (a) => ({ used: traitsOf(a).filter((t) => t?.grafted).length, max: rules.slots });

  function roll(seed, tag) {
    let h = 2166136261 ^ (seed >>> 0);
    for (const c of String(tag)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296;
  }
  // Three distinct traits you don't have, reshuffled after every battle. One slot always shows a tier 1 or 2, so the shop is
  // never all out of reach.
  // The table is set once per battle completed (Mala, 2026-10-20): what she rolls after a battle stays until the next one,
  // and a slot you graft from stays empty until then. account.labShelf = { battles, ids } (null = sold).
  function rollIds(a) {
    const selfSeed = a?.self?.seed ?? 0;
    // Normal self cards use names or timestamps as seeds. Hash those before adding the battle counter:
    // adding a number to text concatenated it, then roll's >>> 0 collapsed every battle to zero.
    // Keep numeric seeds unchanged so existing numeric-seeded accounts retain their offers.
    const numericSeed = typeof selfSeed === "number" ? selfSeed : Math.floor(roll(0, `lab:self:${selfSeed}`) * 4294967296);
    const seed = (a?.battles || 0) * 7919 + numericSeed;
    const pool = Object.keys(catalog).filter((id) => !has(a, id));
    const cheap = pool.filter((id) => catalog[id] <= 2), out = [];
    const pick = (list, tag) => { const left = list.filter((id) => !out.includes(id)); if (left.length) out.push(left[Math.floor(roll(seed, tag) * left.length)]); };
    pick(cheap, "lab:cheap");
    for (let i = 0; out.length < Math.min(rules.offers, pool.length) && i < 20; i++) pick(pool, `lab:${i}`);
    return out;
  }
  const shelf = (a) => (a?.labShelf && a.labShelf.battles === (a.battles || 0) ? a.labShelf.ids.slice() : rollIds(a));
  const frozen = (a, ids) => ({ battles: a.battles || 0, ids });
  function stock(a) {
    return shelf(a).map((id, slot) => id ? { id, slot, tier: catalog[id], tierName: TIERS[catalog[id]].name, price: price(id), name: ID.traits[id]?.name || id, text: ID.traits[id]?.text || "" }
      : { sold: true, slot });
  }
  const entry = (id) => ({ id, name: ID.traits[id]?.name || id, kind: "trait", depth: 1, category: "biology", text: ID.traits[id]?.text || "", apparent: true, known: true, grafted: true });

  function remove(a, id) {
    if (!has(a, id)) return { ok: false, account: a, reason: "You don't have that trait." };
    if (!isBiology(id)) return { ok: false, account: a, reason: "She only operates on the body: that trait isn't biology." };
    if (UNREMOVABLE.has(id)) return { ok: false, account: a, reason: "That isn't a part. It's what you are." };
    const cost = removalPrice(id);
    if ((a.seeds || 0) < cost) return { ok: false, account: a, reason: `Removal costs ${cost} Seeds (you have ${a.seeds || 0}).` };
    return { ok: true, account: { ...a, seeds: a.seeds - cost, woozy: true, self: { ...a.self, traits: traitsOf(a).filter((t) => (t?.id || t) !== id) }, labShelf: a.labShelf?.battles === (a.battles || 0) ? a.labShelf : frozen(a, shelf(a)) }, cost };   // a removal never reshuffles today's table
  }
  function graft(a, id, { replace = null } = {}) {
    if (!catalog[id]) return { ok: false, account: a, reason: "She can't graft that." };
    if (has(a, id)) return { ok: false, account: a, reason: "You already have it." };
    const table = shelf(a);
    if (!table.includes(id)) return { ok: false, account: a, reason: "That isn't on her table today. It restocks after your next battle." };
    let acct = a, total = price(id);
    if (slots(a).used >= rules.slots) {
      if (!replace) return { ok: false, account: a, reason: `All ${rules.slots} surgery slots are full: choose a graft to take out first.` };
      if (!traitsOf(a).some((t) => (t?.id || t) === replace && t.grafted)) return { ok: false, account: a, reason: "Only a grafted trait can make room." };
      total += removalPrice(replace);
      if ((a.seeds || 0) < total) return { ok: false, account: a, reason: `Out with the old and in with the new costs ${total} Seeds (you have ${a.seeds || 0}).` };
      acct = remove(a, replace).account;
      acct = { ...acct, seeds: acct.seeds + removalPrice(replace) };   // charged once below, with the graft
    }
    if ((a.seeds || 0) < total) return { ok: false, account: a, reason: `${ID.traits[id]?.name || id} costs ${total} Seeds (you have ${a.seeds || 0}).` };
    return { ok: true, account: { ...acct, seeds: a.seeds - total, woozy: true, self: { ...acct.self, traits: [...traitsOf(acct), entry(id)] }, labShelf: frozen(a, table.map((x) => (x === id ? null : x))) }, cost: total };
  }

  return { TIERS, catalog, WEAKNESSES, rules, price, tierOf, removalPrice, stock, graft, remove, slots, isBiology };
});
