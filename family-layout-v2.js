(() => {
  const q = s => document.querySelector(s);
  const qa = s => [...document.querySelectorAll(s)];
  const form = q('#quickForm');
  if (!form || typeof state === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    .cohabit-resize-handle{fill:#fff;stroke:#33272a;stroke-width:2;vector-effect:non-scaling-stroke}
    .cohabit-resize-handle[data-corner="nw"],.cohabit-resize-handle[data-corner="se"]{cursor:nwse-resize}
    .cohabit-resize-handle[data-corner="ne"],.cohabit-resize-handle[data-corner="sw"]{cursor:nesw-resize}
    .cohabit-boundary-v3 .cohabit-hint{font:500 10px IBM Plex Sans KR,sans-serif;fill:#817578}
  `;
  document.head.append(style);

  try {
    const saved = JSON.parse(localStorage.getItem('genogram-studio'));
    if (saved?.cohabitBox && !state.cohabitBox) state.cohabitBox = saved.cohabitBox;
  } catch {}

  const peopleById = (people, id) => people.find(p => p.id === id);
  const childCards = () => qa('#aqChildren .aq-child');
  const parentCards = () => qa('#aqParents .aq-parent');

  function cardLabel(card, fallback) {
    return card?.querySelector('.aq-name')?.value.trim() || fallback;
  }

  function assignedToChild(card, childUid) {
    const value = card.querySelector('.aq-parent-target')?.value;
    return value === 'all' || value === childUid;
  }

  function validateQuickFamily() {
    const children = childCards();
    const parents = parentCards();
    const problems = [];

    if (!children.length) problems.push('대상아동을 1명 이상 등록해주세요.');

    children.forEach((child, index) => {
      const uid = child.dataset.uid;
      const fathers = parents.filter(p => p.dataset.kind === 'father' && assignedToChild(p, uid));
      const mothers = parents.filter(p => p.dataset.kind === 'mother' && assignedToChild(p, uid));
      const name = cardLabel(child, `아동 ${index + 1}`);
      if (fathers.length > 1) problems.push(`${name}: 부가 ${fathers.length}명 연결되어 있습니다. 해당 아동의 '부'는 1명만 선택해주세요.`);
      if (mothers.length > 1) problems.push(`${name}: 모가 ${mothers.length}명 연결되어 있습니다. 해당 아동의 '모'는 1명만 선택해주세요.`);
    });

    parentCards().forEach((card, i) => {
      const partner = card.querySelector('.aq-partner-target')?.value;
      const type = card.querySelector('.aq-partner-type')?.value;
      if (type && type !== 'none' && !partner) {
        problems.push(`${cardLabel(card, `부모 ${i + 1}`)}: 다른 부모와의 관계선을 선택했지만 관계 대상이 지정되지 않았습니다.`);
      }
    });

    return problems;
  }

  function addAdultRelation(relations, a, b, type) {
    if (!a || !b || a.id === b.id || !type || type === 'none') return;
    for (let i = relations.length - 1; i >= 0; i--) {
      const r = relations[i];
      const same = (r.from === a.id && r.to === b.id) || (r.from === b.id && r.to === a.id);
      if (same && r.type !== 'parent') relations.splice(i, 1);
    }
    relations.push({ id: id(), from: a.id, to: b.id, type, relationRole: 'adult' });
  }

  function addChildEmotion(relations, parent, child, type) {
    if (!parent || !child || !type || type === 'none') return;
    if (!relations.some(r => r.from === parent.id && r.to === child.id && r.type === type && r.relationRole === 'parent-child-emotional')) {
      relations.push({ id: id(), from: parent.id, to: child.id, type, relationRole: 'parent-child-emotional' });
    }
  }

  function childParentMap(people, relations) {
    const map = new Map();
    people.filter(p => p.role === '대상자' || p.role === '자녀').forEach(child => {
      map.set(child.id, relations.filter(r => r.type === 'parent' && r.to === child.id).map(r => r.from));
    });
    return map;
  }

  function coParentPairs(people, relations) {
    const childMap = childParentMap(people, relations);
    const pairs = new Map();
    childMap.forEach((pids, childId) => {
      if (pids.length !== 2) return;
      const ids = [...pids].sort();
      const key = ids.join('|');
      if (!pairs.has(key)) pairs.set(key, { ids, children: [] });
      pairs.get(key).children.push(childId);
    });
    return [...pairs.values()];
  }

  function logicalFamilyLayout(people, relations) {
    const parents = people.filter(p => p.role === '부' || p.role === '모');
    const children = people.filter(p => p.role === '대상자' || p.role === '자녀');
    const pairs = coParentPairs(people, relations);
    const adjacency = new Map(parents.map(p => [p.id, new Set()]));

    pairs.forEach(pair => {
      adjacency.get(pair.ids[0])?.add(pair.ids[1]);
      adjacency.get(pair.ids[1])?.add(pair.ids[0]);
    });

    const hub = parents.slice().sort((a, b) => (adjacency.get(b.id)?.size || 0) - (adjacency.get(a.id)?.size || 0))[0];
    const hubDegree = hub ? adjacency.get(hub.id)?.size || 0 : 0;
    const placed = new Set();

    if (hub && hubDegree >= 2) {
      hub.x = 600;
      hub.y = 225;
      placed.add(hub.id);
      const partners = [...adjacency.get(hub.id)].map(pid => peopleById(people, pid)).filter(Boolean);
      const slots = [];
      for (let i = 0; i < partners.length; i++) {
        const step = Math.floor(i / 2) + 1;
        slots.push(i % 2 === 0 ? 600 - Math.min(410, 260 * step) : 600 + Math.min(410, 260 * step));
      }
      partners.forEach((p, i) => { p.x = slots[i]; p.y = 225; placed.add(p.id); });
    }

    const remainingPairs = pairs.filter(pair => !pair.ids.every(pid => placed.has(pid)));
    const pairCount = remainingPairs.length;
    remainingPairs.forEach((pair, i) => {
      const a = peopleById(people, pair.ids[0]), b = peopleById(people, pair.ids[1]);
      if (!a || !b) return;
      if (placed.has(a.id) && !placed.has(b.id)) { b.x = Math.max(120, Math.min(1080, a.x + (a.x < 600 ? 260 : -260))); b.y = 225; placed.add(b.id); return; }
      if (!placed.has(a.id) && placed.has(b.id)) { a.x = Math.max(120, Math.min(1080, b.x + (b.x < 600 ? 260 : -260))); a.y = 225; placed.add(a.id); return; }
      if (!placed.has(a.id) && !placed.has(b.id)) {
        const center = pairCount === 1 ? 600 : 220 + i * (760 / Math.max(1, pairCount - 1));
        a.x = center - 120; b.x = center + 120; a.y = b.y = 225; placed.add(a.id); placed.add(b.id);
      }
    });

    const unplacedParents = parents.filter(p => !placed.has(p.id));
    unplacedParents.forEach((p, i) => {
      p.x = 150 + i * (900 / Math.max(1, unplacedParents.length - 1));
      p.y = 225;
    });

    const parentMap = childParentMap(people, relations);
    const pairChildGroups = new Map();
    children.forEach(ch => {
      const ids = parentMap.get(ch.id) || [];
      const key = ids.length ? [...ids].sort().join('|') : `none:${ch.id}`;
      if (!pairChildGroups.has(key)) pairChildGroups.set(key, []);
      pairChildGroups.get(key).push(ch);
    });

    let orphanIndex = 0;
    pairChildGroups.forEach((group, key) => {
      if (key.startsWith('none:')) {
        group.forEach(ch => { ch.x = 220 + orphanIndex++ * 170; ch.y = 570; });
        return;
      }
      const ids = key.split('|');
      const ps = ids.map(pid => peopleById(people, pid)).filter(Boolean);
      if (!ps.length) return;
      const center = ps.reduce((sum, p) => sum + p.x, 0) / ps.length;
      const gap = group.length > 2 ? 125 : 145;
      group.forEach((ch, i) => {
        ch.x = Math.max(75, Math.min(1125, center + (i - (group.length - 1) / 2) * gap));
        ch.y = 510;
      });
    });

    people.filter(p => !parents.includes(p) && !children.includes(p)).forEach((p, i) => {
      if (['조부','조모'].includes(p.role)) p.y = 80;
      else if (p.role === '형제·자매') p.y = 570;
      else if (p.role === '자녀') p.y = 650;
      else if (!Number.isFinite(p.y)) p.y = 380;
      if (!Number.isFinite(p.x)) p.x = 130 + i * 145;
    });
  }

  function buildQuickDiagram() {
    const problems = validateQuickFamily();
    if (problems.length) {
      alert(`관계 설정을 확인해주세요.\n\n• ${problems.join('\n• ')}`);
      toast('부모·아동 관계 설정을 확인해주세요');
      return;
    }
    if (state.people.length && !confirm('현재 가계도를 빠른 작성 내용으로 교체할까요?')) return;

    const children = childCards();
    const parents = parentCards();
    const extras = qa('#aqExtras .aq-extra');
    const people = [], relations = [], map = new Map();

    children.forEach((c, i) => {
      const p = {
        id: id(), name: cardLabel(c, `대상아동${i + 1}`), role: '대상자',
        gender: c.querySelector(`input[name="g-${c.dataset.uid}"]:checked`)?.value || 'unknown',
        age: c.querySelector('.aq-age')?.value.trim() || '', life: 'alive',
        cohabit: c.querySelector('.aq-co')?.checked === false ? 'no' : 'yes', note: '',
        x: 600 + (i - (children.length - 1) / 2) * 160, y: 510, clientMain: i === 0
      };
      people.push(p); map.set(c.dataset.uid, p);
    });

    parents.forEach(c => {
      const father = c.dataset.kind === 'father';
      const p = {
        id: id(), name: cardLabel(c, father ? '부' : '모'), role: father ? '부' : '모', gender: father ? 'male' : 'female',
        age: c.querySelector('.aq-age')?.value.trim() || '', life: 'alive', cohabit: c.querySelector('.aq-co-sel')?.value || 'unknown', note: '', x: father ? 420 : 780, y: 225
      };
      people.push(p); map.set(c.dataset.uid, p);
    });

    parents.forEach(c => {
      const parent = map.get(c.dataset.uid);
      const target = c.querySelector('.aq-parent-target')?.value;
      const targets = target === 'all' ? children.map(ch => map.get(ch.dataset.uid)) : [map.get(target)].filter(Boolean);
      const emotional = c.querySelector('.aq-child-rel')?.value || 'none';
      targets.forEach(child => {
        if (!relations.some(r => r.type === 'parent' && r.from === parent.id && r.to === child.id)) relations.push({ id: id(), from: parent.id, to: child.id, type: 'parent' });
        addChildEmotion(relations, parent, child, emotional);
      });
    });

    parents.forEach(c => {
      addAdultRelation(relations, map.get(c.dataset.uid), map.get(c.querySelector('.aq-partner-target')?.value), c.querySelector('.aq-partner-type')?.value);
    });
    qa('#aqRels .aq-adultrel').forEach(c => addAdultRelation(relations, map.get(c.querySelector('.aq-af')?.value), map.get(c.querySelector('.aq-at')?.value), c.querySelector('.aq-type')?.value));

    extras.forEach((c, i) => {
      const role = c.querySelector('.aq-role')?.value || '기타 친척';
      const p = { id:id(), name:cardLabel(c, role), role, gender:c.querySelector('.aq-sex')?.value || 'unknown', age:c.querySelector('.aq-age')?.value.trim() || '', life:'alive', cohabit:c.querySelector('.aq-co-sel')?.value || 'unknown', note:'', x:130+i*145, y:['조부','조모'].includes(role)?80:role==='자녀'?650:role==='형제·자매'?570:390 };
      people.push(p); map.set(c.dataset.uid,p);
    });

    extras.forEach(c => {
      const p = map.get(c.dataset.uid), ref = map.get(c.querySelector('.aq-ref')?.value), type = c.querySelector('.aq-link')?.value;
      if (!p || !ref || !type || type === 'none') return;
      if (type === 'parent-of-ref') relations.push({id:id(),from:p.id,to:ref.id,type:'parent'});
      else if (type === 'child-of-ref') relations.push({id:id(),from:ref.id,to:p.id,type:'parent'});
      else if (type === 'sibling-of-ref') relations.filter(r => r.type === 'parent' && r.to === ref.id).forEach(r => relations.push({id:id(),from:r.from,to:p.id,type:'parent'}));
      else addAdultRelation(relations, ref, p, type);
    });

    logicalFamilyLayout(people, relations);
    state.people = people;
    state.relations = relations;
    state.zoom = 1;
    state.cohabitBox = null;
    save(); render(); activatePanel('editPanel');
    toast('가족관계를 검증해 가계도를 배치했습니다');
  }

  document.addEventListener('submit', e => {
    if (e.target !== form) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    buildQuickDiagram();
  }, true);

  function routeParentGroups() {
    const groups = [...els.relations.querySelectorAll('.parent-group')].map(g => {
      const ids = (g.dataset.relations || '').split(',').filter(Boolean);
      const links = ids.map(rid => state.relations.find(r => r.id === rid)).filter(Boolean);
      const pids = [...new Set(links.map(r => r.from))], cids = [...new Set(links.map(r => r.to))];
      const parents = pids.map(pid => peopleById(state.people, pid)).filter(Boolean), children = cids.map(cid => peopleById(state.people, cid)).filter(Boolean);
      if (!parents.length || !children.length) return null;
      const anchor = parents.reduce((sum,p) => sum + p.x, 0) / parents.length;
      return { g, parents, children, anchor, py: parents.reduce((sum,p) => sum + p.y, 0) / parents.length };
    }).filter(Boolean).sort((a,b) => a.anchor - b.anchor);

    groups.forEach((o, index) => {
      const near = groups.slice(0,index).filter(x => Math.abs(x.anchor - o.anchor) < 120).length;
      const lane = Math.min(Math.min(...o.children.map(c => c.y)) - 75, Math.max(...o.parents.map(p => p.y)) + 88 + near * 24);
      const xs = [o.anchor, ...o.children.map(c => c.x)], minX = Math.min(...xs), maxX = Math.max(...xs);
      let d = `M${o.anchor} ${o.py} V${lane}`;
      if (maxX - minX > 1) d += ` M${minX} ${lane} H${maxX}`;
      o.children.forEach(c => { d += ` M${c.x} ${lane} V${c.y}`; });
      o.g.querySelector('.relation.parent')?.setAttribute('d', d);
      o.g.querySelector('.relation-hit')?.setAttribute('d', d);
    });
  }

  function routeParentChildEmotion() {
    const items = state.relations.filter(r => r.relationRole === 'parent-child-emotional');
    items.forEach((r, i) => {
      const a = peopleById(state.people, r.from), b = peopleById(state.people, r.to);
      if (!a || !b) return;
      const parent = ['부','모'].includes(a.role) ? a : b, child = parent === a ? b : a;
      const g = els.relations.querySelector(`.relation-group[data-relation="${r.id}"]`);
      if (!g) return;
      const sign = child.x >= parent.x ? 1 : -1, off = 20 + (i % 3) * 7;
      const s = {x:parent.x + sign*off, y:parent.y + 34}, e = {x:child.x + sign*off, y:child.y - 38};
      const d = r.type === 'conflict' ? zigzag(s,e) : `M${s.x} ${s.y} C${s.x + sign*55} ${s.y + 75},${e.x + sign*55} ${e.y - 75},${e.x} ${e.y}`;
      g.querySelector('.relation')?.setAttribute('d',d);
      g.querySelector('.relation-hit')?.setAttribute('d',d);
    });
  }

  function autoCohabitBox() {
    const isC = p => p && (p.cohabit === true || ['yes','true','1','동거'].includes(String(p.cohabit).toLowerCase()));
    const members = state.people.filter(isC);
    if (!members.length) return null;
    const x1 = Math.max(8, Math.min(...members.map(p=>p.x)) - 66), y1 = Math.max(8, Math.min(...members.map(p=>p.y)) - 66);
    const x2 = Math.min(1192, Math.max(...members.map(p=>p.x)) + 66), y2 = Math.min(712, Math.max(...members.map(p=>p.y)) + 100);
    return {x:x1,y:y1,w:Math.max(140,x2-x1),h:Math.max(120,y2-y1)};
  }

  function currentCohabitBox() {
    const auto = autoCohabitBox();
    if (!auto) return null;
    const b = state.cohabitBox;
    if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.w) || !Number.isFinite(b.h)) return auto;
    return {x:b.x,y:b.y,w:b.w,h:b.h};
  }

  function drawCohabitBox() {
    els.relations.querySelectorAll('.cohabit-boundary,.cohabit-boundary-v2,.cohabit-boundary-v3').forEach(el => el.remove());
    const box = currentCohabitBox();
    if (!box) return;
    const ns='http://www.w3.org/2000/svg', g=document.createElementNS(ns,'g');
    g.setAttribute('class','cohabit-boundary-v3');
    const rect=document.createElementNS(ns,'rect');
    rect.setAttribute('x',box.x);rect.setAttribute('y',box.y);rect.setAttribute('width',box.w);rect.setAttribute('height',box.h);rect.setAttribute('rx','10');rect.setAttribute('fill','none');rect.setAttribute('stroke','#33272a');rect.setAttribute('stroke-width','2.5');rect.setAttribute('pointer-events','none');
    const text=document.createElementNS(ns,'text');text.setAttribute('x',box.x+12);text.setAttribute('y',box.y>24?box.y-8:box.y+18);text.setAttribute('fill','#33272a');text.setAttribute('font-size','12');text.setAttribute('font-weight','700');text.textContent='동거가족';text.setAttribute('pointer-events','none');
    const hint=document.createElementNS(ns,'text');hint.setAttribute('class','cohabit-hint');hint.setAttribute('x',box.x+80);hint.setAttribute('y',box.y>24?box.y-8:box.y+18);hint.textContent='모서리를 드래그해 크기 조절';hint.setAttribute('pointer-events','none');
    g.append(rect,text,hint);
    const corners={nw:[box.x,box.y],ne:[box.x+box.w,box.y],sw:[box.x,box.y+box.h],se:[box.x+box.w,box.y+box.h]};
    Object.entries(corners).forEach(([corner,[x,y]])=>{const h=document.createElementNS(ns,'rect');h.setAttribute('class','cohabit-resize-handle');h.dataset.corner=corner;h.setAttribute('x',x-5);h.setAttribute('y',y-5);h.setAttribute('width','10');h.setAttribute('height','10');h.setAttribute('rx','2');const t=document.createElementNS(ns,'title');t.textContent='드래그해서 동거가족 테두리 크기 조절';h.append(t);g.append(h)});
    els.relations.insertBefore(g,els.relations.firstChild);
  }

  const previousRenderRelations = renderRelations;
  renderRelations = function() {
    previousRenderRelations();
    routeParentGroups();
    routeParentChildEmotion();
    drawCohabitBox();
  };

  function svgPoint(e) {
    const p = els.svg.createSVGPoint(); p.x=e.clientX; p.y=e.clientY; return p.matrixTransform(els.svg.getScreenCTM().inverse());
  }

  let resizing = null;
  els.relations.addEventListener('pointerdown', e => {
    const handle = e.target.closest?.('.cohabit-resize-handle');
    if (!handle) return;
    e.preventDefault(); e.stopPropagation();
    const box = currentCohabitBox(); if (!box) return;
    resizing = {corner:handle.dataset.corner,start:svgPoint(e),box:{...box},pointerId:e.pointerId};
    state.cohabitBox = {...box};
    els.svg.setPointerCapture?.(e.pointerId);
  }, true);

  els.svg.addEventListener('pointermove', e => {
    if (!resizing) return;
    e.preventDefault();
    const p=svgPoint(e), dx=p.x-resizing.start.x, dy=p.y-resizing.start.y, s=resizing.box;
    let left=s.x, top=s.y, right=s.x+s.w, bottom=s.y+s.h;
    if (resizing.corner.includes('w')) left += dx; else right += dx;
    if (resizing.corner.includes('n')) top += dy; else bottom += dy;
    const minW=150,minH=120;
    if (right-left<minW) resizing.corner.includes('w') ? left=right-minW : right=left+minW;
    if (bottom-top<minH) resizing.corner.includes('n') ? top=bottom-minH : bottom=top+minH;
    left=Math.max(8,Math.min(left,1192-minW)); top=Math.max(8,Math.min(top,712-minH)); right=Math.min(1192,Math.max(right,left+minW)); bottom=Math.min(712,Math.max(bottom,top+minH));
    state.cohabitBox={x:left,y:top,w:right-left,h:bottom-top};
    drawCohabitBox();
  }, true);

  els.svg.addEventListener('pointerup', e => {
    if (!resizing) return;
    e.preventDefault(); e.stopPropagation();
    resizing=null; save();
    toast('동거가족 테두리 크기를 저장했습니다');
  }, true);

  els.relations.addEventListener('click', e => {
    if (e.target.closest?.('.cohabit-resize-handle')) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  const download = q('#downloadBtn');
  if (download?.onclick) {
    const originalDownload = download.onclick;
    download.onclick = function(e) {
      const handles = [...els.relations.querySelectorAll('.cohabit-resize-handle,.cohabit-hint')];
      const prev = handles.map(el => el.style.display);
      handles.forEach(el => el.style.display='none');
      originalDownload.call(this,e);
      requestAnimationFrame(() => handles.forEach((el,i) => el.style.display=prev[i]));
    };
  }

  render();
})();