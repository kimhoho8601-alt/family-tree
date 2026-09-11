(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined' || typeof save !== 'function' || typeof render !== 'function') return;

  const svg = els.svg;
  const nodeLayer = els.nodes;
  const relationLayer = els.relations;
  const toolActions = document.querySelector('.tool-actions');
  const canvasWrap = document.querySelector('#canvasWrap');
  if (!svg || !nodeLayer || !relationLayer || !toolActions || !canvasWrap) return;

  document.documentElement.dataset.advancedEditorTools = 'v2';

  const CHILD_ROLES = new Set(['대상자','자녀']);
  const VALID_LIFE = new Set(['alive','dead','unknown']);
  const VALID_COHABIT = new Set(['yes','no','unknown']);
  const VALID_GENDER = new Set(['male','female','unknown']);
  const VALID_RELATION = new Set(['marriage','parent','separated','divorced','distant','close','conflict','enmeshed','cutoff','close_conflict']);
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

  const previousRender = render;
  render = function () { const result = previousRender(); decorateNodes(); return result; };

  function decorateNodes() {
    nodeLayer.querySelectorAll('.node').forEach(node => {
      const p = findPerson(node.dataset.id); if (!p) return;
      node.classList.toggle('multi-selected', selectedIds.has(p.id));
      node.classList.toggle('position-locked', !!p.positionLocked);
      node.querySelector('.node-lock-badge')?.remove();
      if (p.positionLocked) {
        const badge = document.createElementNS('http://www.w3.org/2000/svg','text');
        badge.setAttribute('class','node-lock-badge editor-only');badge.setAttribute('x','34');badge.setAttribute('y','-34');badge.textContent='🔒';node.append(badge);
      }
    });
    updateSelectionStatus();
  }

  function cleanSelection(){[...selectedIds].forEach(id=>{if(!findPerson(id))selectedIds.delete(id)})}
  function setOnlySelected(id){selectedIds.clear();if(id)selectedIds.add(id);decorateNodes()}

  const selectionStatus=document.createElement('span');selectionStatus.className='selection-status';selectionStatus.hidden=true;
  const relationButton=document.querySelector('#relationBtn');toolActions.insertBefore(selectionStatus,relationButton||toolActions.firstChild);
  function updateSelectionStatus(){cleanSelection();selectionStatus.hidden=selectedIds.size<2;selectionStatus.textContent=`${selectedIds.size}명 선택`;if(typeof selectionArrangeButton!=='undefined')selectionArrangeButton.disabled=selectedIds.size<2}

  // Ctrl/Cmd or Shift + click toggles multi-selection. This works well for
  // selecting both grandparents (or a whole branch) before Ctrl+C / Ctrl+V.
  nodeLayer.addEventListener('pointerdown',e=>{
    if(window.__COHABIT_PICK_MODE__)return;
    const node=e.target.closest?.('.node');if(!node)return;
    const id=node.dataset.id,p=findPerson(id);if(!p)return;contextNodeId=id;
    const additive=e.shiftKey||e.ctrlKey||e.metaKey;
    if(additive){e.preventDefault();e.stopImmediatePropagation();selectedIds.has(id)?selectedIds.delete(id):selectedIds.add(id);decorateNodes();return}
    if(!selectedIds.has(id))setOnlySelected(id);
    if(p.positionLocked){e.preventDefault();e.stopImmediatePropagation();toast('이 구성원의 위치는 잠겨 있습니다');return}
    if(selectedIds.size>1){const starts=new Map();selectedIds.forEach(pid=>{const person=findPerson(pid);if(person)starts.set(pid,{x:person.x,y:person.y,locked:!!person.positionLocked})});groupDrag={primary:id,starts}}else groupDrag=null;
  },true);

  svg.addEventListener('pointermove',()=>{
    if(!groupDrag||typeof drag==='undefined'||!drag?.p||drag.p.id!==groupDrag.primary)return;
    const primaryStart=groupDrag.starts.get(groupDrag.primary);if(!primaryStart)return;const dx=drag.p.x-primaryStart.x,dy=drag.p.y-primaryStart.y;
    groupDrag.starts.forEach((start,id)=>{if(id===groupDrag.primary||start.locked)return;const p=findPerson(id);if(!p)return;p.x=clampX(start.x+dx);p.y=clampY(start.y+dy);const node=nodeLayer.querySelector(`[data-id="${id}"]`);if(node)node.setAttribute('transform',`translate(${p.x} ${p.y})`)});renderRelations();decorateNodes();
  });
  const endGroupDrag=()=>{groupDrag=null};svg.addEventListener('pointerup',endGroupDrag);svg.addEventListener('pointercancel',endGroupDrag);svg.addEventListener('lostpointercapture',endGroupDrag);

  const arrangeWrap=document.createElement('span');arrangeWrap.className='editor-tool-wrap';arrangeWrap.innerHTML=`<button type="button" class="button soft" id="autoArrangeBtn">⇄ 자동 정리</button><div class="editor-tool-popover" id="arrangePopover"><button type="button" data-arrange="all">전체 자동 정렬</button><button type="button" data-arrange="selected">선택한 구성원만 정렬</button></div>`;toolActions.insertBefore(arrangeWrap,relationButton||toolActions.firstChild);
  const arrangeButton=arrangeWrap.querySelector('#autoArrangeBtn'),arrangePopover=arrangeWrap.querySelector('#arrangePopover'),selectionArrangeButton=arrangePopover.querySelector('[data-arrange="selected"]');
  function roleRow(p){if(['조부','조모'].includes(p.role))return 110;if(['부','모'].includes(p.role))return 240;if(p.role==='자녀')return 650;if(['대상자','형제·자매','배우자'].includes(p.role))return 500;return 390}
  function distributeRow(items,y,minX=140,maxX=1060){const movable=items.filter(p=>!p.positionLocked).sort((a,b)=>a.x-b.x);if(!movable.length)return;if(movable.length===1){movable[0].y=y;return}const step=(maxX-minX)/(movable.length-1);movable.forEach((p,i)=>{p.x=minX+step*i;p.y=y})}
  function fullArrange(){if(!state.people.length){toast('정렬할 구성원이 없습니다');return}const rows=new Map();state.people.forEach(p=>{const y=roleRow(p);if(!rows.has(y))rows.set(y,[]);rows.get(y).push(p)});[...rows.entries()].forEach(([y,items])=>distributeRow(items,Number(y)));save();render();toast('가계도 전체를 정리했습니다')}
  function selectedArrange(){const people=[...selectedIds].map(findPerson).filter(p=>p&&!p.positionLocked);if(people.length<2){toast('Ctrl 또는 Shift로 구성원을 2명 이상 선택해주세요');return}const y=Math.round(people.reduce((s,p)=>s+p.y,0)/people.length);distributeRow(people,y,Math.min(...people.map(p=>p.x)),Math.max(...people.map(p=>p.x)));save();render();toast('선택한 구성원을 동일 간격으로 정렬했습니다')}
  arrangeButton.addEventListener('click',e=>{e.stopPropagation();arrangePopover.classList.toggle('show');updateSelectionStatus()});arrangePopover.addEventListener('click',e=>{const type=e.target.closest('[data-arrange]')?.dataset.arrange;if(!type)return;arrangePopover.classList.remove('show');type==='all'?fullArrange():selectedArrange()});document.addEventListener('pointerdown',e=>{if(!arrangeWrap.contains(e.target))arrangePopover.classList.remove('show')});

  const auditButton=document.createElement('button');auditButton.type='button';auditButton.className='button soft';auditButton.id='auditBtn';auditButton.textContent='✓ 관계 점검';toolActions.insertBefore(auditButton,relationButton||toolActions.firstChild);

  // Keep existing context menu hooks if present.
  const contextMenu=document.querySelector('.editor-context-menu');let lockMenuButton=null,duplicateMenuButton=null;
  if(contextMenu){const sep=document.createElement('div');sep.className='editor-context-sep advanced-node-context';lockMenuButton=document.createElement('button');lockMenuButton.type='button';lockMenuButton.className='editor-context-item advanced-node-context';lockMenuButton.dataset.advancedAction='lock';duplicateMenuButton=document.createElement('button');duplicateMenuButton.type='button';duplicateMenuButton.className='editor-context-item advanced-node-context';duplicateMenuButton.dataset.advancedAction='duplicate';duplicateMenuButton.innerHTML='<span>⧉ 복제</span><span class="editor-context-shortcut">Ctrl+D</span>';contextMenu.append(sep,lockMenuButton,duplicateMenuButton)}
  canvasWrap.addEventListener('contextmenu',e=>{const node=e.target.closest?.('.node');contextNodeId=node?.dataset.id||null;if(!lockMenuButton||!duplicateMenuButton)return;const show=!!contextNodeId;contextMenu.querySelectorAll('.advanced-node-context').forEach(el=>el.style.display=show?'':'none');if(show){const p=findPerson(contextNodeId);lockMenuButton.innerHTML=p?.positionLocked?'<span>🔓 위치 잠금 해제</span><span></span>':'<span>🔒 위치 잠금</span><span></span>'}},true);
  function toggleLock(id){const p=findPerson(id);if(!p)return;p.positionLocked=!p.positionLocked;save();render();toast(p.positionLocked?'위치를 잠갔습니다':'위치 잠금을 해제했습니다')}
  contextMenu?.addEventListener('click',e=>{const action=e.target.closest('[data-advanced-action]')?.dataset.advancedAction;if(!action||!contextNodeId)return;e.stopPropagation();if(action==='lock')toggleLock(contextNodeId);if(action==='duplicate')duplicateIds(selectedIds.has(contextNodeId)?[...selectedIds]:[contextNodeId]);contextMenu.classList.remove('show')},true);

  function makeClipboard(ids){const set=new Set(ids.filter(id=>findPerson(id)));if(!set.size)return null;return{people:state.people.filter(p=>set.has(p.id)).map(clone),relations:state.relations.filter(r=>set.has(r.from)&&set.has(r.to)).map(clone)}}
  function pasteClipboard(source=clipboard){if(!source?.people?.length)return;pasteOffset+=26;const idMap=new Map(),newPeople=source.people.map(p=>{const copy=clone(p),old=copy.id;copy.id=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;copy.x=clampX((copy.x||300)+pasteOffset);copy.y=clampY((copy.y||300)+pasteOffset);copy.positionLocked=false;idMap.set(old,copy.id);return copy});const newRelations=(source.relations||[]).map(r=>({...clone(r),id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,from:idMap.get(r.from),to:idMap.get(r.to)})).filter(r=>r.from&&r.to);state.people.push(...newPeople);state.relations.push(...newRelations);selectedIds.clear();newPeople.forEach(p=>selectedIds.add(p.id));save();render();toast(`${newPeople.length}명의 구성원을 복제했습니다`)}
  function duplicateIds(ids){const source=makeClipboard(ids);if(!source)return;pasteClipboard(source)}
  document.addEventListener('keydown',e=>{const editable=e.target.matches?.('input,textarea,select,[contenteditable="true"]');if(editable)return;const mod=e.ctrlKey||e.metaKey;if(!mod)return;const key=e.key.toLowerCase();if(key==='c'&&selectedIds.size){e.preventDefault();clipboard=makeClipboard([...selectedIds]);pasteOffset=0;toast(`${selectedIds.size}명의 구성원과 내부 관계선을 복사했습니다`)}else if(key==='v'){e.preventDefault();pasteClipboard()}else if(key==='d'){e.preventDefault();const ids=selectedIds.size?[...selectedIds]:(contextNodeId?[contextNodeId]:[]);duplicateIds(ids)}});
})();
