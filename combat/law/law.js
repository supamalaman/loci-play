"use strict";
// Laws of Gods of Men (Mala, 2026-10-12; playable 2026-10-19 with the Magistrate). Posted rules with enforced prices:
// a Statute taxes one named delivery inside its zone, a Warrant makes one enemy an Outlaw the law follows everywhere,
// every taxed act is a breach in the ledger, and Judgment of the Gods sentences only the guilty. The Magistrate's merge,
// Exile's Gate, draws a line that punishes crossing. It prices acts, never forbids them; it binds its own caster.
// State: Statutes and gates are s.terrainEffects (kind "statute" / "exileGate", so the board draws them); marks are
// unit.status.outlaw; the ledger is s.cls.lawLedger. JSON-only; no randomness here.
// Hammurabi truth engine (Codex SPEC, ~/loci-orbit/codex/hammurabi-truth/SPEC.md; built by Claude, 2026-10-25): every breach is
// graded as it is written (s.cls.lawEvidence): SWORN (the act was announced: you declared it), WITNESSED (someone on the
// lawgiver's side saw it within 5 tiles), or UNPROVEN. Judgment sentences proven guilt as before; guilt resting only on
// unproven breaches goes to the Ordeal of the River: the accused takes the ordeal; if they live, the unproven breaches are
// struck and the false accuser pays. Every technique also leaves testimony (s.cls.testimony), the Liar Lawyer's future input.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatLaw = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // Numbers. AP is on the 25/35/50-per-technique scale, so the tax is 15 (Mala, 2026-10-19: enough to decide whether a Guard still fits), not the card's draft +2.
  const LAW = {
    statute: { radius: 2, range: 3, turns: 2, apAdd: 15 },
    warrant: { range: 4, turns: 2, apAdd: 15 },
    judgment: { range: 3, radius: 3, base: 10, perBreach: 5, breachCap: 2 },
    gate: { range: 6, length: 5, perStatute: 1, maxLength: 7, potency: 15, outlawTurns: 2, turns: 2 },
    jurisdiction: { pfAdd: 3 },
    contempt: { slow: 1 },
    truth: { witnessRange: 5, testimonyCap: 40, exhibitCap: 20 },
    ordeal: { trial: 6, falseAccuser: 4 },   // provisional (SPEC): the ordeal stays cheaper than the 10+ sentence it replaces
  };
  const IDS = new Set(["statute", "warrant", "judgmentOfGods", "exilesGate"]);
  const TECH = new Set(["basic", "refined", "ultimate"]);
  const st = (u) => (u.status ||= {});
  const S = (s) => (s.cls ||= {});
  const key = (x, y) => `${x},${y}`;
  const dist = (s, ax, ay, bx, by) => { const dx = Math.abs(ax - bx), dy = Math.abs(ay - by); return s.rules?.rangeMetric === "chebyshev" ? Math.max(dx, dy) : dx + dy; };
  const live = (s) => Object.values(s.actors).filter((u) => u && !u.defeated && !u.notArrived);
  const isLawgiver = (u) => !!u && (u.primary === "laws_of_gods_of_men" || u.secondary === "laws_of_gods_of_men");
  const isMagistrate = (u) => !!u && (u.character === "magistrate" || (u.primary === "laws_of_gods_of_men" && u.secondary === "threshold"));
  const say = (s, H, a, text, why) => H.log(s, { kind: "law", actor: a.id, text, ...(why ? { why } : {}) });

  // ── what is in force ──
  const zoneLive = (s, e) => { const o = s.actors[e.owner]; return !!o && !o.defeated && o.ownerTurns < e.expiresAt; };   // fell the lawgiver, the law falls
  const statutes = (s) => (s.terrainEffects || []).filter((e) => e.kind === "statute" && zoneLive(s, e));
  const gates = (s) => (s.terrainEffects || []).filter((e) => e.kind === "exileGate" && zoneLive(s, e));
  const inZone = (e, x, y) => (e.tiles || []).some(([zx, zy]) => zx === x && zy === y);
  const outlawBy = (s, u, ownerId) => { const o = u?.status?.outlaw; return !!o && o.until >= u.ownerTurns && (!ownerId || o.by === ownerId); };
  const breaches = (s, u, ownerId) => S(s).lawLedger?.[u.id]?.[ownerId] || 0;
  const guilty = (s, u, ownerId) => outlawBy(s, u, ownerId) || breaches(s, u, ownerId) > 0;
  // ── truth engine ──
  const evidence = (s, u, ownerId) => S(s).lawEvidence?.[u.id]?.[ownerId] || [];
  const unprovenCount = (s, u, ownerId) => evidence(s, u, ownerId).filter((e) => e.grade === "unproven").length;
  // Proven: an Outlaw mark (a Warrant needs sight, so it is witnessed by nature), or any breach not graded unproven. A breach
  // written before the truth engine (or by code that never grades) has no evidence entry and reads proven: no change there.
  const proven = (s, u, ownerId) => outlawBy(s, u, ownerId) || breaches(s, u, ownerId) - unprovenCount(s, u, ownerId) > 0;
  // A grade for an act by `a`, as seen by `side` (the lawgiver's side for a breach; any opposing side for testimony).
  function grade(s, a, announced, seen, H) {
    if (announced) return "sworn";
    const R = LAW.truth.witnessRange;
    return live(s).some((u) => u.id !== a.id && u.side !== a.side && seen(u) && dist(s, u.x, u.y, a.x, a.y) <= R && (!H.hasSight || H.hasSight(s, u.x, u.y, a.x, a.y))) ? "witnessed" : "unproven";
  }
  // A Statute binds everyone opposed to its writer, and its writer too; never the writer's allies.
  const boundBy = (s, a, e) => a.id === e.owner || a.side !== e.side;

  // The taxes a technique pays here: [{ owner, ap, pf, why, statute }]. Pure (menus and previews call it).
  function taxes(s, a, abilityId, m) {
    if (!m || !TECH.has(m.tier) || !s.actors) return [];
    const out = [];
    for (const e of statutes(s)) {
      if (!boundBy(s, a, e)) continue;
      const here = inZone(e, a.x, a.y), wanted = outlawBy(s, a, e.owner);
      if (m.delivery === e.named && (here || wanted)) out.push({ owner: e.owner, ap: LAW.statute.apAdd, statute: e.id, why: `${e.label}: ${e.named} techniques ${here ? "inside" : "anywhere, for an Outlaw"} cost +${LAW.statute.apAdd} AP.` });
      const writer = s.actors[e.owner];
      if (here && a.side !== e.side && isMagistrate(writer) && S(s).jurisdiction?.[`${a.id}:${e.owner}`] !== s.round)
        out.push({ owner: e.owner, pf: LAW.jurisdiction.pfAdd, jurisdiction: true, why: `Jurisdiction: the first technique each round inside ${writer.name}'s Statute costs +${LAW.jurisdiction.pfAdd} ΦF.` });
    }
    for (const u of live(s)) if (u.side !== a.side && outlawBy(s, a, u.id) && a.status.outlaw.warrant)
      out.push({ owner: u.id, ap: LAW.warrant.apAdd, why: `Outlaw: ${u.name}'s warrant adds +${LAW.warrant.apAdd} AP to every technique.` });
    return out;
  }
  // engine manifest(): the posted price shows before you commit.
  function price(s, a, abilityId, m) {
    for (const t of taxes(s, a, abilityId, m)) { if (t.ap) m.tempoCost += t.ap; if (t.pf) m.cost += t.pf; m.notes?.push(t.why); }
  }
  // beforeAbility: a taxed act is a breach; the ledger is what Judgment reads. Runs on the committed clone only.
  function beforeAbility(s, a, m, H) {
    if (m.probe) return null;   // targeting's probe (the AI listing options) shares s.cls and s.log: weighing an act is not committing it
    const id = m.id || m.ability, list = taxes(s, a, id, m);
    for (const t of list) {
      if (t.jurisdiction) { (S(s).jurisdiction ||= {})[`${a.id}:${t.owner}`] = s.round; continue; }
      if (!t.statute) continue;
      const L = ((S(s).lawLedger ||= {})[a.id] ||= {}); L[t.owner] = (L[t.owner] || 0) + 1;
      const o = s.actors[t.owner], g = s.rules?.lawTruth === false ? "proven" : grade(s, a, m.announced, (u) => !!o && u.side === o.side, H);   // lawTruth false: the old automatic guilt (sims' baseline)
      if (g !== "proven") (((S(s).lawEvidence ||= {})[a.id] ||= {})[t.owner] ||= []).push({ round: s.round, grade: g, delivery: m.delivery || null });
      if (g === "proven") { say(s, H, o || a, `${a.name} breaches ${o ? o.name + "'s" : "the"} Statute (${L[t.owner]} on the ledger).`, ["Judgment of the Gods sentences each breach."]); continue; }
      say(s, H, o || a, `${a.name} breaches ${o ? o.name + "'s" : "the"} Statute (${g}, ${L[t.owner]} on the ledger).`,
        [g === "sworn" ? "Announced under the law: a sworn act cannot be denied." : g === "witnessed" ? "Seen by the law's side: a witnessed breach stands."
          : "Nobody on the law's side saw it: an unproven breach goes to the river, not the sentence.", "Judgment of the Gods sentences each breach."]);
    }
    // Testimony (the Liar Lawyer's interface; V1 writes it): every technique, graded against anyone opposed who saw it.
    if (TECH.has(m.tier) && !IDS.has(id)) {
      const T = (S(s).testimony ||= []);
      const told = m.revelation || (m.announced ? 1 : 0);   // Revelation tier (Muse W1.1): how much was explained, and how readable that makes the intent
      T.push({ round: s.round, actor: a.id, ability: id, announced: !!m.announced, revelation: told, readable: s.rules?.revelation?.reads?.[told] ?? 0, grade: grade(s, a, m.announced, () => true, H), landed: false });
      if (T.length > LAW.truth.testimonyCap) T.splice(0, T.length - LAW.truth.testimonyCap);
    }
    return null;
  }

  // ── targeting ──
  const radiusTiles = (s, cx, cy, r, H) => { const out = [[cx, cy]];   // the centre first: resolve reads it back
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if ((x !== cx || y !== cy) && H.inside(s, x, y) && dist(s, cx, cy, x, y) <= r) out.push([x, y]);
    return out; };
  // The gate runs across the caster's line of approach: perpendicular to caster → target, centred on the target.
  function gateTiles(s, a, tx, ty, H) {
    const len = Math.min(LAW.gate.maxLength, LAW.gate.length + LAW.gate.perStatute * statutes(s).filter((e) => e.owner === a.id).length), half = Math.floor(len / 2);
    const vertical = Math.abs(tx - a.x) >= Math.abs(ty - a.y), out = [];
    for (let i = -half; i <= len - 1 - half; i++) { const x = vertical ? tx : tx + i, y = vertical ? ty + i : ty; if (H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove) out.push([x, y]); }
    return out;
  }
  function target(s, a, m, tx, ty, H) {
    const id = m.id || m.ability; if (!IDS.has(id)) return null;
    const fail = (error) => ({ ok: false, error });
    if (tx == null || ty == null || !H.inside(s, tx, ty)) return fail("Pick a tile on the field.");
    const d = dist(s, a.x, a.y, tx, ty);
    if (id === "statute") {
      if (d > LAW.statute.range) return fail(`A Statute is posted within ${LAW.statute.range} tiles.`);
      if (!H.hasSight(s, a.x, a.y, tx, ty)) return fail("Post the law where you can see it.");
      return { ok: true, tiles: radiusTiles(s, tx, ty, LAW.statute.radius, H), targets: [] };
    }
    if (id === "warrant") {
      const t = H.actorAt(s, tx, ty);
      if (!t || t.defeated || t.side === a.side) return fail("A Warrant names one visible enemy.");
      if (d > LAW.warrant.range) return fail(`A Warrant reaches ${LAW.warrant.range} tiles.`);
      if (!H.hasSight(s, a.x, a.y, tx, ty)) return fail("You must see who you name.");
      if (outlawBy(s, t, a.id)) return fail(`${t.name} is already wanted by you; marks don't refresh.`);
      return { ok: true, tiles: [[tx, ty]], targets: [t.id] };
    }
    if (id === "judgmentOfGods") {
      if (d > LAW.judgment.range) return fail(`The court sits within ${LAW.judgment.range} tiles.`);
      const tiles = radiusTiles(s, tx, ty, LAW.judgment.radius, H);
      const g = live(s).filter((u) => u.side !== a.side && tiles.some(([x, y]) => x === u.x && y === u.y) && guilty(s, u, a.id));
      if (!g.length) return fail("Judgment needs at least one guilty unit (an Outlaw or a Statute-breacher of yours) in the court.");
      return { ok: true, tiles, targets: g.map((u) => u.id) };
    }
    if (id === "exilesGate") {
      if (d > LAW.gate.range || d < 1) return fail(`Draw the gate 1 to ${LAW.gate.range} tiles away.`);
      if (!H.hasSight(s, a.x, a.y, tx, ty)) return fail("Draw the gate where you can see.");
      const tiles = gateTiles(s, a, tx, ty, H); if (tiles.length < 2) return fail("No room for a gate there.");
      return { ok: true, tiles, targets: [] };
    }
    return null;
  }

  // The Statute names what the people in the zone actually use: the delivery most common among the enemies standing
  // in it (their everyday techniques, not ultimates), else among all enemies, else line. Public on the log.
  function nameDelivery(s, a, tiles, H) {
    const foes = live(s).filter((u) => u.side !== a.side), here = foes.filter((u) => tiles.some(([x, y]) => x === u.x && y === u.y));
    for (const pool of [here, foes]) {
      const n = {};
      for (const u of pool) for (const id of H.abilitiesOf?.(u) || u.abilities || []) { const ab = H.C?.abilities?.[id], d = ab?.delivery; if (d && d !== "self" && ab.tier !== "ultimate") n[d] = (n[d] || 0) + 1; }
      const best = Object.entries(n).sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1))[0];
      if (best) return best[0];
    }
    return "line";
  }
  function setOutlaw(s, H, by, t, turns, warrant) {
    if (warrant) for (const u of Object.values(s.actors)) if (u.status?.outlaw?.by === by.id && u.status.outlaw.warrant) delete u.status.outlaw;   // one warrant at a time
    st(t).outlaw = { by: by.id, until: t.ownerTurns + turns, warrant: !!warrant };
  }

  function resolve(s, a, inst, H) {
    const id = inst.ability; if (!IDS.has(id)) return false;
    const [tx, ty] = inst.tiles?.[0] || [a.x, a.y];
    if (id === "statute") {
      const tiles = inst.tiles || [], center = [tx, ty], named = nameDelivery(s, a, tiles, H);
      s.terrainEffects = (s.terrainEffects || []).filter((e) => !(e.kind === "statute" && e.owner === a.id));   // one Statute per writer
      s.terrainEffects.push({ id: "te" + (++s.seq), kind: "statute", label: `${a.name}'s Statute`, owner: a.id, side: a.side, tiles, center, named, expiresAt: a.ownerTurns + LAW.statute.turns });
      say(s, H, a, `${a.name} posts a Statute: ${named} techniques inside cost +${LAW.statute.apAdd} AP for ${LAW.statute.turns} turns. It binds the writer too.`, ["Step out, outlast it, or fell the lawgiver."]);
      return true;
    }
    if (id === "warrant") {
      const t = H.actor(s, inst.targets?.[0]); if (!t) return true;
      setOutlaw(s, H, a, t, LAW.warrant.turns, true);
      say(s, H, a, `${a.name} issues a warrant: ${t.name} is an Outlaw for ${LAW.warrant.turns} turns (+${LAW.warrant.apAdd} AP on every technique; the Statute follows them everywhere).`, ["Outlast the mark; it doesn't refresh."]);
      return true;
    }
    if (id === "judgmentOfGods") {
      const court = new Set((inst.tiles || []).map(([x, y]) => key(x, y)));
      const g = live(s).filter((u) => u.side !== a.side && court.has(key(u.x, u.y)) && guilty(s, u, a.id));
      if (!g.length) say(s, H, a, "The court finds no one guilty; the sentence falls on nobody.");
      for (const u of g) {
        if (!proven(s, u, a.id)) { ordeal(s, a, u, inst, H); continue; }   // only unproven breaches: the river judges instead
        const n = Math.min(LAW.judgment.breachCap, breaches(s, u, a.id)), dmg = LAW.judgment.base + LAW.judgment.perBreach * n;
        H.hit(s, a, u, inst, dmg, [`Judgment: ${u.name} is guilty${n ? ` (${n} breach${n > 1 ? "es" : ""} on the ledger, +${LAW.judgment.perBreach * n})` : " (Outlaw)"}.`], { label: "Sentence", damageType: "citrinitas" });
        served(s, u, a.id);
        if (outlawBy(s, u, a.id)) delete u.status.outlaw;
      }
      s.terrainEffects = (s.terrainEffects || []).filter((e) => !(e.kind === "statute" && e.owner === a.id));   // the court consumes the Statutes
      say(s, H, a, `${a.name}'s Statutes are spent by the sentence.`);
      return true;
    }
    if (id === "exilesGate") {
      s.terrainEffects = (s.terrainEffects || []).filter((e) => !(e.kind === "exileGate" && e.owner === a.id));
      s.terrainEffects.push({ id: "te" + (++s.seq), kind: "exileGate", label: `${a.name}'s Exile's Gate`, owner: a.id, side: a.side, tiles: inst.tiles || [], expiresAt: a.ownerTurns + LAW.gate.turns, crossed: {} });
      say(s, H, a, `${a.name} draws Exile's Gate (${(inst.tiles || []).length} tiles): crossing it costs ${LAW.gate.potency} citrinitas and makes you an Outlaw; an Outlaw who crosses loses their next move.`, ["Go around the line, or clear the mark first."]);
      return true;
    }
    return false;
  }

  const served = (s, u, ownerId) => { if (S(s).lawLedger?.[u.id]) delete S(s).lawLedger[u.id][ownerId]; if (S(s).lawEvidence?.[u.id]) delete S(s).lawEvidence[u.id][ownerId]; };
  // The Ordeal of the River (Hammurabi Law 2): the accused goes into the river. Fall: the river has judged (served). Live: the
  // unproven breaches are struck, and the false accuser pays per struck breach (never below 1 LF: the fine stings, it does not
  // kill). Same damage rules as Judgment; no randomness.
  function ordeal(s, a, u, inst, H) {
    const struck = breaches(s, u, a.id), O = LAW.ordeal;
    H.hit(s, a, u, inst, O.trial, [`The Ordeal of the River: ${u.name}'s guilt is unproven (${struck} breach${struck > 1 ? "es" : ""} nobody on the law's side saw), so the river judges.`], { label: "Ordeal", damageType: "citrinitas" });
    served(s, u, a.id);
    if (u.defeated) { say(s, H, a, `The river takes ${u.name}: the sentence is moot.`, ["Survive the ordeal and you are innocent; fall and the river has judged."]); return; }
    const fine = Math.min(O.falseAccuser * struck, Math.max(0, a.lf - 1)); a.lf -= fine;
    say(s, H, a, `${u.name} survives the river: innocent. ${struck} unproven breach${struck > 1 ? "es are" : " is"} struck, and ${a.name} pays ${fine} LF for the false accusation.`,
      ["The law binds its own caster, bad prosecutions included. Prove the breach (announced or witnessed) before you sentence it."]);
  }

  // Walking through a gate tile (not starting on it) is a crossing: once per gate per turn.
  function moved(s, a, from, traversed, H) {
    if (!traversed || traversed.length < 2) return;
    for (const g of gates(s)) {
      if (g.side === a.side) continue;
      const tag = `${a.id}:${a.ownerTurns}`; if (g.crossed?.[tag]) continue;
      if (!traversed.slice(1).some(([x, y]) => inZone(g, x, y))) continue;
      (g.crossed ||= {})[tag] = true;
      const owner = s.actors[g.owner];
      if (outlawBy(s, a, null)) {
        st(a).exiled = { by: g.owner, until: a.ownerTurns + 1 };
        say(s, H, owner, `${a.name} crosses Exile's Gate as an Outlaw: no more moving until their next turn is over.`);
      } else {
        H.hit(s, owner, a, { ability: "exilesGate", name: "Exile's Gate", delivery: "field", damageType: "citrinitas", tier: "ultimate" }, LAW.gate.potency, [`${a.name} crosses Exile's Gate.`], { label: "Exile", damageType: "citrinitas" });
        if (!a.defeated) setOutlaw(s, H, owner, a, LAW.gate.outlawTurns, false);
      }
    }
  }
  function beforeMove(s, a) {
    const x = a.status?.exiled;
    if (x && x.until >= a.ownerTurns) return "Exiled: you crossed the gate as an Outlaw and lose your move until your next turn ends.";
    return null;
  }
  // Contempt: once per round, an Outlaw who damages the Magistrate is Slowed 1 (their next turn).
  function afterHit(s, src, tgt, inst, dealt, H) {
    if (src && inst && dealt > 0) {   // testimony: the act landed (a sworn act that never lands is perjury fuel for the Liar Lawyer)
      const e = (S(s).testimony || []).findLast?.((t) => t.actor === src.id && t.ability === inst.ability && t.round === s.round && !t.landed);
      if (e) e.landed = true;
    }
    if (!src || !tgt || !(dealt > 0) || src.side === tgt.side || !isMagistrate(tgt) || !outlawBy(s, src, null)) return;
    const R = (S(s).contempt ||= {}); if (R[tgt.id] === s.round) return; R[tgt.id] = s.round;
    const prev = src.status?.moveAdd;
    st(src).moveAdd = { amount: Math.min(prev && prev.expiresAt > src.ownerTurns ? prev.amount : 0, 0) - LAW.contempt.slow, expiresAt: src.ownerTurns + 2 };
    say(s, H, tgt, `Contempt of court: ${src.name} is Slowed ${LAW.contempt.slow} for striking the Magistrate.`);
  }
  // Expired Statutes and gates leave the board.
  function turnStart(s, a) {
    if (s.terrainEffects?.length) s.terrainEffects = s.terrainEffects.filter((e) => !(e.kind === "statute" || e.kind === "exileGate") || zoneLive(s, e));
  }
  // ── exhibits: Observe debriefs units into trial witnesses (TRIAL.md). Silent
  // v1 (the observe log shows the study); surfacing exhibits in UI is later work.
  const hasTrait = (u, id) => (u.traits || []).some((t) => (t.id || t) === id);
  function debrief(s, observer, subject) {
    if (!observer || !subject || observer.id === subject.id || subject.defeated) return null;
    const X = (S(s).exhibits ||= []);
    const row = { round: s.round, observer: observer.id, subject: subject.id,
      honest: hasTrait(subject, "honest"), arrivalRound: subject.arrivesRound ?? 0 };
    const prior = X.find((e) => e.observer === observer.id && e.subject === subject.id);
    if (prior) Object.assign(prior, row); else X.push(row);
    while (X.length > LAW.truth.exhibitCap) X.shift();
    return row;
  }

  // ── AI ── the law is worth posting where foes stand, naming the wanted, and sentencing the guilty.
  function aiValue(s, a, cand, H) {
    const id = cand.ability; if (!IDS.has(id)) return null;
    const foes = live(s).filter((u) => u.side !== a.side);
    const t = cand.target;
    if (id === "statute") {
      if (!t || statutes(s).some((e) => e.owner === a.id)) return 0;
      const n = foes.filter((u) => dist(s, t[0], t[1], u.x, u.y) <= LAW.statute.radius).length;
      return n ? 3 + 2 * n : 0;
    }
    if (id === "warrant") {
      const u = t && H.actorAt(s, t[0], t[1]); if (!u || outlawBy(s, u, a.id)) return 0;
      if (foes.some((f) => f.status?.outlaw?.by === a.id && f.status.outlaw.warrant && outlawBy(s, f, a.id))) return 0;
      return 4 + (statutes(s).some((e) => e.owner === a.id) ? 2 : 0) + (u.lf <= u.maxLF * 0.5 ? 1 : 0);
    }
    if (id === "judgmentOfGods") {
      if (!t) return 0;
      // Proven guilt is worth the sentence; unproven-only guilt is worth the ordeal less the fine if the accused would live,
      // so the AI prefers proven guilt but will risk the river against a low-LF accused. Never 0 while guilt exists.
      const O = LAW.ordeal;
      return foes.filter((u) => dist(s, t[0], t[1], u.x, u.y) <= LAW.judgment.radius && guilty(s, u, a.id))
        .reduce((v, u) => v + (proven(s, u, a.id) ? LAW.judgment.base + LAW.judgment.perBreach * Math.min(LAW.judgment.breachCap, breaches(s, u, a.id))
          : Math.max(1, O.trial - (u.lf > O.trial ? O.falseAccuser * breaches(s, u, a.id) : 0))), 0) * 0.6;
    }
    if (id === "exilesGate") {   // worth it when foes are coming at you across the line
      if (!t || gates(s).some((g) => g.owner === a.id)) return 0;
      const between = foes.filter((u) => { const du = dist(s, a.x, a.y, u.x, u.y), dt = dist(s, a.x, a.y, t[0], t[1]); return du > dt && du <= dt + 4; }).length;
      return between ? 6 + 3 * between : 0;
    }
    return null;
  }

  return { LAW, IDS, taxes, price, beforeAbility, target, resolve, moved, beforeMove, afterHit, turnStart, aiValue, statutes, gates, outlawBy, guilty, breaches, isMagistrate, isLawgiver, evidence, proven, debrief };
});
