"use strict";
// Verbs (W8.2 Nodes + W8.3 Seeds build; Pantry-B, 2026-10-26): the Lego catalog of the Lo-ci Workshop. Every verb node is
// BASE (immutable identity) + DIAL SCHEMA (tunable). IDs 1–64 are permanent (pairing and lineage reference them; new verbs
// append, never renumber). Spec: ready-to-review/muse-wave8/specs/{NODES,SEEDS}.md; numbers from its sims.
// The 64 (2026-10-27): 8 schools × 8 verbs each (verbs 19–64 appended under the same rules). Verbs 19–64 mint
// and price but declare NO executable body yet (non-playable as techniques — loop:1a17cfb2680 batches bodies;
// only verbs 9, 10, 14 execute today). The mint preview says so when a bodyless verb is a parent.
//
// SCHOOLS below is a local copy of the W8.1 ring (Sworn … Witnessed = 0 … 7); when workshop/schools.js (W8.1 part A) lands,
// the Integrator points ringDistance at it. The ring order is the valence map: d = min(|i−j|, 8−|i−j|).
//
//   SCHOOLS, VERBS               → ring names; id → { name, school, base, dials: [{ name, min, max, def, dir }] }
//   clampDial(id, dial, value)   → { value, warning } (out of range clamps with a warning, never a refusal)
//   dialPrice(id, values)        → summed normalized steps (↑ raises price, ↓ lowers it, → free)
//   ringDistance(a, b)           → school-ring distance between two verbs (0–4)
//   SEEDS, BLESSED               → the emergence table v0 ("p×q" in combination order → { name, meaning }); the four flagships
//   seed(p, q)                   → the row for p×q in that order, or null (reverse orders miss until attested)
//   mergePrice(p, q, curve)      → flagship 1; else curve(d), and an opposed d4 pays the curve's top × 2 (ruinous unless blessed)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatWorkshopVerbs = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SCHOOLS = ["Sworn", "Tried", "Quiet", "Tended", "Veiled", "Devoured", "Owing", "Witnessed"];
  const UP = 1, DOWN = -1, FREE = 0;
  // Ordinal dials (named steps) are 0-based indexes into `steps`; numeric dials are their own values.
  const D = (name, min, max, def, dir, steps) => ({ name, min, max, def, dir, ...(steps ? { steps } : {}) });
  const VERBS = {
    1: { name: "VOW", school: 0, base: "A sworn restriction that empowers while kept.",
      dials: [D("magnitude", 1, 5, 2, UP), D("scope", 0, 3, 0, UP, ["self", "party", "battle", "saga"]), D("breach-price", 0, 2, 0, UP, ["ΦF", "levels", "life"]), D("witnesses", 0, 8, 0, UP)] },
    2: { name: "REVEAL", school: 0, base: "A public announcement that binds the speaker.",
      dials: [D("claim", 0, 2, 1, UP, ["whisper", "claim", "oath"]), D("evidence", 0, 2, 0, UP, ["none", "sworn", "proven"]), D("audience", 0, 2, 0, UP, ["self", "foes", "crowd"])] },
    3: { name: "WITNESS", school: 7, base: "Calls a crowd and banks Heat.",
      dials: [D("crowd", 0, 2, 1, UP, ["bystanders", "arena", "realm"]), D("heat-cap", 0, 2, 0, UP, ["8", "16", "24"]), D("favor-spend", 0, 2, 0, UP, ["cheer", "gasps", "silence"])] },
    4: { name: "HEADLINE", school: 7, base: "Issues a spectacle challenge (a called-out duel).",
      dials: [D("stakes", 0, 2, 1, UP, ["honor", "lots", "main event"]), D("venue", 0, 2, 0, UP, ["any", "arena", "dream"]), D("refusal-price", 0, 1, 0, UP, ["cheap", "dear"])] },
    5: { name: "ACCUSE", school: 1, base: "Opens a count under a live FORM.",
      dials: [D("counts", 1, 3, 1, UP), D("venue", 0, 2, 0, UP, ["field", "court", "astral"]), D("severity", 0, 2, 0, UP, ["censure", "sentence", "death"])] },
    6: { name: "SENTENCE", school: 1, base: "Pushes a live count toward verdict.",
      dials: [D("push", 0, 2, 1, UP, ["nudge", "demand", "compel"]), D("mercy-window", 0, 2, 0, UP, ["open", "narrow", "shut"]), D("publicity", 0, 1, 0, UP, ["sealed", "read aloud"])] },
    7: { name: "KNEEL", school: 2, base: "Take a knee: downed-condition surrender. The knee never costs honor.",
      dials: [D("timing", 0, 1, 0, UP, ["any turn", "opening only"]), D("terms", 0, 1, 0, DOWN, ["unconditional", "named price"])] },
    8: { name: "SPARE", school: 2, base: "A finishing beat that refuses the kill.",
      dials: [D("opening", 0, 1, 0, UP, ["bloodied", "any"]), D("convert", 0, 2, 0, UP, ["no", "offer", "demand"]), D("mark", 0, 1, 0, UP, ["none", "ledger mark"])] },
    9: { name: "TEND", school: 3, base: "Logged care for one thing.",
      dials: [D("sessions", 1, 8, 1, UP), D("rite", 0, 2, 0, UP, ["wipe", "oil", "song"])] },
    10: { name: "MEND", school: 3, base: "Repair of damage or wear.",
      dials: [D("depth", 0, 2, 0, UP, ["surface", "structural", "soul"]), D("scar", 0, 1, 0, DOWN, ["polished", "kept"]), D("materials", 0, 1, 0, UP, ["carried", "crafted"])] },
    11: { name: "VEIL", school: 4, base: "Hides named information.",
      dials: [D("depth", 0, 2, 1, UP, ["face-down", "sealed", "unknowable"]), D("duration", 0, 2, 0, UP, ["scene", "battle", "saga"]), D("tell", 0, 1, 0, DOWN, ["none", "faint"])] },
    12: { name: "PEEK", school: 4, base: "Buys a read on hidden information.",
      dials: [D("target", 0, 2, 0, UP, ["open", "sealed", "mind"]), D("price", 0, 1, 0, UP, ["ΦF", "a secret of equal weight"]), D("trace", 0, 1, 0, DOWN, ["unseen", "felt"])] },
    13: { name: "BEQUEST", school: 5, base: "A dying-forward payout.",
      dials: [D("weight", 0, 2, 0, UP, ["trinket", "technique", "levels"]), D("heir", 0, 2, 0, UP, ["foe", "friend", "self reborn"]), D("trigger", 0, 2, 0, UP, ["fall", "death", "sacrifice"])] },
    14: { name: "SALVAGE", school: 5, base: "Strips the fallen for usable remains.",
      dials: [D("yield", 0, 2, 0, UP, ["scrap", "gear", "soul"]), D("respect", 0, 2, 0, UP, ["rite", "loot", "desecrate"]), D("claim-speed", 0, 1, 0, UP, ["slow", "swift"])] },
    15: { name: "ANTE", school: 6, base: "Stakes lots on a named outcome.",
      dials: [D("lots", 1, 5, 1, UP), D("odds", 0, 1, 0, UP, ["even", "long"]), D("escrow", 0, 2, 0, DOWN, ["crowd", "ledger", "self"])] },
    16: { name: "TOLL", school: 6, base: "Names what passage or action costs another.",
      dials: [D("kind", 0, 2, 0, UP, ["ΦF", "Seeds", "levels"]), D("gate", 0, 2, 0, UP, ["one door", "chokepoint", "battlefield"]), D("exemption", 0, 1, 0, DOWN, ["none", "named"])] },
    17: { name: "CLINCH", school: 2, base: "A submission hold that ends fights fast.",
      dials: [D("lethality", 0, 2, 0, UP, ["choke-out", "break", "kill"]), D("escape-cost", 0, 2, 0, UP, ["ULT", "Inspiration", "levels"]), D("purity", 0, 1, 0, FREE, ["gi", "no-gi"])] },
    18: { name: "CALL", school: 7, base: "Summons a presence for N turns.",
      dials: [D("count", 1, 8, 1, DOWN), D("hp", 1, 80, 8, UP), D("turns", 1, 8, 2, UP), D("behavior", 0, 2, 0, DOWN, ["obey", "bond", "feral"]), D("anchor", 0, 2, 0, DOWN, ["mark", "zone", "caster"])] },
    // The 64: 8 schools × 8 verbs (2026-10-27 — IDs append, never renumber). Dials are tunables; Mala tunes.
    // Sworn (0): oaths, bindings, promises.
    19: { name: "PLEDGE", school: 0, base: "A stake-backed promise: collateral empowers while kept.",
      dials: [D("weight", 1, 5, 1, UP), D("held-by", 0, 2, 0, UP, ["self", "ledger", "crowd"]), D("term", 0, 2, 0, UP, ["scene", "battle", "saga"])] },
    20: { name: "ABJURE", school: 0, base: "A sworn refusal: name what you will not touch.",
      dials: [D("span", 0, 2, 0, UP, ["technique", "concept", "school"]), D("term", 0, 2, 0, UP, ["scene", "battle", "saga"]), D("edge", 0, 2, 0, UP, ["ward", "potency", "both"])] },
    21: { name: "ATTEST", school: 0, base: "Sworn testimony: a fact entered as evidence.",
      dials: [D("weight", 0, 2, 0, UP, ["word", "sworn", "proven"]), D("peril", 0, 1, 0, UP, ["none", "perjury"]), D("audience", 0, 2, 0, UP, ["self", "court", "crowd"])] },
    22: { name: "COVENANT", school: 0, base: "One pact for the whole side: shared curb, shared boon.",
      dials: [D("weight", 1, 5, 1, UP), D("boon", 0, 2, 0, UP, ["ward", "potency", "tempo"]), D("break", 0, 1, 0, UP, ["each", "all"])] },
    23: { name: "FORSWEAR", school: 0, base: "A clean exit: pay the breach-price up front, walk out free.",
      dials: [D("price", 0, 2, 0, UP, ["ΦF", "levels", "favor"]), D("speed", 0, 1, 0, UP, ["slow", "swift"]), D("record", 0, 1, 0, UP, ["kept", "struck"])] },
    24: { name: "SANCTIFY", school: 0, base: "Consecrate ground: the kept place protects its keepers.",
      dials: [D("ground", 0, 2, 0, UP, ["tile", "zone", "battlefield"]), D("boon", 0, 2, 0, UP, ["ward", "regen", "sanctuary"]), D("term", 0, 2, 0, UP, ["scene", "battle", "saga"])] },
    // Tried (1): law, counts, verdicts.
    25: { name: "ARRAIGN", school: 1, base: "Drag a foe to answer: open the dock mid-battle.",
      dials: [D("charge", 0, 2, 0, UP, ["censure", "sentence", "death"]), D("venue", 0, 2, 0, UP, ["field", "court", "astral"]), D("speed", 0, 1, 0, UP, ["slow", "swift"])] },
    26: { name: "PLEAD", school: 1, base: "Enter a plea that shapes the trial.",
      dials: [D("plea", 0, 2, 1, UP, ["guilty", "not-guilty", "silent"]), D("remorse", 0, 2, 0, UP, ["none", "shown", "sworn"]), D("counsel", 0, 2, 0, UP, ["self", "hired", "learned"])] },
    27: { name: "ACQUIT", school: 1, base: "Clear a count: the defense made good.",
      dials: [D("scope", 0, 2, 0, UP, ["count", "case", "record"]), D("grounds", 0, 2, 0, UP, ["mercy", "evidence", "right"])] },
    28: { name: "SUBPOENA", school: 1, base: "Compel a witness: drag them to testify.",
      dials: [D("witness", 0, 2, 0, UP, ["ally", "neutral", "foe"]), D("force", 0, 1, 0, UP, ["ask", "compel"]), D("scope", 0, 1, 0, UP, ["scene", "battle"])] },
    29: { name: "APPEAL", school: 1, base: "Reopen a decided count: try the verdict itself.",
      dials: [D("grounds", 0, 2, 0, UP, ["mercy", "error", "right"]), D("stake", 0, 1, 0, UP, ["free", "double"]), D("venue", 0, 1, 0, UP, ["court", "astral"])] },
    30: { name: "CONTEMPT", school: 1, base: "Punish court-defiance: the fled and stalled pay.",
      dials: [D("target", 0, 2, 0, UP, ["fled", "stalled", "silent"]), D("price", 0, 2, 0, UP, ["ΦF", "Seeds", "warrant"]), D("reach", 0, 1, 0, UP, ["battle", "ledger"])] },
    // Quiet (2): surrender, mercy, endings.
    31: { name: "YIELD", school: 2, base: "Give ground in good order: retreat with honor.",
      dials: [D("ground", 1, 3, 1, UP), D("honor", 0, 1, 0, UP, ["spent", "kept"]), D("rear", 0, 1, 0, UP, ["open", "guarded"])] },
    32: { name: "STAY", school: 2, base: "Call a halt: one foe rests its hands a round.",
      dials: [D("term", 1, 2, 1, UP), D("brittle", 0, 1, 0, UP, ["breaks", "holds"])] },
    33: { name: "MOURN", school: 2, base: "Grieve the fallen: grief becomes fuel.",
      dials: [D("fuel", 0, 2, 0, UP, ["inspiration", "charge", "favor"]), D("depth", 0, 1, 0, UP, ["rite", "vigil"]), D("whose", 0, 2, 0, UP, ["ally", "foe", "any"])] },
    34: { name: "ABSOLVE", school: 2, base: "Forgive: wipe sin, grudges, warrants clean.",
      dials: [D("scope", 0, 2, 0, UP, ["sin", "grudge", "warrant"]), D("whose", 0, 1, 0, UP, ["self", "other"]), D("price", 0, 1, 0, UP, ["free", "tithe"])] },
    35: { name: "INTER", school: 2, base: "Lay to rest: burial that bars the ledger's hunger.",
      dials: [D("rite", 0, 2, 0, UP, ["words", "oil", "song"]), D("bar", 0, 2, 0, UP, ["salvage", "feast", "all"]), D("mark", 0, 1, 0, UP, ["none", "stone"])] },
    // Tended (3): care, repair, growth.
    36: { name: "SOW", school: 3, base: "Plant for later: seed a tile that blooms.",
      dials: [D("bloom", 0, 2, 0, UP, ["cover", "balm", "snare"]), D("term", 1, 3, 1, UP), D("ground", 0, 1, 0, UP, ["soil", "anywhere"])] },
    37: { name: "PRUNE", school: 3, base: "Cut the rot: cleanse poison, burn and blight.",
      dials: [D("scope", 0, 1, 0, UP, ["one", "party"]), D("depth", 0, 1, 0, UP, ["mild", "all"])] },
    38: { name: "WATER", school: 3, base: "Sustain: slow healing over slow rounds.",
      dials: [D("flow", 1, 3, 1, UP), D("term", 1, 3, 2, UP), D("scope", 0, 1, 0, UP, ["one", "party"])] },
    39: { name: "GRAFT", school: 3, base: "Lend flesh-knowledge: share a trait for the battle.",
      dials: [D("term", 0, 2, 0, UP, ["scene", "battle", "saga"]), D("take", 0, 1, 0, UP, ["lend", "move"])] },
    40: { name: "WEAN", school: 3, base: "Unhook gently: end a sustain with no backlash.",
      dials: [D("what", 0, 2, 0, UP, ["aura", "bind", "stance"]), D("speed", 0, 1, 0, UP, ["slow", "swift"]), D("keep", 0, 1, 0, UP, ["ends", "lingers"])] },
    41: { name: "FALLOW", school: 3, base: "Rest a fighter: skip a turn, recover deep.",
      dials: [D("rest", 1, 2, 1, UP), D("crop", 0, 2, 0, UP, ["LF", "ΦF", "charge"]), D("whose", 0, 1, 0, UP, ["self", "ally"])] },
    // Veiled (4): secrets, hidden information.
    42: { name: "REDACT", school: 4, base: "Strike the record: observed tells are unwritten.",
      dials: [D("scope", 0, 2, 0, UP, ["tell", "journal", "all"]), D("whose", 0, 1, 0, UP, ["self", "other"]), D("trace", 0, 1, 0, DOWN, ["clean", "smudge"])] },
    43: { name: "CIPHER", school: 4, base: "Encode the tell: your next act defies reading.",
      dials: [D("span", 1, 2, 1, UP), D("depth", 0, 1, 0, UP, ["blurred", "blank"])] },
    44: { name: "PLANT", school: 4, base: "Feed the enemy a lie they will observe.",
      dials: [D("lie", 0, 2, 0, UP, ["tell", "habit", "weakness"]), D("stick", 0, 1, 0, UP, ["scene", "battle"]), D("mark", 0, 1, 0, UP, ["one", "all"])] },
    45: { name: "SHRED", school: 4, base: "Destroy evidence: counts starve without proof.",
      dials: [D("scope", 0, 2, 0, UP, ["page", "count", "case"]), D("trace", 0, 1, 0, DOWN, ["clean", "smudge"]), D("whose", 0, 1, 0, UP, ["self", "any"])] },
    46: { name: "GHOST", school: 4, base: "Kill quietly: no body, no Heat, no witness.",
      dials: [D("span", 0, 1, 0, UP, ["kill", "scene"]), D("depth", 0, 2, 0, UP, ["body", "Heat", "all"])] },
    47: { name: "SEAL", school: 4, base: "Shut a technique: name it and it sleeps.",
      dials: [D("term", 1, 3, 1, UP), D("scope", 0, 1, 0, UP, ["one", "field"])] },
    // Devoured (5): death, remains, endings.
    48: { name: "FEAST", school: 5, base: "Eat the fallen: flesh becomes fuel.",
      dials: [D("meal", 0, 2, 0, UP, ["scrap", "foe", "friend"]), D("fuel", 0, 2, 0, UP, ["LF", "charge", "both"]), D("grace", 0, 1, 0, UP, ["none", "said"])] },
    49: { name: "RENDER", school: 5, base: "Boil remains to fuel: fat renders to ΦF.",
      dials: [D("render", 0, 1, 0, UP, ["scrap", "soul"]), D("speed", 0, 1, 0, UP, ["slow", "swift"]), D("smoke", 0, 1, 0, DOWN, ["clean", "seen"])] },
    50: { name: "EXHUME", school: 5, base: "Ask the dead: answers from a silent mouth.",
      dials: [D("ask", 1, 3, 1, UP), D("depth", 0, 2, 0, UP, ["open", "sealed", "mind"]), D("price", 0, 1, 0, UP, ["free", "favor"])] },
    51: { name: "TALLY", school: 5, base: "Count the dead: every body is a coin.",
      dials: [D("coin", 0, 2, 0, UP, ["charge", "inspiration", "favor"]), D("scope", 0, 1, 0, UP, ["field", "saga"]), D("whose", 0, 1, 0, UP, ["foe", "any"])] },
    52: { name: "INHERIT", school: 5, base: "Take the fallen's craft: wield a dead technique.",
      dials: [D("term", 0, 2, 0, UP, ["scene", "battle", "kept"]), D("whose", 0, 1, 0, UP, ["foe", "any"]), D("price", 0, 1, 0, UP, ["free", "sin"])] },
    53: { name: "ROT", school: 5, base: "Hasten decay: the fallen bloom into hazard.",
      dials: [D("bloom", 0, 2, 0, UP, ["slick", "poison", "snare"]), D("term", 1, 3, 2, UP), D("spread", 0, 1, 0, UP, ["tile", "zone"])] },
    // Owing (6): debt, stakes, costs.
    54: { name: "LEDGER", school: 6, base: "Audit the table: every debt laid open.",
      dials: [D("scope", 0, 2, 0, UP, ["debts", "stakes", "all"]), D("depth", 0, 1, 0, UP, ["sums", "names"]), D("share", 0, 1, 0, UP, ["self", "table"])] },
    55: { name: "DUN", school: 6, base: "Press for payment: obligations come due now.",
      dials: [D("what", 0, 2, 0, UP, ["loan", "escrow", "tithe"]), D("cut", 0, 1, 0, UP, ["none", "tenth"]), D("face", 0, 1, 0, UP, ["quiet", "loud"])] },
    56: { name: "USURY", school: 6, base: "Lend at interest: tempo now, tempo-plus later.",
      dials: [D("sum", 10, 50, 20, UP), D("rate", 0, 2, 0, UP, ["tenth", "fifth", "half"]), D("term", 1, 3, 3, UP)] },
    57: { name: "REPO", school: 6, base: "Take it back: reclaim the granted and gifted.",
      dials: [D("what", 0, 2, 0, UP, ["technique", "item", "trait"]), D("whose", 0, 1, 0, UP, ["ally", "any"]), D("fee", 0, 1, 0, UP, ["free", "priced"])] },
    58: { name: "TITHE", school: 6, base: "Kick upstairs: a cut buys standing.",
      dials: [D("cut", 0, 2, 0, UP, ["tenth", "fifth", "half"]), D("to", 0, 2, 0, UP, ["gaia", "magistrate", "crowd"]), D("show", 0, 1, 0, UP, ["quiet", "loud"])] },
    59: { name: "MANUMIT", school: 6, base: "Buy freedom: coin breaks bonds.",
      dials: [D("bond", 0, 2, 0, UP, ["grapple", "seal", "contract"]), D("whose", 0, 1, 0, UP, ["ally", "any"]), D("price", 0, 1, 0, UP, ["fixed", "weight"])] },
    // Witnessed (7): crowds, spectacle, presence.
    60: { name: "OVATION", school: 7, base: "Work the room: Heat becomes fuel.",
      dials: [D("fuel", 0, 2, 0, UP, ["charge", "inspiration", "favor"]), D("take", 0, 1, 0, UP, ["some", "all"])] },
    61: { name: "EULOGY", school: 7, base: "Praise the fallen before them all.",
      dials: [D("whose", 0, 2, 0, UP, ["ally", "foe", "any"]), D("turn", 0, 1, 0, UP, ["favor", "absolve"]), D("crowd", 0, 1, 0, UP, ["room", "arena"])] },
    62: { name: "DEBUT", school: 7, base: "Unveil: a hidden thing meets the crowd.",
      dials: [D("what", 0, 2, 0, UP, ["ally", "technique", "self"]), D("splash", 0, 1, 0, UP, ["named", "titled"])] },
    63: { name: "ENCORE", school: 7, base: "They demand it again: repeat the beloved thing.",
      dials: [D("price", 0, 1, 0, UP, ["half", "free"]), D("fade", 0, 1, 0, UP, ["full", "fading"]), D("whose", 0, 1, 0, UP, ["self", "any"])] },
    64: { name: "CURTAIN", school: 7, base: "Close the show: pass the hat, bank the night.",
      dials: [D("take", 0, 2, 0, UP, ["seeds", "favor", "both"]), D("bow", 0, 1, 0, UP, ["quick", "full"])] },
  };
  const dialOf = (id, dial) => (VERBS[id]?.dials || []).find((d) => d.name === dial) || null;
  function clampDial(id, dial, value) {
    const d = dialOf(id, dial);
    if (!d) return { value: null, warning: `${VERBS[id]?.name || `Verb ${id}`} has no ${dial} dial.` };
    const v = Math.max(d.min, Math.min(d.max, Math.round(Number(value))));
    return { value: v, warning: v === Number(value) ? null : `${VERBS[id].name} ${dial} runs ${d.min}–${d.max}; set to ${v}.` };
  }
  // Price = sum of normalized steps per dial: ↑ counts (v − min)/(max − min), ↓ counts (max − v)/(max − min), → counts 0.
  function dialPrice(id, values = {}) {
    let p = 0;
    for (const d of VERBS[id]?.dials || []) {
      const v = clampDial(id, d.name, values[d.name] ?? d.def).value, span = d.max - d.min || 1;
      if (d.dir === UP) p += (v - d.min) / span; else if (d.dir === DOWN) p += (d.max - v) / span;
    }
    return Math.round(p * 1000) / 1000;
  }
  const ring = (i, j) => { const x = Math.abs(i - j); return Math.min(x, 8 - x); };
  const ringDistance = (a, b) => ring(VERBS[a].school, VERBS[b].school);

  const S = (name, meaning) => ({ name, meaning });
  const SEEDS = {   // W8.3 emergence table v0, combination order (left is first); reverse orders miss until someone attests them
    "1x11": S("The Open Secret", "A mystery declared publicly: name a hidden thing aloud. The vow strengthens it and the mystery deepens it; both prices paid, both powers kept."),
    "8x16": S("The Forgiven Ledger", "A debt converted to mercy: forgive what is owed mid-battle; the forgiven amount becomes Heat or favor instead of Seeds."),
    "6x13": S("The Last Appeal", "A posthumous verdict: the fallen's bequest includes one final count, tried after death and paid from the estate."),
    "9x3": S("The Tended Stage", "Devotion performed: tell a tended thing's story before a crowd, and the care log becomes Heat."),
    "17x9": S("Velvet Clinch", "The tended gloves finish gently: submission holds by this clinch spare by default."),
    "4x5": S("The Rigged Court", "A spectacle duel under trial rules: the undercard is a courtroom, the verdict is the purse."),
    "2x5": S("Sworn Evidence", "An announcement entered as evidence: declared claims become exhibit-grade."),
    "15x3": S("The Staked House", "Crowd-held stakes: the audience escrows the lots (the self-escrow discount is lost, trust is gained)."),
    "11x12": S("The Honest Mask", "A veil that invites one peek: hide everything, show one true thing."),
    "7x8": S("The Gentle End", "A surrender that spares both: a knee taken under this sign ends the battle with no ledger mark either way."),
    "15x6": S("The Priced Door", "Stakes as passage: the verdict's price must be anted before it can be read."),
    "13x2": S("The Written After", "A published death: the bequest is announced, heirs are public, claims are sworn."),
    "9x10": S("The Kept Thing", "Care and repair unified: one rite that tends and mends."),
    "1x3": S("The Crowded Oath", "A vow sworn before crowds: witnesses strengthen it (magnitude +1 while witnessed)."),
    "14x10": S("The Second Life", "Strip and rebuild: salvage feeds mend directly (battlefield repair from the fallen)."),
    "12x6": S("The Read Verdict", "Read the judge, then the verdict: one peek at sealed procedure before it lands."),
  };
  const BLESSED = ["1x11", "8x16", "6x13", "9x3"];   // the four opposed flagships: price 1 whatever the distance
  const seed = (p, q) => SEEDS[`${p}x${q}`] || null;
  function mergePrice(p, q, curve) {
    if (BLESSED.includes(`${p}x${q}`)) return 1;
    const d = ringDistance(p, q), c = curve || [1, 1, 2, 2, 3, 4];
    return d >= 4 ? c[c.length - 1] * 2 : c[d];
  }
  return { SCHOOLS, VERBS, UP, DOWN, FREE, clampDial, dialPrice, ringDistance, SEEDS, BLESSED, seed, mergePrice };
});
