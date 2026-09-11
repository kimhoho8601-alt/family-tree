(() => {
  if (typeof state === 'undefined' || typeof save !== 'function' || typeof render !== 'function') return;
  const form = document.querySelector('#quickForm');
  if (!form) return;

  const oldSection = document.querySelector('#aqGrandparentsSection');
  oldSection?.remove();

  const uid = () => (globalThis.crypto?.randomUUID?.()) || `gp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  let pendingMode = '';
  let clearPendingTimer = null;

  const style = document.createElement('style');
  style.dataset.quickGrandparentsAuto = 'v3';
  style.textContent = `
    #aqGrandparentsAutoSection .aq-gp-auto-box{padding:11px;border:1px solid var(--line);border-radius:11px;background:#faf8f8}
    #aqGrandparentsAutoSection .aq-gp-auto-box select{width:100%;height:38px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:#fff;font:11px inherit}
    #aqGrandparentsAutoSection .aq-gp-auto-help{margin:7px 0 0;color:#8b7e81;font-size:8px;line-height:1.5;word-break:keep-all}
  `;
  document.head.append(style);

  document.querySelector('#aqGrandparentsAutoSection')?.remove();
  const section = document.createElement('section');
  section.className = 'aq-section';
  section.id = 'aqGrandparentsAutoSection';
  section.innerHTML = `
    <div class="aq-head">
      <span class="aq-step">3</span>
      <div class="aq-copy">
        <strong>조부모 · 3대 가족</strong>
        <small>어느 쪽 조부모를 표시할지만 선택하면 자동 생성됩니다.</small>
      </div>
    </div>
    <div class="aq-gp-auto-box">
      <label class="aq-field">
        <span>조부모 선택</span>
        <select id="aqGrandparentMode">
          <option value="">추가하지 않음</option>
          <option value="father">부의 부모 · 친조부 / 친조모</option>
          <option value="mother">모의 부모 · 외조부 / 외조모</option>
          <option value="both">부 · 모 양쪽 조부모 모두</option>
        </select>
      </label>
      <p class="aq-gp-auto-help">선택한 쪽은 조부·조모 한 쌍과 부모 연결선까지 자동 생성됩니다. 생존 여부는 미상으로 생성되며 이후 세부 편집에서 수정할 수 있습니다.</p>
    </div>`;

  const hiddenRelSection = document.querySelector('#aqAddRel')?.closest('.aq-section');
  const createButton = form.querySelector('.aq-create');
  if (hiddenRelSection) form.insertBefore(section, hiddenRelSection);
  else if (createButton) form.insertBefore(section, createButton);
  else form.append(section);

  const modeSelect = section.querySelector('#aqGrandparentMode');

  function armPending() {
    pendingMode = modeSelect?.value || '';
    clearTimeout(clearPendingTimer);
    clearPendingTimer = setTimeout(() => { pendingMode = ''; }, 1200);
  }

  document.addEventListener('submit', event => {
    if (event.target === form) armPending();
  }, true);
  form.addEventListener('pointerdown', event => {
    if (event.target.closest('.aq-create')) armPending();
  }, true);

  function labels(side, index, total) {
    const suffix = total > 1 ? ` ${index + 1}` : '';
    return side === 'father'
      ? [`친조부${suffix}`, `친조모${suffix}`]
      : [`외조부${suffix}`, `외조모${suffix}`];
  }

  function addPair(parent, side, index, total) {
    const [grandfatherName, grandmotherName] = labels(side, index, total);
    const grandfather = {
      id: uid(), name: grandfatherName, role: '조부', gender: 'male', age: '',
      life: 'unknown', cohabit: 'unknown', note: '', x: 600, y: 115,
      quickGrandparentAuto: true, quickGrandparentSide: side, quickGrandparentParentId: parent.id
    };
    const grandmother = {
      id: uid(), name: grandmotherName, role: '조모', gender: 'female', age: '',
      life: 'unknown', cohabit: 'unknown', note: '', x: 600, y: 115,
      quickGrandparentAuto: true, quickGrandparentSide: side, quickGrandparentParentId: parent.id
    };

    state.people.push(grandfather, grandmother);
    state.relations.push(
      { id:uid(), from:grandfather.id, to:grandmother.id, type:'marriage', relationRole:'adult' },
      { id:uid(), from:grandfather.id, to:parent.id, type:'parent' },
      { id:uid(), from:grandmother.id, to:parent.id, type:'parent' }
    );
    return 2;
  }

  function normalizeThreeGenerationLayout() {
    const fathers = state.people.filter(p => p.role === '부');
    const mothers = state.people.filter(p => p.role === '모');
    const parents = [...fathers, ...mothers];
    const children = state.people.filter(p => p.role === '대상자' || p.role === '자녀');
    if (!parents.length) return;

    // Standard one-father / one-mother case: visually balanced three-generation tree.
    if (fathers.length === 1 && mothers.length === 1) {
      fathers[0].x = 420; fathers[0].y = 315;
      mothers[0].x = 780; mothers[0].y = 315;
    } else if (parents.length === 1) {
      parents[0].x = 600; parents[0].y = 315;
    } else {
      const minX = 260, maxX = 940;
      parents.sort((a,b) => (a.x||0) - (b.x||0));
      parents.forEach((parent,index) => {
        parent.x = minX + (maxX-minX) * index / Math.max(1, parents.length-1);
        parent.y = 315;
      });
    }

    // Place each generated grandparent pair evenly around its own parent.
    parents.forEach(parent => {
      const grandparents = state.people
        .filter(p => p.quickGrandparentAuto === true && p.quickGrandparentParentId === parent.id)
        .sort((a,b) => (a.gender === 'male' ? -1 : 1) - (b.gender === 'male' ? -1 : 1));
      if (!grandparents.length) return;
      const spread = parents.length > 2 ? 82 : 110;
      if (grandparents[0]) { grandparents[0].x = Math.max(75, parent.x-spread); grandparents[0].y = 115; }
      if (grandparents[1]) { grandparents[1].x = Math.min(1125, parent.x+spread); grandparents[1].y = 115; }
    });

    // Keep children centered under the parents they are actually connected to.
    children.forEach((child,index) => {
      const linkedParents = state.relations
        .filter(r => r.type === 'parent' && r.to === child.id)
        .map(r => state.people.find(p => p.id === r.from))
        .filter(p => p && (p.role === '부' || p.role === '모'));
      const center = linkedParents.length
        ? linkedParents.reduce((sum,p) => sum + p.x, 0) / linkedParents.length
        : 600;
      const siblings = children.filter(c => {
        const ids = state.relations.filter(r => r.type === 'parent' && r.to === c.id).map(r => r.from).sort().join('|');
        const myIds = state.relations.filter(r => r.type === 'parent' && r.to === child.id).map(r => r.from).sort().join('|');
        return ids === myIds;
      });
      const siblingIndex = siblings.findIndex(c => c.id === child.id);
      child.x = Math.max(90, Math.min(1110, center + (siblingIndex-(siblings.length-1)/2)*155));
      child.y = 555;
    });
  }

  function injectGrandparentsIfPending() {
    const mode = pendingMode;
    pendingMode = '';
    clearTimeout(clearPendingTimer);
    if (!mode) return 0;
    if (!state.people.some(p => p.role === '대상자')) return 0;
    if (state.people.some(p => p.quickGrandparentAuto)) return 0;

    let created = 0;
    if (mode === 'father' || mode === 'both') {
      const fathers = state.people.filter(p => p.role === '부');
      fathers.forEach((parent, index) => { created += addPair(parent, 'father', index, fathers.length); });
    }
    if (mode === 'mother' || mode === 'both') {
      const mothers = state.people.filter(p => p.role === '모');
      mothers.forEach((parent, index) => { created += addPair(parent, 'mother', index, mothers.length); });
    }
    if (created) {
      state.cohabitBox = null;
      normalizeThreeGenerationLayout();
    }
    return created;
  }

  const previousSave = save;
  save = function (...args) {
    const created = injectGrandparentsIfPending();
    const result = previousSave.apply(this, args);
    if (created && typeof toast === 'function') {
      setTimeout(() => toast(`조부모 ${created}명을 자동 추가해 3대 가계도를 만들었습니다`), 0);
    }
    return result;
  };
})();
