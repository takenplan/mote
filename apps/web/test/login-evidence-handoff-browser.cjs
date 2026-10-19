require('../../../scripts/fixture-background.cjs');
require('../../../scripts/fixture-language.cjs');
/** Actual built main, Cookie exchange and scoped context reader. Generated data
 * only; no model setup/calls. This runner is separate from Desktop/IAB R3 proof. */
const {app,BrowserWindow}=require('electron');
const {fork,execFileSync}=require('node:child_process');
const {mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const assert=require('node:assert/strict');
const repo=resolve(__dirname,'../../..'),temporary=mkdtempSync(join(tmpdir(),'mote-evidence-handoff-'));
const output=process.env.MOTE_WEB_HANDOFF_OUTPUT??join(repo,'.mote/evidence-handoff');
const node=process.env.MOTE_WEB_FIXTURE_NODE??execFileSync('/usr/bin/which',['node'],{encoding:'utf8'}).trim();
const candidate=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
mkdirSync(output,{recursive:true});app.setPath('userData',join(temporary,'browser'));app.on('window-all-closed',()=>{});
const windows=[],events=[],pending=new Map(),checks=[];let host,metadata,next=0,finishing=false;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(read,label){const end=Date.now()+25000;while(Date.now()<end){if(await read())return;await delay(30);}throw Error('Timed out: '+label);}
function command(command,extra={}){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('Generated fixture command timeout'));},30000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});host.send({id,command,...extra});});}
// Do not include evaluated source, URLs or auth response bodies in diagnostics.
const js=(window,code)=>window.webContents.executeJavaScript(code);
const capture='6d477b3e-fb43-4657-818d-c143ad76430f',reference='context:capture:'+capture;
async function ticketHash(owner){const ticket=await command('ticket',{owner});return '#/ask?'+new URLSearchParams({evidence:reference,loginTicket:ticket.code});}
async function open(hash){const window=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false}});windows.push(window);await window.loadURL(metadata.url+'/'+hash);return window;}
async function evidence(window,owner){await until(()=>js(window,`document.querySelector('.avatar')?.textContent==='generated-${owner}'&&document.querySelector('.evidence-modal')?.textContent.includes('GENERATED_PRIVATE_${owner.toUpperCase()}')`),'current owner typed context evidence');assert.equal(await js(window,`new URLSearchParams(location.hash.split('?')[1]).get('evidence')`),reference);assert.equal(await js(window,`location.hash.includes('loginTicket')`),false);assert.equal(await js(window,`document.querySelector('.evidence-modal').textContent.includes('GENERATED_PRIVATE_${owner==='a'?'B':'A'}')`),false);}
async function navigate(window,hash){await js(window,`location.hash=${JSON.stringify(hash)}`);}
async function hold(){events.length=0;await command('hold',{key:'POST:/api/login/exchange'});}
async function entered(){await until(()=>events.some(event=>event.event==='entered'&&event.key==='POST:/api/login/exchange'),'held real exchange response');}
async function release(){await command('release',{key:'POST:/api/login/exchange'});}
async function noPrivate(window){assert.equal(await js(window,`Boolean(document.querySelector('.evidence-modal'))||document.body.innerText.includes('GENERATED_PRIVATE_')`),false);}
async function run(){
 assert.ok(existsSync(node)&&existsSync(join(repo,'apps/web/dist/index.html')),'Prepare matching runtime and built Web before this runner');
 if(process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD)assert.equal(candidate,process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD);
 await app.whenReady();host=fork(join(__dirname,'fixtures/multiuser-host.ts'),[],{cwd:repo,execPath:node,execArgv:['--import','tsx'],stdio:['ignore','ignore','ignore','ipc']});
 host.on('message',message=>{if(message.id){const request=pending.get(message.id);pending.delete(message.id);message.error?request?.reject(Error('Generated fixture operation failed')):request?.resolve(message.result);}else{events.push(message);if(message.event==='ready')metadata=message;}});
 await until(()=>metadata,'scoped generated host');
 const window=await open(await ticketHash('a'));await evidence(window,'a');const documentStart=await js(window,'performance.timeOrigin');checks.push('new document consumes one-time ticket before main mounts and opens owned typed context without reload');
 await navigate(window,'#/preferences');await until(()=>js(window,`!document.querySelector('.evidence-modal')`),'leave first evidence');
 await hold();await navigate(window,await ticketHash('a'));await entered();await noPrivate(window);await release();await evidence(window,'a');assert.equal(await js(window,'performance.timeOrigin'),documentStart);checks.push('same document hash handoff retires old private tree, exchanges once, restores current typed context without reload');
 await hold();await navigate(window,await ticketHash('a'));await entered();await noPrivate(window);await navigate(window,await ticketHash('b'));await release();await evidence(window,'b');checks.push('newer B ticket supersedes held A exchange; identical public capture ID renders only B evidence');
 await hold();await navigate(window,await ticketHash('a'));await entered();await navigate(window,'#/preferences');await release();await delay(150);await noPrivate(window);assert.equal(await js(window,`Boolean(document.querySelector('[data-session="ready"]'))`),false);checks.push('navigation cancellation does not adopt a delayed ticket connection or restore its reference');
 await hold();await navigate(window,await ticketHash('a'));await entered();await js(window,`window.dispatchEvent(new StorageEvent('storage',{key:'mote.web-auth-change',newValue:'generated-external-change'}))`);await release();await delay(150);await noPrivate(window);assert.equal(await js(window,`Boolean(document.querySelector('[data-session="ready"]'))`),false);checks.push('external authentication retirement invalidates pending handoff publication');
 await navigate(window,'#/ask?'+new URLSearchParams({evidence:reference,loginTicket:'x'.repeat(43)}));await until(()=>js(window,`Boolean(document.querySelector('.connect-modal'))`),'failed ticket exposes existing login entry');await noPrivate(window);assert.equal(await js(window,`location.hash.includes('loginTicket')`),false);checks.push('invalid or expired ticket clears prior private UI and nonce without evidence resurrection');
 if(process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD)assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),candidate);
 writeFileSync(join(output,'result.json'),JSON.stringify({candidate,passed:true,checks,actualWebMain:true,actualScopedHost:true,generatedOnly:true,modelCalls:false,desktopIabR3Reproduced:false},null,2));console.log('PASS generated Web login/evidence lifecycle '+checks.length);
}
async function finish(code){if(finishing)return;finishing=true;for(const window of windows)if(!window.isDestroyed())window.destroy();if(host&&host.exitCode===null){const exit=new Promise(resolve=>host.once('exit',(code,signal)=>resolve({code,signal})));try{await command('close');assert.deepEqual(await Promise.race([exit,delay(20000).then(()=>null)]),{code:0,signal:null});}catch{host.kill('SIGKILL');code=1;}}rmSync(temporary,{recursive:true,force:true});app.exit(code);}
run().then(()=>finish(0)).catch(()=>{console.error('FAIL generated Web login/evidence lifecycle; no auth material logged');void finish(1);});
