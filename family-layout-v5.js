(() => {
  if(typeof state==='undefined')return;
  const $=s=>document.querySelector(s);

  function clearTransient(){
    window.__QUICK_PARENT_LIFE__=null;
    delete window.__LAST_QUICK_PARENT_LIFE_CHECK;
    delete window.__LAST_FAMILY_LAYOUT;
  }

  // Preserve multiple target children when editing one person in detail mode.
  let targetSnapshot=[];
  $('#personForm')?.addEventListener('submit',()=>{
    targetSnapshot=state.people.filter(p=>p.role==='대상자').map(p=>p.id);
  },true);
  $('#personForm')?.addEventListener('submit',()=>{
    const editedId=$('#personId')?.value||'';
    const editedRole=$('#personRole')?.value||'';
    state.people.forEach(p=>{
      if(p.id!==editedId&&targetSnapshot.includes(p.id))p.role='대상자';
    });
    if(editedId&&editedRole!=='대상자'){
      const edited=state.people.find(p=>p.id===editedId);
      if(edited)edited.role=editedRole;
    }
    save();render();
  });

  // Save project file including manually adjusted cohabiting boundary.
  const saveBtn=$('#saveProjectBtn');
  if(saveBtn)saveBtn.onclick=()=>{
    if(!state.people.length){toast('저장할 가계도가 없습니다');return;}
    save();
    const data={version:2,savedAt:new Date().toISOString(),people:state.people,relations:state.relations,zoom:state.zoom,cohabitBox:state.cohabitBox||null};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=`가계도_작업파일_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast('작업 파일을 저장했습니다');
  };

  const projectFile=$('#projectFile');
  if(projectFile)projectFile.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data.people)||!Array.isArray(data.relations))throw new Error();
      clearTransient();
      state.people=data.people;
      state.relations=data.relations;
      state.zoom=Number(data.zoom)||1;
      state.cohabitBox=data.cohabitBox&&[data.cohabitBox.x,data.cohabitBox.y,data.cohabitBox.w,data.cohabitBox.h].every(Number.isFinite)?{...data.cohabitBox}:null;
      save();render();activatePanel('editPanel');toast('작업 파일을 불러왔습니다');
    }catch{toast('가계도 작업 파일을 확인해주세요');}
    e.target.value='';
  };

  const reset=$('#resetBtn');
  if(reset)reset.onclick=()=>{
    if(state.people.length&&!confirm('현재 가계도를 모두 지우고 새로 시작할까요?'))return;
    state.people=[];state.relations=[];state.cohabitBox=null;clearTransient();save();render();
  };

  const clear=$('#clearDiagramBtn');
  if(clear)clear.onclick=()=>{
    if(!state.people.length)return;
    if(!confirm('모든 구성원과 연결선을 삭제할까요? 필요하면 되돌리기로 복원할 수 있습니다.'))return;
    state.people=[];state.relations=[];state.cohabitBox=null;clearTransient();save();render();activatePanel('quickPanel');toast('전체 구조를 삭제했습니다');
  };
})();