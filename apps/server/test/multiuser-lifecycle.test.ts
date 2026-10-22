import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {buildApp} from '../src/app.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import type {TaskRun} from '../src/scope/task-execution.js';

const password='Generated-M16-account-password';
const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-m16-'));
 let node=await buildApp({dataDir:directory});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 await node.accounts!.initialize('generated-admin',password);
 const request=(token:string|undefined,method:any,url:string,payload?:unknown,headers:Record<string,string>={})=>node.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{}),...headers},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const response=await request(undefined,'POST','/api/auth/login',{username,password,mode:'client'});assert.equal(response.statusCode,200,response.body);return response.json();};
 const admin=await login('generated-admin');
 for(const username of ['generated-alice','generated-bob'])assert.equal((await request(admin.token,'POST','/api/admin/accounts',{username,password})).statusCode,200);
 const a=await login('generated-alice'),b=await login('generated-bob');
 const source={id:'same-source',name:'Generated source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'};
 for(const [owner,text] of [[a,'Generated A private'],[b,'Generated B private']] as const){
  assert.equal((await request(owner.token,'POST','/api/ingress/sources',source)).statusCode,200);
  assert.equal((await request(owner.token,'POST','/api/ingress/sources/same-source/items',{batchId:'same-batch',items:[{externalId:'same-external',revision:'same-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated',text,kind:'file',layer:'original'}]})).statusCode,200);
 }
 const restart=async()=>{await node.app.close();node=await buildApp({dataDir:directory});};
 return {directory,get node(){return node;},request,login,admin,a,b,restart};
}

test('portable 3 direct production download exports only its owner and has no historical content route',async t=>{
 const f=await fixture(t),db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());
 await waitForScopedState(()=>!db.prepare("SELECT 1 FROM execution_steps WHERE state='running' OR(state='waiting' AND coalesce(error,'')<>'memory_window_pending' AND NOT(kind='memory.intake' AND error='memory_model_required' AND attempts=0)) LIMIT 1").get(),()=>JSON.stringify(db.prepare('SELECT kind,state,error,attempts,user_id FROM execution_steps').all()));
 const waiting=db.prepare("SELECT i.user_id,i.json,i.state,i.revoked,e.id,e.state taskState,e.error,e.attempts,u.external_state,j.id actualJob FROM mm_intakes i JOIN execution_steps e ON e.user_id=i.user_id AND e.id=i.task_id JOIN user_tasks u ON u.user_id=i.user_id AND u.task_id=e.id LEFT JOIN mm_jobs j ON j.user_id=i.user_id AND j.id=i.job_id WHERE i.user_id IN (?,?) ORDER BY i.user_id").all(f.a.userId,f.b.userId);assert.equal(waiting.length,2);assert.deepEqual(new Set(waiting.map(row=>row.user_id)),new Set([f.a.userId,f.b.userId]));for(const row of waiting){assert.equal(row.state,'pending');assert.equal(row.revoked,0);assert.equal(row.taskState,'waiting');assert.equal(row.error,'memory_model_required');assert.equal(row.attempts,0);assert.equal(row.actualJob,null);assert.equal(row.external_state,'none');assert.ok(JSON.parse(String(row.json)).targetIds.length);}assert.equal(db.prepare('SELECT count(*) n FROM mm_jobs').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM user_model_usage').get()!.n,0);assert.equal(db.prepare("SELECT 1 FROM execution_steps WHERE state IN ('failed','stale','blocked') LIMIT 1").get(),undefined);
 const content=await f.request(f.a.token,'GET','/api/export');assert.equal(content.statusCode,200,content.body);assert.equal(content.headers['content-type'],'application/json; charset=utf-8');
 const archive=content.json();assert.equal(archive.version,3);assert.equal(archive.userId,f.a.userId);assert.match(content.body,/Generated A private/);assert.doesNotMatch(content.body,/Generated B private|password_hash|password_salt|token_hash/);
 for(const owner of [f.a,f.b,f.admin])assert.ok(!content.body.includes(owner.token));
 const id=String(content.headers['x-mote-operation-id']);assert.equal(db.prepare('SELECT COUNT(*) n FROM lifecycle_exports').get()!.n,0);
 for(const owner of [f.a,f.b,f.admin])assert.equal((await f.request(owner.token,'GET','/api/portable/exports/'+id+'/content')).statusCode,503);
 await f.restart();assert.equal((await f.request(f.a.token,'GET','/api/export')).statusCode,200);
});

