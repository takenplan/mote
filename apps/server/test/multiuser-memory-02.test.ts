import {ExecutionFailure} from '../src/execution-engine.js';
import {defaultPerceptionConfiguration} from '../src/perception-configuration.js';
import {waitForPluginCheck} from './fixtures/plugin-check.js';
import {scopedMemoryFixture as fixture} from './fixtures/scoped-memory-host.js';
import {uiPageText} from '@mote/shared';
import sharp from 'sharp';
import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,writeFileSync,unlinkSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {AsyncLocalStorage} from 'node:async_hooks';
import {setTimeout as delay} from 'node:timers/promises';
import {LifecycleAuthority} from '../src/scope/lifecycle.js';
import {openScopeStorage} from '../src/scope/storage.js';
import {buildApp} from '../src/app.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {materialId} from '../src/materials.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {generatedMemoryRelease,generatedMem0Release,generatedHindsightRelease} from './fixtures/scoped-memory-release.js';
import {hindsightHttpFixture} from './fixtures/hindsight-http.js';
import type {HindsightRuntimeFactory} from '../src/scope/memory-providers.js';
import {PrivateSql,PrivateCursor} from '../src/scope/private-data-sql.js';
import {ScopedMemoryData} from '../src/scope/memory-data.js';
import type {PrivateData} from '../src/scope/private-data.js';
import {password,protocol,text,deferred,awaitableIdentity,imageMaterial} from './fixtures/multiuser-memory-suite.js';

test('stopping automatic work preserves an already admitted manual job and the other user',async t=>{
 const f=await fixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);
 const aj=await f.submit(f.a,[am.id]);await gate.entered.promise;
 const before=(await f.request(f.a.token,'/api/memory')).json();assert.equal((await f.request(f.a.token,'/api/memory/stop','POST',{expectedRevision:before.revision,operationId:randomUUID()})).statusCode,200);gate.release.resolve();
 const bj=await f.submit(f.b,[bm.id]);await f.wait(f.b,bj.id);
 await f.wait(f.a,aj.id);
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);
});

test('pause drains admitted extraction and review without revoking its durable authority',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);
 const job=await f.submit(f.a,[material.id]);await gate.entered.promise;const before=(await f.request(f.a.token,'/api/memory')).json();
 const paused=await f.request(f.a.token,'/api/memory/pause','POST',{expectedRevision:before.revision,operationId:randomUUID()});assert.equal(paused.statusCode,200,paused.body);assert.equal(paused.json().generation,before.generation);gate.release.resolve();await f.wait(f.a,job.id);
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);
});

test('real M06 upload publication admits durable automatic Memory grants for equal user inputs',async t=>{
 const f=await fixture(t);
 for(const user of [f.a,f.b]){const settings=defaultMemorySettings();settings.lifecycle.extraction.minChanges=1;await f.replace(user.token,'memory',settings);await f.replace(user.token,'processing',{...defaultProcessingSettings(),automatic:true,understandingEnabled:false});}
 await Promise.all([f.upload(f.a,'A'),f.upload(f.b,'B')]);
 const end=Date.now()+20000;for(;;){const rows=f.read(db=>db.prepare("SELECT user_id,job_id FROM mm_intakes WHERE state='complete'").all());if(rows.length===2){for(const row of rows)await f.wait(row.user_id===f.a.userId?f.a:f.b,String(row.job_id));break;}assert.ok(Date.now()<end,JSON.stringify(f.read(db=>db.prepare('SELECT * FROM execution_steps').all())));await delay(10);}
 assert.equal(f.requests.length,4);for(const user of [f.a,f.b]){const memories=(await f.request(user.token,'/api/memories')).json().items;assert.equal(memories.length,1);const context=await f.data(user);assert.equal(context.evidence(memories[0].evidenceIds)[0].capturedAt,'2026-01-01T00:00:00.000Z');}
 for(const request of f.requests){const owner=request.key.includes('_A_')?'A':'B';assert.ok(request.raw.includes(text(owner)));assert.ok(!request.raw.includes(text(owner==='A'?'B':'A')));}
 await f.restart();assert.equal(f.requests.length,4);
});

