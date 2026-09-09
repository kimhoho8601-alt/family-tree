(() => {
  const canvases = [
    { svg: document.querySelector('#genogram'), viewport: document.querySelector('#canvasWrap') },
    { svg: document.querySelector('#combinedMap'), viewport: document.querySelector('.combined-canvas') }
  ].filter(item => item.svg && item.viewport);

  const interactive = '.node,.relation-group,.combined-resource,[data-line-handle],.cohabit-boundary-v3,.junction-handle,.cohabit-move-handle,.cohabit-resize-handle';

  canvases.forEach(({ svg, viewport }) => {
    let pan = null;

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
  });
})();
