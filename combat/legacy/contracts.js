"use strict";
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require("./desk-margin.js"));else root.ConceptCombatContracts=factory(root.ConceptCombatDeskMargin);})(typeof self!=='undefined'?self:this,function(DM){
 const sur=(DM&&DM.table&&DM.table.tariff&&DM.table.tariff.surcharge)||{beast:1,construct:1,concentrating:1,water:1,large:2};   // A4: the phi surcharge lives in the desk-margin table (T-A5); the fallback is the same numbers
 const specialties={none:{name:'None',mul:1,phi:0,seeds:0},beast:{name:'Beasts',mul:1.25,phi:sur.beast,seeds:100},construct:{name:'Constructs',mul:1.25,phi:sur.construct,seeds:100},large:{name:'Large bodies',mul:1.3,phi:sur.large,seeds:150},concentrating:{name:'Concentrating targets',mul:1.2,phi:sur.concentrating,seeds:100},water:{name:'Targets in water',mul:1.25,phi:sur.water,seeds:100}};
 function design(raw={},ability){
  const errors=[],steps=Array.isArray(raw.unlock)?raw.unlock:[],cast=raw.cast||{},active=raw.active||{},spec=raw.specialization||'none',spend=raw.spend||'strength',reset=raw.reset||'repeat';
  if(Object.keys(raw).some(k=>!['unlock','cast','active','specialization','spend','reset'].includes(k)))errors.push('Unknown contract layer.');
  if(steps.length>12)errors.push('At most 12 ordered steps in this prototype.');
  if(!specialties[spec])errors.push('Choose a registered specialization.');
  if(!['strength','reach','duration','efficiency'].includes(spend)||!['repeat','once'].includes(reset))errors.push('Choose a supported power allocation and reset.');
  if(Object.keys(cast).some(k=>!['lf','reaction','prepare','contact','extraPhi','ultimate','onlyType'].includes(k)))errors.push('Unsupported cast sacrifice.');
  if(Object.keys(active).some(k=>!['anchored','concentration','upkeep'].includes(k)))errors.push('Unsupported ongoing vow.');
  if(![0,10,20].includes(cast.lf||0)||![0,2,4,6].includes(cast.extraPhi||0)||![0,2,4].includes(active.upkeep||0))errors.push('Choose a supported resource sacrifice.');
  for(const [obj,keys] of [[cast,['reaction','prepare','contact','ultimate']],[active,['anchored','concentration']]])for(const k of keys)if(obj[k]!=null&&typeof obj[k]!=='boolean')errors.push('Vow switches must be boolean.');
  const normalized=[],credits=[],seen={};
  const credit=(kind,n,label)=>{seen[kind]=(seen[kind]||0)+1;credits.push({label,points:n,kind});};
  for(const step of steps){
   if(step?.kind==='move'&&[5,15,30].includes(step.amount)){normalized.push({kind:'move',amount:step.amount});credit('move',step.amount===5?1:step.amount===15?2:3,`Walk ${step.amount} tiles`);}
   else if(step?.kind==='defeat'){normalized.push({kind:'defeat',amount:1});credit('defeat',3,'Defeat a reward-eligible enemy');}
   else if(step?.kind==='invoke'&&typeof step.words==='string'&&step.words.trim().length>0&&step.words.length<=80){normalized.push({kind:'invoke',words:step.words.trim()});credit('invoke',1,'Speak invocation · 10 AP');}
   else errors.push('Unlock steps must be Walk 5/15/30, Defeat, or an invocation of 1–80 characters.');
  }
  if(cast.onlyType&&cast.onlyType!=='none'){if(!specialties[cast.onlyType])errors.push('Choose a registered target restriction.');else if(ability.target==='self'||ability.target==='ally')errors.push('Target-only restriction currently needs a single-target attack.');else credit('eligibility',2,'Only '+specialties[cast.onlyType].name);}
  if(reset==='once')credit('once',2,'Once per battle');
  if(cast.lf)credit('lf',cast.lf/5,`Pay ${cast.lf} LF`);
  if(cast.reaction)credit('reaction',2,'Spend reaction');
  if(cast.prepare)credit('prepare',2,'Prepare · 20 AP, wait until next owner turn, no movement');
  if(cast.extraPhi&&spend!=='efficiency')credit('phi',cast.extraPhi/2,`Pay +${cast.extraPhi} ΦF`);
  if(cast.ultimate)credit('ultimate',4,'Spend full ultimate bar');
  if(cast.contact){if(ability.range<=1||ability.delivery!=='line')errors.push('Contact restriction only earns power on a ranged line.');else credit('range',1,'Range restricted to 1');}
  const ongoing=!!(active.anchored||active.concentration||active.upkeep);
  if(ongoing){
   const fieldDamage=(ability.effect==='damage'||ability.scribedEffects?.some(e=>e.key==='damage'&&e.recipient==='target'))&&ability.delivery==='field';
   if(ability.effect!=='barrier'&&!fieldDamage&&!(ability.scribedEffects?.length&&ability.scribedEffects.every(e=>e.recipient==='self'&&['ward','adaptResistance'].includes(e.key))))errors.push('Ongoing vows need a Self ward or a field; instant line/contact attacks have nothing to maintain.');
   if(active.anchored)credit('position',2,'Stay on the casting tile');
   if(active.concentration)credit('focus',active.anchored?1:2,'Concentrate; other techniques end this effect');
   if(active.upkeep)credit('upkeep',active.upkeep/2,`Pay ${active.upkeep} ΦF each owner turn`);
  }
  if(spend==='reach'&&(ability.delivery!=='line'||cast.contact))errors.push('Reach allocation needs an unrestricted line.');
  if(spend==='duration'&&!ongoing)errors.push('Duration allocation needs an ongoing effect.');
  for(const kind of new Set(credits.map(x=>x.kind))){const group=credits.filter(x=>x.kind===kind).sort((a,b)=>b.points-a.points);group.forEach((x,i)=>{x.points=Math.round(x.points/(i+1)*100)/100;});}
  const rawPoints=credits.reduce((n,x)=>n+x.points,0),points=Math.min(12,Math.floor(rawPoints*100)/100),activePoints=rawPoints?credits.filter(x=>["position","focus","upkeep"].includes(x.kind)).reduce((n,x)=>n+x.points,0)*points/rawPoints:0,enabled=normalized.length>0||Object.values(cast).some(v=>v&&v!=='none')||ongoing||spec!=='none'||reset==='once';
  return {ok:!errors.length,errors,enabled,points,activePoints,initialMult:spend==='strength'?1+(points-activePoints)*.075:1,credits,contract:{unlock:normalized,cast:Object.fromEntries(Object.entries(cast).filter(([,v])=>v&&v!=='none')),active:Object.fromEntries(Object.entries(active).filter(([,v])=>v)),specialization:spec,spend,reset},specialty:specialties[spec],ongoing,duration:ongoing?(spend==='duration'?Math.min(3,2+Math.floor(points/4)):2):1,mult:spend==='strength'?1+points*.075:1,rangeAdd:spend==='reach'?Math.min(3,Math.floor(points/2)):0};
 }
 const stepLabel=(step,n=0)=>step.kind==='move'?`Walk ${n}/${step.amount} tiles`:step.kind==='defeat'?'Defeat one eligible enemy':`Speak “${step.words}” · 10 AP`;
 return {specialties,design,stepLabel,beastKinds:['termites','feralPig','nettleCaterpillar','ducks','porgy','wolf','moa','sasquatch']};
});
