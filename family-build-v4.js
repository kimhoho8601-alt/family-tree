(() => {
  const form = document.querySelector('#quickForm');
  if (!form || typeof state === 'undefined') return;
  const qa = s => [...document.querySelectorAll(s)];
  const byId = (arr, id) => arr.find(x => x.id === id);
  const label = (c, fallback) => c?.querySelector('.aq-name')?.value.trim() || fallback;

  function validate(children, parents) {
    const issues = [];
    children.forEach((child, i) => {
      const uid = child.dataset.uid;
      const matches = kind => parents.filter(p => p.dataset.kind === kind && ['all', uid].includes(p.querySelector('.aq-parent-target')?.value));
      const f = matches('father'), m = matches('mother');
      const name = label(child, `아동 ${i + 1}`);
      if (f.length > 1) issues.push(`${name}: 부가 ${f.length}명 지정되어 있습니다. 한 아동의 부는 1명만 선택해주세요.`);
      if (m.length > 1) issues.push(`${name}: 모가 ${m.length}명 지정되어 있습니다. 한 아동의 모는 1명만 선택해주세요.`);
    });
    return issues;
  }

  function addPairRelation(relations, a, b, type) {
    if (!a || !b || a.id === b.id || !type || type === 'none') return;
    for (let i = relations.length - 1; i >= 0; i--) {
      const r = relations[i];
      const same = (r.from === a.id && r.to === b.id) || (r.from === b.id && r.to === a.id);
      if (same && r.type !== 'parent') relations.splice(i, 1);
    }
    relations.push({id:id(), from:a.id, to:b.id, type, relationRole:'adult'});
  }

  function addChildRelation(relations, parent, child, type) {
    if (!parent || !child || !type || type === 'none') return;
    relations.push({id:id(), from:parent.id, to:child.id, type, relationRole:'parent-child-emotional'});
  }

  function layout(people, relations) {
    const parents = people.filter(p => p.role === '부' || p.role === '모');
    const children = people.filter(p => p.role === '대상자' || p.role === '자녀');
    const childParents = new Map();
    children.forEach(ch => childParents.set(ch.id, relations.filter(r => r.type === 'parent' && r.to === ch.id).map(r => r.from)));

    const adjacency = new Map(parents.map(p => [p.id, new Set()]));
    childParents.forEach(ids => {
      if (ids.length !== 2) return;
      adjacency.get(ids[0])?.add(ids[1]);
      adjacency.get(ids[1])?.add(ids[0]);
    });

    const hub = parents.slice().sort((a,b) => (adjacency.get(b.id)?.size||0) - (adjacency.get(a.id)?.size||0))[0];
    const placed = new Set();
    if (hub && (adjacency.get(hub.id)?.size||0) >= 2) {
      hub.x = 600; hub.y = 225; placed.add(hub.id);
      [...adjacency.get(hub.id)].map(pid => byId(people,pid)).filter(Boolean).forEach((p,i) => {
        const step = Math.floor(i/2)+1, side = i%2===0 ? -1 : 1;
        p.x = 600 + side * Math.min(400, 250*step); p.y = 225; placed.add(p.id);
      });
    }

    const unplaced = parents.filter(p => !placed.has(p.id));
    unplaced.forEach((p,i) => { p.x = unplaced.length===1 ? 600 : 180 + i*(840/Math.max(1,unplaced.length-1)); p.y=225; });

    const groups = new Map();
    children.forEach(ch => {
      const ids = (childParents.get(ch.id)||[]).slice().sort();
      const key = ids.length ? ids.join('|') : `none:${ch.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ch);
    });
    let orphan=0;
    groups.forEach((group,key) => {
      if (key.startsWith('none:')) { group.forEach(ch => { ch.x=200+orphan++*160; ch.y=560; }); return; }
      const ps = key.split('|').map(pid => byId(people,pid)).filter(Boolean);
      const center = ps.reduce((s,p)=>s+p.x,0)/Math.max(1,ps.length);
      const gap = group.length>2 ? 120 : 145;
      group.forEach((ch,i)=>{ ch.x=Math.max(80,Math.min(1120,center+(i-(group.length-1)/2)*gap)); ch.y=510; });
    });
  }

  function build() {
    const children = qa('#aqChildren .aq-child');
    const parents = qa('#aqParents .aq-parent');
    const extras = qa('#aqExtras .aq-extra');
    const issues = validate(children, parents);
    if (issues.length) {
      alert(`관계 설정을 확인해주세요.\n\n• ${issues.join('\n• ')}`);
      toast('부모·아동 관계 설정을 확인해주세요');
      return;
    }
    if (state.people.length && !confirm('현재 가계도를 빠른 작성 내용으로 교체할까요?')) return;

    const people=[], relations=[], map=new Map();
    children.forEach((c,i)=>{
      const p={id:id(),name:label(c,`대상아동${i+1}`),role:'대상자',gender:c.querySelector(`input[name="g-${c.dataset.uid}"]:checked`)?.value||'unknown',age:c.querySelector('.aq-age')?.value.trim()||'',life:'alive',cohabit:c.querySelector('.aq-co')?.checked===false?'no':'yes',note:'',x:600,y:510,clientMain:i===0};
      people.push(p);map.set(c.dataset.uid,p);
    });
    parents.forEach(c=>{
      const father=c.dataset.kind==='father';
      const p={id:id(),name:label(c,father?'부':'모'),role:father?'부':'모',gender:father?'male':'female',age:c.querySelector('.aq-age')?.value.trim()||'',life:'alive',cohabit:c.querySelector('.aq-co-sel')?.value||'unknown',note:'',x:father?420:780,y:225};
      people.push(p);map.set(c.dataset.uid,p);
    });
    extras.forEach((c,i)=>{
      const role=c.querySelector('.aq-role')?.value||'기타 친척';
      const p={id:id(),name:label(c,role),role,gender:c.querySelector('.aq-sex')?.value||'unknown',age:c.querySelector('.aq-age')?.value.trim()||'',life:'alive',cohabit:c.querySelector('.aq-co-sel')?.value||'unknown',note:'',x:140+i*145,y:['조부','조모'].includes(role)?80:role==='자녀'?650:role==='형제·자매'?570:390};
      people.push(p);map.set(c.dataset.uid,p);
    });

    parents.forEach(c=>{
      const parent=map.get(c.dataset.uid), target=c.querySelector('.aq-parent-target')?.value;
      const targets=target==='all'?children.map(ch=>map.get(ch.dataset.uid)):[map.get(target)].filter(Boolean);
      const emotional=c.querySelector('.aq-child-rel')?.value||'none';
      targets.forEach(ch=>{
        if (!relations.some(r=>r.type==='parent'&&r.from===parent.id&&r.to===ch.id)) relations.push({id:id(),from:parent.id,to:ch.id,type:'parent'});
        addChildRelation(relations,parent,ch,emotional);
      });
    });

    extras.forEach(c=>{
      const p=map.get(c.dataset.uid), ref=map.get(c.querySelector('.aq-ref')?.value), type=c.querySelector('.aq-link')?.value;
      if(!p||!ref||!type||type==='none')return;
      if(type==='parent-of-ref')relations.push({id:id(),from:p.id,to:ref.id,type:'parent'});
      else if(type==='child-of-ref')relations.push({id:id(),from:ref.id,to:p.id,type:'parent'});
      else if(type==='sibling-of-ref')relations.filter(r=>r.type==='parent'&&r.to===ref.id).forEach(r=>relations.push({id:id(),from:r.from,to:p.id,type:'parent'}));
      else addPairRelation(relations,ref,p,type);
    });

    qa('#aqRels .aq-adultrel').forEach(c=>addPairRelation(relations,map.get(c.querySelector('.aq-af')?.value),map.get(c.querySelector('.aq-at')?.value),c.querySelector('.aq-type')?.value));

    layout(people,relations);
    state.people=people;state.relations=relations;state.zoom=1;state.cohabitBox=null;
    save();render();activatePanel('editPanel');toast('구성원 전체 관계를 반영해 가계도를 만들었습니다');
  }

  document.addEventListener('submit', e => {
    if (e.target !== form) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    build();
  }, true);
})();