"use strict";
// Tandem Spirits, slice T2c: the Trial (~/loci-orbit/ready-to-review/muse-tandem-spirit-spec SPEC.md section 3; R-20261115-03,
// R-20261115-15, R-20261115-42). No tandem is bought or levelled into: each has a Trial, named on its summon row
// (summons-data.js `tandem.trial`: { kind, quality, rounds, price: { lf }, retryAfter, scenario }). The Mosaic's is an ordeal:
// survive 5 rounds against it unbound.
//
//   Pass    the tandem takes its palace room (account.tandems[id].status "passed": account.js lists it in `unlocked`) and its
//           first call is free, once (no AP, no ΦF).
//   Fail    the player's character fell first. The price (10 LF) is taken at the start of the next battle, once, and the Trial
//           opens again after one finished battle.
//   Refuse  nothing is written and nothing is charged. Leaving a Trial that has begun is not a refusal: it reads as a fail.
//
// Three groups of functions, all pure but the engine three (which change the battle state they are handed):
//   the record     recordOf, view, list, battleOpts, started, spendNow, settle (account.tandems; account.js cleans and saves it)
//   the engine     battleStart, freeCall, spendFree                           (engine/factions.js scenarioCivilians, engine.js
//                  summonProfile, engine/actions-summons.js summon)
//   the battle     options(id, seed, deps)                                    (the E.create options of the Trial's scenario)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./summons-data.js"));
  else root.ConceptCombatTandemTrial = factory(root.ConceptCombatSummonData);
})(typeof self !== "undefined" ? self : this, function (SD) {
  const trialOf = (id) => (SD.summons[id] && SD.summons[id].tandem && SD.summons[id].tandem.trial) || null;
  const ids = () => Object.keys(SD.summons).filter((id) => trialOf(id));
  const NONE = { status: "none", owed: 0, since: 0, free: false, pending: false };
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  // One tandem's record as the rules read it. A record still `pending` (a Trial begun and never settled: the player left the
  // battle) is a fail whose price is still owed.
  function recordOf(account, id) {
    const T = trialOf(id), r = { ...NONE, ...(((account && account.tandems) || {})[id] || {}) };
    if (T && r.pending && r.status !== "passed") return { status: "failed", owed: T.price.lf, since: 0, free: false, pending: false, left: true };
    return r;
  }
  const withRecord = (account, id, rec) => ({ ...account, tandems: { ...((account && account.tandems) || {}), [id]: { status: rec.status, owed: rec.owed || 0, since: rec.since || 0, free: !!rec.free, pending: !!rec.pending } } });

  // What the wing shows for one tandem, and whether its Trial may begin now (with the reason when it may not).
  function view(account, id) {
    const T = trialOf(id), row = SD.summons[id]; if (!T || !row) return null;
    const r = recordOf(account, id), wait = Math.max(0, T.retryAfter - r.since);
    const terms = `Survive ${plural(T.rounds, "round")} against ${row.name} unbound: it fights with no leash and no strain, and it cannot be killed. Pass, and it takes a room in your palace with its first call free. Fall first, and the Trial takes ${T.price.lf} LF at the start of your next battle (never below 1 LF); you may try again after ${plural(T.retryAfter, "battle")}. Refusing costs nothing.`;
    let label = "Not tried", detail = "The Trial waits. Refusing it costs nothing.", canBegin = true, reason = "";
    if (r.status === "passed") { label = "Passed"; canBegin = false; reason = `${row.name} already has its room.`;
      detail = `${row.name} has its room in your palace: call it from your summons. ${r.free ? "Its first call is free." : "Its free first call is spent: it now costs the usual summon call."}`; }
    else if (r.status === "failed") { label = "Failed"; canBegin = wait <= 0;
      reason = canBegin ? "" : `The Trial opens again after ${plural(wait, "more battle")}.`;
      detail = `${r.left ? "You left the ordeal before it ended, which counts as a fall. " : ""}${r.owed > 0 ? `${r.owed} LF will be taken at the start of your next battle (never below 1 LF). ` : `The ${T.price.lf} LF has been paid. `}${canBegin ? "You may try again now." : reason}`; }
    return { id, name: row.name, quality: T.quality, kind: T.kind, rounds: T.rounds, price: T.price.lf, retryAfter: T.retryAfter, status: r.status, label, owed: r.owed, since: r.since, free: r.free, canBegin, reason, detail, terms };
  }
  const list = (account) => ids().map((id) => view(account, id));

  // What the next real battle is told (E.create opts.tandems): the LF each failed Trial still takes, and the passed tandems whose
  // first call is still free. null when there is nothing to tell.
  function battleOpts(account) {
    const owed = [], free = [];
    for (const id of ids()) { const r = recordOf(account, id); if (r.status === "failed" && r.owed > 0) owed.push({ id, lf: r.owed }); if (r.status === "passed" && r.free) free.push(id); }
    return owed.length || free.length ? { owed, free } : null;
  }
  // Right after a real battle is created: the price that battle took is no longer owed (so it is taken once, even if the battle is
  // then abandoned), a Trial left unfinished becomes the fail it is, and a Trial that just began is marked pending.
  // Returns the changed account, or null when nothing changed.
  function started(account, s) {
    let next = account, changed = false;
    const paid = new Set(((s && s.tandemCodes) || []).filter((c) => c.type === "owedPaid").map((c) => c.id));
    for (const id of ids()) {
      const raw = ((account && account.tandems) || {})[id], r = recordOf(account, id);
      const out = { ...r, owed: paid.has(id) ? 0 : r.owed, pending: !!(s && s.tandemTrial && s.tandemTrial.id === id) };
      if (!raw && out.status === "none" && !out.pending) continue;
      if (raw && raw.status === out.status && (raw.owed || 0) === out.owed && (raw.since || 0) === out.since && !!raw.pending === out.pending) continue;
      next = withRecord(next, id, out); changed = true;
    }
    return changed ? next : null;
  }
  // At the end of a real battle. A Trial: pass when the player's side won with the player's character still standing, else fail.
  // Any other battle: one more battle since each fail (the retry gate), and a free first call that was used is spent.
  function settle(account, s) {
    const lines = []; let next = account;
    const trial = s && s.tandemTrial, spent = new Set(((s && s.tandemCodes) || []).filter((c) => c.type === "firstCall").map((c) => c.id));
    for (const id of ids()) {
      const T = trialOf(id), row = SD.summons[id], raw = ((next && next.tandems) || {})[id], r = recordOf(next, id);
      if (trial && trial.id === id) {
        if (r.status === "passed" || (raw?.status === "failed" && !raw.pending)) continue;
        const P = s.actors && s.actors.player, pass = !!(s.outcome && s.outcome.winner === "player" && P && !P.defeated && P.lf > 0);
        if (pass) { next = withRecord(next, id, { status: "passed", free: true });
          if (!(next.unlocked || []).includes(id)) next = { ...next, unlocked: [...(next.unlocked || []), id] };
          lines.push(`The Trial is passed: ${row.name} takes its room in your palace. Its first call is free.`); }
        else { next = withRecord(next, id, { status: "failed", owed: T.price.lf, since: 0 });
          lines.push(`The Trial is failed: ${T.price.lf} LF will be taken at the start of your next battle (never below 1 LF). It opens again after ${plural(T.retryAfter, "battle")}.`); }
        continue;
      }
      if (r.status === "failed" && raw) next = withRecord(next, id, { ...r, since: r.since + 1 });
      if (r.status === "passed" && spent.has(id)) { if (r.free) next = withRecord(next, id, { ...r, free: false }); lines.push(`${row.name}'s free first call is spent.`); }   // spendNow may have written it already
    }
    return { account: next, lines };
  }

  // Right after the action that spent a free first call (ui.js act): the account forgets the free call at once, so a battle left
  // before its end cannot hand it back (as started() does for the price). Returns the changed account, or null.
  function spendNow(account, s) {
    let next = account, changed = false;
    for (const c of ((s && s.tandemCodes) || []).filter((x) => x.type === "firstCall")) {
      const r = recordOf(next, c.id);
      if (r.status === "passed" && r.free) { next = withRecord(next, c.id, { ...r, free: false }); changed = true; }
    }
    return changed ? next : null;
  }

  // ── the engine side ──
  // E.create's start hook (engine/factions.js scenarioCivilians, before the first turn): take what a failed Trial is owed, note
  // which first calls are free, and stand the unbound tandem on the field when this battle is a Trial.
  function battleStart(s, opts, H) {
    const P = s.actors.player, T = opts && opts.tandems;
    if (T && P) {
      for (const o of T.owed || []) {
        const row = SD.summons[o.id]; if (!row || !(o.lf > 0)) continue;
        const paid = Math.min(o.lf, Math.max(0, P.lf - 1)); P.lf -= paid;   // it wounds, it never kills (as Red Ink's burn)
        (s.tandemCodes ||= []).push({ type: "owedPaid", id: o.id, lf: paid });
        H.log(s, { kind: "tandem", actor: "player", owed: paid, text: `${row.name}'s failed Trial takes its price: ${P.name} starts ${paid} LF down (${P.lf}/${P.maxLF}).`,
          why: ["A failed Trial wounds once, at the start of the next battle. It was stated before the Trial began."] });
      }
      s.tandemFree = (T.free || []).filter((id) => trialOf(id));
    }
    if (opts && opts.tandemTrial) place(s, opts.tandemTrial, H);
  }
  // The unbound tandem: the real summon actor (the same row, sprite, kit and full-bond strength a correct call gives), on the enemy
  // side with no owner, standing where a called summon arrives (within 2 tiles of the player) unless the scenario names a tile. No owner means no leash, no strain and no echo (tandem.js userOf); it does not go home (its stay has no
  // clock that matters here) and a hit cannot finish it (engine/damage.js, Tandem.unbound).
  function place(s, t, H) {
    const row = SD.summons[t.summon], P = s.actors.player, SR = H.summonRules;
    if (!row || !row.tandem || !P || !SR || !H.liveSummon) return null;
    const at = Array.isArray(t.at) && !H.actorAt(s, t.at[0], t.at[1]) ? t.at.slice() : SR.placeSummon(s.arena, [P.x, P.y], new Set(Object.values(s.actors).filter((u) => !u.defeated).map((u) => `${u.x},${u.y}`)));
    if (!at) return null;
    const raw = SR.makeSummonActor(t.summon, { owner: null, at, bond: 2, potencyMul: 1.2 });
    const m = H.liveSummon(s, P, raw);
    for (const k of ["lentSummons", "perkMods", "orbs", "fruit", "injuries", "cards", "deck", "hand", "beastSummons"]) delete m[k];   // the player's own carry does not ride on a foe built from his record
    m.id = `unbound-${t.summon}`; m.side = "enemy"; m.permanentAlly = false; m.inspiration = 0; m.widenedPalace = 0; m.posture = "aggressive";
    m.summon = { ...m.summon, owner: null, unbound: true, turnsLeft: 999 };
    s.actors[m.id] = m; s.order.push(m.id); s.disclosures[m.id] = {}; s.observedAbilities[m.id] = [];
    s.knowledge[m.id] = {};
    for (const o of s.order) { if (o === m.id || !s.actors[o] || s.actors[o].side === m.side) continue;
      s.knowledge[m.id][o] = { secondary: false, lens: false, abilities: {} }; (s.knowledge[o] ||= {})[m.id] = { secondary: false, lens: false, abilities: {} }; }
    if (H.insightRules && s.insight) { const deck = H.insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[m.id] = deck; s.insight.knowledge[m.id] = H.insightRules.spawnKnowledge(deck); }
    s.tandemTrial = { id: t.summon, unit: m.id, rounds: t.rounds };
    H.log(s, { kind: "tandem", actor: m.id, tiles: [at], text: `${m.name} stands unbound at (${at[0]},${at[1]}): no user, no leash, no strain. It cannot be killed. Endure ${plural(t.rounds, "round")}.`,
      why: ["The ordeal: it fights at full strength, and a blow that would finish it leaves it at 1 LF."] });
    return m;
  }
  // The backstop behind the hit floor (engine/true-forms.js checkOutcome, which nearly every defeat path ends in): a Trial's
  // tandem that some other path took down or sent away (a bleed, a rout, a ritual) stands again at 1 LF.
  function keep(s, log) {
    const t = s.tandemTrial, m = t && s.actors[t.unit];
    if (!m || s.outcome || (!m.defeated && m.lf > 0)) return false;
    m.defeated = false; m.lf = Math.max(1, m.lf || 0);
    for (const k of ["escaped", "captured", "knockedOut", "leaveReason", "defeatedBy", "noXp", "routed"]) delete m[k];
    if (log) log(s, { kind: "tandem", actor: m.id, tiles: [[m.x, m.y]], kept: true, text: `${m.name} gathers its pieces and stands again at ${m.lf} LF: unbound, it cannot be killed or sent away.` });
    return true;
  }
  // Is `key`'s call free for this caller now? Only the player character's, only while the record's free call is unspent.
  const freeCall = (s, a, key) => !!(s && a && a.id === "player" && key && (s.tandemFree || []).includes(key));
  function spendFree(s, a, key, log) {
    if (!freeCall(s, a, key)) return false;
    s.tandemFree = s.tandemFree.filter((id) => id !== key);
    (s.tandemCodes ||= []).push({ type: "firstCall", id: key });
    if (log) log(s, { kind: "tandem", actor: a.id, freeCall: key, text: `${SD.summons[key].name}'s first call is free: no AP and no ΦF. The next call costs the usual summon call.`,
      why: ["Passing its Trial earns one free call."] });
    return true;
  }

  // ── the battle ──
  // The E.create options of `id`'s Trial: the random-encounter base with the Trial's scenario laid over it, at the scenario's own
  // clock (tier 2: no tier adjustment), with no tourist, cat or house. deps: { E, Scenarios, ctx, loadout, mainCharacter }.
  // A seed that rolled the Tallyman keeps his battle (scenarios.js apply), so the next seed is tried; null if none takes.
  function options(id, seed, deps) {
    const T = trialOf(id); if (!T || !deps || !deps.E || !deps.Scenarios) return null;
    for (let i = 0; i < 12; i++) {
      const sd = ((seed >>> 0) + i * 7919) >>> 0;
      const base = deps.E.randomEncounterOptions(sd, deps.loadout || {}, "random", { foughtBeside: [], everything: false, mainCharacter: deps.mainCharacter });
      const out = deps.Scenarios.apply(base, T.scenario, sd, { ...(deps.ctx || {}), tier: 2 });
      if (out && out.scenarioBattle === T.scenario && out.tandemTrial) return { ...out, tourist: false, kaiba: false, houses: false, startingActor: "player" };
    }
    return null;
  }

  return { trialOf, ids, recordOf, view, list, battleOpts, started, settle, spendNow, battleStart, place, keep, freeCall, spendFree, options };
});
