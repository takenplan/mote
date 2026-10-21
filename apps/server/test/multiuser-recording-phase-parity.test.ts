import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {barrier,recordingPhaseHost,recordingRange,until} from './fixtures/recording-phase-host.js';
import {PerformanceFailureObservation} from './fixtures/performance-failure-observation.js';

test('forget committed during the media account preflight prevents the physical provider download',async t=>{
 const p=await recordingPhaseHost(t),{f,state}=p;await p.select(f.a.token);await p.settle(f.a.token);
 const ownerFile=await p.ordinaryAudio(f.a.token),before=p.count(f.a.userId,'media');state.gateAccount=barrier();state.metadataSeen=false;state.postMetadataAccounts=0;
 await p.select(f.a.token,{...recordingRange,start:'2026-10-14T00:00:00Z'});await until(()=>state.accountEntered,'The generated account preflight must be physically held');
 const file=await p.checked(f.a.token,'/api/files/'+ownerFile);await p.checked(f.a.token,'/api/files/'+ownerFile,'DELETE',{operationId:randomUUID(),originalGeneration:file.originalGeneration});state.gateAccount.release();await p.settle(f.a.token);
 assert.equal(p.count(f.a.userId,'media'),before,'A committed forget cannot become a new download after account preflight');assert.equal((await p.page(f.a.token)).items[0].audio.state,'stale');assert.equal((await p.page(f.a.token)).items[0].audioCaptureId,undefined);
 await p.select(f.b.token);await p.settle(f.b.token);assert.equal((await p.page(f.b.token)).items[0].audio.state,'succeeded');
});

test('accepted transcript retries mature with background discovery off and retain their task through restart',async t=>{
 const p=await recordingPhaseHost(t),{f,state}=p;state.failTranscript=1;state.retryAfterMs=2500;
 await p.select(f.a.token);await until(async()=>(await p.page(f.a.token)).items.some((item:any)=>item.transcript.state==='waiting'&&item.transcript.attempts===1),'The first admitted transcript has a future retry');
 const id=f.read(db=>db.prepare("SELECT task_id FROM user_tasks WHERE user_id=? AND json_extract(input,'$.recordingPhase')='transcript'").get(f.a.userId)!.task_id),discoveries=p.count(f.a.userId,'search');await f.restart();await p.settle(f.a.token);
 assert.equal(p.count(f.a.userId,'transcript'),2);assert.equal(p.count(f.a.userId,'search'),discoveries,'Retrying accepted work does not require a fresh discovery');assert.equal((await p.checked(f.a.token,'/api/tasks/'+id)).state,'succeeded');assert.equal((await p.page(f.a.token)).items[0].transcript.attempts,2);
});

for(const discovery of ['held','failed'] as const)test('an accepted transcript retry proceeds independently while a later discovery is '+discovery,async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-18T00:00:00Z')});
 const p=await recordingPhaseHost(t),{f,state}=p;state.failTranscript=1;state.retryAfterMs=120000;await p.select(f.a.token,{...recordingRange,autoSync:true});
 await until(async()=>(await p.page(f.a.token)).items.some((item:any)=>item.transcript.attempts===1&&item.transcript.state==='waiting'),'Initial transcript retry must be admitted');
 if(discovery==='held')state.discoveryGate=barrier();else state.discoveryFail=true;
 t.mock.timers.tick(60001);await until(()=>discovery==='held'?state.discoveryEntered:p.count(f.a.userId,'search')>=2,'Later discovery entered its own acquisition');
 t.mock.timers.tick(60001);await until(async()=>(await p.page(f.a.token)).items[0].transcript.state==='succeeded','Accepted transcript must retry independently of discovery');assert.equal(p.count(f.a.userId,'transcript'),2);state.discoveryGate?.release();
});

test('one slow first audio backup does not block other same-page or later-page canonical transcripts',{timeout:240000},async t=>{
 // Functional coverage: the owner deferred the original latency budgets (PERF-R1-03).
 const functionalWaitMs=45000;
 const observation=new PerformanceFailureObservation('recording-slow-first-audio',value=>t.diagnostic(value));
 const p=await recordingPhaseHost(t,true,observation),{f,state}=p;state.ids=['r1','r2'];state.pages=true;state.mediaGate=barrier();observation.phase('recording-select');await p.select(f.a.token);observation.phase('first-media-wait');await until(observation.poll('first-media',()=>state.mediaEntered),'First audio must be physically held',functionalWaitMs);
 observation.phase('canonical-transcripts-wait');
 await until(observation.poll('canonical-transcripts',async()=>{const items=(await p.page(f.a.token)).items;return ['r1','r2','r3'].every(id=>items.some((item:any)=>item.id===id&&item.transcript.state==='succeeded'));}),'All page transcripts must arrive before the first audio finishes',functionalWaitMs);
 const source=(await p.page(f.a.token)).sourceId;observation.phase('canonical-materials-wait');await until(observation.poll('canonical-materials',async()=>(await p.checked(f.a.token,'/api/materials?sourceId='+source)).items.length===3),'The real processing consumer must publish one canonical Material per recording',functionalWaitMs);
 const materials=(await p.checked(f.a.token,'/api/materials?sourceId='+source)).items;assert.equal(new Set(materials.map((item:any)=>item.id)).size,3);assert.equal(state.maxMedia,1,'The original media pool stays independent and serial');assert.ok(p.calls.some(call=>call.cursor==='page-2'));observation.phase('release-first-media-and-settle');state.mediaGate.release();await p.settle(f.a.token);observation.complete();
});

