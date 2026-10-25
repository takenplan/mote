require('../../../scripts/fixture-background.cjs');
require('../../../scripts/fixture-language.cjs');
const {app,ipcMain}=require('electron');
const {mkdtempSync,writeFileSync,rmSync}=require('node:fs');
const {join}=require('node:path');const {tmpdir}=require('node:os');const assert=require('node:assert/strict');
const {defaultConfig}=require('../dist/config');
const handle=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,listener)=>handle(channel,channel==='mote:installed-applications'?()=>[
  {appId:'com.tencent.xinWeChat',appName:'生成微信',appVersion:'4.1.15'},
  {appId:'dev.generated.reader',appName:'生成阅读器',appVersion:'1.2'},
  {appId:'com.google.Chrome',appName:'生成浏览器',appVersion:'1.0'},
]:listener);
const profile=mkdtempSync(join(tmpdir(),'mote-page-ui-'));
app.setPath('userData',profile);process.env.MOTE_PROFILE='default';delete process.env.MOTE_URL;delete process.env.MOTE_TOKEN;delete process.env.MOTE_ENV_FILE;
writeFileSync(join(profile,'config.json'),JSON.stringify({version:4,config:{...defaultConfig(),serverUrl:'',deviceName:'Generated UI page fixture'}}));
writeFileSync(join(profile,'storage-format.json'),JSON.stringify({version:4}),{mode:0o600});
const timer=setTimeout(()=>{console.error('UI page smoke timeout');app.exit(1);},45000);
app.on('browser-window-created',(_,w)=>{
 w.webContents.setBackgroundThrottling(false);
 w.webContents.once('did-finish-load',()=>void(async()=>{
  const js=code=>w.webContents.executeJavaScript(code);
  const settingsIdle=async()=>{for(let n=0;n<200;n++){if(await js("window.mote.status().then(s=>!document.querySelector('#settings-fields').disabled&&!(s.operations??[]).some(job=>job.state==='running'))"))return;await new Promise(r=>setTimeout(r,25));}assert.fail('settings UI did not finish applying configuration');};
      await js("window.confirm=()=>true;true;");
  for(let i=0;i<100;i++){if(await js('!!window.mote'))break;await new Promise(r=>setTimeout(r,50));}
  await js("document.querySelector('[data-nav=privacy]').click()");
  for(let n=0;n<100;n++){if(await js("!!document.querySelector('[data-capture-app=\"com.tencent.xinWeChat\"]')"))break;await new Promise(r=>setTimeout(r,25));}
  assert(await js("document.querySelector('#app-collection-rules').textContent.includes('生成微信')"),'installed apps appear in the actual renderer');
  assert.deepEqual(await js("Array.from(document.querySelectorAll('#default-collection [data-channel]')).map(x=>x.checked)"),[true,false,false]);
  await js("document.querySelector('#ui-page-builtins').click()");
  const rules=await js("JSON.parse(document.querySelector('#ui-page-rules').value)");
  assert.deepEqual(rules,require('@mote/shared').uiRulesSchema.parse(require('../../../adapters/ui/builtin.json')));
  const before=await js('window.mote.status()');
  for(let bits=0;bits<8;bits++){
    const selected={duration:Boolean(bits&1),screenshots:Boolean(bits&2),structured:Boolean(bits&4)};
    await js(`document.querySelectorAll('#default-collection [data-channel]').forEach(x=>x.checked=${JSON.stringify(selected)}[x.dataset.channel]);document.querySelector('#settings').requestSubmit()`);
    for(let n=0;n<100;n++){if(JSON.stringify((await js('window.mote.status()')).config.defaultCollection)===JSON.stringify(selected))break;await new Promise(r=>setTimeout(r,25));}
    const saved=await js('window.mote.status()');assert.deepEqual(saved.config.defaultCollection,selected);assert.equal(saved.running,false);
    await settingsIdle();
  }
  assert.equal(await js('window.mote.status().then(s=>s.queueDepth)'),before.queueDepth,'editing channel choices never samples personal content');
  await js("document.querySelector('#custom-app-id').value='com.google.Chrome';document.querySelector('#add-custom-app-rule').click();document.querySelectorAll('#app-collection-rules [data-channel]').forEach(x=>x.checked=true);document.querySelector('#installed-app-choice').append(new Option('Generated Chrome','com.google.Chrome'));document.querySelector('#installed-app-choice').value='com.google.Chrome';document.querySelector('#exclude-installed-app').disabled=false;document.querySelector('#exclude-installed-app').click()");
  assert.equal(await js("Array.from(document.querySelectorAll('#app-collection-rules [data-channel]')).every(x=>!x.checked)"),true,'excluding an existing app clears every channel');
  assert.equal(await js("document.querySelector('.app-capture-detail .app-capture-identity').textContent"),'com.google.Chrome','exclusion preserves the original app identity');
  await js("document.querySelector('#settings').requestSubmit()");
  for(let n=0;n<100;n++){if((await js('window.mote.status()')).config.appCollectionRules['com.google.Chrome'])break;await new Promise(r=>setTimeout(r,25));}
  assert.deepEqual((await js('window.mote.status()')).config.appCollectionRules['com.google.Chrome'],{duration:false,screenshots:false,structured:false});
  await js("document.querySelector('[data-capture-app=\"com.tencent.xinWeChat\"]').click();const inherit=document.querySelector('[data-app-inherit]');inherit.checked=false;inherit.dispatchEvent(new Event('change',{bubbles:true}));const structured=document.querySelector('.app-capture-detail [data-channel=structured]');structured.checked=true;structured.dispatchEvent(new Event('change',{bubbles:true}));const screenshot=document.querySelector('.app-capture-detail [data-channel=screenshots]');screenshot.checked=false;screenshot.dispatchEvent(new Event('change',{bubbles:true}))");
  const draftBeforePoll=await js("Array.from(document.querySelectorAll('.app-capture-detail [data-channel]')).map(x=>x.checked)");
  await new Promise(r=>setTimeout(r,1200));
  assert.deepEqual(await js("Array.from(document.querySelectorAll('.app-capture-detail [data-channel]')).map(x=>x.checked)"),draftBeforePoll,'status polling preserves independent channel drafts');
  assert(await js("document.querySelector('.app-capture-detail').textContent.includes('macos.wechat.message')"),'built-in rules show their actual source and version');
  await js("document.querySelector('#settings').requestSubmit()");
  for(let n=0;n<100;n++){if((await js('window.mote.status()')).config.appCollectionRules['com.tencent.xinWeChat']?.structured)break;await new Promise(r=>setTimeout(r,25));}
  const savedWechat=(await js('window.mote.status()')).config.appCollectionRules['com.tencent.xinWeChat'];assert.equal(savedWechat.structured,true);assert.equal(savedWechat.screenshots,false);
  await settingsIdle();
  await js("for(const input of document.querySelectorAll('#default-collection [data-channel]')) { input.checked=input.dataset.channel==='duration';input.dispatchEvent(new Event('change',{bubbles:true})); }document.querySelector('#settings').requestSubmit()");
  await settingsIdle();assert.deepEqual((await js('window.mote.status()')).config.defaultCollection,{duration:true,screenshots:false,structured:false});
  await js("document.querySelector('[data-nav=overview]').click();new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  await js("document.querySelector('[data-nav=privacy]').click();document.querySelector('[data-capture-app=\"com.tencent.xinWeChat\"]').click()");
  const screenshots=join(__dirname,'../../../.mote/checks');require('node:fs').mkdirSync(screenshots,{recursive:true});
  w.setContentSize(1180,1250);await js("document.querySelector('#feedback').textContent='';document.querySelector('#feedback').className='';window.scrollTo({top:0,behavior:'instant'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  writeFileSync(join(screenshots,'desktop-app-capture-detail.png'),(await w.webContents.capturePage()).toPNG());
  await js("document.querySelector('[data-nav=records]').click();document.querySelector('#records-source').value='ui_page';document.querySelector('#records-source').dispatchEvent(new Event('change'))");
  await new Promise(r=>setTimeout(r,200));
  assert.equal(await js("document.querySelector('#records-status').getAttribute('aria-busy')"),'false');
  assert((await js("document.querySelector('#records-status').textContent")).includes('0'));
  clearTimeout(timer);console.log('Generated UI page settings / browse smoke passed; capture stayed stopped.');app.exit(0);
 })().catch(error=>{console.error(error);clearTimeout(timer);app.exit(1);}));
});
process.on('exit',()=>rmSync(profile,{recursive:true,force:true}));
require('../dist/main');
