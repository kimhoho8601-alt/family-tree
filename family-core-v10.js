(() => {
  const form = document.querySelector('#quickForm');
  if (!form || typeof state === 'undefined') return;

  const q = (s, root = document) => root.querySelector(s);
  const qa = (s, root = document) => [...root.querySelectorAll(s)];
  const byId = (people, id) => people.find(p => p.id === id);
  const pairKey = (a, b) => [a, b].sort().join('|');
  const normalizeLife = value => ['alive','dead','unknown'].includes(value) ? value : 'alive';

  document.documentElement.dataset.familyCore = 'v10';
  window.__FAMILY_CORE_VERSION = 'v10';

  function ensureLifeField(card) {
    if (!card || card.querySelector('.aq-life')) return;
    const relationGrid = card.querySelector('.aq-box .aq-grid');
    if (!relationGrid) return;

    const label = document.createElement('label');
    label.className = 'aq-field aq-life-field';
    label.innerHTML = `<span>생존 상태</span><select class="aq-life"><option value="alive">생존</option><option value="dead">사망</option><option value="unknown">미상</option></select>`;

    const cohabitField = card.querySelector('.aq-co-sel')?.closest('.aq-field');
    if (cohabitField?.parentElement === relationGrid) relationGrid.insertBefore(label, cohabitField);
    else relationGrid.append(label);
  }

  function ensureLifeFields() {
    qa('#aqParents .aq-parent', form).forEach(ensureLifeField);
  }

  function ensureParentTargetOptions() {
    const children = qa('#aqChildren .aq-child', form).map((c, i) => ({
      id: c.dataset.uid,
      name: q('.aq-name', c)?.value.trim() || `아동 ${i + 1}`
    }));

    ['father', 'mother'].forEach(kind => {
      const cards = qa(`#aqParents .aq-parent[data-kind="${kind}"]`, form);
      cards.forEach((card, index) => {
        ensureLifeField(card);
        const select = q('.aq-parent-target', card);
        if (!select) return;
        const old = select.value;
        const touched = card.dataset.v10TargetTouched === 'true' || card.dataset.parentTargetTouched === 'true';
        select.innerHTML = `<option value="">아동 부모로 연결 안 함 · 새부모/배우자</option><option value="all">등록된 모든 아동</option>${children.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}`;
        if (touched && [...select.options].some(o => o.value === old)) select.value = old;
        else select.value = index === 0 ? 'all' : '';
      });
    });
  }

  function cards() {
    ensureLifeFields();
    return {
      children: qa('#aqChildren .aq-child', form),
      parents: qa('#aqParents .aq-parent', form),
      extras: qa('#aqExtras .aq-extra', form)
    };
  }

  function isTargeted(card, childUid) {
    const v = q('.aq-parent-target', card)?.value || '';
    return v === 'all' || v === childUid;
  }

  function validate() {
    const {children, parents} = cards();
    const issues = [];
    if (!children.length) issues.push('대상아동을 1명 이상 등록해주세요.');
    children.forEach((child, i) => {
      const fathers = parents.filter(p => p.dataset.kind === 'father' && isTargeted(p, child.dataset.uid));
      const mothers = parents.filter(p => p.dataset.kind === 'mother' && isTargeted(p, child.dataset.uid));
      const name = q('.aq-name', child)?.value.trim() || `아동 ${i + 1}`;
      if (fathers.length > 1) issues.push(`${name}: 부가 ${fathers.length}명 부모로 지정되어 있습니다.`);
      if (mothers.length > 1) issues.push(`${name}: 모가 ${mothers.length}명 부모로 지정되어 있습니다. 새엄마는 ‘아동 부모로 연결 안 함’으로 설정해주세요.`);
    });
    return issues;
  }

  function addAdult(relations, a, b, type) {
    if (!a || !b || a.id === b.id || !type || type === 'none') return;
    for (let i = relations.length - 1; i >= 0; i--) {
      const r = relations[i];
      const same = (r.from === a.id && r.to === b.id) || (r.from === b.id && r.to === a.id);
      if (same && r.type !== 'parent') relations.splice(i, 1);
    }
    relations.push({id:id(), from:a.id, to:b.id, type, relationRole:'adult'});
  }

  function adultNeighbors(people, relations, pid) {
    return relations
      .filter(r => r.type !== 'parent' && r.relationRole !== 'parent-child-emotional' && (r.from === pid || r.to === pid))
      .map(r => byId(people, r.from === pid ? r.to : r.from))
      .filter(Boolean);
  }

  function layout(people, relations) {
    const children = people.filter(p => p.role === '대상자' || p.role === '자녀');
    const parentPeople = people.filter(p => p.role === '부' || p.role === '모');
    const parentMap = new Map(children.map(ch => [ch.id, relations.filter(r => r.type === 'parent' && r.to === ch.id).map(r => r.from)]));
    const allBiologicalIds = new Set([...parentMap.values()].flat());
    const mainChild = children.find(c => c.clientMain) || children[0];
    const placed = new Set();

    const setPos = (p, x, y = 225) => {
      if (!p) return;
      p.x = Math.max(80, Math.min(1120, x));
      p.y = y;
      placed.add(p.id);
    };

    if (mainChild) {
      const mainIds = parentMap.get(mainChild.id) || [];
      const mainParents = mainIds.map(pid => byId(people, pid)).filter(Boolean);
      const father = mainParents.find(p => p.role === '부');
      const mother = mainParents.find(p => p.role === '모');

      if (father && mother) {
        const mainSet = new Set(mainIds);
        const explicitFatherSteps = adultNeighbors(people, relations, father.id).filter(p => ['부','모'].includes(p.role) && p.id !== mother.id && !mainSet.has(p.id));
        const explicitMotherSteps = adultNeighbors(people, relations, mother.id).filter(p => ['부','모'].includes(p.role) && p.id !== father.id && !mainSet.has(p.id));
        const unassignedMothers = parentPeople.filter(p => p.role === '모' && !allBiologicalIds.has(p.id) && p.id !== mother.id);
        const unassignedFathers = parentPeople.filter(p => p.role === '부' && !allBiologicalIds.has(p.id) && p.id !== father.id);
        const fatherSteps = [...new Map([...explicitFatherSteps, ...unassignedMothers].map(p => [p.id, p])).values()];
        const motherSteps = [...new Map([...explicitMotherSteps, ...unassignedFathers].map(p => [p.id, p])).values()];

        if (fatherSteps.length && !motherSteps.length) {
          setPos(father, 600);
          setPos(mother, 850);
          fatherSteps.forEach((p, i) => setPos(p, 350 - i * 210));
        } else if (motherSteps.length && !fatherSteps.length) {
          setPos(father, 350);
          setPos(mother, 600);
          motherSteps.forEach((p, i) => setPos(p, 850 + i * 210));
        } else if (fatherSteps.length && motherSteps.length) {
          setPos(father, 500);
          setPos(mother, 700);
          fatherSteps.forEach((p, i) => setPos(p, 250 - i * 170));
          motherSteps.forEach((p, i) => setPos(p, 950 + i * 170));
        } else {
          setPos(father, 470);
          setPos(mother, 730);
        }
      } else if (mainParents.length === 1) {
        setPos(mainParents[0], 600);
      }
    }

    const pairs = new Map();
    parentMap.forEach(ids => { if (ids.length === 2) pairs.set(pairKey(ids[0], ids[1]), ids.slice()); });
    let pi = 0;
    pairs.forEach(ids => {
      const a = byId(people, ids[0]), b = byId(people, ids[1]);
      if (!a || !b || (placed.has(a.id) && placed.has(b.id))) return;
      if (placed.has(a.id)) return setPos(b, a.x + (a.x < 600 ? -250 : 250));
      if (placed.has(b.id)) return setPos(a, b.x + (b.x < 600 ? -250 : 250));
      const center = 300 + (pi++ % 3) * 300;
      const left = a.role === '부' ? a : b.role === '부' ? b : a;
      const right = left === a ? b : a;
      setPos(left, center - 115);
      setPos(right, center + 115);
    });

    let changed = true;
    while (changed) {
      changed = false;
      relations.filter(r => r.type !== 'parent' && r.relationRole !== 'parent-child-emotional').forEach(r => {
        const a = byId(people, r.from), b = byId(people, r.to);
        if (!a || !b || !parentPeople.includes(a) || !parentPeople.includes(b)) return;
        if (placed.has(a.id) && !placed.has(b.id)) { setPos(b, a.x < 600 ? a.x - 230 : a.x + 230); changed = true; }
        else if (!placed.has(a.id) && placed.has(b.id)) { setPos(a, b.x < 600 ? b.x - 230 : b.x + 230); changed = true; }
      });
    }

    parentPeople.filter(p => !placed.has(p.id)).forEach((p, i, arr) => setPos(p, arr.length === 1 ? 600 : 120 + i * (960 / Math.max(1, arr.length - 1))));

    const groups = new Map();
    children.forEach(ch => {
      const ids = (parentMap.get(ch.id) || []).slice().sort();
      const key = ids.length ? ids.join('|') : `none:${ch.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ch);
    });
    let orphan = 0;
    groups.forEach((group, key) => {
      if (key.startsWith('none:')) return group.forEach(ch => { ch.x = 200 + orphan++ * 160; ch.y = 560; });
      const ps = key.split('|').map(pid => byId(people, pid)).filter(Boolean);
      const center = ps.reduce((s, p) => s + p.x, 0) / Math.max(1, ps.length);
      const gap = group.length > 2 ? 120 : 145;
      group.forEach((ch, i) => { ch.x = Math.max(80, Math.min(1120, center + (i - (group.length - 1) / 2) * gap)); ch.y = 510; });
    });
  }

  function build() {
    ensureLifeFields();
    const issues = validate();
    if (issues.length) {
      alert(`관계 설정을 확인해주세요.\n\n• ${issues.join('\n• ')}`);
      toast('부모·아동 관계 설정을 확인해주세요');
      return;
    }
    if (state.people.length && !confirm('현재 가계도를 빠른 작성 내용으로 교체할까요?')) return;

    const {children, parents, extras} = cards();
    const people = [], relations = [], map = new Map();
    const selectedLife = [];

    children.forEach((c, i) => {
      const p = {id:id(), name:q('.aq-name', c)?.value.trim() || `대상아동${i+1}`, role:'대상자', gender:q(`input[name="g-${c.dataset.uid}"]:checked`, c)?.value || 'unknown', age:q('.aq-age', c)?.value.trim() || '', life:'alive', cohabit:q('.aq-co', c)?.checked === false ? 'no' : 'yes', note:'', x:600, y:510, clientMain:i===0};
      people.push(p); map.set(c.dataset.uid, p);
    });

    parents.forEach(c => {
      const father = c.dataset.kind === 'father';
      const life = normalizeLife(q('.aq-life', c)?.value);
      const p = {id:id(), name:q('.aq-name', c)?.value.trim() || (father?'부':'모'), role:father?'부':'모', gender:father?'male':'female', age:q('.aq-age', c)?.value.trim() || '', life, cohabit:q('.aq-co-sel', c)?.value || 'unknown', note:'', x:father?420:780, y:225};
      selectedLife.push({card:c.dataset.uid, name:p.name, life});
      people.push(p); map.set(c.dataset.uid, p);
    });

    extras.forEach((c, i) => {
      const role = q('.aq-role', c)?.value || '기타 친척';
      const p = {id:id(), name:q('.aq-name', c)?.value.trim() || role, role, gender:q('.aq-sex', c)?.value || 'unknown', age:q('.aq-age', c)?.value.trim() || '', life:'alive', cohabit:q('.aq-co-sel', c)?.value || 'unknown', note:'', x:140+i*145, y:['조부','조모'].includes(role)?80:role==='자녀'?650:role==='형제·자매'?570:390};
      people.push(p); map.set(c.dataset.uid, p);
    });

    parents.forEach(c => {
      const target = q('.aq-parent-target', c)?.value || '';
      if (!target) return;
      const parent = map.get(c.dataset.uid);
      const targets = target === 'all' ? children.map(ch => map.get(ch.dataset.uid)) : [map.get(target)].filter(Boolean);
      targets.forEach(child => {
        relations.push({id:id(), from:parent.id, to:child.id, type:'parent'});
        const emotional = q('.aq-child-rel', c)?.value || 'none';
        if (emotional !== 'none') relations.push({id:id(), from:parent.id, to:child.id, type:emotional, relationRole:'parent-child-emotional'});
      });
    });

    qa('#aqRels .aq-adultrel', form).forEach(c => addAdult(relations, map.get(q('.aq-af', c)?.value), map.get(q('.aq-at', c)?.value), q('.aq-type', c)?.value));

    extras.forEach(c => {
      const p = map.get(c.dataset.uid), ref = map.get(q('.aq-ref', c)?.value), type = q('.aq-link', c)?.value;
      if (!p || !ref || !type || type === 'none') return;
      if (type === 'parent-of-ref') relations.push({id:id(), from:p.id, to:ref.id, type:'parent'});
      else if (type === 'child-of-ref') relations.push({id:id(), from:ref.id, to:p.id, type:'parent'});
      else if (type === 'sibling-of-ref') relations.filter(r => r.type === 'parent' && r.to === ref.id).forEach(r => relations.push({id:id(), from:r.from, to:p.id, type:'parent'}));
      else addAdult(relations, ref, p, type);
    });

    layout(people, relations);
    state.people = people;
    state.relations = relations;
    state.zoom = 1;
    state.cohabitBox = null;
    state.layoutVersion = 'v10';
    state.quickLifeVersion = 'v10';

    // Final synchronous verification before save/render.
    selectedLife.forEach(sel => {
      const person = state.people.find(p => p.name === sel.name && (p.role === '부' || p.role === '모'));
      if (person) person.life = sel.life;
    });

    save();
    render();
    activatePanel('editPanel');

    requestAnimationFrame(() => {
      const lifeCheck = selectedLife.map(sel => {
        const person = state.people.find(p => p.name === sel.name && (p.role === '부' || p.role === '모'));
        const node = person ? els.nodes.querySelector(`[data-id="${person.id}"]`) : null;
        return {name:sel.name, selected:sel.life, state:person?.life || '', deadClass:!!node?.classList.contains('dead')};
      });
      window.__LAST_QUICK_LIFE_CHECK = lifeCheck;
      document.documentElement.dataset.quickLifeCheck = lifeCheck.every(x => x.selected === x.state && (x.selected !== 'dead' || x.deadClass)) ? 'ok' : 'mismatch';
    });

    toast('가계도를 만들었습니다');
  }

  // One authoritative quick-create submit path. Window capture runs before every legacy form/document handler.
  window.addEventListener('submit', e => {
    if (e.target !== form) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    build();
  }, true);

  form.addEventListener('change', e => {
    if (e.target.matches('.aq-parent-target')) {
      const card = e.target.closest('.aq-parent');
      if (card) {
        card.dataset.v10TargetTouched = 'true';
        card.dataset.parentTargetTouched = 'true';
      }
    }
  }, true);

  document.addEventListener('click', e => {
    if (e.target.closest('#aqAddFather,#aqAddMother,#aqAddChild,#aqResetInput,[data-rm]')) {
      setTimeout(() => { ensureLifeFields(); ensureParentTargetOptions(); }, 0);
    }
  });
  form.addEventListener('input', e => {
    if (e.target.matches('.aq-name')) setTimeout(ensureParentTargetOptions, 0);
  });

  new MutationObserver(() => ensureLifeFields()).observe(form, {childList:true, subtree:true});
  ensureLifeFields();
  setTimeout(ensureParentTargetOptions, 0);
})();