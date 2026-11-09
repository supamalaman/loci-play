"use strict";
// Cooking (Mala, 2026-10-25; docs/cooking-alchemy.md). Ingredients carry tags; a recipe asks for tags, not items, so new food
// art only needs tags. Pure and data-only: the numbers live here, the camp UI and the engine's Cook action call these.
//
//   Where: anyone cooks every recipe between battles (the camp kitchen, from the stash). In battle, everyone can make the
//     `field` recipes (roast one raw thing, steep a tea); cooks (COOKS below) make every recipe there too.
//   Using a consumable costs less AP the better it is (Mala, 2026-10-25: "a well prepared meal should be easy to eat (low AP)
//     same for high quality consumables in general"): food by preparation (raw 30, ready 20, dish 10), anything else by
//     rarity (common 20, uncommon 15, rare 10, legendary 5).
//   Termination: a recipe consumes all of its inputs and makes one item; no output is an input of a recipe that makes what
//     it was made from (tests/cooking.test.mjs walks the recipe graph), and the AI never cooks.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./items-data.js"));
  else root.ConceptCombatCooking = factory(root.ConceptCombatItems);
})(typeof self !== "undefined" ? self : this, function (I) {
  // prep: raw | ready (cooked, packaged, poured) | dish. Tags drive recipes. Items not listed are not food.
  const FOOD = {
    fish: { prep: "raw", tags: ["fish"] }, earOfCorn: { prep: "raw", tags: ["grain"] }, cornKernels: { prep: "raw", tags: ["grain"] },
    orchardApple: { prep: "raw", tags: ["fruit", "sweet"] }, banana: { prep: "raw", tags: ["fruit", "sweet"] },
    hawthornBerry: { prep: "raw", tags: ["fruit"] }, bitterMelon: { prep: "raw", tags: ["fruit", "bitter"] },
    hawthornLeaf: { prep: "raw", tags: ["herb"] }, hawthornFlower: { prep: "raw", tags: ["herb", "flower"] }, blossomBranch: { prep: "raw", tags: ["flower"] },
    pohiLeaf: { prep: "raw", tags: ["herb", "greens"] }, pohiFlower: { prep: "raw", tags: ["herb", "flower"] }, cupFungus: { prep: "raw", tags: ["fungus"] },
    fishEggs: { prep: "raw", tags: ["sea"] },
    tofu: { prep: "raw", tags: ["tofu"] }, shiitake: { prep: "raw", tags: ["fungus"] }, bokChoy: { prep: "raw", tags: ["greens"] },
    beefSlices: { prep: "raw", tags: ["meat"] }, chiliPepper: { prep: "raw", tags: ["spice"] },
    cornSkewer: { prep: "ready", tags: ["grain"] }, fishFillet: { prep: "ready", tags: ["fish"] }, seaweedWrap: { prep: "ready", tags: ["sea", "greens"] },
    chipBag: { prep: "ready", tags: ["grain"] }, trailMix: { prep: "ready", tags: ["sweet"] }, jellyCup: { prep: "ready", tags: ["sweet"] },
    herbCup: { prep: "ready", tags: [] }, bobaTea: { prep: "ready", tags: ["sweet"] }, sodaCan: { prep: "ready", tags: ["sweet"] },
    coldBrew: { prep: "ready", tags: [] }, waterBottle: { prep: "ready", tags: ["water"] }, electrolytes: { prep: "ready", tags: ["water"] },
    mapoTofu: { prep: "dish", tags: [] }, hotpot: { prep: "dish", tags: [] }, marketBox: { prep: "dish", tags: [] },
    stadiumBloodyMary: { prep: "dish", tags: [] },   // a ballpark novelty: found or bought, never cooked
  };
  const rules = {
    eatAp: { raw: 30, ready: 20, dish: 10 },   // AP to eat or drink, by preparation: the better prepared, the quicker to eat
    useAp: { common: 20, uncommon: 15, rare: 10, legendary: 5 },   // AP to use any other consumable, by rarity
    cookAp: { field: 20, full: 35 },            // AP for the Cook action in battle; free at camp
    // Cooks make full recipes in battle (Mala: "Chefs, Hot Pot Berserker, Hedge Witch etc can cook full recipes in battle").
    cooks: { characters: ["hedge_witch", "shaman", "hot_pot_berserker", "chef"], concepts: ["herbal_medicine", "traditional_medicine"] },
    culinaryTraining: { trait: "culinaryTraining", foodApLess: 10, floor: 5 },   // the trait's class-free food buff (useCost)
  };
  // needs: one ingredient per entry, each entry a tag (or "tag|tag"); `from`: an exact item instead (a roast).
  // field: anyone can make it in battle. teach: where the dish comes from, shown on its card.
  const recipes = {
    grillFish:  { name: "Grill a fish", from: ["fish"], out: "fishFillet", field: true, teach: "Heat firms the flesh and ends raw fish's vivid dreams." },
    roastCorn:  { name: "Roast an ear", from: ["earOfCorn"], out: "cornSkewer", field: true, teach: "Roasted on a skewer, as at any street grill." },
    herbTea:    { name: "Herb tea", needs: ["herb", "water"], out: "herbCup", field: true, teach: "Leaves steeped in water; the oldest medicine is a cup of something warm." },
    trailMix:   { name: "Trail mix", needs: ["grain", "fruit"], out: "trailMix", teach: "Dry grain and fruit that travel well." },
    mapoTofu:   { name: "Mapo tofu", needs: ["tofu", "spice", "meat"], out: "mapoTofu", teach: "Sichuan: soft tofu, chili and a little minced beef; the numbing heat wakes you up." },
    hotpot:     { name: "Hot pot", needs: ["greens", "tofu|fungus", "meat|fish"], out: "hotpot", teach: "A shared pot kept simmering at the table, eaten together across East Asia." },
  };
  const tagsOf = (id) => FOOD[id]?.tags || [];
  const prepOf = (id) => FOOD[id]?.prep || null;
  const isFood = (id) => !!FOOD[id];
  // AP to eat `id`; `fallback` is the engine's utility cost for anything that isn't food.
  // AP to use a consumable: food by preparation, anything else by rarity, and `fallback` for items with neither.
  // Culinary Training (Mala, 2026-11-07; spec claude-ingredient-totems-spec 2b): food costs its holder 10 AP less, never under 5. One function prices
  // both the engine's use action and the battle menu, so the label and the charge agree; callers pass the eating unit.
  const trained = (unit) => (unit?.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === rules.culinaryTraining.trait);
  const useCost = (id, fallback, unit = null) => (FOOD[id] ? Math.max(trained(unit) ? rules.culinaryTraining.floor : 0, rules.eatAp[FOOD[id].prep] - (trained(unit) ? rules.culinaryTraining.foodApLess : 0)) : rules.useAp[I?.consumables?.[id]?.rarity] ?? fallback);
  function isCook(unit) {
    if (!unit) return false;
    if (rules.cooks.characters.includes(unit.character)) return true;
    return rules.cooks.concepts.includes(unit.primary) || rules.cooks.concepts.includes(unit.secondary);
  }
  // Which items (indexes into `items`) a recipe would use, or null. Each need takes a different item, first fit wins.
  function match(items, recipeId) {
    const r = recipes[recipeId]; if (!r) return null;
    const used = [];
    for (const need of r.from || r.needs) {
      const ok = r.from ? (id) => id === need : (id) => need.split("|").some((t) => tagsOf(id).includes(t));
      const i = items.findIndex((id, k) => !used.includes(k) && ok(id));
      if (i < 0) return null;
      used.push(i);
    }
    return used;
  }
  // The recipes `items` can make. inBattle without a cook: field recipes only.
  function available(items, { inBattle = false, cook = false } = {}) {
    return Object.keys(recipes).filter((id) => (!inBattle || cook || recipes[id].field) && match(items, id));
  }
  // Cook from a list of ids: { ok, out, used: [indexes], rest: [ids left] } or { ok: false, reason }.
  function cook(items, recipeId, opts = {}) {
    const r = recipes[recipeId];
    if (!r) return { ok: false, reason: "No such recipe." };
    if (opts.inBattle && !opts.cook && !r.field) return { ok: false, reason: `${r.name} is a full recipe: only a cook can make it mid-battle.` };
    const used = match(items, recipeId);
    if (!used) return { ok: false, reason: `Missing ingredients for ${r.name}.` };
    return { ok: true, out: r.out, used, rest: items.filter((_, k) => !used.includes(k)), recipe: r };
  }
  // Between battles: cook from the stash (the ids in the pot), output goes to the stash.
  function cookAtCamp(account, potIds, recipeId) {
    const stash = { ...(account.stash || {}) };
    for (const id of potIds) { if (!(stash[id] > 0)) return { ok: false, account, reason: `No ${I.consumables[id]?.name || id} in your stash.` }; stash[id] -= 1; }
    const r = cook(potIds, recipeId); if (!r.ok) return { ...r, account };
    const back = { ...account.stash };
    for (const k of r.used) { const id = potIds[k]; back[id] -= 1; if (!back[id]) delete back[id]; }
    back[r.out] = (back[r.out] || 0) + 1;
    return { ok: true, account: { ...account, stash: back }, out: r.out, used: r.used.map((k) => potIds[k]) };
  }
  return { FOOD, rules, recipes, tagsOf, prepOf, isFood, useCost, isCook, match, available, cook, cookAtCamp };
});
