(() => {
  const dialog=document.querySelector('#resourceGridDialog'),form=document.querySelector('#resourceGridForm'),name=document.querySelector('#resourceGridName'),memo=document.querySelector('#resourceGridMemo');
  if(!dialog||!form)return;let commit=null;
  window.openResourceGridEditor=(resource,onSave)=>{commit=onSave;name.value=resource?.name||'';memo.value=resource?.note??resource?.memo??'';dialog.showModal();requestAnimationFrame(()=>name.focus())};
  form.addEventListener('submit',event=>{event.preventDefault();const nextName=name.value.trim();if(!nextName)return;commit?.({name:nextName,memo:memo.value.trim()});commit=null;dialog.close()});
  const close=()=>{commit=null;dialog.close()};document.querySelector('#resourceGridClose').onclick=close;document.querySelector('#resourceGridCancel').onclick=close;
})();
