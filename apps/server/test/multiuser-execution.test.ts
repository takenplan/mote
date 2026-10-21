import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {z} from 'zod';
import {buildApp} from '../src/app.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import {TaskExecution,type UserTaskHandler,type TaskRun} from '../src/scope/task-execution.js';
import type {PrivateData} from '../src/scope/private-data.js';

const password='Generated-execution-password-01';
const protocol={'x-mote-protocol-version':'2'};
const headers=(token:string)=>({...protocol,authorization:'Bearer '+token});
const inputSchema=z.object({label:z.string().min(1),resource:z.string().optional(),fail:z.boolean().optional()}).strict();
const handler=(patch:Partial<UserTaskHandler>={}):UserTaskHandler=>({kind:'generated.execution',pool:'generated',concurrency:()=>1,policy:EXECUTION_POLICIES.deterministic,parseInput:input=>inputSchema.parse(input),execute:async run=>({label:run.task.input.label}),portableInput:input=>input,...patch});
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function until(check:()=>boolean,message:string){const deadline=Date.now()+8000;while(!check()){if(Date.now()>=deadline)assert.fail(message);await delay(5);}}
type ProductionNode=Awaited<ReturnType<typeof buildApp>>&{execution:TaskExecution};
async function fixture(t:TestContext,register?:(node:ProductionNode)=>void){
 const directory=mkdtempSync(join(tmpdir(),'mote-m05-production-')),nodes:ProductionNode[]=[];
 const node=await buildApp({dataDir:directory}) as ProductionNode;nodes.push(node);assert.ok(node.execution,'production composition must install the task host');register?.(node);
 t.after(async()=>{for(const current of nodes.reverse())await current.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown,extra:Record<string,string>={})=>node.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{}),...extra},...(payload===undefined?{}:{payload})});
 const login=async(username:string,mode:'client'|'web'='client')=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode,durationMs:86400000});assert.equal(r.statusCode,200,r.body);return {response:r,...r.json()};};
 const admin=await login('generated-admin');
 const create=async(username:string)=>{const r=await request(admin.token,'/api/admin/accounts','POST',{username,password,administrator:false});assert.equal(r.statusCode,200,r.body);return r.json();};
 const a=await create('generated-a'),b=await create('generated-b'),alice=await login(a.username),bob=await login(b.username);
 const submit=async(token:string,operationId:string,input:Record<string,unknown>={label:operationId},dependencies:string[]=[])=>{const r=await request(token,'/api/tasks','POST',{kind:'generated.execution',operationId,input,dependencies});assert.equal(r.statusCode,200,r.body);return r.json();};
 const task=async(token:string,id:string)=>{const r=await request(token,'/api/tasks/'+id);assert.equal(r.statusCode,200,r.body);return r.json();};
 const waitTask=async(token:string,id:string,state='succeeded')=>{const deadline=Date.now()+8000;for(;;){const value=await task(token,id);if(value.state===state)return value;if(Date.now()>=deadline)assert.fail(`task ${id} did not reach ${state}: ${JSON.stringify(value)}`);await delay(5);}};
 return {directory,node,nodes,request,login,admin,a,b,alice,bob,submit,task,waitTask};
}

