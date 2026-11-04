"use strict";
// Schools (W8.1 + W8.5 + W8.4 build, Muse wave 8 specs SCHOOLS/STARTS/GATES): the Workshop tree's nine waters.
// Eight rim schools ring one Still center. Ring distance prices nearness (neighbors sing, opposites scream); every
// live concept opens on exactly one school (its door); a school is entered once its gate is proven (keys persist on
// the account and are shared by the party); the Still Water opens by exam (three seals, then a bout).
//
// LIVE GROUNDING (Pantry-A, 2026-10-26): gates read the battle record at its end (proofsFrom). Five gates are grounded
// on live records (Tended on the item-care record); two wait on systems that do not exist yet and stay OPEN (pending) so no school is locked behind a
// proof nobody can give. The exam's depth seal (a lock-in artifact) is pending for the same reason.
//
//   RING, CENTER, OPPOSED, DOORS, GATES     → data (ring order and doors are Mala-gated; overrule = re-cut)
//   distance(a, b)                          → ring distance 0..4 (Still is 2 from every rim school)
//   schoolOf(conceptId)                     → the concept's school, or null (doorless)
//   doorOf(primary)                         → the home school a primary concept opens on
//   keysOf(account, home)                   → Set of open schools (earned keys + home + pending gates)
//   gateSentence(school)                    → the proof the gate asks for, in plain words
//   proofsFrom(s, account, C)               → [schools proven in this battle] (pure)
//   earnKeys(account, schools)              → { account, lines } (adds new keys once)
//   claimBlock(account, home, conceptId)    → null | reason (a claim in a locked school)
//   examStatus(account)                     → { seals: { breadth, depth, lineage }, missing: [...] }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatWorkshopSchools = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RING = ["Sworn", "Tried", "Quiet", "Tended", "Veiled", "Devoured", "Owing", "Witnessed"];
  const CENTER = "Still";
  const WATERS = { Sworn: "vows, declaration, sworn truth", Tried: "courts, counts, verdicts", Quiet: "mercy, restraint, the knee",
    Tended: "craft, care, devotion", Veiled: "mystery, hidden info, rites", Devoured: "death-returns, inheritance",
    Owing: "debt, stakes, owed things", Witnessed: "crowds, spectacle, performance", Still: "mastery itself" };
  const OPPOSED = [["Sworn", "Veiled"], ["Tried", "Devoured"], ["Quiet", "Owing"], ["Tended", "Witnessed"]];
  // W8.5 door table (concepts by name, v1.3.425), plus cipher → Veiled and thorn → Devoured (the spec's own edge-case
  // calls), plus 16 live combat concepts the table did not list, assigned by each school's water (Pantry-A, 2026-10-26):
  // conjunction (charting the sky, like forecasting) and delegation (a bounded order, like substitution) → Sworn;
  // constraint (rules that hold) and inference (weighing evidence) → Tried; settlement, gradingDrainage, pipeline and
  // plasticity (building, earthwork, composed craft, lasting change) → Tended; folding (changes what is exposed) and
  // adjacency (a hidden road, like pathway) → Veiled; extraction (removes remains to a receptacle) → Devoured; tension,
  // dependency and leverage (pull owed between anchors, prerequisites, gearing) → Owing; lyricism and harmony → Witnessed.
  const DOORS = {
    Sworn: ["truthsaying", "forecasting", "substitution", "expertise", "cooperative_principle", "complementarity", "focus", "enhancement", "conjunction", "delegation"],
    Tried: ["laws_of_gods_of_men", "legitimacy", "damnation", "iatrogenesis", "indexing", "section", "selectivity", "threshold", "timing", "sightline", "boundary", "constraint", "inference"],
    Quiet: ["ma", "bushido", "love", "friendship", "gratitude", "longtermism", "preservation", "austerity", "barrier", "inertia", "interposition", "compression_and_release"],
    Tended: ["craftsmanship", "discovery", "traditional_medicine", "herbal_medicine", "hardware", "mise_en_place", "software", "cybernetic_ecology", "synthetic_biomedical", "load_distribution", "fault_tolerance", "succession", "pruning", "aging", "desire_line", "borrowed_scenery", "edge_effect", "layers", "metis", "berm", "swale", "periodicity", "adaptation", "innovation", "settlement", "gradingDrainage", "pipeline", "plasticity"],
    Veiled: ["mystery", "deception", "stealth", "camouflage", "horror", "ritual", "flooded_operations_room", "pathway", "imagination", "cipher", "folding", "adjacency"],
    Devoured: ["transmigration", "retrieval", "obsolescence", "reversal", "antifragility", "parapsychology", "co_creation", "thorn", "extraction"],
    Owing: ["ap", "utilitarianism", "elasticity", "strategic_commitment", "reciprocal_obligation", "credit", "transference", "tension", "dependency", "leverage"],
    Witnessed: ["glamour", "poise", "solfeggio", "collage", "hospitality", "facilitation", "resonance", "mimetic_desire", "bird_mountain", "improvisation", "super_empathy", "diffusion", "aeronautics", "lyricism", "harmony"],
  };
  const SCHOOL_OF = Object.fromEntries(Object.entries(DOORS).flatMap(([school, ids]) => ids.map((id) => [id, school])));
  // W8.4 gates: prove the school's thesis once. pending = the record system does not exist yet, so the gate stays open.
  const GATES = {
    Sworn: { proof: "swear a vow in battle" },
    Tried: { proof: "be party to a verdict (a House lawsuit)" },
    Quiet: { proof: "show mercy: a foe submits, is spared, or is persuaded to stand down" },
    Tended: { proof: "tend one item four times (mend, cherish or a duplicate mend)" },   // grounded on gear.care (account/loot.js, Jinki care JC2)
    Veiled: { proof: "hold something face-down or sealed" },   // mystery layer landed (Muse W2.5): pending lifted, proof read below
    Devoured: { proof: "inherit or pay a bequest", pending: "death pipeline (bequests)" },
    Owing: { proof: "owe something: a restitution debt or a staked wager" },
    Witnessed: { proof: "win before a crowd, perform with Inspiration, or busk in the town square" },
  };
  const RULES = { breadth: 6, lineage: 3, depth: 1, centerDistance: 2, depthPending: "lock-in artifacts", careSessions: 4 };

  function distance(a, b) {
    if (a === b) return 0;
    if (a === CENTER || b === CENTER) return RULES.centerDistance;
    const i = RING.indexOf(a), j = RING.indexOf(b);
    if (i < 0 || j < 0) return Infinity;
    const d = Math.abs(i - j);
    return Math.min(d, RING.length - d);
  }
  const schoolOf = (id) => SCHOOL_OF[id] || null;
  const doorOf = (primary) => schoolOf(primary);
  function keysOf(account, home) {
    const keys = new Set(account?.schoolKeys || []);
    if (home) keys.add(home);
    for (const [school, g] of Object.entries(GATES)) if (g.pending) keys.add(school);
    if ((account?.ownedNodes || []).some((id) => schoolOf(id) === "Tended")) keys.add("Tended");   // claimed while the gate was open: never revoked
    return keys;
  }
  const gateSentence = (school) => GATES[school] ? `${school} Water: ${GATES[school].proof} to open it.` : "";

  // What this battle proved, read from its final state (the player's side only).
  function proofsFrom(s, account, C) {
    if (!s) return [];
    const ours = (id) => s.actors?.[id]?.side === "player", out = new Set();
    const units = Object.values(s.actors || {});
    if ((s.declarations || []).some((d) => ours(d.actor)) || units.some((a) => a.side === "player" && (a.vows || []).length)) out.add("Sworn");
    const log = s.log || [];
    if (units.some((a) => a.side !== "player" && (a.submitted || a.spared || a.persuaded || a.converted))) out.add("Quiet");
    // Tried and Owing read the decided records, not log text (Relay W8-01/W8-02, 2026-10-26): a Due Process declaration, a
    // property-damage notice or a creditor's award line is a player-side `law` log, but none is a verdict or a debt.
    const decided = (s.propertyClaims || []).filter((c) => c.status === "won" || c.status === "dismissed");
    if (decided.some((c) => c.side === "player" || ours(c.defendant)) || (s.trialLedger || []).some((t) => ours(t.accused) || ours(t.by))) out.add("Tried");
    if (units.some((a) => a.side === "player" && a.restitutionDebt > 0) || decided.some((c) => c.status === "won" && ours(c.defendant))
      || s.stakes?.state === "agreed" || (s.stakeEvents || []).length) out.add("Owing");
    if (((account?.fameBy?.busk || 0) + (account?.fameBy?.perform || 0)) > 0 || (s.crowdBattle && s.outcome?.winner === "player")) out.add("Witnessed");
    if (log.some((e) => e.kind === "mystery" && ours(e.actor)) || log.some((e) => e.kind === "seal" && ours(e.actor))) out.add("Veiled");   // set a face-down card or sealed a foe
    for (const x of accountProofs(account)) out.add(x);
    return [...out];
  }
  // Proofs that live on the account rather than in a battle: Tended is tending one item four times (care sessions =
  // repairs by kit or smith + cherishes + duplicate mends; carrying it into battle is wear, not care). After a GateLess
  // seal only care given since the seal counts (gateless.js records each item's sessions at the seal; clarification #3).
  function accountProofs(account) {
    const care = account?.gear?.care || {}, before = account?.sealed?.careSessions || {};
    return Object.entries(care).some(([id, r]) => (r.repairs || 0) + (r.cherishes || 0) + (r.dupMends || 0) - (before[id] || 0) >= RULES.careSessions) ? ["Tended"] : [];
  }
  function earnKeys(account, schools) {
    const have = new Set(account?.schoolKeys || []), fresh = (schools || []).filter((x) => GATES[x] && !have.has(x));
    if (!fresh.length) return { account, lines: [] };
    return { account: { ...account, schoolKeys: [...have, ...fresh] },
      lines: fresh.map((x) => `The ${x} Water opens to you (${WATERS[x]}).`) };
  }
  function claimBlock(account, home, conceptId) {
    const school = schoolOf(conceptId);
    if (!school || keysOf(account, home).has(school)) return null;
    return `Visible but not yet yours. ${gateSentence(school)}`;
  }
  function examStatus(account) {
    const bySchool = {};
    for (const id of account?.ownedNodes || []) { const x = schoolOf(id); if (x) bySchool[x] = (bySchool[x] || 0) + 1; }
    const deepest = Math.max(0, ...Object.values(bySchool));
    const seals = { breadth: deepest >= RULES.breadth, lineage: (account?.mergeLedger || []).length >= RULES.lineage, depth: null };
    const missing = [];
    if (!seals.breadth) missing.push(`Breadth: own ${RULES.breadth} nodes in one school (best so far ${deepest}).`);
    if (!seals.lineage) missing.push(`Lineage: ${RULES.lineage} equations in your ledger (${(account?.mergeLedger || []).length} so far).`);
    missing.push(`Depth: lock in one artifact (waits on ${RULES.depthPending}).`);
    return { seals, missing, bySchool };
  }
  return { RING, CENTER, WATERS, OPPOSED, DOORS, GATES, RULES, distance, schoolOf, doorOf, keysOf, gateSentence, proofsFrom, accountProofs, earnKeys, claimBlock, examStatus };
});
