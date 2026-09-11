(() => {
  if (typeof state === 'undefined' || typeof save !== 'function' || typeof render !== 'function') return;

  const resetBtn = document.querySelector('#resetBtn');
  if (!resetBtn) return;

  const ECO_STORAGE_KEYS = [
    'case-relationship-studio-combined-v1',
    'case-relationship-studio-ecomap-v1'
  ];

  resetBtn.textContent = '새로 그리기';
  resetBtn.setAttribute('aria-label', '가계도와 생태도를 모두 비우고 새로 그리기');

  function resetQuickForm() {
    const form = document.querySelector('#quickForm');
    if (!form) return;

    const children = [...form.querySelectorAll('#aqChildren .aq-child')];
    children.slice(1).forEach(card => card.remove());
    const first = children[0];
    if (first) {
      const name = first.querySelector('.aq-name');
      const age = first.querySelector('.aq-age');
      const male = first.querySelector('input[type="radio"][value="male"]');
      const cohabit = first.querySelector('.aq-co');
      if (name) name.value = '대상아동';
      if (age) age.value = '';
      if (male) male.checked = true;
      if (cohabit) cohabit.checked = true;
    }

    form.querySelectorAll('#aqParents .aq-parent').forEach(card => card.remove());
    form.querySelectorAll('#aqExtras .aq-extra').forEach(card => card.remove());
    form.querySelectorAll('#aqRels .aq-adultrel').forEach(card => card.remove());

    document.querySelector('#aqAddFather')?.click();
    document.querySelector('#aqAddMother')?.click();
    form.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clearTransientEditorState() {
    window.__COHABIT_PICK_MODE__ = false;
    document.querySelector('#cohabitSelectionBar')?.setAttribute('hidden', '');
    document.querySelector('#connectionBar')?.setAttribute('hidden', '');
    document.querySelector('#cohabitSelectBtn')?.classList.remove('active-tool');
    document.querySelector('#relationBtn')?.classList.remove('active-tool');
    document.querySelector('#deleteLineBtn')?.classList.remove('active-tool');

    if (typeof stopConnection === 'function') stopConnection();
    if (typeof selectedRelationIds !== 'undefined') selectedRelationIds = [];
    if (typeof drag !== 'undefined') drag = null;
  }

  function hasEcologyContent() {
    return ECO_STORAGE_KEYS.some(key => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (!value || typeof value !== 'object') return false;
        if (Array.isArray(value.resources) && value.resources.length) return true;
        if (Array.isArray(value.systems) && value.systems.length) return true;
        return false;
      } catch {
        return !!localStorage.getItem(key);
      }
    });
  }

  function clearEcologyState() {
    ECO_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
  }

  resetBtn.onclick = event => {
    event.preventDefault();

    const hasContent = state.people.length ||
      state.relations.length ||
      (state.cohabitMemberIds || []).length ||
      hasEcologyContent();

    if (hasContent && !confirm('가계도와 생태도 작업을 모두 비우고 새로 그릴까요?\n저장하지 않은 내용은 모두 사라집니다.')) return;

    clearTransientEditorState();

    // Reset the genogram state first so the empty state is persisted.
    state.people = [];
    state.relations = [];
    state.zoom = 1;
    state.cohabitMemberIds = [];
    state.cohabitSelectionVersion = 2;
    state.cohabitBox = null;
    save();

    // The combined/ecology editors keep their own in-memory state and localStorage.
    // Clear those stores explicitly, then reload once so every editor reinitializes
    // from a genuinely blank state instead of keeping stale resource objects alive.
    clearEcologyState();
    resetQuickForm();

    try {
      sessionStorage.setItem('case-relationship-studio-reset-toast', '1');
    } catch {}

    window.location.reload();
  };

  try {
    if (sessionStorage.getItem('case-relationship-studio-reset-toast') === '1') {
      sessionStorage.removeItem('case-relationship-studio-reset-toast');
      requestAnimationFrame(() => {
        if (typeof toast === 'function') toast('가계도와 생태도를 모두 초기화했습니다');
      });
    }
  } catch {}
})();
