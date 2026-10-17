require('../../../scripts/fixture-background.cjs');
require('../../../scripts/fixture-language.cjs');
/** Generated-only adjacent journey: the real Work results link opens canonical
 * Ask history after an ordinary revision, and disappears after source erasure.
 * No current execution, operational artifact or model authority is substituted.
 */
const {app,BrowserWindow}=require('electron');
const {spawn,execFileSync}=require('node:child_process');
const {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync,readdirSync}=require('node:fs');
const {tmpdir}=require('node:os'),{resolve,join}=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {createConnection}=require('node:net');
const assert=require('node:assert/strict');
const repo=resolve(__dirname,'../../..'),root=mkdtempSync(join(tmpdir(),'mote-work-history-web-'));
const out=join(repo,'.mote/multiuser-work-history-browser');mkdirSync(out,{recursive:true});
app.setPath('userData',join(root,'browser'));app.on('window-all-closed',()=>{});
const sha=value=>createHash('sha256').update(value).digest('hex'),delay=ms=>new Promise(done=>setTimeout(done,ms));
const head=()=>execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const candidate=head(),runnerSha256=sha(readFileSync(__filename));
const fixture='apps/android/test-fixtures/main-history-backend.ts',fixtureSha256=sha(readFileSync(join(repo,fixture)));
const originalRunner='apps/web/test/multiuser-integrated-browser.cjs',originalRunnerSha256=sha(readFileSync(join(repo,originalRunner)));
const windows=[],receipts=[],errors=[];let host,finishing=false,proof,failure;
const timer=setTimeout(()=>{console.error('Work history Web regression timed out');void finish(1);},900000);
function sourceReceipt(){
 const files={},visit=relative=>{for(const entry of readdirSync(join(repo,relative),{withFileTypes:true})){const name=relative+'/'+entry.name;if(entry.isDirectory())visit(name);else if(entry.isFile())files[name]=sha(readFileSync(join(repo,name)));}};
 for(const path of ['apps/server/src','apps/web/src','apps/web/public','apps/web/dist','packages/shared/src','packages/shared/dist','packages/agent/src','packages/agent/dist'])visit(path);
 const sorted=Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b))),aggregate=sha(JSON.stringify(sorted));
 writeFileSync(join(out,'source-'+aggregate+'.json'),JSON.stringify(sorted,null,2));return aggregate;
}
const sourceAtStart=sourceReceipt();
async function until(read,label,ms=30000){const end=Date.now()+ms;while(Date.now()<end){if(await read())return;await delay(40);}throw Error('Timed out: '+label);}
const js=(page,code)=>page.webContents.executeJavaScript(code),text=page=>js(page,'document.body.innerText');
const ready=page=>until(()=>js(page,`Boolean(document.querySelector('[data-session="ready"]'))`),'ready scoped session');
async function button(page,label,scope='document'){
 await until(()=>js(page,`(()=>{const root=${scope};if(!root)return false;const b=[...root.querySelectorAll('button')].find(b=>b.getClientRects().length&&(b.textContent.trim()===${JSON.stringify(label)}||b.getAttribute('aria-label')===${JSON.stringify(label)}));if(!b||b.disabled)return false;b.click();return true;})()`),'enabled original button '+label);
}
async function input(page,selector,value){
 await until(()=>js(page,`Boolean(document.querySelector(${JSON.stringify(selector)})&&!document.querySelector(${JSON.stringify(selector)}).disabled)`),'input '+selector);
 await js(page,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}
const route=(page,hash)=>js(page,`location.hash=${JSON.stringify(hash)};true`);
async function reload(page){const loaded=new Promise(done=>page.webContents.once('did-finish-load',done));page.reload();await loaded;await ready(page);}
async function login(page,owner){
 if(!await js(page,`Boolean(document.querySelector('.connect-modal'))`)){
  if(!await js(page,`Boolean(document.querySelector('[aria-label="当前账号"]'))`)){
   await until(()=>js(page,`Boolean(document.querySelector('.avatar'))`),'login shell');await js(page,`document.querySelector('.avatar').click()`);
   await until(()=>js(page,`Boolean(document.querySelector('.connect-modal')||document.querySelector('[aria-label="当前账号"]'))`),'existing avatar account destination');
  }
  if(!await js(page,`Boolean(document.querySelector('.connect-modal'))`))await button(page,'切换账号');
 }
 await input(page,'.connect-modal [aria-label="用户名"]','generated-'+owner);await input(page,'.connect-modal [aria-label="密码"]',host.meta.password);
 await button(page,'登录并继续');await ready(page);assert.equal(await js(page,`document.querySelector('.avatar').textContent`),'generated-'+owner);
 const ownerState=await browserRead(page,'/api/auth/self');assert.equal(ownerState.userId,host.meta[owner].userId,'Cookie session is the generated real owner');
}
async function open(){
 const page=new BrowserWindow({width:1360,height:1000,show:false,webPreferences:{partition:host.partition,contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});windows.push(page);
 if(!host.observingReads){host.observingReads=true;page.webContents.session.webRequest.onCompleted({urls:[host.origin+'/api/context/read']},details=>host.readerResponses.push({webContentsId:details.webContentsId,method:details.method,status:details.statusCode}));}
 page.webContents.on('render-process-gone',(_event,details)=>errors.push(details.reason));
 page.webContents.on('console-message',event=>{if(event.level==='error'&&/Uncaught|Minified React error/.test(event.message))errors.push(event.message);});
 await page.loadURL(host.origin+'/#/activity');return page;
}
async function start(){
 const startedAt=Date.now(),privateFile=join(root,'generated-history-private.json');
 host={partition:'generated-'+randomUUID(),logs:[],readerResponses:[],closed:false,privateFile};
 host.child=spawn(process.env.MOTE_WEB_FIXTURE_NODE,['--import','tsx',join(repo,fixture),privateFile],{cwd:repo,stdio:['ignore','pipe','pipe']});
 host.exit=new Promise(done=>host.child.once('exit',(code,signal)=>done({code,signal})));
 let buffer='';host.child.stdout.on('data',part=>{buffer+=String(part);let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const value=JSON.parse(line);if(!host.meta&&value.address)host.meta=value;}catch{}}});host.child.stderr.on('data',part=>host.logs.push(String(part)));
 await until(()=>{if(host.child.exitCode!==null)throw Error('Generated fixture exited before ready: '+host.logs.join(''));return host.meta;},'22 generated real runs, each retaining its 30000ms guard',22*30000);
 host.meta={...host.meta,...JSON.parse(readFileSync(privateFile,'utf8'))};host.origin=host.meta.webAddress;
 assert.ok(host.origin,'Use the direct production Cookie/Web/SSE host');assert.equal(host.meta.wireVersion??2,2);
 const setup=JSON.parse(readFileSync(privateFile+'.setup.json','utf8'));assert.equal(setup.pid,host.child.pid);assert.equal(setup.generatedOnly,true);host.directory=setup.directory;
 const sourceReady=sourceReceipt();assert.equal(sourceReady,sourceAtStart,'Production source and assets stayed frozen during real fixture preparation');
 receipts.push({phase:'setup',fixture,fixtureSha256,pid:host.child.pid,webOrigin:host.origin,proxyOrigin:host.meta.address,controlOrigin:host.meta.controlAddress,setupMs:Date.now()-startedAt,setupTimeoutMs:22*30000,generatedRunGuardMs:30000,generatedRuns:22,aTurns:21,bTurns:1,sourceReady});
 console.log('READY generated Work/history host '+host.child.pid);
}
async function control(path){const response=await fetch(host.meta.controlAddress+path,{method:'POST'});assert.equal(response.status,200,'real generated control '+path);return response.json();}
async function browserRead(page,path){return js(page,`(async()=>{const self=await(await fetch('/api/auth/self',{headers:{'X-Mote-Protocol-Version':'2'}})).json();const r=await fetch(${JSON.stringify(path)},{headers:{'X-Mote-Protocol-Version':'2','X-Mote-Session-Id':self.credentialId}});if(!r.ok)throw Error('Actual Cookie read failed '+r.status);return r.json();})()`);}
async function screenshot(page,name){
 assert.ok(await js(page,'document.documentElement.scrollWidth<=innerWidth'),'original page fits viewport '+name);
 const bytes=(await page.webContents.capturePage()).toPNG();writeFileSync(join(out,name+'.png'),bytes);return sha(bytes);
}
async function openWork(page,title,id){
 await route(page,'#/activity');await button(page,'最近完成');
 await until(()=>js(page,`(()=>{const card=[...document.querySelectorAll('.activity-list .activity-card')].find(e=>e.querySelector('strong')?.textContent===${JSON.stringify(title)});if(!card)return false;card.click();return true;})()`),'actual completed Work list card '+title);
 await until(()=>js(page,`document.querySelector('.activity-detail h1')?.textContent===${JSON.stringify(title)}`),'actual Work detail');
 assert.equal(await js(page,`new URLSearchParams(location.hash.split('?')[1]).get('work')`),id);
 await button(page,'成果',`document.querySelector('.activity-detail nav')`);
}
async function followSavedLink(page,workId){
 const work=await browserRead(page,'/api/work-activity/'+encodeURIComponent(workId));
 const href='#/ask?conversation='+encodeURIComponent(host.meta.conversationId),saved=work.artifacts.filter(a=>a.href===href);
 assert.equal(saved.length,1,'actual owner Work exposes exactly one saved conversation link');
 await until(()=>js(page,`(()=>{const link=[...document.querySelectorAll('.work-artifact a')].filter(a=>a.getAttribute('href')===${JSON.stringify(href)});if(link.length!==1)return false;link[0].click();return true;})()`),'real Work result href click');
 await until(()=>js(page,`location.hash===${JSON.stringify(href)}&&Boolean(document.querySelector('.conversation-content'))`),'real href reaches same canonical conversation');
 return work;
}
async function verifyAnswer(page,raw,excerpt,index=-1,follow=false){
 const marker=/ \[([0-9a-f-]{36})\]$/.exec(raw);assert.ok(marker,'generated answer has one actual original citation');
 const rendered=await js(page,`(()=>{const turn=[...document.querySelectorAll('.conversation-turn')].at(${index}),markdown=turn.querySelector('.markdown').cloneNode(true),citations=[...markdown.querySelectorAll('.inline-citation')];citations.forEach(c=>c.remove());return {prose:markdown.textContent.trim(),citationCount:citations.length,excerpts:[...turn.querySelectorAll('.citations .citation p')].map(p=>p.textContent)};})()`);
 assert.equal(rendered.prose,raw.slice(0,marker.index),'complete rendered historical prose');assert.equal(rendered.citationCount,1);assert.equal(rendered.excerpts.length,1);if(excerpt!==undefined)assert.ok(rendered.excerpts.includes(excerpt));
 if(follow){
  const before=host.readerResponses.length;
  await js(page,`[...document.querySelectorAll('.conversation-turn')].at(${index}).querySelector('.inline-citation').click()`);
  await until(()=>js(page,`new URLSearchParams(location.hash.split('?')[1]).get('evidence')===${JSON.stringify('context:capture:'+marker[1])}`),'original citation exact declared context reference');
  if(follow==='stale-unavailable'){
   // A retained locator does not authorize its superseded Material as current
   // original evidence (ADR evidence-history-retention, Ownership/permissions).
   await until(()=>host.readerResponses.slice(before).some(r=>r.webContentsId===page.webContents.id&&r.method==='POST'&&r.status===404),'actual stale citation reader rejects the obsolete Material revision');
   await until(()=>js(page,`document.querySelector('.evidence-modal [role="alert"]')?.textContent.includes('资料不存在或已删除。')`),'original strict-current unavailable notice');
   assert.doesNotMatch(await js(page,`document.querySelector('.evidence-modal').textContent`),/GENERATED_HISTORY_A_(?:ANSWER|CITATION)/,'no obsolete original body is disclosed');
   assert.equal(await js(page,`document.querySelectorAll('.evidence-modal .markdown,.evidence-modal .reference-detail h3').length`),0);
  }else{
   await until(()=>host.readerResponses.slice(before).some(r=>r.webContentsId===page.webContents.id&&r.method==='POST'&&r.status===200),'actual owner citation reader HTTP200');
   await until(()=>js(page,`document.querySelector('.evidence-modal')?.textContent.includes(${JSON.stringify(excerpt??rendered.excerpts[0])})`),'actual authorized original citation reader');
  }
  await button(page,'关闭证据详情');
  await until(()=>js(page,`!document.querySelector('.evidence-modal')`),'citation reader closes');
 }
}
const turnCount=page=>js(page,`document.querySelectorAll('.conversation-turn').length`);
const conversationText=page=>js(page,`document.querySelector('.conversation-content')?.textContent??''`);
async function verifyHistory(page,stale){
 await until(async()=>await turnCount(page)===20,'same canonical conversation latest20');
 if(stale)await until(()=>js(page,`[...document.querySelectorAll('.conversation-turn .notice')].filter(e=>e.textContent==='这是历史版本，当前资料已更新。').length===20`),'all latest20 refreshed historical revision notices');
 const current=await browserRead(page,'/api/conversations/'+host.meta.conversationId);assert.equal(current.id,host.meta.conversationId);assert.equal(current.turnCount,21);assert.equal(current.turns.at(-1).result.answer,host.meta.answer,'complete raw historical DTO answer');
 assert.ok(current.turns.every(t=>Boolean(t.evidenceStale)===stale&&!t.evidenceDeleted&&t.result));
 if(stale)assert.deepEqual(current.turns.at(-1).result,host.originalResult,'complete saved answer/citation DTO remains byte-equivalent');else host.originalResult=current.turns.at(-1).result;
 await verifyAnswer(page,host.meta.answer,host.meta.excerpt,-1,stale?'stale-unavailable':true);
 await button(page,'加载更早的对话');await until(async()=>await turnCount(page)===21,'actual older page completes all21 turns');
 await verifyAnswer(page,host.meta.olderAnswer,host.meta.olderExcerpt,0);
 assert.ok((await conversationText(page)).includes(host.meta.olderQuestion));
 const noticeCount=await js(page,`[...document.querySelectorAll('.conversation-turn .notice')].filter(e=>e.textContent==='这是历史版本，当前资料已更新。').length`);
 assert.equal(noticeCount,stale?21:0,'each historical turn has its complete explicit revision notice');
 assert.doesNotMatch(await conversationText(page),/相关证据已删除|这次回答没有完成|再次提问/);
 return current;
}
async function verifyDeleted(page){
 await until(()=>js(page,`document.querySelector('.conversation-content')?.textContent.includes('相关证据已删除，这条历史回答已清除。可以继续提问查阅现有记录。')`),'explicit deleted history notice');
 const value=await browserRead(page,'/api/conversations/'+host.meta.conversationId);assert.equal(value.turnCount,21);assert.ok(value.turns.every(t=>t.evidenceDeleted&&!t.evidenceStale&&!t.result));
 assert.doesNotMatch(JSON.stringify(value),/GENERATED_HISTORY_A_(?:ANSWER|CITATION)/);assert.doesNotMatch(await conversationText(page),/GENERATED_HISTORY_A_(?:ANSWER|CITATION)|这是历史版本|这次回答没有完成|再次提问/);
 return value;
}
async function run(){
 assert.ok(process.env.MOTE_WEB_FIXTURE_NODE&&existsSync(process.env.MOTE_WEB_FIXTURE_NODE),'Select installed Node for the generated production host');
 assert.ok(process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD,'Bind the adjacent proof to an explicit frozen source HEAD');assert.equal(candidate,process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD);
 assert.ok(existsSync(join(repo,'apps/web/dist/index.html')),'Build the current production Web first');
 assert.equal(originalRunnerSha256,'1a864ab114cc3be9d112580ca184acb73614e5193344164456355dd160cef33c','Preserve the accepted eight-group runner byte for byte');
 await app.whenReady();await start();const page=await open();await login(page,'a');
 await openWork(page,host.meta.workTitle,host.meta.workId);await followSavedLink(page,host.meta.workId);await verifyHistory(page,false);
 receipts.push({phase:'current',workList:true,resultsTab:true,actualHrefClick:true,sameConversation:true,latest20AndOlder21:true,completeDTOAndRenderedProse:true,actualCitationReader:true});
 const beforeRevision=await control('/state'),stale=await control('/stale');assert.equal(stale.modelCalls,beforeRevision.modelCalls,'ordinary revision does not replay models');
 await openWork(page,host.meta.workTitle,host.meta.workId);const staleWork=await followSavedLink(page,host.meta.workId);
 assert.equal(staleWork.state,'completed','saved completed Work remains a completed activity');
 assert.equal(staleWork.evidence.count,0);assert.deepEqual(staleWork.evidence.refs,[]);assert.ok(!JSON.stringify(staleWork).includes(host.meta.answer),'saved navigation metadata is not an executable answer disclosure');
 await verifyHistory(page,true);const staleScreenshotSha256=await screenshot(page,'work-stale-history');
 await reload(page);await until(async()=>await turnCount(page)===20,'stale saved history survives a full document reload');await verifyAnswer(page,host.meta.answer,host.meta.excerpt);assert.match(await conversationText(page),/这是历史版本，当前资料已更新。/);
 receipts.push({phase:'stale',actualWorkHrefClick:true,sameConversation:true,latest20AndOlder21:true,completeDTOAndRenderedProse:true,all21ExplicitStaleNotices:true,retainedCitationDisplayAndLocator:true,staleCitationOriginalRead:{actualPostStatus:404,unavailableNotice:true,oldBodyAbsent:true},reload:true,noCurrentWorkEvidencePromoted:true,screenshotSha256:staleScreenshotSha256});
 await openWork(page,host.meta.workTitle,host.meta.workId);
 await until(()=>js(page,`document.querySelectorAll('.work-artifact a').length===1`),'stale saved Work link before actual deletion');
 const deleted=await control('/deleted');assert.equal(deleted.modelCalls,beforeRevision.modelCalls,'erasure does not replay models');
 await until(()=>js(page,`document.querySelectorAll('.work-artifact a').length===0&&document.querySelector('.activity-detail')?.textContent.includes('成果确认保存后会出现在这里。')`),'actual Work polling retires erased saved link');
 assert.deepEqual((await browserRead(page,'/api/work-activity/'+encodeURIComponent(host.meta.workId))).artifacts,[]);
 const erasedWorkScreenshotSha256=await screenshot(page,'work-deleted-link');
 await route(page,'#/ask?conversation='+encodeURIComponent(host.meta.conversationId));await verifyDeleted(page);
 await until(async()=>await turnCount(page)===20,'deleted latest20');await button(page,'加载更早的对话');await until(async()=>await turnCount(page)===21,'deleted older page retains21 erased turn records');await verifyDeleted(page);
 assert.equal(await js(page,`document.querySelectorAll('.conversation-turn .markdown,.conversation-turn .inline-citation,.conversation-turn .citation').length`),0,'no old answer or citation controls remain');
 await reload(page);await verifyDeleted(page);receipts.push({phase:'deleted',realSourceDelete:true,workPollingRemovesLink:true,emptyActualArtifacts:true,directHistoryErasedWithoutResult:true,latest20AndOlder21:true,noFailureRetryCard:true,noOldCitationControls:true,reload:true,screenshotSha256:erasedWorkScreenshotSha256});
 const switcher=await open();await ready(switcher);await login(switcher,'b');await until(()=>js(page,`Boolean(document.querySelector('[data-session="signed-out"]'))`),'A browser authority retires on B Cookie login');
 await reload(page);const bWork=(await browserRead(page,'/api/work-activity?state=completed&limit=100')).items.filter(w=>w.artifacts.some(a=>a.href==='#/ask?conversation='+encodeURIComponent(host.meta.conversationId)));
 assert.equal(bWork.length,1,'B own saved Work is independently present');
 await openWork(page,bWork[0].goal,bWork[0].id);await followSavedLink(page,bWork[0].id);await until(async()=>await turnCount(page)===1,'B same-ID one-turn history');
 const bHistory=await browserRead(page,'/api/conversations/'+host.meta.conversationId);assert.equal(bHistory.turnCount,1);assert.equal(bHistory.turns[0].result.answer,host.meta.bAnswer);assert.ok(!bHistory.turns[0].evidenceDeleted&&!bHistory.turns[0].evidenceStale);
 await verifyAnswer(page,host.meta.bAnswer,undefined,-1,true);assert.doesNotMatch(await conversationText(page),/GENERATED_HISTORY_A_(?:ANSWER|CITATION)|相关证据已删除|这是历史版本/);
 const bScreenshotSha256=await screenshot(page,'work-b-same-conversation');
 const finalState=await control('/state');assert.equal(finalState.modelCalls,beforeRevision.modelCalls,'navigation and owner isolation do not issue model replay');
 receipts.push({phase:'b-positive',sameConversationId:true,ownWorkListAndHref:true,oneTurn:true,completeDTOAndRenderedProse:true,actualCitationReader:true,aNegative:true,noUnexpectedModelReplay:true,screenshotSha256:bScreenshotSha256});
 assert.deepEqual(errors,[]);assert.equal(head(),candidate,'Source HEAD stayed frozen');assert.equal(sourceReceipt(),sourceAtStart,'Production source and built assets stayed frozen');assert.equal(sha(readFileSync(__filename)),runnerSha256);assert.equal(sha(readFileSync(join(repo,fixture))),fixtureSha256);assert.equal(sha(readFileSync(join(repo,originalRunner))),originalRunnerSha256);
 proof={passed:true,candidate,runnerSha256,fixtureSha256,originalRunnerSha256,webIndexSha256:sha(readFileSync(join(repo,'apps/web/dist/index.html'))),sourceAtStart,sourceAtEnd:sourceReceipt(),headAtEnd:head(),generatedOnly:true,hiddenRenderer:true,actualProductionEntry:true,realCookieAuthentication:true,checks:['actual Work list/results/href to current21-turn history','ordinary revision saved Work href to same full stale21-turn history and citation reader','real source erasure removes Work link and clears direct historical results','B same-conversation owner Work/history/citation remains positive'],receipts};
}
const portClosed=origin=>new Promise(done=>{const {hostname,port}=new URL(origin),socket=createConnection({host:hostname,port:Number(port)});socket.once('connect',()=>{socket.destroy();done(false);});socket.once('error',error=>{socket.destroy();done(error.code==='ECONNREFUSED');});socket.setTimeout(2000,()=>{socket.destroy();done(false);});});
async function close(){
 if(!host||host.closed)return;for(const page of windows)if(!page.isDestroyed())page.destroy();
 if(host.child.exitCode===null)host.child.kill('SIGTERM');const result=await Promise.race([host.exit,delay(30000).then(()=>null)]);
 if(!result){host.child.kill('SIGKILL');throw Error('Generated fixture failed natural cleanup');}assert.deepEqual(result,{code:0,signal:null},'generated fixture cleanup');
 const raw=JSON.parse(readFileSync(host.privateFile+'.cleanup.json','utf8'));assert.equal(raw.pid,host.child.pid);assert.equal(raw.code,0);assert.equal(raw.directoryRemoved,true);assert.ok(!existsSync(host.directory));
 assert.throws(()=>process.kill(host.child.pid,0),error=>error.code==='ESRCH','owned host PID absent');
 const origins=[...new Set([host.origin,host.meta.address,host.meta.controlAddress])];for(const origin of origins)assert.ok(await portClosed(origin),'owned port closed '+origin);
 host.closed=true;receipts.push({phase:'cleanup',pid:host.child.pid,code:result.code,signal:result.signal,directoryRemoved:true,pidAbsent:true,closedOrigins:origins});
}
async function finish(code){
 if(finishing)return;finishing=true;clearTimeout(timer);for(const page of windows)if(!page.isDestroyed())page.destroy();
 try{await close();}catch(error){console.error(error.stack??error);code=1;}
 rmSync(root,{recursive:true,force:true});
 if(proof&&code===0){proof.cleanup={allWindowsDestroyed:windows.every(page=>page.isDestroyed()),browserProfileRemoved:!existsSync(root),hostNaturalExit:true};writeFileSync(join(out,'result.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({passed:true,candidate,runnerSha256,fixtureSha256,sourceAtStart,checks:proof.checks,cleanup:proof.cleanup}));}
 else if(failure){failure.receipts=receipts;failure.cleanup={allWindowsDestroyed:windows.every(page=>page.isDestroyed()),browserProfileRemoved:!existsSync(root),hostNaturalExit:host?.closed===true};writeFileSync(join(out,'failure.json'),JSON.stringify(failure,null,2));}
 app.exit(code);
}
run().then(()=>finish(0),async error=>{console.error(error.stack??error);for(const page of windows)if(!page.isDestroyed()){try{console.error((await text(page)).slice(-5000));writeFileSync(join(out,'failure-'+page.id+'.png'),(await page.webContents.capturePage()).toPNG());}catch{}}if(host&&!host.closed)console.error(host.logs.join(''));failure={passed:false,candidate,runnerSha256,fixtureSha256,sourceAtStart,error:String(error.stack??error),receipts};await finish(1);});
