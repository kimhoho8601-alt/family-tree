(() => {
  const CORE_TYPES = new Set(['marriage', 'parent', 'separated', 'divorced']);
  const OPTIONAL_TYPES = new Set(['distant', 'close', 'conflict', 'enmeshed', 'cutoff', 'close_conflict']);
  const ABUSE_TYPES = new Set(['abuse_physical', 'abuse_emotional', 'abuse_sexual', 'abuse_neglect']);
  const ABUSE_COLORS = {black:'#000000', red:'#c9002b', blue:'#2563eb'};
  const TYPE_META = {
    abuse_physical: {label:'신체적 학대', group:'abuse', desc:'지그재그 · 채운 화살표'},
    abuse_emotional: {label:'정서적 학대', group:'abuse', desc:'지그재그 · 빈 화살표'},
    abuse_sexual: {label:'성학대', group:'abuse', desc:'평행선과 지그재그 · 채운 화살표'},
    abuse_neglect: {label:'방임 학대', group:'abuse', desc:'점선 · 빈 화살표'},
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
      #lineChoiceDialog{width:min(820px,calc(100vw - 28px))}
      #lineChoiceDialog .abuse-fields{grid-template-columns:1fr 1fr}
      #lineChoiceDialog .abuse-fields>label:last-child{grid-column:2;grid-row:1}
      #lineChoiceDialog .abuse-fields>p{grid-column:1/-1;grid-row:2;margin:0}
      #lineChoiceDialog .abuse-fields label>span{border:0;padding:0;min-height:0;background:transparent;box-shadow:none;border-radius:0}
      @media(max-width:600px){#lineChoiceDialog .abuse-fields{grid-template-columns:1fr}#lineChoiceDialog .abuse-fields>label:last-child{grid-column:1;grid-row:3}}
      .abuse-fields{margin-top:14px;padding-top:12px;border-top:1px solid #eadfe2;display:grid;gap:8px}
      .abuse-fields[hidden]{display:none}
      .relation-choice-cards input:focus-visible+span{outline:2px solid #241b1d;outline-offset:3px}
      @media(max-width:720px){.relation-choice-grid{grid-template-columns:1fr}.relation-choice-cards{grid-template-columns:1fr 1fr}.rel-head-tags{justify-content:flex-start}.relation-list-head{display:grid!important}}
      @media(max-width:460px){.relation-choice-cards{grid-template-columns:1fr}}
    `;
    document.head.append(style);
  }

  function coreOptions(includeParent = true, includeAbuse = true) {
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
      </optgroup>${includeAbuse ? `<optgroup label="학대 유형">${[...ABUSE_TYPES].map(type => `<option value="${type}">${TYPE_META[type].label}</option>`).join('')}</optgroup>` : ''}`;
  }

  function abuseFields(prefix) {
    return `<div id="${prefix}AbuseFields" class="abuse-fields" hidden>
      <label class="relation-edit-field"><span>학대 관계선 색상</span><select id="${prefix}AbuseColor"><option value="black">검정 (기본)</option><option value="red">빨강</option><option value="blue">파랑</option></select></label>
      <p class="relation-edit-help">기본색은 검정입니다. 학대 관계선에만 빨강·파랑을 선택할 수 있습니다.</p>
      <label class="relation-edit-field"><span>학대 방향 · 가해자 → 피해자</span><select id="${prefix}AbuseDirection"><option value="forward">첫 번째 구성원 → 두 번째 구성원</option><option value="reverse">두 번째 구성원 → 첫 번째 구성원</option></select></label>
    </div>`;
  }

  function updateAbuseFields(prefix, type) {
    const fields = document.querySelector(`#${prefix}AbuseFields`);
    if (!fields) return;
    fields.hidden = !ABUSE_TYPES.has(type);
    fields.querySelectorAll('select').forEach(select => select.disabled = fields.hidden);
    let from, to;
    if (prefix === 'popup' && pendingConnection) ({from,to} = pendingConnection);
    if (prefix === 'add') { from = document.querySelector('#relationFrom')?.value; to = document.querySelector('#relationTo')?.value; }
    if (prefix === 'edit') {
      const r = state.relations.find(r => r.id === document.querySelector('#editRelationId').value);
      if (r) ({from,to} = r);
    }
    const name = pid => state.people.find(p => p.id === pid)?.name || '구성원';
    const direction = document.querySelector(`#${prefix}AbuseDirection`);
    if (from && to) {
      direction.options[0].textContent = `가해자: ${name(from)} → 피해자: ${name(to)}`;
      direction.options[1].textContent = `가해자: ${name(to)} → 피해자: ${name(from)}`;
    }
  }

  function bindAbuseFields(prefix, root, selector) {
    const update = () => updateAbuseFields(prefix, root.querySelector(selector + (prefix === 'popup' ? ':checked' : ''))?.value);
    root.addEventListener('change', update);
    // Dialogs retain their form state: new connections always start with black.
    if (prefix !== 'edit') new MutationObserver(() => {
      const dialog = root.closest('dialog');
      if (dialog?.open) {
        document.querySelector(`#${prefix}AbuseColor`).value = 'black';
        document.querySelector(`#${prefix}AbuseDirection`).value = 'forward';
        update();
      }
    }).observe(root.closest('dialog'), {attributes:true, attributeFilter:['open']});
    update();
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
      <section class="relation-choice-section abuse" style="grid-column:1/-1">
        <div class="relation-choice-head"><strong>학대 유형</strong><span class="rel-tag optional">선택</span></div>
        <p>가해자 → 피해자 방향으로 표시합니다. 기존 기본선·관계 특성과 함께 사용할 수 있습니다.</p>
        <div class="relation-choice-cards">${[...ABUSE_TYPES].map(card).join('')}</div>
        ${abuseFields('popup')}
      </section>
    </div>`;
    bindAbuseFields('popup', grid, '[name="popupRelationType"]');
    grid.dataset.classified = '1';
  }

  function enhanceRelationDialog() {
    const select = document.querySelector('#relationType');
    if (!select || select.dataset.classified === '1') return;
    const current = select.value;
    select.innerHTML = coreOptions(true);
    if ([...select.options].some(o => o.value === current)) select.value = current;
    select.dataset.classified = '1';
    select.closest('label').insertAdjacentHTML('afterend', `<div class="full">${abuseFields('add')}</div>`);
    bindAbuseFields('add', select.closest('form'), '#relationType');
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
      select.innerHTML = coreOptions(false, false);
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
      <div class="relation-pair-card"><b id="editRelationPair">구성원 ↔ 구성원</b><small>두 구성원의 관계를 변경합니다. 부모선은 부모·자녀 방향을 선택하세요.</small></div>
      <label class="relation-edit-field"><span>관계선 종류 <i class="rel-tag core">기본</i><i class="rel-tag optional">선택</i></span><select id="editRelationType">${coreOptions(true)}</select></label>
      ${abuseFields('edit')}
      <div id="editParentDirectionField" hidden>
        <label class="relation-edit-field"><span>부모 → 자녀 방향</span><select id="editParentDirection" required disabled></select></label>
        <p class="relation-edit-help">부모와 자녀를 확인한 뒤 방향을 선택하세요.</p>
      </div>
      <p class="relation-edit-help">기본 관계선은 가족 구조를 나타냅니다. 친밀·갈등 같은 관계 특성은 필요한 경우에만 추가하거나 변경하세요.</p>
      <div class="dialog-actions"><button type="button" class="button ghost" id="cancelRelationEdit">취소</button><button type="submit" class="button primary">변경 저장</button></div>
    </form>`;
    document.body.append(dialog);
    bindAbuseFields('edit', dialog, '#editRelationType');
    document.querySelector('#closeRelationEdit').onclick = () => dialog.close();
    document.querySelector('#cancelRelationEdit').onclick = () => dialog.close();
    document.querySelector('#editRelationType').addEventListener('change', updateParentDirectionField);
    document.querySelector('#relationEditForm').addEventListener('submit', onEditSubmit);
  }

  function updateParentDirectionField() {
    const isParent = document.querySelector('#editRelationType').value === 'parent';
    document.querySelector('#editParentDirectionField').hidden = !isParent;
    document.querySelector('#editParentDirection').disabled = !isParent;
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
    document.querySelector('#editAbuseColor').value = Object.hasOwn(ABUSE_COLORS, relation.color) ? relation.color : 'black';
    document.querySelector('#editAbuseDirection').value = 'forward';
    updateAbuseFields('edit', relation.type);
    const direction = document.querySelector('#editParentDirection');
    const aName = a?.name || '구성원 1';
    const bName = b?.name || '구성원 2';
    direction.innerHTML = `<option value="">부모·자녀 방향을 선택하세요</option><option value="forward">부모: ${escRel(aName)} → 자녀: ${escRel(bName)}</option><option value="reverse">부모: ${escRel(bName)} → 자녀: ${escRel(aName)}</option>`;
    direction.value = relation.type === 'parent' ? 'forward' : '';
    updateParentDirectionField();
    document.querySelector('#relationEditDialog').showModal();
  }

  function onEditSubmit(event) {
    event.preventDefault();
    const rid = document.querySelector('#editRelationId').value;
    const relation = state.relations.find(r => r.id === rid);
    if (!relation) return;
    const nextType = document.querySelector('#editRelationType').value;
    const samePair = r => r.id !== rid && pairMatches(r, relation.from, relation.to);

    if (ABUSE_TYPES.has(nextType)) {
      const reverse = document.querySelector('#editAbuseDirection').value === 'reverse';
      const from = reverse ? relation.to : relation.from, to = reverse ? relation.from : relation.to;
      const duplicate = state.relations.some(r => r.id !== rid && r.type === nextType && r.from === from && r.to === to);
      if (duplicate) { toast('같은 방향의 학대 유형이 이미 등록되어 있습니다'); return; }
      relation.from = from; relation.to = to;
      relation.color = document.querySelector('#editAbuseColor').value;
    }

    if (nextType === 'parent') {
      const direction = document.querySelector('#editParentDirection').value;
      if (!['forward', 'reverse'].includes(direction)) { toast('부모·자녀 방향을 선택해주세요'); return; }
      const from = direction === 'forward' ? relation.from : relation.to;
      const to = direction === 'forward' ? relation.to : relation.from;
      if (from === to || !state.people.some(p => p.id === from) || !state.people.some(p => p.id === to)) {
        toast('연결할 두 구성원을 확인해주세요'); return;
      }
      const duplicate = state.relations.some(r => r.id !== rid && r.type === 'parent' && r.from === from && r.to === to);
      if (duplicate) { toast('이미 등록된 부모–자녀 연결입니다'); return; }
      relation.from = from;
      relation.to = to;
    } else if (CORE_TYPES.has(nextType)) {
      state.relations = state.relations.filter(r => !(samePair(r) && ['marriage','separated','divorced'].includes(r.type)));
    } else if (OPTIONAL_TYPES.has(nextType)) {
      state.relations = state.relations.filter(r => !(samePair(r) && OPTIONAL_TYPES.has(r.type)));
    }

    if (!ABUSE_TYPES.has(nextType)) delete relation.color;
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
      optional: valid.filter(r => !CORE_TYPES.has(r.type) && !ABUSE_TYPES.has(r.type)),
      abuse: valid.filter(r => ABUSE_TYPES.has(r.type))
    };

    const row = r => {
      const a = state.people.find(p => p.id === r.from);
      const b = state.people.find(p => p.id === r.to);
      const meta = TYPE_META[r.type] || { label: r.type, group: typeGroup(r.type) };
      return `<div class="relation-edit-item" data-relation-row="${r.id}"><div class="relation-item-copy"><b>${escRel(a?.name || '구성원')} → ${escRel(b?.name || '구성원')}</b><small><span class="rel-tag ${meta.group === 'core' ? 'core' : 'optional'}">${meta.group === 'core' ? '기본' : '선택'}</span>${escRel(meta.label)}${ABUSE_TYPES.has(r.type) ? ' · ' + ({black:'검정',red:'빨강',blue:'파랑'}[r.color] || '검정') : ''}</small></div><div class="relation-row-actions"><button type="button" data-edit-rel="${r.id}">수정</button><button type="button" class="rel-remove" data-remove-rel="${r.id}" aria-label="연결선 삭제">×</button></div></div>`;
    };

    list.innerHTML = `
      <section class="relation-group-block core"><div class="relation-group-title"><span><strong>기본 관계선</strong><i class="rel-tag core">필수</i></span><small>${groups.core.length}개</small></div><div class="relation-group-body">${groups.core.length ? groups.core.map(row).join('') : '<p class="relation-group-empty">기본 관계선이 없습니다. 빠른 작성 또는 선 연결로 추가할 수 있습니다.</p>'}</div></section>
      <section class="relation-group-block optional"><div class="relation-group-title"><span><strong>관계 특성</strong><i class="rel-tag optional">선택</i></span><small>${groups.optional.length}개</small></div><div class="relation-group-body">${groups.optional.length ? groups.optional.map(row).join('') : '<p class="relation-group-empty">필요한 경우에만 친밀·갈등·소원 등의 관계 특성을 추가하세요.</p>'}</div><button type="button" class="relation-add-optional" id="addOptionalRelation">＋ 관계 특성 추가</button></section>`;

    list.insertAdjacentHTML('beforeend', `<section class="relation-group-block"><div class="relation-group-title"><strong>학대 유형</strong><small>${groups.abuse.length}개</small></div><div class="relation-group-body">${groups.abuse.length ? groups.abuse.map(row).join('') : '<p class="relation-group-empty">신체·정서·성·방임 학대 관계를 추가할 수 있습니다. 기본색은 검정입니다.</p>'}</div></section>`);

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
    addConnection = function(from, to, type, options = {}) {
      if (ABUSE_TYPES.has(type)) {
        const prefix = document.querySelector('#lineChoiceDialog[open]') ? 'popup' : 'add';
        const color = options.color || document.querySelector(`#${prefix}AbuseColor`)?.value || 'black';
        if (!Object.hasOwn(ABUSE_COLORS, color)) return false;
        const reverse = options.reverse ?? (document.querySelector(`#${prefix}AbuseDirection`)?.value === 'reverse');
        if (reverse) [from, to] = [to, from];
        if (from === to || !state.people.some(p => p.id === from) || !state.people.some(p => p.id === to)) return false;
        if (state.relations.some(r => r.type === type && r.from === from && r.to === to)) {
          toast('같은 방향의 학대 유형이 이미 등록되어 있습니다'); return false;
        }
        state.relations.push({id:id(), from, to, type, color});
        save(); render(); toast(`${TYPE_META[type].label} 관계선을 추가했습니다`); return true;
      }
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

  document.querySelector('#relationForm').addEventListener('submit', event => {
    const type = document.querySelector('#relationType').value;
    if (!ABUSE_TYPES.has(type)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (addConnection(document.querySelector('#relationFrom').value, document.querySelector('#relationTo').value, type)) els.relationDialog.close();
  }, true);
  injectStyles();
  enhanceLineChoiceDialog();
  enhanceRelationDialog();
  enhanceParentStatus();
  enhanceAdvancedQuick();
  updateCopy();
  ensureEditDialog();
  document.addEventListener('relation-edit-request', event => openRelationEditor(event.detail));
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
