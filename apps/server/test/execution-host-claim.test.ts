import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {Store} from '../src/store.js';
import {ExecutionEngine} from '../src/execution-engine.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function until(check:()=>boolean,detail:()=>unknown){const end=Date.now()+10000;while(!check()){assert.ok(Date.now()<end,JSON.stringify(detail()));await delay(5);}}
for(const rejection of ['scan','transaction'] as const)test(`a host gate rejected during ${rejection} leaves no local active entry, claim charge or fairness turn and does not hide eligible work`,async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-host-claim-')),store=new Store(directory),engine=new ExecutionEngine(store),held=deferred(),entered=deferred();t.after(async()=>{held.resolve();await engine.close();store.close();rmSync(directory,{recursive:true,force:true});});
 let phase:'selection'|'closed'|'open'='selection',reads=0;const io:string[]=[];
 engine.configurePool('generated',{lane:()=> 'background',concurrency:{background:()=>1,interactive:()=>1},available:step=>{if(!step.input.gated)return true;if(phase==='open')return true;if(phase==='closed'||rejection==='scan')return false;reads++;assert.ok(reads<=2,'the same unclaimed row must be skipped for the rest of this pass');return reads===1;}});
 engine.register({kind:'generated',pool:'generated',concurrency:()=>1,policy:EXECUTION_POLICIES.control,validate:()=>true,execute:async step=>{assert.equal(engine.isActiveStep(step.id),true,'local reservation precedes physical handler IO');io.push(step.id);if(!step.input.gated){entered.resolve();await held.promise;}return null;},commit:()=>{}});
 const denied=engine.enqueue('denied','generated',{gated:true},{ownership:{userId:'A',authorizationEpoch:1}}),eligible=engine.enqueue('eligible','generated',{}, {ownership:{userId:'B',authorizationEpoch:1}}),before=store.db.prepare('SELECT * FROM execution_steps WHERE id=?').get(denied);
 const running=engine.tick();phase='closed'; // Inspect synchronously before any promise cleanup can erase a fake entry.
 assert.equal(engine.isActiveStep(denied),false);assert.equal(engine.isActiveStep(eligible),true);assert.deepEqual(store.db.prepare('SELECT * FROM execution_steps WHERE id=?').get(denied),before);assert.equal(io.includes(denied),false);
 assert.equal(store.db.prepare('SELECT count(*) n FROM execution_attempt_charges WHERE step_id=?').get(denied)!.n,0);assert.equal(store.db.prepare("SELECT count(*) n FROM execution_user_fairness WHERE user_id='A'").get()!.n,0);assert.equal(store.db.prepare("SELECT count(*) n FROM execution_fairness WHERE operation_id='denied'").get()!.n,0);if(rejection==='transaction')assert.equal(reads,2);
 await entered.promise;held.resolve();await running;await until(()=>engine.get(eligible)!.state==='succeeded',()=>engine.get(eligible));assert.equal(engine.get(denied)!.state,'waiting');assert.equal(engine.get(denied)!.attempts,0);
 phase='open';engine.wake(); // No interval, retry or explicit drain after the host release.
 await until(()=>engine.get(denied)!.state==='succeeded',()=>engine.get(denied));assert.equal(io.filter(id=>id===denied).length,1);assert.equal(engine.get(denied)!.attempts,1);
});

for(const setting of ['absent','undefined'] as const)test(`omitting the optional gate (${setting}) retains normal concurrent admission`,async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-host-default-')),store=new Store(directory),engine=new ExecutionEngine(store),held=deferred();t.after(async()=>{held.resolve();await engine.close();store.close();rmSync(directory,{recursive:true,force:true});});
 const entered:string[]=[];engine.configurePool('generated',{lane:()=> 'background',concurrency:{background:()=>2,interactive:()=>1},...(setting==='undefined'?{available:undefined}:{})});engine.register({kind:'generated',pool:'generated',concurrency:()=>1,policy:EXECUTION_POLICIES.control,validate:()=>true,execute:async step=>{assert.ok(engine.isActiveStep(step.id));entered.push(step.id);await held.promise;return null;},commit:()=>{}});
 const ids=[0,1].map(n=>engine.enqueue('default:'+n,'generated',{n})),running=engine.tick();assert.ok(ids.every(id=>engine.isActiveStep(id)));await until(()=>entered.length===2,()=>entered);held.resolve();await running;assert.ok(ids.every(id=>engine.get(id)!.state==='succeeded'&&engine.get(id)!.attempts===1));
});

