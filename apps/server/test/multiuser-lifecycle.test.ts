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

test('portable 3 actual production entry exports only its owner, exact resumable bytes and no login grants',async t=>{
 const f=await fixture(t),operationId=randomUUID();
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());
 await waitForScopedState(()=>!db.prepare("SELECT 1 FROM execution_steps WHERE state='running' OR(state='waiting' AND coalesce(error,'')<>'memory_window_pending') LIMIT 1").get(),()=>JSON.stringify(db.prepare('SELECT kind,state,error FROM execution_steps').all()));
 const started=await f.request(f.a.token,'POST','/api/portable/exports',{operationId});
 assert.equal(started.statusCode,200,started.body);
 const id=started.json().id;
 let receipt=started.json();
 for(let tries=0;receipt.state==='working'&&tries<100;tries++){await new Promise(r=>setTimeout(r,10));receipt=(await f.request(f.a.token,'GET','/api/portable/exports/'+id)).json();}
 assert.equal(receipt.state,'completed',JSON.stringify(receipt));
 assert.equal(receipt.userId,f.a.userId);assert.equal(receipt.deploymentId,f.a.deploymentId);
 assert.equal((await f.request(f.b.token,'GET','/api/portable/exports/'+id)).statusCode,404);
 assert.equal((await f.request(f.admin.token,'GET','/api/portable/exports/'+id+'/content')).statusCode,404);
 const content=await f.request(f.a.token,'GET','/api/portable/exports/'+id+'/content');
 assert.equal(content.statusCode,200,content.body);assert.equal(content.headers['content-type'],'application/json; charset=utf-8');
 const archive=content.json();assert.equal(archive.version,3);assert.equal(archive.userId,f.a.userId);assert.match(content.body,/Generated A private/);assert.doesNotMatch(content.body,/Generated B private|password_hash|password_salt|token_hash/);
 for(const owner of [f.a,f.b,f.admin])assert.ok(!content.body.includes(owner.token));
 assert.equal(receipt.bytes,content.rawPayload.length);
 const part=await f.request(f.a.token,'GET','/api/portable/exports/'+id+'/content',undefined,{range:'bytes=10-39','if-range':content.headers.etag as string});
 assert.equal(part.statusCode,206);assert.deepEqual(part.rawPayload,content.rawPayload.subarray(10,40));
 assert.equal((await f.request(f.a.token,'GET','/api/portable/exports/'+id+'/content',undefined,{range:'bytes=999999999999-'})).statusCode,416);
 await f.restart();assert.deepEqual((await f.request(f.a.token,'GET','/api/portable/exports/'+id+'/content')).rawPayload,content.rawPayload);
 assert.equal((await f.request(f.a.token,'POST','/api/portable/exports',{operationId})).json().id,id);
 const cancelled=await f.request(f.a.token,'POST','/api/portable/exports/'+id+'/cancel',{});assert.equal(cancelled.statusCode,200);assert.equal(cancelled.json().state,'cancelled');
 assert.equal((await f.request(f.a.token,'GET','/api/portable/exports/'+id+'/content')).statusCode,409);
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
 assert.deepEqual(credentials.prepare('SELECT * FROM auth_credentials WHERE user_id=? ORDER BY id').all(f.b.userId),bCredentials);
 assert.deepEqual((await f.request(f.b.token,'GET','/api/captures')).json(),before.json());
 assert.equal((await f.request(f.admin.token,'PATCH','/api/admin/accounts/'+f.a.userId,{disabled:false})).statusCode,409);
 assert.equal((await f.request(f.admin.token,'POST','/api/admin/accounts/'+f.a.userId+'/password',{password:'Generated-new-deleted-password'})).statusCode,409,'a deleted identity cannot reacquire password material through administrator reset');
 await f.restart();assert.deepEqual((await f.request(f.admin.token,'GET','/api/admin/account-deletions/'+receipt.id)).json(),receipt);
 assert.equal((await f.request(f.admin.token,'DELETE','/api/admin/accounts/'+f.a.userId,{operationId})).json().id,receipt.id);
 const db=new DatabaseSync(join(f.directory,'mote.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=?').get(f.a.userId)!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM pd_captures WHERE user_id=?').get(f.b.userId)!.n,1);}finally{db.close();}
});

test('portable receipt paging is owner/query/epoch qualified through 205 cancelled operations',async t=>{
 const f=await fixture(t),ids=new Set<string>();
 for(let i=0;i<205;i++){const id=randomUUID();ids.add(id);assert.equal((await f.request(f.a.token,'POST','/api/portable/exports',{operationId:id})).statusCode,200);assert.equal((await f.request(f.a.token,'POST','/api/portable/exports/'+id+'/cancel',{})).statusCode,200);}
 let cursor:string|undefined,seen=new Set<string>(),firstCursor:string|undefined;
 do{const page=await f.request(f.a.token,'GET','/api/portable/exports?limit=31'+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.equal(page.statusCode,200,page.body);for(const item of page.json().items){assert.equal(item.userId,f.a.userId);assert.equal(item.state,'cancelled');assert.ok(ids.has(item.id));assert.ok(!seen.has(item.id));seen.add(item.id);}cursor=page.json().nextCursor;if(!firstCursor)firstCursor=cursor;}while(cursor);
 assert.equal(seen.size,205);assert.ok(firstCursor);
 assert.deepEqual((await f.request(f.b.token,'GET','/api/portable/exports')).json().items,[]);
 assert.equal((await f.request(f.b.token,'GET','/api/portable/exports?limit=31&cursor='+encodeURIComponent(firstCursor!))).statusCode,400);
 assert.equal((await f.request(f.a.token,'GET','/api/portable/exports?limit=30&cursor='+encodeURIComponent(firstCursor!))).statusCode,400);
 assert.equal((await f.request(f.a.token,'GET','/api/portable/exports?userId='+f.b.userId)).statusCode,401);
 const web=await f.request(undefined,'POST','/api/auth/login',{username:'generated-alice',password,mode:'web'}),cookie=String(web.headers['set-cookie']).split(';')[0];
 assert.equal((await f.request(undefined,'POST','/api/portable/exports',{operationId:randomUUID()},{cookie,'x-mote-session-id':web.json().credentialId})).statusCode,403);
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
