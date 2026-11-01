"use strict";
// Gaia's regard (Mala via Muse, 2026-10-10): communing with nature builds a standing with Gaia that
// persists on the account; high standing grants boons at the start of a battle.
//
// This is the FRAMEWORK. The tier names, the lines Gaia speaks and the boon table below are STUB content:
// Mala's nature document replaces `tiers[].line` and `boons` (same shapes) and nothing else changes.
// Pure functions, no storage; the account object carries `gaia` and is saved by whoever owns the account.
//
//   create()                              → { standing, communed, battles, last }
//   of(account)                           → the account's gaia state (created if missing)
//   tierOf(standing)                      → { index, id, name, at, next, toNext, line }
//   battleDelta(events)                   → { delta, lines }   events: { communed, studied, failed, warnings, summons, plantsFelled, communedLost }
//   settle(account, events)               → { account, delta, before, after, tierChanged, lines }
//   boonsFor(standing)                    → [boon, ...] every boon earned so far (they stack)
//   battleOptions(standing)               → [{ kind, ... }] to pass to the engine as opts.gaiaBoons
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatGaiaBond = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const rules = {
    min: 0, max: 100,
    gain: { communed: 4, studied: 1 },                           // a plant that answered; a plant known well enough to answer
    // Gaia noticed the earthmoving; Gaia came; a plant destroyed by your side; a communed plant that died in the fight.
    // communedLost is deliberately MORE than gain.communed (Mala, 2026-10-10): a plant brought into the world to die is
    // an insult, so communing and then losing it leaves you worse off with her than never asking (4 - 7 = -3).
    loss: { failed: 0, warning: 3, summon: 8, plantFelled: 1, communedLost: 7 },
    maxGainPerBattle: 10, maxLossPerBattle: 15,
    // Which Gaia looks back at you on the account screen: the Wounded Ground until this tier, the Living Accord from it on.
    portrait: { accordFrom: "welcomed", accord: "gaia-accord", wounded: "gaia-wounded" },
  };
  const tiers = [
    { id: "stranger", name: "Stranger", at: 0, line: "The ground does not know you yet." },
    { id: "noticed", name: "Noticed", at: 15, line: "Something in the green has started to watch you kindly." },
    { id: "welcomed", name: "Welcomed", at: 35, line: "The plants lean toward you when you pass." },
    { id: "trusted", name: "Trusted", at: 60, line: "Gaia lets you speak for the ground." },
    { id: "kin", name: "Kin", at: 85, line: "You are counted among the living things here." },
  ];
  // kind: natureTrait (a trait for the battle; these stack across tiers) · tempBuff (a start-of-battle
  // bonus that lasts this battle only) · factionAlly (the nearest plant starts the battle communed).
  const boons = [
    { id: "sureFooted", tier: "noticed", kind: "natureTrait", trait: "hiker", name: "Sure-footed", text: "You walk through planting as a hiker does: no extra action points." },
    { id: "morningDew", tier: "welcomed", kind: "tempBuff", buff: { maxLFAdd: 6 }, name: "Morning Dew", text: "+6 maximum LF for this battle." },
    { id: "greenTongue", tier: "welcomed", kind: "natureTrait", passive: { communePhiDiscount: 2 }, name: "Green Tongue", text: "Communing with a plant costs 2 less ΦF." },
    { id: "groundSpeaks", tier: "trusted", kind: "factionAlly", name: "The Ground Speaks", text: "The nearest plant begins the battle already communed, at no cost." },
    { id: "deepRoots", tier: "trusted", kind: "natureTrait", passive: { communeHpMul: 1.25 }, name: "Deep Roots", text: "Plants that answer you have 25% more LF." },
    { id: "firstLight", tier: "kin", kind: "tempBuff", buff: { startingUltimateCharge: 15 }, name: "First Light", text: "Begin the battle with 15 ultimate charge." },
  ];
  const clamp = (n) => Math.max(rules.min, Math.min(rules.max, Math.round(n)));

  function create() { return { standing: 0, communed: 0, battles: 0, last: null }; }
  function of(account) { const g = account && account.gaia; return g && Number.isFinite(g.standing) ? { ...create(), ...g, standing: clamp(g.standing) } : create(); }
  function tierOf(standing = 0) {
    let index = 0; for (let i = 0; i < tiers.length; i++) if (standing >= tiers[i].at) index = i;
    const t = tiers[index], next = tiers[index + 1] || null;
    return { index, id: t.id, name: t.name, at: t.at, line: t.line, next: next ? next.name : null, toNext: next ? next.at - standing : 0 };
  }
  function battleDelta(ev = {}) {
    const n = (k) => Math.max(0, ev[k] || 0), lines = [];
    const gain = Math.min(rules.maxGainPerBattle, n("communed") * rules.gain.communed + n("studied") * rules.gain.studied);
    const loss = Math.min(rules.maxLossPerBattle, n("warnings") * rules.loss.warning + n("summons") * rules.loss.summon + n("plantsFelled") * rules.loss.plantFelled + n("failed") * rules.loss.failed + n("communedLost") * rules.loss.communedLost);
    if (n("communed")) lines.push(`${n("communed")} plant${n("communed") === 1 ? "" : "s"} answered you`);
    if (n("studied")) lines.push(`${n("studied")} plant${n("studied") === 1 ? "" : "s"} studied closely`);
    if (n("warnings")) lines.push("Gaia noticed the earthmoving");
    if (n("summons")) lines.push("Gaia was driven to come herself");
    if (n("communedLost")) lines.push(`${n("communedLost")} plant${n("communedLost") === 1 ? "" : "s"} you called out died fighting for you`);
    if (n("plantsFelled")) lines.push(`${n("plantsFelled")} plant${n("plantsFelled") === 1 ? "" : "s"} destroyed by your side`);
    return { delta: gain - loss, gain, loss, lines };
  }
  function settle(account, ev = {}) {
    const g = of(account), d = battleDelta(ev), before = g.standing, after = clamp(before + d.delta);
    const a = tierOf(before), b = tierOf(after);
    const next = { ...g, standing: after, communed: g.communed + Math.max(0, ev.communed || 0), battles: g.battles + 1, last: { delta: after - before, lines: d.lines } };
    const lines = after !== before ? [`Gaia's regard ${after > before ? "+" : "−"}${Math.abs(after - before)} (${after}/${rules.max}): ${d.lines.join("; ")}`] : [];
    if (b.index !== a.index) lines.push(b.index > a.index ? `Gaia's regard: ${b.name}. ${b.line}` : `Gaia's regard has fallen to ${b.name}.`);
    return { account: { ...account, gaia: next }, delta: after - before, before, after, tierChanged: b.index !== a.index, lines };
  }
  function boonsFor(standing = 0) {
    const reach = tierOf(standing).index;
    return boons.filter((b) => tiers.findIndex((t) => t.id === b.tier) <= reach);
  }
  // What the engine needs: one entry per boon, nothing presentational.
  function battleOptions(standing = 0) {
    return boonsFor(standing).map((b) => ({ id: b.id, kind: b.kind, name: b.name, ...(b.trait ? { trait: b.trait } : {}), ...(b.passive ? { passive: { ...b.passive } } : {}), ...(b.buff ? { buff: { ...b.buff } } : {}) }));
  }
  // Tally one finished battle from the engine's state (log kinds are the engine's own).
  function eventsFrom(s) {
    const log = ((s && s.log) || []).filter(e=>e.kind==="observePlant" ? !e.actor||e.actor==="player" : e.kind==="commune" ? !e.target||e.target==="player" : true), count = (k) => log.filter((e) => e.kind === k).length;
    const answered = new Set(log.filter((e) => e.kind === "commune" && !e.gift).map((e) => String(e.tiles && e.tiles[0])));
    const ready = new Set(log.filter((e) => e.kind === "observePlant" && e.ready).map((e) => String(e.tiles && e.tiles[0])));
    for (const k of answered) ready.delete(k);
    // plantsFelled is not tallied yet: the engine's "destroyed" events do not say whose attack felled the plant.
    return { communed: answered.size, studied: ready.size, failed: count("communeFail"), warnings: count("gaiaWarning"), summons: count("gaiaSummon"), plantsFelled: 0, communedLost: count("communeEnd") };
  }

  // portrait(standing) → { sprite, form, name }: her sprite folder and which of her two bodies it is.
  function portrait(standing) {
    const accord = tierOf(standing).index >= tiers.findIndex((t) => t.id === rules.portrait.accordFrom);
    return accord ? { sprite: rules.portrait.accord, form: "restored", name: "Gaia, the Living Accord" } : { sprite: rules.portrait.wounded, form: "disturbed", name: "Gaia, the Wounded Ground" };
  }
  return { rules, tiers, boons, portrait, create, of, tierOf, battleDelta, settle, boonsFor, battleOptions, eventsFrom };
});
