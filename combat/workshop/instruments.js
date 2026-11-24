// Resonant Heirlooms JI1 (Trestle TC, R-20261113-06): which held instruments may perform, and at which tier.
// Consumes Jinki.activeGifts output (the held list already excludes the broken, stored, museum'd and
// out-spoken); never replaces GIFTS, never invents a soul kind (fixed noble birth souls only).
//
// Battle state: s.instruments.byOrigin[originKey] = { freeTuneUsed, tuneTurn, tuneTakenTurn, tuned,
// memory, memoryWard, memoryDue, performanceEarned, castTotals }. Plain JSON, deterministic, no clocks
// (JI1c adds the True Performance earn: performanceEarned once per origin, castTotals per refined cast id):
// expiry is read lazily against ownerTurns, never swept by a timer. Origin keys carry the item AND the
// originating actor, so independent wearers have independent limits and clones share their original's.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatWorkshopInstruments = factory();   // its own global, like every workshop/ module: legacy/workshop.js assigns ConceptCombatWorkshop outright, later in the page
})(typeof self !== "undefined" ? self : this, function () {
  const INSTRUMENTS = ["erhu", "guzheng", "guqin", "pipa", "ruan"];
  const BASIC_ART = { erhu: "erhuWanderingNote", guzheng: "guzhengCrossingStrings", guqin: "guqinQuietLine", pipa: "pipaNeedlePluck", ruan: "ruanSteadyMeasure" };
  const REFINED_ART = { erhu: "erhuAnswerAche", guzheng: "guzhengThousandBridges", guqin: "guqinUnbrokenListening", pipa: "pipaThreeNotesOneCut", ruan: "ruanStayTogether" };   // JI1 built Guqin's; JI1c the other four (R-20261123-40)
  const ART_INSTRUMENT = {};
  for (const [id, art] of Object.entries(BASIC_ART)) ART_INSTRUMENT[art] = { id, tier: "basic" };
  for (const [id, art] of Object.entries(REFINED_ART)) ART_INSTRUMENT[art] = { id, tier: "refined" };
  ART_INSTRUMENT.tuneStrings = { id: null, tier: "basic" };   // Tune rides the wearer's own focus, any of the five
  const isInstrument = (id) => INSTRUMENTS.includes(id);
  // focusFor(account, heldIds, J): the performing foci. Absent at 0-9 care (no performance);
  // basic at 10+ (basic performance + Tune the Strings); refined at 20+ (refined performance).
  // 50 keeps refined (native Coronation stays the free once-battle gift; nothing invented).
  function focusFor(account, heldIds, J) {
    const out = [];
    for (const id of heldIds || []) {
      if (!isInstrument(id)) continue;
      const rec = account?.gear?.care?.[id];
      const g = J.giftsFor(account, id);
      if (!g) continue;   // asleep, broken, stored, museum'd, or another speaker: activeGifts already filtered these
      const tier = J.tierOf(J.scoreOf(rec));
      if (tier < 1) continue;
      out.push({ id, tier: tier >= 2 ? "refined" : "basic", soul: g.kind, care: J.scoreOf(rec) });
    }
    return out;
  }
  // The granted ability ids for a focus list: Tune plus the basic art at 10+, the refined art at 20+.
  // soulArtIds are never touched: these ride the separate instrumentArtIds record Loot.passives supplies.
  function artIdsFor(focus) {
    const out = [];
    for (const f of focus || []) {
      out.push("tuneStrings", BASIC_ART[f.id]);
      if (f.tier === "refined" && REFINED_ART[f.id]) out.push(REFINED_ART[f.id]);
    }
    return [...new Set(out)];
  }
  const originKey = (itemId, actorId) => `${itemId}>${actorId}`;
  const state = (s) => (s.instruments ||= { byOrigin: {} });
  const rec = (s, key) => (state(s).byOrigin[key] ||= {});
  const focusOf = (a) => (a?.passives?.instrumentFocus || [])[0] || null;
  const focusForId = (a, itemId) => (a?.passives?.instrumentFocus || []).find((f) => f.id === itemId) || null;
  // Lazy expiry, read against ownerTurns: a Tune charge lives its own turn and the next one
  // (gone at the start of the second subsequent own turn); Guqin memory lives to the end of the
  // caster's next own turn. Defeat is the only mid-battle source loss (gear cannot break, move,
  // or change hands mid-battle; it settles after): the defeated hold nothing.
  function clearSource(s, key) {
    const r = rec(s, key);
    r.tuned = false; r.memory = 0; r.memoryWard = null;
  }
  function sweep(s, a, key) {
    if (a.defeated) { clearSource(s, key); return; }
    const r = rec(s, key);
    if (r.tuned && a.ownerTurns > (r.tuneTurn ?? 0) + 1) { r.tuned = false; }
    if ((r.memory || 0) > 0 && a.ownerTurns > (r.memoryDue ?? 0)) { r.memory = 0; r.memoryWard = null; }
  }
  // The shared gate: hale, actually speaking focus; tier for the art; hands and sound; Tune rules.
  // Queued AP-stun alone is NOT a ban (native timing removes the AP and the action pays what remains);
  // authored silence still stops a performance. Returns null when the cast may proceed, else the refusal.
  function check(s, a, ability, action) {
    const slot = ART_INSTRUMENT[ability];
    if (!slot) return `Unknown instrument art ${ability}.`;
    const f = slot.id ? focusForId(a, slot.id) : focusOf(a);
    if (!f) return "No speaking instrument: equip an awakened Jinki instrument and choose its soul.";
    if (slot.tier === "refined" && f.tier !== "refined") return `${ability} needs a beloved instrument (20 care); this one is only awakened.`;
    const held = (x) => x && (x.until == null || x.until >= a.ownerTurns);
    if (held(a.status?.cuffed) || held(a.status?.detained)) return "Cuffed hands can't play.";
    if (a.status?.silenced && (a.status.silenced.until == null || a.status.silenced.until >= a.ownerTurns)) return "Silenced: the performance dies before it starts.";
    const key = originKey(f.id, a.id);
    sweep(s, a, key);
    const r = rec(s, key);
    if (ability === "tuneStrings") {
      if (r.tuneTakenTurn === a.ownerTurns) return "Already tuned this turn: one Tune per owner turn, no refresh.";
      if (r.tuned) return "Already tuned: spend the charge on a refined performance first.";
      return null;
    }
    if (slot.tier === "refined") {
      if (!r.tuned && !(action?.instrumentInspiration && (a.inspiration || 0) >= 1)) return "Needs Tune: Tune the Strings first, or spend 1 Inspiration.";
      return null;
    }
    return null;
  }
  const tuneFree = (s, a) => {
    const f = focusOf(a);
    if (!f) return false;
    return !rec(s, originKey(f.id, a.id)).freeTuneUsed;
  };
  // Commit a successful Tune: one charge keyed to item/actor, first success per battle/origin free.
  function takeTune(s, a, wasFree) {
    const f = focusOf(a);
    if (!f) return null;
    const r = rec(s, originKey(f.id, a.id));
    r.tuned = true; r.tuneTurn = a.ownerTurns; r.tuneTakenTurn = a.ownerTurns;
    if (wasFree) r.freeTuneUsed = true;
    return f;
  }
  // Commit a refined performance: consume the Tune charge, or the explicitly offered Inspiration.
  // Every AP/ΦF/target/tier condition is unchanged: this bends preparation, not price.
  // JI1c: a paid refined cast also opens its True Performance tally (perf: origin, caster, cast id),
  // which every actual effect of that one cast credits (heal, hostile LF lost, tagged ward prevention).
  function consumeRefined(s, a, H, action) {
    const f = focusOf(a);
    if (!f) return null;
    const key = originKey(f.id, a.id);
    sweep(s, a, key);
    const r = rec(s, key);
    let paid = null;
    if (r.tuned) { r.tuned = false; paid = "tune"; }
    else if (action?.instrumentInspiration && H?.Inspiration?.spend(s, a, 1)) paid = "inspiration";
    if (!paid) return null;
    const castId = (r.castSeq = (r.castSeq || 0) + 1);   // the origin's own counter: a refined cast never shifts the battle's shared s.seq ids
    (r.castTotals ||= {})[castId] = 0;
    return { paid, perf: { origin: key, caster: a.id, castId } };
  }
  // True Performance (spec, Shared performance rules; T8): the first refined performance each battle/origin
  // whose one cast sums at least 10 actual LF (useful healing, prevented damage, hostile damage) earns 1
  // Inspiration through the common ledger. Callers pass actual amounts only (overheal, advertised potency and
  // collision harm never reach here). The flag is consumed at the threshold even when the cap blocks the gain;
  // a later tagged ward prevention may reach it, but only while the caster is alive.
  const TRUE_PERFORMANCE = 10;
  function credit(s, perf, amount, H) {
    if (!perf || !(amount > 0)) return false;
    const caster = s.actors?.[perf.caster];
    if (!caster || caster.defeated) return false;
    const r = rec(s, perf.origin);
    if (r.performanceEarned) return false;
    const totals = (r.castTotals ||= {});
    totals[perf.castId] = (totals[perf.castId] || 0) + amount;
    if (totals[perf.castId] < TRUE_PERFORMANCE) return false;
    r.performanceEarned = true;
    H?.Inspiration?.gain(s, caster, 1, `True Performance: one refined performance did ${totals[perf.castId]} LF of real work (10 or more), once per battle.`);
    return true;
  }
  // Tag a Guqin ward as a memory source: actual prevention it catches banks up to 6 LF.
  function tagWard(s, a, ward) {
    const key = originKey("guqin", a.id);
    const r = rec(s, key);
    const id = (s.seq = (s.seq || 0) + 1);
    ward.guqin = { origin: key, caster: a.id, wardId: id };
    r.memoryWard = id; r.memory = 0; r.memoryDue = a.ownerTurns + 1;   // a new source ward overwrites, never a parallel ledger
  }
  // Bank tagged actual prevention. Stale wards (replaced, cashed shut, source defeated) bank nothing.
  function bank(s, tag, amount, H) {
    if (!tag || !(amount > 0)) return 0;
    const caster = s.actors?.[tag.caster];
    if (!caster || caster.defeated) return 0;
    const r = rec(s, tag.origin);
    if (r.memoryWard !== tag.wardId) return 0;   // replaced or from another source ward
    if (tag.closed) return 0;
    const room = Math.max(0, 6 - (r.memory || 0));
    const banked = Math.min(room, amount);
    if (banked > 0) r.memory = (r.memory || 0) + banked;   // the due turn is set once, in tagWard: memory ends at the end of the caster's next own turn after the cast; a deposit never pushes it later
    return banked;
  }
  // Quiet Line cashes the bank: up to 6 LF, capped at missing LF, only when it actually heals.
  // The cash closes its source ward to further deposits even when protection remains.
  function cash(s, a, H) {
    const key = originKey("guqin", a.id);
    sweep(s, a, key);
    const r = rec(s, key);
    return { key, amount: r.memory || 0, wardId: r.memoryWard ?? null };
  }
  function closeWard(s, wardId) {
    for (const u of Object.values(s.actors || {})) {
      if (u.status?.ward?.guqin?.wardId === wardId) u.status.ward.guqin.closed = true;
    }
  }
  function spendCash(s, key) {
    const r = rec(s, key);
    r.memory = 0;
  }
  return { INSTRUMENTS, BASIC_ART, REFINED_ART, ART_INSTRUMENT, TRUE_PERFORMANCE, isInstrument, focusFor, artIdsFor, originKey, focusOf, focusForId, check, tuneFree, takeTune, consumeRefined, credit, tagWard, bank, cash, closeWard, spendCash, clearSource, sweep };
});
