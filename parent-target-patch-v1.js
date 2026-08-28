(() => {
  const form = document.querySelector('#quickForm');
  if (!form) return;

  function ensureNoneOption(select) {
    if (!select) return;
    if (![...select.options].some(o => o.value === '')) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '아동 부모로 연결 안 함 · 새부모 등';
      select.insertBefore(opt, select.firstChild);
    }
  }

  function syncKind(kind) {
    const cards = [...form.querySelectorAll(`#aqParents .aq-parent[data-kind="${kind}"]`)];
    cards.forEach((card, index) => {
      const select = card.querySelector('.aq-parent-target');
      if (!select) return;
      ensureNoneOption(select);

      const touched = card.dataset.parentTargetTouched === 'true';
      const initialized = card.dataset.parentTargetInitialized === 'true';

      if (!initialized) {
        card.dataset.parentTargetInitialized = 'true';
        card.dataset.primaryParentCard = index === 0 ? 'true' : 'false';
        // 첫 번째 부/모만 기본적으로 아동 부모로 연결한다.
        // 두 번째 이후 부/모는 새부모 가능성이 있으므로 기본값을 '연결 안 함'으로 둔다.
        select.value = index === 0 ? 'all' : '';
        return;
      }

      // advanced-quick의 refresh()가 빈 값을 지우고 다시 'all'로 되돌릴 수 있다.
      // 사용자가 직접 선택한 적이 없는 두 번째 이후 부모는 다시 미연결 상태로 복구한다.
      if (index > 0 && !touched) select.value = '';
      if (index === 0 && !touched && !select.value) select.value = 'all';
    });
  }

  function sync() {
    syncKind('father');
    syncKind('mother');
  }

  form.addEventListener('change', e => {
    if (!e.target.matches('.aq-parent-target')) return;
    const card = e.target.closest('.aq-parent');
    if (card) card.dataset.parentTargetTouched = 'true';
  }, true);

  form.addEventListener('click', e => {
    if (e.target.closest('#aqAddFather,#aqAddMother,#aqAddChild,[data-rm]')) {
      setTimeout(sync, 0);
    }
  });

  form.addEventListener('input', e => {
    if (e.target.matches('.aq-name')) setTimeout(sync, 0);
  });

  const observer = new MutationObserver(() => setTimeout(sync, 0));
  observer.observe(form, {childList:true, subtree:true});

  sync();
})();