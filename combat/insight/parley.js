"use strict";
// Parley (Mala, 2026-10-08): talk your way out of a fight.
//
//   • Talk (an Insight action, unlocked by observing e.g. a Curious target) can make the target stand down.
//   • While someone stands down, "Come to terms" opens: try to agree to end the conflict. It doesn't always work; when
//     they decide it has to be fought, talk is locked between those two for the rest of the battle.
//   • Talkative NPCs talk at the player. A successful talk means the player can't make hostile moves against them for
//     2 turns, and they offer terms the player may accept or decline (declining locks talk, just as their refusal does).
//     Or they distract: the player can only target them. Annoying makes distractions likelier and longer.
//   • Stubborn units resist standing down and coming to terms; Agreeable ones lean in. Persuasive characters (actors,
//     politicians, leaders, lawyers, natural deceivers) talk better.
//   • Come to terms with every enemy left standing → non-lethal victory: Enemy Persuaded.
//
// State lives on s.parley = { locked: {"a|b": round}, holds: {"attacker>target": untilRound}, offers: {npcId: {to, until}},
// lastTalk: {npcId: round} }; persuaded units carry a.persuaded = { with, round }; distracted ones a.distracted = { by, until }.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(() => require("../bonds/bonds.js"));
  else root.ConceptCombatParley = factory(() => root.ConceptCombatBonds);   // bonds.js loads after this file; read it lazily
})(typeof self !== "undefined" ? self : this, function (bonds = () => null) {
  const rules = {
    termsCost: 15,              // AP to try coming to terms with someone standing down
    npcTalkCost: 20, npcTalkRange: 5, npcTalkCooldown: 2,
    npcTalkWant: 0.35, npcTalkWantAnnoying: 0.6,   // chance per turn a talkative NPC opens its mouth instead of fighting
    holdRounds: 2,              // a successful NPC talk: no hostile moves against them for 2 of your turns
    offerRounds: 2,
    distractRounds: 1, distractRoundsAnnoying: 2, annoyingApTax: 10,
  };
  // Class/role characters built for this play (ids that don't exist yet are harmless).
  const PERSUADERS = { actor: 0.15, president: 0.15, pharaoh: 0.1, lawyer: 0.15, politician: 0.15, leader: 0.1, general: 0.1, super_villain: 0.1, detective: 0.05 };
  const SILVER_CONCEPTS = { deception: 0.1, legitimacy: 0.08, reciprocal_obligation: 0.05 };   // natural deceivers, officeholders, dealmakers

  const clamp = (p, lo = 0.05, hi = 0.9) => Math.max(lo, Math.min(hi, p));
  function roll(seed, tag) {
    let h = 2166136261 ^ (seed >>> 0);
    for (const c of String(tag)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const traitsOf = (u) => new Set((u?.traits || []).map((t) => (typeof t === "string" ? t : t?.id)).filter(Boolean));
  const has = (u, t) => traitsOf(u).has(t);
  const name = (u) => u?.name || u?.id || "someone";
  const hp = (u) => (u?.maxLF ? u.lf / u.maxLF : 1);

  const PERSUASIVE = 0.15;   // same number as insight-data.js traits.persuasive.speech.chanceAdd (it was 0.1 before 2026-10-12)
  // How well this unit talks: persuasive trait, a role built for it, concepts that live in persuasion.
  function persuasion(u) {
    let p = (has(u, "persuasive") ? PERSUASIVE : 0) + (PERSUADERS[u?.character] || 0) + (u?.passives?.legitimacyAdd || 0) * 0.03 + (u?.passives?.glamourAdd || 0) * 0.02 + (u?.passives?.fameAdd || 0) * 0.01;   // Fame F1 (FAME.md E1): +0.01 a level; tests pin 0.01 to Fame.RULES.persuasionPer; the min(0.3) below stays last   // fine clothes speak (W4.3); awe aids persuasion until W2.1 Presence gives it its own checks
    let c = 0; for (const k of [u?.primary, u?.secondary]) c = Math.max(c, SILVER_CONCEPTS[k] || 0);
    if (has(u, "humanExperience")) return Math.min(0.5, p + c + 0.2);   // the Human Experience argues 20% better, past the usual cap
    return Math.min(0.3, p + c);
  }
  // The same sum as persuasion(), part by part, for the hover card's Persuasion breakdown (FAME.md E1;
  // loop 1a19d25e688). Keys name the source so the card can gate each part on what the viewer knows.
  // The arithmetic mirrors persuasion() exactly: total === persuasion(u), always.
  function persuasionBreakdown(u) {
    const parts = [];
    const pv = has(u, "persuasive") ? PERSUASIVE : 0; if (pv) parts.push({ key: "persuasive", value: pv });
    const rv = PERSUADERS[u?.character] || 0; if (rv) parts.push({ key: "role", ref: u.character, value: rv });
    const lv = (u?.passives?.legitimacyAdd || 0) * 0.03; if (lv) parts.push({ key: "legitimacy", value: lv });
    const gv = (u?.passives?.glamourAdd || 0) * 0.02; if (gv) parts.push({ key: "glamour", value: gv });
    const fv = (u?.passives?.fameAdd || 0) * 0.01; if (fv) parts.push({ key: "fame", value: fv });
    const p = pv + rv + lv + gv + fv;
    let c = 0, ck = null; for (const k of [u?.primary, u?.secondary]) if ((SILVER_CONCEPTS[k] || 0) > c) { c = SILVER_CONCEPTS[k]; ck = k; }
    if (c) parts.push({ key: "concept", ref: ck, value: c });
    const he = has(u, "humanExperience");
    if (he) parts.push({ key: "humanExperience", value: 0.2 });
    const cap = he ? 0.5 : 0.3, total = Math.min(cap, p + c + (he ? 0.2 : 0));
    return { parts, total, capped: p + c + (he ? 0.2 : 0) > cap, cap };
  }
  // Mala: "having low life points might make a conversation more convincing because most people would rather not die,
  // less likely for someone like the Soldier. However this might not be true if you killed someones allies … if you kill
  // two out of three people, the third person might never forgive you and would rather fight to the death."
  const DUTY = { soldier: 0.2, knight: 0.4, samurai: 0.3, policeOfficer: 0.5, mma_fighter: 0.6 };   // how much fear of dying still counts
  const fallenAllies = (s, t) => Object.values(s.actors || {}).filter((u) => u.id !== t.id && u.side === t.side && u.defeated
    && !u.escaped && !u.noXp && !u.persuaded && !u.leaveReason).length;
  function willingness(s, t) {
    const fallen = fallenAllies(s, t), loyal = has(t, "loyal");
    const B = bonds(), friend = B && Object.values(s.actors || {}).find((u) => u.id !== t.id && u.side === t.side && u.defeated && !u.escaped && !u.persuaded && B.maxFriends(t, u));
    if (friend) return { add: 0, unforgiving: true, fallen, note: `${name(t)} will never forgive what happened to ${name(friend)}: they'd rather fight to the end.` };   // max friendship
    if (fallen >= 2 || (fallen >= 1 && loyal)) return { add: 0, unforgiving: true, fallen,
      note: `${name(t)} won't forgive ${fallen === 1 ? "a fallen ally" : `${fallen} fallen allies`}${loyal && fallen === 1 ? " (loyal)" : ""}: they'd rather fight to the end.` };
    const hurt = 1 - hp(t), duty = DUTY[t.character] ?? 1;
    const add = 0.35 * hurt * duty - (fallen ? 0.2 : 0);
    return { add, unforgiving: false, fallen,
      note: [stillFighting(s, t) ? `${stillFighting(s, t)} of their allies still fighting: ×${companyMul(s, t)}` : "", hurt > 0.3 ? `hurt (${Math.round(hp(t) * 100)}% LF)${duty < 1 ? ", but duty outweighs fear" : ": they'd rather not die"}` : "", fallen ? "an ally has fallen: −20%" : ""].filter(Boolean).join("; ") };
  }
  // Mala: "talking down only works if you can speak their language, so trying to talk down a boar wouldnt work, unless
  // you had a speak with animals trait, and most monsters are mindless beasts as well except maybe the vampire but the
  // vampire doesnt see you as an equal so they wouldnt speak with you unless you were an immortal (unlikely)".
  const IMMORTALS = new Set(["bastet"]);   // immortal by nature, whatever traits they drew
  const ANIMALS = new Set(["feralPig", "mutant_boar"]);
  const MINDLESS = new Set(["termites", "gaia", "boss-kaiju"]);
  function speech(u) {
    const monster = u?.monster || u?.dream?.key || (u?.kind === "dreamMonster" ? u.monster : null);
    if (monster === "vampire") return "vampire";
    if (monster || u?.wild || MINDLESS.has(u?.character)) return "mindless";
    if (ANIMALS.has(u?.character)) return "animal";
    return "person";
  }
  // null = they can hold a conversation; otherwise why not.
  function language(a, t) {
    const k = speech(t);
    if (k === "mindless") return `${name(t)} is a mindless thing; there's no one in there to talk to.`;
    if (k === "animal" && !has(a, "speakWithAnimals")) return `${name(t)} is an animal; talking it down needs the Speak with Animals trait.`;
    if (k === "vampire" && !isImmortal(a)) return `The vampire doesn't see ${name(a)} as an equal; it speaks only to immortals.`;
    if (speech(a) !== "person" && k === "person") return `${name(a)} can't speak with people.`;
    return null;
  }
  // Mala: "talk does feel overpowered … the chances should be greatly reduced if multiple enemies are on the field,
  // because you would have to essentially convince them to not help their friends fight you". One-on-one is unchanged.
  const COMPANY = [1, 0.4, 0.2, 0.1];   // × by allies still fighting beside them (0, 1, 2, 3+)
  const stillFighting = (s, t) => Object.values(s.actors || {}).filter((u) => u.id !== t.id && u.side === t.side && !u.defeated
    && !u.notArrived && !u.persuaded).length;
  const companyMul = (s, t) => COMPANY[Math.min(COMPANY.length - 1, stillFighting(s, t))];
  const lean = (u, stubborn, agreeable) => (has(u, "stubborn") ? -stubborn : 0) + (has(u, "agreeable") ? agreeable : 0);

  const key = (a, b) => [a, b].sort().join("|");
  const P = (s) => (s.parley ||= { locked: {}, holds: {}, offers: {}, lastTalk: {} });
  const locked = (s, a, b) => !!s.parley?.locked?.[key(a, b)];
  function lock(s, a, b) { P(s).locked[key(a, b)] = s.round; for (const id of [a, b]) if (s.parley.offers[id]) delete s.parley.offers[id]; }
  const standingDown = (s, u) => !!u?.standDownUntil && u.standDownUntil >= s.round;

  // Chance that Talk makes the subject stand down (replaces the flat 50% / guarded 25%).
  function talkChance(s, observer, subject, guarded = has(subject, "guarded")) {
    if (language(observer, subject)) return 0;
    const w = willingness(s, subject); if (w.unforgiving) return 0;
    return clamp((guarded ? 0.25 : 0.5) + persuasion(observer) + lean(subject, 0.25, 0.2) + w.add) * companyMul(s, subject);
  }
  // Why Talk can't even be tried right now (language, a closed conversation, a grudge), or null.
  function cannotTalk(s, a, t) {
    return language(a, t) || (locked(s, a.id, t.id) ? `${name(t)} decided this has to be fought; talk is closed between you.` : null)
      || (willingness(s, t).unforgiving ? willingness(s, t).note : null);
  }
  function resolveTalk(s, observer, subject, guarded) {
    const w = willingness(s, subject);
    if (w.unforgiving) return { outcome: "nothing", chance: 0, effects: [], text: `Talk: ${w.note}` };
    const p = talkChance(s, observer, subject, guarded), ok = roll(s.seed, `talk:${observer.id}>${subject.id}:${s.round}`) < p;
    return { outcome: ok ? "standDown" : "nothing", chance: p, effects: ok ? [{ kind: "standDown", target: subject.id, rounds: 2 }] : [],
      text: `Talk: ${name(subject)} ${ok ? "stands down" : "doesn't take it"}.` };
  }

  // Come to terms: the player (or anyone) with someone standing down.
  function termsChance(s, a, t) {
    if (language(a, t)) return 0;
    const w = willingness(s, t); if (w.unforgiving) return 0;
    return clamp(0.35 + persuasion(a) + lean(t, 0.3, 0.25) + w.add) * companyMul(s, t);
  }
  function canTerms(s, a, t) {
    if (!t || t.defeated || t.side === a.side) return "There's no one to come to terms with.";
    if (t.persuaded) return `${name(t)} has already come to terms.`;
    const tongue = language(a, t); if (tongue) return tongue;
    if (locked(s, a.id, t.id)) return `${name(t)} decided this has to be fought; talk is closed between you.`;
    if (!standingDown(s, t)) return `${name(t)} isn't standing down; there's nothing to build terms on yet.`;
    const w = willingness(s, t); if (w.unforgiving) return w.note;
    if (a.tempo < rules.termsCost) return `Coming to terms needs ${rules.termsCost} action points.`;
    return null;
  }
  function persuade(s, u, other) {
    u.persuaded = { with: other.id, round: s.round }; u.standDownUntil = 0; u.forceTarget = null;
    if (s.parley) { delete s.parley.offers[u.id]; for (const k of Object.keys(s.parley.holds)) if (k.endsWith(`>${u.id}`)) delete s.parley.holds[k]; }
  }
  function comeToTerms(s, a, t, H) {
    const p = termsChance(s, a, t), w = willingness(s, t), ok = roll(s.seed, `terms:${a.id}>${t.id}:${s.round}`) < p;
    if (ok) {
      persuade(s, t, a);
      H.log(s, { kind: "parley", actor: a.id, target: t.id, text: `${name(a)} and ${name(t)} come to terms. ${name(t)} is out of the fight.`,
        why: [`Chance ${Math.round(p * 100)}%: persuasion, ${name(t)}'s temperament${has(t, "stubborn") ? " (stubborn)" : has(t, "agreeable") ? " (agreeable)" : ""}${w.note ? `; ${w.note}` : ""}.`] });
    } else {
      lock(s, a.id, t.id); t.standDownUntil = 0;
      H.log(s, { kind: "parley", actor: a.id, target: t.id, text: `${name(t)} won't come to terms: "Then we have to fight." Talk is closed between ${name(a)} and ${name(t)} for the rest of the battle.`,
        why: [`Chance was ${Math.round(p * 100)}%.${w.note ? ` ${w.note[0].toUpperCase()}${w.note.slice(1)}.` : ""}`] });
    }
    return ok;
  }

  // Talkative NPCs: whether this turn they talk instead of fighting, and at whom.
  function npcTalkTarget(s, npc, dist, preacher = false) {   // preacher: a believer talks without being talkative (engine/ai.js trait acts)
    if (!(has(npc, "talkative") || preacher) || npc.persuaded || standingDown(s, npc)) return null;
    const last = s.parley?.lastTalk?.[npc.id];
    if (last != null && s.round - last < rules.npcTalkCooldown) return null;
    if (npc.tempo < rules.npcTalkCost) return null;
    const t = Object.values(s.actors).find((u) => u.id === "player" && !u.defeated && u.side !== npc.side);
    if (!t || locked(s, npc.id, t.id) || language(npc, t) || language(t, npc) || dist(s, npc.x, npc.y, t.x, t.y) > rules.npcTalkRange) return null;
    const want = has(npc, "annoying") ? rules.npcTalkWantAnnoying : rules.npcTalkWant;
    return roll(s.seed, `wantTalk:${npc.id}:${s.round}`) < want ? t : null;
  }
  function npcTalkOdds(npc, t) {
    const talk = clamp(0.3 + persuasion(npc) + lean(t, 0.2, 0.15), 0.05, 0.7);
    const distract = clamp((has(npc, "annoying") ? 0.45 : 0.25), 0, 0.9 - talk);
    return { talk, distract };
  }
  function npcTalk(s, npc, t, H) {
    P(s).lastTalk[npc.id] = s.round;
    const { talk, distract } = npcTalkOdds(npc, t), r = roll(s.seed, `npcTalk:${npc.id}>${t.id}:${s.round}`);
    if (r < talk && H.MindDuel) return "talk";   // Mind duel: the handler opens a battle of minds instead of the old hold+offer
    if (r < talk) {
      const holdRounds = has(t, "perfectConcentration") ? (s.rules?.concentration?.perfect?.holdRounds ?? rules.holdRounds) : rules.holdRounds;
      s.parley.holds[`${t.id}>${npc.id}`] = s.round + holdRounds;
      s.parley.offers[npc.id] = { to: t.id, until: s.round + rules.offerRounds };
      H.log(s, { kind: "parley", actor: npc.id, target: t.id, text: `${name(npc)} talks ${name(t)} down: no hostile moves against ${name(npc)} for ${holdRounds} turn${holdRounds === 1 ? "" : "s"}. ${name(npc)} offers to come to terms.`,
        why: ["Accept to end the fight with them (they leave it); decline and talk is closed between you for the rest of the battle."] });
      return "talk";
    }
    if (r < talk + distract) {
      if (has(t, "perfectConcentration")) {   // a perfectly focused mind does not look over
        H.log(s, { kind: "parley", actor: npc.id, target: t.id, text: `${name(npc)} won't stop talking. ${name(t)} does not even look over (Perfect Concentration).` });
        return "nothing";
      }
      const annoying = has(npc, "annoying"), turns = annoying ? rules.distractRoundsAnnoying : rules.distractRounds;
      t.distracted = { by: npc.id, until: s.round + turns };
      if (annoying) t.nextActionCostAdd = (t.nextActionCostAdd || 0) + rules.annoyingApTax;
      H.log(s, { kind: "parley", actor: npc.id, target: t.id, text: `${name(npc)} won't stop talking. ${name(t)} is distracted and can only target ${name(npc)} for ${turns} turn${turns === 1 ? "" : "s"}${annoying ? `, and their next action costs ${rules.annoyingApTax} more AP` : ""}.`,
        why: [annoying ? "Annoying: distractions land more often and last longer." : "A distraction: deal with the talker first."] });
      return "distract";
    }
    H.log(s, { kind: "parley", actor: npc.id, target: t.id, text: `${name(npc)} tries to talk ${name(t)} down. It doesn't land.` });
    return "nothing";
  }
  function answerOffer(s, a, npc, accept, H) {
    const offer = s.parley?.offers?.[npc?.id];
    if (!offer || offer.to !== a.id || offer.until < s.round) return "There's no offer to answer.";
    if (accept) {
      persuade(s, npc, a);
      H.log(s, { kind: "parley", actor: a.id, target: npc.id, text: `${name(a)} accepts. ${name(a)} and ${name(npc)} come to terms; ${name(npc)} is out of the fight.` });
    } else {
      lock(s, a.id, npc.id);
      H.log(s, { kind: "parley", actor: a.id, target: npc.id, text: `${name(a)} declines ${name(npc)}'s terms. Talk is closed between them for the rest of the battle.` });
    }
    return null;
  }

  // Can `a` make a hostile move against `t` right now? null = yes; otherwise the reason.
  function blocks(s, a, t) {
    if (!a || !t || a.id === t.id || a.side === t.side) return null;
    if (t.safeConduct && !t.defeated) return `${name(t)} carries a letter of safe conduct: no one may raise a hand against them.`;   // a hired mediator (engine/hires.js)
    if (t.truce && t.truce.until >= s.round && a.side === t.truce.side) return `A truce holds with ${name(t)} until round ${t.truce.until + 1}.`;
    if (a.persuaded) return `${name(a)} has come to terms; they're out of the fight.`;
    if (standingDown(s, a)) return `${name(a)} has stood down; no hostile moves until round ${a.standDownUntil + 1}.`;   // Mind duel: losing the argument benches you too
    if (bonds()?.naturalPair(a, t)) return `${name(a)} won't raise a hand against ${name(t)}: max friendship.`;   // Bonds: natural friends never fight
    if (t.persuaded) return `${name(t)} has come to terms; the fight with them is over.`;
    const hold = s.parley?.holds?.[`${a.id}>${t.id}`];
    if (hold != null && hold >= s.round) return `${name(t)} talked ${name(a)} down: no hostile moves against them until round ${hold + 1}.`;
    if (a.distracted && a.distracted.until >= s.round && a.distracted.by !== t.id && !s.actors?.[a.distracted.by]?.defeated)
      return `${name(s.actors?.[a.distracted.by])} has ${name(a)}'s attention: they can only target ${name(s.actors?.[a.distracted.by])}.`;
    return null;
  }

  // What the player can do about it right now (menu).
  function options(s, id) {
    const a = s.actors[id], out = { terms: [], offers: [] };
    if (!a || a.defeated) return out;
    for (const t of Object.values(s.actors)) {
      if (t.side === a.side || t.defeated) continue;
      if (standingDown(s, t) && !t.persuaded && !locked(s, a.id, t.id) && !language(a, t)) { const w = willingness(s, t); out.terms.push({ target: t.id, name: name(t), chance: termsChance(s, a, t), cost: rules.termsCost, off: a.tempo < rules.termsCost || w.unforgiving, note: w.note }); }
      const o = s.parley?.offers?.[t.id];
      if (o && o.to === a.id && o.until >= s.round && !t.persuaded) out.offers.push({ from: t.id, name: name(t) });
    }
    return out;
  }
  // Every enemy still standing has come to terms (and at least one did).
  function allPersuaded(units) {
    const left = units.filter((u) => u.side === "enemy" && !u.defeated && !u.notArrived);
    return left.length > 0 && left.every((u) => u.persuaded);
  }

  // Immortal: still knocked out like anyone, but never dies (no kill for Assassinate; the win is non-lethal).
  const isImmortal = (u) => has(u, "immortal") || IMMORTALS.has(u?.character);
  return { rules, COMPANY, stillFighting, companyMul, PERSUADERS, DUTY, IMMORTALS, isImmortal, speech, language, cannotTalk, willingness, fallenAllies, persuasion, persuasionBreakdown, traitsOf, talkChance, resolveTalk, termsChance, canTerms, comeToTerms, npcTalkTarget, npcTalkOdds, npcTalk,
    answerOffer, blocks, options, locked, lock, allPersuaded, standingDown };
});
