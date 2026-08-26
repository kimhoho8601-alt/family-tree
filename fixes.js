(() => {
  const PARTNERSHIP_TYPES = new Set(['marriage', 'separated', 'divorced', 'distant']);
  const CHILD_ROLES = new Set(['대상자', '자녀']);
  const findPerson = pid => state.people.find(p => p.id === pid);

  function isLikelyParentCouple(a, b) {
    if (!a || !b) return false;
    return (a.role === '부' && b.role === '모') || (a.role === '모' && b.role === '부');
  }

  function isLikelyCouple(a, b) {
    if (!a || !b) return false;
    if (isLikelyParentCouple(a, b)) return true;
    if (a.role === '배우자' || b.role === '배우자') return true;
    return false;
  }

  function alignCouple(a, b, anchorId = null) {
    if (!isLikelyCouple(a, b)) return false;
    const y = anchorId === a.id ? a.y : anchorId === b.id ? b.y : Math.round((a.y + b.y) / 2);
    let changed = false;
    if (a.y !== y) { a.y = y; changed = true; }
    if (b.y !== y) { b.y = y; changed = true; }
    return changed;
  }

  function partnerRelationsFor(pid) {
    return state.relations.filter(r => {
      if (!PARTNERSHIP_TYPES.has(r.type)) return false;
      if (r.from !== pid && r.to !== pid) return false;
      const a = findPerson(r.from), b = findPerson(r.to);
      return isLikelyCouple(a, b);
    });
  }

  function alignPartnersOf(pid) {
    const person = findPerson(pid);
    if (!person) return false;
    let changed = false;
    partnerRelationsFor(pid).forEach(r => {
      const partner = findPerson(r.from === pid ? r.to : r.from);
      if (partner) changed = alignCouple(person, partner, pid) || changed;
    });
    return changed;
  }

  function findOppositeParentPartner(parentId) {
    const parent = findPerson(parentId);
    if (!parent || !['부', '모'].includes(parent.role)) return null;
    const relation = state.relations.find(r => {
      if (!PARTNERSHIP_TYPES.has(r.type)) return false;
      if (r.from !== parentId && r.to !== parentId) return false;
      const partner = findPerson(r.from === parentId ? r.to : r.from);
      return isLikelyParentCouple(parent, partner);
    });
    return relation ? (relation.from === parentId ? relation.to : relation.from) : null;
  }

  function completeParentPair(parentId, childId) {
    const parent = findPerson(parentId), child = findPerson(childId);
    if (!parent || !child || !CHILD_ROLES.has(child.role)) return false;
    const partnerId = findOppositeParentPartner(parentId);
    if (!partnerId) return false;
    if (state.relations.some(r => r.type === 'parent' && r.from === partnerId && r.to === childId)) return false;
    state.relations.push({ id: id(), from: partnerId, to: childId, type: 'parent' });
    return true;
  }

  function normalizeParentDirection(from, to) {
    const a = findPerson(from), b = findPerson(to);
    if (!a || !b) return { from, to };
    if (CHILD_ROLES.has(a.role) && !CHILD_ROLES.has(b.role)) return { from: to, to: from };
    return { from, to };
  }

  shapeMarkup = function (p) {
    const outer = p.role === '대상자'
      ? p.gender === 'female'
        ? '<circle class="outer" r="35" style="stroke:#33272a"/>'
        : '<rect class="outer" x="-35" y="-35" width="70" height="70" style="stroke:#33272a"/>'
      : '';
    const shape = p.gender === 'female'
      ? '<circle class="shape" r="29"/>'
      : p.gender === 'unknown'
        ? '<rect class="shape" x="-22" y="-22" width="44" height="44" transform="rotate(45)"/>'
        : '<rect class="shape" x="-29" y="-29" width="58" height="58"/>';
    return `${outer}${shape}<path class="death" d="M-23-23L23 23M23-23L-23 23"/>`;
  };

  addConnection = function (from, to, type) {
    if (type === 'parent') {
      ({ from, to } = normalizeParentDirection(from, to));
      if (state.relations.some(r => r.type === 'parent' && r.from === from && r.to === to)) {
        toast('이미 등록된 부모–자녀 연결입니다');
        return false;
      }
      state.relations.push({ id: id(), from, to, type });
      completeParentPair(from, to);
      save();
      render();
      toast('부모–자녀 연결을 정렬했습니다');
      return true;
    }

    const pair = r => (r.from === from && r.to === to) || (r.from === to && r.to === from);
    if (['marriage', 'separated', 'divorced'].includes(type)) {
      state.relations = state.relations.filter(r => !(pair(r) && ['marriage', 'separated', 'divorced'].includes(r.type)));
    }
    const a = findPerson(from), b = findPerson(to);
    if (PARTNERSHIP_TYPES.has(type) && isLikelyCouple(a, b)) alignCouple(a, b);
    state.relations.push({ id: id(), from, to, type });
    save();
    render();
    toast('연결선을 추가했습니다');
    return true;
  };

  connectUnionToChild = function (parentIds, childId) {
    const parents = parentIds.map(findPerson).filter(Boolean);
    if (parents.length === 2 && isLikelyCouple(parents[0], parents[1])) alignCouple(parents[0], parents[1]);
    parentIds.forEach(parentId => {
      if (!state.relations.some(r => r.type === 'parent' && r.from === parentId && r.to === childId)) {
        state.relations.push({ id: id(), from: parentId, to: childId, type: 'parent' });
      }
    });
    save();
    render();
    stopConnection();
    toast('부모 관계선 중앙에 자녀를 연결했습니다');
  };

  function householdMarkup() {
    const members = state.people.filter(p => p.cohabit === 'yes');
    if (!members.length) return '';
    const padX = 52, padTop = 50, padBottom = 92;
    const x1 = Math.max(8, Math.min(...members.map(p => p.x)) - padX);
    const y1 = Math.max(8, Math.min(...members.map(p => p.y)) - padTop);
    const x2 = Math.min(1192, Math.max(...members.map(p => p.x)) + padX);
    const y2 = Math.min(712, Math.max(...members.map(p => p.y)) + padBottom);
    const labelY = Math.max(22, y1 - 7);
    return `<g class="cohabit-boundary" pointer-events="none"><rect x="${x1}" y="${y1}" width="${Math.max(44, x2 - x1)}" height="${Math.max(70, y2 - y1)}" rx="18" fill="none" stroke="#c9002b" stroke-width="3"/><text x="${x1 + 12}" y="${labelY}" fill="#c9002b" font-family="IBM Plex Sans KR, sans-serif" font-size="12" font-weight="700">동거가족</text></g>`;
  }

  renderRelations = function () {
    const find = findPerson;
    const parentLinks = state.relations.filter(r => r.type === 'parent');
    const partnershipTypes = ['marriage', 'separated', 'divorced', 'distant'];
    const groups = new Map(), handled = new Set();
    const strokeFor = t => t === 'conflict' || t === 'separated' || t === 'divorced' ? '#c9002b' : '#493d40';

    parentLinks.forEach(link => {
      const parents = parentLinks.filter(r => r.to === link.to).map(r => r.from).sort();
      const key = parents.join('|');
      if (!groups.has(key)) groups.set(key, { parentIds: parents, childIds: [] });
      const group = groups.get(key);
      if (!group.childIds.includes(link.to)) group.childIds.push(link.to);
    });

    let markup = householdMarkup();

    groups.forEach(group => {
      const parents = group.parentIds.map(find).filter(Boolean).sort((a, b) => a.x - b.x);
      const children = group.childIds.map(find).filter(Boolean).sort((a, b) => a.x - b.x);
      if (!parents.length || !children.length) return;

      const links = parentLinks.filter(r => group.childIds.includes(r.to) && group.parentIds.includes(r.from));
      const childMin = Math.min(...children.map(c => c.y));
      const sibY = Math.max(Math.max(...parents.map(p => p.y)) + 80, childMin - 100);
      let midX = parents[0].x, midY = parents[0].y;

      if (parents.length > 1) {
        const left = parents[0], right = parents[parents.length - 1];
        midX = (left.x + right.x) / 2;
        midY = (left.y + right.y) / 2;
        const couple = state.relations.find(r => partnershipTypes.includes(r.type) && group.parentIds.includes(r.from) && group.parentIds.includes(r.to));
        const type = couple?.type || 'marriage';
        if (couple) handled.add(couple.id);
        let marks = '';
        if (type === 'separated' || type === 'divorced') {
          marks = `<path d="M${midX - 7} ${midY - 13}l14 26${type === 'divorced' ? `M${midX + 3} ${midY - 13}l14 26` : ''}" fill="none" stroke="#c9002b" stroke-width="3"/>`;
        }
        markup += `<g class="relation-group" ${couple ? `data-relation="${couple.id}"` : ''}><path d="M${left.x} ${left.y} L${right.x} ${right.y}" class="relation ${type}" fill="none" stroke="${strokeFor(type)}" stroke-width="3" ${type === 'distant' ? 'stroke-dasharray="8 7"' : ''}/>${marks}<path class="relation-hit" d="M${left.x} ${left.y} L${right.x} ${right.y}" fill="none" stroke="transparent" stroke-width="18"/></g>`;
      }

      const branchXs = [midX, ...children.map(c => c.x)];
      const minX = Math.min(...branchXs), maxX = Math.max(...branchXs);
      let d = `M${midX} ${midY} V${sibY}`;
      if (maxX - minX > 0.5) d += ` M${minX} ${sibY} H${maxX}`;
      children.forEach(c => { d += ` M${c.x} ${sibY} V${c.y}`; });
      markup += `<g class="relation-group parent-group" data-relations="${links.map(r => r.id).join(',')}"><path class="relation parent" d="${d}" fill="none" stroke="#493d40" stroke-width="3"/><path class="relation-hit" d="${d}" fill="none" stroke="transparent" stroke-width="18"/></g>`;
    });

    markup += state.relations.filter(r => r.type !== 'parent' && !handled.has(r.id)).map(r => {
      const a = find(r.from), b = find(r.to);
      if (!a || !b) return '';
      let extra = '';
      if (r.type === 'separated' || r.type === 'divorced') {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        extra = `<path d="M${mx - 7} ${my - 12}l14 24${r.type === 'divorced' ? `M${mx + 2} ${my - 12}l14 24` : ''}" fill="none" stroke="#c9002b" stroke-width="3"/>`;
      }
      const d = r.type === 'conflict' ? zigzag(a, b) : `M${a.x} ${a.y} L${b.x} ${b.y}`;
      const dash = r.type === 'distant' ? 'stroke-dasharray="8 7"' : '';
      return `<g data-relation="${r.id}" class="relation-group"><path class="relation ${r.type}" d="${d}" fill="none" stroke="${strokeFor(r.type)}" stroke-width="${r.type === 'close' ? 6 : 3}" ${dash}/>${extra}<path class="relation-hit" d="${d}" fill="none" stroke="transparent" stroke-width="18"/></g>`;
    }).join('');

    els.relations.innerHTML = markup;
    els.relations.querySelectorAll('.relation-group').forEach(g => {
      g.onclick = e => {
        if (!connectMode.delete) return;
        e.stopPropagation();
        const ids = g.dataset.relations?.split(',').filter(Boolean) || [g.dataset.relation].filter(Boolean);
        if (!ids.length) return;
        state.relations = state.relations.filter(r => !ids.includes(r.id));
        save();
        render();
        stopConnection();
        toast('선택한 연결선을 삭제했습니다');
      };
    });
  };

  function repairExistingParentLinks() {
    let changed = false;
    const links = state.relations.filter(r => r.type === 'parent');
    links.forEach(r => { changed = completeParentPair(r.from, r.to) || changed; });
    return changed;
  }

  function alignExistingCouples() {
    let changed = false;
    state.relations.forEach(r => {
      if (!PARTNERSHIP_TYPES.has(r.type)) return;
      const a = findPerson(r.from), b = findPerson(r.to);
      if (isLikelyCouple(a, b)) changed = alignCouple(a, b) || changed;
    });
    return changed;
  }

  const style = document.createElement('style');
  style.textContent = `
    .node.proband .outer{stroke:#33272a!important}
    .cohabit-key{width:18px!important;height:13px!important;border:2px solid var(--red)!important;border-radius:4px!important}
  `;
  document.head.append(style);

  const legend = document.querySelector('.legend');
  if (legend && !legend.querySelector('.cohabit-legend-item')) {
    const item = document.createElement('span');
    item.className = 'cohabit-legend-item';
    item.innerHTML = '<i class="cohabit-key"></i>동거가족';
    legend.append(item);
  }

  let activeDragId = null;
  els.nodes.addEventListener('pointerdown', e => {
    const node = e.target.closest('.node');
    if (node && !connectMode.active) activeDragId = node.dataset.id;
  }, true);
  els.svg.addEventListener('pointerup', () => {
    if (!activeDragId) return;
    if (alignPartnersOf(activeDragId)) {
      save();
      render();
    }
    activeDragId = null;
  });

  const repaired = repairExistingParentLinks();
  const aligned = alignExistingCouples();
  if (repaired || aligned) save();
  render();
})();
