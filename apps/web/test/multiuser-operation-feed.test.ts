import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import type {OperationChanges,OperationDetail,OperationPage} from '@mote/shared';
import {EXECUTION_POLICIES} from '../../server/src/execution-policy.js';
import {scopedFilesFixture} from '../../server/test/fixtures/scoped-files.js';
import type {Api} from '../src/api.js';
import {OperationFeed} from '../src/operation-feed.js';
import {resources} from '../src/resource-cache.js';

const held=()=>{
 let release!:()=>void;
 const promise=new Promise<void>(resolve=>{release=resolve;});
 return {promise,release,entered:false};
};
async function until(check:()=>boolean|Promise<boolean>,description:string){
 const deadline=Date.now()+10000;
 while(!await check()){
  assert.ok(Date.now()<deadline,description);
  await delay(10);
 }
}

test('production account operation completions incrementally refresh the matching visible Web resources',async t=>{
 const cases=[
  {family:'memory',kind:'memory',path:'/api/memories?limit=30'},
  {family:'file',kind:'file',path:'/api/files?limit=30'},
  {family:'query',kind:'query',path:'/api/conversations?limit=30'},
  {family:'insight',kind:'insight',path:'/api/insights?limit=30'},
  {family:'import',kind:'import',path:'/api/imports'},
  {family:'workflow:actions',kind:'workflow',path:'/api/actions?cursor=0'},
 ];
 const gates=new Map<string,ReturnType<typeof held>>();
 const f=await scopedFilesFixture(t,host=>{
  host.execution!.register({
   kind:'generated.web-operation-feed',pool:'generated-web-operation-feed',concurrency:()=>12,
   policy:EXECUTION_POLICIES.deterministic,
   parseInput:value=>z.object({label:z.string()}).strict().parse(value),
   execute:async run=>{
    const gate=gates.get(String(run.task.input.label));
    assert.ok(gate,'Only explicitly generated fixture tasks can execute');
    gate.entered=true;
    await gate.promise;
    run.signal.throwIfAborted();
    return {generated:true};
   },
  });
 });
 t.after(()=>{for(const gate of gates.values())gate.release();});

 // Admission goes through the production HTTP route after buildApp's onReady
 // starts the one shared executor. Identical business IDs remain owner-private.
 const tasks:{a:{id:string;operationId:string};b:{id:string;operationId:string}}[]=[];
 for(const [index,entry] of cases.entries()){
  const pair={} as (typeof tasks)[number];
  for(const owner of ['a','b'] as const){
   const label=owner+':'+index;gates.set(label,held());
   pair[owner]=await f.checked(f[owner].token,'/api/tasks','POST',{
    kind:'generated.web-operation-feed',operationId:entry.family+':GENERATED_PRIVATE_BUSINESS_'+index,input:{label},
   });
   assert.match(pair[owner].operationId,new RegExp('^'+entry.family+':[a-f0-9]{64}$'));
  }
  assert.notEqual(pair.a.operationId,pair.b.operationId,'Identical business identifiers are scoped to their account');
  tasks.push(pair);
 }
 await until(()=>[...gates.values()].every(gate=>gate.entered),'Production startup must run every admitted generated task');
 for(const pair of tasks)for(const owner of ['a','b'] as const)
  assert.equal((await f.checked(f[owner].token,'/api/tasks/'+pair[owner].id)).state,'running');

 const reads=new Map<string,number>(),changes:OperationChanges[]=[];
 // Inject only replaces the socket transport: authentication, routing, scoped
 // reads, committed journal and both Web consumers are the production paths.
 const api:Api={
  request:async<T>(path:string,init?:RequestInit):Promise<T>=>{
   init?.signal?.throwIfAborted();
   reads.set(path,(reads.get(path)??0)+1);
   const response=await f.request(f.a.token,path,init?.method??'GET',init?.body?JSON.parse(String(init.body)):undefined);
   assert.equal(response.statusCode,200,response.body);
   init?.signal?.throwIfAborted();
   const value=response.json<T>();
   if(path.startsWith('/api/operations/changes?'))changes.push(value as OperationChanges);
   return value;
  },
  raw:async()=>{throw new Error('This fixture only subscribes to JSON resources');},
 };
 const cache=resources(api),settings=cache.get('/api/configuration');
 const domains=cases.map(entry=>cache.get(entry.path));
 const details=tasks.map(pair=>cache.get<OperationDetail>('/api/operations/'+encodeURIComponent(pair.a.operationId)));
 const lists=cases.map(entry=>cache.get<OperationPage>('/api/operations?kind='+entry.kind+'&limit=100'));
 const visible=[settings,...domains,...details,...lists];
 const unsubscribes=visible.map(resource=>resource.subscribe(()=>{}));
 t.after(()=>unsubscribes.forEach(unsubscribe=>unsubscribe()));
 const ready=()=>visible.every(resource=>{
  const snapshot=resource.getSnapshot();
  assert.equal(snapshot.error,undefined,String(snapshot.error));
  return !snapshot.loading&&snapshot.data!==undefined;
 });
 await until(ready,'Visible production resources must finish their initial reads');
 const feed=new OperationFeed(api,10),stop=feed.subscribe(()=>{});
 t.after(stop);
 await until(()=>changes.length>=2&&ready(),'Initial cursor reset must settle before observing incremental completions');
 assert.equal(changes[0].reset,true);
 assert.deepEqual(changes[0].ids,[]);
 assert.equal(reads.get('/api/configuration'),1,'Unrelated settings do not reload even for the initial operation cursor reset');
 for(const [index,entry] of cases.entries()){
  assert.equal(details[index].getSnapshot().data!.operation.state,'running');
  const items=lists[index].getSnapshot().data!.items;
  assert.ok(items.some(operation=>operation.id===tasks[index].a.operationId&&operation.kind===entry.kind),'Production kind filters retain the original business family');
  assert.ok(items.every(operation=>!tasks.some(pair=>pair.b.operationId===operation.id)));
 }

 const beforeB=new Map([...reads].filter(([path])=>!path.startsWith('/api/operations/changes?')));
 for(const [index,pair] of tasks.entries()){
  gates.get('b:'+index)!.release();
  await until(async()=>(await f.checked(f.b.token,'/api/tasks/'+pair.b.id)).state==='succeeded','B generated task must complete');
 }
 const afterB=changes.length;
 await until(()=>changes.length>=afterB+2&&ready(),'A feed must continue polling after B-only completions');
 assert.deepEqual(new Map([...reads].filter(([path])=>!path.startsWith('/api/operations/changes?'))),beforeB,'Another account completing work must not invalidate A resources');
 assert.ok(changes.slice(1).every(change=>!change.reset&&change.ids.length===0),'B changes do not expose IDs or force a global reset in A');

 for(const [index,entry] of cases.entries()){
  const pair=tasks[index],before=reads.get(entry.path)!,changeStart=changes.length;
  gates.get('a:'+index)!.release();
  await until(()=>{
   const detail=details[index].getSnapshot(),list=lists[index].getSnapshot();
   return !detail.loading&&detail.data?.operation.state==='succeeded'&&
    !list.loading&&list.data?.items.some(operation=>operation.id===pair.a.operationId&&operation.state==='succeeded')===true&&
    (reads.get(entry.path)??0)>before&&ready();
  },entry.family+' completion must refresh its visible domain, filtered list and detail via the feed');
  assert.ok(changes.slice(changeStart).some(change=>!change.reset&&change.ids.includes(pair.a.operationId)),entry.family+' completion must reach Web through the incremental committed journal');
  assert.equal(reads.get('/api/configuration'),1,'Business completion must not reload unrelated settings');
 }
 assert.ok(changes.slice(1).every(change=>!change.reset),'Completion refreshes never rely on a global reset');
 assert.ok(changes.flatMap(change=>change.ids).every(id=>tasks.some(pair=>pair.a.operationId===id)),'Every changed operation exposed to A belongs to A');
 assert.doesNotMatch(JSON.stringify(changes),/GENERATED_PRIVATE_BUSINESS_/,'Change receipts retain opaque business identifiers');
 assert.equal(feed.getSnapshot(),undefined);

 stop();unsubscribes.forEach(unsubscribe=>unsubscribe());
 const stopped=changes.length;
 await delay(30);
 assert.equal(changes.length,stopped,'The feed stops once its last visible observer is removed');
});
