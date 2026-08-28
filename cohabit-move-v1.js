(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined') return;

  const ns = 'http://www.w3.org/2000/svg';
  let decorateQueued = false;

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

  function createHandle(g) {
    let handle = g.querySelector('.cohabit-move-handle');
    let label = g.querySelector('.cohabit-move-label');

    if (!handle) {
      handle = document.createElementNS(ns, 'rect');
      handle.setAttribute('class', 'cohabit-move-handle');
      handle.setAttribute('rx', '7');
      handle.setAttribute('fill', '#fff');
      handle.setAttribute('stroke', '#33272a');
      handle.setAttribute('stroke-width', '1.5');
      handle.setAttribute('vector-effect', 'non-scaling-stroke');
      handle.setAttribute('pointer-events', 'all');
      handle.style.cursor = 'grab';

      const title = document.createElementNS(ns, 'title');
      title.textContent = '드래그해서 동거가족 범위 전체 이동';
      handle.append(title);
    }

    if (!label) {
      label = document.createElementNS(ns, 'text');
      label.setAttribute('class', 'cohabit-move-label');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('font-weight', '700');
      label.setAttribute('fill', '#33272a');
      label.setAttribute('pointer-events', 'none');
      label.textContent = '↔ 이동';
    }

    if (!handle.parentNode) g.append(handle);
    if (!label.parentNode) g.append(label);

    // 이동 버튼은 항상 마지막에 두어 resize 과정에서 다른 요소에 가려지지 않게 한다.
    g.append(handle, label);
    return {handle, label};
  }

  function decorate() {
    const g = els.relations.querySelector('.cohabit-boundary-v3');
    if (!g) return;

    const b = box();
    if (!b) return;

    const rect = g.querySelector('rect:not(.cohabit-resize-handle):not(.cohabit-move-handle)');
    if (rect) {
      rect.classList.add('cohabit-move-surface');
      rect.setAttribute('pointer-events', 'stroke');
      rect.style.cursor = 'move';
    }

    const {handle, label} = createHandle(g);

    // 박스가 최소 크기여도 버튼 자체는 64px 이상 유지한다.
    const handleW = Math.max(64, Math.min(96, Math.max(64, b.w - 24)));
    const handleH = 22;
    const centerX = b.x + b.w / 2;
    let handleX = centerX - handleW / 2;
    handleX = Math.max(8, Math.min(1192 - handleW, handleX));

    // 상단 여유가 없을 때만 박스 안쪽 상단에 표시한다.
    const handleY = b.y >= 32 ? b.y - 28 : b.y + 6;

    handle.setAttribute('x', handleX);
    handle.setAttribute('y', handleY);
    handle.setAttribute('width', handleW);
    handle.setAttribute('height', handleH);

    label.setAttribute('x', handleX + handleW / 2);
    label.setAttribute('y', handleY + 14.5);
  }

  function scheduleDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    requestAnimationFrame(() => {
      decorateQueued = false;
      decorate();
    });
  }

  // 일반 렌더 경로에서는 즉시 이동 버튼을 복원한다.
  const oldRenderRelations = renderRelations;
  renderRelations = function() {
    oldRenderRelations();
    decorate();
  };

  // family-layout-v2의 resize 로직은 renderRelations()를 거치지 않고
  // drawCohabitBox()만 직접 호출한다. 그 과정에서 boundary 그룹 전체가 새로 생성되어
  // 이동 버튼이 사라졌었다. DOM 교체를 감시해 새 그룹이 생기는 즉시 버튼을 다시 붙인다.
  const observer = new MutationObserver(mutations => {
    let boundaryChanged = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('.cohabit-boundary-v3') || node.querySelector?.('.cohabit-boundary-v3')) {
          boundaryChanged = true;
          break;
        }
      }
      if (boundaryChanged) break;
    }
    if (boundaryChanged) scheduleDecorate();
  });
  observer.observe(els.relations, {childList:true, subtree:false});

  // resize 중에는 매 pointermove 뒤에도 한 번 확인한다.
  // 기존 resize listener가 먼저 실행된 뒤 이 listener가 실행되므로 새 boundary에 바로 버튼을 복원한다.
  els.svg.addEventListener('pointermove', () => {
    const g = els.relations.querySelector('.cohabit-boundary-v3');
    if (g && !g.querySelector('.cohabit-move-handle')) scheduleDecorate();
  }, true);

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