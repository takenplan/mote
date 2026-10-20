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

test('summary page checkpoints count toward logical quota and retire transactionally with their file',async t=>{
 const {store,id}=await fixture(t),fingerprint=sha256('generated summary page'),json=JSON.stringify({answer:'Generated private summary '.repeat(100),citationIds:['generated-fragment']}),baseline=store.logicalBytes();
 const bytes=Buffer.byteLength(json)+Buffer.byteLength(id)+Buffer.byteLength(fingerprint)+128;
 store.db.prepare('INSERT INTO file_summary_pages VALUES(?,?,?)').run(id,fingerprint,json);assert.equal(store.logicalBytes()-baseline,bytes);
 const reopened=new Store(store.directory,{dataKey:'41'.repeat(32),contentEncryptionEnabled:true});assert.equal(reopened.logicalBytes(),store.logicalBytes());reopened.close();
 store.db.exec('BEGIN IMMEDIATE');store.db.prepare('DELETE FROM file_summary_pages WHERE capture_id=?').run(id);assert.equal(store.logicalBytes(),baseline);store.db.exec('ROLLBACK');assert.equal(store.logicalBytes(),baseline+bytes);
 store.delete(id);assert.equal(store.db.prepare('SELECT count(*) n FROM file_summary_pages WHERE capture_id=?').get(id)!.n,0);assert.equal(store.db.prepare("SELECT bytes FROM storage_ledger WHERE name='file_summary_pages'").get()!.bytes,0);
});

test('raw ASR word times outside a sentence retain evidence and use uncertain sentence alignment',()=>{
 for(const words of [[{startMs:1000,endMs:2056,text:'Generated evidence'}],[{startMs:944,endMs:2000,text:'Generated evidence'}]]){
  const input=transcriptSchema.parse({durationMs:3000,segments:[{startMs:1000,endMs:2000,text:'Generated evidence',words}]}),saved=structuredClone(input);
  const aligned=alignDialogue(input,diary);
  assert.deepEqual(input,saved);
  assert.equal(aligned.segments[0].text,input.segments[0].text);
  assert.equal(aligned.segments[0].startMs,1000);assert.equal(aligned.segments[0].endMs,2000);
  assert.equal(aligned.segments[0].uncertain,true);
  assert.ok(aligned.warnings?.some(w=>w.includes('超出句子范围')));
 }
 for(const words of [[{startMs:-1,endMs:1000,text:'Negative'}],[{startMs:2000,endMs:1000,text:'Invalid'}],[{startMs:1000,endMs:4001,text:'Outside recording'}],[{startMs:1500,endMs:1700,text:'First'},{startMs:1400,endMs:1600,text:'Backwards'}]])
  assert.throws(()=>transcriptSchema.parse({durationMs:3000,segments:[{startMs:1000,endMs:2000,text:'Generated evidence',words}]}));
});

test('MVP installs one current transcript contract and rejects retired audio components',()=>{
 const recipes=new FileRecipeRegistry(),outputs=new FileOutputRegistry(),dispose=installFileRecipes(recipes,outputs);
 try{
  assert.deepEqual(defaultFileOutput({mediaTypes:['image/']}),{id:'mote.transcript',version:'2'});
  assert.deepEqual(defaultFileOutput({mediaTypes:['text/']}),{id:'mote.transcript',version:'2'});
  const audioOutput=defaultFileOutput({mediaTypes:['audio/']}),audioRecipe=defaultFileRecipe({dialogue:true});
  assert.equal(audioOutput.version,'2');assert.equal(audioRecipe.version,'2');
  assert.equal(recipes.resolve(audioRecipe,{semanticTurns:false}).pins.find(pin=>pin.name==='align')?.version,'2');
  const legacy={id:'mote.audio-dialogue',version:'1'};
  assert.throws(()=>recipes.resolve(legacy,{semanticTurns:false}),/unavailable/);
  assert.ok(!recipes.list().stages.some(stage=>stage.id==='mote.align'&&stage.version==='1'));
  assert.throws(()=>outputs.decode({id:'mote.transcript',version:'1'},raw),/unavailable/);
  const boundary={durationMs:3000,segments:[{startMs:1000,endMs:2000,text:'Generated',words:[{startMs:1000,endMs:2056,text:'Generated'}]}]};
  assert.deepEqual(outputs.decode(audioOutput,boundary).transcript,boundary);
  assert.throws(()=>outputs.decode({id:'mote.transcript',version:'1'},boundary));
  assert.equal(alignDialogue(boundary,diary).segments[0].uncertain,true);
 }finally{dispose();}
});