test('large validated ASCII and multibyte task inputs retain exact identity, resources and restart deduplication',async t=>{
 let calls=0;
 const definition=()=>handler({resources:input=>[{scope:'user',key:'generated-evidence:'+input.resource}],execute:async()=>{calls++;return {complete:true};}});
 const f=await fixture(t,node=>node.execution.register(definition())),inputs=[{resource:'ascii',label:'a'.repeat(40000)},{resource:'unicode',label:'界'.repeat(12000)}];
 assert.ok(JSON.stringify(inputs[0]).length>32768);
 assert.ok(Buffer.byteLength(JSON.stringify(inputs[1]))>32768&&JSON.stringify(inputs[1]).length<32768,'multibyte data independently exercises the old byte gate');
 const stored=()=>{const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{return db.prepare('SELECT e.id,e.input engine_input,u.input task_input,e.user_id,e.authorization_epoch,a.revoked FROM execution_steps e JOIN user_tasks u ON u.task_id=e.id JOIN task_authorizations a ON a.task_id=e.id WHERE e.kind=? ORDER BY e.id').all('generated.execution');}finally{db.close();}};
 const ids:string[]=[];
 for(const input of inputs){const task=await f.submit(f.alice.token,'generated-large-'+input.resource,input);ids.push(task.id);await f.waitTask(f.alice.token,task.id);assert.equal((await f.submit(f.alice.token,'generated-large-'+input.resource,{label:input.label,resource:input.resource})).id,task.id);const row=stored().find(row=>row.id===task.id)!;assert.equal(row.task_input,row.engine_input);assert.deepEqual(JSON.parse(String(row.task_input)),input);assert.equal(row.user_id,f.a.userId);assert.equal(row.revoked,0);
  const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{assert.deepEqual(db.prepare('SELECT resource_key FROM execution_resources WHERE step_id=?').all(task.id).map(row=>String(row.resource_key)),[JSON.stringify(['user',f.a.userId,'generated-evidence:'+input.resource])]);}finally{db.close();}
 }
 const before=stored(),bob=await f.submit(f.bob.token,'generated-b-parent',{label:'Generated B'});await f.waitTask(f.bob.token,bob.id);
 const rejected=await f.request(f.alice.token,'/api/tasks','POST',{kind:'generated.execution',operationId:'generated-large-foreign-dependency',input:inputs[0],dependencies:[bob.id]});assert.equal(rejected.statusCode,404);assert.equal(stored().length,3,'failed dependency admission leaves no task');
 const invalid=await f.request(f.alice.token,'/api/tasks','POST',{kind:'generated.execution',operationId:'generated-invalid-large',input:{...inputs[0],unexpected:true}});assert.equal(invalid.statusCode,400);assert.equal(stored().length,3);
 await f.node.app.close();const restarted=await buildApp({dataDir:f.directory}) as ProductionNode;f.nodes.push(restarted);restarted.execution.register(definition());await restarted.app.ready();await restarted.execution.tick();assert.equal(calls,3);assert.deepEqual(stored().filter(row=>ids.includes(String(row.id))),before);
 for(const [index,input] of inputs.entries()){const response=await restarted.app.inject({method:'POST',url:'/api/tasks',headers:headers(f.alice.token),payload:{kind:'generated.execution',operationId:'generated-large-'+input.resource,input}});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().id,ids[index]);}
 await restarted.execution.tick();assert.equal(calls,3,'restart and duplicate admission do not execute successful tasks again');
});

test('large task input does not relax bounded progress, checkpoint or result metadata',async t=>{
 const oversized={generated:'界'.repeat(12000)};
 const f=await fixture(t,node=>node.execution.register(handler({execute:async run=>{
  run.progress({stage:'kept'});run.checkpoint.write('kept',{saved:true});
  assert.throws(()=>run.progress(oversized),{code:'task_metadata_invalid'});
  assert.throws(()=>run.checkpoint.write('oversized',oversized),{code:'task_metadata_invalid'});
  return oversized;
 }})));
 const task=await f.submit(f.alice.token,'generated-large-result',{label:'a'.repeat(40000)}),done=await f.waitTask(f.alice.token,task.id,'failed');
 assert.deepEqual(done.progress,{stage:'kept'});assert.deepEqual(done.checkpoints,['kept']);assert.equal(done.result,undefined);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{const row=db.prepare('SELECT progress,checkpoints,result FROM user_tasks WHERE task_id=?').get(task.id)!;assert.deepEqual(JSON.parse(String(row.checkpoints)),{kept:{saved:true}});assert.equal(row.result,null);}finally{db.close();}
});

