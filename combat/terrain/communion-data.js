"use strict";
// Plant communion (Mala, 2026-10-10): observe a plant, answer a botany question, and it steps out of the
// ground as an ally until its life runs out. Numbers only; rules are in communion.js.
//
// Stats follow one idea: plants are fragile. Big, hardy species carry more life and are harder to reach.
// The question pool is a STUB. Mala's nature document replaces `questions` (same shape); nothing else changes.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatCommunionData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const rules = {
    released: true,           // Released 2026-10-11 (Mala, after Muse's sim batches). The battle menu shows Observe > Plants
                              // only when this is true; set it false to hide communion again without touching the engine.
    observeRange: 4,          // tiles, with line of sight
    observeStep: 10,          // action points per point of familiarity
    observeMax: 30,           // most action points one Observe can invest
    hikerBonus: 1,            // extra familiarity per Observe for a unit with the hiker trait
    // Field Botany (insight trait `botanist`, carried by the Field Botanist): +2 familiarity per Observe (on top of
    // hiker), 2 ΦF off every communion, and the plant that answers has 25% more life.
    botanist: { trait: "botanist", observeBonus: 2, phiDiscount: 2, allyHpMul: 1.25 },
    // Horticulture Expertise (Muse C24, 20 sandbox battles; insight trait carried by the Arborist, Gardener and Field
    // Botanist). Tend: at the holder's turn start every allied communed plant within tendRange recovers tendHeal LF and
    // its Green ward is renewed. Leash: a communed plant that is not fighting (no enemy within engagedRange) stays
    // within leash tiles of its owner (leashOther for an owner without the trait) and walks home when beyond it.
    horticulture: { trait: "horticultureExpertise", tendRange: 2, tendHeal: 2, wardProtection: 3, wardTurns: 2, leash: 5, leashOther: 3, engagedRange: 2 },
    range: 1,                 // commune from an adjacent tile
    communeAp: 30,
    phiBase: 2, phiPerDifficulty: 2,   // ΦF cost = 2 + 2 × difficulty (4 to 12)
    maxActive: 1,             // one communed ally at a time
    // When a communed plant's life runs out it DIES (Mala, 2026-10-10). Its body stays on the map as a plant object
    // marked dead: it keeps the terrain rules it had as a plant (blocking, cover, move cost, HP), its traits no
    // longer fire, and it cannot be observed or communed with again.
    carnivorousDifficultyAdd: 1,
    // Treeant (Mala, 2026-10-12): pour the aura folded into your Dream Space into your communed plant and it
    // rises as a Treeant while the dream holds. The field loses your aura; the plant gains a big body, Bark ward,
    // and treant art. When the dream closes it sinks back to its plant form; if it falls it dies like any ally.
    treeant: { ap: 20, lfAdd: 30, wardProtection: 10, wardTurns: 99, sprite: "treant" },
    // Per-type Treeant art (Muse-2, 2026-10-21): species with their own cut treeant-<type>/ folder rise in it;
    // everyone else keeps the shared treant. treeant-ancient/bosque/forest have no species yet — map them when they do.
    treeantSprites: { banyan: "treeant-banyan", bristlecone: "treeant-bristlecone" },
  };
  // Defaults by growth form. `need` = familiarity required before it will answer = difficulty.
  const forms = {
    groundcover: { hp: 10, difficulty: 1, primary: "diffusion", secondary: "succession", aura: "fern" },
    shrub: { hp: 16, difficulty: 2, primary: "succession", secondary: "adaptation", aura: "vine" },
    hedge: { hp: 18, difficulty: 2, primary: "boundary", secondary: "succession", aura: "thorn" },
    tree: { hp: 26, difficulty: 3, primary: "barrier", secondary: "succession", aura: "root" },
  };
  // Species that differ from their form. Unlisted species use the form default.
  const species = {
    // big, hardy trees: the most life, the hardest to reach
    banyan: { hp: 36, difficulty: 5, primary: "barrier", secondary: "pathway", aura: "root", name: "Banyan Elder", signature: "banyanSnare" },
    bristlecone: { hp: 38, difficulty: 5, primary: "adaptation", secondary: "inertia", aura: "root", name: "Bristlecone Ancient", signature: "millenniumGrip" },
    passionflower: { hp: 22, difficulty: 2, primary: "succession", secondary: "pathway", aura: "blossom", name: "Passionflower Host" },
    puya: { hp: 24, difficulty: 3, primary: "barrier", secondary: "diffusion", aura: "seed", name: "Sapphire Tower" },
    kukui: { hp: 20, difficulty: 3, primary: "sightline", secondary: "diffusion", aura: "seed", name: "Kukui Torch", signature: "kukuiTorchNuts" },
    koa: { hp: 34, difficulty: 4, primary: "barrier", secondary: "inertia", aura: "root", name: "Koa Warden" },
    ohia: { hp: 30, difficulty: 4, primary: "succession", secondary: "resonance", aura: "blossom", name: "ʻŌhiʻa Pioneer" },
    monkeypod: { hp: 32, difficulty: 4, aura: "broadleaf" },
    loulu: { hp: 24, difficulty: 3, primary: "elasticity", secondary: "barrier", aura: "broadleaf", name: "Loulu Sentinel" },
    // shrubs
    naupaka: { primary: "boundary", secondary: "selectivity", aura: "blossom", name: "Naupaka Half-Bloom" },
    ohelo: { primary: "succession", secondary: "adaptation", aura: "seed", name: "ʻŌhelo Forager" },
    hibiscus: { aura: "blossom", name: "Hibiscus Bloom" },
    plumbago: { aura: "blossom", name: "Plumbago Hedge" },   // communed art: sprites/commune-plumbago (Plumbago Sprite Sheet Showcase, 2026-10-18); hedge default concepts
    birdOfParadise: { primary: "sightline", secondary: "succession", aura: "broadleaf", name: "Bird of Paradise" },
    ti: { primary: "barrier", secondary: "succession", aura: "broadleaf", name: "Tī Guardian" },
    // Wiliwili: light wood that rides the wind (diffusion), and a dancer that reroutes (pathway).
    wiliwili: { hp: 26, difficulty: 3, primary: "diffusion", secondary: "pathway", aura: "blossom", name: "Wiliwili Dancer" },
    // ʻUlu: the generous canoe plant. Bears over time (succession) and shares its yield (diffusion); easy to know.
    // Muse proposed 34 LF at difficulty 2; the standing rule is that the five hardiest plants are the hardest to reach
    // (difficulty 4 or 5), so it is 24 here: sturdy for an easy plant, below the hardy tier. Mala may prefer 34 at 4.
    // signature: one technique a species brings of its own (kits-data.js); the communed ally knows it whatever its concepts.
    ulu: { hp: 24, difficulty: 2, primary: "succession", secondary: "diffusion", aura: "broadleaf", name: "ʻUlu Provider", signature: "uluHurl" },
    // groundcovers
    akulikuli: { primary: "adaptation", secondary: "diffusion", aura: "water", name: "ʻĀkulikuli Mat" },
    ukiuki: { aura: "seed", name: "ʻUkiʻuki" },
    nativeFern: { aura: "fern", name: "Fern Runner" },
    monstera: { hp: 12, primary: "pathway", secondary: "diffusion", aura: "broadleaf", name: "Monstera Climber" },
    // carnivores: traps, so a little harder to reach than their size suggests
    venusFlytrap: { primary: "threshold", secondary: "deception", aura: "thorn", name: "Flytrap Snapper" },
    sundew: { primary: "threshold", secondary: "diffusion", aura: "seed", name: "Sundew Snare" },
    pitcherPlant: { primary: "swale", secondary: "deception", aura: "water", name: "Pitcher Lurker" },
    cobraLily: { primary: "deception", secondary: "threshold", aura: "vine", name: "Cobra Lily" },
  };
  // Study notes (Observe teaches, Mala 2026-10-31): each question carries a `clue`, shown when Observe makes the plant ready.
  // At most two sentences and 140 characters; it teaches the answer and names a wrong choice only as a stated contrast.
  // STUB botany questions: general plant biology, safe for any species. `for` narrows a question to a
  // form, a species, or carnivores; omitted means any plant.
  const questions = [
    { id: "wiliwili-drought", for: { species: "wiliwili" }, prompt: "Wiliwili drops its leaves in dry spells. This habit is called…?", choices: ["Evergreen", "Drought-deciduous", "Succulent"], answer: 1, clue: "Bare branches all through the dry months; the leaves come back with the first heavy rain.",
      explain: "Wiliwili is drought-deciduous: it sheds leaves to survive the dry season, then leafs out with rain." },
    { id: "wiliwili-wood", for: { species: "wiliwili" }, prompt: "Wiliwili's light, buoyant wood was traditionally used for…?", choices: ["Surfboards and longboards", "Stone adzes", "Fishhooks"], answer: 0, clue: "A fallen limb weighs almost nothing and floats. The old riders shaped this wood to stand on waves.",
      explain: "Wiliwili wood is among the lightest native woods: shaped into surfboards, canoe parts and masks." },
    { id: "ulu-propagation", for: { species: "ulu" }, prompt: "Breadfruit is traditionally propagated by…?", choices: ["Seeds", "Root suckers", "Air-layering"], answer: 1, clue: "Island breadfruit rarely bears anything you could sow. New trees rise from roots spreading out from the parent.",
      explain: "ʻUlu's seedless varieties are propagated vegetatively: root suckers dug up and replanted." },
    { id: "ulu-canoe", for: { species: "ulu" }, prompt: "Breadfruit came to Hawaiʻi…?", choices: ["On its own by ocean drift", "With Polynesian voyagers as a canoe plant", "With 19th-century sugar planters"], answer: 1, clue: "It cannot cross the sea without people. The first voyagers carried root cuttings in their hulls.",
      explain: "ʻUlu was one of the canoe plants carried across the Pacific." },
    { id: "xylem", prompt: "Which tissue carries water up from the roots?", choices: ["Xylem", "Phloem", "Cambium"], answer: 0, clue: "Water climbs from the roots through the xylem, the plant's woody plumbing; the phloem carries sugar the other way.",
      explain: "Xylem moves water and minerals upward; phloem moves sugars." },
    { id: "stomata", prompt: "What are the pores on a leaf that let gases in and out?", choices: ["Lenticels", "Stomata", "Trichomes"], answer: 1, clue: "The underside of the leaf is dotted with stomata, tiny mouths that open to breathe and close in the heat.",
      explain: "Stomata open and close to trade carbon dioxide, oxygen and water vapour." },
    { id: "endemic", prompt: "A plant that grows naturally in only one place on Earth is called…", choices: ["Indigenous", "Naturalised", "Endemic"], answer: 2, clue: "It grows wild nowhere else on Earth, so botanists call it endemic. Indigenous plants came on their own but live elsewhere too.",
      explain: "Endemic means native to one place and found nowhere else." },
    { id: "mycorrhiza", prompt: "What do mycorrhizal fungi give a plant's roots?", choices: ["Water and minerals", "Sugars", "Sunlight"], answer: 0, clue: "Fungal threads wrap its roots and reach farther than roots can, bringing back water and minerals.",
      explain: "The fungus extends the root's reach for water and minerals and is paid in sugars." },
    { id: "cambium", for: { form: "tree" }, prompt: "Which thin layer adds a new ring of wood each year?", choices: ["Heartwood", "Vascular cambium", "Bark"], answer: 1, clue: "Just inside the trunk's skin, a thin living layer, the vascular cambium, lays down one new ring of wood each year.",
      explain: "The vascular cambium divides to make new xylem inward and phloem outward." },
    { id: "carnivore-why", for: { carnivorous: true }, prompt: "Why does a carnivorous plant catch insects?", choices: ["For energy", "For nutrients such as nitrogen", "For water"], answer: 1, clue: "It grows in poor, boggy soil with little nitrogen. Its leaves still make sugar; the insects feed it nutrients.",
      explain: "They still photosynthesise for energy; prey supplies nutrients their poor soils lack." },
    { id: "passionflower-name", for: { species: "passionflower" }, prompt: "The passionflower's name honors…?", choices: ["Roman romance", "The Passion of Christ", "A Hawaiian queen"], answer: 1, clue: "Missionaries read the flower as a sermon: the crown of thorns in its corona, the wounds of the Passion in its stamens.",
      explain: "Spanish missionaries read the flower's parts as the instruments of the Passion." },
    { id: "passionflower-host", for: { species: "passionflower" }, prompt: "Passionflower vines host the caterpillars of…?", choices: ["Monarchs", "Gulf fritillaries", "Swallowtails"], answer: 1, clue: "Orange caterpillars with black spines feed on the vine. They grow up to be gulf fritillaries.",
      explain: "Gulf fritillary caterpillars eat Passiflora; the vine answers with decoy eggs and hooked hairs." },
    { id: "puya-spike", for: { species: "puya" }, prompt: "A puya's tall flower spike is mostly pollinated by…?", choices: ["Hummingbirds", "Bats", "Wind"], answer: 0, clue: "The spike holds its nectar where hovering hummingbirds can reach it.",
      explain: "Sapphire tower spikes feed hummingbirds in the Andes; the teal petals are a bird flag." },
    { id: "puya-leaf", for: { species: "puya" }, prompt: "Puya leaves arm themselves with…?", choices: ["Stinging hairs", "Hooked marginal spines", "Wax"], answer: 1, clue: "Run a hand down the leaf edge and it catches: hooked spines line the margins.",
      explain: "The rosette's leaf margins carry sharp hooks; handle a puya like barbed wire." },
    { id: "banyan-props", for: { species: "banyan" }, prompt: "A banyan's prop roots begin as…?", choices: ["Underground rhizomes", "Aerial roots from the branches", "Root suckers"], answer: 1, clue: "Thin roots hang from the branches like ropes. Where they touch soil they thicken into new trunks.",
      explain: "Aerial roots descend from the branches, reach the soil, and thicken into pillar trunks: that is how a banyan walks." },
    { id: "banyan-figs", for: { species: "banyan" }, prompt: "Figs like the banyan's are pollinated by…?", choices: ["Wind", "Fig wasps", "Bats"], answer: 1, clue: "Each fig is a closed cup of flowers. Only a tiny fig wasp can crawl inside to pollinate it.",
      explain: "Each Ficus keeps an agaonid wasp partner; the fig is a syconium, an inside-out flower cluster." },
    { id: "bristlecone-bark", for: { species: "bristlecone" }, prompt: "A bristlecone survives millennia partly by…?", choices: ["Shedding all needles yearly", "Keeping one living cambium ribbon", "Cloning through suckers"], answer: 1, clue: "Most of the trunk is dead wood. One narrow ribbon of living cambium still carries the whole crown.",
      explain: "Strip-bark growth: most of the trunk dies back and one ribbon of cambium carries the whole crown." },
    { id: "bristlecone-soil", for: { species: "bristlecone" }, prompt: "Great Basin bristlecones grow oldest on…?", choices: ["Rich valley loam", "Harsh dolomite slopes", "Wet canyon floors"], answer: 1, clue: "The oldest ones cling to bare, pale dolomite slopes, where hardship keeps growth slow and rot away.",
      explain: "Cold, dry dolomite: slow growth, dense resinous wood, and almost no competition." },
    { id: "kukui-light", for: { species: "kukui" }, prompt: "Kukui nuts were traditionally used for…?", choices: ["Building canoes", "Lamplight", "Dyeing kapa red"], answer: 1, clue: "The nuts are full of oil. Strung on a palm rib and lit, they burned one by one as a candle.",
      explain: "Candlenuts: the oily kernels were strung and burned. Kukui is Hawaiʻi's state tree." },
    { id: "kukui-canoe", for: { species: "kukui" }, prompt: "Kukui arrived in Hawaiʻi by…?", choices: ["Polynesian canoe", "Wind dispersal", "Container ship"], answer: 0, clue: "Its seeds do not drift far on the sea. The first voyagers brought it with them as a canoe plant.",
      explain: "A canoe plant, carried across the Pacific for light, oil, medicine and lei." },
  ];
  return { rules, forms, species, questions };
});
