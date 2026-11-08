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
//   Cards.zoneTiles(s)                   C4: every zone's tiles, for the ground highlight
//   Cards.sweep(s) / Cards.zoneTick(s)   C4: grant and take back every zone's hidden rows (States calls it at turn start and after every action) / tick the zones down at round end
//   Cards.familiarTurn(s, a)             C3: a card familiar's whole turn (scripted: strike or ward by its card, then it ends); turns.js calls it, no act reaches it
//   Cards.ripAp(entry)                   C2: the study AP an Observe needs to rip a set card open (more for a more powerful card)
//   Cards.resolveSet(s, a, entry, target, why, ctx)   C2: a face-down SET card fires (called by Mystery's fireCard, never by an act): returns the reason it holds, or null
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
      if (card.kind === "field") {   // C4: a zone is centred on any tile within the zone reach of its owner, in the same Dream region (CARDS.md 4.4)
        const R = dat().rules.zone.reach;
        for (let y = a.y - R; y <= a.y + R; y++) for (let x = a.x - R; x <= a.x + R; x++) if (H.inside(s, x, y) && dist(s, a.x, a.y, x, y) <= R && H.dreamSame(s, a.x, a.y, x, y)) out.push([x, y]);
        return out;
      }
      if (card.kind === "equip") {   // C4: the owner and its living allies within the same reach (a familiar counts)
        const R = dat().rules.zone.reach;
        for (const u of Object.values(s.actors)) if (!u.defeated && !u.escaped && !u.notArrived && u.side === a.side && (u.id === a.id || (card.target !== "self" && dist(s, a.x, a.y, u.x, u.y) <= R)) && H.dreamSame(s, a.x, a.y, u.x, u.y)) out.push([u.x, u.y]);
        return card.target === "self" ? out.filter((p) => p[0] === a.x && p[1] === a.y) : out;
      }
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

    // ── the field and equip kinds (C4, CARDS.md 4.4 and 4.5) ──
    // Both ride the States table (content.js C.states rows `equip:<card>` and `zone:<card>`, all hidden so a card's name never reaches a public damage note).
    // An equip is one grant on the owner or an ally within reach; the group `cardEquip` makes a second one replace the first. A zone is one record in s.cardplay.zones,
    // at most ONE per side (a new one from any owner on that side replaces it), and its hidden row is granted to every living unit of the affected side inside it and taken
    // back from any that is not: Cards.sweep runs at every unit's turn start and after every action (so stepping out, or being pushed out, ends the row at once), and
    // Cards.zoneTick counts the rounds down at round end. Nothing strips a zone, and its owner's defeat does not end it: a field is the arena, not the unit.
    const zonesOf = (s) => s.cardplay?.zones || [];
    const inZone = (s, z, u) => !u.defeated && !u.escaped && !u.notArrived && (z.affects === "own" ? u.side === z.side : u.side !== z.side) && dist(s, z.x, z.y, u.x, u.y) <= z.radius && H.dreamSame(s, z.x, z.y, u.x, u.y);
    // The tiles of every zone, for the board's ground highlight (the ui draws them magenta): the same test as the sweep, so the highlight is exactly where the rows are granted.
    function zoneTiles(s) {
      return zonesOf(s).map((z) => { const tiles = []; for (let y = z.y - z.radius; y <= z.y + z.radius; y++) for (let x = z.x - z.radius; x <= z.x + z.radius; x++) if (H.inside(s, x, y) && dist(s, z.x, z.y, x, y) <= z.radius && H.dreamSame(s, z.x, z.y, x, y)) tiles.push([x, y]); return { cardId: z.cardId, side: z.side, affects: z.affects, tiles }; });
    }
    function dropZone(s, z) { for (const u of Object.values(s.actors)) if (u.states?.[`zone:${z.cardId}`]) H.States.remove(s, u, `zone:${z.cardId}`, "the zone is gone"); }
    function sweep(s) {
      for (const z of zonesOf(s)) {
        const id = `zone:${z.cardId}`;
        for (const u of Object.values(s.actors)) {
          const hit = inZone(s, z, u), held = u.states?.[id];
          if (hit && !held) H.States.grant(s, u, id, { by: z.owner, count: z.roundsLeft });
          else if (hit && held) held.count = z.roundsLeft;
          else if (!hit && held) H.States.remove(s, u, id, "it left the zone");
        }
      }
    }
    function zoneTick(s) {
      const cp = s.cardplay; if (!cp?.zones?.length) return;
      for (const z of cp.zones) z.roundsLeft -= 1;
      for (const z of cp.zones.filter((q) => q.roundsLeft <= 0)) dropZone(s, z);
      cp.zones = cp.zones.filter((q) => q.roundsLeft > 0);
    }
    function placeZone(s, a, card, at) {
      const cp = s.cardplay, Z = card.zone;
      for (const old of cp.zones.filter((q) => q.side === a.side)) dropZone(s, old);
      cp.zones = cp.zones.filter((q) => q.side !== a.side);
      cp.zones.push({ cardId: card.id, owner: a.id, side: a.side, affects: Z.side, x: at[0], y: at[1], radius: Z.radius, roundsLeft: Z.rounds });
      sweep(s);
    }

    // ── the summon kind (C3, CARDS.md 4.3) ──
    // A familiar is a companion-style body built fresh from an object literal (the way callCompanion builds one, conditions.js: nothing of the owner's running state is copied),
    // on the owner's side, in the owner's summon slot (EmergentIdeas.summonerOf reads `companion.card`), with a scripted turn: it strikes the nearest foe in reach or wards an ally.
    const summonsMod = () => (typeof module === "object" && module.exports ? require("../summons/summons.js") : globalThis.ConceptCombatSummons);
    const familiarRules = () => dat().rules.familiar;
    function familiarSpot(s, a) {
      const occupied = new Set(Object.values(s.actors).filter((x) => !x.defeated).map((x) => `${x.x},${x.y}`)), blocked = H.arrivalBlocked?.(s);
      if (blocked) for (const k of blocked) occupied.add(k);
      const at = summonsMod().placeSummon(H.moduleArena(s.arena), [a.x, a.y], occupied, null);
      return at && H.dreamSame(s, a.x, a.y, at[0], at[1]) ? at : null;
    }
    function familiarSlot(s, a) {
      const p = H.summonProfile(s, a.id); return p.active.length < p.maxActive ? null : `All ${p.maxActive} summon slot${p.maxActive === 1 ? " is" : "s are"} occupied.`;
    }
    function spawnFamiliar(s, a, card, e) {
      const R = familiarRules(), at = familiarSpot(s, a); if (!at) return;
      const theme = a.character === "warden" || traitIds(a).includes("fullBeliever"), bodies = e.bodies || 1;
      const lf = e.lf + (theme ? R.thematicLf : 0), turns = e.turns + (theme ? R.thematicTurns : 0), kit = R.kits[e.mode];
      const id = `familiar-${card.id}-${a.id}`;
      const f = { id, name: card.name, side: a.side, controller: "ai", ai: "ally", character: `card:${card.id}`, sprite: card.art.key, primary: kit[0], secondary: kit[1],
        maxLF: lf, lf, x: at[0], y: at[1], companion: { owner: a.id, key: `card:${card.id}`, turnsLeft: turns, card: true, mode: e.mode, potency: e.potency, bodies, leave: "fades", leaveReason: "faded" },
        pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, level: a.level || 1, xp: 0, proficiency: a.proficiency || 1, reserve: [], reserveSlots: 0, pendingSwap: null, lens: {},
        reaction: 0, moved: false, acted: false, tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, guardUsedThisTurn: false,
        ownerTurns: 0, lastRecoverTurn: -99, status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null }, inventory: [], inventoryCapacity: 0,
        passives: {}, traits: [], conditions: {}, lanyardUsed: false, bristleconeUsed: false, lastDamageType: null, defeated: false };
      s.actors[id] = f; s.disclosures[id] = {}; s.knowledge[id] = {}; if (s.observedAbilities) s.observedAbilities[id] = [];
      const IR = H.insightRules;
      if (IR) { const deck = IR.buildDeck({ key: "summon:*", kind: "summon" }, { seed: s.seed }); s.insight.decks[id] = deck; s.insight.knowledge[id] = IR.spawnKnowledge(deck); }
      for (const other of Object.values(s.actors)) if (other.id !== id && other.side !== f.side) { (s.knowledge[other.id] ||= {})[id] ||= { secondary: false, lens: false, abilities: {} }; s.knowledge[id][other.id] = { secondary: false, lens: false, abilities: {} }; }
      s.order.splice(s.turnIndex + 1, 0, id);
      log(s, { kind: "summon", actor: id, tiles: [at], text: `${f.name} appears at (${at[0]},${at[1]}) for ${turns} turns.` });
    }
    function familiarTurn(s, a) {
      const c = a.companion, R = familiarRules(), owner = s.actors[c.owner]; if (!c?.card || a.defeated) return;
      for (let i = 0; i < c.bodies; i++) {
        if (c.mode === "strike") {
          const foes = foesOf(s, a).filter((t) => dist(s, a.x, a.y, t.x, t.y) <= R.reach && visibleFoe(s, a, t)).sort((p, q) => dist(s, a.x, a.y, p.x, p.y) - dist(s, a.x, a.y, q.x, q.y) || (p.id < q.id ? -1 : 1));
          if (!foes.length) break;
          hit(s, a, foes[0], instOf("nigredo"), c.potency, [], { label: `${a.name}'s blow`, damageType: "nigredo" });
        } else {
          const mates = Object.values(s.actors).filter((u) => u.id !== a.id && u.side === a.side && !u.defeated && !u.escaped && !u.notArrived && dist(s, a.x, a.y, u.x, u.y) <= R.reach)
            .sort((p, q) => foeFrac(p) - foeFrac(q) || (p.id < q.id ? -1 : 1));
          const t = mates[0] || (owner && !owner.defeated ? owner : null); if (!t) break;
          if ((t.status.ward?.protection || 0) < c.potency) t.status.ward = { label: "Ward", owner: t.id, expiresAt: t.ownerTurns + 1, protection: c.potency };
          log(s, { kind: "effect", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${a.name} wards ${t.name} for ${c.potency}.` });
        }
      }
    }

    // A set's condition is read when it FIRES, not when it is placed ("waiting it out" is a counter of Stubborn Ledger): the attacker's distance for "foe within", the owner's own LF for "your LF is below".
    function setCondition(s, a, card, ctx) {
      const c = card.condition, atk = ctx?.attacker, need = () => `Needs: ${lib().needs(card)}.`;
      if (c.id === "foeWithin" && atk) return dist(s, a.x, a.y, atk.x, atk.y) <= c.n ? null : need();
      if (c.id === "foeLfBelow" && atk) return dist(s, a.x, a.y, atk.x, atk.y) <= (card.range || dat().rules.foeLfRange) && foeFrac(atk) < c.n ? null : need();
      return conditionReason(s, a, card);
    }
    // What an Observe rip of a set CARD asks of the study: more AP the more powerful the card (rules.rip: `ap` per `perPoints` of deck cost, at least one step, at most `max`; a study is 10 to 50 AP).
    const ripAp = (entry) => { const R = dat().rules.rip, c = lib().byId(entry.cardId); return Math.min(R.max, R.ap * Math.max(1, Math.ceil((c?.cost || 1) / R.perPoints))); };
    const TRIGGER = { onAttacked: "on-attacked", onTurnStart: "on-turn-start", manual: "manual" };   // the card's trigger words -> Mystery's

    // ── check / options ──
    // The one question: may this unit play deck entry `index` now, at `target`? A string is the reason it may not (section 3.2 order).
    function check(s, a, index, target = null, trigger = null) {
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
      if (card.kind === "set") {   // C2: placing a set is the turn's card; its condition waits for the trigger, and Mystery's budget (3 a side, shared with ability plans) is the room
        if (trigger && !card.trigger.includes(trigger)) return `${card.name} does not use that trigger.`;
        return H.mysteryRoom?.(s, a.side) ? null : `Face-down budget spent (${dat().rules.mystery?.budget ?? 3} per side).`;
      }
      const why = conditionReason(s, a, card); if (why) return why;
      if (card.kind === "summon") {   // C3: the owner's summon slot (shared with the palace summon) and an open tile nearby, in the same Dream region
        const slot = familiarSlot(s, a); if (slot) return slot;
        if (!familiarSpot(s, a)) return "There is no open tile nearby for the familiar.";
      }
      if (card.kind === "field" || (card.kind === "equip" && card.target !== "self")) {   // C4: the zone's centre tile, or the unit that takes the equip
        const legal = targetsOf(s, a, card), what = card.kind === "field" ? "Choose a tile within " + dat().rules.zone.reach + " of you." : "Choose yourself or an ally within " + dat().rules.zone.reach + ".";
        if (!legal.length) return card.kind === "field" ? "There is no tile for a zone." : "Nobody can wear that.";
        if (!target) return "Choose a target.";
        if (!Array.isArray(target) || !legal.some((p) => p[0] === target[0] && p[1] === target[1])) return what;
      } else if (card.target === "foe" || card.target === "tile") {
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
        const picks = card.target === "foe" || card.target === "tile" || card.target === "ally";   // C4: a zone's tile and an equip's unit are picked like a foe
        const reason = entry.used ? `Played in round ${entry.usedRound}.` : check(s, a, index, picks ? (targetsOf(s, a, card)[0] || null) : null);
        const targets = !entry.used && picks ? targetsOf(s, a, card) : [];
        return { index, id: card.id, name: card.name, kind: card.kind, kindLabel: dat().kinds[card.kind].label, rarity: card.rarity, cost: card.cost, text: L.textOf(card), triggers: card.kind === "set" ? card.trigger : [],
          state: entry.used ? "used" : reason ? "blocked" : "ready", reason: reason || "", needsTarget: picks, targets };
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
        } else if (e.key === "familiar") spawnFamiliar(s, a, card, e);
        else throw new Error(`card effect ${e.key} is not part of the instant menu`);
      }
    }
    // Show your hand (18.4): from the owner's NEXT turn, card damage against a foe it showed (and that is still aware) is 10% higher, at most +3.
    function showBonus(s, a, t, potency) {
      const by = book(s, a.id), R = dat().rules.showHand;
      if (!by?.shown || !(a.ownerTurns > by.shownAt) || !by.shownTo.includes(t.id) || !aware(s.actors[t.id])) return 0;
      return Math.min(R.bonusMax, Math.floor(potency * R.bonusPct + 0.5));
    }
    // One card event in the log: the generic public line, and the private text the owner, the owner's side and the aware foes who perceived it may read. `seenText` is what those aware foes
    // read when it differs from the owner's text (a set placed face-down names no card to them); `null` there means they read the name too.
    function cardEvent(s, a, card, text, seenText = null) {
      const i = s.log.length, cp = s.cardplay, seenBy = [], watchers = [];   // watchers: every foe that perceives it (the skeptics gather evidence from it; the aware may read it)
      for (const o of Object.values(s.actors)) if (o.id !== a.id && o.side !== a.side && !o.defeated && !o.escaped && !o.notArrived && perceives(s, o, a)) { watchers.push(o.id); if (aware(o)) seenBy.push(o.id); }
      cp.priv[i] = { owner: a.id, id: card.id, seenBy, text, ...(seenText ? { seenText } : {}) };
      log(s, { kind: "cardPlay", actor: a.id, tiles: [[a.x, a.y]], witnesses: watchers, text: `${nameless(a)} does something that does not add up.` });
      return s.actors[a.id];   // the witness hook may have replaced this unit's object (a skeptic's evidence is written as a copy)
    }
    function play(s, a, act) {
      const L = lib(), by = book(s, a.id), entry = by?.deck?.[act.card];
      const target = Array.isArray(act.target) ? act.target : null;
      const why = check(s, a, act.card, target, act.trigger || null); if (why) return why;
      const card = L.byId(entry.id);
      if (by.played >= dat().rules.deck.maxCards) return "No more cards can be played this battle.";   // termination: at most one play per deck entry, a deck is at most 12
      if (card.kind === "field" || card.kind === "equip") {   // C4: a zone on a tile, or an equip on a unit: a grant or a record, never a hit
        const wearer = card.kind === "equip" ? (card.target === "self" ? a : H.actorAt(s, target[0], target[1])) : null;
        entry.used = true; entry.usedRound = s.round; by.turnStamp = a.ownerTurns; by.played += 1;
        a = cardEvent(s, a, card, `${a.name} plays ${card.name}${wearer && wearer.id !== a.id ? ` on ${wearer.name}` : ""}. ${L.textOf(card)}`);
        if (card.kind === "equip") {
          H.States.remove(s, wearer, "cardLethal", "the old equip is gone");   // a replacing equip takes the shared save unless it grants it again below
          H.States.grant(s, wearer, `equip:${card.id}`, { by: a.id });
          if (card.effects.some((e) => e.key === "lethalSave")) H.States.grant(s, wearer, "cardLethal", { by: a.id, count: card.equip.turns });
        } else placeZone(s, a, card, target);
        return null;
      }
      if (card.kind === "set") {   // C2: face-down on Mystery's list; the effect waits for the trigger and resolves once (resolveSet)
        const bad = H.mysteryPlace(s, a, { unitId: a.id, side: a.side, kind: "card", cardId: card.id, ability: null, trigger: TRIGGER[act.trigger || card.trigger[0]], phase: card.phase || "after", target: null, setRound: s.round || 1, setTurn: a.ownerTurns, age: 0 });
        if (bad) return bad;
        entry.used = true; entry.usedRound = s.round; by.turnStamp = a.ownerTurns; by.played += 1;
        cardEvent(s, a, card, `${a.name} sets ${card.name} face-down (${H.mysteryCardCount(s, a.id)} card${H.mysteryCardCount(s, a.id) === 1 ? "" : "s"} down). ${L.textOf(card)} A foe's Observe needs ${ripAp({ cardId: card.id })} AP of study to rip it open.`, `${a.name} sets a card face-down.`);
        return null;
      }
      entry.used = true; entry.usedRound = s.round; by.turnStamp = a.ownerTurns; by.played += 1;
      // A skeptic in sight gathers evidence through the witness hook in log() (belief-conversion.js); the public line is generic.
      const cp = s.cardplay;
      a = cardEvent(s, a, card, `${a.name} plays ${card.name}. ${L.textOf(card)}`);
      cp.depth += 1;
      try { resolve(s, a, card, target); } finally { cp.depth -= 1; }
      return null;
    }

    const RIP_VICTIM = ["damage", "push", "stagger", "root", "itemLock", "reveal"];   // the effects that need a victim: a ripped set that has any of them fires at the Observer (R-20261103-26, R-20261104-03)
    // A face-down set CARD fires (Mystery calls this from fireCard; no act reaches it). Returns the reason it HOLDS (Mystery puts it back down) or null once it has resolved.
    // The chain rule: while any card is resolving (depth >= 1) no set fires, and a set card resolves at depth 1 itself, so a set never springs another set.
    // `ctx` = { attacker, hurt } from an on-attacked trigger; a rip or a manual/turn-start trigger has none. For an effect that needs a victim: a MANUAL set picks the nearest foe in reach and sight or HOLDS (stays down); a turn-start set with no victim fires its own-side effects and is spent; a rip is handled below.
    // R-20261103-26 (Mala, 2026-11-03) and R-20261104-03 (a set with no damage, Mala 2026-11-04): an Observe rip of a face-down card set that has a victim effect (damage, or root, stagger, push, reveal, item lock) fires at the Observer if the Observer is still a valid target of it, and the Observer gets a reaction window
    // (the rip is an announced attack without the power boost, one window per ripped card); if the Observer is out of reach or the card's condition is not met the card is wasted (gone, does nothing).
    // Valid = a foe of the setter, in sight and the same Dream region, within the card's reach (its range, or the condition's `n` when smaller), and the set's condition read at the rip.
    // The card's other effects: a ward or a heal fire on the setter's own side at once, as before; the damage and any control effect (root, stagger, push, reveal, item lock) land on the Observer together when the window closes, if it still stands on the announced tile (finishRip).
    function ripSet(s, a, entry, card, ctx, why) {
      const L = lib(), R = dat().rules, obs = ctx.observer ? s.actors[ctx.observer] : null;
      const reach = Math.min(card.range || R.defaultRange, card.condition?.id === "foeWithin" ? card.condition.n : Infinity);
      const valid = !!obs && !obs.defeated && !obs.escaped && !obs.notArrived && obs.side !== a.side && visibleFoe(s, a, obs) && dist(s, a.x, a.y, obs.x, obs.y) <= reach && !setCondition(s, a, card, { attacker: obs });
      if (!valid) { cardEvent(s, a, card, `${a.name}'s ${card.name} is ripped open with no one to strike, and is wasted. ${L.textOf(card)}`, `${a.name}'s hidden card is ripped open and fizzles.`); return null; }
      cardEvent(s, a, card, `${a.name}'s ${card.name} springs (${why || "ripped by Observe"}) at ${obs.name}. ${L.textOf(card)}`);
      a = s.actors[a.id]; const cp = s.cardplay;
      cp.depth += 1;
      try { resolve(s, a, { ...card, effects: card.effects.filter((e) => !RIP_VICTIM.includes(e.key)) }, [obs.x, obs.y]); } finally { cp.depth -= 1; }   // the card's own-side effects (a ward, a heal), now
      const dmg = card.effects.find((e) => e.key === "damage");
      const inst = { name: "A hidden blow", ability: "cardRip", concept: null, owner: a.id, tier: "basic", effect: "damage", target: "enemy", delivery: "contact", area: { shape: "single" }, potency: dmg ? dmg.potency : 0, damageType: dmg ? dmg.type : "nigredo",
        tiles: [[obs.x, obs.y]], targets: [obs.id], aim: [obs.x, obs.y], announcedTiles: [[obs.x, obs.y]], announced: true, revelation: 1, mult: 1, cardRip: true, ripCardId: card.id };
      H.openResponseWindow(s, a, inst, { announce: "Something hidden springs." });   // generic: an unaware foe is not told it is a card (CARDS.md 18.3)
      return null;
    }
    // The window closed: the blow, and any control effect (root, stagger, push, reveal, item lock), land on the Observer if it still stands on the announced tile (a dodge or a reposition moved it out), as any announced attack does.
    H.cardsFinishRip = finishRip;   // window.js closes a ripped card's reaction window through this (a host hook beside the Cards object, so the export line stays untouched)
    function finishRip(s, a, inst) {
      const obs = s.actors[inst.targets[0]], at = inst.tiles[0], cp = s.cardplay, card = lib().byId(inst.ripCardId);
      if (!obs || obs.defeated || obs.x !== at[0] || obs.y !== at[1]) { log(s, { kind: "effect", actor: a.id, text: "The hidden card finds no one." }); return; }
      cp.depth += 1;
      try {
        const dmg = card?.effects.find((e) => e.key === "damage");
        if (dmg) hit(s, a, obs, instOf(inst.damageType), inst.potency + showBonus(s, a, obs, inst.potency), [], { label: "A hidden blow", damageType: inst.damageType });   // the same blow a normal fire deals (the shown-hand bonus included)
        const control = (card?.effects || []).filter((e) => RIP_VICTIM.includes(e.key) && e.key !== "damage");
        if (control.length && !obs.defeated) resolve(s, a, { ...card, effects: control }, [obs.x, obs.y]);
      } finally { cp.depth -= 1; }
    }
    function resolveSet(s, a, entry, targetOverride, why, ctx) {
      const L = lib(), card = L.byId(entry.cardId), cp = s.cardplay;
      if (!card || card.kind !== "set" || !cp) return "That set is no longer in the game.";
      if (cp.depth >= 1) return "A set cannot fire inside another card.";
      if (ctx?.rip && card.effects.some((e) => RIP_VICTIM.includes(e.key))) return ripSet(s, a, entry, card, ctx, why);   // R-20261103-26 (damage) and R-20261104-03 (a set with no damage): the Observer is the target, with a reaction window
      if (a.ownerTurns === entry.setTurn && H.currentId(s) === a.id) return "A set is armed when its owner's turn ends.";
      if (entry.phase === "after" && ctx?.attacker && !(ctx.hurt > 0)) return "The blow hurt nothing.";
      const no = setCondition(s, a, card, ctx); if (no) return no;
      const needsVictim = card.effects.some((e) => RIP_VICTIM.includes(e.key));
      let victim = null;
      if (needsVictim) {
        if (ctx?.attacker) victim = ctx.attacker.defeated ? null : ctx.attacker;
        else {
          const legal = targetsOf(s, a, { ...card, target: "foe" }).map((p) => p.slice());
          const pick = (Array.isArray(targetOverride) && legal.find((p) => p[0] === targetOverride[0] && p[1] === targetOverride[1])) || legal.sort((p, q) => dist(s, a.x, a.y, p[0], p[1]) - dist(s, a.x, a.y, q[0], q[1]) || (p[0] - q[0]) || (p[1] - q[1]))[0];
          victim = pick ? H.actorAt(s, pick[0], pick[1]) || null : null;
        }
        if (!victim && entry.trigger === "manual") return "No foe in reach and in sight.";   // a manual or turn-start set with nothing to hit waits for one; an attacker-less rip simply finds none
      }
      cardEvent(s, a, card, `${a.name}'s ${card.name} springs (${why || "its trigger"}). ${L.textOf(card)}`);
      a = s.actors[a.id];
      cp.depth += 1;
      try { resolve(s, a, card, victim ? [victim.x, victim.y] : null); } finally { cp.depth -= 1; }
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
      const L = lib(), counts = { unused: unusedCount(by), deckSize: by.deck.length, sets: H.mysteryCardCount?.(s, ownerId) || 0, fields: zonesOf(s).filter((z) => z.owner === ownerId).length };
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
      if (viewerId === p.owner || viewer.side === owner.side) return { text: p.text, id: p.id };
      if (p.seenBy.includes(viewerId)) return p.seenText ? { text: p.seenText, id: null } : { text: p.text, id: p.id };   // a set placed face-down names no card to an aware foe
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

    return { Cards: { init, options, check, play, resolveSet, sweep, zoneTick, zoneTiles, familiarTurn, ripAp, showHand, showOptions, viewFor, logFor, aware } };
  })();
});
