(() => {
  const form=document.querySelector('#quickForm');
  if(!form)return;
  const LIFE_OPTIONS='<option value="alive">생존</option><option value="dead">사망</option><option value="unknown">미상</option>';

  function ensureLifeField(card){
    if(!card||card.querySelector('.aq-life'))return;
    const grid=card.querySelector('.aq-box .aq-grid');if(!grid)return;
    const label=document.createElement('label');label.className='aq-field aq-life-field';label.innerHTML=`<span>생존 상태</span><select class="aq-life">${LIFE_OPTIONS}</select>`;
    const co=card.querySelector('.aq-co-sel')?.closest('.aq-field');if(co?.parentElement===grid)grid.insertBefore(label,co);else grid.append(label);
  }

  function syncTargets(){
    const children=[...form.querySelectorAll('#aqChildren .aq-child')].map((c,i)=>({id:c.dataset.uid,name:c.querySelector('.aq-name')?.value.trim()||`아동 ${i+1}`}));
    ['father','mother'].forEach(kind=>{
      const cards=[...form.querySelectorAll(`#aqParents .aq-parent[data-kind="${kind}"]`)];
      cards.forEach((card,index)=>{
        const select=card.querySelector('.aq-parent-target');if(!select)return;
        const old=select.value,touched=card.dataset.stableTargetTouched==='true';
        select.innerHTML=`<option value="">아동 부모로 연결 안 함 · 새부모/배우자</option><option value="all">등록된 모든 아동</option>${children.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}`;
        if(touched&&[...select.options].some(o=>o.value===old))select.value=old;else select.value=index===0?'all':'';
      });
    });
  }

  function sync(){form.querySelectorAll('#aqParents .aq-parent').forEach(ensureLifeField);syncTargets();}

  form.addEventListener('change',e=>{if(e.target.matches('.aq-parent-target')){const card=e.target.closest('.aq-parent');if(card)card.dataset.stableTargetTouched='true';}},true);
  new MutationObserver(()=>requestAnimationFrame(sync)).observe(form,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest('#aqAddFather,#aqAddMother,#aqAddChild,#aqResetInput,[data-rm]'))requestAnimationFrame(sync);});
  form.addEventListener('input',e=>{if(e.target.matches('.aq-name'))requestAnimationFrame(syncTargets);});
  sync();
})();