"use strict";
// Noncombatant identity, photography, route planning and idempotent postcard receipts.
(function(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ConceptCombatTourist = factory();
})(typeof self !== "undefined" ? self : this, function() {
  const is = a => a?.category === "bystander" || a?.character === "tourist";
  const active = a => a && !a.defeated && !a.escaped && a.lf > 0;
  const same = (a,b) => a[0] === b[0] && a[1] === b[1];
  const position = a => [a.x,a.y];
  const distance = (a,b) => Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
  const allowed = new Set(["move","end","stall","respond","touristPhoto","touristExit","touristDepart"]);
  function enforce(s) {
    for (const a of Object.values(s.actors)) if (is(a)) {
      a.category = "bystander"; a.side = "bystander"; a.ai = "tourist";
      a.primary = null; a.secondary = null; a.reserve = []; a.aiAbilities = [];
      delete a.pendingOrder; delete a.forceTarget;
    }
  }
  function subjects(s,h={}) {
    return [
      ...Object.values(s.actors).filter(a => active(a) && !is(a)).map(a => ({id:`actor:${a.id}`,name:a.name,kind:a.monster||a.beast?"animal":"person",sprite:a.sprite,x:a.x,y:a.y})),
      ...(s.wild||[]).filter(a=>a.form==="unit"&&a.lf>0).map(a=>({id:`wild:${a.id}`,name:a.name||a.kind,kind:"animal",sprite:a.sprite||a.kind,x:a.x,y:a.y})),
      ...(s.arena.objects||[]).filter(o=>(o.kind==="plant"||o.material==="plant")&&(o.hp==null||o.hp>0)).map(o=>({id:`plant:${o.id||`${o.x},${o.y}:${o.type}`}`,name:o.name||o.species||h.plantInfo?.(o)?.name||o.type||"Plant",kind:"plant",sprite:o.sprite,thumbnail:h.plantInfo?.(o)?.thumbnail,x:o.x,y:o.y}))
    ];
  }
  function threats(s) {
    return [...Object.values(s.actors).filter(a=>active(a)&&!is(a)&&a.side!=="player"),...(s.wild||[]).filter(a=>a.form==="unit"&&a.lf>0)];
  }
  function safe(s, at) { return threats(s).every(t=>distance(at,position(t))>=3); }
  const isSasquatch = p => p.sprite === "sasquatch";   // wild or tamed, it photographs as itself
  function photoOptions(s,a,h) {
    if (!active(a)||a.tourist.fleeing) return [];
    const taken = new Set(a.tourist.photos.map(p=>p.id));
    // The shot he wants more than anything is a Sasquatch: it jumps the queue, safety rules unchanged.
    return subjects(s,h).filter(p=>!taken.has(p.id)&&distance(position(a),position(p))>=3&&distance(position(a),position(p))<=6&&safe(s,position(a))&&h.hasSight(s,a.x,a.y,p.x,p.y)&&h.dreamSame(s,a.x,a.y,p.x,p.y))
      .sort((x,y)=>(isSasquatch(y)?1:0)-(isSasquatch(x)?1:0));
  }
  function route(s,a,h,at=a.tourist.exit) { return h.paths(s,a.x,a.y,999,"move").pathTo(...at); }
  function exitsUsable(s,h) {
    // Occupants can move; structural edits must leave the assigned exit reachable.
    const view={...s,dreamSpace:null,actors:Object.fromEntries(Object.entries(s.actors).map(([id,a])=>[id,is(a)?a:{...a,defeated:true}])),wild:[]};
    return Object.values(s.actors).filter(a=>is(a)&&active(a)).every(a=>!h.tileAt(s,...a.tourist.exit).blocksMove&&route(view,a,h));
  }
  function topologyChanged(before,after) {
    if(!Object.values(before.actors).some(a=>is(a)&&active(a)))return false;
    const shape=s=>JSON.stringify([s.arena.map,s.arena.height,s.barriers.map(b=>[b.x,b.y,b.passable]),s.arena.objects.map(o=>[o.x,o.y,o.blocksMove])]);
    return shape(before)!==shape(after);
  }
  function exitCandidates(s) {
    const out=[];
    for(let y=0;y<s.arena.h;y++) for(let x=0;x<s.arena.w;x++) if(x===0||y===0||x===s.arena.w-1||y===s.arena.h-1) out.push([x,y]);
    return out;
  }
  function spawn(s,h,{at=null,id="tourist"}={}) {
    if(s.actors[id]||Object.values(s.actors).some(is))return null;
    const open = p => !h.tileAt(s,...p).blocksMove&&!h.actorAt(s,...p)&&!h.barrierAt(s,...p)&&!(s.wild||[]).some(w=>w.form==="unit"&&same(position(w),p));
    const points=[];
    for(let y=0;y<s.arena.h;y++)for(let x=0;x<s.arena.w;x++)points.push([x,y]);
    const candidates = at?[at]:points.filter(p=>safe(s,p)).sort((a,b)=>distance(a,position(s.actors.player))-distance(b,position(s.actors.player)));
    for(const p of candidates) {
      if(!open(p))continue;
      const reachable=h.paths(s,...p,999,"move");
      const exits=exitCandidates(s).filter(e=>open(e)&&!same(e,p)&&reachable.pathTo(...e));
      exits.sort((a,b)=>reachable.dist.get(a.join(","))-reachable.dist.get(b.join(",")));
      if(!exits.length)continue;
      const a={id,character:"tourist",name:"The Tourist",category:"bystander",side:"bystander",sprite:"tourist",ai:"tourist",controller:"ai",x:p[0],y:p[1],
        maxLF:40,lf:40,maxPF:s.rules.maxPF,pf:s.rules.maxPF,ultimateCharge:0,primary:null,secondary:null,reserve:[],reserveSlots:0,lens:{},level:1,proficiency:1,
        traits:["curious","pacifist","hiker","skittish"],passives:{},status:{},inventory:[],inventoryCapacity:0,reaction:0,ownerTurns:0,
        tempo:0,tempoCapacity:80,bankedTempo:0,tempoDebt:0,tempoSpent:0,actionsThisTurn:0,defeated:false,abilities:[],aiAbilities:[],
        tourist:{exit:exits[0],photos:[],fleeing:false,receipt:null}};
      s.actors[id]=a;s.order.push(id);s.disclosures[id]={};s.knowledge[id]={};s.observedAbilities[id]=[];
      for(const other of Object.keys(s.actors)) (s.knowledge[other] ||= {})[id]={secondary:true,lens:true,abilities:{}};
      h.log(s,{kind:"tourist",actor:id,tiles:[p,exits[0]],text:`The Tourist arrives with a camera. His exit is (${exits[0].join(", ")}).`});
      return a;
    }
    return null;
  }
  function hurt(s,a,amount,h) {
    if(!is(a)||amount<=0||a.tourist.fleeing)return;
    a.tourist.fleeing=true;
    h.log(s,{kind:"tourist",actor:a.id,text:"The Tourist puts his camera away and makes for his exit."});
  }
  function quality(n) { return n>=10?"Collector’s keepsake":n>=6?"Panoramic":n>=3?"Field collage":n>=1?"Snapshot":"A simple note"; }
  function reward(s,a,reason,h) {
    if(a.tourist.receipt||a.lf<=0)return null;
    if(reason!=="escape"&&!(s.outcome?.winner==="player"&&active(a)))return null;
    const photos=JSON.parse(JSON.stringify(a.tourist.photos)),n=photos.length;
    const message=n===0?"I didn’t get a clear picture, but I made it home. Thanks for looking out for me.":reason==="escape"?"I got the pictures and made it out! I’ll send you a postcard from the trip.":"We made it! Thanks for keeping me safe. Here’s what I managed to photograph.";
    const card={id:`${s.receiptId||`${s.encounter}:${s.seed}`}:${a.id}`,tourist:a.id,location:s.arena.name,photoCount:n,photos,quality:quality(n),message,reason};
    a.tourist.receipt=card.id;(s.postcards ||= []).push(card);
    h.log(s,{kind:"postcard",actor:a.id,postcard:card,text:message});return card;
  }
  function settle(s,h) {
    enforce(s);
    for(const a of Object.values(s.actors).filter(is)) {
      if(a.lf<a.maxLF)hurt(s,a,1,h);
      if(s.outcome?.winner==="player")reward(s,a,"victory",h);
    }
  }
  function photo(s,a,act,h) {
    if(!is(a))return "Only the Tourist takes souvenir photos.";
    const p=photoOptions(s,a,h).find(p=>p.id===act.subject);
    if(!p)return "No safe, new subject in camera range with a clear view.";
    if(a.tempo<25)return "Photography needs 25 AP.";
    a.tempo-=25;a.tempoSpent+=25;a.actionsThisTurn++;
    a.tourist.photos.push({...p,round:s.round});
    h.log(s,{kind:"touristPhoto",actor:a.id,target:p.id,tiles:[[p.x,p.y]],text:`The Tourist photographs ${p.name} (${a.tourist.photos.length} photos).${isSasquatch(p)?" The shot he's waited his whole life for.":""}`});
  }
  function exit(s,a,_act,h) {
    if(!is(a)||!same(position(a),a.tourist.exit))return "The Tourist must reach his assigned exit.";
    reward(s,a,"escape",h);a.escaped=true;a.defeated=true;a.leaveReason="left with his photographs";a.tempo=0;
    h.log(s,{kind:"tourist",actor:a.id,text:"The Tourist leaves the battlefield alive."});
  }
  function decide(s,a,h) {
    if(s.phase==="response")return {type:"respond",actor:a.id,response:"none"};
    const end={type:"end",actor:a.id};if(!active(a))return end;
    if(a.tourist.fleeing&&same(position(a),a.tourist.exit))return {type:"touristExit",actor:a.id};
    const photos=photoOptions(s,a,h);if(photos.length&&a.tempo>=25)return {type:"touristPhoto",actor:a.id,subject:photos[0].id};
    const moves=h.moveOptions(s,a.id).filter(m=>m.tempoCost<=a.tempo);
    if(!a.tourist.fleeing&&!safe(s,position(a))) {
      const clearance=p=>Math.min(...threats(s).map(t=>distance(p,position(t))));
      const current=clearance(position(a));
      const retreats=moves.filter(m=>clearance(m.to)>current&&m.path.slice(1).every(p=>clearance(p)>=current)).sort((a,b)=>clearance(b.to)-clearance(a.to)||a.tempoCost-b.tempoCost);
      return retreats.length?{type:"move",actor:a.id,to:retreats[0].to}:end;
    }
    let goal=a.tourist.exit;
    if(!a.tourist.fleeing) {
      const taken=new Set(a.tourist.photos.map(p=>p.id)),todo=subjects(s,h).filter(p=>!taken.has(p.id));
      const angles=[], reachable=h.paths(s,a.x,a.y,999,"move");
      for(let y=0;y<s.arena.h;y++)for(let x=0;x<s.arena.w;x++) {
        const at=[x,y];if(!safe(s,at))continue;
        const inFrame=p=>distance(at,position(p))>=3&&distance(at,position(p))<=6&&h.hasSight(s,x,y,p.x,p.y)&&h.dreamSame(s,x,y,p.x,p.y);
        const p=todo.find(inFrame);
        const path=p&&reachable.pathTo(x,y);if(path)angles.push({at,len:path.length,sas:todo.some(q=>q.sprite==="sasquatch"&&inFrame(q))});
      }
      angles.sort((a,b)=>(b.sas?1:0)-(a.sas?1:0)||a.len-b.len);
      if(angles.length)goal=angles[0].at;
      else return {type:"touristDepart",actor:a.id};
    }
    if(a.tourist.fleeing&&same(position(a),goal))return {type:"touristExit",actor:a.id};
    const path=route(s,a,h,goal);if(!path)return end;
    const along=moves.filter(m=>(a.tourist.fleeing||m.path.every(p=>safe(s,p)))&&path.some(p=>same(p,m.to))).sort((a,b)=>path.findIndex(p=>same(p,b.to))-path.findIndex(p=>same(p,a.to)));
    return along.length?{type:"move",actor:a.id,to:along[0].to}:end;
  }
  function depart(s,a) { if(!is(a))return "Only the Tourist uses this departure.";a.tourist.fleeing=true; }
  return {is,active,allowed,enforce,subjects,photoOptions,spawn,hurt,quality,reward,settle,photo,exit,depart,decide,route,exitsUsable,topologyChanged};
});
