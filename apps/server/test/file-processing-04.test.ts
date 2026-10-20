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

test('export contains raw and speaker transcripts, valid tar headers, encrypted samples, and forget cascades derived state',async t=>{
 const f=await fixture(t);await f.processing.tick();const entries=fileExportEntries(f.files,f.id);
 for(const name of ['原始转写_未校正.md','带说话人_未校正完整记录.csv','diarization.rttm','diarization.json','diarization.csv','speaker_samples/SPEAKER_0.wav'])assert.ok(entries.some(e=>e.name===name),name);
 const parts:Buffer[]=[];for await(const part of exportTar(entries))parts.push(part);const tar=gunzipSync(Buffer.concat(parts));let offset=0;
 for(const entry of entries){const header=tar.subarray(offset,offset+512);assert.equal(header.subarray(0,100).toString().replace(/\0.*$/s,''),entry.name);const length=parseInt(header.subarray(124,136).toString(),8);assert.equal(length,entry.bytes.length);assert.deepEqual(tar.subarray(offset+512,offset+512+length),entry.bytes);offset+=512+Math.ceil(length/512)*512;}
 const hash=String(f.store.db.prepare('SELECT object_hash FROM file_assets').get()!.object_hash);assert.notDeepEqual(readFileSync(join(f.files.objects,hash,'0.aes')),wave);
 assert.throws(()=>f.files.asset(f.id,f.files.detail(f.id).artifacts.find((a:any)=>a.kind==='diarization')!.id,'../original'),{statusCode:404});
 f.files.forget(f.id);for(const table of ['file_steps','file_assets','file_reviews','file_chunks'])assert.equal(f.store.db.prepare(`SELECT COUNT(*) n FROM ${table}`).get()!.n,0);
});

test('confirmed speaker identities reach evidence without rewriting speech and only invalidate changed labels',async t=>{
 const f=await fixture(t);await f.processing.tick();const reviews=new FileReviews(f.files,f.processing),raw=f.files.chunks(f.id),artifactId=raw[0].fileEvidence!.artifactId;
 const save=(names:Record<string,string>)=>reviews.nameSpeakers(f.id,{artifactId,names});
 save({SPEAKER_0:'Generated Alice',SPEAKER_1:'Generated Bob'});
 const named=f.files.chunks(f.id);assert.deepEqual(named.map(r=>r.ocrText),raw.map(r=>r.ocrText));assert.deepEqual(named.map(r=>r.id),raw.map(r=>r.id));
 assert.equal(named[0].fileEvidence!.speakerAttribution!.name,'Generated Alice');assert.equal(named[0].fileEvidence!.speakerAttribution!.confirmedBy,'owner');
 assert.deepEqual(f.files.evidence(named.map(r=>r.id)).map(r=>r.fileEvidence),named.map(r=>r.fileEvidence));
 const memories=new MemoryStore(f.store,ids=>[...f.store.evidence(ids),...f.files.evidence(ids)],id=>f.files.isCurrentEvidence(id)||f.store.isCurrentEvidence(id));
 const saved=named.map(r=>memories.extract(fixtureMemoryResult(memories,{answer:JSON.stringify({memories:[{title:'Generated attribution',statement:`Recorded speech [${r.id}]`,uncertainty:'Generated fixture',evidenceIds:[r.id],evidence:[{id:r.id,quote:r.ocrText}]}]}),citations:[{id:r.id,capturedAt:r.capturedAt,appName:r.appName,excerpt:r.ocrText}],trace:[],runId:'generated-attribution'}),'fixture').items[0]);
 for(const memory of saved)memories.publish(memory.id);
 save({SPEAKER_0:'Generated Carol',SPEAKER_1:'Generated Bob'});
 const renamed=f.files.chunks(f.id);assert.notEqual(memoryEvidenceFingerprint(renamed[0]),memoryEvidenceFingerprint(named[0]));assert.equal(memoryEvidenceFingerprint(renamed[1]),memoryEvidenceFingerprint(named[1]));
 assert.equal(memories.get(saved[0].id).status,'stale');assert.equal(memories.get(saved[1].id).status,'published');assert.throws(()=>memories.publish(saved[0].id),{statusCode:409});
 const count=f.store.db.prepare("SELECT COUNT(*) n FROM file_artifacts WHERE kind='speaker-names'").get()!.n;
 save({SPEAKER_0:'Generated Carol',SPEAKER_1:'Generated Bob'});assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM file_artifacts WHERE kind='speaker-names'").get()!.n,count,'re-saving unchanged names is idempotent');
 save({SPEAKER_0:'Generated Carol'});assert.equal(f.files.chunks(f.id)[1].fileEvidence!.speakerAttribution,undefined);assert.equal(memories.get(saved[1].id).status,'stale');
 assert.deepEqual(f.files.chunks(f.id).map(r=>r.ocrText),raw.map(r=>r.ocrText));
});

