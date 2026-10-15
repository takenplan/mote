import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.js';
import {ProcessingRuntime,type ProcessingLane} from '../src/processing-runtime.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import {UsageLedger} from '../src/usage.js';
import {linkOperationParent} from '../src/operation-projection.js';
import {SourceStore} from '../src/sources.js';
import {MemoryStore} from '../src/memory.js';
import {fixtureMemoryPipeline} from './fixtures/memory-result.js';

const lanes:ProcessingLane[]=['extract','aggregate','semantic','memory'];
const observation=(text='Generated evidence')=>({id:randomUUID(),deviceId:'generated',deviceName:'Generated',platform:'import',capturedAt:'2026-10-05T00:00:00Z',durationMs:0,source:'note',appName:'Fixture',ocrText:text,privacy:{excluded:false,redacted:false,mode:'none'}});
function fixture(t:TestContext){
  const directory=mkdtempSync(join(tmpdir(),'mote-continuity-')),store=new Store(directory);
  t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});return store;
}

test('semantic and memory lanes continue beyond both former daily allowances across midnight',async t=>{
  const store=fixture(t);let now=Date.parse('2026-10-05T23:59:59Z');
  const runtime=new ProcessingRuntime(store,[],{semantic:{concurrency:2},memory:{concurrency:2}},()=>now);t.after(()=>runtime.close());
  const record=observation('G'.repeat(12000));await store.ingest(record);
  const calls={semantic:0,memory:0},active={semantic:0,memory:0},peak={semantic:0,memory:0};
  for(const lane of ['semantic','memory'] as const){
    runtime.registry.register({id:'fixture.'+lane,version:'1',lane,async process(input){
      calls[lane]++;active[lane]++;peak[lane]=Math.max(peak[lane],active[lane]);
      assert.equal(input.observations[0].ocrText.length,12000);await new Promise(resolve=>setImmediate(resolve));active[lane]--;
      return [{kind:'generated',text:'Complete',metadata:{}}];
    }});
    for(let index=0;index<105;index++)runtime.enqueue([{name:'s',processor:'fixture.'+lane,inputs:[record.id],config:{index}}]);
  }
  for(let i=0;i<10&&calls.semantic+calls.memory<210;i++)await runtime.tick();
  assert.deepEqual(calls,{semantic:105,memory:105});assert.deepEqual(peak,{semantic:2,memory:2});
  assert.equal(store.db.prepare("SELECT count(*) n FROM processing_jobs WHERE state!='succeeded'").get()!.n,0);
  now+=2000;
  runtime.enqueue([{name:'next',processor:'fixture.semantic',inputs:[record.id],config:{index:105}}]);await runtime.tick();assert.equal(calls.semantic,106);
  assert.equal(store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='processing_usage'").get(),undefined);
});

test('parent re-entry preserves a failed semantic child until an explicit retry',async t=>{
 const store=fixture(t),runtime=new ProcessingRuntime(store);t.after(()=>runtime.close());
 const record=observation();await store.ingest(record);let calls=0,fail=true;
 runtime.registry.register({id:'fixture.terminal-semantic',version:'1',lane:'semantic',async process(){calls++;if(fail)throw Error('Generated unknown processing failure');return [{kind:'generated',text:'Generated explicitly retried result',metadata:{}}];}});
 runtime.engine.register({kind:'fixture.parent',pool:'fixture.parent',policy:EXECUTION_POLICIES.orchestration,concurrency:()=>1,validate:()=>true,admit:()=>new ExecutionFailure('waiting','generated_resource_wait',60000),execute:async()=>undefined,commit:()=>{}});
 const parent=runtime.engine.enqueue('fixture.parent','fixture.parent',{}),steps=[{name:'child',processor:'fixture.terminal-semantic',inputs:[record.id]}];
 const id=runtime.enqueue(steps,{stepId:parent,fence:'generated-first-grant'}).child;await runtime.tick();
 assert.equal(calls,1);assert.equal(runtime.engine.get(id)?.state,'failed');
 const failed=store.db.prepare('SELECT json FROM processing_jobs WHERE id=?').get(id)!.json;
 for(const fence of ['generated-first-grant','generated-renewed-grant']){
  assert.equal(runtime.enqueue(steps,{stepId:parent,fence}).child,id);await runtime.tick();
  assert.equal(calls,1);assert.equal(runtime.engine.get(id)?.state,'failed');assert.equal(store.db.prepare('SELECT json FROM processing_jobs WHERE id=?').get(id)!.json,failed);
 }
 fail=false;runtime.retry(id);await runtime.tick();assert.equal(calls,2);assert.equal(runtime.engine.get(id)?.state,'succeeded');
 runtime.enqueue(steps,{stepId:parent,fence:'generated-next-grant'});await runtime.tick();assert.equal(calls,2,'completed semantic output is reused');
});
