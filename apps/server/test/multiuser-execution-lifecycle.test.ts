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
import {openScopeStorage} from '../src/scope/storage.js';
import {LifecycleAuthority,type LifecyclePurpose,type UserExport} from '../src/scope/lifecycle.js';
import {TaskExecution,type TaskRun,type UserTaskHandler} from '../src/scope/task-execution.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {defaultModelDomain,defaultModelSettings} from '../src/model-settings.js';
import {ExecutionFailure} from '../src/execution-engine.js';

const password='Generated-lifecycle-password-01';
const headers=(token?:string)=>({'x-mote-protocol-version':'2',...(token?{authorization:'Bearer '+token}:{})});
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
const handler=(patch:Partial<UserTaskHandler>={}):UserTaskHandler=>({kind:'generated.lifecycle',pool:'generated-lifecycle',concurrency:()=>1,policy:EXECUTION_POLICIES.deterministic,parseInput:input=>z.object({label:z.string()}).strict().parse(input),portableInput:input=>input,execute:async run=>({label:run.task.input.label}),...patch});
type ProductionNode=Awaited<ReturnType<typeof buildApp>>&{execution:TaskExecution};
async function fixture(t:TestContext,setup?:(node:ProductionNode)=>void,productionLifecycle=false){
 const directory=mkdtempSync(join(tmpdir(),'mote-m05-lifecycle-')),initial=openScopeStorage(directory),deploymentId=initial.deploymentId;initial.close();
 const grants=new Map<string,{deploymentId:string;userId:string;domain:string;operationId:string;purpose:LifecyclePurpose}>();
 const lifecycleAuthority=new LifecycleAuthority(deploymentId,{verify:async token=>grants.get(token),isCurrent:context=>{const row=grants.get(context.operationId);return Boolean(row&&row.userId===context.userId&&row.domain===context.domain&&row.purpose===context.purpose);}});
 const node=await buildApp({dataDir:directory},productionLifecycle?{}:{lifecycleAuthority}) as ProductionNode;assert.ok(node.execution);setup?.(node);
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>node.app.inject({method,url,headers:headers(token),...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client',durationMs:86400000});assert.equal(r.statusCode,200,r.body);return r.json();};
 const admin=await login('generated-admin');
 const create=async(username:string)=>{const r=await request(admin.token,'/api/admin/accounts','POST',{username,password,administrator:false});assert.equal(r.statusCode,200,r.body);return r.json();};
 const a=await create('generated-a'),b=await create('generated-b'),alice=await login(a.username),bob=await login(b.username);
 const submit=async(token:string,operationId:string,label=operationId,dependencies:string[]=[])=>{const response=await request(token,'/api/tasks','POST',{kind:'generated.lifecycle',operationId,input:{label},dependencies});assert.equal(response.statusCode,200,response.body);return response.json();};
 const wait=async(taskId:string,state:string)=>{const deadline=Date.now()+8000;for(;;){const step=node.execution.engine.get(taskId);if(step?.state===state)return step;if(Date.now()>=deadline)assert.fail(`task did not reach ${state}: ${JSON.stringify(step)}`);await delay(5);}};
 const authorize=async(userId:string,purpose:LifecyclePurpose,operationId=randomUUID(),domain='execution')=>{grants.set(operationId,{deploymentId,userId,domain,operationId,purpose});return lifecycleAuthority.authorize(operationId);};
 const lifecycle=async(userId:string,purpose:LifecyclePurpose,archive?:UserExport,operationId?:string)=>node.services.forLifecycle(await authorize(userId,purpose,operationId)).run(archive);
 const snapshot=(userId:string)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});try{return JSON.stringify({tasks:db.prepare('SELECT * FROM user_tasks WHERE user_id=? ORDER BY task_id').all(userId),steps:db.prepare('SELECT * FROM execution_steps WHERE user_id=? ORDER BY id').all(userId),authorizations:db.prepare('SELECT * FROM task_authorizations WHERE user_id=? ORDER BY task_id').all(userId),operations:db.prepare('SELECT * FROM operation_progress WHERE user_id=? ORDER BY id').all(userId),changes:db.prepare('SELECT * FROM operation_changes WHERE user_id=? ORDER BY seq').all(userId)});}finally{db.close();}};
 const rows=(userId:string)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});try{return db.prepare('SELECT s.*,a.revoked,t.external_state FROM execution_steps s JOIN user_tasks t ON t.task_id=s.id JOIN task_authorizations a ON a.task_id=s.id WHERE s.user_id=? ORDER BY s.id').all(userId);}finally{db.close();}};
 return {directory,deploymentId,node,grants,request,login,admin,a,b,alice,bob,submit,wait,authorize,lifecycle,snapshot,rows};
}

