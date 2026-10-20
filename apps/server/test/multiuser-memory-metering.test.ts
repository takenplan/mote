import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture as fixture} from './fixtures/scoped-memory-host.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';
import {z} from 'zod';
import {queryWithUsage} from '../src/scope/model-query.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import type {ContextReader} from '@mote/agent';

const deferred=()=>{let resolve!:()=>void;return {promise:new Promise<void>(r=>resolve=r),resolve:()=>resolve()};};
const reader:ContextReader={search:async()=>[],timeline:async()=>({items:[],nextCursor:null}),evidence:async()=>[],devices:async()=>[],activity:async()=>({})};

test('one public task makes two real queries on the same pinned model lease and retains both fragments',async t=>{
 const f=await fixture(t);f.responses.set('A',res=>writeMessagesResponse(res,{stage:f.requests.length,text:JSON.stringify({answer:'Generated response',citationIds:[]}),usage:{inputTokens:f.requests.length===1?160:80,outputTokens:f.requests.length===1?80:40,cacheReadTokens:0,cacheWriteTokens:0}}));
 f.node.execution!.register({kind:'generated.multi-query',pool:'generated-queries',concurrency:()=>1,policy:EXECUTION_POLICIES.modelCall,modelFeature:'memory',parseInput:value=>z.object({}).strict().parse(value),execute:async run=>run.model!.withModel(async settings=>{for(let i=0;i<2;i++)await queryWithUsage(run.model!,{...settings,reader},{question:'Generated query '+i});return {complete:true};})});
 const submitted=await f.request(f.a.token,'/api/tasks','POST',{kind:'generated.multi-query',operationId:'generated-multiple-query',input:{}});assert.equal(submitted.statusCode,200,submitted.body);assert.equal(await f.terminal(submitted.json().id),'succeeded');
 const usage=(await f.request(f.a.token,'/api/usage')).json();assert.equal(usage.items.length,2);assert.equal(new Set(usage.items.map((item:any)=>item.issuance.leaseId)).size,1);assert.notEqual(usage.items[0].id,usage.items[1].id);assert.equal(usage.total.totalTokens,360);assert.equal(f.requests.length,2);
});

for(const revoke of ['cancel','model','source'] as const)test('an in-flight Memory '+revoke+' retires its existing usage fragment without waiting for a process restart',async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred();f.gates.set('A',{entered,release});t.after(release.resolve);const job=await f.submit(f.a,[(await f.publish(f.a,'A')).id]);await entered.promise;
 const running=(await f.request(f.a.token,'/api/usage')).json().items;assert.equal(running.length,1);assert.equal(running[0].status,'running');
 if(revoke==='cancel')assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+job.id+'/cancel','POST',{})).statusCode,200);
 else if(revoke==='model')await f.replace(f.a.token,'models',{profiles:[],selections:{}});
 else assert.equal((await f.request(f.a.token,'/api/sources/same-source','DELETE')).statusCode,200);
 release.resolve();f.gates.delete('A');const end=Date.now()+10000;let items:any[]=[];for(;;){items=(await f.request(f.a.token,'/api/usage')).json().items;if(items.length===1&&items[0].status!=='running')break;assert.ok(Date.now()<end,JSON.stringify(items));await delay(10);}
 assert.equal(items[0].id,running[0].id);assert.equal(items[0].status,'failed');assert.equal(items[0].issuance.state,'settled');assert.equal((await f.request(f.b.token,'/api/usage')).json().items.length,0);
});

test('a busy reply after an earlier consumed turn keeps its tokens while the public task remains resource waiting',async t=>{
 const f=await fixture(t);f.responses.set('A',res=>{if(f.requests.length===1)writeMessagesResponse(res,{stage:1,tool:{name:'timeline',args:{}}});else res.writeHead(429,{'Content-Type':'application/json','Retry-After':'60'}).end(JSON.stringify({error:{message:'GENERATED_CAPACITY_SECRET'}}));});
 f.node.execution!.register({kind:'generated.multi-turn-busy',pool:'generated-busy-query',concurrency:()=>1,policy:EXECUTION_POLICIES.modelCall,modelFeature:'memory',parseInput:value=>z.object({}).strict().parse(value),execute:run=>run.model!.withModel(settings=>queryWithUsage(run.model!,{...settings,reader},{question:'Inspect generated timeline before answering'}))});
 const submitted=await f.request(f.a.token,'/api/tasks','POST',{kind:'generated.multi-turn-busy',operationId:'generated-multi-turn-busy',input:{}});assert.equal(submitted.statusCode,200,submitted.body);const end=Date.now()+10000;let task:any;
 for(;;){task=(await f.request(f.a.token,'/api/tasks/'+submitted.json().id)).json();if(task.state==='waiting'&&task.error==='rate_limited')break;assert.ok(Date.now()<end,JSON.stringify(task));await delay(10);}
 assert.equal(task.attempts,0);assert.ok(task.availableAt>Date.now());assert.ok(!JSON.stringify(task).includes('GENERATED_CAPACITY_SECRET'));
 const usage=(await f.request(f.a.token,'/api/usage')).json();assert.equal(usage.items.length,1);assert.equal(usage.total.totalTokens,120);assert.equal(usage.items[0].issuance.executionStarted,undefined);assert.equal(f.requests.length,2);
});

