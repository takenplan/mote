import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

test('original generic import entry keeps a durable private preview before exact confirmation and idempotent publication',async t=>{
 const f=await scopedFilesFixture(t),bytes=Buffer.from('Generated A import evidence. Literal author is not inferred.'),id=randomUUID();
 await f.checked(f.a.token,'/api/import-uploads','POST',{id,name:'generated/evidence.txt',sizeBytes:bytes.length,mimeType:'text/plain'});
 const part=await f.request(f.a.token,'/api/import-uploads/'+id+'/parts/0','PUT',bytes,{'content-type':'application/octet-stream'});assert.equal(part.statusCode,200,part.body);
 const file=await f.checked(f.a.token,'/api/import-uploads/'+id+'/commit','POST',{}),request={requestId:randomUUID(),name:'Generated import',archivedFileIds:[file.id],processing:'preview'};
 const created=await f.request(f.a.token,'/api/imports','POST',request);assert.equal(created.statusCode,202,created.body);const job=created.json();
 await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/imports/'+job.id)).status==='awaiting_confirmation',()=>'import preview did not settle');
 const preview=await f.checked(f.a.token,'/api/imports/'+job.id);assert.equal(preview.preview.count,1);assert.equal(preview.progress.imported,0);assert.match(preview.preview.samples[0].text,/Generated A import evidence/);
 assert.equal((await f.request(f.b.token,'/api/imports/'+job.id)).statusCode,404);
 assert.equal((await f.request(f.b.token,'/api/imports/'+job.id+'/confirm','POST',{})).statusCode,404);
 assert.equal((await f.request(f.a.token,'/api/imports','POST',{...request,name:'changed'})).statusCode,409);
 assert.equal((await f.checked(f.a.token,'/api/imports')).items.filter((row:any)=>row.id===job.id).length,1);
 assert.equal((await f.request(f.a.token,'/api/imports/'+job.id+'/confirm','POST',{})).statusCode,202);
 await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/imports/'+job.id)).status==='completed',()=>'confirmed import did not settle');
 const complete=await f.checked(f.a.token,'/api/imports/'+job.id);assert.equal(complete.progress.imported,1);assert.equal(complete.captureIds.length,1);
 assert.equal((await f.request(f.a.token,'/api/imports/'+job.id+'/confirm','POST',{})).statusCode,202);
 assert.equal((await f.checked(f.a.token,'/api/imports/'+job.id)).captureIds.length,1);
});
