/* Class posture hooks: authored, data-driven, and deliberately narrow. */
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory();
  else root.ConceptCombatPostures=factory();
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  const postures={
    gardenerSwale:{id:"post-gardener-swale",character:"gardener",concept:"swale",event:"swaleAbsorbed",effect:"mulchPreview",limit:"one adjacent empty soil tile; never adds damage"},
    arboristTree:{id:"post-arborist-tree",character:"arborist",concept:"barrier",event:"wallPlaced",effect:"treeBrace",limit:"only a wall sharing an edge with a tree or TPZ"},
    actorAudience:{id:"post-actor-audience",character:"actor",concept:"deception",event:"techniqueResolved",effect:"audience",limit:"up to two additional visible enemies; disabled by Many Faces"},
    soldierBehind:{id:"post-soldier-anchor",character:"soldier",concept:"inertia",event:"anchorResolved",effect:"coverBehind",limit:"one ally on the tile directly behind; damage still resolves"},
    gardenerPrune:{id:"post-gardener-prune",character:"gardener",concept:"pruning",event:"pruneResolved",effect:"cultivate",limit:"no trees or TPZ; mulch stays on cut tile and one adjacent soil tile gets a one-use mark"},
    arboristPrune:{id:"post-arborist-prune",character:"arborist",concept:"pruning",event:"pruneResolved",effect:"structure",limit:"one eligible hazard; tree brace dampens the next adjacent line once"},
  };
  function resolve({character,concept,ability,event,eligible=[],manyFaces=false}={}){
    const p=Object.values(postures).find(x=>x.character===character&&x.concept===concept&&x.event===event);
    if(!p)return null;
    if(p.effect==="mulchPreview") { const tile=eligible.find(t=>t.soil&&t.empty&&t.value!=="m"); return tile?{id:p.id,effect:p.effect,tile:[tile.x,tile.y],log:"The Gardener’s swale leaves mulch on one adjacent soil tile; the basin still absorbs only one line."}:null; }
    if(p.effect==="treeBrace") { const tree=eligible.find(t=>t.tree||t.tpz); return tree?{id:p.id,effect:p.effect,tile:[tree.x,tree.y],log:"The Arborist braces the shared tree edge for this wall’s duration."}:null; }
    if(p.effect==="audience") { if(manyFaces)return null; const recipients=eligible.filter(t=>t.visible&&t.id).slice(0,2).map(t=>t.id); return recipients.length?{id:p.id,effect:p.effect,recipients,tempo:8,log:`The Actor’s performance reaches ${recipients.length} additional visible opponent${recipients.length===1?"":"s"}; each can spend a reaction to look away.`}:null; }
    if(p.effect==="coverBehind") { const ally=eligible.find(t=>t.ally&&t.behind); return ally?{id:p.id,effect:p.effect,target:ally.id,log:`Anchor also covers ${ally.name||"the ally"} directly behind the Soldier; damage still lands.`}:null; }
    if(p.effect==="cultivate") { const part=eligible.find(t=>t.valid); return part?{id:p.id,effect:p.effect,part:part.part,tile:part.tile,mark:part.mark,log:"The Gardener's cut leaves temporary mulch and a one-use growth mark on adjacent soil."}:null; }
    if(p.effect==="structure") { const part=eligible.find(t=>t.valid); return part?{id:p.id,effect:p.effect,part:part.part,tile:part.tile,tree:part.tree,log:part.tree?"The Arborist clears the tree hazard and braces its shared edge against the next line hit.":"The Arborist clears one eligible thorn or rubble hazard."}:null; }
    return null;
  }
  return {postures,resolve};
});
