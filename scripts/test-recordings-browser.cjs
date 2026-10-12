require('./fixture-language.cjs');
const {app,BrowserWindow}=require('electron');
const {spawn}=require('node:child_process');
const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {tmpdir}=require('node:os');
const assert=require('node:assert/strict');

const directory=mkdtempSync(join(tmpdir(),'mote-recording-browser-'));
const repo=resolve(__dirname,'..'),out=join(repo,'.mote/recordings');
mkdirSync(out,{recursive:true});app.setPath('userData',join(directory,'browser'));
rmSync(join(out,'failure.json'),{force:true});
app.on('window-all-closed',()=>{});
let child,window;
const delay=ms=>new Promise(r=>setTimeout(r,ms));

async function run(){
 await app.whenReady();
 const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('MOTE_'))delete env[key];
 child=spawn(process.env.MOTE_FIXTURE_NODE||'node',['--import','tsx','scripts/recordings-browser-fixture.ts',directory],{cwd:repo,env,stdio:['ignore','pipe','pipe']});
 const fixture=await new Promise((resolve,reject)=>{
  let text='',errors='';
  const timeout=setTimeout(()=>reject(Error('Fixture startup timed out: '+errors.slice(-4000))),30000);
  child.stderr.on('data',b=>errors+=b);
  child.stdout.on('data',b=>{
   text+=b;
   for(const line of text.split('\n'))try{const value=JSON.parse(line);if(value.generatedOnly){clearTimeout(timeout);resolve(value);}}catch{}
  });
  child.on('exit',()=>{clearTimeout(timeout);reject(Error('Fixture exited: '+errors.slice(-4000)));});
 });
 assert.deepEqual(fixture.providers,['feishu','dingtalk']);
 const endpoint='http://127.0.0.1:'+fixture.server.port,errors=[],requests=[];
 window=new BrowserWindow({width:1360,height:1000,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 const wc=window.webContents,js=code=>wc.executeJavaScript(code);
 wc.on('console-message',(_event,level,message)=>{if(level>=3)errors.push(message);});
 wc.session.webRequest.onBeforeRequest({urls:[endpoint+'/api/*']},(details,done)=>{
  requests.push({phase:'request',method:details.method,path:new URL(details.url).pathname});done({});
 });
 wc.session.webRequest.onResponseStarted({urls:[endpoint+'/api/*']},details=>{
  requests.push({phase:'response',method:details.method,path:new URL(details.url).pathname,status:details.statusCode});
 });
 const api=async path=>{
  const response=await fetch(endpoint+path,{headers:{Authorization:'Bearer '+fixture.token}});
  assert.equal(response.status,200,path+' must be available through the owner API');return response.json();
 };
 const until=async(fn,label)=>{
  const end=Date.now()+30000;
  while(Date.now()<end){if(await fn())return;await delay(20);}
  writeFileSync(join(out,'failure.json'),JSON.stringify({label,errors,requests,body:await js('document.body.innerText')},null,2));
  throw Error('Timed out: '+label);
 };
 const click=async text=>until(()=>js(`(()=>{const button=[...document.querySelectorAll('button')].find(button=>button.getClientRects().length&&button.textContent.trim()===${JSON.stringify(text)});if(!button||button.disabled)return false;button.click();return true})()`),text);
 const textarea=()=>js(`document.querySelector('.lark-step textarea')?.value`);
 const fillDescription=async description=>{
  await until(()=>js(`!!document.querySelector('.lark-step textarea')&&!document.querySelector('.lark-step textarea').disabled`),'source description is ready for input');
  await js(`(()=>{const input=document.querySelector('.lark-step textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,${JSON.stringify(description)});input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
  await until(()=>js(`!document.querySelector('.recording-save-bar > .button.primary')?.disabled`),'editable source description');
 };
 const saved=()=>until(()=>js(`document.querySelector('.recording-save-bar [role=status]')?.textContent==='设置已保存。'`),'saved settings acknowledgement');
 const selectionRequests=provider=>requests.filter(request=>request.phase==='request'&&request.method==='PUT'&&request.path===`/api/connectors/${provider}-recordings/selection`).length;
 const sourceContext=sourceId=>api('/api/sources/'+encodeURIComponent(sourceId)+'/context');
 const openProvider=async(provider,description)=>{
  await window.loadURL(endpoint+'/#/connections/recordings?provider='+provider);
  await until(()=>js(`!!document.querySelector('.lark-settings .lark-step')`),provider+' recording detail');
  if(description!==undefined){
   await until(async()=>await textarea()===description&&await js(`!document.querySelector('.lark-step textarea').disabled`),provider+' restored source description');
   assert.equal(await js(`document.querySelector('.recording-save-bar > .button.primary').disabled`),true,'saved settings have no pending changes');
  }
 };
 const materialContext=async(sourceId,description,version)=>{
  let material;
  await until(async()=>{
   const list=await api('/api/materials?sourceId='+encodeURIComponent(sourceId));
   if(!list.items.length)return false;
   material=await api('/api/materials/'+list.items[0].id);
   return material.attributionContext?.sourceContextStatements?.some(statement=>statement.sourceId===sourceId&&statement.description===description&&statement.version===version);
  },'formal material receives source description version '+version);
  assert.deepEqual(material.attributionContext.sourceContextStatements,[{sourceId,version,description}],'formal material context remains scoped to its provider');
  return material.id;
 };

 await window.loadURL(endpoint+'/#/connections/recordings');
 await click('登录 Mote');
 await until(()=>js(`!!document.querySelector('.connect-modal input[type=password]')`),'management login form');
 await js(`(()=>{const input=document.querySelector('.connect-modal input[type=password]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(fixture.token)});input.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
 await click('登录并继续');
 await until(()=>js(`document.body.innerText.includes('已登录 ·')`),'production browser management session');
 assert.ok(requests.some(request=>request.phase==='response'&&request.method==='POST'&&request.path==='/api/login/session'&&request.status===200),'login creates an acknowledged browser session');
 await until(()=>js(`document.querySelectorAll('.discovery-source-card[href*="/connections/recordings?provider="]').length===2`),'recording source directory');
 await js(`document.querySelector('.discovery-source-card[href="#/connections/recordings?provider=feishu"]').click()`);
 await until(()=>js(`!!document.querySelector('.lark-settings .lark-step')`),'feishu recording detail from directory');
 const summaries=[];
 const descriptions={feishu:'Generated Feishu diary: I recorded these personal notes; anonymous speakers remain uncertain.',dingtalk:'Generated DingTalk interviews: participants describe their own experience; I am the interviewer.'};
 const sourceIds={};

 for(const provider of fixture.providers){
  if(provider!=='feishu')await openProvider(provider);
  await click('连接已授权账号');
  await until(()=>js(`!!document.querySelector('.lark-step textarea')&&!document.querySelector('.lark-step textarea').disabled`),provider+' connected source editor');
  const status=await api(`/api/connectors/${provider}-recordings`);
  sourceIds[provider]=status.sourceId;assert.ok(status.sourceId);
  assert.equal((await sourceContext(status.sourceId)).version,0);
  assert.equal(await textarea(),'','new provider has no inherited source description');
  assert.equal(requests.some(request=>request.path.endsWith('/content')),false,'opening settings must not fetch audio');
  await fillDescription(descriptions[provider]);
  await js(`document.querySelector('.lark-step .lark-check input[type=checkbox]').click()`);
  const from=requests.length;
  await click('保存并开始同步');await saved();
  const saving=requests.slice(from),contextPath='/api/sources/'+status.sourceId+'/context';
  const declaration=saving.findIndex(request=>request.phase==='request'&&request.method==='PATCH'&&request.path===contextPath);
  const ack=saving.findIndex(request=>request.phase==='response'&&request.method==='PATCH'&&request.path===contextPath&&request.status===200);
  const selection=saving.findIndex(request=>request.phase==='request'&&request.method==='PUT'&&request.path===`/api/connectors/${provider}-recordings/selection`);
  assert.ok(declaration>=0&&ack>declaration&&selection>ack,'source context ACK precedes enabling recording intake');
  assert.equal(selectionRequests(provider),1);
  const context=await sourceContext(status.sourceId);
  assert.equal(context.description,descriptions[provider]);assert.equal(context.version,1);
  await until(()=>js(`document.querySelector('.lark-step > p[role=status]')?.textContent.includes('已归档转写 1 条，音频 1 条')`),provider+' background text and media intake');
  await materialContext(status.sourceId,descriptions[provider],1);
  assert.equal(requests.some(request=>request.path.endsWith('/content')),false,'background audio backup does not trigger browser audio reads');
  assert.ok(await js(`(()=>{const primary=document.querySelector('.recording-save-bar > .button.primary'),secondary=document.querySelector('.lark-buttons');return primary&&secondary&&secondary.getBoundingClientRect().top>=primary.getBoundingClientRect().bottom})()`),'primary save action has its own row before secondary actions');
  await window.loadURL(wc.getURL());
  await until(async()=>await textarea()===descriptions[provider],provider+' source description survives refresh');
  assert.equal(await js(`document.querySelector('.recording-save-bar > .button.primary').disabled`),true,'refresh leaves saved settings clean');
  summaries.push({provider,version:1,selectionRequests:1,contextAcknowledgedBeforeIntake:true,formalMaterialContext:true,refreshPreserved:true});
 }
 assert.notEqual(sourceIds.feishu,sourceIds.dingtalk,'providers own independent sources');

 await openProvider('feishu',descriptions.feishu);
 const updated='Generated Feishu diary, revised scope: my own narration only; quoted people retain their identity.';
 const selectionBefore=selectionRequests('feishu');
 await fillDescription(updated);await click('保存设置');await saved();
 assert.equal(selectionRequests('feishu'),selectionBefore,'source description edit does not restart selection or intake');
 let context=await sourceContext(sourceIds.feishu);
 assert.equal(context.version,2);assert.equal(context.description,updated);
 await materialContext(sourceIds.feishu,updated,2);
 assert.equal((await sourceContext(sourceIds.dingtalk)).description,descriptions.dingtalk,'editing Feishu does not alter DingTalk');
 await openProvider('dingtalk',descriptions.dingtalk);
 await openProvider('feishu',updated);
 await fillDescription('');await click('保存设置');await saved();
 assert.equal(selectionRequests('feishu'),selectionBefore,'clearing source description does not restart selection or intake');
 context=await sourceContext(sourceIds.feishu);
 assert.equal(context.version,3);assert.equal(context.description,'');
 await materialContext(sourceIds.feishu,'',3);
 await openProvider('feishu','');
 assert.equal((await sourceContext(sourceIds.dingtalk)).version,1,'clearing Feishu retains DingTalk context version');

 await fillDescription(updated);
 await js(`document.querySelector('.recording-save-bar').scrollIntoView({block:'center'})`);
 writeFileSync(join(out,'desktop-save.png'),(await wc.capturePage()).toPNG());
 await click('保存设置');await saved();
 assert.equal(selectionRequests('feishu'),selectionBefore);
 await materialContext(sourceIds.feishu,updated,4);
 await until(()=>js(`!!document.querySelector('.source-item .text-button')`),'recent archive');
 await js(`[...document.querySelectorAll('summary')].find(summary=>summary.textContent.startsWith('最近归档的录音')).click()`);
 await click('回听原始录音');
 await until(()=>js(`document.querySelector('audio')?.readyState>=2`),'archived audio decoder');
 const duration=await js('document.querySelector("audio").duration');assert.equal(duration,1);
 assert.ok(requests.some(request=>request.path.startsWith('/api/archived-files/')&&request.path.endsWith('/content')));
 window.setSize(430,1000);await delay(150);
 await js(`document.querySelector('.recording-save-bar').scrollIntoView({block:'center'})`);
 assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'),'mobile layout has no horizontal overflow');
 writeFileSync(join(out,'mobile.png'),(await wc.capturePage()).toPNG());
 assert.deepEqual(errors,[]);
 const result={passed:true,generatedOnly:true,modelCalls:0,physicalDeviceTested:false,productionBrowserLogin:true,providers:summaries,sourceContextOnlyEdits:true,sourceContextClearVersion:3,providerContextsIndependent:true,audioDuration:duration,lazyBrowserAudio:true,mobileWidth:430};
 writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}

async function finish(code){
 if(window&&!window.isDestroyed())window.destroy();
 if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),delay(5000)]);}
 rmSync(directory,{recursive:true,force:true});app.exit(code);
}
run().then(()=>finish(0)).catch(error=>{console.error(error);finish(1);});
