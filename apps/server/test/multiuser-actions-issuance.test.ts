import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {fixture} from './fixtures/scoped-actions.js';
import {PrivateSql} from '../src/scope/private-data-sql.js';
import {ExecutionFailure} from '../src/execution-engine.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';

for(const failure of ['throw','async'] as const)test('M12 issuance hook rolls back both the real M05 call and domain intent on '+failure,async t=>{
 const f=await fixture(t),db=f.node.actions!.db;db.exec('CREATE TABLE generated_action_intents(user_id TEXT NOT NULL,id TEXT NOT NULL,PRIMARY KEY(user_id,id))');
 const dispose=f.node.execution!.register({kind:'actions.fixture',pool:'actions.fixture',concurrency:()=>1,policy:EXECUTION_POLICIES.control,parseInput:raw=>z.object({}).strict().parse(raw),execute:async run=>{const sql=new PrivateSql(db,run.context.userId,()=>f.node.authority.assert(run.context));run.external.begin('same-request-key',issuance=>{sql.run('INSERT INTO generated_action_intents VALUES($user,?)',issuance);if(failure==='throw')throw Error('Generated atomic failure');return Promise.resolve();});return {};}});t.after(dispose);
 const context=await f.node.authority.authenticate(f.a.token),task=f.node.execution!.forUser(context).submitSync({kind:'actions.fixture',operationId:'same-operation',input:{}});await f.node.execution!.engine.drain([task.id]);
 const result=f.node.execution!.forUser(context).get(task.id);assert.equal(result.state,'failed');assert.equal(result.externalState,'none');assert.equal(db.prepare('SELECT count(*) n FROM task_external_calls WHERE user_id=?').get(f.a.userId)!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM generated_action_intents WHERE user_id=?').get(f.a.userId)!.n,0);
});

test('exact M05 completion capability settles only the issued A fact after cancellation and account disable',async t=>{
 const f=await fixture(t),callbacks=new Map<string,()=>void>(),issuances=new Map<string,string>();let commits=0;
 const dispose=f.node.execution!.register({kind:'actions.fixture',pool:'actions.fixture',concurrency:()=>1,policy:EXECUTION_POLICIES.control,parseInput:raw=>z.object({}).strict().parse(raw),execute:async run=>{const issuance=run.external.begin('same-request-key');issuances.set(run.context.userId,issuance);callbacks.set(run.context.userId,f.node.execution!.bindExternalCompletion(run.context,run.task.id,issuance));throw new ExecutionFailure('blocked','external_result_unknown');},commit:()=>{commits++;}});t.after(dispose);
 const a=await f.node.authority.authenticate(f.a.token),b=await f.node.authority.authenticate(f.b.token),at=f.node.execution!.forUser(a).submitSync({kind:'actions.fixture',operationId:'same-operation',input:{}}),bt=f.node.execution!.forUser(b).submitSync({kind:'actions.fixture',operationId:'same-operation',input:{}});await f.node.execution!.engine.drain([at.id,bt.id]);
 assert.throws(()=>f.node.execution!.bindExternalCompletion(b,at.id,issuances.get(a.userId)!));const before=f.node.execution!.forUser(b).get(bt.id);f.node.execution!.forUser(a).cancel(at.id);await f.ok(f.admin.token,'/api/admin/accounts/'+f.a.userId,'PATCH',{disabled:true});
 callbacks.get(a.userId)!();callbacks.get(a.userId)!();const db=f.node.actions!.db;assert.equal(db.prepare('SELECT state FROM task_external_calls WHERE issuance_id=?').get(issuances.get(a.userId)!)!.state,'succeeded');assert.equal(f.node.execution!.engine.get(at.id)!.state,'cancelled');assert.equal(commits,0);assert.deepEqual(f.node.execution!.forUser(b).get(bt.id),before);
});

test('a completed stage admits the next real issuance while a replayed first ACK cannot settle that later stage',async t=>{
 const f=await fixture(t),db=f.node.actions!.db,late=new Map<string,()=>void>();
 const dispose=f.node.execution!.register({kind:'actions.fixture',pool:'actions.fixture',concurrency:()=>1,policy:EXECUTION_POLICIES.control,parseInput:raw=>z.object({}).strict().parse(raw),execute:async run=>{
  const first=run.external.begin('same-first-stage'),finish=f.node.execution!.bindExternalCompletion(run.context,run.task.id,first);finish();
  const second=run.external.begin('same-second-stage');late.set(run.context.userId,f.node.execution!.bindExternalCompletion(run.context,run.task.id,second));finish();
  throw new ExecutionFailure('blocked','external_result_unknown');
 }});t.after(dispose);
 const a=await f.node.authority.authenticate(f.a.token),b=await f.node.authority.authenticate(f.b.token),at=f.node.execution!.forUser(a).submitSync({kind:'actions.fixture',operationId:'same-staged-operation',input:{}}),bt=f.node.execution!.forUser(b).submitSync({kind:'actions.fixture',operationId:'same-staged-operation',input:{}});await f.node.execution!.engine.drain([at.id,bt.id]);
 const calls=(owner:string)=>db.prepare('SELECT request_key,state FROM task_external_calls WHERE user_id=? ORDER BY request_key').all(owner),before=calls(b.userId);
 assert.deepEqual(calls(a.userId).map(row=>[row.request_key,row.state]),[['same-first-stage','succeeded'],['same-second-stage','issued']]);assert.equal(f.node.execution!.forUser(a).get(at.id).externalState,'issued');
 late.get(a.userId)!();assert.equal(f.node.execution!.forUser(a).get(at.id).externalState,'succeeded');assert.equal(f.node.execution!.forUser(a).get(at.id).state,'blocked','settlement never readmits a task');assert.deepEqual(calls(b.userId),before);assert.equal(f.node.execution!.forUser(b).get(bt.id).externalState,'issued');
});
