import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {generatedFixedSourcePack,generatedFixedSourcePackMetadata,generatedFixedSourcePackParentText,generatedFixedSourcePackSkip,generatedFixedSourcePackWave} from './fixtures/generated-fixed-source-pack.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

for(const mode of ['loose','zip'] as const)test('configured fixed pack receives complete '+mode+' inputs and retains genuine audio as its parent attachment',{skip:generatedFixedSourcePackSkip},async t=>{
 const {f,spec,uploadInputs,importPreview,confirmImport}=await generatedFixedSourcePack(t),files=await uploadInputs(f.a,mode);
 const preview=await importPreview(f.a,files);assert.equal(preview.sourcePackId,spec.id);assert.equal(preview.preview!.count,1);assert.equal(preview.preview!.samples[0].attachmentCount,1);
 assert.equal(preview.preview!.samples[0].text,generatedFixedSourcePackParentText);assert.equal(preview.captureIds.length,0);assert.equal(preview.progress.imported,0);
 assert.equal(preview.files.length,mode==='zip'?4:3);assert.equal(preview.archive.expandedFiles,mode==='zip'?3:0);
 const {processing:processingCount,...counts}=preview.dispositions!.counts;assert.deepEqual(counts,{parsed:1,attachment:1,container:mode==='zip'?1:0,excluded:1,unsupported:0});assert.equal(processingCount??0,0);
 assert.equal(preview.media?.length??0,0,'explicit pack attachments cannot also become independent host media');
 assert.equal(new Set(preview.dispositions!.items.map(item=>item.fileId)).size,preview.files.length,'every supplied original is accounted for exactly once');
 const audio=preview.files.find(file=>file.name==='audio.wav')!,metadata=preview.files.find(file=>file.name==='.DS_Store')!;assert.ok(audio);assert.ok(metadata);
 assert.deepEqual((await f.request(f.a.token,'/api/archived-files/'+audio.id+'/content')).rawPayload,generatedFixedSourcePackWave);
 assert.deepEqual((await f.request(f.a.token,'/api/archived-files/'+metadata.id+'/content')).rawPayload,generatedFixedSourcePackMetadata);
 assert.equal((await f.request(f.b.token,'/api/archived-files/'+audio.id+'/content')).statusCode,404);
 assert.ok((await f.checked(f.a.token,'/api/tasks?limit=100')).items.every((task:any)=>task.kind!=='processing.asr'),'private preview has no ASR child');
 const complete=await confirmImport(f.a,preview.id);assert.equal(complete.captureIds.length,1);assert.equal(complete.progress.total,1);assert.equal(complete.progress.imported,1);assert.equal(complete.media?.length??0,0);
 const parentId=complete.captureIds[0],parent=await f.checked(f.a.token,'/api/captures/'+parentId),document=parent.provenance.document;
 const originals=await f.checked(f.a.token,'/api/ingress/sources/'+complete.sourceId+'/originals'),parentOriginal=originals.items.find((item:any)=>item.captureId===parentId);assert.ok(parentOriginal);const originalPath='/api/ingress/originals/'+parentOriginal.ref.slice(9),parentTicket=await f.checked(f.a.token,originalPath+'/tickets','POST',{mode:'download'}),parentBody=await f.checked(f.a.token,originalPath+'/content?ticket='+encodeURIComponent(parentTicket.ticket));
 assert.equal(parentBody.text,generatedFixedSourcePackParentText);assert.deepEqual(document.attachments.map((file:any)=>file.id),[audio.id]);
 assert.deepEqual(new Set(document.originalMetadata.packInputPaths),new Set(preview.files.map(file=>file.relativePath)));
 assert.deepEqual(document.originalMetadata.packInputHashes,Object.fromEntries(preview.files.map(file=>[file.relativePath,file.hash])));
 const archived=await f.checked(f.a.token,'/api/captures/'+parentId+'/archived-files');assert.deepEqual(new Set(archived.items.map((file:any)=>file.id)),new Set([audio.id,preview.files.find(file=>file.name==='parent.txt')!.id]));
 const settings=await f.checked(f.a.token,'/api/configuration'),processing=settings.domains.find((domain:any)=>domain.id==='processing').effective;
 assert.equal(processing.automatic,false);await f.checked(f.a.token,'/api/configuration/processing','PUT',{revision:settings.revision,value:{...processing,enabled:false}});
 const path='/api/records/'+parentId+'/attachments/'+audio.id+'/processing',admitted=await f.checked(f.a.token,path,'POST',{mimeType:'audio/wav'}),detail=await f.checked(f.a.token,'/api/files/'+admitted.captureId);
 const original='/api/ingress/originals/'+detail.originalRef.slice(9),ticket=await f.checked(f.a.token,original+'/tickets','POST',{mode:'download'}),download=await f.request(f.a.token,original+'/content?ticket='+encodeURIComponent(ticket.ticket));
 assert.equal(download.statusCode,200,download.body);assert.deepEqual(download.rawPayload,generatedFixedSourcePackWave);assert.equal(createHash('sha256').update(download.rawPayload).digest('hex'),audio.hash);
 assert.ok((await f.checked(f.a.token,'/api/tasks?limit=100')).items.every((task:any)=>task.kind!=='processing.asr'),'confirmation and disabled attachment preparation do not authorize ASR');
 assert.equal((await f.request(f.b.token,path,'POST',{mimeType:'audio/wav'})).statusCode,404);
});

