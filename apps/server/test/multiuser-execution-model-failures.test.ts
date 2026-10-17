import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {ProviderFailure} from '@mote/shared';
import {buildApp} from '../src/app.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import type {TaskExecution,TaskRun,UserTaskHandler} from '../src/scope/task-execution.js';

const password='Generated-model-failure-password-01',secret='GENERATED_PRIVATE_PROVIDER_MESSAGE_AND_KEY';
const protocol={'x-mote-protocol-version':'2'};
const usage={status:'completed' as const,durationMs:1,tokens:{requests:1,reportedRequests:1,inputTokens:1,outputTokens:1,totalTokens:2}};
const personal=(key:string)=>({profiles:[{id:'same-profile',name:'Generated model',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions' as const,baseUrl:'https://generated.invalid/v1',model:'generated-failure-model',apiKey:key}}],selections:{chat:{kind:'personal' as const,id:'same-profile'}}});
const handler=(execute:UserTaskHandler['execute']):UserTaskHandler=>({kind:'generated.model-failure',pool:'generated-model-failure',concurrency:()=>2,policy:EXECUTION_POLICIES.modelCall,modelFeature:'chat',parseInput:input=>z.object({label:z.string()}).strict().parse(input),execute});
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};

async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m05-model-failure-')),node=await buildApp({dataDir:directory});assert.ok(node.execution);const execution=node.execution as TaskExecution;
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-failure-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const response=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});assert.equal(response.statusCode,200,response.body);return response.json();};
 const admin=await login('generated-failure-admin');
 const create=async(username:string)=>{const response=await request(admin.token,'/api/admin/accounts','POST',{username,password,administrator:false});assert.equal(response.statusCode,200,response.body);return {...response.json(),...await login(username)};};
 const a=await create('generated-failure-a'),b=await create('generated-failure-b');
 const configure=async(token:string,key:string)=>{const view=await request(token,'/api/configuration');assert.equal(view.statusCode,200,view.body);const response=await request(token,'/api/configuration/models','PUT',{revision:view.json().revision,value:personal(key)});assert.equal(response.statusCode,200,response.body);};
 await configure(a.token,'GENERATED_MODEL_FAILURE_A_KEY');await configure(b.token,'GENERATED_MODEL_FAILURE_B_KEY');
 const submit=async(token:string,label='same-operation')=>{const response=await request(token,'/api/tasks','POST',{kind:'generated.model-failure',operationId:label,input:{label}});assert.equal(response.statusCode,200,response.body);return response.json();};
 const task=async(token:string,taskId:string)=>{const response=await request(token,'/api/tasks/'+taskId);assert.equal(response.statusCode,200,response.body);assert.ok(!response.body.includes(secret));return response.json();};
 return {node,execution,a,b,request,configure,submit,task};
}

for(const kind of ['provider','execution'] as const)test(`real M04 preserves genuine ${kind} transient failures through the finite model-call budget`,async t=>{
 const f=await fixture(t),calls=new Map<string,number>();
 f.execution.register(handler(async run=>run.model!.withModel(async()=>{
  const attempt=(calls.get(run.context.userId)??0)+1;calls.set(run.context.userId,attempt);
  if(run.context.userId===f.a.userId){const error=kind==='provider'?new ProviderFailure({category:'transient',code:'provider_network',retryAfterMs:0},secret):new ExecutionFailure('transient','generated_transport',0);error.message=secret;Object.assign(error,{credential:secret});throw error;}
  run.model!.recordUsage(usage);return {owner:run.context.userId};
 })));
 const a=await f.submit(f.a.token),b=await f.submit(f.b.token);await f.execution.engine.drain([a.id,b.id]);
 const failed=await f.task(f.a.token,a.id),other=await f.task(f.b.token,b.id);
 assert.equal(calls.get(f.a.userId),4);assert.equal(failed.state,'failed');assert.equal(failed.attempts,4);assert.equal(failed.failure.category,'transient');assert.equal(failed.failure.code,kind==='provider'?'provider_network':'generated_transport');assert.equal(failed.failure.attempt,4);
 assert.equal(other.state,'succeeded');assert.deepEqual(other.result,{owner:f.b.userId});assert.equal(calls.get(f.b.userId),1);
 assert.equal((await f.request(f.a.token,'/api/usage')).json().items.length,0);const receipts=(await f.request(f.b.token,'/api/usage')).json().items;assert.equal(receipts.length,1);assert.equal(receipts[0].attribution.operationId,b.operationId);
});

