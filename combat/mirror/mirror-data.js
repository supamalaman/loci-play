"use strict";
// Enemies observing the player, and resolving trauma (Mala, 2026-10-08). Plain data. Staged here while Codex
// holds ~/loci/web/combat; destined for ~/loci/web/combat/insight/. Numbers PROVISIONAL.
//
// Johari does the balancing:
//   - enemies can only find traits that are APPARENT to others (your Open and Blind panes); Hidden and Unknown stay yours;
//   - your Blind spots are the dangerous ones: they can use them and you don't see it coming;
//   - once you know a trait yourself (Observe Self moves it Blind → Open), their exploit is telegraphed and lands
//     half as often. A resolved trauma can't be exploited at all: it has become a strength.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatMirrorData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const rules = {
    observe: { minAP: 10, maxAP: 30, apPerPoint: 10, carryCap: 3 },     // enemies look less hard than you can
    knownByPlayer: { chanceMul: 0.5, telegraph: true },
    memory: "perCharacter",                                             // an enemy character remembers what it learned about you, across battles
  };

  // New trauma traits to append to insight-data.js self.catalog on integration (each matches a dream monster).
  const catalogAdditions = [
    { id: "fearOfPursuit",  name: "Fear of being chased", kind: "fear", depth: 3, text: "When something follows you, you stop thinking and run." },
    { id: "fearOfScarcity", name: "Fear of scarcity",     kind: "fear", depth: 3, text: "You hoard what you have, even when spending it would save you." },
    { id: "overwhelmed",    name: "Overwhelmed by crowds", kind: "fear", depth: 3, text: "Too many things at once and you freeze." },
    { id: "stuckInRoutine", name: "Stuck in routine",     kind: "fear", depth: 3, text: "You repeat what worked last time, even after it stops working." },
  ];

  // What an enemy who has noticed each of your traits can do. cost = their AP. chance before the known-trait penalty.
  // Strengths give no exploit, only an AI hint (they learn not to bother).
  const exploits = {
    restless:      { name: "Trap the step",      cost: 15, chance: 0.6, effect: { trapForwardTile: true, potencyMul: 1.25 }, text: "They arm the tile you'll step onto after you land a hit." },
    impulsive:     { name: "Startle",            cost: 15, chance: 0.5, effect: { nextAbilityCostAdd: 15 }, text: "A sudden feint: your next ability costs 15 more AP." },
    hesitant:      { name: "Beat you to it",     cost: 10, chance: 0.6, effect: { firstResponseVsUltimate: true }, text: "They get the first response to your next ultimate." },
    distractible:  { name: "Drop something",     cost: 10, chance: 0.5, effect: { apLoss: 10 }, text: "A glint on the ground: you lose 10 AP looking." },
    protective:    { name: "Hurt the weak one",  cost: 0,  chance: 1,   effect: { targetPreference: "playerWeakestAlly", chargeOnAllyHitMul: 1.5 }, text: "They go after your summon or weakest ally, and hurting it builds their ultimate faster." },
    loyalSelf:     { name: "Pin your ally",      cost: 15, chance: 0.5, effect: { playerMustCoverAlly: true }, text: "They threaten your ally so you spend AP covering it." },
    proudSelf:     { name: "Taunt",              cost: 15, chance: 0.55, effect: { forcePlayerToward: true }, text: "A challenge you can't ignore: you're drawn toward them next turn." },
    competitive:   { name: "Dangle a rival",     cost: 10, chance: 0.5, effect: { forcePlayerToward: "strongestEnemy" }, text: "You're drawn to their strongest fighter, away from the real threat." },
    cautious:      { name: "Press while you wait", cost: 0, chance: 1,  effect: { aiHint: "pressureEarly" }, text: "They push hard early, knowing you'll hold back your best move." },
    curiousSelf:   { name: "Show you something", cost: 10, chance: 0.45, effect: { apLoss: 10 }, text: "Something interesting and harmless: you lose 10 AP looking at it." },
    generous:      { name: "Make you share",     cost: 15, chance: 0.4,  effect: { playerItemToAlly: true }, text: "They hurt an ally so you spend your item on them." },
    reckless:      { name: "Bait the trade",     cost: 15, chance: 0.55, effect: { counterHitMul: 1.25 }, text: "They set up a counter-hit for when you overcommit." },
    quickTempered: { name: "Provoke",            cost: 10, chance: 0.45, effect: { nextAbilityCostAdd: 10 }, text: "They needle you into reacting before you have settled on a plan." },
    apologetic:    { name: "-",                  cost: 0,  chance: 0,    effect: { aiHint: "expectRepair" }, text: "No exploit: they leave room for you to make amends." },
    genius:        { name: "-",                  cost: 0,  chance: 0,    effect: { aiHint: "respectPatternReader" }, text: "No exploit: they learn too quickly for a repeated trick to work." },
    fool:          { name: "Offer a feint",      cost: 10, chance: 0.35, effect: { nextAbilityCostAdd: 10 }, text: "A misleading opening pulls you into an avoidable mistake." },
    believer:      { name: "-",                  cost: 0,  chance: 0,    effect: { aiHint: "respectSummonThreat" }, text: "No exploit: once the rare call is made, the wild creature becomes a threat to every side." },
    devoutBeliever:{ name: "-",                  cost: 0,  chance: 0,    effect: { aiHint: "respectDreamSummon" }, text: "No exploit: a devout believer's Dream Space call is dangerous on its own." },
    fullBeliever:  { name: "-",                  cost: 0,  chance: 0,    effect: { aiHint: "respectPowerfulDreamSummon" }, text: "No exploit: a full believer may bring several powerful Dream Space creatures into the fight." },
    convertedBeliever:{ name: "-",               cost: 0,  chance: 0,    effect: { aiHint: "unstableDreamSummons" }, text: "No exploit: their conviction is dangerous, but the creatures answer the Dream Space rather than their orders." },
    convertedDevout:{ name: "-",                  cost: 0,  chance: 0,    effect: { aiHint: "unstableDreamSummons" }, text: "No exploit: tentative belief gives power, but Dream Space creatures do not follow orders." },
    unexplainedEvent:{ name: "-",                 cost: 0,  chance: 0,    effect: { aiHint: "rationalizesAnomaly" }, text: "No exploit: they explain away the impossible for now; more evidence may sway them." },
    nonBeliever:   { name: "-",                  cost: 0,  chance: 0,    effect: { aiHint: "summonsArePredictable" }, text: "No exploit: experience with summons is a defensive advantage, not a weakness." },
    collaborative:{ name: "-",                  cost: 0,  chance: 0,    effect: { aiHint: "watchTeamwork" }, text: "No exploit: teamwork is a strength, not a weakness." },
    rivalrous:     { name: "Dangle a rival",     cost: 10, chance: 0.35, effect: { forcePlayerToward: "strongestEnemy" }, text: "They draw your attention toward the strongest opponent." },
    afraidOfFalling:{ name: "Fight at the edge", cost: 0,  chance: 1,    effect: { nearLedge: { climbCostMul: 1.5, knockbackAdd: 1 } }, text: "They fight you near ledges and bridges: your climbs cost more and their shoves push one tile further." },
    needsApproval: { name: "Mock",               cost: 10, chance: 0.5, effect: { questionExtraWrongChoice: 1 }, text: "A sneer: your next summon or Name it question shows an extra wrong choice." },
    selfDoubt:     { name: "Second-guess",       cost: 10, chance: 0.5, effect: { questionExtraWrongChoice: 1 }, text: "They question you: your next question shows an extra wrong choice." },
    perfectionist: { name: "Rattle you early",   cost: 0,  chance: 1,   effect: { aiHint: "hitHardRoundOne" }, text: "They go all in early; an early setback stays with you." },
    fearOfPursuit: { name: "Chase",              cost: 0,  chance: 1,   effect: { aiHint: "pursue", playerMoveCostMulWhenAdjacent: 1.25 }, text: "They follow you: moving away from an adjacent enemy costs 25% more." },
    fearOfScarcity:{ name: "Make you hold back", cost: 0,  chance: 1,   effect: { aiHint: "attrition" }, text: "A long fight: you're slower to spend items." },
    overwhelmed:   { name: "Swarm",              cost: 0,  chance: 1,   effect: { aiHint: "surround", apLossWhenSurrounded: 15 }, text: "They crowd you: with 2+ enemies adjacent, you lose 15 AP." },
    stuckInRoutine:{ name: "Read your routine",  cost: 10, chance: 0.6, effect: { freeReactionVsRepeat: true }, text: "They counter the move you used last turn if you use it again." },
    steadyUnderPressure: { name: "-", cost: 0, chance: 0, effect: { aiHint: "dontPressureWhenLow" }, text: "No exploit: they learn not to pressure you when you're low." },
    patternSeeker: { name: "-", cost: 0, chance: 0, effect: { aiHint: "varyChannelsSooner" }, text: "No exploit: they vary their attacks sooner." },
    calm:          { name: "-", cost: 0, chance: 0, effect: { aiHint: "noBluffs" }, text: "No exploit: they stop wasting Deception on you." },
    empathic:      { name: "-", cost: 0, chance: 0, effect: { aiHint: "hideFear" }, text: "No exploit: they hide their fear from you (your Frighten chance vs them doesn't benefit)." },
  };

  // How each enemy trait changes its appetite for studying you.
  const observerBias = { curious: 0.35, complex: 0.2, guarded: 0.1, impatient: -0.3, stubborn: -0.15, proud: -0.1 };

  // Trauma (Mala: "resolving trauma should be a huge buff"). A trauma must be KNOWN (Observe Self) before it can
  // be resolved. Resolve it by facing the dream that embodies it, or by acting through it in a real fight.
  // Reward: catharsis now (full ultimate, heal, a strong 2-turn buff) and, permanently, the fear becomes a strength.
  const catharsis = { ultimateCharge: "full", heal: 25, status: { id: "catharsis", potencyMul: 1.3, apPerTurnAdd: 20, duration: 2 } };
  const traumas = {
    afraidOfFalling: { dream: "last_span",        or: { event: "survivedFall", minDrop: 2 },
      becomes: { id: "sureFooted", name: "Sure-footed", passive: { fallDamageMul: 0, climbCostMul: 0.75, maxLFAdd: 5 }, text: "No fall damage; climbing costs 25% less." } },
    needsApproval:   { dream: "witness_vessel",   or: { event: "resistedExploit", trait: "needsApproval" },
      becomes: { id: "selfPossessed", name: "Self-possessed", passive: { immuneTo: ["proudSelf", "needsApproval", "selfDoubt"], maxLFAdd: 5 }, text: "Taunts, mockery and second-guessing don't work on you." } },
    selfDoubt:       { dream: "amber_host",      or: { event: "correctAnswersInBattle", atLeast: 3 },
      becomes: { id: "selfTrust", name: "Self-trust", passive: { questionWrongChoicesRemove: 1, maxLFAdd: 5 }, text: "Your questions always show one fewer wrong choice." } },
    perfectionist:   { dream: null,               or: { event: "wonAfterEarlyLoss", lfLost: 0.3, byRound: 2 },
      becomes: { id: "resilient", name: "Resilient", passive: { onceBelow30Heal: 20, maxLFAdd: 5 }, text: "Once per battle, when you drop below 30% LF, recover 20." } },
    fearOfPursuit:   { dream: "many_mouths",      or: { event: "wonMode", mode: "escape" },
      becomes: { id: "unhurried", name: "Unhurried", passive: { moveCostMul: 0.85, maxLFAdd: 5 }, text: "Movement costs 15% less." } },
    fearOfScarcity:  { dream: "salt_heir",        or: { event: "wonWithNoItems" },
      becomes: { id: "enough", name: "Enough", passive: { battleSlotsAdd: 1, maxLFAdd: 5 }, text: "Carry one more item into battle." } },
    overwhelmed:     { dream: "amber_host",       or: { event: "wonOutnumbered", enemies: 3 },
      becomes: { id: "centered", name: "Centered", passive: { damageTakenMulWhenSurrounded: 0.85, maxLFAdd: 5 }, text: "15% less damage while 2+ enemies are adjacent." } },
    stuckInRoutine:  { dream: "unfinished_customer", or: { event: "usedChannelsInBattle", atLeast: 3 },
      becomes: { id: "adaptable", name: "Adaptable", passive: { rapidAdaptationFromFirstRepeat: true, maxLFAdd: 5 }, text: "Your Adaptation kicks in on the first repeated hit." } },
  };
  // Facing the dream counts when you do one of these to it.
  const dreamResolves = ["holdGaze", "nameItCorrect", "defeat"];

  return { rules, catalogAdditions, exploits, observerBias, catharsis, traumas, dreamResolves };
});
