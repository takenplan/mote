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
const observeHandoffSettlement=require('./fixtures/handoff-observer.cjs');
const {verify:verifyBuild}=require('./prepare-login-evidence-handoff.cjs');
const repo=resolve(__dirname,'../../..'),temporary=mkdtempSync(join(tmpdir(),'mote-evidence-handoff-'));
const output=process.env.MOTE_WEB_HANDOFF_OUTPUT??join(repo,'.mote/evidence-handoff');
const node=process.env.MOTE_WEB_FIXTURE_NODE??execFileSync('/usr/bin/which',['node'],{encoding:'utf8'}).trim();
const candidate=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const buildReceipt=process.env.MOTE_WEB_HANDOFF_BUILD_RECEIPT??join(repo,'.mote/evidence-handoff-build.json');
mkdirSync(output,{recursive:true});app.setPath('userData',join(temporary,'browser'));app.on('window-all-closed',()=>{});
const windows=[],events=[],pending=new Map(),checks=[],settlements=[],stages=[];let lastStage='initial';let host,metadata,next=0,finishing=false;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(read,label){const end=Date.now()+25000;while(Date.now()<end){if(await read())return;await delay(30);}throw Error('Timed out: '+label);}
async function stage(name,work){
 lastStage=name;const record={stage:name,entered:true,completed:false,failed:false};stages.push(record);console.log(JSON.stringify({stage:name,entered:true}));let timer;
 try{const value=await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>{const error=Error('Generated fixture stage deadline');error.code='FIXTURE_STAGE_DEADLINE';reject(error);},25000);})]);record.completed=true;console.log(JSON.stringify({stage:name,completed:true}));return value;}
 catch(error){record.failed=true;console.log(JSON.stringify({stage:name,failed:true}));throw error;}
 finally{clearTimeout(timer);}
}
function command(command,extra={}){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('Generated fixture command timeout'));},30000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});host.send({id,command,...extra});});}
// Do not include evaluated source, URLs or auth response bodies in diagnostics.
const js=(window,code)=>window.webContents.executeJavaScript(code);
const capture='6d477b3e-fb43-4657-818d-c143ad76430f',reference='context:capture:'+capture;
async function ticketHash(owner){const ticket=await command('ticket',{owner});return '#/ask?'+new URLSearchParams({evidence:reference,loginTicket:ticket.code});}
async function open(hash){
 const window=await stage('window-created',()=>{const value=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false}});windows.push(value);return value;});
 // Initialize a neutral test frame before waiting for renderer CDP domains.
 // No product page or authentication is loaded here; the ticket URL below is
 // still the first product document, not a reload recovery or an auth barrier.
 await stage('neutral-frame-loaded',()=>window.loadURL('about:blank'));
 await stage('cdp-attached',()=>window.webContents.debugger.attach('1.3'));
 await stage('cdp-page-enabled',()=>window.webContents.debugger.sendCommand('Page.enable'));
 await stage('cdp-observer-installed',()=>window.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:'('+observeHandoffSettlement.toString()+')()'}));
 await stage('product-document-loaded',()=>window.loadURL(metadata.url+'/'+hash));return window;
}
async function authMark(window){const state=await js(window,'window.__moteHandoffObservation.snapshot()');assert.equal(state.supported,true,'local Web Locks observation is required; unsupported environments do not pass silently');return state.requests.length;}
async function settled(window,mark,count=1){
 await until(async()=>{const state=await js(window,'window.__moteHandoffObservation.snapshot()');return state.requests.length>=mark+count&&state.requests.slice(mark,mark+count).every(request=>request.settled&&request.drained)&&state.reactIdle;},'real authentication Promise terminal, publication microtasks and React commit');
 const state=await js(window,'window.__moteHandoffObservation.snapshot()');assert.equal(state.requests.length,mark+count,'No subsequent authentication may retire the attempt before its negative assertion');settlements.push({mark,count,requests:state.requests.slice(mark,mark+count),reactRoots:state.reactRoots,reactIdle:state.reactIdle});
}
async function retired(window,hash){await noPrivate(window);assert.equal(await js(window,'location.hash'),hash);assert.equal(await js(window,`Boolean(document.querySelector('[data-session="signed-out"]'))`),true,'connection is absent, not merely awaiting verification');}
async function button(window,label){await js(window,`(()=>{const button=[...document.querySelectorAll('button')].find(button=>button.getClientRects().length&&(button.textContent.trim()===${JSON.stringify(label)}||button.getAttribute('aria-label')===${JSON.stringify(label)}));if(!button||button.disabled)throw Error('Generated UI button unavailable');button.click();})()`);}
async function input(window,selector,value){await js(window,`(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);}

async function evidence(window,owner){await until(()=>js(window,`document.querySelector('.avatar')?.textContent==='generated-${owner}'&&document.querySelector('.evidence-modal')?.textContent.includes('GENERATED_PRIVATE_${owner.toUpperCase()}')`),'current owner typed context evidence');assert.equal(await js(window,`new URLSearchParams(location.hash.split('?')[1]).get('evidence')`),reference);assert.equal(await js(window,`location.hash.includes('loginTicket')`),false);assert.equal(await js(window,`document.querySelector('.evidence-modal').textContent.includes('GENERATED_PRIVATE_${owner==='a'?'B':'A'}')`),false);}
async function navigate(window,hash){await js(window,`location.hash=${JSON.stringify(hash)}`);}
async function page(window,id){await until(()=>js(window,`Boolean(document.querySelector('[data-page=${JSON.stringify(id)}]'))`),'accepted original workspace navigation');}
async function hold(){events.length=0;await command('hold',{key:'POST:/api/login/exchange'});}
async function entered(){await until(()=>events.some(event=>event.event==='entered'&&event.key==='POST:/api/login/exchange'),'held real exchange response');}
async function release(){await command('release',{key:'POST:/api/login/exchange'});}
async function noPrivate(window){assert.equal(await js(window,`Boolean(document.querySelector('.evidence-modal'))||document.body.innerText.includes('GENERATED_PRIVATE_')`),false);}
async function run(){
 assert.ok(existsSync(node)&&existsSync(join(repo,'apps/web/dist/index.html')),'Prepare matching runtime and built Web before this runner');
 if(process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD)assert.equal(candidate,process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD);
 const binding=await stage('build-binding-verified',()=>verifyBuild(repo,buildReceipt,candidate));
 const hostRuntime=JSON.parse(execFileSync(node,['-p',"JSON.stringify({version:process.version,abi:process.versions.modules,platform:process.platform,arch:process.arch})"],{encoding:'utf8'}));assert.deepEqual(hostRuntime,binding.buildRuntime,'Host uses the exact Node runtime/ABI used for preparation');
 await stage('app-ready',()=>app.whenReady());host=fork(join(__dirname,'fixtures/multiuser-host.ts'),[],{cwd:repo,execPath:node,execArgv:['--import','tsx'],stdio:['ignore','ignore','ignore','ipc']});
 host.on('message',message=>{if(message.id){const request=pending.get(message.id);pending.delete(message.id);message.error?request?.reject(Error('Generated fixture operation failed')):request?.resolve(message.result);}else{events.push(message);if(message.event==='ready')metadata=message;}});
 await stage('generated-host-ready',()=>until(()=>metadata,'scoped generated host'));
 const firstTicketHash=await stage('first-ticket-minted',()=>ticketHash('a')),window=await open(firstTicketHash);await evidence(window,'a');await settled(window,0);const documentStart=await js(window,'performance.timeOrigin');checks.push('new document consumes one-time ticket before main mounts and opens owned typed context without reload');
 let mark=await authMark(window);await navigate(window,firstTicketHash);await settled(window,mark);await retired(window,'#/ask?'+new URLSearchParams({evidence:reference}));checks.push('immediate reuse of the actual previously consumed ticket cannot adopt connection or evidence');
 await navigate(window,'#/preferences');await page(window,'about');await noPrivate(window);
 await hold();await navigate(window,await ticketHash('a'));await entered();await noPrivate(window);await release();await evidence(window,'a');assert.equal(await js(window,'performance.timeOrigin'),documentStart);checks.push('same document hash handoff retires old private tree, exchanges once, restores current typed context without reload');
 await hold();await navigate(window,await ticketHash('a'));await entered();await noPrivate(window);await navigate(window,await ticketHash('b'));await release();await evidence(window,'b');checks.push('newer B ticket supersedes held A exchange; identical public capture ID renders only B evidence');
 mark=await authMark(window);
 await hold();await navigate(window,await ticketHash('a'));await entered();await navigate(window,'#/preferences');await page(window,'about');await release();await settled(window,mark);await retired(window,'#/preferences');checks.push('navigation cancellation remains retired after the old real authentication and renderer publication chain settle');
 mark=await authMark(window);await hold();await navigate(window,await ticketHash('a'));await entered();
 const cleanedHash=await js(window,'location.hash');await navigate(window,'#/preferences');await page(window,'about');await navigate(window,cleanedHash);await page(window,'ask');assert.equal(await js(window,'location.hash'),cleanedHash);
 await release();await settled(window,mark);await retired(window,cleanedHash);checks.push('route ABA: away then exact cleaned-hash reentry cannot restore the old attempt after its terminal state');
 mark=await authMark(window);await hold();await navigate(window,await ticketHash('a'));await entered();
 await js(window,`window.dispatchEvent(new StorageEvent('storage',{key:'mote.web-auth-change',newValue:'generated-external-change'}))`);
 const storageRoute=await js(window,'location.hash');await release();await settled(window,mark);await retired(window,storageRoute);checks.push('synthetic StorageEvent consumer retires a held attempt through its actual terminal state; not real cross-tab Cookie/Web Locks delivery');
 mark=await authMark(window);await hold();await navigate(window,await ticketHash('a'));await entered();
 await button(window,'登录 Mote');await until(()=>js(window,`Boolean(document.querySelector('input[autocomplete="username"]'))`),'original manual login entry');
 await input(window,'input[autocomplete="username"]','generated-b');await input(window,'input[autocomplete="current-password"]',metadata.password);await button(window,'登录并继续');
 await release();await settled(window,mark,2);await until(()=>js(window,`document.querySelector('.avatar')?.textContent==='generated-b'&&Boolean(document.querySelector('[data-session="ready"]'))`),'manual B login through original form');await noPrivate(window);assert.equal(await js(window,`new URLSearchParams(location.hash.split('?')[1]).has('evidence')`),false);checks.push('manual B authentication supersedes held ticket A via original public login form, without restoring A evidence');
 mark=await authMark(window);await navigate(window,'#/ask?'+new URLSearchParams({evidence:reference,loginTicket:'x'.repeat(43)}));await settled(window,mark);await until(()=>js(window,`Boolean(document.querySelector('.connect-modal'))`),'nonexistent ticket exposes existing login entry');await retired(window,'#/ask?'+new URLSearchParams({evidence:reference}));checks.push('well-formed nonexistent ticket clears private UI and nonce; does not claim expiry or replay coverage');
 if(process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD)assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),candidate);
 verifyBuild(repo,buildReceipt,candidate);
 writeFileSync(join(output,'result.json'),JSON.stringify({candidate,sourceTree:binding.source.tree,sourceSha256:binding.source.sha256,buildReceiptSha256:binding.receiptSha256,webIndexSha256:binding.artifacts['apps/web/dist/index.html'],hostRuntime,electron:process.versions.electron,chromium:process.versions.chrome,passed:true,checks,settlements,stages,actualWebMain:true,actualScopedHost:true,generatedOnly:true,modelCalls:false,desktopIabR3Reproduced:false,unknown:['expired ticket with controlled time','real cross-tab Cookie/Web Locks ordering','authentication A-to-B-to-A replacement'],barrier:'native authentication lock Promise observed without replacing it; original reaction queue drained; passive React pending work empty'},null,2));console.log('PASS generated Web login/evidence lifecycle '+checks.length);
}
async function finish(code){if(finishing)return;finishing=true;for(const window of windows)if(!window.isDestroyed())window.destroy();if(host&&host.exitCode===null){const exit=new Promise(resolve=>host.once('exit',(code,signal)=>resolve({code,signal})));try{await command('close');assert.deepEqual(await Promise.race([exit,delay(20000).then(()=>null)]),{code:0,signal:null});}catch{host.kill('SIGKILL');code=1;}}rmSync(temporary,{recursive:true,force:true});app.exit(code);}
run().then(()=>finish(0)).catch(error=>{writeFileSync(join(output,'failure.json'),JSON.stringify({candidate,lastRecordedStage:lastStage,stages,classification:error?.code==='FIXTURE_STAGE_DEADLINE'?'BOUNDED_FIXTURE_STAGE_DEADLINE':'RUNNER_OR_CASE_FAILURE_UNCLASSIFIED',passed:false},null,2));console.error(JSON.stringify({stage:lastStage,failed:true}));void finish(1);});
