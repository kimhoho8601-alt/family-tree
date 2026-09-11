(() => {
  const button = document.querySelector('#emptyAddBtn');
  const emptyState = document.querySelector('#emptyState');
  if (!button || !emptyState) return;

  if (!document.querySelector('style[data-empty-grid-start]')) {
    const style = document.createElement('style');
    style.dataset.emptyGridStart = 'v1';
    style.textContent = 'body.blank-grid-open #emptyState{display:none!important}';
    document.head.append(style);
  }

  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();

    document.body.classList.add('blank-grid-open');
    emptyState.hidden = true;

    // Blank-grid start is a manual drawing flow, so expose the detail editor.
    if (typeof activatePanel === 'function') activatePanel('editPanel');

    const canvas = document.querySelector('#canvasWrap');
    canvas?.focus?.({ preventScroll: true });

    if (typeof toast === 'function') {
      toast('빈 그리드에서 더블클릭해 구성원을 추가할 수 있습니다');
    }
  }, true);

  // Once a real person exists the empty state is irrelevant. Keep the class so
  // later render() calls cannot unexpectedly cover the canvas while manually drawing.
})();
