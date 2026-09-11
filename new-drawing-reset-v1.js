(() => {
  if (typeof state === 'undefined' || typeof save !== 'function' || typeof render !== 'function') return;

  const resetBtn = document.querySelector('#resetBtn');
  if (!resetBtn) return;

  resetBtn.textContent = '새로 그리기';
  resetBtn.setAttribute('aria-label', '현재 가계도를 비우고 새로 그리기');

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

  resetBtn.onclick = event => {
    event.preventDefault();

    const hasContent = state.people.length || state.relations.length || (state.cohabitMemberIds || []).length;
    if (hasContent && !confirm('현재 가계도를 모두 비우고 새로 그릴까요?\n저장하지 않은 내용은 사라집니다.')) return;

    clearTransientEditorState();

    state.people = [];
    state.relations = [];
    state.zoom = 1;
    state.cohabitMemberIds = [];
    state.cohabitSelectionVersion = 2;
    state.cohabitBox = null;

    save();
    resetQuickForm();
    render();

    if (typeof activatePanel === 'function') activatePanel('quickPanel');
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.scrollTop = 0;

    if (typeof toast === 'function') toast('빈 가계도로 초기화했습니다');
  };
})();
