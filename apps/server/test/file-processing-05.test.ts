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

test('unverified acoustic labels can outnumber bounded speaker previews without losing the transcript',async t=>{
 const data={...diary,durationMs:9450,expectedSpeakers:null,observedSpeakers:189,segments:Array.from({length:189},(_,i)=>({startMs:i*50,endMs:(i+1)*50,speaker:'SPEAKER_'+i})),samples:[{...diary.samples[0],speaker:'SPEAKER_188',startMs:9400,endMs:9450}],warnings:['Generated labels are not confirmed people.']};
 assert.doesNotThrow(()=>diarizationSchema.parse(data));
 assert.throws(()=>diarizationSchema.parse({...data,observedSpeakers:100001}));
 assert.throws(()=>diarizationSchema.parse({...data,segments:[{startMs:0,endMs:1000,speaker:'SPEAKER_100000'}]}));
 assert.throws(()=>diarizationSchema.parse({...data,samples:Array(17).fill(diary.samples[0])}));
 const f=await fixture(t,{diarization:data,transcribe:async()=>({durationMs:9450,segments:[{startMs:9400,endMs:9450,text:'Generated final cluster'}]}),settings:{speakerCount:null}});await f.processing.tick();
 const detail=f.files.detail(f.id);assert.equal(detail.job.state,'succeeded');
 const artifact=detail.artifacts.find((a:any)=>a.kind==='diarization')!;assert.equal(artifact.observedSpeakers,189);
 assert.equal(f.files.chunks(f.id)[0].fileEvidence?.speaker,'SPEAKER_188');
 assert.equal(f.files.chunks(f.id)[0].fileEvidence?.speakerAttribution,undefined);
 assert.deepEqual(f.files.asset(f.id,artifact.id,'speaker_samples/SPEAKER_188.wav').bytes,wave);
 const reviews=new FileReviews(f.files,f.processing),dialogueId=f.files.chunks(f.id)[0].fileEvidence!.artifactId;
 assert.throws(()=>reviews.nameSpeakers(f.id,{artifactId:dialogueId,names:{SPEAKER_189:'Generated unknown'}}));
 reviews.nameSpeakers(f.id,{artifactId:dialogueId,names:{SPEAKER_188:'Generated owner-confirmed participant'}});
 assert.equal(f.files.chunks(f.id)[0].fileEvidence?.speakerAttribution?.confirmedBy,'owner');
 const exported=fileExportEntries(f.files,f.id);
 assert.ok(exported.some(e=>e.name==='speaker_samples/SPEAKER_188.wav'));
 assert.match(exported.find(e=>e.name==='已确认说话人.json')!.bytes.toString(),/Generated owner-confirmed participant/);
 assert.ok(detail.artifacts.some((a:any)=>a.kind==='transcript'));assert.ok(f.files.chunks(f.id).length>0);
 assert.equal(f.counts().asrCalls,1);assert.equal(f.counts().diaryCalls,1);
});

test('retained recording publishes ASR with a 56ms sentence-boundary discrepancy and survives restart',async t=>{
 const raw={durationMs:3000,segments:[{startMs:1000,endMs:2000,text:'Generated evidence',words:[{startMs:1000,endMs:2056,text:'Generated evidence'}]}],uncorrected:true as const};
 const f=await fixture(t,{transcribe:async()=>structuredClone(raw)});await f.processing.tick();
 assert.equal(f.files.detail(f.id).job.state,'succeeded');
 const original=f.files.detail(f.id).artifacts.find((a:any)=>a.kind==='transcript')!.id;
 assert.deepEqual(f.processing.artifact(original).transcript,raw);
 assert.equal(f.files.chunks(f.id)[0].fileEvidence?.uncertain,true);
 await f.processing.close();const resumed=f.createProcessing();await resumed.runtime.ready;await resumed.tick();
 assert.equal(f.files.detail(f.id).job.state,'succeeded');assert.equal(f.counts().asrCalls,1);assert.equal(f.counts().diaryCalls,1);
 assert.deepEqual(resumed.artifact(original).transcript,raw);
});

test('diarization retries invalidate corrected downstream content while preserving raw extraction',async t=>{
 const f=await fixture(t);await f.processing.tick();const before=f.files.detail(f.id).artifacts.find((a:any)=>a.kind==='transcript')!.id;
 f.processing.retry(f.id,'diarize');await f.processing.tick();assert.equal(f.files.detail(f.id).job.state,'succeeded');assert.equal(f.counts().asrCalls,1);assert.equal(f.counts().diaryCalls,2);assert.equal(f.files.detail(f.id).artifacts.find((a:any)=>a.kind==='transcript')!.id,before);
});

