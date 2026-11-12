"use strict";
// Observe and insight (Mala, 2026-10-08): "Observe should be one of the most powerful tools in the game."
// Every character (friend or foe) spawns with a hidden deck of observations. Observing, with action
// points invested like a strike, reveals them. Each revealed observation can unlock a new action that
// changes the fight through understanding instead of force. What you notice is kept in a persistent
// cognitive inventory, so things you've noticed before are easier to notice again.
//
// Traits shape the deck: honest characters hide nothing; complex ones have more to find; guarded ones
// are harder to read. Traits are either noticed at once (open) or are themselves hidden observations.
// Plain data. Numbers PROVISIONAL.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatInsightData = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const rules = {
    observe: { minAP: 10, maxAP: 50, apPerPoint: 10, carryCap: 5, needsSight: true, twentyTwentyBonus: 1 },
    investigate: { minAP: 60, depthBonus: 2, carryCap: 10, directorsVisionPoints: 1 },   // Investigate (spec INVESTIGATE.md, Mala 2026-10-30): all remaining AP, deepest first
    familiarity: { subjectCap: 2, kindCap: 1 },   // how much past noticing can lower a difficulty
    dreamSpacePointBonus: 1,
  };

  // Survival Instincts (docs/survival-instincts.md). The numbers live in content.js rules.survivalInstincts; this copy only
  // feeds the trait card at load, and tests/survival-instincts.test.mjs fails if the two ever differ. survivalText(R) builds
  // the card text from whatever rules it is given, so a changed rule changes what the card says.
  const SURVIVAL = { woundedBelow: 0.4, scramble: { ap: 15, moveAdd: 2, uses: 3 }, lie: { uses: 1, restPerTurn: 4, restCap: 8, standAp: 10, painShare: 0.10, discoverPoints: 2, discoverPerRank: 1, maxTurnsDown: 6 } };
  const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  function survivalText(R) {
    const w = (n) => NUMBER_WORDS[n] || String(n), L = R.lie;
    return `Hurt, the body knows two ways out. Below ${Math.round(R.woundedBelow * 100)}% LF: Scramble (${R.scramble.ap} AP) leaves any reach without an opportunity swing and adds ${R.scramble.moveAdd} movement until your next turn, ${w(R.scramble.uses)} times a battle. Or Play Dead, ${L.uses === 1 ? "once" : `${w(L.uses)} times`} a battle, while another of your side still stands: your turn ends, unspent AP are lost, foes look past you, you knit ${L.restPerTurn} LF a turn up to ${L.restCap}, and you earn no ultimate charge. A hit of ${Math.round(L.painShare * 100)}% or more, standing up (${L.standAp} AP), ${w(L.maxTurnsDown)} turns, a foe who sees through it, or your last ally falling or leaving the fight ends it (the last is free). Area effects still hit you, and you still block your tile.`;
  }
  // Traits. open = noticed as soon as the character is seen; hidden = must be observed (difficulty).
  //   deck modifiers: allDifficulty (added to every observation), extra (deep observations added), revealAll.
  const traits = {
    discernment:{name:"Discernment",category:"psychology",difficulty:2,text:"Each new hidden fact personally learned through Observe or Investigate gives +5% direct damage against that enemy, up to +25% for this battle. Repeated or shared knowledge adds nothing."},
    catNap:{name:"Cat Nap",text:"When she stalls, she spends 5 bankable AP per LF restored (up to 8 LF); remaining AP is banked. Full health keeps the normal bank.",open:true,unlocks:[]},
    honest:        { name: "Honest",        text: "Hides nothing about themselves.", open: true, deck: { revealAll: true }, unlocks: ["ask"] },
    complex:       { name: "Complex",       text: "There is a lot more going on than it seems.", difficulty: 2, deck: { allDifficulty: 1, extra: 2 }, unlocks: ["pointOutContradiction"] },
    guarded:       { name: "Guarded",       text: "Gives very little away.", open: true, deck: { allDifficulty: 1 } },
    stubborn:      { name: "Stubborn",      text: "Slow to change plans, even when they aren't working.", open: true, unlocks: [] },
    proud:         { name: "Proud",         text: "Can't let a challenge go unanswered.", difficulty: 1, unlocks: ["taunt"] },
    fearful:       { name: "Fearful",       text: "Afraid underneath; it only shows when things go very badly for them.", difficulty: 2, unlocks: ["frighten"] },
    impatient:     { name: "Impatient",     text: "Hates waiting; acts before thinking.", open: true, unlocks: ["makeItWait"] },
    loyal:         { name: "Loyal",         text: "Will put themselves between an ally and harm.", difficulty: 2, unlocks: ["threatenAlly"] },
    curious:       { name: "Curious",       text: "Would rather understand than win.", open: true, unlocks: ["talk"] },
    greedy:        { name: "Greedy",        text: "Everything has a price.", difficulty: 2, unlocks: ["bribe"] },
    superstitious: { name: "Superstitious", text: "Reads omens into everything.", difficulty: 3, unlocks: ["omen"] },
    lonely:        { name: "Lonely",        text: "Fights because no one asked them to stop.", difficulty: 3, unlocks: ["befriend"] },
    skittish:      { name: "Skittish",      text: "Bolts at sudden noise or threat.", open: true, unlocks: ["frighten"] },
    inSync:        { name: "In sync",       text: "Moves in step with you.", difficulty: 1, unlocks: ["coordinate"] },
    // Supers (Mala, 2026-10-08): drawn at spawn for Super Hero / Super Heroine / Super Villain (insight.js superDraw):
    // two powers (open, everyone can see them) and at least one CRITICAL weakness (hidden: Observe finds it).
    superStrength:   { name: "Super Strength", text: "Hits far harder than a person should.", open: true, combat: { abilityDamageMul: 1.15 } },
    denseMuscle: { name: "Dense Muscle", text: "Doubled physical damage (Strike, contact techniques, beast slams) and grappling (chance, cuts, squeezes); takes ×0.8 from everything but piercing.", open: true },
    superSpeed:      { name: "Super Speed", text: "Covers ground in a blur: +2 movement.", open: true, combat: { extra: { moveBudgetAdd: 2 } } },
    superDurability: { name: "Super Durability", text: "Shrugs off what would floor anyone else: all damage ×0.8.", open: true, combat: { extra: { channelDamageMul: { nigredo: 0.8, albedo: 0.8, citrinitas: 0.8, rubedo: 0.8 } } } },
    superHealing:    { name: "Super Healing", text: "Wounds close as you watch: +6 LF at the start of each turn.", open: true, combat: { extra: { healPerTurn: 6 } } },
    weakToNigredo:   { name: "Critical weakness: impact", text: "Blunt force goes straight through the power: Nigredo ×1.75.", difficulty: 2, combat: { extra: { channelDamageMul: { nigredo: 1.75 } } } },
    weakToAlbedo:    { name: "Critical weakness: piercing", text: "Fine, selective force finds the gap: Albedo ×1.75.", difficulty: 2, combat: { extra: { channelDamageMul: { albedo: 1.75 } } } },
    weakToCitrinitas:{ name: "Critical weakness: propagation", text: "What spreads, gets in: Citrinitas ×1.75.", difficulty: 2, combat: { extra: { channelDamageMul: { citrinitas: 1.75 } } } },
    weakToRubedo:    { name: "Critical weakness: resonance", text: "The right frequency undoes them: Rubedo ×1.75.", difficulty: 2, combat: { extra: { channelDamageMul: { rubedo: 1.75 } } } },
    swimmer: { name: "Swimmer", text: "Keeps their head above water during unexpected immersion.", difficulty: 1, open: true },
    // Lab record (docs/concept-design-brief.md 4b), 2026-11-11. Reference Strong 520, not sold. Comparison: Swimmer (difficulty 1, not sold) only skips surprise immersion. Sinks Like a Stone is the opposite weakness. Gills also skips the cannot-swim start and clears a drowning mark already on the holder. Dry fights are unchanged, so the reference stays Strong. Drawback: nothing on dry ground. If it were sold, removal would be 1040. Not form-only. Biology, so not imitable. Born on the Teal Eel and the Remora Adventurer. Left out of the graft catalog as what those two are, until Mala says the Lab grafts it onto other bodies.
    gills: { name: "Gills", text: "Breathes the water. Drowning does not start, and a drowning mark already on them ends, including when they also cannot swim.", difficulty: 2, open: true },
    sinksLikeAStone: { name: "Critical weakness: can't swim", text: "Sinks like a stone: water drowns them, and drowning hits ×2.5.", difficulty: 2, combat: { extra: { cantSwim: true, drowningDamageMul: 2.5 } } },
    dreamFragile:    { name: "Critical weakness: dreams", text: "Comes apart in someone else's dream: ×1.6 damage while another's Dream Space is open.", difficulty: 2, combat: { extra: { dreamFragile: 1.6 } } },
    supernaturalWeakness: { name: "Critical weakness: the supernatural", text: "Monsters and summons do double damage to them.", difficulty: 2, combat: { extra: { supernaturalDamageTakenMul: 2 } } },
    // Mala, 2026-10-12: Imagination as something a person is, not only a concept they equip. Holding this trait counts as
    // holding Imagination for Emergent Ideas (emergent-ideas.js): Proficient Summoner with Full Believer, Breakthrough
    // with Genius. It takes no concept slot and grants none of the concept's techniques.
    // Mala, 2026-10-13: what a Student has earned on reaching Master (class-runtime.js STUDY). Rules: content.js rules.mastery.
    mastery:       { name: "Mastery", text: "Nothing left to prove. Ultimates need no charge, only their action points and ΦF, and a Stall restores 10 Life Force.", difficulty: 5 },
    imaginative:   { name: "Imaginative", text: "Sees what is not there yet. Counts as holding Imagination for the ideas that grow from it: with Full Believer, a Proficient Summoner; with Genius, Breakthroughs.", difficulty: 2 },
    genius:        { name: "Genius", text: "Learns patterns quickly and sees useful connections.", difficulty: 2, open: true, combat: { abilityDamageMul: 1.05, ultimateChargeMul: 1.2 } },
    greenThumb:   { name: "Green Thumb", text: "Plants answer them. May attempt communion (no botanist bonuses).", difficulty: 1 },
    understandingGaia: { name: "Understanding Gaia", text: "Earned by witnessing communion. May attempt it; the plant accepts a quarter of the time.", difficulty: 2 },
    collector:     { name: "Collector", text: "Never leaves anything interesting behind. Values item use half again as much.", difficulty: 1 },
    fool:          { name: "Fool", text: "Misses patterns and learns through costly mistakes.", difficulty: 2, combat: { abilityDamageMul: 0.95, ultimateChargeMul: 0.8 } },
    believer:      { name: "Believer", text: "A tentative belief can draw a wild creature; deeper conviction opens a path to more dangerous things.", difficulty: 4, combat: { rareMonsterSummon: true, beliefStrength: 1 } },
    devoutBeliever:{ name: "Devout believer", text: "Their conviction can pull a lesser creature from the Dream Space.", difficulty: 4, combat: { rareMonsterSummon: true, beliefStrength: 2 } },
    fullBeliever:  { name: "Full believer", text: "Their certainty can call powerful Dream Space creatures—sometimes one, sometimes two. Contagious idea (faith): with Persuasive, preaches when they talk.", difficulty: 5, combat: { rareMonsterSummon: true, beliefStrength: 3 } },
    convertedDevout: { name: "Newly open to belief", text: "They accept that something beyond known science is real, though questions remain. Their Dream Space calls may not obey.", difficulty: 5, combat: { rareMonsterSummon: true, beliefStrength: 2, abilityDamageMul: 1.08, ultimateChargeMul: 1.15, uncontrolledDreamSummons: true } },
    convertedBeliever: { name: "Converted by experience", text: "After witnessing the impossible, conviction becomes force. Their Dream Space calls are powerful, but the creatures may not obey. Contagious idea (faith): with Persuasive, preaches when they talk.", difficulty: 5, combat: { rareMonsterSummon: true, beliefStrength: 3, abilityDamageMul: 1.12, ultimateChargeMul: 1.25, uncontrolledDreamSummons: true } },
    unexplainedEvent: { name: "An unexplained event", text: "They witnessed something extraordinary, but suspect a trick or an unfamiliar science. Their skepticism remains, with a crack in its certainty.", difficulty: 3 },
    nonBeliever:   { name: "Non-believer", text: "Summoned creatures have less hold over them, and they know where to strike. Contagious idea (faith): sermons can move them toward belief; a failed sermon can make a neutral listener one.", difficulty: 2, open: true, combat: { summonDamageDealtMul: 1.2, summonDamageTakenMul: 0.8 } },
    collaborative: { name: "Collaborative", text: "Builds momentum by coordinating with others.", difficulty: 1, open: true, combat: { abilityDamageMul: 0.98, ultimateChargeMul: 1.1 } },
    rivalrous:     { name: "Rivalrous", text: "Turns competition into force, often at the cost of shared momentum. A named rival on the field draws double hostility.", difficulty: 2, open: true, combat: { abilityDamageMul: 1.04, ultimateChargeMul: 0.9 } },
    empathic:      { name: "Empathic", text: "Can feel when someone across from them is afraid.", difficulty: 2 },
    competitive:   { name: "Competitive", text: "Chases the strongest opponent, not always the most dangerous one.", difficulty: 1, open: true },
    // C6 retaliation (muse sandbox; engine.js score()). Rolled at spawn for anyone (spawnTraits below).
    vengeful:      { name: "Vengeful", text: "Goes after whoever hurt them last, even when a better target is open.", difficulty: 2 },
    // Gambler (Mala, 2026-10-10): takes the risky line. Badly hurt, they bank action points instead of defending
    // (engine.js aiAction). Death's door favours them: it opens with half the usual action points
    // unspent (40, not 80), and twice as readily (summons-data.js rules.deathDoor.gambler).
    gambler:       { name: "Gambler", text: "Takes the risky line. Badly hurt, they hold their action points back and bet on what comes next; death's door can open for them with half the usual action points unspent, and twice as readily.", difficulty: 2 },
    // Parley (Mala, 2026-10-08; insight/parley.js): talking a fight down, or talking someone into a mistake.
    // Scout (Muse's design docs/scout-trait.md, built 2026-10-11): ranges, then comes home to tell the crew.
    // Sampler (Mala, 2026-10-18; the Mangaka): two free Clips a turn, then a free Juxtapose that charges nothing; every ultimate
    // charge is halved (engine.js chargeUltimate reads the trait, so it holds for a player-controlled Mangaka too).
    // The Aviator Hero's (Mala, 2026-10-18; class-runtime.js AERO).
    aerodynamic:   { name: "Aerodynamic", text: "Built for a straight line: +2 movement while moving straight; every change of heading costs 5 AP, and the extra tiles can't be spent on a route that turns.", difficulty: 2, open: true },
    adrenalineJunkie: { name: "Adrenaline Junkie", text: "Comes alive when it's going badly: below half LF, +10 AP and +2 ΦF at each turn's start; below a quarter, +20 AP and +4 ΦF.", difficulty: 2, open: true },
    // The Starfarer's (Mala, 2026-10-19; class-runtime.js Light Frame, actions.js Ship's Engineer).
    lightFrame:    { name: "Light Frame", text: "A light hull is fast and fragile: −10 max LF, +1 movement every turn.", difficulty: 1, open: true },
    shipsEngineer: { name: "Ship's Engineer", text: "Keeps her own works tuned: her Fabricator and Citadel arm friendly Strikes +3 instead of +2.", difficulty: 2, open: true },
    // The Pioneer's (Mala, 2026-10-19; class-runtime.js Homestead, resolve.js Marked Ground).
    homestead:   { name: "Homestead", text: "Home ground under her: damage ×0.8 while adjacent to a standing friendly structure.", difficulty: 2, open: true },
    markedGround: { name: "Marked Ground", text: "Her lines hold: Boundary barriers she raises last +1 owner turn.", difficulty: 1, open: true },
    // Rites (Muse-2, 2026-10-18): drawing a sigil doesn't root an artist to the spot (rules.rite; the ink sub-faction too).
    unendingChant: { name: "Unending Chant", text: "The words never stop: rite steps they've banked hold until spent, broken or sealed, never fizzling.", difficulty: 2, open: true },
    artist:        { name: "Artist", text: "Draws as easily as breathing: drawing a sigil in a rite doesn't stop them moving.", difficulty: 1, open: true },
    sampler:       { name: "Sampler", text: "Lifts from everything: the first two Clips each turn are free, and after two the next Juxtapose is free too (that one charges nothing). Every ultimate charge is halved.", difficulty: 2, open: true },
    // The Paladin's (PALADIN.md, Mala 2026-10-31; class-runtime.js oath, auras.js traitKnobs, ai.js): whoever controls him. Faithful swears first and stands fast; Compassionate spends the pool on the hurt; Zealous is Brave's never-flee with a believer's edge in the dream; Consecrated is the aura's numbers.
    consecrated:   { name: "Consecrated", category: "psychology", text: "Your aura is sanctified: it reaches 1 tile further, costs 5 charge a turn instead of 10, keeps charging at half rate while it burns, and hits ×1.5 as hard while an oath holds.", difficulty: 2, open: true, unlocks: [] },
    faithful:      { name: "Faithful", category: "psychology", text: "Opens with a public oath and holds its ground: when the AI plays this unit it swears first and does not step back while the oath holds.", difficulty: 2, open: true, unlocks: [] },
    compassionate: { name: "Compassionate", category: "psychology", text: "Spends mercy on the hurt: when the AI plays this unit it lays hands on itself or an adjacent ally below half life.", difficulty: 1, open: true, unlocks: [] },
    // Zealous (Mala, 2026-10-31: "operate like Brave, but also religious or true believer: high effectiveness against dream creatures and in dreams"): Brave's neverFlees, and a believer's edge in the dream (class-runtime.js damageMods).
    zealous:       { name: "Zealous", category: "values", text: "A true believer who holds the line: never flees or routes, and strikes ×1.3 harder at dream creatures and ×1.2 harder while a Dream Space is open.", difficulty: 3, neverFlees: true, open: true, unlocks: [] },
    scout:         { name: "Scout", category: "psychology", difficulty: 2, open: true, unlocks: ["report"],
      text: "Ranges ahead and comes back: after observing 3 times in a battle, seeks an ally within 3 tiles to share everything noticed. Reports once per battle." },
    talkative:     { name: "Talkative", text: "Can't stop talking. Will try to talk you down, or talk at you until you can't look away.", open: true },
    annoying:      { name: "Annoying", text: "Gets under your skin: their distractions land more often and last longer.", difficulty: 1 },
    agreeable:     { name: "Agreeable", text: "Looks for a way to agree: quicker to stand down and come to terms.", difficulty: 2 },
    speakWithAnimals: { name: "Speak with Animals", text: "Can talk an animal down the way others talk to people.", open: true },
    // Hiker (Mala, 2026-10-10): moves through planting at the ordinary cost; everyone else pays ×1.5 action points per
    // step onto a living, walkable plant (terrain/vegetation-data.js rules.plantMove). Category is PROVISIONAL: a learned
    // habit of movement fits psychology (observable and imitable) better than biology; Mala to confirm.
    hiker: { name: "Hiker", category: "psychology", text: "At home off the path: walks through brush, ferns and hedges as if they were open ground.", open: true, difficulty: 1 },
    // Field botany (Mala, 2026-10-10): the Field Botanist's training. Ties the class to the plant systems
    // (terrain/communion-data.js rules.botanist): plants are read faster, cost less to commune with and come out hardier.
    // Horticulture Expertise (Muse C24; terrain/communion-data.js rules.horticulture): the plant-command trait.
    horticultureExpertise: { name: "Horticulture Expertise", category: "psychology", text: "Keeps what grows for them alive: each turn, communed plants within 2 tiles recover 2 LF and get a fresh Green ward, and their plants range further from them.", open: true, difficulty: 2 },
    // Animist (Tsukumogami slice 1; Mala, 2026-10-29): granted once, account-wide, when the first item in the
    // account's care reaches Awakened (account/loot.js logCare). The gate for observing structures.
    kitchenAnimism: { name: "Kitchen Animism", category: "psychology", text: "Has watched food wake up and knows how it is done: can commune with ingredients (not structures).", open: true, difficulty: 2 },   // ingredient totems (Mala, 2026-11-07): learned by a cook who sees an ingredient wake; rare on cooks
    animist: { name: "Animist", category: "psychology", text: "It was never just a thing. You can commune with structures.", open: true, difficulty: 1 },
    // Grappler and Reach (Mala, 2026-10-11; content.js rules.grapple.grappler and rules.strike.reach).
    grappler: { name: "Grappler", category: "psychology", text: "Trained in the clinch: Grapple costs 20 action points instead of 35, and once a turn a Strike on a held opponent is free up to a balanced strike.", open: true, difficulty: 2 },
    longHunt: { name: "The Long Hunt", category: "psychology", text: "Has the trail before the fight starts: on his first turn, one Read Sign costs nothing.", open: true },
    strongGrip: { name: "Strong Grip", category: "biology", text: "Hands that do not let go: a Grapple always lands, whatever the defence. An enemy in the hold is hurt each round, and climbing or jumping down costs half.", open: true },
    reach: { name: "Reach", category: "biology", text: "Long limbs: a Strike, punch or kick, lands from two tiles away. Grapple still needs contact.", open: true },
    telepathy: { name: "Telepathy", category: "biology", text: "Reads minds: Observe reveals every one of the target's traits at once.", open: true },
    telekinetic: { name: "Telekinetic", category: "biology", text: "Moves matter with their mind: a Strike lands from three tiles away.", open: true },
    vegetativePropagation: { name: "Vegetative Propagation", category: "biology", text: "Severed parts regrow: their communed plants regrow 2 LF at each of their turns.", open: true },
    robot: { name: "Robot", category: "biology", text: "A machine. Robot Haters hit it harder, nobody can be talked round about it, and while one stands on the field Robot Sympathizers can make their case.", open: true },
    highTolerance: { name: "High Tolerance", category: "biology", text: "Shrugs off intoxicants: immune to inebriation.", open: true },
    visage: { name: "Visage", category: "biology", text: "Its face is a weapon: a foe that ends its turn within 2 tiles meets its gaze (fear at advantage, floor 50%; dread-marked). The Emissary is born with it.", open: true },
    // Material traits (Tsukumogami slice 4; Mala's traits rule: materials as traits, not dials). Biology:
    // innate, never imitable. Carried only by awakened structures (terrain/tsukumogami.js makeAlly).
    light: { name: "Light", category: "biology", text: "Light wooden frame: moves 1 tile further.", difficulty: 1 },
    heavy: { name: "Heavy", category: "biology", text: "Heavy stone body: Strikes land 2 harder.", difficulty: 1 },
    rigid: { name: "Rigid", category: "biology", text: "Rigid metal frame: moves 1 tile less, takes ×0.85 damage.", difficulty: 1 },
    brittle: { name: "Brittle", category: "biology", text: "Brittle glass body: takes ×1.5 damage.", difficulty: 1 },
    botanist: { name: "Field Botany", category: "psychology", text: "Knows plants by name and habit: reads one in half the time, communes for less, and what answers them comes out hardier.", open: true, difficulty: 1 },
    comparative: { name: "Comparative", category: "psychology", text: "Observes enemy techniques, compares them for common descent, and prepares an ally against the technique it can predict.", open: true, difficulty: 1 },   // Homology (Mala, 2026-11-04): the trait graph/homology-rules.js aiAct reads
    // Biology (Mala, 2026-10-10): innate, never imitable. Who carries it: classes-data.js `magic` (kept in step by
    // tests/performers.test.mjs). It decides how a Bard's charm and a Musician's song take (kits-data.js soothe tables).
    touchedByMagic: { name: "Touched by Magic", category: "biology", text: "Made of magic, or shaped by it early. Charms meet practiced resistance in a person like this; a creature like this is drawn to them.", difficulty: 2 },
    immortal:      { name: "Immortal", text: "Doesn't die the way others do. Old things that look down on mortals will speak to them.", difficulty: 4 },
    // speech (Mala, 2026-10-12): Persuasive lifts every talk-based chance by chanceAdd: Talk and coming to terms (parley.js),
    // Befriend and Frighten (insight.js resolveAction), Make the Case (class-runtime.js ROBOT). Keep the three numbers equal
    // (tests/persuasive.test.mjs). Taunt and Bribe have no roll to lift.
    // Rapping and singing count (performers.js PERSUASIVE): songs soothe 15 points more often, verses and Diss Track hit 15% harder.
    // Nobody among the performers has it by nature; anyone can roll it (spawnTraits below).
    persuasive:    { name: "Persuasive", text: "Knows how to move a room: anything done by talking, rapping or singing works better. Talking someone down, coming to terms, befriending, frightening, making a case, a soothing song, a verse.", open: true,
      speech: { chanceAdd: 0.15, actions: ["talk", "comeToTerms", "befriend", "frighten", "makeTheCase"], sootheAdd: 0.15, verseMul: 1.15 } },
  };

  // ── Trait registry, T1 (Muse's spec ~/Documents/concept-combat-traits.md; Mala 2026-10-10: "push further in that
  // direction, especially before imitation is implemented"). Nine biology and eleven values traits join the
  // registry, and EVERY trait gets a category:
  //   biology     innate; never imitable; changes only by experimentation (a later mechanic)
  //   psychology  patterns of feeling and behaviour; observable and imitable
  //   values      what someone stands for; observable and imitable, one step harder than psychology
  //   state       not a trait of character at all: a tag the engine sets (kept out of every menu)
  // `text` says only what the game does today. Where the planned effect needs an engine hook that does not exist
  // yet, it is in `planned` and the text stays descriptive. AI goal weights are in ai/workflow.js TRAITS.
  Object.assign(traits, {
    // psychology added with the trap port (C14): a learned knack. Mala to confirm the category.
    tinkerer:      { name: "Tinkerer", text: "Good with mechanisms: +30% to disarm a trap, and more willing to try.", difficulty: 2 },
    // C15 (Muse batches 13-15; Mala ruled them opposites). Psychology assumed.
    contemplative: { name: "Contemplative", text: "Finds stillness easily: meditates often and deeply (+35 ultimate charge instead of +25).", difficulty: 2 },
    // Concentration spectrum (Mala, 2026-10-17; docs/concentration-traits.md). kMul scales K in the concentration roll
    // (engine/damage.js concentrationCheck). One exclusive draw (focusSpawn below); an authored holder skips it.
    perfectConcentration: { name: "Perfect Concentration", text: "A rare gift: nothing breaks their focus. Concentration holds three times as well (an 8 LF blow: 79%); their dream rolls only below 15% LF and drains 5 less a turn; they may shift one tile a turn mid-chant; talkers cannot distract them and a talk-down holds one turn; half of taunts slide off; they rout half as easily and lose half as much to stuns; they meditate deeply and study others closely.", kMul: 3, difficulty: 3 },
    focused:       { name: "Focused", text: "Hard to shake: concentration holds better (an 8 LF blow: 69%).", kMul: 1.75, difficulty: 2 },
    scattered:     { name: "Scattered", text: "Easily shaken: concentration holds worse (an 8 LF blow: 43%).", kMul: 0.6, difficulty: 1 },
    adhd:          { name: "ADHD", text: "Focus slips (an 8 LF blow: 33%), but variety comes easy: an action unlike the last costs 10% less; the same one again costs 25% more, then 50% more each time after.", kMul: 0.4, difficulty: 2 },
    restless:      { name: "Restless", text: "Cannot settle: meditates rarely and poorly (+15), but dodges for 20 fewer action points.", difficulty: 2 },
    insaneReflexes: { name: "Insane Reflexes", category: "biology", text: "Reacts before thought: dodges incur half AP debt, and a dodge may spend a full 50 AP to throw a shuriken mid-dodge (6 damage plus Bleed: 2 LF a turn for a rolled 2-5 turns).", open: true, combat: { dodgeDebtMul: 0.5, dodgeThrow: { ap: 50, damage: 6, bleedDrain: 2, bleedTurns: [2, 5] } } },
    stickyFingers: { name: "Sticky Fingers", category: "biology", text: "Every landed strike lifts the victim's best consumable; empty pockets yield nothing — for time-theft, Pickpocket.", open: true, combat: { stealOnStrike: true } },
    godlyAgility: { name: "Godly Agility", category: "biology", text: "Dodges accrue no AP debt, and every attack or technique against him is reduced by a rolled 25-100% — unless it has the direct-hit quality.", open: true, combat: { dodgeDebtMul: 0, elusive: { minReduction: 0.25, maxReduction: 1.0 } } },
    drunkenMonkey: { name: "Drunken Monkey Style", category: "psychology", text: "Unpredictable: all his attacks carry the direct-hit quality — foes cannot dodge them or negate the damage with Guard, Rebound, Membrane, or wards.", open: true, combat: { directHit: true } },
    playfulness: { name: "Playfulness", text: "Tests themselves against the strong: prefers foes who fight (recent damage, big presence) and snubs supports and healers who never strike.", difficulty: 2 },
    // Stoner (Mala, 2026-10-12): Cyph's haze. Behavior needs the aura engine hook; mechanics in `planned` until ported.
    stoner:        { name: "Stoner", text: "Always hazy, unbothered by smoke.", difficulty: 2, planned: "Pops their aura free at battle start; each technique thickens the cloud (+1 aura radius, up to +3); technique charge flows despite the open aura; immune to inebriation." },
    // Speed-Talker (Mala, 2026-10-12). Behavior needs the Insight cost/odds hook; mechanics in `planned` until ported.
    // Speed-Talker (Mala via Muse, built 2026-10-11): talking costs half, and lands 85% as often. `speech` is read by
    // the engine for the player's talk-based Insight actions and for an NPC's Talk (parley).
    speedTalker:   { name: "Speed-Talker", text: "Talks fast and moves on: Talk, Befriend, Taunt and Frighten cost half the action points, and land 85% as often.", difficulty: 2,
      // attackTalkers (Mala, 2026-10-11): for these classes every attack is talk, so with the trait their techniques and
      // their Strike also cost half and land 85% as often. A rapper's bars are his blows.
      speech: { actions: ["talk", "befriend", "taunt", "frighten"], apMul: 0.5, effectMul: 0.85, attackTalkers: ["rapper"] } },
    // biology
    survivalInstincts: { name: "Survival Instincts", category: "biology", text: survivalText(SURVIVAL), difficulty: 1 },
    keenSenses:    { name: "Keen Senses", text: "Notices what others miss.", open: true, planned: "Observe costs 20% fewer AP; one extra card open on any deck it builds." },
    twentyTwentyVision: { name: "20/20 Vision", category: "biology", text: "Reads fine visual details: each Observe has one extra point toward a visible tell or biological trait. Clear sight is still required; unused visual effort does not carry over.", open: true },
    nightSighted:  { name: "Night-Sighted", text: "Sees in poor light.", difficulty: 2, planned: "Smoke and Dream Space haze do not block its sight." },
    hardy:         { name: "Hardy", text: "Shrugs off rough ground and weather.", open: true, planned: "Terrain-entry hazards and heat stress x0.5." },
    fleetFooted:   { name: "Fleet-Footed", text: "Quick on its feet, short of super speed: +1 movement.", open: true, combat: { extra: { moveBudgetAdd: 1 } } },
    // Cavalry and Heavy Armor (Mala, 2026-10-13): the Knight's body. Biology, so nobody imitates them.
    // Cavalry is the first owner turn only. Heavy Armor is a ward replaced each round. Wired in turns.js.
    cavalry:       { name: "Cavalry", text: "Closes on the first turn: +4 movement that turn (7 instead of the normal 3). Each step still costs 10 action points. After that turn, movement is 3 again.", open: true },
    heavyArmor:    { name: "Heavy Armor", text: "Plate that thins as the fight goes on: a ward of 10 on round 1, then 9, 8, 7, down by 1 each round until 0. A hit spends the ward. The next round replaces it at the next number, even if the plate broke.", open: true },
    plantKin:      { name: "Plant-Kin", text: "Green in the blood.", difficulty: 2, planned: "+2 LF at turn end on soil, mulch or growth; fire x1.25; Simples x1.25." },
    ironStomach:   { name: "Iron Stomach", text: "Hard to dose.", difficulty: 2, planned: "Herbal overdoses and poison x0.5; tolerance sets in one dose later." },
    frail:         { name: "Frail", text: "A body that gives out early: 10 less maximum LF.", difficulty: 2, combat: { extra: { maxLFAdd: -10 } }, planned: "Single hits of 15 or more also stagger." },
    resonantVoice: { name: "Resonant Voice", text: "A voice that carries.", open: true, planned: "Harmony and Lyricism techniques +1 range; its tells are always announced." },
    dreamTouched:  { name: "Dream-Touched", text: "Shaped by dreams the way others are by weather.", difficulty: 3, planned: "Dream Space effects x1.25 on it, good and bad; dream monsters target it last." },
    // values
    // Main Character Energy (Mala, 2026-10-15): the Warden's. He never flees, which makes him a steady combat benchmark:
    // no fear check, no visage, no ally falling routs him (engine/conditions.js fearless, heroFell).
    mainCharacterEnergy: { name: "Main Character Energy", text: "He never runs, he faces all the characters in his psyche head on.", difficulty: 3, neverFlees: true },
    // The Director's three (Mala, 2026-10-15; docs/director.md). Native to the class, never dealt at random.
    attentionToDetail: { name: "Attention to Detail", text: "Improves the quality of constructions, summons and barriers: +25% HP, potency or duration. The care costs slightly: +5 AP on those actions.", difficulty: 3 },
    directorsVision: { name: "Director's Vision", text: "Reads actors: studies gain +2 visual points and cost 5 fewer AP. He observes the mark before he traps it.", difficulty: 2 },
    knowsPeople: { name: "Knows People", text: "Rolls each turn with no cameo active for a 35% chance to summon the Actor for 4 turns. A live cameo teleports into the pocket alongside the star and the co-star.", difficulty: 3 },
    awardWinningDirector: { name: "Award Winning Director", text: "Legendary: +1 Inspiration every turn, and 1 Inspiration films a sequel. A dud ends the streak (and still bills the 35 AP).", difficulty: 4 },
    // The Actor's three (Mala, 2026-10-16; docs/actor-respec-rulings.md). Native to the class, never dealt at random.
    methodActing: { name: "Method Acting", text: "Steps out of a role when the run ends and keeps one trait from the part (single slot: the new keep replaces). Charge carries; role summons and buffs persist.", difficulty: 3 },
    theLook: { name: "The Look", text: "10% per damaging move to stagger an enemy, at most once per enemy per turn. A stagger eats the enemy's reaction.", difficulty: 2 },
    // Hotbuilds wave 1 (The Hypnotist): Entrainer carries his AI table and names his subject; Gentle Hand stays itself once per foe.
    entrainer: { name: "Entrainer", category: "psychology", text: "Sets one subject and keeps it: his attention sits on a single foe (the Focus mark).", difficulty: 2 },
    gentleHand: { name: "Gentle Hand", category: "values", text: "The first lethal blow he lands on each foe leaves that foe at 1 LF, once per foe per battle.", difficulty: 2 },
    arcaneMastery: { name: "Arcane Mastery", category: "psychology", text: "Every spell carries a rider: offensive techniques curse each enemy they reach (exposed, entangled, or bleeding); support techniques bless each ally they reach (warded, membraned, or recharged).", difficulty: 3 },
    humanExperience: { name: "The Human Experience", text: "14 willpower instead of 10, and parlays land 20% better. Has lived enough to argue anything.", difficulty: 3 },
    courageous:     { name: "Courageous", text: "Fear does not decide for them: Frighten lands on them far less often, and they hold when an ally falls.", difficulty: 3, fearResist: 0.15 },
    brave:          { name: "Brave", text: "Holds the line: never flees, never routes, whatever falls around them.", difficulty: 3, neverFlees: true },
    reckless:       { name: "Reckless", text: "Presses the attack: favors hurting over setup and survival, but pain still moves them.", difficulty: 2 },
    protective:     { name: "Protective", text: "Stays by its allies: closes on them, and favors guarding where its kit allows.", difficulty: 2 },
    neverGiveUp:    { name: "Never Give Up", text: "Hardship inspires him: the worse it gets, the likelier each turn starts with Inspiration.", difficulty: 2 },   // docs/inspired-ultimates.md; the roll is engine/ledgers.js Inspiration.hardship
    merciful:       { name: "Merciful", text: "A beaten opponent is not a target: presses less, supports more.", difficulty: 3, planned: "Holds back from a foe under 20% LF that did not hit them last round." },
    honorable:      { name: "Honorable", text: "The fight should be fair and announced: goes for the strong, not the exposed.", difficulty: 3, planned: "Will not strike a stunned, soothed or unaware target." },
    // Dreamer (Mala, 2026-10-13): a value anyone can roll. Opens a Dream Space at a full bar, and an AI-run Dreamer
    // prefers it whenever the ultimate has nothing worth hitting (engine/ai.js, content.js rules.dreamer).
    dreamer:        { name: "Dreamer", text: "Would rather change the place than spend the moment: opens a Dream Space at a full bar, and does so when the ultimate has nothing worth hitting.", difficulty: 2 },
    dutiful:        { name: "Dutiful", text: "An order given is an order kept, after it stops being smart.", difficulty: 2 },
    byTheBook:     { name: "By the Book", text: "The chain is the job: a successful Grapple on a cuffed opponent pays 50 ultimate charge at once.", difficulty: 2 },
    thrifty:        { name: "Thrifty", text: "Nothing is spent that does not need to be: prepares, holds back.", difficulty: 2 },
    pacifist:       { name: "Pacifist", text: "Will not press a fight: guards, supports and positions.", difficulty: 4, planned: "Never strikes first; once hit, defends only against that attacker." },
    steward:        { name: "Steward", text: "The land is in their care: protects, prepares.", difficulty: 3, planned: "Will not destroy plants; targets whoever damages them." },
    truthSeeker:    { name: "Truth-Seeker", text: "Would rather know than be comfortable: observes before acting.", difficulty: 3, planned: "Deception takes on them 25% less often." },
    charitable:     { name: "Charitable", text: "What they have is for whoever needs it: supports the weakest first.", difficulty: 2 },
    traditionalist: { name: "Traditionalist", text: "The old way is the right way: repeats what worked.", difficulty: 2, planned: "Resists being made Outmoded." },
    // Mala, 2026-10-30 (the Chef): "Culinary Training for Psychological trait, means he gets one free fresh station per turn." Read by mise/mise.js.
    culinaryTraining: { name: "Culinary Training", text: "Years on the line: eating or drinking food costs 10 fewer AP (never under 5); and once a turn, the first Rack and Label laid costs nothing, unless it goes on a tile where a station was used this turn or last round.", difficulty: 2 },
    // Mala, 2026-10-11: the value that goes with the Craftsmanship concept. Wired today through goal weights only.
    craftsmansMindset: { name: "Craftsman's Mindset", text: "The work should be done properly or not at all: prepares, repeats what it has practised, and will not be hurried. It cannot overclock or borrow action points from a future turn, and in return everything it does is 15% stronger. With Craftsmanship it holds one more practice stack.", difficulty: 3 },
    // Mala, 2026-10-12 (docs/post-humanity.md; engine.js PostHuman). Roko's Basilisk spares a sympathizer and their AI
    // will not target a transcended AI. It is no protection when the AI decides to exterminate everyone.
    robotSympathizer: { name: "Robot Sympathizer", text: "On the machines' side, and the machines know it: a transcended AI that only settles scores leaves them out of it, and they will not raise a hand against one. Contagious idea (machine sympathy): makes the case to others.", difficulty: 2 },
    robotHater: { name: "Robot Hater", text: "Has heard the case for the machines and rejected it: hits robots a little harder, and goes for an AI the moment it transcends. Contagious idea (machine sympathy): the anti-trait a failed case can leave.", difficulty: 2 },
    animalLover: { name: "Animal Lover", text: "Loves animals: pets the cat when close, and crosses the room to do it.", difficulty: 2 },
    animalHater: { name: "Animal Hater", text: "Hates animals: never pets the cat.", difficulty: 2 },
    // The Animal Tamer's craft (Mala, 2026-10-14; engine/tamer.js): tames wild animals beside him, marks one as a vessel.
    beastTamer: { name: "Beast Tamer", text: "Tames the wild animal beside him (it fights at his side), marks one as his vessel, and when he falls wakes in its body.", difficulty: 3 },
    // Mala, 2026-10-14: a value trait. When the other side puts a pet out (a summon, a communed plant, a released bead,
    // a tamed creature), they answer in kind if they can, and their pets go for the other side's pets first (engine/ai.js).
    petFighting: { name: "Pet Fighting", text: "Loves making pets fight each other: answers a summon or a communed plant with one of their own, and sets theirs on the other side's.", difficulty: 2 },
    ambitious:      { name: "Ambitious", text: "Wants to be seen winning: goes for the biggest name and the finishing blow.", difficulty: 2 },
    // Given by eating a fruit with the feat model on (Mala, 2026-11-01: a trait that encourages the techniques, for anyone who eats the fruit). Nobody spawns with it, nobody can imitate it.
    fruitbound: { name: "Fruitbound", text: "The power is who they are. In a fight they reach for the fruit's techniques (Wind the Spring, Mainspring, Fog Bank, Weather Front, Vapour Step, Scent, Take the Shape, Full Shape) when the moment fits: the AI weighs each of them above what it costs, so they are pressed where a plain attack would otherwise always win. Given by eating a fruit; nobody is born with it.", open: true, formOnly: true },
    // The Cyborg form's two (docs/brain-chip.md). They exist only while the Brain Chip's form is up: bosses.js pushes
    // them on and takes them off. Nobody spawns with either.
    distributedIntelligence: { name: "Distributed Intelligence", category: "biology", text: "Thinks through its towers: its attacks reach as far, and see as much, from any of its drone towers as from where it stands. Nothing reaches it back through them.", open: true },
    cybernetic: { name: "Cybernetic", category: "biology", text: "Part machine: +1 movement, Strikes +3, Grapples 25 points likelier, dodges 15 action points cheaper, every damage type ×0.85, and seeing an AI transcend is worth an Inspiration.", open: true },
    ceaselessAdaptation: { name: "Ceaseless Adaptation", text: "The body relearns every blow: from the second hit of a damage type taken during the Cyborg form, that type lands ×0.85. Never an immunity.", open: true, formOnly: "cyborg" },
    perfectMemory:       { name: "Perfect Memory", text: "Nothing observed is lost: Observing a subject with nothing left to learn costs no action points. It reveals nothing unobserved.", open: true, difficulty: 3, formOnly: "cyborg" },
    // Form traits (learned forms, 2026-10-17; docs/learned-forms.md): granted while a form is held or vowed, gone on release.
    // Biology + formOnly (the Cyborg's precedent): nobody spawns with them and nobody can imitate them.
    fireblooded: { name: "Fireblooded", text: "Dragon-blooded: fire is home. Burning ground does not hurt them.", open: true, formOnly: true },
    territorial: { name: "Territorial", text: "Dragon-blooded: within 2 tiles of where they took the form, they deal 15% more and take 20% less.", open: true, formOnly: true },
    quenchable: { name: "Quenchable", text: "Dragon-blooded's flaw: on water or in rain, holding the form drains twice as much.", open: true, formOnly: true },
    ascended: { name: "Ascended", text: "A body past its limits: Strikes land +5, +1 movement, flight that ignores terrain. Grounded still grounds it.", open: true, formOnly: true },
    spiritSight: { name: "Spirit Sight", text: "Oni-blooded: sees through illusions and false lights.", open: true, formOnly: true },
    astralPresence: { name: "Astral Presence", category: "spiritual", difficulty: 4, text: "True manifestation: on the astral plane they keep their own form and kit — a fixed resident kit cannot hold them. Invisible to ordinary sight; only a seer can notice it." },
    ruleOfTheThreshold: { name: "Rule of the Threshold", text: "Oni-blooded: a foe below half LF that they have already hit takes 20% more from them.", open: true, formOnly: true },
    purified: { name: "Purified", text: "Oni-blooded's flaw: light (albedo) lands ×1.25.", open: true, formOnly: true },
    exoskeleton: { name: "Exoskeleton", text: "Chitin Knight: can't be knocked back, and the first hit each round deals 5 less.", open: true, formOnly: true },
    broodmind: { name: "Broodmind", text: "Chitin Knight: big hits wake the brood (larvae are not drawn yet).", open: true, formOnly: true },
    molting: { name: "Molting", text: "Chitin Knight's flaw: every third turn in form the shell comes off: ×1.15 damage taken and no Exoskeleton, but they heal 15.", open: true, formOnly: true },
    illusory: { name: "Illusory", text: "An illusion, a lure: it makes no hostile moves. The first blow ends it.", open: true, formOnly: true },   // Surpanakha flee chain S1: the golden deer (content.js marichaDeer body; parley.js blocks)
    faceless: { name: "Faceless", text: "Faceless: nothing to read. No tells, and their traits can't be exploited.", open: true, formOnly: true },
    unbearable: { name: "Unbearable", text: "Faceless: a foe who starts its turn beside them faces fear.", open: true, formOnly: true },
    hollow: { name: "Hollow", text: "Faceless's flaw: nothing heals them while the form is held.", open: true, formOnly: true },
    rootbound: { name: "Rootbound", text: "One With Nature: on living ground they can't be moved and holding the form drains only 2.", open: true, formOnly: true },
    greenblood: { name: "Greenblood", text: "One With Nature: plants beside them heal 2 each at their turn start (max 6).", open: true, formOnly: true },
    woundedLand: { name: "Wounded Land", text: "One With Nature's flaw: on dead ground holding drains double, and fire lands ×1.5.", open: true, formOnly: true },
    takeoff: { name: "Takeoff", text: "Cyborg: every turn the form is held, its Strike and techniques gain 1 potency (max +5) and the hold drains 1 more.", open: true, formOnly: true },
    overheat: { name: "Overheat", text: "Cyborg's flaw: resonance (rubedo) lands ×1.25 and knocks Takeoff back by 2.", open: true, formOnly: true },
    platform: { name: "Platform", text: "Founder Mode: foes beside them lose 10 AP at the start of the founder's turn (rent).", open: true, formOnly: true },
    goldenParachute: { name: "Golden Parachute", text: "Founder Mode: the first time the form would leave them under a quarter of their LF, they're released at a quarter instead.", open: true, formOnly: true },
    burnRate: { name: "Burn Rate", text: "Founder Mode's flaw: holding the form drains 2 more every turn.", open: true, formOnly: true },
    // Anime theorycraft batch (docs/anime-trait-draft.md, 2026-10-26): 23 biology traits from the 8 anime runs
    // + syncretism + tree research. Mechanics land per-batch; unhooked halves stay in `planned` (text describes only
    // what the game does today).
    ironJaw: { name: "Iron Jaw", category: "biology", text: "A chin carved from the quarry: rattles pass in 1 turn.", open: true, planned: "Head-targeted strikes ×0.8 (needs head-targeting)." },
    poisonAffinity: { name: "Poison Affinity", category: "biology", text: "Yanagi's grandchildren: poison they deal lasts +1 round; poison they take −1 (min 1).", difficulty: 2 },
    crushingHands: { name: "Crushing Hands", category: "biology", text: "Squeeze first, ask later: Strong Grip squeezes +2 LF.", open: true },
    packMule: { name: "Pack Mule", category: "biology", text: "Carries the party's everything: +4 battle hands, +10 stash.", open: true, combat: { extra: { battleSlotsAdd: 4, stashLimitAdd: 10 } } },
    fourArms: { name: "Four Arms", category: "biology", text: "Twice the reach: Strikes ×2 at ×1.5 AP, grapples +25%, +2 battle hands.", open: true, combat: { extra: { battleSlotsAdd: 2 } } },
    trepanation: { name: "Trepanation", category: "biology", text: "A hole in the skull. Weaker in the waking world (ability potency ×0.8, −10 AP each turn). Inside any Dream Space they occupy: potency ×1.4, +3 ΦF regen, +15 AP, and one extra dream Observe point. A dream they open needs less charge and lets more through.", open: true, difficulty: 3 },
    typedSoul: { name: "Typed Soul", category: "biology", text: "Water-signed: their aura has a readable type.", difficulty: 2, planned: "BLOCKED on aura-type system: Water Divination reveals type; on-type +10%, off-type −10%." },
    gyoEyes: { name: "Gyo Eyes", category: "biology", text: "Eyes that never stop looking: a Concealed foe within 3 tiles can't hide from their sight-lines.", open: true },
    heavyBones: { name: "Heavy Bones", category: "biology", text: "Dense frame: +8 maximum LF; climbing costs double.", open: true, combat: { extra: { maxLFAdd: 8, climbCostMul: 2 } } },
    copyEye: { name: "Copy Eye", category: "biology", text: "Sees once, keeps till dusk: one witnessed technique per battle, this battle only.", difficulty: 2 },
    oneBlindSpot: { name: "One Blind Spot", category: "biology", text: "Near-perfect sight, one flaw: attacks from directly behind land harder.", difficulty: 2, planned: "Attacks from directly behind ×1.25 (needs facing system)." },
    treeWalker: { name: "Tree Walker", category: "biology", text: "Water runs normal under them; uphill steps cost nothing.", open: true, planned: "Walls/ceilings (no wall-phase or ceiling systems)." },
    vesselBody: { name: "Vessel Body", category: "biology", text: "+5 maximum LF; Strikes land +1.", open: true, combat: { extra: { maxLFAdd: 5 } }, planned: "Sealed things ride quiet (no sealed-condition system)." },
    soulLayers: { name: "Soul Layers", category: "biology", text: "More than one tenant: control slips sooner.", difficulty: 2, planned: "Possession/control −1 round (min 1); soul-grips break easier." },
    looseFit: { name: "Loose Fit", category: "biology", text: "Worn bodies welcome: marking a vessel costs −10 AP.", difficulty: 1, planned: "Transmigration crossing unbuilt (second half waits)." },
    vatGrown: { name: "Vat Grown", category: "biology", text: "No scars: staggers pass in 1 turn.", open: true, planned: "Healing received +1 per instance (needs heal funnel — 20 scattered sites). Trauma is mirror-side, not durations (dropped)." },
    shockEater: { name: "Shock Eater", category: "biology", text: "Forgets the blow: the first stagger or stun each battle never happened (−2 max LF for the battle).", difficulty: 2 },
    pluggedEye: { name: "Plugged Eye", category: "biology", text: "Sees the hand: one foe's plan per battle, read plain.", difficulty: 2, planned: "Once per battle, learn one foe's held technique or plan." },
    oldBlood: { name: "Old Blood", category: "biology", text: "Old blood: heritage gates open for them.", open: true, planned: "Counts as bloodline-connected for heritage gates as they ship." },
    deepWells: { name: "Deep Wells", category: "biology", text: "More fuel than frame: ΦF maximum +6.", difficulty: 1, combat: { extra: { maxPFAdd: 6 } } },
    redSliver: { name: "Red Sliver", category: "biology", text: "Burns soul-fuel: techniques +2 potency; −2 maximum LF.", open: true, combat: { extra: { potencyAdd: 2, maxLFAdd: -2 } } },
    automailLimb: { name: "Automail Limb", category: "biology", text: "Winry-grade arm: Strikes land +3.", open: true, planned: "Limb-targeted effects ×1.5 (called shots unbuilt)." },
    softSoles: { name: "Soft Soles", category: "biology", text: "Moves quiet: sound never gives them away.", difficulty: 1, planned: "Sound-based detection/lures/traps don't trigger on movement." },
    filterLungs: { name: "Filter Lungs", category: "biology", text: "Pit air was worse: bad air means nothing; smoke half.", open: true, planned: "Immune spores/stench/bad air; smoke damage ×0.5." },
    openVessel: { name: "Open Vessel", category: "biology", text: "Flesh is contested: grafts, mends, and riders all take twice as well — both ways.", difficulty: 2, planned: "Grafts/heals/possession ±2 both directions." },
    atlasBones: { name: "Atlas Bones", category: "biology", text: "Mapped in marrow: falls cost no LF (the stagger still lands).", open: true, planned: "Tree travel (chain D unlanded)." },
  });
  const traitCategories = {
    biology: ["swimmer", "gills", "superStrength", "superSpeed", "superDurability", "superHealing", "weakToNigredo", "weakToAlbedo", "weakToCitrinitas", "weakToRubedo", "sinksLikeAStone",
      "dreamFragile", "supernaturalWeakness", "immortal", "catNap", "touchedByMagic",
      "survivalInstincts", "keenSenses", "twentyTwentyVision", "nightSighted", "hardy", "fleetFooted", "cavalry", "heavyArmor", "plantKin", "ironStomach", "frail", "resonantVoice", "dreamTouched", "reach", "strongGrip",
      "telepathy", "telekinetic", "denseMuscle", "vegetativePropagation", "highTolerance", "robot", "ceaselessAdaptation", "insaneReflexes", "cybernetic", "distributedIntelligence", "stickyFingers", "visage", "godlyAgility", "theLook", "perfectConcentration", "adhd", "fireblooded", "territorial", "quenchable", "spiritSight", "ruleOfTheThreshold", "purified", "exoskeleton", "broodmind", "molting", "faceless", "unbearable", "hollow", "rootbound", "greenblood", "woundedLand", "takeoff", "overheat", "platform", "goldenParachute", "burnRate"   /* form traits (learned forms, 2026-10-17; formOnly) */, "aerodynamic", "lightFrame", "ascended",
      /* anime theorycraft batch, 2026-10-26 */ "ironJaw", "poisonAffinity", "crushingHands", "typedSoul", "gyoEyes", "heavyBones", "copyEye", "oneBlindSpot", "treeWalker", "vesselBody", "soulLayers", "looseFit", "vatGrown", "shockEater", "pluggedEye", "oldBlood", "deepWells", "redSliver", "automailLimb", "softSoles", "filterLungs", "openVessel", "atlasBones",
      /* feats batch, 2026-10-27 */ "packMule", "fourArms",
      /* tsukumogami structures, 2026-10-29 */ "heavy", "rigid", "brittle", "light",
      /* trepanation, 2026-10-30 */ "trepanation", /* Surpanakha flee chain S1, 2026-11-09: form-only, the golden deer */ "illusory"],
    psychology: ["discernment", "honest", "guarded", "stubborn", "proud", "fearful", "impatient", "curious", "greedy", "superstitious", "lonely", "skittish", "empathic", "competitive",
      "collaborative", "rivalrous", "talkative", "annoying", "agreeable", "persuasive", "imaginative", "mastery", "inSync", "genius", "fool", "speakWithAnimals", "vengeful", "gambler", "hiker", "botanist", "comparative", "longHunt", "horticultureExpertise", "tinkerer", "contemplative", "restless", "grappler", "stoner", "speedTalker", "scout",
      "greenThumb", "understandingGaia", "collector", "perfectMemory", "drunkenMonkey", "beastTamer", "mainCharacterEnergy",
      "attentionToDetail", "culinaryTraining", "directorsVision", "knowsPeople", "methodActing", "focused", "scattered", "sampler", "adrenalineJunkie", "artist", "unendingChant", "shipsEngineer", "arcaneMastery",
      /* tsukumogami self-trait, 2026-10-29 */ "animist", /* ingredient totems, 2026-11-07 */ "kitchenAnimism",
      /* the Paladin, 2026-10-31 (PALADIN.md) */ "consecrated", "faithful", "compassionate",
      /* the respec fruit, 2026-11-01 */ "fruitbound",
      /* the Hypnotist, 2026-11-03 (hotbuilds W1a) */ "entrainer"],
    values: ["believer", "devoutBeliever", "fullBeliever", "convertedDevout", "convertedBeliever", "nonBeliever", "loyal",
      "robotSympathizer", "robotHater", "courageous", "brave", "neverGiveUp", "merciful", "zealous", "honorable", "dutiful", "thrifty", "pacifist", "steward", "truthSeeker", "charitable", "traditionalist", "ambitious", "craftsmansMindset", "dreamer", "animalLover", "animalHater", "playfulness", "petFighting", "awardWinningDirector", "humanExperience", "homestead", "markedGround", "byTheBook", "reckless", "protective",
      /* the Hypnotist, 2026-11-03 (hotbuilds W1a) */ "gentleHand"],
    state: ["complex", "unexplainedEvent"],
    spiritual: ["astralPresence"],   // soul traits (Mala, 2026-10-24): invisible unless the observer is a seer (seesSpirits, planned); rolled like anything else but far rarer for the average person
  };
  for (const [category, ids] of Object.entries(traitCategories)) for (const id of ids) if (traits[id]) traits[id].category = category;
  // Dynamics (spec section 6): which traits make another harder (counters) or easier (synergies) to imitate. A pair
  // is written once, on either trait; `dynamicsOf` reads it from both sides.
  // Contagious ideas (Muse's chassis, ~/loci-orbit/muse/contagion/CONTAGIOUS_IDEAS.md; built by Claude 2026-10-17). One
  // registry for ideas that spread from a carrier to a listener: who carries it, the vector that exposes a listener, the
  // odds (base ± sway for open or closed temperaments + persuasive, clamped 5-95%), what success gives, and the chance a
  // failure turns the listener against it (the anti-trait). One exposure per listener per idea per battle. Logic:
  // insight.js ideaOdds/ideaEligible; engine/conditions.js spreadIdea. A new idea is a new entry plus its vector wiring.
  const contagiousIdeas = {
    machineSympathy: { label: "Machine sympathy", carriers: ["robotSympathizer"], vector: "robotTalk", idea: "robotSympathizer", anti: "robotHater",
      antiChance: 0.5, base: 0.4, sway: 0.2, swayed: ["agreeable", "curious", "tinkerer"], unmoved: ["stubborn", "traditionalist", "superstitious"], persuasiveAdd: 0.15,
      texts: { won: "{speaker} makes the case for the machines, and {listener} comes round: a Robot Sympathizer now.", anti: "{speaker} makes the case for the machines. {listener} hears it out and comes away hating them.", unmoved: "{speaker} makes the case for the machines. {listener} hears it out, unmoved." } },
    faith: { label: "Faith", carriers: ["fullBeliever", "convertedBeliever"], carrierAlso: "persuasive", vector: "talk", idea: "beliefEvidence", anti: "nonBeliever",
      antiChance: 0.4, base: 0.4, sway: 0.2, swayed: ["agreeable", "superstitious", "empathic", "lonely"], unmoved: ["stubborn", "guarded", "truthSeeker"], persuasiveAdd: 0.15,
      // A listener already holding any belief is not preached to; a skeptic (nonBeliever) still is: sermons move them along
      // the evidence track like miracles do, and only neutrals can be turned into new skeptics by a failed sermon.
      gate: ["believer", "devoutBeliever", "fullBeliever", "convertedDevout", "convertedBeliever"],
      texts: { won: "{speaker} preaches to {listener}, and it lands.", anti: "{speaker} preaches at {listener}, who comes away a Non-believer.", unmoved: "{speaker} preaches; {listener} shrugs it off." } },
  };
  const traitDynamics = {
    scout: { counters: ["rivalrous", "impatient"], synergies: ["curious", "collaborative", "truthSeeker", "hiker"] },
    discernment:{counters:["impatient","fool"],synergies:["curious","truthSeeker","genius"]},
    courageous: { counters: ["fearful", "skittish"], synergies: ["loyal", "proud", "honorable"] },
    brave: { counters: ["fearful", "skittish"], synergies: ["loyal", "honorable", "courageous"] },
    zealous: { counters: ["fearful", "skittish"], synergies: ["dutiful", "stubborn", "traditionalist"] },   // a true believer who never flees (the Paladin, 2026-10-31): opposes the flighty, pairs with the steadfast; a builder's pick, like brave's
    reckless: { counters: ["fearful", "skittish"], synergies: ["brave", "courageous", "impatient"] },
    protective: { counters: ["rivalrous", "vengeful"], synergies: ["loyal", "empathic"] },
    neverGiveUp: { counters: ["fearful", "skittish"], synergies: ["loyal", "brave", "courageous"] },
    merciful: { counters: ["rivalrous", "vengeful", "greedy"], synergies: ["empathic", "agreeable", "pacifist"] },
    gentleHand: { counters: ["vengeful", "rivalrous"], synergies: ["merciful", "protective", "empathic"] },   // the Hypnotist (hotbuilds W1a): leaves the first kill at 1 LF; row added at landing 1.3.546 (Capstan IN) for the trait registry rule
    honorable: { counters: ["greedy", "fool"], synergies: ["proud", "loyal", "honest", "courageous"] },
    dutiful: { counters: ["impatient", "curious"], synergies: ["loyal", "stubborn", "traditionalist"] },
    byTheBook: { counters: ["fool", "impatient"], synergies: ["dutiful", "honest"] },
    homestead: { counters: ["restless", "impatient"], synergies: ["loyal", "stubborn", "traditionalist", "dutiful"] },
    markedGround: { counters: ["impatient", "restless"], synergies: ["dutiful", "stubborn", "proud"] },
    awardWinningDirector: { counters: ["fool"], synergies: ["proud", "competitive", "ambitious"] },
    humanExperience: { counters: ["fool"], synergies: ["empathic", "talkative", "persuasive"] },
    methodActing: { counters: ["stubborn"], synergies: ["imaginative", "curious"] },
    thrifty: { counters: ["impatient", "greedy", "gambler"], synergies: ["genius", "dutiful"] },
    pacifist: { counters: ["competitive", "rivalrous", "impatient", "vengeful"], synergies: ["merciful", "agreeable", "empathic"] },
    dreamer: { counters: ["impatient", "fearful"], synergies: ["imaginative", "curious"] },   // Mala, 2026-10-13: waiting for the dream; afraid of what comes through it
    steward: { counters: ["greedy", "impatient"], synergies: ["curious", "loyal", "traditionalist", "hiker", "botanist"] },
    truthSeeker: { counters: ["superstitious", "fool"], synergies: ["curious", "honest", "genius", "nonBeliever"] },
    charitable: { counters: ["greedy"], synergies: ["empathic", "collaborative", "merciful"] },
    traditionalist: { counters: ["curious", "impatient"], synergies: ["stubborn", "superstitious", "dutiful"] },
    craftsmansMindset: { counters: ["impatient", "restless", "gambler", "fool"], synergies: ["tinkerer", "thrifty", "contemplative", "stubborn", "traditionalist", "dutiful"] },
    robotSympathizer: { counters: ["traditionalist", "superstitious"], synergies: ["curious", "tinkerer", "genius"] },
    robotHater: { counters: ["curious", "agreeable"], synergies: ["traditionalist", "superstitious", "vengeful"] },
    animalLover: { counters: ["animalHater"], synergies: ["empathic", "curious"] },
    animalHater: { counters: ["animalLover", "empathic"], synergies: ["stubborn"] },
    petFighting: { counters: ["pacifist", "animalLover"], synergies: ["competitive", "playfulness", "gambler"] },
    ambitious: { counters: ["agreeable", "pacifist", "charitable"], synergies: ["proud", "competitive", "rivalrous", "gambler"] },
    playfulness: { counters: ["pacifist", "fearful"], synergies: ["competitive", "courageous", "ambitious", "rivalrous"] },
    vengeful: { counters: ["agreeable"], synergies: ["proud", "rivalrous", "stubborn"] },
    gambler: { counters: ["fearful", "skittish"], synergies: ["impatient", "proud", "fool"] },
    believer: { counters: ["nonBeliever"], synergies: ["superstitious", "devoutBeliever"] },
    devoutBeliever: { counters: ["nonBeliever"], synergies: ["fullBeliever", "superstitious"] },
    fullBeliever: { counters: ["nonBeliever"], synergies: ["superstitious"] },
    convertedDevout: { counters: ["nonBeliever"], synergies: ["curious", "believer"] },
    convertedBeliever: { counters: ["nonBeliever"], synergies: ["devoutBeliever", "fullBeliever"] },
    honest: { counters: ["guarded"], synergies: ["agreeable"] },
    collaborative: { counters: ["rivalrous"], synergies: ["empathic", "loyal", "inSync"] },
    fearful: { counters: ["proud"], synergies: ["skittish", "lonely"] },
    genius: { counters: ["fool"], synergies: ["curious"] },
    imaginative: { counters: ["traditionalist"], synergies: ["curious", "genius"] },
    contemplative: { counters: ["restless", "impatient", "scattered"], synergies: ["curious", "truthSeeker", "thrifty", "focused"] },
    restless: { counters: ["contemplative", "stubborn"], synergies: ["impatient", "gambler", "skittish"] },
    horticultureExpertise: { counters: ["impatient", "greedy"], synergies: ["botanist", "steward", "hiker"] },
    comparative: { counters: ["impatient", "fool"], synergies: ["curious", "botanist", "genius"] },
    grappler: { counters: ["skittish", "restless"], synergies: ["stubborn", "competitive", "guarded"] },
    tinkerer: { counters: ["impatient", "fool"], synergies: ["curious", "genius", "thrifty"] },
    stoner: { counters: ["dutiful", "traditionalist", "impatient"], synergies: ["curious", "agreeable", "talkative"] },
    speedTalker: { counters: ["guarded", "honest"], synergies: ["talkative", "persuasive"] },
    talkative: { counters: ["guarded"], synergies: ["persuasive", "annoying"] },
  };
  // How hard a trait is to imitate (1-5): its own difficulty, values one step harder, biology never.
  const imitateDifficulty = (id) => { const t = traits[id]; return !t || t.category === "biology" || t.category === "state" || t.category === "spiritual" ? null : Math.min(5, (t.difficulty || 1) + (t.category === "values" ? 1 : 0)); };
  // One value and one bodily quirk can be rolled at spawn, each as a single draw; a profile that already states one
  // from the same list does not roll. Rates are Claude's: about one character in four carries a value, one in six a quirk.
  const valueSpawn = ["courageous", "merciful", "honorable", "dutiful", "thrifty", "pacifist", "steward", "truthSeeker", "charitable", "traditionalist", "ambitious", "craftsmansMindset", "dreamer", "animalLover", "animalHater", "playfulness", "petFighting"].map((t) => [t, t === "pacifist" ? 0.01 : 0.025]);   // dreamer: Mala, 2026-10-13
  const biologySpawn = [["fleetFooted", 0.03], ["frail", 0.03], ["hardy", 0.03], ["keenSenses", 0.03], ["plantKin", 0.02], ["ironStomach", 0.02], ["survivalInstincts", 0.02], ["nightSighted", 0.01], ["dreamTouched", 0.01], ["twentyTwentyVision", 0.03], ["packMule", 0.02], ["fourArms", 0.01], ["trepanation", 0.01]];

  // Traits anyone can spawn with (Mala, 2026-10-10): rolled per character per battle, on top of the authored profile.
  // [trait, chance]. Summons and wild creatures do not roll.
  // persuasive (Mala, 2026-10-12): a psychology buff anyone can roll, so a Rapper or a Bard may turn up with it.
  // imaginative (Mala, 2026-10-12): in the pool for anyone; children roll it high, artists higher than most (profiles below).
  const spawnTraits = [["discernment",0.08], ["vengeful", 0.10], ["gambler", 0.08], ["tinkerer", 0.08], ["persuasive", 0.08], ["imaginative", 0.08], ["swimmer", 0.08]];   // Swimmer rolls for anyone (Mala, 2026-10-21); the Sailor holds it outright
  // Curious people end up with a good imagination, and the other way round (Mala, 2026-10-12): a Curious character's
  // odds of rolling Imaginative are multiplied, and an Imaginative character who is not Curious gets one roll to be.
  const imagination = { trait: "imaginative", curiousMul: 1.5, curiousChance: 0.3, children: 0.8, artists: 0.3 };
  // Opposites cannot both be rolled: one draw decides (insight.js treats this like the value and quirk draws).
  const temperSpawn = [["contemplative", 0.08], ["restless", 0.08]];
  // Focus (Mala, 2026-10-17; docs/concentration-traits.md): one exclusive draw, so nobody is both Focused and ADHD.
  // Perfect Concentration stays rare at 2%; authored holders (Ritual Chanter, Samurai, Jujutsu Sorcerer, Ninja, Gaia) skip it.
  const focusSpawn = [["perfectConcentration", 0.02], ["focused", 0.10], ["scattered", 0.10], ["adhd", 0.06]];
  // Belief is rolled the same way, but as ONE draw (Mala, 2026-10-10): a character spawns a believer of some
  // strength, a non-believer, or neither. Rates are lower than the Rainkeeper's own roll (always a believer:
  // 60/25/15) so a summoned dream creature stays rare. A profile that already states a belief (an authored trait or
  // beliefVariants) keeps it and does not roll. What happens next is unchanged: a non-believer who witnesses the
  // supernatural reassesses and may convert (insight/belief-conversion.js), however they came by the trait.
  const beliefSpawn = [["believer", 0.07], ["devoutBeliever", 0.03], ["fullBeliever", 0.01], ["nonBeliever", 0.15]];
  // Spiritual (Mala, 2026-10-24): one exclusive draw like focus/belief. One soul in a thousand carries
  // presence unremarked (provisional; combat-authored holders like the Monkey King hold it outright).
  const spiritSpawn = [["astralPresence", 0.001]];
  // Astral-presence odds (Mala, 2026-10-24): gods, demons and mythical beings always carry it;
  // contemplatives and full believers roll hotter. Drawn last in profileFor so the odds see the final
  // belief; a mid-combat full conversion re-rolls silently at the believer odds (belief-conversion.js).
  const spiritOdds = { base: 0.001, contemplative: 0.02, fullBeliever: 0.05 };
  const spiritCertain = ["bastet", "monkey_king", "new_oni", "oni_yokozuna", "medusa", "forest_spirit"];
  const beliefTraits = ["believer", "devoutBeliever", "fullBeliever", "nonBeliever", "convertedDevout", "convertedBeliever", "unexplainedEvent"];

  // Non-trait observation kinds. Weaknesses are per harm channel; tells are per character.
  const kinds = {
    weakness:    { text: "A harm channel they handle badly.", unlocks: ["exploitWeakness"] },
    tell:        { text: "A habit that gives away their next attack.", unlocks: ["readTell"] },
    state:       { text: "How they are right now (it can change).", unlocks: [] },
    realization: { text: "Something true about them that changes what they are to you.", unlocks: [] },
    teaching:    { text: "The idea they embody.", unlocks: ["nameHint"] },
    contradiction: { text: "What they say and what they do don't match.", unlocks: ["pointOutContradiction"] },
    evidence: { text: "Proof of a breach of the law. Finding it makes the breach found.", unlocks: [] },   // I4c: always deep; only Investigate reaches it
  };

  // Actions unlocked by insight. cost = action points. Effects are descriptors the engine applies.
  const actions = {
    convertBond:   { name: "Convert: bond",           cost: 25, text: "Talk-no-Jutsu on a broken will: shared pain weighed. Needs a bond (or a rival to dark-mirror). Success: they act once for you, then out, spared." },
    convertTruth:  { name: "Convert: truth",          cost: 25, text: "Name the truth they can't face. Wielding truthsaying steadies it. Success: they act once for you, then out, spared." },
    convertLoop:   { name: "Convert: loop",           cost: 25, text: "Izanami: reform-or-loop for 3 rounds. They convert by choosing better — or walk free by enduring. Either way the loop ends." },
    convertEdit:   { name: "Convert: edit",           cost: 25, text: "The shadow twin: the same flip with NO consent. Success marks the ledger FORGERY + cruelty. The game remembers." },
    ask:            { name: "Ask",                     cost: 10, text: "They tell you plainly what they mean to do next.", effect: { revealIntent: true } },
    // Fear is rare (Mala, 2026-10-08): a long shot against a healthy target with allies around; likeliest against
    // a badly hurt target standing alone. "Afraid" itself is a rare state: ≤ 25% LF and no ally within 2 tiles.
    frighten:       { name: "Frighten",                cost: 20, text: "Say the thing they're afraid of. Usually it doesn't land. A badly hurt target with no allies nearby may run; others may hesitate (lose half their AP) or cower (lose all of it).",
                      model: { base: 0.05, hurtWeight: 0.45, aloneBonus: 0.10, perAllyPenalty: 0.05, skittishBonus: 0.15, min: 0.02, max: 0.7, afraidAt: 0.25, allyRadius: 2,
                               onSuccess: { afraidNow: [["flee", 0.65], ["cower", 0.35]], otherwise: [["halfAP", 0.75], ["cower", 0.25]] } } },
    taunt:          { name: "Taunt",                   cost: 15, text: "Challenge them: they must come for you next turn, and you brace against them.", effect: { forceTarget: "observer", guardMulVsTarget: 0.8, duration: 1 } },
    makeItWait:     { name: "Make it wait",            cost: 15, text: "Stall at the right moment: their next action costs 25 more AP.", effect: { nextActionCostAdd: 25 } },
    talk:           { name: "Talk",                    cost: 20, text: "Sit them down for a battle of minds: simultaneous arguments, margin damage, 4 rounds. The loser stands down and concedes.", outcomes: { base: [["standDown", 0.5], ["nothing", 0.5]], guarded: [["standDown", 0.25], ["nothing", 0.75]] }, effect: { standDownRounds: 2 } },
    threatenAlly:   { name: "Threaten their ally",     cost: 20, text: "Move on the one they protect: they spend their next turn shielding that ally instead of attacking.", effect: { mustGuardAlly: true } },
    bribe:          { name: "Bribe",                   cost: 20, price: { seeds: 25 }, text: "Pay 25 Seeds: they leave the battle (no XP for them).", effect: { leaves: true } },
    omen:           { name: "Point to an omen",        cost: 15, text: "Needs a monster, fire or flood on the field: they lose half their AP and 10% potency for 2 rounds.", requiresField: ["monster"], effect: { apLoss: 0.5, potencyMul: 0.9, duration: 2 } },
    befriend:       { name: "Befriend",                cost: 25, text: "They stop attacking you for 3 rounds (they may still hit your summons).", outcomes: { base: [["truce", 0.4], ["nothing", 0.6]] }, effect: { truceRounds: 3 } },
    exploitWeakness:{ name: "Exploit the weakness",    cost: 0,  text: "Mark it: your next hit of that harm channel on them deals ×1.5.", effect: { nextChannelHitMul: 1.5 } },
    readTell:       { name: "Read the tell",           cost: 10, text: "Your next response to their announced or delayed attack does not spend your reaction. A dodge still costs its usual AP.", effect: { freeReactionVs: true } },
    pointOutContradiction: { name: "Point out the contradiction", cost: 20, text: "Say it out loud: they lose their reaction this round and can't use Deception until their next turn.", effect: { loseReaction: true, noDeception: 1 } },
    holdGaze:       { name: "Hold its gaze",           cost: 25, text: "Keep looking until it understands: the dream turns, and targets only your enemies until it fades.", effect: { allegiance: "player" } },
    nameHint:       { name: "Recognise the idea",      cost: 0,  text: "Its Name it question shows one fewer wrong answer.", effect: { nameItChoicesRemove: 1 } },
    // Report (Scout): not aimed at a target, so it does not go through a subject's deck. Numbers the engine reads.
    report:         { name: "Report", cost: 15,
      text: "Share learned findings with nearby allies. Each ally within 3 tiles also observes at −1 difficulty against every subject you have observed this battle, for the rest of the battle. Once per battle, after observing 3 times.",
      effect: { shareObservations: true, radius: 3, usesPerBattle: 1, requiresObserves: 3, difficultyShare: 1 } },
    coordinate:     { name: "Coordinate",              cost: 15, text: "Your summon acts immediately after you, once.", effect: { summonActsNow: true } },
  };

  // Starting decks. traits: trait ids; obs: extra observations {kind, id?, channel?, text, difficulty}.
  // Enemy names are placeholders (canonical cast pending); decks are keyed by character id.
  // Boss keys (Muse-2, 2026-10-18): the Dragon's guaranteed-discoverable Wall/Tell/Key cards. Cheapest-first
  // Observe reveals them all eventually; windows evaluate live in keyLive (insight.js).
  // Two profile keys: boss-rush builds character "dragon" (makeBoss), random encounters use "boss-dragon".
  const dragonKeys = [
      { kind: "key", id: "fire", difficulty: 1, text: "Its breath sets every fuel tile it touches ablaze, and the fire walks.",
        tell: "Fire Breath cones 5 tiles and ignites fuel.", window: { when: "always" },
        lever: "Stand on paving, water or rubble; Watering can and Check Dam stop the walk. Rain douses it ×0.85.", counters: [] },
      { kind: "key", id: "tail", difficulty: 1, text: "The tail clears everything within 2 tiles.",
        tell: "Tail Sweep: radius 2, knockback 2.", window: { when: "always" },
        lever: "Anchor, or stay more than 2 away.", counters: [{ match: { ability: "anchor" }, value: 3 }] },
      { kind: "key", id: "inferno", difficulty: 2, text: "Past a quarter health it enrages — and announces Inferno.",
        tell: "Inferno: announced, radius 4, map-wide ignition.", window: { when: "enraged" },
        lever: "When it announces: reach water or paving; Rain Garden holds its edge.",
        counters: [{ match: { type: "guard" }, value: 2 }, { match: { type: "move" }, value: 1 }] },
      { kind: "key", id: "stormWings", difficulty: 2, text: "Enraged, it takes the air: contact cannot reach it.",
        tell: "Storm Wings: hovering, dives 6 for 20.", window: { when: "enraged" },
        lever: "Do not reach for it — lines and fields still land.",
        counters: [{ match: { delivery: "contact" }, value: -4 }, { match: { type: "strike" }, value: -4 }] } ];
  const profiles = {
    // the original class pack (Claude, 2026-10-08): hidden strengths and weaknesses as discoverable observations.
    // Agent Swarm (Mala, 2026-10-13): Cybernetic and Distributed Intelligence are his body; a Robot Sympathizer by conviction.
    agent_swarm: { traits: ["cybernetic", "distributedIntelligence", "robotSympathizer"], obs: [
      { kind: "tell", text: "Looks at the trees and benches before it looks at you.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Every tower stands on something that can be broken.", difficulty: 2 },
      { kind: "realization", text: "It is not where it seems to be fighting from: the towers are its reach, not its body.", difficulty: 3 } ] },
    knight: { traits: ["loyal","stubborn","honorable","cavalry","heavyArmor"], obs: [
      { kind: "tell", text: "Turns the shield toward whoever it means to protect.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Lines from an unguarded side go straight past the shield.", difficulty: 2 },
      { kind: "realization", text: "It protects without needing to win; separate the threats and it can't cover both.", difficulty: 2 } ] },
    pharaoh: { traits: ["proud","guarded","touchedByMagic"], chanceTraits: [["persuasive", 1]], obs: [
      { kind: "tell", text: "Plants the crook before declaring a rule.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "A disproved claim takes every permission with it.", difficulty: 2 },
      { kind: "realization", text: "Its law binds it too: bait it into breaking its own rule.", difficulty: 2 } ] },
    daedalus: { traits: ["curious","complex"], obs: [
      { kind: "tell", text: "Measures the ground before it builds.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Break a load-bearing tile and the passages collapse.", difficulty: 2 },
      { kind: "realization", text: "Its walls protect movement; a section cut shows where.", difficulty: 2 } ] },
    samurai: { traits: ["guarded","stubborn","perfectConcentration","rivalrous"], obs: [
      { kind: "tell", text: "Goes completely still before it strikes.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "A berm across its line defeats a perfect read.", difficulty: 2 },
      { kind: "realization", text: "It punishes commitment: don't commit near it.", difficulty: 2 } ] },
    gemini: { traits: ["inSync","curious"], obs: [
      { kind: "tell", text: "The twins glance at each other before a paired move.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "Shared LF: every hit on either twin hurts both.", difficulty: 2 },
      { kind: "realization", text: "Separate them and the paired function stops.", difficulty: 2 } ] },
    wizard: { traits: ["complex","guarded","touchedByMagic"], chanceTraits: [["immortal", 0.05], ["genius", 0.65], ["deepWells", 0.65], ["copyEye", 0.65]], obs: [
      { kind: "tell", text: "Mutters the order of operations.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Change a type mid-formula and the rest jams.", difficulty: 2 },
      { kind: "realization", text: "Order changes the result, not the power.", difficulty: 2 } ] },
    jujutsu_sorcerer: { traits: ["proud","loyal","touchedByMagic","perfectConcentration"], obs: [
      { kind: "tell", text: "States its terms out loud before it fights.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "Leave its domain and the terms don't apply.", difficulty: 2 },
      { kind: "realization", text: "Its restrictions are real; force it to break one.", difficulty: 2 } ] },
    jiang_qing: { traits: ["persuasive", "ambitious"], obs: [
      { kind: "tell", text: "Plays every exchange to an audience: she looks for who is watching before she acts.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "Spreading harm doesn't care what anyone believes: area attacks ignore her shimmer.", difficulty: 2 },
      { kind: "realization", text: "Her stage is only 3 tiles wide: step off it when the performance is announced.", difficulty: 2 } ] },
    aviator_hero: { traits: ["aerodynamic", "adrenalineJunkie"], chanceTraits: [["courageous", 0.4]], obs: [
      { kind: "tell", text: "Lines up a straight run before committing: watch which way the nose points.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Every turn costs speed: corner him and the bonus is gone.", difficulty: 2 },
      { kind: "realization", text: "A wall on the line ends every dash; Full Throttle is announced, so step out of the row.", difficulty: 2 } ] },
    starfarer: { traits: ["lightFrame", "shipsEngineer"], chanceTraits: [["courageous", 0.3]], obs: [
      { kind: "tell", text: "Walks the ground before she builds on it: the open tile at the end of her line is the landing site.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Light hull, light frame: piercing finds her, and traded hits drop her first.", difficulty: 2 },
      { kind: "realization", text: "Orbital Drop is announced: step off the line and the Citadel lands on empty ground. Break the works and every bonus dies with the walls.", difficulty: 2 } ] },
    pioneer: { traits: ["homestead", "markedGround"], chanceTraits: [["dutiful", 0.4]], obs: [
      { kind: "tell", text: "Sets her fence before she fires: the line she draws is the line she rides.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "Off her ground she is only a rifle: draw her out or knock the walls down first.", difficulty: 2 },
      { kind: "realization", text: "Pale Stampede is announced and wide: step off the path AND beside it, or the trampled ground taxes every crossing.", difficulty: 2 } ] },
    esker: { traits: ["contemplative", "honorable"], chanceTraits: [["stubborn", 0.3]], obs: [
      { kind: "tell", text: "Always steps to the midpoint between the two closest enemies of each other.", difficulty: 1 },
      { kind: "weakness", channel: "rubedo", text: "Vibration loosens a gravel ridge: it carries burden badly under resonance.", difficulty: 2 },
      { kind: "realization", text: "Pull one ward more than three tiles away and the line between them is gone.", difficulty: 2 } ] },
    super_hero: { superVariants: true, traits: ["loyal","impatient"], obs: [
      { kind: "tell", text: "Always moves toward whoever is hurt.", difficulty: 1 },
      { kind: "weakness", channel: "rubedo", text: "Vibration loads every support at once.", difficulty: 2 },
      { kind: "realization", text: "Threaten two allies far apart and it can only save one.", difficulty: 2 } ] },
    super_heroine: { superVariants: true, traits: ["curious","loyal"], chanceTraits: [["agreeable", 0.3]], obs: [
      { kind: "tell", text: "Checks its anchors before every swing.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Shoot the anchor and the whole net drops.", difficulty: 2 },
      { kind: "realization", text: "Its connections are only as good as their anchors.", difficulty: 2 } ] },
    super_villain: { superVariants: true, traits: ["complex","proud"], chanceTraits: [["talkative", 0.5], ["annoying", 0.3], ["persuasive", 1]], obs: [
      { kind: "tell", text: "Glances at the thing it actually depends on.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Independent evidence exposes its dependency.", difficulty: 2 },
      { kind: "realization", text: "Defend the input, not the output.", difficulty: 2 } ] },
    defective_machine: { traits: ["honest","stubborn","robotSympathizer","robot"], obs: [
      { kind: "tell", text: "Announces its own error codes.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Backups that share one part all fail together.", difficulty: 2 },
      { kind: "realization", text: "Losing a component isn't losing the function: find the common mode.", difficulty: 2 } ] },
    teleporter: { traits: ["impatient","curious"], chanceTraits: [["talkative", 0.3], ["annoying", 0.3]], obs: [
      { kind: "tell", text: "Glances at where it has already been.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Occupy or seal its endpoints and it has nowhere to go.", difficulty: 2 },
      { kind: "realization", text: "It can only reach places it has stood.", difficulty: 2 } ] },
    mutant_boar: { traits: ["stubborn","impatient"], obs: [
      { kind: "tell", text: "Lowers its head before a straight charge.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Make it turn and the charge loses everything.", difficulty: 2 },
      { kind: "realization", text: "It grows from loads it survives; growth costs it every turn.", difficulty: 2 } ] },
    boarman: { traits: ["proud","stubborn"], obs: [
      { kind: "tell", text: "Shifts its feet to find a base before it grabs.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Soak or remove its footing and the leverage is gone.", difficulty: 2 },
      { kind: "realization", text: "It uses your force: don't feed it impact.", difficulty: 2 } ] },
    anime_protagonist: { traits: ["impatient","loyal","neverGiveUp"], chanceTraits: [["talkative", 0.5], ["annoying", 0.3]], obs: [
      { kind: "tell", text: "Shouts its plan before it does it.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Its specialization left a real weakness.", difficulty: 2 },
      { kind: "realization", text: "After a revision, everything you knew about it is stale.", difficulty: 2 } ] },
    // Kickboxer (Mala, 2026-10-11): her reach is biology; the clinch is training.
    kickboxer: { traits: ["competitive", "stubborn", "grappler", "reach"], chanceTraits: [["proud", 0.3], ["loyal", 0.3]], obs: [
      { kind: "tell", text: "Measures you with a lead leg before she commits.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "She has no answer past two tiles: hit her from range and keep moving.", difficulty: 2 },
      { kind: "realization", text: "Hurt her below 40% and her coach steps in. Finish her from above it, or be ready for two.", difficulty: 2 } ] },
    mma_fighter: { traits: ["guarded", "stubborn", "grappler", "strongGrip"], obs: [
      { kind: "tell", text: "Shifts its feet to find a base before it grabs.", difficulty: 1 },
      { kind: "weakness", channel: "rubedo", text: "Vibration breaks its contact.", difficulty: 2 },
      { kind: "realization", text: "Broken contact removes both its control and its read on you.", difficulty: 2 } ] },
    magistrate: { traits: ["honorable", "dutiful"], chanceTraits: [["truthSeeker", 0.5]], obs: [
      { kind: "tell", text: "Reads the charge aloud before acting; her target is never a surprise.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "His statutes are written light: dispel the zones or outrange them.", difficulty: 2 },
      { kind: "realization", text: "The ledger only fills inside his zones; the law ends at the border.", difficulty: 2 } ] },
    detective: { traits: ["curious", "guarded", "rivalrous"], chanceTraits: [["persuasive", 0.5]], obs: [
      { kind: "tell", text: "Looks at you twice from two different angles before acting.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Knowledge isn't armor: a plain hit lands like on anyone.", difficulty: 1 },
      { kind: "realization", text: "Show it the same tell twice and it learns nothing new.", difficulty: 2 } ] },
    // bosses (wild side). Understanding Gaia fully is half of the Living Accord (boss-data.js accord).
    "boss-dragon": { traits: [], obs: dragonKeys },   // the random-encounter key: the magic roster names "dragon"
    dragon: { traits: ["touchedByMagic"], obs: dragonKeys },   // a deck for a rostered magic creature carries the trait (classes-data magic)
    gaia: { traits: ["complex", "touchedByMagic", "perfectConcentration"], obs: [
      { kind: "state", id: "watching", text: "She isn't raging at everyone: she watches whoever is doing the damage.", difficulty: 1 },
      { kind: "teaching", id: "answers", text: "The land answers what is done to it: tend it and it heals, wound it and it rises.", difficulty: 2 },
      { kind: "tell", id: "seam", text: "A root seam brightens toward what she means to defend; her crown contracts the turn before something big.", difficulty: 1 },
      { kind: "realization", id: "threatened", text: "Something here is broken that she is guarding. Mend it and she has nothing to defend against you.", difficulty: 2 },
      { kind: "realization", id: "notAFoe", text: "She isn't your enemy unless you make her one.", difficulty: 3 } ] },
    // enemies
    pathfinder: { traits: ["curious", "impatient", "rivalrous", "scout"], chanceTraits: [["talkative", 0.3], ["annoying", 0.4]], obs: [
      { kind: "weakness", channel: "albedo", text: "Filters and fine cuts slow it down more than walls do.", difficulty: 2 },
      { kind: "tell", text: "Glances along the open route just before a Detour.", difficulty: 1 } ] },
    sieve: { traits: ["guarded", "proud", "fool"], chanceTraits: [["annoying", 0.3]], obs: [
      { kind: "weakness", channel: "nigredo", text: "Blunt impact clogs the mesh.", difficulty: 2 },
      { kind: "tell", text: "Rattles before a Filter Bolt.", difficulty: 1 } ] },
    student: { traits: ["honest", "curious", "fearful"], chanceTraits: [["genius", 0.8], ["talkative", 0.3], ["agreeable", 0.3], ["imaginative", 0.8]], obs: [   // Mala: a high chance to be a genius, not a certainty
      { kind: "tell", text: "Mouths the rule under its breath before casting.", difficulty: 1 },
      { kind: "weakness", channel: "rubedo", text: "Loses its place under repeated pressure.", difficulty: 1 } ] },
    arborist: { traits: ["stubborn", "loyal", "steward", "horticultureExpertise"], chanceTraits: [["botanist", 0.8]], obs: [
      { kind: "tell", text: "Checks its footing before a shove.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "Watches the canopy, not the ground: spreading effects catch it.", difficulty: 2 } ] },
    // Field Botanist (Mala, 2026-10-10): the class the plant systems were waiting for. Always a hiker and a botanist.
    fieldBotanist: { traits: ["curious", "stubborn", "hiker", "botanist", "comparative", "horticultureExpertise", "steward"], chanceTraits: [["agreeable", 0.3], ["speakWithAnimals", 0.15]], obs: [
      { kind: "tell", text: "Kneels to look at what is growing before choosing where to stand.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Travels light and close to the ground: a heavy blow finds nothing braced behind it.", difficulty: 2 },
      { kind: "realization", text: "The plants on the field are their allies in waiting. Clear the planting near them and they fight alone.", difficulty: 2 } ] },
    // The Archivist had no profile (traitless apart from spawn rolls). Contemplative is Mala's call (2026-10-10): she
    // meditates at 80% for +35, which is what gets her two support ultimates fired.
    archivist: { traits: ["contemplative", "curious", "empathic", "collaborative", "animist"], obs: [
      { kind: "tell", text: "Goes still and closes the book before something large.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "She keeps records, not a guard: a direct blow lands whole.", difficulty: 2 } ] },
    surveyor: { traits: ["guarded", "proud", "scout"], obs: [
      { kind: "tell", text: "Sights down the line before a long shot.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "Routes around corners are outside its survey.", difficulty: 2 } ] },
    rainkeeper: { traits: ["superstitious", "lonely", "imaginative", "animist"], beliefVariants: ["believer", "devoutBeliever", "fullBeliever"], obs: [
      { kind: "tell", text: "Goes quiet before it opens a swale.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Sharp, filtering force cuts through its water.", difficulty: 2 } ] },
    mason: { traits: ["stubborn", "proud", "craftsmansMindset", "animist"], obs: [
      { kind: "weakness", channel: "rubedo", text: "Vibration cracks its stonework.", difficulty: 1 },
      { kind: "tell", text: "Plants its feet before raising a berm.", difficulty: 1 } ] },
    ecologist: { traits: ["complex", "curious"], chanceTraits: [["botanist", 0.8], ["speakWithAnimals", 0.2]], obs: [
      { kind: "tell", text: "Studies the edge tiles before it moves.", difficulty: 2 },
      { kind: "weakness", channel: "nigredo", text: "Sudden disturbance resets its plans.", difficulty: 2 } ] },
    planner: { traits: ["guarded", "greedy", "proud"], obs: [
      { kind: "contradiction", text: "Talks about the rules while bending them.", difficulty: 3 },
      { kind: "tell", text: "Reaches for paperwork before a Boundary.", difficulty: 1 } ] },
    gardener: { traits: ["honest", "impatient", "lonely", "steward", "horticultureExpertise"], chanceTraits: [["botanist", 0.8], ["hiker", 0.8], ["talkative", 0.4], ["agreeable", 0.4], ["speakWithAnimals", 0.2]], obs: [
      { kind: "weakness", channel: "albedo", text: "Precise cuts undo its spreading.", difficulty: 1 },
      { kind: "tell", text: "Hums before a wave.", difficulty: 1 } ] },
    actor: { traits: ["methodActing", "theLook", "humanExperience"], chanceTraits: [["imaginative", 0.3], ["talkative", 0.7], ["persuasive", 1]], obs: [{ kind: "tell", text: "The gesture comes before the declared cue.", difficulty: 2 }] },
    supermodel: { traits: ["guarded", "proud"], chanceTraits: [["imaginative", 0.3], ["talkative", 0.5], ["annoying", 0.3]], obs: [{ kind: "weakness", channel: "nigredo", text: "Impact that interrupts the clear line breaks the pose.", difficulty: 2 }] },
    // Mala, 2026-10-12: the AGI speaks for its own kind (Robot Sympathizer), and four times in five speaks well.
    agi: { traits: ["complex", "curious", "robot", "robotSympathizer"], chanceTraits: [["persuasive", 0.8]], obs: [{ kind: "tell", text: "Changes route after the first obstruction.", difficulty: 2 }] },
    scientist: { traits: ["honest", "impatient", "genius", "nonBeliever"], obs: [{ kind: "tell", text: "Checks the condition before committing a response.", difficulty: 1 }] },
    animalTamer: { traits: ["loyal", "curious", "collaborative", "empathic", "animalLover", "beastTamer"], chanceTraits: [["agreeable", 0.5], ["speakWithAnimals", 1]], obs: [{ kind: "weakness", channel: "albedo", text: "A precise cut interrupts the shared rhythm.", difficulty: 2 }] },
    architect: { traits: ["stubborn", "guarded"], chanceTraits: [["imaginative", 0.3], ["animist", 0.8]], obs: [{ kind: "tell", text: "Studies the grade before closing a route.", difficulty: 1 }] },
    engineer: { traits: [], chanceTraits: [["animist", 0.8]], obs: [{ kind: "tell", text: "Taps a structure and listens before it acts.", difficulty: 1 }] },   // Tsukumogami roster (Mala, 2026-10-30): four in five engineers hear the souls in things, like the architects
    soldier: { traits: ["stubborn", "loyal", "dutiful", "brave"], chanceTraits: [["hiker", 0.8], ["scout", 0.3]], obs: [{ kind: "weakness", channel: "citrinitas", text: "Propagation can reach around the held boundary.", difficulty: 2 }] },
    // Class sprint (Mala, 2026-10-16): concept-level launches get a readable deck on day one.
    mycologist: { traits: ["contemplative", "curious"], obs: [{ kind: "tell", text: "Crouches to read the soil before acting; the ground answers first.", difficulty: 1 }] },
    hacker: { traits: ["ambitious", "guarded"], obs: [{ kind: "tell", text: "Glances at the exits before running anything; the retreat is loaded first.", difficulty: 1 }] },
    sailor: { traits: ["restless", "talkative", "swimmer"], obs: [{ kind: "tell", text: "Tests the footing like a deck in a swell; the wave comes where she stood.", difficulty: 1 }] },
    astronaut: { traits: ["contemplative", "stubborn"], obs: [{ kind: "tell", text: "Checks the tether points before moving; nothing leaves the checklist.", difficulty: 1 }] },
    // Tofu trio (Muse Berry BD hot-build, 2026-10-29). Fermentation science in the tells.
    tofu_yokai: { traits: ["playfulness", "curious", "reckless"], chanceTraits: [["talkative", 0.5]], obs: [
      { kind: "tell", text: "Its Feint is a restrained strike that tests your guard; the soft strike is the tell.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Blunt impact squashes soft curd.", difficulty: 2 } ] },
    tofu_archer: { traits: ["dutiful", "scout", "protective"], chanceTraits: [["honorable", 0.4]], obs: [
      { kind: "tell", text: "Tests the wind like brine temperature; the shot is set.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Loses the thread in smoke and dazzle.", difficulty: 2 } ] },
    tofu_warden: { traits: ["loyal", "stubborn", "protective"], chanceTraits: [["brave", 0.5]], obs: [
      { kind: "tell", text: "Stands where the press-cloth folds; the gate never moves first.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "Propagation seeps around a set gate.", difficulty: 2 } ] },
    ritual_chanter: { traits: ["contemplative", "dutiful", "perfectConcentration"], obs: [{ kind: "tell", text: "Goes quiet before holding a tone; the verse lands where she stands.", difficulty: 1 }] },
    mangaka: { traits: ["impatient", "imaginative"], obs: [{ kind: "tell", text: "Frames the field with her hands before acting; the panel she draws is the attack.", difficulty: 1 }] },
    android_maker: { traits: ["empathic", "collaborative"], obs: [{ kind: "tell", text: "Looks to her companion before committing; the drone moves first, she covers it.", difficulty: 1 }] },
    celestial_priestess: { traits: ["contemplative", "dutiful"], obs: [{ kind: "tell", text: "Raises her staff to the sky before tuning; the note lands where the light falls.", difficulty: 1 }] },
    cyanotype_artist: { traits: ["curious", "imaginative"], obs: [{ kind: "tell", text: "Holds a blank plate to the sun before exposing; the print develops where she aims.", difficulty: 1 }] },
    new_oni: { traits: ["courageous", "impatient"], obs: [{ kind: "tell", text: "Slaps his mawashi and crouches before grabbing; the throw lands where he faces.", difficulty: 1 }] },
    artemesia: { traits: ["courageous", "dutiful"], obs: [{ kind: "tell", text: "Sets her spear and listens for the tide before thrusting; the wave follows the point.", difficulty: 1 }] },
    fbi_agent: { traits: ["dutiful", "attentionToDetail"], obs: [{ kind: "tell", text: "Taps her earpiece before naming a suspect; the mark lands on whoever she was just looking at.", difficulty: 1 }] },
    telekinetic_hero: { traits: ["telekinetic", "guarded"], obs: [{ kind: "tell", text: "Pinches the bridge of his nose before lifting; whatever he stares at moves next.", difficulty: 1 }] },
    deepsea_warrior: { traits: ["hardy", "stubborn"], obs: [{ kind: "tell", text: "Her fins flare and settle before she strikes; the pressure releases along the trident's line.", difficulty: 1 }] },
    black_armor: { traits: ["heavyArmor", "stubborn"], obs: [{ kind: "tell", text: "Plants his back foot before every step; what he walks toward, he does not stop for.", difficulty: 1 }] },
    oni_yokozuna: { traits: ["proud", "courageous"], obs: [{ kind: "tell", text: "Stamps twice and lowers into the crouch before the charge; the clash comes on the second stamp.", difficulty: 1 }] },
    black_swan_warrior: { traits: ["proud", "gambler"], obs: [{ kind: "tell", text: "Folds her wings tight before something no one saw coming; when they open, she has already moved.", difficulty: 1 }] },
    forest_spirit: { traits: ["plantKin", "contemplative"], obs: [{ kind: "tell", text: "The leaves around it go still before it acts; growth starts where the stillness was.", difficulty: 1 }] },
    neon_dj: { traits: ["restless", "playfulness"], obs: [{ kind: "tell", text: "Nods to a beat no one else hears; the drop lands on the fourth nod.", difficulty: 1 }] },
    cloaked_drifter: { traits: ["guarded", "scout"], obs: [{ kind: "tell", text: "The cloak stops moving a breath before the shot; the drone has already picked the line.", difficulty: 1 }] },
    neon_idol: { traits: ["mainCharacterEnergy", "theLook"], obs: [{ kind: "tell", text: "Finds the light before she sings; the verse lands wherever the spotlight falls.", difficulty: 1 }] },
    jpop_idol: { traits: ["mainCharacterEnergy", "competitive", "rivalrous"], obs: [{ kind: "tell", text: "Changes her pose on the downbeat; the next move is the one the crowd cheered last.", difficulty: 1 }] },
    mao_zedong: { traits: ["ambitious", "stubborn"], obs: [{ kind: "tell", text: "Reads from his little sheaf of papers before committing; once he starts a campaign, he does not turn back.", difficulty: 1 }] },
    ember_judge: { traits: ["honorable", "proud"], obs: [{ kind: "tell", text: "Raises one palm before passing sentence; the fire falls on whoever broke the rule last.", difficulty: 1 }] },
    devouring_mother: { traits: ["lonely", "stubborn"], obs: [{ kind: "tell", text: "Opens all four arms before she takes; what she holds, she will not let go.", difficulty: 1 }] },
    tactical_operative: { traits: ["dutiful", "scout"], obs: [{ kind: "tell", text: "Signals the dog before moving; the K9 goes first, she covers its line.", difficulty: 1 }] },
    frogan: { traits: ["curious", "restless"], obs: [{ kind: "tell", text: "Tests doorways that aren't there before moving; the fight relocates where he points.", difficulty: 1 }] },
    shaman: { traits: ["contemplative", "empathic"], chanceTraits: [["culinaryTraining", 0.35], ["kitchenAnimism", 0.10]], obs: [{ kind: "tell", text: "Introduces someone you can't see before acting; the guest arrives where he gestures.", difficulty: 1 }] },
    hedge_witch: { traits: ["dutiful", "guarded"], chanceTraits: [["culinaryTraining", 0.35], ["kitchenAnimism", 0.10]], obs: [{ kind: "tell", text: "Lights a candle before settling in; the safe edge is wherever she put it.", difficulty: 1 }] },
    robot_mechanic: { traits: ["impatient", "collaborative"], obs: [{ kind: "tell", text: "Raps the nearest ally with her wrench before patching; the fix lands where she stood.", difficulty: 1 }] },
    origamist: { traits: ["honest", "contemplative"], obs: [{ kind: "tell", text: "Measures the distance twice before folding it; the crease falls where she looked.", difficulty: 1 }] },
    policeOfficer: { traits: ["guarded", "stubborn"], obs: [{ kind: "tell", text: "Checks the crossing before setting a boundary.", difficulty: 1 }] },
    yogaInstructor: { traits: ["honest", "stubborn"], obs: [{ kind: "tell", text: "Releases force only after the stance has settled.", difficulty: 1 }] },
    arantxa: { traits: ["guarded", "proud"], chanceTraits: [["talkative", 0.4]], obs: [{ kind: "tell", text: "Her casting stance turns toward the open route first.", difficulty: 1 }] },
    president: { traits: ["proud", "loyal", "rivalrous"], chanceTraits: [["talkative", 0.6], ["persuasive", 1]], obs: [
      { kind: "tell", text: "Looks to nearby allies before requesting an action.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "A verified breach puts the office and its permissions at risk.", difficulty: 2 } ] },
    ranger: { traits: ["scout", "curious", "hiker", "botanist", "longHunt"], obs: [{ kind: "tell", text: "Glances at your feet before acting: it is reading where you have been.", difficulty: 1 }, { kind: "weakness", channel: "albedo", text: "Light armor, open ground: piercing attacks find it.", difficulty: 2 }, { kind: "realization", text: "It hunts one quarry at a time: split up and it can only follow one trail.", difficulty: 2 }] },
    doctor: { traits: ["empathic", "merciful"], obs: [{ kind: "tell", text: "Looks at the most hurt ally first, every time, before doing anything else.", difficulty: 1 }, { kind: "tell", text: "Names the cause out loud before treating it; the treatment follows the name.", difficulty: 1 }, { kind: "realization", text: "Its patients mend in stages. Touch one and the whole recovery is lost.", difficulty: 2 }] },
    cleric: { traits: ["empathic", "dutiful", "touchedByMagic"], obs: [{ kind: "tell", text: "Names the vow out loud before giving the blessing; the gift states its price.", difficulty: 1 }, { kind: "tell", text: "Lays both hands on the hurt ally; the healing takes the recipient's action too.", difficulty: 1 }, { kind: "weakness", channel: "nigredo", text: "Its gifts are vows: force a retreat and the blessing ends with it.", difficulty: 2 }] },
    ninja: { traits: ["guarded", "contemplative", "perfectConcentration"], obs: [{ kind: "tell", text: "Stops where it cannot be seen; the next thing it does comes from nowhere.", difficulty: 1 }, { kind: "tell", text: "Watches one foe and does nothing; the window it arms is the attack.", difficulty: 1 }, { kind: "weakness", channel: "nigredo", text: "Blasts: one field clears its marker, its smoke, and its cover at once.", difficulty: 2 }] },
    police_officer: { traits: ["dutiful", "honest"], obs: [{ kind: "tell", text: "Orders a halt before it moves in; the cuffs come next.", difficulty: 1 }, { kind: "tell", text: "Bags everything it takes; the locker never gives anything back.", difficulty: 1 }, { kind: "weakness", channel: "nigredo", text: "Everything past the order needs contact: kite beyond 2 and the chain starves.", difficulty: 2 }] },
    thief: { traits: ["guarded", "greedy"], obs: [{ kind: "tell", text: "Brushes past one foe and moves on; the theft lands a turn later.", difficulty: 1 }, { kind: "tell", text: "Goes quiet where it cannot be seen; the big score needs cover.", difficulty: 1 }, { kind: "weakness", channel: "nigredo", text: "Travel light and unbanked: nothing held is nothing stolen.", difficulty: 2 }] },
    rogue: { traits: ["guarded", "greedy"], obs: [{ kind: "tell", text: "Gets adjacent and the mark feels nothing; the cut lands unnamed.", difficulty: 1 }, { kind: "tell", text: "Pockets what was cut a beat later; the take is named then.", difficulty: 1 }, { kind: "weakness", channel: "nigredo", text: "Holds keep it off the approach, and travel light: nothing carried is nothing cut.", difficulty: 2 }] },
    jatayu: { traits: ["loyal", "courageous"], obs: [
      { kind: "tell", text: "He circles before he commits: the first turn is always empty.", difficulty: 1 },
      { kind: "tell", text: "He keeps his wings over whoever stands nearest him.", difficulty: 1 },
      { kind: "weakness", channel: "rubedo", text: "He is very old: a hard early blow brings him down out of the sky before the stoop.", difficulty: 2 },
      { kind: "realization", text: "Killing him marks you for his friends. Let someone they cannot reach do it.", difficulty: 2 } ] },
    surpanakha: { traits: ["vengeful", "rivalrous", "impatient"], obs: [
      { kind: "tell", text: "Lovely, until something touches her.", difficulty: 1 },
      { kind: "tell", text: "She remembers exactly who hurt her, and looks at them.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Lakshmana's blade drew blood through the guise: a clean, precise cut shows her true shape at once.", difficulty: 2 },
      { kind: "realization", text: "Her grudge falls on whoever wounds her. Let someone you can spare do it.", difficulty: 2 } ] },
    maricha: { traits: ["fearful", "dutiful"], obs: [   // Surpanakha flee chain S1: every line is true of the golden deer as built (content.js marichaDeer)
      { kind: "tell", text: "Too golden to be a deer.", difficulty: 1 },
      { kind: "tell", text: "It makes no move to fight.", difficulty: 1 },
      { kind: "realization", text: "One blow ends the illusion: whatever wears the deer runs.", difficulty: 2 } ] },
    mandodari: { traits: ["honest", "loyal"], obs: [
      { kind: "tell", text: "She speaks to her allies before every clash, urgently.", difficulty: 1 },
      { kind: "tell", text: "She watches you as if she already knows how this ends.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "She fights only with words: anything that travels to her past her allies finds her unguarded.", difficulty: 2 },
      { kind: "realization", text: "Her warnings shelter only the patient. Bait the warned one into striking, and the warning turns on them.", difficulty: 2 } ] },
    indrajit: { traits: ["ambitious", "rivalrous"], obs: [
      { kind: "tell", text: "His arrows come from where nobody is standing.", difficulty: 1 },
      { kind: "tell", text: "He slips away to chant whenever the fight turns.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Lakshmana broke his rite and caught him on the ground: a plain heavy blow, landed where he chants, ends him.", difficulty: 2 },
      { kind: "realization", text: "Never let him finish the rite. Find the grove and hit him there.", difficulty: 2 } ] },
    kumbhakarna: { traits: ["loyal", "honorable"], obs: [
      { kind: "tell", text: "He snores. Whatever wakes him will regret it.", difficulty: 1 },
      { kind: "tell", text: "He swings from two tiles away and never steps back.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Rama's arrows took the giant apart from a distance: he is slow, and a shot from outside his reach finds him.", difficulty: 2 },
      { kind: "realization", text: "He told Ravana he was wrong, and fought for him anyway. Do not wake him: let him sleep, and fight the rest.", difficulty: 2, deep: true } ] },
    ravana: { traits: ["proud", "rivalrous"], obs: [
      { kind: "tell", text: "He takes a blow and laughs: something about him grows back.", difficulty: 1 },
      { kind: "tell", text: "He never looks behind him, and never listens when warned.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "He asked Brahma for protection from gods and spirits, and scorned to ask it of men: a mortal's arrow hits him fully.", difficulty: 2 },
      { kind: "realization", text: "Vibhishana's secret: the nectar is in his navel. The Brahmastra stops the heads and breaks the boon at once.", difficulty: 2, deep: true } ] },
    hypnotist: { traits: ["theLook", "entrainer", "gentleHand"], obs: [
      { kind: "tell", text: "He never takes his eyes off one of you.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Break the gaze: cut the pendulum's cord and the hold slips.", difficulty: 2 },
      { kind: "realization", text: "He watches one foe and one foe only: everything he does answers the marked one. Send someone else.", difficulty: 2, deep: true },
      { kind: "state", id: "fixed", text: "His attention sits on one foe: the marked one.", difficulty: 1 } ] },
    sita: { traits: ["devoutBeliever", "loyal"], obs: [
      { kind: "tell", text: "She looks toward the edge of the field, as if someone is about to arrive.", difficulty: 1 },
      { kind: "tell", text: "Her eyes go far away before the world around her turns to dream.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "She is light and can be carried off, as Ravana carried her: a pull or a lift takes her out of any line drawn for her.", difficulty: 2 },
      { kind: "realization", text: "She is a promise that her house will come. Reach her before the round turns, or meet everyone she calls.", difficulty: 2 } ] },
    lakshmana: { traits: ["loyal", "impatient", "rivalrous"], obs: [
      { kind: "tell", text: "He never strays more than a few steps from the ally he is guarding.", difficulty: 1 },
      { kind: "tell", text: "He draws a line on the ground before he fights, and watches it.", difficulty: 1 },
      { kind: "weakness", channel: "rubedo", text: "Indrajit's Shakti, a living force driven through the body, felled him: a resonant blow puts him down.", difficulty: 2 },
      { kind: "realization", text: "His line holds only while the one inside stays put. Make them move, or draw him away, and it breaks.", difficulty: 2 } ] },
    rama: { traits: ["honorable", "dutiful"], obs: [
      { kind: "tell", text: "He says what he will do before he does it, and then does exactly that.", difficulty: 1 },
      { kind: "tell", text: "He fixes his eyes on one foe and the bow follows them.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "A lure that travels draws him off: Maricha's golden deer led him away from Sita. Something moving away from him gets chased.", difficulty: 2 },
      { kind: "realization", text: "His word binds him. Find what he swore, and make keeping it cost him; a broken word takes his Brahmastra with it.", difficulty: 2 } ] },
    jambavan: { traits: ["contemplative", "traditionalist"], obs: [
      { kind: "tell", text: "He talks before he fights, and his allies stop to listen.", difficulty: 1 },
      { kind: "tell", text: "He stays back, where he can see everyone on his side.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Indrajit's arrows laid him low on the battlefield: a piercing shot reaches the old bear before his speech does.", difficulty: 2 },
      { kind: "realization", text: "He is the council, not the army. Reach him early and his whole side fights without his knowledge or his charge.", difficulty: 2 } ] },
    hanuman: { traits: ["loyal", "courageous", "rivalrous"], obs: [
      { kind: "tell", text: "He glances at his allies before he moves, as if he is waiting to be told something.", difficulty: 1 },
      { kind: "tell", text: "He grows or shrinks before the blow, never after.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "He yields to a bound weapon he respects: in Lanka he let Indrajit's Brahmastra hold him. A piercing, binding shot catches him.", difficulty: 2 },
      { kind: "realization", text: "He does not know his own strength. Drop his allies before one of them reminds him, and he never grows.", difficulty: 2 } ] },
    monkey_king: { traits: ["proud", "impatient"], obs: [{ kind: "tell", text: "Plucks a hair before it moves in; suddenly there are two of him.", difficulty: 1 }, { kind: "tell", text: "Trades places with the copy; the blow comes from the wrong monkey.", difficulty: 1 }, { kind: "weakness", channel: "nigredo", text: "The hair lasts one turn and dies to a touch: kill the clone and the mischief dies with it.", difficulty: 2 }] },
    martial_artist: { traits: ["playfulness", "competitive"], obs: [{ kind: "tell", text: "Cups her hands and holds still; the air between her palms starts to hum.", difficulty: 1 }, { kind: "weakness", channel: "nigredo", text: "Before she ascends she is one disciplined body: spill the held charge and end her before the fight teaches her.", difficulty: 2 }, { kind: "realization", text: "Every scar is a lesson and every lesson is fuel: the longer she fights, the closer the gold.", difficulty: 2 }] },
    oil_billionaire: { traits: ["greedy", "ambitious"], obs: [{ kind: "tell", text: "Drills first, counts barrels, then looks at who is standing nearest.", difficulty: 1 }, { kind: "tell", text: "Stands clear of his own slick; the flare comes next.", difficulty: 2 }, { kind: "realization", text: "He can only buy what his barrels cover, and each buyout of the same fighter costs one more.", difficulty: 2 }] },
    tech_billionaire: { traits: ["ambitious", "genius", "greedy", "rivalrous"], obs: [{ kind: "tell", text: "Offers before it attacks: watch who it is being generous to.", difficulty: 1 }, { kind: "weakness", channel: "nigredo", text: "Nothing on the platform protects the one holding it: hit him and it all comes down.", difficulty: 2 }, { kind: "realization", text: "Its gifts have a switch. Six tiles clear of it for a round and you are off the platform.", difficulty: 2 }] },
    hypebeast: { traits: ["proud", "restless"], obs: [{ kind: "tell", text: "Checks who is watching before doing anything at all.", difficulty: 1 }, { kind: "tell", text: "Stands as if the fight were already won; nothing he has done yet backs it up.", difficulty: 2 }] },
    odysseus: { traits: ["guarded", "stubborn", "curious"], obs: [{ kind: "tell", text: "Retraces a walked route only after checking that it remains open.", difficulty: 1 }] },
    bastet: { traits: ["proud", "curious", "immortal", "catNap", "touchedByMagic"], obs: [
      { kind: "tell", text: "Goes completely still, eyes on one target, before she moves.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Her leap needs her attention held on you and a free tile beside you.", difficulty: 2 } ] },   // Mala, 2026-10-08: Bastet is immortal (the vampire will speak to her). Ported 2026-10-09.
    rapper:{traits:["talkative","curious","resonantVoice","ambitious"],chanceTraits:[["imaginative", 0.3], ["speedTalker",0.3]],obs:[{kind:"tell",text:"Writes three lines, then holds only one; the borrowed idea retains its original limits.",difficulty:1},{kind:"teaching",text:"A practiced repertoire changes the distribution of what you can express.",difficulty:2}]},
    musician:{traits:["collaborative","curious","resonantVoice"], chanceTraits: [["imaginative", 0.3]],obs:[{kind:"tell",text:"Tunes the group before choosing another note; the singer never receives Consonance.",difficulty:1},{kind:"teaching",text:"A calm song holds only while the singer's side stops feeding hostility.",difficulty:2}]},
    jazz_musician:{traits:["talkative","gambler","resonantVoice"], chanceTraits: [["imaginative", 0.3]],obs:[{kind:"tell",text:"Plays the first phrase to the room, then answers whoever answers.",difficulty:1},{kind:"weakness",channel:"rubedo",text:"A hostile vibration detunes the band; silence drops every joiner.",difficulty:2},{kind:"realization",text:"The session is the weapon: each answered phrase can earn the Solo that replays it.",difficulty:2}]},
    bard:{traits:["talkative","collaborative","touchedByMagic","resonantVoice"], chanceTraits: [["imaginative", 0.3]],obs:[{kind:"tell",text:"Weaves a charm into the song: dream creatures listen differently from trained magic users.",difficulty:1},{kind:"teaching",text:"The listener's experience changes how easily a charm takes hold.",difficulty:2}]},
    modern_artist:{traits:["curious","collaborative"], chanceTraits: [["imaginative", 0.3]],obs:[{kind:"tell",text:"Sets up a finite workstation and stays close enough to operate it.",difficulty:1},{kind:"tell",text:"Stores one raster program; another pass replaces it.",difficulty:1},{kind:"realization",text:"The compiled strike needs both a local active workstation and a stored raster program.",difficulty:2}]},
    cyph:{traits:["talkative","collaborative","stoner"], chanceTraits: [["imaginative", 0.3]],obs:[{kind:"tell",text:"Checks a label and waits for an ally's consent before sharing a finite service portion.",difficulty:1},{kind:"tell",text:"Holds one verse in reserve; its borrowed range still matters.",difficulty:1}]},
    general: { traits: ["proud", "stubborn", "loyal", "dutiful"], chanceTraits: [["talkative", 0.4]], obs: [
      { kind: "tell", text: "Names an objective aloud, once, and then turns to look at who will carry it.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "An ordered ally keeps to the plan even after the objective moves: it can't be updated, only replaced.", difficulty: 2 } ] },
    maid: { traits: ["curious", "loyal"], chanceTraits: [["talkative", 0.3], ["agreeable", 0.4]], obs: [
      { kind: "tell", text: "Moves loose objects into a marked service receptacle instead of destroying them.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "Her removal techniques depend on the receptacle staying intact and having room.", difficulty: 2 } ] },

    // dream monsters: "prolonged eye contact" (cumulative observation) can reveal that it isn't a foe
    last_span:           { traits: ["fearful"], dream: true, obs: [{ kind: "teaching", text: "It is about route continuity: every segment must hold when used.", difficulty: 2 }, { kind: "realization", id: "notAFoe", text: "It isn't trying to hurt you. It is the part of you that's afraid of falling.", difficulty: 5, unlocks: ["holdGaze"] }] },
    many_mouths:         { traits: ["loyal"], dream: true, obs: [{ kind: "teaching", text: "It is propagation: one threat through many open routes.", difficulty: 2 }, { kind: "realization", id: "notAFoe", text: "The pack is chasing what's behind you, not you.", difficulty: 5, unlocks: ["holdGaze"] }] },
    amber_host:          { traits: ["curious"], dream: true, obs: [{ kind: "teaching", text: "It is a filter: an explicit criterion and a working boundary.", difficulty: 2 }, { kind: "realization", id: "notAFoe", text: "It is looking for a way out, not a way in.", difficulty: 5, unlocks: ["holdGaze"] }] },
    witness_vessel:      { traits: ["complex"], dream: true, obs: [{ kind: "teaching", text: "It is a signal, and a signal is not the action.", difficulty: 2 }, { kind: "realization", id: "notAFoe", text: "The eye is your own attention. It only shows what you already expect.", difficulty: 5, unlocks: ["holdGaze"] }] },
    salt_heir:           { traits: ["lonely"], dream: true, obs: [{ kind: "teaching", text: "It is storage: held water is not removed water.", difficulty: 2 }, { kind: "realization", id: "notAFoe", text: "It is guarding what's left, not taking it.", difficulty: 5, unlocks: ["holdGaze"] }] },
    unfinished_customer: { traits: ["stubborn"], dream: true, obs: [{ kind: "teaching", text: "It is a habit that outlived its reason.", difficulty: 2 }, { kind: "realization", id: "notAFoe", text: "It is lost, and it's been waiting for someone to notice.", difficulty: 5, unlocks: ["holdGaze"] }] },

    // the seven classic dream monsters (dream/enemy-dreams-data.js `teaches` and `counter`); the ghost also has its unfinished business
    vampire: { traits: [], dream: true, obs: [{ kind: "teaching", text: "It is diffusion: flow runs down a gradient, from more to less, and stops when they're level.", difficulty: 2 }, { kind: "tell", text: "Take its shade away, shove it into the sun, or stay healthier than it: the drain only flows downhill.", difficulty: 1 }] },
    mummy: { traits: [], dream: true, obs: [{ kind: "teaching", text: "It is inertia: what is preserved resists change, until something changes it all at once.", difficulty: 2 }, { kind: "tell", text: "Fire undoes it, or stay out of reach: it moves one tile a turn.", difficulty: 1 }] },
    skeleton: { traits: [], dream: true, obs: [{ kind: "teaching", text: "It is pruning: remove one part and what is left changes, and that cuts both ways.", difficulty: 2 }, { kind: "tell", text: "Impact doubles against brittle bone and stops it re-forming.", difficulty: 1 }] },
    frankenstein: { traits: [], dream: true, obs: [{ kind: "teaching", text: "It is resonance: matched input builds a response, so feeding it its own frequency makes it stronger.", difficulty: 2 }, { kind: "tell", text: "Do not hit it with resonance; light a fire between you and it.", difficulty: 1 }] },
    zombie: { traits: [], dream: true, obs: [{ kind: "teaching", text: "It is pathway: the shortest route is predictable, and predictable routes can be used against it.", difficulty: 2 }, { kind: "tell", text: "Stand so another unit is closer to it than you are, and heal off the infection.", difficulty: 1 }] },
    werewolf: { traits: [], dream: true, obs: [{ kind: "teaching", text: "It is threshold: a state that switches when a condition is crossed and switches back when it is not.", difficulty: 2 }, { kind: "tell", text: "Fight it under clear sun, or wait for the forecast.", difficulty: 1 }] },
    ghost: { traits: [], dream: true, obs: [{ kind: "teaching", text: "It is boundary: a line that holds what is inside as much as it keeps things out.", difficulty: 2 }, { kind: "tell", text: "Step outside its haunt, or understand it: a fully observed ghost leaves.", difficulty: 1 }, { kind: "realization", id: "unfinishedBusiness", text: "It is not here to hurt anyone. It stays for something left unfinished, and being understood is what lets it go.", difficulty: 4, unlocks: [] }] },

    // ecological monsters
    feralPig: { traits: ["skittish"], obs: [{ kind: "state", id: "cornered", text: "Cornered animals fight harder.", difficulty: 1 }] },
    termites: { traits: ["honest"], obs: [{ kind: "weakness", channel: "citrinitas", text: "Spreading effects scatter the swarm.", difficulty: 0 }] },

    hooded_cyber_rogue: { traits: ["guarded", "restless", "ambitious"], obs: [
      { kind: "tell", text: "Writes a small debt before looking at the door.", difficulty: 1 },
      { kind: "tell", text: "Goes quiet, then checks the tile beside them.", difficulty: 1 },
    ] },
    memorialist: { traits: ["dutiful", "merciful", "steward"], obs: [
      { kind: "tell", text: "Mouths a name whenever anyone falls.", difficulty: 1 },
      { kind: "tell", text: "Touches the ledger before spending anything.", difficulty: 1 },
    ] },
    hot_pot_berserker: { traits: ["charitable", "courageous", "ironStomach"], chanceTraits: [["culinaryTraining", 0.35], ["kitchenAnimism", 0.10]], obs: [
      { kind: "tell", text: "The lid rattles before he charges.", difficulty: 1 },
      { kind: "tell", text: "Ladles a portion for whoever is closest, friend or not, then thinks better of it.", difficulty: 1 },
    ] },
    chef: { traits: ["thrifty", "dutiful", "culinaryTraining"], chanceTraits: [["agreeable", 0.4], ["kitchenAnimism", 0.10]], obs: [
      { kind: "tell", text: "Wipes the pass and sets one clean plate down on a tile before he steps in; the plate is already there when the first blow lands.", difficulty: 1 },
      { kind: "realization", text: "A laid plate holds full strength only a round or two and then fades unless he renews it, and a foe who walks onto it clears it.", difficulty: 2 } ] },
    seedkeeper: { traits: ["steward", "thrifty", "dreamer"], obs: [
      { kind: "tell", text: "Pats the ground where nothing is buried yet.", difficulty: 1 },
      { kind: "tell", text: "Counts empty tiles like coins.", difficulty: 1 },
    ] },
    ferryman: { traits: ["dutiful", "merciful", "stubborn"], obs: [
      { kind: "tell", text: "Taps the oar twice before every crossing.", difficulty: 1 },
      { kind: "tell", text: "Counts heads, including yours.", difficulty: 1 },
    ] },
    pearl_diver: { traits: ["guarded", "superstitious", "curious"], obs: [
      { kind: "tell", text: "Tests the water with one finger before every descent.", difficulty: 1 },
      { kind: "tell", text: "Never takes the same way out of the water twice.", difficulty: 1 },
    ] },
    teal_eel: { traits: ["gills", "proud", "loyal"], obs: [
      { kind: "tell", text: "The gill slits keep working when the hole floods. A drowning mark does not stay.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "On dry stone the coil has nothing to brace against. Fight them off the water.", difficulty: 1 },
      { kind: "realization", text: "The wall and the weight are the same body. Dry ground is the opening.", difficulty: 2 } ] },
    remora_adventurer: { traits: ["gills", "curious", "ambitious"], obs: [
      { kind: "tell", text: "The gill slits stay open in the splash. A drowning mark does not stay.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "The trident is the reach. Step inside it, on dry ground.", difficulty: 1 },
      { kind: "realization", text: "They hitch, then take a piece. Dry ground drops the hitch.", difficulty: 2 } ] },
    orgonite_trooper: { traits: ["heavyArmor", "dutiful", "steward"], obs: [
      { kind: "tell", text: "Taps the chest plate once before the first shot: the suit is already the tool.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Break the woven site on their body. Without it the lance refuses.", difficulty: 1 },
      { kind: "realization", text: "The first setup is free. After that, destroy the workstation and stay off adjacent tiles so the call has no door.", difficulty: 2 } ] },
    leviathan_suit: { traits: ["hardy", "restless", "dreamer"], obs: [
      { kind: "tell", text: "The suit hums like a plant under glass before they steal a breath of the present.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "Kill the plant. Pulse has nothing to restore; the merge only mends and knocks.", difficulty: 1 },
      { kind: "realization", text: "Seal every tile beside them before the bar fills. The circuit still heals; nobody steps through.", difficulty: 2 } ] },
    scale_firmware: { traits: ["heavyArmor", "imaginative", "ambitious"], obs: [
      { kind: "tell", text: "Looks past you at a shape that is not there yet, then aims the suit at it.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "No traveler. Break the workstation and the forge has nowhere to run.", difficulty: 1 },
      { kind: "realization", text: "The picture is the weapon. Cover and a dead tool stop it; there is no Child behind the hit.", difficulty: 2 } ] },
    white_jacket_gunner: { traits: ["hardy", "tinkerer", "ambitious"], obs: [
      { kind: "tell", text: "Runs a test print in the air before the real shot. The buffer is the invitation.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Layer Mask only cuts albedo. A nigredo hit walks through the print.", difficulty: 1 },
      { kind: "realization", text: "Spend or wait out the raster, then take a non-albedo line. Seal the tiles if the bar is full.", difficulty: 2 } ] },
    bronze_admin: { traits: ["hardy", "dutiful", "steward"], obs: [
      { kind: "tell", text: "Files the order on you before anyone else has moved. The brief is already dated.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "Alone, the order has no carrier until a Child steps through.", difficulty: 1 },
      { kind: "realization", text: "Cut the carrier. Isolate the admin. A sealed ring still means the call lands on nobody.", difficulty: 2 } ] },
    horned_suit: { traits: ["heavyArmor", "imaginative", "dreamer"], obs: [
      { kind: "tell", text: "Looks at an ally as if they were already holding the brief.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "No traveler. Nobody to carry means the mandate is only a picture.", difficulty: 1 },
      { kind: "realization", text: "Isolate them and strip the ward. The picture does not walk through walls.", difficulty: 2 } ] },
    // Fighter hot-builds (Muse Berry BD, 2026-10-29)
    bard_artificer: { traits: ["tinkerer", "artist"], chanceTraits: [["methodActing", 0.5]], obs: [
      { kind: "tell", text: "Tunes something small and fiddly before every big number.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "The instruments are wood and wire: break them and the band goes quiet.", difficulty: 1 },
      { kind: "realization", text: "Every recast repeats the last basic: read one bar and you have read the song.", difficulty: 2 } ] },
    big_game_hunter: { traits: ["heavyBones", "scout", "playfulness"], obs: [   // merge spec H1 (2026-11-07): Heavy Bones (biology, live via combat.extra), Scout (psychology), Playfulness (value); keenSenses (planned, no effect) and curious dropped
      { kind: "tell", text: "Looks at one of you longer than the rest, and writes something down. That one is the quarry.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "One catalogue at a time: flood the field and her notes spread thin.", difficulty: 2 },
      { kind: "realization", text: "She hits hardest what she has studied, and hardest of all on something bigger than her: hide from her looks, and meet her first swing with a smaller fighter.", difficulty: 2 } ] },
    burlesque_dancer: { traits: ["theLook", "playfulness"], chanceTraits: [["methodActing", 0.5]], obs: [
      { kind: "tell", text: "Holds still for one beat too long before the reveal.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "No audience, no leverage: smoke, walls, and averted eyes.", difficulty: 1 },
      { kind: "realization", text: "Every gaze she holds is AP you never spend: look away early and cheap.", difficulty: 2 } ] },
    clown: { traits: ["fool", "playfulness"], chanceTraits: [["curious", 0.5]], obs: [
      { kind: "tell", text: "Pats its pockets down before anything big comes out of them.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Short arms: everything it does reaches four tiles or fewer.", difficulty: 1 },
      { kind: "realization", text: "The pocket pops if the Clown is Stunned: save one stun for the fold.", difficulty: 2 } ] },
    mma_fighter_alternate: { traits: ["ironJaw", "neverGiveUp"], chanceTraits: [["stubborn", 0.5]], obs: [
      { kind: "tell", text: "Plants both feet and stops circling before it braces.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "It must stand still: shove it off its tile.", difficulty: 1 },
      { kind: "realization", text: "The Decision only bites while it stands its ground: relocate, then punish.", difficulty: 2 } ] },
    hermes: { traits: ["godlyAgility", "talkative"], chanceTraits: [["curious", 0.5]], obs: [
      { kind: "tell", text: "Already moving before anyone else has decided.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Root the runner: the network goes quiet with him.", difficulty: 1 },
      { kind: "realization", text: "He hits like a letter, not a hammer: the danger is the delivery, not the damage.", difficulty: 2 } ] },
    kaikeyi: { traits: ["proud", "ambitious"], chanceTraits: [["greedy", 0.5]], obs: [
      { kind: "tell", text: "Counts on her fingers: who owes, who pays, who is pruned.", difficulty: 1 },
      { kind: "weakness", channel: "rubedo", text: "No debtors, no queen: starve her prices and she slows to a clerk.", difficulty: 2 },
      { kind: "realization", text: "Pay the FF instead of taking the damage: the levy is a choice.", difficulty: 2 } ] },
    // Warrior hot-builds (Muse Berry BD, 2026-10-29)
    cactusguard: { traits: ["dutiful", "stubborn"], chanceTraits: [["curious", 0.5]], obs: [
      { kind: "tell", text: "Plants itself between you and whatever it guards. It will not be moving.", difficulty: 1 },
      { kind: "weakness", channel: "nigredo", text: "Outrange the wall: everything it does is adjacent.", difficulty: 1 },
      { kind: "realization", text: "The crown only opens once the bar is full: break the wall first.", difficulty: 2 } ] },
    cactuswar: { traits: ["neverGiveUp", "loyal"], chanceTraits: [["stubborn", 0.5]], obs: [
      { kind: "tell", text: "Bleeds purple and grins wider for it.", difficulty: 1 },
      { kind: "weakness", channel: "citrinitas", text: "Control without damage starves it: it needs pain to spend.", difficulty: 2 },
      { kind: "realization", text: "One stand per battle at 1 LF: the second killing blow lands.", difficulty: 2 } ] },
    pixel_treant: { traits: ["curious", "tinkerer"], chanceTraits: [["guarded", 0.5]], obs: [
      { kind: "tell", text: "Flickers at the edges when it is thinking.", difficulty: 1 },
      { kind: "weakness", channel: "albedo", text: "Stand next to it: no firewall stops a fist.", difficulty: 1 },
      { kind: "realization", text: "The checksum eats one condition a round: bring two, or bring damage.", difficulty: 2 } ] },

    // summons (friends can be observed too)
    "summon:*": { traits: ["inSync"], obs: [] },
  };

  // Deep observations added by the "complex" trait.
  const complexExtras = [
    { kind: "contradiction", text: "What it says and what it does don't line up.", difficulty: 3 },
    { kind: "state", id: "history", text: "It has fought this kind of fight before, and lost.", difficulty: 3, unlocks: ["talk"] },
  ];

  // ── Observe Self: Johari's window (Mala, 2026-10-08) ─────────────────────────────────────────────
  // The player character has self-traits. Each has two flags, which place it in one of four panes:
  //   known to you + apparent to others = Open      known to you + not apparent = Hidden
  //   unknown to you + apparent = Blind              unknown to you + not apparent = Unknown
  // Observe Self reveals one trait you don't know yet: Blind spots first (others already see them, so
  // it's a smaller insight), then the Unknown pane (deeper, so a greater one). Each reveal charges the
  // ultimate bar, small to great by depth. The less you know yourself, the more AP it costs to look.
  // Knowing your own tell also makes it harder for enemies to read (+1 difficulty for their observers).
  const self = {
    cost: { minAP: 10, maxAP: 50 },                      // AP = 10 + 40 × (share of self-traits still unknown to you)
    charge: { blind: { base: 8, perDepth: 4 }, unknown: { base: 25, perDepth: 10 } },   // blind 12–20, unknown 35–55
    traitsPerCharacter: 12, apparentShare: 0.5,       // seeded sequential sample; relationship weights are below
    // Directed association scores used in sequential character generation. A positive score makes the
    // second trait more likely after the first; a negative score makes it less likely. These are
    // authored personality hypotheses for game flavor, not clinical claims.
    relationships: [
      { from: "quickTempered", to: "apologetic", weight: 1.2, clue: "A short fuse can come with an urge to make amends afterward. Watch what happens after conflict." },
      { from: "quickTempered", to: "reckless", weight: 0.45, clue: "A quick temper can travel with acting before considering the cost." },
      { from: "quickTempered", to: "calm", weight: -0.8, clue: "A quick temper makes steady composure somewhat less likely, though people can contain contradictions." },
      { from: "apologetic", to: "quickTempered", weight: 0.65, clue: "Frequent repair attempts can sometimes follow a pattern of losing one's temper." },
      { from: "impulsive", to: "selfDoubt", weight: 0.45, clue: "Acting quickly can be followed by second-guessing the choice." },
      { from: "protective", to: "loyalSelf", weight: 0.55, clue: "Protectiveness can point toward a broader pattern of loyalty." },
      { from: "perfectionist", to: "selfDoubt", weight: 0.65, clue: "High standards can make second-guessing more likely." },
      { from: "afraidOfFalling", to: "cautious", weight: 0.5, clue: "A fear of falling often travels with caution around risk." },
      { from: "generous", to: "empathic", weight: 0.45, clue: "Generosity can be one sign of noticing what others need." },
      { from: "genius", to: "fool", weight: -1.5, clue: "Quick pattern recognition makes repeated misjudgment less likely, though no one is consistent at everything." },
      { from: "believer", to: "nonBeliever", weight: -1.5, clue: "Trust in unseen forces and reliance on evidence often pull in different directions." },
      { from: "nonBeliever", to: "believer", weight: -1.5, clue: "Skepticism makes faith in unseen forces less likely, though people can hold contradictions." },
      { from: "believer", to: "devoutBeliever", weight: 0.8, clue: "Tentative belief can deepen when experience appears to confirm it." },
      { from: "devoutBeliever", to: "fullBeliever", weight: 0.9, clue: "Conviction can grow into certainty, though this remains unusual." },
      { from: "nonBeliever", to: "convertedBeliever", weight: 1.4, clue: "Direct experience can overturn even a skeptical worldview." },
      { from: "nonBeliever", to: "unexplainedEvent", weight: 1.1, clue: "They may accept that something happened while remaining unsure of its cause." },
      { from: "unexplainedEvent", to: "convertedDevout", weight: 0.9, clue: "A second experience can make an unfamiliar explanation feel less likely." },
      { from: "convertedDevout", to: "convertedBeliever", weight: 0.65, clue: "Tentative acceptance may grow into certainty after more evidence." },
      { from: "convertedBeliever", to: "fullBeliever", weight: 0.6, clue: "A conversion can deepen into a steadier faith." },
      { from: "convertedBeliever", to: "nonBeliever", weight: -1.2, clue: "A life-changing encounter makes a return to old skepticism less likely." },
      { from: "fullBeliever", to: "nonBeliever", weight: -1.8, clue: "Complete faith and active skepticism rarely reinforce each other." },
      { from: "nonBeliever", to: "fullBeliever", weight: -1.8, clue: "A skeptical outlook makes complete belief less likely, not impossible." },
      { from: "genius", to: "curiousSelf", weight: 0.45, clue: "Fast learning often travels with curiosity." },
      { from: "fool", to: "genius", weight: -1.5, clue: "A pattern of costly mistakes makes exceptional pattern-reading less likely, not impossible." },
      { from: "fool", to: "impulsive", weight: 0.55, clue: "Missing a pattern can leave someone acting before they have checked it." },
      { from: "collaborative", to: "rivalrous", weight: -1.1, clue: "A collaborative style is less likely to be driven by rivalry, though both can coexist." },
      { from: "collaborative", to: "empathic", weight: 0.6, clue: "Coordination can grow from noticing what others need." },
      { from: "rivalrous", to: "collaborative", weight: -1.1, clue: "A strongly competitive style can make shared effort less likely." },
      { from: "rivalrous", to: "competitive", weight: 0.55, clue: "Rivalry often follows a competitive streak." },
    ],
    knownTellObserverDifficultyAdd: 1,
    catalog: [
      { id: "restless",   name: "Restless",   kind: "tell",     depth: 1, text: "After you land a hit, you step forward without thinking." },
      { id: "protective", name: "Protective", kind: "trait",    depth: 1, category: "values", text: "You turn toward whoever on your side is hurt." },
      { id: "proudSelf",  name: "Proud",      kind: "trait",    depth: 2, text: "You answer challenges you could have ignored." },
      { id: "cautious",   name: "Cautious",   kind: "trait",    depth: 1, text: "You hold back your strongest move longer than you need to." },
      { id: "impulsive",  name: "Impulsive",  kind: "tell",     depth: 2, text: "When surprised, you reach for the first ability, not the right one." },
      { id: "curiousSelf",name: "Curious",    kind: "trait",    depth: 1, text: "You look at things that can't hurt you instead of things that can." },
      { id: "afraidOfFalling", name: "Afraid of falling", kind: "fear", depth: 3, text: "Ledges and bridges make you hesitate." },
      { id: "needsApproval",   name: "Needs approval",    kind: "fear", depth: 3, text: "You keep score of what others think of your choices." },
      { id: "steadyUnderPressure", name: "Steady under pressure", kind: "strength", depth: 2, text: "You think more clearly the worse things get." },
      { id: "patternSeeker",  name: "Pattern-seeker", kind: "strength", depth: 2, text: "You notice repetition before anyone else." },
      { id: "selfDoubt",  name: "Self-doubt", kind: "fear",     depth: 3, text: "You second-guess correct answers." },
      { id: "generous",   name: "Generous",   kind: "trait",    depth: 1, category: "values", text: "You spend resources on others before yourself." },
      { id: "hesitant",   name: "Hesitant",   kind: "tell",     depth: 2, text: "You pause for a beat before committing an ultimate." },
      { id: "distractible", name: "Distractible", kind: "tell", depth: 1, text: "Your eyes go to items on the ground mid-fight." },
      { id: "competitive", name: "Competitive", kind: "trait",  depth: 1, text: "You chase the strongest opponent, not the most dangerous one." },
      { id: "loyalSelf",  name: "Loyal",      kind: "trait",    depth: 2, text: "You won't leave a summon or ally behind, even when you should." },
      { id: "reckless",   name: "Reckless",   kind: "trait",    depth: 2, text: "You trade hits you could have avoided." },
      { id: "quickTempered", name: "Quick-tempered", kind: "tell", depth: 2, text: "Frustration reaches your voice before you have time to soften it." },
      { id: "apologetic", name: "Apologetic", kind: "strength", depth: 2, text: "After you hurt someone with your words, you try to repair the damage." },
      { id: "genius", name: "Genius", kind: "strength", depth: 3, text: "You learn patterns quickly; abilities land with 5% more force and each concept use builds 20% more ultimate charge.", combat: { abilityDamageMul: 1.05, ultimateChargeMul: 1.2 } },
      { id: "fool", name: "Fool", kind: "tell", depth: 3, text: "You miss patterns and learn through mistakes; abilities land with 5% less force and concept use builds 20% less ultimate charge.", combat: { abilityDamageMul: 0.95, ultimateChargeMul: 0.8 } },
      { id: "believer", name: "Believer", kind: "strength", depth: 3, text: "Belief can draw a wild creature; stronger belief can reach into the Dream Space.", combat: { rareMonsterSummon: true, beliefStrength: 1 } },
      { id: "devoutBeliever", name: "Devout believer", kind: "strength", depth: 4, text: "Their conviction can pull a lesser creature from the Dream Space.", combat: { rareMonsterSummon: true, beliefStrength: 2 } },
      { id: "fullBeliever", name: "Full believer", kind: "strength", depth: 5, text: "Their certainty can call powerful Dream Space creatures—sometimes one, sometimes two.", combat: { rareMonsterSummon: true, beliefStrength: 3 } },
      { id: "nonBeliever", name: "Non-believer", kind: "trait", depth: 2, text: "Deals 20% more damage to summoned creatures and takes 20% less damage from them.", combat: { summonDamageDealtMul: 1.2, summonDamageTakenMul: 0.8 } },
      { id: "collaborative", name: "Collaborative", kind: "strength", depth: 2, text: "You build momentum by coordinating with others; concept use builds 10% more ultimate charge.", combat: { abilityDamageMul: 0.98, ultimateChargeMul: 1.1 } },
      { id: "rivalrous", name: "Rivalrous", kind: "trait", depth: 2, text: "Competition sharpens your attacks by 4%, but builds ultimate charge 10% more slowly. A named rival on the field draws double hostility.", combat: { abilityDamageMul: 1.04, ultimateChargeMul: 0.9 } },
      { id: "perfectionist", name: "Perfectionist", kind: "fear", depth: 3, text: "A mistake early in a fight stays with you to the end." },
      { id: "calm",       name: "Calm",       kind: "strength", depth: 2, text: "Your breathing doesn't change when the plan does." },
      { id: "empathic",   name: "Empathic",   kind: "strength", depth: 3, text: "You can feel when someone across from you is afraid." },
    ],
  };

  return { survivalText, SURVIVAL, contagiousIdeas, rules, traits, temperSpawn, focusSpawn, traitCategories, traitDynamics, imitateDifficulty, valueSpawn, biologySpawn, spawnTraits, imagination, beliefSpawn, beliefTraits, spiritSpawn, spiritOdds, spiritCertain, kinds, actions, profiles, complexExtras, self };
});
