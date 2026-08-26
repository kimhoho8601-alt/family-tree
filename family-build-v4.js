(() => {
  const form = document.querySelector('#quickForm');
  if (!form || typeof state === 'undefined') return;
  const qa = s => [...document.querySelectorAll(s)];
  const byId = (arr, id) => arr.find(x => x.id === id);
  const label = (c, fallback) => c?.querySelector('.aq-name')?.value.trim() || fallback;
  const pairKey = (a, b) => [a, b].sort().join('|');

  function matchesChild(card, childUid) {
    const target = card.querySelector('.aq-parent-target')?.value;
    return target === 'all' || target === childUid;
  }

  function validate(children, parents) {
    const issues = [];
    if (!children.length) issues.push('대상아동을 1명 이상 등록해주세요.');

    children.forEach((child, i) => {
      const uid = child.dataset.uid;
      const fathers = parents.filter(p => p.dataset.kind === 'father' && matchesChild(p, uid));
      const mothers = parents.filter(p => p.dataset.kind === 'mother' && matchesChild(p, uid));
      const name = label(child, `아동 ${i + 1}`);
      if (!fathers.length && !mothers.length) issues.push(`${name}: 연결된 부모가 없습니다.`);
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

  function biologicalCardsForChild(childCard, parentCards) {
    const uid = childCard.dataset.uid;
    const fathers = parentCards.filter(p => p.dataset.kind === 'father' && matchesChild(p, uid));
    const mothers = parentCards.filter(p => p.dataset.kind === 'mother' && matchesChild(p, uid));

    // 같은 아동에 부/모가 여러 명 입력된 경우 첫 번째 일치 카드를 혈연 부모로 사용한다.
    // 두 번째 이후의 동일 역할 부모는 '새부모/배우자 후보'로 남고 parent 선에는 포함하지 않는다.
    return { father: fathers[0] || null, mother: mothers[0] || null };
  }

  function layout(people, relations) {
    const parentPeople = people.filter(p => p.role === '부' || p.role === '모');
    const children = people.filter(p => p.role === '대상자' || p.role === '자녀');
    const childParents = new Map();
    children.forEach(ch => childParents.set(ch.id, relations.filter(r => r.type === 'parent' && r.to === ch.id).map(r => r.from)));

    const coParents = new Map(parentPeople.map(p => [p.id, new Set()]));
    childParents.forEach(ids => {
      if (ids.length !== 2) return;
      coParents.get(ids[0])?.add(ids[1]);
      coParents.get(ids[1])?.add(ids[0]);
    });

    const adultPartners = new Map(parentPeople.map(p => [p.id, new Set()]));
    relations.forEach(r => {
      if (r.type === 'parent' || r.relationRole === 'parent-child-emotional') return;
      const a = byId(parentPeople, r.from), b = byId(parentPeople, r.to);
      if (!a || !b) return;
      adultPartners.get(a.id)?.add(b.id);
      adultPartners.get(b.id)?.add(a.id);
    });

    const placed = new Set();
    const corePairs = [];
    const seenPairs = new Set();
    childParents.forEach(ids => {
      if (ids.length !== 2) return;
      const key = pairKey(ids[0], ids[1]);
      if (!seenPairs.has(key)) { seenPairs.add(key); corePairs.push(ids.slice()); }
    });

    // 메인 아동의 혈연 부모쌍을 가계도의 중심에 둔다.
    // 남성(부)은 왼쪽, 여성(모)은 오른쪽. 새부모는 이 사이에 끼우지 않는다.
    const mainChild = children.find(c => c.clientMain) || children[0];
    const mainIds = mainChild ? (childParents.get(mainChild.id) || []) : [];
    if (mainIds.length === 2) {
      const a = byId(people, mainIds[0]), b = byId(people, mainIds[1]);
      if (a && b) {
        const left = a.role === '부' ? a : b.role === '부' ? b : a;
        const right = left === a ? b : a;
        left.x = 470; right.x = 730; left.y = right.y = 225;
        placed.add(left.id); placed.add(right.id);
      }
    }

    // 다른 혈연 부모쌍도 이미 놓인 부모를 기준으로 바깥 방향에 배치한다.
    corePairs.forEach(([aId, bId], index) => {
      const a = byId(people, aId), b = byId(people, bId);
      if (!a || !b || (placed.has(a.id) && placed.has(b.id))) return;

      if (placed.has(a.id) && !placed.has(b.id)) {
        const direction = a.x <= 600 ? -1 : 1;
        b.x = Math.max(120, Math.min(1080, a.x + direction * 250));
        b.y = 225; placed.add(b.id); return;
      }
      if (!placed.has(a.id) && placed.has(b.id)) {
        const direction = b.x <= 600 ? -1 : 1;
        a.x = Math.max(120, Math.min(1080, b.x + direction * 250));
        a.y = 225; placed.add(a.id); return;
      }

      const center = corePairs.length === 1 ? 600 : 240 + index * (720 / Math.max(1, corePairs.length - 1));
      const left = a.role === '부' ? a : b.role === '부' ? b : a;
      const right = left === a ? b : a;
      left.x = center - 125; right.x = center + 125; left.y = right.y = 225;
      placed.add(left.id); placed.add(right.id);
    });

    // 새엄마/새아빠 배치 규칙:
    // 혈연 공동부모가 있는 사람의 '성인 관계 상대' 중 공동부모가 아닌 사람은
    // 혈연 부모쌍의 반대쪽 바깥으로 보낸다.
    const usedStep = new Set();
    parentPeople.forEach(parent => {
      const bios = [...(coParents.get(parent.id) || [])].map(pid => byId(people, pid)).filter(Boolean);
      if (!bios.length || !placed.has(parent.id)) return;

      const steps = [...(adultPartners.get(parent.id) || [])]
        .filter(pid => !coParents.get(parent.id)?.has(pid))
        .map(pid => byId(people, pid))
        .filter(p => p && !usedStep.has(p.id));

      if (!steps.length) return;
      const bio = bios[0];
      const outward = bio.x > parent.x ? -1 : 1;
      steps.forEach((stepParent, i) => {
        stepParent.x = Math.max(90, Math.min(1110, parent.x + outward * (250 + i * 210)));
        stepParent.y = 225;
        placed.add(stepParent.id);
        usedStep.add(stepParent.id);
      });
    });

    // 성인 관계는 있으나 혈연 중심과 직접 연결되지 않은 부모들을 남는 공간에 배치한다.
    parentPeople.filter(p => !placed.has(p.id)).forEach((p, i, arr) => {
      p.x = arr.length === 1 ? 600 : 120 + i * (960 / Math.max(1, arr.length - 1));
      p.y = 225;
      placed.add(p.id);
    });

    // 아동 위치는 오직 실제 parent 관계만 사용한다.
    // 새부모가 3번 관계에만 등록되어 있다면 아동의 부모 조합에는 절대 들어가지 않는다.
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
      people.push(p); map.set(c.dataset.uid, p);
    });

    parents.forEach(c => {
      const father = c.dataset.kind === 'father';
      const p = {id:id(),name:label(c,father?'부':'모'),role:father?'부':'모',gender:father?'male':'female',age:c.querySelector('.aq-age')?.value.trim()||'',life:'alive',cohabit:c.querySelector('.aq-co-sel')?.value||'unknown',note:'',x:father?420:780,y:225};
      people.push(p); map.set(c.dataset.uid, p);
    });

    extras.forEach((c, i) => {
      const role = c.querySelector('.aq-role')?.value || '기타 친척';
      const p = {id:id(),name:label(c,role),role,gender:c.querySelector('.aq-sex')?.value||'unknown',age:c.querySelector('.aq-age')?.value.trim()||'',life:'alive',cohabit:c.querySelector('.aq-co-sel')?.value||'unknown',note:'',x:140+i*145,y:['조부','조모'].includes(role)?80:role==='자녀'?650:role==='형제·자매'?570:390};
      people.push(p); map.set(c.dataset.uid,p);
    });

    // 각 아동의 혈연 부모는 동일 역할에서 '첫 번째 일치 부모'만 사용한다.
    // 예: 모, 모2가 모두 대상아동을 가리켜도 모만 parent 선에 포함되고 모2는 새부모 후보로 유지된다.
    children.forEach(childCard => {
      const child = map.get(childCard.dataset.uid);
      const bio = biologicalCardsForChild(childCard, parents);
      [bio.father, bio.mother].filter(Boolean).forEach(parentCard => {
        const parent = map.get(parentCard.dataset.uid);
        if (!relations.some(r => r.type === 'parent' && r.from === parent.id && r.to === child.id)) {
          relations.push({id:id(),from:parent.id,to:child.id,type:'parent'});
        }
        addChildRelation(relations, parent, child, parentCard.querySelector('.aq-child-rel')?.value || 'none');
      });
    });

    extras.forEach(c => {
      const p = map.get(c.dataset.uid), ref = map.get(c.querySelector('.aq-ref')?.value), type = c.querySelector('.aq-link')?.value;
      if (!p || !ref || !type || type === 'none') return;
      if (type === 'parent-of-ref') relations.push({id:id(),from:p.id,to:ref.id,type:'parent'});
      else if (type === 'child-of-ref') relations.push({id:id(),from:ref.id,to:p.id,type:'parent'});
      else if (type === 'sibling-of-ref') relations.filter(r => r.type === 'parent' && r.to === ref.id).forEach(r => relations.push({id:id(),from:r.from,to:p.id,type:'parent'}));
      else addPairRelation(relations, ref, p, type);
    });

    // 3번 구성원간 관계: 새엄마/새아빠와 기존 부모의 관계는 여기서 생성된다.
    // 이 관계는 parent가 아니므로 아동 혈연 구조에는 포함되지 않는다.
    qa('#aqRels .aq-adultrel').forEach(c => addPairRelation(relations, map.get(c.querySelector('.aq-af')?.value), map.get(c.querySelector('.aq-at')?.value), c.querySelector('.aq-type')?.value));

    layout(people, relations);
    state.people = people;
    state.relations = relations;
    state.zoom = 1;
    state.cohabitBox = null;
    save(); render(); activatePanel('editPanel');
    toast('혈연 부모 중심으로 새부모를 바깥쪽에 배치했습니다');
  }

  document.addEventListener('submit', e => {
    if (e.target !== form) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    build();
  }, true);
})();