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

test('trusted Memory inputs reject foreign hosts, fabricated identities and cross-source Material dependencies',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),data=await f.data(f.a);assert.equal(data.materialEvidence(material.id,undefined,['same-source']).length,1);assert.throws(()=>data.materialEvidence(material.id,undefined,['other-source']));
 assert.throws(()=>f.node.memory!.forUser({...awaitableIdentity} as any));
 for(const [url,payload] of [['/api/memory/jobs',{materialIds:[material.id],operationId:randomUUID(),userId:f.b.userId}],['/api/memory/stop',{expectedRevision:1,operationId:randomUUID(),ownerId:f.b.userId}]] as const)assert.equal((await f.request(f.a.token,url,'POST',payload)).statusCode,401);
 assert.equal((await f.request(f.b.token,'/api/memory/jobs/'+randomUUID())).statusCode,404);
});

test('same operation ID is idempotent under concurrent admission without duplicate models or jobs',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),operationId=randomUUID();const [a,b]=await Promise.all([f.submit(f.a,[material.id],operationId),f.submit(f.a,[material.id],operationId)]);assert.equal(a.id,b.id);await f.wait(f.a,a.id);await f.submit(f.a,[material.id],operationId);assert.equal(f.requests.length,2);
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_jobs WHERE user_id=?').get(f.a.userId)!.n)),1);
});

test('scoped Activity deduplicates original records across real jobs and filters exact sources before selecting a page',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A');
 for(let i=0;i<2;i++)await f.wait(f.a,(await f.submit(f.a,[material.id])).id);
 const other=await f.publish(f.a,'A','other-source','other-external'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);const active=await f.submit(f.a,[other.id]);await gate.entered.promise;
 const page=await f.request(f.a.token,'/api/work-activity?sourceId=same-source&limit=1');assert.equal(page.statusCode,200,page.body);const work=page.json().items[0];assert.equal(work.kind,'memory');assert.equal(work.state,'completed');assert.equal(work.progress.total,1);assert.equal(work.progress.completed,1);assert.equal(work.branchCounts.total,2);assert.equal(page.json().nextCursor,null);
 const related=await f.request(f.a.token,'/api/work-activity?materialId='+material.id+'&limit=1');assert.equal(related.json().items[0].id,work.id);assert.equal((await f.request(f.b.token,'/api/work-activity/'+encodeURIComponent(work.id))).statusCode,404);
 const detail=await f.request(f.a.token,'/api/work-activity/'+encodeURIComponent(work.id)+'?limit=1');assert.equal(detail.json().branches.length,1);assert.equal(detail.json().branchesNextCursor,1);assert.equal(detail.json().progress.total,1);
 assert.equal((await f.request(f.a.token,'/api/work-activity?userId='+f.b.userId)).statusCode,401);assert.equal((await f.request(f.a.token,'/api/work-activity?sourceId=same-source&materialId='+material.id)).statusCode,400);
 gate.release.resolve();f.gates.delete('A');await f.wait(f.a,active.id);
});

test('empty-body Memory input is rejected before Activity admission without fabricating completed records',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A','same-source','empty-body',''),job=await f.request(f.a.token,'/api/memory/jobs','POST',{materialIds:[material.id],operationId:randomUUID()});assert.equal(job.statusCode,400,job.body);
 const page=await f.request(f.a.token,'/api/work-activity?sourceId=same-source');assert.equal(page.statusCode,200,page.body);assert.ok(!page.json().items.some((item:any)=>item.kind==='memory'));
});

test('deleting a Memory removes owner search results and invalidates an already admitted regeneration',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),initial=await f.submit(f.a,[material.id]);await f.wait(f.a,initial.id);const memory=(await f.request(f.a.token,'/api/memories')).json().items[0];
 const gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);await f.submit(f.a,[material.id]);await gate.entered.promise;
 assert.equal((await f.request(f.b.token,'/api/memories/'+memory.id,'DELETE')).statusCode,404);assert.equal((await f.request(f.a.token,'/api/memories/'+memory.id,'DELETE')).statusCode,200);gate.release.resolve();
 assert.equal((await f.request(f.a.token,'/api/memories/'+memory.id)).statusCode,404);assert.equal((await f.request(f.a.token,'/api/memories?query=tea')).json().items.length,0);
});

