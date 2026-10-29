require('../../../scripts/fixture-background.cjs');
require('../../../scripts/fixture-language.cjs');
const {app,safeStorage,ipcMain}=require('electron');
const {createServer}=require('node:http');
const {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {tmpdir}=require('node:os');
const {randomUUID,createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const {defaultConfig}=require('../dist/config');
const profile=mkdtempSync(join(tmpdir(),'mote-final-ask-'));
app.setPath('userData',profile);process.env.MOTE_PROFILE='dev';
for(const key of ['MOTE_URL','MOTE_TOKEN','MOTE_ENV_FILE'])delete process.env[key];
safeStorage.isEncryptionAvailable=()=>{throw Error('Dev fixture must not access safeStorage');};
const directory=join(profile+'-profiles','dev');mkdirSync(directory,{recursive:true,mode:0o700});
const output=resolve(__dirname,'../../../.mote/final-ui-product/ask');mkdirSync(output,{recursive:true});
const implementation={revision:execFileSync('git',['rev-parse','HEAD'],{cwd:resolve(__dirname,'../../..')}).toString().trim(),dirty:Boolean(execFileSync('git',['status','--porcelain'],{cwd:resolve(__dirname,'../../..')}).toString().trim()),loadedFiles:Object.fromEntries(['main.js','ui-bundle.js','index.html','styles.css'].map(file=>[file,createHash('sha256').update(readFileSync(resolve(__dirname,'../dist',file))).digest('hex')]))};
const token='generated-ask-owner-token-'.repeat(3),conversationId=randomUUID(),otherId=randomUUID(),evidenceId=randomUUID(),turnId=randomUUID();
const title='周五评审需要准备什么？',answer='准备一份常用资料，把保存、阅读和引用返回的路径走一遍。 ['+evidenceId+']\n\n- 先保存资料。\n- 再核对原文和引用。';
let main,finished=false,historyFailure=false,availability=true,mode='normal',run;
const captures=[],requests=[],errors=[],navigation=[];
const register=ipcMain.handle.bind(ipcMain);ipcMain.handle=(channel,handler)=>register(channel,(event,...args)=>{if(channel==='mote:central'){navigation.push(args);return;}return handler(event,...args);});
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture');requests.push({method:req.method,url:req.url});res.setHeader('content-type','application/json');assert.equal(req.headers.authorization,'Bearer '+token);
  if(url.pathname==='/api/conversations'){res.statusCode=historyFailure?503:200;res.end(JSON.stringify({items:[{id:conversationId,title,turnCount:1,updatedAt:'2026-10-29T09:40:00Z'},{id:otherId,title:'另一段生成的对话',turnCount:1,updatedAt:'2026-10-28T09:40:00Z'}]}));return;}
  if(url.pathname==='/api/conversations/'+conversationId+'/references/'+evidenceId){res.end(JSON.stringify({id:evidenceId,available:availability}));return;}
  if(url.pathname.startsWith('/api/conversations/')){const id=url.pathname.split('/')[3];res.end(JSON.stringify({id,title:id===conversationId?title:'另一段生成的对话',revision:1,scope:{anchorEvidenceIds:[evidenceId]},turns:[{id:turnId,question:title,status:'completed',...(mode==='stale'?{evidenceStale:true}:mode==='unavailable'?{evidenceStale:true,evidenceUnavailable:true}:mode==='privacy'?{evidenceDeleted:true}:{}),result:{answer,citations:[{id:evidenceId,appName:'评审议程.md',capturedAt:'2026-10-29T09:00:00Z',excerpt:'Generated exact quotation <script>literal</script>'}]}}]}));return;}
  if(url.pathname==='/api/query-runs'&&req.method==='GET'){res.end(JSON.stringify({items:run?.status==='running'?[run]:[]}));return;}
  if(url.pathname==='/api/query-runs'&&req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);assert.equal(input.input.conversationId,conversationId);run={id:input.id,conversationId,status:'running',events:[{stage:'query',message:'正在读取资料'}]};res.end(JSON.stringify(run));return;}
  if(url.pathname.startsWith('/api/query-runs/')){if(url.pathname.endsWith('/cancel'))run={...run,status:'cancelled'};res.end(JSON.stringify(run));return;}
  if(url.pathname==='/api/capture-browser'){res.end('{"items":[],"totalCount":0}');return;}
  if(url.pathname==='/api/connections/self'){res.end(JSON.stringify({credential:{id:'fixture',scope:'owner'},node:{version:'fixture',profile:'fixture',protocol:{min:1,max:1}},capabilities:{ingest:true,ownSources:true,archiveRead:true}}));return;}
  res.statusCode=404;res.end('{}');
});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async(check,label)=>{for(let i=0;i<400;i++){if(await check())return;await delay(25);}throw Error('Timed out: '+label);};
const timeout=setTimeout(()=>{console.error('Final Ask fixture timed out');app.exit(1);},60000);
app.on('browser-window-created',(_event,window)=>{
 if(main)return;main=window;window.webContents.on('console-message',(_e,level,message)=>{if(level>=3)errors.push(message);});
 window.webContents.once('did-finish-load',()=>void(async()=>{
  const js=code=>window.webContents.executeJavaScript(code),ready=()=>js('!document.querySelector("#ask-new").disabled');
  const shot=async name=>{await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const image=await window.webContents.capturePage(),file=join(output,name+'.png');writeFileSync(file,image.toPNG());captures.push({name,file,pixels:image.getSize(),viewport:await js('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})'),at:new Date().toISOString()});};
  await until(()=>js('!!document.querySelector("[data-presentation-nav]")&&!document.querySelector("#settings-fields").disabled'),'ready');assert.equal(window.isVisible(),false);window.setContentSize(1440,936);
  await js('document.querySelector("aside [data-nav=ask]").click()');await until(()=>js('document.querySelectorAll("#ask-history button").length===2&&!document.querySelector("#ask-new").disabled'),'history');assert.equal(await js('document.querySelector("#ask-conversation-panel").hidden'),true);await shot('ask-history');
  await js('document.querySelector("#ask-history button").click()');await until(()=>js('document.querySelector("#ask-messages").textContent.includes("准备一份常用资料")&&!document.querySelector("#ask-new").disabled'),'conversation');assert.equal(await js('document.querySelector("#ask-history-panel").hidden'),true);assert.equal(await js('document.querySelector("#ask-send").disabled'),true);await shot('ask-conversation');
  await js('document.querySelector("#ask-question").value="生成的未发送追问";document.querySelector("#ask-question").dispatchEvent(new Event("input"))');
  availability=false;await js('document.querySelector(".ask-inline-citation").click()');await until(()=>js('document.querySelector("#ask-reference-dialog").open'),'unavailable reference');assert.equal(navigation.length,0);assert.equal(await js('document.querySelector("#ask-question").value'),'生成的未发送追问');await shot('ask-reference-unavailable');
  await js('document.querySelector("#ask-reference-back").click()');availability=true;await js('document.querySelector(".ask-reference-row").click()');await until(()=>navigation.length===1,'available reference handoff');assert.deepEqual(navigation[0],['ask',evidenceId]);assert.equal(await js('document.querySelector("#ask-question").value'),'生成的未发送追问');
  await until(ready,'evidence action completed');await js('document.querySelector("#ask-back").click()');await until(ready,'history return');assert.equal(await js('document.querySelector("#ask-history-panel").hidden'),false);
  await js('window.confirm=()=>false;document.querySelectorAll("#ask-history button")[1].click()');assert.equal(await js('document.querySelector("#ask-history-panel").hidden'),false);assert.equal(await js('document.querySelector("#ask-question").value'),'生成的未发送追问');
  await js('document.querySelector("#ask-history button").click()');await until(ready,'same conversation restored');assert.equal(await js('document.querySelector("#ask-question").value'),'生成的未发送追问');
  mode='stale';await js('document.querySelector("#ask-refresh").click()');await until(()=>js('document.querySelector("#ask-messages").textContent.includes("这是历史版本")'),'stale flag');await shot('ask-stale');
  mode='unavailable';await js('document.querySelector("#ask-refresh").click()');await until(()=>js('document.querySelector("#ask-messages").textContent.includes("历史问答仍保留")'),'deleted original');assert(await js('document.querySelector("#ask-messages").textContent.includes("准备一份常用资料")'));await shot('ask-history-preserved');
  mode='privacy';await js('document.querySelector("#ask-refresh").click()');await until(()=>js('document.querySelector("#ask-messages").textContent.includes("隐私要求")'),'privacy erase');assert.equal(await js('document.querySelector("#ask-messages").textContent.includes("准备一份常用资料")'),false);assert.equal(await js('document.querySelectorAll("#ask-messages .ask-inline-citation, #ask-messages .ask-reference-row").length'),0);await shot('ask-privacy-erased');
  mode='normal';await js('document.querySelector("#ask-refresh").click()');await until(ready,'refresh ready');await js('document.querySelector("#ask-form").requestSubmit()');await until(()=>js('!document.querySelector("#ask-stop").hidden'),'run started');assert.equal(await js('document.querySelector("#ask-send").disabled'),true);assert(await js('document.querySelector("#ask-messages").textContent.includes("生成的未发送追问")'));await shot('ask-running');
  await js('document.querySelector("#ask-stop").click()');await until(()=>js('document.querySelector("#ask-stop").hidden&&!document.querySelector("#ask-new").disabled'),'cancelled');assert.equal(run.status,'cancelled');await shot('ask-stopped');
  await js('document.querySelector("#ask-question").value="保留输入";document.querySelector("#ask-question").dispatchEvent(new Event("input"));window.confirm=()=>false;document.querySelector("#ask-new").click()');assert.equal(await js('document.querySelector("#ask-question").value'),'保留输入');
  await js('window.confirm=()=>true;document.querySelector("#ask-new").click()');assert.equal(await js('document.querySelector("#ask-question").value'),'');assert.equal(await js('document.querySelector("#ask-fresh").hidden'),false);await shot('ask-new');
  historyFailure=true;await js('document.querySelector("#ask-back").click()');await until(()=>js('document.querySelector("#ask-error").textContent.includes("对话暂不可读取")'),'history failure');assert.equal(await js('document.querySelector("#ask-error").textContent.includes("mote:ask")'),false);await shot('ask-history-error');
  historyFailure=false;await js('document.querySelector("#ask-refresh").click()');await until(ready,'history retry');window.setContentSize(820,620);await shot('ask-compact');assert(await js('document.documentElement.scrollWidth<=innerWidth'));assert.deepEqual(errors,[]);
  writeFileSync(join(output,'result.json'),JSON.stringify({passed:true,implementation,generatedOnly:true,hidden:true,electron:process.versions.electron,palette:'9bf780ac',realRendererPreloadIpc:true,liveModel:false,externalBrowserBoundary:'captured IPC target; existing real handoff contract unchanged',checks:['history and single column conversation','draft preserved across reference/back/cancel','exact availability-gated citation handoff','history preserved after ordinary delete','privacy result redacted','running and cancellation','new conversation confirmation','history error and retry','compact no horizontal overflow'],captures},null,2));finished=true;clearTimeout(timeout);console.log(JSON.stringify({passed:true,output,captures:captures.length}));app.quit();
 })().catch(error=>{console.error(error.stack);console.error(errors);clearTimeout(timeout);app.exit(1);}));
});
app.on('window-all-closed',()=>{if(!finished)app.exit(1);});app.on('quit',()=>{server.close();rmSync(profile,{recursive:true,force:true});rmSync(profile+'-profiles',{recursive:true,force:true});});
server.listen(0,'127.0.0.1',()=>{const config={...defaultConfig(),serverUrl:'http://127.0.0.1:'+server.address().port,deviceName:'这台 Mac',metadataEnabled:false,syncMode:'manual',credentialScope:'owner'};writeFileSync(join(directory,'config.json'),JSON.stringify({version:4,developmentToken:token,config}),{mode:0o600});writeFileSync(join(directory,'storage-format.json'),JSON.stringify({version:4}),{mode:0o600});require('../dist/main');});
