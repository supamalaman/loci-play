"use strict";
// Trial Minigame PROTOTYPE (Codex, 2026-10-24; SPEC: ~/loci-orbit/codex/hammurabi-truth/TRIAL.md).
// A bounded turn-based courtroom exchange over graded counts. Phase 2 of the
// Hammurabi work: CONSUMES evidence grades, never writes them.
//
// Prototype boundaries (all deliberate, all flagged for the real build):
// - countsFromEvidence takes real lawEvidence/testimony shapes (the truth
//   engine writes them; unitsFromBattle + debriefedSubjects bridge battle).
//   Fixtures without `debriefed` play exactly as before (ungated pools).
// - Units are fixtures {id,name,side,honest,lf,maxLF,alive,arrivalRound};
//   no battle mutation. Sentences return RESOLUTION CODES; the battle-side
//   effects (traits, police arrival, instant win) are integration work.
// - JSON-only and deterministic: no rolls anywhere. Favor math is the
//   whole minigame. Every number sits in TRIAL below, marked TUNABLE.
// - Talk-scene staging (heads/bubbles) is presentation; this file emits
//   log lines the scene will speak later.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTrial = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // ── provisional numbers (TUNABLE: sims + Mala's hands decide) ──
  // Mala 2026-10-24: optimize for DRAMA and storytelling, not legal depth.
  // Testimony is the drama (big swings); argument is cheap talk (small);
  // betrayals and forgiveness are the biggest beats in the room.
  const TRIAL = {
    favorStart: 0, favorClamp: 12,           // decisive at ±12: trial ends at once
    doubt: 4,                                // |favor| >= 4 turns the room + nudges every open count one grade step
    argueStrike: 2,                          // Argue on unproven: +2 favor, count struck
    argueWitnessed: 1,                       // Argue on witnessed: +1 favor, grade holds
    exhibitBase: 3,                          // alibi/witness favor, × credibility weight
    honestCollapse: -5,                      // honest alibi on a true act: betrayal, wasted + reeks of guilt
    honestNothing: 4,                        // honest "I saw nothing" on a thin count
    appealCost: 3,                           // leniency plea spends goodwill...
    appealFailAuthority: -6,                 // ...and fails icily under the Magistrate
    confessFavor: 3, absolveFavor: 6,        // remorse moves rooms; forgiveness moves mountains
    finalPleaFavor: 5,                       // Final Plea: lay everything bare (cuts you if sworn counts stand)
    objectionBackfire: -6,                   // failed Objection: double + binds the client
    perjuryFavor: 6,                         // exposure is a showstopper
    lawyerRetainer: 3,                       // Seeds, cheap; the risk is the price
    ordealTrial: 6, ordealFine: 4,           // Hammurabi Law 2 (SPEC.md numbers)
    exchangesPerCount: 2,                    // prosecution + defense acts, twice, then verdict
  };
  const GRADES = { struck: 0, unproven: 1, witnessed: 2, found: 2, sworn: 3 };   // I4c: found argues like witnessed (Decision 7)
  const SEV = { minor: 1, serious: 2, grave: 3, capital: 4 };

  // ── law forms (registry: data + hooks; new forms slot in here) ──
  const FORMS = {
    hammurabic: { name: "Hammurabic", ordeal: true, mirror: true, confession: false,
      about: "Ordeal for the unproven; mirror sentences; the false accuser pays." },
    statute: { name: "Statute law", ordeal: false, mirror: false, confession: false,
      about: "Ledger accounting. Proven breaches sentence by count; the unproven are dropped, not tried. No ordeal, no mercy, no mirror." },
    confession: { name: "Confession", ordeal: false, mirror: false, confession: true,
      about: "Confess any count for a reduced tier; victims may absolve to drop." },
    combat: { name: "Combat", seam: true,
      about: "NAMED SEAM, not v1: the trial IS a duel; counts convert to stakes." },
    courtroom: { name: "Deadly Sentencing", sentencing: true, ordeal: false, mirror: false, confession: false,
      about: "JJK's courtroom, ported: favor ≥+2 ACQUITS, −1..+1 CONFISCATES (named technique sealed), ≤−2 calls the Executioner's Sword. Retrials ≤2 per trial on genuinely new evidence." },
    karmic: { name: "Karmic", ordeal: false, mirror: false, confession: true, karmic: true,
      about: "The astral audit: Chitragupta reads the books (counts auto-filed from marks, never argued into existence); Yama presides; confess + restitution; verdicts carry into the next battle (rebirth)." },
    gamelaw: { name: "Game Law", ordeal: false, mirror: false, confession: false, gamelaw: true,
      about: "Table law: the room's posted rules (stakes, conduct, debt) auto-file their own breaches — witnessed, because the table saw. Mercy gradient: a clean loss costs the debt, nothing more." },
  };
  // ── counsel (registry; Seeds gate paid at trial open) ──
  const COUNSEL = {
    self: { name: "Self", retainer: 0, reliable: true,
      about: "Baseline. Full control, no modifiers. An honest accused binds themselves: self-argued counts play as sworn." },
    liarLawyer: { name: "Liar Lawyer", retainer: TRIAL.lawyerRetainer, reliable: false,
      about: "Cheap, high-risk. Unlocks Objection + Perjury; exhibits +50% weight (Silver Tongue); foe exhibits halved (Poker Face); every play announced = sworn (Due Process) — failures backfire double and bind the client." },
    ibnBattuta: { name: "Ibn Battuta", retainer: 8, reliable: true, stub: true,
      about: "STUB (reliable-counsel candidate): expensive, plays land, no backfire. Actions TBD at build." },
  };

  const say = (t, text, why, lesson) => { t.log.push({ kind: "trial", text, ...(why ? { why } : {}), ...(lesson ? { lesson } : {}) }); };
  // ── plain-language law glossary (the trial teaches as it plays; every
  // term below appears in lessons. No jargon goes unexplained.) ──
  const GLOSSARY = {
    count: "One accusation the court hears. Each count gets its own mini-fight and its own verdict.",
    favor: "Which way the room leans: +defense, −prosecution. Strong leans decide close counts.",
    sworn: "Proven by your own announced word. Cannot be denied — you said it in public.",
    witnessed: "Proven because someone credible saw it. Arguable, but it holds.",
    found: "Proven by found evidence. Argues like witnessed: stronger than unproven, not as strong as a sworn act.",
    unproven: "Claimed but not proven. The defense strikes these; Hammurabic courts river-try them.",
    exhibit: "A witness brought into the room. Who they are matters as much as what they say.",
    alibi: "A defense witness: someone who says the accused was elsewhere, or the act never was.",
    objection: "Challenging testimony instead of answering it. Against true testimony it backfires.",
    perjury: "Lying after swearing truth. Get caught and the room turns on you.",
    ordeal: "Hammurabi Law 2 in action: when nothing is proven, the river judges — survive and walk free.",
    mirror: "Hammurabic sentences echo the breach: the punishment fits the crime, literally.",
    absolution: "The wronged party forgives. Under Confession law it ends the count outright.",
    counsel: "Someone who argues for you. Cheap counsel gambles; the gamble is the price.",
    magistrate: "The supreme arbiter. Only a court she presides over can issue death.",
    confiscate: "The middle verdict: a named technique is sealed for the battle. Cast nothing sealed.",
    karma: "The astral audit after a marked battle. The books accuse — kills, broken vows, frauds — and mercy mitigates.",
    restitution: "Paying the cosmos for a cleared count. Minor and serious counts only: grave and capital cannot be bought.",
    rebirth: "A karmic verdict carried into the next battle. What you did follows you.",
    gamelaw: "Table law: the posted rules of the room — stakes, conduct, debt. Break them and the table itself accuses.",
    mercy: "The gradient: a clean player who loses on points pays the debt only; titles and clean sheets go to the proven.",
    sword: "The Executioner's Sword: a death verdict made touchable. Dodge it with a free reaction and a severed limb — or hope the holder's heart dispels it.",
    retrial: "A guilty count re-opened on genuinely new evidence. Twice per trial, never for feelings.",
  };
  const unit = (t, id) => t.units[id];
  const isAlive = (u) => !!u && u.alive !== false && !u.defeated;
  // Eligibility: living now AND present when the act happened (act round vs
  // arrival round; units that arrived after the act cannot have seen it).
  const eligible = (u, actRound) => isAlive(u) && (u.arrivalRound ?? 0) <= actRound;
  const credibility = (u) => (u.side === "neutral" ? 1 : 0.5);   // disinterested weighs double
  const groundTruth = (c) => !!c.ledgerAct;   // ledger acts are TRUE; warrant-only counts are thin

  function openTrial(opts) {
    const form = FORMS[opts.form];
    if (!form || form.seam) throw new Error(`trial: unknown or unbuilt form ${opts.form}`);
    if (form.karmic && opts.marks) opts = { ...opts, counts: countsFromMarks(opts.marks) };
    if (form.gamelaw && opts.breaches) opts = { ...opts, counts: countsFromRules(opts.breaches) };
    const t = {
      form: opts.form, seed: opts.seed ?? 1, round: 0, favor: TRIAL.favorStart,
      purses: { defense: opts.purses?.defense ?? 0, prosecution: opts.purses?.prosecution ?? 0 },
      accusedId: opts.accusedId, prosecutorId: opts.prosecutorId,
      units: Object.fromEntries((opts.units || []).map((u) => [u.id, { ...u }])),
      counts: (opts.counts || []).map((c, i) => ({ id: c.id || `count-${i + 1}`,
        label: c.label || c.breach || c.id || `count-${i + 1}`,
        grade: c.grade || "unproven", severity: c.severity ?? 1,
        actRound: c.actRound ?? 0, ledgerAct: c.ledgerAct !== false,
        victimId: c.victimId || null, status: "open", appealed: false,
        confessed: false, absolved: false, exchanges: 0 })),
      representation: { defense: "self", prosecution: "self" },
      claimed: {}, suspects: {}, log: [], over: false, verdicts: null,
      ...(opts.debriefed ? { debriefed: [...opts.debriefed] } : {}),
    };
    for (const side of ["defense", "prosecution"]) {
      const want = opts.representation?.[side] || "self";
      const counsel = COUNSEL[want] || COUNSEL.self;
      const purse = opts.purses?.[side] ?? 0;
      if (purse >= counsel.retainer) { t.representation[side] = want; t[`${side}Paid`] = counsel.retainer; }
      else { t.representation[side] = "self"; t[`${side}Paid`] = 0; }
    }
    const worst = Math.max(0, ...t.counts.map((c) => c.severity));
    t.magistrate = worst >= SEV.grave || opts.courtTier === "capital";
    say(t, `The court sits: ${form.name} law. ${t.counts.length} count${t.counts.length === 1 ? "" : "s"} against ${t.accusedId}.`,
      [form.about, t.magistrate ? "The Magistrate presides. Death is on the table." : "A local judge sits. No death power."],
      "A trial answers two questions per count: is it proven, and what does it cost. Everything else is theater around those.");
    if (form.karmic && opts.mitigations?.length) {
      const lift = Math.min(3, opts.mitigations.length);
      t.favor += lift; clampFavor(t);
      say(t, `Chitragupta reads the mercies too (${opts.mitigations.join(", ")}): the room starts at +${lift}.`, ["Kept vows, captures, submissions, cherishes — love counts."], "Mitigation isn't innocence: it's the part of the record that argues for lightness.");
    }
    for (const side of ["defense", "prosecution"]) {
      const c = COUNSEL[t.representation[side]];
      say(t, `${side === "defense" ? "Defense" : "Prosecution"}: ${c.name}${t[`${side}Paid`] ? ` (retainer ${t[`${side}Paid`]} Seeds)` : ""}.`, [c.about]);
    }
    // AP-01 (4): a docket with no counts ends at open as an EMPTY verdict —
    // no counts, no sentences, no proved-innocent immunity from nothing.
    if (!t.counts.length) {
      t.over = true;
      t.verdicts = { reason: "counts-exhausted", favor: t.favor, counts: [], sentences: [] };
      say(t, "The docket is empty: no counts, no trial. The court stands adjourned.", ["counts-exhausted"]);
    }
    return t;
  }

  // Battle state in, trial fixtures out. Sides run relative to the accused
  // (their side = ally; civilian/bystander/neutral/visitors = neutral; else
  // enemy). The accused and prosecutor never testify; summons and the
  // not-yet-arrived are out (v1: the living present only).
  const NEUTRAL_SIDES = ["civilian", "bystander", "neutral", "visitors"];
  function unitsFromBattle(s, accusedId, prosecutorId) {
    const acc = s.actors[accusedId];
    return Object.values(s.actors)
      .filter((u) => u && u.id !== accusedId && u.id !== prosecutorId && !u.notArrived && !u.summon)
      .map((u) => ({ id: u.id, name: u.name || u.id,
        side: acc && u.side === acc.side ? "ally" : NEUTRAL_SIDES.includes(u.side) ? "neutral" : "enemy",
        honest: (u.traits || []).some((t) => (t.id || t) === "honest"),
        lf: u.lf, maxLF: u.maxLF, alive: !u.defeated, arrivalRound: u.arrivesRound ?? 0 }));
  }
  function debriefedSubjects(s) {
    return [...new Set((s.cls?.exhibits || []).map((e) => e.subject))];
  }

  // SPEC.md shapes in, counts out. Pass s.cls.lawEvidence[u][owner]
  // entries + s.cls.testimony rows (flattened per accused by the caller,
  // who also selects which rows to charge — the prosecution picks counts).
  function countsFromEvidence(evidence, testimony) {
    const out = [];
    for (const e of evidence || []) out.push({ grade: e.grade, severity: e.severity ?? 1,
      actRound: e.round ?? 0, ledgerAct: true, label: e.delivery ? `${e.delivery} breach` : "breach",
      victimId: e.victimId || null });
    for (const w of testimony || []) if (!w.landed) out.push({ grade: "unproven", severity: 1,
      actRound: w.round ?? 0, ledgerAct: false, label: `testimony: ${w.ability || "act"}` });
    return out;
  }

  // Karmic auto-filing: the BOOKS accuse (no prosecutor). Marks in, counts
  // out — witnessed (firm, arguable: Chitragupta reads, the room may answer).
  const MARK_SEV = { kill: 2, "broken-vow": 2, oathUnkept: 2, fraud: 1 };
  function countsFromMarks(marks) {
    return (marks || []).map((m) => ({ grade: "witnessed",
      severity: MARK_SEV[m.kind] ?? 1, actRound: m.round ?? 0, ledgerAct: true,
      label: m.label || `${m.kind}`, victimId: m.victimId || null }));
  }

  // Game-law auto-filing: the TABLE accuses (no prosecutor). Breaches in,
  // counts out — witnessed (firm, arguable: the room saw, the room may answer).
  function countsFromRules(breaches) {
    return (breaches || []).map((b) => ({ grade: "witnessed",
      severity: b.severity ?? 1, actRound: b.round ?? 0, ledgerAct: true,
      label: b.label || b.ruleId || "table breach", victimId: null }));
  }

  const openCount = (t) => t.counts.find((c) => c.status === "open");
  const clampFavor = (t) => { t.favor = Math.max(-TRIAL.favorClamp, Math.min(TRIAL.favorClamp, t.favor)); };
  const lawyer = (t, side) => t.representation[side] === "liarLawyer";

  function legalPlays(t, side) {
    if (t.over || !openCount(t)) return [];
    const c = openCount(t), moves = side === "defense"
      ? ["argue", "evidence", "appeal", "end"]
      : ["press", "evidence", "end"];
    if (side === "defense" && FORMS[t.form].confession && !c.confessed) moves.push("confess");
    if (side === "defense" && FORMS[t.form].karmic && !c.restituted) moves.push("restitute");
    if (side === "defense" && !t.pleaUsed) moves.push("finalPlea");
    if (side === "defense" && lawyer(t, side)) moves.push("objection", "perjury");
    if (c.victimId && isAlive(unit(t, c.victimId)) && !c.absolved) moves.push("absolve");
    return moves;
  }

  // ── witnesses: pools, first-claim neutrals, honesty vs ground truth ──
  function witnessPool(t, side, c) {
    const want = side === "defense" ? ["ally", "neutral"] : ["enemy", "neutral"];
    return Object.values(t.units).filter((u) => want.includes(u.side)
      && eligible(u, c.actRound) && (!t.debriefed || t.debriefed.includes(u.id))
      && !(u.side === "neutral" && t.claimed[u.id] && t.claimed[u.id] !== side));
  }
  function callWitness(t, side, c, witnessId) {
    const u = unit(t, witnessId);
    const pool = side === "defense" ? ["ally", "neutral"] : ["enemy", "neutral"];
    if (!u || !pool.includes(u.side)) return { ok: false, error: `${witnessId} cannot testify for the ${side}.` };
    if (!eligible(u, c.actRound)) return { ok: false, error: `${u.name} was not there (arrived round ${u.arrivalRound}, act round ${c.actRound}).` };
    if (t.debriefed && !t.debriefed.includes(u.id)) return { ok: false, error: `${u.name} was never debriefed: Observe them in battle first.` };
    if (u.side === "neutral") {
      if (t.claimed[u.id] && t.claimed[u.id] !== side) return { ok: false, error: `${u.name} already testifies for the other side.` };
      t.claimed[u.id] = side;
    }
    return { ok: true, witness: u };
  }
  function testimonyWeight(t, side, u) {
    let w = credibility(u);
    if (lawyer(t, side)) w *= 1.5;                                    // Silver Tongue
    if (side === "prosecution" && lawyer(t, "defense") && lawyer(t, "prosecution")) { /* mirrored Poker Faces cancel */ }
    else if (side === "prosecution" && lawyer(t, "defense")) w *= 0.5; // Poker Face
    return w;
  }

  // ── plays. Every play returns {ok, ...} and appends log lines. ──
  function play(t, side, move) {
    if (t.over) return { ok: false, error: "trial is over" };
    const c = openCount(t);
    if (!c) return { ok: false, error: "no open count" };
    const other = side === "defense" ? "prosecution" : "defense";
    const dir = side === "defense" ? 1 : -1;
    const swing = (n, text, why, lesson) => {
      const before = t.favor;
      t.favor += n; clampFavor(t); say(t, text, why, lesson);
      // Turning beats: the room visibly turns the first time each way.
      if (before < TRIAL.doubt && t.favor >= TRIAL.doubt && !t.turnedDefense) { t.turnedDefense = true;
        say(t, "The room turns. The defense has the court's ear now — close counts will break their way.", null, "Momentum matters in real courtrooms too: this is 'the weight of the evidence' made visible."); }
      if (before > -TRIAL.doubt && t.favor <= -TRIAL.doubt && !t.turnedProsecution) { t.turnedProsecution = true;
        say(t, "The room turns. The prosecution smells blood — close counts will break theirs.", null, "Same mechanism, other direction: prejudice is just momentum you don't like."); }
    };
    switch (move.kind || move) {
      case "argue": case "press": {
        if (side === "prosecution" && c.grade === "sworn") { swing(-1, `Prosecution presses the sworn count: it needs no argument.`, ["Sworn counts argue themselves."]); break; }
        if (c.grade === "sworn" && side === "defense") { swing(0, `Defense argues against a sworn count: the court is unmoved.`, ["You cannot argue with your own announced act."]); break; }
        if (c.grade === "unproven") {
          if (side === "defense") { c.status = "struck"; swing(TRIAL.argueStrike, `Defense argues the unproven count off the record: STRUCK.`, ["Cheap, weak, and exactly enough against thin counts."], "Burden of proof: the accuser must prove. 'Unproven' doesn't mean innocent — it means the court can't act."); closeCount(t, c, "struck"); }
          else swing(-1, `Prosecution presses an unproven count: it holds, barely.`, ["Thin counts need witnesses, not volume."]);
          break;
        }
        swing(dir * TRIAL.argueWitnessed, `${side === "defense" ? "Defense argues" : "Prosecution presses"} a ${c.grade === "found" ? "found" : "witnessed"} count: the grade holds, the room shifts ${dir > 0 ? "defense" : "prosecution"}.`, ["Witnessed counts resist argument."]);   // I4c: found counts argue here too, labeled found
        break;
      }
      case "evidence": {
        const called = callWitness(t, side, c, move.witnessId);
        if (!called.ok) return called;
        const u = called.witness, w = testimonyWeight(t, side, u), truth = groundTruth(c);
        if (u.honest && truth && side === "defense") {
          // Honest alibi cannot vouch for a real act: collapses, play wasted.
          swing(TRIAL.honestCollapse, `${u.name} testifies honestly for the defense — and confirms the act. The alibi COLLAPSES. The gallery gasps.`, ["Honesty pushes every count toward its true grade. A failed alibi reeks of guilt."], "Witnesses swear to the truth, not to your side. Calling a witness you haven't vetted is how cases die.");
          t.suspects[u.id] = "collapsed-alibi";
          break;
        }
        if (u.honest && !truth && side === "prosecution") {
          swing(TRIAL.honestNothing, `${u.name} testifies honestly for the prosecution: "I saw nothing." The thin count trembles.`, ["Honesty cuts against whoever called it on a count with no act behind it."], "Absence of evidence matters: a credible 'nothing happened' is itself evidence.");
          break;
        }
        const pts = Math.max(1, Math.round(TRIAL.exhibitBase * w));
        if (side === "defense") {
          c.grade = GRADES[c.grade] > 0 ? ["struck", "unproven", "witnessed", "sworn"][GRADES[c.grade] - 1] : c.grade;
          swing(pts, `${u.name} alibis the accused (${u.side}, weight ${w}). The count downgrades to ${c.grade.toUpperCase()}.`, [u.side === "neutral" ? "Disinterested testimony weighs most." : "Interested testimony weighs less."], "Credibility is about motive: courts trust witnesses with nothing to gain.");
          if (c.grade === "struck") closeCount(t, c, "struck");
        } else {
          c.grade = GRADES[c.grade] < GRADES.witnessed ? ["struck", "unproven", "witnessed", "sworn"][GRADES[c.grade] + 1] : c.grade;
          swing(-pts, `${u.name} testifies for the prosecution (${u.side}, weight ${w}). The count firms to ${c.grade.toUpperCase()}.`, ["Witnesses firm grades up — but nothing firms past witnessed except your own announced word."]);
        }
        break;
      }
      case "finalPlea": {
        if (t.pleaUsed) return { ok: false, error: "one final plea per trial" };
        t.pleaUsed = true;
        const swornStands = t.counts.some((k) => k.status === "open" && k.grade === "sworn");
        if (swornStands) swing(-TRIAL.finalPleaFavor, `The accused rises for a final plea — and the sworn counts cut the speech to ribbons. The room recoils.`, ["Never plead innocence past your own announced word."], "Pleading against admitted facts destroys credibility: this is why lawyers tell guilty clients to stay quiet.");
        else swing(TRIAL.finalPleaFavor, `The accused rises for a final plea, lays everything bare — and the room LEANS IN.`, ["One per trial. Nothing sworn stands to contradict it."], "A good closing argument doesn't add evidence; it tells the room what the evidence meant.");
        break;
      }
      case "appeal": {
        if (t.magistrate) { swing(TRIAL.appealFailAuthority, `Defense appeals to the Magistrate's court: denied, coldly.`, ["Appeals fail badly where authority is supreme."], "Higher courts defer less and forgive less: the stakes of the room decide how mercy works."); break; }
        c.severity = Math.max(SEV.minor, c.severity - 1); c.appealed = true;
        swing(-TRIAL.appealCost, `Defense pleads leniency: severity cut to ${c.severity} at the cost of goodwill.`, ["Mercy spends standing. (Standing-challenge seam: open, unbuilt.)"]);
        break;
      }
      case "confess": {
        if (!FORMS[t.form].confession) return { ok: false, error: `no confession under ${FORMS[t.form].name} law` };
        c.confessed = true; c.severity = Math.max(SEV.minor, c.severity - 1);
        swing(TRIAL.confessFavor, `The accused confesses ${c.label}: guilty at reduced tier ${c.severity}. A hush, then a nod from the bench.`, ["Remorse reads well. Built for the absolution mechanic."], "Confessions trade certainty for leniency: courts reward saving them the trouble of proving it.");
        closeCount(t, c, "confessed");
        break;
      }
      case "restitute": {
        if (!FORMS[t.form].karmic) return { ok: false, error: "restitution is a karmic rite" };
        if (c.severity >= SEV.grave) return { ok: false, error: "grave and capital counts cannot be bought" };
        const cost = c.severity * 10;
        if ((t.purses?.defense ?? 0) < cost) return { ok: false, error: `restitution costs ${cost} Seeds (have ${t.purses?.defense ?? 0})` };
        t.purses.defense -= cost; c.restituted = true;
        swing(2, `${c.label}: PAID IN FULL (${cost} Seeds to the cosmos). The count dissolves like smoke.`, ["Minor and serious counts only — the grave keeps its own books."], "Restitution predates fines: paying the harm back has always been the fastest peace.");
        closeCount(t, c, "restituted");
        break;
      }
      case "absolve": {
        const v = unit(t, c.victimId);
        if (!v || !isAlive(v)) return { ok: false, error: "no living victim to absolve" };
        c.absolved = true;
        if (FORMS[t.form].confession) { swing(TRIAL.absolveFavor, `${v.name} rises, looks the accused in the eye — and forgives. ${c.label}: DROPPED. There is not a dry eye among the neutrals.`, ["Forgiveness by the wronged party ends it, under Confession law."], "Victim forgiveness has ended cases for millennia: some justice belongs to the wronged, not the state."); closeCount(t, c, "absolved"); }
        else { c.severity = Math.max(SEV.minor, c.severity - 1); swing(TRIAL.absolveFavor, `${v.name} forgives: ${c.label} severity cut to ${c.severity}. The bench notes it, unmoved in law, moved in fact.`, ["Outside Confession law, absolution mitigates but does not drop."], "Even where forgiveness can't end a case, it mitigates: remorse + absolution is the oldest plea in the book."); }
        break;
      }
      case "objection": {
        if (!lawyer(t, side)) return { ok: false, error: "objection needs the Lawyer" };
        const target = move.witnessId ? unit(t, move.witnessId) : null;
        if (!target) return { ok: false, error: "objection needs a witness to impeach" };
        if (groundTruth(c)) {
          // Objecting to TRUE testimony is frivolous: backfire double, binds the client (Due Process).
          c.grade = "sworn";
          swing(TRIAL.objectionBackfire, `Objection! — OVERRULED. The testimony was true, the lie binds the client, and ${c.label} firms to SWORN. The lawyer smiles anyway.`, ["Due Process cuts both ways. Worse trouble than you started in."], "Frivolous objections backfire in real courts too: judges punish theater that wastes the room's time.");
        } else {
          const pts = Math.max(1, Math.round(TRIAL.exhibitBase * testimonyWeight(t, other, target)));
          t.suspects[target.id] = "objected";
          swing(dir * pts, `Objection sustained: ${target.name}'s testimony on a thin count is stripped (marked for perjury).`, ["Mirrors the class spec's Objection."]);
        }
        break;
      }
      case "perjury": {
        if (!lawyer(t, side)) return { ok: false, error: "perjury needs the Lawyer" };
        const mark = move.witnessId && t.suspects[move.witnessId];
        if (!mark) return { ok: false, error: "perjury needs failed enemy testimony to punish" };
        if (groundTruth(c) && mark !== "collapsed-alibi") return { ok: false, error: "true testimony is not perjury, however inconvenient" };
        delete t.suspects[move.witnessId];
        swing(dir * TRIAL.perjuryFavor, `Perjury! ${unit(t, move.witnessId).name} is EXPOSED, stammering, undone. Failed testimony punished.`, ["Mirrors the class spec's Perjury."], "Perjury is a crime against the court itself — that's why exposing it swings the whole room, not just the count.");
        break;
      }
      case "end": say(t, `${side === "defense" ? "Defense rests" : "Prosecution rests"} on ${c.label}: it stands as graded (${c.grade.toUpperCase()}).`); break;
      default: return { ok: false, error: `unknown play ${move.kind || move}` };
    }
    if (!t.over) {
      c.exchanges++;
      if (Math.abs(t.favor) >= TRIAL.favorClamp) endTrial(t, t.favor > 0 ? "decisive-defense" : "decisive-prosecution");
      else if (c.status === "open" && c.exchanges >= TRIAL.exchangesPerCount * 2) closeCount(t, c, "heard");
      else t.round++;
      if (!t.over && !openCount(t)) endTrial(t, "counts-exhausted");
    }
    return { ok: true };
  }

  function closeCount(t, c, how) {
    if (c.status !== "open") return;
    c.status = how;
    say(t, `${c.label}: closed (${how}).`);
  }

  // ── verdicts + sentences (resolution codes; battle effects are integration) ──
  function endTrial(t, reason) {
    t.over = true;
    const verdicts = [];
    if (FORMS[t.form].sentencing) {   // W1.3: sentencing thresholds per count (favor decides, grades merely argued)
      for (const c of t.counts.slice(0, 3)) {
        if (c.status === "struck" || c.status === "absolved") { verdicts.push({ count: c.id, verdict: "innocent", how: c.status }); continue; }
        if (c.status === "confessed") { verdicts.push({ count: c.id, verdict: "guilty", how: "confessed", severity: c.severity }); continue; }
        if (t.favor >= 2) verdicts.push({ count: c.id, verdict: "innocent", how: `favor+${t.favor}` });
        else if (t.favor <= -2) verdicts.push({ count: c.id, verdict: "guilty", how: "sword", severity: SEV.capital });
        else verdicts.push({ count: c.id, verdict: "guilty", how: "confiscate", severity: SEV.serious, confiscate: true });
      }
    }
    for (const c of (FORMS[t.form].sentencing ? [] : t.counts)) {
      if (c.status === "struck" || c.status === "absolved" || c.status === "restituted") { verdicts.push({ count: c.id, verdict: "innocent", how: c.status }); continue; }
      if (c.status === "confessed") { verdicts.push({ count: c.id, verdict: "guilty", how: "confessed", severity: c.severity }); continue; }
      let step = GRADES[c.grade] ?? 1;
      if (t.favor >= TRIAL.doubt) step--;        // doubt acquits a step
      else if (t.favor <= -TRIAL.doubt) step++;  // prejudice convicts a step (cap: witnessed — never manufactures sworn)
      step = Math.max(0, Math.min(GRADES.witnessed, step));
      if (step <= GRADES.unproven && FORMS[t.form].ordeal) { verdicts.push(ordeal(t, c)); continue; }
      if (step <= GRADES.unproven) { verdicts.push({ count: c.id, verdict: "innocent", how: "unproven" }); continue; }
      verdicts.push({ count: c.id, verdict: "guilty", how: c.grade, severity: c.severity });
    }
    t.verdicts = { reason, favor: t.favor, counts: verdicts, sentences: sentence(t, verdicts) };
    const guilty = verdicts.filter((v) => v.verdict === "guilty");
    say(t, guilty.length ? `The foreman stands. GUILTY on ${guilty.length} count${guilty.length === 1 ? "" : "s"}. The accused does not look up.` : `The foreman stands. INNOCENT — on every count. The gallery exhales all at once.`,
      [`Favor closed at ${t.favor >= 0 ? "+" : ""}${t.favor}.`, reason],
      "Verdicts answer 'proven or not,' never 'did it or not.' Every acquittal here is a lesson in reasonable doubt.");
  }

  function ordeal(t, c) {
    // Hammurabi Law 2, deterministic: the river judges the unproven.
    const accused = unit(t, t.accusedId) || { lf: 10, maxLF: 10 };
    const after = (accused.lf ?? 10) - TRIAL.ordealTrial;
    if (after > 0) {
      say(t, `The river judges ${c.label}: the accused walks out of the water, gasping, ALIVE. STRUCK — and the false accuser pays ${TRIAL.ordealFine} LF per struck breach.`, ["The law binds its own caster, including bad prosecutions."], "Trial by ordeal is real history: when courts couldn't decide, gods-or-rivers did. Hammurabi's river fined liars, not just freed the innocent.");
      return { count: c.id, verdict: "innocent", how: "ordeal-survived", fine: { to: t.prosecutorId, lf: TRIAL.ordealFine } };
    }
    say(t, `The river judges ${c.label}: the accused does not come up. Guilty as served; the sentence is moot.`, ["The river took them."], "Ordeals killed the innocent too — which is exactly why evidence grades exist. The river is the fallback, not the ideal.");
    return { count: c.id, verdict: "guilty", how: "ordeal-fallen", severity: c.severity, served: true };
  }

  function retry(t, countId, evidenceId) {   // W1.3: guilty re-opened ONCE each on genuinely new evidence (≤2 per trial)
    const c = t.counts.find((k) => k.id === countId);
    if (!c || c.status === "open") return { ok: false, error: "nothing to retry" };
    if ((t.retrialsUsed || 0) >= 2) return { ok: false, error: "retrial budget spent (2 per trial)" };
    if (!evidenceId || (t.retrialEvidence || []).includes(evidenceId)) return { ok: false, error: "retrials need NEW evidence (no loop-farming)" };
    if (c.status !== "heard" && c.status !== "confessed") return { ok: false, error: "only heard counts retry" };
    t.retrialsUsed = (t.retrialsUsed || 0) + 1;
    t.retrialEvidence = [...(t.retrialEvidence || []), evidenceId];
    c.status = "open"; c.exchanges = Math.max(0, TRIAL.exchangesPerCount * 2 - 2); c.retried = true; t.over = false; t.verdicts = null;
    say(t, `RETRIAL on ${c.label}: new evidence (${evidenceId}) re-opens it — fresh 2 rounds, then re-verdict. (${t.retrialsUsed}/2 spent.)`, ["Retrials are for evidence, not feelings."], "Double jeopardy usually bars re-trial after acquittal; re-hearing guilty counts on new evidence is the narrow honest door.");
    return { ok: true };
  }

  function sentence(t, verdicts) {
    if (!t.counts.length) return [];   // AP-01 (4): no counts, no sentences — an empty docket grants nothing
    const guilty = verdicts.filter((v) => v.verdict === "guilty" && !v.served);
    const out = [];
    for (const v of guilty.filter((g) => g.confiscate)) out.push({ kind: "confiscate", count: v.count,   // W1.3: middle verdict — the named technique is SEALED (battle applies)
      text: `CONFISCATE on ${v.count}: a named technique is sealed for the battle. Cast nothing sealed.` });
    const sword = guilty.find((g) => g.how === "sword");
    if (sword && t.magistrate) out.push({ kind: "sword", count: sword.count,   // W1.3: the Executioner's Sword — one-touch kill, dodge = free reaction + limb
      text: "THE SWORD falls: death unless dodged (1 free reaction + sever a limb). The holder may DISPEL to spare." });
    if (!guilty.length) {
      if (t.form === "gamelaw") return [{ kind: "clean-sheet",
        text: "CLEAN SHEET: the table saw nothing. Purse paid, name remembered — mercy is the default where no rule broke.",
        lesson: "Table law first asks what broke, not who lost: a clean loss is just a loss." }];
      return [{ kind: "proved-innocent", trait: "provedInnocent",
        text: "PROVED INNOCENT (battle-long): immune to re-prosecution this battle; the accuser's standing suffers.",
        accuserStanding: -2 }];
    }
    let worst = Math.max(...guilty.map((v) => v.severity ?? 1));
    const merciful = t.form !== "statute" && t.favor >= TRIAL.doubt + 1;
    if (merciful) { worst = Math.max(SEV.minor, worst - 1); out.push({ kind: "leniency", text: `Favor +${t.favor}: the court shows leniency (severity now ${worst}). Statute law never does this.` }); }
    else if (t.form === "statute") out.push({ kind: "no-mercy", text: "Statute law: no mercy, no mirror. The ledger is the sentence." });
    if (worst <= SEV.minor) out.push({ kind: "minor", text: "Minor: AP penalty now, or a multi-turn status (Slowed/Shaken-tier)." });
    else if (worst === SEV.serious) out.push({ kind: "guilty-trait", trait: "guilty", text: "GUILTY trait (battle-long): harsher future sentences, police attention, re-prosecution allowed." });
    else if (worst === SEV.grave && !t.magistrate) out.push({ kind: "incarceration", text: "INCARCERATION: police arrive — cuff, arrest, detained." });
    else if (worst >= SEV.grave && t.magistrate && worst < SEV.capital) out.push({ kind: "incarceration", text: "INCARCERATION under the Magistrate's seal: no appeal from this cell." });
    if (worst >= SEV.capital && t.magistrate && !FORMS[t.form].sentencing) out.push({ kind: "death", instantWin: "prosecution",
      text: "DEATH SENTENCE: only a court she presides over can issue it. Execution ends the battle — victory to the prosecution's side. (Melee/boss edge cases TBD.)" });
    if (worst >= SEV.capital && !t.magistrate) out.push({ kind: "incarceration", text: "Capital count, minor court: capped at INCARCERATION. She never appears for trivia — but this was not trivia; the seam is noted." });
    if (t.form === "hammurabic") out.push({ kind: "mirror-note", text: "Hammurabic mirror: the sentence echoes the breach (echo mapping TBD at build)." });
    if (t.form === "karmic" && guilty.length) out.push({ kind: "rebirth", verdicts: guilty.map((v) => ({ count: v.count, verdict: v.verdict, severity: v.severity })),
      text: "REBIRTH: this verdict carries into the next battle. What you did follows you." });
    if (t.form === "gamelaw" && worst <= SEV.minor) out.push({ kind: "debt-only",
      text: "Debt only: the purse covers it — no trait, no police. Mercy is the gradient: the table punishes what broke, not who you are.",
      lesson: "Mercy under table law is structural: light breaches cost seeds, never standing." });
    if (t.favor <= -(TRIAL.doubt + 1) && worst <= SEV.minor && t.form !== "gamelaw") out.push({ kind: "harsh", trait: "guilty", text: `Favor ${t.favor}: prejudice hardens a minor count into the GUILTY trait.` });
    return out;
  }

  return { TRIAL, FORMS, COUNSEL, GRADES, SEV, GLOSSARY, openTrial, countsFromEvidence, countsFromMarks, countsFromRules, unitsFromBattle, debriefedSubjects, legalPlays, play, endTrial, retry, witnessPool, callWitness, testimonyWeight };
});
