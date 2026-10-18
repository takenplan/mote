require('../../../scripts/fixture-background.cjs');
require('../../../scripts/fixture-language.cjs');
const {app,BrowserWindow}=require('electron');
const {fork,execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {mkdtempSync,rmSync,mkdirSync,writeFileSync,readFileSync,existsSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {resolve,join}=require('node:path');
const assert=require('node:assert/strict');

const repo=resolve(__dirname,'../../..'),temporary=mkdtempSync(join(tmpdir(),'mote-parity-home-browser-'));
const output=process.env.MOTE_WEB_HOME_OUTPUT??join(repo,'.mote/parity-home-browser');mkdirSync(output,{recursive:true});
app.setPath('userData',join(temporary,'browser'));app.on('window-all-closed',()=>{});
const windows=[],events=[],errors=[],logs=[],checks=[],receipts=[],pending=new Map();
const candidate=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const fixtureNode=process.env.MOTE_WEB_FIXTURE_NODE??execFileSync('/usr/bin/which',['node'],{encoding:'utf8'}).trim();
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
let host,metadata,nextId=0,finishing=false;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(read,label,ms=25000){const end=Date.now()+ms;while(Date.now()<end){if(await read())return;await delay(30);}throw Error('Timed out: '+label);}
function command(command,extra={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('Fixture IPC timeout '+command));},30000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});host.send({id,command,...extra});});}
const js=async(window,code)=>{try{return await window.webContents.executeJavaScript(code);}catch(error){throw Error('Home renderer evaluation failed: '+code.slice(0,1000),{cause:error});}};
const text=window=>js(window,'document.body.innerText');
const route=(window,hash)=>js(window,`location.hash=${JSON.stringify(hash)}`);
const button=(window,label,scope='document')=>js(window,`(()=>{const root=${scope},button=[...root.querySelectorAll('button')].find(button=>button.getClientRects().length&&(button.textContent.trim()===${JSON.stringify(label)}||button.querySelector('strong')?.textContent.trim()===${JSON.stringify(label)}||button.getAttribute('aria-label')===${JSON.stringify(label)}));if(!button||button.disabled)throw Error('Missing enabled button '+${JSON.stringify(label)});button.click();})()`);
const input=(window,selector,value)=>js(window,`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
async function open(hash='#/today'){
 const window=new BrowserWindow({width:1360,height:1000,show:false,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false}});windows.push(window);
 window.webContents.on('render-process-gone',(_event,details)=>errors.push(details.reason));
 window.webContents.on('console-message',event=>{if(event.level==='error'&&/Uncaught|ErrorBoundary|Minified React error/.test(event.message))errors.push(event.message);});
 await window.loadURL(metadata.url+'/'+hash);return window;
}
async function login(window,owner){
 if(!await js(window,'Boolean(document.querySelector(\'input[autocomplete="username"]\'))')){
  if(await js(window,'Boolean(document.querySelector(\'[aria-label="当前账号"]\'))')){await route(window,'#/preferences');await button(window,'切换账号');}
  else await button(window,'登录 Mote');
 }
 await until(()=>js(window,'Boolean(document.querySelector(\'input[autocomplete="username"]\'))'),'original login form');
 await input(window,'input[autocomplete="username"]','generated-'+owner);await input(window,'input[autocomplete="current-password"]',metadata.password);await button(window,'登录并继续');
 await until(()=>js(window,`Boolean(document.querySelector('[data-session="ready"]'))&&document.querySelector('.avatar')?.textContent==='generated-${owner}'`),'real Cookie login '+owner);
}
async function home(window,owner){
 await route(window,'#/today');await until(()=>js(window,`document.querySelectorAll('.home-record-list .capture-card').length===4&&document.querySelector('.home-record-list')?.textContent.includes('GENERATED_HOME_${owner.toUpperCase()}_RECORD_5')`),'original Home '+owner);
 await until(()=>js(window,`document.querySelector('.home-insight')?.textContent.includes('GENERATED_IAB_ANSWER_${owner.toUpperCase()}')`),'latest owned Insight '+owner);
 assert.doesNotMatch(await text(window),new RegExp('GENERATED_HOME_'+(owner==='a'?'B':'A')+'_|GENERATED_IAB_ANSWER_'+(owner==='a'?'B':'A')));
}
async function capture(window,name){
 const layout=await js(window,`({width:innerWidth,height:innerHeight,document:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,home:document.querySelector('.home-page')?.getBoundingClientRect().width??null,devices:document.querySelector('.device-overview')?.getBoundingClientRect().width??null})`);
 assert.ok(layout.document<=layout.client+1,name+' fits viewport '+JSON.stringify(layout));
 writeFileSync(join(output,name+'.png'),(await window.webContents.capturePage()).toPNG());receipts.push({layout:name,...layout});
}
async function run(){
 assert.ok(existsSync(fixtureNode),'Select matching Node on PATH or with MOTE_WEB_FIXTURE_NODE');
 assert.ok(existsSync(join(repo,'apps/web/dist/index.html')),'Build Web first');
 if(process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD)assert.equal(candidate,process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD);
 await app.whenReady();
 host=fork(join(__dirname,'fixtures/multiuser-home-host.ts'),[],{cwd:repo,execPath:fixtureNode,execArgv:['--import','tsx'],stdio:['ignore','ignore','pipe','ipc']});
 host.stderr.on('data',data=>logs.push(String(data)));host.on('message',message=>{if(message.id){const operation=pending.get(message.id);pending.delete(message.id);message.error?operation?.reject(Error(message.error)):operation?.resolve(message.result);}else{events.push(message);if(message.event==='ready')metadata=message;}});
 await until(()=>metadata,'production scoped generated Home host',90000);
 const main=await open();await login(main,'a');await home(main,'a');
 assert.match(await js(main,`document.querySelector('.home-insight').textContent`),/1 条证据来源/);
 assert.match(await js(main,`document.querySelector('.home-record-list .capture-card').textContent`),/已脱敏/,'complete generated capture retains the original privacy badge');
 assert.equal(await js(main,`document.querySelector('.home-record-list').textContent.includes('GENERATED_HOME_A_RECORD_0')`),false);
 await js(main,`document.querySelector('.home-record-list .capture-card').click()`);
 await until(()=>js(main,`document.querySelector('.evidence-modal')?.textContent.includes('GENERATED_HOME_A_RECORD_6')`),'Home CaptureCard opens owned original evidence');
 assert.match(await js(main,'location.hash'),/evidence=capture/);await button(main,'关闭证据详情');
 await js(main,`document.querySelector('.home-insight').click()`);await until(()=>js(main,`Boolean(document.querySelector('.insights-page'))&&document.body.innerText.includes('GENERATED_IAB_ANSWER_A')`),'Home latest Insight opens original Insights');
 await home(main,'a');await js(main,`document.querySelector('.home-extensions').open=true`);await until(()=>js(main,`Boolean(document.querySelector('.home-agent-view'))`),'registered Home slot is loaded');await js(main,`document.querySelector('.home-agent-view').click()`);await until(()=>js(main,`Boolean(document.querySelector('.agent-inspector'))`),'Home slot navigates to original Agent inspector');
 await home(main,'a');await capture(main,'home-desktop-a');checks.push('actual Cookie login → original recent four records → original evidence; latest Insight and registered Home slot');
 await button(main,'新增数据源',`document.querySelector('.discovery-intake')`);await until(()=>js(main,`Boolean(document.querySelector('.discovery-source-catalog'))`),'Home → original source catalogue');
 await home(main,'a');await button(main,'导入资料',`document.querySelector('.discovery-intake')`);await until(()=>js(main,`Boolean(document.querySelector('.imports-page .import-form'))`),'Home → original import form');
 await home(main,'a');await button(main,'写随手记',`document.querySelector('.discovery-intake')`);await until(()=>js(main,`Boolean(document.querySelector('#note-text'))`),'Home → original Notes');
 await input(main,'#note-text','GENERATED_HOME_A_SUBMITTED_NOTE');await js(main,`document.querySelector('form.note-composer').requestSubmit()`);await until(async()=>JSON.stringify(await command('read',{owner:'a',path:'/api/captures?limit=30'})).includes('GENERATED_HOME_A_SUBMITTED_NOTE'),'Home Notes actually reaches owned Ingress');
 await input(main,'#note-text','GENERATED_HOME_A_DRAFT');main.reload();await until(()=>js(main,`document.querySelector('#note-text')?.value==='GENERATED_HOME_A_DRAFT'`),'A draft survives actual document reload');
 checks.push('Home source/import entry destinations and original note submission; same-account draft reload');
 await home(main,'a');await route(main,'#/preferences');await until(()=>js(main,`Boolean(document.querySelector('[aria-label="当前账号"]'))`),'account page before held original Home');
 await command('hold',{key:'GET:/api/captures?'});await route(main,'#/today');await until(()=>events.some(event=>event.event==='entered'&&event.key==='GET:/api/captures?'),'real successful A Home response is held');
 const switcher=await open('#/preferences');await until(()=>js(switcher,`Boolean(document.querySelector('[data-session="ready"]'))`),'second tab restores A');await login(switcher,'b');await until(()=>js(main,`Boolean(document.querySelector('[data-session="signed-out"]'))`),'cross-tab account switch retires old Home');
 main.reload();await until(()=>js(main,`Boolean(document.querySelector('[data-session="ready"]'))`),'main document restores B');await home(main,'b');await command('release',{key:'GET:/api/captures?'});await delay(120);assert.doesNotMatch(await text(main),/GENERATED_HOME_A_|GENERATED_IAB_ANSWER_A/);
 await route(main,'#/library/notes');await until(()=>js(main,`Boolean(document.querySelector('#note-text'))`),'B original Notes');assert.equal(await js(main,`document.querySelector('#note-text').value`),'');
 await login(main,'a');await route(main,'#/library/notes');await until(()=>js(main,`document.querySelector('#note-text')?.value==='GENERATED_HOME_A_DRAFT'`),'rotated A session restores owner draft');await login(main,'b');
 checks.push('same capture/device IDs A→B; held successful A Home body retired; B draft empty and rotated A draft restored');
 await route(main,'#/connections/devices');await until(()=>js(main,`document.querySelector('.device-card')?.textContent.includes('GENERATED_HOME_B_DEVICE_ERROR')`),'original B device heartbeat');
 const before=(await command('requests',{prefix:'/api/ingress/devices'})).filter(request=>request.method==='GET'),started=Date.now();
 await command('heartbeat',{owner:'b',pending:0,error:null});
 await until(()=>js(main,`(()=>{const card=document.querySelector('.device-card');return card&&!card.textContent.includes('GENERATED_HOME_B_DEVICE_ERROR')&&[...card.querySelectorAll('dl>div')].some(row=>row.querySelector('dt')?.textContent==='上报的待同步记录'&&row.querySelector('dd')?.textContent.trim()==='0 条');})()`),'actual unaccelerated 30-second heartbeat/error/queue refresh',38000);
 const after=(await command('requests',{prefix:'/api/ingress/devices'})).filter(request=>request.method==='GET');assert.ok(after.length>before.length);assert.ok(Date.now()-started>=25000,'real production timer is not accelerated');
 receipts.push({devices:{before:before.length,after:after.length,elapsedMs:Date.now()-started,realInterval:true}});await capture(main,'devices-desktop-b');
 main.setContentSize(390,844);await delay(120);await capture(main,'devices-mobile-b');await home(main,'b');await capture(main,'home-mobile-b');
 // Home also consumes the device resource. Leave both hosts before checking
 // cleanup, then wait an entire production period without a private read.
 await route(main,'#/preferences');await until(()=>js(main,`Boolean(document.querySelector('[aria-label="当前账号"]'))`),'leave every device consumer');const stopped=(await command('requests',{prefix:'/api/ingress/devices'})).filter(request=>request.method==='GET').length;await delay(31000);assert.equal((await command('requests',{prefix:'/api/ingress/devices'})).filter(request=>request.method==='GET').length,stopped,'unmounted Home/Devices stop the subscription');
 checks.push('actual unaccelerated visible 30-second heartbeat/queue/error refresh; unmount stops device reads; desktop/mobile original layout');
 await login(main,'empty');await route(main,'#/today');await until(()=>js(main,`Boolean(document.querySelector('.home-page'))&&[...document.querySelectorAll('.home-purpose-actions button')].some(button=>button.textContent.trim()==='导入资料')`),'new account original Home starts with import');assert.equal(await js(main,`document.querySelectorAll('.home-record-list .capture-card').length`),0);assert.doesNotMatch(await text(main),/GENERATED_HOME_[AB]_|GENERATED_IAB_ANSWER_[AB]/);await capture(main,'home-mobile-empty');await button(main,'导入资料',`document.querySelector('.home-purpose-actions')`);await until(()=>js(main,`Boolean(document.querySelector('.imports-page .import-form'))`),'new account primary import opens original workflow');checks.push('empty new account retains original direct import and source actions');
 assert.deepEqual(errors,[]);if(process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD)assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),candidate);
 writeFileSync(join(output,'result.json'),JSON.stringify({passed:true,candidate,preFreeze:!process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD,runnerSha256:hash(__filename),fixtureSha256:hash(join(__dirname,'fixtures/multiuser-home-host.ts')),webIndexSha256:hash(join(repo,'apps/web/dist/index.html')),actualProductionEntry:true,hiddenRenderer:true,generatedOnly:true,liveExternal:false,checks,receipts},null,2));console.log(JSON.stringify({passed:true,candidate,output,checks}));
}
async function finish(code){
 if(finishing)return;finishing=true;for(const window of windows)if(!window.isDestroyed())window.destroy();
 if(host&&host.exitCode===null){const exited=new Promise(resolve=>host.once('exit',(exitCode,signal)=>resolve({exitCode,signal})));try{await command('close');assert.deepEqual(await Promise.race([exited,delay(20000).then(()=>null)]),{exitCode:0,signal:null},'production host closes naturally');}catch(error){console.error(String(error));host.kill('SIGKILL');code=1;}}
 else if(host&&host.exitCode!==0)code=1;
 rmSync(temporary,{recursive:true,force:true});app.exit(code);
}
run().then(()=>finish(0),async error=>{console.error(error.stack??error);console.error(logs.join(''));for(const window of windows)if(!window.isDestroyed()){try{console.error((await text(window)).slice(-5000));writeFileSync(join(output,'failure-'+window.id+'.png'),(await window.webContents.capturePage()).toPNG());}catch{}}await finish(1);});
