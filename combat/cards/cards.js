"use strict";
// Battle Cards, slice C0 (specs/CARDS.md sections 1, 2.4, 5, 15, 17): the pure rules over cards-data.js. No battle code lives
// here (that is C1, engine/cards.js); nothing here reads a battle state or a random number.
//
//   payload(card) / price(card)   effect points, then the deck cost (section 5.1); a test fails when a stored cost differs
//   copiesFor(card)               deck copies: 2 when the cost is 3 or less, else 1 (section 5.2)
//   textOf(card)                  the rule text, generated from the data and never typed (section 1.1)
//   needs(card)                   the condition's text alone (the drawer's "Needs: ..." reason, engine/cards.js)
//   contactsOf(card)              every system the card touches: its own rows plus the auto rows of its kind and effects (section 17)
//   problems(card)                what is wrong with a card's data (empty = a card may ship live)
//   liveCards() / byId(id)        the cards a deck may hold: status live, kind live, no problems (no phantom cards)
//   capFor({ level, fame, cardsharp })   the deck points cap (section 2.3)
//   validate(deck, { owned, cap })       { ok, errors, points, legal } for a list of card ids (section 2.4)
// The closed lists (kinds, conditions, effect menu, rules) are data in cards-data.js: no number is typed here.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./cards-data.js"));
  else root.ConceptCombatCards = factory(root.ConceptCombatCardsData);
})(typeof self !== "undefined" ? self : this, function (D) {
  const rules = D.rules, ceil = Math.ceil, max = Math.max, round6 = (x) => Math.round(x * 1e6) / 1e6, up = (x) => ceil(x - 1e-9);

  // The systems a card may name in `contacts` (section 11 ids, 17 and 18.8; typos fail `problems`).
  const CONTACT_SYSTEMS = ["once-per-battle", "consumables-pack", "field-kit", "account-save", "test-battles", "loadouts", "mystery", "scribing", "summons", "states",
    "terrain-climate-dream", "film-astral", "response-window", "ai", "enemy-loadouts", "loot-relics", "mint", "grapple", "observe-insight", "parley-valence", "fame",
    "contracts-bingo", "codex-library", "lab-crafting-cooking", "ui-patterns", "secret-fights", "kaiba", "widened-perks", "shop-keeper", "belief-awakening", "vows",
    "dream-space", "auras", "true-forms", "stealth", "wild-creatures", "classes", "landscape-lexicon", "ap-tempo", "civilians", "companions"];
  // A card with this effect must name this contact (section 15 item 3).
  const REQUIRED = { push: "grapple", root: "grapple", familiar: "summons", reveal: "observe-insight" };

  // Effect points (section 1.3). The ratios are the `rules.points` data; the shapes are the scribing component table.
  const P = rules.points;
  const E = {
    damage: (e) => max(P.damageMin, ceil(e.potency / P.damagePer)), push: () => P.push, stagger: () => P.stagger, ward: (e) => ceil(e.protection / P.wardPer),
    root: (e) => (e.turns >= 2 ? P.rootLong : P.rootShort), itemLock: () => P.itemLock, reveal: () => P.reveal, heal: (e) => ceil(e.lf / P.healPer),
    modTaken: (e) => ceil(round6((1 - e.mult) * P.modScale * e.turns / 2)), modDealt: (e) => ceil(round6(Math.abs(e.mult - 1) * P.modScale * e.turns / 2)),
    regen: (e) => ceil(round6(e.lf * e.turns / P.regenPer)), lethalSave: () => P.lethalSave, cardLock: () => P.cardLock,
    // familiar: `bodies` = ONE familiar drawn with several bodies (the Pair of Lanterns): `lf` is the total, priced per body; `count` = separate familiars
    familiar: (e) => ceil(round6(e.lf / (e.bodies || 1) / P.familiarLfPer + e.potency * e.turns / P.familiarPotencyPer)) * (e.bodies || e.count || 1), apGain: (e) => ceil(e.n / P.apGainPer),
  };
  const areaMul = (r) => (r >= 4 ? rules.areaMul.r4 : r === 3 ? rules.areaMul.r3 : rules.areaMul.base);
  function payload(card) {
    let p = card.effects.reduce((n, e) => n + E[e.key](e), 0);
    if (card.kind === "field") p *= areaMul(card.zone.radius);
    return up(p);
  }
  function price(card) {
    const mul = max(rules.floor, rules.conditionMul[card.condition.tier] * (rules.kindMul[card.kind] ?? 1));
    return max(1, up(payload(card) * mul));
  }
  const copiesFor = (card) => (price(card) <= rules.deck.copies.cheapMaxCost ? rules.deck.copies.cheap : rules.deck.copies.dear);

  // ── Rule text, generated (section 1.1) ──
  const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1), plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`, pct = (m) => Math.round(Math.abs(1 - m) * 100);
  function needs(card) {
    const c = card.condition; if (c.id === "none") return "";
    return D.conditions[c.id].text.replace("{n}", c.n).replace("{range}", card.range || rules.foeLfRange).replace("{pct}", Math.round((c.n || 0) * 100));
  }
  function modPhrase(e, third) {
    const s = (a, b) => (third ? a : b);
    if (e.key === "modTaken") return `${s("takes", "take")} ${pct(e.mult)}% less damage`;
    if (e.key === "modDealt") return `${s("deals", "deal")} ${pct(e.mult)}% ${e.mult > 1 ? "more" : "less"} damage`;
    if (e.key === "regen") return `${s("heals", "heal")} ${e.lf} LF at the start of each of ${third ? "its" : "your"} turns`;
    if (e.key === "cardLock") return "cannot play cards";
    return null;
  }
  const needsTail = (card) => (card.condition.id !== "none" ? ` Needs: ${needs(card)}.` : "");
  function textOf(card) {
    const eff = card.effects;
    if (card.kind === "summon") {
      const f = eff.find((e) => e.key === "familiar"), h = eff.find((e) => e.key === "heal"), each = f.count > 1 ? "each " : "";
      const twice = f.bodies > 1 ? " twice" : "";   // one familiar with two bodies acts once per body
      const act = f.mode === "strike" ? `${each}strikes for ${f.potency}${twice} on its turns` : `${each}wards an ally (or you, if alone) for ${f.potency}${twice} on its turns`;
      let t = f.bodies > 1 ? `Call a familiar with two bodies: ${f.lf} LF in all, ${f.turns} turns, ${act}.` : `Call ${f.count > 1 ? f.count + " familiars" : "a familiar"}: ${f.lf} LF${f.count > 1 ? " each" : ""}, ${f.turns} turns, ${act}.`;
      if (h) t += ` Heal ${h.lf} LF.`;
      t += ` A Warden or a full believer calls it +${rules.familiar.thematicLf} LF and +${rules.familiar.thematicTurns} turn${rules.familiar.thematicTurns === 1 ? "" : "s"}.`;   // C3 re-cut: the text names the thematic bonus the engine adds (triage 2026-11-04)
      return t + needsTail(card);
    }
    if (card.kind === "field") {
      const who = card.zone.side === "foes" ? "foes" : "allies";
      const parts = eff.map((e) => modPhrase(e, false)).map((p) => p.replace("each of your turns", "each of their turns"));
      return `For ${card.zone.rounds} rounds, ${who} inside a radius-${card.zone.radius} zone ${parts.join(" and ")}.` + needsTail(card);
    }
    if (card.kind === "equip") {
      const ally = card.equip.target !== "self", subj = ally ? "You or an ally within 3" : "You";
      const parts = eff.filter((e) => e.key !== "lethalSave").map((e) => modPhrase(e, ally));
      let t = `${subj} ${parts.join(" and ")} for ${card.equip.turns} turns`;
      if (card.equip.hurt) t += `; it ends after ${card.equip.hurt} damage`;
      if (eff.some((e) => e.key === "lethalSave")) t += `; while it lasts, once, a blow that would defeat ${ally ? "it" : "you"} leaves ${ally ? "it" : "you"} at 1 LF`;
      return t + "." + needsTail(card);
    }
    const range = card.range || rules.defaultRange;   // instant and set
    let first = !(card.kind === "set" && card.trigger[0] === "onAttacked");
    const foe = [], self = [];
    for (const e of eff) {
      const lead = first; if (["damage", "push", "stagger", "root", "reveal"].includes(e.key) || e.key === "itemLock") first = false;
      if (e.key === "damage") foe.push(lead ? `Deal ${e.potency} ${e.type} damage to a foe within ${range}` : `deal ${e.potency} ${e.type} damage to it`);
      else if (e.key === "push") foe.push(lead ? `Push a foe within ${range} away ${e.tiles} tiles` : `push it away ${e.tiles} tiles`);
      else if (e.key === "stagger") foe.push(lead ? `Stagger a foe within ${range} ${e.ap} AP` : `stagger it ${e.ap} AP`);
      else if (e.key === "root") foe.push(lead ? `Root a foe within ${range} for ${plural(e.turns, "turn")}` : `root it for ${plural(e.turns, "turn")}`);
      else if (e.key === "itemLock") foe.push(`Lock a foe within ${range} out of items for ${plural(e.turns, "turn")}`);
      else if (e.key === "reveal") foe.push(lead ? `Reveal a concealed unit within ${range}` : "reveal it");
      else if (e.key === "ward") self.push(`gain a ward of ${e.protection} for 1 turn`);
      else if (e.key === "heal") self.push(`heal ${e.lf} LF`);
      else if (e.key === "apGain") self.push(`gain ${e.n} AP (up to your maximum)`);
      else throw new Error(`no rule text for effect ${e.key}`);
    }
    const parts = [...foe, ...self];
    let s = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
    let tail = needsTail(card);
    if (card.kind === "set") {
      // an on-attacked set with a "foe within N" condition names the attacker: the condition rides in the trigger, not in a Needs line
      const near = card.trigger[0] === "onAttacked" && card.condition.id === "foeWithin" ? ` within ${card.condition.n}` : "";
      if (near) tail = "";
      const pre = { onAttacked: card.phase === "before" ? `When a foe${near} attacks you, ` : `After a foe${near} hurts you, `, onTurnStart: "At the start of your next turn, ", manual: "On your turn, " }[card.trigger[0]];
      s = pre + s.charAt(0).toLowerCase() + s.slice(1);
    }
    return cap1(s) + "." + tail;
  }

  // ── Contacts (sections 15 and 17): a card's own rows plus the auto rows its kind and effects carry ──
  function contactsOf(card) {
    const r = [], has = (k) => card.effects.some((e) => e.key === k), add = (system, how, auto = true) => { if (!r.some((x) => x.system === system && x.how === how)) r.push({ system, how, auto }); };
    if (has("push") || has("root")) add("grapple", "forced movement of a holder or held unit follows the live rule (a push of the holder breaks the hold); the card never starts a hold");
    if (has("familiar")) add("summons", "shares the palace summon slot; leaves with the text \"fades\"; a Warden or a summon-trait unit gets +4 LF and +1 turn");
    if (has("reveal")) add("observe-insight", "reveals concealment only (not card knowledge: that is the awareness gate, CARDS.md section 18); the card name never enters s.insight");
    if (has("itemLock")) add("consumables-pack", "itemLock is the held-items gate: pack items stop, cards are not items and still play");
    if (card.kind === "set") add("mystery", "stored, triggered, budgeted (3) and expired (2 rounds) by Mystery; public line is the generic face-down text");
    if (card.kind === "field") add("terrain-climate-dream", "zone is s.cardplay.zones, not terrain: no terrain regeneration, no climate change; dreamSame bounds it");
    if (card.kind === "field" || card.kind === "equip") add("states", card.kind === "field" ? "hidden `zone:` row per unit inside, swept at turn start and move end" : "one row in group cardEquip with clock and breaker (check-states)");
    if (has("heal") || has("regen") || has("ward")) add("film-astral", "actor-keyed: the film pocket pauses it, a projected soul has no deck");
    add("belief-awakening", "every card play is a visible card event (kind cardPlay): a skeptic in sight gathers at most one evidence point a round; an aware foe learns through shownTo/viewFor, not the witness hook (CARDS.md section 18)");
    add("loot-relics", "rarity row for rollCard; staged until its kind is live");
    add("shop-keeper", "Card Table stock by rarity; a legendary is never sold");
    add("mint", "no faucet; selling is manualSell");
    add("fame", "Fame is a cap input only; no card reads it");
    add("scribing", "price table only; Bind is deferred");
    add("codex-library", "Codex shelf entry and art manifest key");
    add("consumables-pack", "takes no pack slot; the held-items gate does not stop cards");
    if (card.kind === "summon") add("widened-perks", "Widened or Proficient Summoner opens the second slot a palace summon needs");
    add("ai", `goal tag \`${card.goal}\`; necessity read from the board; the AI reads the owner's cards only through the awareness gate (CARDS.md section 18)`);
    for (const c of card.contacts || []) add(c.system, c.how, false);
    return r;
  }

  // ── What is wrong with a card's data (the legality script: rules U, U2, U2b and the payload caps) ──
  function problems(card) {
    const why = [], id = card?.id || "?";
    if (!card || !card.id || !card.name) return ["a card needs an id and a name"];
    if (!D.kinds[card.kind]) return [`${id}: unknown kind ${card.kind}`];
    if (!rules.rarities.includes(card.rarity)) why.push(`${id}: unknown rarity ${card.rarity}`);
    const cond = D.conditions[card.condition?.id];
    if (!cond) return [...why, `${id}: unknown condition ${card.condition?.id}`];
    if (!(card.condition.tier in rules.conditionMul)) why.push(`${id}: unknown condition tier ${card.condition.tier}`);
    if ((card.condition.id === "none") !== (card.condition.tier === "none")) why.push(`${id}: the none condition and the none tier go together`);
    if (!Array.isArray(card.effects) || !card.effects.length) return [...why, `${id}: no effects`];
    for (const e of card.effects) {
      const def = D.effects[e.key];
      if (!def) return [...why, `${id}: effect ${e.key} is not on the closed menu`];
      if (def.proposed && card.status === "live") why.push(`${id}: effect ${e.key} is only a proposal, so the card must stay staged`);
    }
    if (card.kind === "field" && !card.zone) return [...why, `${id}: a field card needs a zone`];
    if (card.kind === "equip" && !card.equip) return [...why, `${id}: an equip card needs an equip block`];
    if (card.kind === "set" && !(card.trigger || []).length) return [...why, `${id}: a set card needs a trigger`];
    const p = payload(card), dmg = card.effects.filter((e) => e.key === "damage").reduce((n, e) => n + e.potency, 0);
    if (p > rules.payloadCap[card.rarity]) why.push(`${id}: payload ${p} is over the ${card.rarity} cap ${rules.payloadCap[card.rarity]}`);
    if (card.condition.tier === "none") {
      if (p > rules.unconditioned.maxPayload) why.push(`${id}: rule U, no condition and payload over ${rules.unconditioned.maxPayload}`);
      if (card.rarity === "legendary") why.push(`${id}: rule U, a legendary needs a condition`);
      if (dmg > rules.unconditioned.maxDamage) why.push(`${id}: rule U2, unconditioned damage over ${rules.unconditioned.maxDamage}`);
    }
    const proof = cond.turnOneProof;
    if (dmg > rules.turnOneDamage && !(proof && (proof === true || card.condition.n >= proof.minN))) why.push(`${id}: rule U2b, damage over ${rules.turnOneDamage} needs a condition that cannot hold on turn one`);
    if (card.kind === "field" && card.effects.some((e) => e.turns !== undefined && e.turns !== card.zone.rounds)) why.push(`${id}: a field effect lasts as long as the zone`);
    if (card.kind === "equip" && card.effects.some((e) => e.turns !== undefined && e.turns !== card.equip.turns)) why.push(`${id}: an equip effect lasts as long as the equip`);
    if (card.kind === "set" && card.trigger[0] === "onAttacked" && !card.phase) why.push(`${id}: an on-attacked set needs a phase`);
    if (card.effects.some((e) => e.key === "push" && e.tiles > rules.maxPush)) why.push(`${id}: push over ${rules.maxPush} tiles`);
    if (card.effects.some((e) => e.key === "familiar") && card.condition.tier === "none" && card.rarity !== "common") why.push(`${id}: a non-common familiar needs a condition`);
    if (card.cost !== price(card)) why.push(`${id}: stored cost ${card.cost} is not the price ${price(card)}`);
    if (card.copies !== copiesFor(card)) why.push(`${id}: stored copies ${card.copies} is not ${copiesFor(card)}`);
    for (const c of card.contacts || []) {
      if (!CONTACT_SYSTEMS.includes(c.system)) why.push(`${id}: contact system ${c.system} is not on the closed list`);
      if (!c.how) why.push(`${id}: contact ${c.system} says nothing about how`);
    }
    const sys = contactsOf(card).map((c) => c.system);
    for (const e of card.effects) if (REQUIRED[e.key] && !sys.includes(REQUIRED[e.key])) why.push(`${id}: effect ${e.key} needs the ${REQUIRED[e.key]} contact`);
    try { if (!textOf(card)) why.push(`${id}: empty rule text`); } catch (error) { why.push(`${id}: ${error.message}`); }
    return why;
  }

  const byId = (id) => D.cards.find((c) => c.id === id) || null;
  const kindLive = (kind) => rules.liveKinds.includes(kind);
  const liveCards = () => D.cards.filter((c) => c.status === "live" && kindLive(c.kind) && !problems(c).length);

  // ── The deck points cap (section 2.3): 8 + floor(level / 2) up to +10, + Fame, + 2 per Cardsharp rank, ceiling 30 ──
  function capFor({ level = 1, fame = 0, cardsharp = 0 } = {}) {
    const c = rules.cap, lv = Math.min(c.levelMax, Math.floor(Math.max(1, level) / c.levelStep)), ranks = Math.min(c.cardsharpCap, Math.max(0, cardsharp));
    return Math.min(c.ceiling, c.base + lv + Math.max(0, fame) + c.perCardsharp * ranks);
  }

  // ── Deck validation (section 2.4). `owned` is { cardId: n } (omit it to ignore ownership). Returns the errors for the whole deck
  // and `legal`, the longest legal prefix: a battle starts with that and never repairs the deck silently. ──
  function validate(deck, { owned = null, cap = capFor() } = {}) {
    const ids = Array.isArray(deck) ? deck : [], errors = [], err = (code, text, id = null) => errors.push({ code, text, id });
    const count = {}, seen = new Set(); let points = 0, legendary = 0, rare = 0;
    const bad = (id) => { const c = byId(id); if (!c) return `${id} is not a card`; if (c.status !== "live") return `${c.name} is not available yet`; if (!kindLive(c.kind)) return `${c.name} (${D.kinds[c.kind].label}) is not available yet`; return problems(c).length ? `${c.name} cannot be used` : null; };
    for (const id of ids) {
      if (seen.has(id)) continue; seen.add(id);
      const why = bad(id); if (why) err("unavailable", why, id);
    }
    if (ids.length > rules.deck.maxCards) err("count", `A deck holds at most ${rules.deck.maxCards} cards (this one has ${ids.length}).`);
    for (const id of ids) {
      count[id] = (count[id] || 0) + 1;
      const c = byId(id); if (!c) continue;
      points += c.cost; if (c.rarity === "legendary") legendary++; if (c.rarity === "legendary" || c.rarity === "rare") rare++;
    }
    for (const [id, n] of Object.entries(count)) {
      const c = byId(id); if (!c) continue;
      if (n > c.copies) err("copies", `${c.name}: at most ${c.copies} cop${c.copies === 1 ? "y" : "ies"} in a deck.`, id);
      if (owned && n > (owned[id] || 0)) err("owned", `${c.name}: you own ${owned[id] || 0}.`, id);
    }
    if (legendary > rules.deck.maxLegendary) err("legendary", `At most ${rules.deck.maxLegendary} legendary card in a deck.`);
    if (rare > rules.deck.maxRareUp) err("rare", `At most ${rules.deck.maxRareUp} rare or legendary cards in a deck.`);
    if (points > cap) err("cap", `${points} points is over the ${cap} point limit.`);
    // The longest legal prefix: add cards in order and stop at the first that breaks a rule.
    const legal = [], have = {}; let pts = 0, leg = 0, rr = 0;
    for (const id of ids) {
      const c = byId(id); if (!c || bad(id) || legal.length >= rules.deck.maxCards) break;
      const n = (have[id] || 0) + 1, isLeg = c.rarity === "legendary", isRare = isLeg || c.rarity === "rare";
      if (n > c.copies || (owned && n > (owned[id] || 0)) || pts + c.cost > cap || leg + (isLeg ? 1 : 0) > rules.deck.maxLegendary || rr + (isRare ? 1 : 0) > rules.deck.maxRareUp) break;
      legal.push(id); have[id] = n; pts += c.cost; leg += isLeg ? 1 : 0; rr += isRare ? 1 : 0;
    }
    return { ok: !errors.length, errors, points, legal };
  }

  return { CONTACT_SYSTEMS, payload, price, copiesFor, textOf, needs, contactsOf, problems, byId, liveCards, capFor, validate };
});
