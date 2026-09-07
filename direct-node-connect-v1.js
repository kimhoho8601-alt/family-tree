(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || !els.svg || !els.nodes) return;

  document.documentElement.dataset.directNodeConnect = 'v1';
  let firstId = null;
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
    els.nodes.querySelectorAll('.direct-connect-selected').forEach(node => node.classList.remove('direct-connect-selected'));
  }

  function markFirst(personId) {
    clearDirectSelection();
    firstId = personId;
    els.nodes.querySelector(`.node[data-id="${personId}"]`)?.classList.add('direct-connect-selected');
    const person = state.people.find(item => item.id === personId);
    if (typeof toast === 'function') toast(`${person?.name || '구성원'} 선택 · 연결할 다른 구성원을 클릭하세요`);
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
    if (event.button !== 0) { press = null; return; }
    if (typeof connectMode !== 'undefined' && (connectMode.active || connectMode.delete)) { press = null; return; }
    const node = event.target.closest?.('.node');
    press = node ? {id:node.dataset.id, x:event.clientX, y:event.clientY, pointerId:event.pointerId} : null;
  }, true);

  els.svg.addEventListener('pointerup', event => {
    if (!press || event.pointerId !== press.pointerId) return;
    const current = press;
    press = null;
    if (Math.hypot(event.clientX-current.x, event.clientY-current.y) > 6) return;
    if (typeof connectMode !== 'undefined' && (connectMode.active || connectMode.delete)) return;
    if (!state.people.some(person => person.id === current.id)) { clearDirectSelection(); return; }
    if (!firstId) { markFirst(current.id); return; }
    if (firstId === current.id) { clearDirectSelection(); return; }
    openChoice(firstId, current.id);
  }, true);

  els.svg.addEventListener('pointercancel', () => { press = null; }, true);
  els.svg.addEventListener('lostpointercapture', () => { press = null; }, true);
  els.svg.addEventListener('pointerdown', event => {
    if (!event.target.closest?.('.node') && firstId) clearDirectSelection();
  });
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
