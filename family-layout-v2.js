(() => {
  if(typeof state==='undefined'||typeof els==='undefined')return;
  const q=s=>document.querySelector(s);
  const byId=id=>state.people.find(p=>p.id===id);

  const style=document.createElement('style');
  style.textContent=`
    .cohabit-resize-handle{fill:#fff;stroke:#33272a;stroke-width:2;vector-effect:non-scaling-stroke}
    .cohabit-resize-handle[data-corner="nw"],.cohabit-resize-handle[data-corner="se"]{cursor:nwse-resize}
    .cohabit-resize-handle[data-corner="ne"],.cohabit-resize-handle[data-corner="sw"]{cursor:nesw-resize}
    .cohabit-boundary-v3 .cohabit-hint{font:500 10px IBM Plex Sans KR,sans-serif;fill:#817578}
  `;
  document.head.append(style);

  try{const saved=JSON.parse(localStorage.getItem('genogram-studio'));if(saved?.cohabitBox&&!state.cohabitBox)state.cohabitBox=saved.cohabitBox;}catch{}

  function routeParentGroups(){
    const groups=[...els.relations.querySelectorAll('.parent-group')].map(g=>{
      const ids=(g.dataset.relations||'').split(',').filter(Boolean),links=ids.map(rid=>state.relations.find(r=>r.id===rid)).filter(Boolean),pids=[...new Set(links.map(r=>r.from))],cids=[...new Set(links.map(r=>r.to))],parents=pids.map(byId).filter(Boolean),children=cids.map(byId).filter(Boolean);
      if(!parents.length||!children.length)return null;
      const anchor=parents.reduce((s,p)=>s+p.x,0)/parents.length,py=parents.reduce((s,p)=>s+p.y,0)/parents.length;
      return{g,parents,children,anchor,py};
    }).filter(Boolean).sort((a,b)=>a.anchor-b.anchor);
    groups.forEach((o,index)=>{
      const near=groups.slice(0,index).filter(x=>Math.abs(x.anchor-o.anchor)<120).length,lane=Math.min(Math.min(...o.children.map(c=>c.y))-75,Math.max(...o.parents.map(p=>p.y))+88+near*24),xs=[o.anchor,...o.children.map(c=>c.x)],minX=Math.min(...xs),maxX=Math.max(...xs);let d=`M${o.anchor} ${o.py} V${lane}`;if(maxX-minX>1)d+=` M${minX} ${lane} H${maxX}`;o.children.forEach(c=>{d+=` M${c.x} ${lane} V${c.y}`});o.g.querySelector('.relation.parent')?.setAttribute('d',d);o.g.querySelector('.relation-hit')?.setAttribute('d',d);
    });
  }

  function routeParentChildEmotion(){
    state.relations.filter(r=>r.relationRole==='parent-child-emotional').forEach((r,i)=>{const a=byId(r.from),b=byId(r.to);if(!a||!b)return;const parent=['부','모'].includes(a.role)?a:b,child=parent===a?b:a,g=els.relations.querySelector(`.relation-group[data-relation="${r.id}"]`);if(!g)return;const sign=child.x>=parent.x?1:-1,off=20+(i%3)*7,s={x:parent.x+sign*off,y:parent.y+34},e={x:child.x+sign*off,y:child.y-38},d=r.type==='conflict'?zigzag(s,e):`M${s.x} ${s.y} C${s.x+sign*55} ${s.y+75},${e.x+sign*55} ${e.y-75},${e.x} ${e.y}`;g.querySelector('.relation')?.setAttribute('d',d);g.querySelector('.relation-hit')?.setAttribute('d',d);});
  }

  function autoBox(){const members=state.people.filter(p=>p&&p.life!=='dead'&&['yes','true','1','동거'].includes(String(p.cohabit).toLowerCase()));if(!members.length)return null;const x1=Math.max(8,Math.min(...members.map(p=>p.x))-66),y1=Math.max(8,Math.min(...members.map(p=>p.y))-66),x2=Math.min(1192,Math.max(...members.map(p=>p.x))+66),y2=Math.min(712,Math.max(...members.map(p=>p.y))+100);return{x:x1,y:y1,w:Math.max(140,x2-x1),h:Math.max(120,y2-y1)};}
  function currentBox(){const a=autoBox(),b=state.cohabitBox;if(!a)return null;return b&&[b.x,b.y,b.w,b.h].every(Number.isFinite)?{...b}:a;}
  function drawBox(){
    els.relations.querySelectorAll('.cohabit-boundary,.cohabit-boundary-v2,.cohabit-boundary-v3').forEach(el=>el.remove());const box=currentBox();if(!box)return;const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.setAttribute('class','cohabit-boundary-v3');const rect=document.createElementNS(ns,'rect');rect.setAttribute('x',box.x);rect.setAttribute('y',box.y);rect.setAttribute('width',box.w);rect.setAttribute('height',box.h);rect.setAttribute('rx','10');rect.setAttribute('fill','none');rect.setAttribute('stroke','#33272a');rect.setAttribute('stroke-width','2.5');rect.setAttribute('pointer-events','none');const text=document.createElementNS(ns,'text');text.setAttribute('x',box.x+12);text.setAttribute('y',box.y>24?box.y-8:box.y+18);text.setAttribute('fill','#33272a');text.setAttribute('font-size','12');text.setAttribute('font-weight','700');text.textContent='동거가족';const hint=document.createElementNS(ns,'text');hint.setAttribute('class','cohabit-hint');hint.setAttribute('x',box.x+80);hint.setAttribute('y',box.y>24?box.y-8:box.y+18);hint.textContent='모서리를 드래그해 크기 조절';g.append(rect,text,hint);const corners={nw:[box.x,box.y],ne:[box.x+box.w,box.y],sw:[box.x,box.y+box.h],se:[box.x+box.w,box.y+box.h]};Object.entries(corners).forEach(([corner,[x,y]])=>{const h=document.createElementNS(ns,'rect');h.setAttribute('class','cohabit-resize-handle');h.dataset.corner=corner;h.setAttribute('x',x-5);h.setAttribute('y',y-5);h.setAttribute('width','10');h.setAttribute('height','10');h.setAttribute('rx','2');g.append(h)});els.relations.insertBefore(g,els.relations.firstChild);
  }

  const prevRenderRelations=renderRelations;
  renderRelations=function(){prevRenderRelations();routeParentGroups();routeParentChildEmotion();drawBox();};

  function svgPoint(e){const p=els.svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(els.svg.getScreenCTM().inverse());}
  let resizing=null;
  els.relations.addEventListener('pointerdown',e=>{const h=e.target.closest?.('.cohabit-resize-handle');if(!h)return;e.preventDefault();e.stopPropagation();const b=currentBox();if(!b)return;resizing={corner:h.dataset.corner,start:svgPoint(e),box:{...b},pointerId:e.pointerId};state.cohabitBox={...b};els.svg.setPointerCapture?.(e.pointerId);},true);
  els.svg.addEventListener('pointermove',e=>{if(!resizing)return;e.preventDefault();const p=svgPoint(e),dx=p.x-resizing.start.x,dy=p.y-resizing.start.y,s=resizing.box;let left=s.x,top=s.y,right=s.x+s.w,bottom=s.y+s.h;if(resizing.corner.includes('w'))left+=dx;else right+=dx;if(resizing.corner.includes('n'))top+=dy;else bottom+=dy;const minW=150,minH=120;if(right-left<minW)resizing.corner.includes('w')?left=right-minW:right=left+minW;if(bottom-top<minH)resizing.corner.includes('n')?top=bottom-minH:bottom=top+minH;left=Math.max(8,Math.min(left,1192-minW));top=Math.max(8,Math.min(top,712-minH));right=Math.min(1192,Math.max(right,left+minW));bottom=Math.min(712,Math.max(bottom,top+minH));state.cohabitBox={x:left,y:top,w:right-left,h:bottom-top};drawBox();},true);
  els.svg.addEventListener('pointerup',e=>{if(!resizing)return;e.preventDefault();e.stopPropagation();resizing=null;save();toast('동거가족 테두리 크기를 저장했습니다');},true);
  els.svg.addEventListener('pointercancel',()=>{resizing=null;},true);

  render();
})();