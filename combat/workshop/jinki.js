"use strict";
// Jinki: the soul in the beloved object (Muse, Jinki build J1;
// SPEC: muse-jinki-ascension ASCENSION.md, muse-jinki-care JC2).
// Reads the care biography loot.js writes (gear.care) and wakes what
// love put there: at care 10 the soul stirs (kind set by ORIGIN rarity,
// recorded at first care); at 20 and 50 the item ASCENDS a rarity step —
// trash is a legend that hasn't been loved yet. Ascension is forever:
// the override lives in gear.ascended, durability refills to the new
// max, sell value and smith fees recompute, passives stay frozen.
// Pure store + functions; cues and saga lines ride resolution events
// the caller plays (tracks.js cue contract; wiring loop 1a17cd807b9).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../account/items-data.js"));
  else root.ConceptCombatJinki = factory(root.ConceptCombatItems);
})(typeof self !== "undefined" ? self : this, function (I) {
  const LADDER = ["common", "uncommon", "rare", "legendary"];
  const KINDS = { common: "humble", uncommon: "steadfast", rare: "noble", legendary: "mythic", mythic: "mythic" };
  const AWAKEN_AT = 10, PROMOTE_AT = [20, 50];
  // Soul gifts (J5; chains J6): the beloved object doesn't hit harder —
  // it teaches. Each kind grants three beats: a trick at I (automatic),
  // a verb at II (free, once a turn), a technique at III (free, once a
  // battle). Gifts are small fixed beats (J6): the J5 frozen-passives thesis
  // was superseded, so a gift may add +1 move or a faster ultimate charge,
  // but born stats stay unchanged. inject: merged into battle passives
  // by loot.js (Mul keys multiply, the rest sum, like gear passives).
  const GIFTS = {
    humble: { name: "Breakfall", does: "the first fall each battle lands on its feet, unhurt", inject: () => ({ humbleGift: 1 }), verb: "shortFlight", tech: "soaringStrike" },
    steadfast: { name: "Long Stride", does: "+1 move each turn", inject: () => ({ moveBudgetAdd: 1 }), verb: "root", tech: "landslide" },
    noble: { name: "Inspire", does: "starts each battle with +1 Inspiration", inject: () => ({ nobleGift: 1 }), verb: "rally", tech: "coronation" },
    mythic: { name: "Living Saga", does: "the ultimate charges ×1.2 faster", inject: () => ({ ultimateChargeMul: 1.2 }), verb: "plotTwist", tech: "refuseEnding" },
  };
  const NUMERALS = [null, "I", "II", "III"];
  const ART_NAMES = { shortFlight: "Short Flight", soaringStrike: "Soaring Strike", root: "Root", landslide: "Landslide", rally: "Rally", coronation: "Coronation", plotTwist: "Plot Twist", refuseEnding: "Refuse the Ending" };   // content.js names, for the card line
  const tierOf = (score) => (score >= 50 ? 3 : score >= 20 ? 2 : score >= 10 ? 1 : 0);
  // The gift an item carries into battle, or null while soulless —
  // worn-out and unequipped gear never reach here (passives() skips it).
  function giftsFor(account, id) {
    const r = account?.gear?.care?.[id];
    const kind = r?.soul?.kind, gift = GIFTS[kind], tier = tierOf(scoreOf(r));
    if (!gift || tier < 1) return null;
    return { kind, tier, name: gift.name, inject: gift.inject() };
  }
  function giftLine(account, id) {
    const g = giftsFor(account, id);
    // The card says what the gift does, and what the next tiers bring (J5 return item 3, landed by Pantry).
    if (!g) return null;
    const G = GIFTS[g.kind] || Object.values(GIFTS).find((x) => x.name === g.name), name = (id) => ART_NAMES[id] || id;
    const more = G ? [g.tier >= 2 ? `verb ${name(G.verb)} (free, once a turn)` : `at II: ${name(G.verb)}`, g.tier >= 3 ? `technique ${name(G.tech)} (free, once a battle)` : `at III: ${name(G.tech)}`].join("; ") : "";
    return `Gift: ${g.name} ${NUMERALS[g.tier]}: ${G?.does || ""}.${more ? ` ${more[0].toUpperCase()}${more.slice(1)}.` : ""}`;
  }
  // One soul at a time (D55, pre-screen cap): the CHOSEN soul speaks when it
  // is awake (account.gear.speaking, Active Jinki J1), otherwise the strongest
  // soul speaks — highest tier, then highest score, then first equipped. Soul Choir (the
  // perk) holds the strongest soul of EACH kind — same-kind gifts never
  // stack, so every gift is capped per wearer. Returns arts {[kind]: tier}
  // for readers, the merged trick inject for passives(), and held item ids
  // for the card's dormant lines.
  function activeGifts(account, equippedIds) {
    const choir = (account?.perks?.soulChoir || 0) > 0;
    const hale = (id) => (account?.gear?.durability?.[id] ?? 1) > 0 && !(account?.museum?.placed || []).includes(id);   // worn-out gifts sleep (mirrors loot worn); an enshrined soul rests in the Museum
    const awake = (equippedIds || []).filter(hale).map((id) => ({ id, g: giftsFor(account, id), score: scoreOf(account?.gear?.care?.[id]) }))
      .filter((x) => x.g)
      .sort((x, y) => y.g.tier - x.g.tier || y.score - x.score);
    // The player's choice (account.gear.speaking, an item id or null = the rule above): a chosen soul that is awake goes first, so it is the one that speaks, or, under the
    // Choir, the one that wins its own kind (the other kinds still take their strongest). One that cannot speak (not worn, worn out, not awakened) changes nothing.
    const chosen = awake.findIndex((x) => x.id === account?.gear?.speaking);
    if (chosen > 0) awake.unshift(awake.splice(chosen, 1)[0]);
    const perKind = new Map();   // awake runs strongest-first: the first of each kind wins, seconds never stack
    for (const x of awake) if (!perKind.has(x.g.kind)) perKind.set(x.g.kind, x);
    const held = choir ? [...perKind.values()] : awake.slice(0, 1);
    const arts = {}, inject = {}, ids = [];
    for (const x of held) {
      arts[x.g.kind] = Math.max(arts[x.g.kind] || 0, x.g.tier);
      ids.push(x.id);
      for (const [k, v] of Object.entries(x.g.inject)) inject[k] = /Mul$/.test(k) ? (inject[k] ?? 1) * v : (inject[k] ?? 0) + v;
    }
    return { arts, inject, held: ids };
  }
  // Why the chosen soul is not speaking, in one line, or null when there is no choice or it speaks (the Field Kit shows it, J2). `nameOf(id)` is the item's name.
  function restingReason(account, equippedIds, nameOf = (id) => id) {
    const id = account?.gear?.speaking; if (!id) return null;
    if (activeGifts(account, equippedIds).held.includes(id)) return null;
    const name = nameOf(id), because = !(account?.gear?.owned || []).includes(id) ? "it is no longer yours" : (account?.museum?.placed || []).includes(id) ? "it is in the Museum" : !giftsFor(account, id) ? "it has not awakened" : !(equippedIds || []).includes(id) ? "put it on to hear it" : "it is worn out: repair it to hear it";
    return `Your chosen soul, ${name}, is resting: ${because}.`;
  }
  // "Breakfall II": the gift a soul lends, as the round-1 line and the Souls strip name it.
  const giftName = (account, id) => { const g = giftsFor(account, id); return g ? `${g.name} ${NUMERALS[g.tier]}` : null; };
  // Ability ids the soul lends this battle: the verb at II, the
  // technique at III. Read by abilitiesOf (engine.js).
  function artIds(arts) {
    const out = [];
    for (const [kind, tier] of Object.entries(arts || {})) {
      if (tier >= 2 && GIFTS[kind]) out.push(GIFTS[kind].verb);
      if (tier >= 3 && GIFTS[kind]) out.push(GIFTS[kind].tech);
    }
    return out;
  }
  // Mirrors loot.js careScore (battles + repairs + 2×cherishes + dupMends):
  // the Jinki build reads the biography, never rewrites the weights.
  const scoreOf = (r) => (r ? (r.battles || 0) + (r.repairs || 0) + 2 * (r.cherishes || 0) + (r.dupMends || 0) : 0);
  const stepOf = (rarity) => Math.max(0, LADDER.indexOf(rarity));
  const kindOf = (record) => KINDS[record?.origin] || "humble";
  // Origin stamps ONCE, at first care — the soul's shape is where the
  // object STARTED, not where love carried it. Mythic-born (future
  // Ramayana flag) descends; it never climbs.
  function ensureOrigin(record, baseRarity, isMythic) {
    if (record.origin != null) return record;
    return { ...record, origin: isMythic ? "mythic" : (baseRarity || "common") };
  }
  const rarityOf = (account, id, base) => account?.gear?.ascended?.[id] || base;
  const baseOf = (id) => (I && I.equipment[id]) || null;

  function awaken(account, id, record) {
    const r = record || account?.gear?.care?.[id];
    if (!r || r.soul || scoreOf(r) < AWAKEN_AT) return { account, event: null };
    const kind = kindOf(r), it = baseOf(id);
    const soul = { kind, at: scoreOf(r) };
    const a = { ...account, gear: { ...account.gear, care: { ...account.gear.care, [id]: { ...r, soul } } } };
    return { account: a, event: { type: "awaken", id, kind, soul,
      cue: "awaken-anthem", saga: `${it ? it.name : id} wakes — the ${kind} soul stirs.` } };
  }
  // Promotion is earned in STEPS: the 20-milestone allows one step above
  // birth rarity, the 50-milestone two. Legendary caps (a fifth tier
  // never mints); mythic-born never climbs; love never downgrades.
  function promote(account, id, record) {
    const r = record || account?.gear?.care?.[id];
    const it = baseOf(id);
    if (!r || !it) return { account, event: null };
    if (r.origin === "mythic") return { account, event: null };
    const base = it.rarity, now = rarityOf(account, id, base);
    const allowed = (r.milestones || []).includes(50) ? 2 : (r.milestones || []).includes(20) ? 1 : 0;
    const taken = stepOf(now) - stepOf(base);
    if (allowed <= taken) return { account, event: null };
    const to = LADDER[Math.min(LADDER.length - 1, stepOf(now) + 1)];
    if (to === now) return { account, event: null };   // at the top: saga and aura only, never a fifth tier
    const max = I.rarities[to].durability;
    const a = { ...account, gear: { ...account.gear,
      ascended: { ...(account.gear.ascended || {}), [id]: to },
      durability: { ...account.gear.durability, [id]: max } } };
    return { account: a, event: { type: "promote", id, from: now, to, kind: kindOf(r),
      cue: "ascension-crescendo", saga: `${it.name} ascends to ${to} — the ${kindOf(r)} soul rises.` } };
  }
  // Play descriptors for resolution events (tracks.js cue shapes):
  // the anthem/crescendo slot, the soul-kind bed, and a rising pitch
  // step — a wake-and-climb in one call sounds the climb.
  function cues(events, mixes) {
    return (events || []).filter((e) => e && e.cue).map((e, i) => {
      const mix = mixes?.[e.id];
      return { slot: e.cue, opts: { kind: e.kind || null, pitchStep: i, ...(mix && mix !== "base" ? { mix } : {}) } };
    });
  }
  // One call after any care write (tend, cherish, battle, inherit):
  // stamp the origin, wake the soul, climb what's earned. Events carry
  // cue + kind bed + saga line for the caller to play.
  function check(account, id) {
    const it = baseOf(id);
    if (!it) return { account, events: [] };
    let a = account; const events = [];
    const raw = a?.gear?.care?.[id];
    if (raw && raw.origin == null) {
      const stamped = ensureOrigin(raw, it.rarity, !!it.mythic);
      a = { ...a, gear: { ...a.gear, care: { ...a.gear.care, [id]: stamped } } };
    }
    let r = awaken(a, id); a = r.account; if (r.event) events.push(r.event);
    for (let i = 0; i < LADDER.length; i++) {   // settle every earned step: a 19→51 jump climbs twice, not once
      r = promote(a, id); a = r.account; if (!r.event) break; events.push(r.event);
    }
    return { account: a, events };
  }
  return { LADDER, KINDS, AWAKEN_AT, PROMOTE_AT, GIFTS, tierOf, giftsFor, giftLine, activeGifts, restingReason, giftName, artIds, scoreOf, stepOf, kindOf, ensureOrigin, rarityOf, awaken, promote, check, cues };
});
