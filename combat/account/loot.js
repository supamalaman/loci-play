"use strict";
// Loot, shop and gear rules over the persistent account. Pure and seeded.
//
//   finishBattle(account, result, { seed, biome })  → { account, xp, seeds, drops, lines }   (XP + Seeds + drops in one go)
//   rollDrops(account, result, { seed, biome })      → [{ kind: "consumable"|"equipment", id, rarity }]
//   shopStock(account, { seed, biome })              → [{ kind, id, price }]
//   buy(account, offer) / sell(account, kind, id)    → { ok, account, reason }
//   sellConsumable(account, id) / trashConsumable(account, id)  → { ok, account, value?, reason }   (kit board: 10% of price, or destroy)
//   equip(account, id) / unequip(account, slot)      → { ok, account, reason }
//   passives(account)                                → merged passive modifiers for the engine
//   packForBattle(account, ids)                      → { ok, account, carried, reason }   (choose consumables to bring)
//   useCarried(account, id)                          → account with one fewer (one-time use)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./items-data.js"), require("./account.js"),
    require("./ante.js"), require("../workshop/traversal.js"), require("./mint.js"), require("./market.js"), require("../workshop/jinki.js"),
    require("../workshop/jinki-states.js"), require("../workshop/jinki-voice.js"), require("./fame.js"));
  else root.ConceptCombatLoot = factory(root.ConceptCombatItems, root.ConceptCombatAccount, root.ConceptCombatAnte,
    root.ConceptCombatWorkshopTraversal, root.ConceptCombatMint, root.ConceptCombatMarket, root.ConceptCombatJinki,
    root.ConceptCombatJinkiStates, root.ConceptCombatJinkiVoice, root.ConceptCombatFame);
})(typeof self !== "undefined" ? self : this, function (I, A, AN, TR, MINT, MK, JK, JS, JV, FAME) {
  function roll(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function weighted(r, entries) {
    const total = entries.reduce((n, [, w]) => n + w, 0); if (total <= 0) return null;
    let x = r * total;
    for (const [k, w] of entries) if ((x -= w) < 0) return k;
    return entries[entries.length - 1][0];
  }
  const maxDurability = (id, account = null) => I.rarities[rarityOf(account, id)].durability;   // J1: ascension-aware (base when JK is dark)
  const rarityOf = (account, id) => { const base = I.equipment[id].rarity; return account && JK ? JK.rarityOf(account, id, base) : base; };
  // Accounts created before loot existed get empty bags; owned gear without a durability record is at full.
  function withBags(a) {
    const gear = { owned: [], equipped: {}, durability: {}, care: {}, cherished: [], ascended: {}, speaking: null,
      ...(a.gear || {}) };   // care: JC2 biography; cherished: since last battle; ascended: J1 rarity overrides; speaking: the soul the player chose to speak, an item id or null for the strongest (Active Jinki, J1)
    const durability = { ...gear.durability };
    for (const id of gear.owned) if (durability[id] == null) durability[id] = maxDurability(id, a);
    return { seeds: 0, discoveries: 0, marks: [], stash: {}, trackMixes: a.trackMixes || {}, carried: [], schoolTitles: [], wornSchoolTitle: "", ...a, gear: { ...gear, durability },
      museum: { placed: [], plinths: MUSEUM_PLINTHS, scene: false, ...(a.museum || {}) } };   // the Museum (M1): placed = enshrined item ids (they stay in gear.owned), plinths = capacity, scene = the first-placement scene has played   // W4.4: the Monomyth wallet and the ledger live here now (old saves normalize on load)
  }
  const worn = (a, id) => (a.gear.durability[id] ?? 1) <= 0;
  // ── The Museum (spec claude-museum-spec/specs/MUSEUM.md, slice M1): a safe place of reverence for cherished gear. An enshrined piece stays in gear.owned (the placed list is a
  // flag beside it, so every "do you own it?" check keeps working), is taken off, cannot be sold, equipped or mended, does not wear, and its care stays as it was; taking it back
  // is free and exact. It has no effect in battle: care and Jinki stay sentimental, never power or Seeds.
  const MUSEUM_PLINTHS = 12;
  const enshrined = (a, id) => (a?.museum?.placed || []).includes(id);
  const inMuseum = (a, id) => `${I.equipment[id]?.name || id} is in the Museum: take it back first.`;
  // J2: threshold crossings are EVENTS — the sprite swap CELEBRATES.
  // Null when the states build is absent (silence, not breakage).
  const stateCrossed = (id, before, after, max) => {
    if (!JS) return null;
    const e = JS.crossed(before, after, max, I.rules.durability.warnAt);
    return e ? JS.crossingLine(I.equipment[id].name, e, I.equipment[id]) : null;
  };
  // J4: the awakened object speaks — null when voiceless (no soul, no
  // voice build, unknown kind), so soulless lines render byte-identical.
  const soulSays = (account, id, moment) => (JV ? JV.codicil(account, id, moment) : null);
  const catalog = (kind) => (kind === "equipment" ? I.equipment : I.consumables);
  const rarityMul = (level) => { let m = I.dropRules.rarityByLevel[0].mul; for (const r of I.dropRules.rarityByLevel) if (level >= r.level) m = r.mul; return m; };

  // EP-01: what awakening adds on top of the base line, in words that match passives(). Empower numbers are TOTALS (Mala, 2026-11-01):
  // an awakened piece uses item.empower.passive INSTEAD of the base for every key it names, and keeps the base for the rest, so
  // "more" is total minus base and can be negative (emp below base reads "less"). One entry per key of item.empower.passive.
  const EMP_ADD = { maxLFAdd: "max LF", pfRegenAdd: "ΦF regen", lineRangeAdd: "line range", strikeRangeAdd: "strike range", strikePotencyAdd: "strike potency", glamourAdd: "glamour", startingUltimateCharge: "% starting ultimate charge", knockbackResist: "shove resist", questionHint: "question hint" };
  const EMP_MUL = { seedsMul: "Seeds earned", xpMul: "XP", objectDamageMul: "damage to objects", groundDamageMul: "ground damage", moveCostMul: "movement cost", fallDamageMul: "fall damage", climbCostMul: "climb cost" };
  const sgn = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;
  const pct = (m) => sgn(Math.round((m - 1) * 1000) / 10) + "%";
  // soiled: the piece is at or under the warn line, where passives() halves glamour (base and empowered alike).
  function empowerLines(id, { soiled = false } = {}) {
    const it = I.equipment[id], emp = it?.empower?.passive;
    if (!emp) return null;
    return Object.entries(emp).map(([k, v0]) => {
      const half = soiled && k === "glamourAdd", v = half && typeof v0 === "number" ? v0 / 2 : v0;
      const base = half && typeof it.passive?.[k] === "number" ? it.passive[k] / 2 : it.passive?.[k];
      if (typeof v === "number" && EMP_MUL[k]) return `${EMP_MUL[k]} ${pct(v)} in total (base ${pct(typeof base === "number" ? base : 1)})`;
      if (typeof v === "number" && EMP_ADD[k]) { const b = typeof base === "number" ? base : 0, more = v - b, unit = EMP_ADD[k].startsWith("%") ? EMP_ADD[k] : ` ${EMP_ADD[k]}`; return `${more < 0 ? Math.abs(more) : sgn(more)}${unit} ${more < 0 ? "less" : "more"} (${sgn(v)}${unit} in total${half ? "; soiled, so glamour is halved" : ""})`; }
      return v === true ? `gains ${k.replace(/([A-Z])/g, " $1").toLowerCase()}` : `${k}: ${v}`;
    });
  }
  function passives(account) {
    const a = withBags(account), out = { channelDamageMul: {} };
    for (const id of Object.values(a.gear.equipped)) {
      if (worn(a, id)) continue;                                        // worn-out gear does nothing until repaired
      const soiled = (a.gear.durability[id] ?? 99) <= I.rules.durability.warnAt;
      const emp = I.equipment[id]?.empower?.passive;   // EM1: awakened power (care 10+) REPLACES the base for the keys it names (totals); same stacking, no fragment double-dip
      const p = emp && careScore(a.gear.care?.[id]) >= CARE.awaken ? { ...(I.equipment[id]?.passive || {}), ...emp } : (I.equipment[id]?.passive || {});
      const woke = I.equipment[id]?.fragment && careScore(a.gear.care?.[id]) >= CARE.awaken ? 2 : 1;   // SPEC muse-fragments: awakened fragments (care 10) double their passive
      for (let [k, v] of Object.entries(p)) {
        if (k === "glamourAdd" && soiled) v = v / 2;   // soil rule (W4.3): the shine fades before the cloth fails; repair restores the glow
        if (woke > 1 && typeof v === "number" && !/Mul$/.test(k)) v = v * woke;
        if (k === "channelDamageMul" || k === "channelDealtMul") { const dst = (out[k] ||= {}); for (const [ch, m] of Object.entries(v)) dst[ch] = (dst[ch] ?? 1) * m; }
        else if (typeof v === "number" && /Mul$/.test(k)) out[k] = (out[k] ?? 1) * v;
        else if (typeof v === "number") out[k] = (out[k] ?? 0) + v;
        else out[k] = v;
      }
    }
    { const fl = FAME ? FAME.levelFor(a) : 0; if (fl > 0) out.fameAdd = fl; }   // Fame F1 (FAME.md E1): the level reaches the engine as a passive; parley.js turns it into talk chance
    const held = JK?.activeGifts?.(a, Object.values(a.gear.equipped));   // J5 rework: one soul speaks (D55), unless the Choir sings
    if (held) {
      for (const [k, v] of Object.entries(held.inject)) {
        if (typeof v === "number" && /Mul$/.test(k)) out[k] = (out[k] ?? 1) * v;
        else if (typeof v === "number") out[k] = (out[k] ?? 0) + v;
        else out[k] = v;
      }
      if (Object.keys(held.arts).length) out.soulArts = held.arts;
      const lent = JK?.artIds?.(held.arts) || [];
      if (lent.length) out.soulArtIds = lent;
    }
    return out;
  }

  // tribute (optional): the King's Royal Tribute, { rarityMul: { rarity: × }, rarityFloor: { rarity: min level multiplier } }.
  // It multiplies the level's rarity odds; the floor lets a low-level account see rare loot it otherwise couldn't.
  function pickItem(seed, tag, kind, level, biome, exclude = new Set(), tribute = null) {
    const mul = rarityMul(level);
    const odds = (r) => Math.max(mul[r] ?? 1, tribute?.rarityFloor?.[r] ?? 0) * (tribute?.rarityMul?.[r] ?? 1);
    const rarity = weighted(roll(seed, tag + ":rarity"), Object.entries(I.rarities).map(([r, d]) => [r, d.weight * (tribute ? odds(r) : (mul[r] ?? 1))]));
    let pool = Object.entries(catalog(kind)).filter(([id, it]) => it.rarity === rarity && !exclude.has(id) && !it.dropOnly && !it.hallOnly && !it.questOnly && !it.cookOnly);   // hallOnly: the Hiring Hall's contracts; questOnly: J3 mythics are EARNED, never rolled; cookOnly: FX1 mush is made, never rolled
    if (!pool.length) pool = Object.entries(catalog(kind)).filter(([id, it]) => it.rarity !== "legendary" && !exclude.has(id) && !it.dropOnly && !it.hallOnly && !it.questOnly && !it.cookOnly);
    if (!pool.length) return null;
    const id = weighted(roll(seed, tag + ":item"), pool.map(([pid, it]) => [pid, (it.dropWeight ?? 1) * (it.biomes.includes(biome) ? I.dropRules.biomeWeight : 1)]));
    return { kind, id, rarity: catalog(kind)[id].rarity };
  }

  function rollDrops(account, result, { seed = 0, biome = null } = {}) {
    const D = I.dropRules, a = withBags(account);
    let rolls = 0;
    if (result.winner === "player") rolls = D.rollsOnWin + Math.floor((result.enemiesDefeated || 0) / D.extraRollPerEnemies) + (D.modeBonusRolls[result.mode] || 0);
    else if (roll(seed, "lossRoll") < D.lossRollChance) rolls = 1;
    // Royal Tribute (the King's true form, revealed this battle): guaranteed extra roll(s), win or lose, and rarer odds on every roll.
    const tribute = result.royalTribute || null;
    if (tribute) rolls += tribute.extraRolls || 1;
    const drops = [];
    for (let i = 0; i < rolls; i++) {
      const kind = roll(seed, `kind:${i}`) < D.equipmentShare ? "equipment" : "consumable";
      const d = pickItem(seed, `drop:${i}`, kind, a.level, biome, new Set(), tribute);
      if (d) drops.push(d);
    }
    // Story relics (Mala, 2026-10-27): "rare drops based on the stories they represent". Each defeated foe whose character
    // carries relics (items with carriedBy) rolls once; a hit drops one relic it carries that the account does not own yet.
    if (result.winner === "player") for (const [n, ch] of (result.foes || []).entries()) {
      if (roll(seed, `relic:${n}:${ch}`) >= (D.relicChance ?? 0)) continue;
      const owned = new Set([...(a.gear?.owned || []), ...drops.map((x) => x.id)]);
      const pool = Object.entries(I.equipment).filter(([id, it]) => (it.carriedBy || []).includes(ch) && !owned.has(id)).map(([id]) => id).sort();
      if (!pool.length) continue;
      const id = pool[Math.floor(roll(seed, `relicPick:${n}:${ch}`) * pool.length) % pool.length];
      drops.push({ kind: "equipment", id, rarity: I.equipment[id].rarity, relic: ch });
    }
    return drops;
  }

  function seedsFor(account, result) {
    const S = I.seedRules;
    const base = (result.winner === "player" ? S.victory : 0) + (result.enemiesDefeated || 0) * S.perEnemy
      + (result.monstersDefeated || 0) * S.perMonster + (result.correctAnswers || 0) * S.perCorrectAnswer;
    const raw = result.winner === "player" ? base : Math.max(S.minLoss, Math.round(base * S.lossShare));
    return Math.round(raw * (passives(account).seedsMul ?? 1));
  }

  function addToStash(a, id, n = 1) {
    const total = Object.values(a.stash).reduce((x, y) => x + y, 0);
    if (total + n > stashLimit(a)) return { a, added: false };
    return { a: { ...a, stash: { ...a.stash, [id]: (a.stash[id] || 0) + n } }, added: true };
  }

  // Authored case rewards are guaranteed story outcomes rather than random drops.
  function grantCampaignItem(account, id) {
    let a = withBags(account), item = I.consumables[id] || I.equipment[id];
    if (!item) return { ok: false, account: a, message: `Unknown campaign reward: ${id}.` };
    if (I.consumables[id]) a = { ...a, stash: { ...a.stash, [id]: (a.stash[id] || 0) + 1 } };
    else if (!a.gear.owned.includes(id)) a = { ...a, gear: { ...a.gear, owned: [...a.gear.owned, id], durability: { ...a.gear.durability, [id]: maxDurability(id, a) } } };
    else return { ok: true, account: a, name: item.name, alreadyOwned: true };
    return { ok: true, account: a, name: item.name };
  }

  // ── Item care (muse-jinki-care JC1 + JC2; Mala, 2026-10-26: "there should be a way to tend and take care of an item, will be
  // important for the upcoming system"). Every path that touches an item writes its biography, gear.care[id]; the care
  // score is what the Jinki build reads (awakened at 10). Love does not decay: nothing here ever lowers a record.
  const CARE = { fees: { common: 10, uncommon: 25, rare: 55, legendary: 135 }, milestones: [[3, "Known"], [6, "Fond"], [10, "Awakened"], [20, "Beloved"], [50, "Legendary"]], awaken: 10 };
  const freshCare = (giver) => ({ battles: 0, repairs: 0, cherishes: 0, kitsUsed: 0, seedsSpent: 0, dupMends: 0, givers: giver ? [giver] : [], milestones: [], origin: null, soul: null });
  const careScore = (r) => (r ? r.battles + r.repairs + 2 * r.cherishes + r.dupMends : 0);
  // Add to one item's record; returns { account, reached: [milestone names newly reached], animist: line|null }.
  function logCare(a, id, delta) {
    const was = a.gear.care?.[id] || freshCare(a.name || "you"), r = { ...was, givers: [...(was.givers || [])], milestones: [...(was.milestones || [])] };
    if (r.origin == null && JK) Object.assign(r, JK.ensureOrigin(r, I.equipment[id]?.rarity, !!I.equipment[id]?.mythic));   // J1: origin stamps at first care
    for (const [k, n] of Object.entries(delta)) r[k] = (r[k] || 0) + n;
    const reached = [];
    for (const [at, name] of CARE.milestones) if (careScore(r) >= at && !r.milestones.includes(at) && !r.milestones.includes(name)) { r.milestones.push(at); reached.push(name); }   // Tsukumogami: name-shaped records (tests) count as reached too, or the grant fires spuriously
    let account = { ...a, gear: { ...a.gear, care: { ...a.gear.care, [id]: r } } }, animist = null;
    // Tsukumogami slice 1 (Muse Berry BD, 2026-10-29): the first care-10 awakening grants the account-wide Animist
    // self-trait (insight-data), known so it never inflates the unknown-trait count. Test battles restore the account
    // snapshot (ui.js endTestBattle), so they can never grant it. One choke point: settle, battle carry and dupMends pass here.
    if (reached.includes("Awakened") && !(account.self?.traits || []).some((t) => (t?.id || t) === "animist")) {
      const T = traitDefs()?.traits?.animist;
      if (T) {
        animist = "You are an Animist now.";
        account = { ...account, self: { ...(account.self || {}), traits: [...(account.self?.traits || []), { id: "animist", name: T.name, kind: "trait", depth: 1, category: "psychology", text: T.text, apparent: true, known: true }] } };
      }
    }
    return { account, reached, animist };
  }
  // One settlement for every care write (JK rework): log the biography,
  // settle awakening/ascension, fold milestone + saga + crossing lines,
  // read the soul's voice post-check. Tend, Repair and Mend pass through
  // here. Duplicate mends and battle carry log care directly (logCare +
  // JK.check); they write once each, so nothing counts twice.
  function settle(a, id, delta, before, after, voiceMoment) {
    const logged = logCare(a, id, delta);
    const jk = JK ? JK.check(logged.account, id) : { account: logged.account, events: [] };
    const crossed = stateCrossed(id, before, after, maxDurability(id, logged.account));
    const it = I.equipment[id];
    const reached = [...logged.reached.map((m) => `${it.name} is ${m} now.`), ...(logged.animist ? [logged.animist] : []), ...jk.events.map((e) => e.saga), ...(crossed ? [crossed] : [])];
    const animistVoice = logged.animist ? soulSays(jk.account, id, "animist") : null;   // the awakened item's own voice says the grant, when it has one
    const momentVoice = voiceMoment ? soulSays(jk.account, id, voiceMoment) : null;
    return { account: jk.account, reached, crossed, voice: [momentVoice, animistVoice].filter(Boolean).join(" ") || null, cues: JK?.cues?.(jk.events, a.trackMixes) || [] };   // the moment speaks first, then the realization (composes, never replaces)
  }
  // What the Gear card shows: the score, the next milestone, the biography sentence.
  function careOf(account, id) {
    const a = withBags(account), r = a.gear.care[id] || freshCare(a.name || "you"), score = careScore(r);
    const nextM = CARE.milestones.find(([at]) => score < at), done = CARE.milestones.filter(([at]) => score >= at).pop();
    const bits = [r.cherishes ? `cherished ${r.cherishes} time${r.cherishes === 1 ? "" : "s"}` : "", r.battles ? `carried ${r.battles} battle${r.battles === 1 ? "" : "s"}` : "", r.repairs ? `mended ${r.repairs} time${r.repairs === 1 ? "" : "s"}` : "", r.dupMends ? `mended by ${r.dupMends} duplicate${r.dupMends === 1 ? "" : "s"}` : ""].filter(Boolean);
    const who = r.givers.length ? ` by ${r.givers.join(", then ")}` : "";
    const rarity = I.equipment[id] ? rarityOf(a, id) : null;
    const risen = rarity && I.equipment[id] && rarity !== I.equipment[id].rarity ? `risen ${rarity}` : "";
    const ensouled = r.soul ? `soul ${r.soul.kind}` : "";
    const glory = [risen, ensouled].filter(Boolean).join(", ");
    const giverAt = bits.findIndex((b) => !/duplicate/.test(b));   // "by you" belongs to a hand, not to a duplicate's mend (1.3.458 audit)
    const tale = bits.length ? `${bits.map((b, i) => (i === giverAt ? b + who : b)).join(", ")}`.replace(/^./, (c) => c.toUpperCase()) + "." : "";
    const line = tale ? tale + (glory ? ` ${glory[0].toUpperCase() + glory.slice(1)}.` : "") : glory ? `${glory[0].toUpperCase() + glory.slice(1)}.` : "Not yet cared for.";   // a risen or ensouled item is never "not yet cared for"
    const card = soulSays(a, id, "card");   // J4: the soul's codicil on the gear card (null when soulless — every old line untouched)
    const gift = JK?.giftLine?.(a, id);   // J5: the gift is named on the card, so the player knows the trick
    const held = gift && JK?.activeGifts?.(a, Object.values(a.gear.equipped))?.held?.includes(id);   // J5 rework: one soul speaks — the rest wait their turn
    const speaker = gift && !held ? (JK?.activeGifts?.(a, Object.values(a.gear.equipped))?.held || []).map((x) => I.equipment[x]?.name || x).join(" and ") : "";
    const worn = Object.values(a.gear.equipped).includes(id) && (a.gear.durability[id] ?? maxDurability(id, a)) > 0;
    const spent = (a.gear.durability[id] ?? maxDurability(id, a)) <= 0;   // 0 durability: the Souls strip chip says Worn, so the card says worn out too, never "(resting)" (1.3.555, post-ship gremlin on 1.3.554)
    const giftBit = gift ? `${gift}${held ? "" : spent ? " (worn out)" : worn && speaker ? ` (listening: ${speaker} speaks)` : " (resting)"}` : "";   // Active Jinki J2: name who speaks (was "(dormant)")
    const voiced = card ? `${line} ${card}` : line;
    return { score, title: done ? done[1] : null, next: nextM ? { at: nextM[0], name: nextM[1] } : null, awakened: score >= CARE.awaken,
      rarity, soul: r.soul || null, kind: (r.soul && r.soul.kind) || (JK ? JK.kindOf(r) : "humble"), line: giftBit ? `${voiced} ${giftBit}` : voiced, record: r };
  }
  // The cheapest sufficient way to tend one item now (JC1): kits by need (a full kit only for deep damage or a break), then the
  // smith's Seeds, then cherish (+1, once an item between battles). Broken items take full paths only.
  function tendPlan(account, id) {
    const a = withBags(account), it = I.equipment[id];
    if (!it || !a.gear.owned.includes(id)) return { path: "none", reason: "You don't own that gear." };
    if (enshrined(a, id)) return { path: "none", reason: inMuseum(a, id) };
    const max = maxDurability(id, a), now = a.gear.durability[id], missing = max - now;
    if (missing <= 0) return { path: "none", reason: `${it.name} is already in full repair.` };
    const kits = (kind) => Object.keys(I.consumables).filter((k) => I.consumables[k].effect?.repair === kind && a.stash[k] > 0);
    const half = kits("half"), full = kits("full"), fee = CARE.fees[rarityOf(a, id)] || CARE.fees.common;
    if (now <= 0) {
      if (full.length) return { path: "kit", kit: full[0], to: max, cost: 0 };
      if (a.seeds >= fee * 2) return { path: "smith", fee: fee * 2, to: max };
      return { path: "none", reason: `${it.name} is broken: it needs a full repair kit or the smith (${fee * 2} Seeds).` };
    }
    const halfTo = Math.min(max, now + Math.ceil(max / 2));
    if (missing > Math.ceil(max / 2) && full.length) return { path: "kit", kit: full[0], to: max, cost: 0 };
    if (half.length) return { path: "kit", kit: half[0], to: halfTo, cost: 0 };
    if (full.length && missing > 1) return { path: "kit", kit: full[0], to: max, cost: 0 };
    if (a.seeds >= fee) return { path: "smith", fee, to: max };
    if (!a.gear.cherished.includes(id)) return { path: "cherish", to: now + 1 };
    return { path: "none", reason: `${it.name} was cherished already since the last battle; a kit or ${fee} Seeds would mend it.` };
  }
  function applyTend(account, id, plan) {
    let a = withBags(account); const it = I.equipment[id];
    if (plan.path === "none") return { ok: false, account: a, reason: plan.reason };
    let line, delta;
    if (plan.path === "kit") { const stash = { ...a.stash, [plan.kit]: a.stash[plan.kit] - 1 }; if (!stash[plan.kit]) delete stash[plan.kit]; a = { ...a, stash }; delta = { repairs: 1, kitsUsed: 1 }; line = `${it.name} mended with a ${I.consumables[plan.kit].name}`; }
    else if (plan.path === "smith") { a = { ...a, seeds: a.seeds - plan.fee }; delta = { repairs: 1, seedsSpent: plan.fee }; line = `The smith mends ${it.name} for ${plan.fee} Seeds`; }
    else { a = { ...a, gear: { ...a.gear, cherished: [...a.gear.cherished, id] } }; delta = { cherishes: 1 }; line = `You cherish ${it.name}: +1 durability`; }
    const before = a.gear.durability[id] ?? maxDurability(id, a);
    a = { ...a, gear: { ...a.gear, durability: { ...a.gear.durability, [id]: plan.to } } };
    const s = settle(a, id, delta, before, plan.to, plan.path === "cherish" ? "cherished" : plan.path === "smith" ? "smith" : "tended");
    const voice = s.voice;
    return { ok: true, account: s.account, path: plan.path, line: voice ? `${/[.!?]$/.test(line) ? line : line + "."} ${voice}` : line, reached: s.reached, crossed: s.crossed, cues: s.cues };   // a finished sentence before the soul speaks (merge, 1.3.463)
  }
  const tend = (account, id) => applyTend(account, id, tendPlan(account, id));
  // Cherish on its own (always the love path, even when a kit could do more): +1 durability and +1 care, once between battles.
  function cherish(account, id) {
    const a = withBags(account), it = I.equipment[id];
    if (!it || !a.gear.owned.includes(id)) return { ok: false, account: a, reason: "You don't own that gear." };
    if (enshrined(a, id)) return { ok: false, account: a, reason: inMuseum(a, id) };
    if (a.gear.durability[id] <= 0) return { ok: false, account: a, reason: `${it.name} is broken; love cannot raise it. It needs a full repair.` };
    if (a.gear.cherished.includes(id)) return { ok: false, account: a, reason: `You cherished ${it.name} already since the last battle.` };
    return applyTend(a, id, { path: "cherish", to: Math.min(maxDurability(id, a), a.gear.durability[id] + 1) });
  }
  // Tend All: every damaged item, free paths first (kits), then the smith cheapest-fee first while Seeds last, then cherish.
  function tendAll(account) {
    let a = withBags(account); const lines = [], reached = [], cues = [];
    const rank = { kit: 0, smith: 1, cherish: 2 };
    for (let guard = 0; guard < 64; guard++) {
      const plans = a.gear.owned.map((id) => ({ id, plan: tendPlan(a, id) })).filter((x) => x.plan.path !== "none");
      if (!plans.length) break;
      plans.sort((x, y) => rank[x.plan.path] - rank[y.plan.path] || (x.plan.fee || 0) - (y.plan.fee || 0) || x.id.localeCompare(y.id));
      const r = applyTend(a, plans[0].id, plans[0].plan); if (!r.ok) break;
      a = r.account; lines.push(r.line); reached.push(...r.reached); cues.push(...(r.cues || []));
    }
    return { ok: lines.length > 0, account: a, lines, reached, cues };
  }
  function finishBattle(account, result, { seed = 0, biome = null, stakes = null } = {}) {
    const pass = passives(account);
    const xpResult = A.awardBattle(account, result, { xpMul: pass.xpMul ?? 1 });
    let a = withBags(xpResult.account);
    let stakeLines = [];
    if (stakes?.state === "agreed" && AN) {   // W1.5: after the award (cooldowns set here tick next battle, not this one)
      const r = AN.applyResolution(a, stakes, result.winner, A.stripLevels);
      a = r.account; stakeLines = r.lines;
    }
    let pvLines = [];   // W4.4: kept vows on a win pay the stipend and bonus credits (the base discovery is W6.1's grant below); broken ones mark the ledger. XP rode in on the award above.
    if (result.pvSeeds || result.pvCredits || result.pvMarks?.length) {
      a = { ...a, seeds: a.seeds + (result.pvSeeds || 0), discoveries: (a.discoveries || 0) + (result.pvCredits || 0), marks: [...(a.marks || []), ...(result.pvMarks || [])].slice(-50) };
      pvLines = result.pvLines || [];
    }
    let titleLines = [];   // W9.5: title-bout transfers (decided upstream in ui.js; loot only applies)
    if (result.titleTransfer) {
      const t = [...withBags(a).schoolTitles];
      if (result.titleTransfer.gain) t.push({ school: result.titleTransfer.gain.school || null, name: result.titleTransfer.gain.name, won: Date.now() });
      if (result.titleTransfer.lose) { const i = t.findIndex((x) => x.name === result.titleTransfer.lose); if (i >= 0) t.splice(i, 1); }
      a = { ...a, schoolTitles: t, wornSchoolTitle: result.titleTransfer.lose && a.wornSchoolTitle === result.titleTransfer.lose ? "" : a.wornSchoolTitle };
      titleLines = result.titleTransfer.lines || [];
    }
    let weighLines = [];   // W9.3: the weighing lands in the deaths ledger (readable books — audit the wicked); the tithe applies when bequest (W8.2) lands
    if (result.weighing) {
      const w = result.weighing;
      a = { ...a, deaths: [...(a.deaths || []), { seed: w.seed ?? null, round: w.round ?? null, clean: w.clean, sins: w.sins, burned: w.burned, tithe: w.tithe, appeal: w.appeal, restTo: w.restTo || [] }].slice(-20) };
      weighLines = w.lines || [];
    }
    if (result.convertMarks?.length) {   // W1.4: edit-flips mark forgery + cruelty (C4: the game remembers)
      a = { ...a, marks: [...(a.marks || []), ...result.convertMarks].slice(-50) };
    }
    const board = MINT ? MINT.capped("board", result.boardSeeds || 0) : { seeds: 0, flag: null };   // W4.2 faucet (W4.1 cap): missions pay through the mint
    const scenario = MINT ? MINT.capped("scenario", result.scenarioBonusSeeds || 0) : { seeds: 0, flag: null };   // S7 faucet (R-20261103-03 D8): scenario bonuses pay through the mint
    const seeds = seedsFor(account, result) + (result.winner === "player" ? result.jackpotSeeds || 0 : 0) + board.seeds + scenario.seeds;   // W5.3: the table's pot pays the winner only
    a = { ...a, seeds: a.seeds + seeds, carried: [] };                 // unused carried items return to the stash below
    for (const id of withBags(account).carried) a = addToStash(a, id).a;
    // wear: every equipped piece loses durability for the battle it was worn in
    const durability = { ...a.gear.durability }, wearLines = [];
    const cameBroken = new Set(Object.values(a.gear.equipped).filter((id) => (durability[id] ?? 1) <= 0));   // broken before the battle
    for (const id of Object.values(a.gear.equipped)) {
      if (durability[id] <= 0) continue;
      const before = durability[id];
      durability[id] = Math.max(0, durability[id] - I.rules.durability.wearPerBattle);
      if (durability[id] === 0) wearLines.push(`${I.equipment[id].name} is worn out: repair it to get its effect back`);
      else if (durability[id] <= I.rules.durability.warnAt) wearLines.push(`${I.equipment[id].name} has ${durability[id]} battle${durability[id] === 1 ? "" : "s"} left`);
      const fell = stateCrossed(id, before, durability[id], maxDurability(id, a));   // J2: wear crossing down is a decay moment
      if (fell) wearLines.push(fell);
    }
    a = { ...a, gear: { ...a.gear, durability, cherished: [] } };   // a battle refreshes cherish
    const careLines = [], battleCues = [];
    for (const id of new Set(Object.values(a.gear.equipped))) {
      if (!a.gear.owned.includes(id)) continue;
      // Mala, 2026-10-27: "taking an item into battle broken is not what a caring owner would do". A piece that was
      // already broken earns no care; one that breaks during this battle was brought in whole, so it still counts.
      if (cameBroken.has(id)) continue;
      const r = logCare(a, id, { battles: 1 }); a = r.account;   // JC2: worn into battle
      careLines.push(...r.reached.map((m) => `${I.equipment[id].name} is ${m} now.`));
      if (r.animist) careLines.push(r.animist);
      if (JK) { const jk = JK.check(a, id); a = jk.account; careLines.push(...jk.events.map((e) => e.saga)); battleCues.push(...JK.cues(jk.events, a.trackMixes)); }
    }
    const drops = rollDrops(account, result, { seed, biome });
    for (const id of result.fragments || []) if (I.equipment[id]) drops.push({ kind: "equipment", id, rarity: I.equipment[id].rarity, fragment: true });   // SPEC muse-fragments: gold-shed charms grant like gear (dupes convert at rarity sell)
    const kept = result.vowsKept || 0, earned = TR && kept > 0 ? TR.grantFor(a, "vow", kept) : null;   // W6.1: kept vows pay discoveries
    if (earned) a = earned.account;
    const show = Math.max(0, Math.min(40, result.showboat || 0));   // W6.5: the crowd pays for theater (capped, UI-judged)
    if (show > 0) a = { ...a, seeds: a.seeds + show };
    const lines = [...xpResult.lines, `+${seeds - (result.winner === "player" ? result.jackpotSeeds || 0 : 0)} Seeds`, ...(result.winner === "player" && result.jackpotSeeds > 0 ? [`Jackpot: +${result.jackpotSeeds} Seeds from the table.`] : []), ...stakeLines, ...(earned ? earned.lines : []), ...pvLines, ...(board.seeds ? [`Contract board pays ${board.seeds} Seeds${board.flag ? ` (${board.flag})` : ""}.`] : board.flag ? [board.flag] : []), ...(scenario.seeds ? [`Scenario bonus pays ${scenario.seeds} Seeds${scenario.flag ? ` (${scenario.flag})` : ""}.`] : scenario.flag ? [scenario.flag] : []), ...titleLines, ...weighLines, ...(result.dopeLines || []), ...(show > 0 ? [`Showboat: +${show} Seeds from the crowd.`] : []), ...wearLines, ...careLines];
    for (const d of drops) {
      const it = catalog(d.kind)[d.id];
      if (d.kind === "equipment" && a.gear.owned.includes(d.id)) {
        if (I.rules.durability.duplicateRepairs && a.gear.durability[d.id] < maxDurability(d.id, a) && !enshrined(a, d.id)) {   // an enshrined piece is frozen: its duplicate takes the refund path
          const dupBefore = a.gear.durability[d.id], dupMax = maxDurability(d.id, a);
          a = { ...a, gear: { ...a.gear, durability: { ...a.gear.durability, [d.id]: dupMax } } };
          lines.push(`${it.name} (duplicate): your worn one is fully repaired`); d.repaired = true;
          { const crossedUp = stateCrossed(d.id, dupBefore, dupMax, dupMax); if (crossedUp) lines.push(crossedUp); }   // J2: a duplicate's mend is a restoration moment too (merge, 1.3.460)
          { const logged = logCare(a, d.id, { dupMends: 1 }); a = logged.account; for (const m of logged.reached) lines.push(`${it.name} is ${m} now.`); if (logged.animist) lines.push(logged.animist); }   // JK-01: the mend counts (JC2, restored from comment)
          if (JK) { const jk = JK.check(a, d.id); a = jk.account; lines.push(...jk.events.map((e) => e.saga)); battleCues.push(...JK.cues(jk.events, a.trackMixes)); }
        } else {
          const refund = I.rarities[it.rarity].sell; a = { ...a, seeds: a.seeds + refund };   // AP-01 round 2 (3): the duplicate is a fresh base copy — ascension isn't duplicable
          lines.push(`${it.name} (duplicate) → +${refund} Seeds`); d.converted = refund;
        }
      } else if (d.kind === "equipment") {
        a = { ...a, gear: { ...a.gear, owned: [...a.gear.owned, d.id], durability: { ...a.gear.durability, [d.id]: maxDurability(d.id, a) } } };
        lines.push(`New gear: ${it.name} (${rarityOf(a, d.id)}, lasts ${maxDurability(d.id, a)} battles)`);
      } else {
        const r = addToStash(a, d.id);
        if (r.added) { a = r.a; lines.push(`Found: ${it.name}`); }
        else { const refund = I.rarities[it.rarity].sell; a = { ...a, seeds: a.seeds + refund }; lines.push(`Stash full: ${it.name} sold for ${refund} Seeds`); d.converted = refund; }
      }
    }
    return { account: a, xp: xpResult.xp, seeds, drops, unlocked: xpResult.unlocked, lines, cues: battleCues };
  }

  // ── shop ───────────────────────────────────────────────────────────────
  function shopStock(account, { seed = 0, biome = null } = {}) {
    const a = withBags(account), R = I.shopRules, out = [], seen = new Set();
    for (let i = 0; i < R.consumableStock; i++) { const d = pickItem(seed, `shopC:${i}`, "consumable", a.level, biome, seen); if (d) { seen.add(d.id); out.push(d); } }
    const ownedOrSeen = new Set([...a.gear.owned]);
    for (let i = 0; i < R.equipmentStock; i++) {
      let d = pickItem(seed, `shopE:${i}`, "equipment", a.level, biome, ownedOrSeen);
      if (d && d.rarity === "legendary" && out.some((o) => o.rarity === "legendary")) d = pickItem(seed, `shopE:${i}:again`, "equipment", 1, biome, ownedOrSeen);
      if (d) { ownedOrSeen.add(d.id); out.push(d); }
    }
    if (MK) for (const id of ["shard", "bead", "orb"]) out.push({ kind: "vessel", id, rarity: "common", base: MK.RULES.buyPrice[id] });   // vessel economy: vessels + parts ride the shop (own ledgers, drifted like everything)
    if (MK) for (const id of ["common", "uncommon", "rare"]) out.push({ kind: "part", id, rarity: "common", base: MK.RULES.partPrice[id] });
    return out.map((d, i) => {
      const drift = 0.75 + roll(seed, `shopDrift:${d.kind}:${d.id}:${i}`) * 0.75;   // W7.2: prices breathe 75%-150% of the rarity base
      if (d.kind === "vessel" || d.kind === "part") return { ...d, price: Math.max(1, Math.round(d.base * drift)), drift, name: d.kind === "vessel" ? d.id : MK.PART_NAME[d.id] };
      return { ...d, price: Math.max(1, Math.round(I.rarities[d.rarity].price * drift)), drift, name: catalog(d.kind)[d.id].name };
    });
  }
  // The Hiring Hall (town): merc contracts and letters of safe conduct, always in stock at their fixed price.
  // S1a: fame discount (F1) × Bargain Hall −10%/rank × tomatoed +10%; never under 70% of list.
  function hallMult(account) {
    const a = withBags(account);
    const fameOff = FAME ? FAME.effects(FAME.levelFor(a)).hallDiscount : 0;
    const bargain = 0.10 * Math.max(0, Math.floor(a.perks?.bargainHall || 0));
    const tomato = (a.marks || []).includes("tomatoed") ? 0.10 : 0;
    return (1 - fameOff) * (1 - bargain) * (1 + tomato);
  }
  function hallPrice(account, listPrice) {
    const list = Math.max(0, Number(listPrice) || 0);
    const raw = Math.max(1, Math.round(list * hallMult(account)));
    const floor = Math.max(1, Math.round(list * 0.7));
    return Math.max(floor, raw);
  }
  function hallStock(account) {
    const a = withBags(account);
    return Object.entries(I.consumables).filter(([, it]) => it.hallOnly).map(([id, it]) => ({ kind: "consumable", id, rarity: it.rarity, price: hallPrice(a, it.price), listPrice: it.price, name: it.name, text: it.text, owned: a.stash[id] || 0 }));
  }
  function buy(account, offer) {
    let a = withBags(account);
    if (a.seeds < offer.price) return { ok: false, account: a, reason: `Not enough Seeds (${a.seeds}/${offer.price}).` };
    if (offer.kind === "vessel") { const vessels = { shard: 0, bead: 0, orb: 0, ...(a.vessels || {}) }; vessels[offer.id]++; return { ok: true, account: { ...a, seeds: a.seeds - offer.price, vessels } }; }   // vessel economy: own ledger, not the stash
    if (offer.kind === "part") { const parts = { common: 0, uncommon: 0, rare: 0, ...(a.parts || {}) }; parts[offer.id]++; return { ok: true, account: { ...a, seeds: a.seeds - offer.price, parts } }; }
    if (offer.kind === "equipment") {
      if (a.gear.owned.includes(offer.id)) return { ok: false, account: a, reason: "You already own that." };
      a = { ...a, seeds: a.seeds - offer.price, gear: { ...a.gear, owned: [...a.gear.owned, offer.id], durability: { ...a.gear.durability, [offer.id]: maxDurability(offer.id, a) } } };
    } else {
      const r = addToStash({ ...a, seeds: a.seeds - offer.price }, offer.id);
      if (!r.added) return { ok: false, account: a, reason: `Your stash is full (${stashLimit(a)}).` };
      a = r.a;
    }
    // Perks S1a: a real Hall hire purchase is a `hires` deed (merc / letter of safe conduct).
    if (offer.kind === "consumable" && I.consumables[offer.id]?.hallOnly && I.consumables[offer.id]?.effect?.hire && A.noteDeed)
      a = A.noteDeed(a, "hires", 1).account;
    return { ok: true, account: a };
  }
  function sell(account, kind, id) {
    let a = withBags(account); const it = catalog(kind)[id];
    if (!it) return { ok: false, account: a, reason: "Unknown item." };
    let value = I.rarities[it.rarity].sell;   // sold at the born rarity: Jinki care is sentimental, never Seeds (Mala, 2026-10-27; crafting is the money system)
    if (kind === "equipment") {
      if (id === "orgoniteCharm") return { ok: false, account: a, reason: "The Orcish fence is the only buyer for an orgonite charm." };
      if (!a.gear.owned.includes(id)) return { ok: false, account: a, reason: "You don't own that." };
      if (enshrined(a, id)) return { ok: false, account: a, reason: inMuseum(a, id) };
      if (worn(a, id)) value = Math.round(value * I.rules.durability.brokenSellShare);
      const equipped = Object.fromEntries(Object.entries(a.gear.equipped).filter(([, v]) => v !== id));
      const durability = { ...a.gear.durability }; delete durability[id];
      a = { ...a, seeds: a.seeds + value, gear: { ...a.gear, owned: a.gear.owned.filter((x) => x !== id), equipped, durability, speaking: a.gear.speaking === id ? null : a.gear.speaking } };   // selling the chosen soul clears the choice   // keep every other item's care, cherished and history (audit 2026-10-27: a sale wiped them all)
    } else {
      if (!(a.stash[id] > 0)) return { ok: false, account: a, reason: "None in your stash." };
      const stash = { ...a.stash, [id]: a.stash[id] - 1 }; if (!stash[id]) delete stash[id];
      a = { ...a, seeds: a.seeds + value, stash };
    }
    return { ok: true, account: a, value };
  }

  // Kit-board salvage (Mala, 2026-11-05: "a spot to drag and drop to trash an item or sell an item for seeds (10% value)").
  // Consumables resell here at 10% of rarity price (3/7/16/40) — deliberately below sell()'s 40% rate, which a
  // "no new faucet" test pins for the engine path. Trash destroys with no return. One unit per call.
  function sellConsumable(account, id) {
    let a = withBags(account); const it = I.consumables[id];
    if (!it) return { ok: false, account: a, reason: "Unknown item." };
    if (!(a.stash[id] > 0)) return { ok: false, account: a, reason: "None in your stash." };
    const value = Math.round(I.rarities[it.rarity].price * I.rules.salvageShare);
    const stash = { ...a.stash, [id]: a.stash[id] - 1 }; if (!stash[id]) delete stash[id];
    return { ok: true, account: { ...a, seeds: a.seeds + value, stash }, value };
  }
  function trashConsumable(account, id) {
    let a = withBags(account); const it = I.consumables[id];
    if (!it) return { ok: false, account: a, reason: "Unknown item." };
    if (!(a.stash[id] > 0)) return { ok: false, account: a, reason: "None in your stash." };
    const stash = { ...a.stash, [id]: a.stash[id] - 1 }; if (!stash[id]) delete stash[id];
    return { ok: true, account: { ...a, stash } };
  }

  // ── The Museum (M1) ──
  // A piece qualifies when it has been cherished at least once or has awakened (care score 10 or more; M3). It must be owned and not already placed.
  const AWAKENED_SCORE = 10;
  function museumQualifies(account, id) {
    const a = withBags(account), r = a.gear.care[id];
    return !!I.equipment[id] && a.gear.owned.includes(id) && !!r && (r.cherishes >= 1 || careScore(r) >= AWAKENED_SCORE);
  }
  // Enshrine: the piece comes off, stays owned, and is frozen as it is; a chosen speaking soul that is enshrined clears the choice. `first` is true the first time any piece is placed
  // (the placement scene, M9, plays once). Placing a piece that is already placed is a no-op that says so.
  function enshrine(account, id) {
    let a = withBags(account); const it = I.equipment[id];
    if (!it) return { ok: false, account: a, reason: "Not equipment." };
    if (!a.gear.owned.includes(id)) return { ok: false, account: a, reason: "You don't own that." };
    if (enshrined(a, id)) return { ok: true, account: a, already: true };
    if (!museumQualifies(a, id)) return { ok: false, account: a, reason: `${it.name} has not been cherished yet: the Museum keeps what has been loved.` };
    if (a.museum.placed.length >= a.museum.plinths) return { ok: false, account: a, reason: `Every plinth is taken (${a.museum.placed.length} of ${a.museum.plinths}).` };
    const equipped = Object.fromEntries(Object.entries(a.gear.equipped).filter(([, v]) => v !== id)), first = !a.museum.scene;
    a = { ...a, gear: { ...a.gear, equipped, speaking: a.gear.speaking === id ? null : a.gear.speaking }, museum: { ...a.museum, placed: [...a.museum.placed, id], scene: true } };
    return { ok: true, account: a, first };
  }
  // Take a piece back, free, between battles: it returns exactly as it left (off the body; equip it again to wear it), and its care resumes.
  function withdraw(account, id) {
    const a = withBags(account);
    if (!enshrined(a, id)) return { ok: false, account: a, reason: "That is not in the Museum." };
    return { ok: true, account: { ...a, museum: { ...a.museum, placed: a.museum.placed.filter((x) => x !== id) } } };
  }
  // ── Active Jinki (J1): which awakened soul speaks ──
  // Choose a soul to speak (an owned, awakened piece; it need not be worn: it is then "resting" until it is), or null for the automatic rule (the strongest speaks). Between battles only.
  function setSpeaking(account, id) {
    const a = withBags(account);
    if (id == null) return { ok: true, account: { ...a, gear: { ...a.gear, speaking: null } } };
    if (!a.gear.owned.includes(id)) return { ok: false, account: a, reason: "You don't own that." };
    if (enshrined(a, id)) return { ok: false, account: a, reason: inMuseum(a, id) };
    if (!JK?.giftsFor?.(a, id)) return { ok: false, account: a, reason: "Only an awakened piece has a soul to hear." };
    return { ok: true, account: { ...a, gear: { ...a.gear, speaking: id } } };
  }
  // The lines the round-1 log shows for the souls that speak this battle: "Worn cap speaks: Breakfall II." (none when no soul speaks).
  function speakingLines(account) {
    const a = withBags(account), held = JK?.activeGifts?.(a, Object.values(a.gear.equipped))?.held || [];
    return held.map((id) => `${I.equipment[id].name} speaks: ${JK.giftName(a, id)}.`);
  }
  // The Souls strip (Active Jinki J2): every awakened piece the player owns, outside the Museum, with the state the Field Kit shows.
  // Speaking: it speaks next battle. Listening: worn and awake, but another speaks. Resting: awakened, not worn. Worn: 0 durability.
  // `summary` is the line under the strip; `resting` is why a chosen soul is not speaking (null when it speaks or there is no choice).
  function soulStrip(account) {
    const a = withBags(account), worn = Object.values(a.gear.equipped), held = JK?.activeGifts?.(a, worn)?.held || [];
    const ROMAN = [null, "I", "II", "III"], name = (id) => I.equipment[id]?.name || id;
    const chips = a.gear.owned.filter((id) => I.equipment[id] && !enshrined(a, id) && JK?.giftsFor?.(a, id)).map((id) => {
      const g = JK.giftsFor(a, id), broken = (a.gear.durability[id] ?? maxDurability(id, a)) <= 0;
      const state = held.includes(id) ? "Speaking" : broken ? "Worn" : worn.includes(id) ? "Listening" : "Resting";
      return { id, name: name(id), kind: g.kind, tier: g.tier, gift: `${g.kind} ${ROMAN[g.tier]}: ${g.name}`, state, chosen: a.gear.speaking === id };
    });
    const speaks = held.map((id) => chips.find((c) => c.id === id)).filter(Boolean).map((c) => `${c.name} (${c.gift})`);
    const choir = (a.perks?.soulChoir || 0) > 0;
    const summary = !speaks.length ? "No soul speaks in battle." : choir ? `Choir: a soul of each kind speaks: ${speaks.join(", ")}.` : `Speaks in battle: ${speaks[0]}.`;
    return { mode: a.gear.speaking ? "choose" : "auto", chips, summary, choir, resting: JK?.restingReason?.(a, worn, name) || null };
  }
  // ── gear and battle packing ──────────────────────────────────────────────
  function equip(account, id) {
    const a = withBags(account), it = I.equipment[id];
    if (!it) return { ok: false, account: a, reason: "Not equipment." };
    if (!a.gear.owned.includes(id)) return { ok: false, account: a, reason: "You don't own that yet." };
    if (enshrined(a, id)) return { ok: false, account: a, reason: inMuseum(a, id) };
    return { ok: true, account: { ...a, gear: { ...a.gear, equipped: { ...a.gear.equipped, [it.slot]: id } } } };
  }
  function unequip(account, slot) {
    const a = withBags(account), equipped = { ...a.gear.equipped }; delete equipped[slot];
    return { ok: true, account: { ...a, gear: { ...a.gear, equipped } } };
  }
  const needTraitDefs = () => require("../insight/insight-data.js");   // node-only getter: the engine-parts walk treats `=> require(` as lazy (must load, order free)
  const traitDefs = () => (typeof module === "object" && module.exports ? needTraitDefs() : globalThis.ConceptCombatInsightData) || null;   // lazy: no tag-order knot
  const traitBonus = (account, key) => { const T = traitDefs()?.traits; if (!T) return 0; return ((account?.self?.traits || [])).reduce((n, t) => n + (T[typeof t === "string" ? t : t?.id]?.combat?.extra?.[key] || 0), 0); };   // the player's own feats widen the account's carrying (packMule, fourArms)
  function battleSlots(account) { return I.rules.battleSlots + (passives(account).battleSlotsAdd || 0) + traitBonus(account, "battleSlotsAdd"); }
  function stashLimit(account) { return I.rules.stashLimit + traitBonus(account, "stashLimitAdd"); }   // the mule widens the stash everywhere it is read: logic, messages, kit header
  function packForBattle(account, ids) {
    let a = withBags(account);
    if (ids.length > battleSlots(a)) return { ok: false, account: a, reason: `You can carry ${battleSlots(a)} items into battle.` };
    const stash = { ...a.stash };
    for (const id of ids) {
      if (I.consumables[id]?.outsideBattle) return { ok: false, account: a, reason: `${I.consumables[id].name} is used between battles, not carried into one.` };
      if (!(stash[id] > 0)) return { ok: false, account: a, reason: `No ${I.consumables[id]?.name || id} in your stash.` }; stash[id] -= 1; if (!stash[id]) delete stash[id]; }
    return { ok: true, account: { ...a, stash, carried: ids.slice() }, carried: ids.slice() };
  }
  // Use a repair item from the stash on one piece of gear (between battles).
  function repairService(account, gearId) {   // W7.2: the shop mends for half price (floor 5) — kits stay for the field
    const a = withBags(account), it = I.equipment[gearId];
    if (!it) return { ok: false, account: a, reason: "Unknown gear." };
    if (!a.gear.owned.includes(gearId)) return { ok: false, account: a, reason: "You don't own that." };
    if (enshrined(a, gearId)) return { ok: false, account: a, reason: inMuseum(a, gearId) };
    const full = maxDurability(gearId, a);
    if ((a.gear.durability[gearId] ?? full) >= full) return { ok: false, account: a, reason: "Already hale." };
    const cost = Math.max(5, Math.round(I.rarities[rarityOf(a, gearId)].price / 2));
    if (a.seeds < cost) return { ok: false, account: a, reason: `Not enough Seeds (${a.seeds}/${cost}).` };
    const s = settle({ ...a, seeds: a.seeds - cost, gear: { ...a.gear, durability: { ...a.gear.durability, [gearId]: full } } }, gearId, { repairs: 1, seedsSpent: cost }, a.gear.durability[gearId] ?? full, full, "smith");   // JK-03: the smith's mend counts, like the tend-smith's
    return { ok: true, account: s.account, cost, reached: s.reached, cues: s.cues,
      line: s.voice,   // J4: the voice alone (null keeps the smith silent, as today)
      crossed: s.crossed };   // J2: the smith's mend is always a restoration moment
  }
  function buyMix(account, itemId, mix) {   // W7.2: 40 Seeds outfits a piece with its theme (base is free, always)
    const a = withBags(account);
    if (!["lofi", "stripped"].includes(mix)) return { ok: false, account: a, reason: "The shop cuts lofi and stripped; base comes free." };
    if (!a.gear.owned.includes(itemId)) return { ok: false, account: a, reason: "Outfit gear you own." };
    if (enshrined(a, itemId)) return { ok: false, account: a, reason: inMuseum(a, itemId) };   // a placed piece is frozen as it is (Museum M1: reverence, no outfit changes)
    if (a.trackMixes[itemId] === mix) return { ok: false, account: a, reason: "Already wearing that mix." };
    if (a.seeds < 40) return { ok: false, account: a, reason: `Not enough Seeds (${a.seeds}/40).` };
    return { ok: true, account: { ...a, seeds: a.seeds - 40, trackMixes: { ...a.trackMixes, [itemId]: mix } } };
  }
  function repair(account, gearId, kitId) {
    const a = withBags(account), kit = I.consumables[kitId];
    if (!kit || !kit.effect.repair) return { ok: false, account: a, reason: "That isn't a repair item." };
    if (!(a.stash[kitId] > 0)) return { ok: false, account: a, reason: `No ${kit.name} in your stash.` };
    if (!a.gear.owned.includes(gearId)) return { ok: false, account: a, reason: "You don't own that gear." };
    if (enshrined(a, gearId)) return { ok: false, account: a, reason: inMuseum(a, gearId) };
    const max = maxDurability(gearId, a), now = a.gear.durability[gearId];
    if (now >= max) return { ok: false, account: a, reason: `${I.equipment[gearId].name} is already in full repair.` };
    const after = kit.effect.repair === "full" ? max : Math.min(max, now + Math.ceil(max / 2));
    const stash = { ...a.stash, [kitId]: a.stash[kitId] - 1 }; if (!stash[kitId]) delete stash[kitId];
    const s = settle({ ...a, stash, gear: { ...a.gear, durability: { ...a.gear.durability, [gearId]: after } } }, gearId, { repairs: 1, kitsUsed: 1 }, now, after, "mended");   // JK-02: a kit mend settles like a tend
    return { ok: true, account: s.account, durability: s.account.gear.durability[gearId], max: maxDurability(gearId, s.account), reached: s.reached, cues: s.cues,
      line: s.voice,   // J4: the voice alone (null keeps repair silent, as today)
      crossed: s.crossed };   // J2: the mend may be a restoration moment
  }

  function useCarried(account, id) {
    const a = withBags(account), i = a.carried.indexOf(id);
    if (i < 0) return a;
    return { ...a, carried: [...a.carried.slice(0, i), ...a.carried.slice(i + 1)] };
  }
  function castOrgoniteCharm(account) {
    const KR = (typeof module === "object" && module.exports) ? require("./crafting.js") : (typeof self !== "undefined" ? self : globalThis).ConceptCombatCrafting;
    const a = withBags(account);
    const spent = KR.castCharm(a);
    if (!spent.ok) return { ok: false, account: a, short: spent.short };
    const id = KR.CHARM.id;
    const gear = { ...spent.account.gear, owned: [...spent.account.gear.owned, id], durability: { ...spent.account.gear.durability, [id]: maxDurability(id, spent.account) } };
    return { ok: true, account: { ...spent.account, gear }, id };
  }

  return { finishBattle, grantCampaignItem, castOrgoniteCharm, rollDrops, seedsFor, shopStock, hallStock, hallPrice, hallMult, buy, sell, sellConsumable, trashConsumable, equip, unequip, passives, setSpeaking, speakingLines, soulStrip, museumQualifies, enshrine, withdraw, enshrined, MUSEUM_PLINTHS, battleSlots, stashLimit, packForBattle, useCarried, repair, repairService, buyMix, maxDurability, withBags, tend, tendAll, cherish, careOf, empowerLines, data: I };
});
