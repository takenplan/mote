import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store,StoreError} from '../src/store.js';
import {SourceStore} from '../src/sources.js';
import {MemoryStore} from '../src/memory.js';
import {MemoryPipeline} from '../src/memory-pipeline.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {MemoryPhaseOutputs} from '../src/memory-phase-outputs.js';

async function fixture(t:import('node:test').TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-phase-output-')),store=new Store(directory),sources=new SourceStore(store),memories=new MemoryStore(store);
 sources.register({id:'generated',name:'Generated',kind:'custom',deviceId:'generated',platform:'import'});
 const record=await sources.upsert('generated',{externalId:'one',revision:'1',observedAt:'2026-10-01T00:00:00Z',title:'Generated',kind:'file',layer:'original',text:'Generated original for phase recovery.'});
 const pipeline=new MemoryPipeline({store,memories,model:()=> 'generated',configured:()=>true,query:async()=>({answer:'{"memories":[]}',citations:[],trace:[],runId:'generated'})});
 const job=pipeline.create({evidenceIds:[record.id]}),batch=job.batches[0],engine=pipeline.engine,outputs=new MemoryPhaseOutputs(store,engine);
 t.after(async()=>{await pipeline.close();store.close();rmSync(directory,{recursive:true,force:true});});
 return {store,engine,outputs,pipeline,jobId:job.id,batchId:batch.id,record};
}

test('a single-attempt coordinator can complete a three-attempt child and retain a full large committed output',async t=>{
 const f=await fixture(t);let calls=0,received:unknown;
 const expected={answer:'Generated long output 🌱 '.repeat(30000)+' EXACT COMPLETE TAIL',receipts:[{id:f.record.id,offset:0,length:25}]};
 assert.ok(Buffer.byteLength(JSON.stringify(expected))>512*1024);
 f.engine.register({kind:'generated-parent',pool:'generated-parent',concurrency:()=>1,policy:EXECUTION_POLICIES.control,validate:()=>true,
  execute:(_step,signal)=>f.outputs.run({batchId:f.batchId,jobId:f.jobId,phase:'extract',inputHash:'generated-large',generation:'frozen',signal,validate:()=>true,assertCommit:()=>{},execute:async()=>{if(++calls<3)throw new ExecutionFailure('transient','provider_network',0);return expected;}}),commit:(_step,result)=>{received=result;}});
 const id=f.engine.enqueue('generated-parent','generated-parent',{});await f.engine.drain([id]);assert.equal(calls,3);assert.deepEqual(received,expected);assert.equal(f.engine.get(id)!.attempts,1);
 const child=f.outputs.id(f.batchId,'extract','generated-large');assert.equal(f.engine.get(child)!.state,'succeeded');assert.equal(f.engine.get(child)!.attempts,3);
 f.engine.retry(id,true);await f.engine.drain([id]);assert.equal(calls,3);assert.deepEqual(received,expected);
});

for(const corruption of ['missing','corrupt'] as const)test(`a succeeded phase with ${corruption} output fails closed instead of calling its model again`,async t=>{
 const f=await fixture(t);let calls=0;
 const run=()=>f.outputs.run({batchId:f.batchId,jobId:f.jobId,phase:'review' as const,inputHash:'generated-durable',generation:'frozen',signal:new AbortController().signal,validate:()=>true,assertCommit:()=>{},execute:async()=>{calls++;return {answer:'Generated complete output'};}});
 await run();const child=f.outputs.id(f.batchId,'review','generated-durable');
 if(corruption==='missing')f.store.db.prepare('DELETE FROM memory_phase_outputs WHERE step_id=?').run(child);
 else f.store.db.prepare("UPDATE memory_phase_outputs SET json='invalid JSON' WHERE step_id=?").run(child);
 await assert.rejects(run(),error=>error instanceof ExecutionFailure&&error.category==='permanent'&&error.code===`memory_phase_output_${corruption==='missing'?'missing':'invalid'}`);
 assert.equal(calls,1);assert.equal(f.engine.get(child)!.state,'succeeded');
});

