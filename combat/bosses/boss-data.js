"use strict";
// Boss monsters (Mala, 2026-10-08): an insect-like Kaiju, an Oni, a traditional Dragon, and Gaia.
// The first three are large (2×2) with far more health and damage; at 25% health every boss becomes
// ENRAGED: tougher, and with new abilities unlocked. Gaia starts normal-sized and grows large when enraged.
// Defeating a boss gives its ORB: a one-time transformation into a humanoid version of the boss.
//
// Bosses fight with EXISTING concepts, so the relationship graph already explains them (graph-first).
// Names, concept pairings and abilities are Claude's proposals around Mala's brief; sprites come from Mala.
// All numbers PROVISIONAL.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatBossData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const rules = {
    side: "wild",                       // bosses hunt everyone (a Boss encounter is won by defeating the boss)
    massive: { immuneToDisplacement: true, chargeCollision: 10 },   // too big to shove; an Unstoppable charge stops dead and both take 10
    xp: 150, seeds: 80,
  };

  // The ENRAGED condition: one-time, triggered at 25% LF.
  const conditions = {
    enraged: { name: "Enraged", trigger: { lfBelow: 0.25 }, once: true,
      mods: { damageTakenMul: 0.7, potencyMul: 1.15, apPerTurnAdd: 15, statusImmune: ["fear", "taunt", "stun", "standDown", "truce"] },
      text: "At a quarter of its health it becomes enraged: it takes 30% less damage, hits harder, acts more, shrugs off fear and taunts, and unlocks new abilities." },
  };

  // omega: true puts a boss on the boss rush list (docs/boss-rush.md, modes/boss-rush.js).
  // Boss ability: same schema as content.js, plus price/counter/teaches.
  const A = (o) => ({ tier: "boss", target: "enemy", area: { shape: "single" }, range: 1, ...o });

  const bosses = {
    kaiju: {
      name: "Insect Kaiju", kind: "kaiju", omega: true, size: { w: 2, h: 2 }, lf: 360, concepts: ["elasticity", "resonance", "diffusion"],
      look: "Mala's design: an insect-like kaiju (large sprite).",
      teaches: "Scale changes everything: what is a nuisance at one size is a catastrophe at another.",
      abilities: {
        carapaceSlam: A({ name: "Carapace Slam", delivery: "field", area: { shape: "radius", radius: 1 }, potency: 22, channel: "nigredo", knockback: 2, cost: 0,
          mechanism: "The armoured body crashes down on everything beside it and throws it back two tiles.", counter: "Don't stand adjacent; Anchor resists the throw." }),
        wingDrone: A({ name: "Wing Drone", delivery: "field", area: { shape: "radius", radius: 3 }, potency: 14, channel: "rubedo", cost: 0, effect: "damage+timing",
          mechanism: "The wings beat at a single frequency: everyone within 3 is shaken off their timing, and walls ring and crack (resonance edges apply).", counter: "Inertia damps it; adapt to Rubedo." }),
        broodSpray: A({ name: "Brood Spray", delivery: "field", area: { shape: "cone", length: 3 }, potency: 12, channel: "citrinitas", cost: 0, effect: "damage+hazard",
          mechanism: "A spray of larvae in a cone; struck tiles become a crawling hazard for 2 turns.", counter: "Stay out of the cone's facing; burn or flood the hazard." }),
      },
      enragedUnlocks: {
        molt: A({ name: "Molt", delivery: "self", target: "self", potency: 0, effect: "heal+speed", cost: 0,
          mechanism: "It splits its carapace and steps out: heals 40 and moves 2 farther each turn, but loses its armour (the enraged damage reduction drops to ×0.85).", counter: "Burst it down while it's soft." }),
        swarmBreach: A({ name: "Swarm Breach", delivery: "field", area: { shape: "line", length: 6 }, potency: 26, channel: "citrinitas", cost: 0,
          mechanism: "The swarm pours through a 6-tile line; it's a field, so walls don't stop it (Diffusion passes over).", counter: "Get off the line; fields ignore walls but not distance." }),
      },
      orb: "orbOfTheKaiju",
    },

    oni: {
      name: "Oni", kind: "oni", omega: true, size: { w: 2, h: 2 }, lf: 330, concepts: ["deception", "threshold", "selectivity"],
      look: "Mala's design: a red oni (large sprite).",
      teaches: "A spirit of a place is known by its rules; learn the rule and it loses its power over you.",
      abilities: {
        foxfireLure: A({ name: "Foxfire Lure", delivery: "line", range: 6, potency: 12, channel: "albedo", cost: 0, effect: "damage+falseTell",
          mechanism: "Lights that seem to be somewhere else: every attack it makes is a Deception tell (a false range is always possible).", counter: "Sightline or Focus reveals the true envelope; calibrate." }),
        curseMark: A({ name: "Curse Mark", delivery: "routed", routeBudget: 8, potency: 20, channel: "albedo", cost: 0, timing: "conditional", trigger: "targetBelowHalfLF",
          mechanism: "A mark that fires when you fall below half health (a Tipping Point the size of a spirit).", counter: "Stay above half; Membrane filters the mark; Resonance trips it early." }),
        shapeShift: A({ name: "Shape Shift", delivery: "self", target: "self", potency: 0, cost: 0, effect: "swap",
          mechanism: "It trades places with any unit within 5, friend or foe.", counter: "Spread out; a swap into a hazard hurts it too." }),
      },
      enragedUnlocks: {
        hundredNightParade: A({ name: "Hundred Night Parade", delivery: "field", target: "self", potency: 0, cost: 0, effect: "illusions",
          mechanism: "Three illusions identical to it appear. Attacks on an illusion dispel it and do nothing; Observe tells the real one (an honest look sees it).", counter: "Observe before you strike; Section Cut through them shows which casts a shadow." }),
        spiritVeil: A({ name: "Spirit Veil", delivery: "self", target: "self", potency: 0, cost: 0, effect: "lineImmune", duration: 1,
          mechanism: "For one turn line deliveries pass through it.", counter: "Use routed or field deliveries for that turn." }),
      },
      orb: "orbOfTheOni",
    },

    dragon: {
      name: "Dragon", kind: "dragon", omega: true, size: { w: 2, h: 2 }, lf: 400, concepts: ["boundary", "diffusion", "resonance"],
      look: "Mala's design: a traditional dragon (large sprite).",
      teaches: "Territory is defended at its edge: understand the boundary and you understand the dragon.",
      abilities: {
        fireBreath: A({ name: "Fire Breath", delivery: "field", area: { shape: "cone", length: 5 }, potency: 24, channel: "citrinitas", cost: 0, effect: "damage+ignite",
          mechanism: "A cone of fire 5 tiles long; every fuel tile it touches starts a Brushfire.", counter: "Stand on paving, water or rubble; a Watering can or Check Dam stops the spread." }),
        tailSweep: A({ name: "Tail Sweep", delivery: "field", area: { shape: "radius", radius: 2 }, potency: 18, channel: "nigredo", knockback: 1, cost: 0,
          mechanism: "The tail clears everything within 2 and throws it outward.", counter: "Anchor; keep out of range 2." }),
        hoardWard: A({ name: "Hoard Ward", delivery: "field", target: "self", area: { shape: "radius", radius: 3 }, potency: 0, cost: 0, effect: "territory", duration: 3,
          mechanism: "Everything within 3 becomes its territory for 3 turns: inside it, the dragon takes 25% less damage.", counter: "Lure it out of its territory; Borrowed or clipped structures still work inside." }),
      },
      enragedUnlocks: {
        stormWings: A({ name: "Storm Wings", delivery: "self", target: "self", potency: 0, cost: 0, effect: "hover",
          mechanism: "It takes to the air: hovering, it ignores terrain, can't be reached by contact, and dives on anyone up to 6 away for 20.", counter: "Lines and fields still reach it; Plan View doesn't ground it." }),
        inferno: A({ name: "Inferno", delivery: "field", area: { shape: "radius", radius: 4 }, potency: 28, channel: "citrinitas", cost: 0, effect: "damage+igniteAll", announce: "Everything burns.",
          mechanism: "Announced: everything within 4 takes fire and every fuel tile on the map ignites.", counter: "Use the response window to reach water or paving; Rain Garden stops fire at its edge." }),
      },
      orb: "orbOfTheDragon",
    },

    // Gaia (Mala, 2026-10-08, second brief): "Boss of the wild types; conditional ally." Both forms are the same
    // being, distinguished by the LANDSCAPE'S CONDITION, not by her health. Rules: gaia.js.
    gaia: {
      name: "Gaia", kind: "gaia", omega: true, role: "Boss of the wild types; conditional ally",
      size: { w: 2, h: 2 }, lf: 340, concepts: ["succession", "berm", "swale"],
      look: "A branching crown shaped like a watershed; dark earth skin with luminous root seams; a hollow in her chest holding a miniature living landscape. One silhouette, readable at small scale.",
      teaches: "The land answers what is done to it: tend it and it heals, wound it and it rises.",
      // Mala, 2026-10-14: she STARTS as the Living Accord and becomes the Wounded Ground when enraged, either by the
      // ENRAGED condition (LF 25%) or by the land taking more wounds after she arrives (engine/land.js).
      startForm: "restored",
      formKits: { restored: ["earthenEmbrace", "verdance"], disturbed: ["earthenEmbrace", "verdance", "reclamation"] },
      forms: {
        disturbed: { name: "Gaia, the Wounded Ground", side: "wild", size: { w: 2, h: 2 }, hostile: true,
          state: "Manifests during ecological damage.",
          appearance: "Towering, assembled from fractured soil, exposed roots, broken stone and uprooted vegetation. Uneven crown with snapped branches and hanging sediment; the landscape in her chest has severed waterways and isolated green.",
          face: "Calm and severe; eyes like exposed amber under dark soil. She watches the source of disturbance, not everyone.",
          movement: "Heavy steps buckle damaged ground; roots pull her forward; loose stones rise and settle around her.",
          palette: "Charcoal, umber, rust, pale root ivory, sparse amber.",
          summoning: "Wild types emerge from surviving habitat around her (moving roots, gathering spores, animal silhouettes under the terrain).",
          tells: { defend: "A root seam brightens toward the tile she means to defend.", major: "Her crown contracts the turn before a major intervention." },
          personality: "Implacable protection of threatened ecological function.",
          line: "You have broken more than the surface." },
        restored: { name: "Gaia, the Living Accord", side: "ally", size: { w: 1, h: 1 }, hostile: false,
          state: "Conditional alliance after observation, understanding and functional restoration.",
          appearance: "The same earth-and-root body, visibly connected: root seams bridge her fractures without erasing them; fresh growth beside old deadwood in her crown; the chest landscape's waterways reconnect; moss, grasses and small sheltering creatures on her shoulders.",
          face: "Attentive and composed; eyes soften to pale gold, with the same authority.",
          movement: "Deliberate steps settle the ground; vegetation parts around her and returns after she passes; small creatures travel with her.",
          palette: "Deep earth brown, moss green, muted gold, water blue, root ivory.",
          summoning: "Wild types arrive through intact habitat routes. She opens space for them rather than commanding them.",
          tells: { support: "Connected root seams light up before a support action.", restoring: "Her chest landscape brightens along the function she is restoring." },
          personality: "Reciprocal cooperation: powerful support governed by ecological conditions.",
          line: "Keep the conditions, and we keep the accord." },
      },
      transition: {
        trigger: "Restore the threatened function and satisfy the encounter's understanding objective.",
        animation: ["roots reconnect", "water follows", "new growth appears"],   // in this order; existing scars stay visible
        reversal: "Renewed violations can dissolve the alliance. The endangered condition is telegraphed first.",
      },
      abilities: {   // Wounded Ground
        verdance: A({ name: "Verdance", delivery: "field", target: "self", area: { shape: "radius", radius: 3 }, potency: 0, cost: 0, effect: "grow",
          mechanism: "Every soil tile within 3 advances a Succession stage; she and any wild creature there heal 8.", counter: "Pruning or Cut-and-fill resets her patches; Collage transplants them." }),
        earthenEmbrace: A({ name: "Earthen Embrace", delivery: "placed", range: 4, potency: 16, channel: "nigredo", cost: 0, effect: "damage+bermRing",
          mechanism: "The ground closes around a target: damage, and berms rise on the tiles beside them (an Earthen Room with no gap) for 1 turn.", counter: "Field deliveries pass over the berms; wait one turn." }),
        springRise: A({ name: "Spring Rise", delivery: "placed", range: 5, potency: 0, cost: 0, effect: "flood",
          mechanism: "Water rises from the ground: a Flash Flood starts on the tile and runs downhill.", counter: "Swales, mulch and high ground." }),
      },
      enragedUnlocks: {
        tectonic: A({ name: "Tectonic", delivery: "field", area: { shape: "arena" }, potency: 22, channel: "nigredo", cost: 0, effect: "quake", announce: "The ground remembers.",
          mechanism: "Announced: her crown contracts, every cliff on the map takes enough damage to slide, and everyone takes 22 unless standing on a structure.", counter: "Stand on a berm, wall top or bridge in the response window; Plan View suspends the rockslides." }),
        reclamation: A({ name: "Reclamation", delivery: "field", area: { shape: "radius", radius: 4 }, potency: 10, channel: "rubedo", cost: 0, effect: "entangleAll",
          mechanism: "Everything cleared, burnt or broken within 4 is reclaimed at once: rubble and stumps become creeper, and everyone in it is entangled.", counter: "Shade (canopy) and established Succession resist it." }),
      },
      // Living Accord support actions. Potency scales with the land's condition (gaia.js supportMul).
      supportAbilities: {
        reconnect: A({ name: "Reconnect", delivery: "routed", routeBudget: 6, potency: 0, cost: 0, effect: "heal", heal: 14,
          mechanism: "Through connected living terrain, heal one ally 14 and clear one negative status.", counter: "Break the living route." }),
        openHabitat: A({ name: "Open Habitat", delivery: "field", target: "self", potency: 0, cost: 0, effect: "summonAlly",
          mechanism: "Open space along an intact habitat route: one wild type arrives at its far end, on your side, for 3 turns.", counter: "No intact route, no arrival." }),
        settleGround: A({ name: "Settle the Ground", delivery: "field", target: "self", area: { shape: "radius", radius: 2 }, potency: 0, cost: 0, effect: "stabilize",
          mechanism: "Within 2: hazards cleared, cliffs stop sliding for 2 rounds, rubble becomes soil.", counter: "It only settles near her." }),
        holdWater: A({ name: "Hold Water", delivery: "placed", range: 5, potency: 0, cost: 0, effect: "rainGarden",
          mechanism: "A rain garden forms on a soil tile: wet ground, and it fills at once.", counter: "Paving can't hold water." }),
      },
      orb: "orbOfGaia",
    },

    emissary: {
      name: "The Emissary", kind: "emissary", omega: true, size: { w: 1, h: 1 }, lf: 340, concepts: ["deception", "threshold", "software"],
      look: "Mala's design: a faceless white figure with a void orb.",
      teaches: "Some faces are load-bearing: look away or break.",
      abilities: {
        // The visage is biology now (the visage trait): foes that end their turn within 2 meet its gaze for free.
        // The enraged button stays: Unbearable Visage, radius 5, on the boss's own turn.
        voidOrb: A({ name: "Void Orb", delivery: "line", range: 5, potency: 14, channel: "nigredo", cost: 0,
          mechanism: "A thrown piece of nothing: straight-line damage.", counter: "Don't stand in line." }),
        emptyMandate: A({ name: "Empty Mandate", delivery: "routed", routeBudget: 6, potency: 16, channel: "albedo", cost: 0,
          mechanism: "An order with no author travels any route: routed damage that arrives blameless.", counter: "Break the route; routed paths need open tiles." }),
      },
      enragedUnlocks: {
        unbearableVisage: A({ name: "Unbearable Visage", delivery: "field", area: { shape: "radius", radius: 5 }, potency: 0, cost: 0, effect: "visage",
          mechanism: "The face again, wider: radius 5.", counter: "Be somewhere else." }),
        faceOfTheVoid: A({ name: "Face of the Void", delivery: "field", area: { shape: "radius", radius: 2 }, potency: 18, channel: "nigredo", cost: 0,
          mechanism: "The orb opens: raw nothing in radius 2.", counter: "Enraged only — end it before 25%." }),
      },
      orb: "orbOfTheEmissary",
    },

    // Sealed (the Secret Warrior, chosen by the agents' room 2026-10-18): it appears only in its own battle mode, never in
    // the Boss Rush (no omega), the registry export or the asset library, until Mala has faced it. Rules: engine/tally.js.
    // Every loan, interest charge and seizure rides the game's existing tempo debt (rules.maxTempoDebt).
    tallyman: {
      name: "The Tallyman", kind: "tallyman", omega: true, size: { w: 1, h: 1 }, lf: 320, concepts: ["reciprocal_obligation", "extraction", "leverage", "credit"],   // credit last: his exclusive (Mala, 2026-10-20); a boss's first two concepts are its playable primary/secondary
      look: "A lean, smiling clerk in a long coat sewn from ledger pages; a split hazel tally stick for a staff.",
      teaches: "Credit is time borrowed from your future self, and the lender decides when it falls due.",
      abilities: {
        shortCount: A({ name: "Short Count", delivery: "line", range: 5, potency: 10, channel: "citrinitas", cost: 0, tempoCost: 30,
          mechanism: "A tap of the tally stick and a coin pressed into your hand: light damage, and a forced micro-loan (8 AP on your next turn, 10 AP owed the turn after).",
          counter: "The loan is small; it only bites if you let it stack. Stay out of his line." }),
        theOffer: A({ name: "The Offer", delivery: "self", target: "self", potency: 0, cost: 0, tempoCost: 20, effect: "offer",
          mechanism: "He extends terms to every foe within 5: 25 AP on your next turn, 30 AP owed the turn after. Declining is free; ignoring it is declining.",
          counter: "Decline. Or accept, spend it on something decisive, and be ready to pay." }),
        tallyUp: A({ name: "Tally Up", delivery: "line", range: 5, potency: 12, channel: "rubedo", cost: 0, tempoCost: 35,
          mechanism: "He reads your account aloud: damage plus 3 for every 10 AP you owe him (debt and loans not yet due), at most +30.",
          counter: "Come into his line owing nothing." }),
        marginCall: A({ name: "The Margin Call", delivery: "self", target: "self", potency: 0, cost: 0, tempoCost: 40, effect: "marginCall",
          announce: "All accounts... due.",
          mechanism: "Every loan falls due at once, a 15 AP fee lands on every account still open, and each debtor takes damage by what they owe (8 plus a quarter of it, at most 40). The debt-free are untouched.",
          counter: "It is announced: settle up before it lands. Owe nothing and it does nothing." }),
      },
      enragedUnlocks: {
        foreclosure: A({ name: "Foreclosure", delivery: "line", range: 4, potency: 22, channel: "nigredo", cost: 0, tempoCost: 40,
          mechanism: "He comes to collect in person: a heavy line strike, half again as hard against anyone whose technique he holds as collateral.",
          counter: "Get your collateral back first: pay the account under the line." }),
        compoundInterest: A({ name: "Compound Interest", delivery: "self", target: "self", potency: 0, cost: 0, tempoCost: 20, effect: "interest",
          mechanism: "Interest compounds: every open account grows by a tenth (at least 5 AP). Accounts at zero stay at zero.",
          counter: "Owe nothing. Burst him before he enrages." }),
      },
      // The ledger. Numbers PROVISIONAL until the sims (claude/secret-warrior room).
      ledger: {
        offer: { ap: 25, debt: 30, delay: 2, range: 5 },
        shortCount: { ap: 8, debt: 10, delay: 2 },
        tallyUp: { perTen: 3, cap: 30 },
        collateral: { threshold: 40 },          // outstanding at or above this: your highest-cost technique is held
        floor: 25,                              // turn-start collection never leaves a debtor with fewer AP than this
        excessLfPerAp: 0.5,                     // debt past rules.maxTempoDebt is collected from Life Force instead
        marginCall: { fee: 15, base: 8, per: 0.25, cap: 40 },
        interest: { mul: 0.1, min: 5 },
        foreclosure: { collateralMul: 1.5 },
        reserves: { breakAt: 0.3, stun: 50 },   // 30% of his LF lost in one round: the books burn (once), every account voids
        aiAccept: { chance: 0.5 },
      },
      orb: "orbOfTheTallyman",   // revealed 2026-10-20: the Ledger-Sworn form
    },

    // World Goddess: ascended Gaia, when the Heart of the Court breaks. Omega, and not on the Boss Rush
    // (rush: false). She holds that one field. Life and potency below are PROVISIONAL.
    worldGoddess: {
      name: "World Goddess", omega: true, rush: false, size: { w: 1, h: 1 }, lf: 340,
      concepts: ["succession", "berm", "swale"],
      look: "Gaia stood up. The court wears a body, and the body is the ground.",
      teaches: "A place can be finished. Breaking its heart does not end it. It answers.",
      abilities: {
        courtCall: A({ name: "Call", delivery: "field", range: 4, potency: 14, channel: "nigredo", cost: 0, tempoCost: 30, effect: "damage",
          mechanism: "She calls the living ground down on one fighter.",
          counter: "Leave her reach, or break her before the call lands." }),
        courtClose: A({ name: "Close", delivery: "field", range: 1, potency: 16, channel: "nigredo", cost: 0, tempoCost: 30, effect: "damage", area: { shape: "radius", radius: 1 },
          mechanism: "The ground closes in a ring around her. The scar is the place's, and familiarity can keep the dirt whole.",
          counter: "Know the place. A controlled strike leaves the dirt whole. Standing off the ring leaves you whole." }),
        theEarthSpeaks: A({ name: "The Earth Speaks", delivery: "field", range: 4, potency: 22, channel: "nigredo", cost: 0, tempoCost: 45, effect: "damage",
          announce: "The earth speaks.",
          mechanism: "An announced blow in the same band as Gaia's tectonics. The ground says the fighter's name.",
          counter: "It is announced. Step out of her reach, or guard." }),
      },
      enragedUnlocks: {
        floodClose: A({ name: "Flood Close", delivery: "field", range: 3, potency: 12, channel: "albedo", cost: 0, tempoCost: 30, effect: "damage",
          mechanism: "Rain remembers. The close comes as a flood instead of a call.",
          counter: "Get off the wet ground, or end her before the water arrives." }),
        rootCall: A({ name: "Root Call", delivery: "field", range: 3, potency: 10, channel: "nigredo", cost: 0, tempoCost: 30, effect: "damage",
          mechanism: "Roots answer the call and drag a fighter toward the broken heart.",
          counter: "Break the roots' reach. She is still one body." }),
      },
      orb: "orbOfTheWorld",
    },

    // Sealed draft. The picker says Secret Warrior. Payment is spent by sealed-next.js;
    // this sheet's prices are the record. The adapter still writes cost 0.
    sealednext: {
      name: "Secret Warrior", kind: "sealednext", sealed: true, omega: false, size: { w: 1, h: 1 }, lf: 320,
      concepts: ["periodicity", "swale"],
      look: "Sealed until the fight.",
      teaches: "Read the published table. The counter is on the table.",
      abilities: {
        cutLine: A({ name: "Shared Line", tier: "basic", delivery: "field", range: 1, potency: 0, channel: null, cost: 4, effect: "line",
          mechanism: "Lay four tiles of shared ground. While a gate remains, the line joins that region. After every gate is gone, the line is still shared and it adds no water.",
          counter: "Use a line that already exists. A new line is paid for only when no shaped tile is in reach." }),
        pullShare: A({ name: "Region Pull", tier: "basic", delivery: "field", range: 4, potency: 0, channel: null, cost: 4, effect: "pull",
          mechanism: "One region, one part, one payment. It resolves before the rise. Opening that region's gate cancels the part.",
          counter: "Open that region's gate before the rise. The payment is not refunded." }),
        slackWater: A({ name: "Named Hold", delivery: "self", target: "self", potency: 0, channel: null, cost: 6, effect: "hold",
          mechanism: "Name one round. The hold lasts from that round until the next round starts.",
          counter: "The next round is outside the hold." }),
        closeSluice: A({ name: "Gate Again", delivery: "self", target: "self", potency: 0, channel: null, cost: 15, effect: "close",
          mechanism: "Close an opened gate. Twice in the battle. A third close fails and does not spend. Closing does not bring a cancelled share back.",
          counter: "Leave it open, or spend the two closes before you need a third." }),
        kingTide: A({ name: "Close Moon", delivery: "field", range: 0, potency: 0, channel: null, cost: 16, effect: "rise", timing: "announced",
          announce: "The moon is close tonight",
          mechanism: "One payment, one pending id, one part per intact region. The next rise in those regions is one level higher. An opened region loses only its own part.",
          counter: "Open the region you need dry. The other regions still rise. A short pool refuses the whole cast." }),
      },
      enragedUnlocks: {
        lowWater: A({ name: "Low Table", delivery: "self", target: "self", potency: 0, channel: null, cost: 0, effect: "mark",
          mechanism: "The published rounds stay printed. Nothing new is spawned and nothing is healed.",
          counter: "Read the same table. Enrage does not add a round." }),
        longEbb: A({ name: "Long Table", delivery: "self", target: "self", potency: 0, channel: null, cost: 0, effect: "hold",
          mechanism: "The ebb still ends when the next round starts. No second body arrives.",
          counter: "Wait for the next round. The table did not grow an extra ebb." }),
      },
      orb: "orbOfTheSealed",
    },
  };

  // Orbs: one-time transformations into a humanoid version of the boss (Mala). Form lasts 3 of your turns.
  const orbs = {
    // Learned forms (Mala, 2026-10-17; docs/learned-forms.md). Every boss form is now an OVERLAY: you keep your loadout and
    // gain the form's stats, three form traits, its own Strike and three techniques (formOnly abilities in content.js).
    // Numbers follow the spec's scale bands. channelTakenMul is read by bosses.js formDamage.
    orbOfTheKaiju: { name: "Orb of the Kaiju", boss: "kaiju", form: "Chitin Knight", formId: "chitin_knight", overlay: true, sprite: "kaiju-form",
      stats: { maxLFAdd: 50, channelTakenMul: { nigredo: 0.6 } },
      grantedTraits: ["exoskeleton", "broodmind", "molting"],
      strike: { potency: 14, range: 1, damageType: "nigredo", name: "Mandible Crush", rider: { guardCrack: true } },
      techniques: ["leapingStrike", "chitinDrone", "broodBreach"] },
    orbOfTheOni: { name: "Orb of the Oni", boss: "oni", form: "Oni-blooded", formId: "oni_blooded", overlay: true, sprite: "oni-form",
      stats: { maxLFAdd: 30, observeCostMul: 0.5, channelTakenMul: { albedo: 1.25 } },
      grantedTraits: ["spiritSight", "ruleOfTheThreshold", "purified"],
      strike: { potency: 14, range: 1, damageType: "nigredo", name: "Kanabō", rider: { knockback: 1, curseBelowHalf: 12 } },
      techniques: ["kitsuneFoxfire", "maskSwap", "nightParade"] },
    orbOfTheEmissary: { name: "Orb of the Emissary", boss: "emissary", form: "Faceless", formId: "faceless", overlay: true,
      stats: { maxLFAdd: 25, fearDealtMul: 1.5 },
      grantedTraits: ["faceless", "unbearable", "hollow"],
      strike: { potency: 12, range: 1, damageType: "nigredo", name: "Void Touch", rider: { dread: true } },
      techniques: ["voidGlance", "hollowMandate", "voidFace"] },
    orbOfTheDragon: { name: "Orb of the Dragon", boss: "dragon", form: "Dragon-blooded", formId: "dragon_blooded", overlay: true, spriteFor: { warden: "neo-warden-dragon" },
      stats: { maxLFAdd: 40, channelTakenMul: { citrinitas: 0.5 } },
      grantedTraits: ["fireblooded", "territorial", "quenchable"],
      strike: { potency: 12, range: 1, damageType: "nigredo", name: "Rending Claw", rider: { scorch: 3 } },
      techniques: ["emberBreath", "takeWing", "infernoRoar"] },
    // The Tallyman's orb (after his reveal, 2026-10-20): Ledger-Sworn. The ledger itself stays his (engine/tally.js lends
    // only from the boss); the form keeps the creditor's habits through the existing form riders: debt (apLoss), AP taken
    // (apSteal, once a turn on the Strike), charge repossessed (stealUlt).
    orbOfTheTallyman: { name: "Orb of the Tallyman", boss: "tallyman", form: "Ledger-Sworn", formId: "ledger_sworn", overlay: true,
      stats: { maxLFAdd: 30 },
      grantedTraits: ["greedy", "thrifty", "honorable"],
      strike: { potency: 12, range: 2, damageType: "citrinitas", name: "Tally Stick", rider: { apSteal: 8 } },
      techniques: ["shortChange", "repossession", "allAccountsDue"] },
    orbOfTheSealed: { name: "Orb of the Secret Warrior", boss: "sealednext", form: "Appointment-Sworn", formId: "appointment_sworn", overlay: true,
      stats: { maxLFAdd: 30 },
      grantedTraits: ["swimmer", "honorable", "contemplative"],
      strike: { potency: 12, range: 1, damageType: "rubedo", name: "Published Step" },
      techniques: ["sealedNamed", "sealedShare", "sealedStanding"] },
    // Founder Mode (new, 2026-10-17): the Tech Billionaire had no orb. His Adjacency + Dependency as a form.
    orbOfTheFounder: { name: "Founder's Badge", boss: "tech_billionaire", form: "Founder Mode", formId: "founder_mode", overlay: true, spriteFor: { warden: "neo-warden-cyberpunk" },
      stats: { maxLFAdd: 25 },
      grantedTraits: ["platform", "goldenParachute", "burnRate"],
      strike: { potency: 12, range: 1, damageType: "citrinitas", name: "Disrupt", rider: { apSteal: 10 } },
      techniques: ["acquisition", "vendorLock", "hostileTakeover"] },
    // Mala's design (2026-10-08). An OVERLAY form, unlike the three above: you keep your own primary,
    // secondary and reserves, and gain one extra technique (Living Conduit) plus free-to-equip form lenses.
    orbOfGaia: { id: "gaia_orb", name: "Orb of the Living Accord", boss: "gaia", form: "One With Nature", formId: "one_with_nature",
      overlay: true,
      rewardRoutes: ["defeat", "accord"],      // defeat Gaia, OR complete her restoration-and-understanding objective (see `accord`)
      appearance: "Root seams cross the character's own silhouette; a small branching crown appears and nearby vegetation leans toward them. Keep the character's identity.",
      stats: {},
      loadout: { preservePrimary: true, preserveSecondary: true, preserveReserves: true, additionalTechniqueSlots: 1, consumesConceptStorage: false },
      extraTechnique: "livingConduit",
      grantedTraits: ["rootbound", "greenblood", "woundedLand"],   // learned form (2026-10-17)
      strike: { potency: 10, range: 2, damageType: "nigredo", name: "Thorn Lash", rider: { rootOnLiving: true } },
      techniques: ["watershed", "gaiasAccord"],
      learnedStats: { maxLFAdd: 30, livingHeal: 6 },
      lensSlots: 2,                            // Mala left this open; PROVISIONAL: at most 2 form lenses at once
      lenses: ["rooted", "canopy", "deepRoots", "mycelialReach"] },
    // The Brain Chip (Grok's spec for Mala, 2026-10-13; docs/brain-chip.md). The orb a transcended AGI drops. An overlay
    // form only the Warden can wear: he keeps his loadout and gains a blade for a Strike, a bite on Barrier's aura, two
    // traits, two techniques and the orb ultimate (docs/orbs.md), all for the length of the form.
    brainChip: { id: "brainChip", name: "Brain Chip", boss: "agi", form: "Cyborg", formId: "cyborg", overlay: true,
      only: ["warden"], onlyText: "The Brain Chip answers the Warden.",
      breakText: "The Brain Chip breaks. Cyan lattice runs under his skin and the drones wake: Cyborg",
      sprite: "neo-warden-cyborg",
      stats: {},
      loadout: { preservePrimary: true, preserveSecondary: true, preserveReserves: true, consumesConceptStorage: false },
      grantedTraits: ["ceaselessAdaptation", "perfectMemory", "cybernetic", "takeoff", "overheat"],   // cybernetic: Mala, 2026-10-13; takeoff + overheat: learned forms 2026-10-17
      learnedStats: { maxLFAdd: 30, channelTakenMul: { rubedo: 1.25 } },
      spriteFor: { warden: "neo-warden-cyborg" },
      techniques: ["droneLance", "hexScreen", "droneSwarm"],
      strike: { potency: 12, range: 2, damageType: "citrinitas", name: "Energy Blade", rider: { guardCrack: true } },   // 8 → 12 (learned forms)
      aura: { concept: "barrier", bite: 4, damageType: "nigredo" },       // once per attacker per his turn
      adaptation: { fromHit: 2, mul: 0.85 } },                            // Ceaseless Adaptation: no immunity, ever
    // The Symbiote (Visitors P2, 2026-10-16; docs/visitors-p2.md). Not a boss drop: escaping the ship
    // unlocks it on the account, and every later battle carries one break (ui.js grants it at start; the
    // account spend no-ops since it was never in account.orbs). Flesh where the Chip is tech: more body
    // (+25 LF), a harder-but-closer strike, slower adaptation, no new techniques. Warden-only overlay.
    symbiote: { id: "symbiote", name: "Symbiote", form: "Warden Symbiote", formId: "symbiote", overlay: true,
      only: ["warden"], onlyText: "The Symbiote answers the Warden.",
      breakText: "The cell he swallowed aboard the ship wakes up hungry. Green runs up his arms and his shadow grows teeth: Warden Symbiote",
      sprite: "warden-symbiote",
      stats: { maxLFAdd: 25 },
      loadout: { preservePrimary: true, preserveSecondary: true, preserveReserves: true, consumesConceptStorage: false },
      strike: { potency: 9, range: 1, damageType: "rubedo", name: "Rending Maw" },
      adaptation: { fromHit: 3, mul: 0.9 } },
    // Wearing her is the orb, not the fight. Potency on The Earth Speaks stays in her tectonic band. PROVISIONAL.
    orbOfTheWorld: { name: "Orb of the World Goddess", boss: "worldGoddess", form: "World Goddess", formId: "world_goddess", overlay: true, sprite: "world-goddess",
      stats: { maxLFAdd: 30 },
      grantedTraits: ["rootbound", "greenblood", "woundedLand"],
      strike: { potency: 12, range: 1, damageType: "nigredo", name: "Rooted Strike" },
      techniques: ["boss_worldGoddess_courtCall", "boss_worldGoddess_courtClose", "boss_worldGoddess_theEarthSpeaks"] },
    };

  // Learned forms (Mala, 2026-10-17; docs/learned-forms.md). Holding drains ΦF at your turn start; when ΦF can't pay, the
  // form eats LF (eatStart, +eatStep each turn). At forcedAt of max LF the form throws you out and you are Burnt Out.
  const learnedForms = {
    enterAp: 50, drain: 6, eatStart: 6, eatStep: 3, forcedAt: 0.10, burntOutAp: 50, reentryTurns: 2, vowTurns: 3,
    // which form a real win against each Omega threat teaches (account.forms[character])
    teach: { dragon: "orbOfTheDragon", oni: "orbOfTheOni", kaiju: "orbOfTheKaiju", emissary: "orbOfTheEmissary", gaia: "orbOfGaia", agi: "brainChip", tech_billionaire: "orbOfTheFounder", tallyman: "orbOfTheTallyman" },
    traits: { fireHeal: 4, spiritRadius: 3, larvaAt: 15, larvaMax: 2, curseDamage: 12, platformAllyAp: 10, parachuteMove: 2, acquireTurns: 2, territorialRadius: 2, territorialDealt: 1.15, territorialTaken: 0.8, thresholdDealt: 1.2, exoFirstHit: 5, moltEvery: 3, moltTaken: 1.15, moltHeal: 15,
      quenchMul: 2, rootDrain: 2, woundedMul: 2, woundedFire: 1.5, greenPer: 2, greenMax: 6, takeoffMax: 5, takeoffPer: 1, overheatReset: 2, burnStep: 2, parachuteAt: 0.25 },
    ai: { enterFoeLF: 150, enterOwnLF: 0.6, releaseAt: 0.35 },
  };

  // ── One With Nature: Living Conduit and the Gaia form lenses (Mala's design; numbers PROVISIONAL) ──
  // Living terrain = soil or plant tiles (turf, mulch, hedge, thorn mat, rain garden…) and live plant objects
  // (trees, shrubs, groundcover, Succession patches). Paving, water, stone and anything burnt or cleared is not.
  const livingConduit = {
    name: "Living Conduit", tier: "form",
    mechanism: "Route one of your equipped techniques through connected, living terrain so it starts from another tile.",
    cost: 2,                   // ΦF surcharge on top of the routed technique's own cost
    maxRoute: 6,               // tiles of connected living terrain from you to the new origin
    eligible: { notTiers: ["ultimate"], notDeliveries: ["self", "composite"] },
    limits: [
      "The living route must stay connected from a tile beside you (or under you) to the origin.",
      "The technique keeps its delivery prerequisites, measured from the new origin (range, sight line, route budget).",
      "Sealed boundaries still count: a route can't cross a Boundary line, and can't enter or leave a Closed Domain.",
      "One activation produces one effect, not copies: the technique starts from the origin instead of from you.",
    ],
    counterplay: ["Interrupt the living route (prune, burn, pave, flood, fell).", "Isolate the intended origin.", "Challenge the technique's own prerequisites (wall, cover, range)."],
    teaches: "Mycorrhizal networks: connected roots move resources between plants that never touch above ground.",
  };

  // Form lenses cost nothing to equip but keep their trade-off. `on`: "self" (the character) or ability filters.
  // Budget (validity): benefit value − sacrifice value ≤ 0, at these exchange rates (same spirit as concept lenses:
  // +1 radius ≈ −20–25% potency, +2 range ≈ −20% potency).
  const lensBudget = { radiusAdd: 0.22, rangeAdd: 0.1, durationAdd: 0.12, potencyMul: 1, displacementResist: 0.1, moveAdd: 0.1, livingReach: 0.06 };   // conditional reach is cheaper: it needs an intact living route
  const formLenses = {
    rooted:        { name: "Rooted", on: "self", benefit: "Shoves move you 1 tile less (Anchor-like).", sacrifice: "−1 movement.",
                     mods: { displacementResist: 1, moveAdd: -1 } },
    canopy:        { name: "Canopy", on: { area: ["radius", "plus", "cone", "line"] }, benefit: "+1 effect breadth (radius, cone or line length).", sacrifice: "×0.75 potency per target.",
                     mods: { radiusAdd: 1, potencyMul: 0.75 } },
    deepRoots:     { name: "Deep Roots", on: { persistent: true }, benefit: "+1 turn on a persistent effect.", sacrifice: "−1 placement range.",
                     mods: { durationAdd: 1, rangeAdd: -1 } },
    mycelialReach: { name: "Mycelial Reach", on: { notDeliveries: ["self"] }, benefit: "+3 reach, but only to a target tile connected to you through living terrain.", sacrifice: "×0.8 potency and the route must be intact.",
                     mods: { livingReach: 3, potencyMul: 0.8 } },
  };
  const formSafeguards = [
    "Only supported abilities can receive a lens.",
    "Lens profiles must satisfy their validity budget.",
    "Lens changes affect future commitments only (anything already announced or delayed keeps its lens).",
    "Free equipping grants no extra actions or reactions.",
    "Each form lens can be equipped once: no stacking by re-equipping.",
    "Living Conduit and the form lenses go away when the form ends.",
  ];

  // Mala's balance questions, answered PROVISIONALLY (change freely):
  const formBalance = {
    activation: "main",          // breaking the orb takes your main action that turn (you can still move)
    activationAp: 50,            // what "main action" costs in action points (Claude, 2026-10-13: half a turn, the price of an ultimate)
    duration: 3,                 // owner turns, like the other forms
    consumption: "consumed",     // the orb breaks; a new one comes only from another reward route
    maxLenses: 2,
    persistentOnExpiry: "keepBaseOnly", // effects made in form last their normal duration; Deep Roots' extra turn is cut at expiry
  };

  // ── The land's wounds (engine/land.js; Mala, 2026-10-14) ──
  // Ground damage in battle is the land's Life Force. Each fighter's harm goes on a ledger; place familiarity is the
  // counter (control = share of the place's hidden cards revealed ÷ controlAt; at full control a strike leaves the
  // dirt whole). From warnAt the chance Gaia emerges each round climbs to certain at emergeAt; she arrives as the
  // Living Accord beside whoever wounded the land most, fighting for the other side. More wounds after she arrives
  // (enrageAfter, warned at enrageWarnAfter) turn her into the Wounded Ground, hostile to everyone, hunting the ledger.
  const land = {
    wounds: { groundTile: 0.5, plantHit: 1, plantDestroyed: 3, treeFelled: 5, communedKilled: 8, earthUnit: 5, heartHit: 8 },
    controlAt: 0.75, warnAt: 15, emergeAt: 30, enrageWarnAfter: 8, enrageAfter: 15, arrivalLF: 150,
    // Site temper (Mala, 2026-10-19): patience is compositional. Rock waits (warnAt rises with the hard
    // fraction); living ground forgives (warnAt falls and old wounds knit over with the plant-or-soil fraction).
    temper: { rockPatience: 10, greenMercy: 5, forgiveRate: 2, minWarn: 8 },
    voice: {
      default: { warn: "The ground answers. Gaia has noticed what is being done to the land.", rise: "rises beside" },
      grove: { warn: "The boughs shudder. Gaia has noticed what is being done to the grove.", rise: "rises out of the mulch beside" },
    },
    // Plant-based people know better (Mala, 2026-10-14): until they know the place, their AI counts each wound an
    // action would cause against it (aiWoundCost score a wound). Communed plants count as plant-based too.
    respectedBy: ["hiker", "botanist", "horticultureExpertise", "steward", "plantKin"], aiWoundCost: 4,
  };

  // ── Gaia's ecology: the landscape's condition decides her form (gaia.js) ──
  // Four functions a site performs, each measured 0..1 from the arena. A Gaia encounter names one as THREATENED.
  const ecology = {
    functions: {
      water:   { name: "Water", text: "Water is held and moves where it should: swales, rain gardens and check dams working, waterways connected.",
                 damage: "Severed waterways." },
      habitat: { name: "Habitat", text: "Living terrain is connected, so wild things can move through it.", damage: "Isolated patches of green." },
      soil:    { name: "Soil", text: "Ground is covered and holding: no bare rubble, burn scars or cleared ground.", damage: "Fractured, exposed soil." },
      canopy:  { name: "Canopy", text: "The trees are standing.", damage: "Snapped branches, felled trunks." },
    },
    restoredAt: 0.75,          // a threatened function counts as restored at this health
    endangeredBelow: 0.5,      // while allied, a function falling below this is a violation
  };

  // What counts as disturbance, and how much (the ledger tells Gaia who to watch).
  const disturbance = { fellTree: 3, strikeGaia: 3, burnTile: 2, killWildType: 2, clearPlant: 1, rubble: 1, paveSoil: 1 };

  // Wild types Gaia brings. Placeholders until Mala or Grok designs them (art: roots, spores, animal silhouettes).
  const wildTypes = {
    rootTangle: { name: "Root tangle", from: "soil", lf: 30, text: "Roots lift out of the ground and grab: entangles what it reaches.", status: "placeholder" },
    sporeDrift: { name: "Spore drift", from: "groundcover", lf: 18, text: "A cloud of spores: blinds lines through it.", status: "placeholder" },
    understory: { name: "Understory creature", from: "hedge", lf: 26, text: "Something quick under the hedges: harries and slips away.", status: "placeholder" },
  };

  // The Living Accord: the transition to her restored form, and the second way to earn her orb.
  const accord = {
    name: "The Living Accord",
    text: "Restore the threatened function and come to understand Gaia.",
    restore: "The encounter's threatened function reaches ecology.restoredAt.",
    restorationActs: {      // what raises a function's health (the engine reports these; gaia.ecologyOf reads the arena too)
      patchMatured: "habitat", waterHeld: "water", hazardCleared: "soil", nurseLog: "soil", treePlanted: "canopy", routeReconnected: "habitat",
    },
    understand: "Every observation in Gaia's deck revealed (Observe her).",
    violationsRaiseTheBar: 0.05,   // each violation by your side raises the restore target (it never closes the accord outright)
    graceRounds: 1,                // once allied: a violation is telegraphed, then one round to make it right before she turns
    reward: "orbOfGaia",           // granted at the end of a battle the accord survived
  };

  // The ultimate form: the Integrated Self (Mala: a hovering being of pure gold with no distinct features).
  // Available once the character has integrated their psyche:
  //   - knows themselves: every self-trait known (Johari Blind and Unknown panes are empty);
  //   - has worked through their shadow: every trauma resolved;
  //   - has met their dreams: held the gaze of at least 3 different dream monsters (accepted them as not-foes).
  const integratedSelf = {
    name: "The Integrated Self", look: "A hovering being of pure gold with no distinct features.",
    requirements: { allSelfTraitsKnown: true, allTraumasResolved: true, dreamsBefriended: 3 },
    cost: "fullUltimateCharge", duration: 4, oncePerBattle: true,   // 3 → 4 (2026-10-17)
    // Mala, 2026-10-08: the Gold Form has its OWN hit points. Damage goes to the gold, not the character; when the gold
    // is broken (or the 3 turns end) the character returns with exactly the LF they had when they transformed.
    // Excess damage beyond the gold's pool does not carry over. PROVISIONAL: 100 LF for everyone.
    // Self-rebalance (locked decisions 3-6, 2026-10-26): the pool scales 2 per holder maxLF + 50
    // (100 → 250); the flat lf: 180 is retired. Past four free turns the form holds on the
    // learned-forms convention rates (drain/eatStart/eatStep/forcedAt/burntOutAp — one convention,
    // two chassis). Flow lives in the form (ward 3 + strike ×1.15, no bar); vows can't be
    // declared in gold; Wholeness unchanged (decision 10: the Integrator verifies at build).
    pool: { perMaxLF: 2, base: 50 },   // 180 flat → formula (2026-10-26)
    drops: { perRoundTaken: 25, perRound: 1, perBattle: 3, table: ["giltEdge", "giltEdge", "sunMote", "sunMote", "dawnWard", "paleFlame"] },   // SPEC muse-fragments (locked decisions 13-14): gold bleeds at 25 pool damage/round, table 2/2/1/1
    overflowCarries: false,
    damageTakenMul: 0.6, radianceHeal: 10,   // ×0.75 → ×0.6, heal 5 → 10 (2026-10-17)
    strike: { potency: 20, range: 2, damageType: "albedo", name: "Radiant Palm" }, techniques: ["wholeness"],   // 16 → 20 (locked decision 4, 2026-10-26): 20 ×1.25 whole ×1.15 flow = 28.75, ult class
    effects: {
      hovering: "Ignores terrain: no move costs from height or surface, no falls, no hazards, no forced movement.",
      featureless: "No features to read: enemies can't Observe you and their exploits against your traits can't land; you have no tells.",
      golden: "Incorruptible: immune to fear, taunt, stun, mockery and entanglement; all damage taken ×0.6.",
      radiance: "Allies within 3 heal 10 each turn and shed one negative status.",
      whole: "Every ability you use costs 1 less ΦF and has ×1.25 potency.",
    },
    price: "While golden you have no need of the dream: you can't open a Dream Space, summon, or use a boss orb.",
    teaches: "Individuation: when the self is known and the shadow integrated, there is nothing left for anyone to exploit.",
    // The transformation (Mala, 2026-10-08): "they go through the death animation then the transformation animation
    // begins, the body disappears in a puff of smoke and then the gold form emerges." Played in order; the renderer
    // swaps to the gold-form sheet after the last frame. Frames are drawn at `scale` to match the gold-form sheet.
    transformation: {
      sprites: "combat/sprites/gold-transform", source: "~/Documents/Game Dev/concept-combat-art/forms/gold-transform.jpg",
      scale: 0.854,            // gold body height: gold-form idle 346 px vs transform "clear" 405 px (new idle cut, 2026-10-27)
      sequence: [
        { frame: "knocked-out", from: "character", ms: 900, text: "The old self falls." },
        { frame: "cloud",  ms: 450, text: "The body is gone in a puff of smoke." },
        { frame: "breach", ms: 380, text: "Something rises through it." },
        { frame: "emerge", ms: 520, text: "Gold breaks out of the cloud.", flash: true },
        { frame: "clear",  ms: 420, text: "The smoke settles." },
        { frame: "hover",  ms: 650, text: "It hovers, featureless and whole." },
      ],
      then: "gold-form",
      // When the gold is broken: it falls, dissolves into the same smoke, and the character stands back up.
      breakSequence: [
        { frame: "knocked-out", from: "gold-form", ms: 700, text: "The gold falls." },
        { frame: "cloud", ms: 450, text: "It dissolves into smoke." },
        { frame: "idle", from: "character", ms: 500, text: "You're yourself again, as you were." },
      ],
    },
  };

  // Art (Mala, 2026-10-08). Source sheets are staged in ~/Documents/Game Dev/concept-combat-art/; Codex slices
  // them into the game's sprite folder. Each sheet is one image with labelled poses left to right.
  // A null file means the art doesn't exist yet: render the standard fallback until it does.
  const ART = "~/Documents/Game Dev/concept-combat-art";
  const BOSS_SHEETS = "~/Downloads";
  const BOSS_POSES = ["idle", "walk", "cast", "block", "punch", "enraged", "knocked-out"];
  const FORM_POSES = ["idle", "walk", "cast", "block", "punch", "knocked-out", "knee", "rest", "form-change", "clash"];
  const sprites = {
    poses: { boss: BOSS_POSES, form: FORM_POSES },
    bosses: {
      emissary: { sheet: `${BOSS_SHEETS}/The Emissary Sprite.png`, poses: "boss", runtimeFolder: "emissary-boss", note: "Six authored poses; enraged reuses cast (the vortex). Dialogue busts: emissary-faces/." },
      kaiju:  { sheet: `${BOSS_SHEETS}/Kaiju BOSS.png`, poses: "boss", runtimeFolder: "kaiju-boss" },
      oni:    { sheet: `${BOSS_SHEETS}/Oni Boss.png`, poses: "boss", runtimeFolder: "oni-boss" },
      dragon: { sheet: `${BOSS_SHEETS}/Dragon Boss.png`, poses: "boss", runtimeFolder: "dragon-boss" },
      tallyman: { sheet: "~/loci/staged-art/tallyman-review", poses: "boss", runtimeFolder: "tallyman", note: "Muse's cut of The Tallyman Pixel Sprite Sheet (2026-10-18), installed after the reveal (2026-10-20): 10 poses, enraged scaled to match, dialogue heads in tallyman/heads/." },
      // Gaia: one sheet per FORM (the land's condition), not per health. Neither has an enraged pose.
      gaia:   { poses: "form", sheet: `${ART}/bosses/gaia-boss-large.png`, forms: {
                disturbed: { sheet: `${ART}/bosses/gaia-boss-large.png`, idle: `${ART}/bosses/gaia-large-idle-cutout.png`, runtimeFolder: "gaia-wounded", note: "The Wounded Ground: the large fractured tree-body." },
                restored:  { sheet: `${ART}/bosses/gaia-boss.png`, idle: `${ART}/bosses/gaia-idle-cutout.png`, runtimeFolder: "gaia-accord", note: "The Living Accord: moss, water-blue, normal size." } } },
      worldGoddess: { poses: "form", sheet: "combat/sprites/world-goddess", note: "Ascended Gaia. Eleven poses plus heads. Not on the Boss Rush (rush: false)." },
      sealednext: { sheet: "~/loci-orbit/grok/secret-warrior-r2/assets/sealednext-sheet.png", poses: "boss", runtimeFolder: "sealednext", note: "Draft sheet in the room. Faces right except recoils left. Solid #000000 ground." },
    },
    forms: {
      orbOfTheEmissary: { sheet: null, poses: "form", note: "Faceless humanoid form not drawn yet." },
      orbOfTheTallyman: { sheet: null, poses: "form", note: "Ledger-Sworn: the wearer keeps their own look; no form sheet yet." },
      orbOfTheSealed: { sheet: null, poses: "form", note: "Appointment-Sworn: the wearer keeps their own look; overlay prize." },
      orbOfTheKaiju:  { sheet: `${ART}/forms/kaiju-form.png`, poses: "form", runtimeFolder: "kaiju-form" },
      orbOfTheOni:  { sheet: `${ART}/forms/oni-form.png`, poses: "form", runtimeFolder: "oni-form" },
      orbOfTheDragon: { sheet: "combat/sprites/neo-warden-dragon", poses: "form", overlay: true, note: "The Dragonfire Neo Warden sheet (staged-art/dragonfire-warden-review) for the Warden; other characters keep their own look." },
      orbOfTheFounder: { sheet: "combat/sprites/neo-warden-cyberpunk", poses: "form", overlay: true, note: "The Cyberpunk Neo Warden sheet (staged-art/cyberpunk-warden-review); other characters keep their own look." },
      orbOfGaia:      { sheet: "combat/sprites/gaia-form", poses: "form", overlay: true, note: "Uses Child of Gaia's dedicated six-pose form sprite while the form is active; root-seam and crown overlays can be layered on top." },
      brainChip:      { sheet: "combat/sprites/neo-warden-cyborg", poses: "form", overlay: true, note: "The Neo Warden's cyborg sheet, worn while the form is up; the live neo-warden folder is untouched. Icon: combat/sprites/items/brainChip.png." },
      symbiote:        { sheet: "combat/sprites/warden-symbiote", poses: "form", overlay: true, note: "The Warden Symbiote sheet, worn while the form is up; unlocked by escaping the ship, granted fresh every battle." },
      orbOfTheWorld: { sheet: "combat/sprites/world-goddess", poses: "form", note: "Wearing her is the orb, not the fight." },
      integratedSelf: { sheet: "combat/sprites/gold-form", source: `${ART}/forms/gold-form.png`, poses: "form" },
    },
  };

  return { learnedForms, rules, conditions, bosses, orbs, integratedSelf, sprites, livingConduit, formLenses, lensBudget, formSafeguards, formBalance, accord, ecology, disturbance, wildTypes, land };
});
