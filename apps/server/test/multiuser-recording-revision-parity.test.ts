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

for(const replacement of ['shorter','empty','unsupported'] as const)test('recording three-paragraph '+replacement+' replacement withdraws earlier speech from current owned consumers',async t=>{
 const {f,states,run,page,heads,projection,checked,originals,bytes,calls}=await fixture(t),beforeB=await heads(f.b.token),beforeA=await heads(f.a.token),oldOriginals=await originals(f.a.token),oldBytes=await Promise.all(oldOriginals.map(item=>bytes(f.a.token,item.ref))),beforeProjection=await projection(f.a.token),beforeMedia=calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length;
 assert.deepEqual((await heads(f.a.token)).filter(item=>item.externalId!==recordingId+':audio').map(item=>item.externalId),[recordingId+':export']);
 const state=states.get(f.a.userId)!;
 state.paragraphs=replacement==='shorter'?[state.paragraphs[0]]:replacement==='empty'?[]:[{unknown:'Generated unsupported current vendor format'}];
 const revised=await run(f.a.token,'sync');
 assert.deepEqual(await heads(f.b.token),beforeB,'A transcript replacement cannot change B current speech');
 assert.equal((await run(f.b.token,'sync')).result.failed,0);assert.deepEqual(await heads(f.b.token),beforeB);
 await f.restart();
 const current=await heads(f.a.token),status=(await page(f.a.token)).items[0];
 if(replacement==='unsupported'){assert.ok(revised.result.failed>0);assert.equal(status.unsupported,true,'An unsupported export is retained as such, not claimed to have decoded new speech');}
 else{assert.equal(revised.result.failed,0);if(replacement==='empty')assert.equal(status.empty,true);}
 t.diagnostic(JSON.stringify({replacement,failed:revised.result.failed,empty:status.empty,unsupported:status.unsupported,canonicalCaptureId:status.transcriptCaptureId}));
 const after=await projection(f.a.token,replacement==='unsupported');assert.ok(beforeProjection.text.includes('GENERATED_A_REMOVED_ONE'));
 const summary=(await checked(f.a.token,'/api/connectors/same-recordings')).counts;assert.equal(summary.transcripts,replacement==='shorter'?1:0);assert.equal(summary.empty,replacement==='empty'?1:0);assert.equal(summary.audio,1,'Current recording totals preserve the independent confirmed backup');
 for(const text of ['GENERATED_A_REMOVED_ONE','GENERATED_A_REMOVED_TWO',...(replacement==='shorter'?[]:['GENERATED_A_KEPT'])]){
  assert.ok(!after.text.includes(text),'Current Material cannot expose withdrawn speech '+text);
  assert.deepEqual((await checked(f.a.token,'/api/data/search?query='+text)).items,[],'Actual current query candidates cannot contain withdrawn speech');
 }
 if(replacement==='shorter')assert.ok(after.text.includes('GENERATED_A_KEPT'));
 for(const material of beforeProjection.materials.filter(item=>!after.materials.some(current=>current.id===item.id))){const response=await f.request(f.a.token,'/api/memory/materials/'+material.id+'?revision='+material.revision);assert.equal(response.statusCode,404,response.body);}
 for(const material of after.materials){const memory=await checked(f.a.token,'/api/memory/materials/'+material.id+'?revision='+material.revision);if(material.blockCount===0){assert.equal(memory.status,'unavailable');assert.deepEqual(memory.evidenceIds,[]);}}
 const oldExport=beforeA.find(item=>item.externalId===recordingId+':export'),head=current.find(item=>item.externalId===oldExport.externalId);assert.ok(head&&!head.deleted);assert.notEqual(head.captureId,oldExport.captureId,'Ordinary withdrawal advances the single retained non-deleted export head');assert.equal(current.filter(item=>item.externalId.startsWith(recordingId+':segment:')).length,0);
 for(const [index,original] of oldOriginals.entries())assert.deepEqual(await bytes(f.a.token,original.ref),oldBytes[index],'Historical encrypted originals stay readable by their owner');
 const beforeReplay=await heads(f.a.token);await run(f.a.token,'sync');assert.deepEqual(await heads(f.a.token),beforeReplay,'Repeated current export must be idempotent');assert.equal(calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length,beforeMedia,'A transcript revision does not re-download a successful media backup');
});
