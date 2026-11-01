"use strict";
// The Intergalactic Faction (Mala, 2026-10-16): Greys who come down in a random event, pick one
// character sprite on landing, and perform their own ritual capture to take them. Retaliate-only:
// they start no fights and hold none open for anyone else's sake, but a side that hits one of
// them is at war. If the victim is the player and the ritual completes, the battle ends in
// abduction and the escape-ship mission begins (ui.js report chain).
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.ConceptCombatVisitors=factory();
})(typeof self!=='undefined'?self:this,function(){
 const SIDE="visitors";
 const GREY_LF=45, SHIP_LF=150, SCIENTIST_LF=40, CHANT_TURNS=2;
 const is=(u)=>!!u&&u.side===SIDE;
 const isShip=(u)=>is(u)&&u.character==="visitor_ship";
 const isScientist=(u)=>is(u)&&u.character==="visitor_scientist";
 const book=(s)=>(s.visitors||={hostileTo:[],victimId:null});
 const hostileTo=(s,side)=>!!s.visitors?.hostileTo.includes(side);
 // The specimen, if it is still on the field to take.
 const victimOf=(s)=>{const v=s.actors?.[s.visitors?.victimId];return v&&!v.defeated&&!v.escaped&&!v.notArrived?v:null;};
 // Decided upon landing: one random live character sprite on the field, visitors excluded.
 // Summons and communed are sprites too, but the ship wants a person: characters only, never a boss.
 function pickVictim(s,H){
  const pool=Object.values(s.actors||{}).filter(u=>u&&!u.defeated&&!u.notArrived&&!is(u)
   &&!u.summon&&!u.communed&&!u.beast&&!u.boss&&u.character&&H.C?.characters?.[u.character]);
  if(!pool.length)return null;
  const h=Math.abs(Math.imul((s.seed||1)^Math.imul(s.round+7,2654435761),2246822519))>>>0;
  return pool[h%pool.length].id;
 }
 // Arrival: one ship and two agents. Life Force is set on landing (the engine's specs carry no stats).
 function specs(event){
  return [{character:"visitor_ship",side:SIDE,role:"visitorShip",arrivesRound:event.round},
   {character:"visitor_grey",side:SIDE,role:"visitorGrey",arrivesRound:event.round},
   {character:"visitor_grey",side:SIDE,role:"visitorGrey",arrivesRound:event.round},
   {character:"visitor_scientist",side:SIDE,role:"visitorScientist",arrivesRound:event.round}];
 }
 function arrive(s,event,H){
  const b=book(s),crew=(event.actorIds||[]).map(id=>s.actors[id]).filter(u=>u&&!u.defeated);
  for(const u of crew){const lf=isShip(u)?SHIP_LF:isScientist(u)?SCIENTIST_LF:GREY_LF;u.maxLF=lf;u.lf=lf;}
  const victimId=pickVictim(s,H);
  if(!victimId){   // nothing worth taking: the light sweeps the field and moves on
   for(const u of crew){u.defeated=true;u.escaped=true;u.noXp=true;u.tempo=0;u.leaveReason="nothing worth taking";}
   H.log(s,{kind:"faction",actor:crew[0]?.id||null,tiles:crew[0]?[[crew[0].x,crew[0].y]]:[],text:"A light sweeps the battlefield, holds a moment, and moves on. Nothing here worth taking.",why:["The visitors only come down for a living person, and there was no one left to take."]});
   return null;
  }
  b.victimId=victimId;
  const victim=s.actors[victimId];
  H.log(s,{kind:"faction",actor:crew[0]?.id||null,target:victimId,text:`A ship comes down at the field's edge and two grey agents and their scientist step out. They want ${victim.name}.`,why:["They came for one specimen, not a war. Break the chant before it completes — or hit them and have the war instead."]});
  return victimId;
 }
 function atWar(s,a,t){
  if(!a||!t)return true;
  if(is(a)&&is(t))return false;
  if(is(a)){
   if(t.id===s.visitors?.victimId)return false;   // the specimen is never a target
   return t.side!==SIDE&&hostileTo(s,t.side);
  }
  if(is(t)){
   const held=s.actors?.[t.ritual?.monsterId];   // breaking the chant is always legal for the specimen's side
   if(t.ritual?.visitor&&held&&held.side===a.side)return true;
   return hostileTo(s,a.side);
  }
  return true;
 }
 function attacked(s,src,tgt,H){
  if(!src||!tgt||src.id===tgt.id||!s.actors?.[src.id]||src.side===tgt.side||is(src)||!is(tgt)||s.preview)return;
  const b=book(s);
  if(!b.hostileTo.includes(src.side)){
   b.hostileTo.push(src.side);
   H.log(s,{kind:"faction",actor:tgt.id,target:src.id,text:`${src.name} attacks ${tgt.name}: the visitors are now hostile to ${src.side==="player"?"the player's side":src.side==="enemy"?"the opposing side":`the ${src.side} side`}.`,why:["They came for one specimen, not a war. Hitting them starts one — and a hit that gets through still breaks the chant."]});
  }
 }
 // Retaliate-only, enforced at damage: a visitor's attack fizzles against a side it is not at war with.
 function blocked(s,src,tgt){
  return !!src&&!!tgt&&is(src)&&!is(tgt)&&src.id!==tgt.id&&!hostileTo(s,tgt.side);
 }
 // The retrieval chant: the player ritual's shape (hold still, take no damage, two turns) with no
 // weakening and no bead at the end — the specimen goes up into the ship instead.
 function canChant(s,grey,victimId,H){
  if(!grey||grey.defeated||!is(grey)||isShip(grey)||isScientist(grey))return "Only a grey agent performs the retrieval.";
  if(grey.ritual)return "Already holding a chant.";
  const v=victimOf(s);
  if(!v)return "The specimen is gone.";
  if(v.id!==victimId)return "The manifest names one specimen.";
  if(H.chanted?.(s,v.id))return "Someone is already chanting over it.";
  if(H.dist(s,grey.x,grey.y,v.x,v.y)>H.RITUAL.range)return `The chant reaches ${H.RITUAL.range} tiles.`;
  return null;
 }
 function chant(s,grey,victimId,H){
  const v=s.actors[victimId];
  grey.ritual={monsterId:victimId,turnsLeft:CHANT_TURNS,visitor:true};
  (s.captureLog||=[]).push({actor:grey.id,kind:"visitor",started:true});
  H.log(s,{kind:"ritual",actor:grey.id,target:victimId,tiles:[[v.x,v.y]],started:true,text:`${grey.name} begins the retrieval chant over ${v.name}.`,why:[`${v.name} hangs suspended: nothing can hit them and they cannot act. Break the agent's chant within ${CHANT_TURNS} of its turns or ${v.name} goes up into the ship.`]});
 }
 // No specimen, no reason to stay: the crew lifts (silently clears chants — this is leaving, not breaking).
 function depart(s,H,why){
  const b=book(s);if(b.departed)return;b.departed=true;
  const crew=Object.values(s.actors||{}).filter(u=>is(u)&&!u.defeated);
  for(const u of crew){u.ritual=null;u.defeated=true;u.escaped=true;u.noXp=true;u.tempo=0;u.leaveReason=why||"the specimen is gone";}
  H.log(s,{kind:"faction",actor:crew[0]?.id||null,text:`The light folds and the visitors are gone (${why||"the specimen is gone"}).`,why:["They came for one specimen. Without it there is no ritual and no war."]});
 }
 // The specimen is taken: off the field, into the ship. Anyone else's battle goes on.
 // s.abduction is the P2 chain link: the escape-ship mission starts from it (ui.js report chain).
 function abduct(s,victim,H){
  const b=book(s);
  victim.defeated=true;victim.escaped=true;victim.abducted=true;victim.noXp=true;victim.tempo=0;
  victim.leaveReason="taken by the visitors";
  const crew=Object.values(s.actors||{}).filter(u=>is(u)&&!u.defeated);
  for(const u of crew){u.defeated=true;u.escaped=true;u.noXp=true;u.tempo=0;u.leaveReason="beamed up with the specimen";if(u.ritual)u.ritual=null;}
  s.abduction={victim:victim.id,round:s.round};
  H.log(s,{kind:"faction",actor:victim.id,text:`${victim.name} is taken: the light folds and the visitors are gone with the specimen.`,why:["The ritual completed. What happens aboard the ship is another mission."]});
  return {victim:victim.id,crew:crew.map(u=>u.id)};
 }
 const hold=(s,a)=>{   // the ship never leaves its landing tile; a watching agent plants its feet
  if(!a.guardUsedThisTurn&&a.tempo>=s.rules.actionCosts.guard)return {type:"guard",actor:a.id};
  return {type:a.tempo>0?"stall":"end",actor:a.id};
 };
 // Turn decisions for the crew. Null falls through to ordinary AI (a hostile grey fights; atWar bounds it).
 function advise(s,a,H){
  if(isShip(a))return hold(s,a);
  if(isScientist(a)){   // support: hold with the landing party until there is a war, then work (heals, walls, fire) through ordinary AI
   if(a.controller==="player")return null;
   const war=Object.values(s.actors||{}).some(u=>u&&!u.defeated&&!is(u)&&hostileTo(s,u.side));
   return war?null:hold(s,a);
  }
  if(a.ritual||a.controller==="player")return null;   // a chanting agent is held by the channeler branch
  const v=victimOf(s);
  if(!v){if(!s.preview)depart(s,H,"the specimen is gone");return {type:"end",actor:a.id};}
  if(H.chanted?.(s,v.id)){   // the chant is held: watch, unless there is a war to fight
   if(Object.values(s.actors||{}).some(u=>u&&!u.defeated&&!is(u)&&hostileTo(s,u.side)))return null;
   return hold(s,a);
  }
  const err=canChant(s,a,v.id,H);
  if(!err&&a.tempo>=H.RITUAL.ap){
   const act={type:"visitorRitual",actor:a.id,target:v.id};
   if(H.apply(s,act,{preview:true}).ok)return act;
  }
  const near=(at)=>Math.abs(at[0]-v.x)+Math.abs(at[1]-v.y);   // close with the specimen
  const step=H.moveOptions(s,a.id).filter(o=>near(o.to)<near([a.x,a.y])).sort((p,q)=>near(p.to)-near(q.to)||p.tempoCost-q.tempoCost);
  for(const o of step.slice(0,4))if(H.apply(s,{type:"move",actor:a.id,to:o.to},{preview:true}).ok)return {type:"move",actor:a.id,to:o.to};
  return hold(s,a);
 }
 return { SIDE, GREY_LF, SHIP_LF, SCIENTIST_LF, CHANT_TURNS, is, isShip, isScientist, book, hostileTo, victimOf, pickVictim, specs, arrive, atWar, attacked, blocked, canChant, chant, depart, abduct, advise };
});