test('real M04 transient failures may heal within the same admitted model snapshot',async t=>{
 const f=await fixture(t);let calls=0,snapshotId:string|undefined;
 f.execution.register(handler(async run=>run.model!.withModel(async()=>{calls++;snapshotId??=run.model!.lease.snapshotId;assert.equal(run.model!.lease.snapshotId,snapshotId);if(calls<3)throw new ProviderFailure({category:'transient',code:'provider_network',retryAfterMs:0},secret);run.model!.recordUsage(usage);return {done:true};})));
 const job=await f.submit(f.a.token);await f.execution.engine.drain([job.id]);const task=await f.task(f.a.token,job.id);assert.equal(task.state,'succeeded');assert.equal(task.attempts,3);assert.equal(calls,3);const receipt=(await f.request(f.a.token,'/api/usage')).json().items[0];assert.equal(receipt.id,snapshotId);assert.equal(receipt.attribution.operationId,job.operationId);
});

for(const kind of ['provider','execution'] as const)test(`real M04 preserves genuine ${kind} blocked failures without automatic retries`,async t=>{
 const f=await fixture(t);let calls=0;
 f.execution.register(handler(async run=>run.model!.withModel(async()=>{calls++;throw kind==='provider'?new ProviderFailure({category:'blocked',code:'provider_response_unknown'},secret):new ExecutionFailure('blocked','generated_approval_required');})));
 const job=await f.submit(f.a.token);await f.execution.engine.drain([job.id]);await f.execution.engine.drain([job.id]);const task=await f.task(f.a.token,job.id);assert.equal(task.state,'blocked');assert.equal(task.attempts,1);assert.equal(task.failure.category,'blocked');assert.equal(task.failure.code,kind==='provider'?'provider_response_unknown':'generated_approval_required');assert.equal(calls,1);
 const foreign=await f.request(f.b.token,'/api/tasks/'+job.id+'/retry','POST',{});assert.equal(foreign.statusCode,404);assert.equal(calls,1);
});

test('real M04 provider capacity facts retain a durable wait without spending a call attempt',async t=>{
 const f=await fixture(t);let calls=0;
 f.execution.register(handler(async run=>run.model!.withModel(async()=>{calls++;throw new ProviderFailure({category:'transient',code:'provider_unavailable',retryAfterMs:60000,executionStarted:false,admissionWaiting:true},secret);})));
 const job=await f.submit(f.a.token);await f.execution.engine.drain([job.id]);await f.execution.engine.drain([job.id]);const task=await f.task(f.a.token,job.id);assert.equal(task.state,'waiting');assert.equal(task.attempts,0);assert.equal(task.failure.category,'waiting');assert.equal(task.failure.executionStarted,false);assert.equal(task.failure.admissionWaiting,true);assert.equal(task.failure.attempt,0);assert.ok(task.availableAt>Date.now());assert.equal(calls,1);
});

for(const kind of ['error','lookalike'] as const)test(`real M04 continues to clean ${kind} exceptions instead of accepting forged failure facts`,async t=>{
 const f=await fixture(t);let calls=0;
 f.execution.register(handler(async run=>run.model!.withModel(async()=>{calls++;const details={category:'transient',code:'provider_network',retryAfterMs:0,executionStarted:false,admissionWaiting:true};throw kind==='error'?Object.assign(Error(secret),{details,facts:{executionStarted:false},credential:secret}):{name:'ProviderFailure',message:secret,details,facts:{executionStarted:false},credential:secret};})));
 const job=await f.submit(f.a.token);await f.execution.engine.drain([job.id]);const task=await f.task(f.a.token,job.id);assert.equal(task.state,'failed');assert.equal(task.attempts,1);assert.equal(task.failure.category,'permanent');assert.equal(task.failure.code,'task_failed');assert.equal(task.failure.executionStarted,undefined);assert.equal(task.failure.admissionWaiting,undefined);assert.equal(calls,1);
});

