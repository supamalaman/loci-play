/* Deterministic authored demonstrations for the field substrate. */
(function(root,factory){
  if(typeof module==="object"&&module.exports){
    module.exports=factory(require("./engine.js"),require("./content.js"));
  } else root.EmergentCombatScenarios=factory(root.EmergentCombat,root.EmergentCombatContent);
})(typeof self!=="undefined"?self:this,function(E,C){
  "use strict";
  function initial(){
    const a=C.arena;
    return E.create({...C.rules,...a,cells:Object.fromEntries(a.cells.map(c=>[c.id,{...c}])),
      connections:a.connections.map(e=>({...e})),characters:Object.fromEntries(a.characters.map(ch=>[ch.id,{...ch}]))});
  }
  function run(id){
    let s=initial();
    if(id==="open-diffusion"){
      s=E.applyOperator(s,{actor:"pathfinder",type:"diffusion",multiplier:3,cost:4,instanceId:"diffuse-open"}).state;
      return E.advanceTransport(E.advanceTransport(s));
    }
    if(id==="sealed-path"){
      const r=E.applyOperator(s,{actor:"warden",type:"boundary",connectionIds:["ab"],factor:0,cost:4,instanceId:"seal-ab"});
      if(!r.ok)throw new Error(r.error);
      return E.advanceTransport(E.advanceTransport(r.state));
    }
    if(id==="store-threshold-release"){
      let r=E.applyOperator(s,{actor:"warden",type:"storage",sourceCell:"a",amount:6,cost:3,instanceId:"store-six"});
      if(!r.ok)throw new Error(r.error);s=r.state;
      r=E.applyOperator(s,{actor:"warden",type:"threshold",instanceId:"release-at-six",observable:"reservoir",
        comparator:">=",value:6,trigger:{phase:"turnEnd"},once:true,
        operation:{type:"release",targetCell:"c",amount:6,cost:0},cost:1});
      if(!r.ok)throw new Error(r.error);s=r.state;
      return E.evaluateThresholds(s,"turnEnd").state;
    }
    throw new Error("Unknown authored scenario "+id);
  }
  return {initial,run,ids:["open-diffusion","sealed-path","store-threshold-release"]};
});
