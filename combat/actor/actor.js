"use strict";
// The Actor (Mala, 2026-10-16; docs/actor-respec-rulings.md is the build contract).
// Audition rolls 3 villain classes and plays one as a role (its config pair +
// mandatory class traits); Typecast rewards consecutive same-role plays; Method
// Acting reverts at need and keeps one trait from the old form (single slot).
// The Look staggers, the Human Experience steadies, Stardom feeds the posse,
// and Genre-Defining Performance turns the field into fans. State is JSON-only;
// randomness derives from seed and committed draws.
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.ConceptCombatActor=factory();
})(typeof self!=='undefined'?self:this,function(){
 const IDS=new Set(['audition','genreDefiningPerformance']);
 const rules={ lookChance:0.10, stardomLF:2, stardomPF:1, stardomRadius:2, gdpCost:1, gdpTurns:2,
   taxBase:2, taxCap:4, familiarSlot:0.60, typecastMax:3, typecastStep:0.15, churnFrom:3,
   willpower:14, parlayBonus:0.20, repeatBias:0.70 };
 const hasTrait=(u,id)=>(u?.traits||[]).some(t=>(typeof t==='string'?t:t?.id)===id);
 const live=(s)=>Object.values(s.actors||{}).filter(u=>u&&!u.defeated&&!u.notArrived);
 const say=(s,H,a,text,why)=>H.log(s,{kind:'actor',actor:a.id,text,...(why?{why}:{})});
 const isActor=(a)=>a&&a.character==='actor';
 // Full villain roster (ruling 1): every live roster enemy with configs, bosses
 // excluded by construction (they live in the bosses table, not characters).
 function pool(H){
  const C=H.C||{};
  return Object.entries(C.characters||{}).filter(([id,ch])=>ch&&ch.side==='enemy'&&id!=='actor'
   &&!ch.permanentAlly&&!ch.randomEventOnly&&Array.isArray(ch.configs)&&ch.configs.length).map(([id])=>id);
 }
 function rollOptions(s,a,H){
  const p=pool(H);if(!p.length)return [];
  a.audCount=(a.audCount||0)+1;
  const pick=(salt,n)=>{const h=Math.abs(Math.imul((s.seed||1)^Math.imul(a.audCount+salt,2654435761)^a.ownerTurns,2246822519))>>>0;return p[h%n];};
  const out=[];let guard=0;
  const familiar=a.typecast?.role&&p.includes(a.typecast.role)?a.typecast.role:null;
  if(familiar&&H.seededChance(`${s.seed}:audition:${a.id}:${a.audCount}:familiar`)<rules.familiarSlot)out.push(familiar);
  while(out.length<3&&guard++<60){const c=pick(guard+out.length*7,p.length);if(!out.includes(c))out.push(c);}
  return out;
 }
 function options(s,a,H){
  if(a.audition?.options?.length&&a.audition.sealed===a.ownerTurns)return a.audition.options;
  const rolled=rollOptions(s,a,H);
  a.audition={options:rolled,sealed:a.ownerTurns};
  return rolled;
 }
 function pairLabel(H,roleId){
  const ch=H.C?.characters?.[roleId],cfg=ch?.configs?.[0];
  if(!ch||!cfg)return roleId;
  const nm=(c)=>H.C?.concepts?.[c]?.name||c;
  return `${ch.name} · ${nm(cfg.primary)} + ${nm(cfg.secondary)}`;
 }
 // AI pick (ruling: 70% repeat unless the room changed; here: repeat if offered).
 function aiPick(s,a,opts,H){
  const prev=a.typecast?.role;
  if(prev&&opts.includes(prev)&&H.seededChance(`${s.seed}:audition:${a.id}:${a.audCount}:repeat`)<rules.repeatBias)return prev;
  const h=Math.abs(Math.imul((s.seed||1)^Math.imul(a.audCount+99,2654435761),2246822519))>>>0;
  return opts[h%opts.length];
 }
 function vowEff(a,id){const v=(a.vows||[]).find(v=>v.boon===id&&!v.broken);return v&&v.on==='role'&&!a.role?null:(v||null);}
 function playRole(s,a,roleId,H){
  const ch=H.C?.characters?.[roleId];
  if(!ch||!ch.configs?.length){say(s,H,a,`${a.name}'s audition falls through: no such role.`);return false;}
  if(a.role)revert(s,a,H,'takes a new role');
  const prev=a.typecast?.role,plays=prev===roleId?Math.min(rules.typecastMax,(a.typecast.plays||1)+1):1;
  a.typecast={role:roleId,plays};
  if(!a.roleBase)a.roleBase={primary:a.primary,secondary:a.secondary};
  const cfg=ch.configs[0];   // the lead loadout: a role reads as its class
  const extra=(a.vows||[]).some(v=>v.boon==='stayInCharacter'&&!v.broken)?1:0;   // read raw: the role doesn't exist yet at play time
  const granted=[...(ch.traits||[])].filter(t=>!hasTrait(a,typeof t==='string'?t:t?.id));
  a.primary=cfg.primary;a.secondary=cfg.secondary;
  a.role={class:roleId,config:cfg.id,plays,stacks:plays,until:a.ownerTurns+plays+extra,granted:granted.map(t=>typeof t==='string'?t:t?.id)};
  for(const t of granted)a.traits.push(t);
  const tcNote=plays>1?` Typecast ×${plays}: +${Math.round(plays*rules.typecastStep*100)}% potency.`:'';
  say(s,H,a,`${a.name} takes the role: ${pairLabel(H,roleId)} for ${plays+extra} turn${plays+extra===1?'':'s'}.${tcNote}`,['A role brings its pair techniques and mandatory class traits; the Actor keeps his own.']);
  delete a.audition;
  return true;
 }
 // Method Acting: revert now. Charge carries, role summons and buffs persist by
 // design (ruling 5); one random trait is kept from the old form, single slot.
 function revert(s,a,H,why='the run ends'){
  if(!a.role)return false;
  const from=a.role.class,granted=a.role.granted||[];
  if(a.roleBase){a.primary=a.roleBase.primary;a.secondary=a.roleBase.secondary;delete a.roleBase;}
  const keepId=a.methodKeep||null;
  a.traits=(a.traits||[]).filter(t=>{const id=typeof t==='string'?t:t?.id;return id===keepId||!granted.includes(id);});
  let kept=null;
  if(granted.length){
   const h=Math.abs(Math.imul((s.seed||1)^Math.imul((a.revertCount=(a.revertCount||0)+1),2654435761),2246822519))>>>0;
   kept=granted[h%granted.length];
   if(keepId&&keepId!==kept)a.traits=a.traits.filter(t=>(typeof t==='string'?t:t?.id)!==keepId);
   if(!hasTrait(a,kept))a.traits.push(kept);
   a.methodKeep=kept;
  }
  const label=H.C?.characters?.[from]?.name||from;
  say(s,H,a,`${a.name} steps out of ${label}: ${why}. Charge carries; summons and buffs persist.${kept?` Keeps one thing from the part: ${kept}.`:''}`);
  delete a.role;
  return true;
 }
 function gdpActive(s,a){return !!(s.gdp&&s.gdp.owner===a.id&&!a.defeated&&a.ownerTurns<(s.gdp.until??0));}
 function taxMult(s,a){return gdpActive(s,a)?Math.min(rules.taxCap,Math.pow(rules.taxBase,s.gdp.stacks||1)):1;}
 // Enemies pay the tax to target the star (ruling 11): multi-target techniques
 // pay it once per technique — one multiplier on the cost, not per target.
 function taxFor(s,u,targetIds,H){
  if(!s.gdp||!targetIds||!targetIds.length)return 1;
  const star=s.actors?.[s.gdp.owner];
  if(!star||star.defeated||u.side===star.side||!targetIds.includes(star.id))return 1;
  return taxMult(s,star);
 }
 function reactionTax(s,d,attackerId){
  if(!s.gdp||!attackerId||s.gdp.owner!==attackerId)return 1;
  const star=s.actors?.[attackerId];
  if(!star||star.defeated||d.side===star.side)return 1;
  return taxMult(s,star);
 }
 function stardom(s,a,H){
  const global=gdpActive(s,a);
  const friends=live(s).filter(u=>u.side===a.side&&u.id!==a.id&&(global||H.dist(s,a.x,a.y,u.x,u.y)<=rules.stardomRadius));
  let fed=0;
  for(const u of friends){
   const lf=Math.min(u.maxLF,(u.lf||0)+rules.stardomLF)-(u.lf||0),pf=Math.min(u.maxPF??30,(u.pf||0)+rules.stardomPF)-(u.pf||0);
   if(lf>0||pf>0){u.lf=(u.lf||0)+lf;u.pf=(u.pf||0)+pf;fed++;}
  }
  if(fed)say(s,H,a,`${a.name}'s Stardom reaches ${fed} ${fed===1?'ally':'allies'}${global?' across the whole field':''}: +${rules.stardomLF} LF, +${rules.stardomPF} ΦF.`,['The posse glows. Under Genre-Defining Performance the aura goes global.']);
  return fed;
 }
 function turnStart(s,a,H){
  if(!isActor(a)||a.defeated)return;
  stardom(s,a,H);
  if(!a.role)return;
  if(s.film)return;   // the role clock pauses inside a film, like the cameo timer
  if(vowEff(a,'showMustGoOn')&&!(a.status?.ward))a.status.ward={label:'The show must go on',owner:a.id,protection:4,expiresAt:a.ownerTurns+1};
  if((a.typecast?.plays||0)>=rules.churnFrom&&a.typecast.role===a.role.class)
   H.inspire(s,a,1,`${a.name} holds the part (play ${a.typecast.plays}): the room leans in.`);
  if(a.ownerTurns>=a.role.until)revert(s,a,H,'the run ends');
 }
 function afterHit(s,src,tgt,inst,dealt,H){
  if(!src||!tgt||src.defeated||tgt.defeated||!(dealt>0)||!hasTrait(src,'theLook'))return;
  s.lookHit||={};
  if(s.lookHit[tgt.id]===s.round)return;   // at most one stagger per enemy per turn
  src.lookRolls=(src.lookRolls||0)+1;
  const bonus=vowEff(src,'stealTheScene')?0.15:0;
  if(H.seededChance(`${s.seed}:look:${src.id}:${tgt.id}:${s.round}:${src.lookRolls}`)<rules.lookChance+bonus){
   s.lookHit[tgt.id]=s.round;
   const had=tgt.reaction>0;tgt.reaction=0;
   say(s,H,src,`${src.name}'s Look catches ${tgt.name}: staggered${had?' — the reaction is gone':''}.`,['10% per damaging move, at most once per enemy per turn.']);
  }
 }
 function damageMods(s,src,tgt,inst,type,H){
  if(isActor(src)&&src.role?.stacks>0){
   const extra=vowEff(src,'stealTheScene')?1:0;
   const mult=1+rules.typecastStep*(src.role.stacks+extra);
   return {mult,why:[`Typecast ×${src.role.stacks}${extra?'+1 (stole the scene)':''}: +${Math.round((mult-1)*100)}% potency.`]};
  }
  return null;
 }
 function resolve(s,a,inst,H){
  if(!IDS.has(inst.ability))return false;
  if(!isActor(a)){say(s,H,a,`${a.name} holds auditions, but the villains only answer the Actor's call.`);return true;}   // a borrowed part with no stage (the Mitsuko audition): say so, don't fizzle silent
  if(inst.ability==='audition'){
   const opts=options(s,a,H);
   if(!opts.length){say(s,H,a,`${a.name} holds auditions, but no villain answers the call.`);return true;}
   const labels=opts.map(c=>pairLabel(H,c)).join(' · ');
   if(a.controller==='player'&&!inst.role){
    say(s,H,a,`${a.name} holds auditions. Three answer: ${labels}. Take one.`);
    return true;   // the UI offers the three; the pick arrives as inst.role
   }
   const pick=inst.role&&opts.includes(inst.role)?inst.role:aiPick(s,a,opts,H);
   say(s,H,a,`${a.name} holds auditions. Three answer: ${labels}.`);
   playRole(s,a,pick,H);
   return true;
  }
  if(inst.ability==='genreDefiningPerformance'){
   if(!H.spendInspiration(s,a,rules.gdpCost,'perform')){say(s,H,a,`${a.name}'s Genre-Defining Performance fizzles: the purse is empty.`);return true;}
   const stacks=s.gdp?.owner===a.id?Math.min(2,(s.gdp.stacks||1)+1):1;
   s.gdp={owner:a.id,until:a.ownerTurns+rules.gdpTurns,stacks};
   say(s,H,a,`${a.name} gives the Genre-Defining Performance: the whole field becomes fans for ${rules.gdpTurns} turns. Stardom goes global; enemies pay ×${Math.min(rules.taxCap,Math.pow(rules.taxBase,stacks))} AP to target ${a.name}.`,['Re-cast while it runs to raise the tax to the 4× soft cap.']);
   return true;
  }
  return false;
 }
 function beforeAbility(s,a,m,H){
  if(!isActor(a))return null;
  if(m?.id==='genreDefiningPerformance'||m?.ability==='genreDefiningPerformance'){
   if((a.inspiration||0)<rules.gdpCost)return `Genre-Defining Performance needs ${rules.gdpCost} Inspiration (have ${a.inspiration||0}).`;
  }
  return null;
 }
 function aiValue(s,a,cand,H){
  if(!isActor(a))return null;
  const id=cand?.ability;
  if(id==='audition'){
   if(a.role&&a.ownerTurns<a.role.until)return 2;   // mid-run: the part still plays
   const foes=live(s).filter(u=>u.side!==a.side).length;
   const repeat=a.typecast?.role&&a.role?.class===a.typecast.role?a.typecast.plays:0;
   return 26+foes*4+(a.role?0:10)+repeat*6;   // a best-pick estimate: new parts are worth more with more foes to answer
  }
  if(id==='genreDefiningPerformance'){
   const foes=live(s).filter(u=>u.side!==a.side).length;
   if((a.inspiration||0)<rules.gdpCost||foes<2)return 0;   // the room is too small for the Performance
   return 60+foes*8;   // a full room and a full purse: the Performance pays
  }
  return null;
 }
 return { IDS, rules, pool, options, pairLabel, aiPick, playRole, revert, gdpActive, taxMult, taxFor, reactionTax, stardom, turnStart, afterHit, damageMods, resolve, beforeAbility, aiValue };
});
