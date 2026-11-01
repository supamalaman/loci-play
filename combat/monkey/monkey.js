"use strict";
// Monkey King (Mala, 2026-10-14): hair clones, mischief swaps, the somersault cloud,
// and a staff that reaches. State is JSON-only; randomness derives from seed and draws.
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.ConceptCombatMonkey=factory();
})(typeof self!=='undefined'?self:this,function(){
 const IDS=new Set(['hairClone','monkeyMischief','somersaultCloud','jinguBang','staffSky','merge','spareHair']);
 const status=u=>(u.status||={});
 const active=(x,a)=>x&&(x.until==null||x.until>=a.ownerTurns);
 const say=(s,H,a,text,why)=>H.log(s,{kind:'monkey',actor:a.id,text,...(why?{why}:{})});
 const isMonkey=a=>a&&a.primary==='deception'&&a.secondary==='leverage';
 // ── the clone: a real companion on a one-turn clock (Mala: real, one turn, then gone) ──
 const cloneOf=(s,ownerId)=>Object.values(s.actors).find(u=>!u.defeated&&u.companion&&u.companion.key==='hair_clone'&&u.companion.owner===ownerId)||null;
 const depthOf=(a)=>a&&a.companion&&a.companion.key==='hair_clone'?(a.companion.depth||0):-1;   // -1: the real monkey
 function spawnClone(s,a,H,tx,ty,free){
  const def=(s.rules.companions||{}).hair_clone;
  if(!def)return null;
  const ally={id:`companion-hair_clone-${a.id}-${s.round}-${++s.seq}`,name:def.name,side:a.side,controller:'ai',ai:'ally',character:'hair_clone',sprite:def.sprite,
   primary:def.primary,secondary:def.secondary,maxLF:def.lf,lf:def.lf,x:tx,y:ty,companion:{owner:a.id,key:'hair_clone',turnsLeft:def.turns,depth:depthOf(a)+1},
   pf:s.rules.maxPF,maxPF:s.rules.maxPF,ultimateCharge:0,level:a.level||1,xp:0,proficiency:a.proficiency||1,reserve:[],reserveSlots:0,pendingSwap:null,lens:{},
   reaction:s.rules.reactionsPerRound,moved:false,acted:false,tempo:0,tempoCapacity:0,bankedTempo:0,tempoDebt:0,tempoSpent:0,actionsThisTurn:0,guardUsedThisTurn:false,
   ownerTurns:0,lastRecoverTurn:-99,status:{guard:null,ward:null,parry:null,membrane:null,anchor:null,stun:null,entangled:null},inventory:[],inventoryCapacity:0,
   passives:{},traits:[],conditions:{},lanyardUsed:false,bristleconeUsed:false,lastDamageType:null,defeated:false};
  s.actors[ally.id]=ally;s.disclosures[ally.id]={};s.knowledge[ally.id]={};if(s.observedAbilities)s.observedAbilities[ally.id]=[];
  if(H.insightRules){const deck=H.insightRules.buildDeck({key:'summon:*',kind:'summon'},{seed:s.seed});s.insight.decks[ally.id]=deck;s.insight.knowledge[ally.id]=H.insightRules.spawnKnowledge(deck);}
  for(const other of Object.values(s.actors))if(other.id!==ally.id&&other.side!==ally.side){(s.knowledge[other.id]||={})[ally.id]||={secondary:false,lens:false,abilities:{}};s.knowledge[ally.id][other.id]={secondary:false,lens:false,abilities:{}};}
  s.order.splice(s.turnIndex+1,0,ally.id);
  const arrival=(def.arrival||'springs from the plucked hair').replace('{owner}',a.name).replace('{turns}',def.turns);
  say(s,H,a,`${def.name} ${arrival} at (${tx},${ty})${free?' (a spare hair: no PF cost)':''}.`,['Real: it moves, Strikes, blocks tiles, and can be hurt and killed.','Gone at the end of its first turn.']);
  return ally;
 }
 function consumeClone(s,H,a,clone,why){
  clone.defeated=true;clone.escaped=true;clone.leaveReason=why||'merges back';clone.tempo=0;
  say(s,H,a,`${clone.name} ${why||'merges back with a pop'}.`);
 }
 const openTile=(s,H,x,y)=>H.inside(s,x,y)&&!H.tileAt(s,x,y).blocksMove&&!H.actorAt(s,x,y)&&!H.barrierAt(s,x,y);
 function straightTo(s,H,a,tx,ty){
  const dx=tx-a.x,dy=ty-a.y;
  if(dx!==0&&dy!==0&&Math.abs(dx)!==Math.abs(dy))return {error:'Pick a straight line: orthogonal or diagonal.'};
  return {path:H.line(a.x,a.y,tx,ty).slice(1)};
 }
 function beforeAbility(s,a,m){
  const id=m.id||m.ability;if(!IDS.has(id))return null;
  const clone=cloneOf(s,a.id);
  if((id==='hairClone'||id==='spareHair')&&depthOf(a)>=1)return 'A copy of a copy is too thin to pluck.';
  if((id==='hairClone'||id==='spareHair')&&clone)return 'One clone of your own at a time: your hair already lives.';
  if((id==='monkeyMischief'||id==='merge')&&!clone)return 'No living clone: pluck a hair first.';
  if(id==='merge'&&(a.inspiration||0)<2)return 'Merge needs 2 Inspiration.';
  if(id==='spareHair'&&(a.inspiration||0)<1)return 'Spare Hair needs 1 Inspiration.';
  return null;
 }
 function target(s,a,m,tx,ty,H){
  const id=m.id||m.ability;if(!IDS.has(id))return null;
  const fail=(error)=>({ok:false,error});
  const gate=beforeAbility(s,a,m);if(gate)return fail(gate);
  const clone=cloneOf(s,a.id);
  if(id==='monkeyMischief')return {ok:true,tiles:[[a.x,a.y]],targets:[clone.id]};
  if(tx==null||!H.inside(s,tx,ty))return fail('Choose a tile.');
  if(id==='hairClone'||id==='spareHair'){
   if(H.dist(s,a.x,a.y,tx,ty)>3)return fail('The hair lands within 3.');
   if(!openTile(s,H,tx,ty))return fail('The hair needs an open tile.');
   return {ok:true,tiles:[[tx,ty]],targets:[]};
  }
  if(id==='somersaultCloud'){
   const l=straightTo(s,H,a,tx,ty);if(l.error)return fail(l.error);
   if(l.path.length<1||l.path.length>6)return fail('The cloud carries 1 to 6 tiles.');
   if(!openTile(s,H,tx,ty))return fail('Nowhere to land: the tile must be open.');
   return {ok:true,tiles:[[tx,ty]],targets:[]};
  }
  if(id==='jinguBang'){
   const occ=H.actorAt(s,tx,ty);
   if(!occ||occ.side===a.side||occ.defeated)return fail('Choose a foe in line.');
   if(H.dist(s,a.x,a.y,tx,ty)>3)return fail('The staff reaches 3.');
   const l=straightTo(s,H,a,tx,ty);if(l.error)return fail(l.error);
   for(const [x,y] of l.path.slice(0,-1)){const u=H.actorAt(s,x,y);if(u&&u.id!==a.id&&!u.defeated)return fail(`${u.name} is in the way: the staff strikes the first in line.`);}
   return {ok:true,tiles:[[tx,ty]],targets:[occ.id]};
  }
  if(id==='staffSky'){
   const l=straightTo(s,H,a,tx,ty);if(l.error)return fail(l.error);
   const step=l.path.length?[Math.sign(tx-a.x),Math.sign(ty-a.y)]:null;
   if(!step)return fail('Choose a direction.');
   const tiles=[];for(let i=1;i<=7;i++){const x=a.x+step[0]*i,y=a.y+step[1]*i;if(!H.inside(s,x,y))break;tiles.push([x,y]);}
   const targets=tiles.map(([x,y])=>H.actorAt(s,x,y)).filter(u=>u&&u.side!==a.side&&!u.defeated).map(u=>u.id);
   return {ok:true,tiles,targets};
  }
  if(id==='merge'){
   const occ=H.actorAt(s,tx,ty);
   if(!occ||occ.side===a.side||occ.defeated)return fail('Choose a foe near your clone.');
   if(H.dist(s,clone.x,clone.y,tx,ty)>3)return fail('Merge strikes within 3 of the clone.');
   return {ok:true,tiles:[[tx,ty]],targets:[occ.id]};
  }
  return null;
 }
 function resolve(s,a,inst,H){
  const id=inst.ability;if(!IDS.has(id))return false;
  if(id==='hairClone'||id==='spareHair'){
   if(id==='spareHair'&&!H.spendInspiration(s,a,1)){say(s,H,a,`${a.name}'s Spare Hair fizzles: the purse is empty.`);return true;}
   if(cloneOf(s,a.id)){say(s,H,a,`${a.name}'s pluck fizzles: the hair already lives.`);return true;}
   const [tx,ty]=inst.tiles[0];
   if(!openTile(s,H,tx,ty)){say(s,H,a,`${a.name}'s pluck fizzles: (${tx},${ty}) is no longer open.`);return true;}
   spawnClone(s,a,H,tx,ty,id==='spareHair');return true;
  }
  if(id==='monkeyMischief'){
   const clone=cloneOf(s,a.id);
   if(!clone){say(s,H,a,`${a.name}'s Mischief fizzles: no living clone.`);return true;}
   if(!H.dreamSame(s,a.x,a.y,clone.x,clone.y)){say(s,H,a,`${a.name}'s Mischief fizzles: the sealed Dream Space holds.`);return true;}
   const ax=a.x,ay=a.y;a.x=clone.x;a.y=clone.y;clone.x=ax;clone.y=ay;
   status(clone).concealed={until:clone.ownerTurns};
   say(s,H,a,`${a.name} swaps with the clone: now he stands at (${a.x},${a.y}) and the hair hides until its turn.`);return true;
  }
  if(id==='somersaultCloud'){
   const [tx,ty]=inst.tiles[0],l=straightTo(s,H,a,tx,ty);
   if(l.error||l.path.length<1||l.path.length>6){say(s,H,a,`${a.name}'s cloud fizzles: ${l.error||'out of range'}.`);return true;}
   if(!openTile(s,H,tx,ty)){say(s,H,a,`${a.name}'s cloud fizzles: nowhere to land.`);return true;}
   a.x=tx;a.y=ty;a.moved=true;
   say(s,H,a,`${a.name} somersaults over everything to (${tx},${ty}).`);return true;
  }
  if(id==='jinguBang'){
   const t=H.actor(s,inst.targets[0]);
   if(!t||t.defeated){say(s,H,a,`${a.name}'s staff finds nothing.`);return true;}
   H.hit(s,a,t,{...inst,name:'Jingu Bang'},8,['As-you-will: the cudgel is exactly as long as the fight needs.'],{label:'Jingu Bang'});
   return true;
  }
  if(id==='staffSky'){
   const struck=[];
   for(const [x,y] of inst.tiles||[]){const u=H.actorAt(s,x,y);if(u&&u.side!==a.side&&!u.defeated){H.hit(s,a,u,{...inst,name:'Staff That Fills the Sky'},16,['The staff becomes the horizon; the horizon falls on one line.'],{label:'Staff That Fills the Sky'});struck.push(u.name);}}
   if(!struck.length)say(s,H,a,`${a.name}'s sky-filling sweep finds no one on the announced line.`);
   return true;
  }
  if(id==='merge'){
   const clone=cloneOf(s,a.id),t=H.actor(s,inst.targets[0]);
   if(!clone){say(s,H,a,`${a.name}'s Merge fizzles: no living clone.`);return true;}
   if(!t||t.defeated){say(s,H,a,`${a.name}'s Merge finds nothing.`);return true;}
   if(H.dist(s,clone.x,clone.y,t.x,t.y)>3){say(s,H,a,`${a.name}'s Merge fizzles: ${t.name} is out of the clone's reach.`);return true;}
   if(!H.spendInspiration(s,a,2)){say(s,H,a,`${a.name}'s Merge fizzles: the purse is empty.`);return true;}
   H.hit(s,a,t,{...inst,fromTile:[clone.x,clone.y],name:'Merge'},12,['Two become one, through the enemy.'],{label:'Merge'});
   consumeClone(s,H,a,clone,'merges back with a pop');return true;
  }
  return false;
 }
 const foeNear=(s,a,n,H)=>Object.values(s.actors).some(u=>u.side!==a.side&&!u.defeated&&H.dist(s,a.x,a.y,u.x,u.y)<=n);
 function aiValue(s,a,cand,H){
  const id=cand.ability;if(!IDS.has(id))return null;
  const clone=cloneOf(s,a.id);
  if(id==='hairClone'||id==='spareHair'){
   if(clone)return null;
   if(id==='spareHair'&&(a.inspiration||0)<1)return null;
   return foeNear(s,a,6,H)?5.5:1.5;   // 5.5 clears Feint/jinguBang on the damage scale (×1.8 − PF×0.2 ≈ 8.7 vs 7.1): a second body for a turn is worth more than one strike (Mala, 2026-10-17: the clone never fired at 4)
  }
  if(id==='monkeyMischief'){
   if(!clone)return null;
   return a.lf<a.maxLF/2?7:3;
  }
  if(id==='somersaultCloud')return foeNear(s,a,6,H)?2.5:1;
  if(id==='jinguBang')return 5;
  if(id==='staffSky'){
   if(!cand.target)return 5;
   const l=straightTo(s,H,a,cand.target[0],cand.target[1]);if(l.error)return 1;
   const step=[Math.sign(cand.target[0]-a.x),Math.sign(cand.target[1]-a.y)];
   let n=0;for(let i=1;i<=7;i++){const u=H.actorAt(s,a.x+step[0]*i,a.y+step[1]*i);if(u&&u.side!==a.side&&!u.defeated)n++;}
   return n?Math.min(9,3+2*n):1;
  }
  if(id==='merge'){
   if(!clone||(a.inspiration||0)<2)return null;
   const t=cand.target&&H.actorAt(s,cand.target[0],cand.target[1]);
   return t&&t.side!==a.side&&H.dist(s,clone.x,clone.y,t.x,t.y)<=3?8:1;
  }
  return null;
 }
 return {IDS,cloneOf,isMonkey,beforeAbility,target,resolve,aiValue};
});
