"use strict";
// Actions, the rites family: miseRenew, aura, ritual, forYou, riteStep, riteComplete, riteToggle, riteAbandon, visitorRitual, vow.
// Split out of actions.js on 2026-11-11 (tools/split-actions.mjs, action seams A2; the map is tools/action-families.json,
// the lookup docs/action-families.md). Not a module in its own right and not in engine.js's ENGINE_PARTS: actions.js
// installs it with the host object H and K, the names actions.js has in its own scope (K.handlers is the action table).
// It adds its handlers to that table, and refuses an action type that is already there. Function bodies are exactly as
// they were in actions.js. To add an action to this family: write its handler below and take any new name from H or K.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).actionsRites = install;
})(typeof self !== "undefined" ? self : this, function install(H, K) {
  return (function () {
    const { Auras, C, ClassRuntime, Climate, Parley, RITUAL, Vows, ab, abilitiesOf, actorAt, auraH, chanted, classH, dist, endRite, hasTrait, hit,
      line, log, manifest, riteDiscount, spendTempo, tileAt } = H;
    const { Orders, Sage, Spirit } = K;
    const family = {
      miseRenew(s, a, act) { return ClassRuntime?.mise ? ClassRuntime.mise.renew(s, a, act, classH(), (pts, name) => spendTempo(s, a, pts, name)) : "Mise en Place is not loaded."; },   // Mise en Place: the caster renews a fading station (mise/mise.js renew)
      aura(s, a, act = {}) {   // Auras: toggle the primary concept's ring (auras/auras.js)
        if (!Auras) return "Auras are unavailable.";
        if (a.aura?.burning) return "The burning dream can't be let go; it ends at your next turn.";
        if (s.dreamSpace?.owner === a.id) {   // Auras: burn the folded aura out (the dream ends next turn)
          if (act.vow?.boon || act.vow?.restrictions?.length) return "The Dream Space's opening vows are fixed. Imbuing inherits them; you cannot add or replace vows.";
          const no = Auras.canImbue(s, a); if (no) return no;
          const spend = spendTempo(s, a, Auras.rules.imbueApCost, "Imbue the Dream"); if (spend) return spend;
          Auras.imbue(s, a, auraH());
          log(s,{kind:"vow",actor:a.id,text:"The imbued aura inherits the Dream Space's opening vows; their restrictions remain in force."});
          return;
        }
        if (a.aura) { Auras.dismiss(s, a, auraH(), "let go"); return; }
        const why = Auras.canActivate(s, a) || (Vows && Vows.validate("aura", act.vow, a, s.rules.inspiration, s)); if (why) return why;
        const spend = spendTempo(s, a, Auras.rules.apCost, "Extend Aura"); if (spend) return spend;
        Auras.activate(s, a, auraH());
        if (Vows && act.vow?.boon) Auras.applyVow(s, a, Vows.swear(s, a, "aura", act.vow, { log }));   // Vows
      },
      ritual(s, a, act) {   // C18: begin a capture on a weakened wild monster within 4
        if (a.rite) return "You are already working a rite: one channel at a time.";   // Rites (Muse-2)
        const [tx, ty] = act.at || [];
        // A monster of the mind (a dream creature on the other side) can be taken too (Mala, 2026-10-14: the ritual is
        // meant to tame the monsters that plague the mind). It is an actor, not a wild unit.
        const dreamt = actorAt(s, tx, ty), mind = dreamt && dreamt.dream && !dreamt.defeated && !dreamt.boss && dreamt.side !== a.side && !dreamt.tamed ? dreamt : null;
        // Gaia (Mala, 2026-10-26): the Wounded Ground can be taken too; the ritual binds her as a summon (ritualTick), not a bead.
        const gaia = !mind && dreamt && dreamt.boss === "gaia" && !dreamt.defeated && dreamt.gaiaForm === "disturbed" && dreamt.side !== a.side ? dreamt : null;
        const m = mind || gaia || (s.wild || []).find(w => w.form === "unit" && w.x === tx && w.y === ty);
        if (!m) return dreamt?.boss === "gaia" ? "Gaia answers no chant while she keeps the accord: only the Wounded Ground can be bound." : "There is no monster there to capture.";
        if (m.dream?.source === "brood") {   // a Brood Mite: refused while its mother stands, then takeable at any LF (Mala, 2026-11-01)
          if (!s.actors[m.dream.summoner]?.defeated) return "The brood answers its mother: take one only once she has fallen.";
          if (H.broodHeld(a) >= (s.rules.brood?.maxHeld ?? 4)) return "You already hold as many Brood Mite beads as one hand can keep.";
        } else if (m.lf >= m.maxLF * RITUAL.weakBelow) return `It must be weakened below ${Math.round(RITUAL.weakBelow * 100)}% LF first.`;
        if (a.ritual) return "You are already holding a ritual.";
        if (chanted(s, m.id)) return "Someone is already chanting over it.";
        if (dist(s, a.x, a.y, tx, ty) > RITUAL.range) return `The ritual reaches ${RITUAL.range} tiles.`;
        const spendError = spendTempo(s, a, riteDiscount(s, a, RITUAL.ap), "Capture ritual"); if (spendError) return spendError;
        a.ritual = { monsterId: m.id, turnsLeft: RITUAL.turns, ...(mind ? { mind: true } : {}), ...(gaia ? { gaia: true } : {}) }; if (!mind && !gaia) m.suspended = true;
        (s.captureLog ||= []).push({ actor: a.id, kind: mind ? `dream:${m.dream.key}` : gaia ? "gaia" : m.kind, started: true });
        log(s, { kind: "ritual", actor: a.id, target: m.id, tiles: [[tx, ty]], started: true, text: `${a.name} begins a capture ritual on the ${(m.name || m.kind).toLowerCase()}.`,
          why: [`It hangs suspended: nothing can hit it and it cannot act. Hold still and take no damage for ${RITUAL.turns} of your turns and it becomes a bead.`] });
      },
      forYou(s, a, act) {   // Love, staged (Mala, 2026-10-21): the nova, then a killing self-cost opens a steady rite on the Beloved. Not a concept, and not an announced technique.
        const R = s.rules.love?.forYou;
        if (!R) return "For You is not in this battle (rules.love.forYou).";
        if (act.beloved) {
          const named = s.actors[act.beloved];
          if (!named || named.defeated || named.id === a.id || named.side !== a.side) return "Name a living ally as your Beloved.";
          if (dist(s, a.x, a.y, named.x, named.y) > (R.nameRange ?? 4)) return "Your Beloved must be within 4 tiles to be named.";
          a.bond = { beloved: named.id };
        }
        const beloved = s.actors[a.bond?.beloved];
        if (!beloved || beloved.defeated || beloved.side !== a.side || beloved.id === a.id) return "Name a Beloved first.";
        if (dist(s, a.x, a.y, beloved.x, beloved.y) > (R.bondRange ?? 6)) return "Your Beloved is too far for the bond to carry For You.";
        if (a.lf <= 0) return "You have nothing left to burn.";
        if ((a.pf || 0) < (R.pf ?? 16)) return `For You needs ${R.pf ?? 16} ΦF (have ${a.pf || 0}).`;
        const spend = spendTempo(s, a, R.ap ?? 50, "For You");
        if (spend) return spend;
        a.pf -= R.pf ?? 16;
        const cost = R.selfLf ?? 15;
        a.lf = Math.max(0, a.lf - cost);
        log(s, { kind: "act", actor: a.id, ability: "forYou", tiles: [[beloved.x, beloved.y]], text: `${a.name} burns for ${beloved.name}: ${cost} LF.`, why: ["For You is centered on the Beloved."] });
        const radius = R.radius ?? 3, dmg = R.damage ?? 20, heal = R.heal ?? 12;
        const inst = { ability: "forYou", name: "For You", delivery: "field", damageType: "rubedo", effect: "damage", potency: dmg };
        for (const u of Object.values(s.actors)) {
          if (u.defeated || u.id === a.id) continue;
          if (dist(s, beloved.x, beloved.y, u.x, u.y) > radius) continue;
          if (u.side !== a.side) hit(s, a, u, inst, dmg, ["For You, centered on the Beloved."]);
          else {
            const before = u.lf;
            u.lf = Math.min(u.maxLF, u.lf + heal);
            if (u.lf > before) log(s, { kind: "heal", actor: a.id, target: u.id, text: `${u.name} is mended for ${u.lf - before} LF by For You.` });
          }
        }
        if (a.lf > 0) return;
        if (Parley && Parley.isImmortal(a)) {
          a.defeated = true; a.knockedOut = true; a.tempo = 0; H.pactLeave(s, a); Spirit()?.onDeath?.(s, a, null, H); Orders()?.onDeath?.(s, a, H);   // SP-05: a sacrifice shocks like any death
          log(s, { kind: "defeat", target: a.id, text: `${a.name} is knocked out. Immortal: down, not dead, and no rite begins.` });
          return;
        }
        a.defeated = true; a.defeatedBy = null; a.tempo = 0; H.pactLeave(s, a); Spirit()?.onDeath?.(s, a, null, H); Orders()?.onDeath?.(s, a, H);   // SP-05: a sacrifice shocks like any death
        a.sacrifice = { for: beloved.id, ability: "forYou" };
        log(s, { kind: "defeat", target: a.id, sacrifice: true, text: `${a.name} dies for ${beloved.name}.` });
        H.grantSacrifice(s, beloved, a);
        if (!s.preview) H.Inspiration?.witness(s, a, "seesSacrifice", a.id);
        H.courtWitnessSacrifice?.(s, a);   // a death in sight of the heart steps the court back once
      },
      riteStep(s, a, act) {   // Rites (Muse-2): one section per turn — words (cheap), sigils (locks movement), blood (LF)
        const R = s.rules.rite ?? {};
        if (a.ritual) return "You are already holding a capture ritual: one channel at a time.";
        const rite = a.rite || { steps: [], hold: 0 };
        if (rite.steps.length >= (R.maxSteps ?? 3)) return "The rite is complete at three steps: apply it or abandon it.";
        if (rite.stepTurn === a.ownerTurns || a.riteStepTurn === a.ownerTurns) return "One rite step per turn.";
        const section = act.section;
        const bank = (type) => {
          H.Rites.step(s, a, type);   // L1: the step banks through the ledger; the mirror keeps the gates' shape
          log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name}'s rite holds ${a.rite.steps.length} step${a.rite.steps.length === 1 ? "" : "s"} (bank keeps ${a.rite.hold} turns).` });
        };
        if (section === "words") {
          const spendError = spendTempo(s, a, riteDiscount(s, a, R.wordsAp ?? 10), "Rite: magic words"); if (spendError) return spendError;
          log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} starts chanting: magic words for the rite.` });
          bank("words");
        } else if (section === "sigils") {
          const spendError = spendTempo(s, a, riteDiscount(s, a, R.sigilsAp ?? 25), "Rite: drawn sigils"); if (spendError) return spendError;
          const artist = C.characters?.[a.character]?.subfaction === "ink" || hasTrait(a, "artist");
          if (artist) log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} sketches sigils in a notebook and keeps moving (artist).` });
          else { a.status.lockMove = { label: "Drawing", owner: a.id, expiresAt: a.ownerTurns + 1 }; log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} kneels to draw the ritual circle: no moving for the rest of the turn.` }); }
          bank("sigils");
        } else if (section === "blood" || section === "deep") {
          const deep = section === "deep", ease = s.dreamSpace ? (R.dreamBloodEase ?? 2) : 0;   // blood runs easier in dreams (the dream seam)
          const cost = Math.max(0, (deep ? (R.deepLf ?? 8) : (R.bloodLf ?? 3)) - ease);
          const hands = a.status.bloodyHands?.expiresAt > a.ownerTurns, own = a.status.bleed && (a.status.bleed.until == null || a.status.bleed.until >= a.ownerTurns);
          if (!deep && hands) { a.status.bloodyHands = null; log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} works the enemy's blood from their hands into the rite.` }); }
          else if (!deep && own) log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} feeds their own open wound into the rite.` });
          else {
            if (a.lf <= cost) return `You need more than ${cost} LF to open a vein.`;
            a.lf -= cost;
            if (deep) a.status.bleed = { drain: 2, until: a.ownerTurns + 2 };   // Deep Cut (Mala, 2026-10-20): the wound stays open
            log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: deep ? `${a.name} cuts deep (${cost} LF): the rite drinks willing pain. The wound bleeds (2 LF a turn, 2 turns).` : `${a.name} cuts for the rite (${cost} LF).` });
          }
          bank(deep ? "deep" : "blood");
        } else if (section === "burial") {   // Last Rites (ritual burial): a whole turn beside a body, unless the desert taught you speed
          const no = H.lastRites(s, a, spendTempo); if (no) return no;
          bank("burial");
        } else return "Choose words, sigils, blood, a deep cut, or last rites.";
      },
      riteComplete(s, a, act) {   // Rites (Muse-2): seal banked steps into a shared augment pool; checkboxes pick which techniques draw
        const rite = a.rite;
        if (!rite || !rite.steps.length) return "No rite steps banked.";
        if (a.riteAugment) return "An augment is already active: spend it first.";
        const n = (t) => rite.steps.filter((x) => x.type === t).length;
        const R = s.rules.rite ?? {}, w = n("words"), g0 = n("sigils"), b = n("blood") + n("deep"), sac = n("sacrifice"), burn = n("burn"), call = n("call");
        const bleedRider = (R.bleedRiderByBlood ?? [0, 0, 2, 6])[Math.min(b, 3)] ?? 0;
        const sacPay = R.sacrifice || { potency: 16, charges: 2 };
        a.riteAugment = {
          potencyAdd: w * (R.wordsPotency ?? 2) + (w >= 3 ? (R.wordsTripleBonus ?? 4) : 0) + n("burial") * (R.burial?.potency ?? 8) + sac * (sacPay.potency ?? 16) + burn * (R.burnPotency ?? 4),
          rangeAdd: g0 * (R.sigilsRange ?? 1) + (g0 >= 3 ? (R.sigilsTripleBonus ?? 3) : 0),
          piercing: b > 0 || sac > 0, bleedRider, charges: Math.min(4, rite.steps.length + n("deep") + call * (R.callCharges ?? 1) + sac * ((sacPay.charges ?? 2) - 1)), checked: {},
        };
        const g = a.riteAugment;
        const dreamFed = s.dreamSpace ? (R.dreamSealBonus ?? 1) : 0;   // rites burn brighter in dreams (Muse-2: the dream seam)
        if (dreamFed) g.charges += dreamFed;
        let ally = false, plant = false;
        for (const u of Object.values(s.actors)) {
          if (!u || u.id === a.id || u.defeated || (u.lf ?? 0) <= 0 || dist(s, a.x, a.y, u.x, u.y) !== 1) continue;
          if (u.communed) plant = true; else if (u.side === a.side) ally = true;
        }
        const witness = ally ? (R.witnessCharge ?? 1) : 0;
        if (witness) g.charges += witness;
        const rainId = s.weatherState?.id, wet = rainId === "rain" || rainId === "squall" || !!Climate?.data?.weather?.[rainId]?.rain;
        const ground = (tileAt(s, a.x, a.y).tags || []).includes("soil") || wet;
        if (ground) g.potencyAdd += (R.groundPotency ?? 2);
        if (plant) g.plantMend = R.plantMend ?? 4;
        H.Rites.clear(s, a);   // L1: the seal empties the ledger record with the mirror
        log(s, { kind: "ritual", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} seals the rite: ${g.charges} charge${g.charges === 1 ? "" : "s"}${g.potencyAdd ? `, +${g.potencyAdd} potency` : ""}${g.rangeAdd ? `, +${g.rangeAdd} range` : ""}${g.piercing ? ", piercing" : ""}${g.bleedRider ? `, ${g.bleedRider} bleed` : ""}. Check techniques to spend them.${dreamFed ? " The dream feeds the rite." : ""}${witness ? " Someone beside them witnesses it." : ""}${ground ? " The ground feeds it." : ""}${plant ? " A communed plant leans in." : ""}` });
      },
      riteToggle(s, a, act) {   // Rites (Muse-2): checkbox — this technique draws from the augment pool or not
        const g = a.riteAugment;
        if (!g || g.charges <= 0) return "No active augment to apply.";
        if (!abilitiesOf(a).includes(act.ability)) return "Choose one of your techniques.";
        if (!H.riteDraws(ab(act.ability))) return "Striking techniques only.";
        const m = manifest(s, a, act.ability);
        g.checked[act.ability] = !g.checked[act.ability];
        log(s, { kind: "ritual", actor: a.id, text: g.checked[act.ability] ? `${m.name} will draw from the rite (${g.charges} charge${g.charges === 1 ? "" : "s"} left).` : `${m.name} no longer draws from the rite.` });
      },
      riteAbandon(s, a) {
        if (!a.rite) return "No rite in progress.";
        endRite(s, a, "abandoned");
      },
      visitorRitual(s, a, act) {   // Intergalactic visitors P1: a grey begins the retrieval chant over the specimen
        if (!H.Visitors) return "The visitors are not here.";
        const err = H.Visitors.canChant(s, a, act.target, { chanted, dist, RITUAL });
        if (err) return err;
        const spendError = spendTempo(s, a, RITUAL.ap, "Retrieval chant"); if (spendError) return spendError;
        H.Visitors.chant(s, a, act.target, { log });
      },
      vow(s, a, act) {   // Technique stances (Muse-2): a standalone free oath; the restrictions are the price
        if (!Vows) return "Vows are unavailable.";
        if (a.beast || a.monster) return `${a.name} is soulless: mindless things can neither declare nor complete vows.`;   // W4.4: the canonical refusal
        if (a.form?.golden) return "The Self has nothing left to promise: vows can't be declared in gold.";   // locked decision 5: silence in gold; sworn vows persist
        const word = act.target === "word";   // Rama's word (docs/rama-build.md): once a battle, by a character who keeps one
        if (act.target !== "technique" && !word) return "Oaths are sworn on techniques alone; auras, dreams and roles ride their own actions.";
        if (word && !C.characters[a.character]?.swearsWord) return `${a.name} has no word to give.`;
        if (word && a.wordGiven) return `${a.name} has given his word this battle; it is not given twice.`;
        const no = Vows.validate(act.target, act.vow, a, s.rules.inspiration); if (no) return no;
        if (!act.vow?.boon) return "Name a boon to swear.";
        if (Vows.live(s, a).some((v) => v.on === act.target && v.boon === act.vow.boon)) return `The ${Vows.BOONS[act.vow.boon].name} oath already binds you.`;
        // W4.4 D-ruling (one unit one vow, concurrent reading: an unbroken vow of any kind blocks a new one; a vow that ended frees the soul again)
        if (Vows.live(s, a).some((v) => !v.broken)) return `${a.name} already bears a vow: one soul, one promise at a time.`;
        if (word) a.wordGiven = true;
        Vows.swear(s, a, act.target, act.vow, { log });
        if (Sage() && Sage().is(a) && !a.sageDeclared) {   // the lesson lands WITH the vow (SAGE.md coaching)
          const SG = Sage(), d = SG.declareJourney(a.ownerTurns ?? 0);
          if (d) {
            log(s, { kind: "declare", actor: a.id, text: d.encounter });
            log(s, { kind: "declare", actor: a.id, text: d.reveal });
            for (const e of ["pv", "vow"]) { const line = SG.coach(e); if (line) log(s, { kind: "sage", actor: a.id, text: line }); }
            a.sageDeclared = true;
          }
        }
      },
    };
    for (const type of Object.keys(family)) if (Object.prototype.hasOwnProperty.call(K.handlers, type)) throw new Error(`action type ${type} is installed twice (actions-rites.js)`);
    Object.assign(K.handlers, family);
  })();
});
