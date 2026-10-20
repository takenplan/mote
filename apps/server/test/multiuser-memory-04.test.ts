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

test('job cancellation during an actual model request prevents both review and late publication',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);const job=await f.submit(f.a,[material.id]);await gate.entered.promise;
 assert.equal((await f.request(f.b.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{})).statusCode,404);
 const cancelled=await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{});assert.equal(cancelled.statusCode,200,cancelled.body);gate.release.resolve();assert.equal(await f.terminal(job.tasks.batch.id),'cancelled');
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);assert.equal(f.read(db=>db.prepare('SELECT draft,review,prepared FROM mm_jobs WHERE user_id=? AND id=?').get(f.a.userId,job.id))!.draft,null);
});

test('provider binding rejects a same-user source grant that excludes the original dependencies',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),packageId=await f.install(),material=await f.publish(f.a,'A'),job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);await f.plugin(f.a,packageId,['other-source']);
 const prepared=await f.request(f.a.token,'/api/memory/bindings','POST',{operationId:randomUUID(),instanceId:'same-instance'});assert.equal(prepared.statusCode,200,prepared.body);assert.equal(await f.terminal(prepared.json().task.id),'blocked');const current=(await f.request(f.a.token,'/api/memory')).json();assert.equal(current.binding.kind,'builtin');assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);
 assert.equal((await f.request(f.b.token,'/api/memory/bindings/'+prepared.json().id)).statusCode,404);assert.equal((await f.request(f.a.token,'/api/memory/bindings/'+prepared.json().id+'/cancel','POST',{})).statusCode,200);
});

test('native provider capability check rejects a scoped model key combined with a different plugin endpoint before enable',async t=>{
 const f=await fixture(t,generatedMem0Release()),packageId=await f.install(),view=(await f.request(f.a.token,'/api/plugins')).json();
 const configured=await f.request(f.a.token,'/api/plugin-instances','POST',{expectedRevision:view.revision,instance:{id:'same-instance',packageId,name:'Generated invalid native provider',configuration:{embeddingBaseUrl:'http://127.0.0.1:9/v1',embeddingModel:'generated-memory',embeddingDimension:3,embeddingSecretReference:'personal:same-model'},desired:false,grants:{capabilities:['repository','retrieval'],sourceIds:['same-source'],history:true}}});assert.equal(configured.statusCode,200,configured.body);
 const checking=await f.request(f.a.token,'/api/plugin-instances/same-instance/check','POST',{});assert.equal(checking.statusCode,200,checking.body);await waitForPluginCheck(checking.json(),async id=>(await f.request(f.a.token,'/api/tasks/'+id)).json());
 const checked=(await f.request(f.a.token,'/api/plugins')).json(),instance=checked.instances[0];assert.equal(instance.checked,false);assert.equal(instance.observed,'blocked');assert.deepEqual(instance.issues,['config_invalid']);assert.ok(instance.capabilities.every((value:any)=>value.state==='unknown'));
 assert.equal((await f.request(f.a.token,'/api/plugin-instances/same-instance/enable','POST',{expectedRevision:checked.revision})).statusCode,503);assert.equal((await f.request(f.a.token,'/api/memory/bindings','POST',{operationId:randomUUID(),instanceId:'same-instance'})).statusCode,409);
 assert.equal(JSON.stringify(instance).includes('GENERATED_A_KEY'),false);assert.equal(f.requests.length,0,'no model or unapproved embedding transport may start');assert.equal((await f.request(f.a.token,'/api/usage')).json().items.length,0);assert.equal((await f.request(f.a.token,'/api/memory')).json().binding.kind,'builtin');
});

