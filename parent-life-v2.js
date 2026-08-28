(() => {
  const form = document.querySelector('#quickForm');
  if (!form || typeof state === 'undefined') return;

  const LIFE_OPTIONS = `
    <option value="alive">생존</option>
    <option value="dead">사망</option>
    <option value="unknown">미상</option>
  `;
  const normalizeLife = value => ['alive','dead','unknown'].includes(value) ? value : 'alive';

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
    syncFields();
    const cards = [...form.querySelectorAll('#aqParents .aq-parent')];
    return {
      fathers: cards.filter(c => c.dataset.kind === 'father').map(c => normalizeLife(c.querySelector('.aq-life')?.value)),
      mothers: cards.filter(c => c.dataset.kind === 'mother').map(c => normalizeLife(c.querySelector('.aq-life')?.value))
    };
  }

  function applyCapturedLife() {
    const selected = window.__QUICK_PARENT_LIFE__;
    if (!selected) return false;

    const fathers = state.people.filter(p => p.role === '부');
    const mothers = state.people.filter(p => p.role === '모');
    if (!fathers.length && !mothers.length) return false;

    let changed = false;
    fathers.forEach((p, i) => {
      const life = normalizeLife(selected.fathers?.[i]);
      if (p.life !== life) { p.life = life; changed = true; }
    });
    mothers.forEach((p, i) => {
      const life = normalizeLife(selected.mothers?.[i]);
      if (p.life !== life) { p.life = life; changed = true; }
    });
    return changed;
  }

  // 빠른 작성 submit은 여러 레거시 빌더 중 무엇이 실행되더라도,
  // 렌더 직전에 선택한 생존 상태를 state.people에 강제로 반영한다.
  // 세부 편집은 __QUICK_PARENT_LIFE__를 설정하지 않으므로 기존 동작에 영향이 없다.
  window.addEventListener('submit', e => {
    if (e.target !== form) return;
    window.__QUICK_PARENT_LIFE__ = captureParentLife();
    document.documentElement.dataset.quickParentLifeCaptured = 'yes';
  }, true);

  if (typeof render === 'function') {
    const previousRender = render;
    render = function() {
      const changed = applyCapturedLife();
      const result = previousRender();
      if (window.__QUICK_PARENT_LIFE__) {
        const deadExpected = [
          ...(window.__QUICK_PARENT_LIFE__.fathers || []),
          ...(window.__QUICK_PARENT_LIFE__.mothers || [])
        ].filter(v => v === 'dead').length;
        const deadState = state.people.filter(p => ['부','모'].includes(p.role) && p.life === 'dead').length;
        const deadDom = document.querySelectorAll('#nodeLayer .node.dead').length;
        document.documentElement.dataset.quickParentLifeCheck = deadExpected === deadState && deadState === deadDom ? 'ok' : 'mismatch';
        window.__LAST_QUICK_PARENT_LIFE_CHECK = {selected:window.__QUICK_PARENT_LIFE__, deadExpected, deadState, deadDom};
      }
      if (changed && typeof save === 'function') save();
      return result;
    };
  }

  // 혹시 렌더 없이 먼저 저장하는 레거시 경로도 있으므로 save 직전에도 보정한다.
  if (typeof save === 'function') {
    const previousSave = save;
    save = function() {
      applyCapturedLife();
      return previousSave();
    };
  }

  // 빠른 작성 이외의 세부 편집이 시작되면 이전 캡처값을 제거해 간섭하지 않게 한다.
  document.querySelector('#personForm')?.addEventListener('submit', () => {
    window.__QUICK_PARENT_LIFE__ = null;
  }, true);

  new MutationObserver(syncFields).observe(form, {childList:true, subtree:true});
  document.addEventListener('click', e => {
    if (e.target.closest('#aqAddFather,#aqAddMother,#aqResetInput,[data-rm]')) requestAnimationFrame(syncFields);
  });

  syncFields();
})();