test('alignment preserves Chinese characters, anonymous overlap/unknown markers, and grouping cannot rewrite or omit evidence',()=>{
 const result=alignDialogue(raw,diary);assert.equal(result.segments[0].text,raw.segments[0].text);assert.equal(result.segments[1].text,raw.segments[1].text);assert.ok(result.warnings?.length);
 const overlap=alignDialogue(raw,{...diary,segments:[...diary.segments,{startMs:0,endMs:1000,speaker:'SPEAKER_1'}]});assert.ok(overlap.segments[0].overlap);assert.ok(overlap.segments[0].uncertain);
 assert.equal(alignDialogue(raw,{...diary,segments:[]}).segments[0].speaker,'SPEAKER_UNKNOWN');
 assert.throws(()=>applySemanticGroups(result,[[1],[0]]));assert.throws(()=>applySemanticGroups(result,[[0]]));assert.throws(()=>applySemanticGroups(result,[[0,1]]));assert.deepEqual(applySemanticGroups(result,[[0],[1]]).segments,result.segments);
 assert.throws(()=>transcriptSchema.parse({...raw,segments:[{...raw.segments[0],words:[{startMs:900,endMs:100,text:'bad'}]}]}));
});

test('alignment retains overlapping ASR sentences without producing a backwards word timeline',()=>{
 const input=transcriptSchema.parse(overlappingRaw),saved=structuredClone(input);
 const result=alignDialogue(input,diary);
 assert.doesNotThrow(()=>transcriptSchema.parse(result));
 assert.deepEqual(input,saved,'the original recognized text and timestamps remain unchanged');
 assert.equal(result.segments[0].text,input.segments[0].text);
 assert.equal(result.segments[0].startMs,input.segments[0].startMs);
 assert.equal(result.segments[0].endMs,input.segments[0].endMs);
 assert.equal(result.segments[0].uncertain,true);
 assert.equal(result.segments.map(s=>s.text).join('').replaceAll('\n',''),input.segments.map(s=>s.text).join(''));
 assert.ok(result.warnings?.some(w=>w.includes('词级时间')));
 const conflict=alignDialogue(input,overlappingDiarization);
 assert.doesNotThrow(()=>transcriptSchema.parse(conflict));
 assert.equal(conflict.segments.map(s=>s.text).join('').replaceAll('\n',''),input.segments.map(s=>s.text).join(''));
 assert.equal(conflict.segments[0].uncertain,true);
});

