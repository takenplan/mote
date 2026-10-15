import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import type {ModelFeature,ModelSettings} from '@mote/shared/models';
import type {ConfigDocument} from '@mote/shared/config-file';
import {buildApp} from '../src/app.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import {ScopeError} from '../src/scope/baseline.js';
import type {UserContext} from '../src/scope/context.js';
import type {TaskExecution,TaskRun,UserTaskHandler} from '../src/scope/task-execution.js';
import type {TaskModelHost,TaskModelLease,TaskModelRun,TaskModelUsage} from '../src/scope/task-model.js';
import type {PrivateData} from '../src/scope/private-data.js';

const password='Generated-model-execution-password-01';
const headers=(token?:string)=>({'x-mote-protocol-version':'2',...(token?{authorization:'Bearer '+token}:{})});
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
type ProductionNode=Awaited<ReturnType<typeof buildApp>>&{execution:TaskExecution};
const handler=(patch:Partial<UserTaskHandler>={}):UserTaskHandler=>({kind:'generated.model',pool:'generated-model',concurrency:()=>2,policy:EXECUTION_POLICIES.deterministic,modelFeature:'chat',parseInput:input=>z.object({label:z.string()}).strict().parse(input),execute:async()=>null,...patch});
async function until(check:()=>boolean,message:string){const deadline=Date.now()+8000;while(!check()){if(Date.now()>=deadline)assert.fail(message);await delay(5);}}
const settings=(model:string):ModelSettings=>({provider:'generated-provider',protocol:'openai-completions',baseUrl:'https://generated.invalid/v1',model,reasoningEffort:'off',maxTokens:8192,modelRequestTimeoutMs:1000,agentTimeoutMs:null,allowUnauthenticatedLocal:false,apiKey:'GENERATED_SYNTHETIC_SECRET',headers:{},extraBody:{}});
type Snapshot={revision:number;kind:'personal'|'shared';model:string};
type PrivateLease={context:UserContext;snapshot:Snapshot;settings:ModelSettings;configuration:ConfigDocument;sharedGeneration:number};

/** Host-registered synthetic M04 protocol, without M04's unpublished code or
 * a live provider. WeakMap provenance deliberately cannot survive JSON/restart.
 * Real Accounts supplies the epoch fence, independent of the admitting session. */
class SyntheticConfigurations implements TaskModelHost {
 private readonly leases=new WeakMap<TaskModelLease,PrivateLease>();
 private readonly snapshots=new Map<string,Snapshot>();
 private sharedGeneration=0;
 readonly issued:TaskModelLease[]=[];
 readonly usage=new Map<string,{userId:string;operationId:string;model:string;input:TaskModelUsage}>();
 modelCalls=0;
 constructor(private readonly node:ProductionNode){
  node.services.registerUser('configuration',{scope:'user',create:context=>({lease:(feature:ModelFeature,operationId:string)=>this.lease(context,feature,operationId)}),lifecycle:{exportUser:async()=>{throw new ScopeError('scope_unavailable',503);},deleteUser:async()=>{throw new ScopeError('scope_unavailable',503);},restoreUser:async()=>{throw new ScopeError('scope_unavailable',503);}}});
  node.execution.bindConfiguration(this);
 }
 configure(context:UserContext,model:string,kind:'personal'|'shared'='personal'){
  this.node.authority.assert(context);const previous=this.snapshots.get(context.userId);this.snapshots.set(context.userId,{revision:(previous?.revision??0)+1,kind,model});
 }
 withdrawShared(){this.sharedGeneration++;}
 private async lease(context:UserContext,feature:ModelFeature,operationId:string){
  this.node.authority.assert(context);const snapshot=structuredClone(this.snapshots.get(context.userId)??{revision:0,kind:'personal',model:'generated-default'});
  const lease=Object.freeze({id:randomUUID(),deploymentId:context.deploymentId,userId:context.userId,operationId,feature,revision:snapshot.revision,instanceRevision:0,reference:Object.freeze({kind:snapshot.kind,id:'generated-reference'}),provider:'generated-provider',model:snapshot.model});
  this.leases.set(lease,{context,snapshot,settings:settings(snapshot.model),configuration:{version:1,revision:snapshot.revision},sharedGeneration:this.sharedGeneration});this.issued.push(lease);return lease;
 }
 assertLease(lease:TaskModelLease){
  const value=this.leases.get(lease);if(!value)throw new ScopeError('invalid_identity',401);
  this.node.accounts!.assertAccountEnabled(value.context.userId,value.context.authorizationEpoch);
  if(value.snapshot.kind==='shared'&&value.sharedGeneration!==this.sharedGeneration)throw new ScopeError('invalid_identity',401);
  return value;
 }
 async withModel<T>(lease:TaskModelLease,work:(settings:Readonly<ModelSettings>,configuration:Readonly<ConfigDocument>)=>Promise<T>){
  const value=this.assertLease(lease);this.modelCalls++;const result=await work(structuredClone(value.settings),structuredClone(value.configuration));this.assertLease(lease);return result;
 }
 recordUsage(lease:TaskModelLease,input:TaskModelUsage){
  this.assertLease(lease);const key=lease.userId+':'+lease.id;if(!this.usage.has(key))this.usage.set(key,{userId:lease.userId,operationId:lease.operationId,model:lease.model,input:structuredClone(input)});return this.usage.get(key);
 }
}

