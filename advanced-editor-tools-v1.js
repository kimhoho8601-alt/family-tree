(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || typeof save !== 'function' || typeof render !== 'function') return;

  const svg = els.svg;
  const nodeLayer = els.nodes;
  const relationLayer = els.relations;
  const toolActions = document.querySelector('.tool-actions');
  const canvasWrap = document.querySelector('#canvasWrap');
  if (!svg || !nodeLayer || !relationLayer || !toolActions || !canvasWrap) return;

  document.documentElement.dataset.advancedEditorTools = 'v1';

  const CHILD_ROLES = new Set(['대상자','자녀']);
  const VALID_LIFE = new Set(['alive','dead','unknown']);
  const VALID_COHABIT = new Set(['yes','no','unknown']);
  const VALID_GENDER = new Set(['male','female','unknown']);
  const VALID_RELATION = new Set(['marriage','parent','separated','divorced','distant','close','conflict']);
  const STRUCTURAL_PARTNER = new Set(['marriage','separated','divorced']);
  const selectedIds = new Set();
  let contextNodeId = null;
  let groupDrag = null;
  let clipboard = null;
  let pasteOffset = 0;
  let editingRelationId = null;

  const clone = value => JSON.parse(JSON.stringify(value));
  const findPerson = id => state.people.find(p => p.id === id);
  const clampX = x => Math.max(55, Math.min(1145, x));
  const clampY = y => Math.max(55, Math.min(665, y));

  const style = document.createElement('style');
  style.textContent = `
    .node.multi-selected .shape,.node.multi-selected .outer{stroke:#c9002b!important;stroke-width:4!important}
    .node.multi-selected{filter:drop-shadow(0 0 4px rgba(201,0,43,.22))}
    .node.position-locked{cursor:not-allowed}
    .node-lock-badge{font:700 13px 'IBM Plex Sans KR',sans-serif;fill:#6f6265;paint-order:stroke;stroke:#fff;stroke-width:4px;pointer-events:none}
    .selection-status{height:30px;display:inline-flex;align-items:center;padding:0 9px;border:1px solid #e4c7ce;border-radius:8px;background:#fff6f8;color:#a30b2c;font-size:10px;font-weight:700;white-space:nowrap}
    .editor-tool-wrap{position:relative;display:inline-flex}
    .editor-tool-popover{position:absolute;z-index:80;top:36px;right:0;min-width:170px;padding:6px;border:1px solid #e6dade;border-radius:10px;background:#fff;box-shadow:0 12px 28px rgba(47,30,35,.16);display:none}
    .editor-tool-popover.show{display:block}
    .editor-tool-popover button{width:100%;height:34px;border:0;border-radius:7px;background:transparent;text-align:left;padding:0 9px;font:600 11px 'IBM Plex Sans KR',sans-serif;color:#3d3134;cursor:pointer}
    .editor-tool-popover button:hover:not(:disabled){background:#fff1f4;color:#b00035}
    .editor-tool-popover button:disabled{opacity:.38;cursor:default}
    .tool-dialog{width:min(520px,calc(100vw - 32px));border:0;border-radius:16px;padding:0;box-shadow:0 22px 60px rgba(35,22,26,.24)}
    .tool-dialog::backdrop{background:rgba(31,22,24,.35)}
    .tool-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px 12px;border-bottom:1px solid #eee4e6}
    .tool-dialog-head h3{margin:0;font-size:16px}.tool-dialog-head p{margin:4px 0 0;color:#85777a;font-size:11px;line-height:1.5}
    .tool-dialog-close{width:30px;height:30px;border:0;border-radius:8px;background:#f6eff1;color:#6f6265;cursor:pointer}
    .tool-dialog-body{padding:16px 20px 20px;max-height:58vh;overflow:auto}
    .audit-summary{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:#f8f4f5;font-size:12px;font-weight:700;margin-bottom:10px}
    .audit-list{display:flex;flex-direction:column;gap:7px}.audit-item{padding:9px 10px;border:1px solid #eee4e6;border-radius:9px;font-size:11px;line-height:1.5;word-break:keep-all}.audit-item.error{border-color:#efc1cb;background:#fff7f9}.audit-item.warn{background:#fffaf0}
    .relation-edit-select{width:100%;height:40px;border:1px solid #ded1d4;border-radius:9px;padding:0 10px;background:#fff;font:12px 'IBM Plex Sans KR',sans-serif}
    .tool-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
    .tool-dialog-actions button{height:36px;padding:0 14px;border-radius:8px;font-weight:700;cursor:pointer}.tool-dialog-actions .cancel{border:1px solid #ded1d4;background:#fff;color:#5d5053}.tool-dialog-actions .save{border:0;background:#c9002b;color:#fff}
  `;
  document.head.append(style);

  // -----------------------------
  // Render decoration: selection + position lock
  // -----------------------------
  const previousRender = render;
  render = function () {
    const result = previousRender();
    decorateNodes();
    return result;
  };

  function decorateNodes() {
    nodeLayer.querySelectorAll('.node').forEach(node => {
      const p = findPerson(node.dataset.id);
      if (!p) return;
      node.classList.toggle('multi-selected', selectedIds.has(p.id));
      node.classList.toggle('position-locked', !!p.positionLocked);
      node.querySelector('.node-lock-badge')?.remove();
      if (p.positionLocked) {
        const badge = document.createElementNS('http://www.w3.org/2000/svg','text');
        badge.setAttribute('class','node-lock-badge editor-only');
        badge.setAttribute('x','34');
        badge.setAttribute('y','-34');
        badge.textContent='🔒';
        node.append(badge);
      }
    });
    updateSelectionStatus();
  }

  function cleanSelection() {
    [...selectedIds].forEach(id => { if (!findPerson(id)) selectedIds.delete(id); });
  }

  function setOnlySelected(id) {
    selectedIds.clear();
    if (id) selectedIds.add(id);
    decorateNodes();
  }

  // -----------------------------
  // Selection toolbar status
  // -----------------------------
  const selectionStatus = document.createElement('span');
  selectionStatus.className = 'selection-status';
  selectionStatus.hidden = true;
  const relationButton = document.querySelector('#relationBtn');
  toolActions.insertBefore(selectionStatus, relationButton || toolActions.firstChild);

  function updateSelectionStatus() {
    cleanSelection();
    selectionStatus.hidden = selectedIds.size < 2;
    selectionStatus.textContent = `${selectedIds.size}명 선택`;
    selectionArrangeButton.disabled = selectedIds.size < 2;
  }

  // -----------------------------
  // Multi-select + group drag
  // -----------------------------
  nodeLayer.addEventListener('pointerdown', e => {
    const node = e.target.closest?.('.node');
    if (!node) return;
    const id = node.dataset.id;
    const p = findPerson(id);
    if (!p) return;

    contextNodeId = id;

    if (e.shiftKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
      decorateNodes();
      return;
    }

    if (!selectedIds.has(id)) setOnlySelected(id);

    if (p.positionLocked) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toast('이 구성원의 위치는 잠겨 있습니다');
      return;
    }

    if (selectedIds.size > 1) {
      const starts = new Map();
      selectedIds.forEach(pid => {
        const person = findPerson(pid);
        if (person) starts.set(pid, {x:person.x, y:person.y, locked:!!person.positionLocked});
      });
      groupDrag = {primary:id, starts};
    } else {
      groupDrag = null;
    }
  }, true);

  svg.addEventListener('pointermove', () => {
    if (!groupDrag || typeof drag === 'undefined' || !drag?.p || drag.p.id !== groupDrag.primary) return;
    const primaryStart = groupDrag.starts.get(groupDrag.primary);
    if (!primaryStart) return;
    const dx = drag.p.x - primaryStart.x;
    const dy = drag.p.y - primaryStart.y;

    groupDrag.starts.forEach((start, id) => {
      if (id === groupDrag.primary || start.locked) return;
      const p = findPerson(id);
      if (!p) return;
      p.x = clampX(start.x + dx);
      p.y = clampY(start.y + dy);
      const node = nodeLayer.querySelector(`[data-id="${id}"]`);
      if (node) node.setAttribute('transform', `translate(${p.x} ${p.y})`);
    });
    renderRelations();
    decorateNodes();
  });

  const endGroupDrag = () => { groupDrag = null; };
  svg.addEventListener('pointerup', endGroupDrag);
  svg.addEventListener('pointercancel', endGroupDrag);
  svg.addEventListener('lostpointercapture', endGroupDrag);

  // -----------------------------
  // Auto arrange
  // -----------------------------
  const arrangeWrap = document.createElement('span');
  arrangeWrap.className = 'editor-tool-wrap';
  arrangeWrap.innerHTML = `<button type="button" class="button soft" id="autoArrangeBtn">⇄ 자동 정리</button><div class="editor-tool-popover" id="arrangePopover"><button type="button" data-arrange="all">전체 자동 정렬</button><button type="button" data-arrange="selected">선택한 구성원만 정렬</button></div>`;
  toolActions.insertBefore(arrangeWrap, relationButton || toolActions.firstChild);
  const arrangeButton = arrangeWrap.querySelector('#autoArrangeBtn');
  const arrangePopover = arrangeWrap.querySelector('#arrangePopover');
  const selectionArrangeButton = arrangePopover.querySelector('[data-arrange="selected"]');

  function roleRow(p) {
    if (['조부','조모'].includes(p.role)) return 110;
    if (['부','모'].includes(p.role)) return 240;
    if (p.role === '자녀') return 650;
    if (['대상자','형제·자매','배우자'].includes(p.role)) return 500;
    return 390;
  }

  function distributeRow(items, y, minX=140, maxX=1060) {
    const movable = items.filter(p => !p.positionLocked).sort((a,b) => a.x-b.x);
    if (!movable.length) return;
    if (movable.length === 1) {
      movable[0].y = y;
      return;
    }
    const step = (maxX - minX) / (movable.length - 1);
    movable.forEach((p,i) => { p.x = minX + step*i; p.y = y; });
  }

  function fullArrange() {
    if (!state.people.length) { toast('정렬할 구성원이 없습니다'); return; }
    const rows = new Map();
    state.people.forEach(p => {
      const y = roleRow(p);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push(p);
    });
    [...rows.entries()].forEach(([y,items]) => distributeRow(items, Number(y)));

    // Keep sibling groups centered beneath their explicitly linked parents.
    const children = state.people.filter(p => CHILD_ROLES.has(p.role));
    const groups = new Map();
    children.forEach(child => {
      const parentIds = state.relations.filter(r => r.type === 'parent' && r.to === child.id).map(r => r.from).sort();
      if (!parentIds.length) return;
      const key = parentIds.join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(child);
    });
    groups.forEach((siblings,key) => {
      const parents = key.split('|').map(findPerson).filter(Boolean);
      if (!parents.length) return;
      const center = parents.reduce((sum,p) => sum+p.x,0)/parents.length;
      const movable = siblings.filter(p => !p.positionLocked).sort((a,b)=>a.x-b.x);
      const gap = movable.length > 3 ? 115 : 145;
      movable.forEach((p,i) => {
        p.x = clampX(center + (i-(movable.length-1)/2)*gap);
        p.y = p.role === '자녀' ? 650 : 500;
      });
    });

    save(); render(); toast('가계도 전체를 정리했습니다');
  }

  function selectedArrange() {
    const people = [...selectedIds].map(findPerson).filter(p => p && !p.positionLocked);
    if (people.length < 2) { toast('Shift로 구성원을 2명 이상 선택해주세요'); return; }

    const sorted = people.slice().sort((a,b)=>a.y-b.y);
    const clusters = [];
    sorted.forEach(p => {
      const current = clusters[clusters.length-1];
      if (!current || Math.abs(p.y - current.avgY) > 75) clusters.push({items:[p], avgY:p.y});
      else {
        current.items.push(p);
        current.avgY = current.items.reduce((s,x)=>s+x.y,0)/current.items.length;
      }
    });

    clusters.forEach(cluster => {
      const items = cluster.items.sort((a,b)=>a.x-b.x);
      const y = Math.round(cluster.avgY);
      if (items.length === 1) { items[0].y = y; return; }
      let minX = Math.min(...items.map(p=>p.x));
      let maxX = Math.max(...items.map(p=>p.x));
      if (maxX-minX < 160*(items.length-1)) {
        const center = (minX+maxX)/2;
        const width = 160*(items.length-1);
        minX = center-width/2; maxX = center+width/2;
      }
      const step = (maxX-minX)/(items.length-1);
      items.forEach((p,i)=>{p.x=clampX(minX+step*i);p.y=clampY(y);});
    });

    save(); render(); toast('선택한 구성원을 동일 간격으로 정렬했습니다');
  }

  arrangeButton.addEventListener('click', e => {
    e.stopPropagation();
    arrangePopover.classList.toggle('show');
    updateSelectionStatus();
  });
  arrangePopover.addEventListener('click', e => {
    const type = e.target.closest('[data-arrange]')?.dataset.arrange;
    if (!type) return;
    arrangePopover.classList.remove('show');
    if (type === 'all') fullArrange(); else selectedArrange();
  });
  document.addEventListener('pointerdown', e => { if (!arrangeWrap.contains(e.target)) arrangePopover.classList.remove('show'); });

  // -----------------------------
  // Relationship / data validation
  // -----------------------------
  const auditButton = document.createElement('button');
  auditButton.type = 'button';
  auditButton.className = 'button soft';
  auditButton.id = 'auditBtn';
  auditButton.textContent = '✓ 관계 점검';
  toolActions.insertBefore(auditButton, relationButton || toolActions.firstChild);

  const auditDialog = document.createElement('dialog');
  auditDialog.className = 'tool-dialog';
  auditDialog.innerHTML = `<div class="tool-dialog-head"><div><h3>가계도 관계 점검</h3><p>현재 저장된 구성원·관계 데이터의 충돌 가능성을 확인합니다.</p></div><button type="button" class="tool-dialog-close" data-close-audit>×</button></div><div class="tool-dialog-body" id="auditBody"></div>`;
  document.body.append(auditDialog);
  auditDialog.querySelector('[data-close-audit]').onclick = () => auditDialog.close();

  function audit() {
    const issues = [];
    const personIds = new Set();
    state.people.forEach((p,i) => {
      if (!p.id || personIds.has(p.id)) issues.push({level:'error',text:`구성원 ${i+1}: 식별 ID가 없거나 중복되어 있습니다.`});
      personIds.add(p.id);
      if (!VALID_LIFE.has(p.life)) issues.push({level:'warn',text:`${p.name||'구성원'}: 생존 상태값이 올바르지 않습니다 (${p.life||'없음'}).`});
      if (!VALID_COHABIT.has(p.cohabit)) issues.push({level:'warn',text:`${p.name||'구성원'}: 동거 상태값이 올바르지 않습니다.`});
      if (!VALID_GENDER.has(p.gender)) issues.push({level:'warn',text:`${p.name||'구성원'}: 성별 상태값이 올바르지 않습니다.`});
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) issues.push({level:'error',text:`${p.name||'구성원'}: 화면 위치 좌표가 손상되었습니다.`});
    });

    if (!state.people.some(p => p.role === '대상자')) issues.push({level:'warn',text:'대상자로 지정된 구성원이 없습니다.'});

    const relationKeys = new Set();
    state.relations.forEach((r,i) => {
      const a = findPerson(r.from), b = findPerson(r.to);
      if (!a || !b) issues.push({level:'error',text:`관계 ${i+1}: 존재하지 않는 구성원을 참조하는 연결선이 있습니다.`});
      if (r.from === r.to) issues.push({level:'error',text:`${a?.name||'구성원'}: 자기 자신에게 연결된 관계선이 있습니다.`});
      if (!VALID_RELATION.has(r.type)) issues.push({level:'warn',text:`${a?.name||'구성원'} ↔ ${b?.name||'구성원'}: 알 수 없는 관계선 값(${r.type})이 있습니다.`});
      const directionKey = `${r.type}:${r.from}:${r.to}`;
      if (relationKeys.has(directionKey)) issues.push({level:'warn',text:`${a?.name||'구성원'} → ${b?.name||'구성원'}: 같은 관계선이 중복 등록되어 있습니다.`});
      relationKeys.add(directionKey);
      if (r.type === 'parent' && a && b) {
        if (CHILD_ROLES.has(a.role) && !CHILD_ROLES.has(b.role)) issues.push({level:'error',text:`${a.name} → ${b.name}: 부모→자녀 방향이 반대로 연결되어 있습니다.`});
        if (!CHILD_ROLES.has(b.role)) issues.push({level:'warn',text:`${a.name} → ${b.name}: 부모선의 도착 구성원이 아동/자녀 역할이 아닙니다.`});
      }
    });

    state.people.filter(p => CHILD_ROLES.has(p.role)).forEach(child => {
      const parents = state.relations.filter(r => r.type === 'parent' && r.to === child.id).map(r => findPerson(r.from)).filter(Boolean);
      const fathers = parents.filter(p => p.role === '부');
      const mothers = parents.filter(p => p.role === '모');
      if (fathers.length > 1) issues.push({level:'error',text:`${child.name}: '부'가 ${fathers.length}명 부모로 연결되어 있습니다.`});
      if (mothers.length > 1) issues.push({level:'error',text:`${child.name}: '모'가 ${mothers.length}명 부모로 연결되어 있습니다.`});
      if (parents.length > 2) issues.push({level:'warn',text:`${child.name}: 부모선이 총 ${parents.length}개 연결되어 있습니다.`});
    });

    const pairStructural = new Map();
    state.relations.filter(r => STRUCTURAL_PARTNER.has(r.type)).forEach(r => {
      const key = [r.from,r.to].sort().join('|');
      if (!pairStructural.has(key)) pairStructural.set(key, []);
      pairStructural.get(key).push(r);
    });
    pairStructural.forEach(list => {
      if (list.length < 2) return;
      const a=findPerson(list[0].from),b=findPerson(list[0].to);
      issues.push({level:'warn',text:`${a?.name||'구성원'} ↔ ${b?.name||'구성원'}: 부부/별거/이혼 상태가 중복 등록되어 있습니다.`});
    });

    if (state.cohabitBox && (!Number.isFinite(state.cohabitBox.x)||!Number.isFinite(state.cohabitBox.y)||!Number.isFinite(state.cohabitBox.w)||!Number.isFinite(state.cohabitBox.h))) {
      issues.push({level:'warn',text:'동거가족 테두리 위치 데이터가 손상되어 있습니다.'});
    }
    return issues;
  }

  auditButton.onclick = () => {
    const issues = audit();
    const body = auditDialog.querySelector('#auditBody');
    if (!issues.length) {
      body.innerHTML = `<div class="audit-summary">✓ 현재 확인된 관계 충돌이 없습니다.</div><p style="margin:0;color:#807275;font-size:11px;line-height:1.6">구성원 상태값, 부모 방향, 중복 부모·관계선, 연결 대상과 좌표를 점검했습니다.</p>`;
    } else {
      const errors = issues.filter(x=>x.level==='error').length;
      const warns = issues.length-errors;
      body.innerHTML = `<div class="audit-summary">점검 결과 · 오류 ${errors}건 · 확인 ${warns}건</div><div class="audit-list">${issues.map(x=>`<div class="audit-item ${x.level}">${x.level==='error'?'⚠':'•'} ${esc(x.text)}</div>`).join('')}</div>`;
    }
    auditDialog.showModal();
  };

  // -----------------------------
  // Lock + Duplicate context menu
  // -----------------------------
  const contextMenu = document.querySelector('.editor-context-menu');
  let lockMenuButton = null, duplicateMenuButton = null;
  if (contextMenu) {
    const sep = document.createElement('div'); sep.className='editor-context-sep advanced-node-context';
    lockMenuButton = document.createElement('button');
    lockMenuButton.type='button';lockMenuButton.className='editor-context-item advanced-node-context';lockMenuButton.dataset.advancedAction='lock';
    duplicateMenuButton = document.createElement('button');
    duplicateMenuButton.type='button';duplicateMenuButton.className='editor-context-item advanced-node-context';duplicateMenuButton.dataset.advancedAction='duplicate';
    duplicateMenuButton.innerHTML='<span>⧉ 복제</span><span class="editor-context-shortcut">Ctrl+D</span>';
    contextMenu.append(sep, lockMenuButton, duplicateMenuButton);
  }

  canvasWrap.addEventListener('contextmenu', e => {
    const node = e.target.closest?.('.node');
    contextNodeId = node?.dataset.id || null;
    if (!lockMenuButton || !duplicateMenuButton) return;
    const show = !!contextNodeId;
    contextMenu.querySelectorAll('.advanced-node-context').forEach(el => el.style.display = show ? '' : 'none');
    if (show) {
      const p=findPerson(contextNodeId);
      lockMenuButton.innerHTML = p?.positionLocked ? '<span>🔓 위치 잠금 해제</span><span></span>' : '<span>🔒 위치 잠금</span><span></span>';
    }
  });

  contextMenu?.addEventListener('click', e => {
    const action=e.target.closest('[data-advanced-action]')?.dataset.advancedAction;
    if (!action || !contextNodeId) return;
    e.stopPropagation();
    if (action === 'lock') toggleLock(contextNodeId);
    if (action === 'duplicate') duplicateIds(selectedIds.has(contextNodeId)?[...selectedIds]:[contextNodeId]);
    contextMenu.classList.remove('show');
  }, true);

  function toggleLock(id) {
    const p=findPerson(id);if(!p)return;
    p.positionLocked=!p.positionLocked;
    save();render();
    toast(p.positionLocked?'구성원 위치를 잠갔습니다':'위치 잠금을 해제했습니다');
  }

  // -----------------------------
  // Copy / Paste / Duplicate
  // -----------------------------
  function makeClipboard(ids) {
    const set=new Set(ids.filter(id=>findPerson(id)));
    if(!set.size)return null;
    return {
      people: state.people.filter(p=>set.has(p.id)).map(clone),
      relations: state.relations.filter(r=>set.has(r.from)&&set.has(r.to)).map(clone)
    };
  }

  function pasteClipboard(source=clipboard) {
    if(!source?.people?.length){toast('복사된 구성원이 없습니다');return;}
    pasteOffset=(pasteOffset+1)%6;
    const offset=28+pasteOffset*8;
    const idMap=new Map();
    const newPeople=source.people.map(old=>{
      const newId=id();idMap.set(old.id,newId);
      return {...clone(old),id:newId,name:`${old.name||old.role||'구성원'} 복사`,x:clampX((Number(old.x)||600)+offset),y:clampY((Number(old.y)||360)+offset),positionLocked:false};
    });
    const newRelations=source.relations.map(r=>({...clone(r),id:id(),from:idMap.get(r.from),to:idMap.get(r.to)})).filter(r=>r.from&&r.to);
    state.people.push(...newPeople);state.relations.push(...newRelations);
    selectedIds.clear();newPeople.forEach(p=>selectedIds.add(p.id));
    save();render();toast(`${newPeople.length}명의 구성원을 복제했습니다`);
  }

  function duplicateIds(ids) {
    const source=makeClipboard(ids);if(!source)return;
    pasteClipboard(source);
  }

  document.addEventListener('keydown', e => {
    const target=e.target;
    const editable=target instanceof HTMLElement&&(target.matches('input,textarea,select')||target.isContentEditable);
    if(editable)return;
    const mod=e.ctrlKey||e.metaKey;if(!mod)return;
    const key=e.key.toLowerCase();
    if(key==='c' && selectedIds.size){e.preventDefault();clipboard=makeClipboard([...selectedIds]);pasteOffset=0;toast(`${selectedIds.size}명의 구성원을 복사했습니다`);}
    else if(key==='v'){e.preventDefault();pasteClipboard();}
    else if(key==='d'){e.preventDefault();const ids=selectedIds.size?[...selectedIds]:(contextNodeId?[contextNodeId]:[]);duplicateIds(ids);}
  });

  // -----------------------------
  // Double-click relation to change line type
  // -----------------------------
  const relationDialog=document.createElement('dialog');
  relationDialog.className='tool-dialog';
  relationDialog.innerHTML=`<form id="quickRelationEditForm"><div class="tool-dialog-head"><div><h3>관계선 변경</h3><p id="relationEditPair">선택한 두 구성원의 관계를 변경합니다.</p></div><button type="button" class="tool-dialog-close" data-close-relation-edit>×</button></div><div class="tool-dialog-body"><label style="display:block;font-size:11px;font-weight:700;margin-bottom:6px">관계선</label><select id="quickRelationType" class="relation-edit-select"></select><div class="tool-dialog-actions"><button type="button" class="cancel" data-close-relation-edit>취소</button><button type="submit" class="save">변경하기</button></div></div></form>`;
  document.body.append(relationDialog);
  relationDialog.querySelectorAll('[data-close-relation-edit]').forEach(b=>b.onclick=()=>relationDialog.close());

  function relationOptions(r) {
    if(r.relationRole==='parent-child-emotional') return [['close','친밀·지지'],['distant','소원·불명확'],['conflict','갈등·적대']];
    return [['marriage','실선 · 부부/동반자'],['separated','별거'],['divorced','이혼'],['distant','점선 · 소원/불명확'],['close','굵은선 · 친밀/지지'],['conflict','지그재그 · 갈등/적대']];
  }

  relationLayer.addEventListener('dblclick', e => {
    if(typeof connectMode!=='undefined'&&(connectMode?.delete||connectMode?.active))return;
    const group=e.target.closest?.('.relation-group[data-relation]');
    if(!group)return;
    const rid=group.dataset.relation;
    const r=state.relations.find(x=>x.id===rid);
    if(!r||r.type==='parent')return;
    e.preventDefault();e.stopPropagation();
    editingRelationId=rid;
    const a=findPerson(r.from),b=findPerson(r.to);
    relationDialog.querySelector('#relationEditPair').textContent=`${a?.name||'구성원'} ↔ ${b?.name||'구성원'}`;
    const select=relationDialog.querySelector('#quickRelationType');
    select.innerHTML=relationOptions(r).map(([v,label])=>`<option value="${v}">${label}</option>`).join('');
    if([...select.options].some(o=>o.value===r.type))select.value=r.type;
    relationDialog.showModal();
  });

  relationDialog.querySelector('#quickRelationEditForm').addEventListener('submit', e => {
    e.preventDefault();
    const r=state.relations.find(x=>x.id===editingRelationId);if(!r)return;
    const next=relationDialog.querySelector('#quickRelationType').value;
    if(r.relationRole!=='parent-child-emotional'&&STRUCTURAL_PARTNER.has(next)){
      state.relations=state.relations.filter(x=>x.id===r.id||!(((x.from===r.from&&x.to===r.to)||(x.from===r.to&&x.to===r.from))&&STRUCTURAL_PARTNER.has(x.type)));
    }
    r.type=next;
    save();render();relationDialog.close();editingRelationId=null;toast('관계선을 변경했습니다');
  });

  // Hide editor-only lock badges before PNG clone/export.
  document.querySelector('#downloadBtn')?.addEventListener('click',()=>{
    const badges=[...nodeLayer.querySelectorAll('.node-lock-badge')];
    const prev=badges.map(x=>x.style.display);
    badges.forEach(x=>x.style.display='none');
    requestAnimationFrame(()=>badges.forEach((x,i)=>x.style.display=prev[i]));
  },true);

  decorateNodes();
})();