test('caught synchronous child admission failure leaves no authority or runnable work when the outer commit succeeds',async t=>{
 let executions=0,caught=false;const f=await fixture(t,node=>{
  node.execution.register(handler({kind:'generated.bad-resource',pool:'generated-child',resources:()=>[{scope:'invalid' as 'user',key:'generated'}],execute:async()=>{executions++;return null;}}));
  node.execution.register(handler({execute:async()=>null,commit:run=>{try{node.execution.forUser(run.context).submitSync({kind:'generated.bad-resource',operationId:'generated-child',input:{label:'Generated child'}});}catch{caught=true;}}}));
 });
 const parent=await f.submit(f.alice.token,'generated-parent');await f.waitTask(f.alice.token,parent.id);for(let i=0;i<5;i++)await f.node.execution.tick();assert.equal(caught,true);assert.equal(executions,0);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{for(const table of ['user_tasks','task_authorizations','execution_steps'])assert.equal(db.prepare('SELECT count(*) n FROM '+table).get()!.n,1);for(const table of ['execution_resources','execution_operation_steps'])assert.equal(db.prepare('SELECT count(*) n FROM '+table+' a LEFT JOIN execution_steps e ON e.id=a.step_id WHERE e.id IS NULL').get()!.n,0);assert.equal(db.prepare("SELECT count(*) n FROM execution_fairness WHERE pool='generated-child'").get()!.n,0);assert.equal(db.prepare('SELECT next FROM execution_user_sequence WHERE user_id=?').get(f.a.userId)!.next,1);assert.equal(db.prepare('SELECT count(*) n FROM operation_progress').get()!.n,1);}finally{db.close();}
});

test('real task and Operations APIs isolate same business identities, control, dependency admission and change subscriptions',async t=>{
 const f=await fixture(t,node=>node.execution.register(handler({execute:async run=>{run.progress({label:run.task.input.label});return {label:run.task.input.label};}})));
 const a=await f.submit(f.alice.token,'same-business-id',{label:'Generated A'}),b=await f.submit(f.bob.token,'same-business-id',{label:'B_PRIVATE_EXECUTION_RESULT'});
 assert.notEqual(a.id,b.id);assert.notEqual(a.operationId,b.operationId);
 await f.waitTask(f.alice.token,a.id);await f.waitTask(f.bob.token,b.id);
 const own=await f.request(f.alice.token,'/api/tasks');assert.equal(own.statusCode,200);assert.deepEqual(own.json().items.map((value:any)=>value.id),[a.id]);assert.equal(own.body.includes('B_PRIVATE_EXECUTION_RESULT'),false);
 for(const method of ['GET','cancel','retry']){
  const read=method==='GET',foreign=await f.request(f.alice.token,'/api/tasks/'+b.id+(read?'':'/'+method),read?'GET':'POST',read?undefined:{}),missing=await f.request(f.alice.token,'/api/tasks/'+'f'.repeat(64)+(read?'':'/'+method),read?'GET':'POST',read?undefined:{});
  assert.equal(foreign.statusCode,404);assert.deepEqual(foreign.json(),missing.json());
 }
 const dependency=await f.request(f.alice.token,'/api/tasks','POST',{kind:'generated.execution',operationId:'cross-user-dependency',input:{label:'Generated rejected child'},dependencies:[b.id]});assert.equal(dependency.statusCode,404);
 const same=await f.submit(f.alice.token,'same-business-id',{label:'Generated A'});assert.equal(same.id,a.id);
 const changedDependencies=await f.request(f.alice.token,'/api/tasks','POST',{kind:'generated.execution',operationId:'same-business-id',input:{label:'Generated A'},dependencies:[a.id]});assert.equal(changedDependencies.statusCode,409);
 assert.equal((await f.request(f.alice.token,'/api/tasks?userId='+f.b.userId)).statusCode,401);
 assert.equal((await f.request(f.alice.token,'/api/tasks','POST',{kind:'generated.execution',operationId:'spoof',input:{label:'Generated'},userId:f.b.userId})).statusCode,401);
 const operations=await f.request(f.alice.token,'/api/operations');assert.equal(operations.statusCode,200);assert.deepEqual(operations.json().items.map((value:any)=>value.id),[a.operationId]);
 const foreignOperation=await f.request(f.alice.token,'/api/operations/'+encodeURIComponent(b.operationId));assert.equal(foreignOperation.statusCode,404);assert.equal(foreignOperation.body.includes('B_PRIVATE_EXECUTION_RESULT'),false);
 const changes=await f.request(f.alice.token,'/api/operations/changes?since=0');assert.equal(changes.statusCode,200);assert.ok(changes.json().ids.includes(a.operationId));assert.ok(!changes.json().ids.includes(b.operationId));
 assert.equal((await f.task(f.bob.token,b.id)).result.label,'B_PRIVATE_EXECUTION_RESULT');
});