for(const manual of [false,true])test(`confirmed ${manual?'manual':'model'} text correction preserves unrelated raw and formal memories and invalidates only replaced speech`,async t=>{
 const f=await fixture(t,{analyze:async(records:any[])=>{const chunk=JSON.parse(records[0].ocrText);return {answer:JSON.stringify({suggestions:[{chunkId:chunk.chunkId,original:'扣迪斯',replacement:'Cordis',reason:'Generated exact correction'}]}),citations:[{id:chunk.chunkId}]};}});
 await f.processing.tick();const reviews=new FileReviews(f.files,f.processing),artifactId=f.files.chunks(f.id)[0].fileEvidence!.artifactId;
 reviews.nameSpeakers(f.id,{artifactId,names:{SPEAKER_0:'Generated Alice',SPEAKER_1:'Generated Bob'}});
 const materials=new MaterialStore(f.store),work=new MaterialMemoryWork(f.store,materials),organizers=new MaterialOrganizerRuntime(f.store,materials,[],undefined,work);
 try{
  while(await organizers.tick(100));const material=materials.get(materialId('phone','fixture.wav'))!;
  const raw=f.files.chunks(f.id),formal=materials.evidence(materials.evidenceIds(material.ref)).filter(r=>formalValue(r).speaker);
  const memories=new MemoryStore(f.store,ids=>[...f.files.evidence(ids),...materials.evidence(ids)],id=>f.files.isCurrentEvidence(id)||materials.isCurrentEvidence(id));
  const save=(record:typeof raw[number]|typeof formal[number])=>memories.publish(memories.extract(fixtureMemoryResult(memories,{answer:JSON.stringify({memories:[{title:'Generated correction fixture',statement:`Generated speech [${record.id}]`,uncertainty:'Fixture',evidenceIds:[record.id],evidence:[{id:record.id,quote:record.ocrText}]}]}),citations:[{id:record.id,capturedAt:record.capturedAt,appName:record.appName,excerpt:record.ocrText}],trace:[],runId:'generated-text-correction'}),'fixture').items[0].id);
  const savedRaw=raw.map(save),savedFormal=formal.map(save),stableFingerprint=memoryEvidenceFingerprint(raw[1]);
  const conversations=new Conversations(f.store),answers=raw.map(record=>conversations.append(undefined,{question:'Generated question'},{answer:'Generated answer '+record.id,citations:[],trace:[],runId:'generated',evidenceDependencies:{version:1,complete:true,ids:[record.id]}}));
  const derivedAnswers=[formal.map(record=>record.id),[savedFormal[0].id],[savedFormal[1].id]].map(ids=>conversations.append(undefined,{question:'Generated derived read without citations'},{answer:'Generated derived answer',citations:[],trace:[],runId:'generated',evidenceDependencies:{version:1,complete:true,ids}}));
  if(manual){const text=String(f.store.db.prepare('SELECT text FROM file_chunks WHERE id=?').get(raw[0].id)!.text);reviews.correct(f.id,{artifactId,chunkId:raw[0].id,originalText:text,correctedText:text.replace('扣迪斯','Cordis')});}
  else{const proposal=await reviews.propose(f.id,{kind:'terms'});reviews.confirm(f.id,proposal.id,{action:'accept',selected:[proposal.suggestions[0].id]});}
  const after=f.files.chunks(f.id);
  assert.equal(after[1].id,raw[1].id,'the unedited segment keeps its immutable evidence identity');
  assert.equal(memoryEvidenceFingerprint(after[1]),stableFingerprint);
  assert.equal(conversations.get(answers[0].conversationId).turns[0].evidenceStale,true);
  assert.equal(conversations.get(derivedAnswers[0].conversationId).turns[0].evidenceStale,true,'aggregate material read depends on the changed segment even without citations');
  assert.equal(conversations.get(derivedAnswers[1].conversationId).turns[0].evidenceStale,true,'derived memory read retains its segment lineage');
  assert.equal(conversations.get(derivedAnswers[2].conversationId).turns[0].result?.answer,'Generated derived answer');
  assert.equal(conversations.get(answers[1].conversationId).turns[0].result?.answer,'Generated answer '+raw[1].id);
  assert.notEqual(after[0].id,raw[0].id);assert.match(after[0].ocrText,/Cordis/);
  assert.equal(memories.get(savedRaw[0].id).status,'stale');assert.equal(memories.get(savedFormal[0].id).status,'stale');
  assert.equal(memories.get(savedRaw[1].id).status,'published');assert.equal(memories.get(savedFormal[1].id).status,'published');
  assert.deepEqual(after.map(r=>r.fileEvidence!.speakerAttribution),raw.map(r=>r.fileEvidence!.speakerAttribution));
  assert.throws(()=>materials.read(material.ref),{statusCode:409});assert.equal(work.readyForMemory(material.ref),false);
  while(await organizers.tick(100));const corrected=materials.get(material.id)!;
  assert.ok(materials.evidenceIds(corrected.ref).includes(formal[1].id));assert.equal(materials.isCurrentEvidence(formal[0].id),false);
  assert.equal(memories.get(savedFormal[1].id).status,'published');assert.match(materials.read(corrected.ref).text,/Cordis/);
  assert.match(materials.read(material.ref).text,/扣迪斯/);
  const entries=fileExportEntries(f.files,f.id);assert.match(entries.find(e=>e.name==='原始转写_未校正.md')!.bytes.toString(),/扣迪斯/);
 }finally{await organizers.close();}
});

