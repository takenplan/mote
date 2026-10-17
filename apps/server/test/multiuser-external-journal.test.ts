import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {buildApp} from '../src/app.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {openScopeStorage} from '../src/scope/storage.js';
import {LifecycleAuthority,type LifecyclePurpose} from '../src/scope/lifecycle.js';
import type {TaskExecution,TaskRun,UserTaskHandler} from '../src/scope/task-execution.js';

const password='Generated-external-journal-password-01';
const headers=(token?:string)=>({'x-mote-protocol-version':'2',...(token?{authorization:'Bearer '+token}:{})});
type ProductionNode=Awaited<ReturnType<typeof buildApp>>&{execution:TaskExecution};
const handler=(execute:(run:TaskRun)=>Promise<unknown>):UserTaskHandler=>({kind:'generated.external-journal',pool:'generated-external-journal',concurrency:()=>2,policy:EXECUTION_POLICIES.deterministic,parseInput:input=>z.object({label:z.string()}).strict().parse(input),execute});
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m05-external-journal-')),storage=openScopeStorage(directory),deploymentId=storage.deploymentId;storage.close();
 const grants=new Map<string,{deploymentId:string;userId:string;domain:string;operationId:string;purpose:LifecyclePurpose}>();
 const lifecycleAuthority=new LifecycleAuthority(deploymentId,{verify:async token=>grants.get(token),isCurrent:context=>{const current=grants.get(context.operationId);return Boolean(current&&current.deploymentId===context.deploymentId&&current.userId===context.userId&&current.domain===context.domain&&current.purpose===context.purpose);}});
 let node=await buildApp({dataDir:directory},{lifecycleAuthority}) as ProductionNode;const nodes=[node];assert.ok(node.execution);
 t.after(async()=>{for(const current of nodes.reverse())await current.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({method,url,headers:headers(token),...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const response=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client',durationMs:86400000});assert.equal(response.statusCode,200,response.body);return response.json();};
 const admin=await login('generated-admin');
 const create=async(username:string)=>{const response=await request(admin.token,'/api/admin/accounts','POST',{username,password,administrator:false});assert.equal(response.statusCode,200,response.body);return response.json();};
 const a=await create('generated-a'),b=await create('generated-b'),alice=await login(a.username),bob=await login(b.username);
 const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};
 const journal=(userId:string)=>read(db=>({calls:db.prepare('SELECT * FROM task_external_calls WHERE user_id=? ORDER BY issued_at,issuance_id').all(userId),confirmations:db.prepare('SELECT * FROM task_external_retry_confirmations WHERE user_id=? ORDER BY confirmed_at,confirmation_id').all(userId)}));
 const snapshot=(userId:string)=>read(db=>JSON.stringify({tasks:db.prepare('SELECT * FROM user_tasks WHERE user_id=? ORDER BY task_id').all(userId),steps:db.prepare('SELECT * FROM execution_steps WHERE user_id=? ORDER BY id').all(userId),authorizations:db.prepare('SELECT * FROM task_authorizations WHERE user_id=? ORDER BY task_id').all(userId),operations:db.prepare('SELECT * FROM operation_progress WHERE user_id=? ORDER BY id').all(userId),changes:db.prepare('SELECT * FROM operation_changes WHERE user_id=? ORDER BY user_seq').all(userId),...journal(userId)}));
 const wait=async(taskId:string,state:string)=>{const deadline=Date.now()+8000;for(;;){const step=node.execution.engine.get(taskId);if(step?.state===state)return step;if(Date.now()>=deadline)assert.fail(`external task did not reach ${state}: ${JSON.stringify(step)}`);await delay(5);}};
 const submit=async(token:string,operationId:string,label=operationId)=>{const response=await request(token,'/api/tasks','POST',{kind:'generated.external-journal',operationId,input:{label}});assert.equal(response.statusCode,200,response.body);return response.json();};
 const authorize=async(userId:string,purpose:LifecyclePurpose,operationId=randomUUID(),domain='execution')=>{grants.set(operationId,{deploymentId,userId,domain,operationId,purpose});return lifecycleAuthority.authorize(operationId);};
 const restart=async(register:(node:ProductionNode)=>void)=>{await node.app.close();node=await buildApp({dataDir:directory},{lifecycleAuthority}) as ProductionNode;nodes.push(node);register(node);await node.app.ready();return node;};
 return {directory,get node(){return node;},grants,request,a,b,alice,bob,journal,snapshot,wait,submit,authorize,restart,read};
}

test('owner retry retains the old unknown issuance and confirmation through restart, later success and scoped deletion',async t=>{
 const f=await fixture(t),issued=new Map<string,string[]>();
 const execute=async(run:TaskRun)=>{
  const ordinal=(run.checkpoint.read<number>('issued-count')??0)+1;run.checkpoint.write('issued-count',ordinal);
  const key=String(run.task.input.label)+'-K'+ordinal,issuanceId=run.external.begin(key),ids=issued.get(run.context.userId)??[];assert.equal(typeof issuanceId,'string');assert.ok(issuanceId);ids.push(issuanceId);issued.set(run.context.userId,ids);
  if(ordinal===1)throw new ExecutionFailure('blocked','generated_external_result_unknown');
  run.external.complete();return {issuanceId};
 };
 f.node.execution.register(handler(execute));
 const a=await f.submit(f.alice.token,'same-business-operation','A_GENERATED'),b=await f.submit(f.bob.token,'same-business-operation','B_PRIVATE');await f.wait(a.id,'blocked');await f.wait(b.id,'blocked');
 const first=f.journal(f.a.userId).calls[0],bIssue=f.journal(f.b.userId).calls[0];assert.equal(first.request_key,'A_GENERATED-K1');assert.equal(first.user_id,f.a.userId);assert.equal(first.authorization_epoch,f.a.authorizationEpoch);assert.equal(first.state,'issued');assert.ok(Number(first.issued_at)>0);assert.equal(first.issuance_id,issued.get(f.a.userId)![0]);
 const bBefore=f.snapshot(f.b.userId),aBefore=JSON.stringify(f.journal(f.a.userId));
 const foreign=await f.request(f.bob.token,'/api/tasks/'+a.id+'/retry','POST',{confirmUnknown:true});assert.equal(foreign.statusCode,404,foreign.body);assert.equal(f.snapshot(f.b.userId),bBefore);assert.equal(JSON.stringify(f.journal(f.a.userId)),aBefore);
 assert.equal((await f.request(f.alice.token,'/api/tasks/'+a.id+'/retry','POST',{})).statusCode,409);assert.equal(JSON.stringify(f.journal(f.a.userId)),aBefore);
 assert.equal((await f.request(f.alice.token,'/api/tasks/'+a.id+'/retry','POST',{confirmUnknown:true})).statusCode,200);await f.wait(a.id,'succeeded');
 const beforeRestart=f.journal(f.a.userId),old=beforeRestart.calls.find(call=>call.request_key==='A_GENERATED-K1')!,latest=beforeRestart.calls.find(call=>call.request_key==='A_GENERATED-K2')!;assert.equal(beforeRestart.calls.length,2);assert.equal(old.state,'unknown');assert.equal(old.settled_at,null);assert.equal(latest.state,'succeeded');assert.ok(Number(latest.settled_at)>=Number(latest.issued_at));assert.notEqual(latest.issuance_id,old.issuance_id);
 assert.equal(beforeRestart.confirmations.length,1);const confirmation=beforeRestart.confirmations[0];assert.equal(confirmation.issuance_id,old.issuance_id);assert.equal(confirmation.user_id,f.a.userId);assert.equal(confirmation.authorization_epoch,f.a.authorizationEpoch);assert.ok(Number(confirmation.confirmed_at)>=Number(old.issued_at));assert.equal(f.journal(f.b.userId).confirmations.length,0);assert.equal(f.snapshot(f.b.userId),bBefore);
 const publicA=await f.request(f.alice.token,'/api/tasks/'+a.id);assert.equal(publicA.statusCode,200);assert.ok(!publicA.body.includes('B_PRIVATE'));assert.ok(!JSON.stringify(beforeRestart).includes(password));assert.ok(!JSON.stringify(beforeRestart).includes(f.alice.token));
 await f.restart(node=>node.execution.register(handler(execute)));assert.deepEqual(f.journal(f.a.userId),beforeRestart);assert.equal(f.snapshot(f.b.userId),bBefore);assert.equal(issued.get(f.a.userId)!.length,2,'restart must not issue another external call');
 const deletion=await f.authorize(f.a.userId,'delete','generated-a-journal-delete'),ordinary=await f.node.authority.authenticate(f.alice.token);
 const firstDelete=await f.node.services.forLifecycle(deletion).run();assert.deepEqual(firstDelete,{status:'result_unknown',operationId:deletion.operationId});
 const pending=f.node.execution.pendingExternalForDeletion(deletion);assert.equal(pending.length,1);assert.equal(pending[0].taskId,a.id);assert.equal(pending[0].issuanceId,old.issuance_id);assert.equal(pending[0].key,'A_GENERATED-K1');assert.equal(pending[0].state,'unknown');assert.ok(!JSON.stringify(pending).includes('B_PRIVATE'));
 assert.throws(()=>f.node.execution.pendingExternalForDeletion(ordinary));assert.throws(()=>f.node.execution.pendingExternalForDeletion({...deletion} as any));
 const wrongPurpose=await f.authorize(f.a.userId,'export'),wrongDomain=await f.authorize(f.a.userId,'delete',randomUUID(),'private-data');assert.throws(()=>f.node.execution.pendingExternalForDeletion(wrongPurpose));assert.throws(()=>f.node.execution.pendingExternalForDeletion(wrongDomain));
 assert.throws(()=>f.node.execution.settleExternalForDeletion(deletion,b.id,'not-executed',String(bIssue.issuance_id)));assert.throws(()=>f.node.execution.settleExternalForDeletion(deletion,a.id,'not-executed',String(bIssue.issuance_id)));assert.equal(f.snapshot(f.b.userId),bBefore);assert.equal(f.node.execution.pendingExternalForDeletion(deletion).length,1);
 f.node.execution.settleExternalForDeletion(deletion,a.id,'not-executed',String(old.issuance_id));f.node.execution.settleExternalForDeletion(deletion,a.id,'not-executed',String(old.issuance_id));assert.deepEqual(f.node.execution.pendingExternalForDeletion(deletion),[]);assert.equal(f.journal(f.a.userId).calls.find(call=>call.issuance_id===old.issuance_id)!.state,'not_executed');assert.equal(f.journal(f.a.userId).calls.find(call=>call.issuance_id===latest.issuance_id)!.state,'succeeded');
 const settled=JSON.stringify(f.journal(f.a.userId));f.node.execution.settleExternalForDeletion(deletion,a.id,'completed');assert.throws(()=>f.node.execution.settleExternalForDeletion(deletion,a.id,'not-executed'),(error:any)=>error.statusCode===409);assert.equal(JSON.stringify(f.journal(f.a.userId)),settled);
 assert.deepEqual(await f.node.services.forLifecycle(deletion).run(),{status:'complete',operationId:deletion.operationId});assert.deepEqual(await f.node.services.forLifecycle(deletion).run(),{status:'complete',operationId:deletion.operationId});assert.deepEqual(f.journal(f.a.userId),{calls:[],confirmations:[]});assert.equal(f.snapshot(f.b.userId),bBefore);assert.equal((await f.request(f.bob.token,'/api/tasks/'+b.id)).statusCode,200);
});

test('several unresolved attempts require an exact issuance ID and never settle another call by task identity alone',async t=>{
 const f=await fixture(t);f.node.execution.register(handler(async run=>{const ordinal=(run.checkpoint.read<number>('issued-count')??0)+1;run.checkpoint.write('issued-count',ordinal);run.external.begin('generated-pending-'+ordinal);throw new ExecutionFailure('blocked','generated_external_result_unknown');}));
 const a=await f.submit(f.alice.token,'multiple-unknown');await f.wait(a.id,'blocked');assert.equal((await f.request(f.alice.token,'/api/tasks/'+a.id+'/retry','POST',{confirmUnknown:true})).statusCode,200);await f.wait(a.id,'blocked');const calls=f.journal(f.a.userId).calls;assert.equal(calls.length,2);assert.notEqual(calls[0].issuance_id,calls[1].issuance_id);
 const deletion=await f.authorize(f.a.userId,'delete','generated-multiple-journal-delete');assert.deepEqual(await f.node.services.forLifecycle(deletion).run(),{status:'result_unknown',operationId:deletion.operationId});assert.equal(f.node.execution.pendingExternalForDeletion(deletion).length,2);
 const before=JSON.stringify(f.journal(f.a.userId));assert.throws(()=>f.node.execution.settleExternalForDeletion(deletion,a.id,'not-executed'),(error:any)=>error.statusCode===409);assert.equal(JSON.stringify(f.journal(f.a.userId)),before);
 f.node.execution.settleExternalForDeletion(deletion,a.id,'completed',String(calls[0].issuance_id));const pending=f.node.execution.pendingExternalForDeletion(deletion);assert.equal(pending.length,1);assert.equal(pending[0].issuanceId,calls[1].issuance_id);assert.deepEqual(await f.node.services.forLifecycle(deletion).run(),{status:'result_unknown',operationId:deletion.operationId});
 f.node.execution.settleExternalForDeletion(deletion,a.id,'not-executed',String(calls[1].issuance_id));f.node.execution.settleExternalForDeletion(deletion,a.id,'not-executed');assert.throws(()=>f.node.execution.settleExternalForDeletion(deletion,a.id,'completed'),(error:any)=>error.statusCode===409);assert.deepEqual(await f.node.services.forLifecycle(deletion).run(),{status:'complete',operationId:deletion.operationId});assert.deepEqual(f.journal(f.a.userId),{calls:[],confirmations:[]});
});
