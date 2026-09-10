(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || !els.svg || !els.nodes) return;

  document.documentElement.dataset.directNodeConnect = 'v1';
  let firstId = null;
  let firstUnion = null;
  let press = null;

  const style = document.createElement('style');
  style.textContent = `
    .node.direct-connect-selected .shape,.node.direct-connect-selected .outer{
      stroke:#c9002b!important;stroke-width:5!important;
      filter:drop-shadow(0 0 4px rgba(201,0,43,.2));
    }
  `;
  document.head.append(style);

  function clearDirectSelection() {
    firstId = null;
    firstUnion = null;
    els.nodes.querySelectorAll('.direct-connect-selected').forEach(node => node.classList.remove('direct-connect-selected'));
    els.relations.querySelectorAll('.union-selected').forEach(group => group.classList.remove('union-selected'));
  }

  function markFirst(personId) {
    clearDirectSelection();
    firstId = personId;
    els.nodes.querySelector(`.node[data-id="${personId}"]`)?.classList.add('direct-connect-selected');
    const person = state.people.find(item => item.id === personId);
    if (typeof toast === 'function') toast(`${person?.name || '구성원'} 선택 · 연결할 다른 구성원을 클릭하세요`);
  }

  function markUnion(group) {
    const relation = state.relations.find(item => item.id === group?.dataset.relation);
    if (!relation || relation.type === 'parent') return false;
    clearDirectSelection();
    firstUnion = [relation.from, relation.to];
    group.classList.add('union-selected');
    const a = state.people.find(person => person.id === relation.from);
    const b = state.people.find(person => person.id === relation.to);
    if (typeof toast === 'function') toast(`${a?.name || '부모'} + ${b?.name || '부모'} 선택 · 연결할 자녀를 클릭하세요`);
    return true;
  }

  function openChoice(from, to) {
    if (typeof pendingConnection === 'undefined' || !els.lineChoiceDialog) return;
    const a = state.people.find(person => person.id === from);
    const b = state.people.find(person => person.id === to);
    pendingConnection = {from, to};
    const pair = document.querySelector('#selectedPair');
    if (pair) pair.textContent = `${a?.name || '구성원'} ↔ ${b?.name || '구성원'}`;
    clearDirectSelection();
    els.lineChoiceDialog.showModal();
  }

  els.svg.addEventListener('pointerdown', event => {
    if (window.__COHABIT_PICK_MODE__) { press = null; return; }
    if (event.pointerType !== 'touch' && event.button !== 0) { press = null; return; }
    if (typeof connectMode !== 'undefined' && (connectMode.active || connectMode.delete)) { press = null; return; }
    const node = event.target.closest?.('.node');
    const junction = event.target.closest?.('.junction-handle');
    const group = junction?.closest?.('.relation-group[data-relation]');
    press = node ? {kind:'node',id:node.dataset.id,x:event.clientX,y:event.clientY,pointerId:event.pointerId}
      : group ? {kind:'union',group,x:event.clientX,y:event.clientY,pointerId:event.pointerId} : null;
  }, true);

  els.svg.addEventListener('pointerup', event => {
    if (window.__COHABIT_PICK_MODE__) { press = null; return; }
    if (!press || event.pointerId !== press.pointerId) return;
    const current = press;
    press = null;
    if (Math.hypot(event.clientX-current.x, event.clientY-current.y) > 6) return;
    if (typeof connectMode !== 'undefined' && (connectMode.active || connectMode.delete)) return;
    if (current.kind === 'union') {
      if (firstId) {
        const relation = state.relations.find(item => item.id === current.group.dataset.relation);
        if (relation && relation.type !== 'parent' && typeof connectUnionToChild === 'function') connectUnionToChild([relation.from, relation.to], firstId);
        clearDirectSelection();
        return;
      }
      markUnion(current.group);
      return;
    }
    if (!state.people.some(person => person.id === current.id)) { clearDirectSelection(); return; }
    if (firstUnion) {
      const parents = [...firstUnion];
      clearDirectSelection();
      if (typeof connectUnionToChild === 'function') connectUnionToChild(parents, current.id);
      return;
    }
    if (!firstId) { markFirst(current.id); return; }
    if (firstId === current.id) { clearDirectSelection(); return; }
    const alreadyConnected=state.relations.some(relation=>(relation.from===firstId&&relation.to===current.id)||(relation.from===current.id&&relation.to===firstId));
    if(alreadyConnected){const a=state.people.find(person=>person.id===firstId),b=state.people.find(person=>person.id===current.id);clearDirectSelection();if(typeof toast==='function')toast(`${a?.name||'구성원'}와 ${b?.name||'구성원'}은 이미 연결되어 있습니다`);return;}
    openChoice(firstId, current.id);
  }, true);

  els.svg.addEventListener('pointercancel', () => { press = null; }, true);
  els.svg.addEventListener('lostpointercapture', () => { press = null; }, true);
  els.svg.addEventListener('pointerdown', event => {
    if (!event.target.closest?.('.node,.junction-handle') && (firstId || firstUnion)) clearDirectSelection();
  });
  els.relations.addEventListener('click', event => {
    if (!event.target.closest?.('.junction-handle')) return;
    if (typeof connectMode !== 'undefined' && (connectMode.active || connectMode.delete)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  document.querySelector('#relationBtn')?.addEventListener('click', clearDirectSelection, true);
  els.lineChoiceDialog?.addEventListener('close', clearDirectSelection);

  const currentRender = render;
  render = function(...args) {
    const result = currentRender.apply(this, args);
    if (firstId && state.people.some(person => person.id === firstId)) {
      els.nodes.querySelector(`.node[data-id="${firstId}"]`)?.classList.add('direct-connect-selected');
    } else {
      firstId = null;
    }
    return result;
  };
})();
