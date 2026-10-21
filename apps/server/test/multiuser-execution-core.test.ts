import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ExecutionEngine,type ExecutionHandler,type ExecutionOwnership} from '../src/execution-engine.js';
import {Operations} from '../src/operations.js';
import {linkOperation,linkOperationParent} from '../src/operation-projection.js';
import type {ExecutionStorage} from '../src/execution-storage.js';

const owner=(userId:string):ExecutionOwnership=>({userId,authorizationEpoch:3,grantId:'grant:'+userId});
const base:ExecutionHandler={kind:'generated',pool:'generated',concurrency:()=>1,validate:()=>true,execute:async()=>null,commit:()=>{}};
function fixture(t:any){
 const directory=mkdtempSync(join(tmpdir(),'mote-user-execution-core-')),path=join(directory,'generated.sqlite'),connections:DatabaseSync[]=[],engines:ExecutionEngine[]=[];
 const open=(now?:()=>number)=>{const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');connections.push(db);const storage:ExecutionStorage={db,reserveMetadata:()=>{}},engine=new ExecutionEngine(storage,now);engines.push(engine);return {db,storage,engine};};
 t.after(async()=>{for(const engine of engines)await engine.close();for(const db of connections)db.close();rmSync(directory,{recursive:true,force:true});});
 return {...open(),open,path};
}
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};

test('an old execution schema is rejected before installation or private ownership backfill',t=>{
 for(const schema of ['CREATE TABLE execution_steps(id TEXT PRIMARY KEY)','CREATE TABLE operation_progress(id TEXT PRIMARY KEY)','CREATE TABLE operation_changes(seq INTEGER PRIMARY KEY)']){
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(schema);
  const before=db.prepare('SELECT sql FROM sqlite_master ORDER BY name').all();
  assert.throws(()=>new ExecutionEngine({db,reserveMetadata:()=>{throw Error('must reject before metadata admission');}}),/Unsupported execution schema/);
  assert.deepEqual(db.prepare('SELECT sql FROM sqlite_master ORDER BY name').all(),before);
 }
});

test('minimal execution storage persists immutable ownership and rejects foreign dependencies or operation links',async t=>{
 const {engine,storage,db}=fixture(t);engine.register(base);
 assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name IN ('settings','captures','source_items')").get(),undefined,'the engine must not install a legacy private archive');
 const a=engine.enqueue('task:a','generated',{generated:1},{id:'step:a',ownership:owner('a')});
 assert.deepEqual(engine.get(a)!.ownership,owner('a'));
 assert.throws(()=>engine.enqueue('task:b','generated',{generated:1},{id:a,ownership:owner('b')}),/identity conflict/);
 assert.throws(()=>engine.enqueue('task:a','generated',{generated:2},{ownership:owner('b')}),/ownership conflict/);
 assert.throws(()=>engine.enqueue('task:b','generated',{generated:3},{ownership:owner('b'),dependencies:[a]}),/dependency unavailable/);
 assert.throws(()=>engine.enqueue('task:a','generated',{generated:4},{ownership:owner('a'),dependencies:['missing']}),/dependency unavailable/);
 assert.throws(()=>engine.enqueue('task:a','generated',{generated:5},{id:'self',ownership:owner('a'),dependencies:['self']}),/dependency cycle/);
 assert.equal(engine.list().items.length,1,'failed enqueue rolls back every private row');
 const b=engine.enqueue('task:b','generated',{generated:2},{ownership:owner('b')});
 assert.throws(()=>linkOperation(storage,'task:a',b),/ownership conflict/);
 assert.throws(()=>linkOperationParent(storage,'task:a','task:b'),/ownership conflict/);
 linkOperationParent(storage,'task:a','task:future');
 assert.throws(()=>linkOperationParent(storage,'task:future','task:b'),/ownership conflict/,'an empty middle operation cannot join foreign histories');
 assert.throws(()=>engine.enqueue('task:future','generated',{generated:6},{ownership:owner('b')}),/ownership conflict/);
 const child=engine.enqueue('task:a-child','generated',{generated:7},{ownership:owner('a'),dependencies:[a]});
 await engine.drain([a,b,child]);assert.equal(engine.get(child)!.state,'succeeded');
});

