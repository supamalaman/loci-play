"use strict";
// Mind-duel matrix (Mala, 2026-10-14; spec loci-orbit/muse/parley/PARLEY_MINIGAME.md): the four
// arguments and which psych traits they break against or slide off. Tuner adjusts numbers;
// matchups are v1 engine data. WEAK = x2 willpower damage, STRONG = immune (x0, beats weak).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatMindMatrix = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MOVES = {
    debate: { name: "Debate", power: 3, text: "Steady, safe: 3 willpower damage." },
    empathize: { name: "Empathize", power: 2, heal: 2, text: "2 damage, and heal self 2. Understanding steadies." },
    insult: { name: "Insult", power: 5, backfire: 2, text: "5 damage — but scorn rebounds for 2 if they are immune." },
    concede: { name: "Concede", power: 0, yieldHeal: 3, text: "Yield a point: they heal 3, their attack lands full — and you learn one of their traits." },
  };
  // Trait -> { weak: move that deals x2, strong: move it is immune to, why }.
  const MATCHUPS = {
    fearful: { weak: "insult", strong: "debate", why: "scorn breaks; panic can't argue" },
    skittish: { weak: "debate", strong: "insult", why: "cornered by logic; scorn hits air" },
    fearOfDeath: { weak: "insult", strong: "debate", why: "\"die afraid\" lands; terror doesn't argue" },
    courageous: { weak: "empathize", strong: "insult", why: "courage is lonely; scorn slides off" },
    immortalDelusion: { weak: "debate", strong: "insult", why: "\"you CAN die\" unthinkable; undying unmocked" },
    loyal: { weak: "empathize", strong: "insult", why: "\"think of them\" works; scorn slides off" },
    empathic: { weak: "debate", strong: "empathize", why: "logic shorts feeling; can't out-feel" },
    collaborative: { weak: "insult", strong: "debate", why: "trust breaks cruel; loves reasons" },
    competitive: { weak: "empathize", strong: "insult", why: "kindness incomprehensible; scorn is fuel" },
    vengeful: { weak: "empathize", strong: "insult", why: "forgiveness undoes; rage eats scorn" },
    rivalrous: { weak: "debate", strong: "empathize", why: "must win it; contempt for softness" },
    curious: { weak: "debate", strong: "insult", why: "can't resist engaging; too interested" },
    contemplative: { weak: "insult", strong: "debate", why: "examined sore spots; thought of everything" },
    greedy: { weak: "empathize", strong: "debate", why: "generosity unmakes; priced your argument" },
    ambitious: { weak: "insult", strong: "empathize", why: "status wounds; no time for feelings" },
    honorable: { weak: "debate", strong: "insult", why: "code has seams; duels at dawn" },
    dutiful: { weak: "empathize", strong: "debate", why: "\"duty kills you\"; orders aren't argued" },
    pacifist: { weak: "insult", strong: "debate", why: "cheek bruises; rehearsed every peace" },
    merciful: { weak: "insult", strong: "empathize", why: "cruelty wounds; mutual mercy holds" },
    impatient: { weak: "empathize", strong: "debate", why: "feelings take TIME; stopped listening" },
    restless: { weak: "debate", strong: "insult", why: "pacing and snapping; scorn lands behind" },
    gambler: { weak: "insult", strong: "empathize", why: "\"coward\" must prove; no tells" },
    honest: { weak: "debate", strong: "insult", why: "argues fair, takes full; clear conscience" },
    proud: { weak: "insult", strong: "empathize", why: "pride WOUNDS; pity beneath notice" },
    stubborn: { weak: "empathize", strong: "debate", why: "only love moves; never lost arguing" },
    guarded: { weak: "empathize", strong: "insult", why: "kind word at gate; walls hold" },
    complex: { weak: "debate", strong: "insult", why: "loves the argument; too layered" },
    superstitious: { weak: "insult", strong: "debate", why: "mockery of beliefs; omens over arguments" },
    lonely: { weak: "empathize", strong: "insult", why: "kindness floods; used to scorn" },
    collector: { weak: "debate", strong: "empathize", why: "catalogs your points; people aren't sets" },
    fool: { weak: "debate", strong: "insult", why: "follows any cliff; too foolish to bruise" },
    talkative: { weak: "insult", strong: "empathize", why: "\"nobody's listening\"; talks past feelings" },
    annoying: { weak: "empathize", strong: "debate", why: "being UNDERSTOOD worst; never follows" },
    agreeable: { weak: "debate", strong: "insult", why: "agrees, takes full; can't bruise" },
    playfulness: { weak: "insult", strong: "debate", why: "mock the game; \"just a game\"" },
    drunkenMonkey: { weak: "debate", strong: "insult", why: "drunk logic engages; too drunk" },
    stoner: { weak: "insult", strong: "debate", why: "harsh vibes wound; \"whoa\"" },
    speedTalker: { weak: "empathize", strong: "debate", why: "feelings slow pitch; out-talks anything" },
    dreamer: { weak: "insult", strong: "debate", why: "mock the dream; awake can't reach" },
    thrifty: { weak: "empathize", strong: "debate", why: "spirit bankrupts; counted your points" },
    steward: { weak: "insult", strong: "debate", why: "\"your garden is weeds\"; tends, argues not" },
    persuasive: { weak: "debate", strong: "empathize", why: "out-argued at own game; never sincere" },
    animalLover: { weak: "insult", strong: "debate", why: "\"sentimental fool\"; heart has reasons" },
    animalHater: { weak: "empathize", strong: "debate", why: "\"beasts feel too\"; cruelty isn't argued" },
    petFighting: { weak: "insult", strong: "empathize", why: "called soft, must prove; no pit softness" },
    cavalry: { weak: "debate", strong: "empathize", why: "\"stand and argue\" agony; momentum unfeeling" },
    craftsmansMindset: { weak: "insult", strong: "debate", why: "\"shoddy work\" WOUNDS; work speaks" },
    ceaselessAdaptation: { weak: "empathize", strong: "insult", why: "feeling has no counter; becomes mockery" },
    perfectMemory: { weak: "debate", strong: "empathize", why: "remembers every loss; facts don't fade" },
    telepathy: { weak: "empathize", strong: "debate", why: "your feelings flood me; heard it already" },
    imaginative: { weak: "debate", strong: "insult", why: "visions have seams; too busy seeing" },
  };
  const RULES = {
    maxWillpower: 10, maxRounds: 4,
    talk: false,                      // conversational wrapper (insight/mind-talk.js): mindTalk log lines each round, off until the UI lands
    apDebt: 30,                       // decisive fallback: next turn opens -30 AP
    vowDebateAdd: 1, vowEmpathizeHealAdd: 1, staggerAttackMinus: 2,   // the gentle tongue / the unyielding mind
    speedTalkerDebate: 4,             // speedTalker migrated here: rapid-fire points (integrator call)
    weights: { base: 1, greedyProperty: 0.2, proudDismiss: 0.2, stubbornStall: 1.5, impatientStall: 0.3, impatientDebt: 1.5 },
  };
  return { MOVES, MATCHUPS, RULES };
});