test('term proposals require exact cited text and explicit selection; correction preserves raw export and rejects stale proposals',async t=>{
 const f=await fixture(t,{analyze:async(records:any[],_prompt:string,_settings:any)=>{const chunk=JSON.parse(records[0].ocrText);return {answer:JSON.stringify({suggestions:[{chunkId:chunk.chunkId,original:'扣迪斯',replacement:'Cordis',reason:'请确认框架名称'}]}),citations:[{id:chunk.chunkId}]};}});await f.processing.tick();const reviews=new FileReviews(f.files,f.processing),proposal=await reviews.propose(f.id,{kind:'terms'}),other=await reviews.propose(f.id,{kind:'terms'});
 assert.match(f.files.chunks(f.id)[0].ocrText,/扣迪斯/);assert.throws(()=>reviews.confirm(f.id,proposal.id,{action:'accept'}));
 const before=f.files.chunks(f.id)[0];reviews.nameSpeakers(f.id,{artifactId:before.fileEvidence!.artifactId,names:{SPEAKER_0:'Generated Alice'}});const attribution=f.files.chunks(f.id)[0].fileEvidence!.speakerAttribution;
 const suggestion=proposal.suggestions[0];reviews.confirm(f.id,proposal.id,{action:'accept',selected:[suggestion.id]});assert.match(f.files.chunks(f.id)[0].ocrText,/Cordis/);assert.throws(()=>reviews.confirm(f.id,other.id,{action:'accept',selected:[other.suggestions[0].id]}),{statusCode:409});
 assert.deepEqual(f.files.chunks(f.id)[0].fileEvidence!.speakerAttribution,attribution,'text-only correction preserves the actual owner confirmation');
 const entries=fileExportEntries(f.files,f.id);assert.match(entries.find(e=>e.name==='原始转写_未校正.md')!.bytes.toString(),/扣迪斯/);assert.match(entries.find(e=>e.name==='带说话人_已确认校正记录.md')!.bytes.toString(),/Cordis/);
 f.processing.retry(f.id,'diarize');await f.processing.tick();assert.match(f.files.chunks(f.id)[0].ocrText,/扣迪斯/);assert.equal(f.files.chunks(f.id)[0].fileEvidence!.speakerAttribution,undefined,'new acoustic separation cannot inherit old label identities');
});

