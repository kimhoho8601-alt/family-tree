(() => {
  const canvases = [
    { type: 'genogram', svg: document.querySelector('#genogram'), viewport: document.querySelector('#canvasWrap'), width: 1200, height: 720, focusX: 600, focusY: 360 },
    { type: 'combined', svg: document.querySelector('#combinedMap'), viewport: document.querySelector('.combined-canvas'), width: 1400, height: 760, focusX: 640, focusY: 355 }
  ].filter(item => item.svg && item.viewport);

  const interactive = '.node,.relation-group,.combined-resource,[data-line-handle],.cohabit-boundary-v3,.junction-handle,.cohabit-move-handle,.cohabit-resize-handle,.cohabit-touch-hit,.mobile-canvas-controls';

  canvases.forEach(({ type, svg, viewport, width, height, focusX, focusY }) => {
    let pan = null;
    let scale = 1;
    let lastTap = null;

    const controls = document.createElement('div');
    controls.className = 'mobile-canvas-controls';
    controls.setAttribute('aria-label', '캔버스 확대 및 축소');
    controls.innerHTML = '<span>축소</span><input type="range" min="60" max="160" step="10" value="100" aria-label="캔버스 확대 축소"><output>100%</output><button type="button" data-canvas-zoom="fit">맞춤</button>';
    viewport.append(controls);

    const applyScale = next => {
      const oldWidth = width * scale;
      const oldHeight = height * scale;
      const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / oldWidth;
      const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / oldHeight;
      scale = Math.max(.6, Math.min(1.6, Math.round(next * 10) / 10));
      svg.style.setProperty('--mobile-canvas-width', `${width * scale}px`);
      svg.style.setProperty('--mobile-canvas-height', `${height * scale}px`);
      controls.querySelector('input').value = Math.round(scale * 100);
      controls.querySelector('output').textContent = `${Math.round(scale * 100)}%`;
      requestAnimationFrame(() => {
        viewport.scrollLeft = Math.max(0, centerX * width * scale - viewport.clientWidth / 2);
        viewport.scrollTop = Math.max(0, centerY * height * scale - viewport.clientHeight / 2);
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
      if (!viewport.clientWidth || matchMedia('(min-width:1181px)').matches) return;
      viewport.scrollLeft = Math.max(0, focusX * scale - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, focusY * scale - viewport.clientHeight / 2);
    };
    if (type === 'combined') {
      document.addEventListener('studio-mode-change', event => {
        if (event.detail?.mode === 'combined') requestAnimationFrame(centerView);
      });
      if (document.body.dataset.studioMode === 'combined') setTimeout(centerView, 0);
    }

    svg.addEventListener('pointerdown', event => {
      if (!['touch', 'pen'].includes(event.pointerType) || event.button !== 0) return;
      if (event.target.closest?.(interactive)) return;
      pan = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
        moved: false
      };
      svg.setPointerCapture?.(event.pointerId);
      viewport.classList.add('is-touch-panning');
    }, true);

    svg.addEventListener('pointermove', event => {
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
      if (!pan || (event.pointerId != null && event.pointerId !== pan.pointerId)) return;
      pan = null;
      viewport.classList.remove('is-touch-panning');
    };
    svg.addEventListener('pointerup', stop, true);
    svg.addEventListener('pointercancel', stop, true);

    svg.addEventListener('pointerup', event => {
      if (!['touch', 'pen'].includes(event.pointerType)) return;
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