test('a model cannot inject corrections outside cited chunks or guess a speaker name',async t=>{
 const f=await fixture(t,{analyze:async(records:any[])=>({answer:JSON.stringify({suggestions:[{chunkId:records[0].id,original:'not in evidence',replacement:'rewrite',reason:'bad'}]}),citations:[{id:records[0].id}]})});await f.processing.tick();const reviews=new FileReviews(f.files,f.processing);
 await assert.rejects(reviews.propose(f.id,{kind:'terms'}),{statusCode:502});assert.equal(reviews.list(f.id).items.length,0);
 const artifact=f.files.detail(f.id).artifacts.find((a:any)=>a.kind==='dialogue')!;assert.throws(()=>reviews.nameSpeakers(f.id,{artifactId:artifact.id,names:{SPEAKER_9:'Unknown'}}));reviews.nameSpeakers(f.id,{artifactId:artifact.id,names:{SPEAKER_0:'用户确认名'}});assert.ok(fileExportEntries(f.files,f.id).some(e=>e.name==='已确认说话人.json'));
});

test('speaker correction during Memory extraction fences the late response and clears checkpoints',async t=>{
 const f=await fixture(t);await f.processing.tick();const reviews=new FileReviews(f.files,f.processing),record=f.files.chunks(f.id)[0];
 reviews.nameSpeakers(f.id,{artifactId:record.fileEvidence!.artifactId,names:{SPEAKER_0:'Generated Alice'}});
 const memories=new MemoryStore(f.store,ids=>[...f.store.evidence(ids),...f.files.evidence(ids)],id=>f.files.isCurrentEvidence(id)||f.store.isCurrentEvidence(id));
 let enter!:()=>void,finish!:()=>void;const entered=new Promise<void>(resolve=>enter=resolve),release=new Promise<void>(resolve=>finish=resolve);
 const pipeline=fixtureMemoryPipeline({store:f.store,memories,configured:()=>true,model:()=> 'fixture',query:async()=>{enter();await release;return {answer:JSON.stringify({memories:[{title:'Old attribution',statement:`Old speaker [${record.id}]`,uncertainty:'Generated',evidenceIds:[record.id],evidence:[{id:record.id,quote:record.ocrText}]}]}),citations:[{id:record.id,capturedAt:record.capturedAt,appName:record.appName,excerpt:record.ocrText}],trace:[],runId:'generated-old-attribution'};}});
 t.after(()=>pipeline.close());const job=pipeline.create({evidenceIds:[record.id]}),running=pipeline.run(job.id);await entered;
 reviews.nameSpeakers(f.id,{artifactId:record.fileEvidence!.artifactId,names:{SPEAKER_0:'Generated Carol'}});finish();
 const done=await running;assert.equal(done.status,'failed');assert.equal(done.batches[0].status,'invalidated');assert.equal(memories.list({includeStale:true}).length,0);
 assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM memory_checkpoints').get()!.n,0);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM memory_extraction_drafts').get()!.n,0);
 assert.equal(pipeline.create({evidenceIds:[record.id]}).totalBatches,1,'corrected attribution remains eligible for fresh extraction');
});