test('every long original range has a durable bounded batch and a retained complete assessment',async t=>{
 const f=await fixture(t),content=Array.from({length:180},(_,index)=>'generated line '+index+' '+('字🌱'.repeat(40))).join('\n'),material=await f.publish(f.a,'A','same-source','long-original',content);
 f.answers.set('A',(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}));
 const job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);
 const batches=f.read(db=>db.prepare('SELECT input,review,state FROM mm_job_batches WHERE user_id=? AND job_id=?').all(f.a.userId,job.id)),ranges=batches.flatMap(row=>JSON.parse(String(row.input)).ranges).sort((a,b)=>a.offset-b.offset);
 assert.ok(batches.length>1);assert.ok(batches.every(row=>row.state==='committed'&&JSON.parse(String(row.review)).coverage?.incomplete===false));assert.equal(ranges.reduce((sum,range)=>sum+range.length,0),content.length);let at=0;for(const range of ranges){assert.equal(range.offset,at);assert.ok(range.length<=12000);at+=range.length;}assert.equal(f.requests.length,batches.length*2,'each range assessment receives independent review');
 const count=f.requests.length;await f.restart();await f.wait(f.a,job.id);assert.equal(f.requests.length,count);
});

test('extraction and review fork one immutable M04 configuration even if selection changes during admission',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),fork=f.node.configuration.forkLease.bind(f.node.configuration),gate={entered:deferred(),release:deferred()};let calls=0;
 f.node.configuration.forkLease=async(...args:Parameters<typeof fork>)=>{const lease=await fork(...args);if(++calls===1){gate.entered.resolve();await gate.release.promise;}return lease;};
 const admitted=f.submit(f.a,[material.id]);await gate.entered.promise;
 await f.replace(f.a.token,'models',{profiles:[{id:'same-model',name:'Retained original model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_A_KEY',headers:{},extraBody:{}}},{id:'replacement',name:'Generated next model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-next-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_NEXT_A_KEY',headers:{},extraBody:{}}}],selections:{memory:{kind:'personal',id:'replacement'}}});
 gate.release.resolve();const job=await admitted;await f.wait(f.a,job.id);assert.equal(f.requests.length,2);assert.ok(f.requests.every(request=>request.body.model==='generated-memory'&&request.key==='GENERATED_A_KEY'));
 const receipts=f.read(db=>db.prepare("SELECT json_extract(model_receipt,'$.snapshotId') AS snapshot,model_receipt FROM user_tasks WHERE user_id=? AND model_receipt IS NOT NULL").all(f.a.userId));assert.equal(receipts.length,1,'one continuous batch retains its admitted snapshot');const usage=(await f.request(f.a.token,'/api/usage')).json().items;assert.equal(usage.length,2);assert.equal(new Set(usage.map((item:any)=>item.id)).size,2,'each actual model query owns a distinct measured usage fragment');
});

