(() => {
  if (typeof state === 'undefined' || typeof save !== 'function' || typeof render !== 'function') return;

  document.documentElement.dataset.deceasedCohabitRule = 'v1';

  function normalizeDeceasedCohabit() {
    let changed = false;
    state.people.forEach(p => {
      if (p?.life === 'dead' && p.cohabit === 'yes') {
        p.cohabit = 'no';
        changed = true;
      }
    });
    if (changed) state.cohabitBox = null;
    return changed;
  }

  const previousSave = save;
  save = function () {
    normalizeDeceasedCohabit();
    return previousSave();
  };

  if (normalizeDeceasedCohabit()) {
    previousSave();
    render();
    if (typeof toast === 'function') toast('사망 구성원은 현재 동거가족에서 제외했습니다');
  }

  if (!document.querySelector('script[data-quick-entry-simplify]')) {
    const s = document.createElement('script');
    s.src = 'quick-entry-simplify-v1.js?v=20260911-2';
    s.dataset.quickEntrySimplify = 'v1';
    document.body.append(s);
  }

  // New drawing flow: replace the old reset action with a clean blank-canvas reset.
  if (!document.querySelector('script[data-new-drawing-reset]')) {
    const s = document.createElement('script');
    s.src = 'new-drawing-reset-v1.js?v=20260911-1';
    s.dataset.newDrawingReset = 'v1';
    document.body.append(s);
  }

  // Remove editor-only guidance text from ecology PNG exports while keeping it on screen.
  if (!document.querySelector('script[data-export-cleanup]')) {
    const s = document.createElement('script');
    s.src = 'export-cleanup-v1.js?v=20260911-1';
    s.dataset.exportCleanup = 'v1';
    document.body.append(s);
  }
})();