test('local settings redact all credentials and reject remote destinations',async t=>{
 const f=await fixture(t);f.processing.update({revision:f.processing.view().revision,settings:{...f.processing.view().settings,apiKey:'cloud-test-secret',localWorkerApiKey:'worker-test-secret'},policy:fixtureFilePolicy({...f.processing.view().settings,apiKey:'cloud-test-secret',localWorkerApiKey:'worker-test-secret'},f.processing.runtime.registry)});assert.ok(!JSON.stringify(f.processing.view()).includes('test-secret'));
 for(const field of ['localEndpoint'])assert.throws(()=>fileProcessingSchema.parse({[field]:'https://example.test/api',allowRemote:true}));
 assert.throws(()=>f.processing.update({revision:f.processing.view().revision,settings:{...f.processing.view().settings,localEndpoint:'http://127.0.0.1:12345/transcribe'},policy:fixtureFilePolicy({...f.processing.view().settings,localEndpoint:'http://127.0.0.1:12345/transcribe'},f.processing.runtime.registry)}),{statusCode:409});
});

test('changing defaults preserves the explicit summary choice of a completed file',async t=>{
 const f=await fixture(t);await f.processing.tick();f.processing.update({revision:f.processing.view().revision,settings:{...f.processing.view().settings,audioProcessor:'audio.http',summarize:true},policy:fixtureFilePolicy({...f.processing.view().settings,audioProcessor:'audio.http',summarize:true},f.processing.runtime.registry)});await f.processing.tick();assert.equal(f.counts().summaries,0);assert.equal(f.processing.explain(f.id).applied?.profile.summarize,false);
});

test('file module disposal interrupts its program without cancelling the shared backlog or engine',async t=>{
 let entered!:()=>void,release!:(value:Transcript)=>void,signal!:AbortSignal;const started=new Promise<void>(resolve=>entered=resolve);
 const f=await fixture(t,{transcribe:(input:any)=>{signal=input.signal;entered();return new Promise<Transcript>(resolve=>release=resolve);}});
 await f.processing.close();const engine=new ExecutionEngine(f.store),processing=f.createProcessing(engine);await processing.runtime.ready;t.after(()=>engine.close());
 const ids=processing.prepare(),run=engine.drain(ids);await started;
 const queued=engine.enqueue('generated-queued','files.pipeline',{captureId:f.id,revision:engine.get(ids[0])!.input.revision},{id:'generated-queued'});
 await processing.close();await run;
 assert.equal(engine.closed,false);assert.equal(signal.aborted,true);assert.equal(engine.get(ids[0])!.state,'waiting');assert.equal(engine.get(queued)!.state,'waiting');assert.equal(engine.get(queued)!.attempts,0);
 assert.ok(engine.list({operationId:'file:'+f.id,limit:100}).items.every(step=>step.state!=='cancelled'));assert.deepEqual(processing.prepare(),[]);
 let committed=false;engine.register({kind:'generated-unrelated',pool:'generated-unrelated',concurrency:()=>1,validate:()=>true,execute:async()=>null,commit:()=>{committed=true;}});
 await engine.drain([engine.enqueue('generated-unrelated','generated-unrelated',{})]);assert.equal(committed,true);
 release(raw);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.files.detail(f.id).artifacts.length,0);assert.equal(processing.cancellation(f.id).wait,'unknown');
});

test('ambiguous transport failure survives restart and requires explicit acknowledgement',async t=>{
 let fail=true;const f=await fixture(t,{transcribe:async()=>{if(fail)throw new TypeError('generated lost connection');return raw;}});
 await f.processing.tick();assert.equal(f.processing.cancellation(f.id).wait,'unknown');
 await f.processing.close();const resumed=f.createProcessing();await resumed.runtime.ready;
 await resumed.tick();assert.equal(f.counts().asrCalls,1);assert.throws(()=>resumed.retry(f.id),{statusCode:409});
 fail=false;resumed.retry(f.id,'transcribe',false,true);await resumed.tick();assert.equal(f.counts().asrCalls,2);assert.equal(f.files.detail(f.id).job.state,'succeeded');assert.equal(resumed.cancellation(f.id).wait,null);
});