test('formal audio material preserves anonymous and confirmed speakers and republishes corrections',async t=>{
 const f=await fixture(t);await f.processing.tick();
 const materials=new MaterialStore(f.store),work=new MaterialMemoryWork(f.store,materials),organizers=new MaterialOrganizerRuntime(f.store,materials,[],undefined,work);
 const reviews=new FileReviews(f.files,f.processing),raw=f.files.chunks(f.id),artifactId=raw[0].fileEvidence!.artifactId;
 const id=materialId('phone','fixture.wav');
 const publish=async()=>{while(await organizers.tick(100));return materials.get(id)!;};
 try{
  const anonymous=await publish(),anonymousEvidence=materials.evidence(materials.evidenceIds(anonymous.ref));
  assert.ok(anonymousEvidence.some(record=>formalValue(record).speaker==='SPEAKER_0'));
  assert.ok(anonymousEvidence.every(record=>formalValue(record).speakerAttribution===undefined));
  reviews.nameSpeakers(f.id,{artifactId,names:{SPEAKER_0:'Generated Alice',SPEAKER_1:'Generated Bob'}});
  const named=await publish();assert.notEqual(named.revision,anonymous.revision);assert.equal(work.readyForMemory(named.ref),true);
  const namedRecords=materials.evidence(materials.evidenceIds(named.ref)),dialogue=namedRecords.map(record=>formalValue(record)).filter(value=>value.speaker);
  assert.deepEqual(dialogue.map(value=>value.text),raw.map(record=>record.ocrText.replace(/^\[SPEAKER_\d+\] /,'')));
  assert.deepEqual(dialogue.map(value=>value.speakerAttribution),f.files.chunks(f.id).map(record=>record.fileEvidence!.speakerAttribution));
  const memories=new MemoryStore(f.store,ids=>materials.evidence(ids),anchor=>materials.isCurrentEvidence(anchor));
  const record=namedRecords.find(record=>formalValue(record).speaker==='SPEAKER_0')!;
  const memory=memories.extract(fixtureMemoryResult(memories,{answer:JSON.stringify({memories:[{title:'Generated owner experience',statement:`Generated speech [${record.id}]`,uncertainty:'Fixture',evidenceIds:[record.id],evidence:[{id:record.id,quote:record.ocrText}]}]}),citations:[{id:record.id,capturedAt:record.capturedAt,appName:record.appName,excerpt:record.ocrText}],trace:[],runId:'generated-material-speaker'}),'fixture').items[0];
  memories.publish(memory.id);
  const other=namedRecords.find(record=>formalValue(record).speaker==='SPEAKER_1')!;
  const otherFingerprint=memoryEvidenceFingerprint(other);
  const otherMemory=memories.extract(fixtureMemoryResult(memories,{answer:JSON.stringify({memories:[{title:'Unchanged speaker',statement:`Generated speech [${other.id}]`,uncertainty:'Fixture',evidenceIds:[other.id],evidence:[{id:other.id,quote:other.ocrText}]}]}),citations:[{id:other.id,capturedAt:other.capturedAt,appName:other.appName,excerpt:other.ocrText}],trace:[],runId:'generated-unchanged-speaker'}),'fixture').items[0];
  memories.publish(otherMemory.id);
  assert.ok(evidenceDependents(f.store,{kind:'file_chunk',id:raw[0].id}).some(node=>node.kind==='material_evidence'&&node.id===record.id));
  reviews.nameSpeakers(f.id,{artifactId,names:{SPEAKER_0:'Generated Carol',SPEAKER_1:'Generated Bob'}});
  assert.equal(memories.get(memory.id).status,'stale','old formal attribution is invalid immediately, before rebuilding');
  assert.equal(materials.isCurrentEvidence(record.id),false);
  assert.equal(materials.isCurrentEvidence(other.id),true);
  assert.equal(memories.get(otherMemory.id).status,'published');
  assert.equal(materials.get(id)?.coverage.reason,'source_evidence_changed');
  assert.equal(work.readyForMemory(named.ref),false);
  assert.throws(()=>materials.read(named.ref),{statusCode:409},'current whole-body read cannot expose old names while rebuilding');
  const corrected=await publish();assert.notEqual(corrected.revision,named.revision);assert.equal(work.readyForMemory(named.ref),false);
  assert.equal(memories.get(memory.id).status,'stale');assert.equal(materials.isCurrentEvidence(record.id),false);
  assert.equal(materials.isCurrentEvidence(other.id),true,'unaffected block anchor survives publication');
  assert.equal(memories.get(otherMemory.id).status,'published');
  assert.equal(memoryEvidenceFingerprint(materials.evidence([other.id])[0]),otherFingerprint);
  assert.ok(materials.evidenceIds(corrected.ref).includes(other.id));
  const reader=new EvidenceReader(f.store,f.sources,f.files,undefined,undefined,materials);
  assert.equal(reader.evidence(fixtureCaptureRefs([record.id])).length,0);
  assert.ok(reader.evidence(fixtureCaptureRefs([other.id]))[0].provenance!.uri!.startsWith(corrected.ref+'#'));
  assert.ok(materials.read(named.ref).text.includes('Generated Alice'),'pinned history remains distinguishable from current state');
  const correctedDialogue=materials.evidence(materials.evidenceIds(id)).map(record=>formalValue(record)).filter(value=>value.speaker);
  assert.equal(correctedDialogue[0].speakerAttribution.name,'Generated Carol');assert.equal(correctedDialogue[1].speakerAttribution.name,'Generated Bob');
  assert.deepEqual(correctedDialogue.map(value=>value.text),dialogue.map(value=>value.text));
  reviews.nameSpeakers(f.id,{artifactId,names:{SPEAKER_0:'Generated Carol',SPEAKER_1:'Generated Bob'}});assert.equal((await publish()).revision,corrected.revision);
  reviews.nameSpeakers(f.id,{artifactId,names:{SPEAKER_0:'Generated Carol'}});
  assert.equal(memories.get(otherMemory.id).status,'stale','withdrawing confirmation invalidates that speaker immediately');
  await publish();assert.equal(materials.evidence(materials.evidenceIds(id)).map(r=>formalValue(r)).find(r=>r.speaker==='SPEAKER_1').speakerAttribution,undefined);
 }finally{await organizers.close();}
});

