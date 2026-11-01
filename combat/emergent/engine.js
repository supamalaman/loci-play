/* Deterministic field-operator combat kernel. No UI or concept-pair bonuses.
 * q, volume, concentration, D, ΦF and LF are abstract game units. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EmergentCombat = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const EPS = 1e-11, clone = (x) => JSON.parse(JSON.stringify(x));
  const byId = (a, b) => String(a.id).localeCompare(String(b.id));
  const bad = (m) => { throw new Error(m); };
  const OPS = new Set(["boundary","porosity","diffusion","concentration","storage","release","gradient","threshold"]);

  function totalQuantity(s) {
    return Object.values(s.cells || {}).reduce((n,c) => n + c.q, 0)
      + Object.values(s.characters || {}).reduce((n,a) => n + (a.store || 0), 0);
  }
  function create(input) {
    const s = clone(input);
    s.version = 1; s.phase ||= "action"; s.round ||= 1; s.simulationInterval ??= 1;
    s.safetyFactor ??= 0.9; s.diffusion ??= 0;
    s.cells = Object.fromEntries(Object.entries(s.cells || {}).sort(([a],[b]) => a.localeCompare(b)));
    s.connections = (s.connections || []).map(e => ({...e, boundaryFactor:e.boundaryFactor ?? 1,
      permeabilityModifiers:e.permeabilityModifiers || [], diffusionModifiers:e.diffusionModifiers || []})).sort(byId);
    s.characters = Object.fromEntries(Object.entries(s.characters || {}).sort(([a],[b]) => a.localeCompare(b)));
    s.effects ||= []; s.events ||= []; s.log ||= [];
    for (const c of Object.values(s.cells)) c.concentration = c.q / c.volume;
    s.ledger ||= {};
    s.ledger.initialTotal ??= totalQuantity(s); s.ledger.sources ??= 0; s.ledger.sinks ??= 0;
    validate(s); return s;
  }
  function validate(s) {
    if (!(s.safetyFactor > 0 && s.safetyFactor <= 1)) bad("safetyFactor must be in (0, 1].");
    if (!(s.simulationInterval >= 0) || !Number.isFinite(s.simulationInterval)) bad("Invalid simulation interval.");
    if (!(s.diffusion >= 0) || !Number.isFinite(s.diffusion)) bad("Invalid diffusion coefficient.");
    for (const [id,c] of Object.entries(s.cells)) {
      if (c.id !== id || !Number.isFinite(c.q) || c.q < 0) bad("Cell " + id + " needs matching id and nonnegative q.");
      if (!(c.volume > 0) || !Number.isFinite(c.volume)) bad("Cell " + id + " needs positive finite volume.");
      if (c.capacity != null && (!(c.capacity >= 0) || c.q > c.capacity + EPS)) bad("Cell " + id + " exceeds capacity.");
    }
    const ids = new Set();
    for (const e of s.connections) {
      if (ids.has(e.id)) bad("Duplicate connection id " + e.id); ids.add(e.id);
      if (!s.cells[e.a] || !s.cells[e.b] || e.a === e.b) bad("Connection " + e.id + " has invalid endpoints.");
      if (!(e.conductance >= 0) || !Number.isFinite(e.conductance)) bad("Invalid conductance on " + e.id);
      if (!(e.basePermeability >= 0 && e.basePermeability <= 1)) bad("Invalid base permeability on " + e.id);
      if (!(e.boundaryFactor >= 0 && e.boundaryFactor <= 1)) bad("Invalid boundary factor on " + e.id);
      for (const m of e.permeabilityModifiers) if (!(m.multiplier >= 0) || !Number.isFinite(m.multiplier)) bad("Invalid permeability modifier on " + e.id);
    }
    for (const [id,a] of Object.entries(s.characters)) {
      if (a.id !== id || !s.cells[a.cellId]) bad("Character " + id + " needs matching id and valid cellId.");
      if (!(a.lf >= 0 && a.maxLF > 0 && a.lf <= a.maxLF)) bad("Invalid LF for " + id);
      if (!(a.pf >= 0 && a.maxPF > 0 && a.pf <= a.maxPF)) bad("Invalid ΦF for " + id);
      if (!(a.store >= 0) || !Number.isFinite(a.store)) bad("Invalid stored quantity for " + id);
      if (a.storeCapacity != null && a.store > a.storeCapacity + EPS) bad("Store capacity exceeded by " + id);
    }
    return s;
  }
  function concentration(s,id) { const c=s.cells[id]; if(!c) bad("Unknown cell "+id); return c.q/c.volume; }
  function effectivePermeability(e) {
    return Math.max(0,Math.min(1,e.boundaryFactor*e.basePermeability*
      e.permeabilityModifiers.slice().sort(byId).reduce((v,m)=>v*m.multiplier,1)));
  }
  function effectiveDiffusion(s,e) {
    const base=s.diffusion+(e.diffusionAddition||0);
    return Math.max(0,base*e.diffusionModifiers.slice().sort(byId).reduce((v,m)=>v*m.multiplier,1));
  }
  function stabilityStep(s) {
    let bound=Infinity;
    for(const c of Object.values(s.cells)) {
      let sum=0; for(const e of s.connections) if(e.a===c.id||e.b===c.id)
        sum+=effectiveDiffusion(s,e)*e.conductance*effectivePermeability(e);
      if(sum>0) bound=Math.min(bound,c.volume/sum);
    }
    return bound===Infinity ? (s.simulationInterval||1) : s.safetyFactor*bound;
  }
  // Fluxes are computed from one pre-substep snapshot and committed together.
  function transportSubstep(state,dt) {
    if(!(dt>0)||!Number.isFinite(dt)) bad("Transport dt must be positive and finite.");
    const s=clone(state), delta=Object.fromEntries(Object.keys(s.cells).map(id=>[id,0]));
    const before=totalQuantity(s), fluxes=[], incoming=Object.fromEntries(Object.keys(s.cells).map(id=>[id,0]));
    for(const e of s.connections.slice().sort(byId)) {
      const k=effectiveDiffusion(s,e)*e.conductance*effectivePermeability(e);
      const signed=dt*k*(concentration(s,e.a)-concentration(s,e.b));
      if(signed>0)incoming[e.b]+=signed;else incoming[e.a]+=-signed;
      fluxes.push({edgeId:e.id,from:e.a,to:e.b,signedQuantity:signed});
    }
    // Finite cell capacities reduce simultaneous inflows proportionally. The
    // corresponding outflows are reduced too, so no quantity disappears.
    const scale=Object.fromEntries(Object.keys(s.cells).map(id=>{
      const c=s.cells[id],out=fluxes.reduce((n,f)=>n+(f.signedQuantity>0&&f.from===id?f.signedQuantity:f.signedQuantity<0&&f.to===id?-f.signedQuantity:0),0);
      const room=c.capacity==null?Infinity:Math.max(0,c.capacity-c.q+out);
      return [id,incoming[id]>0?Math.min(1,room/incoming[id]):1];
    }));
    for(const f of fluxes){
      let v=f.signedQuantity;
      if(v>0)v*=scale[f.to];else if(v<0)v*=scale[f.from];
      f.signedQuantity=v;delta[f.from]-=v;delta[f.to]+=v;
    }
    for(const id of Object.keys(delta)) {
      const q=s.cells[id].q+delta[id];
      if(q<0) bad("Transport would make cell "+id+" negative; reduce dt or coefficients.");
      s.cells[id].q=q; s.cells[id].concentration=q/s.cells[id].volume;
    }
    const after=totalQuantity(s);
    if(Math.abs(after-before)>1e-9*Math.max(1,before)) bad("Passive transport violated conservation.");
    const changed=fluxes.filter(f=>Math.abs(f.signedQuantity)>1e-9);
    const explanation=changed.length?"Simultaneous flux: "+changed.map(f=>f.signedQuantity>0?
      f.signedQuantity.toFixed(3)+" "+f.from+"→"+f.to:(-f.signedQuantity).toFixed(3)+" "+f.to+"→"+f.from).join("; ")+".":"No concentration difference produced flux.";
    s.log.push({kind:"transport",dt,before,after,transfers:fluxes,explanation}); return s;
  }
  function advanceTransport(state,interval=state.simulationInterval) {
    if(!(interval>=0)||!Number.isFinite(interval)) bad("Invalid transport interval.");
    const s=clone(state); let left=interval,n=0;
    while(left>EPS) {
      if(++n>100000) bad("Too many transport substeps; coefficients are unreasonable.");
      const dt=Math.min(left,stabilityStep(s)); if(!(dt>0)) bad("Transport stability step is not positive.");
      const next=transportSubstep(s,dt); s.cells=next.cells; s.log.push(next.log.at(-1)); left=Math.max(0,left-dt);
    }
    return s;
  }
  function route(s,from,to) {
    if(!s.cells[from]||!s.cells[to]) return null;
    const prev=new Map([[from,null]]),q=[from];
    while(q.length) {
      const here=q.shift(); if(here===to) break;
      const ns=[];
      for(const e of s.connections) if(effectivePermeability(e)>0) {
        if(e.a===here) ns.push([e.b,e.id]); else if(e.b===here) ns.push([e.a,e.id]);
      }
      ns.sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1]));
      for(const [next,edgeId] of ns) if(!prev.has(next)) {prev.set(next,{cellId:here,edgeId});q.push(next);}
    }
    if(!prev.has(to)) return null;
    const cells=[to],edges=[];let at=to;
    while(at!==from){const p=prev.get(at);edges.unshift(p.edgeId);at=p.cellId;cells.unshift(at);}
    return {cells,edges};
  }
  function record(s,event) {s.log.push({sequence:s.log.length,round:s.round,turn:s.turn||null,...event});}
  function getActor(s,id){const a=s.characters[id];if(!a)bad("Unknown character "+id);return a;}
  function getEdge(s,id){const e=s.connections.find(x=>x.id===id);if(!e)bad("Unknown connection "+id);return e;}
  function pay(a,cost){if(!(cost>=0)||!Number.isFinite(cost))bad("Cost must be finite and nonnegative.");if(a.pf<cost)bad("Needs "+cost+" ΦF; "+(a.name||a.id)+" has "+a.pf+".");a.pf-=cost;}
  function moveField(s,from,to,amount,cause){
    if(!(amount>=0)||!Number.isFinite(amount))bad("Transfer amount must be finite and nonnegative.");
    if(!s.cells[from]||!s.cells[to])bad("Transfer has invalid endpoint.");
    if(s.cells[from].q<amount)bad("Source "+from+" has insufficient quantity.");
    s.cells[from].q-=amount;s.cells[to].q+=amount;
    s.cells[from].concentration=s.cells[from].q/s.cells[from].volume;s.cells[to].concentration=s.cells[to].q/s.cells[to].volume;
    record(s,{kind:"field-transfer",amount,from,to,cause});
  }
  function applyOperator(state,op) {
    const s=clone(state);
    try {
      if(!op||!OPS.has(op.type))bad("Unknown operator type "+(op&&op.type)+".");
      const a=getActor(s,op.actor),cost=op.cost||0;pay(a,cost);
      if(op.disclosureMultiplier!=null&&!(op.disclosureMultiplier>=1&&Number.isFinite(op.disclosureMultiplier)))bad("Invalid disclosure multiplier.");
      const id=op.instanceId||("op-"+(s.log.length+1)),factor=op.disclosureMultiplier||1;
      if(op.type==="boundary"){
        if(!(op.factor>=0&&op.factor<=1))bad("Boundary factor must be in [0,1].");
        const es=(op.connectionIds||[]).map(x=>getEdge(s,x)).sort(byId);if(!es.length)bad("Boundary must select a connection.");
        for(const e of es){e.boundaryFactor=op.factor;e.boundaryOwner=a.id;e.boundaryInstanceId=id;}
        record(s,{kind:"operator",actor:a.id,operator:"Boundary",instanceId:id,connections:es.map(e=>e.id),factor:op.factor,
          explanation:"Boundary set "+es.length+" connection(s) to factor "+op.factor+"; alternate open routes remain available."});
      } else if(op.type==="porosity"){
        if(!(op.multiplier>=0&&Number.isFinite(op.multiplier)))bad("Porosity multiplier must be finite and nonnegative.");
        const es=(op.connectionIds||[]).map(x=>getEdge(s,x)).sort(byId);if(!es.length)bad("Porosity must select a connection.");
        for(const e of es)e.permeabilityModifiers.push({id,owner:a.id,multiplier:op.multiplier});
        record(s,{kind:"operator",actor:a.id,operator:"Porosity",instanceId:id,connections:es.map(e=>e.id),multiplier:op.multiplier,
          explanation:"Porosity multiplied eligible permeability; a perfect seal remains sealed."});
      } else if(op.type==="diffusion"){
        const mult=op.multiplier*factor;if(!(mult>=0&&Number.isFinite(mult)))bad("Invalid diffusion multiplier.");
        const add=op.addCoefficient||0;if(!(add>=0&&Number.isFinite(add)))bad("Invalid diffusion addition.");
        const es=op.connectionIds?(op.connectionIds).map(x=>getEdge(s,x)):s.connections;if(!es.length)bad("Diffusion needs eligible connections.");
        for(const e of es){e.diffusionModifiers.push({id,owner:a.id,multiplier:mult});e.diffusionAddition=(e.diffusionAddition||0)+add*factor;}
        record(s,{kind:"operator",actor:a.id,operator:"Diffusion",instanceId:id,multiplier:mult,addCoefficient:add*factor,connections:es.map(e=>e.id).sort(),
          explanation:"Diffusion coefficient multiplied by "+mult+" and increased by "+(add*factor)+"; quantity moves only through open connections."});
      } else if(op.type==="concentration"){
        if(!s.cells[op.targetCell])bad("Concentration needs a valid destination.");
        let left=op.amount*factor;if(!(left>=0&&Number.isFinite(left)))bad("Invalid concentration amount.");
        const sources=(op.sourceCells||Object.keys(s.cells)).filter(x=>x!==op.targetCell&&s.cells[x]&&route(s,x,op.targetCell))
          .sort((x,y)=>concentration(s,x)-concentration(s,y)||x.localeCompare(y)),plan=[];
        for(const from of sources){const amount=Math.min(left,s.cells[from].q);if(amount>0){plan.push({from,amount,path:route(s,from,op.targetCell)});left-=amount;}if(left<=EPS)break;}
        if(left>EPS)bad("Concentration has insufficient accessible source quantity.");
        for(const p of plan)moveField(s,p.from,op.targetCell,p.amount,"Concentration route "+p.path.cells.join(" → "));
        record(s,{kind:"operator",actor:a.id,operator:"Concentration",instanceId:id,targetCell:op.targetCell,plan,
          explanation:"Concentration redistributed "+(op.amount*factor)+" units from accessible sources."});
      } else if(op.type==="storage"){
        const amount=op.amount*factor,cell=op.sourceCell||a.cellId,cap=a.storeCapacity==null?Infinity:a.storeCapacity-a.store;
        if(!(amount>=0&&Number.isFinite(amount)))bad("Invalid storage amount.");
        const accepted=Math.min(amount,cap);if(accepted<=0)bad("Storage is full or no quantity was requested.");
        if(!route(s,cell,a.cellId))bad("Storage intake has no eligible route.");
          if(s.cells[cell].q<accepted)bad("Storage source has insufficient field quantity.");
        s.cells[cell].q-=accepted;s.cells[cell].concentration=s.cells[cell].q/s.cells[cell].volume;a.store+=accepted;
        record(s,{kind:"operator",actor:a.id,operator:"Storage",instanceId:id,sourceCell:cell,amount:accepted,store:a.store,
          explanation:"Storage removed "+accepted+" units from "+cell+" and added the same amount to the character reservoir."});
      } else if(op.type==="release"){
        if(!s.cells[op.targetCell])bad("Release needs a valid destination.");
        if(!route(s,a.cellId,op.targetCell))bad("Release has no eligible route to destination.");
        const amount=op.amount*factor;if(!(amount>=0&&Number.isFinite(amount)))bad("Invalid release amount.");
        if(a.store+EPS<amount)bad("Release exceeds stored quantity.");
        a.store-=amount;s.cells[op.targetCell].q+=amount;s.cells[op.targetCell].concentration=s.cells[op.targetCell].q/s.cells[op.targetCell].volume;
        record(s,{kind:"operator",actor:a.id,operator:"Release",instanceId:id,targetCell:op.targetCell,amount,
          explanation:"Release moved "+amount+" stored units; potency cannot create reservoir quantity."});
      } else if(op.type==="gradient"){
        const path=route(s,op.sourceCell,op.targetCell);if(!path)bad("Gradient cannot cross disconnected topology.");
        const amount=op.amount*factor;if(s.cells[op.sourceCell].q<amount)bad("Gradient cannot create quantity; source is insufficient.");
        moveField(s,op.sourceCell,op.targetCell,amount,"Gradient path "+path.cells.join(" → "));
        if(op.duration>0)s.effects.push({id,owner:a.id,type:"gradient-maintenance",sourceCell:op.sourceCell,targetCell:op.targetCell,amount,expiresAtRound:s.round+op.duration});
        record(s,{kind:"operator",actor:a.id,operator:"Gradient",instanceId:id,sourceCell:op.sourceCell,targetCell:op.targetCell,amount,
          explanation:"Gradient created a concentration difference by redistributing "+amount+" units."});
      } else if(op.type==="threshold"){
        if(!new Set(["concentration","reservoir","regionalQuantity"]).has(op.observable))bad("Unsupported threshold observable.");
        if(!new Set([">=","<=",">","<"]).has(op.comparator)||!Number.isFinite(op.value))bad("Invalid threshold comparison.");
        if(!op.trigger||!new Set(["turnStart","simulation","turnEnd"]).has(op.trigger.phase))bad("Unsupported threshold phase.");
        if(!op.operation||!OPS.has(op.operation.type)||op.operation.type==="threshold")bad("Threshold needs a non-threshold typed operation.");
        s.effects.push({id,owner:a.id,type:"threshold",observable:op.observable,cellId:op.cellId||null,cellIds:(op.cellIds||[]).slice().sort(),
          comparator:op.comparator,value:op.value,trigger:clone(op.trigger),once:op.once!==false,fired:false,cooldown:op.cooldown||0,
          lastFiredRound:null,operation:clone(op.operation)});
        record(s,{kind:"operator",actor:a.id,operator:"Threshold",instanceId:id,observable:op.observable,
          explanation:"Threshold armed: "+op.observable+" "+op.comparator+" "+op.value+" at "+op.trigger.phase+"."});
      }
      validate(s);return {ok:true,state:s};
    } catch(e){return {ok:false,error:e.message,state};}
  }
  function executeComposition(state,ops) {
    if(!Array.isArray(ops)||!ops.length)return {ok:false,error:"Composition needs operations.",state};
    let s=clone(state);
    for(let i=0;i<ops.length;i++){const r=applyOperator(s,ops[i]);if(!r.ok)return {ok:false,error:"Pipeline step "+(i+1)+" ("+ops[i].type+"): "+r.error,state};s=r.state;}
    record(s,{kind:"composition",order:ops.map(x=>x.type),explanation:"Ordered pipeline: "+ops.map(x=>x.type).join(" → ")+"."});
    return {ok:true,state:s};
  }
  function evaluateThresholds(state,phase) {
    let s=clone(state);const fired=[];
    for(const e of s.effects.slice().sort(byId)){
      if(e.type!=="threshold"||e.trigger.phase!==phase||(e.once&&e.fired))continue;
      if(e.lastFiredRound!=null&&s.round-e.lastFiredRound<=e.cooldown)continue;
      const observed=e.observable==="concentration"?concentration(s,e.cellId):e.observable==="reservoir"?getActor(s,e.owner).store:
        e.cellIds.reduce((n,id)=>n+(s.cells[id]?s.cells[id].q:0),0);
      const hit=e.comparator===">="?observed>=e.value:e.comparator==="<="?observed<=e.value:e.comparator===">"?observed>e.value:observed<e.value;
      record(s,{kind:"threshold-check",effectId:e.id,observable:e.observable,observed,comparator:e.comparator,value:e.value,satisfied:hit,phase,
        explanation:e.observable+" measured "+observed+"; requires "+e.comparator+" "+e.value+", "+(hit?"met":"not met")+" at "+phase+"."});
      if(!hit)continue;
      const r=applyOperator(s,{...clone(e.operation),actor:e.owner,instanceId:e.id+":trigger:"+s.round});
      if(!r.ok){record(s,{kind:"threshold-failed",effectId:e.id,reason:r.error});continue;}
      s=r.state;const live=s.effects.find(x=>x.id===e.id);if(live){live.fired=true;live.lastFiredRound=s.round;}fired.push(e.id);
    }
    return {state:s,fired};
  }
  function advanceTurn(state,{nextActor,maxPFRegen=3,hazard=null,exposureMode="instant"}={}) {
    let s=clone(state);s.round=(s.round||0)+1;s.turn=nextActor||s.turn;s.phase="turnStart";
    s.effects=s.effects.filter(e=>!(e.expiresAtRound!=null&&e.expiresAtRound<=s.round));
    const a=s.characters[s.turn];if(a){const before=a.pf;a.pf=Math.min(a.maxPF,a.pf+maxPFRegen);record(s,{kind:"resource",actor:a.id,resource:"ΦF",amount:a.pf-before});}
    if(hazard){
      if(exposureMode!=="instant")bad("v0.1 samples hazards instantaneously after transport.");
      s=advanceTransport(s,s.simulationInterval);
      for(const c of Object.values(s.cells).sort(byId)){
        const amount=Math.max(0,(concentration(s,c.id)-hazard.safeThreshold)*hazard.exposureScale*s.simulationInterval);
        for(const ch of Object.values(s.characters).filter(x=>x.cellId===c.id).sort(byId))if(amount>0){const before=ch.lf;ch.lf=Math.max(0,ch.lf-amount);
          record(s,{kind:"hazard",actor:ch.id,cellId:c.id,damage:before-ch.lf,concentration:concentration(s,c.id),
            explanation:"Post-transport instantaneous sample using the configured safe threshold and exposure scale."});}
      }
    }
    for(const phase of ["turnStart","simulation","turnEnd"]){s.phase=phase;const r=evaluateThresholds(s,phase);s=r.state;}
    for(const ch of Object.values(s.characters))if(!ch.lf)ch.defeated=true;
    const live=Object.values(s.characters).filter(x=>!x.defeated),sides=new Set(live.map(x=>x.side));
    s.outcome=sides.size<=1?{winner:live.length?live[0].side:"none"}:null;s.phase=s.outcome?"over":"action";
    record(s,{kind:"phase",phase:s.phase,order:["resetReaction","turnStart","expiry","regeneration","action","simulation","threshold","turnEnd","defeat"]});
    return s;
  }
  function conservationReport(s) {
    const total=totalQuantity(s),expected=s.ledger.initialTotal+s.ledger.sources-s.ledger.sinks;
    return {total,expected,delta:total-expected,conserved:Math.abs(total-expected)<=1e-9*Math.max(1,Math.abs(expected))};
  }
  function externalSource(state,cellId,amount,reason="authored source"){
    const s=clone(state);if(!s.cells[cellId])bad("Unknown source cell "+cellId);
    if(!(amount>=0)||!Number.isFinite(amount))bad("Source amount must be finite and nonnegative.");
    if(s.cells[cellId].capacity!=null&&s.cells[cellId].q+amount>s.cells[cellId].capacity)bad("Source would exceed cell capacity.");
    s.cells[cellId].q+=amount;s.cells[cellId].concentration=s.cells[cellId].q/s.cells[cellId].volume;
    s.ledger.sources+=amount;record(s,{kind:"ledger-source",cellId,amount,reason});return s;
  }
  function externalSink(state,cellId,amount,reason="authored sink"){
    const s=clone(state);if(!s.cells[cellId])bad("Unknown sink cell "+cellId);
    if(!(amount>=0)||!Number.isFinite(amount))bad("Sink amount must be finite and nonnegative.");
    if(s.cells[cellId].q<amount)bad("Sink exceeds available field quantity.");
    s.cells[cellId].q-=amount;s.cells[cellId].concentration=s.cells[cellId].q/s.cells[cellId].volume;
    s.ledger.sinks+=amount;record(s,{kind:"ledger-sink",cellId,amount,reason});return s;
  }
  function replay(initial,actions){
    let s=clone(initial);
    for(let i=0;i<actions.length;i++){
      const a=actions[i];let next;
      if(a.type==="operator"){
        const r=applyOperator(s,a.operator);if(!r.ok)bad("Replay action "+i+": "+r.error);next=r.state;
      }else if(a.type==="transport")next=advanceTransport(s,a.interval);
      else if(a.type==="source")next=externalSource(s,a.cellId,a.amount,a.reason);
      else if(a.type==="sink")next=externalSink(s,a.cellId,a.amount,a.reason);
      else bad("Unknown replay action "+a.type);
      s=next;
    }
    return s;
  }
  function metric(s,m){
    if(m.type==="regionalQuantity")return m.cellIds.reduce((n,id)=>n+(s.cells[id]?s.cells[id].q:0),0);
    if(m.type==="reservoir")return getActor(s,m.characterId).store;
    if(m.type==="concentration")return concentration(s,m.cellId);
    if(m.type==="peakConcentration")return Math.max(...m.cellIds.map(id=>concentration(s,id)));
    if(m.type==="totalQuantity")return totalQuantity(s);
    bad("Unsupported comparison metric "+m.type);
  }
  // Scenario-backed, local counterfactual. A label is assigned only when the
  // caller supplies an explicit classification threshold; edges are never inferred.
  function observeScenario({id,view,sourceOperator,targetOperator,initial,without=[],with:withActions=[],measurement,classification=null,preconditions=[]}){
    if(!new Set(["composition","opposition"]).has(view))bad("Observation view must be composition or opposition.");
    const base=replay(initial,without),test=replay(initial,withActions),before=metric(base,measurement),after=metric(test,measurement),delta=after-before;
    let label="measured-change";
    if(classification){
      if(!(classification.negatesAt!=null||classification.enhancesAt!=null))bad("Classification needs explicit evidence thresholds.");
      if(classification.negatesAt!=null&&delta<=classification.negatesAt)label="negates";
      else if(classification.enhancesAt!=null&&delta>=classification.enhancesAt)label="enhances";
    }
    return {id,view,sourceOperator,targetOperator,measurement:{...measurement,before,after,delta},label,
      preconditions:preconditions.slice(),evidence:{withoutReplay:JSON.stringify(without),withReplay:JSON.stringify(withActions)},
      statement:"In scenario "+id+", the measured "+measurement.type+" changed by "+delta+" ("+before+" → "+after+"); this is local evidence, not a universal rule."};
  }
  return {create,validate,concentration,effectivePermeability,effectiveDiffusion,totalQuantity,stabilityStep,
    transportSubstep,advanceTransport,route,applyOperator,executeComposition,evaluateThresholds,advanceTurn,conservationReport,
    externalSource,externalSink,replay,observeScenario,
    operators:[...OPS].sort()};
});
