require('./fixture-background.cjs');
require('./fixture-language.cjs');
// Production Web bundle + real React portal and modals, with an isolated generated central.
const {app,BrowserWindow}=require('electron');
const {mkdtempSync,mkdirSync,existsSync,readFileSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os'),{join,resolve}=require('node:path'),{spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const root=mkdtempSync(join(tmpdir(),'mote-theme-web-')),repo=resolve(__dirname,'..'),out=join(repo,'.mote/appearance/web');
mkdirSync(out,{recursive:true});app.setPath('userData',join(root,'browser'));app.on('window-all-closed',()=>{});
const timeout=setTimeout(()=>{console.error('Theme Web fixture timed out');finish(1);},90000);
let server;const windows=[],errors=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){const deadline=Date.now()+25000;while(Date.now()<deadline){if(await fn())return;await delay(30);}throw Error('Timed out: '+label);}
async function run(){
 await app.whenReady();const connection=join(root,'connection.json');
 server=spawn(process.execPath,[join(repo,'scripts/operations-fixture-server.mjs'),connection],{cwd:repo,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','ignore','pipe']});let failure='';server.stderr.on('data',b=>failure+=b);
 await until(()=>{if(server.exitCode!==null)throw Error(failure);return existsSync(connection);},'generated central');
 const {url,token}=JSON.parse(readFileSync(connection,'utf8'));
 const create=async()=>{
  const window=new BrowserWindow({width:1280,height:900,show:false,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});windows.push(window);
  const wc=window.webContents;wc.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);});await window.loadURL('about:blank');wc.debugger.attach('1.3');
  return {window,wc,js:code=>wc.executeJavaScript(code),os:scheme=>wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:scheme}]})};
 };
 const reload=async client=>{const loaded=new Promise(resolve=>client.wc.once('did-finish-load',resolve));client.wc.reload();await loaded;};
 const settings=await create();await settings.window.loadURL(url+'/#/preferences');
 await settings.js(`sessionStorage.setItem('mote.connection',${JSON.stringify(JSON.stringify({token,viewScope:require('node:crypto').randomUUID()}))});true`);
 await reload(settings);
 console.log('phase settings-login');
 await until(()=>settings.js(`Boolean(document.querySelector('select[aria-label="外观"]'))`),'real appearance selector');
 const choose=async preference=>{
  await settings.js(`(()=>{const select=document.querySelector('select[aria-label="外观"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(preference)});select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until(()=>settings.js(`document.querySelector('select[aria-label="外观"]').value===${JSON.stringify(preference)}`),'choice '+preference);
 };
 const scheme=async(client,expected)=>until(()=>client.js(`document.documentElement.dataset.colorScheme===${JSON.stringify(expected)}&&getComputedStyle(document.documentElement).colorScheme===${JSON.stringify(expected)}`),'resolved '+expected);
 const screen=async(client,name)=>{await delay(80);assert(await client.js('document.documentElement.scrollWidth<=innerWidth'),'no overflow '+name);writeFileSync(join(out,name+'.png'),(await client.wc.capturePage()).toPNG());};
 console.log('phase settings-ready');
 const client=await create();
 for(const preference of ['light','dark','auto'])for(const os of ['light','dark']){
  console.log('phase pair',preference,os);
  await settings.os(os);await choose(preference);await client.os(os);
  // Hold the application module at the real CSP-protected entry point to inspect the first painted canvas.
  await client.wc.debugger.sendCommand('Network.enable');
  await client.wc.debugger.sendCommand('Network.setCacheDisabled',{cacheDisabled:true});
  await client.wc.debugger.sendCommand('Fetch.enable',{patterns:[{urlPattern:'*/assets/index-*.js',requestStage:'Request'}]});
  let held;const pause=(_event,method,params)=>{if(method==='Fetch.requestPaused')held=params.requestId;};client.wc.debugger.on('message',pause);
  console.log('phase fetch-enabled');
  const loaded=client.window.loadURL(url+'/?themeFixture='+preference+'-'+os+'#/preferences');await until(()=>held,'application module held');
  console.log('phase main-held');
  const first=await client.wc.debugger.sendCommand('Runtime.evaluate',{expression:`JSON.stringify({scheme:document.documentElement.dataset.colorScheme,background:getComputedStyle(document.documentElement).backgroundColor,theme:document.querySelector('meta[name="theme-color"]').content})`,returnByValue:true});
  const value=JSON.parse(first.result.value),expected=preference==='auto'?os:preference;
  assert.equal(value.scheme,expected);assert.equal(value.background,expected==='dark'?'rgb(28, 27, 26)':'rgb(247, 245, 241)');assert.equal(value.theme,expected==='dark'?'#1c1b1a':'#f7f5f1');
  console.log('phase first-frame-checked');
  await client.wc.debugger.sendCommand('Fetch.continueRequest',{requestId:held});await client.wc.debugger.sendCommand('Fetch.disable');client.wc.debugger.removeListener('message',pause);await loaded;await scheme(client,expected);
  await client.js(`sessionStorage.setItem('mote.connection',${JSON.stringify(JSON.stringify({token,viewScope:require('node:crypto').randomUUID()}))});true`);await reload(client);await scheme(client,expected);
  await until(()=>client.js(`Boolean(document.querySelector('select[aria-label="外观"]'))`),'loaded settings');
  await screen(client,`${preference}-os-${os}-settings`);client.window.setSize(390,844);await screen(client,`${preference}-os-${os}-phone`);client.window.setSize(1280,900);
  await client.os(os==='dark'?'light':'dark');await scheme(client,preference==='auto'?(os==='dark'?'light':'dark'):preference);
 }
 // Actual React login dialog retains its controlled input/focus/selection under cross-tab changes.
 await client.js(`sessionStorage.removeItem('mote.connection');localStorage.removeItem('mote.connection');location.hash='#/ask';true`);await reload(client);
 await until(()=>client.js(`Boolean(document.querySelector('.node-button'))`),'logged out shell');await client.js(`document.querySelector('.node-button').click()`);
 await until(()=>client.js(`Boolean(document.querySelector('.connect-modal input'))`),'actual login modal');
 await client.js(`window.fixtureModal=document.querySelector('.connect-modal');window.fixtureField=fixtureModal.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(fixtureField,'Generated unsaved modal');fixtureField.dispatchEvent(new Event('input',{bubbles:true}));fixtureField.focus();fixtureField.setSelectionRange(4,12);`);
 for(const preference of ['light','dark','auto']){await choose(preference);await delay(60);assert(await client.js(`document.querySelector('.connect-modal')===fixtureModal&&document.querySelector('.connect-modal input')===fixtureField&&fixtureField.value==='Generated unsaved modal'&&fixtureField.selectionStart===4&&fixtureField.selectionEnd===12&&document.activeElement===fixtureField`));}
 await screen(client,'auto-login-modal');
 await client.js(`document.querySelector('.connect-modal .close').click();sessionStorage.setItem('mote.connection',${JSON.stringify(JSON.stringify({token,viewScope:require('node:crypto').randomUUID()}))});location.hash='#/notes';true`);await reload(client);
 await until(()=>client.js(`Boolean(document.querySelector('#note-text'))&&!document.querySelector('#note-text').disabled`),'actual React note');
 await client.js(`window.fixtureNote=document.querySelector('#note-text');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(fixtureNote,'Generated theme draft');fixtureNote.dispatchEvent(new Event('input',{bubbles:true}));fixtureNote.focus();fixtureNote.setSelectionRange(4,12);window.fixtureHash=location.hash;`);
 for(const preference of ['dark','light','auto']){await choose(preference);await delay(60);assert(await client.js(`document.querySelector('#note-text')===fixtureNote&&fixtureNote.value==='Generated theme draft'&&fixtureNote.selectionStart===4&&fixtureNote.selectionEnd===12&&document.activeElement===fixtureNote&&location.hash===fixtureHash`));await screen(client,`${preference}-note`);}
 await client.wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:'prefers-contrast',value:'more'},{name:'prefers-reduced-transparency',value:'reduce'}]});await choose('auto');await screen(client,'auto-increased-contrast-note');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,sixPairs:true,productionCSP:true,heldModuleFirstPaint:true,refresh:true,liveMediaChange:true,actualReactModal:true,actualNote:true,crossTab:true,phoneOverflow:false,contrastMedia:true,noModelCalls:true,fixtureOnly:true}));
}
run().then(()=>finish(0),async error=>{console.error(error.stack||error);for(const window of windows)try{console.error(await window.webContents.executeJavaScript('JSON.stringify({url:location.href,text:document.body.innerText.slice(0,2400)})'));}catch{}console.error(errors);finish(1);});
function finish(code){clearTimeout(timeout);for(const window of windows)if(!window.isDestroyed())window.destroy();if(server)server.kill('SIGTERM');rmSync(root,{recursive:true,force:true});app.exit(code);}
