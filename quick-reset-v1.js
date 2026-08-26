(() => {
  const form = document.querySelector('#quickForm');
  if (!form) return;

  const style = document.createElement('style');
  style.textContent = `
    .aq-form-actions{display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:16px}
    .aq-reset{height:50px;border:1px solid #dccfd2;border-radius:12px;background:#fff;color:#665b5e;font:700 12px inherit;cursor:pointer}
    .aq-form-actions .aq-create{margin-top:0}
  `;
  document.head.append(style);

  function install() {
    const create = form.querySelector('.aq-create');
    if (!create || form.querySelector('#aqResetInput')) return;
    const wrap = document.createElement('div');
    wrap.className = 'aq-form-actions';
    create.parentNode.insertBefore(wrap, create);
    wrap.append(create);
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.id = 'aqResetInput';
    reset.className = 'aq-reset';
    reset.textContent = '입력 초기화';
    wrap.insertBefore(reset, create);
  }

  function click(id) { document.querySelector(id)?.click(); }

  form.addEventListener('click', e => {
    if (!e.target.closest('#aqResetInput')) return;
    if (!confirm('빠른 작성 입력 내용을 모두 초기화할까요?\n현재 캔버스의 가계도는 삭제하지 않습니다.')) return;

    const children = [...form.querySelectorAll('#aqChildren .aq-child')];
    children.slice(1).forEach(c => c.remove());
    const first = children[0];
    if (first) {
      first.querySelector('.aq-name').value = '대상아동';
      first.querySelector('.aq-age').value = '';
      const male = first.querySelector('input[type="radio"][value="male"]'); if (male) male.checked = true;
      const co = first.querySelector('.aq-co'); if (co) co.checked = true;
    }

    form.querySelectorAll('#aqParents .aq-parent').forEach(p => p.remove());
    form.querySelectorAll('#aqExtras .aq-extra').forEach(x => x.remove());
    form.querySelectorAll('#aqRels .aq-adultrel').forEach(r => r.remove());

    click('#aqAddFather');
    click('#aqAddMother');

    const rels = form.querySelector('#aqRels');
    if (rels && !rels.querySelector('.aq-empty')) {
      const empty = document.createElement('div');
      empty.className = 'aq-empty';
      empty.textContent = '필요할 때 등록된 가족 중 두 사람을 선택해 관계를 추가하세요.';
      rels.append(empty);
    }

    form.dispatchEvent(new Event('input', {bubbles:true}));
    form.dispatchEvent(new Event('change', {bubbles:true}));
    if (typeof toast === 'function') toast('입력창을 초기화했습니다');
  });

  install();
})();