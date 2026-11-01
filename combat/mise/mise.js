"use strict";
// Mise en Place (structure; Mala, 2026-10-28: "build this concept"; docs/mise-en-place.md). Preparation moves work from a
// time-critical moment to an earlier one: pay AP now, at a tile, so a NAMED technique costs less when a NAMED fighter later
// casts it from that tile. It creates no materials, ΦF, actions or turns.
//
// State is JSON only: s.mise = { stations: [...], n }. A station is { id, caster, side, beneficiary, technique, x, y,
// discount, adjacent, lock: [foe ids that must still start a turn], since, renewals, readyRound, seq }.
//   Rack and Label          basic    1 ΦF   5 AP  one station, 15 AP off at full strength
//   Parallel Prep           refined  4 ΦF  10 AP  two stations for two beneficiaries, 15 AP off each
//   Everything in Its Place ultimate 16 ΦF 10 AP  up to three stations, 20 AP off each, announced, locked until every opposing fighter present when it was placed has started a turn
// Preparation SAVES AP (Mala, 2026-10-29: "prep should save you a lot not lose you anything ... the benefits of preparation
// should start strong and fade with time unless renewed"). A plan whose first redemption would not out-save its own cost is
// refused before payment, so every legal preparation of a TECHNIQUE nets AP at full freshness. (A Chef's Strike station is planned against
// the standard 25 AP Strike: it nets AP at that effort, saves less at a smaller one, and nothing at the 10 AP floor; free with Culinary Training.) The benefit is FRESH for the placement round and the round after
// (the beneficiary's first turn), then fades by thirds a round (100%, 100%, 67%, 33%, gone). The clock is `since`, the round of
// placement (an ultimate's: the round its lock opened) or of the last renewal. The caster renews a station for 5 AP, standing on
// or beside it, once a round, only while it is fading; renewal resets the clock and is not a new station.
// Rules: the discount never takes a technique's AP below 10; one redemption per fighter per turn; one use per station; at most
// 3 live stations per caster; a station cannot be redeemed by anyone in the round it was placed (ready from the next round); stations are visible, are not
// objects and cannot sit on impassable ground; an enemy ending movement on one destroys it; no other preparation discount
// stacks with one. A Pruning technique aimed at a station tile removes it (opposition: pruning disrupts mise_en_place).
//
// The Chef (slice 1; docs/chef.md) holds Mise en Place as his primary: early_service (a station he lays in rounds 1-2 holds full
// strength one round longer: `grace`, fixed at laying, cleared by a renewal, never on an ultimate's), stocked_line (+2 Strike
// potency per station of his at full strength, max +6) and Culinary Training (the first Rack and Label each of his turns costs 0 AP
// and 0 ΦF; it still counts toward the cap of 3, and is refused on a tile where a station was redeemed this turn or the round before).
//
// Wired by classes/class-runtime.js (kind "miseStation"; hooks beforeAbility, target, resolve, aiValue, turnStart, moved,
// prepared), engine/actions.js (plan validation before payment, redemption after it, the jump and climb move ends, prune,
// the miseRenew action) and engine/ai.js (aiRenew).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatMise = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const IDS = new Set(["rackAndLabel", "parallelPrep", "everythingInItsPlace"]);
  // fade: thirds of the discount left at age 0, 1, 2, 3 rounds since `since`; after that the station is gone.
  const RULES = {
    discount: 15, ultDiscount: 20, floor: 10, maxStations: 3, sequenceDiscount: 20, sequenceReach: 2,
    fade: [3, 3, 2, 1], renewCost: 5, aiReach: 8, aiRenewCap: 2, aiFadeCap: 2,
    counts: { rackAndLabel: [1, 1], parallelPrep: [2, 2], everythingInItsPlace: [1, 3] },
  };
  const key = (x, y) => `${x},${y}`;
  const state = (s) => (s.mise ||= { stations: [], n: 0 });
  const stations = (s) => (s.mise?.stations || []);
  const mine = (s, casterId) => stations(s).filter((t) => t.caster === casterId);
  const unitAt = (s, x, y) => Object.values(s.actors).find((u) => !u.defeated && !u.escaped && !u.notArrived && u.x === x && u.y === y) || null;
  const say = (s, H, a, text, why) => H.log(s, { kind: "mise", actor: a.id, text, ...(why ? { why } : {}) });
  const costOf = (s, d) => d.tempoCost ?? s.rules.actionCosts.ability[d.tier] ?? s.rules.actionCosts.ability.basic;
  // Strike as a nameable technique (the Chef's, 2026-10-30; Mala: "Stations can name his Strike"). Strike is an action, not an ability,
  // so a station names the id "strike" and this stands in for its ability definition: no ΦF, the standard 25 AP, the Strike's potency.
  // A station is PLANNED at the standard Strike (so the saving is min(discount, 25 - floor) = 15), and redeemed against the effort
  // actually chosen: see strikePrep.
  const strikeDef = (s) => ({ name: "Strike", tier: "basic", effect: "damage", cost: 0, tempoCost: s.rules.actionCosts.strike, potency: s.rules.strike.potency, range: 1 });
  const defOf = (s, H, id) => (id === "strike" ? strikeDef(s) : H.C.abilities[id]);
  const knows = (H, ben, id) => id === "strike" || H.abilitiesOf(ben).includes(id);
  const holdsSequence = (a) => a.primary === "mise_en_place" && a.secondary === "pipeline";
  const near = (a, t) => Math.max(Math.abs(a.x - t.x), Math.abs(a.y - t.y)) <= 1;
  // ── the Chef ──
  // The Chef is a PAIR as well as a character: the live player is a Warden holding the pair they chose (ui.js playerLoadout), so a unit holding Mise en Place + Hospitality is a Chef for his
  // passives and the Strike station (the Paladin's second return found the same player-path gap). A unit embodying the Chef kit (the Emissary, the Warden's Multitudes) counts too.
  const isChef = (a) => !!a && (a.character === "chef" || a.embodied?.classId === "chef" || (a.embodied && !a.defeated ? a.embodied.primary === "mise_en_place" && a.embodied.secondary === "hospitality" : a.primary === "mise_en_place" && a.secondary === "hospitality"));
  const hasTraining = (a) => (a?.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === "culinaryTraining");
  RULES.chef = { graceRounds: 1, graceUntilRound: 2, strikeAddPerStation: 2, strikeAddMax: 6, strikeAnchor: 12 };   // strikeAnchor: how much an AI Chef values staying on a fresh Strike plate (scaled by its freshness, so he walks on when it fades: a plate cannot hold him for ever)

  // ── freshness: the one clock the discount, the panel and the marker all read ──
  const ageOf = (s, t) => Math.max(0, s.round - t.since - (t.grace || 0));   // early_service: a graced station's clock starts one round late
  const thirdsOf = (s, t) => RULES.fade[Math.max(0, ageOf(s, t))] ?? 0;                       // 3 = full, 0 = gone
  const nowOf = (s, t) => Math.round(t.discount * thirdsOf(s, t) / 3);                         // AP off right now, before the floor
  const freshOf = (s, t) => Math.round(100 * thirdsOf(s, t) / 3);                              // percent shown
  const goneIn = (s, t) => Math.max(0, RULES.fade.length - ageOf(s, t));                        // rounds until the station is gone

  // A tile a station may stand on: in the arena, passable, no barrier, no enemy on it, no station already there, in range, seen.
  function legalTile(s, a, x, y, range, H) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !H.inside(s, x, y)) return "Choose a tile on the board.";
    if (H.tileAt(s, x, y).blocksMove) return "A station cannot sit on impassable terrain.";
    const bar = H.barrierAt(s, x, y); if (bar && !bar.passable) return "A station cannot sit inside a barrier.";
    if (H.dist(s, a.x, a.y, x, y) > range) return `Out of range (${range}).`;
    if (!H.hasSight(s, a.x, a.y, x, y)) return "No clear view to that tile.";
    const occ = unitAt(s, x, y); if (occ && occ.side !== a.side) return "An enemy holds that tile: it would destroy the station at once.";
    if (stations(s).some((t) => t.x === x && t.y === y)) return "A station already stands there.";
    return null;
  }
  // A technique a station may name: basic or refined, known to the beneficiary now, not sealed, not a Mise en Place technique.
  function legalTechnique(s, ben, id, H, caster = null) {
    if (id === "strike") return isChef(caster) && ben?.id === caster.id ? null : "A Chef can prepare only his own Strike.";   // Mala: "Stations can name HIS Strike": the Chef's, no one else's (not an ally's, not a clone's or summon's)
    const d = H.C.abilities[id]; if (!d) return "Name a technique.";
    if (IDS.has(id)) return "A station cannot be prepared for a Mise en Place technique.";
    if (d.tier !== "basic" && d.tier !== "refined") return `${d.name} is an ultimate: stations name only basic or refined techniques.`;
    if (!knows(H, ben, id)) return `${ben.name} does not know ${d.name}.`;
    if ((ben.sealedTechs || []).includes(id)) return `${d.name} is sealed.`;
    return null;
  }
  const discountOf = (id) => (id === "everythingInItsPlace" ? RULES.ultDiscount : RULES.discount);
  // What one station saves at full strength on a technique: the discount, held up by the floor.
  const savingOf = (s, id, tech, H) => Math.max(0, Math.min(discountOf(id), costOf(s, defOf(s, H, tech)) - RULES.floor));
  // The AI and tests that give no plan: the caster's own tile, the caster, and the technique that hits hardest per AP once prepared.
  function defaultTechnique(s, ben, id, H, caster = null) {
    let best = null;
    for (const t of [...H.abilitiesOf(ben), ...(isChef(caster) && ben?.id === caster.id ? ["strike"] : [])]) {
      const d = defOf(s, H, t); if (!d || legalTechnique(s, ben, t, H, caster) || d.effect !== "damage" || savingOf(s, id, t, H) <= 0) continue;
      const per = (d.potency || 0) / Math.max(RULES.floor, costOf(s, d) - discountOf(id));
      if (!best || per > best.per || (per === best.per && t < best.t)) best = { t, per };
    }
    return best ? best.t : null;
  }
  function defaultPlan(s, a, id, tile, H) {
    const ben = a, tech = defaultTechnique(s, ben, id, H, a); if (!tech) return { error: "No basic or refined damaging technique to prepare." };
    const out = [{ at: tile, beneficiary: ben.id, technique: tech }];
    if (id === "parallelPrep") {
      const ally = Object.values(s.actors).filter((u) => !u.defeated && u.id !== a.id && u.side === a.side && !u.escaped && !u.notArrived).sort((p, q) => H.dist(s, a.x, a.y, p.x, p.y) - H.dist(s, a.x, a.y, q.x, q.y) || (p.id < q.id ? -1 : 1))[0];
      if (!ally) return { error: "Parallel Prep needs a second allied beneficiary." };
      const t2 = defaultTechnique(s, ally, id, H, a); if (!t2) return { error: `${ally.name} knows no technique to prepare.` };
      out.push({ at: [ally.x, ally.y], beneficiary: ally.id, technique: t2 });
    }
    return { plan: out };
  }
  // The plan an action declares (act.stations = [{ at: [x, y], beneficiary, technique }]) checked against every rule.
  function planOf(s, a, id, range, tile, declared, H) {
    const got = declared ? { plan: declared } : defaultPlan(s, a, id, tile, H); if (got.error) return got;
    const plan = got.plan, [lo, hi] = RULES.counts[id];
    if (!Array.isArray(plan) || plan.length < lo || plan.length > hi) return { error: lo === hi ? `${H.C.abilities[id].name} places exactly ${lo} station${lo > 1 ? "s" : ""}.` : `${H.C.abilities[id].name} places ${lo} to ${hi} stations.` };
    if (mine(s, a.id).length + plan.length > RULES.maxStations) return { error: `A caster may keep at most ${RULES.maxStations} stations (${mine(s, a.id).length} stand).` };
    const seenTiles = new Set(), seenBen = new Set(); let saves = 0;
    for (const p of plan) {
      if (!Array.isArray(p?.at)) return { error: "Each station needs a tile." };
      const k = key(p.at[0], p.at[1]); if (seenTiles.has(k)) return { error: "Stations stand on distinct tiles." }; seenTiles.add(k);
      const e = legalTile(s, a, p.at[0], p.at[1], range, H); if (e) return { error: e };
      const ben = s.actors[p.beneficiary];
      if (!ben || ben.defeated || ben.side !== a.side || ben.escaped || ben.notArrived) return { error: "A station's beneficiary is a living ally (the caster may be one)." };
      if (id !== "rackAndLabel" && seenBen.has(ben.id)) return { error: "Each station needs its own beneficiary." }; seenBen.add(ben.id);
      const te = legalTechnique(s, ben, p.technique, H, a); if (te) return { error: te };
      const one = savingOf(s, id, p.technique, H);
      if (one <= 0) return { error: `${defOf(s, H, p.technique).name} costs ${costOf(s, defOf(s, H, p.technique))} AP, already at the ${RULES.floor} AP floor: a station for it would save nothing.` };
      saves += one;
    }
    const prep = costOf(s, H.C.abilities[id]);   // preparation must pay for itself: a plan that would net nothing is refused before any AP is spent
    if (saves <= prep) return { error: `That plan costs ${prep} AP and would save only ${saves} AP at full strength: a technique that cheap is not worth preparing.` };
    return { plan };
  }
  const rangeOf = (m, H) => m.range ?? H.C.abilities[m.ability]?.range ?? 2;
  // Culinary Training: one free Rack and Label a turn (0 AP, 0 ΦF), not on a tile where a station was redeemed this turn or the round before.
  const freeLay = (s, a, at) => hasTraining(a) && a.status?.miseFree !== a.ownerTurns && !(at && (s.mise?.recent || {})[key(at[0], at[1])] >= s.round - 1);
  function free(s, a, m, abilityId, target) {
    if (abilityId !== "rackAndLabel" || !freeLay(s, a, target || [a.x, a.y])) return;
    m.tempoCost = 0; m.cost = 0; m.miseFreeLay = true;
    m.notes.push("Culinary Training: the first Rack and Label each turn costs no AP and no ΦF.");
  }
  // stocked_line: +2 Strike potency for each station of the Chef's at full strength (ready or not; an ultimate's locked stations count 0), max +6.
  function strikeBonus(s, a, consume = false) {
    if (!s.mise || !isChef(a)) return 0;
    const spent = a.status?.miseLine === a.ownerTurns ? 1 : 0;   // the fresh station this very Strike redeemed
    if (consume && spent) delete a.status.miseLine;
    const n = Math.min(3, mine(s, a.id).filter((t) => !t.lock.length && thirdsOf(s, t) >= 3 && valid(s, t)).length + spent);
    return Math.min(RULES.chef.strikeAddMax, n * RULES.chef.strikeAddPerStation);
  }

  function beforeAbility(s, a, m) {
    const id = m.id || m.ability; if (!IDS.has(id)) return null;
    const need = RULES.counts[id][0];
    if (mine(s, a.id).length + need > RULES.maxStations) return `A caster may keep at most ${RULES.maxStations} stations (${mine(s, a.id).length} stand): let one be used or fade first.`;
    return null;
  }
  function target(s, a, m, tx, ty, H) {
    const id = m.id || m.ability; if (!IDS.has(id)) return null;
    const e = legalTile(s, a, tx, ty, rangeOf(m, H), H); if (e) return { ok: false, error: e };
    return { ok: true, tiles: [[tx, ty]], targets: [] };
  }
  // Before payment (engine/actions.js): the whole plan, so a bad one costs nothing.
  function validate(s, a, act, m, H) {
    const id = act.ability; if (!IDS.has(id)) return null;
    if (id === "everythingInItsPlace" && !act.announce) return "Everything in Its Place is always announced: the whole plan is shown to the opposing team.";
    const r = planOf(s, a, id, rangeOf(m, H), act.target || [a.x, a.y], act.stations || null, H);
    return r.error || null;
  }

  function resolve(s, a, inst, H) {
    const id = inst.ability; if (!IDS.has(id)) return false;
    const r = planOf(s, a, id, rangeOf(inst, H), inst.tiles?.[0] || [a.x, a.y], inst.misePlan || null, H);
    if (r.error) { say(s, H, a, `${a.name}'s preparation fails: ${r.error}`); return true; }
    const ult = id === "everythingInItsPlace", placed = [];
    if (id === "rackAndLabel" && freeLay(s, a, r.plan[0].at)) { a.status ||= {}; a.status.miseFree = a.ownerTurns; }   // Culinary Training: this lay was the free one (the manifest priced it at 0)
    const foes = ult ? Object.values(s.actors).filter((u) => !u.defeated && u.side !== a.side && !u.escaped && !u.notArrived && u.side !== "bystander").map((u) => u.id) : [];   // the opponents present when it is placed
    for (const p of r.plan) {
      const t = { id: `st${++state(s).n}`, caster: a.id, side: a.side, beneficiary: p.beneficiary, technique: p.technique, x: p.at[0], y: p.at[1], discount: discountOf(id),
        adjacent: ult, lock: foes.slice(), since: s.round, renewals: 0, readyRound: s.round + 1, seq: null, grace: !ult && isChef(a) && s.round <= RULES.chef.graceUntilRound ? RULES.chef.graceRounds : 0 };
      state(s).stations.push(t); placed.push(t);
    }
    if (id === "parallelPrep" && holdsSequence(a) && placed.length === 2 && H.dist(s, placed[0].x, placed[0].y, placed[1].x, placed[1].y) <= RULES.sequenceReach) {
      const order = Array.isArray(inst.miseOrder) && inst.miseOrder[0] === 1 ? [placed[1], placed[0]] : [placed[0], placed[1]];
      order[0].seq = { role: "first", partner: order[1].id, boostRound: null }; order[1].seq = { role: "second", partner: order[0].id, boostRound: null };
    }
    const named = (t) => `${s.actors[t.beneficiary].name} → ${defOf(s, H, t.technique).name} at (${t.x},${t.y}), saves ${savingOf(s, id, t.technique, H)} AP fresh`;
    say(s, H, a, `${a.name} lays out ${placed.length} station${placed.length > 1 ? "s" : ""}: ${placed.map(named).join("; ")}.`,
      [`Each takes up to ${placed[0].discount} AP off its named technique while fresh (the saving named above is what its price allows) (100% for this round and the next, then 67%, 33%, gone; never below ${RULES.floor} AP; the ΦF is paid in full). The caster can renew it for ${RULES.renewCost} AP.`,
        ult ? "They cannot be redeemed until every opponent present now has started a turn." : "Visible to both teams; an enemy ending movement on one destroys it. Ready from the next round, for everyone.",
        placed[0].seq ? `Sequential Workstations: redeem the first and the second pays ${RULES.sequenceDiscount} AP off, in the same round.` : null].filter(Boolean));
    return true;
  }

  // ── the discount (engine.js manifest → ClassRuntime.prepared) ──
  const lockedBy = (s, t) => t.lock.some((id) => { const u = s.actors[id]; return u && !u.defeated && !u.escaped; });   // the defeated wait for nothing
  const valid = (s, t) => { const ben = s.actors[t.beneficiary]; return !!ben && !ben.defeated && !lockedBy(s, t) && thirdsOf(s, t) > 0; };
  function stationFor(s, a, abilityId) {
    if (a.status?.miseRedeemed === a.ownerTurns) return null;   // one preparation redeemed per fighter per turn
    let best = null;
    for (const t of stations(s)) {
      if (t.beneficiary !== a.id || t.technique !== abilityId || !valid(s, t)) continue;
      if (s.round < t.readyRound) continue;   // ready from the round AFTER it was placed, for every redeemer (an ally later in the placing round waits too)
      const here = t.adjacent ? near(a, t) : a.x === t.x && a.y === t.y;
      if (!here) continue;
      const boosted = t.seq?.role === "second" && t.seq.boostRound === s.round;
      const d = Math.max(nowOf(s, t), boosted ? RULES.sequenceDiscount : 0);
      if (!best || d > best.d) best = { t, d, boosted };
    }
    return best;
  }
  function discount(s, a, m, abilityId) {
    const f = stationFor(s, a, abilityId); if (!f) return 0;
    const base = m.tempoCost, cost = Math.max(RULES.floor, base - f.d);
    if (cost >= base) return 0;   // already at or under the floor: nothing to save, so nothing is spent
    m.tempoCost = cost; m.miseStation = f.t.id;
    m.notes.push(`Mise en Place: the station at (${f.t.x},${f.t.y}) is ${freshOf(s, f.t)}% fresh and takes ${base - cost} AP off${f.boosted ? " (Sequential Workstations)" : ""}${cost === RULES.floor ? `, to the ${RULES.floor} AP floor` : ""}.`);
    return base - cost;
  }
  // A prepared STRIKE (engine/actions.js strike): `base` is the AP the Strike would cost (its effort, less any free amount). The best
  // station of the striker's for "strike" that it stands on takes its discount off, never taking the price below the floor (10 AP):
  // pay = max(floor, base - discount). A Strike already at or under the floor saves nothing, so nothing is spent (the same rule as a
  // technique at the floor). Potency stays on the effort chosen: the station buys AP, not damage. Returns { id, save, now } or null.
  function strikePrep(s, a, base) {
    const f = stationFor(s, a, "strike"); if (!f || !isChef(a) || f.t.caster !== a.id || f.t.beneficiary !== a.id) return null;   // only the Chef's own Strike, laid by him: a clone or summon of his cannot redeem it
    const save = Math.max(0, base - Math.max(RULES.floor, base - f.d));
    return save > 0 ? { id: f.t.id, save, now: freshOf(s, f.t), fresh: thirdsOf(s, f.t) >= 3 } : null;
  }
  // After payment (engine/actions.js): the station is used up.
  function redeem(s, a, m, H) {
    const i = stations(s).findIndex((t) => t.id === m.miseStation); if (i < 0) return;
    const [t] = s.mise.stations.splice(i, 1);
    a.status ||= {}; a.status.miseRedeemed = a.ownerTurns;
    if (t.technique === "strike" && t.caster === a.id && thirdsOf(s, t) >= 3) a.status.miseLine = a.ownerTurns;   // stocked_line still counts the fresh station this Strike spends
    (s.mise.recent ||= {})[key(t.x, t.y)] = s.round;   // Culinary Training's same-tile guard
    if (t.seq?.role === "first") { const o = stations(s).find((x) => x.id === t.seq.partner); if (o?.seq) o.seq.boostRound = s.round; }
    H.log(s, { kind: "mise", actor: a.id, text: `${a.name} casts ${defOf(s, H, t.technique).name} from the prepared station at (${t.x},${t.y}): the work was done in advance${m.miseSaved ? ` (${m.miseSaved} AP saved)` : ""}.`, why: ["The station is spent."] });
  }

  // ── renewal: the caster keeps a fading station fresh (the miseRenew action, engine/actions.js) ──
  // Refused while the station is fresh (so once per station per round by construction: a renewal makes it fresh), locked,
  // out of reach, or not the caster's. `spend` pays the AP last, so a refusal costs nothing.
  function renew(s, a, act, H, spend) {
    const t = stations(s).find((x) => x.id === act.station);
    if (!t) return "There is no such station.";
    if (t.caster !== a.id) return "Only the fighter who laid a station can renew it.";
    if (!valid(s, t)) return lockedBy(s, t) ? "That station is still locked: nothing to renew yet." : "That station has faded away or lost its beneficiary.";
    if (thirdsOf(s, t) >= 3) return "That station is already at full strength: renewing it again would waste the AP.";
    if (!near(a, t)) return "Stand on or beside the station to renew it.";
    const e = spend(RULES.renewCost, "Renew a station"); if (e) return e;
    const was = freshOf(s, t); t.since = s.round; t.grace = 0; t.renewals++;
    say(s, H, a, `${a.name} renews the station at (${t.x},${t.y}) for ${defOf(s, H, t.technique).name}: ${was}% fresh, back to 100%.`, [`Renewal costs ${RULES.renewCost} AP; the clock restarts, so it holds full strength for this round and the next.`]);
    return null;
  }

  // ── lifetimes ──
  function turnStart(s, a, H) {
    if (isChef(a) && a.character !== "chef") for (const id of ["thrifty", "dutiful", "culinaryTraining"]) if (!(a.traits || []).some((x) => (typeof x === "string" ? x : x?.id) === id)) (a.traits ||= []).push(id);   // the Chef's traits for a player holding the pair
    if (!s.mise) return;
    const out = [], keep = [];
    for (const t of s.mise.stations) {
      const ben = s.actors[t.beneficiary], caster = s.actors[t.caster];
      let gone = null;
      const was = t.lock.length;
      t.lock = t.lock.filter((id) => { const u = s.actors[id]; return u && !u.defeated && !u.escaped && (a.side === t.side || id !== a.id); });   // an opponent has started the turn the ultimate's stations waited for; the fallen wait for nothing
      if (was && !t.lock.length) t.since = s.round;   // the clock of an ultimate's station starts when its lock opens
      if (!ben || ben.defeated) gone = "its beneficiary is down";
      else if (!caster || caster.defeated) gone = "its caster is down";
      else if (legalTechniqueLost(s, ben, t, H)) gone = `${defOf(s, H, t.technique).name} is no longer a technique ${ben.name} can cast`;
      else if (!lockedBy(s, t) && thirdsOf(s, t) === 0) { gone = "it faded away unrenewed"; wasted(s, t); }
      (gone ? out : keep).push(gone ? [t, gone] : t);
    }
    s.mise.stations = keep;
    for (const [t, why] of out) H.log(s, { kind: "mise", actor: t.caster, text: `The station at (${t.x},${t.y}) for ${defOf(s, H, t.technique).name} expires unused: ${why}.`, why: ["Preparation must stay aligned with the task that actually needs doing."] });
  }
  // A station lost unused (faded, destroyed by a foe's step, pruned) is counted on its caster: an AI that keeps losing them stops preparing.
  const wasted = (s, t) => { const c = s.actors[t.caster]; if (c) { c.status ||= {}; c.status.miseFaded = (c.status.miseFaded || 0) + 1; } };
  const legalTechniqueLost = (s, ben, t, H) => !knows(H, ben, t.technique) || (ben.sealedTechs || []).includes(t.technique);

  // An enemy ending a move on a station destroys it (walk, jump or climb). Displacement is not movement: a push resolves normally.
  function moved(s, a, H) {
    if (!s.mise || a.defeated) return;
    for (const t of stations(s).filter((x) => x.x === a.x && x.y === a.y && x.side !== a.side)) {
      s.mise.stations = s.mise.stations.filter((x) => x.id !== t.id); wasted(s, t);
      H.log(s, { kind: "mise", actor: a.id, text: `${a.name} ends a move on the station at (${t.x},${t.y}) and destroys it.`, why: ["Exposed preparation is vulnerable."] });
    }
  }
  // A Pruning technique aimed at a station tile removes the marker (the caster's own side cannot prune it).
  function prune(s, a, x, y, H) {
    const hit = stations(s).filter((t) => t.x === x && t.y === y && t.side !== a.side); if (!hit.length) return false;
    s.mise.stations = s.mise.stations.filter((t) => !hit.includes(t));
    for (const t of hit) wasted(s, t);
    for (const t of hit) H.log(s, { kind: "mise", actor: a.id, text: `${a.name} prunes the preparation marker at (${t.x},${t.y}): its technique is no cheaper.`, why: ["Pruning disrupts Mise en Place: one critical component, removed."] });
    return true;
  }

  // ── the AI ──
  const foeNear = (s, a, x, y, H) => Object.values(s.actors).some((u) => !u.defeated && !u.escaped && !u.notArrived && u.side !== a.side && u.side !== "bystander" && H.dist(s, x, y, u.x, u.y) <= RULES.aiReach);
  // Placing: Rack and Label or Parallel Prep under its own feet when a foe is within reach, it keeps no station, and it can still
  // pay the ΦF of the technique it prepares (a plan that is net-positive in AP is worthless to a holder with no ΦF to cast it).
  const apValue = (s, a, H) => Math.max(0, ...[...H.abilitiesOf(a), ...(isChef(a) ? ["strike"] : [])].map((x) => defOf(s, H, x)).filter((d) => d && d.effect === "damage" && d.tier !== "ultimate").map((d) => (d.potency || 0) / Math.max(1, costOf(s, d))));   // damage an AP buys this holder
  function aiValue(s, a, cand, H) {
    const id = cand.ability; if (!IDS.has(id)) return null;
    if (id === "everythingInItsPlace") return 0;   // staged for the AI: a three-station plan is a player's call
    if (mine(s, a.id).length || (a.status?.miseFaded || 0) >= RULES.aiFadeCap) return 0;
    const t = cand.target; if (!t || t[0] !== a.x || t[1] !== a.y) return 0;
    if (!foeNear(s, a, a.x, a.y, H)) return 0;
    const r = planOf(s, a, id, id === "rackAndLabel" ? 2 : 3, t, null, H); if (r.error) return 0;
    const need = H.C.abilities[id].cost + Math.max(...r.plan.map((p) => defOf(s, H, p.technique).cost));
    if (a.pf < need) return 0;
    // Worth, on the damage scale: the AP the plan nets, at what an AP buys this holder in damage (its best potency per AP), half
    // of it, since a foe or a step can still spoil the redemption. A basic and refined Parallel Prep nets double a Rack and Label.
    const perAp = apValue(s, a, H);
    const net = r.plan.reduce((n, p) => n + savingOf(s, id, p.technique, H), 0) - costOf(s, H.C.abilities[id]);
    return 0.5 * net * perAp;
  }
  // Renewing (the action the AI sends before anything else): only a station it laid, fading, within reach of its own tile, with a
  // foe within reach of the station, enough AP left to cast, and at most RULES.aiRenewCap times per station: the AI cannot
  // sit and renew for ever.
  function aiRenew(s, a, H) {
    if (!s.mise || a.status?.miseRedeemed === a.ownerTurns) return null;
    for (const t of mine(s, a.id)) {
      const th = thirdsOf(s, t), ben = s.actors[t.beneficiary];
      if (th >= 3 || !valid(s, t) || t.renewals >= RULES.aiRenewCap || !near(a, t) || a.tempo < RULES.renewCost + RULES.floor) continue;
      if (!ben || ben.pf < defOf(s, H, t.technique).cost || !foeNear(s, a, t.x, t.y, H)) continue;
      return { type: "miseRenew", actor: a.id, station: t.id };
    }
    return null;
  }
  // The AI's walk: a holder does not step off a tile where a station of its own is still worth something to it, and a step onto one is
  // worth that much (half the AP it would save, at what an AP buys). Added to the walk's value in engine/ai.js moveValue.
  function stayValue(s, a, to, H) {
    if (!s.mise) return 0;
    let v = 0;
    for (const t of mine(s, a.id).filter((x) => x.beneficiary === a.id && !x.adjacent && valid(s, x))) {
      const w = (t.technique === "strike" ? RULES.chef.strikeAnchor : 0.5 * nowOf(s, t) * apValue(s, a, H)) * (t.technique === "strike" ? thirdsOf(s, t) / 3 : 1), here = a.x === t.x && a.y === t.y, there = to[0] === t.x && to[1] === t.y;   // a Chef's Strike plate: the Strike is his only damage, so it is worth its whole saving
      if (here && !there) v -= w; else if (!here && there) v += w;
    }
    return v;
  }
  // Placing first: at the start of its turn a holder with no station, a foe within the reach of the technique it would prepare
  // (so it is likely to be standing and shooting next turn), the AP for the plan and the ΦF to cast, prepares under its own feet.
  // Without this the cheaper-than-a-cast placement is outscored by every attack and the AI would never prepare. Once a turn.
  function aiPrepare(s, a, H) {
    if (!s.mise && !H.abilitiesOf(a).includes("rackAndLabel")) return null;
    if (a.actionsThisTurn > 0 || mine(s, a.id).length || (a.status?.miseFaded || 0) >= RULES.aiFadeCap || !H.abilitiesOf(a).includes("rackAndLabel")) return null;   // two stations that faded unused and it stops: place-fade-place cannot run for ever
    let r = planOf(s, a, "rackAndLabel", 2, [a.x, a.y], null, H), at = [a.x, a.y], declared = null;
    if (r.error && isChef(a)) {   // the Chef has no damaging technique of his own (Strike is an action, not a technique a station can name): he lays a plate under the nearest ally who has one
      for (const u of Object.values(s.actors).filter((x) => !x.defeated && !x.escaped && !x.notArrived && x.id !== a.id && x.side === a.side).sort((p, q) => H.dist(s, a.x, a.y, p.x, p.y) - H.dist(s, a.x, a.y, q.x, q.y) || (p.id < q.id ? -1 : 1))) {
        const tech = defaultTechnique(s, u, "rackAndLabel", H, a); if (!tech) continue;
        const plan = [{ at: [u.x, u.y], beneficiary: u.id, technique: tech }], r2 = planOf(s, a, "rackAndLabel", 2, [u.x, u.y], plan, H);
        if (!r2.error) { r = r2; at = [u.x, u.y]; declared = plan; break; }
      }
    }
    if (r.error) return null;
    const p = r.plan[0], d = defOf(s, H, p.technique);
    const foe = Object.values(s.actors).some((u) => !u.defeated && !u.escaped && !u.notArrived && u.side !== a.side && u.side !== "bystander" && H.dist(s, a.x, a.y, u.x, u.y) <= (d.range ?? 5));
    const far = isChef(a) && foeNear(s, a, a.x, a.y, H);   // the Chef lays when a foe is within the walk, not only within his technique's reach
    const lay = freeLay(s, a, at), ben = s.actors[p.beneficiary], own = ben.id === a.id, pay = lay ? 0 : H.C.abilities.rackAndLabel.cost;
    if ((!foe && !far) || a.pf < pay + (own ? d.cost : 0) || ben.pf < d.cost || a.tempo < (lay ? 0 : costOf(s, H.C.abilities.rackAndLabel)) + (own ? costOf(s, d) : 0)) return null;
    return { type: "ability", actor: a.id, ability: "rackAndLabel", target: at, ...(declared ? { stations: declared } : {}), overclock: 0, announce: false };
  }
  // Public read of every station with what the panel and marker show: the same numbers the discount applies.
  const view = (s) => stations(s).map((t) => ({ ...t, lock: t.lock.slice(), age: ageOf(s, t), fresh: freshOf(s, t), now: nowOf(s, t), goneIn: goneIn(s, t), renewable: thirdsOf(s, t) < 3 && valid(s, t) }));
  // A turn that arrives counts as started even when the unit sits it out (stall, husk). Nothing to do in a battle with no stations.
  function satOut(s, a) { if (!s.mise) return; for (const t of s.mise.stations) { const was = t.lock.length; t.lock = t.lock.filter((id) => id !== a.id); if (was && !t.lock.length) t.since = s.round; } }

  return { IDS, RULES, free, strikeBonus, strikePrep, isChef, beforeAbility, target, validate, resolve, discount, redeem, renew, turnStart, satOut, moved, prune, aiValue, aiRenew, aiPrepare, stayValue, view, legalTile, legalTechnique, planOf, defaultPlan };
});