test('production account deletion revokes before erasure, is durable and cannot delete B or reenable a deleted account',async t=>{
 const f=await fixture(t),before=await f.request(f.b.token,'GET','/api/captures'),operationId=randomUUID();
 const credentials=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>credentials.close());const bCredentials=credentials.prepare('SELECT * FROM auth_credentials WHERE user_id=? ORDER BY id').all(f.b.userId);
 const ordinary=await f.request(f.a.token,'DELETE','/api/admin/accounts/'+f.b.userId,{operationId});assert.equal(ordinary.statusCode,403);
 const started=await f.request(f.admin.token,'DELETE','/api/admin/accounts/'+f.a.userId,{operationId});assert.equal(started.statusCode,200,started.body);
 assert.equal((await f.request(f.a.token,'GET','/api/captures')).statusCode,401);
 let receipt=started.json();for(let tries=0;['working','pending'].includes(receipt.state)&&tries<100;tries++){await new Promise(r=>setTimeout(r,10));receipt=(await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+receipt.id)).json();}
 assert.equal(receipt.state,'completed',JSON.stringify(receipt));
 assert.equal(credentials.prepare('SELECT count(*) n FROM auth_credentials WHERE user_id=?').get(f.a.userId)!.n,0,'completed deletion must physically remove token hashes, CSRF hashes, device metadata and parent credentials');
 assert.equal((await f.request(f.admin.token,'GET','/api/admin/accounts')).json().items.find((account:any)=>account.userId===f.a.userId).deletionId,receipt.id,'administrator can rediscover the durable receipt after refresh');
 assert.deepEqual(credentials.prepare('SELECT * FROM auth_credentials WHERE user_id=? ORDER BY id').all(f.b.userId),bCredentials);
 assert.deepEqual((await f.request(f.b.token,'GET','/api/captures')).json(),before.json());
 assert.equal((await f.request(f.admin.token,'PATCH','/api/admin/accounts/'+f.a.userId,{disabled:false})).statusCode,409);
 assert.equal((await f.request(f.admin.token,'POST','/api/admin/accounts/'+f.a.userId+'/password',{password:'Generated-new-deleted-password'})).statusCode,409,'a deleted identity cannot reacquire password material through administrator reset');
 await f.restart();assert.deepEqual((await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+receipt.id)).json(),receipt);
 assert.equal((await f.request(f.admin.token,'DELETE','/api/admin/accounts/'+f.a.userId,{operationId})).json().id,receipt.id);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=?').get(f.a.userId)!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=?').get(f.b.userId)!.n,1);}finally{db.close();}
});

test('direct export rejects owner selectors and has no export start or history endpoint',async t=>{
 const f=await fixture(t);
 assert.equal((await f.request(f.a.token,'GET','/api/export?userId='+f.b.userId)).statusCode,401);
 for(const method of ['GET','POST'] as const)assert.equal((await f.request(f.a.token,method,'/api/portable/exports',method==='POST'?{operationId:randomUUID()}:undefined)).statusCode,503);
});

test('real executing A task loses publication before delete finishes while B still commits',async t=>{
 const f=await fixture(t);let held:TaskRun|undefined,release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve),committed:string[]=[];
 f.node.execution!.register({kind:'generated.m16-held',pool:'generated-m16',policy:EXECUTION_POLICIES.deterministic,concurrency:()=>2,parseInput:value=>value as Record<string,unknown>,execute:async run=>{if(run.context.userId===f.a.userId){held=run;await wait;}return run.context.userId;},commit:(run)=>{committed.push(run.context.userId);}});t.after(()=>release());
 const a=await f.request(f.a.token,'POST','/api/tasks',{kind:'generated.m16-held',operationId:'same-held',input:{}});assert.equal(a.statusCode,200,a.body);
 await waitForScopedState(()=>held,()=> 'generated A task was not executing');
 const b=await f.request(f.b.token,'POST','/api/tasks',{kind:'generated.m16-held',operationId:'same-held',input:{}});assert.equal(b.statusCode,200,b.body);
 await waitForScopedState(()=>committed.includes(f.b.userId),()=> 'generated B task did not commit');
 const deletion=await f.request(f.admin.token,'DELETE','/api/admin/accounts/'+f.a.userId,{operationId:randomUUID()});assert.equal(deletion.statusCode,200,deletion.body);
 assert.throws(()=>held!.grant.commit(()=>committed.push(f.a.userId)));assert.throws(()=>held!.checkpoint.write('late',{value:'Generated A'}));
 assert.equal((await f.request(f.a.token,'POST','/api/tasks',{kind:'generated.m16-held',operationId:'late',input:{}})).statusCode,401);
 release();await waitForScopedState(async()=>{const r=await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+deletion.json().id);return r.json().state==='completed';},()=> 'deletion did not finish');
 assert.deepEqual(committed,[f.b.userId]);assert.equal((await f.request(f.b.token,'GET','/api/tasks/'+b.json().id)).json().state,'succeeded');
});

