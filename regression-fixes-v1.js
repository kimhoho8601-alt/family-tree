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

    @media(max-width:560px){
      #personDialog form{padding:22px 18px}
      #personDialog .form-grid{gap:15px}
      #personDialog .gender-choice{gap:6px}
      #personDialog .gender-choice span{min-height:42px;padding:9px 4px;font-size:12px;border-radius:9px}
    }
    @media(min-width:561px) and (max-width:900px){
      #personDialog .gender-choice span{min-height:46px}
    }
  `;
  document.head.append(style);

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
