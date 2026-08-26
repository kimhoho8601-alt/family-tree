(() => {
  const form = document.querySelector('#quickForm');
  if (!form) return;
  const q = s => document.querySelector(s);
  const qa = s => [...document.querySelectorAll(s)];
  const esc = s => (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const style = document.createElement('style');
  style.textContent = `
    #aqRels .aq-card{background:#fff}
    #aqRels .aq-grid{grid-template-columns:1fr 1fr}
    #aqRels .aq-type-field{grid-column:1/-1}
    #aqRels .aq-relation-note{margin:7px 0 0;color:#8b7e81;font-size:8px;line-height:1.45;word-break:keep-all}
    @media(max-width:520px){#aqRels .aq-grid{grid-template-columns:1fr}#aqRels .aq-type-field{grid-column:auto}}
  `;
  document.head.append(style);

  function stripParentRelationshipFields(root = document) {
    root.querySelectorAll?.('#aqParents .aq-parent .aq-subbox').forEach(el => el.remove());
  }

  function renameSection() {
    const relList = q('#aqRels');
    const section = relList?.closest('.aq-section');
    if (!section) return;
    const title = section.querySelector('.aq-copy strong');
    const desc = section.querySelector('.aq-copy small:not(strong small)');
    if (title) title.innerHTML = '구성원간 관계 <small style="display:inline;color:var(--muted)">선택</small>';
    if (desc) desc.textContent = '등록한 가족 전체에서 두 사람을 선택해 부부·이혼·친밀·갈등 등의 관계선을 지정합니다.';
    const empty = relList.querySelector('.aq-empty');
    if (empty) empty.textContent = '필요할 때 등록된 가족 중 두 사람을 선택해 관계를 추가하세요.';
  }

  function familyEntries() {
    const entries = [];
    qa('#aqChildren .aq-child').forEach((c, i) => entries.push({
      id: c.dataset.uid,
      role: i === 0 ? '대상아동' : '아동',
      name: c.querySelector('.aq-name')?.value.trim() || `아동 ${i + 1}`
    }));
    qa('#aqParents .aq-parent').forEach((c, i) => entries.push({
      id: c.dataset.uid,
      role: c.dataset.kind === 'father' ? '부' : '모',
      name: c.querySelector('.aq-name')?.value.trim() || `${c.dataset.kind === 'father' ? '부' : '모'} ${i + 1}`
    }));
    qa('#aqExtras .aq-extra').forEach((c, i) => entries.push({
      id: c.dataset.uid,
      role: c.querySelector('.aq-role')?.value || '가족',
      name: c.querySelector('.aq-name')?.value.trim() || `추가 가족 ${i + 1}`
    }));
    return entries;
  }

  function optionHtml(entries, exclude) {
    return entries.filter(x => x.id !== exclude).map(x => `<option value="${x.id}">${esc(x.role)} · ${esc(x.name)}</option>`).join('');
  }

  function relationCard() {
    const d = document.createElement('div');
    d.className = 'aq-card aq-adultrel aq-generalrel';
    d.innerHTML = `<div class="aq-top"><span class="aq-badge">구성원 관계</span><b>관계선 지정</b><button type="button" class="aq-rm" data-rm>×</button></div>
      <div class="aq-grid">
        <label class="aq-field"><span>구성원 1</span><select class="aq-af"></select></label>
        <label class="aq-field"><span>구성원 2</span><select class="aq-at"></select></label>
        <label class="aq-field aq-type-field"><span>관계선</span><select class="aq-type">
          <option value="marriage">실선 · 부부/동반자</option>
          <option value="separated">별거</option>
          <option value="divorced">이혼</option>
          <option value="distant">점선 · 소원/불명확</option>
          <option value="close">굵은선 · 친밀/지지</option>
          <option value="conflict">지그재그 · 갈등/적대</option>
        </select></label>
      </div><p class="aq-relation-note">아동·부·모·보호자·기타 가족을 모두 선택할 수 있습니다.</p>`;
    return d;
  }

  function syncRelationSelectors() {
    const entries = familyEntries();
    qa('#aqRels .aq-adultrel').forEach((card, index) => {
      const a = card.querySelector('.aq-af'), b = card.querySelector('.aq-at');
      if (!a || !b) return;
      const oldA = a.value, oldB = b.value;
      a.innerHTML = optionHtml(entries, null);
      if ([...a.options].some(o => o.value === oldA)) a.value = oldA;
      else if (a.options.length) a.selectedIndex = Math.min(index, a.options.length - 1);
      const selectedA = a.value;
      b.innerHTML = optionHtml(entries, selectedA);
      if ([...b.options].some(o => o.value === oldB)) b.value = oldB;
      else if (b.options.length) b.selectedIndex = Math.min(index, b.options.length - 1);
    });
  }

  function updateSecondSelect(card) {
    const entries = familyEntries();
    const a = card.querySelector('.aq-af'), b = card.querySelector('.aq-at');
    if (!a || !b) return;
    const old = b.value;
    b.innerHTML = optionHtml(entries, a.value);
    if ([...b.options].some(o => o.value === old)) b.value = old;
  }

  stripParentRelationshipFields();
  renameSection();
  syncRelationSelectors();

  form.addEventListener('click', e => {
    const add = e.target.closest('#aqAddRel');
    if (!add) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const list = q('#aqRels');
    list?.querySelector('.aq-empty')?.remove();
    const card = relationCard();
    list?.append(card);
    syncRelationSelectors();
  }, true);

  form.addEventListener('change', e => {
    if (e.target.matches('#aqRels .aq-af')) updateSecondSelect(e.target.closest('.aq-adultrel'));
    if (e.target.matches('.aq-role,.aq-name')) setTimeout(syncRelationSelectors, 0);
  });

  form.addEventListener('input', e => {
    if (e.target.matches('.aq-name')) setTimeout(syncRelationSelectors, 0);
  });

  document.addEventListener('click', e => {
    if (e.target.closest('#aqAddChild,#aqAddFather,#aqAddMother,#aqAddExtra,[data-rm]')) {
      setTimeout(() => { stripParentRelationshipFields(); renameSection(); syncRelationSelectors(); }, 0);
    }
  });

  const observer = new MutationObserver(mutations => {
    let hasParent = false;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('.aq-parent') || node.querySelector?.('.aq-parent')) hasParent = true;
      }
    }
    if (hasParent) setTimeout(() => { stripParentRelationshipFields(); syncRelationSelectors(); }, 0);
  });
  observer.observe(form, {childList:true, subtree:true});
})();