test('external export reads actual provider and exact erase reconciles only A after logical deletion',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),pkg=await f.install();for(const user of [f.a,f.b]){await f.plugin(user,pkg);await f.bind(user,'same-instance');const material=await f.publish(user,user===f.a?'A':'B');await f.wait(user,(await f.submit(user,[material.id])).id);}
 const context=await f.node.authority.authenticate(f.a.token),service=f.node.services.forUser(context),before=(await f.request(f.a.token,'/api/memories')).json().items[0],binding=(await f.request(f.a.token,'/api/memory')).json().binding,descriptor=await f.node.plugins!.domainProvider(context,binding.snapshotId,['repository']);
 const archive=await service.exportUser('memory');assert.deepEqual((archive.payload as any).records,[before]);writeFileSync(join(descriptor.directory,'fail-read'),'generated');await assert.rejects(service.exportUser('memory'));unlinkSync(join(descriptor.directory,'fail-read'));
 const deleted=await f.request(f.a.token,'/api/memories/'+before.id,'DELETE');assert.equal(deleted.statusCode,200,deleted.body);assert.equal(await f.terminal(deleted.json().cleanupTaskId),'succeeded');assert.equal((await f.request(f.a.token,'/api/memories/'+before.id)).statusCode,404);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);
 const writes=f.read(db=>db.prepare('SELECT state,json FROM mm_provider_journal WHERE user_id=?').all(f.a.userId));assert.ok(writes.length);for(const row of writes){assert.ok(['erased','erase_pending'].includes(String(row.state)));assert.ok(!String(row.json).includes('Nora'));assert.equal(JSON.parse(String(row.json)).receipt.currentRemoved,true);}
});

test('late unknown provider writes are observed and erased again without resurrecting a cancelled Memory',async t=>{
 const f=await fixture(t,generatedMemoryRelease()),pkg=await f.install();await f.plugin(f.a,pkg);const binding=await f.bind(f.a,'same-instance'),context=await f.node.authority.authenticate(f.a.token),descriptor=await f.node.plugins!.domainProvider(context,binding.target.snapshotId,['repository']);writeFileSync(join(descriptor.directory,'hold-before-put'),'generated');
 const material=await f.publish(f.a,'A'),job=await f.submit(f.a,[material.id]),end=Date.now()+12000;while(!f.read(db=>db.prepare("SELECT 1 FROM mm_provider_journal WHERE user_id=? AND state='submitted'").get(f.a.userId))){assert.ok(Date.now()<end);await delay(10);}await delay(50);
 const cancelled=await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{});assert.equal(cancelled.statusCode,200,cancelled.body);const first=await f.request(f.a.token,'/api/memory/reconcile','POST',{});assert.equal(first.statusCode,200,first.body);assert.equal(await f.terminal(first.json().id),'succeeded');
 writeFileSync(join(descriptor.directory,'release-put'),'generated');const write=f.read(db=>db.prepare('SELECT namespace,key_json FROM mm_provider_journal WHERE user_id=?').get(f.a.userId))!,maintenance=await f.node.memory!.providers.maintenance(context,binding.target,'delete');try{while(!(await maintenance.observe({namespace:JSON.parse(String(write.namespace)),key:JSON.parse(String(write.key_json))})).present){assert.ok(Date.now()<end);await delay(10);}}finally{await maintenance.close();}
 const second=await f.request(f.a.token,'/api/memory/reconcile','POST',{});assert.equal(await f.terminal(second.json().id),'succeeded');const observed=f.read(db=>db.prepare('SELECT state,json FROM mm_provider_journal WHERE user_id=?').get(f.a.userId))!;assert.equal(observed.state,'erase_pending');assert.equal(JSON.parse(String(observed.json)).previousState,'observed');assert.equal(JSON.parse(String(observed.json)).attempt,2);assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);
});

