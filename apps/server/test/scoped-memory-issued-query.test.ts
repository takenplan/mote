import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {ExecutionFailure} from '../src/execution-engine.js';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function until(check:()=>boolean|Promise<boolean>,message:string){const end=Date.now()+15000;while(!await check()){assert.ok(Date.now()<end,message);await delay(5);}}
const generatedAnswer=(owner:string,keys:string[],ids:string[])=>({memories:[{title:'Generated '+owner,statement:`Nora prefers generated tea. [${ids[0]}]`,uncertainty:'Generated fixture only',admission:{layer:'memory',reason:'Generated expressed preference',scope:'Generated Nora',attribution:'third_party'},evidenceIds:[ids[0]],evidence:[{id:ids[0],quote:'GENERATED_MEMORY_'+owner+': Nora prefers generated tea.'}]}],...(keys.length?{coverage:keys.map((key,index)=>({key,state:index===0?'checked':'no_candidates',candidateIndexes:index===0?[0]:[]}))}:{})});

for(const phase of ['extract','review'] as const)test(`issued Memory ${phase} survives lease recovery, abort and restart without another request`,{timeout:45000},async t=>{
 const f=await scopedMemoryFixture(t),gate={entered:deferred(),release:deferred()},aMaterial=await f.publish(f.a,'A');
 if(phase==='extract')f.gates.set('A',gate);
 else f.answers.set('A',(_raw,keys,ids)=>{f.gates.set('A',gate);return generatedAnswer('A',keys,ids);});
 const job=await f.submit(f.a,[aMaterial.id]);await gate.entered.promise;
 const row=()=>f.read(db=>db.prepare("SELECT e.id,e.state,e.error,u.external_state,b.draft,b.review FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id JOIN mm_job_batches b ON b.user_id=u.user_id AND b.id=json_extract(u.input,'$.batchId') WHERE e.kind='memory.batch' AND u.user_id=? AND json_extract(u.input,'$.jobId')=?").get(f.a.userId,job.id))!;
 const taskId=String(row().id),before=f.requests.filter(request=>request.key.includes('GENERATED_A_KEY')).length;
 assert.equal(before,phase==='extract'?1:2);assert.equal(row().external_state,'issued');assert.equal(Boolean(row().draft),phase==='review');assert.equal(row().review,null);
 const journal=()=>f.read(db=>db.prepare('SELECT issuance_id,state,settled_at FROM task_external_calls WHERE task_id=? ORDER BY issued_at,issuance_id').all(taskId));
 const originalIssued=journal().find(call=>call.state==='issued')!;assert.ok(originalIssued);assert.equal(originalIssued.settled_at,null);
 f.read(db=>db.prepare('UPDATE execution_steps SET lease_until=0 WHERE id=?').run(taskId));
 await f.node.execution!.tick();assert.equal(row().state,'waiting');assert.equal(row().error,'interrupted');
 assert.equal(f.requests.filter(request=>request.key.includes('GENERATED_A_KEY')).length,before);
 // Use the actual cancellation path after deterministic lease recovery. This
 // does not pretend to have waited for the ten-second renewal timer.
 f.node.execution!.engine.abortLocal(taskId);
 await until(()=>!f.node.execution!.engine.isActiveStep(taskId),'expired Memory wrapper did not settle');
 await until(async()=>{await f.node.execution!.tick();return row().state==='blocked';},'unknown issued query did not block recovery');
 assert.equal(row().error,'external_result_unknown');assert.equal(row().external_state,'issued');
 assert.equal((await f.request(f.b.token,'/api/tasks/'+taskId)).statusCode,404);
 const rejected=await f.request(f.a.token,'/api/tasks/'+taskId+'/retry','POST',{});assert.equal(rejected.statusCode,409,rejected.body);
 gate.release.resolve();await f.restart();await f.node.execution!.tick();
 assert.equal(row().external_state,'issued');assert.equal(row().state,'blocked');assert.equal(row().review,null);assert.equal(Boolean(row().draft),phase==='review');
 assert.deepEqual(journal().find(call=>call.issuance_id===originalIssued.issuance_id),originalIssued);
 assert.equal(f.requests.filter(request=>request.key.includes('GENERATED_A_KEY')).length,before);
 const bMaterial=await f.publish(f.b,'B'),bJob=await f.submit(f.b,[bMaterial.id]);await f.wait(f.b,bJob.id);
 assert.equal(f.requests.filter(request=>request.key.includes('GENERATED_B_KEY')).length,2,'another owner still extracts and independently reviews');
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,0);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);
});

