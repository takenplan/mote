import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {ExecutionEngine} from '../src/execution-engine.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';

// Exercise the engine's public composition, including native iterator lifetime.
// The observer counts only two fixed query templates; it never consumes an iterator.
function fixture(t:any,observe=false){
 const directory=mkdtempSync(join(tmpdir(),'mote-engine-read-templates-')),path=join(directory,'generated.sqlite');
 const hosts:ReturnType<typeof open>[]=[],outputs:string[]=[],commits:string[]=[];
 const counts={blockedPrepare:0,blockedCalls:0,candidatesPrepare:0,candidatesCalls:0};
 function open(){
  const db=new DatabaseSync(path);
  const configure=()=>db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');configure();
  if(observe){
   const prepare=db.prepare;
   db.prepare=function(sql:string){
    const role=sql.startsWith('WITH RECURSIVE blocked(id)')?'blocked':sql.startsWith('SELECT e.* FROM execution_steps e LEFT JOIN execution_user_fairness')?'candidates':undefined;
    if(role)counts[role==='blocked'?'blockedPrepare':'candidatesPrepare']++;
    const statement=Reflect.apply(prepare,this,[sql]);
    if(role){const method=role==='blocked'?'all':'iterate',original=statement[method];(statement as any)[method]=function(...args:any[]){counts[role==='blocked'?'blockedCalls':'candidatesCalls']++;return Reflect.apply(original,this,args);};}
    return statement;
   };
  }
  const engine=new ExecutionEngine({db,reserveMetadata:()=>{}}),state={open:false,throwOnce:false,reenterOnce:false,reentered:false};
  let reentrant:Promise<void>|undefined;
  for(const pool of ['alpha','beta']){
   engine.configurePool(pool,{lane:()=> 'background',concurrency:{background:()=>1,interactive:()=>1},available:()=>{
    if(state.throwOnce){state.throwOnce=false;throw Error('Generated capacity callback failed');}
    if(state.reenterOnce){state.reenterOnce=false;state.reentered=true;reentrant=engine.tick();}
    return state.open;
   }});
   engine.register({kind:pool,pool,concurrency:()=>1,policy:EXECUTION_POLICIES.control,validate:()=>true,
    execute:async step=>{assert.equal(engine.isActiveStep(step.id),true,'local slot must precede physical handler IO');outputs.push(step.id);return step.id;},
    commit:(step,result)=>{assert.equal(result,step.id);commits.push(step.id);}});
  }
  const add=(pool:string,user:string,n:number)=>engine.enqueue('generated:'+pool+':'+user+':'+n,pool,{n},{ownership:{userId:user,authorizationEpoch:1,grantId:'generated:'+user}});
  const host={db,engine,state,configure,add,reentrant:()=>reentrant};hosts.push(host);return host;
 }
 t.after(async()=>{for(const host of hosts)await host.engine.close();for(const host of hosts)if(host.db.isOpen)host.db.close();rmSync(directory,{recursive:true,force:true});});
 const initial=open();return {...initial,openHost:open,outputs,commits,counts};
}
function populate(f:ReturnType<typeof fixture>,perOwner=1){const ids:string[]=[];for(const pool of ['alpha','beta'])for(const user of ['A','B'])for(let n=0;n<perOwner;n++)ids.push(f.add(pool,user,n));return ids;}
function complete(f:ReturnType<typeof fixture>,ids:string[]){assert.deepEqual([...f.outputs].sort(),[...ids].sort());assert.deepEqual([...f.commits].sort(),[...ids].sort());assert.equal(new Set(f.outputs).size,ids.length);for(const id of ids)assert.equal(f.engine.get(id)?.state,'succeeded');}

test('candidate iteration closes after early selection and exhaustion before fresh pool and owner bindings',async t=>{
 const f=fixture(t),ids=[...populate(f),f.add('alpha','A',2),f.add('beta','B',2)];await f.engine.tick();assert.equal(f.outputs.length,0);
 f.state.open=true;await f.engine.drain(ids);complete(f,ids);
 await f.engine.tick();const late=[f.add('beta','B',9),f.add('alpha','A',9)];await f.engine.drain(late);complete(f,[...ids,...late]);
});

