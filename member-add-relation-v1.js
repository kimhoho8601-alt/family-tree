(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || typeof render !== 'function') return;

  const form = document.querySelector('#personForm');
  const dialog = document.querySelector('#personDialog');
  const formGrid = form?.querySelector('.form-grid');
  const roleSelect = document.querySelector('#personRole');
  if (!form || !dialog || !formGrid || !roleSelect) return;

  document.documentElement.dataset.memberAddRelation = 'v2';

  const CHILDISH_ROLES = new Set(['대상자','자녀','형제·자매']);
  const PARTNER_TYPES = new Set(['marriage','separated','divorced','distant']);

  const style = document.createElement('style');
  style.textContent = `
    .member-add-relation{grid-column:1/-1;border:1px solid #eadde0;border-radius:12px;background:#fff9fa;padding:12px 13px 13px}
    .member-add-relation[hidden],.member-parent-link[hidden]{display:none}
    .member-add-relation-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:9px}
    .member-add-relation-head strong{font-size:12px}.member-add-relation-head small{font-size:10px;color:#8a7d80;font-weight:500}
    .member-add-relation-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .member-add-relation label>span{display:block;font-size:11px;font-weight:700;margin-bottom:6px}
    .member-add-relation select{width:100%;height:40px;border:1px solid #ded1d4;border-radius:9px;padding:0 10px;background:#fff;font:12px 'IBM Plex Sans KR',sans-serif;color:#342a2c;outline:none}
    .member-add-relation select:focus{border-color:#c9002b;box-shadow:0 0 0 3px #fff0f3}
    .member-add-relation-note{margin:7px 0 0;color:#8a7d80;font-size:10px;line-height:1.5;word-break:keep-all}
    .member-parent-link{margin-top:11px;padding-top:11px;border-top:1px dashed #e4c7ce}
    .member-parent-link-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}
    .member-parent-link-title b{font-size:11px}.member-parent-link-title span{font-size:9px;color:#c9002b;font-weight:700}
    .junction-handle.parent-pick-handle{fill:#c9002b!important;stroke:#fff!important;stroke-width:3!important;filter:drop-shadow(0 2px 5px rgba(201,0,43,.28));cursor:pointer}
    .relation-group.parent-pick-option .relation:not(.parent){stroke:#c9002b!important;stroke-width:4!important}
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
    <div class="member-parent-link" id="memberParentLink">
      <div class="member-parent-link-title"><b>부모 구조 연결</b><span>대상자·자녀 추가 시 권장</span></div>
      <label><span>부모 관계선에 연결</span><select id="memberParentLinkType"></select></label>
      <p class="member-add-relation-note">부·모 쌍을 선택하면 새 구성원이 두 부모의 공통 자녀선에 바로 연결됩니다. ‘캔버스에서 선택’을 고르면 저장 후 부모 사이 중앙점을 클릭해서 연결할 수 있습니다.</p>
    </div>
    <p class="member-add-relation-note">갈등·친밀 등 정서적 관계는 위 관계선 메뉴에서 별도로 추가할 수 있습니다.</p>`;

  const memo = formGrid.querySelector('textarea#personNote')?.closest('label');
  if (memo) formGrid.insertBefore(section, memo);
  else formGrid.append(section);

  const targetSelect = section.querySelector('#memberAddRelationTarget');
  const typeSelect = section.querySelector('#memberAddRelationType');
  const parentWrap = section.querySelector('#memberParentLink');
  const parentSelect = section.querySelector('#memberParentLinkType');

  function getParentPairs() {
    const out = [];
    const seen = new Set();
    state.relations.forEach(r => {
      if (!PARTNER_TYPES.has(r.type)) return;
      const a = state.people.find(p => p.id === r.from);
      const b = state.people.find(p => p.id === r.to);
      if (!a || !b) return;
      const isFatherMother = (a.role === '부' && b.role === '모') || (a.role === '모' && b.role === '부');
      if (!isFatherMother) return;
      const ids = [a.id,b.id].sort();
      const key = ids.join('|');
      if (seen.has(key)) return;
      seen.add(key);
      const father = a.role === '부' ? a : b;
      const mother = a.role === '모' ? a : b;
      const relationLabel = ({marriage:'부부',separated:'별거',divorced:'이혼',distant:'관계 불명확'})[r.type] || '관계';
      out.push({value:`pair:${father.id}|${mother.id}`, father, mother, label:`${father.name} + ${mother.name} · ${relationLabel}`});
    });
    return out;
  }

  function fillParentOptions() {
    const existingId = document.querySelector('#personId')?.value || '';
    const isAdd = !existingId;
    const childRole = CHILDISH_ROLES.has(roleSelect.value);
    parentWrap.hidden = !(isAdd && childRole);
    if (parentWrap.hidden) return;

    const pairs = getParentPairs();
    const fathers = state.people.filter(p => p.role === '부');
    const mothers = state.people.filter(p => p.role === '모');
    const options = [
      '<option value="none">부모 구조 연결 안 함</option>',
      ...(pairs.length ? ['<option value="pick">캔버스에서 부모 관계선 중앙점 선택</option>'] : []),
      ...pairs.map(p => `<option value="${p.value}">${esc(p.label)}</option>`),
      ...fathers.map(p => `<option value="single:${p.id}">${esc(p.name)}만 부모로 연결</option>`),
      ...mothers.map(p => `<option value="single:${p.id}">${esc(p.name)}만 부모로 연결</option>`)
    ];
    parentSelect.innerHTML = options.join('');

    // One unambiguous father+mother pair is the common case, so select it automatically.
    // With multiple possible couples, require an explicit choice to avoid a wrong family structure.
    if (pairs.length === 1) parentSelect.value = pairs[0].value;
    else parentSelect.value = 'none';
  }

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
    } else {
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
    fillParentOptions();
  }

  function highlightParentPick() {
    requestAnimationFrame(() => {
      els.relations.querySelectorAll('.relation-group[data-relation]').forEach(group => {
        const relation = state.relations.find(r => r.id === group.dataset.relation);
        const a = state.people.find(p => p.id === relation?.from);
        const b = state.people.find(p => p.id === relation?.to);
        if (!relation || !PARTNER_TYPES.has(relation.type) || !a || !b) return;
        const isFatherMother = (a.role === '부' && b.role === '모') || (a.role === '모' && b.role === '부');
        if (!isFatherMother) return;
        group.classList.add('parent-pick-option');
        group.querySelector('.junction-handle')?.classList.add('parent-pick-handle');
      });
    });
  }

  if (typeof openPerson === 'function') {
    const previousOpenPerson = openPerson;
    openPerson = function(person) {
      const result = previousOpenPerson(person);
      fillTargets();
      return result;
    };
  }

  roleSelect.addEventListener('change', fillParentOptions);
  dialog.addEventListener('close', () => {
    typeSelect.value = 'none';
    els.relations.querySelectorAll('.parent-pick-option').forEach(g => g.classList.remove('parent-pick-option'));
  });

  form.addEventListener('submit', () => {
    const existingId = document.querySelector('#personId')?.value || '';
    if (existingId) return;

    const beforeIds = new Set(state.people.map(p => p.id));
    const targetId = targetSelect.disabled ? '' : targetSelect.value;
    const relationType = typeSelect.disabled ? 'none' : typeSelect.value;
    const parentChoice = parentWrap.hidden ? 'none' : parentSelect.value;

    queueMicrotask(() => {
      const created = state.people.find(p => !beforeIds.has(p.id));
      if (!created) return;
      let changed = false;

      // Optional emotional/adult relation.
      const target = state.people.find(p => p.id === targetId);
      if (target && created.id !== target.id && relationType !== 'none') {
        const samePair = r => (r.from === created.id && r.to === target.id) || (r.from === target.id && r.to === created.id);
        if (['marriage','separated','divorced'].includes(relationType)) {
          state.relations = state.relations.filter(r => !(samePair(r) && ['marriage','separated','divorced'].includes(r.type)));
        }
        state.relations.push({id:id(),from:created.id,to:target.id,type:relationType,relationRole:'adult'});
        changed = true;
      }

      // Structural parent relation: one parent or the midpoint of an existing father+mother pair.
      if (parentChoice.startsWith('pair:')) {
        const parentIds = parentChoice.slice(5).split('|').filter(Boolean);
        parentIds.forEach(parentId => {
          if (state.people.some(p => p.id === parentId) && !state.relations.some(r => r.type === 'parent' && r.from === parentId && r.to === created.id)) {
            state.relations.push({id:id(),from:parentId,to:created.id,type:'parent'});
            changed = true;
          }
        });
      } else if (parentChoice.startsWith('single:')) {
        const parentId = parentChoice.slice(7);
        if (state.people.some(p => p.id === parentId) && !state.relations.some(r => r.type === 'parent' && r.from === parentId && r.to === created.id)) {
          state.relations.push({id:id(),from:parentId,to:created.id,type:'parent'});
          changed = true;
        }
      }

      if (changed) {
        if (typeof window.__historySync === 'function') window.__historySync();
        else save();
        render();
      }

      if (parentChoice === 'pick' && typeof startConnection === 'function') {
        render();
        startConnection(created.id);
        const guide = document.querySelector('#connectionGuide');
        if (guide) guide.textContent = `${created.name || '새 구성원'}의 부모 관계선 중앙점을 클릭하세요`;
        highlightParentPick();
        toast('부·모 사이의 강조된 중앙점을 클릭하면 부모 구조로 연결됩니다');
      } else if (changed) {
        toast(`${created.name || '구성원'}을 추가하고 선택한 관계를 연결했습니다`);
      }
    });
  }, true);

  fillTargets();
})();