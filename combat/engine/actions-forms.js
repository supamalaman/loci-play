"use strict";
// Actions, the forms family: palingenesis, imitate, resolveTrauma, breakOrb, enterForm, releaseForm, becomeGolden, declarePresence, displayPresence, deathVision, takeKneePresence, swap, embody, dismissEmbodiment.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsForms = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { Imitation, Presence, actorAt, bossRules, conceptName, dist, dreamSame, hasSight, hasTrait, inside, insightRules, line, log, mirrorRules,
      spendTempo } = H;
    const { bankRiteSideStep, candidates, demonstratedTraits, imitateComplete, seededChance } = K;
    const family = {
      // Palingenesis (provisional): burn one living map plant to ashes, then call that same form back once from the pile.
      // Not a concept, not a menu entry, and not a fighter. Felling, stumps, and pioneer regrow stay on the ordinary strike path.
      palingenesis(s, a, act) {
        const R = s.rules.palingenesis; if (!R) return "Palingenesis is unavailable.";
        const [x, y] = act.at || [];
        if (!inside(s, x, y)) return "Choose a tile on the map.";
        if (!dreamSame(s, a.x, a.y, x, y)) return "The sealed Dream Space blocks that.";
        if (dist(s, a.x, a.y, x, y) > R.range) return `Palingenesis reaches ${R.range} tile${R.range === 1 ? "" : "s"}.`;
        const here = (s.arena.objects || []).filter((o) => o.x === x && o.y === y);
        if (act.burn) {
          const plant = here.find((o) => o.kind === "plant" && o.hp > 0);
          // Invasive creeper (Mala, 2026-10-25: "burn plant is saying no plant is next to me even though creepers are coming up"):
          // fire clears the vine from that tile and banks the burn step, but an invasive leaves no ashes worth calling back.
          if (!plant && H.fieldAt(s, x, y)) {
            const spend = spendTempo(s, a, R.burnAp, "Burn"); if (spend) return spend;
            H.clearField(s, a, [[x, y]]);
            log(s, { kind: "ritual", actor: a.id, tiles: [[x, y]], burn: true, text: `${a.name} burns the creeper back from (${x},${y}).`, why: ["Fire clears an invasive vine. It leaves no ashes to call back: there is no form worth returning."] });
            bankRiteSideStep(s, a, "burn");
            return;
          }
          if (!plant) return "Burn a living plant (or creeper).";
          if (plant.protected) return "That plant is protected.";
          if (Object.values(s.actors).some((u) => u.communed?.object?.id === plant.id)) return "A communed plant is not residue. It is still in the fight.";
          const spend = spendTempo(s, a, R.burnAp, "Burn"); if (spend) return spend;
          const residue = {
            type: plant.type, form: plant.form, trait: plant.trait || null, maxHp: plant.maxHp ?? plant.hp,
            blocksMove: !!plant.blocksMove, material: plant.material || "plant", name: plant.name || plant.common || plant.type,
            moveCost: plant.moveCost ?? (plant.blocksMove ? 0 : 2), sightHeight: plant.sightHeight ?? 0, cover: plant.cover ?? 0,
          };
          s.arena.objects = s.arena.objects.filter((o) => o.id !== plant.id);
          const ashHp = R.ashHp;
          s.arena.objects.push({
            id: "o" + (++s.seq), kind: "ashes", type: "ashes", name: "Ashes", x, y, hp: ashHp, maxHp: ashHp, material: "plant",
            blocksMove: false, moveCost: 1, sightHeight: 0, cover: 0, protected: false, trait: null, status: {}, residue,
          });
          H.landWound?.(s, a, "plantDestroyed", 1, [[x, y]]);
          log(s, { kind: "ritual", actor: a.id, tiles: [[x, y]], burn: true, text: `${a.name} burns the ${residue.name} down to ashes. The form can be called back once.`, why: ["Scatter the ashes and there is nothing to call. A burned tree leaves no stump and no log."] });
          bankRiteSideStep(s, a, "burn");
          return;
        }
        const ash = here.find((o) => o.kind === "ashes" && o.residue);
        if (!ash) return "Call the form back from its ashes.";
        if (actorAt(s, x, y)) return "Someone is standing in the ashes.";
        const res = ash.residue;
        if (res.blocksMove && here.some((o) => o.id !== ash.id && o.blocksMove)) return "The form that returns would not fit there.";
        const spend = spendTempo(s, a, R.restoreAp, "Restore"); if (spend) return spend;
        s.arena.objects = s.arena.objects.filter((o) => o.id !== ash.id);
        const hp = Math.max(1, Math.round((res.maxHp || 1) * R.hpFrac));
        s.arena.objects.push({
          id: "o" + (++s.seq), kind: "plant", type: res.type, form: res.form, trait: res.trait, name: res.name, x, y,
          hp, maxHp: res.maxHp, material: res.material || "plant", blocksMove: !!res.blocksMove, moveCost: res.moveCost,
          sightHeight: res.sightHeight, cover: res.cover, protected: false, restored: true, status: {},
        });
        log(s, { kind: "ritual", actor: a.id, tiles: [[x, y]], restore: true, text: `${a.name} calls the ${res.name} back from the ashes (${hp} of ${res.maxHp} life).`, why: ["Once per pile. The ashes are spent. A later burn is a new pile."] });
        bankRiteSideStep(s, a, "call");
      },
      imitate(s, a, act) {   // C11: take on a psychology or values trait you have found (or, for the AI, seen demonstrated)
        if (!Imitation || !insightRules?.imitable) return "Imitation is unavailable.";
        const t = s.actors[act.target]; if (!t || t.defeated || t.id === a.id) return "There is no one there to imitate.";
        const mine = (a.controller === "player" || a.id === "player");
        const shown = demonstratedTraits(s, t.id), known = mine ? (s.insight?.knowledge?.[a.id]?.[t.id]?.revealed || []).map(id => s.insight.decks[t.id]?.cards.find(c => c.id === id)?.trait).filter(Boolean) : shown;
        const open = (s.insight?.decks?.[t.id]?.cards || []).filter(c => c.kind === "trait" && c.open).map(c => c.trait);
        const candidates = [...new Set([...known, ...(mine ? open : [])])].filter(id => insightRules.imitable(id) && hasTrait(t, id));
        const trait = act.trait || candidates.find(id => !hasTrait(a, id));
        if (!trait || !candidates.includes(trait)) return mine ? "Find a trait of theirs first (Observe); only what you have seen in them can be imitated." : "No imitable trait demonstrated yet.";
        if (!insightRules.imitable(trait)) return "That is in the body, not the mind: it cannot be imitated.";
        const temp = a.tempTraits?.[trait], carried = (s.imitation?.carried || []).includes(trait);
        if (hasTrait(a, trait) && !temp && !(a.id === "player" && carried)) return `${a.name} already has that trait.`;
        if ((s.imitated || []).some(e => e.actor === a.id && e.trait === trait)) return "You have already practised that this battle.";
        const spendError = spendTempo(s, a, Imitation.rules.ap, "Imitate"); if (spendError) return spendError;
        const dyn = insightRules.dynamicsOf(trait), difficulty = insightRules.data.imitateDifficulty(trait) || 1, demonstrated = shown.includes(trait);
        const counters = dyn.counters.filter(id => hasTrait(a, id)).length, synergies = dyn.synergies.filter(id => hasTrait(a, id)).length;
        const heat = H.heatBonus ? H.heatBonus(s, a) : 0, staked = H.stakeBonus ? H.stakeBonus(s, a) : 0;   // W5.3: heat rides free, stakes ride prepaid
        const luck = H.luckBonus ? H.luckBonus(s, a) : 0;   // W5.1 rhythm: the gambler's beat
        let p = Math.min(1, Imitation.chance({ difficulty, counters, synergies, demonstrated }) + luck);
        if (luck) p = Math.min(0.95, Math.max(0.05, p));   // rhythm clamps 5–95; heat/staked ride on top uncompressed
        p = Math.min(1, p + heat + staked);
        const name = insightRules.data.traits[trait]?.name || trait;
        s.imitateN = (s.imitateN || 0) + 1;
        const roll = seededChance(`${s.seed}:imitate:${a.id}:${trait}:${s.imitateN}`), ok = roll < p;
        if (H.noteLuck) H.noteLuck(s, a, ok);
        const why = [`${Math.round(p * 100)}% chance: difficulty ${difficulty}${counters ? `, ${counters} of your traits pull against it` : ""}${synergies ? `, ${synergies} of your traits help` : ""}${demonstrated ? ", and you have watched them act on it" : ""}${heat ? `, heat +${Math.round(heat * 100)}%` : ""}${staked ? `, staked +${Math.round(staked * 100)}%` : ""}${luck ? `, luck ${luck > 0 ? "+" : ""}${Math.round(luck * 100)}%` : ""}.`];
        if (H.settleStake) H.settleStake(s, ok);
        if (!ok) { if (H.recordRoll) H.recordRoll(s, { kind: "imitate", actor: a.id, target: t.id, trait, p, roll }); log(s, { kind: "imitate", actor: a.id, target: t.id, trait, ok: false, text: `${a.name} tries to take on ${t.name}'s ${name} and it does not fit yet.`, why }); return; }
        imitateComplete(s, a, t, trait, p, why);
      },
      resolveTrauma(s, a, act) {
        if (a.id !== "player" || !mirrorRules) return "Only the player can work through a trauma.";
        const id = act.trait;
        if (!s.mirror.resolvable.includes(id)) return "That trauma has not been met in this battle.";
        const result = mirrorRules.resolveTrauma(s.self, id);
        if (result.error) return result.error;
        const reward = result.reward.now;
        s.self = result.self;
        s.mirror.resolvable = s.mirror.resolvable.filter(x => x !== id);
        s.mirror.resolvedThisBattle.push(id);
        const permanent = result.reward.permanent.passive || {}, previousMaxAdd = a.passives?.maxLFAdd || 0;
        a.passives = { ...(a.passives || {}), ...permanent };
        const maxAdd = (a.passives.maxLFAdd || 0) - previousMaxAdd;
        if (maxAdd > 0) { a.maxLF += maxAdd; a.lf += maxAdd; }
        a.ultimateCharge = s.rules.ultimateChargeMax;
        a.lf = Math.min(a.maxLF, a.lf + reward.heal);
        a.status.catharsis = { label: "Catharsis", owner: a.id, expiresAt: a.ownerTurns + reward.status.duration + 1,
          potencyMul: reward.status.potencyMul, apPerTurnAdd: reward.status.apPerTurnAdd };
        for (const line of result.lines) log(s, { kind: "trauma", actor: a.id, trait: id, text: line, why: ["The trauma was known and its declared dream or behavior condition was met."] });
      },
      // Break an orb you carry (docs/brain-chip.md, docs/orbs.md). The form starts and the ultimate bar fills; the hit
      // itself waits for the ultimate. "Main action" is formBalance.activationAp action points.
      breakOrb(s, a, act) {
        if (!bossRules) return "Orbs are unavailable.";
        const O = bossRules.data.orbs[act.orb], cost = bossRules.data.formBalance.activationAp;
        if (!O) return "That isn't an orb.";
        if (a.tempo < cost) return `Breaking the ${O.name} needs ${cost} action points.`;
        const form = () => bossRules.transform(a, act.orb, { round: s.round, ultimateChargeMax: s.rules.ultimateChargeMax });
        const refused = form().error; if (refused) return refused;
        const spend = spendTempo(s, a, cost, `Break the ${O.name}`); if (spend) return spend;
        const result = form(); Object.assign(a, result.player);
        for (const event of result.events) log(s, { ...event, orb: act.orb, tiles: [[a.x, a.y]],
          why: [`${cost} action points. The form lasts ${a.form.turnsLeft} of ${a.name}'s turns.`, `Ultimate charge is full (${a.ultimateCharge}): the orb's ultimate is one press.`] });
      },
      // Learned forms (Mala, 2026-10-17; docs/learned-forms.md): hold one you beat out of an Omega boss (50 AP), or swear
      // Borrowed Form for 3 free turns (vow: true). releaseForm is free.
      enterForm(s, a, act) {
        if (!bossRules?.enterLearned) return "Forms are unavailable.";
        const vow = !!act.vow, cost = vow ? 0 : bossRules.data.learnedForms.enterAp;
        const refused = bossRules.canEnterLearned(a, act.form, { vow }); if (refused) return refused;
        if (cost) { if (a.tempo < cost) return `Taking a form needs ${cost} action points.`; const spend = spendTempo(s, a, cost, "Take a form"); if (spend) return spend; }
        const r = bossRules.enterLearned(a, act.form, { round: s.round, ultimateChargeMax: s.rules.ultimateChargeMax, vow });
        if (r.error) return r.error;
        Object.assign(a, r.player); for (const ev of r.events) log(s, { ...ev, tiles: [[a.x, a.y]] });
      },
      releaseForm(s, a) {
        if (!a.form?.learned && !a.form?.golden) return "You aren't holding a form you can let go of.";
        const r = bossRules.releaseForm(a); Object.assign(a, r.player); if (!r.player.form) a.form = null;
        for (const ev of r.events) log(s, { ...ev, tiles: [[a.x, a.y]] });
      },
      becomeGolden(s, a) {
        if (a.id !== "player" || !mirrorRules || !bossRules) return "The Integrated Self is unavailable.";
        const status = mirrorRules.traumaStatus(s.self);
        const ready = bossRules.integration(s.self, status, s.mirror);
        const result = bossRules.becomeGolden(a, { integrated: ready.integrated || !!s.devPlayground, ultimateChargeMax: s.rules.ultimateChargeMax });   // the DEV playground waives integration, not the full bar
        if (result.error) return `${result.error}${ready.missing.length ? ` Missing: ${ready.missing.join("; ")}.` : ""}`;
        Object.assign(a, result.player);
        for (const event of result.events) log(s, event);
      },
      declarePresence(s, a, act) {   // W2.1: Rituals ▸ Declare intent → Presence — the zero-blow path opens
        if (!Presence) return "Presence is unavailable.";
        if (a.id !== "player") return "Only the player declares (driven-only).";
        if ((a.tempo || 0) < Presence.RULES.declareAp) return `Declaring needs ${Presence.RULES.declareAp} tempo.`;
        a.tempo -= Presence.RULES.declareAp;
        const r = Presence.declare(s, H, a.id);
        if (!r.ok) { a.tempo += Presence.RULES.declareAp; return r.error; }
      },
      displayPresence(s, a, act) {   // W2.1: Talk ▸ Display — willpower pressure, zero LF, +1 shine
        if (!Presence) return "Presence is unavailable.";
        const t = s.actors[act.target];
        if (!t || t.defeated || t.side !== "enemy" || H.Instinct.hidden(a, t)) return "Display needs a standing enemy.";
        if ((a.tempo || 0) < Presence.RULES.displayAp) return `Display needs ${Presence.RULES.displayAp} tempo.`;
        if ((a.pf || 0) < Presence.RULES.displayPf) return `Display needs ${Presence.RULES.displayPf} ΦF.`;
        if (dist(s, a.x, a.y, t.x, t.y) > 6) return "Display needs them within 6.";
        a.tempo -= Presence.RULES.displayAp; a.pf -= Presence.RULES.displayPf;
        a.status = a.status || {};
        a.status.displayBeauty = Math.min(Presence.RULES.displayBeautyCap, (a.status.displayBeauty || 0) + 1);
        if (!hasSight(s, a.x, a.y, t.x, t.y)) { log(s, { kind: "presence", actor: a.id, target: t.id, text: `${a.name} shines unseen: muted. (+1 beauty still.)` }); return; }
        let p = Presence.pressure(a, t);
        if (t.status?.dread) p += 2;   // dread rider: fear makes awe land harder
        if (Presence.isMindless(t) && Presence.beautyOf(a) < Presence.RULES.bypassBeauty) p = Math.min(p, Presence.RULES.mindlessCap);
        t.willpower = Math.max(0, (t.willpower ?? 10) - p);
        log(s, { kind: "presence", actor: a.id, target: t.id, text: `${a.name} displays: ${t.name} takes ${p} willpower pressure (${t.willpower}/${t.maxWillpower ?? 10}). Zero LF.` });
        if (t.willpower <= 0) Presence.breakWill(s, H, t, a.id);
      },
      deathVision(s, a, act) {   // W2.1: Techniques ▸ Death-vision — heavy willpower + dread; the far stronger are immune
        if (!Presence) return "Presence is unavailable.";
        const t = s.actors[act.target];
        if (!t || t.defeated || t.side !== "enemy") return "Death-vision needs a standing enemy.";
        if ((t.maxWillpower ?? 10) > (a.maxWillpower ?? 10) + Presence.RULES.deathVisionMaxWpGap) return "Far too strong to awe: Death-vision finds no purchase.";
        if ((a.tempo || 0) < Presence.RULES.deathVisionAp) return `Death-vision needs ${Presence.RULES.deathVisionAp} tempo.`;
        if ((a.pf || 0) < Presence.RULES.deathVisionPf) return `Death-vision needs ${Presence.RULES.deathVisionPf} ΦF.`;
        if (dist(s, a.x, a.y, t.x, t.y) > 6) return "Death-vision needs them within 6.";
        if (!hasSight(s, a.x, a.y, t.x, t.y)) return "Unseen: no presence without eyes on you.";
        a.tempo -= Presence.RULES.deathVisionAp; a.pf -= Presence.RULES.deathVisionPf;
        const p = Presence.RULES.deathVisionBase + Math.max(0, Presence.beautyOf(a) - Presence.beautyOf(t));
        t.willpower = Math.max(0, (t.willpower ?? 10) - p);
        t.status = t.status || {}; t.status.dread = { by: a.id, untilRound: s.round + 1 };
        log(s, { kind: "presence", actor: a.id, target: t.id, text: `${a.name} shows ${t.name} death: ${p} willpower + dread (awe lands +2 while it lasts). Zero LF.` });
        if (t.willpower <= 0) Presence.breakWill(s, H, t, a.id);
      },
      takeKneePresence(s, a, act) {   // W2.1: Rest ▸ Take a knee — all broken, zero blows: victory by presence
        if (!Presence) return "Presence is unavailable.";
        if ((a.tempo || 0) < Presence.RULES.kneeAp) return `Kneeling needs ${Presence.RULES.kneeAp} tempo.`;
        a.tempo -= Presence.RULES.kneeAp;
        const r = Presence.kneel(s, H, a.id);
        if (!r.ok) { a.tempo += Presence.RULES.kneeAp; return r.error; }
      },
      swap(s, a, act) {
        if (a.tempo < s.rules.actionCosts.swap) return `Swap needs ${s.rules.actionCosts.swap} action points.`;
        if (a.pendingSwap) return "A swap is already pending.";
        const i = a.reserve.indexOf(act.concept); if (i < 0) return "That concept isn't in reserve.";
        const old = a.secondary; spendTempo(s, a, s.rules.actionCosts.swap, "Swap secondary");
        a.reserve.splice(i, 1); if (old) a.reserve.push(old);
        a.secondary = null; a.pendingSwap = act.concept;
        // dependency-bound effects of the removed secondary end now
        if (old === "barrier") {
          s.barriers = s.barriers.filter((b) => b.owner !== a.id);
          if (a.status.parry) a.status.parry = null;
          if (a.status.ward) a.status.ward = null;
        }
        log(s, { kind: "swap", actor: a.id, text: `${a.name} stows ${conceptName(old)} and equips ${conceptName(act.concept)}; it becomes usable at the start of their next turn.`,
          why: [`Effects that depended on ${conceptName(old)} end now. No secondary until then.`] });
      },
      embody(s, a, act) {   // Contains Multitudes (engine.js Multitudes): the Warden pays Inspiration to be one beaten class as well
        const no = H.Multitudes.refuses(s, a, act.classId); if (no) return no;
        H.Multitudes.embody(s, a, act.classId);
      },
      dismissEmbodiment(s, a) { const no = H.Multitudes.dismissRefuses(s, a); if (no) return no; H.Multitudes.end(s, a, "dismissed"); },
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-forms.js)`);
    Object.assign(K.handlers, family);
  })();
});
