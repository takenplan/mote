import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {ServerDiagnostics} from '../src/diagnostics.js';
import {ExecutionObservability,executionObservability} from '../src/execution-observability.js';
import {ExecutionEngine,ExecutionFailure,type ExecutionHandler} from '../src/execution-engine.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {Store} from '../src/store.js';

const secret='GENERATED_OBSERVABILITY_PRIVATE_BODY_SQL_TOKEN',taskKey='a'.repeat(64),attemptId=randomUUID(),jobId=randomUUID(),batchId=randomUUID();
const identity={taskId:taskKey,attemptId,attempt:1,jobId,batchId,phase:'extract' as const};
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function logger(t:TestContext,level:'debug'|'info'|'warn'='info'){
 const directory=mkdtempSync(join(tmpdir(),'mote-execution-observation-')),diagnostics=new ServerDiagnostics({directory,enabled:true,level,traceEnabled:false,maxEntries:5000});await diagnostics.init();
 t.after(async()=>{await diagnostics.close();rmSync(directory,{recursive:true,force:true});});return {directory,diagnostics};
}
const observationEvents=(d:ServerDiagnostics)=>d.events(0,5000).items.filter(event=>['task.loop_timing','task.lease_timing','task.lease_renewal','task.lease_recovered','memory.reader_timing'].includes(event.event));

test('dedicated task/attempt and clock metadata is strict without weakening existing UUID fields',async t=>{
 const {diagnostics:d,directory}=await logger(t);d.record('memory.reader_timing',{taskKey,attemptId,jobId,batchId,name:'reader_evidence',phase:'extract',durationMs:123,clockForwardMs:5000,clockBackwardMs:0,leaseRemainingMs:100,leaseOverdueMs:0,...{taskId:taskKey,operationId:'memory:'+taskKey,arguments:secret,result:secret,sql:secret,token:secret}});
 const valid=observationEvents(d)[0];assert.equal(valid.taskKey,taskKey);assert.equal(valid.attemptId,attemptId);assert.equal(valid.jobId,jobId);assert.equal(valid.batchId,batchId);assert.equal(valid.clockForwardMs,5000);assert.equal(valid.taskId,undefined);assert.equal(valid.operationId,undefined);
 for(const invalid of [taskKey.toUpperCase(),'a'.repeat(63),'a'.repeat(65),secret])d.record('memory.reader_timing',{taskKey:invalid,attemptId:secret,clockForwardMs:NaN,clockBackwardMs:Infinity,leaseRemainingMs:-1,leaseOverdueMs:Number.MAX_VALUE,name:'reader_evidence'});
 for(const entry of observationEvents(d).slice(1)){assert.equal(entry.taskKey,undefined);assert.equal(entry.attemptId,undefined);for(const key of ['clockForwardMs','clockBackwardMs','leaseRemainingMs','leaseOverdueMs'])assert.equal((entry as any)[key],undefined);}
 await d.flush();const persisted=readdirSync(directory).filter(name=>name.endsWith('.ndjson')).map(name=>readFileSync(join(directory,name),'utf8')).join('');assert.ok(!persisted.includes(secret));assert.equal(d.snapshot().agentTrace.enabled,false);
});

test('monotonic timer lateness and both wall-clock divergences remain observations with reset baselines',async t=>{
 const {diagnostics:d}=await logger(t);let monotonic=0,wall=1800000000000;const observer=new ExecutionObservability(d,()=>({monotonic,wall}));t.after(()=>observer.close());observer.hostTick();
 monotonic+=350;wall+=5350;observer.hostTick();const forward=observationEvents(d).find(event=>event.event==='task.loop_timing'&&event.reason==='timer_late');assert.ok(forward);assert.equal(forward.name,'host_tick');assert.equal(forward.delayMs,250);assert.equal(forward.clockForwardMs,5000);assert.equal(forward.clockBackwardMs,0);
 monotonic+=350;wall-=650;observer.hostTick();const backward=observationEvents(d).find(event=>event.clockBackwardMs===1000);assert.ok(backward);assert.equal(backward.delayMs,250);
 await d.configure({enabled:false,debug:false,level:'info',traceEnabled:false});assert.equal(d.accepts('info'),false);const count=observationEvents(d).length;monotonic+=100000;wall+=200000;observer.hostTick();assert.equal(observationEvents(d).length,count);
 await d.configure({enabled:true,debug:false,level:'info',traceEnabled:false});observer.hostTick();monotonic+=100;wall+=100;observer.hostTick();assert.equal(observationEvents(d).length,count,'re-enable starts a fresh clock baseline');
 await d.configure({enabled:true,debug:false,level:'silent',traceEnabled:false});assert.equal(d.accepts('error'),false);observer.hostTick();assert.equal(observationEvents(d).length,count);await d.close();assert.equal(d.accepts('info'),false);
});

