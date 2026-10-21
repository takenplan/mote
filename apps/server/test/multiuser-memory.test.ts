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

test('Memory control commands preserve revision checks, idempotency and per-user command IDs',async t=>{
 const f=await fixture(t),av=(await f.request(f.a.token,'/api/memory')).json(),bv=(await f.request(f.b.token,'/api/memory')).json(),operationId=randomUUID(),input={expectedRevision:av.revision,operationId};
 const paused=await f.request(f.a.token,'/api/memory/pause','POST',input);assert.equal(paused.statusCode,200);assert.equal((await f.request(f.a.token,'/api/memory/pause','POST',input)).statusCode,200);
 assert.equal((await f.request(f.a.token,'/api/memory/stop','POST',input)).statusCode,409);assert.equal((await f.request(f.b.token,'/api/memory/pause','POST',{expectedRevision:bv.revision,operationId})).statusCode,200);
 assert.equal((await f.request(f.a.token,'/api/memory/resume','POST',{expectedRevision:av.revision,operationId:randomUUID()})).statusCode,409);
});

test('a new extraction of the same original applies semantic deletion review rather than regenerating a removed conclusion',async t=>{
 let now='2037-04-10T08:00:00.000Z';const f=await fixture(t,undefined,undefined,()=>now),material=await f.publish(f.a,'A'),job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);const memory=(await f.request(f.a.token,'/api/memories')).json().items[0];assert.equal((await f.request(f.a.token,'/api/memories/'+memory.id,'DELETE')).statusCode,200);
 now='2038-01-01T00:00:00.000Z';const next=await f.submit(f.a,[material.id]);await f.wait(f.a,next.id);assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);const comparisons=f.requests.filter(request=>request.raw.includes('Host Memory deletion review.'));assert.ok(comparisons.length);for(const request of comparisons){const body=request.body,value=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text);assert.equal(value.requiredSkill,undefined);assert.equal(value.currentTime,now);}
});

test('Memory lifecycle export and deletion cover only the authorized owner while a held result is fenced',async t=>{
 const f=await fixture(t),am=await f.publish(f.a,'A'),bm=await f.publish(f.b,'B'),aj=await f.submit(f.a,[am.id]),bj=await f.submit(f.b,[bm.id]);await f.wait(f.a,aj.id);await f.wait(f.b,bj.id);
 const aContext=await f.node.authority.authenticate(f.a.token),service=f.node.services.forUser(aContext),archive=await service.exportUser('memory');assert.equal(archive.userId,f.a.userId);assert.ok(JSON.stringify(archive).includes(text('A')));assert.ok(!JSON.stringify(archive).includes(text('B')));assert.ok(!JSON.stringify(archive).includes('GENERATED_A_KEY'));
 const gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);await f.submit(f.a,[am.id]);await gate.entered.promise;
 const deleted=await service.deleteUser('memory',randomUUID());assert.equal(deleted.status,'complete');gate.release.resolve();assert.equal((await f.request(f.a.token,'/api/memories')).statusCode,503);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);
 assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_records WHERE user_id=?').get(f.a.userId)!.n)),0);
});

