(() => {
  if (typeof state === 'undefined' || typeof save !== 'function' || typeof render !== 'function') return;
  const form = document.querySelector('#quickForm');
  if (!form || document.querySelector('#aqGrandparentsSection')) return;

  const q = (s, root=document) => root.querySelector(s);
  const qa = (s, root=document) => [...root.querySelectorAll(s)];
  const uid = () => crypto.randomUUID?.() || `gp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const style = document.createElement('style');
  style.dataset.quickGrandparents = 'v1';
  style.textContent = `
    #aqGrandparentsSection .aq-grand-columns{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    #aqGrandparentsSection .aq-grand-side{min-width:0;padding:10px;border:1px solid var(--line);border-radius:11px;background:#faf8f8}
    #aqGrandparentsSection .aq-grand-side-head{display:flex;align-items:center;gap:7px;margin-bottom:8px;padding-bottom:7px;border-bottom:1px solid var(--line)}
    #aqGrandparentsSection .aq-grand-side-head strong{font-size:11px}
    #aqGrandparentsSection .aq-grand-target{margin-bottom:8px}
    #aqGrandparentsSection .aq-grand-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:7px;align-items:start;padding:7px 0;border-top:1px dashed #e5dadd}
    #aqGrandparentsSection .aq-grand-row:first-of-type{border-top:0}
    #aqGrandparentsSection .aq-grand-enable{display:flex;align-items:center;gap:4px;padding-top:9px;color:#665b5e;font-size:9px;white-space:nowrap}
    #aqGrandparentsSection .aq-grand-enable input{accent-color:var(--red)}
    #aqGrandparentsSection .aq-grand-fields{display:grid;grid-template-columns:1fr 72px;gap:6px}
    #aqGrandparentsSection .aq-grand-fields input{width:100%;height:35px;padding:0 8px;border:1px solid var(--line);border-radius:7px;background:#fff;font:11px inherit}
    #aqGrandparentsSection .aq-grand-help{margin:8px 0 0;color:#8b7e81;font-size:8px;line-height:1.5;word-break:keep-all}
    @media(max-width:520px){#aqGrandparentsSection .aq-grand-columns{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  const existingSections = qa(':scope > .aq-section', form);
  const insertBefore = existingSections[2] || q('.aq-create', form);
  const section = document.createElement('section');
  section.className = 'aq-section';
  section.id = 'aqGrandparentsSection';
  section.innerHTML = `
    <div class="aq-head">
      <span class="aq-step">3</span>
      <div class="aq-copy"><strong>조부모 · 3대 가족</strong><small>필요한 조부모만 체크하면 부모와 자동 연결됩니다.</small></div>
    </div>
    <div class="aq-grand-columns">
      <div class="aq-grand-side" data-grand-side="father">
        <div class="aq-grand-side-head"><strong>부계 조부모</strong></div>
        <label class="aq-field aq-grand-target"><span>연결할 부</span><select class="aq-grand-parent-target" data-kind="father"></select></label>
        <div class="aq-grand-row" data-grand="paternal-grandfather">
          <label class="aq-grand-enable"><input type="checkbox" class="aq-grand-on"> 조부</label>
          <div class="aq-grand-fields"><input class="aq-grand-name" value="친조부" aria-label="친조부 식별명"><input class="aq-grand-age" placeholder="나이" aria-label="친조부 나이"></div>
        </div>
        <div class="aq-grand-row" data-grand="paternal-grandmother">
          <label class="aq-grand-enable"><input type="checkbox" class="aq-grand-on"> 조모</label>
          <div class="aq-grand-fields"><input class="aq-grand-name" value="친조모" aria-label="친조모 식별명"><input class="aq-grand-age" placeholder="나이" aria-label="친조모 나이"></div>
        </div>
        <p class="aq-grand-help">체크한 구성원은 선택한 부의 부모 세대로 생성됩니다.</p>
      </div>
      <div class="aq-grand-side" data-grand-side="mother">
        <div class="aq-grand-side-head"><strong>모계 조부모</strong></div>
        <label class="aq-field aq-grand-target"><span>연결할 모</span><select class="aq-grand-parent-target" data-kind="mother"></select></label>
        <div class="aq-grand-row" data-grand="maternal-grandfather">
          <label class="aq-grand-enable"><input type="checkbox" class="aq-grand-on"> 외조부</label>
          <div class="aq-grand-fields"><input class="aq-grand-name" value="외조부" aria-label="외조부 식별명"><input class="aq-grand-age" placeholder="나이" aria-label="외조부 나이"></div>
        </div>
        <div class="aq-grand-row" data-grand="maternal-grandmother">
          <label class="aq-grand-enable"><input type="checkbox" class="aq-grand-on"> 외조모</label>
          <div class="aq-grand-fields"><input class="aq-grand-name" value="외조모" aria-label="외조모 식별명"><input class="aq-grand-age" placeholder="나이" aria-label="외조모 나이"></div>
        </div>
        <p class="aq-grand-help">체크한 구성원은 선택한 모의 부모 세대로 생성됩니다.</p>
      </div>
    </div>`;
  form.insertBefore(section, insertBefore);

  function parentCards(kind) {
    return qa(`#aqParents .aq-parent[data-kind="${kind}"]`, form);
  }

  function syncParentTargets() {
    ['father','mother'].forEach(kind => {
      const select = q(`.aq-grand-parent-target[data-kind="${kind}"]`, section);
      const cards = parentCards(kind);
      const current = select.value;
      const signature = cards.map(card => `${card.dataset.uid}:${q('.aq-name', card)?.value || ''}`).join('|');
      if (select.dataset.signature === signature) return;
      select.dataset.signature = signature;
      select.innerHTML = cards.length
        ? cards.map((card,i) => `<option value="${esc(card.dataset.uid)}">${esc(q('.aq-name',card)?.value.trim() || (kind==='father'?`부 ${i+1}`:`모 ${i+1}`))}</option>`).join('')
        : `<option value="">${kind==='father'?'부':'모'}를 먼저 추가하세요</option>`;
      if (cards.some(card => card.dataset.uid === current)) select.value = current;
      const side = select.closest('.aq-grand-side');
      qa('input', side).forEach(input => input.disabled = !cards.length);
      select.disabled = !cards.length;
    });
  }

  form.addEventListener('click', e => {
    if (e.target.closest('#aqAddFather,#aqAddMother,[data-rm]')) setTimeout(syncParentTargets, 0);
  });
  form.addEventListener('input', e => {
    if (e.target.matches('#aqParents .aq-name')) setTimeout(syncParentTargets, 0);
  });
  syncParentTargets();

  function grandSpec(row) {
    const key = row.dataset.grand;
    const specs = {
      'paternal-grandfather': {role:'조부', gender:'male', dx:-92},
      'paternal-grandmother': {role:'조모', gender:'female', dx:92},
      'maternal-grandfather': {role:'조부', gender:'male', dx:-92},
      'maternal-grandmother': {role:'조모', gender:'female', dx:92}
    };
    return specs[key];
  }

  function appendGrandparents() {
    const createdBySide = [];
    ['father','mother'].forEach(kind => {
      const side = q(`[data-grand-side="${kind}"]`, section);
      const targetUid = q('.aq-grand-parent-target', side)?.value;
      if (!targetUid) return;
      const cards = parentCards(kind);
      const targetIndex = cards.findIndex(card => card.dataset.uid === targetUid);
      if (targetIndex < 0) return;
      const generatedParents = state.people.filter(p => p.role === (kind === 'father' ? '부' : '모'));
      const parent = generatedParents[targetIndex];
      if (!parent) return;

      const made = [];
      qa('.aq-grand-row', side).forEach(row => {
        if (!q('.aq-grand-on', row)?.checked) return;
        const spec = grandSpec(row);
        if (!spec) return;
        const person = {
          id: uid(),
          name: q('.aq-grand-name', row)?.value.trim() || spec.role,
          role: spec.role,
          gender: spec.gender,
          age: q('.aq-grand-age', row)?.value.trim() || '',
          life: 'alive',
          cohabit: 'unknown',
          note: '',
          x: Math.max(70, Math.min(1130, parent.x + spec.dx)),
          y: Math.max(80, parent.y - 165),
          quickGrandparent: true
        };
        state.people.push(person);
        state.relations.push({id:uid(),from:person.id,to:parent.id,type:'parent'});
        made.push(person);
      });

      if (made.length === 2) {
        state.relations.push({id:uid(),from:made[0].id,to:made[1].id,type:'marriage'});
      }
      if (made.length) createdBySide.push(...made);
    });

    if (createdBySide.length) {
      state.cohabitBox = null;
      save();
      render();
      if (typeof toast === 'function') toast(`조부모 ${createdBySide.length}명을 포함해 3대 가계도를 만들었습니다`);
    }
  }

  // advanced-quick owns the submit handler and stops propagation. Capture first,
  // then append grandparents only if that handler actually replaced/generated state.
  form.addEventListener('submit', () => {
    const beforeIds = state.people.map(p => p.id).join('|');
    setTimeout(() => {
      const afterIds = state.people.map(p => p.id).join('|');
      if (!afterIds || afterIds === beforeIds) return;
      appendGrandparents();
    }, 0);
  }, true);
})();