for(const correction of ['speaker','text'] as const)test(`formal ${correction} correction fences a late Memory result before organizer rebuild`,async t=>{
 const f=await fixture(t,{analyze:async(records:any[])=>{const chunk=JSON.parse(records[0].ocrText);return {answer:JSON.stringify({suggestions:[{chunkId:chunk.chunkId,original:'扣迪斯',replacement:'Cordis',reason:'Generated exact correction'}]}),citations:[{id:chunk.chunkId}]};}});await f.processing.tick();
 const materials=new MaterialStore(f.store),work=new MaterialMemoryWork(f.store,materials),organizers=new MaterialOrganizerRuntime(f.store,materials,[],undefined,work);
 const reviews=new FileReviews(f.files,f.processing),artifactId=f.files.chunks(f.id)[0].fileEvidence!.artifactId;
 reviews.nameSpeakers(f.id,{artifactId,names:{SPEAKER_0:'Generated Alice'}});
 const proposal=correction==='text'?await reviews.propose(f.id,{kind:'terms'}):undefined;
 while(await organizers.tick(100));
 const material=materials.get(materialId('phone','fixture.wav'))!;
 const record=materials.evidence(materials.evidenceIds(material.ref)).find(r=>formalValue(r).speaker==='SPEAKER_0')!;
 const memories=new MemoryStore(f.store,ids=>materials.evidence(ids),id=>materials.isCurrentEvidence(id));
 let enter!:()=>void,finish!:()=>void;const entered=new Promise<void>(resolve=>enter=resolve),release=new Promise<void>(resolve=>finish=resolve);
 const pipeline=fixtureMemoryPipeline({store:f.store,memories,configured:()=>true,model:()=> 'fixture',materialAllowedForMemory:ref=>work.readyForMemory(ref),query:async()=>{enter();await release;return {answer:JSON.stringify({memories:[{title:'Old formal attribution',statement:`Old speaker [${record.id}]`,uncertainty:'Generated',evidenceIds:[record.id],evidence:[{id:record.id,quote:record.ocrText}]}]}),citations:[{id:record.id,capturedAt:record.capturedAt,appName:record.appName,excerpt:record.ocrText}],trace:[],runId:'generated-old-formal-attribution'};}});
 try{
  const job=pipeline.create({evidenceIds:[record.id]}),running=pipeline.run(job.id);await entered;
  if(proposal)reviews.confirm(f.id,proposal.id,{action:'accept',selected:[proposal.suggestions[0].id]});
  else reviews.nameSpeakers(f.id,{artifactId,names:{SPEAKER_0:'Generated Carol'}});
  finish();
  const done=await running;assert.equal(done.status,'failed');assert.equal(done.batches[0].status,'invalidated');
  assert.equal(memories.list({includeStale:true}).length,0);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM memory_checkpoints').get()!.n,0);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM memory_extraction_drafts').get()!.n,0);
  assert.throws(()=>pipeline.create({evidenceIds:[record.id]}));
 }finally{finish();await pipeline.close();await organizers.close();}
});

test('calendar association is model-proposed, requires evidence from both sides, and rejects a superseded event',async t=>{
 let eventId='';const f=await fixture(t,{analyze:async(records:any[])=>({answer:JSON.stringify({calendarId:eventId,confidence:'medium',reason:'合成录音时间与候选一致，尚需确认',alternatives:[]}),citations:[{id:records[0].id},{id:eventId}]})});
 f.sources.register({id:'calendar',name:'Synthetic schedule',kind:'custom',deviceId:'phone',platform:'import',retention:'snapshot'});
 const now=new Date().toISOString(),event={externalId:'interview',revision:'1',observedAt:now,title:'Synthetic session',kind:'calendar',layer:'snapshot',text:'Synthetic planned session',calendar:{start:now,end:new Date(Date.now()+3600000).toISOString(),allDay:false,timeZone:'UTC',status:'confirmed'}};
 eventId=(await f.sources.upsert('calendar',event)).id;await f.processing.tick();const reviews=new FileReviews(f.files,f.processing),proposal=await reviews.propose(f.id,{kind:'calendar'});assert.equal(f.files.detail(f.id).artifacts.some((a:any)=>a.kind==='calendar-link'),false);
 reviews.confirm(f.id,proposal.id,{action:'accept'});assert.ok(fileExportEntries(f.files,f.id).some(e=>e.name==='已确认场次.json'));
 const second=await reviews.propose(f.id,{kind:'calendar'});await f.sources.upsert('calendar',{...event,revision:'2',observedAt:new Date(Date.now()+1000).toISOString(),title:'Changed session'});assert.throws(()=>reviews.confirm(f.id,second.id,{action:'accept'}),{statusCode:409});
});

