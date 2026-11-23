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

  return { sapZone, sapBonus, sapReady, sap };
});
