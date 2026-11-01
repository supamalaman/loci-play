"use strict";
// Observer-local knowledge and bounded rewards. AI reads facts only after ordinary Observe pays for them.
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory();
  else root.ConceptCombatObservation=factory();
})(typeof self!=="undefined"?self:this,function(){
  const has=(a,id)=>(a.traits||[]).some(t=>(t.id||t)===id);
  const nature=a=>["hiker","botanist","horticultureExpertise","steward","plantKin"].some(id=>has(a,id));
  const botanist=a=>has(a,"botanist")||has(a,"horticultureExpertise");
  function knowledge(s,a,write=false){
    const all=s.insight?.knowledge||{};
    if(write)return (s.insight.knowledge[a.id] ||= {});
    return all[a.id]||{};
  }
  function cognitive(s,a,write=false){
    if(a.id==="player")return s.insight.cognitive;
    if(write)return (s.insight.observers ||= {})[a.id] ||= {subjects:{},kinds:{}};
    return s.insight.observers?.[a.id]||{subjects:{},kinds:{}};
  }
  function setCognitive(s,a,c){if(a.id==="player")s.insight.cognitive=c;else(s.insight.observers ||= {})[a.id]=c;}
  function plantBook(s,a,write=false){
    if(a.id==="player")return s.communion;
    if(write)return (s.communion.observers ||= {})[a.id] ||= {familiarity:{},closed:{}};
    return s.communion.observers?.[a.id]||{familiarity:{},closed:{}};
  }
  // Tsukumogami (Muse Berry BD): the same shape for structures. No `closed`: a wrong answer spends the
  // cost and the structure stays asleep, but it never closes (docs/tsukumogami.md §3). `warned` is the
  // once-per-battle "not you" before a non-Animist invests.
  function structureBook(s,a,write=false){
    if(a.id==="player")return s.tsukumogami;
    if(write)return (s.tsukumogami.observers ||= {})[a.id] ||= {familiarity:{},warned:false};
    return s.tsukumogami.observers?.[a.id]||{familiarity:{},warned:false};
  }
  function discoveries(s,a,target){return s.discernment?.[a.id]?.[target]?.length||0;}
  // A fact is recorded only after a paid observation or a successful verification has resolved.
  // Receipts belong to actors; shared facts do not count as personal Discernment or practice.
  const enabled=s=>s.rules.knowledgeSharing!==false;
  function recordFact(s,a,fact,method="observe") {
    if(!enabled(s)||!a)return false;
    const db=s.findings ||= {facts:{},holders:{}};
    const book=db.holders[a.id] ||= {};
    if(book[fact.id])return false;
    db.facts[fact.id] ||= {...fact,origin:a.id,originName:a.name,method,round:s.round};
    book[fact.id]={via:a.id,viaName:a.name,round:s.round,method};
    return true;
  }
  function recordCards(s,a,subject,cards,method="observe") {
    for(const card of cards||[])recordFact(s,a,{id:`card:${subject}:${card.id}`,kind:"card",subject,card:card.id,text:card.text||card.tell||card.id},method);
  }
  function validFact(s,f) {
    if(!f)return false;
    if(f.kind==="trap") {const t=s.traps?.[f.index];return !!t&&!t.spent&&t.owner===f.owner&&t.x===f.at[0]&&t.y===f.at[1];}
    if(f.kind==="plant") {const o=s.arena.objects?.find(o=>o.id===f.subject);return !!o&&!o.dead&&o.hp>0&&o.type===f.type;}
    if(f.kind==="structure") {const o=s.arena.objects?.find(o=>o.id===f.subject);return !!o&&o.kind==="object"&&o.hp>0&&o.type===f.type;}
    if(f.kind==="location") {const u=s.actors[f.subject];return !!u&&!u.defeated&&u.x===f.at[0]&&u.y===f.at[1];}
    return !!s.insight?.decks?.[f.subject]?.cards.some(c=>c.id===f.card);
  }
  function factsOf(s,a){return Object.keys(s.findings?.holders?.[a.id]||{}).map(id=>s.findings.facts[id]).filter(f=>validFact(s,f));}
  function share(s,from,receivers,h) {
    if(!enabled(s))return 0;
    let count=0;
    for(const f of factsOf(s,from))for(const to of receivers) {
      if(to.id===from.id||to.side!==from.side||!eligible(to)||to.notArrived||to.escaped)continue;
      const receipts=(s.findings.holders[to.id] ||= {});
      if(receipts[f.id])continue;
      if(f.kind==="card") {
        const all=knowledge(s,to,true),deck=s.insight.decks[f.subject];
        const k=all[f.subject] ||= h.insightRules.spawnKnowledge(deck);
        if(k.revealed.includes(f.card))continue;
        k.revealed.push(f.card);
      } else if(f.kind==="plant") {
        // Observe teaches: a scout who studied a plant passes its study note on with the familiarity.
        const pb=plantBook(s,to,true),book=pb.familiarity,fam=f.familiarity||0;
        if((book[f.subject]||0)>=fam&&!f.clue)continue;
        if(fam>(book[f.subject]||0))book[f.subject]=fam;
        if(f.clue)(pb.clues ||= {})[f.subject]=true;
      } else if(f.kind==="structure") {
        const book=structureBook(s,to,true).familiarity;
        if((book[f.subject]||0)>=f.familiarity)continue;
        book[f.subject]=f.familiarity;
      } else if(f.kind==="trap") {
        const t=s.traps[f.index],key=`${t.x},${t.y}:${t.ownerSide||"?"}`;
        (to.trapSeen ||= {})[key]=true;
      }
      receipts[f.id]={via:from.id,viaName:from.name,round:s.round,method:"report"};count++;
      h.log(s,{kind:"knowledgeShare",actor:from.id,target:to.id,fact:f.id,subject:f.subject,
        text:`${to.name} learns from ${from.name}: ${f.text}`,
        why:["Reported knowledge unlocks its normal tactical uses, but grants no personal observation bonus or study practice."]});
    }
    return count;
  }
  function findingNoteOptions(s,a) {
    if(!enabled(s)||!a||a.id!=="player"||a.defeated)return [];
    const noted=new Set((s.findingNotes||[]).map(n=>n.id));
    return factsOf(s,a).filter(f=>!noted.has(f.id)).map(f=>({id:f.id,name:f.text,source:s.findings.holders[a.id][f.id]}));
  }
  function credit(s,a,target,facts,h){
    recordCards(s,a,target.id,facts,"observe");
    (s.observationTurns ||= {})[a.id]=a.ownerTurns;
    if(!has(a,"discernment")||a.side===target.side||target.category==="bystander")return;
    const list=((s.discernment ||= {})[a.id] ||= {})[target.id] ||= [];
    for(const f of facts||[])if(!f.open&&!list.includes(f.id)&&list.length<5)list.push(f.id);
    if(list.length)h.log(s,{kind:"discernment",actor:a.id,target:target.id,text:`${a.name}'s Discernment: ${list.length} discoveries about ${target.name}, +${list.length*5}% direct damage.`});
  }
  function damageBonus(s,a,target,inst){
    if(!a||!target||!has(a,"discernment")||a.side===target.side||!inst?.ability||inst.environmental||inst.performanceEcho||a.summon||a.communed||a.beast)return 1;
    return 1+Math.min(5,discoveries(s,a,target.id))*.05;
  }
  function eligible(a){return a&&!a.defeated&&!a.notArrived&&a.category!=="bystander"&&!a.summon&&!a.communed&&!a.awakened&&!a.beast&&!a.dream;}
  function hidden(s,a,subject,h){
    const deck=s.insight?.decks?.[subject],know=knowledge(s,a)[subject]||(deck&&h.insightRules.spawnKnowledge(deck));
    return deck&&know?deck.cards.filter(c=>!know.revealed.includes(c.id)).length:0;
  }
  // In danger (hit since the last round, or under 40% LF) a plant-based fighter stops walking to and studying plants and
  // reading the place; communing stays at full value, since a plant that answers now is a bodyguard (Mala, 2026-10-14).
  const inDanger=(s,a)=>a.lf<a.maxLF*0.4||(a.lastHit&&s.round-a.lastHit.round<=1);
  const DANGER_MUL=0.25;
  function plantPlan(s,a,h){
    if(!h.Communion||!eligible(a))return [];
    if(!nature(a)&&a.side!=="player")return [];   // your side studies plants the way you do (Mala, 2026-10-20); foes need a nature trait
    const book=plantBook(s,a),active=Object.values(s.actors).filter(u=>u.communed?.owner===a.id&&!u.defeated).length;
    if(active>=h.Communion.rules.maxActive)return [];
    const reachable=h.paths(s,a.x,a.y,999,"move"),out=[];
    for(const o of s.arena.objects||[]){
      const p=o.kind==="plant"&&!o.dead&&o.hp>0&&!book.closed[o.id]&&h.Communion.profile(o.type);
      if(!p||h.actorAt(s,o.x,o.y)||a.pf+h.communeDiscount(a)<p.phi||!h.dreamSame(s,a.x,a.y,o.x,o.y))continue;
      const adjacent=[[o.x+1,o.y],[o.x-1,o.y],[o.x,o.y+1],[o.x,o.y-1]].map(at=>({at,path:reachable.pathTo(...at)})).filter(v=>v.path);
      adjacent.sort((x,y)=>x.path.length-y.path.length);
      if(!adjacent.length)continue;
      const goal=adjacent[0],d=h.dist(s,a.x,a.y,o.x,o.y),f=book.familiarity[o.id]||0;
      if(f>=p.need&&d<=h.Communion.rules.range&&a.tempo>=h.Communion.rules.communeAp){
        const q=h.Communion.questionFor(o,s.seed);   // Observe teaches: the same pinned question the engine asks
        if(q)out.push({action:{type:"commune",actor:a.id,object:o.id,questionId:q.id,answer:q.answer},value:36+(botanist(a)?8:0)+Math.min(8,p.hp/5)});
      }else if(f<p.need&&d<=h.Communion.rules.observeRange&&(d<=1||h.hasSight(s,a.x,a.y,o.x,o.y))&&a.tempo>=h.Communion.rules.observeStep){
        const bonus=(has(a,"hiker")?h.Communion.rules.hikerBonus:0)+(has(a,"botanist")?h.Communion.rules.botanist.observeBonus:0);
        const invest=Math.min(h.Communion.rules.observeMax,Math.max(h.Communion.rules.observeStep,(p.need-f-bonus)*h.Communion.rules.observeStep));
        if(a.tempo>=invest)out.push({action:{type:"observePlant",actor:a.id,object:o.id,invest},value:((botanist(a)?26:14)-Math.min(8,goal.path.length-1))*(inDanger(s,a)?DANGER_MUL:1)});
      }
      // A future ally's full paid turn is valuable; score progress toward an actual adjacent arrival site.
      if(d>1){
        const moves=h.moveOptions(s,a.id).filter(m=>m.path&&m.path.every(([x,y])=>h.tileAt(s,x,y).hazard<=0||!h.tileAt(s,x,y).hazard));
        const along=moves.filter(m=>goal.path.some(p=>p[0]===m.to[0]&&p[1]===m.to[1])).sort((x,y)=>goal.path.findIndex(p=>p[0]===y.to[0]&&p[1]===y.to[1])-goal.path.findIndex(p=>p[0]===x.to[0]&&p[1]===x.to[1]));
        if(along[0])out.push({action:{type:"move",actor:a.id,to:along[0].to,observationGoal:o.id},value:((botanist(a)?23:11)-Math.min(10,goal.path.length/2))*(inDanger(s,a)?DANGER_MUL:1)});
      }
    }
    return out;
  }
  // Tsukumogami (docs/tsukumogami.md §6): an AI Animist values awakening the biggest eligible structure
  // within reach when it has the AP and ΦF. Enemies can be Animists, so both sides plan; the trait alone
  // gates (no nature rule as for plants). Commune value scores expected damage over its rounds (strike ×
  // rounds) against ΦF cost — provisional weights, flagged for Mala's overrule with the rest of slice 6.
  function structurePlan(s,a,h){
    if(!h.Tsukumogami||!eligible(a))return [];
    if(!has(a,"animist"))return [];   // non-Animists can study but never wake; the AI skips both
    const book=structureBook(s,a),active=Object.values(s.actors).filter(u=>u.awakened&&!u.defeated&&u.awakened.owner===a.id).length;
    if(active>=h.Tsukumogami.rules.maxActive)return [];
    const reachable=h.paths(s,a.x,a.y,999,"move"),out=[];
    for(const o of s.arena.objects||[]){
      const p=o.kind==="object"&&!o.protected&&o.hp>0?h.Tsukumogami.profile(o.type):null;
      if(!p||h.actorAt(s,o.x,o.y)||a.pf+h.communeDiscount(a,"structure")<p.phi||!h.dreamSame(s,a.x,a.y,o.x,o.y))continue;
      const adjacent=[[o.x+1,o.y],[o.x-1,o.y],[o.x,o.y+1],[o.x,o.y-1]].map(at=>({at,path:reachable.pathTo(...at)})).filter(v=>v.path);
      adjacent.sort((x,y)=>x.path.length-y.path.length);
      if(!adjacent.length)continue;
      const goal=adjacent[0],d=h.dist(s,a.x,a.y,o.x,o.y),f=book.familiarity[o.id]||0;
      if(f>=p.need&&d<=h.Tsukumogami.rules.range&&a.tempo>=h.Tsukumogami.rules.communeAp){
        const q=h.Tsukumogami.pickQuestion(o.type,`${s.seed}:${s.round}:${o.id}`);
        if(q)out.push({action:{type:"communeStructure",actor:a.id,object:o.id,questionId:q.id,answer:q.answer},value:30+h.Tsukumogami.rules.strikeBySize[p.size]*h.Tsukumogami.rules.rounds-p.phi*2});
      }else if(f<p.need&&d<=h.Tsukumogami.rules.observeRange&&(d<=1||h.hasSight(s,a.x,a.y,o.x,o.y))&&a.tempo>=h.Tsukumogami.rules.observeStep){
        const invest=Math.min(h.Tsukumogami.rules.observeMax,Math.max(h.Tsukumogami.rules.observeStep,(p.need-f)*h.Tsukumogami.rules.observeStep));
        if(a.tempo>=invest)out.push({action:{type:"observeStructure",actor:a.id,object:o.id,invest},value:(26-Math.min(8,goal.path.length-1))*(inDanger(s,a)?DANGER_MUL:1)});
      }
      // A future ally's full paid turn is valuable; score progress toward an actual adjacent arrival site.
      if(d>1){
        const moves=h.moveOptions(s,a.id).filter(m=>m.path&&m.path.every(([x,y])=>h.tileAt(s,x,y).hazard<=0||!h.tileAt(s,x,y).hazard));
        const along=moves.filter(m=>goal.path.some(p=>p[0]===m.to[0]&&p[1]===m.to[1])).sort((x,y)=>goal.path.findIndex(p=>p[0]===y.to[0]&&p[1]===y.to[1])-goal.path.findIndex(p=>p[0]===x.to[0]&&p[1]===x.to[1]));
        if(along[0])out.push({action:{type:"move",actor:a.id,to:along[0].to,observationGoal:o.id},value:(23-Math.min(10,goal.path.length/2))*(inDanger(s,a)?DANGER_MUL:1)});
      }
    }
    return out;
  }
  // rules.hype: an unchecked Hypebeast (Diffusion + Deception) this unit still believes AND has already lost action
  // points to. Until it has felt something is off it has no reason to check; a curious unit may look anyway.
  const hyped=(s,a,t)=>!!s.rules.hype&&a.status?.hypeFelt===t.id&&t.primary==="diffusion"&&t.secondary==="deception"&&!(t.hype?.seenBy||[]).includes(a.id)&&!s.rules.hype.mindless.some(k=>a[k]);
  function options(s,a,h){
    if(!eligible(a)||s.rules.observationAi===false)return [];
    const out=plantPlan(s,a,h);
    out.push(...structurePlan(s,a,h));
    const studied=s.observationTurns?.[a.id]===a.ownerTurns;
    if(!studied&&h.insightRules&&a.tempo>=20){
      if((a.observes||0)<3)for(const t of Object.values(s.actors))if(t.id!==a.id&&!t.defeated&&!t.notArrived&&t.side!==a.side&&t.category!=="bystander"&&h.dreamSame(s,a.x,a.y,t.x,t.y)&&h.hasSight(s,a.x,a.y,t.x,t.y)&&(hidden(s,a,t.id,h)>0||hyped(s,a,t))){   // three studies per battle: keeps the ~2.6 avg, kills the 22-spikes
        if(has(a,"discernment")&&discoveries(s,a,t.id)>=5)continue;
        const detail=a.focus?.target===t.id&&(a.focus.expiresAt??0)>a.ownerTurns&&a.focus.detail;   // a retained detail is worth cashing in
        const worth=Math.max(0,...Object.entries(s.rules.observation?.ai?.traits||{}).filter(([id])=>has(a,id)&&!(id==="scout"&&(a.scoutObserves||0)>=3)).map(([,v])=>v),detail?1:0);   // a scout stops ranging once it has its three
        if(hyped(s,a,t)){out.push({action:{type:"observe",actor:a.id,target:t.id,invest:20},value:Math.max(worth,s.rules.hype.ai.observe)});continue;}   // anyone will check a Hypebeast: it is the counter
        { const dk=s.insight?.decks?.[t.id],kk=knowledge(s,a)[t.id]||(dk&&h.insightRules.spawnKnowledge(dk));   // Boss keys: anyone studies a foe with unrevealed Keys (capped curiosity, not obsession)
          const nKeys=dk&&kk?dk.cards.filter(c=>c.kind==="key"&&!kk.revealed.includes(c.id)).length:0;
          if(nKeys>0&&worth===0)out.push({action:{type:"observe",actor:a.id,target:t.id,invest:20},value:Math.min(6,2+nKeys)}); }
        if(worth>0)out.push({action:{type:"observe",actor:a.id,target:t.id,invest:20},value:worth});   // no inclining trait, no study
      }
      if(nature(a)&&h.Climate&&s.weatherState&&!inDanger(s,a)){
        const deck=h.Climate.placeDeck(h.moduleArena(s.arena),s.weatherState,{seed:s.seed}),know=knowledge(s,a)[deck.subject.key]||h.insightRules.spawnKnowledge(deck);
        const pv=s.rules.observation?.ai?.place||{botanist:12,base:9};
        if(deck.cards.some(c=>!know.revealed.includes(c.id)))out.push({action:{type:"observePlace",actor:a.id,invest:20},value:botanist(a)?pv.botanist:pv.base});
      }
    }
    return out;
  }
  // `shows` is the trait tag the AI adds to its chosen action; it is not part of what the action is.
  const plain=action=>{const {shows,...rest}=action||{};return JSON.stringify(rest);};
  function value(s,a,action,h){return options(s,a,h).find(o=>plain(o.action)===plain(action))?.value??0;}
  return {recordFact,recordCards,validFact,factsOf,share,findingNoteOptions,has,nature,botanist,knowledge,cognitive,setCognitive,plantBook,structureBook,discoveries,credit,damageBonus,eligible,hidden,plantPlan,options,value};
});
