"use strict";
// Monsters for Concept Combat: the "wild" side. Plain data only. Staged here; destined for
// ~/loci/web/combat/wild/. Design: ~/Documents/concept-combat-monsters.md.
//
// A monster is a concept with nobody steering it: a real landscape process (fire, runoff,
// pests, invasive growth) that harms everyone on the board. Each monster has:
//   - a real basis (and sources);
//   - appear conditions (some need an item, some are seeded chances that only roll while a board
//     condition holds);
//   - flee/end conditions, including a seeded "skittish" chance;
//   - the management concept that counters it, which is what the player learns.
// All numbers are PROVISIONAL.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatWildData = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const rules = {
    side: "wild",                 // hostile to every non-wild unit; wild monsters ignore each other
    phase: "environment",         // monsters act once per round, after every owner turn
    telegraph: true,              // next action is shown at round start (public), so players can bait them
    maxActive: 3,                 // at most 3 monsters, and at most one of each kind
    noAppearBeforeRound: 2,
  };

  // form: "unit" (a body that moves and attacks), "front" (a moving surge), "field" (a set of tiles that spreads)
  const monsters = {
    brushfire: {
      name: "Brushfire", form: "field", concept: "diffusion", channel: "citrinitas",
      basis: "Wildfire spreads through continuous fine fuel. In Hawaiʻi, non-native grasses such as guinea grass carry most wildfires; gaps in fuel (firebreaks) and wet or irrigated ground stop the spread.",
      teaches: "Fire spread is a graph of connected fuel: break the connection (a firebreak) and it burns out.",
      counters: ["boundary", "swale"],
      fuel: { ",": 0.5, "m": 0.6 },                 // tile char → spread chance
      objectFuel: { plant: 0.7, wood: 0.5 },         // object material → spread chance
      biomeMul: { quarry: 1.3, rim: 1.1, terrace: 1, grove: 0.9, wetland: 0.5 },
      burnRounds: 2, burntTo: ".", damage: 6, objectDamage: 8,
      appear: [
        { when: "item", item: "flare", chance: 1 },
        { when: "groundStrikesOnFuel", atLeast: 3, biomes: ["quarry", "rim", "terrace"], chance: 0.3 },
      ],
      ends: ["no burning tiles left"],
    },
    flashFlood: {
      name: "Flash flood", form: "front", concept: "swale", channel: "nigredo",
      basis: "Runoff concentrates in low channels and gathers force over hard surfaces. Vegetated swales and mulch slow it and let it soak in.",
      teaches: "Water takes the lowest path; permeable ground absorbs it, so slow it, spread it, sink it.",
      counters: ["swale", "berm"],
      strength: 3, stepsPerRound: 2, shove: 1, damage: 4, absorbOn: ["m", ","],
      appear: [
        { when: "cisternBurst", chance: 0.5 },
        { when: "bridgeCollapseOverWater", chance: 0.5 },
        { when: "item", item: "rainStick", chance: 1 },
      ],
      ends: ["strength reaches 0", "no downhill or level tile to move to"],
    },
    termites: {
      name: "Termite swarm", form: "unit", concept: "succession", channel: "albedo",
      sci: "Coptotermes formosanus",
      basis: "Formosan subterranean termites attack structural wood and living trees in Hawaiʻi; Ficus termite damage is noted in the Punchbowl research. Arborists remove infested debris and borate-treat wood.",
      teaches: "Debris left on site feeds decomposers; sanitation and treated wood break the cycle.",
      counters: ["selectivity", "barrier"],
      lf: 12, move: 2, eat: 6, bite: 3, seekWood: 6, seekUnits: 3,
      appear: [{ when: "woodDebris", chance: 0.2 }],
      ends: ["no untreated wood within 6 tiles", "LF 0"],
      skittish: 0,
    },
    feralPig: {
      name: "Feral pig", form: "unit", concept: "inertia", channel: "nigredo",
      sci: "Sus scrofa",
      basis: "Feral pigs root up soil and spread invasive plants across Hawaiʻi; conservation areas keep them out with fencing.",
      teaches: "A fence is a boundary that works because it is continuous: one gap and the pig is through.",
      counters: ["barrier", "boundary"],
      lf: 30, move: 4, ram: 8, knockback: 1, rootsTo: { ",": "m" }, baitRange: 6,
      appear: [
        { when: "item", item: "bait", chance: 1 },
        { when: "roundAtLeast", round: 3, biomes: ["grove", "wetland"], chance: 0.08 },
      ],
      ends: ["LF at or below 40% (flees)", "noisemaker within 4"],
      skittish: 0.15,                                 // seeded chance to bolt after ramming
    },
    // Giant nettle caterpillar (Mala, 2026-10-11): a wild monster whose behaviour is its biology. It is a leaf-eater,
    // not a hunter: it goes for plants (palms and ti first) and for a communed plant before anything else. It is
    // slow. It does not chase people, but anything that comes beside it gets the spines, and so does anyone who
    // strikes it by contact. Badly hurt, it curls and stops moving. The spines carry the poison (`poison`): it wears
    // LF down each turn and saps action points for 2 to 4 turns. Numbers PROVISIONAL.
    nettleCaterpillar: {
      name: "Giant nettle caterpillar", form: "unit", concept: "pruning", channel: "citrinitas", sprite: "nettle-caterpillar",
      sci: "Darna pallivitta (stinging nettle caterpillar), grown past all sense",
      basis: "The nettle caterpillar reached Hawaiʻi around 2001 and feeds on palms, ti, grasses and many ornamentals. Its spines break off in skin and deliver a venom that burns for hours; people are stung by brushing against infested plants, not by being chased.",
      teaches: "Not everything dangerous is aggressive. Some hazards only hurt what touches them: keep your distance and they are only a pest.",
      counters: ["anything that does not touch it: line, field and placed techniques", "taking away what it eats"],
      lf: 28, move: 2, eat: 3, sting: 5, seekPlants: 9, hosts: ["loulu", "ti", "monstera", "birdOfParadise", "nativeFern", "ukiuki", "hibiscus"],
      curlBelow: 0.4, curledDamageMul: 0.5,
      // Docile by default (Mala, 2026-10-11): keep away and it will not bother you. Hurt it and it turns HOSTILE toward
      // whoever did it for `hostileRounds` rounds (each new hit renews that): it stops feeding and spits at them from
      // range. The spit is not physical contact, so it carries no poison.
      spit: 4, spitRange: 4, hostileRounds: 3,
      poison: { id: "nettled", label: "Nettle sting", lf: 2, apLoss: 20, minTurns: 2, maxTurns: 4 },
      appear: [{ when: "hostPlants", round: 2, chance: 0.1 }],
      ends: ["LF 0", "nothing left to eat (wanders off)"],
      skittish: 0,
    },
    creeper: {
      name: "Invasive creeper", form: "field", concept: "succession", channel: "citrinitas",
      sci: "Coccinia grandis (ivy gourd)",
      basis: "Ivy gourd is an invasive vine in Hawaiʻi that smothers vegetation. Invasives establish fastest on disturbed ground and along open edges; shade and native cover slow them.",
      teaches: "Disturbance and open edges favour invasives; canopy shade and established cover resist them.",
      counters: ["succession", "edgefx"],
      growPerRound: 1, smother: 3, entangle: { moveCost: 2, lostMove: 1 }, clearedBy: 6,
      appear: [{ when: "disturbance", atLeast: 3, chance: 0.25 }],
      ends: ["no creeper tiles left"],
    },
    gaia: {
      name: "Gaia, the Wounded Ground", form: "unit", concept: "gradingDrainage", channel: "nigredo", sprite: "gaia-wounded",
      basis: "A large volume of permanent cut-and-fill disturbs the landscape; Gaia enters to defend the ground.",
      teaches: "Earthwork conserves soil, but changing a landscape at scale has consequences for the living system.",
      counters: ["movement", "guard", "restoring the damaged ground"],
      lf: 150, move: 2, strike: 16, knockback: 1, seekUnits: 99,
      appear: [{ when: "earthworks", atLeast: 6, chance: 1 }], ends: ["LF 0"], skittish: 0,
    },    // Muse-2's wild types (2026-10-15, ~/loci-orbit/muse/wild-types/PROTOTYPES.md): material for the Animal Tamer.
    // ready: false keeps a kind out of every spawn roll until its art passes QC (wolf and moa were returned 2026-10-15).
    ducks: {
      name: "Feral mallard flock", form: "unit", wave: false, concept: "diffusion", channel: "citrinitas", sprite: "ducks",
      sci: "Anas platyrhynchos (feral)",
      basis: "Feral mallards interbreed with the endangered Hawaiian duck (koloa) and hybridise it out of existence; managers remove the ferals to protect the pure bird.",
      teaches: "The flock is the invasion: spare the koloa, remove the ferals.",
      counters: ["selectivity", "preservation"],
      lf: 10, move: 3, peck: 2, seekUnits: 4, seekWater: 6, skittish: 0,
      appear: [{ when: "nearWater", round: 2, chance: 0.12 }], ends: ["LF 0"],
    },
    porgy: {
      name: "Salema porgy", form: "unit", wave: false, concept: "diffusion", channel: "citrinitas", sprite: "porgy",
      sci: "Sarpa salpa",
      basis: "The salema porgy grazes seagrass in schools; eaten fresh, old sailors say it brings vivid, crowded dreams.",
      teaches: "Fish stay where the water is: no water, no fish. Eat the dream-fish and the dreams come faster.",
      counters: ["selectivity", "barrier"],
      lf: 12, move: 3, nip: 3, seekUnits: 4, waterOnly: true, skittish: 0,
      appear: [{ when: "inWater", round: 2, chance: 0.15 }], ends: ["LF 0"],
    },
    // Kraken (Mala, 2026-11-05: "a wild type that can only spawn and move in water tiles, but it can
    // move at twice the normal speed for the normal AP cost"). The porgy's apex shadow: water-only
    // like the porgy, but a deep swimmer (shallows AND pools) at twice the move budget. ready: false
    // until its art lands (shelf muse-kraken-cut); direct spawns and tests are unaffected.
    kraken: {
      name: "Kraken", form: "unit", wave: false, concept: "swale", channel: "nigredo", sprite: "kraken",
      sci: "Architeuthis dux, impossibly alive",
      basis: "Giant squid live a kilometre down and surface only as corpses and fishermen's stories; every rope, spar and sailor the sea gives back chewed is laid at the kraken's door.",
      teaches: "Deep water hides big teeth. It cannot follow you ashore: the sand is the wall.",
      counters: ["movement", "selectivity"],
      lf: 70, move: 6, slam: 10, knockback: 1, seekUnits: 6, waterOnly: true, deepWater: true,
      traits: ["swimmer"], skittish: 0, ready: true,   // art landed with muse-kraken-cut (1.3.541, Bollard IN): ambient appear and summons are live
      appear: [{ when: "inWater", round: 3, chance: 0.10 }], ends: ["LF 0"],
    },
    wolf: {
      name: "Feral dog", form: "unit", wave: false, concept: "inertia", channel: "nigredo", sprite: "wolf",
      sci: "Canis familiaris, gone wild",
      basis: "Feral dogs in Hawaiʻi harass ground-nesting birds (nēnē goslings among them) and chase livestock; they hunt as a pack and single out the animal that strays.",
      teaches: "Predators single out the isolated: stay grouped.",
      counters: ["adjacency", "barrier"],
      lf: 24, move: 5, bite: 6, seekUnits: 8, skittish: 0.1,
      appear: [{ when: "roundAtLeast", round: 3, biomes: ["grove", "rim", "quarry"], chance: 0.08 }], ends: ["LF 0", "flees at 40% LF"],
    },
    moa: {
      name: "Moa", form: "unit", wave: false, concept: "berm", channel: "nigredo", sprite: "moa",
      sci: "Dinornis, impossibly alive",
      basis: "Nēnē pairs defend the nest with hisses, spread wings and chases, then drop the grudge the moment you leave the circle. Flightless birds cannot flee, so they stand.",
      teaches: "Nesting birds defend a radius, not a grudge: leave the circle and the war ends.",
      counters: ["pathway", "guard"],
      lf: 34, move: 3, kick: 7, nestRadius: 4, skittish: 0,
      appear: [{ when: "roundAtLeast", round: 2, biomes: ["grove", "terrace"], chance: 0.10 }], ends: ["LF 0"],
    },
    // Sasquatch gameplay (Muse-2, 2026-10-19; Driftwood tasking): the first wild type that acts like a
    // character. Sentient, docile until provoked, territorial, tameable (tame chance ×0.5, content.js),
    // a genius student of every technique it sees. Taming it is a gamble (Mala, 2026-10-19): a failed tame
    // provokes it onto the tamer for the rest of the battle (and a beast coming for you is harder to tame),
    // but a Sasquatch that answers is loyal for life: no Harrowing, the bond never breaks. And it remembers:
    // after one tame, each later battle has a small chance (friend) that it crashes in on your side.
    sasquatch: {
      name: "Sasquatch", form: "unit", wave: false, concept: "inertia", channel: "nigredo", sprite: "sasquatch",
      sci: "Gigantopithecus blacki, impossibly alive",
      basis: "Gigantopithecus blacki was the largest primate that ever lived, three metres of ape in the Pleistocene forests of Asia; the last of its kind vanished some 215,000 years ago as the forests shifted. The Sasquatch of story stands where the fossil record stops: something huge, watchful, and almost never seen.",
      teaches: "It watches before it acts, and what it watches it learns: do not show it your best techniques. Respect its ground and it will let you leave. Reach for it and miss, and it comes for you; win it over and it is yours for life.",
      counters: ["pathway", "selectivity"],
      lf: 220, move: 4, strike: 14, knockback: 1, territory: 3, seekUnits: 8, skittish: 0,
      traits: ["genius", "denseMuscle"], loyal: true, tameFail: "provoked", pack: false,
      friend: { chance: 0.05, fromRound: 2, toRound: 5 },   // once tamed, it may come to your aid in a later battle (Mala, 2026-10-19)
      appear: [{ when: "roundAtLeast", round: 4, biomes: ["grove", "rim", "quarry"], chance: 0.07 }], ends: ["LF 0"],
    },

  };

  // Consumable items. They are FOUND on the map (~/loci/web/combat/terrain/pickups.js decides where, and which
  // destroyed objects drop them); a unit carries up to 2, and using one costs the "utility" action (20 AP).
  const items = {
    bait:       { name: "Bait (fallen fruit)", range: 4, text: "Place on a tile. A feral pig appears at the nearest edge, or an existing pig targets the bait for 2 rounds." },
    flare:      { name: "Flare", range: 3, text: "Ignite a fuel tile: Brushfire starts there." },
    rainStick:  { name: "Rain stick", range: 0, text: "Call a downpour: a flash flood starts on the highest walkable tile, heading downhill." },
    waterCan:   { name: "Watering can", range: 2, text: "Wet a plus of tiles: they stop burning and won't catch fire for 3 rounds." },
    borate:     { name: "Borate treatment", range: 1, text: "Treat a wooden object or bridge: termites ignore it, and adjacent swarms flee." },
    noisemaker: { name: "Noisemaker", range: 4, text: "Startle unit monsters within 4 tiles: pigs flee, and swarms scatter one tile." },
  };

  // Site appetite (Mala, 2026-10-19): each archetype tilts the random-event wave toward its own
  // wilds. Unlisted kinds keep weight 1, so an empty table draws exactly as before. The grove sends
  // what lives in it: caterpillars off the trees first, pigs out of the mulch, termites out of dead wood.
  const waveWeights = {
    grove: { nettleCaterpillar: 3, feralPig: 2, termites: 1 },
    default: {},
  };
  // Site voice: why the wilds came, in the map's own words. Picked by the same seeded hash as the kind.
  const arrivalVoice = {
    grove: ["the grove stirs and something comes out of the green", "drawn by the disturbance under the boughs", "the mulch rustles: something was already here"],
    default: ["drawn by the sudden disturbance"],
  };

  // L0 (bryophyte): field kinds as data. frontier, environmentPhase and
  // clearTiles read these rows instead of branching on kind names. Same
  // numbers, same texts. Rows reference the monsters table above where the
  // value already lives there, so each number still has one source.
  const fields = {
    creeper: {
      label: "Creeper", act: "creeper",
      spread: { mode: "chars", onto: [",", "m"], shadeSkip: true, edgeChance: 1, openChance: 0.6 },
      clear: { clearedBy: monsters.creeper.clearedBy, eventKind: "creeperCleared" },
      effects: { entangle: monsters.creeper.entangle },
    },
    brushfire: {
      label: "Brushfire", act: "fire",
      spread: { mode: "fuel" },
      clear: {},
      effects: {},
    },
  };

  return { rules, monsters, items, waveWeights, arrivalVoice, fields };
});