for(const automatic of [false,true])test('a first saved enabled selection starts once with autoSync='+automatic+' without a manual sync request',async t=>{
 const p=await recordingPhaseHost(t),{f}=p;const saved=await p.select(f.a.token,{...recordingRange,autoSync:automatic});assert.match(saved.result.syncTask.id,/^[a-f0-9]{64}$/);await p.settle(f.a.token);assert.equal(p.count(f.a.userId,'search'),1);assert.equal((await p.page(f.a.token)).items[0].transcript.state,'succeeded');
});

test('a concurrent explicit sync waits for the real successors of reused metadata',async t=>{
 const p=await recordingPhaseHost(t),{f,state}=p;state.mediaGate=barrier();const saved=await p.select(f.a.token);await until(()=>state.mediaEntered,'Media acquisition must be held');
 const second=await p.checked(f.a.token,'/api/connectors/recorder/sync','POST',{operationId:randomUUID()});await until(async()=>(await p.page(f.a.token)).items[0].transcript.state==='succeeded','Transcript is independently archived');
 await new Promise(resolve=>setTimeout(resolve,150));for(const id of [saved.result.syncTask.id,second.id])assert.ok(['waiting','running'].includes((await p.checked(f.a.token,'/api/tasks/'+id)).state),'A parent must not finish while its admitted media successor is held');
 state.mediaGate.release();for(const id of [saved.result.syncTask.id,second.id])assert.equal((await p.waitTask(f.a.token,id)).state,'succeeded');
});

test('cancelling the admitted recording request fences late child publication without cancelling the next periodic discovery or B',async t=>{
 const p=await recordingPhaseHost(t),{f,state}=p;state.mediaGate=barrier();const saved=await p.select(f.a.token,{...recordingRange,autoSync:true});await until(()=>state.mediaEntered,'The original media request must be physically held');
 await p.checked(f.a.token,'/api/tasks/'+saved.result.syncTask.id+'/cancel','POST',{});state.mediaGate.release();await until(async()=>(await p.page(f.a.token)).items[0].audio.state==='stale','A cancelled request cannot publish a late child archive');
 assert.equal((await p.page(f.a.token)).items[0].audioCaptureId,undefined);assert.equal(f.read(db=>db.prepare("SELECT e.state FROM connector_timers c JOIN execution_steps e ON e.id=c.task_id WHERE c.user_id=?").get(f.a.userId)!.state),'waiting');
 await p.select(f.b.token);await p.settle(f.b.token);assert.equal((await p.page(f.b.token)).items[0].audio.state,'succeeded');
});

test('replaying a saved selection after a lost receipt preserves its one admitted sync and does not repeat selection cancellation',async t=>{
 const p=await recordingPhaseHost(t),{f,state}=p;state.discoveryGate=barrier();const body={operation:'select',payload:recordingRange,operationId:randomUUID()},path='/api/connectors/recorder/operations';
 const admitted=await p.checked(f.a.token,path,'POST',body),saved=await p.waitTask(f.a.token,admitted.id);await until(()=>state.discoveryEntered,'The one admitted scan must be held');
 const replay=await p.checked(f.a.token,path,'POST',body);assert.equal(replay.id,admitted.id);assert.equal(replay.result.syncTask.id,saved.result.syncTask.id);assert.ok(['waiting','running'].includes((await p.checked(f.a.token,'/api/tasks/'+saved.result.syncTask.id)).state),'An idempotent ACK recovery cannot run selection cancellation again');
 state.discoveryGate.release();await p.settle(f.a.token);assert.equal(p.count(f.a.userId,'search'),1);assert.equal(p.count(f.a.userId,'transcript'),1);assert.equal(p.count(f.a.userId,'media'),1);
});

test('an older slow media completion cannot rewind the discovery cursor advanced by a later automatic scan',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-18T00:00:00Z')});const p=await recordingPhaseHost(t),{f,state}=p;state.mediaGate=barrier();const {end:_,...selection}=recordingRange;
 await p.select(f.a.token,{...selection,autoSync:true});await until(()=>state.mediaEntered,'First scan media must be held');const cursor=()=>f.read(db=>JSON.parse(String(db.prepare("SELECT json FROM connector_ledger WHERE user_id=? AND instance_id='recorder' AND key='scan-complete'").get(f.a.userId)!.json)));
 const first=cursor();t.mock.timers.tick(60001);await until(()=>cursor().until>first.until,'The second discovery independently advances its own cursor');const advanced=cursor();state.mediaGate.release();await p.settle(f.a.token);assert.deepEqual(cursor(),advanced,'Completing an older archive does not change discovery accounting');
});

test('a new paginated scan can reuse the vendor page token without treating the preceding scan as a cursor cycle',async t=>{
 const p=await recordingPhaseHost(t),{f,state}=p;state.pages=true;await p.select(f.a.token);await p.settle(f.a.token);
 const admitted=await p.checked(f.a.token,'/api/connectors/recorder/sync','POST',{operationId:randomUUID()});assert.equal((await p.waitTask(f.a.token,admitted.id)).state,'succeeded');assert.equal(p.count(f.a.userId,'search'),4);assert.equal((await p.page(f.a.token)).items.length,2);
});
