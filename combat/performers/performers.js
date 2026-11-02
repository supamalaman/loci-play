"use strict";
// Shared performance mechanics. State is JSON-only; randomness derives from seed and committed draws.
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('../kits/kits-data.js'),require('../classes/classes-data.js'));
 else root.ConceptCombatPerformers=factory(root.ConceptCombatKits,root.ConceptCombatClassData);
})(typeof self!=='undefined'?self:this,function(K,D){
 const IDS=new Set(['consonance','lullaby','enchantingAir','freestyle','writtenVerse','chorus','headlineVerse','encore','balladOfTheBattle','dissTrack','riff','jazzSolo','blueNote','cuttingContest']);
// Performer pairs as sets (order-blind): a Musician playing the words config still counts as a
// musician for joining a jam. Only the exact Lyricism-first pair LEADS one (isJazz, below).
const MUSIC_PAIRS=[["lyricism","collage"],["harmony","resonance"],["harmony","complementarity"],["lyricism","harmony"]].map(p=>[...p].sort().join("+"));
const pairKey=(u)=>[u.primary||"",u.secondary||""].sort().join("+");
const isMusician=(u)=>MUSIC_PAIRS.includes(pairKey(u));
const isJazz=(a)=>a.primary==="lyricism"&&a.secondary==="harmony";
// What a joiner may answer with: performer basics and refineds, never an ult or a merge.
const JOINABLE=['riff','consonance','lullaby','enchantingAir','freestyle','writtenVerse'];
const disc=(s,H,a,r)=>{const out=[];for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const x=a.x+dx,y=a.y+dy;if(H.dist(s,a.x,a.y,x,y)<=r&&H.inside(s,x,y))out.push([x,y]);}return out;};
const hearers=(s,H,a,r,side)=>units(s).filter(u=>!u.defeated&&!u.notArrived&&u.id!==a.id&&(side==="foe"?u.side!==a.side:u.side===a.side)&&H.dist(s,a.x,a.y,u.x,u.y)<=r&&H.canHear(s,a,u)).sort((u,v)=>H.dist(s,a.x,a.y,u.x,u.y)-H.dist(s,a.x,a.y,v.x,v.y)||u.id.localeCompare(v.id));
// Enemies in 4 with a quotable technique this round (their last act, never an ult or a merge).
const challengers=(s,H,a)=>units(s).filter(u=>!u.defeated&&!u.notArrived&&u.side!==a.side&&H.dist(s,a.x,a.y,u.x,u.y)<=4&&lastRoundTechnique(s,H,u)).sort((u,v)=>u.id.localeCompare(v.id));
const lastRoundTechnique=(s,H,u)=>{const acts=(s.log||[]).filter(e=>e.kind==='act'&&e.actor===u.id&&e.round===s.round&&e.ability);for(let i=acts.length-1;i>=0;i--){const d=H.ability(acts[i].ability);if(d&&d.tier!=='ultimate'&&!d.merge)return acts[i].ability;}return null;};
 const units=s=>[...Object.values(s.actors||{}),...(s.wild||[]).filter(u=>u.form==='unit')].filter(u=>!u.defeated&&(u.lf??u.hp??1)>0);
 const say=(s,H,a,text)=>H.log(s,{kind:'performance',actor:a.id,text});
 const state=s=>(s.performers||={draws:{},damageRound:{}});
 const status=u=>(u.status||={});
 const muted=a=>!!(a.defeated||(a.status?.silenced&&!(a.status.silenced.until<a.ownerTurns))||a.status?.stun||a.status?.held?.freedoms?.some(f=>['voice','breath'].includes(f))||a.stunTempo>0);
 function pool(a,C,refined=false){
  return Object.entries(C.abilities).filter(([id,d])=>['basic',...(refined?['refined']:[])].includes(d.tier)&&!d.merge&&!d.pairs&&!d.classKind&&!d.fruitOnly&&!IDS.has(id)&&d.concepts?.length&&d.concepts.every(c=>C.concepts[c]&&![a.primary,a.secondary,'lyricism'].includes(c))).map(([id])=>id).sort();
 }
 function draw(s,a,ids,count){
  const n=state(s).draws[a.id]||0;let seed=(s.seed^Math.imul(n+1,2654435761)^Math.imul(a.ownerTurns||0,1664525))>>>0;
  const result=[],remaining=ids.slice();
  while(result.length<count&&remaining.length){seed=(Math.imul(seed,1664525)+1013904223)>>>0;result.push(remaining.splice(seed%remaining.length,1)[0]);}
  state(s).draws[a.id]=n+1;return result;
 }
 function tune(s,a,H,radius=2){
  let count=0;
  const word=a.primary==='harmony'&&a.secondary==='lyricism'?draw(s,a,H.borrowPool(s,a,false),1)[0]:null;
  for(const u of units(s))if(u.id!==a.id&&u.side===a.side&&H.dist(s,a.x,a.y,u.x,u.y)<=radius&&H.canReach(s,a,u)){
   status(u).inTune={source:a.id,potencyMul:1+.15*(1+(a.status?.keyStacks||0)*.05),sourceTurn:a.ownerTurns,words:word?H.ability(word).damageType||H.conceptChannel(H.ability(word).concepts[0]):null};count++;
  }
  return count;
 }
 function immune(t){return !!(t.golden||t.form?.golden||t.integrated||t.bossCondition==='enraged'||t.condition==='enraged'||t.bossState?.condition==='enraged'||t.conditions?.enraged);}
 // Persuasive (Mala, 2026-10-12): rapping and singing persuade too. A Persuasive performer's songs soothe 15 points more
 // often and their verses and Diss Track land 15% harder. Same size as insight-data.js traits.persuasive.speech.chanceAdd.
 const PERSUASIVE={sootheAdd:.15,verseMul:1.15};
 const persuasive=a=>(a?.traits||[]).some(t=>(typeof t==='string'?t:t?.id)==='persuasive');
 function sootheChance(a,t,id){
  const spec=K.staged[id]?.soothe;if(!spec||immune(t))return 0;
  let chance=spec.chance[D.magic.listenerKind(t.form==='unit'?{...t,wild:true}:t)];
  if(t.status?.membrane||t.committed||t.status?.vow)return 0;
  if(t.status?.anchor)chance*=0.5;
  if(persuasive(a)&&chance>0)chance=Math.min(.95,chance+PERSUASIVE.sootheAdd);
  return chance;
 }
 function soothe(s,a,t,id,H){
  const spec=K.staged[id]?.soothe;if(!spec||muted(a)||!H.canHear(s,a,t)||s.performers?.damageRound?.[t.id]?.[a.side]===s.round)return false;
  const kind=D.magic.listenerKind(t.form==='unit'?{...t,wild:true}:t),chance=sootheChance(a,t,id);
  const n=state(s).draws['soothe:'+a.id]||0;state(s).draws['soothe:'+a.id]=n+1;
  const hash=(Math.imul((s.seed||0)^Math.imul(n+1,2246822519)^Math.imul(s.round,3266489917)^String(t.id).split('').reduce((v,c)=>Math.imul(v,31)+c.charCodeAt(0),0),1664525)+1013904223)>>>0;
  const took=hash/4294967296<chance;
  if(took){delete t.focus;delete t.status?.attention;}
  if(took)status(t).soothed={source:a.id,side:a.side,throughTurn:(t.ownerTurns||0)+(spec[kind+'Turns']||spec.turns),wildUntil:s.round+(spec[kind+'Turns']||spec.turns)};
  say(s,H,a,`${t.name||t.id} ${took?'is soothed':'resists '+K.staged[id].name} (${Math.round(chance*100)}% chance; ${kind}).`);return took;
 }
 function beforeAbility(s,a,m){
  if(a.status?.soothed&&hostile(m))return 'Soothed: choose movement, guard, or a non-hostile action until the song ends.';
  if(IDS.has(m.id||m.ability)&&muted(a))return 'The performer cannot sing while stunned or silenced.';
  return null;
 }
 const hostile=m=>m.target==='enemy'||m.effect==='damage'||m.potency>0||['lullaby','enchantingAir','dissTrack'].includes(m.id||m.ability);
 function target(s,a,m,x,y,H){
  const id=m.id||m.ability;if(!IDS.has(id))return null;
  const fail=error=>({ok:false,error});if(muted(a))return fail('The performer cannot sing while stunned or silenced.');
  if(id==='riff'){const t=units(s).find(u=>!u.defeated&&u.x===x&&u.y===y);if(!t||t.side!==a.side||t.id===a.id)return fail('Riff needs one ally (never the singer).');if(H.dist(s,a.x,a.y,x,y)>4)return fail('Riff reaches 4.');if(!H.canHear(s,a,t))return fail(`${t.name} can't hear the riff.`);return {ok:true,tiles:[[x,y]],targets:[t.id]};}
  if(id==='jazzSolo'){if(x!==a.x||y!==a.y)return fail('Solo from your own tile.');if((a.inspiration||0)<2)return fail('Jazz Solo needs 2 Inspiration.');const p=a.status?.soloPhrase;if(!p||!H.ability(p.id))return fail('Jazz Solo needs a recastable last technique.');if(a.status?.soloTurn===a.ownerTurns)return fail('One Solo per turn.');return {ok:true,tiles:[[x,y]],targets:[]};}
  if(id==='blueNote'){if(x!==a.x||y!==a.y)return fail('Blue Note sounds from your own tile.');const hs=hearers(s,H,a,10,'foe');if(!hs.length)return fail('Blue Note needs a hearing enemy within 10.');return {ok:true,tiles:disc(s,H,a,10),targets:hs.map(u=>u.id)};}
  if(id==='cuttingContest'){if(x!==a.x||y!==a.y)return fail('The contest starts on your own tile.');const cs=challengers(s,H,a);if(!cs.length)return fail('Cutting Contest needs an enemy in 4 that performed this round.');return {ok:true,tiles:disc(s,H,a,4),targets:cs.map(u=>u.id)};}
  if(['lullaby','enchantingAir','dissTrack'].includes(id)){
   const t=units(s).find(u=>u.x===x&&u.y===y);
   if(!t||t.side===a.side)return fail('Choose an opponent.');
   if(H.dist(s,a.x,a.y,x,y)>(id==='dissTrack'?5:4)||!H.canHear(s,a,t))return fail('The song cannot reach that target.');
   if(s.performers?.damageRound?.[t.id]?.[a.side]===s.round)return fail('Your side has already harmed that listener this round.');
   if(id==='dissTrack'&&new Set((s.log||[]).filter(e=>e.kind==='act'&&e.actor===t.id&&e.ability&&s.knowledge?.[a.id]?.[t.id]?.abilities?.[e.ability]).map(e=>e.ability)).size<3)return fail('Diss Track needs three different witnessed techniques.');
   return {ok:true,tiles:[[x,y]],targets:[t.id]};
  }
  if(x!==a.x||y!==a.y)return fail('Perform from your own tile.');
  if(['consonance','chorus','balladOfTheBattle'].includes(id)&&!units(s).some(u=>u.id!==a.id&&u.side===a.side&&H.dist(s,a.x,a.y,u.x,u.y)<=(id==='consonance'?2:99)))return fail('This song needs an ally.');
  if(['freestyle','writtenVerse','headlineVerse'].includes(id)){
   if(a.status?.verse)return fail('Deliver or discard the verse already held.');
   if(!H.borrowPool(s,a,id!=='freestyle').length)return fail('No unequipped technique has a legal target.');
  }
  return {ok:true,self:true,tiles:[[a.x,a.y]],targets:[a.id]};
 }
 function resolve(s,a,inst,H){
  const id=inst.ability;if(!IDS.has(id))return false;
  if(id==='consonance'){say(s,H,a,`${a.name} tunes ${tune(s,a,H)} allies: their next technique is ×1.15.`);return true;}
  if(['lullaby','enchantingAir'].includes(id)){const t=units(s).find(u=>u.id===inst.targets[0]);if(t)soothe(s,a,t,id,H);return true;}
  if(['freestyle','writtenVerse','headlineVerse'].includes(id)){
   const ids=H.borrowPool(s,a,id!=='freestyle'),choices=draw(s,a,ids,id==='freestyle'?1:3);
   status(a).verse={choices,id:choices.length===1?choices[0]:null,until:a.ownerTurns+(id==='freestyle'?0:2),mul:(id==='freestyle'?.85:id==='headlineVerse'?1.2:1)*(persuasive(a)?PERSUASIVE.verseMul:1),freeAp:id==='freestyle',kind:id};
   say(s,H,a,`${a.name} ${id==='freestyle'?'draws':'writes'} ${choices.map(x=>H.ability(x).name).join(' / ')}. ${choices.length>1?'Choose one line, then deliver it within two turns.':'Deliver it now; the draw already paid its AP and ΦF.'}`);return true;
  }
  if(['chorus','encore','balladOfTheBattle'].includes(id)){
   status(a).song={id,left:id==='chorus'?2:3,started:a.ownerTurns,performed:a.ownerTurns,radius:id==='balladOfTheBattle'?99:3,previous:null};
   pulse(s,a,H);return true;
  }
  if(id==='dissTrack'){
   const t=units(s).find(u=>u.id===inst.targets[0]);if(!t)return true;
   const counts=new Map();for(const e of s.log||[])if(e.kind==='act'&&e.actor===t.id&&e.ability&&s.knowledge?.[a.id]?.[t.id]?.abilities?.[e.ability])counts.set(e.ability,(counts.get(e.ability)||0)+1);
   const seen=[...counts.keys()].filter(x=>H.ability(x)?.tier!=='ultimate'&&!H.ability(x)?.merge&&!H.ability(x)?.classKind).sort((x,y)=>counts.get(y)-counts.get(x)||x.localeCompare(y)).slice(0,3);
   for(const ability of seen)H.borrowPerform(s,a,ability,t.x,t.y,.7*(persuasive(a)?PERSUASIVE.verseMul:1),inst.performanceChannel);
   say(s,H,a,`${a.name} quotes ${seen.length} witnessed techniques, each at ×0.7 with its original prerequisites.`);return true;
  }
  if(id==='riff'){const t=units(s).find(u=>u.id===inst.targets[0]);if(!t)return true;status(t).inTune={source:a.id,potencyMul:1.15,sourceTurn:a.ownerTurns,words:null};say(s,H,a,`${a.name} riffs ${t.name} into the key: their next technique is ×1.15.`);return true;}
  if(id==='jazzSolo'){const p=a.status?.soloPhrase,last=p&&H.ability(p.id);
   if(p&&last&&H.borrowPerform(s,a,p.id,p.aim[0],p.aim[1],1.0)){H.spendInspiration(s,a,2);a.status.soloTurn=a.ownerTurns;say(s,H,a,`${a.name} solos ${last.name} again, free.`);}
   else{a.pf=Math.min(a.maxPF??99,(a.pf||0)+(inst.cost||0));H.log(s,{kind:'miss',actor:a.id,text:`${a.name}'s Solo has nowhere to go${last?`: ${last.name} has no legal aim`:''}. The ΦF is refunded.`});}return true;}
  if(id==='blueNote'){const mul=inst.announced?s.rules.announceMultiplier:1,cap=s.rules.maxTempoDebt,bits=[];
   for(const u of hearers(s,H,a,10,'foe')){const d=H.dist(s,a.x,a.y,u.x,u.y);let debt=Math.max(0,70-6*d);debt=Math.round(debt*mul);if(u.status?.guard)debt=Math.floor(debt/2);if(debt<=0)continue;u.tempoDebt=Math.min(cap,(u.tempoDebt||0)+debt);bits.push(`${u.name} owes ${debt}`);}
   say(s,H,a,`Blue Note${inst.announced?' (announced)':''}: ${bits.join('; ')||'nobody owes anything'}.`);return true;}
  if(id==='cuttingContest'){let n=0;for(const u of challengers(s,H,a)){const q=lastRoundTechnique(s,H,u);if(q&&H.borrowPerform(s,a,q,u.x,u.y,.7))n++;}
   say(s,H,a,`Cutting Contest: ${n} challenger${n===1?'':'s'} eat${n===1?'s':''} their own phrase${n===1?'':'s'} back at ×0.7.`);return true;}
 }
 function pulse(s,a,H){
  const song=a.status?.song;if(!song)return;
  const count=tune(s,a,H,song.radius);
  const t=units(s).filter(u=>u.side!==a.side&&!u.status?.soothed&&H.dist(s,a.x,a.y,u.x,u.y)<=song.radius&&H.canHear(s,a,u)).sort((u,v)=>H.dist(s,a.x,a.y,u.x,u.y)-H.dist(s,a.x,a.y,v.x,v.y)||u.id.localeCompare(v.id))[0];
  if(t)soothe(s,a,t,a.character==='bard'?'enchantingAir':'lullaby',H);
  say(s,H,a,`${H.ability(song.id).name}: ${count} allies tuned; ${song.left} bars remain.`);
 }
 function turnStart(s,a,H){
  if(a.character==='musician'&&(muted(a)||a.status?.keyTurn<a.ownerTurns-1))status(a).keyStacks=0;
  if(a.status?.verse?.until<a.ownerTurns){delete a.status.verse;say(s,H,a,'The held verse expires unused.');}
  for(const u of units(s))if(u.status?.inTune?.source===a.id)delete u.status.inTune;
  const song=a.status?.song;
  if(song){
   if(muted(a)||song.performed<a.ownerTurns-1){delete a.status.song;say(s,H,a,'The song breaks: a missed bar, stun or silence ends it.');}
   else if(--song.left<=0){
    if(song.id==='encore')H.releaseSong(s,a,song.radius);
    delete a.status.song;say(s,H,a,'The final bar completes; the sustained song ends.');
   }else pulse(s,a,H);
  }
 }
 function endTurn(s,a){if(a.status?.soothed?.throughTurn<=a.ownerTurns)delete a.status.soothed;}
 function afterHit(s,src,tgt,dealt,H){
  if(dealt<=0||!src||!tgt)return;
  (state(s).damageRound[tgt.id]||={})[src.side]=s.round;
  for(const u of units(s))if(u.side===tgt.side&&u.status?.soothed?.side===src.side){delete u.status.soothed;say(s,H,src,`${u.name||u.id} is startled awake by harm to its side.`);}
 }
 function techniqueCommitted(s,a,m,H){
  if(m.ability==='dissTrack'){
   const id=draw(s,a,H.borrowPool(s,a,false),1)[0];m.performanceChannel=id?(H.ability(id).damageType||H.conceptChannel(H.ability(id).concepts[0])):'rubedo';m.damageType=m.performanceChannel;
   say(s,H,a,`Diss Track is re-voiced in ${m.performanceChannel}; the opponent can brace for this channel.`);
  }
  if(a.character==='musician'&&['harmony','resonance'].includes(m.concept)&&a.status?.keyTurn!==a.ownerTurns){
   status(a).keyStacks=Math.min(4,a.status?.keyTurn===a.ownerTurns-1?(a.status?.keyStacks||0)+1:1);a.status.keyTurn=a.ownerTurns;
  }
  const tune=a.status?.inTune;let mul=1;
  if(tune){const source=s.actors[tune.source];if(source&&!muted(source)){mul=tune.potencyMul;if(tune.words)m.damageType=tune.words;}delete a.status.inTune;}
  if(a.status?.song&&['harmony','resonance','complementarity'].includes(m.concept))a.status.song.performed=a.ownerTurns;
  if(a.status?.verse?.id===m.ability){mul*=a.status.verse.mul;delete a.status.verse;}
  if(a.character==='musician'&&m.concept==='resonance')mul*=1+(a.status?.keyStacks||0)*.05;
  return mul;
 }
 function turnBudget(s,a,H){
  const prev=s.actors[s.order[(s.turnIndex-1+s.order.length)%s.order.length]];
  if(!prev||prev.defeated||prev.side!==a.side)return;
  if(prev.character==='musician'&&prev.status?.stringsRound!==s.round){status(prev).stringsRound=s.round;a.tempo+=10;a.tempoCapacity+=10;say(s,H,prev,`Sympathetic Strings gives ${a.name} +10 AP, once this round.`);}
  if(prev.character==='bard'&&prev.status?.inspirationRound!==s.round){
   status(prev).inspirationRound=s.round;
   const tell=prev.status?.recount;
   if(tell&&H.ability(tell.ability)&&!H.ability(tell.ability).classKind&&H.ability(tell.ability).tier!=='ultimate'){
    status(a).inspiredEcho={ability:tell.ability,until:a.ownerTurns};H.shareTell(s,a,tell);say(s,H,prev,`${a.name} hears ${H.ability(tell.ability).name}: one eligible echo on the next technique.`);
   }
  }
 }
 function jamAim(s,H,u,id){
  if(id==='riff'){const ts=hearers(s,H,u,4,'ally');const t=ts.find(t=>!t.status?.inTune)||ts[0];return t?[t.x,t.y]:null;}
  if(id==='consonance')return units(s).some(t=>t.id!==u.id&&t.side===u.side&&!t.defeated&&H.dist(s,u.x,u.y,t.x,t.y)<=2)?[u.x,u.y]:null;
  if(id==='lullaby'||id==='enchantingAir'){const dr=s.performers?.damageRound||{};const t=units(s).filter(t=>t.side!==u.side&&!t.defeated&&H.dist(s,u.x,u.y,t.x,t.y)<=4&&H.canHear(s,u,t)&&dr[t.id]?.[u.side]!==s.round).sort((p,q)=>H.dist(s,u.x,u.y,p.x,p.y)-H.dist(s,u.x,u.y,q.x,q.y)||p.id.localeCompare(q.id))[0];return t?[t.x,t.y]:null;}
  if(id==='freestyle'||id==='writtenVerse')return !u.status?.verse&&H.borrowPool(s,u,id!=='freestyle').length?[u.x,u.y]:null;
  return null;
 }
 function jamSession(s,a,inst,H){
  let n=0;
  for(const u of units(s).filter(u=>u.id!==a.id&&u.side===a.side&&isMusician(u)&&!muted(u)&&H.canHear(s,a,u)&&(u.reaction??1)>0)){
    const held=new Set(H.abilitiesOf(u));
    const opts=JOINABLE.filter(id=>held.has(id)).map(id=>({id,aim:jamAim(s,H,u,id)})).filter(o=>o.aim);
    opts.sort((p,q)=>aiValue(s,u,{ability:q.id,target:q.aim},H)-aiValue(s,u,{ability:p.id,target:p.aim},H)||p.id.localeCompare(q.id));
    for(const o of opts)if(H.borrowPerform(s,u,o.id,o.aim[0],o.aim[1],1.0)){u.reaction-=1;n++;say(s,H,u,`${u.name} joins the jam on ${H.ability(o.id).name}.`);break;}
  }
  if(!n)return;
  say(s,H,a,`Jam session: ${n} answer${n===1?'s':''} ${a.name}'s ${H.ability(inst.ability)?.name||'phrase'}.`);
  H.rollSession(s,a,n);
  if(n>=2&&a.status?.tradingRound!==s.round){a.tempo=Math.min(a.tempoCapacity??999,(a.tempo||0)+10);status(a).tradingRound=s.round;}
 }
 function afterTechnique(s,a,inst,H){
  if(inst.performanceEcho||inst.deception)return;
  if(isJazz(a)){const d=H.ability(inst.ability);
    if(d&&d.tier!=='ultimate'&&!d.merge&&inst.ability!=='jazzSolo'&&inst.aim)status(a).soloPhrase={id:inst.ability,aim:inst.aim};
    if(inst.concept==='harmony'||inst.concept==='lyricism')jamSession(s,a,inst,H);}
  for(const bard of units(s).filter(u=>u.character==='bard'&&u.side===a.side&&u.id!==a.id))if(H.hasSight(s,bard.x,bard.y,a.x,a.y))status(bard).recount={actor:a.id,ability:inst.ability};
  const echo=a.status?.inspiredEcho;if(echo&&echo.until>=a.ownerTurns){delete a.status.inspiredEcho;if(inst.aim)H.borrowPerform(s,a,echo.ability,...inst.aim,.5);}
  for(const singer of units(s).filter(u=>u.side===a.side&&u.id!==a.id&&u.status?.song?.id==='balladOfTheBattle')){
   const song=singer.status.song,key=a.id+":"+a.ownerTurns;if(song.lastUse===key)continue;song.lastUse=key;const previous=song.previous; song.previous={actor:a.id,ability:inst.ability};
   if(previous&&H.ability(previous.ability)?.tier!=='ultimate'&&!H.ability(previous.ability)?.classKind&&inst.aim)H.borrowPerform(s,a,previous.ability,...inst.aim,.5);
  }
 }
 function choose(s,a,id){const v=a.status?.verse;if(!v||v.id||!v.choices.includes(id))return 'Choose one of the three written lines.';v.id=id;v.choices=[id];return null;}
 function aiValue(s,a,cand,H){
  const id=cand.ability;if(!IDS.has(id))return null;
  if(['freestyle','headlineVerse'].includes(id))return 7;
  if(id==='writtenVerse')return 4;
  if(['consonance','chorus','encore','balladOfTheBattle'].includes(id))return units(s).filter(u=>u.id!==a.id&&u.side===a.side&&!u.status?.inTune&&H.dist(s,a.x,a.y,u.x,u.y)<=(id==='consonance'?2:3)).length*4+(id==='encore'?3:0);
  if(id==='riff')return hearers(s,H,a,4,'ally').some(u=>!u.status?.inTune)?5:0;
  if(id==='jazzSolo')return 8;
  if(id==='blueNote')return hearers(s,H,a,10,'foe').length*3;
  if(id==='cuttingContest')return challengers(s,H,a).length*4;
  const t=cand.target&&units(s).find(u=>u.x===cand.target[0]&&u.y===cand.target[1]);return t&&!t.status?.soothed?sootheChance(a,t,id)*8:0;
 }
 return {PERSUASIVE,IDS,pool,draw,tune,soothe,sootheChance,muted,hostile,beforeAbility,target,resolve,turnStart,endTurn,afterHit,techniqueCommitted,turnBudget,afterTechnique,choose,aiValue,units};
});