test('real Memory entry retains all 600 failed tokens and safe host-validation diagnosis after finite correction',async t=>{
 const f=await fixture(t),secret='GENERATED_SECRET_BAD_MODEL_RESPONSE';
 f.responses.set('A',res=>writeMessagesResponse(res,{stage:f.requests.length,model:'generated-memory',text:JSON.stringify({answer:secret,citationIds:[]}),usage:{inputTokens:100,outputTokens:50,cacheReadTokens:0,cacheWriteTokens:0}}));
 const material=await f.publish(f.a,'A'),job=await f.submit(f.a,[material.id]),extract=job.tasks.batch.id;
 assert.equal(await f.terminal(extract),'failed');
 const task=await f.request(f.a.token,'/api/tasks/'+extract);assert.equal(task.statusCode,200,task.body);assert.equal(task.json().failure.code,'agent_host_validation');assert.equal(task.json().failure.causeCode,'json');assert.equal(task.json().failure.jobId,job.id);assert.ok(task.json().failure.runId);assert.equal(task.json().attempts,1);assert.ok(!task.body.includes(secret));
 const usage=await f.request(f.a.token,'/api/usage');assert.equal(usage.statusCode,200,usage.body);assert.equal(usage.json().items.length,1);assert.equal(usage.json().items[0].status,'failed');assert.equal(usage.json().total.totalTokens,600);assert.equal(usage.json().total.reportedRequests,4);assert.equal(usage.json().items[0].estimatedCost,null);assert.equal(f.requests.length,4);
 assert.equal((await f.request(f.b.token,'/api/usage')).json().items.length,0);
 await f.restart();const after=(await f.request(f.a.token,'/api/usage')).json();assert.equal(after.total.totalTokens,600);assert.equal(after.items.length,1);assert.equal(f.requests.length,4,'restart must not reopen the failed stage');
});

test('Memory ready review and publication progress before an extraction backlog drains, across users and cancellation',async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred();f.gates.set('A',{entered:{promise:entered.promise,resolve:entered.resolve},release:{promise:release.promise,resolve:release.resolve}});
 const first=await f.submit(f.a,[(await f.publish(f.a,'A','same-source','first')).id]);await entered.promise;
 const jobs=[];for(let i=0;i<8;i++)jobs.push(await f.submit(f.a,[(await f.publish(f.a,'A','same-source','backlog-'+i)).id]));
 const cancelled=jobs.pop()!;assert.equal((await f.request(f.a.token,'/api/memory/jobs/'+cancelled.id+'/cancel','POST',{})).statusCode,200);
 const other=await f.submit(f.b,[(await f.publish(f.b,'B')).id]);f.gates.delete('A');release.resolve();
 await Promise.all([f.wait(f.a,first.id),f.wait(f.b,other.id)]);
 const succeeded=f.read(db=>Number(db.prepare("SELECT count(*) n FROM execution_steps WHERE user_id=? AND kind='memory.batch' AND state='succeeded'").get(f.a.userId)!.n));
 assert.ok(succeeded<9,'first publication must not wait for every pending extraction');assert.ok((await f.request(f.a.token,'/api/memories')).json().items.length>=1);assert.equal((await f.request(f.b.token,'/api/memories')).json().items.length,1);
 for(const job of jobs)await f.wait(f.a,job.id);
 const before=f.requests.length;await f.restart();await delay(50);assert.equal(f.requests.length,before,'restart does not replay successful or cancelled work');assert.equal((await f.request(f.a.token,'/api/tasks/'+cancelled.tasks.batch.id)).json().state,'cancelled');
 const receipts=(await f.request(f.a.token,'/api/usage')).json().items;assert.ok(receipts.every((item:any)=>item.issuance?.issuedAt&&item.durationMs>=0));assert.equal(new Set(receipts.map((item:any)=>item.id)).size,receipts.length);
});
