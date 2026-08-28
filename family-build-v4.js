(() => {
  const form=document.querySelector('#quickForm');
  if(!form||typeof state==='undefined')return;
  const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)],byId=(arr,id)=>arr.find(x=>x.id===id);
  const normLife=v=>['alive','dead','unknown'].includes(v)?v:'alive';
  const pairKey=(a,b)=>[a,b].sort().join('|');

  function assigned(card,childUid){const v=q('.aq-parent-target',card)?.value||'';return v==='all'||v===childUid;}
  function validate(){
    const children=qa('#aqChildren .aq-child',form),parents=qa('#aqParents .aq-parent',form),issues=[];
    if(!children.length)issues.push('대상아동을 1명 이상 등록해주세요.');
    children.forEach((c,i)=>{
      const name=q('.aq-name',c)?.value.trim()||`아동 ${i+1}`;
      const fs=parents.filter(p=>p.dataset.kind==='father'&&assigned(p,c.dataset.uid));
      const ms=parents.filter(p=>p.dataset.kind==='mother'&&assigned(p,c.dataset.uid));
      if(fs.length>1)issues.push(`${name}: 부가 ${fs.length}명 부모로 지정되어 있습니다.`);
      if(ms.length>1)issues.push(`${name}: 모가 ${ms.length}명 부모로 지정되어 있습니다. 새엄마는 아동 부모 미연결로 두고 구성원간 관계에서 연결해주세요.`);
    });
    return issues;
  }

  function addAdult(relations,a,b,type){
    if(!a||!b||a.id===b.id||!type||type==='none')return;
    for(let i=relations.length-1;i>=0;i--){const r=relations[i],same=(r.from===a.id&&r.to===b.id)||(r.from===b.id&&r.to===a.id);if(same&&r.type!=='parent')relations.splice(i,1);}
    relations.push({id:id(),from:a.id,to:b.id,type,relationRole:'adult'});
  }

  function adultNeighbors(people,relations,pid){
    return relations.filter(r=>r.type!=='parent'&&r.relationRole!=='parent-child-emotional'&&(r.from===pid||r.to===pid)).map(r=>byId(people,r.from===pid?r.to:r.from)).filter(Boolean);
  }

  function layout(people,relations){
    const children=people.filter(p=>p.role==='대상자'||p.role==='자녀'),parents=people.filter(p=>p.role==='부'||p.role==='모');
    const parentMap=new Map(children.map(ch=>[ch.id,relations.filter(r=>r.type==='parent'&&r.to===ch.id).map(r=>r.from)]));
    const allBio=new Set([...parentMap.values()].flat()),main=children.find(c=>c.clientMain)||children[0],placed=new Set();
    const setPos=(p,x,y=225)=>{if(!p)return;p.x=Math.max(80,Math.min(1120,x));p.y=y;placed.add(p.id);};

    if(main){
      const ids=parentMap.get(main.id)||[],ps=ids.map(pid=>byId(people,pid)).filter(Boolean),father=ps.find(p=>p.role==='부'),mother=ps.find(p=>p.role==='모');
      if(father&&mother){
        const mainSet=new Set(ids);
        const fSteps=[...new Map([...adultNeighbors(people,relations,father.id).filter(p=>['부','모'].includes(p.role)&&p.id!==mother.id&&!mainSet.has(p.id)),...parents.filter(p=>p.role==='모'&&!allBio.has(p.id)&&p.id!==mother.id)].map(p=>[p.id,p])).values()];
        const mSteps=[...new Map([...adultNeighbors(people,relations,mother.id).filter(p=>['부','모'].includes(p.role)&&p.id!==father.id&&!mainSet.has(p.id)),...parents.filter(p=>p.role==='부'&&!allBio.has(p.id)&&p.id!==father.id)].map(p=>[p.id,p])).values()];
        if(fSteps.length&&!mSteps.length){setPos(father,600);setPos(mother,850);fSteps.forEach((p,i)=>setPos(p,350-i*210));}
        else if(mSteps.length&&!fSteps.length){setPos(father,350);setPos(mother,600);mSteps.forEach((p,i)=>setPos(p,850+i*210));}
        else if(fSteps.length&&mSteps.length){setPos(father,500);setPos(mother,700);fSteps.forEach((p,i)=>setPos(p,250-i*170));mSteps.forEach((p,i)=>setPos(p,950+i*170));}
        else{setPos(father,470);setPos(mother,730);}
      }else if(ps.length===1)setPos(ps[0],600);
    }

    const pairs=new Map();parentMap.forEach(ids=>{if(ids.length===2)pairs.set(pairKey(ids[0],ids[1]),ids.slice());});let pi=0;
    pairs.forEach(ids=>{const a=byId(people,ids[0]),b=byId(people,ids[1]);if(!a||!b||(placed.has(a.id)&&placed.has(b.id)))return;if(placed.has(a.id))return setPos(b,a.x+(a.x<600?-250:250));if(placed.has(b.id))return setPos(a,b.x+(b.x<600?-250:250));const center=300+(pi++%3)*300,left=a.role==='부'?a:b.role==='부'?b:a,right=left===a?b:a;setPos(left,center-115);setPos(right,center+115);});
    parents.filter(p=>!placed.has(p.id)).forEach((p,i,arr)=>setPos(p,arr.length===1?600:120+i*(960/Math.max(1,arr.length-1))));

    const groups=new Map();children.forEach(ch=>{const ids=(parentMap.get(ch.id)||[]).slice().sort(),key=ids.length?ids.join('|'):`none:${ch.id}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(ch);});let orphan=0;
    groups.forEach((group,key)=>{if(key.startsWith('none:'))return group.forEach(ch=>{ch.x=200+orphan++*160;ch.y=560;});const ps=key.split('|').map(pid=>byId(people,pid)).filter(Boolean),center=ps.reduce((s,p)=>s+p.x,0)/Math.max(1,ps.length),gap=group.length>2?120:145;group.forEach((ch,i)=>{ch.x=Math.max(80,Math.min(1120,center+(i-(group.length-1)/2)*gap));ch.y=510;});});
  }

  function build(){
    const issues=validate();if(issues.length){alert(`관계 설정을 확인해주세요.\n\n• ${issues.join('\n• ')}`);toast('부모·아동 관계 설정을 확인해주세요');return;}
    if(state.people.length&&!confirm('현재 가계도를 빠른 작성 내용으로 교체할까요?'))return;
    const children=qa('#aqChildren .aq-child',form),parents=qa('#aqParents .aq-parent',form),extras=qa('#aqExtras .aq-extra',form),people=[],relations=[],map=new Map();

    children.forEach((c,i)=>{const p={id:id(),name:q('.aq-name',c)?.value.trim()||`대상아동${i+1}`,role:'대상자',gender:q(`input[name="g-${c.dataset.uid}"]:checked`,c)?.value||'unknown',age:q('.aq-age',c)?.value.trim()||'',life:'alive',cohabit:q('.aq-co',c)?.checked===false?'no':'yes',note:'',x:600,y:510,clientMain:i===0};people.push(p);map.set(c.dataset.uid,p);});
    parents.forEach(c=>{const father=c.dataset.kind==='father',p={id:id(),name:q('.aq-name',c)?.value.trim()||(father?'부':'모'),role:father?'부':'모',gender:father?'male':'female',age:q('.aq-age',c)?.value.trim()||'',life:normLife(q('.aq-life',c)?.value),cohabit:q('.aq-co-sel',c)?.value||'unknown',note:'',x:father?420:780,y:225};people.push(p);map.set(c.dataset.uid,p);});
    extras.forEach((c,i)=>{const role=q('.aq-role',c)?.value||'기타 친척',p={id:id(),name:q('.aq-name',c)?.value.trim()||role,role,gender:q('.aq-sex',c)?.value||'unknown',age:q('.aq-age',c)?.value.trim()||'',life:'alive',cohabit:q('.aq-co-sel',c)?.value||'unknown',note:'',x:140+i*145,y:['조부','조모'].includes(role)?80:role==='자녀'?650:role==='형제·자매'?570:390};people.push(p);map.set(c.dataset.uid,p);});

    parents.forEach(c=>{const target=q('.aq-parent-target',c)?.value||'';if(!target)return;const parent=map.get(c.dataset.uid),targets=target==='all'?children.map(ch=>map.get(ch.dataset.uid)):[map.get(target)].filter(Boolean);targets.forEach(child=>{relations.push({id:id(),from:parent.id,to:child.id,type:'parent'});const emotional=q('.aq-child-rel',c)?.value||'none';if(emotional!=='none')relations.push({id:id(),from:parent.id,to:child.id,type:emotional,relationRole:'parent-child-emotional'});});});
    qa('#aqRels .aq-adultrel',form).forEach(c=>addAdult(relations,map.get(q('.aq-af',c)?.value),map.get(q('.aq-at',c)?.value),q('.aq-type',c)?.value));
    extras.forEach(c=>{const p=map.get(c.dataset.uid),ref=map.get(q('.aq-ref',c)?.value),type=q('.aq-link',c)?.value;if(!p||!ref||!type||type==='none')return;if(type==='parent-of-ref')relations.push({id:id(),from:p.id,to:ref.id,type:'parent'});else if(type==='child-of-ref')relations.push({id:id(),from:ref.id,to:p.id,type:'parent'});else if(type==='sibling-of-ref')relations.filter(r=>r.type==='parent'&&r.to===ref.id).forEach(r=>relations.push({id:id(),from:r.from,to:p.id,type:'parent'}));else addAdult(relations,ref,p,type);});

    layout(people,relations);state.people=people;state.relations=relations;state.zoom=1;state.cohabitBox=null;delete window.__QUICK_PARENT_LIFE__;save();render();activatePanel('editPanel');toast('가계도를 만들었습니다');
  }

  document.addEventListener('submit',e=>{if(e.target!==form)return;e.preventDefault();e.stopImmediatePropagation();build();},true);
})();