import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import type {TaskRun,UserTaskHandler} from '../src/scope/task-execution.js';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
const handler=(execute:UserTaskHandler['execute']=async run=>({label:run.task.input.label})):UserTaskHandler=>({
 kind:'generated.operation-parity',pool:'generated.operation-parity',concurrency:()=>2,policy:EXECUTION_POLICIES.deterministic,
 parseInput:raw=>z.object({label:z.string()}).strict().parse(raw),execute,
});
const taskPath=(id:string)=>'/api/tasks/'+id;
const operationPath=(id:string)=>'/api/operations/'+encodeURIComponent(id);

test('canonical parent generations keep retired history inactive when old work completes or admits a late descendant',async t=>{
 const held=deferred(),entered=deferred();
 const f=await scopedFilesFixture(t,node=>node.execution.register(handler(async run=>{if(run.task.input.label==='old'){entered.resolve();await held.promise;}return {retained:true};})));
 t.after(()=>held.resolve());
 const service=f.host.execution.forUser(await f.host.authority.authenticate(f.a.token));
 const request=(operationId:string,label:string)=>({kind:'generated.operation-parity',operationId,input:{label}});
 const old=service.submitSync(request('file:old-request','old'),{parentOperationId:'file:canonical',generation:{slot:'pipeline'}});await entered.promise;
 const next=await service.submit(request('file:new-request','new'),undefined,{parentOperationId:'file:canonical',generation:{slot:'pipeline'}});
 await waitForScopedState(async()=>(await f.checked(f.a.token,taskPath(next.id))).state==='succeeded',()=>'new generated pipeline did not complete');
 const findParent=async()=>{const page=await f.checked(f.a.token,'/api/operations?kind=file');for(const item of page.items){const detail=await f.checked(f.a.token,operationPath(item.id));if(detail.steps.some((step:{id:string})=>step.id===old.id)&&detail.steps.some((step:{id:string})=>step.id===next.id))return detail;}assert.fail('canonical generation parent missing');};
 let detail=await findParent();assert.equal(detail.operation.total,1);assert.equal(detail.operation.state,'succeeded');assert.equal(detail.steps.find((step:{id:string})=>step.id===old.id).current,false);
 const late=service.submitSync(request('file:obsolete-descendant','late'),{parentTaskId:old.id});
 await waitForScopedState(async()=>(await f.checked(f.a.token,taskPath(late.id))).state==='succeeded',()=>'late obsolete descendant did not finish');held.resolve();
 await waitForScopedState(async()=>(await f.checked(f.a.token,taskPath(old.id))).state==='succeeded',()=>'old generated pipeline did not settle');
 detail=await findParent();assert.equal(detail.operation.total,1);assert.equal(detail.operation.counts.succeeded,1);assert.equal(detail.steps.find((step:{id:string})=>step.id===old.id).current,false);assert.ok(!detail.steps.some((step:{id:string})=>step.id===late.id));
 await f.restart();detail=await findParent();assert.equal(detail.operation.total,1);assert.equal(detail.operation.state,'succeeded');
});

