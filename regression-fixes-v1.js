(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || typeof renderRelations !== 'function') return;

  document.documentElement.dataset.regressionFixes = 'v1';

  const isCohabit = person => person && person.life !== 'dead' &&
    (person.cohabit === true || ['yes', 'true', '1', '동거'].includes(String(person.cohabit).toLowerCase()));

  function getCohabitBox() {
    const members = state.people.filter(isCohabit);
    if (!members.length) return null;
    const automatic = {
      x: Math.max(8, Math.min(...members.map(person => person.x)) - 66),
      y: Math.max(8, Math.min(...members.map(person => person.y)) - 66),
      w: 0,
      h: 0
    };
    const right = Math.min(1192, Math.max(...members.map(person => person.x)) + 66);
    const bottom = Math.min(712, Math.max(...members.map(person => person.y)) + 100);
    automatic.w = Math.max(140, right - automatic.x);
    automatic.h = Math.max(120, bottom - automatic.y);
    const saved = state.cohabitBox;
    return saved && [saved.x, saved.y, saved.w, saved.h].every(Number.isFinite) ? {...saved} : automatic;
  }

  function restoreCohabitBoundary() {
    if (els.relations.querySelector('.cohabit-boundary-v3')) return;
    const box = getCohabitBox();
    if (!box) return;
    const ns = 'http://www.w3.org/2000/svg';
    const group = document.createElementNS(ns, 'g');
    group.setAttribute('class', 'cohabit-boundary-v3');
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', box.x); rect.setAttribute('y', box.y);
    rect.setAttribute('width', box.w); rect.setAttribute('height', box.h);
    rect.setAttribute('rx', '10'); rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', '#33272a'); rect.setAttribute('stroke-width', '2.5');
    rect.setAttribute('pointer-events', 'none');
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', box.x + 12); label.setAttribute('y', box.y > 24 ? box.y - 8 : box.y + 18);
    label.setAttribute('fill', '#33272a'); label.setAttribute('font-size', '12'); label.setAttribute('font-weight', '700');
    label.textContent = '동거가족';
    const hint = document.createElementNS(ns, 'text');
    hint.setAttribute('class', 'cohabit-hint'); hint.setAttribute('x', box.x + 80);
    hint.setAttribute('y', box.y > 24 ? box.y - 8 : box.y + 18);
    hint.textContent = '모서리를 드래그해 크기 조절';
    group.append(rect, label, hint);
    const corners = {nw:[box.x,box.y], ne:[box.x+box.w,box.y], sw:[box.x,box.y+box.h], se:[box.x+box.w,box.y+box.h]};
    Object.entries(corners).forEach(([corner, [x, y]]) => {
      const handle = document.createElementNS(ns, 'rect');
      handle.setAttribute('class', 'cohabit-resize-handle'); handle.dataset.corner = corner;
      handle.setAttribute('x', x - 5); handle.setAttribute('y', y - 5);
      handle.setAttribute('width', '10'); handle.setAttribute('height', '10'); handle.setAttribute('rx', '2');
      group.append(handle);
    });
    els.relations.insertBefore(group, els.relations.firstChild);
  }

  const routedRenderRelations = renderRelations;
  renderRelations = function(...args) {
    const result = routedRenderRelations.apply(this, args);
    restoreCohabitBoundary();
    return result;
  };

  const selectedPeople = new Set();
  const style = document.createElement('style');
  style.textContent = `
    .node.person-delete-selected .shape,.node.person-delete-selected .outer{stroke:#c9002b!important;stroke-width:4!important}

    /* Person editor gender selector: override generic form input sizing. */
    #personDialog .gender-choice{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:8px;
      width:100%;
    }
    #personDialog .gender-choice label{
      position:relative;
      min-width:0;
      cursor:pointer;
    }
    #personDialog .gender-choice input[type="radio"]{
      position:absolute!important;
      width:1px!important;
      height:1px!important;
      margin:0!important;
      padding:0!important;
      opacity:0;
      pointer-events:none;
    }
    #personDialog .gender-choice span{
      display:flex;
      align-items:center;
      justify-content:center;
      width:100%;
      min-height:44px;
      margin:0;
      padding:10px 8px;
      border:1px solid var(--line);
      border-radius:10px;
      background:#fff;
      color:var(--ink);
      font-size:13px;
      font-weight:600;
      line-height:1.2;
      text-align:center;
      white-space:nowrap;
      transition:border-color .16s ease,background .16s ease,color .16s ease,box-shadow .16s ease,transform .16s ease;
    }
    #personDialog .gender-choice label:hover span{
      border-color:#e5a1b0;
      background:#fffafb;
    }
    #personDialog .gender-choice input[type="radio"]:checked + span{
      border-color:var(--red);
      background:var(--red-soft);
      color:var(--red);
      font-weight:800;
      box-shadow:0 0 0 1px rgba(201,0,43,.04);
    }
    #personDialog .gender-choice input[type="radio"]:focus-visible + span{
      outline:2px solid var(--red);
      outline-offset:2px;
    }
    #personDialog .gender-choice label:active span{transform:translateY(1px)}

    /* Update notice */
    #updateNoticeDialog{
      width:min(560px,calc(100% - 28px));
      max-height:min(760px,calc(100vh - 32px));
      padding:0;
      border:0;
      border-radius:22px;
      overflow:hidden;
      background:#fff;
      color:var(--ink);
      box-shadow:0 28px 90px rgba(47,10,18,.28);
    }
    #updateNoticeDialog::backdrop{
      background:rgba(36,18,23,.52);
      backdrop-filter:blur(5px);
    }
    .update-notice-shell{display:flex;flex-direction:column;max-height:inherit}
    .update-notice-head{position:relative;padding:28px 28px 18px;background:linear-gradient(145deg,#fff 0%,#fff7f9 100%);border-bottom:1px solid #f1e5e8}
    .update-notice-kicker{display:inline-flex;align-items:center;gap:7px;margin:0 0 10px;color:var(--red);font:800 11px Manrope;letter-spacing:.14em}
    .update-notice-kicker::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--red);box-shadow:0 0 0 5px rgba(201,0,43,.08)}
    .update-notice-head h2{margin:0;font-size:26px;line-height:1.22;letter-spacing:-.035em}
    .update-notice-head p{margin:8px 48px 0 0;color:var(--muted);font-size:13px;line-height:1.6}
    .update-notice-close{position:absolute;top:22px;right:22px;width:36px;height:36px;border:0;border-radius:50%;background:#f4edef;color:#5e5053;font-size:22px;line-height:1;cursor:pointer;transition:.16s}
    .update-notice-close:hover{background:#eadde0;color:var(--ink)}
    .update-notice-body{padding:22px 28px 8px;overflow:auto}
    .update-feature-list{display:grid;gap:10px;margin:0;padding:0;list-style:none}
    .update-feature{display:grid;grid-template-columns:34px minmax(0,1fr);gap:12px;align-items:start;padding:14px;border:1px solid #eee2e5;border-radius:14px;background:#fff}
    .update-feature-num{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:var(--red-soft);color:var(--red);font:800 13px Manrope}
    .update-feature strong{display:block;margin:1px 0 3px;font-size:14px;line-height:1.45}
    .update-feature span{display:block;color:var(--muted);font-size:12px;line-height:1.55}
    .update-refresh-tip{display:grid;grid-template-columns:32px minmax(0,1fr);gap:11px;align-items:start;margin-top:14px;padding:13px 14px;border-radius:13px;background:#f8f5f5;border:1px solid #eee6e7}
    .update-refresh-tip i{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:#fff;color:var(--red);font-style:normal;font-size:17px;font-weight:800;box-shadow:0 1px 4px rgba(70,20,30,.07)}
    .update-refresh-tip strong{display:block;font-size:12px;margin-bottom:3px}
    .update-refresh-tip p{margin:0;color:#716568;font-size:11px;line-height:1.55;word-break:keep-all}
    .update-refresh-tip kbd{display:inline-block;margin:0 2px;padding:2px 5px;border:1px solid #d9cdcf;border-bottom-width:2px;border-radius:5px;background:#fff;font:700 10px Manrope;color:#4d4144;white-space:nowrap}
    .update-notice-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 28px 24px;background:#fff}
    .update-notice-never{display:flex;align-items:center;gap:8px;color:#64585b;font-size:12px;font-weight:600;cursor:pointer;user-select:none}
    .update-notice-never input{width:17px;height:17px;margin:0;accent-color:var(--red)}
    .update-notice-ok{min-width:104px;height:44px;padding:0 20px;border:0;border-radius:11px;background:var(--red);color:#fff;font:700 14px inherit;cursor:pointer;box-shadow:0 8px 18px rgba(201,0,43,.18);transition:.16s}
    .update-notice-ok:hover{background:var(--red-dark);transform:translateY(-1px)}

    @media(max-width:560px){
      #personDialog form{padding:22px 18px}
      #personDialog .form-grid{gap:15px}
      #personDialog .gender-choice{gap:6px}
      #personDialog .gender-choice span{min-height:42px;padding:9px 4px;font-size:12px;border-radius:9px}

      #updateNoticeDialog{width:calc(100% - 20px);max-height:calc(100dvh - 20px);border-radius:18px}
      .update-notice-head{padding:23px 20px 16px}
      .update-notice-head h2{font-size:22px;padding-right:38px}
      .update-notice-head p{margin-right:0;font-size:12px}
      .update-notice-close{top:16px;right:16px;width:34px;height:34px}
      .update-notice-body{padding:18px 20px 6px}
      .update-feature{grid-template-columns:30px minmax(0,1fr);gap:10px;padding:12px}
      .update-feature-num{width:30px;height:30px;border-radius:9px;font-size:12px}
      .update-feature strong{font-size:13px}
      .update-feature span{font-size:11px}
      .update-refresh-tip{grid-template-columns:28px minmax(0,1fr);gap:9px;padding:12px}
      .update-refresh-tip i{width:28px;height:28px;font-size:15px}
      .update-notice-foot{padding:15px 20px 20px;align-items:stretch;flex-direction:column}
      .update-notice-never{min-height:36px}
      .update-notice-ok{width:100%;height:46px}
    }
    @media(min-width:561px) and (max-width:900px){
      #personDialog .gender-choice span{min-height:46px}
      #updateNoticeDialog{width:min(600px,calc(100% - 40px))}
      .update-feature{padding:15px}
      .update-notice-ok{min-height:46px}
    }
  `;
  document.head.append(style);

  function installUpdateNotice(){
    const storageKey='familyTreeUpdateNotice_20260913_v1';
    try{if(localStorage.getItem(storageKey)==='hidden')return;}catch(_){}
    if(document.querySelector('#updateNoticeDialog'))return;

    const dialog=document.createElement('dialog');
    dialog.id='updateNoticeDialog';
    dialog.setAttribute('aria-labelledby','updateNoticeTitle');
    dialog.innerHTML=`
      <div class="update-notice-shell">
        <div class="update-notice-head">
          <p class="update-notice-kicker">UPDATE NOTICE</p>
          <h2 id="updateNoticeTitle">새로운 기능이 업데이트되었습니다</h2>
          <p>사례관계도 작성과 편집이 조금 더 빠르고 편리해졌습니다.</p>
          <button type="button" class="update-notice-close" aria-label="공지 닫기">×</button>
        </div>
        <div class="update-notice-body">
          <ol class="update-feature-list">
            <li class="update-feature"><b class="update-feature-num">1</b><div><strong>아동 추가 시 ‘클라이언트’ 설정 버튼 추가</strong><span>추가 아동이 형제·자매인지 사례 클라이언트인지 구분해 설정할 수 있습니다.</span></div></li>
            <li class="update-feature"><b class="update-feature-num">2</b><div><strong>조부모 자동 생성 추가</strong><span>빠른 작성 과정에서 조부모를 보다 간편하게 구성할 수 있습니다.</span></div></li>
            <li class="update-feature"><b class="update-feature-num">3</b><div><strong>그리드 내 ‘개체 편집’ 기능 추가</strong><span>그리드의 구성원을 더블클릭해 식별명·관계·성별·메모 등을 바로 수정할 수 있습니다.</span></div></li>
          </ol>
          <div class="update-refresh-tip"><i>↻</i><div><strong>업데이트 기능이 보이지 않나요?</strong><p><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F5</kbd>로 강력 새로고침 후 다시 사용해주세요.</p></div></div>
        </div>
        <div class="update-notice-foot">
          <label class="update-notice-never"><input type="checkbox" id="updateNoticeNever"><span>이후 이 공지 열지 않기</span></label>
          <button type="button" class="update-notice-ok">확인</button>
        </div>
      </div>`;
    document.body.append(dialog);

    const never=dialog.querySelector('#updateNoticeNever');
    const close=()=>{
      if(never?.checked){try{localStorage.setItem(storageKey,'hidden');}catch(_){}}
      if(dialog.open)dialog.close();
    };
    dialog.querySelector('.update-notice-close')?.addEventListener('click',close);
    dialog.querySelector('.update-notice-ok')?.addEventListener('click',close);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{if(event.target===dialog)close();});

    const show=()=>{
      if(dialog.open)return;
      if(document.querySelector('dialog[open]:not(#updateNoticeDialog)'))return setTimeout(show,350);
      try{dialog.showModal();}catch(_){dialog.setAttribute('open','');}
    };
    setTimeout(show,220);
  }

  installUpdateNotice();

  function syncPersonSelection() {
    [...selectedPeople].forEach(personId => {
      if (!state.people.some(person => person.id === personId)) selectedPeople.delete(personId);
    });
    els.nodes.querySelectorAll('.node').forEach(node => node.classList.toggle('person-delete-selected', selectedPeople.has(node.dataset.id)));
  }

  els.nodes.addEventListener('pointerdown', event => {
    if (window.__COHABIT_PICK_MODE__) return;
    if (typeof connectMode !== 'undefined' && (connectMode.active || connectMode.delete)) return;
    const node = event.target.closest?.('.node');
    if (!node) return;
    if (!event.shiftKey) selectedPeople.clear();
    if (event.shiftKey && selectedPeople.has(node.dataset.id)) selectedPeople.delete(node.dataset.id);
    else selectedPeople.add(node.dataset.id);
    queueMicrotask(syncPersonSelection);
  }, true);

  els.list.addEventListener('click', event => {
    const button = event.target.closest?.('[data-delete]');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    removePerson(button.dataset.delete);
  }, true);

  document.addEventListener('keydown', event => {
    if (!['Delete', 'Backspace'].includes(event.key) || !selectedPeople.size) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable)) return;
    if (document.querySelector('dialog[open]')) return;
    if (typeof selectedRelationIds !== 'undefined' && selectedRelationIds.length) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const ids = [...selectedPeople];
    const names = state.people.filter(person => ids.includes(person.id)).map(person => person.name).join(', ');
    if (!confirm(`${names || `${ids.length}명의 구성원`}을(를) 삭제할까요? 연결된 관계선도 함께 삭제됩니다.`)) return;
    state.people = state.people.filter(person => !ids.includes(person.id));
    state.relations = state.relations.filter(relation => !ids.includes(relation.from) && !ids.includes(relation.to));
    state.cohabitBox = null;
    selectedPeople.clear();
    save(); render(); toast('선택한 구성원을 삭제했습니다');
  }, true);

  const currentRender = render;
  render = function(...args) {
    const result = currentRender.apply(this, args);
    syncPersonSelection();
    return result;
  };

  render();
})();
