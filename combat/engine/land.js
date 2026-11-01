"use strict";
// The land's wounds and Gaia's arrival (Mala, 2026-10-14; docs/gaia-runtime-plan.md). Numbers: boss-data.js `land`.
// A part of the Concept Combat engine: engine.js installs it with the host object H. Everything else in the engine is
// read as H.x at call time, since parts installed earlier cannot see this one's functions and this one is last.
//
//   groundControl(s, a)               → 0..1   how well a fighter knows the place (1 = strikes leave the dirt whole)
//   landWound(s, a, kind, n, tiles)   → wounds the ledger; warns; enrages an arrived Accord
//   landRound(s)                      → round start: the chance she emerges, and her arrival
//   setGaiaForm(s, g, form, why)      → the Living Accord or the Wounded Ground (kit, side, size, sprite)
//
// Gaia STARTS as the Living Accord. She emerges beside whoever has wounded the land most and fights for the other
// side; more wounds after that, or the ENRAGED condition, turn her into the Wounded Ground, hostile to everyone, who
// hunts the top of the ledger. In Boss Rush she is the opponent from the start, in the Accord form, and stays enemy-side.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).land = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const L = () => H.bossRules?.data?.land, GB = () => H.bossRules?.data?.bosses?.gaia;
    const FIGHTING = ["player", "enemy"];
    const round1 = (n) => Math.round(n * 100) / 100;

    function landState(s) { return (s.land ||= { wounds: 0, ledger: {}, sides: {}, warned: false, gaia: null, atArrival: 0, enrageWarned: false }); }

    // Site composition (Mala, 2026-10-19): what the map is made of, read once from its tiles and kept
    // for the battle. Rock is the hard fraction, living ground the plant-or-soil fraction. Turf is soil:
    // a grass field forgives like a grove, paving waits like a quarry.
    function composition(s) {
      const st = landState(s);
      if (st.composition) return st.composition;
      const rows = s.arena?.map || [], T = H.C?.tiles || {};
      let rock = 0, living = 0, n = 0;
      for (const row of rows) for (const ch of row) {
        const tags = (T[ch] || T["."] || {}).tags || [];
        n++;
        if (tags.includes("hard")) rock++;
        if (tags.includes("plant") || tags.includes("soil")) living++;
      }
      st.composition = n ? { rock: rock / n, living: living / n } : { rock: 0, living: 0 };
      return st.composition;
    }
    // Site temper: patience from rock, mercy and forgiveness from living ground. Numbers in boss-data land.
    function temper(s, R) {
      const T = R.temper || {}, c = composition(s);
      const warnAt = Math.max(T.minWarn || 8, Math.min(R.emergeAt, Math.round(R.warnAt + c.rock * (T.rockPatience || 0) - c.living * (T.greenMercy || 0))));
      const voice = (R.voice || {})[s.arena?.archetype] || R.voice?.default || {};
      return { warnAt, emergeAt: warnAt * 2, forgive: Math.round(c.living * (T.forgiveRate || 0)), voice };
    }

    // The share of the place's hidden cards this fighter has revealed (Observe place), over controlAt. The place
    // observation stores familiarity as Climate's share of knowing a place, so it is divided back out here.
    const off = (s) => s.rules?.land === false;   // the whole land rule off (a sim baseline): no wounds, no control, no AI care
    function groundControl(s, a) {
      const R = L(); if (!R || !a || off(s)) return 0;
      const obs = a.id === "player" ? s.placeObservation : s.placeObservations?.[a.id];
      const share = H.Climate?.data?.observe?.familiarityShare || 0.25;
      const known = Math.min(1, (obs?.familiarity || 0) / share);
      return Math.min(1, known / R.controlAt);
    }

    // kind: a key of land.wounds; n: how many of it (tiles struck, soil units moved). Only fighters on the player or
    // enemy side go on the ledger; the wild, civilians and Gaia herself don't sin against the land in this count.
    function landWound(s, a, kind, n = 1, tiles) {
      const R = L(); if (!R || !a || off(s) || !(n > 0) || !FIGHTING.includes(a.side) || a.boss === "gaia") return 0;
      if (H.astralRegionOf?.(s, a.x, a.y) === "pocket") return 0;   // the plane has no Gaia: pocket wounds scar nothing
      const w = round1((R.wounds[kind] || 0) * n); if (!w) return 0;
      const st = landState(s);
      st.wounds = round1(st.wounds + w);
      st.ledger[a.id] = round1((st.ledger[a.id] || 0) + w);
      st.sides[a.side] = round1((st.sides[a.side] || 0) + w);
      const tp = temper(s, R);
      if (!st.warned && !st.gaia && st.wounds >= tp.warnAt) {
        st.warned = true;
        H.log(s, { kind: "gaiaWarning", actor: a.id, tiles, text: tp.voice.warn || "The ground answers. Gaia has noticed what is being done to the land.",
          why: [`The land has taken ${st.wounds} wounds this battle; from ${tp.warnAt} she may emerge at any round's start, certainly by ${tp.emergeAt}.`, "Knowing the place (Observe place) lets a fighter strike without scarring the ground."] });
      }
      const g = st.gaia && s.actors[st.gaia];
      if (g && !g.defeated && g.gaiaForm === "restored") {
        const since = st.wounds - st.atArrival;
        if (!st.enrageWarned && since >= R.enrageWarnAfter) {
          st.enrageWarned = true;
          H.log(s, { kind: "gaiaWarning", actor: g.id, tiles: [[g.x, g.y]], text: "Gaia's chest landscape dims. The accord is fraying.", why: [`${round1(since)} more wounds since she arrived; at ${R.enrageAfter} she becomes the Wounded Ground.`] });
        }
        if (since >= R.enrageAfter) setGaiaForm(s, g, "disturbed", "The land kept bleeding after she came.");
      }
      return w;
    }

    function worstOffender(s) {
      const st = landState(s);
      const ranked = Object.entries(st.ledger).map(([id, w]) => ({ u: s.actors[id], w })).filter((x) => x.u && FIGHTING.includes(x.u.side))
        .sort((a, b) => b.w - a.w || (a.u.id < b.u.id ? -1 : 1));
      const alive = ranked.find((x) => !x.u.defeated && !x.u.notArrived);
      return alive ? alive.u : null;
    }

    // Wounded Ground: hostile to everyone, so she leaves the outcome alone (only player and enemy hold a battle open),
    // and she hunts the top of the ledger. In Boss Rush she stays the enemy, since she is the fight.
    function setGaiaForm(s, g, form, why) {
      const B = GB(); if (!B || !g) return;
      const f = B.forms[form], was = g.gaiaForm;
      g.gaiaForm = form; g.name = f.name; g.sprite = form === "restored" ? "gaia-accord" : "gaia-wounded";
      g.bossAbilityIds = (B.formKits?.[form] || Object.keys(B.abilities)).map((k) => `boss_gaia_${k}`).filter((id) => H.ab(id));
      if (g.conditions?.enraged) for (const k of Object.keys(B.enragedUnlocks || {})) if (!g.bossAbilityIds.includes(`boss_gaia_${k}`)) g.bossAbilityIds.push(`boss_gaia_${k}`);
      if (!s.bossRush && !s.vignette && g.landArrival) g.side = form === "restored" ? g.allySide : "wild";
      if (form === "disturbed") {
        const room = [[1, 0], [0, 1], [1, 1]].every(([dx, dy]) => { const x = g.x + dx, y = g.y + dy; return H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove && !H.actorAt(s, x, y) && !(s.arena.objects || []).some((o) => o.x === x && o.y === y && o.blocksMove); });
        if (room) { g.size = { ...f.size }; g.massive = true; }
        const prey = worstOffender(s);
        if (prey) { g.forceTarget = prey.id; g.forceTargetUntil = 999; g.hunting = prey.id; }
      } else { g.size = { ...f.size }; g.massive = false; }
      if (was && was !== form) {
        for (const step of form === "disturbed" ? ["roots tear", "water drains", "the crown cracks"] : B.transition.animation) H.log(s, { kind: "gaiaTransition", actor: g.id, tiles: [[g.x, g.y]], text: `Gaia: ${step}.` });
        H.log(s, { kind: form === "disturbed" ? "gaiaReversal" : "gaiaAccord", actor: g.id, tiles: [[g.x, g.y]], text: `"${f.line}" ${f.name}${g.side === "wild" ? " turns on everyone" : ""}.`, why: why ? [why] : [] });
      }
    }

    // Round start: living ground forgives first, then from warnAt the chance climbs linearly to certain
    // at emergeAt. She comes once per battle.
    function landRound(s) {
      const R = L(), st = s.land; if (!R || !st || st.gaia || s.outcome || s.bossRush || s.vignette) return;
      if (s.dreamSpace?.region && !s.heartCourt) return;   // a heart court keeps its budget inside a dream
      if ((s.heartCourt?.heart?.hp ?? 1) <= 0 || s.heartCourt?.ascended) return;   // the broken heart rises as the World Goddess, not a second Gaia
      const tp = temper(s, R);
      if (tp.forgive > 0 && st.wounds > 0) {
        st.wounds = round1(Math.max(0, st.wounds - tp.forgive));
        if (st.warned && st.wounds < tp.warnAt) {
          st.warned = false;
          H.log(s, { kind: "landForgive", text: `The grass knits over old wounds (−${tp.forgive}). Gaia's attention fades.`,
            why: ["Living ground forgives a little every round; warn her again and she remembers faster."] });
        }
      }
      if (s.rules.land === false || st.wounds < tp.warnAt) return;
      if (Object.values(s.actors).some((u) => u.boss === "gaia" && !u.defeated)) return;
      const p = Math.min(1, (st.wounds - tp.warnAt) / Math.max(1, tp.emergeAt - tp.warnAt));
      if (p < 1 && H.seededChance(`${s.seed}:gaia-emerges:${s.round}`) >= p) return;
      const sinner = worstOffender(s); if (!sinner) return;
      const allySide = sinner.side === "player" ? "enemy" : "player";
      const spot = nearestOpen(s, sinner); if (!spot) return;
      arrive(s, sinner, allySide, spot);
    }
    function nearestOpen(s, u) {
      const open = (x, y) => H.inside(s, x, y) && !H.tileAt(s, x, y).blocksMove && !H.actorAt(s, x, y) && !H.barrierAt(s, x, y) && !(s.arena.objects || []).some((o) => o.x === x && o.y === y);
      for (let r = 1; r <= Math.max(s.arena.w, s.arena.h); r++) {
        const ring = [];
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && open(u.x + dx, u.y + dy)) ring.push([u.x + dx, u.y + dy]);
        ring.sort((a, b) => (Math.abs(a[0] - u.x) + Math.abs(a[1] - u.y)) - (Math.abs(b[0] - u.x) + Math.abs(b[1] - u.y)) || a[1] - b[1] || a[0] - b[0]);
        if (ring.length) return ring[0];
      }
      return null;
    }
    function arrive(s, sinner, allySide, at) {
      const R = L(), B = GB(), ch = H.C.characters["boss-gaia"], st = landState(s), id = "gaia-emerged";
      const base = s.actors.player || Object.values(s.actors)[0], g = H.freshBody(base, s);
      Object.assign(g, {
        id, character: "boss-gaia", boss: "gaia", landArrival: true, allySide, side: allySide, controller: "ai", ai: "boss", posture: "aggressive",
        permanentAlly: false, selectedConfig: null, category: null, traits: [], passives: {}, abilities: Object.keys(B.abilities), aiAbilities: null, learned: [],
        x: at[0], y: at[1], maxLF: R.arrivalLF, lf: R.arrivalLF, pf: s.rules.maxPF, maxPF: s.rules.maxPF, ultimateCharge: 0, conditions: {},
        reserve: [], reserveSlots: 0, pendingSwap: null, lens: {}, inventory: [], inventoryCapacity: 0, beads: [], form: null, summon: null, communed: null, dream: null,
        tempo: 0, tempoCapacity: 0, bankedTempo: 0, tempoDebt: 0, tempoSpent: 0, actionsThisTurn: 0, reaction: s.rules.reactionsPerRound, ownerTurns: 0, lastRecoverTurn: -99,
        moved: false, acted: false, guardUsedThisTurn: false, defeated: false, notArrived: false, escaped: false, knockedOut: false,
        forceTarget: sinner.id, forceTargetUntil: 999, hunting: sinner.id, color: ch?.color,
        status: Object.fromEntries(Object.keys(base.status || {}).map((k) => [k, null])),
      });
      s.actors[id] = g; st.gaia = id; st.atArrival = st.wounds;
      if (!s.order.includes(id)) s.order.splice(s.turnIndex + 1, 0, id);
      s.disclosures[id] = {}; s.knowledge[id] = {}; if (s.observedAbilities) s.observedAbilities[id] = [];
      for (const other of Object.keys(s.actors)) if (other !== id) { (s.knowledge[other] ||= {})[id] ||= { secondary: false, lens: false, abilities: {} }; s.knowledge[id][other] = { secondary: true, lens: true, abilities: {} }; }
      setGaiaForm(s, g, "restored");
      const tp = temper(s, R);
      H.log(s, { kind: "gaiaSummon", actor: id, target: sinner.id, tiles: [at], text: `Gaia, the Living Accord, ${tp.voice.rise || "rises beside"} ${sinner.name}. She fights for the ${allySide === "player" ? "player's" : "enemy's"} side.`,
        why: [`The land took ${st.wounds} wounds; ${sinner.name} dealt the most (${st.ledger[sinner.id]}).`, `${R.enrageAfter} more wounds turn her into the Wounded Ground, hostile to everyone.`] });
    }

    // What an AI candidate would cost the land, for a plant-based fighter who doesn't know the place yet (0 otherwise):
    // a ground-targeting technique's open tiles at groundTile, plants in its area at plantHit; a Strike on a plant.
    const PLANTS = ["tree", "hedge", "shrub", "groundcover"];
    function landCost(s, a, cand) {
      const R = L(); if (!R || !a || off(s) || !cand?.target) return 0;
      if (!a.communed && !(R.respectedBy || []).some((t) => H.hasTrait(a, t))) return 0;
      const control = groundControl(s, a); if (control >= 1) return 0;
      const plantAt = (x, y) => (s.arena.objects || []).find((o) => o.x === x && o.y === y && !o.destroyed && (o.kind === "plant" || PLANTS.includes(o.type)));
      if (cand.type === "strike") return plantAt(...cand.target) ? R.wounds.plantHit : 0;
      if (cand.type !== "ability") return 0;
      const def = H.ab(cand.ability); if (!def || !H.structures?.isGroundTargeting(def)) return 0;
      const m = H.manifest(s, a, cand.ability), tiles = H.areaTiles(s, a, m, cand.target[0], cand.target[1]);
      let w = 0; for (const [x, y] of tiles) w += plantAt(x, y) ? R.wounds.plantHit : R.wounds.groundTile * (1 - control);
      return w;
    }

    return { groundControl, landWound, landRound, setGaiaForm, landState, landCost, siteTemper: (s) => { const R = L(); return R ? { ...temper(s, R), ...composition(s) } : null; } };
  })();
});
