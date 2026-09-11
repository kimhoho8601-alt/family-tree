(() => {
  const form = document.querySelector('#quickForm');
  if (!form) return;

  function simplifyQuickEntry() {
    // 빠른 작성은 핵심 가족 구성만 입력하고, 세부 관계/기타 가족은 생성 후 편집한다.
    form.querySelector('#aqAddRel')?.closest('.aq-section')?.remove();
    form.querySelector('#aqAddExtra')?.closest('.aq-section')?.remove();

    const submit = form.querySelector('.aq-create');
    if (submit) submit.textContent = '가계도 만들기';

    const note = form.querySelector('.aq-note');
    if (note) note.textContent = '가계도 생성 후 세부 편집에서 관계와 가족을 추가·수정할 수 있습니다.';
  }

  simplifyQuickEntry();

  // 다른 확장 스크립트가 빠른 작성 영역을 다시 그려도 3·4번은 노출하지 않는다.
  const observer = new MutationObserver(() => simplifyQuickEntry());
  observer.observe(form, { childList: true, subtree: true });
})();
