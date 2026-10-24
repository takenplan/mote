require('../../../scripts/fixture-background.cjs');
require('../../../scripts/fixture-language.cjs');
const electron=require('electron');
const {app,nativeTheme}=electron;
const {mkdtempSync,writeFileSync,mkdirSync,readFileSync,rmSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {tmpdir}=require('node:os');
const assert=require('node:assert/strict');
const preference=process.env.MOTE_THEME_FIXTURE_PREFERENCE||'auto';
let systemScheme=process.env.MOTE_THEME_FIXTURE_OS||'light',requested='system';
// Inject only the OS appearance input; use the real Electron nativeTheme to render native chrome.
// Never change the user's global macOS appearance.
const fixtureNative=new Proxy(nativeTheme,{get(target,key){if(key==='themeSource')return requested;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},set(target,key,value){if(key==='themeSource'){requested=value;target.themeSource=value==='system'?systemScheme:value;return true;}return Reflect.set(target,key,value,target);}});
const Module=require('node:module'),originalLoad=Module._load;
Module._load=function(request,parent,isMain){const result=originalLoad.call(this,request,parent,isMain);return request==='electron'?{...result,nativeTheme:fixtureNative}:result;};
const profile=process.env.MOTE_THEME_FIXTURE_ROOT||mkdtempSync(join(tmpdir(),'mote-theme-native-'));
if(process.env.MOTE_THEME_FIXTURE_ROOT)assert.equal(readFileSync(join(profile,'fixture-marker'),'utf8'),'synthetic-only');
app.setPath('userData',profile);process.env.MOTE_PROFILE='default';
for(const key of ['MOTE_URL','MOTE_TOKEN','MOTE_ENV_FILE','MOTE_CONFIG_FILE'])delete process.env[key];
const {defaultConfig}=require('../dist/config');
if(!process.env.MOTE_THEME_FIXTURE_RESTART){
writeFileSync(join(profile,'config.json'),JSON.stringify({version:4,config:{...defaultConfig(),serverUrl:'',deviceName:'Generated theme fixture',metadataEnabled:false}}),{mode:0o600});
writeFileSync(join(profile,'storage-format.json'),JSON.stringify({version:4}),{mode:0o600});
writeFileSync(join(profile,'appearance.json'),JSON.stringify(preference),{mode:0o600});
}
const out=resolve(__dirname,'../../../.mote/appearance/electron');mkdirSync(out,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){const deadline=Date.now()+20000;while(Date.now()<deadline){if(await fn())return;await delay(25);}throw Error('Timed out: '+label);}
const timeout=setTimeout(()=>{console.error('Theme native timeout');app.exit(1);},60000);
app.on('browser-window-created',(_event,window)=>{
 const wc=window.webContents,errors=[];
 wc.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);});
 wc.once('did-finish-load',()=>void(async()=>{
  const js=code=>wc.executeJavaScript(code);
  const expected=preference==='auto'?systemScheme:preference;
  await until(()=>js(`Boolean(document.querySelector('#appearance'))&&document.documentElement.dataset.colorScheme===${JSON.stringify(expected)}`),'cold native preload appearance');
  assert.equal(nativeTheme.shouldUseDarkColors,expected==='dark');
  assert.equal(await js('getComputedStyle(document.documentElement).backgroundColor'),expected==='dark'?'rgb(28, 27, 26)':'rgb(247, 245, 241)');
  assert.equal(await js('window.mote.initialAppearance.preference'),preference);
  if(process.env.MOTE_THEME_FIXTURE_RESTART){console.log(JSON.stringify({ok:true,processRestart:true,preference,fixtureOnly:true}));clearTimeout(timeout);app.exit(0);return;}
  await until(()=>js('!document.querySelector("#settings-fields").disabled&&Boolean(document.querySelector(".main-nav [data-nav=records]"))'),'real app ready');
  await js(`document.querySelector('[data-nav=settings]').click()`);
  await until(()=>js(`document.querySelector('#appearance').getClientRects().length>0`),'actual appearance settings');
  await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  writeFileSync(join(out,`${preference}-os-${systemScheme}-settings.png`),(await wc.capturePage()).toPNG());
  wc.debugger.attach('1.3');
  await wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-contrast',value:'more'}]});
  const contrast=await js(`(()=>{const s=getComputedStyle(document.body);return ['ink','muted','control-border','border'].map(role=>s.getPropertyValue('--mote-'+role).trim());})()`);
  assert.ok(contrast[0]);assert.deepEqual(contrast,[contrast[0],contrast[0],contrast[0],contrast[0]],'increased contrast reaches the actual presentation root');
  await wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[]});wc.debugger.detach();
  await js(`document.querySelector('[data-nav=records]').click();document.querySelector('#note-action').click();document.querySelector('#add-dialog [data-add-choice=note]').click()`);
  await until(()=>js(`document.querySelector('#note-text').getClientRects().length>0&&!document.querySelector('#note-text').disabled`),'actual note');
  await js(`window.fixtureDraft=document.querySelector('#note-text');fixtureDraft.value='Generated unsaved theme note';fixtureDraft.dispatchEvent(new Event('input',{bubbles:true}));fixtureDraft.focus();fixtureDraft.setSelectionRange(4,12);window.fixturePage=document.querySelector('.page:not([hidden])');`);
  let loads=0;wc.on('did-finish-load',()=>loads++);
  systemScheme=systemScheme==='dark'?'light':'dark';if(requested==='system')nativeTheme.themeSource=systemScheme;else nativeTheme.emit('updated');
  await delay(100);
  const live=preference==='auto'?systemScheme:preference;
  assert.equal(await js('document.documentElement.dataset.colorScheme'),live);
  assert(await js(`document.querySelector('#note-text')===fixtureDraft&&fixtureDraft.value==='Generated unsaved theme note'&&fixtureDraft.selectionStart===4&&fixtureDraft.selectionEnd===12&&document.activeElement===fixtureDraft&&document.querySelector('.page:not([hidden])')===fixturePage`));
  // The actual Add dialog stays open across acknowledged trusted IPC changes.
  await js(`document.querySelector('#note-action').click();window.fixtureDialog=document.querySelector('#add-dialog');`);
  for(const next of ['dark','light','auto']){
   await js(`window.mote.setAppearance(${JSON.stringify(next)})`);await delay(50);
   assert(await js(`fixtureDialog.open&&document.querySelector('#note-text')===fixtureDraft&&fixtureDraft.value==='Generated unsaved theme note'`));
  }
  await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  writeFileSync(join(out,`${preference}-live-modal.png`),(await wc.capturePage()).toPNG());
  await js(`fixtureDialog.close();document.querySelector('[data-nav=settings]').click()`);
  await js(`(()=>{const s=document.querySelector('#appearance');s.value='dark';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until(()=>js(`document.documentElement.dataset.colorScheme==='dark'&&document.querySelector('#appearance').value==='dark'`),'actual native select');
  assert.equal(JSON.parse(readFileSync(join(profile,'appearance.json'),'utf8')),'dark');
  // An atomic-file write failure leaves the acknowledged preference intact.
  mkdirSync(join(profile,'appearance.json.tmp'));
  await js(`(()=>{const s=document.querySelector('#appearance');s.value='light';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until(()=>js(`!document.querySelector('#appearance-error').hidden`),'save failure surfaced');
  assert.equal(await js(`document.querySelector('#appearance').value`),'dark');assert.equal(nativeTheme.shouldUseDarkColors,true);
  const reloaded=new Promise(resolve=>wc.once('did-finish-load',resolve));wc.reload();await reloaded;await until(()=>js(`Boolean(document.querySelector('#appearance'))&&document.documentElement.dataset.colorScheme==='dark'`),'reload persisted explicit choice');
  assert.equal(loads,1);assert.deepEqual(errors.filter(message=>!message.includes('EISDIR')),[]);
  rmSync(join(profile,'appearance.json.tmp'),{recursive:true,force:true});
  // Persist each original choice through product IPC before the separate-process restart.
  // Auto was just resolved under the opposite OS color; the next process receives the original OS.
  await js(`window.mote.setAppearance(${JSON.stringify(preference)})`);
  await until(()=>js(`document.querySelector('#appearance').value===${JSON.stringify(preference)}`),'original choice persisted for process restart');
  assert.equal(JSON.parse(readFileSync(join(profile,'appearance.json'),'utf8')),preference);
  console.log(JSON.stringify({ok:true,preference,simulatedOS:process.env.MOTE_THEME_FIXTURE_OS,coldPreload:true,nativeChrome:true,increasedContrast:true,actualDraftAndModal:true,saveFailure:true,reload:true,globalOSUnchanged:true,fixtureOnly:true}));
  clearTimeout(timeout);app.exit(0);
 })().catch(error=>{console.error(error.stack||error);app.exit(1);}));
});
require('../dist/main');