test('external provider read/search failures never return the cached SQL Memory body and leave B usable',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),packageId=await f.install(),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B');await f.plugin(f.a,packageId);await f.plugin(f.b,packageId);await f.wait(f.a,(await f.submit(f.a,[am.id])).id);await f.wait(f.b,(await f.submit(f.b,[bm.id])).id);const binding=await f.bind(f.a,'same-instance');await f.bind(f.b,'same-instance');
 const context=await f.node.authority.authenticate(f.a.token),descriptor=await f.node.plugins!.domainProvider(context,binding.target.snapshotId,['repository']);
 writeFileSync(join(descriptor.directory,'fail-read'),'generated');const unreadable=await f.request(f.a.token,'/api/memories');assert.equal(unreadable.statusCode,503,unreadable.body);assert.ok(!unreadable.body.includes('Nora'));unlinkSync(join(descriptor.directory,'fail-read'));
 writeFileSync(join(descriptor.directory,'fail-search'),'generated');const unavailable=await f.request(f.a.token,'/api/memories?query=tea');assert.equal(unavailable.statusCode,503,unavailable.body);assert.ok(!unavailable.body.includes('Nora'));assert.equal((await f.request(f.b.token,'/api/memories?query=tea')).json().items.length,1);
});

test('host-bound Memory read scope filters transitive sources before LIMIT and binds cursor/evidence identity',async t=>{
 const f=await fixture(t),allowed=await f.publish(f.a,'A'),hidden=await f.publish(f.a,'A','hidden-source','hidden'),context=await f.node.authority.authenticate(f.a.token),narrow=f.node.memory!.bindRead(context,{sourceIds:['same-source'],assertCurrent:()=>{}});
 await f.wait(f.a,(await f.submit(f.a,[allowed.id])).id);await f.wait(f.a,(await f.submit(f.a,[hidden.id])).id);
 const broad=f.node.memory!.bindRead(context,{assertCurrent:()=>{}}),all=await broad.page({limit:1}),page=await narrow.page({limit:1});assert.equal(page.items.length,1);assert.equal(page.items[0].evidence[0].sourceId,'same-source');assert.ok(all.nextCursor);await assert.rejects(narrow.page({limit:1,cursor:all.nextCursor}));assert.equal((await f.node.memory!.bindRead(context,{sourceIds:[],assertCurrent:()=>{}}).opening()).items.length,0);
 const projection=narrow.projectMaterial({id:allowed.id,revision:allowed.revision});assert.equal(projection.evidence[0].ocrText,text('A'));narrow.assertEvidence(projection.pins);assert.equal(narrow.isCurrent(projection.pins[0]),true);assert.throws(()=>narrow.projectMaterial({id:hidden.id,revision:hidden.revision}));await assert.rejects(narrow.read((await broad.page({limit:100})).items.find(memory=>memory.evidence[0].sourceId==='hidden-source')!.id));
 let current=true;const ids=['same-source'],held=f.node.memory!.bindRead(context,{sourceIds:ids,assertCurrent:()=>{if(!current)throw Error('Generated revoked scope');}});ids.push('hidden-source');assert.equal((await held.page()).items.length,1,'caller mutation cannot broaden a captured allowlist');current=false;await assert.rejects(held.page(),/revoked scope/);assert.throws(()=>held.evidence(projection.pins.map(pin=>pin.id)),/revoked scope/);
});

