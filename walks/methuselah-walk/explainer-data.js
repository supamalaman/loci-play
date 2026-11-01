/* Walk with Methuselah — a walkable explainer (memory palace) of the Methuselah Tree.
 *
 * The prose sections and sources are reused verbatim from the classic explainer
 * (explainers/the-methuselah-tree/), so every station's claim traces to the same
 * sourced text. The walk climbs a White Mountains trail; the ten stations are the loci,
 * in story order, ending at the ancient tree. The map is generated once and stored here.
 *
 * Validate:  node build/build.mjs methuselah-walk
 */
window.ExplainerData = {
  meta: {
    browserTitle: "Walk with Methuselah",
    sourceLinks: [
      { label: "Wikipedia", href: "https://en.wikipedia.org/wiki/Methuselah_(pine_tree)" },
      { label: "Gymnosperm Database", href: "https://www.conifers.org/pi/Pinus_longaeva.php" },
      { label: "Classic explainer", href: "../the-methuselah-tree/index.html" }
    ]
  },

  hero: {
    eyebrow: "Walkable explainer · Pinus longaeva · White Mountains, California",
    title: "Walk with Methuselah",
    dek: "Climb the trail to the oldest known bristlecone pine. Ten stations tell its story in order: cone, needles, soil, the living strip, the people who dated it, the tree that was lost, and the new threat. Walk it once to learn it; walk it in Recall mode to remember it."
  },

  sections: {
    mechanism: {
      eyebrow: "How it lives this long",
      title: "Strip-bark growth",
      blocks: [
        { text: "Most trees keep their whole trunk circumference alive — a continuous ring of bark and cambium wrapping the wood. Bristlecone pines under stress do something stranger: they let bark die back over most of the trunk, sometimes down to a single narrow band running up the sheltered side. Everything outside that strip is dead, weathered, sculptural deadwood. Everything inside it is still fully alive." },
        { text: "Researchers think this is a real survival strategy, not decline. By restricting the living cambium to a narrow strip, the tree can lay down a thicker, healthier annual ring on that strip than the same total growth would produce if spread thin across the whole circumference — keeping one functional pipeline between roots and crown in good repair indefinitely, even as the rest of the tree is abandoned." },
        { className: "note", text: "The figure below is a conceptual illustration of that relationship, not a plot of measured field data — real strip widths and ring thickness vary by site, individual, and decade. It exists to make the mechanism legible, not to stand in for the dendrochronology itself." }
      ]
    },

    botany: {
      eyebrow: "Botany",
      title: "Scientific name, description, physiology",
      blocks: [
        { html: "<strong>Pinus longaeva</strong> D.K. Bailey (Great Basin bristlecone pine, also called intermountain bristlecone pine) was formally described in 1970, split out from the closely related Rocky Mountain bristlecone pine, <em>Pinus aristata</em>. It sits in subgenus <em>Strobus</em>, section <em>Parrya</em>, subsection <em>Balfourianae</em> — the small group of five-needle pines named for their bristle-tipped cone scales." },
        { text: "A mature individual can reach about 65 feet tall with a trunk up to 80 inches across, though the oldest specimens are usually far smaller and gnarled, sometimes reduced to krummholz at the alpine tree line. Bark is red-brown and fissured into thick, scaly, blocky ridges. Needles grow five to a fascicle, deep yellow-green, and are retained for up to about 45 years — the longest needle lifespan documented in any conifer, letting the tree photosynthesize for decades without spending energy on new foliage. Cones are fist-sized, with scales tipped in a long, curved bristle, the feature that gives the species its common name." },
        { text: "Physiologically, bristlecone pines show close to no measurable age-related decline: studies comparing cambial and xylem function across trees from 23 to over 4,700 years old found no statistically significant differences tied to age alone. Proposed mechanisms include maintained telomere length and telomerase activity in meristem tissue, unusually high constitutive resin and monoterpene production that deters biotic attack, dense wood, and — the headline strategy — strip-bark growth, which lets the tree keep one narrow living pipeline in good repair rather than maintaining a whole trunk it can no longer support." },
        { text: "Methuselah itself was cored and dated in 1957 by dendrochronologist Edmund Schulman, who announced it the following year as the oldest known living tree. Its precise location in California's Ancient Bristlecone Pine Forest is kept undisclosed. That secrecy exists because of what happened seven years later: in 1964, a graduate student researching Little Ice Age climate cut down a bristlecone on Nevada's Wheeler Peak, nicknamed Prometheus, after a coring tool broke — and only afterward discovered, by counting its rings, that it was likely even older than Methuselah. The species' oldest individuals are now protected primarily by not being findable." }
      ]
    },

    arboriculture: {
      eyebrow: "Arboriculture",
      title: "What an arborist should know",
      blocks: [
        { text: "The single most important fact for anyone assessing a bristlecone pine: a trunk that's mostly dead, bare wood with one narrow living strip is not a defect. It's the species' normal, load-bearing survival anatomy, and for a stressed, high-elevation individual it can mean the tree is doing exactly what it evolved to do. Reading strip-bark form as severe dieback and prescribing intervention would work against the tree's own strategy, not for it." },
        { text: "Wild, ancient individuals like Methuselah receive essentially no arboricultural care at all — the entire conservation approach is hands-off protection (undisclosed location, no signage, no trail to it) precisely because human contact and disturbance, not disease or pests, is the species' primary documented threat to date." },
        { text: "That said, the threat picture is starting to change. Great Basin bristlecone pine was long considered functionally immune to the bark beetles that devastate other high-elevation pines. Between 2013 and 2020, researchers documented the first confirmed bark beetle attacks on the species (Ips confusus and mountain pine beetle), coinciding with rising temperature and the driest conditions on record for the site in 40 years — mortality was concentrated where bristlecone grows mixed with or near beetle-source host species like limber pine, and beetles produced few viable offspring in bristlecone tissue even when they did attack. It isn't a self-sustaining host yet, but climate-driven drought stress is visibly eroding a resistance that used to be treated as absolute." },
        { className: "note", text: "Practical takeaway for a high-elevation specimen under active management: avoid soil disturbance and irrigation in the root zone (the species is adapted to scarcity, and added moisture can work against it), and don't treat strip-bark form itself as something to correct." }
      ]
    },

    horticulture: {
      eyebrow: "Horticulture",
      title: "Growing conditions and pests",
      blocks: [
        { text: "What's actually sold as “bristlecone pine” at most nurseries is Pinus aristata, the Rocky Mountain species, not true Pinus longaeva — worth checking before assuming cultivation notes for one apply cleanly to the other. The two are closely related but differ meaningfully in pest resistance." },
        { text: "Pinus aristata is a confirmed host for mountain pine beetle and is also susceptible to white pine blister rust, dwarf mistletoe, aphids, and needle scale — a real pest list to plan for in cultivation. Pinus longaeva, by contrast, was not historically considered an acceptable host for mountain pine beetle at all: its high resin and monoterpene output appears to chemically repel host-seeking beetles, which orient toward the volatile signature of true hosts like limber pine and away from bristlecone's. (See Arboriculture for how drought stress is beginning to test that resistance in the wild.)" },
        { text: "Where it will grow, cultivation is slow and specific rather than difficult: full sun, sharp drainage, and poor, rocky, often alkaline soil — conditions most ornamental plants are chosen to avoid. It tolerates cold high-elevation climates well but does poorly in humid or consistently wet-soil regions, and growth is measured in decades, not seasons." }
      ]
    },

    landscapeArchitecture: {
      eyebrow: "Landscape Architecture",
      title: "Siting, structures, and design role",
      blocks: [
        { text: "A bristlecone pine is not a shade tree, a screen, or a fast-maturing structural element of a planting plan — over many decades in cultivation it typically settles at only 8 to 20 feet tall. In a designed landscape it functions as a specimen or accent: a slow-grown, gnarled, sculptural focal point valued for form and longevity symbolism rather than coverage or mass." },
        { text: "Its siting logic runs opposite to most ornamental trees. Rich, well-watered, competition-free soil doesn't help it — poor, sharply-drained, low-fertility ground is what keeps growth slow and controlled, which is part of what the species' longevity strategy depends on. Placing one in amended, irrigated garden soil intended for typical ornamentals can push it toward faster, weaker growth than the species is built for." },
        { text: "In the wild, Methuselah's stand occupies dolomite-derived alkaline soil at roughly 10,000 feet that most competing plants can't tolerate — sparse competition, not favorable conditions, is a real part of the survival picture, and it's a useful design principle beyond this one species: siting a slow specialist where faster competitors can't establish is sometimes the whole strategy." },
        { text: "Near structures and hardscape, its extremely slow root growth means it's an unusually low near-term risk to nearby paving or foundations compared to a fast-growing species — but because a mature specimen represents a multi-generational commitment once established, siting decisions should assume near-permanence rather than plan around eventually relocating or replacing it." }
      ]
    }
  },

  walk: {
    theme: "alpine",
    view: { w: 17, h: 11 },
    map: [
      "##########################",
      "#####o###__######o__####o#",
      "##__o_o___________o___o_o#",
      "##__oo_o________________##",
      "##o__o______=___________##",
      "##^^^o^^oo^^=^^^^^^^^^o^^#",
      "#^^^^o^^^^^^=^^^^^^^^^^^##",
      "#^^oo^o^^^^^=^^^^^^^oTT^^#",
      "#o^^^^^oT^^^=====^^^^Too##",
      "##^^^^TT^^^^^^^^=^^^T^T^##",
      "#^^o^^^^^^^^^^^^=^^o^^^^##",
      "##^^^^^^^^^^^^^^=^^^T^^^##",
      "##^oo^^^=========^^^^o^T##",
      "#.^^^^^^=^.^^..^^^^^.o^.##",
      "##T.....=............T..##",
      "##......=............TT.##",
      "##..T...=................#",
      "#....T..===========..T..##",
      "##..TT............=....T.#",
      "##.TTT............=...T.##",
      "##................=...T.##",
      "##.T..............=..TT.##",
      "##....=============..T.TT#",
      "##T...=...............TT.#",
      "##,T.,=..,,,,.,,.,..,,,.,#",
      "##Tt,,=,,,,,,,,,,,,,T,T,##",
      "##,,,,=,,,,,,,,TT,,TT,t*##",
      "##,,,,=======,,,*TTT,t,,##",
      "#,TT,,,,,,,,=,,T,TTT,TT,,#",
      "##T*,,,,,,,,=,,T,,,*tT*T##",
      "#t,,,t,,*,,,=,,**,,,ttt,,#",
      "############=#############"
    ],
    start: { x: 12, y: 30, facing: "up" },
    stations: [
      {
        "id": "trailhead",
        "x": 13,
        "y": 29,
        "object": "sign",
        "title": "The trailhead",
        "section": "botany",
        "cue": "Where does this walk take place, and why can't you find the tree?",
        "pages": [
          "Ancient Bristlecone Pine Forest, White Mountains, California. Somewhere up this ridge, around 10,000 feet, stands a Great Basin bristlecone pine older than the Great Pyramid of Giza.",
          "You won't find a sign pointing to it. Methuselah's exact location is kept undisclosed on purpose. Keep walking, and the stations will show you why."
        ]
      },
      {
        "id": "nursery",
        "x": 9,
        "y": 26,
        "object": "nursery",
        "title": "The nursery bench",
        "section": "horticulture",
        "cue": "What's usually sold as 'bristlecone pine', and what does it need?",
        "pages": [
          "Most nursery 'bristlecone pines' are Pinus aristata, the Rocky Mountain species, not the Great Basin Pinus longaeva. Close relatives, but they differ in pest resistance, so check before borrowing care notes.",
          "Where it grows, cultivation is slow rather than hard: full sun, sharp drainage, and poor, rocky, often alkaline soil. It struggles in humid or wet-soil regions, and growth is measured in decades."
        ]
      },
      {
        "id": "cone",
        "x": 5,
        "y": 24,
        "object": "cone",
        "title": "The bristled cone",
        "section": "botany",
        "cue": "Where does the name 'bristlecone' come from, and when was the species named?",
        "pages": [
          "Look at the cone scales: each ends in a long, curved bristle. That's the name. Pinus longaeva was described in 1970 by D.K. Bailey, split from the Rocky Mountain bristlecone, Pinus aristata.",
          "It belongs to subsection Balfourianae: a small group of five-needle pines named for those bristle-tipped scales."
        ]
      },
      {
        "id": "needles",
        "x": 10,
        "y": 21,
        "object": "needles",
        "title": "Needles that last decades",
        "section": "botany",
        "cue": "How many needles per bundle, and how long does each one live?",
        "pages": [
          "Five needles to a bundle, deep yellow-green. Each needle can stay on the tree for about 45 years, the longest needle lifespan documented in any conifer.",
          "Keeping leaves that long lets the tree keep photosynthesizing for decades without spending scarce energy on new foliage."
        ]
      },
      {
        "id": "dolomite",
        "x": 19,
        "y": 19,
        "object": "outcrop",
        "title": "The white dolomite",
        "section": "landscapeArchitecture",
        "cue": "Why does poor soil help this tree win?",
        "pages": [
          "Methuselah's stand grows on pale, alkaline, dolomite-derived soil at roughly 10,000 feet, ground most competing plants can't tolerate.",
          "Sparse competition, not good conditions, is part of the survival story. It's a design lesson too: sometimes the strategy is to site a slow specialist where faster competitors can't establish."
        ]
      },
      {
        "id": "stripbark",
        "x": 13,
        "y": 16,
        "object": "stripbark",
        "title": "The living strip",
        "section": "mechanism",
        "cue": "What is strip-bark growth, and why does it keep the tree alive?",
        "pages": [
          "Most of this trunk is dead, weathered wood. Only one narrow band of bark, the dark strip on the sheltered side, is still alive.",
          "Under stress, bristlecones let bark die back and concentrate growth into that strip. It lays down a thicker, healthier ring than the same growth spread thin around the whole trunk.",
          "One well-kept pipeline between roots and crown, maintained indefinitely. Researchers read it as a survival strategy, not decline."
        ]
      },
      {
        "id": "corer",
        "x": 7,
        "y": 14,
        "object": "drill",
        "title": "Schulman's increment borer",
        "section": "botany",
        "cue": "Who dated Methuselah, and when?",
        "pages": [
          "In 1957, dendrochronologist Edmund Schulman cored this tree with an increment borer and counted its rings without cutting it down.",
          "In 1958 he announced it as the oldest known living tree. A thin core of wood, read ring by ring, was enough."
        ]
      },
      {
        "id": "prometheus",
        "x": 12,
        "y": 11,
        "object": "stump",
        "title": "A stump for Prometheus",
        "section": "botany",
        "cue": "What happened in 1964, and what did it change?",
        "pages": [
          "This stump stands for another bristlecone. In 1964, on Nevada's Wheeler Peak, a graduate student's coring tool broke, and the tree nicknamed Prometheus was cut down.",
          "Only afterward did ring counts suggest it was likely even older than Methuselah. That loss is why the oldest trees are now protected mainly by not being findable."
        ]
      },
      {
        "id": "beetle",
        "x": 17,
        "y": 10,
        "object": "beetle",
        "title": "The first beetles",
        "section": "arboriculture",
        "cue": "What new threat appeared after 2013, and what's driving it?",
        "pages": [
          "Great Basin bristlecone was long treated as immune to the bark beetles that kill other high pines. Its resin and monoterpenes seem to repel host-seeking beetles.",
          "Between 2013 and 2020, researchers documented the first confirmed attacks, during the site's driest conditions in 40 years. Beetles bred poorly in bristlecone, but drought is eroding a resistance once treated as absolute."
        ]
      },
      {
        "id": "methuselah",
        "x": 12,
        "y": 2,
        "object": "ancient",
        "title": "Methuselah",
        "section": "arboriculture",
        "cue": "Why does the old tree get no care at all, and why isn't its dead trunk a defect?",
        "pages": [
          "Here it is: mostly bare, sculpted deadwood, with one living strip and a crown of green. Studies comparing bristlecones from 23 to over 4,700 years old found no significant decline tied to age alone.",
          "For an arborist, that bare trunk is normal, load-bearing survival anatomy, not dieback to correct. The conservation plan is hands-off: no signage, no trail, no care. Human disturbance is the main threat."
        ]
      }
    ]
  },

  sources: [
    { html: '<a href="https://en.wikipedia.org/wiki/Methuselah_(pine_tree)">Methuselah (pine tree)</a>. Wikipedia. Discovery, age, and location background.' },
    { html: '<a href="https://www.conifers.org/pi/Pinus_longaeva.php">Pinus longaeva</a>. The Gymnosperm Database (conifers.org). Taxonomy, description, morphology.' },
    { html: '<a href="https://sheppard.ltrr.arizona.edu/tour/BristleconePine1958-03.pdf">Schulman, E. (1958). Bristlecone Pine, Oldest Known Living Thing.</a> National Geographic Magazine, 113(3), 354–372. Archived by the University of Arizona Laboratory of Tree-Ring Research.' },
    { html: '<a href="https://doi.org/10.1093/plphys/kiac540">Pasques, O. &amp; Munné-Bosch, S. (2023). Physiological mechanisms underlying extreme longevity in mountain pine trees.</a> Plant Physiology, 191(2), 974–985.' },
    { html: '<a href="https://doi.org/10.1111/nph.14191">Bentz, B.J., Hood, S.M., Hansen, E.M., Vandygriff, J.C., &amp; Mock, K.E. (2017). Defense traits in the long-lived Great Basin bristlecone pine and resistance to the native herbivore mountain pine beetle.</a> New Phytologist, 213(2), 611–624.' },
    { html: '<a href="https://doi.org/10.1371/journal.pone.0135752">Gray, C.A., Runyon, J.B., Jenkins, M.J., &amp; Giunta, A.D. (2015). Mountain Pine Beetles Use Volatile Cues to Locate Host Limber Pine and Avoid Non-Host Great Basin Bristlecone Pine.</a> PLOS ONE, 10(9), e0135752.' },
    { html: '<a href="https://doi.org/10.1016/j.foreco.2022.120099">Bentz, B.J., Millar, C.I., Vandygriff, J.C., &amp; Hansen, E.M. (2022). Great Basin bristlecone pine mortality: Causal factors and management implications.</a> Forest Ecology and Management, 509, 120099.' },
    { html: 'Burchfield, D.R., et al. (2021). A comprehensive distribution map and habitat suitability model for Great Basin bristlecone pine (<em>Pinus longaeva</em> D.K. Bailey). In Burchfield, D., <em>Assessment of Great Basin bristlecone pine forest communities using geospatial technologies</em> (Ch. 3, pp. 57–99). Brigham Young University dissertation.' }
  ]
};
