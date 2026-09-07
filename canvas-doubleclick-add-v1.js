(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || typeof openPerson !== 'function') return;

  const svg = els.svg;
  const personForm = document.querySelector('#personForm');
  const personDialog = document.querySelector('#personDialog');
  const editPanel = document.querySelector('#editPanel');
  if (!svg || !personForm || !personDialog || !editPanel) return;

  document.documentElement.dataset.canvasDoubleClickAdd = 'v1';

  let pendingDoubleAdd = null;

  function isBlankCanvasTarget(target) {
    if (!(target instanceof Element) || !svg.contains(target)) return false;
    if (target.closest('.node,.relation-group,.cohabit-boundary-v3,.junction-handle,.smart-guide-layer,.cohabit-move-handle,.cohabit-resize-handle')) return false;
    return target === svg || target.parentElement === svg || target.classList.contains('canvas-grid');
  }

  function canQuickAdd() {
    if (!editPanel.classList.contains('active')) return false;
    if (typeof connectMode !== 'undefined' && (connectMode?.active || connectMode?.delete)) return false;
    return !personDialog.open;
  }

  function svgPointFromClient(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return {x:600, y:360};
    return {
      x: Math.max(55, Math.min(1145, (clientX - rect.left) * 1200 / rect.width)),
      y: Math.max(55, Math.min(665, (clientY - rect.top) * 720 / rect.height))
    };
  }

  // editor-ux-v1 opens the member dialog on a blank-canvas single click.
  // Stop only that blank pointer-up path; dragging, nodes, lines and tools remain untouched.
  svg.addEventListener('pointerup', e => {
    if (!canQuickAdd() || !isBlankCanvasTarget(e.target)) return;
    if (typeof drag !== 'undefined' && drag) return;
    e.stopImmediatePropagation();
  }, true);

  svg.addEventListener('dblclick', e => {
    if (e.button !== 0 || !canQuickAdd() || !isBlankCanvasTarget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    pendingDoubleAdd = {
      point: svgPointFromClient(e.clientX, e.clientY),
      beforeIds: new Set(state.people.map(p => p.id))
    };
    window.__PERSON_ADD_MODE__ = 'canvas-doubleclick';
    openPerson();
  }, true);

  personForm.addEventListener('submit', () => {
    if (!pendingDoubleAdd) return;
    const pending = pendingDoubleAdd;
    pendingDoubleAdd = null;
    queueMicrotask(() => {
      const created = state.people.find(p => !pending.beforeIds.has(p.id));
      if (!created) return;
      created.x = pending.point.x;
      created.y = pending.point.y;
      if (typeof window.__historySync === 'function') window.__historySync();
      else if (typeof save === 'function') save();
      if (typeof render === 'function') render();
    });
  });

  personDialog.addEventListener('close', () => {
    pendingDoubleAdd = null;
    if (window.__PERSON_ADD_MODE__ === 'canvas-doubleclick') delete window.__PERSON_ADD_MODE__;
  });
})();

// Loaded after every editor extension so parent-couple structural lines and
// relationship-quality lines can coexist without one replacing the other.
(() => {
  if (document.querySelector('script[data-parent-couple-layered-relation]')) return;
  const script = document.createElement('script');
  script.src = 'parent-couple-layered-relation-v1.js?v=20260907-1';
  script.async = false;
  script.dataset.parentCoupleLayeredRelation = 'v1';
  document.body.append(script);
})();