for(const outcome of ['repair','full-read-repair','outer-recovery','twice','cancel','tail','epoch','unknown'] as const)test('scoped review restores bounded post-review repair: '+outcome,async t=>{
 const succeeds=outcome==='repair'||outcome==='full-read-repair'||outcome==='outer-recovery';
 if(outcome==='twice')t.mock.timers.enable({apis:['Date'],now:Date.now()});
 let now='2037-04-10T08:00:00.000Z';const frozenClock=now,f=await fixture(t,undefined,undefined,()=>now),settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;await f.replace(f.a.token,'memory',settings);
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#dd2211'}}).png().toBuffer(),hash=createHash('sha256').update(png).digest('hex'),region={x:0,y:0,width:1,height:2},wholeView=createHash('sha256').update(JSON.stringify([hash,'encoded-raster-pixels-v1',null,'original-bytes@1'])).digest('hex'),cropView=createHash('sha256').update(JSON.stringify([hash,'encoded-raster-pixels-v1',region,'crop-encoded-raster-png@1'])).digest('hex'),material=await imageMaterial(t,f,f.a,'A',png),tail=await f.publish(f.a,'A','generated-repair-tail','tail','Generated unrequested repair pin.'),data=await f.data(f.a);data.materialEvidence(material);
 const anchor=String(f.read(db=>db.prepare('SELECT id FROM mm_images WHERE user_id=?').get(f.a.userId))!.id),context=await f.node.authority.authenticate(f.a.token),admin=await f.node.authority.authenticate(f.admin.token),host=f.node.memory as any,query=host.query.bind(host),record=host.recordValidationFailure.bind(host),execute=host.execute.bind(host),frames:any[]=[],failures:any[]=[],endErrors:any[]=[],counts={extract:0,review:0},unknown=new ExecutionFailure('blocked','external_result_unknown');
 let phase:'extract'|'review'='extract',step=0,members:any[]=[],cancelled:Promise<unknown>|undefined;
 host.query=async(run:any,input:any,args:any)=>{phase=args.traceContext?.phase==='review'?'review':'extract';assert.equal(args.contextTime,frozenClock);assert.equal(args.skill,'memory-strategy');if(phase==='review')now='2038-01-01T00:00:00.000Z';counts[phase]++;step=0;members=args.taskContext?.memoryWork?.members??[];if(phase==='review')frames.push({question:args.question,draft:structuredClone(args.taskContext.untrustedMemoryDraft)});const value=await query(run,input,args);if(phase==='review'&&outcome==='unknown')throw unknown;return value;};
 host.recordValidationFailure=(run:any,input:any,error:any,value:any)=>{record(run,input,error,value);if(error.code!=='image_evidence')return;failures.push({error,value});if(outcome==='cancel')cancelled=host.forUser(context).cancel(input.jobId);if(outcome==='tail')data.privateData.correctMaterialContext(tail.id,tail.revision,'owner');if(outcome==='epoch')f.node.accounts!.disable(admin,f.node.authority,f.a.userId,true);};
 host.execute=async(run:any)=>{try{return await execute(run);}catch(error){endErrors.push(error);throw error;}};
 f.responses.set('A',res=>{const cropped=phase==='review'&&(outcome==='outer-recovery'?counts.review<=2:counts.review===1||!succeeds),fullReadFirst=outcome==='full-read-repair'&&phase==='review'&&counts.review===1;if(++step===1){writeMessagesResponse(res,{stage:f.requests.length,tool:{name:'read_image',args:{id:anchor,view:'image',...(cropped&&!fullReadFirst?{expectedImageSha256:hash,region}:{})}}});return;}
  if(fullReadFirst&&step===2){writeMessagesResponse(res,{stage:f.requests.length,tool:{name:'read_image',args:{id:anchor,view:'image',expectedImageSha256:hash,region}}});return;}
  writeMessagesResponse(res,{stage:f.requests.length,text:JSON.stringify({answer:JSON.stringify({memories:[{title:'Generated visible repair observation',statement:'The generated image shows a red patch. ['+anchor+']',uncertainty:'Generated pixels only; owner identity unknown',admission:{layer:'observation',reason:'Exact generated pixel observation',scope:'This generated original only',attribution:'observed'},evidenceIds:[anchor],evidence:[{id:anchor,image:{originalSha256:hash,viewId:cropped?cropView:wholeView}}]}],coverage:members.map(member=>({key:member.key,state:member.id===anchor?'checked':'no_candidates',candidateIndexes:member.id===anchor?[0]:[]}))}),citationIds:[anchor]})});
 });
 const terminal=async(taskId:string)=>{if(outcome!=='twice')return f.terminal(taskId);const deadline=performance.now()+10000;for(;;){const response=await f.request(f.a.token,'/api/tasks/'+taskId);assert.equal(response.statusCode,200,response.body);const task=response.json();if(!['running','waiting'].includes(task.state))return task.state;
   // Exercise each real finite review sequence under its original wall-clock
   // budget, advancing only the recorded idle backoff after known failure and
   // complete physical cleanup. No active call or execution lease is advanced.
   if(task.state==='waiting'&&task.failure?.category==='transient'&&task.failure?.code==='memory_output_image_evidence'&&task.availableAt>Date.now()&&f.read(db=>Number(db.prepare("SELECT count(*) n FROM execution_steps WHERE state='running'").get()!.n))===0&&f.read(db=>Number(db.prepare("SELECT count(*) n FROM task_physical_calls WHERE task_id=? AND state='active'").get(taskId)!.n))===0){t.mock.timers.setTime(task.availableAt);await f.node.execution!.tick();}
   assert.ok(performance.now()<deadline,'Expected terminal Memory extraction '+JSON.stringify(task));await delay(5);
  }};
 try{
  const job=await f.submit(f.a,[material,tail.id]);if(succeeds)await f.wait(f.a,job.id);else assert.notEqual(await terminal(job.tasks.batch.id),'succeeded');await cancelled;
  for(const request of f.requests){const body=request.body,sent=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text);assert.equal(sent.currentTime,frozenClock);assert.equal(sent.requiredSkill,'memory-strategy');}assert.equal(counts.extract,1,'repair never re-extracts the valid draft');assert.equal(counts.review,outcome==='outer-recovery'?3:outcome==='twice'?6:succeeds?2:1);assert.equal(failures.length,outcome==='unknown'?0:outcome==='outer-recovery'?2:outcome==='twice'?6:1,'each rejected query is retained; each task attempt still permits at most two independent reviews');
  if(frames.length===2){assert.deepEqual(frames[0].draft,frames[1].draft);assert.ok(frames[1].question.includes(failures[0].error.repairInstruction+' Re-review the same valid draft and all supplied original target ranges. Preserve the complete member coverage contract.'));}
  if(outcome==='full-read-repair'){assert.equal(failures[0].value.imageReadReceipts.length,2,'a delivered but uncited full view does not authorize the cited noncovering crop');assert.equal(failures[0].error.details.problem,'review_image_coverage');assert.ok(frames[1].question.includes('Reading a full image but citing only a noncovering crop does not satisfy this rule.'));}
  assert.ok(frames.every(frame=>frame.question.length<=20000),'complete visual instructions and repair stay within the Agent question limit');
  const count=f.read(db=>Number(db.prepare('SELECT count(*) n FROM mm_records WHERE user_id=?').get(f.a.userId)!.n));assert.equal(count,succeeds?1:0);
  if(succeeds){assert.equal(endErrors.length,outcome==='outer-recovery'?1:0);const stored=f.read(db=>db.prepare('SELECT review,prepared FROM mm_job_batches WHERE user_id=? AND job_id=?').get(f.a.userId,job.id))!;assert.ok(stored.review);assert.ok(stored.prepared);const reviewed=JSON.parse(String(stored.review)).result;assert.equal(reviewed.imageReadReceipts.length,1,'the accepted independent run has its own pixel receipt');assert.equal(reviewed.imageReadReceipts[0].imageView.viewId,wholeView);assert.notEqual(reviewed.runId,failures[0].value.runId);if(outcome==='outer-recovery'){const artifacts=f.read(db=>db.prepare("SELECT kind,json FROM mm_batch_artifacts WHERE user_id=? AND job_id=? AND kind LIKE 'model-query:%'").all(f.a.userId,job.id)),raw=artifacts.filter(row=>!String(row.kind).endsWith(':rejections')).map(row=>JSON.parse(String(row.json)));assert.equal(raw.length,4,'one valid extraction plus three physically distinct reviewer outputs');assert.equal(new Set(raw.map(value=>value.runId)).size,4);assert.ok(failures.every(failure=>raw.some(value=>value.runId===failure.value.runId)));assert.ok(f.requests.some(request=>request.raw.includes('Previous rejected result feedback from the host:')));assert.ok(frames.every(frame=>JSON.stringify(frame.draft)===JSON.stringify(frames[0].draft)),'outer retry keeps the exact valid draft');assert.equal(f.node.execution!.engine.get(job.tasks.batch.id)!.attempts,2);}}
  else if(outcome==='twice'){assert.equal(endErrors.length,3);assert.ok(endErrors.every(error=>error.code==='memory_output_image_evidence'));assert.equal(f.node.execution!.engine.get(job.tasks.batch.id)!.attempts,3);assert.equal(f.node.execution!.engine.get(job.tasks.batch.id)!.retryExhausted,true);}
  else if(outcome==='unknown')assert.equal(endErrors[0],unknown,'unknown transport state is not a semantic repair');
  else assert.notEqual(endErrors[0].code,'image_evidence','inter-attempt revocation wins before another model call');
 }catch(error){if(outcome==='twice')t.diagnostic(JSON.stringify({generatedReviewDeadline:{counts,requests:f.requests.length,endErrors:endErrors.map(error=>({code:error.code})),tasks:f.read(db=>db.prepare("SELECT id,kind,state,attempts,error,available_at,updated_at FROM execution_steps WHERE state<>'succeeded'").all()),physical:f.read(db=>db.prepare('SELECT task_id,state,mode,issuance_id,created_at,quiescent_at FROM task_physical_calls ORDER BY created_at').all()),clockNow:Date.now()}}));throw error;}finally{host.query=query;host.recordValidationFailure=record;host.execute=execute;}
});