test('unknown external task outcome stops erasure durably; retry never repeats the external call or erases dependencies',async t=>{
 const f=await fixture(t);let calls=0;
 f.node.execution!.register({kind:'generated.m16-external',pool:'generated-m16',policy:EXECUTION_POLICIES.localProcessing,concurrency:()=>1,parseInput:value=>value as Record<string,unknown>,execute:async run=>{run.external.begin('generated-external-key');calls++;throw new ExecutionFailure('transient','generated_transport_lost',1);}});
 const task=await f.request(f.a.token,'POST','/api/tasks',{kind:'generated.m16-external',operationId:'unknown',input:{}});assert.equal(task.statusCode,200,task.body);
 await waitForScopedState(async()=>{const value=(await f.request(f.a.token,'GET','/api/tasks/'+task.json().id)).json();return value.state==='blocked'&&value.externalUnresolved>0;},()=> 'unknown task did not settle');
 const deletion=await f.request(f.admin.token,'DELETE','/api/admin/accounts/'+f.a.userId,{operationId:randomUUID()});assert.equal(deletion.statusCode,200,deletion.body);const id=deletion.json().id;
 await waitForScopedState(async()=>(await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+id)).json().state==='result_unknown',()=> 'unknown erasure was not reported');
 await f.restart();assert.equal((await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+id)).json().state,'result_unknown');
 assert.equal((await f.request(f.admin.token,'POST','/api/admin/accounts/'+f.a.userId+'/password',{password:'Generated-new-deleted-password'})).statusCode,409,'an approved pending deletion cannot reacquire password material');
 for(let i=0;i<2;i++){assert.equal((await f.request(f.admin.token,'POST','/api/admin/account-deletions/'+id+'/retry',{})).statusCode,200);await waitForScopedState(async()=>(await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+id)).json().state==='result_unknown',()=> 'retry invented success');}
 assert.equal(calls,1);const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=?').get(f.a.userId)!.n,1);assert.equal(db.prepare('SELECT revoked FROM task_authorizations WHERE task_id=?').get(task.json().id)!.revoked,1);}finally{db.close();}
 assert.equal((await f.request(f.b.token,'GET','/api/captures')).json().items.length,1);
});

test('account erasure cannot claim physical completion after a new lifecycle domain appears during deletion',async t=>{
 const f=await fixture(t),db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());db.exec('CREATE TABLE generated_late_domain(user_id TEXT PRIMARY KEY,body TEXT NOT NULL)');for(const user of [f.a,f.b])db.prepare('INSERT INTO generated_late_domain VALUES(?,?)').run(user.userId,'Generated '+user.userId);
 let lateRegistered=false,lateCalls=0;const domain='generated-late',register=()=>{if(lateRegistered)return;lateRegistered=true;f.node.services.registerUser(domain,{scope:'user',create:()=>({}),lifecycle:{exportUser:async subject=>({domain,version:1,userId:subject.userId,deploymentId:subject.deploymentId,payload:{generated:true}}),restoreUser:async()=>{},deleteUser:async(subject,operationId)=>{f.node.services.assertSubject(subject,domain,'delete');lateCalls++;db.prepare('DELETE FROM generated_late_domain WHERE user_id=?').run(subject.userId);return {status:'complete',operationId};}}});};
 f.node.services.registerUser('generated-register-late',{scope:'user',create:()=>({}),lifecycle:{exportUser:async subject=>({domain:'generated-register-late',version:1,userId:subject.userId,deploymentId:subject.deploymentId,payload:{generated:true}}),restoreUser:async()=>{},deleteUser:async(_subject,operationId)=>{register();return {status:'complete',operationId};}}});
 const started=await f.request(f.admin.token,'DELETE','/api/admin/accounts/'+f.a.userId,{operationId:randomUUID()});assert.equal(started.statusCode,200,started.body);const id=started.json().id;await waitForScopedState(async()=>(await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+id)).json().state!=='working',()=> 'deletion did not settle');const receipt=(await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+id)).json();assert.equal(receipt.state,'blocked','a late registered private domain must not be silently omitted');assert.equal(db.prepare('SELECT count(*) n FROM generated_late_domain WHERE user_id=?').get(f.a.userId)!.n,1);
 await f.request(f.admin.token,'POST','/api/admin/account-deletions/'+id+'/retry',{});await waitForScopedState(async()=>(await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+id)).json().state==='completed',()=> 'explicit retry did not cover the new domain');assert.equal(lateCalls,1);assert.equal(db.prepare('SELECT count(*) n FROM generated_late_domain WHERE user_id=?').get(f.a.userId)!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM generated_late_domain WHERE user_id=?').get(f.b.userId)!.n,1);
});
