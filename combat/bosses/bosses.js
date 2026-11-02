"use strict";
// Boss rules, the enraged condition, orbs and transformations. Pure functions over actor records.
//
//   makeBoss(id, { at })                → boss actor (wild side, 2×2 footprint unless Gaia, boss abilities)
//   footprint(actor)                    → tiles it occupies (any of them can be targeted)
//   afterDamage(actor, {bossRush})      → { actor, events }  applies ENRAGED at 25% LF (once): mods, unlocks, Gaia grows
//   displacementBlocked(actor)          → true for massive bosses (shoves don't move them)
//   dropOrb(bossActor)                  → orb item id on defeat
//   transform(player, orbId, { round }) → { player, events }   one-time humanoid boss form for 3 turns (orb consumed)
//   endOfTurnForms(player)              → counts the form down and reverts it
//   integration(self, traumaStatus, record) → { integrated, missing }
//   becomeGolden(player, { integrated }) → { player, events }  the Integrated Self, once per battle, full ultimate charge
//   learned forms (Mala, 2026-10-17; docs/learned-forms.md): formFor, canEnterLearned, enterLearned, releaseForm, holdTick,
//     formDamage, formBeforeApply, formRider, formImmovable, aiFormChoice. A form beaten out of an Omega boss is kept by the
//     character (actor.learnedForms) and HELD: it drains ΦF each turn, then LF, until released; or VOWED: 3 free turns.
//   damageForm(player, amount)          → { player, absorbed, passThrough, events }  a form with its own LF (gold) soaks damage;
//                                          when it breaks the character returns with the LF they had when they transformed
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./boss-data.js"));
  else root.ConceptCombatBosses = factory(root.ConceptCombatBossData);
})(typeof self !== "undefined" ? self : this, function (BD) {
  const R = BD.rules;

  function makeBoss(id, { at = [0, 0] } = {}) {
    const b = BD.bosses[id];
    const f = b.forms?.[b.startForm];        // Gaia: her form follows the land's condition (gaia.js)
    const size = f ? f.size : b.size;
    return { id: `boss-${id}`, name: f ? f.name : b.name, side: f ? f.side : R.side, boss: id, character: id, size: { ...size },
      maxLF: b.lf, lf: b.lf, x: at[0], y: at[1], concepts: b.concepts.slice(), abilities: Object.keys(b.abilities),
      conditions: {}, massive: size.w > 1, ...(f ? { gaiaForm: b.startForm } : {}) };
  }

  function footprint(a) {
    const s = a.size || { w: 1, h: 1 }, out = [];
    for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) out.push([a.x + dx, a.y + dy]);
    return out;
  }

  function afterDamage(a, opts = {}) {
    const C = BD.conditions.enraged, events = [];
    if (!a.boss || a.conditions.enraged || a.lf <= 0 || a.lf > C.trigger.lfBelow * a.maxLF) return { actor: a, events };
    // Gaia: ENRAGED turns the Living Accord into the Wounded Ground (engine/land.js setGaiaForm, Mala 2026-10-14).
    const b = BD.bosses[a.boss];
    const next = { ...a, conditions: { ...a.conditions, enraged: { ...C.mods } }, abilities: [...a.abilities, ...Object.keys(b.enragedUnlocks)] };
    events.push({ kind: "condition", condition: "enraged", actor: a.id, text: `${a.name} is ENRAGED. ${b.flatResist && opts.bossRush ? C.text.replace("it takes 30% less damage, ", "the blows that pierce its hide still take 30% less, ") : C.text}`, unlocked: Object.keys(b.enragedUnlocks) });
    if (b.enragedSize) {
      next.size = { ...b.enragedSize }; next.massive = true;
      events.push({ kind: "grow", actor: a.id, size: next.size, text: `${a.name} rises to full size. Anyone in the way is pushed aside.` });
    }
    return { actor: next, events };
  }
  const displacementBlocked = (a) => !!(a.massive && R.massive.immuneToDisplacement);
  const damageTakenMul = (a) => a.conditions?.enraged?.damageTakenMul ?? 1;
  // A boss's standing resistance (Mala, 2026-10-31: the Oni is ridiculously resistant; only piercing hurts him): a flat damage multiplier from the boss data, skipped by a piercing blow.
  const flatResist = (a) => (a.boss && BD.bosses[a.boss]?.flatResist) || null;
  const statusImmune = (a, status) => (a.conditions?.enraged?.statusImmune || []).includes(status);

  function dropOrb(bossActor) { return bossActor.boss ? BD.bosses[bossActor.boss].orb : null; }

  // One-time transformation into a humanoid version of the boss. The orb is consumed.
  // `ultimateChargeMax`: every orb hands over a full ultimate bar (Mala, 2026-10-13; docs/orbs.md). Breaking the orb does
  // not swing the hit; the ultimate button does.
  function transform(player, orbId, { round = 0, ultimateChargeMax = 100 } = {}) {
    const O = BD.orbs[orbId];
    if (!O) return { player, error: "That isn't a boss orb." };
    if (player.form) return { player, error: `You're already transformed (${player.form.name}).` };
    if (!(player.orbs || []).includes(orbId)) return { player, error: `You don't have the ${O.name}.` };
    if (O.only && !O.only.includes(player.character)) return { player, error: O.onlyText || `The ${O.name} is not yours to break.` };   // the orb stays in the list
    const orbs = [...player.orbs]; orbs.splice(orbs.indexOf(orbId), 1);
    // Overlay forms (One With Nature, Cyborg) keep the character's loadout and add to it; the others replace the kit
    // with the boss's humanoid one.
    const form = O.overlay
      ? { name: O.form, formId: O.formId, overlay: true, from: orbId, turnsLeft: BD.formBalance.duration, stats: O.stats, kit: null,
          extraTechnique: O.extraTechnique, lenses: [], since: round }
      : { name: O.form, from: orbId, turnsLeft: 3, stats: O.stats, kit: O.kit, since: round };
    const maxLF = (player.maxLF || 100) + (O.stats.maxLFAdd || 0);
    const next = { ...player, orbs, form, maxLF, lf: Math.min(maxLF, (player.lf ?? 100) + (O.stats.maxLFAdd || 0)), ultimateCharge: ultimateChargeMax };
    if (O.techniques) form.techniques = O.techniques.slice();
    if (O.strike) form.strike = { ...O.strike };
    if (O.aura) { form.aura = { ...O.aura }; form.bitten = []; }
    if (O.adaptation) { form.adaptation = { ...O.adaptation }; form.hits = {}; }
    if (O.sprite) { form.priorSprite = player.sprite ?? null; next.sprite = O.sprite; }
    if (O.grantedTraits) {   // only what the form itself added comes off again: a trait he already had stays
      const has = (id) => (player.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === id);
      form.grantedTraits = O.grantedTraits.filter((id) => !has(id));
      next.traits = [...(player.traits || []), ...form.grantedTraits];
    }
    return { player: next,
      actionCost: O.overlay ? BD.formBalance.activation : null,
      events: [{ kind: "transform", actor: player.id, form: O.form, overlay: !!O.overlay,
        text: O.breakText ? `${O.breakText} for ${form.turnsLeft} turns.` : O.overlay ? `The ${O.name} breaks. Root seams run through you and the grass leans your way: One With Nature for ${form.turnsLeft} turns.` : `The ${O.name} breaks: you become the ${O.form} for 3 turns.` }] };
  }
  function endOfTurnForms(player) {
    if (!player.form || typeof player.form !== "object") return { player, events: [] };   // string forms are a species tag (dream monsters), not a transform timer
    if (player.form.golden) {   // gold: four free turns, then the form holds on convention rates (never fades by clock)
      if (player.form.held) return { player, events: [] };   // held gold never times out (return fix 2026-10-30: the learned guard, same line)
      const left = player.form.turnsLeft - 1;
      if (left > 0) return { player: { ...player, form: { ...player.form, turnsLeft: left } }, events: [] };
      return { player: { ...player, form: { ...player.form, turnsLeft: 0, held: true, heldTurns: 0, eatTurns: 0 } },
        events: [{ kind: "transform", actor: player.id, form: player.form.name, golden: true, text: `${player.form.name} holds on past its four turns: ${LF.drain} ΦF a turn, or it eats its own gold. Let go any time.`, why: ["Held forms end by release or ejection, never by clock."] }] };
    }
    if (player.form.learned) {   // learned forms: held ones never time out; vowed ones end through releaseForm
      if (player.form.held) return { player, events: [] };
      const left = player.form.turnsLeft - 1;
      if (left > 0) return { player: { ...player, form: { ...player.form, turnsLeft: left } }, events: [] };
      return releaseForm(player, { reason: "vow" });
    }
    const left = player.form.turnsLeft - 1;
    if (left > 0) return { player: { ...player, form: { ...player.form, turnsLeft: left } }, events: [] };
    const f = player.form, add = f.stats?.maxLFAdd || 0;
    const maxLF = (player.maxLF || 100) - add;
    const lf = f.returnLF != null ? f.returnLF : Math.min(player.lf, maxLF);
    const back = { ...player, form: null, maxLF, lf };
    if ("priorSprite" in f) { if (f.priorSprite == null) delete back.sprite; else back.sprite = f.priorSprite; }
    if (f.grantedTraits) back.traits = (player.traits || []).filter((t) => !f.grantedTraits.includes(typeof t === "string" ? t : t?.id));
    return { player: back,
      events: [{ kind: "transformEnd", actor: player.id, text: `The ${f.name} form fades; you're yourself again.` }] };
  }

  // A form with its own pool (the Gold Form) takes the damage instead of the character. When the pool breaks the
  // form ends at once and the character stands back up with the LF they had when they transformed; nothing carries over.
  function damageForm(player, amount) {
    const f = player.form;
    if (!f || f.lf == null) return { player, absorbed: 0, passThrough: amount, events: [] };
    const left = f.lf - amount;
    if (left > 0) return { player: { ...player, form: { ...f, lf: left } }, absorbed: amount, passThrough: 0, events: [] };
    const T = BD.integratedSelf.transformation;
    return { player: { ...player, form: null, lf: f.returnLF ?? player.lf }, absorbed: f.lf, passThrough: BD.integratedSelf.overflowCarries ? -left : 0,
      events: [{ kind: "formBroken", actor: player.id, form: f.name, golden: !!f.golden, sequence: f.golden ? T.breakSequence : null, sprites: T.sprites,
        text: `The ${f.name} breaks. You're yourself again, with the ${f.returnLF ?? player.lf} LF you had before.` }] };
  }

  // Integration of the psyche: self known, shadow worked through, dreams met.
  // self = insight self record { traits: [{ known, kind, resolved }] }; traumaStatus from mirror.traumaStatus(self);
  // record = { dreamsBefriended: [dream keys whose gaze you've held, ever] }
  function integration(self, traumaStatus = { unknown: [], known: [], resolved: [] }, record = {}) {
    const req = BD.integratedSelf.requirements, missing = [];
    const unknownTraits = (self?.traits || []).filter((t) => !t.known).length;
    if (req.allSelfTraitsKnown && unknownTraits > 0) missing.push(`${unknownTraits} trait${unknownTraits === 1 ? "" : "s"} you don't know about yourself yet`);
    const open = (traumaStatus.unknown || []).length + (traumaStatus.known || []).length;
    if (req.allTraumasResolved && open > 0) missing.push(`${open} trauma${open === 1 ? "" : "s"} not yet worked through`);
    const met = new Set(record.dreamsBefriended || []).size;
    if (met < req.dreamsBefriended) missing.push(`${req.dreamsBefriended - met} more dream${req.dreamsBefriended - met === 1 ? "" : "s"} to meet (hold their gaze)`);
    return { integrated: missing.length === 0, missing };
  }

  function becomeGolden(player, { integrated, ultimateChargeMax = 100 } = {}) {
    const G = BD.integratedSelf;
    if (!integrated) return { player, error: "Your psyche isn't integrated yet." };
    if (player.goldenUsed) return { player, error: "Once per battle." };
    if ((player.ultimateCharge ?? 0) < ultimateChargeMax) return { player, error: "It takes a full ultimate charge." };
    if (player.form) return { player, error: "Let your current form end first." };
    const pool = (G.pool?.perMaxLF ?? 2) * (player.maxLF || 100) + (G.pool?.base ?? 50);   // decision 3: 2 per holder maxLF + 50
    return { player: { ...player, ultimateCharge: 0, goldenUsed: true,
        form: { name: G.name, golden: true, turnsLeft: G.duration, effects: G.effects, lf: pool, maxLF: pool, returnLF: player.lf, ...(G.strike ? { strike: { ...G.strike } } : {}), ...(G.techniques ? { techniques: G.techniques.slice() } : {}) } },
      // The UI plays G.transformation.sequence (fall → smoke → breach → emerge → clear → hover), then the gold-form sheet.
      events: [{ kind: "transform", actor: player.id, form: G.name, golden: true, sequence: G.transformation.sequence, sprites: G.transformation.sprites, scale: G.transformation.scale, then: G.transformation.then,
        text: "You fall, and the body is gone in a puff of smoke. Something gold rises out of it: featureless, whole. There is nothing left in you for anyone to use." }] };
  }

  // ── Learned forms (Mala, 2026-10-17; docs/learned-forms.md) ──
  const LF = BD.learnedForms, LT = LF.traits;
  const tid = (t) => (typeof t === "string" ? t : t?.id);
  const has = (u, id) => (u?.traits || []).some((t) => tid(t) === id);
  // formId → [orbKey, orb]
  function formFor(formId) { return Object.entries(BD.orbs).find(([, o]) => o.formId === formId) || null; }
  function canEnterLearned(a, formId, { vow = false } = {}) {
    if (a.boss || a.summon || a.wild || a.gaiaForm || a.ai === "summon") return "Only a fighter who beat the boss knows its form.";   // spawned units copy fields from their makers
    if (!(a.learnedForms || []).includes(formId)) return "That form isn't learned.";
    if (!formFor(formId)) return "No such form.";
    if (a.form) return `Already in a form (${a.form.name || a.form}).`;
    if ((a.formCooldownUntil ?? -1) > (a.ownerTurns ?? 0)) return "The last form is still settling: wait a turn.";
    if (!vow && (a.formVowSpent || []).includes(formId)) return "You borrowed that form with a vow this battle; you can't hold it now.";
    if (vow && (a.formVowSpent || []).includes(formId)) return "That vow is already sworn this battle.";
    return null;
  }
  function enterLearned(a, formId, { round = 0, ultimateChargeMax = 100, vow = false } = {}) {
    const why = canEnterLearned(a, formId, { vow }); if (why) return { player: a, error: why };
    const [orbKey, O] = formFor(formId), stats = { ...(O.stats || {}), ...(O.learnedStats || {}) }, add = stats.maxLFAdd || 0;
    const form = { name: O.form, formId, overlay: true, from: orbKey, learned: true, held: !vow, vowed: vow, turnsLeft: vow ? LF.vowTurns : null,
      stats, since: round, heldTurns: 0, eatTurns: 0, takeoff: 0, hoard: [a.x, a.y], struck: {}, baseMaxLF: a.maxLF || 100,
      techniques: (O.techniques || []).slice(), extraTechnique: O.extraTechnique, lenses: [] };
    if (O.strike) form.strike = { ...O.strike };
    if (O.aura) { form.aura = { ...O.aura }; form.bitten = []; }
    if (O.adaptation) { form.adaptation = { ...O.adaptation }; form.hits = {}; }
    const first = !(a.formsEntered || []).includes(formId);
    const next = { ...a, form, maxLF: (a.maxLF || 100) + add, lf: (a.lf ?? 100) + add, formsEntered: [...(a.formsEntered || []), formId] };
    if (first) next.ultimateCharge = ultimateChargeMax;   // the first entry each battle fills the bar (docs/orbs.md); re-entries don't
    if ((O.grantedTraits || []).includes("hollow")) form.hollowCap = next.lf;   // Hollow: nothing heals past what you had
    if (vow) next.formVowSpent = [...(a.formVowSpent || []), formId];
    const sprite = O.spriteFor?.[a.character] || O.sprite;
    if (sprite) { form.priorSprite = a.sprite ?? null; next.sprite = sprite; }
    if (O.grantedTraits) { form.grantedTraits = O.grantedTraits.filter((id) => !has(a, id)); next.traits = [...(a.traits || []), ...form.grantedTraits]; }
    return { player: next, events: [{ kind: "transform", actor: a.id, form: O.form, overlay: true, learned: true, vowed: vow,
      text: vow ? `${a.name} swears a vow and borrows ${O.form} for ${LF.vowTurns} turns, free.` : `${a.name} takes ${O.form}. Holding it costs ${LF.drain} ΦF a turn, then LF.`,
      why: [vow ? "Borrowed Form: no action points, no drain. When it ends, this form can't be held again this battle." : `${LF.enterAp} action points. Let go any time on your turn; at ${Math.round(LF.forcedAt * 100)}% LF the form throws you out.`,
        first ? "First form this battle: the ultimate bar is full." : "Not the first entry: the bar stays where it was."] }] };
  }
  // Gold release: letting go is free on the holder's turn; ejection (pool at 10%) comes back
  // quiet + Burnt Out. Either way the holder returns with exactly the banked LF, never harmed.
  function releaseGold(a, burntOut) {
    const f = a.form;
    const back = { ...a, form: null, lf: f.returnLF ?? a.lf, goldenUsed: a.goldenUsed };
    if ("priorSprite" in f) { if (f.priorSprite == null) delete back.sprite; else back.sprite = f.priorSprite; }
    if (burntOut) back.tempoDebt = (a.tempoDebt || 0) + LF.burntOutAp;
    const text = burntOut ? `${f.name} throws ${a.name} out at ${back.lf} LF: Burnt Out (${LF.burntOutAp} AP down next turn).` : `${a.name} lets go of ${f.name}.`;
    return { player: back, events: [{ kind: "transformEnd", actor: a.id, form: f.name, golden: true, text }] };
  }
  function releaseForm(a, { reason = "let go", burntOut = false } = {}) {
    const f = a.form; if (!f) return { player: a, events: [] };
    if (f.golden) return releaseGold(a, burntOut);
    if (!f.learned) return { player: a, events: [] };
    const add = f.stats?.maxLFAdd || 0, maxLF = (a.maxLF || 100) - add;
    const back = { ...a, form: null, maxLF, lf: Math.max(1, Math.min(a.lf, maxLF)), formCooldownUntil: (a.ownerTurns ?? 0) + LF.reentryTurns };
    if ("priorSprite" in f) { if (f.priorSprite == null) delete back.sprite; else back.sprite = f.priorSprite; }
    if (f.grantedTraits) back.traits = (a.traits || []).filter((t) => !f.grantedTraits.includes(tid(t)));
    if (burntOut) back.tempoDebt = (a.tempoDebt || 0) + LF.burntOutAp;
    const text = burntOut ? `${f.name} throws ${a.name} out at ${back.lf} LF: Burnt Out (${LF.burntOutAp} AP down next turn).`
      : reason === "vow" ? `The borrowed ${f.name} ends; ${a.name} is themself again.` : reason === "parachute" ? `Golden Parachute: ${a.name} drops out of ${f.name} at ${back.lf} LF.` : `${a.name} lets go of ${f.name}.`;
    return { player: back, events: [{ kind: "transformEnd", actor: a.id, form: f.name, text }] };
  }
  // Turn start, after ΦF regen. ctx: { tile(x,y), foes(), allies(), plantsNear(x,y), fearCheck(t), isAI }
  function holdTick(a, ctx) {
    const f = a.form; if (!f?.learned) return { player: a, events: [] };
    const events = [], next = { ...a, form: { ...f, heldTurns: f.heldTurns + 1 } }, F = next.form, tile = ctx.tile(a.x, a.y) || {}, tags = tile.tags || [];
    const living = tags.includes("soil") || tags.includes("plant"), water = tags.includes("water");
    F.molting = has(a, "molting") && F.heldTurns % LT.moltEvery === 0;
    if (F.molting) { const before = next.lf; next.lf = Math.min(next.maxLF, next.lf + LT.moltHeal); events.push({ kind: "effect", actor: a.id, text: `${a.name} molts: the shell comes off this turn (×${LT.moltTaken} damage taken), and ${next.lf - before} LF mends.` }); }
    if (has(a, "takeoff")) F.takeoff = Math.min(LT.takeoffMax, F.takeoff + LT.takeoffPer);
    if (has(a, "fireblooded") && ctx.burning?.(a.x, a.y)) { const b = next.lf; next.lf = Math.min(next.maxLF, next.lf + LT.fireHeal); if (next.lf > b) events.push({ kind: "heal", actor: a.id, target: a.id, text: `Fireblooded: the flames feed ${a.name}, +${next.lf - b} LF.` }); }
    if (has(a, "spiritSight")) for (const u of ctx.unveilNear?.(a, LT.spiritRadius) || []) events.push({ kind: "reveal", actor: a.id, target: u.id, tiles: [[u.x, u.y]], text: `Spirit Sight: ${u.name} can't hide from ${a.name}.` });
    if (F.stats?.livingHeal && living) { const before = next.lf; next.lf = Math.min(next.maxLF, next.lf + F.stats.livingHeal); if (next.lf > before) events.push({ kind: "heal", actor: a.id, target: a.id, text: `The living ground mends ${a.name}: +${next.lf - before} LF.` }); }
    if (has(a, "greenblood")) { const n = Math.min(LT.greenMax, LT.greenPer * (ctx.plantsNear?.(a.x, a.y) || 0)); if (n) { next.lf = Math.min(next.maxLF, next.lf + n); events.push({ kind: "heal", actor: a.id, target: a.id, text: `Greenblood: the plants beside ${a.name} give ${n} LF.` }); } }
    for (const u of ctx.foes?.() || []) if (Math.max(Math.abs(u.x - a.x), Math.abs(u.y - a.y)) <= 1) {
      if (has(a, "unbearable")) ctx.fearCheck?.(u);
      if (has(a, "platform")) { u.tempoDebt = (u.tempoDebt || 0) + 10; events.push({ kind: "effect", actor: a.id, target: u.id, text: `${u.name} pays rent on ${a.name}'s platform: 10 AP down.` }); }
    }
    if (!F.held) return { player: next, events };   // vowed: free
    // An AI lets go before the form starts eating it (or when nothing is left to fight).
    const foes = ctx.foes?.() || [];
    let drain = LF.drain;
    if (has(a, "quenchable") && (water || ctx.wet?.(a.x, a.y))) drain *= LT.quenchMul;   // water, the ground beside it, or rain
    if (has(a, "rootbound") && living) drain = LT.rootDrain;
    if (has(a, "woundedLand") && !living) drain *= LT.woundedMul;
    if (has(a, "takeoff")) drain += F.takeoff;
    if (has(a, "burnRate")) drain += LT.burnStep * (F.heldTurns - 1);
    if (ctx.isAI && (!foes.length || (next.pf < drain && next.lf <= LF.ai.releaseAt * next.maxLF))) {
      const r = releaseForm(next); return { player: r.player, events: [...events, ...r.events] };
    }
    if (next.pf >= drain) { next.pf -= drain; events.push({ kind: "resource", actor: a.id, text: `Holding ${F.name} costs ${drain} ΦF (${next.pf} left).` }); }
    else {
      const eat = LF.eatStart + LF.eatStep * F.eatTurns; F.eatTurns += 1; next.pf = 0;
      next.lf = Math.max(1, next.lf - eat);
      events.push({ kind: "effect", actor: a.id, text: `${F.name} has no ΦF left to drink: it eats ${eat} LF (${next.lf} left).`, why: ["Let go on your turn, or it bites harder each turn."] });
      if (next.lf <= Math.ceil(LF.forcedAt * F.baseMaxLF)) { const r = releaseForm(next, { burntOut: true }); return { player: r.player, events: [...events, ...r.events] }; }
    }
    return { player: next, events };
  }
  // Gold overtime, past the four free turns: the same convention as learned forms, but the form
  // eats its own pool, never the holder. Runs at turn start while form.held (turns.js).
  function goldHoldTick(a, ctx) {
    const f = a.form; if (!f?.golden || !f.held) return { player: a, events: [] };
    const events = [], next = { ...a, form: { ...f, heldTurns: (f.heldTurns || 0) + 1 } }, F = next.form;
    const foes = ctx.foes?.() || [];
    if (ctx.isAI && (!foes.length || (next.pf < LF.drain && F.lf <= LF.ai.releaseAt * F.maxLF))) {
      const r = releaseGold(next, false); return { player: r.player, events: [...events, ...r.events] };
    }
    if (next.pf >= LF.drain) { next.pf -= LF.drain; events.push({ kind: "resource", actor: a.id, text: `Holding ${F.name} costs ${LF.drain} ΦF (${next.pf} left).` }); }
    else {
      const eat = LF.eatStart + LF.eatStep * (F.eatTurns || 0); F.eatTurns = (F.eatTurns || 0) + 1; next.pf = 0;
      F.lf = Math.max(0, F.lf - eat);
      events.push({ kind: "effect", actor: a.id, text: `${F.name} has no ΦF left to drink: it eats ${eat} of its own gold (${F.lf}/${F.maxLF} left).`, why: ["The form spends itself; the holder is never harmed. Let go on your turn, or it bites harder each turn."] });
      if (F.lf <= Math.ceil(LF.forcedAt * F.maxLF)) { const r = releaseGold(next, true); return { player: r.player, events: [...events, ...r.events] }; }
    }
    return { player: next, events };
  }
  const near = (u, at, r) => at && Math.max(Math.abs(u.x - at[0]), Math.abs(u.y - at[1])) <= r;
  // Multiplier and notes on one hit, from the forms of the attacker and the target.
  function formDamage(src, tgt, inst, damageType, potency) {
    let mul = 1, flat = 0; const notes = [];
    const tf = tgt?.form?.learned ? tgt.form : null, sf = src?.form?.learned ? src.form : null;
    if (tf) {
      const c = tf.stats?.channelTakenMul?.[damageType]; if (c && c !== 1) { mul *= c; notes.push(`${tf.name}: ${damageType} ×${c}.`); }
      if (has(tgt, "territorial") && near(tgt, tf.hoard, LT.territorialRadius)) { mul *= LT.territorialTaken; notes.push(`Territorial: on its own ground, ×${LT.territorialTaken}.`); }
      if (tf.molting) { mul *= LT.moltTaken; notes.push(`Molting: the shell is off, ×${LT.moltTaken}.`); }
      else if (has(tgt, "exoskeleton") && potency > 0 && tf.exoRound !== tgt.ownerTurns) { tf.exoRound = tgt.ownerTurns; flat -= LT.exoFirstHit; notes.push(`Exoskeleton: the first hit this round loses ${LT.exoFirstHit}.`); }
      if (has(tgt, "fireblooded") && src?.side === "wild" && /fire/i.test(src?.name || "")) { mul = 0; notes.push("Fireblooded: burning ground doesn't hurt."); }   // the Brushfire's burn
      if (has(tgt, "woundedLand") && damageType === "citrinitas") { mul *= LT.woundedFire; notes.push(`Wounded Land: fire ×${LT.woundedFire}.`); }
      if (has(tgt, "overheat") && damageType === "rubedo" && tf.takeoff) { tf.takeoff = Math.max(0, tf.takeoff - LT.overheatReset); notes.push(`Overheat: Takeoff falls back to +${tf.takeoff}.`); }
    }
    if (sf && potency > 0) {
      if (has(src, "territorial") && near(src, sf.hoard, LT.territorialRadius)) { mul *= LT.territorialDealt; notes.push(`Territorial: ×${LT.territorialDealt} from its own ground.`); }
      if (has(src, "ruleOfTheThreshold") && sf.struck?.[tgt.id] && tgt.lf < (tgt.maxLF || 100) / 2) { mul *= LT.thresholdDealt; notes.push(`Rule of the Threshold: below half and already marked, ×${LT.thresholdDealt}.`); }
      if (sf.takeoff) { mul *= (potency + sf.takeoff) / potency; notes.push(`Takeoff: +${sf.takeoff} potency.`); }
      if (inst?.ability === "strike" && sf.strike?.rider?.guardCrack && tgt.status?.guard) { mul *= 1.5; notes.push(`${sf.strike.name} cracks the guard: it only takes off a quarter.`); }
      sf.struck = { ...(sf.struck || {}), [tgt.id]: true };
    }
    return { mul, flat, notes };
  }
  // Golden Parachute, just before a hit lands.
  function formBeforeApply(tgt, dmg) {
    const f = tgt.form;
    if (!f?.learned || !has(tgt, "goldenParachute") || tgt.parachuteUsed || dmg <= 0) return { dmg, release: false };
    const floor = Math.ceil(LT.parachuteAt * f.baseMaxLF);
    if (tgt.lf - dmg >= floor) return { dmg, release: false };
    return { dmg: Math.max(0, tgt.lf - floor), release: true };
  }
  const formImmovable = (u) => !!u?.form?.learned && has(u, "exoskeleton") && !u.form.molting;
  // Extra effects of a form technique or Strike on one target. ctx: { log, fearCheck(t), applyPoison(t, def), moveTo(u,x,y), free(x,y), allies(), aim }
  function formRider(a, t, rider, ctx) {
    if (!rider || !t) return;
    if (rider.scorch && !t.defeated) ctx.applyPoison?.(t, { poison: { label: "Scorched", lf: rider.scorch, apLoss: 0, minTurns: 2, maxTurns: 2 } });
    if (rider.apLoss && !t.defeated) { t.tempoDebt = (t.tempoDebt || 0) + rider.apLoss; ctx.log?.({ kind: "effect", actor: a.id, target: t.id, text: `${t.name} is thrown off: ${rider.apLoss} AP down next turn.` }); }
    if (rider.apSteal && !t.defeated && a.form?.learned && a.form.stoleTurn !== a.ownerTurns) { a.form.stoleTurn = a.ownerTurns;   // once per turn: a cheap Strike must never pay for the next one
      t.tempoDebt = (t.tempoDebt || 0) + rider.apSteal; a.tempo = (a.tempo || 0) + rider.apSteal; ctx.log?.({ kind: "effect", actor: a.id, target: t.id, text: `${a.name} takes ${rider.apSteal} AP from ${t.name}.` }); }
    if (rider.dread && !t.defeated) t.status.dread = { round: ctx.round ?? 0, by: a.id };
    if (rider.fear && !t.defeated) ctx.fearCheck?.(t);
    if ((rider.root || (rider.rootOnLiving && ctx.livingBoth)) && !t.defeated && !t.boss) t.status.entangled = { lostMove: 99, expiresAt: (t.ownerTurns ?? 0) + 1 };
    if (rider.drainPf && !t.defeated) { const n = Math.min(t.pf || 0, rider.drainPf); t.pf -= n; a.pf = Math.min(a.maxPF || 30, (a.pf || 0) + Math.min(n, rider.gainPf || 0)); ctx.log?.({ kind: "effect", actor: a.id, target: t.id, text: `${t.name} loses ${n} ΦF; ${a.name} takes ${Math.min(n, rider.gainPf || 0)}.` }); }
    if (rider.stealUlt && !t.defeated) { const n = Math.min(t.ultimateCharge || 0, rider.stealUlt); t.ultimateCharge -= n; a.ultimateCharge = Math.min(100, (a.ultimateCharge || 0) + n); if (n) ctx.log?.({ kind: "effect", actor: a.id, target: t.id, text: `${a.name} takes ${n} ultimate charge from ${t.name}.` }); }
    if (rider.curseBelowHalf && !t.defeated && t.lf < (t.maxLF || 100) / 2 && !t.status.formCurse) { t.status.formCurse = { by: a.id, damage: rider.curseBelowHalf }; ctx.log?.({ kind: "effect", actor: a.id, target: t.id, text: `The Kanabō leaves a curse mark on ${t.name}: ${rider.curseBelowHalf} when their next turn starts.` }); }
    if (rider.acquire && !t.defeated && (t.summon || t.companion) && !t.boss && !t.acquired) { t.acquired = { side: t.side, by: a.id, until: (a.ownerTurns ?? 0) + LT.acquireTurns }; t.side = a.side; ctx.log?.({ kind: "effect", actor: a.id, target: t.id, text: `Acquisition: ${t.name} works for ${a.name} for ${LT.acquireTurns} turns.` }); }
    if (rider.swap && !t.defeated && !t.boss && !t.size) { const [ax, ay] = [a.x, a.y]; ctx.moveTo?.(a, t.x, t.y, t); ctx.moveTo?.(t, ax, ay); }
    if (rider.leap && !ctx.leapt) { ctx.leapt = true; const spot = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dy]) => [t.x + dx, t.y + dy]).find(([x, y]) => ctx.free?.(x, y)); if (spot) ctx.moveTo?.(a, spot[0], spot[1]); }
  }
  // Allies healed once per cast (Gaia's Accord).
  function formCastRider(a, rider, ctx, tiles = []) {
    if (rider?.ignite) for (const [x, y] of tiles) ctx.ignite?.(x, y);
    if (rider?.igniteRadius) { const r = rider.igniteRadius; for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.abs(dx) + Math.abs(dy) <= r) ctx.ignite?.(a.x + dx, a.y + dy); }
    if (rider?.healAllies) for (const u of ctx.allies?.() || []) if (Math.max(Math.abs(u.x - a.x), Math.abs(u.y - a.y)) <= (rider.healRadius ?? 3)) { const b = u.lf; u.lf = Math.min(u.maxLF, u.lf + rider.healAllies); if (u.lf > b) ctx.log?.({ kind: "heal", actor: a.id, target: u.id, text: `${u.name} mends ${u.lf - b} LF in the Accord.` }); }
  }
  // Hollow: after any action, nothing has healed a Faceless past what it had.
  function hollowClamp(u) {
    const f = u.form; if (!f?.learned || f.hollowCap == null) return null;
    if (u.lf < f.hollowCap) { f.hollowCap = u.lf; return null; }
    if (u.lf > f.hollowCap) { const gone = u.lf - f.hollowCap; u.lf = f.hollowCap; return { kind: "effect", actor: u.id, target: u.id, text: `Hollow: the void takes nothing in (${gone} LF of healing lost).` }; }
    return null;
  }
  // Every unit's turn start: curse marks fire, acquired units go home, Platform lifts adjacent allies.
  // ctx: { hit(u, src, damage, label), actors() }
  function formsTurnStart(u, ctx) {
    const events = [];
    if (u.status?.formCurse && !u.defeated) { const c = u.status.formCurse; u.status.formCurse = null; ctx.hit?.(u, c.by, c.damage, "Curse mark"); }
    for (const v of ctx.actors?.() || []) if (v.acquired && v.acquired.by === u.id && (u.ownerTurns ?? 0) >= v.acquired.until) { v.side = v.acquired.side; v.acquired = null; events.push({ kind: "effect", actor: v.id, text: `${v.name}'s contract runs out: back to its own side.` }); }
    for (const v of ctx.actors?.() || []) if (v.id !== u.id && !v.defeated && v.side === u.side && v.form?.learned && has(v, "platform") && Math.max(Math.abs(v.x - u.x), Math.abs(v.y - u.y)) <= 1) {
      u.tempo = (u.tempo || 0) + LT.platformAllyAp; u.tempoCapacity = (u.tempoCapacity || 0) + LT.platformAllyAp;
      events.push({ kind: "effect", actor: v.id, target: u.id, text: `${u.name} builds on ${v.name}'s platform: +${LT.platformAllyAp} AP.` }); break;
    }
    return events;
  }
  // Broodmind: a hard hit hatches a larva (max 2 alive per Knight).
  const wantsLarva = (u, dealt, alive) => !!u.form?.learned && has(u, "broodmind") && !u.form.molting && dealt >= LT.larvaAt && alive < LT.larvaMax;
  // AI: enter a learned form when a big threat is near or it is getting hurt. Returns { form, vow } or null.
  function aiFormChoice(a, foes) {
    for (const formId of a.learnedForms || []) {
      const vow = a.formVow === formId;
      if (canEnterLearned(a, formId, { vow })) continue;
      if (!vow && (a.tempo || 0) < LF.enterAp) continue;
      const big = foes.some((u) => (u.lf || 0) >= LF.ai.enterFoeLF), hurt = a.lf <= LF.ai.enterOwnLF * (a.maxLF || 100);
      if (big || hurt) return { form: formId, vow };
    }
    return null;
  }

  // Boss rush (docs/boss-rush.md): the canonical boss order. The omega flags are the membership
  // (a later boss that earns the flag joins the list); this array is the sequence. The two
  // character fights (AGI, Tech Billionaire) close the rush; their flags live on C.characters.
  const RUSH_ORDER = ["dragon", "oni", "kaiju", "emissary", "gaia"];
  const RUSH_TAIL = ["agi", "tech_billionaire"];
  function rushBosses() { return RUSH_ORDER.filter((id) => BD.bosses[id]?.omega); }

  const publicOrbs = () => Object.keys(BD.orbs).filter((id) => !BD.bosses[BD.orbs[id]?.boss]?.sealed);
  return { hollowClamp, formsTurnStart, wantsLarva, formFor, canEnterLearned, enterLearned, releaseForm, holdTick, goldHoldTick, formDamage, formBeforeApply, formRider, formCastRider, formImmovable, aiFormChoice, makeBoss, footprint, afterDamage, displacementBlocked, damageTakenMul, flatResist, statusImmune, dropOrb, transform, endOfTurnForms, damageForm, integration, becomeGolden, rushBosses, RUSH_ORDER, RUSH_TAIL, publicOrbs, data: BD };
});
