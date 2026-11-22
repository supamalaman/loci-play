"use strict";
// States (Mala, 2026-10-24; docs/state-kit.md): one table of conditions a unit can be in, read by one resolver.
// The table is C.states in content.js (numbers live in content.js), one row per state, data only:
//
//   { name, text, why, hidden?, group?, cardMod?: "taken" | "dealt" (a card's row: strongest-wins per unit per direction, never multiplies another card row),
//     gate?:     { blocks: ["all" | "move" | "guard" | "ability" | "ultimate" | "ability:<id>" | "channel:<damageType>"], except?: [abilityId], reason? },
//     clock?:    { counts: "ownerTurns" | "rounds" | "hits" | "manual", n, then?: [effect] },
//     mods?:     [{ on: "taken" | "dealt", family?: damageType | [damageType], mult }],
//     triggers?: [{ on: "hit" | "dealt" | "defeat" | "kill" | "turnStart" | "lethal", if?: { family?, minDamage? }, limit?, do: [effect] }],
//                 // lethal: a blow would defeat the holder; he stays at 1 LF instead and the effects run (once a battle: survive.js)
//     breakers?: [({ hurt: n } | { adjacentTrait: key, side?: "ally" | "foe" } | { ability: id, from?: "ally" | "foe" }
//                 | { present: characterId, side?: "ally" | "foe" } | { moved: true } | { apart: n } | { healed: n }) & { do?: [effect] }],
//                 // present: that character stands on the field; moved: the holder leaves the tile it held when granted;
//                 // apart: whoever granted it is defeated or more than n away; healed: the holder is healed n or more at once
//     offers?:   { ability: id, to: "allies" | "self" },   // while held, the holder's living allies (or, with to: "self", the holder) may use that ability (Remind)
//     advice?:   true | { heed: false },   // advice from whoever granted it: hold back. The AI weighs it by valence (holdBack); heed false: never weighed
//     body?:     { sprite?, traits?: [id], maxLFAdd?, moveAdd?, massive? },   // a form's body; undone exactly when the state ends
//     anySide?:  true,   // Cure (S1): while held, the unit chooses targets with allegiance off (a sibling of the Genjutsu entranced side-swap)
//     unmasks?:  true,   // Cure (S1): while held, the unit's restraint traits (RESTRAINT below) are ignored by hasTrait
//     A trigger's if may carry { cue: true }: it fires only when the instance's stored cue (grant option cue: "flame" | "water" | "question") is met at the holder (cueMet).
//
// A character may list startStates: [id] (content.js characters): granted as the battle opens, before the first turn.
//
// An ability may carry def.states = { grant: [{ id, to: "self" | "target" | "allies", turns?, cue?, thematic?: { characterId: stateId } }], once?: key, unlessHeld?: true, ai?: n | { value, clear?, below? } }: ai = what
// the AI scores it (damage scale) when it would change something ({ value, clear, below }: only while no foe is within clear
// tiles, for an act a blow would break, and only at or under that fraction of max LF, for a rest); thematic: a stronger state for a story partner (Mala's rule 6:
// the ability works on anyone, stronger in its story); "allies": every living unit on the user's side within the ability's
// area radius (or 2), not the user. Hooks: beforeDefeat(s, unit) for lethal triggers, healed(s, unit, n) for healed breakers.
// The AI scores it (damage scale) when it would change something (grant a state not held, or break one its target holds); once = one
// use a turn across every ability sharing the key (a free form switch); unlessHeld = refused when it would grant a state the
// unit already holds. Bodies stay 1x1: a giant is `massive` (no grapple, lift or shove), not a bigger footprint.
//
// An effect is one of a closed menu, so a state never runs code: { healLF: n | { frac } }, { grant: id, to: "self" | "source",
// turns?, byOrigin? }, { remove: id, from: "self" | "source" }, { count: n } (a manual clock moves by n), { log: text },
// { step: "away", tiles: 1 } (Cure: one safe tile away from the state's `by`, no damage), { rally: true } (clears routed), { leave: true, noXp?, reason? } (the holder leaves the battle),
// { scene: { title, line } } (an event card in the battle UI; the log gets the line). A grant may carry thematic: { characterId:
// stateId } (rule 6), as ability grants do.
// A unit holds at most one instance of a state (unit.states[id]); a state with a group replaces the others in its group
// (a form, a stance). Hidden states say nothing in the log and show to a side only after that side has Observed the unit.
//
// It rides the hooks the engine already has (the same places Vows and ClassRuntime are consulted) and does nothing for a
// unit that holds no state, so an engine with an empty table plays exactly as before. v1: units only, nothing migrated.
//
//   grant(s, unit, id, { by?, link?, count? }) / remove(s, unit, id, why?)      the two writes (a row may carry clock.max, a cap on count, and refusesGrant: [ids], held states that refuse those grants)
//   refuses(s, a, action) / refusesAbility / refusesKind / blocksAll            gate: apply, the AI, move options
//   damageMods(s, src, tgt, inst, damageType)                                   modifier: { mult, notes } or null
//   afterHit(s, src, tgt, inst, dealt, damageType)                              triggers, hurt breakers, hit clocks
//   turnStart(s, a) / roundEnd(s)                                               clocks, adjacency breakers, turn triggers
//   afterAction(s, a, action)                                                   ability grants (def.states.grant), ability breakers
//   battleStart(s)                                                              startStates, presence breakers
//   aiValue(s, a, cand)                                                         an ability's def.states.ai, or null
//   observed(s, observer, target) / visibleTo(s, unit, side)                    reveal
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).states = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { log } = H;
    const KIND = { move: "move", jump: "move", climb: "move", guard: "guard", overwatch: "overwatch", ability: "ability", playCard: "card" };   // overwatch: Cure (S1), so a gate can block the Overwatch action type
    const defOf = (id) => { const d = H.C.states?.[id]; return d ? { ...d, id } : null; };
    const live = (u) => !!u && !u.defeated && !u.notArrived;
    const quiet = (def, inst) => !!def.hidden && (def.id === "latent" ? !inst.revealed.includes("player") : !inst.revealed.length);
    const abOf = (id) => (H.ab ? H.ab(id) : H.C.abilities[id]);
    // Walk a unit's held states; a state removed by an earlier step in the walk is skipped.
    const each = (u, fn) => { for (const id of Object.keys(u?.states || {})) { const inst = u.states?.[id], def = defOf(id); if (inst && def) fn(inst, def); } };
    const say = (s, u, def, inst, text, by = null) => { if (!quiet(def, inst)) log(s, { kind: "state", actor: u.id, target: by, text, why: def.why ? [def.why] : [] }); };
    const beside = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
    // ── Cure (claude-cure-spec rev 3, S1). The restraint traits a unit can be peeled of or unmasked from, in the order a probe takes them.
    const RESTRAINT = ["honest", "guarded", "stubborn", "proud", "fearful", "impatient", "loyal", "lonely"];
    const holdsFlag = (u, flag) => { let on = false; if (u?.states) each(u, (st, def) => { if (def[flag]) on = true; }); return on; };
    const anySide = (u) => holdsFlag(u, "anySide");       // a held state says: choose targets with allegiance off
    const unmasks = (u) => holdsFlag(u, "unmasks");       // a held state says: restraint traits are ignored
    const traitIgnored = (a, id) => !!a?.traitsOff?.includes(id) || (RESTRAINT.includes(id) && unmasks(a));   // a peeled layer, or an unmasked unit's restraint trait: the one read hasTrait and the AI motives share
    const ANY_SIDE = (u) => `~any:${u.id}`;               // a side no one shares, so every other unit reads as a foe while this unit decides
    const burningAt = (s, x, y) => (s.wild || []).some((m) => m.kind === "brushfire" && !m.done && m.tiles && `${x},${y}` in m.tiles);
    const waterTile = (s, x, y) => H.inside(s, x, y) && !!H.tileAt(s, x, y).tags?.includes("water");
    // A cue is met at the holder: flame = a burning tile within 2, water = a water tile within 1, question = it was probed this round.
    function cueMet(s, u, kind) {
      const near = (r, f) => { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (f(s, u.x + dx, u.y + dy)) return true; return false; };
      if (kind === "flame") return near(2, burningAt);
      if (kind === "water") return near(1, waterTile);
      if (kind === "question") return u.probedRound === s.round;
      return false;
    }
    const SUGGESTIONS = { hold: "suggestedHold", back: "suggestedBack", guard: "suggestedGuard" };
    const rawTrait = (u, id) => (u.traits || []).some((t) => (typeof t === "string" ? t : t.id) === id);
    const cureRules = (s) => s.rules.cure || H.C.rules.cure;
    const layers = (s, u) => RESTRAINT.filter((id) => rawTrait(u, id)).slice(0, cureRules(s).maxLayers);
    const nextLayer = (s, u) => layers(s, u).find((id) => !u.traitsOff?.includes(id));
    const truce = (s, a, t) => (a.truceWith === t.id && a.truceUntil >= s.round) || (t.truceWith === a.id && t.truceUntil >= s.round);
    const freeQuestion = (a, d) => d.ability === "whoAreYou" && !!a.states?.askable;
    function cureBill(a, m) {
      if (freeQuestion(a, m)) Object.assign(m, { cost: 0, tempoCost: 0, noCharge: true });
      else if (abOf(m.ability)?.cureWholeTurn) Object.assign(m, { tempoCost: Math.max(1, a.tempo), cureWholeTurn: true });
    }
    function cureTarget(s, a, m, t, at, choice) {
      if (!live(t) || t.escaped || t.lf <= 0) return { ok: false, error: "Choose a standing subject." };
      const fail = (error) => ({ ok: false, error });
      const [x, y] = at, ability = m.ability, st = t.states || {};
      if (H.dist(s, a.x, a.y, x, y) > m.range || !H.hasSight(s, a.x, a.y, x, y) || H.Instinct?.hidden(a, t)) return fail("Choose a visible subject in range.");
      if (t.summon || t.beast || t.companion || t.communed || t.clone || t.mirrorOf) return fail("This technique needs a person with their own restraints.");
      const choices = abOf(ability)?.cureChoices;
      if (choices && choice !== undefined && !Object.hasOwn(choices, choice)) return fail("Choose a listed cue or suggestion.");
      const steady = ability === "steadyVoice", free = freeQuestion(a, m);
      if (steady) {
        if (t.side !== a.side || t.unwilling) return fail("Steady Voice needs a willing ally or yourself.");
        if (st.heard || st.fixated || st.unmasked) return fail("That subject cannot accept Steady Voice.");
      } else {
        if (t.side === a.side || t.id === a.id || H.Tourist?.is(t) || truce(s, a, t) || H.Parley?.blocks(s, a, t)) return fail("Choose an opponent outside a truce.");
        if (free && t.boss !== "asker") return fail("This offered question is only for the Asker.");
        if (st.unmasked || st.incapacitated || st.steadied) return fail("That subject refuses the technique in their current state.");
        if (!free && (rawTrait(t, "stoic") || t.primary === "stoicism" || t.secondary === "stoicism")) return fail("Their Stoicism holds.");
        if (ability === "whoAreYou") {
          if (!free && !nextLayer(s, t) && !st.latent) return fail("There is no remaining restraint to probe.");
        } else {
          if (st.spoken) return fail("That subject has already received their instruction for this battle.");
          if (t.primary === "selectivity" || t.secondary === "selectivity") return fail("Their Selectivity filters the instruction.");
          if (ability === "holdTheFlame" && st.fixated) return fail("That subject is already fixated.");
          if (ability !== "holdTheFlame" && !st.fixated) return fail("That subject must first be fixated.");
          if (ability === "quietInstruction" && !t.traitsOff?.length) return fail("Peel a restraint before giving a latent order.");
          if (ability === "hypnoticSuggestion" && ["guarded", "stubborn"].some((id) => H.hasTrait(t, id))) return fail("An intact Guarded or Stubborn restraint refuses.");
        }
      }
      return { ok: true, tiles: [at], targets: [t.id], cureChoice: choice ?? Object.keys(choices || {})[0] };
    }
    function restoreLayer(s, t, id = t.traitsOff?.at(-1)) {
      if (!id || !t.traitsOff?.includes(id)) return null;
      t.traitsOff = t.traitsOff.filter((layer) => layer !== id);
      if (t.curePeelUntil) delete t.curePeelUntil[id];
      if (!t.traitsOff.length) remove(s, t, "curePeeled");
      return id;
    }
    function probe(s, a, t) {
      t.probedRound = s.round;
      observed(s, a, t);
      const layer = nextLayer(s, t);
      if (!layer) return;
      const deck = s.insight?.decks?.[t.id], card = deck?.cards.find((c) => c.kind === "trait" && c.trait === layer);
      if (card && H.Observation && H.insightRules) {
        const bySubject = H.Observation.knowledge(s, a, true);
        const know = (bySubject[t.id] ||= H.insightRules.spawnKnowledge(deck));
        if (!know.revealed.includes(card.id)) {
          know.revealed.push(card.id);
          H.Observation.credit(s, a, t, [card], H.observationH());
        }
      }
      const name = H.insightRules?.data?.traits?.[layer]?.name || layer;
      if (!t.cureGuardedProbe && H.hasTrait(t, "guarded")) {
        t.cureGuardedProbe = true;
        log(s, { kind: "cure", actor: a.id, target: t.id, text: `${t.name} keeps their first restraint. Guarded holds.` });
        return;
      }
      if (layer === "honest" || layer === "loyal") {
        const probes = (t.cureProbes ||= {});
        probes[layer] = (probes[layer] || 0) + 1;
        if (probes[layer] < 2) {
          log(s, { kind: "cure", actor: a.id, target: t.id, text: `${name} holds. It takes another probe.` });
          return;
        }
        delete probes[layer];
      }
      (t.traitsOff ||= []).push(layer);
      (t.curePeelUntil ||= {})[layer] = s.round + cureRules(s).peelRounds - 1;
      if (!t.states?.curePeeled) grant(s, t, "curePeeled", { by: a.id });
      log(s, { kind: "cure", actor: a.id, target: t.id, text: `${t.name}'s ${name} restraint is peeled.` });
    }
    function cureResolve(s, a, inst) {
      const t = s.actors[inst.targets[0]];
      if (!live(t)) return;
      const from = { by: a.id };
      switch (inst.ability) {
        case "whoAreYou": probe(s, a, t); break;
        case "holdTheFlame": grant(s, t, "fixated", from); break;
        case "quietInstruction":
          grant(s, t, "latent", { ...from, cue: inst.cureChoice });
          grant(s, t, "spoken", from);
          break;
        case "hypnoticSuggestion":
          if (grant(s, t, SUGGESTIONS[inst.cureChoice], from)) grant(s, t, "spoken", from);
          break;
        case "steadyVoice": {
          const restored = restoreLayer(s, t);
          delete t.routed;
          grant(s, t, "calm", from);
          grant(s, t, "heard", from);
          if (restored) log(s, { kind: "cure", actor: a.id, target: t.id, text: `${t.name} recovers a peeled restraint.` });
          break;
        }
      }
    }
    function cureAi(s, a, cand) {
      const t = Array.isArray(cand.target) && H.actorAt(s, ...cand.target);
      if (!t || !cureTarget(s, a, H.manifest(s, a, cand.ability), t, cand.target, cand.cureChoice).ok) return 0;
      const basics = H.abilitiesOf(t).map(abOf).filter((x) => x?.tier === "basic" && x.effect === "damage");
      const hit = Math.max(s.rules.strike.potency, ...basics.map((x) => x.potency || 0));
      const near = (u, v) => H.dist(s, u.x, u.y, v.x, v.y);
      const stood = Object.values(s.actors).filter(live);
      switch (cand.ability) {
        case "whoAreYou":
          if (freeQuestion(a, { ability: cand.ability })) return hit;
          if (t.states?.latent?.by === a.id && t.states.latent.cue === "question" && !cueMet(s, t, "question")) return hit + 6;
          return !t.traitsOff?.length && !stood.some((u) => u.side !== a.side && near(a, u) <= 2) ? hit : 0;
        case "holdTheFlame": return t.traitsOff?.length ? hit + 3 : hit * 0.4;
        case "quietInstruction": return cueMet(s, t, cand.cureChoice) || cand.cureChoice === "question" && H.abilitiesOf(a).includes("whoAreYou") ? hit + 6 : 0;
        case "hypnoticSuggestion": {
          const threatened = basics.some((x) => ["line", "routed"].includes(x.delivery)) || stood.some((u) => u.side === a.side && near(u, t) <= 3);
          if (!threatened) return 0;
          if (cand.cureChoice === "back") return near(a, t) === 1 && safeStep(s, t, a) ? hit + 1 : 0;
          if (cand.cureChoice === "guard") return stood.some((u) => u.side === a.side && u.id !== a.id && near(u, t) <= 2) ? hit + 2 : 0;
          return hit;
        }
        case "steadyVoice": return t.routed ? hit + 3 : t.traitsOff?.length ? hit : 0;
        default: return 0;
      }
    }
    // A trace belongs to its reader. It never replaces the true installer link on the subject.
    const heldTrace = (u) => {
      const trace = u?.states?.detectiveMarkTrace || u?.states?.markTrace;
      return trace?.reader === u?.id ? trace : null;
    };
    const traceState = (id) => id === "markTrace" || id === "detectiveMarkTrace";
    function tracePoint(s, a, u, range = Infinity) {
      if (!live(u) || u.escaped || H.Instinct?.hidden(a, u)) return null;
      if (a.side !== u.side && H.Stealth?.concealed(u) && !H.Stealth.markerEats(s, u) &&
          !H.ClassRuntime?.Martial?.seesHidden?.(a) && !(H.hasTrait(a, "gyoEyes") && H.dist(s, a.x, a.y, u.x, u.y) <= 3)) return null;
      return H.footprint(u).find(([x, y]) => H.dist(s, a.x, a.y, x, y) <= range &&
        H.astralSameRegion(s, a.x, a.y, x, y) && H.dreamCanReach(s, a, { ability: "theMarkAnswers", delivery: "signal" }, x, y) &&
        H.hasSight(s, a.x, a.y, x, y)) || null;
    }
    function traceTarget(s, a, m, at) {
      const t = H.actorAt(s, ...at);
      const aim = t?.states?.marked?.by && tracePoint(s, a, t, m.range);
      if (!aim) return { ok: false, error: "Choose a visible marked unit in range." };
      return { ok: true, aim, tiles: [aim], targets: [t.id] };
    }
    function updateTrace(s, a, trace) {
      const subject = tracePoint(s, a, s.actors[trace.link]), installer = tracePoint(s, a, s.actors[trace.by]);
      if (subject) trace.subjectAt = subject;
      if (installer) trace.installerAt = installer;
    }
    function traceResolve(s, a, inst) {
      const t = s.actors[inst.targets[0]], installer = t?.states?.marked?.by;
      if (!installer) return;
      const id = a.character === "detective" ? "detectiveMarkTrace" : "markTrace";
      const trace = grant(s, a, id, { by: installer, link: t.id });
      if (!trace) return;
      trace.reader = a.id;
      trace.installerName = s.actors[installer]?.name || "Installer unavailable";
      updateTrace(s, a, trace);
      if (a.side === "player") log(s, { kind: "markTrace", actor: a.id, target: t.id, tiles: [trace.subjectAt].filter(Boolean),
        text: `${a.name} traces ${t.name}'s mark to ${trace.installerName}.` });
    }
    function refreshMarkTraces(s) {
      for (const a of Object.values(s.actors)) {
        const trace = heldTrace(a);
        if (trace && live(a) && !a.escaped) updateTrace(s, a, trace);
      }
    }
    function markTrace(s, id) {
      const a = s.actors[id], trace = heldTrace(a);
      if (!trace || !live(a) || a.escaped || s.outcome) return null;
      const subject = tracePoint(s, a, s.actors[trace.link]), installer = tracePoint(s, a, s.actors[trace.by]);
      return { subject: trace.link, installer: trace.installerName,
        from: subject || trace.subjectAt || null, to: installer || trace.installerAt || null,
        grey: !(subject && installer), detective: trace.id === "detectiveMarkTrace", turns: trace.count };
    }
    // One tile directly away from `from`, only onto a tile that is open, not burning, not a trap, not a drop and not water that blocks moves.
    // Its own small resolver: forced movement (resolve.js knock) charges slam and fall damage, which a harmless compel must not do.
    function safeStep(s, u, from) {
      const sx = Math.sign(u.x - from.x), sy = Math.sign(u.y - from.y); if (!sx && !sy) return null;
      const x = u.x + sx, y = u.y + sy;
      if (!H.inside(s, x, y) || H.actorAt(s, x, y) || H.barrierAt?.(s, x, y)) return null;
      const tile = H.tileAt(s, x, y);
      if (tile.blocksMove || (tile.hazard || 0) > 0 || burningAt(s, x, y)) return null;
      if ((s.traps || []).some((tp) => !tp.spent && tp.x === x && tp.y === y)) return null;
      if ((s.arena.objects || []).some((o) => o.x === x && o.y === y && o.blocksMove)) return null;
      if (H.heightAt(s, x, y) < H.heightAt(s, u.x, u.y)) return null;
      return [x, y];
    }

    // ── Body: what a form changes about the unit itself. Saved on the instance and undone exactly on removal (a trait the unit
    // already had stays; lf scales as a learned form's does). Deltas are added and taken back, so two sources never clobber.
    const tid = (t) => (typeof t === "string" ? t : t?.id);
    function applyBody(unit, def, inst) {
      const b = def.body; if (!b) return;
      const prior = (inst.prior = {});
      if (b.sprite) { prior.sprite = unit.sprite ?? null; unit.sprite = b.sprite; }
      if (b.traits) { prior.traits = b.traits.filter((id) => !(unit.traits || []).some((t) => tid(t) === id)); unit.traits = [...(unit.traits || []), ...prior.traits]; }
      if (b.maxLFAdd) { prior.maxLFAdd = b.maxLFAdd; unit.maxLF += b.maxLFAdd; unit.lf += b.maxLFAdd; }
      if (b.moveAdd) { prior.moveAdd = b.moveAdd; (unit.passives ||= {}).moveBudgetAdd = (unit.passives.moveBudgetAdd || 0) + b.moveAdd; }
      if (b.massive != null) { prior.massive = !!unit.massive; unit.massive = !!b.massive; }
    }
    function revertBody(unit, inst) {
      const p = inst?.prior; if (!p) return;
      if ("sprite" in p) { if (p.sprite == null) delete unit.sprite; else unit.sprite = p.sprite; }
      if (p.traits?.length) unit.traits = (unit.traits || []).filter((t) => !p.traits.includes(tid(t)));
      if (p.maxLFAdd) { unit.maxLF -= p.maxLFAdd; unit.lf = Math.max(1, Math.min(unit.lf, unit.maxLF)); }
      if (p.moveAdd && unit.passives) { const left = (unit.passives.moveBudgetAdd || 0) - p.moveAdd; if (left) unit.passives.moveBudgetAdd = left; else delete unit.passives.moveBudgetAdd; }
      if ("massive" in p) unit.massive = p.massive;
    }

    // ── Treasure Hunter (TH1, cursor-treasure-hunter-spec; Mala 2026-11-15: his own flag and his own sprites per form). Stepping onto a
    // pickup turns him gold: the item leaves the field and he carries it as treasure (state relicGold: x0.25 taken, the golden-relic-hunter
    // sprite). Each item id does it once a battle (unit.relicUsed), so gold forms never outnumber the distinct items on the map; a
    // second pickup while gold, or a used item id, is an ordinary pickup (returns false and the caller collects it as usual).
    const isHunter = (u) => u?.character === "treasure_hunter";
    function relicClaim(s, unit) {
      if (!isHunter(unit) || !live(unit) || unit.states?.relicGold || !defOf("relicGold")) return false;
      const pk = (s.arena?.pickups || []).find((q) => q.x === unit.x && q.y === unit.y);
      if (!pk || (unit.relicUsed || []).includes(pk.item)) return false;
      s.arena = { ...s.arena, pickups: s.arena.pickups.filter((q) => q !== pk) };
      (unit.relicUsed ||= []).push(pk.item);
      unit.relicGolds = (unit.relicGolds || 0) + 1;   // how many times he has gone gold this battle (TH1b: the termination test counts it against the distinct items and the one Second Claim)
      const inst = grant(s, unit, "relicGold", { by: unit.id });
      if (inst) inst.treasure = pk.item;
      log(s, { kind: "pickup", actor: unit.id, item: pk.item, tiles: [[unit.x, unit.y]], text: `${unit.name} seizes ${pk.name || pk.item}: gold spreads over him, and the next blow cracks it.` });
      H.Inspiration?.gain?.(s, unit, 1, `${unit.name} has the treasure in his hands: +1 Inspiration.`);
      return true;
    }
    // The breaking blow still landed at x0.25; now the treasure drops on an open tile beside him (his own tile if none is open).
    function dropTreasure(s, holder, inst) {
      const item = inst?.treasure; if (!item) return;
      const taken = (x, y) => (s.arena.pickups || []).some((q) => q.x === x && q.y === y);
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => [holder.x + dx, holder.y + dy]).find(([x, y]) => {
        if (!H.inside(s, x, y) || H.actorAt(s, x, y) || taken(x, y)) return false;
        const tile = H.tileAt(s, x, y);
        return !tile.blocksMove && !((s.arena.objects || []).some((o) => o.x === x && o.y === y && o.blocksMove));
      }) || [holder.x, holder.y];
      const n = Math.max(0, ...(s.arena.pickups || []).map((q) => +String(q.id).slice(1) || 0)) + 1, id = `i${n}`;
      s.arena = { ...s.arena, pickups: [...(s.arena.pickups || []), { id, item, x: open[0], y: open[1], droppedBy: holder.id }] };
      (s.relicDrops ||= {})[id] = holder.id;
      holder.relicBrokeRound = s.round;   // Pack Strong (resolve.js knock) reads this: the blow that cracked the gold still meets the knock at 1 tile less
      log(s, { kind: "drop", actor: holder.id, item, tiles: [open], text: `${holder.name}'s gold cracks: the treasure drops at (${open.join(",")}).` });
    }

    // ── Treasure Hunter TH1b (cursor-treasure-hunter-spec section 1; R-20261115-26): the Survey mark on a pickup, Idol Claim, Relic Path, Second Claim
    // and Sun Ward's gate and prime. Numbers: content.js rules.treasureHunter and the four ability rows. Nothing here is a new store of its own:
    // a mark is a field on the pickup plus a once discount in the movement-money list (conditions.js status.moveMods), the free step is one waived
    // move in that list, a Relic Path is a terrainEffects row, and Second Claim edits the used-item list relicClaim reads.
    const TH = (s) => s.rules?.treasureHunter || H.C.rules?.treasureHunter || {};
    const pickupsOf = (s) => s.arena?.pickups || [];
    const far = (s, a, q) => H.dist(s, a.x, a.y, q.x, q.y);
    const nearestFirst = (s, a) => (p, q) => far(s, a, p) - far(s, a, q) || String(p.id).localeCompare(String(q.id));
    const isCompass = (m) => typeof m?.id === "string" && m.id.startsWith("compass:");
    // The Survey mark ("cash the compass"): the pickup is surveyed by him, and his next move that ends on its tile costs compassApOff less AP.
    function compassMark(s, a, pk) {
      s.arena = { ...s.arena, pickups: s.arena.pickups.map((q) => (q === pk ? { ...q, surveyedBy: a.id } : q)) };
      ((a.status ||= {}).moveMods ||= []).push({ id: `compass:${pk.id}`, kind: "discount", amount: TH(s).compassApOff ?? 10, once: true, if: { nearTile: [pk.x, pk.y], within: 0 }, label: "the compass mark" });
    }
    // A mark whose pickup is gone (taken by anyone, or its id handed to a later drop on another tile) takes its discount with it.
    function compassSweep(s) {
      for (const u of Object.values(s.actors || {})) {
        const mods = u.status?.moveMods; if (!mods || !mods.some(isCompass)) continue;
        u.status.moveMods = mods.filter((m) => !isCompass(m) || (live(u) && pickupsOf(s).some((q) => `compass:${q.id}` === m.id && q.surveyedBy === u.id && q.x === m.if.nearTile[0] && q.y === m.if.nearTile[1])));
      }
    }
    // His Survey also reads the loot (resolve.js survey calls this first): the nearest pickup within survey range that nobody has surveyed takes his mark.
    function huntSurvey(s, a) {
      if (!isHunter(a) || !live(a)) return false;
      const R = H.C.concepts?.discovery?.finds?.surveyRange ?? 4;
      const pk = pickupsOf(s).filter((q) => !q.surveyedBy && far(s, a, q) <= R).sort(nearestFirst(s, a))[0];
      if (!pk) return false;
      compassMark(s, a, pk);
      log(s, { kind: "effect", actor: a.id, tiles: [[pk.x, pk.y]], text: `${a.name}'s compass settles on ${pk.name || pk.item} at (${pk.x},${pk.y}).`,
        why: [`Surveyed loot: his next move that ends on that tile costs ${TH(s).compassApOff ?? 10} AP less (never under the move floor), once.`] });
      return true;
    }
    function idolClaim(s, a, inst) {
      const R = inst.area?.radius ?? 4, steps = TH(s).idolStepTiles ?? 3;
      const fresh = pickupsOf(s).filter((q) => !q.surveyedBy && far(s, a, q) <= R);
      for (const pk of fresh) compassMark(s, a, pk);
      const mine = pickupsOf(s).filter((q) => q.surveyedBy === a.id && far(s, a, q) <= R).sort(nearestFirst(s, a))[0];
      if (mine) {
        a.status.moveMods = (a.status.moveMods || []).filter((m) => m.id !== "idolStep");
        a.status.moveMods.push({ id: "idolStep", kind: "waive", once: true, untilRound: s.round, if: { nearerTo: [mine.x, mine.y], maxSteps: steps }, label: "Idol Claim's free step" });
      }
      log(s, { kind: "effect", actor: a.id, ability: inst.ability, tiles: fresh.map((q) => [q.x, q.y]),
        text: !fresh.length && !mine ? `${a.name} claims the room, and finds no loot within ${R} to put his name on.`
          : `${a.name} claims ${fresh.length} pickup${fresh.length === 1 ? "" : "s"} within ${R}${mine ? `; one move this round of up to ${steps} tile${steps === 1 ? "" : "s"} toward (${mine.x},${mine.y}) costs no AP` : ""}.`,
        why: ["Idol Claim: every pickup in reach that nobody had surveyed is surveyed by him (a cheaper move onto each, once).", ...(mine ? ["The free step is one move that ends nearer the nearest pickup he has surveyed; it is gone at the end of the round."] : [])] });
    }
    // Relic Path: the tiles a path of `max` steps can reach from him. It runs over open ground only (no blocked tile, wall or unit, no drop of 2
    // or more), whatever the ground costs and however high it climbs. Returns the breadth-first tree; relicRoute reads one path out of it.
    const tk = (x, y) => `${x},${y}`;
    function relicReach(s, a, max) {
      const prev = new Map([[tk(a.x, a.y), null]]); let edge = [[a.x, a.y]];
      const open = (x, y, fx, fy) => { if (!H.inside(s, x, y) || (H.dreamSame && !H.dreamSame(s, fx, fy, x, y)) || H.tileAt(s, x, y).blocksMove || H.actorAt(s, x, y) || H.unitAt?.(s, x, y)) return false;
        const b = H.barrierAt(s, x, y); return !(b && !b.passable) && H.heightAt(s, fx, fy) - H.heightAt(s, x, y) < 2; };
      for (let n = 0; n < max && edge.length; n++) { const next = [];
        for (const [x, y] of edge) for (const [dx, dy] of H.DIRS) { const nx = x + dx, ny = y + dy; if (prev.has(tk(nx, ny)) || !open(nx, ny, x, y)) continue; prev.set(tk(nx, ny), [x, y]); next.push([nx, ny]); }
        edge = next; }
      return prev;
    }
    function relicRoute(reach, a, tx, ty) {
      if (!reach.has(tk(tx, ty)) || (tx === a.x && ty === a.y)) return null;
      const out = []; for (let cur = [tx, ty]; cur && !(cur[0] === a.x && cur[1] === a.y); cur = reach.get(tk(cur[0], cur[1]))) out.unshift(cur);
      return out;
    }
    const relicPathOf = (s, a) => (s.terrainEffects || []).find((e) => e.kind === "relicPath" && e.owner === a.id && (a.ownerTurns || 0) < e.expiresAt) || null;
    // actions.js stepCost asks this for every step of the mover's own pathing: a tile of his own live path costs him 1 move point.
    function relicPathAt(s, mover, x, y) {
      if (!mover || !s.terrainEffects?.length) return false;
      const e = relicPathOf(s, mover); return !!e && e.tiles.some((t) => t[0] === x && t[1] === y);
    }
    // targeting.js asks this for the three techniques (effect "treasureHunt") before anything is paid; null hands a self-cast back to the usual rule.
    function huntTarget(s, a, m, tx, ty) {
      const fail = (error) => ({ ok: false, error }), hunt = abOf(m.ability)?.hunt;
      if (hunt === "secondClaim") {
        if (!(a.relicUsed || []).length) return fail("Second Claim needs an item that already turned you gold this battle.");
        if ((a.secondClaims || 0) >= (TH(s).secondClaimsPerBattle ?? 1)) return fail("Second Claim is spent for this battle.");
        return null;
      }
      if (hunt !== "relicPath") return null;
      if (tx == null || !H.inside(s, tx, ty)) return fail("Choose the tile the path ends on.");
      if (relicPathOf(s, a)) return fail("A Relic Path is already laid: walk it first.");
      const reach = relicReach(s, a, m.range), route = relicRoute(reach, a, tx, ty);
      if (!route) return fail(`No path of ${m.range} tiles over open ground ends there.`);
      if (pickupsOf(s).some((q) => reach.has(tk(q.x, q.y))) && !pickupsOf(s).some((q) => q.x === tx && q.y === ty)) return fail("A pickup is within the path's reach: the path must end on one.");
      return { ok: true, tiles: route, targets: [] };
    }
    function secondClaim(s, a, inst) {
      const used = a.relicUsed || [];
      if (!used.length || (a.secondClaims || 0) >= (TH(s).secondClaimsPerBattle ?? 1)) { log(s, { kind: "effect", actor: a.id, ability: inst.ability, text: `${a.name} has nothing to claim a second time.` }); return; }
      const lying = pickupsOf(s).filter((q) => used.includes(q.item)).sort(nearestFirst(s, a))[0];
      const item = lying ? lying.item : used[used.length - 1];
      a.relicUsed = used.filter((id) => id !== item);
      a.secondClaims = (a.secondClaims || 0) + 1;
      log(s, { kind: "effect", actor: a.id, ability: inst.ability, item, tiles: lying ? [[lying.x, lying.y]] : [], text: `${a.name} stakes a second claim: ${lying?.name || item} can turn him gold once more.`,
        why: ["Second Claim: one item he has already used is eligible again, once a battle. He is still gold with one treasure at a time."] });
    }
    // resolve.js hands the three techniques here once the cast is committed (after an announced window closes).
    function huntResolve(s, a, inst) {
      const hunt = abOf(inst.ability)?.hunt;
      if (hunt === "idolClaim") return idolClaim(s, a, inst);
      if (hunt === "secondClaim") return secondClaim(s, a, inst);
      if (hunt !== "relicPath") return;
      const tiles = (inst.tiles || []).map((t) => [t[0], t[1]]), end = tiles[tiles.length - 1];
      s.terrainEffects = (s.terrainEffects || []).filter((e) => !(e.kind === "relicPath" && e.owner === a.id));
      s.terrainEffects.push({ id: `relicPath-${a.id}-${s.round}`, kind: "relicPath", label: "Relic Path", owner: a.id, side: a.side, tiles, expiresAt: (a.ownerTurns || 0) + (TH(s).relicPathTurns ?? 2) });
      log(s, { kind: "effect", actor: a.id, ability: inst.ability, tiles, text: `${a.name} finds the old road: a path of ${tiles.length} tile${tiles.length === 1 ? "" : "s"} to (${end[0]},${end[1]}) that only he can walk.`,
        why: ["Relic Path: for his next move every tile of it costs him 1 move point, climbs included. His next move spends it, walked or not."] });
    }
    // Sun Ward (window.js): offered in his base form only, never over a ward he holds; whole when the shooter stands on a tile his own live rumor names.
    const sunWardOpen = (s, d) => { const w = d?.status?.ward; return !!d && !d.states?.relicGold && !(w && (w.expiresAt == null || w.expiresAt > (d.ownerTurns || 0))); };
    function sunWardPrimed(s, d, attack) {
      const atk = s.actors[attack?.owner];
      return !!atk && (s.rumors || []).some((r) => typeof r.id === "string" && r.id.startsWith(`rumor-${d.id}-`) && r.expiresRound > s.round && r.tile[0] === atk.x && r.tile[1] === atk.y);
    }
    // The AI's price for each (damage scale; rules.treasureHunter.ai). null: not ours, the scorer goes on as usual. The pull is Gold Fever's
    // (the spec lists these under the trait, and traits drive behaviour): a hunter without the trait surveys and casts as any Discovery holder would.
    function huntAi(s, a, cand) {
      const d = abOf(cand.ability), T = TH(s).ai || {}, used = a.relicUsed || [], fever = isHunter(a) && !!H.hasTrait?.(a, "goldFever");
      const wanted = (q) => !used.includes(q.item);   // loot that can still turn him gold
      if (d?.effect === "survey") {
        if (!fever || a.states?.relicGold) return null;
        const R = H.C.concepts?.discovery?.finds?.surveyRange ?? 4;
        return pickupsOf(s).some((q) => !q.surveyedBy && wanted(q) && far(s, a, q) <= R) ? (T.survey ?? 6) : null;
      }
      const hunt = d?.hunt; if (!hunt) return null;
      if (!fever || a.states?.relicGold) return 0;   // the techniques work for anyone who holds them; only a hunter with the fever, out of his gold, has a reason to
      if (hunt === "idolClaim") {
        const n = pickupsOf(s).filter((q) => !q.surveyedBy && wanted(q) && far(s, a, q) <= (d.area?.radius ?? 4)).length;
        return n >= 2 ? Math.min(T.idolClaimCap ?? 12, n * (T.idolClaimPerPickup ?? 5)) : 0;
      }
      if (hunt === "relicPath") {   // only to loot he could not simply walk to this turn
        const [tx, ty] = Array.isArray(cand.target) ? cand.target : [];
        const pk = pickupsOf(s).find((q) => q.x === tx && q.y === ty);
        if (!pk || !wanted(pk)) return 0;
        return (H.moveOptions?.(s, a.id) || []).some((o) => o.to[0] === tx && o.to[1] === ty) ? 0 : (T.relicPath ?? 6);
      }
      if (hunt === "secondClaim") {   // when the only loot left is loot he has used, and some of it lies near
        if (!used.length || (a.secondClaims || 0) >= (TH(s).secondClaimsPerBattle ?? 1) || pickupsOf(s).some(wanted)) return 0;
        return pickupsOf(s).some((q) => far(s, a, q) <= (T.nearTiles ?? 6)) ? (T.secondClaim ?? 5) : 0;
      }
      return 0;
    }

    function grant(s, unit, id, opt = {}) {
      const def = defOf(id); if (!def || !live(unit)) return null;
      for (const oid of Object.keys(unit.states || {})) {   // a held state may refuse a grant (refusesGrant: ids): incapacitated cannot be extended, and steadied refuses it for a turn
        const od = defOf(oid);
        if (od?.refusesGrant?.includes(id)) { if (!quiet(od, unit.states[oid])) log(s, { kind: "state", actor: unit.id, text: `${unit.name} is ${od.name} and shrugs off ${def.name}.` }); return null; }
      }
      if (unit.states?.[id]) revertBody(unit, unit.states[id]);   // a re-grant refreshes: the old body comes off before the new one goes on
      if (def.group) for (const oid of Object.keys(unit.states || {})) if (oid !== id && defOf(oid)?.group === def.group) remove(s, unit, oid, `${def.name} takes its place`);
      const states = (unit.states ||= {});   // after the group sweep: removing the last state drops unit.states
      // clock.max caps a technique's own turn count (an incapacitating technique asking for 5 turns gets the row's 2)
      const inst = { id, by: opt.by || null, link: opt.link || null, since: unit.ownerTurns || 0, at: [unit.x, unit.y],
        count: def.clock ? Math.min(opt.count ?? def.clock.n, def.clock.max ?? Infinity) : null, hurt: 0, fires: {}, revealed: [], cue: opt.cue || null };
      states[id] = inst;
      applyBody(unit, def, inst);
      say(s, unit, def, inst, `${unit.name} is ${def.name}.`, opt.by);
      if (def.offers) syncOffers(s);
      return inst;
    }
    function remove(s, unit, id, why = "") {
      const inst = unit?.states?.[id], def = defOf(id); if (!inst) return false;
      const hush = def ? quiet(def, inst) : true;
      revertBody(unit, inst);
      delete unit.states[id]; if (!Object.keys(unit.states).length) delete unit.states;
      if (def && !hush) log(s, { kind: "state", actor: unit.id, text: `${unit.name} is no longer ${def.name}${why ? `: ${why}` : ""}.`, why: def.why ? [def.why] : [] });
      if (def?.offers) syncOffers(s);
      return true;
    }
    // A breaker that fires ends the state, then runs its own effects (a cutscene, a line).
    function breakWith(s, holder, inst, def, b, why, ctx = {}) {
      remove(s, holder, def.id, why);
      if (b.do) run(s, holder, inst, def, b.do, ctx);
    }
    // Offered abilities: each unit's stateOffers lists what its allies' states let it use (engine abilitiesOf reads it).
    function syncOffers(s) {
      const units = Object.values(s.actors || {});
      for (const u of units) {
        const ids = [];
        for (const h of units) {
          if (h.side !== u.side || !live(h) || !h.states) continue;
          each(h, (st, def) => { if (def.offers?.ability && (def.id !== "latent" || st.revealed.includes(u.side)) && !ids.includes(def.offers.ability) && (def.offers.to || "allies") === (h.id === u.id ? "self" : "allies")) ids.push(def.offers.ability); });
        }
        if (ids.length) u.stateOffers = ids; else delete u.stateOffers;
      }
    }
    // The end of a state with a clock: its closing effects run (a wake-up, a fall), then it is gone.
    function finish(s, holder, inst, def) {
      const then = def.clock?.then; remove(s, holder, def.id, "it has run its course");
      if (then) run(s, holder, inst, def, then, {});
    }
    function run(s, holder, inst, def, effects, ctx) {
      for (const e of effects || []) {
        if (e.healLF != null && live(holder) && holder.lf > 0) {
          const want = typeof e.healLF === "number" ? e.healLF : Math.round(holder.maxLF * (e.healLF.frac || 0));
          const got = Math.max(0, Math.min(want, holder.maxLF - holder.lf));
          if (got > 0) { holder.lf += got; if (!quiet(def, inst)) log(s, { kind: "heal", actor: holder.id, text: `${holder.name} recovers ${got} LF (${def.name}).`, why: def.why ? [def.why] : [] }); healed(s, holder, got); }
        } else if (e.grant) {
          const to = e.to === "source" ? ctx.src : holder;
          const origin = e.byOrigin ? (inst.by || holder.id) : holder.id;   // Cure (S1): an order carries the installer through a cue; a plain trigger grant names the holder
          if (to && to.id !== undefined) grant(s, to, e.thematic?.[to.character] || e.grant, { by: origin, link: origin, count: e.turns });   // rule 6: a stronger state for the story partner
        } else if (e.remove) {
          const from = e.from === "source" ? ctx.src : holder;
          if (from) remove(s, from, e.remove, def.name);
        } else if (e.count != null) {
          if (inst.count != null) { inst.count += e.count; if (inst.count <= 0 && holder.states?.[def.id] === inst) finish(s, holder, inst, def); }
        } else if (e.step) {   // Cure: one safe tile away from whoever set it; a gone caster cancels it and the state ends
          const from = s.actors[inst.by];
          if (!from || !live(from)) { remove(s, holder, def.id, "the one who spoke is gone"); continue; }
          const to = safeStep(s, holder, from);
          if (to) { holder.x = to[0]; holder.y = to[1]; H.breakHoldsApart?.(s, holder); log(s, { kind: "state", actor: holder.id, tiles: [to], text: `${holder.name} steps back, as told.` }); }
          else log(s, { kind: "state", actor: holder.id, text: `${holder.name} has nowhere safe to step.` });
        } else if (e.rally) {   // Cure: a unit that fled the fear check and is still on the map stands again
          if (holder.routed && live(holder)) { delete holder.routed; log(s, { kind: "state", actor: holder.id, text: `${holder.name} breathes, and the fear lets go.` }); }
        } else if (e.leave) {   // Cure: the holder leaves the battle (the same fields as the leaveBattle effect, actions.js)
          if (live(holder)) { holder.defeated = true; holder.escaped = !e.noXp; holder.noXp = !!e.noXp; holder.leaveReason = e.reason; Spirit()?.onExit?.(s, holder, H); log(s, { kind: "state", actor: holder.id, text: e.reason || `${holder.name} leaves.` }); }
        } else if (e.dropTreasure) {   // Treasure Hunter (TH1): the carried treasure falls as a pickup beside the holder (either side may take it)
          dropTreasure(s, holder, inst);
        } else if (e.log) say(s, holder, def, inst, e.log);
        else if (e.scene && !quiet(def, inst)) log(s, { kind: "stateScene", actor: holder.id, state: def.id, title: e.scene.title, line: e.scene.line, text: e.scene.line });
      }
    }
    function fire(s, holder, inst, def, on, ctx) {
      (def.triggers || []).forEach((t, i) => {
        if (t.on !== on || holder.states?.[def.id] !== inst) return;
        if (t.if?.family && ![].concat(t.if.family).includes(ctx.family)) return;
        if (t.if?.minDamage && !(ctx.dealt >= t.if.minDamage)) return;
        if (t.if?.cue && !cueMet(s, holder, inst.cue)) return;   // Cure: the stored cue must be met at the holder
        if (t.limit != null && (inst.fires[i] || 0) >= t.limit) return;
        inst.fires[i] = (inst.fires[i] || 0) + 1;
        run(s, holder, inst, def, t.do, ctx);
      });
    }

    // ── Gate. apply() asks once for every action; the AI and the move lists ask the same question so a refused act is never chosen.
    function gateHit(g, action, adef) {
      const kind = KIND[action.type], blocks = g.blocks || [];
      if (action.type === "end") return false;
      if (kind === "ability" && (g.except || []).includes(action.ability)) return false;
      if (blocks.includes("all")) return true;
      if (kind && blocks.includes(kind)) return true;
      if (kind === "ability") {
        if (blocks.includes(`ability:${action.ability}`)) return true;
        if (adef?.tier === "ultimate" && blocks.includes("ultimate")) return true;
        if (adef?.damageType && blocks.includes(`channel:${adef.damageType}`)) return true;
      }
      return false;
    }
    function refuses(s, a, action) {
      if (!a || !action) return null;
      const adef = action.type === "ability" ? abOf(action.ability) : null;
      const S = adef?.states;   // the ability's own rules: one use a turn per key, and no switching to what you already are
      if (S?.once && a.stateOnce?.[S.once] === a.ownerTurns) return `${a.name} can only do that once a turn.`;
      if (S?.unlessHeld) for (const g of S.grant || []) if (g.to === "self" && a.states?.[g.id]) return `${a.name} is already ${defOf(g.id)?.name || g.id}.`;
      if (!a.states) return null;
      let why = null;
      each(a, (inst, def) => { if (!why && def.gate && gateHit(def.gate, action, adef)) why = `${a.name} is ${def.name}: ${def.gate.reason || def.text || "that is not possible now"}`; });
      return why;
    }
    const refusesAbility = (s, a, id) => refuses(s, a, { type: "ability", ability: id });
    const refusesKind = (s, a, kind) => refuses(s, a, { type: kind });
    // A unit shut out of everything but ending its turn has nothing for the AI to consider.
    function blocksAll(s, a) {
      let all = false;
      each(a, (inst, def) => { if (def.gate?.blocks?.includes("all") && !(def.gate.except || []).length) all = true; });
      return all;
    }

    // ── Modifier.
    function damageMods(s, src, tgt, inst, damageType) {
      if (!src?.states && !tgt?.states) return null;
      let mult = 1; const notes = [];
      // Card-sourced rows (a def tagged cardMod, CARDS.md section 17) never multiply each other: per unit per direction only the
      // strongest applies (the mult farthest from 1; ties keep the row already held), and it multiplies with non-card rows as usual.
      const read = (u, on) => {
        let best = null;
        each(u, (st, def) => {
          for (const m of def.mods || []) {
            if (m.on !== on || (m.family && ![].concat(m.family).includes(damageType))) continue;
            if (def.cardMod === on) { if (!best || Math.abs(m.mult - 1) > Math.abs(best.mult - 1)) best = { mult: m.mult, def, st }; continue; }
            mult *= m.mult; if (!quiet(def, st)) notes.push(`${def.name} ×${m.mult}.`);
          }
        });
        if (best) { mult *= best.mult; if (!quiet(best.def, best.st)) notes.push(`${best.def.name} ×${best.mult}.`); }
      };
      read(tgt, "taken"); if (src && src !== tgt) read(src, "dealt");
      return mult === 1 && !notes.length ? null : { mult, notes };
    }

    // ── Trigger, hurt breaker, hit clock.
    function afterHit(s, src, tgt, inst, dealt, damageType) {
      if (!(dealt > 0)) return;
      const ctx = { src, dealt, family: damageType || inst?.damageType };
      if (tgt?.states) {
        each(tgt, (st, def) => {
          fire(s, tgt, st, def, "hit", ctx);
          if (tgt.states?.[def.id] !== st) return;
          st.hurt += dealt;
          const hurt = (def.breakers || []).find((b) => b.hurt != null && st.hurt >= b.hurt);
          if (hurt) { breakWith(s, tgt, st, def, hurt, src ? `${src.name}'s blow` : "the blow", ctx); return; }
          if (def.clock?.counts === "hits") { st.count -= 1; if (st.count <= 0) finish(s, tgt, st, def); }
        });
        if (tgt.lf <= 0) each(tgt, (st, def) => fire(s, tgt, st, def, "defeat", ctx));
      }
      if (src?.states && src !== tgt) {
        each(src, (st, def) => { fire(s, src, st, def, "dealt", ctx); if (tgt && tgt.lf <= 0) fire(s, src, st, def, "kill", { ...ctx, src: tgt }); });
      }
    }

    // ── Breakers that look at the board, and clocks that count turns and rounds.
    function adjacentBreak(s, holder, st, def) {
      for (const b of def.breakers || []) {
        if (!b.adjacentTrait) continue;
        const near = Object.values(s.actors).some((u) => u.id !== holder.id && live(u) && beside(u, holder) && H.hasTrait(u, b.adjacentTrait)
          && (!b.side || (b.side === "ally") === (u.side === holder.side)));
        if (near) { breakWith(s, holder, st, def, b, `a ${b.adjacentTrait} unit stands beside them`); return true; }
      }
      return false;
    }
    // { present: characterId }: the state ends the moment that character stands on the field (Jambavan beside Hanuman's side).
    function presenceBreak(s, holder, st, def) {
      for (const b of def.breakers || []) {
        if (!b.present) continue;
        const who = Object.values(s.actors).find((u) => u.id !== holder.id && live(u) && u.character === b.present
          && (b.side === "foe" ? u.side !== holder.side : u.side === holder.side));
        if (who) { breakWith(s, holder, st, def, b, `${who.name} is here`, { src: who }); return true; }
      }
      return false;
    }
    function presenceSweep(s) {
      for (const u of Object.values(s.actors)) if (u.states && live(u)) each(u, (st, def) => presenceBreak(s, u, st, def));
    }
    function battleStart(s) {
      for (const u of Object.values(s.actors)) for (const id of H.C.characters?.[u.character]?.startStates || []) if (!u.states?.[id]) grant(s, u, id);
      presenceSweep(s);
      syncOffers(s);
      H.Factions?.rivalsMeet?.(s);   // rivals on the field: one log line each (factions.js)
    }
    function turnStart(s, a) {
      H.Cards?.sweep(s);   // Battle Cards C4: a zone grants and takes back its hidden rows at every unit's turn start
      H.Factions?.rivalsMeet?.(s);   // a rival who arrived since
      presenceSweep(s);   // someone who arrived since (a late ally) counts from the next turn's start
      placeSweep(s);      // a holder pushed out, or a granter gone, during someone else's turn
      syncOffers(s);      // a defeated holder's offer goes with it
      compassSweep(s);    // Treasure Hunter (TH1b): a pickup that left the field between actions takes its mark's discount with it
      each(a, (st, def) => {
        if (def.clock?.counts === "ownerTurns") { if (st.count <= 0) { finish(s, a, st, def); return; } st.count -= 1; }   // n covers n of the holder's turns
        if (adjacentBreak(s, a, st, def)) return;
        fire(s, a, st, def, "turnStart", {});
      });
    }
    function roundEnd(s) {
      for (const u of Object.values(s.actors)) if (u.curePeelUntil && !unmasks(u))
        for (const [id, until] of Object.entries(u.curePeelUntil)) if (until <= s.round) restoreLayer(s, u, id);
      H.Cards?.zoneTick(s);   // Battle Cards C4: a zone's rounds tick down before the rows' own clocks
      for (const a of Object.values(s.actors)) if (a.states) each(a, (st, def) => {
        if (def.clock?.counts === "rounds") { st.count -= 1; if (st.count <= 0) { finish(s, a, st, def); return; } }
        adjacentBreak(s, a, st, def);
      });
    }

    // ── Ability data: def.states.grant = [{ id, to: "self" | "target", turns? }]; a state's { ability } breakers.
    function afterAction(s, a, action) {
      placeSweep(s);   // any action can move a holder (a step, a shove, a pull): moved and apart breakers look after every one
      H.Cards?.sweep(s);   // Battle Cards C4: so does a zone: a unit that stepped or was pushed out loses its row, one that stepped in gains it
      compassSweep(s);   // Treasure Hunter (TH1b): a compass mark goes when its pickup does
      if (action?.type === "move" && s.terrainEffects?.length && relicPathOf(s, a)) s.terrainEffects = s.terrainEffects.filter((e) => !(e.kind === "relicPath" && e.owner === a.id));   // Relic Path: his next move spends it, walked or not
      if (action?.type !== "ability" || !action.ability) return;
      const def = abOf(action.ability);
      const at = typeof action.target === "string" ? s.actors[action.target]
        : Array.isArray(action.target) ? Object.values(s.actors).find((u) => !u.defeated && u.x === action.target[0] && u.y === action.target[1]) : null;
      for (const g of def?.states?.grant || []) {
        const R = def.area?.radius ?? 2;
        const to = g.to === "self" ? [a] : g.to === "allies" ? Object.values(s.actors).filter((u) => u.id !== a.id && live(u) && u.side === a.side && Math.max(Math.abs(u.x - a.x), Math.abs(u.y - a.y)) <= R) : at ? [at] : [];
        for (const u of to) grant(s, u, g.thematic?.[u.character] || g.id, { by: a.id, count: g.turns, cue: g.cue });   // cue: Cure (S1), the order's stored cue (flame, water or question)   // thematic: the story partner gets the stronger state
      }
      if (def?.states?.once) (a.stateOnce ||= {})[def.states.once] = a.ownerTurns;
      placeSweep(s);   // and again after the ability's own grants and moves
      if (action.ability === "remind" && live(at) && at.side === a.side && !unmasks(at)) restoreLayer(s, at);
      breakFor(s, at || a, action.ability, a);
    }
    // The holder's { ability } breakers for this ability fire now. afterAction calls it; an ability whose breaker must fire
    // before its own blow lands (the Brahmastra on Ravana's heads) calls it first from its resolve.
    function breakFor(s, on, abilityId, a) {
      if (!on?.states) return;
      const def = abOf(abilityId);
      each(on, (st, d) => {
        for (const b of d.breakers || []) {
          if (b.ability !== abilityId) continue;
          if (b.from && (b.from === "ally") !== (a.side === on.side)) continue;
          breakWith(s, on, st, d, b, `${a.name}'s ${def?.name || abilityId}`, { src: a }); break;
        }
      });
    }

    // ── Breakers that watch positions (moved, apart), swept after every action and at each turn start.
    function placeSweep(s) {
      for (const u of Object.values(s.actors)) if (u.states && live(u)) each(u, (st, def) => {
        for (const b of def.breakers || []) {
          if (b.moved && st.at && (u.x !== st.at[0] || u.y !== st.at[1])) { breakWith(s, u, st, def, b, `${u.name} stepped out`); return; }
          if (b.apart != null && st.by) { const g = s.actors[st.by];
            if (!g || !live(g) || Math.max(Math.abs(g.x - u.x), Math.abs(g.y - u.y)) > b.apart) { breakWith(s, u, st, def, b, g && live(g) ? `${g.name} is too far away` : "the one who drew it is down"); return; } }
        }
      });
    }
    // Survive the killing blow (survive.js, one base rule): damage.js asks here once. The registered rules (the Mummy's Retinue
    // Rises, the Martial Artist's Zenkai) go first, then any held state's lethal trigger (Lakshmana). Each is once a battle.
    const Spirit = () => (typeof module === "object" && module.exports ? require("../spirit/spirit.js") : globalThis.ConceptCombatSpirit) || null;
    const Survive = () => (typeof module === "object" && module.exports ? require("../survive.js") : self.ConceptCombatSurvive);
    function beforeDefeat(s, u, CH) {
      if (Survive().first(s, u, [H.Bonds?.survivor, H.ClassRuntime?.Martial?.survivor], CH)) return true;
      let saved = false;
      each(u, (st, def) => { if (saved) return;
        (def.triggers || []).forEach((t, i) => { if (saved || t.on !== "lethal") return;
          saved = Survive().survive(s, u, { id: `state:${def.id}:${i}`, holds: () => u.states?.[def.id] === st, then: () => fire(s, u, st, def, "lethal", {}) }, CH); }); });
      return saved;
    }
    // Healing of n or more at once ends a state with { healed: n } (Sanjeevani raising a felled Lakshmana).
    function healed(s, u, n) {
      if (!(n > 0) || !u?.states) return;
      each(u, (st, def) => { const b = (def.breakers || []).find((x) => x.healed != null && n >= x.healed); if (b) breakWith(s, u, st, def, b, "healed"); });
    }

    // ── AI: an ability's def.states.ai, paid only when it would change something.
    // Advice (Mala, 2026-10-24): a unit holding an advice state "considers" holding back. Damaging candidates cost
    // rules.advice.weight per valence point at or above the threshold toward whoever gave it, up to max. Stubborn units and
    // advice marked heed: false are never moved. Returns the cost (damage scale), 0 when nothing applies.
    function holdBack(s, a) {
      const R = s.rules.advice; if (!R || !a?.states || H.hasTrait(a, "stubborn")) return 0;
      let cost = 0;
      for (const inst of Object.values(a.states)) {
        const d = defOf(inst.id); if (!d?.advice || d.advice.heed === false) continue;
        const v = H.Factions?.valence(s, a, s.actors[inst.by]) ?? 0;
        if (v >= R.threshold) cost = Math.max(cost, Math.min(R.max, R.weight * (v - R.threshold + 1)));
      }
      return cost;
    }
    function aiValue(s, a, cand) {
      if (cand?.type !== "ability") return null;
      { const hv = huntAi(s, a, cand); if (hv != null) return hv; }   // Treasure Hunter (TH1b): his Survey on loot and his three techniques
      const d = abOf(cand.ability);
      if (d?.effect === "cure") return cureAi(s, a, cand);
      const w0 = d?.states?.ai; if (w0 == null) return null;
      const near = (n) => Object.values(s.actors).some((u) => live(u) && u.side !== a.side && Math.max(Math.abs(u.x - a.x), Math.abs(u.y - a.y)) <= n);
      const w = typeof w0 === "number" ? w0 : (w0.clear != null && near(w0.clear)) || (w0.below != null && a.lf > a.maxLF * w0.below) ? 0 : w0.value;
      const t = typeof cand.target === "string" ? s.actors[cand.target]
        : Array.isArray(cand.target) ? Object.values(s.actors).find((u) => !u.defeated && u.x === cand.target[0] && u.y === cand.target[1]) : null;
      const breaks = !!t && Object.keys(t.states || {}).some((id) => (defOf(id)?.breakers || []).some((b) => b.ability === cand.ability && (!b.from || (b.from === "ally") === (a.side === t.side))));
      const grants = (d.states.grant || []).some((g) => { if (g.to === "allies") return Object.values(s.actors).some((u) => u.id !== a.id && live(u) && u.side === a.side && Math.max(Math.abs(u.x - a.x), Math.abs(u.y - a.y)) <= (d.area?.radius ?? 2) && !u.states?.[g.thematic?.[u.character] || g.id]);
        const to = g.to === "self" ? a : t; return !!to && !to.states?.[g.thematic?.[to.character] || g.id]; });
      return breaks || grants ? w : 0;
    }

    // ── Reveal.
    function observed(s, observer, target) {
      each(target, (st, def) => {
        if (!def.hidden || st.revealed.includes(observer.side) || traceState(def.id) || ["spoken", "heard"].includes(def.id)) return;
        st.revealed.push(observer.side);
        if (def.id === "latent") {
          syncOffers(s);
          if (observer.side === "player") {
            const cue = abOf("quietInstruction")?.cureChoices?.[st.cue] || st.cue;
            log(s, { kind: "state", actor: observer.id, target: target.id, text: `${observer.name} sees a latent order in ${target.name}. Cue: ${cue}.` });
          }
          return;
        }
        log(s, { kind: "state", actor: observer.id, target: target.id, text: `${observer.name} sees that ${target.name} is ${def.name}.`, why: def.why ? [def.why] : [] });
      });
    }
    function visibleTo(s, unit, side) {
      const out = [];
      each(unit, (st, def) => { if (!traceState(def.id) && !["spoken", "heard"].includes(def.id) && (!def.hidden || def.id !== "latent" && unit.side === side || st.revealed.includes(side))) out.push({ id: def.id, name: def.name, text: def.text, count: st.count }); });
      return out;
    }

    return { States: { traceTarget, traceResolve, markTrace, refreshMarkTraces, cureTarget, cureResolve, cureBill, relicClaim, huntSurvey, huntTarget, huntResolve, relicPathAt, sunWardOpen, sunWardPrimed, grant, remove, refuses, refusesAbility, refusesKind, blocksAll, damageMods, afterHit, turnStart, roundEnd, afterAction, battleStart, aiValue, beforeDefeat, healed, breakFor, observed, visibleTo, defOf, holdBack, anySide, anySideOf: ANY_SIDE, unmasks, traitIgnored, RESTRAINT } };
  })();
});
