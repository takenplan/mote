import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {Store} from '../src/store.js';
import {ExecutionEngine,ExecutionFailure,type ExecutionHandler} from '../src/execution-engine.js';
import {scopedMemoryFixture} from './fixtures/scoped-memory-host.js';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};
async function until(read:()=>boolean){const end=Date.now()+10000;while(!read()){assert.ok(Date.now()<end);await delay(5);}}
const policy={timeoutMs:40,maxAttempts:1,maxRecoveryWindowMs:null};
const base:ExecutionHandler={kind:'batch',pool:'batch',policy,deferTimeout:true,concurrency:()=>8,validate:()=>true,execute:async()=>null,commit:()=>{}};

test('continuous publisher reservations serialize two host processes for one account and let another account save',{timeout:30000},async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-continuation-process-')),script=join(root,'publisher.mjs'),store=new Store(root);store.close();
 const engineUrl=new URL('../src/execution-engine.ts',import.meta.url).href,storeUrl=new URL('../src/store.ts',import.meta.url).href;
 writeFileSync(script,`import {ExecutionEngine} from ${JSON.stringify(engineUrl)};import {Store} from ${JSON.stringify(storeUrl)};
 const store=new Store(${JSON.stringify(root)}),engine=new ExecutionEngine(store),[label,owner]=process.argv.slice(2);let release;const held=new Promise(done=>release=done);process.on('message',message=>{if(message==='release')release();});
 engine.register({kind:'batch',pool:'batch',policy:${JSON.stringify(policy)},deferTimeout:true,concurrency:()=>8,validate:()=>true,execute:async(step,signal,grant)=>{
  await grant.withBudget(async()=>{await new Promise(done=>setTimeout(done,5));});process.send({phase:'waiting',label,id:step.id});
  return grant.withResource(JSON.stringify(['user',owner,'publisher']),async()=>{process.send({phase:'acquired',label});await held;return grant.commit(()=>{store.db.prepare('INSERT INTO generated_saved VALUES(?)').run(label);return label;});});
 },commit:()=>{}});const id=engine.enqueue(label,'batch',{}, {ownership:{userId:owner,authorizationEpoch:1}});await engine.drain([id]);process.send({phase:'done',label,state:engine.get(id).state,attempts:engine.get(id).attempts});await engine.close();store.close();process.disconnect();`);
 const db=new Store(root);db.db.exec('CREATE TABLE generated_saved(label TEXT PRIMARY KEY)');const children:ReturnType<typeof spawn>[]=[],events:any[]=[],errors:string[]=[];
 const launch=(label:string,owner:string)=>{const child=spawn(process.execPath,['--import','tsx',script,label,owner],{cwd:fileURLToPath(new URL('../../..',import.meta.url)),stdio:['ignore','pipe','pipe','ipc']});children.push(child);child.on('message',event=>events.push(event));child.stderr!.on('data',chunk=>errors.push(String(chunk)));return child;};
 t.after(async()=>{for(const child of children)if(child.exitCode===null){if(child.connected)child.send('release');child.kill('SIGKILL');}db.close();rmSync(root,{recursive:true,force:true});});
 const a=launch('A','same-owner');await until(()=>events.some(event=>event.phase==='acquired'&&event.label==='A'));
 const b=launch('B','same-owner');await until(()=>events.some(event=>event.phase==='waiting'&&event.label==='B'));
 const c=launch('C','other-owner');await until(()=>events.some(event=>event.phase==='acquired'&&event.label==='C'));c.send('release');await until(()=>events.some(event=>event.phase==='done'&&event.label==='C'));
 await delay(100);assert.ok(!events.some(event=>event.phase==='acquired'&&event.label==='B'),'same-account save waits beyond a physical call budget');assert.equal(db.db.prepare('SELECT count(*) n FROM generated_saved').get()!.n,1);
 a.send('release');await until(()=>events.some(event=>event.phase==='acquired'&&event.label==='B'));b.send('release');await until(()=>events.filter(event=>event.phase==='done').length===3);
 assert.ok(events.filter(event=>event.phase==='done').every(event=>event.state==='succeeded'&&event.attempts===1),JSON.stringify({events,errors}));assert.equal(db.db.prepare('SELECT count(*) n FROM execution_dynamic_resources').get()!.n,0);assert.equal(db.db.prepare('SELECT count(*) n FROM generated_saved').get()!.n,3);
});

