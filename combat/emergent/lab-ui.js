/* Small, honest sandbox for the emergent kernel: operator experiments, not yet
 * the migrated turn-based duel interface. */
(function(root){
  "use strict";
  function mount(host,{onExit=()=>{}}={}){
    const E=root.EmergentCombat,S=root.EmergentCombatScenarios,C=root.EmergentCombatContent;
    let state=S.initial(),notice="Choose an operation. Every quantity is an abstract game unit.";
    const M=root.EmergentMathDomain,masteryKey="loci:combat:math:graph-theory:v1";
    let mastery={completed:[]},mathIndex=0,mathFeedback="",mathCorrect=false,activeView="ops";
    try{mastery=Object.assign(mastery,JSON.parse(localStorage.getItem(masteryKey)||"{}"));}catch(_e){}
    if(!Array.isArray(mastery.completed))mastery.completed=[];
    mathIndex=Math.max(0,M.lessons.findIndex(l=>!mastery.completed.includes(l.id)));
    if(mathIndex<0)mathIndex=M.lessons.length-1;
    const esc=x=>String(x).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
    const fmt=n=>Number(n.toFixed(3));
    const actions=[
      ["Boundary · seal a—b (bridge)",{type:"boundary",connectionIds:["ab"],factor:0,cost:2}],
      ["Boundary · seal b—c (cycle edge)",{type:"boundary",connectionIds:["bc"],factor:0,cost:2}],
      ["Porosity · widen a—b",{type:"porosity",connectionIds:["ab"],multiplier:2,cost:2}],
      ["Diffusion · ×2",{type:"diffusion",multiplier:2,cost:3}],
      ["Concentrate · 4 to c",{type:"concentration",sourceCells:["a","b","d","e"],targetCell:"c",amount:4,cost:3}],
      ["Store · 4 from a",{type:"storage",sourceCell:"a",amount:4,cost:2}],
      ["Release · 3 to e",{type:"release",targetCell:"e",amount:3,cost:2}],
      ["Gradient · move 3 to c",{type:"gradient",sourceCell:"a",targetCell:"c",amount:3,duration:1,cost:2}],
      ["Threshold · release at 4 stored",{type:"threshold",observable:"reservoir",comparator:">=",value:4,
        trigger:{phase:"turnEnd"},once:true,operation:{type:"release",targetCell:"c",amount:4,cost:0},cost:2}],
    ];
    const css='<style>'+
      '.ef-shell{height:100%;overflow:auto;padding:20px;display:grid;grid-template-columns:minmax(360px,1.1fr) minmax(300px,.9fr);gap:16px;color:#f3eee2}'+
      '.ef-shell *{box-sizing:border-box}.ef-panel{background:#26232c;border:1px solid #3a3642;border-radius:12px;padding:16px;min-width:0}'+
      '.ef-title{font-size:19px;font-weight:800}.ef-sub{color:#b3aabd;font-size:12px;margin:3px 0 14px}.ef-board{display:grid;grid-template-columns:repeat(3,minmax(70px,1fr));grid-template-rows:repeat(2,92px);gap:8px}'+
      '.ef-cell{border:1px solid #575263;border-radius:9px;background:#34313c;padding:8px;display:flex;flex-direction:column;justify-content:space-between}'+
      '.ef-cell strong{font:700 12px ui-monospace,monospace}.ef-q{font-size:17px;font-weight:750}.ef-c{font:11px ui-monospace,monospace;color:#b3aabd}'+
      '.ef-actors,.ef-edges{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.ef-pill{border:1px solid #5b5368;border-radius:99px;padding:4px 9px;font-size:11px;color:#e8d8ad}'+
      '.ef-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.ef-actions button,.ef-tools button{background:#302d37;color:#f3eee2;border:1px solid #514b5d;border-radius:8px;padding:8px;text-align:left;cursor:pointer}'+
      '.ef-actions button:hover,.ef-tools button:hover{border-color:#e9c46a}.ef-tools{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.ef-status{min-height:42px;color:#e9c46a;font-size:13px;padding:9px;background:#1d1b22;border-radius:8px;margin:12px 0}'+
      '.ef-tabs{display:flex;gap:7px;margin:0 0 12px}.ef-tabs button,.ef-quiz button,.ef-mnav button{background:#302d37;color:#f3eee2;border:1px solid #514b5d;border-radius:8px;padding:8px 11px;cursor:pointer}.ef-tabs button.on,.ef-tabs button:hover,.ef-quiz button:hover,.ef-mnav button:hover{border-color:#e9c46a}.ef-tabs button.on{color:#e9c46a}.ef-math{font-size:13px;line-height:1.55}.ef-math h3{font-size:15px;margin:4px 0 7px}.ef-math p{margin:8px 0;color:#d8d1df}.ef-math .ef-muted{color:#aaa2b4;font-size:11px}.ef-math .ef-defs{display:grid;gap:6px;margin:10px 0}.ef-math .ef-def{border-left:2px solid #77c9a1;padding:4px 8px;background:#211f27}.ef-quiz{display:grid;gap:7px;margin:10px 0}.ef-quiz button{text-align:left}.ef-feedback{padding:9px;border-radius:8px;background:#1d1b22;color:#a6d6b5}.ef-feedback.wrong{color:#efaeaa}.ef-mnav{display:flex;justify-content:space-between;gap:8px;margin:10px 0}.ef-rels{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.ef-rel{font-size:10px;color:#d8d1df;border:1px solid #514b5d;border-radius:99px;padding:4px 7px}'+
      '.ef-log{max-height:230px;overflow:auto;font:11px/1.5 ui-monospace,monospace;color:#b3aabd}.ef-log p{margin:0;padding:6px 2px;border-bottom:1px solid #3a3642}.ef-conserve{font:12px ui-monospace,monospace;margin-top:10px;color:#a6d6b5}'+
      '@media(max-width:780px){.ef-shell{grid-template-columns:1fr;padding:12px}}'+
      '</style>';
    host.innerHTML=css+'<div class="ef-shell"><section class="ef-panel"><div class="ef-title">Emergent Field Lab</div>'+
      '<div class="ef-sub">Operator sandbox · deterministic field simulation · abstract units</div>'+
      '<div class="ef-tools"><button data-reset>Reset field</button><button data-step>Advance one simulation interval</button>'+
      '<button data-threshold>Resolve turn-end thresholds</button></div><div class="ef-board"></div>'+
      '<div class="ef-actors"></div><div class="ef-edges"></div><div class="ef-conserve"></div></section>'+
      '<section class="ef-panel"><div class="ef-tabs"><button data-view="ops" class="on">Operations</button><button data-view="math">Mathematics</button></div>'+ 
      '<div class="ef-action-view"><div class="ef-title">Choose an operation</div><div class="ef-sub">Actions spend ΦF; field quantity q is conserved separately.</div>'+ 
      '<div class="ef-actions"></div><div class="ef-status" role="status" aria-live="polite"></div></div><div class="ef-math-view" hidden></div>'+ 
      '<div class="ef-title" style="font-size:14px;margin:16px 0 6px">Causal log</div><div class="ef-log"></div>'+ 
      '<div class="ef-tools"><button data-exit>← Duels</button></div></section></div>';
    const board=host.querySelector(".ef-board"),actors=host.querySelector(".ef-actors"),edges=host.querySelector(".ef-edges");
    const log=host.querySelector(".ef-log"),status=host.querySelector(".ef-status"),conservation=host.querySelector(".ef-conserve");
    const mathPane=host.querySelector(".ef-math-view");
    host.querySelector(".ef-actions").innerHTML=actions.map((a,i)=>'<button data-op="'+i+'">'+esc(a[0])+'</button>').join("");
    function explain(e){
      if(e.explanation)return e.explanation;
      if(e.kind==="field-transfer")return e.cause+": "+fmt(e.amount)+" units from "+e.from+" to "+e.to+".";
      if(e.kind==="transport"){
        const moved=e.transfers.filter(t=>Math.abs(t.signedQuantity)>1e-9).map(t=>t.signedQuantity>0?
          fmt(t.signedQuantity)+" "+t.from+"→"+t.to:fmt(-t.signedQuantity)+" "+t.to+"→"+t.from);
        return moved.length?"Simultaneous flux: "+moved.join("; ")+".":"No concentration difference produced flux.";
      }
      if(e.kind==="threshold-check")return e.observable+" measured "+fmt(e.observed)+"; requires "+e.comparator+" "+fmt(e.value)+", "+(e.satisfied?"met":"not met")+".";
      if(e.kind==="ledger-source"||e.kind==="ledger-sink")return e.reason+": "+fmt(e.amount)+" units at "+e.cellId+".";
      return e.kind;
    }
    function draw(){
      board.innerHTML=Object.values(state.cells).sort((a,b)=>a.y-b.y||a.x-b.x).map(c=>
        '<div class="ef-cell" style="grid-column:'+(c.x+1)+';grid-row:'+(c.y+1)+'"><strong>'+esc(c.id)+' · V '+fmt(c.volume)+'</strong>'+
        '<span class="ef-q">q '+fmt(c.q)+'</span><span class="ef-c">c '+fmt(c.concentration)+'</span></div>').join("");
      actors.innerHTML=Object.values(state.characters).sort((a,b)=>a.id.localeCompare(b.id)).map(a=>
        '<span class="ef-pill">'+esc(a.name)+' · '+esc(a.cellId)+' · LF '+fmt(a.lf)+' · ΦF '+fmt(a.pf)+' · store '+fmt(a.store)+'</span>').join("");
      edges.innerHTML=state.connections.map(e=>'<span class="ef-pill">'+esc(e.id)+' · P='+fmt(E.effectivePermeability(e))+
        ' · k='+fmt(E.effectiveDiffusion(state,e)*e.conductance*E.effectivePermeability(e))+'</span>').join("");
      conservation.textContent='Conserved total: '+fmt(E.conservationReport(state).total)+' / expected '+fmt(E.conservationReport(state).expected);
      log.innerHTML=state.log.slice(-28).reverse().map(e=>{
        const msg=explain(e);
        return '<p>'+esc(e.operator||e.kind)+': '+esc(msg)+'</p>';
      }).join("");
      status.textContent=notice;
      renderMath();
    }
    function renderMath(){
      host.querySelector(".ef-action-view").hidden=activeView!=="ops";
      mathPane.hidden=activeView!=="math";
      host.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("on",b.dataset.view===activeView));
      const l=M.lessons[mathIndex], done=mastery.completed.length;
      const rels=M.relations.map(r=>'<span class="ef-rel">'+esc(r.from.replace(/[A-Z]/g," $&").trim())+' '+esc(r.type)+' '+esc(r.to.replace(/[A-Z]/g," $&").trim())+'</span>').join("");
      const proofDeps=M.formalDependencies.map(r=>'<span class="ef-rel">'+esc(M.formalArtifacts[r.from].path.split("/").at(-1))+' '+esc(r.type)+' '+esc(M.formalArtifacts[r.to].path.split("/").at(-1))+'</span>').join("");
      mathPane.innerHTML='<div class="ef-math"><div class="ef-sub">GRAPH THEORY · '+done+'/'+M.lessons.length+' checkpoints complete</div>'+ 
        '<div class="ef-mnav"><button data-prev '+(mathIndex===0?'disabled':'')+'>← Previous</button><span class="ef-muted">'+esc(l.stage.toUpperCase())+' · '+(mathIndex+1)+' / '+M.lessons.length+'</span><button data-next '+(mathIndex>=M.lessons.length-1?'disabled':'')+'>Next →</button></div>'+ 
        '<h3>'+esc(l.title)+'</h3><p>'+esc(l.body)+'</p>'+ 
        '<div class="ef-defs">'+Object.entries(M.concepts).filter(([id])=>["graph","path","cycle","bridge","connectivity","cycleDecomposition"].includes(id)).map(([id,c])=>'<div class="ef-def"><b>'+esc(c.name)+':</b> '+esc(c.definition)+'</div>').join("")+'</div>'+ 
        '<b>'+esc(l.prompt)+'</b><div class="ef-quiz">'+l.choices.map((c,i)=>'<button data-answer="'+i+'">'+esc(c)+'</button>').join("")+'</div>'+ 
        (mathFeedback?'<div class="ef-feedback '+(mathCorrect?'':'wrong')+'" role="status">'+esc(mathFeedback)+'</div>':'')+ 
        '<p class="ef-muted">Try the matching Boundary action in Operations, then advance the simulation and read the causal log. A predicted relationship earns understanding only when it matches the changed state.</p>'+ 
        '<p class="ef-muted">Source trail: Family '+esc(M.source.family)+' · '+esc(M.source.manuscript)+' · <a href="'+esc(M.source.repository+'/blob/'+M.source.commit+'/'+M.source.leanScope)+'" target="_blank">Lean scope</a> · <a href="'+esc(M.source.repository+'/blob/'+M.source.commit+'/'+M.source.formalization)+'" target="_blank">Lean file</a><br>'+esc(M.source.note)+'<br>Repository commit '+esc(M.source.commit.slice(0,12))+'</p>'+ 
        '<div class="ef-title" style="font-size:13px;margin-top:12px">Relationship vocabulary</div><div class="ef-rels">'+rels+'</div>'+ 
        '<p class="ef-muted"><b>Lean proof-build dependencies</b> (imports, not math prerequisites)</p><div class="ef-rels">'+proofDeps+'</div></div>';
      mathPane.querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>{
        const correct=Number(b.dataset.answer)===l.answer;
        mathCorrect=correct;mathFeedback=correct?l.feedback:"Not yet. Compare the answer with the graph and the current open connections, then try again.";
        if(correct&&!mastery.completed.includes(l.id)){mastery.completed.push(l.id);try{localStorage.setItem(masteryKey,JSON.stringify(mastery));}catch(_e){}}
        renderMath();
      });
      const prev=mathPane.querySelector("[data-prev]"),next=mathPane.querySelector("[data-next]");
      if(prev)prev.onclick=()=>{mathIndex=Math.max(0,mathIndex-1);mathFeedback="";mathCorrect=false;renderMath();};
      if(next)next.onclick=()=>{mathIndex=Math.min(M.lessons.length-1,mathIndex+1);mathFeedback="";mathCorrect=false;renderMath();};
    }
    function use(op){
      const r=E.applyOperator(state,{actor:"warden",...op,instanceId:"lab-"+(state.log.length+1)});
      if(!r.ok){notice=r.error;draw();return;}
      state=r.state;notice="Operation committed. Review the changed field, connection coefficients, ΦF, and causal log.";draw();
    }
    host.querySelectorAll("[data-op]").forEach(b=>b.onclick=()=>use(actions[+b.dataset.op][1]));
    host.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{activeView=b.dataset.view;renderMath();});
    host.querySelector("[data-step]").onclick=()=>{
      try{state=E.advanceTransport(state);notice="Advanced one stable simulation interval. Flux was simultaneous and total field quantity is conserved.";draw();}
      catch(e){notice=e.message;draw();}
    };
    host.querySelector("[data-threshold]").onclick=()=>{
      const r=E.evaluateThresholds(state,"turnEnd");state=r.state;
      notice=r.fired.length?"Threshold fired: "+r.fired.join(", "):"No armed turn-end threshold was satisfied.";draw();
    };
    host.querySelector("[data-reset]").onclick=()=>{state=S.initial();notice="Field reset to the authored Channel scenario.";draw();};
    host.querySelector("[data-exit]").onclick=onExit;
    draw();
    return {destroy(){host.replaceChildren();},getState(){return state;}};
  }
  root.EmergentCombatUI={mount};
})(typeof window!=="undefined"?window:globalThis);
