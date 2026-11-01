"use strict";
// Auras (Mala, 2026-10-08): "if opening a full dream is like a domain expansion, then activating an aura is like
// extending a concept out around your body temporarily … a localized effect (buffs/debuffs/damage) at the cost of your
// ult charge at any time, so you dont have to fully charge it … it still ticks down when active but its not as
// expensive as having a full dream open."
//
// The aura is the unit's PRIMARY concept, carried as a ring of radius 2 that moves with the body. It costs ultimate
// charge, not a full bar: a 10-charge flare to raise it, then 10 at the start of each of the owner's turns; charge gain
// is frozen while it's up; at 0 it falls. A Dream Space is the full expansion, so opening your own dream folds the aura in.
//
//   canActivate(s, a, H) → reason | null       activate(s, a, H)   dismiss(s, a, H, why)
//   turnStart(s, a, H)                         drain, stage, then the owner's per-turn effects (mend, pulse, release)
//   damageMods(s, src, tgt, inst, H) → { mult, notes }       afterHit(s, src, tgt, dealt, H)   (Release stores force)
//   moveBudgetAdd(s, a, H)   chargeFrozen(a)   aiValue(s, a, H)   profileFor(concept)   inside(s, owner, unit, H)
//
// Imbuing the dream (Mala, 2026-10-08): "if you open a dream you should be able to imbue the barrier with your aura,
// increasing the drain significantly, ending the dream after one turn of being active". With your own Dream Space open,
// Extend Aura becomes Imbue the Dream: the aura's effect covers the whole dream (every unit counts as inside; "outside the
// ring" effects treat every enemy as across the edge), the dream's drain jumps to take the whole bar, and at your next turn
// start the per-turn effect fires one last time across the field as the dream collapses.
//   canImbue(s, a) → reason | null      imbue(s, a, H)
//
// H = { log, hit, dist } from the engine. Effects come from the concept's graph family; six concepts have their own
// art and a specific effect (sprites/auras/<art>/frame-1..4.png; the frame is the aura's stage, one per owner turn).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../graph/graph-data.js"));
  else root.ConceptCombatAuras = factory(root.ConceptCombatGraphData);
})(typeof self !== "undefined" ? self : this, function (GD) {
  const rules = { minCharge: 10, flareCost: 10, drainPerTurn: 10, apCost: 20, radius: 2, stages: 4 };

  // Family defaults: what extending a concept of that kind around the body does.
  const FAMILY = {
    structure: { effect: "ward", mul: 0.85, name: "Load Ring", text: "Allies inside (you included) take ×0.85 damage." },
    energy: { effect: "pulse", damage: 6, name: "Charged Ring", text: "At the start of your turn, every enemy inside takes 6 damage." },
    living: { effect: "mend", heal: 5, name: "Growing Ring", text: "At the start of your turn, every ally inside (you included) recovers 5 LF." },
    flow: { effect: "haste", add: 1, name: "Current Ring", text: "Allies inside get +1 movement." },
    signal: { effect: "muffle", mul: 0.85, name: "Static Ring", text: "Enemies inside deal ×0.85 damage." },
    accord: { effect: "rally", ap: 10, name: "Accord Ring", text: "At the start of your turn, +10 AP if an ally stands inside with you." },
    representation: { effect: "expose", mul: 1.1, name: "Drafted Ring", text: "Enemies inside take ×1.1 damage: the ring draws them as they are." },
  };
  // The six concepts with Mala's aura art. Each reads the concept, not just its family.
  const SPECIFIC = {
    succession: { art: "floral", effect: "mend", heal: 4, perStage: 1, name: "Blooming Succession",
      text: "The ring flowers as it invests. At the start of your turn allies inside recover 4 LF, +1 per stage (up to 7)." },
    barrier: { art: "spikey-bubble", effect: "ward", mul: 0.8, name: "Spiked Shelter",
      text: "The shell holds its ground. Allies inside take ×0.8 damage; its spikes mark the barrier but do not reflect attacks." },
    diffusion: { art: "fungal", effect: "haste", add: 1, name: "Mycelial Network",
      text: "A fungal network links the ring. Allies inside gain +1 movement while it is active." },
    boundary: { art: "edge", effect: "edge", mul: 0.8, name: "Edge Aura",
      text: "Forest meets meadow. Allies inside take ×0.8 damage from attackers outside the ring: the hit has to cross the edge." },
    sightline: { art: "prospect", effect: "prospect", mul: 1.15, refuge: 0.9, name: "Prospect Aura",
      text: "Prospect and refuge. Your hits on targets outside the ring deal ×1.15; allies inside take ×0.9 from attackers outside." },
    deception: { art: "shadow-bubble", effect: "muffle", mul: 0.8, name: "Shadow Veil",
      text: "Walls that hide what's behind them. Enemies inside deal ×0.8 damage." },
    elasticity: { art: "release", effect: "release", fraction: 0.25, cap: 24, name: "Release Aura",
      text: "Hits on allies inside load the ring (25%, up to 24). At the start of your turn it springs back as damage to enemies inside." },
    pathway: { art: "desire-path", effect: "haste", add: 2, name: "Desire Path Aura",
      text: "The worn line everyone actually walks. Allies inside get +2 movement." },
    settlement: { effect: "ward", mul: 0.85, name: "Hearth Ring",
      text: "The camp holds together. Allies inside (you included) take ×0.85 damage." },
  };
  // Auras remain concept-defined. A class can add a small, typed rider when
  // its role has a natural interaction with that concept's field.
  const CLASS_MODIFIERS = {
    maid: { selectivity: { id: "service-cycle", name: "Service Cycle",
      text: "While this Selectivity aura is active, cleared residue feeds ultimate charge directly instead of filling the receptacle. It restores the usual utility-action charge even though other gains are frozen." } },
  };
  const classModifierFor = (actor, concept = actor?.primary) => CLASS_MODIFIERS[actor?.character]?.[concept] || null;
  const ART = Object.values(SPECIFIC).map((p) => p.art);

  // Vows: Intensify scales an effect's strength (multipliers move further from 1; amounts grow).
  const scaleMul = (m, power = 1) => (m < 1 ? 1 - (1 - m) * power : 1 + (m - 1) * power);
  const scaleAmt = (n, power = 1) => Math.round(n * power);
  function applyVow(s, a, eff) {
    if (!eff || !a.aura) return;
    if (eff.radiusAdd) a.aura.radiusAdd = eff.radiusAdd;
    if (eff.drain) a.aura.drain = eff.drain;
    if (eff.power) a.aura.power = eff.power;
    if (eff.pulses && a.aura.imbued && s.dreamSpace?.owner === a.id) {   // survive one more turn start, then close at the next
      a.aura.pulses = eff.pulses;
      s.dreamSpace.drain = Math.max(1, Math.ceil((a.ultimateCharge || 0) / 2));
    }
  }
  function profileFor(concept) {
    const family = GD.nodes?.[concept]?.family || "structure";
    const p = SPECIFIC[concept] || FAMILY[family] || FAMILY.structure;
    return { concept, family, art: p.art || null, ...p };
  }
  // Aura numbers (U1, Mala 2026-10-31: "propose the change to the AI, as long as it's a universal change"). ONE source for what an
  // aura will really use, read by activate() when it is raised, by aiValue() when the AI prices raising it, and by the Extend Aura label. The
  // enemy-ring comparisons further down (aiValue's clash and denial pricing of ANOTHER unit's ring) still read the fixed rules
  // (`rules.drainPerTurn`, no `power`) while turnStart drains by `aura.drain`: latent until a trait row exists (open loop). A trait that changes the aura adds one row to traitKnobs (none exist yet: every unit gets the
  // defaults, so nothing changes for anyone until a row is added). radiusAdd widens the ring, drain replaces the per-turn charge
  // cost, power scales the effect (the three fields a Cleric vow sets on a live aura: applyVow).
  // Consecrated (the Paladin's trait, PALADIN.md; Mala 2026-10-31 "lower the cost of his aura so using techniques outpaces ULT bar loss"): the ring reaches 1 further,
  // drains 5 a turn, ×1.5 while an oath holds, and charge keeps coming at half rate (instead of being frozen) while it burns.
  const traitKnobs = { consecrated: { radiusAdd: 1, drain: 5, power: 1.5, powerWhile: "oath", rechargeMul: 0.5 } };
  function knobsFor(s, a) {
    const k = { radiusAdd: 0, drain: rules.drainPerTurn, power: 1 };
    for (const t of a?.traits || []) {
      const r = traitKnobs[typeof t === "string" ? t : t?.id];
      if (!r) continue;
      if (r.radiusAdd) k.radiusAdd += r.radiusAdd;
      if (r.drain != null) k.drain = Math.min(k.drain, r.drain);
      if (r.power) k.power *= r.power;
      if (r.powerWhile) k.powerWhile = r.powerWhile;
      if (r.rechargeMul) k.rechargeMul = Math.max(k.rechargeMul || 0, r.rechargeMul);
    }
    return k;
  }
  const oathHolds = (u) => !!u?.status?.oath && !u.status.oath.broken;
  // The power the ring has NOW: a Consecrated ring is x1.5 only while its owner's oath holds (it is read at use time, so a broken oath dims it at once).
  const powerOf = (o) => (o.aura.powerWhile === "oath" && !oathHolds(o) ? 1 : (o.aura.power || 1));
  const alive = (u) => u && !u.defeated;
  const inside = (s, owner, unit, H) => alive(owner) && alive(unit) && (owner.aura?.imbued
    ? (!owner.aura.region || Math.abs(unit.x-owner.aura.region.x)+Math.abs(unit.y-owner.aura.region.y)<=owner.aura.region.radius)
    : H.dist(s, owner.x, owner.y, unit.x, unit.y) <= rules.radius + (owner.aura?.radiusAdd || 0));
  const owners = (s) => Object.values(s.actors).filter((u) => alive(u) && u.aura);
  const cap = (x) => String(x).charAt(0).toUpperCase() + String(x).slice(1);

  function canActivate(s, a) {
    if (a.aura) return null;   // toggling off is always allowed
    if (!a.primary) return "Only a concept-bearer can extend an aura.";
    if (s.dreamSpace?.owner === a.id) return "Your Dream Space already holds the whole field; the aura is folded into it.";
    if ((a.ultimateCharge ?? 0) < rules.minCharge) return `An aura needs at least ${rules.minCharge} ultimate charge.`;
    if (a.tempo < rules.apCost) return `Extending an aura needs ${rules.apCost} action points.`;
    return null;
  }
  function activate(s, a, H) {
    const p = profileFor(a.primary);
    const classModifier = classModifierFor(a, a.primary);
    a.ultimateCharge = Math.max(0, a.ultimateCharge - rules.flareCost);
    const k = knobsFor(s, a);
    a.aura = { concept: a.primary, art: p.art, effect: p.effect, stage: 1, opened: s.round, store: 0,
      ...(classModifier ? { classModifier: classModifier.id } : {}) };
    if (k.radiusAdd) a.aura.radiusAdd = k.radiusAdd;   // only when it differs, so an ordinary aura's state is unchanged
    if (k.drain !== rules.drainPerTurn) a.aura.drain = k.drain;
    if (k.power !== 1) a.aura.power = k.power;
    if (k.powerWhile) a.aura.powerWhile = k.powerWhile;
    if (k.rechargeMul) a.aura.rechargeMul = k.rechargeMul;
    H.log(s, { kind: "aura", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} extends ${cap(a.primary)} around their body: ${p.name}.`,
      why: [p.text, ...(classModifier ? [`${classModifier.name}: ${classModifier.text}`] : []), `Costs ${rules.flareCost} ultimate charge now and ${k.drain} at the start of each of your turns; ${k.rechargeMul ? `technique charge keeps coming at ×${k.rechargeMul}` : "charge gain is frozen"} while it's up (${a.ultimateCharge} left), except for the stated class modifier.`, `Radius ${rules.radius + k.radiusAdd}; it moves with you.${k.powerWhile === "oath" ? ` Its effect is ×${k.power} while your oath holds.` : ""}`] });
    clashCheck(s, H);
  }
  function dismiss(s, a, H, why = "dismissed") {
    if (!a.aura) return;
    const p = profileFor(a.aura.concept);
    a.aura = null;
    H.log(s, { kind: "aura", actor: a.id, text: `${a.name}'s ${p.name} falls (${why}).` });
  }
  const chargeFrozen = (a) => !!a?.aura && !a.aura.rechargeMul;   // a ring with a recharge rate (Consecrated) lets technique charge through, scaled by chargeMul
  const chargeMul = (a) => a?.aura?.rechargeMul || 1;

  rules.imbueApCost = 20;
  function canImbue(s, a) {
    if (s.dreamSpace?.owner !== a.id) return "Imbuing needs your own Dream Space open.";
    if (s.dreamSpace.imbued) return "The dream is already burning out.";
    if (!a.primary) return "Only a concept-bearer can imbue the dream.";
    if (a.tempo < rules.imbueApCost) return `Imbuing the dream needs ${rules.imbueApCost} action points.`;
    return null;
  }
  // FOLD: opening a Dream Space folds your primary aura into it at once (free): the field-wide effect
  // lands even if the dream collapses that same round. The dream's own clock is untouched; burning it
  // out stays a separate 20-AP finisher. Quiet entry: unlike the burn, the fold consumes no other auras.
  function foldIn(s, a, H) {
    if (!a.primary || !s.dreamSpace || s.dreamSpace.owner !== a.id) return;
    const p = profileFor(a.primary);
    const classModifier = classModifierFor(a, a.primary);
    if (a.aura) a.aura = { ...a.aura, imbued: true, power: s.dreamSpace.concentration || 1, region: s.dreamSpace.region ? { ...s.dreamSpace.region } : null };
    else a.aura = { concept: a.primary, art: p.art, effect: p.effect, stage: 4, opened: s.round, store: 0, imbued: true,
      power: s.dreamSpace.concentration || 1, region: s.dreamSpace.region ? { ...s.dreamSpace.region } : null,
      ...(classModifier ? { classModifier: classModifier.id } : {}) };
    H.log(s, { kind: "aura", actor: a.id, text: `${a.name}'s ${p.name} folds into the Dream Space, filling the whole dream.`,
      why: [p.text + " Now it reaches every unit in the dream."] });
    perTurn(s, a, H);
  }
  function imbue(s, a, H) {
    const p = profileFor(a.primary);
    const keep = a.aura?.imbued ? a.aura : null;   // a folded aura keeps its store; the burn only lights it
    a.aura = { concept: a.primary, art: p.art, effect: p.effect, stage: 4, opened: s.round, store: keep?.store || 0, imbued: true, burning: true,
      power: s.dreamSpace.concentration || 1, region: s.dreamSpace.region ? { ...s.dreamSpace.region } : null,
      ...(keep?.classModifier ? { classModifier: keep.classModifier } : {}) };
    s.dreamSpace.imbued = true; s.dreamSpace.drain = Math.max(s.dreamSpace.drain || 0, (a.ultimateCharge || 0) + 100);   // the whole bar: it ends next turn
    H.log(s, { kind: "aura", actor: a.id, text: `${a.name} imbues the dream's edge with ${cap(a.primary)}: ${p.name} fills the whole Dream Space.`,
      why: [p.text + " Now it reaches every unit in the dream.", "The drain takes the rest of the bar: the dream ends at the start of your next turn. It fires at once, and once more as it collapses."] });
    // APEX batch16b (Mala ruling): an imbued aura instantly cancels every other aura in the dream, any side.
    // SHIELD batch16c: the cancelled aura dies shielding its owner from the imbued pulses.
    s.clashLog = s.clashLog || [];
    s.imbueSpared = {};
    for (const u of owners(s)) {
      if (u.id === a.id || !u.aura || u.aura.imbued) continue;
      const rg = a.aura.region;
      const inDream = !rg || Math.abs(u.x - rg.x) + Math.abs(u.y - rg.y) <= rg.radius;
      if (!inDream) continue;
      s.clashLog.push({ round: s.round, a: a.id, b: u.id, rA: "imbued", rB: rules.radius + (u.aura.radiusAdd || 0), result: a.id + "-imbued-wins" });
      s.imbueSpared[u.id] = true;
      dismiss(s, u, H, "consumed by the imbued dream");
    }
    perTurn(s, a, H);   // the burn fires at once, so a dream that collapses this round still delivers
  }

  function turnStart(s, a, H) {
    if (a.form?.bitten) a.form.bitten = [];
    if (!a.aura) return;
    if (!a.aura.imbued && s.dreamSpace?.owner === a.id) return dismiss(s, a, H, "folded into the Dream Space");
    if (a.aura.imbued) {   // field-wide pulse; folded rides the dream's clock, burning ends next turn (Vows: Second Pulse holds it one more)
      perTurn(s, a, H);
      if (!a.aura.burning && s.dreamSpace?.owner === a.id) return;   // folded: persists while the dream holds
      a.aura.pulses = (a.aura.pulses || 1) - 1;
      if (a.aura.pulses > 0 && s.dreamSpace?.owner === a.id) return H.log(s, { kind: "aura", actor: a.id, text: `The imbued dream holds for one more turn (Second Pulse).` });
      return dismiss(s, a, H, a.aura.burning ? "the dream it filled has burned out" : "the dream it filled is gone");
    }

    a.ultimateCharge = Math.max(0, (a.ultimateCharge ?? 0) - (a.aura.drain ?? rules.drainPerTurn));   // Vows: Slow Burn
    if (a.ultimateCharge <= 0) return dismiss(s, a, H, "the ultimate charge ran out");
    a.aura.stage = Math.min(rules.stages, a.aura.stage + 1);
    perTurn(s, a, H);
    clashCheck(s, H);
  }
  // CLASH batch16: enemy auras whose areas overlap. Larger radius wins (smaller ends); equal radii end BOTH.
  // Checked on activation + turn start. Imbued (dream-wide) auras don't clash.
  function clashCheck(s, H) {
    if (s.classicAura) return;
    const os = owners(s);
    for (let i = 0; i < os.length; i++) for (let j = i + 1; j < os.length; j++) {
      const A = os[i], B = os[j];
      if (!A.aura || !B.aura || A.aura.imbued || B.aura.imbued || A.side === B.side) continue;
      const rA = rules.radius + (A.aura.radiusAdd || 0), rB = rules.radius + (B.aura.radiusAdd || 0);
      if (H.dist(s, A.x, A.y, B.x, B.y) > rA + rB) continue;
      (s.clashLog = s.clashLog || []);
      if (rA === rB) {
        s.clashLog.push({ round: s.round, a: A.id, b: B.id, rA, rB, result: "both-end" });
        H.log(s, { kind: "aura", actor: A.id, target: B.id, text: `Equal auras clash and cancel each other out.` });
        dismiss(s, A, H, "clashed"); dismiss(s, B, H, "clashed");
      } else if (rA > rB) {
        s.clashLog.push({ round: s.round, a: A.id, b: B.id, rA, rB, result: A.id + "-wins" });
        H.log(s, { kind: "aura", actor: A.id, target: B.id, text: `${A.name}'s larger aura cancels ${B.name}'s.` });
        dismiss(s, B, H, "clashed by a larger aura");
      } else {
        s.clashLog.push({ round: s.round, a: A.id, b: B.id, rA, rB, result: B.id + "-wins" });
        H.log(s, { kind: "aura", actor: B.id, target: A.id, text: `${B.name}'s larger aura cancels ${A.name}'s.` });
        dismiss(s, A, H, "clashed by a larger aura");
      }
    }
  }
  function perTurn(s, a, H) {
    const p = profileFor(a.aura.concept), side = (u) => u.side === a.side, pw = powerOf(a);
    const foes = Object.values(s.actors).filter((u) => !side(u) && inside(s, a, u, H) && !(a.aura.imbued && s.imbueSpared?.[u.id]));
    if (a.aura.imbued) for (const u of Object.values(s.actors).filter((u) => !side(u) && inside(s, a, u, H) && s.imbueSpared?.[u.id]))
      H.log(s, { kind: "aura", actor: a.id, target: u.id, text: `${u.name}'s fallen aura shields them from the dream's pulse.` });
    const friends = Object.values(s.actors).filter((u) => side(u) && inside(s, a, u, H));
    if (p.effect === "mend") {
      const heal = scaleAmt((p.heal || 0) + (p.perStage || 0) * (a.aura.stage - 1), pw);
      for (const u of friends) {
        const before = u.lf; u.lf = Math.min(u.maxLF, u.lf + heal);
        if (u.lf > before) H.log(s, { kind: "aura", actor: a.id, target: u.id, text: `${p.name}: ${u.name} recovers ${u.lf - before} LF.` });
      }
    } else if (p.effect === "pulse" || p.effect === "release") {
      const dmg = p.effect === "pulse" ? scaleAmt(p.damage, pw) : a.aura.store;
      if (dmg > 0 && foes.length) {
        if (p.effect === "release") a.aura.store = 0;
        const inst = { ability: "aura", name: p.name, concept: a.aura.concept, delivery: "field", damageType: GD.nodes?.[a.aura.concept]?.channel || "nigredo", tier: "basic", aura: true };
        for (const f of foes) { if (s.outcome) break; H.hit(s, a, f, inst, dmg, [`${p.name}: ${p.effect === "release" ? "stored force springs back" : "the ring discharges"} on enemies inside.`]); }
      }
    } else if (p.effect === "rally" && friends.some((u) => u.id !== a.id)) {
      const ap = scaleAmt(p.ap, pw); a.tempo += ap; a.tempoCapacity += ap;
      H.log(s, { kind: "aura", actor: a.id, text: `${p.name}: an ally stands inside; +${ap} AP this turn.` });
    }
  }

  // Every aura on the field that touches this hit.
  function damageMods(s, src, tgt, inst, H) {
    const out = { mult: 1, notes: [] };
    if (!tgt || inst?.aura) return out;
    for (const o of owners(s)) {
      const p = profileFor(o.aura.concept), ally = tgt.side === o.side, tIn = inside(s, o, tgt, H);
      const sIn = src && src.x != null && inside(s, o, src, H), srcFoe = src && src.side !== o.side;
      let m = 1;
      if (p.effect === "ward" && ally && tIn) m = p.mul;
      else if (p.effect === "muffle" && srcFoe && sIn && src.id !== o.id) m = p.mul;
      else if (p.effect === "expose" && !ally && tIn) m = p.mul;
      else if (p.effect === "edge" && ally && tIn && srcFoe && (!sIn || o.aura.imbued)) m = p.mul;   // imbued: every enemy is across the edge
      else if (p.effect === "prospect") {
        if (src?.id === o.id && (!tIn || (o.aura.imbued && !ally))) m = p.mul;
        else if (ally && tIn && srcFoe && (!sIn || o.aura.imbued)) m = p.refuge;
      }
      if (m !== 1) { m = Math.round(scaleMul(m, powerOf(o)) * 1000) / 1000; out.mult *= m; out.notes.push(`${o.name}'s ${p.name}: ×${m}.`); }
    }
    return out;
  }
  // The Cyborg form's bite (docs/brain-chip.md): while the form is up and the aura he is extending is Barrier, the first
  // time each of his turns that a foe hits someone inside the ring, that foe takes form.aura.bite. Once per attacker per
  // his turn; the set clears at the start of his turn. The bite is an aura hit, so it cannot set off another bite.
  function bite(s, src, tgt, inst, H) {
    if (!src || src.defeated || src.x == null || inst?.aura) return;
    for (const o of owners(s)) {
      const B = o.form?.aura;
      if (!B || o.aura.concept !== B.concept || src.side === o.side || tgt.side !== o.side || !inside(s, o, tgt, H)) continue;
      const bitten = (o.form.bitten ||= []); if (bitten.includes(src.id)) continue;
      bitten.push(src.id);
      H.hit(s, o, src, { ability: "aura", name: "Spiked Shelter", concept: o.aura.concept, delivery: "field", damageType: B.damageType, tier: "basic", aura: true }, B.bite,
        [`${o.name}'s Spiked Shelter bites back: ${src.name} hit someone inside the ring. Once per attacker each of ${o.name}'s turns.`]);
      if (s.outcome || src.defeated) return;
    }
  }
  function afterHit(s, src, tgt, dealt, H, inst) {
    if (!(dealt > 0) || !tgt) return;
    bite(s, src, tgt, inst, H);
    for (const o of owners(s)) {
      const p = profileFor(o.aura.concept);
      if (p.effect !== "release" || tgt.side !== o.side || !inside(s, o, tgt, H)) continue;
      const before = o.aura.store;
      o.aura.store = Math.min(scaleAmt(p.cap, powerOf(o)), before + Math.round(dealt * p.fraction * powerOf(o)));
      if (o.aura.store > before) H.log(s, { kind: "aura", actor: o.id, target: tgt.id, text: `${p.name} loads ${o.aura.store - before} (${o.aura.store}/${p.cap} stored).` });
    }
  }
  function moveBudgetAdd(s, a, H) {
    let add = 0;
    for (const o of owners(s)) {
      const p = profileFor(o.aura.concept);
      if (p.effect === "haste" && o.side === a.side && inside(s, o, a, H)) add = Math.max(add, scaleAmt(p.add, powerOf(o)));
    }
    return add;
  }

  // AI: worth raising when the ring would touch something now and the bar isn't about to buy an ultimate.
  function aiValue(s, a, H) {
    if (a.aura || canActivate(s, a)) return null;
    const max = s.rules.ultimateChargeMax || 100;
    if (a.ultimateCharge >= max) return null;   // a full bar buys the ultimate or the dream instead
    const k = knobsFor(s, a);   // U1: price the ring with the numbers it will really have
    const p = profileFor(a.primary), near = (u) => H.dist(s, a.x, a.y, u.x, u.y) <= rules.radius + k.radiusAdd + 2;   // in the ring now or after a step
    const foes = Object.values(s.actors).filter((u) => alive(u) && u.side !== a.side && near(u)).length;
    const friends = Object.values(s.actors).filter((u) => alive(u) && u.side === a.side && near(u)).length;
    if (!foes) return null;
    const turns = Math.floor((a.ultimateCharge - rules.flareCost) / k.drain);
    if (turns < 1) return null;
    const perEffect = (prof, owner, nFoes, nFriends) => ({ ward: 3 * nFriends, edge: 3 * nFriends, muffle: 3 * nFoes, expose: 3 * nFoes, prospect: 4, pulse: prof.damage * nFoes,
      release: 4 * nFriends, mend: (prof.heal || 5) * nFriends * (owner.lf < owner.maxLF * 0.8 ? 1 : 0.4), haste: 2 * nFriends, rally: nFriends > 1 ? 5 : 0 }[prof.effect] || 0);
    const per = perEffect(p, a, foes, friends) * (k.powerWhile === "oath" && !oathHolds(a) ? 1 : k.power);
    let value = per * Math.min(3, turns) - 6 - (a.ultimateCharge >= max * 0.7 ? 8 : 0);
    // CLASH batch16: price defensive deployment. Kill an enemy aura (mine >= theirs) = good;
    // walking into a larger enemy aura = suicide, don't activate.
    // Clash pricing (muse, 2026-10-18, seed 3962880737): an activation that clashes immediately
    // delivers ZERO turns of its own aura, so booking sustained value + a flat bonus re-buys the
    // trade every turn (the aura war). Score it as pure denial: what the enemy aura is worth to
    // them, symmetrically, fading with every recent clash so the first trade pays and re-buys die.
    const myR = rules.radius + k.radiusAdd;
    let denial = 0, mutual = false, deniedProf = null;
    const clashOwners = [];
    if (!s.classicAura) for (const u of Object.values(s.actors)) {
      if (!alive(u) || !u.aura || u.side === a.side) continue;
      const rU = rules.radius + (u.aura.radiusAdd || 0);
      if (H.dist(s, a.x, a.y, u.x, u.y) > myR + rU) continue;
      if (rU > myR) return null;
      const up = profileFor(u.aura.concept), uNear = (w) => H.dist(s, u.x, u.y, w.x, w.y) <= rules.radius + 2;
      const uFoes = Object.values(s.actors).filter((w) => alive(w) && w.side !== u.side && uNear(w)).length;
      const uFriends = Object.values(s.actors).filter((w) => alive(w) && w.side === u.side && uNear(w)).length;
      const uTurns = Math.floor((u.ultimateCharge ?? 0) / rules.drainPerTurn);
      const denies = perEffect(up, u, uFoes, uFriends) * Math.min(3, uTurns);
      if (rU === myR) { mutual = true; clashOwners.push(u); if (denies > denial) { denial = denies; deniedProf = up; } }   // equal radii end both: pure denial, below
      else value += denies;   // mine is larger and survives: the kill is a bonus on top of my own aura
    }
    if (mutual) {
      const recent = (s.clashLog || []).filter((e) => (e.a === a.id || e.b === a.id) && s.round - (e.round ?? -99) <= 2).length;
      // EFFECT-AWARE CLASH (muse, 2026-10-19): the zero-turn trade prices what the enemy
      // aura actually does to me, not just its sticker value.
      // Kill precedence first: a clashing owner this low dies to one solid basic hit
      // (potency 8-10 in kits-data), and a dead owner drops the aura (owners/inside
      // require alive) — so the AP buys the kill, not the cancel. The owner is inside
      // clash range (<= 2 radii) by construction, within any line's reach.
      if (clashOwners.some((u) => (u.lf ?? 99) <= 8)) return null;
      // Banked-charge scaling: spending the bank on denial early wastes development — a
      // fresh bank (just above flare cost) prices near zero, a full bank near one.
      const banked = 1 - rules.flareCost / Math.max(1, a.ultimateCharge);
      // Remaining-life scaling: denial matters more with less life left to protect.
      const life = 2 - (a.lf ?? 0) / Math.max(1, a.maxLF ?? 1);
      let scaled = denial * banked * life;
      // Survival switch: their aura damages and I'm under half — canceling is survival,
      // priced at the kill scale (MOTIVE.kill = 12 in engine/ai.js).
      let survived = false;
      if (deniedProf && (deniedProf.damage || 0) > 0 && (a.lf ?? 0) < (a.maxLF ?? 1) * 0.5) { scaled += 12; survived = true; }
      // RERAISE prices what the kill forces out of them: to get the aura back they must repay an
      // activation (10 charge + 20 AP) — symmetric with the 6 my own flare costs me. It fades with
      // the denial, so the war still terminates instead of trading forever at even cost.
      value = (scaled + 6) * Math.pow(0.5, recent) - 6 - (a.ultimateCharge >= max * 0.7 ? 8 : 0);
      // ULT RESERVATION (muse, 2026-10-19, Fix 1c): the bar is the ult's fuel and raising
      // freezes it. When the ult is 1-2 turns out and ends the fight, bank for it instead
      // of spending the charge on a zero-turn trade. Weight peaks at one weak enemy
      // remaining in ult range and falls with foe count and foe HP — no damage math,
      // just the shape of the ending. A dead foe drops their aura too, so the ult is
      // also the survival answer (same logic as kill precedence).
      value *= (1 - ultVeto(s, a, H, max, survived));
    }
    return value > 0 ? value : null;
  }

  // Fix 1c veto weight, 0 (raise normally) to 1 (bank for the ult, no raise).
  function ultVeto(s, a, H, max, survived) {
    if (!H.myUlts) return 0;   // no ult data (stub H, old saves): fail open
    const turns = Math.ceil((max - (a.ultimateCharge ?? 0)) / 20);   // 20 = one concept-use per turn
    if (turns < 1 || turns > 2) return 0;   // only a reachable ult reserves the bar
    let ranges = []; try { ranges = H.myUlts(s, a.id) || []; } catch { return 0; }
    if (!ranges.length) return 0;
    const reach = Math.max(...ranges);
    const foes = Object.values(s.actors).filter((u) => alive(u) && u.side !== a.side);
    if (!foes.length) return 0;
    const inRange = foes.filter((u) => H.dist(s, a.x, a.y, u.x, u.y) <= reach);
    if (!inRange.length) return 0;
    const missing = inRange.reduce((t, u) => t + 1 - (u.lf ?? 0) / Math.max(1, u.maxLF ?? 1), 0) / inRange.length;
    let veto = (1 / foes.length) * missing;
    if (survived) veto *= (a.lf ?? 0) / Math.max(1, a.maxLF ?? 1);   // dying now can't wait 2 turns
    return Math.min(1, Math.max(0, veto));
  }

  return { rules, FAMILY, SPECIFIC, CLASS_MODIFIERS, ART, profileFor, classModifierFor, inside, canImbue, imbue, foldIn, applyVow, scaleMul, canActivate, activate, dismiss, chargeFrozen, turnStart, damageMods, afterHit, moveBudgetAdd, aiValue, knobsFor, traitKnobs, chargeMul };
});
