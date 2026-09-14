(() => {
  'use strict';

  const API_URL = 'https://ynqzzdelgaivuriyxurq.supabase.co/functions/v1/case-relation-api';
  const state = {
    notice: { title: '', body: '', is_active: false, updated_at: null },
    stats: { today: 0, total: 0 },
  };
  let adminSessionCode = '';

  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  async function callApi(payload) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '서버 연결에 실패했습니다.');
    return data;
  }

  function injectStyles() {
    if (document.getElementById('siteAdminStyles')) return;
    const style = document.createElement('style');
    style.id = 'siteAdminStyles';
    style.textContent = `
      .site-notice-banner{max-width:1440px;margin:14px auto 0;padding:0 28px;display:none}.site-notice-banner.is-visible{display:block}.site-notice-inner{display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border:1px solid #f1c5cf;border-radius:14px;background:#fff7f9;box-shadow:0 10px 28px rgba(120,0,24,.05)}.site-notice-badge{flex:0 0 auto;padding:5px 9px;border-radius:999px;background:#c9002b;color:#fff;font-size:11px;font-weight:800}.site-notice-copy strong{display:block;color:#2b2224;font-size:14px;margin:1px 0 4px;word-break:keep-all}.site-notice-copy p{margin:0;color:#665b5e;font-size:13px;line-height:1.55;white-space:pre-line;word-break:keep-all}.brand-mark{cursor:pointer;user-select:none}
      #siteAdminGate,#siteAdminDialog{border:0;padding:0;border-radius:22px;box-shadow:0 30px 90px rgba(40,0,8,.28);overflow:hidden;background:#fff}#siteAdminGate::backdrop,#siteAdminDialog::backdrop{background:rgba(24,15,18,.52);backdrop-filter:blur(2px)}#siteAdminGate{width:min(420px,calc(100vw - 28px))}#siteAdminDialog{width:min(920px,calc(100vw - 28px));max-height:92vh}
      .site-gate{padding:26px}.site-gate-icon{width:54px;height:54px;border-radius:16px;background:#c9002b;color:#fff;display:grid;place-items:center;font:800 25px Manrope,system-ui,sans-serif;margin-bottom:16px}.site-gate h2{margin:0 0 7px;font-size:21px;color:#21191b}.site-gate p{margin:0 0 18px;color:#766a6d;font-size:13px;line-height:1.55}.site-gate input{width:100%;box-sizing:border-box;border:1px solid #d9ced1;border-radius:12px;padding:13px;font:inherit;outline:none}.site-gate input:focus{border-color:#c9002b;box-shadow:0 0 0 3px rgba(201,0,43,.08)}.site-gate-error{min-height:20px;margin-top:8px;font-size:12px;color:#b00020}.site-gate-actions,.site-admin-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:12px}.site-gate-actions button,.site-admin-actions button{border:0;border-radius:11px;padding:10px 15px;font-weight:800;cursor:pointer}.ghost{background:#f1ebed;color:#53484b}.primary{background:#c9002b;color:#fff}
      .site-admin-shell{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);min-height:560px}.site-admin-main{padding:28px}.site-admin-side{padding:28px;background:#faf7f8;border-left:1px solid #eee3e6}.site-admin-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:22px}.site-admin-head .eyebrow{margin:0 0 4px;color:#c9002b;font-size:11px;font-weight:800;letter-spacing:.12em}.site-admin-head h2{margin:0;font-size:24px;color:#21191b}.site-admin-close{border:0;background:#f4edef;width:36px;height:36px;border-radius:10px;font-size:24px;cursor:pointer}.site-admin-grid{display:grid;gap:14px}.site-admin-field{display:flex;flex-direction:column;gap:7px}.site-admin-field span{font-size:12px;font-weight:700;color:#4c4144}.site-admin-field input,.site-admin-field textarea{width:100%;box-sizing:border-box;border:1px solid #d9ced1;border-radius:12px;padding:12px 13px;font:inherit;background:#fff;outline:none}.site-admin-field textarea{min-height:190px;resize:vertical;line-height:1.6}.site-admin-toggle{display:flex;align-items:center;gap:10px;padding:12px 13px;border:1px solid #e2d7da;border-radius:12px;background:#fff}.site-admin-toggle input{width:18px;height:18px;accent-color:#c9002b}.site-admin-status{min-height:20px;margin-top:10px;font-size:12px;color:#766a6d}.site-admin-status.error{color:#b00020}.site-admin-status.ok{color:#087f4f}.site-admin-side h3{margin:0 0 12px;font-size:15px}.site-admin-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px}.site-admin-stat{padding:16px;border-radius:14px;background:#fff;border:1px solid #eadfe2}.site-admin-stat span{display:block;font-size:11px;color:#7d7175;margin-bottom:8px}.site-admin-stat strong{display:block;font-size:28px;color:#c9002b;font-family:Manrope,system-ui,sans-serif}.site-admin-preview{border:1px solid #eadfe2;border-radius:16px;background:#fff;padding:18px;min-height:190px}.site-admin-preview .preview-label{display:inline-block;padding:4px 8px;border-radius:999px;background:#c9002b;color:#fff;font-size:10px;font-weight:800;margin-bottom:12px}.site-admin-preview strong{display:block;font-size:16px;margin-bottom:8px;word-break:keep-all}.site-admin-preview p{margin:0;font-size:13px;line-height:1.65;color:#6b6063;white-space:pre-line;word-break:keep-all}.site-admin-meta{margin-top:10px;font-size:11px;color:#94878b}.site-admin-hint{margin-top:16px;padding:12px 13px;border-radius:12px;background:#fff0f4;color:#69575d;font-size:11px;line-height:1.55}
      @media(max-width:760px){#siteAdminDialog{width:min(96vw,620px);max-height:94vh;overflow:auto}.site-admin-shell{grid-template-columns:1fr;min-height:0}.site-admin-side{border-left:0;border-top:1px solid #eee3e6}.site-admin-main,.site-admin-side{padding:20px}.site-notice-banner{padding:0 14px}}
    `;
    document.head.appendChild(style);
  }

  function renderPublicNotice() {
    let banner = document.getElementById('siteNoticeBanner');
    if (!banner) {
      banner = document.createElement('section');
      banner.id = 'siteNoticeBanner';
      banner.className = 'site-notice-banner';
      const header = document.querySelector('.topbar');
      if (header) header.insertAdjacentElement('afterend', banner);
      else document.body.prepend(banner);
    }
    const n = state.notice || {};
    const visible = Boolean(n.is_active && (n.title || n.body));
    banner.classList.toggle('is-visible', visible);
    banner.innerHTML = visible ? `<div class="site-notice-inner"><span class="site-notice-badge">공지</span><div class="site-notice-copy"><strong>${esc(n.title || '안내사항')}</strong><p>${esc(n.body || '')}</p></div></div>` : '';
  }

  function ensureGate() {
    let gate = document.getElementById('siteAdminGate');
    if (gate) return gate;
    gate = document.createElement('dialog');
    gate.id = 'siteAdminGate';
    gate.innerHTML = `<form class="site-gate" id="siteAdminGateForm"><div class="site-gate-icon">G</div><h2>관리자 코드</h2><p>공지 편집과 접속 현황은 관리자 인증 후 확인할 수 있습니다.</p><input id="siteGateCode" type="password" inputmode="numeric" autocomplete="off" placeholder="관리자 코드 입력" maxlength="20"><div id="siteGateError" class="site-gate-error"></div><div class="site-gate-actions"><button type="button" class="ghost" id="siteGateCancel">취소</button><button type="submit" class="primary" id="siteGateSubmit">확인</button></div></form>`;
    document.body.appendChild(gate);
    gate.querySelector('#siteGateCancel').addEventListener('click', () => gate.close());
    gate.querySelector('#siteAdminGateForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = gate.querySelector('#siteGateCode');
      const error = gate.querySelector('#siteGateError');
      const submit = gate.querySelector('#siteGateSubmit');
      const code = input.value.trim();
      if (!code) { error.textContent = '관리자 코드를 입력해주세요.'; return; }
      submit.disabled = true;
      error.textContent = '확인 중...';
      try {
        const data = await callApi({ action: 'admin', adminCode: code });
        adminSessionCode = code;
        state.notice = data.notice || state.notice;
        state.stats = data.stats || state.stats;
        input.value = '';
        error.textContent = '';
        gate.close();
        openAdmin();
      } catch (err) {
        error.textContent = err.message || '관리자 코드가 올바르지 않습니다.';
        input.select();
      } finally { submit.disabled = false; }
    });
    return gate;
  }

  function fillAdmin(dialog) {
    const n = state.notice || {};
    dialog.querySelector('#siteNoticeTitle').value = n.title || '';
    dialog.querySelector('#siteNoticeBody').value = n.body || '';
    dialog.querySelector('#siteNoticeActive').checked = Boolean(n.is_active);
    dialog.querySelector('#siteTodayCount').textContent = Number(state.stats.today || 0).toLocaleString('ko-KR');
    dialog.querySelector('#siteTotalCount').textContent = Number(state.stats.total || 0).toLocaleString('ko-KR');
    dialog.querySelector('#sitePreviewTitle').textContent = n.title || '공지 제목이 표시됩니다';
    dialog.querySelector('#sitePreviewBody').textContent = n.body || '입력한 공지 내용이 여기에 미리 표시됩니다.';
    dialog.querySelector('#siteNoticeUpdated').textContent = n.updated_at ? `최근 저장: ${new Date(n.updated_at).toLocaleString('ko-KR')}` : '아직 저장된 공지가 없습니다.';
  }

  function ensureAdminDialog() {
    let dialog = document.getElementById('siteAdminDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'siteAdminDialog';
    dialog.innerHTML = `<div class="site-admin-shell"><section class="site-admin-main"><div class="site-admin-head"><div><p class="eyebrow">SITE ADMIN</p><h2>공지사항 편집</h2></div><button type="button" class="site-admin-close" aria-label="닫기">×</button></div><div class="site-admin-grid"><label class="site-admin-field"><span>공지 제목</span><input type="text" id="siteNoticeTitle" maxlength="80" placeholder="예: 사례관계도 스튜디오 업데이트 안내"></label><label class="site-admin-field"><span>공지 내용</span><textarea id="siteNoticeBody" maxlength="2000" placeholder="사용자에게 보여줄 공지 내용을 입력하세요."></textarea></label><label class="site-admin-toggle"><input type="checkbox" id="siteNoticeActive"><span>사용자 화면에 공지 노출</span></label></div><div class="site-admin-actions"><button type="button" class="ghost" id="siteAdminCancel">닫기</button><button type="button" class="primary" id="siteNoticeSave">공지 저장</button></div><div id="siteAdminStatus" class="site-admin-status"></div></section><aside class="site-admin-side"><h3>접속 현황</h3><div class="site-admin-stats"><div class="site-admin-stat"><span>오늘 방문자</span><strong id="siteTodayCount">0</strong></div><div class="site-admin-stat"><span>누적 방문자</span><strong id="siteTotalCount">0</strong></div></div><h3>공지 미리보기</h3><div class="site-admin-preview"><span class="preview-label">공지</span><strong id="sitePreviewTitle">공지 제목이 표시됩니다</strong><p id="sitePreviewBody">입력한 공지 내용이 여기에 미리 표시됩니다.</p></div><div class="site-admin-meta" id="siteNoticeUpdated"></div><div class="site-admin-hint">방문자는 IP 원문을 저장하지 않고 서버에서 변환한 값으로 중복 집계합니다. 오늘 방문자는 한국시간 기준입니다.</div></aside></div>`;
    document.body.appendChild(dialog);

    const close = () => dialog.close();
    dialog.querySelector('.site-admin-close').addEventListener('click', close);
    dialog.querySelector('#siteAdminCancel').addEventListener('click', close);
    const title = dialog.querySelector('#siteNoticeTitle');
    const body = dialog.querySelector('#siteNoticeBody');
    const updatePreview = () => {
      dialog.querySelector('#sitePreviewTitle').textContent = title.value.trim() || '공지 제목이 표시됩니다';
      dialog.querySelector('#sitePreviewBody').textContent = body.value.trim() || '입력한 공지 내용이 여기에 미리 표시됩니다.';
    };
    title.addEventListener('input', updatePreview);
    body.addEventListener('input', updatePreview);

    dialog.querySelector('#siteNoticeSave').addEventListener('click', async () => {
      const button = dialog.querySelector('#siteNoticeSave');
      const status = dialog.querySelector('#siteAdminStatus');
      if (!adminSessionCode) { dialog.close(); requestAdminAccess(); return; }
      button.disabled = true;
      status.textContent = '저장 중...';
      status.className = 'site-admin-status';
      try {
        const data = await callApi({
          action: 'saveNotice',
          adminCode: adminSessionCode,
          title: title.value,
          body: body.value,
          isActive: dialog.querySelector('#siteNoticeActive').checked,
        });
        state.notice = data.notice || state.notice;
        state.stats = data.stats || state.stats;
        fillAdmin(dialog);
        renderPublicNotice();
        status.textContent = '공지사항을 저장했습니다.';
        status.className = 'site-admin-status ok';
      } catch (err) {
        adminSessionCode = '';
        status.textContent = err.message || '저장에 실패했습니다.';
        status.className = 'site-admin-status error';
      } finally { button.disabled = false; }
    });
    return dialog;
  }

  function openAdmin() {
    const dialog = ensureAdminDialog();
    fillAdmin(dialog);
    dialog.querySelector('#siteAdminStatus').textContent = '';
    if (!dialog.open) dialog.showModal();
  }

  function requestAdminAccess() {
    const gate = ensureGate();
    gate.querySelector('#siteGateCode').value = '';
    gate.querySelector('#siteGateError').textContent = '';
    if (!gate.open) gate.showModal();
    setTimeout(() => gate.querySelector('#siteGateCode').focus(), 30);
  }

  async function init() {
    injectStyles();
    const brandMark = document.querySelector('.brand-mark');
    if (brandMark) {
      brandMark.title = '';
      brandMark.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        requestAdminAccess();
      });
    }
    try {
      const data = await callApi({ action: 'visit' });
      state.notice = data.notice || state.notice;
      renderPublicNotice();
    } catch (err) {
      console.warn('[site-admin] visitor/notice API unavailable', err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
