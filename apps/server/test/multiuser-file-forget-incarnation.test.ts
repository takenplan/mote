import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedFilesFixture} from './fixtures/scoped-files.js';

test('an old allow-again request cannot undo a later forget of the same exact capture',async t=>{
 const f=await scopedFilesFixture(t),bytes=Buffer.from('GENERATED_SAME_BYTES_FORGET_INCARNATION');
 const first=await f.upload(f.a.token,'same-forget-cycle',bytes.toString());
 const b=await f.upload(f.b.token,'same-forget-cycle',bytes.toString());
 assert.equal(first.id,b.id);
 const path='/api/files/'+first.id,oldBody={sourceId:'same-source',externalId:'same-forget-cycle'};
 assert.equal((await f.request(f.a.token,path,'DELETE')).statusCode,200);
 assert.equal((await f.request(f.a.token,path+'/allow-again','POST',oldBody)).statusCode,200);
 const second=await f.upload(f.a.token,'same-forget-cycle',bytes.toString());
 assert.equal(first.id,second.id,'same bytes/revision reuse the canonical capture ID');
 assert.equal((await f.request(f.a.token,path,'DELETE')).statusCode,200);
 const late=await f.request(f.a.token,path+'/allow-again','POST',oldBody);
 assert.equal(late.statusCode,409,'a delayed duplicate from the first decision must not enable the later forgotten incarnation');
 const blocked=await f.request(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{
  batchId:'generated-after-stale-allow',revision:{sourceId:'same-source',previousRevision:null,
   sizeBytes:bytes.length,sha256:first.original.hash,relativePath:'same-forget-cycle.txt',
   item:{externalId:'same-forget-cycle',revision:'same-r1',observedAt:'2026-10-16T00:00:00Z',title:'Generated same capture',text:'',kind:'file',layer:'original',mimeType:'text/plain'}}});
 assert.equal(blocked.statusCode,410);
 assert.equal((await f.request(f.b.token,'/api/files/'+b.id)).statusCode,200);
});
