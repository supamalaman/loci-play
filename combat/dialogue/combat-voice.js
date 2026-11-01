"use strict";
// Combat voice: turn new engine log entries into a few enemy speech bubbles.
//
//   const voice = ConceptCombatVoice.create({ tracery, grammar, speakers, characters: content.characters });
//   const bubbles = voice.lines(state, { from: lastLogIndex });   // after each apply()
//   → [{ actor, name, event, text, logIndex }]  (0–2 bubbles; show them over the speaker's sprite)
//
// Deterministic: every roll is seeded from (battle seed, log index, actor, event), so a replay of
// the same log produces the same lines. Stateless: low-LF and other thresholds are recomputed
// from the whole log, so it is safe to call with any `from`.
// Rate limits: at most one bubble per speaker and `maxPerCall` per call, highest priority first;
// routine events (attack/hit/hurt/climb) only speak some of the time.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatVoice = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const PRIORITY = { quote: 9, defeat: 10, victory: 10, encounter: 9, summoned: 9, dismissed: 9, ordered: 9, appear: 9, named: 9, unnamed: 8, fade: 9, ally_hurt: 6, ultimate: 8, rethink: 7, ally_down: 7, low_lf: 7, player_correct: 7, player_wrong: 7,
    fall: 6, terrain: 6, reveal: 5, parried: 5, slammed: 5, hurt: 4, hit: 3, climb: 3, attack: 2, dream_opened: 7, supernatural: 7, authority_attacked: 8, dispatched: 9, adapt: 6, transcend: 9, swear: 8 };
  // Cutscene events: any undefeated battlefield speaker with its OWN lines for the event
  // speaks, friend or foe (speakers.js side variants), one speaker per event.
  const CUTSCENE = new Set(["dream_opened", "supernatural", "authority_attacked", "dispatched"]);
  const CHANCE = { attack: 0.3, hit: 0.3, hurt: 0.45, climb: 0.6, ally_hurt: 0.5 };
  const LOW_LF = 0.3;

  function hash(str) {                               // FNV-1a + murmur3 fmix32 → [0,1)
    let h = 2166136261;                              // (bare FNV gives near-equal values for keys that differ at the end)
    for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // summonVoices (dialogue/summon-voices.js) lets memory-palace summons speak too: actors with
  // `summon.key` use their own lines and only the events summon-voices lists.
  // dreamVoices (dialogue/dream-voices.js): dream monsters (actor.dream.key, wild side) speak their own lines.
  function create({ tracery, grammar, speakers, characters = {}, summonVoices = null, dreamVoices = null, maxPerCall = 2 }) {
    const cache = new Map();
    // Character key for an actor. Prefer actor.character (ask the engine to set it); until then,
    // match the content character by sprite + name, then by lowercase name. A character id with
    // no voice falls through to the sprite/name match, so class-based units speak by name.
    function speakerId(a) {
      if (!a) return null;
      if (a.communed && speakers.speakers[`commune_${a.communed.type}`]) return `commune_${a.communed.type}`;   // communed allies speak as their species (banyan, bristlecone, kukui, plumbago)
      if (a.character && speakers.speakers[a.character]) return a.character;
      if (a.boss && speakers.speakers[a.boss]) return a.boss;   // a boss speaks under its boss id (the Tallyman, sprites/tallyman/heads)
      const hit = Object.entries(characters).find(([, c]) => c.sprite === a.sprite && c.name === a.name)
        || Object.entries(characters).find(([, c]) => c.sprite === a.sprite);
      if (hit) return hit[0];
      const byName = String(a.name || "").toLowerCase();
      if (speakers.speakers[byName]) return byName;
      return a.character || byName;
    }
    const sideOf = (a) => (a && a.side === "player" ? "ally" : "foe");
    const ownLines = (id, event) => {
      const v = speakers.speakers[id]?.events?.[event];
      if (!v) return [];
      return Array.isArray(v) ? v : [...(v.ally || []), ...(v.foe || [])];
    };
    const isCutsceneCapable = (id) => {
      const sp = speakers.speakers[id];
      return !!sp && (!!sp.faces || Object.values(sp.events || {}).some((v) => v && !Array.isArray(v)));
    };
    const isSummon = (a) => !!(a && a.summon && summonVoices && summonVoices.voices[a.summon.key]);
    const isDream = (a) => !!(a && a.dream && dreamVoices && dreamVoices.voices[a.dream.key]);
    const canSpeak = (a) => !!a && ((a.side === "enemy" && !!speakers.speakers[speakerId(a)]) || isSummon(a) || isDream(a) || isCutsceneCapable(speakerId(a)));
    function dialogue(a) {
      const key = isSummon(a) ? "summon:" + a.summon.key : isDream(a) ? "dream:" + a.dream.key : speakerId(a) + ":" + sideOf(a);
      if (!cache.has(key)) cache.set(key, isSummon(a) ? tracery.fromObjects(summonVoices.spec(a.summon.key), {})
        : isDream(a) ? tracery.fromObjects(dreamVoices.spec(a.dream.key), {}) : tracery.fromObjects(speakers.spec(speakerId(a), sideOf(a)), grammar));
      return cache.get(key);
    }
    // Cutscene pickup: first undefeated battlefield speaker with own lines for the event, player side first.
    const cutsceneSpeaker = (s, event) => (s.order || [])
      .filter((id) => { const a = s.actors[id]; return a && !a.defeated && ownLines(speakerId(a), event).length; })
      .sort((p, q) => (s.actors[p].side === "player" ? 0 : 1) - (s.actors[q].side === "player" ? 0 : 1))[0] || null;

    // Candidate (actorId, event) pairs for one log entry. `ctx` carries running facts.
    function candidates(s, e, ctx) {
      const A = (id) => s.actors[id], out = [];
      const add = (id, event) => {
        const a = A(id);
        if (!canSpeak(a) || (a.defeated && event !== "defeat")) return;
        if (isSummon(a) && !summonVoices.events.includes(event)) return;    // summons only voice their own event set
        if (isDream(a) && !dreamVoices.events.includes(event)) return;
        if (a.side !== "enemy" && !isSummon(a) && !isDream(a) && event !== "encounter" && !CUTSCENE.has(event)) return;  // allies only cutscene
        out.push({ actor: id, event });
      };
      const cue = (event) => { const id = cutsceneSpeaker(s, event); if (id) add(id, event); };
      const summonsAlive = () => Object.values(s.actors).filter((a) => isSummon(a) && !a.defeated).map((a) => a.id);
      const enemiesAlive = () => Object.values(s.actors).filter((a) => a.side === "enemy" && !a.defeated).map((a) => a.id);
      switch (e.kind) {
        case "act": if (e.ability) add(e.actor, "attack"); ctx.lastActor = e.actor; break;
        case "announce": add(e.actor, "ultimate"); ctx.lastActor = e.actor; break;
        case "reveal": add(e.actor, "reveal"); break;
        case "quote": { const a = A(e.actor); if (canSpeak(a) && !a.defeated && e.quote) out.push({ actor: e.actor, event: "quote" }); break; }   // a line the engine wrote (Never Give Up): spoken as written, allies too
        case "damage": {
          const t = A(e.target);
          if (!t) break;
          const before = ctx.lf[e.target] ?? t.maxLF, after = before - (e.amount || 0);
          ctx.lf[e.target] = after;
          if ([t.primary, t.secondary].includes("legitimacy")) cue("authority_attacked");   // striking an office, not a unit
          if (canSpeak(t)) {
            if (before > LOW_LF * t.maxLF && after <= LOW_LF * t.maxLF && after > 0) add(e.target, "low_lf");
            else if (after > 0) add(e.target, "hurt");
          } else if (e.actor && canSpeak(A(e.actor)) && A(e.actor).side !== t.side) add(e.actor, "hit");
          // a summon reacts when someone on its own side (not a summon) is hurt by the other side
          if (t.side === "player" && !t.summon && e.actor && A(e.actor)?.side !== "player") for (const id of summonsAlive()) add(id, "ally_hurt");
          break;
        }
        case "parry": if (ctx.lastActor) add(ctx.lastActor, "parried"); break;
        case "negate": add(e.actor, "parried"); break;
        case "climb": add(e.actor, "climb"); break;
        case "fall": if ((e.text || "").includes("stumbles")) break;
          if (A(e.actor)?.side === "enemy") add(e.actor, "fall"); else if (ctx.lastActor) add(ctx.lastActor, "hit"); break;
        case "slam": if (A(e.target)?.side === "enemy") add(e.target, "slammed"); break;
        case "terrain": if (A(e.target)?.side === "enemy") add(e.target, "terrain"); break;
        case "defeat": {
          const t = A(e.target);
          if (t?.side === "enemy") { add(e.target, "defeat"); for (const id of enemiesAlive()) if (id !== e.target) add(id, "ally_down"); }
          else if (isSummon(t) || isDream(t)) add(e.target, "defeat");
          else if (t && t.side === "player") for (const id of enemiesAlive()) add(id, "victory");   // only the player's side falling is a victory for enemies
          break;
        }
        // emitted by the enemy AI when observed damage falls short of what it expected (see README)
        case "strategy": if (e.reason !== "routine") add(e.actor, "rethink"); break;
        case "dream_opened": cue("dream_opened"); break;               // engine: actions.js dreamSpace open
        case "supernatural": cue("supernatural"); break;             // literal kind, if an engine site ever emits it
        case "authority_attacked": cue("authority_attacked"); break; // literal kind, if an engine site ever emits it
        case "dispatch": if (e.beat) cue("dispatched"); break;         // engine: law/dispatch.js trigger + arrive only (kneel/cuff notes are not a dispatch; loop 1a17c856419)
        case "summon": add(e.actor, "summoned"); cue("supernatural"); break;   // engine: { kind: "summon", actor: summonId }
        case "summonEnd": add(e.actor, "dismissed"); break;      // engine: { kind: "summonEnd", actor, reason }
        case "summonOrder": add(e.actor, "ordered"); break;      // the player spent a full ultimate on the summon's ult
        case "dreamAppear": add(e.actor || `dream-${e.monster}`, "appear"); cue("supernatural"); break;
        case "dreamNamed": add(e.actor, e.correct ? "named" : "unnamed"); break;
        case "dreamFade": add(e.actor, "fade"); break;
        case "summonUltimate": add(e.actor, "ultimate"); break;
        case "learning": add(e.actor || enemiesAlive()[0], e.correct ? "player_correct" : "player_wrong"); break;
        case "adapt": if (A(e.actor)?.character === "agi") add(e.actor, "adapt"); break;   // Takeoff: ledger track done (guardian "adapt" stays silent)
        case "transcend": add(e.actor, "transcend"); break;       // Takeoff: the fear-aggro flip
        case "ascension": add(e.actor, "transcend"); break;      // the Martial Artist climbs past her limits (heads follow her sprite: base or gold)
        case "vow": if ((e.text || "").includes("swears a vow")) add(e.actor, "swear"); break;   // W4.6: declarations are public — the declarer speaks the oath (breaches and taxes stay silent)
      }
      return out;
    }

    function lines(s, { from = 0, to = s.log.length } = {}) {
      const ctx = { lf: {}, lastActor: null };
      const found = [], seenCut = new Set();
      for (let i = 0; i < to; i++) {
        const e = s.log[i];
        const cands = candidates(s, e, ctx);              // run from 0 so thresholds are exact
        if (i >= from) for (const c of cands) {
          if (CUTSCENE.has(c.event)) { const k = c.actor + ":" + c.event; if (seenCut.has(k)) continue; seenCut.add(k); }
          found.push({ ...c, logIndex: i });
        }
      }
      // encounter: the first enemy in turn order greets once, at the start of the battle;
      // a cutscene-capable ally (the Magistrate on your side) greets too
      if (from === 0) {
        const first = (s.order || []).map((id) => s.actors[id]).find((a) => a && a.side === "enemy" && canSpeak(a));
        if (first) found.push({ actor: first.id, event: "encounter", logIndex: 0 });
        const ally = (s.order || []).map((id) => s.actors[id]).find((a) => a && a.side === "player" && !a.defeated && isCutsceneCapable(speakerId(a)) && ownLines(speakerId(a), "encounter").length);
        if (ally) found.push({ actor: ally.id, event: "encounter", logIndex: 0 });
      }
      const seedBase = `${s.seed ?? 0}`;
      const gated = found.filter((c) => !(c.event in CHANCE) || hash(`${seedBase}:${c.logIndex}:${c.actor}:${c.event}:gate`) < CHANCE[c.event]);
      gated.sort((p, q) => PRIORITY[q.event] - PRIORITY[p.event] || p.logIndex - q.logIndex);
      const chosen = [], spoke = new Set();
      for (const c of gated) {
        if (spoke.has(c.actor)) continue;
        spoke.add(c.actor); chosen.push(c);
        if (chosen.length >= maxPerCall) break;
      }
      return chosen.sort((p, q) => p.logIndex - q.logIndex).map((c) => {
        const a = s.actors[c.actor], id = speakerId(a);
        const r = c.event === "quote" ? { text: s.log[c.logIndex]?.quote || "", fallback: false } : dialogue(a).say(c.event, { seed: `${seedBase}:${c.logIndex}:${c.actor}:${c.event}` });
        const faces = speakers.speakers[id]?.faces;
        return { actor: c.actor, name: a.name, speaker: id, heads: a.sprite || null, event: c.event, text: r.text, logIndex: c.logIndex, fallback: r.fallback, face: faces ? (faces[c.event] || "neutral") : null };
      });
    }

    return { lines, candidates, priority: PRIORITY, chance: CHANCE };
  }

  return { create };
});
