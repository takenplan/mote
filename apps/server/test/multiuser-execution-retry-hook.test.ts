import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {buildApp} from '../src/app.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {TaskAuthorization} from '../src/scope/task-authorization.js';
import {TaskError,type TaskExecution} from '../src/scope/task-execution.js';

const password='Generated-retry-hook-password-01';
const protocol={'x-mote-protocol-version':'2'};
const parentKind='generated.retry-hook-parent',childKind='generated.retry-hook-child';
const parentInput=z.object({label:z.string().min(1)}).strict();
const childInput=z.object({parentId:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
type ProductionNode=Awaited<ReturnType<typeof buildApp>>&{execution:TaskExecution};
type FailureMode='throw'|'thenable'|'retire-grant';
type PublicTask={id:string;operationId:string;state:string;attempts:number;externalState:string;externalUnresolved:number};

// Read the persisted production ledger independently. No test writes manufacture
// a task state, an external issuance, a confirmation or an authorization grant.
function durableState(directory:string,userId:string){
 const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});
 try{return {
  tasks:db.prepare('SELECT * FROM user_tasks WHERE user_id=? ORDER BY task_id').all(userId),
  steps:db.prepare('SELECT * FROM execution_steps WHERE user_id=? ORDER BY id').all(userId),
  grants:db.prepare('SELECT * FROM task_authorizations WHERE user_id=? ORDER BY task_id').all(userId),
  calls:db.prepare('SELECT * FROM task_external_calls WHERE user_id=? ORDER BY issuance_id').all(userId),
  confirmations:db.prepare('SELECT * FROM task_external_retry_confirmations WHERE user_id=? ORDER BY confirmation_id').all(userId),
  failures:db.prepare('SELECT * FROM execution_failures WHERE step_id IN (SELECT task_id FROM user_tasks WHERE user_id=?) ORDER BY step_id').all(userId),
  operations:db.prepare('SELECT * FROM operation_progress WHERE user_id=? ORDER BY id').all(userId),
  changes:db.prepare('SELECT * FROM operation_changes WHERE user_id=? ORDER BY user_seq').all(userId),
  sequences:db.prepare('SELECT * FROM operation_user_sequences WHERE user_id=?').all(userId),
 };}finally{db.close();}
}