test('repeated text corrections retain simultaneous segment order and remove only obsolete word alignment',async t=>{
 let original='扣迪斯',replacement='Cordis';
 const transcript:Transcript={durationMs:3000,segments:[raw.segments[0],{startMs:0,endMs:1000,text:'尚未完成。',words:[{startMs:0,endMs:1000,text:'尚未完成。'}]}]};
 const f=await fixture(t,{settings:{audioProcessor:'audio.http',summarize:false},transcribe:async()=>transcript,analyze:async(records:any[])=>{const chunk=JSON.parse(records[0].ocrText);return {answer:JSON.stringify({suggestions:[{chunkId:chunk.chunkId,original,replacement,reason:'Generated correction'}]}),citations:[{id:chunk.chunkId}]};}});
 await f.processing.tick();const reviews=new FileReviews(f.files,f.processing),initial=f.files.chunks(f.id),initialArtifact=initial[0].fileEvidence!.artifactId;
 const before=f.processing.artifact(initialArtifact).transcript as Transcript;assert.ok(before.segments[0].words?.length);assert.ok(before.segments[1].words?.length);
 for(const word of ['Cordis','Mote']){
  replacement=word;const proposal=await reviews.propose(f.id,{kind:'terms'});reviews.confirm(f.id,proposal.id,{action:'accept',selected:[proposal.suggestions[0].id]});
  const chunks=f.files.chunks(f.id),after=f.processing.artifact(chunks[0].fileEvidence!.artifactId).transcript as Transcript;
  assert.deepEqual(chunks.map(c=>c.ocrText.replace(/^\[SPEAKER_\w+\] /,'')),after.segments.map(s=>s.text));
  assert.equal(chunks[1].id,initial[1].id);assert.ok(chunks[0].ocrText.includes(word));
  assert.equal(after.segments[0].words,undefined);assert.deepEqual(after.segments[1].words,before.segments[1].words);
  original=word;
 }
 assert.equal(f.processing.artifact(initialArtifact).transcript.segments[0].text,before.segments[0].text);
});

