import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {buildApp} from '../src/app.js';
import {EXECUTION_POLICIES} from '../src/execution-policy.js';
import {backupScopedInstance,verifiedScopedBackup} from '../../../scripts/scoped-backup.mjs';
import {verifiedBackup} from '../../../scripts/profile-lib.mjs';
import {scopedFilesFixture} from './fixtures/scoped-files.js';
import {waitForScopedState} from './fixtures/scoped-process.js';

const repository=fileURLToPath(new URL('../../../',import.meta.url));
const restoreScript=fileURLToPath(new URL('../../../scripts/restore-instance.mjs',import.meta.url));
const password='Generated-joint-files-password';
const digest=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
const operationPath=(id:string)=>'/api/operations/'+encodeURIComponent(id);
const taskRequest=(operationId:string,label:string)=>({kind:'generated.backup-generation',operationId,input:{label}});
const read=<T>(directory:string,work:(db:DatabaseSync)=>T)=>{const db=new DatabaseSync(join(directory,'mote.sqlite'),{readOnly:true});try{return work(db);}finally{db.close();}};
const mappings=(directory:string)=>read(directory,db=>db.prepare('SELECT * FROM operation_parent_generations ORDER BY parent_id,child_id').all());
function bytesIn(directory:string):unknown{
 return readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).map(entry=>[entry.name,entry.isDirectory()?bytesIn(join(directory,entry.name)):digest(readFileSync(join(directory,entry.name)))]);
}
const restoreCli=(from:string,target:string,deploymentId:string)=>spawnSync(process.execPath,['--import','tsx',restoreScript,'--from',from,'--data',target,'--deployment-id',deploymentId],{cwd:repository,encoding:'utf8',timeout:20000});

async function archiveFixture(t:TestContext){
 const calls:string[]=[];
 const register=(node:Awaited<ReturnType<typeof buildApp>>)=>node.execution!.register({kind:'generated.backup-generation',pool:'generated.backup-generation',concurrency:()=>2,policy:EXECUTION_POLICIES.deterministic,parseInput:raw=>{assert.ok(raw&&typeof raw==='object'&&'label' in raw);return raw as {label:string};},execute:async run=>{calls.push(String(run.task.input.label));return {retained:true};}});
 const f=await scopedFilesFixture(t,register),directory=mkdtempSync(join(tmpdir(),'mote-execution-generation-backup-'));
 t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const owners=[];
 for(const account of [f.a,f.b]){
  const service=f.host.execution!.forUser(await f.host.authority.authenticate(account.token));
  const previous=service.submitSync(taskRequest('file:previous','previous'),{parentOperationId:'file:canonical',generation:{slot:'pipeline'}});
  await waitForScopedState(async()=>(await f.checked(account.token,'/api/tasks/'+previous.id)).state==='succeeded',()=>'previous generated task did not settle');
  const current=service.submitSync(taskRequest('file:current','current'),{parentOperationId:'file:canonical',generation:{slot:'pipeline'}});
  await waitForScopedState(async()=>(await f.checked(account.token,'/api/tasks/'+current.id)).state==='succeeded',()=>'current generated task did not settle');
  const parent=service.operations().page({kind:'file'}).items.find(item=>{const steps=service.operations().detail(item.id).steps;return steps.some(step=>step.id===previous.id)&&steps.some(step=>step.id===current.id);});
  assert.ok(parent);assert.equal(parent.total,1);
  owners.push({account,username:account===f.a?'generated-a':'generated-b',previous,current,parentId:parent.id});
 }
 await f.host.app.close();
 const snapshot=join(directory,'snapshot');
 await backupScopedInstance({source:f.directory,out:snapshot});
 assert.equal(mappings(snapshot).length,2);
 return {f,directory,snapshot,owners,calls,register};
}

