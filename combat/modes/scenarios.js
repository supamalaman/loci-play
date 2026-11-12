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
  // Far from the player (Sasquatch Sighting SC14): the walkable tile that maximises Manhattan distance from the player's spawn / tile.
  function farSpot(arena, ctx, taken, participants) {
    const map = arena.map || [], h = map.length, w = (map[0] || "").length;
    const player = (participants || []).find((p) => p.id === "player"), px = player?.at?.[0] ?? arena.spawns?.player?.[0]?.[0] ?? 1, py = player?.at?.[1] ?? arena.spawns?.player?.[0]?.[1] ?? 1;
    let best = null, bestD = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!walkable(arena, ctx, x, y) || taken.has(K(x, y))) continue;
      const d = Math.abs(x - px) + Math.abs(y - py);
      if (d > bestD) { bestD = d; best = [x, y]; }
    }
    return best || foeSpot(arena, ctx, taken, null);
  }
  // Hostages in the middle of the hall (SC12): walkable tiles nearest the map centre, skipping taken ones.
  function middleSpots(arena, ctx, n, taken) {
    const map = arena.map || [], h = map.length, w = (map[0] || "").length, mx = (w - 1) / 2, my = (h - 1) / 2, found = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (walkable(arena, ctx, x, y) && !taken.has(K(x, y))) found.push([x, y, Math.abs(x - mx) + Math.abs(y - my)]);
    found.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
    return found.slice(0, n).map(([x, y]) => [x, y]);
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

  // SC16: place the sluice near the enemy edge on open ground nobody stands on (ground-targeting already hits objects via structures.js).
  function placeScenarioObject(arena, object, participants) {
    if (!arena?.map || !object) return arena;
    const h = arena.map.length, w = (arena.map[0] || "").length, stood = new Set((participants || []).filter((p) => p.at).map((p) => K(...p.at)));
    const free = (x, y) => x >= 0 && y >= 0 && y < h && x < w && arena.map[y][x] !== "#" && arena.map[y][x] !== "~" && !stood.has(K(x, y)) && !(arena.objects || []).some((o) => o.x === x && o.y === y);
    const preferred = (arena.spawns?.enemy || []).map(([x, y]) => [Math.min(w - 1, x + 1), y]).concat([[w - 1, Math.floor(h / 2)], [w - 1, 2], [w - 1, h - 3]]);
    let at = preferred.find(([x, y]) => free(x, y));
    if (!at) { for (let col = w - 1; col >= 0 && !at; col--) for (let y = 0; y < h && !at; y++) if (free(col, y)) at = [col, y]; }
    if (!at) { for (let col = w - 1; col >= 0 && !at; col--) for (let y = 0; y < h && !at; y++) if (y < h && col < w && arena.map[y][col] !== "#" && arena.map[y][col] !== "~") at = [col, y]; }   // last resort: any ground, even occupied, so break cannot win at once on a missing object
    if (!at) return arena;
    const obj = { ...object, x: at[0], y: at[1] };
    return { ...arena, objects: [...(arena.objects || []).filter((o) => o.id !== obj.id), obj] };
  }

  // SC17: guarantee at least min contested pickups before E.create's own placePickups appends more (spec: n+2 with n ≤ 3).
  function ensureSalvagePickups(arena, seed, min, ctx) {
    let Pickups = ctx.Pickups;
    if (!Pickups && typeof require === "function") { try { Pickups = require("../terrain/pickups.js"); } catch { /* browser */ } }
    if (!Pickups && typeof globalThis !== "undefined") Pickups = globalThis.ConceptCombatPickups;
    if (!Pickups?.placePickups || !arena?.map) return arena;
    let A = arena, guard = 0;
    while (((A.pickups || []).length < min) && guard++ < 6) A = Pickups.placePickups(A, { seed: (seed + guard * 0x9e3779b9) >>> 0 });
    return A;
  }

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
    const lead = F.lead && chars[F.lead] && !mine.includes(F.lead) && F.lead !== ctx.mainCharacter ? [F.lead] : [];   // foes.lead: one fixed foe, counted in n (Spilled Pot)
    const poolOf = (crew) => Object.entries(chars).filter(([id, ch]) => ch.subfaction === crew && id !== "warden" && id !== ctx.mainCharacter && !lead.includes(id) && !(F.exclude || []).includes(id)
      && !ch.permanentAlly && !ch.randomEventOnly && Array.isArray(ch.configs) && !mine.includes(id)
      && !mine.some((m) => feud(ch.subfaction, chars[m]?.subfaction))).map(([id]) => id)
      .sort((a, b) => hash(seed, "scenario:foe:" + a) - hash(seed, "scenario:foe:" + b) || (a < b ? -1 : 1));
    const [lo, hi] = F.count;
    let n = lo + Math.floor(hash(seed, "scenario:count") * (hi - lo + 1));
    if (tier <= 1) n = Math.min(n, 2); else if (tier >= 3) n = Math.max(n, 3);   // spec 3.3: tier 1 at most 2 foes, tier 3 at least 3
    n = Math.min(n, 4);
    const need = n - lead.length, pools = F.crews.map((crew) => [crew, poolOf(crew)]), roomy = pools.filter(([, p]) => p.length >= need);
    const from = roomy.length ? roomy : [pools.reduce((a, b) => (b[1].length > a[1].length ? b : a))];
    const [crew, pool] = from[Math.floor(hash(seed, "scenario:crew") * from.length)];
    return { crew, ids: [...lead, ...pool.slice(0, Math.max(lead.length ? 0 : 1, Math.min(need, pool.length)))] };
  }

  // SC05: `groups` crews of `count` fighters each, one side per crew (the melee counts sides). The crews are drawn from every crew with enough
  // eligible fighters (or the listed ones), skipping a pair that feuds (the rule the random roster uses), anyone on the player's side and any crew
  // feuding with it. Ids stay `random-foe-N` so the mid beat, the foe names and the LF table work as for any scenario.
  function pickGroups(S, base, seed, ctx) {
    const chars = ctx.characters || {}, F = S.foes, [lo, hi] = F.count;
    const mine = (base.participants || []).filter((p) => p.side === "player").map((p) => p.character);
    const feuds = ctx.rules?.factions?.feuds || [];
    const feud = (a, b) => feuds.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    const poolOf = (crew) => Object.entries(chars).filter(([id, ch]) => ch.subfaction === crew && id !== "warden" && id !== ctx.mainCharacter && !(F.exclude || []).includes(id)
      && !ch.permanentAlly && !ch.randomEventOnly && Array.isArray(ch.configs) && !mine.includes(id) && !mine.some((m) => feud(crew, chars[m]?.subfaction))).map(([id]) => id)
      .sort((a, b) => hash(seed, "scenario:foe:" + a) - hash(seed, "scenario:foe:" + b) || (a < b ? -1 : 1));
    const n = lo + Math.floor(hash(seed, "scenario:count") * (hi - lo + 1));
    const names = F.crews === "any" ? [...new Set(Object.values(chars).map((c) => c.subfaction).filter(Boolean))].sort() : F.crews;
    const roomy = names.map((crew) => [crew, poolOf(crew)]).filter(([, p]) => p.length >= n)
      .sort((a, b) => hash(seed, "scenario:crew:" + a[0]) - hash(seed, "scenario:crew:" + b[0]) || (a[0] < b[0] ? -1 : 1));
    const chosen = [];
    for (const c of roomy) { if (chosen.length >= F.groups) break; if (!chosen.some(([o]) => feud(o, c[0]))) chosen.push(c); }
    return chosen.map(([crew, pool]) => ({ crew, ids: pool.slice(0, n) }));
  }

  // SC10: the Warfare encounter laid under a random battle: its field, its actors and scaled events (engine warfareEventOptions) and its two wild animals,
  // what ui.js builds for the Warfare button. The rolled ally, foes and events are not used. Without the engine pieces in ctx the battle stays as rolled.
  function warfareBase(base, seed, ctx) {
    const WF = ctx.encounters?.warfare, mons = ctx.W?.data?.monsters;
    if (!WF || !ctx.warfareEventOptions || !ctx.G || !mons) return null;
    const ev = ctx.warfareEventOptions(seed, { foughtBeside: ctx.foughtBeside || [], mainCharacter: ctx.mainCharacter });
    let arena = ctx.G.designed(WF.arena); if (ctx.V) arena = ctx.V.populate(arena, { seed });
    const initialWild = [["feralPig", [7, 3]], ["termites", [7, 5]]].filter(([kind]) => mons[kind]).map(([kind, at], i) => ({ id: `warfare-wild-${i + 1}`, kind, form: mons[kind].form, name: mons[kind].name,
      reason: "the three-faction clash", born: 1, x: at[0], y: at[1], lf: mons[kind].lf, maxLF: mons[kind].lf, status: {} }));
    return { ...base, participants: ev.participants, randomEventSchedule: ev.randomEventSchedule, arenaData: arena, initialWild,
      scenario: { ...(base.scenario || {}), ally: null, theyOpen: false, terrain: arenaName(arena, WF.arena, ctx) } };
  }

  // Authored events (SCENARIOS.md 3.4; slice 2). `force` swaps the rolled event at a checkpoint for an authored one (random-events.js create
  // with force/checkpoints) and drops the arrivals the rolled event had brought; `wild` lays a field wild form on the map at the start.
  // The authored event's arrivals are placed by the engine's own eventParticipantsFor (ctx.eventParticipantsFor), so they stand where a rolled one would.
  const AUTHORABLE = ["visitors", "weather", "terrain", "dream", "monsters", "supervillain"];   // event types whose fill needs nothing but the seed
  function authorEvents(out, S, seed, ctx) {
    let result = out;
    const RE = ctx.RandomEvents;
    if (S.force && RE && ctx.eventParticipantsFor) {
      const schedule = (out.randomEventSchedule || []).map((e) => ({ ...e })), fresh = [];
      let parts = (out.participants || []).slice();
      for (const [cid, spec] of Object.entries(S.force)) {
        if (!AUTHORABLE.includes(spec.type)) continue;   // ally and reinforcements need the roster and the hero (engine.js randomEncounterOptions); an authored one would arrive empty
        // A checkpoint can be missing: a forced sky (S.weather) already dropped every rolled weather event. Then the authored one is added at its place in round order.
        const custom = (S.checkpoints || []).find((c) => c.id === cid);   // an authored round of its own (SC02: rounds 1, 4 and 7)
        const i = schedule.findIndex((e) => e.id === cid), old = i >= 0 ? schedule[i] : custom || RE.checkpoints.find((c) => c.id === cid);
        if (!old) continue;
        const gone = new Set((i >= 0 && old.actorIds) || []);
        parts = parts.filter((p) => !gone.has(p.id));
        const ev = RE.create(seed, { force: { [cid]: spec }, checkpoints: [{ id: old.id, round: old.round, label: old.label }] })[0];
        if (i >= 0) schedule[i] = ev; else schedule.splice(schedule.findIndex((e) => e.round > ev.round) < 0 ? schedule.length : schedule.findIndex((e) => e.round > ev.round), 0, ev);
        fresh.push(ev);
      }
      // One ship per battle: a rolled visitors event at another checkpoint would land a second one, so it is dropped with its arrivals.
      let kept = schedule;
      if (fresh.some((e) => e.type === "visitors")) {
        const dup = schedule.filter((e) => e.type === "visitors" && !e.forced), gone = new Set(dup.flatMap((e) => e.actorIds || []));
        parts = parts.filter((p) => !gone.has(p.id)); kept = schedule.filter((e) => !dup.includes(e));
      }
      parts = [...parts, ...ctx.eventParticipantsFor(fresh, parts, out.arenaData)];
      result = { ...result, randomEventSchedule: kept, participants: parts };
    }
    // Unit-form wild animals (Wolf Season SC06; Photo Safari SC13; Sasquatch Sighting SC14): laid on open ground at the foes' edge (or the far edge when `far`), the way wild/monsters.js spawn makes one (a wild unit is its own side and never holds the battle open).
    // Pond Patrol (Wild Food Web W1) adds `near` and `closeTo` (lay it as close as possible to an animal of that kind laid before it). `near`: "water" lays the animal on open ground beside water, "host" beside a plant its kind feeds on (W.monsters[kind].hosts); the foes' edge (or the far edge) stays the fallback.
    for (const pack of (S.wild || []).filter((w) => w.kind && ctx.W?.data?.monsters?.[w.kind]?.form === "unit")) {
      const def = ctx.W.data.monsters[pack.kind], A = out.arenaData; if (!A?.map) continue;
      const taken = new Set((result.participants || []).filter((p) => p.at).map((p) => K(...p.at)).concat((result.initialWild || []).filter((u) => u.x != null).map((u) => K(u.x, u.y))));
      const beside = (test) => { const found = []; A.map.forEach((row, y) => [...row].forEach((_, x) => { if (walkable(A, ctx, x, y) && !taken.has(K(x, y)) && !(A.objects || []).some((o) => o.x === x && o.y === y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => test(x + dx, y + dy))) found.push([x, y]); })); return found.sort((p, q) => p[1] - q[1] || p[0] - q[0]); };
      const nearTo = pack.near === "water" ? (x, y) => ["w", "~"].includes(A.map[y]?.[x]) : pack.near === "host" ? (x, y) => (A.objects || []).some((o) => o.kind === "plant" && o.x === x && o.y === y && (def.hosts || []).includes(o.type)) : null;
      // Tall Grass (W3) adds near: "cover" (the tile itself is turf or mulch, where the tiger hides) and `gap` (with closeTo: the spot whose distance to that animal is nearest `gap`, not nearest 0).
      const onCover = () => { const found = []; A.map.forEach((row, y) => [...row].forEach((ch, x) => { if ([",", "m"].includes(ch) && walkable(A, ctx, x, y) && !taken.has(K(x, y)) && !(A.objects || []).some((o) => o.x === x && o.y === y)) found.push([x, y]); })); return found.sort((p, q) => p[1] - q[1] || p[0] - q[0]); };
      const units = [];
      for (let i = 0; i < (pack.count || 1); i++) {
        const anchor = pack.closeTo && (result.initialWild || []).find((u) => u.kind === pack.closeTo), d = (q) => Math.abs(Math.abs(q[0] - anchor.x) + Math.abs(q[1] - anchor.y) - (pack.gap || 0));   // closeTo: the spot nearest an animal already laid (at `gap` tiles when given)
        const spots = pack.near === "cover" ? onCover() : nearTo ? beside(nearTo) : [], room = (q) => Math.min(99, ...(result.participants || []).filter((u) => u.at).map((u) => Math.abs(q[0] - u.at[0]) + Math.abs(q[1] - u.at[1])));   // else away from every fighter, so the scene has room to play
        const at = !spots.length ? (pack.far ? farSpot(A, ctx, taken, result.participants) : foeSpot(A, ctx, taken, null)) : anchor ? spots.slice().sort((p, q) => d(p) - d(q))[0] : spots.slice().sort((p, q) => room(q) - room(p))[0]; taken.add(K(...at));
        units.push({ id: `wild-${pack.kind}-0-${i + 1}`, kind: pack.kind, form: def.form, name: def.name, reason: pack.reason || (pack.kind === "sasquatch" ? "waiting in the trees" : "down from the ridge for the same reason you came"), born: 0, x: at[0], y: at[1], lf: def.lf, maxLF: def.lf, status: {}, ...(def.sprite ? { sprite: def.sprite } : {}),
          ...(pack.kind === "moa" ? { nest: at.slice() } : {}), ...(pack.kind === "sasquatch" ? { home: at.slice() } : {}), ...(["sasquatch", "kraken"].includes(pack.kind) ? { traits: (def.traits || []).slice() } : {}) });   // the fields wild/monsters.js spawn() sets
      }
      result = { ...result, initialWild: [...(result.initialWild || []), ...units] };
    }
    // A flash flood front (Hold the Ford, tier 3): a front-form wild thing starting on the highest open ground, the way the wild's own downpour places one (wild/monsters.js).
    if ((S.wild || []).some((w) => w.kind === "flashFlood") && ctx.W?.data?.monsters?.flashFlood && out.arenaData?.map) {
      const def = ctx.W.data.monsters.flashFlood, A = out.arenaData, taken = new Set((result.participants || []).filter((p) => p.at).map((p) => K(...p.at)));
      let best = null;
      A.map.forEach((row, y) => [...row].forEach((ch, x) => { if (!walkable(A, ctx, x, y) || taken.has(K(x, y))) return; const h = Number((A.height || [])[y]?.[x] ?? 0); if (!best || h > best.h || (h === best.h && (x > best.x))) best = { x, y, h }; }));
      if (best) result = { ...result, initialWild: [...(result.initialWild || []), { id: "wild-flashFlood-0-1", kind: "flashFlood", form: def.form, name: def.name, reason: "a downpour gathers on the high ground", born: 0, x: best.x, y: best.y, strength: def.strength }] };
    }
    const fire = (S.wild || []).find((w) => w.kind === "brushfire");
    const fuel = ctx.W?.data?.monsters?.brushfire?.fuel;
    if (fire && fuel && out.arenaData?.map) {
      // The windward edge: the fuel tile the wind blows from (the smallest projection on windTo, the way it blows), on a tile nobody stands on.
      // Today the engine's fire spreads on fuel alone (wild/monsters.js frontier has no wind term), so this only picks where it starts, and the windy
      // midpoint re-rolls the wind; the spec's "spreads downwind" is a premise the engine does not yet keep (NOTE, Decisions).
      const [dx, dy] = out.weatherState?.windTo || [1, 0], found = [], stood = new Set((result.participants || []).filter((p) => p.at).map((p) => K(...p.at)));
      out.arenaData.map.forEach((row, y) => [...row].forEach((ch, x) => { if (fuel[ch] != null && !stood.has(K(x, y))) found.push([x, y, x * dx + y * dy]); }));
      found.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
      if (found.length) {
        const [x, y] = found[0];
        result = { ...result, initialWild: [...(result.initialWild || []), { id: "wild-brushfire-0-1", kind: "brushfire", form: "field", name: ctx.W.data.monsters.brushfire.name, reason: "the season's first spark in dry fuel", born: 0, tiles: { [`${x},${y}`]: 0 } }] };
      }
    }
    return result;
  }

  function apply(base, id, seed, ctx = {}) {
    const S = SCENARIOS[id]; if (!S || !base) return base;
    if ((base.participants || []).some((p) => p.boss === "tallyman")) return base;   // the Tallyman walks the roads on his own roll (engine.js:161, Mala 2026-10-19): a seed that rolled him stays a plain battle
    const tier = ctx.tier || tierOf(ctx.wins);
    // foes: "roll" keeps the foes the engine rolled (SC07, SC09: the premise is the sky or the visitors, not the crew); the tier trim does not apply.
    const isFoe = (p) => /^random-foe-/.test(p.id), rolled = S.foes === "roll";
    const warfare = S.encounter === "warfare";
    if (warfare) { const w = warfareBase(base, seed, ctx); if (!w) return base; base = w; }   // SC10: the encounter's own actors, field and events replace the roll
    const groups = !rolled && S.foes.groups ? pickGroups(S, base, seed, ctx) : null;   // SC05: one crew per side
    if (groups && groups.length < S.foes.groups) return base;   // too few crews that can stand apart: the roll stays as it was
    const fixedList = !rolled && !warfare && !S.foes.groups && Array.isArray(S.foes.fixed) ? S.foes.fixed.filter((id) => typeof id === "string" && id) : [];   // teaching (SC22+): exact characters, no draw; loadouts and tiles ride E.create defaults and spawns
    const fixed = fixedList.length ? fixedList : null;
    const sideOf = (character) => (groups ? groups.find((g) => g.ids.includes(character)).crew : "enemy");
    const ids = warfare ? [] : groups ? groups.flatMap((g) => g.ids) : fixed ? fixed.slice() : rolled ? (base.participants || []).filter(isFoe).slice(0, S.count ? S.count[1] : 4).map((p) => p.character) : pickFoes(S, base, seed, tier, ctx).ids;
    const n = warfare ? (base.participants || []).filter((p) => p.side === "enemy").length : ids.length, maxLF = LF_BY_COUNT[n];
    const foes = warfare ? [] : rolled ? (base.participants || []).filter(isFoe).slice(0, S.count ? S.count[1] : 4).map((f) => ({ ...f, maxLF, ...(S.foes?.aggressive ? { aggressive: true, posture: "aggressive" } : {}) })) : ids.map((character, i) => ({ id: `random-foe-${i + 1}`, character, side: sideOf(character), at: null, maxLF, ...(S.foes?.traits?.[character] ? { traits: S.foes.traits[character].slice() } : {}), ...(S.foes?.aggressive ? { aggressive: true, posture: "aggressive" } : {}) }));   // foes.traits: a scenario grants a class a trait (Spilled Pot); foes.aggressive: Hostage Hall
    const others = warfare ? base.participants : (base.participants || []).filter((p) => !/^random-foe-/.test(p.id));
    let out = warfare ? { ...base } : { ...base, participants: [others[0], ...foes, ...others.slice(1)] };   // the player first, the foes, then the ally and event arrivals (the engine's order)
    if (S.quiet && !warfare) out = { ...out, participants: (out.participants || []).filter((p) => !p.eventActor && p.id !== "random-ally-1"), randomEventSchedule: (out.randomEventSchedule || []).filter((e) => e.type === "weather"), scenario: { ...(out.scenario || {}), ally: null } };   // teaching: a quiet duel — no ally, no event arrivals; weather stands
    if (groups) {   // a melee: events that bring in other opponents are dropped with their arrivals (the Powers That Be rule, themed-battles.js KEEP_EVENTS)
      const keep = (e) => e.type === "weather" || e.type === "ally", gone = new Set((out.randomEventSchedule || []).filter((e) => !keep(e)).flatMap((e) => e.actorIds || []));
      out = { ...out, participants: out.participants.filter((p) => !gone.has(p.id)), randomEventSchedule: (out.randomEventSchedule || []).filter(keep) };
    }
    if (warfare) { /* the encounter's field and units are already laid */ }
    else if (Array.isArray(S.arenas) && ctx.G) {
      const fresh = S.arenas.filter((a) => a !== ctx.lastArena), list = fresh.length ? fresh : S.arenas;   // D9: not the map fought last battle
      out = reArena(out, list[Math.floor(hash(seed, "scenario:arena") * list.length)], seed, ctx);
    }
    else { const placed = place(out.participants, out.arenaData, ctx, true); out = { ...out, participants: out.participants.map((p, i) => (/^random-foe-/.test(p.id) ? placed[i] : p)) }; }   // same map: only the foes move
    if (fixed && (Array.isArray(S.foes.at) || S.foes.holdTurns > 0)) {   // teaching (SC22, SC23): a fixed foe on its authored tile, holding it for its first turns (the lesson needs a setter with no shot)
      const taken = new Set(out.participants.filter((p) => !/^random-foe-/.test(p.id) && p.at).map((p) => K(...p.at)));
      out = { ...out, participants: out.participants.map((p) => {
        const i = /^random-foe-(\d+)$/.exec(p.id)?.[1] - 1, at = Number.isInteger(i) ? S.foes.at?.[i] : null;
        if (!Number.isInteger(i)) return p;
        const q = { ...p, ...(S.foes.holdTurns > 0 ? { holdTurns: S.foes.holdTurns } : {}) };
        if (at && walkable(out.arenaData, ctx, at[0], at[1]) && !taken.has(K(...at))) { q.at = at.slice(); taken.add(K(...at)); }
        return q;
      }) };
    }
    if (S.phase) out.startPhase = S.phase;
    if (S.weather) out.randomEventSchedule = (out.randomEventSchedule || []).filter((e) => e.type !== "weather");   // a rolled weather event would re-roll the forced sky at round 1
    if (S.weather && ctx.Climate) out.weatherState = { ...ctx.Climate.rollWeather(out.arenaData, { seed: out.seed ?? seed, archetype: out.arenaData?.archetype }), id: S.weather };
    // Photo Safari (SC13): one of two wild packs, seeded. Sasquatch Sighting and Wolf Season author a fixed list.
    const pickedWild = Array.isArray(S.wildPick) && S.wildPick.length ? S.wildPick[Math.floor(hash(seed, "scenario:wild") * S.wildPick.length)] : (S.wild || null);
    // Tier 3 adds the scenario's one extra hazard (spec 3.3; Mala approved the list 2026-11-02): authored events, checkpoints and wild forms merged over the base ones.
    const T = tier >= 3 && S.hazard ? { ...S, force: { ...(S.force || {}), ...(S.hazard.force || {}) }, checkpoints: [...(S.checkpoints || []), ...(S.hazard.checkpoints || [])], wild: [...(pickedWild || []), ...(S.hazard.wild || [])] } : { ...S, ...(pickedWild ? { wild: pickedWild } : {}) };
    if (T.force || T.wild) out = authorEvents(out, T, seed, ctx);
    if (S.object && out.arenaData) out = { ...out, arenaData: placeScenarioObject(out.arenaData, S.object, out.participants) };   // SC16 sluice
    if (S.salvage?.minPickups && out.arenaData) out = { ...out, arenaData: ensureSalvagePickups(out.arenaData, seed, S.salvage.minPickups, ctx) };   // SC17 contested scrap
    // Ward slice (SC11–SC14): Tourist via the engine's opts.tourist spawn; civilians via opts.civilians placed after create (engine afterCreate).
    if (S.tourist) out = { ...out, tourist: true };
    if (Array.isArray(S.civilians) && S.civilians.length) {
      const taken = new Set((out.participants || []).filter((p) => p.at).map((p) => K(...p.at)));
      const mids = S.civilians.some((c) => c.middle) ? middleSpots(out.arenaData, ctx, S.civilians.filter((c) => c.middle).length, taken) : [];
      let mi = 0;
      const civilians = S.civilians.map((c) => {
        if (c.at) return { id: c.id, name: c.name, at: c.at.slice() };
        if (c.middle && mids[mi]) { const at = mids[mi++]; taken.add(K(...at)); return { id: c.id, name: c.name, at }; }
        return { id: c.id, name: c.name };
      });
      out = { ...out, civilians };
    }
    const objective = { ...S.objective };
    // Spec 3.3: tier 1 gets two more rounds, tier 3 one fewer (floor 5); never past the 14-round ceiling objectives.js enforces.
    if (objective.deadline != null) objective.deadline = Math.min(14, tier <= 1 ? objective.deadline + 2 : tier >= 3 ? Math.max(5, objective.deadline - 1) : objective.deadline);
    const spec = { id: S.id, name: S.name, tier, objective };
    const rules = { ...(out.rules || {}), scenario: spec };
    if (S.houses === "always" && ctx.rules?.houses) rules.houses = { ...ctx.rules.houses, chance: { default: 1 } };
    const sc = out.scenario, terrain = sc?.terrain || arenaName(out.arenaData, out.arenaData?.id, ctx);
    const title = `Random scenario: ${S.name} · ${terrain} · ${n} opponent${n === 1 ? "" : "s"}${sc?.ally ? ` · with ${ctx.characters?.[sc.ally]?.name || sc.ally}` : ""} · ${sc?.theyOpen ? "they move first" : "you move first"}`;
    const done = { ...out, title, mode: objective.kind === "classic" ? (S.mode || "classic") : "scenario", scenarioBattle: S.id, rules,
      theme: { id: `scenario-${S.id}`, title: S.name, text: S.text.open, mid: S.text.mid.text, result: { ...S.text.result } } };
    return done;
  }

  function midDue(theme, state) {
    const S = theme && SCENARIOS[String(theme.id || "").replace(/^scenario-/, "")]; if (!S || !state || state.outcome) return false;
    const W = S.text.mid.when;
    if (W.round) return (state.round || 0) >= W.round;
    if (W.houseOwned) return (state.arena?.objects || []).some((o) => o.type === "house" && o.house && o.house.side);
    if (W.firstFall) return Object.values(state.actors || {}).some((u) => /^random-foe-/.test(u.id) && u.defeated);
    if (W.foeHolds) return (state.mystery?.enemy || []).some((c) => W.foeHolds === true || c.trigger === W.foeHolds);   // teaching: the lesson lands the moment a face-down card of that trigger exists
    return false;
  }

  // What the battle just fought was, for account.history: "plain", "theme:<id>", a scenario id; null outside the random button.
  function tagOf(state) {
    if (!state) return null;
    if (state.rules?.scenario?.id) return state.rules.scenario.id;
    if (state.encounter !== "randomEncounter") return null;
    return state.themedBattle ? `theme:${state.themedBattle}` : "plain";
  }
  // Slice 7, the scenario mint (R-20261103-03 D8): the Seeds bonus a scenario pays on a win, from its
  // `bonus` row evaluated against the battle just fought. Face value (no band scaling: bands are undefined);
  // the mint's 55 cap backstops it. cleanHands reads the faction log (engine.js); sasquatchPhoto reads the
  // Tourist's own sprite rule (bystanders/tourist.js isSasquatch).
  function bonusFor(scenarioId, evidence = {}) {
    if (!evidence.won) return 0;
    const bonus = scenarioId && SCENARIOS[scenarioId] ? SCENARIOS[scenarioId].bonus : null;
    if (!bonus || !(bonus.seeds > 0)) return 0;
    if (bonus.cleanHands && (evidence.log || []).some((e) => e && e.kind === "faction" && /civilians are now hostile/.test(e.text || ""))) return 0;
    if (bonus.sasquatchPhoto && !(evidence.photos || []).some((p) => p && p.sprite === "sasquatch")) return 0;
    return bonus.seeds;
  }
  // The cooldown's memory: only battles the Random Encounter button made (history entries flagged `random`), newest last; a campaign or test
  // battle between two random ones does not reset it. `scenario` holds a scenario id, "theme:<id>" or "plain".
  const recentTags = (history) => (history || []).filter((h) => h && h.random).slice(-MAX_RECENT).map((h) => h.scenario || "plain");
  const isRandomBattle = (state) => tagOf(state) !== null;
  const arenaOf = (state) => state?.arena?.id || (state?.arena?.generated ? "generated" : null);

  return { SHARE, TIER_WINS, COOLDOWN, SCENARIOS, hash, tierOf, coolFactor, candidates, choose, prepare, apply, midDue, tagOf, arenaOf, recentTags, isRandomBattle, bonusFor };
});