test('user fairness precedes operation fairness even when one user has many distinct queued operations',async t=>{
 const {engine,db}=fixture(t),entered=deferred(),release=deferred(),order:string[]=[];
 t.after(()=>release.resolve());
 engine.register({...base,execute:async step=>{order.push(step.operationId);if(order.length===1){entered.resolve();await release.promise;}return null;}});
 const ids:string[]=[];
 for(let i=0;i<40;i++)ids.push(engine.enqueue('task:a-'+i,'generated',{generated:i},{ownership:owner('a')}));
 const run=engine.tick();await entered.promise;
 ids.push(engine.enqueue('task:b-one','generated',{}, {ownership:owner('b')}),engine.enqueue('task:b-two','generated',{}, {ownership:owner('b')}));
 release.resolve();await run;await engine.drain(ids);
 assert.deepEqual(order.slice(0,5),['task:a-0','task:b-one','task:a-1','task:b-two','task:a-2']);
 assert.equal(order.length,42);
 assert.equal(db.prepare('SELECT next FROM execution_sequence WHERE pool=?').get(base.pool)!.next,42);
 assert.equal(db.prepare('SELECT count(DISTINCT last_started) n FROM execution_user_fairness').get()!.n,2);
});

test('separate SQLite connections retain ownership, shared capacity and user resource separation through recovery',async t=>{
 const {engine,db,open}=fixture(t),second=open(),entered=deferred(),release=deferred(),order:string[]=[],commits:string[]=[];
 t.after(()=>release.resolve());
 const resources:ExecutionHandler={...base,concurrency:()=>2,resourceKeys:step=>[JSON.stringify(step.input.shared?['shared',step.input.key]:['user',step.ownership!.userId,step.input.key])],commit:step=>{commits.push(step.id);}};
 engine.register({...resources,execute:async step=>{order.push(step.operationId);entered.resolve();await release.promise;return null;}});
 second.engine.register({...resources,execute:async step=>{order.push(step.operationId);return null;}});
 const held=engine.enqueue('task:a-held','generated',{key:'same',shared:true},{ownership:owner('a')});
 const running=engine.tick();await entered.promise;
 const blocked=second.engine.enqueue('task:b-shared','generated',{key:'same',shared:true},{ownership:owner('b')}),independent=second.engine.enqueue('task:b-private','generated',{key:'same',shared:false},{ownership:owner('b')});
 await second.engine.drain([blocked,independent]);assert.deepEqual(order,['task:a-held','task:b-private']);assert.equal(second.engine.get(blocked)!.attempts,0);
 // A crashed host's lease expires. The other connection resumes the same owner
 // and the old host's eventual result cannot publish over its new fence.
 db.prepare('UPDATE execution_steps SET lease_until=0 WHERE id=?').run(held);
 await second.engine.drain([held,blocked]);
 assert.deepEqual(second.engine.get(held)!.ownership,owner('a'));assert.equal(second.engine.get(held)!.state,'succeeded');
 release.resolve();await running;
 assert.equal(commits.filter(id=>id===held).length,1);
 assert.equal(second.engine.get(blocked)!.state,'succeeded');
 await engine.close();await second.engine.close();
 const reopened=open();assert.deepEqual(reopened.engine.get(held)!.ownership,owner('a'));assert.equal(reopened.engine.get(held)!.state,'succeeded');
});

test('fixed user readers keep page, detail and changes cursors independent of another user activity',async t=>{
 const {engine,storage}=fixture(t);engine.register(base);
 const a=new Operations(storage,'a'),b=new Operations(storage,'b');assert.throws(()=>new Operations(storage,''),/user required/);
 assert.deepEqual(a.page(),{items:[],nextCursor:null,changeCursor:0});
 engine.enqueue('task:a-one','generated',{}, {ownership:owner('a')});
 const first=a.page();
 for(let i=0;i<250;i++)engine.enqueue('task:b-'+i,'generated',{generated:i},{ownership:owner('b')});
 assert.equal(a.page().changeCursor,first.changeCursor);
 assert.deepEqual(a.changes(first.changeCursor),{ids:[],cursor:first.changeCursor,reset:false,hasMore:false});
 const second=engine.enqueue('task:a-two','generated',{}, {ownership:owner('a')});
 const latest=a.page({limit:1});assert.equal(latest.nextCursor,2);assert.equal(latest.items[0].id,'task:a-two');
 assert.deepEqual(a.page({cursor:latest.nextCursor!,limit:1}).items.map(item=>item.id),['task:a-one']);
 assert.deepEqual(engine.list({userId:'a',limit:1}).nextCursor,2);
 engine.enqueue('task:a-two','generated',{generated:1},{ownership:owner('a')});
 assert.equal(a.detail('task:a-two',0,1).nextCursor,2);
 assert.equal(a.detail('task:a-two',2,1).steps.length,1);
 assert.throws(()=>b.detail('task:a-one'),/not found/);assert.throws(()=>a.detail('task:b-0'),/not found/);
 assert.deepEqual(new Set(a.changes(first.changeCursor).ids),new Set(['task:a-two']));
 engine.cancel(second);assert.deepEqual(a.changes(first.changeCursor).ids,['task:a-two']);
 assert.ok(b.changes(0).hasMore);assert.ok(b.changes(0).ids.every(id=>id.startsWith('task:b-')));
});