test('independent review: deleting an earlier Memory while a later page read is held fences the whole page',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),pkg=await f.install(),one=await f.publish(f.a,'A','same-source','first'),two=await f.publish(f.a,'A','same-source','second');
 await f.wait(f.a,(await f.submit(f.a,[one.id])).id);await f.wait(f.a,(await f.submit(f.a,[two.id])).id);await f.plugin(f.a,pkg);await f.bind(f.a,'same-instance');
 const context=await f.node.authority.authenticate(f.a.token),reader=f.node.memory!.bindRead(context,{sourceIds:['same-source'],assertCurrent:()=>f.node.authority.assert(context)}),page=await reader.page({limit:2});assert.equal(page.items.length,2);
 const deleted=page.items[0],held=page.items[1],binding=(await f.request(f.a.token,'/api/memory')).json().binding,descriptor=await f.node.plugins!.domainProvider(context,binding.snapshotId,['repository']),hold=join(descriptor.directory,'hold-read-'+held.id),started=join(descriptor.directory,'read-started-'+held.id),release=join(descriptor.directory,'release-read-'+held.id);f.beforeClose(()=>writeFileSync(release,'generated'));
 writeFileSync(hold,'generated');const pending=reader.page({limit:2}).then(value=>({value}),error=>({error}));const deadline=Date.now()+15000;while(!existsSync(started)){assert.ok(Date.now()<deadline,'second actual provider read did not start');await delay(5);}
 const removed=await f.request(f.a.token,'/api/memories/'+deleted.id,'DELETE');assert.equal(removed.statusCode,200,removed.body);assert.equal((await f.request(f.a.token,'/api/memories/'+deleted.id)).statusCode,404);writeFileSync(release,'generated');
 const outcome=await pending,leaked='value' in outcome&&outcome.value.items.some(item=>item.id===deleted.id);console.log(JSON.stringify({deletedId:deleted.id,heldId:held.id,leaked,outcome:'error' in outcome?'blocked':'returned'}));assert.equal(leaked,false,'a page must revalidate previously fetched entries before returning after later provider awaits');
});