for(const mutation of ['initial-pin','await-pin','await-cancel'] as const)test('scoped image currentness rejects '+mutation+' without delivering stale pixels',async t=>{
 const release=deferred(),entered=deferred(),finished=deferred();t.signal.addEventListener('abort',()=>release.resolve(),{once:true});
 const f=await fixture(t),settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;await f.replace(f.a.token,'memory',settings);
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#dd2211'}}).png().toBuffer(),material=await imageMaterial(t,f,f.a,'A',png),tail=await f.publish(f.a,'A','generated-tail-source','unrequested-tail','Generated unrequested image task pin.'),data=await f.data(f.a);data.materialEvidence(material);
 const anchor=String(f.read(db=>db.prepare('SELECT id FROM mm_images WHERE user_id=?').get(f.a.userId))!.id),host=f.node.memory as any,read=host.readImage.bind(host),reading=new AsyncLocalStorage<boolean>(),scopeErrors:unknown[]=[],readErrors:unknown[]=[];
 let delivered=0,readCalls=0,metadataCalls=0;
 const changeTail=async()=>{const response=await f.request(f.a.token,'/api/materials/'+tail.id+'/context','PATCH',{expectedRevision:tail.revision,ownerRelation:'owner'});assert.equal(response.statusCode,200,response.body);};
 host.readImage=(context:any,args:any,scope:any)=>reading.run(true,async()=>{
  readCalls++;const guarded={...scope,assertCurrent:()=>{try{return scope.assertCurrent();}catch(error){scopeErrors.push(error);throw error;}}};
  try{if(mutation==='initial-pin')await changeTail();const value=await read(context,args,guarded);delivered++;return value;}
  catch(error){readErrors.push(error);throw error;}finally{finished.resolve();}
 });
 const metadata=sharp.prototype.metadata;let held=false;
 sharp.prototype.metadata=function(...args:any[]):any{const value=Reflect.apply(metadata,this,args);if(!reading.getStore())return value;metadataCalls++;if(held)return value;held=true;return value.then(async(meta:any)=>{entered.resolve();await release.promise;return meta;});};
 // The existing real Agent/bridge runs, but the external language model is only
 // this generated loopback script. A terminal refusal prevents repair/retry.
 f.responses.set('A',(res,raw)=>{if(!raw.includes('tool_result')){writeMessagesResponse(res,{stage:f.requests.length,tool:{name:'read_image',args:{id:anchor,view:'image'}}});return;}res.statusCode=422;res.end('Generated terminal image currentness fixture');});
 try{
  const job=await f.submit(f.a,[material,tail.id]);
  if(mutation!=='initial-pin'){
   await entered.promise;
   if(mutation==='await-pin')await changeTail();
   else {const cancelled=await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{});assert.equal(cancelled.statusCode,200,cancelled.body);assert.equal(cancelled.json().cancelled,true);}
   release.resolve();
  }
  await finished.promise;
  const state=await f.terminal(job.tasks.batch.id);assert.notEqual(state,'succeeded');assert.equal(readCalls,1);assert.equal(delivered,0);
  assert.equal(readErrors.length,1);assert.ok(scopeErrors.length);
  if(mutation==='initial-pin'){assert.equal(metadataCalls,0,'an initially stale grant never reaches image output');assert.equal(readErrors[0],scopeErrors[0],'the initial full guard preserves its original exception');}
  else {assert.equal(metadataCalls,1,'the mutation happens inside the real image-output metadata await');assert.equal((readErrors[0] as {code:string}).code,'image_unavailable','the original permitted callback still maps revocation to image_unavailable');}
  assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0,'no stale image draft is published');
 }finally{release.resolve();sharp.prototype.metadata=metadata;host.readImage=read;}
});

