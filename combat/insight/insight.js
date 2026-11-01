"use strict";
// Observe / insight rules. Pure and seeded.
//
//   buildDeck(subject, { seed })            subject = { key, kind: "character"|"dream"|"monster"|"summon" }
//                                           → hidden observations generated when the character spawns
//   spawnKnowledge(deck)                    → what is noticed at once (open traits; everything if honest)
//   observe({ deck, know, cognitive, subjectKey, invest, inDreamSpace, seed })
//                                           → { know, cognitive, revealed, unlocked, lines }
//   actionsFor({ deck, know, subject, snapshot }) → insight actions available against this subject now
//   resolveAction(id, { subject, snapshot, seed }) → { outcome, effects, text }
//   emptyCognitive() / familiarity(cog, subjectKey, obs) / summarize(cog)
//
// Observing works like a strike: invest 10–50 AP; every 10 AP is 1 insight point. Points reveal hidden
// observations cheapest first; leftover points carry to the next observe of the same subject ("prolonged
// eye contact"). Difficulty drops with familiarity: noticing something on this subject before (up to −2)
// and noticing that kind of thing on anyone (up to −1). That memory is the cognitive inventory.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./insight-data.js"));
  else root.ConceptCombatInsight = factory(root.ConceptCombatInsightData);
})(typeof self !== "undefined" ? self : this, function (ID) {
  const R = ID.rules;
  function roll(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const pick = (r, table) => { let x = r; for (const [k, p] of table) { if ((x -= p) < 0) return k; } return table[table.length - 1][0]; };

  // What kind of thing an observation is, for familiarity that carries across characters.
  function kindKey(o) {
    if (o.kind === "trait") return "trait:" + o.trait;
    if (o.kind === "weakness") return "weakness:" + o.channel;
    if (o.kind === "realization" || o.kind === "state") return `${o.kind}:${o.sourceId || "x"}`;
    if (o.kind === "key") return `key:${o.sourceId || o.id || "x"}`;
    return o.kind;
  }
  // Boss keys (Muse-2): is this key's window live right now? Pure state read (hover + AI share it).
  function keyLive(s, subjectId, card) {
    const u = s.actors[subjectId], when = card.window?.when || "always";
    if (!u || u.defeated) return false;
    if (when === "always") return true;
    if (when === "belowHalfLF") return u.lf < u.maxLF / 2;
    if (when === "enraged") return !!u.conditions?.enraged;
    return true;
  }

  // Supers: two of four powers, plus one critical weakness (25%: a second, from a different category). Seeded per spawn.
  const SUPER_POWERS = ["superStrength", "superSpeed", "superDurability", "superHealing"];
  const SUPER_WEAKNESSES = [["weakToNigredo", "weakToAlbedo", "weakToCitrinitas", "weakToRubedo"], ["sinksLikeAStone"], ["dreamFragile"], ["supernaturalWeakness"]];
  function superDraw(key, seed) {
    const powers = SUPER_POWERS.slice(), out = [];
    for (let i = 0; i < 2; i++) out.push(powers.splice(Math.floor(roll(seed, `${key}:super:${i}`) * powers.length), 1)[0]);
    const cats = SUPER_WEAKNESSES.map((c, i) => i), n = roll(seed, `${key}:weak:extra`) < 0.25 ? 2 : 1;
    for (let i = 0; i < n; i++) { const c = cats.splice(Math.floor(roll(seed, `${key}:weak:${i}`) * cats.length), 1)[0]; const opts = SUPER_WEAKNESSES[c]; out.push(opts[Math.floor(roll(seed, `${key}:weakpick:${i}`) * opts.length)]); }
    return out;
  }
  // Genius learning (Mala, 2026-10-08): a genius who WITNESSES a technique has a small chance to learn it on the spot.
  // Never an ultimate or a class-locked move; at most GENIUS.cap per battle; seeded, so replays agree.
  const GENIUS = { chance: 0.15, cap: 2 };
  function geniusLearns({ observer, ability, def, seed = 0, round = 0, alreadyHas = [] }) {
    const traits = (observer.traits || []).map((t) => (typeof t === "string" ? t : t?.id));
    if (!traits.includes("genius") || !def || def.tier === "ultimate" || def.pairs || def.merge) return false;
    if (alreadyHas.includes(ability) || (observer.learned || []).length >= GENIUS.cap) return false;
    return roll(seed, `genius:${observer.id}:${ability}:${round}`) < GENIUS.chance;
  }
  function profileFor(subject, seed = 0) {
    if (subject.kind === "summon") return ID.profiles["summon:*"];
    let profile = ID.profiles[subject.key] || { traits: [], obs: [] };
    if (profile.superVariants) profile = { ...profile, traits: [...profile.traits, ...superDraw(subject.key, seed)] };
    // Traits anyone can spawn with (insight-data.js spawnTraits): rolled per character key and battle seed.
    if ((subject.kind || "character") === "character" && ID.spawnTraits?.length) {
      const rolled = ID.spawnTraits.filter(([t, p]) => !profile.traits.includes(t) && roll(seed, `${subject.key}:spawn:${t}`) < p * dreamOdds(profile, t)).map(([t]) => t);
      if (rolled.length) profile = { ...profile, traits: [...profile.traits, ...rolled] };
    }
    // One value and one bodily quirk (insight-data.js valueSpawn, biologySpawn): a single draw each.
    // Spirit is drawn last (below), after belief settles, so contemplatives and full believers roll hotter.
    if ((subject.kind || "character") === "character") for (const [key, table] of [["value", ID.valueSpawn], ["biology", ID.biologySpawn], ["temper", ID.temperSpawn], ["focus", ID.focusSpawn]]) {
      if (!table?.length || profile.traits.some((t) => table.some(([id]) => id === t))) continue;
      let cursor = roll(seed, `${subject.key}:spawn:${key}`);
      for (const [t, p] of table) { if (cursor < p) { profile = { ...profile, traits: [...profile.traits, t] }; break; } cursor -= p; }
    }
    // Belief (insight-data.js beliefSpawn): one exclusive draw for anyone whose profile does not already state a belief.
    if ((subject.kind || "character") === "character" && ID.beliefSpawn?.length && !profile.beliefVariants?.length
      && !profile.traits.some((t) => ID.beliefTraits.includes(t)) && !(profile.chanceTraits || []).some(([t]) => ID.beliefTraits.includes(t))) {
      let cursor = roll(seed, `${subject.key}:spawn:belief`);
      for (const [t, p] of ID.beliefSpawn) { if (cursor < p) { profile = { ...profile, traits: [...profile.traits, t] }; break; } cursor -= p; }
    }
    if (profile.chanceTraits) profile = { ...profile, traits: [...profile.traits, ...profile.chanceTraits.filter(([t, p], i) => !profile.traits.includes(t) && roll(seed, `${subject.key}:chance:${t}:${i}`) < p * dreamOdds(profile, t)).map(([t]) => t)] };   // not twice: it may already have come from the pool anyone rolls
    // The other half of the Curious / Imaginative pull: imagination makes people curious.
    { const G = ID.imagination; if (G && (subject.kind || "character") === "character" && profile.traits.includes(G.trait) && !profile.traits.includes("curious")
        && roll(seed, `${subject.key}:synergy:curious`) < G.curiousChance) profile = { ...profile, traits: [...profile.traits, "curious"] }; }
    if (!profile.beliefVariants?.length) return spiritRoll(profile);
    const variant = pick(roll(seed, `${subject.key}:belief-strength`), [["believer", 0.6], ["devoutBeliever", 0.25], ["fullBeliever", 0.15]]);
    return spiritRoll({ ...profile, traits: [...profile.traits, variant] });
    // Astral presence, drawn last: the certain hold it outright, everyone else rolls odds set by what
    // they are (same seed label as the old table draw, so base-odds seeds behave as before).
    function spiritRoll(prof) {
      if ((subject.kind || "character") !== "character" || prof.traits.includes("astralPresence")) return prof;
      if ((ID.spiritCertain || []).includes(subject.key)) return { ...prof, traits: [...prof.traits, "astralPresence"] };
      const odds = prof.traits.includes("fullBeliever") ? ID.spiritOdds.fullBeliever
        : prof.traits.includes("contemplative") ? ID.spiritOdds.contemplative : ID.spiritOdds.base;
      return roll(seed, `${subject.key}:spawn:spirit`) < odds ? { ...prof, traits: [...prof.traits, "astralPresence"] } : prof;
    }
  }
  // A Curious character rolls Imaginative more easily (insight-data.js imagination.curiousMul).
  function dreamOdds(profile, t) { const G = ID.imagination; return G && t === G.trait && profile.traits.includes("curious") ? G.curiousMul : 1; }
  // Trait registry helpers (T1). imitable: psychology and values only. dynamicsOf: counters and synergies, read from both sides.
  const imitable = (id) => ["psychology", "values"].includes(ID.traits[id]?.category);
  function dynamicsOf(id) {
    const own = ID.traitDynamics[id] || {}, counters = new Set(own.counters || []), synergies = new Set(own.synergies || []);
    for (const [other, d] of Object.entries(ID.traitDynamics)) { if ((d.counters || []).includes(id)) counters.add(other); if ((d.synergies || []).includes(id)) synergies.add(other); }
    return { counters: [...counters], synergies: [...synergies] };
  }
  function profileTraitIds(characterKey, seed = 0) { return profileFor({ key: characterKey, kind: "character" }, seed).traits.slice(); }
  function combatModsForTraits(traits = []) {
    const catalog = new Map(ID.self.catalog.map((t) => [t.id, t]));
    const mods = { abilityDamageMul: 1, ultimateChargeMul: 1 };
    let beliefStrength = 0;
    let summonDamageDealtMul = 1, summonDamageTakenMul = 1, rareMonsterSummon = false, uncontrolledDreamSummons = false;
    const extra = {};
    for (const item of traits) {
      const id = typeof item === "string" ? item : item?.id;
      const effect = ID.traits[id]?.combat || catalog.get(id)?.combat;
      if (!effect) continue;
      mods.abilityDamageMul *= effect.abilityDamageMul || 1;
      mods.ultimateChargeMul *= effect.ultimateChargeMul || 1;
      beliefStrength = Math.max(beliefStrength, effect.beliefStrength || 0);
      summonDamageDealtMul *= effect.summonDamageDealtMul || 1;
      summonDamageTakenMul *= effect.summonDamageTakenMul || 1;
      rareMonsterSummon ||= !!effect.rareMonsterSummon;
      if (effect.extra) for (const [k, v] of Object.entries(effect.extra)) {   // passive effects carried by a trait (Supers)
        if (k === "channelDamageMul") { extra.channelDamageMul ||= {}; for (const [c, m] of Object.entries(v)) extra.channelDamageMul[c] = (extra.channelDamageMul[c] || 1) * m; }
        else extra[k] = typeof v === "number" && typeof extra[k] === "number" ? extra[k] + v : v;
      }
      uncontrolledDreamSummons ||= !!effect.uncontrolledDreamSummons;
    }
    mods.abilityDamageMul = Math.max(0.8, Math.min(1.2, mods.abilityDamageMul));
    mods.ultimateChargeMul = Math.max(0.7, Math.min(1.3, mods.ultimateChargeMul));
    if (beliefStrength) { mods.beliefStrength = beliefStrength; mods.rareMonsterSummon = true; }
    summonDamageDealtMul = Math.max(1, Math.min(1.5, summonDamageDealtMul));
    summonDamageTakenMul = Math.max(0.5, Math.min(1, summonDamageTakenMul));
    if (summonDamageDealtMul !== 1) mods.summonDamageDealtMul = summonDamageDealtMul;
    if (summonDamageTakenMul !== 1) mods.summonDamageTakenMul = summonDamageTakenMul;
    if (rareMonsterSummon) mods.rareMonsterSummon = true;
    if (Object.keys(extra).length) mods.extra = extra;
    if (uncontrolledDreamSummons) mods.uncontrolledDreamSummons = true;
    return mods;
  }
  function publicProfileTraits(characterKey, seed = 0) { return profileTraitIds(characterKey, seed).filter((id) => ID.traits[id]?.open); }
  function relationshipBetweenCharacters(first, second) {
    const a = publicProfileTraits(first), b = publicProfileTraits(second), shared = a.filter((id) => b.includes(id));
    const tension = ID.self.relationships.filter((edge) => edge.weight < 0 &&
      ((a.includes(edge.from) && b.includes(edge.to)) || (b.includes(edge.from) && a.includes(edge.to))));
    return { shared, tension };
  }

  // A seer notices soul traits; anyone else never does (Mala, 2026-10-24). The sight itself is
  // planned: the first trait carrying `seesSpirits: true` lights this up. Nothing holds it yet.
  const seesSpirits = (viewer) => (viewer?.traits || []).some((t) => ID.traits[typeof t === "string" ? t : t?.id]?.seesSpirits);
  function buildDeck(subject, { seed = 0 } = {}) {
    const p = profileFor(subject, seed);
    const deck = [];
    p.traits.forEach((t) => {
      const T = ID.traits[t];
      const spiritual = T.category === "spiritual";
      deck.push({ id: `${subject.key}:trait:${t}`, kind: "trait", trait: t, text: `${T.name}: ${T.text}`, open: !!T.open && !spiritual, difficulty: T.open && !spiritual ? 0 : T.difficulty, spiritual, unlocks: T.unlocks || [] });
    });
    p.obs.forEach((o, i) => deck.push({ ...o, sourceId: o.id, id: `${subject.key}:${o.kind}:${o.id || i}`, open: false, unlocks: o.unlocks || ID.kinds[o.kind]?.unlocks || [] }));
    const mods = p.traits.map((t) => ID.traits[t].deck || {});
    if (mods.some((m) => m.extra)) ID.complexExtras.forEach((o, i) => deck.push({ ...o, sourceId: o.id, id: `${subject.key}:extra:${i}`, open: false, unlocks: o.unlocks || ID.kinds[o.kind]?.unlocks || [] }));
    const add = mods.reduce((n, m) => n + (m.allDifficulty || 0), 0);
    const revealAll = mods.some((m) => m.revealAll);
    for (const o of deck) {
      if (revealAll && !o.spiritual) { o.difficulty = 0; o.open = o.kind !== "realization" ? true : o.open; }
      else if (!o.open) o.difficulty += add;
      o.key = kindKey(o);
      o.tie = roll(seed, o.id);
    }
    return { subject: { key: subject.key, kind: subject.kind }, cards: deck };
  }

  function spawnKnowledge(deck) {
    return { revealed: deck.cards.filter((o) => o.open).map((o) => o.id), progress: 0, invested: 0 };
  }

  function emptyCognitive() { return { version: 1, subjects: {}, kinds: {} }; }
  function familiarity(cog, subjectKey, o) {
    const s = cog?.subjects?.[subjectKey]?.[o.key] || 0, k = cog?.kinds?.[o.key] || 0;
    return Math.min(R.familiarity.subjectCap, Math.floor(Math.log2(1 + s))) + Math.min(R.familiarity.kindCap, Math.floor(Math.log2(1 + k) / 2));
  }
  function recordNotice(cog, subjectKey, o) {
    const c = cog || emptyCognitive();
    const subj = { ...(c.subjects[subjectKey] || {}) }; subj[o.key] = (subj[o.key] || 0) + 1;
    return { ...c, subjects: { ...c.subjects, [subjectKey]: subj }, kinds: { ...c.kinds, [o.key]: (c.kinds[o.key] || 0) + 1 } };
  }
  const effectiveDifficulty = (cog, subjectKey, o) => Math.max(0, o.difficulty - familiarity(cog, subjectKey, o));

  // demonstrated: trait ids the subject has shown in how it acts this battle (engine.js C10); each is `demonstratedBonus` easier to find.
  // shared: difficulty taken off by a Scout's report on this subject. It stacks with the observer's own familiarity but
  // the two together stay inside the familiarity caps.
  function observe({ deck, know, cognitive, subjectKey, invest, inDreamSpace = false, seed = 0, demonstrated = [], demonstratedBonus = 1, visualPointBonus = 0, shared = 0, focusPointBonus = 0, dreamerPointBonus = 0, seesSpirits: seer = false }) {
    const O = R.observe;
    if (invest < O.minAP || invest > O.maxAP) return { know, cognitive, revealed: [], unlocked: [], lines: [`Observe takes ${O.minAP}–${O.maxAP} AP.`], error: true };
    const dreamBonus = inDreamSpace && deck.subject.kind === "dream" ? R.dreamSpacePointBonus + dreamerPointBonus : 0;   // TP-02: the dreamer's own attunement (modsFor dreamObservePointBonus) lands on top of the +1 every occupant gets
    let points = Math.floor(invest / O.apPerPoint) + know.progress + dreamBonus + focusPointBonus;   // Perfect Concentration: +1
    const hidden = deck.cards.filter((o) => !know.revealed.includes(o.id) && (!o.spiritual || seer))
      .map((o) => ({ o, d: Math.max(0, (shared ? Math.max(0, o.difficulty - Math.min(R.familiarity.subjectCap + R.familiarity.kindCap, familiarity(cognitive, subjectKey, o) + shared)) : effectiveDifficulty(cognitive, subjectKey, o)) - (o.kind === "trait" && demonstrated.includes(o.trait) ? demonstratedBonus : 0)) }))
      .sort((a, b) => a.d - b.d || a.o.tie - b.o.tie);
    const revealed = [];
    let cog = cognitive || emptyCognitive();
    for (const { o, d } of hidden) {
      if (points < d) break;                           // cheapest first; the rest waits for more looking
      points -= d; revealed.push(o);
    }
    // 20/20 Vision adds a bounded visual point, never effort toward a belief, hidden value or realization.
    // Use it after ordinary observation; the unused bonus cannot turn into generic carry-over points.
    const visual = Math.min(O.twentyTwentyBonus, Math.max(0, visualPointBonus));
    const extra = visual > 0 && hidden.find(({ o, d }) => !revealed.includes(o) && d > points && d <= points + visual
      && (o.kind === "tell" || (o.kind === "trait" && ID.traits[o.trait]?.category === "biology")));
    if (extra) { points = Math.max(0, points - extra.d); revealed.push(extra.o); }
    // everything noticed (newly or again) strengthens the cognitive inventory
    for (const o of revealed) cog = recordNotice(cog, subjectKey, o);
    const leftover = Math.min(O.carryCap, points);
    const before = new Set(actionsUnlockedBy(deck, know.revealed));
    const k2 = { revealed: [...know.revealed, ...revealed.map((o) => o.id)], progress: hidden.length > revealed.length ? leftover : 0, invested: know.invested + invest };
    const unlocked = actionsUnlockedBy(deck, k2.revealed).filter((a) => !before.has(a));
    const lines = revealed.length ? revealed.map((o) => `You notice: ${o.text}`) : ["Nothing new yet. Keep looking: the effort carries over."];
    if (extra) lines.push("20/20 Vision: a fine visual detail brings one more observation into focus.");
    for (const a of unlocked) lines.push(`New action: ${ID.actions[a].name}`);
    if (hidden.length > revealed.length && revealed.length) lines.push("There's more to see.");
    return { know: k2, cognitive: cog, revealed, unlocked, lines };
  }

  // Investigate (spec INVESTIGATE.md): the whole rest of a turn on one subject. Same deck, same difficulty maths and the
  // same trait bonuses as observe(); only the order (deepest first, an optional focus kind before the rest), the depth
  // bonus and the carry cap differ. Points are spent greedily: a card that does not fit is skipped, a cheaper one may still fit.
  function investigate({ deck, know, cognitive, subjectKey, ap, name = "the subject", focusKind = null, demonstrated = [], demonstratedBonus = 1, visualPointBonus = 0, shared = 0, focusPointBonus = 0, directorsVision = false, seesSpirits: seer = false }) {
    const V = R.investigate, O = R.observe;
    if (!(ap >= V.minAP)) return { know, cognitive, revealed: [], unlocked: [], lines: [`Investigate needs at least ${V.minAP} AP.`], error: `Investigate needs at least ${V.minAP} AP.` };
    const hidden = deck.cards.filter((o) => !know.revealed.includes(o.id) && (!o.spiritual || seer))
      .map((o) => ({ o, d: Math.max(0, (shared ? Math.max(0, o.difficulty - Math.min(R.familiarity.subjectCap + R.familiarity.kindCap, familiarity(cognitive, subjectKey, o) + shared)) : effectiveDifficulty(cognitive, subjectKey, o)) - (o.kind === "trait" && demonstrated.includes(o.trait) ? demonstratedBonus : 0)) }));
    if (!hidden.length) return { know, cognitive, revealed: [], unlocked: [], lines: [`There is nothing left in ${name} you can find.`], error: `There is nothing left in ${name} you can find.`, empty: true };
    const focus = (o) => (focusKind && (o.kind === focusKind) ? 0 : 1);
    hidden.sort((a, b) => focus(a.o) - focus(b.o) || b.d - a.d || a.o.tie - b.o.tie);
    const total = Math.floor(ap / O.apPerPoint) + V.depthBonus + know.progress + focusPointBonus + (directorsVision ? V.directorsVisionPoints : 0);
    let points = total;
    const revealed = [];
    let cog = cognitive || emptyCognitive();
    for (const { o, d } of hidden) { if (points >= d) { points -= d; revealed.push(o); } }
    const visual = Math.min(O.twentyTwentyBonus, Math.max(0, visualPointBonus));
    const extra = visual > 0 && hidden.find(({ o, d }) => !revealed.includes(o) && d > points && d <= points + visual
      && (o.kind === "tell" || (o.kind === "trait" && ID.traits[o.trait]?.category === "biology")));
    if (extra) { points = Math.max(0, points - extra.d); revealed.push(extra.o); }
    for (const o of revealed) cog = recordNotice(cog, subjectKey, o);
    const leftover = Math.min(V.carryCap, points);
    const before = new Set(actionsUnlockedBy(deck, know.revealed));
    const more = hidden.length > revealed.length;
    const k2 = { revealed: [...know.revealed, ...revealed.map((o) => o.id)], progress: more ? leftover : 0, invested: know.invested + ap };
    const unlocked = actionsUnlockedBy(deck, k2.revealed).filter((a) => !before.has(a));
    const lines = [`You investigate ${name} deeply (${total} points):`];
    if (revealed.length) for (const o of revealed) lines.push(`You notice: ${o.text}`);
    else lines.push(`Nothing surfaced, but you are closer: ${k2.progress} carried.`);
    if (extra) lines.push("20/20 Vision: a fine visual detail brings one more observation into focus.");
    for (const a of unlocked) lines.push(`New action: ${ID.actions[a].name}`);
    if (more && revealed.length) lines.push("There's more to see.");
    return { know: k2, cognitive: cog, revealed, unlocked, lines, points: total };
  }

  function actionsUnlockedBy(deck, revealedIds) {
    const out = new Set();
    for (const o of deck.cards) if (revealedIds.includes(o.id)) for (const a of o.unlocks || []) out.add(a);
    return [...out];
  }

  // Allies within the frighten model's radius, from the snapshot (snapshot.alliesNear[id]) or by position.
  function alliesNear(subject, snapshot) {
    if (snapshot?.alliesNear && subject.id in snapshot.alliesNear) return snapshot.alliesNear[subject.id];
    const M = ID.actions.frighten.model;
    return (snapshot?.units || []).filter((u) => u.id !== subject.id && u.side === subject.side && !u.defeated && (u.lf ?? 1) > 0
      && Math.abs(u.x - subject.x) + Math.abs(u.y - subject.y) <= M.allyRadius).length;
  }
  const hpFrac = (s) => (s.lf != null && s.maxLF ? s.lf / s.maxLF : 1);
  // "Afraid" is rare: badly hurt AND alone.
  const afraidNow = (subject, snapshot) => hpFrac(subject) <= ID.actions.frighten.model.afraidAt && alliesNear(subject, snapshot) === 0;
  // Chance that Frighten lands at all (shown in the menu before you commit).
  function frightenChance(subject, snapshot, deck) {
    const M = ID.actions.frighten.model, n = alliesNear(subject, snapshot), hurt = 1 - hpFrac(subject);
    const skittish = deck?.cards.some((o) => o.kind === "trait" && o.trait === "skittish");
    const resist = (deck?.cards || []).reduce((sum, o) => sum + (o.kind === "trait" ? ID.traits[o.trait]?.fearResist || 0 : 0), 0);   // Courageous
    const p = M.base + M.hurtWeight * hurt * hurt + (n === 0 ? M.aloneBonus : -M.perAllyPenalty * n) + (skittish ? M.skittishBonus : 0) - resist;
    return Math.max(M.min, Math.min(M.max, p));
  }

  function actionsFor({ deck, know, subject, snapshot = {} }) {
    const ids = actionsUnlockedBy(deck, know.revealed);
    if (subject?.mindBroken && (subject?.willpower ?? 1) <= 0 && subject?.convertChecked !== subject?.mindBroken.round) ids.push("convertBond", "convertTruth", "convertLoop", "convertEdit");   // W1.4: state-gated, not observation-gated
    return ids.filter((a) => {
      if (a === "frighten") return true;
      if (a === "holdGaze") return deck.subject.kind === "dream";
      if (a === "coordinate") return deck.subject.kind === "summon";
      if (a === "threatenAlly") return (snapshot.alliesOf?.[subject.id] || []).length > 0;
      if (a === "omen") return (snapshot.wild || []).length > 0 || !!snapshot.fire;
      if (a === "bribe") return (snapshot.playerSeeds ?? 0) >= ID.actions.bribe.price.seeds;
      return true;
    }).map((a) => ({ id: a, ...ID.actions[a], ...(a === "frighten" ? { chance: Math.round(frightenChance(subject, snapshot, deck) * 100) / 100 } : {}) }));
  }

  // What a Persuasive speaker adds to the chance of a talk-based action (0 for anyone else, or any other action).
  function persuasiveAdd(u, action) {
    const P = ID.traits.persuasive?.speech; if (!P || !P.actions.includes(action)) return 0;
    return (u?.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === "persuasive") ? P.chanceAdd : 0;
  }
  function resolveAction(id, { subject, snapshot = {}, seed = 0, deck, actor = null }) {
    const A = ID.actions[id]; if (!A) return { outcome: "none", effects: [], text: "Unknown action." };
    const sway = persuasiveAdd(actor, id);   // success is the first row of every outcome table, so lowering the roll by `sway` adds that much to it
    const r = roll(seed, `${subject.id}:${id}:${snapshot.round ?? 0}`);
    const guarded = deck?.cards.some((o) => o.kind === "trait" && o.trait === "guarded");
    let outcome = "done", effects = [];
    switch (id) {
      case "frighten": {
        const M = A.model, chance = Math.min(0.95, frightenChance(subject, snapshot, deck) + sway);
        outcome = r >= chance ? "nothing" : pick(roll(seed, `${subject.id}:frighten:how:${snapshot.round ?? 0}`), afraidNow(subject, snapshot) ? M.onSuccess.afraidNow : M.onSuccess.otherwise);
        effects = outcome === "cower" ? [{ kind: "apLoss", target: subject.id, fraction: 1, when: "nextTurn" }]
          : outcome === "flee" ? [{ kind: "leaveBattle", target: subject.id, reason: "fled in fear" }]
          : outcome === "halfAP" ? [{ kind: "apLoss", target: subject.id, fraction: 0.5, when: "nextTurn" }] : [];
        break;
      }
      case "talk": outcome = pick(Math.max(0, r - sway), guarded ? A.outcomes.guarded : A.outcomes.base); if (outcome === "standDown") effects = [{ kind: "standDown", target: subject.id, rounds: A.effect.standDownRounds }]; break;
      case "befriend": outcome = pick(Math.max(0, r - sway), A.outcomes.base); if (outcome === "truce") effects = [{ kind: "truce", target: subject.id, rounds: A.effect.truceRounds }]; break;
      case "bribe": effects = [{ kind: "spendSeeds", amount: A.price.seeds }, { kind: "leaveBattle", target: subject.id, reason: "bribed", noXp: true }]; break;
      case "holdGaze": effects = [{ kind: "allegiance", target: subject.id, side: "player", until: "fade" }]; break;
      case "convertBond": case "convertTruth": case "convertLoop": case "convertEdit":
        outcome = "done"; effects = [{ kind: "convert", mode: id.slice(7).toLowerCase(), target: subject.id }]; break;   // W1.4: the flip resolves in the engine (actions.js), where bonds and sides live
      default: effects = [{ kind: id, target: subject.id, ...(A.effect || {}) }];
    }
    const say = { cower: "cowers and does nothing", flee: "runs from the field", halfAP: "hesitates", standDown: "stands down", truce: "lowers its guard toward you", nothing: "doesn't take it" }[outcome];
    return { outcome, effects, text: `${A.name}: ${subject.name || subject.id} ${say || "is affected"}.` };
  }

  // A short list of what this account knows best (for a "what I know" screen).
  function summarize(cog, top = 10) {
    return Object.entries(cog?.kinds || {}).sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, n]) => ({ kind: k, times: n }));
  }

  // ── Observe Self (Johari's window) ───────────────────────────────────────────────────────────────
  //   createSelf({ seed })          → persistent self-knowledge for an account (12 traits; half apparent to others)
  //   johari(self)                  → { open, hidden, blind, unknown } lists of traits
  //   observeSelfCost(self)         → AP: 10 + 40 × share still unknown to you (50 when you know nothing)
  //   observeSelf(self, { ap, chargeAllowed }) → { self, revealed, pane, charge, cost, lines } or { error }
  //   selfTellDifficultyAdd(self, traitId) → +1 for enemy observers once you know that tell of yours
  // Traits are drawn sequentially. For candidate t after selected set S:
  //   w(t|S) = exp(clamp(sum_{s in S} association(s,t), -2, 2))
  //   P(t next) = w(t|S) / sum_remaining w(·|S)
  // Thus unrelated traits retain weight 1, while authored associations shift odds without guaranteeing them.
  function traitWeight(candidate, selected, relationships = ID.self.relationships) {
    const score = relationships.reduce((sum, edge) => sum + (selected.includes(edge.from) && edge.to === candidate ? edge.weight : 0), 0);
    return Math.exp(Math.max(-2, Math.min(2, score)));
  }
  function weightedTraitDraw(seed, index, remaining, selected, relationships) {
    const weighted = remaining.map((trait) => ({ trait, weight: traitWeight(trait.id, selected, relationships) }));
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = roll(seed, `self:draw:${index}`) * total;
    for (const entry of weighted) { cursor -= entry.weight; if (cursor < 0) return entry.trait; }
    return weighted[weighted.length - 1].trait;
  }
  function relationshipHint(trait, knownIds, relationships = ID.self.relationships) {
    return relationships.filter((edge) => edge.from === trait.id && !knownIds.has(edge.to) && edge.clue)
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))[0]?.clue || null;
  }
  function createSelf({ seed = 0, catalogAdditions = [] } = {}) {
    const S = ID.self;
    const catalog = [...S.catalog, ...catalogAdditions.filter(t => !S.catalog.some(x => x.id === t.id))];
    const remaining = [...catalog], picks = [];
    while (remaining.length && picks.length < S.traitsPerCharacter) {
      const picked = weightedTraitDraw(seed, picks.length, remaining, picks.map((t) => t.id), S.relationships);
      picks.push(picked);
      remaining.splice(remaining.findIndex((t) => t.id === picked.id), 1);
    }
    const traits = picks.map((t) => ({ ...t, apparent: roll(seed, "apparent:" + t.id) < S.apparentShare, known: false }));
    return { version: 2, seed, traits };   // a new self knows nothing of itself: you discover yourself (Mala, 2026-10-15)
  }
  function johari(self) {
    const pane = (t) => (t.known ? (t.apparent ? "open" : "hidden") : (t.apparent ? "blind" : "unknown"));
    const out = { open: [], hidden: [], blind: [], unknown: [] };
    for (const t of self.traits) out[pane(t)].push(t);
    return out;
  }
  function observeSelfCost(self) {
    const C = ID.self.cost, unknownShare = self.traits.filter((t) => !t.known).length / self.traits.length;
    return Math.round(C.minAP + (C.maxAP - C.minAP) * unknownShare);
  }
  function observeSelf(self, { ap = 100, chargeAllowed = true } = {}) {
    const cost = observeSelfCost(self), w = johari(self);
    const next = [...w.blind].sort((a, b) => a.depth - b.depth)[0] || [...w.unknown].sort((a, b) => a.depth - b.depth)[0];
    if (!next) return { self, revealed: null, charge: 0, cost: 0, lines: ["You know yourself as well as you can for now."], done: true };
    if (ap < cost) return { self, revealed: null, charge: 0, cost, lines: [`Looking at yourself takes ${cost} AP right now.`], error: true };
    const pane = next.apparent ? "blind" : "unknown", C = ID.self.charge[pane];
    const charge = chargeAllowed ? C.base + C.perDepth * next.depth : 0;
    const s2 = { ...self, traits: self.traits.map((t) => (t.id === next.id ? { ...t, known: true } : t)) };
    const lines = [pane === "blind" ? `A blind spot: others could already see it. ${next.name}: ${next.text}` : `Something no one saw, you included. ${next.name}: ${next.text}`,
      chargeAllowed ? `+${charge} ultimate charge` : "The Dream Space holds your charge still: no ultimate charge gained."];
    const hint = relationshipHint(next, new Set(s2.traits.filter((t) => t.known).map((t) => t.id)));
    if (hint) lines.push(`Possible connection: ${hint} This shifts the odds, not a guarantee.`);
    return { self: s2, revealed: next, pane, charge, cost, lines, nextCost: observeSelfCost(s2) };
  }
  function selfTellDifficultyAdd(self, traitId) {
    const t = self?.traits.find((x) => x.id === traitId);
    return t && t.known && t.kind === "tell" ? ID.self.knownTellObserverDifficultyAdd : 0;
  }

  // Contagious ideas (insight-data.js contagiousIdeas). Odds: base ± sway for a swayed or unmoved temperament, + persuasive
  // speaker, clamped 5-95%. Eligible: not already holding the idea, its anti-trait or a gating trait, and not yet exposed
  // to this idea this battle. Faith's anti (nonBeliever) does not gate it: skeptics are its audience.
  const holdsTrait = (u, id) => (u?.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === id);
  function ideaOdds(ideaId, listener, speaker = null) {
    const I = ID.contagiousIdeas?.[ideaId]; if (!I) return 0;
    const p = I.base + (I.swayed.some((k) => holdsTrait(listener, k)) ? I.sway : 0) - (I.unmoved.some((k) => holdsTrait(listener, k)) ? I.sway : 0) + (holdsTrait(speaker, "persuasive") ? I.persuasiveAdd : 0);
    return Math.max(0.05, Math.min(0.95, p));
  }
  function ideaCarrier(ideaId, speaker) {
    const I = ID.contagiousIdeas?.[ideaId];
    return !!I && I.carriers.some((k) => holdsTrait(speaker, k)) && (!I.carrierAlso || holdsTrait(speaker, I.carrierAlso));
  }
  function ideaEligible(ideaId, listener) {
    const I = ID.contagiousIdeas?.[ideaId]; if (!I || !listener) return false;
    if (listener.heardIdeas?.[ideaId]) return false;
    if (I.idea !== "beliefEvidence" && holdsTrait(listener, I.idea)) return false;
    if (I.anti && I.idea !== "beliefEvidence" && holdsTrait(listener, I.anti)) return false;
    return !(I.gate || []).some((k) => holdsTrait(listener, k));
  }

  return { ideaOdds, ideaCarrier, ideaEligible, geniusLearns, GENIUS, superDraw, createSelf, johari, observeSelfCost, observeSelf, selfTellDifficultyAdd, traitWeight, profileTraitIds, imitable, dynamicsOf, publicProfileTraits, relationshipBetweenCharacters, combatModsForTraits, buildDeck, spawnKnowledge, observe, investigate, seesSpirits, actionsFor, resolveAction, persuasiveAdd, emptyCognitive, familiarity, recordNotice, summarize, afraidNow, frightenChance, alliesNear, kindKey, keyLive, data: ID };
});