async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m05-model-')),nodes:ProductionNode[]=[];
 const node=await buildApp({dataDir:directory}) as ProductionNode;nodes.push(node);assert.ok(node.execution,'production builder must install M05');const configuration=new SyntheticConfigurations(node);
 t.after(async()=>{for(const current of nodes.reverse())await current.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({method,url,headers:headers(token),...(payload===undefined?{}:{payload})});
 const login=async(username:string,mode:'client'|'web'='client')=>{const response=await request(undefined,'/api/auth/login','POST',{username,password,mode,durationMs:86400000});assert.equal(response.statusCode,200,response.body);return {...response.json(),response};};
 const admin=await login('generated-admin');
 const create=async(username:string)=>{const response=await request(admin.token,'/api/admin/accounts','POST',{username,password,administrator:false});assert.equal(response.statusCode,200,response.body);return response.json();};
 const a=await create('generated-a'),b=await create('generated-b'),alice=await login(a.username),bob=await login(b.username),aContext=await node.authority.authenticate(alice.token),bContext=await node.authority.authenticate(bob.token);
 const submit=async(token:string,operationId:string,label=operationId)=>{const response=await request(token,'/api/tasks','POST',{kind:'generated.model',operationId,input:{label}});assert.equal(response.statusCode,200,response.body);return response.json();};
 const wait=async(taskId:string,state:string)=>{const deadline=Date.now()+8000;for(;;){const task=node.execution.engine.get(taskId);if(task?.state===state)return;if(Date.now()>=deadline)assert.fail(`model task ${taskId} did not reach ${state}: ${JSON.stringify(task)}`);await delay(5);}};
 return {directory,node,nodes,configuration,request,login,admin,a,b,alice,bob,aContext,bContext,submit,wait};
}

test('production task admission pins genuine per-user M04 leases and fixed configuration snapshots',async t=>{
 const f=await fixture(t),gate=deferred(),runs:TaskRun[]=[],observed:{userId:string;model:string;revision:number}[]=[];t.after(()=>gate.resolve());
 f.configuration.configure(f.aContext,'generated-a-old');f.configuration.configure(f.bContext,'generated-b-only');
 f.node.execution.register(handler({execute:async run=>{runs.push(run);await gate.promise;assert.ok(run.model);const result=await run.model.withModel(async(settings,document)=>({userId:run.context.userId,model:settings.model,revision:document.revision}));observed.push(result);run.model.recordUsage({status:'completed',durationMs:2});return result;}}));
 const a=await f.submit(f.alice.token,'same-operation'),b=await f.submit(f.bob.token,'same-operation');await until(()=>runs.length===2,'both admitted users must run');
 f.configuration.configure(f.aContext,'generated-a-new');gate.resolve();await f.wait(a.id,'succeeded');await f.wait(b.id,'succeeded');
 assert.deepEqual(observed.find(value=>value.userId===f.a.userId),{userId:f.a.userId,model:'generated-a-old',revision:1});assert.equal(observed.find(value=>value.userId===f.b.userId)!.model,'generated-b-only');
 assert.equal(f.configuration.issued.length,2);assert.equal(f.configuration.modelCalls,2);assert.equal(f.configuration.usage.size,2);assert.notEqual(runs[0].model!.lease.operationId,runs[1].model!.lease.operationId);
 for(const run of runs){assert.throws(()=>f.configuration.assertLease(JSON.parse(JSON.stringify(run.model!.lease))),{code:'invalid_identity'});assert.throws(()=>f.configuration.assertLease({...run.model!.lease}),{code:'invalid_identity'});}
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{const receipts=db.prepare('SELECT model_receipt FROM user_tasks').all();assert.equal(receipts.length,2);assert.ok(!JSON.stringify(receipts).includes('GENERATED_SYNTHETIC_SECRET'));assert.ok(!JSON.stringify(receipts).includes('generated.invalid'));}finally{db.close();}
 const view=await f.request(f.alice.token,'/api/tasks/'+a.id);assert.ok(!view.body.includes('generated-b-only'));assert.ok(!view.body.includes('GENERATED_SYNTHETIC_SECRET'));
});

test('shared model withdrawal fences in-flight result, usage and all late task publication',async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred();let run:TaskRun|undefined,privateData:PrivateData|undefined,commits=0;t.after(()=>release.resolve());
 const source=(id:string)=>({id,name:'Generated model publication',kind:'custom' as const,deviceId:'generated-model-device',platform:'import' as const});
 f.configuration.configure(f.aContext,'generated-shared','shared');
 f.node.execution.register(handler({execute:async current=>{run=current;privateData=current.services.get<PrivateData>('private-data');current.grant.commit(()=>privateData!.registerSource(source('generated-before-withdrawal')));return current.model!.withModel(async()=>{entered.resolve();await release.promise;return {secret:'generated-late-result'};});},commit:()=>{commits++;}}));
 const job=await f.submit(f.alice.token,'shared-withdrawal');await entered.promise;f.configuration.withdrawShared();
 assert.throws(()=>privateData!.registerSource(source('generated-after-withdrawal')),{code:'invalid_identity'});assert.throws(()=>run!.services.get('private-data'),{code:'invalid_identity'});
 assert.throws(()=>run!.model!.recordUsage({status:'completed',durationMs:1}));assert.throws(()=>run!.checkpoint.write('late',{}));assert.throws(()=>run!.progress({late:true}));let called=false;await assert.rejects(run!.model!.withModel(async()=>{called=true;return null;}));assert.equal(called,false);
 release.resolve();await f.wait(job.id,'stale');assert.equal(commits,0);assert.equal(f.configuration.usage.size,0);const response=await f.request(f.alice.token,'/api/tasks/'+job.id);assert.equal(response.json().result,undefined);
 const sources=await f.request(f.alice.token,'/api/sources');assert.deepEqual(sources.json().items.map((value:any)=>value.id),['generated-before-withdrawal']);
 assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id+'/retry','POST',{})).statusCode,200);await f.wait(job.id,'blocked');assert.equal(f.node.execution.engine.get(job.id)!.error,'model_authority_revoked');assert.equal(f.configuration.issued.length,1);assert.equal(f.configuration.modelCalls,1);
});

