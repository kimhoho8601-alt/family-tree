(() => {
  if (typeof state === 'undefined' || typeof render !== 'function') return;

  const form = document.querySelector('#quickForm');
  const PARTNER_TYPES = new Set(['marriage','separated','divorced','distant','close','conflict']);
  const PARENT_ROLES = new Set(['부','모']);
  const CHILD_ROLES = new Set(['대상자','자녀']);
  const byId = id => state.people.find(p => p.id === id);
  const pairKey = (a,b) => [a,b].sort().join('|');

  // 핵심 원인 수정:
  // advanced-quick.js는 새로 추가한 부/모 카드의 부모대상을 기본 '등록된 모든 아동'으로 넣는다.
  // 그래서 모2/부2도 혈연 부모로 들어가던 문제를 여기서 입력 단계부터 막는다.
  function ensureNoChildOption(select) {
    if (!select) return;
    if (![...select.options].some(o => o.value === '')) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '아동 부모로 연결 안 함 · 새부모/배우자';
      select.insertBefore(opt, select.firstChild);
    }
  }

  function normalizeParentTargetCards() {
    if (!form) return;
    ['father','mother'].forEach(kind => {
      const cards = [...form.querySelectorAll(`#aqParents .aq-parent[data-kind="${kind}"]`)];
      cards.forEach((card,index) => {
        const select = card.querySelector('.aq-parent-target');
        if (!select) return;
        ensureNoChildOption(select);

        if (!card.dataset.parentTargetInitialized) {
          card.dataset.parentTargetInitialized = 'true';
          // 첫 번째 부/모만 기본 혈연부모. 두 번째 이후는 새부모 가능성이 높으므로 미연결.
          select.value = index === 0 ? 'all' : '';
        } else if (index > 0 && card.dataset.parentTargetTouched !== 'true') {
          // advanced-quick의 refresh가 빈 값을 다시 all로 돌려도 즉시 복구.
          select.value = '';
        }
      });
    });
  }

  if (form) {
    form.addEventListener('change', e => {
      if (!e.target.matches('.aq-parent-target')) return;
      const card = e.target.closest('.aq-parent');
      if (card) card.dataset.parentTargetTouched = 'true';
    }, true);

    form.addEventListener('click', e => {
      if (e.target.closest('#aqAddFather,#aqAddMother,#aqAddChild,[data-rm]')) {
        setTimeout(normalizeParentTargetCards, 0);
      }
    }, true);

    form.addEventListener('input', e => {
      if (e.target.matches('.aq-name')) setTimeout(normalizeParentTargetCards, 0);
    }, true);

    const obs = new MutationObserver(() => setTimeout(normalizeParentTargetCards, 0));
    obs.observe(form,{childList:true,subtree:true});
    normalizeParentTargetCards();
  }

  function scorePrimaryParent(p) {
    if (!p) return -999;
    let score = 0;
    const name = String(p.name || '').trim();
    if (name === p.role) score += 100;
    if (!/\d/.test(name)) score += 20;
    if (!/[2-9２-９]/.test(name)) score += 10;
    return score;
  }

  function removeAccidentalStepParentLinks() {
    let changed = false;
    const children = state.people.filter(p => CHILD_ROLES.has(p.role));
    children.forEach(child => {
      const links = state.relations.filter(r => r.type === 'parent' && r.to === child.id);
      ['부','모'].forEach(role => {
        const sameRole = links.map(r => ({r,p:byId(r.from)})).filter(x => x.p?.role === role);
        if (sameRole.length <= 1) return;
        sameRole.sort((a,b) => scorePrimaryParent(b.p) - scorePrimaryParent(a.p));
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

    let changed = false;
    const setPos = (p,x,y=225) => {
      if (!p) return;
      if (Math.abs(p.x-x)>.5 || Math.abs(p.y-y)>.5) changed = true;
      p.x=x; p.y=y;
    };

    // 화면 규칙을 명시적으로 고정한다.
    // 새엄마가 부와 관계: 새엄마 - 부 - 친모
    // 새아빠가 모와 관계: 친부 - 모 - 새아빠
    if (fatherSteps.length) {
      setPos(father,600);
      setPos(mother,850);
      fatherSteps.forEach((p,i)=>setPos(p,350-i*210));
    } else {
      setPos(mother,600);
      setPos(father,350);
      motherSteps.forEach((p,i)=>setPos(p,850+i*210));
    }

    const bioKey = pairKey(father.id,mother.id);
    const sameChildren = children.filter(ch => {
      const ids = state.relations.filter(r => r.type==='parent' && r.to===ch.id).map(r=>r.from);
      return ids.length===2 && pairKey(ids[0],ids[1])===bioKey;
    });
    const center=(father.x+mother.x)/2;
    const gap=sameChildren.length>2?120:145;
    sameChildren.forEach((ch,i)=>setPos(ch,center+(i-(sameChildren.length-1)/2)*gap,510));
    return changed;
  }

  function runNormalization() {
    const cleaned=removeAccidentalStepParentLinks();
    const laidOut=normalizeRemarriageLayout();
    if ((cleaned||laidOut) && typeof save==='function') save();
    return cleaned||laidOut;
  }

  const previousRender = render;
  let inside=false;
  render = function() {
    if (!inside) {
      inside=true;
      try { runNormalization(); } finally { inside=false; }
    }
    return previousRender();
  };

  // 직접 편집 시 배우자를 자동 parent로 승격하는 fixes.js 동작도 차단.
  if (typeof addConnection === 'function') {
    const previousAddConnection=addConnection;
    addConnection=function(from,to,type){
      if(type!=='parent') return previousAddConnection(from,to,type);
      const a=byId(from),b=byId(to);
      if(a&&CHILD_ROLES.has(a.role)&&b&&!CHILD_ROLES.has(b.role))[from,to]=[to,from];
      if(state.relations.some(r=>r.type==='parent'&&r.from===from&&r.to===to)){
        toast('이미 등록된 부모–자녀 연결입니다');return false;
      }
      state.relations.push({id:id(),from,to,type:'parent'});
      save();render();toast('부모–자녀 연결을 추가했습니다');return true;
    };
  }

  runNormalization();
  previousRender();
})();