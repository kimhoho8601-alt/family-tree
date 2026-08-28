(() => {
  const form = document.querySelector('#quickForm');
  if (!form || typeof state === 'undefined') return;

  const LIFE_OPTIONS = `
    <option value="alive">생존</option>
    <option value="dead">사망</option>
    <option value="unknown">미상</option>
  `;

  function ensureLifeField(card) {
    if (!card || card.querySelector('.aq-life')) return;
    const relationGrid = card.querySelector('.aq-box .aq-grid');
    if (!relationGrid) return;

    const label = document.createElement('label');
    label.className = 'aq-field aq-life-field';
    label.innerHTML = `<span>생존 상태</span><select class="aq-life">${LIFE_OPTIONS}</select>`;

    const cohabitField = card.querySelector('.aq-co-sel')?.closest('.aq-field');
    if (cohabitField?.parentElement === relationGrid) relationGrid.insertBefore(label, cohabitField);
    else relationGrid.append(label);
  }

  function syncFields() {
    form.querySelectorAll('#aqParents .aq-parent').forEach(ensureLifeField);
  }

  function captureParentLife() {
    const cards = [...form.querySelectorAll('#aqParents .aq-parent')];
    const fathers = cards.filter(c => c.dataset.kind === 'father').map(c => c.querySelector('.aq-life')?.value || 'alive');
    const mothers = cards.filter(c => c.dataset.kind === 'mother').map(c => c.querySelector('.aq-life')?.value || 'alive');
    return {fathers, mothers};
  }

  // This listener is intentionally registered before family-core-v8.
  // The legacy authoritative builder hardcodes parent life='alive'.
  // After that builder finishes, restore the exact existing life values selected in quick entry.
  window.addEventListener('submit', e => {
    if (e.target !== form) return;

    const selected = captureParentLife();
    const beforeIds = state.people.map(p => p.id).join('|');

    queueMicrotask(() => {
      const afterIds = state.people.map(p => p.id).join('|');
      if (!afterIds || afterIds === beforeIds) return;

      const fathers = state.people.filter(p => p.role === '부');
      const mothers = state.people.filter(p => p.role === '모');
      let changed = false;

      fathers.forEach((p, i) => {
        const life = selected.fathers[i] || 'alive';
        if (p.life !== life) { p.life = life; changed = true; }
      });
      mothers.forEach((p, i) => {
        const life = selected.mothers[i] || 'alive';
        if (p.life !== life) { p.life = life; changed = true; }
      });

      if (changed) {
        save();
        render();
      }

      document.documentElement.dataset.parentLifeApplied = changed ? 'yes' : 'no-change';
    });
  }, true);

  new MutationObserver(syncFields).observe(form, {childList:true, subtree:true});
  document.addEventListener('click', e => {
    if (e.target.closest('#aqAddFather,#aqAddMother,#aqResetInput,[data-rm]')) requestAnimationFrame(syncFields);
  });

  syncFields();
})();