test('same original on another capture shares the physical processor exclusion',async t=>{
 let release!:()=>void,entered!:()=>void;const started=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 const f=await fixture(t,{transcribe:async()=>{entered();await gate;return raw;}});const task=f.processing.tick();await started;f.processing.cancel(f.id);await task;
 const upload=f.files.begin({sourceId:'phone',item:{externalId:'second.wav',revision:'1',observedAt:new Date().toISOString(),title:'Generated second alias',kind:'file',layer:'original',text:'',mimeType:'audio/wav',deleted:false},sizeBytes:wave.length,sha256:sha256(wave)},()=>{});
 f.files.part(upload.uploadId,0,wave,()=>{});const second=await f.files.commit(upload.uploadId,()=>{});
 assert.equal(f.processing.cancellation(second.id).wait,'running');assert.throws(()=>f.processing.retry(second.id),{statusCode:409});await f.processing.tick();assert.equal(f.counts().asrCalls,1);
 release();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.processing.cancellation(second.id).wait,null);assert.equal(f.files.detail(f.id).job.state,'cancelled');
});

test('late old processor cannot clear the replacement attempt token after restart acknowledgement',async t=>{
 let enterOld!:()=>void,enterNew!:()=>void,releaseOld!:()=>void,releaseNew!:()=>void,calls=0;
 const oldStarted=new Promise<void>(r=>enterOld=r),newStarted=new Promise<void>(r=>enterNew=r),oldGate=new Promise<void>(r=>releaseOld=r),newGate=new Promise<void>(r=>releaseNew=r);
 const f=await fixture(t,{transcribe:async()=>{if(++calls===1){enterOld();await oldGate;}else{enterNew();await newGate;}return raw;}});
 const oldTask=f.processing.tick();await oldStarted;f.processing.cancel(f.id);await oldTask;await f.processing.close();
 const resumed=f.createProcessing();await resumed.runtime.ready;assert.equal(resumed.cancellation(f.id).wait,'unknown');resumed.retry(f.id,'transcribe',false,true);
 const newTask=resumed.tick();await newStarted;const token=f.store.db.prepare('SELECT token FROM file_processor_waits').get()!.token;
 releaseOld();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.store.db.prepare('SELECT token FROM file_processor_waits').get()!.token,token);assert.equal(resumed.cancellation(f.id).wait,'running');
 assert.throws(()=>resumed.retry(f.id),{statusCode:409});releaseNew();await newTask;assert.equal(f.files.detail(f.id).job.state,'succeeded');
});

test('scoped speaker parameters survive restart, reuse ASR, preserve old results and never update the default policy',async t=>{
 const {createServer}=await import('node:http');const {once}=await import('node:events');
 const worker=createServer((req,res)=>{req.resume();res.setHeader('Content-Type','application/json');res.setHeader('X-Mote-Execution','local');assert.equal(req.headers['x-mote-speaker-model'],'wespeaker-zh');assert.equal(req.headers['x-mote-speaker-count'],'0');assert.equal(req.headers['x-mote-speaker-min'],'1');assert.equal(req.headers['x-mote-speaker-max'],'3');res.end(JSON.stringify({...diary,expectedSpeakers:null,declaredRange:{min:1,max:3},estimate:{method:'bounded-silhouette-v1',selectedClusters:3,needsReview:true,scoreGap:.1,candidates:[{clusters:3,observedSpeakers:2,score:.6,segments:diary.segments}]}}));});worker.listen(0,'127.0.0.1');await once(worker,'listening');t.after(()=>new Promise<void>(resolve=>worker.close(()=>resolve())));
 const port=(worker.address() as {port:number}).port;
 const f=await fixture(t,{settings:{localEndpoint:`http://127.0.0.1:${port}/transcribe`}});await f.processing.tick();const before=f.files.detail(f.id),transcript=before.artifacts.find((a:any)=>a.kind==='transcript')!,old=before.artifacts.find((a:any)=>a.kind==='diarization')!;
 const global=structuredClone(f.processing.view()),invalid={artifactId:transcript.id,options:{processor:'audio.diarize-wespeaker' as const,speakerCount:2,range:{min:1,max:3}}};
 assert.throws(()=>f.processing.retry(f.id,'diarize',false,false,invalid));
 assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM file_diarization_overrides').get()!.n,0);
 assert.throws(()=>f.processing.retry(f.id,'diarize',false,false,{artifactId:old.id,options:{processor:'audio.diarize',speakerCount:2,range:null}}),{statusCode:409});
 f.processing.retry(f.id,'diarize',false,false,{artifactId:transcript.id,options:{processor:'audio.diarize-wespeaker',speakerCount:null,range:{min:1,max:3}}});
 await f.processing.close();const resumed=f.createProcessing();await resumed.runtime.ready;await resumed.tick();
 assert.equal(f.files.detail(f.id).job.state,'succeeded',JSON.stringify(f.files.detail(f.id).job));assert.equal(f.counts().asrCalls,1,'no second ASR for acoustic-only change');
 assert.equal(f.files.detail(f.id).artifacts.find((a:any)=>a.kind==='transcript')!.id,transcript.id);
 assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM file_artifacts WHERE id=?').get(old.id)!.n,1);
 assert.equal(resumed.explain(f.id).current.profile.diarizationProcessor,'audio.diarize-wespeaker');
 const estimate=f.files.detail(f.id).artifacts.find((a:any)=>a.kind==='diarization')!;assert.equal(estimate.expectedSpeakers,null);assert.equal(estimate.observedSpeakers,2);assert.equal(estimate.estimate.selectedClusters,3);
 assert.deepEqual(resumed.view().policy,global.policy);
});

