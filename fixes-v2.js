(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined') return;

  const PARTNERSHIP_TYPES = new Set(['marriage','separated','divorced','distant']);
  const CHILD_ROLES = new Set(['대상자','자녀']);
  const findPerson = pid => state.people.find(p => p.id === pid);

  function isLikelyParentCouple(a,b){
    return !!a && !!b && ((a.role==='부'&&b.role==='모')||(a.role==='모'&&b.role==='부'));
  }

  function isLikelyCouple(a,b){
    if(!a||!b) return false;
    return isLikelyParentCouple(a,b) || a.role==='배우자' || b.role==='배우자';
  }

  function alignCouple(a,b,anchorId=null){
    if(!isLikelyCouple(a,b)) return false;
    const y=anchorId===a.id?a.y:anchorId===b.id?b.y:Math.round((a.y+b.y)/2);
    let changed=false;
    if(a.y!==y){a.y=y;changed=true;}
    if(b.y!==y){b.y=y;changed=true;}
    return changed;
  }

  function partnerRelationsFor(pid){
    return state.relations.filter(r=>{
      if(!PARTNERSHIP_TYPES.has(r.type)) return false;
      if(r.from!==pid&&r.to!==pid) return false;
      return isLikelyCouple(findPerson(r.from),findPerson(r.to));
    });
  }

  function alignPartnersOf(pid){
    const person=findPerson(pid);if(!person)return false;
    let changed=false;
    partnerRelationsFor(pid).forEach(r=>{
      const partner=findPerson(r.from===pid?r.to:r.from);
      if(partner) changed=alignCouple(person,partner,pid)||changed;
    });
    return changed;
  }

  function normalizeParentDirection(from,to){
    const a=findPerson(from),b=findPerson(to);
    if(!a||!b) return {from,to};
    if(CHILD_ROLES.has(a.role)&&!CHILD_ROLES.has(b.role)) return {from:to,to:from};
    return {from,to};
  }

  shapeMarkup=function(p){
    const outer=p.role==='대상자'
      ? p.gender==='female' ? '<circle class="outer" r="35"/>' : '<rect class="outer" x="-35" y="-35" width="70" height="70"/>'
      : '';
    const shape=p.gender==='female'
      ? '<circle class="shape" r="29"/>'
      : p.gender==='unknown'
        ? '<rect class="shape" x="-22" y="-22" width="44" height="44" transform="rotate(45)"/>'
        : '<rect class="shape" x="-29" y="-29" width="58" height="58"/>';
    return `${outer}${shape}<path class="death" d="M-23-23L23 23M23-23L-23 23"/>`;
  };

  addConnection=function(from,to,type){
    if(type==='parent'){
      ({from,to}=normalizeParentDirection(from,to));
      if(state.relations.some(r=>r.type==='parent'&&r.from===from&&r.to===to)){
        toast('이미 등록된 부모–자녀 연결입니다');
        return false;
      }
      state.relations.push({id:id(),from,to,type:'parent'});
      save();render();toast('부모–자녀 연결을 추가했습니다');
      return true;
    }

    const pair=r=>(r.from===from&&r.to===to)||(r.from===to&&r.to===from);
    if(['marriage','separated','divorced'].includes(type)){
      state.relations=state.relations.filter(r=>!(pair(r)&&['marriage','separated','divorced'].includes(r.type)));
    }
    const a=findPerson(from),b=findPerson(to);
    if(PARTNERSHIP_TYPES.has(type)&&isLikelyCouple(a,b)) alignCouple(a,b);
    state.relations.push({id:id(),from,to,type});
    save();render();toast('연결선을 추가했습니다');
    return true;
  };

  connectUnionToChild=function(parentIds,childId){
    parentIds.forEach(parentId=>{
      if(!state.relations.some(r=>r.type==='parent'&&r.from===parentId&&r.to===childId)){
        state.relations.push({id:id(),from:parentId,to:childId,type:'parent'});
      }
    });
    save();render();stopConnection();toast('선택한 부모를 자녀와 연결했습니다');
  };

  renderRelations=function(){
    const parentLinks=state.relations.filter(r=>r.type==='parent');
    const partnershipTypes=['marriage','separated','divorced','distant'];
    const groups=new Map(),handled=new Set();
    const strokeFor=t=>t==='conflict'||t==='separated'||t==='divorced'?'#c9002b':'#493d40';

    parentLinks.forEach(link=>{
      const parents=parentLinks.filter(r=>r.to===link.to).map(r=>r.from).sort();
      const key=parents.join('|');
      if(!groups.has(key)) groups.set(key,{parentIds:parents,childIds:[]});
      const group=groups.get(key);
      if(!group.childIds.includes(link.to)) group.childIds.push(link.to);
    });

    let markup='';

    groups.forEach(group=>{
      const parents=group.parentIds.map(findPerson).filter(Boolean).sort((a,b)=>a.x-b.x);
      const children=group.childIds.map(findPerson).filter(Boolean).sort((a,b)=>a.x-b.x);
      if(!parents.length||!children.length) return;

      const links=parentLinks.filter(r=>group.childIds.includes(r.to)&&group.parentIds.includes(r.from));
      const childMin=Math.min(...children.map(c=>c.y));
      const sibY=Math.max(Math.max(...parents.map(p=>p.y))+80,childMin-100);
      let midX=parents[0].x,midY=parents[0].y;

      if(parents.length>1){
        const left=parents[0],right=parents[parents.length-1];
        midX=(left.x+right.x)/2;midY=(left.y+right.y)/2;
        const couple=state.relations.find(r=>partnershipTypes.includes(r.type)&&group.parentIds.includes(r.from)&&group.parentIds.includes(r.to));
        const type=couple?.type||'marriage';
        if(couple) handled.add(couple.id);
        let marks='';
        if(type==='separated'||type==='divorced'){
          marks=`<path d="M${midX-7} ${midY-13}l14 26${type==='divorced'?`M${midX+3} ${midY-13}l14 26`:''}" fill="none" stroke="#c9002b" stroke-width="3"/>`;
        }
        markup+=`<g class="relation-group" ${couple?`data-relation="${couple.id}"`:''}><path d="M${left.x} ${left.y} L${right.x} ${right.y}" class="relation ${type}" fill="none" stroke="${strokeFor(type)}" stroke-width="3" ${type==='distant'?'stroke-dasharray="8 7"':''}/>${marks}<path class="relation-hit" d="M${left.x} ${left.y} L${right.x} ${right.y}" fill="none" stroke="transparent" stroke-width="18"/></g>`;
      }

      const branchXs=[midX,...children.map(c=>c.x)],minX=Math.min(...branchXs),maxX=Math.max(...branchXs);
      let d=`M${midX} ${midY} V${sibY}`;
      if(maxX-minX>.5)d+=` M${minX} ${sibY} H${maxX}`;
      children.forEach(c=>{d+=` M${c.x} ${sibY} V${c.y}`;});
      markup+=`<g class="relation-group parent-group" data-relations="${links.map(r=>r.id).join(',')}"><path class="relation parent" d="${d}" fill="none" stroke="#493d40" stroke-width="3"/><path class="relation-hit" d="${d}" fill="none" stroke="transparent" stroke-width="18"/></g>`;
    });

    markup+=state.relations.filter(r=>r.type!=='parent'&&!handled.has(r.id)).map(r=>{
      const a=findPerson(r.from),b=findPerson(r.to);if(!a||!b)return'';
      let extra='';
      if(r.type==='separated'||r.type==='divorced'){
        const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
        extra=`<path d="M${mx-7} ${my-12}l14 24${r.type==='divorced'?`M${mx+2} ${my-12}l14 24`:''}" fill="none" stroke="#c9002b" stroke-width="3"/>`;
      }
      const d=r.type==='conflict'?zigzag(a,b):`M${a.x} ${a.y} L${b.x} ${b.y}`;
      const dash=r.type==='distant'?'stroke-dasharray="8 7"':'';
      return `<g data-relation="${r.id}" class="relation-group"><path class="relation ${r.type}" d="${d}" fill="none" stroke="${strokeFor(r.type)}" stroke-width="${r.type==='close'?6:3}" ${dash}/>${extra}<path class="relation-hit" d="${d}" fill="none" stroke="transparent" stroke-width="18"/></g>`;
    }).join('');

    els.relations.innerHTML=markup;
    els.relations.querySelectorAll('.relation-group').forEach(g=>{
      g.onclick=e=>{
        if(!connectMode.delete)return;
        e.stopPropagation();
        const ids=g.dataset.relations?.split(',').filter(Boolean)||[g.dataset.relation].filter(Boolean);
        if(!ids.length)return;
        state.relations=state.relations.filter(r=>!ids.includes(r.id));
        save();render();stopConnection();toast('선택한 연결선을 삭제했습니다');
      };
    });
  };

  function installDownloadFix(){
    const button=document.querySelector('#downloadBtn');if(!button)return;
    button.onclick=()=>{
      if(!state.people.length){toast('저장할 가계도가 없습니다');return;}
      const clone=els.svg.cloneNode(true);
      clone.style.transform='';clone.setAttribute('width','1200');clone.setAttribute('height','720');
      clone.querySelector('.canvas-grid')?.remove();
      clone.querySelectorAll('.junction-handle,.relation-hit,.cohabit-resize-handle,.cohabit-move-handle,.cohabit-move-label,.cohabit-hint,.smart-guide-layer,.editor-only').forEach(el=>el.remove());
      clone.querySelectorAll('.cohabit-boundary-v3 text').forEach(el=>el.remove());
      const css=document.createElementNS(svgNS,'style');
      css.textContent=`
        .node .shape{fill:white;stroke:#33272a;stroke-width:3}
        .node .outer{fill:none;stroke:#33272a;stroke-width:3}
        .node .death{display:none;stroke:#c9002b;stroke-width:3}
        .node.dead .death{display:block}
        .node-label{font:600 14px sans-serif;fill:#241b1d;text-anchor:middle}
        .node-meta{font:11px sans-serif;fill:#746a6c;text-anchor:middle}
        .relation{fill:none;stroke:#5c5053;stroke-width:2.5}
        .relation.parent{stroke:#493d40;stroke-width:3}
        .relation.close{stroke-width:6}
        .relation.distant{stroke-dasharray:8 7}
        .relation.conflict{stroke:#c9002b}
        .cohabit-boundary-v3 rect:not(.cohabit-resize-handle){fill:none;stroke:#33272a;stroke-width:2.5}
      `;
      clone.prepend(css);
      const xml=new XMLSerializer().serializeToString(clone),img=new Image(),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));
      img.onload=()=>{
        const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1440;
        const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.drawImage(img,0,0);URL.revokeObjectURL(url);
        canvas.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`가계도_${new Date().toISOString().slice(0,10)}.png`;a.click();URL.revokeObjectURL(a.href);toast('PNG 파일로 저장했습니다');},'image/png');
      };
      img.src=url;
    };
  }

  const style=document.createElement('style');
  style.textContent=`.node.proband .outer{stroke:#33272a!important}`;
  document.head.append(style);

  let activeDragId=null;
  els.nodes.addEventListener('pointerdown',e=>{const node=e.target.closest('.node');if(node&&!connectMode.active)activeDragId=node.dataset.id;},true);
  els.svg.addEventListener('pointerup',()=>{
    if(!activeDragId)return;
    if(alignPartnersOf(activeDragId)){save();render();}
    activeDragId=null;
  });

  render();
  installDownloadFix();
})();