"use strict";
// Seeded event table for ordinary random missions. Story vignettes opt out.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatRandomEvents = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const checkpoints = [
    { id: "opening", round: 1, label: "Opening" },
    { id: "midpoint", round: 5, label: "Midpoint" },
    { id: "countdown", round: 10, label: "Countdown" },
  ];
  const table = [
    { id: "ally", weight: 16, label: "An ally is coming" },
    { id: "reinforcements", weight: 16, label: "Enemy reinforcements are coming" },
    { id: "supervillain", weight: 8, label: "A supervillain is approaching" },
    { id: "monsters", weight: 16, label: "Wild monsters will enter and attack every faction" },
    { id: "weather", weight: 16, label: "The weather will change" },
    { id: "terrain", weight: 14, label: "The terrain will shift" },
    { id: "dream", weight: 14, label: "A Dream Rift will open and send monsters" },
    { id: "visitors", weight: 6, label: "Something is coming down" },   // P1: ship + two greys, one specimen (visitors/visitors.js; table total now 106, see the archivist pins)
  ];
  // Warfare (Mala, 2026-10-11): "the random events should be scaled up and include aggressive reinforcements". Twice
  // the checkpoints, reinforcements the likeliest event, one more arrival per wave and one more monster per pack; its
  // reinforcements are marked `aggressive` (they advance on the nearest opposing faction instead of holding a post).
  // A three-faction battle with only passive sides never ends on its own (docs/termination-audit.md), so the events are
  // what forces it. Numbers are Claude's, PROVISIONAL.
  const profiles = {
    warfare: {
      checkpoints: [
        { id: "opening", round: 1, label: "Opening" }, { id: "early", round: 3, label: "Early" },
        { id: "midpoint", round: 5, label: "Midpoint" }, { id: "late", round: 8, label: "Late" },
        { id: "countdown", round: 10, label: "Countdown" }, { id: "endgame", round: 13, label: "Endgame" },
      ],
      weights: { ally: 10, reinforcements: 34, supervillain: 10, monsters: 22, weather: 8, terrain: 8, dream: 8 },
      reinforcementAdd: 1, monsterAdd: 1, aggressive: true,
      labels: { reinforcements: "Aggressive enemy reinforcements are coming" },
    },
  };
  const profileFor = (mode) => profiles[mode] || null;
  // Tofu trio pack (Muse Berry BD hot-build, 2026-10-29): a yokai-anchored enemy pack. Dedicated
  // hash stream, so seeds without the pack are identical. When the opening rolls reinforcements,
  // TOFU_PACK_Q of those waves carry the pack instead of the drawn pool: 50% trio, 25% yokai + one
  // sister, 25% solo yokai. Sisters never appear without the yokai (randomEventOnly, no other way
  // in). Converting only reinforcement waves keeps the event-type distribution (and the warfare
  // ratios) exactly as drawn.
  const TOFU_PACK_Q = 0.5, TOFU_SISTERS = ["tofu_archer", "tofu_warden"];
  function tofuPackMembers(seed) {
    const r = hash(seed, "tofu-pack:members");
    if (r < 0.5) return ["tofu_yokai", "tofu_archer", "tofu_warden"];
    if (r < 0.75) return ["tofu_yokai", TOFU_SISTERS[Math.floor(hash(seed, "tofu-pack:sister") * 2) % 2]];
    return ["tofu_yokai"];
  }
  function hash(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed >>> 0}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const pick = (r, items) => {
    const total = items.reduce((n, x) => n + x.weight, 0);
    let t = r * total;
    for (const x of items) if ((t -= x.weight) < 0) return x;
    return items.at(-1);
  };
  // The Archivist is a bright, well-organised ally, and the other side notices her. From the checkpoint after she
  // arrives (or from the opening, if she starts beside the player), "Enemy reinforcements" is weighted up (16 → 40).
  const ARCHIVIST_REINFORCEMENT_WEIGHT = 40;
  const weightsFor = (archivistHere, profile = null) => {
    const base = profile?.weights ? table.map((row) => ({ ...row, weight: profile.weights[row.id] ?? row.weight })) : table;
    return archivistHere
      ? base.map((row) => row.id === "reinforcements" ? { ...row, weight: Math.max(row.weight, ARCHIVIST_REINFORCEMENT_WEIGHT) } : row)
      : base;
  };
  // The Errand (Jambavan, 2026-10-24): a character's allyFavors draws those allies to its own side. favorsBySide returns
  // [player side, enemy side]: the player side is the main character and any seated player unit; the enemy side, the foes.
  function favorsBySide(C, main, participants) {
    const of = (ids) => [...new Set(ids.flatMap((id) => C.characters[id]?.allyFavors || []))].filter((id) => C.characters[id] && id !== main && !participants.some((p) => p.character === id));
    return [of([main, ...participants.filter((p) => p.side === "player").map((p) => p.character)]), of(participants.filter((p) => p.side === "enemy").map((p) => p.character))];
  }
  // The starting-ally roll (engine.js randomEncounterOptions). Without favors it draws exactly as before: one roll of 100, then
  // one pick. With them the ally comes more often (rules.allyFavor.chance) and half the time it is the favored one.
  function favoredAlly(C, main, startingAllies, participants, roll) {
    const fav = favorsBySide(C, main, participants.filter((p) => p.character !== main))[0].filter((id) => (C.characters[main]?.allyFavors || []).includes(id));
    if (!fav.length) return roll(100) < 35 ? startingAllies[roll(startingAllies.length)] : null;
    if (roll(100) >= (C.rules.allyFavor?.chance ?? 60)) return null;
    const pool = [...startingAllies, ...fav.flatMap((id) => Array(Math.max(1, startingAllies.length)).fill(id))];
    return pool[roll(pool.length)];
  }
  // Authored schedules (random scenarios, SCENARIOS.md 3.4): `checkpoints` replaces the checkpoint list for this call, and `force` maps a
  // checkpoint id to an event spec, { type, ...fields }. A forced checkpoint skips the weighted pick, is filled the way a rolled one of that
  // type is (same hash tags), then the spec's own fields win (a fixed duration, monster count or weatherId). With neither option the
  // function is the one it always was (tests/random-events.test.mjs and the seeded GUARDs pin that).
  const AUTHORED_KEEP = ["id", "round", "label", "resolved", "type"];
  function create(seed, { allies = ["arantxa"], opponents = [], roster = [], archivistStart = false, mode = null, favored = [], foeFavored = [], fits = null, force = null, checkpoints: authored = null } = {}) {
    let archivistHere = !!archivistStart;   // she can only ever arrive once
    const arrived = [];   // every earlier wave stands on the enemy side too, so fits() sees them (seed 6: Kumbhakarna, then Rama a wave later)
    const profile = profileFor(mode);
    const events = (authored || profile?.checkpoints || checkpoints).map((point) => {
      const raised = archivistHere;
      const forced = force && force[point.id] && Object.prototype.hasOwnProperty.call(labels, force[point.id].type) ? force[point.id] : null;   // an unknown type is ignored, never half-built
      const type = forced ? forced.type : pick(hash(seed, `event:${point.id}`), weightsFor(raised, profile)).id;
      const event = { ...point, type, resolved: false };
      if (forced) event.forced = true;
      if (profile) event.profile = mode;
      if (type === "reinforcements" && raised) event.archivistRaisedOdds = true;
      if (type === "ally") {
        const allyPool = [...new Set(["arantxa", "archivist", ...allies].filter(Boolean))].filter((id) => !(id === "archivist" && archivistHere));
        const weightedAllies = allyPool.map((id) => ({ id, weight: favored.includes(id) ? 8 : ["arantxa","archivist"].includes(id) ? 4 : 1 }));   // favored: the main character's allyFavors (Jambavan for Hanuman)
        event.character = pick(hash(seed, `ally:${point.id}`), weightedAllies).id;
        if (event.character === "archivist") archivistHere = true;
      } else if (type === "reinforcements") {
        const pool = roster.filter((id) => id!=="archivist" && !opponents.includes(id));
        // Ordinarily one or two arrive; the Archivist's presence draws a larger force: two or three.
        const count = (raised ? 2 : 1) + (profile?.reinforcementAdd || 0) + Math.floor(hash(seed, `reinforcement-count:${point.id}`) * 2);
        if (profile?.aggressive) event.aggressive = true;
        event.characters = [];
        for (let i = 0; i < Math.min(count, pool.length); i++) {
          // Feud-safe waves (Mala, 2026-10-24): a reinforcement must stand with the enemy side already
          // placed plus the wave so far, or the create() backstop throws. Builders pass fits; without one
          // the draw is unchanged. A wave that cannot fill feud-safely arrives short, never feuding.
          const candidates = pool.filter((id) => !event.characters.includes(id) && (!fits || fits(id, [...opponents, ...arrived, ...event.characters])));
          if (!candidates.length) break;
          // A favored ally of the enemy side (Jambavan beside an enemy Hanuman) takes half of each draw; with none, the draw is unchanged.
          const fav = foeFavored.filter((id) => candidates.includes(id)), drawn = fav.length ? [...candidates, ...fav.flatMap((id) => Array(candidates.length).fill(id))] : candidates;
          event.characters.push(drawn[Math.floor(hash(seed, `reinforcement:${point.id}:${i}`) * drawn.length) % drawn.length]);
        }
        arrived.push(...event.characters);
      } else if (type === "supervillain") {
        event.heroRound = point.round + 1 + Math.floor(hash(seed, `hero-delay:${point.id}`) * 3);
        event.heroes = hash(seed, `heroine:${point.id}`) < 0.35 ? ["superHero", "superHeroine"] : ["superHero"];
      } else if (type === "monsters") {
        event.monsters = 1 + (profile?.monsterAdd || 0) + Math.floor(hash(seed, `monster-count:${point.id}`) * 3);
      } else if (type === "weather") {
        event.weatherRoll = hash(seed, `weather:${point.id}`);
      } else if (type === "terrain") {
        event.effect = ["shallow-flood", "fallen-cover", "dream-growth"][Math.floor(hash(seed, `terrain:${point.id}`) * 3)];
      } else if (type === "dream") {
        event.duration = 1 + Math.floor(hash(seed, `dream-duration:${point.id}`) * 3);
        event.monsters = 1 + Math.floor(hash(seed, `dream-count:${point.id}`) * 2);   // the rift's per-wave count (was never set: countPerWave undefined, every wave spawned nothing)
      }
      if (forced) for (const [k, v] of Object.entries(forced)) if (!AUTHORED_KEEP.includes(k)) event[k] = v;
      return event;
    });
    if (!profile) {   // the tofu pack converts reinforcement openings (default encounters only)
      const opening = events.find((e) => e.id === "opening");
      if (opening?.type === "reinforcements" && !opening.forced && !opening.archivistRaisedOdds && hash(seed, "tofu-pack:fire") < TOFU_PACK_Q) {
        opening.characters = tofuPackMembers(seed);
        opening.tofuPack = true;   // marks the converted opening (the Archivist's group-size test and any future reader skip packs)
        arrived.push(...opening.characters);
      }
    }
    return events;
  }
  const labels = Object.fromEntries(table.map((e) => [e.id, e.label]));
  const labelFor = (e) => (e.type === "reinforcements" && e.aggressive && profiles[e.profile]?.labels?.reinforcements) || labels[e.type];
  const forecast = (schedule) => `Mission event forecast: ${schedule.map((e) => `${e.label} · ${labelFor(e)}`).join("; ")}. Later events occur only if the encounter is still active.`;
  return { checkpoints, table, profiles, profileFor, create, favorsBySide, favoredAlly, ARCHIVIST_REINFORCEMENT_WEIGHT, forecast, labels, hash };
});
