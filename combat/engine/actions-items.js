"use strict";
// Actions, the items family: takeFromCart, dropItem, cook, playCard, showHand, useItem, catchFish.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsItems = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { ClassRuntime, accountItems, actorAt, barrierAt, checkOutcome, dist, inside, log, pickupRules, saveWildWorld, spendTempo, tileAt, wildRules,
      wildSnapshot } = H;
    const { Cooking, hermitCharge } = K;
    const family = {
      takeFromCart(s, a, act) {   // an ally beside the Maid takes an item out of her cart (Mala, 2026-10-14; classes/class-runtime.js cartOf)
        const maid = s.actors[act.from], cart = ClassRuntime?.cartOf?.(s, maid);
        if (!maid || maid.defeated || !cart) return "There is no Maid's cart to take from.";
        if (maid.side !== a.side || maid.id === a.id) return "Only an ally can take from her cart, and not the Maid herself (she uses Restore).";
        if (Math.max(Math.abs(maid.x - a.x), Math.abs(maid.y - a.y)) > 1) return "Stand beside her to reach the cart.";
        const at = (cart.stored || []).findIndex((x, i) => x.kind === "item" && (act.item == null || x.item === act.item) && (act.index == null || i === act.index));
        if (at < 0) return "There is no item like that in the cart.";
        if ((a.inventory || []).length >= (a.inventoryCapacity || 0)) return `Your hands are full (${a.inventoryCapacity || 0} slots).`;
        const spendError = spendTempo(s, a, s.rules.actionCosts.utility ?? 10, "Take from the cart"); if (spendError) return spendError;
        const [taken] = cart.stored.splice(at, 1); a.inventory = [...(a.inventory || []), taken.item];
        log(s, { kind: "pickup", actor: a.id, item: taken.item, from: maid.id, text: `${a.name} takes ${taken.name} from ${maid.name}'s cart.`, why: [`${cart.stored.length}/3 left in the cart.`] });
      },
      dropItem(s, a, act) {   // set down a carried item and leave it (Mala, 2026-10-18: no way to get rid of pack items mid-battle)
        const item = act.item, i = (a.inventory || []).indexOf(item);
        if (i < 0) return "You are not carrying that item.";
        const name = accountItems?.consumables?.[item]?.name || wildRules?.data?.items?.[item]?.name || pickupRules?.sources?.[item]?.name || item;
        a.inventory = [...(a.inventory || [])]; a.inventory.splice(i, 1);
        log(s, { kind: "dropItem", actor: a.id, item, text: `${a.name} drops ${name} and leaves it behind.` });
      },
      // Cook in battle (Mala, 2026-10-25; account/cooking.js): anyone makes the field recipes, cooks make every recipe. The
      // ingredients come out of the pack and the dish goes back in, so a pack never grows; the AI never cooks.
      cook(s, a, act) {
        const K = Cooking(); if (!K) return "Cooking is unavailable.";
        const held = (x) => x && (x.until == null || x.until >= a.ownerTurns);
        if (held(a.status?.cuffed) || held(a.status?.detained)) return "Cuffed hands can't cook.";
        const isCook = K.isCook(a), r = K.cook(a.inventory || [], act.recipe, { inBattle: true, cook: isCook });
        if (!r.ok) return r.reason;
        const ap = a.passives?.cookApOverride ?? K.rules.cookAp[r.recipe.field ? "field" : "full"];   // Chef Knives: cooking costs 5 AP for the wearer
        const spendError = spendTempo(s, a, ap, `Cook ${r.recipe.name}`); if (spendError) return spendError;
        const nameOf = (id) => accountItems?.consumables?.[id]?.name || id, used = r.used.map((k) => a.inventory[k]);
        a.inventory = [...r.rest, r.out];
        log(s, { kind: "cook", actor: a.id, item: r.out, used, text: `${a.name} cooks ${nameOf(r.out)} from ${used.map(nameOf).join(" and ")}.`,
          why: [`${ap} action points${isCook ? " (a cook: every recipe works mid-battle)" : " (a field recipe: anyone can make it mid-battle)"}.`, r.recipe.teach].filter(Boolean) });
      },
      // Battle Cards (engine/cards.js, specs/CARDS.md 3.2 and 18.4): one door for the player and the AI. No AP, no phi, no reaction, no window.
      playCard(s, a, act) { return H.Cards.play(s, a, act); },
      showHand(s, a) { return H.Cards.showHand(s, a); },
      useItem(s, a, act) {
        const item = act.item, at = act.target || [a.x, a.y];
        const held = (x) => x && (x.until == null || x.until >= a.ownerTurns);
        if(a.status?.scribedItemLock?.expiresAt>a.ownerTurns) return "Items are restricted by a scribed effect.";
        if (held(a.status?.cuffed) || held(a.status?.detained)) return "Cuffed hands can't use items.";
        const watched = Object.values(s.actors).some((u) => u.side !== a.side && !u.defeated && u.primary === "legitimacy" && u.secondary === "constraint" && Math.abs(u.x - a.x) + Math.abs(u.y - a.y) <= 1);
        if (watched) return "Not on my watch: an adjacent officer bars consumables.";
        if (!a.inventory.includes(item)) return "You are not carrying that item.";
        const accountItem = accountItems?.consumables?.[item];
        if (accountItem && !accountItem.effect?.wild) {
          const effect = accountItem.effect || {};
          if (effect.hire) return H.Hires.call(s, a, item, accountItem) || undefined;   // a merc contract or a letter of safe conduct (engine/hires.js)
          const range = effect.placeBarrier || effect.blockSightTiles || effect.observe ? 4 : 0;
          if (!inside(s, at[0], at[1]) || dist(s, a.x, a.y, at[0], at[1]) > range) return `Choose a tile within ${range} spaces.`;
          const hurtBeside = effect.healAdjacentAllies ? Object.values(s.actors).filter((u) => u.id !== a.id && u.side === a.side && !u.defeated && !u.notArrived && u.lf < u.maxLF && Math.max(Math.abs(u.x - a.x), Math.abs(u.y - a.y)) <= 1) : [];
          const lfFull = effect.heal && a.lf >= a.maxLF, pfFull = effect.phiForce && a.pf >= a.maxPF;
          if (lfFull && !hurtBeside.length && (!effect.phiForce || pfFull)) return "Life Force is already full.";
          if (pfFull && !effect.heal) return "ΦF is already full.";
          if (effect.ultCharge && (a.ultimateCharge || 0) >= s.rules.ultimateChargeMax) return "Your ultimate charge is already full.";
          if (effect.placeBarrier && (actorAt(s, at[0], at[1]) || barrierAt(s, at[0], at[1]) || tileAt(s, at[0], at[1]).blocksMove)) return "Choose an empty floor tile for the sandbag.";
          const useAp = Cooking()?.useCost(item, s.rules.actionCosts.utility, a) ?? s.rules.actionCosts.utility;   // better consumables cost less: food by preparation, the rest by rarity (account/cooking.js)
          const spendError = spendTempo(s, a, useAp, `Use ${accountItem.name}`); if (spendError) return spendError;
          a.inventory.splice(a.inventory.indexOf(item), 1);
          if (effect.ultCharge) { const n = Math.min(effect.ultCharge, s.rules.ultimateChargeMax - (a.ultimateCharge || 0)); a.ultimateCharge = (a.ultimateCharge || 0) + n; log(s, { kind: "item", actor: a.id, text: `${accountItem.name}: +${n} ultimate charge.` }); }
          if (effect.heal && a.lf < a.maxLF) { const n = Math.min(effect.heal, a.maxLF - a.lf); a.lf += n; log(s, { kind: "item", actor: a.id, text: `${accountItem.name} restores ${n} LF.` }); }
          if (effect.phiForce && a.pf < a.maxPF) { const n = Math.min(effect.phiForce, a.maxPF - a.pf); a.pf += n; log(s, { kind: "item", actor: a.id, text: `${accountItem.name} restores ${n} ΦF.` }); }
          for (const u of hurtBeside) { const n = Math.min(effect.healAdjacentAllies, u.maxLF - u.lf); u.lf += n; log(s, { kind: "item", actor: a.id, target: u.id, text: `${u.name} shares the ${accountItem.name}: +${n} LF.` }); }
          if (effect.actionPoints) { a.tempo += effect.actionPoints; a.tempoCapacity += effect.actionPoints; log(s, { kind: "item", actor: a.id, text: `${accountItem.name} restores ${effect.actionPoints} action points this turn.` }); }
          if (effect.observe) { s.surveyFlag = (s.surveyFlag || 0) + effect.observe; log(s, { kind: "item", actor: a.id, text: `${accountItem.name} is ready to reveal one enemy technique; choose Observe next.` }); }
          if (effect.placeBarrier) { const b = effect.placeBarrier; s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x: at[0], y: at[1], protection: b.protection, duration: b.duration, expiresAt: a.ownerTurns + b.duration, concept: "barrier" }); log(s, { kind: "item", actor: a.id, tiles: [at], text: `${accountItem.name} places a ${b.protection}-protection wall at (${at[0]},${at[1]}).` }); }
          if (effect.blockSightTiles) { const b = effect.blockSightTiles, tiles = []; for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) if (dist(s, at[0], at[1], x, y) <= b.radius) { tiles.push([x,y]); s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x, y, protection: 0, duration: b.duration, expiresAt: a.ownerTurns + b.duration, concept: "smoke", blocksSight: true }); } log(s, { kind: "item", actor: a.id, tiles, text: `${accountItem.name} releases sight-blocking smoke around (${at[0]},${at[1]}).` }); }
          if (effect.autoCorrectQuestion) { s.summonQuestionBoost += effect.autoCorrectQuestion; log(s, { kind: "item", actor: a.id, text: `${accountItem.name} guarantees your next summon question.` }); }
          hermitCharge(s, a, "eat");   // Eat Good: a consumed consumable
          return;
        }
        if (!wildRules || !pickupRules) return "Items are unavailable.";
        const itemRange = wildRules.data.items[item]?.range;
        if (itemRange == null || !inside(s, at[0], at[1]) || dist(s, a.x, a.y, at[0], at[1]) > itemRange) return `Choose a tile within ${itemRange ?? 0} spaces.`;
        const spendError = spendTempo(s, a, s.rules.actionCosts.utility, "Use item"); if (spendError) return spendError;
        a.inventory.splice(a.inventory.indexOf(item), 1);
        const result = wildRules.useItem(wildSnapshot(s), item, at); saveWildWorld(s, result.world);
        for (const ev of result.events) log(s, { kind: ev.kind, actor: a.id, tiles: ev.at ? [ev.at] : ev.tiles, text: ev.text || ev.kind });
        checkOutcome(s);
      },
      catchFish(s, a, act) {   // dream fish (engine/conditions.js fishRound): from beside the water, or standing in it
        const R = s.rules.fish; if (!R) return "There are no fish in this battle.";
        const f = H.fishNear(s, a).find((x) => !act.at || (x.x === act.at[0] && x.y === act.at[1])); if (!f) return "Stand beside a fish in the water.";
        if (a.tempo < R.catchAp) return `Catching a fish takes ${R.catchAp} action points.`;
        spendTempo(s, a, R.catchAp, "Catch a fish"); s.fish = s.fish.filter((x) => x.id !== f.id);
        const room = (a.inventory || []).length < (a.inventoryCapacity ?? 2);
        if (room && !act.eat) { (a.inventory ||= []).push("dreamFish"); log(s, { kind: "item", actor: a.id, tiles: [[f.x, f.y]], text: `${a.name} catches a dream fish (in the pack: eat it for +${R.ultCharge} ultimate charge).` }); }
        else { const before = a.ultimateCharge || 0; a.ultimateCharge = Math.min(s.rules.ultimateChargeMax, before + R.ultCharge);
          log(s, { kind: "item", actor: a.id, tiles: [[f.x, f.y]], text: `${a.name} catches a dream fish and eats it: +${a.ultimateCharge - before} ultimate charge.` }); }
      },
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-items.js)`);
    Object.assign(K.handlers, family);
  })();
});
