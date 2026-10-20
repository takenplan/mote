import {decodeSourceText} from '@mote/shared';
import {fixtureCaptureRefs} from './fixtures/evidence-refs.js';
import {fixtureMemoryResult,fixtureMemoryPipeline} from './fixtures/memory-result.js';
import {fixtureFilePolicy} from './fixtures/file-policy.js';
import {ServerDiagnostics} from '../src/diagnostics.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {type Plugin} from '@deepseek-ai/cordis';
import {ProviderFailure,providerHttpFailure,type Transcript,diarizationSchema,transcriptSchema,fileProcessingSchema} from '@mote/shared';
import {Store,sha256} from '../src/store.js';
import {SourceStore} from '../src/sources.js';
import {FileStore} from '../src/files.js';
import {FileProcessing,HttpTranscriptionProvider} from '../src/file-processing.js';
import {ExecutionEngine} from '../src/execution-engine.js';
import {FileProcessorRuntime} from '../src/file-processors.js';
import {alignDialogue,applySemanticGroups} from '../src/file-dialogue.js';
import {FileReviews} from '../src/file-reviews.js';
import {defaultFileOutput,defaultFileRecipe,FileOutputRegistry,FileRecipeRegistry,installFileRecipes} from '../src/file-recipes.js';
import {Conversations} from '../src/conversations.js';
import {fileExportEntries,exportTar} from '../src/file-export.js';
import {MemoryStore,memoryEvidenceFingerprint} from '../src/memory.js';
import {MemoryPipeline} from '../src/memory-pipeline.js';
import {MaterialStore,materialId} from '../src/materials.js';
import {MaterialOrganizerRuntime} from '../src/material-organizers.js';
import {MaterialMemoryWork} from '../src/material-memory-work.js';
import {Operations} from '../src/operations.js';
import {EvidenceReader} from '../src/evidence-reader.js';
import {evidenceDependents} from '../src/evidence-dependencies.js';
import {sourceMaterialView} from '../src/source-material-view.js';
import {formalValue,raw,wave,diary,overlappingRaw,overlappingDiarization,fixture} from './fixtures/file-processing-suite.js';

test('actual Cordis registration and disposal; local pipeline checkpoints resume without repeating ASR',async t=>{
 const f=await fixture(t,{failFirst:true});await f.processing.tick();assert.equal(f.files.detail(f.id).job.state,'failed');assert.equal(f.processing.cancellation(f.id).wait,'unknown');assert.equal(f.files.detail(f.id).artifacts.filter((a:any)=>a.kind==='transcript').length,1);
 // Reconstruct the engine and Cordis runtime, leaving the persisted checkpoint in place.
 await f.processing.close();const resumed=f.createProcessing();await resumed.runtime.ready;
 assert.equal(resumed.cancellation(f.id).wait,'unknown');assert.throws(()=>resumed.retry(f.id,'diarize'),{statusCode:409});resumed.retry(f.id,'diarize',false,true);
 f.store.db.prepare("UPDATE execution_steps SET available_at=0 WHERE kind='files.pipeline'").run();f.store.db.prepare('UPDATE file_jobs SET available_at=0').run();await resumed.tick();assert.equal(f.files.detail(f.id).job.state,'succeeded');assert.deepEqual(f.counts(),{asrCalls:1,diaryCalls:2,summaries:0,disposed:true});
 const chunks=f.files.chunks(f.id);assert.equal(chunks.length,2);assert.equal(chunks[0].ocrText,'[SPEAKER_0] 使用扣迪斯插件。');assert.equal(chunks[1].fileEvidence?.speaker,'SPEAKER_1');
 assert.equal(f.files.pendingIndex('cloud-model').length,2);assert.equal(f.files.pendingIndex('local-model').length,2);
 await f.processing.close();assert.equal(f.counts().disposed,true);assert.equal(f.processing.runtime.registry.list().length,0);
});

test('retained recording finishes alignment of overlapping ASR and preserves the original transcript across restart',async t=>{
 const f=await fixture(t,{transcribe:async()=>structuredClone(overlappingRaw),diarization:overlappingDiarization});
 await f.processing.tick();assert.equal(f.files.detail(f.id).job.state,'succeeded');
 const original=f.files.detail(f.id).artifacts.find((a:any)=>a.kind==='transcript')!.id;
 assert.deepEqual(f.processing.artifact(original).transcript,overlappingRaw);
 const chunks=f.files.chunks(f.id);assert.ok(chunks.length);assert.equal(chunks[0].fileEvidence?.uncertain,true);
 await f.processing.close();const resumed=f.createProcessing();await resumed.runtime.ready;await resumed.tick();
 assert.equal(f.files.detail(f.id).job.state,'succeeded');assert.equal(f.counts().asrCalls,1);assert.equal(f.counts().diaryCalls,1);
 assert.deepEqual(resumed.artifact(original).transcript,overlappingRaw);
});

