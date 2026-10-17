import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

const register={id:'same-source',name:'Generated replacement source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'};
const newSource=async(f:Awaited<ReturnType<typeof scopedFilesFixture>>)=>f.checked(f.a.token,'/api/ingress/sources','POST',register);

test('an unsent file delete cannot target an identical file after its source is recreated',async t=>{
 const f=await scopedFilesFixture(t),body='GENERATED_SOURCE_REPLACEMENT',a=await f.upload(f.a.token,'same-source-replacement',body),b=await f.upload(f.b.token,'same-source-replacement',body),path='/api/files/'+a.id;
 assert.equal(a.id,b.id);
 const prior=await f.checked(f.a.token,path),intent={operationId:randomUUID(),originalGeneration:prior.originalGeneration};
 const ticketPath='/api/ingress/originals/'+prior.originalRef.slice(9),ticket=await f.checked(f.a.token,ticketPath+'/tickets','POST',{});
 // Freeze a real page action before any deletion is admitted. No operation
 // receipt exists, so fixed-ACK replay cannot protect this stale first send.
 await f.checked(f.a.token,'/api/sources/same-source','DELETE',{});
 await newSource(f);await f.restart();
 const replacement=await f.upload(f.a.token,'same-source-replacement',body);assert.equal(replacement.id,a.id);
 const next=await f.checked(f.a.token,path);assert.equal((await f.request(f.b.token,'/api/files/'+b.id)).statusCode,200);
 const late=await f.request(f.a.token,path,'DELETE',intent),retained=await f.request(f.a.token,path);
 assert.equal((await f.request(f.b.token,'/api/files/'+b.id)).statusCode,200,'B stays readable after the stale A intent');
 assert.deepEqual({lateDelete:late.statusCode,replacement:retained.statusCode},{lateDelete:409,replacement:200},'a stale first-send intent must not delete a replacement source/capture; captured generations '+JSON.stringify({before:prior.originalGeneration,after:next.originalGeneration}));
 assert.ok(next.originalGeneration>prior.originalGeneration);
 assert.equal((await f.request(f.a.token,ticketPath+'/content?ticket='+encodeURIComponent(ticket.ticket))).statusCode,404,'source recreation cannot revive an old signed original ticket');
 const freshTicket=await f.checked(f.a.token,ticketPath+'/tickets','POST',{});assert.equal((await f.request(f.a.token,ticketPath+'/content?ticket='+encodeURIComponent(freshTicket.ticket))).rawPayload.toString(),body);
 const fresh=await f.checked(f.a.token,path,'DELETE',{operationId:randomUUID(),originalGeneration:next.originalGeneration});assert.equal(fresh.deleted,1);
 assert.equal((await f.request(f.b.token,'/api/files/'+b.id)).statusCode,200);
});

test('direct Capture retirement and source retirement preserve a monotonic owned file incarnation',async t=>{
 const f=await scopedFilesFixture(t),bytes=Buffer.from('GENERATED_CAPTURE_REPLACEMENT'),externalId='same-capture-replacement',a=await f.upload(f.a.token,externalId,bytes.toString()),path='/api/files/'+a.id,old=await f.checked(f.a.token,path),intent={operationId:randomUUID(),originalGeneration:old.originalGeneration};
 await f.checked(f.a.token,'/api/captures/'+a.id,'DELETE');
 // A new upload batch exercises actual intake; replaying an old batch is only
 // its fixed receipt and cannot prove that the canonical record was restored.
 const checksum=createHash('sha256').update(bytes).digest('hex'),upload=await f.checked(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:randomUUID(),revision:{sourceId:'same-source',previousRevision:null,sizeBytes:bytes.length,sha256:checksum,relativePath:externalId+'.txt',item:{externalId,revision:'same-r1',observedAt:'2026-10-16T00:00:00Z',title:externalId,text:'',kind:'file',layer:'original',mimeType:'text/plain'}}});
 await f.checked(f.a.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum});assert.equal((await f.checked(f.a.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{})).captures[0].id,a.id);
 const current=await f.checked(f.a.token,path);assert.ok(current.originalGeneration>old.originalGeneration);assert.equal((await f.request(f.a.token,path,'DELETE',intent)).statusCode,409);
 const forgotten=await f.checked(f.a.token,path,'DELETE',{operationId:randomUUID(),originalGeneration:current.originalGeneration});await f.checked(f.a.token,path+'/allow-again','POST',forgotten.decision);await f.upload(f.a.token,externalId,bytes.toString());assert.equal((await f.checked(f.a.token,path)).originalGeneration,forgotten.decision.generation,'one explicit forget advances the group once, not once per removed revision');
 await f.checked(f.a.token,'/api/sources/same-source','DELETE');await newSource(f);await f.upload(f.a.token,externalId,bytes.toString());const next=await f.checked(f.a.token,path);assert.ok(next.originalGeneration>forgotten.decision.generation);assert.equal((await f.request(f.a.token,path,'DELETE',{operationId:randomUUID(),originalGeneration:current.originalGeneration})).statusCode,409);
 assert.equal((await f.checked(f.a.token,path,'DELETE',{operationId:randomUUID(),originalGeneration:next.originalGeneration})).deleted,1);
});

