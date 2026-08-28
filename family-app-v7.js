(() => {
  const form = document.querySelector('#quickForm');
  if (!form || typeof state === 'undefined') return;

  const q = (s, root = document) => root.querySelector(s);
  const qa = (s, root = document) => [...root.querySelectorAll(s)];
  const uid = prefix => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const personById = (people, pid) => people.find(p => p.id === pid);
  const pairKey = (a, b) => [a, b].sort().join('|');

  const css = document.createElement('style');
  css.textContent = `
    .aq-section{padding:16px 0;border-bottom:1px solid var(--line)}
    .aq-section.focus{margin:0 -4px;padding:16px 14px;background:#fff8fa;border:1px solid #f1d4da;border-radius:14px}
    .aq-head{display:flex;gap:10px;align-items:flex-start;margin-bottom:11px}.aq-step{width:25px;height:25px;flex:0 0 25px;display:grid;place-items:center;border-radius:50%;background:var(--red);color:#fff;font:800 11px Manrope}
    .aq-copy{min-width:0;flex:1}.aq-copy strong,.aq-copy small{display:block}.aq-copy strong{font-size:14px}.aq-copy small{font-size:10px;color:var(--muted);line-height:1.45;margin-top:2px;word-break:keep-all}
    .aq-actions{display:flex;gap:5px;flex-wrap:wrap}.aq-add{height:30px;padding:0 9px;border:1px dashed #dca4b0;border-radius:8px;background:#fff;color:var(--red);font:700 10px inherit;cursor:pointer;white-space:nowrap}
    .aq-list{display:flex;flex-direction:column;gap:8px}.aq-card{padding:10px;border:1px solid var(--line);border-radius:10px;background:#fff}.aq-card.primary{border-color:#eab7c2}
    .aq-top{display:flex;align-items:center;gap:7px;margin-bottom:8px}.aq-top b{font-size:11px}.aq-badge{font-size:9px;font-weight:700;color:var(--red);background:var(--red-soft);padding:3px 6px;border-radius:999px}
    .aq-rm{margin-left:auto;width:25px;height:25px;border:0;border-radius:6px;background:#f4edef;color:#a30b2c;cursor:pointer}
    .aq-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.aq-grid.three{grid-template-columns:repeat(3,1fr)}
    .aq-field>span{display:block;font-size:9px;font-weight:700;color:#665b5e;margin-bottom:4px;white-space:normal;word-break:keep-all}
    .aq-field input,.aq-field select{width:100%;height:35px;padding:0 8px;border:1px solid var(--line);border-radius:7px;background:#fff;font:11px inherit}
    .aq-gender{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:7px}.aq-gender input{position:absolute;opacity:0}.aq-gender span{display:block;padding:7px 2px;text-align:center;border:1px solid var(--line);border-radius:7px;font-size:10px}.aq-gender input:checked+span{border-color:var(--red);background:var(--red-soft);color:var(--red);font-weight:700}
    .aq-check{display:flex;align-items:center;gap:6px;width:max-content;margin-top:7px;padding:5px 8px;border:1px solid var(--line);border-radius:7px;font-size:9px;color:#665b5e}.aq-check input{accent-color:var(--red)}
    .aq-box{margin-top:8px;padding:8px;border:1px solid #eee5e7;border-radius:8px;background:#faf8f8}.aq-box-title{font-size:9px;font-weight:700;color:#786d70;margin-bottom:6px}
    .aq-empty{padding:11px;border:1px dashed var(--line);border-radius:8px;text-align:center;color:var(--muted);font-size:10px}
    .aq-create{width:100%;height:50px;margin-top:16px;border:0;border-radius:12px;background:var(--red);color:#fff;font:700 14px inherit;cursor:pointer}
    .aq-note{text-align:center;color:#9b8d90;font-size:9px;margin:7px 0 0;word-break:keep-all}
    .aq-parent-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:9px;align-items:start}.aq-parent-col{min-width:0;padding:9px;background:#faf8f8;border:1px solid var(--line);border-radius:11px}
    .aq-parent-col-head{display:flex;align-items:center;gap:6px;margin-bottom:8px;padding-bottom:7px;border-bottom:1px solid var(--line)}.aq-parent-col-head strong{font-size:11px}.aq-parent-col-head .aq-add{margin-left:auto;height:28px;padding:0 7px}
    .aq-parent-col .aq-card{padding:9px}.aq-parent-col .aq-grid{grid-template-columns:1fr}.aq-parent-col .aq-box{padding:7px}.aq-parent-col .aq-top b{font-size:10px}.aq-parent-col .aq-badge{padding:2px 5px}.aq-parent-col .aq-rm{width:23px;height:23px}.aq-parent-col .aq-list{gap:7px}
    .aq-help{margin:6px 0 0;color:#8b7e81;font-size:8px;line-height:1.45;word-break:keep-all}.aq-reset-input{margin-top:8px;width:100%;height:38px;border:1px solid var(--line);border-radius:9px;background:#fff;color:#665b5e;font:700 10px inherit;cursor:pointer}
    .aq-relation-note{margin:7px 0 0;color:#8b7e81;font-size:8px;line-height:1.45;word-break:keep-all}
    @media(max-width:520px){.aq-grid,.aq-grid.three,.aq-parent-columns{grid-template-columns:1fr}.aq-parent-col{padding:8px}.aq-parent-col-head .aq-add{margin-left:auto}}
  `;
  document.head.append(css);

  function childRelationOptions() {
    return '<option value="none">기본 부모선만</option><option value="close">친밀·지지</option><option value="distant">소원·불명확</option><option value="conflict">갈등·적대</option>';
  }

  function adultRelationOptions() {
    return '<option value="marriage">실선 · 부부/동반자</option><option value="separated">별거</option><option value="divorced">이혼</option><option value="distant">점선 · 소원/불명확</option><option value="close">굵은선 · 친밀/지지</option><option value="conflict">지그재그 · 갈등/적대</option>';
  }

  function childCard(index = 0) {
    const u = uid('c');
    const el = document.createElement('div');
    el.className = `aq-card aq-child${index === 0 ? ' primary' : ''}`;
    el.dataset.uid = u;
    el.innerHTML = `<div class="aq-top"><span class="aq-badge">${index === 0 ? '주 대상아동' : '추가 클라이언트'}</span><b>${index === 0 ? '첫 번째 아동' : `추가 아동 ${index + 1}`}</b>${index === 0 ? '' : '<button type="button" class="aq-rm" data-rm>×</button>'}</div>
      <div class="aq-grid"><label class="aq-field"><span>식별명</span><input class="aq-name" value="${index === 0 ? '대상아동' : `아동${index + 1}`}"></label><label class="aq-field"><span>나이·출생연도</span><input class="aq-age" placeholder="예: 12세"></label></div>
      <div class="aq-gender"><label><input type="radio" name="g-${u}" value="male" checked><span>□ 남아</span></label><label><input type="radio" name="g-${u}" value="female"><span>○ 여아</span></label><label><input type="radio" name="g-${u}" value="unknown"><span>◇ 미상</span></label></div>
      <label class="aq-check"><input class="aq-co" type="checkbox" checked> 현재 동거가족</label>`;
    return el;
  }

  function parentCard(kind, index = 0) {
    const u = uid(kind);
    const father = kind === 'father';
    const el = document.createElement('div');
    el.className = 'aq-card aq-parent';
    el.dataset.uid = u;
    el.dataset.kind = kind;
    el.dataset.targetTouched = 'false';
    el.innerHTML = `<div class="aq-top"><span class="aq-badge">${father ? '부' : '모'}</span><b>${father ? '부' : '모'} ${index + 1}</b><button type="button" class="aq-rm" data-rm>×</button></div>
      <div class="aq-grid"><label class="aq-field"><span>식별명</span><input class="aq-name" value="${father ? '부' : '모'}${index ? index + 1 : ''}"></label><label class="aq-field"><span>나이·출생연도</span><input class="aq-age" placeholder="예: 40세"></label></div>
      <div class="aq-box"><div class="aq-box-title">아동과의 부모 관계</div><div class="aq-grid">
        <label class="aq-field"><span>부모인 아동</span><select class="aq-parent-target"></select></label>
        <label class="aq-field"><span>아동과 관계선</span><select class="aq-child-rel">${childRelationOptions()}</select></label>
        <label class="aq-field"><span>동거 여부</span><select class="aq-co-sel"><option value="yes">동거</option><option value="no">비동거</option><option value="unknown">미상</option></select></label>
      </div><p class="aq-help">새엄마·새아빠처럼 대상아동의 부모가 아니라면 ‘아동 부모로 연결 안 함’을 선택하세요.</p></div>`;
    return el;
  }

  function relationCard() {
    const el = document.createElement('div');
    el.className = 'aq-card aq-adultrel aq-generalrel';
    el.innerHTML = `<div class="aq-top"><span class="aq-badge">구성원 관계</span><b>관계선 지정</b><button type="button" class="aq-rm" data-rm>×</button></div>
      <div class="aq-grid"><label class="aq-field"><span>구성원 1</span><select class="aq-af"></select></label><label class="aq-field"><span>구성원 2</span><select class="aq-at"></select></label><label class="aq-field" style="grid-column:1/-1"><span>관계선</span><select class="aq-type">${adultRelationOptions()}</select></label></div>
      <p class="aq-relation-note">새부모 관계는 여기에서 기존 부모와 연결합니다. 이 관계만으로는 아동의 부모선에 포함되지 않습니다.</p>`;
    return el;
  }

  function extraCard(index = 0) {
    const u = uid('x');
    const el = document.createElement('div');
    el.className = 'aq-card aq-extra';
    el.dataset.uid = u;
    el.innerHTML = `<div class="aq-top"><span class="aq-badge">추가 가족</span><b>가족·보호자 ${index + 1}</b><button type="button" class="aq-rm" data-rm>×</button></div>
      <div class="aq-grid three"><label class="aq-field"><span>관계</span><select class="aq-role"><option>보호자·동거인</option><option>형제·자매</option><option>조부</option><option>조모</option><option>배우자</option><option>자녀</option><option>기타 친척</option></select></label><label class="aq-field"><span>식별명</span><input class="aq-name" placeholder="예: 외조모"></label><label class="aq-field"><span>나이</span><input class="aq-age"></label></div>
      <div class="aq-grid" style="margin-top:7px"><label class="aq-field"><span>성별</span><select class="aq-sex"><option value="unknown">미상</option><option value="male">남성</option><option value="female">여성</option></select></label><label class="aq-field"><span>동거 여부</span><select class="aq-co-sel"><option value="yes">동거</option><option value="no">비동거</option><option value="unknown" selected>미상</option></select></label></div>
      <div class="aq-box"><div class="aq-box-title">가계도 연결 기준과 선 형태</div><div class="aq-grid"><label class="aq-field"><span>연결 기준 인물</span><select class="aq-ref"></select></label><label class="aq-field"><span>연결 방식</span><select class="aq-link"><option value="parent-of-ref">부모선 · 내가 기준 인물의 부모</option><option value="child-of-ref">부모선 · 기준 인물이 나의 부모</option><option value="sibling-of-ref">형제·자매 · 기준 인물과 같은 부모</option><option value="marriage">실선 · 부부/동반자</option><option value="separated">별거</option><option value="divorced">이혼</option><option value="distant">점선</option><option value="close">굵은선 · 친밀/지지</option><option value="conflict">지그재그 · 갈등/적대</option><option value="none">연결선 없음</option></select></label></div></div>`;
    return el;
  }

  function buildQuickForm() {
    form.innerHTML = `<section class="aq-section focus"><div class="aq-head"><span class="aq-step">1</span><div class="aq-copy"><strong>아동 · 클라이언트</strong><small>한 가정에 대상아동이 여러 명이면 추가하세요.</small></div><div class="aq-actions"><button type="button" class="aq-add" id="aqAddChild">＋ 아동 추가</button></div></div><div id="aqChildren" class="aq-list"></div></section>
      <section class="aq-section"><div class="aq-head"><span class="aq-step">2</span><div class="aq-copy"><strong>부 · 모</strong><small>실제 부모인 아동만 지정합니다. 새부모는 부모 아동을 지정하지 않고 3번에서 관계만 연결하세요.</small></div></div><div id="aqParents" class="aq-parent-columns"><div class="aq-parent-col"><div class="aq-parent-col-head"><strong>부</strong><button type="button" class="aq-add" id="aqAddFather">＋ 부 추가</button></div><div id="aqFathers" class="aq-list"></div></div><div class="aq-parent-col"><div class="aq-parent-col-head"><strong>모</strong><button type="button" class="aq-add" id="aqAddMother">＋ 모 추가</button></div><div id="aqMothers" class="aq-list"></div></div></div></section>
      <section class="aq-section"><div class="aq-head"><span class="aq-step">3</span><div class="aq-copy"><strong>구성원간 관계 <small style="display:inline;color:var(--muted)">선택</small></strong><small>등록한 가족 전체에서 두 사람을 골라 부부·이혼·친밀·갈등 등의 관계를 지정합니다.</small></div><button type="button" class="aq-add" id="aqAddRel">＋ 관계 추가</button></div><div id="aqRels" class="aq-list"><div class="aq-empty">필요할 때 두 구성원을 선택해 관계를 추가하세요.</div></div></section>
      <section class="aq-section"><div class="aq-head"><span class="aq-step">4</span><div class="aq-copy"><strong>기타 가족 · 보호자</strong><small>조부모·형제자매·보호자 등을 추가할 수 있습니다.</small></div><button type="button" class="aq-add" id="aqAddExtra">＋ 가족 추가</button></div><div id="aqExtras" class="aq-list"><div class="aq-empty">추가 가족이 필요하면 등록하세요.</div></div></section>
      <button class="aq-create" type="submit">관계까지 반영해 가계도 만들기</button>
      <button class="aq-reset-input" type="button" id="aqResetInput">입력창 초기화</button>
      <p class="aq-note">현재 가계도가 있으면 이 입력 내용으로 교체됩니다.</p>`;
    q('#aqChildren', form).append(childCard(0));
    q('#aqFathers', form).append(parentCard('father', 0));
    q('#aqMothers', form).append(parentCard('mother', 0));
  }

  function familyEntries() {
    const entries = [];
    qa('#aqChildren .aq-child', form).forEach((card, i) => entries.push({id:card.dataset.uid, role:i === 0 ? '대상아동' : '아동', name:q('.aq-name', card)?.value.trim() || `아동 ${i + 1}`}));
    qa('#aqParents .aq-parent', form).forEach((card, i) => entries.push({id:card.dataset.uid, role:card.dataset.kind === 'father' ? '부' : '모', name:q('.aq-name', card)?.value.trim() || `${card.dataset.kind === 'father' ? '부' : '모'} ${i + 1}`}));
    qa('#aqExtras .aq-extra', form).forEach((card, i) => entries.push({id:card.dataset.uid, role:q('.aq-role', card)?.value || '가족', name:q('.aq-name', card)?.value.trim() || `추가 가족 ${i + 1}`}));
    return entries;
  }

  function setSelectOptions(select, entries, current, placeholder = '') {
    if (!select) return;
    select.innerHTML = `${placeholder ? `<option value="">${esc(placeholder)}</option>` : ''}${entries.map(x => `<option value="${esc(x.id)}">${esc(x.role)} · ${esc(x.name)}</option>`).join('')}`;
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }

  function syncParentTargets() {
    const children = qa('#aqChildren .aq-child', form).map((card, i) => ({id:card.dataset.uid, name:q('.aq-name', card)?.value.trim() || `아동 ${i + 1}`}));
    ['father','mother'].forEach(kind => {
      const cards = qa(`#aqParents .aq-parent[data-kind="${kind}"]`, form);
      cards.forEach((card, index) => {
        const select = q('.aq-parent-target', card);
        if (!select) return;
        const touched = card.dataset.targetTouched === 'true';
        const old = select.value;
        select.innerHTML = `<option value="">아동 부모로 연결 안 함 · 새부모/배우자</option><option value="all">등록된 모든 아동</option>${children.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}`;
        const validOld = [...select.options].some(o => o.value === old);
        if (touched && validOld) select.value = old;
        else select.value = index === 0 ? 'all' : '';
      });
    });
  }

  function syncRelationSelectors() {
    const entries = familyEntries();
    qa('#aqRels .aq-adultrel', form).forEach((card, index) => {
      const a = q('.aq-af', card), b = q('.aq-at', card);
      if (!a || !b) return;
      const oldA = a.value, oldB = b.value;
      setSelectOptions(a, entries, oldA);
      if (!a.value && a.options.length) a.selectedIndex = Math.min(index, a.options.length - 1);
      const bEntries = entries.filter(e => e.id !== a.value);
      setSelectOptions(b, bEntries, oldB);
      if (!b.value && b.options.length) b.selectedIndex = Math.min(index, b.options.length - 1);
    });
  }

  function syncExtraRefs() {
    const entries = familyEntries();
    qa('#aqExtras .aq-extra', form).forEach(card => {
      const select = q('.aq-ref', card);
      const old = select?.value || '';
      setSelectOptions(select, entries.filter(e => e.id !== card.dataset.uid), old, '연결 기준 선택');
    });
  }

  function syncAll() {
    syncParentTargets();
    syncRelationSelectors();
    syncExtraRefs();
  }

  function removePair(relations, a, b) {
    for (let i = relations.length - 1; i >= 0; i--) {
      const r = relations[i];
      const same = (r.from === a && r.to === b) || (r.from === b && r.to === a);
      if (same && r.type !== 'parent') relations.splice(i, 1);
    }
  }

  function addAdultRelation(relations, a, b, type) {
    if (!a || !b || a.id === b.id || !type || type === 'none') return;
    removePair(relations, a.id, b.id);
    relations.push({id:id(), from:a.id, to:b.id, type, relationRole:'adult'});
  }

  function addChildEmotion(relations, parent, child, type) {
    if (!parent || !child || !type || type === 'none') return;
    relations.push({id:id(), from:parent.id, to:child.id, type, relationRole:'parent-child-emotional'});
  }

  function targetsChild(card, childUid) {
    const value = q('.aq-parent-target', card)?.value || '';
    return value === 'all' || value === childUid;
  }

  function validateQuick() {
    const children = qa('#aqChildren .aq-child', form);
    const parents = qa('#aqParents .aq-parent', form);
    const issues = [];
    if (!children.length) issues.push('대상아동을 1명 이상 등록해주세요.');
    children.forEach((child, i) => {
      const fathers = parents.filter(p => p.dataset.kind === 'father' && targetsChild(p, child.dataset.uid));
      const mothers = parents.filter(p => p.dataset.kind === 'mother' && targetsChild(p, child.dataset.uid));
      const name = q('.aq-name', child)?.value.trim() || `아동 ${i + 1}`;
      if (fathers.length > 1) issues.push(`${name}: 부가 ${fathers.length}명 부모로 지정되어 있습니다. 한 아동의 부는 1명만 지정해주세요.`);
      if (mothers.length > 1) issues.push(`${name}: 모가 ${mothers.length}명 부모로 지정되어 있습니다. 새엄마는 ‘아동 부모로 연결 안 함’으로 두고 3번에서 관계만 연결해주세요.`);
    });
    return issues;
  }

  function adultNeighbors(people, relations, pid) {
    return relations
      .filter(r => r.type !== 'parent' && r.relationRole !== 'parent-child-emotional' && (r.from === pid || r.to === pid))
      .map(r => personById(people, r.from === pid ? r.to : r.from))
      .filter(Boolean);
  }

  function layoutFamily(people, relations) {
    const parentPeople = people.filter(p => p.role === '부' || p.role === '모');
    const children = people.filter(p => p.role === '대상자' || p.role === '자녀');
    const parentMap = new Map(children.map(ch => [ch.id, relations.filter(r => r.type === 'parent' && r.to === ch.id).map(r => r.from)]));
    const mainChild = children.find(c => c.clientMain) || children[0];
    const placed = new Set();

    const mainIds = mainChild ? (parentMap.get(mainChild.id) || []) : [];
    const mainParents = mainIds.map(pid => personById(people, pid)).filter(Boolean);
    const father = mainParents.find(p => p.role === '부');
    const mother = mainParents.find(p => p.role === '모');

    const setPos = (p, x, y = 225) => {
      if (!p) return;
      p.x = Math.max(80, Math.min(1120, x));
      p.y = y;
      placed.add(p.id);
    };

    if (father && mother) {
      const mainSet = new Set(mainIds);
      const fatherSteps = adultNeighbors(people, relations, father.id).filter(p => (p.role === '부' || p.role === '모') && p.id !== mother.id && !mainSet.has(p.id));
      const motherSteps = adultNeighbors(people, relations, mother.id).filter(p => (p.role === '부' || p.role === '모') && p.id !== father.id && !mainSet.has(p.id));

      if (fatherSteps.length && !motherSteps.length) {
        setPos(father, 600);
        setPos(mother, 850);
        fatherSteps.forEach((p, i) => setPos(p, 350 - i * 210));
      } else if (motherSteps.length && !fatherSteps.length) {
        setPos(father, 350);
        setPos(mother, 600);
        motherSteps.forEach((p, i) => setPos(p, 850 + i * 210));
      } else if (fatherSteps.length && motherSteps.length) {
        setPos(father, 500);
        setPos(mother, 700);
        fatherSteps.forEach((p, i) => setPos(p, 250 - i * 170));
        motherSteps.forEach((p, i) => setPos(p, 950 + i * 170));
      } else {
        setPos(father, 470);
        setPos(mother, 730);
      }
    } else if (mainParents.length === 1) {
      setPos(mainParents[0], 600);
    }

    const pairs = new Map();
    parentMap.forEach(ids => {
      if (ids.length !== 2) return;
      const key = pairKey(ids[0], ids[1]);
      if (!pairs.has(key)) pairs.set(key, ids.slice());
    });
    let pairIndex = 0;
    pairs.forEach(ids => {
      const a = personById(people, ids[0]), b = personById(people, ids[1]);
      if (!a || !b || (placed.has(a.id) && placed.has(b.id))) return;
      if (placed.has(a.id) && !placed.has(b.id)) {
        const dir = a.x < 600 ? -1 : 1;
        setPos(b, a.x + dir * 250);
        return;
      }
      if (!placed.has(a.id) && placed.has(b.id)) {
        const dir = b.x < 600 ? -1 : 1;
        setPos(a, b.x + dir * 250);
        return;
      }
      const center = 300 + (pairIndex++ % 3) * 300;
      const left = a.role === '부' ? a : b.role === '부' ? b : a;
      const right = left === a ? b : a;
      setPos(left, center - 115);
      setPos(right, center + 115);
    });

    let progressed = true;
    while (progressed) {
      progressed = false;
      relations.filter(r => r.type !== 'parent' && r.relationRole !== 'parent-child-emotional').forEach(r => {
        const a = personById(people, r.from), b = personById(people, r.to);
        if (!a || !b || !parentPeople.includes(a) || !parentPeople.includes(b)) return;
        if (placed.has(a.id) && !placed.has(b.id)) {
          setPos(b, a.x < 600 ? a.x - 230 : a.x + 230); progressed = true;
        } else if (!placed.has(a.id) && placed.has(b.id)) {
          setPos(a, b.x < 600 ? b.x - 230 : b.x + 230); progressed = true;
        }
      });
    }

    const unplacedParents = parentPeople.filter(p => !placed.has(p.id));
    unplacedParents.forEach((p, i) => setPos(p, unplacedParents.length === 1 ? 600 : 120 + i * (960 / Math.max(1, unplacedParents.length - 1))));

    const childGroups = new Map();
    children.forEach(ch => {
      const ids = (parentMap.get(ch.id) || []).slice().sort();
      const key = ids.length ? ids.join('|') : `none:${ch.id}`;
      if (!childGroups.has(key)) childGroups.set(key, []);
      childGroups.get(key).push(ch);
    });
    let orphan = 0;
    childGroups.forEach((group, key) => {
      if (key.startsWith('none:')) {
        group.forEach(ch => { ch.x = 200 + orphan++ * 160; ch.y = 560; });
        return;
      }
      const ps = key.split('|').map(pid => personById(people, pid)).filter(Boolean);
      const center = ps.reduce((sum, p) => sum + p.x, 0) / Math.max(1, ps.length);
      const gap = group.length > 2 ? 120 : 145;
      group.forEach((ch, i) => {
        ch.x = Math.max(80, Math.min(1120, center + (i - (group.length - 1) / 2) * gap));
        ch.y = 510;
      });
    });
  }

  function buildDiagram() {
    const issues = validateQuick();
    if (issues.length) {
      alert(`관계 설정을 확인해주세요.\n\n• ${issues.join('\n• ')}`);
      toast('부모·아동 관계 설정을 확인해주세요');
      return;
    }
    if (state.people.length && !confirm('현재 가계도를 빠른 작성 내용으로 교체할까요?')) return;

    const childrenCards = qa('#aqChildren .aq-child', form);
    const parentCards = qa('#aqParents .aq-parent', form);
    const extraCards = qa('#aqExtras .aq-extra', form);
    const people = [], relations = [], map = new Map();

    childrenCards.forEach((card, i) => {
      const person = {id:id(), name:q('.aq-name', card)?.value.trim() || `대상아동${i + 1}`, role:'대상자', gender:q(`input[name="g-${card.dataset.uid}"]:checked`, card)?.value || 'unknown', age:q('.aq-age', card)?.value.trim() || '', life:'alive', cohabit:q('.aq-co', card)?.checked === false ? 'no' : 'yes', note:'', x:600, y:510, clientMain:i === 0};
      people.push(person); map.set(card.dataset.uid, person);
    });

    parentCards.forEach(card => {
      const father = card.dataset.kind === 'father';
      const person = {id:id(), name:q('.aq-name', card)?.value.trim() || (father ? '부' : '모'), role:father ? '부' : '모', gender:father ? 'male' : 'female', age:q('.aq-age', card)?.value.trim() || '', life:'alive', cohabit:q('.aq-co-sel', card)?.value || 'unknown', note:'', x:father ? 420 : 780, y:225};
      people.push(person); map.set(card.dataset.uid, person);
    });

    extraCards.forEach((card, i) => {
      const role = q('.aq-role', card)?.value || '기타 친척';
      const person = {id:id(), name:q('.aq-name', card)?.value.trim() || role, role, gender:q('.aq-sex', card)?.value || 'unknown', age:q('.aq-age', card)?.value.trim() || '', life:'alive', cohabit:q('.aq-co-sel', card)?.value || 'unknown', note:'', x:140 + i * 145, y:['조부','조모'].includes(role) ? 80 : role === '자녀' ? 650 : role === '형제·자매' ? 570 : 390};
      people.push(person); map.set(card.dataset.uid, person);
    });

    parentCards.forEach(card => {
      const parent = map.get(card.dataset.uid);
      const target = q('.aq-parent-target', card)?.value || '';
      if (!target) return;
      const targets = target === 'all' ? childrenCards.map(c => map.get(c.dataset.uid)) : [map.get(target)].filter(Boolean);
      targets.forEach(child => {
        relations.push({id:id(), from:parent.id, to:child.id, type:'parent'});
        addChildEmotion(relations, parent, child, q('.aq-child-rel', card)?.value || 'none');
      });
    });

    qa('#aqRels .aq-adultrel', form).forEach(card => {
      addAdultRelation(relations, map.get(q('.aq-af', card)?.value), map.get(q('.aq-at', card)?.value), q('.aq-type', card)?.value);
    });

    extraCards.forEach(card => {
      const person = map.get(card.dataset.uid);
      const ref = map.get(q('.aq-ref', card)?.value);
      const type = q('.aq-link', card)?.value;
      if (!person || !ref || !type || type === 'none') return;
      if (type === 'parent-of-ref') relations.push({id:id(), from:person.id, to:ref.id, type:'parent'});
      else if (type === 'child-of-ref') relations.push({id:id(), from:ref.id, to:person.id, type:'parent'});
      else if (type === 'sibling-of-ref') relations.filter(r => r.type === 'parent' && r.to === ref.id).forEach(r => relations.push({id:id(), from:r.from, to:person.id, type:'parent'}));
      else addAdultRelation(relations, ref, person, type);
    });

    layoutFamily(people, relations);
    state.people = people;
    state.relations = relations;
    state.zoom = 1;
    state.cohabitBox = null;
    save();
    render();
    activatePanel('editPanel');
    toast('가계도를 새 관계 로직으로 만들었습니다');
  }

  function resetQuickInputs() {
    if (!confirm('빠른 작성 입력값을 초기화할까요? 현재 그려진 가계도는 유지됩니다.')) return;
    buildQuickForm();
    syncAll();
    toast('입력창을 초기화했습니다');
  }

  let bound = false;
  function bindQuickUi() {
    if (bound) return;
    bound = true;

    form.addEventListener('click', e => {
      if (e.target.closest('#aqAddChild')) q('#aqChildren', form).append(childCard(qa('#aqChildren .aq-child', form).length));
      else if (e.target.closest('#aqAddFather')) q('#aqFathers', form).append(parentCard('father', qa('#aqParents .aq-parent[data-kind="father"]', form).length));
      else if (e.target.closest('#aqAddMother')) q('#aqMothers', form).append(parentCard('mother', qa('#aqParents .aq-parent[data-kind="mother"]', form).length));
      else if (e.target.closest('#aqAddRel')) { q('#aqRels .aq-empty', form)?.remove(); q('#aqRels', form).append(relationCard()); }
      else if (e.target.closest('#aqAddExtra')) { q('#aqExtras .aq-empty', form)?.remove(); q('#aqExtras', form).append(extraCard(qa('#aqExtras .aq-extra', form).length)); }
      else if (e.target.closest('#aqResetInput')) { resetQuickInputs(); return; }
      else {
        const remove = e.target.closest('[data-rm]');
        if (remove) {
          const card = remove.closest('.aq-card');
          const list = card?.parentElement;
          card?.remove();
          if (list?.id === 'aqRels' && !q('.aq-card', list)) list.innerHTML = '<div class="aq-empty">필요할 때 두 구성원을 선택해 관계를 추가하세요.</div>';
          if (list?.id === 'aqExtras' && !q('.aq-card', list)) list.innerHTML = '<div class="aq-empty">추가 가족이 필요하면 등록하세요.</div>';
        }
      }
      syncAll();
    });

    form.addEventListener('input', e => {
      if (e.target.matches('.aq-name')) {
        syncRelationSelectors();
        syncExtraRefs();
        syncParentTargets();
      }
    });

    form.addEventListener('change', e => {
      if (e.target.matches('.aq-parent-target')) e.target.closest('.aq-parent').dataset.targetTouched = 'true';
      if (e.target.matches('.aq-af')) syncRelationSelectors();
      if (e.target.matches('.aq-role')) { syncRelationSelectors(); syncExtraRefs(); }
    });
  }

  document.addEventListener('submit', e => {
    if (e.target !== form) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    buildDiagram();
  }, true);

  if (typeof addConnection === 'function') {
    const previousAddConnection = addConnection;
    addConnection = function(from, to, type) {
      if (type !== 'parent') return previousAddConnection(from, to, type);
      const a = state.people.find(p => p.id === from), b = state.people.find(p => p.id === to);
      if (a && (a.role === '대상자' || a.role === '자녀') && b && !(b.role === '대상자' || b.role === '자녀')) [from, to] = [to, from];
      if (state.relations.some(r => r.type === 'parent' && r.from === from && r.to === to)) {
        toast('이미 등록된 부모–자녀 연결입니다');
        return false;
      }
      state.relations.push({id:id(), from, to, type:'parent'});
      save(); render(); toast('부모–자녀 연결을 추가했습니다');
      return true;
    };
  }

  buildQuickForm();
  bindQuickUi();
  syncAll();
})();