test('production HTTP Operations preserve each business family and incremental completion changes under account isolation',async t=>{
 const held=deferred(),entered=deferred();let running:TaskRun|undefined;
 const f=await scopedFilesFixture(t,node=>node.execution.register(handler(async run=>{
  if(run.task.input.label==='held'){running=run;entered.resolve();await held.promise;}
  return {label:run.task.input.label};
 })));
 t.after(()=>held.resolve());
 const before=await f.checked(f.a.token,'/api/operations'),tasks=[];
 for(const family of ['file','capture','memory','import','query','insight','workflow:actions']){
  const business=family+':same-generated-business';
  const task=await f.checked(f.a.token,'/api/tasks','POST',{kind:'generated.operation-parity',operationId:business,input:{label:family==='memory'?'held':family}});
  assert.match(task.operationId,new RegExp('^'+family+':'));
  assert.equal(task.operationId.includes('same-generated-business'),false,'private IDs omit the business identity body');
  tasks.push(task);
 }
 await entered.promise;
 const foreign=await f.checked(f.b.token,'/api/tasks','POST',{kind:'generated.operation-parity',operationId:'memory:same-generated-business',input:{label:'B generated private result'}});
 assert.notEqual(foreign.operationId,tasks[2].operationId);
 for(const family of ['file','capture','memory','import','query','insight','workflow']){
  const page=await f.checked(f.a.token,'/api/operations?kind='+family);
  assert.equal(page.items.length,1,JSON.stringify(page));
  assert.equal(page.items[0].kind,family);
  assert.ok(!page.items.some((item:{id:string})=>item.id===foreign.operationId));
 }
 const runningPage=await f.checked(f.a.token,'/api/operations?kind=memory');
 assert.equal(runningPage.items[0].state,'running');
 const cursor=runningPage.changeCursor;
 held.resolve();
 await waitForScopedState(async()=>(await f.checked(f.a.token,taskPath(tasks[2].id))).state==='succeeded',()=>'generated Memory operation did not complete');
 const completed=await f.checked(f.a.token,operationPath(tasks[2].operationId));
 assert.equal(completed.operation.kind,'memory');assert.equal(completed.operation.state,'succeeded');
 const changes=await f.checked(f.a.token,'/api/operations/changes?since='+cursor);
 assert.equal(changes.reset,false);assert.ok(changes.ids.includes(tasks[2].operationId));assert.ok(!changes.ids.includes(foreign.operationId));
 const allChanges=await f.checked(f.a.token,'/api/operations/changes?since='+before.changeCursor);
 for(const task of tasks)assert.ok(allChanges.ids.includes(task.operationId));
 assert.ok(running);assert.throws(()=>running.progress({late:true}),'completed attempts cannot publish late progress');
 assert.equal((await f.request(f.b.token,operationPath(tasks[2].operationId))).statusCode,404);
});

test('production parent Operations aggregate existing and late nested steps once, persist cancellation and keep links across restart',async t=>{
 const held=deferred(),entered=deferred();let run:TaskRun|undefined;
 const f=await scopedFilesFixture(t,node=>node.execution.register(handler(async current=>{
  if(current.task.input.label==='cancel-child'){run=current;entered.resolve();await held.promise;}
  return {label:current.task.input.label};
 })));
 t.after(()=>held.resolve());
 const context=await f.host.authority.authenticate(f.a.token),service=f.host.execution.forUser(context);
 const submit=(label:string)=>f.checked(f.a.token,'/api/tasks','POST',{kind:'generated.operation-parity',operationId:'memory:generated-job',input:{label}});
 const first=await submit('existing-child');
 await waitForScopedState(async()=>(await f.checked(f.a.token,taskPath(first.id))).state==='succeeded',()=>'existing generated child did not complete');
 service.linkParent('import:generated-root','file:generated-file');
 service.linkParent('file:generated-file','memory:generated-job');
 const parents=await f.checked(f.a.token,'/api/operations?kind=import');assert.equal(parents.items.length,1);
 const parentId=parents.items[0].id;
 let detail=await f.checked(f.a.token,operationPath(parentId));
 assert.deepEqual(detail.steps.map((step:{id:string})=>step.id),[first.id]);assert.equal(detail.operation.counts.succeeded,1);
 const cursor=parents.changeCursor;
 const second=await submit('cancel-child');await entered.promise;
 detail=await f.checked(f.a.token,operationPath(parentId));
 assert.equal(detail.operation.total,2);assert.equal(detail.operation.counts.running,1);
 service.linkParent('import:generated-root','memory:generated-job');
 detail=await f.checked(f.a.token,operationPath(parentId));
 assert.equal(detail.steps.filter((step:{id:string})=>step.id===second.id).length,1,'multiple ancestry paths must not duplicate one execution');
 assert.equal((await f.checked(f.a.token,taskPath(second.id)+'/cancel','POST',{})).state,'cancelled');
 assert.ok(run);assert.throws(()=>run!.grant.commit(()=>{}));held.resolve();await delay(20);
 detail=await f.checked(f.a.token,operationPath(parentId));assert.equal(detail.operation.counts.cancelled,1);assert.equal(detail.operation.counts.succeeded,1);
 const changes=await f.checked(f.a.token,'/api/operations/changes?since='+cursor);assert.equal(changes.reset,false);assert.ok(changes.ids.includes(parentId));
 await f.restart();
 detail=await f.checked(f.a.token,operationPath(parentId));assert.equal(detail.operation.total,2);assert.equal(detail.operation.counts.cancelled,1);
 const third=await submit('after-restart');
 await waitForScopedState(async()=>(await f.checked(f.a.token,taskPath(third.id))).state==='succeeded',()=>'late child after restart did not complete');
 detail=await f.checked(f.a.token,operationPath(parentId));assert.equal(detail.operation.total,3);assert.equal(detail.operation.counts.succeeded,2);assert.equal(detail.operation.counts.cancelled,1);
 assert.deepEqual(new Set(detail.steps.map((step:{id:string})=>step.id)),new Set([first.id,second.id,third.id]));
 assert.equal((await f.checked(f.a.token,taskPath(second.id))).result,undefined);
 assert.equal((await f.request(f.b.token,operationPath(parentId))).statusCode,404);
});