test('purpose-limited execution lifecycle exports and deletes disabled A while B task bytes and status stay unchanged',async t=>{
 const f=await fixture(t,node=>node.execution.register(handler()));
 const a=await f.submit(f.alice.token,'a-history','A_PORTABLE_TASK'),b=await f.submit(f.bob.token,'b-history','B_PRIVATE_TASK');await f.wait(a.id,'succeeded');await f.wait(b.id,'succeeded');
 const bBefore=f.snapshot(f.b.userId),aContext=await f.node.authority.authenticate(f.alice.token);
 assert.equal((await f.request(f.admin.token,`/api/admin/accounts/${f.a.userId}`,'PATCH',{disabled:true})).statusCode,200);assert.throws(()=>f.node.services.forUser(aContext));
 const archive=await f.lifecycle(f.a.userId,'export') as UserExport,payload=archive.payload as any,encoded=JSON.stringify(archive);
 assert.equal(archive.domain,'execution');assert.equal(archive.userId,f.a.userId);assert.equal(payload.tasks.length,1);assert.equal(payload.tasks[0].id,a.id);assert.ok(encoded.includes('A_PORTABLE_TASK'));assert.ok(!encoded.includes('B_PRIVATE_TASK'));
 for(const secret of [password,f.alice.token,f.bob.token,f.admin.token])assert.ok(!encoded.includes(secret));assert.equal(payload.coverage.activeAuthorization,false);assert.ok(payload.coverage.excluded.includes('checkpoints'));assert.ok(payload.coverage.excluded.includes('results'));
 const wrongPurpose=await f.authorize(f.a.userId,'delete');await assert.rejects(f.node.execution.lifecycle().exportUser(wrongPurpose),{code:'invalid_identity'});
 const wrongDomain=await f.authorize(f.a.userId,'export',randomUUID(),'private-data');await assert.rejects(f.node.execution.lifecycle().exportUser(wrongDomain),{code:'invalid_identity'});
 assert.throws(()=>f.node.services.forUser(wrongPurpose as any),{code:'invalid_identity'});
 const operation='generated-disabled-delete';assert.deepEqual(await f.lifecycle(f.a.userId,'delete',undefined,operation),{status:'complete',operationId:operation});assert.deepEqual(await f.lifecycle(f.a.userId,'delete',undefined,operation),{status:'complete',operationId:operation});
 assert.deepEqual(f.rows(f.a.userId),[]);assert.equal(f.snapshot(f.b.userId),bBefore);assert.equal((await f.request(f.bob.token,'/api/tasks/'+b.id)).statusCode,200);
});

