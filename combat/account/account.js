"use strict";
// Persistent character account (Mala, 2026-10-07): every battle gives XP; summons unlock as the
// character levels up. This is the battle game's progression. In the future exploratory game,
// summons unlock narratively instead and this account carries over.
//
// Builds on the engine's existing progression (content.js `progression`: 100 XP per level, 120 for a
// victory) with 10 XP per enemy defeated (lowered from the engine's 40 on 2026-10-08), plus learning XP.
//
//   createAccount({ name, unlockOrder: "benefit" | "random", seed })
//   awardBattle(account, result)  → { account, xp, levelsGained, unlocked: [summon ids], lines: [...] }
//     result = { winner: "player"|"enemy"|"none", mode, enemiesDefeated, monstersDefeated, correctAnswers, round }
//   unlockedSummons(account)      → ids available in battle
//   Levels value (W3.6): 1 perk point per level; spendPerk(account, line) spends one on the capped menu;
//     stripLevels(account, n, why) takes levels back (unspent points first, then LIFO grants, floor 1);
//     perkMods(account) → { maxLFAdd, maxAPAdd, maxPFAdd } for battle setup; titlesOf(account) lists earned titles.
//   serialize(account) / deserialize(json)   (versioned; storage is the host's job: native file via the Swift bridge)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatAccount = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const VERSION = 1;

  const rules = {
    xpPerLevel: 100, victoryXp: 120,
    xpPerDefeat: 10,                                        // Mala 2026-10-08: lowered from 40 so the grind is a little longer (engine content.js to follow)
    xpPerCorrectAnswer: 10,                                 // summon questions + transfer prompts: learning pays
    xpPerMonster: 15,
    lossShare: 0.25, minLossXp: 10,                         // losing still teaches something
    // Summon unlock levels: the first summon is there from level 1, then they spread out.
    unlockLevels: [1, 2, 3, 5, 7, 9, 11, 13, 16, 20, 22],   // + Goethe capstone at 22 (Muse Berry BD hot-build, 2026-10-29)
    neonWardenLevel: 200,   // Mala 2026-10-23: purple-neon Warden look (mirrors content.js progression; the engine draws it)
    // Levels value (W3.6): one perk point per level, spent on this capped menu. Contract slots and face-down
    // budget stay out until their systems land (no phantom lines); the tuner sets caps.
    perkMenu: {
      vitality: { name: "Vitality", per: 5, stat: "maxLF", cap: 10, text: "+5 max LF per point." },
      vigor:    { name: "Vigor",    per: 10, stat: "maxAP", cap: 5, text: "+10 max AP per point." },
      focus:    { name: "Focus",    per: 2, stat: "maxPF", cap: 5, text: "+2 max ΦF per point." },
      soulChoir: { name: "Soul Choir", cap: 1, cost: 50, text: "Hold your strongest soul of every kind at once. Without it, only your single strongest soul speaks." },   // J5 rework (D55); priced 50 (Mala, 2026-10-31: "Soul Choir should be 50 perks. It is one of the most powerful things in the game.")
      quickStudy: { name: "Quick Study", per: 1, cap: 5, text: "+1 learning XP per right answer, per point." },
      widenedPalace: { name: "Widened Palace", cap: 1, cost: 20, text: "Call one additional palace summon while you stand in a Dream Space." },   // costs 20 (Mala, 2026-10-31: "20 is fine for widened")
      musedUpon: { name: "Mused Upon", per: 1, cap: 3, text: "+1 Inspiration each level, per point." },
      groundskeeper: { name: "Groundskeeper", cap: 3, text: "Gain 1 affinity chit on purchase, per point. Spent chits stay spent." },
      goodLoser: { name: "Good Loser", per: 0.05, cap: 4, text: "Keep +5% of combat XP on losses, per point." },
      paragonsSeat: { name: "Paragon's Seat", cap: 1, requiresLevel: 20, choice: "summon", text: "Name any summon in your order, no matter its level." },   // the lock line prints "Unlocks at 20."; the text no longer repeats it (AP-01)
    },
    titles: [{ level: 5, name: "Blooded" }, { level: 10, name: "Veteran" }, { level: 20, name: "Paragon" }, { level: 40, name: "Mythic" }],
  };

  // "Benefit" order: most forgiving and broadly useful first; situational next; double-edged last.
  const benefitOrder = [
    { id: "mitsuko",            why: "Heals and protects; forgiving while you learn." },
    { id: "perimeter_guardian", why: "Answers whatever hit you; pure defence." },
    { id: "napoleon",           why: "Follows your lead: focus fire on your target." },
    { id: "the_king",           why: "Strong damage reduction, at the cost of his own movement." },
    { id: "genghis_khan",       why: "Mobility for the whole side; rewards open maps." },
    { id: "zherm",              why: "Area damage plus healing, if you position allies in the burst." },
    { id: "kobe",               why: "Big single-target damage, but locks him in." },
    { id: "aristotle",          why: "Situational: strips walls, wards, parries and delayed strikes." },
    { id: "little_king",        why: "Control that enemies can resist by guarding." },
    { id: "inner_child",        why: "Changes the rules for everyone, enemies included: an expert's tool." },
    { id: "goethe",             why: "The complete striving: roots, a nova, and three ascending forms." },   // Goethe hot-build (Muse Berry BD, 2026-10-29): capstone unlock, existing levels untouched
  ];

  function hash(str) {
    let h = 2166136261;
    for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function createAccount({ name = "Warden", unlockOrder = "benefit", seed = 0, created = null } = {}) {
    let order = benefitOrder.map((b) => b.id);
    if (unlockOrder === "random") order = [...order].sort((a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`));
const account = { version: VERSION, name, created, xp: 0, level: 1, unlockOrder, order, unlocked: [], battles: 0, wins: 0, history: [], foughtBeside: [], forms: [], perks: {}, perkPoints: 0, perkStack: [], titles: [], perkLog: [], discoveries: 0, beadSwallows: {}, stakeEscrow: null, beastSummons: [], ownedNodes: [], affinityChits: 0, namedMerges: {}, mergeLedger: [], tutorCycle: { cycle: -1, drills: 0, paid: 0 }, fame: 0, buskCycle: { cycle: -1, busked: 0 }, marks: [], nodeStyles: {}, rewriteLog: [], schoolKeys: [], deaths: [], graduations: [], teachRights: [], declines: {}, gaps: [], rematch: {}, stillSeals: 0, sealed: null, stars: [], heirloom: null, gatelessCount: 0, doses: [], burn: 0, dopedBouts: [], headlineOwned: false, inspiration: 0, sagas: { active: null, past: [] } , tolls: [], debts: [], parts: { common: 0, uncommon: 0, rare: 0 }, vessels: { shard: 0, bead: 0, orb: 0 }, pens: [], market: null };   // W6.1: Workshop wallet + tree   // vessel economy: kiln/stall ledgers (market normalizes on read)
    account.stakesLedger = []; account.stakeCooldowns = {}; account.justWon = {};   // W1.5: ante ledger + cooldowns, beside the account core
    account.sageDream = { battles: 0, pvWins: 0 };   // W5.3: the Sage's dream ladder persists across demonstrations
    return { ...account, unlocked: unlocksUpTo(account, 1) };
  }

  const levelFor = (xp) => 1 + Math.floor(xp / rules.xpPerLevel);
  function unlocksUpTo(account, level) {
    const base = account.order.filter((_, i) => rules.unlockLevels[i] <= level);
    const seat = account.seatPick && account.order.includes(account.seatPick) && !base.includes(account.seatPick) ? [account.seatPick] : [];
    return [...base, ...seat];
  }
  function nextUnlock(account) {
    const i = account.order.findIndex((id) => !account.unlocked.includes(id));
    return i < 0 ? null : { id: account.order[i], level: rules.unlockLevels[i] };
  }

  // Win: everything. Loss or draw: a share of the combat XP, but correct answers always pay in full
  // (learning shouldn't be punished for losing), with a small floor.
  function battleXp(result, account = null) {
    const p = account?.perks || {};
    const share = rules.lossShare + rules.perkMenu.goodLoser.per * (p.goodLoser || 0);
    const perAnswer = rules.xpPerCorrectAnswer + rules.perkMenu.quickStudy.per * (p.quickStudy || 0);
    const combat = (result.winner === "player" ? rules.victoryXp : 0) + (result.enemiesDefeated || 0) * rules.xpPerDefeat
      + (result.monstersDefeated || 0) * rules.xpPerMonster;
    const learning = (result.correctAnswers || 0) * perAnswer + (result.pvXp || 0);   // W4.4: kept vows pay XP like answered questions — full value, never loss-shared
    if (result.winner === "player") return combat + learning;
    return Math.max(rules.minLossXp, Math.round(combat * share) + learning);
  }

  // Levels value (W3.6): titles read off the crossing, one perk point per level gained.
  function titlesBetween(account, before, level) {
    const have = new Set((account.titles || []).map((t) => t.name));
    return rules.titles.filter((t) => t.level > before && t.level <= level && !have.has(t.name));
  }
  // opts.xpMul: passive XP bonus from equipment (loot.js passes it in).
  function awardBattle(account, result, opts = {}) {
    const xp = Math.round(battleXp(result, account) * (opts.xpMul ?? 1));
    const before = account.level, totalXp = account.xp + xp, level = levelFor(totalXp);
    const unlockedNow = unlocksUpTo(account, level).filter((id) => !account.unlocked.includes(id));
    const newTitles = titlesBetween(account, before, level), gained = level - before;
    const muse = Math.max(0, gained) * rules.perkMenu.musedUpon.per * (account.perks?.musedUpon || 0);
    const tick = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, v - 1]).filter(([, v]) => v > 0));   // W1.5: every finished battle cools stakes down
    const next = {
      ...account, xp: totalXp, level, unlocked: [...account.unlocked, ...unlockedNow],
      stakeCooldowns: tick(account.stakeCooldowns), justWon: tick(account.justWon),
      perkPoints: (account.perkPoints || 0) + Math.max(0, gained), titles: [...(account.titles || []), ...newTitles],
      inspiration: (account.inspiration || 0) + muse,
      battles: account.battles + 1, wins: account.wins + (result.winner === "player" ? 1 : 0),
      history: [...account.history, { mode: result.mode || null, winner: result.winner, xp, round: result.round ?? null, scenario: result.scenario ?? null, arena: result.arena ?? null, ...(result.random ? { random: true } : {}) }].slice(-50),
      foughtBeside: [...new Set([...(account.foughtBeside || []), ...(result.foughtBeside || [])])],
    };
    const lines = [`+${xp} XP`];
    if (level > before) lines.push(`Level ${level}!`);
    if (gained > 0) lines.push(`+${gained} perk point${gained === 1 ? "" : "s"}`);
    if (muse > 0) lines.push(`+${muse} Inspiration`);
    for (const t of newTitles) lines.push(`Title earned: ${t.name}.`);
    if (before < rules.neonWardenLevel && level >= rules.neonWardenLevel) lines.push(`New look unlocked: Purple Neon Warden.`);
    for (const id of unlockedNow) lines.push(`New summon in your palace: ${id}`);
    const n = nextUnlock(next);
    if (n) lines.push(`Next summon at level ${n.level}`);
    return { account: next, xp, levelsGained: gained, unlocked: unlockedNow, lines };
  }

  function awardLearning(account, correctAnswers = 0) {
    const xp = Math.max(0, Math.floor(correctAnswers)) * (rules.xpPerCorrectAnswer + rules.perkMenu.quickStudy.per * (account.perks?.quickStudy || 0));
    if (!xp) return { account, xp: 0, levelsGained: 0, unlocked: [], lines: [] };
    const before = account.level, totalXp = account.xp + xp, level = levelFor(totalXp);
    const unlocked = unlocksUpTo(account, level).filter((id) => !account.unlocked.includes(id));
    const newTitles = titlesBetween(account, before, level), gained = level - before;
    const muse = Math.max(0, gained) * rules.perkMenu.musedUpon.per * (account.perks?.musedUpon || 0);
    const next = { ...account, xp: totalXp, level, unlocked: [...account.unlocked, ...unlocked],
      perkPoints: (account.perkPoints || 0) + Math.max(0, gained), titles: [...(account.titles || []), ...newTitles],
      inspiration: (account.inspiration || 0) + muse };
    return { account: next, xp, levelsGained: gained, unlocked, lines: [`+${xp} learning XP`, ...(level > before ? [`Level ${level}!`] : []), ...(gained > 0 ? [`+${gained} perk point${gained === 1 ? "" : "s"}`] : []), ...(muse > 0 ? [`+${muse} Inspiration`] : []), ...newTitles.map((t) => `Title earned: ${t.name}.`), ...(before < rules.neonWardenLevel && level >= rules.neonWardenLevel ? [`New look unlocked: Purple Neon Warden.`] : []), ...unlocked.map((id) => `New summon in your palace: ${id}`)] };
  }

  // ── Levels value: spend, strip, read (W3.6) ──
  // One perk point per level; spends stack so loss strips LIFO. Titles are history: earned titles stay
  // even when levels fall (rank you can cite). Lost levels re-earn by XP only — no buyback, no XP debt.
  function spendPerk(account, line, when = null, choice = null) {
    const menu = rules.perkMenu[line];
    if (!menu) return { error: "No such perk line." };
    if (menu.requiresLevel && (account.level || 1) < menu.requiresLevel) return { error: `${menu.name} unlocks at level ${menu.requiresLevel}.` };
    const cost = menu.cost || 1;   // dear lines (Widened 20, Soul Choir 50) price in points, not ranks
    if ((account.perkPoints || 0) < cost) return { error: cost > 1 ? `${menu.name} costs ${cost} perk points.` : "No perk points to spend." };
    if ((account.perks?.[line] || 0) >= menu.cap) return { error: `${menu.name} is capped.` };
    if (line === "paragonsSeat") {
      if (!choice || !account.order.includes(choice)) return { error: "Name a summon in your order." };
      if (unlocksUpTo(account, account.level || 1).includes(choice)) return { error: "That summon is already in your palace." };
    }
    const perks = { ...(account.perks || {}), [line]: (account.perks?.[line] || 0) + 1 };
    const entry = { t: when || new Date().toISOString(), kind: "spend", line, ...(choice ? { choice } : {}) };
    const next = { ...account, perks, perkPoints: account.perkPoints - cost, perkStack: [...(account.perkStack || []), line], perkLog: [...(account.perkLog || []), entry] };
    if (line === "groundskeeper") next.affinityChits = (next.affinityChits || 0) + 1;   // granted on buy; spent chits stay spent through strips
    if (line === "paragonsSeat") next.seatPick = choice;
    next.unlocked = unlocksUpTo(next, next.level || 1);   // the seat grant lands immediately (a no-op for old lines)
    return { account: next };
  }
  function stripLevels(account, n = 1, why = null, when = null) {
    const levels = Math.min(Math.max(0, Math.floor(n) || 0), Math.max(0, (account.level || 1) - 1));
    if (!levels) return { account, stripped: [] };
    let xp = account.xp, points = account.perkPoints || 0, seatPick = account.seatPick;
    const perks = { ...(account.perks || {}) }, stack = [...(account.perkStack || [])], stripped = [];
    for (let i = 0; i < levels; i++) {
      xp = Math.max(0, xp - rules.xpPerLevel);
      if (points > 0) { points--; stripped.push({ kind: "point" }); }
      else if (stack.length) { const line = stack.pop(); perks[line] = Math.max(0, (perks[line] || 0) - 1); stripped.push({ kind: "perk", line });
        if (line === "paragonsSeat" && !perks[line]) seatPick = undefined; }   // AP-01: "perk count 0, pick set" is impossible — the name goes with the last rank
      else stripped.push({ kind: "level" });
    }
    const level = levelFor(xp);
    const entry = { t: when || new Date().toISOString(), kind: "strip", levels, why: why || null, took: stripped };
    const next = { ...account, xp, level, perks, perkPoints: points, perkStack: stack, seatPick,
      unlocked: unlocksUpTo({ ...account, perks, seatPick }, level), perkLog: [...(account.perkLog || []), entry] };
    return { account: next, stripped };
  }
  function perkMods(account) {
    const p = account?.perks || {};
    return { maxLFAdd: rules.perkMenu.vitality.per * (p.vitality || 0),   // Red Ink's burn is paid once, as an LF hit at the next battle's start (ui.js), not here too
      maxAPAdd: rules.perkMenu.vigor.per * (p.vigor || 0), maxPFAdd: rules.perkMenu.focus.per * (p.focus || 0),
      widenedPalace: p.widenedPalace || 0 };   // +1 palace summon slot while the Warden stands in a Dream Space (engine.js summonProfile)
  }
  const titlesOf = (account) => (account?.titles || []).map((t) => t.name);

  // ── Emissary memory (2026-10-14; docs/emissary.md) ──
  // The Emissary learns which borrowed kits beat this account. Per class id: { met, won } — battles it wore that kit
  // against you, and how many of those you lost. Like the victory ledger, only a real battle screen writes it.
  function emissaryMet(state) {
    if (!state?.outcome) return [];
    return Object.values(state.actors || {}).filter((a) => a.boss === "emissary" && a.embodied?.classId)
      .map((a) => ({ classId: a.embodied.classId, won: state.outcome.winner === a.side }));
  }
  function recordEmissary(account, met = []) {
    if (!met.length) return { account, lines: [] };
    const memory = { ...(account.emissary || {}) };
    for (const m of met) { const was = memory[m.classId] || { met: 0, won: 0 }; memory[m.classId] = { met: was.met + 1, won: was.won + (m.won ? 1 : 0) }; }
    return { account: { ...account, emissary: memory }, lines: ["The Emissary will remember this."] };
  }

  // ── Victory ledger (Mala, 2026-10-12; docs/victory-ledger.md) ──
  // Which classes this account has beaten, kept for the Warden's Contains Multitudes. It starts empty: nothing is
  // backfilled from old battles. Only a real victory screen writes to it (ui.js decides what is real and passes the
  // beaten units in); tests, sims, practice and AI-driven battles never do.
  //   entry per class id: { name, count, first, last, config, primary, secondary, evidence: { mode, encounter, round, seed, how } }
  // config/primary/secondary are the kit the class had when LAST beaten ("Echo": Mala's ruling 2026-10-12).
  // Which units of a finished battle count: fighters of a real class on a side the player beat, who fell, were knocked
  // out, or stood down. Summons, companions, monsters, dream and wild things, and anyone who fled, do not.
  function beatenIn(state, characters = {}) {
    if (state?.outcome?.winner !== "player") return [];
    const stoodDown = new Set(state.outcome.surrendered || []);
    const foeSide = (a) => ["enemy", "posthuman"].includes(a.side) || (state.mode === "melee" && a.side !== "player" && a.side !== "civilian");   // melee: every rival crew counts
    return Object.values(state.actors || {}).filter((a) => foeSide(a) && characters[a.character]
      && !a.summon && !a.summonBinding && !a.companion && !a.beast && !a.monster && !a.dream && !a.wild && !a.communed && !a.escaped && !a.notArrived
      && (a.defeated || a.knockedOut || a.persuaded || stoodDown.has(a.id)))
      .map((a) => { const cfg = (characters[a.character].configs || []).find((c) => c.primary === a.primary && c.secondary === a.secondary);
        return { classId: a.character, name: characters[a.character].name || a.name, config: cfg?.id || null, primary: a.primary || null, secondary: a.secondary || null,
          how: a.persuaded || stoodDown.has(a.id) ? "stood down" : a.knockedOut ? "knocked out" : "defeated" }; });
  }
  function recordVictories(account, beaten = [], battle = {}, when = null) {
    const stamp = when || new Date().toISOString(), ledger = { ...(account.victories || {}) }, fresh = [];
    for (const b of beaten) {
      if (!b?.classId) continue;
      const had = ledger[b.classId]; if (!had) fresh.push(b.classId);
      ledger[b.classId] = { name: b.name || had?.name || b.classId, count: (had?.count || 0) + 1, first: had?.first || stamp, last: stamp,
        config: b.config ?? null, primary: b.primary ?? null, secondary: b.secondary ?? null,
        evidence: { mode: battle.mode || null, encounter: battle.encounter || null, round: battle.round ?? null, seed: battle.seed ?? null, how: b.how || "defeated" } };
    }
    const names = [...new Set(beaten.map((b) => b.classId))].filter((id) => fresh.includes(id)).map((id) => ledger[id].name);
    return { account: { ...account, victories: ledger }, fresh, lines: names.length ? [`Victory recorded: ${names.join(", ")}`] : [] };
  }
  const victoriesOf = (account) => Object.entries(account?.victories || {}).map(([classId, v]) => ({ classId, ...v })).sort((a, b) => (a.name < b.name ? -1 : 1));

  // ── Remembered friends (Mala, 2026-10-19) ── a wild beast you tamed in a real battle (the Sasquatch) may come back to
  // help in a later one. account.wildFriends: { kind: { since, count } }. engine/tamer.js rolls the chance each battle.
  const friendsOf = (account) => Object.keys(account?.wildFriends || {}).sort();
  const friendsMadeIn = (state) => (Array.isArray(state?.friendsMade) ? state.friendsMade.slice() : []);
  function addFriends(account, kinds = [], when = null) {
    if (!kinds.length) return { account, fresh: [] };
    const stamp = when || new Date().toISOString(), had = account?.wildFriends || {}, next = { ...had }, fresh = [];
    for (const k of kinds) { if (!had[k]) fresh.push(k); next[k] = { since: had[k]?.since || stamp, count: (had[k]?.count || 0) + 1 }; }
    return { account: { ...account, wildFriends: next }, fresh };
  }

  // ── Orbs kept between battles (docs/brain-chip.md, docs/boss-rush.md) ──
  // A list of orb ids, one entry per orb. A won battle adds what fell; breaking one in a battle spends one entry.
  const orbsOf = (account) => (Array.isArray(account?.orbs) ? account.orbs.slice() : []);
  function addOrbs(account, ids = []) { return ids.length ? { ...account, orbs: [...orbsOf(account), ...ids] } : account; }
  function spendOrb(account, id) { const orbs = orbsOf(account), i = orbs.indexOf(id); if (i < 0) return account; orbs.splice(i, 1); return { ...account, orbs }; }
  // What a finished battle leaves the player: one Brain Chip for each transcended AGI that fell, and only on a win.
  const orbsWonIn = (state) => {
    if (state?.outcome?.winner !== "player") return [];
    const chips = Array(state.brainChips || 0).fill("brainChip");
    const extra = (state.outcome.orbs || []).filter((id) => id !== "brainChip");
    return [...chips, ...extra];
  };

  function unlockedSummons(account) { return account.unlocked.slice(); }
  // ── Permanent form unlocks (Visitors P2, docs/visitors-p2.md) ──
  // Escaping the ship unlocks the Symbiote; every later battle carries one break. Earned, so it
  // persists from the file (orbs precedent); tolerant of older files that predate the field.
  // Secret fights beaten, by encounter id. The button on the front page greys out once the current one is here (Mala, 2026-10-29).
  const secretsOf = (account) => (Array.isArray(account?.secrets) ? account.secrets.slice() : []);
  function addSecret(account, id) { return !id || secretsOf(account).includes(id) ? account : { ...account, secrets: [...secretsOf(account), id] }; }
  const formsOf = (account) => (Array.isArray(account?.forms) ? account.forms.slice() : []);
  function addForms(account, ids = []) { const have = new Set(formsOf(account)); const fresh = ids.filter((id) => !have.has(id)); return fresh.length ? { ...account, forms: [...formsOf(account), ...fresh] } : account; }

  // ── Learned forms (Mala, 2026-10-17; docs/learned-forms.md): beating an Omega threat teaches THAT character its form
  // forever. { characterKey: [formId] }. Tolerant of older files without the field.
  const learnedFormsOf = (account, character) => (account?.learnedForms?.[character] || []).slice();
  function learnForms(account, character, ids = []) {
    const have = new Set(learnedFormsOf(account, character)), fresh = ids.filter((id) => id && !have.has(id));
    return fresh.length ? { ...account, learnedForms: { ...(account.learnedForms || {}), [character]: [...have, ...fresh] } } : account;
  }
  // The forms a finished battle teaches the player's character: one for each Omega threat that fell, on a win.
  function formsTaughtIn(state, teach = {}, orbs = {}) {
    if (state?.outcome?.winner !== "player") return [];
    const out = [];
    for (const u of Object.values(state.actors || {})) if (u.defeated && u.side !== "player") {
      const orb = teach[u.boss] || teach[u.character]; const formId = orb && orbs[orb]?.formId;
      if (formId && !out.includes(formId)) out.push(formId);
    }
    return out;
  }

  // Paladin re-spec (2026-10-31): the old Paladin pair (interposition + strategic_commitment) is now Solfeggio + Strategic Commitment. Any saved loadout, character or
  // victory entry that still names the old pair is re-slotted by this one function (the account's victory ledger, ui.js's saved characters, the campaign loadout use it or its twin).
  const migratePaladinPair = (c) => (c && c.primary === "interposition" && c.secondary === "strategic_commitment" ? { ...c, primary: "solfeggio" } : c);
  function serialize(account) { return JSON.stringify(account); }
  // Goethe RETURN R-1 (Muse Berry BD, 2026-10-29): saves created before a summon
  // shipped keep their order but gain the new ids at the end, so nothing unlocked
  // is ever lost and new summons still arrive (at the last unlock level).
  function reconcileOrder(saved) {
    const keep = new Set(benefitOrder.map((b) => b.id));
    const base = (Array.isArray(saved) ? saved : []).filter((id) => keep.has(id));
    for (const b of benefitOrder) if (!base.includes(b.id)) base.push(b.id);
    return base;
  }
  function deserialize(json) {
    const a = typeof json === "string" ? JSON.parse(json) : json;
    if (!a || a.version !== VERSION) throw new Error(`account version ${a && a.version} is not supported (expected ${VERSION})`);
    const order = reconcileOrder(a.order);
    const d = { ...a, order, level: levelFor(a.xp), unlocked: unlocksUpTo({ order, perks: a.perks || {}, seatPick: a.seatPick }, levelFor(a.xp)), foughtBeside: Array.isArray(a.foughtBeside) ? a.foughtBeside : [], forms: formsOf(a),
      perks: a.perks || {}, perkPoints: a.perkPoints || 0, perkStack: Array.isArray(a.perkStack) ? a.perkStack : [], titles: Array.isArray(a.titles) ? a.titles : [], perkLog: Array.isArray(a.perkLog) ? a.perkLog : [],
stakesLedger: Array.isArray(a.stakesLedger) ? a.stakesLedger : [], stakeCooldowns: a.stakeCooldowns || {}, justWon: a.justWon || {}, discoveries: a.discoveries || 0, beadSwallows: a.beadSwallows && typeof a.beadSwallows === "object" ? a.beadSwallows : {}, stakeEscrow: a.stakeEscrow && Array.isArray(a.stakeEscrow.vessels) ? a.stakeEscrow : null, beastSummons: Array.isArray(a.beastSummons) ? a.beastSummons : [], ownedNodes: Array.isArray(a.ownedNodes) ? a.ownedNodes : [], affinityChits: a.affinityChits || 0, namedMerges: a.namedMerges || {}, mergeLedger: Array.isArray(a.mergeLedger) ? a.mergeLedger : [], tutorCycle: a.tutorCycle || { cycle: -1, drills: 0, paid: 0 }, fame: a.fame || 0, buskCycle: a.buskCycle || { cycle: -1, busked: 0 }, marks: Array.isArray(a.marks) ? a.marks : [], nodeStyles: a.nodeStyles || {}, rewriteLog: Array.isArray(a.rewriteLog) ? a.rewriteLog : [], schoolKeys: Array.isArray(a.schoolKeys) ? a.schoolKeys : [], deaths: Array.isArray(a.deaths) ? a.deaths : [], graduations: Array.isArray(a.graduations) ? a.graduations : [], teachRights: Array.isArray(a.teachRights) ? a.teachRights : [], declines: a.declines || {}, gaps: Array.isArray(a.gaps) ? a.gaps : [], rematch: a.rematch || {}, stillSeals: a.stillSeals || 0, sealed: a.sealed || null, stars: Array.isArray(a.stars) ? a.stars : [], heirloom: a.heirloom ?? null, gatelessCount: a.gatelessCount || 0, doses: Array.isArray(a.doses) ? a.doses : [], burn: a.burn || 0, dopedBouts: Array.isArray(a.dopedBouts) ? a.dopedBouts : [], headlineOwned: !!a.headlineOwned, inspiration: a.inspiration || 0, sagas: a.sagas && Array.isArray(a.sagas.past) ? a.sagas : { active: null, past: [] }, tolls: Array.isArray(a.tolls) ? a.tolls : [], debts: Array.isArray(a.debts) ? a.debts : [], parts: { common: 0, uncommon: 0, rare: 0, ...(a.parts || {}) }, vessels: a.vessels && typeof a.vessels === "object" ? { shard: 0, bead: 0, orb: 0, ...a.vessels } : { shard: 2, bead: 2, orb: 1 }, pens: Array.isArray(a.pens) ? a.pens : [], market: a.market && typeof a.market === "object" ? a.market : null };   // W6.1: old saves start the journey empty
    // vessel economy ruling 1: a save with no vessels key predates the economy and gets one 2/2/1 deposit, once.
    // Paladin re-spec (2026-10-31, PALADIN.md): a saved victory over the Paladin carries the old pair; its kit now lives on Solfeggio + Strategic Commitment,
    // so the Warden's echo of it would lose every new card. Re-slot the saved pair; nothing else in the entry changes.
    { const v = d.victories?.paladin; if (v && migratePaladinPair(v) !== v) d.victories = { ...d.victories, paladin: migratePaladinPair(v) }; }
    d.sageDream = a.sageDream && typeof a.sageDream.battles === "number" ? { battles: a.sageDream.battles, pvWins: a.sageDream.pvWins || 0 } : { battles: 0, pvWins: 0 };   // W5.3: the Sage's dream ladder
    return d;
  }
  // Fold the UI's earlier localStorage profile ({ xp, level, ... }) into a new account.
  function fromLegacyProfile(profile, opts = {}) {
    const a = createAccount(opts);
    const xp = Math.max(0, profile?.xp || 0);
    return { ...a, xp, level: levelFor(xp), unlocked: unlocksUpTo(a, levelFor(xp)) };
  }

  return { migratePaladinPair, friendsOf, friendsMadeIn, addFriends, learnedFormsOf, learnForms, formsTaughtIn, orbsOf, addOrbs, spendOrb, orbsWonIn, secretsOf, addSecret, formsOf, addForms, beatenIn, recordVictories, emissaryMet, recordEmissary, victoriesOf, VERSION, rules, benefitOrder, createAccount, awardBattle, awardLearning, battleXp, unlockedSummons, nextUnlock, unlocksUpTo, serialize, deserialize, fromLegacyProfile, levelFor, spendPerk, stripLevels, perkMods, titlesOf };
});
