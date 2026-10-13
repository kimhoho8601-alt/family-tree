(() => {
  if(typeof state==='undefined'||typeof render!=='function')return;
  const dialog=document.querySelector('#personDialog'),form=document.querySelector('#personForm');
  if(!dialog||!form)return;
  const style=document.createElement('style');style.textContent=`
    #deleteLineBtn{display:none!important}
    #personDialog:has(.family-quick-add){width:min(940px,calc(100vw - 32px));max-width:940px}
    #personDialog .person-add-layout{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:24px}
    .family-quick-add{background:#fff5f6;border:1px solid #f1d9df;border-radius:16px;padding:20px;align-self:start;margin-top:62px}
    .family-quick-add h3{margin:0 0 8px;font-size:18px}.family-quick-add p{font-size:12px;line-height:1.7;color:#75666b;margin:0 0 16px}
    .family-quick-add label{display:flex;gap:8px;align-items:center;margin:14px 0;font-size:13px;font-weight:600}
    .family-quick-add input[type=checkbox]{width:17px;height:17px;accent-color:#c9002b}
    .family-quick-add select{width:100%;font-size:12px;margin:6px 0 10px}.family-quick-add .button{width:100%;margin-top:12px}
    .cohabit-group-control{display:inline-flex;align-items:center;gap:4px}.cohabit-group-control[hidden]{display:none!important}
    @media(max-width:720px){#personDialog .person-add-layout{grid-template-columns:1fr}.family-quick-add{margin-top:0;padding:16px}}
  `;document.head.append(style);
  const layout=document.createElement('div');layout.className='person-add-layout';form.before(layout);layout.append(form);
  const aside=document.createElement('aside');aside.className='family-quick-add';aside.innerHTML='<h3>빠른추가</h3><p>여러 세대를 한 번에 추가합니다.<br>관계선과 세대 위치도 자동 설정됩니다.</p><span style="font-size:12px;font-weight:600">기준 구성원</span><select id="quickFamilyAnchor" aria-label="빠른추가 기준 구성원"></select><label><input type="checkbox" id="quickFamilyCouple">부부 (부·모)</label><label><input type="checkbox" id="quickFamilyGrandparents">조부모 (친조부·친조모)</label><p>부부는 기준 구성원의 부모로,<br>조부모는 부의 부모로 연결됩니다.</p><button type="button" class="button primary" id="quickFamilyCreate">선택한 가족 추가</button>';layout.append(aside);
  const anchor=aside.querySelector('select'),couple=aside.querySelector('#quickFamilyCouple'),grandparents=aside.querySelector('#quickFamilyGrandparents'),create=aside.querySelector('button');
  function refresh(){
    const previous=anchor.value;anchor.replaceChildren(new Option('연결 없이 새 가족 추가',''));
    state.people.forEach(p=>anchor.add(new Option(p.name||p.role,p.id)));
    const main=state.people.find(p=>p.clientMain)||state.people.find(p=>p.role==='대상자')||state.people[0];
    anchor.value=state.people.some(p=>p.id===previous)?previous:main?.id||'';
    aside.hidden=!!document.querySelector('#personId')?.value;
    create.disabled=!couple.checked&&!grandparents.checked;
  }
  new MutationObserver(refresh).observe(dialog,{attributes:true,attributeFilter:['open']});
  couple.addEventListener('change',()=>create.disabled=!couple.checked&&!grandparents.checked);grandparents.addEventListener('change',()=>create.disabled=!couple.checked&&!grandparents.checked);
  const parentOf=(child,gender)=>child&&state.people.find(p=>p.gender===gender&&state.relations.some(r=>r.type==='parent'&&r.from===p.id&&r.to===child.id));
  create.addEventListener('click',()=>{
    if(!couple.checked&&!grandparents.checked)return;
    const child=state.people.find(p=>p.id===anchor.value);const added=[];
    function person(name,role,gender,x,y){const p={id:id(),name,role,gender,age:'',life:'alive',cohabit:'unknown',note:'',client:false,clientMain:false,x:Math.max(70,Math.min(1130,x)),y};state.people.push(p);added.push(p);return p}
    function link(from,to,type){if(from&&to&&!state.relations.some(r=>r.type===type&&r.from===from.id&&r.to===to.id))state.relations.push({id:id(),from:from.id,to:to.id,type})}
    let father=parentOf(child,'male'),mother=parentOf(child,'female');
    const x=child?.x||600,y=child?.y||540;
    if(couple.checked||grandparents.checked&&child&&!father){father=father||person('부','부','male',x-110,y-170);link(father,child,'parent')}
    if(couple.checked){mother=mother||person('모','모','female',x+110,y-170);link(mother,child,'parent');link(father,mother,'marriage')}
    if(grandparents.checked){const base=father,grandX=base?.x||x,grandY=base?base.y-170:y-340;
      const grandpa=parentOf(base,'male')||person('친조부','조부','male',grandX-100,grandY),grandma=parentOf(base,'female')||person('친조모','조모','female',grandX+100,grandY);
      link(grandpa,grandma,'marriage');link(grandpa,base,'parent');link(grandma,base,'parent');
    }
    // Keep each generation in the drawing area, leaving existing x positions intact.
    const minY=Math.min(...state.people.map(p=>p.y)),maxY=Math.max(...state.people.map(p=>p.y)),span=maxY-minY;
    if(minY<80||maxY>620)state.people.forEach(p=>p.y=80+(p.y-minY)*(span>540?540/span:1));
    if(typeof window.__historySync==='function')window.__historySync();else save();render();dialog.close();activatePanel('editPanel');couple.checked=false;grandparents.checked=false;refresh();toast(added.length?`${added.length}명의 가족과 관계선을 추가했습니다`:'이미 연결된 가족이 있어 그대로 유지했습니다');
  });refresh();
})();
