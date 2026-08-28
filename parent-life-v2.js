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

  function sync(){form.querySelectorAll('#aqParents .aq-parent').forEach(ensureLifeField);}
  new MutationObserver(sync).observe(form,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest('#aqAddFather,#aqAddMother,#aqResetInput,[data-rm]'))requestAnimationFrame(sync);});
  sync();
})();