"use strict";
// Announced ultimates: the defensive window and responses.
// A part of the Concept Combat engine, split out of engine.js on 2026-10-11 (tools/split-engine.mjs). It is not a
// module in its own right: engine.js installs it with the host object H (everything the engine closure has in
// scope) and it hands back the functions it defines. Function bodies are exactly as they were in engine.js.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).window = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { addStun, ClassRuntime, continueTurnStart, currentId, dist, dodgeCostFor, endTurn, grappled, hit, key, log, opponentsOn, paths, resolveAbility, resolveDelayed } = H;
    const starReactionTax = (s, d, attackerId) => (ClassRuntime?.actor && attackerId ? ClassRuntime.actor.reactionTax(s, d, attackerId) : 1);   // GDP taxes reactions off the star's attacks
    const hasReflexes = (u) => (u?.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === "insaneReflexes");
    const hasAgility = (u, s) => (u?.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === "godlyAgility") && !(s && H.Tally?.binds(s, u));   // the ledger boss forgives no debt

    // ── reactive defense (Mala, 2026-10-15; docs/reactive-defense.md) ──────
    // A ranged attack you can see coming selects you, announced or not: you may answer it with one technique marked
    // `reactive` (Shield Wall on a tile of the incoming line, Rebound, Membrane). It spends the round's one reaction (the
    // same token as Guard and the dodge: "if you spend it the rest you have to endure"), its ΦF now, and its action
    // points now on your own turn or as next-turn tempo debt otherwise.
    const RD = (s) => s.rules.reactiveDefense;
    function seesItComing(s, d, inst) {
      const a = s.actors[inst.owner];
      return !!a && H.hasSight(s, d.x, d.y, a.x, a.y) && dist(s, a.x, a.y, d.x, d.y) >= (RD(s)?.minRange ?? 2);
    }
    // What the defender can know about the attack (Mala, 2026-10-15): a revealed technique says out loud what it does, so
    // the defender is told which answers it beats; an unrevealed one is judged by what each answer normally stops, and a
    // defender whose answer already failed against it this battle has learned. Revealing pays ×1.15 for that information.
    const knowsAttack = (s, d, inst) => !!s.disclosures?.[inst.owner]?.[inst.ability];
    // Deception (Mala's loop 1a1423989bf, 2026-10-17): the defender answers what it believes. A deceiver's (Deception as
    // primary or secondary) unrevealed attack shows the other kind of delivery: a line looks like a field, anything else
    // looks like a line. So a wall or Membrane goes up against a field that walks through it, and a real line shot finds
    // the defender thinking walls are useless. Revealed, already seen through (fooled once by this attacker this battle),
    // or immune to Deception (an AGI that has seen the trick): the defender sees the true delivery.
    const seesThrough = (s, d, atk) => !!s.seenThrough?.[d.id]?.[atk.id] || (d.takeoff?.immune || []).includes("deception");
    const shownDelivery = (s, d, inst, truth = false) => {
      const atk = s.actors[inst.owner];
      if (truth || RD(s)?.deceives === false || !atk || !H.hasDeception(atk) || knowsAttack(s, d, inst) || seesThrough(s, d, atk)) return inst.delivery;
      return inst.delivery === "line" ? "field" : "line";
    };
    const learnedFails = (s, d, inst, ability) => s.log.some((e) => e.kind === "answered" && e.target === d.id && e.attackAbility === inst.ability && e.attacker === inst.owner && e.ability === ability && !e.worked);
    const canPayAp = (s, d, ap) => d.id === currentId(s) ? d.tempo >= ap : hasAgility(d, s) || (d.tempoDebt || 0) + ap <= s.rules.maxTempoDebt;
    const answerAp = (s, m) => Math.ceil(m.tempoCost * (RD(s)?.answerApShare ?? 1));   // the reaction is fast: a reactive answer pays only its share of the tempo cost
    // An answer ultimate (My Answer Has Changed, docs/beam-clash.md §2): a hard reaction to any attack he sees coming, from an
    // attacker within its reach and in sight, once the bar is full (ΦF or 1 Inspiration pays: docs/inspired-ultimates.md).
    function answerReady(s, d, x, atk, def, inst) {
      return !!atk && (inst?.potency || 0) > 0 && (inst.effect === "damage" || inst.effect == null) && !atk.defeated && x.affordable && canPayAp(s, d, answerAp(s, x.m)) && dist(s, d.x, d.y, atk.x, atk.y) <= (def.answer.range ?? 5) && H.hasSight(s, d.x, d.y, atk.x, atk.y);
    }
    // The answer meets the attack and both cancel out (Mala: "in the case of this technique, it would cancel out"): the attack
    // does nothing to him; nobody takes the difference. Strength is his 22 plus stored energy, set against what was coming.
    function castAnswer(s, d, opt, attack) {
      const m = H.manifest(s, d, opt.ability), now = d.id === currentId(s), atk = s.actors[attack.owner];
      const tax = starReactionTax(s, d, attack?.owner), apCost = answerAp(s, m) * tax, inspired = H.inspiredPay(s, d, m);
      if (inspired) H.Inspiration.spend(s, d, s.rules.inspiration?.ultimatePoint ?? 1, "perform"); else d.pf -= m.cost;
      if (now) { d.tempo -= apCost; d.tempoSpent = (d.tempoSpent || 0) + apCost; } else if (!hasAgility(d, s)) d.tempoDebt = (d.tempoDebt || 0) + apCost;
      d.reaction -= 1;
      d.ultimateCharge = Math.max(0, (d.ultimateCharge || 0) - s.rules.ultimateChargeMax); if (d.status.ward?.flow) d.status.ward = null; d.flowOn = false;
      const stored = Math.min(30, s.cls?.stored?.[d.id] || 0); if (s.cls?.stored) s.cls.stored[d.id] = 0;
      const strength = (m.potency || 0) + stored, incoming = Math.round((attack.potency || 0) * (attack.mult || 1));
      (attack.answeredBy ||= []).push(d.id); if (Array.isArray(attack.targets)) attack.targets = attack.targets.filter((id) => id !== d.id);   // nothing of it reaches him: no hit, no rider
      s.stats.abilityUses[opt.ability] = (s.stats.abilityUses[opt.ability] || 0) + 1;
      H.Exposure?.used?.(s, d, opt.ability, m);
      log(s, { kind: "respond", actor: d.id, target: atk?.id, response: "technique", ability: opt.ability, answer: true, strength, incoming, apCost,
        text: `${d.name} answers ${attack.name} with ${m.name}: “${m.announce || "That doesn't work on me anymore."}” The two meet and cancel out.`,
        why: [`Answer strength ${strength} (${m.potency} + ${stored} stored) against ${attack.name}'s ${incoming} potency coming in: they cancel, and neither side takes the difference.`,
          `Paid: the full ultimate bar, ${inspired ? "1 Inspiration for the ΦF" : `${m.cost} ΦF`}, the round's reaction and ${apCost} AP${now ? "" : " as next-turn tempo debt"}.`] });
      (s.pending.answers ||= []).push({ defender: d.id, ability: opt.ability });
    }
    function reactiveOptions(s, d, inst, truth = false) {
      const R = RD(s); if (!R?.enabled || !d || d.defeated || inst.directHit || inst.quickened || inst.audienceOnly || !(d.reaction > 0)) return [];
      if (!inst.announced && !seesItComing(s, d, inst)) return [];
      const atk = s.actors[inst.owner], out = [], shown = shownDelivery(s, d, inst, truth);   // the delivery the defender believes (truth: what it would see unfooled)
      for (const x of H.availableAbilities(s, d.id)) {
        const m = x.m, def = H.ab(x.id);
        if (def?.answer) { if (answerReady(s, d, x, atk, def, inst)) out.push({ kind: "technique", ability: x.id, target: [atk.x, atk.y], apCost: answerAp(s, m), pf: H.inspiredPay(s, d, m) ? 0 : m.cost, name: m.name, answer: true, ...(H.inspiredPay(s, d, m) ? { inspired: true } : {}) }); continue; }
        if (!def?.reactive || d.pf < m.cost || !canPayAp(s, d, answerAp(s, m))) continue;
        if (learnedFails(s, d, inst, x.id)) continue;   // it failed against this technique already this battle
        const opt = (at) => ({ kind: "technique", ability: x.id, target: at, apCost: answerAp(s, m), pf: m.cost, name: m.name });
        if (m.effect === "barrier") {
          if (m.range === 0) { out.push(opt([d.x, d.y])); continue; }   // Fortress lens: a ward on yourself
          if (shown !== "line" || !atk) continue;   // a wall stops only line deliveries (as far as the defender can tell)
          const between = new Set(H.line(atk.x, atk.y, d.x, d.y).slice(1, -1).map(([x, y]) => key(x, y)));
          for (const l of H.targeting(s, d.id, x.id).legal) if (between.has(key(l.at[0], l.at[1]))) out.push(opt(l.at));
        } else if (m.effect === "parry") {   // only where the graph lets it catch: an attack that disrupts or bypasses Rebound is not offered
          const c = inst.concept, beaten = c && (H.findOpp(c, "barrier", "disrupts", inst.delivery) || H.findOpp(c, "barrier", "bypasses", inst.delivery, "ignoreParry"));
          if ((def.parry?.catches || []).includes(shown) && !(knowsAttack(s, d, inst) && (beaten || inst.ignoreParry))) out.push(opt([d.x, d.y]));
        } else if (m.effect === "membrane") { if (shown === "line" && !(knowsAttack(s, d, inst) && !(inst.concept && H.findOpp("selectivity", inst.concept, "negates", "line")))) out.push(opt([d.x, d.y])); }
      }
      return out;
    }
    // Opened by the ability handler (actions.js) for an unannounced attack. False when nobody can answer it. Previews skip
    // it, except the AI's answer model (s.answerPreview, engine/ai.js), which plays out the answer it expects.
    function openReactionWindow(s, a, inst, d) {
      const R = RD(s); if (!R?.enabled || (s.preview && !s.answerPreview) || inst.announced || inst.deception || inst.audienceOnly || inst.quickened || inst.directHit) return false;
      const eff = d.effect === "prototype" ? inst.effect : d.effect, tgt = ["prototype", "recombine"].includes(d.effect) ? inst.target : d.target;   // Innovation: judge a copy by what it became (its manifest), not the slot
      if (d.timing === "delayed" || !(inst.potency > 0) || (eff !== "damage" && d.effect !== "recombine") || !["enemy", "tile"].includes(tgt)) return false;   // an attack aimed at a unit, or at tiles you stand on
      const targets = opponentsOn(s, a, inst.tiles, false), defenders = targets.filter((t) => reactiveOptions(s, t, inst).length);
      // Deception, the other way: a line that looks like a field finds a defender who would have walled it offering
      // nothing. It lands; the defender sees what it really was, and is not fooled by this deceiver again this battle.
      for (const t of targets) { const shown = shownDelivery(s, t, inst);
        if (defenders.includes(t) || shown === inst.delivery || !reactiveOptions(s, t, inst, true).length) continue;
        ((s.seenThrough ||= {})[t.id] ||= {})[a.id] = s.round;
        log(s, { kind: "insight", actor: t.id, target: a.id, text: `${t.name} reads ${a.name}'s ${inst.name} as a ${shown} attack and lets it come: it was a ${inst.delivery} shot. Not again.`,
          why: ["Deception: the attack looked like something no answer of theirs could stop. Fooled once, they read this deceiver's attacks as they are for the rest of the battle."] });
      }
      if (!defenders.length) return false;
      s.phase = "response";
      s.pending = { inst, attacker: a.id, defenders: defenders.map((t) => t.id), responded: [], lookedAway: [], announcedTiles: inst.tiles, reactive: true };
      log(s, { kind: "incoming", actor: a.id, tiles: inst.tiles, text: `${defenders.map((t) => t.name).join(", ")} see${defenders.length === 1 ? "s" : ""} ${a.name}'s ${inst.name} coming.`,
        why: ["Reactive defense: a ranged attack you can see coming can be answered with a reactive technique (one reaction a round).",
          ...defenders.filter((t) => shownDelivery(s, t, inst) !== inst.delivery).map((t) => `To ${t.name} it looks like a ${shownDelivery(s, t, inst)} attack.`)] });
      skipUnable(s);
      return true;
    }
    function castReaction(s, d, opt, attack) {
      if (H.ab(opt.ability)?.answer) return castAnswer(s, d, opt, attack);
      const m = H.manifest(s, d, opt.ability), t = H.target(s, d, m, opt.target[0], opt.target[1], {});
      if (!t.ok) return t.error;
      const now = d.id === currentId(s);
      const tax = starReactionTax(s, d, attack?.owner), apCost = answerAp(s, m) * tax;
      d.pf -= m.cost;
      if (now) { d.tempo -= apCost; d.tempoSpent = (d.tempoSpent || 0) + apCost; } else if (!hasAgility(d, s)) d.tempoDebt = (d.tempoDebt || 0) + apCost;
      d.reaction -= 1;
      s.stats.abilityUses[opt.ability] = (s.stats.abilityUses[opt.ability] || 0) + 1;
      log(s, { kind: "respond", actor: d.id, response: "technique", ability: opt.ability, tiles: t.tiles, apCost,
        text: `${d.name} answers ${attack.name} with ${m.name} (reaction spent; ${m.cost} ΦF, ${apCost} AP ${now ? "spent now" : "charged as next-turn tempo debt"}).`,
        why: ["Reactive defense: one reaction a round. After it, the rest you endure.", ...(tax > 1 ? [`Genre-Defining Performance: ×${tax} AP to answer the star.`] : [])] });
      H.chargeUltimate(s, d, m.concept, `Using ${m.name} as a reaction.`, 0, 1, false, H.borrowedCharges(d, m));
      resolveAbility(s, d, { ...m, owner: d.id, origin: [d.x, d.y], sourceHeight: H.heightAt(s, d.x, d.y), mult: 1, tiles: t.tiles, announcedTiles: t.tiles, targets: t.targets || [], aim: t.aim || opt.target, reaction: true });   // a re-aimed big target (targeting.js) keeps its aim
      (s.pending.answers ||= []).push({ defender: d.id, ability: opt.ability });
      // Rushed: it catches only rules.reactiveDefense.rushed of a hit (damage.js lineStop / targetInteractions, resolve.js).
      // Perfect (Mala, 2026-10-17): now and then the answer is exactly right and catches everything, as a prepared one does.
      // Never rolled in a preview, so the AI cannot foresee its luck; focus traits (kMul: Perfect Concentration ×3) scale it.
      const PR = RD(s).perfect, kMul = (d.traits || []).reduce((n, t) => n * (H.insightRules?.data?.traits?.[typeof t === "string" ? t : t?.id]?.kMul ?? 1), 1);
      const pPerfect = PR && !s.preview ? Math.min(PR.cap ?? 1, PR.chance * kMul) : 0;
      const perfect = pPerfect > 0 && H.seededChance(`${s.seed}:perfect:${d.id}:${s.round}:${(s.perfectN = (s.perfectN || 0) + 1)}`) < pPerfect;
      if (perfect) log(s, { kind: "respond", actor: d.id, perfect: true, ability: opt.ability, text: `A perfect answer: ${d.name}'s ${m.name} meets ${attack.name} exactly.`,
        why: [`Perfect reactions: ${Math.round(pPerfect * 100)}% for ${d.name}${kMul !== 1 ? ` (focus ×${+kMul.toFixed(2)})` : ""}. It catches everything, as if prepared.`, ...(m.effect === "parry" ? ["A perfect Rebound that catches the hit earns Inspiration."] : [])] });
      // Fired from behind cover, a line is seen late: an ordinary answer catches less (rules.reactiveDefense.fromCover).
      const hidden = !perfect && attack?.delivery === "line" && RD(s).fromCover && H.shooterCover?.(s, s.actors[attack.owner], d.x, d.y) > 0;
      if (hidden) log(s, { kind: "respond", actor: d.id, fromCover: true, text: `${s.actors[attack.owner]?.name} fired from cover: ${d.name} sees it late.`, why: [`A rushed answer to a shot from cover catches ${Math.round(RD(s).fromCover.rushed * 100)}%, not ${Math.round((RD(s).rushed ?? 1) * 100)}%. A perfect answer still catches everything.`] });
      const caught = perfect ? 1 : hidden ? RD(s).fromCover.rushed : RD(s).rushed ?? 1;
      if (m.effect === "parry" && d.status.parry) Object.assign(d.status.parry, perfect ? { reacted: true, perfect: true, label: "Rebound (perfect)" } : { reacted: true, rushed: caught, label: "Rebound (rushed)" });   // armed by the reaction: catching this hit costs no second one
      if (m.effect === "membrane" && d.status.membrane && !perfect) Object.assign(d.status.membrane, { rushed: caught, label: "Membrane (rushed)" });
      if (m.effect === "barrier" && m.range === 0 && d.status.ward) d.status.ward.protection = Math.round(d.status.ward.protection * caught);
      if (m.effect === "barrier" && m.range !== 0 && !perfect) { const b = H.barrierAt(s, opt.target[0], opt.target[1]); if (b) b.rushed = caught; }
    }

    // ── announced ultimates: defensive window (spec §8) ────────────────────
    function responseOptions(s, d, inst) {
      if (H.Instinct.lying(d)) return [];   // a lying unit has no response window
      if(inst.audienceOnly) return d.reaction>0?[{kind:"lookAway"}]:[];
      if (d.soulless || d.husk || d.awakened) return [];   // a soulless body cannot answer: the window skips it instead of waiting on it (Mala's log, 2026-10-26). A woken structure has no reactions either.
      if (inst.submissionFinish) return d.reaction > 0 && !d.soulless ? [{ kind: "breakHold", apCost: s.rules.submission.finishBreakAp }] : [];   // Submission finish: break the hold, or submit
      if((d.lastTechniqueConcept==="focus"||d.focus?.earned)&&d.focus&&d.focus.target!==inst.owner)return [];
      if(d.status.attention&&d.status.attention.target!==inst.owner)return [];
      if (inst.directHit) return [];   // Drunken Monkey Style: too unpredictable to answer — no guard, no dodge
      const freeRead = d.freeReactionVs === inst.owner;
      const reactive = reactiveOptions(s, d, inst);
      if (s.pending?.reactive) return reactive;   // unannounced: only a reactive technique answers it
      if (d.reaction <= 0 && !freeRead) return [];
      const watching = d.status.overwatch?.expiresAt > d.ownerTurns;   // Overwatch (Muse-2): the held reaction is spent — no guard, no dodge (reactive techniques still answer)
      const opts = watching ? [] : [{ kind: "guard" }];
      if (!watching && inst.ability === "arrest" && !d.status?.kneeling && (!H.Dispatch || H.Dispatch.wantsTrial(s, d))) opts.push({ kind: "kneel" });   // answer cuffs by kneeling: claim trial (only while the docket is open; loop 1a17c856419)
      const P = paths(s, d.x, d.y, H.Injury.dodgeReach(s, d), "move");
      const area = new Set((s.pending?.announcedTiles || inst.announcedTiles || inst.tiles).map((t) => key(t[0], t[1])));
      const dodgeAp = H.Injury.dodgeCost(s, d, dodgeCostFor(s, d, inst.owner));   // C15: Restless dodges for less; GDP taxes dodges off the star's attacks
      const canPayDodge = !grappled(s, d) && (d.id === currentId(s) ? d.tempo >= dodgeAp : hasAgility(d, s) || (d.tempoDebt || 0) + dodgeAp <= s.rules.maxTempoDebt);   // Grapple: a held unit cannot dodge; godly agility: debt-free off-turn
      if (!watching && canPayDodge) for (const [k, n] of P.dist) if (n > 0) { const [x, y] = k.split(",").map(Number); const safe = !area.has(k); if (safe || !freeRead) opts.push({ kind: "reposition", to: [x, y], safe, apCost: dodgeAp }); }
      const atk = s.actors[inst.owner];
      const throwAp = H.Injury.dodgeCost(s, d, 50 * starReactionTax(s, d, inst.owner));   // a dodge-throw is a dodge: maimed legs double it too
      const canPayThrow = hasReflexes(d) && !grappled(s, d) && atk && !atk.defeated && (d.id === currentId(s) ? d.tempo >= throwAp : (d.tempoDebt || 0) + throwAp <= s.rules.maxTempoDebt);
      if (!watching && canPayThrow) for (const [k, n] of P.dist) if (n > 0) { const [x, y] = k.split(",").map(Number); const safe = !area.has(k);
        if ((safe || !freeRead) && dist(s, x, y, atk.x, atk.y) <= 6) opts.push({ kind: "dodgeThrow", to: [x, y], safe, apCost: throwAp }); }
      return opts.concat(reactive);
    }
    function openResponseWindow(s, a, inst, d) {
      const announcedTiles = inst.announcedTiles || inst.tiles;
      const defenders = inst.audienceOnly ? inst.audienceIds.map(id=>s.actors[id]).filter(Boolean) : opponentsOn(s, a, announcedTiles, false).filter((t) => !H.Instinct.lying(t));   // a lying unit gets no response window
      s.phase = "response";
      s.pending = { inst, attacker: a.id, defenders: defenders.map((t) => t.id), responded: [], lookedAway: [], announcedTiles };
      const message = inst.deception ? `I can only reach ${inst.claimedRange} tiles.` : d.announce || `Here comes ${inst.name}.`;
      log(s, { kind: "announce", actor: a.id, tiles: announcedTiles, text: inst.audienceOnly ? `${a.name} performs ${inst.name} for an audience.` : `${a.name} ${["ANNOUNCES", "ANNOUNCES", "EXPLAINS", "SHOWS EVERYTHING OF"][inst.revelation || 1]} ${inst.name}: “${message}”`,
        why: [inst.audienceOnly ? "Only the named target receives the technique. Each visible audience member may spend a reaction to look away before the signal affects them." : inst.deception ? `Declared reach: ${inst.claimedRange} tiles. The amber envelope marks the announced threat area.` : `${d.tier === "ultimate" || inst.tier === "ultimate" || inst.summonUltimateOrder ? "Announced ultimate" : "Announced attack"} ×${inst.revelationMul ?? s.rules.announceMultiplier}${(inst.revelation || 1) > 1 ? ` (${s.rules.revelation.names[inst.revelation]}: the more you give away, the harder it hits, and the more a reader can use)` : ""} (applied once). Committed area and cost are fixed now.`,
          ...defenders.map((t) => inst.directHit ? `${t.name} cannot answer it: too unpredictable (direct hit).` : t.status.overwatch?.expiresAt > t.ownerTurns ? `${t.name} holds Overwatch: no Guard or dodge while watching.` : t.freeReactionVs === a.id ? `${t.name} read the tell: the reaction is free; dodging still costs ${H.Injury.dodgeCost(s, t, dodgeCostFor(s, t, a.id))} AP.` : t.reaction > 0 ? `${t.name} may respond: Guard, or dodge up to ${H.Injury.dodgeReach(s, t)} tiles for ${H.Injury.dodgeCost(s, t, dodgeCostFor(s, t, a.id))} AP (owed next turn if responding off-turn).${hasReflexes(t) ? ` Insane Reflexes: a dodge-throw (${H.Injury.dodgeCost(s, t, 50 * starReactionTax(s, t, a.id))} AP, land within 6 of the attacker) also answers.` : ""}` : `${t.name} has no reaction left this round: no response.`)] });
      const drAnn = (s.dreamRecent ||= {}); drAnn.announcements = (drAnn.announcements || 0) + 1;   // ambient dreams hear announcements
      skipUnable(s);
    }
    function skipUnable(s) {
      const p = s.pending;
      while (p && p.responded.length < p.defenders.length) {
        const id = p.defenders[p.responded.length]; const d = s.actors[id];
        if (responseOptions(s,d,p.inst).length && (d.reaction > 0 || d.freeReactionVs === p.inst.owner) && !d.defeated && (H.Injury?.gradeOf(d, "head") || 0) !== 2) return;
        p.responded.push(id);
      }
      if (p) closeResponseWindow(s);
    }
    function respond(s, act) {
      const p = s.pending; const id = p.defenders[p.responded.length];
      if (act.actor !== id) return `Waiting for ${s.actors[id].name}'s response.`;
      const d = s.actors[id];
      if (d.soulless && act.response !== "none") return "The body lies soulless and cannot answer.";
      if ((H.Injury?.gradeOf(d, "head") || 0) === 2 && act.response !== "none") return "Too dazed to answer (maimed head: no reactions).";
      const freeRead = d.freeReactionVs === p.attacker;
      if (p.inst.submissionFinish && !['breakHold', 'none'].includes(act.response)) return 'Break the hold or tap out.';
      if (act.response === 'breakHold' && p.inst.submissionFinish) { if (d.reaction <= 0) return 'No reaction left to break the hold.'; d.reaction -= 1; d.tempoDebt = (d.tempoDebt || 0) + s.rules.submission.finishBreakAp; p.broke = true; H.slipFree(s, d, `breaks the finishing hold (${s.rules.submission.finishBreakAp} AP owed next turn)`); p.responded.push(id); skipUnable(s); return; }
      if(act.response === "lookAway"&&p.inst.audienceOnly){d.reaction-=1;p.lookedAway.push(id);log(s,{kind:"respond",actor:id,text:`${d.name} looks away from the Actor's performance (reaction spent).`});}
      else if (act.response === "guard") {
        if (!freeRead) d.reaction -= 1; else d.freeReactionVs = null;
        d.status.guard = { label: "Guard", owner: d.id, expiresAt: d.ownerTurns + 1 };
        log(s, { kind: "respond", actor: id, text: `${d.name} braces (Guard${freeRead ? ", free reaction" : ", reaction spent"}).` });
      } else if (act.response === "reposition") {
        const opt = responseOptions(s, d, p.inst).find((o) => o.kind === "reposition" && o.to[0] === (act.to || [])[0] && o.to[1] === act.to[1]);
        if (!opt) return `Dodge costs ${H.Injury.dodgeCost(s, d, dodgeCostFor(s, d, p.attacker))} AP and must be reachable within ${H.Injury.dodgeReach(s, d)} tiles; its debt limit must also allow it.`;
        const dodgeAp = opt.apCost;
        const spendsNow = d.id === currentId(s);
        if (spendsNow) { if (d.tempo < dodgeAp) return `Dodge needs ${dodgeAp} AP on this turn (have ${d.tempo}).`; d.tempo -= dodgeAp; d.tempoSpent = (d.tempoSpent || 0) + dodgeAp; }
        else if (!hasAgility(d, s)) d.tempoDebt = (d.tempoDebt || 0) + dodgeAp;   // godly agility: the debt never lands
        if (!freeRead) d.reaction -= 1; else d.freeReactionVs = null;
        d.x = opt.to[0]; d.y = opt.to[1];
        log(s, { kind: "respond", actor: id, response: "reposition", safe: !!opt.safe, apCost: dodgeAp, text: `${d.name} dodges to (${d.x},${d.y})${opt.safe ? ", out of the announced area" : ", still inside the area"}; ${dodgeAp} AP ${spendsNow ? "spent now" : hasAgility(d, s) ? "debt-free (godly agility)" : "charged as next-turn tempo debt"}${freeRead ? "; free reaction" : "; reaction spent"}.` });
      } else if (act.response === "dodgeThrow") {
        const opt = responseOptions(s, d, p.inst).find((o) => o.kind === "dodgeThrow" && o.to[0] === (act.to || [])[0] && o.to[1] === act.to[1]);
        if (!opt) return "A dodge-throw needs Insane Reflexes, the attacker within 6 of where you land, and 50 AP (debt limit included).";
        const spendsNow = d.id === currentId(s), throwAp = opt.apCost || 50;
        if (spendsNow) { if (d.tempo < throwAp) return `A dodge-throw needs ${throwAp} AP on this turn.`; d.tempo -= throwAp; d.tempoSpent = (d.tempoSpent || 0) + throwAp; }
        else if (!hasAgility(d, s)) d.tempoDebt = (d.tempoDebt || 0) + throwAp;   // godly agility: the debt never lands
        if (!freeRead) d.reaction -= 1; else d.freeReactionVs = null;
        d.x = opt.to[0]; d.y = opt.to[1];
        if (d.status?.concealed) delete d.status.concealed;
        const atk = s.actors[p.attacker], bleedTurns = 2 + ((s.log.length * 7 + s.round * 13) % 4);   // deterministic 2-5 (this H has no seededChance)
        log(s, { kind: "respond", actor: id, response: "dodgeThrow", safe: !!opt.safe, apCost: throwAp, text: `${d.name} throws mid-dodge to (${d.x},${d.y}) (${throwAp} AP${spendsNow ? " spent now" : " charged as next-turn tempo debt"}; reaction spent).` });
        if (atk && !atk.defeated) {
          const dealt = hit(s, d, atk, { name: "Shuriken", ability: null, delivery: "line", potency: 6 }, 6, [`${d.name}'s mid-dodge shuriken: 6.`], { label: "Shuriken" });
          // Ward ruling (Mala, 2026-10-18): wards are external — a shuriken that doesn't pierce leaves no bleed.
          if (dealt > 0 && !atk.defeated) { atk.status.bleed = { drain: 2, until: atk.ownerTurns + bleedTurns }; d.status.bloodyHands = { label: "Bloody Hands", owner: d.id, expiresAt: d.ownerTurns + (s.rules.rite?.bloodyHandsTurns ?? 2) }; log(s, { kind: "bleed", actor: atk.id, text: `${atk.name} bleeds (2 LF a turn, ${bleedTurns} turns).` }); }
        }
      } else if (act.response === "technique") {
        const opt = reactiveOptions(s, d, p.inst).find((o) => o.ability === act.ability && o.target[0] === (act.target || [])[0] && o.target[1] === act.target[1]);
        if (!opt) return "That technique cannot answer this attack: it must be reactive and affordable, and a wall must stand on the incoming line.";
        const r = castReaction(s, d, opt, p.inst); if (r) return r;
      } else if (act.response === "kneel") {
        if (p.inst.ability !== "arrest") return "Kneeling answers only an arrest.";
        if (d.status?.kneeling) return `${d.name} is already kneeling.`;
        if (!H.Dispatch) return "No court today.";
        if (!H.Dispatch.wantsTrial(s, d)) return "The docket is spent: there is no court left to hear a claim.";   // checked before the reaction is paid (loop 1a17c856419)
        if (!freeRead) { if (d.reaction <= 0) return "No reaction left to kneel with."; d.reaction -= 1; } else d.freeReactionVs = null;
        H.Dispatch.kneel(s, H, d.id);
        d.claimTrial = { by: p.attacker, round: s.round };
        log(s, { kind: "respond", actor: id, response: "kneel", text: `${d.name} kneels and claims trial: the court will hear it.` });
      } else if (act.response === "none") {
        if (freeRead) d.freeReactionVs = null;
        log(s, { kind: "respond", actor: id, text: `${d.name} takes it without responding (keeps the reaction).` });
      } else return "Respond with guard, reposition, dodgeThrow, kneel, technique or none.";
      p.responded.push(id);
      skipUnable(s);
    }
    // MCR-01: the turn advances only when no window is open and none waits; otherwise the attacker owes the turn end, settled when the stack drains.
    function maybeEndTurn(s, a) {
      if (s.outcome || s.preview || !a || a.tempo > 0 || currentId(s) !== a.id) return;
      if (s.pending || (s.pendingStack || []).length) { s.turnEndOwed = a.id; return; }
      endTurn(s);
    }
    function closeResponseWindow(s) {
      closeInner(s);
      const outer = (s.pendingStack || []).pop();   // MY-04: a reveal-nested window restores the waiting attack instead of ending the turn's business
      if (outer && !s.outcome) {
        if (s.pending) { (s.pendingStack ||= []).push(outer); return; }   // MCR-01: resolution opened a child response; it finishes before the parent restores
        s.pending = outer; s.phase = "response"; skipUnable(s);
      }
      if (!s.pending && !(s.pendingStack || []).length && s.turnEndOwed && !s.outcome && !s.preview) {
        const o = s.actors[s.turnEndOwed]; s.turnEndOwed = null;
        if (o && o.tempo <= 0 && currentId(s) === o.id) endTurn(s);
      }
    }
    function closeInner(s) {
      const p = s.pending; s.pending = null; s.phase = "action";
      const a = s.actors[p.attacker];
      if (p.inst.submissionFinish) {   // nobody broke it: the finish lands
        const t = s.actors[p.inst.target]; if (!p.broke && t && !t.defeated) H.submitFoe(s, a, t, `${t.name} did not break the finish.`);
        H.checkOutcome?.(s);
        if (p.resumeTurnStart && !s.outcome) { continueTurnStart(s); return; }   // MCR-01: this window paused turn start; resume it instead of ending the turn
        maybeEndTurn(s, a);
        return;
      }
      log(s, { kind: "resolve", actor: a.id, text: `${p.inst.name} resolves on its committed tiles.` });
      if (p.inst.deception) for (const observer of Object.keys(s.knowledge)) if (s.knowledge[observer][a.id]) s.knowledge[observer][a.id].abilities[p.inst.ability] = true;
      if (p.resume) {   // a delayed effect at someone's turn start: finish it, then the rest of that turn start
        resolveDelayed(s, p.attacker, p.inst);
        if (!s.outcome) continueTurnStart(s);
        return;
      }
      if (p.inst.summonUltimateOrder) {
        log(s, { kind: "summonOrder", actor: p.inst.owner, target: p.inst.summonId, text: `The response window closes. The summon ultimate remains committed and will fire on its summon's next turn.` });
        if (p.resumeTurnStart && !s.outcome) { continueTurnStart(s); return; }   // MCR-01: this window paused turn start; resume it instead of ending the turn
        maybeEndTurn(s, a);
        return;
      }
      const mark = s.log.length;
      resolveAbility(s, a, p.inst);
      H.finishDreamUltimate(s, a, p.inst);
      // Did each answer work? Both sides learn from it (ai.js lessons): the attacker that this target answers this kind of
      // shot, the defender that this answer fails against this technique.
      for (const ans of p.answers || []) {
        const d = s.actors[ans.defender]; if (!d) continue;
        const after = s.log.slice(mark), taken = after.filter((e) => e.kind === "damage" && e.actor === a.id && e.target === d.id).reduce((n, e) => n + (e.amount || 0), 0);
        // Worked: the answer caught something (a rushed answer catches its share and the rest lands). Failed: disrupted or bypassed.
        const worked = taken === 0 || after.some((e) => (e.kind === "parry" && e.actor === d.id) || (e.kind === "negate" && e.barrierOwner === d.id)
          || (e.kind === "damage" && e.target === d.id && (e.why || []).some((w) => /rushed (Shield Wall|Membrane)/.test(w))));
        log(s, { kind: "answered", attacker: a.id, target: d.id, actor: d.id, ability: ans.ability, attackAbility: p.inst.ability, delivery: p.inst.delivery, concept: p.inst.concept, stopped: taken === 0, worked, taken,
          text: taken === 0 ? `${d.name}'s ${H.ab(ans.ability).name} answered ${p.inst.name}: nothing got through.` : worked ? `${d.name}'s rushed ${H.ab(ans.ability).name} caught part of ${p.inst.name}: ${taken} LF got through.` : `${d.name}'s ${H.ab(ans.ability).name} did not stop ${p.inst.name}: ${taken} LF got through.` });
      }
      for (const ans of p.answers || []) {   // fooled once by this deceiver: the defender sees through its tricks for the rest of the battle
        const d = s.actors[ans.defender], last = [...s.log].reverse().find((e) => e.kind === "answered" && e.actor === ans.defender);
        const shown = d && shownDelivery(s, d, p.inst);
        if (!d || !last || last.worked || shown === p.inst.delivery) continue;
        ((s.seenThrough ||= {})[d.id] ||= {})[a.id] = s.round;
        log(s, { kind: "insight", actor: d.id, target: a.id, text: `${d.name} sees through ${a.name}'s trick: that ${p.inst.name} was never a ${shown} attack.`,
          why: ["Fooled once, the defender reads this deceiver's attacks as they really are for the rest of the battle."] });
      }
      if(p.inst.audienceOnly) for(const id of p.inst.audienceIds.filter(id=>!p.lookedAway.includes(id))){const audience=s.actors[id];if(audience&&!audience.defeated)addStun(s,a,audience,p.inst.audienceTempo||8);}
      if (p.resumeTurnStart && !s.outcome) continueTurnStart(s);   // MCR-01: this window paused turn start; the attack above is resolved, resume it
      else maybeEndTurn(s, a);
    }

    return { responseOptions, reactiveOptions, openReactionWindow, openResponseWindow, skipUnable, respond, closeResponseWindow };
  })();
});