test('owner cancellation revokes live checkpoint, progress, result and private publication without affecting B',async t=>{
 const entered=deferred(),held=deferred();let running:TaskRun|undefined,commits=0;
 const f=await fixture(t,node=>node.execution.register(handler({concurrency:()=>2,execute:async run=>{if(run.task.input.label==='cancel-me'){running=run;entered.resolve();await held.promise;}return run.task.input.label;},commit:()=>{commits++;}})));t.after(()=>held.resolve());
 const a=await f.submit(f.alice.token,'cancel-operation',{label:'cancel-me'});await entered.promise;
 const b=await f.submit(f.bob.token,'unrelated-operation',{label:'B survives'});await f.waitTask(f.bob.token,b.id);
 const cancelled=await f.request(f.alice.token,'/api/tasks/'+a.id+'/cancel','POST',{});assert.equal(cancelled.statusCode,200,cancelled.body);assert.equal(cancelled.json().state,'cancelled');
 assert.throws(()=>running!.checkpoint.write('late',{secret:'Generated late checkpoint'}));assert.throws(()=>running!.progress({secret:'Generated late progress'}));assert.throws(()=>running!.grant.commit(()=>{commits++;}));
 held.resolve();await delay(20);assert.equal((await f.task(f.alice.token,a.id)).state,'cancelled');assert.equal((await f.task(f.alice.token,a.id)).result,undefined);assert.equal(commits,1);assert.equal((await f.task(f.bob.token,b.id)).state,'succeeded');
});

test('retained private services lose the exact attempt authority after cancellation, retry and success',async t=>{
 const firstEntered=deferred(),secondEntered=deferred(),firstHeld=deferred(),secondHeld=deferred(),runs:TaskRun[]=[],privateServices:PrivateData[]=[];
 const f=await fixture(t,node=>node.execution.register(handler({execute:async run=>{runs.push(run);privateServices.push(run.services.get<PrivateData>('private-data'));if(runs.length===1){firstEntered.resolve();await firstHeld.promise;}else{secondEntered.resolve();await secondHeld.promise;}return {done:true};}})));t.after(()=>{firstHeld.resolve();secondHeld.resolve();});
 const job=await f.submit(f.alice.token,'attempt-context',{label:'Generated attempt'});await firstEntered.promise;
 const source=(id:string)=>({id,name:'Generated retained service probe',kind:'custom' as const,deviceId:'generated-device',platform:'import' as const});
 assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id+'/cancel','POST',{})).statusCode,200);
 assert.throws(()=>privateServices[0].registerSource(source('after-cancel')),{code:'invalid_identity'});assert.throws(()=>runs[0].services.get('private-data'),{code:'invalid_identity'});
 assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id+'/retry','POST',{})).statusCode,200);await secondEntered.promise;
 assert.notEqual(runs[0].context.credentialId,runs[1].context.credentialId);assert.throws(()=>privateServices[0].registerSource(source('during-new-attempt')),{code:'invalid_identity'});
 runs[1].grant.commit(()=>privateServices[1].registerSource(source('current-attempt')));secondHeld.resolve();await f.waitTask(f.alice.token,job.id);
 assert.throws(()=>privateServices[1].registerSource(source('after-success')),{code:'invalid_identity'});assert.throws(()=>runs[1].services.get('private-data'),{code:'invalid_identity'});
 firstHeld.resolve();await delay(20);const sources=await f.request(f.alice.token,'/api/sources');assert.deepEqual(sources.json().items.map((value:any)=>value.id),['current-attempt']);
});