test('a process exit retains the account grant, shared lease and next user turn before fenced recovery',async t=>{
 const {engine,path,open,db}=fixture(t);let oldHostCalls=0;
 engine.register({...base,execute:async()=>{oldHostCalls++;return null;}});
 const a=engine.enqueue('task:process-a','generated',{}, {ownership:owner('a')}),b=engine.enqueue('task:process-b','generated',{}, {ownership:owner('b')});
 const script=`import {DatabaseSync} from 'node:sqlite';import {ExecutionEngine} from ${JSON.stringify(new URL('../src/execution-engine.ts',import.meta.url).href)};
 const db=new DatabaseSync(${JSON.stringify(path)});db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
 const engine=new ExecutionEngine({db,reserveMetadata(){}});engine.register({kind:'generated',pool:'generated',concurrency:()=>1,validate:()=>true,execute:async step=>{process.stdout.write(JSON.stringify(step.ownership));process.exit(0);},commit(){}});await engine.tick();`;
 const child=spawnSync(process.execPath,['--import','tsx','--input-type=module','--eval',script],{cwd:fileURLToPath(new URL('../../../',import.meta.url)),encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),owner('a'));
 assert.equal(engine.get(a)!.state,'running');
 await engine.tick();assert.equal(oldHostCalls,0,'an exited process retains its durable lease until expiry');
 const afterLease=Number(db.prepare('SELECT lease_until FROM execution_steps WHERE id=?').get(a)!.lease_until)+1,restarted=open(()=>afterLease),order:string[]=[];
 restarted.engine.register({...base,execute:async step=>{order.push(step.ownership!.userId);return null;}});
 await restarted.engine.drain([a,b]);assert.deepEqual(order,['b','a'],'restart retains the other user next fair turn');
 assert.deepEqual(restarted.engine.get(a)!.ownership,owner('a'));assert.equal(restarted.engine.get(a)!.attempts,2);assert.equal(restarted.engine.get(b)!.attempts,1);
 assert.equal(db.prepare('SELECT next FROM execution_sequence WHERE pool=?').get(base.pool)!.next,3);
});

test('revoked host authority fences checkpoint commits and final publication across SQLite connections',async t=>{
 const {engine,db,open}=fixture(t),other=open(),entered=deferred(),release=deferred();let caught=false,committed=0;
 db.exec('CREATE TABLE generated_authority(enabled INTEGER); INSERT INTO generated_authority VALUES(1); CREATE TABLE generated_checkpoints(value TEXT)');
 const authorized=()=>db.prepare('SELECT enabled FROM generated_authority').get()!.enabled===1;
 engine.register({...base,validateGrant:authorized,execute:async(_step,_signal,grant)=>{entered.resolve();await release.promise;try{grant.commit(()=>db.exec("INSERT INTO generated_checkpoints VALUES('late')"));}catch{caught=true;}return null;},commit:()=>{committed++;}});
 const task=engine.enqueue('task:late','generated',{}, {ownership:owner('a')}),running=engine.tick();await entered.promise;
 other.db.exec('UPDATE generated_authority SET enabled=0');release.resolve();await running;await engine.drain([task]);
 assert.equal(caught,true);assert.equal(committed,0);assert.equal(engine.get(task)!.state,'stale');assert.equal(db.prepare('SELECT count(*) n FROM generated_checkpoints').get()!.n,0);
});