for(const change of ['geometry','text'] as const)test(`image ${change} changes preserve unrelated evidence and carry original-pixel locations through file and Material reads`,async t=>{
 const location=(x:number,y:number)=>({width:128,height:600,polygon:[[x,y],[x+30,y],[x+30,y+12],[x,y+12]] as [number,number][]});
 const transcript:Transcript={durationMs:0,segments:[{startMs:0,endMs:0,text:'Same words',imageLocation:location(8,40)},{startMs:0,endMs:0,text:'Same words',imageLocation:location(75,300)}]};
 const bytes=await sharp({create:{width:128,height:600,channels:3,background:'#ffffff'}}).png().toBuffer();
 const f=await fixture(t,{file:{name:'generated.png',mimeType:'image/png',bytes},settings:{imageProcessor:'image.http',imageEndpoint:'http://127.0.0.1:9008/ocr',summarize:false},
  analyze:async(records:any[])=>{const chunk=JSON.parse(records[0].ocrText);return {answer:JSON.stringify({suggestions:[{chunkId:chunk.chunkId,original:'Same words',replacement:'Corrected first line',reason:'Generated correction'}]}),citations:[{id:chunk.chunkId}]};}});
 let calls=0;f.processing.runtime.registry.get('image.http').process=async()=>{calls++;return structuredClone(transcript);};
 await f.processing.tick();assert.equal(calls,1);const before=f.files.chunks(f.id);
 assert.equal(before.length,2);assert.notEqual(before[0].id,before[1].id,'repeated words in different regions remain distinct evidence');
 assert.deepEqual(before.map(r=>r.fileEvidence!.imageLocation),transcript.segments.map(s=>s.imageLocation));
 assert.ok(before.every(r=>r.fileEvidence!.startMs===undefined&&r.fileEvidence!.speaker===undefined));
 const materials=new MaterialStore(f.store),work=new MaterialMemoryWork(f.store,materials),organizers=new MaterialOrganizerRuntime(f.store,materials,[],undefined,work);
 try{
  while(await organizers.tick(100));const first=materials.get(materialId('phone','generated.png'))!;
  const anchors=materials.evidence(materials.evidenceIds(first.ref)).filter(r=>formalValue(r).imageLocation);
  assert.equal(anchors.length,2);assert.deepEqual(anchors.map(r=>formalValue(r).imageLocation),transcript.segments.map(s=>s.imageLocation));
  assert.deepEqual(materials.block(first.ref,1)!.block.locator!.imageLocation,transcript.segments[0].imageLocation);
  const view=sourceMaterialView(materials,first.id,{revision:first.revision});
  assert.deepEqual(view.items.filter(i=>i.type==='text').map(i=>i.text),['Same words','Same words']);
  assert.ok(view.items.every(i=>!i.speaker&&!i.confirmedName&&i.startMs===undefined));
  const memories=new MemoryStore(f.store,ids=>materials.evidence(ids),id=>materials.isCurrentEvidence(id));
  const saved=anchors.map(r=>memories.publish(memories.extract(fixtureMemoryResult(memories,{answer:JSON.stringify({memories:[{title:'Generated image fixture',statement:`Generated text [${r.id}]`,uncertainty:'Fixture',evidenceIds:[r.id],evidence:[{id:r.id,quote:r.ocrText}]}]}),citations:[{id:r.id,capturedAt:r.capturedAt,appName:r.appName,excerpt:r.ocrText}],trace:[],runId:'generated-image'}),'fixture').items[0].id));
  if(change==='geometry'){transcript.segments[0].imageLocation=location(12,45);f.processing.retry(f.id);await f.processing.tick();assert.equal(calls,2);}
  else {const reviews=new FileReviews(f.files,f.processing),proposal=await reviews.propose(f.id,{kind:'terms'});reviews.confirm(f.id,proposal.id,{action:'accept',selected:[proposal.suggestions[0].id]});assert.equal(calls,1);}
  const after=f.files.chunks(f.id);assert.notEqual(after[0].id,before[0].id);assert.equal(after[1].id,before[1].id);
  assert.deepEqual(after.map(r=>r.fileEvidence!.imageLocation),transcript.segments.map(s=>s.imageLocation));
  assert.equal(memories.get(saved[0].id).status,'stale');assert.equal(memories.get(saved[1].id).status,'published');
  while(await organizers.tick(100));assert.equal(materials.isCurrentEvidence(anchors[1].id),true);
  const second=materials.get(first.id)!;assert.notEqual(second.ref,first.ref);
  assert.equal(decodeSourceText('speech-text-v2',materials.block(first.ref,1)!.block.text)!.text,'Same words','historical OCR stays readable');
  assert.deepEqual(decodeSourceText('speech-text-v2',materials.block(first.ref,1)!.block.text)!.imageLocation,before[0].fileEvidence!.imageLocation);
  assert.deepEqual(decodeSourceText('speech-text-v2',materials.block(second.ref,1)!.block.text)!.imageLocation,after[0].fileEvidence!.imageLocation);
 }finally{await organizers.close();}
});

test('local semantic grouping blocks without a local model and never invokes the default summarizer',async t=>{
 const f=await fixture(t,{settings:{semanticTurns:true}});await f.processing.tick();assert.equal(f.files.detail(f.id).job.state,'blocked');assert.equal(f.counts().summaries,0);assert.ok(f.files.detail(f.id).artifacts.some((a:any)=>a.kind==='dialogue'));
});

test('shared engine shutdown fences an uncooperative file provider and resumes the durable program',async t=>{
 let begin!:()=>void,release!:(v:Transcript)=>void,calls=0;const started=new Promise<void>(r=>begin=r);
 const f=await fixture(t,{transcribe:()=>{if(++calls===1){begin();return new Promise<Transcript>(r=>release=r);}return raw;}});
 await f.processing.close();const engine=new ExecutionEngine(f.store),processing=f.createProcessing(engine);await processing.runtime.ready;
 const ids=processing.prepare(),run=engine.drain(ids);await started;
 await engine.close();await run;await processing.close();
 assert.equal(engine.get(ids[0])!.state,'waiting');assert.equal(f.files.detail(f.id).artifacts.length,0);
 const resumed=f.createProcessing();await resumed.tick();assert.equal(resumed.cancellation(f.id).wait,'unknown');assert.equal(calls,1);assert.throws(()=>resumed.retry(f.id),{statusCode:409});resumed.retry(f.id,'transcribe',false,true);await resumed.tick();assert.equal(f.files.detail(f.id).job.state,'succeeded');
 release({...raw,segments:[{startMs:0,endMs:1000,text:'Late synthetic result must not replace committed output'}]});await new Promise(r=>setImmediate(r));
 assert.equal(calls,2);assert.equal(f.files.detail(f.id).artifacts.filter((a:any)=>a.kind==='transcript').length,1);assert.ok(!JSON.stringify(f.files.chunks(f.id)).includes('Late synthetic'));
 const steps=resumed.engine.list({operationId:'file:'+f.id,limit:100}).items;assert.equal(steps.find(s=>s.kind==='files.pipeline')!.state,'succeeded');assert.equal(steps.filter(s=>s.kind.startsWith('file-step.')).length,3);
 assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM file_usage').get()!.n,0);
});

