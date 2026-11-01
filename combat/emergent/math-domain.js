/* Source-aware math domain for the first playable lesson. Relationships here
 * describe definitions, graph structure, or the scope of a cited theorem. They
 * are learning data; the combat kernel never dispatches effects from these edges. */
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory();
  else root.EmergentMathDomain=factory();
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  const source={
    repository:"https://github.com/openai/math",
    commit:"fd4aeeb2ee4fc729c18d98444fed42fd0529eeeb",
    capturedAt:"2026-10-07",
    family:"181",
    familyTitle:"The Erdős–Gallai cycle-decomposition conjecture",
    manuscript:"A linear cycle-and-edge decomposition of every graph",
    leanScope:"lean/docs/181.md",
    formalization:"lean/OAI/Combinatorics/CycleDecomposition/Main.lean",
    declaration:"OAI.ErdosGallai.erdos_gallai",
    status:"lean-scope-documented",
    note:"The pinned repository documents this theorem's Lean formalization scope. This game lesson is an illustration, not an independent check of the proof build."
  };
  const concepts={
    graph:{name:"Graph",definition:"A graph is a pair G = (V, E): vertices V and edges E describing which pairs are connected.",level:"foundation"},
    path:{name:"Path",definition:"A path is a sequence of vertices joined by consecutive edges. Reachability asks whether at least one path exists.",level:"foundation"},
    connectivity:{name:"Connectivity",definition:"Two vertices are connected when at least one path joins them.",level:"foundation"},
    edgeRemoval:{name:"Edge removal",definition:"Removing an edge makes it unavailable to paths and to transport in this arena.",level:"core"},
    graphEdge:{name:"Graph edge",definition:"An available arena connection; its conductance and permeability set how much passive transport it permits.",level:"foundation"},
    availablePath:{name:"Available path",definition:"A route made only of connections with positive effective permeability.",level:"core"},
    fieldTransport:{name:"Field transport",definition:"The arena's solver moves quantity along available connections; it does not teleport quantity across disconnected cells.",level:"core"},
    cyclePieces:{name:"Cycle and single-edge pieces",definition:"The allowed pieces in the cited edge-partition theorem.",level:"advanced",source:"family181"},
    boundary:{name:"Boundary operator",definition:"This game action sets a chosen connection's permeability; it changes the arena graph for both transport and reachability.",level:"game-mechanism"},
    cycle:{name:"Cycle",definition:"A cycle is a closed path with no repeated vertices except its start/end. It creates an alternate route around each one of its edges.",level:"core"},
    bridge:{name:"Bridge",definition:"A bridge is an edge whose removal increases the number of connected components.",level:"core"},
    cut:{name:"Edge cut",definition:"An edge cut is a set of edges whose removal disconnects vertices that were previously connected.",level:"advanced"},
    cycleDecomposition:{name:"Cycle decomposition",definition:"Partition a graph's edges into edge-disjoint simple cycles and single edges.",level:"advanced",source:"family181"},
  };
  const relations=[
    {from:"graph",type:"contains",to:"path",basis:"definition",status:"established"},
    {from:"path",type:"can-witness",to:"connectivity",basis:"definition",status:"established"},
    {from:"cycle",type:"provides-alternate-route-for",to:"edgeRemoval",basis:"definition",status:"established"},
    {from:"bridge",type:"removal-breaks",to:"connectivity",basis:"definition",status:"established"},
    {from:"cut",type:"disconnects",to:"connectivity",basis:"definition",status:"established"},
    {from:"cycleDecomposition",type:"partitions-into",to:"cyclePieces",basis:"lean-theorem-scope",status:"formalized-scope",source:"family181"},
    {from:"boundary",type:"changes-availability-of",to:"graphEdge",basis:"game-operator",status:"simulated"},
    {from:"availablePath",type:"permits",to:"fieldTransport",basis:"game-operator",status:"simulated"},
  ];
  const formalArtifacts={
    cycleDecompositionMain:{path:"OAI/Combinatorics/CycleDecomposition/Main.lean",kind:"formalized theorem file"},
    layerCosts:{path:"OAI/Combinatorics/CycleDecomposition/LayerCosts.lean",kind:"Lean module"},
    uniformLayers:{path:"OAI/Combinatorics/CycleDecomposition/UniformLayers.lean",kind:"Lean module"},
  };
  const formalDependencies=[
    {from:"cycleDecompositionMain",type:"formal-import",to:"layerCosts"},
    {from:"layerCosts",type:"formal-import",to:"uniformLayers"},
  ];
  const lessons=[
    {id:"graph",stage:"observe",title:"Read the arena as a graph",body:"Treat each cell as a vertex and each connection as an edge. Field transport can use only edges whose effective permeability is above zero.",prompt:"In the starting arena, can quantity travel from a to c?",choices:["Yes, there is a path","No, they are not adjacent"],answer:0,feedback:"Yes. Adjacency is not required: a → b → c is a path. A longer route also exists through d and e."},
    {id:"cycle",stage:"predict",title:"Use a cycle to predict a detour",body:"The edges b–c, c–e, e–d and d–b form a cycle. Closing one edge of a cycle leaves the other three as a route between its endpoints.",prompt:"If you seal b–c, can field still travel from a to c?",choices:["Yes, via b–d–e–c","No, every route uses b–c"],answer:0,feedback:"Yes. The cycle supplies the detour b → d → e → c. Try Boundary · seal b—c and advance transport to see the route's consequence."},
    {id:"bridge",stage:"derive",title:"Find the bridge and the cut",body:"The edge a–b is a bridge: it is the only connection from a to the rest of the arena. Removing it increases the component count, so no field can leave a.",prompt:"Which single edge disconnects a from all other cells when removed?",choices:["a–b","b–c"],answer:0,feedback:"a–b is a bridge. By contrast, b–c is on a cycle, so its removal leaves an alternate path."},
    {id:"decomposition",stage:"transfer",title:"From this toy graph to a theorem",body:"The arena's five edges split into one four-edge cycle and the single edge a–b. Family 181 studies the general statement: every finite simple undirected graph has an edge partition into at most Cn simple cycles and single edges, for an absolute constant C.",prompt:"Does the theorem's edge partition require every edge to belong to a cycle?",choices:["No; leftover edges may be single edges","Yes; bridges are excluded"],answer:0,feedback:"No. The theorem explicitly allows single-edge pieces, which is why bridge edges fit the decomposition too."},
  ];
  return {source,concepts,relations,formalArtifacts,formalDependencies,lessons};
});
