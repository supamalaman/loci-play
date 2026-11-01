"use strict";
// Climate and microclimate for Concept Combat (Mala, 2026-10-08): "Wet, windy, sun, shade and other
// climatic data, as well as microclimates on maps, should have an impact on the effectiveness of some abilities."
// Plain data. Rules live in climate.js. Spec: ~/Documents/concept-combat-climate.md. Every number is PROVISIONAL.
//
// Two layers:
//   weather       one per battle, visible to everyone, can shift at a round boundary (announced a round ahead);
//   microclimate  per tile, derived from the map + objects + weather: canopy, shade, wet, exposed, sheltered,
//                 tunnel, sunbaked, fogPool. These are real site-design effects (see `basis`), so placing
//                 yourself well teaches what a landscape architect reads off a site.
// Channels (content.js damageTypes): nigredo impact · albedo piercing/sight · citrinitas propagation · rubedo resonance/living.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatClimateData = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const weather = {
    sunny:    { name: "Clear sun", sun: true,  rain: false, wind: 0, fog: false, heat: false, text: "Hard light and hard shadows." },
    overcast: { name: "Overcast",  sun: false, rain: false, wind: 0, fog: false, heat: false, text: "Flat, even light. The neutral sky: no sun or shade effects." },
    rain:     { name: "Rain",      sun: false, rain: true,  wind: 0, fog: false, heat: false, text: "Everything in the open is wet. Canopy holds the rain off for a while." },
    windy:    { name: "Trade wind", sun: true, rain: false, wind: 1, fog: false, heat: false, text: "A steady wind. What spreads goes with it." },
    squall:   { name: "Squall",    sun: false, rain: true,  wind: 2, fog: false, heat: false, text: "Driving rain on a strong wind." },
    fog:      { name: "Fog",       sun: false, rain: false, wind: 0, fog: true,  heat: false, text: "Sight shortens; low ground fills first." },
    heat:     { name: "Heat",      sun: true,  rain: false, wind: 0, fog: false, heat: true,  text: "Paving bakes. Standing in the sun costs you." },
  };

  // Which weathers each archetype tends to get (weights). Rim = exposed crater edge; wetland = low and damp.
  const archetypeWeather = {
    terrace: { sunny: 3, overcast: 2, windy: 2, rain: 1, heat: 1, fog: 0.5 },
    wetland: { rain: 3, overcast: 2, fog: 2, sunny: 1, windy: 1, squall: 0.5 },
    grove:   { overcast: 2, sunny: 2, rain: 2, fog: 1, windy: 1 },
    quarry:  { sunny: 3, heat: 3, windy: 2, overcast: 1 },
    rim:     { windy: 4, sunny: 2, fog: 2, overcast: 1, squall: 1 },
    default: { sunny: 2, overcast: 2, windy: 1, rain: 1, fog: 0.5, heat: 0.5 },
  };

  // Weather shifts only to a neighbour, and is forecast one round ahead (announced to both sides).
  const transitions = {
    sunny: ["overcast", "windy", "heat"], overcast: ["sunny", "rain", "fog"], rain: ["overcast", "squall"],
    windy: ["sunny", "squall"], squall: ["rain", "windy"], fog: ["overcast", "sunny"], heat: ["sunny"],
  };

  const rules = {
    shiftChance: 0.2,              // per round boundary, once the current weather has lasted 2 rounds
    minRounds: 2,
    // Trade winds: on Oʻahu they blow from the east-northeast most of the year. Wind vector = direction it blows TOWARD.
    windDirs: [{ w: 6, from: "east", to: [-1, 0] }, { w: 1, from: "north", to: [0, 1] }, { w: 1, from: "west", to: [1, 0] }, { w: 1, from: "south", to: [0, -1] }],
    shadowDir: [0, 1],             // the sun stands to the north side of the map (y−); shadows fall toward y+
    shelterPerHeight: 2,           // a standing windbreak (hedge, wall, tree) shelters this many tiles downwind per level of its height
    shelterPerStep: 1,             // a bare rise in the ground shelters only this many per level
    exposedHeight: 2,              // tiles at height ≥ this are exposed to wind
    canopyHoldsRainRounds: 2,      // canopy tiles stay dry for this many rounds of rain (interception), then drip
    fogSight: { high: 4, low: 2 }, // max sight/line range in fog; low = height 0 next to higher ground (fog pools)
    heatStress: 3,                 // LF lost at end of turn on a sunbaked tile in Heat
    clamp: [0.7, 1.3],             // total climate multiplier on one hit never leaves this band
  };

  // How a site produces its microclimate. `basis` is what the effect teaches.
  const micro = {
    canopy:    { name: "Under canopy", basis: "A tree crown intercepts light and the first rain; under it is cooler and stays dry for a while." },
    shade:     { name: "Shade",        basis: "Only with the sun out: under a canopy, or in the shadow cast by anything tall (tree, pillar, higher ground)." },
    wet:       { name: "Wet",          basis: "Water tiles and their edges, rain gardens and swales, and everything in the open when it rains." },
    exposed:   { name: "Exposed",      basis: "High ground takes the full wind." },
    sheltered: { name: "Sheltered",    basis: "A windbreak calms the air downwind of it for a distance that grows with its height." },
    tunnel:    { name: "Wind tunnel",  basis: "Wind squeezed between two obstacles speeds up (channelling between buildings)." },
    sunbaked:  { name: "Sun-baked",    basis: "Hard paving in full sun stores heat: the urban heat island at tile scale." },
    fogPool:   { name: "Fog pool",     basis: "Cool, heavy air drains downhill and settles in hollows, so fog is thickest in low ground." },
  };

  // Ability modifiers. Each rule: when (weather/micro test), match (which abilities), and the change.
  // `side`: which tile's microclimate counts: "target" (where it lands) or "caster" (where it's thrown from).
  // Match keys: channel, delivery (list), concept, effect (substring), any (all abilities).
  const modifiers = [
    // ── wind ──
    { id: "windCarries", when: "wind", side: "caster", match: { channel: "citrinitas", delivery: ["field", "routed", "placed", "line"] },
      downwind: 1.2, upwind: 0.8, text: "The wind carries what propagates: stronger downwind, weaker into it.", teaches: "Diffusion and spread follow the air." },
    { id: "windDeflects", when: "wind", side: "caster", match: { delivery: ["line"], notChannel: "citrinitas" },
      upwind: 0.9, crosswind: 0.9, downwindRange: 1, text: "Projectiles drift: into or across the wind they lose force; downwind they fly 1 farther." },
    { id: "diffusionDrifts", when: "wind", side: "caster", match: { concept: "diffusion" },
      drift: true, text: "A Diffusion area drifts one tile downwind." },
    { id: "fireRuns", when: "wind", side: "caster", match: { effect: ["ignite", "igniteAll"] },
      downwind: 1.25, flags: { fireSpreadsDownwind: true }, text: "Fire runs with the wind." },
    // ── wet ──
    { id: "waterCarries", when: "wet", side: "target", match: { channel: "rubedo" },
      mul: 1.2, text: "Water carries vibration and feeds living things: Rubedo ×1.2 on wet ground." },
    { id: "slick", when: "wet", side: "target", match: { channel: "nigredo" },
      flags: { knockbackAdd: 1 }, text: "Wet ground is slick: impact shoves 1 tile farther." },
    { id: "doused", when: "wet", side: "target", match: { effect: ["ignite", "igniteAll"] },
      mul: 0.75, flags: { noIgnite: true }, text: "It won't catch on wet ground: ×0.75 and no ignition." },
    { id: "waterworks", when: "wet", side: "target", match: { effect: ["swale", "rainGarden", "checkDam"] },
      flags: { primed: true }, text: "On wet ground the swale, rain garden or check dam fills at once." },
    { id: "slump", when: "wet", side: "target", match: { effect: ["berm", "bermRing"] },
      flags: { structureHpMul: 0.75 }, text: "Wet soil slumps: berms built on it have ×0.75 HP." },
    { id: "rainObscures", when: "rain", side: "target", match: { delivery: ["line"], channel: "albedo" },
      mul: 0.9, text: "Rain blurs a sight line: Albedo lines ×0.9." },
    { id: "rainDouses", when: "rain", side: "target", match: { ability: ["emberBreath", "infernoRoar", "kitsuneFoxfire", "flare", "fireBreath", "inferno"] },
      mul: 0.85, text: "Rain hisses on open flame: fire ×0.85." },   // Mala ruling 2026-10-18. Registry, not effect-match: live fire carries effect "damage" and match keys AND, so an ignite key would void the rule. New flame kits (dragonfire) register ids here.
    // ── sun and shade ──
    { id: "clearLight", when: "sunlit", side: "target", match: { channel: "albedo", delivery: ["line"] },
      mul: 1.1, rangeAdd: 1, text: "In clear light a sight line reaches 1 farther and hits ×1.1." },
    { id: "intoShade", when: "shade", side: "target", match: { channel: "albedo" },
      mul: 0.85, text: "Hard to pick out a target in deep shade on a bright day: Albedo ×0.85." },
    { id: "shadeHides", when: "shade", side: "caster", match: { concept: "deception" },
      mul: 1.2, text: "Tells are hard to read from the shade: Deception ×1.2." },
    { id: "sunShowsTells", when: "sunlit", side: "caster", match: { concept: "deception" },
      mul: 0.9, text: "Full sun shows every tell: Deception ×0.9." },
    { id: "pioneersNeedLight", when: "shade", side: "target", match: { effect: "successionPatch" },
      flags: { growthMul: 0.5 }, text: "Pioneer plants need light: in shade the patch matures at half speed.", teaches: "Early succession is light-demanding; shade favours later, shade-tolerant species." },
    { id: "shadeTolerant", when: "shade", side: "caster", match: { effect: "oldGrowth" },
      mul: 1.2, text: "Old growth is at home in shade: ×1.2." },
    // ── heat ──
    { id: "heatFeedsFire", when: "heat", side: "target", match: { effect: ["ignite", "igniteAll"] },
      mul: 1.25, text: "Dry heat: fire ×1.25." },
    { id: "heatShimmer", when: "sunbaked", side: "target", match: { delivery: ["line"], channel: "albedo" },
      mul: 0.9, text: "Heat shimmer off baked paving bends a sight line: ×0.9." },
    // ── fog ──
    { id: "fogLimits", when: "fog", side: "caster", match: { delivery: ["line"] },
      flags: { maxRange: "fogSight" }, text: "In fog a line can only reach as far as you can see (4; 2 from a fog pool)." },
    { id: "fogBlunts", when: "fog", side: "target", match: { channel: "albedo" },
      mul: 0.85, text: "Fog blunts what depends on sight: Albedo ×0.85." },
    { id: "fogHides", when: "fog", side: "caster", match: { concept: "deception" },
      mul: 1.25, text: "Fog is a deceiver's friend: Deception ×1.25." },
    { id: "routesNeedNoSight", when: "fog", side: "caster", match: { delivery: ["routed"] },
      mul: 1.1, text: "Routes don't need sight: routed attacks ×1.1 in fog (everyone else is worse off).", teaches: "A path you know is a path you don't have to see." },
  ];

  // Abilities that CHANGE microclimate (for the engine to apply; listed so the graph and kits can point at them).
  const changers = {
    crownRaise:  "Raising a crown thins its canopy: the tree's shade radius drops by 1 for the battle.",
    prune:       "Pruning a tree removes its canopy tile under the cut.",
    rainGarden:  "Makes its tiles wet (and keeps them wet).",
    bioswale:    "Makes its tiles wet.",
    checkDam:    "Ponds water: the tile upstream becomes wet.",
    earthBerm:   "A berm is a windbreak (height 1): it shelters 2 tiles downwind.",
    keylineTerrace: "A terrace is a windbreak and holds water: wet on its upslope side.",
    shieldWall:  "A wall is a windbreak and casts shade.",
    fenceLine:   "A fence is a windbreak (height 1).",
    pioneerPatch:"At its last stage the patch casts canopy (radius 0: its own tile).",
  };

  // ── Observe the place: the weather cards (Mala, 2026-10-08: "observe giving weather data is a great idea as long
  // as it works with the ULT mechanic still"). Same deck format and AP rules as Observe (insight.js); a place's
  // deck will grow terrain/hidden/genius-loci cards later, and these are its sky.
  // Public to everyone without observing: the current weather, a 1-round forecast, and the obvious tiles.
  const observe = {
    cards: [
      { id: "feel",   difficulty: 0, open: true, text: (w, a) => `${w.name}, wind from the ${a.windFrom}.` },
      { id: "readSky", difficulty: 1, text: () => "You read the sky: you see the weather two rounds ahead, not one.", grants: { forecastRounds: 2 } },
      { id: "lee",    difficulty: 2, text: () => "You feel where the air goes: shelter, wind tunnels, where fog will pool, and how long the canopy keeps the rain off.", grants: { subtleMicro: true } },
      { id: "habit",  difficulty: 3, text: (w, a, place) => `This place's weather habit: ${place}. You'll remember it, and you can dream it.`, grants: { dreamWeather: true } },
    ],
    publicMicro: ["shade", "wet", "sunbaked", "exposed"],          // anyone can see these
    subtleMicro: ["sheltered", "tunnel", "fogPool", "canopy"],     // only after the "lee" card
    familiarityShare: 0.25,      // the sky is a quarter of knowing a place (terrain facts, hidden things, genius loci are the rest)
    // How it sits with the ultimate bar:
    ult: {
      directCharge: 0,           // observing the place never charges the bar (only Observe Self does); no charge farming
      payoff: "Place familiarity lowers what a Dream Space needs and slows its drain (dreamspace.openCost).",
      inDreamSpace: "blocked",   // inside a Dream Space the sky is the dreamer's: you can't observe the place
      dreamFreezesWeather: true, // while a Dream Space is open the real weather and its forecast wait; the bar is the only clock
    },
  };

  return { weather, archetypeWeather, transitions, rules, micro, modifiers, changers, observe };
});