test('scoped generic owner questions preserve CAS, stable choices, followups and account-bound cursors through the real HTTP host',async t=>{
 const f=await fixture(t),calls:string[]=[],unregister=f.node.ownerQuestions.register({id:'generated.questions',version:'1',installationEpoch:'generated@1',forUser:context=>({validate:()=>true,answer:(_record,reply)=>{calls.push(context.userId);return reply.action==='unknown'?{kind:'closed',outcome:'Unknown'}:reply.answer==='followup'?{kind:'followup',prompt:'Confirm the exact generated role.',choices:[{id:'yes',label:'Exact role',answer:'generated exact role'}]}:{kind:'continued',continuationId:'generated:'+context.userId};}})});t.after(unregister);
 const contexts=await Promise.all([f.a,f.b].map(user=>f.node.authority.authenticate(user.token))),create=(index:number,key:string)=>f.node.ownerQuestions.create(contexts[index],{id:'generated.questions',version:'1'},{key,operationId:'same-operation',workId:'same-work',title:'Generated private question',prompt:'Who is the generated speaker?',evidence:[],choices:[],dependencyIds:[]});
 const a=create(0,'same-key'),b=create(1,'same-key');assert.notEqual(a.id,b.id);assert.equal((await f.request(f.a.token,'/api/owner-questions/'+b.id)).statusCode,404);assert.equal((await f.request(f.admin.token,'/api/owner-questions/'+a.id)).statusCode,404);
 const request={requestId:randomUUID(),expectedRevision:a.revision,action:'answer',answer:'followup'},follow=await f.request(f.a.token,'/api/owner-questions/'+a.id+'/reply','POST',request);assert.equal(follow.statusCode,200,follow.body);assert.equal(follow.json().state,'open');assert.equal(follow.json().revision,2);assert.equal((await f.request(f.a.token,'/api/owner-questions/'+a.id+'/reply','POST',request)).json().revision,2);assert.equal(calls.length,1);
 const answered=await f.request(f.a.token,'/api/owner-questions/'+a.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:2,action:'answer',choiceId:'yes'});assert.equal(answered.statusCode,200,answered.body);assert.equal(answered.json().state,'answered');assert.equal(answered.json().messages.at(-1).text,'generated exact role');assert.ok(calls.every(id=>id===f.a.userId));
 assert.deepEqual((await f.request(f.a.token,'/api/owner-questions?operationIds='+encodeURIComponent(JSON.stringify([a.operationId]))+'&state=answered,closed')).json().items.map((item:any)=>item.id),[a.id]);assert.equal((await f.request(f.a.token,'/api/owner-questions?operationIds='+encodeURIComponent(JSON.stringify(['ungranted-operation'])))).json().items.length,0);create(0,'second');const page=(await f.request(f.a.token,'/api/owner-questions?limit=1')).json();assert.ok(page.nextCursor);assert.equal((await f.request(f.b.token,'/api/owner-questions?limit=1&cursor='+encodeURIComponent(page.nextCursor))).statusCode,400);
});

