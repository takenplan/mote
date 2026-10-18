import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {buildApp} from '../src/app.js';
import {defaultModelDomain,defaultModelSettings} from '../src/model-settings.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import type {Configurations,UserConfigurationService} from '../src/scope/configuration.js';
import type {TaskExecution,TaskRun,UserTaskHandler} from '../src/scope/task-execution.js';
import type {TaskModelRun} from '../src/scope/task-model.js';
import type {PrivateData} from '../src/scope/private-data.js';

const password='Generated-model-execution-password-01';
const aKey='GENERATED_REAL_M04_A_KEY',bKey='GENERATED_REAL_M04_B_KEY',sharedKey='GENERATED_REAL_M04_SHARED_KEY';
const headers=(token?:string)=>({'x-mote-protocol-version':'2',...(token?{authorization:'Bearer '+token}:{})});
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
type ProductionNode=Awaited<ReturnType<typeof buildApp>>&{execution:TaskExecution;configuration:Configurations};
const handler=(patch:Partial<UserTaskHandler>={}):UserTaskHandler=>({kind:'generated.model',pool:'generated-model',concurrency:()=>2,policy:EXECUTION_POLICIES.deterministic,modelFeature:'chat',parseInput:input=>z.object({label:z.string()}).strict().parse(input),execute:async()=>null,...patch});
async function until(check:()=>boolean,message:string){const deadline=Date.now()+8000;while(!check()){if(Date.now()>=deadline)assert.fail(message);await delay(5);}}
const settings=(key:string,model='generated-original-model',baseUrl='https://generated.invalid/v1')=>({...defaultModelSettings(),provider:'custom',protocol:'openai-completions' as const,baseUrl,model,apiKey:key,headers:{},extraBody:{}});
const profile=(key:string,model?:string,id='same-profile')=>({id,name:'Generated personal model',settings:settings(key,model)});
const personal=(key:string,model?:string)=>({profiles:[profile(key,model)],selections:{chat:{kind:'personal' as const,id:'same-profile'}}});
const price={provider:'custom',model:'generated-original-model',currency:'USD' as const,input:2,output:4,cacheRead:1,cacheWrite:2};
const usage={status:'completed' as const,durationMs:2,tokens:{requests:1,reportedRequests:1,inputTokens:100,outputTokens:10,totalTokens:110,cacheReadTokens:0,cacheWriteTokens:0}};

