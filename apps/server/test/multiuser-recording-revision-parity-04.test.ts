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

test('empty and unsupported recording corrections retain originals without admitting a new semantic Memory input',async t=>{
 const {f,states,run,page,projection}=await fixture(t,false,true),count=(userId:string)=>f.read(db=>db.prepare('SELECT count(*) n FROM mm_intakes WHERE user_id=?').get(userId)!.n),beforeA=count(f.a.userId),beforeB=count(f.b.userId);assert.equal(beforeA,1);assert.equal(beforeB,1);
 states.get(f.a.userId)!.paragraphs=[];assert.equal((await run(f.a.token,'sync')).result.failed,0);const empty=await projection(f.a.token);assert.equal(empty.materials.length,1);assert.equal(empty.materials[0].blockCount,0);assert.equal((await page(f.a.token)).items[0].empty,true);assert.equal(count(f.a.userId),beforeA,'a zero-block export cannot become a new recording Memory intake');
 await f.restart();states.get(f.a.userId)!.paragraphs=[{unknown:'Generated unsupported current vendor export'}];assert.equal((await run(f.a.token,'sync')).result.failed,1);assert.equal((await page(f.a.token)).items[0].unsupported,true);assert.equal(count(f.a.userId),beforeA);assert.equal(count(f.b.userId),beforeB);
});

test('Files forget fences recording text and audio acquisition across a new selection and restart while another owner continues',async t=>{
 const {f,checked,run,page,calls}=await fixture(t),recording=(await page(f.a.token)).items[0];
 for(const captureId of [recording.transcriptCaptureId,recording.audioCaptureId]){
  const file=await checked(f.a.token,'/api/files/'+captureId);await checked(f.a.token,'/api/files/'+captureId,'DELETE',{operationId:randomUUID(),originalGeneration:file.originalGeneration});
 }
 await f.restart();const count=(userId:string,kind:string)=>calls.filter(call=>call.userId===userId&&call.kind===kind).length,before={transcript:count(f.a.userId,'transcript'),media:count(f.a.userId,'media')};
 const selection={enabled:true,start:'2026-10-15T00:00:00Z',end:'2026-10-18T00:00:00Z',autoSync:false,backupAudio:true};
 await run(f.a.token,'operations',{operation:'select',payload:selection});const result=await run(f.a.token,'sync');assert.equal(result.result.failed,2);
 assert.equal(count(f.a.userId,'transcript'),before.transcript,'forgotten text is rejected before a provider transcript read');assert.equal(count(f.a.userId,'media'),before.media,'forgotten audio is rejected before a media download');
 const forgotten=(await page(f.a.token)).items[0];assert.equal(forgotten.metadata.state,'succeeded');assert.equal(forgotten.transcript.state,'stale');assert.equal(forgotten.audio.state,'stale');assert.equal(forgotten.transcriptCaptureId,undefined);assert.equal(forgotten.audioCaptureId,undefined);
 const bTranscripts=count(f.b.userId,'transcript');await run(f.b.token,'operations',{operation:'select',payload:selection});assert.equal((await run(f.b.token,'sync')).result.failed,0);assert.ok(count(f.b.userId,'transcript')>bTranscripts);assert.ok((await page(f.b.token)).items[0].audioCaptureId,'equal recording IDs in the other owner retain their own confirmed backup');
});

test('ordinary recording withdrawal retains stale Ask answers and citations across restart while a fresh Ask uses current evidence',async t=>{
 const {f,states,run,projection,checked,ask,modelRequests}=await fixture(t,true),original=await ask(f.a.token),beforeB=await ask(f.b.token);assert.ok(original.result.citations.length);
 states.get(f.a.userId)!.paragraphs=[states.get(f.a.userId)!.paragraphs[0]];assert.equal((await run(f.a.token,'sync')).result.failed,0);await projection(f.a.token);
 const retained=await checked(f.a.token,'/api/conversations/'+original.conversationId);assert.equal(retained.turns[0].evidenceStale,true);assert.equal(retained.turns[0].evidenceDeleted,undefined);assert.deepEqual(retained.turns[0].result,original.result);
 const start=modelRequests.length;await ask(f.a.token);assert.ok(modelRequests.slice(start).every(raw=>!raw.includes('GENERATED_A_REMOVED_ONE')&&!raw.includes('GENERATED_A_REMOVED_TWO')));
 assert.deepEqual((await checked(f.b.token,'/api/conversations/'+beforeB.conversationId)).turns[0].result,beforeB.result);
 await f.restart();const restarted=await checked(f.a.token,'/api/conversations/'+original.conversationId);assert.equal(restarted.turns[0].evidenceStale,true);assert.equal(restarted.turns[0].evidenceDeleted,undefined);assert.deepEqual(restarted.turns[0].result,original.result);
});
