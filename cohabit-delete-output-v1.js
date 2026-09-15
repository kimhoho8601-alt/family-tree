(() => {
  // Keep the combined-page memo data/element for compatibility, but hide the UI.
  if (!document.querySelector('style[data-cohabit-delete-output]')) {
    const style = document.createElement('style');
    style.dataset.cohabitDeleteOutput = 'v1';
    style.textContent = `
      #combinedPage .combined-memo-panel{display:none!important}
      .cohabit-boundary-members{pointer-events:all!important}
      .cohabit-boundary-members path{pointer-events:stroke!important;cursor:pointer}
      .cohabit-boundary-members.cohabit-boundary-selected path{
        stroke:#2563a8!important;
        stroke-width:4!important;
        filter:drop-shadow(0 0 4px rgba(37,99,168,.22));
      }
    `;
    document.head.appendChild(style);
  }

  let selectedBoundary = null;

  function clearBoundarySelection() {
    document.querySelectorAll('.cohabit-boundary-members.cohabit-boundary-selected')
      .forEach(group => group.classList.remove('cohabit-boundary-selected'));
    selectedBoundary = null;
  }

  function selectBoundary(group) {
    clearBoundarySelection();
    if (!group) return;
    group.classList.add('cohabit-boundary-selected');
    selectedBoundary = group;
  }

  document.addEventListener('pointerdown', event => {
    const group = event.target.closest?.('.cohabit-boundary-members');
    if (group) {
      // Cohabit member-pick mode owns node clicks; do not alter it here.
      if (window.__COHABIT_PICK_MODE__) return;
      event.preventDefault();
      event.stopPropagation();
      selectBoundary(group);
      if (typeof toast === 'function') toast('동거가족 범위를 선택했습니다. Delete 키로 삭제할 수 있습니다');
      return;
    }

    if (selectedBoundary && !event.target.closest?.('#cohabitSelectBtn,#cohabitSelectionBar')) {
      clearBoundarySelection();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (!selectedBoundary || !['Delete', 'Backspace'].includes(event.key)) return;
    const tag = document.activeElement?.tagName;
    if (['INPUT','TEXTAREA','SELECT'].includes(tag) || document.querySelector('dialog[open]')) return;
    if (typeof state === 'undefined' || typeof save !== 'function' || typeof render !== 'function') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    state.cohabitMemberIds = [];
    state.cohabitSelectionVersion = 2;
    state.cohabitBox = null;
    clearBoundarySelection();
    save();
    render();
    if (typeof toast === 'function') toast('동거가족 구분을 삭제했습니다');
  }, true);

  // The word "동거가족" is an editor aid only. Hide it synchronously before
  // any PNG export handler clones the SVG, then restore it on the next frame.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('#downloadBtn,#combinedDownloadBtn,#ecoDownloadBtn');
    if (!button) return;

    const labels = [...document.querySelectorAll('.cohabit-boundary-members text')];
    const snapshots = labels.map(el => ({
      el,
      display: el.getAttribute('display'),
      styleDisplay: el.style.display
    }));
    labels.forEach(el => {
      el.setAttribute('display', 'none');
      el.style.display = 'none';
    });

    requestAnimationFrame(() => {
      snapshots.forEach(({ el, display, styleDisplay }) => {
        if (display == null) el.removeAttribute('display'); else el.setAttribute('display', display);
        el.style.display = styleDisplay;
      });
    });
  }, true);
})();
