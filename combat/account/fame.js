"use strict";
// Fame (specs/FAME.md, ~/loci-orbit/ready-to-review/claude-fame-spec; Mala, 2026-10-30: "we should setup the fame status soon, so non-lethal
// victories can start paying"). `account.fame` keeps its meaning (the level, integer 0..cap); deeds add points to a meter that rolls the level up.
// Pure functions, no storage, no engine edit: the account carries the keys and whoever owns the account saves them (like gaia-bond.js).
// F0a: this module and the account keys. Nothing calls `award` yet (F0b wires the settle call, the lines, the busk and the Witnessed gate).
//
//   RULES                                       tunables (every number shown to the player is read from here)
//   cap(account)                                5, +1 per rank of the Name Recognition perk (max 8)
//   levelFor(account)                           the stored level, clamped to 0..cap
//   need(level)                                 points to go from `level` to the next, or null at the top
//   tierName(level)                             display name only (never stat-bearing)
//   effects(level)                              { persuasion, hallDiscount, hallPct }: what a level is worth (section 3)
//   eventsFrom(state, characters)               pure read of a finished battle -> [{ row, key, name }]
//   award(account, events, ctx)                 { account, pts, level, lines, rows }; ctx.battles is the clock (default account.battles)
//   add(account, pts, source)                   { account, pts, level, levelUp }: busk and any future source
//   migrate(account)                            the four keys, idempotent; an old save's Fame was all busking
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatFame = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RULES = {
    baseCap: 5, maxCap: 8,
    cost: [3, 5, 8, 12, 16, 20, 24, 28],                       // points to reach level 1..8 from the level before (cumulative 3, 8, 16, 28, 44, 64, 88, 116)
    points: { persuade: 2, spared: 1, knockout: 1, sealed: 1, tamed: 1, presence: 4, bonus: 1, busk: 2, trial: 1, clean: 1, perform: 1 },
    perBattleCap: 4,                                           // rows of one battle together; a busk is its own town action
    window: 10,                                                // finished battles a foe key is remembered for: full, half (rounded down), then nothing
    maxSeen: 24,                                               // keys kept in fameSeen (oldest by `last` dropped)
    persuasionPer: 0.01, hallPer: 0.04, hallMaxLevel: 5,       // E1 and E3 (section 3); the 0.3 persuasion cap stays in parley.js
    perk: "nameRecognition",                                   // the perk line whose ranks lift the cap (the perks shelf; absent until it lands)
    tiers: ["Unknown", "Noticed", "Known", "Respected", "Renowned", "Legend", "Storied", "Fabled", "Mythic"],
    deeds: { persuade: "came to terms with", spared: "spared", knockout: "knocked out", sealed: "sealed", tamed: "tamed", presence: "won by presence", bonus: "won without a death", trial: "won a trial", clean: "kept clean hands", busk: "busked", perform: "gave a performance the crowd remembers" },
    unnamed: ["presence", "bonus", "clean", "busk", "perform", "trial"],            // rows whose line has no foe to name
  };
  const rowsOnce = ["presence", "bonus", "trial", "clean", "perform"];     // rows with no foe key: they are not diminished by key

  const cap = (account) => Math.min(RULES.maxCap, RULES.baseCap + Math.max(0, Math.floor(account?.perks?.[RULES.perk] || 0)));
  const levelFor = (account) => Math.max(0, Math.min(cap(account), Math.floor(Number(account?.fame) || 0)));
  const need = (level) => (level >= RULES.maxCap ? null : RULES.cost[level]);
  const tierName = (level) => RULES.tiers[Math.max(0, Math.min(RULES.tiers.length - 1, Math.floor(level) || 0))];
  const effects = (level) => {
    const hallLevel = Math.min(Math.max(0, level), RULES.hallMaxLevel);
    return { persuasion: Math.round(Math.max(0, level) * RULES.persuasionPer * 100) / 100, hallDiscount: Math.round(hallLevel * RULES.hallPer * 100) / 100, hallPct: Math.round(hallLevel * RULES.hallPer * 100) };
  };

  // ── reading a finished battle ──
  // Eligible: the player won, and the foe is a real-class fighter (the filter of account.js beatenIn) that is not a boss or secret warrior (they pay 0 Fame).
  // One row per foe, best route first: persuade, spared, knockout. Beasts are sealed or tamed by nature and key on the monster kind.
  function eventsFrom(s, characters = {}) {
    const out = s?.outcome;
    if (!s || out?.winner !== "player" || s.focusedDreamTest) return [];
    const actors = Object.values(s.actors || {}), sideOf = (id) => s.actors?.[id]?.side;
    const foeSide = (a) => ["enemy", "posthuman"].includes(a.side) || (s.mode === "melee" && a.side !== "player" && a.side !== "civilian" && a.side !== "bystander");
    const real = (a) => characters[a.character] && !a.boss && !a.summon && !a.summonBinding && !a.companion && !a.beast && !a.monster && !a.dream && !a.wild && !a.communed && !a.escaped && !a.notArrived;
    const events = [], name = (a) => characters[a.character]?.name || a.name || a.character;   // the class name, as beatenIn shows it
    for (const a of actors) {
      if (!foeSide(a) || a.boss) continue;
      // Sealed: the engine seals any gated foe and calls the win "Sealed, not killed." (true-forms.js), so every sealed foe pays, keyed by the monster (a string) or the class.
      if (a.status?.sealedBeast && !a.summon) { events.push({ row: "sealed", key: (typeof a.monster === "string" ? a.monster : a.monster?.kind) || a.beast?.kind || a.character || a.id, name: name(a) }); continue; }
      if (!real(a)) continue;
      if (a.persuaded && sideOf(a.persuaded.with) === "player") events.push({ row: "persuade", key: a.character, name: name(a) });
      else if (a.spared) events.push({ row: "spared", key: a.character, name: name(a) });
      else if (a.knockedOut) events.push({ row: "knockout", key: a.character, name: name(a) });
    }
    // Tamed THIS battle: tameComplete sets beast.tamed and tamed.round; the called pack (beast.called) and a remembered friend (beast.friend) are not a deed of this fight.
    for (const a of actors) if (a.beast?.tamed && !a.beast.called && !a.beast.friend && a.tamed?.round != null && !a.defeated && sideOf(a.tamed?.owner) === "player") events.push({ row: "tamed", key: a.beast.kind || a.kind || a.character || a.id, name: name(a) });
    if (out.reason === "presence") events.push({ row: "presence", key: "presence", name: "the field" });
    // Perform (row 10, F0c; FAME.md section 15): the player's side spent Inspiration on a performance this battle. Crowd regard, so a kill does not stop it. Once a battle (R-20261103-02).
    if (Object.entries(s.inspirationPerformed || {}).some(([id, n]) => sideOf(id) === "player" && n > 0)) events.push({ row: "perform", key: "perform", name: "the crowd" });
    // Trial (row 6, F2): the player's side invoked a trial and at least one count came back guilty, or the player was the accused and every count was innocent. One row a battle.
    const ours = (id) => sideOf(id) === "player", guiltyN = (t) => (t.verdicts || []).filter((v) => /:guilty$/.test(v)).length;
    if ((s.trialLedger || []).some((t) => (ours(t.by) && guiltyN(t) > 0) || (ours(t.accused) && (t.verdicts || []).length > 0 && guiltyN(t) === 0))) events.push({ row: "trial", key: "trial", name: "the court" });
    // Bonus: nobody died. A foe that fell and is neither knocked out nor spared died; rides on a paid award (checked in award).
    // A foe died if it fell and was neither knocked out, spared nor won over: a boss, a beast or a monster counts, a summon or a foe that never arrived does not.
    const died = actors.some((a) => foeSide(a) && !a.summon && !a.summonBinding && !a.notArrived && !a.escaped && a.defeated && !a.knockedOut && !a.spared && !(a.persuaded && sideOf(a.persuaded.with) === "player"));
    if (out.nonLethal && !died && events.some((e) => e.row !== "perform" && e.row !== "trial")) events.push({ row: "bonus", key: "bonus", name: "the field" });
    return events;
  }

  // ── adding points ──
  function add(account, pts, source) {
    const before = levelFor(account), top = cap(account);
    let level = before, xp = Math.max(0, Math.floor(Number(account.fameXp) || 0)) + Math.max(0, Math.floor(pts) || 0);
    while (level < top && xp >= need(level)) { xp -= need(level); level++; }
    if (level >= top) xp = 0;                                   // nothing is stored past the cap
    const by = { ...(account.fameBy || {}) }; if (pts > 0 && source) by[source] = (by[source] || 0) + Math.floor(pts);
    return { account: { ...account, fame: level, fameXp: xp, fameBy: by }, pts: Math.max(0, Math.floor(pts) || 0), level, levelUp: level > before };
  }

  // ── a battle's award ──
  // The per-battle cap is 4. A foe key pays full the first time inside the window, half (rounded down) the second, nothing after. The bonus
  // pays only when something else paid this battle.
  function award(account, events, ctx = {}) {
    events = Array.isArray(events) ? events : [];
    const clock = ctx.battles ?? account.battles ?? 0, seen = {};
    for (const [k, v] of Object.entries(account.fameSeen || {})) if (v && clock - v.last <= RULES.window) seen[k] = { n: v.n, last: v.last };   // older entries are forgotten
    const rows = [], lines = [], keysThisBattle = new Set(), pending = {}; let total = 0, paidOnFoes = 0, stale = false;
    const order = [...events.filter((e) => e.row === "presence"), ...events.filter((e) => e.row !== "bonus" && e.row !== "presence"), ...events.filter((e) => e.row === "bonus")];   // presence first: it is the flat cap, the foes it broke add nothing
    const BAD = ["__proto__", "constructor", "prototype"];
    for (const e of order) {
      const base = RULES.points[e.row] || 0; if (!base) continue;
      if (!rowsOnce.includes(e.row) && (e.key == null || BAD.includes(String(e.key)))) continue;   // a foe row with no usable key pays nothing
      if (e.row === "bonus" && paidOnFoes <= 0) continue;
      let pts = base, note = null, seenNow = null;
      if (!rowsOnce.includes(e.row) && e.key != null) {
        const k = String(e.key), n = Object.prototype.hasOwnProperty.call(seen, k) ? seen[k].n : 0;   // the battle's own earlier foes of the same key do not count: a key moves once a battle
        pts = n === 0 ? base : n === 1 ? Math.floor(base / 2) : 0;
        note = n === 1 ? "half" : n >= 2 ? "none" : null;
        seenNow = { k, n: n + 1 };
      }
      const room = Math.max(0, RULES.perBattleCap - total), paid = Math.min(pts, room);
      if (seenNow && (paid > 0 || pts === 0) && !keysThisBattle.has(seenNow.k)) { keysThisBattle.add(seenNow.k); pending[seenNow.k] = { n: seenNow.n, last: clock }; }   // a foe the cap cut off entirely does not use up its window slot
      total += paid; if (e.row !== "bonus" && e.row !== "perform" && e.row !== "trial") paidOnFoes += paid;   // a performance or a won trial is not a foe row: it does not unlock the no-death bonus (FAME.md row 8: rows 1-5 only)
      rows.push({ row: e.row, key: e.key, name: e.name, base, pts: paid, wanted: pts, note });
      if (note && pts === 0 && e.row !== "perform") stale = true;   // a repeat that pays nothing says so, even a one-point row halved to 0
    }
    Object.assign(seen, pending);
    const keys = Object.entries(seen).sort((a, b) => b[1].last - a[1].last).slice(0, RULES.maxSeen);
    const next = { ...account, fameSeen: Object.fromEntries(keys) };
    const applied = add(next, total, null), byNext = { ...(applied.account.fameBy || {}) };
    for (const r of rows) if (r.pts > 0) byNext[r.row] = (byNext[r.row] || 0) + r.pts;
    let result = { ...applied.account, fameBy: byNext };
    // Lines: one per paid row, merged into one "capped" line when the cap bit; a repeat says why it paid less.
    const capped = rows.reduce((n, r) => n + r.wanted, 0) > RULES.perBattleCap && total >= RULES.perBattleCap;
    const named = (r) => (RULES.unnamed.includes(r.row) ? "" : ` the ${r.name}`), deed = (r) => `${RULES.deeds[r.row]}${named(r)}`;
    if (capped) lines.push(`Fame +${total} (capped): ${rows.filter((r) => r.pts > 0).map(deed).join(", ")}.`);
    else for (const r of rows) {
      if (r.pts > 0 && r.note === "half") lines.push(`Fame +${r.pts}: the ${r.name} is old news (half).`);
      else if (r.pts > 0) lines.push(`Fame +${r.pts}: ${deed(r)}.`);
    }
    if (total === 0 && stale) lines.push("Fame +0: you have beaten that fight before; people stop listening.");
    if (applied.levelUp) {
      const fx = effects(applied.level), hall = applied.level > RULES.hallMaxLevel ? `Hall prices stay -${fx.hallPct}%` : `Hiring Hall prices -${fx.hallPct}%`;
      lines.push(`Fame ${applied.level}: ${tierName(applied.level)}. Persuasion +${fx.persuasion.toFixed(2)}, ${hall}.`);
    }
    if (total > 0 && !result.fameIntro) {
      lines.unshift(`Fame is what people remember. Winning without a kill earns it: ${RULES.points.persuade} for coming to terms, ${RULES.points.presence} for a victory by presence, ${RULES.points.perform} for a performance the crowd remembers (Inspiration spent on one), up to ${RULES.perBattleCap} a battle. Each level adds ${RULES.persuasionPer.toFixed(2)} to your talk and takes ${Math.round(RULES.hallPer * 100)}% off the Hiring Hall. Killing never costs Fame. Beating a boss or a secret warrior pays nothing.`);
      result = { ...result, fameIntro: true };
    }
    return { account: result, pts: total, level: applied.level, lines, rows };
  }

  // ── the account's keys ──
  // Idempotent. An old save with fame > 0 and no fameBy gets { busk: fame } (all old Fame was busking) and the intro marked seen; `fame` is
  // clamped to 0..8 and to the cap at read time, never lowered in the file.
  function migrate(account) {
    const a = { ...account }, hadBy = a.fameBy && typeof a.fameBy === "object";
    const level = Math.max(0, Math.min(RULES.maxCap, Math.floor(Number(a.fame) || 0)));
    a.fame = level;
    a.fameXp = Math.max(0, Math.floor(Number(a.fameXp) || 0));
    a.fameBy = hadBy ? { ...a.fameBy } : level > 0 ? { busk: level } : {};
    a.fameSeen = a.fameSeen && typeof a.fameSeen === "object" ? a.fameSeen : {};
    a.fameIntro = typeof a.fameIntro === "boolean" ? a.fameIntro : level > 0;
    return a;
  }

  // ── the character sheet's Fame block (FAME.md section 10.2, F3a) ──
  // Pure: the sheet renders this, so the strings are testable without a DOM. `present` names the systems that exist ({ board, desk }): an unlock is
  // listed only when its system is present, so the sheet never advertises an absent feature.
  const SOURCE_NAMES = { busk: "Busking", persuade: "Coming to terms", spared: "Sparing", knockout: "Knockouts", sealed: "Sealing", tamed: "Taming", presence: "Presence", trial: "Trials", clean: "Clean hands", bonus: "No deaths", perform: "Performing" };
  function sheetBlock(account, present = {}) {
    const level = levelFor(account), cost = level >= cap(account) ? null : need(level), xp = cost == null ? 0 : Math.max(0, Math.floor(account?.fameXp || 0));
    const by = Object.entries(account?.fameBy || {}).filter(([k, v]) => Object.prototype.hasOwnProperty.call(SOURCE_NAMES, k) && v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([source, pts]) => [source, pts, SOURCE_NAMES[source]]);
    const fx = effects(level), unlocks = [];
    if (present.board) unlocks.push({ at: 2, what: "non-lethal jobs on the Notice board" });
    if (present.desk) unlocks.push({ at: 3, what: "the second slot on the desk shelf" });
    return { level, tier: tierName(level), xp, need: cost, next: cost == null ? null : tierName(level + 1), by, effects: { persuasion: fx.persuasion, hallPct: fx.hallPct }, unlocks };
  }
  return { RULES, cap, levelFor, need, tierName, effects, eventsFrom, add, award, migrate, sheetBlock };
});
