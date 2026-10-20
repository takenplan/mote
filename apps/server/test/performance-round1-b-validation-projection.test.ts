import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {ExecutionFailure} from '../src/execution-engine.js';
import {projectionHarness,observeGets} from './performance-round1-b-validation-projection.benchmark.js';

test('fresh task identity validation preserves native full-row consumers and independent validation calls',async()=>{
 let mutate:(()=>void)|undefined;const f=await projectionHarness([1024],()=>{mutate?.();return true;});
 try{
  const a=f.runs.get('0:1024')!,b=f.runs.get('1:1024')!;
  const identitySql=`SELECT t.user_id AS validation_task_user_id,t.grant_id AS validation_task_grant_id,
   CASE WHEN l.user_id IS NULL THEN 0 ELSE 1 END AS validation_deleted,
   CASE WHEN g.grant_id IS NULL THEN 0 ELSE 1 END AS validation_grant_present,g.*
   FROM user_tasks AS t
   LEFT JOIN task_lifecycle_state AS l ON l.user_id=t.user_id AND l.deleted=1
   LEFT JOIN task_authorizations AS g ON g.grant_id=t.grant_id AND g.revoked=0
   WHERE t.task_id=?`.replace(/\s+/g,' ').trim(),modelSql='SELECT model_receipt FROM user_tasks WHERE task_id=?';
  const observeCheckpoints=(events:string[])=>observeGets(sql=>{if(sql===identitySql)events.push('identity');else if(sql===modelSql)events.push('model');});
  const events:string[]=[],observer=observeCheckpoints(events);mutate=()=>{events.push('domain');};
  try{f.node.authority.assert(a.context);}finally{mutate=undefined;observer.restore();}
  const checkpointGets=[identitySql,modelSql].reduce((count,sql)=>count+(observer.queries.get(sql)?.count??0),0);
  assert.equal(checkpointGets,3,'validate, validateGrant and modelCurrent retain three independent fresh reads');
  assert.equal(observer.queries.get(identitySql)?.count,2,'validate and validateGrant each execute the fresh joined identity proof');
  assert.equal(observer.queries.get(modelSql)?.count,1,'modelCurrent retains its independent raw receipt read');
  assert.deepEqual(events,['identity','domain','identity','model'],'the domain callback remains between distinct native identity reads, before modelCurrent');
  a.checkpoint.write('generated',{kept:true});a.progress({stage:'generated'});
  const response=await f.request(f.owners[0].token,'/api/tasks/'+a.task.id);assert.equal(response.statusCode,200);assert.deepEqual(response.json().checkpoints,['generated']);assert.deepEqual(response.json().progress,{stage:'generated'});
  assert.equal((await f.request(f.owners[0].token,'/api/tasks/'+b.task.id)).statusCode,404);
  const revokedEvents:string[]=[],revokedObserver=observeCheckpoints(revokedEvents);
  mutate=()=>{revokedEvents.push('domain');f.db.prepare('UPDATE task_authorizations SET revoked=1 WHERE task_id=?').run(a.task.id);};
  try{assert.equal(f.node.execution.engine.isCurrentInputGrant(a.task.id,a.context.credentialId.split(':')[1]),false,'authority revoked by domain validate is freshly rejected by validateGrant');}finally{mutate=undefined;revokedObserver.restore();}
  assert.equal(revokedObserver.queries.get(identitySql)?.count,2,'the second identity proof rereads the revocation committed by the domain callback');
  assert.equal(revokedObserver.queries.get(modelSql)?.count??0,0,'failed current identity still short-circuits modelCurrent');
  assert.deepEqual(revokedEvents,['identity','domain','identity']);f.node.authority.assert(b.context);
 }finally{await f.close();}
});

test('identity and durable authority changes remain live across connections and rollback',async()=>{
 const f=await projectionHarness(),a=f.runs.get('0:1024')!,b=f.runs.get('1:1024')!,other=new DatabaseSync(join(f.directory,'mote.sqlite'));
 try{
  const denied=()=>assert.throws(()=>f.node.authority.assert(a.context),{code:'invalid_identity'}),current=()=>f.node.authority.assert(a.context);
  const mutations:[string,unknown[]][]=[
   ['DELETE FROM user_tasks WHERE task_id=?',[a.task.id]],
   ['UPDATE user_tasks SET user_id=?,user_position=user_position+1000 WHERE task_id=?',[b.context.userId,a.task.id]],
   ['UPDATE user_tasks SET grant_id=? WHERE task_id=?',['generated-missing-grant',a.task.id]],
   ['UPDATE task_authorizations SET user_id=? WHERE task_id=?',[b.context.userId,a.task.id]],
   ['UPDATE task_authorizations SET task_id=? WHERE task_id=?',['generated-other-task',a.task.id]],
   ['UPDATE task_authorizations SET authorization_epoch=authorization_epoch+1 WHERE task_id=?',[a.task.id]],
   ['UPDATE task_authorizations SET revoked=1 WHERE task_id=?',[a.task.id]],
   ['DELETE FROM task_authorizations WHERE task_id=?',[a.task.id]],
  ];
  const primary=f.node.execution.engine.store.db,task=other.prepare('SELECT * FROM user_tasks WHERE task_id=?').get(a.task.id)!,grant=other.prepare('SELECT * FROM task_authorizations WHERE task_id=?').get(a.task.id)!;
  const insert=(table:string,row:Record<string,unknown>)=>{const keys=Object.keys(row);other.prepare('INSERT INTO '+table+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...Object.values(row) as any[]);};
  for(const [sql,params] of mutations){
   other.exec('BEGIN IMMEDIATE');try{other.prepare(sql).run(...params as any[]);current();}finally{other.exec('ROLLBACK');}current();
   primary.exec('BEGIN IMMEDIATE');try{primary.prepare(sql).run(...params as any[]);denied();}finally{primary.exec('ROLLBACK');}current();
   other.prepare(sql).run(...params as any[]);denied();f.node.authority.assert(b.context);
   other.exec('BEGIN IMMEDIATE');try{other.prepare('DELETE FROM user_tasks WHERE task_id=?').run(a.task.id);other.prepare('DELETE FROM task_authorizations WHERE grant_id=?').run(grant.grant_id);insert('task_authorizations',grant);insert('user_tasks',task);other.exec('COMMIT');}catch(error){other.exec('ROLLBACK');throw error;}current();
  }
 }finally{other.close();await f.close();}
});

