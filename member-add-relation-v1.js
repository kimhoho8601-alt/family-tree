(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || typeof render !== 'function') return;

  const form = document.querySelector('#personForm');
  const dialog = document.querySelector('#personDialog');
  const formGrid = form?.querySelector('.form-grid');
  if (!form || !dialog || !formGrid) return;

  document.documentElement.dataset.memberAddRelation = 'v1';

  const style = document.createElement('style');
  style.textContent = `
    .member-add-relation{grid-column:1/-1;border:1px solid #eadde0;border-radius:12px;background:#fff9fa;padding:12px 13px 13px}
    .member-add-relation[hidden]{display:none}
    .member-add-relation-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:9px}
    .member-add-relation-head strong{font-size:12px}.member-add-relation-head small{font-size:10px;color:#8a7d80;font-weight:500}
    .member-add-relation-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .member-add-relation label>span{display:block;font-size:11px;font-weight:700;margin-bottom:6px}
    .member-add-relation select{width:100%;height:40px;border:1px solid #ded1d4;border-radius:9px;padding:0 10px;background:#fff;font:12px 'IBM Plex Sans KR',sans-serif;color:#342a2c;outline:none}
    .member-add-relation select:focus{border-color:#c9002b;box-shadow:0 0 0 3px #fff0f3}
    .member-add-relation-note{margin:7px 0 0;color:#8a7d80;font-size:10px;line-height:1.5;word-break:keep-all}
    @media(max-width:560px){.member-add-relation-grid{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  const section = document.createElement('div');
  section.className = 'member-add-relation';
  section.innerHTML = `
    <div class="member-add-relation-head"><strong>기존 구성원과 관계선 <span style="color:#8a7d80;font-weight:500">선택</span></strong><small>추가와 동시에 연결</small></div>
    <div class="member-add-relation-grid">
      <label><span>연결할 구성원</span><select id="memberAddRelationTarget"></select></label>
      <label><span>관계선</span><select id="memberAddRelationType">
        <option value="none">관계선 추가 안 함</option>
        <option value="marriage">실선 · 부부/동반자</option>
        <option value="separated">별거</option>
        <option value="divorced">이혼</option>
        <option value="distant">점선 · 소원/불명확</option>
        <option value="close">굵은선 · 친밀/지지</option>
        <option value="conflict">지그재그 · 갈등/적대</option>
      </select></label>
    </div>
    <p class="member-add-relation-note">부모→자녀 구조선은 기존 ‘선 연결’ 기능에서 지정하고, 여기서는 부부·친밀·갈등 등 구성원 간 관계선을 바로 추가합니다.</p>`;

  const memo = formGrid.querySelector('textarea#personNote')?.closest('label');
  if (memo) formGrid.insertBefore(section, memo);
  else formGrid.append(section);

  const targetSelect = section.querySelector('#memberAddRelationTarget');
  const typeSelect = section.querySelector('#memberAddRelationType');

  function fillTargets() {
    const existingId = document.querySelector('#personId')?.value || '';
    const isAdd = !existingId;
    section.hidden = !isAdd;
    if (!isAdd) return;

    const people = state.people.filter(p => p?.id);
    if (!people.length) {
      targetSelect.innerHTML = '<option value="">연결할 기존 구성원 없음</option>';
      targetSelect.disabled = true;
      typeSelect.value = 'none';
      typeSelect.disabled = true;
      return;
    }

    const old = targetSelect.value;
    targetSelect.disabled = false;
    typeSelect.disabled = false;
    targetSelect.innerHTML = people.map(p => `<option value="${p.id}">${esc(p.role || '구성원')} · ${esc(p.name || '식별명 없음')}</option>`).join('');
    if ([...targetSelect.options].some(o => o.value === old)) targetSelect.value = old;
    else {
      const proband = people.find(p => p.role === '대상자');
      targetSelect.value = proband?.id || people[0].id;
    }
    typeSelect.value = 'none';
  }

  // Ensure every entry path (toolbar, side panel, blank-grid quick add) gets the same controls.
  if (typeof openPerson === 'function') {
    const previousOpenPerson = openPerson;
    openPerson = function(person) {
      const result = previousOpenPerson(person);
      fillTargets();
      return result;
    };
  }

  dialog.addEventListener('close', () => {
    typeSelect.value = 'none';
  });

  form.addEventListener('submit', () => {
    const existingId = document.querySelector('#personId')?.value || '';
    if (existingId) return;

    const beforeIds = new Set(state.people.map(p => p.id));
    const targetId = targetSelect.disabled ? '' : targetSelect.value;
    const relationType = typeSelect.disabled ? 'none' : typeSelect.value;
    if (!targetId || relationType === 'none') return;

    queueMicrotask(() => {
      const created = state.people.find(p => !beforeIds.has(p.id));
      const target = state.people.find(p => p.id === targetId);
      if (!created || !target || created.id === target.id) return;

      const samePair = r => (r.from === created.id && r.to === target.id) || (r.from === target.id && r.to === created.id);
      if (['marriage','separated','divorced'].includes(relationType)) {
        state.relations = state.relations.filter(r => !(samePair(r) && ['marriage','separated','divorced'].includes(r.type)));
      }

      state.relations.push({
        id: id(),
        from: created.id,
        to: target.id,
        type: relationType,
        relationRole: 'adult'
      });

      // This relation is part of the same "add member" action for Undo/Redo.
      if (typeof window.__historySync === 'function') window.__historySync();
      else save();
      render();
      toast(`${created.name || '구성원'}을 추가하고 관계선을 연결했습니다`);
    });
  }, true);

  fillTargets();
})();