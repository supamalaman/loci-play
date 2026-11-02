"use strict";
// Climate rules for Concept Combat. Pure functions; no DOM. Data: climate-data.js. Spec: ~/Documents/concept-combat-climate.md.
//
//   rollWeather(arena, { seed, archetype })        → weather state { id, windTo, windFrom, since, forecast, rainRounds }
//   advance(state, arena, { seed, round })          → { state, events }  at a round boundary: forecast a shift, apply last round's forecast
//   microclimate(arena, state, { wetTiles, windbreaks }) → { at(x, y), tiles }  per-tile flags (canopy, shade, wet, exposed, sheltered, tunnel, sunbaked, fogPool)
//   modifier(ability, { from, to, state, micro, channel }) → { mul, rangeAdd, maxRange, flags, notes, applied }
//   endOfTurn(actor, state, micro)                  → { lfLoss, events }  heat stress
//   describe(state, micro, x, y)                    → short text for a tile tooltip
// Observe the place (weather cards; same AP/deck rules as insight.observe):
//   placeDeck(arena, state, { seed })               → deck { subject, cards }   feel (open) · readSky · lee · habit
//   observePlace({ deck, know, cognitive, invest, dreamField }) → insight.observe result + { charge: 0, grants, familiarity }
//   grantsFrom(deck, know) / weatherFamiliarity(deck, know)
//   forecast(state, arena, { seed, round, rounds }) → upcoming weather ids (what advance() will actually produce)
//   visibleMicro(m, grants)                         → the tile flags this observer can see
//   dreamWeather(state, field, { grants, choice, archetype }) → { field, event }  the dreamer sets the sky inside a Dream Space
//   effective(state, field)                         → the weather state that applies right now (dream sky wins)
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./climate-data.js"), require("../terrain/terrain-data.js"), require("../insight/insight.js"));
  else root.ConceptCombatClimate = factory(root.ConceptCombatClimateData, root.ConceptCombatTerrain, root.ConceptCombatInsight);
})(typeof self !== "undefined" ? self : this, function (CD, TD, Insight) {
  const R = CD.rules;

  // FNV-1a + murmur3 fmix32 (same as wild/monsters.js): neighbouring keys must not give correlated rolls.
  function roll(...parts) {
    let h = 2166136261;
    for (const c of parts.join(":")) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function weighted(r, table) {
    const entries = Object.entries(table).filter(([, w]) => w > 0), total = entries.reduce((s, [, w]) => s + w, 0);
    let t = r * total;
    for (const [k, w] of entries) { if ((t -= w) < 0) return k; }
    return entries[entries.length - 1][0];
  }
  const W = (state) => { const w = CD.weather[state?.id] || CD.weather.overcast; return state?.night ? { ...w, sun: false } : w; };   // night: the sky may be clear, but no sun stands in it

  function windFor(seed) {
    const d = R.windDirs[Number(weighted(roll(seed, "wind"), Object.fromEntries(R.windDirs.map((x, i) => [i, x.w]))))];
    return { windTo: d.to.slice(), windFrom: d.from };
  }

  function rollWeather(arena, { seed = arena?.seed ?? 0, archetype = arena?.archetype } = {}) {
    const table = CD.archetypeWeather[archetype] || CD.archetypeWeather.default;
    const id = weighted(roll(seed, "weather"), table);
    return { id, ...windFor(seed), since: 0, forecast: null, rainRounds: 0 };
  }

  // Called once per round boundary. A shift is forecast one round ahead, so both sides can plan for it.
  function advance(state, arena, { seed = arena?.seed ?? 0, round = 0, dreamOpen = false } = {}) {
    // While a Dream Space is open the real sky waits (its forecast too): the ultimate bar is the only clock.
    if (dreamOpen && CD.observe.ult.dreamFreezesWeather) return { state: { ...state, since: state.since + 1 }, events: [] };
    const events = []; let s = { ...state };
    if (s.forecast) {
      s = { ...s, id: s.forecast, forecast: null, since: round, rainRounds: 0 };
      events.push({ kind: "weather", weather: s.id, text: `${CD.weather[s.id].name}. ${CD.weather[s.id].text}` });
    } else if (round - s.since >= R.minRounds && roll(seed, round, "shift") < R.shiftChance) {
      const next = CD.transitions[s.id][Math.floor(roll(seed, round, "to") * CD.transitions[s.id].length)];
      s.forecast = next;
      events.push({ kind: "forecast", weather: next, text: `The sky is turning: ${CD.weather[next].name.toLowerCase()} next round.` });
    }
    if (W(s).rain) s.rainRounds = (s.rainRounds || 0) + 1;
    return { state: s, events };
  }

  // ── microclimate ─────────────────────────────────────────────────────────
  function grid(arena) {
    const H = arena.map.length, Wd = arena.map[0].length;
    const objAt = (x, y) => (arena.objects || []).find((o) => o.x === x && o.y === y && !o.destroyed) || null;
    const inside = (x, y) => x >= 0 && y >= 0 && x < Wd && y < H;
    const ground = (x, y) => Number(arena.height?.[y]?.[x] ?? 0);
    const terr = (x, y) => TD.terrain[arena.map[y][x]] || TD.terrain["."];
    // How tall the obstacle on a tile stands above its own ground (0 = nothing).
    const obstacle = (x, y) => Math.max(objAt(x, y)?.sightHeight || 0, terr(x, y).sightHeight || 0);
    return { H, Wd, objAt, inside, ground, terr, obstacle };
  }

  function microclimate(arena, state, { wetTiles = [], windbreaks = [] } = {}) {
    const g = grid(arena), w = W(state), tiles = [];
    const extraWet = new Set(wetTiles.map(([x, y]) => x + "," + y));
    const extraBreak = new Map(windbreaks.map(([x, y, h]) => [x + "," + y, h || 1]));
    const top = (x, y) => g.ground(x, y) + Math.max(g.obstacle(x, y), extraBreak.get(x + "," + y) || 0);

    // Canopy: Manhattan radius around trees (same rule as vegetation.shadeTiles), excluding the trunk tile.
    const canopy = new Set();
    for (const o of arena.objects || []) if (o.canopy > 0 && !o.destroyed)
      for (let y = 0; y < g.H; y++) for (let x = 0; x < g.Wd; x++)
        if (Math.abs(x - o.x) + Math.abs(y - o.y) <= o.canopy && !(x === o.x && y === o.y)) canopy.add(x + "," + y);
    // Cast shadow: anything tall throws shade along shadowDir (1 tile for height 1–2, 2 for taller); a cliff 2+ higher too.
    const shadow = new Set(), [sx, sy] = R.shadowDir;
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.Wd; x++) {
      const h = g.obstacle(x, y); if (!h) continue;
      for (let k = 1; k <= (h >= 3 ? 2 : 1); k++) shadow.add((x + sx * k) + "," + (y + sy * k));
    }
    const isWater = (x, y) => g.inside(x, y) && g.terr(x, y).tags.includes("water");
    const [wx, wy] = state?.windTo || [0, 0];

    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.Wd; x++) {
      const key = x + "," + y, here = g.ground(x, y);
      const m = { x, y, canopy: canopy.has(key) };
      const cliffShade = g.inside(x - sx, y - sy) && g.ground(x - sx, y - sy) >= here + 2;
      m.shade = w.sun && (m.canopy || shadow.has(key) || cliffShade);
      const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isWater(x + dx, y + dy));
      const rainedOn = w.rain && !(m.canopy && (state.rainRounds || 0) <= R.canopyHoldsRainRounds);
      m.wet = isWater(x, y) || nearWater || extraWet.has(key) || rainedOn;
      if (w.wind > 0) {
        // Look upwind for a windbreak; it shelters shelterPerHeight tiles per level it stands above this tile.
        for (let k = 1; k <= 8 && !m.sheltered; k++) {
          const bx = x - wx * k, by = y - wy * k; if (!g.inside(bx, by)) break;
          // A standing windbreak (hedge, wall, tree) shelters further than a bare step in the ground.
          const rise = top(bx, by) - here, step = g.ground(bx, by) - here, standing = rise > Math.max(step, 0);
          if ((standing && rise >= 1 && k <= rise * R.shelterPerHeight) || (step >= 1 && k <= step * R.shelterPerStep)) m.sheltered = true;
        }
        const blocked = (dx, dy) => !g.inside(x + dx, y + dy) ? false : (g.obstacle(x + dx, y + dy) >= 1 || extraBreak.has((x + dx) + "," + (y + dy)) || g.ground(x + dx, y + dy) >= here + 2);
        const [px, py] = [wy, wx];   // perpendicular to the wind
        m.tunnel = !m.sheltered && blocked(px, py) && blocked(-px, -py);
        m.exposed = !m.sheltered && here >= R.exposedHeight;
      }
      m.sunbaked = w.sun && !m.shade && g.terr(x, y).tags.includes("hard") && !g.terr(x, y).tags.includes("wood");
      m.fogPool = w.fog && here === 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g.inside(x + dx, y + dy) && g.ground(x + dx, y + dy) >= 1);
      for (const k of ["shade", "wet", "sheltered", "tunnel", "exposed", "sunbaked", "fogPool"]) m[k] = !!m[k];
      tiles.push(m);
    }
    const at = (x, y) => tiles[y * g.Wd + x] || null;
    return { at, tiles };
  }

  // ── ability modifiers ───────────────────────────────────────────────────
  const list = (v) => (v == null ? null : Array.isArray(v) ? v : [v]);
  function matches(rule, ability, channel) {
    const m = rule.match;
    if (m.channel && m.channel !== channel) return false;
    if (m.notChannel && m.notChannel === channel) return false;
    if (m.delivery && !m.delivery.includes(ability.delivery)) return false;
    if (m.concept && !(ability.concepts || [ability.concept]).includes(m.concept)) return false;
    if (m.effect && !list(m.effect).some((e) => String(ability.effect || "").split("+").includes(e))) return false;
    if (m.ability && !list(m.ability).some((id) => { const a = ability.ability || ability.id || ""; return a === id || a.endsWith("_" + id); })) return false;   // rainDouses: explicit fire-attack list incl. boss-prefixed ids (live fire carries effect "damage")
    return true;
  }
  function holds(when, state, m) {
    const w = W(state);
    switch (when) {
      case "wind": return w.wind > 0 && !m.sheltered;
      case "wet": return m.wet;
      case "rain": return w.rain;
      case "sunlit": return w.sun && !m.shade;
      case "shade": return w.sun && m.shade;
      case "heat": return w.heat;
      case "sunbaked": return w.heat && m.sunbaked;   // shimmer needs real heat, not just sun
      case "fog": return w.fog;
      default: return false;
    }
  }
  function windClass(from, to, windTo) {
    const vx = to[0] - from[0], vy = to[1] - from[1], len = Math.hypot(vx, vy);
    if (!len) return null;
    const cos = (vx * windTo[0] + vy * windTo[1]) / len;
    return cos > 0.5 ? "downwind" : cos < -0.5 ? "upwind" : "crosswind";
  }

  function modifier(ability, { from, to, state, micro, channel } = {}) {
    const out = { mul: 1, rangeAdd: 0, maxRange: null, flags: {}, notes: [], applied: [] };
    if (!state || !micro) return out;
    channel = channel || ability.damageType || ability.channel;
    to = to || from;
    const w = W(state), mFrom = micro.at(...from), mTo = micro.at(...to) || mFrom;
    for (const rule of CD.modifiers) {
      if (!matches(rule, ability, channel)) continue;
      const m = rule.side === "caster" ? mFrom : mTo;
      if (!m || !holds(rule.when, state, m)) continue;
      let factor = rule.mul || 1;
      if (rule.downwind || rule.upwind || rule.crosswind || rule.downwindRange) {
        const cls = windClass(from, to, state.windTo);
        // Squalls, high ground and wind tunnels make the wind count for more.
        const scale = (w.wind >= 2 ? 1.5 : 1) * (mFrom.exposed || mFrom.tunnel ? 1.5 : 1);
        if (cls && rule[cls]) factor *= 1 + (rule[cls] - 1) * scale;
        if (cls === "downwind" && rule.downwindRange) out.rangeAdd += rule.downwindRange;
        if (!cls && !rule.mul && !rule.flags && !rule.drift) continue;   // self-centred: no direction to ride
      }
      out.mul *= factor;
      if (rule.rangeAdd) out.rangeAdd += rule.rangeAdd;
      if (rule.drift) out.flags.drift = state.windTo.slice();
      for (const [k, v] of Object.entries(rule.flags || {})) {
        if (k === "maxRange") out.maxRange = v === "fogSight" ? (mFrom.fogPool ? R.fogSight.low : R.fogSight.high) : v;
        else if (k === "knockbackAdd") out.flags.knockbackAdd = (out.flags.knockbackAdd || 0) + v;
        else if (/Mul$/.test(k)) out.flags[k] = (out.flags[k] || 1) * v;
        else out.flags[k] = v;
      }
      out.applied.push(rule.id);
      out.notes.push(factor !== 1 ? `${rule.text} (×${Math.round(factor * 100) / 100})` : rule.text);
    }
    const clamped = Math.min(R.clamp[1], Math.max(R.clamp[0], out.mul));
    if (clamped !== out.mul) out.notes.push(`Weather can only shift a hit so far: ×${clamped}.`);
    out.mul = Math.round(clamped * 1000) / 1000;
    return out;
  }

  function endOfTurn(actor, state, micro) {
    const m = micro?.at(actor.x, actor.y);
    if (!m || !W(state).heat || !m.sunbaked || actor.form?.golden) return { lfLoss: 0, events: [] };
    return { lfLoss: R.heatStress, events: [{ kind: "climate", actor: actor.id, text: `Heat stress on baked paving: −${R.heatStress} LF. Shade would have spared it.` }] };
  }

  function describe(state, micro, x, y) {
    const m = micro.at(x, y); if (!m) return "";
    const tags = Object.keys(CD.micro).filter((k) => m[k]).map((k) => CD.micro[k].name);
    return `${W(state).name}${tags.length ? " · " + tags.join(", ") : ""}`;
  }

  // ── Observe the place: weather cards ─────────────────────────────────────
  const placeKey = (arena) => "place:" + (arena?.name || arena?.archetype || "arena");
  function habitText(archetype) {
    const t = CD.archetypeWeather[archetype] || CD.archetypeWeather.default;
    const top = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => CD.weather[k].name.toLowerCase());
    return `mostly ${top.join(" and ")}`;
  }
  function placeDeck(arena, state, { seed = arena?.seed ?? 0 } = {}) {
    const key = placeKey(arena), w = W(state);
    const cards = CD.observe.cards.map((c) => ({
      id: `${key}:sky:${c.id}`, sourceId: c.id, kind: "sky", key: "sky:" + c.id, open: !!c.open, difficulty: c.difficulty,
      text: c.text(w, state, habitText(arena?.archetype)), grants: c.grants || {}, unlocks: [], tie: roll(seed, key, c.id),
    }));
    return { subject: { key, kind: "place" }, cards };
  }
  function grantsFrom(deck, know) {
    const g = { forecastRounds: 1, subtleMicro: false, dreamWeather: false };
    for (const c of deck.cards) if (know.revealed.includes(c.id)) for (const [k, v] of Object.entries(c.grants)) g[k] = typeof v === "number" ? Math.max(g[k] || 0, v) : v || g[k];
    return g;
  }
  function weatherFamiliarity(deck, know) {
    const hidden = deck.cards.filter((c) => !c.open);
    return CD.observe.familiarityShare * hidden.filter((c) => know.revealed.includes(c.id)).length / (hidden.length || 1);
  }
  function observePlace({ deck, know, cognitive, invest, dreamField = null, seed = 0 }) {
    if (dreamField?.type === "dreamSpace" && CD.observe.ult.inDreamSpace === "blocked")
      return { know, cognitive, revealed: [], unlocked: [], charge: 0, error: true, lines: ["Inside a Dream Space the sky belongs to the dreamer. There's no place here to read."] };
    const r = Insight.observe({ deck, know, cognitive, subjectKey: deck.subject.key, invest, seed });
    if (r.error) return { ...r, charge: 0 };
    const grants = grantsFrom(deck, r.know), familiarity = weatherFamiliarity(deck, r.know);
    // No ultimate charge from reading the place: its payoff to the bar is a cheaper, longer Dream Space here.
    return { ...r, charge: CD.observe.ult.directCharge, grants, familiarity,
      lines: [...r.lines, ...(r.revealed.length ? [`Place familiarity (sky): ${Math.round(familiarity * 100)}%. A Dream Space here will need less charge and drain slower.`] : [])] };
  }

  // Investigate the place (I3): the whole rest of a turn on the sky. Same deck, same grants and familiarity as observePlace; the order, depth bonus and carry are Insight.investigate's.
  function investigatePlace({ deck, know, cognitive, ap, dreamField = null }) {
    if (dreamField?.type === "dreamSpace" && CD.observe.ult.inDreamSpace === "blocked")
      return { know, cognitive, revealed: [], unlocked: [], charge: 0, error: true, lines: ["Inside a Dream Space the sky belongs to the dreamer. There's no place here to read."] };
    const r = Insight.investigate({ deck, know, cognitive, subjectKey: deck.subject.key, ap, name: "the place" });
    if (r.error) return { ...r, charge: 0 };
    const grants = grantsFrom(deck, r.know), familiarity = weatherFamiliarity(deck, r.know);
    return { ...r, charge: CD.observe.ult.directCharge, grants, familiarity,
      lines: [...r.lines, ...(r.revealed.length ? [`Place familiarity (sky): ${Math.round(familiarity * 100)}%. A Dream Space here will need less charge and drain slower.`] : [])] };
  }

  // What advance() will actually do over the next rounds. Public view: rounds = 1; Read the Sky: 2.
  function forecast(state, arena, { seed = arena?.seed ?? 0, round = 0, rounds = 1 } = {}) {
    const out = []; let s = state;
    for (let i = 1; i <= rounds; i++) { s = advance(s, arena, { seed, round: round + i }).state; out.push({ round: round + i, weather: s.id }); }
    return out;
  }
  function visibleMicro(m, grants = {}) {
    if (!m) return null;
    const keys = [...CD.observe.publicMicro, ...(grants.subtleMicro ? CD.observe.subtleMicro : [])];
    return Object.fromEntries([["x", m.x], ["y", m.y], ...keys.map((k) => [k, m[k]])]);
  }

  // The dreamer sets the sky inside their Dream Space: any weather this place gets, if they know its habit;
  // otherwise the dream keeps the sky they fell asleep under.
  function dreamWeather(state, field, { grants = {}, choice = null, archetype } = {}) {
    const options = grants.dreamWeather ? Object.keys(CD.archetypeWeather[archetype] || CD.archetypeWeather.default) : [state.id];
    const id = options.includes(choice) ? choice : state.id;
    return { field: { ...field, weather: id }, options,
      event: { kind: "weather", weather: id, dream: true, text: id === state.id ? `The dream keeps the sky: ${CD.weather[id].name.toLowerCase()}.` : `The dreamer turns the sky: ${CD.weather[id].name.toLowerCase()}.` } };
  }
  // The weather state combat rules should read: by night the sun is out (shade, sunlit, sunbaked, clear-light bonuses go quiet;
  // rain, wind and fog stay). A dream that set its own sky keeps it. Rules live in content rules.time; phase is s.time.phase.
  const sky = (s) => (s?.weatherState && s.rules?.time && s.time?.phase === "night" && !s.dreamSpace?.weather ? { ...s.weatherState, night: true } : s?.weatherState);
  const effective = (state, field) => (field?.type === "dreamSpace" && field.weather ? { ...state, id: field.weather } : state);

  return { investigatePlace, rollWeather, advance, microclimate, modifier, endOfTurn, describe, windClass,
    placeDeck, observePlace, grantsFrom, weatherFamiliarity, forecast, visibleMicro, dreamWeather, effective, sky, data: CD };
});
