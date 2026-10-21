import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

const deferred=()=>{let resolve!:()=>void;return {promise:new Promise<void>(done=>resolve=done),resolve:()=>resolve()};};
for(const change of ['none','pause','cancel','disable','delete-account','delete-original','withdraw-model'] as const)test('a real durable Memory feedback checkpoint retains authority boundaries: '+change,async t=>{
 const f=await scopedMemoryFixture(t),proposed=deferred(),release=deferred(),settings=defaultMemorySettings();settings.automatic=false;settings.integration=false;settings.lifecycle.batchCharacters=512;await f.replace(f.a.token,'memory',settings);
 const target=await f.publish(f.a,'A','same-source','generated-local-target','GENERATED_FEEDBACK_TARGET '+'.'.repeat(280)),context=await f.publish(f.a,'A','same-source','generated-local-context','GENERATED_FEEDBACK_CONTEXT '+'.'.repeat(280)),data=await f.data(f.a),contextId=data.materialEvidence(context.id)[0].id;
 f.responses.set('A',(res,raw,keys)=>{
  if(raw.includes('A freshly reviewed Memory worker reported needs_context.')){
   if(raw.includes('proposed')){proposed.resolve();void release.promise.then(()=>{if(!res.destroyed)writeMessagesResponse(res,{stage:f.requests.length,text:JSON.stringify({answer:'Generated proposal complete',citationIds:[]})});});return;}
   const payload=f.read(db=>JSON.parse(String(db.prepare('SELECT json FROM mm_feedback WHERE user_id=?').get(f.a.userId)!.json))),selected=payload.request.authorized.find((member:any)=>member.id===contextId);assert.ok(selected);writeMessagesResponse(res,{stage:f.requests.length,tool:{name:'delegation_submit',args:{units:[{localId:'generated-local-unit',capabilityId:'memory.feedback-group',capabilityVersion:'1',goal:'Resolve the exact generated target',input:{memberKeys:payload.request.targets.map((member:any)=>member.key),contextKeys:[selected.key],instruction:'Inspect only this authorized new generated context.'}}]}}});return;
  }
  const needs=raw.includes('GENERATED_FEEDBACK_TARGET')&&!raw.includes('GENERATED_FEEDBACK_CONTEXT');writeMessagesResponse(res,{stage:f.requests.length,text:JSON.stringify({answer:JSON.stringify({memories:[],coverage:keys.map(key=>needs?{key,state:'needs_context',candidateIndexes:[],reason:'Inspect the exact generated context.',contextRefs:[contextId]}:{key,state:'no_candidates',candidateIndexes:[]})}),citationIds:[]})});
 });
 // Interrupt only the wrapper after the real model/host control has durably
 // saved its complete proposal. The original tracked callback stays alive.
 const definition=(f.node.execution as any).handlers.get('memory.feedback'),execute=definition.execute;let entries=0,detached:Promise<unknown>|undefined;
 definition.execute=async(run:any)=>{entries++;detached=execute(run);void detached!.catch(()=>{});await proposed.promise;throw new ExecutionFailure('permanent','generated_checkpoint_interruption');};
 const until=async(check:()=>boolean|Promise<boolean>,message:string)=>{const deadline=performance.now()+15000;while(!await check()){assert.ok(performance.now()<deadline,message);await delay(5);}};
 try{
  const job=await f.submit(f.a,[target.id,context.id]);await proposed.promise;let taskId='';await until(()=>{const row=f.read(db=>db.prepare("SELECT e.id,e.state FROM execution_steps e WHERE e.user_id=? AND e.kind='memory.feedback'").get(f.a.userId));taskId=String(row?.id??'');return row?.state==='failed';},'the generated interruption did not retain the real complete checkpoint');
  const original=f.read(db=>db.prepare("SELECT * FROM task_physical_calls WHERE task_id=? AND state='active'").all(taskId));assert.equal(original.length,1);assert.equal(original[0].issuance_id,null);const before=f.requests.length;assert.equal(f.requests.filter(request=>request.raw.includes('A freshly reviewed Memory worker reported needs_context.')).length,2);
  if(change==='pause')assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/pause','POST',{})).statusCode,200);
  if(change==='cancel')assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{})).statusCode,200);
  if(change==='disable')assert.equal((await f.request(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true})).statusCode,200);
  if(change==='delete-account')assert.equal((await f.request(f.admin.token,'/api/admin/accounts/'+f.a.userId,'DELETE',{operationId:randomUUID()})).statusCode,200);
  if(change==='delete-original')assert.equal((await f.request(f.a.token,'/api/materials/'+target.id,'DELETE')).statusCode,200);
  if(change==='withdraw-model')await f.replace(f.a.token,'models',{profiles:[],selections:{}});
  f.node.execution!.engine.retry(taskId);void f.node.execution!.tick();await until(()=>{const task=f.node.execution!.engine.get(taskId);return change==='none'?task?.state==='succeeded':Boolean(task&&task.state!=='running'&&task.error);},'the real local resume did not reach its admission/authority decision');
  assert.equal(entries,1,'checkpoint consumption must never enter the planner wrapper again');assert.deepEqual(f.read(db=>db.prepare("SELECT * FROM task_physical_calls WHERE task_id=? AND state='active'").all(taskId)),original);assert.equal(f.node.execution!.engine.get(taskId)!.attempts,1);assert.equal(f.node.execution!.engine.get(taskId)!.retryRound,1);
  const children=f.read(db=>db.prepare('SELECT children FROM mm_feedback WHERE user_id=?').get(f.a.userId));if(change==='none'){assert.equal(JSON.parse(String(children!.children)).length,1);await f.wait(f.a,JSON.parse(String(children!.children))[0]);assert.equal(f.requests.length,before+2,'only the normal exact-context child extracts and independently reviews');}else{assert.equal(JSON.parse(String(children?.children??'[]')).length,0);assert.equal(f.requests.length,before,'retirement or pause cannot use the local exception to add a query or child');}
  assert.equal(f.requests.filter(request=>request.raw.includes('A freshly reviewed Memory worker reported needs_context.')).length,2);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_retry_confirmations').get()!.n),0);assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM task_external_policy_replays').get()!.n),0);assert.equal((await f.request(f.b.token,'/api/memory/jobs/'+job.id)).statusCode,404);
 }finally{definition.execute=execute;release.resolve();await detached?.catch(()=>{});}
});
