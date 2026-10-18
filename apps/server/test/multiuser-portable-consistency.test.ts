import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import type {TaskRun} from '../src/scope/task-execution.js';

type Fixture=Awaited<ReturnType<typeof scopedMemoryFixture>>;
async function idle(f:Fixture){for(let attempt=0;attempt<1000;attempt++){if(!f.read(db=>db.prepare("SELECT id FROM execution_steps WHERE state='running' OR(state='waiting' AND coalesce(error,'')<>'memory_window_pending') LIMIT 1").get()))return;await delay(5);}assert.fail('Generated tasks did not settle');}
async function settled(f:Fixture,kind:'exports'|'imports',id:string,token=f.a.token){
 for(let attempt=0;attempt<500;attempt++){const response=await f.request(token,'/api/portable/'+kind+'/'+id);assert.equal(response.statusCode,200,response.body);if(response.json().state!=='working')return response.json();await delay(5);}assert.fail('Generated portable operation did not settle');
}
async function exported(f:Fixture,token=f.a.token){await idle(f);const response=await f.request(token,'/api/export');assert.equal(response.statusCode,200,response.body);return {id:String(response.headers['x-mote-operation-id']),archive:response.json(),bytes:response.rawPayload};}
function holdActualMemoryExport(f:Fixture){
 const entry=(f.node.services as any).users.get('memory'),original=entry.lifecycle.exportUser;
 let entered!:()=>void,release!:()=>void;const ready=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve);
 entry.lifecycle.exportUser=async(subject:any)=>{const result=await original(subject);if(subject.userId===f.a.userId){entered();await gate;}return result;};
 f.beforeClose(()=>release());return {ready,release};
}
for(const kind of ['exports','imports'] as const)for(const changingOwner of ['A','B'] as const)test('production '+kind+' fences exact A dependencies while '+changingOwner+' writes through HTTP during actual Memory preflight',async t=>{
 const f=await scopedMemoryFixture(t);await f.upload(f.a,'A');const saved=await exported(f),gate=holdActualMemoryExport(f),id=randomUUID();
 const pending=kind==='exports'?f.request(f.a.token,'/api/export'):undefined;
 if(kind==='imports'){const started=await f.request(f.a.token,'/api/portable/imports','POST',{operationId:id,archive:saved.archive});assert.equal(started.statusCode,200,started.body);}await gate.ready;
 const token=changingOwner==='A'?f.a.token:f.b.token;
 if(changingOwner==='B'){await f.upload(f.b,'B','generated-concurrent-B');f.read(db=>db.prepare("UPDATE pd_sources SET json=json_set(json,'$.name','Generated B other connection') WHERE user_id=? AND id='same-source'").run(f.b.userId));}
 else{const changed=await f.request(token,'/api/sources/same-source','PATCH',{name:'Generated changed A source'});assert.equal(changed.statusCode,200,changed.body);}
 gate.release();if(pending){const response=await pending;assert.equal(response.statusCode,changingOwner==='A'?409:200,response.body);}else{const receipt=await settled(f,'imports',id);assert.equal(receipt.state,changingOwner==='A'?'failed':'completed',JSON.stringify(receipt));if(changingOwner==='A')assert.equal(receipt.error,'archive_changed');assert.equal((await f.request(f.b.token,'/api/portable/imports/'+id)).statusCode,404);}
});
for(const removal of ['capture','forget','source'] as const)test('fresh full-account delivery excludes '+removal+' after restart; B and downloaded offline bytes survive',async t=>{
 const f=await scopedMemoryFixture(t),a=await f.upload(f.a,'A'),b=await f.upload(f.b,'B'),aSaved=await exported(f),bSaved=await exported(f,f.b.token),captureId=a.captures[0].id,offline=Buffer.from(aSaved.bytes);
 if(removal==='forget'){const detail=await f.request(f.a.token,'/api/files/'+captureId);assert.equal(detail.statusCode,200,detail.body);const removed=await f.request(f.a.token,'/api/files/'+captureId,'DELETE',{operationId:randomUUID(),originalGeneration:detail.json().originalGeneration});assert.equal(removed.statusCode,200,removed.body);}
 else{const removed=await f.request(f.a.token,removal==='capture'?'/api/captures/'+captureId:'/api/sources/same-source','DELETE');assert.equal(removed.statusCode,200,removed.body);}
 const assertErased=async()=>{const content=await exported(f);assert.ok(!content.archive.domains.find((domain:any)=>domain.domain==='private-data').payload.captures.some((row:any)=>row.id===captureId));assert.equal(f.read(db=>db.prepare('SELECT COUNT(*) n FROM lifecycle_exports').get()!.n),0);assert.equal((await f.request(f.a.token,'/api/captures/'+captureId)).statusCode,404);assert.equal((await f.request(f.b.token,'/api/captures/'+b.captures[0].id)).statusCode,200);assert.deepEqual(aSaved.bytes,offline);assert.equal((await exported(f,f.b.token)).archive.userId,bSaved.archive.userId);};
 await assertErased();await f.restart();await assertErased();
});