test('nonempty history restore preserves terminal history and fences active work with revoked original-epoch grants',async t=>{
 const entered=deferred(),held=deferred();let running:TaskRun|undefined,commits=0;
 const f=await fixture(t,node=>node.execution.register(handler({execute:async run=>{if(run.task.input.label==='running'){running=run;run.checkpoint.write('not-portable',{generated:true});entered.resolve();await held.promise;}return run.task.input.label;},commit:()=>{commits++;}})));t.after(()=>held.resolve());
 const done=await f.submit(f.alice.token,'terminal','completed');await f.wait(done.id,'succeeded');const active=await f.submit(f.alice.token,'active','running');await entered.promise;const dependent=await f.submit(f.alice.token,'dependent','dependent',[active.id]);
 const archive=await f.lifecycle(f.a.userId,'export') as UserExport,oldEpoch=f.rows(f.a.userId)[0].authorization_epoch;
 const deleting=await f.lifecycle(f.a.userId,'delete',undefined,'generated-before-restore-delete');assert.deepEqual(deleting,{status:'complete',operationId:'generated-before-restore-delete'});assert.throws(()=>running!.checkpoint.write('late',{generated:true}));assert.throws(()=>running!.progress({generated:true}));held.resolve();
 await f.lifecycle(f.a.userId,'restore',archive,'generated-history-restore');await f.lifecycle(f.a.userId,'restore',archive,'generated-history-restore');
 const rows=f.rows(f.a.userId);assert.equal(rows.length,3);for(const row of rows){assert.equal(row.user_id,f.a.userId);assert.equal(row.authorization_epoch,oldEpoch);assert.equal(row.revoked,1);await assert.rejects(f.node.authority.restoreTask(row.grant_id),{code:'invalid_identity'});}
 assert.equal(rows.find(row=>row.id===done.id)!.state,'succeeded');for(const task of [active,dependent]){const row=rows.find(row=>row.id===task.id)!;assert.equal(row.state,'blocked');assert.equal(row.error,'restore_authorization_required');}
 await f.node.execution.tick();await delay(20);assert.equal(commits,1);assert.equal((await f.request(f.alice.token,'/api/tasks/'+active.id+'/retry','POST',{})).statusCode,401);
 const changed=structuredClone(archive);(changed.payload as any).tasks[0].attempts++;await assert.rejects(f.lifecycle(f.a.userId,'restore',changed,'generated-history-restore'),{code:'task_restore_conflict'});
});

test('invalid envelopes, coverage, duplicate IDs and dependency graphs fail before any partial restore or B mutation',async t=>{
 const f=await fixture(t,node=>node.execution.register(handler())),a=await f.submit(f.alice.token,'parent','Generated parent');await f.wait(a.id,'succeeded');const child=await f.submit(f.alice.token,'child','Generated child',[a.id]),b=await f.submit(f.bob.token,'b-history','B_PRIVATE_HISTORY');await f.wait(child.id,'succeeded');await f.wait(b.id,'succeeded');
 const archive=await f.lifecycle(f.a.userId,'export') as UserExport;await f.lifecycle(f.a.userId,'delete',undefined,'generated-delete-before-invalid');const empty=f.snapshot(f.a.userId),bBefore=f.snapshot(f.b.userId);
 const invalid=[
  (value:any)=>{value.userId=f.b.userId;},(value:any)=>{value.deploymentId='generated-other-deployment';},(value:any)=>{value.domain='private-data';},(value:any)=>{value.version=2;},
  (value:any)=>{value.payload.coverage.excluded=[];},(value:any)=>{value.payload.tasks[0].authorizationEpoch=-1;},(value:any)=>{value.payload.tasks.push(structuredClone(value.payload.tasks[0]));},
  (value:any)=>{value.payload.tasks[0].dependencies=['f'.repeat(64)];},(value:any)=>{value.payload.tasks[0].dependencies=[b.id];},
  (value:any)=>{value.payload.tasks[0].dependencies=[value.payload.tasks[0].id];},
  (value:any)=>{value.payload.tasks[0].dependencies=[value.payload.tasks[1].id];value.payload.tasks[1].dependencies=[value.payload.tasks[0].id];},
  (value:any)=>{value.payload.tasks[0].input={unknown:'Generated invalid handler input'};},
 ];
 for(const [index,mutate] of invalid.entries()){const bad=structuredClone(archive);mutate(bad);await assert.rejects(f.lifecycle(f.a.userId,'restore',bad,'generated-invalid-'+index));assert.equal(f.snapshot(f.a.userId),empty);assert.equal(f.snapshot(f.b.userId),bBefore);}
 await f.lifecycle(f.a.userId,'restore',archive,'generated-valid-after-rejections');assert.equal(f.rows(f.a.userId).length,2);assert.equal(f.snapshot(f.b.userId),bBefore);
});

