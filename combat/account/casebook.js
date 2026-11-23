"use strict";
// The casebook (Investigate I5a; claude-investigate-spec section 12.3 and 12.3a; R-20261122-52): open cases against ENEMY
// CLASSES, kept on the account. The court record (account/record.js) keeps crimes against you; this keeps crimes by the
// classes you fight, and both read one crime table (law/crimes.js).
//   account.cases = { open: { [classId]: Case }, closed: [Case], convicted: { [classId]: { battle, verdict } } }
//   Case  = { classId, name, opened, lastSeen, seq, crimes: [Crime], closed?: { verdict, battle } }   (seq: crimes ever filed, so an id never repeats)
//   Crime = { id, kind, severity, grade, round, battle, delivery }
// Rules:
// - A crime never fades (Mala, 2026-11-07, Magistrate D8): nothing here reads the battle clock to close anything. A crime is
//   absolved only by an acquittal, a guilty verdict with its sentence, or the Ordeal (the river judges either way).
// - Evidence upgrades a crime's grade; it never closes one.
// - Severity: law/crimes.js, then the trial's MARK_SEV for kinds outside it (law/trial.js), else 1.
// - Bounded: at most 3 crimes a case (the courtroom's maxCounts; the most severe kept, then the firmest grade, then the
//   oldest), one case per enemy class, no cap on open cases (Decision 20, R-20261122-50), closed list 30.
// Pure: every function takes an account and returns a new one. Only normalize has a caller yet (account.js createAccount and
// deserialize): I5b opens cases at battle end (ui.js finish, inside !testBattle()) from fromBattle(state, account.battles, C.characters), and
// I5-3/I5-4 carry and close them (loop:1a2053b1684).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../law/crimes.js"), require("../law/trial.js"));
  else root.ConceptCombatCasebook = factory(root.ConceptCombatCrimes, root.ConceptCombatTrial);
})(typeof self !== "undefined" ? self : this, function (Crimes, Trial) {
  const MAX_CRIMES = 3, CLOSED_LIMIT = 30;
  const GRADES = { unproven: 0, found: 1, witnessed: 2, sworn: 3, proven: 4 };   // the court record's order (account/record.js grades)
  const CLOSES = ["acquitted", "guilty", "ordeal"];
  const nat = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const str = (v) => (typeof v === "string" ? v : "");
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
  const table = () => (Crimes && Crimes.crimes) || {};

  function severityOf(kind) {
    const c = table()[kind];
    if (Number.isFinite(c)) return c;
    const m = Trial && Trial.MARK_SEV && Trial.MARK_SEV[kind];
    return Number.isFinite(m) ? m : 1;
  }
  const gradeOf = (g) => (Object.hasOwn(GRADES, g) ? g : "unproven");
  // Most severe first, then the firmest grade, then the oldest.
  const rank = (a, b) => b.severity - a.severity || GRADES[b.grade] - GRADES[a.grade] || a.battle - b.battle || a.round - b.round;

  function cleanCrime(c) {
    if (!obj(c) || !str(c.id) || !str(c.kind)) return null;
    return { id: c.id, kind: c.kind, severity: Number.isFinite(c.severity) ? c.severity : severityOf(c.kind), grade: gradeOf(c.grade),
      round: nat(c.round), battle: nat(c.battle), delivery: str(c.delivery) || null };
  }
  function cleanCase(k, classId) {
    if (!obj(k)) return null;
    const crimes = (Array.isArray(k.crimes) ? k.crimes : []).map(cleanCrime).filter(Boolean).sort(rank).slice(0, MAX_CRIMES);
    const out = { classId: str(k.classId) || classId, name: str(k.name) || classId, opened: nat(k.opened), lastSeen: nat(k.lastSeen), seq: Math.max(nat(k.seq), crimes.length), crimes };
    if (obj(k.closed) && CLOSES.includes(k.closed.verdict)) out.closed = { verdict: k.closed.verdict, battle: nat(k.closed.battle) };
    return out;
  }
  // Old saves have no `cases`; a damaged one keeps what is sound. Idempotent.
  function normalize(saved) {
    const s = obj(saved) || {}, open = {}, convicted = {};
    for (const [id, k] of Object.entries(obj(s.open) || {})) { const c = cleanCase(k, id); if (c && c.crimes.length) open[id] = c; }
    const closed = (Array.isArray(s.closed) ? s.closed : []).map((k) => cleanCase(k, str(k && k.classId))).filter((k) => k && k.classId && k.closed).slice(0, CLOSED_LIMIT);
    for (const [id, v] of Object.entries(obj(s.convicted) || {})) if (obj(v)) convicted[id] = { battle: nat(v.battle), verdict: str(v.verdict) || "guilty" };
    return { open, closed, convicted };
  }
  const casesOf = (account) => normalize(account && account.cases);
  const withCases = (account, cases) => ({ ...account, cases });

  // Open a case, or add to it (12.3, 12.5 Refresh): new crimes append, the case keeps its three most severe, lastSeen updates.
  //   report = { classId, name, battle, crimes: [{ kind, grade, round, delivery }] }
  function file(account, report) {
    const r = obj(report), classId = r && str(r.classId);
    if (!classId) return { account, ok: false, why: "No class to charge." };
    const cases = casesOf(account), battle = nat(r.battle), was = cases.open[classId];
    const seq0 = was ? was.seq : 0;
    const fresh = (Array.isArray(r.crimes) ? r.crimes : []).filter((c) => obj(c) && str(c.kind)).map((c, i) => ({ id: `${classId}-${seq0 + i + 1}`,
      kind: c.kind, severity: severityOf(c.kind), grade: gradeOf(c.grade), round: nat(c.round), battle, delivery: str(c.delivery) || null }));
    if (!fresh.length) return { account, ok: false, why: "No crime to file." };
    const k = was ? { ...was, lastSeen: battle, seq: seq0 + fresh.length, crimes: [...was.crimes, ...fresh].sort(rank).slice(0, MAX_CRIMES) }
      : { classId, name: str(r.name) || classId, opened: battle, lastSeen: battle, seq: fresh.length, crimes: fresh.sort(rank).slice(0, MAX_CRIMES) };
    return { account: withCases(account, { ...cases, open: { ...cases.open, [classId]: k } }), ok: true };
  }
  // Evidence upgrades a crime's grade (12.3a); it never lowers one, and it never closes a case.
  function upgrade(account, classId, crimeId, grade) {
    const cases = casesOf(account), k = cases.open[classId], c = k && k.crimes.find((x) => x.id === crimeId);
    if (!c) return { account, ok: false, why: "No such open crime." };
    if (!Object.hasOwn(GRADES, grade) || GRADES[grade] <= GRADES[c.grade]) return { account, ok: false, why: "That would not firm it up." };
    const next = { ...k, crimes: k.crimes.map((x) => (x.id === crimeId ? { ...x, grade } : x)).sort(rank) };
    return { account: withCases(account, { ...cases, open: { ...cases.open, [classId]: next } }), ok: true };
  }
  // A verdict (12.3a, 12.10). An acquittal, a guilty verdict WITH its sentence, or the Ordeal absolves the crimes it tried
  // (all of them when `crimes` is not given); a guilty verdict without a sentence absolves nothing. A case with no crime left
  // moves to closed (newest first, 30 kept). A guilty verdict with its sentence is a conviction (12.3: "which 12.10 calls a
  // conviction") and files one for that class; a bare guilty verdict files none.
  //   verdict = { verdict: "acquitted" | "guilty" | "ordeal", sentence?, battle, crimes?: [crimeIds] }
  function decide(account, classId, verdict) {
    const v = obj(verdict) || {}, cases = casesOf(account), k = cases.open[classId];
    if (!CLOSES.includes(v.verdict)) return { account, ok: false, why: "Not a verdict." };
    const battle = nat(v.battle);
    const convicted = v.verdict === "guilty" && str(v.sentence) ? { ...cases.convicted, [classId]: { battle, verdict: "guilty" } } : cases.convicted;
    if (!k) return { account: withCases(account, { ...cases, convicted }), ok: true, closed: false };
    const absolves = v.verdict !== "guilty" || !!str(v.sentence);
    const tried = Array.isArray(v.crimes) ? new Set(v.crimes) : null;
    const left = absolves ? k.crimes.filter((c) => tried && !tried.has(c.id)) : k.crimes;
    const open = { ...cases.open };
    let closed = cases.closed, done = false;
    if (left.length) open[classId] = { ...k, crimes: left };
    else { delete open[classId]; closed = [{ ...k, closed: { verdict: v.verdict, battle } }, ...closed].slice(0, CLOSED_LIMIT); done = true; }
    return { account: withCases(account, { open, closed, convicted }), ok: true, closed: done };
  }
  // The crimes a finished battle leaves for the casebook (12.3a "which crimes reach a case today": statute breaches, the only
  // crimes recorded as lawEvidence). One report per enemy class whose unit breached a statute owned by the player's side and
  // was not judged this battle (a verdict clears that unit's lawEvidence: law/law.js served). A breach graded "proven" is not
  // kept in lawEvidence (law.js beforeAbility), so it never reaches a case here. Pure read; the caller files them. Each
  // report carries `battle` (the account's battle count the caller passes), which file() stamps on the case and its crimes.
  // Who can be a case follows the victory ledger, the spec's precedent for class keys (account.js beatenIn): a real class
  // on a foe side, never a summon, companion, beast, monster, dream or wild thing, or a communed unit; named by the class.
  function fromBattle(state, battle = 0, characters = {}) {
    const actors = (state && state.actors) || {}, ev = (state && state.cls && state.cls.lawEvidence) || {}, byClass = {};
    const foeSide = (a) => ["enemy", "posthuman"].includes(a.side) || (state.mode === "melee" && a.side !== "player" && a.side !== "civilian" && a.side !== "bystander");
    for (const [accusedId, byOwner] of Object.entries(ev)) {
      const u = actors[accusedId];
      if (!u || !characters[u.character] || !foeSide(u) || u.summon || u.summonBinding || u.companion || u.beast || u.monster || u.dream || u.wild || u.communed || u.clone || u.mirrorOf) continue;
      for (const [ownerId, entries] of Object.entries(obj(byOwner) || {})) {
        if (!actors[ownerId] || actors[ownerId].side !== "player") continue;
        for (const e of Array.isArray(entries) ? entries : []) {
          const r = (byClass[u.character] ||= { classId: u.character, name: characters[u.character].name || u.name || u.character, battle: nat(battle), crimes: [] });
          r.crimes.push({ kind: "statuteBreach", grade: gradeOf(e && e.grade), round: nat(e && e.round), delivery: str(e && e.delivery) || null });
        }
      }
    }
    return Object.values(byClass);
  }
  return { MAX_CRIMES, CLOSED_LIMIT, severityOf, normalize, file, upgrade, decide, fromBattle };
});
