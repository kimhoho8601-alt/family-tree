(() => {
  const form = document.querySelector('#quickForm');
  if (!form) return;

  const LIFE_OPTIONS = `
    <option value="alive">생존</option>
    <option value="dead">사망</option>
    <option value="unknown">미상</option>
  `;

  function ensureLifeField(card) {
    if (!card || card.querySelector('.aq-life')) return;

    const relationGrid = card.querySelector('.aq-box .aq-grid');
    if (!relationGrid) return;

    const label = document.createElement('label');
    label.className = 'aq-field aq-life-field';
    label.innerHTML = `<span>생존 상태</span><select class="aq-life">${LIFE_OPTIONS}</select>`;

    const cohabitField = card.querySelector('.aq-co-sel')?.closest('.aq-field');
    if (cohabitField?.parentElement === relationGrid) {
      relationGrid.insertBefore(label, cohabitField);
    } else {
      relationGrid.append(label);
    }
  }

  function sync() {
    form.querySelectorAll('#aqParents .aq-parent').forEach(ensureLifeField);
  }

  const observer = new MutationObserver(() => sync());
  observer.observe(form, {childList:true, subtree:true});

  document.addEventListener('click', e => {
    if (e.target.closest('#aqAddFather,#aqAddMother,#aqResetInput,[data-rm]')) {
      requestAnimationFrame(sync);
    }
  });

  sync();
})();