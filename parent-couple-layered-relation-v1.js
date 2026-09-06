(() => {
  if (typeof state === 'undefined' || !Array.isArray(state.relations)) return;

  document.documentElement.dataset.parentCoupleLayeredRelation = 'v1';

  const STRUCTURAL = new Set(['marriage','separated','divorced']);
  const OPTIONAL = new Set(['distant','close','conflict']);
  const LABEL = {
    distant: '소원·불명확',
    close: '친밀·지지',
    conflict: '갈등·적대'
  };
  const makeId = () => typeof id === 'function'
    ? id()
    : (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));

  const samePair = (r, a, b) =>
    (r.from === a && r.to === b) || (r.from === b && r.to === a);

  function sharedChildren(a, b) {
    const childrenA = new Set(
      state.relations.filter(r => r.type === 'parent' && r.from === a).map(r => r.to)
    );
    return state.relations
      .filter(r => r.type === 'parent' && r.from === b && childrenA.has(r.to))
      .map(r => r.to);
  }

  function isParentCoupleRelation(relation) {
    return !!relation && sharedChildren(relation.from, relation.to).length > 0;
  }

  function addOrReplaceOptional(from, to, nextType) {
    const existing = state.relations.find(r => samePair(r, from, to) && OPTIONAL.has(r.type));
    if (existing) {
      existing.type = nextType;
      existing.relationRole = 'relationship-quality';
      return existing;
    }
    const created = {
      id: makeId(),
      from,
      to,
      type: nextType,
      relationRole: 'relationship-quality'
    };
    state.relations.push(created);
    return created;
  }

  function persistLayeredQuality(relation, nextType, dialog) {
    addOrReplaceOptional(relation.from, relation.to, nextType);
    dialog?.close?.();
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    if (typeof toast === 'function') {
      toast(`기본 부모 관계선은 유지하고 ${LABEL[nextType] || '관계 특성'}을 추가했습니다`);
    }
  }

  // Main "선 수정" dialog.
  const editForm = document.querySelector('#relationEditForm');
  if (editForm) {
    editForm.addEventListener('submit', event => {
      const rid = document.querySelector('#editRelationId')?.value;
      const relation = state.relations.find(r => r.id === rid);
      const nextType = document.querySelector('#editRelationType')?.value;
      if (!relation || !nextType) return;

      if (STRUCTURAL.has(relation.type) && OPTIONAL.has(nextType) && isParentCoupleRelation(relation)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        persistLayeredQuality(relation, nextType, document.querySelector('#relationEditDialog'));
      }
    }, true);
  }

  // Legacy/advanced double-click relation dialog also needs the same rule.
  let quickRelationId = null;
  const relationLayer = typeof els !== 'undefined' ? els.relations : document.querySelector('#relationLayer');
  if (relationLayer) {
    relationLayer.addEventListener('dblclick', event => {
      const group = event.target.closest?.('.relation-group[data-relation]');
      quickRelationId = group?.dataset.relation || null;
    }, true);
  }

  const quickForm = document.querySelector('#quickRelationEditForm');
  if (quickForm) {
    quickForm.addEventListener('submit', event => {
      const relation = state.relations.find(r => r.id === quickRelationId);
      const nextType = document.querySelector('#quickRelationType')?.value;
      if (!relation || !nextType) return;

      if (STRUCTURAL.has(relation.type) && OPTIONAL.has(nextType) && isParentCoupleRelation(relation)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        persistLayeredQuality(relation, nextType, quickForm.closest('dialog'));
        quickRelationId = null;
      }
    }, true);
  }

  // Clarify the behavior when a parent-couple structural line is being edited.
  document.addEventListener('click', event => {
    const editButton = event.target.closest?.('[data-edit-rel]');
    if (!editButton) return;
    const relation = state.relations.find(r => r.id === editButton.dataset.editRel);
    if (!relation || !STRUCTURAL.has(relation.type) || !isParentCoupleRelation(relation)) return;
    queueMicrotask(() => {
      const help = document.querySelector('#relationEditDialog .relation-edit-help');
      const pair = document.querySelector('#relationEditDialog .relation-pair-card small');
      if (help) help.textContent = '이 선은 자녀의 부모 구조선입니다. 친밀·갈등·소원을 선택하면 기본 관계선은 유지되고 관계 특성이 별도로 추가됩니다.';
      if (pair) pair.textContent = '부모 구조는 유지하고, 필요한 관계 특성만 겹쳐 표시할 수 있습니다.';
    });
  });
})();