test('real M03 structured capture publishes builtin daily and ordinary Material before actual Memory workers, with frozen intake and no historical regrant',async t=>{
 const f=await fixture(t);for(const user of [f.a,f.b]){const settings=defaultMemorySettings();settings.lifecycle.extraction.minChanges=1;await f.replace(user.token,'memory',settings);}for(const label of ['A','B'])f.answers.set(label,(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}));
 const sourceId='ui-page:'+createHash('sha256').update(JSON.stringify('same-device')).digest('hex'),id=randomUUID(),at='2026-01-01T00:00:00Z';
 const send=async(user:any,label:string,batch:string,captureId=id)=>{const registered=await f.request(user.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated page',kind:'custom',deviceId:'same-device',platform:'android',retention:'snapshot'});assert.equal(registered.statusCode,200,registered.body);const context=await f.node.authority.authenticate(user.token),page={version:2,scope:'visible_window',adapterId:'generated.fields',adapterVersion:'1',appVersion:'1',activity:'Generated.Article',status:'ok',truncated:false,observations:{firstAt:at,lastAt:at,count:1},objects:[{kind:'article',title:'Generated article',author:'Generated author',body:[{text:'DAILY_PRIVATE_'+label}],url:'https://fixture.invalid/article',identity:{type:'url',value:'https://fixture.invalid/article'}}]};return f.node.ingress.bindSource(context,[sourceId],()=>{}).receiveCaptures(sourceId,batch,[{id:captureId,deviceId:'same-device',deviceName:'Generated phone',platform:'android',source:'ui_page',appId:'generated.app',appName:'Generated app',capturedAt:at,durationMs:0,ocrText:uiPageText(page as any),privacy:{excluded:false,redacted:true,mode:'local',collection:'content'},metadata:{version:1,observedAt:at,collector:{method:'accessibility'},uiPage:page}}]);};
 await send(f.a,'A','same-batch');await send(f.b,'B','same-batch');const end=Date.now()+20000;for(;;){const rows=f.read(db=>db.prepare("SELECT user_id,job_id FROM mm_intakes WHERE state='complete'").all());if(rows.length===4){for(const row of rows)await f.wait(row.user_id===f.a.userId?f.a:f.b,String(row.job_id));break;}assert.ok(Date.now()<end,JSON.stringify(f.read(db=>db.prepare('SELECT * FROM execution_steps').all())));await delay(10);}
 for(const user of [f.a,f.b]){const items=(await f.request(user.token,'/api/materials')).json().items;assert.equal(items.length,2);const daily=items.find((item:any)=>item.kind==='mote.capture-event');assert.equal(daily.coverage.state,'partial');assert.equal(daily.artifacts[0].key,'daily-events');assert.equal(daily.artifacts[0].state,'ready');assert.equal(daily.origin.firstAt,new Date(at).toISOString());}
 assert.equal(f.requests.length,8);assert.ok(f.requests.some(value=>value.raw.includes('daily event history')));for(const item of f.requests){const owner=item.key.includes('_A_')?'A':'B';assert.ok(item.raw.includes('DAILY_PRIVATE_'+owner));assert.ok(!item.raw.includes('DAILY_PRIVATE_'+(owner==='A'?'B':'A')));}
 const settings=defaultMemorySettings();settings.automatic=false;await f.replace(f.a.token,'memory',settings);await send(f.a,'A','paused-history',randomUUID());settings.automatic=true;await f.replace(f.a.token,'memory',settings);await f.restart();await delay(150);assert.equal(f.requests.length,8);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_capture_intakes WHERE user_id=? AND revoked=1').get(f.a.userId)!.n),1,'disabled capture remains unauthorized');assert.equal(f.read(db=>db.prepare("SELECT count(*) n FROM mm_capture_intakes WHERE user_id=? AND json_extract(json,'$.admissionClosed')=1").get(f.a.userId)!.n),1,'ordinary disable permanently closes the earlier producer without revoking admitted work');
});

test('raw screenshot daily observations wait for real M06 OCR and enabled pixel understanding for both owners, then consume each recipe once',async t=>{
 const payloads=new Map<string,any>();const f=await fixture(t),png=await sharp({create:{width:2,height:2,channels:3,background:'#336699'}}).png().toBuffer(),captureId=randomUUID(),deviceId='same-screen-device',sourceId='screen:'+createHash('sha256').update(JSON.stringify(deviceId)).digest('hex'),ocrEntered=deferred(),ocrRelease=deferred(),understood=deferred(),understandingRelease=deferred();let ocrCalls=0;f.beforeClose(()=>{ocrRelease.resolve();understandingRelease.resolve();});
 const media=createServer(async(req,res)=>{ocrCalls++;ocrEntered.resolve();await ocrRelease.promise;res.setHeader('content-type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify({durationMs:0,segments:[{startMs:0,endMs:0,text:'GENERATED_SCREEN_OCR'}],engine:'generated-ocr'}));});await new Promise<void>(resolve=>media.listen(0,'127.0.0.1',resolve));t.after(async()=>{media.closeAllConnections();await new Promise<void>(resolve=>media.close(()=>resolve()));});
 for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){const memory=defaultMemorySettings();memory.lifecycle.extraction.minChanges=1;await f.replace(user.token,'memory',memory);await f.replace(user.token,'models',{profiles:[{id:'same-model',name:'Generated language model',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-memory',baseUrl:f.modelUrl,apiKey:'GENERATED_'+label+'_KEY'}},{id:'same-ocr',name:'Generated OCR',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',model:'generated-ocr',baseUrl:'http://127.0.0.1:'+(media.address() as any).port,apiKey:'GENERATED_OCR_'+label+'_KEY'}}],selections:{memory:{kind:'personal',id:'same-model'},file:{kind:'personal',id:'same-model'},ocr:{kind:'personal',id:'same-ocr'}}});await f.replace(user.token,'processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:true,summarize:false});f.responses.set(label,(res,raw,keys)=>{if(raw.includes('Inspect the original image using read_image')){if(!raw.includes('tool_result')){writeMessagesResponse(res,{stage:f.requests.length,tool:{name:'read_image',args:{id:captureId,view:'image'}}});return;}understood.resolve();void understandingRelease.promise.then(()=>writeMessagesResponse(res,{stage:f.requests.length,text:JSON.stringify({answer:JSON.stringify({text:'GENERATED_VISUAL_'+label,regions:[]}),citationIds:[captureId]})}));return;}writeMessagesResponse(res,{stage:f.requests.length,text:JSON.stringify({answer:JSON.stringify({memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}),citationIds:[]})});});assert.equal((await f.request(user.token,'/api/ingress/sources','POST',{id:sourceId,name:'Generated screen',kind:'custom',deviceId,platform:'macos',retention:'snapshot'})).statusCode,200);const payload={batchId:'same-screen-batch',items:[{id:captureId,deviceId,deviceName:'Generated desktop',platform:'macos',capturedAt:'2026-01-01T01:02:03Z',durationMs:1000,source:'screen',appId:'generated.app',appName:'Generated app',windowTitle:'Generated scene',ocrText:'',imageBase64:png.toString('base64'),imageMime:'image/png',privacy:{excluded:false,redacted:true,mode:'local',collection:'content'}}]};payloads.set(user.userId,payload);const received=await f.request(user.token,'/api/ingress/sources/'+sourceId+'/captures','POST',payload);assert.equal(received.statusCode,200,received.body);}
 await ocrEntered.promise;const daily=async(user:any)=>(await f.request(user.token,'/api/materials')).json().items.find((item:any)=>item.kind==='mote.capture-event');const end=Date.now()+25000;for(;;){if(await daily(f.a)&&await daily(f.b))break;assert.ok(Date.now()<end,JSON.stringify(f.read(db=>db.prepare('SELECT kind,state,error FROM execution_steps').all())));await delay(10);}assert.equal((await daily(f.a)).artifacts[0].state,'pending');assert.equal(f.requests.length,0,'no Memory or vision call precedes actual OCR');ocrRelease.resolve();await understood.promise;assert.equal((await daily(f.a)).artifacts[0].state,'pending','OCR does not make enabled understanding ready');understandingRelease.resolve();for(;;){const rows=f.read(db=>db.prepare("SELECT user_id,job_id FROM mm_intakes WHERE state='complete'").all());if(rows.length>=4){for(const row of rows)await f.wait(row.user_id===f.a.userId?f.a:f.b,String(row.job_id));break;}assert.ok(Date.now()<end,JSON.stringify(f.read(db=>db.prepare('SELECT kind,state,error FROM execution_steps').all())));await delay(15);}assert.equal(ocrCalls,2);for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){const d=await daily(user);assert.equal(d.artifacts[0].state,'ready');assert.equal(d.coverage.state,'complete');const body=(await f.request(user.token,'/api/materials/'+d.id+'/read')).json();assert.ok(JSON.stringify(body).includes('GENERATED_VISUAL_'+label));assert.ok(!JSON.stringify(body).includes('GENERATED_VISUAL_'+(label==='A'?'B':'A')));const receipts=f.read(db=>db.prepare('SELECT material_id,json FROM mm_intakes WHERE user_id=?').all(user.userId));assert.equal(receipts.filter(row=>JSON.parse(String(row.json)).strategy.requires?.includes('daily-events')).length,1,'daily recipe consumes only capture-event');assert.equal(receipts.length,2,'ordinary and daily each run once');}for(const user of [f.a,f.b]){assert.equal((await f.request(user.token,'/api/perception')).json().settings.enabled,true);const repeated=await f.request(user.token,'/api/ingress/sources/'+sourceId+'/captures','POST',{...payloads.get(user.userId),batchId:'generated-new-transport-same-original'});assert.equal(repeated.statusCode,200,repeated.body);assert.equal(repeated.json().captures[0].duplicate,true);assert.equal(f.read(db=>db.prepare("SELECT count(*) n FROM execution_steps WHERE user_id=? AND kind='processing.pipeline'").get(user.userId)!.n),1,'transport redelivery cannot create a second automatic processing intent');assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mp_publications WHERE user_id=?').get(user.userId)!.n),1);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_intakes WHERE user_id=?').get(user.userId)!.n),2,'ordinary and daily consumption remain unique after duplicate transport');}const count=f.requests.length;await f.restart();await delay(150);assert.equal(f.requests.length,count);
});
