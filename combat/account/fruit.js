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
//   settleRival(account, { fruit, defeated, won, seed }) → respec S4b: a beaten rival's fruit surfaces in the stash 1 time in 4, else slips back into the tide
//   encounterFor(account, { seed }) → { hunter, rival }: respec S4a, who comes this battle (a rival eater carries a loose fruit)
//   sellFruit(account, id)         → { ok, account, line } (stash → sold, 400 owed by the tide)
//   settleFruit(account, opts)     → { account, lines } (installments, sold returns, hunter purse, loss claim, ripe raise)
// Respec S1a (Tiller BD, 2026-11-01; spec claude-sinkerfruit-respec-spec "Rev 2026-11-01"; Mala: "start working on the fruit slices").
// Feats instead of the 30-battle timer, behind RULES.respec (false): off, nothing below changes a single result.
//   FEATS                          → fruit id → [{ id, label, needsRipe }]: the feats the live basics can earn (S1b adds the rest)
//   masteryOf(account)             → { feats: [], shapes: [] } (a fresh one when the account has none)
//   stage(account)                 → null (no fruit) | "fresh" | "ripe" | "awakened"
//   settleFeats(account, { feats, shapes, won, shaped, drained, test }) → { account, lines } counts each feat once per account
// Respec S3 (Tiller BD, 2026-11-01), same flag: the bounty climbs with Fame and deeds, tiered hunters, a purse that follows the bounty.
//   bountyFor(account)             → min(300, 20 + 15 x fame + 10 x hunters beaten + 20 x bosses beaten + 10 if Ripe + 25 if Awakened)
//   tierOf(amount)                 → 0 (under 60) | 1 (60-149) | 2 (150+); hunterFor reads it (chance and who comes)
//   purseFor(account)              → max(30, min(55, round(0.3 x bounty))), through the bingo faucet
//   deedsOf(account)               → { hunters, bosses } beaten in real battles since eating (cleared by a saga close)
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
    respec: false, ripeFeats: 3, awakenFeats: 6,
    bounty: { base: 20, perFame: 15, perHunter: 10, perBoss: 20, ripe: 10, awakened: 25, cap: 300 },
    tiers: [{ min: 0, chance: 1 / 8, pool: null }, { min: 60, chance: 1 / 6, pool: ["detective", "samurai", "knight"] }, { min: 150, chance: 1 / 5, pool: ["detective", "samurai", "knight"] }],
    rival: { chance: 1 / 25, winChance: 1 / 4, characters: ["detective", "samurai", "knight"] },   // S4a: who carries a loose fruit, and how often a random battle fields one
    purseRule: { min: 30, max: 55, share: 0.3 } };   // respec: false = the 30-battle timer exactly as landed; true = feats ripen and awaken the fruit
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
  // Six feats a fruit (S1a: the basics; S1b: the refined arts). The ids are what engine/fruit.js marks on the battle (s.fruitFeats); a feat counts once per
  // account. The refined feats can only happen once Ripe (their events need the refined arts), so Awakened always comes after using the whole kit.
  const FEATS = {
    coil: [{ id: "coil.store3", label: "store 3 coils" }, { id: "coil.release3", label: "release 3 coils in one Strike" }, { id: "coil.take3", label: "take 3 impact hits at ×0.6 in one battle" }, { id: "coil.winDamped", label: "win a battle in which you were damped" }, { id: "coil.knock", label: "knock a foe into a wall or water with a release" }, { id: "coil.recoil", label: "Recoil an attacker" }],
    hide: [{ id: "hide.shape", label: "take a shape" }, { id: "hide.second", label: "take a second, different beast's shape" }, { id: "hide.winShaped", label: "win while shaped" }, { id: "hide.ko", label: "KO a foe with a borrowed move" }, { id: "hide.absorb15", label: "absorb 15 damage on the borrowed hide" }, { id: "hide.scent", label: "Scent a concealed foe" }],
    mist: [{ id: "mist.fog", label: "lay a fog bank" }, { id: "mist.drift3", label: "a foe's Strike drifts aside 3 times in one battle" }, { id: "mist.winClean", label: "win a battle without taking a will-less Strike" }, { id: "mist.fogLos", label: "a fog bank breaks a foe's line of sight to your side" }, { id: "mist.allyDrift", label: "a ripe fog lends an ally Drift" }, { id: "mist.vapour", label: "Vapour Step through fog" }],
  };
  const masteryOf = (account) => ({ feats: [...(account?.fruitMastery?.feats || [])], shapes: [...(account?.fruitMastery?.shapes || [])] });
  const stage = (account) => {
    const f = eaten(account); if (!f) return null;
    if (!RULES.respec) return timerRipe(account) ? "ripe" : "fresh";
    const n = masteryOf(migrateMastery(account)).feats.length;
    return n >= RULES.awakenFeats ? "awakened" : n >= RULES.ripeFeats ? "ripe" : "fresh";
  };
  const ripe = (account) => (RULES.respec ? ["ripe", "awakened"].includes(stage(account)) : timerRipe(account));
  // S3: Fame is read through ONE accessor (the Fame F0b wiring swaps its source for the level, 0-5 or 0-8 with the perk); today it is account.fame.
  const fameOf = (account) => Math.max(0, Math.floor(account?.fame || 0));
  const deedsOf = (account) => ({ hunters: account?.fruitDeeds?.hunters || 0, bosses: account?.fruitDeeds?.bosses || 0 });
  function bountyFor(account) {
    const B = RULES.bounty, d = deedsOf(account), st = stage(account);
    return Math.min(B.cap, B.base + B.perFame * fameOf(account) + B.perHunter * d.hunters + B.perBoss * d.bosses + (st === "ripe" ? B.ripe : 0) + (st === "awakened" ? B.ripe + B.awakened : 0));
  }
  const tierOf = (amount) => (amount >= RULES.tiers[2].min ? 2 : amount >= RULES.tiers[1].min ? 1 : 0);
  const purseFor = (account) => Math.max(RULES.purseRule.min, Math.min(RULES.purseRule.max, Math.round(RULES.purseRule.share * (posted(account)?.amount ?? bountyFor(account)))));
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

  function rollDrop(account, { seed = 0, abroad = null } = {}) {   // abroad (S4a): a fruit a rival carries this battle is not in the pool: one copy in the world
    const pool = poolOf(account), free = IDS.filter((id) => pool[id] === "pool" && id !== abroad);
    if (!free.length) return { account, dropped: null, line: "" };
    const n = account?.battles || 0;
    if (roll(seed, `fruit:${n}`) >= RULES.dropPerWin) return { account, dropped: null, line: "" };
    const id = free[Math.floor(roll(seed, `fruit-pick:${n}`) * free.length)];
    return { account: { ...account, fruitPool: { ...pool, [id]: "stash" } }, dropped: id,
      line: `A strange fruit washes up in the spoils: ${FRUITS[id].name}. It tastes like the end of something. (Field Kit: Eat, if you dare.)` };
  }
  function afterBattle(account, { won = false, test = false, seed = 0, abroad = null } = {}) {
    return won && !test ? rollDrop(account, { seed, abroad }) : { account, dropped: null, line: "" };
  }
  function eat(account, id) {
    if (!FRUITS[id]) return { ok: false, error: "That isn't a fruit you hold." };
    if (poolOf(account)[id] !== "stash") return { ok: false, error: `${FRUITS[id].name} isn't in your stash.` };
    if (eaten(account)) return { ok: false, error: `Your body has one sea in it already (${FRUITS[eaten(account).id].name}). A second fruit is refused.` };
    const next = { ...account, fruit: { id, eatenAt: account.battles || 0 }, fruitPool: { ...poolOf(account), [id]: "eaten" } };
    const B = bingoLib(), store = next.bingo?.bounties ? next.bingo : B.createStore();   // §6: eating posts your head (Bingo's first live caller)
    B.post(store, { head: "player", poster: "the Record", amount: RULES.respec ? bountyFor(next) : RULES.wantedPost, battle: account.battles || 0 });
    return { ok: true, account: { ...next, bingo: store },
      line: RULES.respec ? `You eat ${FRUITS[id].name}. The Record posts your head: ${bountyFor(next)} Seeds. Hunters will come.`   // S5: the rite's two beats speak the taste and the curse
        : `You eat ${FRUITS[id].name}. A power wakes in you, and the water will never hold you up again. The Record posts your head: ${RULES.wantedPost} Seeds. Hunters will come.` };
  }
  const battleOpts = (account) => (eaten(account) ? { id: eaten(account).id, ripe: ripe(account), ...(RULES.respec ? { respec: true, shapes: masteryOf(account).shapes, awakened: stage(account) === "awakened" } : {}) } : null);
  function returnToTide(account) {
    const f = eaten(account); if (!f) return { account, line: "" };
    const next = { ...account, fruit: null, fruitPool: { ...poolOf(account), [f.id]: "pool" } };
    if (RULES.respec) { delete next.fruitMastery; delete next.fruitDeeds; }   // a closed saga is a new story: the feats go with it (spec section 2)
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
    const tier = RULES.respec ? RULES.tiers[tierOf(posted(account).amount)] : { chance: RULES.hunterPerBattle, pool: null };   // respec: the posted head sets who comes and how often
    if (roll(seed, `hunter:${n}`) >= tier.chance) return null;
    const pool = tier.pool || HUNTERS;
    return pool[Math.floor(roll(seed, `hunter-pick:${n}`) * pool.length)];
  }
  // S4a: the world holds the loose fruit. Who comes this battle: { hunter, rival }. Flag off: the landed hunter roll and nothing else. Respec: tiers 0 and 1
  // roll a rival eater 1 in 25 (never in the same battle as a hunter); tier 2's hunter slot draws a rival instead of a hunter, Ripe, while a fruit is loose.
  // Only a fruit in the pool is loose: stashed, eaten and sold fruit are not, and the Locusfruit never is (it is not in the pool).
  const looseFruit = (account) => IDS.filter((id) => poolOf(account)[id] === "pool");
  function encounterFor(account, { seed = 0 } = {}) {
    const hunter = hunterFor(account, { seed });
    const free = RULES.respec ? looseFruit(account) : [];
    if (!free.length) return { hunter, rival: null };
    const n = account?.battles || 0, tier = posted(account) ? tierOf(posted(account).amount) : 0;
    const rival = (ripe) => ({ fruit: free[Math.floor(roll(seed, `rival-fruit:${n}`) * free.length)], ripe, character: RULES.rival.characters[Math.floor(roll(seed, `rival-who:${n}`) * RULES.rival.characters.length)] });
    if (hunter && tier === 2) return { hunter: null, rival: rival(true) };
    if (!hunter && tier < 2 && roll(seed, `rival:${n}`) < RULES.rival.chance) return { hunter: null, rival: rival(false) };
    return { hunter, rival: null };
  }
  // S4b: beat the rival and the fruit it carried can wash up in your stash (1 in 4; the one-fruit rule and the 40-battle sale still apply to it from there);
  // otherwise it slips back into the tide. A rival that was not beaten, or a battle you lost, says nothing: the fruit never left the pool.
  // "Beaten" is a kill by the player's side: not a rival that was bribed or frightened away (escaped, no killer), not the sea or a trap, not a Parley turn.
  const rivalBeaten = (rival, actors = {}) => !!rival?.defeated && !rival.escaped && !rival.persuaded && actors[rival.defeatedBy]?.side === "player";
  function settleRival(account, { fruit = null, defeated = false, won = false, test = false, seed = 0 } = {}) {
    if (!RULES.respec || test || !fruit || !FRUITS[fruit] || !defeated || !won || poolOf(account)[fruit] !== "pool") return { account, lines: [] };
    if (roll(seed, `rival-spoil:${account?.battles || 0}`) >= RULES.rival.winChance) return { account, lines: [`${FRUITS[fruit].name} slips back into the tide.`] };
    return { account: { ...account, fruitPool: { ...poolOf(account), [fruit]: "stash" } }, lines: [`${FRUITS[fruit].name} washes up in the spoils.`] };
  }
  function sellFruit(account, id) {
    if (!FRUITS[id]) return { ok: false, error: "That isn't a fruit you hold." };
    if (poolOf(account)[id] !== "stash") return { ok: false, error: `${FRUITS[id].name} isn't in your stash.` };
    const sales = { ...(account.fruitSales || {}), [id]: { owed: RULES.salePrice, soldAt: account.battles || 0 } };
    return { ok: true, account: { ...account, fruitPool: { ...poolOf(account), [id]: "sold" }, fruitSales: sales },
      line: `You sell ${FRUITS[id].name} by the tide: ${RULES.salePrice} Seeds, ${RULES.installment} a battle. The tide pays slow but pays.` };
  }
  function settleFruit(account, { test = false, hunterDown = false, hunterName = "a hunter", lost = false, submitted = false, bossesDown = 0 } = {}) {
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
      const r = M.capped("bingo", RULES.respec ? purseFor(a) : RULES.purse);
      a = { ...a, seeds: (a.seeds || 0) + r.seeds };
      lines.push(`You beat ${hunterName}: ${r.seeds} Seeds of hunter's purse.`);
    }
    if (lost && posted(a)) {   // §6: the hunter claims your head under Bingo's tiers; the bounty clears, your loss share stands
      const c = B.claim(a.bingo, { head: "player", hunter: hunterName, proof: { result: submitted ? "submitted" : "defeated" }, battle: n });
      if (c.ok) lines.push(`${hunterName} claims your head (${c.tier}). The bounty clears.`);
    }
    if (RULES.respec && eaten(a)) {   // S3: count the deeds (real battles only: settleFruit never runs for test battles), then post the head at the formula
      const d = deedsOf(a), hd = d.hunters + (hunterDown && !lost ? 1 : 0), bd = d.bosses + (bossesDown > 0 ? bossesDown : 0);
      if (hd !== d.hunters || bd !== d.bosses) a = { ...a, fruitDeeds: { hunters: hd, bosses: bd } };
      const want = bountyFor(a), store = a.bingo?.bounties ? a.bingo : B.createStore(), cur = store.bounties.player;
      if (!cur) {   // a claim cleared the head: you are still an eater, so the Record posts it again at the formula
        B.post(store, { head: "player", poster: "the Record", amount: want, battle: n });
        a = { ...a, bingo: store }; lines.push(`The Record posts your head again: ${want} Seeds.`);
      } else if (cur.amount !== want) {
        const up = want > cur.amount; cur.amount = want; store.log.push(`the Record ${up ? "raises" : "lowers"} your head to ${want}.`);
        a = { ...a, bingo: store }; lines.push(`The Record ${up ? "raises" : "lowers"} your head to ${want} Seeds.`);
      }
    }
    if (!RULES.respec && ripe(a) && posted(a)?.amount === RULES.wantedPost) {   // §8: ripening raises the posting
      posted(a).amount = RULES.wantedRipe;
      a.bingo.log.push(`the Record raises your head to ${RULES.wantedRipe}.`);
      lines.push(`The Record raises your head to ${RULES.wantedRipe} Seeds.`);
    }
    return { account: a, lines };
  }
  return { RULES, FEATS, masteryOf, stage, settleFeats, bountyFor, tierOf, purseFor, deedsOf, FRUITS, HUNTERS, poolOf, stashOf, eaten, ripe, rollDrop, afterBattle, eat, battleOpts, returnToTide, posted, hunterFor, encounterFor, settleRival, rivalBeaten, sellFruit, settleFruit };
});