test('fast info readers aggregate while independent routine/failure quotas bound every diagnostic window',async t=>{
 const {diagnostics:d}=await logger(t);let monotonic=0,wall=1800000000000;const observer=new ExecutionObservability(d,()=>({monotonic,wall}));t.after(()=>observer.close());observer.hostTick();
 for(let i=0;i<100;i++)assert.equal(observer.sync('reader_evidence',identity,()=>i),i);assert.equal(observationEvents(d).filter(event=>event.event==='memory.reader_timing').length,0,'fast successful info readers do not produce individual events');
 for(let i=0;i<100;i++)observer.sync('reader_evidence',identity,()=>{monotonic+=150;wall+=150;});
 for(let i=0;i<100;i++)observer.lease({type:'renew',taskId:taskKey,attemptId,attempt:1,outcome:'cas_missed',durationMs:2,leaseOverdueMs:3});
 const first=observationEvents(d);assert.ok(first.filter(event=>event.event==='memory.reader_timing').length>0);assert.ok(first.filter(event=>event.event==='memory.reader_timing').length<=40);assert.ok(first.some(event=>event.event==='task.lease_renewal'&&event.reason==='cas_missed'),'routine reads cannot consume failure capacity');assert.ok(first.filter(event=>event.reason==='cas_missed').length<=20);assert.ok(first.length<=60);for(const {seq,at,instanceId,event,level,stage,...producer}of first)assert.ok(Buffer.byteLength(JSON.stringify(producer))<=1024);
 monotonic+=60000;wall+=60000;observer.hostTick();const summaries=observationEvents(d).filter(event=>event.event==='task.loop_timing'&&event.state==='summary');assert.equal(summaries.length,1);assert.ok(['window_summary','suppressed_summary'].includes(summaries[0].reason!));assert.ok((summaries[0].dropped??0)+(summaries[0].skipped??0)>0,'suppression is explicit');assert.ok(observationEvents(d).length<=62,'the old window summary and first new-window sample are separately bounded');
 await d.configure({enabled:true,debug:false,level:'warn',traceEnabled:false});assert.equal(d.accepts('info'),false);assert.equal(d.accepts('warn'),true);const at=d.snapshot().lastSeq;observer.sync('reader_evidence',identity,()=>{monotonic+=200;wall+=200;});observer.lease({type:'renew',taskId:taskKey,attemptId,attempt:1,outcome:'renew_exception'});const raised=d.events(at,100).items;assert.ok(raised.every(event=>event.level==='warn'||event.level==='error'));assert.ok(raised.some(event=>event.reason==='renew_exception'));
});

