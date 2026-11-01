/* Data-only first field substrate. Names explain typed mechanisms; engine
 * behavior is selected by operator type, never by concept-vs-concept pairing. */
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory();
  else root.EmergentCombatContent=factory();
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  const concepts={
    boundary:{name:"Boundary",operator:"boundary",input:"connection-set",output:"permeability-field",scope:"selected connections",limit:"alternate open routes remain available"},
    porosity:{name:"Porosity",operator:"porosity",input:"eligible-connections",output:"permeability-modifier",scope:"multiplies permeability",limit:"multiplication cannot reopen a perfect seal"},
    diffusion:{name:"Diffusion",operator:"diffusion",input:"quantity-gradient",output:"passive-flux",scope:"connected open region",limit:"redistributes; it creates no quantity"},
    concentration:{name:"Concentration",operator:"concentration",input:"accessible-field-quantity",output:"redistributed-field",scope:"reachable destination",limit:"requires enough quantity along open routes"},
    storage:{name:"Storage",operator:"storage",input:"accessible-field-quantity",output:"finite-reservoir",scope:"character intake route",limit:"capacity and field availability bound intake"},
    release:{name:"Release",operator:"release",input:"finite-reservoir",output:"field-quantity",scope:"reachable target cell",limit:"cannot exceed stored quantity"},
    gradient:{name:"Gradient",operator:"gradient",input:"source-quantity",output:"concentration-difference",scope:"connected source and destination",limit:"difference is made by moving quantity"},
    threshold:{name:"Threshold",operator:"threshold",input:"observable",output:"scheduled-typed-operation",scope:"declared event phase",limit:"requires one-shot or cooldown/hysteresis"},
  };
  const defaultRules={maxLF:100,maxPF:30,pfRegen:3,simulationInterval:1,safetyFactor:0.9,
    diffusion:0.2,hazard:{safeThreshold:0.7,exposureScale:1,exposureMode:"instant"},rounding:"round",
    disclosureMultiplier:1.15,announceMultiplier:1.4,reactionsPerRound:1};
  const arena={name:"The Channel",units:"abstract field units",cells:[
    {id:"a",x:0,y:0,q:16,volume:2},{id:"b",x:1,y:0,q:0,volume:2},{id:"c",x:2,y:0,q:0,volume:2},
    {id:"d",x:1,y:1,q:0,volume:2},{id:"e",x:2,y:1,q:0,volume:2}],
    connections:[
      {id:"ab",a:"a",b:"b",conductance:1,basePermeability:1},{id:"bc",a:"b",b:"c",conductance:1,basePermeability:1},
      {id:"bd",a:"b",b:"d",conductance:1,basePermeability:1},{id:"de",a:"d",b:"e",conductance:1,basePermeability:1},
      {id:"ec",a:"e",b:"c",conductance:1,basePermeability:1}],
    characters:[
      {id:"warden",name:"Warden",side:"player",cellId:"e",lf:100,maxLF:100,pf:30,maxPF:30,store:0,storeCapacity:12,
        level:1,xp:0,primary:"boundary",secondary:"storage",reserve:["release"],reaction:1},
      {id:"pathfinder",name:"Pathfinder",side:"enemy",cellId:"c",lf:55,maxLF:55,pf:30,maxPF:30,store:0,storeCapacity:10,
        level:1,xp:0,primary:"diffusion",secondary:"porosity",reserve:["concentration"],reaction:1},
      {id:"sieve",name:"Sieve",side:"enemy",cellId:"d",lf:55,maxLF:55,pf:30,maxPF:30,store:0,storeCapacity:10,
        level:1,xp:0,primary:"concentration",secondary:"threshold",reserve:["gradient"],reaction:1}],
    initiative:["warden","pathfinder","sieve"]};
  const progression={reserveSlotsByLevel:[{level:1,slots:1},{level:3,slots:2},{level:6,slots:3},{level:10,slots:5}],
    xpPerLevel:100,lensProficiencyByLevel:[{level:1,proficiency:1},{level:3,proficiency:2},{level:6,proficiency:3}]};
  return {concepts,rules:defaultRules,arena,progression};
});
