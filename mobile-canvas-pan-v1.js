(() => {
  const coarsePointer = matchMedia('(hover: none) and (pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const tabletLike = coarsePointer && Math.max(window.innerWidth, window.innerHeight) <= 1600;

  // Tablets such as iPad Pro can report a CSS viewport wider than 1180px in
  // landscape. The old responsive CSS therefore treated them as desktop:
  // the SVG fitted the viewport, there was no scrollable overflow, and the
  // one-finger pan code had nowhere to move. Force the same scroll-canvas
  // behavior used on mobile whenever the primary interaction is touch/coarse.
  if (tabletLike && !document.querySelector('style[data-tablet-canvas-pan]')) {
    document.documentElement.classList.add('touch-canvas-device');
    const style = document.createElement('style');
    style.dataset.tabletCanvasPan = 'v1';
    style.textContent = `
      html.touch-canvas-device .canvas-wrap,
      html.touch-canvas-device .combined-canvas{
        height:clamp(480px,68vh,680px)!important;
        min-height:480px!important;
        max-height:680px!important;
        flex:none!important;
        overflow:auto!important;
        -webkit-overflow-scrolling:touch;
        overscroll-behavior:contain;
        scrollbar-width:thin;
        touch-action:pan-x pan-y;
      }
      html.touch-canvas-device .canvas-wrap svg{
        width:var(--mobile-canvas-width,1200px)!important;
        min-width:var(--mobile-canvas-width,1200px)!important;
        height:var(--mobile-canvas-height,720px)!important;
        min-height:var(--mobile-canvas-height,720px)!important;
        transform:none!important;
      }
      html.touch-canvas-device .combined-canvas svg{
        width:var(--mobile-canvas-width,1400px)!important;
        min-width:var(--mobile-canvas-width,1400px)!important;
        height:var(--mobile-canvas-height,760px)!important;
        min-height:var(--mobile-canvas-height,760px)!important;
      }
      html.touch-canvas-device .node,
      html.touch-canvas-device .combined-resource,
      html.touch-canvas-device .combined-family-copy .node,
      html.touch-canvas-device .combined-line-handle,
      html.touch-canvas-device .junction-handle,
      html.touch-canvas-device .cohabit-resize-handle,
      html.touch-canvas-device .cohabit-move-handle,
      html.touch-canvas-device .cohabit-touch-hit{
        touch-action:none;
      }
      html.touch-canvas-device .mobile-canvas-controls{
        position:sticky;
        left:12px;
        bottom:12px;
        z-index:12;
        display:flex!important;
        align-items:center;
        gap:7px;
        width:min(330px,calc(100vw - 44px));
        margin:-58px 12px 12px auto;
        padding:7px 8px;
        border:1px solid #dfd4d7;
        border-radius:12px;
        background:rgba(255,255,255,.96);
        box-shadow:0 8px 24px rgba(54,31,37,.16);
        backdrop-filter:blur(8px);
      }
      html.touch-canvas-device .tool-actions #zoomOutBtn,
      html.touch-canvas-device .tool-actions #zoomInBtn,
      html.touch-canvas-device .tool-actions #fitBtn,
      html.touch-canvas-device .tool-actions #zoomLabel{
        display:none!important;
      }
      html.touch-canvas-device .canvas-toolbar,
      html.touch-canvas-device .eco-toolbar{
        position:sticky;
        top:0;
        z-index:4;
        background:#fff;
      }
    `;
    document.head.append(style);
  }

  const canvases = [
    { type: 'genogram', svg: document.querySelector('#genogram'), viewport: document.querySelector('#canvasWrap'), width: 1200, height: 720, focusX: 600, focusY: 360 },
    { type: 'combined', svg: document.querySelector('#combinedMap'), viewport: document.querySelector('.combined-canvas'), width: 1400, height: 760, focusX: 640, focusY: 355 }
  ].filter(item => item.svg && item.viewport);

  const interactive = '.node,.combined-resource,[data-line-handle],.junction-handle,.cohabit-move-handle,.cohabit-resize-handle,.cohabit-touch-hit,.mobile-canvas-controls';

  canvases.forEach(({ type, svg, viewport, width, height, focusX, focusY }) => {
    let pan = null;
    let pinch = null;
    let pinchGesture = false;
    let scale = 1;
    let lastTap = null;
    let touchPan = null;
    const pointers = new Map();

    const controls = document.createElement('div');
    controls.className = 'mobile-canvas-controls';
    controls.setAttribute('aria-label', '캔버스 확대 및 축소');
    controls.innerHTML = '<span>축소</span><input type="range" min="60" max="160" step="1" value="100" aria-label="캔버스 확대 축소"><output>100%</output><button type="button" data-canvas-zoom="fit">맞춤</button>';
    viewport.append(controls);

    const applyScale = (next, anchor = null) => {
      const oldWidth = width * scale;
      const oldHeight = height * scale;
      const localX = anchor ? anchor.x - viewport.getBoundingClientRect().left : viewport.clientWidth / 2;
      const localY = anchor ? anchor.y - viewport.getBoundingClientRect().top : viewport.clientHeight / 2;
      const centerX = (viewport.scrollLeft + localX) / oldWidth;
      const centerY = (viewport.scrollTop + localY) / oldHeight;
      scale = Math.max(.6, Math.min(1.6, Math.round(next * 100) / 100));
      svg.style.setProperty('--mobile-canvas-width', `${width * scale}px`);
      svg.style.setProperty('--mobile-canvas-height', `${height * scale}px`);
      controls.querySelector('input').value = Math.round(scale * 100);
      controls.querySelector('output').textContent = `${Math.round(scale * 100)}%`;
      requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0, centerX * width * scale - localX);
        viewport.scrollTop = Math.max(0, centerY * height * scale - localY);
      });
    };
    controls.querySelector('input').addEventListener('input', event => applyScale(Number(event.target.value) / 100));
    controls.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.canvasZoom;
      if (!action) return;
      if (action === 'fit') {
        const fitted = Math.min(1, (viewport.clientWidth - 24) / width, (viewport.clientHeight - 24) / height);
        applyScale(Math.max(.6, Math.floor(fitted * 10) / 10));
        requestAnimationFrame(() => { viewport.scrollLeft = 0; viewport.scrollTop = 0; });
      }
    });

    const centerView = () => {
      if (!viewport.clientWidth) return;
      const desktopFinePointer = matchMedia('(min-width:1181px) and (hover:hover) and (pointer:fine)').matches && !tabletLike;
      if (desktopFinePointer) return;
      viewport.scrollLeft = Math.max(0, focusX * scale - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, focusY * scale - viewport.clientHeight / 2);
    };
    if (type === 'genogram' && tabletLike) requestAnimationFrame(centerView);
    if (type === 'combined') {
      document.addEventListener('studio-mode-change', event => {
        if (event.detail?.mode === 'combined') requestAnimationFrame(centerView);
      });
      document.addEventListener('combined-family-imported', () => requestAnimationFrame(centerView));
      if (document.body.dataset.studioMode === 'combined') setTimeout(centerView, 0);
    }

    viewport.addEventListener('pointerdown', event => {
      if (!['touch', 'pen'].includes(event.pointerType)) return;
      if (event.pointerType !== 'touch' && event.button !== 0) return;
      if (event.target.closest?.('.mobile-canvas-controls')) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), scale };
        pinchGesture = true;
        pan = null;
        viewport.classList.remove('is-touch-panning');
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.target.closest?.(interactive)) return;
      pan = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
        moved: false
      };
      viewport.setPointerCapture?.(event.pointerId);
      viewport.classList.add('is-touch-panning');
    }, true);

    viewport.addEventListener('pointermove', event => {
      if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        event.preventDefault();
        event.stopPropagation();
        applyScale(pinch.scale * distance / pinch.distance, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        return;
      }
      if (!pan || event.pointerId !== pan.pointerId) return;
      const dx = event.clientX - pan.startX;
      const dy = event.clientY - pan.startY;
      if (!pan.moved && Math.hypot(dx, dy) < 5) return;
      pan.moved = true;
      event.preventDefault();
      viewport.scrollLeft = pan.scrollLeft - dx;
      viewport.scrollTop = pan.scrollTop - dy;
    }, { capture: true, passive: false });

    const stop = event => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pinchGesture) {
        event.preventDefault();
        event.stopImmediatePropagation();
        pan = null;
        viewport.classList.remove('is-touch-panning');
        if (!pointers.size) pinchGesture = false;
        return;
      }
      if (!pan || (event.pointerId != null && event.pointerId !== pan.pointerId)) return;
      pan = null;
      viewport.classList.remove('is-touch-panning');
    };
    viewport.addEventListener('pointerup', stop, true);
    viewport.addEventListener('pointercancel', stop, true);

    // Pointer Events can be interrupted by nested SVG handlers on some mobile/tablet browsers.
    // Keep a touch-native fallback so one-finger canvas movement remains available.
    viewport.addEventListener('touchstart', event => {
      if (event.touches.length !== 1 || event.target.closest?.(interactive)) { touchPan = null; return; }
      const touch = event.touches[0];
      touchPan = { startX: touch.clientX, startY: touch.clientY, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop };
    }, { capture: true, passive: true });
    viewport.addEventListener('touchmove', event => {
      if (!touchPan || event.touches.length !== 1) return;
      const touch = event.touches[0];
      event.preventDefault();
      viewport.scrollLeft = touchPan.scrollLeft - (touch.clientX - touchPan.startX);
      viewport.scrollTop = touchPan.scrollTop - (touch.clientY - touchPan.startY);
    }, { capture: true, passive: false });
    const stopTouchPan = () => { touchPan = null; };
    viewport.addEventListener('touchend', stopTouchPan, true);
    viewport.addEventListener('touchcancel', stopTouchPan, true);

    svg.addEventListener('pointerup', event => {
      if (!['touch', 'pen'].includes(event.pointerType) || pinch || pointers.size) return;
      const editable = event.target.closest?.(type === 'genogram' ? '.node[data-id]' : '.combined-resource[data-resource-id]');
      if (!editable) { lastTap = null; return; }
      const key = type === 'genogram' ? editable.dataset.id : editable.dataset.resourceId;
      const now = Date.now();
      if (lastTap?.key === key && now - lastTap.time < 420) {
        event.preventDefault();
        event.stopPropagation();
        lastTap = null;
        if (type === 'genogram' && typeof openPerson === 'function' && typeof state !== 'undefined') openPerson(state.people.find(person => person.id === key));
        else editable.dispatchEvent(new CustomEvent('mobile-double-tap-edit', { bubbles: true, detail: { id: key } }));
      } else lastTap = { key, time: now };
    }, true);
  });
})();