test('document text correction retains original locations without inventing audio times or replacing unchanged formal blocks',async t=>{
 const f=await fixture(t,{file:{name:'generated.txt',mimeType:'text/plain',bytes:Buffer.from('Wrong '+ 'generated '.repeat(1800))},settings:{summarize:false},
  analyze:async(records:any[])=>{const chunk=JSON.parse(records[0].ocrText);return {answer:JSON.stringify({suggestions:[{chunkId:chunk.chunkId,original:'Wrong',replacement:'Right',reason:'Generated correction'}]}),citations:[{id:chunk.chunkId}]};}});
 await f.processing.tick();const before=f.files.chunks(f.id);assert.ok(before.length>1);
 const materials=new MaterialStore(f.store),organizers=new MaterialOrganizerRuntime(f.store,materials);
 try{
  while(await organizers.tick(100));const material=materials.get(materialId('phone','generated.txt'))!;
  const anchors=materials.evidence(materials.evidenceIds(material.ref)),stable=anchors.find(r=>r.ocrText===before.at(-1)!.ocrText)!;assert.ok(stable);
  assert.equal(stable.provenance?.document?.contentRole,'other');
  const reviews=new FileReviews(f.files,f.processing),proposal=await reviews.propose(f.id,{kind:'terms'});
  reviews.confirm(f.id,proposal.id,{action:'accept',selected:[proposal.suggestions[0].id]});
  const after=f.files.chunks(f.id);assert.equal(after.length,before.length);assert.equal(after.at(-1)!.id,before.at(-1)!.id);
  assert.deepEqual(after.map(r=>r.fileEvidence!.documentLocation),before.map(r=>r.fileEvidence!.documentLocation));
  assert.ok(after.every(r=>r.fileEvidence!.startMs===undefined&&r.fileEvidence!.endMs===undefined));
  while(await organizers.tick(100));assert.equal(materials.isCurrentEvidence(stable.id),true);
  assert.equal(materials.evidence([stable.id])[0]?.provenance?.document?.contentRole,'other','corrected document text is not an audio transcript');
  assert.ok(materials.evidenceIds(material.id).includes(stable.id));assert.match(materials.read(material.id).text,/Right/);
 }finally{await organizers.close();}
});

test('Cordis rejects duplicate registrations and missing deployment modules',async()=>{
 const runtime=new FileProcessorRuntime();await runtime.ready;assert.throws(()=>runtime.registry.register(runtime.registry.get('text.utf8')));await runtime.close();
 const missing=new FileProcessorRuntime(undefined,[],['/no-such-generated-mote-plugin.mjs']);await assert.rejects(missing.ready);await missing.close();
});

test('file diagnostics trace retries and checkpoint reuse without original content or provider errors',async t=>{
 const f=await fixture(t,{failFirst:true});await f.processing.tick();
 assert.equal(f.processing.cancellation(f.id).wait,'unknown');f.processing.retry(f.id,'diarize',false,true);
 f.store.db.prepare("UPDATE execution_steps SET available_at=0 WHERE kind='files.pipeline'").run();f.store.db.prepare('UPDATE file_jobs SET available_at=0').run();await f.processing.tick();
 const events=f.diagnostics.events().items;
 assert.ok(events.some(e=>e.event==='file.step.started'&&e.operation==='extract'&&e.level==='debug'));
 assert.ok(events.some(e=>e.event==='file.step.failed'&&e.operation==='diarize'&&e.level==='error'));
 assert.ok(events.some(e=>e.event==='file.blocked'&&e.category==='processor_response_unknown'));
 assert.ok(events.every(e=>e.retryAfterMs===undefined),'unknown outcomes never advertise an automatic retry');
 assert.ok(events.some(e=>e.event==='file.cached'&&e.operation==='extract'));
 assert.ok(events.some(e=>e.event==='file.completed'&&e.attempt===1));
 assert.ok(events.some(e=>e.event==='file.blocked'&&e.category==='summary_disabled'));
 assert.ok(events.filter(e=>e.operation==='extract').every(e=>e.jobId===f.id&&e.requestId));
 const serialized=JSON.stringify(events);for(const privateText of ['Synthetic interview','generated failure','使用扣迪斯','fixture.diarize'])assert.ok(!serialized.includes(privateText));
});

test('configurable per-file audio limit rejects incomplete long results',async t=>{
 const f=await fixture(t,{settings:{maxAudioMinutes:1},transcribe:()=>({...raw,durationMs:61000})});
 await f.processing.tick();assert.equal(f.files.detail(f.id).job.state,'failed');assert.equal(f.files.detail(f.id).job.error,'processing_limit');assert.equal(f.counts().asrCalls,1);assert.equal(f.counts().diaryCalls,0);
});

