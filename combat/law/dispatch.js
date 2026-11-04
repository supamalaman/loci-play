"use strict";
// Dispatch cutscene (muse police-cutscene SPEC, build): the Chief sends
// the police. An incarceration sentence triggers three narrator beats —
// the Call, the Chief on the radio, the Arrival — then two named officers
// walk in at opposite edges (side civilian) hunting the sentenced unit
// with the live police kit (cuff → arrest). Once per battle; a second
// call gets a radio bark, no scene, no spawns. The Chief is a radio voice
// only (speaker key policeChief, portrait slot reserved, F11).
//   RULES                                    → tunables (officer count, kneel price)
//   names(s, H)                              → the six officer names (live NAME_POOLS)
//   beats(names, reason)                     → 3 narrator beats (Continue-gated, unskippable)
//   trigger(s, H, sentencedId, opts)         → { ok, beats } (opens s.law.dispatch)
//   arrive(s, H)                             → spawns the named pair + orders (after the beats)
//   kneel(s, H, id)                          → the sentenced kneels (mercy contact)
//   isKneeling(t) / shouldKneel(s, a)        → gentle-cuff read + AI kneel check
//   noteCuff(s, H, a, t)                     → gentle log, or heat + the crowd mutters
//   onDefeat(s, H, tgt)                      → the defeat line; never a redispatch
//   wantsTrial(s, a)                         → docket open for a kneel-claim?
//   openArrestTrial(s, H, officerId, accusedId) → the cuffs hold, but the court hears it
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./trial.js"));
  else root.ConceptCombatDispatch = factory(root.ConceptCombatTrial);
})(typeof self !== "undefined" ? self : this, function (TR) {
  const RULES = { officers: 2, kneelAp: 10, heatRough: 1 };
  const FALLBACK_SIX = ["Officer Lum", "Officer Park", "Officer Akana", "Officer Vance", "Officer Diaz", "Officer Ng"];
  function names(s, H) {
    const byClass = H?.C?.namePools?.byClass || {};
    return [...(byClass.police_officer || byClass.policeOfficer || FALLBACK_SIX)];
  }
  const surname = (n) => String(n || "").replace(/^Officer\s+/, "");
  function pickNames(s, H) {
    const d = s.law.dispatch, pool = names(s, H).filter((n) => !(d.usedNames || []).includes(n));
    const rank = (n) => H.seededChance(`${s.seed}:dispatch:pick:${n}`);
    return pool.sort((x, y) => rank(x) - rank(y)).slice(0, RULES.officers);
  }
  function beats(picked, reason, reach = picked.length) {   // reach: how many officers can get onto the board (PD-01)
    const called = picked.slice(0, Math.max(0, reach)).map(surname).join(", ");
    const arrival = reach <= 0 ? ["No car can get through.", "The radio goes quiet.", "The sentence stands without them."]
      : reach === 1 ? ["One uniform crosses the line.", "The cuffs come out.", "Nobody here is leaving unnamed."]
      : ["Two uniforms cross the line.", "The cuffs come out.", "Nobody here is leaving unnamed."];
    return [
      { id: "dispatch-call", title: "The Call", text: reason === "call"
        ? ["Someone dials the precinct.", "Somewhere a radio crackles.", "The room holds its breath."]
        : ["The verdict asks for cuffs.", "Somewhere a radio crackles.", "The room holds its breath."] },
      { id: "dispatch-chief", title: "The Chief", name: "The Chief", role: "Radio", voice: "policeChief",
        text: called ? [`${called} — that scene is yours.`, "Cuff them clean. Book them right.", "The beat goes on."]
          : ["Every road to that scene is shut.", "No unit can reach it.", "The sentence stands on its own."] },
      { id: "dispatch-arrival", title: "The Arrival",
        text: arrival },
    ];
  }
  function state(s) { return ((s.law ||= {}).dispatch ||= { done: false }); }
  function trigger(s, H, sentencedId, opts = {}) {
    const d = state(s), t = s.actors[sentencedId];
    if (d.done) {   // the police come ONCE: a second call is a bark on the radio, nothing more
      H.log(s, { kind: "dispatch", beat: "bark", text: "The radio crackles: units already on scene. No second car." });
      return { ok: false, bark: true };
    }
    if (!t || t.defeated) return { ok: false, error: "There is no one left to take in." };
    const picked = pickNames(s, H), reason = opts.reason || "verdict";
    Object.assign(d, { done: true, pending: true, arrived: false, sentenced: sentencedId, reason, by: opts.by || null,
      round: s.round, officers: [], fallen: 0, heat: 0, usedNames: [...(d.usedNames || []), ...picked],
      beats: beats(picked, reason, H.unitAt && H.tileAt && H.barrierAt ? Math.min(picked.length, edgeTiles(s, H).length) : picked.length) });   // the copy matches who can arrive (callers without the board helpers keep the full unit)
    const civ = (s.civilians ||= { hostileTo: [], members: [] });   // the crowd turns on the sentenced side
    if (!civ.hostileTo.includes(t.side)) civ.hostileTo.push(t.side);
    H.log(s, { kind: "dispatch", beat: "call", target: sentencedId, text: `The verdict asks for cuffs: ${t.name} is sentenced, and the call goes out.` });
    return { ok: true, beats: d.beats };
  }
  function edgeTiles(s, H) {
    // PD-01: arrival uses the ordinary movement rules — blocking terrain,
    // any unit standing there (actors and wild units alike), and standing
    // barriers all close a tile (queries.js move legality).
    const open = (x, y) => x >= 0 && y >= 0 && x < s.arena.w && y < s.arena.h
      && !H.tileAt(s, x, y).blocksMove && !H.unitAt(s, x, y)
      && (!H.barrierAt(s, x, y) || H.barrierAt(s, x, y).passable);
    const out = [];
    for (let x = 0; x < s.arena.w; x++) for (const y of [0, s.arena.h - 1]) if (open(x, y)) out.push([x, y]);
    for (let y = 1; y < s.arena.h - 1; y++) for (const x of [0, s.arena.w - 1]) if (open(x, y)) out.push([x, y]);
    return out;
  }
  function arrive(s, H) {
    const d = state(s);
    if (!d.pending || d.arrived) return [];
    d.arrived = true; d.pending = false;
    const t = s.actors[d.sentenced], ch = H.C.characters.police_officer;
    const edge = edgeTiles(s, H);
    if (!t || !ch || !edge.length) {
      H.log(s, { kind: "dispatch", beat: "noUnit", text: "The call goes out, but no unit can reach the scene." });
      // the sentence still stands: with no officer to take them, the sentenced are led out as before the call existed
      if (t && !t.defeated && H.submitFoe) H.submitFoe(s, s.actors[d.by] || s.actors.player || t, t, "incarcerated");   // the court's caller, else the player (submitFoe reads the submitter)
      return [];
    }
    // PD-01: each spot is reserved as it is picked (shifted out of the
    // pool), so two officers never share a tile. One legal tile means one
    // officer walks in alone; zero means the no-unit fallback above.
    const near = ([x, y]) => Math.abs(x - t.x) + Math.abs(y - t.y);
    const pool = edge.slice().sort((p, q) => near(p) - near(q));
    const spots = [pool.shift()];
    if (pool.length) {
      const far = ([x, y]) => Math.abs(x - spots[0][0]) + Math.abs(y - spots[0][1]);
      pool.sort((p, q) => far(q) - far(p));
      spots.push(pool.shift());   // opposite edges: the scene is surrounded, not crowded
    }
    const ids = [];
    const crew = d.usedNames.slice(-RULES.officers).slice(0, spots.length);
    if (crew.length < RULES.officers) H.log(s, { kind: "dispatch", beat: "shortUnit", text: `Only one unit can reach the scene: ${crew.map(surname).join(", ")} walks in alone.` });
    crew.forEach((name, i) => {
      const at = spots[i], id = `dispatch-${surname(name).toLowerCase()}`;
      if (s.actors[id]) return;
      // PD-02: a fresh badge, built clean — never cloned from the player, so
      // no form, focus, summon, Toriyama/retrocausality state or other
      // lifecycle flag can leak across. Every field is a clean default or
      // the police kit; absent-on-fresh fields (form, summons, concealment,
      // conditions) stay absent.
      const a = { id, character: "police_officer", name, category: "civilian", side: "civilian",
        sprite: ch.sprite, ai: "police_officer", controller: "ai", posture: "aggressive",
        permanentAlly: false, selectedConfig: null, x: at[0], y: at[1],
        maxLF: 80, lf: 80, pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0,
        primary: ch.primary, secondary: ch.secondary, reserve: [], reserveSlots: 0,
        lens: H.clone(ch.lens || {}), level: 1, xp: 0, proficiency: 1, traits: [...(ch.traits || [])],
        passives: {}, abilities: [], aiAbilities: null, learned: [], inventory: [], inventoryCapacity: 2,
        reaction: 0, ownerTurns: 0, boss: null, size: null, massive: false,
        tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0,
        moved: false, acted: false, guardUsedThisTurn: false, defeated: false, notArrived: false, arrivesRound: null,
        eventActor: true, eventRole: "dispatch", aggressive: true, persuaded: false, standDownUntil: null,
        willpower: 10, maxWillpower: 10, hunting: t.id, forceTarget: t.id, forceTargetUntil: 999,
        dispatch: { cutscene: true, target: t.id },
        vows: [], rite: null, riteAugment: null, inspiration: 0, role: null, audition: null,
        typecast: null, bond: null, soul: s.rules.soul?.max ?? null, maxSoul: s.rules.soul?.max ?? null, husk: false,
        soulKind: ch.soulKind || null, arrivesFor: null, summonGroup: null, beliefStrength: 0, beliefSummonUsed: false,
        birdMountain: { charge: 0, red: null, feast: null, vows: {} }, bossAbilityIds: [], bristleconeUsed: false,
        earthStock: 0, flowOn: false, focus: null, heldFragments: [], inspiredBy: {}, lanyardUsed: false,
        lastChargeConcept: null, lastDamageType: null, lastRecoverTurn: -99, lastTechniqueConcept: null,
        pendingSwap: null, perkApAdd: 0, quickenedSpent: {}, teleology: { heading: null, phiDebt: 0, servings: {} },
        titles: [], walkedThisTurn: 0, waterContact: null, waterDepth: "dry", waterSafeAt: null,
        status: { guard: null, ward: null, parry: null, membrane: null, anchor: null, stun: null, entangled: null, immovable: null, exposed: null, attention: null, rangeBuff: null, tippingPoint: null, ambush: null, catharsis: null, drowning: null } };
      s.actors[id] = a;
      H.wheelhouseSettle?.(s, a, ch);   // a hotbuild badge rolls on arrival, like any NPC spawn (W0a)
      if (!s.order.includes(id)) s.order.push(id);
      s.disclosures[id] = {}; s.knowledge[id] = {}; s.observedAbilities[id] = [];
      for (const other of Object.keys(s.actors)) {
        (s.knowledge[other] ||= {})[id] ||= { secondary: true, lens: true, abilities: {} };
        if (other !== id) s.knowledge[id][other] = { secondary: true, lens: true, abilities: {} };
      }
      const members = (s.civilians ||= { hostileTo: [], members: [] });
      if (!members.members.includes(id)) members.members.push(id);
      d.officers.push({ id, name }); ids.push(id);
    });
    const who = d.officers.map((o) => o.name).join(" and ");
    H.log(s, { kind: "dispatch", beat: "arrive", target: d.sentenced, tiles: spots.slice(0, ids.length),
      text: `${who} ${ids.length === 1 ? "walks" : "walk"} in: ${t.name} is to be cuffed, arrested, and held. The ledger writes who came.` });
    return ids;
  }
  function kneel(s, H, id) {
    const a = s.actors[id];
    if (!a || a.defeated) return "There is no one there to kneel.";
    a.status.kneeling = { round: s.round };
    H.log(s, { kind: "dispatch", actor: id, text: `${a.name} kneels: hands visible, no sudden moves.` });
    return null;
  }
  const isKneeling = (t) => !!t?.status?.kneeling;
  function shouldKneel(s, a) {
    const d = s.law?.dispatch;
    if (!d?.done || d.sentenced !== a.id || a.defeated || isKneeling(a)) return false;
    if ((a.lf ?? 0) >= (a.maxLF ?? 1) * 0.5) return false;
    return (d.officers || []).some((o) => { const u = s.actors[o.id]; return u && !u.defeated; });
  }
  function noteCuff(s, H, a, t) {
    if (isKneeling(t)) {
      H.log(s, { kind: "dispatch", actor: a.id, target: t.id, text: `${a.name} cuffs ${t.name} gently: the kneeling are taken, not taken down.` });
      return;
    }
    if (!a.dispatch?.cutscene) return;
    const d = state(s);
    d.heat = (d.heat || 0) + RULES.heatRough;
    H.log(s, { kind: "dispatch", actor: a.id, target: t.id, text: `${a.name} takes ${t.name} down hard: the crowd mutters (heat ${d.heat}).` });
  }
  function wantsTrial(s, a) {
    if (a.claimTrial || a.status?.kneeling) return false;   // the claim IS the response-kneel, never the posture
    return (!s.trial || s.trial.over) && !s.trialDone;   // docket spent (dispatch arrests come after a verdict) → no court
  }
  function openArrestTrial(s, H, officerId, accusedId) {
    const o = s.actors[officerId], t = s.actors[accusedId];
    if ((s.trial && !s.trial.over) || s.trialDone) {
      if (t) delete t.claimTrial;
      H.log(s, { kind: "trial", actor: accusedId, text: `${t?.name || "The accused"} claims trial from their knees, but the docket is spent: the cuffs hold.` });
      return { ok: false, error: "docket spent" };
    }
    if (!o || !t || t.defeated) return { ok: false, error: "no standing accused" };
    const ev = Object.values(s.cls?.lawEvidence?.[accusedId] || {}).flat();
    const test = (s.cls?.testimony || []).filter((w) => w.target === accusedId || w.subject === accusedId);
    let counts = TR.countsFromEvidence(ev, test).slice(0, 3);
    if (!counts.length) counts = [{ grade: "witnessed", severity: 1, actRound: s.round, ledgerAct: true, label: "the arrest charge" }];
    const trial = TR.openTrial({ form: "courtroom", accusedId, prosecutorId: officerId, seed: s.seed,
      units: H.Courtroom.fixtures(s), counts });
    s.trial = { t: trial, invokerId: officerId, accusedId, queued: null, queuedDefense: null,
      contempt: [], over: false, revealedAtOpen: 0, arrestTrial: true };
    H.log(s, { kind: "trial", actor: accusedId, target: officerId,
      text: `${t.name} claims trial from their knees: the battle HOLDS while the court hears ${counts.length} count${counts.length === 1 ? "s" : "s"}. The cuffs stay on.` });
    return { ok: true };
  }
  function onDefeat(s, H, tgt) {
    if (!tgt?.dispatch?.cutscene) return;
    const d = state(s);
    d.fallen = (d.fallen || 0) + 1;
    H.log(s, { kind: "dispatch", beat: "fallen", target: tgt.id, text: `${tgt.name} falls: the beat goes on without them. No second car tonight.` });
  }
  return { RULES, names, beats, trigger, arrive, kneel, isKneeling, shouldKneel, noteCuff, onDefeat, wantsTrial, openArrestTrial };
});
