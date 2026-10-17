import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {scopedFilesFixture} from './fixtures/scoped-files.js';

test('an old allow-again request cannot undo a later forget of the same exact capture',async t=>{
 const f=await scopedFilesFixture(t),bytes=Buffer.from('GENERATED_SAME_BYTES_FORGET_INCARNATION');
 const first=await f.upload(f.a.token,'same-forget-cycle',bytes.toString());
 const b=await f.upload(f.b.token,'same-forget-cycle',bytes.toString());
 assert.equal(first.id,b.id);
 const path='/api/files/'+first.id;
 const remove=async()=>f.checked(f.a.token,path,'DELETE',{operationId:randomUUID(),originalGeneration:(await f.checked(f.a.token,path)).originalGeneration});
 const forgotten=await remove(),oldBody=forgotten.decision;
 assert.equal((await f.request(f.a.token,path+'/allow-again','POST',oldBody)).statusCode,200);
 const second=await f.upload(f.a.token,'same-forget-cycle',bytes.toString());
 assert.equal(first.id,second.id,'same bytes/revision reuse the canonical capture ID');
 const current=await remove();assert.notEqual(current.decision.decisionId,oldBody.decisionId);
 const late=await f.request(f.a.token,path+'/allow-again','POST',oldBody);
 const blocked=await f.request(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{
  batchId:'generated-after-stale-allow',revision:{sourceId:'same-source',previousRevision:null,
   sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),relativePath:'same-forget-cycle.txt',
   item:{externalId:'same-forget-cycle',revision:'same-r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated same capture',text:'',kind:'file',layer:'original',mimeType:'text/plain'}}});
 assert.equal((await f.request(f.b.token,'/api/files/'+b.id)).statusCode,200);
 assert.deepEqual({decision:late.statusCode,upload:blocked.statusCode},{decision:409,upload:410},
  'a delayed duplicate must not undo the later forget or reopen its upload admission; B remains available');
});


test('an unsent file delete cannot target an identical file after its source is recreated',async t=>{
 const f=await scopedFilesFixture(t),body='GENERATED_SOURCE_REPLACEMENT',a=await f.upload(f.a.token,'same-source-replacement',body),b=await f.upload(f.b.token,'same-source-replacement',body),path='/api/files/'+a.id;
 assert.equal(a.id,b.id);
 const prior=await f.checked(f.a.token,path),intent={operationId:randomUUID(),originalGeneration:prior.originalGeneration};
 // Freeze a real page action before any deletion is admitted. No operation
 // receipt exists, so fixed-ACK replay cannot protect this stale first send.
 await f.checked(f.a.token,'/api/sources/same-source','DELETE',{});
 await f.checked(f.a.token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated replacement source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});
 const replacement=await f.upload(f.a.token,'same-source-replacement',body);assert.equal(replacement.id,a.id);
 const next=await f.checked(f.a.token,path);assert.equal((await f.request(f.b.token,'/api/files/'+b.id)).statusCode,200);
 const late=await f.request(f.a.token,path,'DELETE',intent),retained=await f.request(f.a.token,path);
 assert.equal((await f.request(f.b.token,'/api/files/'+b.id)).statusCode,200,'B stays readable after the stale A intent');
 assert.deepEqual({lateDelete:late.statusCode,replacement:retained.statusCode},{lateDelete:409,replacement:200},'a stale first-send intent must not delete a replacement source/capture; captured generations '+JSON.stringify({before:prior.originalGeneration,after:next.originalGeneration}));
 const fresh=await f.checked(f.a.token,path,'DELETE',{operationId:randomUUID(),originalGeneration:next.originalGeneration});assert.equal(fresh.deleted,1);
 assert.equal((await f.request(f.b.token,'/api/files/'+b.id)).statusCode,200);
});
