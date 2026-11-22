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
    // The Chitinous Archbishop's liturgy (hot-build cuts F3; HOTBUILDS.md section 3; R-20261116-01, -05, -06). Provisional numbers.
    liturgy: { reach: 5, pull: 1, vesselTurns: 2, choirTax: 15, vestRange: 3, vestRadius: 1, vestTurns: 2, vestMul: 0.5 },
  };
  const IDS = new Set(["statute", "warrant", "judgmentOfGods", "exilesGate", "plateChoir", "chitinLiturgy", "bindingVestment", "secondReading"]);
  const RESTATUTE = new Set(["statute", "secondReading"]);   // Second Reading posts a Statute as Statute does (her Crescendo)
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
  const vestments = (s) => (s.terrainEffects || []).filter((e) => e.kind === "vestment" && zoneLive(s, e));
  const inZone = (e, x, y) => (e.tiles || []).some(([zx, zy]) => zx === x && zy === y);
  const outlawBy = (s, u, ownerId) => { const o = u?.status?.outlaw; return !!o && o.until >= u.ownerTurns && (!ownerId || o.by === ownerId); };
  const breaches = (s, u, ownerId) => S(s).lawLedger?.[u.id]?.[ownerId] || 0;
  const guilty = (s, u, ownerId) => outlawBy(s, u, ownerId) || breaches(s, u, ownerId) > 0;
  // ── liturgy (F3) ── a foe standing inside the writer's live Statute is "named" (R-20261116-01); the one predicate every
  // liturgy rule reads (Mark the Vessel, Plate Choir's tax, Chitin Liturgy, the Liturgist AI check).
  const named = (s, a, u) => !!a && !!u && !u.defeated && u.side !== a.side && statutes(s).some((e) => e.owner === a.id && inZone(e, u.x, u.y));
  // A liturgy Vessel mark: { by, side, until }. Lapses at the marked unit's turn count, when the writer falls, or when either changes side.
  const vesselBy = (s, u, ownerId) => { const v = u?.status?.liturgyVessel, o = v && s.actors[v.by];
    return !!v && v.until >= u.ownerTurns && (!ownerId || v.by === ownerId) && !!o && !o.defeated && o.side === v.side && u.side !== o.side; };
  function markVessel(s, H, by, u) {
    st(u).liturgyVessel = { by: by.id, side: by.side, until: u.ownerTurns + LAW.liturgy.vesselTurns };
    say(s, H, by, `${by.name} writes ${u.name}'s name on the plate: a Vessel for ${LAW.liturgy.vesselTurns} turns. Her Statute follows ${u.name} everywhere.`, ["Outlast the mark, or fell the writer; the law falls with her."]);
  }
  // Faithful hosts (R-20261116-06): a person (a character, not a beast, summon, companion, dream creature, structure or wild
  // monster) who holds a believer trait. The reward for faith is that the Archbishop may cross into them.
  const BELIEVERS = ["believer", "devoutBeliever", "fullBeliever", "convertedDevout", "convertedBeliever"];   // engine/cards.js AWARE
  const person = (u) => !!u && !u.beast && !u.summon && !u.companion && !u.dream && !u.awakened && !u.husk && !u.soulless && !u.wild && !!u.character;
  const faithful = (u) => person(u) && (u.traits || []).some((t) => BELIEVERS.includes(typeof t === "string" ? t : t?.id));
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
      const here = inZone(e, a.x, a.y), vessel = vesselBy(s, a, e.owner), wanted = outlawBy(s, a, e.owner) || vessel;   // F3: a Vessel is followed as an Outlaw is
      if (m.delivery === e.named && (here || wanted)) out.push({ owner: e.owner, ap: LAW.statute.apAdd, statute: e.id, why: `${e.label}: ${e.named} techniques ${here ? "inside" : vessel ? "anywhere, for a Vessel" : "anywhere, for an Outlaw"} cost +${LAW.statute.apAdd} AP.` });
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
    if (abilityId === "statute" && a?.choir) { m.cost = 0; m.notes?.push(`Choir: the caught ${a.choir.delivery} attack is sung back; this Statute names it and costs no ΦF.`); }   // R-20261116-05
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
      const entry = { round: s.round, grade: g, delivery: m.delivery || null };
      if (a.id === "player") {
        const archived = (S(s).courtBreaches ||= []);
        entry.courtKey = `breach-${archived.length + 1}`;
        archived.push({ ...entry, by: t.owner });
      }
      if (g !== "proven") {
        if (g === "unproven") entry.id = `ev${(s.seq = (s.seq || 0) + 1)}`;   // I4c: only unproven breaches file cards, so only they take ids (the shared seq is untouched otherwise)
        (((S(s).lawEvidence ||= {})[a.id] ||= {})[t.owner] ||= []).push(entry);
        if (g === "unproven") fileEvidenceCard(s, a, t.owner, entry);   // I4c: each unproven breach files one evidence card in the accused's deck
      }
      if (g === "proven") { say(s, H, o || a, `${a.name} breaches ${o ? o.name + "'s" : "the"} Statute (${L[t.owner]} on the ledger).`, ["Judgment of the Gods sentences each breach."]); continue; }
      say(s, H, o || a, `${a.name} breaches ${o ? o.name + "'s" : "the"} Statute (${g}, ${L[t.owner]} on the ledger).`,
        [g === "sworn" ? "Announced under the law: a sworn act cannot be denied." : g === "witnessed" ? "Seen by the law's side: a witnessed breach stands."
          : "Nobody on the law's side saw it: an unproven breach goes to the river, not the sentence.", "Judgment of the Gods sentences each breach."]);
    }
    // Testimony (the Liar Lawyer's interface; V1 writes it): every technique, graded against anyone opposed who saw it.
    if (TECH.has(m.tier) && !IDS.has(id)) {
      const T = (S(s).testimony ||= []);
      const told = m.revelation || (m.announced ? 1 : 0);   // Revelation tier (Muse W1.1): how much was explained, and how readable that makes the intent
      const subject = a.id === "player" && m.effect === "damage" ? a.id : null;
      const allegation = subject ? { subject, courtKey: `testimony-${S(s).courtTestimonySeq = (S(s).courtTestimonySeq || 0) + 1}` } : {};
      T.push({ ...allegation, round: s.round, actor: a.id, ability: id, announced: !!m.announced, revelation: told, readable: s.rules?.revelation?.reads?.[told] ?? 0, grade: grade(s, a, m.announced, () => true, H), landed: false });
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
    if (id === "plateChoir" || id === "chitinLiturgy") return { ok: true, tiles: [[a.x, a.y]], targets: [a.id] };
    if (id === "secondReading" && !statutes(s).some((e) => e.owner === a.id)) return fail("A second reading needs a first: post a Statute.");
    if (id === "bindingVestment") {
      if (d > LAW.liturgy.vestRange) return fail(`The vestment is laid within ${LAW.liturgy.vestRange} tiles.`);
      return { ok: true, tiles: radiusTiles(s, tx, ty, LAW.liturgy.vestRadius, H), targets: [] };
    }
    if (RESTATUTE.has(id)) {
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
    if (warrant && t.id === "player" && !s.preview) {
      const warrants = (S(s).warrants ||= []);
      const courtKey = `warrant-${warrants.length + 1}`;
      t.status.outlaw.courtKey = courtKey;
      warrants.push({ target: t.id, by: by.id, round: s.round, courtKey });
    }
  }

  function resolve(s, a, inst, H) {
    const id = inst.ability; if (!IDS.has(id)) return false;
    const [tx, ty] = inst.tiles?.[0] || [a.x, a.y];
    if (id === "plateChoir") return true;   // answer-only: the reaction's work is choirSustain (engine/window.js)
    if (id === "chitinLiturgy") {
      const R = LAW.liturgy, hit = live(s).filter((u) => named(s, a, u) && dist(s, a.x, a.y, u.x, u.y) <= R.reach);
      if (!hit.length) say(s, H, a, `${a.name} sings the liturgy to an empty nave: nobody stands in her Statute.`);
      for (const u of hit) {
        for (let n = 0; n < R.pull; n++) {   // one step toward her, onto open ground only
          const step = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [u.x + dx, u.y + dy])
            .filter(([x, y]) => H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove && !H.actorAt(s, x, y) && dist(s, a.x, a.y, x, y) < dist(s, a.x, a.y, u.x, u.y))
            .sort((p, q) => dist(s, a.x, a.y, p[0], p[1]) - dist(s, a.x, a.y, q[0], q[1]) || p[1] - q[1] || p[0] - q[0])[0];
          if (step) { u.x = step[0]; u.y = step[1]; }
        }
        markVessel(s, H, a, u);
      }
      return true;
    }
    if (id === "bindingVestment") {
      const own = statutes(s).find((e) => e.owner === a.id), deliv = own ? own.named : nameDelivery(s, a, inst.tiles || [], H);
      s.terrainEffects = (s.terrainEffects || []).filter((e) => !(e.kind === "vestment" && e.owner === a.id));   // one vestment per writer
      s.terrainEffects.push({ id: "te" + (++s.seq), kind: "vestment", label: `${a.name}'s Binding Vestment`, owner: a.id, side: a.side, tiles: inst.tiles || [], named: deliv, expiresAt: a.ownerTurns + LAW.liturgy.vestTurns });
      say(s, H, a, `${a.name} lays a Binding Vestment: ${deliv} techniques cast from inside it land at half, and a foe her law holds who walks in is pinned.`, ["Cast from outside it, or with another delivery; stay out of her Statute and off her plate before you step in."]);
      return true;
    }
    if (RESTATUTE.has(id)) {
      const tiles = inst.tiles || [], center = [tx, ty], sung = a.choir?.delivery || null, named = sung || nameDelivery(s, a, tiles, H);
      if (sung) { delete a.choir; say(s, H, a, `${a.name} sings back the ${sung} attack she caught: the Statute names it.`); }   // R-20261116-05
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
        if (!s.preview) recordDisposition(s, u, a.id, "punished", "Judgment of the Gods");
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

  function recordDisposition(s, u, ownerId, disposition, sentence) {
    if (u.id !== "player") return;
    const activeWarrant = outlawBy(s, u, ownerId) ? u.status.outlaw.courtKey : null;
    const records = [...(S(s).courtBreaches || []), ...(S(s).warrants || []).filter((entry) => entry.courtKey === activeWarrant)];
    for (const entry of records) {
      if (entry.by !== ownerId || entry.disposition) continue;
      entry.disposition = disposition;
      entry.sentence = sentence;
    }
  }

  const served = (s, u, ownerId) => { if (S(s).lawLedger?.[u.id]) delete S(s).lawLedger[u.id][ownerId]; const gone = ((S(s).lawEvidence?.[u.id] || {})[ownerId] || []).map((e) => e.id); if (S(s).lawEvidence?.[u.id]) delete S(s).lawEvidence[u.id][ownerId]; const decks = [s.insight?.decks?.[u.id], s.placeObservation?.key && s.insight?.decks?.[s.placeObservation.key]].filter(Boolean); for (const deck of decks) if (gone.length) deck.cards = deck.cards.filter((c) => c.kind !== "evidence" || !gone.includes(c.evidence?.entry)); };   // I4c+4d: serving the breach removes its evidence cards (accused and place decks)
  // The Ordeal of the River (Hammurabi Law 2): the accused goes into the river. Fall: the river has judged (served). Live: the
  // unproven breaches are struck, and the false accuser pays per struck breach (never below 1 LF: the fine stings, it does not
  // kill). Same damage rules as Judgment; no randomness.
  function ordeal(s, a, u, inst, H) {
    const struck = breaches(s, u, a.id), O = LAW.ordeal;
    H.hit(s, a, u, inst, O.trial, [`The Ordeal of the River: ${u.name}'s guilt is unproven (${struck} breach${struck > 1 ? "es" : ""} nobody on the law's side saw), so the river judges.`], { label: "Ordeal", damageType: "citrinitas" });
    served(s, u, a.id);
    if (!s.preview && !u.defeated) recordDisposition(s, u, a.id, "acquitted", "Ordeal of the River");
    if (u.defeated) { say(s, H, a, `The river takes ${u.name}: the sentence is moot.`, ["Survive the ordeal and you are innocent; fall and the river has judged."]); return; }
    const fine = Math.min(O.falseAccuser * struck, Math.max(0, a.lf - 1)); a.lf -= fine;
    say(s, H, a, `${u.name} survives the river: innocent. ${struck} unproven breach${struck > 1 ? "es are" : " is"} struck, and ${a.name} pays ${fine} LF for the false accusation.`,
      ["The law binds its own caster, bad prosecutions included. Prove the breach (announced or witnessed) before you sentence it."]);
  }

  // Walking through a gate tile (not starting on it) is a crossing: once per gate per turn.
  function moved(s, a, from, traversed, H) {
    if (!traversed || traversed.length < 2) return;
    for (const v of vestments(s)) if ((vesselBy(s, a, v.owner) || named(s, s.actors[v.owner], a)) && inZone(v, a.x, a.y) && !a.status?.vestPinned) {   // F3: a foe her law holds (her Vessel, or standing in her Statute) who walks in is pinned; her Constraint blend has no Mark, so the Statute half keeps it reachable
      st(a).vestPinned = { by: v.owner, until: a.ownerTurns + 1 };
      say(s, H, s.actors[v.owner], `${a.name} walks into the Binding Vestment under her law: pinned until their next turn ends.`);
    }
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
    const pin = a.status?.vestPinned;
    if (pin && pin.until >= a.ownerTurns) return "Pinned: a foe her law holds inside the Binding Vestment cannot move until their next turn ends.";
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
    if (s.terrainEffects?.length) s.terrainEffects = s.terrainEffects.filter((e) => !(e.kind === "statute" || e.kind === "exileGate" || e.kind === "vestment") || zoneLive(s, e));
    if (a.status?.vestPinned && a.status.vestPinned.until < a.ownerTurns) delete a.status.vestPinned;
    if (a.status?.liturgyVessel && !vesselBy(s, a, null)) delete a.status.liturgyVessel;   // lapsed, writer fallen, or a side changed
  }
  // Binding Vestment: a technique of the named delivery cast from inside a foe's vestment lands at half (damage.js reads it).
  function vestmentMul(s, src, inst) {
    if (!src || !inst?.delivery) return 1;
    return vestments(s).some((v) => v.side !== src.side && v.named === inst.delivery && inZone(v, src.x, src.y)) ? LAW.liturgy.vestMul : 1;
  }
  // Plate Choir (F3 reactive, engine/window.js): a ranged attack from 2+ tiles that hits her, seen, while no Choir is stored.
  function choirOption(s, d, inst, H) {
    const atk = s.actors[inst.owner];
    if (!atk || atk.defeated || atk.side === d.side || d.choir || dist(s, d.x, d.y, atk.x, atk.y) < 2) return null;
    if (!(inst.tiles || []).some(([x, y]) => x === d.x && y === d.y)) return null;
    return { target: [d.x, d.y] };
  }
  // The answer: the caught delivery is stored (one Choir); a named or Vessel attacker owes AP and its riders on her are refused; that tax is the Cash.
  function choirSustain(s, d, attack, opt, H) {
    const atk = s.actors[attack.owner]; if (!atk) return;
    d.choir = { delivery: attack.delivery || "line", from: atk.id, round: s.round };
    const bound = named(s, d, atk) || vesselBy(s, atk, d.id);
    if (bound) {
      const tax = Math.ceil(LAW.liturgy.choirTax * (opt.caught ?? 1)); atk.tempoDebt = (atk.tempoDebt || 0) + tax;
      (attack.auditRefusedTargets ||= []).push(d.id);   // the Objection rider refusal (resolve.js forTarget), on her only
      H.Inspiration?.cash(s, d, "It is written.");
    }
    say(s, H, d, `${d.name}'s plates ring: the ${d.choir.delivery} attack is caught into the Choir${bound ? `, and ${atk.name}, under her law, owes ${Math.ceil(LAW.liturgy.choirTax * (opt.caught ?? 1))} AP; the attack's push, pull, stun and seed riders on her are refused` : ""}. Damage still lands.`,
      ["Her next Statute sings it back: it names the caught delivery and costs no ΦF."]);
  }
  // ── evidence cards (Investigate I4c): each unproven breach files one `evidence` card in the accused's deck
  // (deep, so only Investigate reaches it); finding the card upgrades that entry to `found`. The card carries the
  // entry id, so duplicate breaches never cross-upgrade; cards are filed only here, never fabricated.
  const evidenceText = (entry, foundIt) => foundIt
    ? `Evidence: ${entry.delivery || "an unshaped act"} on round ${entry.round ?? "?"}. It is no longer only your word.`   // INVESTIGATE.md 11.6, exact
    : `Evidence: ${entry.delivery || "an unshaped act"} on round ${entry.round ?? "?"}: still only somebody's word.`;   // provisional: the spec is silent pre-find; same shape
  function fileEvidenceCard(s, accused, ownerId, entry) {
    const one = fileCardOn(s, s.insight?.decks?.[accused.id], `${accused.id}:evidence:${entry.id}`, accused.id, ownerId, entry);
    const pk = s.placeObservation?.key;   // I4d: the same breach files on the place deck too (the place where it happened)
    if (pk) fileCardOn(s, s.insight?.decks?.[pk], `${pk}:evidence:${entry.id}`, accused.id, ownerId, entry);
    return one;
  }
  function fileCardOn(s, deck, id, accusedId, ownerId, entry) {
    if (!deck || deck.cards.some((c) => c.evidence?.entry === entry.id)) return null;
    const card = { id, kind: "evidence", deep: true, difficulty: 2, tie: 0, key: "evidence",
      text: evidenceText(entry, false), unlocks: [], open: false, grants: {}, evidence: { accused: accusedId, owner: ownerId, entry: entry.id } };   // grants: climate.grantsFrom reads every revealed place card's grants; {} grants nothing
    deck.cards.push(card);
    return card;
  }
  function foundEvidence(s, H, observer, subject, revealed) {
    const out = [];
    for (const card of revealed || []) {
      if (card?.kind !== "evidence" || !card.evidence) continue;
      const arr = S(s).lawEvidence?.[card.evidence.accused]?.[card.evidence.owner] || [];
      const entry = arr.find((e) => e.id === card.evidence.entry);
      if (!entry || entry.grade !== "unproven") {   // served or a stale copy: nothing to upgrade; the twin of an already-found entry still reads found
        if (entry?.grade === "found" && card) card.text = evidenceText(entry, true);
        continue;
      }
      entry.grade = "found";
      const archived = S(s).courtBreaches?.find((breach) => breach.courtKey === entry.courtKey);
      if (archived) archived.grade = entry.grade;
      card.text = evidenceText(entry, true);
      const subj = s.actors?.[card.evidence.accused] || subject;   // I4d: place finds name the accused, not the place
      say(s, H, observer, `${observer.name} finds proof against ${subj.name}: ${card.text}`,
        ["Found evidence argues like witnessed: stronger than unproven, not as strong as a sworn act."]);
      out.push(entry.id);
    }
    return out;
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
    if (cand.type === "convene") return H.Courtroom.aiConvene(s, H, a, cand.target) ? 30 : 0;
    const id = cand.ability; if (!IDS.has(id)) return null;
    const foes = live(s).filter((u) => u.side !== a.side);
    const t = cand.target;
    if (id === "plateChoir") return 0;   // answer-only: reactChoice prices it in the window
    if (id === "chitinLiturgy") return 7 * foes.filter((u) => named(s, a, u) && dist(s, a.x, a.y, u.x, u.y) <= LAW.liturgy.reach).length;
    if (id === "bindingVestment") {
      if (!t || vestments(s).some((v) => v.owner === a.id)) return 0;
      const n = foes.filter((u) => dist(s, t[0], t[1], u.x, u.y) <= LAW.liturgy.vestRadius + 1).length;
      return n ? 3 + 2 * n + (foes.some((u) => vesselBy(s, u, a.id)) ? 3 : 0) : 0;
    }
    if (id === "secondReading") {   // the Crescendo: re-post the law where the foes now stand, if they have walked out of it
      if (!t) return 0;
      const inOld = foes.filter((u) => named(s, a, u)).length, inNew = foes.filter((u) => dist(s, t[0], t[1], u.x, u.y) <= LAW.statute.radius).length;
      return inNew > inOld ? 3 + 2 * (inNew - inOld) : 0;
    }
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

  return { named, vesselBy, markVessel, faithful, person, vestmentMul, choirOption, choirSustain, vestments, LAW, IDS, taxes, price, beforeAbility, target, resolve, moved, beforeMove, afterHit, turnStart, aiValue, statutes, gates, outlawBy, guilty, breaches, isMagistrate, isLawgiver, evidence, proven, debrief, foundEvidence };
});