async function fixture(t:TestContext,mode:FailureMode){
 const directory=mkdtempSync(join(tmpdir(),'mote-m05-retry-hook-'));
 const node=await buildApp({dataDir:directory}) as ProductionNode;
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 assert.ok(node.execution,'production composition must install the task host');
 const db=node.execution.engine.store.db;
 // Use the real authorization implementation on the host's same SQLite
 // connection, so retirement participates in the surrounding retry transaction.
 const grants=new TaskAuthorization(db,node.accounts!,node.deploymentId);
 const executions=new Map<string,number>();
 let hookCalls=0,thenableAssimilations=0;
 const prepared:{taskId:string;parentId:string;userId:string;grantId:string}[]=[];
 const count=(owner:string,kind:string)=>executions.set(owner+':'+kind,(executions.get(owner+':'+kind)??0)+1);
 node.execution.register({
  kind:parentKind,pool:'generated-retry-hook-parent',concurrency:()=>2,policy:EXECUTION_POLICIES.deterministic,
  parseInput:input=>parentInput.parse(input),
  execute:async run=>{count(run.context.userId,parentKind);throw new ExecutionFailure('blocked','generated_parent_blocked');},
 });
 node.execution.register({
  kind:childKind,pool:'generated-retry-hook-child',concurrency:()=>2,policy:EXECUTION_POLICIES.deterministic,
  parseInput:input=>childInput.parse(input),
  authorizeInput:(context,input)=>{assert.equal(node.execution.forUser(context).get(String(input.parentId)).kind,parentKind);},
  execute:async run=>{
   count(run.context.userId,childKind);
   // Generated external-I/O fixture: the real issuance entry is durable, but no
   // provider or network receives a request and no outcome is declared settled.
   run.external.begin('generated-retry-hook-request');
   throw new ExecutionFailure('blocked','generated_external_result_unknown');
  },
  prepareRetry:(context,step)=>{
   hookCalls++;
   assert.equal(db.isTransaction,true,'trusted preparation must share the retry transaction');
   assert.equal(step.ownership?.userId,context.userId);
   assert.equal(step.ownership?.authorizationEpoch,context.authorizationEpoch);
   const row=db.prepare('SELECT external_state,external_issuance,grant_id FROM user_tasks WHERE task_id=? AND user_id=?').get(step.id,context.userId)!;
   assert.equal(row.external_state,'none','owner confirmation precedes trusted preparation');
   assert.equal(row.external_issuance,null);
   assert.equal(row.grant_id,step.ownership?.grantId);
   const calls=db.prepare('SELECT issuance_id,state FROM task_external_calls WHERE task_id=? AND user_id=?').all(step.id,context.userId);
   assert.equal(calls.length,1);assert.equal(calls[0].state,'unknown');
   const confirmations=db.prepare('SELECT issuance_id,user_id,authorization_epoch FROM task_external_retry_confirmations WHERE issuance_id=?').all(calls[0].issuance_id);
   assert.equal(confirmations.length,1);
   assert.equal(confirmations[0].user_id,context.userId);
   assert.equal(confirmations[0].authorization_epoch,context.authorizationEpoch);
   const parentId=String(step.input.parentId),service=node.execution.forUser(context);
   assert.equal(service.get(parentId).state,'blocked');
   const parent=service.retry(parentId);
   assert.equal(parent.state,'waiting');assert.equal(parent.attempts,0);
   assert.equal(db.isTransaction,true,'nested retry must release its savepoint, not commit the outer transaction');
   prepared.push({taskId:step.id,parentId,userId:context.userId,grantId:String(row.grant_id)});
   if(mode==='throw')throw new TaskError('generated_retry_preparation_failed',409);
   if(mode==='thenable')return {then:(_resolve:(value:unknown)=>void,reject:(reason:unknown)=>void)=>{thenableAssimilations++;reject(new Error('Generated asynchronous preparation failure'));}};
   grants.revoke(step.id);
   assert.throws(()=>grants.assert(String(row.grant_id),context.userId,context.authorizationEpoch),{code:'invalid_identity'});
   // The hook returns normally. Only M05's post-hook task assertion can reject
   // the retired original grant and roll back this otherwise valid preparation.
  },
 });
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:'GET'|'POST'='GET',payload?:unknown)=>node.app.inject({
  method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload}),
 });
 const login=async(username:string)=>{const response=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client',durationMs:86400000});assert.equal(response.statusCode,200,response.body);return response.json() as {token:string};};
 const admin=await login('generated-admin');
 const account=async(username:string)=>{
  const response=await request(admin.token,'/api/admin/accounts','POST',{username,password,administrator:false});
  assert.equal(response.statusCode,200,response.body);const created=response.json() as {userId:string;username:string};
  return {...created,...await login(created.username)};
 };
 const a=await account('generated-a'),b=await account('generated-b');
 const submit=async(token:string,kind:string,operationId:string,input:Record<string,unknown>)=>{
  const response=await request(token,'/api/tasks','POST',{kind,operationId,input});assert.equal(response.statusCode,200,response.body);return response.json() as PublicTask;
 };
 const task=async(token:string,id:string)=>{const response=await request(token,'/api/tasks/'+id);assert.equal(response.statusCode,200,response.body);return response.json() as PublicTask;};
 const waitBlocked=async(token:string,id:string)=>{
  const deadline=Date.now()+8000;
  for(;;){const current=await task(token,id);if(current.state==='blocked'&&!node.execution.engine.isActiveStep(id))return current;assert.ok(Date.now()<deadline,`generated task did not become durably blocked: ${JSON.stringify(current)}`);await delay(5);}
 };
 const pair=async(token:string)=>{
  const parent=await submit(token,parentKind,'generated-shared-parent',{label:'Generated blocked prerequisite'});await waitBlocked(token,parent.id);
  const child=await submit(token,childKind,'generated-shared-child',{parentId:parent.id});await waitBlocked(token,child.id);
  return {parent,child};
 };
 const alice=await pair(a.token),bob=await pair(b.token);
 return {directory,node,grants,request,task,a,b,alice,bob,executions,prepared,hookCalls:()=>hookCalls,thenableAssimilations:()=>thenableAssimilations};
}

