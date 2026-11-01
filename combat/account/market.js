"use strict";
// Stall marketing (vessel economy build): sell spare vessels and sealed catches, haggle,
// advertise campaigns, vendor standing, buy orders. Prices stack drift × campaign ×
// standing × flood (cap ×2, haggle and quirks inside the cap), seeded per market-day.
// Pure account ledger: every op refuses instead of going negative. Takes mint (a leaf:
// no load-order knot); every payout mints as source "stall" (ruling 8).
//
//   RULES                        → every tunable (all provisional; Mala tunes)
//   PART_NAME / VENDORS           → display names + quirks
//   marketOf(account)             → normalized market object (fresh defaults merged)
//   driftFor(day, kind)           → seeded 0.75..1.50 (pure: same day+kind, same drift)
//   priceOf(base, ctx)            → stacked price ({day, kind, floods, campaign, standing, haggled, quirk}; cap last)
//   haggleChance(standing, persuasion) → 0.50 + persuasion + standing/200, capped 0.90 (flat where no persuasion exists)
//   catchTier(catch)              → shard/bead/orb (boss→orb, maxLF≥80→bead, else shard)
//   catchBase(catch)              → tier base + size premium (maxLF/10 floored)
//   sellVessel(a, vendor, tier, roll01, persuasion) → { ok, account, seeds, haggled, lines } (mints as "stall")
//   sellCatch(a, vendor, penIndex, roll01, persuasion) → { ok, account, seeds, haggled, lines } (mints as "stall")
//   sellOrgonite(a, vendor, roll01, persuasion) → { ok, account, seeds, haggled, lines } (base 6, kind "orgonite"; the Orcish fence only)
//   swallowPen(a, index)          → { ok, account, learned, lines } (bead progress + learn)
//   advertise(a, tier)            → { ok, account, lines } (one campaign at a time)
//   fillOrder(a, orderIdx, have)  → { ok, account, seeds, lines } (have: {pen} or {vessel}; mints as "stall")
//   refreshOrders(day)            → 1-3 seeded orders [{ kind, tier-only? }]
//   battleParts(won)              → battlefield salvage inflow { common, uncommon }
//   tickMarket(a, { won })        → { account, lines } (day++, floods reset, campaign--, orders, parts)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./mint.js"));
  else root.ConceptCombatMarket = factory(root.ConceptCombatMint);
})(typeof self !== "undefined" ? self : this, function (MINT) {
  const RULES = {
    resale: { shard: 2, bead: 6, orb: 20 },        // 40% of craft fees (parts NOT refunded)
    catchBase: { shard: 12, bead: 30, orb: 80 },   // + size premium below
    sizeDiv: 10, bigLf: 80, bruteLf: 60,
    driftLo: 0.75, driftHi: 1.50,
    floodMul: 0.9, floodFloor: 0.5,
    haggleBonus: 0.15, haggleFail: 0.10, haggleBase: 0.5, haggleCap: 0.9,   // ruling 3: +15% or −10%, every sale haggles
    campaignCost: 20, campaignMul: 1.25, campaignBattles: 3,
    standingPerSale: 2, standingPerOrder: 5, standingMax: 100, standingDiv: 400,
    orderMul: 1.5, totalCap: 2.0, stallDayCap: 100,   // ruling 10: 100 Seeds/market-day across stall + orders
    buyPrice: { shard: 8, bead: 25, orb: 75 },     // shop buy side (craft fee ×1.5, rounded)
    partPrice: { common: 3, uncommon: 8, rare: 20 },
    orgoniteBase: 6,                               // codex-orgonite §2: under the 10-Seed cast fee at EV
    orgoniteMax: 9,                                // hard ceiling under the fee: standing 100 x top drift x haggle reaches the 2.0 cap (12), which would print
    battleParts: { common: 1, uncommonWin: 1 },    // ruling 7: 1c+1u per win until salvage routes parts (loops 1a17c4b1310, 1a17ce1c4d1)
    orderPool: ["thief", "rogue", "hacker", "orc", "feralPig", "vampire", "zombie", "tier:shard", "tier:bead", "tier:orb"],
  };
  const PART_NAME = { common: "Common parts", uncommon: "Uncommon parts", rare: "Rare parts" };
  const VENDORS = {
    orcish: { name: "Orcish fence", quirk: "+10% on brutes (maxLF 60+)" },
    bank: { name: "Monster Bank", quirk: "Vessels only: −10%, buys unlimited (no flood)" },
    beggars: { name: "Beggar market", quirk: "×0.6, no questions, no standing" },
  };
  const freshMarket = () => ({ day: 1, floods: {}, campaign: null, standing: { orcish: 0, bank: 0, beggars: 0 }, orders: [], daySales: 0 });
  function marketOf(a) {
    const m = a?.market || {}, f = freshMarket();
    return { day: m.day || 1, floods: { ...(m.floods || {}) }, campaign: m.campaign || null,
      standing: { ...f.standing, ...(m.standing || {}) }, orders: Array.isArray(m.orders) ? m.orders.map((o) => ({ ...o })) : [], daySales: m.daySales || 0 };
  }
  const hashKind = (kind) => [...String(kind)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  function driftFor(day, kind) {   // mulberry, one draw: pure + seeded-stable
    let a = ((day * 7919 + hashKind(kind)) >>> 0) | 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return RULES.driftLo + r * (RULES.driftHi - RULES.driftLo);
  }
  function priceOf(base, { day = 1, kind = "goods", floods = {}, campaign = null, standing = 0, haggled = false, quirk = 1 } = {}) {
    const drift = driftFor(day, kind);
    let m = drift;
    if (campaign && campaign.kind === kind && campaign.battles > 0) m *= RULES.campaignMul;
    m *= 1 + Math.min(RULES.standingMax, Math.max(0, standing)) / RULES.standingDiv;
    m *= Math.pow(RULES.floodMul, floods[kind] || 0);
    m *= haggled ? 1 + RULES.haggleBonus : 1 - RULES.haggleFail;   // every sale haggles: +15% or −10% (ruling 3), inside the cap
    m *= quirk || 1;   // raising quirks ride inside too: the cap is LAST
    m = Math.min(m, RULES.totalCap);
    return Math.max(1, Math.round(base * Math.max(m, drift * RULES.floodFloor)));
  }
  const haggleChance = (standing, persuasion = null) => Math.min(RULES.haggleCap, RULES.haggleBase + (persuasion == null ? 0 : Math.max(0, persuasion)) + Math.max(0, standing || 0) / 200);   // ruling 3: Parley.persuasion when it exists, flat 50% + standing/200 where it doesn't
  function catchTier(c) {
    if (c?.boss) return "orb";
    return (c?.maxLF || 0) >= RULES.bigLf ? "bead" : "shard";
  }
  const catchBase = (c) => RULES.catchBase[catchTier(c)] + Math.floor((c?.maxLF || 0) / RULES.sizeDiv);
  function vendorPrice(base, vendor, c, ctx) {
    const quirk = vendor === "orcish" && (c?.maxLF || 0) >= RULES.bruteLf ? 1.1 : 1;   // the brute bonus rides inside the cap (cap last)
    let p = priceOf(base, { ...ctx, quirk });
    if (vendor === "bank") p = Math.round(p * 0.9);   // discounts stay post-cap: they can only lower
    if (vendor === "beggars") p = Math.round(p * 0.6);
    return Math.max(1, p);
  }
  function pay(seeds, m) {   // rulings 8+10: mint first (55/call), then the 100/day stall tally
    const r = MINT.capped("stall", seeds);
    const paid = Math.min(r.seeds, Math.max(0, RULES.stallDayCap - (m.daySales || 0)));
    return { paid, flag: r.flag, capped: paid < r.seeds, daySales: (m.daySales || 0) + paid };
  }
  function bumpStanding(market, vendor, n) {
    if (vendor === "beggars") return market;
    const standing = { ...market.standing, [vendor]: Math.min(RULES.standingMax, (market.standing[vendor] || 0) + n) };
    return { ...market, standing };
  }
  function flood(market, kind, vendor) {
    if (vendor === "bank") return market;   // the Bank's appetite never floods
    return { ...market, floods: { ...market.floods, [kind]: (market.floods[kind] || 0) + 1 } };
  }
  function withMarket(a, market) { return { ...a, market }; }
  // A catch made with the free apprentice shard is practice: bead progress only (Mala, 2026-10-27).
  const PRACTICE = "An apprentice-shard catch is practice: keep it for bead progress. No stall or order buys it.";
  function sellVessel(a, vendor, tier, roll01 = Math.random(), persuasion = null) {
    if (!VENDORS[vendor]) return { ok: false, reason: "No such vendor." };
    if ((a?.vessels?.[tier] || 0) <= 0) return { ok: false, reason: `No ${tier} to sell.` };
    const m = marketOf(a), haggled = roll01 < haggleChance(m.standing[vendor], persuasion);
    const quoted = vendorPrice(RULES.resale[tier], vendor, null, { day: m.day, kind: tier, floods: m.floods, campaign: m.campaign, standing: m.standing[vendor], haggled });
    const r = pay(quoted, m), seeds = r.paid;
    if (seeds <= 0) return { ok: false, reason: `Day tally full (${RULES.stallDayCap}/${RULES.stallDayCap}) — the stall pays no more today.` };
    const vessels = { ...a.vessels, [tier]: a.vessels[tier] - 1 };
    const out = withMarket({ ...a, seeds: (a.seeds || 0) + seeds, vessels }, { ...flood(bumpStanding(m, vendor, RULES.standingPerSale), tier, vendor), daySales: r.daySales });
    const lines = [`Sold a ${tier} to the ${VENDORS[vendor].name}: +${seeds} Seeds${haggled ? " (haggled up)" : " (talked down)"}.`];
    if (r.flag) lines.push(`Mint: ${r.flag}.`);
    if (r.capped) lines.push(`Day tally ${r.daySales}/${RULES.stallDayCap} — the stall pays no more today.`);
    return { ok: true, account: out, seeds, haggled, lines };
  }
  // Orgonite (codex-orgonite spec §2-3): a stall good, not a vessel. The Monster Bank buys vessels only (ruling 6) and the
  // beggars are the vessel floor (ruling 4), so only the Orcish fence quotes it.
  function sellOrgonite(a, vendor, roll01 = Math.random(), persuasion = null) {
    if (vendor !== "orcish") return { ok: false, reason: vendor === "bank" ? "The Monster Bank buys vessels only. Orgonite is not a vessel." : "The beggars have no price for orgonite." };
    if ((a?.orgonite || 0) <= 0) return { ok: false, reason: "No orgonite to sell." };
    const m = marketOf(a), haggled = roll01 < haggleChance(m.standing[vendor], persuasion);
    const quoted = vendorPrice(RULES.orgoniteBase, vendor, null, { day: m.day, kind: "orgonite", floods: m.floods, campaign: m.campaign, standing: m.standing[vendor], haggled });
    const r = pay(Math.min(quoted, RULES.orgoniteMax), m), seeds = r.paid;
    if (seeds <= 0) return { ok: false, reason: `Day tally full (${RULES.stallDayCap}/${RULES.stallDayCap}) — the stall pays no more today.` };
    const out = withMarket({ ...a, seeds: (a.seeds || 0) + seeds, orgonite: a.orgonite - 1 }, { ...flood(bumpStanding(m, vendor, RULES.standingPerSale), "orgonite", vendor), daySales: r.daySales });
    const lines = [`Sold a puck of orgonite to the ${VENDORS[vendor].name}: +${seeds} Seeds${haggled ? " (haggled up)" : " (talked down)"}.`];
    if (r.flag) lines.push(`Mint: ${r.flag}.`);
    if (r.capped) lines.push(`Day tally ${r.daySales}/${RULES.stallDayCap} — the stall pays no more today.`);
    return { ok: true, account: out, seeds, haggled, lines };
  }
  function sellCatch(a, vendor, penIndex, roll01 = Math.random(), persuasion = null) {
    if (!VENDORS[vendor]) return { ok: false, reason: "No such vendor." };
    if (vendor === "bank") return { ok: false, reason: "The Monster Bank deals in vessels only — catches go to the fence or the beggars." };   // ruling 6
    const pens = Array.isArray(a?.pens) ? a.pens : [], c = pens[penIndex];
    if (!c) return { ok: false, reason: "Nothing penned there." };
    if (c.free) return { ok: false, reason: PRACTICE };
    const m = marketOf(a), haggled = roll01 < haggleChance(m.standing[vendor], persuasion);
    const campaign = m.campaign && m.campaign.kind === catchTier(c) ? { ...m.campaign, kind: c.key } : null;   // a tier campaign lifts same-tier catches; floods stay per foe-key
    const quoted = vendorPrice(catchBase(c), vendor, c, { day: m.day, kind: c.key, floods: m.floods, campaign, standing: m.standing[vendor], haggled });
    const r = pay(quoted, m), seeds = r.paid;
    if (seeds <= 0) return { ok: false, reason: `Day tally full (${RULES.stallDayCap}/${RULES.stallDayCap}) — the stall pays no more today.` };
    const out = withMarket({ ...a, seeds: (a.seeds || 0) + seeds, pens: pens.filter((_, i) => i !== penIndex) },
      { ...flood(bumpStanding(m, vendor, RULES.standingPerSale), c.key, vendor), daySales: r.daySales });
    const lines = [`Sold ${c.name} to the ${VENDORS[vendor].name}: +${seeds} Seeds${haggled ? " (haggled up)" : " (talked down)"}.`];
    if (r.flag) lines.push(`Mint: ${r.flag}.`);
    if (r.capped) lines.push(`Day tally ${r.daySales}/${RULES.stallDayCap} — the stall pays no more today.`);
    return { ok: true, account: out, seeds, haggled, lines };
  }
  function swallowPen(a, index) {   // keep (default): bead progress + learn (beads.js thresholds)
    const pens = Array.isArray(a?.pens) ? a.pens : [], c = pens[index];
    if (!c) return { ok: false, reason: "Nothing penned there." };
    const sw = { ...(a.beadSwallows || {}) }; sw[c.key] = (sw[c.key] || 0) + 1;
    const need = c.dream ? 4 : (c.maxLF || 0) >= 80 ? 5 : 3;
    const learned = Array.isArray(a.beastSummons) ? [...a.beastSummons] : [];
    const known = learned.some((b) => b.key === c.key);
    let line;
    if (!known && sw[c.key] >= need) { learned.push({ key: c.key, name: c.name }); line = `${c.name}: learned — it answers your summons now.`; }
    else if (!known) line = `${c.name}: bead progress ${sw[c.key]} of ${need}.`;
    else line = `${c.name}: already learned; the pen empties.`;
    return { ok: true, account: { ...a, beadSwallows: sw, beastSummons: learned, pens: pens.filter((_, i) => i !== index) }, learned: !known && sw[c.key] >= need, lines: [line] };
  }
  function advertise(a, tier) {
    if (!RULES.resale[tier]) return { ok: false, reason: "Advertise shard, bead or orb goods." };
    const m = marketOf(a);
    if (m.campaign) return { ok: false, reason: "One campaign at a time." };
    if ((a.seeds || 0) < RULES.campaignCost) return { ok: false, reason: `The campaign costs ${RULES.campaignCost} Seeds.` };
    const out = withMarket({ ...a, seeds: a.seeds - RULES.campaignCost }, { ...m, campaign: { kind: tier, battles: RULES.campaignBattles } });
    return { ok: true, account: out, lines: [`Word spreads: ${tier} goods fetch ×${RULES.campaignMul} for ${RULES.campaignBattles} battles.`] };
  }
  function refreshOrders(day) {   // 1-3 seeded orders: foe-keys and tier-orders mixed (the Bank only ever orders tiers — ruling 6)
    let a = ((day * 104729 + 13) >>> 0) | 0;
    const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const n = 1 + Math.floor(rnd() * 3), pool = [...RULES.orderPool], vendors = Object.keys(VENDORS), out = [];
    for (let i = 0; i < n; i++) {
      const vendor = vendors[Math.floor(rnd() * vendors.length)];
      let kind = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      if (vendor === "bank" && !kind.startsWith("tier:")) { const ti = pool.findIndex((k) => k.startsWith("tier:")); if (ti >= 0) { pool.push(kind); kind = pool.splice(ti, 1)[0]; } }
      out.push({ kind, vendor, filled: false });
    }
    return out;
  }
  function fillOrder(a, orderIdx, have) {   // have: { pen: i } or { vessel: tier }
    const m = marketOf(a), o = m.orders[orderIdx];
    if (!o || o.filled) return { ok: false, reason: "No open order there." };
    if (o.vendor === "bank" && have && typeof have.pen === "number") return { ok: false, reason: "The Monster Bank deals in vessels only — catches go to the fence or the beggars." };   // ruling 6
    const tierOrder = o.kind.startsWith("tier:") ? o.kind.slice(5) : null;
    let base = 0, kind = o.kind, account = a;
    if (have && typeof have.pen === "number") {
      const pens = Array.isArray(a.pens) ? a.pens : [], c = pens[have.pen];
      if (!c) return { ok: false, reason: "Nothing penned there." };
      if (c.free) return { ok: false, reason: PRACTICE };
      if (!(c.key === o.kind || (tierOrder && catchTier(c) === tierOrder))) return { ok: false, reason: `${c.name} doesn't fill that order.` };
      base = catchBase(c); kind = c.key;
      account = { ...a, pens: pens.filter((_, i) => i !== have.pen) };
    } else if (have && have.vessel) {
      if (!tierOrder || have.vessel !== tierOrder) return { ok: false, reason: "That vessel doesn't fill that order." };
      if ((a?.vessels?.[have.vessel] || 0) <= 0) return { ok: false, reason: `No ${have.vessel} to fill it with.` };
      base = RULES.resale[have.vessel]; kind = have.vessel;
      account = { ...account, vessels: { ...account.vessels, [have.vessel]: account.vessels[have.vessel] - 1 } };
    } else return { ok: false, reason: "Fill with a penned catch or a vessel." };
    const r = pay(Math.max(1, Math.round(base * RULES.orderMul)), m), seeds = r.paid;
    if (seeds <= 0) return { ok: false, reason: `Day tally full (${RULES.stallDayCap}/${RULES.stallDayCap}) — the stall pays no more today.` };
    const orders = m.orders.map((x, i) => (i === orderIdx ? { ...x, filled: true } : x));
    const vendor = VENDORS[o.vendor] ? o.vendor : "orcish";
    const out = withMarket({ ...account, seeds: (account.seeds || 0) + seeds }, { ...flood(bumpStanding({ ...m, orders }, vendor, RULES.standingPerOrder), kind, vendor), daySales: r.daySales });
    const lines = [`Order filled (${o.kind}): +${seeds} Seeds, +${RULES.standingPerOrder} ${VENDORS[vendor].name} standing.`];
    if (r.flag) lines.push(`Mint: ${r.flag}.`);
    if (r.capped) lines.push(`Day tally ${r.daySales}/${RULES.stallDayCap} — the stall pays no more today.`);
    return { ok: true, account: out, seeds, lines };
  }
  const battleParts = (won) => (won ? { common: RULES.battleParts.common, uncommon: RULES.battleParts.uncommonWin } : { common: 0, uncommon: 0 });   // ruling 10: wins only — a loss pays no parts
  function tickMarket(a, { won = false } = {}) {   // a market-day turns at battle settle
    const m = marketOf(a), gain = battleParts(won);
    const parts = { common: 0, uncommon: 0, rare: 0, ...(a.parts || {}) };
    parts.common += gain.common; parts.uncommon += gain.uncommon;
    const campaign = m.campaign && m.campaign.battles > 1 ? { ...m.campaign, battles: m.campaign.battles - 1 } : null;
    const day = m.day + 1;
    const lines = [gain.common + gain.uncommon > 0 ? `Salvaged battlefield refuse: +${gain.common} common parts${gain.uncommon ? `, +${gain.uncommon} uncommon` : ""}.` : "No salvage on a loss — the field keeps its refuse."];
    if (m.campaign && !campaign) lines.push("The advertising campaign lapses.");
    const market = { day, floods: {}, campaign, standing: m.standing, orders: refreshOrders(day), daySales: 0 };   // the day tally resets when the market-day turns (ruling 10)
    return { account: { ...a, parts, market }, lines };
  }
  function stallPayout(a, seeds) {   // OP1 §7: an installment's share of the stall cap (mint 55/call + day tally, same as a sale)
    const m = marketOf(a), r = pay(Math.max(0, seeds), m);
    return { account: { ...a, market: { ...m, daySales: r.daySales } }, paid: r.paid, flag: r.flag };
  }
  return { RULES, PART_NAME, VENDORS, marketOf, driftFor, priceOf, vendorPrice, haggleChance, catchTier, catchBase, sellVessel, sellCatch, sellOrgonite, swallowPen, advertise, fillOrder, refreshOrders, battleParts, tickMarket, stallPayout };
});