for(const kind of ['provider-code','execution-code','provider-delay'] as const)test(`invalid genuine ${kind} control facts remain cleaned and cannot reach durable errors`,async t=>{
 const f=await fixture(t);let calls=0;
 f.execution.register(handler(async run=>run.model!.withModel(async()=>{calls++;throw kind==='execution-code'?new ExecutionFailure('transient',secret,0):new ProviderFailure({category:'transient',code:kind==='provider-code'?secret:'provider_network',retryAfterMs:kind==='provider-delay'?-1:0},secret);})));
 const job=await f.submit(f.a.token);await f.execution.engine.drain([job.id]);const task=await f.task(f.a.token,job.id);assert.equal(task.state,'failed');assert.equal(task.attempts,1);assert.equal(task.error,'task_failed');assert.equal(task.failure.category,'permanent');assert.equal(task.failure.code,'task_failed');assert.equal(calls,1);
});

test('genuine model retry delays follow the existing seven-day transport ceiling',async t=>{
 const f=await fixture(t);let calls=0;
 f.execution.register(handler(async run=>run.model!.withModel(async()=>{calls++;throw new ProviderFailure({category:'transient',code:'provider_unavailable',retryAfterMs:Number.MAX_VALUE,executionStarted:false,admissionWaiting:true},secret);})));
 const job=await f.submit(f.a.token);await f.execution.engine.drain([job.id]);const task=await f.task(f.a.token,job.id);assert.equal(task.state,'waiting');assert.equal(task.attempts,0);assert.equal(calls,1);assert.ok(task.availableAt>Date.now()+7*86400000-5000);assert.ok(task.availableAt<=Date.now()+7*86400000);
});

test('an issued external call remains unknown after a genuine model transient failure and cannot replay without its owner confirmation',async t=>{
 const f=await fixture(t);let calls=0;
 f.execution.register(handler(async run=>run.model!.withModel(async()=>{run.external.begin('generated-request');calls++;throw new ProviderFailure({category:'transient',code:'provider_network',retryAfterMs:0},secret);})));
 const job=await f.submit(f.a.token);await f.execution.engine.drain([job.id]);let task=await f.task(f.a.token,job.id);assert.equal(task.state,'blocked');assert.equal(task.error,'external_result_unknown');assert.equal(task.externalState,'issued');assert.equal(task.attempts,1);assert.equal(calls,1);
 assert.equal((await f.request(f.b.token,'/api/tasks/'+job.id+'/retry','POST',{confirmUnknown:true})).statusCode,404);assert.equal((await f.request(f.a.token,'/api/tasks/'+job.id+'/retry','POST',{})).statusCode,409);await f.execution.engine.drain([job.id]);assert.equal(calls,1);
 assert.equal((await f.request(f.a.token,'/api/tasks/'+job.id+'/retry','POST',{confirmUnknown:true})).statusCode,200);await f.execution.engine.drain([job.id]);task=await f.task(f.a.token,job.id);assert.equal(task.state,'blocked');assert.equal(task.error,'external_result_unknown');assert.equal(task.externalUnresolved,2);assert.equal(calls,2);assert.equal((await f.request(f.b.token,'/api/usage')).json().items.length,0);
});

test('model withdrawal outranks a captured genuine transient failure and fences every late publication',async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred();let captured:TaskRun|undefined,calls=0,commits=0;t.after(()=>release.resolve());
 f.execution.register({...handler(async run=>{captured=run;return run.model!.withModel(async()=>{calls++;entered.resolve();await release.promise;throw new ProviderFailure({category:'transient',code:'provider_network',retryAfterMs:0},secret);});}),commit:()=>{commits++;}});
 const job=await f.submit(f.a.token);await entered.promise;await f.configure(f.a.token,'');assert.throws(()=>captured!.model!.recordUsage(usage));assert.throws(()=>captured!.progress({late:true}));assert.throws(()=>captured!.checkpoint.write('late',{}));release.resolve();await f.execution.engine.drain([job.id]);
 const deadline=Date.now()+8000;while(f.execution.engine.get(job.id)!.state==='running'){assert.ok(Date.now()<deadline);await delay(5);}
 const task=await f.task(f.a.token,job.id);assert.equal(task.state,'stale');assert.equal(task.result,undefined);assert.equal(calls,1);assert.equal(commits,0);assert.equal((await f.request(f.a.token,'/api/usage')).json().items.length,0);assert.equal((await f.request(f.b.token,'/api/usage')).json().items.length,0);
});