test('cancel fences a held processor result, blocks retry until it returns, and preserves original',async t=>{
 let release!:()=>void,entered!:()=>void;const started=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve);let signal:AbortSignal|undefined;
 const f=await fixture(t,{transcribe:async(input:any)=>{signal=input.signal;entered();await gate;return raw;}}),original=JSON.stringify(f.files.version(f.id));
 const task=f.processing.tick();await started;
 assert.equal(f.processing.cancel(f.id).state,'cancelled');await task;
 assert.equal(signal!.aborted,false,'manual cancellation does not misrepresent HTTP physical completion');
 assert.equal(f.processing.cancellation(f.id).wait,'running');assert.throws(()=>f.processing.retry(f.id),{statusCode:409});
 release();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.processing.cancellation(f.id).wait,null);assert.equal(f.files.detail(f.id).job.state,'cancelled');assert.equal(f.files.detail(f.id).artifacts.length,0);assert.equal(f.counts().diaryCalls,0);
 assert.equal(JSON.stringify(f.files.version(f.id)),original);await f.processing.tick();assert.equal(f.counts().asrCalls,1,'background ticks cannot revive cancellation');
 f.processing.retry(f.id);await f.processing.tick();assert.equal(f.files.detail(f.id).job.state,'succeeded');assert.equal(f.counts().asrCalls,2);
 assert.equal(f.processing.cancel(f.id).state,'completed','disabled optional summary does not make completed pipeline cancellable');
});

test('restart marks an issued processing call unknown until explicit retry',async t=>{
 const f=await fixture(t);const db=f.store.db;
 db.prepare("INSERT INTO file_processor_waits VALUES('generated-resource',?,'old-attempt','running')").run(f.id);
 await f.processing.close();const resumed=f.createProcessing();await resumed.runtime.ready;
 assert.equal(resumed.cancellation(f.id).wait,'unknown');assert.throws(()=>resumed.retry(f.id),{statusCode:409});
 resumed.retry(f.id,'transcribe',false,true);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM file_processor_waits').get()!.n,0);
});

test('definitive local rejection can retry while ambiguous 503 retains its issued-call guard',async t=>{
 let fail=true;const f=await fixture(t,{transcribe:async()=>{if(fail)throw new ProviderFailure({...providerHttpFailure(503),executionStarted:false});return raw;}});
 await f.processing.tick();assert.equal(f.processing.cancellation(f.id).wait,null);assert.equal(f.files.detail(f.id).job.execution.status,'retry_wait');
 fail=false;f.processing.retry(f.id);await f.processing.tick();assert.equal(f.files.detail(f.id).job.state,'succeeded');
 const g=await fixture(t,{transcribe:async()=>{throw new ProviderFailure(providerHttpFailure(503));}});await g.processing.tick();assert.equal(g.processing.cancellation(g.id).wait,'unknown');assert.throws(()=>g.processing.retry(g.id),{statusCode:409});
});

test('file details use the recovered child receipt even when its old program mirror remains waiting',async t=>{
 const f=await fixture(t,{transcribe:async()=>{throw new ProviderFailure(providerHttpFailure(503));}});await f.processing.tick();await f.processing.close();
 const child=f.processing.engine.list({operationId:'file:'+f.id,limit:100}).items.find(step=>step.kind.startsWith('file-step.'))!;
 f.processing.engine.fail(child.id,'processing_limit');
 const restored=f.createProcessing();await restored.runtime.ready;await restored.tick();const detail=f.files.detail(f.id);
 assert.equal(detail.steps.find(s=>s.step==='extract')!.state,'failed');assert.equal(detail.steps.find(s=>s.step==='extract')!.error,'processing_limit');assert.equal(detail.job.state,'failed');assert.equal(new Operations(f.store).detail('file:'+f.id).operation.state,'failed');assert.equal(f.counts().asrCalls,1);assert.equal(restored.cancellation(f.id).wait,'unknown');
});
