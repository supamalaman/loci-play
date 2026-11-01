"use strict";
// Codex workshop prototype. Pure account transactions; proving uses an isolated real-engine state.
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory(require("./legacy-battle.js"),require("./contracts.js"));
  else root.ConceptCombatWorkshop=factory(root.ConceptCombatLegacyBattle,root.ConceptCombatContracts);
})(typeof self!=="undefined"?self:this,function(LB,D){
  const copy=x=>JSON.parse(JSON.stringify(x));
  const hash=s=>{let a=2166136261,b=5381;for(const c of s){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return (a>>>0).toString(36)+(b>>>0).toString(36);};
  const state=a=>{const l=LB.fresh(a?.legacy);l.workshop={version:1,drafts:[],next:1,...l.workshop};return l;};
  const training=C=>["snapShot","shieldWall","diffuseWave"].map(id=>({id:`training:${id}`,...LB.partsOf(id,C)}));
  const materials=(a,C,sample=false)=>(sample?training(C):state(a).parts).map(p=>({...p,effects:LB.partsOf(p.source,C)?.effects||[]}));
  const groups=parts=>{const m=new Map();for(const p of parts){if(m.has(p.source))m.get(p.source).quantity++;else m.set(p.source,{...p,quantity:1});}return [...m.values()];};
  const components=(a,C,sample=false)=>materials(a,C,sample).flatMap(p=>(p.effects||[]).map(e=>({...e,part:p.id,source:p.source,sourceName:p.sourceName})));
  // Inventory honesty (Mala, 2026-10-22): a part contributes effects AND a delivery. A part with no
  // executable effects is still a carrier — Membrane delivers placed (range 3) and can carry Brace resistance.
  const describePart=(p)=>{const bits=[],eff=(p.effects||[]).map(e=>e.label).join(", ");
    if(eff)bits.push(eff);
    if(p.delivery)bits.push(`delivers ${p.delivery}${p.delivery==="self"?"":` (range ${p.load?.range??0})`}`);
    else bits.push("no carrier");
    if(!eff)bits.push("no executable effects");
    return bits.join(" · ");};
  function compileEffects(account,r,C,{sample=false}={}){
    const pool=materials(account,C,sample),find=id=>pool.find(p=>p.id===id),pd=find(r.delivery),errors=[],warnings=[],used=new Map(),effects=[],voices=[];
    if(!pd)return {ok:false,errors:["Choose a delivery source."]};
    // Boss-art parts are usable, not decorative: disassembly already demanded a legendary tradition, and the
    // parts carry the same bar (minStrength). Only a tradition that lapsed since leaves them unusable (Mala, 2026-10-24:
    // "taken apart, then can't use them for parts" — the old flat refusal contradicted the Take-apart button).
    const tradMax=Math.max(0,...(state(account).ledger?.traditions||[]).map(t=>t.strength||0));
    const bossBlocked=p=>p?.boss&&tradMax<(p.minStrength||LB.BOSS_STRENGTH);
    if(bossBlocked(pd))return {ok:false,errors:[`Boss-art parts need a legendary tradition (strength ${pd.minStrength||LB.BOSS_STRENGTH}+).`]};
    used.set(pd.id,pd);
    if(!Array.isArray(r.effects)||!r.effects.length)errors.push("Add at least one effect component.");
    if((r.effects||[]).length>64)errors.push("This blueprint is too large to store safely.");
    for(const choice of (r.effects||[]).slice(0,64)){
      const p=find(choice.part),e=p?.effects.find(e=>e.key===choice.key);
      if(!e){errors.push("A selected effect is missing or has no executable adapter.");continue;}
      if(bossBlocked(p)) {errors.push(`Boss-art parts need a legendary tradition (strength ${p.minStrength||LB.BOSS_STRENGTH}+).`);continue;}
      if(p.requires&&p.source!=="cuff"&&p.source!=="halt") {errors.push("That effect still depends on its source identity.");continue;}
      const recipient=choice.recipient||e.target;
      if(!(e.recipients||["self","ally","target"]).includes(recipient))errors.push(e.label+" cannot aim at "+recipient+".");
      voices.push(...(p.channel||[]));
      effects.push({...copy(e),recipient,source:p.source});used.set(p.id,p);
    }
    const concepts=(r.voice?[r.voice]:[...new Set(voices)]).filter(x=>C.concepts[x]);
    if(!concepts.length)errors.push("Choose a concept affinity.");
    if(!["light","balanced","heavy"].includes(r.scale)||!["focused","wide"].includes(r.shape))errors.push("Choose scale and footprint.");
    const hostile=effects.some(e=>e.recipient==="target"),ally=effects.some(e=>e.recipient==="ally");
    if(ally&&hostile)errors.push("One blueprint aims at one side: allies and opponents cannot share it.");
    let delivery=pd.delivery; if(delivery==="placed"&&effects.every(e=>e.recipient==="self"))delivery="self";
    if(delivery==="field"&&ally)errors.push("Fields cannot place on allies.");
    if(delivery==="field"&&!hostile&&!ally)errors.push("Self-only effects need a self delivery (or a placed ward source); unused reach cannot add power or cost.");
    if(!["self","contact","line","field","placed"].includes(delivery))errors.push("This delivery needs an adapter before it can carry these effects.");
    if(delivery==="self"&&hostile)warnings.push("This reaches no one past the caster: a self delivery has no reach.");
    if(r.shape==="wide"&&delivery!=="field")errors.push("Wide needs field delivery.");
    if(errors.length)return {ok:false,errors};
    const scale={light:.75,balanced:1,heavy:1.25}[r.scale],radius=delivery==="field"?(r.shape==="wide"?2:1):0;
    const range=delivery==="self"||delivery==="field"?0:delivery==="contact"?Math.max(1,Math.min(2,Number(pd.load.range)||1)):Math.max(1,Math.min(5,Number(pd.load.range)||3));   // placed mirrors line (provisional)
    if(!hostile&&!ally&&range>1)warnings.push("This pays for reach it cannot use: self-only effects land on the caster.");
    const power=Math.min(1,Math.max(.25,Number(r.power)||1)),SCALABLE=["damage","ward","push","stagger"],pow=effects.some(e=>SCALABLE.includes(e.key))?power:1;
    // Interaction matrix (prototype, Mala 2026-10-22): pairwise price factors over effect keys. 1.0 is
    // neutral; below rewards natural pairings, above taxes friction. Lookup is symmetric (sorted pair key);
    // unlisted pairs are neutral, so existing prices hold until a cell is authored. All cells provisional.
    const INTERACTIONS={"damage+push":0.9,"damage+root":0.95,"adaptResistance+ward":0.95,"damage+ward":1.15};
    const pairKey=(a,b)=>[a,b].sort().join("+"),ek=effects.map(e=>e.key);
    let pairMult=1;for(let i=0;i<ek.length;i++)for(let j=i+1;j<ek.length;j++)pairMult*=INTERACTIONS[pairKey(ek[i],ek[j])]??1;
    if(power<1&&pow===1)warnings.push("Power has nothing to scale here.");
    for(const e of effects){if(e.params.potency)e.params.potency=Math.max(1,Math.round(Math.min(16,e.params.potency)*scale*pow));if(e.params.protection)e.params.protection=Math.max(1,Math.round(e.params.protection*scale*pow));if(e.params.tiles)e.params.tiles=Math.max(1,Math.round(e.params.tiles*pow));if(e.params.ap)e.params.ap=Math.max(1,Math.round(e.params.ap*pow));}
    const efactor=e=>((e.key==="damage"||e.key==="ward")?scale:1)*(SCALABLE.includes(e.key)?pow:1);
    const grossEffects=effects.reduce((n,e)=>n+e.phi*efactor(e),0),complexity=Math.pow(1.35,Math.max(0,effects.length-1))*pairMult;
    const gross=Math.ceil((2+grossEffects+Math.max(0,range-1)+radius*2)*complexity);
    const ap=20+effects.reduce((n,e)=>n+Math.round(e.ap*(SCALABLE.includes(e.key)?pow:1)),0)+Math.max(0,range-1)+radius*3;
    const ability={name:String(r.name||"Untitled technique").trim().slice(0,40)||"Untitled technique",tier:"refined",concepts,delivery,target:hostile&&delivery!=="field"?"enemy":ally?"ally":"self",area:radius?{shape:"radius",radius}:{shape:"single"},range,potency:effects.filter(e=>e.key==="damage").reduce((n,e)=>n+e.params.potency,0),cost:gross,tempoCost:ap,effect:"scribedEffects",scribed:true,scribedEffects:effects,mechanism:"Ordered composition of recovered effects."};
    if(r.contract?.spend==="strength"&&!effects.some(e=>["damage","ward"].includes(e.key)))return {ok:false,errors:["Strength allocation needs a damage or ward component; use ΦF efficiency for control and resistance."]};
    if(r.contract?.specialization&&r.contract.specialization!=="none"&&!effects.some(e=>e.key==="damage"))return {ok:false,errors:["A damage specialization needs a damage component."]};
    const design=D.design(r.contract||{},ability);if(!design.ok)return {ok:false,errors:design.errors};
    if(design.ongoing&&r.contract?.spend!=="efficiency")return {ok:false,errors:["Maintained component assemblies currently spend responsibility on ΦF efficiency; held strength needs its own adapter."]};
    // A restriction buys either cheaper energy OR strength/reach, never both.
    const efficiency=(r.contract?.spend||"efficiency")==="efficiency";
    const responsibility=design.credits.reduce((n,c)=>n+c.points,0);
    const reduction=efficiency?Math.min(.95,responsibility*.05):0;
    let phi=Math.max(2,Math.ceil(gross*(1-reduction)))+(design.specialty.phi||0)+(design.contract.cast.extraPhi||0);
    if(design.contract.cast.ultimate){phi=Math.max(14,phi);ability.tier="ultimate";ability.announce="The written conditions have been fulfilled.";}
    if(!efficiency){for(const e of effects)if(e.key==="damage")e.params.potency=Math.round(e.params.potency*design.initialMult);else if(e.key==="ward")e.params.protection=Math.round(e.params.protection*design.initialMult);ability.range+=design.rangeAdd;}
    ability.potency=effects.filter(e=>e.key==="damage").reduce((n,e)=>n+e.params.potency,0);
    if(design.contract.cast.contact)ability.range=1;
    ability.cost=phi;if(design.enabled){ability.contract=design.contract;ability.contractDuration=design.duration;ability.contractPulsePotency=ability.potency;}
    ability.reveal=effects.map((e,i)=>`${i+1}. ${e.label} → ${e.recipient}${e.params.duration?` (${e.params.duration} turns)`:""}${e.params.potency?` (${e.params.potency} potency)`:""}`).join("; ");
    const id=`scribed_work_${hash(JSON.stringify(ability))}`,inscription=30+10*used.size+(design.specialty.seeds||0);
    return {ok:true,recipe:copy(r),ability,id,ap,phi,inscription,used:[...used.keys()],provenance:[...used.values()].map(p=>({id:p.id,source:p.source,name:p.sourceName})),summary:ability.reveal,breakdown:[`${effects.length} effects`,`${complexity.toFixed(2)}× complexity`,...(pairMult===1?[]:[`${pairMult.toFixed(2)}× pairing`]),`${gross} gross ΦF`,`${Math.round(reduction*100)}% responsibility reduction`,`${phi} final ΦF`],pricing:{gross,complexity,responsibility,reduction,phi,interactions:pairMult},contractDesign:design,sample,warnings};
  }
  function migrateRecipe(recipe){
    if(!recipe||Array.isArray(recipe.effects))return recipe;
    const r=recipe,effects=[];
    if(r.effect==="shove"){effects.push({part:r.load,key:"damage"});effects.push({part:r.rider||r.load,key:"push"});}
    else if(r.effect==="ward")effects.push({part:r.load,key:"ward"});
    else effects.push({part:r.load,key:"damage"});
    return {name:r.name,delivery:r.delivery,scale:r.scale||"balanced",shape:r.shape||"focused",power:1,effects,contract:r.contract||{},training:r.training,migratedFrom:"blueprint"};
  }
  function compile(account,recipe,C,{sample=false}={}){
    if(!recipe||!Array.isArray(recipe.effects))return {ok:false,errors:["This draft predates the sentence desk. Reopen it at the desk to translate it."]};
    return compileEffects(account,{...recipe,contract:{spend:"efficiency",...recipe.contract}},C,{sample});
  }
  function saveDraft(account,recipe,id=null){
    const l=state(account),w=l.workshop,old=id?w.drafts.find(d=>d.id===id):null;
    if(id&&!old)return {ok:false,error:"That draft no longer exists.",account};
    const next={id:old?.id||`draft-${w.next++}`,revision:(old?.revision||0)+1,recipe:copy(migrateRecipe(recipe))};
    if(old)w.drafts=w.drafts.map(d=>d.id===id?next:d);else w.drafts.push(next);
    return {ok:true,account:{...account,legacy:l},draft:next};
  }
  function inscribe(account,recipe,C){
    const q=compile(account,recipe,C);if(!q.ok)return {ok:false,error:q.errors.join(" "),account};
    const l=state(account);
    if(l.scribed.some(d=>d.id===q.id))return {ok:false,error:"This exact blueprint is already inscribed. Equip it from your library.",account};
    if((account.seeds||0)<q.inscription)return {ok:false,error:`Inscription costs ${q.inscription} Seeds.`,account};
    l.parts=l.parts.filter(p=>!q.used.includes(p.id));
    const def={id:q.id,name:q.ability.name,workshop:true,workshopAbility:copy(q.ability),recipe:copy(q.recipe),provenance:q.provenance,ap:q.ap,cost:q.phi,concepts:q.ability.concepts};
    l.scribed.push(def);
    return {ok:true,account:{...account,seeds:account.seeds-q.inscription,legacy:l},technique:def};
  }
  function equip(account,id,replace=null){
    const l=state(account),m=l.memory;
    if(!l.scribed.some(d=>d.id===id&&d.workshop))return {ok:false,error:"Choose an inscribed workshop blueprint.",account};
    if(m.held.includes(id))return {ok:true,account};
    if(m.held.length>=m.slots){if(!replace||!m.held.includes(replace))return {ok:false,error:"Memory is full. Choose which technique to replace.",account};m.held=m.held.filter(x=>x!==replace);m.forgotten[replace]=true;}
    m.held.push(id);delete m.forgotten[id];return {ok:true,account:{...account,legacy:l}};
  }
  function unequip(account,id){const l=state(account);l.memory.held=l.memory.held.filter(x=>x!==id);return {ok:true,account:{...account,legacy:l}};}
  function prove(account,recipe,C,E,{sample=false,fixture="open",seed=41,rehearse=false}={}){
    const q=compile(account,recipe,C,{sample});if(!q.ok)return q;
    if(!["open","guarded","cluster","close","beast","construct","large","water","concentrating"].includes(fixture))return {ok:false,errors:["Unknown proving-ground fixture."]};
    const old=C.abilities[q.id];
    try{
      const ward=(q.ability.scribedEffects||[]).some(e=>e.key==="ward"&&e.recipient==="self"),close=ward||fixture==="close",at=close?[3,3]:[5,3];
      let s=E.create({encounter:"firstWall",seed,startingActor:fixture==="guarded"?"foe":"player",arenaData:{name:"Codex proving ground",map:Array(7).fill("..........."),objects:[]},participants:[{id:"player",character:"warden",side:"player",at:[2,3]},{id:"foe",character:"soldier",side:"enemy",at},...(fixture==="cluster"?[{id:"second",character:"soldier",side:"enemy",at:[3,4]}]:[]),...(q.ability.target==="ally"?[{id:"ally",character:"soldier",side:"player",at:[2,4]}]:[]),...(rehearse?(q.ability.contract?.unlock||[]).filter(x=>x.kind==='defeat').map((x,i)=>({id:`proof-key-${i}`,character:'soldier',side:'enemy',at:[i%9+1,1+Math.floor(i/9)]})):[])],legacy:{memory:[q.id],scribed:[{id:q.id,ability:q.ability}]}});
      for(const u of Object.values(s.actors)){u.traits=[];u.lf=u.maxLF=200;u.pf=u.maxPF=30;u.tempo=100;}
      if(q.ability.scribedEffects?.some(e=>e.key==='adaptResistance'))s.actors.player.lastDamageType='nigredo';
      for(const u of Object.values(s.actors))if(u.id.startsWith('proof-key-'))u.lf=1;
      if(fixture==='beast'||fixture==='construct')s.actors.foe.bodyType=fixture;
      if(fixture==='large')s.actors.foe.massive=true;
      if(fixture==='water'){const row=s.arena.map[at[1]];s.arena.map[at[1]]=row.slice(0,at[0])+'w'+row.slice(at[0]+1);}
      if(fixture==='concentrating')s.actors.foe.status.heldTones={};
      const perform=a=>{const r=E.apply(s,a);if(!r.ok)throw new Error(r.error);s=r.state;};
      if(fixture==="guarded"){perform({type:"guard",actor:"foe"});perform({type:"end",actor:"foe"});}
      const trialStart=s.log.length;
      const pass=()=>{if(s.phase==='action'&&E.decider(s).actor==='player')perform({type:'end',actor:'player'});for(let i=0;i<30&&E.decider(s)?.actor!=='player'&&!s.outcome;i++){const d=E.decider(s);perform(d.kind==='response'?{type:'respond',actor:d.actor,response:'none'}:{type:'end',actor:d.actor});}if(s.outcome||E.decider(s)?.actor!=='player')throw new Error('Rehearsal ended before casting.');};
      const moveOne=preferred=>{let opts=E.moveOptions(s,'player').filter(x=>x.path.length===2);if(!opts.length){pass();opts=E.moveOptions(s,'player').filter(x=>x.path.length===2);}const p=s.actors.player;opts.sort((a,b)=>preferred(a.to)-preferred(b.to));const choice=opts[0];if(!choice)throw new Error('No legal rehearsal step.');let r=E.apply(s,{type:'move',actor:'player',to:choice.to});if(!r.ok){pass();r=E.apply(s,{type:'move',actor:'player',to:choice.to});}if(!r.ok)throw new Error(r.error);s=r.state;};
      if(rehearse&&q.ability.contract){
       for(let n=0;n<700;n++){
        const st=E.availableAbilities(s,'player').find(x=>x.id===q.id)?.contract;if(!st?.next)break;
        if(st.next.kind==='invoke'){if(s.actors.player.tempo<10)pass();perform({type:'contractSpeak',actor:'player',ability:q.id,words:st.next.words});}
        else if(st.next.kind==='move'){const p=s.actors.player;moveOne(to=>Math.abs(to[0]-2)+Math.abs(to[1]-(p.y===3?2:3)));}
        else{const t=Object.values(s.actors).find(t=>t.id.startsWith('proof-key-')&&!t.defeated);if(!t)throw new Error('No eligible rehearsal victim remains.');const p=s.actors.player;if(Math.abs(p.x-t.x)+Math.abs(p.y-t.y)>1)moveOne(to=>Math.abs(to[0]-t.x)+Math.abs(to[1]-t.y));else{if(p.tempo<50)pass();perform({type:'strike',actor:'player',target:[t.x,t.y],effort:50});}}
       }
       let st=E.availableAbilities(s,'player').find(x=>x.id===q.id)?.contract;if(st?.next)throw new Error('Rehearsal step limit reached.');
       if(q.ability.target==='enemy')for(let n=0;n<64&&Math.abs(s.actors.player.x-at[0])+Math.abs(s.actors.player.y-at[1])>q.ability.range;n++)moveOne(to=>Math.abs(to[0]-at[0])+Math.abs(to[1]-at[1]));
       if(q.ability.contract.cast.prepare){if(s.actors.player.tempo<20)pass();perform({type:'contractPrepare',actor:'player',ability:q.id});pass();}
       if(q.ability.contract.cast.ultimate)s.actors.player.ultimateCharge=s.rules.ultimateChargeMax;
       if(s.actors.player.tempo<q.ap)pass();for(let i=0;i<6&&s.actors.player.pf<q.phi;i++){if(s.actors.player.tempo<30)pass();perform({type:'recover',actor:'player'});}if(s.actors.player.tempo<q.ap)pass();
      }
      const before=copy(s),m=E.manifest(s,"player",q.id),target=q.ability.target==="self"?[s.actors.player.x,s.actors.player.y]:q.ability.target==="ally"?[s.actors.ally.x,s.actors.ally.y]:at;
      const result=E.apply(s,{type:"ability",actor:"player",ability:q.id,target});
      if(!result.ok)return {ok:false,errors:[result.error]};s=result.state;
      for(let i=0;i<12&&s.phase==="response";i++)perform({type:"respond",actor:E.decider(s).actor,response:"none"});
      if(s.phase==="response")throw new Error("Trial response limit reached.");
      const castEnd=copy(s),wardBefore=s.actors.player.status.ward?.protection||0;
      if(rehearse&&q.contractDesign?.ongoing){for(let i=0;i<(ward?1:q.contractDesign.duration)&&s.actors.player.contractActive;i++)pass();}
      const heldWard=s.actors.player.status.ward?.protection||0;
      if(ward){perform({type:"end",actor:"player"});perform({type:"strike",actor:"foe",target:[s.actors.player.x,s.actors.player.y]});for(let i=0;i<12&&s.phase==="response";i++)perform({type:"respond",actor:E.decider(s).actor,response:"none"});}
      if(s.phase==="response")throw new Error("Trial response limit reached.");
      const hits=Object.values(castEnd.actors).filter(u=>u.side==="enemy").map(u=>({name:u.name,id:u.id,lost:before.actors[u.id].lf-u.lf,from:[before.actors[u.id].x,before.actors[u.id].y],to:[u.x,u.y]}));
      return {ok:true,fixtureNotes:q.ability.scribedEffects?.some(e=>e.key==="adaptResistance")?"This fixture starts with an observed Nigredo incoming harm channel.":"",effects:q.ability.scribedEffects?copy(s.actors.foe.status):null,selfEffects:q.ability.scribedEffects?copy(s.actors.player.status):null,allyEffects:q.ability.target==="ally"?copy(s.actors.ally.status):null,warnings:q.warnings||[],name:q.ability.name,fixture,seed,hits,ap:before.actors.player.tempo-castEnd.actors.player.tempo,phi:before.actors.player.pf-castEnd.actors.player.pf,manifest:{ap:m.tempoCost,phi:m.cost,potency:m.potency,range:m.range},ward:wardBefore,heldWard,upkeep:s.log.slice(trialStart).filter(e=>e.kind==='contractUpkeep').reduce((n,e)=>n+e.amount,0),followupLF:Object.values(s.actors).filter(u=>u.side==='enemy').reduce((n,u)=>n+Math.max(0,(castEnd.actors[u.id]?.lf||0)-u.lf),0),absorbed:Math.max(0,heldWard-(s.actors.player.status.ward?.protection||0)),selfLost:before.actors.player.lf-s.actors.player.lf,rehearsed:!!(rehearse&&q.ability.contract),log:s.log.slice(rehearse?trialStart:before.log.length).map(e=>e.text).filter(Boolean),summary:q.summary};
    }catch(e){return {ok:false,errors:[e.message]};}
    finally{if(old)C.abilities[q.id]=old;else delete C.abilities[q.id];}
  }
  return {state,training,materials,groups,components,describePart,compile,migrateRecipe,saveDraft,inscribe,equip,unequip,prove};
});
