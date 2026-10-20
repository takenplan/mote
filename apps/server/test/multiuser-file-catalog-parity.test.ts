import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

test('real file revisions retain the archive after origin deletion or reference replacement, without renewing processing authority',async t=>{
 const f=await scopedFilesFixture(t),a=await f.upload(f.a.token,'same-history','GENERATED_A_ARCHIVE'),b=await f.upload(f.b.token,'same-history','GENERATED_B_ARCHIVE');assert.equal(a.id,b.id);
 const task=await f.checked(f.a.token,'/api/processing','POST',{originalRef:a.original.ref,operationId:'history-extract'});
 await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/tasks/'+task.id)).state==='succeeded',()=> 'archive extraction');
 const revision=async(token:string,deleted:boolean,previousRevision:string,layer='original')=>{
  const upload=await f.checked(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'history-'+layer+'-'+deleted,revision:{sourceId:'same-source',previousRevision,relativePath:'projects/alpha/note.txt',sizeBytes:18,item:{externalId:'same-history',revision:deleted?'r2':'r3',observedAt:deleted?'2026-10-17T00:00:00Z':'2026-10-18T00:00:00Z',title:'note.txt',text:'',kind:'file',layer,mimeType:'text/plain',deleted}}});
  return (await f.checked(token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{})).captures[0];
 };
 await revision(f.a.token,true,'same-r1');
 const afterDelete=await f.checked(f.a.token,'/api/files');assert.deepEqual(afterDelete.items.map((x:any)=>x.captureId),[a.id]);assert.equal(afterDelete.items[0].originMissing,true);assert.equal(afterDelete.items[0].processing.current,false);
 const verifyArchive=async()=>{
  const detail=await f.checked(f.a.token,'/api/files/'+a.id);assert.equal(detail.hasOriginal,true);assert.equal(detail.processing.current,false);
  assert.equal((await f.checked(f.a.token,'/api/files/'+a.id+'/chunks')).items.map((x:any)=>x.ocrText).join(''),'GENERATED_A_ARCHIVE');
  const playback=await f.checked(f.a.token,'/api/files/'+a.id+'/playback','POST',{});assert.equal((await f.request(f.a.token,playback.url)).body,'GENERATED_A_ARCHIVE');
  const exported=await f.request(f.a.token,'/api/files/'+a.id+'/export');assert.equal(exported.statusCode,200,exported.body);assert.ok(gunzipSync(exported.rawPayload).includes(Buffer.from('GENERATED_A_ARCHIVE')));
  assert.ok([401,409].includes((await f.request(f.a.token,'/api/processing','POST',{originalRef:a.original.ref,operationId:'retired-cannot-execute'})).statusCode));return playback.url;
 };
 await verifyArchive();
 await f.checked(f.a.token,'/api/sources/same-source','PATCH',{retention:'reference'});
 const reference=await revision(f.a.token,false,'r2','reference');const listed=await f.checked(f.a.token,'/api/files?query=ALPHA');assert.deepEqual(listed.items.map((x:any)=>x.captureId),[reference.id]);assert.equal(listed.items[0].hasOriginal,false);assert.equal(listed.items[0].processing.processingRequired,false);assert.equal(listed.items[0].sizeBytes,18);assert.equal(listed.items[0].originMissing,false);assert.equal(listed.items[0].item.document.path,'projects/alpha/note.txt');
 const history=await f.checked(f.a.token,'/api/sources/same-source/history?externalId=same-history');assert.ok(history.items.some((item:any)=>item.captureId===a.id&&!item.current),'the existing source history entry rediscovers the retained archive');const oldTicket=await verifyArchive();await f.restart();await verifyArchive();assert.equal((await f.checked(f.a.token,'/api/files?query=alpha')).items[0].captureId,reference.id);
 const generation=(await f.checked(f.a.token,'/api/files/'+reference.id)).originalGeneration;
 await f.checked(f.a.token,'/api/files/'+reference.id,'DELETE',{operationId:'forget-catalog',originalGeneration:generation});
 for(const id of [a.id,reference.id])for(const path of ['', '/export'])assert.equal((await f.request(f.a.token,'/api/files/'+id+path)).statusCode,404);
 assert.equal((await f.request(f.a.token,oldTicket)).statusCode,404);assert.deepEqual((await f.checked(f.a.token,'/api/files')).items,[]);
 assert.equal((await f.checked(f.b.token,'/api/files/'+b.id)).hasOriginal,true);const ticket=await f.checked(f.b.token,'/api/files/'+b.id+'/playback','POST',{});assert.equal((await f.request(f.b.token,ticket.url)).body,'GENERATED_B_ARCHIVE');
 await f.restart();assert.equal((await f.request(f.a.token,'/api/files/'+a.id)).statusCode,404);
});