for(const mutation of ['tail','cancel','source'] as const)test('scoped image review crop currentness rejects '+mutation+' without delivering stale pixels',async t=>{
 const entered=deferred(),release=deferred(),finished=deferred();t.signal.addEventListener('abort',()=>release.resolve(),{once:true});
 const f=await fixture(t),settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;await f.replace(f.a.token,'memory',settings);
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#dd2211'}}).png().toBuffer(),hash=createHash('sha256').update(png).digest('hex'),region={x:0,y:0,width:1,height:1},viewId=createHash('sha256').update(JSON.stringify([hash,'encoded-raster-pixels-v1',region,'crop-encoded-raster-png@1'])).digest('hex'),material=await imageMaterial(t,f,f.a,'A',png),tail=await f.publish(f.a,'A','generated-review-tail-source','unrequested-tail','Generated unrequested review task pin.'),data=await f.data(f.a);data.materialEvidence(material);
 const anchor=String(f.read(db=>db.prepare('SELECT id FROM mm_images WHERE user_id=?').get(f.a.userId))!.id),host=f.node.memory as any,read=host.readImage.bind(host),query=host.query.bind(host),reading=new AsyncLocalStorage<'extract'|'review'>(),readErrors:unknown[]=[],calls={extract:0,review:0},delivered={extract:0,review:0},providerCalls={extract:0,review:0};
 let phase:'extract'|'review'='extract',members:any[]=[],metadataCalls=0,cropCalls=0,held=false;
 host.query=(run:any,input:any,args:any)=>{phase=args.traceContext?.phase==='review'?'review':'extract';members=args.taskContext?.memoryWork?.members??[];return query(run,input,args);};
 host.readImage=(context:any,args:any,scope:any)=>{const current=phase;return reading.run(current,async()=>{calls[current]++;try{const value=await read(context,args,scope);delivered[current]++;return value;}catch(error){readErrors.push(error);throw error;}finally{if(current==='review')finished.resolve();}});};
 const metadata=sharp.prototype.metadata,toBuffer=sharp.prototype.toBuffer;
 sharp.prototype.metadata=function(...args:any[]):any{if(reading.getStore())metadataCalls++;return Reflect.apply(metadata,this,args);};
 sharp.prototype.toBuffer=function(...args:any[]):any{const value=Reflect.apply(toBuffer,this,args),current=reading.getStore();if(!current)return value;cropCalls++;if(current!=='review'||held)return value;held=true;return value.then(async(bytes:Buffer)=>{entered.resolve();await release.promise;return bytes;});};
 f.responses.set('A',res=>{const step=++providerCalls[phase];if(step===1){writeMessagesResponse(res,{stage:f.requests.length,tool:{name:'read_image',args:{id:anchor,view:'image',expectedImageSha256:hash,region}}});return;}if(phase==='review'){res.statusCode=422;res.end('Generated terminal review crop fixture');return;}
  writeMessagesResponse(res,{stage:f.requests.length,text:JSON.stringify({answer:JSON.stringify({memories:[{title:'Generated visible observation',statement:'The generated image shows a red patch. ['+anchor+']',uncertainty:'Generated pixel observation; authorship and owner identity unknown',admission:{layer:'observation',reason:'Exact visible fixture context',scope:'This generated image only',attribution:'observed'},evidenceIds:[anchor],evidence:[{id:anchor,image:{originalSha256:hash,viewId}}]}],coverage:members.map(member=>({key:member.key,state:member.id===anchor?'checked':'no_candidates',candidateIndexes:member.id===anchor?[0]:[]}))}),citationIds:[anchor]})});
 });
 try{
  const job=await f.submit(f.a,[material,tail.id]);await entered.promise;
  const stored=f.read(db=>db.prepare('SELECT draft,review,prepared FROM mm_job_batches WHERE user_id=? AND job_id=?').get(f.a.userId,job.id))!;assert.ok(stored.draft,'the mutation occurs during independent review of a durable draft');assert.equal(stored.review,null);assert.equal(stored.prepared,null);
  if(mutation==='tail'){const response=await f.request(f.a.token,'/api/materials/'+tail.id+'/context','PATCH',{expectedRevision:tail.revision,ownerRelation:'owner'});assert.equal(response.statusCode,200,response.body);}
  else if(mutation==='cancel'){const response=await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().cancelled,true);}
  else {const response=await f.request(f.a.token,'/api/sources/same-source','DELETE');assert.equal(response.statusCode,200,response.body);}
  release.resolve();await finished.promise;assert.notEqual(await f.terminal(job.tasks.batch.id),'succeeded');
  assert.deepEqual(calls,{extract:1,review:1});assert.deepEqual(delivered,{extract:1,review:0});assert.equal(metadataCalls,2);assert.equal(cropCalls,2,'both phases execute real Sharp crop awaits');assert.equal(readErrors.length,1);assert.equal((readErrors[0] as {code:string}).code,'image_unavailable');assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0,'no late reviewed Memory is committed');
 }finally{release.resolve();sharp.prototype.metadata=metadata;sharp.prototype.toBuffer=toBuffer;host.readImage=read;host.query=query;}
});

