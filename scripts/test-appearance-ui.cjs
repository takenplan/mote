require('./fixture-background.cjs');
require('./fixture-language.cjs');
// Production Web bundle + real React portal and modals, with an isolated generated central.
const {app,BrowserWindow}=require('electron');
const {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync}=require('node:fs');
const {tmpdir}=require('node:os'),{join,resolve}=require('node:path'),{fork,execFileSync}=require('node:child_process');
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const root=mkdtempSync(join(tmpdir(),'mote-theme-web-')),repo=resolve(__dirname,'..'),out=join(repo,'.mote/appearance/web');
mkdirSync(out,{recursive:true});app.setPath('userData',join(root,'browser'));app.on('window-all-closed',()=>{});
const timeout=setTimeout(()=>{console.error('Theme Web fixture timed out');void finish(1);},150000);
let server,finishing=false,nextId=1;const pending=new Map(),windows=[],errors=[],layoutFailures=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
const command=command=>new Promise((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});server.send({id,...command});});
async function until(fn,label){const deadline=Date.now()+25000;while(Date.now()<deadline){if(await fn())return;await delay(30);}throw Error('Timed out: '+label);}
async function run(){
 const candidate=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();if(process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD)assert.equal(candidate,process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD);
 assert.ok(process.env.MOTE_WEB_FIXTURE_NODE&&existsSync(process.env.MOTE_WEB_FIXTURE_NODE),'Select the matching installed Node runtime with MOTE_WEB_FIXTURE_NODE');
 await app.whenReady();
 // Exercise the production scoped composition and its actual Cookie login UI.
 // The existing isolated host registers generated accounts and no model profile.
 let connectionInfo,failure='';
 server=fork(join(repo,'apps/web/test/fixtures/multiuser-host.ts'),[],{cwd:repo,execPath:process.env.MOTE_WEB_FIXTURE_NODE,execArgv:['--import','tsx'],stdio:['ignore','ignore','pipe','ipc']});
 server.stderr.on('data',b=>failure+=b);
 server.on('message',message=>{if(message.event==='ready')connectionInfo=message;else if(message.id){const request=pending.get(message.id);pending.delete(message.id);if(message.error)request?.reject(Error(message.error));else request?.resolve(message.result);}});
 await until(()=>{if(server.exitCode!==null)throw Error(failure);return typeof connectionInfo?.url==='string'&&typeof connectionInfo?.password==='string';},'generated scoped central');
 const {url,password,users}=connectionInfo;
 const create=async()=>{
  const window=new BrowserWindow({width:1280,height:900,show:false,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});windows.push(window);
  const wc=window.webContents;wc.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);});await window.loadURL('about:blank');wc.debugger.attach('1.3');
  return {window,wc,js:code=>wc.executeJavaScript(code),os:scheme=>wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:scheme}]})};
 };
 const reload=async client=>{const loaded=new Promise(resolve=>client.wc.once('did-finish-load',resolve));client.wc.reload();await loaded;};
 const input=async(client,label,value)=>client.js(`(()=>{const field=document.querySelector('[aria-label='+${JSON.stringify(JSON.stringify(label))}+']');if(!field||field.disabled)throw Error('Missing enabled field');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(value)});field.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const click=async(client,text)=>until(()=>client.js(`(()=>{const button=[...document.querySelectorAll('button')].find(button=>button.getClientRects().length&&button.textContent.trim()===${JSON.stringify(text)});if(!button||button.disabled)return false;button.click();return true;})()`),'button '+text);
 const login=async(client,owner)=>{
  if(!await client.js(`Boolean(document.querySelector('.connect-modal'))`)){await until(()=>client.js(`Boolean(document.querySelector('.avatar'))`),'real login shell');await client.js(`document.querySelector('.avatar').click()`);}
  await until(()=>client.js(`Boolean(document.querySelector('.connect-modal [aria-label="用户名"]'))`),'actual account dialog');
  await input(client,'用户名',users[owner].username);await input(client,'密码',password);await click(client,'登录并继续');
  await until(()=>client.js(`document.querySelector('[data-session="ready"]')&&document.querySelector('.avatar')?.textContent===${JSON.stringify(users[owner].username)}`),'real Cookie session '+owner);
 };
 const settings=await create();await settings.window.loadURL(url+'/#/preferences');await login(settings,'a');
 console.log('phase settings-login');
 await until(()=>settings.js(`Boolean(document.querySelector('select[aria-label="外观"]'))`),'real appearance selector');
 const choose=async preference=>{
  await settings.js(`(()=>{const select=document.querySelector('select[aria-label="外观"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(preference)});select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until(()=>settings.js(`document.querySelector('select[aria-label="外观"]').value===${JSON.stringify(preference)}`),'choice '+preference);
 };
 const scheme=async(client,expected)=>until(()=>client.js(`document.documentElement.dataset.colorScheme===${JSON.stringify(expected)}&&getComputedStyle(document.documentElement).colorScheme===${JSON.stringify(expected)}`),'resolved '+expected);
 const screen=async(client,name)=>{await delay(80);const overflow=await client.js(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,items:[...document.querySelectorAll('*')].map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>innerWidth).slice(0,25)})`);if(overflow.scrollWidth>overflow.width){console.error(JSON.stringify({name,overflow}));layoutFailures.push({name,overflow});}if(!process.env.MOTE_WEB_FIXTURE_DISCOVERY)assert(overflow.scrollWidth<=overflow.width,'no overflow '+name);writeFileSync(join(out,name+'.png'),(await client.wc.capturePage()).toPNG());};
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
  // The preload scanner can request the module before the preceding blocking
  // bootstrap executes. Observe that real bootstrap while the module stays held.
  await until(async()=>{const value=await client.wc.debugger.sendCommand('Runtime.evaluate',{expression:'Boolean(document.documentElement.dataset.colorScheme)',returnByValue:true});return value.result.value===true;},'synchronous appearance bootstrap before application');
  const first=await client.wc.debugger.sendCommand('Runtime.evaluate',{expression:`JSON.stringify({scheme:document.documentElement.dataset.colorScheme,background:getComputedStyle(document.documentElement).backgroundColor,theme:document.querySelector('meta[name="theme-color"]').content})`,returnByValue:true});
  const value=JSON.parse(first.result.value),expected=preference==='auto'?os:preference;
  assert.equal(value.scheme,expected);assert.equal(value.background,expected==='dark'?'rgb(28, 27, 26)':'rgb(247, 245, 241)');assert.equal(value.theme,expected==='dark'?'#1c1b1a':'#f7f5f1');
  console.log('phase first-frame-checked');
  await client.wc.debugger.sendCommand('Fetch.continueRequest',{requestId:held});await client.wc.debugger.sendCommand('Fetch.disable');client.wc.debugger.removeListener('message',pause);await loaded;await scheme(client,expected);
  await reload(client);await scheme(client,expected);
  await until(()=>client.js(`Boolean(document.querySelector('select[aria-label="外观"]'))`),'loaded settings');
  assert.equal(await client.js(`document.querySelector('.avatar')?.textContent`),users.a.username,'Cookie owner survives reload');
  assert.equal(await client.js(`document.querySelector('.avatar').title`),users.a.username,'clipped avatar retains the complete account name');assert.ok((await client.js(`document.querySelector('.avatar').getAttribute('aria-label')`)).includes(users.a.username),'complete account name remains accessible');
  await screen(client,`${preference}-os-${os}-settings`);client.window.setSize(390,844);await screen(client,`${preference}-os-${os}-phone`);client.window.setSize(1280,900);
  await client.os(os==='dark'?'light':'dark');await scheme(client,preference==='auto'?(os==='dark'?'light':'dark'):preference);
 }
 // Actual React login dialog retains its controlled input/focus/selection under cross-tab changes.
 const savedPreference=await settings.js(`localStorage.getItem('mote.appearance.v1')`);
 await click(settings,'退出登录');await until(()=>client.js(`Boolean(document.querySelector('[data-session="signed-out"]'))`),'cross-tab retirement on real logout');
 await client.js(`location.hash='#/ask';true`);await reload(client);
 assert.equal(await client.js(`localStorage.getItem('mote.appearance.v1')`),savedPreference,'logout preserves device appearance');
 await until(()=>client.js(`Boolean(document.querySelector('.avatar'))`),'logged out shell');await client.js(`document.querySelector('.avatar').click()`);
 await until(()=>client.js(`Boolean(document.querySelector('.connect-modal input'))`),'actual login modal');
 await client.js(`window.fixtureModal=document.querySelector('.connect-modal');window.fixtureField=fixtureModal.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(fixtureField,'Generated unsaved modal');fixtureField.dispatchEvent(new Event('input',{bubbles:true}));fixtureField.focus();fixtureField.setSelectionRange(4,12);`);
 // A different generated account can control the device preference without owning the other tab's modal.
 await login(settings,'b');
 for(const preference of ['light','dark','auto']){await choose(preference);await delay(60);assert(await client.js(`document.querySelector('.connect-modal')===fixtureModal&&document.querySelector('.connect-modal input')===fixtureField&&fixtureField.value==='Generated unsaved modal'&&fixtureField.selectionStart===4&&fixtureField.selectionEnd===12&&document.activeElement===fixtureField`));}
 await screen(client,'auto-login-modal');
 await client.js(`document.querySelector('.connect-modal .close').click();location.hash='#/notes';true`);await reload(client);
 await until(()=>client.js(`Boolean(document.querySelector('#note-text'))&&!document.querySelector('#note-text').disabled`),'actual React note');
 assert.equal(await client.js(`document.querySelector('.avatar')?.textContent`),users.b.username,'note belongs to the new Cookie owner');
 await client.js(`window.fixtureNote=document.querySelector('#note-text');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(fixtureNote,'Generated theme draft');fixtureNote.dispatchEvent(new Event('input',{bubbles:true}));fixtureNote.focus();fixtureNote.setSelectionRange(4,12);window.fixtureHash=location.hash;`);
 for(const preference of ['dark','light','auto']){await choose(preference);await delay(60);assert(await client.js(`document.querySelector('#note-text')===fixtureNote&&fixtureNote.value==='Generated theme draft'&&fixtureNote.selectionStart===4&&fixtureNote.selectionEnd===12&&document.activeElement===fixtureNote&&location.hash===fixtureHash`));await screen(client,`${preference}-note`);}
 await client.wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:'prefers-contrast',value:'more'},{name:'prefers-reduced-transparency',value:'reduce'}]});await choose('auto');await screen(client,'auto-increased-contrast-note');
 const contrast=await client.js(`(()=>{const s=getComputedStyle(document.documentElement);return ['ink','muted','control-border','border'].map(role=>s.getPropertyValue('--mote-'+role).trim());})()`);
 assert.ok(contrast[0]);assert.deepEqual(contrast,[contrast[0],contrast[0],contrast[0],contrast[0]],'increased contrast reaches the actual Web root');
 // Theme remains device-local while an account transition retires private editor state.
 await click(settings,'切换账号');await login(settings,'a');
 await until(()=>client.js(`!document.querySelector('#note-text')&&!document.body.textContent.includes('Generated theme draft')`),'previous account draft retired');
 assert.equal(await client.js(`localStorage.getItem('mote.appearance.v1')`),savedPreference,'account change preserves device appearance');
 await reload(client);await until(()=>client.js(`Boolean(document.querySelector('#note-text'))&&!document.querySelector('#note-text').disabled`),'new account note');
 assert.equal(await client.js(`document.querySelector('.avatar')?.textContent`),users.a.username);
 assert.notEqual(await client.js(`document.querySelector('#note-text').value`),'Generated theme draft','new owner does not inherit the prior draft');
 const requests=await command({command:'requests'});
 assert.deepEqual(requests.filter(request=>request.method==='POST'&&['/api/query-runs','/api/ask','/api/agent-view/events','/api/models/probe'].includes(request.url)),[],'theme changes never invoke query/model entry points');
 assert.deepEqual(errors,[]);assert.deepEqual(layoutFailures,[],'all six appearance pair layouts fit the viewport');console.log(JSON.stringify({ok:true,candidate,fixtureSha256:createHash('sha256').update(readFileSync(join(repo,'apps/web/test/fixtures/multiuser-host.ts'))).digest('hex'),webIndexSha256:createHash('sha256').update(readFileSync(join(repo,'apps/web/dist/index.html'))).digest('hex'),sixPairs:true,productionCSP:true,heldModuleFirstPaint:true,refresh:true,liveMediaChange:true,actualReactModal:true,actualNote:true,crossTab:true,phoneOverflow:false,contrastMedia:true,realCookieLogin:true,generatedOwners:['a','b'],accountChangeRetiresDraft:true,deviceAppearancePreserved:true,noModelCalls:true,fixtureOnly:true}));
}
run().then(()=>finish(0),async error=>{console.error(error.stack||error);for(const window of windows)try{console.error(await window.webContents.executeJavaScript('JSON.stringify({url:location.href,text:document.body.innerText.slice(0,2400)})'));}catch{}console.error(errors);finish(1);});
async function finish(code){
 if(finishing)return;finishing=true;clearTimeout(timeout);for(const window of windows)if(!window.isDestroyed())window.destroy();
 if(server&&server.exitCode===null){
  const exited=new Promise(resolve=>server.once('exit',(exitCode,signal)=>resolve({exitCode,signal})));
  if(server.connected)server.send({id:nextId++,command:'close'});else server.kill('SIGTERM');
  const result=await Promise.race([exited,delay(20000).then(()=>null)]);
  if(!result){console.error('Generated scoped host did not close naturally');server.kill('SIGKILL');code=1;}else if(result.exitCode!==0||result.signal){console.error('Generated scoped host failed cleanup',result);code=1;}
 }else if(server&&server.exitCode!==0){console.error('Generated scoped host exited before cleanup',server.exitCode);code=1;}
 rmSync(root,{recursive:true,force:true});app.exit(code);
}
