"use strict";
// Actions, the strike family: fullCourtPress, strike, grapple, throw, pressSubmission, breakGrapple.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsStrike = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { ClassRuntime, Courtroom, DIRS, EmergentIdeas, Parley, Tsukumogami, actorAt, applyEntryEffects, barrierAt, bossRules, classH, dist,
      footprint, fullCourtPressOptions, hasTrait, hit, inside, log, presidentContext, presidentRules, presidentUnits, roundFn, spendTempo,
      strikeTarget, syncPresidentUnit, tileAt } = H;
    const { addStun, barsTooFast, freeStrike, grappleChance, grappleCost, grappled, hermitCharge, sealedNext, seededChance, strikeRange, strongGrip,
      talksToAttack } = K;
    const family = {
      fullCourtPress(s,a,act) {
        const unit=s.actors[act.unit];if(!unit || unit.side!==a.side || !unit.fullCourtPress)return "Choose an ally with an unused Full Court Press relocation.";
        if(!fullCourtPressOptions(s,unit.id).some(o=>o.to[0]===act.to?.[0]&&o.to[1]===act.to?.[1]))return "Choose an open tile; movement vows and position locks still apply.";
        if(ClassRuntime){const no=ClassRuntime.beforeMove(s,unit,classH());if(no)return no;}
        unit.x=act.to[0];unit.y=act.to[1];delete unit.fullCourtPress;
        log(s,{kind:"fullCourtPress",actor:unit.id,text:`${unit.name} relocates with Full Court Press for 0 AP.`});
      },
      strike(s, a, act) {
        const reachDist = a.awakened ? (tx, ty) => Math.min(...footprint(a).map(([x, y]) => dist(s, x, y, tx, ty))) : (tx, ty) => dist(s, a.x, a.y, tx, ty);   // a big body strikes from any tile it stands on
        const awakenedBase = a.awakened ? (Tsukumogami?.data?.rules?.strikeBySize || [])[a.awakened.size] : null;   // size sets the base; effort scales it like any Strike
        if (a.status?.miseLine) delete a.status.miseLine;   // a Chef's spent-station credit belongs to the Strike that spends it: a stale one (a Strike that fizzled) never carries over
        if (Courtroom) { const no = Courtroom.violenceGate(s, H, a); if (no) return no; }   // W1.3: no brawling in court
        if(a.status?.soothed)return "Soothed: hostile actions are unavailable this turn.";
        if(a.status?.detained&&(a.status.detained.until==null||a.status.detained.until>=a.ownerTurns))return "Detained: no actions until the hold ends.";
        if ((H.Injury?.gradeOf(a, "arms") || 0) === 2) return "Maimed arms can't strike: techniques only.";
        const flowMul = s.rules.flowState?.enabled !== false && ((a.ultimateCharge ?? 0) >= (s.rules.ultimateChargeMax || 100) || !!a.form?.golden) ? s.rules.flowState?.strikeMul || 1 : 1;   // Flow state: a pocketed ult hits harder, live off the bar; gold is flow incarnate
        const arming = (s.arena.objects || []).find((o) => (o.hp ?? 0) > 0 && o.side === a.side && ((o.type === "foundry" && dist(s, a.x, a.y, o.x, o.y) <= 2) || (o.type === "keep" && Math.max(Math.abs(o.x - a.x), Math.abs(o.y - a.y)) === 1)));
        const foundryBonus = !arming ? 0 : s.actors[arming.owner]?.character === "starfarer" ? 3 : 2;   // Settlement: the line arms its strikers; Ship's Engineer: her works arm +3 (Mala, 2026-10-19)
        const [tx, ty] = act.target || []; const t = actorAt(s, tx, ty) || (s.wild.find((m) => m.form === "unit" && m.x === tx && m.y === ty) ? { ...s.wild.find((m) => m.form === "unit" && m.x === tx && m.y === ty), wild: true, side: "wild", status: {} } : null);
        if (act.aim) {
          if (!["head", "arms", "legs"].includes(act.aim)) return "Aim at head, arms, or legs.";
          if (!t || t.wild || t.defeated) return "Called shots need a standing opponent.";
        }
        // (pocket model, 2026-10-24: souls are fighters on the plane now — a strike at a soul is a
        // strike like any other. The old same-map ghost relay is gone; cipher expose still wounds the soul bar.)
        if (!t && H.fieldAt(s, tx, ty)) {   // Mala, 2026-10-11: any normal attack clears creeper
          if (reachDist(tx, ty) > strikeRange(s, a)) return strikeRange(s, a) > 1 ? `Strike reaches ${strikeRange(s, a)} tiles.` : "Strike reaches only adjacent tiles.";
          const cut = act.effort ?? s.rules.actionCosts.strikeMin, cutError = spendTempo(s, a, cut, "Strike", true); if (cutError) return cutError;
          log(s, { kind: "act", actor: a.id, tiles: [[tx, ty]], text: `${a.name} strikes at the creeper.` });
          H.clearField(s, a, [[tx, ty]]); return;
        }
        if (!t) {   // Mala, 2026-10-13: a data center can be struck by anyone who is not on its builder's side (docs/data-center.md)
          const dc = ClassRuntime?.strikeable?.(s, a, tx, ty);   // any object: a data center, a tower anchor, a bench, a tree
          if (dc) {
            if (dc.side && dc.side === a.side) return dc.tower ? "That is your own side's drone tower." : dc.object ? `That ${dc.o.name || dc.o.type} is your own side's.` : "That is your own side's data center.";
            if (reachDist(tx, ty) > strikeRange(s, a)) return strikeRange(s, a) > 1 ? `Strike reaches ${strikeRange(s, a)} tiles.` : "Strike reaches only adjacent tiles.";
            const push = act.effort ?? s.rules.actionCosts.strike;
            if (push < s.rules.actionCosts.strikeMin || push > s.rules.actionCosts.strikeMax || push % 5) return `Strike effort must be ${s.rules.actionCosts.strikeMin}–${s.rules.actionCosts.strikeMax} in 5-point steps.`;
            const pay = spendTempo(s, a, push, "Strike", true); if (pay) return pay;
            const blade0 = a.form?.strike || null, force = (awakenedBase ?? blade0?.potency ?? s.rules.strike.potency) * push / s.rules.actionCosts.strike * (H.mindset(a)?.baseMul || 1) * flowMul + foundryBonus + (a.passives?.strikePotencyAdd || 0) + (a.awakened && hasTrait(a, "heavy") ? 2 : 0);
            const what = dc.o.name || ({ plant: dc.o.common || dc.o.type }[dc.o.kind]) || dc.o.type;
            if (dc.object) log(s, { kind: "act", actor: a.id, tiles: [[tx, ty]], text: `${a.name} strikes the ${what}, investing ${push}% of a turn for ${roundFn(s)(force)} potency.`, why: ["Anything on the map can be broken."] });
            else log(s, { kind: "act", actor: a.id, tiles: [[tx, ty]], text: dc.tower ? `${a.name} strikes the ${dc.o.name || dc.o.type} carrying ${dc.owner.name}'s drone tower, investing ${push}% of a turn for ${roundFn(s)(force)} potency.` : `${a.name} strikes ${dc.owner.name}'s data center, investing ${push}% of a turn for ${roundFn(s)(force)} potency.`,
              why: [dc.tower ? "A Strike can hit an object that carries a drone tower: break the anchor and the tower falls." : "A data center is an object a Strike can hit.", ...(dc.agi ? [`${dc.agi.name} runs on it.`] : [])] });
            H.strikeObject(s, a, dc.o, force, blade0?.damageType || "nigredo");
            if (dc.o.sealedGate) sealedNext()?.syncGates?.(s);
            s.lastClashRound = s.round; return;
          }
        }
        // Entranced (targeting.js): the entranced perceive sides swapped, so a Strike sees them the same way. The AI flips
        // a.side while it decides (_entrFlip); without this, its Strike on a former ally was refused here (qa/repeats.md #9).
        if (s.sealedFight && a.boss === "sealednext" && t) {
          const SN = sealedNext();
          if (SN && !SN.canStrike(s.sealedFight, `${a.x},${a.y}`)) return "A strike starts from the shared line.";
        }
        const entr = !a._entrFlip && a.status?.entranced && (a.status.entranced.until == null || a.status.entranced.until >= a.ownerTurns);
        const seenSide = entr ? (a.side === "player" ? "enemy" : "player") : !a._entrFlip && H.States?.anySide(a) ? null : a.side;   // Cure: a loosed unit sees no side at all
        if (!t || t.side === seenSide || H.Instinct.hidden(a, t)) return "Strike needs an adjacent opponent.";
        if (Parley && !t.wild) { const no = Parley.blocks(s, a, t); if (no) return no; }   // Parley
        if (reachDist(tx, ty) > strikeRange(s, a)) return strikeRange(s, a) > 1 ? `Strike reaches ${strikeRange(s, a)} tiles.` : "Strike reaches only adjacent tiles.";
        if (!t.wild && ClassRuntime?.bowBlocked?.(s, a, t, classH())) return "The bow needs a clear line of sight.";
        const effort = act.effort ?? s.rules.actionCosts.strike;
        if (effort < s.rules.actionCosts.strikeMin || effort > s.rules.actionCosts.strikeMax + s.rules.maxOverclockPerAction || effort % 5) return `Strike effort must be ${s.rules.actionCosts.strikeMin}–${s.rules.actionCosts.strikeMax + s.rules.maxOverclockPerAction} in 5-point steps.`;
        if(presidentRules){for(const h of Object.values(s.actors)){if(!h.law||h.law.until<s.round)continue;const hu=presidentUnits(s).find(u=>u.id===h.id),au=presidentUnits(s).find(u=>u.id===a.id),r=presidentRules.breaksLaw(hu,au,{delivery:"contact"},{...presidentContext(s),round:s.round});if(r.broke){syncPresidentUnit(s,r.actor);log(s,{kind:"law",actor:a.id,target:h.id,text:`${a.name} breaks ${h.name}'s Due Process rule (contact) and becomes an outlaw.`});}}}
        if (effort > s.rules.actionCosts.strikeMax && H.mindset(a)?.noOverclock) return "Craftsman's Mindset: no overclocked Strike.";
        const free = freeStrike(s, a, t, effort), bars = talksToAttack(a);   // a Rapper with Speed-Talker: the Strike is talk too, at half the action points
        const starTax = ClassRuntime?.actor ? ClassRuntime.actor.taxFor(s, a, [t.id]) : 1;   // GDP: enemies pay ×AP to target the star; potency stays on effort
        const steel = act.steelWill ? (H.fruitRules?.steelWillAP ?? 10) : 0;   // Steel will (engine/fruit.js): +10 AP, and the blow carries will
        const prep = ClassRuntime?.mise?.strikePrep?.(s, a, effort - free);   // Mise en Place: a prepared Strike (the Chef's): AP off the effort, never below the 10 AP floor; potency stays on the effort
        const aimAp = act.aim ? (s.rules.injury?.aimAp ?? 10) : 0;
        const spendError = spendTempo(s, a, (bars ? Math.max(0, Math.round((effort - free - (prep?.save || 0)) * bars.apMul)) : effort - free - (prep?.save || 0)) * starTax * (hasTrait(a, "fourArms") ? 1.5 : 1) + steel + aimAp, "Strike", true); if (spendError) return spendError;   // Four Arms: all four swing — ×1.5 AP (potency doubles below)
        if (prep) ClassRuntime.mise.redeem(s, a, { miseStation: prep.id, miseSaved: prep.save }, classH());
        if (act.aim) { s.aimN = (s.aimN || 0) + 1; if (seededChance(`${s.seed}:aim:${a.id}:${t.id}:${s.aimN}`) < (s.rules.injury?.aimMiss ?? 0.15)) { log(s, { kind: "miss", actor: a.id, target: t.id, cause: "aimed-wide", text: `${a.name} aims for the ${act.aim} and misses clean.` }); return; } }
        if (barsTooFast(s, a, "strike")) { log(s, { kind: "act", actor: a.id, target: t.id, fizzled: true, text: `${a.name} talks too fast and the jab goes past ${t.name}.`, why: ["Speed-Talker: his attacks are talk, at half the action points, and they land 85% as often."] }); return; }
        if (free) { a.freeStrikeTurn = a.ownerTurns; log(s, { kind: "freeStrike", actor: a.id, target: t.id, text: `${a.name} strikes from the hold: ${free} action points of it cost nothing.`, why: ["Grappler: the first Strike each turn on a held opponent is free up to a balanced strike."] }); }
        const blade = a.form?.strike || null;   // an orb form's own strike (the Cyborg's energy blade, docs/brain-chip.md)
        let potency = (awakenedBase ?? blade?.potency ?? s.rules.strike.potency) * effort / s.rules.actionCosts.strike * (a.omen ? a.omen.multiplier : 1) * H.adviceMul(a) * (H.mindset(a)?.baseMul || 1) * flowMul;   // Corner advice (companions); Craftsman's Mindset; Flow state
        if (a.awakened && hasTrait(a, "heavy")) potency += 2;   // Tsukumogami: Heavy stone lands harder
        const dense = hasTrait(a, "denseMuscle"); if (dense) potency *= 2;   // Dense Muscle: a Strike is the most physical attack there is
        const quad = hasTrait(a, "fourArms"); if (quad) potency *= 2;   // Four Arms: all four fists land (stacks with Dense Muscle — eight fists)
        const autoArm = hasTrait(a, "automailLimb") ? 3 : 0; if (autoArm) potency += autoArm;   // anime batch: Winry-grade arm (flat, after Dense Muscle like the Foundry's, so it is not doubled)
        const vesselBulk = hasTrait(a, "vesselBody") ? 1 : 0; if (vesselBulk) potency += vesselBulk;   // anime batch: built to contain
        potency += foundryBonus;   // the Foundry's flat +2 lands after Dense Muscle, so it is not doubled
        const gearBlade = a.passives?.strikePotencyAdd || 0; if (gearBlade) potency += gearBlade;   // a worn weapon, flat, after multipliers
        // Lance Charge (the Knight's passive, class-builds.js): the first Strike of a turn after walking 3 or more tiles in it.
        const lance = ClassRuntime?.builds?.[a.character]?.passives?.lance_charge, charged = lance && (a.walkedThisTurn || 0) >= 3 && a.lanceTurn !== a.ownerTurns ? lance.effect.strikePotencyAdd : 0;
        const CY = s.rules.cybernetic; if (CY && H.hasTrait(a, CY.trait)) potency += CY.strike;   // Cybernetic: a flat +3
        const AS = s.rules.ascended; if (AS && H.hasTrait(a, AS.trait)) potency += AS.strike;   // Ascended: a flat +5
        if (a.birdMountain?.red) { const g = a.birdMountain.red.gear; potency = Math.floor(potency * (g === 5 ? 3 : [1.5, 2, 2.5][g - 2])); }   // ʻUlaʻula: the red multiplies the whole Strike
        const coils = H.fruitRelease ? H.fruitRelease(s, a) : { potency: 0, n: 0 }; if (coils.n) potency += coils.potency;   // Coilfruit: the stored coils let go
        if (charged) { a.lanceTurn = a.ownerTurns; potency += charged; log(s, { kind: "effect", actor: a.id, target: t.id, text: `${a.name} strikes at the end of a ${a.walkedThisTurn}-tile run: Lance Charge, +${charged}.`, why: ["Once a turn, after walking 3 or more tiles."] }); }
        const armG = H.Injury?.gradeOf(a, "arms") || 0;
        if (armG === 1) potency *= (s.rules.injury?.armsWoundedMult ?? 0.8);
        const inst = { name: blade?.name || "Strike", ability: "strike", concept: null, delivery: "contact", damageType: blade?.damageType || "nigredo" };
        if (act.aim) { inst.aimZone = act.aim; log(s, { kind: "act", actor: a.id, target: t.id, text: `${a.name} aims the strike at the ${act.aim} (+${aimAp} AP).` }); }
        if (hasTrait(a, "drunkenMonkey")) inst.directHit = true;   // Drunken Monkey Style: every attack lands direct
        if (steel) inst.carriesWill = true;
        if (coils.n) log(s, { kind: "effect", actor: a.id, target: t.id, text: `${a.name} lets ${coils.n} coil${coils.n === 1 ? "" : "s"} go: +${coils.potency} potency.`, why: ["Coilfruit: Wind the Spring stores the blow; the next Strike releases it."] });
        if (H.fruitDrift?.(s, a, t, inst)) { log(s, { kind: "act", actor: a.id, target: t.id, fizzled: true, text: `${a.name}'s strike passes through ${t.name}: Drift.`, why: ["Mistfruit: a strike that doesn't carry will misses 35% of the time. Steel will (+10 AP) lands through it."] }); hermitCharge(s, a, "strike"); return; }
        log(s, { kind: "act", actor: a.id, text: `${a.name} strikes ${t.name} (contact, no ΦF), investing ${effort}% of a turn for ${roundFn(s)(potency)} potency.${dense ? " Dense Muscle doubles it." : ""}${quad ? " Four Arms double it (×1.5 AP)." : ""}${gearBlade ? ` The weapon adds +${gearBlade}.` : ""}${autoArm ? " The automail arm adds +3." : ""}${vesselBulk ? " The vessel body adds +1." : ""}`, ...(starTax > 1 ? { why: [`Genre-Defining Performance: ×${starTax} AP to touch the star.`] } : {}) });
        strikeTarget(s, a, t, inst, potency, [`Universal strike: no concept, no edges beyond parries. ${effort} action points invested; damage scales with tempo committed.`, ...(foundryBonus ? [`The line arms the blow: +${foundryBonus} (Foundry).`] : []), ...(autoArm ? ["Automail arm +3."] : []), ...(vesselBulk ? ["Vessel body +1."] : []), ...(armG === 1 ? ["Wounded arms: −20% potency."] : [])]);
        if (coils.n && H.fruitOf?.(a)?.ripe && !t.defeated && !s.outcome) { log(s, { kind: "effect", actor: a.id, target: t.id, text: `The ripe coils let go all at once: ${t.name} is knocked back ${H.fruitPushBonus?.(s, a, t, coils.n, "push") ?? coils.n}.`, why: ["Sinkerfruit: a ripened release knocks the target back one tile per coil."] }); { const mk = s.log.length, from = [t.x, t.y]; H.knock(s, a, t, coils.n, inst, "push"); H.fruitKnocked?.(s, a, t, mk, from); } }
        hermitCharge(s, a, "strike");   // Train Hard
        if (blade?.rider && bossRules?.formRider && !s.outcome) bossRules.formRider(a, t, blade.rider, H.formCtx(s, a, t));   // learned forms: the form Strike's effect
      },
      grapple(s, a, act) {
        if (Courtroom) { const no = Courtroom.violenceGate(s, H, a); if (no) return no; }   // W1.3: no brawling in court
        const G = s.rules.grapple;
        if (a.status?.soothed) return "Soothed: hostile actions are unavailable this turn.";
        const [tx, ty] = act.target || [], t = actorAt(s, tx, ty);
        if (!t || t.side === a.side || t.defeated || H.Instinct.hidden(a, t)) return "Grapple needs an adjacent opponent.";
        if (Parley) { const no = Parley.blocks(s, a, t); if (no) return no; }
        if ((H.Injury?.gradeOf(a, "arms") || 0) === 2) return "Maimed arms can't grapple: techniques only.";
        if (dist(s, a.x, a.y, tx, ty) > G.range) return "Grapple reaches only adjacent tiles.";
        if (t.massive || t.boss) return `${t.name} is too large to hold.`;
        if (grappled(s, t)) return `${t.name} is already held.`;
        if (t.regripImmuneUntil >= s.round) return `${t.name} is still slipping free.`;   // one clear round after breaking a hold
        const spendError = spendTempo(s, a, grappleCost(s, a), "Grapple", true); if (spendError) return spendError;
        const grip = strongGrip(s, a), denseG = hasTrait(a, "denseMuscle"), CYg = s.rules.cybernetic && H.hasTrait(a, s.rules.cybernetic.trait) ? s.rules.cybernetic.grapple : 0, luckG = (H.luckBonus && !grip?.autoSucceed) ? H.luckBonus(s, a) : 0;   // W5.1 rhythm (Strong Grip needs no luck)
        let chance = grip?.autoSucceed ? 1 : Math.min(0.95, grappleChance(s, t) * (denseG ? 2 : 1) + CYg + luckG + (hasTrait(a, "fourArms") ? 0.25 : 0));   // Cybernetic: +0.25; Dense Muscle: the hold lands twice as often; Four Arms: +0.25 (more hands, surer grip)
        const armWeak = (H.Injury?.gradeOf(a, "arms") || 0) === 1 && !grip?.autoSucceed;
        if (armWeak) chance *= (s.rules.injury?.armsWoundedMult ?? 0.8);
        if (luckG) chance = Math.min(0.95, Math.max(0.05, chance));
        s.grappleN = (s.grappleN || 0) + 1;
        const won = !!grip?.autoSucceed || seededChance(`${s.seed}:grapple:${a.id}:${t.id}:${s.grappleN}`) < chance, why = grip?.autoSucceed ? ["Strong Grip: the hold always lands, whatever the defence."] : [`Grapple: ${Math.round(chance * 100)}% (${Math.round(G.base * 100)}% base${t.status.guard ? `, −${Math.round(G.guardPenalty * 100)}% against a guard` : ""}${t.status.stun ? `, +${Math.round(G.stunnedBonus * 100)}% on a stunned target` : ""}${denseG ? ", ×2 Dense Muscle" : ""}${hasTrait(a, "fourArms") ? ", +25% Four Arms" : ""}${luckG ? `, luck ${luckG > 0 ? "+" : ""}${Math.round(luckG * 100)}%` : ""}${armWeak ? ", ×0.8 wounded arms" : ""}).`];
        if (H.noteLuck && !grip?.autoSucceed) H.noteLuck(s, a, won);   // a Strong Grip hold is not a lucky success: it never rolled
        if (!won) { log(s, { kind: "grapple", actor: a.id, target: t.id, held: false, tiles: [[tx, ty]], text: `${a.name} reaches for ${t.name} and misses the hold.`, why }); return; }
        t.status.grappled = { label: "Grappled", owner: a.id, untilRound: s.round + G.rounds, at: [[t.x, t.y], [a.x, a.y]] };   // at: where both stood, so a forced move of either breaks it (conditions.js settleHolds)
        if (a.character === "police_officer" && seededChance(`${s.seed}:copsubdue:${a.id}:${t.id}:${s.grappleN}`) < 0.10) {
          t.status.detained = { until: t.ownerTurns + 2, by: a.id };
          if (t.id === a.hunting && !t.claimTrial) s.copBust = { offender: t.id, side: t.side, name: t.name };
          log(s, { kind: "grapple", actor: a.id, target: t.id, held: true, tiles: [[tx, ty]], text: `${a.name}'s hold locks in: ${t.name} is subdued on the spot.` });
        }
        const cut = G.apCut * (denseG ? 2 : 1);   // Dense Muscle: the hold takes twice the breath
        log(s, { kind: "grapple", actor: a.id, target: t.id, held: true, tiles: [[tx, ty]], text: `${a.name} gets hold of ${t.name}: no movement or dodging until the end of round ${s.round + G.rounds}, and ${cut} action points lost.`, why });
        const book = G.byTheBook, held = t.status?.cuffed && (t.status.cuffed.until == null || t.status.cuffed.until >= t.ownerTurns);   // cuffed as police.js reads it
        if (book && held && !t.defeated && hasTrait(a, book.trait)) {   // By the Book: the hold on a cuffed mark pays the fast track now
          const before = a.ultimateCharge || 0; a.ultimateCharge = Math.min(s.rules.ultimateChargeMax, before + book.cuffedCharge);
          log(s, { kind: "grapple", actor: a.id, target: t.id, held: true, text: `${a.name} works by the book: the hold on cuffed ${t.name} pays +${a.ultimateCharge - before} ultimate charge.` });
        }
        addStun(s, a, t, cut);
      },
      // Fulcrum Throw (emergent-ideas.js; rules.emergentIdeas.fulcrumThrow): lift what is on an adjacent tile and throw it.
      throw(s, a, act) {
        if (Courtroom) { const no = Courtroom.violenceGate(s, H, a); if (no) return no; }   // W1.3: no brawling in court
        const T = EmergentIdeas?.active(a).find((x) => x.id === "fulcrumThrow")?.effects;
        if (!T) return "Fulcrum Throw needs Timing and Leverage held together.";
        if (a.status?.soothed) return "Soothed: hostile actions are unavailable this turn.";
        const [px, py] = act.pick || [], [tx, ty] = act.at || [];
        if (!(dist(s, a.x, a.y, px, py) === 1)) return "Lift something on a tile beside you.";
        const unit = H.Instinct.hidden(a, actorAt(s, px, py)) ? null : actorAt(s, px, py), obj = unit ? null : s.arena.objects.find((o) => o.x === px && o.y === py && T.liftable.includes(o.type) && (o.hp == null || o.hp > 0));
        if (!unit && !obj) return "There is nothing there to lift.";
        if (unit && (unit.massive || unit.boss)) return `${unit.name} is too large to lift.`;
        if (unit && unit.side !== a.side && Parley) { const no = Parley.blocks(s, a, unit); if (no) return no; }
        if (!inside(s, tx, ty) || dist(s, a.x, a.y, tx, ty) > T.range || (tx === a.x && ty === a.y) || (tx === px && ty === py)) return `Throw to another tile within ${T.range}.`;
        const free = (x, y) => inside(s, x, y) && !tileAt(s, x, y).blocksMove && !actorAt(s, x, y) && !barrierAt(s, x, y) && !s.arena.objects.some((o) => o !== obj && o.x === x && o.y === y && o.blocksMove);
        const struck = actorAt(s, tx, ty);
        // Onto a body it glances off to the nearest open tile beside it (fixed order, so it replays the same).
        const land = struck ? DIRS.map(([dx, dy]) => [tx + dx, ty + dy]).filter(([x, y]) => free(x, y) || (x === px && y === py)).sort((p, q) => p[1] - q[1] || p[0] - q[0])[0] : free(tx, ty) ? [tx, ty] : null;
        if (!land) return "There is nowhere for it to land there.";
        const spendError = spendTempo(s, a, T.ap, "Fulcrum Throw", true); if (spendError) return spendError;
        const inst = { name: "Fulcrum Throw", ability: "fulcrumThrow", concept: "leverage", delivery: "contact", damageType: "nigredo" };
        const held = !!unit && grappled(s, unit), thing = unit ? unit.name : `the ${obj.type}`;
        log(s, { kind: "act", actor: a.id, target: unit?.id || null, emergentIdea: "fulcrumThrow", tiles: [[px, py], land], text: `${a.name} lifts ${thing} and throws ${unit ? "them" : "it"} to (${land.join(",")})${struck ? `, into ${struck.name}` : ""}.`, why: ["Fulcrum Throw: Timing + Leverage held together."] });
        if (unit) {
          if (held) unit.status.grappled = null;
          unit.x = land[0]; unit.y = land[1]; applyEntryEffects(s, a, unit, land[0], land[1], "is thrown onto");
          if (unit.side !== a.side && !unit.defeated) hit(s, a, unit, inst, T.damage * (held ? T.heldMul : 1), [`Thrown: ${T.damage} base${held ? `, ×${T.heldMul} out of a hold` : ""}.`]);
        } else { obj.x = land[0]; obj.y = land[1]; }
        if (struck && struck.side !== a.side && !struck.defeated) hit(s, a, struck, inst, unit ? T.impact : T.objectDamage, [unit ? `Struck by a thrown body: ${T.impact}.` : `Struck by a thrown ${obj.type}: ${T.objectDamage}.`]);
      },
      // Break a hold (rules.grapple.break). Certain, and dearer than the action points the hold took.
      pressSubmission(s, a, act) { if (Courtroom) { const no = Courtroom.violenceGate(s, H, a); if (no) return no; } return H.pressSubmission(s, a, act); },   // W1.3: no brawling in court; Submission (engine/conditions.js; docs/submission.md)   // Submission (engine/conditions.js; docs/submission.md)
      breakGrapple(s, a) {
        const G = s.rules.grapple;
        if (!grappled(s, a)) return `${a.name} is not held.`;
        if (a.status.submission) return "Inside a submission the struggle is the contest: win the meter to break free.";
        const holder = s.actors[a.status.grappled.owner];
        const paid = H.breakCost(s, a);   // doubled in the hold of someone with Contact Reading (spendTempo applies it)
        const spendError = spendTempo(s, a, G.break.ap, "Break hold", true); if (spendError) return spendError;
        a.status.grappled = null;
        if (G.strongGrip?.regripImmuneRounds) a.regripImmuneUntil = s.round + G.strongGrip.regripImmuneRounds;   // nobody can Grapple it again until the round after next
        log(s, { kind: "grapple", actor: a.id, target: holder?.id || null, held: false, broke: true, text: `${a.name} breaks ${holder && !holder.defeated ? `${holder.name}'s hold` : "the hold"} and can move and dodge again.`,
          why: [`Break hold: ${paid} action points${paid !== G.break.ap ? ` (${G.break.ap} doubled by Contact Reading)` : ""}, more than the ${G.apCut} the hold took. It always works.`] });
        if (holder && !holder.defeated && G.break.holderAp) {
          log(s, { kind: "grapple", actor: holder.id, target: a.id, held: false, text: `${holder.name} is winded by the lost hold: ${G.break.holderAp} action points gone.`, why: ["Losing a hold is tiring too, less than breaking one."] });
          addStun(s, a, holder, G.break.holderAp);
        }
      },
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-strike.js)`);
    Object.assign(K.handlers, family);
  })();
});
