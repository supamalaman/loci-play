"use strict";
// Random-battle scenarios: the chooser and the overlay (spec ~/loci-orbit/ready-to-review/claude-random-scenarios-spec/specs/SCENARIOS.md,
// sections 3.1, 3.3 and 5; Mala, 2026-10-30: "the random battles could use more scenarios"). The Random Encounter button asks `choose`
// once per battle; the answer is one of three kinds, and the battle is built from it:
//
//   theme     one roll in five, exactly as before (modes/themed-battles.js; the roll is that module's own `roll`)
//   scenario  half of the other 80%: a premise plus an objective from modes/scenarios-data.js   (40% of all battles)
//   plain     the rest: the random encounter as it always was
//
//   choose(seed, ctx)                → { kind: "theme"|"scenario"|"plain", id, tier? }   (ctx: wins, recent, lastArena)
//   prepare(base, seed, ctx)         → base with the map no-repeat applied (D9: the designed map used last battle is skipped once)
//   apply(base, id, seed, ctx)       → E.create options: the base with the scenario laid over it
//   midDue(theme, state)             → true when the scenario's one mid-fight beat should play (the UI shows it once)
//   tagOf(state), arenaOf(state)     → what account.history records about the battle just fought (memory for the cooldown)
//   tierOf(wins)                     → 1, 2 (from 3 wins) or 3 (from 8 wins)                    (PROVISIONAL, spec 3.3)
// Pure functions over the options and the terrain modules passed in `ctx` ({ G: mapgen, V: vegetation, Climate, rules,
// characters, mainCharacter }); no engine state, and engine.js is not touched: the scenario rides in `opts.rules.scenario`
// (engine.js merges opts.rules over C.rules) and the choice is recorded in the options as `scenarioBattle` (the key
// `scenario` already holds the random encounter's own roll). Every draw is `hash(seed, tag)` on a tag of its own, so the
// engine's streams, the theme roll and the foes, maps and weather of every unchanged seed stay exactly as they were.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./scenarios-data.js"), require("./themed-battles.js"));
  else root.ConceptCombatScenarios = factory(root.ConceptCombatScenariosData, root.ConceptCombatThemedBattles || null);
})(typeof self !== "undefined" ? self : this, function (DATA, THB) {
  const SCENARIOS = DATA.SCENARIOS;
  const SHARE = 0.5;                       // of the non-theme rolls (PROVISIONAL, D1: 40% of all battles are scenarios)
  const TIER_WINS = [3, 8];                // wins for tier 2 and tier 3 (PROVISIONAL, D4)
  // Cooldown (PROVISIONAL): a scenario seen in the last `blocked` battles weighs 0, in battles up to `eased` back weighs 0.4. `blocked` is 4 at
  // most and is scaled to the pool, min(4, pool - 1) (AP-01, Mala approved 40%): with two scenarios it is 1, so the pool never empties and the
  // scenario share stays at SHARE of the non-theme rolls; a one-scenario pool has no cooldown.
  const COOLDOWN = { blocked: 4, eased: 10, easedWeight: 0.4 };
  const MAX_RECENT = 10;
  const LF_BY_COUNT = { 1: 100, 2: 55, 3: 38, 4: 30 };            // engine.js randomEncounterOptions maxLF by foe count (a test pins this copy)
  const SKIP_ARENAS = (a) => a.interior || a.setPiece;            // the ship and Heart Court are reached by mission, never rolled

  // Same hash as modes/themed-battles.js (a test pins that the theme roll through it matches), on tags of our own.
  function hash(seed, tag) {
    let h = 2166136261 ^ (seed >>> 0);
    for (const c of String(tag)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const tierOf = (wins) => { const w = Number(wins) || 0; return w >= TIER_WINS[1] ? 3 : w >= TIER_WINS[0] ? 2 : 1; };

  // 1 = the scenario has not been seen lately; 0 = seen in the last `blocked` battles; 0.4 = seen up to 10 battles ago.
  function coolFactor(id, recent, blocked = COOLDOWN.blocked) {
    const list = (recent || []).slice(-MAX_RECENT); let f = 1;
    list.forEach((tag, i) => { if (tag !== id) return; const age = list.length - i; f = Math.min(f, age <= blocked ? 0 : age <= COOLDOWN.eased ? COOLDOWN.easedWeight : 1); });
    return f;
  }
  function candidates(ctx = {}) {
    const tier = tierOf(ctx.wins), open = Object.values(SCENARIOS).filter((S) => !S.chainOnly && S.minTier <= tier), blocked = Math.min(COOLDOWN.blocked, open.length - 1);
    return open.map((S) => ({ id: S.id, w: S.weight * coolFactor(S.id, ctx.recent, blocked) })).filter((c) => c.w > 0);
  }

  function choose(seed, ctx = {}) {
    const themed = THB ? THB.roll(seed) : null;   // the existing roll, untouched (GUARD test)
    if (themed) return { kind: "theme", id: themed };
    if (hash(seed, "scenario:roll") >= SHARE) return { kind: "plain", id: null };
    const pool = candidates(ctx), total = pool.reduce((n, c) => n + c.w, 0);
    if (!pool.length) return { kind: "plain", id: null };   // no scenario is open at this tier
    let r = hash(seed, "scenario:pick") * total;
    for (const c of pool) { if (r < c.w) return { kind: "scenario", id: c.id, tier: tierOf(ctx.wins) }; r -= c.w; }
    return { kind: "scenario", id: pool[pool.length - 1].id, tier: tierOf(ctx.wins) };
  }

  // ── placing units on a map ──
  const K = (x, y) => x + "," + y;
  function walkable(arena, ctx, x, y) {
    const map = arena.map || [], row = map[y]; if (!row || x < 0 || x >= row.length) return false;
    const ch = row[x], tile = ctx.G?.terrain?.[ch];
    return ch !== "#" && ch !== "~" && !tile?.blocksMove && !(arena.objects || []).some((o) => o.x === x && o.y === y && o.blocksMove);
  }
  // Open ground for the foes: their spawn, else the right-hand columns (the order modes/themed-battles.js uses).
  function foeSpot(arena, ctx, taken, preferred) {
    if (preferred && walkable(arena, ctx, preferred[0], preferred[1]) && !taken.has(K(preferred[0], preferred[1]))) return preferred;
    const map = arena.map || [], h = map.length, w = (map[0] || "").length;
    for (let col = w - 1; col >= 0; col--) for (const y of [3, 1, 5, 2, 4, 0, 6].filter((r) => r < h)) if (walkable(arena, ctx, col, y) && !taken.has(K(col, y))) return [col, y];
    return preferred || [Math.max(0, w - 1), 0];
  }
  // Same rule as engine.js eventParticipantsFor: the first free walkable edge tile, top row first.
  function edgeSpot(arena, ctx, taken) {
    const map = arena.map || [], h = map.length, w = (map[0] || "").length, found = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && !taken.has(K(x, y)) && walkable(arena, ctx, x, y)) found.push([x, y]);
    found.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    return found[0] || [Math.min(1, w - 1), Math.min(1, h - 1)];
  }
  // Put every participant on the arena the way engine.js randomEncounterOptions does: player on the first player spawn,
  // the foes on the enemy spawns, the ally beside the player (or the second spawn), event arrivals on edge tiles.
  // foesOnly (the map is unchanged): the others keep their tiles and the foes are placed on what is left, so no foe lands on the ally or an arrival.
  function place(parts, arena, ctx, foesOnly = false) {
    const ps = arena.spawns?.player || [], es = arena.spawns?.enemy || [], out = parts.map((p) => ({ ...p }));
    const taken = new Set(foesOnly ? out.filter((p) => !/^random-foe-/.test(p.id) && p.at).map((p) => K(...p.at)) : []);
    if (foesOnly) { out.filter((p) => /^random-foe-/.test(p.id)).forEach((p, i) => { p.at = foeSpot(arena, ctx, taken, es[i]); taken.add(K(...p.at)); }); return out; }
    const player = out.find((p) => p.id === "player");
    if (player) { if (ps.length) player.at = ps[0]; taken.add(K(...player.at)); }
    out.filter((p) => /^random-foe-/.test(p.id)).forEach((p, i) => { p.at = foeSpot(arena, ctx, taken, es[i]); taken.add(K(...p.at)); });
    const ally = out.find((p) => p.id === "random-ally-1");
    if (ally && player) {
      const [px, py] = player.at;
      const beside = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => [px + dx, py + dy]).find(([x, y]) => walkable(arena, ctx, x, y) && !taken.has(K(x, y))) || [px, Math.max(0, py - 1)];
      ally.at = ps[1] || beside; taken.add(K(...ally.at));
    }
    for (const p of out) if (p.eventActor) { p.at = edgeSpot(arena, ctx, taken); taken.add(K(...p.at)); }
    return out;
  }
  const arenaName = (arena, id, ctx) => id ? (ctx.G?.arenas?.[id]?.name || id) : `${String(arena?.name || arena?.archetype || "Open").split(" · ")[0]} (generated)`;

  // A new map under an already-rolled battle: designed id, or "random" for a generated map (the engine's own seeds for each).
  function reArena(base, choice, seed, ctx) {
    let arena = choice === "random" ? ctx.G.generate({ seed: (seed + 0x9e3779b9) >>> 0 }) : ctx.G.designed(choice);
    if (ctx.V) arena = ctx.V.populate(arena, { seed: (seed ^ 0xa5a5a5a5) >>> 0 });
    const was = base.scenario?.terrain, now = arenaName(arena, choice === "random" ? null : choice, ctx);
    return { ...base, arenaData: arena, participants: place(base.participants, arena, ctx),
      ...(base.scenario ? { scenario: { ...base.scenario, terrain: now } } : {}),
      ...(was && base.title ? { title: base.title.split(was).join(now) } : {}) };
  }

  const designedIds = (G) => Object.keys(G?.arenas || {}).filter((id) => id !== "warfareField" && !SKIP_ARENAS(G.arenas[id]));
  // D9, map no-repeat: the designed arena fought last battle weighs 0 in the next arena draw (a generated map is never "the same").
  function prepare(base, seed, ctx = {}) {
    if ((base?.participants || []).some((p) => p.boss === "tallyman")) return base;   // his seed is left exactly as the engine rolled it: no new map, no re-placed spawns
    if (!base || !ctx.lastArena || !ctx.G || base.arenaData?.id !== ctx.lastArena || !base.arenaData?.id) return base;
    const options = ["random", "random", "random", ...designedIds(ctx.G).filter((id) => id !== ctx.lastArena)];   // the engine's draw: generated x3, each designed map x1
    return reArena(base, options[Math.floor(hash(seed, "map:norepeat") * options.length)], seed, ctx);
  }

  // The foes: one crew drawn (among the crews with enough fighters for the count), then its classes in a seeded order,
  // skipping anyone on the player's side or in a feud with it.
  function pickFoes(S, base, seed, tier, ctx) {
    const chars = ctx.characters || {}, F = S.foes;
    const mine = (base.participants || []).filter((p) => p.side === "player").map((p) => p.character);
    const feuds = ctx.rules?.factions?.feuds || [];
    const feud = (a, b) => feuds.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    const poolOf = (crew) => Object.entries(chars).filter(([id, ch]) => ch.subfaction === crew && id !== "warden" && id !== ctx.mainCharacter && !(F.exclude || []).includes(id)
      && !ch.permanentAlly && !ch.randomEventOnly && Array.isArray(ch.configs) && !mine.includes(id)
      && !mine.some((m) => feud(ch.subfaction, chars[m]?.subfaction))).map(([id]) => id)
      .sort((a, b) => hash(seed, "scenario:foe:" + a) - hash(seed, "scenario:foe:" + b) || (a < b ? -1 : 1));
    const [lo, hi] = F.count;
    let n = lo + Math.floor(hash(seed, "scenario:count") * (hi - lo + 1));
    if (tier <= 1) n = Math.min(n, 2); else if (tier >= 3) n = Math.max(n, 3);   // spec 3.3: tier 1 at most 2 foes, tier 3 at least 3
    n = Math.min(n, 4);
    const pools = F.crews.map((crew) => [crew, poolOf(crew)]), roomy = pools.filter(([, p]) => p.length >= n);
    const from = roomy.length ? roomy : [pools.reduce((a, b) => (b[1].length > a[1].length ? b : a))];
    const [crew, pool] = from[Math.floor(hash(seed, "scenario:crew") * from.length)];
    return { crew, ids: pool.slice(0, Math.max(1, Math.min(n, pool.length))) };
  }

  function apply(base, id, seed, ctx = {}) {
    const S = SCENARIOS[id]; if (!S || !base) return base;
    if ((base.participants || []).some((p) => p.boss === "tallyman")) return base;   // the Tallyman walks the roads on his own roll (engine.js:161, Mala 2026-10-19): a seed that rolled him stays a plain battle
    const tier = ctx.tier || tierOf(ctx.wins);
    const { ids } = pickFoes(S, base, seed, tier, ctx), n = ids.length, maxLF = LF_BY_COUNT[n];
    const foes = ids.map((character, i) => ({ id: `random-foe-${i + 1}`, character, side: "enemy", at: null, maxLF }));
    const others = (base.participants || []).filter((p) => !/^random-foe-/.test(p.id));
    let out = { ...base, participants: [others[0], ...foes, ...others.slice(1)] };   // the player first, the foes, then the ally and event arrivals (the engine's order)
    if (Array.isArray(S.arenas) && ctx.G) {
      const fresh = S.arenas.filter((a) => a !== ctx.lastArena), list = fresh.length ? fresh : S.arenas;   // D9: not the map fought last battle
      out = reArena(out, list[Math.floor(hash(seed, "scenario:arena") * list.length)], seed, ctx);
    }
    else { const placed = place(out.participants, out.arenaData, ctx, true); out = { ...out, participants: out.participants.map((p, i) => (/^random-foe-/.test(p.id) ? placed[i] : p)) }; }   // same map: only the foes move
    if (S.phase) out.startPhase = S.phase;
    if (S.weather) out.randomEventSchedule = (out.randomEventSchedule || []).filter((e) => e.type !== "weather");   // a rolled weather event would re-roll the forced sky at round 1
    if (S.weather && ctx.Climate) out.weatherState = { ...ctx.Climate.rollWeather(out.arenaData, { seed: out.seed ?? seed, archetype: out.arenaData?.archetype }), id: S.weather };
    const spec = { id: S.id, name: S.name, tier, objective: { ...S.objective } };
    const rules = { ...(out.rules || {}), scenario: spec };
    if (S.houses === "always" && ctx.rules?.houses) rules.houses = { ...ctx.rules.houses, chance: { default: 1 } };
    const sc = out.scenario, terrain = sc?.terrain || arenaName(out.arenaData, out.arenaData?.id, ctx);
    const title = `Random scenario: ${S.name} · ${terrain} · ${n} opponent${n === 1 ? "" : "s"}${sc?.ally ? ` · with ${ctx.characters?.[sc.ally]?.name || sc.ally}` : ""} · ${sc?.theyOpen ? "they move first" : "you move first"}`;
    const done = { ...out, title, mode: "classic", scenarioBattle: S.id, rules,
      theme: { id: `scenario-${S.id}`, title: S.name, text: S.text.open, mid: S.text.mid.text, result: { ...S.text.result } } };
    return done;
  }

  function midDue(theme, state) {
    const S = theme && SCENARIOS[String(theme.id || "").replace(/^scenario-/, "")]; if (!S || !state || state.outcome) return false;
    const W = S.text.mid.when;
    if (W.round) return (state.round || 0) >= W.round;
    if (W.houseOwned) return (state.arena?.objects || []).some((o) => o.type === "house" && o.house && o.house.side);
    if (W.firstFall) return Object.values(state.actors || {}).some((u) => /^random-foe-/.test(u.id) && u.defeated);
    return false;
  }

  // What the battle just fought was, for account.history: "plain", "theme:<id>", a scenario id; null outside the random button.
  function tagOf(state) {
    if (!state) return null;
    if (state.rules?.scenario?.id) return state.rules.scenario.id;
    if (state.encounter !== "randomEncounter") return null;
    return state.themedBattle ? `theme:${state.themedBattle}` : "plain";
  }
  // The cooldown's memory: only battles the Random Encounter button made (history entries flagged `random`), newest last; a campaign or test
  // battle between two random ones does not reset it. `scenario` holds a scenario id, "theme:<id>" or "plain".
  const recentTags = (history) => (history || []).filter((h) => h && h.random).slice(-MAX_RECENT).map((h) => h.scenario || "plain");
  const isRandomBattle = (state) => tagOf(state) !== null;
  const arenaOf = (state) => state?.arena?.id || (state?.arena?.generated ? "generated" : null);

  return { SHARE, TIER_WINS, COOLDOWN, SCENARIOS, hash, tierOf, coolFactor, candidates, choose, prepare, apply, midDue, tagOf, arenaOf, recentTags, isRandomBattle };
});
