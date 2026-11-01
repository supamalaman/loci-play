"use strict";
// Chain-of-justice: halt, cuff, seize, detain. Cuffs find the concealed;
// the locker keeps what it takes. State is JSON-only; no randomness here.
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.ConceptCombatPolice=factory();
})(typeof self!=='undefined'?self:this,function(){
 const IDS=new Set(['halt','cuff','evidence','takedown','arrest']);
 const status=u=>(u.status||={});
 const active=(x,a)=>x&&(x.until==null||x.until>=a.ownerTurns);
 const cuffed=(t)=>!!(t&&!t.defeated&&active(t.status?.cuffed,t));
 const courtHolds=(s,t)=>!!t&&(t.acquitted||!!(s.trial&&!s.trial.over&&s.trial.accusedId===t.id));   // in court, or freed by it: the police wait (audit 1.3.447)
 const say=(s,H,a,text,why)=>H.log(s,{kind:'police',actor:a.id,text,...(why?{why}:{})});
 function reveal(s,H,a,t){
  if(t.status?.concealed){delete t.status.concealed;say(s,H,a,`${t.name} is found: the law doesn't need to see you coming.`);return true;}
  return false;
 }
 function cuff(s,H,a,t,rounds){
  const found=reveal(s,H,a,t);
  status(t).cuffed={until:t.ownerTurns+rounds,by:a.id};
  say(s,H,a,`${a.name} cuffs ${t.name} (${rounds} round${rounds===1?"":"s"}: no move, no items)${found?" — found hiding":""}.`,["Evidence and Arrest need a cuffed mark."]);
 }
 function seizeGoods(s,H,a,t){
  const room=Math.max(0,(a.inventoryCapacity??0)-(a.inventory||[]).length);
  const take=(t.inventory||[]).splice(0,room);
  for(const item of take)a.inventory.push(item);
  return take;
 }
 // ── takedown: a straight dash of 1-3; allies and walls block, the end must be free ──
 function dashPath(s,H,a,tx,ty){
  const dx=tx-a.x,dy=ty-a.y;
  if(dx!==0&&dy!==0&&Math.abs(dx)!==Math.abs(dy))return {error:"Pick a straight line: orthogonal or diagonal."};
  const path=H.line(a.x,a.y,tx,ty).slice(1);
  if(path.length<1||path.length>3)return {error:"The tackle runs 1 to 3 tiles."};
  const blocked=([x,y])=>{const t=H.tileAt(s,x,y);if(t.blocksMove)return true;const b=H.barrierAt(s,x,y);return !!(b&&!b.passable);};
  for(const [x,y] of path.slice(0,-1)){
   if(blocked([x,y]))return {error:`The run is blocked at (${x},${y}).`};
   const o=H.actorAt(s,x,y);
   if(o&&o.id!==a.id&&o.side===a.side&&!o.defeated)return {error:`${o.name} blocks the run.`};
  }
  const [ex,ey]=path[path.length-1];
  if(blocked([ex,ey]))return {error:`Nowhere to land at (${ex},${ey}).`};
  if(H.actorAt(s,ex,ey))return {error:"Land on a free tile."};
  const foes=path.slice(0,-1).map(([x,y])=>H.actorAt(s,x,y)).filter(u=>u&&u.id!==a.id&&u.side!==a.side&&!u.defeated);
  return {path,foes};
 }
 function target(s,a,m,tx,ty,H){
  const id=m.id||m.ability;if(!IDS.has(id))return null;
  const fail=(error)=>({ok:false,error});
  if(tx==null||!H.inside(s,tx,ty))return fail("Choose a tile.");
  if(id==='takedown'){const p=dashPath(s,H,a,tx,ty);return p.error?fail(p.error):{ok:true,tiles:[[tx,ty]],targets:p.foes.slice(0,1).map(f=>f.id)};}
  const occ=H.actorAt(s,tx,ty);
  if(!occ||occ.side===a.side||occ.defeated)return fail("Choose an opponent.");
  const range={halt:5,cuff:2,evidence:2,arrest:2}[id];
  if(H.dist(s,a.x,a.y,tx,ty)>range)return fail("Out of range.");
  if(id==='halt'&&!H.hasSight(s,a.x,a.y,tx,ty))return fail("You need a clear line to order the halt.");
  if((id==='evidence'||id==='arrest')&&!cuffed(occ))return fail(`${occ.name} must be cuffed first.`);
  return {ok:true,tiles:[[tx,ty]],targets:[occ.id]};
 }
 function resolve(s,a,inst,H){
  const id=inst.ability;if(!IDS.has(id))return false;
  if(id==='halt'){
   const t=H.actor(s,inst.targets[0]);
   status(t).halted={until:t.ownerTurns+1};
   say(s,H,a,`${a.name} orders ${t.name} to halt: no moving for 1 round.`);return true;
  }
  if(id==='cuff'){const t=H.actor(s,inst.targets[0]);if(courtHolds(s,t)){say(s,H,a,`${a.name} lets ${t.name} be: ${t.acquitted?"the court freed them":"the court has them"}.`);return true;}cuff(s,H,a,t,2);if(H.Dispatch)H.Dispatch.noteCuff(s,H,a,t);return true;}
  if(id==='evidence'){
   const t=H.actor(s,inst.targets[0]);
   if(!cuffed(t)){say(s,H,a,`${a.name} finds ${t.name} uncuffed: the seizure needs the chain.`);return true;}
   const take=seizeGoods(s,H,a,t);
   say(s,H,a,`${a.name} bags the evidence from ${t.name}: ${take.length?take.join(", "):"nothing to take"}${(t.inventory||[]).length?` (${t.inventory.length} left: no room)`:""}.`);return true;
  }
  if(id==='takedown'){
   const [tx,ty]=inst.tiles[0],p=dashPath(s,H,a,tx,ty);
   if(p.error){say(s,H,a,`${a.name}'s Takedown fizzles: ${p.error}`);return true;}
   const [ex,ey]=p.path[p.path.length-1];
   a.x=ex;a.y=ey;a.moved=true;
   const first=p.foes[0];
   if(first)cuff(s,H,a,first,1);
   say(s,H,a,`${a.name} runs the tackle to (${ex},${ey})${first?` through ${first.name}`:"; no marks on the way"}.`);return true;
  }
  if(id==='arrest'){
   const t=H.actor(s,inst.targets[0]);
   if(!cuffed(t)){say(s,H,a,`${a.name} reaches for ${t.name}: no cuffs, no arrest.`);return true;}
   if(courtHolds(s,t)){say(s,H,a,`${a.name} reaches for ${t.name}: ${t.acquitted?"the court freed them":"the court has them"}. No arrest.`);return true;}
   status(t).detained={until:t.ownerTurns+2,by:a.id};
   const claimed=!!t.claimTrial;
   const heard=claimed&&H.Dispatch?H.Dispatch.openArrestTrial(s,H,a.id,t.id).ok:false;
   if(claimed&&!heard)delete t.claimTrial;   // docket spent: the claim dies, the bust stands
   const bust=t.id===a.hunting;
   if(bust&&(!claimed||!heard))s.copBust={offender:t.id,side:t.side,name:t.name};
   const banked=t.bankedTempo||0,room=200-(a.bankedTempo||0),keep=Math.min(banked,Math.max(0,room)),over=banked-keep;
   t.bankedTempo=0;a.bankedTempo=(a.bankedTempo||0)+keep;a.tempo=(a.tempo||0)+over;
   const take=seizeGoods(s,H,a,t);
   say(s,H,a,`${a.name} arrests ${t.name}: Detained 2 rounds (no act, no move, no items); seized ${banked} banked tempo${over?` (${over} overflows to AP)`:""}${take.length?` and ${take.join(", ")}`:""}${bust?" — busted: the fight is over":""}.`,["Held, not helpless: reactions still work."]);return true;
  }
  return false;
 }
 function aiValue(s,a,cand,H){
  const id=cand.ability;if(!IDS.has(id))return null;
  if(id==='halt')return 3;
  if(id==='cuff'){const t=cand.target&&H.actorAt(s,cand.target[0],cand.target[1]);if(!t||cuffed(t)||courtHolds(s,t))return 0;return t.status?.concealed?6:5;}   // no re-cuffing a cuffed mark (Wetland 4099738187: 75 AP of pure refresh)
  if(id==='evidence'){const t=cand.target&&H.actorAt(s,cand.target[0],cand.target[1]);return 3+Math.min(4,(t?.inventory||[]).length);}
  if(id==='takedown'){if(!cand.target)return 2;const p=dashPath(s,H,a,cand.target[0],cand.target[1]);return p.foes&&p.foes.length?5:2;}
  if(id==='arrest'){const t=cand.target&&H.actorAt(s,cand.target[0],cand.target[1]);if(courtHolds(s,t))return 0;if(isCopUnit(a)&&(!a.hunting||t?.id!==a.hunting))return 0;return 12+Math.min(2,(t?.bankedTempo||0)/50);}   // cops only arrest the offender (Mala, 2026-10-22); other kit-holders arrest freely. 12 (was 7): a finished chain must outscore a routine strike (~10-12 with ledgers), or the ult never fires
  return null;
 }
 const isCopUnit=a=>a&&a.character==="police_officer";
 const isVillain=u=>!!u&&(u.character==="super_villain"||(u.primary==="dependency"&&u.secondary==="deception"));
 function edgeSpot(s,H,near){
  const open=(x,y)=>x>=0&&y>=0&&x<s.arena.w&&y<s.arena.h&&!H.tileAt(s,x,y).blocksMove&&!H.actorAt(s,x,y);
  const edge=[];
  for(let x=0;x<s.arena.w;x++)for(const y of [0,s.arena.h-1])if(open(x,y))edge.push([x,y]);
  for(let y=1;y<s.arena.h-1;y++)for(const x of [0,s.arena.w-1])if(open(x,y))edge.push([x,y]);
  edge.sort((p,q)=>(Math.abs(p[0]-near.x)+Math.abs(p[1]-near.y))-(Math.abs(q[0]-near.x)+Math.abs(q[1]-near.y)));
  return edge[0]||null;
 }
 function turnStart(s,a,H){
  // Hunting maintenance: a hunter whose quarry is subdued, down, or gone stands down; else the focus holds.
  if(a.hunting){
   const q=s.actors[a.hunting];
   if(!q||q.defeated||q.escaped||active(q.status?.detained,q)){a.hunting=null;a.forceTarget=null;a.forceTargetUntil=0;}
   else if(a.forceTarget!==a.hunting){a.forceTarget=a.hunting;a.forceTargetUntil=999;}
  }
  // The call: one per battle. A villain on the field brings 1-2 heroes in 1-3 rounds, aimed at the villain.
  if(!isCopUnit(a)||a.defeated||s.heroCall)return;
  const villain=Object.values(s.actors).find(u=>!u.defeated&&!u.notArrived&&u.side!=="civilian"&&isVillain(u));
  if(!villain)return;
  const n=H.seededChance(`${s.seed}:herocall:n`)<0.5?1:2;
  const atRound=s.round+1+Math.floor(H.seededChance(`${s.seed}:herocall:when`)*3);
  const side=villain.side==="player"?"enemy":"player";
  const picks=n===1?(H.seededChance(`${s.seed}:herocall:who`)<0.5?["super_hero"]:["super_heroine"]):["super_hero","super_heroine"];
  let placed=0;
  for(const chId of picks){
   const spot=edgeSpot(s,H,villain);
   if(!spot)continue;
   const ch=H.C.characters[chId],id=`hero-${chId}-${s.round}`;
   if(s.actors[id])continue;
   const base=s.actors.player||Object.values(s.actors)[0];
   const h=H.freshBody?H.freshBody(base,s):structuredClone(base);   // a fresh body, not the player's form (2026-10-27)
   Object.assign(h,{id,character:chId,name:ch.name,category:"hero",side,sprite:ch.sprite,ai:chId,controller:"ai",posture:"aggressive",
    permanentAlly:false,selectedConfig:null,x:spot[0],y:spot[1],maxLF:100,lf:100,pf:s.rules.maxPF,maxPF:s.rules.maxPF,ultimateCharge:0,
    primary:ch.primary,secondary:ch.secondary,reserve:[],reserveSlots:0,lens:structuredClone(ch.lens||{}),level:1,xp:0,proficiency:1,
    traits:[...(ch.traits||[])],passives:{},abilities:[],aiAbilities:null,learned:[],inventory:[],inventoryCapacity:2,
    reaction:0,ownerTurns:0,boss:null,size:null,massive:false,tempo:0,tempoCapacity:0,bankedTempo:0,tempoDebt:0,tempoSpent:0,actionsThisTurn:0,
    moved:false,acted:false,guardUsedThisTurn:false,defeated:true,notArrived:true,arrivesRound:atRound,arrivesFor:villain.id,
    eventActor:true,eventRole:"superhero",aggressive:true,persuaded:false,standDownUntil:null,willpower:10,maxWillpower:10,
    hunting:villain.id,forceTarget:villain.id,forceTargetUntil:999,
    vows:[],rite:null,riteAugment:null,inspiration:0,role:null,audition:null,typecast:null,bond:null,soul:s.rules.soul?.max??null,maxSoul:s.rules.soul?.max??null,husk:false});   // fresh badge, as the officer spawn: no inherited vows, rites, roles, bonds or souls
   h.status={guard:null,ward:null,parry:null,membrane:null,anchor:null,stun:null,entangled:null,immovable:null,exposed:null,attention:null,rangeBuff:null,tippingPoint:null,ambush:null,catharsis:null,drowning:null};
   s.actors[id]=h;
   if(!s.order.includes(id))s.order.push(id);
   s.disclosures[id]={};s.knowledge[id]={};s.observedAbilities[id]=[];
   placed++;
  }
  if(!placed)return;
  s.heroCall={villain:villain.id,atRound};
  say(s,H,a,`${a.name} calls it in: backup against ${villain.name} arrives round ${atRound}.`,["Defeat the villain first and the call is cancelled."]);
 }
 return {IDS,cuffed,target,resolve,aiValue,turnStart};
});
