(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined') return;

  const ns='http://www.w3.org/2000/svg';

  function isCohabit(p){return p && (p.cohabit===true || ['yes','true','1','동거'].includes(String(p.cohabit).toLowerCase()));}
  function autoBox(){
    const members=state.people.filter(isCohabit);
    if(!members.length)return null;
    const x1=Math.max(8,Math.min(...members.map(p=>p.x))-66),y1=Math.max(8,Math.min(...members.map(p=>p.y))-66);
    const x2=Math.min(1192,Math.max(...members.map(p=>p.x))+66),y2=Math.min(712,Math.max(...members.map(p=>p.y))+100);
    return{x:x1,y:y1,w:Math.max(140,x2-x1),h:Math.max(120,y2-y1)};
  }
  function box(){const a=autoBox();if(!a)return null;const b=state.cohabitBox;return b&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.w)&&Number.isFinite(b.h)?{...b}:a;}
  function svgPoint(e){const p=els.svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(els.svg.getScreenCTM().inverse());}
  function decorate(){
    const g=els.relations.querySelector('.cohabit-boundary-v3');
    if(!g)return;
    const rect=g.querySelector('rect:not(.cohabit-resize-handle)');
    if(!rect)return;
    rect.classList.add('cohabit-move-surface');
    rect.setAttribute('pointer-events','all');
    rect.style.cursor='move';
    if(!g.querySelector('.cohabit-move-title')){
      const t=document.createElementNS(ns,'title');t.setAttribute('class','cohabit-move-title');t.textContent='테두리 내부를 드래그해 동거가족 범위 이동';rect.append(t);
    }
  }
  const oldRenderRelations=renderRelations;
  renderRelations=function(){oldRenderRelations();decorate();};

  let moving=null;
  els.relations.addEventListener('pointerdown',e=>{
    const surface=e.target.closest?.('.cohabit-move-surface');
    if(!surface||e.target.closest?.('.cohabit-resize-handle'))return;
    const b=box();if(!b)return;
    e.preventDefault();e.stopPropagation();
    state.cohabitBox={...b};
    moving={start:svgPoint(e),box:{...b},pointerId:e.pointerId};
    els.svg.setPointerCapture?.(e.pointerId);
  },true);

  els.svg.addEventListener('pointermove',e=>{
    if(!moving)return;
    e.preventDefault();
    const p=svgPoint(e),dx=p.x-moving.start.x,dy=p.y-moving.start.y,b=moving.box;
    const x=Math.max(8,Math.min(1192-b.w,b.x+dx));
    const y=Math.max(8,Math.min(712-b.h,b.y+dy));
    state.cohabitBox={x,y,w:b.w,h:b.h};
    renderRelations();
  },true);

  els.svg.addEventListener('pointerup',e=>{
    if(!moving)return;
    e.preventDefault();e.stopPropagation();moving=null;save();toast('동거가족 범위 위치를 저장했습니다');
  },true);

  renderRelations();
})();