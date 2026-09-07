(() => {
  const CORE_TYPES = new Set(['marriage', 'parent', 'separated', 'divorced']);
  const OPTIONAL_TYPES = new Set(['distant', 'close', 'conflict', 'enmeshed', 'cutoff', 'close_conflict']);
  const TYPE_META = {
    marriage: { label: '결혼·부부', short: '부부', group: 'core', desc: '부부·동반자 구조' },
    parent: { label: '부모 → 자녀', short: '부모→자녀', group: 'core', desc: '부모-자녀 하위 구조' },
    separated: { label: '별거', short: '별거', group: 'core', desc: '분리선 1개' },
    divorced: { label: '이혼', short: '이혼', group: 'core', desc: '분리선 2개' },
    distant: { label: '소원·불명확', short: '소원', group: 'optional', desc: '점선' },
    close: { label: '친밀·지지', short: '친밀', group: 'optional', desc: '굵은선' },
    conflict: { label: '갈등·적대', short: '갈등', group: 'optional', desc: '지그재그' },
    enmeshed: { label: '밀착·융합', short: '밀착', group: 'optional', desc: '매우 가깝고 경계가 약한 관계' },
    cutoff: { label: '단절·관계 끊김', short: '단절', group: 'optional', desc: '정서적 접촉이 끊긴 관계' },
    close_conflict: { label: '친밀하지만 갈등', short: '친밀+갈등', group: 'optional', desc: '가까움과 갈등이 함께 있는 관계' }
  };

  const escRel = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pairMatches = (r, from, to) => (r.from === from && r.to === to) || (r.from === to && r.to === from);
  const typeGroup = type => CORE_TYPES.has(type) ? 'core' : 'optional';

  function injectStyles() {
    if (document.querySelector('#relationClassificationStyles')) return;
    const style = document.createElement('style');
    style.id = 'relationClassificationStyles';
    style.textContent = `
      .rel-tag{display:inline-flex;align-items:center;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:700;line-height:1;white-space:nowrap}
      .rel-tag.core{background:#fbe8ec;color:#9d0025;border:1px solid #f1c4cf}
      .rel-tag.optional{background:#f4f1f2;color:#655a5d;border:1px solid #ded7d9}
      .relation-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .relation-choice-section{border:1px solid #eadfe2;border-radius:16px;padding:14px;background:#fff}
      .relation-choice-section.optional{background:#fcfbfb}
      .relation-choice-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
      .relation-choice-head strong{font-size:14px;color:#302629}
      .relation-choice-section>p{margin:0 0 11px;color:#827477;font-size:11px;line-height:1.5;word-break:keep-all}
      .relation-choice-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .relation-choice-cards label{display:block;cursor:pointer}
      .relation-choice-cards input{position:absolute;opacity:0;pointer-events:none}
      .relation-choice-cards span{display:block;border:1px solid #e7dfe1;border-radius:12px;padding:10px 11px;background:#fff;min-height:56px;transition:.15s ease}
      .relation-choice-cards input:checked+span{border-color:#c9002b;box-shadow:0 0 0 2px rgba(201,0,43,.10);background:#fff8fa}
      .relation-choice-cards b{display:block;font-size:12px;color:#34292c;margin-bottom:3px}
      .relation-choice-cards small{display:block;font-size:10px;color:#887b7e;line-height:1.35;word-break:keep-all}
      #lineChoiceDialog .line-choice-grid{display:block}
      .relation-list-head{align-items:flex-start!important;gap:10px}
      .relation-list-head>div:first-child{min-width:0}
      .rel-head-tags{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
      .relationship-list{display:grid;gap:10px}
      .relation-group-block{border:1px solid #eadfe2;border-radius:14px;background:#fff;overflow:hidden}
      .relation-group-block.optional{background:#fcfbfb}
      .relation-group-title{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 11px;border-bottom:1px solid #f0e9eb}
      .relation-group-title>span{display:flex;align-items:center;gap:6px;min-width:0}
      .relation-group-title strong{font-size:12px;color:#3a2e31}
      .relation-group-title small{font-size:10px;color:#9a8e90}
      .relation-group-body{display:grid}
      .relation-edit-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px 10px;border-bottom:1px solid #f3edef}
      .relation-edit-item:last-child{border-bottom:0}
      .relation-item-copy{min-width:0}
      .relation-item-copy b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#342a2c}
      .relation-item-copy small{display:flex;align-items:center;gap:5px;margin-top:4px;font-size:10px;color:#84777a}
      .relation-row-actions{display:flex;align-items:center;gap:4px}
      .relation-row-actions button{border:1px solid #e5dcde;background:#fff;border-radius:8px;padding:5px 7px;font-size:10px;color:#5e5154;cursor:pointer}
      .relation-row-actions button:hover{border-color:#c9002b;color:#a50028}
      .relation-row-actions .rel-remove{font-size:14px;line-height:1;padding:4px 7px}
      .relation-group-empty{margin:0;padding:12px;color:#988c8f;font-size:10px;line-height:1.5}
      .relation-add-optional{display:block;width:calc(100% - 20px);margin:0 10px 10px;border:1px dashed #d7cdd0;background:#fff;border-radius:10px;padding:8px 10px;color:#66595c;font-size:10px;font-weight:700;cursor:pointer}
      .relation-add-optional:hover{border-color:#c9002b;color:#a00027;background:#fff8fa}
      #relationEditDialog{width:min(520px,calc(100vw - 28px))}
      .relation-pair-card{margin:2px 0 14px;padding:11px 12px;border-radius:12px;background:#f8f4f5;border:1px solid #ede4e6}
      .relation-pair-card b{display:block;color:#33282b;font-size:13px}
      .relation-pair-card small{display:block;margin-top:4px;color:#85787b;font-size:10px}
      .relation-edit-field{display:grid;gap:7px}
      .relation-edit-field>span{display:flex;align-items:center;gap:6px;font-weight:700;color:#473a3d;font-size:12px}
      .relation-edit-field select{width:100%;border:1px solid #ddd3d6;border-radius:10px;padding:10px 11px;background:#fff;color:#33282b}
      .relation-edit-help{margin:9px 0 0;color:#85787b;font-size:10px;line-height:1.55;word-break:keep-all}
      .aq-type-field>span{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
      .quick-relation-tags{display:inline-flex;gap:4px;margin-left:4px}
      #editLineBtn{white-space:nowrap}
      @media(max-width:720px){.relation-choice-grid{grid-template-columns:1fr}.relation-choice-cards{grid-template-columns:1fr 1fr}.rel-head-tags{justify-content:flex-start}.relation-list-head{display:grid!important}}
      @media(max-width:460px){.relation-choice-cards{grid-template-columns:1fr}}
    `;
    document.head.append(style);
  }

  function coreOptions(includeParent = true) {
    return `
      <optgroup label="기본 관계선 · 필수">
        <option value="marriage">결혼·부부</option>
        ${includeParent ? '<option value="parent">부모 → 자녀</option>' : ''}
        <option value="separated">별거</option>
        <option value="divorced">이혼</option>
      </optgroup>
      <optgroup label="관계 특성 · 선택">
        <option value="close">친밀·지지</option>
        <option value="enmeshed">밀착·융합</option>
        <option value="distant">소원·불명확</option>
        <option value="cutoff">단절·관계 끊김</option>
        <option value="conflict">갈등·적대</option>
        <option value="close_conflict">친밀하지만 갈등</option>
      </optgroup>`;
  }

  function enhanceLineChoiceDialog() {
    const grid = document.querySelector('#lineChoiceDialog .line-choice-grid');
    if (!grid || grid.dataset.classified === '1') return;
    const checked = document.querySelector('[name="popupRelationType"]:checked')?.value || 'marriage';
    const card = type => {
      const m = TYPE_META[type];
      return `<label><input type="radio" name="popupRelationType" value="${type}" ${type === checked ? 'checked' : ''}><span><b>${escRel(m.label)}</b><small>${escRel(m.desc)}</small></span></label>`;
    };
    grid.innerHTML = `<div class="relation-choice-grid">
      <section class="relation-choice-section core">
        <div class="relation-choice-head"><strong>기본 관계선</strong><span class="rel-tag core">필수</span></div>
        <p>가족 구조를 나타내는 선입니다. 빠른 작성에서 필요한 선은 자동으로 생성됩니다.</p>
        <div class="relation-choice-cards">${['marriage','parent','separated','divorced'].map(card).join('')}</div>
      </section>
      <section class="relation-choice-section optional">
        <div class="relation-choice-head"><strong>관계 특성</strong><span class="rel-tag optional">선택</span></div>
        <p>관계의 질을 추가로 표시할 때만 선택하세요. 기본 관계선과 함께 사용할 수 있습니다.</p>
        <div class="relation-choice-cards">${['close','enmeshed','distant','cutoff','conflict','close_conflict'].map(card).join('')}</div>
      </section>
    </div>`;
    grid.dataset.classified = '1';
  }

  function enhanceRelationDialog() {
    const select = document.querySelector('#relationType');
    if (!select || select.dataset.classified === '1') return;
    const current = select.value;
    select.innerHTML = coreOptions(true);
    if ([...select.options].some(o => o.value === current)) select.value = current;
    select.dataset.classified = '1';
    const label = select.closest('label');
    if (label && !label.querySelector('.relation-edit-help')) {
      const note = document.createElement('p');
      note.className = 'relation-edit-help';
      note.textContent = '기본 관계선은 가족 구조를, 관계 특성은 친밀·갈등 등 관계의 질을 나타냅니다.';
      label.append(note);
    }
  }

  function enhanceParentStatus() {
    const select = document.querySelector('#qParentStatus');
    if (!select || select.dataset.classified === '1') return;
    const current = select.value;
    select.innerHTML = `<optgroup label="기본 관계선 · 필수"><option value="marriage">혼인·부부</option><option value="separated">별거</option><option value="divorced">이혼</option></optgroup><optgroup label="관계 특성 · 선택"><option value="distant">관계 불명확·미상</option></optgroup><option value="none">관계선 표시 안 함</option>`;
    if ([...select.options].some(o => o.value === current)) select.value = current;
    select.dataset.classified = '1';
    const labelText = select.closest('label')?.querySelector(':scope > span');
    if (labelText && !labelText.querySelector('.quick-relation-tags')) {
      labelText.insertAdjacentHTML('beforeend', '<span class="quick-relation-tags"><i class="rel-tag core">기본</i><i class="rel-tag optional">선택</i></span>');
    }
  }

  function enhanceAdvancedQuick() {
    document.querySelectorAll('#aqRels .aq-type').forEach(select => {
      if (select.dataset.classified === '1') return;
      const current = select.value;
      select.innerHTML = coreOptions(false);
      if ([...select.options].some(o => o.value === current)) select.value = current;
      select.dataset.classified = '1';
      const title = select.closest('label')?.querySelector(':scope > span');
      if (title && !title.querySelector('.quick-relation-tags')) {
        title.insertAdjacentHTML('beforeend', '<span class="quick-relation-tags"><i class="rel-tag core">기본</i><i class="rel-tag optional">선택</i></span>');
      }
    });
  }

  function updateCopy() {
    const editHead = document.querySelector('#editPanel .step-head small');
    if (editHead) editHead.textContent = '자동 생성된 기본선은 유지하고 필요한 관계만 추가·수정하세요';
    const head = document.querySelector('#editPanel .relation-list-head');
    if (head && !head.querySelector('.rel-head-tags')) {
      const strong = head.querySelector('strong');
      const small = head.querySelector('small');
      if (strong) strong.textContent = '연결선';
      if (small) small.textContent = '기본선은 자동 생성 · 관계 특성은 필요할 때 선택';
      head.insertAdjacentHTML('beforeend', '<div class="rel-head-tags"><span class="rel-tag core">기본 · 필수</span><span class="rel-tag optional">관계 특성 · 선택</span></div>');
    }
  }

  function ensureEditDialog() {
    if (document.querySelector('#relationEditDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'relationEditDialog';
    dialog.innerHTML = `<form method="dialog" id="relationEditForm">
      <div class="dialog-head"><div><p class="eyebrow">EDIT RELATIONSHIP</p><h2>연결선 수정</h2></div><button type="button" class="dialog-close" id="closeRelationEdit" aria-label="닫기">×</button></div>
      <input type="hidden" id="editRelationId">
      <div class="relation-pair-card"><b id="editRelationPair">구성원 ↔ 구성원</b><small>연결 대상은 유지하고 선 종류만 변경합니다.</small></div>
      <label class="relation-edit-field"><span>관계선 종류 <i class="rel-tag core">기본</i><i class="rel-tag optional">선택</i></span><select id="editRelationType">${coreOptions(true)}</select></label>
      <p class="relation-edit-help">기본 관계선은 가족 구조를 나타냅니다. 친밀·갈등 같은 관계 특성은 필요한 경우에만 추가하거나 변경하세요.</p>
      <div class="dialog-actions"><button type="button" class="button ghost" id="cancelRelationEdit">취소</button><button type="submit" class="button primary">변경 저장</button></div>
    </form>`;
    document.body.append(dialog);
    document.querySelector('#closeRelationEdit').onclick = () => dialog.close();
    document.querySelector('#cancelRelationEdit').onclick = () => dialog.close();
    document.querySelector('#relationEditForm').addEventListener('submit', onEditSubmit);
  }

  function openRelationEditor(rid) {
    ensureEditDialog();
    const relation = state.relations.find(r => r.id === rid);
    if (!relation) return;
    const a = state.people.find(p => p.id === relation.from);
    const b = state.people.find(p => p.id === relation.to);
    document.querySelector('#editRelationId').value = rid;
    document.querySelector('#editRelationPair').textContent = `${a?.name || '구성원'} ↔ ${b?.name || '구성원'}`;
    const select = document.querySelector('#editRelationType');
    select.value = relation.type;
    document.querySelector('#relationEditDialog').showModal();
  }

  function onEditSubmit(event) {
    event.preventDefault();
    const rid = document.querySelector('#editRelationId').value;
    const relation = state.relations.find(r => r.id === rid);
    if (!relation) return;
    const nextType = document.querySelector('#editRelationType').value;
    const samePair = r => r.id !== rid && pairMatches(r, relation.from, relation.to);

    if (nextType === 'parent') {
      const duplicate = state.relations.some(r => r.id !== rid && r.type === 'parent' && r.from === relation.from && r.to === relation.to);
      if (duplicate) { toast('이미 등록된 부모–자녀 연결입니다'); return; }
    } else if (CORE_TYPES.has(nextType)) {
      state.relations = state.relations.filter(r => !(samePair(r) && ['marriage','separated','divorced'].includes(r.type)));
    } else if (OPTIONAL_TYPES.has(nextType)) {
      state.relations = state.relations.filter(r => !(samePair(r) && OPTIONAL_TYPES.has(r.type)));
    }

    relation.type = nextType;
    document.querySelector('#relationEditDialog').close();
    save();
    render();
    toast(`${TYPE_META[nextType]?.label || '연결선'}으로 변경했습니다`);
  }

  function renderGroupedRelationList() {
    const list = document.querySelector('#relationshipList');
    if (!list) return;
    const valid = state.relations.filter(r => state.people.some(p => p.id === r.from) && state.people.some(p => p.id === r.to));
    const groups = {
      core: valid.filter(r => CORE_TYPES.has(r.type)),
      optional: valid.filter(r => !CORE_TYPES.has(r.type))
    };

    const row = r => {
      const a = state.people.find(p => p.id === r.from);
      const b = state.people.find(p => p.id === r.to);
      const meta = TYPE_META[r.type] || { label: r.type, group: typeGroup(r.type) };
      return `<div class="relation-edit-item" data-relation-row="${r.id}"><div class="relation-item-copy"><b>${escRel(a?.name || '구성원')} → ${escRel(b?.name || '구성원')}</b><small><span class="rel-tag ${meta.group === 'core' ? 'core' : 'optional'}">${meta.group === 'core' ? '기본' : '선택'}</span>${escRel(meta.label)}</small></div><div class="relation-row-actions"><button type="button" data-edit-rel="${r.id}">수정</button><button type="button" class="rel-remove" data-remove-rel="${r.id}" aria-label="연결선 삭제">×</button></div></div>`;
    };

    list.innerHTML = `
      <section class="relation-group-block core"><div class="relation-group-title"><span><strong>기본 관계선</strong><i class="rel-tag core">필수</i></span><small>${groups.core.length}개</small></div><div class="relation-group-body">${groups.core.length ? groups.core.map(row).join('') : '<p class="relation-group-empty">기본 관계선이 없습니다. 빠른 작성 또는 선 연결로 추가할 수 있습니다.</p>'}</div></section>
      <section class="relation-group-block optional"><div class="relation-group-title"><span><strong>관계 특성</strong><i class="rel-tag optional">선택</i></span><small>${groups.optional.length}개</small></div><div class="relation-group-body">${groups.optional.length ? groups.optional.map(row).join('') : '<p class="relation-group-empty">필요한 경우에만 친밀·갈등·소원 등의 관계 특성을 추가하세요.</p>'}</div><button type="button" class="relation-add-optional" id="addOptionalRelation">＋ 관계 특성 추가</button></section>`;

    list.querySelectorAll('[data-edit-rel]').forEach(btn => btn.onclick = () => openRelationEditor(btn.dataset.editRel));
    list.querySelectorAll('[data-remove-rel]').forEach(btn => btn.onclick = () => deleteRelation(btn.dataset.removeRel));
    const addOptional = list.querySelector('#addOptionalRelation');
    if (addOptional) addOptional.onclick = () => {
      openRelation();
      toast('두 구성원을 선택한 뒤 관계 특성 · 선택에서 선을 고르세요');
    };
  }

  function addEditToolbarButton() {
    const deleteBtn = document.querySelector('#deleteLineBtn');
    if (!deleteBtn || document.querySelector('#editLineBtn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'button soft';
    btn.id = 'editLineBtn';
    btn.textContent = '선 수정';
    deleteBtn.before(btn);
    btn.onclick = () => {
      if (!selectedRelationIds.length) { toast('먼저 수정할 연결선을 선택해주세요'); return; }
      if (selectedRelationIds.length !== 1) { toast('묶음 부모–자녀선은 왼쪽 연결선 목록에서 개별 수정해주세요'); return; }
      openRelationEditor(selectedRelationIds[0]);
    };
  }

  function addCanvasDoubleClick() {
    if (els.relations.dataset.editBound === '1') return;
    els.relations.dataset.editBound = '1';
    els.relations.addEventListener('dblclick', e => {
      const group = e.target.closest('.relation-group');
      if (!group) return;
      const ids = group.dataset.relations?.split(',').filter(Boolean) || [group.dataset.relation].filter(Boolean);
      if (ids.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        openRelationEditor(ids[0]);
      } else if (ids.length > 1) {
        toast('묶음 부모–자녀선은 왼쪽 연결선 목록에서 개별 수정해주세요');
      }
    });
  }

  function overrideAddConnection() {
    addConnection = function(from, to, type) {
      const samePair = r => pairMatches(r, from, to);
      if (['marriage','separated','divorced'].includes(type)) {
        state.relations = state.relations.filter(r => !(samePair(r) && ['marriage','separated','divorced'].includes(r.type)));
      }
      if (OPTIONAL_TYPES.has(type)) {
        state.relations = state.relations.filter(r => !(samePair(r) && OPTIONAL_TYPES.has(r.type)));
      }
      if (type === 'parent' && state.relations.some(r => r.type === 'parent' && r.from === from && r.to === to)) {
        toast('이미 등록된 부모–자녀 연결입니다');
        return false;
      }
      state.relations.push({ id: id(), from, to, type });
      save();
      render();
      toast(`${TYPE_META[type]?.label || '연결선'}을 추가했습니다`);
      return true;
    };
  }

  function wrapRender() {
    if (render.__relationClassified) return;
    const originalRender = render;
    const wrapped = function(...args) {
      const result = originalRender.apply(this, args);
      renderGroupedRelationList();
      enhanceAdvancedQuick();
      updateCopy();
      return result;
    };
    wrapped.__relationClassified = true;
    render = wrapped;
  }

  injectStyles();
  enhanceLineChoiceDialog();
  enhanceRelationDialog();
  enhanceParentStatus();
  enhanceAdvancedQuick();
  updateCopy();
  ensureEditDialog();
  addEditToolbarButton();
  addCanvasDoubleClick();
  overrideAddConnection();
  wrapRender();
  renderGroupedRelationList();

  const quickForm = document.querySelector('#quickForm');
  if (quickForm) {
    new MutationObserver(() => enhanceAdvancedQuick()).observe(quickForm, { childList: true, subtree: true });
  }
})();
