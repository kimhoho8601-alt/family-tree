(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || typeof save !== 'function' || typeof render !== 'function') return;

  document.documentElement.dataset.finalStability = 'v1';

  const CHILD_ROLES = new Set(['대상자','자녀']);
  const PARENTISH_ROLES = new Set(['부','모','조부','조모','보호자·동거인','배우자']);
  const VALID_LIFE = new Set(['alive','dead','unknown']);
  const VALID_COHABIT = new Set(['yes','no','unknown']);
  const VALID_GENDER = new Set(['male','female','unknown']);
  const VALID_RELATION = new Set(['marriage','parent','separated','divorced','distant','close','conflict']);
  const STRUCTURAL_PARTNER = new Set(['marriage','separated','divorced']);
  const findPerson = id => state.people.find(p => p.id === id);
  const clampX = x => Math.max(55, Math.min(1145, x));
  const clampY = y => Math.max(55, Math.min(665, y));

  function selectedIds() {
    return [...els.nodes.querySelectorAll('.node.multi-selected')].map(n => n.dataset.id).filter(Boolean);
  }

  function roleRow(p) {
    if (['조부','조모'].includes(p.role)) return 110;
    if (['부','모'].includes(p.role)) return 240;
    if (p.role === '자녀') return 650;
    if (['대상자','형제·자매','배우자'].includes(p.role)) return 500;
    return 390;
  }

  function freeSlotsForRow(y, locked, count) {
    const candidates=[];
    for(let x=120;x<=1080;x+=120)candidates.push(x);
    const free=candidates.filter(x=>!locked.some(p=>Math.abs(p.y-y)<85&&Math.abs(p.x-x)<105));
    if(free.length>=count)return free;
    return candidates;
  }

  function distributeAvoidingLocks(items,y) {
    const movable=items.filter(p=>!p.positionLocked).sort((a,b)=>a.x-b.x);
    const locked=state.people.filter(p=>p.positionLocked);
    if(!movable.length)return;
    const slots=freeSlotsForRow(y,locked,movable.length);
    const chosen=slots.length===1?[slots[0]]:Array.from({length:movable.length},(_,i)=>slots[Math.round(i*(slots.length-1)/Math.max(1,movable.length-1))]);
    movable.forEach((p,i)=>{p.x=clampX(chosen[i]??(180+i*160));p.y=clampY(y)});
  }

  function arrangeAll() {
    if(!state.people.length){toast('정렬할 구성원이 없습니다');return;}
    const rows=new Map();
    state.people.forEach(p=>{const y=roleRow(p);if(!rows.has(y))rows.set(y,[]);rows.get(y).push(p)});
    rows.forEach((items,y)=>distributeAvoidingLocks(items,Number(y)));

    const children=state.people.filter(p=>CHILD_ROLES.has(p.role));
    const groups=new Map();
    children.forEach(child=>{
      const parentIds=state.relations.filter(r=>r.type==='parent'&&r.to===child.id).map(r=>r.from).sort();
      if(!parentIds.length)return;
      const key=parentIds.join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(child);
    });
    groups.forEach((siblings,key)=>{
      const parents=key.split('|').map(findPerson).filter(Boolean);if(!parents.length)return;
      const movable=siblings.filter(p=>!p.positionLocked).sort((a,b)=>a.x-b.x);if(!movable.length)return;
      const locked=state.people.filter(p=>p.positionLocked);
      const center=parents.reduce((s,p)=>s+p.x,0)/parents.length;
      const gap=movable.length>3?115:145;
      movable.forEach((p,i)=>{
        let x=clampX(center+(i-(movable.length-1)/2)*gap),y=p.role==='자녀'?650:500;
        let tries=0;
        while(locked.some(l=>Math.abs(l.y-y)<80&&Math.abs(l.x-x)<105)&&tries<6){x=clampX(x+(i%2===0?1:-1)*(120+tries*35));tries++}
        p.x=x;p.y=y;
      });
    });

    // Auto-arrange invalidates the manually adjusted cohabiting boundary.
    // The next render recalculates it from current cohabiting members.
    state.cohabitBox=null;
    save();render();toast('가계도 전체를 정리했습니다');
  }

  function arrangeSelected() {
    const people=selectedIds().map(findPerson).filter(p=>p&&!p.positionLocked);
    if(people.length<2){toast('Shift로 구성원을 2명 이상 선택해주세요');return;}
    const clusters=[];
    people.slice().sort((a,b)=>a.y-b.y).forEach(p=>{
      const c=clusters[clusters.length-1];
      if(!c||Math.abs(p.y-c.avgY)>75)clusters.push({items:[p],avgY:p.y});
      else{c.items.push(p);c.avgY=c.items.reduce((s,x)=>s+x.y,0)/c.items.length}
    });
    clusters.forEach(c=>{
      const items=c.items.sort((a,b)=>a.x-b.x),y=Math.round(c.avgY),locked=state.people.filter(p=>p.positionLocked);
      let minX=Math.min(...items.map(p=>p.x)),maxX=Math.max(...items.map(p=>p.x));
      if(maxX-minX<160*(items.length-1)){const center=(minX+maxX)/2,w=160*(items.length-1);minX=center-w/2;maxX=center+w/2}
      const step=(maxX-minX)/Math.max(1,items.length-1);
      items.forEach((p,i)=>{
        let x=clampX(minX+step*i),tries=0;
        while(locked.some(l=>Math.abs(l.y-y)<80&&Math.abs(l.x-x)<105)&&tries<6){x=clampX(x+120);tries++}
        p.x=x;p.y=clampY(y);
      });
    });
    state.cohabitBox=null;
    save();render();toast('선택한 구성원을 동일 간격으로 정렬했습니다');
  }

  const arrangeBtn=document.querySelector('#autoArrangeBtn');
  const arrangePopover=document.querySelector('#arrangePopover');
  if(arrangeBtn&&arrangePopover){
    arrangeBtn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();arrangePopover.classList.toggle('show')},true);
    arrangePopover.addEventListener('click',e=>{
      const type=e.target.closest('[data-arrange]')?.dataset.arrange;if(!type)return;
      e.preventDefault();e.stopImmediatePropagation();arrangePopover.classList.remove('show');
      type==='all'?arrangeAll():arrangeSelected();
    },true);
  }

  function audit() {
    const issues=[],personIds=new Set();
    state.people.forEach((p,i)=>{
      if(!p.id||personIds.has(p.id))issues.push({level:'error',text:`구성원 ${i+1}: 식별 ID가 없거나 중복되어 있습니다.`});
      personIds.add(p.id);
      if(!VALID_LIFE.has(p.life))issues.push({level:'warn',text:`${p.name||'구성원'}: 생존 상태값이 올바르지 않습니다 (${p.life||'없음'}).`});
      if(!VALID_COHABIT.has(p.cohabit))issues.push({level:'warn',text:`${p.name||'구성원'}: 동거 상태값이 올바르지 않습니다.`});
      if(!VALID_GENDER.has(p.gender))issues.push({level:'warn',text:`${p.name||'구성원'}: 성별 상태값이 올바르지 않습니다.`});
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y))issues.push({level:'error',text:`${p.name||'구성원'}: 화면 위치 좌표가 손상되었습니다.`});
    });
    if(!state.people.some(p=>p.role==='대상자'))issues.push({level:'warn',text:'대상자로 지정된 구성원이 없습니다.'});

    const relationKeys=new Set();
    state.relations.forEach((r,i)=>{
      const a=findPerson(r.from),b=findPerson(r.to);
      if(!a||!b)issues.push({level:'error',text:`관계 ${i+1}: 존재하지 않는 구성원을 참조하는 연결선이 있습니다.`});
      if(r.from===r.to)issues.push({level:'error',text:`${a?.name||'구성원'}: 자기 자신에게 연결된 관계선이 있습니다.`});
      if(!VALID_RELATION.has(r.type))issues.push({level:'warn',text:`${a?.name||'구성원'} ↔ ${b?.name||'구성원'}: 알 수 없는 관계선 값(${r.type})이 있습니다.`});
      const key=`${r.type}:${r.from}:${r.to}`;if(relationKeys.has(key))issues.push({level:'warn',text:`${a?.name||'구성원'} → ${b?.name||'구성원'}: 같은 관계선이 중복 등록되어 있습니다.`});relationKeys.add(key);
      if(r.type==='parent'&&a&&b){
        // Only flag a clearly reversed generation direction. Grandparent→parent and parent→sibling are valid.
        if(CHILD_ROLES.has(a.role)&&PARENTISH_ROLES.has(b.role))issues.push({level:'error',text:`${a.name} → ${b.name}: 부모→자녀 방향이 반대로 연결되어 있을 가능성이 높습니다.`});
      }
    });

    state.people.filter(p=>CHILD_ROLES.has(p.role)).forEach(child=>{
      const parents=state.relations.filter(r=>r.type==='parent'&&r.to===child.id).map(r=>findPerson(r.from)).filter(Boolean);
      const fathers=parents.filter(p=>p.role==='부'),mothers=parents.filter(p=>p.role==='모');
      if(fathers.length>1)issues.push({level:'error',text:`${child.name}: '부'가 ${fathers.length}명 부모로 연결되어 있습니다.`});
      if(mothers.length>1)issues.push({level:'error',text:`${child.name}: '모'가 ${mothers.length}명 부모로 연결되어 있습니다.`});
      if(parents.length>2)issues.push({level:'warn',text:`${child.name}: 부모선이 총 ${parents.length}개 연결되어 있습니다.`});
    });

    const pairStructural=new Map();
    state.relations.filter(r=>STRUCTURAL_PARTNER.has(r.type)).forEach(r=>{const key=[r.from,r.to].sort().join('|');if(!pairStructural.has(key))pairStructural.set(key,[]);pairStructural.get(key).push(r)});
    pairStructural.forEach(list=>{if(list.length>1){const a=findPerson(list[0].from),b=findPerson(list[0].to);issues.push({level:'warn',text:`${a?.name||'구성원'} ↔ ${b?.name||'구성원'}: 부부/별거/이혼 상태가 중복 등록되어 있습니다.`})}});
    if(state.cohabitBox&&![state.cohabitBox.x,state.cohabitBox.y,state.cohabitBox.w,state.cohabitBox.h].every(Number.isFinite))issues.push({level:'warn',text:'동거가족 테두리 위치 데이터가 손상되어 있습니다.'});
    return issues;
  }

  const auditBtn=document.querySelector('#auditBtn');
  const auditDialog=document.querySelector('.tool-dialog #auditBody')?.closest('dialog');
  if(auditBtn&&auditDialog){
    auditBtn.onclick=()=>{
      const issues=audit(),body=auditDialog.querySelector('#auditBody');
      if(!issues.length)body.innerHTML='<div class="audit-summary">✓ 현재 확인된 관계 충돌이 없습니다.</div><p style="margin:0;color:#807275;font-size:11px;line-height:1.6">구성원 상태값, 부모 방향, 중복 부모·관계선, 연결 대상과 좌표를 점검했습니다.</p>';
      else{const errors=issues.filter(x=>x.level==='error').length,warns=issues.length-errors;body.innerHTML=`<div class="audit-summary">점검 결과 · 오류 ${errors}건 · 확인 ${warns}건</div><div class="audit-list">${issues.map(x=>`<div class="audit-item ${x.level}">${x.level==='error'?'⚠':'•'} ${esc(x.text)}</div>`).join('')}</div>`}
      auditDialog.showModal();
    };
  }

  // Guarantee correct death-mark visibility in the cloned SVG used for PNG export.
  document.querySelector('#downloadBtn')?.addEventListener('click',()=>{
    const marks=[...els.nodes.querySelectorAll('.node')].map(node=>({mark:node.querySelector('.death'),dead:node.classList.contains('dead')})).filter(x=>x.mark);
    const previous=marks.map(x=>x.mark.style.display);
    marks.forEach(x=>x.mark.style.display=x.dead?'block':'none');
    requestAnimationFrame(()=>marks.forEach((x,i)=>x.mark.style.display=previous[i]));
  },true);
})();