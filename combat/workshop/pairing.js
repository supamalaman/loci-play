"use strict";
// Pairing (W6.3 build): the algebra of blends. Every state is a number;
// combining numbers makes numbers; the table says what they mean. Cantor
// pairing (bijective), left-nested for 3+ parents; canon table curated,
// first-minter names grow the account's table; the ledger keeps lineage.
//
//   NODE_IDS                     → concept → int (NEVER reorder: append only)
//   pi(a, b) / unpi(z)           → Cantor pair / unpair (round-trips)
//   mint(parents, dialsHash, valence) → child eq (parents: [ids], order matters)
//   preview(graph, C, parents, opts)  → { eq, named, name, blend, price, drift, dist }
//   nameMerge(account, eq, name) → account (first minter writes lore)
//   TABLE                        → canon (starts empty; Mala curates)
//   COMMUTE                      → order-free pairs (starts empty; curated)
// Verbs (W8.2/W8.3): a parent may be a verb node, written "verb:N" (N = its permanent id, 1–64). Verbs number from
// VERB_BASE so they never collide with concept NODE_IDS. Two verbs resolve against the W8.3 emergence table (verbs.js SEEDS:
// a hit returns its name and meaning; a miss blends and reports unnamed) and price by the school ring (verbs.js mergePrice).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./valence.js"), require("./verbs.js"));
  else root.ConceptCombatWorkshopPairing = factory(root.ConceptCombatWorkshopValence, root.ConceptCombatWorkshopVerbs);
})(typeof self !== "undefined" ? self : this, function (VV, VB) {
  // Node numbers, alphabetical at 1.3.421. NEVER reorder or renumber: same
  // equation = same thing, forever, every account. New concepts append.
  const NODE_IDS = { adaptation: 1, adjacency: 2, aeronautics: 3, antifragility: 4, barrier: 5, berm: 6, bird_mountain: 7, boundary: 8, cipher: 9, collage: 10, complementarity: 11, conjunction: 12, constraint: 13, craftsmanship: 14, cybernetic_ecology: 15, deception: 16, delegation: 17, dependency: 18, diffusion: 19, discovery: 20, elasticity: 21, extraction: 22, fault_tolerance: 23, focus: 24, folding: 25, glamour: 26, gradingDrainage: 27, hardware: 28, harmony: 29, hospitality: 30, imagination: 31, indexing: 32, inertia: 33, inference: 34, innovation: 35, interposition: 36, laws_of_gods_of_men: 37, legitimacy: 38, leverage: 39, load_distribution: 40, longtermism: 41, lyricism: 42, pathway: 43, pipeline: 44, plasticity: 45, preservation: 46, pruning: 47, reciprocal_obligation: 48, resonance: 49, section: 50, selectivity: 51, settlement: 52, sightline: 53, software: 54, solfeggio: 55, stealth: 56, strategic_commitment: 57, succession: 58, swale: 59, tension: 60, thorn: 61, threshold: 62, timing: 63, transmigration: 64, periodicity: 65, mise_en_place: 66 };
  const TABLE = {};   // eq → name (canon gate: Mala curates; the lore is earned, not shipped)
  const COMMUTE = [];   // [[a, b]] pairs whose order does not matter (curated, same gate)

  const VERB_BASE = 1000;
  const verbOf = (id) => { const m = /^verb:(\d+)$/.exec(String(id)); return m && VB?.VERBS?.[+m[1]] ? +m[1] : null; };
  const nodeNum = (id) => { const v = verbOf(id); return v ? VERB_BASE + v : NODE_IDS[id] || 0; };
  const pi = (a, b) => ((a + b) * (a + b + 1)) / 2 + b;
  const unpi = (z) => { const w = Math.floor((Math.sqrt(8 * z + 1) - 1) / 2), t = (w * w + w) / 2; return [w - (z - t), z - t]; };
  const pairKey = (a, b) => [a, b].sort().join("x");
  const commutes = (a, b, commute = COMMUTE) => commute.some(([x, y]) => pairKey(x, y) === pairKey(a, b));
  const canonDials = (styles, id) => JSON.stringify((styles || {})[id]?.dials || {});
  function dialsHash(styles, parents) {   // W6.2: rewritten dials move equations; untouched dials hash 0 (old equations stand)
    const parts = (parents || []).map((id) => `${id}=${canonDials(styles, id)}`).sort();
    if (parts.every((p) => p.endsWith("={}"))) return 0;
    let h = 2166136261;
    const s = parts.join("|");
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // parents: 2+ concept ids in combination order. 3+ left-nests: π(π(p1,p2),p3).
  function mint(parents, dialsHash, valence, commute = COMMUTE) {
    const ps = parents.length === 2 && commutes(parents[0], parents[1], commute) ? [...parents].sort() : parents;
    const ids = ps.map(nodeNum);
    let acc = pi(ids[0], ids[1]);
    for (const n of ids.slice(2)) acc = pi(acc, n);
    return pi(acc, pi(dialsHash, valence));
  }
  const blendName = (C, parents, driftN) => {
    const names = parents.map((id) => (verbOf(id) ? VB.VERBS[verbOf(id)].name : C?.concepts?.[id]?.name) || id);
    return `${names.join(" × ")}${driftN > 1 ? `, bent ${driftN}` : ""}`;
  };
  // Free look before paying: the child (named or blended), its price, drift, distance.
  function preview(graph, C, account, parents, { table = TABLE, commute = COMMUTE } = {}) {
    const owned = account?.ownedNodes || [];
    const verbs = parents.length === 2 && parents.every(verbOf) ? parents.map(verbOf) : null;
    if (verbs) {   // W8.3: two verbs read the emergence table in combination order; the ring prices them
      const dist = VB.ringDistance(verbs[0], verbs[1]), row = VB.seed(verbs[0], verbs[1]);
      const eq = mint(parents, dialsHash(account?.nodeStyles, parents), dist, commute);
      const named = row?.name || table[eq] || account?.namedMerges?.[eq]?.name || null, driftN = VV ? VV.drift(dist) : 0;
      return { eq, named: !!named, name: named || blendName(C, parents, driftN), blend: !named, meaning: row?.meaning || null, unnamed: !named,
        price: VB.mergePrice(verbs[0], verbs[1], VV?.RULES?.curve), drift: driftN, dist, parents: parents.slice(), unowned: parents.filter((id) => verbOf(id) == null && !owned.includes(id)) };   // verbs are universal: never unowned
    }
    const dist = parents.length === 2 && VV ? VV.distance(graph, parents[0], parents[1]) : 0;
    const eq = mint(parents, dialsHash(account?.nodeStyles, parents), dist);
    const named = table[eq] || account?.namedMerges?.[eq]?.name || null;
    const driftN = VV ? VV.drift(dist) : 0;
    return { eq, named: !!named, name: named || blendName(C, parents, driftN), blend: !named,
      price: VV ? VV.price(dist) : 1, drift: driftN, dist, parents: parents.slice(), unowned: parents.filter((id) => !owned.includes(id)) };
  }
  function nameMerge(account, eq, name) {
    const a = { namedMerges: {}, mergeLedger: [], ...account };
    if (a.namedMerges[eq]) return { ok: false, error: "Already named.", account: a };
    const clean = String(name || "").trim().slice(0, 60);
    if (!clean) return { ok: false, error: "Give it a name.", account: a };
    return { ok: true, account: { ...a, namedMerges: { ...a.namedMerges, [eq]: { name: clean, minter: a.name || "Warden" } } } };
  }
  return { NODE_IDS, TABLE, COMMUTE, pi, unpi, dialsHash, mint, preview, nameMerge };
});