for(const external of [false,true])test(`exact historical Memory reads keep original-version proof filters and canonical visibility: ${external}`,async t=>{
 const f=await fixture(t,external?generatedMemoryRelease():undefined),material=await f.publish(f.a,'A');await f.wait(f.a,(await f.submit(f.a,[material.id])).id);const original=(await f.request(f.a.token,'/api/memories')).json().items[0],response=await f.request(f.a.token,'/api/memories/'+original.id+'/correct','POST',{operationId:randomUUID(),correction:{version:1,title:'Explicit generated correction',statement:'The generated subject now prefers coffee.',uncertainty:'Synthetic explicit reply'}});assert.equal(response.statusCode,200,response.body);assert.equal(await f.terminal(response.json().tasks.correct.id),'succeeded');const context=await f.node.authority.authenticate(f.a.token);
 let directory:string|undefined;if(external){await f.plugin(f.a,await f.install(),['same-source','mote-owner-memory-corrections']);await f.bind(f.a,'same-instance');const binding=(await f.request(f.a.token,'/api/memory')).json().binding;directory=(await f.node.plugins!.domainProvider(context,binding.snapshotId,['repository'])).directory;}
 const reader=f.node.memory!.bindRead(context,{sourceIds:['same-source','mote-owner-memory-corrections'],assertCurrent:()=>{}});assert.equal((await reader.read(original.id,1)).version,1,'omitted filter retains explicit history semantics');const pinned=f.node.memory!.bindRead(context,{sourceIds:['same-source'],recordPins:[{id:original.id,version:original.version,fingerprint:original.fingerprint}],assertCurrent:()=>{}});assert.equal((await pinned.read(original.id,1,{includeHistory:true,sourceId:'same-source'})).version,1);const none=f.node.memory!.bindRead(context,{recordPins:[],assertCurrent:()=>{}});await assert.rejects(none.read(original.id,1,{includeHistory:true}));assert.throws(()=>none.pin(original.id,1,{includeHistory:true}));assert.equal((await reader.read(original.id,1,{includeHistory:true,collection:'content',sourceId:'same-source',deviceId:'same-device',source:'file',appId:'mote.source.custom',query:'tea'})).version,1);const observed=directory?readFileSync(join(directory,'read-observation.json'),'utf8'):undefined;
 for(const filters of [{includeHistory:true,sourceId:'mote-owner-memory-corrections'},{includeHistory:true,deviceId:'other-device'},{includeHistory:true,query:'coffee'},{includeHistory:true,source:'note'},{includeHistory:true,appId:'other-app'},{includeHistory:false,asOf:new Date(Date.now()+1000).toISOString()}])await assert.rejects(reader.read(original.id,1,filters));if(directory)assert.equal(readFileSync(join(directory,'read-observation.json'),'utf8'),observed,'excluded historical keys never reach provider');
 const narrow=f.node.memory!.bindRead(context,{sourceIds:['same-source'],assertCurrent:()=>{}}),beforePin=directory?readFileSync(join(directory,'read-observation.json'),'utf8'):undefined,pin=narrow.pin(original.id,1,{includeHistory:true,sourceId:'same-source'});assert.deepEqual(Object.keys(pin),['assertCurrent']);pin.assertCurrent();assert.throws(()=>narrow.pin(original.id,1,{includeHistory:true,deviceId:'other-device'}));assert.throws(()=>narrow.pin(original.id,undefined,{includeHistory:false}));if(directory)assert.equal(readFileSync(join(directory,'read-observation.json'),'utf8'),beforePin,'local pins disclose no provider keys or bodies, including a canonically superseded current row');assert.equal((await narrow.read(original.id,1,{includeHistory:true,sourceId:'same-source'})).version,1);pin.assertCurrent();
 assert.equal((await f.request(f.a.token,'/api/memories/'+original.id+'/versions/1')).statusCode,200);assert.equal((await f.request(f.a.token,'/api/memories/'+original.id+'/versions/1?includeHistory=true&deviceId=other-device')).statusCode,404);assert.equal((await f.request(f.a.token,'/api/memories/'+original.id+'/versions/1?includeHistory=true&deviceId=same-device')).statusCode,200);assert.equal((await f.request(f.b.token,'/api/memories/'+original.id+'/versions/1?includeHistory=true')).statusCode,404);assert.equal((await f.request(f.a.token,'/api/memories/'+original.id,'DELETE')).statusCode,200);assert.throws(()=>pin.assertCurrent());
});

