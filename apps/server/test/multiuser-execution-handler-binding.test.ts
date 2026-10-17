import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../src/app.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import type {TaskExecution,UserTaskHandler} from '../src/scope/task-execution.js';
import type {ModelLease} from '../src/scope/configuration.js';

const password='Generated-handler-binding-password-01';
const key='GENERATED_HANDLER_BINDING_KEY';
const protocol={'x-mote-protocol-version':'2'};
const personal=(model='generated-admitted-model')=>({
 profiles:[{id:'generated-profile',name:'Generated model',settings:{...defaultModelSettings(),provider:'custom',protocol:'openai-completions' as const,baseUrl:'https://generated.invalid/v1',model,apiKey:key}}],
 selections:{chat:{kind:'personal' as const,id:'generated-profile'}},
});
const handler=(patch:Partial<UserTaskHandler>={}):UserTaskHandler=>({
 kind:'generated.binding',pool:'generated-binding',concurrency:()=>1,policy:EXECUTION_POLICIES.deterministic,
 modelFeature:'chat',parseInput:input=>input as Record<string,unknown>,execute:async()=>null,...patch,
});

async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m05-handler-binding-'));
 const node=await buildApp({dataDir:directory});assert.ok(node.execution);const execution=node.execution as TaskExecution;
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-binding-admin',password);
 const login=await node.app.inject({method:'POST',url:'/api/auth/login',headers:protocol,payload:{username:'generated-binding-admin',password,mode:'client'}});
 assert.equal(login.statusCode,200,login.body);const token=login.json().token;
 const request=(url:string,method:'GET'|'POST'|'PUT'='GET',payload?:unknown)=>node.app.inject({method,url,headers:{...protocol,authorization:'Bearer '+token},...(payload===undefined?{}:{payload})});
 const configure=async(model?:string)=>{const view=await request('/api/configuration');assert.equal(view.statusCode,200,view.body);const response=await request('/api/configuration/models','PUT',{revision:view.json().revision,value:personal(model)});assert.equal(response.statusCode,200,response.body);};
 await configure();
 const submit=async()=>{const response=await request('/api/tasks','POST',{kind:'generated.binding',operationId:'generated-handler-binding',input:{}});assert.equal(response.statusCode,200,response.body);return response.json();};
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};
 const snapshots=()=>read(db=>Number(db.prepare('SELECT count(*) n FROM user_model_snapshots').get()!.n));
 const retry=async(taskId:string)=>{const response=await request('/api/tasks/'+taskId+'/retry','POST',{});assert.equal(response.statusCode,200,response.body);};
 return {node,execution,request,configure,submit,snapshots,retry};
}

for(const feature of ['memory',undefined] as const)test(`hot handler registration cannot reuse an admitted chat lease for ${feature??'an unbound feature'}`,async t=>{
 const f=await fixture(t);let calls=0;
 const unregister=f.execution.register(handler({admit:()=>new ExecutionFailure('waiting','generated_capacity',60000)}));
 const job=await f.submit();assert.equal(f.snapshots(),1);
 await unregister();
 f.execution.register(handler({modelFeature:feature,execute:async()=>{calls++;return {unexpected:true};}}));
 await f.retry(job.id);await f.execution.engine.drain([job.id]);
 const response=await f.request('/api/tasks/'+job.id);assert.equal(response.statusCode,200,response.body);
 assert.equal(response.json().state,'blocked');assert.equal(response.json().error,'model_snapshot_unavailable');
 assert.equal(response.json().attempts,0);assert.equal(response.json().result,undefined);assert.equal(calls,0);
 assert.equal(f.snapshots(),1,'re-registration cannot replace the admitted model snapshot');
 assert.equal((await f.request('/api/usage')).json().items.length,0);
});

test('hot registration with the same feature retains the genuine admitted lease object and snapshot',async t=>{
 const f=await fixture(t);let admitted:ModelLease|undefined;
 const unregister=f.execution.register(handler({execute:async run=>{admitted=run.model!.lease;throw new ExecutionFailure('blocked','generated_pause');}}));
 const job=await f.submit();await f.execution.engine.drain([job.id]);
 assert.equal(f.execution.engine.get(job.id)!.state,'blocked');assert.ok(admitted);assert.equal(f.snapshots(),1);
 await f.configure('generated-current-model');await unregister();
 f.execution.register(handler({execute:async run=>{
  assert.equal(run.model!.lease,admitted,'the genuine in-memory capability must remain pinned');
  return run.model!.withModel(async model=>{assert.equal(model.model,'generated-admitted-model');assert.equal(model.apiKey,key);return {snapshotId:run.model!.lease.snapshotId};});
 }}));
 await f.retry(job.id);await f.execution.engine.drain([job.id]);
 const response=await f.request('/api/tasks/'+job.id);assert.equal(response.statusCode,200,response.body);
 assert.equal(response.json().state,'succeeded');assert.deepEqual(response.json().result,{snapshotId:admitted.snapshotId});assert.equal(f.snapshots(),1);
});
