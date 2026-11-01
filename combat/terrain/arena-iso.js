"use strict";
// Orthographic isometric architectural study. No external assets or network requests.
// World coordinates: x/y are map cells; z is height, in cell units.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ConceptCombatArenaIso=factory();})(typeof self!=='undefined'?self:this,function(){
  const LEVEL=.72, cache=new WeakMap();
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>mul(a,1/(Math.hypot(...a)||1));
  const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  const hash=(x,y,n)=>{let k=Math.imul(x+17,374761393)^Math.imul(y+19,668265263)^Math.imul(n+3,1274126177);k=Math.imul(k^(k>>>13),1274126177);return(k>>>0)/4294967296;};
  function rawProject([x,y,z],turn=0){
    const a=turn*Math.PI/2,c=Math.cos(a),s=Math.sin(a),u=x*c-y*s,v=x*s+y*c;
    return [(u-v)*Math.SQRT1_2,(u+v)/Math.sqrt(6)-z*Math.sqrt(2/3),(u+v+z)/Math.sqrt(3)];
  }
  function normalizeArena(input){
    const map=input.map.map(row=>Array.isArray(row)?row.join(''):row);
    const height=(input.height||map.map(row=>'0'.repeat(row.length))).map(row=>Array.isArray(row)?row.map(Number).join(''):row);
    return {...input,map,height,spawns:input.spawns||{player:[],enemy:[]}};
  }
  function levelAt(a,x,y){return Number(a.height[Math.max(0,Math.min(a.height.length-1,Math.floor(y)))][Math.max(0,Math.min(a.map[0].length-1,Math.floor(x)))])*LEVEL;}
  function rampHeight(a,x,y){
    // Interpolate the authored cell heights along the sculpted route.
    const xx=Math.max(0,Math.min(a.map[0].length-1,x-.5)),yy=Math.max(0,Math.min(a.map.length-1,y-.5));
    const x0=Math.floor(xx),y0=Math.floor(yy),x1=Math.min(x0+1,a.map[0].length-1),y1=Math.min(y0+1,a.map.length-1),tx=xx-x0,ty=yy-y0;
    return ((+a.height[y0][x0]*(1-tx)+ +a.height[y0][x1]*tx)*(1-ty)+(+a.height[y1][x0]*(1-tx)+ +a.height[y1][x1]*tx)*ty)*LEVEL;
  }
  function sceneFor(input){
    const signature=JSON.stringify([input.map,input.height,input.visual,input.objects,input.structures]);
    const previous=cache.get(input);if(previous?.signature===signature)return previous.scene;
    const a=normalizeArena(input),features=a.visual?.features||[],seed=Number(a.visual?.seed)||0;
    const noise=(x,y,n)=>hash(x,y,n+seed);
    const palette={stone:'#e1d4b8',soil:'#8c785b',turf:'#87966b',water:'#75a6a2',wall:'#c0ad8d',ramp:'#b94936',bulkhead:'#8f97a3',...a.visual?.palette};
    const faces=[],ground=[],casters=[];
    const face=(p,color,kind='architecture',shadow=false)=>{const n=norm(cross(sub(p[1],p[0]),sub(p[2],p[0])));faces.push({p,color,n,kind});if(shadow)casters.push({p,kind});};
    const box=(x,y,z,w,d,h,color,kind='architecture',shadow=true)=>{
      const a=[x,y,z],b=[x+w,y,z],c=[x+w,y+d,z],e=[x,y+d,z],A=[x,y,z+h],B=[x+w,y,z+h],C=[x+w,y+d,z+h],E=[x,y+d,z+h];
      face([A,B,C,E],color,kind,shadow);face([a,b,B,A],color,kind);face([b,c,C,B],color,kind);face([c,e,E,C],color,kind);face([e,a,A,E],color,kind);
    };
    const tube=(p,q,r,color,kind='architecture',sides=8)=>{
      const axis=norm(sub(q,p)),u=norm(cross(axis,Math.abs(axis[2])>.9?[0,1,0]:[0,0,1])),v=cross(axis,u),start=[],end=[];
      for(let i=0;i<sides;i++){const d=add(mul(u,Math.cos(i*2*Math.PI/sides)*r),mul(v,Math.sin(i*2*Math.PI/sides)*r));start.push(add(p,d));end.push(add(q,d));}
      for(let i=0;i<sides;i++){const j=(i+1)%sides;face([start[i],start[j],end[j],end[i]],color,kind);}
      face(end,color,kind,true);
    };
    const ellipsoid=(cx,cy,cz,rx,ry,rz,color,kind='plant')=>{
      const point=(lat,lon)=>[cx+rx*Math.sin(lat)*Math.cos(lon),cy+ry*Math.sin(lat)*Math.sin(lon),cz+rz*Math.cos(lat)];
      for(let j=0;j<6;j++)for(let i=0;i<10;i++){const p=[point(j*Math.PI/6,i*Math.PI/5),point((j+1)*Math.PI/6,i*Math.PI/5),point((j+1)*Math.PI/6,(i+1)*Math.PI/5),point(j*Math.PI/6,(i+1)*Math.PI/5)];face(p,color,kind,j<3);}
    };
    // The podium is modelled, including both visible retaining-wall directions.
    for(let y=0;y<a.map.length;y++)for(let x=0;x<a.map[0].length;x++){
      const ch=a.map[y][x],z=levelAt(a,x,y),color=ch===','||ch==='h'?palette.turf:ch==='T'||ch==='m'?palette.soil:ch==='w'||ch==='~'?palette.water:ch==='*'?'#8b7863':ch==='^'?'#7a8055':palette.stone;
      const corners=[[x,y,z],[x+1,y,z],[x+1,y+1,z],[x,y+1,z]];
      // The sculpted deck replaces these top faces; drawing coplanar tile tops
      // through its small segments would produce false gaps in painter ordering.
      if(ch!=='/'||!features.some(f=>f.type==='ribbon'))face(corners,color,'ground');ground.push({p:corners,x,y,z});
      const edges=[[[x,y],[x+1,y],x,y-1],[[x+1,y],[x+1,y+1],x+1,y],[[x+1,y+1],[x,y+1],x,y+1],[[x,y+1],[x,y],x-1,y]];
      for(const [p,q,nx,ny]of edges){const low=nx<0||ny<0||ny>=a.map.length||nx>=a.map[0].length?-.28:levelAt(a,nx,ny);if(z<=low)continue;
        face([[...p,low],[...q,low],[...q,z],[...p,z]],palette.wall,'wall');
        // Coping and a narrow foot shadow give the retaining walls thickness.
        const dx=q[0]-p[0],dy=q[1]-p[1],inset=[-dy*.045,dx*.045];
        face([[...p,z+.025],[...q,z+.025],[q[0]+inset[0],q[1]+inset[1],z+.025],[p[0]+inset[0],p[1]+inset[1],z+.025]],'#eadcc4','coping');
      }
      // Paver joints are deliberately independent of the tactical grid.
      if(ch==='.')for(let j=1;j<3;j++){const yy=y+j/3;face([[x,yy,z+.002],[x+1,yy,z+.002],[x+1,yy+.006,z+.002],[x,yy+.006,z+.002]],'#cbbd9f','joint');}
    }
    const allPaths=[],inGap=(p,gaps=[])=>gaps.some(b=>p[0]>=b.x&&p[0]<=b.x+b.width&&p[1]>=b.y&&p[1]<=b.y+b.depth);
    for(const feature of features){
      if(feature.type==='ribbon'){
        const f={radius:.8,deckWidth:.86,deckOffset:.045,parapetHeight:.53,parapetThickness:.08,railHeight:.48,...feature},r=f.radius;
        const route=[];
        for(const [cx,cy,start]of [[f.x+f.width-r,f.y+r,-Math.PI/2],[f.x+f.width-r,f.y+f.depth-r,0],[f.x+r,f.y+f.depth-r,Math.PI/2],[f.x+r,f.y+r,Math.PI]])for(let i=0;i<=12;i++){const t=start+i*Math.PI/24;route.push([cx+Math.cos(t)*r,cy+Math.sin(t)*r]);}
        const path=[];
        for(let i=0;i<route.length;i++){const p=route[i],q=route[(i+1)%route.length],n=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])*8));for(let k=0;k<n;k++)path.push([p[0]+(q[0]-p[0])*k/n,p[1]+(q[1]-p[1])*k/n]);}
        const edges=path.map((p,i)=>{const before=path[(i+path.length-1)%path.length],after=path[(i+1)%path.length],dx=after[0]-before[0],dy=after[1]-before[1],l=Math.hypot(dx,dy),n=[-dy/l,dx/l],z=rampHeight(a,...p)+f.deckOffset;return {p,n,z,inner:[p[0]+n[0]*f.deckWidth/2,p[1]+n[1]*f.deckWidth/2,z],outer:[p[0]-n[0]*f.deckWidth/2,p[1]-n[1]*f.deckWidth/2,z]};});
        allPaths.push(...edges);
        for(let i=0;i<edges.length;i++){
          const p=edges[i],q=edges[(i+1)%edges.length];
          // A destroyed/replaced ramp cell removes its corresponding sculptural segment.
          if(a.map[Math.floor(p.p[1])]?.[Math.floor(p.p[0])]!=='/')continue;
          face([p.outer,q.outer,q.inner,p.inner],palette.ramp,'ramp',true);
          face([p.outer,q.outer,add(q.outer,[0,0,-.10]),add(p.outer,[0,0,-.10])],'#8e3429','ramp');
          if(!inGap(p.p,f.parapetGaps)){
            const h=f.parapetHeight,pi=add(p.inner,mul([...p.n,0],-f.parapetThickness)),qi=add(q.inner,mul([...q.n,0],-f.parapetThickness));
            face([p.inner,q.inner,add(q.inner,[0,0,h]),add(p.inner,[0,0,h])],'#ba4637','balustrade',true);
            face([qi,pi,add(pi,[0,0,h]),add(qi,[0,0,h])],'#a6382c','balustrade');
            face([add(p.inner,[0,0,h]),add(q.inner,[0,0,h]),add(qi,[0,0,h]),add(pi,[0,0,h])],'#db7254','balustrade');
            tube(add(p.inner,[0,0,h+.025]),add(q.inner,[0,0,h+.025]),.025,'#ec9470','rail',6);
          }
          if(!inGap(p.p,f.railGaps)){tube(add(p.outer,[0,0,f.railHeight]),add(q.outer,[0,0,f.railHeight]),.022,'#b7aa93','rail',6);if(i%6===0)tube(p.outer,add(p.outer,[0,0,f.railHeight]),.018,'#a39782','rail',6);}
        }
      }
      if(feature.type==='basin'){
        const f={rimWidth:.07,rimHeight:.1,...feature},z=levelAt(a,f.x,f.y)+.02;
        box(f.x-f.rimWidth,f.y-f.rimWidth,z,f.rimWidth,f.depth+f.rimWidth*2,f.rimHeight,'#d6c7aa');
        box(f.x+f.width,f.y-f.rimWidth,z,f.rimWidth,f.depth+f.rimWidth*2,f.rimHeight,'#d6c7aa');
        box(f.x-f.rimWidth,f.y-f.rimWidth,z,f.width+f.rimWidth*2,f.rimWidth,f.rimHeight,'#d6c7aa');
        box(f.x-f.rimWidth,f.y+f.depth,z,f.width+f.rimWidth*2,f.rimWidth,f.rimHeight,'#d6c7aa');
        for(let i=0;i<20;i++){const x=f.x+.05+noise(7,5,i)*(f.width-.2),y=f.y+.08+noise(5,7,i)*(f.depth-.2),zz=levelAt(a,x,y)+.006;
          if(!['w','~'].includes(a.map[Math.floor(y)]?.[Math.floor(x)]))continue;
          face([[x,y,zz],[x+.18,y,zz],[x+.21,y+.015,zz],[x+.03,y+.015,zz]],'#afd0bd','water');}
      }
      if(feature.type==='canopy'){
        const f={rise:1.54,slats:27,...feature},columns=f.columns||[];
        // Removed supports remove overhead geometry rather than leaving a phantom roof.
        if(columns.some(([x,y])=>a.map[Math.floor(y)]?.[Math.floor(x)]!=='#'))continue;
        const base=levelAt(a,f.x,f.y);
        for(const [x,y]of columns)box(x-.13,y-.13,levelAt(a,x,y),.26,.26,f.rise,'#dfd5c2','column');
        for(const y of [f.y+.08,f.y+f.depth-.16])box(f.x,y,base+f.rise-.16,f.width,.11,.18,'#927552','beam');
        for(let i=0;i<f.slats;i++)box(f.x+i*f.width/f.slats,f.y,base+f.rise,Math.min(.115,f.width/f.slats*.45),f.depth,.12,'#ad8b61','canopy');
      }
    }
    for(let y=0;y<a.map.length;y++)for(let x=0;x<a.map[0].length;x++){
      const ch=a.map[y][x],z=levelAt(a,x,y),cx=x+.5,cy=y+.5;
      if(ch==='T'){
        tube([cx,cy,z],[cx+.04,cy,z+1.20],.06,'#756249','trunk');
        for(let j=0;j<7;j++){const angle=noise(x,y,j)*Math.PI*2,r=noise(x,y,j+12)*.33,px=cx+Math.cos(angle)*r,py=cy+Math.sin(angle)*r,pz=z+1.1+noise(x,y,j+44)*.45;
          if(j<3)tube([cx,cy,z+.65],[px,py,pz],.025,'#756249','trunk');
          ellipsoid(px,py,pz,.32,.30,.34,['#738255','#8c9a65','#61764d','#9ca577'][j%4]);}
        // Circular stone tree ring.
        for(let k=0;k<24;k++){const t=k*Math.PI/12,q=(k+1)*Math.PI/12;face([[cx+Math.cos(t)*.37,cy+Math.sin(t)*.37,z+.012],[cx+Math.cos(q)*.37,cy+Math.sin(q)*.37,z+.012],[cx+Math.cos(q)*.40,cy+Math.sin(q)*.40,z+.012],[cx+Math.cos(t)*.40,cy+Math.sin(t)*.40,z+.012]],'#d9c7a7','ring');}
      }
      if(ch==='#'&&a.interior){box(x,y,z,1,1,.5,palette.bulkhead||'#8f97a3','wall');continue;}   // an interior's bulkheads: a low full-tile wall, so a fighter behind one stays in view (Lantern, 2026-10-18)
      if(ch==='#'&&!features.some(f=>f.type==='canopy'&&!f.columns.some(([px,py])=>a.map[Math.floor(py)]?.[Math.floor(px)]!=='#')&&f.columns.some(([px,py])=>Math.floor(px)===x&&Math.floor(py)===y)))box(x+.28,y+.28,z,.44,.44,1.25,'#b9afa0','column');
      if(ch==='b')for(let k=0;k<6;k++)box(x+.05,y+k/6,z+.01,.9,.12,.05,'#a6885e','bridge');
      if(ch==='*'||ch==='^')for(let k=0;k<4;k++)ellipsoid(x+.15+noise(x,y,k)*.7,y+.15+noise(y,x,k)*.7,z+.07,.08,.08,.12,'#736744','hazard');
      if(ch==='h'){box(x+.11,y+.12,z,.78,.72,.13,'#b8aa88','planter');ellipsoid(cx,cy,z+.30,.39,.34,.20,'#708457');}
    }
    // Surroundings (Mala, 2026-10-23): structures outside the playable bounds. Backdrop only: no
    // collision or LOS. Kind 'backdrop' survives the battle's population cut (it replaces no unit art).
    // Only pieces within SURROUND_REACH of the board are drawn, on a soil apron fitted to them (Mala, 2026-10-25: the old
    // apron spanned every piece plus 1.5, a brown field several times the board, and the camera zoomed out to fit it).
    const surroundings=nearSurroundings(a);
    if(surroundings.length){
      const [GX0,GY0,GX1,GY1]=surroundBounds(a,surroundings,.3);
      face([[GX0,GY0,-.28],[GX1,GY0,-.28],[GX1,GY1,-.28],[GX0,GY1,-.28]],palette.soil,'ground');
      for(const s of surroundings){
        const z=s.z??-.28;
        if(s.type==='block')box(s.x,s.y,z,s.width,s.depth,s.height,palette[s.material]||palette.stone);
        else if(s.type==='column')box(s.x-.15,s.y-.15,z,.3,.3,s.height??1.25,palette[s.material||'stone']||palette.stone,'column');
        else if(s.type==='tree'){const t=s.size??1;
          tube([s.x,s.y,z],[s.x+.04*t,s.y,z+1.20*t],.06*t,'#756249','backdrop');
          for(let j=0;j<5;j++){const angle=noise(s.x,s.y,j)*Math.PI*2,r=noise(s.x,s.y,j+12)*.33*t;
            ellipsoid(s.x+Math.cos(angle)*r,s.y+Math.sin(angle)*r,z+(1.1+noise(s.x,s.y,j+44)*.45)*t,.32*t,.30*t,.34*t,['#738255','#8c9a65','#61764d'][j%3],'backdrop');}
        }
      }
    }
    // Scale figures participate in the same depth order as the sculpture.
    const figure=(p,color)=>{const [x,y]=p,cx=x+.5,cy=y+.5,z=levelAt(a,cx,cy);tube([cx-.065,cy,z+.05],[cx-.065,cy,z+.31],.032,color,'unit');tube([cx+.065,cy,z+.05],[cx+.065,cy,z+.31],.032,color,'unit');ellipsoid(cx,cy,z+.46,.12,.09,.23,color,'unit');ellipsoid(cx,cy,z+.76,.078,.078,.09,'#d4bfa0','unit');};
    a.spawns.player.forEach(p=>figure(p,'#3f6a7c'));a.spawns.enemy.forEach(p=>figure(p,'#96534c'));
    const result={faces,ground,casters,path:allPaths};cache.set(input,{signature,scene:result});return result;
  }
  function shade(hex,n,sun,mode){
    if(mode==='none')return hex;
    const rgb=hex.match(/\w\w/g).map(v=>parseInt(v,16)),brightness=.60+.46*Math.max(0,dot(n,sun));
    const warm=mode==='golden'?[1.06,.95,.83]:[1.02,1,.94];
    return '#'+rgb.map((v,i)=>Math.round(Math.min(255,v*brightness*warm[i])).toString(16).padStart(2,'0')).join('');
  }
  function inside(p,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
  function worldOnFace(point,screen,world){
    for(let i=1;i<screen.length-1;i++){
      const a=screen[0],b=screen[i],c=screen[i+1],den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-7)continue;
      const u=((b[1]-c[1])*(point[0]-c[0])+(c[0]-b[0])*(point[1]-c[1]))/den,v=((c[1]-a[1])*(point[0]-c[0])+(a[0]-c[0])*(point[1]-c[1]))/den,w=1-u-v;
      if(u>=-1e-7&&v>=-1e-7&&w>=-1e-7)return add(add(mul(world[0],u),mul(world[i],v)),mul(world[i+1],w));
    }
    return null;
  }
  const SURROUND_REACH=2;
  const footprint=(s)=>{const w=s.type==='block'?s.width:.4,d=s.type==='block'?s.depth:.4;return [s.x,s.y,s.x+w,s.y+d];};
  function nearSurroundings(a){const W=a.map[0].length,H=a.map.length,R=SURROUND_REACH;
    return (a.visual?.surroundings||[]).filter((s)=>{const [x0,y0,x1,y1]=footprint(s);return x0>=-R&&y0>=-R&&x1<=W+R&&y1<=H+R;});}
  function surroundBounds(a,list,pad){let X0=0,Y0=0,X1=a.map[0].length,Y1=a.map.length;
    for(const s of list){const [x0,y0,x1,y1]=footprint(s);X0=Math.min(X0,x0);Y0=Math.min(Y0,y0);X1=Math.max(X1,x1);Y1=Math.max(Y1,y1);}
    return [X0-pad,Y0-pad,X1+pad,Y1+pad];}
  function cameraFor(input,width,height,turn=0){
    const a=normalizeArena(input);
    const maxZ=sceneFor(input).faces.reduce((max,f)=>f.p.reduce((m,p)=>Math.max(m,p[2]),max),4);
    let fx0=0,fy0=0,fx1=a.map[0].length,fy1=a.map.length;
    { const near=nearSurroundings(a); if(near.length)[fx0,fy0,fx1,fy1]=surroundBounds(a,near,.3); }
    const points=[];for(const x of [fx0,fx1])for(const y of [fy0,fy1])for(const z of [-.3,maxZ])points.push(rawProject([x,y,z],turn));
    const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
    const scale=Math.min((width-100)/(maxX-minX),(height-85)/(maxY-minY));
    const offset=[width/2-(minX+maxX)/2*scale,height/2-(minY+maxY)/2*scale+12];
    return {scale,offset,turn,project:p=>{const [u,v,d]=rawProject(p,turn);return [u*scale+offset[0],v*scale+offset[1],d];}};
  }
  function paint(g,input,{width=1600,height=1100,turn=0,lighting=input.visual?.lighting||'day',grid=false,units=true,selected=null,cutaway=false}={}){
    const a=normalizeArena(input),model=sceneFor(input),camera=cameraFor(input,width,height,turn),P=camera.project;
    const sun=norm(lighting==='golden'?[-4,-5,5]:[-3,-4,8]);
    g.clearRect(0,0,width,height);const bg=g.createLinearGradient(0,0,0,height);bg.addColorStop(0,lighting==='golden'?'#eee4d2':'#f0eee5');bg.addColorStop(1,lighting==='golden'?'#d7cdbd':'#dedfd4');g.fillStyle=bg;g.fillRect(0,0,width,height);
    const polygon=(p,fill,stroke=null)=>{g.beginPath();p.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();if(fill){g.fillStyle=fill;g.fill();g.strokeStyle=fill;g.lineWidth=.35;g.stroke();}if(stroke){g.strokeStyle=stroke;g.lineWidth=.65;g.stroke();}};
    // Model grounding, separate from architectural cast shadows.
    g.save();g.filter='blur(15px)';polygon([[0,0,-.3],[a.map[0].length,0,-.3],[a.map[0].length,a.map.length,-.3],[0,a.map.length,-.3]].map(P),'#4e4a3924');g.restore();
    // Paving under the rounded deck fills the trimmed tile corners. It is an
    // underlay, not an independently sorted coplanar top that can cut the deck.
    for(const tile of model.ground)if(a.map[tile.y][tile.x]==='/'&&a.visual?.features?.some(f=>f.type==='ribbon'))polygon(tile.p.map(P),shade('#e1d4b8',[0,0,1],sun,lighting));
    const angle=turn*Math.PI/2,view=norm([Math.cos(angle)+Math.sin(angle),Math.cos(angle)-Math.sin(angle),1]);
    const drawFaces=model.faces.filter(f=>dot(f.n,view)>0.0001).filter(f=>units||f.kind!=='unit').filter(f=>!cutaway||!['canopy','beam','balustrade','rail'].includes(f.kind)).map(f=>({...f,screen:f.p.map(P),depth:f.p.reduce((s,p)=>s+rawProject(p,turn)[2],0)/f.p.length})).sort((a,b)=>a.depth-b.depth);
    // Cast shadows onto the receiving top surface, using the sun direction and
    // local ground level. These are architectural approximations, not ray tracing.
    const shadows=[];
    if(lighting!=='none')for(const caster of model.casters){
      if(!units&&caster.kind==='unit'||cutaway&&['canopy','beam','balustrade','rail'].includes(caster.kind))continue;
      const face=caster.p;
      const center=face.reduce((s,p)=>add(s,mul(p,1/face.length)),[0,0,0]);
      const base=levelAt(a,center[0],center[1]);if(center[2]-base<.12)continue;
      const points=face.map(p=>{const dz=Math.max(0,p[2]-base);return [p[0]-sun[0]/sun[2]*dz,p[1]-sun[1]/sun[2]*dz,base+.012];});
      if(points.some(p=>p[0]<0||p[1]<0||p[0]>a.map[0].length||p[1]>a.map.length))continue;
      const screen=points.map(P);shadows.push({screen,bounds:[Math.min(...screen.map(p=>p[0])),Math.min(...screen.map(p=>p[1])),Math.max(...screen.map(p=>p[0])),Math.max(...screen.map(p=>p[1]))]});
    }
    // Solids and terrain share one depth order. Receiver-clipped shadows are
    // painted with each ground face so foreground walls can occlude them.
    for(const f of drawFaces){
      polygon(f.screen,shade(f.color,f.n,sun,lighting));
      if(f.kind!=='ground'&&!(f.kind==='ramp'&&f.n[2]>.5))continue;
      const bounds=[Math.min(...f.screen.map(p=>p[0])),Math.min(...f.screen.map(p=>p[1])),Math.max(...f.screen.map(p=>p[0])),Math.max(...f.screen.map(p=>p[1]))];
      const local=shadows.filter(s=>s.bounds[0]<bounds[2]&&s.bounds[2]>bounds[0]&&s.bounds[1]<bounds[3]&&s.bounds[3]>bounds[1]);
      if(local.length){g.save();g.beginPath();f.screen.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();g.globalAlpha=.17;g.fillStyle='#514735';g.beginPath();local.forEach(s=>{s.screen.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();});g.fill();g.restore();}
      if(f.kind==='ground'){
        if(grid)polygon(f.screen,null,'#39433345');
        if(selected&&Math.floor(f.p[0][0])===selected[0]&&Math.floor(f.p[0][1])===selected[1])polygon(f.screen,'#fff4bd55','#6b4d2f');
      }else if(selected){
        const center=f.p.reduce((sum,p)=>add(sum,mul(p,1/f.p.length)),[0,0,0]);
        if(Math.floor(center[0])===selected[0]&&Math.floor(center[1])===selected[1])polygon(f.screen,'#fff4bd66');
      }
    }
    // A tiny compass anchors the diamond view without covering the scene.
    g.fillStyle='#62665b';g.font='12px system-ui';g.fillText('ORTHOGRAPHIC · ISOMETRIC',32,height-28);
    const tiles=[...model.ground,...model.faces.filter(f=>f.kind==='ramp'&&f.n[2]>.5)].map(t=>({...t,screen:t.p.map(P),depth:t.p.reduce((s,p)=>s+rawProject(p,turn)[2],0)/t.p.length})).sort((a,b)=>b.depth-a.depth);
    return {camera,project:P,pick:(x,y)=>{const t=tiles.find(t=>inside([x,y],t.screen));if(!t)return null;if(t.x!==undefined)return[t.x,t.y];const world=worldOnFace([x,y],t.screen,t.p);return world?[Math.max(0,Math.min(a.map[0].length-1,Math.floor(world[0]))),Math.max(0,Math.min(a.map.length-1,Math.floor(world[1])))]:null;}};
  }
  return {paint,rawProject,cameraFor,sceneFor,rampHeight,normalizeArena,LEVEL};
});