/** Real M01+M02+M04+M05 production composition. Configuration is always the
 * mounted M04 domain. Provider callbacks only inspect generated settings locally;
 * no test creates a transport, SDK client or external model request. */
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m05-real-model-'));let node=await buildApp({dataDir:directory}) as ProductionNode;const nodes=[node];
 assert.ok(node.execution,'production builder must install M05');assert.ok(node.configuration,'production builder must install real M04');
 const registerOptions=(onApply?:(userId:string)=>Promise<void>)=>node.configuration.registerDomain('fixtureOptions',context=>({id:'fixtureOptions',schema:z.object({label:z.string()}).strict(),defaultValue:{label:'generated-default'},resolve:raw=>raw,fields:[{path:'label',effect:'next-request'}],...(onApply?{prepare:()=>({apply:()=>onApply(context.userId)})}:{})}));registerOptions();
 t.after(async()=>{for(const current of nodes.reverse())await current.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({method,url,headers:headers(token),...(payload===undefined?{}:{payload})});
 const login=async(username:string,mode:'client'|'web'='client')=>{const response=await request(undefined,'/api/auth/login','POST',{username,password,mode,durationMs:86400000});assert.equal(response.statusCode,200,response.body);return {...response.json(),response};};
 const admin=await login('generated-admin');
 const create=async(username:string)=>{const response=await request(admin.token,'/api/admin/accounts','POST',{username,password,administrator:false});assert.equal(response.statusCode,200,response.body);return response.json();};
 const a=await create('generated-a'),b=await create('generated-b'),alice=await login(a.username),bob=await login(b.username);
 const replace=async(token:string,domain:string,value:unknown)=>{const view=await request(token,'/api/configuration');assert.equal(view.statusCode,200,view.body);const response=await request(token,'/api/configuration/'+domain,'PUT',{revision:view.json().revision,value});assert.equal(response.statusCode,200,response.body);for(const key of [aKey,bKey,sharedKey])assert.ok(!response.body.includes(key));return response.json();};
 const publishShared=async(withdraw=false)=>{const view=await request(admin.token,'/api/admin/configuration/models');assert.equal(view.statusCode,200,view.body);const response=await request(admin.token,'/api/admin/configuration/models','PUT',{revision:view.json().revision,value:{...defaultModelDomain(),deployment:settings(sharedKey,withdraw?'':'generated-shared-model')}});assert.equal(response.statusCode,200,response.body);assert.ok(!response.body.includes(sharedKey));};
 await replace(alice.token,'models',personal(aKey));await replace(bob.token,'models',personal(bKey));await replace(alice.token,'modelPrices',{items:[price]});await replace(bob.token,'modelPrices',{items:[price]});
 const service=async(token:string)=>node.services.forUser(await node.authority.authenticate(token)).get<UserConfigurationService>('configuration');
 const submit=async(token:string,operationId:string,label=operationId,kind='generated.model')=>{const response=await request(token,'/api/tasks','POST',{kind,operationId,input:{label}});assert.equal(response.statusCode,200,response.body);return response.json();};
 const wait=async(taskId:string,state:string)=>{const deadline=Date.now()+8000;for(;;){const task=node.execution.engine.get(taskId);if(task?.state===state)return;if(Date.now()>=deadline)assert.fail(`model task ${taskId} did not reach ${state}: ${JSON.stringify(task)}`);await delay(5);}};
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};
 const receipt=(taskId:string)=>read(db=>JSON.parse(String(db.prepare('SELECT model_receipt FROM user_tasks WHERE task_id=?').get(taskId)!.model_receipt)));
 const usageFor=async(token:string)=>{const response=await request(token,'/api/usage');assert.equal(response.statusCode,200,response.body);return response.json();};
 const restart=async(register:(node:ProductionNode)=>void,onApply?:(userId:string)=>Promise<void>)=>{await node.app.close();node=await buildApp({dataDir:directory}) as ProductionNode;nodes.push(node);registerOptions(onApply);register(node);await node.app.ready();return node;};
 return {directory,get node(){return node;},request,login,admin,a,b,alice,bob,replace,publishShared,service,submit,wait,read,receipt,usageFor,restart};
}

test('real M04 task admission pins per-user selection, effective configuration, prices and attributed usage',async t=>{
 const f=await fixture(t),gate=deferred(),runs:TaskRun[]=[],observed:{userId:string;model:string;label:string}[]=[];t.after(()=>gate.resolve());
 await f.replace(f.alice.token,'fixtureOptions',{label:'generated-a-old'});await f.replace(f.bob.token,'fixtureOptions',{label:'generated-b-only'});
 f.node.execution.register(handler({execute:async run=>{runs.push(run);await gate.promise;assert.ok(run.model);const result=await run.model.withModel(async(model,document)=>{assert.equal(model.apiKey,run.context.userId===f.a.userId?aKey:bKey);assert.deepEqual(document.modelPrices,{items:[price]});return {userId:run.context.userId,model:model.model,label:(document.fixtureOptions as {label:string}).label};});observed.push(result);const meter=run.model.startUsage();meter.issued();meter.update(usage.tokens);const first=meter.finish('completed');assert.deepEqual(meter.finish('completed'),first);return result;}}));
 const a=await f.submit(f.alice.token,'same-operation'),b=await f.submit(f.bob.token,'same-operation');await until(()=>runs.length===2,'both real M04 leases must run');
 await f.replace(f.alice.token,'models',personal(aKey,'generated-current-model'));await f.replace(f.alice.token,'modelPrices',{items:[{...price,input:200}]});await f.replace(f.alice.token,'fixtureOptions',{label:'generated-a-current'});gate.resolve();await f.wait(a.id,'succeeded');await f.wait(b.id,'succeeded');
 assert.deepEqual(observed.find(value=>value.userId===f.a.userId),{userId:f.a.userId,model:'generated-original-model',label:'generated-a-old'});assert.equal(observed.find(value=>value.userId===f.b.userId)!.label,'generated-b-only');assert.notEqual(runs[0].model!.lease.operationId,runs[1].model!.lease.operationId);
 for(const [token,job] of [[f.alice.token,a],[f.bob.token,b]] as const){const actual=await f.usageFor(token);assert.equal(actual.items.length,1);assert.equal(actual.items[0].model,'generated-original-model');assert.equal(actual.items[0].attribution.operationId,job.operationId);assert.equal(actual.items[0].estimatedCost,0.00024);assert.deepEqual(actual.items[0].price,price);}
 for(const run of runs){assert.throws(()=>f.node.configuration.assertLease(JSON.parse(JSON.stringify(run.model!.lease))),{code:'invalid_identity'});assert.throws(()=>f.node.configuration.assertLease({...run.model!.lease}),{code:'invalid_identity'});}
 const receipts=f.read(db=>db.prepare('SELECT model_receipt FROM user_tasks').all());for(const key of [aKey,bKey,sharedKey])assert.ok(!JSON.stringify(receipts).includes(key));assert.ok(!JSON.stringify(receipts).includes('generated.invalid'));
 const view=await f.request(f.alice.token,'/api/tasks/'+a.id);assert.ok(!view.body.includes('generated-b-only'));assert.ok(!view.body.includes(aKey));
});

