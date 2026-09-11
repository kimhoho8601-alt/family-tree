(() => {
  const form = document.querySelector('#quickForm');
  if (!form) return;

  // 빠른 작성에서는 1~2단계만 노출한다.
  // 3·4단계 DOM은 삭제하지 않고 숨겨서, 기존 advanced-quick.js가 보유한
  // 요소 참조와 이벤트 로직을 깨뜨리지 않도록 한다.
  const relationSection = form.querySelector('#aqAddRel')?.closest('.aq-section');
  const extraSection = form.querySelector('#aqAddExtra')?.closest('.aq-section');
  if (relationSection) {
    relationSection.hidden = true;
    relationSection.style.display = 'none';
  }
  if (extraSection) {
    extraSection.hidden = true;
    extraSection.style.display = 'none';
  }

  const submit = form.querySelector('.aq-create');
  if (submit && submit.textContent.trim() !== '가계도 만들기') {
    submit.textContent = '가계도 만들기';
  }

  const note = form.querySelector('.aq-note');
  const noteText = '가계도 생성 후 세부 편집에서 관계와 가족을 추가·수정할 수 있습니다.';
  if (note && note.textContent.trim() !== noteText) {
    note.textContent = noteText;
  }
})();