test('old daily usage does not limit new audio processing',async t=>{
 const f=await fixture(t),day=new Date().toISOString().slice(0,10);
 f.store.db.prepare('INSERT INTO file_usage VALUES(?,?)').run(day,24*60*60000);
 await f.processing.tick();assert.equal(f.files.detail(f.id).job.state,'succeeded');assert.equal(f.counts().asrCalls,1);
});

test('explicit worker busy rejection permits ordinary retry without unknown acknowledgement',async t=>{
 let first=true;const f=await fixture(t,{transcribe:async()=>{if(first){first=false;throw new ProviderFailure(providerHttpFailure(429));}return raw;}});
 await f.processing.tick();assert.equal(f.processing.cancellation(f.id).wait,null);f.processing.retry(f.id);await f.processing.tick();assert.equal(f.files.detail(f.id).job.state,'succeeded');
});

test('cancelling diarization retains already committed raw transcript and prevents later stages',async t=>{
 let release!:()=>void,entered!:()=>void;const started=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 const f=await fixture(t,{diarize:async()=>{entered();await gate;return diary;}});const task=f.processing.tick();await started;
 const rawBefore=JSON.stringify(f.files.detail(f.id).artifacts);assert.ok(f.files.detail(f.id).artifacts.some((a:any)=>a.kind==='transcript'));
 f.processing.cancel(f.id);await task;release();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(JSON.stringify(f.files.detail(f.id).artifacts),rawBefore);assert.equal(f.files.detail(f.id).job.state,'cancelled');assert.equal(f.counts().summaries,0);
});

test('actual loopback HTTP response remains held after cancel until bounded call settles',async t=>{
 const {createServer}=await import('node:http');let respond!:()=>void,entered!:()=>void;const started=new Promise<void>(r=>entered=r);
 const server=createServer((req,res)=>{req.resume();req.on('end',()=>{respond=()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(raw));};entered();});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});const address=server.address();assert.ok(address&&typeof address!=='string');
 const provider=new HttpTranscriptionProvider(),f=await fixture(t,{transcribe:(input:any)=>provider.transcribe({...input,localOnly:false,settings:{...input.settings,endpoint:'http://127.0.0.1:'+address.port}})});
 const task=f.processing.tick();await started;f.processing.cancel(f.id);await task;assert.equal(f.processing.cancellation(f.id).wait,'running');assert.throws(()=>f.processing.retry(f.id),{statusCode:409});
 respond();for(let i=0;i<100&&f.processing.cancellation(f.id).wait==='running';i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(f.processing.cancellation(f.id).wait,null);assert.equal(f.files.detail(f.id).artifacts.length,0);assert.equal(f.counts().diaryCalls,0);
});

test('file cancel/retry routes enforce owner access, completion races and explicit unknown consent',async t=>{
 const f=await fixture(t,{transcribe:async()=>{throw new TypeError('generated transport loss');}});await f.processing.tick();
 const {default:Fastify}=await import('fastify'),{registerFileRoutes}=await import('../src/file-routes.js');const app=Fastify();t.after(()=>app.close());
 registerFileRoutes(app,f.files,f.processing,{} as any,()=>{},req=>req.headers['x-generated-device']?'generated-device':undefined,{evidence:()=>[{}]} as any);
 for(const action of ['cancel','retry'])assert.equal((await app.inject({method:'POST',url:'/api/files/'+f.id+'/'+action,payload:{},headers:{'x-generated-device':'true'}})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:'/api/files/'+f.id+'/cancel',payload:{}})).json().state,'cancelled');
 assert.equal((await app.inject({method:'POST',url:'/api/files/'+f.id+'/retry',payload:{}})).statusCode,409);
 assert.equal((await app.inject({method:'POST',url:'/api/files/'+f.id+'/retry',payload:{confirmUnknown:true}})).statusCode,200);
});