test('a real host restart restores the admitted selection, document, price and usage identity after current settings change',async t=>{
 const f=await fixture(t);await f.replace(f.alice.token,'fixtureOptions',{label:'generated-admitted-options'});let callbacks=0;const seen:TaskRun[]=[];
 f.node.execution.register(handler({admit:()=>new ExecutionFailure('waiting','generated_capacity',60000)}));const job=await f.submit(f.alice.token,'durable-model-task'),admitted=f.receipt(job.id);assert.ok(admitted.snapshotId);
 await f.replace(f.alice.token,'models',{profiles:[profile(aKey),profile('GENERATED_NEW_SELECTION_KEY','generated-new-selection','new-profile')],selections:{chat:{kind:'personal',id:'new-profile'}}});await f.replace(f.alice.token,'modelPrices',{items:[{...price,input:200,output:400}]});await f.replace(f.alice.token,'fixtureOptions',{label:'generated-current-options'});
 const countBefore=f.read(db=>Number(db.prepare('SELECT count(*) n FROM user_model_snapshots WHERE user_id=?').get(f.a.userId)!.n));
 const execute=async(run:TaskRun)=>{seen.push(run);return run.model!.withModel(async(model,document)=>{callbacks++;assert.equal(model.apiKey,aKey);assert.equal(model.model,'generated-original-model');assert.equal(run.model!.lease.reference.id,'same-profile');assert.equal((document.models as any).selections.chat.id,'same-profile');assert.deepEqual(document.fixtureOptions,{label:'generated-admitted-options'});assert.deepEqual(document.modelPrices,{items:[price]});run.model!.recordUsage(usage);return {model:model.model,snapshotId:(run.model!.lease as any).snapshotId};});};
 await f.restart(node=>node.execution.register(handler({execute})));
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{db.prepare('UPDATE execution_steps SET available_at=0 WHERE id=?').run(job.id);}finally{db.close();}await f.node.execution.tick();await f.wait(job.id,'succeeded');
 assert.equal(callbacks,1);assert.equal((seen[0].model!.lease as any).snapshotId,admitted.snapshotId);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM user_model_snapshots WHERE user_id=?').get(f.a.userId)!.n)),countBefore,'recovery must restore the original snapshot, not lease current configuration');
 const actual=await f.usageFor(f.alice.token);assert.equal(actual.items.length,1);assert.notEqual(actual.items[0].id,admitted.snapshotId);assert.equal(actual.items[0].issuance.leaseId,admitted.snapshotId);assert.equal(actual.items[0].estimatedCost,0.00024);assert.equal(actual.items[0].attribution.operationId,job.operationId);
 const restored=await (await f.service(f.alice.token)).restoreLease(admitted.snapshotId,job.operationId);assert.equal(restored.status,'restored');if(restored.status==='restored')assert.deepEqual(f.node.configuration.startUsage(restored.lease,{id:actual.items[0].id}).finish('completed'),actual.items[0]);assert.equal((await f.usageFor(f.alice.token)).items.length,1);assert.equal((await f.usageFor(f.bob.token)).items.length,0);
 for(const suffix of ['','-wal'])if(existsSync(join(f.directory,'mote.sqlite'+suffix))){const bytes=readFileSync(join(f.directory,'mote.sqlite'+suffix));for(const key of [aKey,bKey,'GENERATED_NEW_SELECTION_KEY'])assert.ok(!bytes.includes(Buffer.from(key)));}
});

