(() => {
  const topDownload = document.querySelector('#downloadBtn');
  if (!topDownload) return;

  // Keep only the single global PNG action visible.
  ['#ecoDownloadBtn','#combinedDownloadBtn'].forEach(selector => {
    const button = document.querySelector(selector);
    if (button) button.style.display = 'none';
  });

  let bypassPreflightUntil = 0;

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  }

  function hasGenogram() {
    const saved = readJson('genogram-studio');
    if (Array.isArray(saved?.people) && saved.people.length > 0) return true;
    return !!document.querySelector('#nodeLayer .node[data-id], #genogram #nodeLayer > g[data-id]');
  }

  function hasEcology() {
    const combined = readJson('case-relationship-studio-combined-v1');
    if (Array.isArray(combined?.resources) && combined.resources.length > 0) return true;

    const eco = readJson('case-relationship-studio-ecomap-v1');
    if (Array.isArray(eco?.systems) && eco.systems.length > 0) return true;

    return !!document.querySelector(
      '#combinedResourceLayer .combined-resource[data-resource-id], #combinedMap .combined-resource[data-resource-id], #ecoNodeLayer .eco-node.system[data-eco-node]'
    );
  }

  function hasCohabitBoundary() {
    const saved = readJson('genogram-studio');
    if (Array.isArray(saved?.cohabitMemberIds) && saved.cohabitMemberIds.length > 0) {
      const valid = new Set((saved.people || []).map(person => person?.id).filter(Boolean));
      if (saved.cohabitMemberIds.some(id => valid.has(id))) return true;
    }
    return !!document.querySelector(
      '#genogram .cohabit-boundary-members, #genogram .cohabit-boundary-v3, #genogram .cohabit-boundary-v2, #genogram .cohabit-boundary'
    );
  }

  function getPreflightItems() {
    return [
      { label: '가계도', ok: hasGenogram() },
      { label: '생태도', ok: hasEcology() },
      { label: '동거가족 구분', ok: hasCohabitBoundary() }
    ];
  }

  function ensurePreflightDialog() {
    let dialog = document.querySelector('#pngExportPreflightDialog');
    if (dialog) return dialog;

    const style = document.createElement('style');
    style.id = 'pngExportPreflightStyles';
    style.textContent = `
      #pngExportPreflightDialog{width:min(470px,calc(100vw - 28px));border:0;border-radius:20px;padding:0;overflow:hidden;background:#fff;box-shadow:0 28px 80px rgba(39,18,24,.24)}
      #pngExportPreflightDialog::backdrop{background:rgba(31,21,24,.46);backdrop-filter:blur(2px)}
      #pngExportPreflightDialog .export-preflight-shell{padding:24px}
      #pngExportPreflightDialog .export-preflight-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
      #pngExportPreflightDialog .export-preflight-eyebrow{margin:0 0 5px;color:#c9002b;font:800 10px Manrope,system-ui,sans-serif;letter-spacing:.10em}
      #pngExportPreflightDialog h2{margin:0;color:#2d2225;font-size:21px;line-height:1.35;word-break:keep-all}
      #pngExportPreflightDialog .export-preflight-close{flex:0 0 auto;width:34px;height:34px;border:0;border-radius:10px;background:#f5eff1;color:#685b5f;font-size:21px;line-height:1;cursor:pointer}
      #pngExportPreflightDialog .export-preflight-copy{margin:15px 0 13px;color:#706367;font-size:13px;line-height:1.65;word-break:keep-all}
      #pngExportPreflightDialog .export-preflight-list{display:grid;gap:8px}
      #pngExportPreflightDialog .export-preflight-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border:1px solid #e9dfe2;border-radius:12px;background:#fff}
      #pngExportPreflightDialog .export-preflight-item strong{font-size:13px;color:#3b3033}
      #pngExportPreflightDialog .export-preflight-status{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-size:11px;font-weight:800}
      #pngExportPreflightDialog .export-preflight-item.ok .export-preflight-status{color:#397253}
      #pngExportPreflightDialog .export-preflight-item.missing{border-color:#efc5cf;background:#fff8fa}
      #pngExportPreflightDialog .export-preflight-item.missing .export-preflight-status{color:#b0002c}
      #pngExportPreflightDialog .export-preflight-note{margin:13px 0 0;padding:11px 12px;border-radius:11px;background:#f8f4f5;color:#74676a;font-size:11px;line-height:1.55;word-break:keep-all}
      #pngExportPreflightDialog .export-preflight-action{width:100%;margin-top:16px;border:0;border-radius:12px;padding:13px 16px;background:#c9002b;color:#fff;font:800 13px IBM Plex Sans KR,system-ui,sans-serif;cursor:pointer}
      #pngExportPreflightDialog .export-preflight-action:hover{background:#b40026}
    `;
    document.head.appendChild(style);

    dialog = document.createElement('dialog');
    dialog.id = 'pngExportPreflightDialog';
    dialog.innerHTML = `
      <div class="export-preflight-shell">
        <div class="export-preflight-head">
          <div><p class="export-preflight-eyebrow">PNG OUTPUT CHECK</p><h2>출력 전에 확인해주세요</h2></div>
          <button type="button" class="export-preflight-close" aria-label="닫기">×</button>
        </div>
        <p class="export-preflight-copy">아래 필수 확인 항목 중 작성되지 않은 내용이 있습니다. 필요한 내용을 추가한 뒤 출력하는 것을 권장합니다.</p>
        <div class="export-preflight-list" id="pngExportPreflightList"></div>
        <p class="export-preflight-note">누락된 항목이 의도된 경우에는 그대로 PNG를 출력할 수 있습니다.</p>
        <button type="button" class="export-preflight-action">그래도 출력</button>
      </div>`;
    document.body.appendChild(dialog);

    dialog.querySelector('.export-preflight-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.querySelector('.export-preflight-action').addEventListener('click', () => {
      dialog.close();
      bypassPreflightUntil = Date.now() + 1500;
      topDownload.click();
    });

    return dialog;
  }

  function openPreflight(items) {
    const dialog = ensurePreflightDialog();
    const list = dialog.querySelector('#pngExportPreflightList');
    list.innerHTML = items.map((item, index) => `
      <div class="export-preflight-item ${item.ok ? 'ok' : 'missing'}">
        <strong>${index + 1}. ${item.label}</strong>
        <span class="export-preflight-status">${item.ok ? '✓ 확인됨' : '! 확인 필요'}</span>
      </div>`).join('');
    if (!dialog.open) dialog.showModal();
  }

  function clickHidden(selector) {
    const button = document.querySelector(selector);
    if (!button) return false;
    button.click();
    return true;
  }

  topDownload.addEventListener('click', event => {
    if (Date.now() >= bypassPreflightUntil) {
      const items = getPreflightItems();
      if (items.some(item => !item.ok)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPreflight(items);
        return;
      }
    }

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
