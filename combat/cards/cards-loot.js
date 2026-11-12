"use strict";
// Battle Cards, slice C6a (specs/CARDS.md section 7): acquisition. Pure account-side rolls: a battle can leave a card,
// the Gambler keeps a table stock, the board pays some jobs in kind. The ui.js settle block calls these behind
// !testBattle() (the fruit-settle pattern), so a test battle never rolls, stocks or pays a card.
//   rollRarity(seed, tag, level)            rarity via the items-data table (70/24/5.5/0.5 + rarityByLevel); legendary downgrades to rare off the relic path
//   rollCard(account, { seed, tag })        one live card: kind uniform across live kinds, seeded rarity, never staged, never legendary
//   relicCard(account, { seed, foes })      story legendaries: each defeated character with unowned carriedBy cards rolls 0.03 (none exist yet: TC data)
//   settleCard(account, result, { seed, test })  one post-battle roll (0.35 win / 0.10 loss) + relics → { card, relic, lines }
//   tableStock(account, { seed })           the Gambler's 4: 2 common + 1 uncommon + 1 seeded non-legendary, no twins, +1 uncommon at Fame 3
//   buyPrice(card) / sellPrice(card)        buy = deck cost × 3/6/12/60 by rarity (R-20261104-14, -15); sell = 40% rounded
//   buy(account, id, stock) / sell(account, id)  { account, ok, reason, price } — seeds + owned; buys refuse past the deck-copies cap
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./cards.js"), require("./cards-data.js"), require("../account/items-data.js"));
  else root.ConceptCombatCardsLoot = factory(root.ConceptCombatCards, root.ConceptCombatCardsData, root.ConceptCombatItems);
})(typeof self !== "undefined" ? self : this, function (Cards, D, I) {
  const roll = (seed, tag) => {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const weighted = (r, entries) => {
    let acc = 0; const total = entries.reduce((s, [, w]) => s + w, 0);
    for (const [id, w] of entries) { acc += w; if (r * total < acc) return id; }
    return entries[entries.length - 1][0];
  };
  const levelMul = (level) => { let m = I.dropRules.rarityByLevel[0].mul; for (const r of I.dropRules.rarityByLevel) if (level >= r.level) m = r.mul; return m; };
  const owned = (account, id) => (account?.cardbook?.owned || {})[id] || 0;

  // The items-data rarity table with the level multipliers; off the relic path a legendary roll comes back rare.
  function rollRarity(seed, tag, level) {
    const mul = levelMul(level || 1);
    const r = weighted(roll(seed, tag + ":rarity"), Object.entries(I.rarities).map(([id, d]) => [id, d.weight * (mul[id] ?? 1)]));
    return r === "legendary" ? "rare" : r;
  }
  // Kind uniform across the live kinds (spec section 7), then the widest pool that fits: kind+rarity, kind, rarity, anything.
  function rollCard(account, { seed = 0, tag = "card", level = null } = {}) {
    const live = Cards.liveCards();
    if (!live.length) return null;
    const kinds = (D.rules.liveKinds || []).filter((k) => live.some((c) => c.kind === k));
    if (!kinds.length) return null;
    const kind = kinds[Math.floor(roll(seed, tag + ":kind") * kinds.length) % kinds.length];
    const rarity = rollRarity(seed, tag, level ?? account?.level ?? 1);
    const pool = live.filter((c) => c.kind === kind && c.rarity === rarity && c.rarity !== "legendary");
    const wide = pool.length ? pool : live.filter((c) => c.kind === kind && c.rarity !== "legendary");
    const wider = wide.length ? wide : live.filter((c) => c.rarity === rarity && c.rarity !== "legendary");
    const any = wider.length ? wider : live.filter((c) => c.rarity !== "legendary");
    if (!any.length) return null;
    return any[Math.floor(roll(seed, tag + ":card") * any.length) % any.length].id;
  }
  // Story relics (the loot.js pattern): each defeated foe whose character carries legendaries rolls once; a hit
  // grants one it carries that the account does not own yet. No live card carries one yet, so this is a live no-op
  // until TC writes carriedBy rows ("a few legendary-by-story cards later", spec section 7).
  function relicCard(account, { seed = 0, foes = [] } = {}) {
    const chance = D.rules.relicChance ?? 0.03;
    for (const ch of [...new Set(foes.filter(Boolean))]) {
      const pool = Cards.liveCards().filter((c) => c.rarity === "legendary" && c.carriedBy === ch && !owned(account, c.id));
      if (!pool.length || roll(seed, `card:relic:${ch}`) >= chance) continue;
      return pool[Math.floor(roll(seed, `card:relicPick:${ch}`) * pool.length) % pool.length].id;
    }
    return null;
  }
  function settleCard(account, result, { seed = 0, test = false } = {}) {
    if (test) return { card: null, relic: null, lines: [] };   // a test battle never rolls (test-battle-mints pattern)
    const won = result?.winner === "player";
    const card = roll(seed, "card:drop") < (won ? 0.35 : 0.10) ? rollCard(account, { seed, tag: "card:drop", level: account?.level }) : null;
    const relic = relicCard(account, { seed, foes: result?.foes || [] });
    const lines = [];
    if (card) lines.push(`The battle leaves a card: ${Cards.byId(card)?.name || card}.`);
    if (relic) lines.push(`A story surfaces: ${Cards.byId(relic)?.name || relic}.`);
    const hand = handOver(account, result, seed);
    lines.push(...hand.lines);
    return { card, relic, gifts: hand.gifts, lines, seen: hand.seen };
  }
  // C6b (R-20261109-27): a persuaded foe hands over one card at 20%, once per foe kind (cardbook.seen). A miss still marks the kind.
  function handOver(account, result, seed) {
    const seen = { ...(account?.cardbook?.seen || {}) };
    const gifts = [], lines = [];
    let wrote = false;
    for (const foe of result?.persuaded || []) {
      const kind = foe?.character;
      if (!kind) continue;
      const key = `foe:${kind}`;
      if (seen[key]) continue;
      seen[key] = 1; wrote = true;
      if (roll(seed, `card:handover:${kind}`) >= 0.2) continue;
      const id = rollCard(account, { seed, tag: `card:handover:${kind}`, level: account?.level });
      if (!id) continue;
      gifts.push(id);
      lines.push(`${foe.name || kind} hands over a card: ${Cards.byId(id)?.name || id}.`);
    }
    return { gifts, lines, seen: wrote ? seen : null };
  }
  // The Gambler's table: 2 common + 1 uncommon + 1 seeded non-legendary, no twin listings; Fame 3 seats one more uncommon.
  // Bought rows stay bought until the next battle turns the stock (cardbook.bought = { seed, ids }).
  function tableStock(account, { seed = 0 } = {}) {
    const live = Cards.liveCards().filter((c) => c.rarity !== "legendary");
    if (!live.length) return [];
    const bought = account?.cardbook?.bought, gone = bought && bought.seed === seed ? new Set(bought.ids || []) : new Set();
    const picked = new Set(), out = [];
    const take = (tag, rarity) => {
      const pool = live.filter((c) => !picked.has(c.id) && (!rarity || c.rarity === rarity));
      const any = pool.length ? pool : live.filter((c) => !picked.has(c.id));
      if (!any.length) return;
      const id = any[Math.floor(roll(seed, tag) * any.length) % any.length].id;
      picked.add(id); out.push({ id, price: buyPrice(Cards.byId(id)), sold: gone.has(id) });
    };
    take("card:table:common:0", "common"); take("card:table:common:1", "common"); take("card:table:uncommon", "uncommon");
    take("card:table:seeded", rollRarity(seed, "card:table:seeded", account?.level ?? 1));
    if ((account?.fame || 0) >= 3) take("card:table:fame", "uncommon");
    return out;
  }
  const RARITY_MUL = { common: 3, uncommon: 6, rare: 12, legendary: 60 };   // R-20261104-15 (3/6/12 stand) and R-20261104-14 (legendary x60, Mala 2026-11-04)
  const buyPrice = (card) => Math.max(1, Math.round((card?.cost || 0) * (RARITY_MUL[card?.rarity] || 1)));
  const sellPrice = (card) => Math.max(1, Math.round(buyPrice(card) * 0.4));   // a duplicate sells at 40% (spec section 7)
  function buy(account, id, stock = [], { seed = 0 } = {}) {
    const card = Cards.byId(id);
    if (!card || card.status !== "live") return { account, ok: false, reason: "That card is not on the table." };
    if (!stock.some((s) => (s.id || s) === id)) return { account, ok: false, reason: "That card is not on the table." };
    if (stock.some((s) => (s.id || s) === id && s.sold)) return { account, ok: false, reason: "That one already sold." };
    if (owned(account, id) >= Cards.copiesFor(card)) return { account, ok: false, overCap: true, reason: "You cannot carry that much faith. Cut something." };
    const price = buyPrice(card);
    if ((account.seeds || 0) < price) return { account, ok: false, reason: `That costs ${price} Seeds.` };
    const b = account.cardbook || {}, prev = b.bought && b.bought.seed === seed ? b.bought.ids || [] : [];
    return { account: { ...account, seeds: account.seeds - price,
      cardbook: { ...b, owned: { ...(b.owned || {}), [id]: owned(account, id) + 1 }, seen: { ...(b.seen || {}), [id]: true }, bought: { seed, ids: [...prev, id] } } }, ok: true, price };
  }
  const deckCount = (account, id) => {   // copies of id across every deck (main + per-character overrides); each deck validates against the same owned pool
    const d = account?.cardbook?.decks || {};
    return Math.max(0, ...[d.main, ...Object.values(d.byChar || {})].map((l) => (Array.isArray(l) ? l : []).filter((x) => x === id).length));
  };
  function sell(account, id) {
    const card = Cards.byId(id);
    if (!card || owned(account, id) < 1) return { account, ok: false, reason: "You own no copy to sell." };
    if (card.status !== "live") return { account, ok: false, reason: "That card is not in play yet. Keep it." };   // CARDS.md:281: a staged card is never sold
    if (deckCount(account, id) > owned(account, id) - 1) return { account, ok: false, reason: "That copy is in the Battle deck. Remove it there first." };
    const price = sellPrice(card);
    return { account: { ...account, seeds: (account.seeds || 0) + price,
      cardbook: { ...(account.cardbook || {}), owned: { ...((account.cardbook || {}).owned || {}), [id]: owned(account, id) - 1 } } }, ok: true, price };
  }
  const cardName = (id) => Cards.byId(id)?.name || id;
  return { rollRarity, rollCard, relicCard, settleCard, tableStock, buyPrice, sellPrice, buy, sell, cardName, byId: (id) => Cards.byId(id) };
});
