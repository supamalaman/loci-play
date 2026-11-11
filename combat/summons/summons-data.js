"use strict";
// Summons: allies the player calls out of the memory palace for a few turns (Mala, 2026-10-07).
// They are AI-controlled; each has an ATTITUDE (how it chooses targets and positions) and its own voice
// (dialogue/summon-voices.js). Roster and signatures are Mala's (pasted design, 2026-10-07).
//
// Shipping rule: every summon fights NOW with a stand-in kit built from concepts the engine already has.
// Its own concepts and signature/ultimate are recorded as `spec` until each new concept passes the
// character brief's newConcept checklist (mechanism, limits, abilities, lenses, authored edges).
// Plain data only. All numbers PROVISIONAL.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatSummonData = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const rules = {
    // Summon effort (Mala, 2026-10-10): manifesting a tulpa is a BIG spend. 80 of a turn's 100 action points leaves
    // enough for a Guard (15) or two steps (10 each) and nothing else: no technique (25+), no committed strike.
    // The way to summon AND act is to prepare for it: Stall banks up to one turn, so a banked turn (up to 200 AP)
    // pays for the summon and still leaves a full action. Inside Dream Space it costs half (dream/dreamspace.js).
    actionCost: 80,
    phiCost: 8,
    baseDuration: 3,              // the summon's own turns before it returns to the palace
    bondBonusDuration: 1,         // +1 turn when the summon's palace room is fully recalled
    maxActive: 1,
    oncePerEncounter: true,       // a summon that leaves (expired or defeated) can't be called again this battle
    appearsWithin: 2,             // tiles from the player
    maxLF: 45,
    // Death's door (Mala, 2026-10-10): when the summoner is downed with action points still unspent, there is a small
    // chance one of their unlocked, unused summons arrives unbidden to defend the body. The battle is not lost while
    // that summon stands; it stays its normal number of turns and the loss resolves when it leaves or falls.
    // Chance = base + perTurnOfAp × (AP left ÷ 100), capped: 10% with a sliver of AP, 20% with a full turn unspent.
    // It is a gamble on purpose (Mala): the fallen must still hold the summon's own cost in unspent action points
    // (requiresSummonCost: rules.actionCost, 80), so the way to court it is to Stall while badly hurt instead of
    // guarding. A Gambler (insight trait) qualifies with half of that (40) and is twice as likely.
    deathDoor: { baseChance: 0.10, perTurnOfAp: 0.10, maxChance: 0.20, oncePerBattle: true, spendsRemainingAp: true, requiresSummonCost: true,
      gambler: { trait: "gambler", chanceMul: 2, costMul: 0.5, bankBelowLf: 0.35 } },
    palaceWalk: "mind-palace",    // the walk whose rooms hold the summons (to be built in the Explainer Library)
    // Ordering a summon's ultimate (Mala, 2026-10-07): when the player's ultimate charge is FULL, the
    // player may spend all of it (a 20 AP command) to order the summon to fire its ultimate at the start
    // of its next turn. Novas are announced at order time (area fixed, the summon holds position,
    // enemies get the response window, ×1.40 announce bonus). If the summon leaves first, the order and
    // the charge are lost. Once per summon appearance.
    order: { chargeCost: "full", actionCost: 20, holdPosition: true, lostIfSummonLeaves: true, oncePerAppearance: true, announceMultiplier: 1.4 },
    // MAX channel (Mala, 2026-10-24): while your Dream Space is open, spend your FULL ultimate bar plus
    // 40 AP to pour the dream into a revealed Napoleon. The dream is consumed (it closes); he goes MAX
    // permanently for this stay: double turns, the Apotheosis Battery, a new ultimate. The cost is the
    // gate — AP, Dream and ULT all at once — so nothing about the form fades when the dream does.
    maxChannel: { chargeCost: "full", actionCost: 40 },
  };

  // Playable ultimates by type. `play` is what ships now with existing effects; the summon's
  // `ultimate.mechanism` remains the full design target.
  //   heal: restore LF to allies in radius      buff: timed status on allies in radius (or everyone)
  //   nova: burst on hostiles in radius around a centre (damage, stun or dispel; allies are unharmed)
  const ultimateTypes = { buff: "Strengthens allies for a few turns.", heal: "Restores allies' LF.", nova: "Bursts on every hostile in an area; announced, so they can respond." };

  // How each attitude steers the shared AI scorer. Weights multiply the engine's candidate score.
  //   target: who it prefers to hit; position: where it likes to stand; guard: willingness to block for the player.
  const attitudes = {
    sovereign:  { label: "Sovereign",  target: "strongestThreat", position: "holdGround",   weights: { damage: 1.0, control: 1.4, protect: 0.8, risk: 0.6 }, text: "Holds a line, enforces one rule, and refuses to retreat past it." },
    protective: { label: "Protective", target: "attackerOfWeakestAlly", position: "nearWeakestAlly", weights: { damage: 0.6, control: 0.8, protect: 1.8, risk: 1.2 }, text: "Stays beside whoever is hurt most and takes hits for them." },
    playful:    { label: "Playful",    target: "seededRandom",  position: "wander",       weights: { damage: 0.9, control: 1.2, protect: 0.6, risk: 1.0 }, text: "Unpredictable on purpose: picks surprising targets and odd angles." },
    vigilant:   { label: "Vigilant",   target: "lastAttacker",  position: "guardPlayer",  weights: { damage: 0.8, control: 1.0, protect: 1.4, risk: 0.5 }, text: "Watches what hit the player and answers that exact threat." },
    commanding: { label: "Commanding", target: "focusFire",     position: "behindFront",  weights: { damage: 1.3, control: 1.0, protect: 0.7, risk: 0.5 }, text: "Joins whatever the player is already attacking: concentrate force." },
    relentless: { label: "Relentless", target: "sameTargetUntilDown", position: "close", weights: { damage: 1.5, control: 0.6, protect: 0.4, risk: 1.4 }, text: "Picks one opponent and keeps going until it answers." },
    analytical: { label: "Analytical", target: "loadBearing",   position: "keepDistance", weights: { damage: 0.9, control: 1.5, protect: 0.8, risk: 0.4 }, text: "Breaks the effect everything else depends on (walls, parries, delayed strikes)." },
    roaming:    { label: "Roaming",    target: "isolated",      position: "flank",        weights: { damage: 1.2, control: 0.8, protect: 0.5, risk: 1.0 }, text: "Takes the open route around and hits whoever is alone." },
    spreading:  { label: "Spreading",  target: "clustered",     position: "close",        weights: { damage: 1.1, control: 1.0, protect: 1.0, risk: 1.2 }, text: "Goes where enemies bunch up; durable and hard to remove." },
    deceptive:  { label: "Deceptive",  target: "unaware",       position: "keepDistance", weights: { damage: 0.8, control: 1.4, protect: 0.5, risk: 0.6 }, text: "Works through tells and misdirection; avoids a straight fight." },
  };

  // standIn: concepts from content.js the summon uses until its own concepts exist.
  // proposed: Mala's concept design (primary/secondary/reserve/personal), kept verbatim.
  const summons = {
    the_king: { name: "The King", trueForm: { sprite: "the-king-true-form", name: "The King · True Form", provisional: true,
      maxLFMul: 1.4, potencyMul: 1.1, pfRegenAdd: 0, revealEffect: { kind: "royalTribute" },
      // Royal Tribute is read by account/loot.js (rollDrops): one guaranteed extra roll, rarer odds on every roll.
      tribute: { extraRolls: 1, rarityMul: { common: 0.5, uncommon: 1.5, rare: 2.5, legendary: 2 }, rarityFloor: { rare: 0.6, legendary: 0.1 } },
      traits: [
        { id: "royalTribute", name: "Royal Tribute", text: "Once his true form has been revealed, this battle pays tribute: one guaranteed extra loot roll, and every roll is likelier to be uncommon, rare or legendary. It holds even if he returns to the palace or the battle is lost." },
        { id: "crownedBearing", name: "Crowned Bearing", text: "+40% maximum LF and +10% technique potency." } ],
      technique: { id: "kneel", name: "Kneel", kind: "decree", cooldown: 2, range: 4, rootTurns: 1, stunPoints: 15,
        text: "The strongest enemy within 4 is ordered to kneel: it cannot move on its next turn and loses 15 action points. Every other turn." },
      text: "Dream Space reveals the King crowned: +40% maximum LF, +10% technique potency, Royal Tribute on this battle's loot, and the Kneel decree." },
      source: "Mind palace", attitude: "sovereign", room: "throne-hall",
      pact: { call: { pf: 6, seeds: 60 }, duration: 4 },   // summon pact terms (Mala-tunable): per-call price + rounds answered
      standIn: { primary: "boundary", secondary: "barrier" },
      proposed: { primary: "Boundary", secondary: "Hierarchy", reserve: "Commitment", personal: "Sovereignty" },
      signature: { name: "Sovereign Exception", status: "spec", mechanism: "Declare one permitted exception to a boundary; strengthen resistance against excluded effects.", constraint: "The King must obey the same exclusion.", counters: ["Exploit the exception", "Force him to cross his own boundary"] },
      ultimate: { name: "There Is Only the Law", status: "spec", mechanism: "Establish a domain with one governing restriction and one public exception.", constraint: "Restriction also binds its owner; cannot be rewritten during activation." ,
        play: { type: "buff", radius: 2, status: { id: "lawsProtection", damageTakenMul: 0.7, duration: 2 }, selfStatus: { id: "boundByLaw", rooted: true, duration: 2 },
        text: "Allies within 2 take 30% less damage for 2 turns. The law binds the King too: he can't move while it holds." } },
      identity: "Authority gains strength through reciprocal obligation." },

    mitsuko: { name: "Mitsuko", trueForm: { name:"Mitsuko · True Form", sprite:"mitsuko-true-form", provisional:true,
      maxLFMul:1.5, potencyMul:1.25, pfRegenAdd:2, revealEffect:{kind:"dazzle",chance:0.4,fraction:0.25},
      text:"Dream Space reveals Mitsuko's armored true form: +50% maximum LF, +25% technique potency and +2 ΦF regeneration per turn. She retains it until she disappears." },
      // MAX (Mala, 2026-11-09, R-20261109-14 hot build; MX1): strength allocated by another's vulnerability. Her wards go to
      // whoever needs them most and never to her; her MAX link sends the most-hurt ally's share to her.
      maxForm: { sprite: "mitsuko-max", name: "Mitsuko · Sun Blossom MAX",
        maxLFMul: 1.2, potencyMul: 1.25, turnsMul: 2, revealEffect: { kind: "petalWard", protection: 10, turns: 2 },
        traits: [
          { id: "fullBloom", name: "Full Bloom", text: "The dream becomes the garden: twice the turns on the field, and the form outlives the dream, returning to the palace when its turns end." },
          { id: "petalWard", name: "Petal Ward", text: "+20% maximum LF and +25% technique potency. On rising she lays a 10-point petal ward on every ally in her region but herself, for 2 of their turns (it replaces only a weaker petal or flow-state ward). What she stores never protects her." } ],
        technique: { id: "wardFollowsNeed", name: "The Ward Follows Need", kind: "petalWard", cooldown: 2, range: 4, protection: 8, turns: 2,
          text: "The ally within 4 with the lowest share of its LF gets a petal ward of 8 base protection for 2 of its turns. Never Mitsuko herself, and it replaces only a weaker petal or flow-state ward, never armour, a hide or a cast ward. Every other turn." },
        ultimate: { name: "No One Falls Alone, Unbroken", status: "spec", mechanism: "A consenting damage-sharing network that she carries for its weakest member.",
          constraint: "Stored protection cannot protect Mitsuko herself; she takes the weakest share in full.",
          play: { type: "heal", radius: 4, heal: 20, status: { id: "sharedBurden", shareDamage: true, carry: true, duration: 3 },
          text: "Heals allies within 4 for 20 base LF and links them for 3 turns (the link ends as each one starts its third turn from now): damage to any linked ally is split evenly across the links, and while Mitsuko is on the field she takes the most-hurt linked ally's share herself." } },
        text: "The dream pours into Mitsuko and she rises in full bloom: twice the turns, petal wards for everyone but herself, and a link she carries for the weakest." },
      source: "Mind palace", attitude: "protective", room: "garden-of-care", pact: { call: { pf: 4, seeds: 35 }, duration: 3 },
      standIn: { primary: "adaptation", secondary: "barrier" },
      proposed: { primary: "Symbiosis", secondary: "Resilience", reserve: "Reciprocity", personal: "Care" },
      signature: { name: "I Will Carry It", status: "spec", mechanism: "Redirect part of an ally's incoming LF damage to herself; convert a bounded portion into protective capacity.", constraint: "Stored protection cannot protect Mitsuko herself.", counters: ["Sever the transfer route", "Separate allies", "Exhaust capacity"] },
      ultimate: { name: "No One Falls Alone", status: "spec", mechanism: "Create a consenting damage-sharing network.", constraint: "Redistribution conserves total damage before explicit protection effects." ,
        play: { type: "heal", radius: 3, heal: 18, status: { id: "sharedBurden", shareDamage: true, duration: 2 },
        text: "Heals allies within 3 for 18 LF and links them for 2 turns: damage to any linked ally is split evenly across the links." } },
      identity: "Strength allocated according to another's vulnerability." },

    inner_child: { chanceTraits: [["imaginative", 0.8]],   // Mala, 2026-10-12: children are usually Imaginative, this one included (engine.js liveSummon rolls it)
      name: "The Inner Child", trueForm: { sprite: "inner-child-true-form", name: "The Inner Child · True Form", provisional: true,
      maxLFMul: 1.2, potencyMul: 1, pfRegenAdd: 1, imaginaryFriend: true,
      traits: [
        { id: "imaginaryFriend", name: "Imaginary Friend", text: "While the Child is on the field in true form, every dream monster that was hostile to the player takes the Child's side: none of them attack him or his allies, and they only go after the player's enemies. They turn back the moment he leaves." },
        { id: "makeBelieve", name: "Make-Believe", text: "+20% maximum LF and +1 ΦF regeneration per turn." } ],
      technique: { id: "tagYoureIt", name: "Tag, You're It", kind: "imaginaryStrike", cooldown: 2, range: 5, potency: 8, perFriend: 6, maxFriends: 2, channel: "albedo",
        text: "Tags one enemy within 5 for 8 base LF damage, +6 for each dream monster playing on the Child's side (up to two). Every other turn." },
      text: "Dream Space reveals the Child with his imaginary friends: dream monsters hostile to the player side with him while he stays, and he can tag an enemy for them." },
      source: "Mind palace", attitude: "playful", room: "playroom", pact: { call: { pf: 4, seeds: 30 }, duration: 3 },
      standIn: { primary: "deception", secondary: "diffusion" },
      proposed: { primary: "Analogy", secondary: "Translation", reserve: "Uncertainty", personal: null },
      signature: { name: "It Could Be Otherwise", status: "spec", mechanism: "Once per encounter, replace a committed secondary application with another compatible interpretation before resolution.", constraint: "Preserve cost, target, and already-revealed facts.", counters: ["Restrict valid alternatives", "Bait the revision"] },
      ultimate: { name: "Let's Play Something Else", status: "spec", mechanism: "Temporarily change one arena rule selected from a validated menu.", constraint: "Announced change applies equally to every combatant." ,
        play: { type: "buff", radius: "all", affects: "everyone", status: { id: "newRules", moveAdd: 1, duration: 2 },
        text: "New rules, for everybody: every combatant on the board, enemies included, gets +1 move for 2 turns." } },
      identity: "Imagination opens possibilities others can also exploit." },

    perimeter_guardian: { name: "The Perimeter Guardian", trueForm: { sprite: "perimeter-guardian-true-form", name: "The Perimeter Guardian · True Form", provisional: true,
      maxLFMul: 1.3, potencyMul: 1.1, pfRegenAdd: 0, revealEffect: { kind: "psychology" },
      // What Hunted Me: each damage type that gets through is taken at perHit of its last rate from then on, never below floor.
      adapt: { perHit: 0.8, floor: 0.4 },
      traits: [
        { id: "whatHuntedMe", name: "What Hunted Me Now Guards Me", text: "It learns what hurt it: each damage type that wounds it does 20% less to it from then on, down to 40% of full." },
        { id: "hundredEyes", name: "A Hundred Eyes", text: "The old nightmare, awake and on your side: +30% maximum LF and +10% technique potency." } ],
      technique: { id: "oldNightmare", name: "The Old Nightmare", kind: "dread", cooldown: 2, range: 4, stunPoints: 10, egoLoss: 0.2,
        text: "Turns every eye on the least steady enemy within 4: it loses 10 action points and some nerve, and if it was already cowed it may break and run. Every other turn." },
      text: "Dream Space reveals what the Guardian used to be: a nightmare of eyes that learns each way it is hurt, and can still frighten." }, source: "Former nightmare monsters defending the mind-palace perimeter", attitude: "vigilant", room: "perimeter-wall", pact: { call: { pf: 5, seeds: 40 }, duration: 3 },
      standIn: { primary: "adaptation", secondary: "inertia" },
      proposed: { primary: "Adaptation", secondary: "Memory", reserve: "Boundary", personal: "Integration" },
      signature: { name: "What Hunted Me Now Guards Me", status: "spec", mechanism: "After surviving a technique, record its delivery pattern and build a defense against repetition.", constraint: "Defense applies only within the recorded pattern's parameter bounds.", counters: ["Change timing", "Change route", "Change lens", "Change composition"],
        detail: "~/Documents/concept-combat-characters/afterwake.{proposal.json,review.md} (same signature; merged here as an ally)" },
      ultimate: { name: "You Cannot Frighten Me the Same Way Twice", status: "spec", mechanism: "Deploy several recorded defenses simultaneously.", constraint: "Announce the recognized patterns before resolution." ,
        play: { type: "buff", radius: 2, status: { id: "rememberedThreats", resistSeenChannels: 0.5, duration: 2 },
        text: "Allies within 2 take half damage from every harm channel that has already hit the player's side this battle, for 2 turns." } },
      identity: "Survived threats become specific protective capabilities." },

    napoleon: { name: "Napoleon", trueForm: { sprite: "napoleon-true-form", name: "Napoleon · True Form", provisional: true,
      maxLFMul: 1.2, potencyMul: 1.2, pfRegenAdd: 0, revealEffect: { kind: "forcedMarch", moveAdd: 1, duration: 2 },
      traits: [
        { id: "forcedMarch", name: "Forced March", text: "On reveal, every living ally gets +1 move for 2 turns: the army arrives before it is expected." },
        { id: "artilleryOfficer", name: "Artillery Officer", text: "He was a gunner first. +20% maximum LF and +20% technique potency, and the Grand Battery is his to call." } ],
      technique: { id: "grandBattery", name: "Grand Battery", kind: "battery", cooldown: 2, range: 5, radius: 1, potency: 10, channel: "citrinitas",
        text: "Massed guns on the densest enemy cluster within 5: 10 base LF damage to every hostile within 1 of the aim point. Allies are never hit. Every other turn." },
      text: "Dream Space reveals Napoleon in the field: +20% maximum LF, +20% technique potency, a Forced March for his allies, and the Grand Battery." },
      // MAX (Mala, 2026-10-24): pour the open dream plus a full ult bar into a revealed Napoleon and he
      // goes MAX permanently for this stay. Double turns, the Apotheosis Battery every other turn, an
      // opening bombardment, and a new orderable ultimate. The dream is consumed by the channel.
      maxForm: { sprite: "cyber-napoleon", name: "Cyber Napoleon MAX",
        maxLFMul: 1.2, potencyMul: 1.25, turnsMul: 2, revealEffect: { kind: "bombardment", potency: 16 },
        traits: [
          { id: "totalMobilization", name: "Total Mobilization", text: "The dream becomes the army: twice the turns on the field, and the form outlives the dream, returning to the palace when its turns end." },
          { id: "emperorOrdnance", name: "The Emperor's Ordnance", text: "+20% maximum LF and +25% technique potency. The Grand Battery answers as the Apotheosis Battery." } ],
        technique: { id: "apotheosisBattery", name: "Apotheosis Battery", kind: "battery", cooldown: 2, range: 6, radius: 2, potency: 16, channel: "citrinitas",
          text: "The guns of the dream itself: 16 base LF damage to every hostile within 2 of the densest enemy cluster within 6. Allies are never hit. Every other turn." },
        ultimate: { name: "Everything Arrives Here, At Once", status: "spec", mechanism: "Commit the whole dream-battery to one location and resolution time.", constraint: "Other locations lose their support.",
          play: { type: "nova", centre: "playerTarget", radius: 2, potency: 26, channel: "citrinitas",
          text: "Everything converges on the player's current target: a 26-potency burst in radius 2 around it. Napoleon makes no other action that turn." } },
        text: "The dream pours into Napoleon and stays poured: Cyber Napoleon MAX — twice the turns, the Apotheosis Battery, and a form that outlives the dream." },
      source: "The Council; fictional game adaptation", attitude: "commanding", room: "council-napoleon", realPerson: true, pact: { call: { pf: 6, seeds: 50 }, duration: 3 },
      standIn: { primary: "pathway", secondary: "threshold" },
      proposed: { primary: "Synchronization", secondary: "Delegation", reserve: "Concentration", personal: null },
      signature: { name: "The Decisive Point", status: "spec", mechanism: "Concentrate delegated units' action capacity into one coordinated operation.", constraint: "Participating units surrender their next independent action.", counters: ["Interrupt coordination", "Deny the route", "Exploit recovery"] },
      ultimate: { name: "Everything Arrives Here", status: "spec", mechanism: "Commit available delegated units to one location and resolution time.", constraint: "Other locations lose their support." ,
        play: { type: "nova", centre: "playerTarget", radius: 1, potency: 18, channel: "citrinitas",
        text: "Everything converges on the player's current target: an 18-potency burst in radius 1 around it. Napoleon makes no other action that turn." } },
      identity: "Convergence wins locally by accepting exposure elsewhere." },

    kobe: { name: "Kobe", trueForm: { sprite: "kobe-true-form", name: "Kobe · True Form", provisional: true,
      maxLFMul: 1.2, potencyMul: 1.2, pfRegenAdd: 0, revealEffect: { kind: "fullCourtPress" },
      traits: [
        { id: "fullCourtPress", name: "Full Court Press", text: "On reveal, every living ally gets one free relocation to any open tile." },
        { id: "sameShotAgain", name: "Ten Thousand Makes", text: "The work shows: +20% maximum LF and +20% technique potency, and Fadeaway hits harder each time it lands on the same target." } ],
      technique: { id: "fadeaway", name: "Fadeaway", kind: "streak", cooldown: 1, range: 4, potency: 7, perStreak: 3, maxStreak: 3, channel: "albedo",
        text: "Shoots over one enemy within 4, every turn: 7 base piercing damage, +3 for each turn in a row it has taken the same target, up to +9. Changing target starts the count again." },
      text: "Dream Space reveals Kobe in rhythm: a Full Court Press for the whole side, then the same shot on the same opponent until it falls." }, source: "The Council; fictional game adaptation", attitude: "relentless", room: "council-kobe", realPerson: true, pact: { call: { pf: 5, seeds: 45 }, duration: 3 },
      standIn: { primary: "resonance", secondary: "adaptation" },
      proposed: { primary: "Accumulation", secondary: "Feedback", reserve: "Commitment", personal: null },
      signature: { name: "Again, Until It Answers", status: "spec", mechanism: "Failed but valid attempts earn bounded refinement against the same obstacle.", constraint: "Changing objectives discards refinement; duplicate attempts cannot farm stacks.", counters: ["Change the obstacle", "Force a target switch", "Punish predictability"] },
      ultimate: { name: "One More Possession", status: "spec", mechanism: "Commit accumulated refinement to one announced objective.", constraint: "No retargeting, reserve swap, or retreat until the sequence ends." ,
        play: { type: "buff", radius: 0, status: { id: "onePossession", damageMul: 1.5, lockTarget: true, durationAdd: 1, duration: 2 },
        text: "Locks onto one target: +50% damage against it and +1 turn on the field, but no retargeting or retreat until it ends." } },
      identity: "Persistent refinement sharpens power while narrowing choices." },

    aristotle: { name: "Aristotle", trueForm: { sprite: "aristotle-true-form", name: "Aristotle · True Form", provisional: true,
      maxLFMul: 1.15, potencyMul: 1.15, pfRegenAdd: 2,
      passives: { channelDamageMul: { nigredo: 0.85, albedo: 0.85, citrinitas: 0.85, rubedo: 0.85 } },
      traits: [
        { id: "goldenMean", name: "The Golden Mean", text: "Nothing in excess: he takes 15% less damage of every type." },
        { id: "theLyceum", name: "The Lyceum", text: "He teaches while he walks: +15% maximum LF, +15% technique potency and +2 ΦF regeneration per turn." } ],
      technique: { id: "firstPrinciples", name: "First Principles", kind: "syllogism", cooldown: 2, range: 5, stunPoints: 15,
        text: "Names what must be true about one enemy within 5: reveals one of its hidden cards (a trait first) to the player and refutes it, costing it 15 action points. Every other turn." },
      text: "Dream Space reveals Aristotle teaching: the Golden Mean blunts every kind of harm, and First Principles exposes and refutes one enemy at a time." },
      source: "The Council; fictional game adaptation", attitude: "analytical", room: "council-aristotle", realPerson: true, pact: { call: { pf: 4, seeds: 30 }, duration: 3 },
      standIn: { primary: "selectivity", secondary: "sightline" },
      proposed: { primary: "Abstraction", secondary: "Selectivity", reserve: "Analogy", personal: null },
      signature: { name: "Necessary, Not Merely Present", status: "spec", mechanism: "Identify and target an effect's necessary prerequisite instead of its output.", constraint: "Requires an observation action and correct dependency identification.", counters: ["Provide redundant prerequisites", "Conceal dependencies", "Complete independent effects"],
        detail: "Pairs with the math draft's R3 lemma chains: break the load-bearing lemma." },
      ultimate: { name: "Show Me What Must Be True", status: "spec", mechanism: "Publish a dependency model and attempt to break a necessary dependency.", constraint: "An incorrect model wastes the ultimate commitment." ,
        play: { type: "nova", centre: "self", radius: 3, effect: "dispel",
        text: "Shows what must be true: strips every enemy barrier, ward, parry and delayed strike within 3. No damage." } },
      identity: "Precision comes from distinguishing necessity from coincidence." },

    // Goethe hot-build (Muse Berry BD, 2026-10-29): the three Goethe sheets as one Palace
    // Summon — Young Goethe called from the palace, True Form revealed by Dream Space,
    // Ascended Scholar via the MAX channel. Art: goethe-poses shelf (2026-10-27).
    goethe: { name: "Goethe", trueForm: { sprite: "goethe-true-form", name: "Goethe · True Form", provisional: true,
      maxLFMul: 1.2, potencyMul: 1.2, pfRegenAdd: 0,
      traits: [
        { id: "stirbUndWerde", name: "Die and Become", text: "Every failure is material: +20% maximum LF and +20% technique potency." },
        { id: "exactFantasy", name: "Exact Fantasy", text: "He sees what is actually there: The Deed strikes the nearest enemy within 4 and roots it where it stands." } ],
      technique: { id: "theDeed", name: "The Deed", kind: "deed", cooldown: 2, range: 4, potency: 9, rootTurns: 1, channel: "rubedo",
        rootLabel: "Held by the Consequence", rootText: "is held by the consequence: no movement on its next turn.",
        text: "In the beginning was the deed: 9 base LF damage to the nearest enemy within 4, and it is rooted for 1 turn. Every other turn." },
      text: "Dream Space reveals Goethe in the study at midnight: +20% maximum LF, +20% technique potency, and The Deed — one committed act, with consequences." },
      maxForm: { sprite: "goethe-ascended", name: "Goethe · Ascended Scholar MAX",
        maxLFMul: 1.2, potencyMul: 1.25, turnsMul: 2,
        traits: [
          { id: "moreLight", name: "More Light", text: "The dream becomes the work: twice the turns on the field, and the form outlives the dream, returning to the palace when its turns end." },
          { id: "theDeedEternal", name: "The Deed, Eternal", text: "+20% maximum LF and +25% technique potency. The Deed answers as Ever Striving." } ],
        technique: { id: "everStriving", name: "Ever Striving", kind: "deed", cooldown: 2, range: 5, potency: 14, rootTurns: 1, channel: "rubedo",
          rootLabel: "Held by the Consequence", rootText: "is held by the consequence: no movement on its next turn.",
          text: "Whoever strives with all his might: 14 base LF damage to the nearest enemy within 5, rooted for 1 turn. Every other turn." },
        ultimate: { name: "The Deed, Eternal", status: "spec", mechanism: "Burn one night of the dream into a single eternal act.",
          constraint: "Goethe makes no other action that turn.",
          play: { type: "nova", centre: "playerTarget", radius: 2, potency: 24, channel: "rubedo",
          text: "The night's work converges on the player's current target: a 24-potency burst in radius 2 around it. Goethe makes no other action that turn." } },
        text: "The dream pours into Goethe and he rises as the Ascended Scholar: twice the turns, Ever Striving, and a form that outlives the dream." },
      source: "The Council; fictional game adaptation", attitude: "analytical", room: "council-goethe", pact: { call: { pf: 4, seeds: 35 }, duration: 3 }, realPerson: true,
      standIn: { primary: "imagination", secondary: "sightline" },
      proposed: { primary: "Becoming", secondary: "Striving", reserve: "Metamorphosis", personal: null },
      signature: { name: "Die and Become", status: "spec", mechanism: "Convert a spent or failed effort into bounded growth toward the next attempt.", constraint: "The growth only applies to a different approach than the one that failed.", counters: ["Force repetition of the failed approach", "Deny the next attempt", "Punish the transition"] },
      ultimate: { name: "Walpurgis Night", status: "spec", mechanism: "Burn one night of striving into a single announced act.", constraint: "Goethe makes no other action that turn." ,
        play: { type: "nova", centre: "playerTarget", radius: 2, potency: 14, channel: "rubedo",
        text: "The night burns around the player's current target: a 14-potency burst in radius 2 around it. Allies are never hit. Goethe makes no other action that turn." } },
      identity: "Striving itself is the redemption; only the deed counts." },

    genghis_khan: { name: "Genghis Khan", trueForm: { sprite: "genghis-khan-true-form", name: "Genghis Khan · True Form", provisional: true,
      maxLFMul: 1.25, potencyMul: 1.15, pfRegenAdd: 0, revealEffect: { kind: "arrows", potency: 14 },
      traits: [
        { id: "rainOfArrows", name: "Rain of Arrows", text: "On reveal, 14 base damage to every enemy on the field." },
        { id: "theOpenSteppe", name: "The Open Steppe", text: "He fights where the enemy is thin: +25% maximum LF and +15% technique potency, and The Unoccupied Route hits a lone enemy harder." } ],
      technique: { id: "unoccupiedRoute", name: "The Unoccupied Route", kind: "isolate", cooldown: 2, range: 6, radius: 2, potency: 9, aloneBonus: 5, channel: "nigredo",
        text: "Rides down the most isolated enemy within 6 (the one with the fewest of its own side within 2): 9 base impact damage, +5 if it stands entirely alone. Every other turn." },
      text: "Dream Space reveals the Khan at the head of the horde: arrows for everyone, then the rider goes for whoever stands apart." },
      // MAX (Mala, 2026-11-09, R-20261109-14 hot build; MX2): "a large two tile sprite". Distributed mobility: a winged
      // rhino two tiles wide (east of him, else west; no room = the channel is refused, nothing spent), the shared Flight rule.
      maxForm: { sprite: "max-khan", name: "Genghis Khan · Winged Horizon MAX",
        maxLFMul: 1.2, potencyMul: 1.25, turnsMul: 2, size: { w: 2, h: 1 }, flies: true, revealEffect: { kind: "arrows", potency: 20 },
        traits: [
          { id: "wingedHorizon", name: "Winged Horizon", text: "The dream becomes the sky: twice the turns on the field, and the form outlives the dream, returning to the palace when its turns end. He rides a winged rhino two tiles wide, so he rises only where the tile east or west of him is open. He flies: +3 move, half the AP per step, and every step costs one move whatever the ground." },
          { id: "heavierRain", name: "Heavier Rain", text: "+20% maximum LF and +25% technique potency. On rising, 20 base damage to every enemy on the field." } ],
        technique: { id: "theCharge", name: "The Charge", kind: "isolate", cooldown: 2, range: 8, radius: 2, potency: 12, aloneBonus: 6, knock: 1, channel: "nigredo",
          text: "Charges the most isolated enemy within 8 of his body (the one with the fewest of its own side within 2): 12 base impact damage, +6 if it stands entirely alone, and a knock back of 1 tile unless it holds its ground. Every other turn." },
        ultimate: { name: "You Defended the Wrong Horizon", status: "spec", mechanism: "The approach nobody guarded: lion-fire down one open line.",
          constraint: "The line is announced when ordered; it runs toward the player's target, so enemies can step off it.",
          play: { type: "nova", shape: "line", length: 6, centre: "playerTarget", potency: 22, channel: "rubedo",
          text: "Lion-fire down a line of 6 tiles straight out from his body toward the player's current target (along the longer axis; east with no target): 22 base LF damage to every hostile on it." } },
        text: "The dream pours into the Khan and the rhino spreads its wings: twice the turns, a heavier rain of arrows, The Charge, and a line of lion-fire nobody defended." },
      source: "The Council; fictional game adaptation", attitude: "roaming", room: "council-genghis", pact: { call: { pf: 6, seeds: 50 }, duration: 3 }, realPerson: true,
      standIn: { primary: "pathway", secondary: "elasticity" },
      proposed: { primary: "Connectivity", secondary: "Momentum", reserve: "Dispersion", personal: null },
      signature: { name: "The Unoccupied Route", status: "spec", mechanism: "Use connected, unoccupied space to expand delegated deployment routes.", constraint: "Benefits diminish as forces concentrate together.", counters: ["Close routes", "Compress the arena", "Force a narrow confrontation"] },
      ultimate: { name: "You Defended the Wrong Horizon", status: "spec", mechanism: "Announce possible approach routes, privately commit actual routes, and resolve through those remaining open.", constraint: "Cannot invent or change committed routes after defensive responses." ,
        play: { type: "buff", radius: 3, status: { id: "openHorizon", moveAdd: 2, routeBudgetAdd: 2, duration: 2 },
        text: "Allies within 3 get +2 move and +2 routed-delivery reach for 2 turns." } },
      identity: "Distributed mobility makes comprehensive defense expensive." },

    zherm: { name: "Zherm, the Fungal Warrior", trueForm: { sprite: "zherm-true-form", name: "Zherm · True Form", provisional: true,
      maxLFMul: 1.25, potencyMul: 1.3, pfRegenAdd: 0,
      // Rage: resistance to every damage type but one. Citrinitas (propagation) is the gap: what spreads through a colony reaches all of it.
      passives: { channelDamageMul: { nigredo: 0.5, albedo: 0.5, rubedo: 0.5 } }, rageWeakness: "citrinitas",
      traits: [
        { id: "fungalRage", name: "Fungal Rage", text: "He rages for as long as the true form lasts: +30% technique potency, and half damage from impact, piercing and resonance. Propagation damage (Citrinitas) gets through in full." },
        { id: "colonyBody", name: "Colony Body", text: "+25% maximum LF." } ],
      technique: { id: "sporefall", name: "Sporefall", kind: "sporefall", cooldown: 1, range: 3, heal: 6, maxOnField: 3, rounds: 6,
        text: "Drops a mushroom on an open tile beside the most-hurt ally within 3 (or beside himself). A damaged unit that steps onto it eats it and recovers 6 LF; an unhurt one leaves it. Anyone can eat one, enemies included. Up to 3 on the field; each lasts 6 rounds. Every turn." },
      text: "Dream Space reveals Zherm in bloom: he rages (+30% potency, half damage from all but propagation) and seeds the ground with healing mushrooms." },
      source: "Fungal-themed D&D Barbarian build", attitude: "spreading", room: "fungal-grotto",
      pact: { call: { pf: 5, seeds: 40 }, duration: 4 },
      standIn: { primary: "diffusion", secondary: "resonance" },
      proposed: { primary: "Contagion", secondary: "Symbiosis", reserve: "Resilience", personal: null },
      signature: { name: "The Body Is a Colony", status: "spec", mechanism: "Distribute resources and bounded recovery capacity across vulnerable fungal nodes.", constraint: "Nodes require resource investment and valid exchange routes.", counters: ["Isolate nodes", "Destroy nodes", "Outpace resource return"] },
      ultimate: { name: "Nothing Here Is Only Me", status: "spec", mechanism: "Activate surviving nodes as one distributed organism.", constraint: "The entire active network becomes visible and targetable." ,
        play: { type: "nova", centre: "self", radius: 2, potency: 12, channel: "rubedo", allyHeal: 10,
        text: "The colony wakes: a 12-potency spore burst on hostiles within 2, and allies inside it heal 10 LF." } },
      identity: "Distributed survival exchanges concentrated strength for network dependence." },

    // Gaia (Mala, 2026-10-26: "capture ritual for Gaia and her world form is her Max form"). Not a level unlock: a capture
    // ritual on the weakened Wounded Ground (engine/conditions.js ritualTick) unlocks her for later battles. She comes as the
    // Living Accord; the Dream Space reveals her true form (the Wounded Ground, on your side), and the MAX channel (as
    // Napoleon's: an open dream plus a full ultimate bar) raises her into the World Goddess for the rest of her stay.
    gaia: { name: "Gaia, the Living Accord", capturedOnly: true, sprite: "gaia-accord",
      trueForm: { sprite: "gaia-wounded", name: "Gaia · the Wounded Ground", provisional: true,
        maxLFMul: 1.3, potencyMul: 1.2, pfRegenAdd: 0,
        traits: [
          { id: "groundRemembers", name: "The Ground Remembers", text: "The wounds she carries are hers to use: +30% maximum LF and +20% technique potency." },
          { id: "earthenEmbraceTrait", name: "Earthen Embrace", text: "The ground closes on the densest knot of her enemies, every other turn." } ],
        technique: { id: "earthenEmbrace", name: "Earthen Embrace", kind: "battery", cooldown: 2, range: 4, radius: 1, potency: 12, channel: "nigredo",
          text: "The ground closes around the densest enemy cluster within 4: 12 base LF damage to every hostile within 1 of the aim point. Allies are never hit. Every other turn." },
        text: "Dream Space shows what Gaia is when the land is hurt: the Wounded Ground, on your side this time. +30% maximum LF, +20% potency, and Earthen Embrace." },
      maxForm: { sprite: "world-goddess", name: "Gaia · World Goddess MAX",
        maxLFMul: 1.25, potencyMul: 1.25, turnsMul: 2,
        traits: [
          { id: "gaiaStoodUp", name: "Gaia Stood Up", text: "The dream becomes the ground: twice the turns on the field, and the form outlives the dream, returning to the palace when its turns end." },
          { id: "theEarthSpeaksTrait", name: "The Earth Speaks", text: "+25% maximum LF and +25% technique potency. Earthen Embrace answers as The Earth Speaks." } ],
        technique: { id: "theEarthSpeaks", name: "The Earth Speaks", kind: "battery", cooldown: 2, range: 5, radius: 2, potency: 16, channel: "nigredo",
          text: "The ground says their names: 16 base LF damage to every hostile within 2 of the densest enemy cluster within 5. Allies are never hit. Every other turn." },
        ultimate: { name: "Tectonic", status: "spec", mechanism: "The whole ground answers at one point.", constraint: "Gaia makes no other action that turn.",
          play: { type: "nova", centre: "playerTarget", radius: 2, potency: 24, channel: "nigredo",
          text: "The ground rises under the player's current target: a 24-potency quake in radius 2 around it. Gaia makes no other action that turn." } },
        text: "The dream pours into Gaia and she stands up as the World Goddess: twice the turns, The Earth Speaks, and a form that outlives the dream." },
      source: "Boss of the wild types (bosses/boss-data.js), captured", attitude: "protective", room: "living-accord", pact: { call: { pf: 6, seeds: 60 }, duration: 4 }   /* provisional: Gaia wants her own ruling (Mala 2026-10-31) */,
      standIn: { primary: "succession", secondary: "berm" },
      proposed: { primary: "Succession", secondary: "Berm", reserve: "Swale", personal: null },
      signature: { name: "Keep the Conditions", status: "spec", mechanism: "Support scales with the land's condition.", constraint: "Wounded ground weakens the accord.", counters: ["Wound the land", "Break the living route"] },
      ultimate: { name: "Reconnect", status: "spec", mechanism: "Root seams bridge the fractures around her.", constraint: "Only near her.",
        play: { type: "nova", centre: "self", radius: 2, potency: 10, channel: "nigredo", allyHeal: 12,
        text: "Roots reconnect around Gaia: a 10-potency upheaval on hostiles within 2, and allies inside heal 12 LF." } },
      identity: "Reciprocal cooperation: powerful support governed by ecological conditions." },

    little_king: { name: "The Little King", trueForm: { sprite: "little-king-true-form", name: "The Little King · True Form", provisional: true,
      maxLFMul: 1.2, potencyMul: 1.15, pfRegenAdd: 0,
      passives: { hazardImmune: true },
      traits: [
        { id: "kingOfTheHeap", name: "King of the Heap", text: "His own court is a rubbish tip: he ignores every terrain-entry hazard, trash included." },
        { id: "pettyMajesty", name: "Petty Majesty", text: "+20% maximum LF and +15% technique potency." } ],
      // TODO (Mala, 2026-10-10): expand the trash mechanic. See docs/true-form-mechanics.md, "Trash: to expand".
      technique: { id: "royalRefuse", name: "Royal Refuse", kind: "trash", cooldown: 2, range: 4, potency: 9, channel: "nigredo", hazard: 3, spread: 1, rounds: 3,
        text: "Hurls trash at one enemy within 4: 9 base LF impact damage, and the target's tile and the open tiles beside it become Trash for 3 rounds (3 LF to anyone who enters, either side). Every other turn." },
      text: "Dream Space reveals the Little King on his heap: +20% maximum LF, +15% technique potency, immunity to hazards, and Royal Refuse." },
      source: "Glamour Bard/Warlock build; disguise and command theme", attitude: "deceptive", room: "masquerade-stage", pact: { call: { pf: 5, seeds: 45 }, duration: 3 },
      standIn: { primary: "deception", secondary: "selectivity" },
      proposed: { primary: "Signal", secondary: "Camouflage", reserve: "Hierarchy", personal: null },
      signature: { name: "You Already Recognized Me", status: "spec", mechanism: "An accepted disguised signal establishes a temporary channel for one restricted command.", constraint: "Maintain the disguise; commands cannot exceed declared channel permissions.", counters: ["Authenticate the source", "Reject reception", "Expose a contradiction"] },
      ultimate: { name: "All Rise for the Wrong King", status: "spec", mechanism: "Broadcast an identity claim through established channels; eligible recipients verify or accept a narrowly defined command.", constraint: "Provide a defensive verification window before command resolution." ,
        play: { type: "nova", centre: "self", radius: 3, effect: "stun", stunPoints: 15, guardResists: true,
        text: "All rise: enemies within 3 lose 15 action points. Guarding during the response window (verifying the claim) resists it." } },
      identity: "Borrowed authority depends on recognition and can be revoked." },
  };

  // Mala's implementation notes, verbatim intent.
  const implementation = {
    exclusivity: "NPC traits grant access to signature compositions.",
    mechanics: "Use shared operators, explicit prerequisites, and bounded effects.",
    counterplay: "Every signature must expose an understandable price and counter.",
    personal_concepts: "Implement as operator compositions, not arbitrary matchup overrides.",
    ultimate_announcements: "Reveal target or area and timing before accepting defensive responses.",
  };

  return { rules, attitudes, summons, implementation, ultimateTypes };
});