test('retained model wrappers cannot call models or write usage after cancel, lease expiry, retry or success',async t=>{
 const f=await fixture(t),runs=new Map<string,TaskRun>(),gates=new Map<string,ReturnType<typeof deferred>>();
 f.node.execution.register(handler({execute:async run=>{const label=String(run.task.input.label);runs.set(label,run);const gate=gates.get(label);if(gate)await gate.promise;return null;}}));
 const assertRetired=async(model:TaskModelRun)=>{let called=false;const previousCalls=f.configuration.modelCalls,previousUsage=f.configuration.usage.size;await assert.rejects(model.withModel(async()=>{called=true;return null;}));assert.throws(()=>model.recordUsage({status:'completed',durationMs:1}));assert.equal(called,false);assert.equal(f.configuration.modelCalls,previousCalls);assert.equal(f.configuration.usage.size,previousUsage);};
 for(const label of ['cancelled','expired']){
  const gate=deferred();gates.set(label,gate);t.after(()=>gate.resolve());const job=await f.submit(f.alice.token,label);await until(()=>runs.has(label),'held model run did not start');const old=runs.get(label)!.model!;
  if(label==='expired'){const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{db.prepare('UPDATE execution_steps SET lease_until=0 WHERE id=?').run(job.id);}finally{db.close();}await assertRetired(old);}
  assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id+'/cancel','POST',{})).statusCode,200);await assertRetired(old);gate.resolve();await delay(10);
  if(label==='cancelled'){gates.delete(label);assert.equal((await f.request(f.alice.token,'/api/tasks/'+job.id+'/retry','POST',{})).statusCode,200);await f.wait(job.id,'succeeded');await assertRetired(old);assert.notEqual(runs.get(label)!.model,old);await assertRetired(runs.get(label)!.model!);}
 }
 const done=await f.submit(f.bob.token,'completed');await f.wait(done.id,'succeeded');await assertRetired(runs.get('completed')!.model!);
});

