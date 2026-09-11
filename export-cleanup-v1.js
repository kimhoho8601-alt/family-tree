(() => {
  // Hide editor-only empty-state guidance just before SVG export clones the canvas.
  // The original download handlers clone synchronously, so restoring on the next frame
  // keeps the on-screen guidance while excluding it from the downloaded PNG.
  const hideForExport = (selector) => {
    const changed = [];
    document.querySelectorAll(selector).forEach(el => {
      changed.push({ el, display: el.getAttribute('display'), styleDisplay: el.style.display });
      el.setAttribute('display', 'none');
      el.style.display = 'none';
    });
    requestAnimationFrame(() => {
      changed.forEach(({ el, display, styleDisplay }) => {
        if (display == null) el.removeAttribute('display'); else el.setAttribute('display', display);
        el.style.display = styleDisplay;
      });
    });
  };

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#combinedDownloadBtn,#ecoDownloadBtn');
    if (!button) return;

    if (button.id === 'combinedDownloadBtn') {
      hideForExport('#combinedMap .combined-empty');
    } else {
      hideForExport('#ecomap .eco-empty-label');
    }
  }, true);
})();