for(const mutation of ['cancel','revoke','expire'] as const)test('a '+mutation+' fence during publisher wait prevents acquisition and leaves no reservation',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-continuation-fence-')),store=new Store(root);let now=Date.now(),valid=true;const engine=new ExecutionEngine(store,()=>now),entered=deferred(),release=deferred();let saved=false,runs=0;
 t.after(async()=>{release.resolve();await engine.close();store.close();rmSync(root,{recursive:true,force:true});});
 engine.register({...base,kind:'holder',resourceKeys:()=>['publisher'],execute:async()=>{entered.resolve();await release.promise;return null;}});
 engine.register({...base,validate:()=>valid,execute:async(_step,_signal,grant)=>{if(++runs>1)return null;return grant.withResource('publisher',async()=>{grant.commit(()=>saved=true);return null;});}});
 const holder=engine.enqueue('holder','holder',{}),running=engine.drain([holder]);await entered.promise;const id=engine.enqueue('waiter','batch',{}),waiting=engine.drain([id]);await until(()=>engine.get(id)?.state==='running');await delay(60);assert.equal(engine.get(id)!.attempts,1);
 if(mutation==='cancel')engine.cancel(id);else if(mutation==='revoke')valid=false;else now+=31000;
 await until(()=>engine.get(id)?.state!=='running');release.resolve();await Promise.all([running,waiting]);assert.equal(saved,false);assert.equal(store.db.prepare('SELECT count(*) n FROM execution_dynamic_resources').get()!.n,0);
});

test('capacity waits between physical calls spend neither attempt nor call protection budget',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-continuation-budget-')),store=new Store(root),engine=new ExecutionEngine(store),entered=deferred(),release=deferred();let physical=0;
 t.after(async()=>{release.resolve();await engine.close();store.close();rmSync(root,{recursive:true,force:true});});
 engine.register({...base,deferAttempts:true,execute:async(_step,_signal,grant)=>{
  entered.resolve();await release.promise;
  for(let call=0;call<2;call++){await grant.withBudget(async()=>{physical++;await delay(5);});await delay(80);}
  return null;
 }});
 const id=engine.enqueue('continuous','batch',{}),running=engine.drain([id]);await entered.promise;await delay(80);assert.equal(engine.get(id)!.attempts,0);assert.equal(physical,0);release.resolve();await running;assert.equal(engine.get(id)!.state,'succeeded');assert.equal(engine.get(id)!.attempts,1);assert.equal(physical,2);
});

for(const mutation of ['cancel','revoke','expire'] as const)test('a '+mutation+' fence after resource acquisition rejects the old grant commit',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-continuation-acquired-')),store=new Store(root);let now=Date.now(),valid=true,runs=0,saved=0;const engine=new ExecutionEngine(store,()=>now),entered=deferred(),release=deferred();
 t.after(async()=>{release.resolve();await engine.close();store.close();rmSync(root,{recursive:true,force:true});});
 engine.register({...base,validate:()=>valid,execute:async(_step,_signal,grant)=>{if(++runs>1)return null;return grant.withResource('publisher',async()=>{entered.resolve();await release.promise;grant.commit(()=>saved++);return null;});}});
 const id=engine.enqueue('continuous','batch',{}),running=engine.drain([id]);await entered.promise;
 if(mutation==='cancel')engine.cancel(id);else if(mutation==='revoke')valid=false;else now+=31000;
 release.resolve();await running;await until(()=>store.db.prepare('SELECT count(*) n FROM execution_dynamic_resources').get()!.n===0);assert.equal(saved,0);
});

for(const physical of [false,true])test('capacity before '+(physical?'an unissued physical call':'the first physical call')+' never refunds prior failures',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-attempt-history-')),store=new Store(root),engine=new ExecutionEngine(store);
 t.after(async()=>{await engine.close();store.close();rmSync(root,{recursive:true,force:true});});
 engine.register({...base,policy:{...policy,maxAttempts:4},deferAttempts:true,execute:async(_step,_signal,grant)=>{const unavailable=async()=>{throw new ExecutionFailure('waiting','generated_capacity',60000,{executionStarted:false});};return physical?grant.withBudget(unavailable):unavailable();}});
 const id=engine.enqueue('retained','batch',{}, {initial:{state:'waiting',attempts:2,availableAt:0}});await engine.drain([id]);assert.equal(engine.get(id)!.attempts,2);assert.equal(engine.get(id)!.state,'waiting');
});

