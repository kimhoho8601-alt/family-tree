(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || typeof save !== 'function' || typeof render !== 'function') return;

  const svg = els.svg;
  const personForm = document.querySelector('#personForm');
  const personDialog = document.querySelector('#personDialog');
  const editPanel = document.querySelector('#editPanel');
  const ns = 'http://www.w3.org/2000/svg';
  if (!svg || !personForm || !personDialog) return;

  document.documentElement.dataset.editorUx = 'v1';

  // -----------------------------
  // Undo / Redo history
  // -----------------------------
  const HISTORY_LIMIT = 60;
  const GROUP_WINDOW_MS = 320;
  const undoStack = [];
  const redoStack = [];
  let restoring = false;
  let historySuspended = false;
  let lastSnapshot = JSON.stringify(state);
  let lastHistoryAt = 0;

  const originalSave = save;

  function snapshot() {
    return JSON.stringify(state);
  }

  function trim(stack) {
    if (stack.length > HISTORY_LIMIT) stack.splice(0, stack.length - HISTORY_LIMIT);
  }

  save = function () {
    const current = snapshot();
    if (!restoring && !historySuspended && current !== lastSnapshot) {
      const now = Date.now();
      if (!undoStack.length || now - lastHistoryAt > GROUP_WINDOW_MS) {
        undoStack.push(lastSnapshot);
        trim(undoStack);
      }
      lastHistoryAt = now;
      redoStack.length = 0;
    }
    lastSnapshot = current;
    const result = originalSave();
    updateMenuState();
    return result;
  };

  function applySnapshot(serialized, sourceStack, targetStack, message) {
    if (!serialized) return;
    const current = snapshot();
    targetStack.push(current);
    trim(targetStack);

    let parsed;
    try { parsed = JSON.parse(serialized); } catch { return; }

    restoring = true;
    historySuspended = true;
    try {
      Object.keys(state).forEach(key => delete state[key]);
      Object.assign(state, parsed);
      state.people = Array.isArray(state.people) ? state.people : [];
      state.relations = Array.isArray(state.relations) ? state.relations : [];
      state.zoom = Number(state.zoom) || 1;
      window.__QUICK_PARENT_LIFE__ = null;
      lastSnapshot = JSON.stringify(state);
      originalSave();
      render();
    } finally {
      historySuspended = false;
      restoring = false;
    }
    toast(message);
    updateMenuState();
  }

  function undo() {
    const target = undoStack.pop();
    if (!target) { toast('되돌릴 작업이 없습니다'); return; }
    applySnapshot(target, undoStack, redoStack, '이전 작업으로 되돌렸습니다');
  }

  function redo() {
    const target = redoStack.pop();
    if (!target) { toast('다시 실행할 작업이 없습니다'); return; }
    const current = snapshot();
    undoStack.push(current);
    trim(undoStack);

    let parsed;
    try { parsed = JSON.parse(target); } catch { return; }
    restoring = true;
    historySuspended = true;
    try {
      Object.keys(state).forEach(key => delete state[key]);
      Object.assign(state, parsed);
      state.people = Array.isArray(state.people) ? state.people : [];
      state.relations = Array.isArray(state.relations) ? state.relations : [];
      state.zoom = Number(state.zoom) || 1;
      window.__QUICK_PARENT_LIFE__ = null;
      lastSnapshot = JSON.stringify(state);
      originalSave();
      render();
    } finally {
      historySuspended = false;
      restoring = false;
    }
    toast('되돌린 작업을 다시 실행했습니다');
    updateMenuState();
  }

  // -----------------------------
  // Canvas click -> add member at clicked position
  // -----------------------------
  let pendingCanvasAdd = null;
  let blankPointerDown = null;

  function svgPointFromClient(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return {x:600, y:360};
    return {
      x: Math.max(55, Math.min(1145, (clientX - rect.left) * 1200 / rect.width)),
      y: Math.max(55, Math.min(665, (clientY - rect.top) * 720 / rect.height))
    };
  }

  function isBlankCanvasTarget(target) {
    if (!(target instanceof Element)) return false;
    if (!svg.contains(target)) return false;
    if (target.closest('.node,.relation-group,.cohabit-boundary-v3,.junction-handle,.smart-guide-layer,.cohabit-move-handle,.cohabit-resize-handle')) return false;
    return target === svg || target.parentElement === svg || target.classList.contains('canvas-grid');
  }

  function canQuickAdd() {
    if (!editPanel?.classList.contains('active')) return false;
    if (typeof connectMode !== 'undefined' && (connectMode?.active || connectMode?.delete)) return false;
    if (personDialog.open) return false;
    return true;
  }

  function openPersonAt(clientX, clientY) {
    if (!canQuickAdd()) return;
    const point = svgPointFromClient(clientX, clientY);
    pendingCanvasAdd = {
      point,
      beforeIds: new Set(state.people.map(p => p.id))
    };
    openPerson();
  }

  svg.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !canQuickAdd() || !isBlankCanvasTarget(e.target)) {
      blankPointerDown = null;
      return;
    }
    blankPointerDown = {x:e.clientX, y:e.clientY, target:e.target};
  }, true);

  svg.addEventListener('pointerup', e => {
    if (!blankPointerDown) return;
    const start = blankPointerDown;
    blankPointerDown = null;
    if (!canQuickAdd() || !isBlankCanvasTarget(e.target)) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
    // Do not react to the end of node/boundary drag operations.
    if (typeof drag !== 'undefined' && drag) return;
    openPersonAt(e.clientX, e.clientY);
  });

  personForm.addEventListener('submit', () => {
    if (!pendingCanvasAdd) return;
    const pending = pendingCanvasAdd;
    pendingCanvasAdd = null;

    // Existing app submit listener runs first and creates the person.
    queueMicrotask(() => {
      const created = state.people.find(p => !pending.beforeIds.has(p.id));
      if (!created) return;
      created.x = pending.point.x;
      created.y = pending.point.y;

      // Positioning is part of the same add-member action, not a second undo step.
      historySuspended = true;
      try {
        lastSnapshot = snapshot();
        originalSave();
        render();
      } finally {
        historySuspended = false;
      }
    });
  });

  personDialog.addEventListener('close', () => {
    pendingCanvasAdd = null;
  });

  // -----------------------------
  // Right-click context menu
  // -----------------------------
  const style = document.createElement('style');
  style.textContent = `
    .editor-context-menu{position:fixed;z-index:99999;min-width:188px;padding:6px;background:#fff;border:1px solid #e5dadd;border-radius:11px;box-shadow:0 14px 34px rgba(47,30,35,.18);display:none;font-family:'IBM Plex Sans KR',sans-serif}
    .editor-context-menu.show{display:block}
    .editor-context-item{width:100%;height:36px;display:flex;align-items:center;justify-content:space-between;gap:18px;border:0;border-radius:7px;background:transparent;padding:0 10px;color:#342a2c;font-size:12px;text-align:left;cursor:pointer}
    .editor-context-item:hover:not(:disabled){background:#fff1f4;color:#b00035}
    .editor-context-item:disabled{opacity:.38;cursor:default}
    .editor-context-shortcut{font-size:10px;color:#918487}
    .editor-context-sep{height:1px;background:#eee5e7;margin:5px 4px}
  `;
  document.head.append(style);

  const menu = document.createElement('div');
  menu.className = 'editor-context-menu';
  menu.setAttribute('role','menu');
  menu.innerHTML = `
    <button type="button" class="editor-context-item" data-action="undo"><span>↶ 되돌리기</span><span class="editor-context-shortcut">Ctrl+Z</span></button>
    <button type="button" class="editor-context-item" data-action="redo"><span>↷ 다시 실행</span><span class="editor-context-shortcut">Ctrl+Y</span></button>
    <div class="editor-context-sep"></div>
    <button type="button" class="editor-context-item" data-action="add"><span>＋ 이 위치에 구성원 추가</span><span></span></button>
  `;
  document.body.append(menu);

  let contextPoint = null;
  const undoButton = menu.querySelector('[data-action="undo"]');
  const redoButton = menu.querySelector('[data-action="redo"]');
  const addButton = menu.querySelector('[data-action="add"]');

  function updateMenuState() {
    if (!menu) return;
    undoButton.disabled = undoStack.length === 0;
    redoButton.disabled = redoStack.length === 0;
  }

  function hideMenu() {
    menu.classList.remove('show');
    contextPoint = null;
  }

  function showMenu(e) {
    updateMenuState();
    contextPoint = {clientX:e.clientX, clientY:e.clientY, blank:isBlankCanvasTarget(e.target)};
    addButton.style.display = contextPoint.blank && canQuickAdd() ? '' : 'none';
    menu.classList.add('show');
    menu.style.left = '0px';
    menu.style.top = '0px';
    const width = menu.offsetWidth, height = menu.offsetHeight;
    menu.style.left = `${Math.min(e.clientX, window.innerWidth - width - 10)}px`;
    menu.style.top = `${Math.min(e.clientY, window.innerHeight - height - 10)}px`;
  }

  document.querySelector('#canvasWrap')?.addEventListener('contextmenu', e => {
    e.preventDefault();
    showMenu(e);
  });

  menu.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    const point = contextPoint;
    hideMenu();
    if (action === 'undo') undo();
    else if (action === 'redo') redo();
    else if (action === 'add' && point) openPersonAt(point.clientX, point.clientY);
  });

  document.addEventListener('pointerdown', e => {
    if (!menu.contains(e.target)) hideMenu();
  });
  window.addEventListener('blur', hideMenu);
  window.addEventListener('resize', hideMenu);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hideMenu(); return; }
    const target = e.target;
    const editable = target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable);
    if (editable) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((e.key.toLowerCase() === 'y') || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
      e.preventDefault();
      redo();
    }
  });

  updateMenuState();
})();