test('a real task deadline revokes retained private services synchronously before the durable running state settles',async t=>{
 const f=await fixture(t),aborted=deferred(),release=deferred();let abortError:unknown;t.after(()=>release.resolve());
 f.node.execution.register(handler({policy:{timeoutMs:30,maxAttempts:1,maxRecoveryWindowMs:null},execute:async run=>{
  const privateData=run.services.get<PrivateData>('private-data');
  run.signal.addEventListener('abort',()=>{try{
   assert.equal(run.signal.aborted,true);assert.equal(f.node.execution.engine.get(run.task.id)!.state,'running','the signal callback must precede durable state settlement');
   assert.throws(()=>privateData.registerSource({id:'generated-timeout-late-source',name:'Generated timeout publication',kind:'custom',deviceId:'generated-timeout-device',platform:'import'}),{code:'invalid_identity'});
   assert.throws(()=>run.services.get('private-data'),{code:'invalid_identity'});
  }catch(error){abortError=error;}finally{aborted.resolve();}},{once:true});
  await release.promise;return null;
 }}));
 const job=await f.submit(f.alice.token,'deadline-service-fence');await aborted.promise;if(abortError)throw abortError;release.resolve();await f.wait(job.id,'failed');
 const sources=await f.request(f.alice.token,'/api/sources');assert.deepEqual(sources.json().items,[]);
});

