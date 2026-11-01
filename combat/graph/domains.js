"use strict";
// The four domains of gameplay (Mala, 2026-10-08): knowing yourself, understanding others, understanding ideas,
// and taking action. A Venn diagram, not four separate things: most of what the game does sits in the overlaps.
//
//   functions  every gameplay function, with the domains it touches and why
//   regions    the 15 regions of the four-set Venn (4 singles, 6 pairs, 4 triples, the centre)
//   coverage() how many functions live in each region (to see what's thin)
//   regionOf(domains) → region key (e.g. "others+ideas+action")
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatDomains = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const domains = {
    self:   { name: "Knowing yourself",       text: "Your own traits, tells, fears and limits: what you bring to the fight." },
    others: { name: "Understanding others",   text: "What drives the characters across from you (and beside you), and how they'll act." },
    ideas:  { name: "Understanding ideas",    text: "How concepts work and relate: the graph, the mechanisms, the math." },
    action: { name: "Taking action",          text: "Doing something on the board: moving, striking, building, committing." },
  };
  const ORDER = ["self", "others", "ideas", "action"];
  const regionOf = (ds) => ORDER.filter((d) => ds.includes(d)).join("+");

  // domains: the set this function touches. why: what puts it in each.
  const functions = [
    // action-led
    { id: "move", name: "Move / climb / jump", domains: ["action"], why: "Positioning on the board." },
    { id: "strike", name: "Strike", domains: ["action"], why: "Plain force; no concept involved." },
    { id: "guard", name: "Guard", domains: ["action", "self"], why: "Choosing to protect yourself means knowing you're the one at risk." },
    { id: "abilities", name: "Concept abilities", domains: ["action", "ideas"], why: "Every ability is an idea used as an action; it works by its mechanism." },
    { id: "lenses", name: "Lenses", domains: ["action", "ideas", "self"], why: "Choosing a trade-off shapes how an idea works for you." },
    { id: "quickened", name: "Quickened (Snap / Last Word)", domains: ["action", "others"], why: "Acting so fast they can't respond: it's about denying them a reaction." },
    { id: "itemsUse", name: "Using items", domains: ["action"], why: "One-time effects on the board." },
    { id: "pickups", name: "Picking up items on the map", domains: ["action", "others"], why: "A race: enemies want the same pickups." },
    // ideas-led
    { id: "graph", name: "The relationship graph", domains: ["ideas"], why: "How concepts relate: the point of the game." },
    { id: "graphDiscovery", name: "Discovering edges", domains: ["ideas", "action"], why: "You discover a relation by making it happen (or answering about it)." },
    { id: "questions", name: "Questions after interactions", domains: ["ideas", "self"], why: "Checking what you understand, and learning where you're wrong." },
    { id: "transfer", name: "Post-battle transfer questions", domains: ["ideas", "self"], why: "Applying an idea to a new case, and seeing whether you can." },
    { id: "mathLessons", name: "Math lessons", domains: ["ideas"], why: "Graph theory and proof structure, as ideas in themselves." },
    { id: "effectCategories", name: "Effect categories (universal, existential, ...)", domains: ["ideas", "action"], why: "The logical shape of an effect decides which counters are legal." },
    { id: "terrainReading", name: "Reading terrain (height, cover, cliffs, bridges)", domains: ["ideas", "action"], why: "Landscape concepts made physical; using them is applying them." },
    // others-led
    { id: "observeOthers", name: "Observe (others)", domains: ["others", "ideas"], why: "Noticing traits and tells is understanding a person through evidence." },
    { id: "insightActions", name: "Insight actions (Frighten, Taunt, Talk...)", domains: ["others", "action"], why: "Acting on what you understand about someone instead of hitting them." },
    { id: "frighten", name: "Frighten", domains: ["others", "action", "self"], why: "Fear is theirs, but saying the right thing takes knowing your own voice." },
    { id: "befriend", name: "Talk / Befriend", domains: ["others", "action", "self"], why: "A truce needs you to understand them and offer something of yourself." },
    { id: "enemySpeech", name: "Enemy and summon speech", domains: ["others"], why: "Voices reveal character (never battle state)." },
    { id: "enemyRethink", name: "Enemies rethinking strategy", domains: ["others", "ideas"], why: "They learn too: you watch an opponent update its model." },
    { id: "deceptionTell", name: "Deception tells and calibration", domains: ["others", "ideas", "action"], why: "A signal about an action: reading it needs a model of them and of the idea." },
    // self-led
    { id: "observeSelf", name: "Observe Self (Johari's window)", domains: ["self", "ideas"], why: "Learning your own traits; each is an idea about yourself." },
    { id: "johariBlind", name: "Blind spots (enemies see, you don't)", domains: ["self", "others"], why: "Johari's Blind pane: others' knowledge of you." },
    { id: "enemyObserveYou", name: "Enemies observing you", domains: ["others", "self", "action"], why: "They read you and act on it; you defend by knowing yourself." },
    { id: "trauma", name: "Resolving trauma", domains: ["self", "ideas", "action"], why: "Knowing a fear, understanding it, and acting through it." },
    { id: "adaptationRapid", name: "Adaptation auto-attunement", domains: ["self", "action"], why: "Your own response changes from your own experience." },
    { id: "account", name: "Account, XP, cognitive inventory", domains: ["self", "ideas"], why: "A record of what you've learned and noticed." },
    // summons and dreams: the overlaps
    { id: "summonQuestion", name: "Summon question", domains: ["ideas", "others", "action"], why: "Knowing what a summon does and costs before you call it." },
    { id: "summons", name: "Summons (AI allies from the palace)", domains: ["others", "action", "self"], why: "Parts of your mind palace you call on, with their own attitudes." },
    { id: "orderUltimate", name: "Ordering a summon's ultimate", domains: ["others", "action", "self"], why: "Trusting someone else with your own charge." },
    { id: "dreamSpace", name: "Dream Space", domains: ["self", "others", "action"], why: "Opening your own dream: power for you, risk from what lives there." },
    { id: "dreamMonsters", name: "Dream monsters", domains: ["self", "others", "ideas"], why: "Fears with a mechanism: they are yours, they act like others, and each is an idea." },
    { id: "nameIt", name: "Name it (wake from a dream)", domains: ["self", "ideas", "action"], why: "Naming the idea behind a fear is how you wake from it." },
    { id: "holdGaze", name: "Hold its gaze", domains: ["self", "others", "ideas", "action"], why: "Sustained attention to a fear until you understand it isn't a foe: all four at once." },
    { id: "monsters", name: "Ecological monsters", domains: ["ideas", "action"], why: "Landscape processes without anyone steering them; beaten by the right management idea." },
    { id: "modes", name: "Game modes (Survive, Escape...)", domains: ["action", "ideas"], why: "Different objectives; Escape is literally a graph cut." },
  ];

  const regions = () => {
    const out = {};
    for (let mask = 1; mask < 16; mask++) out[ORDER.filter((_, i) => mask & (1 << i)).join("+")] = [];
    return out;
  };
  function coverage(list = functions) {
    const r = regions();
    for (const f of list) r[regionOf(f.domains)].push(f.id);
    return r;
  }

  return { domains, ORDER, functions, regionOf, coverage };
});
