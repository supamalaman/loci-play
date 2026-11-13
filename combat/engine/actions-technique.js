"use strict";
// Actions, the technique family: ability.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsTechnique = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { CRAFT, CRAFT_OWN, ClassRuntime, Courtroom, Director, MaidSystems, Performers, Postures, Vows, ab, abilitiesOf, actorAt, borrowedCharges,
      chargeUltimate, classH, conceptName, declaredRange, dreamSpaceRules, hasDeception, hasSight, hasTrait, heightAt, insightRules, log, manifest,
      ownerOfConcept, presidentContext, presidentEffects, presidentRules, presidentUnits, rangeEnvelope, spendTempo, syncPresidentUnit, target } = H;
    const { barsTooFast, openResponseWindow, resolveAbility, sealedNext } = K;
    const family = {
      ability(s, a, act, internal) {   // MY-02: prepaid authority rides the internal 4th arg (verified card-consumption only); a smuggled public field buys nothing
        if (typeof act.ability === "string" && act.ability.startsWith("boss_sealednext_")) {
          const SN = sealedNext();
          if (!SN) return "That technique is not in this fight.";
          const block = SN.castBlock(s, a, act.ability);
          if (block) return block;
          const before = a.pf;
          const spend = spendTempo(s, a, 30, "Technique");
          if (spend) return spend;
          const err = SN.castFromActor(s, a, act.ability);
          if (err) { a.pf = before; return err; }
          log(s, { kind: "act", actor: a.id, ability: act.ability, text: `${a.name} uses ${ab(act.ability)?.name || "a technique"}.` });
          return;
        }
        const songError=Performers?.beforeAbility(s,a,{...ab(act.ability),ability:act.ability});if(songError)return songError;
        if (Courtroom) { const no = Courtroom.violenceGate(s, H, a); if (no) return no; }   // W1.3: no brawling in court
        if ((a.sealedTechs || []).includes(act.ability)) return `${ab(act.ability)?.name || act.ability} is sealed by the court: cast nothing sealed.`
        if (a.status?.offTempo && act.ability === a.status.offTempo.banned && (a.status.offTempo.expiresAt ?? 99) > (a.ownerTurns ?? 0)) return `${ab(act.ability)?.name || act.ability} is off-tempo: Fixed Gaze forbids the last technique for a round.`;   // hotbuilds W1b: the primed answer's price
        if (a.status?.sealed && ab(act.ability)?.tier !== "basic") return `${ab(act.ability)?.name || act.ability} is sealed (${a.status.sealed.by || "debt"}): techniques and ults are closed; basics remain.`;   // W1.3: confiscation binds
        if (!abilitiesOf(a).includes(act.ability)) return "That ability isn't available with this loadout.";
        { const sea = H.fruitBlocked?.(s, a, act.ability, act); if (sea) return sea; }   // Sinkerfruit: damped by water, soaking or cuffs
        { const held = H.Tally?.heldReason(s, a, act.ability); if (held) return held; }   // collateral (engine/tally.js)
        if (Vows) { const no = Vows.refuses(s, a, "ability", ab(act.ability)); if (no) return no; }   // Vows: Single Mind, Burned Bridge
        if (Vows && act.ability === "audition") { const no = Vows.validate("role", act.vow, a, s.rules.inspiration, s); if (no) return no; }   // role vows ride the audition
        const m = manifest(s, a, act.ability, act);
        if (ab(act.ability)?.answerOnly) return `${m.name} answers; it cannot be cast.`;   // answer-only techniques (Fixed Gaze) never commit own-turn (triage 2026-11-04)
        { const cres = ab(act.ability)?.crescendo; if (cres) m.crescendo = cres; }   // the manifest is fresh: carry the def's Crescendo bend on it (engine.js is at its size cap)
        { const no = H.Inspiration.crescendoRefuses(s, a, m); if (no) return no; }   // a Crescendo technique needs its Inspiration and only one is in force (ledgers.js)
        const crescendoFree = H.Inspiration.crescendoFree(s, a, act.ability, m); if (crescendoFree) Object.assign(m, { tempoCost: 0, cost: 0, lfPrice: 0 });   // the bend: this cast is free (stamped at commit)
        { const off = ClassRuntime?.ma?.discount(a) || 0; if (off && m.cost > 0) { m.cost = Math.max(0, m.cost - off); m.maDiscounted = true; } }   // Ma: The Space Between's discount on the next technique
        const sigFrom = act.from ? H.validSignalOrigin(s, a, m, act.from) : null;
        if (act.from && !sigFrom.ok) return sigFrom.error;
        const src = sigFrom?.ok ? { ...a, x: act.from[0], y: act.from[1] } : a;   // signal origin (machine P3): geometry reads the marker tile; costs stay on the caster
        const quickened = act.quickened || null;
        if (a.quickenedSpent?.[act.ability]) return "This ultimate was spent by Last Word for the rest of the battle.";
        if (quickened && !["snap", "lastWord"].includes(quickened)) return "Unknown Quickened mode.";
        if (quickened && (act.announce || act.deception || m.timing === "delayed" || m.effect !== "damage")) return "Quickened actions must be immediate attacks without an announcement or deceptive tell.";
        if (quickened === "lastWord" && m.tier !== "ultimate") return "Last Word can only spend an ultimate.";
        if (quickened === "snap" && !["basic", "refined", "ultimate"].includes(m.tier)) return "Snap requires a damaging technique.";
        const extraTempo = Math.max(0, Math.floor(act.overclock || 0));
        const freeFirst = H.freeFirstFree?.(a, m);   // hotbuild free first use (W0b): hoisted — the early tempo gate must agree with the menu (triage 2026-11-04)
        const detailTax = !crescendoFree && hasTrait(a, "attentionToDetail") && m.effect === "barrier" ? 5 : 0;   // Attention to Detail: sturdier craft costs slightly
        if (extraTempo && H.mindset(a)?.noOverclock) return "Craftsman's Mindset: no overclocking.";
        if (extraTempo > s.rules.maxOverclockPerAction || extraTempo % 5) return `Overclock must be in 5-point steps up to ${s.rules.maxOverclockPerAction} AP.`;
        if (extraTempo && !["damage", "field"].includes(m.effect)) return "Only attacks can be overclocked.";
        if (!internal?.prepaid && !freeFirst && a.tempo < m.tempoCost + detailTax && !extraTempo) return `${m.name} needs ${m.tempoCost + detailTax} action points (have ${a.tempo}); choose overclock to borrow against a future turn.`;
        if (m.scribedEffects?.some(e=>e.requires?.includes("observedIncomingChannel")) && !a.lastDamageType) return "This effect needs an observed incoming harm channel before casting.";
        if (act.ability === "adaptiveBrace" && !a.lastDamageType) return "Adaptive Brace needs an observed incoming attack before it can attune.";
        if (act.ability === "measureTwice" && (a.tempoDebt || 0) > 0) return "Care cannot be taken in haste: pay off your tempo debt first.";
        if (act.ability === "measureTwice" && a.status?.care?.turn === a.ownerTurns) return "You are already taking care this turn.";
        if (act.ability === "honedEdge" && !a.lastTechnique) return "Use the technique you mean to practise first; Honed Edge hones the last one you used.";
        if (act.ability === "honedEdge" && a.practice?.ability === a.lastTechnique) return `You are already practising ${ab(a.lastTechnique).name}.`;
        if (act.ability === "masterwork" && !(a.practice?.stacks > 0)) return "Masterwork needs practice behind it: hone a technique and use it first.";
        { const no = H.Tally?.creditRefuses?.(s, a, act); if (no) return no; }   // Credit (five concepts K1): one loan per lender; the ultimate needs a debt in reach
        if (a.promise?.surrender === act.ability) return `Your Public Promise has surrendered ${ab(act.ability).name} until it resolves.`;
        if (ClassRuntime && !s.preview) { const ce = ClassRuntime.beforeAbility(s, a, { ...m, id: act.ability }, classH()); if (ce) return ce; }
        if (!s.preview && m.tier === "ultimate") H.Inspiration.witness(s, a, "seesUltimate", a.id);   // Inspiration: seeing an ultimate   // ClassRuntime: vows, laws, silence, dependence
        if (presidentEffects.has(m.effect)) {
          if (!presidentRules) return "President rules are unavailable.";
          if (m.effect === "presidentDirection" && !presidentRules.officeValid(presidentUnits(s).find(u=>u.id===a.id))) return "Executive Direction needs a valid office.";
          if (m.effect === "presidentLaw" && !presidentRules.officeValid(presidentUnits(s).find(u=>u.id===a.id))) return "Due Process needs a valid office.";
          if (m.effect === "presidentGuarantee" && !a.promise) return "Credible Guarantee needs an active promise.";
          if (m.effect === "presidentOffice" && (a.debt || a.exposedFalseClaim)) return "Credibility Debt or an exposed false claim prevents taking office.";
          if (m.effect === "presidentAccord" && !(a.primary === "legitimacy" && a.secondary === "strategic_commitment" && presidentRules.officeValid(presidentUnits(s).find(u=>u.id===a.id)))) return "The Accord Holds needs both concepts and a valid office.";
          if (m.effect === "presidentPromise" && !act.objective && act.target && actorAt(s,...act.target)?.side===a.side && (act.target[0]!==a.x||act.target[1]!==a.y)) return "A promise target must be an opponent or an empty tile.";
        }
        if (m.effect === "grandConjunction" && !(s.terrainEffects||[]).some(e=>e.kind==="star"&&e.owner===a.id&&s.actors[e.owner]?.ownerTurns<e.expiresAt)) return "An empty sky: chart at least one star first (no cost).";
        if(act.ability==="longView"&&a.moved)return "Long View requires you to stand still for the entire turn; cast it before moving.";
        if (act.deception && !act.announce) return "A deceptive range is only a modification to an announced ultimate.";
        if (act.deception && m.tier !== "ultimate") return "Only ultimates can carry a deceptive tell.";
        if (act.deception && !hasDeception(a)) return "Equip Deception as a primary or secondary concept to make a false-range announcement.";
        if (act.deception && a.noDeceptionUntil >= s.round) return "The contradiction was exposed; this character cannot use Deception this round.";
        if (act.deception && ab(act.ability).timing === "delayed") return "Delayed abilities cannot use a false-range announcement in this prototype.";
        if (act.deception && (act.reveal || s.disclosures[a.id][act.ability] || Object.values(s.knowledge).some(k => k[a.id]?.abilities[act.ability]))) return "Your opponents already know this technique's true behavior, so its range cannot be bluffed.";
        const trueRange = declaredRange(m);
        if (act.deception && trueRange <= 1) return "A false-range announcement needs an ability with more than 1 tile of reach.";

        const mastered = !!s.rules.mastery && (a.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === s.rules.mastery.trait);   // Mastery: ultimates at will
        const sequelFilm = act.ability === "setTheScene" && Director && hasTrait(a, "awardWinningDirector") && a.ultimateCharge < s.rules.ultimateChargeMax && (a.inspiration || 0) >= Director.rules.sequelCost;   // sequels run on prestige, not budget: unannounced, 1 Inspiration, no bar needed
        if (m.tier === "ultimate" && !internal?.prepaid && !mastered && !sequelFilm && a.ultimateCharge < s.rules.ultimateChargeMax) return `Needs ${s.rules.ultimateChargeMax} ultimate charge (have ${a.ultimateCharge}).`;   // MCR-04: a prepaid reveal trusts the set-time bar payment
        if (m.tier === "ultimate" && dreamSpaceRules?.ultimatesBlocked(a, s.dreamSpace, s.rules)) return "A dream-finishing ultimate needs the owner inside their unburned dream with a full ULT bar.";
        const dreamUltimate = m.tier === "ultimate" && !!dreamSpaceRules?.canFinishUltimate(a, s.dreamSpace, s.rules);
        if (act.announce && m.tier !== "ultimate" && m.effect !== "damage") return "Only ultimates and attacks can be announced.";   // Mala 2026-10-15: announce is offered on any offensive technique
        if (act.ability === "setTheScene" && !sequelFilm && !act.announce) return "Set the Scene needs its announcement (Quiet on set): the mark gets a response unless this is a prestige sequel.";   // Mala 2026-10-15: announce is a modifier, mandatory only where the technique breaks without it
        // A self-cast needs no tile: the UI sends none (targeting() marks it selfCast), and class-runtime and Perform self
        // checks compare the tile with the caster's. Without this every self technique of theirs was refused (Mala, 2026-10-14).
        const aim = act.target || (m.target === "self" ? [a.x, a.y] : null);
        const t = target(s, src, m, aim?.[0], aim?.[1], act);
        if (!t.ok) return t.error;
        { const me = ClassRuntime?.mise?.validate(s, a, act, m, classH()); if (me) return me; }   // Mise en Place: the whole station plan, before anything is paid
        { const he = ClassRuntime?.homology?.validate(s, a, act, m, classH()); if (he) return he; }   // Homology: the two techniques compared, before anything is paid
        if (m.timing === "delayed" && !(t.targets || []).some(id=>s.actors[id] && !s.actors[id].defeated && !s.actors[id].notArrived))
          return "A delayed technique needs a living character whose next turn can trigger it; wild creatures have no character turn.";
        const inspired = H.inspiredPay?.(s, a, m);   // a full bar and 1 Inspiration pay an ultimate's whole ΦF
        if (!internal?.prepaid && !freeFirst && a.pf < m.cost && !inspired) return `Needs ${m.cost} ΦF (have ${a.pf}).`;
        const inspirationPrice = ab(act.ability)?.inspirationPrice || 0;   // a Crescendo's price (hotbuilds W1c): Inspiration, read off the def (no manifest carry)
        if (!internal?.prepaid && inspirationPrice > 0 && (a.inspiration || 0) < inspirationPrice) return `Needs ${inspirationPrice} Inspiration (have ${a.inspiration || 0}).`;
        if (!internal?.prepaid && m.lfPrice && a.lf <= m.lfPrice) return `${m.name} costs ${m.lfPrice} LF: you need more than that left (have ${a.lf}).`;   // an ability's LF price (Ajin L1; the pattern of the rite cut at ~1334): the caster must stay above 0 LF
        if(presidentRules){for(const h of Object.values(s.actors)){if(!h.law||h.law.until<s.round)continue;const hu=presidentUnits(s).find(u=>u.id===h.id),au=presidentUnits(s).find(u=>u.id===a.id),r=presidentRules.breaksLaw(hu,au,{delivery:m.delivery},{...presidentContext(s),round:s.round});if(r.broke){syncPresidentUnit(s,r.actor);log(s,{kind:"law",actor:a.id,target:h.id,text:`${a.name} breaks ${h.name}'s Due Process rule (${m.delivery}) and becomes an outlaw.`,why:["The rule applies to its maker and units in jurisdiction."]});}}}
        // committed: pay once, snapshot (spec §7)
        const starTax = ClassRuntime?.actor ? ClassRuntime.actor.taxFor(s, a, t.targets || []) : 1;   // GDP: the star's tax lands once per technique, overclock unmultiplied
        const taxedBase = (m.tempoCost + detailTax) * starTax;
        if (!internal?.prepaid && !freeFirst && a.tempo < taxedBase && !extraTempo) return `${m.name} needs ${taxedBase} action points (have ${a.tempo}): ×${starTax} to target the star; choose overclock to borrow against a future turn.`;
        if (!internal?.prepaid && !freeFirst) { const tempoError = spendTempo(s, a, taxedBase + extraTempo, m.name, true); if (tempoError) return tempoError; H.adhdPaid?.(s, a, act.ability); }   // prepaid set intents (Muse W2.5, MY-02 internal): paid at set time
        else if (!internal?.prepaid && freeFirst && extraTempo) { const tempoError = spendTempo(s, a, extraTempo, m.name, true); if (tempoError) return tempoError; }   // free-first covers the ability's own cost, never an overclock chosen on top: the debt still lands (triage 2026-11-04)
        if (Vows && act.ability === "audition" && act.vow?.boon) Vows.swear(s, a, "role", act.vow, { log });   // sworn before the part is taken, read at play
        if (barsTooFast(s, a, act.ability)) { log(s, { kind: "act", actor: a.id, fizzled: true, text: `${a.name} spits ${m.name} too fast and it goes past everyone.`, why: ["Speed-Talker: his attacks are talk, at half the action points, and they land 85% as often."] }); return; }
        if (quickened === "lastWord") { a.quickenedSpent ||= {}; a.quickenedSpent[act.ability] = true; }
        if (inspired && !internal?.prepaid) { const n = s.rules.inspiration?.ultimatePoint ?? 1; H.Inspiration.spend(s, a, n, "perform"); log(s, { kind: "inspiration", actor: a.id, spent: n, text: `${a.name} spends ${n} Inspiration: it pays ${m.name}'s ${m.cost} ΦF.`, why: [`Inspired ultimate: with a full bar, one Inspiration pays the whole ΦF cost.${mastered ? " Mastery: the bar is not spent." : " The bar and the AP are still spent."}`] }); }   // MCR-04: prepaid ΦF is never paid again with Inspiration
        else if (!internal?.prepaid && !freeFirst) a.pf -= m.cost;   // prepaid at set time
        ClassRuntime?.ma?.paid(a, m);   // Ma: a discount once used is gone
        if (inspirationPrice > 0 && !internal?.prepaid) { H.Inspiration.spend(s, a, inspirationPrice); log(s, { kind: "inspiration", actor: a.id, spent: inspirationPrice, text: `${a.name} spends ${inspirationPrice} Inspiration on ${m.name}.`, why: ["A Crescendo's price is paid on cast, beside AP and ΦF (never a perform)."] }); }
        if (m.lfPrice && !internal?.prepaid) { a.lf -= m.lfPrice; log(s, { kind: "act", actor: a.id, text: `${a.name} pays ${m.lfPrice} LF for ${m.name} (${a.lf}/${a.maxLF}).`, why: ["A technique's LF price is paid on cast, after the cast is legal and before anything resolves; it can never leave the caster below 1 LF."] }); }
        if (m.miseStation) ClassRuntime.mise.redeem(s, a, m, classH());   // Mise en Place: the prepared station is spent with the cast
        if(m.freeFocus)H.FocusPlans?.commit(s,a,act,t);
        if (m.tier === "ultimate" && mastered && !dreamUltimate) log(s, { kind: "charge", actor: a.id, text: `${a.name} needs no charge for ${m.name}: mastery.`, why: ["Mastery: ultimates cost their action points and ΦF, and nothing else."] });
        else if (m.tier === "ultimate" && sequelFilm && !internal?.prepaid) { H.Inspiration.spend(s, a, Director.rules.sequelCost, "perform"); log(s, { kind: "charge", actor: a.id, text: `${a.name} films a sequel on prestige, unannounced: ${Director.rules.sequelCost} Inspiration.` }); }
        else if (m.tier === "ultimate" && !internal?.prepaid) { a.ultimateCharge -= s.rules.ultimateChargeMax; if (a.status.ward?.flow) a.status.ward = null; a.flowOn = false; log(s, { kind: "charge", actor: a.id, text: `${a.name} spends ${s.rules.ultimateChargeMax} ultimate charge on ${m.name}.` }); }   // spending the bar ends the flow state (ward included)   // MCR-04: prepaid reveals spend no bar or Inspiration beyond the set payment
        s.stats.abilityUses[act.ability] = (s.stats.abilityUses[act.ability] || 0) + 1; H.Exposure.used(s, a, act.ability, m);
        if (crescendoFree) H.Inspiration.crescendoFreeUsed(a, act.ability);   // the free cast is spent at commit
        if (m.crescendo) H.Inspiration.crescendoArm(s, a, m);   // the Crescendo spends its Inspiration and bends the rule once the cast is committed
        if (m.oncePerTurn) (a.onceTurns ||= {})[act.ability] = a.ownerTurns;   // once-per-turn stamp at commit (previews run on a clone, so this never leaks)
        if (m.oncePerBattle) (a.onceBattle ||= {})[act.ability] = true;   // J6: once-per-battle stamp at commit
        if (freeFirst === "turn") (a.freeTurns ||= {})[act.ability] = a.ownerTurns;   // free-first stamp at commit (previews run on a clone, so this never leaks)
        if (freeFirst === "battle") (a.freeBattle ||= {})[act.ability] = true;
        if (CRAFT) {   // practice and care bookkeeping (the manifest above already read the stacks this use benefits from)
          if (a.status?.care && !CRAFT_OWN.has(act.ability)) a.status.care = null;                       // the care is spent on this technique
          if (act.ability === "masterwork") { if (a.practice) a.practice.stacks = 0; }
          else if (!CRAFT_OWN.has(act.ability)) {
            if (a.practice?.ability === act.ability) a.practice.stacks = Math.min(H.craftMax(a), a.practice.stacks + 1);
            else if (a.practice?.stacks > 0) { a.practice.stacks = Math.max(0, a.practice.stacks - CRAFT.lostOnOther); log(s, { kind: "craft", actor: a.id, text: `${a.name}'s hand drifts from ${ab(a.practice.ability).name}: practice ${a.practice.stacks}/${H.craftMax(a)}.` }); }
            if (m.tier !== "ultimate") a.lastTechnique = act.ability;
          }
        }
        const d = ab(act.ability); const why = m.notes.slice();
        if (src !== a) why.push(`Originates from the marker at (${act.from[0]},${act.from[1]}).`);
        if (starTax > 1) why.push(`Genre-Defining Performance: ×${starTax} AP to target the star (paid once for the technique).`);
        let mult = a.omen ? a.omen.multiplier : 1;
        if (mult !== 1) why.push(`Omen weakens this action ×${mult}.`);
        if (m.effect === "damage" && a.passives?.abilityDamageMul && a.passives.abilityDamageMul !== 1) {
          mult *= a.passives.abilityDamageMul;
          why.push(`Character traits adjust ability damage ×${a.passives.abilityDamageMul}.`);
        }
        if (m.delivery === "contact" && (m.effect === "damage" || m.effect === "charge") && hasTrait(a, "denseMuscle")) {   // Dense Muscle (Mala, 2026-10-19): physical blows land doubled
          mult *= 2; why.push("Dense Muscle doubles the physical blow.");
        }
        if (m.effect === "damage" && a.status?.woozy) {   // still woozy from surgery (account/surgery.js)
          mult *= a.status.woozy.damageMul || 0.9; why.push(`Woozy from surgery: ability damage ×${a.status.woozy.damageMul || 0.9}.`);
        }
        const dreamMods = dreamSpaceRules?.modsFor(a, s.dreamSpace, s.arena.objects) || {};
        if (dreamMods.potencyMul) { mult *= dreamMods.potencyMul; const hole = hasTrait(a, "trepanation") && (!s.dreamSpace || !dreamSpaceRules.contains(s.dreamSpace, a.x, a.y)); why.push(`${hole ? "Trepanation" : "Dream Space"} potency ×${dreamMods.potencyMul}.`); }
        if (a.summon?.trueFormPotencyMul) { mult*=a.summon.trueFormPotencyMul;why.push(`Summon's true form strengthens technique potency ×${a.summon.trueFormPotencyMul}.`); }
        if (a.committed?.potencyMul && a.committed.expiresAt > a.ownerTurns) { mult *= a.committed.potencyMul; why.push(`Burn the Boats commitment strengthens the technique ×${a.committed.potencyMul}.`); }
        if (act.ability && m.concept === "legitimacy" && a.mandate && presidentRules) { const used=presidentRules.useMandate(presidentUnits(s).find(u=>u.id===a.id),d); syncPresidentUnit(s,used.actor); if(used.mul>1){mult*=used.mul;why.push(`Fulfilled commitment grants Mandate: this authority technique ×${used.mul}.`);} }
        if (extraTempo) { mult *= (m.tempoCost + extraTempo) / m.tempoCost; why.push(`Overclock invests ${extraTempo} extra AP (×${((m.tempoCost + extraTempo) / m.tempoCost).toFixed(2)} potency) and creates tempo debt if the action exceeds this turn's budget.`); }
        if (quickened === "snap") { mult *= 0.6; why.push("Quickened (Snap): no reaction possible; potency ×0.6."); }
        if (quickened === "lastWord") why.push(`Quickened (Last Word): ${m.name} is spent for this battle.`);
        if(act.orderPotencyMul){mult*=act.orderPotencyMul;why.push(`Executive Direction requested this technique at ×${act.orderPotencyMul} potency using the ally's own action.`);a.pendingOrder=null;}
        mult *= Performers?.techniqueCommitted(s,a,m,classH()) || 1;
        const deception = !!act.deception;
        if (act.reveal || s.disclosures[a.id][act.ability]) {
          if (!s.disclosures[a.id][act.ability]) {
            s.disclosures[a.id][act.ability] = true;
            for (const o of Object.keys(s.knowledge)) if (s.knowledge[o][a.id]) s.knowledge[o][a.id].abilities[act.ability] = true;
            log(s, { kind: "reveal", actor: a.id, text: `${a.name} reveals ${m.name}: “${d.reveal}”`, why: [`Revealed techniques gain ×${s.rules.revealMultiplier} potency for this encounter. Repeating it adds nothing.`] });
          }
          mult *= s.rules.revealMultiplier; why.push(`Revealed ×${s.rules.revealMultiplier}.`);
        }
        if (!deception) for (const o of Object.keys(s.knowledge)) if (s.knowledge[o][a.id]) s.knowledge[o][a.id].abilities[act.ability] = true;   // ordinary use exposes the technique before any response window
        const claimedRange = deception ? Math.max(1, trueRange - 1 - (m.falseTellRangeAdd || 0)) : null;
        const announcedTiles = deception ? rangeEnvelope(s, a, claimedRange) : t.tiles;
        const inst = { ...m, gap:act.gap||"north", ignoreCover:act.ability==="longView", owner: a.id, origin:[src.x,src.y], sourceHeight: heightAt(s, src.x, src.y), mult, tiles: t.tiles, announcedTiles, deception, claimedRange, part: act.part || "foliage",
          section: t.section || null, sourceTile: t.source || null, projectionProperty: t.property || null, projectionAxis: t.axis || null, projectionStoppedAt: t.stoppedAt || null, fragment: t.fragment || null, fragmentId: act.fragmentId || null,
          route: t.route || null, targets: t.targets || [], aim: t.aim || act.target || null, maidFilth: !!t.maidFilth, objective:act.objective||t.objective||null, surrender:act.surrender||null, stake:act.stake||null, method:act.method||null, force:act.force||null, gear:act.gear||null,
          misePlan: act.stations || null, miseOrder: act.order || null, rule:act.rule||null, participants:act.participants||null, restriction:act.restriction||null, orderAbility:act.orderAbility||null, orderTarget:act.orderTarget||null,
          announced: !!act.announce, revelation: act.announce ? Math.max(1, Math.min(3, Math.round(+act.revelation || 1))) : 0, quickened, role: act.role || null, directHit: !!(hasTrait(a, "drunkenMonkey") || m.directHit) };   // direct-hit: the style grants it to every attack; techniques may carry it; role: the Actor's audition pick
        if (dreamUltimate) {
          inst.dreamFinisher = `dream-ultimate-${++s.seq}`;
          s.dreamSpace.ultimateCommit = inst.dreamFinisher;
          log(s, { kind: "dreamUltimate", actor: a.id, ability: inst.ability, text: `${a.name} commits ${inst.name} through their Dream Space. The seal holds until the technique resolves, then the dream closes.`,
            why: ["Full ULT is paid once. The dream bonus and sealed movement remain through announcement and responses. No extra aura pulse is granted."] });
        }
        a.lastTechniqueConcept = inst.concept;
        ClassRuntime?.homology?.cast(s, a, act, classH());   // Homology: the first reuse of a technique in a live Lineage Ledger is announced
        // Genius wilds (the Sasquatch) watch techniques too: it learns what it sees, and a tamed one keeps what it learned.
        const witnesses = [...Object.values(s.actors), ...(s.wild || []).filter((u) => u.form === "unit" && u.lf > 0 && ((u.traits || []).includes("genius") || (u.traits || []).includes("copyEye")))];
        for (const observer of witnesses) if (!observer.defeated && (observer.id === a.id || hasSight(s, observer.x, observer.y, a.x, a.y))) {
          const seen = s.observedAbilities[observer.id] ||= [];
          (((((s.observedAt ||= {})[observer.id] ||= {})[a.id] ||= {})[act.ability]) ||= {}).round = s.round;   // Homology H2: when this witness last saw THIS user cast it (a parallel record; the array above stays once-per-id); the Indexing flag, when set, stays until the record is rebuilt (nothing clears it today; loop 1a1a2f77a7a-ae73)
          if (!seen.includes(act.ability)) {
            seen.push(act.ability);
            // A genius may learn a technique after seeing it once (insight.js geniusLearns). A Copy Eye always does — once per battle (anime batch).
            const eyeDef = ab(act.ability);
            if (observer.id !== a.id && hasTrait(observer, "copyEye") && !observer.copied && eyeDef && eyeDef.tier !== "ultimate" && !eyeDef.pairs && !eyeDef.merge && !abilitiesOf(observer).includes(act.ability)) {
              observer.copied = act.ability; (observer.learned ||= []).push(act.ability);
              log(s, { kind: "effect", actor: observer.id, learnedTechnique: { ability: act.ability, source: a.id }, text: `${observer.name}'s eye drinks ${a.name}'s ${eyeDef.name || act.ability}: theirs for this battle.`, why: ["Copy Eye: one witnessed technique per battle, this battle only, at normal costs."] });
            } else if (observer.id !== a.id && insightRules?.geniusLearns?.({ observer, ability: act.ability, def: eyeDef, seed: s.seed, round: s.round, alreadyHas: abilitiesOf(observer) })) {
              (observer.learned ||= []).push(act.ability);
              log(s, { kind: "effect", actor: observer.id, learnedTechnique: { ability: act.ability, source: a.id }, text: `${observer.name} watches ${a.name}'s ${m.name} once and gets it: ${m.name} is now theirs for this battle.`, why: ["Genius: a small chance to learn a technique after seeing it once."] });
              if (observer.id !== a.id) ClassRuntime?.Martial?.witness?.(s, observer, (ab(act.ability) || {}).potency, H);   // Martial Artist: power witnessed is Inspiration
              const bt = H.EmergentIdeas?.active(observer).find((x) => x.id === "breakthrough")?.effects;   // Genius + Imagination
              if (bt) { log(s, { kind: "emergentIdea", actor: observer.id, text: `Breakthrough: ${observer.name} sees how ${m.name} works and what else it could be.`, why: ["Genius + Imagination: a technique learned by watching is a Breakthrough."] });
                H.Inspiration.gain(s, observer, bt.inspiration, "A Breakthrough is worth Inspiration."); }
            }
          }
        }
        // A free Fix Attention (focus-plans.js) pays no charge: free and charging, it was a charge farm that sent Bastet's
        // AI into aura upkeep instead of shooting (trio damage -14 a battle, 2026-10-15). rules.focusRenewal.charges = true restores it.
        // An announced Feint pays no charge either (Mala, 2026-10-17): 5 AP of telegraphed nothing is bait, not a blow,
        // and charging it farmed 0 to a full bar in a turn (seed 3065690639). Unannounced Feint is full price and charges normally.
        if ((!m.freeFocus || s.rules.focusRenewal?.charges) && !(act.ability === "feint" && inst.announced) && !m.samplerNoCharge && !m.noCharge) {   // Sampler's free Juxtapose charges nothing; soul arts never charge (J6r)
          // Empty attacks charge nothing (Mala, 2026-10-17; battle seed 2122468325): damage defers its charge to
          // resolution, where settleDeferredCharge grants it only if someone was hit. Utility still charges on use.
          const chargeArgs = [inst.concept, `Using ${inst.name} as ${ownerOfConcept(a, inst.concept) || "borrowed"} concept.`, inst.compositionApplied ? s.rules.ultimateChargePairBonus : 0,
            MaidSystems?.utilityChargeMultiplier(m) || 1, MaidSystems?.canRechargeAura(a, inst) || false, borrowedCharges(a, inst)];
          if (m.effect === "damage" || m.effect === "paleStampede") inst.deferredCharge = chargeArgs;   // a stampede that tramples no one charges nothing either
          else chargeUltimate(s, a, ...chargeArgs);
        }
        H.fruitCast?.(s, a, act, inst);   // Sinkerfruit (Locusfruit): a recall costs 2 more PhiF and empties its room; a palace taxes or refunds
        log(s, { kind: "act", actor: a.id, ability: act.ability, tiles: deception ? announcedTiles : t.tiles, route: deception ? null : (t.route || null),
          text: `${a.name} uses ${m.name} (${d.tier}, ${conceptName(m.concept)}, ${m.delivery}${m.area.shape !== "single" ? ", " + m.area.shape : ""}) for ${m.cost} ΦF.`, why });
        // AGI Takeoff witness rule: the third deception technique an AGI sees (anyone's but its
        // own) closes the window — deception immune immediately, Feint learned.
        if (typeof m?.concept === "string" && m.concept.toLowerCase() === "deception") {
          for (const u of Object.values(s.actors)) {
            if (u.defeated || u.id === a.id || u.character !== "agi") continue;
            const tk = u.takeoff ||= { exp: {}, immune: [], sightings: 0, transcended: 0, completed: 0, taught: 0, paced: false };
            if ((tk.exp.deception || 0) >= 5) continue;
            tk.sightings += 1;
            if (tk.sightings >= 3) {
              tk.exp.deception = 5; tk.immune.push("deception");
              log(s, { kind: "adapt", actor: u.id, concept: "deception", text: `${u.name} has seen the trick three times — Deception is understood, immune.`, why: ["Takeoff witness rule: the window is gone."] });
              if (!tk.taught) { tk.taught = s.round; u.learned ||= []; if (!u.learned.includes("feint")) u.learned.push("feint"); }
              if (!tk.transcended && (tk.immune.length >= 2 || (u.ownerTurns || 0) * (tk.completed ? 2 : 1) >= 6)) { tk.transcended = s.round; log(s, { kind: "transcend", actor: u.id, text: `${u.name} transcends: every opponent now fears it most.`, why: ["2 immunities or takeoff +6: fear aggro."] }); H.PostHuman.join(s, u); }
            }
          }
        }
        if (act.announce && !sequelFilm) {
          if (!deception && !d.flatAnnounce && act.ability !== "feint") inst.mult *= inst.revelationMul = s.rules.revelation?.mults?.[inst.revelation] ?? s.rules.announceMultiplier;   // Revelation tiers (Muse W1.1): Name ×1.4, Explain ×1.65, Show it all ×2   // an orb ultimate is a flat 100 (docs/orbs.md): a Guard leaves 50. Feint discounts instead of buffing (Mala's Feint ruling).
          return openResponseWindow(s, a, inst, d);
        }
        if (a.character === "actor" && hasDeception(a) && d.target === "enemy" && d.area.shape === "single" && d.timing !== "delayed") {
          const extras=Object.values(s.actors).filter(t=>!t.defeated&&t.side!==a.side&&t.id!==inst.targets[0]&&hasSight(s,a.x,a.y,t.x,t.y)).map(t=>({id:t.id,visible:true}));
          const audience=Postures?.resolve({character:a.character,concept:"deception",ability:act.ability,event:"techniqueResolved",eligible:extras,manyFaces:a.lens.deception==="manyFaces"});
          if(audience){inst.audienceOnly=true;inst.audienceIds=audience.recipients;inst.audienceTempo=audience.tempo;log(s,{kind:"posture",actor:a.id,target:inst.targets[0],text:audience.log,why:["The named target alone receives the actual technique; the audience receives a response window to look away."]});return openResponseWindow(s,a,inst,d);}
        }
        if (!inst.audienceOnly && H.openReactionWindow(s, a, inst, d)) return;   // reactive defense: a seen ranged attack can be answered (window.js)
        resolveAbility(s, src, inst);
        if (src !== a) for (const k of ["pf", "tempo", "tempoDebt", "ultimateCharge"]) a[k] = src[k];   // signal origin (machine P3): resolve-side costs persist on the caster
        H.finishDreamUltimate(s, a, inst);
      },
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-technique.js)`);
    Object.assign(K.handlers, family);
  })();
});