test('output and success commit atomically, and cancellation removes the committed private checkpoint',async t=>{
 const f=await fixture(t);let allow=false,calls=0;
 const run=()=>f.outputs.run({batchId:f.batchId,jobId:f.jobId,phase:'extract' as const,inputHash:'generated-atomic',generation:'frozen',signal:new AbortController().signal,validate:()=>true,assertCommit:()=>{if(!allow)throw new StoreError('Generated metadata quota',507);},execute:async()=>{calls++;return {answer:'Generated private output'};}});
 await assert.rejects(run());const child=f.outputs.id(f.batchId,'extract','generated-atomic');assert.equal(f.engine.get(child)!.state,'blocked');assert.equal(f.engine.get(child)!.error,'storage_full');assert.equal(f.outputs.read(child,'generated-atomic'),undefined);
 allow=true;f.engine.retry(child,true);await run();assert.equal(f.engine.get(child)!.state,'succeeded');assert.equal(calls,2);
 f.store.db.prepare("UPDATE memory_jobs SET json=json_set(json,'$.status','cancelled') WHERE id=?").run(f.jobId);assert.equal(f.outputs.read(child,'generated-atomic'),undefined);
});

for(const boundary of ['before-commit','after-commit'] as const)test(`actual process loss ${boundary} only reuses durably committed phase output`,async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-phase-crash-')),callsFile=join(directory,'generated-calls');
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const source=`
 import {appendFileSync} from 'node:fs';
 import {Store} from ${JSON.stringify(new URL('../src/store.ts',import.meta.url).href)};
 import {SourceStore} from ${JSON.stringify(new URL('../src/sources.ts',import.meta.url).href)};
 import {MemoryStore} from ${JSON.stringify(new URL('../src/memory.ts',import.meta.url).href)};
 import {MemoryPipeline} from ${JSON.stringify(new URL('../src/memory-pipeline.ts',import.meta.url).href)};
 import {MemoryPhaseOutputs} from ${JSON.stringify(new URL('../src/memory-phase-outputs.ts',import.meta.url).href)};
 const store=new Store(${JSON.stringify(directory)}),sources=new SourceStore(store),memories=new MemoryStore(store);
 sources.register({id:'generated',name:'Generated',kind:'custom',deviceId:'generated',platform:'import'});
 const record=await sources.upsert('generated',{externalId:'one',revision:'1',observedAt:'2026-10-01T00:00:00Z',title:'Generated',kind:'file',layer:'original',text:'Generated process recovery original.'});
 const pipeline=new MemoryPipeline({store,memories,configured:()=>true,model:()=> 'generated',query:async()=>({answer:'{}',citations:[],trace:[],runId:'unused'})});
 const job=pipeline.create({evidenceIds:[record.id]}),outputs=new MemoryPhaseOutputs(store,pipeline.engine);
 await outputs.run({batchId:job.batches[0].id,jobId:job.id,phase:'extract',inputHash:'generated-crash',generation:'frozen',signal:new AbortController().signal,validate:()=>true,assertCommit:()=>{},execute:async()=>{appendFileSync(${JSON.stringify(callsFile)},'call\\n');if(${JSON.stringify(boundary)}==='before-commit')process.exit(23);return {answer:'Complete committed response',runId:'generated-original'};}});
 process.exit(24);`;
 const child=spawnSync(process.execPath,['--import','tsx','--input-type=module','--eval',source],{encoding:'utf8',timeout:15000});
 assert.equal(child.status,boundary==='before-commit'?23:24,child.stderr);
 const store=new Store(directory),memories=new MemoryStore(store),pipeline=new MemoryPipeline({store,memories,configured:()=>true,model:()=> 'generated',query:async()=>({answer:'{}',citations:[],trace:[],runId:'unused'})});
 t.after(async()=>{await pipeline.close();store.close();});
 const batch=store.db.prepare('SELECT id,job_id FROM memory_batches').get()!,outputs=new MemoryPhaseOutputs(store,pipeline.engine);let recoveryCalls=0;
 // The elapsed lease is controlled after the actual process has exited.
 store.db.prepare("UPDATE execution_steps SET lease_until=0 WHERE state='running'").run();
 const result=await outputs.run({batchId:String(batch.id),jobId:String(batch.job_id),phase:'extract',inputHash:'generated-crash',generation:'frozen',signal:new AbortController().signal,validate:()=>true,assertCommit:()=>{},execute:async()=>{recoveryCalls++;return {answer:'Complete committed response',runId:'generated-recovery'};}});
 assert.equal(readFileSync(callsFile,'utf8'),'call\n');assert.equal(recoveryCalls,boundary==='before-commit'?1:0);assert.equal(result.runId,boundary==='before-commit'?'generated-recovery':'generated-original');
});
