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
    const quiet = (def, inst) => !!def.hidden && !inst.revealed.length;
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
          each(h, (st, def) => { if (def.offers?.ability && !ids.includes(def.offers.ability) && (def.offers.to || "allies") === (h.id === u.id ? "self" : "allies")) ids.push(def.offers.ability); });
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
      each(a, (st, def) => {
        if (def.clock?.counts === "ownerTurns") { if (st.count <= 0) { finish(s, a, st, def); return; } st.count -= 1; }   // n covers n of the holder's turns
        if (adjacentBreak(s, a, st, def)) return;
        fire(s, a, st, def, "turnStart", {});
      });
    }
    function roundEnd(s) {
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
      const d = abOf(cand.ability), w0 = d?.states?.ai; if (w0 == null) return null;
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
        if (!def.hidden || st.revealed.includes(observer.side)) return;
        st.revealed.push(observer.side);
        log(s, { kind: "state", actor: observer.id, target: target.id, text: `${observer.name} sees that ${target.name} is ${def.name}.`, why: def.why ? [def.why] : [] });
      });
    }
    function visibleTo(s, unit, side) {
      const out = [];
      each(unit, (st, def) => { if (!def.hidden || unit.side === side || st.revealed.includes(side)) out.push({ id: def.id, name: def.name, text: def.text, count: st.count }); });
      return out;
    }

    return { States: { grant, remove, refuses, refusesAbility, refusesKind, blocksAll, damageMods, afterHit, turnStart, roundEnd, afterAction, battleStart, aiValue, beforeDefeat, healed, breakFor, observed, visibleTo, defOf, holdBack, anySide, anySideOf: ANY_SIDE, unmasks, traitIgnored, RESTRAINT } };
  })();
});
