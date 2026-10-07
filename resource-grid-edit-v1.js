(() => {
  const dialog=document.querySelector('#resourceGridDialog'),form=document.querySelector('#resourceGridForm'),name=document.querySelector('#resourceGridName'),memo=document.querySelector('#resourceGridMemo'),colorField=document.querySelector('#resourceGridColorField'),color=document.querySelector('#resourceGridColor'),relationFields=document.querySelector('#resourceGridRelationFields');
  if(!dialog||!form)return;
  let commit=null,currentTargets=[];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeMemo=value=>String(value??'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>`- ${line.replace(/^[-•·]\s*/, '').trim()}`).join('\n');
  const strengths=[['strong','강한 지지'],['normal','일반·보통'],['weak','약함·취약'],['stress','긴장·갈등']];
  const directions=[['both','상호 교류'],['in','가족에게 유입'],['out','가족에서 자원으로 제공'],['none','방향 표시 없음']];
  const optionsHtml=(items,value)=>items.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('');
  function relationRow(connection={},index=0){
    const targetOptions=currentTargets.map(item=>`<option value="${esc(item.value)}" ${String(item.value)===String(connection.target||'family')?'selected':''}>${esc(item.label)}</option>`).join('');
    return `<div class="resource-relation-row" data-relation-row style="display:grid;grid-template-columns:1.25fr 1fr 1fr auto;gap:12px;align-items:end;margin-top:${index?12:0}px">
      <label><span>연결 대상</span><select data-rel-target>${targetOptions}</select></label>
      <label><span>관계 강도</span><select data-rel-strength>${optionsHtml(strengths,connection.strength||'normal')}</select></label>
      <label><span>자원 흐름</span><select data-rel-direction>${optionsHtml(directions,connection.direction||'both')}</select></label>
      <button type="button" data-rel-remove class="button ghost danger" style="height:52px;padding:0 14px" ${index===0?'disabled title="기본 연결은 삭제할 수 없습니다"':''}>삭제</button>
    </div>`;
  }
  function renderRelations(connections){
    relationFields.innerHTML=`<legend>연결 설정</legend><div id="resourceRelationRows">${connections.map(relationRow).join('')}</div><button type="button" id="resourceAddRelation" class="button soft" style="margin-top:12px;width:100%">＋ 연결 대상 추가</button><p style="margin:8px 2px 0;color:#75696c;font-size:12px">하나의 자원을 여러 가족 구성원 또는 가족 전체와 동시에 연결할 수 있습니다.</p>`;
  }
  function getConnections(){
    return [...relationFields.querySelectorAll('[data-relation-row]')].map(row=>({
      target:row.querySelector('[data-rel-target]')?.value||'family',
      strength:row.querySelector('[data-rel-strength]')?.value||'normal',
      direction:row.querySelector('[data-rel-direction]')?.value||'both'
    }));
  }
  relationFields.addEventListener('click',event=>{
    if(event.target.closest('#resourceAddRelation')){
      const rows=getConnections();rows.push({target:currentTargets[0]?.value||'family',strength:'normal',direction:'both'});renderRelations(rows);return;
    }
    const remove=event.target.closest('[data-rel-remove]');if(!remove||remove.disabled)return;
    const row=remove.closest('[data-relation-row]');row?.remove();
  });
  window.openResourceGridEditor=(resource,onSave,options={})=>{
    commit=onSave;name.value=resource?.name||'';memo.value=normalizeMemo(resource?.note??resource?.memo??'');colorField.hidden=!options.colors;color.value=['black','red','blue'].includes(resource?.color)?resource.color:'black';
    const targets=Array.isArray(options.targets)?options.targets:null;relationFields.hidden=!targets;
    if(targets){
      currentTargets=targets;
      const legacy={target:resource?.target||'family',strength:resource?.strength||'normal',direction:resource?.direction||'both'};
      const connections=Array.isArray(resource?.connections)&&resource.connections.length?resource.connections:[legacy];
      renderRelations(connections);
    } else currentTargets=[];
    dialog.showModal();requestAnimationFrame(()=>{name.focus();if(!memo.value)memo.value='- ';});
  };
  memo.addEventListener('focus',()=>{if(!memo.value.trim())memo.value='- ';requestAnimationFrame(()=>{const end=memo.value.length;memo.setSelectionRange(end,end)})});
  form.addEventListener('submit',event=>{
    event.preventDefault();const nextName=name.value.trim();if(!nextName)return;
    const next={name:nextName,memo:normalizeMemo(memo.value)};
    if(!colorField.hidden)next.color=color.value;
    if(!relationFields.hidden){
      const connections=getConnections();next.connections=connections;
      const primary=connections[0]||{target:'family',strength:'normal',direction:'both'};
      Object.assign(next,primary);
    }
    commit?.(next);commit=null;dialog.close();
  });
  const close=()=>{commit=null;dialog.close()};document.querySelector('#resourceGridClose').onclick=close;document.querySelector('#resourceGridCancel').onclick=close;
})();