test('user fairness admits B behind a large backlog of distinct A operations and preserves operation fairness inside A',async t=>{
 const held=deferred(),entered=deferred(),starts:{user:string;operation:string;label:string}[]=[];
 const f=await fixture(t,node=>node.execution.register(handler({execute:async run=>{starts.push({user:run.context.userId,operation:run.task.operationId,label:String(run.task.input.label)});if(starts.length===1){entered.resolve();await held.promise;}return null;}})));
 t.after(()=>held.resolve());
 const first=await f.submit(f.alice.token,'a-first');await entered.promise;
 for(let i=0;i<40;i++)await f.submit(f.alice.token,'a-backlog-'+i);
 const b=await f.submit(f.bob.token,'b-ready');held.resolve();await f.waitTask(f.bob.token,b.id);
 assert.ok(starts.findIndex(value=>value.user===f.b.userId)<=2,JSON.stringify(starts));
 await f.waitTask(f.alice.token,first.id);
 const marker=starts.length,holdAgain=deferred(),firstAgain=deferred();let waitOnce=true;
 const unregister=await f.node.execution.register(handler({kind:'generated.operations',pool:'generated-operations',execute:async run=>{starts.push({user:run.context.userId,operation:run.task.operationId,label:String(run.task.input.label)});if(waitOnce){waitOnce=false;firstAgain.resolve();await holdAgain.promise;}return null;}}));
 t.after(()=>holdAgain.resolve());
 const context=await f.node.authority.authenticate(f.alice.token),service=f.node.execution.forUser(context),ids:string[]=[];
 for(let i=0;i<8;i++)ids.push((await service.submit({kind:'generated.operations',operationId:'same-a-operation',input:{label:'same-'+i}})).id);
 for(let i=0;i<8;i++)ids.push((await service.submit({kind:'generated.operations',operationId:'second-a-operation',input:{label:'second-'+i}})).id);
 void f.node.execution.tick();await firstAgain.promise;holdAgain.resolve();await f.waitTask(f.alice.token,ids.at(-1)!);
 const local=starts.slice(marker).filter(value=>value.label.startsWith('same-')||value.label.startsWith('second-'));
 assert.ok(local.length>=4);assert.notEqual(local[0].operation,local[1].operation);assert.equal(local[0].operation,local[2].operation);await unregister();
});

test('Web logout keeps admitted background checkpoints and private commit alive, while disable and reset reject late publication',async t=>{
 const executions=new Map<string,{entered:ReturnType<typeof deferred>;release:ReturnType<typeof deferred>}>(),commits:string[]=[];
 const f=await fixture(t,node=>node.execution.register(handler({execute:async run=>{const control=executions.get(String(run.task.input.label))!;control.entered.resolve();await control.release.promise;run.checkpoint.write('generated-stage',{done:true});run.progress({done:true});return run.task.input.label;},commit:(run,result)=>{run.services.get<PrivateData>('private-data').registerSource({id:String(result),name:'Generated execution source',kind:'custom',deviceId:'generated',platform:'import'});commits.push(String(result));}})));
 const web=await f.login('generated-a','web'),cookie={...protocol,cookie:String(web.response.headers['set-cookie']).split(';')[0],'x-mote-session-id':web.credentialId,'x-mote-csrf':web.csrfToken};
 const admitted={entered:deferred(),release:deferred()};executions.set('logout-task',admitted);t.after(()=>admitted.release.resolve());
 const submitted=await f.node.app.inject({method:'POST',url:'/api/tasks',headers:cookie,payload:{kind:'generated.execution',operationId:'logout-operation',input:{label:'logout-task'}}});assert.equal(submitted.statusCode,200,submitted.body);await admitted.entered.promise;
 assert.equal((await f.node.app.inject({method:'POST',url:'/api/auth/logout',headers:cookie,payload:{}})).statusCode,200);admitted.release.resolve();const done=await f.waitTask(f.alice.token,submitted.json().id);assert.deepEqual(done.checkpoints,['generated-stage']);assert.equal(done.progress.done,true);assert.ok(commits.includes('logout-task'));
 for(const revoke of ['disable','reset']){
  const control={entered:deferred(),release:deferred()};executions.set(revoke,control);t.after(()=>control.release.resolve());
  const job=await f.submit(f.bob.token,revoke,{label:revoke});await control.entered.promise;
  const response=revoke==='disable'?await f.request(f.admin.token,`/api/admin/accounts/${f.b.userId}`,'PATCH',{disabled:true}):await f.request(f.admin.token,`/api/admin/accounts/${f.b.userId}/password`,'POST',{password});assert.equal(response.statusCode,200,response.body);control.release.resolve();
  await until(()=>['stale','cancelled','failed'].includes(f.node.execution.engine.get(job.id)!.state),'late revoked task did not settle');assert.ok(!commits.includes(revoke));
  if(revoke==='disable'){assert.equal((await f.request(f.admin.token,`/api/admin/accounts/${f.b.userId}`,'PATCH',{disabled:false})).statusCode,200);Object.assign(f.bob,await f.login('generated-b'));}
 }
 const sources=await f.request(f.alice.token,'/api/sources');assert.deepEqual(sources.json().items.map((source:any)=>source.id),['logout-task']);
});

