// NODE_PATH=/path/to/node_modules BROWSER_EXECUTABLE=/path/to/chromium node tests/abuse-relations.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req,res) => {
    const file = path.join(root, new URL(req.url,'http://localhost').pathname === '/' ? 'index.html' : new URL(req.url,'http://localhost').pathname);
    if (!file.startsWith(root + path.sep)) {res.writeHead(403).end();return;}
    fs.readFile(file,(err,data) => {if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE || undefined,args:['--no-sandbox']});
  let checks=0;
  const check=(condition,message)=>{assert.ok(condition,message);checks++;console.log('PASS',message);};
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**',route=>route.abort());
    await page.addInitScript(()=>localStorage.setItem('familyTreeUpdateNotice_20260913_v1','hidden'));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(()=>{
      state.people=[{id:'a',name:'부',gender:'male',role:'부',life:'alive',cohabit:'no',x:250,y:210},{id:'b',name:'대상아동',gender:'female',role:'대상자',client:true,clientMain:true,life:'alive',cohabit:'no',x:850,y:210}];
      state.relations=[{id:'parent-test',type:'parent',from:'a',to:'b'}];save();render();activatePanel('editPanel');
    });
    const open=async()=>{
      await page.locator('#nodeLayer [data-id=a] .shape').click();
      await page.locator('#nodeLayer [data-id=b] .shape').click();
      await page.locator('#lineChoiceDialog[open]').waitFor();
    };
    const choose=type=>page.locator(`label:has([name=popupRelationType][value=${type}])`).click();
    const submit=()=>page.locator('#lineChoiceForm button[type=submit]').click();
    await open();
    check(!await page.locator('#popupAbuseColor').isVisible(),'color controls hidden for structural relations');
    await choose('abuse_physical');
    check(await page.locator('#popupAbuseColor').inputValue()==='black','new abuse relation defaults to black');
    check((await page.locator('#popupAbuseDirection option').allTextContents())[0].includes('가해자: 부 → 피해자: 대상아동'),'named perpetrator/victim direction');
    await page.screenshot({path:'/tmp/abuse-dialog.png'});
    await submit();
    let relations=await page.evaluate(()=>state.relations);
    check(relations.length===2 && relations.some(r=>r.id==='parent-test'),'abuse overlay preserves existing parent link');
    check(await page.locator('#relationLayer .abuse-line').evaluate(n=>getComputedStyle(n).stroke)==='rgb(0, 0, 0)','physical abuse is visibly black');
    check(await page.locator('#relationLayer .abuse-arrow').evaluate(n=>getComputedStyle(n).fill)==='rgb(0, 0, 0)','physical abuse uses filled arrowhead');
    const rid=relations.find(r=>r.type==='abuse_physical').id;
    await open();await choose('abuse_physical');await submit();
    check(await page.locator('#lineChoiceDialog').evaluate(n=>n.open),'duplicate abuse submission stays open');
    check(await page.evaluate(()=>state.relations.length)===2,'duplicate abuse does not create a second line');
    await page.locator('#cancelLineChoice').click();
    // Edit color and reverse arrow direction through the actual edit form.
    await page.locator(`[data-edit-rel="${rid}"]`).click();
    await page.locator('#editAbuseColor').selectOption('red');
    await page.locator('#editAbuseDirection').selectOption('reverse');
    await page.locator('#relationEditForm button[type=submit]').click();
    check(await page.evaluate(id=>{const r=state.relations.find(r=>r.id===id);return r.from==='b'&&r.to==='a'&&r.color==='red'},rid),'edit saves reversed direction and red');
    await page.reload();
    check(await page.locator('#relationLayer .abuse-line').evaluate(n=>getComputedStyle(n).stroke)==='rgb(201, 0, 43)','red persists after reload');
    await open();await choose('abuse_neglect');
    check(await page.locator('#popupAbuseColor').inputValue()==='black','next connection resets color to black');
    await page.locator('#popupAbuseColor').selectOption('blue');await submit();
    check(await page.locator('#relationLayer [data-relation] .abuse-line').evaluateAll(ns=>ns.some(n=>n.style.strokeDasharray.replace(/[,a-z ]/g,'')==='86'&&getComputedStyle(n).stroke==='rgb(37, 99, 235)')),'neglect uses blue dashed line');
    check(await page.evaluate(()=>state.relations.filter(r=>r.type.startsWith('abuse_')).length)===2,'different abuse types coexist');
    // Isolate every type for clear visual and PNG verification.
    const types=['abuse_physical','abuse_emotional','abuse_sexual','abuse_neglect'];
    for(const [i,type] of types.entries()){
      await page.evaluate(({type,i})=>{
        state.relations=[{id:'sample',from:'a',to:'b',type,color:['black','red','blue','black'][i]}];save();render();
      },{type,i});
      check(await page.locator('#relationLayer .abuse-line').count()===1,`${type} renders`);
      check(await page.locator('#relationLayer .abuse-arrow').evaluate((n,filled)=>getComputedStyle(n).fill===(filled?n.style.stroke:'none'),i===0||i===2),`${type} arrowhead shape`);
      if(type==='abuse_sexual') check(await page.locator('#relationLayer .abuse-rail').count()===2,'sexual abuse has two parallel rails');
      // Real application PNG download, then decode and count the requested color pixels.
      const downloadPromise=page.waitForEvent('download');await page.locator('#downloadBtn').click();if(await page.locator('#pngExportPreflightDialog[open]').count()) await page.locator('.export-preflight-action').click();const download=await downloadPromise;
      const output=`/tmp/${type}.png`;await download.saveAs(output);
      const encoded=fs.readFileSync(output).toString('base64');
      const pixels=await page.evaluate(async({encoded,i})=>{
        const image=new Image();image.src='data:image/png;base64,'+encoded;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
        const target=[[0,0,0],[201,0,43],[37,99,235],[0,0,0]][i],data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let count=0;for(let k=0;k<data.length;k+=4)if(target.every((v,j)=>Math.abs(data[k+j]-v)<5)&&data[k+3]>240)count++;return count;
      },{encoded,i});
      check(pixels>100,`${type} PNG keeps chosen color`);
    }
    await page.locator('[data-studio-mode=combined]').click();
    check(await page.locator('#combinedFamilyLayer .abuse-line').count()===1,'combined map includes abuse symbol');
    const dl=page.waitForEvent('download');await page.locator('#downloadBtn').click();if(await page.locator('#pngExportPreflightDialog[open]').count()) await page.locator('.export-preflight-action').click();await (await dl).saveAs('/tmp/abuse-combined.png');
    check(fs.statSync('/tmp/abuse-combined.png').size>1000,'combined map PNG downloads');
    await page.locator('[data-studio-mode=genogram]').click();await page.evaluate(()=>activatePanel('editPanel'));
    await page.locator('[data-edit-rel=sample]').click();await page.locator('#editRelationType').selectOption('parent');
    check(!await page.locator('#editAbuseColor').isVisible(),'color control absent when converting to parent');
    check(await page.locator('#editParentDirection').inputValue()==='','conversion to parent requires explicit direction');
    await page.locator('#editParentDirection').selectOption('reverse');await page.locator('#relationEditForm button[type=submit]').click();
    check(await page.evaluate(()=>{const r=state.relations[0];return r.type==='parent'&&r.from==='b'&&r.to==='a'&&!('color'in r)}),'parent direction conversion still works');
    // Legacy emotional overlay continues to render independently.
    await page.evaluate(()=>{addConnection('a','b','close');addConnection('a','b','abuse_neglect',{color:'black'});});
    check(await page.evaluate(()=>state.relations.length)===3,'parent, emotional and abuse links coexist');
    await page.locator('[data-remove-rel]').last().click();
    check(await page.locator('#relationLayer .abuse-line').count()===0,'abuse deletion works');
    // Responsive dialog at a phone width.
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{pendingConnection={from:'a',to:'b'};els.lineChoiceDialog.showModal()});await choose('abuse_emotional');
    check(await page.locator('#lineChoiceDialog').evaluate(n=>n.scrollWidth<=n.clientWidth),'phone dialog has no horizontal overflow');
    await page.locator('#lineChoiceForm button[type=submit]').scrollIntoViewIfNeeded();
    check(await page.locator('#lineChoiceForm button[type=submit]').isVisible(),'phone can reach submit');
    await submit();
    check(errors.length===0,'no browser script errors');
    console.log(`${checks} checks passed`);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