test('recipe-specific named ready blocks admit partial originals without reading unrelated pending artifacts',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),context=await f.node.authority.authenticate(f.a.token),data=await f.data(f.a),sql=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>sql.close());const draft=JSON.parse(String(sql.prepare('SELECT json FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get(f.a.userId,material.id,material.revision)!.json));draft.coverage={state:'partial',reason:'visible_window'};draft.artifacts=[{key:'daily-events',state:'ready',revision:'daily-1',blockIds:['same-block']},{key:'unrelated',state:'pending',blockIds:['unrelated']}];draft.blocks.push({id:'unrelated',kind:'text',format:'plain',text:'GENERATED_UNRELATED_PENDING_BODY',memberIds:['original']});
 const updated=f.node.ingress.bindSource(context,['same-source'],()=>{}).publishMaterial(draft,material.revision);assert.throws(()=>data.materialEvidence(updated.id));assert.equal(data.materialEvidence(updated.id,undefined,undefined,['daily-events']).length,1);
 const settings=defaultMemorySettings();settings.recipe={id:'mote.daily-event-memory',version:'2'};await f.replace(f.a.token,'memory',settings);await f.wait(f.a,(await f.submit(f.a,[updated.id])).id);assert.ok(f.requests.every(request=>!request.raw.includes('GENERATED_UNRELATED_PENDING_BODY')));assert.ok(f.requests.some(request=>request.raw.includes('daily event history')));
});

test('declared source narration reaches actual A/B model inputs even through a block attribution refinement',async t=>{
 const f=await fixture(t);for(const [user,label] of [[f.a,'A'],[f.b,'B']] as const){await f.request(user.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated source',kind:'custom',deviceId:'same-device',platform:'import',retention:'snapshot'});const updated=await f.request(user.token,'/api/sources/same-source/context','PATCH',{expectedVersion:0,description:'GENERATED_DECLARED_NARRATOR_'+label+': Nora is a third-party speaker, not the uploader.'});assert.equal(updated.statusCode,200,updated.body);const material=await f.publish(user,label);await f.wait(user,(await f.submit(user,[material.id])).id);}
 for(const request of f.requests){const owner=request.key.includes('_A_')?'A':'B';assert.ok(request.raw.includes('GENERATED_DECLARED_NARRATOR_'+owner));assert.ok(!request.raw.includes('GENERATED_DECLARED_NARRATOR_'+(owner==='A'?'B':'A')));}
});

test('owner job retry reuses immutable model/task checkpoints and job cursors cannot cross owners or page sizes',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A');f.responses.set('A',res=>{res.statusCode=422;res.end('GENERATED_RETRY_FAILURE');});const job=await f.submit(f.a,[material.id]);assert.ok(['failed','blocked'].includes(await f.terminal(job.tasks.batch.id)));const failedCalls=f.read(db=>db.prepare('SELECT state FROM task_external_calls WHERE task_id=?').all(job.tasks.batch.id));assert.deepEqual(failedCalls.map(row=>row.state),['succeeded'],'a definite HTTP rejection closes only its external fact');assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);assert.ok(f.read(db=>db.prepare("SELECT json FROM user_model_usage WHERE user_id=? AND json_extract(json,'$.attribution.jobId')=?").all(f.a.userId,job.id)).some(row=>JSON.parse(String(row.json)).status==='failed'));const before=(await f.request(f.a.token,'/api/memory/jobs/'+job.id)).json();assert.equal((await f.request(f.b.token,'/api/memory/jobs/'+job.id+'/retry','POST',{})).statusCode,404);f.responses.delete('A');const retried=await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/retry','POST',{});assert.equal(retried.statusCode,200,retried.body);const complete=await f.wait(f.a,job.id);assert.equal(complete.tasks.batch.id,before.tasks.batch.id);assert.equal(complete.tasks.batch.attempts,1,'explicit M05 retry resets its attempt budget');assert.equal(f.requests.length,3,'one failed extraction then actual extraction and independent review');const second=await f.submit(f.a,[material.id]);await f.wait(f.a,second.id);const page=(await f.request(f.a.token,'/api/memory/jobs?limit=1')).json();assert.ok(page.nextCursor);assert.equal((await f.request(f.b.token,'/api/memory/jobs?limit=1&cursor='+encodeURIComponent(page.nextCursor))).statusCode,400);assert.equal((await f.request(f.a.token,'/api/memory/jobs?limit=2&cursor='+encodeURIComponent(page.nextCursor))).statusCode,400);const next=(await f.request(f.a.token,'/api/memory/jobs?limit=1&cursor='+encodeURIComponent(page.nextCursor))).json();assert.notEqual(next.items[0].id,page.items[0].id);assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1,'retry and repeated extraction share the existing exact publisher');
});