for(const scenario of [
 {mode:'throw',status:409,error:'generated_retry_preparation_failed',name:'a throwing hook'},
 {mode:'thenable',status:409,error:'asynchronous_task_retry',name:'a rejected thenable hook'},
 {mode:'retire-grant',status:401,error:'invalid_identity',name:'post-hook retirement of the original task grant'},
] as const){
 test(`real retry rolls back unknown confirmation and nested parent retry after ${scenario.name}`,async t=>{
  const f=await fixture(t,scenario.mode);
  assert.notEqual(f.alice.parent.id,f.bob.parent.id);assert.notEqual(f.alice.child.id,f.bob.child.id);
  const originalA=durableState(f.directory,f.a.userId),originalB=durableState(f.directory,f.b.userId);
  assert.equal(originalA.calls.length,1);assert.equal(originalA.calls[0].state,'issued');assert.equal(originalA.confirmations.length,0);
  assert.equal(originalA.grants.length,2);assert.ok(originalA.grants.every(grant=>grant.revoked===0));
  const initialChild=await f.task(f.a.token,f.alice.child.id);
  assert.equal(initialChild.state,'blocked');assert.equal(initialChild.externalState,'issued');assert.equal(initialChild.externalUnresolved,1);assert.equal(initialChild.attempts,1);
  const route='/api/tasks/'+f.alice.child.id+'/retry';
  const anonymous=await f.request(undefined,route,'POST',{confirmUnknown:true});assert.equal(anonymous.statusCode,401);
  const foreign=await f.request(f.b.token,route,'POST',{confirmUnknown:true});
  const missing=await f.request(f.b.token,'/api/tasks/'+'f'.repeat(64)+'/retry','POST',{confirmUnknown:true});
  assert.equal(foreign.statusCode,404);assert.deepEqual(foreign.json(),missing.json());
  const unconfirmed=await f.request(f.a.token,route,'POST',{});assert.equal(unconfirmed.statusCode,409);assert.equal(unconfirmed.json().error,'external_result_unknown');
  const jsonHook=await f.request(f.a.token,route,'POST',{confirmUnknown:true,prepareRetry:{parentId:f.bob.parent.id}});
  assert.equal(jsonHook.statusCode,400);assert.equal(jsonHook.json().error,'invalid_request');
  assert.equal(f.hookCalls(),0,'authentication, owner, consent and JSON validation must precede the host hook');
  assert.deepEqual(durableState(f.directory,f.a.userId),originalA);
  assert.deepEqual(durableState(f.directory,f.b.userId),originalB);

  const response=await f.request(f.a.token,route,'POST',{confirmUnknown:true});
  assert.equal(response.statusCode,scenario.status,response.body);assert.equal(response.json().error,scenario.error);
  assert.equal(f.hookCalls(),1);assert.deepEqual(f.prepared,[{taskId:f.alice.child.id,parentId:f.alice.parent.id,userId:f.a.userId,grantId:String(originalA.grants.find(grant=>grant.task_id===f.alice.child.id)!.grant_id)}]);
  await delay(0);assert.equal(f.thenableAssimilations(),scenario.mode==='thenable'?1:0);
  assert.equal(f.node.execution.engine.store.db.isTransaction,false,'failed retry must leave no transaction or savepoint open');
  assert.deepEqual(durableState(f.directory,f.a.userId),originalA,'confirmation, journal, parent retry, grant and Operations changes must all roll back');
  assert.deepEqual(durableState(f.directory,f.b.userId),originalB,'A preparation must not modify B');
  assert.deepEqual(await f.task(f.a.token,f.alice.child.id),initialChild);
  assert.equal((await f.task(f.a.token,f.alice.parent.id)).state,'blocked');
  for(const grant of originalA.grants)assert.equal(f.grants.assert(String(grant.grant_id),f.a.userId,Number(grant.authorization_epoch)).revoked,0);
  for(const owner of [f.a.userId,f.b.userId])for(const kind of [parentKind,childKind])assert.equal(f.executions.get(owner+':'+kind),1,'failed preparation must not execute parent or child again');
  // The failed transaction cannot consume owner consent: an ordinary retry
  // still reports the original unresolved issuance and never re-enters the hook.
  const stillUnconfirmed=await f.request(f.a.token,route,'POST',{});
  assert.equal(stillUnconfirmed.statusCode,409);assert.equal(stillUnconfirmed.json().error,'external_result_unknown');assert.equal(f.hookCalls(),1);
  assert.deepEqual(durableState(f.directory,f.a.userId),originalA);
 });
}
