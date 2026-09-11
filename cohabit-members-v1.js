(() => {
  if(typeof state==='undefined'||typeof els==='undefined'||typeof renderRelations!=='function')return;
  const button=document.querySelector('#cohabitSelectBtn'),bar=document.querySelector('#cohabitSelectionBar'),count=document.querySelector('#cohabitSelectionCount'),create=document.querySelector('#cohabitSelectionCreate'),cancel=document.querySelector('#cohabitSelectionCancel');
  if(!button||!bar)return;
  const chosen=new Set();let active=false;
  const validIds=()=>new Set(state.people.map(person=>person.id));

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
  function boundaryMarkup(){
    const ids=(state.cohabitMemberIds||[]).filter(id=>validIds().has(id));state.cohabitMemberIds=ids;if(!ids.length)return'';
    const members=ids.map(id=>state.people.find(person=>person.id===id)).filter(Boolean),memberSet=new Set(ids),outsiders=state.people.filter(person=>!memberSet.has(person.id)),padX=68,padTop=72,padBottom=94,points=[];
    members.forEach(person=>{points.push({x:Math.max(8,person.x-padX),y:Math.max(8,person.y-padTop)},{x:Math.min(1192,person.x+padX),y:Math.max(8,person.y-padTop)},{x:Math.min(1192,person.x+padX),y:Math.min(712,person.y+padBottom)},{x:Math.max(8,person.x-padX),y:Math.min(712,person.y+padBottom)})});
    const hull=convexHull(points),boundary=buildConcaveBoundary(hull,members,outsiders),path=roundedPath(boundary,20),x=Math.min(...hull.map(p=>p.x)),y=Math.min(...hull.map(p=>p.y));
    return`<g class="cohabit-boundary-members"><path d="${path}" fill="none" stroke="#33272a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><text x="${x+12}" y="${y>24?y-8:y+18}" fill="#33272a" font-size="12" font-weight="700">동거가족</text></g>`;
  }

  const previous=renderRelations;renderRelations=function(...args){const result=previous.apply(this,args);els.relations.querySelectorAll('.cohabit-boundary,.cohabit-boundary-v2,.cohabit-boundary-v3,.cohabit-boundary-members').forEach(node=>node.remove());const markup=boundaryMarkup();if(markup)els.relations.insertAdjacentHTML('afterbegin',markup);sync();return result};
  function sync(){const ids=validIds();state.cohabitMemberIds=(state.cohabitMemberIds||[]).filter(id=>ids.has(id));els.nodes.querySelectorAll('.node[data-id]').forEach(node=>node.classList.toggle('cohabit-pick-selected',active&&chosen.has(node.dataset.id)));count.textContent=`${chosen.size}명 선택`;create.disabled=!chosen.size&&!(state.cohabitMemberIds||[]).length;create.textContent=chosen.size?'생성':'지정 해제';button.classList.toggle('active-tool',active)}
  function stop(){active=false;window.__COHABIT_PICK_MODE__=false;chosen.clear();bar.hidden=true;sync()}
  button.addEventListener('click',()=>{if(!state.people.length){toast('먼저 가계도 구성원을 만들어주세요');return}active=true;window.__COHABIT_PICK_MODE__=true;chosen.clear();(state.cohabitMemberIds||[]).forEach(id=>{if(validIds().has(id))chosen.add(id)});bar.hidden=false;sync();toast('동거가족으로 표시할 구성원을 선택하세요')});
  cancel.addEventListener('click',stop);
  create.addEventListener('click',()=>{state.cohabitMemberIds=[...chosen];state.cohabitSelectionVersion=2;state.cohabitBox=null;save();const hasMembers=chosen.size>0;stop();render();toast(hasMembers?'선택한 구성원으로 동거가족 범위를 만들었습니다':'동거가족 지정을 해제했습니다')});
  els.nodes.addEventListener('pointerdown',event=>{if(!active)return;const node=event.target.closest?.('.node[data-id]');if(!node)return;event.preventDefault();event.stopImmediatePropagation();const id=node.dataset.id;chosen.has(id)?chosen.delete(id):chosen.add(id);sync()},true);
  document.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();stop()}},true);
  function hideLegacyFields(){document.querySelectorAll('.aq-check').forEach(label=>{if(label.querySelector('.aq-co'))label.hidden=true});document.querySelectorAll('.aq-co-sel').forEach(select=>{const field=select.closest('.aq-field');if(field)field.hidden=true})}
  hideLegacyFields();const quickForm=document.querySelector('#quickForm');if(quickForm)new MutationObserver(hideLegacyFields).observe(quickForm,{childList:true,subtree:true});
  const personCohabit=document.querySelector('#personCohabit')?.closest('label');if(personCohabit)personCohabit.hidden=true;
  const baseRender=render;render=function(...args){const result=baseRender.apply(this,args);sync();return result};
  render();
})();
