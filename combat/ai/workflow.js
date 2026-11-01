"use strict";
// Psychology-driven tactical workflows. The planner ranks goals from a character's
// own trait profile and the public battle state; it never reads hidden intent.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatWorkflow = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const TRAITS = {
    scout: { understand: 1.6, position: 0.8, support: 0.4 },
    discernment:{understand:2,exploit:1},botanist:{understand:1.2,summon:2.4},horticultureExpertise:{summon:1.8,support:1},hiker:{understand:.6},plantKin:{understand:1,summon:1},
    fearful: { survive: 2.2, protect: 0.7 }, skittish: { survive: 2.5, position: 0.8 },
    proud: { pressure: 1.8 }, impatient: { pressure: 1.6, prepare: -0.5 },
    curious: { understand: 2.0, prepare: 0.8 }, genius: { prepare: 1.0, exploit: 0.8 }, fool: { pressure: 0.7, prepare: -0.4 },
    neverGiveUp: { persistence: 1.6, survive: -0.6 },   // the Anime Protagonist's value: stays in the fight (his Inspiration roll is engine/ledgers.js hardship)
    loyal: { protect: 2.0 }, collaborative: { protect: 1.6, support: 1.4 }, empathic: { protect: 1.3, support: 1.1 },
    protective: { protect: 2.0, support: 1.2 },   // the tofu sisters: guard bias where the kit allows, and drift to their ally (engine/ai.js moveValue)
    competitive: { pressure: 1.2 }, rivalrous: { pressure: 1.4, support: -0.4 }, stubborn: { persistence: 1.4 },
    playfulness: { pressure: 1.0, support: -0.5 },   // tests himself; the target preference itself is in engine.js score()
    vengeful: { pressure: 1.0, persistence: 0.6 },   // C6 retaliation (muse sandbox batch 5): the spite bonus itself is in engine.js score()
    grappler: { pressure: 0.6, position: 0.4 },   // closes distance and holds
    gambler: { pressure: 0.5, prepare: 0.8, survive: -0.8 },   // takes the risky line; the low-LF banking itself is in engine.js aiAction
    reckless: { pressure: 1.8, prepare: -0.8, survive: -1.0 },   // the tofu yokai: hits now, sets up less (pain still moves it: selfHealth 0.6 keeps the retreat)
    contemplative: { prepare: 1.2, understand: 0.4 }, restless: { position: 0.8, prepare: -0.6 },   // C15: the meditate gates themselves are in engine.js
    // T1 traits (insight-data.js registry). Biology that moves the AI, then values.
    keenSenses: { understand: 1.0 }, hardy: { position: 0.6 }, fleetFooted: { position: 0.8 }, frail: { survive: 0.8, position: 0.5 },
    courageous: { protect: 1.2, pressure: 0.6, survive: -1.0 }, brave: { persistence: 1.4, protect: 0.8, survive: -0.8 }, merciful: { pressure: -0.8, support: 0.8 }, honorable: { pressure: 0.8, exploit: -1.2 },
    dutiful: { persistence: 1.6, protect: 0.8 }, zealous: { persistence: 1.4, pressure: 0.4 }, byTheBook: { persistence: 1.2, protect: 0.6 }, thrifty: { prepare: 1.2, hoard: 0.6, pressure: -0.3 }, pacifist: { support: 1.6, protect: 1.2, pressure: -2.0 },
    steward: { protect: 1.0, prepare: 0.6 }, dreamer: { summon: 1.2, prepare: 0.8 }, truthSeeker: { understand: 1.8, exploit: 0.6 }, charitable: { support: 1.8, hoard: -1.5 },
    traditionalist: { persistence: 1.0, prepare: 0.5, understand: -0.5 }, craftsmansMindset: { prepare: 1.4, persistence: 1.2, pressure: -0.3 }, robotSympathizer: { understand: 0.8, pressure: -0.2 }, robotHater: { pressure: 0.8, understand: -0.4 }, ambitious: { pressure: 1.2, exploit: 0.8, support: -0.5 },
    animalLover: { support: 0.6, pressure: -0.3 }, animalHater: { pressure: 0.5, support: -0.3 }, petFighting: { summon: 1.5, pressure: 0.3 },
    believer: { prepare: 0.8, summon: 1.5 }, devoutBeliever: { prepare: 1.0, summon: 1.8 }, fullBeliever: { summon: 2.2 },
    homestead: { protect: 1.2, persistence: 0.8 }, markedGround: { prepare: 1.0, persistence: 0.6 },   // the Pioneer's: hold home ground, set the line and keep it
    awardWinningDirector: { pressure: 1.2, prepare: 0.8 },   // prestige wants a stage: film the piece that matters
    humanExperience: { understand: 1.0, support: 0.8 }, methodActing: { prepare: 0.8, exploit: 0.6 },   // has lived enough to read the room; studies the part, then uses it
    hoarder: { hoard: 2.0, position: 0.4 },
  };
  const BASE = { survive: 0, protect: 0, pressure: 0.4, understand: 0, prepare: 0.2, exploit: 0, position: 0.2, support: 0, summon: 0, persistence: 0, hoard: 0 };
  const POSTURES = {
    aggressive: { pressure: 1, exploit: 0.25 },
    defensive: { survive: 0.85, protect: 0.65, position: 0.2 },
    explorer: { understand: 0.8, position: 0.2 },
    preparer: { prepare: 0.75, understand: 0.3 },
    hoarder: { hoard: 0.8, position: 0.2 },
  };
  function postureFor(traits = []) {
    const ids = new Set((traits || []).map(t => typeof t === "string" ? t : t?.id));
    if (ids.has("fearful") || ids.has("skittish")) return "defensive";
    if (ids.has("curious") || ids.has("scout")) return "explorer";
    if (ids.has("genius")) return "preparer";
    if (ids.has("proud") || ids.has("impatient") || ids.has("rivalrous") || ids.has("competitive") || ids.has("vengeful")) return "aggressive";
    if (ids.has("hoarder")) return "hoarder";
    return "aggressive";
  }
  function choose(actor, context = {}) {
    const posture = POSTURES[actor.posture] ? actor.posture : postureFor(actor.traits);
    const weights = { ...BASE, ...Object.fromEntries(Object.entries(POSTURES[posture]).map(([k,v]) => [k, (BASE[k] || 0) + v])) };
    if (actor.character === "architect") { weights.protect += 0.8; weights.understand += 0.25; }
    for (const trait of actor.traits || []) for (const [goal, value] of Object.entries(TRAITS[typeof trait === "string" ? trait : trait?.id] || {})) weights[goal] += value;
    const enemies = Math.max(0, context.enemies || 0), allies = Math.max(0, context.allies || 0);
    if (enemies >= 3) { weights.survive += 0.45; weights.position += 0.45; weights.pressure -= 0.2; }
    if (allies > 0) weights.protect += 0.35;
    if (context.lowAlly) { weights.protect += 1.2; weights.support += 1.1; }
    if (context.lowSelf) weights.survive += 1.5;
    if (context.lowSelf && context.escapesLeft != null) { if (context.escapesLeft > 0) { weights.survive += 1.0; weights.position += 0.5; } else weights.pressure += 1.0; }   // Survival Instincts: a hurt holder runs or lies; with both spent it turns and fights
    if (context.mode === "survive" || context.mode === "escape") { weights.survive += 1.3; weights.position += 0.8; }
    if (context.mode === "assassinate") weights.pressure += 0.9;
    if (context.eventIn != null && context.eventIn <= 2) { weights.prepare += 0.65; weights.position += 0.35; }
    if (context.mode === "exploratory") weights.understand += 0.6;
    if (context.nearestFoeDist != null && context.nearestFoeDist <= 1) { weights.pressure += 1.2; weights.position -= 0.5; }
    if (context.nearestFoeDist != null && context.nearestFoeDist >= 5) { weights.position += 0.8; weights.prepare += 0.4; }
    if (context.ultFrac != null && context.ultFrac < 0.3) weights.prepare += 0.5;
    if (context.ultFrac != null && context.ultFrac >= 0.99) weights.pressure += 0.8;
    if (context.tempoFrac != null && context.tempoFrac < 0.25) weights.survive += 0.6;
    if (context.painEff != null && context.painEff > 0.4) { weights.survive += context.painEff * 2; weights.position += context.painEff; }
    // C7 ego (engine.js hit()): bold units press, cowed units look after themselves. Unset reads as steady (0.5).
    const ego = actor.ego ?? 0.5;
    if (ego >= 0.7) weights.pressure += (ego - 0.7) * 4;
    if (ego <= 0.3) { weights.survive += (0.3 - ego) * 5; weights.position += (0.3 - ego) * 2; }
    const entries = Object.entries(weights).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]));
    return { goal: entries[0][0], posture, weights, reason: entries[0][1] > 1 ? "personality and situation" : "current tactical opportunity" };
  }
  // Intrinsic preferences share the damage score scale; personality can favor
  // a useful preparation over a small immediate hit.
  function bias(workflow, actor, candidate, ability, context = {}) {
    const goal = workflow.goal, effect = ability?.effect, type = candidate.type;
    let category = "pressure";
    if (type === "move" || type === "scramble") category = "position";
    else if (type === "playDead") category = "survive";
    else if (["observe","observePlace","observePlant","observeStructure","insight"].includes(type)) category = "understand";
    else if (type === "commune" || type === "communeStructure" || type === "monsterSummon" || type === "summon" || effect === "summon") category = "summon";
    else if (effect === "guard" || effect === "barrier" || effect === "berm" || effect === "architectDesign" || effect === "anchor" || effect === "membrane" || effect === "aura" || effect === "swale" || effect === "bermRing" || effect === "rainGarden" || effect === "immovable" || effect === "nurseLog" || effect === "successionPatch" || effect === "contourBerm") category = "protect";
    else if (effect === "heal" || effect === "classEffect" || ["aura", "parley", "recover"].includes(type)) category = "support";
    else if (effect === "observe" || effect === "focus" || effect === "attention") category = "understand";
    else if (effect === "dreamSpace" || ability?.tier === "ultimate") category = "prepare";
    else if (type === "useItem") category = "hoard";
    const w = workflow.weights;
    let value = (w[category] || 0) * 1.5;
    if (goal === "survive" && category === "protect" && context.lowSelf) value += 0.7;
    if (goal === "protect" && category === "support" && context.lowAlly) value += 0.7;
    if (goal === "exploit" && category === "pressure" && context.knownWeakness) value += 0.5;
    if (goal === "persistence" && candidate.ability && actor.lastAIAbility === candidate.ability) value += 0.15;
    return Math.max(-4, Math.min(8, value));
  }
  return { TRAITS, POSTURES, postureFor, choose, bias };
});