test('real scoped snapshot recovery rejects another user, an operation mismatch and serialized lease capabilities',async t=>{
 const f=await fixture(t);f.node.execution.register(handler({admit:()=>new ExecutionFailure('waiting','generated_capacity',60000)}));const job=await f.submit(f.alice.token,'restore-owner'),receipt=f.receipt(job.id),a=await f.service(f.alice.token),b=await f.service(f.bob.token);
 assert.deepEqual(await b.restoreLease(receipt.snapshotId,job.operationId),{status:'unavailable',reason:'snapshot_unavailable'});assert.deepEqual(await a.restoreLease(receipt.snapshotId,'generated-wrong-operation'),{status:'unavailable',reason:'operation_mismatch'});
 const valid=await a.restoreLease(receipt.snapshotId,job.operationId);assert.equal(valid.status,'restored');if(valid.status==='restored'){assert.throws(()=>f.node.configuration.assertLease(JSON.parse(JSON.stringify(valid.lease))),{code:'invalid_identity'});assert.throws(()=>f.node.configuration.assertLease({...valid.lease}),{code:'invalid_identity'});}
 const forged=await f.node.authority.authenticate(f.alice.token);assert.throws(()=>f.node.services.forUser({...forged} as any),{code:'invalid_identity'});assert.equal((await f.usageFor(f.bob.token)).items.length,0);
});

for(const revoke of ['cancel','disable'] as const)test(`real ${revoke} during awaited M04 snapshot recovery never exposes a task handler or stale publication`,async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred();let callbacks=0;
 f.node.execution.register(handler({admit:()=>new ExecutionFailure('waiting','generated_capacity',60000)}));const job=await f.submit(f.alice.token,'awaited-recovery-'+revoke),original=f.receipt(job.id);
 try{
  await f.restart(node=>{node.execution.register(handler({execute:async run=>{callbacks++;run.model!.recordUsage(usage);run.services.get<PrivateData>('private-data').registerSource({id:'generated-forbidden-recovery-source',name:'Generated forbidden recovery result',kind:'custom',deviceId:'generated-recovery-device',platform:'import'});return {late:true};}}));const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{db.prepare('UPDATE execution_steps SET available_at=0 WHERE id=?').run(job.id);}finally{db.close();}},async userId=>{if(userId===f.a.userId){entered.resolve();await release.promise;}});
  await entered.promise;assert.equal(f.node.execution.engine.get(job.id)!.state,'running');
  const response=revoke==='cancel'?await f.request(f.alice.token,'/api/tasks/'+job.id+'/cancel','POST',{}):await f.request(f.admin.token,`/api/admin/accounts/${f.a.userId}`,'PATCH',{disabled:true});assert.equal(response.statusCode,200,response.body);release.resolve();await f.wait(job.id,revoke==='cancel'?'cancelled':'stale');
  assert.equal(callbacks,0);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM user_model_usage WHERE user_id=?').get(f.a.userId)!.n)),0);assert.equal(f.read(db=>Number(db.prepare('SELECT count(*) n FROM pd_sources WHERE user_id=?').get(f.a.userId)!.n)),0);assert.equal(f.receipt(job.id).snapshotId,original.snapshotId);
  if(revoke==='cancel'){assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id)).json().result,undefined);}else assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id)).statusCode,401);
 }finally{release.resolve();}
});

