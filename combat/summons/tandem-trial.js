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
//
// T5a (R-20261121-29, R-20261121-31, R-20261121-33): the Instar's Trial is an Answer Trial (`kind: "answer"`), not an ordeal. The
// tandem stands on the field bound to the player from its first form, beside a frail companion; the Trial is passed when it reaches
// Form `goal.form` within `rounds` rounds with both standing (the scenario's objective ends the battle then: modes/objectives.js
// survive `molt`). Its price is a call, not LF (`price: { calls: 1 }`): the next real battle starts with one palace summon already
// used, the one the player called most recently (account.lastCalled, written by settle), else the Raven. The summon is named when
// the Trial begins (started freezes it on the record as `call`), so the card that names it before entry and the charge agree.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./summons-data.js"));
  else root.ConceptCombatTandemTrial = factory(root.ConceptCombatSummonData);
})(typeof self !== "undefined" ? self : this, function (SD) {
  const trialOf = (id) => (SD.summons[id] && SD.summons[id].tandem && SD.summons[id].tandem.trial) || null;
  const ids = () => Object.keys(SD.summons).filter((id) => trialOf(id));
  const NONE = { status: "none", owed: 0, since: 0, free: false, pending: false };
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  // Tandem T5a: a Trial whose price is a summon call (the Instar's), and one whose tandem fights bound beside the player.
  const callPriced = (T) => !!(T && T.price && T.price.calls > 0);
  const priceOf = (T) => (callPriced(T) ? T.price.calls : T.price.lf);
  const bound = (T) => !!(T && T.kind === "answer");
  const ownedCall = (account, id) => typeof id === "string" && !!SD.summons[id] && (id === "raven" || ((account && account.unlocked) || []).includes(id));
  // The summon a call price takes: the one the player called most recently, while it is still theirs; else the Raven.
  const nextCall = (account) => (ownedCall(account, account && account.lastCalled) ? account.lastCalled : SD.summons.raven ? "raven" : null);
  const callName = (id) => (id && SD.summons[id] ? SD.summons[id].name : "a summon");

  // One tandem's record as the rules read it. A record still `pending` (a Trial begun and never settled: the player left the
  // battle) is a fail whose price is still owed.
  function recordOf(account, id) {
    const T = trialOf(id), r = { ...NONE, ...(((account && account.tandems) || {})[id] || {}) };
    if (T && r.pending && (r.status === "none" || r.status === "failed")) return { status: "failed", owed: priceOf(T), since: 0, free: false, pending: false, left: true, ...(typeof r.call === "string" ? { call: r.call } : {}) };
    return r;
  }
  const withRecord = (account, id, rec) => ({ ...account, tandems: { ...((account && account.tandems) || {}), [id]: { status: rec.status, owed: rec.owed || 0, since: rec.since || 0, free: !!rec.free, pending: !!rec.pending,
    ...(rec.status === "passed" && rec.form > 1 ? { form: rec.form } : {}), ...(rec.status === "passed" && rec.clean > 0 ? { clean: rec.clean } : {}), ...(rec.status === "passed" && (rec.rung === "clean" || rec.rung === "perfect") ? { rung: rec.rung } : {}),   // Tandem T6: its ladder rung   // Tandem T4: the form an owned tandem has reached, and its clean-battle count
    ...((rec.status === "none" || rec.status === "failed") && typeof rec.call === "string" ? { call: rec.call } : {}) } } });   // Tandem T5a: the summon a call price names

  // Tandem T4 (SPEC section 5A; R-20261121-27): an owned tandem's growth between battles. `g` is what the battle wrote
  // (tandem.js noteGrowth: the form it reached, whether it strained; absent when it was never called). A molt in the battle is
  // kept and starts the new form's count afresh; otherwise a won battle in which it was out and never strained counts one clean
  // battle. When the form's condition is "mastery", the third clean battle molts it one form (Form 3 is final).
  // Returns { form, clean, line }; line is set only by a mastery molt.
  function growth(forms, rec, g, won) {
    if (!Array.isArray(forms) || !forms.length) return { form: 1, clean: 0, line: null };
    const last = Math.min(3, forms.length);
    let form = Math.min(last, Math.max(rec.form || 1, (g && g.form) || 1)), clean = rec.clean || 0, line = null;
    if (form > (rec.form || 1)) clean = 0;
    else if (g && won && !g.strained) clean += 1;
    const f = forms[form - 1];
    if (f && f.moltCondition === "mastery" && clean >= 3 && form < last) {
      form += 1; clean = 0; line = `${f.name} has fought three clean battles beside you: it molts into Form ${form}, ${forms[form - 1].name}.`;
    }
    return { form, clean, line };
  }

  // What the wing shows for one tandem, and whether its Trial may begin now (with the reason when it may not).
  function view(account, id) {
    const T = trialOf(id), row = SD.summons[id]; if (!T || !row) return null;
    const r = recordOf(account, id), wait = Math.max(0, T.retryAfter - r.since);
    const call = r.call || nextCall(account), goal = bound(T) ? goalOf(T, row) : null;
    const terms = bound(T)
      ? `${row.name} fights beside you, bound to you from its first form, and a frail companion fights with you. Pass when it reaches Form ${goal.form}, ${goal.name}, within ${plural(T.rounds, "round")}, with you and it both standing. It grows only by need: ${goal.needs}. If it falls, you fall, no foe is left, or the rounds run out first, the Trial is failed, and your next battle starts one summon call short: ${callName(call)} (the summon you called most recently, else the Raven) starts it already used. You may try again after ${plural(T.retryAfter, "battle")}. Pass, and it takes a room in your palace with its first call free; it answers as Form 1, and from then on the form it reaches is kept. Refusing costs nothing; leaving once it has begun counts as a fail.`
      : `Survive ${plural(T.rounds, "round")} against ${row.name} unbound: it fights with no leash and no strain, and it cannot be killed. Pass, and it takes a room in your palace with its first call free. Fall first, and the Trial takes ${T.price.lf} LF at the start of your next battle (never below 1 LF); you may try again after ${plural(T.retryAfter, "battle")}. Refusing costs nothing.`;
    const owedText = callPriced(T)
      ? (r.owed > 0 ? `Your next battle starts one summon call short: ${callName(call)} starts it already used. ` : "The summon call has been paid. ")
      : (r.owed > 0 ? `${r.owed} LF will be taken at the start of your next battle (never below 1 LF). ` : `The ${T.price.lf} LF has been paid. `);
    let label = "Not tried", detail = "The Trial waits. Refusing it costs nothing.", canBegin = true, reason = "";
    if (r.status === "passed") { label = "Passed"; canBegin = false; reason = `${row.name} already has its room.`;
      detail = `${row.name} has its room in your palace: call it from your summons. ${r.free ? "Its first call is free." : "Its free first call is spent: it now costs the usual summon call."}${row.tandem.ladder ? ` Its rung: ${r.rung || "practiced"}.` : ""}`; }
    else if (r.status === "answered") { label = "Answered"; canBegin = false; reason = `${row.name} answered your need and is gone for good: its Trial cannot be taken again.`;   // Tandem T5b (R-20261122-14)
      detail = `${row.name} answered once, when a blow should have ended you. Its place in this wing stands empty, and it will not come again.`; }
    else if (r.status === "failed") { label = "Failed"; canBegin = wait <= 0;
      reason = canBegin ? "" : `The Trial opens again after ${plural(wait, "more battle")}.`;
      detail = `${r.left ? `You left the ${bound(T) ? "Trial" : "ordeal"} before it ended, which counts as a ${bound(T) ? "fail" : "fall"}. ` : ""}${owedText}${canBegin ? "You may try again now." : reason}`; }
    const begin = bound(T) ? `Begin: reach Form ${goal.form} within ${plural(T.rounds, "round")}` : `Begin: survive ${plural(T.rounds, "round")}`;
    return { id, name: row.name, quality: T.quality, kind: T.kind, kindName: bound(T) ? "an Answer Trial" : "an ordeal", rounds: T.rounds, price: callPriced(T) ? null : T.price.lf, calls: callPriced(T) ? T.price.calls : 0,
      call: callPriced(T) ? call : null, retryAfter: T.retryAfter, status: r.status, label, owed: r.owed, since: r.since, free: r.free, canBegin, reason, detail, terms, begin };
  }
  const list = (account) => ids().map((id) => view(account, id));
  // An Answer Trial's goal: the form to reach, its name, and what makes it molt on the way (the conditions of tandem.js MOLT_WORDS, worded to the player).
  function goalOf(T, row) {
    const forms = row.tandem.forms || [], n = Math.min(3, (T.goal && T.goal.form) || forms.length), W = { cornered: "you drop below a quarter of your LF", witness: "an ally falls while it is out", refusal: "you break its rule", mastery: "it has fought three clean battles" };
    const needs = forms.slice(0, n - 1).map((f, i) => `Form ${i + 2} when ${W[f.moltCondition] || "its need fires"}`).join(", then ");
    return { form: n, name: (forms[n - 1] && forms[n - 1].name) || row.name, needs };
  }

  // What the next real battle is told (E.create opts.tandems): the LF each failed Trial still takes, and the passed tandems whose
  // first call is still free. null when there is nothing to tell.
  function battleOpts(account) {
    const owed = [], free = [];
    for (const id of ids()) { const r = recordOf(account, id); if (r.status === "failed" && r.owed > 0) owed.push(callPriced(trialOf(id)) ? { id, call: r.call || nextCall(account) } : { id, lf: r.owed }); if (r.status === "passed" && r.free) free.push(id); }
    const forms = {};   // Tandem T4: an owned molting tandem arrives in the form it has reached (battleStart writes s.tandemForms)
    for (const id of ids()) { const r = recordOf(account, id); if (r.status === "passed" && r.form > 1) forms[id] = r.form; }
    const hasForms = Object.keys(forms).length > 0;
    const rungs = {};   // Tandem T6: an owned tandem with a ladder arrives at the rung it has climbed to (practiced, the Trial pass's rung, is not sent: Tandem.applyRung reads the account's list)
    for (const id of ids()) { const r = recordOf(account, id); if (r.status === "passed" && SD.summons[id].tandem.ladder && (r.rung === "clean" || r.rung === "perfect")) rungs[id] = r.rung; }
    const hasRungs = Object.keys(rungs).length > 0;
    return owed.length || free.length || hasForms || hasRungs ? { owed, free, ...(hasForms ? { forms } : {}), ...(hasRungs ? { rungs } : {}) } : null;
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
      if (out.pending && callPriced(trialOf(id))) out.call = nextCall(account);   // Tandem T5a: the summon the price will take is named now, as the card named it
      if (!raw && out.status === "none" && !out.pending) continue;
      if (raw && raw.status === out.status && (raw.owed || 0) === out.owed && (raw.since || 0) === out.since && !!raw.pending === out.pending && (raw.call || null) === (out.call || null)) continue;
      next = withRecord(next, id, out); changed = true;
    }
    return changed ? next : null;
  }
  // At the end of a real battle. A Trial: pass when the player's side won with the player's character still standing, else fail.
  // Any other battle: one more battle since each fail (the retry gate), and a free first call that was used is spent.
  function settle(account, s) {
    const lines = []; let next = spendNow(account, s) || account;   // Tandem T5b: an Answer given in this battle (spendNow already saved it in the page; sims and headless runs save it here)
    const trial = s && s.tandemTrial, spent = new Set(((s && s.tandemCodes) || []).filter((c) => c.type === "firstCall").map((c) => c.id));
    for (const id of ids()) {
      const T = trialOf(id), row = SD.summons[id], raw = ((next && next.tandems) || {})[id], r = recordOf(next, id);
      if (trial && trial.id === id) {
        if (r.status === "passed" || (raw?.status === "failed" && !raw.pending)) continue;
        const P = s.actors && s.actors.player, won = !!(s.outcome && s.outcome.winner === "player" && P && !P.defeated && P.lf > 0);
        const pass = won && (!bound(T) || reached(s, T, row));   // T5a: an Answer Trial is passed only by the form, with the tandem standing
        if (pass) { next = withRecord(next, id, { status: "passed", free: true });
          if (!(next.unlocked || []).includes(id)) next = { ...next, unlocked: [...(next.unlocked || []), id] };
          lines.push(bound(T) ? `The Trial is passed: ${row.name} takes its room in your palace. Its first call is free. It answers as ${row.tandem.forms[0].name}, and from now on the form it reaches is kept.`
            : `The Trial is passed: ${row.name} takes its room in your palace. Its first call is free.`); }
        else if (callPriced(T)) { const call = (raw && typeof raw.call === "string" ? raw.call : null) || nextCall(next);
          next = withRecord(next, id, { status: "failed", owed: priceOf(T), since: 0, call });
          lines.push(`The Trial is failed: your next battle starts one summon call short, with ${callName(call)} already used. It opens again after ${plural(T.retryAfter, "battle")}.`); }
        else { next = withRecord(next, id, { status: "failed", owed: T.price.lf, since: 0 });
          lines.push(`The Trial is failed: ${T.price.lf} LF will be taken at the start of your next battle (never below 1 LF). It opens again after ${plural(T.retryAfter, "battle")}.`); }
        continue;
      }
      if (r.status === "failed" && raw) next = withRecord(next, id, { ...r, since: r.since + 1 });
      if (r.status === "passed" && spent.has(id)) { if (r.free) next = withRecord(next, id, { ...r, free: false }); lines.push(`${row.name}'s free first call is spent.`); }   // spendNow may have written it already
      if (r.status === "passed" && row.tandem.forms) {   // Tandem T4: keep the form it reached; count a clean won battle; a mastery molt
        const cur = recordOf(next, id), g = ((s && s.tandemGrowth) || {})[id], won = !!(s && s.outcome && s.outcome.winner === "player");
        const out = growth(row.tandem.forms, cur, g, won);
        if (out.form !== (cur.form || 1) || out.clean !== (cur.clean || 0)) next = withRecord(next, id, { ...cur, form: out.form, clean: out.clean });
        if (out.line) lines.push(out.line);
        else if (g && out.form > (cur.form || 1)) lines.push(`${row.tandem.forms[out.form - 1].name} keeps the form it reached: it will answer your next call in Form ${out.form}.`);
      }
    }
    for (const id of ids()) {   // Tandem T6 (R-20261122-15, R-20261122-66): an owned tandem climbs its ladder, never down; a lent one has no record to climb
      const L = SD.summons[id].tandem.ladder, cur = recordOf(next, id), g = ((s && s.tandemGrowth) || {})[id];
      if (!L || !g || g.strained || !((g.foes || 0) >= L.foes)) continue;   // g.foes is written only for an owned tandem (Tandem.applyRung gave it a rung), never the Trial's own foe
      const order = ["practiced", "clean", "perfect"], to = order[order.indexOf(cur.rung || "practiced") + 1];   // one rung a battle: practiced, then clean, then perfect
      if (!to || (to === "perfect" && !g.mattered)) continue;
      next = withRecord(next, id, { ...cur, rung: to });
      lines.push(`${SD.summons[id].name} wounded ${L.foes} different foes without straining${to === "perfect" ? " in a battle that mattered" : ""}: it reaches the ${to} rung. ${to === "perfect" ? `It now carries ${L.cleanLendMax} lent tiles and arrives with ${L.perfectStartTiles} already lent.` : `It now carries ${L.cleanLendMax} lent tiles.`}`);
    }
    const last = lastCall(next, s);   // Tandem T5a: the summon a call price would take next
    if (last && last !== next.lastCalled) next = { ...next, lastCalled: last };
    return { account: next, lines };
  }
  // Has the Answer Trial's tandem reached its goal form, standing?
  function reached(s, T, row) {
    const m = s.tandemTrial && s.actors && s.actors[s.tandemTrial.unit], t = m && m.summon && m.summon.tandem;
    return !!(m && !m.defeated && m.lf > 0 && t && (t.currentForm || 1) >= goalOf(T, row).form);
  }
  // The palace summon the player called last in this battle: the last bare id in s.summonUsed (the player's calls, in order) that
  // is theirs, leaving out what a call price took and the Trial's own tandem. null when they called none.
  function lastCall(account, s) {
    const taken = new Set(((s && s.tandemCodes) || []).filter((c) => c.type === "owedPaid" && c.call).map((c) => c.call));
    const own = s && s.tandemTrial ? s.tandemTrial.id : null;
    const calls = ((s && s.summonUsed) || []).filter((k) => typeof k === "string" && !k.includes("@") && !taken.has(k) && k !== own && ownedCall(account, k));
    return calls.length ? calls[calls.length - 1] : null;
  }

  // Right after the action that spent a free first call (ui.js act): the account forgets the free call at once, so a battle left
  // before its end cannot hand it back (as started() does for the price). Returns the changed account, or null.
  function spendNow(account, s) {
    let next = account, changed = false;
    for (const c of ((s && s.tandemCodes) || []).filter((x) => x.type === "answered" && !x.lent && trialOf(x.id))) {   // Tandem T5b: an Answer is saved at once; leaving the battle cannot bring the tandem back
      if (recordOf(next, c.id).status === "answered") continue;
      next = { ...withRecord(next, c.id, { status: "answered" }), unlocked: ((next && next.unlocked) || []).filter((id) => id !== c.id) }; changed = true;
    }
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
        const row = SD.summons[o.id]; if (!row) continue;
        if (o.call) { takeCall(s, o, row, H); continue; }   // Tandem T5a: a call price
        if (!(o.lf > 0)) continue;
        const paid = Math.min(o.lf, Math.max(0, P.lf - 1)); P.lf -= paid;   // it wounds, it never kills (as Red Ink's burn)
        (s.tandemCodes ||= []).push({ type: "owedPaid", id: o.id, lf: paid });
        H.log(s, { kind: "tandem", actor: "player", owed: paid, text: `${row.name}'s failed Trial takes its price: ${P.name} starts ${paid} LF down (${P.lf}/${P.maxLF}).`,
          why: ["A failed Trial wounds once, at the start of the next battle. It was stated before the Trial began."] });
      }
      s.tandemFree = (T.free || []).filter((id) => trialOf(id));
      if (T.rungs) s.tandemRungs = Object.fromEntries(Object.entries(T.rungs).filter(([id, r]) => trialOf(id) && SD.summons[id].tandem.ladder && ["practiced", "clean", "perfect"].includes(r)));   // Tandem T6: read by every summon call (Tandem.applyRung)
      if (T.forms) s.tandemForms = Object.fromEntries(Object.entries(T.forms).filter(([id, n]) => trialOf(id) && SD.summons[id].tandem.forms && n > 1));   // Tandem T4: read by every summon call (engine/actions-summons.js, conditions.js death door)
    }
    if (opts && opts.tandemTrial) place(s, opts.tandemTrial, H);
  }
  // A call price: the named summon starts this battle already used (s.summonUsed, the player's bare ids), so it cannot be called.
  // A summon that is no longer the player's to call gives way to the Raven. Taken once: started() clears the record's owed.
  function takeCall(s, o, row, H) {
    const P = s.actors.player, mine = (id) => id === "raven" || (s.unlockedSummons || []).includes(id);
    const key = SD.summons[o.call] && mine(o.call) ? o.call : SD.summons.raven ? "raven" : null;
    if (!key || !P) return;
    if (!(s.summonUsed ||= []).includes(key)) s.summonUsed.push(key);
    (s.tandemCodes ||= []).push({ type: "owedPaid", id: o.id, call: key });
    H.log(s, { kind: "tandem", actor: "player", owedCall: key, text: `${row.name}'s failed Trial takes its price: ${SD.summons[key].name} starts this battle already used, and cannot be called.`,
      why: ["A failed Answer Trial costs one summon call at the start of the next battle. Its card named the summon before the Trial began."] });
  }
  // The summons a call price took from the player this battle (engine.js summonProfile hands them to summons.js canSummon, which
  // names the reason).
  const pricedCalls = (s, a) => (s && a && a.id === "player" ? (s.tandemCodes || []).filter((c) => c.type === "owedPaid" && c.call).map((c) => c.call) : []);
  // What the Trials change in one call's profile (engine.js summonProfile spreads it): a free first call costs nothing (T2c), and the
  // summons a call price took ride along for canSummon's reason (T5a).
  const profile = (s, a, key) => ({ ...(freeCall(s, a, key) ? { apCost: 0, phiCost: 0, freeCall: true } : {}), pricedCalls: pricedCalls(s, a) });
  // The unbound tandem: the real summon actor (the same row, sprite, kit and full-bond strength a correct call gives), on the enemy
  // side with no owner, standing where a called summon arrives (within 2 tiles of the player) unless the scenario names a tile. No owner means no leash, no strain and no echo (tandem.js userOf); it does not go home (its stay has no
  // clock that matters here) and a hit cannot finish it (engine/damage.js, Tandem.unbound).
  function place(s, t, H) {
    const row = SD.summons[t.summon], P = s.actors.player, SR = H.summonRules;
    if (!row || !row.tandem || !P || !SR || !H.liveSummon) return null;
    const at = Array.isArray(t.at) && !H.actorAt(s, t.at[0], t.at[1]) ? t.at.slice() : SR.placeSummon(s.arena, [P.x, P.y], new Set(Object.values(s.actors).filter((u) => !u.defeated).map((u) => `${u.x},${u.y}`)));
    if (!at) return null;
    if (t.bound) return placeBound(s, t, at, H);
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
  // Tandem T5a, an Answer Trial: the tandem is the player's, bound and on the field from the start in its first form (the call the
  // player would make, at full bond), so the companion's fall can be witnessed from round 1. It stays to the end of the Trial (its
  // stay outlasts the clock) and goes in s.summonUsed as the player's call, so it cannot be called a second time beside itself.
  // Bound, it can fall: neither the hit floor nor keep() holds it up (Tandem.unbound is false), and its fall is the Trial's fail.
  function placeBound(s, t, at, H) {
    const P = s.actors.player, raw = H.summonRules.makeSummonActor(t.summon, { owner: P.id, at, bond: 2 });
    const m = H.liveSummon(s, P, raw);
    m.summon = { ...m.summon, turnsLeft: Math.max(m.summon.turnsLeft || 0, t.rounds + 1) };   // it is on the field until the clock, not sent home before it
    s.actors[m.id] = m; s.order.splice(1, 0, m.id); s.disclosures[m.id] = {}; s.observedAbilities[m.id] = [];
    if (!(s.summonUsed ||= []).includes(t.summon)) s.summonUsed.push(t.summon);
    if (H.insightRules && s.insight) { const deck = H.insightRules.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[m.id] = deck; s.insight.knowledge[m.id] = H.insightRules.spawnKnowledge(deck); }
    H.summonRules.Tandem?.noteGrowth?.(s, m, {});
    s.tandemTrial = { id: t.summon, unit: m.id, rounds: t.rounds, bound: true };
    H.log(s, { kind: "tandem", actor: m.id, tiles: [at], text: `${m.name} stands bound beside you at (${at[0]},${at[1]}). Reach its last form within ${plural(t.rounds, "round")}, with you and it both standing.`,
      why: ["The Answer Trial: it grows only by need, and it can fall. If it falls, the Trial is failed."] });
    return m;
  }
  // The backstop behind the hit floor (engine/true-forms.js checkOutcome, which nearly every defeat path ends in): a Trial's
  // tandem that some other path took down or sent away (a bleed, a rout, a ritual) stands again at 1 LF.
  function keep(s, log) {
    const t = s.tandemTrial, m = t && !t.bound && s.actors[t.unit];   // T5a: a bound Trial tandem can fall
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

  return { trialOf, ids, recordOf, view, list, battleOpts, started, settle, growth, spendNow, battleStart, place, keep, freeCall, spendFree, pricedCalls, profile, nextCall, options };
});