test('metadata-only catalog and historical archive do not break actual policy preview or enter reprocessing',async t=>{
 const f=await scopedFilesFixture(t),settings=await f.checked(f.a.token,'/api/file-processing'),policy={version:1,services:[],profiles:[{id:'text',name:'Generated text',processorId:'text.utf8',parameters:{},summarize:false},{id:'archive',name:'Generated archive',processorId:'archive',parameters:{},summarize:false}],rules:[{type:'text/*',profileId:'text'},{type:'*/*',profileId:'archive'}]};
 await f.checked(f.a.token,'/api/file-processing','PUT',{revision:settings.revision,settings:{...settings.settings,automatic:false},policy});
 const current=await f.upload(f.a.token,'current','GENERATED_CURRENT'),historical=await f.upload(f.a.token,'retired','GENERATED_RETIRED');
 const tombstone=await f.checked(f.a.token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'retired-tombstone',revision:{sourceId:'same-source',previousRevision:'same-r1',relativePath:'retired.txt',sizeBytes:0,item:{externalId:'retired',revision:'r2',observedAt:'2026-10-17T00:00:00Z',title:'retired.txt',text:'',kind:'file',layer:'original',mimeType:'text/plain',deleted:true}}});await f.checked(f.a.token,'/api/ingress/uploads/'+tombstone.id+'/commit','POST',{});
 await f.checked(f.a.token,'/api/ingress/sources','POST',{id:'references',name:'References',kind:'local-files',deviceId:'same-device',platform:'import',retention:'reference'});
 for(const actor of [f.a,f.b]){
  if(actor===f.b)await f.checked(actor.token,'/api/ingress/sources','POST',{id:'references',name:'References',kind:'local-files',deviceId:'same-device',platform:'import',retention:'reference'});
  const result=await f.checked(actor.token,'/api/ingress/sources/references/items','POST',{batchId:'same-reference',items:[{externalId:'same-ref',revision:'r1',observedAt:'2026-10-16T00:00:00Z',title:actor===f.a?'A reference':'B reference',text:'',kind:'file',layer:'reference',mimeType:'text/plain',document:{path:'projects/alpha/reference.txt'},metadata:{version:1,file:{sizeBytes:33}}}]});
  const ref=result.captures[0];const detail=await f.checked(actor.token,'/api/files/'+ref.id);assert.equal(detail.hasOriginal,false);assert.equal(detail.originalRef,undefined);assert.deepEqual(detail.cancellation,{canCancel:false,wait:null});
  assert.equal((await f.request(actor.token,'/api/files/'+ref.id+'/playback','POST',{})).statusCode,404);assert.equal((await f.request(actor.token,'/api/files/'+ref.id+'/export')).statusCode,404);
 }
 const first=await f.checked(f.a.token,'/api/files?limit=1');assert.ok(first.nextCursor);assert.equal((await f.request(f.b.token,'/api/files?limit=1&cursor='+encodeURIComponent(first.nextCursor))).statusCode,400);
 const page=await f.checked(f.a.token,'/api/file-processing'),preview=await f.checked(f.a.token,'/api/file-processing/preview','POST',{revision:page.revision,type:'text/*'});assert.equal(preview.count,1);assert.equal(preview.skipped,2);assert.equal(preview.items[0].id,current.id);
 const admitted=await f.checked(f.a.token,'/api/file-processing/reprocess','POST',{token:preview.token});assert.equal(admitted.queued,1);
 await waitForScopedState(async()=>(await f.checked(f.a.token,'/api/files/'+current.id)).processing.indexed,()=> 'current file reprocess');assert.equal((await f.checked(f.a.token,'/api/files/'+historical.id)).processing.processed,false);
 await f.restart();assert.equal((await f.checked(f.a.token,'/api/files?query=alpha')).items[0].hasOriginal,false);
});
