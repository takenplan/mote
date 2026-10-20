import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createServer} from 'node:http';
import {scopedCaptureFixture} from './fixtures/scoped-capture-host.js';
import {waitForScopedState} from './fixtures/scoped-process.js';
import {defaultProcessingSettings} from '../src/scope/processing-schema.js';
import {defaultMemorySettings} from '../src/scope/memory-schema.js';
import {defaultModelSettings} from '../src/model-settings.js';
import {historyRespond} from './fixtures/history-ask-fixture.js';
import {recordingMemoryRecipe} from '../src/connectors/recording-memory.js';
import {VendorState,recordingId,initial,fixture} from './fixtures/multiuser-recording-revision-parity-suite.js';

test('a multi-paragraph recording has one canonical owned semantic input, with exact segment locators into its retained export',async t=>{
 const {f,states,checked,run,page,heads,projection,originals,bytes}=await fixture(t,false,true);
 for(const actor of [f.a,f.b]){
  const current=await heads(actor.token),speech=current.filter(item=>item.externalId!==recordingId+':audio');
  assert.deepEqual(speech.map(item=>item.externalId),[recordingId+':export'],'individual segments must not become parallel semantic producers');
  const projected=await projection(actor.token);assert.equal(projected.materials.length,1,'the entire recording remains one Material and one Memory input');
  const material=await checked(actor.token,'/api/materials/'+projected.materials[0].id),state=states.get(actor.userId)!,members=await checked(actor.token,'/api/materials/'+material.id+'/members');
  assert.deepEqual(members.items.map((member:any)=>member.ref),['capture:'+speech[0].captureId]);assert.equal(material.blockCount,3);
  assert.equal((await checked(actor.token,'/api/materials/'+material.id+'/read')).text,state.paragraphs.map(row=>row.paragraph).join('\n'));
  const preview=await checked(actor.token,'/api/memory/materials/'+material.id+'?'+new URLSearchParams({revision:material.revision,recipes:JSON.stringify([recordingMemoryRecipe])}));assert.equal(preview.status,'ready');assert.equal(preview.evidenceIds.length,3);
  const source=(await page(actor.token)).sourceId,original=(await originals(actor.token)).find(item=>item.captureId===speech[0].captureId);assert.ok(original);
  const raw=JSON.parse((await bytes(actor.token,original.ref)).toString());assert.equal(raw.taskUuid,recordingId);assert.deepEqual(raw.paragraphList,state.paragraphs);
  const chunks=await checked(actor.token,'/api/files/'+speech[0].captureId+'/chunks?offset=0');assert.equal(chunks.items.length,3);
  assert.deepEqual(chunks.items.map((chunk:any)=>chunk.ocrText),state.paragraphs.map(row=>row.paragraph));assert.deepEqual(chunks.items.map((chunk:any)=>chunk.fileEvidence.documentLocation),state.paragraphs.map((row,index)=>({rowNumber:index+1,offset:0,length:String(row.paragraph).length})));assert.ok(chunks.items.every((chunk:any)=>chunk.fileEvidence.speaker==='Generated speaker'&&chunk.fileEvidence.uncertain===true));
  const settings=await checked(actor.token,'/api/memory/recipe-settings?sourceId='+source);assert.equal(settings.inherited,false);assert.deepEqual(settings.items.map((item:any)=>item.binding.recipe),[recordingMemoryRecipe]);
  const installed=(await checked(actor.token,'/api/memory/recipes')).items.find((item:any)=>item.id===recordingMemoryRecipe.id&&item.version===recordingMemoryRecipe.version);assert.ok(installed?.available);assert.equal(installed.binding.extract.id,'mote.recording-extraction');assert.equal(installed.binding.review.id,'mote.recording-review');
  const recipeRef=(pin:{id:string;version:string})=>({id:pin.id,version:pin.version}),frozen=f.read(db=>db.prepare('SELECT json FROM mm_capture_intakes WHERE user_id=? AND capture_id=?').get(actor.userId,speech[0].captureId));assert.ok(frozen);assert.deepEqual(JSON.parse(String(frozen.json)).strategies.map((strategy:any)=>recipeRef(strategy.recipe)),[recordingMemoryRecipe]);
  const intakes=f.read(db=>db.prepare('SELECT material_id,json FROM mm_intakes WHERE user_id=?').all(actor.userId));assert.equal(intakes.length,1,'one whole-recording semantic producer admits one dedicated recording intake');assert.equal(intakes[0].material_id,material.id);assert.deepEqual(recipeRef(JSON.parse(String(intakes[0].json)).strategy.recipe),recordingMemoryRecipe);
  assert.equal((await f.request(actor===f.a?f.b.token:f.a.token,'/api/files/'+speech[0].captureId)).statusCode,404);
  const override=defaultMemorySettings().recipe;await checked(actor.token,'/api/memory/recipe-settings','PUT',{sourceId:source,revision:settings.revision,recipes:[override]});await run(actor.token,'operations',{operation:'connect'});assert.deepEqual((await checked(actor.token,'/api/memory/recipe-settings?sourceId='+source)).items.map((item:any)=>item.binding.recipe),[override],'reconnecting an existing source preserves the owner-selected override');assert.equal(f.read(db=>db.prepare('SELECT count(*) n FROM mm_intakes WHERE user_id=?').get(actor.userId)!.n),1,'a default/override save never automatically replays historical Material');
  assert.ok(source);
 }
});

