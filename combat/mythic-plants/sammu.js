"use strict";
// Šammu nikitti, the Spring That Walks (SN1a; spec ~/loci-orbit/ready-to-review/cursor-sammu-nikitti-item-spec/specs/SAMMU_NIKITTI.md;
// R-20261122-38, scope R-20261122-39). Pure rules; the engine owns state, costs and the log.
// This slice holds the portable biology, Juvenescent Sap. The bloom, harvest, root and merges are later slices (SN1-bloom, SN1b-d).
//
//   sapZone(t)                         → the zone Sap mends: the worst injured one, head → arms → legs on a tie; null when unhurt
//   sapBonus(rule, healed, missing)    → extra LF: floor(healed × fraction), capped at rule.cap and the LF still missing
//   sapReady(s, carrier, recipient, R) → may this carrier's Sap still touch this recipient this battle
//   sap(s, carrier, recipient, healed, H) → after a heal that restored `healed` LF (> 0): adds the bonus and mends one grade,
//                                         records the recipient only when something changed; returns { bonus, zone } or null.
//                                         H: { rules, hasTrait, log, Injury }. No Sap event calls Sap again.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSammu = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ORDER = ["head", "arms", "legs"];   // the spec's tie order (the shared Injury.downgrade breaks ties legs-first, so Sap names its zone)
  const grade = (t, z) => t?.injuries?.[z]?.g || 0;

  function sapZone(t) {
    let best = null;
    for (const z of ORDER) if (grade(t, z) > (best ? grade(t, best) : 0)) best = z;
    return best;
  }
  function sapBonus(rule, healed, missing) {
    if (!(healed > 0)) return 0;
    return Math.max(0, Math.min(rule.cap, Math.floor(healed * rule.fraction), missing));
  }
  // The ledger lives on the battle state (saved with it), keyed by carrier: the recipients it has already rejuvenated.
  const ledger = (s, carrier) => ((s.juvenescentSap ||= {})[carrier.id] ||= []);
  function sapReady(s, carrier, recipient, R) {
    if (!carrier || !recipient || recipient.defeated || !(recipient.lf > 0)) return false;
    const used = s.juvenescentSap?.[carrier.id] || [];
    return !used.includes(recipient.id) && used.length < R.recipients;
  }

  function sap(s, carrier, recipient, healed, H) {
    const R = H.rules?.juvenescentSap;
    if (!R || !(healed > 0) || !carrier || carrier.defeated || !H.hasTrait?.(carrier, R.trait)) return null;
    if (!sapReady(s, carrier, recipient, R)) return null;
    const bonus = sapBonus(R, healed, Math.max(0, recipient.maxLF - recipient.lf));
    const zone = sapZone(recipient);
    if (!bonus && !zone) return null;   // nothing would change: the recipient's charge is not spent
    ledger(s, carrier).push(recipient.id);
    if (bonus) recipient.lf += bonus;
    const mended = zone && H.Injury?.downgrade ? H.Injury.downgrade(s, carrier, recipient, zone) : null;
    const left = R.recipients - ledger(s, carrier).length;
    H.log?.(s, { kind: "heal", actor: carrier.id, target: recipient.id, tiles: [[recipient.x, recipient.y]], sap: { bonus, zone: mended?.zone || null },
      text: `Juvenescent Sap: ${recipient.name}${bonus ? ` recovers ${bonus} LF more` : ""}${bonus && mended ? " and" : ""}${mended ? ` mends their ${mended.zone} one grade` : ""}.`,
      why: [`${carrier.name}'s sap renews each living recipient once a battle: +half the healing (at most ${R.cap} LF) and one injury grade. ${left} recipient${left === 1 ? "" : "s"} left this battle.`] });
    return { bonus, zone: mended?.zone || null };
  }

  // SN1b (spec cursor-sammu-nikitti-item-spec, test plan T8): the harvest, the eaten mouthful, and the
  // serpent theft. The account flow (rare invitation, keep/deploy/settle, one serial per account) is a later slice
  // (T1/T10): the serial is tracked inside one battle only, so a harvested root cannot pay twice here.
  const HARVEST = { ap: 30, thorn: 10, minLF: 10 };
  const THEFT_RANGE = 3;
  const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  const isSammuObject = (o) => !!o && o.kind === "plant" && o.type === "sammuNikitti";
  // The tag's home is the class record (classes-data.js medusa extra). Read lazily at call time:
  // classes-data.js never requires this module back, so there is no load cycle in either realm.
  const classRecord = (id) => { try {
    const D = (typeof module === "object" && module.exports) ? require("../classes/classes-data.js") : globalThis.ConceptCombatClassData;
    return (D && D.classes && D.classes[id]) || null;
  } catch { return null; } };
  const tagged = (u, C) => (u.ecology || []).includes("serpentBearer")
    || (C?.characters?.[u.character]?.ecology || []).includes("serpentBearer")
    || classRecord(u.character)?.serpentBearer === true;
  // One record form or the other (observe effects write truceWith/truceUntil; a hired mediator writes truce).
  const pairTruce = (s, x, y) => (x.truceWith === y.id && x.truceUntil >= s.round)
    || (x.truce && x.truce.by === y.id && s.round <= x.truce.until);
  const stoodDown = (s, u, a) => pairTruce(s, u, a) || pairTruce(s, a, u)
    || Object.values(s.actors).some((w) => w.id !== u.id && w.id !== a.id && !w.defeated && w.side === a.side
      && (pairTruce(s, u, w) || pairTruce(s, w, u)));
  // A clone is an object the game's own maker never serialized: makeObject mints `serial` for sammuNikitti, so a
  // hand-built or copied object (no serial, or an explicit clone flag) holds no draught. Awake means a living
  // commune ally still carries this serial: harvest takes the dormant root, never the walking one.
  function harvestError(s, a, obj) {
    if (!isSammuObject(obj)) return "There is no living Šammu nikitti root there.";
    if (obj.dead || !(obj.hp > 0)) return "The Šammu nikitti is dead. There is nothing to harvest.";
    if (obj.serial != null && Object.values(s.actors).some((u) => !u.defeated
      && u.communed?.object?.serial === obj.serial)) return "She walks already: a living commune of this root fights on. Harvest the dormant root, not the walking one.";
    if (!obj.serial || obj.clone) return "Only the genuine planted root can be harvested. Clones and cuttings hold no draught.";
    if (cheb(a.x, a.y, obj.x, obj.y) > 1) return "Stand beside the root to harvest it.";
    if (!(a.lf > HARVEST.minLF)) return "Harvesting takes blood: the harvester needs above 10 LF to pay the thorn price.";
    if ((a.inventory || []).length >= (a.inventoryCapacity ?? 2)) return `Your hands are full (${a.inventoryCapacity ?? 2} slots).`;
    return null;
  }
  function applyHarvest(s, a, obj, H) {
    const spend = H.spendTempo(s, a, HARVEST.ap, "Harvest Šammu nikitti"); if (spend) return spend;
    a.lf -= HARVEST.thorn;
    s.arena.objects = (s.arena.objects || []).filter((o) => o !== obj);
    (a.inventory ||= []).push("sammuNikitti");
    s.sammuTaken = { serial: obj.serial, by: a.id, round: s.round, spent: false };
    H.log(s, { kind: "harvest", actor: a.id, tiles: [[obj.x, obj.y]], item: "sammuNikitti",
      text: `${a.name} pays the thorn price and takes the Šammu nikitti root: one mouthful of rejuvenation.`,
      why: [`30 action points and 10 LF; ${a.lf} LF left.`, `Serial ${obj.serial}: one root, one mouthful, spent once.`] });
  }
  // Stone cannot act (class-runtime.js active(): an until in the past has lapsed).
  const petrified = (u) => u.states?.petrified && (u.states.petrified.until == null || u.states.petrified.until >= u.ownerTurns);
  function thiefFor(s, a, H) {
    const cands = Object.values(s.actors).filter((u) => u.id !== a.id && u.side !== a.side && u.side !== "bystander"
      && a.side !== "bystander" && tagged(u, H.C) && !u.defeated && !u.notArrived && !u.status?.stun
      && !u.states?.incapacitated && !petrified(u) && !stoodDown(s, u, a) && cheb(u.x, u.y, a.x, a.y) <= THEFT_RANGE
      && H.hasSight(s, u.x, u.y, a.x, a.y));
    cands.sort((p, q) => (cheb(p.x, p.y, a.x, a.y) - cheb(q.x, q.y, a.x, a.y)) || (p.id < q.id ? -1 : 1));
    return cands[0] || null;
  }
  const eaterHurt = (t, H) => t.lf < t.maxLF || (H.Injury?.woundedZones(t) || []).length > 0;
  function eatPreview(s, a, act, H) {
    const at = act.target || [a.x, a.y];
    if (at[0] !== a.x || at[1] !== a.y) return { error: "Use it on yourself." };
    if (!eaterHurt(a, H)) return { error: "Life Force is already full." };
    return { thief: thiefFor(s, a, H) };
  }
  function applyEat(s, a, item, thief, H) {
    const t = thief || a;
    a.inventory.splice(a.inventory.indexOf(item), 1);
    t.lf = t.maxLF;
    t.injuries = H.Injury.fresh();
    if (s.sammuTaken && !s.sammuTaken.spent) s.sammuTaken.spent = true;
    if (thief) H.log(s, { kind: "theft", actor: thief.id, target: a.id, item,
      text: `${thief.name} smells the draught and snatches the mouthful: renewed to ${thief.maxLF} LF, every injury cleared. ${a.name} gets none.`,
      why: ["A living hostile serpent within 3 tiles and in sight steals before the eat heals.", "Serial spent: the eater keeps nothing."] });
    else H.log(s, { kind: "item", actor: a.id, item,
      text: `${a.name} eats the Šammu nikitti: renewed to ${a.maxLF} LF, every injury cleared.`,
      why: ["The single stealable mouthful of rejuvenation: one plant, one bite."] });
    H.hermitCharge(s, a, "eat");
  }

  return { sapZone, sapBonus, sapReady, sap, HARVEST, THEFT_RANGE, harvestError, applyHarvest, thiefFor, eatPreview, applyEat };
});
