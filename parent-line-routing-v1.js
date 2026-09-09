(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || typeof renderRelations !== 'function') return;

  document.documentElement.dataset.parentLineRouting = 'v1';

  const structuralPartnerTypes = ['marriage','separated','divorced','distant'];
  const findPerson = pid => state.people.find(p => p.id === pid);
  const strokeFor = type => type === 'conflict' || type === 'separated' || type === 'divorced' ? '#c9002b' : '#493d40';

  function zigzagPath(a,b){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy));
    const nx=-dy/len*5,ny=dx/len*5,steps=Math.max(6,Math.floor(len/12));
    let d=`M${a.x} ${a.y}`;
    for(let i=1;i<steps;i++){
      const t=i/steps,s=i%2?1:-1;
      d+=` L${a.x+dx*t+nx*s} ${a.y+dy*t+ny*s}`;
    }
    return d+` L${b.x} ${b.y}`;
  }

  function offsetPath(a,b,offset){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy));
    const ox=-dy/len*offset,oy=dx/len*offset;
    return `M${a.x+ox} ${a.y+oy} L${b.x+ox} ${b.y+oy}`;
  }

  function emotionalMarkup(type,a,b,d){
    if(type==='enmeshed'){
      return [-6,0,6].map(offset=>`<path class="relation enmeshed" d="${offsetPath(a,b,offset)}" fill="none" stroke="#493d40" stroke-width="2.4"/>`).join('');
    }
    if(type==='close_conflict'){
      return `<path class="relation close-conflict-base" d="${d}" fill="none" stroke="#493d40" stroke-width="6"/><path class="relation close-conflict-zigzag" d="${zigzagPath(a,b)}" fill="none" stroke="#c9002b" stroke-width="2.5"/>`;
    }
    if(type==='cutoff'){
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1,Math.hypot(dx,dy)),mx=(a.x+b.x)/2,my=(a.y+b.y)/2,nx=-dy/len*10,ny=dx/len*10;
      return `<path class="relation cutoff" d="${d}" fill="none" stroke="#493d40" stroke-width="2.5" stroke-dasharray="18 7"/><path d="M${mx+nx} ${my+ny} L${mx-nx} ${my-ny}" fill="none" stroke="#c9002b" stroke-width="3"/>`;
    }
    const path=type==='conflict'?zigzagPath(a,b):d;
    const dash=type==='distant'?'stroke-dasharray="8 7"':'';
    return `<path class="relation ${type}" d="${path}" fill="none" stroke="${strokeFor(type)}" stroke-width="${type==='close'?6:3}" ${dash}/>`;
  }

  function safeJunctionY(parentY, childY){
    // A child line should always leave the parent generation downward.
    // Keep enough room under the parent symbols and above the child symbols.
    const minBelowParent = parentY + 72;
    const maxAboveChild = childY - 72;
    if (maxAboveChild >= minBelowParent) {
      return Math.round((minBelowParent + maxAboveChild) / 2);
    }
    // If people were manually dragged too close, never route above the parent.
    return Math.round(minBelowParent);
  }

  renderRelations = function(){
    const parentLinks = state.relations.filter(r => r.type === 'parent');
    const groups = new Map();
    const handled = new Set();

    parentLinks.forEach(link => {
      const parentIds = parentLinks.filter(r => r.to === link.to).map(r => r.from).sort();
      const key = parentIds.join('|');
      if (!groups.has(key)) groups.set(key,{parentIds,childIds:[]});
      const group=groups.get(key);
      if(!group.childIds.includes(link.to)) group.childIds.push(link.to);
    });

    let markup='';

    groups.forEach(group => {
      const parents=group.parentIds.map(findPerson).filter(Boolean).sort((a,b)=>a.x-b.x);
      const children=group.childIds.map(findPerson).filter(Boolean).sort((a,b)=>a.x-b.x);
      if(!parents.length||!children.length)return;

      const links=parentLinks.filter(r=>group.childIds.includes(r.to)&&group.parentIds.includes(r.from));
      const maxParentY=Math.max(...parents.map(p=>p.y));
      const childTopY=Math.min(...children.map(c=>c.y));
      const junctionY=safeJunctionY(maxParentY,childTopY);

      let startX=parents[0].x;
      let startY=parents[0].y;

      if(parents.length>1){
        const left=parents[0],right=parents[parents.length-1];
        const couple=state.relations.find(r=>structuralPartnerTypes.includes(r.type)&&group.parentIds.includes(r.from)&&group.parentIds.includes(r.to));
        const type=couple?.type||'marriage';
        if(couple)handled.add(couple.id);

        startX=(left.x+right.x)/2;
        startY=(left.y+right.y)/2;

        let marks='';
        if(type==='separated'||type==='divorced'){
          marks=`<path d="M${startX-7} ${startY-13}l14 26${type==='divorced'?`M${startX+3} ${startY-13}l14 26`:''}" fill="none" stroke="#c9002b" stroke-width="3"/>`;
        }
        markup+=`<g class="relation-group" ${couple?`data-relation="${couple.id}"`:`data-implicit-couple="${left.id}|${right.id}"`}><path d="M${left.x} ${left.y} L${right.x} ${right.y}" class="relation ${type}" fill="none" stroke="${strokeFor(type)}" stroke-width="3" ${type==='distant'?'stroke-dasharray="8 7"':''}/>${marks}<path class="relation-hit" d="M${left.x} ${left.y} L${right.x} ${right.y}" fill="none" stroke="transparent" stroke-width="18"/></g>`;
      }

      const minChildX=Math.min(startX,...children.map(c=>c.x));
      const maxChildX=Math.max(startX,...children.map(c=>c.x));

      // Important: start at the actual parent / couple midpoint and move DOWN first.
      // This prevents the child connector from jumping above the parent row or tracing the cohabitation box edge.
      let d=`M${startX} ${startY} V${junctionY}`;
      if(maxChildX-minChildX>1)d+=` M${minChildX} ${junctionY} H${maxChildX}`;
      children.forEach(child=>{
        d+=` M${child.x} ${junctionY} V${child.y}`;
      });

      markup+=`<g class="relation-group parent-group" data-relations="${links.map(r=>r.id).join(',')}"><path class="relation parent" d="${d}" fill="none" stroke="#493d40" stroke-width="3"/><path class="relation-hit" d="${d}" fill="none" stroke="transparent" stroke-width="18"/></g>`;
    });

    markup+=state.relations.filter(r=>r.type!=='parent'&&!handled.has(r.id)).map(r=>{
      const a=findPerson(r.from),b=findPerson(r.to);
      if(!a||!b)return'';
      let extra='';
      if(r.type==='separated'||r.type==='divorced'){
        const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
        extra=`<path d="M${mx-7} ${my-12}l14 24${r.type==='divorced'?`M${mx+2} ${my-12}l14 24`:''}" fill="none" stroke="#c9002b" stroke-width="3"/>`;
      }
      const d=`M${a.x} ${a.y} L${b.x} ${b.y}`;
      return `<g data-relation="${r.id}" class="relation-group">${emotionalMarkup(r.type,a,b,d)}${extra}<path class="relation-hit" d="${d}" fill="none" stroke="transparent" stroke-width="22"/></g>`;
    }).join('');

    els.relations.innerHTML=markup;
    els.relations.querySelectorAll('.relation-group').forEach(g=>g.onclick=e=>{
      if(!connectMode.delete)return;
      e.stopPropagation();
      const ids=g.dataset.relations?.split(',').filter(Boolean)||[g.dataset.relation].filter(Boolean);
      if(!ids.length)return;
      state.relations=state.relations.filter(r=>!ids.includes(r.id));
      save();render();stopConnection();toast('선택한 연결선을 삭제했습니다');
    });
  };

  // 부모-자녀 구조 때문에 화면에만 생긴 기본 부부선도 선택하는 즉시
  // 실제 관계 데이터로 등록해 삭제 후 다시 그린 선을 바로 수정할 수 있게 한다.
  els.relations.addEventListener('click', event => {
    const group = event.target.closest?.('.relation-group[data-implicit-couple]');
    if (!group || connectMode.delete || connectMode.active) return;
    const [from, to] = group.dataset.implicitCouple.split('|');
    if (!findPerson(from) || !findPerson(to)) return;
    let relation = state.relations.find(item => structuralPartnerTypes.includes(item.type) && ((item.from === from && item.to === to) || (item.from === to && item.to === from)));
    if (!relation) {
      relation = { id: id(), from, to, type: 'marriage' };
      state.relations.push(relation);
      save();
      render();
    }
    selectedRelationIds = [relation.id];
    els.relations.querySelector(`.relation-group[data-relation="${relation.id}"]`)?.classList.add('relation-selected');
    event.preventDefault();
    event.stopImmediatePropagation();
    toast('기본 부부선을 선택했습니다. 선 수정으로 변경할 수 있습니다');
  }, true);

  // Re-render once so existing saved diagrams immediately use the corrected path.
  render();
})();
