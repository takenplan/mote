require('../../../scripts/fixture-background.cjs');
require('../../../scripts/fixture-language.cjs');
const {app,BrowserWindow}=require('electron');
const {fork}=require('node:child_process');
const {mkdtempSync,rmSync,mkdirSync,writeFileSync,existsSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {resolve,join}=require('node:path');
const assert=require('node:assert/strict');
const repo=resolve(__dirname,'../../..'),directory=mkdtempSync(join(tmpdir(),'mote-m13-browser-')),output=join(repo,'.mote/m13-renderer');mkdirSync(output,{recursive:true});
app.setPath('userData',join(directory,'browser'));app.on('window-all-closed',()=>{});
let host,metadata,nextId=0,main,old;const windows=[],pending=new Map(),events=[],stderr=[],errors=[],checks=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(read,label,ms=20000){const end=Date.now()+ms;while(Date.now()<end){if(await read())return;await delay(30);}throw Error('Timed out: '+label);}
function command(command,extra={}){const id=++nextId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Fixture command timed out: '+command));},20000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject});host.send({id,command,...extra});});}
async function windowAt(url){const window=new BrowserWindow({width:1360,height:1000,show:false,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false}});windows.push(window);window.webContents.on('render-process-gone',(_event,details)=>errors.push(details.reason));window.webContents.on('console-message',event=>{if(event.level==='error'&&/Uncaught|ErrorBoundary|Minified React error/.test(event.message))errors.push(event.message);});await window.loadURL(url);return window;}
const js=(window,code)=>window.webContents.executeJavaScript(code);
const text=window=>js(window,'document.body.innerText');
const button=(window,label)=>js(window,`(()=>{const button=[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(label)});if(!button)throw Error('Missing button '+${JSON.stringify(label)});button.click();})()`);
const input=(window,selector,value)=>js(window,`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw Error('Missing input '+${JSON.stringify(selector)});const prototype=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const route=async(window,hash)=>{await js(window,`location.hash=${JSON.stringify(hash)}`);};
async function login(window,owner,password=metadata.password){
 if(!await js(window,'Boolean(document.querySelector(\'input[autocomplete="username"]\'))')){
  if(await js(window,'Boolean(document.querySelector(\'[aria-label="当前账号"]\'))'))await button(window,'切换账号');else await button(window,'登录 Mote');
 }
 await until(()=>js(window,'Boolean(document.querySelector(\'input[autocomplete="username"]\'))'),'login form');
 await input(window,'input[autocomplete="username"]',owner==='admin'?'generated-admin':'generated-'+owner);await input(window,'input[autocomplete="current-password"]',password);await button(window,'登录并继续');
 if(password===metadata.password)await until(()=>js(window,`document.querySelector('[data-session="ready"]')&&document.querySelector('.avatar')?.textContent==='generated-${owner}'`),'authenticated '+owner);
}
async function run(){
 assert.ok(process.env.MOTE_WEB_FIXTURE_NODE&&existsSync(process.env.MOTE_WEB_FIXTURE_NODE),'Select existing Node 24 with MOTE_WEB_FIXTURE_NODE');
 assert.ok(existsSync(join(repo,'apps/web/dist/index.html')),'Build Web first');
 await app.whenReady();
 host=fork(join(__dirname,'fixtures/multiuser-host.ts'),[],{cwd:repo,execPath:process.env.MOTE_WEB_FIXTURE_NODE,execArgv:['--import','tsx'],stdio:['ignore','pipe','pipe','ipc']});
 host.stderr.on('data',data=>stderr.push(String(data)));host.on('message',message=>{if(message.id){const operation=pending.get(message.id);if(operation){pending.delete(message.id);message.error?operation.reject(Error(message.error)):operation.resolve(message.result);}}else{events.push(message);if(message.event==='ready')metadata=message;}});
 await until(()=>metadata,'actual scoped host ready',30000);
 main=await windowAt(metadata.url+'/#/preferences');await login(main,'a');
 const cookie=(await main.webContents.session.cookies.get({url:metadata.url})).find(cookie=>cookie.name==='__Host-mote-session');assert.ok(cookie?.httpOnly&&cookie.secure);assert.equal(cookie.sameSite,'strict');
 assert.doesNotMatch(await text(main),/账号管理|GENERATED_PRIVATE_B/);checks.push('real Cookie login, stable current account, no admin UI for A');
 await route(main,'#/library/notes');await until(()=>js(main,`document.querySelector('.notes-history')?.textContent.includes('GENERATED_PRIVATE_A')`),'real A note');assert.doesNotMatch(await text(main),/GENERATED_PRIVATE_B/);
 await input(main,'#note-text','GENERATED_DRAFT_A');await main.reload();await until(()=>js(main,`document.querySelector('#note-text')?.value==='GENERATED_DRAFT_A'`),'reload restores A draft');checks.push('actual identical A/B note IDs isolated; A draft survives reload');
 old=await windowAt(metadata.url+'/#/preferences');await until(()=>js(old,`document.querySelector('[aria-label="当前账号"]')?.textContent.includes('generated-a')`),'second tab restores A');
 const handoff=await command('handoff');await route(old,'#/preferences?loginRequest='+handoff.id);await until(()=>js(old,`[...document.querySelectorAll('button')].some(button=>button.textContent==='继续登录客户端'&&!button.disabled)`),'open actual A client approval');
 // Simulate a tab that missed the notification. The backend session binding,
 // rather than the storage hint, must reject its still-visible old operation.
 await js(old,`window.addEventListener('storage',event=>event.stopImmediatePropagation(),true);`);
 await command('hold',{key:'GET:/api/captures?'});await button(main,'刷新');await until(()=>events.some(event=>event.event==='entered'&&event.key==='GET:/api/captures?'),'held actual A body');
 await route(main,'#/preferences');await login(main,'b');await route(main,'#/library/notes');await until(()=>js(main,`document.querySelector('.notes-history')?.textContent.includes('GENERATED_PRIVATE_B')`),'real B note');
 assert.equal(await js(main,`document.querySelector('#note-text').value`),'');assert.doesNotMatch(await text(main),/GENERATED_PRIVATE_A|GENERATED_DRAFT_A/);
 await command('release',{key:'GET:/api/captures?'});await delay(80);assert.doesNotMatch(await text(main),/GENERATED_PRIVATE_A|GENERATED_DRAFT_A/);checks.push('A→B remount clears drafts and held successful A body cannot fill B');
 await button(old,'继续登录客户端');await until(()=>js(old,`document.querySelector('[data-session="signed-out"]')`),'stale approval session fence');assert.equal((await command('poll',{requestId:handoff.id})).ready,false);assert.ok(!(await js(old,'location.hash')).includes('loginRequest'),'retiring A removes the old pending approval link before B can sign in');checks.push('old visible approval cannot borrow replacement B Cookie, even with lost storage event');
 const bBefore=await command('data',{owner:'b'});await input(main,'#note-text','GENERATED_SUBMIT_B');await js(main,`document.querySelector('form.note-composer').requestSubmit()`);await until(async()=>JSON.stringify(await command('data',{owner:'b'})).includes('GENERATED_SUBMIT_B'),'actual renderer→Ingress→private data note');
 assert.equal((await command('data',{owner:'b'})).items.length,bBefore.items.length+1);assert.ok(!JSON.stringify(await command('data',{owner:'a'})).includes('GENERATED_SUBMIT_B'));checks.push('real Web submission reaches owned Ingress/SQLite only');
 await route(main,'#/preferences');await login(main,'a');await route(main,'#/library/notes');await until(()=>js(main,`document.querySelector('#note-text')?.value==='GENERATED_DRAFT_A'`),'same-account credential rotation restores original A draft');assert.doesNotMatch(await text(main),/GENERATED_SUBMIT_B/);checks.push('A re-login restores stable-owner draft without B submission');
 await route(main,'#/preferences');await button(main,'切换账号');await login(main,'b','Generated-wrong-password-only');await until(()=>js(main,`Boolean(document.querySelector('.connect-modal [role="alert"]'))`),'failed login result');assert.doesNotMatch(await text(main),/GENERATED_PRIVATE_A|GENERATED_DRAFT_A|账号管理/);checks.push('failed switch/login leaves private A tree absent');
 await js(main,`document.querySelector('[aria-label="关闭登录"]').click()`);await login(main,'b');
 const sessionId=await js(main,`fetch('/api/auth/self',{headers:{'X-Mote-Protocol-Version':'2'}}).then(response=>response.json()).then(value=>value.credentialId)`);
 await command('revoke',{owner:'b',credentialId:sessionId});await route(main,'#/library/notes');await until(()=>js(main,`Boolean(document.querySelector('[data-session="signed-out"]'))`),'credential revocation clears private UI');checks.push('actual credential revocation ends renderer session');
 await login(main,'b');await command('disable',{owner:'b',disabled:true});await route(main,'#/library/notes');await until(()=>js(main,`Boolean(document.querySelector('[data-session="signed-out"]'))`),'account disable clears private UI');await command('disable',{owner:'b',disabled:false});checks.push('actual account disable fences current renderer');
 await login(main,'admin');await route(main,'#/preferences');await until(()=>js(main,`document.querySelector('[aria-label="账号管理"]')?.textContent.includes('generated-b')`),'real account metadata administration');assert.doesNotMatch(await text(main),/GENERATED_PRIVATE_[AB]/);checks.push('administrator sees account metadata with no private A/B content');
 assert.deepEqual(errors,[]);writeFileSync(join(output,'result.json'),JSON.stringify({passed:true,hiddenRenderer:true,actualWebMain:true,actualProductionHost:true,generatedOnly:true,checks,dependencyStatus:'M11/M12 final composition pending',liveExternal:false},null,2));
 console.log('PASS M13 real hidden Web + actual scoped host: '+checks.join('; '));
}
async function finish(code){for(const window of windows)if(!window.isDestroyed())window.destroy();if(host?.connected){try{await command('close');}catch(error){console.error(String(error));host.kill('SIGTERM');}}rmSync(directory,{recursive:true,force:true});app.exit(code);}
run().then(()=>finish(0)).catch(async error=>{console.error(error.stack);console.error(stderr.join(''));for(const window of windows)if(!window.isDestroyed()){console.error(await text(window));writeFileSync(join(output,'failure-'+window.id+'.png'),(await window.webContents.capturePage()).toPNG());}await finish(1);});