test('unknown external effects survive restart and only their owner can explicitly authorize another attempt',async t=>{
 let calls=0;
 const external=()=>handler({policy:EXECUTION_POLICIES.localProcessing,execute:async run=>{run.external.begin('generated-external-effect');calls++;throw new ExecutionFailure('transient','generated_transport_lost',1);}});
 const f=await fixture(t,node=>node.execution.register(external())),job=await f.submit(f.alice.token,'external-operation');
 await f.waitTask(f.alice.token,job.id,'blocked');assert.equal(calls,1);
 assert.equal((await f.request(f.bob.token,'/api/tasks/'+job.id+'/retry','POST',{confirmUnknown:true})).statusCode,404);
 assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id+'/retry','POST',{})).statusCode,409);
 await f.node.app.close();const restarted=await buildApp({dataDir:f.directory}) as ProductionNode;f.nodes.push(restarted);restarted.execution.register(external());await restarted.app.ready();await restarted.execution.tick();assert.equal(calls,1);
 const r=await restarted.app.inject({method:'POST',url:'/api/tasks/'+job.id+'/retry',headers:headers(f.alice.token),payload:{confirmUnknown:true}});assert.equal(r.statusCode,200,r.body);
 await until(()=>calls===2,'explicit owner confirmation did not enable a new attempt');
});

test('typed failures are bounded and user-owned checkpoint progress is reused without replaying completed work',async t=>{
 let calls=0,completedStages=0;
 const f=await fixture(t,node=>node.execution.register(handler({policy:{timeoutMs:10000,maxAttempts:3,maxRecoveryWindowMs:null},execute:async run=>{calls++;if(!run.checkpoint.read('completed-stage')){completedStages++;run.checkpoint.write('completed-stage',{owner:run.context.userId});}run.progress({attempt:calls});throw new ExecutionFailure('transient','generated_unavailable',1);}})));
 const job=await f.submit(f.alice.token,'bounded-retry');const failed=await f.waitTask(f.alice.token,job.id,'failed');assert.equal(calls,3);assert.equal(completedStages,1);assert.equal(failed.attempts,3);assert.equal(failed.failure.code,'generated_unavailable');assert.equal(failed.failure.category,'transient');assert.deepEqual(failed.checkpoints,['completed-stage']);
 assert.equal((await f.request(f.bob.token,'/api/tasks/'+job.id+'/retry','POST',{})).statusCode,404);await delay(150);assert.equal(calls,3);
});