test('manual correction uses exact stored text, is idempotent and rejects stale or foreign segments without model calls',async t=>{
 let modelCalls=0;
 const f=await fixture(t,{settings:{summarize:false},analyze:async()=>{modelCalls++;throw Error('No model allowed');}});await f.processing.tick();
 const reviews=new FileReviews(f.files,f.processing),before=f.files.chunks(f.id),artifactId=before[0].fileEvidence!.artifactId;
 const originalText=String(f.store.db.prepare('SELECT text FROM file_chunks WHERE id=?').get(before[0].id)!.text),input={artifactId,chunkId:before[0].id,originalText,correctedText:originalText};
 const artifact=f.processing.artifact(artifactId),count=()=>f.store.db.prepare('SELECT COUNT(*) n FROM file_artifacts').get()!.n;
 const initialCount=count();assert.equal(reviews.correct(f.id,input).status,'unchanged');assert.equal(count(),initialCount);
 assert.throws(()=>reviews.correct(f.id,{...input,chunkId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}),{statusCode:409});
 assert.throws(()=>reviews.correct(f.id,{...input,originalText:originalText+' '}),{statusCode:409});
 reviews.correct(f.id,{...input,correctedText:'[SPEAKER_0] Generated owner correction'});
 assert.throws(()=>reviews.correct(f.id,{...input,correctedText:'Late correction'}),{statusCode:409});
 const after=f.files.chunks(f.id),next=f.processing.artifact(after[0].fileEvidence!.artifactId);
 assert.equal(after[1].id,before[1].id);assert.notEqual(after[0].id,before[0].id);
 assert.equal(next.transcript.segments[0].text,'[SPEAKER_0] Generated owner correction');assert.equal(next.transcript.segments[0].words,undefined);
 assert.deepEqual(f.processing.artifact(artifactId),artifact);assert.equal(modelCalls,0);assert.equal(f.counts().summaries,0);
 assert.deepEqual(Buffer.concat([...f.files.bytes(f.id)]),wave);
});

test('manual correction route rejects device credentials and validates owner segment identity',async t=>{
 const f=await fixture(t,{settings:{summarize:false}});await f.processing.tick();
 const {default:Fastify}=await import('fastify'),{registerFileRoutes}=await import('../src/file-routes.js');
 const app=Fastify();t.after(()=>app.close());
 registerFileRoutes(app,f.files,f.processing,{} as any,()=>{},req=>req.headers['x-generated-device']?'generated-device':undefined,{evidence:()=>[{}]} as any);
 const before=f.files.chunks(f.id)[0],originalText=String(f.store.db.prepare('SELECT text FROM file_chunks WHERE id=?').get(before.id)!.text);
 const payload={artifactId:before.fileEvidence!.artifactId,chunkId:before.id,originalText,correctedText:'Generated manual correction'};
 const request={method:'POST' as const,url:'/api/files/'+f.id+'/corrections',payload};
 assert.equal((await app.inject({...request,headers:{'x-generated-device':'true'}})).statusCode,403);
 assert.equal((await app.inject({...request,payload:{...payload,originalText:'stale'}})).statusCode,409);
 assert.equal((await app.inject(request)).statusCode,200);
 assert.equal((await app.inject(request)).statusCode,409);
});

test('summary receives cancellation signal and its late response is not published',async t=>{
 let release!:()=>void,entered!:()=>void;const started=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);let signal:AbortSignal|undefined;
 const f=await fixture(t,{settings:{audioProcessor:'audio.http',summarize:true},analyze:async(records:any[],_prompt:any,_settings:any,current:AbortSignal)=>{signal=current;entered();await gate;return {answer:'Generated summary',citations:[{id:records[0].id}]};}});
 const task=f.processing.tick();await started;const before=JSON.stringify(f.files.detail(f.id).artifacts);f.processing.cancel(f.id);assert.equal(signal!.aborted,true);await task;
 assert.throws(()=>f.processing.retry(f.id,'summary'),{statusCode:409});release();await new Promise(resolve=>setImmediate(resolve));assert.equal(JSON.stringify(f.files.detail(f.id).artifacts),before);assert.equal(f.files.detail(f.id).job.summary_state,'cancelled');
});

