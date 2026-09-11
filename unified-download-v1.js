(() => {
  const topDownload = document.querySelector('#downloadBtn');
  if (!topDownload) return;

  // Keep only the single global PNG action visible.
  ['#ecoDownloadBtn','#combinedDownloadBtn'].forEach(selector => {
    const button = document.querySelector(selector);
    if (button) button.style.display = 'none';
  });

  function clickHidden(selector) {
    const button = document.querySelector(selector);
    if (!button) return false;
    button.click();
    return true;
  }

  topDownload.addEventListener('click', event => {
    const mode = document.body.dataset.studioMode || 'genogram';
    if (mode === 'combined') {
      event.preventDefault();
      event.stopImmediatePropagation();
      clickHidden('#combinedDownloadBtn');
      return;
    }
    if (mode === 'eco') {
      event.preventDefault();
      event.stopImmediatePropagation();
      clickHidden('#ecoDownloadBtn');
    }
    // genogram mode falls through to the original #downloadBtn handler.
  }, true);
})();