test('multiple SQLite hosts retain owner, shared pool capacity, and independent per-user resource scope',async t=>{
 const held=deferred(),entered=deferred(),starts:string[]=[];let active=0,maxActive=0;
 const make=(host:string)=>handler({concurrency:()=>2,resources:input=>[{scope:input.resource==='shared'?'shared':'user',key:'same-resource'}],execute:async run=>{active++;maxActive=Math.max(maxActive,active);starts.push(String(run.task.input.label));try{if(run.task.input.label==='held'){entered.resolve();await held.promise;}run.checkpoint.write('host',{host,owner:run.context.userId});return {owner:run.context.userId};}finally{active--;}}});
 const f=await fixture(t,node=>node.execution.register(make('first')));t.after(()=>held.resolve());
 const other=await buildApp({dataDir:f.directory}) as ProductionNode;f.nodes.push(other);other.execution.register(make('second'));await other.app.ready();
 const a=await f.submit(f.alice.token,'held',{label:'held',resource:'user'});await entered.promise;
 const same=await f.submit(f.alice.token,'a-serialized',{label:'a-serialized',resource:'user'}),b=await f.submit(f.bob.token,'b-independent',{label:'b-independent',resource:'user'});await f.waitTask(f.bob.token,b.id);assert.ok(!starts.includes('a-serialized'));assert.ok(starts.includes('b-independent'));assert.ok(maxActive<=2);held.resolve();await f.waitTask(f.alice.token,a.id);await f.waitTask(f.alice.token,same.id);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{const owners=db.prepare('SELECT user_id FROM user_tasks WHERE task_id IN (?,?) ORDER BY user_id').all(a.id,b.id).map(row=>row.user_id);assert.deepEqual(owners,[f.a.userId,f.b.userId].sort());assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);}finally{db.close();}
});

test('host-declared shared resource keys serialize A and B across SQLite hosts while independent resources proceed',async t=>{
 const held=deferred(),entered=deferred(),starts:string[]=[];
 const make=()=>handler({concurrency:()=>3,resources:input=>[{scope:'shared',key:String(input.resource)}],execute:async run=>{starts.push(String(run.task.input.label));if(run.task.input.label==='held'){entered.resolve();await held.promise;}return null;}});
 const f=await fixture(t,node=>node.execution.register(make()));t.after(()=>held.resolve());
 const other=await buildApp({dataDir:f.directory}) as ProductionNode;f.nodes.push(other);other.execution.register(make());await other.app.ready();
 await f.submit(f.alice.token,'shared-held',{label:'held',resource:'shared'});await entered.promise;
 const queued=await f.submit(f.bob.token,'shared-waiting',{label:'same-shared',resource:'shared'}),independent=await f.submit(f.bob.token,'shared-independent',{label:'other-shared',resource:'independent'});
 await f.waitTask(f.bob.token,independent.id);assert.deepEqual(starts,['held','other-shared']);assert.equal((await f.task(f.bob.token,queued.id)).attempts,0);
 held.resolve();await f.waitTask(f.bob.token,queued.id);assert.deepEqual(starts,['held','other-shared','same-shared']);
});

/** A generated host registers a synthetic handler but uses the same production
 * app, real SQLite, credentials and HTTP injection as an installed trusted host.
 * IPC keeps this process-restart acceptance headless and off external services. */
