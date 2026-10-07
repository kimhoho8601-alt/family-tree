(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined') return;
  const q = selector => document.querySelector(selector);
  const structural = new Set(['marriage', 'separated', 'divorced']);
  const person = pid => state.people.find(item => item.id === pid);
  let parentIds = null;

  const dialog = document.createElement('dialog');
  dialog.id = 'parentChildAddDialog';
  dialog.setAttribute('aria-labelledby', 'parentChildAddTitle');
  dialog.innerHTML = `<form id="parentChildAddForm">
    <div class="dialog-head"><div><p class="eyebrow">ADD CHILD</p><h2 id="parentChildAddTitle">자녀 추가</h2><p class="selected-pair" id="parentChildAddPair"></p></div><button type="button" class="dialog-close" data-child-close aria-label="닫기">×</button></div>
    <div class="form-grid">
      <label><span>식별명</span><input id="newChildName" required maxlength="20" placeholder="예: 자녀 2"></label>
      <label><span>나이·출생연도</span><input id="newChildAge" maxlength="20" placeholder="예: 8세"></label>
      <fieldset class="full"><legend>성별</legend><div class="gender-choice"><label><input type="radio" name="newChildGender" value="male" checked><span>□ 남성</span></label><label><input type="radio" name="newChildGender" value="female"><span>○ 여성</span></label><label><input type="radio" name="newChildGender" value="unknown"><span>◇ 미상</span></label></div></fieldset>
      <label><span>생존 상태</span><select id="newChildLife"><option value="alive">생존</option><option value="dead">사망</option><option value="unknown">미상</option></select></label>
      <label><span>동거 여부</span><select id="newChildCohabit"><option value="yes">동거</option><option value="no">비동거</option><option value="unknown">미상</option></select></label>
      <label class="full"><span>대상아동 여부</span><select id="newChildClient"><option value="no">일반 자녀 · 클라이언트 표시 없음</option><option value="yes">대상아동 · 클라이언트 표시</option></select></label>
      <label class="full"><span>메모</span><textarea id="newChildNote" maxlength="180"></textarea></label>
    </div><p class="relation-edit-help">선택한 부모에게 자동 연결됩니다. 대상아동은 기호에 이중 테두리로 표시됩니다.</p>
    <div class="dialog-actions"><button type="button" class="button ghost" data-child-close>취소</button><button type="submit" class="button primary">자녀 추가</button></div>
  </form>`;
  document.body.append(dialog);
  const form = q('#parentChildAddForm');

  function parentsForGroup(group) {
    if (!group || !els.relations.contains(group)) return null;
    const relation = state.relations.find(item => item.id === group.dataset.relation);
    if (relation && structural.has(relation.type)) return [relation.from, relation.to];
    // Existing files may have a generated couple line without a marriage record.
    if (relation || group.classList.contains('parent-group')) return null;
    const path = group.querySelector('.relation.marriage,.relation.separated,.relation.divorced');
    const points = path?.getAttribute('d')?.match(/^M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*L\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/i);
    if (!points) return null;
    const a = state.people.find(item => Math.abs(item.x - Number(points[1])) < 2 && Math.abs(item.y - Number(points[2])) < 2);
    const b = state.people.find(item => Math.abs(item.x - Number(points[3])) < 2 && Math.abs(item.y - Number(points[4])) < 2);
    return a && b && a.id !== b.id ? [a.id, b.id] : null;
  }

  function openChild(ids) {
    if (ids.length !== 2 || ids.some(pid => !person(pid))) return;
    parentIds = [...ids];
    if (typeof stopConnection === 'function') stopConnection();
    document.dispatchEvent(new CustomEvent('child-add-open'));
    if (typeof selectedRelationIds !== 'undefined') selectedRelationIds = [];
    form.reset();
    q('#parentChildAddPair').textContent = `${person(ids[0]).name} + ${person(ids[1]).name}의 자녀`;
    dialog.showModal();
    requestAnimationFrame(() => q('#newChildName').focus());
  }

  document.addEventListener('dblclick', event => {
    if (event.button !== 0 || document.querySelector('dialog[open]') || window.__COHABIT_PICK_MODE__) return;
    if (typeof connectMode !== 'undefined' && connectMode.delete) return;
    const ids = parentsForGroup(event.target.closest?.('.relation-group'));
    if (!ids) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openChild(ids);
  }, true);

  function layoutSiblings(ids, created) {
    const key = [...ids].sort().join('|');
    const siblings = state.people.filter(child => {
      const parents = [...new Set(state.relations.filter(r => r.type === 'parent' && r.to === child.id).map(r => r.from))].sort();
      return parents.join('|') === key;
    }).sort((a, b) => a === created ? 1 : b === created ? -1 : a.x - b.x);
    const parents = ids.map(person);
    const old = siblings.filter(child => child !== created);
    const parentY = Math.max(...parents.map(item => item.y));
    const baseline = old.length ? old.reduce((sum, child) => sum + child.y, 0) / old.length : parentY + 250;
    const y = Math.min(620, Math.max(parentY + 160, baseline));
    const gap = Math.min(145, 1000 / Math.max(1, siblings.length - 1));
    const span = gap * (siblings.length - 1);
    const center = parents.reduce((sum, item) => sum + item.x, 0) / parents.length;
    const left = Math.max(80, Math.min(1120 - span, center - span / 2));
    const fixed = state.people.filter(item => !siblings.includes(item) || item.positionLocked);
    siblings.forEach((child, index) => {
      if (child.positionLocked) return;
      let x = left + index * gap;
      if (fixed.some(item => Math.abs(item.y-y) < 80 && Math.abs(item.x-x) < 80)) {
        const candidates = Array.from({length:15}, (_, i) => [x + (i+1)*80, x - (i+1)*80]).flat();
        x = candidates.find(next => next >= 80 && next <= 1120 && !fixed.some(item => Math.abs(item.y-y) < 80 && Math.abs(item.x-next) < 80)) ?? x;
      }
      child.x = x; child.y = y; fixed.push(child);
    });
    if (created.cohabit === 'yes' && Array.isArray(state.cohabitMemberIds) && ids.some(pid => state.cohabitMemberIds.includes(pid))) {
      if (!state.cohabitMemberIds.includes(created.id)) state.cohabitMemberIds.push(created.id);
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const ids = parentIds;
    const name = q('#newChildName').value.trim();
    if (!name || !ids || ids.some(pid => !person(pid))) return;
    const client = q('#newChildClient').value === 'yes';
    const child = {id:id(), name, role:client ? '대상자' : '자녀', client, clientMain:false,
      gender:q('[name="newChildGender"]:checked').value, age:q('#newChildAge').value.trim(),
      life:q('#newChildLife').value, cohabit:q('#newChildCohabit').value, note:q('#newChildNote').value.trim(), x:600, y:510};
    state.people.push(child);
    ids.forEach(pid => state.relations.push({id:id(), from:pid, to:child.id, type:'parent'}));
    layoutSiblings(ids, child);
    save(); render(); dialog.close();
    toast('자녀를 추가하고 부모 연결선과 형제 배치를 정리했습니다');
  });
  dialog.querySelectorAll('[data-child-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => {parentIds = null});
})();