test('shutdown before a deferred physical call preserves nonzero failure history',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-attempt-stop-')),store=new Store(root),engine=new ExecutionEngine(store),entered=deferred();
 t.after(async()=>{await engine.close();store.close();rmSync(root,{recursive:true,force:true});});
 engine.register({...base,policy:{...policy,maxAttempts:4},deferAttempts:true,execute:async()=>{entered.resolve();await new Promise(()=>{});}});
 const id=engine.enqueue('retained','batch',{}, {initial:{state:'waiting',attempts:2,availableAt:0}});const running=engine.drain([id]);await entered.promise;await engine.close();await running;assert.equal(engine.get(id)!.attempts,2);assert.equal(engine.get(id)!.state,'waiting');
});

test('shutdown during resource waiting preserves nonzero failure history',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-attempt-resource-stop-')),store=new Store(root),engine=new ExecutionEngine(store),entered=deferred();
 t.after(async()=>{await engine.close();store.close();rmSync(root,{recursive:true,force:true});});
 engine.register({...base,kind:'holder',resourceKeys:()=>['publisher'],execute:async()=>{entered.resolve();await new Promise(()=>{});}});
 engine.register({...base,policy:{...policy,maxAttempts:4},deferAttempts:true,execute:async(_step,_signal,grant)=>grant.withResource('publisher',async()=>grant.withBudget(async()=>null))});
 const holder=engine.enqueue('holder','holder',{}),holding=engine.drain([holder]);await entered.promise;const id=engine.enqueue('retained','batch',{}, {initial:{state:'waiting',attempts:2,availableAt:0}}),running=engine.drain([id]);await until(()=>Boolean(store.db.prepare('SELECT 1 FROM execution_resource_waits WHERE step_id=?').get(id)));await engine.close();await Promise.all([holding,running]);assert.equal(engine.get(id)!.attempts,2);assert.equal(store.db.prepare('SELECT count(*) n FROM execution_resource_waits').get()!.n,0);
});

test('a finite host per-call policy does not time out or charge an attempt before its first call',async t=>{
 const f=await scopedMemoryFixture(t),entered=deferred(),release=deferred();t.after(()=>release.resolve());
 f.node.execution!.register({kind:'generated.custom-per-call',pool:'generated.custom-per-call',concurrency:()=>1,policy:{timeoutMs:40,maxAttempts:4,maxRecoveryWindowMs:null},modelFeature:'memory',modelAdmission:'per-call',parseInput:()=>({}),execute:async run=>{entered.resolve();await release.promise;return run.model!.withModel(async settings=>({model:settings.model}));}});
 const response=await f.request(f.a.token,'/api/tasks','POST',{kind:'generated.custom-per-call',operationId:'generated-finite-per-call',input:{}});assert.equal(response.statusCode,200,response.body);const task=response.json();await entered.promise;await delay(80);const waiting=(await f.request(f.a.token,'/api/tasks/'+task.id)).json();assert.equal(waiting.state,'running');assert.equal(waiting.attempts,0);release.resolve();assert.equal(await f.terminal(task.id),'succeeded');assert.equal((await f.request(f.a.token,'/api/tasks/'+task.id)).json().attempts,1);
});