test('explicit retry leaves cancelled children from an obsolete configuration untouched',async t=>{
 const f=await fixture(t,{transcribe:async()=>{throw new ProviderFailure(providerHttpFailure(429));}});await f.processing.tick();const original=f.processing.engine.list({operationId:'file:'+f.id,kind:'files.pipeline'}).items[0].id;
 f.processing.update({revision:f.processing.view().revision,settings:{...f.processing.view().settings,localEndpoint:'http://127.0.0.1:9047/generated-new-endpoint'},policy:fixtureFilePolicy({...f.processing.view().settings,localEndpoint:'http://127.0.0.1:9047/generated-new-endpoint'},f.processing.runtime.registry)});
 assert.equal(f.processing.engine.get(original)!.state,'cancelled','fixture must actually revoke the old configuration');
 const historical=()=>f.store.db.prepare("SELECT e.* FROM execution_steps e JOIN execution_operation_steps o ON o.step_id=e.id WHERE o.operation_id=? AND e.kind LIKE 'file-step.%'").all('file:'+f.id);
 const before=JSON.stringify(historical());assert.ok(historical().length);f.processing.retry(f.id);assert.equal(JSON.stringify(historical()),before,'only current-generation child backoff may reset');
});

test('archive-only original pipeline is skipped without executing a content processor',async t=>{
 const f=await fixture(t),view=f.processing.view(),policy=structuredClone(view.policy);policy.rules=[{type:'*/*',profileId:'archive'}];f.processing.update({revision:view.revision,settings:view.settings,policy});await f.processing.tick();
 assert.equal(f.files.detail(f.id).job.state,'skipped');assert.equal(new Operations(f.store).detail('file:'+f.id).operation.state,'skipped');assert.equal(f.processing.cancellation(f.id).canCancel,false);assert.equal(f.counts().asrCalls,0);assert.equal(f.counts().summaries,0);
});

test('file call defaults are generous while an explicit call budget does not cap a multi-stage recording',async t=>{
 assert.equal(fileProcessingSchema.parse({}).timeoutMs,3600000);
 const {createServer}=await import('node:http'),{requestLocalJson}=await import('../src/local-http.js');
 const requests:string[]=[],headers:Record<string,string>={};
 const server=createServer((req,res)=>{req.resume();req.on('end',()=>{requests.push(req.url!);headers[req.url!]=String(req.headers['x-mote-processing-timeout-ms']);setTimeout(()=>{res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');res.end(JSON.stringify(req.url==='/diarize'?diary:raw));},650);});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const address=server.address();assert.ok(address&&typeof address!=='string');const endpoint=`http://127.0.0.1:${address.port}`;
 const provider=new HttpTranscriptionProvider(),f=await fixture(t,{settings:{endpoint:endpoint+'/transcribe',localEndpoint:endpoint+'/transcribe',timeoutMs:1000},
  transcribe:(input:any)=>provider.transcribe(input),
  diarize:(input:any)=>requestLocalJson(endpoint+'/diarize',{method:'POST',headers:{'Content-Length':String(input.file.sizeBytes),'X-Mote-Processing-Timeout-Ms':String(input.settings.timeoutMs)},body:input.readOriginal(),signal:input.signal,requireOfflineExecution:true})});
 const started=performance.now();await f.processing.tick();
 assert.ok(performance.now()-started>1000,'the generated ASR + diarization journey exceeds the former overall deadline');
 assert.equal(f.files.detail(f.id).job.state,'succeeded');assert.deepEqual(requests,['/transcribe','/diarize']);
 assert.deepEqual(headers,{'/transcribe':'1000','/diarize':'1000'},'explicit legacy values protect individual calls');
 assert.equal(f.processing.cancellation(f.id).wait,null);assert.equal(f.files.detail(f.id).artifacts.filter((a:any)=>a.kind==='transcript').length,1);
 const resources=f.store.db.prepare("SELECT json_extract(e.input,'$.name') name,r.resource_key FROM execution_steps e JOIN execution_resources r ON r.step_id=e.id WHERE e.kind LIKE 'file-step.%'").all();
 assert.equal(resources.length,2);assert.deepEqual(resources.map(r=>r.name).sort(),['diarize','extract']);assert.equal(resources[0].resource_key,resources[1].resource_key,'ASR and diarization share actual worker capacity; alignment does not');
});

test('a failed summary page keeps successful file processing and its canonical failure separate',async t=>{
 let calls=0;
 const f=await fixture(t,{settings:{audioProcessor:'audio.http',summarize:true},analyze:async()=>{calls++;throw new ProviderFailure({...providerHttpFailure(413),executionStarted:false});}});
 await f.processing.tick();const detail=f.files.detail(f.id);
 assert.equal(detail.job.state,'succeeded');assert.equal(detail.job.execution.status,'succeeded');assert.equal(detail.job.error,null);
 assert.equal(detail.job.summary_state,'failed');assert.equal(detail.job.summaryExecution.status,'failed');assert.equal(detail.job.summaryExecution.failure.code,'processing_limit');
 assert.ok(!detail.artifacts.some((artifact:any)=>artifact.kind==='summary'));await f.processing.tick();assert.equal(calls,1,'unchanged deterministic summary failure is not reopened');
});
