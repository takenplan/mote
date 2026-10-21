import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {Store} from '../src/store.js';
import {ExecutionEngine,ExecutionFailure,type ExecutionHandler} from '../src/execution-engine.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
function fixture(t:any){const dir=mkdtempSync(join(tmpdir(),'mote-default-retry-')),store=new Store(dir),engines:ExecutionEngine[]=[];let now=Date.now();const create=(db=store)=>{const engine=new ExecutionEngine(db,()=>now);engines.push(engine);return engine;};const engine=create();t.after(async()=>{await Promise.all(engines.map(e=>e.close()));store.close();rmSync(dir,{recursive:true,force:true});});return {dir,store,engine,create,advance:(ms:number)=>{now+=ms;}};}
const base:ExecutionHandler={kind:'generated',pool:'generated',policy:EXECUTION_POLICIES.modelCall,concurrency:()=>1,validate:()=>true,execute:async()=>null,commit:()=>{}};

test('execution markers belong to the genuine claim while a consumed logical session survives restart',async t=>{
 const f=fixture(t);let first=true,stale:import('../src/execution-engine.js').ExecutionGrant|undefined;
 const handler:ExecutionHandler={...base,execute:async(_step,_signal,grant)=>{
  assert.equal(grant.executionMarker(),0);assert.equal(grant.hasExecuted(),!first);
  grant.recordExecution();assert.equal(grant.executionMarker(),1);assert.equal(grant.hasExecuted(),true);
  if(first){first=false;stale=grant;throw new ExecutionFailure('waiting','generated_capacity',60000,{executionStarted:false});}return null;
 }};
 f.engine.register(handler);const id=f.engine.enqueue('marker-session','generated',{});await f.engine.drain([id]);const session=f.engine.get(id)!.attemptId;
 assert.equal(f.engine.get(id)!.attempts,1);assert.throws(()=>stale!.recordExecution(),{code:'grant_revoked'});assert.equal(stale!.executionMarker(),1);
 await f.engine.close();f.advance(60001);const next=f.create();next.register(handler);await next.drain([id]);assert.equal(next.get(id)!.state,'succeeded');assert.equal(next.get(id)!.attempts,1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM execution_attempt_sessions WHERE step_id=?').get(id)!.n,1);assert.equal(f.store.db.prepare('SELECT id FROM execution_attempt_sessions WHERE step_id=?').get(id)!.id,session);
});

test('host preparation stays uncharged and startAttempt charges once before reconciliation without fabricating a physical call',async t=>{
 const f=fixture(t);let prepared=false,entered=0,stale:undefined|(()=>void);
 f.engine.register({...base,deferAttempts:true,execute:async(step,_signal,grant)=>{
  if(!prepared)throw new ExecutionFailure('blocked','generated_snapshot_unavailable',undefined,{executionStarted:false});
  grant.startAttempt();grant.startAttempt();entered++;stale=()=>grant.startAttempt();
  assert.equal(step.attempts,1);const session=f.store.db.prepare('SELECT charged,executed,pending FROM execution_attempt_sessions WHERE id=?').get(step.attemptId!);assert.deepEqual({...session},{charged:1,executed:0,pending:0});
  assert.equal(f.store.db.prepare('SELECT charged FROM execution_attempt_charges WHERE step_id=?').get(step.id)!.charged,1);return null;
 }});
 const id=f.engine.enqueue('prepare-first','generated',{});await f.engine.drain([id]);assert.equal(f.engine.get(id)!.state,'blocked');assert.equal(f.engine.get(id)!.attempts,0);assert.equal(entered,0);
 prepared=true;f.engine.retry(id);await f.engine.drain([id]);assert.equal(f.engine.get(id)!.state,'succeeded');assert.equal(f.engine.get(id)!.attempts,1);assert.equal(entered,1);assert.throws(stale!,{code:'grant_revoked'});assert.equal(f.engine.get(id)!.attempts,1);
});

test('a failure after host startAttempt still exhausts the default three actual handler entries',async t=>{
 const f=fixture(t);let entered=0;f.engine.register({...base,deferAttempts:true,execute:async(_step,_signal,grant)=>{grant.startAttempt();entered++;throw new ExecutionFailure('transient','generated_reconciliation_failed',0);}});
 const id=f.engine.enqueue('reconcile-first','generated',{});await f.engine.drain([id]);assert.equal(entered,3);assert.equal(f.engine.get(id)!.attempts,3);assert.equal(f.engine.get(id)!.state,'failed');assert.equal(f.store.db.prepare('SELECT count(*) n FROM execution_attempt_sessions WHERE step_id=? AND charged=1 AND pending=0 AND executed=0').get(id)!.n,3);
});

test('all default families permit two retries and internal replay cannot reset an exhausted round',async t=>{
 const f=fixture(t);let calls=0;for(const policy of Object.values(EXECUTION_POLICIES))assert.equal(policy.maxAttempts,3);
 f.engine.register({...base,execute:async()=>{calls++;throw new ExecutionFailure('transient','generated_failed',0);}});
 const id=f.engine.enqueue('bounded','generated',{});await f.engine.drain([id]);assert.equal(calls,3);assert.equal(f.engine.get(id)!.state,'failed');assert.equal(f.engine.get(id)!.attempts,3);assert.equal(f.engine.get(id)!.retryExhausted,true);
 f.engine.retry(id);await f.engine.drain([id]);assert.equal(calls,3,'internal replay must not buy another round');
 f.engine.retry(id,true);await f.engine.drain([id]);assert.equal(calls,6);assert.equal(f.engine.get(id)!.retryRound,2);assert.equal(f.store.db.prepare('SELECT attempts FROM execution_retry_rounds WHERE step_id=?').get(id)!.attempts,3);
});

test('a successful first call followed by resource waiting resumes one charged logical attempt after restart',async t=>{
 const f=fixture(t);f.store.db.exec('CREATE TABLE generated_saved(value INTEGER)');let calls=0,busy=true;
 const handler={...base,deferAttempts:true,execute:async(_step:any,_signal:any,grant:any)=>{
  if(!f.store.db.prepare('SELECT 1 FROM generated_saved').get())await grant.withBudget(async()=>{calls++;f.store.db.prepare('INSERT INTO generated_saved VALUES(1)').run();});
  return grant.withBudget(async()=>{if(busy)throw new ExecutionFailure('waiting','generated_busy',60000,{executionStarted:false});calls++;return null;});
 }};
 f.engine.register(handler);const id=f.engine.enqueue('mixed','generated',{});await f.engine.drain([id]);const session=f.engine.get(id)!.attemptId;assert.equal(f.engine.get(id)!.attempts,1);assert.equal(calls,1);
 await f.engine.close();f.advance(60001);const recovered=f.create();recovered.register(handler);busy=false;await recovered.drain([id]);assert.equal(recovered.get(id)!.attempts,1);assert.equal(recovered.get(id)!.state,'succeeded');assert.equal(calls,2);assert.equal(f.store.db.prepare('SELECT count(*) n FROM execution_attempt_sessions WHERE step_id=?').get(id)!.n,1);assert.equal(f.store.db.prepare('SELECT id FROM execution_attempt_sessions WHERE step_id=?').get(id)!.id,session);
});

test('a charged suspended third attempt can finish without being displayed as exhausted',async t=>{
 const f=fixture(t);let failures=0,busy=true;
 f.engine.register({...base,deferAttempts:true,execute:async(_step,_signal,grant)=>{
  if(failures<2)return grant.withBudget(async()=>{failures++;throw new ExecutionFailure('transient','generated_failed',0);});
  await grant.withBudget(async()=>null);if(busy)throw new ExecutionFailure('waiting','generated_next_stage',1000,{executionStarted:false});return null;
 }});
 const id=f.engine.enqueue('finish-last','generated',{});await f.engine.drain([id]);assert.equal(f.engine.get(id)!.attempts,3);assert.equal(f.engine.get(id)!.state,'waiting');assert.equal(f.engine.get(id)!.retryExhausted,false);
 busy=false;f.advance(1001);await f.engine.drain([id]);assert.equal(f.engine.get(id)!.state,'succeeded');assert.equal(f.engine.get(id)!.attempts,3);assert.equal(f.engine.get(id)!.retryExhausted,false);
});

test('pending concurrent callbacks prevent a last known-not-started wait from refunding an earlier reservation',async t=>{
 const f=fixture(t),entered=deferred(),release=deferred();let held:Promise<unknown>|undefined;
 f.engine.register({...base,deferAttempts:true,execute:async(_step,_signal,grant)=>{
  held=grant.withBudget(async()=>{entered.resolve();await release.promise;return null;});void held.catch(()=>{});await entered.promise;
  return grant.withBudget(async()=>{throw new ExecutionFailure('waiting','generated_busy',60000,{executionStarted:false});});
 }});
 const id=f.engine.enqueue('concurrent','generated',{});await f.engine.drain([id]);assert.equal(f.engine.get(id)!.attempts,1);assert.equal(f.store.db.prepare('SELECT pending FROM execution_attempt_sessions WHERE step_id=? AND open=1').get(id)!.pending,1);
 release.resolve();await held!.catch(()=>{});assert.equal(f.engine.get(id)!.attempts,1);assert.equal(f.store.db.prepare('SELECT executed FROM execution_attempt_sessions WHERE step_id=? AND open=1').get(id)!.executed,1);
});

test('lease loss at the cap keeps its charge and refuses a new send across SQLite connections',async t=>{
 const f=fixture(t),other=new Store(f.dir),second=f.create(other),entered=deferred(),release=deferred();let calls=0,commits=0;
 t.after(()=>other.close());t.after(()=>release.resolve());
 const handler={...base,policy:{...base.policy!,maxAttempts:1},execute:async()=>{calls++;entered.resolve();await release.promise;return null;},commit:()=>{commits++;}};
 f.engine.register(handler);second.register({...handler,execute:async()=>{calls++;return null;}});
 const id=f.engine.enqueue('expired','generated',{}),running=f.engine.drain([id]);await entered.promise;f.store.db.prepare('UPDATE execution_steps SET lease_until=0 WHERE id=?').run(id);await second.drain([id]);assert.equal(calls,1);assert.equal(second.get(id)!.state,'failed');assert.equal(second.get(id)!.attempts,1);assert.equal(second.get(id)!.error,'retry_budget_exhausted');release.resolve();await running;assert.equal(commits,0);
});

test('shutdown of an actually charged call retains its attempt, whereas an uncharged wait remains free',async t=>{
 const f=fixture(t),entered=deferred(),release=deferred();let calls=0;
 f.engine.register({...base,deferAttempts:true,execute:async(_step,_signal,grant)=>grant.withBudget(async()=>{calls++;entered.resolve();await release.promise;return null;})});
 const id=f.engine.enqueue('stop','generated',{}),running=f.engine.drain([id]);await entered.promise;await f.engine.close();await running;assert.equal(f.engine.get(id)!.attempts,1);release.resolve();await delay(1);
 const next=f.create();next.register({...base,deferAttempts:true,execute:async(_step,_signal,grant)=>grant.withBudget(async()=>{calls++;return null;})});await next.drain([id]);assert.equal(next.get(id)!.attempts,2);assert.equal(calls,2);
});

for(const race of ['renew','reclaim'] as const)test(`a stale recovery scan cannot close the ${race==='renew'?'renewed':'replacement'} session owned by another SQLite connection`,async t=>{
 const f=fixture(t),first=deferred(),second=deferred(),started=deferred();let calls=0;
 const otherStore=new Store(f.dir);t.after(()=>otherStore.close());const other=f.create(otherStore);
 const execute:ExecutionHandler['execute']=async(_step,_signal,grant)=>grant.withBudget(async()=>{calls++;if(calls===1){started.resolve();await first.promise;}else await second.promise;return null;});
 f.engine.register({...base,execute});other.register({...base,execute});const id=f.engine.enqueue('stale-scan-'+race,'generated',{}),running=f.engine.tick();await started.promise;const original=f.engine.get(id)!,oldFence=String(f.store.db.prepare('SELECT fence FROM execution_steps WHERE id=?').get(id)!.fence);assert.ok(original.attemptId);f.advance(31000);
 const db=f.store.db,prepare=db.prepare;let interleaved=false,recovery:Promise<void>|undefined;
 db.prepare=function(sql:string){const statement=Reflect.apply(prepare,this,[sql]);if(!interleaved&&sql.includes('s.id attempt_session')&&sql.includes("e.state='running'")){const all=statement.all.bind(statement);statement.all=((...args:any[])=>{const rows=all(...args);interleaved=true;if(race==='renew')otherStore.db.prepare('UPDATE execution_steps SET lease_until=? WHERE id=? AND fence=?').run(Date.now()+120000,id,oldFence);else recovery=other.tick();return rows;}) as typeof statement.all;}return statement;};
 try{await f.engine.tick();assert.equal(interleaved,true);const current=f.engine.get(id)!;if(race==='renew'){assert.equal(current.attemptId,original.attemptId);assert.equal(current.attempts,1);assert.equal(f.store.db.prepare('SELECT fence FROM execution_steps WHERE id=?').get(id)!.fence,oldFence);}else{assert.notEqual(current.attemptId,original.attemptId);assert.equal(current.attempts,2);assert.notEqual(f.store.db.prepare('SELECT fence FROM execution_steps WHERE id=?').get(id)!.fence,oldFence);}
  assert.equal(f.store.db.prepare('SELECT open FROM execution_attempt_sessions WHERE id=?').get(current.attemptId!)!.open,1);first.resolve();second.resolve();await running;await recovery;assert.equal(f.engine.get(id)!.state,'succeeded');assert.equal(calls,race==='renew'?1:2);
 }finally{db.prepare=prepare;first.resolve();second.resolve();await running;await recovery;}
});

test('reading untracked historical tasks reports current defaults without inventing retry rounds or rewriting prior counts',async t=>{
 const f=fixture(t);let calls=0;f.engine.register({...base,execute:async()=>{calls++;return null;}});f.engine.register({...base,kind:'generated.narrow',maxAttempts:1});
 const records=[{kind:'generated',state:'failed',attempts:4,maxRetries:2},{kind:'generated',state:'blocked',attempts:2,maxRetries:2},{kind:'generated',state:'succeeded',attempts:5,maxRetries:2},{kind:'generated.narrow',state:'failed',attempts:1,maxRetries:0}];
 const ids=records.map((record,i)=>{const id=f.engine.enqueue('historical-'+i,record.kind,{});f.store.db.prepare('UPDATE execution_steps SET state=?,attempts=? WHERE id=?').run(record.state,record.attempts,id);f.store.db.prepare('DELETE FROM execution_retry_policies WHERE step_id=?').run(id);return id;});
 const before=f.store.db.prepare('SELECT * FROM execution_steps ORDER BY id').all();for(const [i,id]of ids.entries()){const value=f.engine.get(id)!;assert.equal(value.attempts,records[i].attempts);assert.equal(value.maxRetries,records[i].maxRetries);assert.equal(value.retriesUsed,undefined);assert.equal(value.retryRound,undefined);assert.equal(value.retryExhausted,undefined);}
 assert.deepEqual(f.store.db.prepare('SELECT * FROM execution_steps ORDER BY id').all(),before);assert.equal(f.store.db.prepare('SELECT count(*) n FROM execution_retry_policies').get()!.n,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM execution_attempt_sessions').get()!.n,0);assert.equal(calls,0);
});
