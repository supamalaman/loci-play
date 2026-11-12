"use strict";
// Battle Cards, slice C0 (specs/CARDS.md section 2.2): the account's card collection and decks. Pure: every writer returns a new
// account and spreads the old one and the old cardbook first, so a field added later survives (qa/repeats.md #29).
//
//   account.cardbook = { v: 1, owned: { cardId: n }, seen: {}, bought: {}, gifted: false, giftedIds: {}, decks: { main: [ids], byChar: { classId: [ids] } } }
//
//   normalize(account)            the account with a complete cardbook (unknown keys kept); read paths never assume the shape
//   ownedCount(account, id)       copies owned
//   grant(account, id, n)         owned + n (collection, never consumed)
//   deckFor(account, classId)     the character's own deck when it has one, else the shared deck
//   hasOverride(account, classId) true when the character has its own deck
//   setDeck(account, ids, classId) store a deck (the shared one when classId is null); stored as given, never repaired silently
//   useOwnDeck / useSharedDeck    give a character its own copy of the shared deck / go back to the shared one
//   cap(account)                  the deck points cap from level, Fame and the Cardsharp perk line
//   validate(account, deck)       Cards.validate with this account's ownership and cap
//   canAdd(account, deck, id)     { ok, reason } for adding one card to the deck on the screen
//   giftStarter(account)          { account, changed }: one copy of each starter-gift card whose kind is live, once each
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../cards/cards.js"), require("../cards/cards-data.js"));
  else root.ConceptCombatCardbook = factory(root.ConceptCombatCards, root.ConceptCombatCardsData);
})(typeof self !== "undefined" ? self : this, function (Cards, D) {
  const VERSION = 1;
  const strings = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string") : []);
  const obj = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : {});
  function book(account) {
    const b = obj(account?.cardbook), decks = obj(b.decks), byChar = {};
    for (const [k, v] of Object.entries(obj(decks.byChar))) if (Array.isArray(v)) byChar[k] = strings(v);
    const owned = { ...obj(b.owned) }, seen = { ...obj(b.seen) };
    for (const id of Object.keys(owned)) if (owned[id] > 0) seen[id] = seen[id] || true;   // pre-C7 saves: holding counts as seen
    return { ...b, v: VERSION, owned, seen, bought: { ...obj(b.bought) }, gifted: !!b.gifted, giftedIds: { ...obj(b.giftedIds) },
      decks: { ...decks, main: strings(decks.main), byChar } };
  }
  const normalize = (account) => ({ ...account, cardbook: book(account) });
  const ownedCount = (account, id) => book(account).owned[id] || 0;
  const grant = (account, id, n = 1) => {
    const b = book(account);
    const seen = b.seen[id] ? b.seen : { ...b.seen, [id]: true };
    return { ...account, cardbook: { ...b, owned: { ...b.owned, [id]: (b.owned[id] || 0) + n }, seen } };
  };
  // A sighting is a real card id. Keys such as "foe:<character>" (the hand-over once-per-kind mark) stay out of this map.
  function markSeen(account, ids) {
    const b = book(account);
    const known = new Set(D.cards.map((c) => c.id));
    let seen = b.seen, changed = false;
    for (const id of ids || []) {
      if (!known.has(id) || seen[id]) continue;
      if (!changed) seen = { ...seen };
      seen[id] = true; changed = true;
    }
    return changed ? { ...account, cardbook: { ...b, seen } } : account;
  }
  const hasOverride = (account, classId) => !!classId && Array.isArray(book(account).decks.byChar[classId]);
  const deckFor = (account, classId) => { const b = book(account); return (hasOverride(account, classId) ? b.decks.byChar[classId] : b.decks.main).slice(); };
  function setDeck(account, ids, classId = null) {
    const b = book(account), list = strings(ids), decks = classId && hasOverride(account, classId) ? { ...b.decks, byChar: { ...b.decks.byChar, [classId]: list } } : { ...b.decks, main: list };
    return { ...account, cardbook: { ...b, decks } };
  }
  function useOwnDeck(account, classId) {
    const b = book(account); if (!classId || hasOverride(account, classId)) return account;
    return { ...account, cardbook: { ...b, decks: { ...b.decks, byChar: { ...b.decks.byChar, [classId]: b.decks.main.slice() } } } };
  }
  function useSharedDeck(account, classId) {
    const b = book(account); if (!hasOverride(account, classId)) return account;
    const byChar = { ...b.decks.byChar }; delete byChar[classId];
    return { ...account, cardbook: { ...b, decks: { ...b.decks, byChar } } };
  }
  const cap = (account) => Cards.capFor({ level: account?.level || 1, fame: account?.fame || 0, cardsharp: account?.perks?.cardsharp || 0 });
  const validate = (account, deck) => Cards.validate(deck, { owned: book(account).owned, cap: cap(account) });
  function canAdd(account, deck, id) {
    const c = Cards.byId(id); if (!c) return { ok: false, reason: "Not a card." };
    if (!validate(account, deck).ok) return { ok: false, reason: "This deck already breaks a limit: remove a card first." };
    const next = validate(account, [...deck, id]);
    if (next.legal.length === deck.length + 1) return { ok: true, reason: "" };
    const mine = next.errors.find((e) => e.id === id) || next.errors[0];
    return { ok: false, reason: mine ? mine.text : "That card does not fit." };
  }
  // Once each: a card is gifted a single time, when its kind is live (after C1 only the instants exist, the rest arrive with their kinds).
  function giftStarter(account) {
    if (!D.rules.enabled) return { account, changed: false };
    let a = normalize(account), changed = false;
    const live = new Set(Cards.liveCards().map((c) => c.id));
    for (const id of D.rules.gift) {
      if (!live.has(id) || a.cardbook.giftedIds[id]) continue;
      a = grant(a, id, 1); a = { ...a, cardbook: { ...a.cardbook, giftedIds: { ...a.cardbook.giftedIds, [id]: true } } }; changed = true;
    }
    const done = D.rules.gift.every((id) => a.cardbook.giftedIds[id]);
    if (done && !a.cardbook.gifted) { a = { ...a, cardbook: { ...a.cardbook, gifted: true } }; changed = true; }
    return { account: changed ? a : account, changed };
  }
  return { normalize, ownedCount, grant, markSeen, deckFor, hasOverride, setDeck, useOwnDeck, useSharedDeck, cap, validate, canAdd, giftStarter };
});
