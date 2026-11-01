"use strict";
(function(root,install){if(typeof module==='object'&&module.exports)module.exports=install;else(root.ConceptCombatEngineParts=root.ConceptCombatEngineParts||{}).contracts=install;})(typeof self!=='undefined'?self:this,function install(H){
 const D=typeof module==='object'&&module.exports?require('../legacy/contracts.js'):globalThis.ConceptCombatContracts;
 const def=id=>H.C.abilities[id],progress=(a,id,write=false)=>{if(write){a.contractProgress||={};return a.contractProgress[id]||=( {index:0,count:0,usedVictims:[]} );}return a.contractProgress?.[id]||{index:0,count:0,usedVictims:[]};};
 const known=(a,id)=>H.abilitiesOf(a).includes(id)&&!!def(id)?.contract;
 const emit=(s,a,text)=>H.log(s,{kind:'contract',actor:a.id,text:`${a.name}: ${text}`});
 function status(s,a,id){
  const c=def(id)?.contract;if(!c)return null;const p=progress(a,id),next=c.unlock[p.index],chainReady=!next;
  let reason=p.spent?'Exhausted for this battle':next?`Step ${p.index+1}/${c.unlock.length} · ${D.stepLabel(next,p.count)}`:'Ready';
  let ready=!p.spent&&chainReady;
  const prepared=p.prepared&&a.ownerTurns>p.prepared.turn&&a.x===p.prepared.x&&a.y===p.prepared.y;
  if(ready&&c.cast.prepare&&!prepared){ready=false;reason=p.prepared?'Preparation: wait for your next turn':'Prepare first · 20 AP';}
  if(ready&&c.cast.ultimate&&(a.ultimateCharge||0)<s.rules.ultimateChargeMax){ready=false;reason='Needs a full ultimate bar';}
  if(ready&&c.cast.lf&&a.lf<=c.cast.lf){ready=false;reason=`Needs more than ${c.cast.lf} LF`;}
  if(ready&&c.cast.reaction&&(a.reaction||0)<1){ready=false;reason='Needs an available reaction';}
  if(a.contractActive?.id===id){ready=false;reason=`Active · ${a.contractActive.remaining} turn openings left`;}
  return {ready,reason,next:next||null,index:p.index,count:p.count,chainReady,spent:!!p.spent,canPrepare:chainReady&&!p.spent&&!!c.cast.prepare&&!p.prepared};
 }
 function end(s,a,reason){const x=a.contractActive;if(!x)return;for(const k of ['ward','guard'])if(a.status[k]?.contractId===x.id)a.status[k]=null;delete a.contractActive;emit(s,a,`${def(x.id).name} ends: ${reason}.`);}
 function authorize(s,a,id){const p={actor:a.id,id,serial:s.contractSerial=(s.contractSerial||0)+1};a.contractPermit=p;(s.contractTickets||={})[p.serial]=p;return p;}
 function allowed(s,a,inst){if(!def(inst?.ability)?.contract)return true;const p=inst.contractPermit;return !!p&&p.actor===a.id&&p.id===inst.ability&&s.contractTickets?.[p.serial]?.id===p.id;}
 function decorate(s,a,m){if(a.contractPermit?.id===m.ability)m.contractPermit=JSON.parse(JSON.stringify(a.contractPermit));}
 function before(s,a,action){
  if(a.contractActive&&a.contractActive.contract.active.concentration&&action.type==='ability'&&action.ability!==a.contractActive.id)end(s,a,'another technique takes your concentration');
  if(['move','jump','climb'].includes(action.type))for(const p of Object.values(a.contractProgress||{}))delete p.prepared;
  if(action.type!=='ability'||!def(action.ability)?.contract)return null;
  const id=action.ability,st=status(s,a,id);if(!known(a,id))return 'That contract is not held.';if(!st.ready)return st.reason;
  const c=def(id).contract,p=progress(a,id,true);
  if(Object.values(c.active).some(Boolean)&&(a.soulOf||H.ClassRuntime?.relayFor?.(s,a,action,H.relayH())))return 'Maintained workshop effects currently require a body-origin cast.';
  if(c.cast.onlyType&&c.cast.onlyType!=='none'){const t=typeof action.target==='string'?s.actors[action.target]:Array.isArray(action.target)?H.actorAt(s,...action.target)||s.wild?.find(t=>t.x===action.target[0]&&t.y===action.target[1]):null;if(!t||!matches(s,t,c.cast.onlyType))return 'This technique only targets '+D.specialties[c.cast.onlyType].name+'.';}
  if(c.cast.lf){a.lf-=c.cast.lf;H.log(s,{kind:'contractCost',actor:a.id,amount:c.cast.lf,text:`${a.name} pays ${c.cast.lf} LF for ${def(id).name}; this is a cost, not damage.`});}
  if(c.cast.reaction){a.reaction=0;emit(s,a,'spends the reaction promised on the sheet.');}
  authorize(s,a,id);p.index=0;p.count=0;delete p.prepared;if(c.reset==='once')p.spent=true;
  return null;
 }
 function after(before,s,action,start){
  const pending=s.pending?.inst?.contractPermit;
  for(const a of Object.values(s.actors))delete a.contractPermit;
  for(const key of Object.keys(s.contractTickets||{}))if(Number(key)!==pending?.serial)delete s.contractTickets[key];
  for(const a of Object.values(s.actors)){
   for(const p of Object.values(a.contractProgress||{}))if(p.prepared&&(a.x!==p.prepared.x||a.y!==p.prepared.y))delete p.prepared;
   if(a.contractActive){const x=a.contractActive;if(a.defeated||a.escaped)end(s,a,'the caster left the fight');else if(x.contract.active.anchored&&(a.x!==x.x||a.y!==x.y))end(s,a,'left the casting tile');else if(x.composite&&x.ward&&!['ward','guard'].some(k=>a.status[k]?.contractId===x.id))end(s,a,'all maintained effects were spent');else if(x.ward&&!x.composite&&!a.status.ward)end(s,a,'the ward was consumed');}
   if((a.id!==action.actor&&action.type!=='respond')||a.defeated)continue;
   if(!(a.learned||[]).some(id=>def(id)?.contract))continue;
   for(const id of H.abilitiesOf(a)){
    const c=def(id)?.contract;if(!c)continue;
    if(action.type==='ability'&&action.ability===id){
     const ongoing=Object.values(c.active).some(Boolean);if(ongoing&&!s.outcome){if(a.contractActive)end(s,a,'replaced by another maintained work');const m=H.manifest(s,a,id);a.contractActive={id,contract:JSON.parse(JSON.stringify(c)),remaining:def(id).contractDuration||2,x:a.x,y:a.y,composite:!!m.scribedEffects,ward:m.effect==='barrier'||(!!m.scribedEffects&&!m.scribedEffects.some(e=>e.key==='damage'&&e.recipient==='target')),manifest:JSON.parse(JSON.stringify(m)),pulseCost:m.cost};if(a.contractActive.ward&&a.status.ward){a.status.ward.contractId=id;a.status.ward.expiresAt=a.ownerTurns+a.contractActive.remaining;}emit(s,a,`${m.name} is maintained; ${a.contractActive.remaining} owner-turn duration.`);}
     continue;
    }
    const p=progress(a,id,true),step=c.unlock[p.index];if(!step||p.spent)continue;
    let amount=0;
    if(step.kind==='move'&&action.type==='move')amount=s.log.slice(start).filter(e=>e.kind==='move'&&e.actor===a.id&&Array.isArray(e.path)).reduce((n,e)=>n+Math.max(0,e.path.length-1),0);
    if(step.kind==='invoke'&&action.type==='contractSpeak'&&action.ability===id)amount=1;
    if(step.kind==='defeat'&&['ability','strike','respond'].includes(action.type)){
     const hitIds=s.log.slice(start).filter(e=>e.kind==='damage'&&e.actor===a.id&&e.amount>0).map(e=>e.target);
     const victim=Object.values(s.actors).find(t=>!before.actors[t.id]?.defeated&&t.defeated&&t.side!==a.side&&t.side!=='civilian'&&!t.noXp&&!t.notArrived&&!t.summon&&!t.contractBody&&hitIds.includes(t.id)&&!p.usedVictims.includes(t.id));
     const wildVictim=s.log.slice(start).find(e=>e.kind==='wildEnd'&&e.actor===a.id&&/defeated/.test(e.text||'')&&!p.usedVictims.includes(e.target)&&before.wild?.some(w=>w.id===e.target&&w.side!==a.side&&!w.summoned&&!w.summoner&&!w.summon&&!w.owner&&!w.tamedBy));
     const victimId=victim?.id||wildVictim?.target;if(victimId){amount=1;p.usedVictims.push(victimId);}
    }
    if(amount){p.count+=amount;if(p.count>=(step.kind==='move'?step.amount:1)){p.index++;p.count=0;emit(s,a,`${def(id).name}: step ${p.index}/${c.unlock.length} complete${p.index===c.unlock.length?' · technique unlocked':''}.`);}else emit(s,a,`${def(id).name}: ${D.stepLabel(step,p.count)}.`);}
   }
  }
 }
 function moved(s,a,x,y){if(a?.contractActive?.contract.active.anchored&&(x!==a.contractActive.x||y!==a.contractActive.y))end(s,a,'left the casting tile');for(const p of Object.values(a?.contractProgress||{}))if(p.prepared&&(x!==p.prepared.x||y!==p.prepared.y))delete p.prepared;}
 function turn(s,a){
  const x=a.contractActive;if(!x)return;if(a.defeated||a.escaped||x.remaining<=1){end(s,a,'duration completed');return;}
  if(x.contract.active.anchored&&(a.x!==x.x||a.y!==x.y)){end(s,a,'left the casting tile');return;}
  const upkeep=x.contract.active.upkeep||0,ward=x.ward,price=ward?upkeep:Math.max(2,x.pulseCost)+upkeep;
  if(a.pf<price){end(s,a,`cannot pay ${price} ΦF upkeep`);return;}
  a.pf-=price;x.remaining--;H.log(s,{kind:'contractUpkeep',actor:a.id,amount:price,text:`${a.name} pays ${price} ΦF upkeep for ${def(x.id).name}.`});
  if(ward&&!x.composite&&!x.bonusEarned&&a.status.ward?.contractId===x.id){const m=x.manifest,base=def(x.id).protection,full=def(x.id).contractHeldProtection||base,bonus=Math.max(0,Math.round(m.protection*(full/base-1)));a.status.ward.protection+=bonus;x.bonusEarned=true;if(bonus)H.log(s,{kind:'contractBonus',actor:a.id,amount:bonus,text:`${a.name} earns ${bonus} held ward protection.`});}
  if(!ward){authorize(s,a,x.id);const m=JSON.parse(JSON.stringify(x.manifest));decorate(s,a,m);m.potency*=def(x.id).contractPulsePotency/Math.max(1,def(x.id).potency);const t=H.target(s,a,m,a.x,a.y);if(t.ok)H.resolveAbility(s,a,{...m,...t,owner:a.id,origin:[a.x,a.y],aim:[a.x,a.y],sourceHeight:H.heightAt(s,a.x,a.y),mult:1,contractPulse:true});}
 }
 function matches(s,tgt,k){
  const traits=(tgt.traits||[]).map(t=>t.id||t);
  if(k==='beast')return D.beastKinds.includes(tgt.kind)||tgt.bodyType==='beast';
  if(k==='construct')return traits.includes('robot')||tgt.bodyType==='construct';
  if(k==='large')return !!tgt.massive||((tgt.size?.w||tgt.size?.[0]||1)*(tgt.size?.h||tgt.size?.[1]||1)>1);
  if(k==='concentrating')return H.concentrationProfile(s,tgt,1).channels.length>0;
  if(k==='water'&&Number.isFinite(tgt.x)&&Number.isFinite(tgt.y)){const tile=H.tileAt(s,tgt.x,tgt.y);return !!tile?.water||['w','~'].includes(s.arena?.map?.[tgt.y]?.[tgt.x]);}return false;
 }
 function specialize(s,src,tgt,inst,potency){
  const c=def(inst?.ability)?.contract,sp=D.specialties[c?.specialization];if(!c||!sp||sp.mul===1)return potency;
  if(matches(s,tgt,c.specialization)){emit(s,src,`${sp.name} inscription applies ×${sp.mul}.`);return potency*sp.mul;}return potency;
 }
 H.handlers.contractRelease=(s,a)=>{if(!a.contractActive)return 'No maintained contract is active.';end(s,a,'released voluntarily');};
 H.handlers.contractSpeak=(s,a,action)=>{if(!known(a,action.ability))return 'That contract is not held.';const st=status(s,a,action.ability);if(st.next?.kind!=='invoke'||st.spent)return 'The invocation is not the current step.';if(action.words!==st.next.words)return 'Speak the words written on this step.';const err=H.spendTempo(s,a,10,'Invocation');if(err)return err;emit(s,a,`speaks “${action.words}”.`);};
 H.handlers.contractPrepare=(s,a,action)=>{if(!known(a,action.ability))return 'That contract is not held.';const st=status(s,a,action.ability);if(!st.canPrepare)return 'Preparation is unavailable or already underway.';const err=H.spendTempo(s,a,20,'Prepare technique');if(err)return err;progress(a,action.ability,true).prepared={turn:a.ownerTurns,x:a.x,y:a.y};emit(s,a,`prepares ${def(action.ability).name}; hold position until next turn.`);};
 return {Contracts:{status,before,after,turn,end,specialize,matches,allowed,decorate,moved}};
});