test('timing and logger failures preserve synchronous values, promises and the original errors; close creates no timer',async t=>{
 const {diagnostics:d}=await logger(t,'debug');let monotonic=0,brokenClock=false;const observer=new ExecutionObservability(d,()=>{if(brokenClock)throw Error(secret);return {monotonic,wall:1800000000000+monotonic};});const original=Error(secret);
 assert.equal(observer.sync('query_assert',identity,()=>17),17);assert.throws(()=>observer.sync('query_assert',identity,()=>{throw original;}),error=>error===original);assert.equal(await observer.async('reader_evidence',identity,async()=>23),23);await assert.rejects(observer.async('reader_evidence',identity,async()=>{throw original;}),error=>error===original);
 const record=d.record;d.record=()=>{throw Error(secret);};try{assert.equal(observer.sync('catalog_snapshot',identity,()=>{monotonic+=200;return 29;}),29);assert.throws(()=>observer.sync('query_assert',identity,()=>{throw original;}),error=>error===original);brokenClock=true;assert.equal(await observer.async('reader_evidence',identity,async()=>31),31);observer.hostTick();observer.lease({type:'recover',taskId:taskKey,attemptId,attempt:1,leaseOverdueMs:1});}finally{d.record=record;observer.close();}
 const count=observationEvents(d).length;assert.equal(observer.sync('query_assert',identity,()=>37),37);observer.hostTick();assert.equal(observationEvents(d).length,count);assert.ok(!JSON.stringify(observationEvents(d)).includes(secret));
 const shared=executionObservability(d);assert.ok(shared);assert.equal(executionObservability(d),shared);assert.equal(executionObservability(undefined),undefined);
 let timers=0;const interval=globalThis.setInterval,timeout=globalThis.setTimeout;globalThis.setInterval=(()=>{timers++;throw Error('Generated unexpected observation timer');}) as typeof setInterval;globalThis.setTimeout=(()=>{timers++;throw Error('Generated unexpected observation timer');}) as typeof setTimeout;
 try{const isolated=new ExecutionObservability(d,()=>({monotonic:0,wall:0}));isolated.hostTick();isolated.sync('query_assert',identity,()=>null);isolated.close();}finally{globalThis.setInterval=interval;globalThis.setTimeout=timeout;shared.close();}assert.equal(timers,0);
});

const base:ExecutionHandler={kind:'generated.observation',pool:'generated.observation',policy:EXECUTION_POLICIES.modelCall,concurrency:()=>1,validate:()=>true,execute:async()=>null,commit:()=>{}};
function engineFixture(t:TestContext,real=false){const directory=mkdtempSync(join(tmpdir(),'mote-lease-observation-')),store=new Store(directory);let clock=Date.now();const engine=new ExecutionEngine(store,real?Date.now:()=>clock);t.after(async()=>{await engine.close();store.close();rmSync(directory,{recursive:true,force:true});});return {store,engine,advance:(ms:number)=>{clock+=ms;}};}
type LeaseEvent=Parameters<NonNullable<Parameters<ExecutionEngine['bindObserver']>[0]>>[0];

test('one genuine ten-second SQLite renewal survives a throwing observer and retains the original attempt and commit',{timeout:20000},async t=>{
 const f=engineFixture(t,true),entered=deferred(),release=deferred(),events:LeaseEvent[]=[];let signal!:AbortSignal,calls=0,commits=0;t.after(()=>release.resolve());f.engine.bindObserver(event=>{events.push(event);throw Error(secret);});f.engine.register({...base,execute:async(_step,current)=>{calls++;signal=current;entered.resolve();await release.promise;return 41;},commit:(_step,value)=>{assert.equal(value,41);commits++;}});
 const id=f.engine.enqueue('generated-real-renewal','generated.observation',{}),running=f.engine.drain([id]);try{await entered.promise;const initial=Number(f.store.db.prepare('SELECT lease_until FROM execution_steps WHERE id=?').get(id)!.lease_until),deadline=Date.now()+14000;while(!events.some(event=>event.type==='renew')){assert.ok(Date.now()<deadline,'original ten-second renewal did not run');await delay(25);}const event=events.find(event=>event.type==='renew')!;assert.equal(event.type,'renew');if(event.type!=='renew')assert.fail();assert.equal(event.outcome,'renewed');assert.equal(event.taskId,id);assert.equal(event.attemptId,f.engine.get(id)!.attemptId);assert.equal(event.attempt,1);assert.equal(signal.aborted,false);assert.equal(f.engine.get(id)!.state,'running');assert.equal(f.engine.get(id)!.attempts,1);assert.ok(Number(f.store.db.prepare('SELECT lease_until FROM execution_steps WHERE id=?').get(id)!.lease_until)>initial);}finally{release.resolve();await running;}assert.equal(calls,1);assert.equal(commits,1);assert.equal(f.engine.get(id)!.state,'succeeded');assert.equal(f.engine.get(id)!.attempts,1);assert.ok(!JSON.stringify(events).includes(secret));
});