test('summary pages retain successful model calls across later capacity waits and restart before atomic publication',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const calls=new Map<number,number>();let busy=true;
 const generated:Transcript={durationMs:41000,segments:Array.from({length:41},(_,index)=>({startMs:index*1000,endMs:(index+1)*1000,text:'Generated summary evidence '+index}))};
 const f=await fixture(t,{settings:{audioProcessor:'audio.http',summarize:true},transcribe:async()=>generated,analyze:async(records:any[])=>{
  const first=records[0].fileEvidence.startMs;calls.set(first,(calls.get(first)??0)+1);
  if(first===20000&&busy)throw new ProviderFailure({category:'transient',code:'rate_limited',executionStarted:false,retryAfterMs:1000});
  return {answer:'Generated page '+first,citations:[{id:records[0].id}]};
 }});
 for(let round=0;round<3;round++){
  await f.processing.tick();assert.equal(calls.get(0),1,'a completed first page must not be billed again when a later page waits');assert.equal(calls.get(20000),round+1);
  const detail=f.files.detail(f.id);assert.equal(detail.job.state,'succeeded');assert.equal(detail.job.summary_state,'waiting');assert.equal(detail.job.execution.status,'succeeded');assert.equal(detail.job.summaryExecution.status,'retry_wait');assert.equal(detail.job.summaryExecution.failure.code,'rate_limited');assert.equal(detail.job.summaryAvailableAt,Date.now()+1000);assert.ok(!detail.artifacts.some((artifact:any)=>artifact.kind==='summary'),'partial pages are checkpoints, never a completed summary');
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM file_summary_pages').get()!.n,1);assert.equal(f.processing.cancellation(f.id).wait,null);
  if(round<2)t.mock.timers.tick(1001);
 }
 await f.processing.close();const resumed=f.createProcessing();await resumed.runtime.ready;busy=false;t.mock.timers.tick(1001);await resumed.tick();
 assert.equal(calls.get(0),1);assert.equal(calls.get(20000),4);assert.equal(calls.get(40000),1);assert.equal(f.counts().asrCalls,1);
 const summary=f.files.detail(f.id).artifacts.find((artifact:any)=>artifact.kind==='summary')!;assert.equal(summary.sections.length,3);assert.equal(f.files.detail(f.id).job.summary_state,'succeeded');
 resumed.retry(f.id,'summary');await resumed.tick();assert.equal(calls.get(0),2,'explicit full summary reprocessing can request fresh model output');assert.equal(f.counts().asrCalls,1);
 f.files.forget(f.id);assert.equal(f.store.db.prepare('SELECT count(*) n FROM file_summary_pages').get()!.n,0,'page checkpoints follow the original deletion lifecycle');
});
