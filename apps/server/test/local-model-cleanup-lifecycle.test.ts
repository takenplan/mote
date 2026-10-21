import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {buildApp} from '../src/app.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import type {TaskExecution,TaskRun,UserTaskHandler} from '../src/scope/task-execution.js';

const password='Generated-local-cleanup-password-01';
const protocol={'x-mote-protocol-version':'2'};
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
type ProductionNode=Awaited<ReturnType<typeof buildApp>>&{execution:TaskExecution};
type LocalWork=<T>(work:()=>Promise<T>)=>Promise<T>;

// The fallback permits an isolated old-source RED run of this fixture. It is
// test control only: production does not infer or support an old task format.
function localWork<T>(run:TaskRun,work:()=>Promise<T>):Promise<T>{
 const capability=(run as TaskRun&{localWork?:LocalWork}).localWork;
 return capability?capability(work):work();
}
const aborted=(signal:AbortSignal)=>signal.aborted?Promise.resolve():new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));
const handler=(kind:string,execute:UserTaskHandler['execute']):UserTaskHandler=>({kind,pool:kind,concurrency:()=>2,policy:EXECUTION_POLICIES.localProcessing,parseInput:input=>input as Record<string,unknown>,execute});

async function fixture(t:TestContext,mark?:(phase:string)=>void){
 mark?.('setup.start');
 const directory=mkdtempSync(join(tmpdir(),'mote-local-cleanup-lifecycle-'));
 const nodes:ProductionNode[]=[],releases=new Set<()=>void>(),physical=new Set<Promise<unknown>>();
 const track=<T>(promise:Promise<T>)=>{physical.add(promise);void promise.then(()=>physical.delete(promise),()=>physical.delete(promise));return promise;};
 t.after(async()=>{
  mark?.('after.start');
  for(const release of releases)release();mark?.('after.released');
  for(const node of [...nodes].reverse())await node.app.close();mark?.('after.apps-closed');
  await Promise.allSettled([...physical]);mark?.('after.physical-settled');
  rmSync(directory,{recursive:true,force:true});mark?.('after.end');
 });
 const open=async()=>{const node=await buildApp({dataDir:directory}) as ProductionNode;assert.ok(node.execution);nodes.push(node);return node;};
 const node=await open();mark?.('initialize.begin');await node.accounts!.initialize('generated-admin',password);mark?.('initialize.end');
 const request=(host:ProductionNode,token:string|undefined,url:string,method:'GET'|'POST'='GET',payload?:unknown)=>host.app.inject({method,url,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username:string)=>{const r=await request(node,undefined,'/api/auth/login','POST',{username,password,mode:'client',durationMs:86400000});assert.equal(r.statusCode,200,r.body);return r.json() as {token:string};};
 mark?.('admin.login.begin');const admin=await login('generated-admin');mark?.('admin.login.end');
 const account=async(username:string,label:'a'|'b')=>{mark?.(label+'.create.begin');const r=await request(node,admin.token,'/api/admin/accounts','POST',{username,password,administrator:false});assert.equal(r.statusCode,200,r.body);mark?.(label+'.login.begin');return {userId:String(r.json().userId),...(await login(username))};};
 const a=await account('generated-a','a'),b=await account('generated-b','b');mark?.('setup.ready');
 const submit=async(host:ProductionNode,token:string,kind:string,operationId:string)=>{const r=await request(host,token,'/api/tasks','POST',{kind,operationId,input:{label:operationId}});assert.equal(r.statusCode,200,r.body);return r.json() as {id:string};};
 const task=async(host:ProductionNode,token:string,id:string)=>{const r=await request(host,token,'/api/tasks/'+id);assert.equal(r.statusCode,200,r.body);return r.json();};
 const barrier=()=>{const value=deferred();releases.add(value.resolve);return value;};
 const start=(host:ProductionNode)=>{const pumping=host.execution.tick();track(pumping);return pumping;};
 return {directory,node,open,request,a,b,submit,task,barrier,track,start};
}

/** Observe completion of the real engine close, rather than a timing guess or
 * another module's shutdown latency hiding an early TaskExecution.close(). */
function engineClosed(node:ProductionNode){
 const completed=deferred(),close=node.execution.engine.close.bind(node.execution.engine);
 node.execution.engine.close=async()=>{await close();completed.resolve();};
 return completed.promise;
}

test('owner cancellation is terminal before local cleanup, while execution close waits for that cleanup',{timeout:8000},async t=>{
 const f=await fixture(t),entered=deferred(),inFinally=deferred(),release=f.barrier();
 let run!:TaskRun,cleaned=false,commits=0;
 f.node.execution.register({...handler('generated.local.cancel',current=>f.track(localWork(current,async()=>{
  run=current;entered.resolve();
  try{await aborted(current.signal);return 'Generated cancelled result';}
  finally{inFinally.resolve();await release.promise;cleaned=true;}
 }))),commit:()=>{commits++;}});
 const job=await f.submit(f.node,f.a.token,'generated.local.cancel','cancel-local');f.start(f.node);await entered.promise;
 const response=await f.request(f.node,f.a.token,'/api/tasks/'+job.id+'/cancel','POST',{});
 assert.equal(response.statusCode,200,response.body);assert.equal(response.json().state,'cancelled');
 await inFinally.promise;assert.equal(cleaned,false);
 assert.throws(()=>run.checkpoint.write('late',{generated:true}));
 assert.throws(()=>run.progress({generated:true}));assert.throws(()=>run.grant.commit(()=>{commits++;}));
 const terminal=await f.task(f.node,f.a.token,job.id);assert.equal(terminal.state,'cancelled');assert.equal(terminal.result,undefined);
 const engineDone=engineClosed(f.node);let closed=false;
 const closing=f.node.execution.close().then(()=>{closed=true;});
 try{
  await engineDone;await nextTurn();
  assert.equal(closed,false,'engine cancellation must not discard the registered local finally');
  assert.equal(cleaned,false);assert.equal(commits,0);
 }finally{release.resolve();await closing;}
 assert.equal(cleaned,true);assert.equal(commits,0);
});

test('real app close drains its local workspace finally before the generated vault is removed',{timeout:8000},async t=>{
 const f=await fixture(t),entered=deferred(),inFinally=deferred(),release=f.barrier();
 const workspace=join(f.directory,'generated-local-work');let cleaned=false;
 f.node.execution.register(handler('generated.local.workspace',run=>f.track(localWork(run,async()=>{
  mkdirSync(workspace);writeFileSync(join(workspace,'generated.txt'),'Generated local workspace only');entered.resolve();
  try{await aborted(run.signal);return null;}
  finally{inFinally.resolve();await release.promise;rmSync(workspace,{recursive:true});cleaned=true;}
 }))));
 await f.submit(f.node,f.a.token,'generated.local.workspace','close-vault');f.start(f.node);await entered.promise;
 const engineDone=engineClosed(f.node);let closed=false;
 const closing=f.node.app.close().then(()=>{closed=true;});
 try{
  await inFinally.promise;await engineDone;await nextTurn();
  assert.equal(closed,false,'app close must retain the explicitly registered local cleanup');assert.equal(existsSync(workspace),true);
 }finally{release.resolve();await closing;}
 assert.equal(cleaned,true);assert.equal(existsSync(workspace),false);
 rmSync(f.directory,{recursive:true});await nextTurn();assert.equal(existsSync(f.directory),false);
});

test('unregistered remote work does not delay close or clear its issued outcome, and late local work cannot start',{timeout:8000},async t=>{
 const f=await fixture(t),entered=deferred(),remote=f.barrier(),remoteFinished=deferred();
 let run!:TaskRun,calls=0,lateStarted=false,remoteReturned=false;
 const server=createServer((_request,response)=>{entered.resolve();void remote.promise.then(()=>response.end('Generated remote response'));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
 const address=server.address();assert.ok(address&&typeof address!=='string');const url='http://127.0.0.1:'+address.port;
 const remoteHandler=()=>handler('generated.remote.unknown',current=>f.track((async()=>{
  calls++;current.external.begin('generated-physical-request');
  // This real loopback HTTP request deliberately ignores the task signal. The
  // external journal must not treat its eventual response as a current grant.
  if(calls===1){run=current;try{await (await fetch(url)).text();remoteReturned=true;return null;}finally{remoteFinished.resolve();}}
  current.external.complete();return {confirmedAttempt:true};
 })()));
 f.node.execution.register(remoteHandler());
 const job=await f.submit(f.node,f.a.token,'generated.remote.unknown','remote-unknown');f.start(f.node);await entered.promise;
 await f.node.execution.close();assert.equal(remoteReturned,false,'an arbitrary remote promise must not become a shutdown drain');
 await assert.rejects(()=>localWork(run,async()=>{lateStarted=true;return null;}));assert.equal(lateStarted,false);
 const interrupted=await f.task(f.node,f.a.token,job.id);assert.equal(interrupted.externalState,'issued');assert.equal(interrupted.externalUnresolved,1);
 assert.equal((await f.request(f.node,f.a.token,'/api/tasks/'+job.id+'/retry','POST',{})).statusCode,409);
 assert.equal((await f.request(f.node,f.b.token,'/api/tasks/'+job.id+'/retry','POST',{confirmUnknown:true})).statusCode,404);
 remote.resolve();await remoteFinished.promise;await f.node.app.close();
 const restarted=await f.open();restarted.execution.register(remoteHandler());await restarted.app.ready();await restarted.execution.engine.drain([job.id]);
 const protectedTask=await f.task(restarted,f.a.token,job.id);assert.equal(protectedTask.state,'blocked');assert.equal(protectedTask.externalUnresolved,1);assert.equal(calls,1);
 assert.equal((await f.request(restarted,f.a.token,'/api/tasks/'+job.id+'/retry','POST',{})).statusCode,409);
 const confirmed=await f.request(restarted,f.a.token,'/api/tasks/'+job.id+'/retry','POST',{confirmUnknown:true});assert.equal(confirmed.statusCode,200,confirmed.body);
 await restarted.execution.engine.drain([job.id]);assert.equal(calls,2);assert.equal((await f.task(restarted,f.a.token,job.id)).state,'succeeded');
});

test('local cleanup drains belong to their host while another owner completes normally on the second host',{timeout:30000},async t=>{
 // Independent current profiles, not a new concurrent-schedulers-on-one-vault
 // deployment mode. A/B account checks still use each host's real HTTP routes.
 let started:number|undefined;const mark=(phase:string)=>{try{const at=performance.now();started??=at;t.diagnostic('[local-cleanup-phase] '+phase+' elapsedMs='+(at-started).toFixed(3));}catch{/* Observation failure must not replace the original test outcome. */}};
 mark('body.start');
 const f=await fixture(t,phase=>mark('host-a.'+phase)),second=await fixture(t,phase=>mark('host-b.'+phase)),other=second.node;
 const aEntered=deferred(),aFinally=deferred(),aRelease=f.barrier(),bEntered=deferred(),bRelease=second.barrier();
 let bRun!:TaskRun,bCleaned=false,aCleaned=false,lateStarted=false;
 f.node.execution.register(handler('generated.local.host-a',run=>f.track(localWork(run,async()=>{
  aEntered.resolve();try{await aborted(run.signal);return null;}finally{aFinally.resolve();await aRelease.promise;aCleaned=true;}
 }))));
 other.execution.register(handler('generated.local.host-b',run=>second.track(localWork(run,async()=>{
  bRun=run;bEntered.resolve();try{await bRelease.promise;run.checkpoint.write('owned',{owner:run.context.userId});return {owner:run.context.userId};}finally{bCleaned=true;}
 }))));
 mark('host-a.submit.begin');const a=await f.submit(f.node,f.a.token,'generated.local.host-a','same-business-id');f.start(f.node);mark('host-a.tick-dispatched');await aEntered.promise;mark('host-a.entered');
 mark('host-b.submit.begin');const b=await second.submit(other,second.b.token,'generated.local.host-b','same-business-id');second.start(other);mark('host-b.tick-dispatched');await bEntered.promise;mark('host-b.entered');
 mark('isolation.other-owner-read.begin');assert.equal((await second.request(other,second.a.token,'/api/tasks/'+b.id)).statusCode,404);mark('isolation.other-owner-read.end');
 mark('isolation.other-owner-cancel.begin');assert.equal((await f.request(f.node,f.b.token,'/api/tasks/'+a.id+'/cancel','POST',{})).statusCode,404);mark('isolation.other-owner-cancel.end');
 mark('isolation.foreign-profile.begin');assert.equal((await second.request(other,f.a.token,'/api/tasks/'+b.id)).statusCode,401);mark('isolation.foreign-profile.end');
 mark('host-a.close.begin');const engineDone=engineClosed(f.node);let closed=false;const closing=f.node.execution.close().then(()=>{closed=true;});
 try{
  await aFinally.promise;mark('host-a.finally-observed');await engineDone;mark('host-a.engine-closed');await nextTurn();mark('host-a.next-turn');assert.equal(closed,false);assert.equal(aCleaned,false);
  bRun.grant.assert();bRun.progress({owner:second.b.userId});assert.equal(bCleaned,false);mark('host-b.progress-current');
 }finally{mark('host-a.release');aRelease.resolve();await closing;mark('host-a.close.end');}
 assert.equal(aCleaned,true);assert.equal(bCleaned,false,'closing one host must not drain another host local runtime');
 mark('host-b.running-read.begin');bRun.grant.assert();assert.equal((await second.task(other,second.b.token,b.id)).state,'running');mark('host-b.running-read.end');
 mark('host-b.release');bRelease.resolve();await other.execution.engine.drain([b.id]);mark('host-b.drained');
 mark('host-b.terminal-read.begin');const result=await second.task(other,second.b.token,b.id);mark('host-b.terminal-read.end');assert.equal(result.state,'succeeded');assert.deepEqual(result.result,{owner:second.b.userId});assert.deepEqual(result.checkpoints,['owned']);assert.equal(bCleaned,true);mark('host-b.terminal-assertions-passed');
 mark('host-b.late-local-work.begin');await assert.rejects(()=>localWork(bRun,async()=>{lateStarted=true;return null;}));assert.equal(lateStarted,false);mark('host-b.late-local-work.rejected');
 mark('body.end');
});