test('a callback failure closes the candidate iterator before the next real tick',async t=>{
 const f=fixture(t),ids=populate(f);await f.engine.tick();f.state.throwOnce=true;
 assert.throws(()=>f.engine.tick(),/Generated capacity callback failed/);assert.equal(f.outputs.length,0);for(const id of ids)assert.equal(f.engine.get(id)?.state,'waiting');
 await f.engine.tick();f.state.open=true;await f.engine.drain(ids);complete(f,ids);
});

test('a reentrant tick request cannot reuse a live candidate iterator',async t=>{
 const f=fixture(t),ids=populate(f);f.state.reenterOnce=true;await f.engine.tick();await f.reentrant();assert.equal(f.state.reentered,true);assert.equal(f.outputs.length,0);
 f.state.open=true;await f.engine.drain(ids);complete(f,ids);
});

test('warm tick queries observe cancellation retry and newly enqueued work from another connection',async t=>{
 const f=fixture(t),ids=populate(f);await f.engine.tick();const other=f.openHost();other.engine.cancel(ids[0]);const fresh=other.add('beta','B',99);
 f.state.open=true;await f.engine.drain([...ids,fresh]);assert.equal(f.engine.get(ids[0])?.state,'cancelled');assert.ok(!f.outputs.includes(ids[0]));complete(f,[...ids.slice(1),fresh]);
 other.engine.retry(ids[0]);await f.engine.drain([ids[0]]);complete(f,[...ids,fresh]);
});

test('idle tick statements recover after same connection reopen and a schema change',async t=>{
 const f=fixture(t),ids=populate(f);await f.engine.tick();f.db.close();f.db.open();f.configure();await f.engine.tick();
 const other=f.openHost();other.db.exec('CREATE TABLE generated_unrelated_schema(value TEXT)');await f.engine.tick();f.state.open=true;await f.engine.drain(ids);complete(f,ids);
});

for(const table of ['execution_stage_fairness','execution_dependencies'])test(`a native SQL error in ${table} recovers on the next tick after the schema is repaired`,async t=>{
 const f=fixture(t),ids=populate(f);await f.engine.tick();
 // Empty generated table and its indexes are restored exactly. This induces a
 // real prepare/step error, distinct from a callback throwing inside for-of.
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM '+table).get()!.n,0);
 const schema=f.db.prepare("SELECT sql FROM sqlite_schema WHERE tbl_name=? AND sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name").all(table).map(row=>String(row.sql));
 f.db.exec('DROP TABLE '+table);
 try{assert.throws(()=>f.engine.tick(),/no such table/);}finally{for(const sql of schema)f.db.exec(sql);}
 assert.equal(f.outputs.length,0);
 // No retry allowance: a stale native error here is an observable regression.
 await f.engine.tick();f.state.open=true;await f.engine.drain(ids);complete(f,ids);
});

test('real blocked tick benchmark retains fresh eligibility and completes all generated tasks',async t=>{
 const benchmark=process.env.MOTE_ENGINE_TICK_BENCHMARK==='1',observe=process.env.MOTE_ENGINE_TICK_OBSERVE==='1';
 const f=fixture(t,observe),ids=populate(f,3),iterations=benchmark?2000:20;
 for(let i=0;i<20;i++)await f.engine.tick();
 const before={...f.counts},cpu=process.cpuUsage(),start=performance.now();
 for(let i=0;i<iterations;i++)await f.engine.tick();
 const wallMs=performance.now()-start,used=process.cpuUsage(cpu),counts=Object.fromEntries(Object.entries(f.counts).map(([key,value])=>[key,value-before[key as keyof typeof before]]));
 assert.equal(f.outputs.length,0);for(const id of ids)assert.equal(f.engine.get(id)?.state,'waiting');
 f.state.open=true;await f.engine.drain(ids);complete(f,ids);
 if(benchmark)t.diagnostic(JSON.stringify({benchmark:'real-blocked-tick',iterations,tasks:ids.length,observe,wallMs,userCpuMs:used.user/1000,systemCpuMs:used.system/1000,counts}));
});
