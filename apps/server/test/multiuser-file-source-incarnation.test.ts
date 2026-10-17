import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {scopedFilesFixture} from './fixtures/scoped-files.js';

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
