"use strict";
// Queries for the UI and the AI.
// A part of the Concept Combat engine, split out of engine.js on 2026-10-11 (tools/split-engine.mjs). It is not a
// module in its own right: engine.js installs it with the host object H (everything the engine closure has in
// scope) and it hands back the functions it defines. Function bodies are exactly as they were in engine.js.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).queries = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { EnemySummons, C, ClassRuntime, DIRS, EM, Parley, Vows, ab, abilitiesOf, actorAt, apply, barrierAt, classH, clone, currentId, dist, dreamSame, dreamSpaceRules,
      effectiveRange, heightAt, inside, isMonster, key, manifest, monsterCtx, moveBudgetFor, movementTempoCost, ownerOfConcept, paths, target, tileAt,
      unitAt, usableRamp, wildRules, grappled } = H;
    // defined by parts installed after this one: reached through H when called
    const candidates = (...args) => H.candidates(...args);

    // ── queries for UI / AI ────────────────────────────────────────────────
    // The Actor's costumes alternate: a live actor-m means the next spawn is actor-f and vice versa;
    // the first of the battle is a seeded coin flip (mirror rule in director.js deliverCameo).
    function actorLook(s, a, ch, seed) {
      if (a.id === "player" && a.character === "warden" && (ch.level || 1) >= (C.progression.neonWardenLevel || 200)) return "neo-warden-purple-neon";   // Mala 2026-10-23: the level-200 look. Explicit sprites and learned forms still win (engine.js order).
      if (a.character !== "actor" || !ch.variants?.length) return null;
      const live = Object.values(s.actors || {}).find((u) => u && !u.defeated && ch.variants.includes(u.sprite))?.sprite;
      if (live) return ch.variants.find((v) => v !== live) || null;
      let h = 2166136261;
      for (const char of `${seed ?? 0}:${a.id}:look`) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0;
      h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13;
      return ch.variants[(h >>> 0) % ch.variants.length];
    }
    // Innovation (muse, 2026-10-16): Prototype copies one witnessed damaging basic at the copying
    // tax; Recombine fuses 2+ readied damaging basics into one action; What If lets a basic resolve
    // as another known basic (options.whatIfAs) while the window holds. Called from manifest.
    function innovationManifest(s, a, m, options, lens) {
      const abilityId = m.ability, d = ab(abilityId);
      if (a.riteAugment?.checked?.[abilityId] && a.riteAugment.charges > 0) {   // Rites (Muse-2; moved here from engine.js manifest for the line cap): read-only here; charges spend at commit (resolveAbility), so previews are safe
        const g = a.riteAugment;
        if (g.potencyAdd) m.potency += g.potencyAdd;
        // Receipt honesty (Mala, 2026-10-24): +range prints only when the bump lands somewhere the cast
        // uses — the Far Shot liveRangeChange rule, reused. A bumped-but-unused range stat, a zero range
        // that cannot bump, a self cast, and a field wide of single all stay off the receipt.
        let liveRangeChange = false;
        if (g.rangeAdd) { if (m.delivery === "routed") { const before = m.routeBudget; m.routeBudget = Math.max(1, m.routeBudget + g.rangeAdd); liveRangeChange = m.routeBudget !== before; }
          else if (m.range > 0) { const before = m.range; m.range = Math.max(1, m.range + g.rangeAdd); liveRangeChange = m.range !== before && m.target !== "self" && !(m.delivery === "field" && m.area?.shape !== "single"); } }
        if (g.piercing) m.piercing = true;
        m.notes.push(`Rite-ink: ${g.charges} charge${g.charges === 1 ? "" : "s"}${g.potencyAdd ? `, +${g.potencyAdd} potency` : ""}${liveRangeChange ? `, +${g.rangeAdd} range` : ""}${g.piercing ? ", piercing" : ""}.`);
      }
      const vb = Vows?.techBoon?.(s, a);   // Technique stances: sworn oaths read on every cast, same shape as rite-ink
      if (vb) {
        let liveRangeChange = false;
        if (vb.potencyAdd) m.potency += vb.potencyAdd;
        if (vb.rangeAdd) { if (m.delivery === "routed") { const before = m.routeBudget; m.routeBudget = Math.max(1, m.routeBudget + vb.rangeAdd); liveRangeChange = m.routeBudget !== before; }
          else if (m.range > 0) { const before = m.range; m.range = Math.max(1, m.range + vb.rangeAdd); liveRangeChange = m.range !== before && m.target !== "self" && !(m.delivery === "field" && m.area?.shape !== "single"); } }
        if (vb.piercing) m.piercing = true;
        const receipt = `${vb.potencyAdd ? ` +${vb.potencyAdd} potency` : ""}${liveRangeChange ? ` +${vb.rangeAdd} range` : ""}${vb.piercing ? " piercing" : ""}`;
        m.notes.push(`Oath-bound (${vb.names.join(" + ")}):${receipt || " no applicable change"}.`);
      }
      // The Aviator (Mala, 2026-10-18): Aerodynamic and Thrust each add 2 to Propulsion's dash, and they stack (5 → 9).
      if (abilityId === "propulsion") {
        const add = ((a.traits || []).some((t) => (t?.id || t) === "aerodynamic") ? 2 : 0) + (H.ClassRuntime?.aeroForce?.(a) === "thrust" ? 2 : 0);
        if (add) { m.range = (m.range || 5) + add; m.chargeTiles = (d.chargeTiles || 5) + add; m.area = { ...(m.area || {}), length: m.range }; m.notes.push(`Aerodynamic and Thrust stretch the dash: ${m.range} tiles.`); }
      }
      // Sampler (the Mangaka's trait, Mala 2026-10-18): the first two Clips each turn are free; after two, one Juxtapose that turn
      // is free and charges nothing. Cut Out (the vow form) is never free. Counted in resolve.js (a.sampler).
      if ((a.traits || []).some((t) => (t?.id || t) === "sampler")) {
        const T = a.sampler?.turn === a.ownerTurns ? a.sampler : { clips: 0, juxt: false };
        if (abilityId === "clip" && T.clips < 2) { m.cost = 0; m.tempoCost = 0; m.samplerFree = true; m.notes.push(`Sampler: a free Clip (${T.clips + 1} of 2 this turn).`); }
        if (abilityId === "juxtapose" && T.clips >= 2 && !T.juxt) { m.cost = 0; m.tempoCost = 0; m.samplerNoCharge = true; m.notes.push("Sampler: two Clips this turn, so this Juxtapose is free (and charges nothing)."); }
      }
      const innoCopyable = (id) => { const dd = ab(id); return dd && dd.tier === "basic" && (!dd.timing || dd.timing === "immediate") && !dd.announce && dd.effect === "damage" && dd.target === "enemy" && dd.area?.shape === "single" && Number.isFinite(dd.potency); };   // the cyph-bars filter: a copy needs a plain damaging shape for the tax to bite
      if (m.effect === "prototype") {
        const tax = lens.copyTax || C.concepts.innovation.copy.tax, src = options.prototypeSource, seen = s.observedAbilities?.[a.id] || [];
        if (src && seen.includes(src) && innoCopyable(src)) {
          const sm = manifest(s, a, src);   // no options: the source resolves clean, never re-enters What If or a copy
          m.prototypeOf = src; m.delivery = sm.delivery; m.target = sm.target; m.area = clone(sm.area);
          m.effect = "damage"; m.damageType = sm.damageType; m.potency = Math.max(1, Math.round(sm.potency * tax));
          m.range = sm.range; m.routeBudget = sm.routeBudget || 0;
          m.notes.push(`Prototype copies ${sm.name} at ×${tax}: ${m.potency} potency, the original's shape and counters kept.`);
        } else m.prototypeInvalid = true;
      }
      if (m.effect === "recombine") {
        const tax = lens.copyTax || C.concepts.innovation.copy.tax, need = lens.fuseNeed || 2, parts = options.recombineParts || [], known = [...abilitiesOf(a), ...(s.observedAbilities?.[a.id] || [])];   // own or witnessed basics (Lantern, 2026-10-18: the Mangaka holds no damaging basic of her own)
        const pms = parts.map((id) => (known.includes(id) && innoCopyable(id) ? manifest(s, a, id) : null));
        if (parts.length >= need && parts.length <= 3 && new Set(parts).size === parts.length && pms.every(Boolean) && pms.every((p) => p.delivery === pms[0].delivery)) {
          m.recombineParts = parts.slice(); m.recombineTax = tax; m.delivery = pms[0].delivery; m.target = pms[0].target; m.area = clone(pms[0].area);
          m.range = pms[0].range; m.routeBudget = pms[0].routeBudget || 0;
          m.recombineHits = pms.map((p) => ({ name: p.name, potency: Math.max(1, Math.round(p.potency * tax)), damageType: p.damageType }));
          m.potency = m.recombineHits.reduce((n, h) => n + h.potency, 0);   // display sum; resolve hits per part, each with its own channel
          m.notes.push(`Recombine fuses ${pms.map((p) => p.name).join(" + ")}: each at ×${tax}, one action.`);
        } else m.recombineInvalid = true;
      }
      if (options.whatIfAs && d.tier === "basic" && options.whatIfAs !== abilityId && a.status?.whatIf?.untilRound >= s.round) {
        const td = ab(options.whatIfAs);
        if (td && td.tier === "basic" && abilitiesOf(a).includes(options.whatIfAs)) {
          const tm = manifest(s, a, options.whatIfAs);
          m.whatIfVia = abilityId; m.delivery = tm.delivery; m.target = tm.target; m.area = clone(tm.area);
          m.effect = tm.effect; m.damageType = tm.damageType; m.potency = tm.potency; m.range = tm.range;
          m.routeBudget = tm.routeBudget || 0; m.cost = tm.cost; m.announce = tm.announce || m.announce;   // the energy follows the effect produced, not the slot spent
          m.notes.push(`What If: ${d.name} played as ${tm.name}.`);
        }
      }
    }
    function decider(s) {
      if (s.outcome) return null;
      if (s.phase === "response") return { actor: s.pending.defenders[s.pending.responded.length], kind: "response" };
      if (s.phase === "mind" && s.mindDuel) {   // Mind duel: the concession waits on its loser; picks wait on the player first, then whoever is left
        const du = s.mindDuel;
        if (du.concede) return { actor: du.concede.by, kind: "mind" };
        if ([du.a, du.b].includes("player") && !du.picks.player) return { actor: "player", kind: "mind" };
        return { actor: [du.a, du.b].find((id) => !du.picks[id]) || du.a, kind: "mind" };
      }
      return { actor: currentId(s), kind: "turn" };
    }
    function moveOptions(s, id) {
      if (ClassRuntime && ClassRuntime.beforeMove(s, s.actors[id], classH())) return [];   // ClassRuntime: a vowed unit has no moves
      if (Vows && Vows.refuses(s, s.actors[id], "move")) return [];   // Vows: Rooted
      if (H.States?.refusesKind(s, s.actors[id], "move")) return [];   // States: a gate holds movement
      const a = s.actors[id];
      if (grappled(s, a) || a.status?.wrapped?.forTurn === a.ownerTurns) return [];   // Grapple: held; Binding Wraps: wrapped
      const budget = H.Injury.moveBudget(s, a, moveBudgetFor(s, a)), P = paths(s, a.x, a.y, budget, "move"); const out = [];   // Injury: wounded legs −1 (min 0), maimed legs 0
      for (const [k, n] of P.dist) if (n > 0) { const [x, y] = k.split(",").map(Number), path = P.pathTo(x,y), tempoCost = movementTempoCost(s,a,path); if (tempoCost <= a.tempo) out.push({ to: [x, y], path, cost: n, tempoCost }); }
      if (isMonster(a)) { const ctx = monsterCtx(s); return out.filter(o => EM.canEndAt(a, o.to, ctx).ok); }   // shade to shade, inside its haunt, never beside fire
      return out;
    }
    function jumpOptions(s, id) {
      const a = s.actors[id]; if (a.tempo < H.jumpCost(s, a) || grappled(s, a) || H.relocationHold(s, a) || H.States?.refusesKind(s, a, "move") || (H.Injury?.gradeOf(a, "legs") || 0) === 2) return [];
      return DIRS.map(([dx, dy]) => [a.x + dx, a.y + dy]).filter(([x, y]) => inside(s, x, y) && dreamSame(s,a.x,a.y,x,y)
        && heightAt(s, a.x, a.y) - heightAt(s, x, y) >= 2 && !tileAt(s, x, y).blocksMove && (!barrierAt(s, x, y) || barrierAt(s, x, y).passable) && !unitAt(s, x, y) && (!a.awakened || H.footOpen(s, a, x, y, "move")))   // TS-01: offer only landings the whole body fits
        .map((to) => ({ to, drop: heightAt(s, a.x, a.y) - heightAt(s, to[0], to[1]), damage: (heightAt(s, a.x, a.y) - heightAt(s, to[0], to[1]) - 1) * s.rules.fallDamagePerLevel / 2 }));
    }
    function climbOptions(s, id) {
      const a = s.actors[id]; if (grappled(s, a) || H.relocationHold(s, a) || a.tempo < H.climbCost(s, a) || H.States?.refusesKind(s, a, "move") || (H.Injury?.gradeOf(a, "legs") || 0) === 2) return [];
      return DIRS.map(([dx, dy]) => [a.x + dx, a.y + dy]).filter(([x, y]) => inside(s, x, y) && dreamSame(s,a.x,a.y,x,y)
        && heightAt(s, x, y) - heightAt(s, a.x, a.y) >= 2 && !usableRamp(s, a.x, a.y, x, y)
        && !tileAt(s, x, y).blocksMove && (!barrierAt(s, x, y) || barrierAt(s, x, y).passable) && !unitAt(s, x, y) && (!a.awakened || H.footOpen(s, a, x, y, "move")))
        .map((to) => ({ to, rise: heightAt(s, to[0], to[1]) - heightAt(s, a.x, a.y) }));
    }
    // For the UI: every tile's legality for an ability, plus area/route for legal tiles.
    function targeting(s, id, abilityId, options = {}) {
      const a = s.actors[id]; const m = manifest(s, a, abilityId, options);
      const range = []; const legal = [];
      if (m.target === "self" && m.effect !== "barrier") {
        const t = target(s, a, m, a.x, a.y, options); return t.ok ? { m, selfCast: true, range: t.tiles, legal: [{ at: [a.x, a.y], tiles: t.tiles }] } : { m, selfCast: true, range: [], legal: [], error: t.error };
      }
      const relayFirst = m.potency > 0 ? ClassRuntime?.relayOrigins?.(s, a) || [] : [];
      for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) {
        const reach = effectiveRange(s, a, m, x, y);
        if (dist(s, a.x, a.y, x, y) <= reach && !(x === a.x && y === a.y && m.range !== 0)) range.push([x, y]);
        if (Parley && actorAt(s, x, y) && Parley.blocks(s, a, actorAt(s, x, y))) continue;   // Parley: terms, talked down, distracted
        const t = target(s, a, m, x, y, options); if (t.ok) legal.push({ at: [x, y], tiles: t.tiles, route: t.route || null, section: t.section || null });
      }
      // Distributed Intelligence: a damaging technique can also be aimed from any of his towers (class-runtime relayFor).
      const origins = m.potency > 0 ? ClassRuntime?.relayOrigins?.(s, a) || [] : [];
      if (origins.length) { const home = [a.x, a.y], seen = new Set(legal.map((l) => l.at.join(",")));
        try { for (const [ox, oy] of origins) { a.x = ox; a.y = oy;
          for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) { if (seen.has(`${x},${y}`)) continue; const t = target(s, a, m, x, y, options);
            if (t.ok) { seen.add(`${x},${y}`); legal.push({ at: [x, y], tiles: t.tiles, route: t.route || null, section: t.section || null, relay: [ox, oy] }); } } } }
        finally { a.x = home[0]; a.y = home[1]; } }
      const only=ab(abilityId)?.contract?.cast?.onlyType;
      if(only&&only!=="none")for(let i=legal.length-1;i>=0;i--){const [x,y]=legal[i].at,t=actorAt(s,x,y)||s.wild?.find(t=>t.x===x&&t.y===y);if(!t||!H.Contracts.matches(s,t,only))legal.splice(i,1);}
      return { m, range, legal };
    }
    // Dry-run an action on a copy: who loses what, and the explanation lines.
    function preview(s, action) {
      const r = apply(s, action, { preview: true });
      if (!r.ok) return { ok: false, error: r.error };
      let st = r.state;
      const announced = st.phase === "response";
      if (announced) { // assume no responses, to show the committed outcome
        let guard = 0;
        while (st.phase === "response" && guard++ < 6) st = apply(st, { type: "respond", actor: decider(st).actor, response: "none" }, { preview: true }).state;
      }
      // A unit the action itself brought onto the field (a Mummy rising as its Pharaoh falls) has no "before" to compare.
      const deltas = Object.values(st.actors).filter((t) => s.actors[t.id]).map((t) => ({ id: t.id, name: t.name, lf: s.actors[t.id].lf - t.lf, pf: s.actors[t.id].pf - t.pf })).filter((d) => d.lf || d.pf);
      // Wild monsters live apart from the actors; their losses are reported separately so callers opt in (engine/ai.js:
      // a communed plant striking back at a wild monster that hit it).
      const wildDeltas = (st.wild || []).map((m) => { const b = (s.wild || []).find((x) => x.id === m.id); return b ? { id: m.id, name: m.name || m.kind, lf: (b.lf || 0) - (m.lf || 0) } : null; }).filter((d) => d && d.lf);
      return { ok: true, deltas, wildDeltas, events: st.log.slice(s.log.length), announced, pending: r.state.pending };
    }
    // Inspired ultimates (docs/inspired-ultimates.md): with a full bar and too little ΦF, one Inspiration pays the whole ΦF.
    function inspiredPay(s, a, m) {
      const n = s.rules.inspiration?.ultimatePoint; if (!n) return false;   // 0/false switches the rule off (sims)
      return m?.tier === "ultimate" && (a.pf || 0) < m.cost && (a.inspiration || 0) >= n && (a.ultimateCharge || 0) >= s.rules.ultimateChargeMax;
    }
    function availableAbilities(s, id) {
      const a = s.actors[id];
      const ids = abilitiesOf(a);   // includes anything learned by watching, for every class (tests/learned.test.mjs)
      return ids.map((abId) => {
        const m = manifest(s, a, abId);
        const mastered = !!s.rules.mastery && (a.traits || []).some((t) => (typeof t === "string" ? t : t?.id) === s.rules.mastery.trait);
        const ultimateReady = m.tier !== "ultimate" || (!dreamSpaceRules?.ultimatesBlocked(a, s.dreamSpace, s.rules) && (a.ultimateCharge >= s.rules.ultimateChargeMax || mastered));
        const contract=H.Contracts?.status(s,a,abId);
        const collateral = !!H.Tally && H.Tally.held(s, a) === abId;   // the ledger boss holds it (engine/tally.js)
        const blocked = H.fruitBlocked?.(s, a, abId) || null;   // Sinkerfruit: the sea takes it (engine/fruit.js)
        return { id: abId, m, contract, source: ownerOfConcept(a, m.concept), ...(collateral ? { collateral: true } : {}), ...(blocked ? { blocked } : {}), affordable: !blocked && (!contract||contract.ready) && !collateral && !a.quickenedSpent?.[abId] && (a.pf >= m.cost || inspiredPay(s, a, m)) && (a.tempo >= m.tempoCost || ["damage", "field"].includes(m.effect)) && ultimateReady, revealed: !!s.disclosures[id][abId] };
      });
    }

    // Belief is a rare, seed-stable opportunity: repeated AI evaluation during one turn
    // returns the same result and cannot reroll until the next round.
    function seededChance(label) {
      let h = 2166136261;
      for (const c of label) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
      h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    }
    function beliefSummonCandidate(s, a) {
      if (EnemySummons?.qualifies(a)) return EnemySummons.candidate(s, a, { ...H, seededChance });
      const strength = a.beliefStrength || 1;
      if (a.side !== "enemy" || !a.passives.rareMonsterSummon || a.beliefSummonUsed
        || a.tempo < 50 || a.pf < 6 || seededChance(`${s.seed}:${s.round}:${a.id}:belief`) >= (a.passives.uncontrolledDreamSummons ? 0.25 : 0.12)) return null;
      const dreamPool = strength >= 2 ? dreamSpaceRules?.enemyMonsterPool?.(strength) || {} : {};
      const dreamKeys = Object.keys(dreamPool).filter(key => !Object.values(s.actors).some(t=>!t.defeated&&t.dream?.key===key));
      const wildKeys = (wildRules?.data?.monsters ? ["feralPig", "termites"].filter(kind => wildRules.data.monsters[kind]
        && wildRules.data.monsters[kind].form === "unit" && !s.wild.some(m => m.kind === kind)) : []);
      const dreamOnly = strength >= 2 && dreamKeys.length > 0;
      const pool = dreamOnly ? dreamKeys : strength === 1 || !dreamKeys.length ? wildKeys : dreamKeys;
      if (!pool.length || (dreamOnly && !dreamSpaceRules?.makeEnemyDreamActor)
        || (!dreamOnly && (!wildRules?.summonMonster || s.wild.length >= (wildRules.data.rules.maxActive || 3)))) return null;
      const maxCount = strength >= 3 ? 2 : 1;
      const count = maxCount === 2 && seededChance(`${s.seed}:${s.round}:${a.id}:belief-count`) < 0.5 ? 2 : 1;
      const chosen = [];
      for (let i=0;i<count;i++) chosen.push(pool[Math.floor(seededChance(`${s.seed}:${s.round}:${a.id}:belief-kind:${i}`)*pool.length)]);
      if (a.tempo < 50 * count || a.pf < 6 * count) return null;
      const candidates = [];
      const radius = dreamOnly ? 4 : 1, minimum = dreamOnly ? 2 : 1;
      for(let y=0;y<s.arena.h;y++) for(let x=0;x<s.arena.w;x++) {
        const d=dist(s,a.x,a.y,x,y);
        if(d<minimum||d>radius||actorAt(s,x,y)||s.wild.some(m=>m.form==="unit"&&m.x===x&&m.y===y)
          ||tileAt(s,x,y).blocksMove||(barrierAt(s,x,y)&&!barrierAt(s,x,y).passable)) continue;
        candidates.push([x,y]);
      }
      if(candidates.length<count) return null;
      candidates.sort((p,q)=>seededChance(`${s.seed}:${s.round}:${a.id}:belief-tile:${p[0]},${p[1]}`)-seededChance(`${s.seed}:${s.round}:${a.id}:belief-tile:${q[0]},${q[1]}`));
      return dreamOnly
        ? { type:"monsterSummon", actor:a.id, dreamKinds:chosen, tiles:candidates.slice(0,count) }
        : { type:"monsterSummon", actor:a.id, kind:chosen[0], at:candidates[0] };
    }

    function foldAt(s, x, y) {   // Folding: the live paper crossing on a tile, if any
      return (s.barriers || []).find((b) => b.foldCrossing && b.x === x && b.y === y && s.actors[b.owner] && s.actors[b.owner].ownerTurns < b.expiresAt) || null;
    }
    // A rite checkbox is a hit the ink can ride. Reads the card: manifest copies no merge flag and defaults damageType.
    // Lives here, not on the content object: C must stay structured-cloneable (integrator glue, 2026-10-22).
    function riteDraws(def) {
      if (!def || def.delivery === "signal") return false;
      if (def.effect === "damage") return true;
      if (def.effect) return false;
      return !!(def.merge && def.potency > 0 && (def.damageType || def.channel));
    }
    // A new body built from the player's record (backup officer, Customer, Kaiba, Gaia's arrival) is fresh, not a copy:
    // the player's form rode along, and when that copy ended it restored the form's saved sprite, so officers turned
    // into the Warden (Mala, 2026-10-27: "this feels like the matrix"). The summon reset (summons.js freshen) clears the
    // rest of the player's running state when summons are loaded; callers then set the body's own fields.
    function freshBody(base, s) {
      const a = H.clone(s?.spawnBase && base?.id === "player" ? s.spawnBase : base);   // start from the battle-start player: nothing gained mid-battle carries over
      if (H.summonRules?.freshen) H.summonRules.freshen(a);
      else { a.form = null; a.formCooldownUntil = 0; for (const k of ["priorSprite", "priorSide", "priorName", "aura", "vows", "focus", "contractActive", "formsEntered", "formVowSpent", "heartScroll", "learnedForms", "embodied"]) delete a[k]; }
      Object.assign(a, { summon: null, beads: [], ritual: null, dream: null, rite: null, riteAugment: null, inspiration: 0, audition: null, husk: false, pendingSwap: null, knockedOut: false, escaped: false });
      for (const k of ["soul", "maxSoul", "soulKind", "fruit", "beastSummons", "stateOffers", "orbitKit", "styleConcept"]) delete a[k];   // setup carries too: the Sinkerfruit kit and carried creatures are the player's
      Object.assign(a, { beliefStrength: 0, level: 1, xp: 0, proficiency: 1, status: Object.fromEntries(Object.keys(a.status || {}).map((k) => [k, null])) });   // sites set their own after   // ensureSoul (damage.js) rebuilds the soul from the body's own character   // not in the summon reset; a spawned body starts without them
      if (H.Injury) a.injuries = H.Injury.fresh();   // clones arrive at all-zero
      return a;
    }
    return { decider, moveOptions, jumpOptions, climbOptions, targeting, preview, availableAbilities, seededChance, beliefSummonCandidate, actorLook, innovationManifest, foldAt, riteDraws, freshBody, inspiredPay };
  })();
});