test('manual Memory job pause drains its running extractor, persists through restart and resumes the same checkpoints without blocking B',async t=>{
 const f=await fixture(t),ma=await f.publish(f.a,'A'),mb=await f.publish(f.b,'B'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);const job=await f.submit(f.a,[ma.id]);await gate.entered.promise;const pause=await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/pause','POST',{});assert.equal(pause.statusCode,200,pause.body);assert.equal(pause.json().state,'paused');assert.equal((await f.request(f.b.token,'/api/memory/jobs/'+job.id+'/resume','POST',{})).statusCode,404);gate.release.resolve();f.gates.delete('A');
 const end=Date.now()+10000;for(;;){const state=(await f.request(f.a.token,'/api/memory/jobs/'+job.id)).json();if(state.tasks.batch.state==='succeeded')break;assert.ok(Date.now()<end,JSON.stringify(state));await delay(10);}
 assert.equal(f.requests.filter(item=>item.key==='GENERATED_A_KEY').length,2,'the admitted batch drains through independent review and save while paused');await f.wait(f.b,(await f.submit(f.b,[mb.id])).id);await f.restart();await delay(200);assert.equal(f.requests.filter(item=>item.key==='GENERATED_A_KEY').length,2);assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+job.id)).json().state,'paused');assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/resume','POST',{})).statusCode,200);await f.wait(f.a,job.id);assert.equal(f.requests.filter(item=>item.key==='GENERATED_A_KEY').length,2,'the completed batch never replays');assert.deepEqual((await f.request(f.a.token,'/api/memory/jobs')).json().items.map((item:any)=>item.id),[job.id]);assert.ok((await f.request(f.a.token,'/api/memory/recipes')).json().items.length>0);
});

for(const action of ['answer','unknown'] as const)test('automatic Memory owner question survives automatic stop for a later explicit '+action+' without reviving the old grant',async t=>{
 const f=await fixture(t),settings=defaultMemorySettings();settings.lifecycle.extraction.minChanges=1;await f.replace(f.a.token,'memory',settings);await f.replace(f.a.token,'processing',{...defaultProcessingSettings(),automatic:true,understandingEnabled:false});f.answers.set('A',(raw,keys,ids)=>raw.includes('Interpret only whether this exact owner reply')?{disposition:'resolved'}:raw.includes('EXPLICIT_NEW_OWNER_REPLY')?{memories:[],coverage:keys.map(key=>({key,state:'no_candidates',candidateIndexes:[]}))}:{memories:[],coverage:keys.map(key=>({key,state:'needs_owner_input',candidateIndexes:[],question:{prompt:'Who is the generated speaker in this exact original?',choices:[],evidence:[{id:ids[0],quote:text('A')}]}}))});await f.upload(f.a,'A','owner-stop');const end=Date.now()+15000;let question:any;for(;;){question=(await f.request(f.a.token,'/api/owner-questions')).json().items[0];if(question)break;assert.ok(Date.now()<end);await delay(10);}const jobId=question.operationId.slice(7);await f.wait(f.a,jobId);const view=(await f.request(f.a.token,'/api/memory')).json();assert.equal((await f.request(f.a.token,'/api/memory/stop','POST',{expectedRevision:view.revision,operationId:randomUUID()})).statusCode,200);assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+jobId)).json().state,'cancelled');assert.equal((await f.request(f.a.token,'/api/owner-questions/'+question.id)).json().state,'open','withdrawn automation is not a ban on an explicit account reply');const before=f.requests.length,reply={requestId:randomUUID(),expectedRevision:question.revision,action,...(action==='answer'?{answer:'EXPLICIT_NEW_OWNER_REPLY is the generated named speaker.'}:{})},response=await f.request(f.a.token,'/api/owner-questions/'+question.id+'/reply','POST',reply);assert.equal(response.statusCode,200,response.body);assert.equal(response.json().state,action==='answer'?'answered':'closed');if(action==='answer'){const child=response.json().continuationId.slice(7);await f.wait(f.a,child);const input=f.read(db=>JSON.parse(String(db.prepare('SELECT input FROM mm_jobs WHERE user_id=? AND id=?').get(f.a.userId,child)!.input)));assert.equal(input.automatic,false);assert.equal(input.intakeIds,undefined);assert.equal(f.requests.length,before+3,'explicit interpretation and independent extraction/review only');}else{assert.equal(f.requests.length,before,'unknown ends evaluation without a model or invented statement');assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM pd_material_declarations WHERE user_id=?').get(f.a.userId)!.n),0);}assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_intakes WHERE user_id=? AND revoked=0').get(f.a.userId)!.n),0,'old automatic grants remain revoked');
});