test('actual HTTP timeout persists unknown across restart and only explicit retry sends another request',async t=>{
 const {createServer}=await import('node:http');let requests=0,answer=false;
 const server=createServer((req,res)=>{requests++;req.resume();req.on('end',()=>{if(answer){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(raw));}});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});const address=server.address();assert.ok(address&&typeof address!=='string');
 const provider=new HttpTranscriptionProvider(),f=await fixture(t,{settings:{timeoutMs:1000},transcribe:(input:any)=>provider.transcribe({...input,localOnly:false,settings:{...input.settings,endpoint:'http://127.0.0.1:'+address.port}})});
 await f.processing.tick();for(let i=0;i<100&&f.processing.cancellation(f.id).wait==='running';i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(f.processing.cancellation(f.id).wait,'unknown');assert.equal(requests,1);await f.processing.close();const resumed=f.createProcessing();await resumed.runtime.ready;
 await resumed.tick();assert.equal(requests,1);assert.throws(()=>resumed.retry(f.id),{statusCode:409});answer=true;resumed.retry(f.id,'transcribe',false,true);await resumed.tick();assert.equal(requests,2);assert.equal(f.files.detail(f.id).job.state,'succeeded');
});

test('ordinary cooperative processor still receives cancellation and cannot publish its late result',async t=>{
 let enter!:()=>void,release!:()=>void;const started=new Promise<void>(r=>enter=r),gate=new Promise<void>(r=>release=r);let signal:AbortSignal|undefined;
 const f=await fixture(t,{diarize:async(input:any)=>{signal=input.signal;enter();await gate;return diary;}});const task=f.processing.tick();await started;const saved=JSON.stringify(f.files.detail(f.id).artifacts);
 f.processing.cancel(f.id);assert.equal(signal!.aborted,true,'plugins without transport opt-in retain cooperative cancellation');await task;assert.equal(f.processing.cancellation(f.id).wait,'running');release();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.processing.cancellation(f.id).wait,null);assert.equal(JSON.stringify(f.files.detail(f.id).artifacts),saved);
 assert.throws(()=>f.processing.runtime.registry.register({id:'fixture.invalid-cancel',version:'1',name:'Generated',stage:'extract',mediaTypes:['text/'],awaitResponseOnCancel:'yes' as any,process:async()=>raw}));
});

test('archive-only vendor summary is not scheduled and old membership is corrected without model replay',async t=>{
 const f=await fixture(t);const ack=await f.files.transcriptRevision('phone',{externalId:'generated-export',kind:'file',title:'Generated vendor export',observedAt:new Date().toISOString(),deleted:false},'Generated original export',{...raw,coverage:'full'},()=>{});
 await f.processing.tick();const operations=new Operations(f.store);let detail=operations.detail('file:'+ack.id);assert.equal(detail.operation.notScheduled,1);assert.equal(detail.operation.counts.blocked,0);assert.equal(detail.operation.state,'skipped');assert.equal(f.files.detail(ack.id).job.summary_state,'skipped');
 const summary=detail.steps.find(s=>s.kind==='files.summary')!;assert.equal(summary.attempts,0);assert.equal(summary.reason,'archive_only');
 f.store.db.prepare('UPDATE execution_operation_steps SET optional=0 WHERE step_id=?').run(summary.id);assert.equal(operations.detail('file:'+ack.id).operation.state,'blocked');
 await f.processing.close();const restored=f.createProcessing();await restored.runtime.ready;await restored.tick();detail=operations.detail('file:'+ack.id);assert.equal(detail.operation.state,'skipped');assert.equal(detail.steps.find(s=>s.id===summary.id)!.attempts,0);assert.equal(f.counts().summaries,0);
});

test('deployment defaults do not automatically reopen a historical terminal file failure',async t=>{
 const {StoreError}=await import('../src/store.js');let calls=0;
 const f=await fixture(t,{transcribe:async()=>{calls++;throw new StoreError('Generated unsupported format',422);}});await f.processing.tick();
 assert.equal(f.files.detail(f.id).job.state,'failed');await f.processing.close();
 const configuration=f.processing.configurationSnapshot();configuration.settings.timeoutMs=1000;
 const restored=new FileProcessing(f.files,{transcribe:async()=>{calls++;return raw;}},undefined,{configuration});t.after(()=>restored.close());
 await restored.runtime.ready;await restored.tick();assert.equal(calls,1);assert.equal(f.files.detail(f.id).job.state,'failed');
});
