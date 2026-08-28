(() => {
  if (typeof state === 'undefined' || typeof els === 'undefined') return;
  const ns = 'http://www.w3.org/2000/svg';
  let decorateQueued = false;

  // -----------------------------
  // Cohabiting boundary movement
  // -----------------------------
  const isCohabit = p => p && (p.cohabit === true || ['yes','true','1','동거'].includes(String(p.cohabit).toLowerCase()));
  function autoBox(){
    const members=state.people.filter(isCohabit); if(!members.length)return null;
    const x1=Math.max(8,Math.min(...members.map(p=>p.x))-66),y1=Math.max(8,Math.min(...members.map(p=>p.y))-66);
    const x2=Math.min(1192,Math.max(...members.map(p=>p.x))+66),y2=Math.min(712,Math.max(...members.map(p=>p.y))+100);
    return{x:x1,y:y1,w:Math.max(140,x2-x1),h:Math.max(120,y2-y1)};
  }
  function box(){const a=autoBox();if(!a)return null;const b=state.cohabitBox;return b&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.w)&&Number.isFinite(b.h)?{...b}:a;}
  function svgPoint(e){const p=els.svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(els.svg.getScreenCTM().inverse());}

  function createHandle(g){
    let handle=g.querySelector('.cohabit-move-handle'),label=g.querySelector('.cohabit-move-label');
    if(!handle){handle=document.createElementNS(ns,'rect');handle.setAttribute('class','cohabit-move-handle');handle.setAttribute('rx','7');handle.setAttribute('fill','#fff');handle.setAttribute('stroke','#33272a');handle.setAttribute('stroke-width','1.5');handle.setAttribute('vector-effect','non-scaling-stroke');handle.setAttribute('pointer-events','all');handle.style.cursor='grab';const title=document.createElementNS(ns,'title');title.textContent='드래그해서 동거가족 범위 전체 이동';handle.append(title);}
    if(!label){label=document.createElementNS(ns,'text');label.setAttribute('class','cohabit-move-label');label.setAttribute('text-anchor','middle');label.setAttribute('font-size','10');label.setAttribute('font-weight','700');label.setAttribute('fill','#33272a');label.setAttribute('pointer-events','none');label.textContent='↔ 이동';}
    g.append(handle,label);return{handle,label};
  }
  function decorate(){
    const g=els.relations.querySelector('.cohabit-boundary-v3');if(!g)return;const b=box();if(!b)return;
    const rect=g.querySelector('rect:not(.cohabit-resize-handle):not(.cohabit-move-handle)');if(rect){rect.classList.add('cohabit-move-surface');rect.setAttribute('pointer-events','stroke');rect.style.cursor='move';}
    const {handle,label}=createHandle(g),handleW=Math.max(64,Math.min(96,Math.max(64,b.w-24))),handleH=22,centerX=b.x+b.w/2;
    const handleX=Math.max(8,Math.min(1192-handleW,centerX-handleW/2)),handleY=b.y>=32?b.y-28:b.y+6;
    handle.setAttribute('x',handleX);handle.setAttribute('y',handleY);handle.setAttribute('width',handleW);handle.setAttribute('height',handleH);label.setAttribute('x',handleX+handleW/2);label.setAttribute('y',handleY+14.5);
  }
  function scheduleDecorate(){if(decorateQueued)return;decorateQueued=true;requestAnimationFrame(()=>{decorateQueued=false;decorate();});}
  const oldRenderRelations=renderRelations;
  renderRelations=function(){oldRenderRelations();decorate();};
  new MutationObserver(mutations=>{for(const m of mutations){for(const n of m.addedNodes){if(n.nodeType===1&&(n.matches?.('.cohabit-boundary-v3')||n.querySelector?.('.cohabit-boundary-v3'))){scheduleDecorate();return;}}}}).observe(els.relations,{childList:true,subtree:false});
  els.svg.addEventListener('pointermove',()=>{const g=els.relations.querySelector('.cohabit-boundary-v3');if(g&&!g.querySelector('.cohabit-move-handle'))scheduleDecorate();},true);

  let moving=null;
  els.relations.addEventListener('pointerdown',e=>{
    const target=e.target.closest?.('.cohabit-move-handle,.cohabit-move-surface');if(!target||e.target.closest?.('.cohabit-resize-handle'))return;
    const b=box();if(!b)return;e.preventDefault();e.stopPropagation();state.cohabitBox={...b};moving={start:svgPoint(e),box:{...b},pointerId:e.pointerId};if(target.classList.contains('cohabit-move-handle'))target.style.cursor='grabbing';els.svg.setPointerCapture?.(e.pointerId);
  },true);
  els.svg.addEventListener('pointermove',e=>{
    if(!moving||e.pointerId!==moving.pointerId)return;e.preventDefault();const p=svgPoint(e),dx=p.x-moving.start.x,dy=p.y-moving.start.y,b=moving.box;
    const x=Math.max(8,Math.min(Math.max(8,1192-b.w),b.x+dx)),y=Math.max(8,Math.min(Math.max(8,712-b.h),b.y+dy));state.cohabitBox={x,y,w:b.w,h:b.h};renderRelations();
  },true);
  function endBoundaryMove(e){if(!moving||(e.pointerId!=null&&e.pointerId!==moving.pointerId))return;e.preventDefault?.();e.stopPropagation?.();moving=null;save();renderRelations();toast('동거가족 범위 위치를 저장했습니다');}
  els.svg.addEventListener('pointerup',endBoundaryMove,true);els.svg.addEventListener('pointercancel',endBoundaryMove,true);els.svg.addEventListener('lostpointercapture',endBoundaryMove,true);

  // -----------------------------
  // PowerPoint-style smart guides
  // -----------------------------
  const style=document.createElement('style');
  style.textContent=`
    .smart-guide-line{stroke:#d9043d;stroke-width:1.4;stroke-dasharray:6 4;vector-effect:non-scaling-stroke;pointer-events:none}
    .smart-guide-spacing{stroke:#d9043d;stroke-width:1.2;stroke-dasharray:3 3;vector-effect:non-scaling-stroke;pointer-events:none}
    .smart-guide-tick{stroke:#d9043d;stroke-width:1.2;vector-effect:non-scaling-stroke;pointer-events:none}
    .smart-guide-text{font:700 10px 'IBM Plex Sans KR',sans-serif;fill:#b00035;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round;pointer-events:none}
  `;document.head.append(style);

  let guideLayer=els.svg.querySelector('#smartGuideLayer');
  if(!guideLayer){guideLayer=document.createElementNS(ns,'g');guideLayer.id='smartGuideLayer';guideLayer.setAttribute('class','smart-guide-layer editor-only');guideLayer.setAttribute('pointer-events','none');els.svg.insertBefore(guideLayer,els.nodes);}
  const clearGuides=()=>{guideLayer.innerHTML='';};
  function guideLine(x1,y1,x2,y2,cls='smart-guide-line'){const l=document.createElementNS(ns,'line');l.setAttribute('x1',x1);l.setAttribute('y1',y1);l.setAttribute('x2',x2);l.setAttribute('y2',y2);l.setAttribute('class',cls);guideLayer.append(l);return l;}
  function guideText(x,y,text){const t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('text-anchor','middle');t.setAttribute('class','smart-guide-text');t.textContent=text;guideLayer.append(t);}
  function horizontalSpacing(xs,y,label='동일 간격'){const sorted=[...xs].sort((a,b)=>a-b),gy=Math.max(24,y-48);guideLine(sorted[0],gy,sorted[sorted.length-1],gy,'smart-guide-spacing');sorted.forEach(x=>guideLine(x,gy-5,x,gy+5,'smart-guide-tick'));guideText((sorted[0]+sorted[sorted.length-1])/2,gy-7,label);}
  function verticalSpacing(ys,x,label='동일 간격'){const sorted=[...ys].sort((a,b)=>a-b),gx=Math.min(1175,x+48);guideLine(gx,sorted[0],gx,sorted[sorted.length-1],'smart-guide-spacing');sorted.forEach(y=>guideLine(gx-5,y,gx+5,y,'smart-guide-tick'));const t=document.createElementNS(ns,'text');t.setAttribute('x',gx+9);t.setAttribute('y',(sorted[0]+sorted[sorted.length-1])/2);t.setAttribute('class','smart-guide-text');t.textContent=label;guideLayer.append(t);}

  const SNAP=12,SPACE=13,ROW_TOL=22;
  function smartSnap(person){
    if(!person)return;clearGuides();const others=state.people.filter(p=>p.id!==person.id);if(!others.length)return;
    let x=person.x,y=person.y,bestX=SNAP+1,bestY=SNAP+1,xRef=null,yRef=null,xLabel='',yLabel='';

    // Parent midpoint gets first priority for children.
    if(['대상자','자녀'].includes(person.role)){
      const parentIds=state.relations.filter(r=>r.type==='parent'&&r.to===person.id).map(r=>r.from),parents=parentIds.map(id=>state.people.find(p=>p.id===id)).filter(Boolean);
      if(parents.length===2){const mid=(parents[0].x+parents[1].x)/2,d=Math.abs(person.x-mid);if(d<=14){x=mid;bestX=d;xRef={x:mid,ys:[...parents.map(p=>p.y),person.y]};xLabel='부모 중앙';}}
    }

    // Equal horizontal spacing: midpoint or same interval extension.
    let hSpace=null;
    for(let i=0;i<others.length;i++)for(let j=i+1;j<others.length;j++){
      const a=others[i],b=others[j];if(Math.abs(a.y-b.y)>ROW_TOL||Math.abs(person.y-(a.y+b.y)/2)>ROW_TOL)continue;
      const left=a.x<=b.x?a:b,right=left===a?b:a,gap=right.x-left.x;if(gap<70)continue;
      const candidates=[(left.x+right.x)/2,left.x-gap,right.x+gap];
      for(const cx of candidates){if(cx<55||cx>1145)continue;const d=Math.abs(person.x-cx);if(d<=SPACE&&(!hSpace||d<hSpace.d))hSpace={d,x:cx,y:(a.y+b.y)/2,a:left,b:right};}
    }
    if(hSpace&&hSpace.d<=bestX+2){x=hSpace.x;y=hSpace.y;bestX=hSpace.d;bestY=Math.min(bestY,Math.abs(person.y-hSpace.y));xRef=null;yRef=null;xLabel='';yLabel='';horizontalSpacing([hSpace.a.x,x,hSpace.b.x],y);}

    // Equal vertical spacing.
    let vSpace=null;
    for(let i=0;i<others.length;i++)for(let j=i+1;j<others.length;j++){
      const a=others[i],b=others[j];if(Math.abs(a.x-b.x)>ROW_TOL||Math.abs(person.x-(a.x+b.x)/2)>ROW_TOL)continue;
      const top=a.y<=b.y?a:b,bottom=top===a?b:a,gap=bottom.y-top.y;if(gap<70)continue;
      const candidates=[(top.y+bottom.y)/2,top.y-gap,bottom.y+gap];
      for(const cy of candidates){if(cy<55||cy>665)continue;const d=Math.abs(person.y-cy);if(d<=SPACE&&(!vSpace||d<vSpace.d))vSpace={d,y:cy,x:(a.x+b.x)/2,a:top,b:bottom};}
    }
    if(vSpace&&vSpace.d<=bestY+2){y=vSpace.y;x=Math.abs(person.x-vSpace.x)<=ROW_TOL?vSpace.x:x;bestY=vSpace.d;yRef=null;verticalSpacing([vSpace.a.y,y,vSpace.b.y],x);}

    // Standard center-to-center alignment.
    others.forEach(o=>{
      const dx=Math.abs(person.x-o.x);if(dx<=SNAP&&dx<bestX){bestX=dx;x=o.x;xRef={x:o.x,ys:[o.y,person.y]};xLabel='가운데 맞춤';}
      const dy=Math.abs(person.y-o.y);if(dy<=SNAP&&dy<bestY){bestY=dy;y=o.y;yRef={y:o.y,xs:[o.x,person.x]};yLabel='수평 맞춤';}
    });

    person.x=Math.max(55,Math.min(1145,x));person.y=Math.max(55,Math.min(665,y));
    if(xRef){const minY=Math.max(18,Math.min(...xRef.ys)-72),maxY=Math.min(702,Math.max(...xRef.ys)+72);guideLine(xRef.x,minY,xRef.x,maxY);guideText(xRef.x+34,minY+14,xLabel||'가운데');}
    if(yRef){const minX=Math.max(18,Math.min(...yRef.xs)-72),maxX=Math.min(1182,Math.max(...yRef.xs)+72);guideLine(minX,yRef.y,maxX,yRef.y);guideText((minX+maxX)/2,yRef.y-9,yLabel||'수평 맞춤');}
  }

  // app.js moves first. This listener runs afterwards and applies the final snap.
  els.svg.addEventListener('pointermove',()=>{
    if(typeof drag==='undefined'||!drag?.p||moving)return;
    smartSnap(drag.p);renderRelations();const node=els.nodes.querySelector(`[data-id="${drag.p.id}"]`);if(node)node.setAttribute('transform',`translate(${drag.p.x} ${drag.p.y})`);
  });
  const clearAfterDrag=()=>clearGuides();
  els.svg.addEventListener('pointerup',clearAfterDrag);els.svg.addEventListener('pointercancel',clearAfterDrag);els.svg.addEventListener('lostpointercapture',clearAfterDrag);
  document.querySelector('#downloadBtn')?.addEventListener('pointerdown',clearGuides,true);

  // Output should contain only the actual cohabiting boundary, not editing guidance.
  // Hide all boundary labels/handles synchronously before the PNG exporter clones the SVG.
  document.querySelector('#downloadBtn')?.addEventListener('click',()=>{
    clearGuides();
    const helpers=[...els.relations.querySelectorAll('.cohabit-boundary-v3 text,.cohabit-resize-handle,.cohabit-move-handle,.cohabit-move-label,.cohabit-hint')];
    const previous=helpers.map(el=>el.style.display);
    helpers.forEach(el=>el.style.display='none');
    requestAnimationFrame(()=>helpers.forEach((el,i)=>{el.style.display=previous[i];}));
  },true);

  renderRelations();
})();