test('registered large portable input restores exact history with revoked authority and no automatic execution',async t=>{
 let executions=0;
 const f=await fixture(t,node=>node.execution.register(handler({admit:()=>new ExecutionFailure('waiting','generated_capacity',60000),execute:async()=>{executions++;return null;}}))),label='GENERATED_PORTABLE_'.repeat(2500);
 assert.ok(Buffer.byteLength(JSON.stringify({label}))>32768);
 const original=await f.submit(f.alice.token,'generated-large-portable',label),archive=await f.lifecycle(f.a.userId,'export') as UserExport,epoch=f.rows(f.a.userId)[0].authorization_epoch;
 const exported=(archive.payload as any).tasks.find((task:any)=>task.id===original.id);assert.deepEqual(exported.input,{label});assert.equal(exported.state,'waiting');
 await f.lifecycle(f.a.userId,'delete',undefined,'generated-large-delete');await f.lifecycle(f.a.userId,'restore',archive,'generated-large-restore');await f.lifecycle(f.a.userId,'restore',archive,'generated-large-restore');
 const restored=f.rows(f.a.userId);assert.equal(restored.length,1);assert.equal(restored[0].id,original.id);assert.equal(restored[0].authorization_epoch,epoch);assert.equal(restored[0].revoked,1);assert.equal(restored[0].state,'blocked');assert.equal(restored[0].error,'restore_authorization_required');
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{const row=db.prepare('SELECT u.input task_input,e.input engine_input FROM user_tasks u JOIN execution_steps e ON e.id=u.task_id WHERE u.task_id=?').get(original.id)!;assert.equal(row.task_input,row.engine_input);assert.deepEqual(JSON.parse(String(row.task_input)),{label});}finally{db.close();}
 await assert.rejects(f.node.authority.restoreTask(String(restored[0].grant_id)),{code:'invalid_identity'});await f.node.execution.tick();await delay(20);assert.equal(executions,0);assert.equal((await f.request(f.alice.token,'/api/tasks/'+original.id+'/retry','POST',{})).statusCode,401);assert.equal((await f.request(f.bob.token,'/api/tasks/'+original.id)).statusCode,404);
});

test('unknown-handler large history keeps the metadata guard and atomically rolls back before omitted-input restore',async t=>{
 let unregister!:()=>Promise<void>;
 const f=await fixture(t,node=>{unregister=node.execution.register(handler({admit:()=>new ExecutionFailure('waiting','generated_capacity',60000)}));});
 const small=await f.submit(f.alice.token,'generated-small-history','Generated small history'),large=await f.submit(f.alice.token,'generated-large-history','界'.repeat(12000)),archive=await f.lifecycle(f.a.userId,'export') as UserExport;
 (archive.payload as any).tasks.sort((a:any,b:any)=>Number(a.id===large.id)-Number(b.id===large.id));assert.equal((archive.payload as any).tasks[0].id,small.id,'force a valid row before the oversized row to exercise transaction rollback');
 await f.lifecycle(f.a.userId,'delete',undefined,'generated-unknown-delete');await unregister();
 const snapshot=()=>{const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{return {owned:f.snapshot(f.a.userId),lifecycle:db.prepare('SELECT * FROM task_lifecycle_state WHERE user_id=?').all(f.a.userId),journal:db.prepare('SELECT * FROM task_restore_journal WHERE user_id=?').all(f.a.userId),dependencies:db.prepare('SELECT * FROM execution_dependencies').all(),sequence:db.prepare('SELECT * FROM execution_user_sequence WHERE user_id=?').all(f.a.userId)};}finally{db.close();}},before=snapshot();
 await assert.rejects(f.lifecycle(f.a.userId,'restore',archive,'generated-unknown-large-restore'),{code:'task_metadata_invalid'});assert.deepEqual(snapshot(),before,'failed history restore leaves no partial tasks, grants, dependencies, lifecycle or journal');
 const omitted=structuredClone(archive),entry=(omitted.payload as any).tasks.find((task:any)=>task.id===large.id);delete entry.input;entry.inputOmitted=true;
 await f.lifecycle(f.a.userId,'restore',omitted,'generated-omitted-restore');const rows=f.rows(f.a.userId);assert.equal(rows.length,2);assert.equal(rows.find(row=>row.id===large.id)!.input,'{}');for(const row of rows){assert.equal(row.state,'blocked');assert.equal(row.error,'restore_authorization_required');assert.equal(row.revoked,1);}
});