for(const withdrawal of ['shared','personal'] as const)test(`real ${withdrawal} model withdrawal rejects in-flight results, usage and retained private service writes`,async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred();let run:TaskRun|undefined,privateData:PrivateData|undefined,commits=0;t.after(()=>release.resolve());
 const source=(id:string)=>({id,name:'Generated model publication',kind:'custom' as const,deviceId:'generated-model-device',platform:'import' as const});
 if(withdrawal==='shared'){await f.publishShared();await f.replace(f.alice.token,'models',{profiles:[],selections:{chat:{kind:'shared',id:'env:deployment'}}});}
 const execute=async(current:TaskRun)=>{run=current;privateData=current.services.get<PrivateData>('private-data');current.grant.commit(()=>privateData!.registerSource(source('generated-before-withdrawal')));return current.model!.withModel(async()=>{entered.resolve();await release.promise;return {late:true};});};
 f.node.execution.register(handler({execute,commit:()=>{commits++;}}));const job=await f.submit(f.alice.token,'withdrawal-'+withdrawal);await entered.promise;const original=f.receipt(job.id);
 if(withdrawal==='shared')await f.publishShared(true);else await f.replace(f.alice.token,'models',personal(''));
 assert.throws(()=>privateData!.registerSource(source('generated-after-withdrawal')),{code:'invalid_identity'});assert.throws(()=>run!.services.get('private-data'),{code:'invalid_identity'});assert.throws(()=>run!.model!.recordUsage(usage));assert.throws(()=>run!.checkpoint.write('late',{}));assert.throws(()=>run!.progress({late:true}));let called=false;await assert.rejects(run!.model!.withModel(async()=>{called=true;return null;}));assert.equal(called,false);
 release.resolve();await f.wait(job.id,'stale');assert.equal(commits,0);assert.equal((await f.usageFor(f.alice.token)).items.length,0);const sources=await f.request(f.alice.token,'/api/sources');assert.deepEqual(sources.json().items.map((value:any)=>value.id),['generated-before-withdrawal']);
 if(withdrawal==='shared')await f.publishShared();else await f.replace(f.alice.token,'models',personal(aKey));await f.restart(node=>node.execution.register(handler({execute,commit:()=>{commits++;}})));
 assert.deepEqual(await (await f.service(f.alice.token)).restoreLease(original.snapshotId,job.operationId),{status:'unavailable',reason:withdrawal==='shared'?'shared_resource_revoked':'credentials_revoked'});
 assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id+'/retry','POST',{})).statusCode,200);await f.wait(job.id,'blocked');assert.equal(f.node.execution.engine.get(job.id)!.attempts,0,'unavailable model hydration must not consume a processing attempt');assert.equal(commits,0);assert.equal((await f.usageFor(f.alice.token)).items.length,0);assert.equal((await f.usageFor(f.bob.token)).items.length,0);
});

test('retained real model wrappers cannot call providers or write usage after cancellation, lease expiry, retry or success',async t=>{
 const f=await fixture(t),runs=new Map<string,TaskRun>(),gates=new Map<string,ReturnType<typeof deferred>>();f.node.execution.register(handler({execute:async run=>{const label=String(run.task.input.label);runs.set(label,run);const gate=gates.get(label);if(gate)await gate.promise;return null;}}));
 const assertRetired=async(model:TaskModelRun)=>{let called=false;await assert.rejects(model.withModel(async()=>{called=true;return null;}));assert.throws(()=>model.recordUsage(usage));assert.equal(called,false);};
 for(const label of ['cancelled','expired']){const gate=deferred();gates.set(label,gate);t.after(()=>gate.resolve());const job=await f.submit(f.alice.token,label);await until(()=>runs.has(label),'held real model run did not start');const old=runs.get(label)!.model!;
  if(label==='expired'){const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{db.prepare('UPDATE execution_steps SET lease_until=0 WHERE id=?').run(job.id);}finally{db.close();}await assertRetired(old);}
  assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id+'/cancel','POST',{})).statusCode,200);await assertRetired(old);gate.resolve();await delay(10);
  if(label==='cancelled'){gates.delete(label);assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id+'/retry','POST',{})).statusCode,200);await f.wait(job.id,'succeeded');await assertRetired(old);assert.notEqual(runs.get(label)!.model,old);await assertRetired(runs.get(label)!.model!);}}
 const done=await f.submit(f.bob.token,'completed');await f.wait(done.id,'succeeded');await assertRetired(runs.get('completed')!.model!);assert.equal((await f.usageFor(f.alice.token)).items.length,0);assert.equal((await f.usageFor(f.bob.token)).items.length,0);
});

test('a real task deadline revokes real M04 and private service capabilities before the durable state settles',async t=>{
 const f=await fixture(t),aborted=deferred(),release=deferred();let abortError:unknown;t.after(()=>release.resolve());
 f.node.execution.register(handler({policy:{timeoutMs:30,maxAttempts:1,maxRecoveryWindowMs:null},execute:async run=>{const privateData=run.services.get<PrivateData>('private-data');run.signal.addEventListener('abort',()=>{try{assert.equal(run.signal.aborted,true);assert.equal(f.node.execution.engine.get(run.task.id)!.state,'running');assert.throws(()=>privateData.registerSource({id:'generated-timeout-late-source',name:'Generated timeout publication',kind:'custom',deviceId:'generated-timeout-device',platform:'import'}),{code:'invalid_identity'});assert.throws(()=>run.services.get('private-data'),{code:'invalid_identity'});assert.throws(()=>run.model!.recordUsage(usage));}catch(error){abortError=error;}finally{aborted.resolve();}},{once:true});await release.promise;return null;}}));
 const job=await f.submit(f.alice.token,'deadline-service-fence');await aborted.promise;if(abortError)throw abortError;release.resolve();await f.wait(job.id,'failed');const sources=await f.request(f.alice.token,'/api/sources');assert.deepEqual(sources.json().items,[]);assert.equal((await f.usageFor(f.alice.token)).items.length,0);
});

