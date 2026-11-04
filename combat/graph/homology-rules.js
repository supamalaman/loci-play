"use strict";
// Homology in a battle (spec claude-homology-spec, slice H3; Mala, 2026-10-31, staged with no holder 2026-11-01): Comparative Anatomy and the
// Correspondence mark it places. Pure rules over battle state, called from three hooks in classes/class-runtime.js (the cast check, the
// resolution, the strike). Nothing here is reachable until a holder equips the concept: the abilities are staged in kits-data.js, so no
// loadout has them, and `playable()` is the one door a test (or the holder slice) uses to turn a staged definition into a castable one.
//
//   Comparative Anatomy   basic  4 ΦF  20 AP  range 5  verify two enemies' techniques; CONSERVED places one Correspondence mark and records the pair
//   Ancestral Reconstruction  ultimate 16 ΦF 55 AP 4 LF  (H5) announced: at the caster's NEXT turn start verify up to two candidate techniques against one reference;
//                         each CONSERVED candidate (up to two) becomes an Ancestral Guard: the first later cast of that exact technique by that enemy takes 4 off the
//                         damage to one allied fighter, minimum 0, and the guard is spent. No guard for DIVERGENT or ANALOGOUS; nothing is refunded.
//   The compositions (H6): primary Indexing + secondary Homology records each verified pair as a Lineage Ledger for two caster turns (the first reuse of either
//                         technique announces its feature and relationship); primary Inference + secondary Homology turns a failed comparison into one Eliminated
//                         Hypothesis (the next comparison of a different pair costs 10 less AP, floor 10). An Archivist's Index move flags the team's observations of the
//                         indexed enemy as held in an Indexing record, which lengthens their window to three rounds (the opposition edge). Reversal's clearing of the two
//                         tactical effects is `reverse` (a stub until Reversal runs).
//   Conserved Joint       refined 6 ΦF 35 AP  range 6  (H4) prepare one allied fighter against the next use of one member technique of the live pair: a prepaid
//                         sidestep (the engine's prepaid-escape primitive, conditions.js) that fires before that attack lands; the Vow of the Ancestral Skeleton
//                         (7 ΦF, 45 AP, 3 LF, range 4) allows a route of up to two contiguous steps
//   Vow of Anatomical Fidelity  the same technique, chosen at the cast: 6 ΦF, 30 AP, 2 LF, range 3, the mark is worth +5
//   The mark: on the chosen recipient, the first allied contact or line attack that hits it gains +2 (+5 under the vow) potency in its
//   own damage channel and consumes the mark; it ends at the caster's second following turn. One at a time per caster.
// Information stays in the battle log; the mark expires; nothing is copied. The verification itself is lineage-data.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./lineage-data.js"));
  else root.ConceptCombatHomologyRules = factory(root.ConceptCombatLineage);
})(typeof self !== "undefined" ? self : this, function (L) {
  // ability id -> its range and the mark's bonus (the vow variant is its own ability, like the Shared Bowl's)
  const KINDS = Object.freeze({
    comparativeAnatomy: Object.freeze({ kind: "compare", range: 5, bonus: 2 }), comparativeAnatomyFidelity: Object.freeze({ kind: "compare", range: 3, bonus: 5 }),
    conservedJoint: Object.freeze({ kind: "joint", range: 6, steps: 1 }), conservedJointSkeleton: Object.freeze({ kind: "joint", range: 4, steps: 2 }),
    ancestralReconstruction: Object.freeze({ kind: "reconstruct", range: 6, guards: 2, reduce: 4 }),
  });
  const WIRE = Object.freeze({ compare: "homologyCompare", joint: "homologyJoint", reconstruct: "homologyReconstruct" });
  const ALLY_RANGE = 4;
  const holds = (a, primary, secondary) => a.primary === primary && a.secondary === secondary;   // an equipped composition
  const pairKey = (x, y) => [x, y].sort().join("|");
  const LEDGER_TURNS = 2, TOKEN_TURNS = 2, TOKEN_OFF = 10, TOKEN_FLOOR = 10;
  const kindOf = (ref) => (ref && KINDS[ref.ability || ref.id]) || null;
  const foes = (s, a) => Object.values(s.actors).filter((u) => u.side !== a.side && !u.defeated);

  // The mark is good until the end of the caster's second following turn: the caster's turn counter has not passed `until`.
  const markLive = (s, mark) => !!mark && (s.actors[mark.by] ? s.actors[mark.by].ownerTurns <= mark.until : true);
  const markOf = (s, tgt) => (tgt && tgt.status && markLive(s, tgt.status.correspondence) ? tgt.status.correspondence : null);
  const caster = (s, id) => Object.values(s.actors).find((u) => u.status && u.status.correspondence && u.status.correspondence.by === id && markLive(s, u.status.correspondence)) || null;

  // The door a staged definition becomes castable through: { ability, vow } content definitions from kits-data's staged entry (comparativeAnatomy or
  // conservedJoint) and its vow data, and, when `wire` (ClassRuntime.wire) is given, the class-effect entries that route the two casts. Nothing calls this
  // in the game: the wire entries are static (and content.js then promotes the abilities) in the slice that gives the concept a holder; until then only tests do.
  const VOW_ID = Object.freeze({ comparativeAnatomy: "comparativeAnatomyFidelity", conservedJoint: "conservedJointSkeleton" });
  function playable(id, staged, wire = null) {
    const base = { name: staged.name, tier: staged.tier, concepts: staged.concepts.slice(), delivery: staged.delivery, target: "enemy", area: { shape: "single" }, mechanism: staged.mechanism,
      cost: staged.cost, tempoCost: staged.actionCost, lfPrice: staged.lfPrice || 0, range: staged.range, potency: 0, effect: "classEffect", reveal: staged.reveal, prompt: staged.teaches, ...(staged.announce ? { announce: staged.announce } : {}) };
    const v = staged.vow;
    const vow = v ? { ...base, name: v.name, mechanism: `${staged.mechanism} ${v.quote}`, cost: v.phi, tempoCost: v.ap, lfPrice: v.lf, range: v.range } : null;
    if (wire) for (const aid of [id, VOW_ID[id]].filter(Boolean)) wire[aid] = { effect: "classEffect", kind: WIRE[KINDS[aid].kind], target: "enemy", range: KINDS[aid].range };
    return { ability: base, vow };
  }

  // ── Comparative Anatomy ──
  // The cast, before anything is paid. act.compare = { a: { user, ability }, b: { user, ability }, feature?, recipient }.
  function validateCompare(s, a, act, m, H, k) {
    const c = act.compare; if (!c || !c.a || !c.b) return "Comparative Anatomy compares two enemy techniques: name both fighters and the technique of each.";
    if (c.a.user === c.b.user) return "Compare techniques of two different enemies.";
    if (caster(s, a.id)) return "One Correspondence at a time: your mark is still live.";
    for (const side of [c.a, c.b]) {
      const u = s.actors[side.user];
      if (!u || u.defeated || u.side === a.side) return "Both subjects must be living enemies.";
      if (H.dist(s, a.x, a.y, u.x, u.y) > k.range) return `${u.name} is out of range: ${k.range} to each enemy.`;
      if (!H.hasSight(s, a.x, a.y, u.x, u.y)) return `${u.name} is out of sight: both subjects must be visible.`;
    }
    if (c.recipient !== c.a.user && c.recipient !== c.b.user) return "Name which of the two enemies receives the mark if the comparison is CONSERVED.";
    for (const side of [c.a, c.b]) {
      const o = L.observedWithin(s, a.id, side.user, side.ability); if (!o.ok) return `${o.reason.charAt(0).toUpperCase()}${o.reason.slice(1)}.`;
    }
    const feat = c.feature || (L.recordsOf(c.a.ability).map((r) => r.feature_key).find((f) => L.recordsOf(c.b.ability).some((r) => r.feature_key === f)));
    const r = L.compareTechniques(c.a.ability, c.b.ability, feat);
    if (r.refused) return `Not comparable: ${r.refused}.`;
    m.homologyPlan = { a: { user: c.a.user, ability: c.a.ability }, b: { user: c.b.user, ability: c.b.ability }, feature: feat, recipient: c.recipient, bonus: k.bonus };
    // Inference + Homology: an Eliminated Hypothesis makes the next comparison of a DIFFERENT pair cheaper (applied here, before anything is paid; consumed on resolve)
    const tok = a.status && a.status.eliminatedHypothesis;
    if (tok && a.ownerTurns <= tok.until && holds(a, "inference", "homology") && tok.pair !== pairKey(c.a.ability, c.b.ability) && m.tempoCost > TOKEN_FLOOR) {
      const off = Math.min(TOKEN_OFF, m.tempoCost - TOKEN_FLOOR); m.tempoCost -= off; m.homologyToken = off; (m.notes ||= []).push(`Eliminated Hypothesis: −${off} AP on a comparison of a different pair.`);
    }
    return null;
  }
  function resolveCompare(s, a, inst, H) {
    const p = inst.homologyPlan; if (!p) return true;
    const ua = s.actors[p.a.user], ub = s.actors[p.b.user], recip = s.actors[p.recipient];
    const res = L.compareTechniques(p.a.ability, p.b.ability, p.feature).result;
    let text = `${a.name} compares ${ua.name}'s ${p.a.ability} with ${ub.name}'s ${p.b.ability}: ${res}.`;
    (a.status.comparedPairs ||= []).push(pairKey(`${p.a.user}:${p.a.ability}`, `${p.b.user}:${p.b.ability}`));   // the comparative trait does not verify the same pair twice
    if (inst.homologyToken) { delete a.status.eliminatedHypothesis; text += " The Eliminated Hypothesis is spent."; }
    if (holds(a, "inference", "homology") && res !== L.OUTCOMES.CONSERVED) {   // a falsified hypothesis: one token, the next different pair within two caster turns
      a.status.eliminatedHypothesis = { pair: pairKey(p.a.ability, p.b.ability), until: a.ownerTurns + TOKEN_TURNS }; text += " A falsified hypothesis narrows the search: the next comparison of a different pair is cheaper.";
    }
    if (holds(a, "indexing", "homology")) {   // the Lineage Ledger: this verified pair, recorded for two caster turns
      a.status.lineageLedger = { members: [{ user: p.a.user, ability: p.a.ability }, { user: p.b.user, ability: p.b.ability }], feature: p.feature, result: res, until: a.ownerTurns + LEDGER_TURNS }; text += " The pair is entered in the Lineage Ledger.";
    }
    if (res === L.OUTCOMES.CONSERVED) {
      // The active CONSERVED pair (what Conserved Joint needs): this verification, until the end of the caster's second following turn; a newer one replaces it.
      a.status.conservedPair = { members: [{ user: p.a.user, ability: p.a.ability }, { user: p.b.user, ability: p.b.ability }], feature: p.feature, until: a.ownerTurns + 2 };
      if (recip && !recip.defeated) {
        recip.status.correspondence = { by: a.id, side: a.side, bonus: p.bonus, feature: p.feature, until: a.ownerTurns + 2, from: [p.a.ability, p.b.ability] };
        text += ` ${recip.name} carries a Correspondence mark: the first allied contact or line hit on them gains +${p.bonus} potency.`;
      } else text += " The recipient is gone: no mark.";
    } else text += " The relationship is revealed; no mark, no bonus.";
    H.log(s, { kind: "homology", actor: a.id, result: res, feature: p.feature, subjects: [p.a.user, p.b.user], text, why: ["Verification is public and stays in the log; the mark expires."] });
    return true;
  }

  // ── Conserved Joint ──
  const pairOf = (s, a) => { const p = a.status && a.status.conservedPair; return p && a.ownerTurns <= p.until ? p : null; };
  const preparedBy = (s, id) => Object.values(s.actors).find((u) => !u.defeated && u.status && u.status.prepaidEscape && u.status.prepaidEscape.owner === id && (u.status.prepaidEscape.untilTurn == null || (s.actors[id] ? s.actors[id].ownerTurns : 0) <= u.status.prepaidEscape.untilTurn)) || null;
  // The Inference composition (primary Homology, secondary Inference) lets either member of the pair trigger the one prepared response.
  const eitherMember = (a) => a.primary === "homology" && a.secondary === "inference";
  // act.joint = { nominated: { user, ability }, ally }. The aimed tile is the nominated enemy.
  function validateJoint(s, a, act, m, H, k) {
    const j = act.joint; if (!j || !j.nominated) return "Conserved Joint prepares one ally against one technique: name the nominated enemy and technique, and the ally.";
    const pair = pairOf(s, a); if (!pair) return "Conserved Joint needs an active CONSERVED pair: verify one with Comparative Anatomy first.";
    const n = j.nominated; if (!pair.members.some((x) => x.user === n.user && x.ability === n.ability)) return "Nominate one member of the active pair: an enemy and the technique that was verified.";
    const foe = s.actors[n.user]; if (!foe || foe.defeated || foe.side === a.side) return "The nominated enemy is gone.";
    if (H.dist(s, a.x, a.y, foe.x, foe.y) > k.range) return `${foe.name} is out of range: ${k.range} to the nominated enemy.`;
    if (!H.hasSight(s, a.x, a.y, foe.x, foe.y)) return `${foe.name} is out of sight.`;
    const ally = s.actors[j.ally]; if (!ally || ally.defeated || ally.side !== a.side) return "Choose a living allied fighter to protect.";
    if (H.dist(s, a.x, a.y, ally.x, ally.y) > ALLY_RANGE) return `${ally.name} is out of range: ${ALLY_RANGE} to the protected ally.`;
    if (!H.hasSight(s, a.x, a.y, ally.x, ally.y)) return `${ally.name} is out of sight.`;
    if (preparedBy(s, a.id)) return "One prepared response at a time: your last one is still waiting.";
    m.homologyPlan = { nominated: { user: n.user, ability: n.ability }, ally: ally.id, steps: k.steps, either: eitherMember(a) ? pair.members.map((x) => ({ ...x })) : null };
    return null;
  }
  // The cells a prepaid sidestep may go to: every orthogonal neighbour (one step), then, under the Skeleton vow, every cell two contiguous steps away
  // ([x, y, viaX, viaY]; the primitive checks the via tile is open at fire time). It is automatic ("prepaid"): the primitive picks, at fire time, the first
  // that takes the ally out of the attack's reach, else the first open one.
  function routeCells(s, from, steps, H) {
    const N = [[0, -1], [1, 0], [0, 1], [-1, 0]], one = N.map(([dx, dy]) => [from.x + dx, from.y + dy]).filter(([x, y]) => H.inside(s, x, y)), out = one.map(([x, y]) => [x, y]);
    if (steps >= 2) for (const [vx, vy] of one) for (const [dx, dy] of N) { const x = vx + dx, y = vy + dy; if (H.inside(s, x, y) && !(x === from.x && y === from.y) && !out.some((d) => d[0] === x && d[1] === y)) out.push([x, y, vx, vy]); }
    return out;
  }
  function resolveJoint(s, a, inst, H) {
    const p = inst.homologyPlan; if (!p) return true;
    const ally = s.actors[p.ally], foe = s.actors[p.nominated.user]; if (!ally || ally.defeated) return true;
    const members = p.either || [p.nominated];
    ally.status.prepaidEscape = { dests: routeCells(s, ally, p.steps, H), label: "Conserved Joint", ability: members.map((x) => x.ability), from: members.map((x) => x.user), owner: a.id, untilTurn: a.ownerTurns + 2, leave: true };
    H.log(s, { kind: "homology", actor: a.id, text: `${a.name} prepares ${ally.name} against ${members.map((x) => `${s.actors[x.user].name}'s ${x.ability}`).join(" or ")}: one ${p.steps === 2 ? "sidestep of up to two steps" : "sidestep"} before the first matching attack lands.`, why: ["The prepared ally and the nominated technique are public; the reaction is spent by the first eligible attack, even if no destination is open."] });
    return true;
  }

  // ── Ancestral Reconstruction ──
  // act.reconstruct = { reference: { user, ability }, candidates: [{ user, ability }, ...up to two], feature? }. Announced now; resolved at the caster's next turn start.
  const guardsOf = (s, a) => (a.status && a.status.ancestralGuard || []).filter((g) => a.ownerTurns <= g.until);
  const reconstructionLive = (s, a) => !!(a.status && a.status.reconstruction) || guardsOf(s, a).length > 0;
  function validateReconstruct(s, a, act, m, H, k) {
    const r = act.reconstruct; if (!r || !r.reference || !Array.isArray(r.candidates) || !r.candidates.length) return "Ancestral Reconstruction needs one reference technique and one or two candidate techniques.";
    if (r.candidates.length > k.guards) return `At most ${k.guards} candidates: each can earn one guard.`;
    if (reconstructionLive(s, a)) return "One reconstruction at a time: your last one has not run out.";
    const all = [r.reference, ...r.candidates];
    if (new Set(all.map((x) => x.user)).size !== all.length) return "The reference and each candidate are held by different enemy fighters.";
    for (const side of all) {
      const u = s.actors[side.user];
      if (!u || u.defeated || u.side === a.side) return "Every subject must be a living enemy.";
      if (H.dist(s, a.x, a.y, u.x, u.y) > k.range) return `${u.name} is out of range: ${k.range} to each enemy.`;
      if (!H.hasSight(s, a.x, a.y, u.x, u.y)) return `${u.name} is out of sight: every subject must be visible.`;
      const o = L.observedWithin(s, a.id, side.user, side.ability); if (!o.ok) return `${o.reason.charAt(0).toUpperCase()}${o.reason.slice(1)}.`;
    }
    const feat = r.feature || L.recordsOf(r.reference.ability).map((x) => x.feature_key).find((f) => r.candidates.every((c) => L.recordsOf(c.ability).some((x) => x.feature_key === f)));
    for (const c of r.candidates) { const t = L.compareTechniques(r.reference.ability, c.ability, feat); if (t.refused) return `Not comparable: ${t.refused}.`; }
    m.homologyPlan = { feature: feat, reference: { user: r.reference.user, ability: r.reference.ability }, candidates: r.candidates.map((c) => ({ user: c.user, ability: c.ability })), reduce: k.reduce };
    return null;
  }
  // The cast: the announcement, public, and the pending record. Nothing is verified yet.
  function resolveReconstruct(s, a, inst, H) {
    const p = inst.homologyPlan; if (!p) return true;
    a.status.reconstruction = { ...p, activateTurn: a.ownerTurns + 1 };
    const nm = (x) => `${s.actors[x.user].name}'s ${x.ability}`;
    H.log(s, { kind: "homology", actor: a.id, announce: true, text: `${a.name}: “${inst.announce || "Different forms. The same inheritance."}” Reconstructing ${p.feature} from ${nm(p.reference)} against ${p.candidates.map(nm).join(" and ")}; it resolves at the start of ${a.name}'s next turn.`, why: ["Announced a turn ahead: the feature, the reference and the candidates are public. Incapacitate the caster before then and nothing happens."] });
    return true;
  }
  // The caster's next turn starts (class-runtime turnStart): resolve a pending reconstruction, and drop guards that have run out.
  function turnStart(s, a, H) {
    if (a.status && a.status.ancestralGuard) { a.status.ancestralGuard = a.status.ancestralGuard.filter((g) => a.ownerTurns <= g.until); if (!a.status.ancestralGuard.length) delete a.status.ancestralGuard; }
    const r = a.status && a.status.reconstruction; if (!r || a.ownerTurns < r.activateTurn) return;
    delete a.status.reconstruction;
    if (a.defeated) return;   // incapacitated before activation: nothing happens
    const guards = [], lines = [];
    for (const c of r.candidates) {
      const res = L.compareTechniques(r.reference.ability, c.ability, r.feature).result;
      lines.push(`${s.actors[c.user].name}'s ${c.ability} is ${res}`);
      if (res === L.OUTCOMES.CONSERVED && guards.length < 2) guards.push({ ability: c.ability, user: c.user, side: a.side, reduce: r.reduce, until: a.ownerTurns + 2 });
    }
    if (guards.length) (a.status.ancestralGuard ||= []).push(...guards);
    H.log(s, { kind: "homology", actor: a.id, results: lines, guards: guards.length, text: `${a.name}'s reconstruction of ${r.feature} resolves against ${s.actors[r.reference.user].name}'s ${r.reference.ability}: ${lines.join("; ")}.${guards.length ? ` ${guards.length === 1 ? "One Ancestral Guard stands" : "Two Ancestral Guards stand"}: the first later cast of ${guards.length === 1 ? "that technique" : "each technique"} takes ${r.reduce} off the damage to one ally.` : " No guard is created, and nothing is refunded."}`, why: ["The results are public and stay in the log; guards expire at the end of the caster's second turn after this one."] });
  }
  // Every damage instance (damage.js, beside the prepaid hook): the first cast of a guarded technique by the guarded enemy takes `reduce` off the damage to ONE allied fighter
  // (here: the first it reaches; the spec lets the Homology player choose), minimum 0, and the guard is spent.
  function guard(s, src, tgt, inst) {
    if (!src || !tgt || !inst || tgt.defeated) return 0;
    for (const c of Object.values(s.actors)) {
      const list = c.status && c.status.ancestralGuard; if (!list || c.side !== tgt.side || src.side === c.side) continue;
      const i = list.findIndex((g) => g.ability === inst.ability && g.user === src.id && c.ownerTurns <= g.until);
      if (i < 0) continue;
      const g = list.splice(i, 1)[0]; if (!list.length) delete c.status.ancestralGuard;
      return g.reduce;
    }
    return 0;
  }

  // ── The compositions and Reversal (H6) ──
  // Every ability cast (engine/actions.js, once the cast is committed): the first reuse of either technique in a live Lineage Ledger announces the feature and the
  // verified relationship. It reveals no location (an unseen fighter is not named, and the entry carries no tiles) and grants nothing.
  function cast(s, src, act, H) {
    if (!src || !act || !act.ability) return;
    for (const c of Object.values(s.actors)) {
      const led = c.status && c.status.lineageLedger; if (!led || c.defeated || c.side === src.side) continue;
      if (c.ownerTurns > led.until) { delete c.status.lineageLedger; continue; }
      const i = led.members.findIndex((m) => m.ability === act.ability); if (i < 0) continue;
      delete c.status.lineageLedger;   // the first reuse only
      const seen = H.hasSight(s, c.x, c.y, src.x, src.y), other = led.members[1 - i];
      H.log(s, { kind: "homology", actor: c.id, ledger: true, feature: led.feature, result: led.result, text: `Lineage Ledger: ${seen ? src.name : "an unseen fighter"} uses ${act.ability}, recorded with ${other.ability}: ${led.feature}, ${led.result}.`, why: ["A recorded pair keeps its identity when the technique looks different; it names no location and adds no damage."] });
    }
  }
  // An Index move (engine/resolve.js, after the Archivist indexes an enemy): the team's stamped observations of that enemy are now held in an Indexing record,
  // so they stay comparable for three rounds instead of two (H2's window). Returns how many were flagged.
  function indexed(s, a, target) {
    if (!s.observedAt || !target) return 0; let n = 0;
    for (const [observer, byUser] of Object.entries(s.observedAt)) {
      if (!s.actors[observer] || s.actors[observer].side !== a.side || !byUser[target.id]) continue;
      for (const ability of Object.keys(byUser[target.id])) if (L.markIndexed(s, observer, target.id, ability)) n++;
    }
    return n;
  }
  // Reversal's clearing of the tactical effects built on a verified fact (the graph op clearTacticalEffect): the Correspondence mark and the Prepared Response go; the
  // recorded ancestry (the lineage records, the pair, the log) does not, "a verified fact and the temporary intervention built from it are different things". A stub until
  // Reversal runs; returns what it cleared.
  function reverse(s, tgt, effects, H) {
    const cleared = [], want = new Set(effects || []);
    if (want.has("correspondence") && tgt.status && tgt.status.correspondence) { tgt.status.correspondence = null; cleared.push("correspondence"); }
    if (want.has("preparedResponse") && tgt.status && tgt.status.prepaidEscape && tgt.status.prepaidEscape.owner) { tgt.status.prepaidEscape = null; cleared.push("preparedResponse"); }
    if (cleared.length && H) H.log(s, { kind: "homology", actor: tgt.id, text: `Reversal clears ${tgt.name}'s ${cleared.join(" and ")}: the recorded ancestry stands.`, why: ["The temporary advantage is undone; the verified fact is not."] });
    return cleared;
  }

  // ── The `comparative` trait (H7): what a fighter with it does with Homology ──
  // Traits drive behaviour (Mala, 2026-10-27): a fighter with `comparative` observes, compares and prepares. It uses Comparative Anatomy when two enemies' techniques it
  // has witnessed within the window are comparable and not yet compared; the mark goes on the enemy nearest its allies; and with a verified pair it spends Conserved Joint on
  // the ally nearest the nominated enemy. It never plans across rounds and never casts the ultimate (HOMOLOGY-BUILDABLE.md B list 3). A fighter without the trait, or with no
  // witnessed comparable pair, gets null and the engine's own AI plays on. The caller checks the returned act with a preview apply.
  const TRAIT = Object.freeze({ id: "comparative", text: "Observes enemy techniques, compares them for common descent, and prepares an ally against the technique it can predict." });
  const hasTrait = (a) => (a.traits || []).some((t) => (t.id || t) === TRAIT.id);
  const nearest = (s, H, from, list) => list.slice().sort((x, y) => H.dist(s, from.x, from.y, x.x, x.y) - H.dist(s, from.x, from.y, y.x, y.y) || (x.id < y.id ? -1 : 1))[0] || null;
  function aiAct(s, a, H) {
    if (!hasTrait(a) || a.defeated) return null;
    const live = Object.values(s.actors).filter((u) => !u.defeated), foes = live.filter((u) => u.side !== a.side), friends = live.filter((u) => u.side === a.side);
    const pair = pairOf(s, a);
    if (pair) {   // a verified pair stands: prepare the ally nearest the nominated enemy (one prepared response at a time)
      if (preparedBy(s, a.id)) return null;
      const member = nearest(s, H, a, pair.members.map((m) => ({ ...m, ...s.actors[m.user] })).filter((m) => s.actors[m.user] && !s.actors[m.user].defeated));
      if (!member) return null;
      const ally = nearest(s, H, member, friends); if (!ally) return null;
      return { type: "ability", actor: a.id, ability: "conservedJoint", target: [member.x, member.y], joint: { nominated: { user: member.user, ability: member.ability }, ally: ally.id } };
    }
    if (caster(s, a.id)) return null;
    const seen = []; for (const f of foes) for (const [ability, st] of Object.entries(((s.observedAt || {})[a.id] || {})[f.id] || {})) if (L.observedWithin(s, a.id, f.id, ability).ok) seen.push({ user: f.id, ability });
    const done = (a.status && a.status.comparedPairs) || [], reach = KINDS.comparativeAnatomy.range;
    const inReach = (u) => H.dist(s, a.x, a.y, u.x, u.y) <= reach && H.hasSight(s, a.x, a.y, u.x, u.y);
    for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) {
      const x = seen[i], y = seen[j]; if (x.user === y.user || done.includes(pairKey(`${x.user}:${x.ability}`, `${y.user}:${y.ability}`)) || !inReach(s.actors[x.user]) || !inReach(s.actors[y.user])) continue;
      const feat = L.recordsOf(x.ability).map((r) => r.feature_key).find((f) => L.recordsOf(y.ability).some((r) => r.feature_key === f)); if (!feat) continue;
      const gap = (u) => Math.min(...friends.map((f) => H.dist(s, f.x, f.y, u.x, u.y))), recipient = [s.actors[x.user], s.actors[y.user]].sort((p, q) => gap(p) - gap(q) || (p.id < q.id ? -1 : 1))[0];   // the enemy nearest its allies
      return { type: "ability", actor: a.id, ability: "comparativeAnatomy", target: [s.actors[x.user].x, s.actors[x.user].y], compare: { a: x, b: y, feature: feat, recipient: recipient.id } };
    }
    return null;
  }

  // The hooks class-runtime.js calls (and, for the cast check, engine/actions.js).
  function validate(s, a, act, m, H) {
    const k = kindOf(m); if (!k) return null;
    return k.kind === "compare" ? validateCompare(s, a, act, m, H, k) : k.kind === "joint" ? validateJoint(s, a, act, m, H, k) : validateReconstruct(s, a, act, m, H, k);
  }
  // The aimed tile must hold a living enemy within the technique's range (a comparison's first subject; the joint's nominated enemy).
  function target(s, a, w, tx, ty, H) {
    if (!Object.values(WIRE).includes(w.kind)) return null;
    const u = H.actorAt(s, tx, ty);
    if (!u || u.defeated || u.side === a.side) return { ok: false, error: w.kind === WIRE.joint ? "Aim Conserved Joint at the nominated enemy." : w.kind === WIRE.reconstruct ? "Aim Ancestral Reconstruction at the reference enemy." : "Aim Comparative Anatomy at one of the two enemies." };
    if (H.dist(s, a.x, a.y, tx, ty) > w.range) return { ok: false, error: `Out of range: ${w.range} to ${w.kind === WIRE.joint ? "the nominated enemy" : "each enemy"}.` };
    return { ok: true, tiles: [[tx, ty]], targets: [u.id] };
  }
  function resolve(s, a, inst, H) {
    const k = kindOf(inst); if (!k) return false;
    return k.kind === "compare" ? resolveCompare(s, a, inst, H) : k.kind === "joint" ? resolveJoint(s, a, inst, H) : resolveReconstruct(s, a, inst, H);
  }

  // Every strike, before damage (class-runtime beforeStrike): the first allied contact or line hit on the marked fighter takes the bonus once.
  function strikeBonus(s, src, tgt, inst) {
    const mark = markOf(s, tgt); if (!mark || !src || src.side !== mark.side) return 0;
    const qualifies = inst && (inst.ability === "strike" || inst.delivery === "contact" || inst.delivery === "line"); if (!qualifies) return 0;
    tgt.status.correspondence = null;   // consumed by the hit
    return mark.bonus;
  }

  return Object.freeze({ KINDS, playable, validate, target, resolve, strikeBonus, markOf, pairOf, turnStart, guard, guardsOf, cast, indexed, reverse, aiAct, TRAIT });
});
