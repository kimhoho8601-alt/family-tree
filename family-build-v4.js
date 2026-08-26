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

  function parentPairKey(a, b) {
    return [a, b].sort().join('|');
  }

  function layout(people, relations) {
    const parents = people.filter(p => p.role === '부' || p.role === '모');
    const children = people.filter(p => p.role === '대상자' || p.role === '자녀');
    const childParents = new Map();
    children.forEach(ch => childParents.set(ch.id, relations.filter(r => r.type === 'parent' && r.to === ch.id).map(r => r.from)));

    // 부모 네트워크는 두 가지 근거를 함께 사용한다.
    // 1) 같은 아동의 공동 부모, 2) 3번 '구성원간 관계'에서 지정한 부모-부모 관계.
    // 재혼/새부모처럼 아동과 혈연선이 없어도 배우자 관계가 있으면 배치에 반영된다.
    const adjacency = new Map(parents.map(p => [p.id, new Set()]));
    const pairEvidence = new Map();
    const addEdge = (aId, bId, source) => {
      const a = byId(parents, aId), b = byId(parents, bId);
      if (!a || !b || aId === bId) return;
      adjacency.get(aId)?.add(bId);
      adjacency.get(bId)?.add(aId);
      const key = parentPairKey(aId, bId);
      if (!pairEvidence.has(key)) pairEvidence.set(key, new Set());
      pairEvidence.get(key).add(source);
    };

    childParents.forEach(ids => {
      if (ids.length !== 2) return;
      addEdge(ids[0], ids[1], 'co-parent');
    });

    relations.forEach(r => {
      if (r.type === 'parent' || r.relationRole === 'parent-child-emotional') return;
      const a = byId(parents, r.from), b = byId(parents, r.to);
      if (!a || !b) return;
      addEdge(a.id, b.id, 'adult-relation');
    });

    // 연결 상대가 가장 많은 부모를 허브로 둔다.
    // 부 1 + 모 2 => 부 중앙 / 모 좌우, 모 1 + 부 2 => 모 중앙 / 부 좌우.
    const hub = parents.slice().sort((a, b) => {
      const da = adjacency.get(a.id)?.size || 0;
      const db = adjacency.get(b.id)?.size || 0;
      if (db !== da) return db - da;
      return a.role === '부' ? -1 : 1;
    })[0];
    const placed = new Set();

    if (hub && (adjacency.get(hub.id)?.size || 0) >= 2) {
      hub.x = 600;
      hub.y = 225;
      placed.add(hub.id);

      const partners = [...adjacency.get(hub.id)]
        .map(pid => byId(people, pid))
        .filter(Boolean)
        .sort((a, b) => {
          // 공동 자녀가 있는 관계를 먼저 배치하고, 이후 새 배우자를 반대쪽으로 배치한다.
          const ea = pairEvidence.get(parentPairKey(hub.id, a.id));
          const eb = pairEvidence.get(parentPairKey(hub.id, b.id));
          const ca = ea?.has('co-parent') ? 1 : 0;
          const cb = eb?.has('co-parent') ? 1 : 0;
          return cb - ca;
        });

      partners.forEach((p, i) => {
        const step = Math.floor(i / 2) + 1;
        // 첫 상대는 왼쪽, 새 상대는 오른쪽, 이후 바깥쪽으로 확장.
        const side = i % 2 === 0 ? -1 : 1;
        p.x = 600 + side * Math.min(430, 270 * step);
        p.y = 225;
        placed.add(p.id);
      });
    }

    // 허브가 1개의 상대만 가지는 일반 가족도 부부가 서로 붙어 있도록 배치한다.
    if (hub && !placed.has(hub.id) && (adjacency.get(hub.id)?.size || 0) === 1) {
      const partnerId = [...adjacency.get(hub.id)][0];
      const partner = byId(people, partnerId);
      if (partner) {
        const male = hub.role === '부' ? hub : partner.role === '부' ? partner : hub;
        const female = male === hub ? partner : hub;
        male.x = 470; female.x = 730; male.y = female.y = 225;
        placed.add(male.id); placed.add(female.id);
      }
    }

    // 아직 배치되지 않은 부모 관계 컴포넌트를 좌우로 정리한다.
    const remainingParents = parents.filter(p => !placed.has(p.id));
    const seen = new Set();
    const components = [];
    remainingParents.forEach(start => {
      if (seen.has(start.id)) return;
      const ids = [], stack = [start.id]; seen.add(start.id);
      while (stack.length) {
        const pid = stack.pop(); ids.push(pid);
        for (const next of adjacency.get(pid) || []) {
          if (!seen.has(next) && !placed.has(next)) { seen.add(next); stack.push(next); }
        }
      }
      components.push(ids.map(pid => byId(people, pid)).filter(Boolean));
    });

    components.forEach((component, ci) => {
      const base = components.length === 1 ? 600 : 180 + ci * (840 / Math.max(1, components.length - 1));
      if (component.length === 1) {
        component[0].x = base; component[0].y = 225; placed.add(component[0].id);
        return;
      }
      component.forEach((p, i) => {
        p.x = Math.max(100, Math.min(1100, base + (i - (component.length - 1) / 2) * 240));
        p.y = 225; placed.add(p.id);
      });
    });

    // 자녀는 실제 부모 조합의 중앙 아래에 배치한다.
    const groups = new Map();
    children.forEach(ch => {
      const ids = (childParents.get(ch.id) || []).slice().sort();
      const key = ids.length ? ids.join('|') : `none:${ch.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ch);
    });

    let orphan = 0;
    groups.forEach((group, key) => {
      if (key.startsWith('none:')) {
        group.forEach(ch => { ch.x = 200 + orphan++ * 160; ch.y = 560; });
        return;
      }
      const ps = key.split('|').map(pid => byId(people, pid)).filter(Boolean);
      const center = ps.reduce((s, p) => s + p.x, 0) / Math.max(1, ps.length);
      const gap = group.length > 2 ? 120 : 145;
      group.forEach((ch, i) => {
        ch.x = Math.max(80, Math.min(1120, center + (i - (group.length - 1) / 2) * gap));
        ch.y = 510;
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

    const people = [], relations = [], map = new Map();
    children.forEach((c, i) => {
      const p = {id:id(),name:label(c,`대상아동${i+1}`),role:'대상자',gender:c.querySelector(`input[name="g-${c.dataset.uid}"]:checked`)?.value||'unknown',age:c.querySelector('.aq-age')?.value.trim()||'',life:'alive',cohabit:c.querySelector('.aq-co')?.checked===false?'no':'yes',note:'',x:600,y:510,clientMain:i===0};
      people.push(p); map.set(c.dataset.uid,p);
    });
    parents.forEach(c => {
      const father = c.dataset.kind === 'father';
      const p = {id:id(),name:label(c,father?'부':'모'),role:father?'부':'모',gender:father?'male':'female',age:c.querySelector('.aq-age')?.value.trim()||'',life:'alive',cohabit:c.querySelector('.aq-co-sel')?.value||'unknown',note:'',x:father?420:780,y:225};
      people.push(p); map.set(c.dataset.uid,p);
    });
    extras.forEach((c, i) => {
      const role = c.querySelector('.aq-role')?.value || '기타 친척';
      const p = {id:id(),name:label(c,role),role,gender:c.querySelector('.aq-sex')?.value||'unknown',age:c.querySelector('.aq-age')?.value.trim()||'',life:'alive',cohabit:c.querySelector('.aq-co-sel')?.value||'unknown',note:'',x:140+i*145,y:['조부','조모'].includes(role)?80:role==='자녀'?650:role==='형제·자매'?570:390};
      people.push(p); map.set(c.dataset.uid,p);
    });

    parents.forEach(c => {
      const parent = map.get(c.dataset.uid), target = c.querySelector('.aq-parent-target')?.value;
      const targets = target === 'all' ? children.map(ch => map.get(ch.dataset.uid)) : [map.get(target)].filter(Boolean);
      const emotional = c.querySelector('.aq-child-rel')?.value || 'none';
      targets.forEach(ch => {
        if (!relations.some(r => r.type === 'parent' && r.from === parent.id && r.to === ch.id)) relations.push({id:id(),from:parent.id,to:ch.id,type:'parent'});
        addChildRelation(relations,parent,ch,emotional);
      });
    });

    extras.forEach(c => {
      const p = map.get(c.dataset.uid), ref = map.get(c.querySelector('.aq-ref')?.value), type = c.querySelector('.aq-link')?.value;
      if (!p || !ref || !type || type === 'none') return;
      if (type === 'parent-of-ref') relations.push({id:id(),from:p.id,to:ref.id,type:'parent'});
      else if (type === 'child-of-ref') relations.push({id:id(),from:ref.id,to:p.id,type:'parent'});
      else if (type === 'sibling-of-ref') relations.filter(r => r.type === 'parent' && r.to === ref.id).forEach(r => relations.push({id:id(),from:r.from,to:p.id,type:'parent'}));
      else addPairRelation(relations,ref,p,type);
    });

    // 3번 구성원간 관계는 부모뿐 아니라 등록된 모든 가족을 반영한다.
    // 새 엄마/새아빠가 기존 부모와 연결되면 이 관계가 배치 네트워크에도 사용된다.
    qa('#aqRels .aq-adultrel').forEach(c => addPairRelation(relations,map.get(c.querySelector('.aq-af')?.value),map.get(c.querySelector('.aq-at')?.value),c.querySelector('.aq-type')?.value));

    layout(people,relations);
    state.people=people; state.relations=relations; state.zoom=1; state.cohabitBox=null;
    save(); render(); activatePanel('editPanel'); toast('새 부모·재혼 관계까지 반영해 가계도를 만들었습니다');
  }

  document.addEventListener('submit', e => {
    if (e.target !== form) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    build();
  }, true);
})();