test('SIGKILL and lease recovery retain prior failures when the dead fence never started a physical call',{timeout:20000},async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-attempt-death-')),store=new Store(root),engine=new ExecutionEngine(store),script=join(root,'waiting.mjs');engine.register({...base,deferAttempts:true});const id=engine.enqueue('retained','batch',{}, {initial:{state:'waiting',attempts:2,availableAt:0}});await engine.close();
 writeFileSync(script,`import {ExecutionEngine} from ${JSON.stringify(new URL('../src/execution-engine.ts',import.meta.url).href)};import {Store} from ${JSON.stringify(new URL('../src/store.ts',import.meta.url).href)};const store=new Store(${JSON.stringify(root)}),engine=new ExecutionEngine(store);engine.register({kind:'batch',pool:'batch',concurrency:()=>8,policy:${JSON.stringify(policy)},deferTimeout:true,deferAttempts:true,validate:()=>true,execute:async()=>{process.send('waiting');await new Promise(()=>{});},commit:()=>{}});await engine.drain([${JSON.stringify(id)}]);`);
 const child=spawn(process.execPath,['--import','tsx',script],{stdio:['ignore','pipe','pipe','ipc']}),closed=new Promise(resolve=>child.once('close',resolve));t.after(async()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await closed;store.close();rmSync(root,{recursive:true,force:true});});
 await new Promise<void>((resolve,reject)=>{child.once('message',()=>resolve());child.once('error',reject);});assert.equal(engine.get(id)!.attempts,2);child.kill('SIGKILL');await closed;
 const recovered=new ExecutionEngine(store,()=>Date.now()+31000);recovered.register({...base,deferAttempts:true,admit:()=>new ExecutionFailure('blocked','generated_inspection')});await recovered.tick();assert.equal(recovered.get(id)!.attempts,2);assert.equal(recovered.get(id)!.state,'blocked');await recovered.close();
});

test('a released static resource is reacquired visibly to a competing connection',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-reacquire-')),store=new Store(root),other=new Store(root),engine=new ExecutionEngine(store),second=new ExecutionEngine(other),acquired=deferred(),release=deferred();let competing=false;
 t.after(async()=>{release.resolve();await engine.close();await second.close();store.close();other.close();rmSync(root,{recursive:true,force:true});});
 engine.register({...base,resourceKeys:()=>['publisher'],execute:async(_step,_signal,grant)=>{grant.releaseResource('publisher');return grant.withResource('publisher',async()=>{acquired.resolve();await release.promise;return null;});}});
 second.register({...base,kind:'competitor',resourceKeys:()=>['publisher'],execute:async()=>{competing=true;return null;}});
 const first=engine.enqueue('reacquire','batch',{}),running=engine.drain([first]);await acquired.promise;const next=second.enqueue('competitor','competitor',{});await second.tick();await delay(60);assert.equal(competing,false,'reacquired static ownership fences another engine');release.resolve();await running;await second.drain([next]);assert.equal(competing,true);
});

test('durable resource turns rotate accounts and operations despite sustained new arrivals and static publishers',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-resource-fairness-')),store=new Store(root),engine=new ExecutionEngine(store),entered=deferred(),release=deferred(),calls:string[]=[];const ids:string[]=[];
 t.after(async()=>{release.resolve();await engine.close();store.close();rmSync(root,{recursive:true,force:true});});
 const add=(owner:string,operation:string,n:number,kind='batch')=>{const id=engine.enqueue(operation,kind,{n},{ownership:{userId:owner,authorizationEpoch:1}});ids.push(id);return id;};
 engine.register({...base,concurrency:()=>32,execute:async(step,_signal,grant)=>grant.withResource('publisher',async()=>{calls.push(step.ownership!.userId+':'+step.operationId);if(calls.length===1){entered.resolve();await release.promise;}if(step.operationId==='bulk'&&Number(step.input.n)<4)add('A','bulk',100+Number(step.input.n));return null;})});
 engine.register({...base,kind:'static',pool:'static',resourceKeys:()=>['publisher'],execute:async step=>{calls.push(step.ownership!.userId+':'+step.operationId);return null;}});
 add('A','bulk',0);const running=engine.drain(ids);await entered.promise;for(let n=1;n<=4;n++)add('A','bulk',n);add('A','other',0);add('B','bulk-b',0);add('B','static-b',0,'static');
 void engine.tick();await until(()=>Number(store.db.prepare('SELECT count(*) n FROM execution_resource_waits').get()!.n)>=6);release.resolve();await running;await engine.drain(ids);
 assert.deepEqual(calls.slice(0,5),['A:bulk','B:static-b','A:other','B:bulk-b','A:bulk']);assert.equal(store.db.prepare('SELECT count(*) n FROM execution_resource_waits').get()!.n,0);assert.ok(ids.every(id=>engine.get(id)!.state==='succeeded'));
});