test('a missing real snapshot key blocks task recovery without selecting the current model or recreating the key',async t=>{
 const f=await fixture(t);f.node.execution.register(handler({admit:()=>new ExecutionFailure('waiting','generated_capacity',60000)}));const job=await f.submit(f.alice.token,'unavailable-model-task'),original=f.receipt(job.id);await f.replace(f.alice.token,'models',personal(aKey,'generated-current-must-not-replace'));let callbacks=0;
 await f.node.app.close();const key=join(f.directory,'configuration','users',f.a.userId,'snapshot-key');assert.ok(existsSync(key));rmSync(key);await f.restart(node=>node.execution.register(handler({execute:async run=>run.model!.withModel(async()=>{callbacks++;return null;})})));
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{db.prepare('UPDATE execution_steps SET available_at=0 WHERE id=?').run(job.id);}finally{db.close();}await f.node.execution.tick();await f.wait(job.id,'blocked');assert.equal(f.node.execution.engine.get(job.id)!.attempts,0,'missing model snapshot must not consume a processing attempt');assert.equal(callbacks,0);assert.equal(existsSync(key),false);assert.deepEqual(await (await f.service(f.alice.token)).restoreLease(original.snapshotId,job.operationId),{status:'unavailable',reason:'snapshot_unavailable'});
 const blocked=await f.request(f.alice.token,'/api/tasks/'+job.id);assert.equal(blocked.statusCode,200,blocked.body);assert.equal(blocked.json().failure.attempt,0);assert.equal(blocked.json().failure.executionStarted,false);
 assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id+'/retry','POST',{})).statusCode,200);await f.wait(job.id,'blocked');assert.equal(callbacks,0);assert.equal(existsSync(key),false);assert.equal((await f.usageFor(f.alice.token)).items.length,0);
});

test('Web logout preserves real admitted model work while a new account epoch cannot publish or restore the old snapshot',async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred();let captured:TaskRun|undefined;const commits:string[]=[];t.after(()=>release.resolve());
 f.node.execution.register(handler({execute:async run=>{captured=run;entered.resolve();await release.promise;const result=await run.model!.withModel(async model=>({model:model.model}));run.model!.recordUsage(usage);return result;},commit:run=>{commits.push(run.context.userId);}}));
 const web=await f.login(f.a.username,'web'),cookie={...headers(),cookie:String(web.response.headers['set-cookie']).split(';')[0],'x-mote-session-id':web.credentialId,'x-mote-csrf':web.csrfToken};const admitted=await f.node.app.inject({method:'POST',url:'/api/tasks',headers:cookie,payload:{kind:'generated.model',operationId:'web-model',input:{label:'web-model'}}});assert.equal(admitted.statusCode,200,admitted.body);await entered.promise;assert.equal((await f.node.app.inject({method:'POST',url:'/api/auth/logout',headers:cookie,payload:{}})).statusCode,200);release.resolve();await f.wait(admitted.json().id,'succeeded');assert.deepEqual(commits,[f.a.userId]);assert.equal((await f.usageFor(f.alice.token)).items.length,1);
 const resetEntered=deferred(),resetRelease=deferred();t.after(()=>resetRelease.resolve());f.node.execution.register(handler({kind:'generated.reset-model',execute:async run=>{captured=run;resetEntered.resolve();await resetRelease.promise;return run.model!.withModel(async()=>({late:true}));},commit:run=>{commits.push(run.context.userId);}}));const reset=await f.submit(f.bob.token,'reset-model','reset-model','generated.reset-model');await resetEntered.promise;const original=f.receipt(reset.id);
 assert.equal((await f.request(f.admin.token,`/api/admin/accounts/${f.b.userId}/password`,'POST',{password})).statusCode,200);assert.throws(()=>captured!.model!.recordUsage(usage));resetRelease.resolve();await f.wait(reset.id,'stale');assert.deepEqual(commits,[f.a.userId]);const fresh=await f.login(f.b.username);assert.deepEqual(await (await f.service(fresh.token)).restoreLease(original.snapshotId,reset.operationId),{status:'unavailable',reason:'authorization_changed'});assert.equal((await f.usageFor(fresh.token)).items.length,0);
});