test('deleting an issued external task reports result_unknown, revokes late work and retains reconciliation evidence',async t=>{
 const entered=deferred(),held=deferred();let running:TaskRun|undefined,commits=0;
 const f=await fixture(t,node=>node.execution.register(handler({execute:async run=>{if(run.task.input.label==='unknown'){running=run;run.external.begin('generated-remote-effect');entered.resolve();await held.promise;run.external.complete();}return null;},commit:()=>{commits++;}})));t.after(()=>held.resolve());
 const b=await f.submit(f.bob.token,'b-finished','B untouched');await f.wait(b.id,'succeeded');const bBefore=f.snapshot(f.b.userId),a=await f.submit(f.alice.token,'a-issued','unknown');await entered.promise;
 const first=await f.lifecycle(f.a.userId,'delete',undefined,'generated-unknown-delete');assert.deepEqual(first,{status:'result_unknown',operationId:'generated-unknown-delete'});assert.deepEqual(await f.lifecycle(f.a.userId,'delete',undefined,'generated-unknown-delete'),first);
 assert.throws(()=>running!.external.complete());assert.throws(()=>running!.checkpoint.write('late',{generated:true}));assert.throws(()=>running!.grant.commit(()=>{commits++;}));held.resolve();await delay(20);
 const rows=f.rows(f.a.userId);assert.equal(rows.length,1);assert.equal(rows[0].id,a.id);assert.equal(rows[0].state,'cancelled');assert.equal(rows[0].revoked,1);assert.ok(['issued','unknown'].includes(String(rows[0].external_state)));assert.equal(commits,1);assert.equal(f.snapshot(f.b.userId),bBefore);
 assert.equal((await f.request(f.alice.token,'/api/tasks/'+a.id)).statusCode,401);assert.equal((await f.request(f.alice.token,'/api/tasks/'+a.id+'/retry','POST',{confirmUnknown:true})).statusCode,401);
 const deletion=await f.authorize(f.a.userId,'delete','generated-unknown-delete');assert.throws(()=>f.node.execution.settleExternalForDeletion(deletion,b.id,'completed'),{code:'task_not_found'});
 const exportGrant=await f.authorize(f.a.userId,'export');assert.throws(()=>f.node.execution.settleExternalForDeletion(exportGrant,a.id,'completed'),{code:'invalid_identity'});assert.throws(()=>f.node.execution.settleExternalForDeletion({...deletion} as any,a.id,'completed'),{code:'invalid_identity'});
 const ordinary=await f.node.authority.authenticate(f.alice.token);assert.throws(()=>f.node.execution.settleExternalForDeletion(ordinary,a.id,'completed'),{code:'invalid_identity'});
 f.node.execution.settleExternalForDeletion(deletion,a.id,'completed');f.node.execution.settleExternalForDeletion(deletion,a.id,'completed');assert.deepEqual(await f.lifecycle(f.a.userId,'delete',undefined,'generated-unknown-delete'),{status:'complete',operationId:'generated-unknown-delete'});assert.deepEqual(f.rows(f.a.userId),[]);assert.equal(f.snapshot(f.b.userId),bBefore);assert.equal(commits,1);
});


