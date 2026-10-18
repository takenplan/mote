import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {Store} from '../src/store.js';
import {ExecutionEngine,type ExecutionHandler} from '../src/execution-engine.js';

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
