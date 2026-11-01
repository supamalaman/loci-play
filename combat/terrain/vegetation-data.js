"use strict";
// Vegetation + destructible objects for Concept Combat arenas. Plain data only.
// Species come from Mala's own tools first (sources below); a few biome fillers are marked
// "biome". Each species gets at most ONE combat trait, and every trait records the real
// horticultural/arboricultural basis it is interpreting. Traits are game interpretations,
// not claims about field performance. All numbers are PROVISIONAL.
//
// Sources:
//   fieldwork   ~/landscape-sandbox/PLANTS.md (Native Plants Hawaiʻi–verified palette)
//   study:*     Explainer Library plant studies (~/explainers/explainers/<slug>/)
//   punchbowl   ~/Documents/Punchbowl Memorial/RESEARCH.md (NMCP plantings)
//   biome       added for biome coverage; not yet in another tool
//   sprites     Mala's two plant sprite sheets (2026-10-10): the species she drew are the species in the game
//   portfolio   ~/plant-photography-portfolio (also lists ti, bird of paradise and monstera)
//
// origin (2026-10-10): "endemic" | "indigenous" (both Native Hawaiian) | "canoe" (Polynesian-introduced) | "tropical"
// (introduced ornamental) | "temperate". Used by plant communion and the hiker rule's plant count; it changes no combat number.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatVegetation = factory();
})(typeof self !== "undefined" ? self : this, function () {

  // Form presets: how a plant occupies a tile. Species can override.
  //   blocksMove / moveCost / sightHeight / cover follow terrain-data.js semantics.
  //   canopy: radius (Manhattan) of shade tiles around a tree. Shade = cover against
  //   attackers on HIGHER ground (plan §3: the counter to high-ground advantage).
  const forms = {
    tree:        { blocksMove: true,  moveCost: 0, sightHeight: 3, cover: 1,    canopy: 1, hp: 24, material: "wood",  fells: true },
    hedge:       { blocksMove: false, moveCost: 2, sightHeight: 1, cover: 0.25, canopy: 0, hp: 8,  material: "plant" },
    shrub:       { blocksMove: false, moveCost: 2, sightHeight: 1, cover: 0.25, canopy: 0, hp: 6,  material: "plant" },
    groundcover: { blocksMove: false, moveCost: 1, sightHeight: 0, cover: 0,    canopy: 0, hp: 3,  material: "plant" },
  };

  const species = {
    // ── trees ──────────────────────────────────────────────────────────────
    monkeypod: { common: "Monkeypod", sci: "Samanea saman", form: "tree", origin: "tropical", sources: ["punchbowl", "sprites"], sheet: "monkeypod", stages: 3, canopy: 2, hp: 30,
      trait: { id: "broadCanopy", text: "Canopy radius 2: a wide pool of shade.", basis: "Monkeypod's spreading, umbrella-shaped crown is often much wider than the tree is tall." } },
    banyan: { common: "Chinese banyan", sci: "Ficus microcarpa", form: "tree", origin: "tropical", sources: ["punchbowl", "sprites"], sheet: "generic", hp: 34,
      trait: { id: "propRoots", text: "When felled it leaves prop-root tangle (shrub-like cover) instead of a clear tile.", basis: "Aerial roots reach the ground and thicken into supporting trunks." } },
    // Nothing on the map is indestructible (Mala, 2026-10-14): the memorial Bo tree is sturdy, not untouchable.
    bo: { common: "Bo tree", sci: "Ficus religiosa", form: "tree", origin: "tropical", sources: ["punchbowl", "sprites"], sheet: "generic", hp: 40,
      trait: { id: "memorial", text: "Memorial specimen: 40 HP, the sturdiest tree on the map.", basis: "The Memorial Walk Bo grove at Punchbowl is a commemorative planting, cared for as a protected tree." } },
    kukui: { common: "Kukui", sci: "Aleurites moluccanus", form: "tree", origin: "canoe", sources: ["punchbowl", "sprites"], sheet: "generic", hp: 16,
      trait: { id: "softWood", text: "Low HP: soft, light wood fells quickly.", basis: "Kukui wood is light and soft, and the tree is comparatively short-lived." } },
    rainbowShower: { common: "Rainbow shower", sci: "Cassia × nealiae", form: "tree", origin: "tropical", sources: ["punchbowl", "sprites"], sheet: "rainbowShower", stages: 3,
      trait: null },
    kou: { common: "Kou", sci: "Cordia subcordata", form: "tree", origin: "indigenous", sources: ["punchbowl", "sprites"], sheet: "generic",
      trait: { id: "shadeTree", text: "Canopy shade also halves Diffusion damage beneath it.", basis: "Kou was planted around Hawaiian homes for shade; dense crown." } },
    fukugi: { common: "Fukugi", sci: "Garcinia subelliptica", form: "tree", origin: "tropical", sources: ["punchbowl", "sprites"], sheet: "generic", canopy: 0,
      trait: { id: "windbreak", text: "Field (radius) effects do not pass through its tile.", basis: "Planted in dense rows as windbreaks; columnar, thick evergreen foliage." } },
    paperbark: { common: "Paperbark", sci: "Melaleuca leucadendra", form: "tree", origin: "tropical", sources: ["punchbowl", "sprites"], sheet: "generic",
      trait: { id: "wetTolerant", text: "Can stand in shallow water tiles.", basis: "Melaleucas tolerate waterlogged soils and seasonal flooding." } },
    milo: { common: "Milo", sci: "Thespesia populnea", form: "tree", origin: "canoe", sources: ["study:milo", "sprites"], sheet: "generic",
      trait: { id: "lowLimbs", text: "Canopy tiles block sight at ground level too (sight height 1).", basis: "Milo doesn't self-prune: crooked stems with low, permanent limbs (Milo study, card 6)." } },
    ohia: { common: "ʻŌhiʻa lehua", sci: "Metrosideros polymorpha", form: "tree", origin: "endemic", sheet: "native", stages: 3, sources: ["fieldwork"],
      trait: { id: "woundSensitive", text: "After its first damage it takes ×2 damage (wounded).", basis: "Rapid ʻŌhiʻa Death fungi commonly infect through wounds; wounding ʻōhiʻa is discouraged." } },
    // Wiliwili (Muse's plug-in docs/wiliwili.md, ported 2026-10-11): its own sheet, three true growth stages.
    wiliwili: { common: "Wiliwili", sci: "Erythrina sandwicensis", form: "tree", sources: ["sprites", "fieldwork"], sheet: "wiliwili", origin: "endemic", verify: true, stages: 3, hp: 20,
      // The spec's block had `trait: null`; the live entry already carried this fieldwork trait, so it stays.
      trait: { id: "deciduous", text: "Its canopy gives no shade (leafless in the dry season).", basis: "Wiliwili is seasonally deciduous in summer–fall." },
      note: "Soft light wood: low HP, easy to fell. Drought-deciduous; red flowers." },
    kiawe: { common: "Kiawe", sci: "Prosopis pallida", form: "tree", origin: "tropical", sources: ["punchbowl", "sprites"], sheet: "generic",
      trait: { id: "thorns", text: "A unit shoved into its tile takes 3 LF thorn damage on top of the slam.", basis: "Kiawe branches carry sharp thorns." } },
    eucalyptus: { common: "Eucalyptus", sci: "Eucalyptus sp.", form: "tree", origin: "tropical", sources: ["punchbowl", "sprites"], sheet: "generic",
      trait: { id: "limbDrop", text: "The first time it drops below half HP, a limb falls on one adjacent tile (6 LF impact).", basis: "Sudden branch drop is reported in eucalypts; arborists treat large limbs as a target-zone risk." } },
    bristlecone: { common: "Great Basin bristlecone pine", sci: "Pinus longaeva", form: "tree", origin: "temperate", sources: ["fieldwork", "study:the-methuselah-tree", "sprites"], sheet: "generic", hp: 28,
      trait: { id: "stripBark", text: "Survives one lethal hit at 1 HP.", basis: "Strip-bark growth: sections of cambium die while a living strip keeps the tree alive for centuries." } },

    // ── Native Hawaiian and tropical additions (2026-10-10) ─────────────────
    // These are the plants on Mala's two sprite sheets (~/Downloads/Native Hawaiian Plants Sprites.png and
    // Tropical Plants Sprites.png; eight labelled species each, three sizes). ʻŌhiʻa and naupaka were already here.
    // `sheet` records which sheet a species is on; `origin` is the botanical status and can differ (a Venus flytrap
    // is on the Tropical sheet but is a temperate bog plant). `stages: 3` = the sheet draws small, medium and large.
    // Scientific names and status are Claude's and flagged `verify` for Mala. No new combat traits are claimed.
    koa: { common: "Koa", sci: "Acacia koa", form: "tree", sources: ["sprites"], sheet: "native", origin: "endemic", verify: true, stages: 3, hp: 30,
      trait: null },
    loulu: { common: "Loulu", sci: "Pritchardia sp.", form: "tree", sources: ["sprites"], sheet: "native", origin: "endemic", verify: true, stages: 3, canopy: 0, hp: 20,
      trait: null, note: "Native fan palm: a single trunk and a high crown, so canopy 0 (almost no shade at ground level)." },
    akulikuli: { common: "ʻĀkulikuli", sci: "Sesuvium portulacastrum", form: "groundcover", sources: ["sprites"], sheet: "native", origin: "indigenous", verify: true, stages: 3,
      trait: null },
    ohelo: { common: "ʻŌhelo", sci: "Vaccinium reticulatum", form: "shrub", sources: ["sprites"], sheet: "native", origin: "endemic", verify: true, stages: 3,
      trait: null },
    ukiuki: { common: "ʻUkiʻuki", sci: "Dianella sandwicensis", form: "groundcover", sources: ["sprites"], sheet: "native", origin: "indigenous", verify: true, stages: 3,
      trait: null },
    nativeFern: { common: "Native fern", sci: "Nephrolepis cordifolia (kupukupu) and others", form: "groundcover", sources: ["sprites"], sheet: "native", origin: "indigenous", verify: true, stages: 3,
      trait: null, note: "The sheet labels these only as Native Ferns; kupukupu is given as the representative species." },
    hibiscus: { common: "Hibiscus", sci: "Hibiscus rosa-sinensis", form: "shrub", sources: ["sprites"], sheet: "tropical", origin: "tropical", verify: true, stages: 3,
      trait: null, note: "The red garden hibiscus. The native yellow hibiscus is maʻo hau hele, already in this list." },
    birdOfParadise: { common: "Bird of paradise", sci: "Strelitzia reginae", form: "shrub", sources: ["sprites", "portfolio"], sheet: "tropical", origin: "tropical", stages: 3,
      trait: null },
    // ʻUlu (Muse's plug-in docs/ulu-breadfruit.md, ported 2026-10-11): its own two sheets, not the Tropical one.
    ulu: { common: "ʻUlu (breadfruit)", sci: "Artocarpus altilis", form: "tree", sources: ["sprites"], sheet: "ulu", origin: "canoe", stages: 3, hp: 30,
      trait: null, note: "Canoe plant (Polynesian-introduced). Feeds many; seedless varieties propagate from root suckers." },
    ti: { common: "Kī (ti)", sci: "Cordyline fruticosa", form: "shrub", sources: ["sprites", "portfolio"], sheet: "tropical", origin: "canoe", stages: 3,
      trait: null, note: "On the Tropical sheet; in Hawaiʻi it is a canoe plant (Polynesian-introduced)." },
    monstera: { common: "Monstera", sci: "Monstera deliciosa", form: "groundcover", sources: ["sprites", "portfolio"], sheet: "tropical", origin: "tropical", stages: 3, moveCost: 2,
      trait: null, note: "Move cost 2: broad leaves and trailing stems underfoot." },
    // Carnivorous plants. Tagged for the trap system in ~/Documents/concept-combat-nature.md (B); they do nothing special yet.
    venusFlytrap: { common: "Venus flytrap", sci: "Dionaea muscipula", form: "groundcover", sources: ["sprites"], sheet: "tropical", origin: "temperate", verify: true, stages: 3, carnivorous: true,
      trait: null, note: "On the Tropical sheet; botanically a temperate bog plant." },
    sundew: { common: "Sundew", sci: "Drosera sp.", form: "groundcover", sources: ["sprites"], sheet: "tropical", origin: "tropical", verify: true, stages: 3, carnivorous: true,
      trait: null, note: "Sundews grow worldwide; Hawaiʻi has a native one (mikinalo). Origin here follows the sheet." },
    pitcherPlant: { common: "Pitcher plant", sci: "Nepenthes sp.", form: "shrub", sources: ["sprites"], sheet: "tropical", origin: "tropical", verify: true, stages: 3, carnivorous: true,
      trait: null },
    cobraLily: { common: "Cobra lily", sci: "Darlingtonia californica", form: "shrub", sources: ["sprites"], sheet: "tropical", origin: "temperate", verify: true, stages: 3, carnivorous: true,
      trait: null, note: "On the Tropical sheet; botanically a cool-bog plant of California and Oregon." },

    // ── hedges, shrubs, groundcover ───────────────────────────────────────
    indianHawthorn: { common: "Indian hawthorn", sci: "Rhaphiolepis indica", form: "hedge", origin: "tropical", sources: ["study:indian-hawthorn", "sprites"], sheet: "indianHawthorn", stages: 3,
      trait: { id: "leafSpot", text: "Once damaged, its cover drops to 0 (defoliated) but it still slows movement.", basis: "Entomosporium leaf spot defoliates Indian hawthorn (Indian Hawthorn study)." } },
    plumbago: { common: "Plumbago", sci: "Plumbago auriculata", form: "hedge", origin: "tropical", sources: ["punchbowl", "sprites"], sheet: "plumbago", note: "Listed as P. capensis in the source.",
      trait: null },
    mockOrange: { common: "Mock orange", sci: "Murraya paniculata", form: "hedge", origin: "tropical", sources: ["punchbowl", "sprites"], sheet: "mockOrange", stages: 3, sightHeight: 2,
      trait: { id: "denseHedge", text: "Sight height 2: blocks sight even from height 1.", basis: "Murraya is clipped into tall, dense formal hedges." } },
    naupaka: { common: "Naupaka kahakai", sci: "Scaevola taccada", form: "shrub", origin: "indigenous", sheet: "native", stages: 3, sources: ["fieldwork"],
      trait: { id: "saltSpray", text: "Unaffected by Swale / water-tagged effects.", basis: "A strand shrub tolerant of salt spray and coastal conditions." } },
    hau: { common: "Hau", sci: "Hibiscus tiliaceus", form: "shrub", origin: "indigenous", sources: ["biome", "study:milo", "sprites"], sheet: "generic", moveCost: 3,
      trait: { id: "thicket", text: "Move cost 3: tangled thicket.", basis: "Hau forms dense, tangled thickets along streams and shores (the Milo study's look-alike)." } },
    aalii: { common: "ʻAʻaliʻi", sci: "Dodonaea viscosa", form: "shrub", origin: "indigenous", sources: ["fieldwork", "sprites"], sheet: "generic",
      trait: { id: "pioneer", text: "Regrows 3 owner-rounds after being cleared.", basis: "A hardy pioneer on disturbed, dry, and lava sites (ties to Succession)." } },
    maoHauHele: { common: "Maʻo hau hele", sci: "Hibiscus brackenridgei", form: "shrub", origin: "endemic", sources: ["fieldwork", "sprites"], sheet: "generic",
      trait: null },
    pohinahina: { common: "Pōhinahina", sci: "Vitex rotundifolia", form: "groundcover", origin: "indigenous", sources: ["fieldwork", "sprites"], sheet: "pohinahina",
      trait: { id: "soilBinder", text: "Its tile resists Cut-and-fill regrading.", basis: "A sprawling dune groundcover that stabilises sand and soil." } },
    // Flora hot-builds wave 6 (Muse Berry BD, 2026-10-29): two unused art packs wired as species.
    passionflower: { common: "Passionflower", sci: "Passiflora edulis", form: "shrub", sources: ["sprites"], sheet: "passionflower", origin: "tropical", verify: true, stages: 3,
      trait: null, note: "Lilikoi. Vigorous woody vine grown as a shrub mass; intricate flowers, butterfly host." },
    puya: { common: "Puya", sci: "Puya alpestris", form: "shrub", sources: ["sprites"], sheet: "puya", origin: "temperate", verify: true, stages: 3,
      trait: null, note: "Sapphire tower. Spiky bromeliad rosette with a tall hummingbird-pollinated spike; spines noted, no object behavior yet." },
  };

  // ── non-plant destructibles (site furniture) ─────────────────────────────
  // tags: ["structure"] on everything built (Mala, 2026-10-18: "add the structure tag to any artificial structure"):
  // destructive attacks (Anti-Urbanism) deal double to structures. Natural things (boulders, roots, logs, stumps) are not.
  // becomes: terrain char left behind; spawns: object left behind.
  const objects = {
    planter:  { name: "Planter box", tags: ["structure"], blocksMove: true,  moveCost: 0, sightHeight: 1, cover: 0.5,  hp: 12, material: "wood",  becomes: "m", text: "Breaks into loose soil (mulch)." },
    bench:    { name: "Bench", tags: ["structure"],       blocksMove: true,  moveCost: 0, sightHeight: 0, cover: 0.25, hp: 10, material: "wood",  becomes: "*", text: "Splinters into rubble." },
    bollard:  { name: "Bollard", tags: ["structure"],     blocksMove: true,  moveCost: 0, sightHeight: 0, cover: 0.25, hp: 20, material: "stone", becomes: ".", text: "Knocked flat." },
    fence:    { name: "Fence", tags: ["structure"],       blocksMove: true,  moveCost: 0, sightHeight: 0, cover: 0,    hp: 8,  material: "wood",  becomes: ",", text: "Breaking it opens a route: an edge returns to the graph." },
    window:   { name: "Window", tags: ["structure"],      blocksMove: true,  moveCost: 0, sightHeight: 0, cover: 0,    hp: 6,  material: "glass", becomes: ".", window: true, text: "Glass. Someone inside can look out. From outside, you see through it only within 4 tiles. A shot passes through; breaking the frame opens the tile." },
    cistern:  { name: "Cistern", tags: ["structure"],     blocksMove: true,  moveCost: 0, sightHeight: 2, cover: 1,    hp: 14, material: "stone", becomes: "w", flood: 1, text: "Bursts: its tile and walkable neighbours become shallow water." },
    boulder:  { name: "Boulder",     blocksMove: true,  moveCost: 0, sightHeight: 2, cover: 1,    hp: 30, material: "stone", becomes: "*", text: "Shatters into thorn-sharp rubble." },
    roots:    { name: "Prop-root tangle", blocksMove: false, moveCost: 3, sightHeight: 1, cover: 0.25, hp: 6, material: "wood", becomes: ",", text: "Left by a felled banyan: slow, partial cover." },
    log:      { name: "Fallen log",  blocksMove: true,  moveCost: 0, sightHeight: 1, cover: 0.5,  hp: 10, material: "wood",  becomes: "m", text: "Breaks down to mulch." },
    stump:    { name: "Stump",       blocksMove: false, moveCost: 2, sightHeight: 0, cover: 0,    hp: 12, material: "wood",  becomes: ",", text: "What remains of a felled tree. It can be dug out." },
    // Left by palingenesis, never by map scatter. The residue is the plant. Scatter it and the form is gone.
    ashes:    { name: "Ashes",       blocksMove: false, moveCost: 1, sightHeight: 0, cover: 0,    hp: 6,  material: "plant", becomes: ",", text: "What a burned plant leaves. The original form can be called back once. Scatter the ashes and there is nothing to call." },
    // Placed by a character, not by map generation (Modern Artist, classes/class-runtime.js artistDeploy).
    workstation: { name: "Digital workstation", tags: ["structure"], building: true, blocksMove: false, moveCost: 1, sightHeight: 0, cover: 0, hp: 18, material: "metal", becomes: ".", placedOnly: true, text: "A finite tool: breaks to bare ground, and what depended on it stops." },
    // Raised by the Tech Billionaire for 1 Inspiration (classes/class-runtime.js platformDataCenter; docs/data-center.md).
    // One tile, blocks the square. loosePanels is read by the drops slice (terrain/pickups.js) once that lands.
    dataCenter: { name: "Data center", tags: ["structure"], building: true, blocksMove: true, moveCost: 0, sightHeight: 1, cover: 0.5, hp: 36, material: "metal", becomes: ".", placedOnly: true, trait: "loosePanels", text: "His AGI runs on it: break it and the AGI reroutes. It cannot be rebuilt without more Inspiration." },
    monument: { name: "Monument", tags: ["structure"],    blocksMove: true,  moveCost: 0, sightHeight: 3, cover: 1,    hp: 60, material: "stone", becomes: "*", text: "Memorial stone: the hardest thing on the map to break (60 HP), but it can be broken." },
    // Pillars (Muse-2 slice, staged-art/pillar-review; landed 2026-10-16, muse): destructible
    // classical cover. Nothing on the map is indestructible (Mala, 2026-10-14), so these carry
    // real HP: 40 whole, 25 for the already-broken one. All fall to rubble.
    pillarAncientStone:     { name: "Ancient stone pillar", tags: ["structure"],  blocksMove: true, moveCost: 0, sightHeight: 2, cover: 0.5, hp: 40, material: "stone", becomes: "*", text: "Old stone: solid cover until it falls to rubble." },
    pillarAncientBroken:    { name: "Broken pillar", tags: ["structure"],          blocksMove: true, moveCost: 0, sightHeight: 1, cover: 0.25, hp: 25, material: "stone", becomes: "*", text: "Already half-fallen: low cover, and less of it to break." },
    pillarDoricLimestone:   { name: "Doric pillar", tags: ["structure"],           blocksMove: true, moveCost: 0, sightHeight: 2, cover: 0.5, hp: 40, material: "stone", becomes: "*", text: "Fluted limestone: solid cover until it falls to rubble." },
    pillarIonicMarble:      { name: "Ionic pillar", tags: ["structure"],           blocksMove: true, moveCost: 0, sightHeight: 2, cover: 0.5, hp: 40, material: "stone", becomes: "*", text: "Scrolled marble: solid cover until it falls to rubble." },
    pillarCorinthianMarble: { name: "Corinthian pillar", tags: ["structure"],      blocksMove: true, moveCost: 0, sightHeight: 2, cover: 0.5, hp: 40, material: "stone", becomes: "*", text: "Acanthus-crowned marble: solid cover until it falls to rubble." },
    pillarTuscanGranite:    { name: "Tuscan pillar", tags: ["structure"],          blocksMove: true, moveCost: 0, sightHeight: 2, cover: 0.5, hp: 40, material: "stone", becomes: "*", text: "Plain granite: solid cover until it falls to rubble." },
    pillarCompositePorphyry:{ name: "Composite pillar", tags: ["structure"],       blocksMove: true, moveCost: 0, sightHeight: 2, cover: 0.5, hp: 40, material: "stone", becomes: "*", text: "Porphyry composite: solid cover until it falls to rubble." },
    pillarRomanBrick:       { name: "Roman brick pillar", tags: ["structure"],     blocksMove: true, moveCost: 0, sightHeight: 2, cover: 0.5, hp: 40, material: "stone", becomes: "*", text: "Brick-faced concrete: solid cover until it falls to rubble." },
    pillarOrnateGilded:     { name: "Gilded pillar", tags: ["structure"],          blocksMove: true, moveCost: 0, sightHeight: 2, cover: 0.5, hp: 40, material: "stone", becomes: "*", text: "Gilded and proud: solid cover until it falls to rubble." },
    pillarOrnateMarble:     { name: "Ornate marble pillar", tags: ["structure"],   blocksMove: true, moveCost: 0, sightHeight: 2, cover: 0.5, hp: 40, material: "stone", becomes: "*", text: "Carved marble: solid cover until it falls to rubble." },
    // Parterre (Mala, 2026-10-26: "we can use the objects as structures on the map, as well as in the backgrounds"; Muse's cut,
    // sprites/objects/parterre/). Built pieces carry `structure`; the topiary and the clipped hedge are living, so they do not.
    parterreFountain: { name: "Parterre fountain", tags: ["structure"], blocksMove: true,  moveCost: 0, sightHeight: 1, cover: 0.5,  hp: 30, material: "stone", becomes: "w", text: "Breaks open: its tile becomes shallow water." },
    parterreStatue:   { name: "Garden statue", tags: ["structure"],     blocksMove: true,  moveCost: 0, sightHeight: 2, cover: 0.5,  hp: 35, material: "stone", becomes: "*", text: "Marble on a plinth: solid cover until it falls to rubble." },
    parterreUrn:      { name: "Garden urn", tags: ["structure"],        blocksMove: true,  moveCost: 0, sightHeight: 0, cover: 0.25, hp: 10, material: "stone", becomes: "m", text: "Shatters and spills its soil (mulch)." },
    parterreGate:     { name: "Garden gate", tags: ["structure"],       blocksMove: true,  moveCost: 0, sightHeight: 1, cover: 0.5,  hp: 24, material: "metal", becomes: ".", text: "Wrought iron between stone posts: break it and the way is open." },
    parterreTopiary:  { name: "Topiary", tags: [],                      blocksMove: true,  moveCost: 0, sightHeight: 1, cover: 0.5,  hp: 14, material: "wood",  becomes: ",", text: "Clipped yew: living cover. Cut down, it leaves turf." },
    parterreHedge:    { name: "Clipped hedge", tags: [],                blocksMove: false, moveCost: 1, sightHeight: 0, cover: 0.25, hp: 8,  material: "wood",  becomes: ",", text: "Knee-high box hedge: slow to push through, and it hides a crouch." },
  };

  // ── biome palettes (keyed by archetype), weights ─────────────────────────
  // tree/hedge fill the authored 'T' / 'h' slots in parts and arenas; scatter adds a few
  // symmetric extras on open soil or paving.
  const biomes = {
    terrace: { name: "Formal garden",
      tree:  { fukugi: 3, rainbowShower: 2, kou: 1, loulu: 2, ulu: 1 },
      hedge: { indianHawthorn: 3, plumbago: 2, mockOrange: 2, hibiscus: 2 },
      scatter: { maoHauHele: 2, aalii: 1, pohinahina: 2, ti: 2, birdOfParadise: 2, hibiscus: 1, ukiuki: 1, planter: 3, bench: 2, bollard: 1, pillarDoricLimestone: 1, pillarIonicMarble: 1, parterreUrn: 2, parterreTopiary: 2, parterreStatue: 1, parterreFountain: 1, parterreHedge: 1 }, scatterPairs: [3, 5] },
    wetland: { name: "Coastal wetland",
      tree:  { milo: 3, paperbark: 2, kou: 2 },
      hedge: { naupaka: 3, hau: 2 },
      scatter: { naupaka: 2, hau: 1, pohinahina: 2, akulikuli: 3, sundew: 2, pitcherPlant: 2, venusFlytrap: 1, cobraLily: 1, cistern: 2, fence: 2, milo: 1, paperbark: 1 }, scatterPairs: [3, 5] },
    grove: { name: "Shade grove",
      tree:  { banyan: 3, monkeypod: 3, kukui: 2, ohia: 2, koa: 3, ulu: 2 },
      hedge: { mockOrange: 2, plumbago: 1 },
      scatter: { maoHauHele: 1, aalii: 1, pohinahina: 1, nativeFern: 3, monstera: 2, ti: 2, ukiuki: 1, passionflower: 1, bench: 2, log: 2, boulder: 1 }, scatterPairs: [3, 5] },
    quarry: { name: "Dry disturbed ground",
      tree:  { kiawe: 3, eucalyptus: 2, wiliwili: 2, bristlecone: 1 },
      hedge: { aalii: 3, ohelo: 2 },
      scatter: { aalii: 2, ohelo: 2, kiawe: 1, puya: 1, boulder: 3, fence: 1, cistern: 1 }, scatterPairs: [3, 4] },
    // Palettes made only of species with their own sprites (Mala, 2026-10-14: plants on maps should be the sprite art,
    // not the painted stand-ins). An authored map picks one with "biome" in its recipe; seeded maps are unchanged.
    nativeGarden: { name: "Native Hawaiian garden",
      tree:  { ohia: 3, koa: 3, loulu: 2, wiliwili: 2, ulu: 1 },
      hedge: { naupaka: 3, ohelo: 2, ti: 2 },
      scatter: { nativeFern: 3, ukiuki: 2, akulikuli: 2, ti: 2, ohelo: 1, naupaka: 1, bench: 2, planter: 1 }, scatterPairs: [3, 5] },
    tropicalGarden: { name: "Tropical garden",
      tree:  { ulu: 3, loulu: 2, wiliwili: 1 },
      hedge: { hibiscus: 3, indianHawthorn: 2, ti: 2, passionflower: 2 },
      scatter: { birdOfParadise: 3, monstera: 3, ti: 2, hibiscus: 2, sundew: 1, pitcherPlant: 1, bench: 2, planter: 2 }, scatterPairs: [3, 5] },
    // A formal parterre for authored maps ("biome": "parterre" in a recipe): clipped hedges, urns, statues and a fountain.
    parterre: { name: "Parterre garden",
      tree:  { fukugi: 3, kou: 1 },
      hedge: { indianHawthorn: 3, mockOrange: 2, plumbago: 1 },
      scatter: { parterreUrn: 3, parterreTopiary: 3, parterreStatue: 2, parterreFountain: 1, parterreHedge: 2, bench: 1 }, scatterPairs: [3, 5] },
    rim: { name: "Memorial crater",
      tree:  { monkeypod: 2, banyan: 2, rainbowShower: 2, kou: 1, bo: 1, fukugi: 1, ohia: 1 },
      hedge: { plumbago: 3, mockOrange: 2 },
      scatter: { maoHauHele: 1, pohinahina: 1, ohelo: 2, ti: 1, nativeFern: 1, ukiuki: 1, monument: 2, bench: 2, bollard: 1, bo: 1, pillarAncientStone: 1, pillarOrnateMarble: 1, pillarAncientBroken: 1 }, scatterPairs: [3, 4] },
  };

  const rules = {
    // Walking through planting is slow (Mala, 2026-10-10): a step onto a tile holding a living, walkable plant costs
    // ×1.5 action points. A mover with the `hiker` trait pays the ordinary cost. Flyers are unaffected.
    plantMove: { apMul: 1.5, exemptTrait: "hiker" },
    slotTerrain: { T: "m", h: "," },   // terrain left under a tree / hedge slot once a plant object sits there
    scatterOn: [",", "m", "."],        // tiles that may receive scattered objects (+ "w" for wetTolerant species)
    felling: { length: 2, damage: 10, channel: "nigredo", stagger: true },  // a felled tree falls away from the hit
    areaDamageToObjects: 0.5,          // radius/field effects hit objects at half potency
    // Line deliveries damage EVERY object they pass through (Mala, 2026-10-07).
    //   soft objects (walkable: hedges, shrubs, roots) take the hit and the line continues,
    //     weakened by the object's cover (min 25% absorbed);
    //   hard objects (block movement) take the hit and stop the line, unless the hit destroys
    //     them: the overflow (potency − HP it took to break) carries on.
    //   An object is in the way only if it stands taller than the line: ground height +
    //   profile > the higher endpoint's height (shooting from high ground passes over hedges).
    line: { minAbsorb: 0.25, overflowContinues: true },
    // A unit shoved into an object (or a felled trunk / log landing on one) damages it.
    collision: { objectDamagePerTile: 6, unitDamage: 4, crashThrough: true, trunkHitsObjects: true, maxChain: 3 },
    materials: { wood: { nigredo: 1.25 }, stone: { nigredo: 0.75 }, plant: { citrinitas: 1.25 } },  // harm-channel multipliers
  };

  // Buildings (Mala, 2026-10-13; docs/buildings.md): structures someone PLACES during a battle that have an HP bar. Today
  // the Modern Artist's workstation and the Tech Billionaire's data center; the Agent Swarm's drone towers and later
  // buildings join by setting `building: true` on their entry. Map furniture (benches, planters, boulders) is not a
  // building, and nor is anything protected or indestructible. Read by type, so an object placed by code counts too.
  const isBuilding = (o) => { if (o?.tower && (o.hp ?? 0) > 0) return true;   // a drone tower makes whatever carries it a building
    const d = o && objects[o.type]; return !!d?.building && !!d.placedOnly && !d.indestructible && !d.protected && !o.protected && (o.maxHp ?? d.hp ?? 0) > 0; };
  const buildingTypes = Object.keys(objects).filter((k) => objects[k].building);
  return { forms, species, objects, biomes, rules, isBuilding, buildingTypes };
});
