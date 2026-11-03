"use strict";
// Tsukumogami communion (Mala, 2026-10-27; docs/tsukumogami.md): observe a structure, answer its question,
// and it stands up as an ally for 4 rounds. Numbers only; rules are in tsukumogami.js. The flow mirrors plant
// communion (communion-data.js) so players already know it; the numbers match on purpose.
//
// Difficulty follows size: bigger things are harder to reach, as big hardy species are for plants.
// The question pool is Mala's shape: `for.type` narrows to one object type, omitted means any structure.
// Question CONTENT is provisional and flagged for Mala's overrule with everything else.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTsukumogamiData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const rules = {
    released: true,           // The battle menu shows Observe > Structures only when this is true.
    observeRange: 4,          // tiles, with line of sight
    observeStep: 10,          // action points per point of familiarity
    observeMax: 30,           // most action points one Observe can invest
    range: 1,                 // commune from an adjacent tile
    communeAp: 30,
    phiBase: 2, phiPerDifficulty: 2,   // ΦF cost = 2 + 2 × difficulty (4 to 10)
    maxActive: 1,             // one awakened structure at a time
    // The awakened body (spec §4; all provisional). Move ignores terrain costs and costs no tempo;
    // Strike is contact nigredo at reach 1. Awake for `rounds` of its own turns, then it settles back.
    moveBySize: [3, 4, 6, 8],
    strikeBySize: [6, 8, 11, 14],
    rounds: 4,
  };
  // Defaults by size (the object's sightHeight, 0 to 3). `need` = familiarity required = difficulty.
  const sizes = {
    0: { difficulty: 1 },
    1: { difficulty: 2 },
    2: { difficulty: 3 },
    3: { difficulty: 4 },
  };
  // Object types that differ from their size. Unlisted types use the size default. (Empty at build; Mala tunes.)
  const types = {
  };
  // Structure-family concepts per type (spec §4; every id verified playable via the loci-concept vocab
  // check — support, containment and storage do not exist, so the map uses the nearest structure-family
  // concepts: load_distribution for what pillars hold up, constraint for what planters and cisterns hold
  // in, gradingDrainage for cistern waterworks, interposition for the bench between you and danger,
  // hardware for the built machines, preservation for what must endure. Mala may overrule any pair.
  const concepts = {
    fence: ["boundary", "barrier"], bollard: ["boundary", "barrier"], window: ["boundary", "barrier"],
    parterreGate: ["boundary", "barrier"], bench: ["interposition", "boundary"],
    pillarAncientStone: ["load_distribution", "preservation"], pillarAncientBroken: ["load_distribution", "preservation"],
    pillarDoricLimestone: ["load_distribution", "preservation"], pillarIonicMarble: ["load_distribution", "preservation"],
    pillarCorinthianMarble: ["load_distribution", "preservation"], pillarTuscanGranite: ["load_distribution", "preservation"],
    pillarCompositePorphyry: ["load_distribution", "preservation"], pillarRomanBrick: ["load_distribution", "preservation"],
    pillarOrnateGilded: ["load_distribution", "preservation"], pillarOrnateMarble: ["load_distribution", "preservation"],
    monument: ["load_distribution", "preservation"],
    planter: ["constraint", "boundary"], parterreFountain: ["constraint", "boundary"],
    cistern: ["gradingDrainage", "constraint"],
    workstation: ["hardware", "craftsmanship"], dataCenter: ["hardware", "load_distribution"],
    parterreStatue: ["preservation", "boundary"], parterreUrn: ["preservation", "constraint"],
  };
  // Structure questions: what it is for, how it stands, what it is made of. Pillars first: the five
  // classical orders are already separate object types. `for.type` narrows to one type; omitted means any.
  const questions = [
    { id: "doric-capital", for: { type: "pillarDoricLimestone" }, prompt: "A Doric column stands with no base, its shaft cut with twenty shallow flutes. Its capital is…?", choices: ["A plain cushion under a square slab", "A pair of scrolled volutes", "A ring of acanthus leaves"], answer: 0,
      explain: "Doric keeps it plain: a cushion echinus under a square abacus, no base, twenty flutes with sharp arrises.",
      clue: "Doric is the plain order: no base, twenty flutes, and a cushion capital under a square slab." },
    { id: "ionic-capital", for: { type: "pillarIonicMarble" }, prompt: "An Ionic capital is recognised by…?", choices: ["A basket of acanthus leaves", "Twin scrolled volutes", "A plain unfluted drum"], answer: 1,
      explain: "Ionic's signature is the twin volute scroll; its shaft stands on a base, unlike Doric.",
      clue: "Look for the scrolls: an Ionic capital curls into twin volutes above its shaft." },
    { id: "corinthian-capital", for: { type: "pillarCorinthianMarble" }, prompt: "A Corinthian capital wears…?", choices: ["A ring of carved acanthus leaves", "Twin volute scrolls", "Rope moulding"], answer: 0,
      explain: "Corinthian is the leafy order: acanthus carved deep around the bell.",
      clue: "Corinthian wears leaves: a ring of carved acanthus wraps the bell of the capital." },
    { id: "tuscan-order", for: { type: "pillarTuscanGranite" }, prompt: "The Tuscan order is the Roman plain style: smooth shaft, simple base and capital. It is a stripped-down…?", choices: ["Doric", "Ionic", "Corinthian"], answer: 0,
      explain: "Tuscan strips Doric to its bones: unfluted shaft, plain base, simple capital.",
      clue: "Tuscan is Doric stripped bare: smooth unfluted shaft, plain base, simple capital." },
    { id: "composite-order", for: { type: "pillarCompositePorphyry" }, prompt: "The Composite capital combines…?", choices: ["Doric flutes with a Tuscan base", "Ionic volutes with Corinthian acanthus", "Two stacked Doric capitals"], answer: 1,
      explain: "Composite is Rome's grand mixture: Ionic scrolls rising from Corinthian leaves.",
      clue: "Composite mixes both: Ionic scrolls rising out of Corinthian acanthus leaves." },
    { id: "load-foundation", prompt: "A wall carries its load down to the…?", choices: ["Foundation", "Roof", "Window"], answer: 0,
      explain: "Every wall ends at its footing: the foundation spreads the load into the ground.",
      clue: "Walls stand on footings: every load travels down to the foundation stones." },
    { id: "masonry-tension", prompt: "Stone and brick are strong squeezed and weak pulled: strong in compression, weak in…?", choices: ["Tension", "Compression", "Hardness"], answer: 0,
      explain: "Masonry takes compression all day and fails in tension — that is why arches squeeze and lintels span short.",
      clue: "Masonry squeezes well and pulls apart: arches work because stone is weak in tension." },
    { id: "timber-shrink", prompt: "Green timber shrinks as it dries, mostly…?", choices: ["Across the grain", "Along its length", "Evenly everywhere"], answer: 0,
      explain: "Wood moves across the grain as it seasons; its length barely changes.",
      clue: "Drying wood shrinks sideways: the grain holds its length while the width draws in." },
    { id: "mortar-beds", prompt: "Mortar between stones beds each course and resists…?", choices: ["Compression", "Tension", "Rust"], answer: 0,
      explain: "Mortar beds the stones and takes compression with them; it holds almost nothing in tension.",
      clue: "Mortar beds each course and squeezes with the wall: it resists compression, not pull." },
  ];
  return { rules, sizes, types, concepts, questions };
});