test('A task progress excluded from portable data does not invalidate A export while provider preflight is held',async t=>{
 const f=await scopedMemoryFixture(t);await f.upload(f.a,'A');await idle(f);
 let run:TaskRun|undefined,releaseTask!:()=>void;const taskGate=new Promise<void>(resolve=>releaseTask=resolve);f.beforeClose(()=>releaseTask());
 f.node.execution!.register({kind:'generated.portable-progress',pool:'generated.portable-progress',policy:EXECUTION_POLICIES.deterministic,concurrency:()=>1,parseInput:value=>value as Record<string,unknown>,execute:async current=>{run=current;await taskGate;return {};}});
 const task=await f.request(f.a.token,'/api/tasks','POST',{operationId:randomUUID(),kind:'generated.portable-progress',input:{}});assert.equal(task.statusCode,200,task.body);
 for(let attempt=0;!run&&attempt<1000;attempt++)await delay(5);assert.ok(run);
 const gate=holdActualMemoryExport(f),pending=f.request(f.a.token,'/api/export');await gate.ready;
 run.progress({stage:'Generated unrelated progress'});gate.release();const response=await pending;assert.equal(response.statusCode,200,response.body);releaseTask();
});

for(const expiry of ['release','deadline'] as const)test('direct delivery excludes snapshot bytes after '+expiry+' while metadata and B survive maintenance',async t=>{
 const f=await scopedMemoryFixture(t);await f.upload(f.a,'A','generated-archive');
 assert.equal((await f.request(f.a.token,'/api/sources/same-source','PATCH',{retention:'snapshot'})).statusCode,200);
 const bytes=Buffer.from('Generated uniquely expiring snapshot bytes'),sha256=createHash('sha256').update(bytes).digest('hex');
 const opened=await f.request(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'generated-snapshot',revision:{sourceId:'same-source',previousRevision:null,item:{externalId:'generated-snapshot',revision:'r1',observedAt:'2026-10-18T00:00:00Z',title:'Generated snapshot',text:'',kind:'file',layer:'snapshot',mimeType:'text/plain',document:{fileIndex:{version:1,fileId:'generated-snapshot',contentVersion:sha256,mode:'index',coverage:'none',parser:'central-pending',status:'pending',totalCharacters:0,offset:0,length:0,maxIndexCharacters:8000,allowRead:false}}},relativePath:'generated-snapshot.txt',sizeBytes:bytes.length,sha256}});assert.equal(opened.statusCode,200,opened.body);
 assert.equal((await f.request(f.a.token,'/api/ingress/uploads/'+opened.json().id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:sha256})).statusCode,200);
 const committed=await f.request(f.a.token,'/api/ingress/uploads/'+opened.json().id+'/commit','POST',{});assert.equal(committed.statusCode,200,committed.body);
 const snapshot=committed.json(),original=snapshot.captures[0].original,aSaved=await exported(f);
 assert.ok(f.read(db=>db.prepare('SELECT expires FROM ig_snapshot_inputs WHERE user_id=? AND original_id=?').get(f.a.userId,original.ref.slice(9))));
 await f.upload(f.b,'B');const bSaved=await exported(f,f.b.token),context=await f.node.authority.authenticate(f.a.token),ingress=f.node.ingress.forUser(context);
 if(expiry==='release')ingress.releaseSnapshot(original.ref);
 else f.read(db=>db.prepare('UPDATE ig_snapshot_inputs SET expires=0 WHERE user_id=? AND original_id=?').run(f.a.userId,original.ref.slice(9)));
 const gc=await f.request(f.a.token,'/api/ingress/gc','POST',{});assert.equal(gc.statusCode,200,gc.body);
 const fresh=await exported(f);assert.ok(!fresh.bytes.includes(Buffer.from(bytes.toString('base64'))));assert.equal(f.read(db=>db.prepare('SELECT COUNT(*) n FROM lifecycle_exports').get()!.n),0);
 assert.equal((await f.request(f.a.token,'/api/captures/'+snapshot.captures[0].id)).statusCode,200,'snapshot metadata survives its original deadline');
 assert.equal((await exported(f,f.b.token)).archive.userId,bSaved.archive.userId);
 await f.restart();assert.ok(!(await exported(f)).bytes.includes(Buffer.from(bytes.toString('base64'))));
});

test('B deleting an identical capture ID does not make A portable merge conflict with B journal',async t=>{
 const f=await scopedMemoryFixture(t),a=await f.upload(f.a,'A'),b=await f.upload(f.b,'B'),saved=await exported(f);assert.equal(a.captures[0].id,b.captures[0].id);
 const removed=await f.request(f.b.token,'/api/captures/'+b.captures[0].id,'DELETE');assert.equal(removed.statusCode,200,removed.body);
 const id=randomUUID(),started=await f.request(f.a.token,'/api/portable/imports','POST',{operationId:id,archive:saved.archive});assert.equal(started.statusCode,200,started.body);assert.equal((await settled(f,'imports',id)).state,'completed');
 assert.equal((await f.request(f.a.token,'/api/captures/'+a.captures[0].id)).statusCode,200);assert.equal((await f.request(f.b.token,'/api/captures/'+b.captures[0].id)).statusCode,404);
});