test('a configured pack cannot attach an original it marks excluded in its reviewed manifest',{skip:generatedFixedSourcePackSkip},async t=>{
 const {f,spec,uploadInputs}=await generatedFixedSourcePack(t,{invalidAttachmentDisposition:true}),files=await uploadInputs(f.a),created=await f.request(f.a.token,'/api/imports','POST',{requestId:randomUUID(),archivedFileIds:files.map(file=>file.id),sourcePackId:spec.id,processing:'preview'});
 assert.equal(created.statusCode,202,created.body);const id=created.json().id;let job:any;
 await waitForScopedState(async()=>{job=await f.checked(f.a.token,'/api/imports/'+id);return ['failed','needs_configuration'].includes(job.status);},()=>JSON.stringify(job),15000);
 assert.equal(job.preview,undefined);assert.equal(job.captureIds.length,0);assert.equal(job.progress.imported,0);assert.equal(job.progress.total,0);
 assert.equal((await f.request(f.a.token,'/api/imports/'+id+'/confirm','POST',{})).statusCode,409);
 assert.ok((await f.checked(f.a.token,'/api/tasks?limit=100')).items.every((task:any)=>task.kind!=='processing.asr'));
 for(const file of files)assert.equal((await f.request(f.a.token,'/api/archived-files/'+file.id+'/content')).rawPayload.length,file.sizeBytes,'manifest rejection retains the private original');
});

test('cancelling a fixed pack preview prevents confirmation and retains only its private originals',{skip:generatedFixedSourcePackSkip},async t=>{
 const {f,uploadInputs,importPreview}=await generatedFixedSourcePack(t),files=await uploadInputs(f.a),preview=await importPreview(f.a,files);
 const cancelled=await f.checked(f.a.token,'/api/imports/'+preview.id+'/cancel','POST',{});assert.equal(cancelled.status,'cancelled');
 assert.equal((await f.request(f.a.token,'/api/imports/'+preview.id+'/confirm','POST',{})).statusCode,409);
 const current=await f.checked(f.a.token,'/api/imports/'+preview.id);assert.equal(current.status,'cancelled');assert.deepEqual(current.captureIds,[]);assert.equal(current.progress.imported,0);
 assert.equal((await f.request(f.a.token,'/api/sources/'+preview.sourceId)).statusCode,404,'cancelled preview has not registered its source');
 assert.ok((await f.checked(f.a.token,'/api/tasks?limit=100')).items.every((task:any)=>task.kind!=='processing.asr'));
 for(const file of files)assert.equal((await f.request(f.a.token,'/api/archived-files/'+file.id+'/content')).rawPayload.length,file.sizeBytes);
});
