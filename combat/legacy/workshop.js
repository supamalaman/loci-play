"use strict";
// Codex workshop prototype. Pure account transactions; proving uses an isolated real-engine state.
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory(require("./legacy-battle.js"),require("./contracts.js"),require("./desk-margin.js"));
  else root.ConceptCombatWorkshop=factory(root.ConceptCombatLegacyBattle,root.ConceptCombatContracts,root.ConceptCombatDeskMargin);
})(typeof self!=="undefined"?self:this,function(LB,D,DM){
  const copy=x=>JSON.parse(JSON.stringify(x));
  const hash=s=>{let a=2166136261,b=5381;for(const c of s){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return (a>>>0).toString(36)+(b>>>0).toString(36);};
  // C1b0 (landing 1): the duplicate content hash ignores the name and the price fields, so a renamed copy, or the same
  // recipe compiled after a tariff change or a Recopy, still matches. A work inscribed before C1b0 has no stored hash:
  // hashOf computes it from the stored ability, so the check covers old works too.
  const contentHashOf=(ability)=>{const c=copy(ability);delete c.name;delete c.cost;delete c.tempoCost;return hash(JSON.stringify(c));};
  const hashOf=(d)=>d.hash||(d.workshopAbility?contentHashOf(d.workshopAbility):null);
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
    if(!hostile&&!ally&&range>1)warnings.push("This reaches farther than it can use: self-only effects land on the caster.");
    const power=Math.min(1,Math.max(.25,Number(r.power)||1)),pow=effects.some(e=>SCALABLE.includes(e.key))?power:1;
    // Interaction matrix (prototype, Mala 2026-10-22): pairwise price factors over effect keys. 1.0 is
    // neutral; below rewards natural pairings, above taxes friction. Lookup is symmetric (sorted pair key);
    // unlisted pairs are neutral, so existing prices hold until a cell is authored. All cells provisional.
    const INTERACTIONS={"damage+push":0.9,"damage+root":0.95,"adaptResistance+ward":0.95,"damage+ward":1.15};
    const pairKey=(a,b)=>[a,b].sort().join("+"),ek=effects.map(e=>e.key);
    let pairMult=1;for(let i=0;i<ek.length;i++)for(let j=i+1;j<ek.length;j++)pairMult*=INTERACTIONS[pairKey(ek[i],ek[j])]??1;
    if(power<1&&pow===1)warnings.push("Power has nothing to scale here.");
    for(const e of effects){if(e.params.potency)e.params.potency=Math.max(1,Math.round(Math.min(16,e.params.potency)*scale*pow));if(e.params.protection)e.params.protection=Math.max(1,Math.round(e.params.protection*scale*pow));if(e.params.tiles)e.params.tiles=Math.max(1,Math.round(e.params.tiles*pow));if(e.params.ap)e.params.ap=Math.max(1,Math.round(e.params.ap*pow));}
    const authored=Object.fromEntries([...new Set(effects.map(e=>e.source))].map(s=>[s,C.abilities[s]?.cost]).filter(([,c])=>c!=null)),{gross,ap,complexity,bundle}=priceOf(effects,{scale,pow,pairMult,radius,authored,F:DM.table.tariff.F,C:DM.table.tariff.C});   // the price, as a pure function of the effects and these inputs (scribing desk A2a)
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
    return {ok:true,recipe:copy(r),ability,id,ap,phi,inscription,used:[...used.keys()],provenance:[...used.values()].map(p=>({id:p.id,source:p.source,name:p.sourceName})),summary:ability.reveal,breakdown:[`${effects.length} effects`,`${complexity.toFixed(2)}× complexity`,...(pairMult===1?[]:[`${pairMult.toFixed(2)}× pairing`]),`${gross} gross ΦF`,`${Math.round(reduction*100)}% responsibility reduction`,`${phi} final ΦF`],pricing:{gross,bundle,complexity,responsibility,reduction,phi,interactions:pairMult,effects:effects.map(e=>({key:e.key,source:e.source,phi:e.phi,ap:e.ap})),inputs:{scale,pow,pairMult,radius,authored,F:DM.table.tariff.F,C:DM.table.tariff.C}},contractDesign:design,sample,warnings};
  }
  function migrateRecipe(recipe){
    if(!recipe||Array.isArray(recipe.effects))return recipe;
    const r=recipe,effects=[];
    if(r.effect==="shove"){effects.push({part:r.load,key:"damage"});effects.push({part:r.rider||r.load,key:"push"});}
    else if(r.effect==="ward")effects.push({part:r.load,key:"ward"});
    else effects.push({part:r.load,key:"damage"});
    return {name:r.name,delivery:r.delivery,scale:r.scale||"balanced",shape:r.shape||"focused",power:1,effects,contract:r.contract||{},training:r.training,migratedFrom:"blueprint"};
  }
  const SCALABLE=["damage","ward","push","stagger"];
  // The price of a set of effects, pure (scribing desk A2a): gross phi and AP from each effect's own phi and AP and four inputs (scale, pow, pairMult, radius).
  // `compile` calls it; Recopy and Amend (later slices) call it over a stored work, because inscribing consumes the parts and compile cannot be run again.
  function priceOf(effects,inp){
    const efactor=e=>((e.key==="damage"||e.key==="ward")?inp.scale:1)*(SCALABLE.includes(e.key)?inp.pow:1);
    // The bundle cap (scribing desk A2): per source, the DISTINCT component keys' phi sum is capped at that source's authored phi (taking all of Cuff costs 4, not 9);
    // a key picked again is not collapsed, it costs its full phi. Each share is then scaled by efactor as before. `inp.authored` maps a source to its authored phi.
    const by=new Map();for(const e of effects){const g=by.get(e.source)||{seen:new Set(),du:0,ds:0,extra:0};const v=e.phi*efactor(e);if(g.seen.has(e.key))g.extra+=v;else{g.seen.add(e.key);g.du+=e.phi;g.ds+=v;}by.set(e.source,g);}
    let grossEffects=0;for(const [src,g] of by){const cap=inp.authored?.[src];grossEffects+=(cap!=null&&g.du>cap?g.ds*(cap/g.du):g.ds)+g.extra;}
    const complexity=Math.pow(inp.C??1.35,Math.max(0,effects.length-1))*inp.pairMult;   // C: the complexity base, 1.15 from the desk-margin table (A3); an input without one keeps the old 1.35
    const gross=Math.ceil(((inp.F??2)+grossEffects+inp.radius*2)*complexity);   // F: the foundation, 1 from the desk-margin table (A3); an input without one keeps the old 2   // no reach term: reach is bought only by the reach spend (scribing desk A1)
    const ap=20+effects.reduce((n,e)=>n+Math.round(e.ap*(SCALABLE.includes(e.key)?inp.pow:1)),0)+inp.radius*3;
    return {gross,ap,complexity,grossEffects,bundle:grossEffects};
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
    const contentHash=contentHashOf(q.ability);
    if(l.scribed.some(d=>d.id===q.id||hashOf(d)===contentHash))return {ok:false,error:"This exact blueprint is already inscribed. Equip it from your library.",account};
    if((account.seeds||0)<q.inscription)return {ok:false,error:`Inscription costs ${q.inscription} Seeds.`,account};
    l.parts=l.parts.filter(p=>!q.used.includes(p.id));
    const def={id:q.id,hash:contentHash,name:q.ability.name,workshop:true,workshopAbility:copy(q.ability),recipe:copy(q.recipe),provenance:q.provenance,ap:q.ap,cost:q.phi,concepts:q.ability.concepts,
      tariff:DM.table.tariff.defStamp,tempoCost:q.ap,pricing:{gross:q.pricing.gross,effects:copy(q.pricing.effects),inputs:copy(q.pricing.inputs)}};   // scribing desk A5: the tariff this work was priced under, and what priceOf needs to price it again (Recopy, Amend); an older def has none (= tariff 1)
    l.scribed.push(def);
    return {ok:true,account:{...account,seeds:account.seeds-q.inscription,legacy:l},technique:def};
  }
  // Recopy (scribing desk A6): free, once, for a def priced under an older tariff. Reprices through priceOf over the
  // stored effects and inputs under the CURRENT tariff (F, C refreshed; the parts are spent so compile cannot run again),
  // then re-derives phi exactly the way compile does. The def keeps its id (a hash of the old ability): only prices,
  // tariff and rev change. Refused when the new price is higher in phi or AP; the stamp marks it done.
  function recopy(account,id){
    const l=state(account),def=l.scribed.find(d=>d.id===id&&d.workshop);
    if(!def)return {ok:false,error:"Choose an inscribed workshop blueprint.",account};
    if((def.tariff??1)>=DM.table.tariff.defStamp)return {ok:false,error:"That work is already priced under the current tariff.",account};
    if(!def.pricing||!def.pricing.effects||!def.pricing.inputs)return {ok:false,error:"That work predates stored pricing and cannot be recopied.",account};
    // The stored ability carries the RESTRICTED range (compile sets range=1 for contact), but design() grants the range
    // credit only on a pre-restriction ranged line: re-validate against the stored range and every contact work refuses.
    // Restore the precondition (range 2+, delivery intact) for the design call only; every other validation still runs.
    const wa=def.workshopAbility,forDesign=(def.recipe?.contract?.cast?.contact&&wa.delivery==="line"&&wa.range<=1)?{...wa,range:2}:wa;
    const design=D.design(def.recipe?.contract||{},forDesign);
    if(!design.ok)return {ok:false,error:design.errors.join(" "),account};
    const inputs={...copy(def.pricing.inputs),F:DM.table.tariff.F,C:DM.table.tariff.C};
    const {gross,ap}=priceOf(def.pricing.effects,inputs);
    const efficiency=((def.recipe?.contract?.spend)||"efficiency")==="efficiency";
    const responsibility=design.credits.reduce((n,c)=>n+c.points,0),reduction=efficiency?Math.min(.95,responsibility*.05):0;
    let phi=Math.max(2,Math.ceil(gross*(1-reduction)))+(design.specialty.phi||0)+(design.contract.cast.extraPhi||0);
    if(design.contract.cast.ultimate)phi=Math.max(14,phi);
    if(phi>def.cost||ap>def.ap)return {ok:false,error:`Recopy would raise the price (now ${def.cost} ΦF ${def.ap} AP, repriced ${phi} ΦF ${ap} AP).`,account};
    def.tariff=DM.table.tariff.defStamp;def.cost=phi;def.ap=ap;def.pricing={gross,effects:copy(def.pricing.effects),inputs};
    def.workshopAbility.cost=phi;def.workshopAbility.tempoCost=ap;def.rev=(def.rev||0)+1;
    return {ok:true,account:{...account,legacy:l},technique:def};
  }
  // Amend (scribing desk C1b1): revise an inscribed work's name, scale, power, footprint or contract. The parts
  // are spent, so mechanics rebuild from the content adapters (source+key survive on the def) and the price
  // rebuilds through priceOf at the current tariff, exactly as compile would. Components and delivery are
  // locked. Same id, rev + 1, hash recomputed, once per work per battle, 30 + 10 x parts Seeds.
  function amend(account,id,changes,C){
    const fail=(error)=>({ok:false,error,account});
    const l=state(account),def=l.scribed.find(d=>d.id===id&&d.workshop);
    if(!def)return fail("Choose an inscribed workshop blueprint.");
    const battles=account.battles||0;
    if(def.amendedAt===battles)return fail("This work was already amended since your last battle.");
    const ch=changes||{};
    if(ch.delivery!==undefined||ch.effects!==undefined)return fail("Components and delivery are locked after inscribing.");
    if(!def.pricing||!def.pricing.inputs||!Array.isArray(def.workshopAbility?.scribedEffects))return fail("That work predates stored pricing and cannot be amended.");   // an older def has no pricing (= tariff 1, workshop.js inscribe); Recopy refuses it the same way
    const T=DM.table.amend;if(!T)return fail("The desk's prices are not loaded.");
    const recipe={...copy(def.recipe)};
    if(ch.name!==undefined)recipe.name=ch.name;
    if(ch.scale!==undefined)recipe.scale=ch.scale;
    if(ch.power!==undefined)recipe.power=ch.power;
    if(ch.shape!==undefined||ch.footprint!==undefined)recipe.shape=ch.shape??ch.footprint;
    if(ch.contract!==undefined)recipe.contract=copy(ch.contract);
    if(!["light","balanced","heavy"].includes(recipe.scale)||!["focused","wide"].includes(recipe.shape))return fail("Choose scale and footprint.");
    const storedFx=def.workshopAbility.scribedEffects,effects=[];
    for(const s of storedFx){
      const adapter=(LB.partsOf(s.source,C)?.effects||[]).find(e=>e.key===s.key);
      if(!adapter)return fail("An adapter this work was built from is no longer known.");
      effects.push({...copy(adapter),recipient:s.recipient,source:s.source});
    }
    const hostile=effects.some(e=>e.recipient==="target"),ally=effects.some(e=>e.recipient==="ally");
    const delivery=def.workshopAbility.delivery;   // locked, resolved at inscribe
    if(recipe.shape==="wide"&&delivery!=="field")return fail("Wide needs field delivery.");
    const scale={light:.75,balanced:1,heavy:1.25}[recipe.scale],radius=delivery==="field"?(recipe.shape==="wide"?2:1):0;
    const power=Math.min(1,Math.max(.25,Number(recipe.power)||1)),pow=effects.some(e=>SCALABLE.includes(e.key))?power:1;
    for(const e of effects){if(e.params.potency)e.params.potency=Math.max(1,Math.round(Math.min(16,e.params.potency)*scale*pow));if(e.params.protection)e.params.protection=Math.max(1,Math.round(e.params.protection*scale*pow));if(e.params.tiles)e.params.tiles=Math.max(1,Math.round(e.params.tiles*pow));if(e.params.ap)e.params.ap=Math.max(1,Math.round(e.params.ap*pow));}
    const {gross,ap}=priceOf(effects,{scale,pow,pairMult:def.pricing.inputs.pairMult,radius,authored:def.pricing.inputs.authored,F:DM.table.tariff.F,C:DM.table.tariff.C});
    const oldDesign=D.design(def.recipe?.contract||{},def.workshopAbility);   // the stored range may hold the old strength bonus; peel it before adding the new one
    if(!oldDesign.ok)return fail(oldDesign.errors.join(" "));
    const rangeBase=def.workshopAbility.range-((def.recipe?.contract?.spend||"efficiency")!=="efficiency"?(oldDesign.rangeAdd||0):0);
    const ability={name:String(recipe.name||"Untitled technique").trim().slice(0,40)||"Untitled technique",tier:"refined",concepts:def.workshopAbility.concepts.slice(),delivery,target:hostile&&delivery!=="field"?"enemy":ally?"ally":"self",area:radius?{shape:"radius",radius}:{shape:"single"},range:rangeBase,potency:effects.filter(e=>e.key==="damage").reduce((n,e)=>n+e.params.potency,0),cost:gross,tempoCost:ap,effect:"scribedEffects",scribed:true,scribedEffects:effects,mechanism:"Ordered composition of recovered effects."};
    const contract=recipe.contract||{};
    if(contract.spend==="strength"&&!effects.some(e=>["damage","ward"].includes(e.key)))return fail("Strength allocation needs a damage or ward component; use ΦF efficiency for control and resistance.");
    if(contract.specialization&&contract.specialization!=="none"&&!effects.some(e=>e.key==="damage"))return fail("A damage specialization needs a damage component.");
    const design=D.design(contract,ability);if(!design.ok)return fail(design.errors.join(" "));
    if(design.ongoing&&contract.spend!=="efficiency")return fail("Maintained component assemblies currently spend responsibility on ΦF efficiency; held strength needs its own adapter.");
    const efficiency=(contract.spend||"efficiency")==="efficiency";
    const responsibility=design.credits.reduce((n,c)=>n+c.points,0),reduction=efficiency?Math.min(.95,responsibility*.05):0;
    let phi=Math.max(2,Math.ceil(gross*(1-reduction)))+(design.specialty.phi||0)+(design.contract.cast.extraPhi||0);
    if(design.contract.cast.ultimate){phi=Math.max(14,phi);ability.tier="ultimate";ability.announce="The written conditions have been fulfilled.";}
    if(!efficiency){for(const e of effects)if(e.key==="damage")e.params.potency=Math.round(e.params.potency*design.initialMult);else if(e.key==="ward")e.params.protection=Math.round(e.params.protection*design.initialMult);ability.range+=design.rangeAdd;}
    ability.potency=effects.filter(e=>e.key==="damage").reduce((n,e)=>n+e.params.potency,0);
    if(design.contract.cast.contact)ability.range=1;
    ability.cost=phi;if(design.enabled){ability.contract=design.contract;ability.contractDuration=design.duration;ability.contractPulsePotency=ability.potency;}
    ability.reveal=effects.map((e,i)=>`${i+1}. ${e.label} → ${e.recipient}${e.params.duration?` (${e.params.duration} turns)`:""}${e.params.potency?` (${e.params.potency} potency)`:""}`).join("; ");
    const amendedHash=contentHashOf(ability);
    if(l.scribed.some(d=>d!==def&&hashOf(d)===amendedHash))return fail("Another inscribed work already does exactly this. Equip that one instead.");   // C1b0's rule holds for Amend too
    const usedSize=new Set([def.recipe.delivery,...def.recipe.effects.map(e=>e.part)]).size;
    const oldSpec=def.recipe?.contract?.specialization||"none",newSpec=contract.specialization||"none";
    const price=T.seeds+T.perComponent*usedSize+(newSpec!==oldSpec?(design.specialty.seeds||0):0);   // a newly chosen Seed-funded specialization is bought as at inscribe (compile adds design.specialty.seeds); one already paid for is not charged again
    if((account.seeds||0)<price)return fail(`Amending takes ${price} Seeds.`);
    def.workshopAbility=ability;def.recipe=recipe;def.name=ability.name;def.ap=ap;def.tempoCost=ap;def.cost=phi;def.concepts=ability.concepts;
    def.pricing={gross,effects:effects.map(e=>({key:e.key,source:e.source,phi:e.phi,ap:e.ap})),inputs:{scale,pow,pairMult:def.pricing.inputs.pairMult,radius,authored:def.pricing.inputs.authored,F:DM.table.tariff.F,C:DM.table.tariff.C}};
    def.tariff=DM.table.tariff.defStamp;def.rev=(def.rev||0)+1;def.hash=amendedHash;def.amendedAt=battles;
    return {ok:true,account:{...account,seeds:account.seeds-price,legacy:l},technique:def,price};
  }
  function equip(account,id,replace=null){
    const l=state(account),m=l.memory;
    if(!l.scribed.some(d=>d.id===id&&d.workshop))return {ok:false,error:"Choose an inscribed workshop blueprint.",account};
    if(m.held.includes(id))return {ok:true,account};
    // B2c (landing 1): a free desk slot, then a free general slot; only a full memory asks for a replacement.
    if(needsReplace(account)){if(!replace||!m.held.includes(replace))return {ok:false,error:"Memory is full. Choose which technique to replace.",account};m.held=m.held.filter(x=>x!==replace);m.forgotten[replace]=true;}
    m.held.push(id);delete m.forgotten[id];return {ok:true,account:{...account,legacy:l}};
  }
  const needsReplace=(account)=>{const u=LB.memoryUse(account);return !u.deskFree&&!u.generalFree;};
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
  return {state,training,materials,groups,components,describePart,compile,priceOf,migrateRecipe,saveDraft,inscribe,recopy,amend,equip,needsReplace,unequip,prove};
});