test('process-host reopen blocks model tasks lacking the genuine snapshot and never leases current settings',async t=>{
 const f=await fixture(t);f.configuration.configure(f.aContext,'generated-original-snapshot');
 f.node.execution.register(handler({admit:()=>new ExecutionFailure('waiting','generated_capacity',60000)}));
 const job=await f.submit(f.alice.token,'restart-model');assert.equal(f.configuration.issued.length,1);await f.node.app.close();
 const restarted=await buildApp({dataDir:f.directory}) as ProductionNode;f.nodes.push(restarted);const configuration=new SyntheticConfigurations(restarted);configuration.configure(await restarted.authority.authenticate(f.alice.token),'generated-current-must-not-replace');let executions=0;restarted.execution.register(handler({execute:async()=>{executions++;return null;}}));
 // A capacity wait's due time survives restart. Make only scheduling eligible;
 // no model object or authorization field is reconstructed from the receipt.
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{db.prepare('UPDATE execution_steps SET available_at=0 WHERE id=?').run(job.id);}finally{db.close();}
 await restarted.app.ready();await restarted.execution.tick();await until(()=>restarted.execution.engine.get(job.id)?.state==='blocked','missing model snapshot must block');assert.equal(restarted.execution.engine.get(job.id)!.error,'model_snapshot_unavailable');assert.equal(executions,0);assert.equal(configuration.issued.length,0);
 const duplicate=await restarted.app.inject({method:'POST',url:'/api/tasks',headers:headers(f.alice.token),payload:{kind:'generated.model',operationId:'restart-model',input:{label:'restart-model'}}});assert.equal(duplicate.statusCode,200,duplicate.body);assert.equal(duplicate.json().id,job.id);assert.equal(configuration.issued.length,0);
 const retry=await restarted.app.inject({method:'POST',url:'/api/tasks/'+job.id+'/retry',headers:headers(f.alice.token),payload:{}});assert.equal(retry.statusCode,200,retry.body);await restarted.execution.tick();assert.equal(restarted.execution.engine.get(job.id)!.error,'model_snapshot_unavailable');assert.equal(configuration.modelCalls,0);assert.equal(configuration.usage.size,0);
 const dbRead=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{const receipt=JSON.parse(String(dbRead.prepare('SELECT model_receipt FROM user_tasks WHERE task_id=?').get(job.id)!.model_receipt));assert.throws(()=>configuration.assertLease(receipt),{code:'invalid_identity'});}finally{dbRead.close();}
});

test('Web logout preserves admitted model work while account epoch reset rejects late usage and result',async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred();let captured:TaskRun|undefined;const commits:string[]=[];t.after(()=>release.resolve());
 f.node.execution.register(handler({execute:async run=>{captured=run;entered.resolve();await release.promise;const result=await run.model!.withModel(async settings=>({model:settings.model}));run.model!.recordUsage({status:'completed',durationMs:1});return result;},commit:run=>{commits.push(run.context.userId);}}));
 const web=await f.login(f.a.username,'web'),cookie={...headers(),cookie:String(web.response.headers['set-cookie']).split(';')[0],'x-mote-session-id':web.credentialId,'x-mote-csrf':web.csrfToken};
 const admitted=await f.node.app.inject({method:'POST',url:'/api/tasks',headers:cookie,payload:{kind:'generated.model',operationId:'web-model',input:{label:'web-model'}}});assert.equal(admitted.statusCode,200,admitted.body);await entered.promise;
 assert.equal((await f.node.app.inject({method:'POST',url:'/api/auth/logout',headers:cookie,payload:{}})).statusCode,200);release.resolve();await f.wait(admitted.json().id,'succeeded');assert.deepEqual(commits,[f.a.userId]);assert.equal(f.configuration.usage.size,1);
 const resetEntered=deferred(),resetRelease=deferred();t.after(()=>resetRelease.resolve());f.node.execution.register(handler({kind:'generated.reset-model',execute:async run=>{captured=run;resetEntered.resolve();await resetRelease.promise;return run.model!.withModel(async()=>({late:true}));},commit:run=>{commits.push(run.context.userId);}}));
 const reset=await f.request(f.bob.token,'/api/tasks','POST',{kind:'generated.reset-model',operationId:'reset-model',input:{label:'reset-model'}});assert.equal(reset.statusCode,200,reset.body);await resetEntered.promise;
 assert.equal((await f.request(f.admin.token,`/api/admin/accounts/${f.b.userId}/password`,'POST',{password})).statusCode,200);assert.throws(()=>captured!.model!.recordUsage({status:'completed',durationMs:1}));resetRelease.resolve();await f.wait(reset.json().id,'stale');assert.deepEqual(commits,[f.a.userId]);assert.equal(f.configuration.usage.size,1);
});
