(() => {
  if(typeof state==='undefined'||typeof els==='undefined'||typeof renderRelations!=='function')return;
  const button=document.querySelector('#cohabitSelectBtn'),bar=document.querySelector('#cohabitSelectionBar'),count=document.querySelector('#cohabitSelectionCount'),create=document.querySelector('#cohabitSelectionCreate'),cancel=document.querySelector('#cohabitSelectionCancel');
  if(!button||!bar)return;
  const secondButton=document.querySelector('#cohabitSecondSelectBtn'),addButton=document.querySelector('#cohabitAddBtn');
  const chosen=new Set();let active=false,groupIndex=0;
  const defaultColors=['#33272a','#c9002b'];
  const validColor=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
  const colors=()=>defaultColors.map((fallback,index)=>validColor(state.cohabitColors?.[index],fallback));
  const colorInputs=[document.querySelector('#cohabitColor1'),document.querySelector('#cohabitColor2')];
  const memberKey=()=>groupIndex===1?'cohabitSecondMemberIds':'cohabitMemberIds';
  const validIds=()=>new Set(state.people.map(person=>person.id));
  const pickVisualBackup=new WeakMap();

  // During cohabiting-family selection, blue must always win over every other
  // editor/client selection style. CSS alone was not enough because added clients
  // can also carry the advanced editor's red multi-selected state. Inline
  // !important highlighting is applied only while this mode is active and then
  // completely restored, so target/client red outlines return after creation.
  if(!document.querySelector('style[data-cohabit-pick-visual]')){
    const style=document.createElement('style');
    style.dataset.cohabitPickVisual='v2';
    style.textContent=`
      .node.cohabit-pick-selected .shape,
      .node.cohabit-pick-selected .outer,
      .node.multi-selected.cohabit-pick-selected .shape,
      .node.multi-selected.cohabit-pick-selected .outer,
      .node.proband.cohabit-pick-selected .shape,
      .node.proband.cohabit-pick-selected .outer{
        stroke:#2563a8!important;
        stroke-width:5!important;
      }
      .node.cohabit-pick-selected{
        filter:drop-shadow(0 0 5px rgba(37,99,168,.24))!important;
      }
    `;
    document.head.append(style);
  }

  function rememberStyle(el,property){
    let backup=pickVisualBackup.get(el);
    if(!backup){backup={};pickVisualBackup.set(el,backup)}
    if(!(property in backup))backup[property]={value:el.style.getPropertyValue(property),priority:el.style.getPropertyPriority(property)};
  }
  function forceStyle(el,property,value){rememberStyle(el,property);el.style.setProperty(property,value,'important')}
  function restoreStyle(el,property){const backup=pickVisualBackup.get(el)?.[property];if(!backup){el.style.removeProperty(property);return}if(backup.value)el.style.setProperty(property,backup.value,backup.priority||'');else el.style.removeProperty(property)}
  function applyPickVisual(node,on){
    node.classList.toggle('cohabit-pick-selected',on);
    const parts=node.querySelectorAll('.shape,.outer');
    if(on){
      parts.forEach(part=>{forceStyle(part,'stroke','#2563a8');forceStyle(part,'stroke-width','5')});
      forceStyle(node,'filter','drop-shadow(0 0 5px rgba(37,99,168,.24))');
    }else{
      parts.forEach(part=>{restoreStyle(part,'stroke');restoreStyle(part,'stroke-width')});
      restoreStyle(node,'filter');
    }
  }

  // app.js currently restores only people/relations on refresh. Recover the
  // cohabiting-family fields from the same saved localStorage payload before
  // the legacy migration below can overwrite the user's manual selection.
  try{
    const persisted=JSON.parse(localStorage.getItem('genogram-studio')||'null');
    if(persisted&&typeof persisted==='object'&&Array.isArray(persisted.cohabitMemberIds)){
      const ids=validIds();
      state.cohabitMemberIds=persisted.cohabitMemberIds.filter(id=>ids.has(id));
      state.cohabitSelectionVersion=Number(persisted.cohabitSelectionVersion)||2;
      if(persisted.cohabitBox&&typeof persisted.cohabitBox==='object')state.cohabitBox={...persisted.cohabitBox};
    }
  }catch{}

  try{const persisted=JSON.parse(localStorage.getItem('genogram-studio')||'null');state.cohabitSecondMemberIds=Array.isArray(persisted?.cohabitSecondMemberIds)?persisted.cohabitSecondMemberIds.filter(id=>validIds().has(id)):[];}catch{state.cohabitSecondMemberIds=[];}

  try{const persisted=JSON.parse(localStorage.getItem('genogram-studio')||'null');state.cohabitColors=defaultColors.map((fallback,index)=>validColor(persisted?.cohabitColors?.[index],fallback));}catch{state.cohabitColors=[...defaultColors];}

  if(state.cohabitSelectionVersion!==2){const legacy=state.people.filter(person=>person.life!=='dead'&&['yes','true','1','동거'].includes(String(person.cohabit).toLowerCase())).map(person=>person.id);state.cohabitMemberIds=legacy;state.cohabitSelectionVersion=2;state.cohabitBox=null;save();}

  const convexHull=points=>{if(points.length<3)return points;const sorted=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y),cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lower=[],upper=[];for(const p of sorted){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p)}for(const p of sorted.slice().reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p)}return lower.slice(0,-1).concat(upper.slice(0,-1))};
  const polygonArea=points=>points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y},0)/2;
  function pointInPolygon(point,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j],crosses=(a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y||1e-9)+a.x;if(crosses)inside=!inside}return inside}
  function personTouchesHull(person,hull){const x=person.x,y=person.y,samples=[{x,y},{x:x-34,y:y-44},{x:x+34,y:y-44},{x:x+34,y:y+48},{x:x-34,y:y+48}];return samples.some(point=>pointInPolygon(point,hull))}

  function buildConcaveBoundary(hull,members,outsiders){
    if(hull.length<3||!outsiders.length)return hull;
    const inwardSign=polygonArea(hull)>=0?1:-1,edgeNotches=Array.from({length:hull.length},()=>[]);
    outsiders.filter(person=>personTouchesHull(person,hull)).forEach(person=>{
      let best=null;
      hull.forEach((a,edge)=>{
        const b=hull[(edge+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<90)return;
        const ux=dx/len,uy=dy/len,nx=-uy*inwardSign,ny=ux*inwardSign,vx=person.x-a.x,vy=person.y-a.y,t=vx*ux+vy*uy,d=vx*nx+vy*ny;
        if(d<0||t<14||t>len-14)return;
        const half=54,start=Math.max(12,t-half),end=Math.min(len-12,t+half);if(end-start<62)return;
        const depth=Math.min(310,d+88);
        let blocked=false;
        for(const member of members){const mx=member.x-a.x,my=member.y-a.y,mt=mx*ux+my*uy,md=mx*nx+my*ny;if(mt>start-62&&mt<end+62&&md>-28&&md<depth+92){blocked=true;break}}
        const score=d+(blocked?5000:0)+Math.abs(t-len/2)*0.01;
        if(!best||score<best.score)best={edge,start,end,depth,score};
      });
      if(best)edgeNotches[best.edge].push(best);
    });
    if(!edgeNotches.some(items=>items.length))return hull;

    const result=[];
    hull.forEach((a,edge)=>{
      const b=hull[(edge+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,nx=-uy*inwardSign,ny=ux*inwardSign;
      result.push({x:a.x,y:a.y});
      const sorted=edgeNotches[edge].slice().sort((m,n)=>m.start-n.start),merged=[];
      sorted.forEach(item=>{const last=merged.at(-1);if(!last||item.start>last.end+16)merged.push({...item});else{last.end=Math.max(last.end,item.end);last.depth=Math.max(last.depth,item.depth)}});
      merged.forEach(item=>{
        const p1={x:a.x+ux*item.start,y:a.y+uy*item.start},p2={x:a.x+ux*item.end,y:a.y+uy*item.end};
        result.push(p1,{x:p1.x+nx*item.depth,y:p1.y+ny*item.depth},{x:p2.x+nx*item.depth,y:p2.y+ny*item.depth},p2);
      });
    });
    return result;
  }

  function roundedPath(points,radius=18){if(points.length<3)return'';const clamp=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy)),d=Math.min(radius,len/3);return{x:a.x+dx/len*d,y:a.y+dy/len*d}};let d='';points.forEach((p,i)=>{const prev=points[(i-1+points.length)%points.length],next=points[(i+1)%points.length],start=clamp(p,prev),end=clamp(p,next);d+=(i?' L':'M')+`${start.x} ${start.y} Q${p.x} ${p.y} ${end.x} ${end.y}`});return d+' Z'}

  function singleMemberBoundary(member){
    const x1=Math.max(8,member.x-74),x2=Math.min(1192,member.x+74),y1=Math.max(8,member.y-76),y2=Math.min(712,member.y+96);
    const points=[{x:x1,y:y1},{x:x2,y:y1},{x:x2,y:y2},{x:x1,y:y2}];
    return{path:roundedPath(points,24),x:x1,y:y1};
  }

  function twoMemberBoundary(a,b){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
    if(len<4)return singleMemberBoundary(a);
    const ux=dx/len,uy=dy/len,nx=-uy,ny=ux,r=82,k=r*1.34;
    const topA={x:a.x+nx*r,y:a.y+ny*r},topB={x:b.x+nx*r,y:b.y+ny*r};
    const bottomB={x:b.x-nx*r,y:b.y-ny*r},bottomA={x:a.x-nx*r,y:a.y-ny*r};
    const c1={x:topB.x+ux*k,y:topB.y+uy*k},c2={x:bottomB.x+ux*k,y:bottomB.y+uy*k};
    const c3={x:bottomA.x-ux*k,y:bottomA.y-uy*k},c4={x:topA.x-ux*k,y:topA.y-uy*k};
    const path=`M${topA.x} ${topA.y} L${topB.x} ${topB.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${bottomB.x} ${bottomB.y} L${bottomA.x} ${bottomA.y} C${c3.x} ${c3.y} ${c4.x} ${c4.y} ${topA.x} ${topA.y} Z`;
    const x=Math.max(8,Math.min(a.x,b.x)-r),y=Math.max(8,Math.min(a.y,b.y)-r);
    return{path,x,y};
  }

  // Build independent outlines on a shared grid. Corridors detour around
  // other people and the first outline instead of crossing them diagonally.
  function separatedBoundaries(){
    const originalGroups=[state.cohabitMemberIds||[],state.cohabitSecondMemberIds||[]].map(ids=>state.people.filter(p=>ids.includes(p.id)));
    // Reserve the compact group first, independent of its number or color.
    const area=members=>members.length?(Math.max(...members.map(p=>p.x))-Math.min(...members.map(p=>p.x))+128)*(Math.max(...members.map(p=>p.y))-Math.min(...members.map(p=>p.y))+160):0;
    const order=[0,1].filter(index=>originalGroups[index].length).sort((a,b)=>area(originalGroups[a])-area(originalGroups[b]));
    const groups=order.map(index=>originalGroups[index]);
    if(!groups.length)return null;
    if(groups.length>1&&groups[0].some(p=>groups[1].some(q=>q.id===p.id)))return null;
    const step=8,cols=148,rows=88,size=cols*rows,at=(x,y)=>y*cols+x;
    const center=p=>({x:Math.max(0,Math.min(cols-1,Math.floor((p.x-8)/step))),y:Math.max(0,Math.min(rows-1,Math.floor((p.y-8)/step)))});
    const rectangles=(members,px=56,top=56,bottom=80)=>{const result=new Set();for(const p of members){const x1=Math.max(0,Math.floor((p.x-px-8)/step)),x2=Math.min(cols-1,Math.floor((p.x+px-8)/step)),y1=Math.max(0,Math.floor((p.y-top-8)/step)),y2=Math.min(rows-1,Math.floor((p.y+bottom-8)/step));for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)result.add(at(x,y))}return result};
    const expand=(cells,r)=>{const out=new Set();for(const i of cells){const x=i%cols,y=Math.floor(i/cols);for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(x+dx>=0&&x+dx<cols&&y+dy>=0&&y+dy<rows)out.add(at(x+dx,y+dy))}return out};
    const masks=[];
    for(let index=0;index<groups.length;index++){
      const members=groups[index],memberIds=new Set(members.map(p=>p.id)),foreign=state.people.filter(p=>!memberIds.has(p.id));
      const forbidden=rectangles(foreign,64,64,88);
      if(index>0)for(const previousMask of masks)for(const i of expand(previousMask,1))forbidden.add(i);
      const occupied=rectangles(members),connected=rectangles([members[0]]),blocked=expand(forbidden,2);
      // A compact rectangle is appropriate for people in the same row/column.
      // Diagonal groups use a narrow connecting corridor, never a filled box.
      const xs=[...occupied].map(i=>i%cols),ys=[...occupied].map(i=>Math.floor(i/cols)),box=new Set();
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const aligned=Math.max(...members.map(p=>p.x))-Math.min(...members.map(p=>p.x))<=16||Math.max(...members.map(p=>p.y))-Math.min(...members.map(p=>p.y))<=16;
      if(aligned){for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)box.add(at(x,y));if(![...box].some(i=>forbidden.has(i)))for(const i of box){occupied.add(i);connected.add(i)}}

      for(let memberIndex=1;memberIndex<members.length;memberIndex++){
        const member=members[memberIndex],targets=rectangles([member]);
        if([...targets].every(i=>connected.has(i)))continue;
        const target=center(member);let best=null;
        const consider=(points,startMember)=>{
          // Give endpoint segments the width of their person boxes. This
          // removes small shoulders where a narrow corridor meets a box.
          const route=new Set();let length=0;
          for(let n=1;n<points.length;n++){
            const a=points[n-1],b=points[n];if(a.x===b.x&&a.y===b.y)continue;
            const endpoint=n===1?startMember:n===points.length-1?member:null;
            const horizontal=a.y===b.y,half=endpoint?7:2;
            let x1=Math.min(a.x,b.x)-(horizontal?2:half),x2=Math.max(a.x,b.x)+(horizontal?2:half);
            let y1=Math.min(a.y,b.y)-(horizontal?half:2),y2=Math.max(a.y,b.y)+(horizontal?(endpoint?10:2):2);
            length+=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
            for(let y=Math.max(0,y1);y<=Math.min(rows-1,y2);y++)for(let x=Math.max(0,x1);x<=Math.min(cols-1,x2);x++)route.add(at(x,y));
          }
          if([...route].some(i=>forbidden.has(i)&&!occupied.has(i)))return;
          const score=route.size+length+(points.length-2)*80;
          if(!best||score<best.score)best={cells:route,score,filled:true};
        };
        // Try one- and two-turn routes first, scoring length and bend count.
        for(const anchor of members.slice(0,memberIndex)){
          const start=center(anchor);
          consider([start,{x:target.x,y:start.y},target],anchor);
          consider([start,{x:start.x,y:target.y},target],anchor);
          for(let x=0;x<cols;x++)consider([start,{x,y:start.y},{x,y:target.y},target],anchor);
          for(let y=0;y<rows;y++)consider([start,{x:start.x,y},{x:target.x,y},target],anchor);
        }
        if(!best){
          const previous=new Int32Array(size).fill(-2),queue=[];
          for(const i of connected){previous[i]=-1;queue.push(i)}
          let reached=-1;
          for(let head=0;head<queue.length&&reached<0;head++){
            const i=queue[head];if(targets.has(i)){reached=i;break}const x=i%cols,y=Math.floor(i/cols);
            for(const j of [x>0?i-1:-1,x<cols-1?i+1:-1,y>0?i-cols:-1,y<rows-1?i+cols:-1])if(j>=0&&previous[j]===-2&&(!blocked.has(j)||occupied.has(j))){previous[j]=i;queue.push(j)}
          }
          if(reached>=0){const cells=new Set();for(let i=reached;i>=0;i=previous[i])cells.add(i);best={cells};}
        }
        if(best)for(const i of (best.filled?best.cells:expand(best.cells,2)))if(!forbidden.has(i)){occupied.add(i);connected.add(i)}
        for(const i of targets)connected.add(i);
      }
      masks.push(occupied);
    }
    const outlines=masks.map(mask=>{
      const edges=new Map(),add=(a,b)=>{const key=a.join(',');if(!edges.has(key))edges.set(key,[]);edges.get(key).push(b)};
      for(const i of mask){const x=i%cols,y=Math.floor(i/cols);if(y===0||!mask.has(i-cols))add([x,y],[x+1,y]);if(x===cols-1||!mask.has(i+1))add([x+1,y],[x+1,y+1]);if(y===rows-1||!mask.has(i+cols))add([x+1,y+1],[x,y+1]);if(x===0||!mask.has(i-1))add([x,y+1],[x,y])}
      const loops=[];
      while(edges.size){const start=edges.keys().next().value;let key=start;const points=[];for(let guard=0;guard<size*8;guard++){const [x,y]=key.split(',').map(Number);points.push({x:8+x*step,y:8+y*step});const choices=edges.get(key);if(!choices?.length)break;const next=choices.pop();if(!choices.length)edges.delete(key);key=next.join(',');if(key===start)break}if(points.length>2){const corners=points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return(a.x-p.x)*(b.y-p.y)!==(a.y-p.y)*(b.x-p.x)});loops.push(roundedPath(corners,8))}}
      return{path:loops.join(' ')};
    });
    return originalGroups.map((_,index)=>outlines[order.indexOf(index)]||null);
  }

  function boundaryMarkup(index=0,separated=null){
    const key=index===1?'cohabitSecondMemberIds':'cohabitMemberIds',color=colors()[index];
    const ids=(state[key]||[]).filter(id=>validIds().has(id));state[key]=ids;if(!ids.length)return'';
    const members=ids.map(id=>state.people.find(person=>person.id===id)).filter(Boolean),memberSet=new Set(ids),outsiders=state.people.filter(person=>!memberSet.has(person.id));

    let shape;
    if(members.length===1){
      shape=singleMemberBoundary(members[0]);
    }else if(members.length===2){
      shape=twoMemberBoundary(members[0],members[1]);
    }else{
      const padX=68,padTop=72,padBottom=94,points=[];
      members.forEach(person=>{points.push({x:Math.max(8,person.x-padX),y:Math.max(8,person.y-padTop)},{x:Math.min(1192,person.x+padX),y:Math.max(8,person.y-padTop)},{x:Math.min(1192,person.x+padX),y:Math.min(712,person.y+padBottom)},{x:Math.max(8,person.x-padX),y:Math.min(712,person.y+padBottom)})});
      const hull=convexHull(points),boundary=buildConcaveBoundary(hull,members,outsiders);
      shape={path:roundedPath(boundary,20),x:Math.min(...hull.map(p=>p.x)),y:Math.min(...hull.map(p=>p.y))};
    }

    if(separated?.[index])shape=separated[index];
    return`<g class="cohabit-boundary-members" data-cohabit-group="${index}" pointer-events="none"><path style="stroke:${color}" d="${shape.path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></g>`;
  }

  const previous=renderRelations;renderRelations=function(...args){const result=previous.apply(this,args);els.relations.querySelectorAll('.cohabit-boundary,.cohabit-boundary-v2,.cohabit-boundary-v3,.cohabit-boundary-members').forEach(node=>node.remove());const separated=separatedBoundaries();const markup=boundaryMarkup(0,separated)+boundaryMarkup(1,separated);if(markup)els.relations.insertAdjacentHTML('afterbegin',markup);sync();return result};
  function sync(){
    const ids=validIds();
    state.cohabitMemberIds=(state.cohabitMemberIds||[]).filter(id=>ids.has(id));
    state.cohabitSecondMemberIds=(state.cohabitSecondMemberIds||[]).filter(id=>ids.has(id));
    for(const id of chosen)if(!ids.has(id))chosen.delete(id);
    if(active&&!state.people.length){active=false;window.__COHABIT_PICK_MODE__=false;chosen.clear();bar.hidden=true;}
    els.nodes.querySelectorAll('.node[data-id]').forEach(node=>applyPickVisual(node,active&&chosen.has(node.dataset.id)));
    count.textContent=`${chosen.size}명 선택`;
    create.disabled=!chosen.size&&!(state[memberKey()]||[]).length;
    create.textContent=chosen.size?'생성':'지정 해제';
    button.classList.toggle('active-tool',active&&groupIndex===0);
    secondButton?.classList.toggle('active-tool',active&&groupIndex===1);
    document.querySelector('#cohabitSelectionGuide').textContent=`동거가족 ${groupIndex+1} 구성원을 선택하세요`;
    const groupColors=colors();
    const filled=[state.cohabitMemberIds.length>0,state.cohabitSecondMemberIds.length>0];
    filled.forEach((on,index)=>{const control=document.querySelector(`#cohabitGroupControl${index+1}`);if(control)control.hidden=!on});
    if(addButton){addButton.disabled=filled.every(Boolean);addButton.title=filled.every(Boolean)?'동거가족은 최대 2개까지 추가할 수 있습니다':'';}
    colorInputs.forEach((input,index)=>{if(input)input.value=groupColors[index]});
    [button,secondButton].forEach((control,index)=>{if(control){control.style.color=groupColors[index];control.style.borderColor=groupColors[index]}});
  }
  function stop(){active=false;window.__COHABIT_PICK_MODE__=false;chosen.clear();bar.hidden=true;sync()}
  function start(index){groupIndex=index;if(!state.people.length){toast('먼저 가계도 구성원을 만들어주세요');return}active=true;window.__COHABIT_PICK_MODE__=true;chosen.clear();(state[memberKey()]||[]).forEach(id=>{if(validIds().has(id))chosen.add(id)});bar.hidden=false;sync();toast('동거가족으로 표시할 구성원을 선택하세요')}
  addButton?.addEventListener('click',()=>{const index=[state.cohabitMemberIds,state.cohabitSecondMemberIds].findIndex(ids=>!ids?.length);if(index<0){toast('동거가족은 최대 2개까지 추가할 수 있습니다');return}start(index)});
  button.addEventListener('click',()=>start(0));
  secondButton?.addEventListener('click',()=>start(1));
  cancel.addEventListener('click',stop);
  colorInputs.forEach((input,index)=>input?.addEventListener('input',()=>{const next=colors();next[index]=validColor(input.value,defaultColors[index]);state.cohabitColors=next;save();render();}));
  create.addEventListener('click',()=>{state[memberKey()]=[...chosen];state.cohabitSelectionVersion=2;state.cohabitBox=null;save();const hasMembers=chosen.size>0;stop();render();toast(hasMembers?'선택한 구성원으로 동거가족 범위를 만들었습니다':'동거가족 지정을 해제했습니다')});
  els.nodes.addEventListener('pointerdown',event=>{if(!active)return;const node=event.target.closest?.('.node[data-id]');if(!node)return;event.preventDefault();event.stopImmediatePropagation();const id=node.dataset.id;chosen.has(id)?chosen.delete(id):chosen.add(id);sync()},true);
  document.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();stop()}},true);
  function hideLegacyFields(){document.querySelectorAll('.aq-check').forEach(label=>{if(label.querySelector('.aq-co'))label.hidden=true});document.querySelectorAll('.aq-co-sel').forEach(select=>{const field=select.closest('.aq-field');if(field)field.hidden=true})}
  hideLegacyFields();const quickForm=document.querySelector('#quickForm');if(quickForm)new MutationObserver(hideLegacyFields).observe(quickForm,{childList:true,subtree:true});
  const personCohabit=document.querySelector('#personCohabit')?.closest('label');if(personCohabit)personCohabit.hidden=true;
  const baseRender=render;render=function(...args){const result=baseRender.apply(this,args);sync();return result};
  render();
})();
