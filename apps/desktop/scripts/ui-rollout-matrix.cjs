// The entry point is ui-smoke.cjs, which loads fixture-background before Electron.
// This fixture uses the real product renderer, preload, main and generated profile.
const {readFileSync,writeFileSync} = require('node:fs');
const {join,resolve} = require('node:path');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');
const assert = require('node:assert/strict');

module.exports = async function({window,js,navigate,outputDirectory,profile,ipcMain}) {
  const repo=resolve(__dirname,'../../..');
  const digest=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
  const sourceFiles=['apps/desktop/src/index.html','apps/desktop/src/styles.css','apps/desktop/src/art-direction.css','apps/desktop/src/design-tokens.css','apps/desktop/src/ui.ts','packages/shared/design-tokens.json','packages/shared/src/i18n-en.ts','packages/shared/src/i18n.ts'];
  const sourceIdentity=Object.fromEntries(sourceFiles.map(file=>[file,digest(join(repo,file))]));
  const buildIdentity=Object.fromEntries(['main.js','ui-bundle.js','index.html','styles.css','design-tokens.css','art-direction.css'].map(file=>[file,digest(join(__dirname,'../dist',file))]));
  const nativeIdentity=Object.fromEntries(['mote-helper','mote-updater','mote.icns'].map(file=>[file,digest(join(__dirname,'../native/bin',file))]));
  const parentCommit=spawnSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).stdout.trim();
  const workingTreeChanges=spawnSync('git',['status','--porcelain','--','apps/desktop','packages/shared/design-tokens.json'],{cwd:repo,encoding:'utf8'}).stdout;
  const captures=[],journeys=[];
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function until(read,label) { const end=Date.now()+15000; while(Date.now()<end){if(await read())return;await delay(30);}throw Error('Rollout readiness: '+label); }
  const frames=()=>js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  async function ready(page) {
    await until(()=>js('!document.querySelector("#settings-fields").disabled&&Array.from(document.querySelectorAll("[data-page]")).filter(e=>!e.hidden).every(e=>e.dataset.page==='+JSON.stringify(page)+')'),page+' initialized');
    const gates={overview:'#home-recent .content-row',records:'#content-feed .content-row',notes:'#note-text:not(:disabled)',ask:'#ask-disconnected:not([hidden])',settings:'[data-page=settings] .settings-menu',connection:'#connection-onboarding',permissions:'#permission-screen.permission-badge',statistics:'#storage-statistics h2',compression:'#compression-before[src]',about:'#update-version',activity:'#collection-statistics',sources:'#source-list',uploads:'#upload-received',sync:'#sync-policy-help',capture:'#capture-advanced',privacy:'#default-collection',developer:'[data-page=developer] .advanced-settings>summary',screen:'#collection-workbench:not([hidden]),#setup-prompt:not([hidden])'};
    await until(()=>js('(()=>{const e=document.querySelector('+JSON.stringify(gates[page])+');return !!e&&e.getClientRects().length>0;})()'),page+' consumer');
    if(['overview','records'].includes(page))await until(()=>js('document.querySelector("#content-status").getAttribute("aria-busy")==="false"'),page+' content loaded');
    if(page==='compression')await until(()=>js('!document.querySelector("#compression-apply").disabled'),'compression generated');
    return {page,marker:gates[page],ready:true,locale:await js('document.documentElement.lang')};
  }
  function geometry() {
    const footer=document.querySelector('#settings-save-bar'),r=footer.getBoundingClientRect();
    const visible=e=>e.getClientRects().length>0&&!e.closest('[hidden]')&&!e.closest('details:not([open])');
    const bounds=e=>{const b=e.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
    // Inputs intentionally scroll long values and textareas scroll full drafts;
    // their outer bounds must fit, while button labels must fit their controls.
    const clipped=Array.from(document.querySelectorAll('main button,main input,main select,main textarea,dialog[open] button')).filter(visible).filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.left<-.5||b.right>innerWidth+.5||(e.tagName==='BUTTON'&&e.scrollWidth>e.clientWidth+2));}).map(e=>({id:e.id,text:e.textContent.slice(0,80),bounds:bounds(e),scroll:e.scrollWidth,client:e.clientWidth}));
    return {viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},horizontalOverflow:document.documentElement.scrollWidth>innerWidth,clipped,footer:footer.hidden?null:{...bounds(footer),reserved:parseFloat(document.documentElement.style.getPropertyValue('--settings-save-height')),buttons:Array.from(footer.querySelectorAll('button')).map(e=>({text:e.textContent,bounds:bounds(e)}))}};
  }
  async function capture(name,page) {
    const readiness=await ready(page);await frames();
    const layout=await js('('+geometry.toString()+')()');
    assert.equal(layout.horizontalOverflow,false,'No horizontal overflow '+name);
    assert.deepEqual(layout.clipped,[],'Complete controls '+name);
    if(layout.footer){assert(Math.abs(layout.footer.height-layout.footer.reserved)<1,'Actual footer reserved '+name);assert(layout.footer.buttons.every(x=>x.bounds.top>=layout.footer.top&&x.bounds.bottom<=layout.footer.bottom+1),'Footer actions inside '+name);}
    const png=(await window.webContents.capturePage()).toPNG();
    const item={file:name+'.png',name,page,generatedOnly:true,readiness,layout,zoom:window.webContents.getZoomFactor(),bitmap:{width:png.readUInt32BE(16),height:png.readUInt32BE(20)},sha256:createHash('sha256').update(png).digest('hex')};
    writeFileSync(join(outputDirectory,item.file),png);captures.push(item);return item;
  }
  async function changeLanguage(language) {
    if(await js('document.documentElement.lang')===language)return;
    await navigate('settings');const reload=new Promise(resolve=>window.webContents.once('did-finish-load',resolve));
    await js('window.confirm=()=>true;document.querySelector("#language").value='+JSON.stringify(language)+';document.querySelector("#language").dispatchEvent(new Event("change"));true;');
    await reload;await until(()=>js('document.documentElement.lang==='+JSON.stringify(language)+'&&!!document.querySelector("#workspace-location").textContent.trim()'),'locale reload');
    await js('window.confirm=()=>true;true;');
  }
  const original='Generated rollout original  双空格 🐾\n\nA note keeps its exact original, source and time.';
  await navigate('notes');await until(()=>js('!document.querySelector("#note-text").disabled'),'draft');
  await js('document.querySelector("#note-text").value='+JSON.stringify(original)+';document.querySelector("#note-text").dispatchEvent(new Event("input"));document.querySelector("#note-form").requestSubmit();true;');
  await until(()=>js('document.querySelector("#note-text").value===""'),'real note save');
  await navigate('overview');await ready('overview');
  const key=await js('Array.from(document.querySelectorAll("#home-recent .content-row")).find(e=>e.textContent.includes("Generated rollout original")).dataset.contentKey');
  await until(()=>js('window.mote.status().then(s=>!(s.operations??[]).some(j=>j.state==="running"))'),'note finished');
  const pages=['overview','records','notes','ask','settings','connection','sync','capture','privacy','permissions','activity','statistics','developer','about','sources','uploads','screen','compression'];
  for(const language of ['zh-CN','en']) {
    window.webContents.setZoomFactor(1);await changeLanguage(language);
    for(const [variant,width,height,zoom] of [['normal',1140,840,1],['compact',820,620,1],['large',820,620,1.3]]) {
      window.setSize(width,height);window.webContents.setZoomFactor(zoom);await frames();
      for(const page of pages) {
        if(page==='compression')await navigate('capture');
        await navigate(page);await ready(page);
        await js('Array.from(document.querySelectorAll("[data-page]:not([hidden]) details")).forEach(e=>{if(!["home-sync-details","capture-library-tools"].includes(e.id))e.open=true;});window.scrollTo(0,0);true;');
        if(page==='developer')await js('document.querySelector("[data-page=developer] .advanced-settings").open=true;true;');
        if(page==='settings')assert.equal(await js('document.querySelector("#note-action").hidden&&document.querySelector("#settings-save-bar").hidden'),true,'Settings only configuration');
        if(page==='ask') {
          await js('document.querySelector("#ask-disconnected [data-nav=connection]").click();true;');await ready('connection');
          assert.equal(await js('document.querySelector("#workspace-location").textContent.startsWith(document.querySelector("[data-page=ask] h1").textContent.trim())'),true,'Ask origin breadcrumb');
          await js('document.querySelector("#workspace-back").click();true;');await ready('ask');
          journeys.push({name:'actual Ask configuration and original task return',language,variant,verified:true});
        }
        await capture([page,language==='en'?'en':'zh',variant,'top'].join('-'),page);
        await js('window.scrollTo(0,document.documentElement.scrollHeight);true;');await frames();
        const last=await js('(()=>{const els=Array.from(document.querySelectorAll("[data-page]:not([hidden]) button,[data-page]:not([hidden]) input,[data-page]:not([hidden]) select,[data-page]:not([hidden]) textarea")).filter(e=>e.getClientRects().length&&!e.closest("[hidden]")&&!e.closest("details:not([open])"));const e=els.at(-1);if(!e)return null;const b=e.getBoundingClientRect(),f=document.querySelector("#settings-save-bar");return {id:e.id,bottom:b.bottom,footerTop:f.hidden?innerHeight:f.getBoundingClientRect().top};})()');
        if(last)assert(last.bottom<=last.footerTop+1,'Final configuration control is scrollable above footer '+page+' '+variant);
        if(['connection','sync','capture','privacy','permissions','developer','about','sources','uploads','screen','compression'].includes(page))await capture([page,language==='en'?'en':'zh',variant,'end'].join('-'),page);
      }
      await navigate('overview');await js('document.querySelector("#note-action").click();true;');
      assert.equal(await js('document.querySelector("#add-dialog").open&&document.querySelectorAll("#add-dialog [data-add-choice]").length===4'),true,'Shared four-action chooser');
      await capture(['add-chooser',language==='en'?'en':'zh',variant].join('-'),'overview');
      await js('document.querySelector("#add-dialog [data-add-choice=file]").click();true;');await ready('sources');
      await until(()=>js('!document.querySelector("#source-confirmation").hidden&&document.querySelector("#source-selected-names").textContent.includes("synthetic-source.md")'),'generated import selected range');
      await capture(['import',language==='en'?'en':'zh',variant].join('-'),'sources');
      assert.equal(await js('document.querySelector("#source-continuous").checked'),false,'Single file preserves one-time default');
      await js('document.querySelector("#source-selection-cancel").click();true;');assert.equal((await js('window.mote.sources()')).length,0,'Cancel does not create a source');
      journeys.push({name:'shared Add, generated import range and Cancel',language,variant,verified:true});
      await navigate('records');await ready('records');
      await js('document.querySelector('+JSON.stringify('#content-feed [data-content-key="'+key+'"]')+').click();true;');
      await until(()=>js('document.querySelector("#content-detail-dialog").open&&document.querySelector("#content-detail-status").getAttribute("aria-busy")==="false"'),'exact reader');
      assert.equal(await js('document.querySelector("#content-detail-body").textContent'),original,'Exact note original');
      await capture(['reader',language==='en'?'en':'zh',variant].join('-'),'records');
      await js('document.querySelector("#content-processing summary").click();true;');assert.equal(await js('document.querySelectorAll("#content-detail-stages li").length'),4,'Full processing help');
      await js('document.querySelector("#content-detail-close").click();true;');assert.equal(await js('document.activeElement.dataset.contentKey'),key,'Same opener focus');
      journeys.push({name:'exact original, full processing help and Close focus',language,variant,verified:true});
      await navigate('connection');await js('document.querySelector("#device-name").value="Generated unsaved device";document.querySelector("#device-name").dispatchEvent(new Event("input"));true;');await frames();
      await capture(['dirty-footer',language==='en'?'en':'zh',variant].join('-'),'connection');
      await js('window.confirm=()=>false;document.querySelector("#workspace-back").click();true;');assert.equal(await js('document.querySelector("#device-name").value'),'Generated unsaved device','Keep settings draft');
      await js('window.confirm=()=>true;document.querySelector("#workspace-back").click();true;');await navigate('connection');assert.equal(await js('document.querySelector("#device-name").value'),'Synthetic Mac','Discard restores saved config');
      journeys.push({name:'dirty footer, Keep and Discard',language,variant,verified:true});
    }
    window.webContents.setZoomFactor(2);window.setSize(820,620);await frames();
    for(const page of ['overview','notes','connection','privacy','developer']) {await navigate(page);await ready(page);await js('Array.from(document.querySelectorAll("[data-page]:not([hidden]) details")).forEach(e=>e.open=true);window.scrollTo(0,document.documentElement.scrollHeight);true;');await capture([page,language==='en'?'en':'zh','zoom200'].join('-'),page);}
    await navigate('notes');await ready('notes');
    await js('document.querySelector("#note-text").value='+JSON.stringify('Generated real keyboard save '+language)+';document.querySelector("#note-text").dispatchEvent(new Event("input"));document.querySelector("#save-note").scrollIntoView({block:"center"});document.querySelector("#save-note").focus();true;');
    // Emulate renderer focus only for this exact hidden generated window.
    // No native app activation or physical keyboard focus is claimed.
    window.webContents.debugger.attach('1.3');
    try {
      await window.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:true});
      window.webContents.focus();assert.equal(await js('document.activeElement.id'),'save-note','Actual Save keyboard target');
      window.webContents.sendInputEvent({type:'keyDown',keyCode:'Enter'});
      window.webContents.sendInputEvent({type:'char',keyCode:'\r'});
      window.webContents.sendInputEvent({type:'keyUp',keyCode:'Enter'});
      await until(()=>js('document.querySelector("#note-text").value===""'),'200% keyboard Save');
    } finally { await window.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:false});window.webContents.debugger.detach(); }
    journeys.push({name:'true Electron 200% zoom keyboard Save',language,verified:true,zoom:2,hiddenRendererFocusEmulated:true});
  }
  window.webContents.setZoomFactor(1);window.setSize(820,620);await changeLanguage('zh-CN');
  await navigate('notes');await ready('notes');
  const draft='Generated reload draft · 生成草稿';await js('document.querySelector("#note-text").value='+JSON.stringify(draft)+';document.querySelector("#note-text").dispatchEvent(new Event("input"));true;');await delay(400);
  const reload=new Promise(resolve=>window.webContents.once('did-finish-load',resolve));window.webContents.reload();await reload;await navigate('notes');await ready('notes');assert.equal(await js('document.querySelector("#note-text").value'),draft,'Actual renderer reload retains draft');
  await js('document.querySelector("#note-text").value="字".repeat(20001);document.querySelector("#note-text").dispatchEvent(new Event("input"));document.querySelector("#note-form").requestSubmit();true;');
  await until(()=>js('document.querySelector("#note-feedback").textContent.length>0'),'oversize error');await capture('note-validation-error','notes');
  assert.equal(await js('document.querySelector("#note-text").value.length'),20001,'Failed note input retained');
  await js('document.querySelector("#note-text").value="";document.querySelector("#note-text").dispatchEvent(new Event("input"));true;');
  ipcMain.removeHandler('mote:connection-preview');ipcMain.handle('mote:connection-preview',()=>{throw Error('Generated connection preview failure');});
  await navigate('connection');await js('document.querySelector("#connection-input").value="Generated invalid invitation";document.querySelector("#connection-preview").click();true;');
  await until(()=>js('document.querySelector("#connection-state").textContent.includes("Generated")'),'preview error');await capture('connection-preview-error','connection');
  const {Collector}=require('../dist/collector'),originalStatus=Collector.prototype.status;
  Collector.prototype.status=function(){const value=originalStatus.call(this);assert.equal(value.running,false);return {...value,running:true,state:'capturing'};};
  try{window.webContents.send('mote:status',{...(await js('window.mote.status()')),running:true,state:'capturing'});await navigate('capture');await capture('generated-running-settings','capture');assert.equal(await js('document.querySelector("#save-hint").textContent.includes("自动恢复")'),true,'Running save consequence visible');}
  finally{Collector.prototype.status=originalStatus;window.webContents.send('mote:status',await js('window.mote.status()'));}
  await navigate('about');const updateStatus=await js('window.mote.updateStatus()');
  ipcMain.removeHandler('mote:update-check');ipcMain.handle('mote:update-check',()=>({...updateStatus,state:'error',message:'Generated update source unavailable',installReason:'Generated validation error; installation disabled',canInstall:false}));
  await js('document.querySelector("#update-check").click();true;');await until(()=>js('document.querySelector("#update-message").textContent.includes("Generated")'),'generated update error');
  await capture('update-error','about');assert.equal(await js('document.querySelector("#update-install").disabled'),true,'Failed update cannot install');
  await navigate('developer');await js('document.querySelector("[data-page=developer] .advanced-settings").open=true;true;');
  ipcMain.removeHandler('mote:diagnostics-sample');ipcMain.handle('mote:diagnostics-sample',()=>{throw Error('Generated diagnostic sample failure');});
  await js('document.querySelector("#diagnostics-sample").click();true;');await until(()=>js('!document.querySelector("#feedback").hidden'),'generated diagnostic error');await capture('diagnostics-error','developer');
  journeys.push({name:'renderer reload, failed note input, connection error and synthetic running status',verified:true,collectionStarted:false});
  assert.equal((await js('window.mote.status()')).running,false,'No real collection');
  assert.equal((await js('window.mote.sources()')).length,0,'No source import committed');
  await navigate('overview');window.setSize(1140,840);await frames();
  const manifest={platform:'mac',generatedOnly:true,passed:true,parentCommit,workingTreeChanges,sourceIdentity,buildIdentity,nativeIdentity,captures,journeys,boundary:'Hidden real Electron product / temporary generated profile. Native picker and permission responses are generated. Real Electron zoom and key events; no foreground OS focus, personal capture, account, live model or physical device.',profile};
  writeFileSync(join(outputDirectory,'rollout-manifest.json'),JSON.stringify(manifest,null,2));return manifest;
};
