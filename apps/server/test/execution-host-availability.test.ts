import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {Store} from '../src/store.js';
import {ExecutionEngine,type ExecutionHandler} from '../src/execution-engine.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
async function until(check:()=>boolean,detail:()=>unknown){const end=Date.now()+10000;while(!check()){assert.ok(Date.now()<end,JSON.stringify(detail()));await delay(5);}}
const base:ExecutionHandler={kind:'generated',pool:'generated',concurrency:()=>1,policy:EXECUTION_POLICIES.control,validate:()=>true,execute:async()=>null,commit:()=>{}};
for(const configured of [false,true])test(`optional host availability omitted preserves ordinary scheduler admission; configured pool ${configured}`,async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-host-available-')),store=new Store(directory),engine=new ExecutionEngine(store),release=deferred();t.after(async()=>{release.resolve();await engine.close();store.close();rmSync(directory,{recursive:true,force:true});});
 const entered:string[]=[];engine.register({...base,execute:async step=>{entered.push(step.id);await release.promise;return null;}});if(configured)engine.configurePool('generated',{lane:()=> 'background',concurrency:{background:()=>2,interactive:()=>1}});
 const ids=Array.from({length:3},(_,n)=>engine.enqueue('generated:'+n,'generated',{n}));const running=engine.tick();await until(()=>entered.length===(configured?2:1),()=>entered);assert.equal(engine.get(ids[2])!.state,'waiting');assert.equal(engine.get(ids[2])!.attempts,0);release.resolve();await running;await engine.drain(ids);assert.ok(ids.every(id=>engine.get(id)!.state==='succeeded'&&engine.get(id)!.attempts===1));
});

test('host refusal leaves original queue identity and zero attempts, skips unavailable head fairly, and a release wake survives reentrant notifications without a timer or retry',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-host-wake-')),store=new Store(directory),engine=new ExecutionEngine(store),firstGate=deferred();t.after(async()=>{firstGate.resolve();await engine.close();store.close();rmSync(directory,{recursive:true,force:true});});
 let available=false,tail='';const started:string[]=[],committed:string[]=[];
 engine.configurePool('generated',{lane:()=> 'background',concurrency:{background:()=>1,interactive:()=>1},available:step=>step.input.blocked!==true||available});
 engine.register({...base,execute:async step=>{started.push(step.operationId);if(step.operationId==='first-A')await firstGate.promise;if(step.input.blocked){tail=engine.enqueue('released-tail','generated',{}, {ownership:{userId:'B',authorizationEpoch:1}});engine.wake();engine.wake();}return null;},commit:step=>{committed.push(step.id);}});
 const add=(operationId:string,userId:string,input:Record<string,unknown>={})=>engine.enqueue(operationId,'generated',input,{ownership:{userId,authorizationEpoch:1}});
 const blocked=add('blocked-head','A',{blocked:true}),first=add('first-A','A'),running=engine.tick();await until(()=>started.includes('first-A'),()=>started);
 const backlog=Array.from({length:6},(_,n)=>add('A:'+n,'A')),other=add('ready-B','B');firstGate.resolve();await running;await until(()=>[first,other,...backlog].every(id=>engine.get(id)!.state==='succeeded'),()=>started);
 assert.equal(started[1],'ready-B','an available second owner receives its turn despite an unavailable older head and A backlog');assert.equal(engine.get(blocked)!.state,'waiting');assert.equal(engine.get(blocked)!.attempts,0);assert.equal(engine.get(blocked)!.availableAt,0);assert.equal(engine.get(blocked)!.error,undefined);assert.equal(store.db.prepare('SELECT count(*) n FROM execution_failures WHERE step_id=?').get(blocked)!.n,0,'capacity refusal is not a failure or charged execution');
 available=true;engine.wake();engine.wake(); // No drain/tick/retry or interval pump after release.
 await until(()=>Boolean(tail)&&engine.get(blocked)!.state==='succeeded'&&engine.get(tail)!.state==='succeeded',()=>({started,blocked:engine.get(blocked),tail:tail&&engine.get(tail)}));assert.equal(new Set(committed).size,committed.length);assert.equal(started.filter(op=>op==='blocked-head').length,1);assert.equal(started.filter(op=>op==='released-tail').length,1);assert.equal(engine.get(blocked)!.attempts,1);assert.equal(engine.get(tail)!.attempts,1);
 available=false;const stopped=add('closed-wake','A',{blocked:true});await engine.tick();await engine.close();available=true;engine.wake();await delay(0);assert.equal(engine.get(stopped)!.state,'waiting');assert.equal(engine.get(stopped)!.attempts,0,'a stopped executor ignores host release notifications');
});
