"use strict";
// Auditor Goblin W2. Trait-owned precedent travels to any bearer; records are witnessed, battle-local and JSON-only.
(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory();else root.ConceptCombatAuditor=factory();})(typeof self!=="undefined"?self:this,function(){
  const LAW="laws_of_gods_of_men", TRAIT="citesPrecedent";
  const has=(u,t)=>(u?.traits||[]).some(x=>(typeof x==="string"?x:x.id)===t);
  const live=u=>!!u&&!u.defeated&&!u.notArrived&&!u.escaped;
  const pair=(a,b)=>a.primary===LAW&&a.secondary===b;
  const R={tax:15,debt:25,radius:5,cover:3,pfPerFind:2,refundCap:6};
  const def=(name,concepts,tier,range,more)=>({name,concepts,tier,range,cost:5,potency:0,channel:null,delivery:"self",target:"self",area:{shape:"single"},effect:"classEffect",classKind:"auditor",effectCategory:"conditional",mechanism:name,targetRule:"Self; actual affected recipients are visible legal enemies or own-side finds under the effect rules.",prerequisites:"Own the technique and meet its equipped-concept, resource and stored-state requirements.",actionCost:tier==="ultimate"?50:35,phiForceCost:more.cost??5,potencyDefinition:"No direct damage; bounded tax, reveal, citation or allowance.",timing:"immediate",expiry:"Objection: next owner turn; citations: second following owner turn; Crescendo: shared turn/next-round allowance; trap knowledge: battle.",dependencies:["law/law.js","engine/window.js","engine/ledgers.js"],price:"Normal tier AP and printed PF; reactions pay their shared AP fraction, plus a reaction. Point of Order spends 1 Inspiration.",counter:"Vary techniques, deny sight, leave the posted rule, or exhaust the reaction and PF budget.",teaches:"A record permits a bounded response, never an invented accusation.",newEffect:more.mechanism||name, ...more});
  const abilities={
    objection:def("Objection",[LAW],"refined",0,{reactive:true,reveal:"Answer a visible ranged attack whose delivery matches your live Statute. Its caster owes 15 AP; the protected target keeps taking the damage, but its push, pull, stun and seed riders are refused. Cites Precedent makes a repeated witnessed attack's answer cost no AP; ΦF and the reaction still cost.",mechanism:"A posted rule prices an incoming delivery and refuses its typed secondary riders."}),
    auditComplete:def("Audit Complete",[LAW,"discovery"],"ultimate",0,{cost:16,merge:true,pairOnly:true,pairs:[[LAW,"discovery"]],announce:"Every little entry accounted for. Thank you for your patience.",reveal:"Reveal concealed enemies and hidden enemy traps within 5 on your side. Revealed enemies covered by your Statute owe 15 AP. Each newly found trap restores 2 ΦF, capped at 6 and at maximum ΦF; a trap can pay only once per auditor per battle.",mechanism:"A finite audit exposes nearby concealed threats and collects the posted price without damage."}),
    ledgerOfDebts:def("Ledger of Debts",[LAW,"indexing"],"ultimate",0,{cost:16,merge:true,pairOnly:true,pairs:[[LAW,"indexing"]],announce:"I have kept the receipts. Let us compare them.",reveal:"For each visible enemy within 5, cite its most-used technique you witnessed this battle. Its next use within two owner turns costs 25 extra AP. The citation is consumed at payment and never stacks; defeating the auditor clears it.",mechanism:"A bounded public citation prices one repeated recorded technique, not an unknown future action."}),
    pointOfOrder:def("Point of Order",[LAW,"discovery"],"refined",0,{cost:0,crescendo:{free:["verify"],answer:true},pairOnly:true,pairs:[[LAW,"discovery"]],reveal:"Spend 1 Inspiration: your next Verify this turn costs no AP or ΦF, and your next reactive answer is whole and spends no reaction. The answer allowance expires after next round.",mechanism:"Spend Inspiration through the shared Crescendo allowance; verification is still a separate chosen action."})
  };
  function sight(s,a,b,H){return live(a)&&live(b)&&H.dreamSame(s,a.x,a.y,b.x,b.y)&&H.hasSight(s,a.x,a.y,b.x,b.y)&&!b.status?.concealed;}
  function hostile(s,a,b,H){return live(b)&&a.id!==b.id&&a.side!==b.side&&!['civilian','bystander'].includes(a.side)&&!['civilian','bystander'].includes(b.side)&&!H.Factions?.blocked(s,a,b)&&!H.Factions?.blocked(s,b,a)&&!H.Parley?.blocks(s,a,b)&&!H.Parley?.blocks(s,b,a);}
  function zones(s,a){return (s.terrainEffects||[]).filter(e=>e.kind==="statute"&&e.owner===a.id&&live(a)&&a.ownerTurns<e.expiresAt);}
  function matching(s,a,atk,delivery){return zones(s,a).some(e=>e.named===delivery&&(e.tiles||[]).some(([x,y])=>x===atk.x&&y===atk.y));}
  const memory=(s,a,b)=>s.auditMemory?.[a.id]?.[b.id]||{};
  const repeated=(s,a,attack)=>((memory(s,a,{id:attack.owner})[attack.ability]||0)>=2)||!!s.auditCitations?.[attack.owner]?.some(e=>e.by===a.id&&e.ability===attack.ability&&validCitation(s,e));
  function validCitation(s,e){const by=s.actors[e.by];return live(by)&&by.primary===LAW&&by.secondary==='indexing'&&by.ownerTurns<e.until;}
  function committed(s,a,m,H){
    const id=m.id||m.ability;if(!id||m.probe)return;
    for(const o of Object.values(s.actors))if(hostile(s,o,a,H)&&sight(s,o,a,H)){
      const row=(((s.auditMemory||={})[o.id]||={})[a.id]||={});row[id]=Math.min(99,(row[id]||0)+1);
    }
    if(s.auditCitations?.[a.id])s.auditCitations[a.id]=s.auditCitations[a.id].filter(e=>validCitation(s,e)&&e.ability!==id);
  }
  function price(s,a,id,m){
    const list=(s.auditCitations?.[a.id]||[]).filter(e=>validCitation(s,e)&&e.ability===id);
    // A single cited act pays one surcharge even when several auditors have filed it.
    if(list.length){m.tempoCost+=R.debt;m.notes?.push("Ledger of Debts: this cited technique costs +25 AP once.");}
  }
  function reactionAp(s,a,attack,normal){return has(a,TRAIT)&&repeated(s,a,attack)?0:normal;}
  function option(s,a,attack,shown,H){
    const atk=s.actors[attack.owner];
    if(!sight(s,a,atk,H)||!hostile(s,a,atk,H)||!matching(s,a,atk,shown)||H.dist(s,a.x,a.y,atk.x,atk.y)<2)return null;
    const protectedUnit=Object.values(s.actors).find(t=>live(t)&&t.side===a.side&&H.dreamSame(s,a.x,a.y,t.x,t.y)&&H.dist(s,a.x,a.y,t.x,t.y)<=R.cover&&(attack.tiles||[]).some(([x,y])=>H.coversTile?H.coversTile(t,x,y):x===t.x&&y===t.y));
    return protectedUnit?{target:[a.x,a.y],coverFor:protectedUnit.id}:null;
  }
  function sustain(s,a,attack,opt,H){
    const atk=s.actors[attack.owner];if(!live(atk))return;
    const tax=Math.ceil(R.tax*(opt.caught??1));atk.tempoDebt=(atk.tempoDebt||0)+tax;
    (attack.auditRefusedTargets||=[]).push(opt.coverFor||a.id);
    H.log(s,{kind:"audit",actor:a.id,target:atk.id,ability:"objection",text:`${a.name}: “Objection. Only a small one.” ${atk.name} owes ${tax} AP; the protected target's push, pull, stun and seed riders are refused. Damage still lands.`});
    H.Inspiration?.cash(s,a,"A tidy record. A little peace of mind.");
  }
  function forTarget(inst,t){
    if(!inst.auditRefusedTargets?.includes(t.id))return inst;
    return {...inst,knockback:0,pull:0,stunTempo:0,seedLodge:null,seedThorn:null};
  }
  function target(s,a,m,tx,ty){const d=abilities[m.ability||m.id];if(!d)return null;if(d.pairs&&!d.pairs.some(([p,q])=>a.primary===p&&a.secondary===q))return {ok:false,error:"Equip both named concepts for this audit technique."};return {ok:true,tiles:[[a.x,a.y]],targets:[a.id]};}
  function cash(s,a,H){if(!a.defeated&&(a.cashRound||0)<s.round&&H.inspire(s,a,1,"A verified entry: the audit makes sense.")){a.cashRound=s.round;H.log(s,{kind:"quote",actor:a.id,text:`${a.name}: “A tidy record. A little peace of mind.”`});}}
  function verified(s,a,r,found,H){if(r.truth&&found.length&&pair(a,'discovery'))cash(s,a,H);}
  function resolve(s,a,inst,H){
    const id=inst.ability;if(!abilities[id])return false;
    if(id==='objection'){
      if(inst.reaction)return true;
      a.status.auditPrimed={until:(a.ownerTurns||0)+1};
      H.log(s,{kind:'audit',actor:a.id,text:`${a.name} holds a small finger over the ledger: Objection is prepared through the start of the next turn. It still needs a matching live Statute and a reaction.`});return true;
    }
    if(id==='pointOfOrder')return true;
    if(id==='auditComplete'){
      let finds=0;const seen=((s.auditFinds||={})[a.id]||=[]);
      for(const t of (s.traps||[]))if(!t.spent&&t.ownerSide!==a.side&&H.dist(s,a.x,a.y,t.x,t.y)<=R.radius&&H.dreamSame(s,a.x,a.y,t.x,t.y)){
        const key=`${t.x},${t.y}:${t.ownerSide}`,paidKey=key;
        const newly=!a.trapSeen?.[key];(a.trapSeen||={})[key]=true;
        if(newly&&!seen.includes(paidKey)){seen.push(paidKey);finds++;}
      }
      let revealed=0,taxed=0;
      for(const t of Object.values(s.actors))if(hostile(s,a,t,H)&&H.dist(s,a.x,a.y,t.x,t.y)<=R.radius&&H.dreamSame(s,a.x,a.y,t.x,t.y)){
        if(t.status?.concealed){delete t.status.concealed;revealed++;}
        if(H.hasSight(s,a.x,a.y,t.x,t.y)&&zones(s,a).some(e=>(e.tiles||[]).some(([x,y])=>x===t.x&&y===t.y))){t.tempoDebt=(t.tempoDebt||0)+R.tax;taxed++;}
      }
      const restored=Math.max(0,Math.min(R.refundCap,finds*R.pfPerFind,(a.maxPF||a.pf)-a.pf));a.pf+=restored;
      H.log(s,{kind:'audit',actor:a.id,ability:id,text:`${a.name} closes the ledger gently. ${finds} new trap finds, ${revealed} concealed foes revealed, ${taxed} posted accounts taxed; ${restored} ΦF restored.`});return true;
    }
    if(id==='ledgerOfDebts'){
      let count=0;
      for(const t of Object.values(s.actors))if(hostile(s,a,t,H)&&sight(s,a,t,H)&&H.dist(s,a.x,a.y,t.x,t.y)<=R.radius){
        const entries=Object.entries(memory(s,a,t)).sort((x,y)=>y[1]-x[1]||x[0].localeCompare(y[0]));if(!entries.length)continue;
        const ability=entries[0][0],row=((s.auditCitations||={})[t.id]||=[]);
        s.auditCitations[t.id]=row.filter(e=>e.by!==a.id&&validCitation(s,e));
        s.auditCitations[t.id].push({by:a.id,ability,until:(a.ownerTurns||0)+2});count++;
        H.log(s,{kind:'audit',actor:a.id,target:t.id,ability:id,text:`${a.name} cites ${H.C.abilities[ability]?.name||ability}: ${t.name}'s next use owes 25 AP. The citation expires at the auditor's second following turn, or if the auditor falls.`});
      }
      if(!count)H.log(s,{kind:'audit',actor:a.id,text:`${a.name}: “No entry, no accusation.” There is no witnessed technique to cite.`});return true;
    }
    return false;
  }
  function beforeAbility(s,a,m){
    const id=m.id||m.ability,d=abilities[id];
    if(d?.pairs&&!d.pairs.some(([p,q])=>a.primary===p&&a.secondary===q))return "Equip both named concepts for this audit technique.";
    if(id==='pointOfOrder'&&!(s.rumors||[]).some(r=>r.ownerSide===a.side&&r.expiresRound>s.round))return "No rumour to verify: keep the Inspiration.";
    return null;
  }
  function turnStart(s,a){if(a.status?.auditPrimed&&a.ownerTurns>=a.status.auditPrimed.until)delete a.status.auditPrimed;for(const key of Object.keys(s.auditCitations||{})){s.auditCitations[key]=s.auditCitations[key].filter(e=>validCitation(s,e));if(!s.auditCitations[key].length)delete s.auditCitations[key];}}
  return {abilities,R,TRAIT,has,committed,price,reactionAp,option,sustain,forTarget,target,verified,resolve,beforeAbility,turnStart};
});