test('unchanged or unavailable feedback context stops without another model or completed checkpoint',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),data=await f.data(f.a),id=data.materialEvidence(material.id)[0].id;f.answers.set('A',(_raw,keys)=>({memories:[],coverage:keys.map(key=>({key,state:'needs_context',candidateIndexes:[],reason:'No additional authorized original is available.',contextRefs:[id]}))}));const job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);assert.equal(f.requests.length,2);const row=f.read(db=>db.prepare('SELECT state,children FROM mm_feedback WHERE user_id=?').get(f.a.userId));assert.equal(row!.state,'stopped');assert.equal(row!.children,'[]');assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+job.id)).json().batches[0].state,'awaiting_context');await f.restart();await delay(100);assert.equal(f.requests.length,2);
});

test('owner review exposes retained proposals as untrusted audit work while query and foreign owners cannot consume them',async t=>{
 const f=await fixture(t),material=await f.publish(f.a,'A'),gate={entered:deferred(),release:deferred()};f.gates.set('A',gate);const job=await f.submit(f.a,[material.id]);await gate.entered.promise;assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/pause','POST',{})).statusCode,200);gate.release.resolve();f.gates.delete('A');const end=Date.now()+10000;for(;;){const row=(await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/review')).json();if(row.batches?.[0]?.draft){assert.equal(row.usableAsMemory,false);assert.ok(JSON.stringify(row).includes('Nora'));break;}assert.ok(Date.now()<end,JSON.stringify(row));await delay(10);}assert.equal((await f.request(f.a.token,'/api/memory/audit?kind=proposed')).json().items[0].id,job.id);assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);assert.equal((await f.request(f.a.token,'/api/memories?status=proposed')).statusCode,400);assert.equal((await f.request(f.b.token,'/api/memory/jobs/'+job.id+'/review')).statusCode,404);assert.equal((await f.request(f.b.token,'/api/memory/audit?kind=proposed')).json().items.length,0);assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/resume','POST',{})).statusCode,200);await f.wait(f.a,job.id);assert.equal((await f.request(f.a.token,'/api/memory/audit?kind=proposed')).json().items.length,0);assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);
});