test('a final commit cannot publish after revoking its own host grant inside the transaction',async t=>{
 const {engine,db}=fixture(t);
 db.exec('CREATE TABLE generated_authority(enabled INTEGER); INSERT INTO generated_authority VALUES(1); CREATE TABLE generated_outputs(value TEXT)');
 engine.register({...base,validateGrant:()=>db.prepare('SELECT enabled FROM generated_authority').get()!.enabled===1,commit:()=>{db.exec("INSERT INTO generated_outputs VALUES('must roll back'); UPDATE generated_authority SET enabled=0");}});
 const task=engine.enqueue('task:self-revoked','generated',{}, {ownership:owner('a')});await engine.drain([task]);
 assert.equal(engine.get(task)!.state,'stale');assert.equal(db.prepare('SELECT count(*) n FROM generated_outputs').get()!.n,0);assert.equal(db.prepare('SELECT enabled FROM generated_authority').get()!.enabled,1);
});

test('host capacity units span pools and connections while owner/kind limits, physical resources and late cancellation remain fenced',async t=>{
 const releases=new Map<string,()=>void>(),started:string[]=[],committed:string[]=[];t.after(()=>{for(const release of releases.values())release();});
 const first=fixture(t),second=first.open();let limit=3;
 const partition=(step:any)=>step.input.group?{key:step.ownership.userId+':'+step.input.group,unit:String(step.input.unit),concurrency:step.ownership.userId==='b'?1:limit}:undefined;
 for(const current of [first,second])for(const pool of ['coordinator','physical'])current.engine.configurePool(pool,{lane:()=> 'background',concurrency:{background:()=>1,interactive:()=>1},partition});
 for(const [current,kind] of [[first,'coordinator'],[second,'physical']] as const)current.engine.register({...base,kind,pool:kind,resourceKeys:step=>step.input.resource?['generated-physical-listener']:[],execute:async step=>{started.push(step.id);await new Promise<void>(resolve=>releases.set(step.id,resolve));return {};},commit:step=>{committed.push(step.id);}});
 const add=(current:typeof first,kind:string,id:string,userId:string,group:string|undefined,unit=id,resource=false)=>current.engine.enqueue('operation:'+id,kind,{group,unit,resource},{id,ownership:owner(userId)});
 for(let i=0;i<4;i++){add(first,'coordinator','a-parent-'+i,'a','ocr','a-unit-'+i);add(second,'physical','a-child-'+i,'a','ocr','a-unit-'+i);}
 add(second,'physical','b-child','b','ocr');add(second,'physical','a-derived','a','derived');
 const pumping=[first.engine.tick(),second.engine.tick()];await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(started.filter(id=>id.startsWith('a-parent-')),['a-parent-0','a-parent-1','a-parent-2']);assert.equal(started.filter(id=>id.startsWith('a-child-')).length,3,'exact parent/child units share capacity across actual connections');assert.ok(started.includes('b-child'));assert.ok(started.includes('a-derived'));
 limit=1;first.engine.cancel('a-parent-0');second.engine.cancel('a-child-0');
 await new Promise(resolve=>setTimeout(resolve,20));void second.engine.tick();assert.equal(started.includes('a-child-3'),false,'two occupied units remain above the lowered limit');
 releases.get('a-parent-1')!();releases.get('a-child-1')!();await new Promise(resolve=>setTimeout(resolve,20));void second.engine.tick();assert.equal(started.includes('a-child-3'),false,'one occupied unit still fills the lowered limit');
 releases.get('a-parent-2')!();releases.get('a-child-2')!();await new Promise(resolve=>setTimeout(resolve,20));void first.engine.tick();void second.engine.tick();await new Promise(resolve=>setTimeout(resolve,20));assert.ok(started.includes('a-child-3'));
 releases.get('a-parent-0')!();releases.get('a-child-0')!();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(committed.includes('a-child-0'),false,'late result cannot commit after cancellation');
 for(const release of releases.values())release();await Promise.all(pumping);await new Promise(resolve=>setImmediate(resolve));for(const release of releases.values())release();
 add(second,'physical','unpartitioned-one','a',undefined);add(second,'physical','unpartitioned-two','b',undefined);
 add(second,'physical','resource-one','a','listener-one','r1',true);add(second,'physical','resource-two','b','listener-two','r2',true);
 void second.engine.tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(started.filter(id=>id.startsWith('unpartitioned-')).length,1,'ordinary pool capacity is unchanged');assert.equal(started.filter(id=>id.startsWith('resource-')).length,1,'capacity partitions cannot bypass the shared physical resource');
 for(let i=0;i<4;i++){for(const release of releases.values())release();await new Promise(resolve=>setImmediate(resolve));}
 assert.equal(started.filter(id=>id.startsWith('resource-')).length,2);
});