async function processHost(t:TestContext,directory:string,hold:boolean){
 const source=`(async()=>{
  const {buildApp}=await import(${JSON.stringify(new URL('../src/app.ts',import.meta.url).href)});
  const {EXECUTION_POLICIES}=await import(${JSON.stringify(new URL('../src/execution-policy.ts',import.meta.url).href)});
  const node=await buildApp({dataDir:process.env.MOTE_GENERATED_TASK_DIRECTORY});
  node.execution.register({kind:'generated.execution',pool:'generated',concurrency:()=>1,policy:EXECUTION_POLICIES.deterministic,parseInput:input=>input,
   execute:async run=>{
    const prior=run.checkpoint.read('completed-stage');
    if(!prior)run.checkpoint.write('completed-stage',{owner:run.context.userId,count:1});
    process.send({started:true,owner:run.context.userId,reused:Boolean(prior)});
    if(process.env.MOTE_GENERATED_TASK_HOLD==='1')await new Promise(()=>{});
    run.progress({owner:run.context.userId,reused:Boolean(prior)});
    return {owner:run.context.userId,completedStageCount:run.checkpoint.read('completed-stage').count};
   }});
  process.on('message',async message=>{try{
   if(message.close){await node.app.close();process.send({id:message.id,closed:true},()=>process.disconnect());return;}
   const response=await node.app.inject(message.request);process.send({id:message.id,statusCode:response.statusCode,body:response.body});
  }catch(error){process.send({id:message.id,error:String(error)});}});
  await node.app.ready();process.send({ready:true});
 })().catch(error=>{process.send({fatal:String(error)});process.exitCode=1;});`;
 const child=spawn(process.execPath,['--import','tsx','-e',source],{env:{...process.env,MOTE_GENERATED_TASK_DIRECTORY:directory,MOTE_GENERATED_TASK_HOLD:hold?'1':'0'},stdio:['ignore','ignore','pipe','ipc']});
 let serial=0,diagnostic='';const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>(),started:any[]=[];
 const ready=deferred(),exited=deferred();let startupError:Error|undefined;
 child.stderr.on('data',chunk=>{diagnostic+=String(chunk).slice(0,4096);});
 child.on('message',(message:any)=>{if(message.ready)ready.resolve();if(message.fatal){startupError=Error(message.fatal);ready.resolve();}if(message.started)started.push(message);if(message.id){const request=pending.get(message.id);pending.delete(message.id);if(message.error)request?.reject(Error(message.error));else request?.resolve(message);}});
 child.on('exit',()=>{for(const request of pending.values())request.reject(Error('Generated task host exited: '+diagnostic));pending.clear();exited.resolve();ready.resolve();});
 child.on('error',error=>{startupError=error;ready.resolve();});
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await exited.promise;});
 await ready.promise;if(startupError)throw startupError;assert.equal(child.exitCode,null,diagnostic);
 const call=(request:Record<string,unknown>)=>new Promise<any>((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});child.send({id,request});});
 return {child,started,exited:exited.promise,call};
}

test('an actual killed host restores only the persisted owner and completed checkpoint in a replacement process',async t=>{
 const f=await fixture(t);await f.node.app.close();
 const first=await processHost(t,f.directory,true);
 const submission=await first.call({method:'POST',url:'/api/tasks',headers:headers(f.alice.token),payload:{kind:'generated.execution',operationId:'process-recovery',input:{label:'Generated durable work'}}});assert.equal(submission.statusCode,200,submission.body);const task=JSON.parse(submission.body);
 await until(()=>first.started.length===1,'first process did not checkpoint its admitted task');assert.equal(first.started[0].owner,f.a.userId);assert.equal(first.started[0].reused,false);
 first.child.kill('SIGKILL');await first.exited;
 // Deterministically expire the dead process lease in this isolated instance,
 // rather than spending thirty seconds waiting for its normal renewal window.
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{db.prepare('UPDATE execution_steps SET lease_until=0 WHERE id=?').run(task.id);}finally{db.close();}
 const replacement=await processHost(t,f.directory,false);await until(()=>replacement.started.length===1,'replacement process did not restore the task');assert.equal(replacement.started[0].owner,f.a.userId);assert.equal(replacement.started[0].reused,true);
 let result:any;const deadline=Date.now()+8000;
 do{const response=await replacement.call({method:'GET',url:'/api/tasks/'+task.id,headers:headers(f.alice.token)});assert.equal(response.statusCode,200,response.body);result=JSON.parse(response.body);if(result.state==='succeeded')break;assert.ok(Date.now()<deadline,'restored task did not finish');await delay(5);}while(true);
 assert.deepEqual(result.result,{owner:f.a.userId,completedStageCount:1});assert.deepEqual(result.progress,{owner:f.a.userId,reused:true});assert.equal(result.attempts,2);
 const foreign=await replacement.call({method:'GET',url:'/api/tasks/'+task.id,headers:headers(f.bob.token)});assert.equal(foreign.statusCode,404);
 replacement.child.kill('SIGKILL');await replacement.exited;
});
