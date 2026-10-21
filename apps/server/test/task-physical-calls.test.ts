import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {TaskPhysicalCalls} from '../src/scope/task-physical-calls.js';
import type {ExecutionStep} from '../src/execution-engine.js';
const step=(id:string,userId='generated-owner')=>({id,attemptId:'generated-attempt-'+id,ownership:{userId,grantId:'generated-grant',authorizationEpoch:1}} as ExecutionStep);
const immediate=<T>(work:()=>T)=>work();

test('a nested read span cannot substitute task, owner, snapshot, mode or a second issuance',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('CREATE TABLE user_tasks(task_id TEXT PRIMARY KEY);CREATE TABLE execution_resources(step_id TEXT,resource_key TEXT);INSERT INTO user_tasks VALUES(\'generated-task\'),(\'generated-other\')');
 const physical=new TaskPhysicalCalls(db),own=step('generated-task');let quiescentInside=false;
 await physical.run(own,'generated-deployment','generated-snapshot','read-query',immediate,async()=>{
  physical.bind(own,'generated-issuance');await physical.run(own,'generated-deployment','generated-snapshot','read-query',immediate,async()=>{assert.equal(physical.receipt('generated-issuance')!.state,'active');});
  for(const [target,deployment,snapshot,mode]of [[step('generated-other'),'generated-deployment','generated-snapshot','read-query'],[step(own.id,'generated-foreign'),'generated-deployment','generated-snapshot','read-query'],[own,'generated-foreign','generated-snapshot','read-query'],[own,'generated-deployment','generated-foreign','read-query'],[own,'generated-deployment','generated-snapshot','reconcile'],[{...own,attemptId:'generated-other-attempt'},'generated-deployment','generated-snapshot','read-query']] as const)await assert.rejects(physical.run(target,deployment,snapshot,mode,immediate,async()=>assert.fail('invalid nested owner reached work')),{code:'physical_owner_invalid'});
  assert.throws(()=>physical.bind(own,'generated-second-issuance'),{code:'physical_owner_invalid'});assert.equal(physical.receipt('generated-second-issuance'),undefined);quiescentInside=physical.receipt('generated-issuance')!.state==='quiescent';
 });
 assert.equal(quiescentInside,false);assert.equal(physical.receipt('generated-issuance')!.state,'quiescent');assert.equal(physical.busy(own.id),false);
});

test('another host sharing exclusive resources waits for exact physical finally after the business fence is gone',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec("CREATE TABLE user_tasks(task_id TEXT PRIMARY KEY);CREATE TABLE execution_resources(step_id TEXT,resource_key TEXT);INSERT INTO user_tasks VALUES('generated-task'),('generated-other');INSERT INTO execution_resources VALUES('generated-task','generated-exclusive'),('generated-other','generated-exclusive')");
 const a=new TaskPhysicalCalls(db),b=new TaskPhysicalCalls(db);let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),start=new Promise<void>(r=>entered=r);t.after(()=>release());const running=a.run(step('generated-task'),'generated-deployment','generated-snapshot','read-query',immediate,async()=>{a.bind(step('generated-task'),'generated-issuance');entered();await gate;throw Error('Generated retired callback');});void running.catch(()=>{});await start;
 await assert.rejects(b.run(step('generated-other'),'generated-deployment','generated-other-snapshot','read-query',immediate,async()=>assert.fail('a new host bypassed physical cleanup')),{code:'physical_cleanup_pending'});
 release();await assert.rejects(running,/Generated retired callback/);assert.equal(a.receipt('generated-issuance')!.state,'quiescent');await b.run(step('generated-other'),'generated-deployment','generated-other-snapshot','read-query',immediate,async()=>{});
});
