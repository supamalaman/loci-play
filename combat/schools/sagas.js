"use strict";
// Sagas (W9.6 build): arcs that begin, develop, end. Battles are sentences;
// sagas are BOOKS — the account-level container endings need. Nothing live
// changes: sagas read the account and write the spine.
//   RULES                                    → tunables (settled fraction)
//   open(account, { seed })                  → { account, lines } (first PV or first claim starts it)
//   progress(account, { keptVows, newNodes, seed }) → { account, lines } (battle-end: maybe-open + count)
//   canClose(account, { milestone, declared }) → { ok, reasons } (1+ graduation OR fanfare OR Mala declares)
//   close(account, ending, { star, heirloom, sagaBeat, seed }) → { account, directives, lines }
//   view(account)                            → what the Field Kit's saga card shows: the open book, the gate, each ending
// Endings: GATELESS (seal + star + heirloom via gateless.js, needs 2
// schools), SETTLED (keep everything, halve discoveries, no star), FALLEN
// (wipe/retirement — sin-death rules settle the estate, then the ledger
// clears like every ending). Titles and stars persist across sagas, always. CLOSE is
// declared: the Field Kit's saga card (ui.js sagaCard) calls view() and close(); manual retire is the default.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./gateless.js"), require("../law/sindeaths.js"), require("../account/fruit.js"));
  else root.CombatSagas = factory(root.CombatGateless, root.CombatSinDeaths, root.ConceptCombatFruit);
})(typeof self !== "undefined" ? self : this, function (GL, SD, FR) {
  const RULES = { settledFraction: 1 / 2 };
  const shape = (account) => account?.sagas && Array.isArray(account.sagas.past) ? account.sagas : { active: null, past: [] };
  const totals = (account) => ({ battles: account?.battles || 0, graduations: (account?.graduations || []).length, deaths: (account?.deaths || []).length, equations: (account?.mergeLedger || []).length });
  function open(account, { seed = null } = {}) {
    const sagas = shape(account);
    if (sagas.active) return { account, lines: [] };   // one book at a time — finish it!
    const id = `saga-${sagas.past.length + 1}`;
    const active = { id, opened: { seed, ...totals(account) }, battles: 0 };
    return { account: { ...account, sagas: { active, past: sagas.past } }, lines: [`A saga opens (${id}): journeys begin by walking.`] };
  }
  function progress(account, { keptVows = 0, newNodes = 0, seed = null } = {}) {
    let out = account, lines = [];
    if (!shape(out).active && (keptVows > 0 || newNodes > 0)) ({ account: out, lines } = open(out, { seed }));
    const sagas = shape(out);
    if (sagas.active) out = { ...out, sagas: { ...sagas, active: { ...sagas.active, battles: sagas.active.battles + 1 } } };
    return { account: out, lines };
  }
  function canClose(account, { milestone = false, declared = false } = {}) {
    const reasons = [];
    if ((account?.graduations || []).length >= 1) reasons.push("graduation held");
    if (milestone) reasons.push("saga-fanfare milestone");
    if (declared) reasons.push("declared");
    if (!shape(account).active) return { ok: false, reasons: ["no saga open"] };
    return { ok: reasons.length > 0, reasons: reasons.length ? reasons : ["endings unlock: graduate, fanfare, or declare"] };
  }
  const ENDINGS = ["GATELESS", "SETTLED", "FALLEN"];
  function close(account, ending, { star = "", heirloom = null, sagaBeat = "", seed = null } = {}) {
    const sagas = shape(account);
    if (!sagas.active || !ENDINGS.includes(ending)) return { account, directives: {}, lines: [] };
    const now = totals(account), was = sagas.active.opened;
    const record = { id: sagas.active.id, opened: was, closed: { seed, ending },
      battles: sagas.active.battles, graduations: now.graduations - was.graduations, deaths: now.deaths - was.deaths, equations: now.equations - was.equations };
    let out = account, directives = {};
    if (ending === "GATELESS") {
      if ((account?.graduations || []).length < 2) return { account, directives: {}, lines: ["GateLess needs breadth: graduate of 2+ schools first."] };
      const sealed = GL.seal(account, { star, heirloom, saga: sagas.active.id });
      out = sealed.account; directives = sealed.directives;
      record.summary = `Saga ${record.id}: ${record.battles} battles, ${record.graduations} graduations, ${record.deaths} deaths weighed, ${record.equations} equations ledgered — sealed complete. ${sagaBeat || "The hand rests; the name remains."}`;
    } else if (ending === "SETTLED") {
      out = { ...account, discoveries: Math.floor((account?.discoveries || 0) * RULES.settledFraction) };
      record.summary = `Saga ${record.id}: ${record.battles} battles, ${record.graduations} graduations, ${record.deaths} deaths weighed, ${record.equations} equations ledgered — settled, unsealed. ${sagaBeat || "The middle path keeps walking money."}`;
    } else {
      const w = SD.weigh(account?.marks || [], { estate: account?.discoveries || 0 });
      out = { ...account, discoveries: 0 };   // the story is the estate (nodes stay: the map, not the purse)
      record.weighing = { clean: w.clean, tithe: w.tithe, appeal: w.appeal, restTo: w.restTo };
      record.summary = `Saga ${record.id}: ${record.battles} battles, ${record.graduations} graduations, ${record.deaths} deaths weighed, ${record.equations} equations ledgered — fallen. ${sagaBeat || "The weighing allowed the ledger through."}`;
    }
    out = { ...out, marks: [], schoolKeys: [], sagas: { active: null, past: [...sagas.past, record] } };   // rulings 2+3 (2026-10-26): the ledger resets at close — sin marks clear, earned keys return (home needs no key: keysOf adds it)
    const tide = FR ? FR.returnToTide(out) : { account: out, line: "" }; out = tide.account;   // Sinkerfruit: every close returns the eaten fruit to the tide (account/fruit.js)
    return { account: out, directives, lines: [`${record.id} closes (${ending.toLowerCase()}): ${record.summary}`, `The ledger is cleared: marks gone, keys return to the home school.`, ...(tide.line ? [tide.line] : [])] };
  }
  // The saga-fanfare milestone (spec: "care 50!") is an item at Legendary care, loot.js CARE milestone 50.
  const FANFARE = 50;
  const fanfare = (account) => Object.values(account?.gear?.care || {}).some((r) => (r?.milestones || []).includes(FANFARE));
  // What the close button needs (W9.6 wiring, loop 1a17c4b14f2): each ending with its gate and its price, said before
  // the player chooses, because a close can't be undone. "declared" stays Mala's to pass; the player unlocks by play.
  function view(account) {
    const sagas = shape(account), act = sagas.active, past = sagas.past.slice().reverse();
    if (!act) return { open: false, past, how: "No saga open. Your first kept vow or newly claimed node opens one." };
    const now = totals(account), was = act.opened || {};
    const since = { graduations: now.graduations - (was.graduations || 0), deaths: now.deaths - (was.deaths || 0), equations: now.equations - (was.equations || 0) };
    const gate = canClose(account, { milestone: fanfare(account) });
    const locked = gate.ok ? "" : "Endings unlock when you graduate a school or raise an item to Legendary care.";
    const disc = account?.discoveries || 0, grads = (account?.graduations || []).length, nodes = (account?.ownedNodes || []).length;
    const gl = locked || (account?.sealed ? "Already sealed." : grads < GL.RULES.schoolsNeeded ? `Needs ${GL.RULES.schoolsNeeded} graduations (you hold ${grads}).` : "");
    const endings = [
      { id: "SETTLED", name: "Settle", ok: !locked, why: locked, price: `You keep ${Math.floor(disc * RULES.settledFraction)} of ${disc} Discoveries. No star, no heirloom.` },
      { id: "GATELESS", name: "GateLess", ok: !gl, why: gl, price: `All ${nodes} owned nodes are sealed: kept on record, unusable. You may name a star from your equations and carry one heirloom, and you wear the title GATELESS.` },
      { id: "FALLEN", name: "Retire as fallen", ok: !locked, why: locked, price: `Your sin marks weigh the estate, and Discoveries go to 0 (${disc} now). Your nodes stay.` },
    ];
    return { open: true, id: act.id, battles: act.battles, since, unlocked: gate.ok, reasons: gate.reasons, endings, past,
      after: "Every ending clears your sin marks and returns school keys to your home school. Titles and stars stay." };
  }
  return { RULES, open, progress, canClose, close, view };
});
