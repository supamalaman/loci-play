"use strict";
// Vows (Mala, 2026-10-08): "Right now we mostly use AP as a currency for efficacy in techniques, but maybe to modify
// conditions we should have drop down menus that give options for vows and restrictions. Lets start with Auras and
// Dreams, but I'd really like more dials on techniques as well."
//
// A vow = one BOON bought with up to two RESTRICTIONS. Each boon has a price; each restriction is worth something; the
// restrictions must cover the price. Restrictions hold while the thing you swore on lasts (the aura, the dream), except
// one-off costs (paid at once) and Burned Bridge (the rest of the battle). Sworn restrictions are enforced: the engine
// refuses actions that would break them. Being FORCED to break one (knocked off a Rooted spot) breaks the vow: the boon
// ends and you lose 25 AP.
//
//   options(target)                       → { boons, restrictions } for the dropdowns ("aura" | "dream" | "imbue"; techniques next)
//   validate(target, vow)                 → reason | null          vow = { boon, restrictions: [ids] }
//   swear(s, a, target, vow, H)           applies one-off costs, records the vow, returns the boon's effect for the caller
//   refuses(s, a, kind, ability?)         → reason | null   kind: "move" | "guard" | "ability"
//   turnStart(s, a, H)                    ends vows whose source ended; Spent Tomorrow; Rooted breach check
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatVows = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const BOONS = {
    widerRing:   { for: ["aura"], name: "Wider Ring", price: 1, text: "The aura reaches 1 tile farther (radius 3).", effect: { radiusAdd: 1 } },
    slowBurn:    { for: ["aura"], name: "Slow Burn", price: 1, text: "The aura drains 5 a turn instead of 10.", effect: { drain: 5 } },
    intensify:   { for: ["aura", "imbue"], name: "Intensify", price: 2, text: "The aura's effect is 50% stronger.", effect: { power: 1.5 } },
    secondPulse: { for: ["imbue"], name: "Second Pulse", price: 3, text: "The imbued dream holds one more turn: two field-wide pulses before it ends.", effect: { pulses: 2 } },
    steadyDream: { for: ["dream"], name: "Steady Dream", price: 2, text: "The dream drains 10 less each turn: it holds longer.", effect: { drainLess: 10 } },
    earlyDream:  { for: ["dream"], name: "Early Dream", price: 3, text: "Open the dream with 25 less ultimate charge than it would need.", effect: { openLess: 25 } },
    // The Actor's three (Mala, 2026-10-16; docs/actor-respec-rulings.md): sworn on the audition, read while the part plays.
    stayInCharacter: { for: ["role"], name: "Stay in Character", price: 1, text: "The run holds one turn longer.", effect: { rolePlus: 1 } },
    stealTheScene:   { for: ["role"], name: "Steal the Scene", price: 2, text: "The Look lands 15% more often and Typecast counts one stack higher.", effect: { lookBonus: 0.15, typecastPlus: 1 } },
    showMustGoOn:    { for: ["role"], name: "The Show Must Go On", price: 2, text: "Each turn the part plays opens behind a 4-LF ward: perform through the pain.", effect: { roleWard: 4 } },
    // Technique stances (Muse-2, 2026-10-21): sworn as their own free action, read on every cast until the end of the
    // next turn. The "dials on techniques" Mala asked for when vows were built.
    farShot:      { for: ["technique"], name: "Far Shot", price: 1, text: "Your techniques reach 1 farther until the end of your next turn.", effect: { rangeAdd: 1, stanceTurns: 1 } },
    heavyHands:   { for: ["technique"], name: "Heavy Hands", price: 1, text: "Your techniques hit +2 potency until the end of your next turn.", effect: { potencyAdd: 2, stanceTurns: 1 } },
    piercingOath: { for: ["technique"], name: "Piercing Oath", price: 2, text: "Your techniques gain piercing until the end of your next turn.", effect: { piercing: true, stanceTurns: 1 } },
    // Rama's word (Mala, 2026-10-24; docs/rama-build.md): sworn once a battle by a character who keeps one (swearsWord), and it
    // holds the whole battle. Forced to break it, he loses the boon, the usual AP and every point of ultimate charge.
    steadyAim:    { for: ["word"], name: "Steady Aim", price: 1, text: "Your techniques reach 1 farther for the whole battle.", effect: { rangeAdd: 1 } },
    dharmasBow:   { for: ["word"], name: "Dharma's Bow", price: 2, text: "Your techniques hit +3 potency for the whole battle.", effect: { potencyAdd: 3 } },
    ramasName:    { for: ["word"], name: "Rama's Name", price: 3, text: "Your techniques reach 1 farther and hit +3 potency for the whole battle.", effect: { rangeAdd: 1, potencyAdd: 3 } },
  };
  const RESTRICTIONS = {
    rooted:        { name: "Rooted", worth: 2, text: "You can't move, jump or climb while it lasts. Being forced off your spot breaks the vow.", lasts: "while" },
    singleMind:    { name: "Single Mind", worth: 1, text: "Only techniques of your primary concept while it lasts.", lasts: "while" },
    openGuard:     { name: "Open Guard", worth: 1, text: "You can't Guard while it lasts.", lasts: "while" },
    bloodPrice:    { name: "Blood Price", worth: 1, text: "Pay 15% of your max LF now.", lasts: "once" },
    spentTomorrow: { name: "Spent Tomorrow", worth: 1, text: "Your next turn starts with 30 fewer AP.", lasts: "once" },
    burnedBridge:  { name: "Burned Bridge", worth: 2, text: "No ultimate techniques for the rest of this battle.", lasts: "battle" },
  };
  const MAX_RESTRICTIONS = 2, BREACH_AP = 25;

  const options = (target) => ({
    boons: Object.entries(BOONS).filter(([, b]) => b.for.includes(target)).map(([id, b]) => ({ id, ...b })),
    restrictions: Object.entries(RESTRICTIONS).map(([id, r]) => ({ id, ...r })),
  });
  const worth = (ids) => (ids || []).reduce((n, id) => n + (RESTRICTIONS[id]?.worth || 0), 0);
  // Inspiration (Mala, 2026-10-12): a vow's price can be paid in Inspiration instead of taking a restriction, one point
  // of price per point spent (rules.inspiration.vowPoint). Whole points, no debt, nothing back for overpaying.
  // vow.inspiration = points offered; `a` is the one swearing, R = s.rules.inspiration.
  const paid = (vow, R) => Math.max(0, Math.floor(vow?.inspiration || 0)) * (R?.vowPoint ?? 1);
  function validate(target, vow, a = null, R = null, S = null) {
    if (!vow || !vow.boon) return null;   // no vow is always fine
    const b = BOONS[vow.boon];
    if (!b || !b.for.includes(target)) return "That boon can't be sworn on this.";
    const price = Math.max(1, b.price - (S?.dreamSpace ? 1 : 0));   // dreams ease oaths (Muse-2: the dream seam)
    const rs = (vow.restrictions || []).filter(Boolean);
    if (rs.length > MAX_RESTRICTIONS) return `At most ${MAX_RESTRICTIONS} restrictions.`;
    if (new Set(rs).size !== rs.length) return "Each restriction can be sworn once.";
    if (rs.some((id) => !RESTRICTIONS[id])) return "Unknown restriction.";
    const n = Math.max(0, Math.floor(vow.inspiration || 0));
    if (n && !R) return "Inspiration cannot pay for this.";
    if (n > (a?.inspiration || 0)) return `That takes ${n} Inspiration; you have ${a?.inspiration || 0}.`;
    if (n && paid({ inspiration: n - 1 }, R) + worth(rs) >= price) return `${b.name} costs ${price}: that is more Inspiration than it needs.}`;
    if (worth(rs) + paid(vow, R) < price) return n ? `${b.name} costs ${price}; your restrictions and Inspiration cover ${worth(rs) + paid(vow, R)}.` : `${b.name} costs ${price}; your restrictions are worth ${worth(rs)}.`;
    return null;
  }

  function swear(s, a, target, vow, H) {
    if (!vow?.boon) return null;
    const b = BOONS[vow.boon], rs = (vow.restrictions || []).filter(Boolean);
    a.vows ||= [];
    (s.declarations ||= []).push({ actor: a.id, on: target, boon: vow.boon, round: s.round, consent: !!vow.consent });   // W4.4: the declaration ledger (Collective Promise reads this; W4.6: AI declarations consent)
    a.vows.push({ on: target, boon: vow.boon, consent: !!vow.consent, restrictions: rs.filter((id) => RESTRICTIONS[id].lasts === "while"), at: [a.x, a.y], round: s.round,
      ...(target === "technique" ? { untilTurn: a.ownerTurns + (b.effect.stanceTurns ?? 1) } : {}) });
    for (const id of rs) {
      if (id === "bloodPrice") { const pay = Math.round(a.maxLF * 0.15); a.lf = Math.max(1, a.lf - pay); }
      if (id === "spentTomorrow") a.vowApTax = (a.vowApTax || 0) + 30;
      if (id === "burnedBridge") a.burnedBridge = true;
    }
    const n = Math.max(0, Math.floor(vow.inspiration || 0)); if (n) a.inspiration = Math.max(0, (a.inspiration || 0) - n);
    const bound = rs.length ? `bound by ${rs.map((id) => RESTRICTIONS[id].name).join(" and ")}` : "bound by nothing";
    H.log(s, { kind: "vow", actor: a.id, inspiration: n, text: `${a.name} swears a vow: ${b.name}, ${bound}${n ? `, paid with ${n} Inspiration (${a.inspiration} left)` : ""}.`,
      why: [b.text, ...rs.map((id) => `${RESTRICTIONS[id].name}: ${RESTRICTIONS[id].text}`), ...(n ? [`Inspiration pays ${n} of the price in place of a restriction.`] : [])] });
    return b.effect;
  }

  const sourceLasts = (s, a, v) => v.on === "aura" ? !!a.aura && !a.aura.imbued
    : v.on === "imbue" ? !!a.aura?.imbued
    : v.on === "dream" ? s.dreamSpace?.owner === a.id
    : v.on === "technique" ? (v.untilTurn ?? -1) >= a.ownerTurns
    : v.on === "role" ? !!a.role
    : v.on === "word" ? true : false;   // a word holds until it is broken
  const live = (s, a) => (a.vows || []).filter((v) => sourceLasts(s, a, v));
  const holds = (s, a, id) => live(s, a).some((v) => v.restrictions.includes(id));
  // Merged technique-stance boons, for manifest: ranges and potencies add across stances, piercing needs one oath.
  const techBoon = (s, a) => {
    const stances = live(s, a).filter((v) => v.on === "technique" || v.on === "word");
    if (!stances.length) return null;
    const out = { rangeAdd: 0, potencyAdd: 0, piercing: false, names: [] };
    for (const v of stances) { const e = BOONS[v.boon]?.effect || {}; out.rangeAdd += e.rangeAdd || 0; out.potencyAdd += e.potencyAdd || 0; out.piercing ||= !!e.piercing; out.names.push(BOONS[v.boon]?.name || v.boon); }
    return out;
  };

  function refuses(s, a, kind, ability = null) {
    if (!a) return null;
    if (kind === "move" && holds(s, a, "rooted")) return "You swore Rooted: you can't move while the vow lasts.";
    if (kind === "guard" && holds(s, a, "openGuard")) return "You swore Open Guard: no Guard while the vow lasts.";
    if (kind === "ability" && ability) {
      if (a.burnedBridge && ability.tier === "ultimate") return "You swore Burned Bridge: no ultimates this battle.";
      if (holds(s, a, "singleMind") && !(ability.concepts || []).includes(a.primary)) return "You swore Single Mind: only techniques of your primary concept.";
    }
    return null;
  }

  function turnStart(s, a, H) {
    if (a.vowApTax) {
      const lost = Math.min(a.tempo, a.vowApTax); a.tempo -= lost; a.vowApTax = 0;
      H.log(s, { kind: "vow", actor: a.id, text: `Spent Tomorrow: ${a.name} starts the turn ${lost} AP short.` });
    }
    if (!a.vows?.length) return;
    for (const v of live(s, a)) if (v.restrictions.includes("rooted") && (a.x !== v.at[0] || a.y !== v.at[1])) {
      v.broken = true; a.tempo = Math.max(0, a.tempo - BREACH_AP);
      if (v.on === "word") a.ultimateCharge = 0;   // a broken word costs more than a kept one: his ultimate goes with it
      if (v.on === "aura" || v.on === "imbue") { if (a.aura) { delete a.aura.radiusAdd; delete a.aura.drain; delete a.aura.power; delete a.aura.powerWhile; delete a.aura.rechargeMul; } }   // a breach strips every knob, a trait's (Consecrated) included
      if (v.on === "dream" && s.dreamSpace && v.drainBefore != null) s.dreamSpace.drain = v.drainBefore;
      H.log(s, { kind: "vow", actor: a.id, text: `${a.name} was forced off the Rooted spot: the vow breaks. ${BOONS[v.boon].name} ends and ${a.name} loses ${BREACH_AP} AP${v.on === "word" ? " and all ultimate charge (a broken word)" : ""}.` });
    }
    const kept = [];
    for (const v of a.vows) {   // kept and broken vows certify here (W6.1, W4.4); battle end reads these plus the live records
      if (v.broken) (s.vowsBroken ||= []).push({ actor: a.id, round: v.round, consent: !!v.consent });
      else if (!sourceLasts(s, a, v) && a.side === "player") { kept.push(v); (s.vowsKept ||= []).push({ actor: a.id, round: v.round, consent: !!v.consent }); }   // round: when it was sworn (the stipend reads it)
    }
    if (kept.length) H.log(s, { kind: "vow", actor: a.id, text: `${a.name} kept the vow${kept.length === 1 ? "" : "s"}: a discovery earned.` });
    a.vows = a.vows.filter((v) => !v.broken && sourceLasts(s, a, v));
  }

  return { BOONS, RESTRICTIONS, MAX_RESTRICTIONS, BREACH_AP, options, worth, validate, swear, refuses, turnStart, live, techBoon };
});
