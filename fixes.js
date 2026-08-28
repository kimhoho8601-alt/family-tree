(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined') return;

  const PARTNERSHIP_TYPES = new Set(['marriage','separated','divorced','distant']);
  const CHILD_ROLES = new Set(['대상자','자녀']);
  const findPerson = pid => state.people.find(p => p.id === pid);
  const isLikelyParentCouple=(a,b)=>!!a&&!!b&&((a.role==='부'&&b.role==='모')||(a.role==='모'&&b.role==='부'));
  const isLikelyCouple=(a,b)=>!!a&&!!b&&(isLikelyParentCouple(a,b)||a.role==='배우자'||b.role==='배우자');

  function alignCouple(a,b,anchorId=null){
    if(!isLikelyCouple(a,b))return false;
    if(a.positionLocked&&b.positionLocked)return false;
    let y;
    if(a.positionLocked&&!b.positionLocked)y=a.y;
    else if(b.positionLocked&&!a.positionLocked)y=b.y;
    else y=anchorId===a.id?a.y:anchorId===b.id?b.y:Math.round((a.y+b.y)/2);
    let changed=false;
    if(!a.positionLocked&&a.y!==y){a.y=y;changed=true}
    if(!b.positionLocked&&b.y!==y){b.y=y;changed=true}
    return changed;
  }
  function partnerRelationsFor(pid){return state.relations.filter(r=>PARTNERSHIP_TYPES.has(r.type)&&(r.from===pid||r.to===pid)&&isLikelyCouple(findPerson(r.from),findPerson(r.to)));}
  function alignPartnersOf(pid){const p=findPerson(pid);if(!p)return false;let changed=false;partnerRelationsFor(pid).forEach(r=>{const x=findPerson(r.from===pid?r.to:r.from);if(x)changed=alignCouple(p,x,pid)||changed});return changed;}
  function normalizeParentDirection(from,to){const a=findPerson(from),b=findPerson(to);if(a&&b&&CHILD_ROLES.has(a.role)&&!CHILD_ROLES.has(b.role))return{from:to,to:from};return{from,to};}

  shapeMarkup=function(p){const outer=p.role==='대상자'?(p.gender==='female'?'<circle class="outer" r="35"/>':'<rect class="outer" x="-35" y="-35" width="70" height="70"/>'):'';const shape=p.gender==='female'?'<circle class="shape" r="29"/>':p.gender==='unknown'?'<rect class="shape" x="-22" y="-22" width="44" height="44" transform="rotate(45)"/>':'<rect class="shape" x="-29" y="-29" width="58" height="58"/>';return`${outer}${shape}<path class="death" d="M-23-23L23 23M23-23L-23 23"/>`;};

  addConnection=function(from,to,type){
    if(type==='parent'){({from,to}=normalizeParentDirection(from,to));if(state.relations.some(r=>r.type==='parent'&&r.from===from&&r.to===to)){toast('이미 등록된 부모–자녀 연결입니다');return false}state.relations.push({id:id(),from,to,type:'parent'});save();render();toast('부모–자녀 연결을 추가했습니다');return true;}
    const pair=r=>(r.from===from&&r.to===to)||(r.from===to&&r.to===from);if(['marriage','separated','divorced'].includes(type))state.relations=state.relations.filter(r=>!(pair(r)&&['marriage','separated','divorced'].includes(r.type)));const a=findPerson(from),b=findPerson(to);if(PARTNERSHIP_TYPES.has(type)&&isLikelyCouple(a,b))alignCouple(a,b);state.relations.push({id:id(),from,to,type});save();render();toast('연결선을 추가했습니다');return true;
  };

  connectUnionToChild=function(parentIds,childId){parentIds.forEach(parentId=>{if(!state.relations.some(r=>r.type==='parent'&&r.from===parentId&&r.to===childId))state.relations.push({id:id(),from:parentId,to:childId,type:'parent'})});save();render();stopConnection();toast('선택한 부모를 자녀와 연결했습니다');};

  renderRelations=function(){
    const parentLinks=state.relations.filter(r=>r.type==='parent'),partnershipTypes=['marriage','separated','divorced','distant'],groups=new Map(),handled=new Set(),strokeFor=t=>t==='conflict'||t==='separated'||t==='divorced'?'#c9002b':'#493d40';
    parentLinks.forEach(link=>{const parents=parentLinks.filter(r=>r.to===link.to).map(r=>r.from).sort(),key=parents.join('|');if(!groups.has(key))groups.set(key,{parentIds:parents,childIds:[]});const g=groups.get(key);if(!g.childIds.includes(link.to))g.childIds.push(link.to)});
    let markup='';
    groups.forEach(group=>{const parents=group.parentIds.map(findPerson).filter(Boolean).sort((a,b)=>a.x-b.x),children=group.childIds.map(findPerson).filter(Boolean).sort((a,b)=>a.x-b.x);if(!parents.length||!children.length)return;const links=parentLinks.filter(r=>group.childIds.includes(r.to)&&group.parentIds.includes(r.from)),childMin=Math.min(...children.map(c=>c.y)),sibY=Math.max(Math.max(...parents.map(p=>p.y))+80,childMin-100);let midX=parents[0].x,midY=parents[0].y;
      if(parents.length>1){const left=parents[0],right=parents[parents.length-1];midX=(left.x+right.x)/2;midY=(left.y+right.y)/2;const couple=state.relations.find(r=>partnershipTypes.includes(r.type)&&group.parentIds.includes(r.from)&&group.parentIds.includes(r.to)),type=couple?.type||'marriage';if(couple)handled.add(couple.id);let marks='';if(type==='separated'||type==='divorced')marks=`<path d="M${midX-7} ${midY-13}l14 26${type==='divorced'?`M${midX+3} ${midY-13}l14 26`:''}" fill="none" stroke="#c9002b" stroke-width="3"/>`;markup+=`<g class="relation-group" ${couple?`data-relation="${couple.id}"`:''}><path d="M${left.x} ${left.y} L${right.x} ${right.y}" class="relation ${type}" fill="none" stroke="${strokeFor(type)}" stroke-width="3" ${type==='distant'?'stroke-dasharray="8 7"':''}/>${marks}<path class="relation-hit" d="M${left.x} ${left.y} L${right.x} ${right.y}" fill="none" stroke="transparent" stroke-width="18"/></g>`;}
      const xs=[midX,...children.map(c=>c.x)],minX=Math.min(...xs),maxX=Math.max(...xs);let d=`M${midX} ${midY} V${sibY}`;if(maxX-minX>.5)d+=` M${minX} ${sibY} H${maxX}`;children.forEach(c=>{d+=` M${c.x} ${sibY} V${c.y}`});markup+=`<g class="relation-group parent-group" data-relations="${links.map(r=>r.id).join(',')}"><path class="relation parent" d="${d}" fill="none" stroke="#493d40" stroke-width="3"/><path class="relation-hit" d="${d}" fill="none" stroke="transparent" stroke-width="18"/></g>`;
    });
    markup+=state.relations.filter(r=>r.type!=='parent'&&!handled.has(r.id)).map(r=>{const a=findPerson(r.from),b=findPerson(r.to);if(!a||!b)return'';let extra='';if(r.type==='separated'||r.type==='divorced'){const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;extra=`<path d="M${mx-7} ${my-12}l14 24${r.type==='divorced'?`M${mx+2} ${my-12}l14 24`:''}" fill="none" stroke="#c9002b" stroke-width="3"/>`;}const d=r.type==='conflict'?zigzag(a,b):`M${a.x} ${a.y} L${b.x} ${b.y}`,dash=r.type==='distant'?'stroke-dasharray="8 7"':'';return`<g data-relation="${r.id}" class="relation-group"><path class="relation ${r.type}" d="${d}" fill="none" stroke="${strokeFor(r.type)}" stroke-width="${r.type==='close'?6:3}" ${dash}/>${extra}<path class="relation-hit" d="${d}" fill="none" stroke="transparent" stroke-width="18"/></g>`}).join('');
    els.relations.innerHTML=markup;els.relations.querySelectorAll('.relation-group').forEach(g=>{g.onclick=e=>{if(!connectMode.delete)return;e.stopPropagation();const ids=g.dataset.relations?.split(',').filter(Boolean)||[g.dataset.relation].filter(Boolean);if(!ids.length)return;state.relations=state.relations.filter(r=>!ids.includes(r.id));save();render();stopConnection();toast('선택한 연결선을 삭제했습니다')}});
  };

  const style=document.createElement('style');style.textContent='.node.proband .outer{stroke:#33272a!important}';document.head.append(style);
  let activeDragId=null,activeDragStart=null;
  els.nodes.addEventListener('pointerdown',e=>{const n=e.target.closest('.node');if(n&&!connectMode.active){const p=findPerson(n.dataset.id);activeDragId=n.dataset.id;activeDragStart=p?{x:p.x,y:p.y}:null}},true);
  els.svg.addEventListener('pointerup',()=>{
    if(!activeDragId)return;
    const p=findPerson(activeDragId),moved=!!(p&&activeDragStart&&(Math.abs(p.x-activeDragStart.x)>.5||Math.abs(p.y-activeDragStart.y)>.5));
    if(moved&&alignPartnersOf(activeDragId)){
      if(typeof window.__historySync==='function')window.__historySync();else save();
      render();
    }
    activeDragId=null;activeDragStart=null;
  });
  render();
})();