test('account lifecycle and logout retain their existing task authority outcomes',async()=>{
 const f=await projectionHarness();
 try{
  const a=f.runs.get('0:1024')!,b=f.runs.get('1:1024')!;
  const session=await f.node.authority.authenticate(f.owners[0].token);
  assert.equal((await f.request(f.owners[0].token,'/api/auth/logout','POST',{})).statusCode,200);assert.throws(()=>f.node.authority.assert(session),{code:'invalid_identity'});f.node.authority.assert(a.context);
  f.db.prepare('INSERT INTO task_lifecycle_state VALUES(?,1)').run(a.context.userId);assert.throws(()=>f.node.authority.assert(a.context),{code:'invalid_identity'});
  f.db.prepare('UPDATE task_lifecycle_state SET deleted=0 WHERE user_id=?').run(a.context.userId);f.node.authority.assert(a.context);
  const primary=f.node.execution.engine.store.db;
  for(const change of ['disabled=1','authorization_epoch=authorization_epoch+1']){primary.exec('BEGIN IMMEDIATE');try{primary.prepare('UPDATE auth_accounts SET '+change+' WHERE user_id=?').run(a.context.userId);assert.throws(()=>f.node.authority.assert(a.context),{code:'invalid_identity'});f.node.authority.assert(b.context);}finally{primary.exec('ROLLBACK');}f.node.authority.assert(a.context);}
  primary.exec('BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON');try{primary.prepare('DELETE FROM auth_accounts WHERE user_id=?').run(a.context.userId);assert.throws(()=>f.node.authority.assert(a.context),{code:'invalid_identity'});}finally{primary.exec('ROLLBACK');}f.node.authority.assert(a.context);
  f.node.accounts!.close();assert.throws(()=>f.node.authority.assert(a.context),{code:'invalid_identity'});assert.throws(()=>f.node.authority.assert(b.context),{code:'invalid_identity'});
 }finally{await f.close();}
});

test('model receipt truthiness and live recovery checks remain unchanged',async()=>{
 const f=await projectionHarness();
 try{
  const a=f.runs.get('0:1024')!;const current=()=>f.node.execution.engine.isCurrentInputGrant(a.task.id,a.context.credentialId.split(':')[1]);
  for(const value of [null,'']){f.db.prepare('UPDATE user_tasks SET model_receipt=? WHERE task_id=?').run(value,a.task.id);assert.equal(current(),true);}
  f.db.prepare('UPDATE user_tasks SET model_receipt=? WHERE task_id=?').run('{}',a.task.id);assert.equal(current(),false,'nonempty raw receipt requires a genuine live model lease or recovery fence');
  f.db.prepare('UPDATE user_tasks SET model_receipt=NULL WHERE task_id=?').run(a.task.id);assert.equal(current(),true);
  // Actual M04 lease/hydration/recovery fences are covered by the unchanged
  // multiuser-execution-model consumers; this fixture cannot mint model leases.
 }finally{await f.close();}
});

test('late asynchronous returns and final writes retain lease and revocation fences',async()=>{
 const f=await projectionHarness();
 try{
  const a=f.runs.get('0:1024')!,b=f.runs.get('1:1024')!;
  f.db.prepare('UPDATE task_authorizations SET revoked=1 WHERE task_id=?').run(a.task.id);
  let called=false;assert.throws(()=>a.grant.commit(()=>{called=true;}),error=>error instanceof ExecutionFailure&&error.category==='stale'&&error.code==='input_changed');assert.equal(called,false,'revoked commit never invokes the write callback');
  f.release.resolve();const deadline=Date.now()+8000;
  while(['running','waiting'].includes(f.node.execution.engine.get(a.task.id)!.state)||f.node.execution.engine.get(b.task.id)!.state!=='succeeded'){if(Date.now()>deadline)assert.fail('late handler returns did not settle');await delay(5);}
  assert.notEqual(f.node.execution.engine.get(a.task.id)!.state,'succeeded');assert.equal(f.commits(),1);
  const response=await f.request(f.owners[0].token,'/api/tasks/'+a.task.id);assert.equal(response.json().result,undefined);
 }finally{await f.close();}
});
