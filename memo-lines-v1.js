(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const q = (s, root=document) => root.querySelector(s);
  const qa = (s, root=document) => [...root.querySelectorAll(s)];
  let scheduled = false;

  function cleanLine(value) {
    return String(value || '').trim().replace(/^[-•·]\s*/, '').trim();
  }

  function bulletLines(value, maxChars=18, maxLines=4) {
    const source = String(value || '')
      .split(/\r?\n/)
      .map(cleanLine)
      .filter(Boolean);
    const out = [];
    for (const raw of source) {
      let remaining = raw;
      let first = true;
      while (remaining && out.length < maxLines) {
        const room = Math.max(4, maxChars - (first ? 2 : 2));
        let cut = Math.min(room, remaining.length);
        if (remaining.length > room) {
          const near = remaining.slice(0, room + 1).lastIndexOf(' ');
          if (near >= Math.floor(room * .55)) cut = near;
        }
        const chunk = remaining.slice(0, cut).trim();
        remaining = remaining.slice(cut).trim();
        out.push(`${first ? '- ' : '  '}${chunk}`);
        first = false;
      }
      if (out.length >= maxLines) break;
    }
    if (source.length && out.length === maxLines) {
      const joined = source.join(' ');
      const visible = out.join(' ').replace(/^[- ]+/gm, '').length;
      if (joined.length > visible && !out[out.length - 1].endsWith('…')) {
        out[out.length - 1] = out[out.length - 1].replace(/\s*$/, '') + '…';
      }
    }
    return out;
  }

  function svgText(className, y, lines, options={}) {
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('class', className);
    text.setAttribute('y', String(y));
    text.setAttribute('text-anchor', options.anchor || 'middle');
    text.setAttribute('font-size', String(options.size || 10));
    text.setAttribute('font-weight', String(options.weight || 400));
    text.setAttribute('fill', options.fill || '#746a6c');
    text.setAttribute('pointer-events', 'none');
    lines.forEach((line, index) => {
      const tspan = document.createElementNS(SVG_NS, 'tspan');
      tspan.setAttribute('x', options.x == null ? '0' : String(options.x));
      if (index) tspan.setAttribute('dy', String(options.dy || 13));
      tspan.textContent = line;
      text.append(tspan);
    });
    return text;
  }

  function renderGenogramMemos() {
    if (typeof state === 'undefined' || !Array.isArray(state.people)) return;
    const layer = q('#nodeLayer');
    if (!layer) return;
    qa('.node[data-id]', layer).forEach(node => {
      const person = state.people.find(p => p.id === node.dataset.id);
      const memo = String(person?.note || '').trim();
      const signature = memo;
      if (node.dataset.memoLinesSignature === signature) return;
      node.dataset.memoLinesSignature = signature;
      node.querySelector('.node-memo-lines')?.remove();
      if (!memo) return;
      const lines = bulletLines(memo, 20, 5);
      if (!lines.length) return;
      node.append(svgText('node-memo-lines', 88, lines, {size:10, dy:13, fill:'#6f6467'}));
    });
  }

  function resourceRawMap(listSelector, idAttr) {
    const map = new Map();
    qa(listSelector).forEach(item => {
      const id = item.getAttribute(idAttr);
      const small = item.querySelector('small');
      if (id && small) map.set(id, small.textContent || '');
    });
    return map;
  }

  function renderCombinedMemos() {
    const raw = resourceRawMap('#combinedResourceList [data-combined-resource]', 'data-combined-resource');
    qa('#combinedResourceLayer .combined-resource[data-resource-id]').forEach(group => {
      const id = group.getAttribute('data-resource-id');
      const memo = raw.get(id) || '';
      const text = group.querySelector('.resource-note');
      if (!text || text.dataset.memoLinesSignature === memo) return;
      text.dataset.memoLinesSignature = memo;
      if (!memo || memo === '메모 없음') {
        text.textContent = memo || '메모 없음';
        return;
      }
      const lines = bulletLines(memo, 20, 3);
      text.textContent = '';
      text.setAttribute('y', lines.length >= 3 ? '15' : '18');
      lines.forEach((line,index) => {
        const tspan = document.createElementNS(SVG_NS, 'tspan');
        tspan.setAttribute('x','0');
        if (index) tspan.setAttribute('dy','11');
        tspan.textContent = line;
        text.append(tspan);
      });
    });
  }

  function renderEcoMemos() {
    const raw = resourceRawMap('#ecoSystemList [data-eco-list]', 'data-eco-list');
    qa('#ecoNodeLayer .eco-node.system[data-eco-node]').forEach(group => {
      const id = group.getAttribute('data-eco-node');
      const memo = raw.get(id) || '';
      const text = group.querySelector('.eco-resource-note');
      if (!text || text.dataset.memoLinesSignature === memo) return;
      text.dataset.memoLinesSignature = memo;
      if (!memo || memo === '메모 없음') {
        text.textContent = memo || '메모 없음';
        return;
      }
      const lines = bulletLines(memo, 18, 3);
      text.textContent = '';
      text.setAttribute('y', lines.length >= 3 ? '16' : '22');
      lines.forEach((line,index) => {
        const tspan = document.createElementNS(SVG_NS, 'tspan');
        tspan.setAttribute('x','0');
        if (index) tspan.setAttribute('dy','11');
        tspan.textContent = line;
        text.append(tspan);
      });
    });
  }

  function refresh() {
    scheduled = false;
    renderGenogramMemos();
    renderCombinedMemos();
    renderEcoMemos();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  // Let users write memo items naturally as a simple dash list.
  document.addEventListener('keydown', event => {
    const textarea = event.target.closest?.('#personNote,#resourceGridMemo');
    if (!textarea || event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const prefix = before.length === 0 ? '- ' : '\n- ';
    textarea.value = before + prefix + after;
    const caret = before.length + prefix.length;
    textarea.setSelectionRange(caret, caret);
    textarea.dispatchEvent(new Event('input', {bubbles:true}));
  }, true);

  const personMemo = q('#personNote');
  if (personMemo) {
    personMemo.placeholder = '- 주요 내용\n- 추가 내용';
    personMemo.maxLength = Math.max(Number(personMemo.maxLength) || 0, 180);
  }
  const resourceMemo = q('#resourceGridMemo');
  if (resourceMemo) {
    resourceMemo.placeholder = '- 지원 내용\n- 위험 요인\n- 추가 메모';
    resourceMemo.maxLength = Math.max(Number(resourceMemo.maxLength) || 0, 180);
  }

  const observer = new MutationObserver(schedule);
  ['#nodeLayer','#combinedResourceLayer','#combinedResourceList','#ecoNodeLayer','#ecoSystemList']
    .map(selector => q(selector))
    .filter(Boolean)
    .forEach(layer => observer.observe(layer, {childList:true, subtree:true, characterData:true}));

  document.addEventListener('studio-mode-change', schedule);
  document.addEventListener('member-edit-open', () => setTimeout(() => q('#personNote')?.focus?.(), 60));
  schedule();
})();
