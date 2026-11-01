"use strict";
// Concealment, decoys, waiting windows, entrancement and bleeding. State is
// JSON-only; randomness derives from seed and committed draws.
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.ConceptCombatStealth=factory();
})(typeof self!=='undefined'?self:this,function(){
 const IDS=new Set(['vanish','smokeVeil','decoy','wait','recoveryStrike','genjutsu','vanishingCut','blackout','pickpocket','skim','emptyPockets','perfectHeist']);
 const status=u=>(u.status||={});
 const active=(x,a)=>x&&(x.until==null||x.until>=a.ownerTurns);
 const concealed=a=>!!(a&&!a.defeated&&active(a.status?.concealed,a));
 const entranced=a=>!!(a&&!a.defeated&&active(a.status?.entranced,a));
 const hasTrait=(u,id)=>(u?.traits||[]).some(t=>(typeof t==='string'?t:t?.id)===id);
 const isNinja=a=>a&&a.primary==='stealth'&&a.secondary==='threshold';
 const say=(s,H,a,text,why)=>H.log(s,{kind:'stealth',actor:a.id,text,...(why?{why}:{})});
 const state=s=>(s.stealth||={casts:0});
 const roll=(s,H,key,n)=>{const c=state(s);c.casts++;return 1+Math.floor(H.seededChance(`${s.seed}:stealth:${key}:${c.casts}`)*n);};
 // ── decoys: 1-HP arena objects; fields destroy them through vegetation ──
 const decoysOf=(s,id)=>(s.arena.objects||[]).filter(o=>o.role==='decoy'&&o.owner===id);
 const liveDecoy=(s,u)=>decoysOf(s,u.id).find(o=>o.until==null||o.until>=u.ownerTurns);
 const markerEats=(s,u)=>{const d=liveDecoy(s,u);return d&&d.roundEaten!==s.round;};
 function layDecoy(s,a,H){
  s.arena.objects=(s.arena.objects||[]).filter(o=>!(o.role==='decoy'&&o.owner===a.id));
  s.arena.objects.push({id:"decoy"+(++s.seq),role:"decoy",label:`${a.name}'s decoy`,owner:a.id,x:a.x,y:a.y,hp:1,maxHp:1,until:a.ownerTurns+1,roundEaten:-1});
 }
 function breakConceal(s,H,a,why){if(a.status?.concealed){delete a.status.concealed;say(s,H,a,`${a.name} is revealed${why?`: ${why}`:""}.`);}}
 // ── theft: best consumable by rarity; tempo moves as debt-to-bank; ghost hands never break cover ──
 const RARITY_RANK={common:0,uncommon:1,rare:2,legendary:3};
 function bestConsumable(t,H){
  const defs=H.accountItems?.consumables;if(!defs)return (t.inventory||[])[0]||null;
  let best=null,bestRank=-1;
  for(const item of (t.inventory||[])){const d=defs[item];if(!d||d.outsideBattle)continue;
   const r=RARITY_RANK[d.rarity]??0;if(r>bestRank){bestRank=r;best=item;}}
  return best;
 }
 function liftGoods(s,a,t,item,H){
  if(!item||!t||t.defeated)return null;
  if((a.inventory||[]).length>=(a.inventoryCapacity??0))return null;
  const i=(t.inventory||[]).indexOf(item);if(i<0)return null;
  t.inventory.splice(i,1);a.inventory.push(item);
  return H.accountItems?.consumables?.[item]?.name||item;
 }
 function takeTempo(s,t,a,n){t.tempoDebt=(t.tempoDebt||0)+n;a.bankedTempo=Math.min(200,(a.bankedTempo||0)+n);}
 // ── pickpocket: a straight dash of 1-5 through enemy tiles; allies and walls block, the end must be free ──
 function pickPath(s,H,a,tx,ty){
  const dx=tx-a.x,dy=ty-a.y;
  if(dx!==0&&dy!==0&&Math.abs(dx)!==Math.abs(dy))return {error:"Pick a straight line: orthogonal or diagonal."};
  const path=H.line(a.x,a.y,tx,ty).slice(1);
  if(path.length<1||path.length>5)return {error:"The run is 1 to 5 tiles."};
  const blocked=([x,y])=>{const t=H.tileAt(s,x,y);if(t.blocksMove)return true;const b=H.barrierAt(s,x,y);return !!(b&&!b.passable);};
  for(const [x,y] of path.slice(0,-1)){
   if(blocked([x,y]))return {error:`The run is blocked at (${x},${y}).`};
   const o=H.actorAt(s,x,y);
   if(o&&o.id!==a.id&&o.side===a.side&&!o.defeated)return {error:`${o.name} blocks the run: only enemies are passed through.`};
  }
  const [ex,ey]=path[path.length-1];
  if(blocked([ex,ey]))return {error:`Nowhere to land at (${ex},${ey}).`};
  if(H.actorAt(s,ex,ey))return {error:"Land on a free tile."};
  const foes=path.slice(0,-1).map(([x,y])=>H.actorAt(s,x,y)).filter(u=>u&&u.id!==a.id&&u.side!==a.side&&!u.defeated);
  return {path,foes};
 }
 function conceal(s,H,a,turns,why){status(a).concealed={until:a.ownerTurns+turns};say(s,H,a,`${a.name} vanishes${why?` (${why})`:""}.`);}
 function beforeAbility(s,a,m){
  const id=m.id||m.ability;if(!IDS.has(id))return null;
  if(id==='genjutsu'&&(a.inspiration||0)<3)return "Genjutsu needs 3 Inspiration (the whole purse).";
  if(id==='skim'&&!concealed(a))return "Skim needs cover: gain Concealed first.";
  if(id==='perfectHeist'&&(a.inspiration||0)<3)return "Perfect Heist needs 3 Inspiration (the whole purse).";
  return null;
 }
 function target(s,a,m,tx,ty,H){
  const id=m.id||m.ability;if(!IDS.has(id))return null;
  const fail=(error)=>({ok:false,error});
  if(id==='genjutsu'&&(a.inspiration||0)<3)return fail("Genjutsu needs 3 Inspiration (the whole purse).");
  if(id==='perfectHeist'&&(a.inspiration||0)<3)return fail("Perfect Heist needs 3 Inspiration (the whole purse).");
  if(id==='skim'&&!concealed(a))return fail("Skim needs cover: gain Concealed first.");
  if(id==='vanish'||id==='decoy'||id==='emptyPockets')return {ok:true,tiles:[[a.x,a.y]],targets:[]};
  if(tx==null||!H.inside(s,tx,ty))return fail("Choose a tile.");
  if(id==='smokeVeil')return H.dist(s,a.x,a.y,tx,ty)<=4?{ok:true,tiles:[[tx,ty]],targets:[]}:fail("Smoke Veil lands within 4.");
  if(id==='blackout')return H.dist(s,a.x,a.y,tx,ty)<=5?{ok:true,tiles:[[tx,ty]],targets:[]}:fail("Blackout lands within 5.");
  if(id==='pickpocket'){const p=pickPath(s,H,a,tx,ty);return p.error?fail(p.error):{ok:true,tiles:[[tx,ty]],targets:p.foes.map(f=>f.id)};}
  const occ=H.actorAt(s,tx,ty);
  if(!occ||occ.side===a.side||occ.defeated)return fail("Choose an opponent.");
  if((id==='wait'||id==='genjutsu'||id==='perfectHeist')&&concealed(occ))return fail(`${occ.name} cannot be seen (Concealed).`);
  if(id==='perfectHeist')return (occ.ultimateCharge||0)>0?{ok:true,tiles:[[tx,ty]],targets:[occ.id]}:fail(`${occ.name} holds no charge worth stealing.`);
  const range={wait:8,recoveryStrike:5,genjutsu:6,vanishingCut:7,skim:1}[id];
  if(H.dist(s,a.x,a.y,tx,ty)>range)return fail("Out of range.");
  if((id==='wait'||id==='genjutsu'||id==='vanishingCut')&&!H.hasSight(s,a.x,a.y,tx,ty))return fail("You need a clear line to the mark.");
  return {ok:true,tiles:[[tx,ty]],targets:[occ.id]};
 }
 const markActed=(s,w)=>{const m=s.actors[w.mark];return m&&m.ownerTurns>w.markTurns;};
 function resolve(s,a,inst,H){
  const id=inst.ability;if(!IDS.has(id))return false;
  if(id==='vanish'){conceal(s,H,a,1);return true;}
  if(id==='smokeVeil'){
   const [tx,ty]=inst.tiles[0];
   for(let y=0;y<s.arena.h;y++)for(let x=0;x<s.arena.w;x++)if(H.dist(s,tx,ty,x,y)<=1)
    s.barriers.push({id:"b"+(++s.seq),owner:a.id,x,y,protection:0,duration:1,expiresAt:a.ownerTurns+1,concept:"smoke",blocksSight:true});
   say(s,H,a,`${a.name} veils (${tx},${ty}) in smoke: sight fails there for 1 round.`,["Ending a turn inside conceals."]);return true;
  }
  if(id==='decoy'){conceal(s,H,a,1);layDecoy(s,a,H);say(s,H,a,`${a.name} leaves a false position at (${a.x},${a.y}): it eats the first targeted delivery each round.`,["Blast the marker's tile; fields destroy it."]);return true;}
  if(id==='blackout'){
   const [tx,ty]=inst.tiles[0];
   for(let y=0;y<s.arena.h;y++)for(let x=0;x<s.arena.w;x++)if(H.dist(s,tx,ty,x,y)<=3)
    s.barriers.push({id:"b"+(++s.seq),owner:a.id,x,y,protection:0,duration:2,expiresAt:a.ownerTurns+2,concept:"smoke",blocksSight:true});
   for(const u of Object.values(s.actors))if(!u.defeated&&u.side===a.side&&H.dist(s,tx,ty,u.x,u.y)<=3)status(u).concealed={until:u.ownerTurns+1};
   say(s,H,a,`${a.name} calls a Blackout on (${tx},${ty}): sight fails in radius 3 for 2 rounds; allies inside vanish.`,["Blast the dark; leave it; wait two rounds."]);return true;
  }
  if(id==='wait'){
   const t=H.actor(s,inst.targets[0]);
   a.bankedTempo=Math.min(200,(a.bankedTempo||0)+40);
   status(a).waiting={mark:t.id,until:a.ownerTurns+1,markTurns:t.ownerTurns,hidden:concealed(a)};
   say(s,H,a,`${a.name} holds (+40 banked tempo): the mark's next technique opens a window.${concealed(a)?" Armed from Concealed: no mark shows.":""}`);return true;
  }
  if(id==='recoveryStrike'){
   const t=H.actor(s,inst.targets[0]),w=status(a).waiting,armed=w&&active(w,a)&&w.mark===t.id;
   const fed=armed&&markActed(s,w),dmg=fed?20:12;
   if(armed)delete status(a).waiting;
   H.hit(s,a,t,inst,dmg,[fed?"The strike lands in the mark's recovery: 20, not 12.":"Unarmed: a plain 12."],{label:"Recovery Strike"});
   return true;
  }
  if(id==='genjutsu'){
   if(!H.spendInspiration(s,a,3)){say(s,H,a,`${a.name}'s Genjutsu fizzles: the purse is empty.`);return true;}
   const t=H.actor(s,inst.targets[0]),n=roll(s,H,'genjutsu',3);
   status(t).entranced={until:t.ownerTurns+n,by:a.id,turns:n};
   if(a.status?.concealed)delete a.status.concealed;
   say(s,H,a,`${a.name}'s Genjutsu takes ${t.name}: Entranced for ${n} of its turns. It turns on its allies.`,["No standing allies: it stands and stalls."]);return true;
  }
  if(id==='pickpocket'){
   const [tx,ty]=inst.tiles[0],p=pickPath(s,H,a,tx,ty);
   if(p.error){say(s,H,a,`${a.name}'s Pickpocket fizzles: ${p.error}`);return true;}
   const [ex,ey]=p.path[p.path.length-1];
   a.x=ex;a.y=ey;a.moved=true;
   const wasVeiled=!!a.status?.concealed;
   if(wasVeiled)delete a.status.concealed;   // the bump is an attack: ghost hands doesn't cover it
   const takes=[];
   for(const t of p.foes){
    H.hit(s,a,t,{...inst,name:"Pickpocket"},6,[`${a.name} bumps ${t.name} on the run: 6.`],{label:"Pickpocket"});
    if(t.defeated){takes.push(`${t.name}: down`);continue;}
    takeTempo(s,t,a,20);
    let extra="";
    if((t.inspiration||0)>0&&roll(s,H,'pickpocket',4)===1){
     H.spendInspiration(s,t,1);H.inspire(s,a,1,`${a.name} lifts ${t.name}'s spark mid-run.`);
     const gotF=Math.min(5,t.pf||0);t.pf=(t.pf||0)-gotF;a.pf=Math.min(a.maxPF??((a.pf||0)+gotF),(a.pf||0)+gotF);
     extra=", +1 inspiration, +5 focus";
    }
    takes.push(`${t.name}: 6 + 20 tempo${extra}`);
   }
   say(s,H,a,`${a.name} runs the line to (${ex},${ey})${takes.length?`: ${takes.join("; ")}`:"; no marks on the way"}${wasVeiled?" (revealed: the bump is an attack)":""}.`);
   return true;
  }
  if(id==='skim'){
   const t=H.actor(s,inst.targets[0]);
   const took=liftGoods(s,a,t,bestConsumable(t,H),H);
   takeTempo(s,t,a,40);
   const gotF=Math.min(15,t.pf||0);t.pf=(t.pf||0)-gotF;a.pf=Math.min(a.maxPF??((a.pf||0)+gotF),(a.pf||0)+gotF);
   say(s,H,a,`${a.name} skims ${t.name}: ${took?took+", ":""}40 tempo banked, ${gotF} focus pocketed (ghost hands: the veil holds).`);
   return true;
  }
  if(id==='emptyPockets'){
   const marks=Object.values(s.actors).filter(u=>u.side!==a.side&&!u.defeated&&H.dist(s,a.x,a.y,u.x,u.y)<=2);
   const takes=[];
   for(const t of marks){
    const took=liftGoods(s,a,t,bestConsumable(t,H),H);
    if(took)takes.push(`${t.name}: ${took}`);
    else{takeTempo(s,t,a,20);takes.push(`${t.name}: 20 tempo`);}
   }
   conceal(s,H,a,1);
   say(s,H,a,`${a.name} empties pockets (${takes.join("; ")||"no foes in reach"}) — and is gone.`);
   return true;
  }
  if(id==='perfectHeist'){
   if(!H.spendInspiration(s,a,3)){say(s,H,a,`${a.name}'s Perfect Heist fizzles: the purse is empty.`);return true;}
   const t=H.actor(s,inst.targets[0]),max=s.rules.ultimateChargeMax??100;
   const take=t.ultimateCharge||0,total=(a.ultimateCharge||0)+take,over=Math.max(0,total-max);
   t.ultimateCharge=0;a.ultimateCharge=Math.min(max,total);a.tempo=(a.tempo||0)+over;
   conceal(s,H,a,1);
   say(s,H,a,`${a.name} drains ${take} charge from ${t.name} (${a.ultimateCharge}/${max}${over?`, +${over} AP overflow`:""}) — and is gone (the perfect heist).`);return true;
  }
  if(id==='vanishingCut'){
   const mark=H.actor(s,inst.targets[0]);
   const dodged=mark&&!mark.defeated&&inst.aim&&(mark.x!==inst.aim[0]||mark.y!==inst.aim[1]);   // nothing else moves during the window
   if(!mark||mark.defeated)say(s,H,a,`${a.name}'s Vanishing Cut finds nothing.`);
   else if(dodged&&H.dist(s,a.x,a.y,mark.x,mark.y)<=7)H.hit(s,a,mark,{...inst,fromCut:true},40,[`${mark.name} dodged; the cut follows them home: 40.`],{label:"Vanishing Cut"});
   else if(dodged)say(s,H,a,`${mark.name} is gone beyond the cut's reach: clean escape.`);
   else H.hit(s,a,mark,{...inst,fromCut:true},20,["From nowhere, the cut cannot be parried."],{label:"Vanishing Cut"});
   conceal(s,H,a,1);layDecoy(s,a,H);return true;
  }
  return false;
 }
 // First strike: the concealed attacker ignores parry (no reposition exists outside
 // announced windows). Concealment breaks on the swing, before damage is computed.
 function beforeStrike(s,src,tgt,inst,potency,H){
  if(!src||!concealed(src))return null;
  if(src.faction==="children_of_the_future")return {potency,inst,why:[`${src.name} strikes from cover: the future keeps them hidden.`]};   // coverTheFuture: a concealed traveler's swing breaks neither cover nor clock
  delete src.status.concealed;   // every swing breaks cover; only the Ninja's carries the killing edge
  if(!isNinja(src))return {potency,inst,why:[`${src.name} is revealed: the swing breaks cover.`]};
  return {potency,inst:{...inst,ignoreParry:true,fromConcealed:true},why:[`${src.name} strikes from Concealed: no reaction answers (first strike).`]};
 }
 function afterHit(s,src,tgt,inst,dealt,H){
  if(src&&isNinja(src)&&inst?.fromConcealed&&dealt>0&&!src.defeated)H.inspire(s,src,1,`${src.name}'s unseen strike lands: +1 Inspiration (from the dark).`);
  if(src&&tgt&&!tgt.defeated&&tgt.side!==src.side&&dealt>0&&hasTrait(src,'stickyFingers')){
   const took=liftGoods(s,src,tgt,bestConsumable(tgt,H),H);
   if(took)say(s,H,src,`${src.name}'s strike lifts ${took} from ${tgt.name} (sticky fingers).`);
  }
 }
 function redirect(s,src,tgt,inst,H){
  if(!tgt||tgt.defeated)return undefined;
  if(inst&&(inst.delivery==='field'||inst.area?.shape==='radius'))return undefined;   // fields destroy markers through vegetation, never eaten
  if(markerEats(s,tgt)){const d=liveDecoy(s,tgt);d.roundEaten=s.round;
   say(s,H,tgt,`${tgt.name}'s decoy eats ${inst?.name||'the delivery'} (the false position stands where they were).`);return null;}
  return undefined;
 }
 function turnStart(s,a,H){
  const b=status(a).bleed;
  let drained=0;   // ward ruling (Muse-2): report the drain so recovery-disturbance sees internal damage too
  if(b&&active(b,a)&&!a.defeated){
   const drain=Math.min(a.lf,b.drain||2);a.lf-=drain;drained=drain;
   H.log(s,{kind:'bleed',actor:a.id,amount:drain,tiles:[[a.x,a.y]],text:`${a.name} bleeds (${drain} LF${b.until>a.ownerTurns?`, ${b.until-a.ownerTurns} more turns`:"; the bleeding stops"}.`});
   if(a.lf<=0&&!a.defeated)H.hit(s,s.actors[b.owner]||a,a,null,0,[`${a.name} bleeds out.`],{label:'Bleed',bleedOut:true});   // drained to 0 is defeated through hit()'s defeat block, not left standing (a capped battle otherwise; wizard-kit pre-screen)
  }
  if(!concealed(a)||a.defeated)return drained;
  const seen=Object.values(s.actors).some(u=>u.side!==a.side&&!u.defeated&&H.dist(s,a.x,a.y,u.x,u.y)<=2&&H.hasSight(s,u.x,u.y,a.x,a.y));
  if(seen){breakConceal(s,H,a,"a foe is within 2 with a clear sightline");return drained;}
  const watched=Object.values(s.actors).some(u=>!u.defeated&&(u.focus?.target===a.id||u.status?.attention?.target===a.id));
  if(watched)breakConceal(s,H,a,"a focused watcher follows the body");
  return drained;
 }
 function endTurn(s,a){
  if(!a||a.defeated||concealed(a))return;
  const smoke=(s.barriers||[]).some(b=>b.concept==='smoke'&&b.blocksSight&&b.x===a.x&&b.y===a.y&&(!b.expiresAt||b.expiresAt>=(s.actors[b.owner]?.ownerTurns??99)));
  if(smoke){status(a).concealed={until:a.ownerTurns+1};}
 }
 const foeNear=(s,a,n,H)=>Object.values(s.actors).some(u=>u.side!==a.side&&!u.defeated&&H.dist(s,a.x,a.y,u.x,u.y)<=n);
 function aiValue(s,a,cand,H){
  const id=cand.ability;if(!IDS.has(id))return null;
  // Recasting buys nothing: already hidden, Vanish only renews the same concealment; a decoy already standing on this
  // tile is just replaced by another there (Mala's Survive log, 2026-10-14: Vanish four times, Decoy three, one turn).
  if(id==='vanish'&&concealed(a))return 0;
  if(id==='decoy'&&decoysOf(s,a.id).some(o=>o.x===a.x&&o.y===a.y))return 0;
  if(id==='vanish'||id==='decoy')return foeNear(s,a,5,H)?(id==='decoy'?4:3.5):1;
  if(id==='smokeVeil')return foeNear(s,a,6,H)?4:1;
  if(id==='wait')return 3;
  if(id==='recoveryStrike'){const w=status(a).waiting,t=cand.target&&H.actorAt(s,cand.target[0],cand.target[1]);
   if(w&&active(w,a)&&t&&w.mark===t.id)return markActed(s,w)?8:2;return 2;}
  if(id==='genjutsu'){const t=cand.target&&H.actorAt(s,cand.target[0],cand.target[1]);
   if(!t)return 1.5;const allies=Object.values(s.actors).filter(u=>u.side===t.side&&!u.defeated&&u.id!==t.id).length;
   return allies>=2?7:allies===1?4:1.5;}
  if(id==='vanishingCut')return 9;
  if(id==='blackout')return 7;
  if(id==='pickpocket'){if(!cand.target)return 2;const p=pickPath(s,H,a,cand.target[0],cand.target[1]);const n=p.foes?p.foes.length:0;return n?Math.min(11,5+2*n):2;}
  if(id==='skim')return 10;
  if(id==='emptyPockets'){const n=Object.values(s.actors).filter(u=>u.side!==a.side&&!u.defeated&&H.dist(s,a.x,a.y,u.x,u.y)<=2).length;return Math.min(9,4+n);}
  if(id==='perfectHeist'){const t=cand.target&&H.actorAt(s,cand.target[0],cand.target[1]);if(!t)return 5;
   const max=s.rules.ultimateChargeMax??100,need=Math.max(0,max-(a.ultimateCharge||0)),take=t.ultimateCharge||0;
   if(need<=0)return Math.min(7,5+take/50);   // meter full: the take is pure AP plus the vanish
   return take>=need?9:5+4*(take/need);}
  return null;
 }
 return {IDS,concealed,entranced,isNinja,hasTrait,beforeAbility,target,resolve,beforeStrike,afterHit,redirect,turnStart,endTurn,aiValue,decoysOf,liveDecoy,markerEats};
});
