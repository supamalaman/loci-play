"use strict";
// In-combat summon questions (Mala, 2026-10-07): in the battle game, calling a summon asks one quick
// question about it. Right answer = strong summon (+1 turn, ×1.2 ultimate); wrong or skipped = it
// still comes, at base strength, and the explanation is shown. Questions test what the summon
// DOES and what it COSTS, which is exactly what the player needs to use it well.
//
//   pickQuestion(summonKey, seed)            → { id, prompt, choices, answer, explain }
//   scoreAnswer(summonKey, questionId, choice) → { correct, bond, durationBonus, potencyMul, explain }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSummonQuestions = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const reward = { correct: { bond: 2, durationBonus: 1, potencyMul: 1.2 }, wrong: { bond: 1, durationBonus: 0, potencyMul: 1 } };

  const bank = {
    the_king: [
      { id: "king-law", prompt: "While There Is Only the Law holds, what can't the King do?", choices: ["Move", "Attack", "Be damaged"], answer: 0,
        explain: "The law binds its owner too: the King is rooted while his allies are protected." },
      { id: "king-exception", prompt: "Sovereign Exception lets one effect through a boundary. Who must obey that same exception?", choices: ["Only his enemies", "The King himself", "Nobody"], answer: 1,
        explain: "Authority gains strength through reciprocal obligation: the King is bound by his own exclusion." },
    ],
    mitsuko: [
      { id: "mitsuko-carry", prompt: "I Will Carry It turns damage Mitsuko takes for others into stored protection. Who can that protection NOT shield?", choices: ["The player", "Mitsuko herself", "Other allies"], answer: 1,
        explain: "Stored protection is for others; it can't protect Mitsuko herself." },
      { id: "mitsuko-share", prompt: "No One Falls Alone links allies so damage is shared. Does sharing reduce the total damage taken?", choices: ["Yes, it shrinks it", "No, it only spreads it", "Yes, it reflects it"], answer: 1,
        explain: "Redistribution conserves total damage; it spreads the load so no one falls alone." },
    ],
    inner_child: [
      { id: "child-rules", prompt: "Let's Play Something Else changes a rule. Who does the new rule apply to?", choices: ["Only the player's side", "Every combatant, enemies too", "Only enemies"], answer: 1,
        explain: "Imagination opens possibilities others can also exploit: announced changes apply to everyone." },
      { id: "child-otherwise", prompt: "It Could Be Otherwise reinterprets a committed move. What must stay the same?", choices: ["Cost, target and revealed facts", "Only the damage", "Nothing"], answer: 0,
        explain: "The revision keeps cost, target and already-revealed facts; only the interpretation changes." },
    ],
    perimeter_guardian: [
      { id: "guardian-pattern", prompt: "The Guardian defends against a pattern it has survived. Which change gets past that defence?", choices: ["Using the same attack harder", "Changing timing, route or harm channel", "Waiting a turn"], answer: 1,
        explain: "The defence only covers the recorded pattern's bounds: change how the attack arrives." },
      { id: "guardian-ult", prompt: "You Cannot Frighten Me the Same Way Twice protects against which harm channels?", choices: ["All of them", "Only channels already seen this battle", "Only impact"], answer: 1,
        explain: "Survived threats become specific protections: only channels that have already hit you." },
    ],
    napoleon: [
      { id: "napoleon-point", prompt: "Everything Arrives Here concentrates force on one place. What does that cost?", choices: ["Nothing", "Support everywhere else", "All of Napoleon's LF"], answer: 1,
        explain: "Convergence wins locally by accepting exposure elsewhere." },
      { id: "napoleon-target", prompt: "Where does Napoleon's burst land?", choices: ["On himself", "Around your current target", "On a random tile"], answer: 1,
        explain: "He commits to the decisive point: the enemy you are already attacking." },
    ],
    kobe: [
      { id: "kobe-refine", prompt: "Again, Until It Answers builds refinement from repeated attempts. What wipes it out?", choices: ["Changing objectives", "Missing once", "Taking damage"], answer: 0,
        explain: "Refinement is against the same obstacle; switching targets discards it." },
      { id: "kobe-commit", prompt: "During One More Possession, what can't Kobe do?", choices: ["Deal damage", "Retarget or retreat", "Move"], answer: 1,
        explain: "Committing the refinement means no retargeting, reserve swap or retreat until it ends." },
    ],
    aristotle: [
      { id: "aristotle-necessary", prompt: "Necessary, Not Merely Present targets which part of an effect?", choices: ["Its output", "A prerequisite it can't work without", "Whatever is closest"], answer: 1,
        explain: "Precision comes from distinguishing necessity from coincidence: break the load-bearing condition." },
      { id: "aristotle-counter", prompt: "How can an enemy protect an effect from Aristotle?", choices: ["Give it redundant prerequisites", "Stand closer", "Use a bigger number"], answer: 0,
        explain: "If two independent supports exist, removing one doesn't break it, like a cycle versus a bridge." },
    ],
    // Goethe hot-build (Muse Berry BD, 2026-10-29): what The Deed does, what the nova spares.
    goethe: [
      { id: "goethe-deed", prompt: "The Deed strikes one enemy and holds it. What does the target lose?", choices: ["Its footing: rooted where it stands", "All of its LF", "Its weapon"], answer: 0,
        explain: "The act has consequences: damage now, and rooted where it stands." },
      { id: "goethe-night", prompt: "Walpurgis Night bursts around your current target. Who is safe inside the burst?", choices: ["Your enemies", "Your allies: ordered novas never hit your side", "No one"], answer: 1,
        explain: "Ordered novas are announced and spare your side; only hostiles burn." },
    ],
    genghis_khan: [
      { id: "genghis-open", prompt: "The Unoccupied Route gets stronger with what?", choices: ["Forces bunched together", "Connected, open space", "Narrow corridors"], answer: 1,
        explain: "Distributed mobility needs open, connected routes; concentrating forces weakens it." },
      { id: "genghis-counter", prompt: "What's the best counter to Genghis Khan's routes?", choices: ["Close routes and compress the arena", "Spread out", "Ignore him"], answer: 0,
        explain: "Closing routes and forcing a narrow confrontation removes his advantage." },
    ],
    zherm: [
      { id: "zherm-nodes", prompt: "The Body Is a Colony spreads Zherm across fungal nodes. What's the weakness?", choices: ["Nodes can be isolated or destroyed", "He can't move", "He can't heal"], answer: 0,
        explain: "Distributed survival trades concentrated strength for dependence on the network." },
      { id: "zherm-ult", prompt: "Nothing Here Is Only Me bursts spores. What happens to allies inside the burst?", choices: ["They take damage", "They heal", "Nothing"], answer: 1,
        explain: "The colony wakes: it damages hostiles and heals allies caught in it." },
    ],
    gaia: [
      { id: "gaia-accord", prompt: "Gaia keeps her accord only while something holds. What is it?", choices: ["The land's condition", "Her health", "Your level"], answer: 0,
        explain: "Her support scales with the land's condition: wound the land and the accord weakens; tend it and she is strong." },
      { id: "gaia-max", prompt: "What raises Gaia into the World Goddess?", choices: ["Pouring an open Dream Space and a full ultimate bar into her revealed form", "Losing half her life", "A capture ritual"], answer: 0,
        explain: "Dream Space reveals the Wounded Ground; the MAX channel, the dream plus a full bar, makes her the World Goddess for the rest of her stay." },
    ],
    little_king: [
      { id: "lk-recognise", prompt: "You Already Recognized Me works through a disguise. How do you shut it down?", choices: ["Authenticate the source", "Attack harder", "Move away"], answer: 0,
        explain: "Borrowed authority depends on recognition: verify the source and the channel closes." },
      { id: "lk-ult", prompt: "All Rise for the Wrong King drains action points. How can an enemy resist it?", choices: ["By guarding (verifying the claim)", "By being far away", "They can't"], answer: 0,
        explain: "There is a verification window: guarding during it resists the command." },
    ],
  };

  function hash(str) {
    let h = 2166136261;
    for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function pickQuestion(key, seed = 0, { hintCount = 0 } = {}) {
    const list = bank[key] || [];
    if (!list.length) return null;
    const q = list[Math.floor(hash(`${seed}:${key}`) * list.length)];
    let choiceMap = q.choices.map((_, i) => i);
    // A Mnemonic Charm removes one wrong option while preserving a reversible answer map.
    for (let i = 0; i < Math.min(Math.max(0, hintCount), q.choices.length - 2); i++) {
      const wrong = choiceMap.findIndex((n) => n !== q.answer);
      if (wrong >= 0) choiceMap.splice(wrong, 1);
    }
    return { id: q.id, prompt: q.prompt, choices: choiceMap.map((i) => q.choices[i]), answer: choiceMap.indexOf(q.answer),
      choiceMap, hinted: choiceMap.length < q.choices.length, explain: q.explain };
  }

  // choice: index, or null when skipped.
  function scoreAnswer(key, questionId, choice, { choiceMap = null } = {}) {
    const q = (bank[key] || []).find((x) => x.id === questionId);
    if (!q) return { correct: false, ...reward.wrong, explain: "No question." };
    const sourceChoice = choice == null ? null : (choiceMap ? choiceMap[choice] : choice);
    const correct = sourceChoice === q.answer;
    return { correct, ...(correct ? reward.correct : reward.wrong), explain: q.explain, answer: q.answer, skipped: choice == null };
  }

  return { bank, reward, pickQuestion, scoreAnswer };
});
