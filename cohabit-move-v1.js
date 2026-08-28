(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined') return;

  const ns = 'http://www.w3.org/2000/svg';

  function isCohabit(p) {
    return p && (p.cohabit === true || ['yes','true','1','동거'].includes(String(p.cohabit).toLowerCase()));
  }

  function autoBox() {
    const members = state.people.filter(isCohabit);
    if (!members.length) return null;
    const x1 = Math.max(8, Math.min(...members.map(p => p.x)) - 66);
    const y1 = Math.max(8, Math.min(...members.map(p => p.y)) - 66);
    const x2 = Math.min(1192, Math.max(...members.map(p => p.x)) + 66);
    const y2 = Math.min(712, Math.max(...members.map(p => p.y)) + 100);
    return {x:x1, y:y1, w:Math.max(140, x2-x1), h:Math.max(120, y2-y1)};
  }

  function box() {
    const a = autoBox();
    if (!a) return null;
    const b = state.cohabitBox;
    return b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.w) && Number.isFinite(b.h)
      ? {...b}
      : a;
  }

  function svgPoint(e) {
    const p = els.svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(els.svg.getScreenCTM().inverse());
  }

  function decorate() {
    const g = els.relations.querySelector('.cohabit-boundary-v3');
    if (!g) return;

    const b = box();
    if (!b) return;

    // 기존 메인 사각형은 테두리 자체에서도 드래그 가능하게 유지한다.
    const rect = g.querySelector('rect:not(.cohabit-resize-handle):not(.cohabit-move-handle)');
    if (rect) {
      rect.classList.add('cohabit-move-surface');
      rect.setAttribute('pointer-events', 'stroke');
      rect.style.cursor = 'move';
    }

    // 크기를 작게 줄였을 때 내부가 노드/관계선에 가려져도 이동할 수 있도록
    // 항상 최상단에 독립적인 이동 핸들을 만든다.
    g.querySelectorAll('.cohabit-move-handle,.cohabit-move-label').forEach(el => el.remove());

    const handleW = Math.max(54, Math.min(92, b.w - 28));
    const handleH = 22;
    const handleX = Math.max(b.x + 14, Math.min(b.x + b.w - handleW - 14, b.x + b.w / 2 - handleW / 2));
    const handleY = b.y <= 30 ? b.y + 6 : b.y - 28;

    const handle = document.createElementNS(ns, 'rect');
    handle.setAttribute('class', 'cohabit-move-handle');
    handle.setAttribute('x', handleX);
    handle.setAttribute('y', handleY);
    handle.setAttribute('width', handleW);
    handle.setAttribute('height', handleH);
    handle.setAttribute('rx', '7');
    handle.setAttribute('fill', '#fff');
    handle.setAttribute('stroke', '#33272a');
    handle.setAttribute('stroke-width', '1.5');
    handle.setAttribute('vector-effect', 'non-scaling-stroke');
    handle.setAttribute('pointer-events', 'all');
    handle.style.cursor = 'grab';

    const label = document.createElementNS(ns, 'text');
    label.setAttribute('class', 'cohabit-move-label');
    label.setAttribute('x', handleX + handleW / 2);
    label.setAttribute('y', handleY + 14.5);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '10');
    label.setAttribute('font-weight', '700');
    label.setAttribute('fill', '#33272a');
    label.setAttribute('pointer-events', 'none');
    label.textContent = '↔ 이동';

    const firstResizeHandle = g.querySelector('.cohabit-resize-handle');
    if (firstResizeHandle) {
      g.insertBefore(handle, firstResizeHandle);
      g.insertBefore(label, firstResizeHandle);
    } else {
      g.append(handle, label);
    }

    const title = document.createElementNS(ns, 'title');
    title.textContent = '드래그해서 동거가족 범위 전체 이동';
    handle.append(title);
  }

  const oldRenderRelations = renderRelations;
  renderRelations = function() {
    oldRenderRelations();
    decorate();
  };

  let moving = null;

  function startMove(e) {
    const moveTarget = e.target.closest?.('.cohabit-move-handle,.cohabit-move-surface');
    if (!moveTarget || e.target.closest?.('.cohabit-resize-handle')) return;

    const b = box();
    if (!b) return;

    e.preventDefault();
    e.stopPropagation();
    state.cohabitBox = {...b};
    moving = {start:svgPoint(e), box:{...b}, pointerId:e.pointerId};

    if (moveTarget.classList.contains('cohabit-move-handle')) moveTarget.style.cursor = 'grabbing';
    els.svg.setPointerCapture?.(e.pointerId);
  }

  function move(e) {
    if (!moving || e.pointerId !== moving.pointerId) return;
    e.preventDefault();

    const p = svgPoint(e);
    const dx = p.x - moving.start.x;
    const dy = p.y - moving.start.y;
    const b = moving.box;

    const maxX = Math.max(8, 1192 - b.w);
    const maxY = Math.max(8, 712 - b.h);
    const x = Math.max(8, Math.min(maxX, b.x + dx));
    const y = Math.max(8, Math.min(maxY, b.y + dy));

    state.cohabitBox = {x, y, w:b.w, h:b.h};
    renderRelations();
  }

  function endMove(e) {
    if (!moving || (e.pointerId != null && e.pointerId !== moving.pointerId)) return;
    e.preventDefault?.();
    e.stopPropagation?.();
    moving = null;
    save();
    renderRelations();
    toast('동거가족 범위 위치를 저장했습니다');
  }

  els.relations.addEventListener('pointerdown', startMove, true);
  els.svg.addEventListener('pointermove', move, true);
  els.svg.addEventListener('pointerup', endMove, true);
  els.svg.addEventListener('pointercancel', endMove, true);
  els.svg.addEventListener('lostpointercapture', endMove, true);

  renderRelations();
})();