test('host task parent admission is atomic on replay and rejects foreign tasks or request-supplied hierarchy',async t=>{
 const f=await scopedFilesFixture(t,node=>node.execution.register(handler()));
 const a=await f.host.authority.authenticate(f.a.token),b=await f.host.authority.authenticate(f.b.token),service=f.host.execution.forUser(a),foreign=f.host.execution.forUser(b);
 const request=(operationId:string,label:string)=>({kind:'generated.operation-parity',operationId,input:{label}});
 const parent=service.submitSync(request('import:host-parent','parent'));
 const child=await service.submit(request('file:host-child','child'),undefined,{parentTaskId:parent.id});
 assert.equal((await f.checked(f.a.token,operationPath(parent.operationId))).operation.total,2);
 const replay=service.submitSync(request('file:host-child','child'),{parentOperationId:'memory:another-parent'});assert.equal(replay.id,child.id);
 const other=await f.checked(f.a.token,'/api/operations?kind=memory');assert.equal(other.items.length,1);assert.equal(other.items[0].total,1);
 service.linkTaskParent(parent.id,child.id);
 assert.equal((await f.checked(f.a.token,operationPath(parent.operationId))).operation.total,2);
 const ownParent=service.submitSync(request('file:already-canonical','own parent'),{parentOperationId:'file:already-canonical',generation:{slot:'pipeline'}});
 assert.equal((await f.checked(f.a.token,operationPath(ownParent.operationId))).operation.total,1,'canonical business identities remain valid inputs');
 const nextOwnParent=service.submitSync(request('file:already-canonical','new own parent'),{parentOperationId:'file:already-canonical',generation:{slot:'pipeline'}});const ownDetail=await f.checked(f.a.token,operationPath(ownParent.operationId));assert.equal(ownDetail.operation.total,1);assert.equal(ownDetail.steps.find((step:{id:string})=>step.id===ownParent.id).current,false);assert.equal(ownDetail.steps.find((step:{id:string})=>step.id===nextOwnParent.id).current,true);
 const longest=service.submitSync(request('a'.repeat(254)+':z','maximum business identity'));
 assert.ok(longest.operationId.length<=256);
 assert.equal((await f.checked(f.a.token,operationPath(longest.operationId))).operation.id,longest.operationId,'every accepted identity remains readable');
 const foreignChild=foreign.submitSync(request('file:host-child','foreign'));
 const before=(await f.checked(f.a.token,'/api/tasks')).items.length;
 assert.throws(()=>service.linkTaskParent(parent.id,foreignChild.id));
 assert.throws(()=>service.submitSync(request('file:rejected-child','rejected'),{parentTaskId:foreignChild.id}));
 assert.equal((await f.checked(f.a.token,'/api/tasks')).items.length,before,'failed ancestry admission cannot leave a runnable task');
 const rejected=await f.request(f.a.token,'/api/tasks','POST',{...request('file:request-parent-spoof','spoof'),parentOperationId:'import:host-parent'});
 assert.ok(rejected.statusCode>=400);
 assert.throws(()=>service.linkParent('memory:another-parent','memory:another-parent'));
 assert.throws(()=>service.linkParent('file:host-child','import:host-parent'));
});