test('complete stopped backup and the real restore CLI retain parent generation mappings without restoring old authority',async t=>{
 const {f,directory,snapshot,owners,calls,register}=await archiveFixture(t),expected=mappings(snapshot),target=join(directory,'restored');
 const restoredReceipt=restoreCli(snapshot,target,f.host.deploymentId);
 assert.equal(restoredReceipt.status,0,restoredReceipt.stderr);assert.equal(JSON.parse(restoredReceipt.stdout).restored,true);
 assert.deepEqual(mappings(target),expected,'the complete SQLite backup preserves the exact parent slot/version mapping');
 read(target,db=>{assert.equal(db.prepare('SELECT count(*) n FROM task_authorizations WHERE revoked=0').get()!.n,0);assert.equal(db.prepare('SELECT count(*) n FROM auth_credentials WHERE revoked_at IS NULL').get()!.n,0);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);});
 const sourceCalls=calls.length,restored=await buildApp({dataDir:target});register(restored);
 try{
  const request=(token:string|undefined,url:string,method:any='GET',payload?:unknown)=>restored.app.inject({method,url,headers:{'x-mote-protocol-version':'2',...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
  const checked=async(...args:Parameters<typeof request>)=>{const response=await request(...args);assert.equal(response.statusCode,200,response.body);return response.json();};
  assert.equal((await request(owners[0].account.token,'/api/auth/self')).statusCode,401);
  const [a,b]=await Promise.all(owners.map(async({username})=>checked(undefined,'/api/auth/login','POST',{username,password,mode:'client'})));
  // A fresh password login admits each owner's real lifecycle.future work.
  // Observe its terminal task and scopes before measuring later A/B isolation.
  for(const [owner,login] of [[owners[0],a],[owners[1],b]] as const){
   const context=await restored.authority.authenticate(login.token),recovery=read(target,db=>db.prepare('SELECT restoration_id,epoch,task_id FROM lifecycle_future WHERE user_id=?').get(owner.account.userId));assert.ok(recovery?.task_id);assert.equal(recovery.epoch,context.authorizationEpoch);
   const recoveryId=String(recovery.task_id);let observed:unknown;
   await waitForScopedState(async()=>{
    const task=await checked(login.token,'/api/tasks/'+recoveryId),state=read(target,db=>({future:db.prepare('SELECT restoration_id,epoch,task_id,state FROM lifecycle_future WHERE user_id=?').get(owner.account.userId)!,scopes:db.prepare('SELECT scope_key,state,error,probe_task_id FROM lifecycle_future_scopes WHERE user_id=? AND restoration_id=? ORDER BY scope_key').all(owner.account.userId,recovery.restoration_id)}));
    assert.equal(task.kind,'lifecycle.future');assert.equal(state.future.task_id,recoveryId);assert.equal(state.future.restoration_id,recovery.restoration_id);assert.equal(state.future.epoch,context.authorizationEpoch);
    observed={owner:owner.account.userId,taskId:recoveryId,taskState:task.state,...state};
    return ['succeeded','failed','blocked','stale','cancelled'].includes(task.state)&&state.scopes.every(scope=>['completed','failed'].includes(String(scope.state)));
   },()=>JSON.stringify(observed));
   t.diagnostic(JSON.stringify({phase:'fresh-restoration-terminal-before-isolation',observed}));
  }
  assert.equal(calls.length,sourceCalls,'opening a restored vault must not replay completed or revoked work');
  assert.deepEqual(mappings(target),expected,'production startup must retain the mapping instead of recreating an empty table');
  const service=restored.execution!.forUser(await restored.authority.authenticate(a.token));
  const beforeB=await checked(b.token,operationPath(owners[1].parentId)),cursorB=(await checked(b.token,'/api/operations')).changeCursor;
  const late=service.submitSync(taskRequest('capture:late-current-child','late-current-child'),{parentOperationId:'file:current'});
  await waitForScopedState(async()=>(await checked(a.token,'/api/tasks/'+late.id)).state==='succeeded',()=>'freshly authorized late child did not settle');
  let parent=await checked(a.token,operationPath(owners[0].parentId));
  assert.equal(parent.operation.total,2);assert.equal(parent.operation.counts.succeeded,2);
  read(target,db=>{const membership=db.prepare('SELECT slot,generation,active FROM execution_operation_steps WHERE operation_id=? AND step_id=?').get(owners[0].parentId,late.id)!;assert.equal(membership.slot,'pipeline');assert.equal(membership.generation,owners[0].current.id);assert.equal(membership.active,1);});
  const next=service.submitSync(taskRequest('file:replacement','replacement'),{parentOperationId:'file:canonical',generation:{slot:'pipeline'}});
  await waitForScopedState(async()=>(await checked(a.token,'/api/tasks/'+next.id)).state==='succeeded',()=>'replacement generation did not settle');
  parent=await checked(a.token,operationPath(owners[0].parentId));
  assert.equal(parent.operation.total,1);assert.equal(parent.operation.counts.succeeded,1);
  for(const retired of [owners[0].previous,owners[0].current,late])assert.equal(parent.steps.find((step:{id:string})=>step.id===retired.id).current,false);
  assert.equal(parent.steps.find((step:{id:string})=>step.id===next.id).current,true);
  assert.deepEqual(await checked(b.token,operationPath(owners[1].parentId)),beforeB);
  assert.equal((await checked(b.token,'/api/operations')).changeCursor,cursorB);
  assert.equal((await request(b.token,operationPath(owners[0].parentId))).statusCode,404);
  assert.deepEqual(calls.slice(sourceCalls),['late-current-child','replacement']);
 }finally{await restored.app.close();}
});

test('checksummed current archives missing the parent generation table or any required column reject before target writes',async t=>{
 const {f,directory,snapshot}=await archiveFixture(t);
 for(const field of ['table','parent_id','child_id','slot','version'])await t.test(field,async()=>{
  const damaged=join(directory,'missing-'+field);cpSync(snapshot,damaged,{recursive:true});
  const db=new DatabaseSync(join(damaged,'mote.sqlite'));try{db.exec(field==='table'?'DROP TABLE operation_parent_generations':'ALTER TABLE operation_parent_generations RENAME COLUMN '+field+' TO generated_missing_'+field);}finally{db.close();}
  const manifestPath=join(damaged,'backup-manifest.json'),manifest=JSON.parse(readFileSync(manifestPath,'utf8'));manifest.checksums['mote.sqlite']=digest(readFileSync(join(damaged,'mote.sqlite')));writeFileSync(manifestPath,JSON.stringify(manifest));
  const before=bytesIn(damaged),newParent=join(directory,'absent-'+field),target=join(newParent,'target');
  const rejected=restoreCli(damaged,target,f.host.deploymentId);
  assert.equal(rejected.status,1,rejected.stdout||rejected.stderr);assert.match(rejected.stderr,/Instance restore failed/);
  assert.equal(existsSync(newParent),false,'schema rejection must precede target parent creation');
  const empty=join(directory,'empty-'+field);mkdirSync(empty);const beforeSiblings=readdirSync(directory).sort();
  const rejectedEmpty=restoreCli(damaged,empty,f.host.deploymentId);assert.equal(rejectedEmpty.status,1,rejectedEmpty.stdout||rejectedEmpty.stderr);
  assert.deepEqual(readdirSync(empty),[]);assert.deepEqual(readdirSync(directory).sort(),beforeSiblings,'rejection must leave no staging directory');
  await assert.rejects(verifiedScopedBackup(damaged),/Incomplete instance domain database/);
  await assert.rejects(verifiedBackup(damaged),/Incomplete instance domain database/);
  assert.deepEqual(bytesIn(damaged),before,'validation must not create archive sidecars or change its bytes');
  if(field==='table'||field==='slot'){
   const source=join(directory,'source-'+field),out=join(directory,'rejected-backup-'+field);cpSync(f.directory,source,{recursive:true});
   const sourceDb=new DatabaseSync(join(source,'mote.sqlite'));try{sourceDb.exec(field==='table'?'DROP TABLE operation_parent_generations':'ALTER TABLE operation_parent_generations RENAME COLUMN slot TO generated_missing_slot');}finally{sourceDb.close();}
   const sourceBefore=bytesIn(source);await assert.rejects(backupScopedInstance({source,out}),/Incomplete instance domain database/);assert.equal(existsSync(out),false);assert.deepEqual(bytesIn(source),sourceBefore);
  }
 });
});

test('current retry budgets, immutable attempt lineage and exact physical cleanup records are required before restore writes',async t=>{
 const {f,directory,snapshot}=await archiveFixture(t);
 const required={execution_retry_policies:'max_attempts',execution_attempt_sessions:'executed',execution_retry_rounds:'round',task_model_attempts:'receipt',task_external_policy_replays:['issuance_id','replacement_command'],task_physical_calls:['owner_token','attempt_id'],task_physical_resources:'resource_key',task_owner_retry_groups:'command_task_id',task_owner_retry_targets:'task_id'};
 for(const [table,columns]of Object.entries(required))for(const missing of ['table',...(Array.isArray(columns)?columns:[columns])])await t.test(table+':'+missing,async()=>{
  const name=table+'-'+missing,damaged=join(directory,'missing-'+name);cpSync(snapshot,damaged,{recursive:true});const db=new DatabaseSync(join(damaged,'mote.sqlite'));try{db.exec(missing==='table'?'DROP TABLE '+table:'ALTER TABLE '+table+' RENAME COLUMN '+missing+' TO generated_missing_'+missing);}finally{db.close();}
  const manifestPath=join(damaged,'backup-manifest.json'),manifest=JSON.parse(readFileSync(manifestPath,'utf8'));manifest.checksums['mote.sqlite']=digest(readFileSync(join(damaged,'mote.sqlite')));writeFileSync(manifestPath,JSON.stringify(manifest));const before=bytesIn(damaged),parent=join(directory,'absent-'+name);
  const rejected=restoreCli(damaged,join(parent,'target'),f.host.deploymentId);assert.equal(rejected.status,1,rejected.stdout||rejected.stderr);assert.match(rejected.stderr,/Instance restore failed/);assert.equal(existsSync(parent),false);await assert.rejects(verifiedScopedBackup(damaged),/Incomplete instance domain database/);assert.deepEqual(bytesIn(damaged),before);
 });
});
