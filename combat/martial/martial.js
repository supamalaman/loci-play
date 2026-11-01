"use strict";
// Ascending Martial Artist (Mala, 2026-10-22): Bird Mountain primary (Wave charges,
// ʻUlaʻula gears, Imu feasts, three Inversion vows), Adaptation secondary, and the
// ascend engine: she grows by dealing and taking damage, ascends on a rising chance,
// rages gold when an ally falls in her sight, and drinks Inspiration from power.
// State is JSON-only; randomness derives from seed and draws. All numbers provisional.
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.ConceptCombatMartial=factory();
})(typeof self!=='undefined'?self:this,function(){
 const IDS=new Set(['lonelyWave','chargeWave','ulaula','imuFeast','hurlFeast','vowOpenHand','vowNeverQuench','vowSharedBowl','beyondLimits']);
 const RULES={ waveBase:10, chargeAdd:4, chargeMax:2, spillHit:6, vowChargeAdd:6, gearMul:[1.5,2,2.5], gearBurn:[4,8,12], gearAura:[2,4,6], vowGearMul:3, vowBurn:16, vowAura:8,
  feastPerAlly:4, feastTicks:3, feastBase:10, feastSpillHit:8, feastRadius:6, bowlHeal:4, mergeBase:8, mergeCapBonus:20, mergeRange:6,
  ascendBase:0.05, ascendPerRound:0.02, ascendPerFight:0.01, ascendPerInspiration:0.03, ascendCap:0.60, ascendLF:30, witnessPotency:15,
  zenkaiChance:0.10, zenkaiHeal:50 };
 const say=(s,H,a,text,why)=>H.log(s,{kind:'martial',actor:a.id,text,...(why?{why}:{})});
 const isMartial=a=>a&&a.character==='martial_artist';
 const hasBM=a=>a&&(a.primary==='bird_mountain'||a.secondary==='bird_mountain'||a.styleConcept==='bird_mountain');   // styleConcept: an added style (engine/anime-orbit.js)
 const bm=u=>(u.birdMountain||={charge:0,red:null,feast:null,vows:{}});
 const asc=u=>(u.ascend||={fight:0,dealtTurn:-1,takenRound:-1,rounds:0,transformed:false,witnessRound:-1});
 const foeNear=(s,a,n,H)=>Object.values(s.actors).some(u=>u.side!==a.side&&!u.defeated&&H.dist(s,a.x,a.y,u.x,u.y)<=n);
const mdist=(s,ax,ay,bx,by)=>{const dx=Math.abs(ax-bx),dy=Math.abs(ay-by);return s.rules&&s.rules.rangeMetric==='chebyshev'?Math.max(dx,dy):dx+dy;};
const feastAllies=(s,a)=>Object.values(s.actors).filter(u=>u.side===a.side&&u.id!==a.id&&!u.defeated&&mdist(s,a.x,a.y,u.x,u.y)<=RULES.feastRadius);
const vowKey=(id)=>id==='vowOpenHand'?'openHand':id==='vowNeverQuench'?'neverQuench':'sharedBowl';
 const seeded=(str)=>{let h=2166136261;for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);h^=h>>>16;h=Math.imul(h,2246822507);h^=h>>>13;h=Math.imul(h,3266489909);h^=h>>>16;return (h>>>0)/4294967296;};
 // A beam down tiles: stops at the first wall for 0 (beamStopped); else hits the target.
 function beamHit(s,a,H,tx,ty,range,potency,label,why){
  const path=H.line(a.x,a.y,tx,ty).slice(1);
  if(!path.length||path.length>range){say(s,H,a,`${a.name}'s ${label} fizzles: out of line.`);return;}
  for(const [x,y] of path){if(H.barrierAt(s,x,y)){say(s,H,a,`${a.name}'s ${label} ends at the wall for 0.`,['Stone does not applaud.']);return;}}
  const t=H.actorAt(s,tx,ty);
  if(!t||t.defeated||t.side===a.side){say(s,H,a,`${a.name}'s ${label} finds no enemy on the line.`);return;}
  H.hit(s,a,t,{ability:label,delivery:'line',damageType:'citrinitas',name:label},potency,why,{label});
 }
 function transform(s,a,H,why){
  const st=asc(a);if(st.transformed)return;
  st.transformed=true;
  if(a.sprite==='martial-artist')a.sprite='martial-artist-ascended';
  if(!(a.traits||[]).includes('ascended'))(a.traits||=[]).push('ascended');
  a.maxLF+=RULES.ascendLF;a.lf+=RULES.ascendLF;
  say(s,H,a,`${a.name} ascends past her limits: gold hair, gold fire, +${RULES.ascendLF} Life Force.`,[why||'The fight taught her.']);
  H.log(s,{kind:'ascension',actor:a.id,scene:{ascension:true,title:'Ascended',line:'Higher!'},text:`${a.name} is Ascended.`});
 }
 function beforeAbility(s,a,m){
  const id=m.id||m.ability;if(!IDS.has(id))return null;
  if(!hasBM(a))return 'Bird Mountain is not equipped.';
  const st=bm(a);
  if(id==='chargeWave'&&st.charge>=RULES.chargeMax)return 'The wave is fully held: fire it.';
  if(id==='lonelyWave'&&st.vows.openHand&&st.charge<1)return 'Sworn: the wave never flies cold. Hold a charge first.';
  if((id==='vowOpenHand'||id==='vowNeverQuench'||id==='vowSharedBowl')){
   if(st.vows[vowKey(id)])return 'Already sworn: oaths are load-bearing.';
  }
  if(id==='imuFeast'&&!st.feast){
   if(!feastAllies(s,a).length)return 'No living ally in 6: the pit needs cooks.';
  }
  if(id==='imuFeast'&&st.feast)return 'Already gathering: hurl the feast or let it fill.';
  if(id==='hurlFeast'){
   if(!st.feast)return 'No feast gathering: dig the Imu first.';
   if(st.feast.ticks<1)return 'The pit is empty: gather first.';
   if(st.vows.sharedBowl&&st.feast.ticks<RULES.feastTicks)return 'Sworn: the feast gathers all 3 ticks.';
  }
  return null;
 }
 function target(s,a,m,tx,ty,H){
  const id=m.id||m.ability;if(!IDS.has(id))return null;
  const st=bm(a),self={ok:true,tiles:[[a.x,a.y]],targets:[]};
  if(id==='chargeWave'){if(st.charge>=RULES.chargeMax)return {error:'The wave is fully held: fire it.'};return self;}
  if(id==='ulaula')return self;
  if(id==='vowOpenHand'||id==='vowNeverQuench'||id==='vowSharedBowl'){if(st.vows[vowKey(id)])return {error:'Already sworn: oaths are load-bearing.'};return self;}
  if(tx==null||ty==null)return null;
  if(id==='lonelyWave'&&st.vows.openHand&&st.charge<1)return {error:'Sworn: the wave never flies cold. Hold a charge first.'};
  if(id==='imuFeast'&&st.feast)return {error:'Already gathering: hurl the feast or let it fill.'};
  if(id==='imuFeast'&&!st.feast){if(!feastAllies(s,a).length)return {error:'No living ally in 6: the pit needs cooks.'};return self;}
  if(id==='hurlFeast'){
   if(!st.feast)return {error:'No feast gathering: dig the Imu first.'};
   if(st.feast.ticks<1)return {error:'The pit is empty: gather first.'};
   if(st.vows.sharedBowl&&st.feast.ticks<RULES.feastTicks)return {error:'Sworn: the feast gathers all 3 ticks.'};
  }
  if(id==='lonelyWave'||id==='hurlFeast'||id==='beyondLimits'){
   const range=id==='lonelyWave'?5:RULES.mergeRange;
   const path=H.line(a.x,a.y,tx,ty).slice(1);
   if(!path.length||path.length>range)return {error:'Pick a line in range.'};
   const occ=H.actorAt(s,tx,ty);
   if(!occ||occ.side===a.side||occ.defeated)return {error:'Pick an enemy on the line.'};
   return {ok:true,tiles:[[tx,ty]],targets:[occ.id]};
  }
  return null;
 }
 function resolve(s,a,inst,H){
  const id=inst.ability;if(!IDS.has(id))return false;
  const st=bm(a),R=RULES;
  if(id==='chargeWave'){
   if(st.charge>=R.chargeMax){say(s,H,a,`${a.name}'s hands are full: the wave is fully held.`);return true;}
   st.charge+=1;say(s,H,a,`${a.name} cups her hands: charge ${st.charge} held (+${st.charge*(st.vows.openHand?R.vowChargeAdd:R.chargeAdd)} when it flies).`,['Sha… ka…!']);return true;
  }
  if(id==='lonelyWave'){
   if(st.vows.openHand&&st.charge<1){say(s,H,a,`${a.name} cannot throw cold: sworn.`);return true;}
   const [tx,ty]=inst.tiles[0],pot=R.waveBase+st.charge*(st.vows.openHand?R.vowChargeAdd:R.chargeAdd);
   st.charge=0;beamHit(s,a,H,tx,ty,5,pot,'Wave of the Lonely King',['The wave flies.']);return true;
  }
  if(id==='ulaula'){
   if(st.red&&!st.vows.neverQuench){st.red=null;say(s,H,a,`${a.name} lets the red go out.`);return true;}
   if(st.red){say(s,H,a,`${a.name} cannot quench: sworn.`);return true;}
   const gear=Math.min(5,Math.max(2,inst.gear||2));
   if(gear===5&&!st.vows.neverQuench){say(s,H,a,'Gear ×5 needs the Vow of Never-Quench.');return true;}
   st.red={gear};say(s,H,a,`${a.name} burns ʻUlaʻula at ×${gear}.`,['Red is a budget.']);return true;
  }
  if(id==='vowOpenHand'){st.vows.openHand=true;say(s,H,a,`${a.name} swears the Open Hand: never cold, charges +6.`);return true;}
  if(id==='vowNeverQuench'){st.vows.neverQuench=true;say(s,H,a,`${a.name} swears Never-Quench: no dismiss, gear ×5 unlocked.`);return true;}
  if(id==='vowSharedBowl'){st.vows.sharedBowl=true;say(s,H,a,`${a.name} swears the Shared Bowl: always 3 ticks, the pit feeds its cooks.`);return true;}
  if(id==='imuFeast'){
   if(st.feast){say(s,H,a,'Already gathering: hurl the feast or let it fill.');return true;}
   st.feast={pool:0,ticks:0};say(s,H,a,`${a.name} digs the Imu pit: bring a dish!`,['The pit is dug — bring a dish!']);return true;
  }
  if(id==='hurlFeast'){
   if(!st.feast||st.feast.ticks<1){say(s,H,a,'The pit is empty.');return true;}
   if(st.vows.sharedBowl&&st.feast.ticks<R.feastTicks){say(s,H,a,'Sworn: the feast gathers all 3 ticks.');return true;}
   const [tx,ty]=inst.tiles[0],pot=R.feastBase+st.feast.pool;st.feast=null;
   beamHit(s,a,H,tx,ty,6,pot,'Imu',['Everybody eats.']);return true;
  }
  if(id==='beyondLimits'){
   if(!asc(a).transformed)transform(s,a,H,'The climb takes her.');
   const st2=bm(a),pot=R.mergeBase+Math.min(R.mergeCapBonus,st2.charge*R.chargeAdd+asc(a).fight);st2.charge=0;
   const [tx,ty]=inst.tiles[0];beamHit(s,a,H,tx,ty,R.mergeRange,pot,'Beyond Limits',['Banked pain spends.']);return true;
  }
  return false;
 }
 // Turn start: red burns + aura, feast gathers, granted techniques, the ascend roll.
 function turnStart(s,a,H){
  if(a.defeated)return;
  if(hasBM(a)){for(const id of ['chargeWave','hurlFeast','vowOpenHand','vowNeverQuench','vowSharedBowl']){if(!(a.learned||[]).includes(id))(a.learned||=[]).push(id);}}
  else if(a.learned)a.learned=a.learned.filter((id)=>!['chargeWave','hurlFeast','vowOpenHand','vowNeverQuench','vowSharedBowl'].includes(id));
  const st=bm(a),R=RULES;
  if(st.red){
   const i=st.red.gear===5?3:st.red.gear-2,burn=[...R.gearBurn,R.vowBurn][i],aura=[...R.gearAura,R.vowAura][i];
   a.lf=Math.max(1,a.lf-burn);
   say(s,H,a,`${a.name}'s red burns her for ${burn} (unattributed).`,['Banks record harm; guards answer attackers.']);
   for(const u of Object.values(s.actors))if(u.side!==a.side&&!u.defeated&&Math.max(Math.abs(u.x-a.x),Math.abs(u.y-a.y))<=1)
    H.hit(s,a,u,{ability:'ulaula',delivery:'field',damageType:'citrinitas',name:'ʻUlaʻula aura'},aura,['Adjacent to the red.'],{label:'ʻUlaʻula aura'});
   if(a.status&&(a.status.stun||a.status.root||a.status.sleep)){st.red=null;say(s,H,a,`${a.name}'s red is quenched.`);}
  }
  if(st.feast){
   const cooks=Object.values(s.actors).filter(u=>u.side===a.side&&u.id!==a.id&&!u.defeated&&H.dist(s,a.x,a.y,u.x,u.y)<=R.feastRadius);
   st.feast.ticks+=1;st.feast.pool+=cooks.length*R.feastPerAlly;
   if(st.vows.sharedBowl)for(const u of cooks){u.lf=Math.min(u.maxLF,u.lf+R.bowlHeal);}
   say(s,H,a,`The Imu gathers (tick ${st.feast.ticks}): +${cooks.length*R.feastPerAlly} from ${cooks.length} cook(s).${st.vows.sharedBowl?' The pit feeds its cooks.':''}`);
   if(st.feast.ticks>=R.feastTicks){
    const cands=Object.values(s.actors).filter(u=>u.side!==a.side&&!u.defeated&&H.dist(s,a.x,a.y,u.x,u.y)<=6)
     .filter((u)=>H.line(a.x,a.y,u.x,u.y).slice(1).every(([x,y])=>!H.barrierAt(s,x,y))).sort((p,q)=>H.dist(s,a.x,a.y,p.x,p.y)-H.dist(s,a.x,a.y,q.x,q.y));
    if(!cands.length){st.feast=null;say(s,H,a,'The unhurled feast grounds out: no line, no landing.');}
    else{const pot=R.feastBase+st.feast.pool,t=cands[0];st.feast=null;beamHit(s,a,H,t.x,t.y,6,pot,'Imu',['It hurls itself.']);}
   }
  }
  if(!isMartial(a))return;
  const m=asc(a);if(m.transformed)return;
  m.rounds+=1;
  const chance=Math.min(R.ascendCap,R.ascendBase+R.ascendPerRound*m.rounds+R.ascendPerFight*m.fight+R.ascendPerInspiration*(a.inspiration||0));
  if(seeded(`${s.seed}:ascend:${a.id}:${a.ownerTurns}`)<chance)transform(s,a,H,`The roll lands (${Math.round(chance*100)}%).`);
 }
 // Damage hooks: fight counters feed the climb; big single hits spill charge and feasts.
 function onDamage(s,src,tgt,amount,H){
  if(isMartial(src)&&amount>0){const m=asc(src);if(m.dealtTurn!==src.ownerTurns){m.dealtTurn=src.ownerTurns;m.fight+=1;}}
  if(isMartial(tgt)&&amount>0){const m=asc(tgt);if(m.takenRound!==s.round){m.takenRound=s.round;m.fight+=1;}}
  if(amount>0){
   const st=bm(tgt);
   if(st.charge>0&&amount>=RULES.spillHit){st.charge=0;say(s,H,tgt,`${tgt.name}'s held charge spills.`);}
   if(st.feast&&amount>=RULES.feastSpillHit){st.feast.pool=Math.floor(st.feast.pool/2);say(s,H,tgt,`${tgt.name}'s feast spills half its pool.`);}
  }
 }
 // Rage: an ally's defeat in her sightline transforms her immediately.
 function onDefeat(s,tgt,H){
  for(const u of Object.values(s.actors)){
   if(!isMartial(u)||u.defeated||u.side!==tgt.side||u.id===tgt.id||asc(u).transformed)continue;
   if(H.hasSight(s,u.x,u.y,tgt.x,tgt.y))transform(s,u,H,`${tgt.name} falls where she can see: rage takes her the rest of the way.`);
  }
 }
 // Witness: 15+ authored-potency techniques in her sightline are Inspiration (1/round).
 function witness(s,observer,potency,H){
  if(!isMartial(observer)||observer.defeated||(potency||0)<RULES.witnessPotency)return;
  const m=asc(observer);if(m.witnessRound>=s.round)return;
  m.witnessRound=s.round;H.Inspiration.gain(s,observer,1,`${observer.name} witnesses power worth learning from.`);
 }
 function aiValue(s,a,cand,H){
  const id=cand.ability;if(!IDS.has(id))return null;
  const st=bm(a),m=asc(a);
  if(id==='lonelyWave'){const t=cand.target&&H.actorAt(s,cand.target[0],cand.target[1]);if(!t||t.side===a.side)return null;
   const pot=RULES.waveBase+st.charge*(st.vows.openHand?RULES.vowChargeAdd:RULES.chargeAdd);
   return t.lf<=pot?9:st.charge>=RULES.chargeMax?6:3.5;}
  if(id==='chargeWave'){if(st.charge>=RULES.chargeMax)return null;return foeNear(s,a,6,H)?4:1;}
  if(id==='ulaula'){if(st.red)return null;const g=cand.gear||2,i=g===5?3:g-2,burn=[...RULES.gearBurn,RULES.vowBurn][i];if(g===5&&!st.vows.neverQuench)return null;if(a.lf<=burn*2+10)return null;return [4,5.5,7,9][i];}
  if(id==='imuFeast'){
   if(st.feast)return null;
   const n=Object.values(s.actors).filter(u=>u.side===a.side&&u.id!==a.id&&!u.defeated&&H.dist(s,a.x,a.y,u.x,u.y)<=RULES.feastRadius).length;return n>=2?5:1;}
  if(id==='hurlFeast'){
   if(!st.feast||st.feast.ticks<1)return null;
   if(st.vows.sharedBowl&&st.feast.ticks<RULES.feastTicks)return null;
   const t=cand.target&&H.actorAt(s,cand.target[0],cand.target[1]);if(!t||t.side===a.side)return null;
   const pot=RULES.feastBase+st.feast.pool;return t.lf<=pot?9:pot>=18?6:3;}
  if(id==='vowOpenHand'){if(st.vows.openHand)return null;return st.charge>0||m.rounds>2?3:1;}
  if(id==='vowNeverQuench'){if(st.vows.neverQuench)return null;return st.red?3:1;}
  if(id==='vowSharedBowl'){if(st.vows.sharedBowl)return null;return st.feast?3:1;}
  if(id==='beyondLimits'){if(!m.transformed&&m.rounds>=3)return 8;const pot=RULES.mergeBase+Math.min(RULES.mergeCapBonus,st.charge*RULES.chargeAdd+m.fight);return pot>=14?7:4;}
  return null;
 }
 function seesHidden(a){return isMartial(a);}
 function piercingRead(s,a,H){
  if(!isMartial(a)||a.defeated||a.readTurn===a.ownerTurns)return false;
  a.readTurn=a.ownerTurns;return true;
 }
 // Zenkai (Mala, 2026-10-22): near death teaches. The first fatal hit of a battle has a small chance to leave her
 // standing at 1 LF instead; she ascends on the spot if she hasn't, and regains zenkaiHeal LF. Engine contract (damage.js):
 // return true and the defeat is skipped (Bonds.beforeDefeat precedent).
 // A rule on the shared survive-the-killing-blow base (survive.js): the base keeps her at 1 LF once a battle and spends the
 // chance on the attempt; ascending and the heal are Zenkai's own.
 const survivor={id:'zenkai',holds:(s,u)=>isMartial(u),chance:RULES.zenkaiChance,roll:(s,u)=>seeded(`${s.seed}:zenkai:${u.id}`),then(s,tgt,H){
  transform(s,tgt,H,'Near death takes her the rest of the way.');
  tgt.lf=Math.min(tgt.maxLF,tgt.lf+RULES.zenkaiHeal);
  say(s,H,tgt,`${tgt.name} survives the killing blow: back up at ${tgt.lf}/${tgt.maxLF} LF.`,['What does not kill her ascends her.']);
 }};
 const Survive=()=>(typeof module==='object'&&module.exports?require('../survive.js'):self.ConceptCombatSurvive);
 function beforeDefeat(s,tgt,H){return Survive().survive(s,tgt,survivor,H);}
 return {IDS,RULES,isMartial,beforeAbility,target,resolve,turnStart,onDamage,onDefeat,witness,aiValue,transform,seesHidden,piercingRead,beforeDefeat,survivor};
});
