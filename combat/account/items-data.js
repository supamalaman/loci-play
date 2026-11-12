"use strict";
// Items for the persistent account (Mala, 2026-10-08): things you collect or win after a battle,
// a shop, one-time consumables, and equipment with passive effects. Plain data. Numbers PROVISIONAL.
//
// Currency: Seeds. Rarities: common < uncommon < rare < legendary.
// Consumables: one-time use; you bring up to `battleSlots` into a battle (shared with items picked up
//   on the map). `effect` uses engine vocabulary; the six map items' effects live in the wild module.
// Equipment: owned once, worn in 5 slots, always on. `passive` keys are modifiers the engine applies.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatItems = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // durability: how many battles a piece of gear lasts while equipped before it wears out (Mala, 2026-10-08).
  const rarities = {
    common:    { weight: 70,  price: 30,  sell: 12,  durability: 4 },
    uncommon:  { weight: 24,  price: 70,  sell: 28,  durability: 6 },
    rare:      { weight: 5.5, price: 160, sell: 64,  durability: 10 },
    legendary: { weight: 0.5, price: 400, sell: 160, durability: 15 },
  };
  const slots = ["head", "body", "feet", "tool", "charm"];
  const rules = { battleSlots: 2, stashLimit: 20, currency: "Seeds", salvageShare: 0.1,   // kit-board resale: share of rarity price in Seeds (Mala, 2026-11-05)
    durability: { wearPerBattle: 1, warnAt: 1, brokenSellShare: 0.5, duplicateRepairs: true } };

  // biome tags match terrain archetypes, so a quarry battle drops quarry things more often
  const consumables = {
    // the six map items (also found lying on the map)
    bait:       { name: "Bait (fallen fruit)", rarity: "common",   biomes: ["grove", "wetland"], effect: { wild: "bait" }, text: "Draws a feral pig, or redirects one for 2 rounds." },
    flare:      { name: "Flare",               rarity: "uncommon", biomes: ["quarry", "rim"],    effect: { wild: "flare" }, text: "Starts a brushfire on a fuel tile." },
    rainStick:  { name: "Rain stick",          rarity: "rare",     biomes: ["wetland"],          effect: { wild: "rainStick" }, text: "Starts a flash flood from the high ground." },
    waterCan:   { name: "Watering can",        rarity: "common",   biomes: ["wetland", "terrace"], effect: { wild: "waterCan" }, text: "Wets a plus of tiles: puts out fire, and they won't catch for 3 rounds." },
    borate:     { name: "Borate treatment",    rarity: "uncommon", biomes: ["terrace", "grove"], effect: { wild: "borate" }, text: "Treats wood: termites ignore it and adjacent swarms flee." },
    noisemaker: { name: "Noisemaker",          rarity: "uncommon", biomes: [],                   effect: { wild: "noisemaker" }, text: "Startles unit monsters within 4: pigs flee." },
    // battle consumables. dropWeight: how often within its rarity (small heals are the most common drop)
    bandage:       { name: "Bandage",           rarity: "common",   biomes: [], dropWeight: 6, effect: { heal: 10 }, text: "Heal 10 LF." },
    firstAidKit:   { name: "First-aid kit",     rarity: "uncommon", biomes: [], dropWeight: 3, effect: { heal: 25 }, text: "Heal 25 LF." },
    electrolytes:  { name: "Electrolyte drink", rarity: "common",   biomes: [], dropWeight: 3, effect: { phiForce: 8 }, text: "Restore 8 ΦF." },
    surveyFlag:    { name: "Survey flag",       rarity: "uncommon", biomes: ["rim", "terrace"], effect: { observe: 1 }, text: "Reveal one enemy technique (a free Observe)." },
    sandbag:       { name: "Sandbag",           rarity: "uncommon", biomes: ["wetland", "quarry"], effect: { placeBarrier: { protection: 15, duration: 2 } }, text: "Place a 1-tile wall (15 protection, 2 turns)." },
    trailMix:      { name: "Trail mix",         rarity: "common",   biomes: [], dropWeight: 2, effect: { actionPoints: 25 }, text: "+25 action points this turn." },
    // dropOnly: map drops only — never post-battle loot or shop stock (Mala, 2026-10-13).
    dreamFish:     { name: "Dream fish",        rarity: "common",   biomes: [], dropOnly: true, effect: { ultCharge: 20 }, text: "+20 ultimate charge. Caught in the battle's water; the road to a dream." },
    coolantCell:   { name: "Coolant cell",      rarity: "common",   biomes: [], dropOnly: true, effect: { heal: 4 }, text: "Heal 4 LF. Shaken out of a data center." },
    upsCell:       { name: "UPS cell",          rarity: "common",   biomes: [], dropOnly: true, effect: { actionPoints: 25 }, text: "+25 action points this turn. A ripped power supply." },
    dataCore:      { name: "Data core",         rarity: "uncommon", biomes: [], dropOnly: true, effect: { observe: 1 }, text: "Reveal one enemy technique (a free Observe). Server intel." },
    fish:          { name: "Raw salema",        rarity: "common",   biomes: [], dropOnly: true, effect: { ultCharge: 25 }, text: "Eat it: +25 ultimate charge. Vivid dreams." },
    // repairs: used from the stash between battles, not carried into them
    repairKit:     { name: "Repair kit",        rarity: "uncommon", biomes: [], dropWeight: 2, outsideBattle: true, effect: { repair: "half" }, text: "Restore half of one gear piece's durability (rounded up)." },
    fieldWorkshop: { name: "Field workshop",    rarity: "rare",     biomes: [], dropWeight: 1, outsideBattle: true, effect: { repair: "full" }, text: "Fully restore one gear piece, even a worn-out one." },
    fieldGuidePage:{ name: "Field-guide page",  rarity: "rare",     biomes: [], effect: { autoCorrectQuestion: 1 }, text: "Your next summon question counts as correct." },
    // hallOnly: sold at the town's Hiring Hall at a fixed price; never loot or random shop stock (Mala, 2026-10-18:
    // "contracts for Mercs, letters of safe conduct for mediators"; engine/hires.js, docs/mercs-and-mediators.md).
    mercContract:  { name: "Merc contract",     rarity: "rare",     biomes: [], hallOnly: true, price: 120, effect: { hire: "merc" }, text: "Call a mercenary: they arrive next round and fight beside you for 4 of their turns (they run below 30% LF). One merc a battle." },
    safeConduct:   { name: "Letter of safe conduct", rarity: "rare", biomes: [], hallOnly: true, price: 90, effect: { hire: "mediator" }, text: "Call a mediator: they arrive next round, can't be attacked, and ask one enemy a turn for a 2-round truce. One mediator a battle." },
    smokeCandle:   { name: "Smoke candle",      rarity: "rare",     biomes: ["quarry"], effect: { blockSightTiles: { radius: 1, duration: 2 } }, text: "Smoke blocks sight in a plus for 2 turns." },

    // Staged-sprite expansion (2026-10-22). Effects are the ones useItem already applies.
    bitterMelon: { name: "Bitter melon", rarity: "common", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 12 }, text: "Heal 12 LF. A bitter melon from the garden." },
    hawthornBerry: { name: "Hawthorn berries", rarity: "common", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 14 }, text: "Heal 14 LF. Hawthorn berries." },
    hawthornFlower: { name: "Hawthorn flowers", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, effect: { ultCharge: 15 }, text: "+15 ultimate charge. Hawthorn flowers." },
    hawthornLeaf: { name: "Hawthorn leaf", rarity: "common", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 6 }, text: "Heal 6 LF. A hawthorn leaf chewed on the walk." },
    blossomBranch: { name: "Blossom branch", rarity: "common", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 10 }, text: "Heal 10 LF. A flowering hawthorn branch." },
    orchardApple: { name: "Orchard apple", rarity: "common", biomes: ["grove", "terrace"], dropWeight: 0.4, effect: { heal: 8 }, text: "Heal 8 LF." },
    banana: { name: "Banana", rarity: "common", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 10 }, text: "Heal 10 LF." },
    earOfCorn: { name: "Ear of corn", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, effect: { heal: 12 }, text: "Heal 12 LF. An ear of corn." },
    cornSkewer: { name: "Corn skewer", rarity: "uncommon", biomes: ["terrace"], dropWeight: 0.4, effect: { heal: 16 }, text: "Heal 16 LF. Corn off the fire." },
    cornKernels: { name: "Corn kernels", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, effect: { heal: 4 }, text: "Heal 4 LF. A handful of kernels." },
    bobaTea: { name: "Boba tea", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, effect: { phiForce: 8 }, text: "Restore 8 ΦF." },
    chipBag: { name: "Chip bag", rarity: "common", biomes: [], dropWeight: 0.4, effect: { heal: 8 }, text: "Heal 8 LF." },
    sodaCan: { name: "Soda can", rarity: "common", biomes: [], dropWeight: 0.4, effect: { phiForce: 6 }, text: "Restore 6 ΦF." },
    fishFillet: { name: "Fish fillet", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, effect: { heal: 16 }, text: "Heal 16 LF. A cooked fillet." },
    fishEggs: { name: "Fish eggs", rarity: "common", biomes: ["wetland"], dropWeight: 0.4, effect: { heal: 8 }, text: "Heal 8 LF." },
    seaweedWrap: { name: "Seaweed wrap", rarity: "common", biomes: ["wetland"], dropWeight: 0.4, effect: { heal: 6 }, text: "Heal 6 LF. A wrap of seaweed." },
    herbCup: { name: "Herb tea", rarity: "common", biomes: ["grove"], dropWeight: 0.4, effect: { phiForce: 6 }, text: "Restore 6 ΦF. A cup of herb tea." },
    frostVial: { name: "Frost vial", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, effect: { phiForce: 10 }, text: "Restore 10 ΦF." },
    hedgeFlask: { name: "Hedge flask", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 18 }, text: "Heal 18 LF." },
    shamanFlask: { name: "Shaman's flask", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 15 }, text: "Heal 15 LF." },
    isotopeVial: { name: "Isotope vial", rarity: "rare", biomes: [], dropWeight: 0.4, effect: { ultCharge: 18 }, text: "+18 ultimate charge." },
    fieldSyringe: { name: "Field syringe", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { heal: 20 }, text: "Heal 20 LF." },
    patrolMedkit: { name: "Patrol medkit", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { heal: 22 }, text: "Heal 22 LF." },
    smokeBomb: { name: "Smoke bomb", rarity: "uncommon", biomes: ["terrace"], dropWeight: 0.4, effect: { blockSightTiles: { radius: 1, duration: 2 } }, text: "Smoke blocks sight in a plus for 2 turns." },
    ninjaSmoke: { name: "Ninja smoke", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { blockSightTiles: { radius: 1, duration: 1 } }, text: "Smoke blocks sight in a plus for 1 turn." },
    fieldGrenade: { name: "Field grenade", rarity: "uncommon", biomes: ["quarry"], dropWeight: 0.4, effect: { blockSightTiles: { radius: 1, duration: 2 } }, text: "A field grenade's smoke blocks sight in a plus for 2 turns." },
    badgeGrenade: { name: "Badge grenade", rarity: "uncommon", biomes: ["terrace"], dropWeight: 0.4, effect: { blockSightTiles: { radius: 1, duration: 2 } }, text: "Smoke blocks sight in a plus for 2 turns." },
    stretchedMoment: { name: "Stretched moment", rarity: "rare", biomes: [], dropWeight: 0.4, effect: { actionPoints: 30 }, text: "The moment stretches: +30 action points this turn." },
    spareMag: { name: "Spare magazine", rarity: "common", biomes: [], dropWeight: 0.4, effect: { actionPoints: 15 }, text: "+15 action points this turn." },
    coldBrew: { name: "Cold brew", rarity: "common", biomes: [], dropWeight: 0.4, effect: { phiForce: 4 }, text: "Restore 4 ΦF." },
    waterBottle: { name: "Water bottle", rarity: "common", biomes: [], dropWeight: 0.4, effect: { phiForce: 6 }, text: "Restore 6 ΦF." },
    foldedMap: { name: "Folded map", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, effect: { observe: 1 }, text: "Reveal one enemy technique (a free Observe)." },
    starChart: { name: "Star chart", rarity: "rare", biomes: ["rim"], dropWeight: 0.4, effect: { observe: 1 }, text: "Reveal one enemy technique (a free Observe)." },
    sealedScroll: { name: "Sealed scroll", rarity: "rare", biomes: [], dropWeight: 0.4, effect: { autoCorrectQuestion: 1 }, text: "Your next summon question counts as correct." },
    loosePages: { name: "Loose pages", rarity: "common", biomes: [], dropWeight: 0.4, effect: { observe: 1 }, text: "Reveal one enemy technique (a free Observe)." },
    metronome: { name: "Metronome", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { actionPoints: 20 }, text: "+20 action points this turn." },
    partsCrate: { name: "Parts crate", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { repair: "half" }, text: "Restore half of one gear piece's durability (rounded up).", outsideBattle: true },
    specimenCase: { name: "Specimen case", rarity: "rare", biomes: ["quarry"], dropWeight: 0.4, effect: { repair: "half" }, text: "Restore half of one gear piece's durability (rounded up).", outsideBattle: true },
    incenseStick: { name: "Incense stick", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, effect: { phiForce: 8 }, text: "Restore 8 ΦF." },
    jellyCup: { name: "Jelly cup", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, effect: { heal: 10 }, text: "Heal 10 LF." },
    powerCore: { name: "Power core", rarity: "rare", biomes: [], dropWeight: 0.4, effect: { ultCharge: 20 }, text: "+20 ultimate charge." },
    frostCrystal: { name: "Frost crystal", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, effect: { ultCharge: 12 }, text: "+12 ultimate charge." },
    focusLens: { name: "Focus lens", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, effect: { phiForce: 8 }, text: "Restore 8 ΦF." },
    seaCapsule: { name: "Sea capsule", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, effect: { heal: 12 }, text: "Heal 12 LF." },
    coldCanister: { name: "Cold canister", rarity: "common", biomes: [], dropWeight: 0.4, effect: { heal: 6 }, text: "Heal 6 LF. A cold canister." },
    callRadio: { name: "Call radio", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, effect: { observe: 1 }, text: "Reveal one enemy technique (a free Observe)." },
    pocketPhone: { name: "Pocket phone", rarity: "uncommon", biomes: ["terrace"], dropWeight: 0.4, effect: { observe: 1 }, text: "Reveal one enemy technique (a free Observe)." },
    pocketCamera: { name: "Pocket camera", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { observe: 1 }, text: "Reveal one enemy technique (a free Observe)." },
    clapperboard: { name: "Clapperboard", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { actionPoints: 20 }, text: "+20 action points this turn." },
    markedScript: { name: "Marked script", rarity: "rare", biomes: [], dropWeight: 0.4, effect: { autoCorrectQuestion: 1 }, text: "Your next summon question counts as correct." },
    cologneBottle: { name: "Cologne", rarity: "common", biomes: [], dropWeight: 0.4, effect: { phiForce: 4 }, text: "Restore 4 ΦF." },
    cupFungus: { name: "Cup fungus", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 8 }, text: "Heal 8 LF. A cup fungus." },
    pohiFlower: { name: "Pohinahina flower", rarity: "common", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 6 }, text: "Heal 6 LF." },
    pohiLeaf: { name: "Pohinahina leaf", rarity: "common", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 8 }, text: "Heal 8 LF." },
    icePack: { name: "Ice pack", rarity: "common", biomes: ["wetland"], dropWeight: 0.4, effect: { heal: 8 }, text: "Heal 8 LF." },
    marketBox: { name: "Market box", rarity: "rare", biomes: ["wetland"], dropWeight: 0.4, effect: { heal: 18 }, text: "Heal 18 LF. A box of the catch." },
    libraryScroll: { name: "Library scroll", rarity: "rare", biomes: [], dropWeight: 0.4, effect: { autoCorrectQuestion: 1 }, text: "Your next summon question counts as correct." },

    // Cooking (2026-10-25; account/cooking.js has their tags and recipes). Raw ingredients are weak alone; cook them.
    tofu: { name: "Tofu", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, effect: { heal: 6 }, text: "Heal 6 LF. A block of soft tofu; better cooked." },
    shiitake: { name: "Shiitake", rarity: "common", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 4 }, text: "Heal 4 LF. A shiitake mushroom." },
    bokChoy: { name: "Bok choy", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, effect: { heal: 4 }, text: "Heal 4 LF. A head of bok choy." },
    // Ingredient totems T2 (spec claude-ingredient-totems-spec section 7; art: Kerf CU's vegan-ingredients cut, the raw forms).
    veganShrimp: { name: "Vegan shrimp", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, effect: { heal: 4 }, text: "Heal 4 LF. Plant-based shrimp for the pot." },
    napaCabbage: { name: "Napa cabbage", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, effect: { heal: 4 }, text: "Heal 4 LF. A whole head of napa cabbage." },
    noodles: { name: "Noodles", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, effect: { heal: 4 }, text: "Heal 4 LF. A bundle of dry noodles; long ones, for long life." },
    beefSlices: { name: "Sliced beef", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, effect: { heal: 3 }, text: "Heal 3 LF raw. Thin slices for the pot." },
    chiliPepper: { name: "Chili pepper", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, effect: { phiForce: 3 }, text: "Restore 3 ΦF. The heat clears your head." },
    // A ballpark novelty (Mala, 2026-10-30, from a photo): a Bloody Mary glass piled with a burger stack, a hot dog, an onion ring
    // and a brownie on a pick. Rare, so it can drop and ride the field shop (never dropOnly); not cooked (no recipe, no new ingredients).
    stadiumBloodyMary: { name: "Stadium Bloody Mary", rarity: "rare", biomes: [], dropWeight: 0.4, effect: { heal: 30, phiForce: 10 }, text: "Heal 30 LF and restore 10 ΦF. A tall Bloody Mary piled with a burger stack, a hot dog, an onion ring and a brownie on a pick: a whole ballpark meal and a drink in one glass." },
    // dishes: made, never found or sold (mapo tofu and hot pot)
    mush: { name: "Mush", rarity: "common", biomes: [], cookOnly: true, effect: { heal: 8 }, text: "Heal 8 LF. Whatever was in the pot, mashed. Filling, and nothing else." },
    mapoTofu: { name: "Mapo tofu", rarity: "uncommon", biomes: [], dropOnly: true, effect: { heal: 14, phiForce: 6 }, text: "Heal 14 LF and restore 6 ΦF. Sichuan tofu in chili and beef." },
    hotpot: { name: "Hot pot", rarity: "uncommon", biomes: [], dropOnly: true, effect: { heal: 10, healAdjacentAllies: 10 }, text: "Heal 10 LF, and 10 LF to each ally beside you. A pot for sharing." },

    // Midjourney legendary I (2026-10-27, MJ build): single-state icons, dropWeight under the field kit.
    stonePedestal: { name: "Stone pedestal", rarity: "uncommon", biomes: ["quarry"], dropWeight: 0.4, effect: { placeBarrier: { protection: 12, duration: 2 } }, text: "Set down a 1-tile pedestal (12 protection, 2 turns). Heavy is the point." },
    fireball: { name: "Bottled fireball", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { ultCharge: 15 }, text: "+15 ultimate charge. Throw it on the pile." },
    // Midjourney legendary II (2026-10-27, MJ build).
    dropFlask: { name: "Drip flask", rarity: "common", biomes: [], dropWeight: 0.4, effect: { phiForce: 6 }, text: "Restore 6 ΦF. A slow sweet drip." },
    redCrystal: { name: "Red crystal", rarity: "uncommon", biomes: ["quarry"], dropWeight: 0.4, effect: { ultCharge: 15 }, text: "+15 ultimate charge. It hums against your palm." },
    whiteFlame: { name: "White flame", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { actionPoints: 20 }, text: "+20 action points this turn. It burns clean and quick." },
    brownRock: { name: "Brown rock", rarity: "common", biomes: ["quarry"], dropWeight: 0.4, effect: { placeBarrier: { protection: 10, duration: 2 } }, text: "Place a 1-tile rock (10 protection, 2 turns)." },
    oliveBomb: { name: "Olive bomb", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { blockSightTiles: { radius: 1, duration: 2 } }, text: "An olive that bursts into smoke: sight blocked in a plus for 2 turns." },
    darkOrb: { name: "Dark orb", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { phiForce: 10 }, text: "Restore 10 ΦF. It drinks the light and gives back focus." },
    tealSlime: { name: "Teal slime", rarity: "common", biomes: ["wetland"], dropWeight: 0.4, effect: { heal: 10 }, text: "Heal 10 LF. Wiggling, but wholesome." },
    greenSlime: { name: "Green slime", rarity: "common", biomes: ["wetland"], dropWeight: 0.4, effect: { heal: 12 }, text: "Heal 12 LF. A bigger wiggle." },
    iceShards: { name: "Ice shards", rarity: "rare", biomes: ["rim"], dropWeight: 0.4, effect: { ultCharge: 20 }, text: "+20 ultimate charge. Cold fire for the bar." },
    grubSkewer: { name: "Grub skewer", rarity: "common", biomes: [], dropWeight: 0.4, effect: { heal: 8 }, text: "Heal 8 LF. Crunchy and good." },
    purpleOrb: { name: "Purple orb", rarity: "rare", biomes: [], dropWeight: 0.4, effect: { actionPoints: 30 }, text: "+30 action points this turn. The moment stretches violet." },
    fireBowl: { name: "Fire bowl", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { heal: 8, healAdjacentAllies: 8 }, text: "Heal 8 LF, and 8 LF to each ally beside you. Warmth shared." },
    violetPortal: { name: "Violet portal", rarity: "rare", biomes: [], dropWeight: 0.4, effect: { ultCharge: 15, actionPoints: 15 }, text: "+15 ultimate charge and +15 action points this turn. Energy through the gate." },
    violetSpiral: { name: "Violet spiral", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { ultCharge: 15 }, text: "+15 ultimate charge. It winds the bar tighter." },
    iceShard: { name: "Ice shard", rarity: "common", biomes: ["rim"], dropWeight: 0.4, effect: { phiForce: 6 }, text: "Restore 6 ΦF. A cool head." },
    greenMatrix: { name: "Green matrix", rarity: "rare", biomes: [], dropWeight: 0.4, effect: { autoCorrectQuestion: 1 }, text: "Your next 1 summon question counts as correct. You have seen the pattern." },
    crystalCluster: { name: "Crystal cluster", rarity: "rare", biomes: ["quarry"], dropWeight: 0.4, effect: { heal: 22 }, text: "Heal 22 LF. Hold it close and knit." },
    redCrab: { name: "Red crab", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, effect: { heal: 16 }, text: "Heal 16 LF. Crack it open." },
    geode: { name: "Humming geode", rarity: "rare", biomes: ["quarry"], dropWeight: 0.4, effect: { phiForce: 12 }, text: "Restore 12 ΦF. The stone sings focus." },
    grayRock: { name: "Gray rock", rarity: "common", biomes: ["quarry"], dropWeight: 0.4, effect: { placeBarrier: { protection: 8, duration: 2 } }, text: "Place a 1-tile rock (8 protection, 2 turns)." },
    // Midjourney objects III (2026-10-27, MJ build).
    stasisTubeWhite: { name: "White stasis tube", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { heal: 16 }, text: "Heal 16 LF. A preserved breath." },
    fuelCanister: { name: "Fuel canister", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { actionPoints: 20 }, text: "+20 action points this turn. Pour it on." },
    stasisTubeGreen: { name: "Green stasis tube", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { phiForce: 10 }, text: "Restore 10 ΦF. Slow green focus." },
    specimenTube: { name: "Specimen tube", rarity: "uncommon", biomes: [], dropWeight: 0.4, effect: { observe: 1 }, text: "Reveal 1 enemy technique (a free Observe). Study it." },
    rubyFlask: { name: "Ruby flask", rarity: "common", biomes: [], dropWeight: 0.4, effect: { heal: 10 }, text: "Heal 10 LF. Red and warm." },
    ivDrip: { name: "IV drip", rarity: "common", biomes: [], dropWeight: 0.4, effect: { heal: 8 }, text: "Heal 8 LF. Drip by drip." },
    blueVial: { name: "Blue vial", rarity: "common", biomes: [], dropWeight: 0.4, effect: { phiForce: 6 }, text: "Restore 6 ΦF. Clear blue focus." },
    violetShard: { name: "Violet shard", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, effect: { ultCharge: 15 }, text: "+15 ultimate charge. A sliver of the bar." },
    cinderVial: { name: "Cinder vial", rarity: "common", biomes: [], dropWeight: 0.4, effect: { heal: 8 }, text: "Heal 8 LF. Warm embers in glass." },
    lavenderFlask: { name: "Lavender flask", rarity: "common", biomes: ["grove"], dropWeight: 0.4, effect: { heal: 10 }, text: "Heal 10 LF. Calm in a bottle." },
    woodenBox: { name: "Lunchbox", rarity: "common", biomes: [], dropWeight: 0.4, effect: { heal: 10 }, text: "Heal 10 LF. Somebody packed this with care." },
    traumaKit: { name: "Trauma kit", rarity: "uncommon", biomes: [], dropWeight: 0.4, outsideBattle: true, effect: { repair: "half" }, text: "Restore 50% of one gear piece's durability (rounded up). Pack it tight." },
    specimenJar: { name: "Specimen jar", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, effect: { heal: 14 }, text: "Heal 14 LF. Do not ask what floats in it." },
    supplyCrate: { name: "Supply crate", rarity: "uncommon", biomes: [], dropWeight: 0.4, outsideBattle: true, effect: { repair: "half" }, text: "Restore 50% of one gear piece's durability (rounded up). Parts and patience." },
    iceFlower: { name: "Ice flower", rarity: "common", biomes: ["rim"], dropWeight: 0.4, effect: { heal: 8 }, text: "Heal 8 LF. It melts on the tongue." },
  };

  const equipment = {
    hardHat:        { name: "Hard hat",            slot: "head",  rarity: "common",    biomes: ["grove", "quarry"], passive: { fallingObjectDamageMul: 0.5 }, text: "Half damage from falling trunks, limbs and rockslides." },
    sunHat:         { name: "Wide-brim sun hat",   slot: "head",  rarity: "common",    biomes: ["rim", "terrace"], passive: { pfRegenAdd: 1 }, text: "+1 ΦF regen per turn." },
    surveyorsCap:   { name: "Surveyor's cap",      slot: "head",  rarity: "uncommon",  biomes: ["rim"], passive: { lineRangeAdd: 1 }, text: "+1 range on line deliveries." },
    chainsawChaps:  { name: "Chainsaw chaps",      slot: "body",  rarity: "uncommon",  biomes: ["grove"], passive: { channelDamageMul: { nigredo: 0.85 } }, text: "15% less impact (Nigredo) damage." },
    rainJacket:     { name: "Rain jacket",         slot: "body",  rarity: "uncommon",  biomes: ["wetland"], passive: { channelDamageMul: { rubedo: 0.85 }, floodShoveImmune: true }, text: "15% less resonance (Rubedo) damage; flash floods can't shove you." },
    hiVisVest:      { name: "Hi-vis vest",         slot: "body",  rarity: "common",    biomes: ["terrace"], passive: { maxLFAdd: 10 }, text: "+10 max LF." },
    steelToeBoots:  { name: "Steel-toe boots",     slot: "feet",  rarity: "common",    biomes: ["quarry"], passive: { hazardImmune: true }, text: "Thorn rubble and other entry hazards don't hurt." },
    climbingSpikes: { name: "Climbing spikes",     slot: "feet",  rarity: "rare",      biomes: ["grove", "quarry"], passive: { climbCostMul: 0.6, fallDamageMul: 0.5 }, text: "Climbing costs 40% less; fall damage halved." },
    trailRunners:   { name: "Trail runners",       slot: "feet",  rarity: "uncommon",  biomes: [], passive: { moveCostMul: 0.8 }, text: "Movement costs 20% fewer action points." },
    pruningSaw:     { name: "Pruning saw",         slot: "tool",  rarity: "common",    biomes: ["grove", "terrace"], passive: { objectDamageMul: 1.5 }, text: "+50% damage to trees, hedges and site furniture." },
    climbingLanyard:{ name: "Climbing lanyard",    slot: "tool",  rarity: "uncommon",  biomes: ["grove"], passive: { knockbackResist: 1 }, text: "The first shove each battle doesn't move you (you're tied in)." },
    soilProbe:      { name: "Soil probe",          slot: "tool",  rarity: "rare",      biomes: ["quarry", "rim"], passive: { revealCliffIntegrity: true, groundDamageMul: 1.25 }, text: "See cliff integrity; +25% damage to cliffs and bridges." },
    seedPouch:      { name: "Seed pouch",          slot: "tool",  rarity: "uncommon",  biomes: [], passive: { battleSlotsAdd: 1, seedsMul: 1.1 }, text: "Carry 3 field pickups into combat; +10% Seeds earned." },
    fieldNotebook:  { name: "Field notebook",      slot: "charm", rarity: "common",    biomes: [], passive: { xpMul: 1.1 }, text: "+10% XP." },
    orgoniteCharm:  { name: "Orgonite charm", slot: "charm", rarity: "common", biomes: [], questOnly: true, passive: { dreamMonsterDamageMul: 0.8, dreamNameFearBlocked: true, summonPhiAdd: 2, dreamDrainAdd: 10 }, text: "Dream monsters hit you ×0.8. A wrong name does not feed the dream. Summons and pact calls cost +2 ΦF. A called dream keeps its own price. Your Dream Space drains +10 more per turn." },
    mnemonicCharm:  { name: "Mnemonic charm",      slot: "charm", rarity: "rare",      biomes: [], passive: { questionHint: 1 }, text: "Summon questions remove one wrong choice." },
    // Gold fragments (SPEC muse-fragments, 2026-10-26): slivers of the Integrated Self, shed only
    // when gold bleeds (25+ pool damage in a round). questOnly: earned in gold, never rolled or
    // stocked. Rare like normal items: sell 64, wear like work-gear, wake doubled at care 10.
    giltEdge:       { name: "Gilt Edge",        slot: "charm", rarity: "rare",      biomes: [], questOnly: true, fragment: true, passive: { strikePotencyAdd: 1 }, text: "+1 strike potency. A flake of gold that still wants to hit." },
    sunMote:        { name: "Sun Mote",         slot: "charm", rarity: "rare",      biomes: [], questOnly: true, fragment: true, passive: { startingUltimateCharge: 10 }, text: "Begin battles with 10 ultimate charge. Warm to hold." },
    dawnWard:       { name: "Dawn Ward",        slot: "charm", rarity: "rare",      biomes: [], questOnly: true, fragment: true, passive: { maxLFAdd: 8 }, text: "+8 max LF. Morning, kept." },
    paleFlame:      { name: "Pale Flame",       slot: "charm", rarity: "rare",      biomes: [], questOnly: true, fragment: true, passive: { pfRegenAdd: 1 }, text: "+1 ΦF regen. It burns without eating." },
    palaceKey:      { name: "Palace key",          slot: "charm", rarity: "rare",      biomes: [], passive: { summonDurationAdd: 1 }, text: "Summons stay 1 turn longer." },
    lehuaLei:       { name: "Lehua lei",           slot: "charm", rarity: "legendary", biomes: [], passive: { startingUltimateCharge: 40, maxLFAdd: 10 }, text: "Start battles with 40% ultimate charge and +10 max LF." },
    bristleconeRing:{ name: "Bristlecone ring",    slot: "charm", rarity: "legendary", biomes: ["quarry", "rim"], passive: { surviveLethalOnce: true }, text: "Once per battle, survive a lethal hit at 1 LF (strip-bark)." },

    // Fine clothes (W4.3): work-gear fights, fine clothes SPEAK. Same slots,
    // same ladder, same wear — new voice (glamour!). Sprites pending from
    // Mala (GC2); icons fall back gracefully until the wardrobe lands.
    pressedCap:   { name: "Pressed cap",   slot: "head", rarity: "common",    biomes: [], dropWeight: 0.4, garb: true, passive: { glamourAdd: 1 }, text: "+1 glamour. Clean lines." },
    tailoredShirt:{ name: "Tailored shirt",slot: "body", rarity: "common",    biomes: [], dropWeight: 0.4, garb: true, passive: { glamourAdd: 1, maxLFAdd: 4 }, text: "+1 glamour, +4 max LF." },
    brocadeVest:  { name: "Brocade vest",  slot: "body", rarity: "uncommon",  biomes: [], dropWeight: 0.4, garb: true, passive: { glamourAdd: 2, legitimacyAdd: 1 }, text: "+2 glamour, +1 legitimacy. Courtroom cloth." },
    silkCord:     { name: "Silk cord",     slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, garb: true, passive: { glamourAdd: 2, seedsMul: 1.06 }, text: "+2 glamour. Flash earns." },
    plumedHat:    { name: "Plumed hat",    slot: "head", rarity: "rare",      biomes: [], dropWeight: 0.4, garb: true, passive: { glamourAdd: 3, startingUltimateCharge: 10 }, text: "+3 glamour. An entrance." },
    galaCoat:     { name: "Gala coat",     slot: "body", rarity: "rare",      biomes: [], dropWeight: 0.4, garb: true, passive: { glamourAdd: 3, legitimacyAdd: 2 }, text: "+3 glamour, +2 legitimacy." },
    dressBoots:   { name: "Dress boots",   slot: "feet", rarity: "rare",      biomes: [], dropWeight: 0.4, garb: true, passive: { glamourAdd: 2, moveCostMul: 0.9 }, text: "+2 glamour. Glide." },
    regaliaRobe:  { name: "Regalia robe",  slot: "body", rarity: "legendary", biomes: [], dropWeight: 0.4, garb: true, passive: { glamourAdd: 5, legitimacyAdd: 3, seedsMul: 1.1 }, text: "+5 glamour, +3 legitimacy. The room notices." },

    // Empower batch (EM1): streetwear, household, architectural, arborist. The 118 icons (base, -dmg, -resto, and -emp where emp:true)
    // ship with this batch (shelf claude-empower-icons). Multiplier totals carry five decimals on purpose: they are the exact old effective
    // values (socks 0.95 x 0.8947), because a rounder 0.85 turns a one-tile step from 8 AP into 9. empower.passive holds awakened TOTALS
    // (care 10+; Mala, 2026-11-01): a key named there replaces the base value, a key not named keeps it;
    // Mul keys are the total ratio. streetBelt/streetNecklace: live belt/necklace are different items.
    wornCap:      { name: "Worn cap",      slot: "head",  rarity: "common",    biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { maxLFAdd: 4 }, text: "+4 max LF.", empower: { name: "Tempest Cap", passive: { pfRegenAdd: 1 } } },
    beanie:        { name: "Beanie",        slot: "head",  rarity: "common",    biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { pfRegenAdd: 1 }, text: "+1 ΦF regen.", empower: { name: "Ember Beanie", passive: { maxLFAdd: 6 } } },
    glasses:       { name: "Glasses",       slot: "head",  rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { lineRangeAdd: 1 }, text: "+1 line range.", empower: { name: "True Sight", passive: { questionHint: 1 } } },
    wristwatch:    { name: "Wristwatch",    slot: "charm", rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { startingUltimateCharge: 10 }, text: "Start battles with 10% ultimate charge.", empower: { name: "Fatewatch", passive: { startingUltimateCharge: 20 } } },
    streetBackpack:      { name: "Street backpack",      slot: "body",  rarity: "common",    biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { maxLFAdd: 6 }, text: "+6 max LF.", empower: { name: "Wayfarer Pack", passive: { maxLFAdd: 12 } } },
    umbrella:      { name: "Umbrella",      slot: "tool",  rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { floodShoveImmune: true }, text: "Flash floods can't shove you.", empower: { name: "Stormshade", passive: { pfRegenAdd: 1 } } },
    toteBag:       { name: "Tote bag",      slot: "charm", rarity: "common",    biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { seedsMul: 1.06 }, text: "+6% Seeds earned.", empower: { name: "Cornucopia Tote", passive: { seedsMul: 1.12 } } },
    streetBelt:    { name: "Street belt",   slot: "charm", rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { maxLFAdd: 8 }, text: "+8 max LF.", empower: { name: "Titan Belt", passive: { maxLFAdd: 14 } } },
    socks:         { name: "Socks",         slot: "feet",  rarity: "common",    biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { moveCostMul: 0.95 }, text: "Movement costs 5% fewer action points.", empower: { name: "Fleetfoot Socks", passive: { moveCostMul: 0.84997 } } },
    streetNecklace:{ name: "Street necklace", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { glamourAdd: 1, maxLFAdd: 4 }, text: "+1 glamour, +4 max LF.", empower: { name: "Heirloom Necklace", passive: { glamourAdd: 3 } } },
    lamp:          { name: "Lamp",          slot: "charm", rarity: "common",    biomes: [], dropWeight: 0.4, dual: true, emp: false, passive: { pfRegenAdd: 1 }, text: "+1 ΦF regen.", empower: { name: "Radiant Lamp", passive: { pfRegenAdd: 2, startingUltimateCharge: 10 } } },
    chair:         { name: "Chair",         slot: "body",  rarity: "common",    biomes: [], dropWeight: 0.4, dual: true, emp: false, passive: { maxLFAdd: 8 }, text: "+8 max LF.", empower: { name: "Fortress Chair", passive: { maxLFAdd: 16 } } },
    mug:           { name: "Mug",           slot: "charm", rarity: "common",    biomes: [], dropWeight: 0.4, dual: true, emp: false, passive: { startingUltimateCharge: 8 }, text: "Start battles with 8% ultimate charge.", empower: { name: "Resonance Mug", passive: { startingUltimateCharge: 18 } } },
    toaster:       { name: "Toaster",       slot: "tool",  rarity: "common",    biomes: [], dropWeight: 0.4, dual: true, emp: false, passive: { strikePotencyAdd: 1 }, text: "Strikes hit for +1 potency.", empower: { name: "Blast Toaster", passive: { strikePotencyAdd: 3 } } },
    alarmClock:    { name: "Alarm clock",   slot: "charm", rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: false, passive: { startingUltimateCharge: 12 }, text: "Start battles with 12% ultimate charge.", empower: { name: "Timeburst Alarm", passive: { startingUltimateCharge: 25, pfRegenAdd: 1 } } },
    kitchenFryingPan:     { name: "Kitchen frying pan",    slot: "tool",  rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: false, passive: { strikePotencyAdd: 2 }, text: "Strikes hit for +2 potency.", empower: { name: "Meteor Pan", passive: { strikePotencyAdd: 3 } } },
    kettle:        { name: "Kettle",        slot: "tool",  rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: false, passive: { pfRegenAdd: 1, maxLFAdd: 4 }, text: "+1 ΦF regen, +4 max LF.", empower: { name: "Storm Kettle", passive: { pfRegenAdd: 2, startingUltimateCharge: 10 } } },
    pillow:        { name: "Pillow",        slot: "charm", rarity: "common",    biomes: [], dropWeight: 0.4, dual: true, emp: false, passive: { maxLFAdd: 6 }, text: "+6 max LF.", empower: { name: "Dreamguard Pillow", passive: { maxLFAdd: 12, pfRegenAdd: 1 } } },
    vacuum:        { name: "Vacuum",        slot: "tool",  rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: false, passive: { objectDamageMul: 1.3 }, text: "+30% damage to objects.", empower: { name: "Devourer Vacuum", passive: { objectDamageMul: 1.70001 } } },
    fan:           { name: "Fan",           slot: "charm", rarity: "common",    biomes: [], dropWeight: 0.4, dual: true, emp: false, passive: { moveCostMul: 0.95 }, text: "Movement costs 5% fewer action points.", empower: { name: "Tempest Fan", passive: { moveCostMul: 0.84997, lineRangeAdd: 1 } } },
    blueprints:    { name: "Blueprints",    slot: "charm", rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { lineRangeAdd: 1 }, text: "+1 line range.", empower: { name: "Aura Blueprints", passive: { questionHint: 1 } } },
    measuringTape: { name: "Measuring tape", slot: "tool", rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { strikeRangeAdd: 1 }, text: "+1 strike range.", empower: { name: "Chrono Measure", passive: { strikeRangeAdd: 2 } } },
    architectsScale:{ name: "Architect's scale", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { objectDamageMul: 1.3 }, text: "+30% damage to objects.", empower: { name: "Astral Scale", passive: { objectDamageMul: 1.49994, groundDamageMul: 1.2 } } },
    sketchbook:    { name: "Sketchbook",    slot: "charm", rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { xpMul: 1.1 }, text: "+10% XP.", empower: { name: "Verdant Sketchbook", passive: { xpMul: 1.15005, pfRegenAdd: 1 } } },
    draftingTools: { name: "Drafting tools", slot: "tool", rarity: "rare",     biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { strikePotencyAdd: 2 }, text: "Strikes hit for +2 potency.", empower: { name: "Spirit Drafting", passive: { strikePotencyAdd: 3, lineRangeAdd: 1 } } },
    laserLevel:    { name: "Laser level",   slot: "tool",  rarity: "rare",      biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { lineRangeAdd: 2 }, text: "+2 line range.", empower: { name: "Geomancer's Level", passive: { revealCliffIntegrity: true } } },
    helmet:        { name: "Helmet",        slot: "head",  rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { fallDamageMul: 0.5, maxLFAdd: 4 }, text: "Fall damage halved, +4 max LF.", empower: { name: "Empowered Helmet", passive: { pfRegenAdd: 1 } } },
    harness:       { name: "Harness",       slot: "body",  rarity: "rare",      biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { fallDamageMul: 0.5, maxLFAdd: 8 }, text: "Fall damage halved, +8 max LF.", empower: { name: "Empowered Harness", passive: { knockbackResist: 1 } } },
    chainsaw:      { name: "Chainsaw",      slot: "tool",  rarity: "rare",      biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { objectDamageMul: 1.6 }, text: "+60% damage to objects.", empower: { name: "Empowered Chainsaw", passive: { objectDamageMul: 2 } } },
    throwBag:      { name: "Throw bag",     slot: "tool",  rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { strikeRangeAdd: 1 }, text: "+1 strike range.", empower: { name: "Empowered Throw Bag", passive: { strikeRangeAdd: 2 } } },
    ropeCoil:      { name: "Rope coil",     slot: "tool",  rarity: "uncommon",  biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { knockbackResist: 1 }, text: "The first shove each battle doesn't move you.", empower: { name: "Empowered Rope Coil", passive: { hazardImmune: true } } },
    carabinerSet:  { name: "Carabiner set", slot: "tool",  rarity: "rare",      biomes: [], dropWeight: 0.4, dual: true, emp: true, passive: { fallDamageMul: 0.4, climbCostMul: 0.8 }, text: "Falls hurt 60% less; climbing costs 20% less.", empower: { name: "Empowered Carabiner Set", passive: { moveCostMul: 0.9 } } },

    // Staged-sprite expansion (2026-10-22). dropWeight stays under the field kit. Numbers provisional.
    cutlass: { name: "Boarding cutlass", slot: "tool", rarity: "uncommon", biomes: ["quarry"], dropWeight: 0.4, passive: { strikePotencyAdd: 2 }, text: "A boarding cutlass. Strikes hit for +2 potency." },
    armingSword: { name: "Arming sword", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 3 }, text: "An arming sword. Strikes hit for +3 potency." },
    bootKnife: { name: "Boot knife", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 1 }, text: "A boot knife. Strikes hit for +1 potency." },
    wakizashi: { name: "Wakizashi", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 2 }, text: "A short blade. Strikes hit for +2 potency." },
    kunai: { name: "Kunai", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 1, strikeRangeAdd: 1 }, text: "A thrown knife. Strikes hit for +1 potency and reach one tile farther." },
    shuriken: { name: "Shuriken", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 1, strikeRangeAdd: 1 }, text: "A throwing star. Strikes hit for +1 potency and reach one tile farther." },
    hedgeKnife: { name: "Hedge knife", slot: "tool", rarity: "common", biomes: ["grove"], dropWeight: 0.4, passive: { strikePotencyAdd: 1 }, text: "A garden knife. Strikes hit for +1 potency." },
    ritualKnife: { name: "Ritual knife", slot: "tool", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { strikePotencyAdd: 2 }, text: "A ritual knife. Strikes hit for +2 potency." },
    fieldKnife: { name: "Field knife", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 1 }, text: "A field knife. Strikes hit for +1 potency." },
    sidearm: { name: "Sidearm", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 2 }, text: "A sidearm. Strikes hit for +2 potency." },
    servicePistol: { name: "Service pistol", slot: "tool", rarity: "uncommon", biomes: ["terrace"], dropWeight: 0.4, passive: { strikePotencyAdd: 2 }, text: "A service pistol. Strikes hit for +2 potency." },
    serviceRifle: { name: "Service rifle", slot: "tool", rarity: "rare", biomes: ["rim"], dropWeight: 0.4, passive: { strikePotencyAdd: 3, strikeRangeAdd: 1 }, text: "A service rifle. Strikes hit for +3 potency and reach one tile farther." },
    visitorSidearm: { name: "Visitor sidearm", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 2 }, text: "A visitor's sidearm. Strikes hit for +2 potency." },
    seaGun: { name: "Pressure gun", slot: "tool", rarity: "rare", biomes: ["wetland"], dropWeight: 0.4, passive: { strikePotencyAdd: 3 }, text: "A pressure gun. Strikes hit for +3 potency." },
    trident: { name: "Trident", slot: "tool", rarity: "rare", biomes: ["wetland"], dropWeight: 0.4, passive: { strikePotencyAdd: 3 }, text: "A trident. Strikes hit for +3 potency." },
    seaLance: { name: "Sea lance", slot: "tool", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, passive: { strikePotencyAdd: 2, strikeRangeAdd: 1 }, text: "A sea lance. Strikes hit for +2 potency and reach one tile farther." },
    frostLance: { name: "Frost lance", slot: "tool", rarity: "rare", biomes: ["rim"], dropWeight: 0.4, passive: { strikePotencyAdd: 3 }, text: "A frost lance. Strikes hit for +3 potency." },
    fieldBow: { name: "Field bow", slot: "tool", rarity: "rare", biomes: ["rim"], dropWeight: 0.4, passive: { strikePotencyAdd: 1, strikeRangeAdd: 2 }, text: "A field bow. Strikes hit for +1 potency and reach two tiles farther." },
    fishingRod: { name: "Fishing rod", slot: "tool", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, passive: { strikePotencyAdd: 1, strikeRangeAdd: 1 }, text: "A fishing rod, used as a reach weapon. Strikes hit for +1 potency and reach one tile farther." },
    fishSpear: { name: "Fish spear", slot: "tool", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, passive: { strikePotencyAdd: 2, strikeRangeAdd: 1 }, text: "A fishing spear. Strikes hit for +2 potency and reach one tile farther." },
    rainStaff: { name: "Rain staff", slot: "tool", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, passive: { strikePotencyAdd: 2 }, text: "A rain staff. Strikes hit for +2 potency." },
    shamanStaff: { name: "Shaman's staff", slot: "tool", rarity: "rare", biomes: ["grove"], dropWeight: 0.4, passive: { strikePotencyAdd: 3 }, text: "A shaman's staff. Strikes hit for +3 potency." },
    stoneAdze: { name: "Stone adze", slot: "tool", rarity: "common", biomes: ["grove"], dropWeight: 0.4, passive: { objectDamageMul: 1.4 }, text: "A stone adze. +40% damage to trees, hedges and site furniture." },
    rockHammer: { name: "Rock hammer", slot: "tool", rarity: "uncommon", biomes: ["quarry"], dropWeight: 0.4, passive: { groundDamageMul: 1.3, strikePotencyAdd: 1 }, text: "A rock hammer. +30% damage to cliffs and bridges, and Strikes hit for +1 potency." },
    trainerWhip: { name: "Trainer's whip", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 1, strikeRangeAdd: 1 }, text: "A trainer's whip. Strikes hit for +1 potency and reach one tile farther." },
    walkingCane: { name: "Weighted cane", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 1 }, text: "A weighted cane. Strikes hit for +1 potency." },
    thiefKnife: { name: "Slim knife", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 1 }, text: "A slim knife. Strikes hit for +1 potency." },
    pruningShears: { name: "Pruning shears", slot: "tool", rarity: "common", biomes: ["grove", "terrace"], dropWeight: 0.4, passive: { objectDamageMul: 1.45 }, text: "Pruning shears. +45% damage to trees, hedges and site furniture." },
    lockpicks: { name: "Lockpicks", slot: "tool", rarity: "uncommon", biomes: ["terrace"], dropWeight: 0.4, passive: { objectDamageMul: 1.25 }, text: "Lockpicks used as pries. +25% damage to trees, hedges and site furniture." },
    burledHandle: { name: "Burled handle", slot: "tool", rarity: "common", biomes: ["grove"], dropWeight: 0.4, passive: { objectDamageMul: 1.25 }, text: "A burled-wood handle on the work. +25% damage to trees, hedges and site furniture." },
    isotopeRifle: { name: "Isotope rifle", slot: "tool", rarity: "legendary", biomes: [], dropWeight: 0.35, passive: { strikePotencyAdd: 4, strikeRangeAdd: 1 }, text: "An isotope rifle. Strikes hit for +4 potency and reach one tile farther." },
    boardingRope: { name: "Boarding rope", slot: "tool", rarity: "uncommon", biomes: ["quarry", "grove"], dropWeight: 0.4, passive: { knockbackResist: 1 }, text: "A boarding rope. The first shove each battle doesn't move you." },
    spyglass: { name: "Spyglass", slot: "tool", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "+1 range on line deliveries." },
    starCompass: { name: "Star compass", slot: "tool", rarity: "rare", biomes: ["rim"], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "A star compass. +1 range on line deliveries." },
    tacGoggles: { name: "Field goggles", slot: "head", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "Tinted goggles. +1 range on line deliveries." },
    shadeGlasses: { name: "Shade glasses", slot: "head", rarity: "common", biomes: ["rim", "terrace"], dropWeight: 0.4, passive: { pfRegenAdd: 1 }, text: "+1 ΦF regen per turn." },
    starShades: { name: "Stage shades", slot: "head", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, passive: { pfRegenAdd: 1 }, text: "Stage shades. +1 ΦF regen per turn." },
    blossomCrown: { name: "Hawthorn crown", slot: "head", rarity: "rare", biomes: ["grove"], dropWeight: 0.4, passive: { maxLFAdd: 8, pfRegenAdd: 1 }, text: "A hawthorn crown. +8 max LF and +1 ΦF regen." },
    workApron: { name: "Work apron", slot: "body", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, passive: { maxLFAdd: 6 }, text: "A work apron. +6 max LF." },
    stageJacket: { name: "Stage jacket", slot: "body", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 10 }, text: "A stage jacket. +10 max LF." },
    glamJacket: { name: "Glam jacket", slot: "body", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 14 }, text: "A glam jacket. +14 max LF." },
    rainMantle: { name: "Rain mantle", slot: "body", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, passive: { floodShoveImmune: true }, text: "A rain mantle. Flash floods can't shove you." },
    fieldCoat: { name: "Field coat", slot: "body", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { channelDamageMul: { albedo: 0.88 } }, text: "A long coat. 12% less piercing (Albedo) damage." },
    reactorPack: { name: "Reactor pack", slot: "body", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 12, channelDamageMul: { citrinitas: 0.9 } }, text: "A reactor pack. +12 max LF and 10% less propagation (Citrinitas) damage." },
    kitBag: { name: "Kit bag", slot: "body", rarity: "common", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 6 }, text: "An equipment bag worn on the chest. +6 max LF." },
    patrolPack: { name: "Patrol pack", slot: "body", rarity: "uncommon", biomes: ["quarry"], dropWeight: 0.4, passive: { maxLFAdd: 8 }, text: "A patrol pack. +8 max LF." },
    plateShield: { name: "Plate shield", slot: "body", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { channelDamageMul: { nigredo: 0.82 } }, text: "A plate shield. 18% less impact (Nigredo) damage." },
    reefShield: { name: "Reef shield", slot: "body", rarity: "rare", biomes: ["wetland"], dropWeight: 0.4, passive: { channelDamageMul: { rubedo: 0.82 } }, text: "A reef shield. 18% less resonance (Rubedo) damage." },
    riotShield: { name: "Riot shield", slot: "body", rarity: "rare", biomes: ["terrace"], dropWeight: 0.4, passive: { channelDamageMul: { albedo: 0.84 } }, text: "A riot shield. 16% less piercing (Albedo) damage." },
    hullShield: { name: "Hull shield", slot: "body", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { channelDamageMul: { citrinitas: 0.84 } }, text: "A hull plate worn as a shield. 16% less propagation (Citrinitas) damage." },
    leafShield: { name: "Leaf shield", slot: "body", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { channelDamageMul: { nigredo: 0.9 } }, text: "A leaf-and-wood shield. 10% less impact (Nigredo) damage." },
    featherCape: { name: "Feather cape", slot: "body", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { maxLFAdd: 10, channelDamageMul: { rubedo: 0.92 } }, text: "A feather cape. +10 max LF and 8% less resonance (Rubedo) damage." },
    starPendant: { name: "Star pendant", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 15 }, text: "Start battles with 15% ultimate charge." },
    ringOrb: { name: "Ring orb", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 25 }, text: "Start battles with 25% ultimate charge." },
    glassTeardrop: { name: "Glass teardrop", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { pfRegenAdd: 1 }, text: "A glass teardrop. +1 ΦF regen per turn." },
    crystalShard: { name: "Crystal shard", slot: "charm", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, passive: { startingUltimateCharge: 15 }, text: "A crystal shard. Start battles with 15% ultimate charge." },
    prizeRibbon: { name: "Prize ribbon", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.06 }, text: "A prize ribbon. +6% XP." },
    wayCompass: { name: "Way-compass", slot: "charm", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "A way-compass. +1 range on line deliveries." },
    coinPurse: { name: "Coin purse", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.12 }, text: "A coin purse. +12% Seeds earned." },
    coinPile: { name: "Coin pile", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.18 }, text: "A pile of coins kept on you. +18% Seeds earned." },
    travelPurse: { name: "Travel purse", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.15 }, text: "A travel purse. +15% Seeds earned." },
    prayerBeads: { name: "Prayer beads", slot: "charm", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { summonDurationAdd: 1 }, text: "Prayer beads. Summons stay 1 turn longer." },
    bonePendant: { name: "Bone pendant", slot: "charm", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { startingUltimateCharge: 12 }, text: "A bone pendant. Start battles with 12% ultimate charge." },
    omenFeather: { name: "Omen feather", slot: "charm", rarity: "common", biomes: ["grove"], dropWeight: 0.4, passive: { pfRegenAdd: 1 }, text: "An omen feather. +1 ΦF regen per turn." },
    cutGem: { name: "Cut gem", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.2 }, text: "A cut gem. +20% Seeds earned." },
    gemChain: { name: "Gem chain", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 8 }, text: "A gem on a chain. +8 max LF." },
    rainCharm: { name: "Rain charm", slot: "charm", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, passive: { channelDamageMul: { rubedo: 0.9 } }, text: "A rain charm. 10% less resonance (Rubedo) damage." },
    templeBell: { name: "Temple bell", slot: "charm", rarity: "common", biomes: ["wetland"], dropWeight: 0.4, passive: { pfRegenAdd: 1 }, text: "A small temple bell. +1 ΦF regen per turn." },
    marketBell: { name: "Market bell", slot: "charm", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, passive: { seedsMul: 1.08 }, text: "A market bell. +8% Seeds earned." },
    inkQuill: { name: "Ink quill", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.1 }, text: "An ink quill. +10% XP." },
    deskFeather: { name: "Desk feather", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.05 }, text: "A desk feather. +5% XP." },
    dogTags: { name: "Dog tags", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 6 }, text: "Dog tags. +6 max LF." },
    fieldBadge: { name: "Field badge", slot: "charm", rarity: "rare", biomes: ["terrace"], dropWeight: 0.4, passive: { questionHint: 1 }, text: "A field badge. Summon questions remove one wrong choice." },
    stagePass: { name: "Stage pass", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.05 }, text: "A stage pass. +5% XP." },
    lightStick: { name: "Light stick", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 12 }, text: "A light stick. Start battles with 12% ultimate charge." },
    songbook: { name: "Songbook", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.1 }, text: "A songbook. +10% XP." },
    lyricBook: { name: "Lyric book", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.12 }, text: "A lyric notebook. +12% XP." },
    pocketMirror: { name: "Pocket mirror", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { pfRegenAdd: 1 }, text: "A pocket mirror. +1 ΦF regen per turn." },
    houseTrophy: { name: "House trophy", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.15 }, text: "A house trophy. +15% XP." },
    stemRoses: { name: "Stem roses", slot: "charm", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { maxLFAdd: 6 }, text: "Stem roses pinned on. +6 max LF." },
    vintageMic: { name: "Vintage microphone", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 12 }, text: "A vintage microphone. Start battles with 12% ultimate charge." },
    saxophone: { name: "Saxophone", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 20 }, text: "A saxophone. Start battles with 20% ultimate charge." },
    practiceMute: { name: "Practice mute", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.05 }, text: "A practice mute. +5% XP." },
    chartStand: { name: "Chart stand", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.08 }, text: "A music stand's chart. +8% XP." },
    waxRecord: { name: "Wax record", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 10 }, text: "A wax record. Start battles with 10% ultimate charge." },
    ninjaPouch: { name: "Ninja pouch", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.1 }, text: "A ninja's pouch. +10% Seeds earned." },
    wardTalisman: { name: "Ward talisman", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { summonDurationAdd: 1, startingUltimateCharge: 10 }, text: "A ward talisman. Summons stay 1 turn longer, and battles start at 10% ultimate charge." },
    watchCrow: { name: "Watching crow", slot: "charm", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "A watching crow. +1 range on line deliveries." },
    blossomOrb: { name: "Hawthorn orb", slot: "charm", rarity: "rare", biomes: ["grove"], dropWeight: 0.4, passive: { startingUltimateCharge: 20 }, text: "A hawthorn orb. Start battles with 20% ultimate charge." },
    abyssalRelic: { name: "Abyssal relic", slot: "charm", rarity: "legendary", biomes: ["wetland"], dropWeight: 0.35, passive: { surviveLethalOnce: true }, text: "Once per battle, survive a lethal hit at 1 LF." },
    cornPouch: { name: "Corn pouch", slot: "charm", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, passive: { seedsMul: 1.08 }, text: "A seed pouch of corn. +8% Seeds earned." },
    monkeyPouch: { name: "Trainer's pouch", slot: "charm", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { seedsMul: 1.1 }, text: "A trainer's pouch. +10% Seeds earned." },
    hedgePouch: { name: "Hedge pouch", slot: "charm", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { seedsMul: 1.08 }, text: "A hedge pouch. +8% Seeds earned." },
    rainPouch: { name: "Rain pouch", slot: "charm", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, passive: { seedsMul: 1.08 }, text: "A rain pouch. +8% Seeds earned." },
    libSatchel: { name: "Library satchel", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.08 }, text: "A library satchel. +8% XP." },
    lootBag: { name: "Loot bag", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.1 }, text: "A loot bag. +10% Seeds earned." },
    offeringBowl: { name: "Offering bowl", slot: "charm", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { pfRegenAdd: 1 }, text: "An offering bowl. +1 ΦF regen per turn." },
    marketBasket: { name: "Market basket", slot: "charm", rarity: "common", biomes: ["terrace"], dropWeight: 0.4, passive: { seedsMul: 1.06 }, text: "A market basket. +6% Seeds earned." },
    mortarPestle: { name: "Mortar and pestle", slot: "charm", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { xpMul: 1.08 }, text: "A mortar and pestle. +8% XP." },

    // Jinki cloth (J3): streetwear workhorses, dual-state sprites (dmg+resto).
    rippedTee: { name: "Ripped tee", slot: "body", rarity: "common", biomes: [], dropWeight: 0.4, dual: true, passive: { maxLFAdd: 4 }, text: "A ripped tee. +4 max LF." },
    stainedHoodie: { name: "Stained hoodie", slot: "body", rarity: "common", biomes: [], dropWeight: 0.4, dual: true, passive: { maxLFAdd: 6 }, text: "A stained hoodie. +6 max LF." },
    patchedJacket: { name: "Patched jacket", slot: "body", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { channelDamageMul: { nigredo: 0.9 } }, text: "A patched jacket. 10% less impact (Nigredo) damage." },
    frayedScarf: { name: "Frayed scarf", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, dual: true, passive: { pfRegenAdd: 1 }, text: "A frayed scarf. +1 ΦF regen per turn." },
    shreddedJeans: { name: "Shredded jeans", slot: "body", rarity: "common", biomes: [], dropWeight: 0.4, dual: true, passive: { moveCostMul: 0.95 }, text: "Shredded jeans. Movement costs 5% fewer action points." },
    bustedSneakers: { name: "Busted sneakers", slot: "feet", rarity: "common", biomes: [], dropWeight: 0.4, dual: true, passive: { moveCostMul: 0.9 }, text: "Busted sneakers. Movement costs 10% fewer action points." },
    crackedBoots: { name: "Cracked boots", slot: "feet", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { hazardImmune: true }, text: "Cracked boots. Entry hazards don't hurt." },
    tornGloves: { name: "Torn gloves", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, dual: true, passive: { strikePotencyAdd: 1 }, text: "Torn gloves. Strikes hit for +1 potency." },
    mothEatenCoat: { name: "Moth-eaten coat", slot: "body", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { maxLFAdd: 8 }, text: "A moth-eaten coat. +8 max LF." },
    soakedDress: { name: "Soaked dress", slot: "body", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { glamourAdd: 1, floodShoveImmune: true }, text: "A soaked dress. +1 glamour; flash floods can't shove you." },

    // Jinki equip (J3): the fantasy arsenal, dual-state sprites (dmg+resto).
    busterSword: { name: "Buster sword", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { strikePotencyAdd: 3 }, text: "A buster sword. Strikes hit for +3 potency." },
    keyblade: { name: "Keyblade", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { strikePotencyAdd: 2, pfRegenAdd: 1 }, text: "A keyblade. Strikes hit for +2 potency; +1 ΦF regen per turn." },
    powerPole: { name: "Power pole", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { strikePotencyAdd: 1, strikeRangeAdd: 2 }, text: "A power pole. Strikes hit for +1 potency and reach two tiles farther." },
    chakram: { name: "Chakram", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { strikePotencyAdd: 2, strikeRangeAdd: 1 }, text: "A chakram. Strikes hit for +2 potency and reach one tile farther." },
    twinBlades: { name: "Twin blades", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { strikePotencyAdd: 3 }, text: "Twin blades. Strikes hit for +3 potency." },
    herosScarf: { name: "Hero's scarf", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { startingUltimateCharge: 10 }, text: "A hero's scarf. Start battles with 10% ultimate charge." },
    sorcererHat: { name: "Sorcerer's hat", slot: "head", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { pfRegenAdd: 2 }, text: "A sorcerer's hat. +2 ΦF regen per turn." },
    crown: { name: "Crown", slot: "head", rarity: "legendary", biomes: [], dropWeight: 0.4, dual: true, passive: { glamourAdd: 4, legitimacyAdd: 2, startingUltimateCharge: 10 }, text: "A crown. +4 glamour, +2 legitimacy; start battles with 10% ultimate charge." },
    circlet: { name: "Circlet", slot: "head", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { glamourAdd: 3, questionHint: 1 }, text: "A circlet. +3 glamour; summon questions remove one wrong choice." },
    hood: { name: "Hood", slot: "head", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { maxLFAdd: 6, pfRegenAdd: 1 }, text: "A hood. +6 max LF; +1 ΦF regen per turn." },
    leatherJacket: { name: "Leather jacket", slot: "body", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { channelDamageMul: { nigredo: 0.88 } }, text: "A leather jacket. 12% less impact (Nigredo) damage." },
    mysticRobe: { name: "Mystic robe", slot: "body", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { channelDamageMul: { citrinitas: 0.85 }, pfRegenAdd: 1 }, text: "A mystic robe. 15% less propagation (Citrinitas) damage; +1 ΦF regen per turn." },
    knightArmor: { name: "Knight armor", slot: "body", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { channelDamageMul: { albedo: 0.82 }, maxLFAdd: 8 }, text: "Knight armor. 18% less piercing (Albedo) damage; +8 max LF." },
    battleVest: { name: "Battle vest", slot: "body", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { maxLFAdd: 12 }, text: "A battle vest. +12 max LF." },
    robeOfLight: { name: "Robe of light", slot: "body", rarity: "legendary", biomes: [], dropWeight: 0.4, dual: true, passive: { channelDamageMul: { citrinitas: 0.8 }, glamourAdd: 3, legitimacyAdd: 1 }, text: "A robe of light. 20% less propagation (Citrinitas) damage; +3 glamour, +1 legitimacy." },
    adventurerPants: { name: "Adventurer pants", slot: "body", rarity: "common", biomes: [], dropWeight: 0.4, dual: true, passive: { maxLFAdd: 6 }, text: "Adventurer pants. +6 max LF." },
    monkPants: { name: "Monk pants", slot: "body", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { moveCostMul: 0.85 }, text: "Monk pants. Movement costs 15% fewer action points." },
    knightGreaves: { name: "Knight greaves", slot: "body", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { fallDamageMul: 0.5, maxLFAdd: 4 }, text: "Knight greaves. Fall damage halved; +4 max LF." },
    streetPants: { name: "Street pants", slot: "body", rarity: "common", biomes: [], dropWeight: 0.4, dual: true, passive: { moveCostMul: 0.9 }, text: "Street pants. Movement costs 10% fewer action points." },
    royalSlacks: { name: "Royal slacks", slot: "body", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { glamourAdd: 3, legitimacyAdd: 1 }, text: "Royal slacks. +3 glamour, +1 legitimacy." },
    travelerBoots: { name: "Traveler boots", slot: "feet", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { moveCostMul: 0.85 }, text: "Traveler boots. Movement costs 15% fewer action points." },
    skyBoots: { name: "Sky boots", slot: "feet", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { fallDamageMul: 0.4, moveCostMul: 0.9 }, text: "Sky boots. 60% less fall damage; movement costs 10% fewer action points." },
    combatBoots: { name: "Combat boots", slot: "feet", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { hazardImmune: true }, text: "Combat boots. Entry hazards don't hurt." },
    sandals: { name: "Sandals", slot: "feet", rarity: "common", biomes: [], dropWeight: 0.4, dual: true, passive: { moveCostMul: 0.95 }, text: "Sandals. Movement costs 5% fewer action points." },
    royalShoes: { name: "Royal shoes", slot: "feet", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { glamourAdd: 3, moveCostMul: 0.9 }, text: "Royal shoes. +3 glamour; movement costs 10% fewer action points." },
    earrings: { name: "Earrings", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { glamourAdd: 2, pfRegenAdd: 1 }, text: "Earrings. +2 glamour; +1 ΦF regen per turn." },
    necklace: { name: "Necklace", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { glamourAdd: 3, maxLFAdd: 6 }, text: "A necklace. +3 glamour, +6 max LF." },
    ring: { name: "Ring", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { startingUltimateCharge: 20 }, text: "A ring. Start battles with 20% ultimate charge." },
    belt: { name: "Belt", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, dual: true, passive: { maxLFAdd: 10 }, text: "A belt. +10 max LF." },
    capeCloak: { name: "Cape cloak", slot: "body", rarity: "rare", biomes: [], dropWeight: 0.4, dual: true, passive: { glamourAdd: 3, channelDamageMul: { rubedo: 0.9 } }, text: "A cape cloak. +3 glamour; 10% less resonance (Rubedo) damage." },

    // Jinki Ramayana (J3): mythics, SINGLE-state sprites (resto always + dim).
    // questOnly: the epics are EARNED — never random drops, never shop stock.
    chefKnives: { name: "Chef Knives", slot: "tool", rarity: "rare", biomes: [], questOnly: true, carriedBy: ["chef"], passive: { cookApOverride: 5, strikeBleed: { drain: 2, turns: 2 } }, text: "A cook's roll of knives. Cooking in battle costs 5 AP, and your Strikes open a bleeding wound (2 LF a turn for 2 turns; it does not stack)." },
    kodandaBow: { name: "Kodanda bow", slot: "tool", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["rama"], passive: { strikePotencyAdd: 3, strikeRangeAdd: 2 }, text: "Rama's bow. Strikes hit for +3 potency and reach two tiles farther." },
    brahmastraArrow: { name: "Brahmastra arrow", slot: "tool", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["indrajit"], passive: { strikePotencyAdd: 4, strikeRangeAdd: 1 }, text: "The Brahmastra. Strikes hit for +4 potency and reach one tile farther." },
    ayodhyaQuiver: { name: "Ayodhya quiver", slot: "tool", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["rama", "lakshmana"], passive: { strikeRangeAdd: 2, startingUltimateCharge: 10 }, text: "Ayodhya's quiver. Strikes reach two tiles farther; start battles with 10% ultimate charge." },
    lakshmanaBow: { name: "Lakshmana bow", slot: "tool", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["lakshmana"], passive: { strikePotencyAdd: 2, strikeRangeAdd: 2 }, text: "Lakshmana's bow. Strikes hit for +2 potency and reach two tiles farther." },
    hanumanGada: { name: "Hanuman gada", slot: "tool", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["hanuman"], passive: { strikePotencyAdd: 4 }, text: "Hanuman's mace. Strikes hit for +4 potency." },
    lankaDagger: { name: "Lanka dagger", slot: "tool", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["kumbhakarna"], passive: { strikePotencyAdd: 3 }, text: "A dagger from Lanka's armory. Strikes hit for +3 potency." },
    vanaraWarBanner: { name: "Vanara war banner", slot: "tool", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["hanuman", "jambavan"], passive: { startingUltimateCharge: 25, legitimacyAdd: 1 }, text: "The Vanara war banner. Start battles with 25% ultimate charge; +1 legitimacy." },
    sitaChudamani: { name: "Sita chudamani", slot: "head", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["sita"], passive: { glamourAdd: 5, pfRegenAdd: 2 }, text: "Sita's hair-jewel. +5 glamour; +2 ΦF regen per turn." },
    wizardCodex: { name: "Wizard's codex", slot: "tool", rarity: "rare", biomes: [], questOnly: true, carriedBy: ["wizard"], passive: { maxPFAdd: 5, freeObservePerTurn: 1 }, text: "The wizard's working book. +5 max ΦF; one free Observe each turn." },
    mithilaVeil: { name: "Mithila veil", slot: "head", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["sita"], passive: { glamourAdd: 3, legitimacyAdd: 1 }, text: "A veil from Mithila. +3 glamour, +1 legitimacy." },
    royalCrown: { name: "Royal crown", slot: "head", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["rama"], passive: { glamourAdd: 5, legitimacyAdd: 3 }, text: "The royal crown of Ayodhya. +5 glamour, +3 legitimacy." },
    ravanaCrown: { name: "Ravana crown", slot: "head", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["ravana"], passive: { glamourAdd: 4, startingUltimateCharge: 20, questionHint: 1 }, text: "Ravana's crown. +4 glamour; start battles with 20% ultimate charge; summon questions remove one wrong choice." },
    ramaPaduka: { name: "Rama paduka", slot: "feet", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["rama"], passive: { moveCostMul: 0.8, fallDamageMul: 0.5 }, text: "Rama's sandals. Movement costs 20% fewer action points; fall damage halved." },
    ramaSignetRing: { name: "Rama signet ring", slot: "charm", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["rama"], passive: { legitimacyAdd: 3, seedsMul: 1.15 }, text: "Rama's signet. +3 legitimacy; +15% Seeds earned." },
    vanaraArmguard: { name: "Vanara armguard", slot: "charm", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["jambavan"], passive: { channelDamageMul: { nigredo: 0.82 } }, text: "A Vanara armguard. 18% less impact (Nigredo) damage." },
    sanjeevaniSatchel: { name: "Sanjeevani satchel", slot: "charm", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["hanuman"], passive: { maxLFAdd: 20, pfRegenAdd: 2 }, text: "The life-herb satchel. +20 max LF; +2 ΦF regen per turn." },
    goldenDeerCharm: { name: "Golden deer charm", slot: "charm", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["ravana", "surpanakha"], passive: { seedsMul: 1.2, glamourAdd: 2 }, text: "The golden deer. +20% Seeds earned; +2 glamour." },
    pushpakaEmblem: { name: "Pushpaka emblem", slot: "charm", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["ravana"], passive: { summonDurationAdd: 2, startingUltimateCharge: 15 }, text: "The Pushpaka's emblem. Summons stay 2 turns longer; start battles with 15% ultimate charge." },
    nagaPashaCoil: { name: "Naga pasha coil", slot: "charm", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["indrajit"], passive: { knockbackResist: 1, strikeRangeAdd: 1 }, text: "A coil of the Naga noose. The first shove each battle doesn't move you; strikes reach one tile farther." },
    ashokaAnklet: { name: "Ashoka anklet", slot: "charm", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["sita"], passive: { glamourAdd: 3, moveCostMul: 0.9 }, text: "An anklet from the Ashoka grove. +3 glamour; movement costs 10% fewer action points." },
    oceanBridgeTalisman: { name: "Ocean bridge talisman", slot: "charm", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["hanuman", "jambavan"], passive: { floodShoveImmune: true, hazardImmune: true }, text: "A stone from the ocean bridge. Flash floods can't shove you; entry hazards don't hurt." },

    // Midjourney legendary I (2026-10-27, MJ build): single-state icons. weapon kinds staged for docs/weapon-strikes.md (inert until the engine reads a.weapon).
    glacialGreatsword: { name: "Glacial greatsword", slot: "tool", rarity: "rare", biomes: ["rim"], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 3 }, text: "A greatsword of glacier ice. Strikes hit for +3 potency." },
    pinkPillarBlade: { name: "Pink pillar blade", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A pillar of rose quartz, edged. Strikes hit for +2 potency." },
    amethystPillarBlade: { name: "Amethyst pillar blade", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 3 }, text: "A pillar of amethyst, edged. Strikes hit for +3 potency." },
    frostShardBlade: { name: "Frost shard blade", slot: "tool", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A blade knapped from frost. Strikes hit for +2 potency." },
    phoenixWand: { name: "Phoenix wand", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { strikePotencyAdd: 2, startingUltimateCharge: 10 }, text: "A phoenix-feather wand. Strikes hit for +2 potency; start battles with 10% ultimate charge." },
    bronzeOniMask: { name: "Bronze oni mask", slot: "head", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 8, glamourAdd: 2 }, text: "A bronze oni mask. +8 max LF; +2 glamour. It frightens politely." },
    goldSkullMask: { name: "Gold skull mask", slot: "head", rarity: "legendary", biomes: [], dropWeight: 0.35, passive: { maxLFAdd: 10, glamourAdd: 3, legitimacyAdd: 3 }, text: "A skull in gold. +10 max LF; +3 glamour, +3 legitimacy. Death, gilded." },
    emeraldAmulet: { name: "Emerald amulet", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 8 }, text: "An emerald amulet. +8 max LF." },
    voidMoth: { name: "Void moth", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 12 }, text: "A moth that drinks the dark. Start battles with 12% ultimate charge." },
    whiteSkull: { name: "White skull", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 6 }, text: "A small white skull. +6 max LF. Memento." },
    violetOrb: { name: "Violet orb", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 12 }, text: "A violet orb. Start battles with 12% ultimate charge." },
    shortBow: { name: "Short bow", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "bow" }, passive: { strikePotencyAdd: 1, strikeRangeAdd: 1 }, text: "A short bow. Strikes hit for +1 potency and reach one tile farther." },
    crystalHeart: { name: "Crystal heart", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 14 }, text: "A heart of crystal. +14 max LF." },
    prismMoth: { name: "Prism moth", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 20 }, text: "A moth of split light. Start battles with 20% ultimate charge." },
    frostSword: { name: "Frost sword", slot: "tool", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A frost-rimed sword. Strikes hit for +2 potency." },
    ghostBlade: { name: "Ghost blade", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 3 }, text: "A blade that is mostly rumor. Strikes hit for +3 potency." },
    flameSword: { name: "Flame sword", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2, channelDealtMul: { citrinitas: 1.1 } }, text: "A sword that burns. Strikes hit for +2 potency; spreading (Citrinitas) damage +10%." },
    venomDagger: { name: "Venom dagger", slot: "tool", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A venom-green dagger. Strikes hit for +2 potency." },
    sunSigil: { name: "Sun sigil", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 20 }, text: "A sigil of the sun. Start battles with 20% ultimate charge." },
    tealBanner: { name: "Teal banner", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 20, legitimacyAdd: 1 }, text: "A teal war banner. Start battles with 20% ultimate charge; +1 legitimacy." },
    voidLantern: { name: "Void lantern", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { lineRangeAdd: 1, pfRegenAdd: 1 }, text: "A lantern on the dark. +1 range on line deliveries; +1 ΦF regen per turn." },
    violetGreatsword: { name: "Violet greatsword", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 3 }, text: "A violet greatsword. Strikes hit for +3 potency." },
    crossedFlamberge: { name: "Crossed flamberge", slot: "tool", rarity: "legendary", biomes: [], dropWeight: 0.35, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 4 }, text: "Twin waved blades, crossed. Strikes hit for +4 potency." },
    silverSword: { name: "Silver sword", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A plain silver sword. Strikes hit for +2 potency." },
    runeShortsword: { name: "Rune shortsword", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 1, pfRegenAdd: 1 }, text: "A rune-etched shortsword. Strikes hit for +1 potency; +1 ΦF regen per turn." },
    firebirdBlade: { name: "Firebird blade", slot: "tool", rarity: "legendary", biomes: [], dropWeight: 0.35, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 4, channelDealtMul: { citrinitas: 1.1 } }, text: "A blade with firebird wings. Strikes hit for +4 potency; spreading (Citrinitas) damage +10%." },
    prismWings: { name: "Prism wings", slot: "charm", rarity: "legendary", biomes: [], dropWeight: 0.35, passive: { moveCostMul: 0.8, maxLFAdd: 10 }, text: "Wings of split light, worn short of flight. Movement costs 20% fewer action points; +10 max LF." },
    emeraldLocket: { name: "Emerald locket", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 8 }, text: "An emerald locket. +8 max LF." },
    brassBeetle: { name: "Brass beetle", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.08 }, text: "A lucky brass beetle. +8% Seeds earned." },
    ghostOrb: { name: "Ghost orb", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { pfRegenAdd: 1, startingUltimateCharge: 10 }, text: "A haunted orb. +1 ΦF regen per turn; start battles with 10% ultimate charge." },
    rubyBrooch: { name: "Ruby brooch", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { glamourAdd: 3, maxLFAdd: 6 }, text: "A ruby brooch. +3 glamour, +6 max LF." },
    amberFrog: { name: "Amber frog", slot: "charm", rarity: "common", biomes: ["wetland"], dropWeight: 0.4, passive: { xpMul: 1.05 }, text: "A frog in amber. +5% XP. It watched everything." },
    jadeFrog: { name: "Jade frog", slot: "charm", rarity: "common", biomes: ["wetland"], dropWeight: 0.4, passive: { seedsMul: 1.06 }, text: "A jade frog. +6% Seeds earned. It found everything." },
    copperSkull: { name: "Copper skull", slot: "head", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 8 }, text: "A copper skull cap. +8 max LF." },
    sapphireSkull: { name: "Sapphire skull", slot: "head", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 10, pfRegenAdd: 1 }, text: "A sapphire-set skull. +10 max LF; +1 ΦF regen per turn." },

    // Midjourney legendary II (2026-10-27, MJ build): single-state icons. weapon kinds staged for docs/weapon-strikes.md.
    steelLongsword: { name: "Steel longsword", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A steel longsword. Strikes hit for +2 potency." },
    violetBlade: { name: "Violet blade", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A violet-tempered blade. Strikes hit for +2 potency." },
    crescentAxe: { name: "Crescent axe", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 3 }, text: "A crescent-headed axe. Strikes hit for +3 potency." },
    pinkCrystalSword: { name: "Pink crystal sword", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 3 }, text: "A sword of pink crystal. Strikes hit for +3 potency." },
    fryingPan: { name: "Frying pan", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 1 }, text: "A frying pan. Strikes hit for +1 potency. Dinner is later." },
    blueBuckler: { name: "Blue buckler", slot: "body", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 8, channelDamageMul: { albedo: 0.9 } }, text: "A blue buckler. +8 max LF; 10% less piercing (Albedo) damage." },
    sledgeHammer: { name: "Sledgehammer", slot: "tool", rarity: "uncommon", biomes: ["quarry"], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 2 }, text: "A sledgehammer. Strikes hit for +2 potency." },
    crystalSpear: { name: "Crystal spear", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "polearm" }, passive: { strikePotencyAdd: 1, strikeRangeAdd: 1 }, text: "A crystal-tipped spear. Strikes hit for +1 potency and reach one tile farther." },
    bellowsSack: { name: "Bellows sack", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.08 }, text: "A bellows sack that breathes coins. +8% Seeds earned." },
    violetCrystalSword: { name: "Violet crystal sword", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 3 }, text: "A sword of violet crystal. Strikes hit for +3 potency." },
    chitinClaw: { name: "Chitin claw", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A claw of black chitin. Strikes hit for +2 potency." },
    frostRing: { name: "Frost ring", slot: "charm", rarity: "rare", biomes: ["rim"], dropWeight: 0.4, passive: { channelDamageMul: { albedo: 0.85 } }, text: "A ring of never-melting frost. 15% less piercing (Albedo) damage." },
    whiteArmingSword: { name: "White arming sword", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 1 }, text: "A white arming sword. Strikes hit for +1 potency." },
    pinkClub: { name: "Pink club", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 1 }, text: "A pink club. Strikes hit for +1 potency." },
    emberScepter: { name: "Ember scepter", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 2 }, text: "A scepter of banked embers. Strikes hit for +2 potency." },
    skinningKnife: { name: "Skinning knife", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 1 }, text: "A skinning knife. Strikes hit for +1 potency." },
    purpleCleaver: { name: "Purple cleaver", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A purple cleaver. Strikes hit for +2 potency." },
    roseStaff: { name: "Rose staff", slot: "tool", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 2 }, text: "A rosewood staff. Strikes hit for +2 potency." },
    graySpear: { name: "Gray spear", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "polearm" }, passive: { strikePotencyAdd: 1 }, text: "A gray spear. Strikes hit for +1 potency." },
    wheelRelic: { name: "Wheel relic", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 12 }, text: "A relic wheel, always turning. Start battles with 12% ultimate charge." },
    spiderBot: { name: "Spider bot", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { lineRangeAdd: 1, maxLFAdd: 6 }, text: "A spider-bot scout. +1 range on line deliveries; +6 max LF." },
    quarterStaff: { name: "Quarterstaff", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 1 }, text: "A quarterstaff. Strikes hit for +1 potency." },
    crossMace: { name: "Cross mace", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 2 }, text: "A cross-headed mace. Strikes hit for +2 potency." },
    brassGoggles: { name: "Brass goggles", slot: "head", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "Brass goggles. +1 range on line deliveries." },
    redMace: { name: "Red mace", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 3 }, text: "A red-hot mace. Strikes hit for +3 potency." },
    stoneTablet: { name: "Stone tablet", slot: "charm", rarity: "uncommon", biomes: ["quarry"], dropWeight: 0.4, passive: { xpMul: 1.08 }, text: "A tablet of old lessons. +8% XP." },
    baton: { name: "Baton", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 1 }, text: "A baton. Strikes hit for +1 potency." },
    boneSkewer: { name: "Bone skewer", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "thrown" }, passive: { strikePotencyAdd: 1 }, text: "A bone skewer, made to throw. Strikes hit for +1 potency." },
    brassHelm: { name: "Brass helm", slot: "head", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 6, pfRegenAdd: 1 }, text: "A brass helm. +6 max LF; +1 ΦF regen per turn." },
    crabRock: { name: "Crab-rock shell", slot: "charm", rarity: "uncommon", biomes: ["wetland"], dropWeight: 0.4, passive: { channelDamageMul: { nigredo: 0.9 } }, text: "A crab's rock shell. 10% less impact (Nigredo) damage." },
    dragonEgg: { name: "Dragon egg", slot: "charm", rarity: "legendary", biomes: [], dropWeight: 0.35, passive: { maxLFAdd: 15, startingUltimateCharge: 15 }, text: "A dragon egg, warm with maybe. +15 max LF; start battles with 15% ultimate charge." },
    boltThrower: { name: "Bolt thrower", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "bow" }, passive: { strikePotencyAdd: 1, strikeRangeAdd: 1 }, text: "A bolt thrower. Strikes hit for +1 potency and reach one tile farther." },
    iceMace: { name: "Ice mace", slot: "tool", rarity: "rare", biomes: ["rim"], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 3 }, text: "A mace of never-melting ice. Strikes hit for +3 potency." },
    pinkCrescent: { name: "Pink crescent", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 12 }, text: "A pink crescent moon. Start battles with 12% ultimate charge." },
    darkKnot: { name: "Dark knot", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.05 }, text: "A knot no one can untie. +5% XP. Think about it." },
    redRock: { name: "Ember stone", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { pfRegenAdd: 1 }, text: "An ember that never cools. +1 ΦF regen per turn." },
    redSpoon: { name: "Red spoon", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 1 }, text: "A red spoon, for stirring trouble. Strikes hit for +1 potency." },
    sheathedBlade: { name: "Sheathed blade", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A blade that stays sheathed until it matters. Strikes hit for +2 potency." },
    blueShortsword: { name: "Blue shortsword", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 1 }, text: "A blue shortsword. Strikes hit for +1 potency." },
    lensStaff: { name: "Lens staff", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { lineRangeAdd: 1, startingUltimateCharge: 10 }, text: "A staff with a seeing lens. +1 range on line deliveries; start battles with 10% ultimate charge." },
    orbStaff: { name: "Orb staff", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 1, pfRegenAdd: 1 }, text: "A staff topped with an orb. Strikes hit for +1 potency; +1 ΦF regen per turn." },
    birdSkull: { name: "Bird skull", slot: "charm", rarity: "uncommon", biomes: ["grove"], dropWeight: 0.4, passive: { xpMul: 1.08 }, text: "A bird skull. +8% XP. It flew everywhere once." },
    warFan: { name: "War fan", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A war fan with bladed ribs. Strikes hit for +2 potency." },
    violetMallet: { name: "Violet mallet", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 2 }, text: "A violet mallet. Strikes hit for +2 potency." },
    monocleStaff: { name: "Monocle staff", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 1, questionHint: 1 }, text: "A staff with a monocle lens. Strikes hit for +1 potency; summon questions remove one wrong choice." },
    eyeRelic: { name: "Eye relic", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { lineRangeAdd: 1, questionHint: 1 }, text: "A relic eye that never blinks. +1 range on line deliveries; summon questions remove one wrong choice." },
    crystalTorch: { name: "Crystal torch", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 1, channelDealtMul: { citrinitas: 1.1 } }, text: "A torch of burning crystal. Strikes hit for +1 potency; spreading (Citrinitas) damage +10%." },
    brassCompass: { name: "Brass compass", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.1 }, text: "A compass that points at money. +10% Seeds earned." },
    blueEye: { name: "Blue eye", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { questionHint: 1, pfRegenAdd: 1 }, text: "A calm blue eye. Summon questions remove one wrong choice; +1 ΦF regen per turn." },
    brassLantern: { name: "Brass lantern", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "A brass lantern. +1 range on line deliveries. Hold it high." },
    brassRing: { name: "Brass ring", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.08 }, text: "A plain brass ring. +8% Seeds earned." },
    brownBoulder: { name: "Brown boulder", slot: "charm", rarity: "common", biomes: ["quarry"], dropWeight: 0.4, passive: { maxLFAdd: 6 }, text: "A pebble off a brown boulder. +6 max LF. Part of something bigger." },
    fireRing: { name: "Fire ring", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { channelDealtMul: { citrinitas: 1.15 } }, text: "A ring of bound fire. Spreading (Citrinitas) damage +15%." },

    // Midjourney objects III (2026-10-27, MJ build): single-state icons. weapon kinds staged for docs/weapon-strikes.md.
    vialStaff: { name: "Vial staff", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 1 }, text: "A staff with a vial lashed on. Strikes hit for +1 potency." },
    crescentScythe: { name: "Crescent scythe", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 3 }, text: "A crescent scythe. Strikes hit for +3 potency." },
    telescopicScope: { name: "Telescopic scope", slot: "tool", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "A telescopic scope. +1 range on line deliveries." },
    emberBaton: { name: "Ember baton", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 2 }, text: "An ember-tipped baton. Strikes hit for +2 potency." },
    rifleKit: { name: "Rifle kit", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "gun" }, passive: { strikePotencyAdd: 3, strikeRangeAdd: 1 }, text: "A rifle with its capsule and cleaning cloth. Strikes hit for +3 potency and reach one tile farther." },
    pressureSphere: { name: "Pressure sphere", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 8 }, text: "A riveted pressure sphere. +8 max LF. It holds." },
    brainJar: { name: "Brain jar", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { questionHint: 1, xpMul: 1.08 }, text: "A brain in a brass jar. Summon questions remove one wrong choice; +8% XP." },
    flintlockPistol: { name: "Flintlock pistol", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "gun" }, passive: { strikePotencyAdd: 2 }, text: "A flintlock pistol. Strikes hit for +2 potency." },
    handAxe: { name: "Hand axe", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 1 }, text: "A hand axe. Strikes hit for +1 potency." },
    ghostKnife: { name: "Ghost knife", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "thrown" }, passive: { strikePotencyAdd: 1 }, text: "A ghost of a knife, made to throw. Strikes hit for +1 potency." },
    signalBox: { name: "Signal box", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "A signal box. +1 range on line deliveries. Wave it high." },
    assaultRifle: { name: "Assault rifle", slot: "tool", rarity: "rare", biomes: [], dropWeight: 0.4, weapon: { kind: "gun" }, passive: { strikePotencyAdd: 3, strikeRangeAdd: 1 }, text: "An assault rifle. Strikes hit for +3 potency and reach one tile farther." },
    podLantern: { name: "Pod lantern", slot: "charm", rarity: "common", biomes: ["grove"], dropWeight: 0.4, passive: { pfRegenAdd: 1 }, text: "A lantern grown from a pod. +1 ΦF regen per turn." },
    trinketEgg: { name: "Trinket egg", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.08 }, text: "A jeweled egg. +8% XP. Something inside is learning." },
    machete: { name: "Machete", slot: "tool", rarity: "common", biomes: ["grove"], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 1 }, text: "A machete. Strikes hit for +1 potency." },
    canvasSack: { name: "Canvas sack", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.08 }, text: "A canvas sack. +8% Seeds earned. It carries." },
    sentryEye: { name: "Sentry eye", slot: "head", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "A sentry eye that rides your brow. +1 range on line deliveries." },
    pocketCompass: { name: "Pocket compass", slot: "charm", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "A pocket compass. +1 range on line deliveries. It knows the way." },
    redTome: { name: "Red tome", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { xpMul: 1.1 }, text: "A red tome, read twice. +10% XP." },
    frostCleaver: { name: "Frost cleaver", slot: "tool", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A frost-edged cleaver. Strikes hit for +2 potency." },
    brassSpyglass: { name: "Brass spyglass", slot: "tool", rarity: "uncommon", biomes: ["rim"], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "A brass spyglass. +1 range on line deliveries." },
    forkedSpear: { name: "Forked spear", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "polearm" }, passive: { strikePotencyAdd: 2, strikeRangeAdd: 1 }, text: "A forked spear. Strikes hit for +2 potency and reach one tile farther." },
    backpack: { name: "Backpack", slot: "body", rarity: "common", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 6 }, text: "A sturdy backpack. +6 max LF. Packed right." },
    suitcase: { name: "Suitcase", slot: "body", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 10 }, text: "A suitcase worn as a breastplate. +10 max LF. Travel-tested." },
    metalCase: { name: "Metal case", slot: "body", rarity: "common", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 6 }, text: "A metal case. +6 max LF. It takes the hit." },
    stoneMallet: { name: "Stone mallet", slot: "tool", rarity: "common", biomes: ["quarry"], dropWeight: 0.4, weapon: { kind: "blunt" }, passive: { strikePotencyAdd: 1 }, text: "A stone mallet. Strikes hit for +1 potency." },
    treasureChest: { name: "Treasure chest", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.2 }, text: "A tiny treasure chest. +20% Seeds earned. It clinks when you walk." },
    hipPouch: { name: "Hip pouch", slot: "charm", rarity: "common", biomes: [], dropWeight: 0.4, passive: { seedsMul: 1.08 }, text: "A hip pouch. +8% Seeds earned." },
    periscope: { name: "Periscope", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "A periscope. +1 range on line deliveries. See without being seen." },
    pinkMask: { name: "Pink mask", slot: "head", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { glamourAdd: 2 }, text: "A pink mask. +2 glamour. Whoever you were, you are someone now." },
    duffelBag: { name: "Duffel bag", slot: "body", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { maxLFAdd: 10 }, text: "A duffel bag slung as padding. +10 max LF." },
    greenMask: { name: "Green mask", slot: "head", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { glamourAdd: 1, maxLFAdd: 4 }, text: "A green leaf mask. +1 glamour, +4 max LF." },
    oilLantern: { name: "Oil lantern", slot: "charm", rarity: "uncommon", biomes: [], dropWeight: 0.4, passive: { lineRangeAdd: 1 }, text: "An oil lantern. +1 range on line deliveries. Trim the wick." },
    jeweledDagger: { name: "Jeweled dagger", slot: "tool", rarity: "uncommon", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 2 }, text: "A jeweled dagger. Strikes hit for +2 potency." },
    fangDagger: { name: "Fang dagger", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 1 }, text: "A dagger of one long fang. Strikes hit for +1 potency." },
    sunOrb: { name: "Sun orb", slot: "charm", rarity: "rare", biomes: [], dropWeight: 0.4, passive: { startingUltimateCharge: 20 }, text: "A bottled sunrise. Start battles with 20% ultimate charge." },
    // Ramayana relics, set 2 (docs/ramayana-relics-2.md): mythic questOnly story relics. weapon kinds per docs/weapon-strikes.md.
    chandrahasa: { name: "Chandrahasa", slot: "tool", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["ravana"], weapon: { kind: "blade" }, passive: { strikePotencyAdd: 4, channelDealtMul: { albedo: 1.15 } }, text: "The moon-blade Shiva gave Ravana. Strikes hit for +4 potency; piercing (Albedo) damage +15%." },
    lakshmanaRekha: { name: "Lakshmana rekha", slot: "charm", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["lakshmana"], passive: { knockbackResist: 2, hazardImmune: true, maxLFAdd: 10 }, text: "The line Lakshmana drew around the hut. The first shove each battle doesn't move you; hazards don't touch you; +10 max LF." },
    jatayuFeather: { name: "Jatayu's feather", slot: "charm", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["jatayu"], passive: { fallDamageMul: 0.5, moveCostMul: 0.85, startingUltimateCharge: 15 }, text: "A feather from the vulture who fought Ravana in the sky. Falls hurt half, movement costs 15% fewer AP, start with 15% ultimate charge." },
    mandodariNecklace: { name: "Mandodari's necklace", slot: "charm", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["mandodari"], passive: { legitimacyAdd: 3, glamourAdd: 2, questionHint: 1 }, text: "The queen of Lanka's necklace, worn while she counselled peace. +3 legitimacy, +2 glamour; summon questions remove one wrong choice." },
    kumbhakarnaShula: { name: "Kumbhakarna's shula", slot: "tool", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["kumbhakarna"], weapon: { kind: "polearm" }, passive: { strikePotencyAdd: 5, objectDamageMul: 1.5, knockbackResist: 2 }, text: "The giant's trident. Strikes hit for +5 potency; structures take 50% more; the first shove each battle doesn't move him." },
    kumbhakarnaDrum: { name: "Waking drum", slot: "charm", rarity: "rare", biomes: [], mythic: true, questOnly: true, carriedBy: ["kumbhakarna"], passive: { startingUltimateCharge: 30, pfRegenAdd: 1 }, text: "The war drums Lanka beat to wake him. Start battles with 30% ultimate charge; +1 ΦF regen per turn." },
    lankaFlame: { name: "Flame of Lanka", slot: "charm", rarity: "legendary", biomes: [], mythic: true, questOnly: true, carriedBy: ["hanuman"], passive: { channelDealtMul: { citrinitas: 1.2 }, strikeRangeAdd: 1, hazardImmune: true }, text: "The fire Hanuman's tail carried through Lanka. Spreading (Citrinitas) damage +20%, strikes reach one tile farther, and entry hazards on the ground (thorn rubble and the like) do not hurt him." },
    silverDagger: { name: "Silver dagger", slot: "tool", rarity: "common", biomes: [], dropWeight: 0.4, weapon: { kind: "blade" }, passive: { strikePotencyAdd: 1 }, text: "A silver dagger. Strikes hit for +1 potency." },
  };

  // Seeds earned per battle (before passives). Losses pay a share, like XP.
  const seedRules = { victory: 30, perEnemy: 10, perMonster: 5, perCorrectAnswer: 5, lossShare: 0.25, minLoss: 5 };

  // Drop table: how many rolls, and what each roll can be.
  const dropRules = {
    relicChance: 0.03,   // a defeated story character drops one relic it carries (items with carriedBy), on a win (Mala, 2026-10-27)
    rollsOnWin: 1, extraRollPerEnemies: 2,        // +1 roll for every 2 enemies defeated
    lossRollChance: 0.25,                         // a loss gives one roll 25% of the time
    modeBonusRolls: { escape: 0, survive: 0, assassinate: 1, totalVictory: 1 },
    equipmentShare: 0.15,                         // each roll: 15% equipment, 85% consumable (mostly small heals)
    biomeWeight: 3,                               // items tagged with the battle's biome are 3× as likely
    rarityByLevel: [                              // better odds as the account levels up (multipliers on rarity weights)
      { level: 1,  mul: { common: 1, uncommon: 1, rare: 0.3, legendary: 0 } },
      { level: 5,  mul: { common: 1, uncommon: 1.1, rare: 0.7, legendary: 0.2 } },
      { level: 10, mul: { common: 0.9, uncommon: 1.2, rare: 1, legendary: 0.5 } },
      { level: 16, mul: { common: 0.8, uncommon: 1.2, rare: 1.3, legendary: 1 } },
    ],
    duplicateEquipment: "repairOrSell",           // a duplicate fully repairs your worn copy; if it's already at full, it sells
  };

  const shopRules = { consumableStock: 4, equipmentStock: 2, restock: "afterEachBattle", sellShare: "rarity.sell", maxLegendaryPerStock: 1 };

  // Mercs and Mediators (engine/hires.js). delay: rounds until they arrive. Merc: turns of its own, leaves below retreatAt
  // of its LF. Mediator: one truce ask a turn (cost AP), truceRounds both ways on a yes, refusalTempoTax AP off the enemy on
  // a no; goes home after `refusals` refusals or `attempts` asks. chance.boss: Omega threats and massive bosses.
  const hires = {
    merc: { pool: ["soldier", "black_armor", "samurai", "mma_fighter", "kickboxer", "ninja", "knight"], delay: 1, turns: 4, retreatAt: 0.3 },
    mediator: { pool: ["esker", "president"], delay: 1, cost: 20, truceRounds: 2, refusalTempoTax: 10, refusals: 2, attempts: 3, idleTurns: 2,
      chance: { base: 0.5, boss: 0.2, max: 0.85, bossMax: 0.3 } },
  };
  // What a carried consumable does, for the Use item menu (Mala, 2026-10-30: "scrolling over items in the menu should tell
  // you what they do"). One sentence per effect key, written from the effect data itself so the text cannot drift from the
  // numbers; the useItem handler in engine/actions.js is the behavior it describes. o: { ap, tempo, wild, ultMax }.
  //   wild   the map-item definition (wild/monsters-data.js items[id]) for an effect.wild item: its text and range
  //   ap     what the engine charges; tempo is the user's current AP, so the row can say why it is greyed
  // Returns { name, effect, detail, text }: effect is what it does, detail is cost, target and refusals, text is both.
  function itemHelp(id, o = {}) {
    const def = consumables[id] || null, wild = o.wild || null, e = def?.effect || (wild ? { wild: String(id) } : {}), name = def?.name || wild?.name || String(id);
    const ap = o.ap, sentences = [];   // no default price: without an ap the text names none (a wrong number is worse than none)
    if (e.heal && e.healAdjacentAllies) sentences.push(`Heals ${e.heal} LF, and ${e.healAdjacentAllies} LF to each hurt ally beside you.`);
    else if (e.heal) sentences.push(`Heals ${e.heal} LF.`);
    else if (e.healAdjacentAllies) sentences.push(`Heals ${e.healAdjacentAllies} LF to each hurt ally beside you.`);
    if (e.phiForce) sentences.push(`Restores ${e.phiForce} ΦF.`);
    if (e.actionPoints) sentences.push(`Gives +${e.actionPoints} action points this turn.`);
    if (e.ultCharge) sentences.push(`Adds ${e.ultCharge} ultimate charge${o.ultMax ? ` (the bar holds ${o.ultMax})` : ""}.`);
    if (e.observe) sentences.push("Reveals one enemy technique: using it opens Observe so you can pick the enemy.");
    if (e.placeBarrier) sentences.push(`Places a 1-tile wall with ${e.placeBarrier.protection} protection that lasts ${e.placeBarrier.duration} turns.`);
    if (e.blockSightTiles) sentences.push(`Releases smoke that blocks sight within ${e.blockSightTiles.radius} tile${e.blockSightTiles.radius === 1 ? "" : "s"} of the target for ${e.blockSightTiles.duration} turn${e.blockSightTiles.duration === 1 ? "" : "s"}.`);
    if (e.autoCorrectQuestion) sentences.push(e.autoCorrectQuestion === 1 ? "Your next summon question counts as correct." : `Boosts your next summon question by ${e.autoCorrectQuestion}.`);
    if (e.hire && hires[e.hire]) {
      const h = hires[e.hire], when = h.delay === 1 ? "next round" : `in ${h.delay} rounds`;
      sentences.push(e.hire === "merc"
        ? `Calls a mercenary: arrives ${when}, fights beside you for ${h.turns} of its turns and leaves below ${Math.round(h.retreatAt * 100)}% LF. One per side each battle.`
        : `Calls a mediator: arrives ${when}, never fights and cannot be attacked, and asks one enemy a turn for a ${h.truceRounds}-round truce. One per side each battle.`);
    }
    if (e.repair) sentences.push(`Mends one piece of gear (${e.repair === "full" ? "all" : "half"} of its durability). It is used between battles, not in a fight.`);
    if (e.wild && wild?.text) sentences.push(wild.text);
    if (!sentences.length) sentences.push(def?.text || wild?.text || "No effect is listed for this item.");
    const range = e.placeBarrier || e.blockSightTiles || e.observe ? 4 : (wild?.range || 0);
    const how = e.repair ? "It cannot be used in a fight."
      : e.hire ? "Click your own tile to send it."
      : e.observe ? "It opens Observe next."
      : e.wild || e.placeBarrier || e.blockSightTiles ? (range ? `Click a tile within ${range} spaces.${e.placeBarrier ? " It must be an empty floor tile." : ""}` : "Click your own tile.")
      : "Used on you at once; there is no tile to pick.";
    const full = [];
    if (e.heal && !e.phiForce) full.push(e.healAdjacentAllies ? "your LF is full and no ally beside you is hurt" : "your LF is full");
    if (e.heal && e.phiForce) full.push("your LF and ΦF are both full");
    if (!e.heal && e.phiForce) full.push("your ΦF is full");
    if (e.ultCharge) full.push("your ultimate bar is full");
    const detail = [e.repair ? how : `${ap == null ? "" : `Costs ${ap} AP. `}${how}`, full.length ? `Refused, with no AP spent, if ${full.join(" or if ")}.` : "",
      ap != null && o.tempo != null && o.tempo < ap ? `Not enough AP: it needs ${ap} and you have ${o.tempo}.` : ""].filter(Boolean).join(" ");
    const effect = sentences.join(" ");
    return { name, effect, detail, text: `${effect} ${detail}` };
  }
  return { rarities, slots, rules, consumables, equipment, seedRules, dropRules, shopRules, hires, itemHelp };
});
