"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../law/crimes.js"));
  else root.ConceptCombatCourtRecord = factory(root.ConceptCombatCrimes);
})(typeof self !== "undefined" ? self : this, function ({ crimes }) {
  const grades = { unproven: 0, found: 1, witnessed: 2, sworn: 3, proven: 4 };
  const HISTORY_LIMIT = 50;
  const knownCrime = (kind) => Object.hasOwn(crimes, kind);
  const signature = (entry) => JSON.stringify([entry.kind, entry.victim?.classId, entry.victim?.name, entry.real]);
  const isOpen = (entry) => !entry.absolved;

  function normalize(saved) {
    const entries = (Array.isArray(saved?.entries) ? saved.entries : []).filter((entry) => entry && knownCrime(entry.kind));
    const closed = entries.filter((entry) => !isOpen(entry));
    const expired = new Set(closed.slice(0, Math.max(0, closed.length - HISTORY_LIMIT)));
    return {
      entries: entries.filter((entry) => !expired.has(entry)),
      seen: Number.isInteger(saved?.seen) ? saved.seen : 0,
      law: Number.isInteger(saved?.law) ? Math.min(0, saved.law) : 0,
      settledBattle: Number.isInteger(saved?.settledBattle) ? saved.settledBattle : null,
    };
  }

  function priors(record, limit = 1) {
    return normalize(record).entries.filter((entry) => isOpen(entry) && !entry.tried)
      .sort((a, b) => b.severity - a.severity || (grades[b.grade] ?? 0) - (grades[a.grade] ?? 0) || a.battle - b.battle)
      .slice(0, limit);
  }

  function settle(account, state, { stripLevels, unlocksUpTo, perkMenu }, { test = false, practice = false, date = new Date().toISOString() } = {}) {
    if (test || practice || !state.outcome) return { account, lines: [] };
    const record = normalize(account.record), battle = account.battles;
    if (record.settledBattle === battle) return { account, lines: [] };
    const cls = state.cls || {};
    const actors = state.actors || {};
    const victim = (id) => actors[id] ? { classId: actors[id].character || null, name: actors[id].name } : null;
    const batch = [];
    function add(kind, { by, source, severity = crimes[kind], grade = "witnessed", real = true } = {}) {
      const entry = { id: `court-${battle}-${batch.length + 1}`, kind, severity, real, grade, battle, date,
        victim: victim(by), source: source || null, verdict: null, tried: false, absolved: null, n: 1 };
      batch.push(entry);
      return entry;
    }
    function resolve(entry, verdict, sentence) {
      entry.tried = true;
      entry.verdict = verdict;
      if (verdict === "acquitted" || sentence) entry.absolved = { how: verdict === "acquitted" ? "acquitted" : "punished", sentence: sentence || null, battle };
    }

    const breaches = cls.courtBreaches || Object.entries(cls.lawEvidence?.player || {}).flatMap(([by, entries]) =>
      entries.map((entry) => ({ ...entry, by })));
    record.entries = record.entries.map((entry) => ({ ...entry }));
    const bySource = new Map(record.entries.filter((entry) => isOpen(entry) && !entry.tried)
      .map((entry) => [`prior:${entry.id}`, entry]));
    for (const breach of breaches) {
      const entry = add("statuteBreach", { by: breach.by, source: breach.courtKey, grade: breach.grade });
      if (breach.courtKey) bySource.set(breach.courtKey, entry);
      if (breach.disposition === "acquitted") resolve(entry, "acquitted");
      if (breach.disposition === "punished") resolve(entry, "guilty", breach.sentence || "Judgment");
    }

    for (const warrant of cls.warrants || []) {
      if (warrant.target !== "player") continue;
      const matched = breaches.filter((breach) => breach.by === warrant.by);
      const entry = add("warrant", { by: warrant.by, source: warrant.courtKey, grade: matched.length ? "witnessed" : "unproven", real: matched.length > 0 });
      if (warrant.courtKey) bySource.set(warrant.courtKey, entry);
      if (warrant.disposition === "acquitted") resolve(entry, "acquitted");
      if (warrant.disposition === "punished") resolve(entry, "guilty", warrant.sentence || "Judgment");
    }

    for (const testimony of cls.testimony || []) {
      if (testimony.landed || (testimony.target !== "player" && testimony.subject !== "player")) continue;
      const source = testimony.courtKey || `testimony:${testimony.round ?? 0}:${testimony.ability || "act"}`;
      const entry = add("testimony", { by: testimony.by, source, real: false, grade: "unproven" });
      bySource.set(source, entry);
    }

    for (const contempt of state.trial?.contempt || []) {
      if (contempt.who === "player") add("contempt", { by: state.trial.invokerId });
    }
    for (const harm of cls.civilianHarm || []) {
      add(harm.killed ? "civilianKilling" : harm.targeted ? "civilianAttack" : "civilianCollateral", { by: harm.targetId });
    }

    const lines = [];
    for (const docket of state.trialLedger || []) {
      if (docket.accused !== "player") continue;
      const charges = docket.recordCounts || [];
      const jailed = charges.filter((charge) => charge.verdict === "guilty" && charge.severity >= 2 && charge.sentence !== "sword" && !docket.swordDispelled);
      let jail = null;
      if (jailed.length) {
        const worst = Math.max(...jailed.map((charge) => charge.severity));
        jail = { levels: Math.min(3, worst - 1 + jailed.length - 1), feats: Math.min(3, worst - 1) };
        const before = account.level;
        account = stripLevels(account, jail.levels, "jail", date).account;
        const stack = [...account.perkStack], perks = { ...account.perks }, forgotten = [];
        let seatPick = account.seatPick;
        for (let i = 0; i < jail.feats && stack.length; i++) {
          const perk = stack.pop();
          perks[perk] = Math.max(0, (perks[perk] || 0) - 1);
          if (perk === "paragonsSeat" && !perks[perk]) seatPick = undefined;
          forgotten.push(perkMenu[perk]?.name || perk);
        }
        account = { ...account, perks, perkStack: stack, seatPick };
        account.unlocked = unlocksUpTo(account, account.level);
        lines.push(`Jail. ${before - account.level} levels lost. Feats forgotten: ${forgotten.join(", ") || "none"}. Prison wears a person down.`);
      }
      const guilty = [];
      for (const charge of charges) {
        let entry = bySource.get(charge.source);
        if (!entry && !charge.real) entry = add("testimony", { by: docket.by, source: charge.source, grade: charge.grade, real: false });
        const verdict = charge.verdict === "innocent" ? "acquitted" : "guilty";
        const sentence = jailed.includes(charge) ? "jail" : charge.sentence;
        if (entry) resolve(entry, verdict, sentence);
        if (verdict === "guilty") guilty.push({ ...charge, real: entry?.real ?? charge.real, entry, sentence });
      }
      if (guilty.some((charge) => !charge.real || !charge.entry)) {
        const worst = guilty.reduce((first, next) => next.severity > first.severity ? next : first);
        const conviction = add("conviction", { by: docket.by, source: worst.source, grade: worst.grade,
          real: guilty.some((charge) => charge.real), severity: worst.severity });
        resolve(conviction, "guilty", guilty.every((charge) => charge.sentence) ? worst.sentence : null);
      }
    }

    const entries = record.entries.slice();
    for (const entry of batch) {
      const index = entries.findIndex((old) => old.tried === entry.tried && old.verdict === entry.verdict && old.severity === entry.severity &&
        (isOpen(old) && isOpen(entry) || old.battle === entry.battle && old.absolved?.how === entry.absolved?.how && old.absolved?.sentence === entry.absolved?.sentence) && signature(old) === signature(entry));
      if (index < 0) entries.push(entry);
      else {
        const prior = entries[index];
        entries[index] = { ...entry, id: prior.id, firstBattle: prior.firstBattle ?? prior.battle, n: (prior.n || 1) + 1, grade: (grades[entry.grade] ?? 0) > (grades[prior.grade] ?? 0) ? entry.grade : prior.grade };
      }
    }
    record.entries = entries;
    record.settledBattle = battle;
    return { account: { ...account, record: normalize(record) }, lines };
  }

  return { normalize, priors, settle };
});
