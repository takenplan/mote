import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
  assert.throws(()=>physical.bind(own,'generated-second-issuance'),{code:'physical_owner_invalid'});assert.throws(()=>physical.bind(own,'generated-second-issuance',{state:'succeeded',issuance:'generated-issuance'}),{code:'physical_owner_invalid'});assert.equal(physical.receipt('generated-second-issuance'),undefined);quiescentInside=physical.receipt('generated-issuance')!.state==='quiescent';
 });
 assert.equal(quiescentInside,false);assert.equal(physical.receipt('generated-issuance')!.state,'quiescent');assert.equal(physical.busy(own.id),false);
});

for(const orphan of [false,true])test(`serial reconcile issuances retain distinct immutable facts and one full callback cleanup across SQLite hosts${orphan?' including orphan erasure':''}`,async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-physical-cohort-')),db=new DatabaseSync(join(directory,'generated.sqlite'));db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE user_tasks(task_id TEXT PRIMARY KEY);CREATE TABLE execution_resources(step_id TEXT,resource_key TEXT);CREATE TABLE task_external_calls(issuance_id TEXT PRIMARY KEY,task_id TEXT,user_id TEXT,state TEXT,settled_at INTEGER);INSERT INTO user_tasks VALUES('generated-task'),('generated-other'),('generated-foreign');INSERT INTO execution_resources VALUES('generated-task','generated-exclusive'),('generated-other','generated-exclusive')`);
 const other=new DatabaseSync(join(directory,'generated.sqlite'));other.exec('PRAGMA foreign_keys=ON');t.after(()=>{other.close();db.close();rmSync(directory,{recursive:true,force:true});});const a=new TaskPhysicalCalls(db),b=new TaskPhysicalCalls(other),own=step('generated-task'),foreign=step('generated-foreign','generated-foreign-owner');
 const ledger=(issuance:string,target=own)=>db.prepare("INSERT INTO task_external_calls VALUES(?,?,?,'issued',NULL)").run(issuance,target.id,target.ownership!.userId),settle=(issuance:string)=>db.prepare("UPDATE task_external_calls SET state='succeeded',settled_at=1 WHERE issuance_id=?").run(issuance);
 ledger('generated-foreign-call',foreign);await b.run(foreign,'generated-deployment','generated-foreign-snapshot','reconcile',immediate,async()=>{b.bind(foreign,'generated-foreign-call');settle('generated-foreign-call');});
 await a.run(own,'generated-deployment','generated-snapshot','reconcile',immediate,async()=>{
  ledger('generated-first');a.bind(own,'generated-first');const original=a.receipt('generated-first')!;assert.throws(()=>a.bind(own,'generated-second',{state:'succeeded',issuance:'generated-first'}),{code:'physical_owner_invalid'});assert.equal(a.receipt('generated-second'),undefined);
  settle('generated-first');assert.throws(()=>a.bind(own,'generated-second',{state:'succeeded',issuance:'generated-foreign-call'}),{code:'physical_owner_invalid'});assert.throws(()=>a.bind({...own,attemptId:'generated-forged-attempt'},'generated-second',{state:'succeeded',issuance:'generated-first'}),{code:'physical_owner_invalid'});assert.throws(()=>a.bind(step(own.id,'generated-forged-owner'),'generated-second',{state:'succeeded',issuance:'generated-first'}),{code:'physical_owner_invalid'});
  ledger('generated-second');a.bind(own,'generated-second',{state:'succeeded',issuance:'generated-first'});assert.deepEqual(a.receipt('generated-first'),original);const second=a.receipt('generated-second')!;assert.notEqual(second.id,original.id);for(const key of ['task_id','user_id','deployment_id','incarnation','attempt_id','owner_token','snapshot_id','mode'])assert.equal(second[key],original[key]);assert.equal(second.state,'active');assert.equal(second.quiescent_at,null);assert.equal(db.prepare('SELECT count(*) n FROM task_physical_resources WHERE call_id IN (?,?)').get(original.id,second.id)!.n,2);
  assert.throws(()=>a.bind(own,'generated-third',{state:'succeeded',issuance:'generated-first'}),{code:'physical_owner_invalid'},'a settled older pointer cannot hide a later unresolved cohort call');settle('generated-second');ledger('generated-third');a.bind(own,'generated-third',{state:'succeeded',issuance:'generated-second'});settle('generated-third');
  assert.equal(db.prepare("SELECT count(*) n FROM task_physical_calls WHERE task_id=? AND state='active'").get(own.id)!.n,3,'individual request settlement never attests full callback cleanup');await assert.rejects(b.run(step('generated-other'),'generated-deployment','generated-other-snapshot','reconcile',immediate,async()=>assert.fail('another SQLite host bypassed full callback cleanup')),{code:'physical_cleanup_pending'});
  if(orphan)db.prepare('DELETE FROM user_tasks WHERE task_id=?').run(own.id);
 });
 if(orphan){assert.equal(db.prepare('SELECT count(*) n FROM task_physical_calls WHERE task_id=?').get(own.id)!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM task_physical_resources').get()!.n,0);}else{const facts=db.prepare('SELECT * FROM task_physical_calls WHERE task_id=?').all(own.id);assert.equal(facts.length,3);assert.ok(facts.every(row=>row.state==='quiescent'&&row.quiescent_at));assert.equal(new Set(facts.map(row=>row.quiescent_at)).size,1);assert.equal(new Set(facts.map(row=>row.issuance_id)).size,3);}
 await b.run(step('generated-other'),'generated-deployment','generated-other-snapshot','reconcile',immediate,async()=>{});
});

test('another host sharing exclusive resources waits for exact physical finally after the business fence is gone',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec("CREATE TABLE user_tasks(task_id TEXT PRIMARY KEY);CREATE TABLE execution_resources(step_id TEXT,resource_key TEXT);INSERT INTO user_tasks VALUES('generated-task'),('generated-other');INSERT INTO execution_resources VALUES('generated-task','generated-exclusive'),('generated-other','generated-exclusive')");
 const a=new TaskPhysicalCalls(db),b=new TaskPhysicalCalls(db);let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),start=new Promise<void>(r=>entered=r);t.after(()=>release());const running=a.run(step('generated-task'),'generated-deployment','generated-snapshot','read-query',immediate,async()=>{a.bind(step('generated-task'),'generated-issuance');entered();await gate;throw Error('Generated retired callback');});void running.catch(()=>{});await start;
 await assert.rejects(b.run(step('generated-other'),'generated-deployment','generated-other-snapshot','read-query',immediate,async()=>assert.fail('a new host bypassed physical cleanup')),{code:'physical_cleanup_pending'});
 release();await assert.rejects(running,/Generated retired callback/);assert.equal(a.receipt('generated-issuance')!.state,'quiescent');await b.run(step('generated-other'),'generated-deployment','generated-other-snapshot','read-query',immediate,async()=>{});
});