for(const issued of [false,true])test(`formal account deletion retains ${issued?'unsettled issuance and':'pre-issuance'} physical cleanup protection without restoring a task capability`,async t=>{
 const entered=deferred(),release=deferred();t.after(()=>release.resolve());let committed=0;
 const f=await fixture(t,node=>node.execution.register(handler({modelFeature:'memory',execute:async run=>run.model!.withModel(async()=>{if(issued)run.external.begin('generated-deletion-read');entered.resolve();await release.promise;return null;},{recovery:'read-query'}),commit:()=>{committed++;}})),true);
 const adminView=(await f.request(f.admin.token,'/api/admin/configuration/models')).json();let response=await f.request(f.admin.token,'/api/admin/configuration/models','PUT',{revision:adminView.revision,value:{...defaultModelDomain(),deployment:{...defaultModelSettings(),provider:'codex',protocol:'codex-app-server',baseUrl:'',model:'gpt-6.1-sol',reasoningEffort:'high',modelRequestTimeoutMs:null,agentTimeoutMs:null,serviceTier:'default'}}});assert.equal(response.statusCode,200,response.body);
 const settings=(await f.request(f.alice.token,'/api/configuration')).json();response=await f.request(f.alice.token,'/api/configuration/models','PUT',{revision:settings.revision,value:{profiles:[],selections:{memory:{kind:'shared',id:'env:deployment'}}}});assert.equal(response.statusCode,200,response.body);
 const task=await f.submit(f.alice.token,'generated-held-physical','held');await entered.promise;const read=<T>(work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(f.directory,'mote.sqlite'));try{return work(db);}finally{db.close();}};
 const physical=read(db=>db.prepare("SELECT * FROM task_physical_calls WHERE task_id=? AND state='active'").get(task.id)!);assert.ok(physical.owner_token);assert.equal(Boolean(physical.issuance_id),issued);
 const archive=await f.node.services.forUser(await f.node.authority.authenticate(f.alice.token)).exportUser('execution') as UserExport;for(const key of [String(physical.owner_token),String(physical.snapshot_id),'task_model_attempts','task_external_policy_replays','execution_attempt_sessions'])assert.equal(JSON.stringify(archive).includes(key),false,key);
 const bBefore=f.snapshot(f.b.userId),deletion=await f.request(f.admin.token,'/api/admin/accounts/'+f.a.userId,'DELETE',{operationId:randomUUID()});assert.equal(deletion.statusCode,200,deletion.body);const deletionId=deletion.json().id;
 const state=async()=>{const response=await f.request(f.admin.token,'/api/admin/account-deletions/'+deletionId);assert.equal(response.statusCode,200,response.body);return response.json().state;};
 const until=async(check:()=>boolean|Promise<boolean>)=>{const deadline=Date.now()+8000;while(!await check()){assert.ok(Date.now()<deadline,JSON.stringify(await state()));await delay(5);}};
 await until(async()=>await state()==='result_unknown');assert.equal(read(db=>db.prepare("SELECT count(*) n FROM task_physical_calls WHERE task_id=? AND state='active'").get(task.id)!.n),1);assert.equal(committed,0);release.resolve();await until(()=>read(db=>db.prepare("SELECT count(*) n FROM task_physical_calls WHERE task_id=? AND state='active'").get(task.id)!.n)===0);assert.equal(committed,0);
 response=await f.request(f.admin.token,'/api/admin/account-deletions/'+deletionId+'/retry','POST',{});assert.equal(response.statusCode,200,response.body);await until(async()=>['completed','result_unknown'].includes(await state()));assert.equal(await state(),issued?'result_unknown':'completed');assert.equal(f.snapshot(f.b.userId),bBefore);
 if(issued){const call=read(db=>db.prepare('SELECT state,settled_at FROM task_external_calls WHERE task_id=?').get(task.id)!);assert.ok(['issued','unknown'].includes(String(call.state)));assert.equal(call.settled_at,null);assert.equal(read(db=>db.prepare('SELECT count(*) n FROM task_external_policy_replays').get()!.n),0);}else{for(const table of ['task_physical_calls','task_model_attempts','task_owner_retry_groups'])assert.equal(read(db=>db.prepare('SELECT count(*) n FROM '+table+' WHERE '+(table==='task_model_attempts'?'task_id':'user_id')+'=?').get(table==='task_model_attempts'?task.id:f.a.userId)!.n),0);assert.deepEqual(read(db=>db.prepare('PRAGMA foreign_key_check').all()),[]);}
});
