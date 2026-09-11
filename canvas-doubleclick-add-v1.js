(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || typeof openPerson !== 'function') return;

  const svg = els.svg;
  const personForm = document.querySelector('#personForm');
  const personDialog = document.querySelector('#personDialog');
  const editPanel = document.querySelector('#editPanel');
  if (!svg || !personForm || !personDialog || !editPanel) return;

  document.documentElement.dataset.canvasDoubleClickAdd = 'v2';

  let pendingDoubleAdd = null;

  function isBlankCanvasTarget(target) {
    if (!(target instanceof Element) || !svg.contains(target)) return false;
    if (target.closest('.node,.relation-group,.cohabit-boundary-v3,.cohabit-boundary-members,.junction-handle,.smart-guide-layer,.cohabit-move-handle,.cohabit-resize-handle')) return false;
    return target === svg || target.parentElement === svg || target.classList.contains('canvas-grid');
  }

  function canOpenPersonDialog() {
    if (typeof connectMode !== 'undefined' && (connectMode?.active || connectMode?.delete)) return false;
    if (window.__COHABIT_PICK_MODE__) return false;
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

  function openExistingMember(node, event) {
    const person = state.people.find(p => p.id === node?.dataset?.id);
    if (!person || !canOpenPersonDialog()) return false;

    event.preventDefault();
    event.stopImmediatePropagation();

    // A double-click can finish a tiny drag first. Clear transient drag state so
    // opening the editor never moves the member underneath the dialog.
    if (typeof drag !== 'undefined') drag = null;

    pendingDoubleAdd = null;
    window.__PERSON_ADD_MODE__ = 'member-doubleclick-edit';
    if (!editPanel.classList.contains('active') && typeof activatePanel === 'function') activatePanel('editPanel');
    openPerson(person);
    return true;
  }

  // Existing member: double-click opens the same member-information dialog used
  // elsewhere in the editor. Handle this in capture phase so group selection,
  // drag helpers, or other editor extensions cannot swallow the gesture.
  svg.addEventListener('dblclick', event => {
    if (event.button !== 0) return;
    const node = event.target.closest?.('.node[data-id]');
    if (!node) return;
    openExistingMember(node, event);
  }, true);

  // editor-ux-v1 opens the member dialog on a blank-canvas single click.
  // Stop only that blank pointer-up path; dragging, nodes, lines and tools remain untouched.
  svg.addEventListener('pointerup', e => {
    if (!canOpenPersonDialog() || !isBlankCanvasTarget(e.target)) return;
    if (typeof drag !== 'undefined' && drag) return;
    e.stopImmediatePropagation();
  }, true);

  // Blank grid: keep the current double-click-to-add behavior.
  svg.addEventListener('dblclick', e => {
    if (e.button !== 0 || !canOpenPersonDialog() || !isBlankCanvasTarget(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    pendingDoubleAdd = {
      point: svgPointFromClient(e.clientX, e.clientY),
      beforeIds: new Set(state.people.map(p => p.id))
    };
    window.__PERSON_ADD_MODE__ = 'canvas-doubleclick';
    if (!editPanel.classList.contains('active') && typeof activatePanel === 'function') activatePanel('editPanel');
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
    if (window.__PERSON_ADD_MODE__ === 'canvas-doubleclick' || window.__PERSON_ADD_MODE__ === 'member-doubleclick-edit') {
      delete window.__PERSON_ADD_MODE__;
    }
  });
})();

// Loaded after every editor extension so parent-couple structural lines and
// relationship-quality lines can coexist without one replacing the other.
(() => {
  if (document.querySelector('script[data-parent-couple-layered-relation]')) return;
  const script = document.createElement('script');
  script.src = 'parent-couple-layered-relation-v1.js?v=20260907-2';
  script.async = false;
  script.dataset.parentCoupleLayeredRelation = 'v1';
  document.body.append(script);
})();