for(const setup of ['begin','policy'] as const)test(`claim setup ${setup} failure after a real claim returns a rejected tick promise without stealing transaction ownership or losing the prior launch`,async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-claim-setup-')),store=new Store(directory),engine=new ExecutionEngine(store),held=deferred(),entered=deferred();t.after(async()=>{held.resolve();if(store.db.isTransaction)store.db.exec('ROLLBACK');await engine.close();store.close();rmSync(directory,{recursive:true,force:true});});store.db.exec('CREATE TABLE generated_outer_marker(value TEXT)');
 const io:string[]=[];engine.configurePool('generated',{lane:()=> 'background',concurrency:{background:()=>2,interactive:()=>1}});
 engine.register({kind:'generated',pool:'generated',concurrency:()=>2,policy:EXECUTION_POLICIES.control,timeoutMs:step=>{if(step.input.setup){if(setup==='policy')throw Error('Generated setup policy failed');store.db.exec("BEGIN IMMEDIATE; INSERT INTO generated_outer_marker VALUES('owned by setup caller')");}return null;},validate:()=>true,execute:async step=>{io.push(step.id);entered.resolve();await held.promise;return null;},commit:()=>{}});
 const first=engine.enqueue('first','generated',{}),denied=engine.enqueue('setup','generated',{setup:true}),before=store.db.prepare('SELECT * FROM execution_steps WHERE id=?').get(denied);let running:Promise<void>|undefined;
 assert.doesNotThrow(()=>{running=engine.tick();});assert.ok(running instanceof Promise);assert.equal(engine.isActiveStep(first),true);assert.equal(engine.isActiveStep(denied),false);assert.deepEqual(store.db.prepare('SELECT * FROM execution_steps WHERE id=?').get(denied),before);
 if(setup==='begin'){assert.equal(store.db.isTransaction,true,'failed nested BEGIN must not roll back a transaction the claim did not open');assert.equal(store.db.prepare('SELECT value FROM generated_outer_marker').get()!.value,'owned by setup caller');store.db.exec('ROLLBACK');}else assert.equal(store.db.isTransaction,false);
 await assert.rejects(running!,setup==='policy'?/Generated setup policy failed/:/transaction/);await entered.promise;assert.deepEqual(io,[first]);assert.equal(engine.get(first)!.state,'running');engine.cancel(first);held.resolve();await until(()=>!engine.isActiveStep(first),()=>engine.get(first));assert.equal(engine.get(first)!.state,'cancelled');assert.equal(engine.get(denied)!.attempts,0);
});

for(const stop of ['cancel','unregister'] as const)test(`${stop} immediately after claim and before launch fences all physical handler IO`,async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-claim-launch-')),store=new Store(directory),engine=new ExecutionEngine(store);t.after(async()=>{await engine.close();store.close();rmSync(directory,{recursive:true,force:true});});let calls=0;
 const unregister=engine.register({kind:'generated',pool:'generated',concurrency:()=>1,policy:EXECUTION_POLICIES.control,validate:()=>true,execute:async()=>{calls++;return null;},commit:()=>{}}),id=engine.enqueue('claim-launch','generated',{}),running=engine.tick();assert.equal(engine.isActiveStep(id),true);
 const retirement=stop==='unregister'?unregister():undefined;if(stop==='cancel')engine.cancel(id);await running;if(retirement)await retirement;assert.equal(calls,0);assert.equal(engine.isActiveStep(id),false);assert.notEqual(engine.get(id)!.state,'succeeded');
});
