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

  const pairKey = (a, b) => [a, b].sort().join('|');

  function layout(people, relations) {
    const parents = people.filter(p => p.role === '부' || p.role === '모');
    const children = people.filter(p => p.role === '대상자' || p.role === '자녀');
    const childParents = new Map();
    const bioParentIds = new Set();

    children.forEach(ch => {
      const ids = relations.filter(r => r.type === 'parent' && r.to === ch.id).map(r => r.from);
      childParents.set(ch.id, ids);
      ids.forEach(pid => bioParentIds.add(pid));
    });

    // 공동 부모 관계와 3번 구성원간 관계를 분리해서 계산한다.
    // 핵심 규칙: 아동의 부모선(parent)에 없는 새 배우자/새부모는
    // 생물학적 부모쌍의 가운데에 들어오지 않고 반대편 바깥쪽에 배치한다.
    const coAdj = new Map(parents.map(p => [p.id, new Set()]));
    const adultAdj = new Map(parents.map(p => [p.id, new Set()]));

    childParents.forEach(ids => {
      if (ids.length !== 2) return;
      const a = byId(parents, ids[0]), b = byId(parents, ids[1]);
      if (!a || !b) return;
      coAdj.get(a.id)?.add(b.id);
      coAdj.get(b.id)?.add(a.id);
    });

    relations.forEach(r => {
      if (r.type === 'parent' || r.relationRole === 'parent-child-emotional') return;
      const a = byId(parents, r.from), b = byId(parents, r.to);
      if (!a || !b) return;
      adultAdj.get(a.id)?.add(b.id);
      adultAdj.get(b.id)?.add(a.id);
    });

    const placed = new Set();

    // 재혼/새부모 패턴을 우선 탐지한다.
    // shared parent = 혈연 공동부모가 있으면서, 그 공동부모가 아닌 다른 성인관계 상대도 가진 사람.
    const remarriageCandidates = parents.map(p => {
      const co = [...(coAdj.get(p.id) || [])];
      const adultOnly = [...(adultAdj.get(p.id) || [])].filter(pid => !coAdj.get(p.id)?.has(pid));
      return {p, co, adultOnly};
    }).filter(x => x.co.length && x.adultOnly.length)
      .sort((a,b) => (b.co.length + b.adultOnly.length) - (a.co.length + a.adultOnly.length));

    if (remarriageCandidates.length) {
      const {p: hub, co, adultOnly} = remarriageCandidates[0];
      hub.x = 600;
      hub.y = 225;
      placed.add(hub.id);

      const bioPartners = co.map(pid => byId(people, pid)).filter(Boolean);
      const stepPartners = adultOnly.map(pid => byId(people, pid)).filter(Boolean);

      // 기존 혈연 공동부모는 왼쪽, 새 배우자/새부모는 오른쪽.
      // 여러 명이면 각각 바깥쪽으로 확장한다.
      bioPartners.forEach((p, i) => {
        p.x = Math.max(110, 600 - 270 - i * 210);
        p.y = 225;
        placed.add(p.id);
      });
      stepPartners.forEach((p, i) => {
        p.x = Math.min(1090, 600 + 270 + i * 210);
        p.y = 225;
        placed.add(p.id);
      });
    }

    // 아직 배치되지 않은 공동부모 쌍을 일반 부부 구조로 배치한다.
    const handledPairs = new Set();
    const coPairs = [];
    coAdj.forEach((set, aId) => {
      set.forEach(bId => {
        const key = pairKey(aId, bId);
        if (!handledPairs.has(key)) { handledPairs.add(key); coPairs.push([aId,bId]); }
      });
    });

    const pendingPairs = coPairs.filter(([a,b]) => !(placed.has(a) && placed.has(b)));
    pendingPairs.forEach(([aId,bId], i) => {
      const a = byId(people,aId), b = byId(people,bId);
      if (!a || !b) return;

      if (placed.has(a.id) && !placed.has(b.id)) {
        const dir = a.x <= 600 ? -1 : 1;
        b.x = Math.max(110, Math.min(1090, a.x + dir * 260));
        b.y = 225; placed.add(b.id); return;
      }
      if (!placed.has(a.id) && placed.has(b.id)) {
        const dir = b.x <= 600 ? -1 : 1;
        a.x = Math.max(110, Math.min(1090, b.x + dir * 260));
        a.y = 225; placed.add(a.id); return;
      }

      if (!placed.has(a.id) && !placed.has(b.id)) {
        const center = pendingPairs.length === 1 ? 600 : 220 + i * (760 / Math.max(1,pendingPairs.length-1));
        const father = a.role === '부' ? a : b.role === '부' ? b : a;
        const mother = father === a ? b : a;
        father.x = center - 125; mother.x = center + 125;
        father.y = mother.y = 225;
        placed.add(father.id); placed.add(mother.id);
      }
    });

    // 혈연 공동부모가 없는 일반 성인 관계는 그 다음에 배치한다.
    const adultPairs = [];
    const seenAdult = new Set();
    adultAdj.forEach((set,aId) => set.forEach(bId => {
      const key = pairKey(aId,bId);
      if (!seenAdult.has(key)) { seenAdult.add(key); adultPairs.push([aId,bId]); }
    }));

    adultPairs.forEach(([aId,bId],i) => {
      const a = byId(people,aId), b = byId(people,bId);
      if (!a || !b) return;
      if (placed.has(a.id) && placed.has(b.id)) return;
      if (placed.has(a.id) && !placed.has(b.id)) {
        const hasBioPartner = (coAdj.get(a.id)?.size || 0) > 0;
        const dir = hasBioPartner ? (a.x >= 600 ? 1 : -1) : (a.x < 600 ? 1 : -1);
        b.x = Math.max(110,Math.min(1090,a.x + dir*270)); b.y=225; placed.add(b.id); return;
      }
      if (!placed.has(a.id) && placed.has(b.id)) {
        const hasBioPartner = (coAdj.get(b.id)?.size || 0) > 0;
        const dir = hasBioPartner ? (b.x >= 600 ? 1 : -1) : (b.x < 600 ? 1 : -1);
        a.x = Math.max(110,Math.min(1090,b.x + dir*270)); a.y=225; placed.add(a.id); return;
      }
      const center = 250 + (i % 3) * 350;
      a.x=center-115; b.x=center+115; a.y=b.y=225; placed.add(a.id); placed.add(b.id);
    });

    // 완전히 독립된 부모 노드.
    const singles = parents.filter(p => !placed.has(p.id));
    singles.forEach((p,i) => { p.x = singles.length===1 ? 600 : 150+i*(900/Math.max(1,singles.length-1)); p.y=225; });

    // 자녀 위치는 오직 실제 parent 관계만 사용한다.
    // 따라서 3번의 새엄마/새아빠 관계는 아동의 혈연 부모목록/하위선에 들어가지 않는다.
    const groups = new Map();
    children.forEach(ch => {
      const ids = (childParents.get(ch.id)||[]).slice().sort();
      const key = ids.length ? ids.join('|') : `none:${ch.id}`;
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(ch);
    });

    let orphan=0;
    groups.forEach((group,key) => {
      if (key.startsWith('none:')) {
        group.forEach(ch => { ch.x=200+orphan++*160; ch.y=560; });
        return;
      }
      const ps = key.split('|').map(pid => byId(people,pid)).filter(Boolean);
      const center = ps.reduce((s,p)=>s+p.x,0)/Math.max(1,ps.length);
      const gap = group.length>2 ? 120 : 145;
      group.forEach((ch,i) => {
        ch.x=Math.max(80,Math.min(1120,center+(i-(group.length-1)/2)*gap));
        ch.y=510;
      });
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

    // 3번 구성원간 관계는 성인/가족 관계선만 만든다.
    // parent 타입을 만들지 않으므로 새엄마/새아빠가 아동 혈연 부모로 자동 편입되지 않는다.
    qa('#aqRels .aq-adultrel').forEach(c=>addPairRelation(relations,map.get(c.querySelector('.aq-af')?.value),map.get(c.querySelector('.aq-at')?.value),c.querySelector('.aq-type')?.value));

    layout(people,relations);
    state.people=people;state.relations=relations;state.zoom=1;state.cohabitBox=null;
    save();render();activatePanel('editPanel');toast('새부모를 혈연 부모 반대편에 배치했습니다');
  }

  document.addEventListener('submit', e => {
    if (e.target !== form) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    build();
  }, true);
})();