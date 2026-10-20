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

test('25 uploaded recordings survive repeated real HTTP busy responses, share durable waiting and finish after restart',async t=>{
 const {createServer}=await import('node:http');let busy=true,requests=0;
 const server=createServer((req,res)=>{requests++;if(busy){res.writeHead(429,{'Content-Type':'application/json','X-Mote-Execution':'local','X-Mote-Execution-Started':'false','Retry-After':'5'});res.end(JSON.stringify({executionStarted:false}));return;}req.resume();req.on('end',()=>{res.writeHead(200,{'Content-Type':'application/json','X-Mote-Execution':'local'});res.end(JSON.stringify(raw));});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const address=server.address();assert.ok(address&&typeof address!=='string');const endpoint=`http://127.0.0.1:${address.port}/transcribe`;
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const provider=new HttpTranscriptionProvider(),f=await fixture(t,{settings:{endpoint,localEndpoint:endpoint},transcribe:(input:any)=>provider.transcribe(input)});
 const ids=[f.id];for(let i=1;i<25;i++){
  const manifest={sourceId:'phone',item:{externalId:'generated-bulk-'+i,revision:'1',observedAt:new Date().toISOString(),title:'Generated recording '+i,kind:'file' as const,layer:'original' as const,text:'',mimeType:'audio/wav',deleted:false},sizeBytes:wave.length,sha256:sha256(wave)};
  const session=f.files.begin(manifest,()=>{});f.files.part(session.uploadId,0,wave,()=>{});ids.push((await f.files.commit(session.uploadId,()=>{})).id);
 }
 for(let round=0;round<6;round++){
  await f.processing.tick();assert.equal(requests,round+1,'one physical busy rejection cools down all recordings');
  assert.ok(ids.every(id=>f.files.detail(id).job.state==='waiting'));
  assert.equal(f.store.db.prepare("SELECT count(*) n FROM execution_steps WHERE kind LIKE 'file-step.%' AND attempts!=0").get()!.n,0,'confirmed capacity wait spends no child attempt');
  assert.equal(f.store.db.prepare("SELECT count(*) n FROM execution_steps WHERE kind='files.pipeline' AND attempts!=0").get()!.n,0,'parent waiting spends no failure budget');
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM file_processor_waits').get()!.n,0,'explicit non-execution never leaves an unknown-call guard');
  await f.processing.tick();assert.equal(requests,round+1,'no outbound retry occurs before the persisted eligibility time');
  if(round<5)t.mock.timers.tick(5001);
 }
 const waiting=f.processing.engine.list({operationId:'file:'+f.id,kind:'files.pipeline'}).items[0];
 assert.equal(waiting.error,'rate_limited');const event=f.diagnostics.events().items.find(e=>e.event==='file.waiting'&&e.jobId===f.id)!;
 assert.equal(event.category,'rate_limited');assert.ok(event.retryAfterMs!>0&&event.retryAfterMs!<=5000);
 assert.equal(f.files.detail(f.id).job.execution.status,'retry_wait');
 await f.processing.close();const resumed=f.createProcessing();await resumed.runtime.ready;await resumed.tick();assert.equal(requests,6,'restart retains the same shared cooldown');
 assert.equal(f.store.db.prepare("SELECT count(*) n FROM execution_steps WHERE kind LIKE 'file-step.%' AND recovery_deadline!=0").get()!.n,0);
 busy=false;t.mock.timers.tick(7*3600000);await resumed.tick();
 assert.equal(requests,31);assert.ok(ids.every(id=>f.files.detail(id).job.state==='succeeded'));assert.equal(f.counts().diaryCalls,25);
 assert.ok(ids.every(id=>f.files.detail(id).hasOriginal));assert.equal(f.store.db.prepare('SELECT count(*) n FROM file_processor_waits').get()!.n,0);
});