test('confirmed audio backups survive selection epochs and restart without new media calls or cross-account reuse',async t=>{
 const {f,states,checked,run,page,heads,calls}=await fixture(t),beforeA=await heads(f.a.token),beforeB=await heads(f.b.token),audio=beforeA.find(item=>item.externalId===recordingId+':audio');assert.ok(audio);
 const mediaCalls=(userId:string)=>calls.filter(call=>call.userId===userId&&call.kind==='media').length;
 const aCalls=mediaCalls(f.a.userId),bCalls=mediaCalls(f.b.userId);
 // The user's background preference and range are work authorization changes,
 // not a request to download an already confirmed recording again.
 await run(f.a.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-16T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:true,backupAudio:true}});await run(f.a.token,'sync');
 assert.equal(mediaCalls(f.a.userId),aCalls);assert.equal((await page(f.a.token)).items[0].audioCaptureId,audio.captureId);
 await f.restart();await run(f.a.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-15T00:00:00Z',end:'2026-10-18T00:00:00Z',autoSync:false,backupAudio:true}});await run(f.a.token,'sync');
 assert.equal(mediaCalls(f.a.userId),aCalls);assert.equal((await page(f.a.token)).items[0].audioCaptureId,audio.captureId);assert.equal(mediaCalls(f.b.userId),bCalls);assert.deepEqual(await heads(f.b.token),beforeB);
 // An actual vendor account change gets a new source and its own media fact,
 // even when the provider exposes the same recording ID and identical bytes.
 states.get(f.a.userId)!.vendorUser='generated-different-vendor-user';await run(f.a.token,'operations',{operation:'connect'});await run(f.a.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-16T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:false,backupAudio:true}});await run(f.a.token,'sync');
 assert.equal(mediaCalls(f.a.userId),aCalls+1);assert.notEqual((await page(f.a.token)).items[0].audioCaptureId,audio.captureId);
 const newAudio=(await page(f.a.token)).items[0].audioCaptureId,playback=await checked(f.a.token,'/api/files/'+newAudio+'/playback','POST',{});assert.equal((await f.request(f.a.token,playback.url)).statusCode,200);assert.equal((await f.request(f.b.token,'/api/files/'+newAudio)).statusCode,404);
});

test('Files forget during an admitted media download rejects its late archive while the equal recording in B remains available',async t=>{
 let entered!:()=>void,release!:()=>void;const entry=new Promise<void>(resolve=>entered=resolve),wait=new Promise<void>(resolve=>release=resolve);t.after(()=>release());
 const {f,states,checked,run,page,heads,originals,bytes,calls}=await fixture(t),aPage=await page(f.a.token),originalAudio=(await heads(f.a.token)).find(item=>item.externalId===recordingId+':audio'),bAudio=(await page(f.b.token)).items[0].audioCaptureId;assert.ok(originalAudio);
 const raw=(await originals(f.a.token)).find(item=>item.captureId===originalAudio.captureId);assert.ok(raw);const wave=await bytes(f.a.token,raw.ref),sha256=createHash('sha256').update(wave).digest('hex');
 // Even copied provider metadata cannot confer the host's trusted backup format.
 // This ordinary owner revision remains playable, while the connector acquires its
 // actual provider backup. Disabling automatic processing avoids unrelated ASR
 // for this deliberately ordinary audio upload.
 const configuration=await checked(f.a.token,'/api/configuration');await checked(f.a.token,'/api/configuration/processing','PUT',{revision:configuration.revision,value:{...defaultProcessingSettings(),automatic:false,understandingEnabled:false}});
 const head=await checked(f.a.token,'/api/ingress/sources/'+aPage.sourceId+'/head?externalId='+encodeURIComponent(recordingId+':audio'));assert.equal(head.revision,originalAudio.revision);
 const upload=await checked(f.a.token,'/api/ingress/sources/'+aPage.sourceId+'/uploads','POST',{batchId:randomUUID(),revision:{sourceId:aPage.sourceId,previousRevision:head.revision,relativePath:'generated-owner-audio.wav',sizeBytes:wave.length,sha256,item:{externalId:recordingId+':audio',revision:'generated-owner-audio-revision',observedAt:new Date().toISOString(),title:'Generated owner audio revision',text:'',kind:'file',layer:'original',mimeType:'audio/wav',document:originalAudio.document}}});
 await checked(f.a.token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:wave.toString('base64'),checksum:sha256});const ownerFile=(await checked(f.a.token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{})).captures[0].id;
 states.get(f.a.userId)!.mediaGate={entered,wait};
 await run(f.a.token,'operations',{operation:'select',payload:{enabled:true,start:'2026-10-15T00:00:00Z',end:'2026-10-18T00:00:00Z',autoSync:false,backupAudio:true}});
 const mediaBefore=calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length,syncing=run(f.a.token,'sync');await entry;
 const file=await checked(f.a.token,'/api/files/'+ownerFile);await checked(f.a.token,'/api/files/'+ownerFile,'DELETE',{operationId:randomUUID(),originalGeneration:file.originalGeneration});release();const result=await syncing;
 assert.equal(result.result.failed,1);assert.equal(calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length,mediaBefore+1,'the one physical acquisition already started before withdrawal');
 const after=(await page(f.a.token)).items[0];assert.equal(after.audio.state,'stale');assert.equal(after.audioCaptureId,undefined);assert.equal((await heads(f.a.token)).some(item=>item.externalId===recordingId+':audio'),false,'a late provider result cannot republish the forgotten head');
 assert.equal((await f.request(f.a.token,'/api/files/'+ownerFile)).statusCode,404);assert.equal((await run(f.b.token,'sync')).result.failed,0);assert.equal((await page(f.b.token)).items[0].audioCaptureId,bAudio);const playback=await checked(f.b.token,'/api/files/'+bAudio+'/playback','POST',{});assert.equal((await f.request(f.b.token,playback.url)).statusCode,200);
});
