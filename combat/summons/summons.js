"use strict";
// Summon rules: who can be called (from memory-palace progress), where they appear, the actor record
// the engine adds, expiry, and each attitude's target policy. Pure functions; the engine owns turns.
//
//   available(palace)                     palace = { rooms: { [roomId]: { visited, recalled } } }
//   canSummon(battle, id)                 battle = { active: [ids], used: [ids], ap, pf }
//   placeSummon(arena, from, occupied)    nearest free walkable tile within rules.appearsWithin
//   makeSummonActor(id, { owner, at, bond })
//   afterOwnTurn(actor)                   → { actor, expired }
//   pickTarget(snapshot, actor)           → { target, why, stand }   (attitude policy)
//
// Bond with the palace: visiting a summon's room unlocks it (bond 1); recalling it correctly in
// Recall mode strengthens it (bond 2: +1 turn). Learning the palace is how you build your roster.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./summons-data.js"), require("../terrain/mapgen.js"));
  else root.ConceptCombatSummons = factory(root.ConceptCombatSummonData, root.ConceptCombatMapgen);
})(typeof self !== "undefined" ? self : this, function (SD, G) {
  const R = SD.rules, DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  function roll(seed, tag) {
    let h = 2166136261;
    for (const c of `${seed}:${tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // Two unlock sources:
  //   battle game: { unlocked: [ids] } from the persistent account (account/account.js, by level)
  //   palace:      { rooms: { [roomId]: { visited, recalled } } }  (kept for the exploratory game)
  // In the battle game the summon's strength comes from the in-combat question (questions.js), not the palace.
  function available(source = { rooms: {} }) {
    if (Array.isArray(source.unlocked)) return Object.entries(SD.summons).map(([id, s]) => ({
      id, name: s.name, attitude: s.attitude, room: s.room, unlocked: source.unlocked.includes(id), bond: 1, duration: R.baseDuration, by: "account" }));
    const palace = source;
    return Object.entries(SD.summons).map(([id, s]) => {
      const room = (palace.rooms || {})[s.room] || {};
      const bond = room.recalled ? 2 : room.visited ? 1 : 0;
      return { id, name: s.name, attitude: s.attitude, room: s.room, bond, unlocked: bond > 0, duration: R.baseDuration + (bond === 2 ? R.bondBonusDuration : 0) };
    });
  }

  function canSummon(battle, id, palace) {
    const a = available(palace).find((x) => x.id === id);
    if (!a) return { ok: false, reason: "No such summon." };
    if (!a.unlocked) return { ok: false, reason: a.by === "account" ? `${a.name} isn't in your palace yet: level up to unlock them.` : `Visit ${a.name}'s room in the memory palace first.` };
    const maxActive = battle.maxActive ?? R.maxActive, apCost = battle.apCost ?? R.actionCost, phiCost = battle.phiCost ?? R.phiCost;
    if ((battle.active || []).length >= maxActive) return { ok: false, reason: maxActive === 1 ? "Another summon is already on the field." : `Your ${maxActive} summon slots are already occupied.` };
    if (R.oncePerEncounter && (battle.used || []).includes(id)) return { ok: false, reason: `${a.name} has already returned to the palace this battle.` };
    if ((battle.ap ?? 100) < apCost) return { ok: false, reason: `Summoning needs ${apCost} action points.` };
    if ((battle.pf ?? 30) < phiCost) return { ok: false, reason: `Summoning needs ${phiCost} ΦF.` };
    return { ok: true, duration: a.duration, bond: a.bond };
  }

  function placementTiles(arena, from, occupied = new Set()) {
    const costs = G.walkCosts(arena, from);
    const out = [];
    for (const [k, c] of costs) {
      if (k === `${from[0]},${from[1]}` || occupied.has(k)) continue;
      const [x, y] = k.split(",").map(Number);
      const d = Math.abs(x - from[0]) + Math.abs(y - from[1]);
      if (d > R.appearsWithin) continue;
      out.push({ at: [x, y], distance: d, cost: c, key: k });
    }
    return out.sort((a, b) => a.distance - b.distance || a.cost - b.cost || a.key.localeCompare(b.key)).map(x => x.at);
  }
  function placeSummon(arena, from, occupied = new Set(), preferredAt = null) {
    const options = placementTiles(arena, from, occupied);
    if (preferredAt) return options.some(at => at[0] === preferredAt[0] && at[1] === preferredAt[1]) ? preferredAt.slice() : null;
    return options[0] || null;
  }

  // bond 2 / potencyMul come from the summon question (questions.scoreAnswer) or the palace recall.
  function makeSummonActor(id, { owner = "player", at, bond = 1, potencyMul = 1, durationAdd = 0 } = {}) {
    const s = SD.summons[id];
    return {
      id: `summon-${id}`, name: s.name, side: "player", controller: "ai", character: id, ...(s.sprite ? { sprite: s.sprite } : {}),   // a summon drawn from another body's art (Gaia)
      summon: { key: id, owner, turnsLeft: Math.max(1, R.baseDuration + (bond === 2 ? R.bondBonusDuration : 0) + durationAdd), bond, potencyMul },
      attitude: s.attitude, weights: SD.attitudes[s.attitude].weights,
      primary: s.standIn.primary, secondary: s.standIn.secondary,
      maxLF: R.maxLF, lf: R.maxLF, x: at[0], y: at[1],
    };
  }

  // Death's door: does a summon arrive when its owner goes down? Pure and seeded.
  //   deathDoor({ seed, round, ownerId, apLeft, unlocked: [ids], used: [ids], active: [ids], spent, gambler })
  //     → { ok, id, chance, roll, reason }
  //   deathDoorNeed(gambler)           → action points that must be unspent: the summon's cost, half for a Gambler
  //   deathDoorChance(apLeft, gambler) → the odds alone (0 below the requirement), for menus and the AI
  function deathDoorNeed(gambler = false) {
    const D = R.deathDoor; if (!D || !D.requiresSummonCost) return 1;
    return Math.ceil(R.actionCost * (gambler && D.gambler ? D.gambler.costMul : 1));
  }
  function deathDoorChance(apLeft = 0, gambler = false) {
    const D = R.deathDoor; if (!D || !(apLeft >= deathDoorNeed(gambler))) return 0;
    const mul = gambler && D.gambler ? D.gambler.chanceMul : 1;
    return Math.min(D.maxChance * mul, (D.baseChance + D.perTurnOfAp * Math.min(1, apLeft / 100)) * mul);
  }
  function deathDoor({ seed = 0, round = 0, ownerId = "player", apLeft = 0, unlocked = [], used = [], active = [], spent = false, gambler = false } = {}) {
    const D = R.deathDoor, no = (reason, extra = {}) => ({ ok: false, id: null, chance: 0, roll: null, reason, ...extra });
    if (!D) return no("death's door is off");
    if (spent && D.oncePerBattle) return no("already used this battle");
    if (!(apLeft > 0)) return no("no action points left");
    if (active.length >= R.maxActive) return no("a summon is already on the field");
    const pool = unlocked.filter((id) => SD.summons[id] && !(R.oncePerEncounter && used.includes(id))).sort();
    if (!pool.length) return no("no unlocked summon left to come");
    if (apLeft < deathDoorNeed(gambler)) return no(`fewer than the ${deathDoorNeed(gambler)} action points a summon costs${gambler ? " a Gambler" : ""}`);
    const chance = deathDoorChance(apLeft, gambler);
    const r = roll(seed, `deathDoor:${round}:${ownerId}`);
    if (r >= chance) return no("the roll failed", { chance, roll: r });
    return { ok: true, id: pool[Math.floor(roll(seed, `deathDoor:who:${round}:${ownerId}`) * pool.length)], chance, roll: r, reason: null };
  }

  // The form currently driving a summon: its MAX form once revealed, else its true form, else null.
  // Techniques, ultimates and summaries all read through here so MAX replaces cleanly.
  function activeForm(summon) {
    const def = SD.summons[summon?.summon?.key];
    if (summon?.summon?.maxForm && def?.maxForm) return def.maxForm;
    if (summon?.summon?.trueForm && def?.trueForm) return def.trueForm;
    return null;
  }
  function activeUltimate(summon) {
    const def = SD.summons[summon?.summon?.key];
    if (summon?.summon?.maxForm && def?.maxForm?.ultimate) return def.maxForm.ultimate;
    return def?.ultimate;
  }

  // Reveal once per summoned incarnation; closing the dream does not undo it.
  function revealTrueForm(actor) {
    const form=SD.summons[actor.summon?.key]?.trueForm;
    if(!form || actor.summon.trueForm || actor.defeated || actor.lf<=0) return {actor,changed:false};
    const maxLF=Math.round(actor.maxLF*form.maxLFMul);
    // True-form passives merge onto what the summon already has; channel resistances multiply.
    const extra=form.passives || {},channels={...(actor.passives?.channelDamageMul || {})};
    for(const [type,mul] of Object.entries(extra.channelDamageMul || {})) channels[type]=+((channels[type] ?? 1)*mul).toFixed(4);
    const passives={...(actor.passives || {}),...extra,pfRegenAdd:(actor.passives?.pfRegenAdd || 0)+form.pfRegenAdd};
    if(Object.keys(channels).length) passives.channelDamageMul=channels;
    const summon={...actor.summon,trueForm:true,trueFormPotencyMul:form.potencyMul};
    if(form.technique) summon.technique={id:form.technique.id,cooldown:0,uses:0};   // unlocked by the reveal; ready on its next turn
    const out={...actor,name:form.name,sprite:form.sprite || actor.sprite,maxLF,
      lf:Math.max(1,Math.round(maxLF*actor.lf/actor.maxLF)),passives,summon};
    if(form.traits) out.trueFormTraits=form.traits.map(t=>t.id);
    return {changed:true,actor:out,text:form.text};
  }

  // MAX reveal (Mala, 2026-10-24): a revealed summon with a maxForm goes MAX permanently for this stay.
  // Double the turns left, the MAX body's LF and potency, the MAX technique ready on its next turn, and
  // a fresh ultimate (the new form has its own to give). Nothing here fades when the dream closes.
  function revealMaxForm(actor) {
    const form=SD.summons[actor.summon?.key]?.maxForm;
    if(!form || !actor.summon?.trueForm || actor.summon.maxForm || actor.defeated || actor.lf<=0) return {actor,changed:false};
    const maxLF=Math.round(actor.maxLF*form.maxLFMul);
    const extra=form.passives || {},channels={...(actor.passives?.channelDamageMul || {})};
    for(const [type,mul] of Object.entries(extra.channelDamageMul || {})) channels[type]=+((channels[type] ?? 1)*mul).toFixed(4);
    const passives={...(actor.passives || {}),...extra,pfRegenAdd:(actor.passives?.pfRegenAdd || 0)+(form.pfRegenAdd || 0)};
    if(Object.keys(channels).length) passives.channelDamageMul=channels;
    const summon={...actor.summon,maxForm:true,maxFormPotencyMul:form.potencyMul,
      turnsLeft:Math.max(1,(actor.summon.turnsLeft ?? 1)*(form.turnsMul ?? 2)),ultimateUsed:false};
    if(form.technique) summon.technique={id:form.technique.id,cooldown:0,uses:0};
    const out={...actor,name:form.name,sprite:form.sprite || actor.sprite,maxLF,
      lf:Math.max(1,Math.round(maxLF*actor.lf/actor.maxLF)),passives,summon};
    if(form.traits) out.trueFormTraits=form.traits.map(t=>t.id);
    return {changed:true,actor:out,text:form.text};
  }

  // ── true-form techniques ──────────────────────────────────────────────────────────────────
  // Unlocked by the reveal. At the start of each of its own turns a revealed summon uses its
  // technique if the cooldown is up and it has a legal use; otherwise nothing is spent. Pure:
  //   trueFormTechnique(snapshot, summon) → { fired, summon, effects, event }
  //   snapshot = pickTarget's snapshot + { isFree(x,y), fields: [{kind,x,y}], hiddenCards: { unitId: n } }
  // Effects are applied by the engine (applyTrueFormEffects):
  //   damage {target,potency,channel}   stun {target,points}   root {target,turns}
  //   revealCard {target}               trash {tiles,hazard,rounds}   mushroom {at,heal,rounds}
  function trueFormTechnique(snap, me) {
    const form=activeForm(me), T=form?.technique, state=me.summon?.technique;
    const idle=(summon=me)=>({fired:false,summon,effects:[],event:null});
    if(!T || !state || !me.summon.trueForm || me.defeated || (me.lf ?? 1)<=0) return idle();
    if(state.cooldown>0) return idle({...me,summon:{...me.summon,technique:{...state,cooldown:state.cooldown-1}}});
    const live=(u)=>u && !u.defeated && (u.lf ?? 1)>0 && !u.notArrived;
    const hostiles=snap.units.filter(u=>live(u) && u.side!==me.side && !u.wild && u.category!=="bystander"), inRange=hostiles.filter(u=>man(u,me)<=T.range);   // bystanders are never technique targets (Mala: summons tacked the Tourist)
    const allies=snap.units.filter(u=>live(u) && u.side===me.side);
    const preferred=()=>{ const pick=pickTarget({...snap,units:snap.units.filter(u=>!u.wild)},me).target; return inRange.find(u=>u.id===pick) || [...inRange].sort((a,b)=>man(a,me)-man(b,me) || (a.id<b.id?-1:1))[0] || null; };
    const free=(x,y)=>x>=0 && y>=0 && x<(snap.width ?? 99) && y<(snap.height ?? 99) && (!snap.isFree || snap.isFree(x,y));
    const mul=(me.summon.potencyMul || 1)*(me.summon.trueFormPotencyMul || 1)*(me.summon.maxFormPotencyMul || 1), k=(n)=>Math.round(n*mul);
    let effects=[], text="", tiles=null;
    if(T.kind==="trash") {
      const t=preferred(); if(!t) return idle();
      tiles=[[t.x,t.y],...DIRS.map(([dx,dy])=>[t.x+dx,t.y+dy]).filter(([x,y])=>T.spread>0 && free(x,y))];
      effects=[{kind:"damage",target:t.id,potency:k(T.potency),channel:T.channel},{kind:"trash",tiles,hazard:T.hazard,rounds:T.rounds}];
      text=`${me.name} hurls trash at ${t.name || t.id}; ${tiles.length} tile${tiles.length===1?"":"s"} become Trash for ${T.rounds} rounds.`;
    } else if(T.kind==="imaginaryStrike") {
      const t=preferred(); if(!t) return idle();
      const friends=Math.min(T.maxFriends,allies.filter(u=>u.dream?.imaginaryFriend).length);
      effects=[{kind:"damage",target:t.id,potency:k(T.potency+T.perFriend*friends),channel:T.channel}]; tiles=[[t.x,t.y]];
      text=`${me.name} tags ${t.name || t.id}${friends?`, and ${friends} imaginary friend${friends===1?" joins":"s join"} in`:""}.`;
    } else if(T.kind==="decree") {
      const t=[...inRange].sort((a,b)=>b.lf-a.lf || man(a,me)-man(b,me) || (a.id<b.id?-1:1))[0]; if(!t) return idle();
      effects=[{kind:"root",target:t.id,turns:T.rootTurns},{kind:"stun",target:t.id,points:T.stunPoints}]; tiles=[[t.x,t.y]];
      text=`${me.name} orders ${t.name || t.id} to kneel.`;
    } else if(T.kind==="deed") {
      // Goethe (Muse Berry BD, 2026-10-29): one committed act — damage plus a root where they stand.
      const t=preferred(); if(!t) return idle();
      effects=[{kind:"damage",target:t.id,potency:k(T.potency),channel:T.channel},{kind:"root",target:t.id,turns:T.rootTurns}]; tiles=[[t.x,t.y]];
      text=`${me.name} acts, and ${t.name || t.id} is held by the consequence.`;
    } else if(T.kind==="battery") {
      // Aim at the enemy tile that catches the most hostiles; ties go to the nearer, then the lower id.
      const aim=[...inRange].map(c=>({c,n:hostiles.filter(u=>man(u,c)<=T.radius).length}))
        .sort((a,b)=>b.n-a.n || man(a.c,me)-man(b.c,me) || (a.c.id<b.c.id?-1:1))[0]; if(!aim) return idle();
      const caught=hostiles.filter(u=>man(u,aim.c)<=T.radius);
      effects=caught.map(u=>({kind:"damage",target:u.id,potency:k(T.potency),channel:T.channel}));
      tiles=[]; for(let y=aim.c.y-T.radius;y<=aim.c.y+T.radius;y++) for(let x=aim.c.x-T.radius;x<=aim.c.x+T.radius;x++) if(Math.abs(x-aim.c.x)+Math.abs(y-aim.c.y)<=T.radius && x>=0 && y>=0 && x<(snap.width ?? 99) && y<(snap.height ?? 99)) tiles.push([x,y]);
      text=`${me.name}'s ${T.name} fires on ${aim.c.name || aim.c.id}: ${caught.length} enem${caught.length===1?"y":"ies"} caught.`;
    } else if(T.kind==="isolate") {
      // Genghis Khan: the enemy with the fewest of its own side near it; ties go to the nearer, then the lower id.
      const near=(u)=>hostiles.filter(o=>o.id!==u.id && o.side===u.side && man(o,u)<=T.radius).length;
      const t=[...inRange].sort((a,b)=>near(a)-near(b) || man(a,me)-man(b,me) || (a.id<b.id?-1:1))[0]; if(!t) return idle();
      const alone=near(t)===0;
      effects=[{kind:"damage",target:t.id,potency:k(T.potency+(alone?T.aloneBonus:0)),channel:T.channel}]; tiles=[[t.x,t.y]];
      text=`${me.name} rides down ${t.name || t.id}${alone?", who stands alone":""}.`;
    } else if(T.kind==="streak") {
      // Kobe: the same shot on the same opponent. The count is kept on the technique state.
      const held=inRange.find(u=>u.id===state.streakTarget), t=held || preferred(); if(!t) return idle();
      const streak=held ? Math.min(T.maxStreak,(state.streak || 0)+1) : 0;
      effects=[{kind:"damage",target:t.id,potency:k(T.potency+T.perStreak*streak),channel:T.channel}]; tiles=[[t.x,t.y]];
      text=`${me.name} shoots over ${t.name || t.id}${streak?` again (${streak+1} in a row)`:""}.`;
      return {fired:true,effects,
        summon:{...me,summon:{...me.summon,technique:{...state,cooldown:T.cooldown-1,uses:state.uses+1,streakTarget:t.id,streak}}},
        event:{kind:"trueFormTechnique",actor:me.id,technique:T.id,tiles,text:`${T.name}: ${text}`,why:[T.text]}};
    } else if(T.kind==="dread") {
      // The least steady enemy in range: lowest ego, then the nearer, then the lower id.
      const t=[...inRange].sort((a,b)=>(a.ego ?? 0.5)-(b.ego ?? 0.5) || man(a,me)-man(b,me) || (a.id<b.id?-1:1))[0]; if(!t) return idle();
      effects=[{kind:"dread",target:t.id,points:T.stunPoints,egoLoss:T.egoLoss}]; tiles=[[t.x,t.y]];
      text=`${me.name} turns every eye on ${t.name || t.id}.`;
    } else if(T.kind==="syllogism") {
      // Prefer a target that still has something hidden; otherwise the refutation alone.
      const hidden=(u)=>snap.hiddenCards?.[u.id] || 0;
      const t=[...inRange].sort((a,b)=>(hidden(b)>0)-(hidden(a)>0) || (snap.effectsBy?.[b.id] || 0)-(snap.effectsBy?.[a.id] || 0) || man(a,me)-man(b,me) || (a.id<b.id?-1:1))[0]; if(!t) return idle();
      effects=[{kind:"revealCard",target:t.id},{kind:"stun",target:t.id,points:T.stunPoints}]; tiles=[[t.x,t.y]];
      text=`${me.name} reasons from first principles about ${t.name || t.id}.`;
    } else if(T.kind==="sporefall") {
      const planted=(snap.fields || []).filter(f=>f.kind==="mushroom");
      if(planted.length>=T.maxOnField) return idle();
      const open=(u)=>DIRS.map(([dx,dy])=>[u.x+dx,u.y+dy]).filter(([x,y])=>free(x,y) && !planted.some(f=>f.x===x && f.y===y))
        .sort((a,b)=>a[1]-b[1] || a[0]-b[0])[0];
      // Most-hurt ally in range first (by missing share of LF); Zherm himself is always a candidate.
      const order=allies.filter(u=>man(u,me)<=T.range).sort((a,b)=>a.lf/a.maxLF-b.lf/b.maxLF || man(a,me)-man(b,me) || (a.id<b.id?-1:1));
      let at=null, beside=null; for(const u of order){ at=open(u); if(at){ beside=u; break; } }
      if(!at) return idle();
      effects=[{kind:"mushroom",at,heal:T.heal,rounds:T.rounds}]; tiles=[at];
      text=`${me.name} drops a mushroom at (${at.join(",")}) beside ${beside.id===me.id?"himself":(beside.name || beside.id)}.`;
    } else return idle();
    return {fired:true,effects,
      summon:{...me,summon:{...me.summon,technique:{...state,cooldown:T.cooldown-1,uses:state.uses+1}}},
      event:{kind:"trueFormTechnique",actor:me.id,technique:T.id,tiles,text:`${T.name}: ${text}`,why:[T.text]}};
  }

  // Imaginary Friend: who currently holds the trait, if anyone (first by id for determinism).
  function imaginaryFriendHost(units) {
    return units.filter(u=>u.summon?.trueForm && !u.defeated && (u.lf ?? 1)>0 && SD.summons[u.summon.key]?.trueForm?.imaginaryFriend)
      .sort((a,b)=>a.id<b.id?-1:1)[0] || null;
  }

  function afterOwnTurn(actor) {
    const turnsLeft = actor.summon.turnsLeft - 1;
    return { actor: { ...actor, summon: { ...actor.summon, turnsLeft } }, expired: turnsLeft <= 0 };
  }

  // snapshot = { seed, round, units: [{ id, side, x, y, lf, maxLF, defeated, summon? }],
  //              lastAttackerOf: { unitId: attackerId }, playerTarget, focus, effectsBy: { unitId: n } }
  function pickTarget(snap, me) {
    const live = (u) => u && !u.defeated && (u.lf ?? 1) > 0;
    const anyHostile = snap.units.filter((u) => live(u) && u.side !== me.side && u.category !== "bystander");   // bystanders are never attitude targets (Mala: summons tacked the Tourist)
    if (!anyHostile.length) return { target: null, why: "no one to fight", stand: null };
    const allies = snap.units.filter((u) => live(u) && u.side === me.side && u.id !== me.id);
    const owner = snap.units.find((u) => u.id === me.summon.owner);
    // Enemies come first; a monster is only targeted when it threatens the summon or its owner up close.
    const threat = anyHostile.filter((u) => u.side === "wild" && [me, owner].some((v) => v && man(u, v) <= 1))
      .sort((a, b) => man(a, me) - man(b, me) || (a.id < b.id ? -1 : 1))[0];
    if (threat) return { target: threat.id, why: "self-defence against a monster", stand: null };
    const enemies = anyHostile.filter((u) => u.side === "enemy");
    const hostile = enemies.length ? enemies : anyHostile;
    const nearest = (from, list = hostile) => [...list].sort((a, b) => man(a, from) - man(b, from) || (a.id < b.id ? -1 : 1))[0];
    const byId = (id) => hostile.find((u) => u.id === id);
    const att = SD.attitudes[me.attitude];
    let target = null, why = att.target, stand = null;
    switch (att.target) {
      case "strongestThreat": target = [...hostile].sort((a, b) => b.lf - a.lf || man(a, me) - man(b, me))[0]; break;
      case "attackerOfWeakestAlly": {
        const weak = [...allies].sort((a, b) => a.lf / a.maxLF - b.lf / b.maxLF || (a.id < b.id ? -1 : 1))[0];
        if (weak) { target = byId(snap.lastAttackerOf?.[weak.id]) || nearest(weak); stand = [weak.x, weak.y]; why = `protecting ${weak.id}`; }
        break;
      }
      case "seededRandom": target = hostile[Math.floor(roll(snap.seed, `${snap.round}:${me.id}`) * hostile.length)]; break;
      case "lastAttacker": target = byId(snap.lastAttackerOf?.[me.summon.owner]); if (owner) stand = [owner.x, owner.y]; break;
      case "focusFire": target = byId(snap.playerTarget); break;
      case "sameTargetUntilDown": target = byId(snap.focus); break;
      case "loadBearing": target = [...hostile].sort((a, b) => (snap.effectsBy?.[b.id] || 0) - (snap.effectsBy?.[a.id] || 0) || man(a, me) - man(b, me))[0];
        if (!(snap.effectsBy?.[target.id] > 0)) target = null; break;
      case "isolated": target = [...hostile].sort((a, b) => iso(b) - iso(a) || man(a, me) - man(b, me))[0]; break;
      case "clustered": target = [...hostile].sort((a, b) => crowd(b) - crowd(a) || man(a, me) - man(b, me))[0]; break;
      case "unaware": { const attackers = new Set(Object.values(snap.lastAttackerOf || {})); target = [...hostile].filter((u) => !attackers.has(u.id)).sort((a, b) => man(a, me) - man(b, me))[0]; break; }
    }
    function iso(u) { const others = hostile.filter((v) => v !== u); return others.length ? Math.min(...others.map((v) => man(u, v))) : 99; }
    function crowd(u) { return hostile.filter((v) => v !== u && man(u, v) <= 2).length; }
    if (!target) { target = nearest(me); why = `${att.target} found no fit; nearest instead`; }
    return { target: target.id, why, stand };
  }

  // ── ordering the summon's ultimate (player's full charge → summon fires next turn) ─────────
  //   canOrderUltimate(player, summon, rules)      rules = engine rules (ultimateChargeMax)
  //   orderUltimate(player, summon, snapshot)      → { player, summon, order, event }
  //   resolveUltimate(snapshot, summon)            → { effects, tiles, event }   (engine applies effects)
  function canOrderUltimate(player, summon, rules = { ultimateChargeMax: 100 }) {
    const O = R.order;
    if (!summon || !summon.summon || summon.defeated) return { ok: false, reason: "No summon on the field." };
    if (summon.summon.ultimateUsed && O.oncePerAppearance) return { ok: false, reason: `${summon.name} has already used its ultimate.` };
    if (summon.summon.order) return { ok: false, reason: `${summon.name} already has its orders.` };
    if ((player.ultimateCharge ?? 0) < rules.ultimateChargeMax) return { ok: false, reason: "Your ultimate charge must be full to give that order." };
    if ((player.tempo ?? 100) < O.actionCost) return { ok: false, reason: `Giving the order needs ${O.actionCost} action points.` };
    return { ok: true };
  }

  function areaAround([cx, cy], radius, snap) {
    if (radius === "all") return null;                                  // whole board
    const tiles = [];
    const w = snap.width ?? 99, h = snap.height ?? 99;
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++)
      if (x >= 0 && y >= 0 && x < w && y < h && Math.abs(x - cx) + Math.abs(y - cy) <= radius) tiles.push([x, y]);
    return tiles;
  }
  function centreFor(play, snap, summon) {
    if (play.centre === "playerTarget") {
      if (Array.isArray(snap.playerTarget)) return snap.playerTarget.slice();
      const t = snap.units.find((u) => u.id === snap.playerTarget && !u.defeated);
      if (t) return [t.x, t.y];
    }
    return [summon.x, summon.y];
  }

  function orderUltimate(player, summon, snap, rules = {}) {
    rules = { ultimateChargeMax: 100, ...rules };
    const can = canOrderUltimate(player, summon, rules);
    if (!can.ok) return { ...can, player, summon };
    const play = activeUltimate(summon).play;
    const centre = play.type === "nova" ? centreFor(play, snap, summon) : null;
    const announced = play.type === "nova";
    const order = { type: play.type, centre, tiles: announced ? areaAround(centre, play.radius, snap) : null, announced,
      potencyMul: announced ? (rules.announceMultiplier ?? R.order.announceMultiplier) : 1,
      targetId: typeof snap.playerTarget === "string" ? snap.playerTarget : null, orderedRound: snap.round };
    return {
      ok: true,
      player: { ...player, ultimateCharge: 0, tempo: (player.tempo ?? 100) - R.order.actionCost },
      summon: { ...summon, summon: { ...summon.summon, order, holdPosition: R.order.holdPosition && play.type === "nova" } },
      order,
      event: { kind: "summonOrder", actor: summon.id, by: player.id, type: play.type, tiles: order.tiles,
        text: `${player.name || player.id} spends a full ultimate: ${summon.name} will use ${activeUltimate(summon).name} next turn.${order.announced ? " The area is announced." : ""}` },
    };
  }

  function resolveUltimate(snap, summon) {
    const def = SD.summons[summon.summon.key], ult = activeUltimate(summon), play = ult.play, order = summon.summon.order;
    if (!order) return { effects: [], tiles: null, event: null };
    const live = (u) => u && !u.defeated && (u.lf ?? 1) > 0;
    const allies = snap.units.filter((u) => live(u) && u.side === summon.side);
    const hostiles = snap.units.filter((u) => live(u) && u.side !== summon.side);
    const centre = order.centre || [summon.x, summon.y];
    const tiles = order.tiles || areaAround(centre, play.radius, snap);
    const inArea = (u) => !tiles || tiles.some(([x, y]) => u.x === x && u.y === y);
    const effects = [], mul = (summon.summon.potencyMul || 1) * (summon.summon.trueFormPotencyMul || 1) * (summon.summon.maxFormPotencyMul || 1) * (order.announced ? (order.potencyMul || R.order.announceMultiplier) : 1), k = (n) => Math.round(n * mul);
    if (play.type === "heal") for (const u of allies.filter(inArea)) effects.push({ kind: "heal", target: u.id, amount: Math.min(k(play.heal), (u.maxLF ?? u.lf) - u.lf) }), play.status && effects.push({ kind: "status", target: u.id, status: play.status });
    if (play.type === "buff") {
      const who = play.affects === "everyone" ? snap.units.filter(live) : play.radius === 0 ? [summon] : allies.filter(inArea);
      for (const u of who) effects.push({ kind: "status", target: u.id, status: play.status, targetId: order.targetId || null });
      if (play.selfStatus) effects.push({ kind: "status", target: summon.id, status: play.selfStatus, targetId: order.targetId || null });
    }
    if (play.type === "nova") {
      for (const u of hostiles.filter(inArea)) {
        if (play.effect === "dispel") effects.push({ kind: "dispel", target: u.id });
        else if (play.effect === "stun") effects.push({ kind: "stun", target: u.id, points: k(play.stunPoints), resistedByGuard: !!play.guardResists });
        else effects.push({ kind: "damage", target: u.id, potency: k(play.potency), channel: play.channel, announced: true });
      }
      if (play.effect === "dispel") effects.push({ kind: "dispelTiles", tiles, ownerSide: "enemy" });
      if (play.allyHeal) for (const u of allies.filter(inArea)) effects.push({ kind: "heal", target: u.id, amount: Math.min(k(play.allyHeal), (u.maxLF ?? u.lf) - u.lf) });
    }
    return { effects, tiles, event: { kind: "summonUltimate", actor: summon.id, type: play.type, tiles, text: `${def.name}: ${ult.name}. ${play.text}` } };
  }

  // The order is lost if the summon leaves before firing (expired or defeated).
  function orderLost(summon) { return !!(summon.summon?.order && (summon.defeated || summon.summon.turnsLeft <= 0)); }

  // A summon is a fresh body, not a copy of its summoner (Mala, 2026-10-27: a Napoleon called during the Warden Symbiote
  // came out wearing it, and turned into the Warden when it ended; "summons should have their own traits for balance
  // reasons"). The engine builds a summon from the owner's record (liveSummon), so the owner's running state is listed here
  // and never carries over: `drop` fields are removed (a fresh unit does not have them), `fresh()` gives the values a new
  // unit starts with. The engine resets form, traits, status, passives, rites, beads and the rest itself.
  const ownerState = {
    drop: ["learnedForms", "contractActive", "formsEntered", "formVowSpent", "heartScroll", "aura", "vows", "committed", "embodied", "possessedByCourt", "priorSprite", "priorSide", "priorName", "soulOf", "routed",
      "bond", "beloved", "concedeStall", "communed", "lastHit", "pain", "conditions",
      "forceTarget", "forceTargetUntil", "role", "roleBase", "typecast", "orbs", "hunting"],   // taunts, the Actor's role clock, boss orbs, a hunt (1.3.467 audit)
    fresh: () => ({ focus: null, teleology: { heading: null, phiDebt: 0, servings: {} }, inspiredBy: {}, summonGroup: null, perkApAdd: 0,
      boss: null, massive: false, size: null, titles: [] }),
  };

  // Applied by the engine's liveSummon after it builds the summon from the owner's record.
  function freshen(summon) {
    summon.form = null; summon.formCooldownUntil = 0; summon.traits = [];   // the form and the traits are the summoner's (Mala, 2026-10-27)
    for (const k of ownerState.drop) delete summon[k];
    return Object.assign(summon, ownerState.fresh());
  }

  // Palace callers (Mala, 2026-11-05, decision b; was the Warden alone, 2026-10-22): any true player-side character calls,
  // and the menu, the readiness check, the action and the AI all ask this one question. Called things
  // cannot call back: palace summons, bound dreams, monsters, bead beasts and tamed dreams are excluded,
  // as the enemy path excludes its own called actors (enemy-summons.js qualifies).
  const callsPalace = (actor) => actor?.side === "player" && !actor?.summon && !actor?.summonBinding && !actor?.monster && !actor?.beast && !actor?.tamed;
  return { callsPalace, ownerState, freshen, revealTrueForm, revealMaxForm, activeForm, activeUltimate, trueFormTechnique, imaginaryFriendHost, deathDoor, deathDoorChance, deathDoorNeed, available, canSummon, placeSummon, placementTiles, makeSummonActor, afterOwnTurn, pickTarget,
    canOrderUltimate, orderUltimate, resolveUltimate, orderLost, data: SD };
});
