"use strict";
// Enemy dreams: the classic monsters an ENEMY's Dream Space calls (Mala, 2026-10-08):
//   "monsters should be driven by the same underlying concept mechanics but be severely limited, they only get
//    one concept at a time… each monster summoned this way should be simple and have a major drawback."
// So every monster has exactly: ONE concept, ONE passive, ONE ability, ONE major drawback. Rules: enemy-monsters.js.
// Spec: ~/Documents/concept-combat-enemy-monsters.md. Numbers PROVISIONAL.
//
// dreamspace.js reads `configs` (one single-concept config each), `name` and `status`; makeMonster builds the actor.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatEnemyDreams = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ART = "~/Documents/Game Dev/concept-combat-art/enemy-dreams";
  const M = (o) => ({ status: "ready", sprite: `combat/sprites/dream-${o.key}`, poses: ["idle", "walk", "cast", "block", "punch", "knockedOut"], configs: [[o.concept]], ...o });

  const monsters = {
    vampire: M({ key: "vampire", name: "The Vampire", concept: "diffusion", beliefTier: 3, lf: 40, move: 3, art: `${ART}/vampire.png`,
      passive: { id: "immortal", name: "Immortal", text: "Lethal damage leaves it at 1 LF instead, as long as it isn't standing in sunlight. Only the sun, or the dream closing, ends it." },
      ability: { id: "lifeDrain", name: "Life Drain", delivery: "contact", range: 1, channel: "citrinitas", cap: 12, gradient: 30,
        text: "Drains an adjacent target by the difference in how healthy they are: (their LF% − its LF%) × 30, up to 12. It heals what it drains. Life only flows downhill: a target worse off than the vampire gives nothing." },
      drawback: { id: "sunWeakness", name: "Sun-weakness", text: "It can't end its turn on a sunlit tile: if it does, it burns to dust. It moves only from shade to shade. Overcast, rain and fog free it." },
      teaches: "Diffusion: flow runs down a gradient, from more to less, and stops when they're level.",
      counter: "Take its shade away (Crown Raise, Prune, fell the tree), shove it into the sun, or wait for a clear sky. Stay healthier than it and its drain is weak; the gradient runs one way." }),

    mummy: M({ key: "mummy", name: "The Mummy", concept: "inertia", beliefTier: 2, lf: 50, move: 1, art: `${ART}/mummy.png`,
      passive: { id: "preserved", name: "Preserved", text: "It can't be displaced, stunned or frightened. Kept exactly as it was." },
      ability: { id: "bindingWraps", name: "Binding Wraps", delivery: "contact", range: 1, channel: "nigredo", potency: 6,
        text: "6 impact, and the adjacent target can't move on its next turn: wrapped, kept where it is." },
      drawback: { id: "tinderDry", name: "Tinder-dry", text: "Centuries-dry linen: fire deals ×3 to it and sets it burning (6 a turn until it's dead or wet). And it moves 1 tile a turn." },
      teaches: "Inertia: what is preserved resists change, until something changes it all at once.",
      counter: "Fire, or simply staying out of reach: it moves 1 tile a turn." }),

    skeleton: M({ key: "skeleton", name: "The Skeleton", concept: "pruning", beliefTier: 1, lf: 24, move: 3, art: `${ART}/skeleton.png`,
      passive: { id: "reassemble", name: "Reassemble", text: "When destroyed it re-forms on its tile at the next round with half LF, once per dream." },
      ability: { id: "stripBare", name: "Strip Bare", delivery: "line", range: 4, channel: "albedo", potency: 8,
        text: "8 piercing, and the target loses one defensive status (guard, ward or brace): pruned to the bone." },
      drawback: { id: "brittle", name: "Brittle", text: "Impact (Nigredo) deals ×2, and bones scattered by impact never reassemble." },
      teaches: "Pruning: remove one part and what's left changes, and that cuts both ways.",
      counter: "Hit it with impact: double damage, and it stays down." }),

    frankenstein: M({ key: "frankenstein", name: "Frankenstein's Monster", concept: "resonance", beliefTier: 3, lf: 60, move: 2, art: `${ART}/frankenstein.png`,
      passive: { id: "galvanized", name: "Galvanized", text: "Rubedo (resonance) damage heals it instead, up to +10 a hit. It was brought to life by the current." },
      ability: { id: "galvanicSlam", name: "Galvanic Slam", delivery: "contact", range: 1, channel: "rubedo", potency: 16, knockback: 2,
        text: "16 resonance to an adjacent target, which is thrown 2 tiles." },
      drawback: { id: "fearOfFire", name: "Fear of fire", text: "It never steps next to fire or a burning unit. If fire is within 2 at its turn start, it spends that turn backing away." },
      teaches: "Resonance: matched input builds a response. Feed it its own frequency and you make it stronger.",
      counter: "Don't hit it with Rubedo. Light a fire between you." }),

    zombie: M({ key: "zombie", name: "The Zombie", concept: "pathway", beliefTier: 1, lf: 30, move: 2, art: `${ART}/zombie.png`,
      passive: { id: "relentless", name: "Relentless", text: "It can't be taunted, frightened or talked down. It always takes the shortest route to the nearest living unit." },
      ability: { id: "infectiousBite", name: "Infectious Bite", delivery: "contact", range: 1, channel: "citrinitas", potency: 8,
        text: "8, and the target is infected: −3 LF at the end of each of its turns for 3 turns. Any heal cures it." },
      drawback: { id: "mindless", name: "Mindless", text: "It can't tell sides: it goes for the NEAREST living unit, its summoner's allies included." },
      teaches: "Pathway: the shortest route is predictable, and predictable routes can be used against it.",
      counter: "Stand so an enemy is closer to it than you are. Heal off the infection." }),

    werewolf: M({ key: "werewolf", name: "The Werewolf", concept: "threshold", beliefTier: 3, lf: 45, move: 4, art: `${ART}/werewolf.png`,
      passive: { id: "feralRegeneration", name: "Feral Regeneration", text: "+6 LF at the start of its turn while it's a wolf." },
      ability: { id: "pounce", name: "Pounce", delivery: "contact", range: 3, channel: "albedo", potency: 14,
        text: "Leaps up to 3 tiles (over hedges and height) to land beside a target and strike for 14." },
      drawback: { id: "moonBound", name: "Moon-bound", text: "It stays a wolf only under a covered sky (overcast, rain, squall, fog). Under clear sun it turns back into a frightened human: at most 15 LF, no abilities, running for the edge." },
      humanLF: 15,
      teaches: "Threshold: a state that switches when a condition is crossed, and switches back when it isn't.",
      counter: "Fight it under the sun, or wait for the forecast (Read the Sky)." }),

    ghost: M({ key: "ghost", name: "The Ghost", concept: "boundary", beliefTier: 1, lf: 20, move: 3, art: `${ART}/ghost.png`,
      passive: { id: "incorporeal", name: "Incorporeal", text: "Impact and piercing (Nigredo, Albedo) pass through it. It ignores hazards and move costs, but not walls." },
      ability: { id: "chillingWail", name: "Chilling Wail", delivery: "field", radius: 2, channel: "citrinitas", potency: 6, apLoss: 10,
        text: "Everyone within 2 takes 6 and loses 10 AP next turn." },
      drawback: { id: "boundToHaunt", name: "Bound to its haunt", text: "It can't leave the 3 tiles around where it appeared, and Observing it fully (its unfinished business) releases it: it departs.", haunt: 3 },
      teaches: "Boundary: a line that holds what's inside as much as it keeps things out.",
      counter: "Step outside its haunt. Or understand it: a fully Observed ghost leaves." }),

    // The Insect Kaiju's offspring (Mala, 2026-11-01: the Kaiju keeps calling insects, 2 alive and 4 in all). Not a dream: it is called by the
    // boss (engine/true-forms.js callBrood) and kept out of every dream pool (broodOnly). Numbers PROVISIONAL.
    broodMite: M({ key: "broodMite", name: "Brood Mite", concept: "diffusion", beliefTier: 9, broodOnly: true, lf: 40, move: 3, sprite: "combat/sprites/brood-mite", art: "~/Downloads/CUT - Insect Kaiju Brood Mite Sprite Sheet.png",
      passive: { id: "broodBound", name: "Brood-bound", text: "It is the Insect Kaiju's. While its mother stands, the capture ritual refuses it; once she has fallen it can be taken into a bead at any LF." },
      ability: { id: "broodBite", name: "Brood Bite", delivery: "contact", range: 1, channel: "citrinitas", potency: 8,
        text: "8 to an adjacent target." },
      drawback: { id: "fragile", name: "Fragile", text: "Only 40 LF: two good hits end it." },
      teaches: "Diffusion: what spreads from one body is many small ones, and each is easy to stop.",
      counter: "Spreading effects (a cone, a line, fire) hit several at once. Once the mother falls, take one into a bead." }),
  };

  const pools = { classic: Object.keys(monsters).filter((k) => !monsters[k].broodOnly) };
  // Which pool each enemy character dreams from (defaults to classic).
  const dreamerPools = {};

  function poolFor(poolIdOrCharacter) {
    const id = pools[poolIdOrCharacter] ? poolIdOrCharacter : (dreamerPools[poolIdOrCharacter] || "classic");
    return Object.fromEntries(pools[id].filter((k) => monsters[k].status === "ready").map((k) => [k, monsters[k]]));
  }
  return { monsters, pools, dreamerPools, poolFor };
});