for(const fault of ['cas_missed','renew_exception'] as const)test('controlled original renewal '+fault+' and recovery preserve the unobserved engine result',async t=>{
 async function run(observed:boolean){const f=engineFixture(t),entered=deferred(),release=deferred(),events:LeaseEvent[]=[];let renewal:undefined|(()=>void),signal!:AbortSignal,calls=0,recovered:undefined|{state:string;error?:string;attempts:number};t.after(()=>release.resolve());if(observed)f.engine.bindObserver(event=>{events.push(event);if(event.type==='recover'){const step=f.engine.get(event.taskId)!;recovered={state:step.state,error:step.error,attempts:step.attempts};}throw Error(secret);});f.engine.register({...base,admit:()=>calls?new ExecutionFailure('waiting','generated_test_hold',60000):undefined,execute:async(_step,current)=>{calls++;signal=current;entered.resolve();await release.promise;return null;}});
  const interval=globalThis.setInterval;globalThis.setInterval=((handler:any,ms?:number,...args:any[])=>{if(ms===10000&&typeof handler==='function')renewal=()=>handler(...args);return Reflect.apply(interval,globalThis,[handler,ms,...args]);}) as typeof setInterval;
  const id=f.engine.enqueue('generated-'+fault,'generated.observation',{});let running:Promise<void>|undefined;try{running=f.engine.drain([id]);await entered.promise;}finally{globalThis.setInterval=interval;}assert.ok(renewal);
  const prepare=f.store.db.prepare;try{if(fault==='cas_missed')f.advance(30001);else f.store.db.prepare=function(sql:string){if(sql.startsWith('UPDATE execution_steps SET lease_until='))throw Error(secret);return Reflect.apply(prepare,this,[sql]);};renewal();}finally{f.store.db.prepare=prepare;release.resolve();}await running!;await f.engine.tick();const step=f.engine.get(id)!,sessions=f.store.db.prepare('SELECT round,charged,executed,pending,open FROM execution_attempt_sessions WHERE step_id=? ORDER BY rowid').all(id);assert.equal(signal.aborted,true);assert.equal(calls,1);assert.equal(step.attempts,1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM execution_retry_rounds WHERE step_id=?').get(id)!.n,0);
  if(observed){const renew=events.find(event=>event.type==='renew');assert.ok(renew);assert.equal(renew.type,'renew');if(renew.type!=='renew')assert.fail();assert.equal(renew.outcome,fault);assert.equal(renew.taskId,id);assert.equal(renew.attempt,1);if(fault==='cas_missed'){const recovery=events.find(event=>event.type==='recover');assert.ok(recovery);assert.equal(recovery.taskId,id);assert.equal(recovery.attempt,1);assert.ok(recovery.leaseOverdueMs>=1);assert.deepEqual(recovered,{state:'waiting',error:'interrupted',attempts:1});}else assert.equal(events.filter(event=>event.type==='recover').length,0);assert.ok(!JSON.stringify(events).includes(secret));}
  const receipt=f.store.db.prepare('SELECT json FROM execution_failures WHERE step_id=?').get(id),failure=receipt?JSON.parse(String(receipt.json)):undefined;
  return {state:step.state,error:step.error,attempts:step.attempts,retryRound:step.retryRound,sessions,failure:failure?{category:failure.category,code:failure.code,attempt:failure.attempt}:undefined};
 }
 const baseline=await run(false),observed=await run(true);assert.deepEqual(observed,baseline);assert.equal(observed.state,fault==='cas_missed'?'waiting':'failed');assert.equal(observed.error,fault==='cas_missed'?'generated_test_hold':'processor_failed');if(fault==='cas_missed')assert.equal(observed.failure,undefined);else assert.deepEqual(observed.failure,{category:'permanent',code:'processor_failed',attempt:1});
});