test('contested resource fairness survives another host shutdown and restart under sustained arrivals',{timeout:30000},async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-resource-process-fairness-')),store=new Store(root),engine=new ExecutionEngine(store),script=join(root,'contender.mjs'),entered=deferred(),release=deferred(),events:any[]=[],children:ReturnType<typeof spawn>[]=[];
 engine.register({...base,kind:'holder',resourceKeys:()=>['shared-publisher'],execute:async()=>{entered.resolve();await release.promise;return null;}});const holder=engine.enqueue('holder','holder',{}),holding=engine.drain([holder]);await entered.promise;
 writeFileSync(script,`import {ExecutionEngine} from ${JSON.stringify(new URL('../src/execution-engine.ts',import.meta.url).href)};import {Store} from ${JSON.stringify(new URL('../src/store.ts',import.meta.url).href)};
 const store=new Store(${JSON.stringify(root)}),engine=new ExecutionEngine(store),owner=process.argv[2],ids=[];let stopping=false;const add=(operation,n)=>{const id=engine.enqueue(owner+':'+operation,'batch',{n},{ownership:{userId:owner,authorizationEpoch:1}});ids.push(id);return id;};
 engine.register({kind:'batch',pool:'batch',policy:{timeoutMs:1000,maxAttempts:4,maxRecoveryWindowMs:null},deferTimeout:true,deferAttempts:true,concurrency:()=>32,validate:()=>true,execute:async(step,signal,grant)=>grant.withResource('shared-publisher',()=>grant.withBudget(async()=>{process.send({phase:'saved',owner,operation:step.operationId,n:step.input.n});if(step.input.n<3)add('bulk',100+step.input.n);return null;})),commit:()=>{}});
 for(let n=0;n<4;n++)add('bulk',n);add('other',10);void engine.tick();
 process.on('message',async message=>{if(message==='stop'&&!stopping){stopping=true;await engine.close();store.close();process.send({phase:'stopped',owner});process.disconnect();}});
 for(;;){if(stopping)break;const rows=store.db.prepare("SELECT state,count(*) n FROM execution_steps WHERE user_id=? GROUP BY state").all(owner);if(rows.some(row=>row.state==='running')){process.send({phase:'queued',owner});break;}await new Promise(done=>setTimeout(done,5));}
 for(;;){if(stopping)break;await engine.drain(ids);if(stopping)break;if(ids.every(id=>engine.get(id).state==='succeeded')){process.send({phase:'done',owner,attempts:ids.map(id=>engine.get(id).attempts)});await engine.close();store.close();process.disconnect();break;}await new Promise(done=>setTimeout(done,5));}
 `);
 const launch=(owner:string)=>{const child=spawn(process.execPath,['--import','tsx',script,owner],{stdio:['ignore','pipe','pipe','ipc']});children.push(child);child.on('message',event=>events.push(event));return child;};
 t.after(async()=>{release.resolve();for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await engine.close();store.close();rmSync(root,{recursive:true,force:true});});
 const a=launch('A');launch('B');await until(()=>['A','B'].every(owner=>Number(store.db.prepare('SELECT count(*) n FROM execution_resource_waits w JOIN execution_steps e ON e.id=w.step_id WHERE e.user_id=?').get(owner)!.n)===5));a.send('stop');await until(()=>events.some(event=>event.phase==='stopped'&&event.owner==='A'));assert.equal(store.db.prepare('SELECT max(attempts) n FROM execution_steps WHERE user_id=?').get('A')!.n,0);
 launch('A');await until(()=>Number(store.db.prepare('SELECT count(*) n FROM execution_resource_waits w JOIN execution_steps e ON e.id=w.step_id AND e.fence=w.fence WHERE e.user_id=?').get('A')!.n)===5);release.resolve();await holding;await until(()=>events.filter(event=>event.phase==='done').length===2);
 const saved=events.filter(event=>event.phase==='saved');assert.equal(saved.length,16);for(let index=1;index<8;index++)assert.notEqual(saved[index].owner,saved[index-1].owner,'durable account turns alternate while both hosts have ready continuations');
 for(const owner of ['A','B']){const own=saved.filter(event=>event.owner===owner);assert.ok(own.slice(0,2).some(event=>event.operation===owner+':other'),'another operation gets its next fair account turn');}
 assert.ok(events.filter(event=>event.phase==='done').every(event=>event.attempts.every((attempt:number)=>attempt===1)));assert.equal(store.db.prepare('SELECT count(*) n FROM execution_resource_waits').get()!.n,0);
});
