"use strict";
// Charge: the one helper every ultimate-charge gain flows through (chargeUltimate). Concept use builds charge;
// alternating the two equipped concepts adds the pair bonus; traits, auras and dreams adjust or refuse it.
// A part of the Concept Combat engine, moved out of engine.js on 2026-11-11 to keep the core under its line limit
// (BUILD-PLAN-2026-11-09 R2, loop 1a1c3f0ee06). It is installed first, so every later part finds H.chargeUltimate.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).charge = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  const { Auras, conceptName, dreamSpaceRules, log } = H;
  function chargeUltimate(s, a, concept, reason, bonus = 0, utilityMultiplier = 1, classAuraRecharge = false, borrowedOk = false, sealMul = 1) {
    if (!concept || (concept !== a.primary && concept !== a.secondary && !borrowedOk)) return;
    if (dreamSpaceRules && !dreamSpaceRules.chargeGainAllowed(a, s.dreamSpace)) return;
    if (Auras && Auras.chargeFrozen(a) && !classAuraRecharge) return;   // Auras: class modifiers may explicitly permit a bounded gain
    const base = s.rules.ultimateChargePerConcept;
    const pair = concept !== a.lastChargeConcept && a.lastChargeConcept != null ? s.rules.ultimateChargePairBonus : 0;
    const before = a.ultimateCharge;
    const chargeMul = (a.passives?.ultimateChargeMul || 1) * ((a.traits || []).some((t) => (t?.id || t) === "sampler") ? 0.5 : 1);   // Sampler halves every ultimate charge (Mala, 2026-10-18)
    const gain = Math.round((base + pair + bonus) * utilityMultiplier * chargeMul * (Auras?.chargeMul?.(a) ?? 1) * sealMul);   // sealMul: tea-sealed rite ink (Tea T1)
    a.ultimateCharge = Math.min(s.rules.ultimateChargeMax, before + gain);
    a.lastChargeConcept = concept;
    if (a.ultimateCharge > before) log(s, { kind: "charge", actor: a.id,
      text: `${a.name} builds ${a.ultimateCharge - before} ultimate charge (${a.ultimateCharge}/${s.rules.ultimateChargeMax}).`,
      why: [reason, pair ? `Alternating ${conceptName(concept)} with the other equipped concept adds ${pair}.` : "Charge comes from concept use, not damage.", bonus ? `Resolved composition effect adds ${bonus}.` : "", utilityMultiplier !== 1 ? `Successful utility action charge ×${utilityMultiplier}.` : "", classAuraRecharge ? "Maid's Service Cycle converts cleaned residue into charge while her Selectivity aura is active." : "", chargeMul !== 1 ? `Character traits adjust charge gained ×${chargeMul} (${gain} total).` : "", sealMul !== 1 ? `Tea-sealed rite ink: charge ×${sealMul}.` : ""] });
  }
  // Tea T1: the seal's multiplier for a use that draws rite ink, read before the ink spends (commit and reaction charges come first).
  const sealMulFor = (a, ability) => (a?.riteAugment?.checked?.[ability] && a.riteAugment.charges > 0 ? a.riteAugment.ultMul || 1 : 1);
  return { chargeUltimate, sealMulFor };
});
