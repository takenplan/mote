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

for(const changed of ['title','time'] as const)test('recording '+changed+' correction with identical transcript bytes publishes a new owned revision',async t=>{
 const {f,states,run,page,heads,projection,calls,originals,bytes}=await fixture(t),beforeA=await heads(f.a.token),beforeB=await heads(f.b.token),beforeExport=beforeA.find(item=>item.externalId===recordingId+':export'),beforeOriginals=await originals(f.a.token),mediaCalls=calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length;
 assert.ok(beforeExport);const state=states.get(f.a.userId)!;
 if(changed==='title')state.title='Generated corrected recording title';else state.at=Date.parse('2026-10-16T02:00:00Z');
 const revised=await run(f.a.token,'sync');
 assert.deepEqual(await heads(f.b.token),beforeB,'A correction cannot change equal vendor identities owned by B');
 assert.equal((await run(f.b.token,'sync')).result.failed,0);
 assert.deepEqual(await heads(f.b.token),beforeB,'B exact replay stays a no-op');
 const after=await heads(f.a.token),current=after.find(item=>item.externalId===recordingId+':export'),status=(await page(f.a.token)).items[0];
 t.diagnostic(JSON.stringify({changed,failed:revised.result.failed,error:status.error,beforeExportRevision:beforeExport.revision,afterExportRevision:current?.revision,currentTitle:current?.title,currentRecordedAt:current?.document?.recordedAt}));
 assert.equal(revised.result.failed,0,'An ordinary metadata correction must not fail the recording transcript checkpoint');
 assert.ok(current);assert.notEqual(current.revision,beforeExport.revision,'Changed title/time is a genuine SourceItem revision even when original bytes are identical');
 assert.equal(current.title,state.title);assert.equal(current.document.recordedAt,new Date(state.at).toISOString());
 assert.equal(after.filter(item=>item.externalId.startsWith(recordingId+':segment:')).length,0);
 await projection(f.a.token);assert.equal(calls.filter(call=>call.userId===f.a.userId&&call.kind==='media').length,mediaCalls);
 assert.equal(after.find(item=>item.externalId===recordingId+':audio').captureId,beforeA.find(item=>item.externalId===recordingId+':audio').captureId);
 const oldOriginal=beforeOriginals.find(item=>item.captureId===beforeExport.captureId),newOriginal=(await originals(f.a.token)).find(item=>item.captureId===current.captureId);assert.ok(oldOriginal&&newOriginal);assert.equal(newOriginal.hash,oldOriginal.hash);assert.deepEqual(await bytes(f.a.token,newOriginal.ref),await bytes(f.a.token,oldOriginal.ref));
 const corrected=await heads(f.a.token);assert.equal((await run(f.a.token,'sync')).result.failed,0);assert.deepEqual(await heads(f.a.token),corrected,'Exact metadata replay must not produce captures');
 // Returning to the original metadata must advance the head, not reuse an old
 // duplicate receipt that leaves the corrected version current.
 if(changed==='title')state.title=initial('A').title;else state.at=initial('A').at;
 assert.equal((await run(f.a.token,'sync')).result.failed,0);const returned=(await heads(f.a.token)).find(item=>item.externalId===recordingId+':export');assert.ok(returned);assert.notEqual(returned.revision,beforeExport.revision);assert.notEqual(returned.revision,current.revision);assert.equal(returned.title,state.title);assert.equal(returned.document.recordedAt,new Date(state.at).toISOString());await projection(f.a.token);
});
