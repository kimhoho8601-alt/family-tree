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

  // Normalize older browser/project data immediately as well.
  if (normalizeDeceasedCohabit()) {
    previousSave();
    render();
    if (typeof toast === 'function') toast('사망 구성원은 현재 동거가족에서 제외했습니다');
  }

  // Final editor extension: optional relationship selection while adding a member.
  // Load it late so every add-person entry path uses the same existing person dialog.
  if (!document.querySelector('script[data-member-add-relation]')) {
    const s = document.createElement('script');
    s.src = 'member-add-relation-v1.js?v=20260828-1718';
    s.dataset.memberAddRelation = 'v1';
    document.body.append(s);
  }
})();