test('file incarnation advancement rolls back with a failed source deletion',async t=>{
 const f=await scopedFilesFixture(t),a=await f.upload(f.a.token,'rollback-source','GENERATED_ROLLBACK'),path='/api/files/'+a.id,before=await f.checked(f.a.token,path),db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());
 // Generated SQL fault after the real source delete, in the same transaction.
 db.exec("CREATE TRIGGER generated_source_delete_fault AFTER DELETE ON pd_sources BEGIN SELECT RAISE(ABORT,'GENERATED_SOURCE_DELETE_FAULT'); END;");
 assert.equal((await f.request(f.a.token,'/api/sources/same-source','DELETE',{})).statusCode,503);assert.equal((await f.checked(f.a.token,path)).originalGeneration,before.originalGeneration);assert.equal(db.prepare('SELECT count(*) n FROM ig_file_generations WHERE user_id=?').get(f.a.userId)!.n,0);
 db.exec('DROP TRIGGER generated_source_delete_fault');await f.checked(f.a.token,'/api/sources/same-source','DELETE',{});await newSource(f);await f.upload(f.a.token,'rollback-source','GENERATED_ROLLBACK');assert.ok((await f.checked(f.a.token,path)).originalGeneration>before.originalGeneration);
});

test('account erasure removes file incarnation history without changing the other owner',async t=>{
 const f=await scopedFilesFixture(t),a=await f.upload(f.a.token,'erasure-generation','GENERATED_ERASURE_GENERATION'),b=await f.upload(f.b.token,'erasure-generation','GENERATED_ERASURE_GENERATION'),path='/api/files/'+a.id;
 await f.checked(f.a.token,'/api/sources/same-source','DELETE',{});await newSource(f);await f.upload(f.a.token,'erasure-generation','GENERATED_ERASURE_GENERATION');
 const bView=await f.checked(f.b.token,'/api/files/'+b.id),db=new DatabaseSync(join(f.directory,'mote.sqlite'));t.after(()=>db.close());assert.ok(Number(db.prepare('SELECT count(*) n FROM ig_file_generations WHERE user_id=?').get(f.a.userId)!.n)>0);
 const deletion=await f.checked(f.admin.token,'/api/admin/accounts/'+f.a.userId,'DELETE',{operationId:randomUUID()});let receipt:any;
 await waitForScopedState(async()=>{receipt=await f.checked(f.admin.token,'/api/admin/account-deletions/'+deletion.id);return receipt.state!=='working'&&receipt.state!=='pending';},()=>JSON.stringify(receipt));assert.equal(receipt.state,'completed',JSON.stringify(receipt));assert.equal(db.prepare('SELECT count(*) n FROM ig_file_generations WHERE user_id=?').get(f.a.userId)!.n,0);assert.equal((await f.request(f.a.token,path)).statusCode,401);assert.deepEqual(await f.checked(f.b.token,'/api/files/'+b.id),bView);
});