for(const phase of ['extract','review'] as const)test(`successful Memory ${phase} query checkpoint survives before its domain save and is reused after restart`,{timeout:45000},async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A'),host=f.node.memory! as any,original=host.query.bind(host);let interrupted=false;
 host.query=async(run:any,input:any,args:any)=>{const value=await original(run,input,args);if(!interrupted&&(args.taskContext?.untrustedMemoryDraft?'review':'extract')===phase){interrupted=true;throw new ExecutionFailure('blocked','generated_after_query_checkpoint');}return value;};
 const job=await f.submit(f.a,[material.id]);
 const state=()=>f.read(db=>db.prepare("SELECT e.id,e.state,b.draft,b.review,u.external_state FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id JOIN mm_job_batches b ON b.user_id=u.user_id AND b.id=json_extract(u.input,'$.batchId') WHERE e.kind='memory.batch' AND u.user_id=? AND json_extract(u.input,'$.jobId')=?").get(f.a.userId,job.id));
 await until(()=>state()?.state==='blocked','generated post-query interruption did not reach its save boundary');const before=state()!;
 assert.ok(interrupted);assert.equal(Boolean(before.draft),phase==='review');assert.equal(before.review,null);assert.equal(before.external_state,'succeeded');
 const checkpoints=f.read(db=>db.prepare("SELECT kind,json FROM mm_batch_artifacts WHERE user_id=? AND job_id=? AND kind LIKE 'model-query:%'").all(f.a.userId,job.id));assert.equal(checkpoints.length,phase==='extract'?1:2);
 assert.ok(checkpoints.every(checkpoint=>JSON.parse(String(checkpoint.json)).runId));
 const callsBefore=f.requests.length;assert.equal(callsBefore,phase==='extract'?1:2);
 assert.equal((await f.request(f.b.token,'/api/memory/jobs/'+job.id)).statusCode,404);
 await f.restart();const retry=await f.request(f.a.token,'/api/tasks/'+before.id+'/retry','POST',{});assert.equal(retry.statusCode,200,retry.body);await f.wait(f.a,job.id);
 assert.equal(f.requests.length,2,'successful extraction and independent review each run exactly once');
 const calls=f.read(db=>db.prepare('SELECT state FROM task_external_calls WHERE task_id=?').all(before.id));assert.equal(calls.length,2);assert.ok(calls.every(call=>call.state==='succeeded'));
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,0);
 const requests=f.requests.length;await f.submit(f.a,[material.id],job.id);assert.equal(f.requests.length,requests,'completed sibling/domain checkpoints remain reusable');
});

test('a structured rejected-before-execution Memory request settles its issuance and keeps bounded recovery',{timeout:45000},async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A');
 f.responses.set('A',res=>{f.responses.delete('A');res.writeHead(429,{'Content-Type':'application/json','Retry-After':'0'}).end(JSON.stringify({error:{type:'rate_limit_error',message:'Generated admission rejection'}}));});
 const job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);
 assert.equal(f.requests.length,3,'one rejected request, extraction and independent review');
 const taskId=f.read(db=>db.prepare("SELECT e.id FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id WHERE e.kind='memory.batch' AND u.user_id=? AND json_extract(u.input,'$.jobId')=?").get(f.a.userId,job.id)!.id);
 const calls=f.read(db=>db.prepare('SELECT state FROM task_external_calls WHERE task_id=? ORDER BY issued_at,issuance_id').all(taskId));assert.deepEqual(calls.map(call=>call.state),['not_executed','succeeded','succeeded']);
 const usages=f.read(db=>db.prepare("SELECT json FROM user_model_usage WHERE user_id=? AND json_extract(json,'$.attribution.jobId')=?").all(f.a.userId,job.id).map(row=>JSON.parse(String(row.json))));
 assert.ok(usages.some(usage=>usage.status==='failed'&&usage.issuance.executionStarted===false));assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);
});

test('in-session output repair keeps the same issuance while independent review owns another query',{timeout:45000},async t=>{
 const f=await scopedMemoryFixture(t),material=await f.publish(f.a,'A');let responses=0;
 f.answers.set('A',(_raw,keys,ids)=>++responses===1?{memories:[{title:'Generated invalid draft'}]}:generatedAnswer('A',keys,ids));
 const job=await f.submit(f.a,[material.id]);await f.wait(f.a,job.id);assert.equal(f.requests.length,3,'invalid output is repaired in-session before the independent review');
 const calls=f.read(db=>db.prepare("SELECT c.state,c.request_key FROM task_external_calls c JOIN user_tasks u ON u.task_id=c.task_id WHERE u.user_id=? AND json_extract(u.input,'$.jobId')=? ORDER BY c.issued_at,c.issuance_id").all(f.a.userId,job.id));
 assert.equal(calls.length,2);assert.ok(calls.every(call=>call.state==='succeeded'));assert.notEqual(calls[0].request_key,calls[1].request_key);
 assert.equal((await f.request(f.a.token,'/api/memories')).json().items.length,1);
});
