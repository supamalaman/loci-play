"use strict";
// Cultural legacy prototype: traditions, the Magistrate's codex, books,
// the player's journal, memory slots, and codex scribing. Pure and seeded.
//
// Traditions are named patterns the game notices. The ledger is the codex:
// every founded tradition, every performed ritual, every succession. The
// Magistrate sells books drawn from what the codex holds; the player keeps
// a journal of witnessed techniques; memorized techniques occupy limited
// memory slots; scribing breaks learned techniques into parts (channel,
// delivery, load, riders) and reassembles them into custom techniques.
//
// No engine wiring in this prototype: the functions below take explicit
// inputs and return explicit results, so the integrator can hook them to
// battle events, the overworld board, and the command bar later.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatLegacy = factory();
})(typeof self !== "undefined" ? self : this, function () {

  // Small seeded RNG so shop generation is reproducible. The engine can
  // swap this for its own seeded roll when wiring lands.
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var FOUND = {
    techniqueUses: 3,      // same technique lands N times in one battle
    sequenceWins: 2,       // a two-action sequence succeeds N times
    minWitnesses: 1,       // allies who observed the pattern
    foundCost: { inspiration: 1 },
  };
  var TIERS = [
    { max: 2, name: "nascent", control: 0.15, chargeDiscount: 0.10, mult: 1 },
    { max: 5, name: "established", control: 0.15, chargeDiscount: 0.10, mult: 1.5 },
    { max: Infinity, name: "legendary", control: 0.15, chargeDiscount: 0.10, mult: 2 },
  ];
  var FORK_MODS = 3;       // mods before a reformed fork may be blessed
  var JOURNAL_NOTES = 3;   // notes to complete a journal study
  var MEMORY_SLOTS = 3;    // base memorized techniques held
  var RELEARN = 0.5;       // practice needed to re-learn a forgotten technique

  function tierFor(strength) {
    for (var i = 0; i < TIERS.length; i++) {
      if (strength <= TIERS[i].max) return TIERS[i];
    }
    return TIERS[TIERS.length - 1];
  }

  function createLedger() {
    return { traditions: [], laws: [], favor: 0, seq: 1 };
  }

  // report: { uses: {techId: lands}, sequences: [{key, wins}], witnesses: [ids],
  //           successionClaim: techId|null, battle, actor }
  // → list of founding opportunities; spending the cost is the caller's job.
  function foundingOpportunities(report) {
    var out = [];
    var witnesses = (report.witnesses || []).length;
    if (witnesses < FOUND.minWitnesses) return out;
    var uses = report.uses || {};
    Object.keys(uses).forEach(function (techId) {
      if (uses[techId] >= FOUND.techniqueUses) {
        out.push({ kind: "technique", pattern: { technique: techId, times: uses[techId] }, witnesses: report.witnesses });
      }
    });
    (report.sequences || []).forEach(function (s) {
      if (s.wins >= FOUND.sequenceWins) {
        out.push({ kind: "sequence", pattern: { sequence: s.key, wins: s.wins }, witnesses: report.witnesses });
      }
    });
    if (report.successionClaim) {
      out.push({ kind: "succession", pattern: { lineOf: report.successionClaim }, witnesses: report.witnesses });
    }
    return out;
  }

  function autoName(opportunity, founder) {
    if (opportunity.kind === "technique") return "The " + opportunity.pattern.technique + " of " + founder;
    if (opportunity.kind === "sequence") return founder + "'s Answer";
    return "The Line of " + opportunity.pattern.lineOf;
  }

  function foundTradition(ledger, opportunity, opts) {
    opts = opts || {};
    if (!opportunity) return { ok: false, error: "no-pattern" };
    if ((opportunity.witnesses || []).length < FOUND.minWitnesses) return { ok: false, error: "unwitnessed" };
    var t = {
      id: "trad-" + (ledger.seq++),
      name: opts.name || autoName(opportunity, opts.founder || "Unknown"),
      kind: opportunity.kind,
      pattern: opportunity.pattern,
      founder: opts.founder || "Unknown",
      foundedBattle: opts.battle || null,
      witnesses: (opportunity.witnesses || []).slice(),
      invocations: [],
      mods: [],
      strength: 0,
      forkOf: opts.forkOf || null,
    };
    ledger.traditions.push(t);
    return { ok: true, tradition: t, cost: FOUND.foundCost };
  }

  function getTradition(ledger, id) {
    for (var i = 0; i < ledger.traditions.length; i++) {
      if (ledger.traditions[i].id === id) return ledger.traditions[i];
    }
    return null;
  }

  // Performing the pattern deliberately. Success in a new battle: +1 strength.
  function invokeTradition(ledger, id, evt) {
    var t = getTradition(ledger, id);
    if (!t) return { ok: false, error: "unknown-tradition" };
    evt = evt || {};
    t.invocations.push({ battle: evt.battle || null, by: evt.by || null, success: !!evt.success });
    if (evt.success && evt.battle != null) {
      var seen = t.invocations.some(function (iv, idx, arr) {
        return iv.success && iv.battle === evt.battle && arr.indexOf(iv) !== arr.length - 1;
      });
      if (!seen) t.strength += 1;
    }
    return { ok: true, bonus: traditionBonus(t) };
  }

  function traditionBonus(t) {
    var tier = tierFor(t.strength);
    return {
      tier: tier.name,
      control: tier.control * tier.mult,
      chargeDiscount: tier.chargeDiscount * tier.mult,
      strength: t.strength,
    };
  }

  // End of a battle: traditions no witness invoked this battle decay by 1
  // (floor 0). Dead traditions persist and may be revived.
  function endBattle(ledger, battle) {
    ledger.traditions.forEach(function (t) {
      var invoked = t.invocations.some(function (iv) { return iv.battle === battle && iv.success; });
      if (!invoked && t.strength > 0) t.strength -= 1;
    });
    return ledger;
  }

  function reviveTradition(ledger, id) {
    var t = getTradition(ledger, id);
    if (!t) return { ok: false, error: "unknown-tradition" };
    if (t.strength > 0) return { ok: false, error: "not-dead" };
    t.strength = 1;
    t.invocations.push({ battle: null, by: null, success: true, revival: true });
    return { ok: true, tradition: t };
  }

  // A teacher beyond the founder appends a modification. At FORK_MODS the
  // reformed variant may be blessed as its own linked tradition.
  function addMod(ledger, id, mod) {
    var t = getTradition(ledger, id);
    if (!t) return { ok: false, error: "unknown-tradition" };
    t.mods.push(mod);
    return { ok: true, mods: t.mods.length, forkable: t.mods.length >= FORK_MODS };
  }

  function forkTradition(ledger, id, opts) {
    var t = getTradition(ledger, id);
    if (!t) return { ok: false, error: "unknown-tradition" };
    if (t.mods.length < FORK_MODS) return { ok: false, error: "too-orthodox" };
    opts = opts || {};
    return foundTradition(ledger, {
      kind: t.kind,
      pattern: opts.pattern || t.pattern,
      witnesses: opts.witnesses || t.witnesses,
    }, { name: opts.name, founder: opts.founder, battle: opts.battle, forkOf: t.id });
  }

  // Fame cuts both ways: established traditions are learned faster by
  // witnesses; legendary ones can be read by prepared enemies.
  function notoriety(ledger, id) {
    var t = getTradition(ledger, id);
    if (!t) return null;
    var tier = tierFor(t.strength).name;
    return {
      tier: tier,
      witnessLearnMult: tier === "nascent" ? 1 : 2,
      readable: tier === "legendary",
    };
  }

  // -- Laws of Gods and Men (the codex's second half) -----------------------
  function addLaw(ledger, law) {
    var l = { id: "law-" + (ledger.seq++), text: law.text, setBy: law.setBy || "Magistrate", breaches: [] };
    ledger.laws.push(l);
    return l;
  }

  function recordBreach(ledger, lawId, evt) {
    var law = null;
    ledger.laws.forEach(function (l) { if (l.id === lawId) law = l; });
    if (!law) return { ok: false, error: "unknown-law" };
    law.breaches.push(evt || {});
    return { ok: true, breaches: law.breaches.length };
  }

  // -- The Magistrate's shop -------------------------------------------------
  // Stock rolls from what the codex holds: techniques named in traditions
  // plus donated journal studies. Favor raises the rare-book weight.
  function codexStock(ledger) {
    var techs = [];
    ledger.traditions.forEach(function (t) {
      if (t.pattern && t.pattern.technique && techs.indexOf(t.pattern.technique) < 0) {
        techs.push(t.pattern.technique);
      }
    });
    (ledger.studies || []).forEach(function (s) {
      if (techs.indexOf(s.technique) < 0) techs.push(s.technique);
    });
    return techs;
  }

  function generateShop(ledger, opts) {
    opts = opts || {};
    var stock = codexStock(ledger);
    var slots = opts.slots || 3;
    var favor = ledger.favor || 0;
    var rng = mulberry32(hashSeed(String(opts.seed == null ? 1 : opts.seed)));
    var books = [];
    for (var i = 0; i < slots; i++) {
      if (!stock.length) break;
      var tech = stock[Math.floor(rng() * stock.length)];
      var rareRoll = rng();
      var rareChance = 0.1 + Math.min(0.4, favor * 0.05);
      var sealedRoll = rng();
      var sealedChance = 0.05 + Math.min(0.2, favor * 0.02);
      var tier = "drill";
      if (sealedRoll < sealedChance) tier = "sealed";
      else if (rareRoll < rareChance) tier = "restricted";
      books.push({ id: "book-" + i, technique: tech, tier: tier });
    }
    return books;
  }

  // Donating a completed journal study feeds the shop and earns favor.
  function donateStudy(ledger, study) {
    ledger.studies = ledger.studies || [];
    ledger.studies.push({ technique: study.technique, by: study.by || null, quality: study.quality || 1 });
    ledger.favor += 1;
    return { ok: true, favor: ledger.favor };
  }

  // -- The player's journal ---------------------------------------------------
  function createJournal() {
    return { studies: {} };
  }

  // A reaction spent on a technique used within sight. JOURNAL_NOTES notes
  // complete the study; clean observations (quality 2) count double.
  function addNote(journal, techId, quality) {
    var st = journal.studies[techId] || { technique: techId, notes: 0, practice: 0, complete: false };
    st.notes += (quality || 1) >= 2 ? 2 : 1;
    if (st.notes >= JOURNAL_NOTES) {
      st.complete = true;
      st.practice += 1;
    }
    journal.studies[techId] = st;
    return { complete: st.complete, notes: st.notes, practice: st.practice };
  }

  // -- Memory slots ------------------------------------------------------------
  function createMemory(slots) {
    return { slots: slots || MEMORY_SLOTS, held: [], forgotten: {} };
  }

  // Memorizing past capacity evicts the oldest held technique. Evicted
  // memories return to the codex: re-learning costs RELEARN × practice.
  function memorize(memory, techId, practice, threshold) {
    var need = threshold;
    if (memory.forgotten[techId]) need = Math.ceil(threshold * RELEARN);
    if (practice < need) return { ok: false, error: "unpractised", need: need };
    if (memory.held.indexOf(techId) >= 0) return { ok: true, evicted: null };
    var evicted = null;
    if (memory.held.length >= memory.slots) {
      evicted = memory.held.shift();
      memory.forgotten[evicted] = true;
    }
    memory.held.push(techId);
    delete memory.forgotten[techId];
    return { ok: true, evicted: evicted };
  }

  return {
    FOUND: FOUND, TIERS: TIERS, FORK_MODS: FORK_MODS,
    JOURNAL_NOTES: JOURNAL_NOTES, MEMORY_SLOTS: MEMORY_SLOTS,
    createLedger: createLedger,
    foundingOpportunities: foundingOpportunities,
    foundTradition: foundTradition,
    getTradition: getTradition,
    invokeTradition: invokeTradition,
    traditionBonus: traditionBonus,
    endBattle: endBattle,
    reviveTradition: reviveTradition,
    addMod: addMod,
    forkTradition: forkTradition,
    notoriety: notoriety,
    addLaw: addLaw,
    recordBreach: recordBreach,
    codexStock: codexStock,
    generateShop: generateShop,
    donateStudy: donateStudy,
    createJournal: createJournal,
    addNote: addNote,
    createMemory: createMemory,
    memorize: memorize,
  };
});
