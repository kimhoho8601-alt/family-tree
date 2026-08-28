(() => {
  if (typeof state === 'undefined' || typeof render !== 'function') return;

  const PARTNER_TYPES = new Set(['marriage','separated','divorced','distant','close','conflict']);
  const PARENT_ROLES = new Set(['부','모']);
  const CHILD_ROLES = new Set(['대상자','자녀']);
  const byId = id => state.people.find(p => p.id === id);
  const pairKey = (a,b) => [a,b].sort().join('|');

  function scorePrimaryParent(p) {
    if (!p) return -999;
    let score = 0;
    const name = String(p.name || '').trim();
    if (name === p.role) score += 100;
    if (!/\d/.test(name)) score += 20;
    if (!/[2-9２-９]/.test(name)) score += 10;
    return score;
  }

  // 과거 로직이 배우자/새부모를 아동의 parent 선에 자동 편입한 경우 정리한다.
  // 한 아동에 동일 역할(부 또는 모)이 둘 이상이면 기본 부모(부/모)를 우선 유지한다.
  function removeAccidentalStepParentLinks() {
    let changed = false;
    const children = state.people.filter(p => CHILD_ROLES.has(p.role));

    children.forEach(child => {
      const links = state.relations.filter(r => r.type === 'parent' && r.to === child.id);
      ['부','모'].forEach(role => {
        const sameRole = links
          .map(r => ({r, p: byId(r.from)}))
          .filter(x => x.p?.role === role);
        if (sameRole.length <= 1) return;

        sameRole.sort((a,b) => scorePrimaryParent(b.p) - scorePrimaryParent(a.p));
        const keep = sameRole[0].r.id;
        const removeIds = new Set(sameRole.slice(1).map(x => x.r.id));
        state.relations = state.relations.filter(r => !removeIds.has(r.id));
        changed = true;
      });
    });
    return changed;
  }

  function adultPartners(pid) {
    return state.relations
      .filter(r => r.type !== 'parent' && r.relationRole !== 'parent-child-emotional' && PARTNER_TYPES.has(r.type) && (r.from === pid || r.to === pid))
      .map(r => byId(r.from === pid ? r.to : r.from))
      .filter(p => p && PARENT_ROLES.has(p.role));
  }

  function normalizeRemarriageLayout() {
    const children = state.people.filter(p => CHILD_ROLES.has(p.role));
    const mainChild = children.find(p => p.clientMain) || children.find(p => p.role === '대상자') || children[0];
    if (!mainChild) return false;

    const parentLinks = state.relations.filter(r => r.type === 'parent' && r.to === mainChild.id);
    const biological = parentLinks.map(r => byId(r.from)).filter(p => p && PARENT_ROLES.has(p.role));
    const father = biological.find(p => p.role === '부');
    const mother = biological.find(p => p.role === '모');
    if (!father || !mother) return false;

    const fatherSteps = adultPartners(father.id).filter(p => p.id !== mother.id && !biological.some(b => b.id === p.id));
    const motherSteps = adultPartners(mother.id).filter(p => p.id !== father.id && !biological.some(b => b.id === p.id));
    if (!fatherSteps.length && !motherSteps.length) return false;

    const y = 225;
    let changed = false;
    const setPos = (p,x,py=y) => {
      if (!p) return;
      if (Math.abs(p.x-x) > .5 || Math.abs(p.y-py) > .5) changed = true;
      p.x=x; p.y=py;
    };

    // 새엄마가 있는 경우: 새엄마 - 부 - 친모
    // 새아빠가 있는 경우: 친부 - 모 - 새아빠
    if (fatherSteps.length) {
      setPos(father, 600);
      setPos(mother, 850);
      fatherSteps.forEach((p,i) => setPos(p, Math.max(120, 350 - i*210)));
    } else {
      setPos(mother, 600);
      setPos(father, 350);
      motherSteps.forEach((p,i) => setPos(p, Math.min(1080, 850 + i*210)));
    }

    // 메인 아동과 같은 혈연 부모쌍을 가진 아동은 친부·친모의 중앙 아래에 둔다.
    const bioKey = pairKey(father.id,mother.id);
    const sameChildren = children.filter(ch => {
      const ids = state.relations.filter(r => r.type === 'parent' && r.to === ch.id).map(r => r.from);
      return ids.length === 2 && pairKey(ids[0],ids[1]) === bioKey;
    });
    const center = (father.x + mother.x) / 2;
    const gap = sameChildren.length > 2 ? 120 : 145;
    sameChildren.forEach((ch,i) => setPos(ch, center + (i-(sameChildren.length-1)/2)*gap, 510));

    return changed;
  }

  function signature() {
    return state.people.map(p => `${p.id}:${p.role}:${p.name}`).sort().join(';') + '|' +
      state.relations.map(r => `${r.id}:${r.from}:${r.to}:${r.type}:${r.relationRole||''}`).sort().join(';');
  }

  let lastSignature = '';
  const previousRender = render;
  render = function() {
    const sig = signature();
    if (sig !== lastSignature) {
      const cleaned = removeAccidentalStepParentLinks();
      const laidOut = normalizeRemarriageLayout();
      lastSignature = signature();
      if ((cleaned || laidOut) && typeof save === 'function') save();
    }
    return previousRender();
  };

  // 세부 편집에서 부모→자녀를 직접 연결할 때 배우자를 자동으로 부모에 추가하지 않는다.
  if (typeof addConnection === 'function') {
    const previousAddConnection = addConnection;
    addConnection = function(from,to,type) {
      if (type !== 'parent') return previousAddConnection(from,to,type);
      const a = byId(from), b = byId(to);
      if (a && CHILD_ROLES.has(a.role) && b && !CHILD_ROLES.has(b.role)) [from,to] = [to,from];
      if (state.relations.some(r => r.type === 'parent' && r.from === from && r.to === to)) {
        toast('이미 등록된 부모–자녀 연결입니다');
        return false;
      }
      state.relations.push({id:id(),from,to,type:'parent'});
      save(); render(); toast('부모–자녀 연결을 추가했습니다');
      return true;
    };
  }

  // 이미 저장된 잘못된 3부모 구조도 페이지를 열자마자 정리한다.
  const cleaned = removeAccidentalStepParentLinks();
  const laidOut = normalizeRemarriageLayout();
  lastSignature = signature();
  if (cleaned || laidOut) save();
  previousRender();
})();