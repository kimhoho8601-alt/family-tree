(() => {
  const tabs = [...document.querySelectorAll('.studio-mode-tab')];
  const pages = [...document.querySelectorAll('.studio-page')];
  if (!tabs.length || !pages.length) return;

  function activate(mode) {
    document.body.dataset.studioMode = mode;
    tabs.forEach(tab => {
      const active = tab.dataset.studioMode === mode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    pages.forEach(page => { page.hidden = page.dataset.studioPage !== mode; });
    document.title = mode === 'eco' ? '생태도 그리기 · 사례관계도 스튜디오' : '가계도 그리기 · 사례관계도 스튜디오';
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.dataset.studioMode));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      activate(tabs[next].dataset.studioMode);
    });
  });

  activate('genogram');
})();
