"use strict";
// Battle Cards, slice C1 (specs/CARDS.md sections 3, 4.1, 9, 18): the battle half of the card system, for the INSTANT kind.
// A part of the Concept Combat engine: engine.js installs it with the host object H and it hands back `Cards`
// (reached as H.Cards; engine.js exports it as E.cards). The pure rules (price, text, validate) stay in cards/cards.js.
//
//   Cards.init(s, opts)                  create(): read opts.loadouts[actorId].cards = { deck: [ids], cap?, owned? }, keep the longest legal
//                                        prefix, write s.cardplay. A battle with no deck anywhere leaves s.cardplay absent.
//   Cards.options(s, actorId)            one row per deck entry for the drawer: ready / used / blocked, with the reason and legal targets
//   Cards.check(s, a, index, target)     the refusal reason (null = playable): the one set of checks the drawer, the handler and previews share
//   Cards.play(s, a, act)                the `playCard` act: stamp, log, resolve the closed effect menu. Costs NO AP, NO phi, NO reaction.
//   Cards.showHand(s, a)                 the `showHand` act (section 18.4): tell the aware foes in sight what is left, for a small damage edge
//   Cards.showOptions(s, id)             the Show your hand row, from what the viewer may know (a skeptic is public; a believer only if open/observed)
//   Cards.viewFor(s, observerId, ownerId)  what an observer may know of an owner's cards: null unless same side, or aware AND perceiving
//   Cards.logFor(s, entry, viewerId)     a log entry's private text ({ text, id }) for a viewer who may read it, else null
//   Cards.aware(unit)                    believer-class (section 18.3)
//
// State (plain JSON): s.cardplay = { by: { <actorId>: { deck: [{ id, used, usedRound }], turnStamp, played, shown, shownAt, shownTo: [ids] } },
//   priv: { <log index>: { owner, text, id, seenBy: [ids] } }, depth: 0, zones: [] }. The deck belongs to the ACTOR (not the side).
// Rules this part keeps (tested): a card never plays a card; playCard is callable only from the action door; no response window opens and
// no reaction is spent; the card id and name never enter a public log entry (kind "cardPlay" carries a generic line; the name lives in
// s.cardplay.priv); s.cardplay.by is read only in this file, and other readers (the AI, the UI, the inspector) go through viewFor/options.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).cards = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const lib = () => (typeof module === "object" && module.exports ? require("../cards/cards.js") : globalThis.ConceptCombatCards);
    const dat = () => (typeof module === "object" && module.exports ? require("../cards/cards-data.js") : globalThis.ConceptCombatCardsData);
    const { log, dist, hasSight, hit, addStun, knock } = H;
    const AWARE = ["believer", "devoutBeliever", "fullBeliever", "convertedDevout", "convertedBeliever"];
    const traitIds = (u) => (u?.traits || u?.selfTraits || []).map((t) => (typeof t === "string" ? t : t?.id)).filter(Boolean);
    const aware = (u) => !!u && traitIds(u).some((id) => AWARE.includes(id));
    const live = () => dat().rules.enabled;
    const book = (s, id) => s.cardplay?.by?.[id] || null;

    // A card hit is a plain object with no name: damage.js writes `inst.name` into public entries, so a card passes name null (the label
    // "A blow" is given in the options), and the card id never reaches the public stream.
    const instOf = (damageType = "nigredo") => ({ name: null, ability: null, card: true, concept: null, delivery: "card", tier: "card", damageType, mult: 1 });

    // ── who is a foe, what is seen ──
    const concealed = (u) => { const c = u?.status?.concealed; return !!c && (c.until == null || c.until >= u.ownerTurns); };
    const foesOf = (s, a) => Object.values(s.actors).filter((t) => t.id !== a.id && !t.defeated && !t.escaped && !t.notArrived && H.stanceFor(s, a, t) === "enemy");
    const visibleFoe = (s, a, t) => !concealed(t) && !H.Instinct.hidden(a, t) && hasSight(s, a.x, a.y, t.x, t.y) && H.dreamSame(s, a.x, a.y, t.x, t.y);
    // Who PERCEIVES a unit: in sight AND in the same Dream region (a sealed dream hides what happens inside it from outsiders: Mala's ruling A, 2026-10-31).
    const perceives = (s, o, a) => hasSight(s, o.x, o.y, a.x, a.y) && H.dreamSame(s, o.x, o.y, a.x, a.y);
    const foeFrac = (t) => (t.maxLF > 0 ? t.lf / t.maxLF : 1);

    // ── conditions (section 1.1, 17): the reason line the drawer prints is "Needs: <generated text>." ──
    function allyDown(s, a) {
      return Object.values(s.actors).some((u) => u.id !== a.id && u.side === a.side && u.defeated && !u.escaped && !u.notArrived && u.category !== "bystander");   // a fade (defeated AND escaped) does not count (section 17)
    }
    function hurtSinceTurn(s, a) {
      // "since your last turn began": from the start of the turn before this one (a hit taken on a foe's turn counts), else from the start
      let starts = 0, from = 0;
      for (let i = s.log.length - 1; i >= 0; i--) { const e = s.log[i]; if (e.kind === "turn" && e.actor === a.id) { starts++; from = i; if (starts === (H.currentId(s) === a.id ? 2 : 1)) break; } }
      if (starts < (H.currentId(s) === a.id ? 2 : 1)) from = 0;
      for (let i = s.log.length - 1; i >= from; i--) { const e = s.log[i]; if (e.kind === "damage" && e.target === a.id && (e.lfLost > 0 || e.amount > 0)) return true; }
      return false;
    }
    function targetsOf(s, a, card) {
      const range = card.range || dat().rules.defaultRange, c = card.condition, out = [];
      if (card.target === "tile") {
        for (const u of Object.values(s.actors)) if (u.id !== a.id && !u.defeated && !u.escaped && !u.notArrived && concealed(u) && dist(s, a.x, a.y, u.x, u.y) <= range && H.dreamSame(s, a.x, a.y, u.x, u.y)) out.push([u.x, u.y]);
        return out;
      }
      if (card.target !== "foe") return out;
      const reach = c.id === "foeWithin" ? Math.min(range, c.n) : range;
      for (const t of foesOf(s, a)) {
        if (dist(s, a.x, a.y, t.x, t.y) > reach || !visibleFoe(s, a, t)) continue;
        if (c.id === "foeLfBelow" && !(foeFrac(t) < c.n)) continue;
        out.push([t.x, t.y]);
      }
      return out;
    }
    function conditionReason(s, a, card) {
      const c = card.condition, need = () => `Needs: ${lib().needs(card)}.`;
      if (c.id === "none") return null;
      if (c.id === "foeWithin") return foesOf(s, a).some((t) => dist(s, a.x, a.y, t.x, t.y) <= c.n && visibleFoe(s, a, t)) ? null : need();
      if (c.id === "foeLfBelow") return foesOf(s, a).some((t) => dist(s, a.x, a.y, t.x, t.y) <= (card.range || dat().rules.foeLfRange) && visibleFoe(s, a, t) && foeFrac(t) < c.n) ? null : need();
      if (c.id === "selfLfBelow") return a.maxLF > 0 && a.lf / a.maxLF < c.n ? null : need();
      if (c.id === "allyDown") return allyDown(s, a) ? null : need();
      if (c.id === "hurtSinceTurn") return hurtSinceTurn(s, a) ? null : need();
      if (c.id === "roundAtLeast") return s.round >= c.n ? null : need();
      return `${card.name} has a condition this version cannot read.`;
    }

    // ── check / options ──
    // The one question: may this unit play deck entry `index` now, at `target`? A string is the reason it may not (section 3.2 order).
    function check(s, a, index, target = null) {
      const L = lib(), by = book(s, a?.id);
      if (!live()) return "Battle cards are not in play.";
      if (!by) return "You carry no battle deck.";
      if (!a || a.defeated || a.escaped) return "A defeated unit plays no cards.";
      if (s.phase !== "action" || H.currentId(s) !== a.id) return "It is not your turn.";
      { const no = H.States?.refuses(s, a, { type: "playCard" }); if (no) return no; }
      const entry = by.deck[index]; if (!entry) return "That is not a card in your deck.";
      const card = L.byId(entry.id);
      if (!card || card.status !== "live") return "That card is no longer in the game.";
      if (!dat().rules.liveKinds.includes(card.kind)) return `${dat().kinds[card.kind].label} cards are not playable yet.`;
      if (entry.used) return `Played in round ${entry.usedRound}.`;
      if (by.turnStamp === a.ownerTurns) return "One card per turn: you already played one.";
      const why = conditionReason(s, a, card); if (why) return why;
      if (card.target === "foe" || card.target === "tile") {
        const legal = targetsOf(s, a, card);
        if (!legal.length) return card.target === "tile" ? `No concealed unit within ${card.range || dat().rules.defaultRange}.` : `No foe in reach and in sight.`;
        if (target) {
          if (!Array.isArray(target) || !legal.some((p) => p[0] === target[0] && p[1] === target[1])) return card.target === "tile" ? "Choose a concealed unit within range." : "Choose a foe in range and in sight.";
        } else return "Choose a target.";
      }
      return null;
    }
    function options(s, id) {
      const L = lib(), by = book(s, id), a = s.actors?.[id];
      if (!by || !a || !live()) return [];
      return by.deck.map((entry, index) => {
        const card = L.byId(entry.id);
        if (!card) return { index, id: entry.id, name: entry.id, kind: null, kindLabel: "", text: "", cost: 0, state: "blocked", reason: "That card is no longer in the game.", needsTarget: false, targets: [] };
        const reason = entry.used ? `Played in round ${entry.usedRound}.` : check(s, a, index, card.target === "foe" || card.target === "tile" ? (targetsOf(s, a, card)[0] || null) : null);
        const targets = !entry.used && (card.target === "foe" || card.target === "tile") ? targetsOf(s, a, card) : [];
        return { index, id: card.id, name: card.name, kind: card.kind, kindLabel: dat().kinds[card.kind].label, rarity: card.rarity, cost: card.cost, text: L.textOf(card),
          state: entry.used ? "used" : reason ? "blocked" : "ready", reason: reason || "", needsTarget: card.target === "foe" || card.target === "tile", targets };
      });
    }

    // ── playing ──
    const nameless = (u) => u.name || "A unit";
    function resolve(s, a, card, target) {
      const L = lib(), t = target ? H.actorAt(s, target[0], target[1]) || Object.values(s.actors).find((u) => !u.defeated && u.x === target[0] && u.y === target[1]) : null;
      for (const e of card.effects) {
        if (e.key === "damage") {
          if (!t || t.defeated) continue;
          const potency = e.potency + showBonus(s, a, t, e.potency);
          hit(s, a, t, instOf(e.type), potency, [], { label: "A blow", damageType: e.type });
        } else if (e.key === "push") { if (t && !t.defeated) knock(s, a, t, e.tiles, instOf("nigredo"), "push"); }
        else if (e.key === "stagger") { if (t && !t.defeated) addStun(s, a, t, e.ap); }
        else if (e.key === "root") {
          if (!t || t.defeated) continue;
          t.status.rooted = { scribed: true, label: "Rooted", owner: t.id, expiresAt: t.ownerTurns + e.turns + 1 };
          log(s, { kind: "effect", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${t.name} is rooted for ${e.turns} turn${e.turns === 1 ? "" : "s"}.` });
        } else if (e.key === "itemLock") {
          if (!t || t.defeated) continue;
          t.status.scribedItemLock = { label: "Items locked", owner: t.id, expiresAt: t.ownerTurns + e.turns + 1 };
          log(s, { kind: "effect", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${t.name} cannot use items for ${e.turns} turn${e.turns === 1 ? "" : "s"}.` });
        } else if (e.key === "reveal") {
          if (!t || t.defeated) continue;
          delete t.status.concealed;
          log(s, { kind: "effect", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${t.name} is no longer concealed.` });
        } else if (e.key === "ward") {
          a.status.ward = { label: "Ward", owner: a.id, expiresAt: a.ownerTurns + 1, protection: e.protection };
          log(s, { kind: "effect", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} gains a ward of ${e.protection} until their next turn.` });
        } else if (e.key === "heal") {
          if (a.defeated) continue;
          const got = Math.max(0, Math.min(a.maxLF - a.lf, e.lf)); a.lf += got;
          log(s, { kind: "heal", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} recovers ${got} LF.` });
          if (got > 0) H.States?.healed(s, a, got);
        } else throw new Error(`card effect ${e.key} is not part of the instant menu`);
      }
    }
    // Show your hand (18.4): from the owner's NEXT turn, card damage against a foe it showed (and that is still aware) is 10% higher, at most +3.
    function showBonus(s, a, t, potency) {
      const by = book(s, a.id), R = dat().rules.showHand;
      if (!by?.shown || !(a.ownerTurns > by.shownAt) || !by.shownTo.includes(t.id) || !aware(s.actors[t.id])) return 0;
      return Math.min(R.bonusMax, Math.floor(potency * R.bonusPct + 0.5));
    }
    function play(s, a, act) {
      const L = lib(), by = book(s, a.id), entry = by?.deck?.[act.card];
      const target = Array.isArray(act.target) ? act.target : null;
      const why = check(s, a, act.card, target); if (why) return why;
      const card = L.byId(entry.id);
      if (by.played >= dat().rules.deck.maxCards) return "No more cards can be played this battle.";   // termination: at most one play per deck entry, a deck is at most 12
      entry.used = true; entry.usedRound = s.round; by.turnStamp = a.ownerTurns; by.played += 1;
      // A skeptic in sight gathers evidence through the witness hook in log() (belief-conversion.js); the public line is generic.
      const i = s.log.length, cp = s.cardplay, seenBy = [];
      const watchers = [];   // every foe that perceives the play (the skeptics gather evidence from it; the aware may read it)
      for (const o of Object.values(s.actors)) if (o.id !== a.id && o.side !== a.side && !o.defeated && !o.escaped && !o.notArrived && perceives(s, o, a)) { watchers.push(o.id); if (aware(o)) seenBy.push(o.id); }
      cp.priv[i] = { owner: a.id, id: card.id, seenBy, text: `${a.name} plays ${card.name}. ${L.textOf(card)}` };
      log(s, { kind: "cardPlay", actor: a.id, tiles: [[a.x, a.y]], witnesses: watchers, text: `${nameless(a)} does something that does not add up.` });
      a = s.actors[a.id];   // the witness hook may have replaced this unit's object (a skeptic's evidence is written as a copy)
      cp.depth += 1;
      try { resolve(s, a, card, target); } finally { cp.depth -= 1; }
      return null;
    }

    // ── Show your hand ──
    function foesSeeing(s, a) { return foesOf(s, a).filter((t) => perceives(s, t, a)); }
    function showHand(s, a) {
      const by = book(s, a.id);
      if (!live()) return "Battle cards are not in play.";
      if (!by) return "You carry no battle deck.";
      if (a.defeated) return "A defeated unit shows nothing.";
      if (by.shown) return "You already showed your hand this battle.";
      if (!by.deck.some((e) => !e.used)) return "No unused card is left to show.";
      const seeing = foesSeeing(s, a);
      if (!seeing.some((t) => aware(t) || H.Belief.isSkeptic(t))) return "No believer or skeptic can see you.";
      by.shown = true; by.shownAt = a.ownerTurns;
      for (const t of seeing) if (aware(t) && !by.shownTo.includes(t.id)) by.shownTo.push(t.id);
      const i = s.log.length;
      s.cardplay.priv[i] = { owner: a.id, id: null, seenBy: [], text: `${a.name} shows their hand to ${seeing.length} foe${seeing.length === 1 ? "" : "s"} in sight.` };
      log(s, { kind: "handShown", actor: a.id, tiles: [[a.x, a.y]], witnesses: seeing.map((t) => t.id), text: `${nameless(a)} does something that does not add up.` });
      for (const t of seeing) if (aware(s.actors[t.id]) && !by.shownTo.includes(t.id)) by.shownTo.push(t.id);   // a skeptic that converted is told afterwards
      return null;
    }
    // The viewer may know a believer only when the trait is open or has been observed; a skeptic is public (nonBeliever is an open trait).
    function knownBeliever(s, viewer, t) {
      if (!aware(t)) return false;
      const data = H.insightRules?.data?.traits || {}, known = H.Observation?.knowledge?.(s, viewer)?.[t.id]?.revealed || [];
      const deck = s.insight?.decks?.[t.id]?.cards || [];
      return traitIds(t).some((id) => AWARE.includes(id) && (data[id]?.open || deck.some((c) => (c.trait === id || c.id === id) && known.includes(c.id))));
    }
    function showOptions(s, id) {
      const by = book(s, id), a = s.actors?.[id];
      if (!by || !a || !live()) return null;
      let reason = "";
      if (by.shown) reason = "You already showed your hand this battle.";
      else if (!by.deck.some((e) => !e.used)) reason = "No unused card is left to show.";
      else if (!foesSeeing(s, a).some((t) => H.Belief.isSkeptic(t) || knownBeliever(s, a, t))) reason = "No known believer or skeptic can see you.";
      else if (s.phase !== "action" || H.currentId(s) !== id) reason = "It is not your turn.";
      return { state: reason ? "blocked" : "ready", reason };
    }

    // ── what an observer may know (section 18.3) ──
    function unusedCount(by) { return by.deck.filter((e) => !e.used).length; }
    function viewFor(s, observerId, ownerId) {
      const by = book(s, ownerId), owner = s.actors?.[ownerId], obs = s.actors?.[observerId];
      if (!by || !owner || !obs || !live()) return null;
      const L = lib(), counts = { unused: unusedCount(by), deckSize: by.deck.length, sets: 0, fields: 0 };
      if (observerId === ownerId || obs.side === owner.side) {
        return { ...counts, full: true, rows: by.deck.map((e) => ({ id: e.id, name: L.byId(e.id)?.name || e.id, used: !!e.used })) };
      }
      if (!aware(obs)) return null;
      const shown = by.shownTo.includes(observerId);
      if (!shown && !perceives(s, obs, owner)) return null;
      return shown ? { ...counts, full: false, unusedList: by.deck.filter((e) => !e.used).map((e) => L.byId(e.id)?.name || e.id) } : { ...counts, full: false };
    }
    function logFor(s, entry, viewerId) {
      const p = s.cardplay?.priv?.[entry?.i]; if (!p || !live()) return null;
      const viewer = s.actors?.[viewerId], owner = s.actors?.[p.owner];
      if (!viewer || !owner) return null;
      if (viewerId === p.owner || viewer.side === owner.side || p.seenBy.includes(viewerId)) return { text: p.text, id: p.id };
      return null;
    }

    // ── battle start (section 3.6) ──
    function init(s, opts) {
      if (!live()) return;
      const L = lib(), loadouts = opts?.loadouts || {}, by = {}; let dropped = null;
      for (const id of Object.keys(loadouts)) {
        const cfg = loadouts[id]?.cards, a = s.actors[id];
        if (!a || !cfg || !Array.isArray(cfg.deck) || !cfg.deck.length) continue;
        const v = L.validate(cfg.deck, { owned: cfg.owned || null, cap: cfg.cap ?? dat().rules.cap.ceiling });
        if (v.legal.length < cfg.deck.length) (dropped ||= []).push({ id, cut: cfg.deck.length - v.legal.length, why: v.errors.map((e) => e.text) });
        if (v.legal.length) by[id] = { deck: v.legal.map((cid) => ({ id: cid, used: false, usedRound: null })), turnStamp: -1, played: 0, shown: false, shownAt: -1, shownTo: [] };
      }
      if (!Object.keys(by).length && !dropped) return;
      s.cardplay = { by, priv: {}, depth: 0, zones: [] };
      for (const d of dropped || []) {   // the owner reads what was dropped; every other viewer sees an empty line that the screen leaves out
        const i = s.log.length;
        s.cardplay.priv[i] = { owner: d.id, id: null, seenBy: [], text: `${s.actors[d.id].name} starts with a shorter deck: ${d.cut} card${d.cut === 1 ? "" : "s"} dropped. ${d.why.join(" ")}` };
        log(s, { kind: "cardDeck", actor: d.id, text: "" });
      }
    }

    return { Cards: { init, options, check, play, showHand, showOptions, viewFor, logFor, aware } };
  })();
});
