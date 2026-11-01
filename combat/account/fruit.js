"use strict";
// Sinkerfruit on the account (OP1, Lookout BD, 2026-10-27; spec ~/loci-orbit/ready-to-review/claude-onepiece/specs/SINKERFRUIT.md).
// Mala, 2026-10-27: "yes build sinkerfruit first, refuse the second fruit". Exactly one of each fruit exists, in one
// place: the world pool, your stash, or eaten (you). A won battle can surface a pooled fruit (1 in 40). Eating one is
// forever: you never swim again (the battle side is engine/fruit.js). A second fruit is refused. A saga close returns
// the eaten fruit to the tide (the pool), and the eater can swim again (sagas.js close, called from the Field Kit's saga card).
//
//   RULES                          → tunables (pool, drop chance, ripening)
//   FRUITS                         → id → { name, family, line } for the three fruits
//   poolOf(account)                → { coil|hide|mist: "pool" | "stash" | "eaten" }
//   stashOf(account)               → fruit ids in the stash
//   eaten(account)                 → { id, eatenAt } or null
//   ripe(account)                  → true after RULES.ripeAfter battles with the fruit
//   rollDrop(account, { seed })    → { account, dropped: id | null, line } after a won battle
//   afterBattle(account, { won, test, seed }) → the battle-end gate ui.js calls: a loss or a test battle (practice, Dev
//                                    Playground, autoplay: they save nothing) never rolls; a real win rolls rollDrop
//   eat(account, id)               → { ok, account, line } | { ok: false, error } (a second fruit is refused)
//   battleOpts(account)            → { id, ripe } for engine create (opts.fruit), or null
//   returnToTide(account)          → { account, line } (a saga close: the eaten fruit goes back to the pool)
// Wanted + sale (OP1 §6-7, codex-sinkerfruit-wanted; Mala OP-Q1: Wanted rides inside OP1):
//   posted(account)                → the live player bounty or null
//   hunterFor(account, { seed })   → a hunter roster id (~1 battle in 8 while posted), or null
//   sellFruit(account, id)         → { ok, account, line } (stash → sold, 400 owed by the tide)
//   settleFruit(account, opts)     → { account, lines } (installments, sold returns, hunter purse, loss claim, ripe raise)
// Respec S1a (Tiller BD, 2026-11-01; spec claude-sinkerfruit-respec-spec "Rev 2026-11-01"; Mala: "start working on the fruit slices").
// Feats instead of the 30-battle timer, behind RULES.respec (false): off, nothing below changes a single result.
//   FEATS                          → fruit id → [{ id, label, needsRipe }]: the feats the live basics can earn (S1b adds the rest)
//   masteryOf(account)             → { feats: [], shapes: [] } (a fresh one when the account has none)
//   stage(account)                 → null (no fruit) | "fresh" | "ripe" | "awakened"
//   settleFeats(account, { feats, shapes, won, shaped, drained, test }) → { account, lines } counts each feat once per account
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatFruit = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // Lazy leaves (no load-order knot): bingo/mint/market resolve at call time, node or page.
  const need = (path, global) => { try { if (typeof module === "object" && module.exports) return require(path); } catch {} return (typeof self !== "undefined" ? self[global] : null); };
  const bingoLib = () => need("../law/bingo.js", "ConceptCombatBingo");
  const mintLib = () => need("./mint.js", "ConceptCombatMint");
  const marketLib = () => need("./market.js", "ConceptCombatMarket");
  const RULES = { dropPerWin: 1 / 40, ripeAfter: 30,
    wantedPost: 20, wantedRipe: 30, hunterPerBattle: 1 / 8, purse: 30,
    salePrice: 400, installment: 50, soldReturnAfter: 40,
    respec: false, ripeFeats: 3, awakenFeats: 6 };   // respec: false = the 30-battle timer exactly as landed; true = feats ripen and awaken the fruit
  const HUNTERS = ["fbi_agent", "tactical_operative", "cloaked_drifter"];
  const FRUITS = {
    coil: { name: "Coilfruit", family: "body", line: "A coiled, spiral-skinned fruit. Your body learns to give and to spring back: impact ×0.6, and Wind the Spring." },
    hide: { name: "Hidefruit", family: "beast", line: "A fruit with a pelt-like rind. Take the shape of a creature you learned by swallowing its beads." },
    mist: { name: "Mistfruit", family: "weather", line: "A pale fruit in a halo of vapour. Become weather: Drift (strikes without will miss 35%) and Fog Bank." },
  };
  const IDS = Object.keys(FRUITS);
  const poolOf = (account) => Object.fromEntries(IDS.map((id) => [id, account?.fruitPool?.[id] || "pool"]));
  const stashOf = (account) => IDS.filter((id) => poolOf(account)[id] === "stash");
  const eaten = (account) => (account?.fruit && FRUITS[account.fruit.id] ? account.fruit : null);
  const timerRipe = (account) => { const f = eaten(account); return !!f && (account.battles || 0) - (f.eatenAt || 0) >= RULES.ripeAfter; };
  // Feats the live basics can earn (S1a). The ids are what engine/fruit.js marks on the battle (s.fruitFeats); a feat counts once per
  // account. needsRipe feats arrive with the refined techniques (S1b), so none is listed here yet.
  const FEATS = {
    coil: [{ id: "coil.store3", label: "store 3 coils" }, { id: "coil.release3", label: "release 3 coils in one Strike" }, { id: "coil.take3", label: "take 3 impact hits at ×0.6 in one battle" }, { id: "coil.winDamped", label: "win a battle in which you were damped" }],
    hide: [{ id: "hide.shape", label: "take a shape" }, { id: "hide.second", label: "take a second, different beast's shape" }, { id: "hide.winShaped", label: "win while shaped" }],
    mist: [{ id: "mist.fog", label: "lay a fog bank" }, { id: "mist.drift3", label: "a foe's Strike drifts aside 3 times in one battle" }, { id: "mist.winClean", label: "win a battle without taking a will-less Strike" }],
  };
  const masteryOf = (account) => ({ feats: [...(account?.fruitMastery?.feats || [])], shapes: [...(account?.fruitMastery?.shapes || [])] });
  const stage = (account) => {
    const f = eaten(account); if (!f) return null;
    if (!RULES.respec) return timerRipe(account) ? "ripe" : "fresh";
    const n = masteryOf(migrateMastery(account)).feats.length;
    return n >= RULES.awakenFeats ? "awakened" : n >= RULES.ripeFeats ? "ripe" : "fresh";
  };
  const ripe = (account) => (RULES.respec ? ["ripe", "awakened"].includes(stage(account)) : timerRipe(account));
  // A fruit already ripe by the timer keeps Ripe when the feat model comes on: it is credited the three feats (spec section 2).
  function migrateMastery(account) {
    if (!RULES.respec || !eaten(account) || account.fruitMastery) return account;
    return { ...account, fruitMastery: { feats: timerRipe(account) ? ["legacy.1", "legacy.2", "legacy.3"] : [], shapes: [] } };
  }
  function settleFeats(account, { feats = [], shapes = [], won = false, shaped = false, drained = false, struck = false, test = false } = {}) {
    const f = eaten(account), lines = [];
    if (!RULES.respec || test || !f) return { account, lines };
    let a = migrateMastery(account);
    if (a !== account && masteryOf(a).feats.length) lines.push("Ripe: the old timer ripened this fruit already, so it keeps Ripe (3 feats credited).");
    const m = masteryOf(a), before = stage(a), mine = new Set((FEATS[f.id] || []).map((x) => x.id));
    const got = [...feats];
    if (won && shaped && f.id === "hide") got.push("hide.winShaped");
    if (won && drained && f.id === "coil") got.push("coil.winDamped");
    if (won && !struck && f.id === "mist") got.push("mist.winClean");
    for (const id of got) {
      if (!mine.has(id) || m.feats.includes(id)) continue;
      m.feats.push(id);
      lines.push(`Feat: ${FEATS[f.id].find((x) => x.id === id).label} (${m.feats.length}/${RULES.awakenFeats}).`);
    }
    for (const k of shapes) if (!m.shapes.includes(k)) m.shapes.push(k);
    a = { ...a, fruitMastery: m };
    const after = stage(a);
    if (after !== before) lines.push(after === "awakened" ? "Awakened: the fruit has become all of you." : "Ripe: the fruit has come into itself.");
    return { account: a, lines };
  }
  // FNV-1a, the same shape loot.js rolls with; account.battles is mixed in because designed encounters all have seed 0.
  function roll(seed, tag) { let h = 2166136261; for (const c of `${seed}:${tag}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; }

  function rollDrop(account, { seed = 0 } = {}) {
    const pool = poolOf(account), free = IDS.filter((id) => pool[id] === "pool");
    if (!free.length) return { account, dropped: null, line: "" };
    const n = account?.battles || 0;
    if (roll(seed, `fruit:${n}`) >= RULES.dropPerWin) return { account, dropped: null, line: "" };
    const id = free[Math.floor(roll(seed, `fruit-pick:${n}`) * free.length)];
    return { account: { ...account, fruitPool: { ...pool, [id]: "stash" } }, dropped: id,
      line: `A strange fruit washes up in the spoils: ${FRUITS[id].name}. It tastes like the end of something. (Field Kit: Eat, if you dare.)` };
  }
  function afterBattle(account, { won = false, test = false, seed = 0 } = {}) {
    return won && !test ? rollDrop(account, { seed }) : { account, dropped: null, line: "" };
  }
  function eat(account, id) {
    if (!FRUITS[id]) return { ok: false, error: "That isn't a fruit you hold." };
    if (poolOf(account)[id] !== "stash") return { ok: false, error: `${FRUITS[id].name} isn't in your stash.` };
    if (eaten(account)) return { ok: false, error: `Your body has one sea in it already (${FRUITS[eaten(account).id].name}). A second fruit is refused.` };
    const next = { ...account, fruit: { id, eatenAt: account.battles || 0 }, fruitPool: { ...poolOf(account), [id]: "eaten" } };
    const B = bingoLib(), store = next.bingo?.bounties ? next.bingo : B.createStore();   // §6: eating posts your head (Bingo's first live caller)
    B.post(store, { head: "player", poster: "the Record", amount: RULES.wantedPost, battle: account.battles || 0 });
    return { ok: true, account: { ...next, bingo: store },
      line: `You eat ${FRUITS[id].name}. A power wakes in you, and the water will never hold you up again. The Record posts your head: ${RULES.wantedPost} Seeds. Hunters will come.` };
  }
  const battleOpts = (account) => (eaten(account) ? { id: eaten(account).id, ripe: ripe(account), ...(RULES.respec ? { respec: true, shapes: masteryOf(account).shapes } : {}) } : null);
  function returnToTide(account) {
    const f = eaten(account); if (!f) return { account, line: "" };
    const next = { ...account, fruit: null, fruitPool: { ...poolOf(account), [f.id]: "pool" } };
    if (RULES.respec) delete next.fruitMastery;   // a closed saga is a new story: the feats go with it (spec section 2)
    if (next.bingo?.bounties?.player) {   // a closed saga is a new story: the Record strikes your name, hunters stop
      delete next.bingo.bounties.player;
      next.bingo.log.push("your saga closes: the Record strikes your name. The sea forgets you.");
    }
    return { account: next, line: `${FRUITS[f.id].name} returns to the tide. You could swim again.` };
  }
  const posted = (account) => account?.bingo?.bounties?.player || null;
  function hunterFor(account, { seed = 0 } = {}) {
    if (!posted(account)) return null;
    const n = account?.battles || 0;
    if (roll(seed, `hunter:${n}`) >= RULES.hunterPerBattle) return null;
    return HUNTERS[Math.floor(roll(seed, `hunter-pick:${n}`) * HUNTERS.length)];
  }
  function sellFruit(account, id) {
    if (!FRUITS[id]) return { ok: false, error: "That isn't a fruit you hold." };
    if (poolOf(account)[id] !== "stash") return { ok: false, error: `${FRUITS[id].name} isn't in your stash.` };
    const sales = { ...(account.fruitSales || {}), [id]: { owed: RULES.salePrice, soldAt: account.battles || 0 } };
    return { ok: true, account: { ...account, fruitPool: { ...poolOf(account), [id]: "sold" }, fruitSales: sales },
      line: `You sell ${FRUITS[id].name} by the tide: ${RULES.salePrice} Seeds, ${RULES.installment} a battle. The tide pays slow but pays.` };
  }
  function settleFruit(account, { test = false, hunterDown = false, hunterName = "a hunter", lost = false, submitted = false } = {}) {
    const lines = [];
    if (test) return { account, lines };
    let a = account;
    const n = a?.battles || 0, MK = marketLib(), B = bingoLib(), M = mintLib();
    for (const [id, sale] of Object.entries(a.fruitSales || {})) {   // §7: installments share the 55 stall cap, stall income first
      const room = Math.max(0, (M?.PER_SOURCE ?? 55) - (MK.marketOf(a).daySales || 0));
      const share = Math.min(RULES.installment, sale.owed, room);   // FR-01: a settled sale (owed 0) stays as the return timer and pays nothing more
      if (share > 0) {
        const r = MK.stallPayout(a, share);
        a = { ...r.account, seeds: (r.account.seeds || 0) + r.paid };
        const owed = Math.max(0, sale.owed - r.paid), sales = { ...a.fruitSales };
        sales[id] = { ...sale, owed };   // kept at 0, not deleted: the 40-battle return clock (soldAt) outlives the debt
        a = { ...a, fruitSales: sales };
        lines.push(`The tide pays ${r.paid} Seeds on ${FRUITS[id].name}${owed <= 0 ? ": settled in full." : ` (${owed} owed).`}`);
      }
      if (n - (sale.soldAt || 0) >= RULES.soldReturnAfter) {   // the sold fruit returns; any unmet tab is forgiven (40 battles is the statute)
        const sales = { ...a.fruitSales }; delete sales[id];
        a = { ...a, fruitSales: sales, fruitPool: { ...poolOf(a), [id]: "pool" } };
        lines.push(`${FRUITS[id].name} returns to the tide.`);
      }
    }
    if (hunterDown) {   // §6: beating a hunter pays the purse through the bingo faucet
      const r = M.capped("bingo", RULES.purse);
      a = { ...a, seeds: (a.seeds || 0) + r.seeds };
      lines.push(`You beat ${hunterName}: ${r.seeds} Seeds of hunter's purse.`);
    }
    if (lost && posted(a)) {   // §6: the hunter claims your head under Bingo's tiers; the bounty clears, your loss share stands
      const c = B.claim(a.bingo, { head: "player", hunter: hunterName, proof: { result: submitted ? "submitted" : "defeated" }, battle: n });
      if (c.ok) lines.push(`${hunterName} claims your head (${c.tier}). The bounty clears.`);
    }
    if (ripe(a) && posted(a)?.amount === RULES.wantedPost) {   // §8: ripening raises the posting
      posted(a).amount = RULES.wantedRipe;
      a.bingo.log.push(`the Record raises your head to ${RULES.wantedRipe}.`);
      lines.push(`The Record raises your head to ${RULES.wantedRipe} Seeds.`);
    }
    return { account: a, lines };
  }
  return { RULES, FEATS, masteryOf, stage, settleFeats, FRUITS, HUNTERS, poolOf, stashOf, eaten, ripe, rollDrop, afterBattle, eat, battleOpts, returnToTide, posted, hunterFor, sellFruit, settleFruit };
});
