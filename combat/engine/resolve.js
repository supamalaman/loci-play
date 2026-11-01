"use strict";
// Resolving a technique's effect once it is committed.
// A part of the Concept Combat engine, split out of engine.js on 2026-10-11 (tools/split-engine.mjs). It is not a
// module in its own right: engine.js installs it with the host object H (everything the engine closure has in
// scope) and it hands back the functions it defines. Function bodies are exactly as they were in engine.js.
(function (root, install) {
  if (typeof module === "object" && module.exports) module.exports = install;
  else (root.ConceptCombatEngineParts = root.ConceptCombatEngineParts || {}).resolve = install;
})(typeof self !== "undefined" ? self : this, function install(H) {
  return (function () {
    const { EmergentIdeas, C, CRAFT, ClassRuntime, DIRS, MaidSystems, Performers, Postures, ab, actorAt, addStun, applyEntryEffects, applyFall, areaRecipients,
      areaTiles, barrierAt, bossRules, classH, clone, conceptName, createSuccessionPatch, dist, disturbSuccession, dreamCanReach, edgeUsed, findOpp,
      footprint, hasTrait, heightAt, hit, inside, insightRules, keepDreamPositions, key, line, lineStop, log, manifest, negateAtBarrier, opponentsOn, patchAt,
      paths, pickupRules, presidentContext, presidentEffects, presidentRules, presidentUnits, recordEarthMoved, refreshDrowning, resolvePrune,
      schedule, setPatchStage, settleDeferredCharge, settleHomeward, strikeTarget, structures, surfaceAt, syncPresidentUnit, target, tileAt, unitAt, vegetation, visageGaze, waterAt,
      wildRules } = H;
    const seededChance = (...args) => H.seededChance(...args);   // late binding: queries installs after resolve

    // Bastion Collapse (Mala and Muse, 2026-10-15): count the boundaries within the area's reach of the caster, at most
    // fold.cap: each barrier and each ward (consumed), each solid wall tile or blocking object (counted, left standing),
    // and inside a Dream Space the edge tiles in reach (they lend themselves; the dream then grows one step, up to the
    // arena's extent). Potency = base + per x counted. The dream is a diamond (center and radius), so walls do not yet
    // stop its growth; that needs the dream stored as tiles.
    function bastionFold(s, a, inst, why) {
      const F = ab(inst.ability).fold, R = inst.area?.radius ?? 3, near = (x, y) => dist(s, a.x, a.y, x, y) <= R;
      const barriers = (s.barriers || []).filter((b) => near(b.x, b.y));
      const warded = Object.values(s.actors).filter((u) => !u.defeated && u.status?.ward && near(u.x, u.y));
      let walls = 0;
      for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) if (near(x, y) && !(x === a.x && y === a.y)
        && ((tileAt(s, x, y).blocksMove && (tileAt(s, x, y).tags || []).includes("hard")) || (s.arena.objects || []).some((o) => o.x === x && o.y === y && o.blocksMove && o.kind !== "plant" && !(o.hp <= 0)))) walls++;   // walls, not trees or water
      const region = s.dreamSpace?.region;
      let edges = 0;
      if (region) for (let y = 0; y < s.arena.h; y++) for (let x = 0; x < s.arena.w; x++) if (near(x, y) && Math.abs(x - region.x) + Math.abs(y - region.y) === region.radius) edges++;
      const counted = Math.min(F.cap, barriers.length + warded.length + walls + edges);
      s.barriers = (s.barriers || []).filter((b) => !barriers.includes(b));
      for (const u of warded) u.status.ward = null;
      if (region && edges) { const most = s.arena.w + s.arena.h; if (region.radius < most) { region.radius += 1;
        log(s, { kind: "dreamSpace", actor: a.id, text: "The dream eats its walls and grows a step.", why: ["Bastion Collapse folded the dream's edge inward; the edge re-forms one step out."] }); } }
      why.push(`Folds ${counted} boundar${counted === 1 ? "y" : "ies"} (${barriers.length} barrier${barriers.length === 1 ? "" : "s"}, ${warded.length} ward${warded.length === 1 ? "" : "s"}, ${walls} wall tile${walls === 1 ? "" : "s"}${region ? `, ${edges} dream edge` : ""}; at most ${F.cap}): ${F.base} + ${F.per} x ${counted}.`);
      return { ...inst, potency: F.base + F.per * counted };
    }
    function resolveAbility(s, a, inst) {
      if(H.Contracts&&!H.Contracts.allowed(s,a,inst)){log(s,{kind:"contract",actor:a.id,text:"The copied effect cannot bypass its written contract."});inst.refused=true;return;}
      if (!s.preview) H.fruitSoak?.(s, inst);   // Sinkerfruit: a technique that moves water soaks the eaters it reaches
      if (a.riteAugment?.checked?.[inst.ability] && a.riteAugment.charges > 0 && !s.preview) {   // Rites (Muse-2): the augment spends on commit, hit or miss
        const mend = a.riteAugment.plantMend || 0;
        if (mend > 0 && !a.defeated) {
          const before = a.lf;
          a.lf = Math.min(a.maxLF, a.lf + mend);
          a.riteAugment.plantMend = 0;
          log(s, { kind: "ritual", actor: a.id, text: `${a.name} draws on the communed plant: +${a.lf - before} LF.` });
        }
        if (a.riteAugment.bleedRider > 0) inst.riteBleed = a.riteAugment.bleedRider;   // the committed rider rides this cast: the last charge clears the pool before the hit lands
        a.riteAugment.charges -= 1;
        log(s, { kind: "ritual", actor: a.id, text: a.riteAugment.charges > 0 ? `${inst.name} spends a rite charge (${a.riteAugment.charges} left).` : `${inst.name} spends the last rite charge: the ink fades.` });
        if (a.riteAugment.charges <= 0) a.riteAugment = null;
      }
      if(inst.aim && !dreamCanReach(s,a,inst,...inst.aim)) { log(s,{kind:"dreamSpace",actor:a.id,text:`${inst.name} is stopped by the sealed dream.`}); inst.refused = true; return; }
      inst = { ...inst, tiles: inst.tiles.filter(([x,y])=>dreamCanReach(s,a,inst,x,y)), targets: (inst.targets || []).filter(id=>!s.actors[id] || dreamCanReach(s,a,inst,s.actors[id].x,s.actors[id].y)) };
      const beforeDream = s.dreamSpace?.region ? clone(s) : null;
      try { return resolveDreamAbility(s,a,inst); } finally { if(beforeDream) keepDreamPositions(s,beforeDream); Performers?.afterTechnique(s,a,inst,classH()); H.Tally?.afterResolve(s,a,inst); if(!s.preview) H.Longtermism?.afterTechnique(s,a,inst); }
    }
    function resolveScribedEffects(s,a,inst){
      let recipients=(inst.targets||[]).map(id=>s.actors[id]||(s.wild||[]).find(w=>w.id===id)).filter(t=>t&&!t.defeated&&(t.side!==a.side||inst.target==="ally")&&(inst.delivery==="line"||!H.Instinct.hidden(a,t)));   // a committed single-target hit passes over a lying foe
      if(inst.delivery==="field")recipients=areaRecipients(s,a,inst,inst.tiles,true).targets.filter(t=>t.side!==a.side);
      if(inst.delivery==="line"){
        const pts=line(a.x,a.y,...inst.aim),stop=lineStop(s,a,pts),reach=stop>=0?pts.slice(1,stop):pts.slice(1);
        recipients=recipients.filter(t=>reach.some(([x,y])=>x===t.x&&y===t.y));
      }
      const storedPotency=inst.scribedEffects.filter(e=>e.key==="damage").reduce((n,e)=>n+e.params.potency,0);
      const damageScale=storedPotency>0?inst.potency/storedPotency:1;
      const stopped=new Set();
      for(const e of inst.scribedEffects){
        const targets=e.recipient==="self"?[a]:recipients;
        for(const t of targets){
          if(t.defeated||stopped.has(t.id))continue;
          const p=e.params;
          if(!s.actors[t.id]&&!["damage","push"].includes(e.key)){log(s,{kind:"scribedEffectSkipped",actor:a.id,target:t.id,component:e.key,text:`${e.label} needs a combatant body; it does not bind this wild creature.`});continue;}

          if(e.key==="damage"){
            const loss=strikeTarget(s,a,t,{...inst,stunTempo:0},p.potency*damageScale*(inst.mult||1),[]);
            if(!(loss>0))stopped.add(t.id);continue;
          }
          if(e.recipient!=="self"&&e.recipient!=="ally"&&H.targetInteractions(s,a,t,inst,0).stop){stopped.add(t.id);continue;}   // placed support is not an attack: membrane/parry answer attacks, not gifts
          if(e.key==="push")knock(s,a,t,p.tiles,inst,"push");
          if(e.key==="stagger")addStun(s,a,t,p.ap);
          if(e.key==="reveal")delete t.status.concealed;
          if(e.key==="root")t.status.rooted={scribed:true,label:inst.name,owner:t.id,expiresAt:t.ownerTurns+p.duration+1};
          if(e.key==="itemLock")t.status.scribedItemLock={label:inst.name,owner:t.id,expiresAt:t.ownerTurns+p.duration+1};
          if(e.key==="ward")t.status.ward={label:inst.name,owner:t.id,expiresAt:t.ownerTurns+p.duration,protection:p.protection};
          if(e.key==="adaptResistance")t.status.guard={label:inst.name,owner:t.id,expiresAt:t.ownerTurns+p.duration,damageType:inst.observedChannel,multiplier:p.multiplier};
          if(inst.contractPermit&&inst.scribedEffects.every(x=>x.recipient==="self"))for(const k of ["ward","guard"])if(t.status[k]?.label===inst.name){t.status[k].contractId=inst.ability;t.status[k].expiresAt=t.ownerTurns+(ab(inst.ability).contractDuration||p.duration||1);}
          log(s,{kind:"scribedEffect",actor:a.id,target:t.id,component:e.key,text:`${inst.name}: ${e.label} → ${t.name}${p.duration?` (${p.duration} owner turns)`:""}.`});
        }
      }
    }
    function resolveDreamAbility(s, a, inst) {
      if(inst.scribedEffects){resolveScribedEffects(s,a,inst);return;}
      const why = [];
      if (inst.mult !== 1) why.push(`Combined committed potency multiplier ×${+inst.mult.toFixed(3)}.`);
      // Emissary visage: matched by ability id because the boss adapter (engine.js) forces
      // every boss effect to damage/guard. If the adapter ever preserves custom effects,
      // prefer inst.effect === "visage".
      if (inst.ability === "boss_emissary_unbearableVisage") { visageGaze(s, a, inst.tiles); return; }
      { const t = H.Tally?.resolve(s, a, inst, why); if (t === true) return; if (t) inst = t; }   // the ledger boss, matched by id (engine/tally.js)   // terrifying is biology now (visage trait, turns.js)
      if (inst.ability === "bastionCollapse" && ab(inst.ability)?.fold) inst = bastionFold(s, a, inst, why);   // Bastion Collapse: the boundaries in reach set its weight
      if (inst.effect === "imaginedRehearsal") {
        a.status.imaginedRehearsal = { label: "Pictured arrival", owner: a.id, hints: C.rules.imagination.rehearsalHints, expiresAt: a.ownerTurns + 1 };
        log(s, { kind: "imagination", actor: a.id, text: `${a.name} rehearses one arrival: the next summon question loses one wrong choice before their next turn. A new rehearsal replaces the old one.` });
        return;
      }
      if (["imaginedShelter", "imaginedCompany"].includes(inst.effect)) {
        const company = inst.effect === "imaginedCompany", R = C.rules.imagination;
        const recipients = Object.values(s.actors).filter(u => !u.defeated && u.lf > 0 && u.side === a.side &&
          (u.id === a.id || (EmergentIdeas?.summonerOf(u) === a.id && inst.tiles.some(([x,y]) => u.x === x && u.y === y))));
        for (const u of recipients) {
          const protection = Math.round(inst.potency);
          if ((u.status.ward?.protection || 0) <= protection) u.status.ward = { label: "Imagined shelter", owner: u.id, protection, expiresAt: u.ownerTurns + 1 };
          const stay = u.summon || u.summonBinding;
          const extend = company && stay && !stay.imaginedExtension;
          if (extend) { stay.turnsLeft += R.summonTurnAdd; stay.imaginedExtension = true; }
          log(s, { kind: "imagination", actor: a.id, target: u.id, text: `${u.name} holds ${u.status.ward.protection} ward${extend ? ` and gains ${R.summonTurnAdd} remaining turn once for this incarnation` : ""}. Wards are replaced, never added.` });
        }
        return;
      }
      if (inst.effect === "architectDesign") {
        const [lx, ly] = inst.tiles[0], own = s.barriers.find(b => b.x === lx && b.y === ly && b.owner === a.id && b.architectDesign);
        if (own) {   // lower: erase one segment of your own screen (remove's old price: 10 AP, 0 ΦF)
          s.barriers = s.barriers.filter(b => b !== own);
          a.tempo = Math.min(a.tempoCapacity ?? 999, a.tempo + Math.max(0, (inst.tempoCost ?? 35) - 10)); a.pf = Math.min(a.maxPF ?? 99, a.pf + (inst.cost ?? 5));
          log(s, { kind: "design", actor: a.id, tiles: [[lx,ly]], from: [a.x,a.y], text: `${a.name} erases a design segment at (${lx},${ly}); the passage opens immediately.`, why: ["Lowering edits the permanent screen directly; the rest of the line stands.", "Lowering is quick work: most of the Wall's price is refunded."] });
          return;
        }
        const tiles = [];
        for (const [x,y] of inst.tiles) {
          const wall = { id: "b" + (++s.seq), owner: a.id, x, y, concept: "boundary", protection: 1000, permanent: true,
            architectDesign: true, passable: false, blocksMove: true, blocksRoute: true, blocksSight: true, linePassable: false, coverFraction: 1 };
          s.barriers.push(wall); tiles.push([x,y]);
        }
        log(s, { kind: "design", actor: a.id, tiles, from: [a.x,a.y], text: `${a.name} drafts and builds a permanent defensive screen across ${tiles.length} tile${tiles.length === 1 ? "" : "s"}.`, why: ["The screen blocks movement, routed paths and sight for the rest of this battle.", "Aim the Wall at your own screen to lower a segment instantly; open ends remain bypassable."] });
        return;
      }
      if (inst.effect === "gradeCut") {
        const [x, y] = inst.tiles[0];
        if (ClassRuntime?.gradeResisted && ClassRuntime.gradeResisted(s, a, x, y, classH())) return;   // As-Built: the tile keeps its shape
        s.arena.height[y][x] -= 1; a.earthStock = Math.min(12, (a.earthStock || 0) + 1);
        disturbSuccession(s, [[x, y]], "Cut-and-fill"); recordEarthMoved(s, a, 1, [[x, y]]);
        log(s, { kind: "earthwork", actor: a.id, tiles: [[x, y]], text: `${a.name} cuts one soil level at (${x},${y}); the permanent grade is now ${s.arena.height[y][x]}.`, why: ["One abstract soil unit was removed from the terrain and added to the actor's earth stock; terrain + stock remain conserved.", `Earth stock: ${a.earthStock}/12. The new elevation immediately changes movement, falls and line range.`] });
        return;
      }
      if(inst.effect?.startsWith("archivist")) {
        const viewer=a.side==="player" ? "player" : a.id;
        const knowledge=s.insight.knowledge[viewer] ||= {};
        const index=target=>{
          const deck=s.insight.decks[target.id];if(!deck || !insightRules)return;
          const know=knowledge[target.id] ||= insightRules.spawnKnowledge(deck);
          const card=deck.cards.find(c=>!know.revealed.includes(c.id));
          if(card){know.revealed.push(card.id);s.insight.cognitive=insightRules.recordNotice(s.insight.cognitive,target.id,card);}
          log(s,{kind:"insight",actor:a.id,target:target.id,text:card ? `${a.name} indexes ${target.name}: ${card.text}` : `${target.name}'s archive is already complete.`});
        };
        const present=Object.values(s.actors).filter(u=>!u.defeated && inst.tiles.some(([x,y])=>H.coversTile(u,x,y)));   // a big unit is present on any of its tiles
        const ally=inst.targets?.map(id=>s.actors[id]).find(u=>u && !u.defeated && u.side===a.side);
        const crafts=(x)=>x&&(x.primary==="craftsmanship"||x.secondary==="craftsmanship"),wellMade=(u)=>CRAFT&&(crafts(a)||crafts(u))?CRAFT.wellMadeTurns:0;
        const protect=(u,amount)=>{u.status.ward={label:"Preservation",owner:u.id,protection:Math.max(u.status.ward?.protection || 0,Math.round(amount*inst.mult)),expiresAt:u.ownerTurns+1+wellMade(u)};log(s,{kind:"preservation",actor:a.id,target:u.id,text:`${u.name} gains ${u.status.ward.protection} Preservation ward ${wellMade(u)?"that is well made and holds a turn longer [opp-craft-makes-it-keep]":"until their next turn"}.`});};
        const heal=(u,amount)=>{const old=u.lf;const sv=ClassRuntime?.Teleology?.servingHeal(s,a,u);if(sv)log(s,{kind:"teleology",actor:a.id,target:u.id,text:sv.note});u.lf=Math.min(u.maxLF,u.lf+Math.round(amount*inst.mult*(sv?.mult||1)));log(s,{kind:"heal",actor:a.id,target:u.id,text:`${a.name} restores ${u.lf-old} LF to ${u.name}.`});};
        if(inst.effect==="archivistIndex")for(const u of present.filter(u=>u.side!==a.side))index(u);
        if(inst.effect==="archivistArchive")for(const u of present.filter(u=>u.side!==a.side))index(u);
        if(inst.effect==="archivistArchive"&&ab(inst.ability)?.allyCharge)for(const u of present.filter(u=>u.side===a.side&&u.id!==a.id)){const max=s.rules.ultimateChargeMax||100,old=u.ultimateCharge||0;u.ultimateCharge=Math.min(max,old+ab(inst.ability).allyCharge);if(u.ultimateCharge>old)log(s,{kind:"charge",actor:a.id,target:u.id,text:`${u.name} listens: +${u.ultimateCharge-old} ultimate charge.`});}   // Jambavan's Counsel of the Ages
        if(inst.effect==="archivistReference")for(const u of present.filter(u=>u.side!==a.side)){const known=knowledge[u.id]?.revealed?.length || s.insight.decks[u.id]?.cards.filter(c=>c.open).length || 0;hit(s,a,u,inst,inst.potency*inst.mult*(1+Math.min(5,known)*.1),[`Cross Reference: ${known} known entries, bonus capped at 50%.`]);}
        if(inst.effect==="archivistWard" && ally)protect(ally,inst.potency);
        if(inst.effect==="archivistHeal" && ally)heal(ally,inst.potency);
        if(inst.effect==="archivistShelter"){const helped=present.filter(u=>u.side===a.side);if(!helped.includes(a))helped.push(a);for(const u of helped){heal(u,16);protect(u,12);}}   // radius tiles exclude d=0 (targeting.js), so the caster is never "present": shelter her explicitly. "All living allies within 3" includes her, and the AI already values it that way.
        return;
      }
      if (inst.effect === "anotherWayHome") {
        const [x, y] = inst.aim;
        a.pathwayPromise = { x, y, expiresRound: s.round + 2, potency: inst.potency * inst.mult, damageType: inst.damageType };
        log(s, { kind: "promise", actor: a.id, tiles: [[x, y]], text: `${a.name} declares Another Way Home: the destination is (${x},${y}); the route may change.`, why: ["Moves toward home get +2 movement points once. Arriving strikes opponents within 2 tiles of the destination.", "An opponent can break the commitment by closing every route or holding the destination through the deadline."] });
        settleHomeward(s, a);
        return;
      }
      if (inst.effect === "gradeFill") {
        const [x, y] = inst.tiles[0];
        if (ClassRuntime?.gradeResisted && ClassRuntime.gradeResisted(s, a, x, y, classH())) return;   // As-Built: the tile keeps its shape
        s.arena.height[y][x] += 1; a.earthStock -= 1;
        disturbSuccession(s, [[x, y]], "Cut-and-fill");
        log(s, { kind: "earthwork", actor: a.id, tiles: [[x, y]], text: `${a.name} places one soil unit at (${x},${y}); the permanent grade is now ${s.arena.height[y][x]}.`, why: ["One soil unit moved from the actor's earth stock into the terrain; no material was created.", `Earth stock: ${a.earthStock}/12. The raised tile immediately changes movement, falls and line range.`] });
        return;
      }
      if (inst.effect === "gradeTerrace") {
        const tiles = inst.tiles.slice().sort((a, b) => a[1] - b[1] || a[0] - b[0])
          .filter(([x, y]) => !(ClassRuntime?.gradeResisted && ClassRuntime.gradeResisted(s, a, x, y, classH())));   // As-Built tiles hold out of the terrace
        if (!tiles.length) { log(s, { kind: "earthwork", actor: a.id, text: `${a.name}'s terrace finds no tile it can reshape: every tile holds its as-built shape.` }); return; }
        const total = tiles.reduce((sum, [x, y]) => sum + s.arena.height[y][x], 0), base = Math.floor(total / tiles.length), remainder = total % tiles.length;
        let cutUnits = 0; const changed = [];
        tiles.forEach(([x, y], i) => {
          const old = s.arena.height[y][x], next = base + (i < remainder ? 1 : 0);
          if (old !== next) { if (old > next) cutUnits += old - next; s.arena.height[y][x] = next; changed.push([x, y]); }
        });
        for (const [x, y] of changed) disturbSuccession(s, [[x, y]], "Watershed Terrace");
        recordEarthMoved(s, a, cutUnits, changed);
        log(s, { kind: "earthwork", actor: a.id, tiles, text: `${a.name} grades a permanent terrace across ${tiles.length} tiles; ${cutUnits} soil unit${cutUnits === 1 ? "" : "s"} redistributed.`, why: [`Total ground elevation stays ${total} before and after; the catchment now has grades ${tiles.map(([x,y]) => s.arena.height[y][x]).join(", ")}. The lowest and highest grades define the local drainage path.`, "Large cumulative cuts risk invoking Gaia; the redistributed soil is not removed from the map."] });
        return;
      }
      if (presidentEffects.has(inst.effect) && presidentRules) {
        const units=presidentUnits(s),ctx=presidentContext(s),self=units.find(u=>u.id===a.id),merge=a.primary==="legitimacy"&&a.secondary==="strategic_commitment";
        if(inst.effect==="presidentOffice") {
          if(a.debt||a.exposedFalseClaim){log(s,{kind:"miss",actor:a.id,text:`${a.name} cannot take office under Credibility Debt or an exposed false claim.`});return;}
          const next=presidentRules.takeOffice(self,{round:s.round});if(next.office&&inst.duration)next.office={...next.office,until:s.round+inst.duration};syncPresidentUnit(s,next);
          const rec=presidentRules.recognizers(next,units,ctx);log(s,{kind:"effect",actor:a.id,tiles:inst.tiles,text:`${a.name} takes office for 3 rounds; ${rec.length} ally${rec.length===1?"":"ies"} recognize it.`,why:["Recognition requires a valid office, jurisdiction and a clear view."]});return;
        }
        if(inst.effect==="presidentDirection") {
          const allyId=inst.targets[0],ally=units.find(u=>u.id===allyId),abilityId=inst.orderAbility||ally?.abilities.find(id=>C.abilities[id]?.effect==="damage"&&C.abilities[id].tier!=="ultimate");
          const d=C.abilities[abilityId]; const r=ally&&d?presidentRules.directAlly(self,ally,{abilityId,target:inst.orderTarget||null},{units,ctx,abilities:C.abilities}):{ok:false,reason:"No usable ally technique was named."};
          if(!r.ok){a.pf=Math.min(a.maxPF,a.pf+inst.cost);log(s,{kind:"miss",actor:a.id,target:allyId,text:`Executive Direction fails: ${r.reason} The cost is refunded.`});return;}
          s.actors[allyId].order={...r.order,target:inst.orderTarget||null};log(s,{kind:"effect",actor:a.id,target:allyId,tiles:inst.tiles,text:`${a.name} requests ${d.name} from ${s.actors[allyId].name} on their next turn; their own ΦF and AP pay.`,why:["An instruction is a request, not an extra turn."]});return;
        }
        if(inst.effect==="presidentLaw") {
          if(!presidentRules.officeValid(self)){a.pf=Math.min(a.maxPF,a.pf+inst.cost);log(s,{kind:"miss",actor:a.id,text:"Due Process needs a valid office; cost refunded."});return;}
          syncPresidentUnit(s,presidentRules.dueProcess(self,inst.rule||"line",{round:s.round}));log(s,{kind:"law",actor:a.id,tiles:inst.tiles,text:`${a.name} declares Due Process: no ${inst.rule||"line"} deliveries for 2 rounds, maker included.`,why:["Breaking the rule marks the actor outlaw; the office holder also incurs Credibility Debt."]});return;
        }
        if(inst.effect==="presidentPromise") {
          const objective=inst.objective||{kind:"defeat",target:Object.values(s.actors).find(u=>!u.defeated&&u.side!==a.side)?.id},surrender=inst.surrender||"retreat";
          syncPresidentUnit(s,presidentRules.promise(self,objective,surrender,{round:s.round,units,abilities:C.abilities,method:inst.method,goalOnly:a.character === "odysseus"}));log(s,{kind:"promise",actor:a.id,tiles:inst.tiles,text:`${a.name} promises to ${objective.kind==="hold"?`hold (${objective.tile.join(",")})`:`defeat ${s.actors[objective.target]?.name||"the named target"}`} by round ${a.promise.by}, surrendering ${surrender}.`,why:[a.promise.credible?"The surrendered option is real.":"Cheap talk: the surrendered option was unavailable, so it earns no Mandate."]});return;
        }
        if(inst.effect==="presidentGuarantee") {
          const r=presidentRules.guarantee(self,inst.stake||Math.min(3,a.pf));if(r.error){a.pf=Math.min(a.maxPF,a.pf+inst.cost);log(s,{kind:"miss",actor:a.id,text:`Credible Guarantee fails: ${r.error} Cost refunded.`});return;}
          syncPresidentUnit(s,r.actor);log(s,{kind:"guarantee",actor:a.id,text:`${a.name} places ${r.actor.promise.stake} ΦF in escrow behind the promise.`});return;
        }
        if(inst.effect==="presidentCommitment") {
          for(const u of presidentRules.burnTheBoats(self,units))if(u.committed){u.committed={...u.committed,expiresAt:(s.actors[u.id]?.ownerTurns||0)+3};syncPresidentUnit(s,u);}
          log(s,{kind:"commitment",actor:a.id,tiles:inst.tiles,text:`${a.name} and willing allies nearby commit to advance for 3 rounds; their techniques gain ×1.3 potency.`,why:["Committed units cannot move farther from their nearest enemy."]});return;
        }
        if(inst.effect==="presidentAccord") {
          if(!merge||!presidentRules.officeValid(self)){a.pf=Math.min(a.maxPF,a.pf+inst.cost);log(s,{kind:"miss",actor:a.id,text:"The Accord Holds needs both concepts and a valid office; cost refunded."});return;}
          const participants=inst.participants||presidentRules.recognizers(self,units,ctx),objective=inst.objective||{kind:"defeat",target:Object.values(s.actors).find(u=>!u.defeated&&u.side!==a.side)?.id};
          const r=presidentRules.accord(self,{objective,participants,restriction:inst.restriction||"no lines"},{units,ctx});if(!r.ok){a.pf=Math.min(a.maxPF,a.pf+inst.cost);log(s,{kind:"miss",actor:a.id,text:`The Accord cannot form: ${r.reason} Cost refunded.`});return;}
          syncPresidentUnit(s,r.holder);log(s,{kind:"accord",actor:a.id,tiles:inst.tiles,text:`${a.name} forms an accord with ${participants.length} recognizing allies, bound by ${inst.restriction||"no lines"}.`,why:["Participation is voluntary; the President is bound by the same terms."]});return;
        }
      }
      if (inst.effect === "sectionCut") {
        const cut = inst.section || { axis: "row", index: inst.aim?.[1] || 0 };
        const old = (s.terrainEffects || []).filter(e => e.kind === "sectionCut" && e.owner === a.id);
        s.terrainEffects = s.terrainEffects.filter(e => !old.includes(e));
        s.terrainEffects.push({ id:`view-${++s.seq}`, kind:"sectionCut", label:"Section Cut", owner:a.id, side:a.side, axis:cut.axis, index:cut.index, tiles:inst.tiles, expiresAt:a.ownerTurns+(inst.duration||1) });
        // Any section cut surveys its tiles for the cutter's side: battle-long knowledge (Perch/Overflight read it).
        const _sv = (s.surveyed ||= {});
        _sv[a.side] = [...new Set([...(_sv[a.side] || []), ...inst.tiles.map(([x, y]) => `${x},${y}`)])];
        const summary = inst.tiles.map(([x,y]) => `(${x},${y}) h${heightAt(s,x,y)} ${tileAt(s,x,y).name}`).join(" · ");
        log(s,{kind:"section",actor:a.id,tiles:inst.tiles,text:`${a.name} cuts a ${cut.axis} at ${cut.index}; allies can read exact surface and height, and line sight runs along the cut until their next turn.`,why:[`Section read: ${summary}.`,"A section reveals only its row or column; it does not change the terrain."]});
        return;
      }
      if (inst.effect === "planView") {
        const tiles=[]; for(let y=0;y<s.arena.h;y++)for(let x=0;x<s.arena.w;x++)tiles.push([x,y]);
        s.terrainEffects.push({id:`view-${++s.seq}`,kind:"planView",label:"Plan View",owner:a.id,side:a.side,tiles,expiresAt:a.ownerTurns+(inst.duration||2)});
        const edge=findOpp("section","sightline","disrupts",null,"flattenHeight");if(edge)edgeUsed(s,edge.id);
        log(s,{kind:"effect",actor:a.id,tiles,text:`${a.name} imposes Plan View for ${inst.duration||2} owner turns: elevation is removed from movement, range, impact and falls for everyone.`,why:["The underlying arena elevations remain intact and return when the view expires.","Walls, cover and routes still work."]});
        return;
      }
      if (inst.effect === "project") {
        const held=(a.heldFragments||[]).find(f=>f.id===inst.fragmentId);
        if(inst.projectFragment&&held){a.heldFragments=a.heldFragments.filter(f=>f.id!==held.id);for(const [x,y] of inst.tiles)s.terrainEffects.push({id:`view-${++s.seq}`,kind:"pastedFragment",label:"Projected fragment",owner:a.id,side:a.side,tiles:[[x,y]],fragment:clone(held),expiresAt:a.ownerTurns+(inst.duration||2)});}
        else {const value=inst.projectionProperty==="surface"?surfaceAt(s,...(inst.sourceTile||inst.aim)):heightAt(s,...(inst.sourceTile||inst.aim));for(const [x,y] of inst.tiles)s.terrainEffects.push({id:`view-${++s.seq}`,kind:"projection",label:"Orthographic Projection",owner:a.id,side:a.side,tiles:[[x,y]],property:inst.projectionProperty||"height",value,expiresAt:a.ownerTurns+(inst.duration||2)});}
        const bermEdge=findOpp("berm","section","dampens",null,"stopProjection");if(bermEdge&&inst.projectionStoppedAt)edgeUsed(s,bermEdge.id);
        log(s,{kind:"projection",actor:a.id,tiles:inst.tiles,text:`${a.name} projects ${held?held.kind:inst.projectionProperty||"height"} along ${inst.projectionAxis||"east"} across ${inst.tiles.length} tile${inst.tiles.length===1?"":"s"} for ${inst.duration||2} owner turns.`,why:[held?"Section + Collage consumes one held fragment and carries its property along the axis.":"The copied property is temporary; when a height projection reverts, a unit may fall.",...(inst.projectionStoppedAt?["A Berm stops the projection axis."]:[])]});
        return;
      }
      if (inst.effect === "clip") {
        const [x,y]=inst.tiles[0],kind=inst.fragment.kind,unit=actorAt(s,x,y),b=barrierAt(s,x,y),object=s.arena.objects?.find(o=>o.x===x&&o.y===y),patch=patchAt(s,x,y);
        const fragment={id:`frag-${++s.seq}`,kind,value:null,source:[x,y]};
        if(kind==="cover"){
          fragment.value={cover:b?.coverFraction||object?.cover||tileAt(s,x,y).cover||0.25};
          if(b)b.coverFraction=0; if(object)object.cover=0;
          if(!b&&!object)s.terrainEffects.push({id:`rm-${++s.seq}`,kind:"removedFragment",owner:a.id,tiles:[[x,y]],fragment:clone(fragment),expiresAt:Number.MAX_SAFE_INTEGER});
        } else if(kind==="water"){
          fragment.value={surface:surfaceAt(s,x,y)};
          s.terrainEffects.push({id:`rm-${++s.seq}`,kind:"removedFragment",owner:a.id,tiles:[[x,y]],fragment:clone(fragment),expiresAt:Number.MAX_SAFE_INTEGER});
        } else if(kind==="mulch"){
          fragment.value={surface:"m"}; const mulch=s.barriers.find(q=>q.x===x&&q.y===y&&q.passiveGround); if(mulch)s.barriers=s.barriers.filter(q=>q!==mulch);
        } else if(kind==="thorns"){
          fragment.value={hazard:tileAt(s,x,y).hazard||3,surface:surfaceAt(s,x,y)};
          if(object){object.trait=null;if(object.status)delete object.status.hazard;}
          s.terrainEffects.push({id:`rm-${++s.seq}`,kind:"removedFragment",owner:a.id,tiles:[[x,y]],fragment:clone(fragment),expiresAt:Number.MAX_SAFE_INTEGER});
        } else if(kind==="absorbOneLine") {fragment.value={}; if(b)b.absorbsLine=false;}
        else if(kind==="wallProtection10") {fragment.value={protection:10}; b.protection-=10;}
        else if(kind==="membrane") {fragment.value={}; if(unit)unit.status.membrane=null;}
        else if(kind==="growthStage") {fragment.value={stage:1};if(patch)setPatchStage(s,patch,patch.stage-1,"Clip removes one growth stage from its source patch.");}
        a.heldFragments ||= []; if(a.heldFragments.length>=2)H.ClassRuntime?.dropFragment?.(s,a,a.heldFragments.shift(),H); a.heldFragments.push(fragment);
        if((a.traits||[]).some(t=>(t?.id||t)==="sampler")){a.sampler=a.sampler?.turn===a.ownerTurns?a.sampler:{turn:a.ownerTurns,clips:0,juxt:false};a.sampler.clips++;}   // Sampler: two free Clips a turn
        const edge=findOpp("collage",kind==="absorbOneLine"?"swale":kind==="membrane"?"selectivity":kind==="growthStage"?"succession":"barrier","disrupts",null,"clipFragment");if(edge)edgeUsed(s,edge.id);
        log(s,{kind:"clip",actor:a.id,tiles:[[x,y]],text:`${a.name} clips ${kind} from (${x},${y}) and holds it (${a.heldFragments.length}/2 fragments).`,why:["The source loses the clipped property; a fragment can be pasted elsewhere for two turns.",...(edge?[`Observed relationship [${edge.id}]: ${edge.teaches}`]:[])]});
        return;
      }
      if (inst.effect === "paste") {
        if (H.ClassRuntime?.builds?.[a.character]?.passives?.tankoubon) inst.duration = (inst.duration || 2) + 1;   // Mangaka's Tankoubon: pastes last 3 turns
        const fragment=(a.heldFragments||[]).find(f=>f.id===inst.fragmentId); if(!fragment)return;
        const [x,y]=inst.tiles[0]; a.heldFragments=a.heldFragments.filter(f=>f.id!==fragment.id);
        if(inst.samplerNoCharge&&a.sampler?.turn===a.ownerTurns)a.sampler.juxt=true;   // Sampler: the free Juxtapose is spent
        if(["ward","buff","trait"].includes(fragment.kind)){H.ClassRuntime?.pasteStolen?.(s,a,fragment,actorAt(s,x,y),inst.duration||2,H);return;}   // Cut Out's loot (class-runtime.js)
        if(fragment.kind==="membrane") {const target=actorAt(s,x,y);target.status.membrane={label:"Collage Membrane",owner:a.id,expiresAt:a.ownerTurns+(inst.duration||2)};}
        else if(fragment.kind==="growthStage")createSuccessionPatch(s,a,x,y,{stage:2,name:"Collage Transplant",duration:inst.duration||2});
        else {
          const adjacent=(s.terrainEffects||[]).find(e=>e.kind==="pastedFragment"&&e.owner===a.id&&e.fragment?.kind!==fragment.kind&&e.tiles?.some(([fx,fy])=>Math.abs(fx-x)+Math.abs(fy-y)===1)&&s.actors[e.owner]?.ownerTurns<e.expiresAt);
          const held=clone(fragment); if(held.kind==="cover"&&adjacent)held.value.cover=(held.value.cover||0.25)*1.5;
          if(held.kind==="wallProtection10"&&adjacent)held.value.protection=(held.value.protection||10)*1.5;
          s.terrainEffects.push({id:`paste-${++s.seq}`,kind:"pastedFragment",label:"Pasted fragment",owner:a.id,side:a.side,tiles:[[x,y]],fragment:held,expiresAt:a.ownerTurns+(inst.duration||2)});
          if(adjacent){adjacent.fragment.contrastMultiplier=1.5;log(s,{kind:"composition",actor:a.id,tiles:[[x,y],...(adjacent.tiles||[])],text:"Two different fragments meet side by side: contrast strengthens both ×1.5.",why:["The pair is a local interaction; separated fragments keep their base strength."]});}
        }
        log(s,{kind:"paste",actor:a.id,tiles:[[x,y]],text:`${a.name} pastes ${fragment.kind} at (${x},${y}) for ${inst.duration||2} owner turns.`,why:["A pasted fragment recreates only its clipped property, not the source object or whole technique.","Resonance can shake pasted fragments loose."]});
        return;
      }
      if (inst.effect === "raisePalisade" || inst.effect === "raiseFoundry" || inst.effect === "foundCity" || inst.effect === "orbitalDrop") {   // Settlement: found a building (Mala, 2026-10-19)
        const [bx, by] = inst.effect === "orbitalDrop" ? inst.aim : inst.tiles[0];   // the Citadel lands on the line's end tile
        const mine = (s.arena.objects || []).filter((o) => o.building && o.owner === a.id).sort((p, q) => (p.foundedAt ?? 0) - (q.foundedAt ?? 0));
        while (mine.length >= 2) {   // two buildings per founder: a third dismantles the oldest
          const old = mine.shift();
          s.arena.objects = s.arena.objects.filter((o) => o.id !== old.id);
          H.courtFoundationFell?.(s, old.id);
          log(s, { kind: "build", actor: a.id, tiles: [[old.x, old.y]], text: `${a.name}'s ${old.name} is dismantled to raise the new work (two buildings stand per founder).` });
        }
        const sf = a.character === "starfarer" || a.embodied?.classId === "starfarer";   // her register: alloy and energy, same stats
        const def = inst.effect === "raisePalisade" ? (sf ? { type: "palisade", name: "Aegis Pylons", hp: 12, material: "alloy", sprite: "aegis-pylons" } : { type: "palisade", name: "Palisade", hp: 12, material: "wood", sprite: "fence" })
          : inst.effect === "raiseFoundry" ? (sf ? { type: "foundry", name: "Nano-Fabricator", hp: 15, material: "alloy", sprite: "nano-fabricator" } : { type: "foundry", name: "Foundry", hp: 15, material: "wood", sprite: "building-warehouse" })
          : (sf ? { type: "keep", name: "Citadel", hp: 30, material: "alloy", sprite: "citadel" } : { type: "keep", name: "Keep", hp: 30, material: "stone", sprite: "building-townhall" });
        const hp = def.hp + (inst.buildingHpAdd || 0);
        a.foundedSeq = (a.foundedSeq || 0) + 1;
        const bldId = `bld-${a.id}-${a.foundedSeq}`;
        const built = { id: bldId, type: def.type, name: `${a.name}'s ${def.name}`, tags: ["structure", "building"], building: true, side: a.side, owner: a.id, sprite: def.sprite, x: bx, y: by, hp, maxHp: hp, cover: def.type === "foundry" ? 0 : 0.5, blocksMove: true, moveCost: 0, material: def.material, foundedAt: a.foundedSeq };
        s.arena.objects.push(built);
        H.courtFoundation?.(s, a, built);
        log(s, { kind: "build", actor: a.id, tiles: [[bx, by]], text: `${a.name} raises the ${def.name} at (${bx},${by}) (${hp} HP).` });
        if (inst.effect === "orbitalDrop") { inst.skipIds = [bldId]; inst.effect = "damage"; }   // the line still burns, past its own landing work
        else return;
      }
      if (inst.effect === "paleStampede") {   // Pale Stampede: trample the line and the ground beside it, churn the path
        const zone = new Map();
        for (const [x, y] of line(a.x, a.y, inst.aim[0], inst.aim[1]).slice(1))
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
            if (inside(s, x + dx, y + dy)) zone.set(`${x + dx},${y + dy}`, [x + dx, y + dy]);
        let struck = 0;
        for (const u of Object.values(s.actors)) {
          if (u.defeated || u === a || u.side === a.side || !zone.has(`${u.x},${u.y}`)) continue;
          struck++;
          strikeTarget(s, a, u, inst, inst.potency * inst.mult, [...why, "Pale Stampede tramples the line and the ground beside it."]);
        }
        let trampled = 0;
        if (MaidSystems) for (const [x, y] of zone.values()) if (MaidSystems.addFilth(s, x, y, 1)) trampled++;
        if (trampled) log(s, { kind: "terrain", actor: a.id, text: `The stampede churns ${trampled} tiles: crossing costs +10 AP until it is cleaned.` });
        settleDeferredCharge(s, a, inst, struck);
        return;
      }
      if (inst.effect === "successionPatch" || inst.effect === "nurseLog") {
        const [x, y] = inst.tiles[0], swaleTile = (s.terrainEffects || []).some(e => ["rainGarden", "checkDam"].includes(e.kind) && (e.tiles?.includes(key(x, y)) || (e.x === x && e.y === y)));
        const bonus = inst.growthStageAdd && swaleTile ? inst.growthStageAdd : 0;
        const substrate = (s.arena.objects || []).some(o => o.x === x && o.y === y && ["log", "stump"].includes(o.type));
        const weak = inst.effect === "nurseLog" && !substrate;   // nursing without wood: no absorb, but tended soil lasts longer
        const patch = createSuccessionPatch(s, a, x, y, { nurseLog: inst.effect === "nurseLog" && !weak, stage: 1 + bonus,
          name: inst.effect === "nurseLog" ? "Nurse Log Patch" : "Pioneer Patch", duration: weak ? 6 : inst.duration || 4 });
        if (weak) log(s, { kind: "succession", actor: a.id, tiles: [[x, y]], text: `No woody substrate: the nursing is weak (no absorb), but tended soil lasts 6 rounds.` });
        if (bonus) log(s, { kind: "composition", actor: a.id, tiles: [[x, y]], text: "Swale advances the new Succession patch one stage.", why: ["The composed operation applies only on a Rain Garden or Check Dam tile."] });
        return;
      }
      if (inst.effect === "oldGrowth") {
        const patches = (s.successionPatches || []).filter(p => p.owner === a.id);
        for (const patch of patches) { patch.permanent = true; patch.expiresAtRound = null; setPatchStage(s, patch, 3, "Old Growth brings every owned patch to its permanent climax stage."); }
        log(s, { kind: "succession", actor: a.id, tiles: patches.map(p => [p.x, p.y]), text: `Old Growth matures ${patches.length} owned patch${patches.length === 1 ? "" : "es"} for the rest of this battle.`, why: ["This ultimate changes the state of existing patches; it does not create new ones."] });
        return;
      }
      if (inst.effect === "damage") {
        H.clearCreeper(s, a, inst.tiles);   // any normal attack clears creeper under its footprint
        if(inst.concept==="resonance"){
          const shaken=(s.terrainEffects||[]).filter(e=>e.kind==="pastedFragment"&&e.tiles?.some(t=>(inst.tiles||[]).some(q=>q[0]===t[0]&&q[1]===t[1]))&&s.actors[e.owner]?.side!==a.side);
          if(shaken.length){s.terrainEffects=s.terrainEffects.filter(e=>!shaken.includes(e));const edge=findOpp("resonance","collage","disrupts",null,"shakeLoose");if(edge)edgeUsed(s,edge.id);log(s,{kind:"effect",actor:a.id,tiles:shaken.flatMap(e=>e.tiles),text:`Resonance shakes loose ${shaken.length} pasted fragment${shaken.length===1?"":"s"}.`,why:[`The vibration removes temporary collage pieces from its committed field${edge?` [${edge.id}]`:""}.`]});}
        }
        const relation = C.opposition.find(e => e.source === inst.concept && e.target === "succession" && e.status === "known");
        for (const [x, y] of inst.tiles || []) {
          const patch = patchAt(s, x, y); if (!patch || !relation) continue;
          if (relation.op.kind === "advanceGrowth" && patch.stage < 3) setPatchStage(s, patch, patch.stage + Math.max(1, relation.op.stages || 1), `${conceptName(inst.concept)} advances this patch through its authored graph interaction.`);
          if (relation.op.kind === "resetGrowth") disturbSuccession(s, [[x, y]], conceptName(inst.concept));
        }
      }
      if(inst.effect==="focus"){
        const targetId=inst.targets[0],targetActor=s.actors[targetId];
        if(!targetActor){log(s,{kind:"miss",actor:a.id,text:`${inst.name} has no living target.`});return;}
        a.focus={target:targetId,expiresAt:a.ownerTurns+(inst.duration||1),coverReady:true,detail:true};
        log(s,{kind:"focus",actor:a.id,target:targetId,tiles:[[targetActor.x,targetActor.y]],text:`${a.name} focuses on ${targetActor.name} for ${inst.duration||1} owner turn${(inst.duration||1)===1?"":"s"}.`,why:["If the next Sightline shot has an adjacent partial-cover source, one source can be ignored. Focus is your latest technique, so reactions against other enemies are unavailable until you use a different concept."]});
        return;
      }
      if(inst.effect==="annotate"||inst.effect==="redact"||inst.effect==="plaintext"){
        // Cipher: marks ride the generic owner-clock expiry (label + owner + expiresAt); seals reuse the Typed Channel silence shape.
        const cipherMembrane=(t)=>{
          const mem=t.status?.membrane; if(!mem||mem.rushed) return false;
          const e=findOpp("selectivity","cipher","negates","line");
          if(!e) return false;
          edgeUsed(s,e.id);
          log(s,{kind:"negate",actor:a.id,target:t.id,tiles:[[t.x,t.y]],text:`${inst.name} doesn't reach ${t.name}.`,why:[`${t.name}'s Membrane filters out the cipher line [${e.id}].`],edge:e.id});
          return true;
        };
        const cipherExpose=(t,pot)=>{
          if(t.lastTechniqueConcept!=="deception") return {pot,id:null};
          const e=findOpp("cipher","deception","exposes",null,"exposeDeceiver");
          if(!e) return {pot,id:null};
          edgeUsed(s,e.id); return {pot:Math.round(pot*(e.op.factor||1.3)),id:e.id};
        };
        if(inst.effect==="annotate"){
          const t=s.actors[inst.targets[0]];
          if(!t){log(s,{kind:"miss",actor:a.id,text:`${inst.name} has no living target.`});return;}
          if(cipherMembrane(t)) return;
          t.status.annotated={label:"Annotation",owner:a.id,expiresAt:a.ownerTurns+(inst.duration||1)};
          log(s,{kind:"reveal",actor:a.id,target:t.id,tiles:[[t.x,t.y]],text:`${a.name} annotates ${t.name}: soul ${t.soul??"?"} of ${t.maxSoul??"?"}.`,why:[`Hidden stats are written down for ${a.name}'s side${t.traits?.length?`; traits: ${t.traits.join(", ")}`:""}. Redact and Plaintext read the mark.`]});
          return;
        }
        if(inst.effect==="redact"){
          const t=s.actors[inst.targets[0]];
          if(!t){log(s,{kind:"miss",actor:a.id,text:`${inst.name} has no living target.`});return;}
          if(cipherMembrane(t)) return;
          const channel=C.conceptDamageTypes[t.lastTechniqueConcept]||"nigredo";
          t.status.silenced={channel,until:t.ownerTurns+1};
          const ann=!!t.status.annotated; let note="",exId=null;
          if(ann){const r=cipherExpose(t,inst.potency||0); exId=r.id; note=` for ${r.pot} soul`; H.woundSoul(s,a,t,r.pot);}
          log(s,{kind:"effect",actor:a.id,target:t.id,tiles:[[t.x,t.y]],text:`${a.name} redacts ${t.name}'s ${channel} verse until their next turn start${note}.`,why:[`Sealed: ${channel} techniques are refused.`,...(ann?["The mark reads back: the soul takes the verse instead."]:["Unmarked: the seal lands, but nothing reads back."]),...(exId?[`The record contradicts the fresh lie [${exId}].`]:[])]});
          return;
        }
        if(inst.effect==="plaintext"){
          const radius=ab(inst.ability)?.area?.radius??2;
          const foes=Object.values(s.actors).filter(u=>!u.defeated&&u.side!==a.side&&dist(s,a.x,a.y,u.x,u.y)<=radius);
          if(!foes.length){log(s,{kind:"effect",actor:a.id,text:`${a.name} reads the field: no enemies within ${radius}. The cost is spent.`});return;}
          for(const t of foes){
            const was=!!t.status.annotated;
            t.status.annotated={label:"Annotation",owner:a.id,expiresAt:a.ownerTurns+2};   // matches Annotate: the record survives to the turn after next
            const r=cipherExpose(t,was?(inst.potency||16):Math.round((inst.potency||16)/2));
            if(r.id) log(s,{kind:"effect",actor:a.id,target:t.id,tiles:[[t.x,t.y]],text:`The record contradicts ${t.name}'s fresh lie [${r.id}].`});
            H.woundSoul(s,a,t,r.pot);
          }
          return;
        }
      }
      if(inst.effect==="brierRing"){
        const [cx,cy]=inst.tiles[0]; let n=0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          if(!dx&&!dy) continue;
          if(seedThorn(s,a,cx+dx,cy+dy,{dmg:4,duration:inst.duration||2,slow:true})) n++;
        }
        log(s,{kind:"effect",actor:a.id,tiles:[[cx,cy]],text:`${a.name} rings (${cx},${cy}) with briers: ${n} thorn tiles.`,why:["Entering a ring tile deals 4 and snares (half movement until it clears)."]});
        return;
      }
      if(inst.effect==="overgrowth"){
        const onTiles=new Set((inst.tiles||[]).map(([x,y])=>x+","+y));
        const foes=Object.values(s.actors).filter(u=>!u.defeated&&u.side!==a.side&&onTiles.has(u.x+","+u.y));
        resolveAbility(s,a,{...inst,effect:"damage"});
        let rooted=0,seeded=0;
        for(const u of foes){const t=s.actors[u.id]; if(!t||t.defeated) continue; t.status.entangled={lostMove:99,expiresAt:t.ownerTurns+1}; rooted++;}
        for(const [x,y] of inst.tiles||[]) if(!actorAt(s,x,y)&&seedThorn(s,a,x,y,{dmg:3,duration:2,slow:false})) seeded++;
        log(s,{kind:"effect",actor:a.id,tiles:inst.tiles,text:`Overgrowth keeps ${rooted} and seeds ${seeded} tiles.`,why:["Entangled: no movement until it clears."]});
        return;
      }
      if(inst.effect==="chartStar"){
        const [x,y]=inst.tiles[0];
        if(!chartStar(s,a,x,y,inst.duration||3)){log(s,{kind:"miss",actor:a.id,tiles:[[x,y]],text:`${a.name} cannot chart (${x},${y}); the cost is spent.`});return;}
        log(s,{kind:"effect",actor:a.id,tiles:[[x,y]],text:`${a.name} charts a star at (${x},${y}).`,why:["At each of your turn starts it pings adjacent enemies for 2. Starfall and Grand Conjunction spend it."]});
        return;
      }
      if(inst.effect==="starfall"){
        const [x,y]=inst.tiles[0];
        const star=(s.terrainEffects||[]).find(e=>e.kind==="star"&&e.owner===a.id&&e.tiles?.some(([tx,ty])=>tx===x&&ty===y)&&s.actors[e.owner]?.ownerTurns<e.expiresAt);
        if(!star){log(s,{kind:"miss",actor:a.id,tiles:[[x,y]],text:`${a.name} reads no live charted star at (${x},${y}); the cost is spent.`});return;}
        const wall=line(a.x,a.y,x,y).find(([px,py])=>{if(px===a.x&&py===a.y)return false;const b=barrierAt(s,px,py);return b&&!b.passable&&!b.passiveGround&&s.actors[b.owner]?.side!==a.side;});
        if(wall){const e=findOpp("boundary","conjunction","occults",null,"occultStarlight");if(e)edgeUsed(s,e.id);log(s,{kind:"negate",actor:a.id,tiles:[[x,y]],text:`Starfall never leaves the chart: a wall at (${wall.join(",")}) occults the star${e?` [${e.id}]`:""}.`,why:["The star itself stands; only this fall is stopped."]});return;}
        detonateStar(s,a,star,1,inst.potency||12,"Starfall");
        chartStar(s,a,x,y,3);
        log(s,{kind:"effect",actor:a.id,tiles:[[x,y]],text:`A fresh star is charted on the burst tile (${x},${y}): the chain continues.`});
        return;
      }
      if(inst.effect==="grandConjunction"){
        const stars=(s.terrainEffects||[]).filter(e=>e.kind==="star"&&e.owner===a.id&&s.actors[e.owner]?.ownerTurns<e.expiresAt);
        if(!stars.length){log(s,{kind:"effect",actor:a.id,text:`${a.name} reads an empty sky: no charted stars. The cost is spent.`});return;}
        for(const st of [...stars]) detonateStar(s,a,st,2,inst.potency||16,"Grand Conjunction");
        return;
      }
      if(inst.effect==="attention"){
        const id=inst.targets[0],t=s.actors[id];if(!t)return;
        a.status.attention={owner:a.id,target:id,expiresAt:a.ownerTurns+(inst.duration||2)};a.lastTechniqueConcept="focus";
        t.status.attendedBy={owner:a.id,expiresAt:a.ownerTurns+(inst.duration||2)};
        log(s,{kind:"effect",actor:a.id,target:id,tiles:[[t.x,t.y]],text:`${a.name} gives ${t.name} their Undivided Attention for ${inst.duration||2} turns.`,why:["Attacks on this target ×1.5 and ignore partial cover and parries; other targets cannot be selected. Other enemies deal ×1.25 damage."]});return;
      }
      if(inst.effect==="immovable"){
        a.status.immovable={owner:a.id,expiresAt:a.ownerTurns+1};a.status.slowStart={owner:a.id,expiresAt:a.ownerTurns+2};
        log(s,{kind:"effect",actor:a.id,text:`${a.name} becomes Immovable until their next turn; movement is halved on that turn.`,why:["Forced displacement is cancelled and Nigredo · impact damage is reduced by 20% while set."]});return;
      }
      if(inst.effect==="mimic"){
        const last=a.lastBasicHit,source=last&&s.actors[last.source];
        if(!last||ab(last.ability)?.tier!=="basic"||!source||source.defeated||last.atOwnerTurn<a.ownerTurns){log(s,{kind:"miss",actor:a.id,text:`${a.name} has no recent basic technique to mimic; the cost is spent.`});return;}
        const copy=manifest(s,a,last.ability),aimed=[source.x,source.y],t=target(s,a,copy,...aimed);
        if(!t.ok){log(s,{kind:"miss",actor:a.id,target:source.id,text:`${a.name} cannot reach ${source.name} with the copied technique.`});return;}
        const inst2={...copy,owner:a.id,sourceHeight:heightAt(s,a.x,a.y),mult:0.75,tiles:t.tiles,targets:t.targets||[],route:t.route||null,aim:aimed};
        log(s,{kind:"effect",actor:a.id,target:source.id,text:`${a.name} mimics ${ab(last.ability).name} at three-quarter potency.`,why:["Only the Mimicry ΦF cost was paid; the copied basic uses the caster's own lens and position."]});resolveAbility(s,a,inst2);return;
      }
      if(inst.effect==="ambush"){
        const enemy=Object.values(s.actors).filter(t=>!t.defeated&&t.side!==a.side).sort((x,y)=>dist(s,a.x,a.y,x.x,x.y)-dist(s,a.x,a.y,y.x,y.y))[0];let moved=0;
        if(enemy){const P=paths(s,a.x,a.y,3,"move"),choices=[...P.dist.entries()].map(([k,n])=>{const to=k.split(",").map(Number);return {to,n,d:dist(s,to[0],to[1],enemy.x,enemy.y)}}).sort((x,y)=>y.d-x.d||y.n-x.n);const pick=choices.find(x=>x.n>0);if(pick){const route=P.pathTo(...pick.to)||[];let prev=[a.x,a.y];for(const [x,y] of route.slice(1)){a.x=x;a.y=y;moved++;applyEntryEffects(s,a,a,x,y,"retreats through");prev=[x,y];if(a.defeated)break;}a.moved=moved>0;}}
        if(!a.defeated)a.status.ambush={owner:a.id,potency:inst.potency*inst.mult,expiresAt:a.ownerTurns+(inst.duration||1),hit:[]};
        log(s,{kind:"effect",actor:a.id,tiles:[[a.x,a.y]],text:`${a.name} feigns a retreat${moved?` of ${moved} tiles`:""}; anyone who moves closer before their next turn risks the ambush.`});return;
      }
      if(inst.effect==="charge"){
        const [tx,ty]=inst.aim||[],dx=Math.sign(tx-a.x),dy=Math.sign(ty-a.y);let stopped=false;
        // The Aviator's dashes (Mala, 2026-10-18) ride the same charge: chargeTiles (default 4); stopAtFirst ends beside the first
        // enemy after striking it (Propulsion); passOver flies over everyone, striking each, to the wall or the edge (Full Throttle).
        const CD=ab(inst.ability)||{},reach=inst.chargeTiles||CD.chargeTiles||4;   // Propulsion stretches with Aerodynamic and Thrust (queries.js)
        if(CD.stopAtFirst||CD.passOver){const passed=[];let land=[a.x,a.y];
          for(let i=1;i<=reach;i++){const x=a.x+dx*i,y=a.y+dy*i;if(!inside(s,x,y)){stopped=true;break;}
            const wall=barrierAt(s,x,y),tile=tileAt(s,x,y);if(tile.blocksMove||(wall&&!wall.passable)){if(!CD.soarOver){stopped=true;break;}continue;}   // J6r: a soar flies over blocked ground but never lands on it
            const u=actorAt(s,x,y);
            if(u&&u!==a){if(u.side!==a.side&&!u.defeated){passed.push(u.id);strikeTarget(s,a,u,inst,inst.potency*inst.mult,[...why,CD.stopAtFirst?"Propulsion stops beside the first enemy on its line.":"Full Throttle passes over and strikes everyone on its line."]);}
              if(CD.stopAtFirst)break;continue;}   // an ally or a struck enemy: Propulsion stops here, Full Throttle flies over them
            land=[x,y];}
          if(land[0]!==a.x||land[1]!==a.y){a.x=land[0];a.y=land[1];applyEntryEffects(s,a,a,land[0],land[1],CD.passOver?"lands at":"dashes to");}
          log(s,{kind:"move",actor:a.id,tiles:[[a.x,a.y]],text:`${a.name} ${CD.soarOver?`soars the line${passed.length?`, striking ${passed.length}`:""}`:CD.passOver?`flies the line${passed.length?`, striking ${passed.length}`:""}`:"dashes in a straight line"}${stopped?" and stops at an obstacle":""}.`,why:[CD.soarOver?"Nothing but the edge ends a Soaring Strike.":CD.passOver?"Nothing but a wall or the edge ends Full Throttle.":"Propulsion goes straight until something is in the way."]});return;
        }
        for(let i=1;i<=4;i++){const x=a.x+dx,y=a.y+dy;if(!inside(s,x,y)){stopped=true;break;}const wall=barrierAt(s,x,y),tile=tileAt(s,x,y);
          if(tile.blocksMove||(wall&&!wall.passable)){hit(s,a,a,null,6,["The charge collides with a blocking wall."],{label:"Collision",damageType:"nigredo"});stopped=true;break;}
          const u=actorAt(s,x,y);
          if(u&&u.side===a.side&&u!==a&&inst.ability==="landslide"){log(s,{kind:"move",actor:a.id,target:u.id,tiles:[[a.x,a.y]],text:`${a.name} halts before ${u.name}: the slope spares its own.`,why:["Landslide strikes every foe — allies are never entered, struck, or thrown."]});stopped=true;break;}   // J6; gated on Landslide at merge (Pantry): other charges, such as the Unstoppable ultimate, keep their shipped behaviourr: allies end the charge untouched
          if(u){const anchored=!!(u.status.anchor||u.status.immovable);if(anchored){hit(s,a,u,inst,6,["An anchored or immovable body stops the charge; both collide."],{label:"Collision",damageType:"nigredo"});hit(s,u,a,null,6,["The charge meets an immovable body."],{label:"Collision",damageType:"nigredo"});stopped=true;break;}
            strikeTarget(s,a,u,inst,inst.potency*inst.mult,why);const sx=dy,sy=-dx,nx=u.x+sx,ny=u.y+sy;if(inside(s,nx,ny)&&!actorAt(s,nx,ny)&&!tileAt(s,nx,ny).blocksMove&&!barrierAt(s,nx,ny)){u.x=nx;u.y=ny;log(s,{kind:"move",actor:a.id,target:u.id,tiles:[[nx,ny]],text:`${u.name} is thrown aside to (${nx},${ny}).`,why:["The charge throws victims aside; a blocked landing collides instead."]});applyEntryEffects(s,a,u,nx,ny,"is thrown to");}else hit(s,a,u,null,6,["The sideways throw meets an obstacle."],{label:"Collision",damageType:"nigredo"});
          }
          a.x=x;a.y=y;applyEntryEffects(s,a,a,x,y,"charges through");if(a.defeated)break;
        }
        log(s,{kind:"move",actor:a.id,tiles:[[a.x,a.y]],text:`${a.name} completes the straight charge${stopped?" against an obstacle":""}.`,why:["The charge advances tile by tile; walls, anchored targets, and immovable targets end it."]});return;
      }
      if(inst.effect==="prune"){resolvePrune(s,a,inst);return;}
      if(inst.effect==="immovable"){
        a.status.immovable={owner:a.id,expiresAt:a.ownerTurns+1};
        a.status.slowStart={owner:a.id,expiresAt:a.ownerTurns+2};
        log(s,{kind:"effect",actor:a.id,text:`${a.name} becomes Immovable until their next turn; movement is halved on that turn.`,why:["Forced displacement is cancelled and Nigredo · impact damage is reduced by 20% while set."]});return;
      }
      if(inst.effect==="attention"){
        const id=inst.targets[0],t=s.actors[id];if(!t)return;
        a.status.attention={owner:a.id,target:id,expiresAt:a.ownerTurns+(inst.duration||2)};
        a.lastTechniqueConcept="focus";
        t.status.attendedBy={owner:a.id,expiresAt:a.ownerTurns+(inst.duration||2)};
        log(s,{kind:"effect",actor:a.id,target:id,tiles:[[t.x,t.y]],text:`${a.name} gives ${t.name} their Undivided Attention for ${inst.duration||2} turns.`,why:["Attacks on the attended target ×1.5 and ignore partial cover and parries. The caster cannot attack or react to other opponents; those opponents deal ×1.25 damage."]});return;
      }
      if(inst.effect==="mimic"){
        const last=a.lastBasicHit,source=last&&s.actors[last.source];
        if(!last||ab(last.ability)?.tier!=="basic"||!source||source.defeated||last.atOwnerTurn<a.ownerTurns){log(s,{kind:"miss",actor:a.id,text:`${a.name} has no recent basic technique to mimic; the cost is spent.`,why:["Mimicry copies only the last basic ability that damaged you since your previous turn."]});return;}
        const copy=manifest(s,a,last.ability),act=ab(last.ability);let aimed=null;
        if(copy.target==="enemy"||copy.delivery==="routed")aimed=[source.x,source.y];
        else if(copy.target==="tile"||copy.delivery==="placed")aimed=[source.x,source.y];
        const t=copy.target==="self"?{ok:true,tiles:areaTiles(s,a,copy,a.x,a.y),targets:[]}:aimed?target(s,a,copy,...aimed):{ok:false};
        if(!t.ok){log(s,{kind:"miss",actor:a.id,target:source.id,text:`${a.name} cannot reach ${source.name} with the copied technique; no copied effect resolves.`,why:["Mimicry uses the copied ability's ordinary targeting and the caster's own position and lens."]});return;}
        const inst2={...copy,owner:a.id,sourceHeight:heightAt(s,a.x,a.y),mult:0.75,tiles:t.tiles,targets:t.targets||[],route:t.route||null,aim:aimed,gap:"north",part:"foliage"};
        log(s,{kind:"effect",actor:a.id,target:source.id,text:`${a.name} mimics ${act.name} at three-quarter potency.`,why:["Only the Mimicry ΦF cost was paid; the copied basic ability uses the caster's position and lens."]});resolveAbility(s,a,inst2);return;
      }
      if(inst.effect==="ambush"){
        const enemy=Object.values(s.actors).filter(t=>!t.defeated&&t.side!==a.side).sort((x,y)=>dist(s,a.x,a.y,x.x,x.y)-dist(s,a.x,a.y,y.x,y.y))[0];
        let moved=0;
        if(enemy){const P=paths(s,a.x,a.y,3,"move"),choices=[...P.dist.entries()].map(([k,n])=>({to:k.split(",").map(Number),n,d:dist(s,k.split(",").map(Number)[0],k.split(",").map(Number)[1],enemy.x,enemy.y)})).sort((x,y)=>y.d-x.d||y.n-x.n);
          const pick=choices.find(x=>x.n>0);if(pick){a.x=pick.to[0];a.y=pick.to[1];moved=pick.n;a.moved=true;}}
        a.status.ambush={owner:a.id,potency:inst.potency*inst.mult,expiresAt:a.ownerTurns+(inst.duration||1),hit:[]};
        log(s,{kind:"effect",actor:a.id,tiles:[[a.x,a.y]],text:`${a.name} feigns a retreat${moved?` of ${moved} tiles`:""}; anyone who moves closer before their next turn is caught in the ambush.`,why:["One opponent can trigger this once by ending a move at a shorter distance. If nobody chases, the ground is ceded for nothing."]});return;
      }
      if(inst.effect==="fly"){   // J6 Short Flight: the landing was validated at aim time; the sky between is free
        const [x,y]=inst.tiles[0]||[];
        if(x==null||!inside(s,x,y)||actorAt(s,x,y)||tileAt(s,x,y).blocksMove||barrierAt(s,x,y)){log(s,{kind:"miss",actor:a.id,text:`${a.name} cannot land there; the flight fizzles.`});return;}
        const from=[a.x,a.y];a.x=x;a.y=y;applyEntryEffects(s,a,a,x,y,"lands at");
        log(s,{kind:"move",actor:a.id,tiles:[[x,y]],text:`${a.name} flies from (${from[0]},${from[1]}) to (${x},${y}).`,why:["Short Flight ignores terrain, height, and walls between — but must land on open ground."]});return;
      }
      if(inst.effect==="rally"){   // J6 Rally: the noble soul lends its voice (capped, like all earned Inspiration)
        const t=s.actors[inst.targets[0]];
        if(!t||t.defeated){log(s,{kind:"miss",actor:a.id,text:`${a.name} rallies no one; the words fall flat.`});return;}
        if((t.inspiration||0)>(s.rules.inspiration?.cap??3)){log(s,{kind:"inspiration",actor:a.id,target:t.id,text:`${t.name} already burns past the cap (${t.inspiration}): the crown holds.`,why:["Rally adds, never trims — a coronation is not a loan."]});return;}   // J6: gain() clamps down, so a post-crown Rally must not call it
        H.Inspiration.gain(s,t,1,`${a.name} rallies ${t.id===a.id?"their own heart":t.name}: a soul's encouragement.`);return;
      }
      if(inst.effect==="twist"){   // J6 Plot Twist: two positions rewritten as one
        const t=s.actors[inst.targets[0]];
        if(!t||t.defeated||t===a||t.status?.immovable||t.status?.anchor){log(s,{kind:"miss",actor:a.id,text:`${a.name}'s plot twist finds no one to turn.`});return;}
        const [ax,ay]=[a.x,a.y];a.x=t.x;a.y=t.y;t.x=ax;t.y=ay;
        applyEntryEffects(s,a,a,a.x,a.y,"twists to");applyEntryEffects(s,a,t,t.x,t.y,"is twisted to");
        log(s,{kind:"move",actor:a.id,target:t.id,tiles:[[a.x,a.y],[t.x,t.y]],text:`${a.name} and ${t.name} trade places: the plot twists.`,why:["Plot Twist rewrites two positions at once; anchored bodies refuse."]});return;
      }
      if(inst.effect==="coronate"){   // J6 Coronation: the crown outranks the cap
        a.inspiration=(a.inspiration||0)+2;
        log(s,{kind:"inspiration",actor:a.id,text:`${a.name} is crowned: +2 Inspiration (${a.inspiration}, past every cap).`,why:["Coronation is the only Inspiration that ignores the cap of 3."]});return;
      }
      if(inst.effect==="denyEnding"){   // J6 Refuse the Ending: ward the story (damage.js turns the blow aside)
        a.sagaWard=true;
        log(s,{kind:"effect",actor:a.id,text:`${a.name}'s saga refuses its ending: the next lethal blow this battle will leave them at 1 LF.`,why:["The ward must be cast before the blow; it waits all battle."]});return;
      }
      if(inst.effect==="checkDam"){
        const [x,y]=inst.tiles[0];s.terrainEffects.push({id:"te"+(++s.seq),kind:"checkDam",owner:a.id,x,y,expiresAt:a.ownerTurns+(inst.duration||3)});
        log(s,{kind:"effect",actor:a.id,tiles:[[x,y]],text:`Check Dam slows routed paths and landscape flow at (${x},${y}) for ${inst.duration||3} turns.`,why:["Routed attacks pay 2 extra route length when crossing; straight-line attacks pass overhead."]});return;
      }
      if(inst.effect==="rainGarden"){
        const tiles=inst.tiles.map(([x,y])=>key(x,y));s.terrainEffects.push({id:"te"+(++s.seq),kind:"rainGarden",owner:a.id,tiles,remaining:Object.fromEntries(tiles.map(k=>[k,1])),expiresAt:a.ownerTurns+(inst.duration||3)});
        if (inst.nursePatch) {
          const seedTile = inst.tiles.find(([x, y]) => tileAt(s, x, y).tags?.includes("soil") && !patchAt(s, x, y) && !actorAt(s, x, y));
          if (seedTile) createSuccessionPatch(s, a, seedTile[0], seedTile[1], { name: "Rain Garden Nurse Patch", duration: inst.duration || 4 });
        }
        log(s,{kind:"effect",actor:a.id,tiles:inst.tiles,text:`Rain Garden takes root across ${tiles.length} tiles for ${inst.duration||3} turns.`,why:["Each tile absorbs one opposing line; movement costs at least 2, routes slow, and allies ending a turn inside recover up to 4 LF."]});return;
      }
      if(inst.effect==="fence"){
        const dur=(inst.duration||2)+(hasTrait(a,"markedGround")?1:0);   // Marked Ground: her fences hold +1 turn
        for(const [x,y] of inst.tiles){if(barrierAt(s,x,y)||unitAt(s,x,y)||tileAt(s,x,y).blocksMove)continue;s.barriers.push({id:"b"+(++s.seq),owner:a.id,x,y,concept:"fence",duration:dur,expiresAt:a.ownerTurns+dur,passable:false,blocksMove:true,blocksRoute:true,blocksSight:false,linePassable:true,coverFraction:0,protection:0});}
        log(s,{kind:"effect",actor:a.id,tiles:inst.tiles,text:`Fence Line controls passage across ${inst.tiles.length} open tiles for ${dur} turns.`,why:["The fence blocks movement and routes, but sight and straight-line deliveries pass through. Its endpoints can be bypassed."]});return;
      }
      if(inst.effect==="contourBerm"){
        const tiles=[];let contour=null,stepped=false;
        for(const [x,y] of inst.tiles){if(!inside(s,x,y)||unitAt(s,x,y)||barrierAt(s,x,y)||tileAt(s,x,y).blocksMove)break;const h=heightAt(s,x,y);if(contour==null)contour=h;if(h!==contour){if(!inst.contourStep||stepped||Math.abs(h-contour)>1)break;stepped=true;contour=h;}
          s.barriers.push({id:"b"+(++s.seq),owner:a.id,x,y,concept:"berm",protection:0,duration:inst.duration||2,expiresAt:a.ownerTurns+(inst.duration||2),passable:true,blocksSight:false,blocksMove:false,blocksRoute:false,heightDelta:1,coverFraction:0.5});tiles.push([x,y]);}
        log(s,{kind:"effect",actor:a.id,tiles,text:`Keyline Terrace follows the contour across ${tiles.length} tile${tiles.length===1?"":"s"}.`,why:[stepped?"Section + Berm permits one deliberate step across a single one-level change.":"Placement follows one contour and stops at the first height change; it never adds tiles beyond the authored line."]});return;
      }
      if(inst.effect==="bermRing"){
        const [cx,cy]=inst.aim;const ring=inst.tiles.slice(),ringSet=new Set(ring.map(t=>key(...t)));
        for(const u of Object.values(s.actors).filter(u=>!u.defeated&&ringSet.has(key(u.x,u.y)))){
          const amount=hit(s,a,u,inst,inst.potency*inst.mult,["The heaved berm strikes every unit caught on its ring."],{label:inst.name});
          const dx=Math.sign(cx-u.x),dy=Math.sign(cy-u.y),nx=u.x+dx,ny=u.y+dy;
          if(amount>0&&!u.defeated&&inside(s,nx,ny)&&!unitAt(s,nx,ny)&&(!barrierAt(s,nx,ny)||barrierAt(s,nx,ny).passable)){u.x=nx;u.y=ny;log(s,{kind:"move",actor:a.id,target:u.id,forced:true,tiles:[[nx,ny]],text:`${u.name} is shoved to the centre side of the rising ring.`});}
        }
        for(const [x,y] of ring)if(!barrierAt(s,x,y))s.barriers.push({id:"b"+(++s.seq),owner:a.id,x,y,concept:"berm",protection:0,duration:inst.duration||2,expiresAt:a.ownerTurns+(inst.duration||2),passable:false,blocksMove:true,blocksRoute:true,blocksSight:true,coverFraction:0,heightDelta:1});
        log(s,{kind:"effect",actor:a.id,tiles:ring,text:`Earthen Room rises around (${cx},${cy}); the ${inst.gap||"north"} gap remains open.`,why:["The ring blocks movement, routes and sight except at its committed gap; field deliveries pass over it."]});return;
      }
      if(inst.effect==="crownRaise"){
        let removed=0;const radius=inst.area.radius||3;
        for(let y=0;y<s.arena.h;y++)for(let x=0;x<s.arena.w;x++)if(dist(s,a.x,a.y,x,y)<=radius){const ch=s.arena.map[y][x],obj=s.arena.objects?.find(o=>o.x===x&&o.y===y);
          if(ch==="^"){s.arena.map[y]=s.arena.map[y].slice(0,x)+","+s.arena.map[y].slice(x+1);removed++;}
          if(obj&&["hedge","shrub","groundcover"].includes(obj.form)){if(!obj.crownSuppressed)removed++;obj.crownSuppressed=true;obj.crownSuppressedUntil=a.ownerTurns+(inst.duration||2);}
          const b=barrierAt(s,x,y);if(b&&b.owner!==a.id&&(b.thorns||b.vegetation||b.rooted)){b.thorns=false;b.vegetation=false;b.rooted=false;removed++;}
        }
        a.pf=Math.min(a.maxPF,a.pf+Math.min(4,removed));
        log(s,{kind:"effect",actor:a.id,tiles:inst.tiles,text:`Crown Raise clears plant hazards and suppresses nearby hedge cover for ${inst.duration||2} turns. ${Math.min(4,removed)} ΦF returns as cuttings become mulch.`,why:["Tree trunks remain. The sightline change applies to hedges and shrubs within 3 tiles; non-plant cover remains."]});return;
      }
      if(inst.effect==="tippingPoint"){
        const t=s.actors[inst.targets[0]];if(!t)return;
        t.status.tippingPoint={owner:a.id,potency:inst.potency*inst.mult,expiresAt:t.ownerTurns+3};
        log(s,{kind:"effect",actor:a.id,target:t.id,tiles:[[t.x,t.y]],text:`${t.name} is marked by Tipping Point until they cross below half LF or take three turns.`,why:["This mark is a condition, not an immediate strike. Membrane clears it; a Resonance hit can trigger it early."]});
        if(t.lf<t.maxLF*0.5){const m=t.status.tippingPoint;t.status.tippingPoint=null;hit(s,a,t,{ability:inst.ability,name:inst.name,concept:inst.concept,delivery:inst.delivery,damageType:inst.damageType,tier:inst.tier},m.potency,["The target is already below half LF; the condition triggers immediately."]);}return;
      }
      if (inst.effect === "domain") {
        const radius = (inst.area.radius || 2) + 1;
        const duration = inst.duration || 2;
        const tiles = [];
        for (let dx = -radius; dx <= radius; dx++) for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
          const x = a.x + dx, y = a.y + dy;
          if (!inside(s, x, y) || tileAt(s, x, y).blocksMove || actorAt(s, x, y) || barrierAt(s, x, y)) continue;
          s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x, y, protection: 1000, duration, expiresAt: a.ownerTurns + duration, concept: "boundary" });
          tiles.push([x, y]);
        }
        log(s, { kind: "effect", actor: a.id, tiles, text: `${a.name} closes a Boundary Domain with ${tiles.length} perimeter tiles for ${duration} owner turns.`,
          why: ["The outer ring blocks movement, routed paths, and opposing line deliveries at the occupied tiles; openings or routes around the arena edge remain usable."] });
      }
      if (inst.effect === "barrier") {
        const detailMul = hasTrait(a, "attentionToDetail") ? 1.25 : 1;   // Attention to Detail: sturdier craft
        const dur = inst.duration + (hasTrait(a, "markedGround") && (ab(inst.ability)?.concepts || []).includes("boundary") ? 1 : 0);   // Marked Ground: her Boundary lines hold +1 turn
        if (inst.range === 0) {
          a.status.ward = { label: "Fortress ward", owner: a.id, protection: Math.round(inst.protection * detailMul), expiresAt: a.ownerTurns + dur };
          log(s, { kind: "effect", actor: a.id, text: `${a.name} is warded: absorbs ${a.status.ward.protection} LF damage for ${dur} owner turns.`, why: [`Fortress lens: +protection, no placement range.${detailMul > 1 ? " Attention to Detail ×1.25." : ""}`] });
        } else {
          const [x, y] = inst.tiles[0];
          const wall={ id: "b" + (++s.seq), owner: a.id, x, y, protection: Math.round(inst.protection * detailMul), duration: dur, expiresAt: a.ownerTurns + dur, concept: "barrier", counterFraction: inst.counterFraction };
          const tree=Postures?.resolve({character:a.character,concept:"barrier",ability:inst.ability,event:"wallPlaced",eligible:DIRS.map(([dx,dy])=>({x:x+dx,y:y+dy,tree:inside(s,x+dx,y+dy)&&s.arena.map[y+dy][x+dx]==="T",tpz:inside(s,x+dx,y+dy)&&!!C.tiles[s.arena.map[y+dy][x+dx]]?.tpz}))});
          if(tree){wall.treeBrace=tree.tile;s.treeBraces||=[];s.treeBraces.push({owner:a.id,x:tree.tile[0],y:tree.tile[1],expiresAt:wall.expiresAt});}
          s.barriers.push(wall);
          log(s, { kind: "effect", actor: a.id, tiles: [[x, y]], text: `Shield Wall rises at (${x},${y}): protection ${wall.protection}, ${inst.duration} owner turns.`,
            why: [`${inst.lensName} lens: range ${inst.range}, protection ${inst.protection}, duration ${inst.duration}.${detailMul > 1 ? " Attention to Detail ×1.25." : ""}`, "It blocks movement and routes, and negates opposing line deliveries crossing it."] });
          if(tree) log(s,{kind:"posture",actor:a.id,tiles:[tree.tile,[x,y]],text:tree.log,why:["The brace follows the shared tree edge and expires with this wall; it does not expand the wall's protection area."]});
        }
        return;
      }
      if (inst.effect === "berm" || inst.effect === "swale") {
        const [x, y] = inst.tiles[0];
        const isBerm = inst.effect === "berm";
        s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x, y, protection: 0, duration: inst.duration, expiresAt: a.ownerTurns + inst.duration,
          concept: isBerm ? "berm" : "swale", blocksSight: false, blocksMove: false, blocksRoute: false, passable: isBerm, heightDelta: isBerm ? 1 : 0,
          coverFraction: isBerm ? 0.5 : 0, absorbsLine: !isBerm, returnFraction: isBerm ? 0 : inst.returnFraction });
        log(s, { kind: "effect", actor: a.id, tiles: [[x, y]], text: `${isBerm ? "Berm" : "Bioswale"} is placed at (${x},${y}) for ${inst.duration} owner turns.`,
          why: [isBerm ? "This passable earthwork raises the tile by one level for its duration. Line attacks crossing it lose 50% damage to an adjacent target; elevation also affects movement and line range." : "This shallow basin does not block movement or routes; it absorbs the first opposing line delivery that crosses its tile, then is spent."] });
        if (isBerm && inst.impactPotency > 0) for (const t of Object.values(s.actors).filter(t => !t.defeated && t.side !== a.side && dist(s, t.x, t.y, x, y) <= 1))
          hit(s, a, t, null, inst.impactPotency * inst.mult, [`Scree Face chips opponents beside the new berm; its shortened ${inst.duration}-turn duration is the tradeoff.`], { label: "Scree Face" });
        return;
      }
      if (inst.effect === "valleyFold" || inst.effect === "mountainFold" || inst.effect === "worldSmallEnough") {
        const [x, y] = inst.tiles[0], F = C.concepts.folding.fold, kind = inst.effect;
        if (actorAt(s, x, y) || unitAt(s, x, y)) { log(s, { kind: "effect", actor: a.id, tiles: [[x, y]], text: `The fold refuses (${x},${y}): a crease cannot overlap an occupied surface.` }); return; }
        if (kind === "worldSmallEnough") for (const old of s.barriers.filter((b) => b.owner === a.id && (b.concept === "foldCrossing" || b.concept === "foldPanel")))
          s.barriers = s.barriers.filter((b) => b !== old);   // the compound fold replaces the previous fold
        if (barrierAt(s, x, y)) { log(s, { kind: "effect", actor: a.id, tiles: [[x, y]], text: `The fold refuses (${x},${y}): one crease per tile.` }); return; }
        const foes = Object.values(s.actors).filter((u) => !u.defeated && u.side !== a.side);
        const near = foes.sort((p, q) => dist(s, p.x, p.y, x, y) - dist(s, q.x, q.y, x, y) || (p.id < q.id ? -1 : 1))[0];
        const face = near ? [Math.sign(near.x - x), Math.sign(near.y - y)] : [Math.sign(a.x - x), Math.sign(a.y - y)];
        const compass = [[0, -1, "north"], [1, -1, "northeast"], [1, 0, "east"], [1, 1, "southeast"], [0, 1, "south"], [-1, 1, "southwest"], [-1, 0, "west"], [-1, -1, "northwest"]]
          .find(([dx, dy]) => dx === face[0] && dy === face[1]);
        const faceName = compass ? compass[2] : "north";
        const crossing = kind !== "mountainFold", cover = kind !== "valleyFold";
        s.barriers.push({ id: "b" + (++s.seq), owner: a.id, x, y, protection: kind === "valleyFold" ? F.valleyProtection : kind === "mountainFold" ? F.mountainProtection : F.ultProtection,
          duration: inst.duration || F.duration, expiresAt: a.ownerTurns + (inst.duration || F.duration),
          concept: crossing && !cover ? "foldCrossing" : "foldPanel", blocksSight: false, blocksMove: false, blocksRoute: false, passable: true, linePassable: true,
          coverFraction: cover ? F.cover : 0, foldFacing: cover ? face : null, foldCrossing: crossing });
        log(s, { kind: "effect", actor: a.id, tiles: [[x, y]], text: kind === "valleyFold" ? `${a.name} folds a paper crossing onto (${x},${y}): 1 move point a tile, hazards muffled, for ${inst.duration || F.duration} owner turns.`
          : kind === "mountainFold" ? `${a.name} raises a folded panel at (${x},${y}) facing ${near ? near.name + " (" + faceName + ")" : faceName}: halves line damage from that approach for ${inst.duration || F.duration} owner turns.`
          : `${a.name} folds the world small at (${x},${y}): a crossing and a panel facing ${faceName}, for ${inst.duration || F.duration} owner turns.`,
          why: [crossing && !cover ? "Paper over rough ground: anyone may walk it, enemies included; each crossing wears it." : `One-sided cover: lines crossing from ${faceName} lose half against an adjacent target; every other approach ignores it.`, "Unfolding never moves anyone: actors stay on their tiles when it expires or tears."] });
        return;
      }
      if (inst.effect === "parry") {
        const d = ab(inst.ability);
        a.status.parry = { label: "Rebound (armed)", owner: a.id, catches: d.parry.catches, reflectFraction: d.parry.reflectFraction, expiresAt: a.ownerTurns + 1 };
        log(s, { kind: "effect", actor: a.id, text: `${a.name} arms Rebound until their next turn start. Firing spends the round's reaction.`, why: ["Parry cost is paid when arming; it expires unused at your next turn start."] });
        return;
      }
      if (inst.effect === "craftCare") {
        a.status.care = { label: "Care", owner: a.id, turn: a.ownerTurns };
        log(s, { kind: "effect", actor: a.id, text: `${a.name} measures twice: the next technique this turn will cost ${CRAFT.careAp} more action points and land ×${CRAFT.careMul}.`, why: ["Unused care is lost when the turn ends."] });
        return;
      }
      if (inst.effect === "craftHone") {
        a.practice = { ability: a.lastTechnique, stacks: 1 };
        log(s, { kind: "effect", actor: a.id, text: `${a.name} sets to practising ${ab(a.lastTechnique).name}: practice 1/${CRAFT.maxStacks}.`, why: [`Each use adds a stack (+${Math.round(CRAFT.perStack * 100)}% potency each). Any other technique removes one.`] });
        return;
      }
      if (inst.effect === "holdTone") {
        const T = C.concepts.solfeggio.tones, held = a.status.heldTones;
        const count = Math.min(T.verseMax, (held?.count || 0) + 1);
        a.status.heldTones = { label: "Held tones", owner: a.id, count, expiresAt: a.ownerTurns + (inst.duration || T.holdTurns) };
        log(s, { kind: "effect", actor: a.id, text: `${a.name} holds a tone (${count}/${T.verseMax} verses): living allies within 3 recover ${T.toneHeal} LF at each of their turn starts.`, why: [`Losing life force or moving more than ${T.moveBreak} tiles in a turn breaks every held tone.`] });
        return;
      }
      if (inst.effect === "verseDamage") {
        const T = C.concepts.solfeggio.tones, held = a.status.heldTones?.count || 0;
        const bonus = Math.min(T.verseBonusMax, held * T.verseBonus) - (inst.lens === "drone" ? 2 : 0);
        a.status.heldTones = null;
        const t = s.actors[inst.targets[0]];
        if (!t) { log(s, { kind: "miss", actor: a.id, text: `${a.name} sings to an empty field; the verses are spent.` }); return; }
        hit(s, a, t, inst, (inst.potency + bonus) * inst.mult, [`Resonant Verse: ${held} held tone${held === 1 ? "" : "s"}, +${bonus}. The verses are spent.`]);
        return;
      }
      if (inst.effect === "chordSustain") {
        const T = C.concepts.solfeggio.tones;
        a.status.fullChord = { label: "Full Chord", owner: a.id, expiresAt: a.ownerTurns + (inst.duration || T.chordTurns) };
        log(s, { kind: "effect", actor: a.id, text: `${a.name} sings the Full Chord: for ${inst.duration || T.chordTurns} rounds, living allies within ${T.chordRadius} recover ${T.chordHeal} LF and enemies within ${T.chordRadius} take ${T.chordHurt} Rubedo at each of their turn starts.`, why: ["The chord dies with the singer."] });
        return;
      }
      if (["survey", "verify", "eureka"].includes(inst.effect)) {   // Discovery: rumors, verification, mass reveal
        const F = C.concepts.discovery.finds;
        const trapKey = (t) => `${t.x},${t.y}:${t.ownerSide || "?"}`;
        const trapKnown = (u, t) => !!(u?.trapSeen?.[trapKey(t)]) || t.hidden < 0.4 || t.ownerSide === u?.side;
        const veiled = (u) => !!u && !u.defeated && u.side !== a.side && !!u.status?.concealed && (u.status.concealed.until == null || u.status.concealed.until >= u.ownerTurns);
        const learnTrap = (t) => { H.Observation.recordFact(s,a,{id:`trap:${s.traps.indexOf(t)}:${t.owner}:${t.x},${t.y}`,kind:"trap",index:s.traps.indexOf(t),owner:t.owner,at:[t.x,t.y],text:`Verified trap at (${t.x},${t.y}).`},inst.effect); for (const u of Object.values(s.actors).filter((u) => !u.defeated && u.side === a.side)) { (u.trapSeen ||= {})[trapKey(t)] = true; } };
        const unveil = (u, why) => { H.Observation.recordFact(s,a,{id:`location:${u.id}:${u.x},${u.y}:${s.round}`,kind:"location",subject:u.id,at:[u.x,u.y],text:`${u.name} revealed at (${u.x},${u.y}).`},why); delete u.status.concealed; log(s, { kind: "reveal", actor: a.id, target: u.id, tiles: [[u.x, u.y]], text: `${u.name} is revealed: ${why}.` }); };
        if (inst.effect === "survey") {
          const cands = [];
          for (const t of (s.traps || []).filter((t) => !t.spent && t.ownerSide !== a.side && !trapKnown(a, t) && dist(s, a.x, a.y, t.x, t.y) <= F.surveyRange))
            cands.push({ tile: [t.x, t.y], claimed: "trap", d: dist(s, a.x, a.y, t.x, t.y) });
          for (const u of Object.values(s.actors).filter((u) => veiled(u) && dist(s, a.x, a.y, u.x, u.y) <= F.surveyRange))
            cands.push({ tile: [u.x, u.y], claimed: "movement", d: dist(s, a.x, a.y, u.x, u.y) });
          if (!cands.length) { log(s, { kind: "effect", actor: a.id, text: `${a.name} surveys: nothing stirs within ${F.surveyRange}.`, why: ["No hidden traps or concealed enemies in range; the survey fizzles."] }); return; }
          cands.sort((p, q) => p.d - q.d);
          const n = (s.rumors || []).length, truth = seededChance(`${s.seed}:rumor:${a.id}:${s.round}:${n}`) >= F.rumorFalse;
          let tile = cands[0].tile, claimed = cands[0].claimed;
          if (!truth) {   // a false rumor points at an empty tile, never at a real find (nor your own feet: targeting refuses it)
            const busy = new Set(cands.map((c) => c.tile.join(",")));
            busy.add(`${a.x},${a.y}`);
            const empty = [];
            for (let y = 0; y < s.arena.h && empty.length < 24; y++) for (let x = 0; x < s.arena.w && empty.length < 24; x++)
              if (dist(s, a.x, a.y, x, y) <= F.surveyRange && !busy.has(`${x},${y}`)) empty.push([x, y]);
            if (empty.length) { tile = empty[Math.floor(seededChance(`${s.seed}:rumor-tile:${a.id}:${s.round}:${n}`) * empty.length)]; claimed = seededChance(`${s.seed}:rumor-kind:${a.id}:${s.round}:${n}`) < 0.5 ? "trap" : "movement"; }
          }
          (s.rumors ||= []).push({ id: `rumor-${a.id}-${s.round}-${n}`, tile, claimed, truth, expiresRound: s.round + F.rumorRounds, ownerSide: a.side });
          log(s, { kind: "rumor", actor: a.id, tiles: [tile], text: `${a.name} surveys: rumor of ${claimed === "trap" ? "something buried" : "something moving"} at (${tile[0]},${tile[1]}).`, why: [`${Math.round(F.rumorFalse * 100)}% of rumors point at nothing; Verify resolves it. Fades in ${F.rumorRounds} rounds.`] });
          return;
        }
        if (inst.effect === "verify") {
          const [tx, ty] = inst.tiles[0];
          const i = (s.rumors || []).findIndex((r) => r.ownerSide === a.side && r.tile[0] === tx && r.tile[1] === ty && r.expiresRound > s.round);
          if (i < 0) { log(s, { kind: "effect", actor: a.id, tiles: [[tx, ty]], text: `${a.name} verifies (${tx},${ty}): no live rumor of theirs there.`, why: ["Rumors fade after 2 rounds; each side verifies its own."] }); return; }
          const [r] = s.rumors.splice(i, 1);
          if (!r.truth) { log(s, { kind: "verify", actor: a.id, tiles: [[tx, ty]], text: `${a.name} verifies (${tx},${ty}): a dead end. Nothing was ever there.`, why: ["False rumors clear; the field keeps its secrets."] }); return; }
          const found = [];
          for (const t of (s.traps || []).filter((t) => !t.spent && t.x === tx && t.y === ty && t.ownerSide !== a.side)) { learnTrap(t); found.push("a buried trap, now known to your whole side"); }
          for (const u of Object.values(s.actors).filter((u) => veiled(u) && u.x === tx && u.y === ty)) { unveil(u, "verified"); found.push(`${u.name}, revealed`); }
          if(found.length)H.scoutNoted(s,a,`verified:${tx},${ty}`);
          log(s, { kind: "verify", actor: a.id, tiles: [[tx, ty]], text: `${a.name} verifies (${tx},${ty}): ${found.length ? `true — ${found.join("; ")}.` : "true once, but the find moved on."}`, why: ["Verified finds become usable; the concealed may still have moved."] });
          return;
        }
        {   // eureka: mass reveal + 8 albedo per revealed enemy; your own cover goes too
          const revealed = [];
          for (const t of (s.traps || []).filter((t) => !t.spent && t.ownerSide !== a.side && dist(s, a.x, a.y, t.x, t.y) <= F.eurekaRadius)) { learnTrap(t); }
          for (const u of Object.values(s.actors).filter((u) => veiled(u) && dist(s, a.x, a.y, u.x, u.y) <= F.eurekaRadius)) {
            unveil(u, "eureka");
            hit(s, a, u, inst, F.eurekaDamage * (inst.mult || 1), ["Eureka: every revealed enemy takes 8 Albedo."]);
            revealed.push(u.name);
          }
          if (a.status?.concealed) delete a.status.concealed;
          log(s, { kind: "reveal", actor: a.id, text: `${a.name} shouts Eureka: everything hidden within ${F.eurekaRadius} stands revealed${revealed.length ? ` (${revealed.join(", ")})` : " (traps only)"}.`, why: ["Total survey costs total exposure: your own concealment breaks too."] });
          return;
        }
      }
      if (inst.effect === "recombine") {   // Innovation: each part re-resolves through the normal damage path (cover, barriers, channels all apply), at the copying tax
        const t = s.actors[inst.targets[0]] || (s.wild || []).find((w) => w.id === inst.targets[0]);
        if (!t || t.defeated) return;   // the target left play between targeting and resolution: the fusion fizzles
        log(s, { kind: "effect", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${a.name} recombines ${(inst.recombineHits || []).map((h) => h.name).join(" + ")} onto ${t.name}: one action, two origins, each at ×${inst.recombineTax || 0.7}.` });
        for (const h of inst.recombineHits || []) {
          if (t.defeated) break;   // the first origin may finish it; the second finds no target
          resolveAbility(s, a, { ...inst, effect: "damage", potency: h.potency, damageType: h.damageType, name: `${inst.name} (${h.name})`, recombinePart: h.name });
        }
        return;
      }
      if (inst.effect === "whatIf") {   // Innovation: the kit unfixes for 2 rounds (announced at commit)
        const T = C.concepts.innovation.copy;
        a.status.whatIf = { untilRound: s.round + T.whatIfRounds - 1 };
        log(s, { kind: "effect", actor: a.id, text: `${a.name} asks What If: for ${T.whatIfRounds} rounds, every basic may be played as any other basic they know.`, why: ["The kit is a draft; the enemy sees the pool too."] });
        return;
      }
      if (inst.effect === "membrane") {
        const t = s.actors[inst.targets[0]];
        if (!t) return;   // the target left play between targeting and resolution: the wrap fizzles
        t.status.membrane = { label: "Membrane", owner: a.id, expiresAt: a.ownerTurns + 1 };
        log(s, { kind: "effect", actor: a.id, target: t.id, text: `${t.name} is wrapped in a Membrane until ${a.name}'s next turn start.` });
        return;
      }
      if (inst.effect === "anchor") {
        const duration = inst.duration || 1;
        a.status.anchor = { label: "Anchor", owner: a.id, expiresAt: a.ownerTurns + duration, counterforce: inst.counterforce };
        log(s, { kind: "effect", actor: a.id, text: `${a.name} anchors their position for ${duration} owner turn${duration === 1 ? "" : "s"}.`, why: ["The next forced displacement is cancelled; LF damage is not reduced."] });
        if(a.character==="soldier"){
          const threats=Object.values(s.actors).filter(t=>!t.defeated&&t.side!==a.side).sort((u,v)=>dist(s,a.x,a.y,u.x,u.y)-dist(s,a.x,a.y,v.x,v.y));
          const threat=threats[0]; if(threat){let dx=Math.sign(threat.x-a.x),dy=Math.sign(threat.y-a.y);if(Math.abs(threat.x-a.x)>=Math.abs(threat.y-a.y))dy=0;else dx=0;
            const ally=Object.values(s.actors).find(t=>!t.defeated&&t.id!==a.id&&t.side===a.side&&t.x===a.x-dx&&t.y===a.y-dy);
            const covered=Postures?.resolve({character:a.character,concept:"inertia",ability:inst.ability,event:"anchorResolved",eligible:ally?[{id:ally.id,name:ally.name,ally:true,behind:true}]:[]});
            if(covered){ally.status.anchor={label:"Soldier cover",owner:a.id,expiresAt:a.ownerTurns+duration};log(s,{kind:"posture",actor:a.id,target:ally.id,text:covered.log,why:["The covered ally resists one forced displacement; incoming LF damage still applies."]});}
          }
        }
        return;
      }
      if (inst.ability === "restoreTheWorkingOrder") {
        const bin = (s.arena.objects || []).find(o => o.role === "service-receptacle" || o.evidenceId === "receptacle");
        const item = bin?.stored?.[0], [x, y] = inst.aim || [];
        if (item?.kind === "filth" && !tileAt(s, x, y).blocksMove && !actorAt(s, x, y) && !barrierAt(s, x, y)) {
          bin.stored.shift(); MaidSystems.addFilth(s, x, y, item.amount || 1);
          log(s, { kind: "effect", actor: a.id, tiles: [[x, y]], text: `${a.name} restores battle residue to (${x},${y}); crossing costs +${(item.amount || 1) * 10} AP.`, why: ["Restore returns the first stored item to the selected open tile."] });
          return;
        }
      }
      if (inst.ability === "clearTheObstruction" && MaidSystems?.canClean(s, a, ...(inst.aim || []))) {
        const [x, y] = inst.aim, cleaned = MaidSystems.clean(s, a, x, y);
        if (cleaned) {
          log(s, { kind: "effect", actor: a.id, tiles: [[x, y]], text: `${a.name} clears one layer of battle residue at (${x},${y}); crossing costs ${cleaned.after * 10} AP less.`, why: [cleaned.metabolized ? "Service Cycle consumes the residue directly instead of filling the service receptacle; the successful utility action restores ultimate charge." : "The residue is transferred into one slot of the three-slot service receptacle.", cleaned.maintained ? "The tile is now maintained; the Maid's next eligible operation there costs 10 fewer AP." : "Another residue layer remains; the tile is not yet maintained."] });
          return;
        }
      }
      if (inst.ability === "restoreTheWorkingOrder" && inst.aim && MaidSystems)
        MaidSystems.invalidateMaintenance(s, inst.aim[0], inst.aim[1]);
      if (inst.effect === "fruit") { H.fruitResolve?.(s, a, inst); return; }   // Sinkerfruit techniques (engine/fruit.js)
      if (ClassRuntime && inst.effect === "classEffect") { ClassRuntime.resolve(s, a, inst, classH()); return; }   // ClassRuntime
      if (inst.effect === "hexScreen") {   // the Cyborg form's ward (docs/brain-chip.md): replaced, never added to
        const reach = ab(inst.ability).radius || 1, held = Object.values(s.actors).filter((u) => !u.defeated && u.side === a.side && dist(s, a.x, a.y, u.x, u.y) <= reach);
        for (const u of held) u.status.ward = { label: "Hex Screen", owner: a.id, protection: inst.protection, expiresAt: a.ownerTurns + 1 };
        log(s, { kind: "effect", actor: a.id, tiles: held.map((u) => [u.x, u.y]), text: `${a.name} raises a Hex Screen over ${held.map((u) => u.name).join(", ")}: ${inst.protection} points each until ${a.name}'s next turn.`,
          why: ["A second cast replaces the ward. Hitting through it, or waiting for his next turn, spends it."] });
        return;
      }
      if (inst.effect === "guard") {
        const type = a.lastDamageType;
        const duration = inst.duration || 1, multiplier = inst.guardMultiplier || 0.5;
        a.status.guard = { label: "Adaptive Brace", owner: a.id, expiresAt: a.ownerTurns + duration, damageType: type, multiplier };
        log(s, { kind: "effect", actor: a.id, damageType: type, text: `${a.name} attunes Adaptive Brace to ${C.damageTypes[type]?.name || type} for ${duration} owner turn${duration === 1 ? "" : "s"}.`, why: [`After observing the last incoming attack, matching-channel damage is multiplied by ${multiplier}; other harm channels pass normally.`] });
        return;
      }
      if (inst.timing === "delayed" || ab(inst.ability).timing === "delayed") {
        const t = inst.targets.map(id=>s.actors[id]).find(t=>t&&!t.defeated&&!t.notArrived);
        if (!t) { log(s,{kind:"scheduleCancelled",actor:a.id,ability:inst.ability,text:`${inst.name} has no living turn-start target; the delayed commitment ends.`});return; }
        const decoy = H.Exposure.decoy(s, a, inst);   // Exposure: a liar's threshold. The decoy is queued first, so it lands first.
        if (decoy) { schedule(s, { owner: a.id, trigger: { type: "turnStart", actor: t.id }, inst: { ...inst, decoy: true, potency: 0 } }); inst = { ...inst, follow: t.id };
          log(s, { kind: "exposure", exposure: "decoy", placed: true, actor: a.id, target: t.id, text: `${a.name} has lied once and marked twice. This time there are two marks, and one of them is nothing.`, why: ["The decoy lands first, on the tile. The real strike follows the body.", "Guard answers both. A dodge answers only the decoy. Observing him removes it."] }); }
        schedule(s, { owner: a.id, trigger: { type: "turnStart", actor: t.id }, inst });
        log(s, { kind: "schedule", actor: a.id, tiles: inst.tiles, text: `${inst.name} is committed on (${inst.tiles.map((p) => p.join(",")).join(") (")}). It lands at the start of ${t.name}'s next turn.`,
          why: ["Delayed: resolves on a committed future event (target turn start), before that turn's expiries, so a Guard raised now still counts."] });
        return;
      }
      // damage deliveries
      if (inst.delivery === "line") {
        const pts = line(a.x, a.y, inst.aim[0], inst.aim[1]);
        const sectionEdge=findOpp("section","boundary","bypasses",null,"seeThroughOnCut");
        const sightOnCut=(s.terrainEffects||[]).some(e=>e.kind==="sectionCut"&&e.side===a.side&&s.actors[e.owner]?.ownerTurns<e.expiresAt&&(e.axis==="row"?a.y===inst.aim[1]&&inst.aim[1]===e.index:a.x===inst.aim[0]&&inst.aim[0]===e.index));
        if(sectionEdge&&sightOnCut&&pts.slice(1,-1).some(([x,y])=>barrierAt(s,x,y)?.blocksSight))edgeUsed(s,sectionEdge.id);
        const stop = lineStop(s, a, pts);
        const reach = stop >= 0 ? pts.slice(1, stop) : pts.slice(1);
        const lineArea = inst.area.shape === "line" ? areaRecipients(s, a, inst, reach, true) : null;
        const hitTargets = lineArea ? lineArea.targets
          : opponentsOn(s, a, reach, true).filter((t) => H.coversTile(t, inst.aim[0], inst.aim[1]));   // any tile of a big unit is that unit
        let focusIgnoreAt=null,focusEdge=null,focusWhy=[];
        if(inst.concept==="sightline"&&inst.area.shape==="single"&&a.focus?.coverReady&&hitTargets.some(t=>t.id===a.focus.target)){
          const ft=hitTargets.find(t=>t.id===a.focus.target),targetIndex=pts.findIndex(([x,y])=>x===ft.x&&y===ft.y);
          const sources=pts.slice(1,targetIndex).map(([x,y])=>{
            const b=barrierAt(s,x,y),o=s.arena.objects?.find(o=>o.x===x&&o.y===y);
            const tileCover=o?o.cover||0:tileAt(s,x,y).cover||0;
            const fraction=Math.max(tileCover,b?.coverFraction||0);
            return {at:[x,y],fraction,name:b?.concept==="berm"?"Berm":o?.type||tileAt(s,x,y).name,object:o};
          }).filter(c=>c.fraction>0&&c.fraction<1&&dist(s,c.at[0],c.at[1],ft.x,ft.y)===1);
          if(sources.length&&heightAt(s,ft.x,ft.y)<2){focusIgnoreAt=sources[sources.length-1].at;focusEdge=findOpp("focus","sightline","enhances","line","ignorePartialCoverOnce");a.focus.coverReady=false;
            if(focusEdge)edgeUsed(s,focusEdge.id);focusWhy.push(`Focus attends ${ft.name} and ignores one adjacent ${sources[sources.length-1].name} source, then spends that observation${focusEdge?` [${focusEdge.id}]`:""}.`);}
        }
        let terrainPotency = inst.potency * inst.mult;
        if (vegetation && s.arena.objects?.length) {
          const r = vegetation.lineImpact(moduleArena(s.arena), [a.x,a.y], inst.aim, terrainPotency, { from: [a.x,a.y], channel: inst.damageType, damageMul: a.passives?.objectDamageMul || 1, destructive: !!inst.destructive, ignoreCover:!!inst.ignoreCover, ignoreCoverAt: focusIgnoreAt, skipIds: inst.skipIds });
          s.arena = engineArena(r.arena); terrainPotency = r.potency;
          applyTerrainEvents(s, a, r.events);
        }
        // pierce hits in order along the line; then a barrier (if any) negates the remainder
        if (hitTargets.length > 1) s.stats.multiHits += 1;
        for (const t of hitTargets) {
          const index = Math.max(1, pts.findIndex(([x, y]) => H.coversTile(t, x, y)));   // cover counts up to the first tile of the unit the line meets
          const cover = inst.ignoreCover || heightAt(s, t.x, t.y) >= 2 ? [] : pts.slice(1, index).map(([x, y]) => {
            const b = barrierAt(s, x, y), objectInTile = s.arena.objects?.some((o) => o.x === x && o.y === y);
            // Dynamic vegetation/furniture already attenuated this line in lineImpact().
            const tileCover = objectInTile ? 0 : (tileAt(s, x, y).cover || 0);
            const faced = !b?.foldFacing || (Math.sign(a.x - x) === b.foldFacing[0] && Math.sign(a.y - y) === b.foldFacing[1]);   // Folding: one-sided cover
            const bf = faced ? (b?.coverFraction || 0) : 0;
            return { at: [x, y], fraction: Math.max(tileCover, bf), name: b?.concept === "foldPanel" ? "folded panel" : b?.concept === "berm" ? "Berm" : tileAt(s, x, y).name, fold: b?.foldFacing && faced && bf > 0 ? b : null };
          }).filter((c) => c.fraction > 0 && dist(s, c.at[0], c.at[1], t.x, t.y) === 1 && !(focusIgnoreAt&&focusIgnoreAt[0]===c.at[0]&&focusIgnoreAt[1]===c.at[1]));
          const brace=(s.pruneBraces||[]).find(b=>!b.used&&t.side===s.actors[b.owner]?.side&&a.side!==t.side&&dist(s,b.x,b.y,t.x,t.y)===1&&s.actors[b.owner]?.ownerTurns<b.expiresAt);
          if(brace){cover.push({at:[brace.x,brace.y],fraction:0.5,name:"Arborist's cut brace"});brace.used=true;}
          // Rushed walls on the line (reactive defense): each catches its share wherever it stands, and a deflecting pairing
          // (Barrier + Elasticity) returns its fraction of what the wall caught.
          const rushedWalls = pts.slice(1, index).map(([x, y]) => barrierAt(s, x, y)).filter((b) => b?.rushed && s.actors[b.owner] && s.actors[b.owner].side !== a.side);
          for (const b of rushedWalls) cover.push({ at: [b.x, b.y], fraction: b.rushed, name: "rushed Shield Wall", wall: b });
          const pierced = cover.length && ClassRuntime?.Martial?.piercingRead?.(s, a);
          const coverFactor = pierced ? 1 : cover.reduce((factor, c) => factor * (1 - c.fraction), 1);
          const coverWhy = cover.length ? [`Partial cover reduces this line hit by ${Math.round((1 - coverFactor) * 100)}% (${cover.map((c) => c.name).join(" + ")}).`] : [];
          const dealt = strikeTarget(s, a, t, inst, terrainPotency * coverFactor, why.concat(lineArea?.why || [],focusWhy,coverWhy));
          for (const c of cover.filter((c) => c.wall)) { const own = s.actors[c.wall.owner], comp = H.compositionEdge(own), dfl = comp?.op.kind === "enableEdge" ? C.opposition.find((e) => e.id === comp.op.edge) : null;
            const caught = terrainPotency * c.fraction; c.wall.protection -= caught; if (c.wall.protection <= 0) s.barriers = s.barriers.filter((x) => x !== c.wall);
            if (dfl?.op.fraction && !own.defeated && !a.defeated) hit(s, own, a, null, caught * dfl.op.fraction * (1 - (H.shooterCover?.(s, a, t.x, t.y) || 0)), [`The ${conceptName(own.primary)} + ${conceptName(own.secondary)} composition returns ${Math.round(dfl.op.fraction * 100)}% of what the rushed wall caught [${comp.id}].`], { label: `Deflected ${inst.name}`, edge: comp.op.edge, damageType: inst.damageType }); }
          for (const c of cover.filter((c) => c.fold)) {   // Folding: cover wears the paper; Resonance shakes it apart
            const shake = inst.concept === "resonance" ? 2 : 1, wear = terrainPotency * c.fraction * shake;
            const damp = findOpp("folding", "sightline", "dampens", "line"), tremor = shake === 2 ? findOpp("resonance", "folding", "disrupts") : null;
            c.fold.protection -= wear; if (damp) edgeUsed(s, damp.id); if (tremor) edgeUsed(s, tremor.id);
            if (c.fold.protection <= 0) { s.barriers = s.barriers.filter((x) => x !== c.fold);
              log(s, { kind: "effect", actor: a.id, tiles: [c.at], text: `The folded panel at (${c.at[0]},${c.at[1]}) tears under the line${shake === 2 ? "; Resonance shakes paper apart" : ""}.${damp ? ` [${damp.id}]` : ""}`, why: ["Cover wears paper: each softened line chips the panel.", ...(tremor ? [`A resonant line chips double [${tremor.id}].`] : [])] }); }
          }
          if(inst.ability==="surveyShot"&&dealt>0&&insightRules&&s.insight.decks[t.id]){
            const bySubject=s.insight.knowledge.player||(s.insight.knowledge.player={});const know=bySubject[t.id]||insightRules.spawnKnowledge(s.insight.decks[t.id]);
            const result=insightRules.observe({deck:s.insight.decks[t.id],know,cognitive:s.insight.cognitive,subjectKey:t.id,invest:10,inDreamSpace:!!s.dreamSpace,seed:s.seed+s.round,seesSpirits:insightRules.seesSpirits(a)});
            if(!result.error){bySubject[t.id]=result.know;s.insight.cognitive=result.cognitive;log(s,{kind:"observe",actor:a.id,target:t.id,text:`Survey Shot observation (free 10 AP): ${result.lines.join(" ")}`,why:["A successful measured hit grants one 10-AP observation investment without spending tempo."]});}
          }
          if(inst.ability==="sympatheticChord"&&dealt>0){for(const echo of Object.values(s.actors).filter(v=>!v.defeated&&v.side!==a.side&&v.id!==t.id&&dist(s,t.x,t.y,v.x,v.y)<=4&&C.conceptDamageTypes[v.primary]===inst.damageType)){hit(s,a,echo,inst,inst.potency*inst.mult*0.5,[`Sympathetic Chord echoes from ${t.name}; ${echo.name}'s primary channel matches ${C.damageTypes[inst.damageType]?.name||inst.damageType}.`],{label:"Sympathetic Chord"});}}
          if (inst.knockback && !t.defeated && !s.outcome) knock(s, a, t, inst.knockback, inst, "push");
          if (inst.pull && !t.defeated && !s.outcome) knock(s, a, t, inst.pull, inst, "pull");
          if (inst.seedLodge && dealt > 0) lodgeSeeds(s, a, t, inst);
          if (inst.seedThorn && dealt > 0 && seedThorn(s, a, t.x, t.y, inst.seedThorn)) log(s, { kind: "effect", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${inst.seedThorn.label || "Thorns"} spring up where ${inst.name} struck (${t.x},${t.y}).`, why: [`Entering the tile deals ${inst.seedThorn.dmg}.`] });
          { const fr = ab(inst.ability)?.formRider; if (fr && bossRules?.formRider && !s.outcome) { const fc = H.formCtx(s, a, t); fc.leapt = !!inst.formLeapt; bossRules.formRider(a, t, fr, fc); inst.formLeapt = fc.leapt; } }   // learned forms
        }
        if (inst.ability==="longView"){
          a.status.rangeBuff={owner:a.id,amount:2,expiresAt:a.ownerTurns+2};a.status.exposed={owner:a.id,expiresAt:a.ownerTurns+1};a.status.lockMove={owner:a.id,expiresAt:a.ownerTurns+1};
          log(s,{kind:"effect",actor:a.id,text:`${a.name} holds Long View: line range +2 for two turns, but cannot move this turn and is exposed until next turn.`,why:["The committed shot ignored partial cover; opaque barriers still stop it."]});
        }
        if (stop >= 0 && !s.outcome && barrierAt(s,pts[stop][0],pts[stop][1])) negateAtBarrier(s, a, inst, barrierAt(s, pts[stop][0], pts[stop][1]), terrainPotency);
        { const fr = ab(inst.ability)?.formRider; if (fr && bossRules?.formCastRider && !s.outcome) bossRules.formCastRider(a, fr, H.formCtx(s, a), stop >= 0 ? pts.slice(0, stop + 1) : pts); }   // learned forms: Ember Breath lights its line
        settleDeferredCharge(s, a, inst, hitTargets.length);
        applyTerrainDamage(s, a, inst);
        return;
      }
      if(inst.ability==="concentrationGradient"){
        const recipients=areaRecipients(s,a,inst,inst.tiles,true);
        let gradientStruck = 0;
        for(const t of recipients.targets){const d=dist(s,a.x,a.y,t.x,t.y),factor=d===1?1:d===2?0.4:0;if(!factor)continue;gradientStruck++;strikeTarget(s,a,t,inst,inst.potency*inst.mult*factor,why.concat(recipients.why,[`Gradient distance ${d}: potency ×${factor}.`]));if(d===1&&!t.defeated)knock(s,a,t,1,inst,"push");}
        settleDeferredCharge(s, a, inst, gradientStruck);
        applyTerrainDamage(s,a,inst);return;
      }
      if (inst.delivery === "routed") {
        // The bypass edge applies only when a barrier actually sits on the direct route.
        const e = s.barriers.length ? findOpp("pathway", "barrier", "bypasses", "routed", "routeAround") : null;
        const direct = e && paths(s, a.x, a.y, 99, "route-open", inst.aim).pathTo(...inst.aim);
        const wall = (b) => b && !b.passable && !b.passiveGround && s.actors[b.owner] && s.actors[b.owner].side !== a.side;
        const crossed = direct ? direct.filter(([x, y]) => wall(barrierAt(s, x, y))) : [];
        // Exposure (Grok's sample 10): the wall is usually raised against a straight shot, not across the floor. When an
        // enemy wall stands on the straight line to the target and the route still arrives, that is the same meeting.
        const sight = e && s.rules.exposure?.bypass?.line && !crossed.length && inst.aim ? H.line(a.x, a.y, inst.aim[0], inst.aim[1]).find(([x, y]) => wall(barrierAt(s, x, y))) : null;
        if (sight) { edgeUsed(s, e.id); why.push(`A wall at (${sight.join(",")}) stands on the straight line; the route does not need the line (${inst.route.length - 1} tiles) [${e.id}]. The wall stays up.`); }
        if (crossed.length) { edgeUsed(s, e.id); why.push(`The shortest route crosses a wall at (${crossed[0].join(",")}); this one goes around it (${direct.length - 1} → ${inst.route.length - 1} tiles) [${e.id}]. The wall stays up.`); }
        const thornTiles = (inst.route || []).filter(([x, y]) => (s.terrainEffects || []).some(e => e.kind === "thorn" && e.tiles?.some(([tx, ty]) => tx === x && ty === y) && s.actors[e.owner]?.ownerTurns < e.expiresAt && s.actors[e.owner]?.side !== a.side));
        if (thornTiles.length) { const te = findOpp("thorn", "pathway", "taxes", null, "thornTax"); if (te) { edgeUsed(s, te.id); why.push(`Thorns choke the route at (${thornTiles[0].join(",")})${thornTiles.length > 1 ? ` and ${thornTiles.length - 1} more` : ""}: +${thornTiles.length} budget spent [${te.id}].`); } }
        why.push(`Route length ${inst.route.length - 1} of ${inst.routeBudget}.`);
      }
      const recipients = areaRecipients(s, a, inst, inst.tiles, true);
      const targets = recipients.targets;
      if (targets.length > 1) s.stats.multiHits += 1;
      if (!targets.length) log(s, { kind: "miss", actor: a.id, text: `${inst.name} hits no one.`, why: ["Nobody stands on the committed tiles."] });
      for (const t of targets) {
        const lfBefore = t.lf;
        const splash = splashMult(t, inst);
        strikeTarget(s, a, t, inst, inst.potency * inst.mult * splash.mult, splash.why ? why.concat(recipients.why, [splash.why]) : why.concat(recipients.why));
        if (inst.seedLodge && t.lf < lfBefore) lodgeSeeds(s, a, t, inst);
        if (inst.seedThorn && t.lf < lfBefore && seedThorn(s, a, t.x, t.y, inst.seedThorn)) log(s, { kind: "effect", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${inst.seedThorn.label || "Thorns"} spring up where ${inst.name} struck (${t.x},${t.y}).`, why: [`Entering the tile deals ${inst.seedThorn.dmg}.`] });
        if (inst.knockback && !t.defeated && !s.outcome) knock(s, a, t, inst.knockback, inst, "push");
        if (inst.pull && !t.defeated && !s.outcome) knock(s, a, t, inst.pull, inst, "pull");
        { const fr = ab(inst.ability)?.formRider; if (fr && bossRules?.formRider && !s.outcome) { const fc = H.formCtx(s, a, t); fc.leapt = !!inst.formLeapt; bossRules.formRider(a, t, fr, fc); inst.formLeapt = fc.leapt; } }   // learned forms
      }
      { const fr = ab(inst.ability)?.formRider; if (fr && bossRules?.formCastRider && !s.outcome) bossRules.formCastRider(a, fr, H.formCtx(s, a), inst.tiles || []); }
      settleDeferredCharge(s, a, inst, targets.length);
      applyTerrainDamage(s, a, inst);
    }

    // Large-footprint splash (Mala ruling): a blast catching N footprint tiles hits ×(1+0.25N),
    // capped at ×1.5. One tile = 1x, two = 1.25x, three or more = 1.5x. Blast-only: lines, singles,
    // routed and aura ticks never splash. Single log line names the bonus.
    function splashMult(t, inst) {
      const blast = inst.delivery === "field" || ["radius", "plus", "board", "cone"].includes(inst.area?.shape);
      if (!blast || !inst.tiles || !inst.tiles.length) return { mult: 1, why: null };
      const set = new Set(inst.tiles.map(([x, y]) => x + "," + y));
      const n = footprint(t).filter(([x, y]) => set.has(x + "," + y)).length;
      if (n <= 1) return { mult: 1, why: null };
      const mult = Math.min(1.5, 1 + 0.25 * n);
      return { mult, why: `Splash ×${mult.toFixed(2)}: ${n} tiles caught.` };
    }
    function moduleArena(arena) {
      return { ...clone(arena), height: (arena.height || []).map((row) => row.join("")) };
    }
    function engineArena(arena) {
      return { ...arena, height: (arena.height || []).map((row) => typeof row === "string" ? Array.from(row, Number) : row) };
    }
    // A Strike on one object (actions.js strike hits anything on the map). ClassRuntime.objectDamagePlan splits
    // the hit first (spans, shores, load paths, stood-beside safety): one plan, then each share lands through the
    // same path a lone hit always took. The vegetation module does the damage and says what happened; without it
    // (an engine wired with no terrain) the hit is applied plainly.
    function strikeObject(s, source, obj, potency, damageType = "nigredo") {
      const plan = ClassRuntime?.objectDamagePlan ? ClassRuntime.objectDamagePlan(s, source, obj, potency, damageType, classH()) : null;
      const jobs = plan?.hits?.length ? plan.hits : [{ id: obj.id, potency }];
      for (const n of plan?.notes || []) log(s, { kind: "effect", actor: source.id, text: n.text, why: n.why || [] });
      if (vegetation) {
        let arena = moduleArena(s.arena); const events = [];
        for (const j of jobs) { if (!arena.objects.some((p) => p.id === j.id)) continue;
          const r = vegetation.attackObject(arena, j.id, j.potency, { from: [source.x, source.y], channel: damageType, damageMul: source.passives?.objectDamageMul || 1 });
          arena = r.arena; events.push(...r.events); }
        s.arena = engineArena(arena); applyTerrainEvents(s, source, events);
      } else {
        const events = [];
        for (const j of jobs) { const o = s.arena.objects.find((p) => p.id === j.id); if (!o) continue; const dmg = Math.round(j.potency); o.hp = Math.max(0, o.hp - dmg);
          events.push({ kind: "damage", id: o.id, amount: dmg, text: `${o.name || o.type} takes ${dmg} (${o.hp}/${o.maxHp}).` });
          if (o.hp === 0) { s.arena.objects = s.arena.objects.filter((p) => p.id !== o.id); events.push({ kind: "destroyed", id: o.id, type: o.type, role: o.role || null, at: [o.x, o.y], text: `${o.name || o.type} is destroyed.` }); } }
        applyTerrainEvents(s, source, events);
      }
      for (const sp of plan?.spill || []) { const u = s.actors[sp.id]; if (u && !u.defeated) hit(s, source, u, null, sp.amount, sp.why || ["Shored: the next load splits with the Engineer."], { label: "Shored load", damageType: "nigredo" }); }
      if (plan?.collapse) s.terrainEffects = (s.terrainEffects || []).filter((e) => e.id !== plan.collapse);
    }
    const PLANT_TYPES = ["tree", "hedge", "shrub", "groundcover"];
    function applyTerrainEvents(s, source, events = []) {
      for (const ev of events) {
        if (s.heartCourt && (ev.kind === "damage" || ev.kind === "destroyed")) {
          const heartId = s.heartCourt.heart?.id;
          const live = ev.kind === "damage" ? (s.arena.objects || []).find((q) => q.id === ev.id) : null;
          const isHeart = ev.id === heartId || live?.kind === "heart" || live?.type === "heart" || ev.type === "heart";
          if (isHeart) {
            if (ev.kind === "damage" && source) H.landWound(s, source, "heartHit", 1, ev.at ? [ev.at] : (live ? [[live.x, live.y]] : undefined));
            H.courtHeartHit?.(s, source);
          } else if (ev.kind === "destroyed") H.courtFoundationFell?.(s, ev.id);
        }
        // The land's wounds (engine/land.js): plants hit and destroyed, a felled tree most of all.
        if (source && (ev.kind === "damage" || ev.kind === "destroyed")) {
          const o = ev.kind === "damage" ? (s.arena.objects || []).find(q => q.id === ev.id) : ev;
          const plant = o && (o.kind === "plant" || PLANT_TYPES.includes(o.type));
          if (plant) H.landWound(s, source, ev.kind === "damage" ? "plantHit" : o.type === "tree" ? "treeFelled" : "plantDestroyed", 1, ev.at ? [ev.at] : undefined);
          if (plant && ev.kind === "destroyed") { const dr = (s.dreamRecent ||= {}); dr.plantsDestroyed = (dr.plantsDestroyed || 0) + 1; }   // ambient dreams count the fallen green
        }
        if (ev.kind === "bridgeCollapse") (s.dreamRecent ||= {}).bridgeCollapse = true;   // ambient dreams hear the bridge go
        if (ev.text) log(s, { kind: "terrain", actor: source.id, tiles: ev.at ? [ev.at] : undefined, text: ev.text });
        if (source && ev.kind === "damage" && ev.id === "house") H.houseHarmed?.(s, source, ev);   // property rights (engine/houses.js)
        const fixture = ev.kind === "damage" ? (s.arena.objects || []).find(o => o.id === ev.id) : null;
        const grimeAt = ev.at || (fixture ? [fixture.x, fixture.y] : null);
        if (MaidSystems && grimeAt && ["damage", "damaged", "destroyed"].includes(ev.kind)) {
          const added = MaidSystems.addFilth(s, grimeAt[0], grimeAt[1], 1);
          if (added) log(s, { kind: "terrain", actor: source.id, tiles: [grimeAt], text: `Impact leaves battle residue on (${grimeAt.join(",")}); crossing it costs +${added * 10} AP until it is cleaned.` });
        }
        if (ev.at) { const unit = actorAt(s, ev.at[0], ev.at[1]); if (unit) refreshDrowning(s, unit, "water opens beneath them"); }
        if (ev.kind === "destroyed" && (ev.role === "service-receptacle" || ev.evidenceId === "receptacle") && ev.stored?.length) {
          const spots = [[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy]) => [ev.at[0]+dx,ev.at[1]+dy]).filter(([x,y]) => inside(s,x,y) && !tileAt(s,x,y).blocksMove && !barrierAt(s,x,y) && !(s.arena.objects || []).some(o => o.x === x && o.y === y));
          for (const item of ev.stored) {
            if (item.kind === "status") {
              const owner = s.actors[item.actorId];
              if (owner && !owner.status[item.name]) { owner.status[item.name] = item.status; log(s,{kind:"terrain",actor:source.id,text:`${item.name} returns to ${owner.name} as the service receptacle breaks.`}); }
              else log(s,{kind:"terrain",actor:source.id,text:`${item.name || "Stored condition"} is lost as the service receptacle breaks; its original host is unavailable.`});
              continue;
            }
            const spot = spots.shift(); if (!spot) { log(s,{kind:"terrain",actor:source.id,tiles:[ev.at],text:`${item.name || "Stored obstruction"} spills against the blocked room edge.`}); continue; }
            if (item.kind === "filth") { MaidSystems?.addFilth(s, spot[0], spot[1], item.amount || 1); log(s,{kind:"terrain",actor:source.id,tiles:[spot],text:`${item.name || "Stored residue"} spills from the broken service receptacle.`}); continue; }
            if (item.kind === "object" && item.object) s.arena.objects.push({ ...item.object, x: spot[0], y: spot[1] });
            else if (item.kind === "effect" && item.effect) { item.effect.tiles = [spot]; s.terrainEffects.push(item.effect); }
            log(s,{kind:"terrain",actor:source.id,tiles:[spot],text:`${item.name || "Stored obstruction"} spills from the broken service receptacle.`});
          }
        }
        if (ev.kind === "destroyed" && ev.tower) log(s, { kind: "effect", actor: ev.tower.owner, tiles: [ev.at], text: `The drone tower goes down with it.`, why: ["A tower has no life of its own: it falls with what it stood on."] });   // Agent Swarm
        if (ev.kind === "destroyed" && ev.type === "house") H.houseFell(s, source, ev);   // engine/houses.js
        if (ev.kind === "destroyed" && ev.type === "effigy") for (const t of Object.values(s.actors)) if (t.vessel === ev.id) { t.vessel = null;   // Transmigration's effigy
          log(s, { kind: "vessel", actor: t.id, fizzled: true, text: `${t.name}'s effigy breaks: the mark fizzles.` }); }
        if (ev.kind === "destroyed" && ev.type === "dataCenter") ClassRuntime?.centerFell(s, ev, classH());   // his AGI reroutes (docs/data-center.md)
        if (ev.kind === "destroyed" && ev.type === "cistern") (s.dreamRecent ||= {}).cisternBurst = true;   // ambient dreams hear the burst cistern
        if (wildRules && (ev.kind === "destroyed" || ev.kind === "shaken")) {   // shaken: damaged but standing (loosePanels, a data center)
          if (ev.type === "cistern") s.wildRecent.cisternBursts = [...(s.wildRecent.cisternBursts || []), ev.at];
          if (pickupRules) {
            const dropped = pickupRules.dropsFrom(s.arena, [ev], { seed: s.seed }); s.arena = dropped.arena;
            for (const d of dropped.events) log(s, { kind: "drop", actor: source.id, tiles: [d.at], text: d.text });
          }
        }
        if (wildRules && ev.kind === "bridgeCollapse" && ev.overWater) s.wildRecent.bridgeCollapsesOverWater = [...(s.wildRecent.bridgeCollapsesOverWater || []), ev.at];
        if (["crush", "slide", "bridgeFall"].includes(ev.kind) && ev.at) {
          const unit = actorAt(s, ev.at[0], ev.at[1]);
          if (unit && ev.damage > 0) {
            const fallingObject = ["crush", "slide", "carried"].includes(ev.kind);
            hit(s, source, unit, null, ev.damage, [ev.text || "Terrain impact."], { label: ev.kind === "slide" ? "Rockslide" : "Terrain impact", damageType: ev.channel || "nigredo",
              damageMul: fallingObject ? (unit.passives?.fallingObjectDamageMul || 1) : 1 });
            if (ev.stagger && !unit.defeated) addStun(s, source, unit, 10);
          }
        }
        if (ev.kind === "carried" && ev.from && ev.to) {
          const unit = actorAt(s, ev.from[0], ev.from[1]);
          if (unit) {
            const lanyardStops = unit.passives?.knockbackResist && !unit.lanyardUsed;
            if (lanyardStops) { unit.lanyardUsed = true; log(s, { kind: "resist", actor: unit.id, target: unit.id, text: `${unit.name}'s climbing lanyard catches the slide; no displacement this battle.`, why: ["The tool prevents the first forced movement; the impact still resolves."] }); }
            else { unit.x = ev.to[0]; unit.y = ev.to[1]; }
            if (ev.damage) hit(s, source, unit, null, ev.damage, [ev.text || "Rockslide carry."], { label: "Rockslide", damageType: ev.channel || "nigredo", damageMul: unit.passives?.fallingObjectDamageMul || 1 });
            if (ev.stagger && !unit.defeated) addStun(s, source, unit, 10);
          }
        }
      }
    }
    function applyTerrainDamage(s, source, inst) {
      const definition = ab(inst.ability);
      if (vegetation && s.arena.objects?.length) {
        const area = ["radius", "plus", "line"].includes(inst.area.shape) && inst.delivery !== "line";
        let result = null;
        if (area) result = vegetation.areaImpact(moduleArena(s.arena), inst.tiles, inst.potency * inst.mult, { from: [source.x,source.y], channel: inst.damageType, damageMul: source.passives?.objectDamageMul || 1, destructive: !!inst.destructive });
        else if (inst.delivery === "placed") {
          let arena = moduleArena(s.arena), events = [];
          for (const [x,y] of inst.tiles) { const obj = arena.objects.find(o => o.x === x && o.y === y); if (obj) { const r = vegetation.attackObject(arena, obj.id, inst.potency * inst.mult, { from: [source.x,source.y], channel: inst.damageType, damageMul: source.passives?.objectDamageMul || 1, destructive: !!inst.destructive }); arena = r.arena; events.push(...r.events); } }
          result = { arena, events };
        }
        if (result) { s.arena = engineArena(result.arena); applyTerrainEvents(s, source, result.events); }
      }
      if (structures && structures.isGroundTargeting(definition)) {
        // Place familiarity (engine/land.js): the better the attacker knows the place, the less the ground is scarred;
        // at full control the strike leaves the dirt whole.
        const control = H.groundControl(s, source);
        if (control >= 1) log(s, { kind: "terrain", actor: source.id, tiles: inst.tiles, text: `${source.name} knows this ground: a controlled strike, and the dirt is left whole.` });
        else {
          const r = structures.groundImpact(moduleArena(s.arena), inst.tiles, inst.potency * inst.mult * (source.passives?.groundDamageMul || 1) * (1 - control), { from: [source.x,source.y], channel: inst.damageType });
          s.arena = engineArena(r.arena); applyTerrainEvents(s, source, r.events);
          const solid = r.events.find(ev => ev.solid)?.solid || 0;
          if (solid) H.landWound(s, source, "groundTile", solid * (1 - control), inst.tiles);
        }
      }
      // Terrain operations such as a cistern burst can open water on neighbouring occupied tiles,
      // even though the triggering event is logged at the cistern rather than under the actor.
      for (const unit of Object.values(s.actors)) refreshDrowning(s, unit, "the changed terrain floods their tile");
      if (wildRules && [",", "m"].some((ch) => inst.tiles.some(([x, y]) => s.arena.map[y]?.[x] === ch)))
        s.wildRecent.groundStrikesOnFuel = (s.wildRecent.groundStrikesOnFuel || 0) + 1;
    }
    // Lodged seeds (an ability's `seedLodge`): one marker per hit that lands. They sprout as the target's turn starts
    // (sproutSeeds, called from turns.js) and are gone; a target that falls first never sprouts.
    function lodgeSeeds(s, a, t, inst) {
      if (t.defeated || t.wild || !t.status) return;
      const m = t.status.seedLodge;
      t.status.seedLodge = { label: "Lodged seeds", owner: a.id, count: (m?.count || 0) + 1, damage: inst.seedLodge.damage, damageType: inst.seedLodge.damageType, name: inst.name };
      log(s, { kind: "effect", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `Seeds lodge in ${t.name}${t.status.seedLodge.count > 1 ? ` (${t.status.seedLodge.count} now)` : ""}; they sprout as its next turn starts.` });
    }
    // Thorn seeding (an ability's `seedThorn`, or brierRing/overgrowth): one tile effect per seed.
    // Six live tiles per grower; the oldest withers first. Re-seeding a live tile refreshes it.
    function seedThorn(s, a, x, y, spec) {
      if (!inside(s, x, y) || tileAt(s, x, y).blocksMove) return false;
      const live = () => (s.terrainEffects || []).filter(e => e.kind === "thorn" && e.owner === a.id && s.actors[e.owner]?.ownerTurns < e.expiresAt);
      const same = live().find(e => e.tiles?.some(([tx, ty]) => tx === x && ty === y));
      if (same) { same.dmg = Math.max(same.dmg, spec.dmg); same.slow = same.slow || !!spec.slow; same.expiresAt = Math.max(same.expiresAt, a.ownerTurns + spec.duration); return true; }
      const grown = live();
      while (grown.length >= 6) {
        grown.sort((p, q) => p.seq - q.seq);
        const old = grown.shift();
        s.terrainEffects = s.terrainEffects.filter(e => e !== old);
        log(s, { kind: "expire", actor: a.id, tiles: old.tiles, text: `${a.name}'s oldest ${(old.label || "Thorn growth").toLowerCase()} withers.` });
      }
      const seq = ++s.seq;
      // Communes RETURN R-1: a seedThorn spec may label its marker (Prop-Root Snare's "Prop roots"); default-identical otherwise.
      s.terrainEffects.push({ id: `thorn-${seq}`, seq, kind: "thorn", label: spec.label || "Thorn growth", owner: a.id, side: a.side, tiles: [[x, y]], dmg: spec.dmg, slow: !!spec.slow, expiresAt: a.ownerTurns + spec.duration });
      return true;
    }
    // Conjunction: chart a star (three live per keeper, oldest fades), or detonate one.
    function chartStar(s, a, x, y, duration) {
      if (!inside(s, x, y)) return false;
      const live = () => (s.terrainEffects || []).filter(e => e.kind === "star" && e.owner === a.id && s.actors[e.owner]?.ownerTurns < e.expiresAt);
      const same = live().find(e => e.tiles?.some(([tx, ty]) => tx === x && ty === y));
      if (same) { same.expiresAt = Math.max(same.expiresAt, a.ownerTurns + duration); return true; }
      const charted = live();
      while (charted.length >= 3) {
        charted.sort((p, q) => p.seq - q.seq);
        const old = charted.shift();
        s.terrainEffects = s.terrainEffects.filter(e => e !== old);
        log(s, { kind: "expire", actor: a.id, tiles: old.tiles, text: `${a.name}'s oldest charted star fades.` });
      }
      const seq = ++s.seq;
      s.terrainEffects.push({ id: `star-${seq}`, seq, kind: "star", label: "Charted star", owner: a.id, side: a.side, tiles: [[x, y]], expiresAt: a.ownerTurns + duration });
      return true;
    }
    function detonateStar(s, a, star, radius, potency, label) {
      const [sx, sy] = star.tiles[0];
      s.terrainEffects = s.terrainEffects.filter(e => e !== star);
      let struck = 0;
      for (const t of Object.values(s.actors).filter(u => !u.defeated && u.side !== a.side && dist(s, sx, sy, u.x, u.y) <= radius)) {
        let pot = potency, dim = null;
        if (t.lastTechniqueConcept === "diffusion") { const e = findOpp("diffusion", "conjunction", "dims", null, "dimStarlight"); if (e) { edgeUsed(s, e.id); pot = Math.round(pot * (e.op.factor || 0.8)); dim = e.id; } }
        strikeTarget(s, a, t, { name: label, concept: "conjunction", delivery: "field", damageType: "albedo", ability: "starDetonation" }, pot, [`The star at (${sx},${sy}) detonates.`, ...(dim ? [`A scattering front dims the burst [${dim}].`] : [])]);
        struck++;
      }
      log(s, { kind: "effect", actor: a.id, tiles: [[sx, sy]], text: `${label}: the charted star at (${sx},${sy}) detonates (radius ${radius}): ${struck} struck.` });
      return struck;
    }
    function sproutSeeds(s, t) {
      const m = t.status?.seedLodge; if (!m || t.defeated) return;
      t.status.seedLodge = null;
      const src = s.actors[m.owner] || { id: m.owner, name: m.name, side: "wild" };
      log(s, { kind: "effect", actor: m.owner, target: t.id, tiles: [[t.x, t.y]], text: `The seeds lodged in ${t.name} sprout: ${m.count} × ${m.damage}.` });
      for (let i = 0; i < m.count && !t.defeated; i++) hit(s, src, t, null, m.damage, [`Lodged seed sprouts (${m.name}).`], { label: "Sprouting seeds", damageType: m.damageType });
    }
    function knock(s, a, t, n, inst, direction = "push") {
      if (bossRules?.formImmovable?.(t)) { log(s, { kind: "resist", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${t.name}'s exoskeleton doesn't budge.` }); return; }   // learned forms: Exoskeleton
      if (t.boss && bossRules?.displacementBlocked(t)) { log(s, { kind:"resist", actor:a.id, target:t.id, tiles:footprint(t), text:`${t.name} holds its ground against the ${direction}.`, why:["The boss rules make this massive body immune to displacement."] }); return; }
      if (t.form?.golden) { log(s, { kind: "resist", actor: a.id, target: t.id, tiles: [[t.x,t.y]], text: `${t.name} hovers beyond the ${direction}.`, why: ["The Integrated Self ignores forced movement."] }); return; }
      if (ClassRuntime && !t.wild && ClassRuntime.resistKnock(s, a, t, classH(), n, inst)) { H.Support.grant(s, t, "resistShove", "holding against forced movement"); return; }   // ClassRuntime: tethers, growth, support networks, heavy frames (tiles + inst for threshold resists)
      if (!t.wild && (H.Injury?.gradeOf(t, "legs") || 0) === 2) { n += 1; log(s, { kind: "injury", actor: a.id, target: t.id, tiles: [[t.x, t.y]], text: `${t.name} has nowhere to brace (maimed legs): the ${direction} carries +1 tile.` }); }
      const place = (x, y) => {
        const shifted = t.x !== x || t.y !== y;
        t.x = x; t.y = y;
        if (shifted) H.breakHoldsApart?.(s, t);   // forced apart, the hold breaks at once (Mala, 2026-10-26)
        if (t.wild) { const live = s.wild.find(m => m.id === t.id); if (live) { live.x = x; live.y = y; } }
        // Established Guard's counter is a shove that actually moves him. A slam into a wall never calls place.
        if (shifted && t.status?.establishedGuard) {
          t.status.establishedGuard = null;
          log(s, { kind: "effect", actor: t.id, text: `${t.name} is moved: Established Guard resets.` });
        }
      };
      const forceType = inst?.displacementType || inst?.damageType || (inst?.concept && C.conceptDamageTypes[inst.concept]) || "nigredo";
      const rebound = (amount) => {   // interactions (Muse-2): a braced fighter meets collision with collision — half rebounds to the shover
        if (!t.status.guard?.damageType || a.defeated || t.defeated) return;
        hit(s, t, a, null, Math.max(1, Math.ceil(amount / 2)), ["Braced against the impact: half the collision rebounds to the source of the shove."], { label: "Rebound", damageType: t.status.guard.damageType });
      };
      const checkOw = (fx, fy) => {   // Overwatch (Muse-2): forced movement into a watched ring fires the snapshot (no LOS check — a shove is violent and visible)
        if (t.defeated) return;
        for (const watcher of Object.values(s.actors)) {
          const ow = watcher.status.overwatch;
          if (!ow || ow.expiresAt <= watcher.ownerTurns || watcher.defeated || watcher.side === t.side || watcher.id === t.id) continue;
          if (dist(s, fx, fy, watcher.x, watcher.y) <= ow.range || dist(s, t.x, t.y, watcher.x, watcher.y) > ow.range) continue;
          const conc = t.status.concealed; if (conc && (conc.until == null || conc.until >= t.ownerTurns)) continue;
          watcher.status.overwatch = null; watcher.tempoDebt = (watcher.tempoDebt || 0) + ow.owed;
          log(s, { kind: "trigger", actor: watcher.id, target: t.id, text: `${watcher.name}'s Overwatch fires on ${t.name} (${ow.owed} AP owed next turn).`, why: ["Forced into the watched ring."] });
          strikeTarget(s, watcher, t, { name: "Overwatch snapshot", ability: "overwatch", concept: null, delivery: "line", damageType: "albedo", range: ow.range }, ow.potency, ["Overwatch: the watcher held their reaction for this shot."]);
        }
      };
      if (t.status.guard?.damageType === forceType) {
        log(s, { kind: "resist", actor: t.id, target: t.id, text: `${t.name}'s Adaptive Brace resists the ${direction} (${C.damageTypes[forceType]?.name || forceType}); damage still resolves.`, why: [`The active brace is tuned to ${C.damageTypes[forceType]?.name || forceType} and this displacement is tagged ${forceType}.`] });
        rebound(s.rules.slamDamage);
        return;
      }
      if(t.status.immovable&&t.status.immovable.expiresAt>t.ownerTurns){H.Support.grant(s,t,"resistShove","holding an immovable stance");log(s,{kind:"resist",actor:a.id,target:t.id,tiles:[[t.x,t.y]],text:`${t.name} holds position against the ${direction}.`,why:["Immovable cancels forced displacement while its mass is set."]});return;}
      if (t.status.anchor) {
        const edge = findOpp("inertia", inst?.concept || "*", "negates");
        const anchor = t.status.anchor;
        t.status.anchor = null;
        H.Support.grant(s, t, "resistShove", "anchoring against a shove");
        if (edge) edgeUsed(s, edge.id);
        log(s, { kind: "note", actor: t.id, text: `${t.name}'s Anchor cancels the forced displacement; LF damage is unchanged.`, why: [`Inertia resists this one change in position${edge ? ` [${edge.id}]` : ""}.`], edge: edge?.id });
        if (anchor.counterforce > 0 && !a.defeated) hit(s, t, a, null, anchor.counterforce, ["Counterweight redirects a small 4 LF impulse to the source of the resisted shove."], { label: "Counterweight" });
        return;
      }
      if (t.status.rooted?.expiresAt > t.ownerTurns) {   // interactions (Muse-2): roots hold against the shove, but the force topples the fighter — the attempt alone does it
        t.status.rooted = null;
        if (!t.defeated && !H.eatShock(s, t, "stagger")) t.status.stagger = { label: "Stagger", owner: t.id, expiresAt: t.ownerTurns + H.staggerTurns(t) };
        if (!t.defeated && t.id === (s.modeSetup?.hero || "player")) (s.dreamRecent ||= {}).heroStaggered = true;   // ambient dreams hear the hero stagger
        log(s, { kind: "effect", actor: a.id, target: t.id, text: `${t.name}'s roots hold against the ${direction}, but the force topples them: staggered.`, why: ["Root + shove: displacement cancelled, balance lost."] });
        return;
      }
      if(t.status.immovable&&t.status.immovable.expiresAt>t.ownerTurns){H.Support.grant(s,t,"resistShove","holding an immovable stance");log(s,{kind:"resist",actor:a.id,target:t.id,tiles:[[t.x,t.y]],text:`${t.name} holds position against the ${direction}.`,why:["Immovable cancels forced displacement while its mass is set."]});return;}
      if (t.stillwater && !t.stillwaterUsed) { t.stillwaterUsed = true; log(s, { kind: "resist", actor: t.id, target: t.id, text: `${t.name} breathes through the Stillwater Draught: the ${direction} finds no purchase (once per battle).`, why: ["Borrowed calm spends itself on the first disruption."] }); return; }   // W9.4
      if (t.passives?.knockbackResist && !t.lanyardUsed) {
        t.lanyardUsed = true;
        log(s, { kind: "resist", actor: t.id, target: t.id, text: `${t.name}'s climbing lanyard catches the ${direction}; no displacement this battle.`, why: ["The tool prevents the first forced movement; later shoves resolve normally."] });
        return;
      }
      if (direction === "pull" && dist(s, a.x, a.y, t.x, t.y) <= 1) {
        log(s, { kind: "note", actor: t.id, text: `${t.name} is already adjacent; the pull leaves their position unchanged.` }); return;
      }
      if (t.id === a.id) { log(s, { kind: "note", actor: a.id, tiles: [[a.x, a.y]], text: `${a.name} shoves against themselves and goes nowhere.`, why: ["A shove needs someone else to push against."] }); return; }   // zero-vector displacement is undefined; decline it instead of inventing a self-collision
      const sign = direction === "pull" ? -1 : 1;
      const dx = Math.sign(t.x - a.x) * sign, dy = Math.sign(t.y - a.y) * sign;
      let [sx, sy] = Math.abs(t.x - a.x) >= Math.abs(t.y - a.y) ? [dx, 0] : [0, dy];
      if (direction === "push" && ClassRuntime?.steerShove) [sx, sy] = ClassRuntime.steerShove(s, t, sx, sy, classH());   // graded slopes steer shoves
      const nx = t.x + sx * n, ny = t.y + sy * n;
      let occupant = inside(s, nx, ny) ? unitAt(s, nx, ny) : null;
      if (occupant && occupant.id === t.id) occupant = null;   // a big body's own footprint is not an obstacle to itself (it collided with itself when shoved by one tile)
      // TS-01 (forced relocation): a woken body must fit its whole footprint where it lands. A foe inside the new footprint is a
      // collision like an occupied landing tile; any other obstacle inside it is a slam and the body stays put (it braces).
      let footBlock = null;
      if (!occupant && t.awakened && ((t.size?.w || 1) > 1 || (t.size?.h || 1) > 1) && inside(s, nx, ny) && !H.footOpen(s, t, nx, ny, "move")) {
        for (let fy = 0; fy < (t.size?.h || 1) && !occupant; fy++) for (let fx = 0; fx < (t.size?.w || 1) && !occupant; fx++) { const u = inside(s, nx + fx, ny + fy) ? unitAt(s, nx + fx, ny + fy) : null; if (u && u.id !== t.id) occupant = u; }
        if (!occupant) footBlock = true;
      }
      if (footBlock) {
        log(s, { kind: "slam", actor: a.id, target: t.id, tiles: footprint(t), text: `${t.name} braces: its whole body would not fit at (${nx},${ny}); ${s.rules.slamDamage} LF collision damage.`, why: ["A woken body is moved footprint-whole; terrain or a barrier inside the new footprint stops the shove."] });
        hit(s, a, t, null, s.rules.slamDamage, ["Collision with an obstacle inside the landing footprint."], { label: "Slam", damageType: "nigredo" });
        rebound(s.rules.slamDamage);
      } else if (occupant) {
        log(s, { kind: "slam", actor: a.id, target: t.id, text: `${t.name} collides with ${occupant.name}; both take ${s.rules.collisionDamage} LF.`, why: ["An occupied landing tile converts forced movement into a collision."] });
        hit(s, a, t, null, s.rules.collisionDamage, ["Collision from forced movement."], { label: "Collision", damageType: "nigredo" });
        rebound(s.rules.collisionDamage);
        if (!occupant.defeated) hit(s, t, occupant, null, s.rules.collisionDamage, ["Collision from forced movement."], { label: "Collision", damageType: "nigredo" });
      } else if (inside(s, nx, ny) && vegetation && s.arena.objects?.some((o) => o.x === nx && o.y === ny)) {
        const obj = s.arena.objects.find((o) => o.x === nx && o.y === ny);
        const r = vegetation.collide(moduleArena(s.arena), obj.id, n, { from: [t.x, t.y], channel: "nigredo", damageMul: a.passives?.objectDamageMul || 1 });
        s.arena = engineArena(r.arena); applyTerrainEvents(s, a, r.events);
        if (!r.unitMovesIn) {
          log(s, { kind: "slam", actor: a.id, target: t.id, tiles: [[nx, ny]], text: `${t.name} slams into ${vegetation.label(obj)}; ${s.rules.slamDamage} LF collision damage.`, why: ["The map object absorbs the shove and remains in the landing tile."] });
          hit(s, a, t, null, s.rules.slamDamage, [`Collision with ${vegetation.label(obj)}.`], { label: "Slam", damageType: "nigredo" });
          rebound(s.rules.slamDamage);
        } else {
          const fromHeight = heightAt(s, t.x, t.y); place(nx, ny);
          if (r.crashedThrough) {   // Mala, 2026-10-16: thrown through infrastructure, feel the infrastructure (half its remaining HP)
            const dmg = Math.max(1, Math.ceil((obj.hp ?? obj.maxHp ?? 0) * (s.rules.crashThroughShare ?? 0.5)));
            log(s, { kind: "move", actor: t.id, forced: true, path: [[nx - sx * n, ny - sy * n], [nx, ny]], text: `${t.name} crashes through the ${vegetation.label(obj)} to (${nx},${ny}): ${dmg} LF.` });
            hit(s, a, t, null, dmg, [`Crashing through ${vegetation.label(obj)} (${obj.hp ?? obj.maxHp} HP).`], { label: "Crash", damageType: "nigredo" });
          } else
            log(s, { kind: "move", actor: t.id, forced: true, path: [[nx - sx * n, ny - sy * n], [nx, ny]], text: `${t.name} is shoved through the damaged ${vegetation.label(obj)} to (${nx},${ny}).` });
          applyFall(s, a, t, fromHeight, heightAt(s, nx, ny), false, direction === "pull" ? "pulled" : "shoved");
          applyEntryEffects(s, a, t, nx, ny, "is forced into");
          checkOw(nx - sx * n, ny - sy * n);
        }
      } else if (inside(s, nx, ny) && tileAt(s, nx, ny).blocksMove && !waterAt(s, nx, ny)) {
        log(s, { kind: "slam", actor: a.id, target: t.id, tiles: [[nx, ny]], text: `${t.name} slams into ${tileAt(s, nx, ny).name}; ${s.rules.slamDamage} LF collision damage.`, why: ["A blocking terrain face stops the shove."] });
        hit(s, a, t, null, s.rules.slamDamage, ["Collision with blocking terrain."], { label: "Slam", damageType: "nigredo" });
        rebound(s.rules.slamDamage);
      } else if (inside(s, nx, ny) && barrierAt(s, nx, ny) && !barrierAt(s, nx, ny).passable) {
        log(s, { kind: "slam", actor: a.id, target: t.id, tiles: [[nx, ny]], text: `${t.name} slams against a blocking barrier; ${s.rules.slamDamage} LF collision damage.`, why: [`The ${direction} is stopped by a blocking barrier.`] });
        hit(s, a, t, null, s.rules.slamDamage, ["Collision with a blocking barrier."], { label: "Slam", damageType: "nigredo" });
        rebound(s.rules.slamDamage);
      } else if (inside(s, nx, ny) && heightAt(s, nx, ny) - heightAt(s, t.x, t.y) >= 2) {
        log(s, { kind: "slam", actor: a.id, target: t.id, tiles: [[nx, ny]], text: `${t.name} slams against a higher ledge; ${s.rules.slamDamage} LF collision damage.`, why: ["A ledge face stops the shove; the target remains on the near side."] });
        hit(s, a, t, null, s.rules.slamDamage, ["Collision with a higher ledge."], { label: "Slam", damageType: "nigredo" });
        rebound(s.rules.slamDamage);
      } else if (inside(s, nx, ny) && (!barrierAt(s, nx, ny) || barrierAt(s, nx, ny).passable)) {
        const fromHeight = heightAt(s, t.x, t.y); place(nx, ny);
        log(s, { kind: "move", actor: t.id, forced: true, direction, path: [[nx - sx * n, ny - sy * n], [nx, ny]], text: `${t.name} is ${direction === "pull" ? "pulled" : "shoved"} to (${nx},${ny}).` });
        applyFall(s, a, t, fromHeight, heightAt(s, nx, ny), false, direction === "pull" ? "pulled" : "shoved");
        applyEntryEffects(s, a, t, nx, ny, "is forced into");
        checkOw(nx - sx * n, ny - sy * n);
      } else log(s, { kind: "note", actor: t.id, text: `${t.name} is pinned: nowhere to be ${direction === "pull" ? "pulled" : "shoved"}.` });
    }

    function arcaneRider(s, a, inst) {
      if (s.preview || !hasTrait(a, "arcaneMastery")) return;
      const abd = (inst.ability && typeof ab === "function") ? ab(inst.ability) || {} : {};
      const offensive = abd.target === "enemy" || (inst.effect || abd.effect) === "damage";   // aimed at enemies, or deals damage: shockwave-style self bursts count as offence
      if (a.arcaneFedRound !== s.round) { a.arcaneFedRound = s.round; a.arcaneFed = {}; }   // recharge: +2 ΦF per ally per round, no more
      const onTiles = (inst.tiles || []).flatMap(([x, y]) => Object.values(s.actors).filter((u) => u.x === x && u.y === y));
      const reached = [...new Set([...(inst.targets || []).map((id) => s.actors[id]), ...onTiles])].filter((t) => t && !t.defeated);
      for (const t of reached) {
        const foe = t.side !== a.side;
        if (offensive && !foe) continue;   // an offensive technique curses; the allies caught in it get nothing
        if (!offensive && foe) continue;   // a support technique blesses; the enemies it touches get nothing
        if (!t.status) t.status = {};
        a.arcaneRolls = (a.arcaneRolls || 0) + 1;
        const roll = Math.floor(seededChance(`${s.seed}:arcane:${a.id}:${t.id}:${s.round}:${a.arcaneRolls}`) * 3);
        if (foe) {
          const open = ["exposed", "entangled", "bleed"].filter((k) =>
            (k === "exposed" && !t.status.exposed) || (k === "entangled" && !t.status.entangled && !t.boss) || (k === "bleed" && ((t.status.bleed?.drain ?? 0) < 1)));
          if (!open.length) continue;
          const curse = open[roll % open.length];
          if (curse === "exposed") { t.status.exposed = { owner: t.id, expiresAt: t.ownerTurns + 1, why: "Arcane Mastery: the curse leaves them open (incoming damage ×1.25)." }; log(s, { kind: "effect", actor: a.id, target: t.id, text: `${a.name}'s mastery exposes ${t.name}: incoming damage ×1.25.` }); }
          else if (curse === "entangled") { t.status.entangled = { lostMove: 1, expiresAt: t.ownerTurns + 1 }; log(s, { kind: "effect", actor: a.id, target: t.id, text: `${a.name}'s mastery entangles ${t.name}: −1 move.` }); }
          else { t.status.bleed = { drain: 1, until: t.ownerTurns + 2, owner: a.id }; log(s, { kind: "effect", actor: a.id, target: t.id, text: `${a.name}'s mastery opens ${t.name}: bleeding 1 LF a turn.` }); }
        } else {
          const fed = (a.arcaneFed || {})[t.id] || 0;   // the caster is blessed too when reached by his own support (Mala: "himself or allies")
          const open = ["ward", "membrane", "recharge"].filter((k) =>
            (k === "ward" && !t.status.ward) || (k === "membrane" && !t.status.membrane) || (k === "recharge" && (t.pf || 0) < (t.maxPF || 0) && fed < 2));
          if (!open.length) continue;
          const bless = open[roll % open.length];
          if (bless === "ward") { t.status.ward = { label: "Arcane Ward", owner: t.id, protection: 4, expiresAt: t.ownerTurns + 1 }; log(s, { kind: "effect", actor: a.id, target: t.id, text: `${a.name}'s mastery wards ${t.name}: protection 4.` }); }
          else if (bless === "membrane") { t.status.membrane = { label: "Arcane Membrane", owner: t.id, expiresAt: t.ownerTurns + 1 }; log(s, { kind: "effect", actor: a.id, target: t.id, text: `${a.name}'s mastery membranes ${t.name}.` }); }
          else { const gain = Math.max(0, Math.min(2 - fed, 2, (t.maxPF || 0) - (t.pf || 0))); t.pf = (t.pf || 0) + gain; a.arcaneFed[t.id] = fed + gain; log(s, { kind: "effect", actor: a.id, target: t.id, text: `${a.name}'s mastery recharges ${t.name}: +${gain} ΦF.` }); }
        }
      }
    }
    const resolveAbilityOuter = (s, a, inst) => { const r = resolveAbility(s, a, inst); if (!inst?.refused) arcaneRider(s, a, inst); return r; };   // a refused cast (contract, sealed dream) carries no rider
    return { lodgeSeeds, sproutSeeds, resolveAbility: resolveAbilityOuter, resolveDreamAbility, moduleArena, engineArena, applyTerrainEvents, applyTerrainDamage, strikeObject, knock};
  })();
});
